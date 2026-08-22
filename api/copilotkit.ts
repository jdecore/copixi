/**
 * Copixi — CopilotKit Runtime endpoint for Vercel
 * AGENTS.md §11: Minimal proxy to Gemini. Validates, sanitizes, rate-limits.
 * Uses CopilotRuntime + GoogleGenerativeAIAdapter so CopilotKit actions work.
 *
 * Keep minimal: no traditional backend, single aggregated context only (§8).
 */

import 'reflect-metadata'
import { CopilotRuntime, GoogleGenerativeAIAdapter, copilotRuntimeNodeHttpEndpoint } from '@copilotkit/runtime'

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

function getClientIp(headers: Record<string, string | string[] | undefined>): string {
  const forwarded = headers['x-forwarded-for']
  if (typeof forwarded === 'string') return forwarded.split(',')[0]?.trim() ?? 'unknown'
  if (Array.isArray(forwarded)) return forwarded[0] ?? 'unknown'
  return 'unknown'
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed. Use POST.' })
    return
  }

  const ip = getClientIp(req.headers ?? {})
  if (isRateLimited(ip)) {
    res.status(429).json({ error: 'Rate limit exceeded. Try again later.' })
    return
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    res.status(500).json({ error: 'Server misconfiguration: GEMINI_API_KEY not set.' })
    return
  }

  // Wrap node-http handler but keep CORS for local dev
  res.setHeader?.('Access-Control-Allow-Origin', '*')
  res.setHeader?.('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
  res.setHeader?.('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  const serviceAdapter = new GoogleGenerativeAIAdapter({
    apiKey,
    model: 'gemini-2.0-flash',
  })

  const runtime = new CopilotRuntime()

  const handlerFn = copilotRuntimeNodeHttpEndpoint({
    endpoint: '/api/copilotkit',
    runtime,
    serviceAdapter,
  })

  // copilotRuntimeNodeHttpEndpoint expects Node http IncomingMessage/ServerResponse
  return handlerFn(req, res)
}
