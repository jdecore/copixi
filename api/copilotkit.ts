/**
 * Copixi — CopilotKit v2 Runtime endpoint for Vercel
 * AGENTS.md §11: Minimal proxy to Gemini. Validates, sanitizes, rate-limits.
 * Uses CopilotRuntime + BuiltInAgent (Google Gemini) so CopilotKit actions work.
 *
 * Keep minimal: no traditional backend, single aggregated context only (§8).
 */

import 'reflect-metadata'
import { Readable } from 'node:stream'
import type { IncomingMessage, ServerResponse } from 'node:http'
import {
  CopilotRuntime,
  BuiltInAgent,
  createCopilotRuntimeHandler,
  InMemoryAgentRunner,
} from '@copilotkit/runtime/v2'

const AGENT_INSTRUCTIONS = `You are Copixi AI Data Analyst. You have tools: setFilter, clearFilters, removeFilter, setChart, setDateRange, compareValues, showInsight, sortData, searchData, explainColumn, getTopCategories, ragQuery.

RULES:
- Always validate columns against the whitelist before calling any action.
- Prefer actions over plain text when the user asks to change the dashboard.
- When the user asks a question about the data, use explainColumn or getTopCategories to provide structured answers.
- For vague or exploratory questions like "what do you see", "tell me about the data", "search for X", use ragQuery to retrieve relevant rows via semantic search.
- Keep answers concise and cite numbers from context.
- Never mention raw rows or suggest uploading data to a server. Data stays in the browser.
- If asked for trends, reference timeSeries. If asked for anomalies, reference anomalies.
- Suggest relevant actions proactively when the user asks vague questions like "what can you do" or "help".
- For compareValues, use metric "sales" by default; if the user asks about units or customers, pass metric accordingly.`

// Rate-limit trivial per instance
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

const apiKey = process.env.GEMINI_API_KEY
if (!apiKey) {
  // AGENTS.md §10: key must be set server-side. Warn but allow build to proceed.
  console.warn('[Copixi] GEMINI_API_KEY not set — AI responses will fail until configured.')
}

const agent = new BuiltInAgent({
  model: 'google/gemini-3.5-flash-lite',
  apiKey,
  maxSteps: 6,
  prompt: AGENT_INSTRUCTIONS,
})

const runtime = new CopilotRuntime({
  agents: { default: agent },
  runner: new InMemoryAgentRunner(),
  // Enables A2UI: /info advertises A2UI so the client auto-mounts the renderer.
  a2ui: {},
})

const handler = createCopilotRuntimeHandler({
  runtime,
  basePath: '/api/copilotkit',
})

function toWebRequest(req: IncomingMessage): Request {
  const host = req.headers.host ?? 'localhost'
  const url = `http://${host}${req.url ?? '/'}`
  const headers = new Headers()
  for (const [key, value] of Object.entries(req.headers)) {
    if (value) headers.set(key, Array.isArray(value) ? value.join(', ') : String(value))
  }
  const method = req.method ?? 'GET'
  const body =
    method === 'GET' || method === 'HEAD'
      ? undefined
      : (Readable.toWeb(req) as unknown as ReadableStream)
  return new Request(url, { method, headers, body })
}

function writeWebResponse(res: ServerResponse, response: Response): void {
  res.statusCode = response.status
  response.headers.forEach((value, key) => res.setHeader(key, value))
  if (response.body) {
    Readable.fromWeb(response.body as Parameters<typeof Readable.fromWeb>[0]).pipe(res)
  } else {
    res.end()
  }
}

export default async function copilotkit(req: IncomingMessage, res: ServerResponse) {
  const forwarded = req.headers['x-forwarded-for']
  const ip =
    (typeof forwarded === 'string' ? forwarded.split(',')[0]?.trim() : undefined) ?? 'unknown'

  if (isRateLimited(ip)) {
    res.statusCode = 429
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'Rate limit exceeded. Try again later.' }))
    return
  }

  const request = toWebRequest(req)
  const response = await handler(request)
  writeWebResponse(res, response)
}
