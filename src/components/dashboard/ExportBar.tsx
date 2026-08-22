import { useRef } from 'react'
import { useDashboard } from '../../state/DashboardContext'
import { exportRowsCSV, exportChartPNG, exportRowsJSON } from '../../data/export'
import { generateMarkdownReport, downloadText } from '../../data/report'

export function ExportBar({ chartRef }: { chartRef?: React.RefObject<HTMLDivElement | null> }) {
  const { filteredRows, fileInfo, metrics, byCity, byCategory, byProduct, timeSeries, filters } = useDashboard()
  const localRef = useRef<HTMLDivElement>(null)

  const handleCSV = () => {
    if (!filteredRows.length) return
    exportRowsCSV(filteredRows, `copixi-${fileInfo?.name ?? 'export'}-${Date.now()}.csv`)
  }
  const handleJSON = () => {
    if (!filteredRows.length) return
    exportRowsJSON(filteredRows, `copixi-${Date.now()}.json`)
  }
  const handlePNG = async () => {
    const el = (chartRef?.current ?? localRef.current?.closest('.main') ?? document.body) as HTMLElement
    // try to find first chart card
    const target = document.querySelector('.card') as HTMLElement ?? el
    await exportChartPNG(target, `copixi-chart-${Date.now()}.png`)
  }
  const handleReport = () => {
    const md = generateMarkdownReport({
      fileName: fileInfo?.name ?? 'dataset',
      rowCount: filteredRows.length,
      filteredCount: filteredRows.length,
      metrics,
      filteredRows,
      byCity, byCategory, byProduct, timeSeries,
      filters: filters as never,
    })
    downloadText(`copixi-report-${Date.now()}.md`, md, 'text/markdown')
  }
  const handlePrint = () => window.print()

  return (
    <div className="filter-bar" ref={localRef} aria-label="Export bar">
      <div className="filter-bar-title">
        <h3><i className="pixelart-icons-font-download" aria-hidden /> Export & report</h3>
        <span className="filter-count">{filteredRows.length} rows (filtered)</span>
      </div>
      <div className="filter-controls">
        <button className="btn btn-secondary small" onClick={handleCSV} disabled={!filteredRows.length} type="button"><i className="pixelart-icons-font-file" aria-hidden /> Export CSV</button>
        <button className="btn btn-secondary small" onClick={handleJSON} disabled={!filteredRows.length} type="button"><i className="pixelart-icons-font-code" aria-hidden /> Export JSON</button>
        <button className="btn btn-secondary small" onClick={handlePNG} type="button"><i className="pixelart-icons-font-image" aria-hidden /> Export PNG</button>
        <button className="btn btn-primary small" onClick={handleReport} disabled={!metrics} type="button"><i className="pixelart-icons-font-notes" aria-hidden /> Download report (.md)</button>
        <button className="btn btn-secondary small" onClick={handlePrint} type="button"><i className="pixelart-icons-font-print" aria-hidden /> Print / Save PDF</button>
      </div>
      <p style={{ fontSize: 11, color: 'var(--color-muted)', margin: '8px 0 0' }}>All exports run locally (Blob) — no server (§6, §8). PNG captures first chart SVG; CSV is filtered data.</p>
    </div>
  )
}
