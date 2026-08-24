/**
 * Token-efficient Gemini JSON helpers.
 * All payloads are JSON, never raw rows (§8). Max ~800 tokens per call.
 */

export type SummaryPayload = {
  mode: 'summary'
  // Aggregated context only — already minimal from CopilotPanel dashboardContext
  context: {
    rowCount: number
    filteredCount: number
    columns: { name: string; type: string; distinctCount: number }[]
    metrics: unknown
    topProducts: unknown
    salesByCity: unknown
    salesByCategory: unknown
    trends: unknown
    currentFilters: unknown
    autoCharts: unknown
  }
}

export type ExtractPayload = {
  mode: 'extract'
  filename: string
  text: string // truncated to 6000 chars before call
  hint: 'pdf' | 'docx'
}

export async function callGeminiJson(body: SummaryPayload | ExtractPayload): Promise<{ text?: string; rows?: unknown; error?: string }> {
  const res = await fetch('/api/gemini', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((json as { error?: string }).error ?? `Gemini error ${res.status}`)
  return json as { text?: string; rows?: unknown }
}

export function buildSummaryContext(raw: {
  rowCount: number; filteredCount: number; columns: { name: string; type: string; distinctCount: number }[]
  metrics: unknown; topProducts: unknown; salesByCity: unknown; salesByCategory: unknown; trends: unknown; currentFilters: unknown; autoCharts: unknown
}): SummaryPayload['context'] {
  // Strip to essentials — no sampleValues, no nullCounts, no raw rows
  return {
    rowCount: raw.rowCount,
    filteredCount: raw.filteredCount,
    columns: raw.columns.map((c) => ({ name: c.name, type: c.type, distinctCount: c.distinctCount })),
    metrics: raw.metrics,
    topProducts: Array.isArray(raw.topProducts) ? (raw.topProducts as unknown[]).slice(0, 3) : raw.topProducts,
    salesByCity: Array.isArray(raw.salesByCity) ? (raw.salesByCity as unknown[]).slice(0, 3) : raw.salesByCity,
    salesByCategory: Array.isArray(raw.salesByCategory) ? (raw.salesByCategory as unknown[]).slice(0, 3) : raw.salesByCategory,
    trends: Array.isArray(raw.trends) ? (raw.trends as unknown[]).slice(0, 4) : raw.trends,
    currentFilters: raw.currentFilters,
    autoCharts: raw.autoCharts,
  }
}
