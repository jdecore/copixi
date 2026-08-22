import { useEffect, useState } from 'react'
import { getSavedDatasets, type SavedDataset, getHistory } from '../../lib/storage'
import { useDashboard } from '../../state/DashboardContext'

export function DatasetSwitcher() {
  const { fileInfo } = useDashboard()
  const [datasets, setDatasets] = useState<SavedDataset[]>([])
  const [history, setHistory] = useState<string[]>([])

  const refresh = () => {
    setDatasets(getSavedDatasets())
    setHistory(getHistory())
  }
  useEffect(() => { refresh() }, [fileInfo])

  if (!datasets.length && !history.length) return null

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="card-head">
        <h3><i className="pixelart-icons-font-archive" aria-hidden /> Recent datasets (P2 — multiple)</h3>
        <span className="filter-count">{datasets.length} saved</span>
      </div>
      {datasets.length ? (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 8 }}>
          {datasets.slice(0, 5).map((d) => (
            <li key={d.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '8px 10px', border: '1px solid var(--color-border)', borderRadius: 8, background: 'var(--color-surface)', fontSize: 13 }}>
              <span><strong>{d.name}</strong> · {d.rowCount} rows · {d.columnCount} cols</span>
              <span style={{ color: 'var(--color-muted)', fontSize: 11 }}>{new Date(d.createdAt).toLocaleDateString()}</span>
            </li>
          ))}
        </ul>
      ) : <div className="empty small">No datasets saved yet — upload a CSV to create history.</div>}
      <p style={{ fontSize: 11, color: 'var(--color-muted)', margin: '8px 0 0' }}>Multiple datasets are metadata-only (§8 privacy) — raw rows stay in memory. Future: tabs to compare datasets side-by-side without losing state.</p>
    </div>
  )
}
