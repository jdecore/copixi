import { useMemo, useState } from 'react'
import { useDashboard } from '../../state/DashboardContext'

export function CompareTable() {
  const { filteredRows, columns } = useDashboard()
  const stringCols = useMemo(() => columns.filter((c) => c.type === 'string').map((c) => c.name), [columns])
  const [col, setCol] = useState(stringCols[0] ?? 'city')
  const [selected, setSelected] = useState<string[]>([])

  // sync col when stringCols changes
  const distinct = useMemo(() => {
    const vals = [...new Set(filteredRows.map((r) => String(r[col] ?? '')))].filter(Boolean).sort().slice(0, 20)
    return vals
  }, [filteredRows, col])

  const comparison = useMemo(() => {
    if (!selected.length) return []
    return selected.map((v) => {
      const rows = filteredRows.filter((r) => String(r[col]) === v)
      const sum = rows.reduce((a, r) => a + (Number(r['sales']) || 0), 0)
      const units = rows.reduce((a, r) => a + (Number(r['units']) || 0), 0)
      const customers = rows.reduce((a, r) => a + (Number(r['customers']) || 0), 0)
      return { value: v, count: rows.length, sum, units, customers }
    })
  }, [filteredRows, col, selected])

  const toggle = (v: string) => {
    setSelected((prev) => prev.includes(v) ? prev.filter((x) => x !== v) : prev.length >= 5 ? prev : [...prev, v])
  }

  return (
    <div className="card">
      <div className="card-head">
        <h3><i className="pixelart-icons-font-ranking" aria-hidden /> Advanced comparison</h3>
        <span className="filter-count">{selected.length}/5 selected</span>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <select value={col} onChange={(e) => { setCol(e.target.value); setSelected([]) }} className="filter-input" style={{ minWidth: 140 }}>
          {stringCols.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <span style={{ fontSize: 12, color: 'var(--color-muted)', alignSelf: 'center' }}>Pick 2–5 values</span>
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        {distinct.map((d) => (
          <button key={d} type="button" onClick={() => toggle(d)} className={`btn small ${selected.includes(d) ? 'btn-primary' : 'btn-secondary'}`} style={{ padding: '4px 10px' }}>{d}</button>
        ))}
      </div>
      {comparison.length >= 2 ? (
        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead><tr><th>{col}</th><th>Rows</th><th>Sales ($)</th><th>Units</th><th>Customers</th></tr></thead>
            <tbody>
              {comparison.map((c) => <tr key={c.value}><td><strong>{c.value}</strong></td><td>{c.count}</td><td>${c.sum.toLocaleString()}</td><td>{c.units.toLocaleString()}</td><td>{c.customers.toLocaleString()}</td></tr>)}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty small">Select at least 2 values to compare — sums computed locally (no LLM §7).</div>
      )}
    </div>
  )
}
