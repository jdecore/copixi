/**
 * Copixi — Unified Vercel Function (Gemini + OpenRouter fallback)
 *
 * AGENTS.md §11: Minimal proxy. Protects keys, validates input, rate-limits.
 * Handles three shapes:
 *   - chat:    { messages, context? }  -> UI message stream (SSE) for the custom client
 *   - summary: { mode:'summary', context } -> JSON { text }
 *   - extract: { mode:'extract', text, filename } -> JSON { rows | text }
 *
 * Generation uses the official @google/generative-ai SDK (Gemini). If it fails
 * or no key is set, it falls back to OpenRouter (OpenAI-compatible). The chat
 * response is a plain SSE string (no streaming Response object) so Vercel never
 * surfaces a broken stream as FUNCTION_INVOCATION_FAILED.
 *
 * Only aggregated context is ever sent (§8). Never raw rows.
 */

import { GoogleGenerativeAI } from '@google/generative-ai'

const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX = 20
const hits = new Map<string, number[]>()

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const arr = hits.get(ip) ?? []
  const recent = arr.filter((t) => now - t < RATE_LIMIT_WINDOW_MS)
  recent.push(now)
  hits.set(ip, recent)
  return recent.length > RATE_LIMIT_MAX
}

function getClientIp(req: any): string {
  const h = req?.headers
  if (!h) return 'unknown'
  let fwd: string | undefined
  if (typeof h.get === 'function') fwd = h.get('x-forwarded-for')
  else if (typeof h['x-forwarded-for'] === 'string') fwd = h['x-forwarded-for']
  if (typeof fwd === 'string' && fwd) return fwd.split(',')[0].trim() || 'unknown'
  return 'unknown'
}

// Primary: Gemini. If it fails (e.g. tokens/quota exhausted, model unavailable),
// it automatically falls back to OpenRouter (nvidia/nemotron-3.5-lightning:free).
const GEMINI_MODEL = process.env.GEMINI_MODEL?.trim() || 'gemini-3.5-flash-lite'
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL?.trim() || 'nvidia/nemotron-3.5-lightning:free'

const EXCEL_SYSTEM = `Eres compe, un experto en Microsoft Excel y análisis de datos. Responde en español, de forma concisa y práctica.

Especialidades:
- Fórmulas (BUSCARV, XLOOKUP, SUMAR.SI, SI.CONJUNTO, ÍNDICE/COINCIDIR, texto, fecha, lógicas).
- Tablas dinámicas, Power Query, segmentación de datos.
- Gráficos, validación de datos, formato condicional.
- Limpieza y modelado de datos, análisis exploratorio.

Reglas:
- Da pasos claros y, cuando aplique, la fórmula exacta lista para pegar.
- Si el usuario pregunta sobre SU dataset cargado, usa el contexto agregado provisto (nunca filas crudas). Cita columnas y números reales del contexto.
- Puedes incluir al final un bloque JSON de acción para modificar el dashboard, en este formato exacto (sin markdown):
  {"action":"setFilter","column":"<nombre>","operator":"equals|contains|gt|lt|between","value":"<valor>"}
  Otras acciones válidas: "clearFilters", "setChart" (chartType line|bar|area|pie, x, y), "setDateRange" (from, to).
- Si no hay dataset cargado, responde como experto en Excel puro.
- No inventes columnas que no estén en el contexto.`

function buildContextBlock(context: unknown): string {
  if (!context || typeof context !== 'object') return ''
  const json = JSON.stringify(context)
  if (json.length > 8000) return `\n\nContexto del dataset (resumido): ${json.slice(0, 8000)}`
  return `\n\nContexto agregado del dataset (sin filas crudas):\n${json}`
}

// ---- Generation ----

async function genGemini(prompt: string, system: string): Promise<string> {
  const key = process.env.GEMINI_API_KEY?.trim()
  if (!key) throw new Error('no GEMINI_API_KEY')
  const genAI = new GoogleGenerativeAI(key)
  const model = genAI.getGenerativeModel({ model: GEMINI_MODEL, systemInstruction: system })
  const res = await model.generateContent(prompt)
  return res.response.text()
}

async function genOpenRouter(prompt: string, system: string): Promise<string> {
  const key = process.env.OPENROUTER_API_KEY?.trim()
  if (!key) throw new Error('no OPENROUTER_API_KEY')
  const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${key}`,
      'HTTP-Referer': 'https://copixi.vercel.app',
      'X-Title': 'Copixi',
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: prompt },
      ],
      max_tokens: 1024,
      temperature: 0.5,
    }),
  })
  if (!r.ok) {
    const t = await r.text()
    throw new Error(`openrouter ${r.status}: ${t.slice(0, 200)}`)
  }
  const j = (await r.json()) as { choices?: { message?: { content?: string } }[] }
  return j.choices?.[0]?.message?.content ?? ''
}

async function generate(prompt: string, system: string): Promise<string> {
  const errors: string[] = []
  // Gemini first (only if its key is actually configured, to avoid a misleading error)
  if (process.env.GEMINI_API_KEY?.trim()) {
    try {
      return await genGemini(prompt, system)
    } catch (e) {
      errors.push(`gemini: ${e instanceof Error ? e.message : String(e)}`)
    }
  }
  // OpenRouter fallback (used if Gemini is missing or fails: quota, model, network)
  if (process.env.OPENROUTER_API_KEY?.trim()) {
    try {
      return await genOpenRouter(prompt, system)
    } catch (e) {
      errors.push(`openrouter: ${e instanceof Error ? e.message : String(e)}`)
    }
  }
  if (errors.length === 0) {
    throw new Error('No AI provider configured (set GEMINI_API_KEY or OPENROUTER_API_KEY).')
  }
  throw new Error(errors.join(' | '))
}

// ---- SSE helpers (plain string response, Vercel-safe) ----

function sseChatText(text: string): string {
  const id = `msg-${Date.now()}`
  const chunks = [
    `data: ${JSON.stringify({ type: 'start', messageId: id })}`,
    `data: ${JSON.stringify({ type: 'text-start', id })}`,
    `data: ${JSON.stringify({ type: 'text-delta', delta: text })}`,
    `data: ${JSON.stringify({ type: 'text-end', id })}`,
    `data: ${JSON.stringify({ type: 'finish', finishReason: 'stop' })}`,
  ].join('\n\n') + '\n\n'
  return chunks
}

function messageText(m: any): string {
  if (typeof m?.content === 'string') return m.content
  if (Array.isArray(m?.parts)) return m.parts.filter((p: any) => p?.type === 'text').map((p: any) => p.text ?? '').join('')
  return ''
}

// ---- Runtime-agnostic request/response helpers ----
// Vercel may invoke this function either with the modern Web API
// (req: Request -> req.json(), return new Response()) or with the legacy
// Node signature (req: IncomingMessage, res: ServerResponse where headers is a
// plain object and there is no req.json). These helpers cover both so the
// function works on any Vercel runtime.

function readBody(req: any): Promise<any> {
  if (req && typeof req.json === 'function') return req.json()
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', (chunk: any) => { data += chunk })
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}) } catch (e) { reject(e) }
    })
    req.on('error', reject)
  })
}

function makeResponder(res: any) {
  const isNode = typeof res !== 'undefined' && typeof res.setHeader === 'function'
  return {
    json(status: number, data: any) {
      const body = JSON.stringify(data)
      if (isNode) {
        res.statusCode = status
        res.setHeader('content-type', 'application/json')
        res.end(body)
        return
      }
      return new Response(body, { status, headers: { 'content-type': 'application/json' } })
    },
    sse(sseText: string) {
      const headers: Record<string, string> = {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache, no-transform',
        connection: 'close',
      }
      if (isNode) {
        res.statusCode = 200
        for (const [k, v] of Object.entries(headers)) res.setHeader(k, v)
        res.end(sseText)
        return
      }
      return new Response(sseText, { status: 200, headers })
    },
  }
}

// ---- Handler ----

export default async function handler(req: any, res?: any): Promise<Response | void> {
  const respond = makeResponder(res)

  const method = req?.method || 'GET'
  if (method !== 'POST') {
    return respond.json(405, { error: 'Method not allowed. Use POST.' })
  }

  const ip = getClientIp(req)
  if (isRateLimited(ip)) {
    return respond.json(429, { error: 'Rate limit exceeded. Try again later.' })
  }

  let body: Record<string, unknown>
  try {
    body = (await readBody(req)) as Record<string, unknown>
  } catch {
    return respond.json(400, { error: 'Invalid JSON body' })
  }

  const mode = typeof body.mode === 'string' ? body.mode : undefined

  if (mode === 'summary' || mode === 'extract') {
    try {
      if (mode === 'summary') {
        const ctx = body.context
        if (!ctx || typeof ctx !== 'object') {
          return respond.json(400, { error: 'summary requires context object' })
        }
        const ctxStr = JSON.stringify(ctx)
        if (ctxStr.length > 8000) {
          return respond.json(400, { error: 'context too large (max 8000 chars)' })
        }
        const prompt = `Genera un resumen en español en 3-5 bullets concisos + 1 insight accionable sobre este dataset. Cita números reales del contexto. No inventes columnas. Texto plano, sin JSON.\n\nContexto: ${ctxStr}`
        const text = (await generate(prompt, EXCEL_SYSTEM)).trim()
        if (!text) return respond.json(200, { error: 'Empty summary' })
        return respond.json(200, { text })
      }

      const text = typeof body.text === 'string' ? body.text : ''
      const filename = String(body.filename ?? 'document')
      if (!text.trim()) {
        return respond.json(400, { error: 'extract requires text string' })
      }
      if (text.length > 8000) {
        return respond.json(400, { error: 'text too large (max 8000 chars, send truncated)' })
      }
      const prompt = `Extrae datos tabulares de este documento "${filename}". Texto (truncado):\n"""${text}"""\n\nInstrucciones: Si hay tabla, retorna JSON array de objetos con keys = columnas normalizadas (lowercase, sin espacios). Valores string o number. Si no hay tabla pero hay datos estructurados, inventa columnas razonables y extrae hasta 30 filas. Si no hay datos tabulares, retorna []. Responde SOLO con el JSON array, sin markdown ni explicación.`
      const raw = await generate(prompt, EXCEL_SYSTEM)
      const cleaned = raw.trim().replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim()
      let rows: unknown = null
      try {
        const parsed = JSON.parse(cleaned)
        if (Array.isArray(parsed)) rows = parsed.slice(0, 50)
      } catch {
        rows = null
      }
      if (!rows) {
        return respond.json(200, { text: raw, rows: null, error: 'No valid JSON array extracted' })
      }
      return respond.json(200, { rows })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      return respond.json(502, { error: 'AI provider error', detail: message.slice(0, 500) })
    }
  }

  // Chat mode
  const messages = Array.isArray(body.messages) ? (body.messages as any[]) : null
  if (!messages || messages.length === 0) {
    return respond.json(400, { error: 'Invalid request: expected messages array.' })
  }

  const contextBlock = buildContextBlock(body.context)
  const conversation = messages
    .map((m) => `${m.role === 'assistant' ? 'Asistente' : 'Usuario'}: ${messageText(m)}`)
    .join('\n')
  const prompt = `${conversation}${contextBlock}`

  try {
    const text = await generate(prompt, EXCEL_SYSTEM)
    return respond.sse(sseChatText(text))
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return respond.json(502, { error: 'AI provider error', detail: message.slice(0, 500) })
  }
}
