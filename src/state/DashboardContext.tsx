import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import type { Row, ColumnMeta, Filter, FilterOperator, Metrics, DatasetProfile, ChartConfig } from '../data/types'
import { profileDataset } from '../data/profiler'
import { computeMetrics } from '../data/statistics'
import { applyFilters } from '../data/transformations'
import { detectAnomaliesZScore } from '../data/anomalyDetection'
import { toTimeSeries, toBarData, suggestCharts } from '../data/chartAdapter'

export type FileInfo = { name: string; size: number; rows: number; columns: number } | null

type DashboardState = {
  rawRows: Row[] | null
  fileInfo: FileInfo
  filters: Filter[]
  activeChart: ChartConfig | null
  error: string | null
  loading: boolean
  sortCol: string | null
  sortDir: 'asc' | 'desc'
  searchQuery: string
}

type DashboardDerived = {
  profile: DatasetProfile | null
  columns: ColumnMeta[]
  filteredRows: Row[]
  metrics: Metrics | null
  timeSeries: { date: string; value: number }[]
  byCity: { name: string; value: number }[]
  byCategory: { name: string; value: number }[]
  byProduct: { name: string; value: number }[]
  anomalies: ReturnType<typeof detectAnomaliesZScore>
  autoCharts: { config: ChartConfig; data: { name: string; value: number }[] }[]
  nullPercentages: Record<string, number>
  dateRange: { min: string; max: string } | null
  topCategories: Record<string, { name: string; value: number }[]>
  suggestedQuestions: string[]
}

type DashboardActions = {
  setDataset: (rows: Row[], fileInfo: FileInfo) => void
  clearDataset: () => void
  addFilter: (f: Filter) => boolean
  removeFilter: (index: number) => void
  clearFilters: () => void
  setActiveChart: (c: ChartConfig | null) => void
  setError: (msg: string | null) => void
  setLoading: (v: boolean) => void
  setSort: (col: string | null, dir?: 'asc' | 'desc') => void
  setSearch: (query: string) => void
}

type DashboardContextValue = DashboardState & DashboardDerived & DashboardActions

const DashboardContext = createContext<DashboardContextValue | null>(null)

const VALID_OPERATORS: FilterOperator[] = ['equals', 'contains', 'gt', 'lt', 'between']

function isValidFilter(filter: Filter, allowedColumns: string[]): { ok: boolean; reason?: string } {
  if (!allowedColumns.includes(filter.column)) return { ok: false, reason: `Column "${filter.column}" not in dataset` }
  if (!VALID_OPERATORS.includes(filter.operator)) return { ok: false, reason: `Operator ${filter.operator} invalid` }
  if (filter.value === null || filter.value === undefined || String(filter.value).trim() === '') {
    return { ok: false, reason: 'Value is empty' }
  }
  if (filter.operator === 'between' && (filter.value2 === null || filter.value2 === undefined || String(filter.value2).trim() === '')) {
    return { ok: false, reason: 'between requires value2' }
  }
  if ((filter.operator === 'gt' || filter.operator === 'lt' || filter.operator === 'between') && Number.isNaN(Number(filter.value))) {
    return { ok: false, reason: `Value "${filter.value}" is not a number for operator ${filter.operator}` }
  }
  return { ok: true }
}

export function DashboardProvider({ children }: { children: ReactNode }) {
  const [rawRows, setRawRows] = useState<Row[] | null>(null)
  const [fileInfo, setFileInfo] = useState<FileInfo>(null)
  const [filters, setFilters] = useState<Filter[]>([])
  const [activeChart, setActiveChart] = useState<ChartConfig | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [sortCol, setSortCol] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [searchQuery, setSearchQuery] = useState('')

  const profile = useMemo(() => (rawRows ? profileDataset(rawRows) : null), [rawRows])
  const columns = useMemo(() => profile?.columns ?? [], [profile])
  const allowedColumns = useMemo(() => columns.map((c) => c.name), [columns])

  const filteredRows = useMemo(() => (rawRows ? applyFilters(rawRows, filters) : []), [rawRows, filters])
  const metrics = useMemo(() => (filteredRows.length ? computeMetrics(filteredRows) : rawRows ? computeMetrics(filteredRows) : null), [filteredRows, rawRows])
  const timeSeries = useMemo(() => (filteredRows.length ? toTimeSeries(filteredRows, 'date', 'sales') : []), [filteredRows])
  const byCity = useMemo(() => (filteredRows.length ? toBarData(filteredRows, 'city', 'sales').slice(0, 6) : []), [filteredRows])
  const byCategory = useMemo(() => (filteredRows.length ? toBarData(filteredRows, 'category', 'sales').slice(0, 6) : []), [filteredRows])
  const byProduct = useMemo(() => (filteredRows.length ? toBarData(filteredRows, 'product', 'sales').slice(0, 6) : []), [filteredRows])
  const anomalies = useMemo(() => (filteredRows.length ? detectAnomaliesZScore(filteredRows, 'sales', 2.5).slice(0, 5) : []), [filteredRows])
  const autoCharts = useMemo(() => suggestCharts(columns, filteredRows), [columns, filteredRows])

  const nullPercentages = useMemo(() => {
    if (!profile) return {}
    const out: Record<string, number> = {}
    for (const c of profile.columns) {
      out[c.name] = profile.rowCount > 0 ? Math.round((c.nullCount / profile.rowCount) * 100) : 0
    }
    return out
  }, [profile])

  const dateRange = useMemo(() => {
    if (!rawRows) return null
    const dates = rawRows.map((r) => String(r['date'] ?? '')).filter((s) => !Number.isNaN(Date.parse(s)) && /\d{4}-\d{2}-\d{2}/.test(s))
    if (!dates.length) return null
    dates.sort()
    return { min: dates[0], max: dates[dates.length - 1] }
  }, [rawRows])

  const topCategories = useMemo(() => {
    if (!columns.length || !filteredRows.length) return {}
    const out: Record<string, { name: string; value: number }[]> = {}
    const catCols = columns.filter((c) => c.type === 'string' && c.distinctCount >= 2 && c.distinctCount <= 20)
    for (const c of catCols.slice(0, 5)) {
      out[c.name] = toBarData(filteredRows, c.name, 'sales').slice(0, 5)
    }
    return out
  }, [columns, filteredRows])

  const suggestedQuestions = useMemo(() => {
    if (!columns.length) return []
    const qs: string[] = []
    const numCols = columns.filter((c) => c.type === 'number')
    const catCols = columns.filter((c) => c.type === 'string' && c.distinctCount >= 2 && c.distinctCount <= 20)
    const dateCols = columns.filter((c) => c.type === 'date')
    const hasFilters = filters.length > 0
    if (catCols.length && numCols.length) {
      qs.push(`Show ${numCols[0].name} by ${catCols[0].name} in a bar chart`)
    }
    if (dateCols.length && numCols.length) {
      qs.push(`Show ${numCols[0].name} trend over ${dateCols[0].name}`)
    }
    if (catCols.length >= 2) {
      qs.push(`Compare ${catCols[0].name} vs ${catCols[1].name} by ${numCols[0]?.name ?? 'sales'}`)
    }
    if (hasFilters) {
      qs.push('Clear all filters')
    }
    if (anomalies.length) {
      qs.push('Show anomalies in detail')
    }
    return qs.slice(0, 5)
  }, [columns, filters.length, anomalies.length])

  const setDataset = useCallback((rows: Row[], info: FileInfo) => {
    if (!rows.length) { setError('CSV is empty or has no valid rows. Try another file or use demo data.'); return }
    setRawRows(rows)
    setFileInfo(info)
    setFilters([])
    setActiveChart(null)
    setSortCol(null)
    setSortDir('asc')
    setSearchQuery('')
    setError(null)
  }, [])

  const clearDataset = useCallback(() => {
    setRawRows(null)
    setFileInfo(null)
    setFilters([])
    setActiveChart(null)
    setSortCol(null)
    setSortDir('asc')
    setSearchQuery('')
    setError(null)
  }, [])

  const addFilter = useCallback((f: Filter): boolean => {
    const v = isValidFilter(f, allowedColumns)
    if (!v.ok) {
      if (import.meta.env.DEV) console.warn('[Copixi] Filter rejected', f, v.reason)
      setError(`Filter rejected: ${v.reason}`)
      return false
    }
    setFilters((prev) => [...prev, f])
    setError(null)
    return true
  }, [allowedColumns])

  const removeFilter = useCallback((index: number) => {
    setFilters((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const clearFilters = useCallback(() => setFilters([]), [])

  const setSort = useCallback((col: string | null, dir?: 'asc' | 'desc') => {
    setSortCol(col)
    setSortDir(dir ?? (col ? 'asc' : 'asc'))
  }, [])

  const setSearch = useCallback((query: string) => {
    setSearchQuery(query)
  }, [])

  const value: DashboardContextValue = {
    rawRows, fileInfo, filters, activeChart, error, loading, sortCol, sortDir, searchQuery,
    profile, columns, filteredRows, metrics, timeSeries, byCity, byCategory, byProduct, anomalies, autoCharts,
    nullPercentages, dateRange, topCategories, suggestedQuestions,
    setDataset, clearDataset, addFilter, removeFilter, clearFilters, setActiveChart, setError, setLoading, setSort, setSearch,
  }

  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>
}

export function useDashboard() {
  const ctx = useContext(DashboardContext)
  if (!ctx) throw new Error('useDashboard must be used within DashboardProvider')
  return ctx
}