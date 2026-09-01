import { useCallback, useEffect, useRef, useState } from 'react'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, AreaChart, Area, PieChart, Pie, Cell, ScatterChart, Scatter, ZAxis } from 'recharts'
import './App.css'
import { parseCSV } from './data/parser'
import { parseAnyFile, validateAnyFile } from './data/universalParser'
import { DashboardProvider, useDashboard } from './state/DashboardContext'
import { ChartCard } from './components/dashboard/ChartCard'
import { FilterBar } from './components/dashboard/FilterBar'
import { ExportBar } from './components/dashboard/ExportBar'
import { DataTable } from './components/data/DataTable'
import { DataProfiler } from './components/data/DataProfiler'
import { Mascota } from './components/ui/Mascota'
import { ExcelChat } from './components/excel/ExcelChat'
import { RobotEcosystemControls } from './components/dashboard/RobotEcosystemControls'
import { speak } from './lib/tts'
import { saveDataset } from './lib/storage'
import type { MascotaMood } from './types/mascota'
import { ROBOT_UNITS } from './types/mascota'

const CHART_COLORS = ['#ff6b00', '#10b981', '#2563eb', '#8b5cf6', '#f59e0b', '#f43f5e', '#6366f1', '#64748b']

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
          <Area type="monotone" dataKey="value" stroke="#10b981" fill="#a7f3d0" strokeWidth={2} />
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
          <Line type="monotone" dataKey="value" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} />
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
        <Bar dataKey="value" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

function MainDashboard() {
  const {
    rawRows, fileInfo, autoCharts,
    setDataset, error, setError, setLoading, generateSummary, filteredRows,
    activeRobot,
  } = useDashboard()

  const [dragging, setDragging] = useState(false)
  const [dataOpen, setDataOpen] = useState(false)
  const [mascotaMood, setMascotaMood] = useState<MascotaMood>('neutro')
  const inputRef = useRef<HTMLInputElement>(null)

  const hasData = Boolean(rawRows && rawRows.length > 0)
  const activeMeta = ROBOT_UNITS[activeRobot] || ROBOT_UNITS.helix

  const handleRows = useCallback((data: typeof filteredRows, name: string, size: number) => {
    setDataset(data, { name, size, rows: data.length, columns: Object.keys(data[0] ?? {}).length })
    saveDataset({ id: `ds_${Date.now()}`, name, rowCount: data.length, columnCount: Object.keys(data[0] ?? {}).length, createdAt: new Date().toISOString() })
    setMascotaMood('feliz')
    speak(`Dataset ${name} cargado con ${data.length} registros. Unidad activa: ${activeMeta.name}.`)
  }, [setDataset, activeMeta.name])

  const parseFile = useCallback(async (file: File) => {
    const valid = validateAnyFile(file)
    if (!valid.valid) { setError(valid.error ?? 'Tipo de archivo no soportado'); return }
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
      const rows = result.rows
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
      {/* Floating Minimal Controls Bar */}
      <div className="canvas-top-bar" role="navigation" aria-label="Controles rápidos">
        <div className="canvas-brand" aria-label="Copixi AI">
          <span className="brand-mark" aria-hidden>◈</span>
          <span className="brand-title">Copixi</span>
          <span className="brand-badge">Ecosistema Bio-Robótico de Datos</span>
        </div>

        <div className="canvas-actions">
          {hasData && (
            <div className="dataset-pill" title={fileInfo?.name ?? 'Dataset cargado'}>
              <i className="pixelart-icons-font-file" aria-hidden />
              <span>{fileInfo?.name ?? 'Archivo'} ({fileInfo?.rows ?? 0} filas)</span>
            </div>
          )}
          <button
            type="button"
            className="btn btn-secondary small"
            onClick={() => inputRef.current?.click()}
          >
            📂 Cargar Dataset
          </button>
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
          className={`hero-excel ${dragging ? 'dropping' : ''}`}
          aria-label="Escenario interactivo del Robot Analista"
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
        >
          {/* Top Stage: Animated Robot Mascot con Visor y Hábitat Activo */}
          <div className="mascot-stage">
            <Mascota
              variant={activeRobot}
              mood={mascotaMood}
              size={180}
              onClick={() => speak(hasData ? `Unidad ${activeMeta.name} lista. ${activeMeta.tagline}` : `¡Hola! Soy ${activeMeta.name}. ${activeMeta.tagline} Carga tu dataset para comenzar.`)}
            />
          </div>

          {/* Selector de Modos (Pipeline Asistido vs Especialista) & Diagnóstico Helix */}
          <RobotEcosystemControls />

          {/* Interactive Speech Bubble & Excel Chat & MiniCharts */}
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
                <span>Explorador y Dashboard Recharts</span>
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
                      >
                        <ChartRenderer config={c.config} data={c.data} height={260} />
                      </ChartCard>
                    ))
                  )}
                </div>
                <DataProfiler />
                <DataTable />
                <ExportBar />
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  )
}

export function App() {
  return (
    <DashboardProvider>
      <MainDashboard />
    </DashboardProvider>
  )
}

export default App
