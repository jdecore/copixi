import { useDashboard } from '../../state/DashboardContext'

export function SummaryCard() {
  const { summary, summaryStatus, summaryError, generateSummary, rawRows } = useDashboard()
  if (!rawRows) return null

  return (
    <div className="card" style={{ marginTop: 16 }} role="region" aria-label="Resumen automático">
      <div className="card-head">
        <h3 style={{ margin: 0, display: 'flex', gap: 8, alignItems: 'center' }}>
          <i className="pixelart-icons-font-notes" aria-hidden /> Resumen automático
        </h3>
        <span className="badge" style={{ textTransform: 'none' }}>
          {summaryStatus === 'loading' ? 'Generando…' : summaryStatus === 'ready' ? 'Gemini JSON' : summaryStatus === 'error' ? 'Error' : 'Listo'}
        </span>
      </div>

      {summaryStatus === 'loading' && (
        <div style={{ display: 'grid', gap: 8 }}>
          <span className="skeleton" style={{ width: '90%', height: 14 }} />
          <span className="skeleton" style={{ width: '75%', height: 14 }} />
          <span className="skeleton" style={{ width: '60%', height: 14 }} />
        </div>
      )}

      {summaryStatus === 'error' && (
        <div role="alert" style={{ color: 'var(--color-danger)', fontSize: 13, background: '#fef2f2', border: '1px solid #fecaca', padding: '10px 12px', borderRadius: 8 }}>
          {summaryError ?? 'No se pudo generar el resumen.'}{' '}
          <button className="btn btn-secondary small" style={{ marginLeft: 8 }} onClick={() => generateSummary()} type="button">Reintentar</button>
        </div>
      )}

      {summaryStatus === 'ready' && summary && (
        <div style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--color-text)', whiteSpace: 'pre-wrap' }}>{summary}</div>
      )}

      {summaryStatus === 'idle' && (
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, color: 'var(--color-muted)' }}>Genera un resumen en 1 click — solo JSON agregado, sin filas crudas.</span>
          <button className="btn btn-secondary small" onClick={() => generateSummary()} type="button">
            <i className="pixelart-icons-font-lightbulb" aria-hidden /> Generar resumen
          </button>
        </div>
      )}
    </div>
  )
}
