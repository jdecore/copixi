/** Shareable URL — frontend-only, no backend, no raw rows (§8) */
import type { Filter, ChartConfig } from '../data/types'

function encodeFilters(filters: Filter[]): string {
  try { return encodeURIComponent(btoa(JSON.stringify(filters))) } catch { return '' }
}
function decodeFilters(raw: string): Filter[] | null {
  try { return JSON.parse(atob(decodeURIComponent(raw))) as Filter[] } catch { return null }
}
function encodeChart(c: ChartConfig | null): string {
  if (!c) return ''
  try { return encodeURIComponent(btoa(JSON.stringify(c))) } catch { return '' }
}
function decodeChart(raw: string): ChartConfig | null {
  if (!raw) return null
  try { return JSON.parse(atob(decodeURIComponent(raw))) as ChartConfig } catch { return null }
}

export function buildShareUrl(filters: Filter[], chart: ChartConfig | null): string {
  const url = new URL(window.location.href)
  if (filters.length) url.searchParams.set('f', encodeFilters(filters))
  else url.searchParams.delete('f')
  if (chart) url.searchParams.set('c', encodeChart(chart))
  else url.searchParams.delete('c')
  return url.toString()
}

export function parseShareUrl(): { filters: Filter[] | null; chart: ChartConfig | null } {
  const p = new URLSearchParams(window.location.search)
  const f = p.get('f')
  const c = p.get('c')
  return { filters: f ? decodeFilters(f) : null, chart: c ? decodeChart(c) : null }
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const ta = document.createElement('textarea')
    ta.value = text; document.body.appendChild(ta); ta.select()
    try { document.execCommand('copy'); return true } catch { return false }
    finally { ta.remove() }
  }
}
