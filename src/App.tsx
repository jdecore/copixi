import { useCallback, useEffect, useRef, useState } from 'react'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, AreaChart, Area, PieChart, Pie, Cell, ScatterChart, Scatter, ZAxis } from 'recharts'
import './App.css'
import { parseCSV } from './data/parser'
import { parseAnyFile, validateAnyFile } from './data/universalParser'
import { DashboardProvider, useDashboard } from './state/DashboardContext'
import { ChartCard } from './components/dashboard/ChartCard'
import { SummaryCard } from './components/dashboard/SummaryCard'
import { FilterBar } from './components/dashboard/FilterBar'
import { ExportBar } from './components/dashboard/ExportBar'
import { DataTable } from './components/data/DataTable'
import { DataProfiler } from './components/data/DataProfiler'
import { Mascota } from './components/ui/Mascota'
import { ExcelChat } from './components/excel/ExcelChat'
import { speak } from './lib/tts'
import type { SavedAnalysis } from './lib/storage'
import { saveDataset } from './lib/storage'
import type { MascotaMood } from './types/mascota'

const CHART_COLORS = ['#ff6b00', '#166534', '#0a0a0a', '#c27803', '#64748b', '#0e9f6e', '#ff8c2f', '#1f2937']

function ChartRenderer({ config, data, height = 260 }: { config: { chartType: string; x: string; y: string; title?: string }; data: { name: string; value: number }[] | { x: number; y: number }[]; height?: number }) {
  if (config.chartType === 'pie') {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie data={data as { name: string; value: number }[]} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
            {(data as { name: string; value: number }[]).map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    )
  }
  if (config.chartType === 'scatter') {
    const scatterData = data as { x: number; y: number }[]
    return (
      <ResponsiveContainer width="100%" height={height}>
        <ScatterChart>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="x" type="number" name={config.x} tick={{ fontSize: 11 }} />
          <YAxis dataKey="y" type="number" name={config.y} tick={{ fontSize: 11 }} />
          <ZAxis range={[40, 400]} />
          <Tooltip cursor={{ strokeDasharray: '3 3' }} />
          <Scatter data={scatterData} fill={CHART_COLORS[0]} shape="circle" />
        </ScatterChart>
      </ResponsiveContainer>
    )
  }
  if (config.chartType === 'area') {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data as { name: string; value: number }[]}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip />
          <Area type="monotone" dataKey="value" stroke="#ff6b00" fill="#ffb86a" strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    )
  }
  if (config.chartType === 'line') {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data as { name: string; value: number }[]}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip />
          <Line type="monotone" dataKey="value" stroke="#ff6b00" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    )
  }
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data as { name: string; value: number }[]}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip />
        <Bar dataKey="value" fill="#ff6b00" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

function DashboardContent() {
  const { rawRows, fileInfo, filteredRows, error, loading, setDataset, setError, setLoading, autoCharts, generateSummary } = useDashboard()
  const [dragging, setDragging] = useState(false)
  const [mascotaMood, setMascotaMood] = useState<MascotaMood>('neutro')
  const [dataOpen, setDataOpen] = useState(true)
  const inputRef = useRef<HTMLInputElement>(null)

  const hasData = !!rawRows

  useEffect(() => {
    const header = document.querySelector('.header')
    if (!header) return
    const onScroll = () => {
      if (window.scrollY > 8) header.classList.add('scrolled')
      else header.classList.remove('scrolled')
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<SavedAnalysis>).detail
      if (!detail) return
    }
    window.addEventListener('copixi:restore-analysis', handler as EventListener)
    return () => window.removeEventListener('copixi:restore-analysis', handler as EventListener)
  }, [])

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<MascotaMood>).detail
      if (detail) setMascotaMood(detail)
    }
    window.addEventListener('copixi:mascota-mood', handler as EventListener)
    return () => window.removeEventListener('copixi:mascota-mood', handler as EventListener)
  }, [])

  useEffect(() => {
    if (loading) setMascotaMood('duda')
    else if (error) setMascotaMood('enojado')
    else if (hasData) setMascotaMood('feliz')
    else setMascotaMood('neutro')
  }, [loading, error, hasData])

  const handleRows = useCallback((rows: ReturnType<typeof useDashboard>['filteredRows'], name: string, size: number) => {
    const r = rows as any
    const cols = Object.keys(r[0] ?? {}).length
    setDataset(r, { name, size, rows: r.length, columns: cols })
    try { saveDataset({ id: Date.now().toString(36), name, rowCount: r.length, columnCount: cols, createdAt: new Date().toISOString() }) } catch {}
  }, [setDataset])

  const parseFile = useCallback(async (file: File) => {
    const v = validateAnyFile(file, 15)
    if (!v.valid) { setError(v.error ?? 'Invalid file.'); return }
    setLoading(true); setError(null)
    try {
      const result = await parseAnyFile(file)
      if ('needsGemini' in result && result.needsGemini) {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: 'extract', text: result.text, filename: result.filename, hint: result.hint }),
        })
        const json = await res.json() as { rows?: unknown[]; error?: string; detail?: string }
        if (!res.ok) throw new Error(json.error ?? json.detail ?? `Extract failed ${res.status}`)
        const rows = (json.rows ?? []) as unknown as typeof filteredRows
        if (!rows.length) throw new Error('No se pudo extraer tabla del documento. Prueba con Excel o CSV.')
        handleRows(rows as unknown as typeof filteredRows, file.name, file.size)
        setTimeout(() => generateSummary(), 300)
        return
      }
      const rows = (result as { rows: unknown[] }).rows
      if (!rows?.length) { setError('File is empty or has no valid rows. Try another file or use demo data.'); return }
      handleRows(rows as unknown as typeof filteredRows, file.name, file.size)
      setTimeout(() => generateSummary(), 300)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse file')
    } finally {
      setLoading(false)
    }
  }, [handleRows, setError, setLoading, generateSummary])

  const handleDemo = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await fetch('/demo.csv')
      if (!res.ok) throw new Error(`Failed to load demo.csv: ${res.status}`)
      const text = await res.text()
      const { rows: data, errors } = await parseCSV(text)
      if (errors.length) console.warn('[Copixi] demo parse errors', errors)
      handleRows(data as unknown as typeof filteredRows, 'demo.csv', new Blob([text]).size)
      setTimeout(() => generateSummary(), 300)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load demo data')
    } finally { setLoading(false) }
  }, [handleRows, setError, setLoading, generateSummary])

  useEffect(() => {
    const handler = () => handleDemo()
    window.addEventListener('copixi:try-demo', handler)
    return () => window.removeEventListener('copixi:try-demo', handler)
  }, [handleDemo])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) parseFile(file)
  }, [parseFile])

  return (
    <div className="canvas-wrapper">
      {/* Floating Minimal Controls Bar (Sin botón de subir archivo) */}
      <div className="canvas-top-bar" role="navigation" aria-label="Controles rápidos">
        <div className="canvas-brand" aria-label="compexi AI">
          <span className="brand-mark" aria-hidden>◈</span>
          <span className="brand-title">compexi</span>
          <span className="brand-badge">Data & Excel Copilot</span>
        </div>

        <div className="canvas-actions">
          {hasData && (
            <div className="dataset-pill" title={fileInfo?.name ?? 'Dataset cargado'}>
              <i className="pixelart-icons-font-file" aria-hidden />
              <span>{fileInfo?.name ?? 'Archivo'} ({fileInfo?.rows ?? 0} filas)</span>
            </div>
          )}
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls,.csv,.tsv,text/csv,text/tab-separated-values,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
            hidden
            onChange={(e) => { const f = e.target.files?.[0]; if (f) parseFile(f) }}
          />
        </div>
      </div>

      <main className="main-canvas" id="main-content">
        <section
          className={`hero-copilot ${dragging ? 'dropping' : ''}`}
          aria-label="Escenario interactivo de compe"
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
        >
          {/* Top Stage: Animated Mascot */}
          <div className="mascot-stage">
            <Mascota
              mood={mascotaMood}
              size={180}
              onClick={() => speak(hasData ? `Hola, tu archivo ${fileInfo?.name} está listo con ${fileInfo?.rows} filas. ¿Qué cálculo o gráfica deseas realizar?` : '¡Hola! Soy compe, tu robot analista. Arrastra tu archivo Excel o CSV para comenzar.')}
            />
          </div>

          {/* Interactive Speech Bubble & Copilot Chat & MiniCharts */}
          <ExcelChat onOpenFilePicker={() => inputRef.current?.click()} />

          {error && (
            <div role="alert" className="hero-error">
              <i className="pixelart-icons-font-alert" aria-hidden />
              <span>{error}</span>
            </div>
          )}
        </section>

        {/* Optional Expandable Deep Analysis / Table / Recharts Dashboard */}
        {hasData && (
          <section className="data-layer" aria-label="Dashboard detallado de datos">
            <div className="data-layer-head">
              <h3>
                <i className="pixelart-icons-font-chart" aria-hidden />
                <span>Explorador completo del Excel</span>
              </h3>
              <button
                className="btn btn-secondary small"
                type="button"
                onClick={() => setDataOpen((o) => !o)}
                aria-expanded={dataOpen}
              >
                {dataOpen ? (
                  <><i className="pixelart-icons-font-chevron-up" aria-hidden /> Ocultar tabla y gráficos</>
                ) : (
                  <><i className="pixelart-icons-font-chevron-down" aria-hidden /> Ver tabla y gráficos completos ({autoCharts.length})</>
                )}
              </button>
            </div>
            {dataOpen && (
              <div className="data-layer-body">
                <FilterBar />
                <div className="charts-full">
                  {autoCharts.length === 0 ? (
                    <div className="empty">No se detectaron columnas numéricas para gráficos adicionales.</div>
                  ) : (
                    autoCharts.map((c) => (
                      <ChartCard
                        key={`${c.config.chartType}|${c.config.x}|${c.config.y}`}
                        title={c.config.title ?? `${c.config.y} por ${c.config.x}`}
                        icon="pixelart-icons-font-chart"
                        empty={c.data.length ? null : 'Sin datos disponibles para esta gráfica.'}
                      >
                        <ChartRenderer config={c.config} data={c.data as any} />
                      </ChartCard>
                    ))
                  )}
                </div>
                <SummaryCard />
                <DataTable />
                <DataProfiler />
                <ExportBar />
              </div>
            )}
          </section>
        )}
      </main>

      <footer className="canvas-footer" role="contentinfo">
        <span>compexi · Copilot de Excel con IA · Tus datos se procesan localmente en tu navegador</span>
      </footer>
    </div>
  )
}

export default function App() {
  return (
    <DashboardProvider>
      <DashboardContent />
    </DashboardProvider>
  )
}
