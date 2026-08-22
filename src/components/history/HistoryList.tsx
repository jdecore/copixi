import { useEffect, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { getSavedAnalyses, deleteAnalysis, saveAnalysis, type SavedAnalysis, getHistory, clearHistory } from '../../lib/storage'
import { useDashboard } from '../../state/DashboardContext'

export function HistoryList() {
  const { filters, activeChart, fileInfo, metrics } = useDashboard()
  const [analyses, setAnalyses] = useState<SavedAnalysis[]>([])
  const [history, setHistory] = useState<string[]>([])
  const [saveName, setSaveName] = useState('')

  const refresh = () => {
    setAnalyses(getSavedAnalyses())
    setHistory(getHistory())
  }
  useEffect(() => { refresh() }, [])

  const handleSave = () => {
    const name = saveName.trim() || `Analysis ${new Date().toLocaleString()}`
    const id = Date.now().toString(36)
    saveAnalysis({ id, name, datasetName: fileInfo?.name ?? 'dataset', filters: [...filters], chartConfig: activeChart, createdAt: new Date().toISOString(), metricsSnapshot: metrics ? { totalSales: metrics.totalSales, avgSales: metrics.avgSales, rowCount: metrics.rowCount } : undefined })
    setSaveName('')
    refresh()
  }

  const handleRestore = (a: SavedAnalysis) => {
    const evt = new CustomEvent('copixi:restore-analysis', { detail: a })
    window.dispatchEvent(evt)
  }

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="card-head">
        <h3><i className="pixelart-icons-font-history" aria-hidden /> Saved analyses & history</h3>
        <span className="filter-count">{analyses.length} saved</span>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <input className="filter-input" placeholder="Name for current analysis…" value={saveName} onChange={(e) => setSaveName(e.target.value)} aria-label="Analysis name" style={{ flex: '1 1 200px' }} />
        <button className="btn btn-primary small" onClick={handleSave} type="button" disabled={!fileInfo}><i className="pixelart-icons-font-save" aria-hidden /> Save analysis</button>
      </div>

      {analyses.length ? (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 8 }}>
          {analyses.map((a) => (
            <li key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '8px 10px', border: '1px solid var(--color-border)', borderRadius: 8, background: 'var(--color-surface)' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{a.name}</div>
                <div style={{ fontSize: 11, color: 'var(--color-muted)' }}>{a.datasetName} · {a.filters.length} filters · {new Date(a.createdAt).toLocaleString()} {a.chartConfig ? `· chart ${a.chartConfig.chartType}` : ''}</div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <button className="btn btn-secondary small" onClick={() => handleRestore(a)} type="button">Restore</button>
                <button className="btn btn-secondary small" onClick={() => { deleteAnalysis(a.id); refresh() }} type="button" aria-label={`Delete ${a.name}`}>×</button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="empty small">No saved analyses yet — apply filters/charts then Save.</div>
      )}

      <div style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span className="kpi-label">History (local)</span>
          {history.length > 0 && <button className="btn btn-secondary small" onClick={() => { clearHistory(); refresh() }} type="button">Clear</button>}
        </div>
        {history.length ? (
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: 'var(--color-muted)', maxHeight: 140, overflowY: 'auto' }}>
            {history.map((h, i) => <li key={i}>{h}</li>)}
          </ul>
        ) : (
          <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>No history yet.</div>
        )}
      </div>

      <Dialog.Root>
        <Dialog.Trigger asChild><button className="btn btn-secondary small" type="button" style={{ marginTop: 12 }}><i className="pixelart-icons-font-info" aria-hidden /> About saving (privacy)</button></Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Overlay style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)' }} />
          <Dialog.Content aria-describedby={undefined} style={{ position: 'fixed', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', background: 'white', borderRadius: 12, padding: 24, maxWidth: 480, width: '90vw', border: '1px solid var(--color-border)' }}>
            <Dialog.Title style={{ margin: 0, fontWeight: 700 }}>Saving — privacy first</Dialog.Title>
            <Dialog.Description style={{ color: 'var(--color-muted)', fontSize: 13, marginTop: 8 }}>
              Saved analyses store only filters, chart config and aggregated metrics — never raw rows (§8). Stored in localStorage; future InsForge sync will be opt-in. Anonymous → Analyze → Optional save (§31).
            </Dialog.Description>
            <Dialog.Close asChild><button className="btn btn-primary" style={{ marginTop: 16 }} type="button">Got it</button></Dialog.Close>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}
