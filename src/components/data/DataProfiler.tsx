import { useDashboard } from '../../state/DashboardContext'

export function DataProfiler() {
  const { profile, filteredRows } = useDashboard()
  if (!profile) return null
  const shown = filteredRows.length !== profile.rowCount ? `Filtered: ${filteredRows.length} rows` : `${profile.rowCount} rows`
  return (
    <div className="card" style={{ marginTop: 16 }}>
      <h3><i className="pixelart-icons-font-table" aria-hidden /> Dataset profile — {shown}, {profile.columns.length} columns</h3>
      <div style={{ overflowX: 'auto' }}>
        <table className="table">
          <thead><tr><th>Column</th><th>Type</th><th>Distinct</th><th>Nulls</th><th>Min</th><th>Max</th><th>Sample</th></tr></thead>
          <tbody>
            {profile.columns.map((c) => (
              <tr key={c.name}><td>{c.name}</td><td><span className="badge">{c.type}</span></td><td>{c.distinctCount}</td><td>{c.nullCount}</td><td>{String(c.min ?? '—')}</td><td>{String(c.max ?? '—')}</td><td>{c.sampleValues.join(', ')}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
