import { useMemo } from 'react'
import { useDashboard } from '../../state/DashboardContext'

export function InsightCard() {
  const { filteredRows, byCity, byCategory, byProduct, metrics, anomalies } = useDashboard()

  const insights = useMemo(() => {
    if (!filteredRows.length || !metrics) return []
    const out: { title: string; detail: string; icon: string }[] = []
    if (byCity[0]) out.push({ title: 'Top city', detail: `${byCity[0].name} leads with $${byCity[0].value.toLocaleString()} sales`, icon: 'pixelart-icons-font-pin' })
    if (byCategory[0]) out.push({ title: 'Top category', detail: `${byCategory[0].name} — $${byCategory[0].value.toLocaleString()}`, icon: 'pixelart-icons-font-folder' })
    if (byProduct[0]) out.push({ title: 'Top product', detail: `${byProduct[0].name} best seller`, icon: 'pixelart-icons-font-trophy' })
    const avg = metrics.avgSales
    const topRow = filteredRows.reduce((a, b) => Number(b.sales) > Number(a.sales) ? b : a, filteredRows[0])
    if (topRow) out.push({ title: 'Highest single sale', detail: `$${Number(topRow.sales).toLocaleString()} on ${String(topRow.date)} (${String(topRow.city)}) — ${avg ? `${(Number(topRow.sales)/avg).toFixed(1)}× avg` : ''}`, icon: 'pixelart-icons-font-star' })
    if (anomalies.length) {
      const a = anomalies[0]
      out.push({ title: `Anomaly: ${a.type === 'high' ? 'Peak' : 'Drop'}`, detail: `${String(a.row['date'] ?? `#${a.index}`)} — ${a.column}=${a.value.toLocaleString()} (z=${a.zScore.toFixed(2)})`, icon: 'pixelart-icons-font-alert' })
    } else {
      out.push({ title: 'No anomalies', detail: 'No z-score > 2.5 detected in filtered data.', icon: 'pixelart-icons-font-check' })
    }
    return out.slice(0, 6)
  }, [filteredRows, byCity, byCategory, byProduct, metrics, anomalies])

  if (!filteredRows.length) return <div className="empty">No data for insights — clear filters.</div>

  return (
    <div className="insights-grid">
      {insights.map((ins, i) => (
        <div key={i} className="insight">
          <div className="insight-icon"><i className={ins.icon} aria-hidden /></div>
          <div>
            <div className="insight-title">{ins.title}</div>
            <div className="insight-detail">{ins.detail}</div>
          </div>
        </div>
      ))}
    </div>
  )
}
