import { useEffect, useState } from 'react'
import { useDashboard } from '../../state/DashboardContext'
import { detectAnomaliesZScore, detectAnomaliesIQR } from '../../data/anomalyDetection'
import { getPreferences, savePreferences, appendHistory } from '../../lib/storage'

export function AnomalyPanel() {
  const { filteredRows } = useDashboard()
  const [threshold, setThreshold] = useState(2.5)
  const [method, setMethod] = useState<'zscore' | 'iqr'>('zscore')

  useEffect(() => {
    const p = getPreferences()
    setThreshold(p.anomalyThreshold); setMethod(p.anomalyMethod)
  }, [])

  const anomalies = method === 'zscore'
    ? detectAnomaliesZScore(filteredRows, 'sales', threshold).slice(0, 8)
    : detectAnomaliesIQR(filteredRows, 'sales').slice(0, 8)

  const handleChange = (t: number, m: 'zscore' | 'iqr') => {
    setThreshold(t); setMethod(m)
    savePreferences({ anomalyThreshold: t, anomalyMethod: m })
    appendHistory(`Anomaly settings: ${m} threshold ${t}`)
  }

  return (
    <div className="card">
      <div className="card-head">
        <h3><i className="pixelart-icons-font-alert" aria-hidden /> Advanced anomaly detection</h3>
        <span className="filter-count">{anomalies.length} detected</span>
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
        <label style={{ fontSize: 13, display: 'flex', gap: 8, alignItems: 'center' }}>
          Method
          <select value={method} onChange={(e) => handleChange(threshold, e.target.value as 'zscore' | 'iqr')} className="filter-input" style={{ minWidth: 110, padding: '6px 8px' }}>
            <option value="zscore">Z-Score</option>
            <option value="iqr">IQR (1.5×)</option>
          </select>
        </label>
        {method === 'zscore' && (
          <label style={{ fontSize: 13, display: 'flex', gap: 8, alignItems: 'center' }}>
            Threshold
            <input type="range" min={1.5} max={4} step={0.1} value={threshold} onChange={(e) => handleChange(Number(e.target.value), method)} />
            <span className="badge">{threshold.toFixed(1)}</span>
          </label>
        )}
      </div>
      {method === 'iqr' && <p style={{ fontSize: 11, color: 'var(--color-muted)', margin: '0 0 10px' }}>IQR: outliers outside Q1−1.5·IQR / Q3+1.5·IQR — no threshold needed.</p>}
      {anomalies.length ? (
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: 'var(--color-muted)', lineHeight: 1.7 }}>
          {anomalies.map((a, i) => <li key={i}><strong>{a.type === 'high' ? 'Peak' : 'Drop'}</strong>: {String(a.row['date'] ?? `#${a.index}`)} — {a.column}={a.value.toLocaleString()} (z={a.zScore.toFixed(2)}) — {String(a.row['city'] ?? '')} {String(a.row['product'] ?? '')}</li>)}
        </ul>
      ) : (
        <div className="empty small">No anomalies with current settings — try lowering threshold or switching to IQR.</div>
      )}
    </div>
  )
}
