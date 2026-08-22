/** Analytics local — frontend-only, privacy-first (§8), no backend, no cookies */
const KEY = 'copixi:analytics'
export type AnalyticsEvent = { ts: string; event: string; detail?: string }

function safeParse(raw: string | null): AnalyticsEvent[] {
  if (!raw) return []
  try { return JSON.parse(raw) as AnalyticsEvent[] } catch { return [] }
}

export function track(event: string, detail?: string): void {
  if (typeof localStorage === 'undefined') return
  const list = safeParse(localStorage.getItem(KEY))
  list.unshift({ ts: new Date().toISOString(), event, detail })
  if (list.length > 100) list.pop()
  localStorage.setItem(KEY, JSON.stringify(list))
  if (import.meta.env.DEV) console.log('[Copixi analytics]', event, detail ?? '')
}

export function getAnalytics(): AnalyticsEvent[] {
  if (typeof localStorage === 'undefined') return []
  return safeParse(localStorage.getItem(KEY))
}

export function clearAnalytics(): void {
  localStorage.removeItem(KEY)
}
