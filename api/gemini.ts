/**
 * Copixi — Vercel Function proxy to Gemini (JSON-only, token-efficient)
 * AGENTS.md §11: Minimal proxy. Protects GEMINI_API_KEY, validates JSON, rate-limits.
 * Two modes: summary (aggregated context) and extract (truncated text → rows JSON)
 * All payloads are JSON, never raw rows (§8). Minimal tokens (§9).
 */

type VercelRequest = {
  method?: string
  body?: unknown
  headers: Record<string, string | string[] | undefined>
}

type VercelResponse = {
  status: (code: number) => VercelResponse
  json: (data: unknown) => void
  setHeader: (name: string, value: string) => void
}

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

function getClientIp(req: VercelRequest): string {
  const forwarded = req.headers['x-forwarded-for']
  if (typeof forwarded === 'string') return forwarded.split(',')[0]?.trim() ?? 'unknown'
  if (Array.isArray(forwarded)) return forwarded[0] ?? 'unknown'
  return 'unknown'
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed. Use POST.' })
    return
  }
  const ip = getClientIp(req)
  if (isRateLimited(ip)) {
    res.status(429).json({ error: 'Rate limit exceeded. Try again later.' })
    return
  }
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    res.status(500).json({ error: 'Server misconfiguration: GEMINI_API_KEY not set.' })
    return
  }
  const body = req.body as Record<string, unknown> | undefined
  if (!body || typeof body !== 'object') {
    res.status(400).json({ error: 'Invalid payload: expected JSON object.' })
    return
  }

  const mode = (body as { mode?: string }).mode
  // Legacy fallback: messages array from old client — convert to summary
  const isLegacyMessages = Array.isArray((body as { messages?: unknown }).messages)

  try {
    let prompt = ''
    let maxTokens = 512
    let expectJson = false

    if (mode === 'summary') {
      const ctx = (body as { context?: unknown }).context
      if (!ctx || typeof ctx !== 'object') {
        res.status(400).json({ error: 'summary requires context object' })
        return
      }
      const ctxStr = JSON.stringify(ctx)
      if (ctxStr.length > 8000) {
        res.status(400).json({ error: 'context too large (max 8000 chars)' })
        return
      }
      prompt = `Eres Copixi, analista de datos. Con este contexto JSON agregado (nunca filas crudas), genera un resumen en español en 3-5 bullets concisos + 1 insight accionable. Cita números del contexto. No inventes columnas. Responde en texto plano, no JSON.\n\nContexto: ${ctxStr}`
      maxTokens = 512
    } else if (mode === 'extract') {
      const text = (body as { text?: unknown }).text
      const filename = String((body as { filename?: unknown }).filename ?? 'document')
      if (typeof text !== 'string' || !text.trim()) {
        res.status(400).json({ error: 'extract requires text string' })
        return
      }
      if (text.length > 8000) {
        res.status(400).json({ error: 'text too large (max 8000 chars, send truncated)' })
        return
      }
      prompt = `Extrae datos tabulares de este documento "${filename}". Texto (truncado):\n"""${text}"""\n\nInstrucciones: Si hay tabla, retorna JSON array de objetos con keys = columnas normalizadas (lowercase, sin espacios). Valores como string o number. Si no hay tabla pero hay datos estructurados (fechas, montos, categorías), inventa columnas razonables y extrae hasta 30 filas. Si no hay datos tabulares, retorna []. Responde SOLO con JSON array, sin markdown, sin explicación.`
      maxTokens = 1200
      expectJson = true
    } else if (isLegacyMessages) {
      const messages = (body as { messages: { role?: string; content?: string }[] }).messages
      if (messages.length > 20) {
        res.status(400).json({ error: 'Too many messages (max 20)' })
        return
      }
      prompt = messages.map((m) => `${m.role ?? 'user'}: ${m.content ?? ''}`).join('\n').slice(0, 6000)
      maxTokens = 512
    } else {
      res.status(400).json({ error: 'Invalid mode. Use {mode:"summary",context} or {mode:"extract",text,filename}' })
      return
    }

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`

    const geminiRes = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: maxTokens,
          temperature: 0.4,
          ...(expectJson ? { responseMimeType: 'application/json' } : {}),
        },
      }),
    })

    if (!geminiRes.ok) {
      const errText = await geminiRes.text()
      res.status(geminiRes.status).json({ error: 'Gemini API error', detail: errText.slice(0, 800) })
      return
    }

    const data = (await geminiRes.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] }
    const textOut = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''

    if (mode === 'extract') {
      // Try parse JSON array from response
      let rows: unknown = null
      const cleaned = textOut.trim().replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim()
      try {
        const parsed = JSON.parse(cleaned)
        if (Array.isArray(parsed)) rows = parsed.slice(0, 50) // cap rows
        else rows = null
      } catch {
        rows = null
      }
      if (!rows) {
        res.status(200).json({ text: textOut, rows: null, error: 'No valid JSON array extracted' })
        return
      }
      res.setHeader('Content-Type', 'application/json')
      res.status(200).json({ rows, text: textOut.slice(0, 2000) })
      return
    }

    res.setHeader('Content-Type', 'application/json')
    res.status(200).json({ text: textOut.slice(0, 3000) })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    res.status(500).json({ error: 'Internal error calling Gemini', detail: message.slice(0, 500) })
  }
}
