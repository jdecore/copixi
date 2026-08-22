import { useCallback, useEffect, useRef, useState } from 'react'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, AreaChart, Area, PieChart, Pie, Cell } from 'recharts'
import { toBarData } from './data/chartAdapter'
import * as Dialog from '@radix-ui/react-dialog'
import * as Tabs from '@radix-ui/react-tabs'
import './App.css'
import { parseCSV, validateFile } from './data/parser'
import { DashboardProvider, useDashboard } from './state/DashboardContext'
import { FilterBar } from './components/dashboard/FilterBar'
import { KPIGrid } from './components/dashboard/KPIGrid'
import { ChartCard } from './components/dashboard/ChartCard'
import { InsightCard } from './components/dashboard/InsightCard'
import { DataTable } from './components/data/DataTable'
import { DataProfiler } from './components/data/DataProfiler'
import { ExportBar } from './components/dashboard/ExportBar'
import { AnomalyPanel } from './components/dashboard/AnomalyPanel'
import { CompareTable } from './components/dashboard/CompareTable'
import { HistoryList } from './components/history/HistoryList'
import { DatasetSwitcher } from './components/history/DatasetSwitcher'
import { HireBanner } from './components/ui/HireBanner'
import { ShareBar } from './components/dashboard/ShareBar'
import { TrustBar } from './components/ui/TrustBar'
import { CommandPalette } from './components/ui/CommandPalette'
import { lazy, Suspense } from 'react'
import { ErrorBoundary } from './components/ui/ErrorBoundary'
import type { SavedAnalysis } from './lib/storage'
import { saveDataset } from './lib/storage'

const CopilotPanel = lazy(() => import('./components/copilot/CopilotPanel').then((m) => ({ default: m.CopilotPanel })))

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function ActiveChartRenderer({ config, rows }: { config: { chartType: string; x: string; y: string }; rows: ReturnType<typeof useDashboard>['filteredRows'] }) {
  const data = toBarData(rows, config.x, config.y).slice(0, 8)
  const colors = ['#0f62fe', '#0e9f6e', '#c27803', '#e02424', '#64748b']
  if (config.chartType === 'pie') {
    return (
      <ResponsiveContainer width="100%" height={260}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
            {data.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    )
  }
  if (config.chartType === 'area') {
    return (
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip />
          <Area type="monotone" dataKey="value" stroke="#0f172a" fill="#e2e8f0" strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    )
  }
  if (config.chartType === 'line') {
    return (
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip />
          <Line type="monotone" dataKey="value" stroke="#0f62fe" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    )
  }
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip />
        <Bar dataKey="value" fill="#0f62fe" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

function DashboardContent() {
  const { rawRows, fileInfo, filteredRows, timeSeries, byCity, byCategory, byProduct, activeChart, setActiveChart, error, loading, setDataset, setError, setLoading, clearFilters, addFilter } = useDashboard()
  const [dragging, setDragging] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<SavedAnalysis>).detail
      if (!detail) return
      clearFilters()
      // defer to allow clear to propagate
      setTimeout(() => {
        for (const f of detail.filters) addFilter(f as never)
        if (detail.chartConfig) setActiveChart(detail.chartConfig)
        else setActiveChart(null)
        setActiveTab('overview')
      }, 50)
    }
    window.addEventListener('copixi:restore-analysis', handler as EventListener)
    return () => window.removeEventListener('copixi:restore-analysis', handler as EventListener)
  }, [addFilter, clearFilters, setActiveChart])

  const handleRows = useCallback((rows: ReturnType<typeof useDashboard>['filteredRows'], name: string, size: number) => {
    // raw rows passed as filteredRows type but actually raw
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = rows as any
    const cols = Object.keys(r[0] ?? {}).length
    setDataset(r, { name, size, rows: r.length, columns: cols })
    // P2 multiple datasets — save metadata only (§8)
    try { saveDataset({ id: Date.now().toString(36), name, rowCount: r.length, columnCount: cols, createdAt: new Date().toISOString() }) } catch {}
  }, [setDataset])

  const parseFile = useCallback(async (file: File) => {
    const v = validateFile(file, 15)
    if (!v.valid) { setError(v.error ?? 'Invalid file.'); return }
    setLoading(true); setError(null)
    try {
      const { rows: data, errors } = await parseCSV(file)
      if (errors.length) console.warn('[Copixi] Papa errors', errors)
      if (!data.length) { setError('CSV is empty or has no valid rows. Try another file or use demo data.'); return }
      handleRows(data as unknown as typeof filteredRows, file.name, file.size)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse CSV')
    } finally {
      setLoading(false)
    }
  }, [handleRows, setError, setLoading])

  const handleDemo = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await fetch('/demo.csv')
      if (!res.ok) throw new Error(`Failed to load demo.csv: ${res.status}`)
      const text = await res.text()
      const { rows: data, errors } = await parseCSV(text)
      if (errors.length) console.warn('[Copixi] demo parse errors', errors)
      handleRows(data as unknown as typeof filteredRows, 'demo.csv', new Blob([text]).size)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load demo data')
    } finally { setLoading(false) }
  }, [handleRows, setError, setLoading])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) parseFile(file)
  }, [parseFile])

  const hasData = !!rawRows

  return (
    <>
      <HireBanner />
      <a href="#main-content" className="skip-link">Skip to content</a>
      <header className="header">
        <div className="header-inner">
          <div className="brand" aria-label="Copixi home">
            <span className="brand-mark" aria-hidden>◈</span>
            <span>Copixi</span>
            <span style={{ fontWeight: 400, color: 'var(--color-muted)', fontSize: 12, border: '1px solid var(--color-border)', padding: '2px 6px', borderRadius: 999 }}>AI Data Analyst</span>
          </div>
          <nav className="nav" aria-label="Main navigation" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <a href="#overview">Overview</a>
            <a href="#main-content">Dashboard</a>
            <CommandPalette />
          </nav>
        </div>
      </header>

      <main className="main" id="main-content">
        <section className="landing" aria-labelledby="headline" id="overview">
          <h1 id="headline">Your AI Data Analyst</h1>
          <p className="sub">Turn raw business data into clear decisions.</p>
          <div className="cta-row">
            <button className="btn btn-primary" onClick={() => inputRef.current?.click()} type="button">
              <i className="pixelart-icons-font-upload" aria-hidden /> Analyze your data
            </button>
            <button className="btn btn-secondary" onClick={handleDemo} type="button" disabled={loading}>
              <i className="pixelart-icons-font-play" aria-hidden /> {loading ? 'Loading…' : 'Try demo data'}
            </button>
            <Dialog.Root>
              <Dialog.Trigger asChild>
                <button className="btn btn-secondary" type="button"><i className="pixelart-icons-font-info" aria-hidden /> How it works</button>
              </Dialog.Trigger>
              <Dialog.Portal>
                <Dialog.Overlay style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)' }} />
                <Dialog.Content aria-describedby={undefined} style={{ position: 'fixed', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', background: 'white', borderRadius: 12, padding: 24, maxWidth: 480, width: '90vw', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-md)' }}>
                  <Dialog.Title style={{ margin: 0, fontWeight: 700 }}>How Copixi works</Dialog.Title>
                  <Dialog.Description style={{ color: 'var(--color-muted)', fontSize: 14, marginTop: 8 }}>
                    Your data stays in your browser whenever possible (Papa Parse + local engine). The AI only receives aggregated context, never full rows.
                  </Dialog.Description>
                  <p style={{ fontSize: 13, marginTop: 12 }}>Flow: Landing → Upload/Demo → Profiling → KPIs + Charts → Filters → AI Analyst (validated actions).</p>
                  <Dialog.Close asChild><button className="btn btn-primary" style={{ marginTop: 16 }} type="button">Got it</button></Dialog.Close>
                </Dialog.Content>
              </Dialog.Portal>
            </Dialog.Root>
          </div>

          <div
            className={`upload ${dragging ? 'dragging' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            role="region"
            aria-label="Upload CSV"
          >
            <h3><i className="pixelart-icons-font-file" aria-hidden /> Drag & drop your CSV here</h3>
            <p>or click to browse — max 15 MB, .csv only</p>
            <input ref={inputRef} type="file" accept=".csv,text/csv" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) parseFile(f) }} />
            <button className="btn btn-secondary" style={{ marginTop: 12 }} onClick={() => inputRef.current?.click()} type="button">Choose file</button>
            {fileInfo && <div className="file-meta"><span>{fileInfo.name}</span><span>{formatBytes(fileInfo.size)}</span><span>{fileInfo.rows} rows</span><span>{fileInfo.columns} cols</span></div>}
            {loading && <div style={{ marginTop: 12, display: 'flex', gap: 8, justifyContent: 'center' }}><span className="skeleton" style={{ width: 120 }} /> <span className="skeleton" style={{ width: 80 }} /></div>}
            {error && <div role="alert" style={{ marginTop: 12, color: 'var(--color-danger)', fontSize: 13, background: '#fef2f2', border: '1px solid #fecaca', padding: '8px 12px', borderRadius: 8, display: 'inline-block' }}>{error} — try another file or <button onClick={handleDemo} style={{ textDecoration: 'underline', background: 'none', border: 0, cursor: 'pointer', color: 'inherit', fontWeight: 600 }}>use demo data</button></div>}
          </div>
        </section>

        {!hasData && !loading && (
          <div className="empty" style={{ marginTop: 8 }}>
            No dataset loaded yet. Upload a CSV or try demo data to see KPIs, trends and anomalies.
          </div>
        )}

        {hasData && (
          <Tabs.Root value={activeTab} onValueChange={setActiveTab} className="dash-tabs">
            <Tabs.List className="tabs-list" aria-label="Dashboard sections">
              <Tabs.Trigger value="overview" className="tabs-trigger"><i className="pixelart-icons-font-dashboard" aria-hidden /> Overview</Tabs.Trigger>
              <Tabs.Trigger value="data" className="tabs-trigger"><i className="pixelart-icons-font-table" aria-hidden /> Data</Tabs.Trigger>
              <Tabs.Trigger value="insights" className="tabs-trigger"><i className="pixelart-icons-font-lightbulb" aria-hidden /> Insights</Tabs.Trigger>
              <Tabs.Trigger value="ai" className="tabs-trigger"><i className="pixelart-icons-font-message" aria-hidden /> AI Analyst</Tabs.Trigger>
            </Tabs.List>

            <Tabs.Content value="overview" className="tabs-content">
              <FilterBar />
              <ShareBar />
              <ExportBar />
              <TrustBar />
              <KPIGrid />

              {/* Primary charts */}
              <div className="charts">
                <ChartCard title="Sales over time (monthly)" icon="pixelart-icons-font-chart" empty={timeSeries.length ? null : 'No time series data — ensure a `date` column exists.'}>
                  <ResponsiveContainer width="100%" height={260}>
                    <AreaChart data={timeSeries}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Area type="monotone" dataKey="value" stroke="#0f172a" fill="#e2e8f0" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </ChartCard>
                <ChartCard title="Sales by city" icon="pixelart-icons-font-chart-bar" empty={byCity.length ? null : 'No city data.'}>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={byCity}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="value" fill="#0f62fe" radius={[6,6,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
              </div>

              <div className="charts" style={{ marginTop: 16 }}>
                <ChartCard title="Sales by category" icon="pixelart-icons-font-folder" empty={byCategory.length ? null : 'No category data.'}>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={byCategory}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="value" fill="#0e9f6e" radius={[6,6,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
                <ChartCard title="Sales by product" icon="pixelart-icons-font-trophy" empty={byProduct.length ? null : 'No product data.'}>
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={byProduct}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Line type="monotone" dataKey="value" stroke="#0f62fe" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </ChartCard>
              </div>

              {activeChart && (
                <div className="card" style={{ marginTop: 16, borderColor: 'var(--color-primary)', borderWidth: 1.5 }}>
                  <h3><i className="pixelart-icons-font-chart" aria-hidden /> AI Chart — {activeChart.chartType} ({activeChart.x} → {activeChart.y})</h3>
                  <ActiveChartRenderer config={activeChart} rows={filteredRows} />
                  <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                    <span className="filter-count">Set via AI action setChart</span>
                    <button className="btn btn-secondary small" onClick={() => setActiveChart(null)} type="button">Dismiss</button>
                  </div>
                </div>
              )}

              {/* Advanced anomalies Fase 5 */}
              <div style={{ marginTop: 16 }}>
                <AnomalyPanel />
              </div>
            </Tabs.Content>

            <Tabs.Content value="data" className="tabs-content">
              <FilterBar />
              <ShareBar />
              <ExportBar />
              <DataTable />
              <DataProfiler />
              <HistoryList />
              <DatasetSwitcher />
            </Tabs.Content>

            <Tabs.Content value="insights" className="tabs-content">
              <FilterBar />
              <div className="card" style={{ marginBottom: 16 }}>
                <h3><i className="pixelart-icons-font-lightbulb" aria-hidden /> Key insights (deterministic)</h3>
                <p style={{ color: 'var(--color-muted)', fontSize: 13, margin: '6px 0 12px' }}>
                  Insights are computed locally from filtered data — no LLM. Trends, rankings and anomalies.
                </p>
                <InsightCard />
              </div>

              <div className="charts">
                <ChartCard title="Trend — monthly sales" icon="pixelart-icons-font-chart" empty={timeSeries.length ? null : 'No trend data.'}>
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={timeSeries}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Line type="monotone" dataKey="value" stroke="#0f172a" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </ChartCard>
                <div className="card">
                  <h3><i className="pixelart-icons-font-ranking" aria-hidden /> Rankings</h3>
                  <div style={{ display: 'grid', gap: 12 }}>
                    <div>
                      <div className="kpi-label">By city</div>
                      <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: 13 }}>{byCity.slice(0, 3).map((b) => <li key={b.name}>{b.name}: ${b.value.toLocaleString()}</li>)}</ul>
                    </div>
                    <div>
                      <div className="kpi-label">By product</div>
                      <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: 13 }}>{byProduct.slice(0, 3).map((b) => <li key={b.name}>{b.name}: ${b.value.toLocaleString()}</li>)}</ul>
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 16 }}>
                <CompareTable />
              </div>
              <div style={{ marginTop: 16 }}>
                <ShareBar />
              </div>
              <div style={{ marginTop: 16 }}>
                <ExportBar />
              </div>
            </Tabs.Content>

            <Tabs.Content value="ai" className="tabs-content">
              <Suspense fallback={<div style={{ display: 'flex', gap: 8, padding: 16 }}><span className="skeleton" style={{ width: '100%', height: 320 }} /></div>}>
                <CopilotPanel />
              </Suspense>
            </Tabs.Content>
          </Tabs.Root>
        )}
      </main>

      <footer className="footer" role="contentinfo">Copixi — AI Data Analyst · Data stays in your browser whenever possible · Built with React + Papa Parse + Recharts + CopilotKit + Gemini via Vercel Function · <a href="https://github.com/anomalyco/opencode" style={{ color: 'inherit', textDecoration: 'underline' }}>Feedback</a></footer>
    </>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <DashboardProvider>
        <DashboardContent />
      </DashboardProvider>
    </ErrorBoundary>
  )
}
