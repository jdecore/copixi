import { useState, useEffect } from 'react'
import { useDashboard } from '../../state/DashboardContext'
import { buildShareUrl, copyToClipboard, parseShareUrl } from '../../lib/share'

export function ShareBar() {
  const { filters, activeChart, rawRows, addFilter, clearFilters, setActiveChart } = useDashboard()
  const [copied, setCopied] = useState(false)
  const [restored, setRestored] = useState(false)

  // Restore from URL on mount (if dataset already loaded, apply; else wait)
  useEffect(() => {
    if (!rawRows || restored) return
    const { filters: f, chart } = parseShareUrl()
    if (f && f.length) {
      // validate via addFilter sequentially after clear
      // delay to allow DashboardContext ready
      setTimeout(() => {
        clearFilters()
        setTimeout(() => { for (const fl of f) addFilter(fl) }, 30)
      }, 30)
    }
    if (chart) setActiveChart(chart)
    setRestored(true)
  }, [rawRows, restored, addFilter, clearFilters, setActiveChart])

  // Sync URL when filters/chart change (replaceState, no reload)
  useEffect(() => {
    if (!rawRows) return
    const url = buildShareUrl(filters, activeChart)
    window.history.replaceState(null, '', url)
  }, [filters, activeChart, rawRows])

  const handleCopy = async () => {
    const url = buildShareUrl(filters, activeChart)
    const ok = await copyToClipboard(url)
    if (ok) { setCopied(true); setTimeout(() => setCopied(false), 2000) }
  }

  const shareText = filters.length || activeChart ? `${filters.length} filter(s)${activeChart ? ` + chart ${activeChart.chartType}` : ''}` : 'no filters'

  return (
    <div className="filter-bar" style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }} aria-label="Share">
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <h3 style={{ margin: 0, fontSize: 13, fontWeight: 650, display: 'flex', gap: 8, alignItems: 'center' }}><i className="pixelart-icons-font-share" aria-hidden /> Share</h3>
        <span className="filter-count">{shareText}</span>
        <span style={{ fontSize: 11, color: 'var(--color-muted)' }}>Link encodes only filters/chart (§8 — no rows)</span>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-secondary small" onClick={handleCopy} type="button" disabled={!rawRows}>
          <i className="pixelart-icons-font-link" aria-hidden /> {copied ? 'Copied!' : 'Copy link'}
        </button>
        <button className="btn btn-secondary small" onClick={() => { navigator.share?.({ title: 'compexi analysis', url: buildShareUrl(filters, activeChart) }).catch(() => {}) }} type="button" disabled={!rawRows} style={{ display: ('share' in navigator) ? 'inline-flex' : 'none' }}>Share</button>
      </div>
    </div>
  )
}
