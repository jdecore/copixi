/**
 * Copixi — Unified Vercel Function (AI SDK v7)
 * AGENTS.md §11: Minimal proxy. Protects keys, validates input, rate-limits.
 * Single endpoint handling three shapes:
 *   - chat:    { messages, context? }  -> SSE UI message stream (useChat)
 *   - summary: { mode:'summary', context } -> JSON { text }
 *   - extract: { mode:'extract', text, filename } -> JSON { rows | text }
 *
 * Primary model: Gemini (Google). Fallback: OpenRouter if GEMINI_API_KEY is absent.
 * No raw rows are ever sent (§8). Only aggregated context.
 */

import {
  generateText,
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
} from 'ai'
import { createGoogle } from '@ai-sdk/google'
import { createOpenAI } from '@ai-sdk/openai'

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

function getClientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0]?.trim() ?? 'unknown'
  return 'unknown'
}

// Ordered Gemini model candidates. A retired/inaccessible model should not
// hard-crash the function: we fall through to the next candidate, then OpenRouter.
const GEMINI_MODELS = Array.from(
  new Set(
    [
      process.env.GEMINI_MODEL?.trim(),
      'gemini-2.0-flash',
      'gemini-1.5-flash',
      'gemini-2.5-flash',
      'gemini-flash-latest',
    ].filter(Boolean) as string[],
  ),
)
const OPENROUTER_MODEL = 'openrouter/auto-beta'

function geminiProvider() {
  const key = process.env.GEMINI_API_KEY?.trim()
  return key ? createGoogle({ apiKey: key }) : null
}

function openrouterModel() {
  const key = process.env.OPENROUTER_API_KEY?.trim()
  if (!key) return null
  return createOpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: key,
    headers: { 'HTTP-Referer': 'https://copixi.vercel.app', 'X-Title': 'Copixi' },
  })(OPENROUTER_MODEL)
}

// Build the list of candidate models (Gemini chain first, OpenRouter last).
function candidateModels() {
  const google = geminiProvider()
  const models: any[] = GEMINI_MODELS.map((m) => (google ? google(m) : null)).filter(Boolean)
  const or = openrouterModel()
  if (or) models.push(or)
  return models
}

// Run a generateText call across candidates, returning the first success.
// On total failure, throws the last provider error (surfaced as a clean HTTP error).
async function generateWithFallback(opts: any) {
  const models = candidateModels()
  if (models.length === 0) {
    throw new Error('Server misconfiguration: no AI provider key set (GEMINI_API_KEY or OPENROUTER_API_KEY).')
  }
  let lastErr: unknown
  for (const model of models) {
    try {
      const result = await generateText({ ...opts, model })
      return result.text
    } catch (err) {
      lastErr = err
      const msg = err instanceof Error ? err.message : String(err)
      // Auth/key errors are not worth retrying with the same provider key.
      if (/API key not valid|permission|denied|401|403|UNAUTHENTICATED/i.test(msg)) {
        // skip remaining models that share the same Gemini key, but keep trying OpenRouter (different key)
        if (!/openrouter/i.test(String(model))) continue
      }
      // model-not-found / 404 -> try next candidate
    }
  }
  throw lastErr
}

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

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed. Use POST.' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const ip = getClientIp(req)
  if (isRateLimited(ip)) {
    return new Response(JSON.stringify({ error: 'Rate limit exceeded. Try again later.' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const mode = typeof body.mode === 'string' ? body.mode : undefined

  if (mode === 'summary' || mode === 'extract') {
    try {
      if (mode === 'summary') {
        const ctx = body.context
        if (!ctx || typeof ctx !== 'object') {
          return new Response(JSON.stringify({ error: 'summary requires context object' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          })
        }
        const ctxStr = JSON.stringify(ctx)
        if (ctxStr.length > 8000) {
          return new Response(JSON.stringify({ error: 'context too large (max 8000 chars)' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          })
        }
        const prompt = `Genera un resumen en español en 3-5 bullets concisos + 1 insight accionable sobre este dataset. Cita números reales del contexto. No inventes columnas. Texto plano, sin JSON.\n\nContexto: ${ctxStr}`
        const text = (await generateWithFallback({ messages: [{ role: 'user', content: prompt }], maxOutputTokens: 512 })).trim()
        if (!text) return new Response(JSON.stringify({ error: 'Empty summary' }), { status: 200, headers: { 'Content-Type': 'application/json' } })
        return new Response(JSON.stringify({ text }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }

      const text = typeof body.text === 'string' ? body.text : ''
      const filename = String(body.filename ?? 'document')
      if (!text.trim()) {
        return new Response(JSON.stringify({ error: 'extract requires text string' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      if (text.length > 8000) {
        return new Response(JSON.stringify({ error: 'text too large (max 8000 chars, send truncated)' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      const prompt = `Extrae datos tabulares de este documento "${filename}". Texto (truncado):\n"""${text}"""\n\nInstrucciones: Si hay tabla, retorna JSON array de objetos con keys = columnas normalizadas (lowercase, sin espacios). Valores string o number. Si no hay tabla pero hay datos estructurados, inventa columnas razonables y extrae hasta 30 filas. Si no hay datos tabulares, retorna []. Responde SOLO con el JSON array, sin markdown ni explicación.`
      const raw = await generateWithFallback({ messages: [{ role: 'user', content: prompt }], maxOutputTokens: 1200 })
      const cleaned = raw.trim().replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim()
      let rows: unknown = null
      try {
        const parsed = JSON.parse(cleaned)
        if (Array.isArray(parsed)) rows = parsed.slice(0, 50)
      } catch {
        rows = null
      }
      if (!rows) {
        return new Response(JSON.stringify({ text: raw, rows: null, error: 'No valid JSON array extracted' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      return new Response(JSON.stringify({ rows }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      return new Response(JSON.stringify({ error: 'AI provider error', detail: message.slice(0, 500) }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  }

  const messages = Array.isArray(body.messages) ? (body.messages as Parameters<typeof convertToModelMessages>[0]) : null
  if (!messages || messages.length === 0) {
    return new Response(JSON.stringify({ error: 'Invalid request: expected messages array.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const contextBlock = buildContextBlock(body.context)
  const system = EXCEL_SYSTEM + contextBlock

  try {
    const modelMessages = await convertToModelMessages(messages)
    // Generate non-streaming first so any provider/model/key error is caught
    // BEFORE we send the response. This prevents Vercel from surfacing a broken
    // stream as FUNCTION_INVOCATION_FAILED.
    const text = await generateWithFallback({
      messages: modelMessages,
      system,
      maxOutputTokens: 1024,
      temperature: 0.5,
    })

    // Re-emit as a UI message stream so the client useChat renders it normally.
    const id = globalThis.crypto?.randomUUID?.() ?? `msg-${Date.now()}`
    const stream = createUIMessageStream({
      execute({ writer }) {
        writer.write({ type: 'text-start', id } as any)
        writer.write({ type: 'text-delta', delta: text } as any)
        writer.write({ type: 'text-end', id } as any)
      },
    })
    return createUIMessageStreamResponse({ stream })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return new Response(JSON.stringify({ error: 'AI provider error', detail: message.slice(0, 500) }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
