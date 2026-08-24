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
    <>
      <a href="#main-content" className="skip-link">Skip to content</a>
      <header className="header">
        <div className="header-inner">
          <div className="brand" aria-label="compexi home">
            <span className="brand-mark" aria-hidden>◈</span>
            <span>compexi</span>
            <span className="brand-badge">Excel Expert</span>
          </div>
          <nav className="nav" aria-label="Main navigation" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <button className="btn btn-secondary small" onClick={() => inputRef.current?.click()} type="button">
              <i className="pixelart-icons-font-upload" aria-hidden /> {hasData ? 'New dataset' : 'Upload'}
            </button>
          </nav>
        </div>
      </header>

      <main className="main" id="main-content">
        <section
          className={`hero-excel ${dragging ? 'dropping' : ''}`}
          aria-labelledby="excel-headline"
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
        >
          <Mascota
            mood={mascotaMood}
            subtitulo={
              loading ? 'Procesando datos…' :
              error ? 'Ups, algo falló' :
              hasData ? `${fileInfo?.rows ?? 0} filas · ${fileInfo?.columns ?? 0} columnas` :
              'Soy compe, tu analista IA.'
            }
            size={200}
          />
              <h2 id="excel-headline" className="sr-only">Chat con compe</h2>

          {!hasData && !loading && (
            <div className="hero-upload">
              <button className="btn btn-primary" onClick={() => inputRef.current?.click()} type="button">
                <i className="pixelart-icons-font-upload" aria-hidden /> Subir CSV / Excel
              </button>
              <span className="hero-upload-hint">o arrastra un archivo aquí · también PDF / DOCX</span>
              <input ref={inputRef} type="file" accept=".csv,.tsv,.xlsx,.xls,.pdf,.docx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) parseFile(f) }} />
            </div>
          )}

          <ExcelChat />

          {error && (
            <div role="alert" className="hero-error">{error}</div>
          )}
        </section>

        {hasData && (
          <section className="data-layer" aria-label="Análisis de datos">
            <div className="data-layer-head">
              <h3><i className="pixelart-icons-font-chart" aria-hidden /> Análisis del dataset</h3>
              <button className="btn btn-secondary small" type="button" onClick={() => setDataOpen((o) => !o)} aria-expanded={dataOpen}>
                {dataOpen ? <><i className="pixelart-icons-font-chevron-up" aria-hidden /> Ocultar</> : <><i className="pixelart-icons-font-chevron-down" aria-hidden /> Ver análisis</>}
              </button>
            </div>
            {dataOpen && (
              <div className="data-layer-body">
                <FilterBar />
                <div className="charts-full">
                  {autoCharts.length === 0 ? (
                    <div className="empty">No chartable columns detected. Ensure your file has at least one numeric or categorical column.</div>
                  ) : (
                    autoCharts.map((c) => (
                      <ChartCard key={`${c.config.chartType}|${c.config.x}|${c.config.y}`} title={c.config.title ?? `${c.config.y} by ${c.config.x}`} icon="pixelart-icons-font-chart" empty={c.data.length ? null : 'No data for this chart.'}>
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

      <footer className="footer" role="contentinfo">compexi — AI Data Analyst · Tus datos se quedan en tu navegador · React + Papa Parse + Recharts + Gemini vía Vercel Function · <a href="https://github.com/anomalyco/opencode" style={{ color: 'inherit', textDecoration: 'underline' }}>Feedback</a></footer>
    </>
  )
}

export default function App() {
  return (
    <DashboardProvider>
      <DashboardContent />
    </DashboardProvider>
  )
}
