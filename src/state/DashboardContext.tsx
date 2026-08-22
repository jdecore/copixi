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

  const profile = useMemo(() => (rawRows ? profileDataset(rawRows) : null), [rawRows])
  const columns = useMemo(() => profile?.columns ?? [], [profile])
  const allowedColumns = useMemo(() => columns.map((c) => c.name), [columns])

  const filteredRows = useMemo(() => (rawRows ? applyFilters(rawRows, filters) : []), [rawRows, filters])
  const metrics = useMemo(() => (filteredRows.length ? computeMetrics(filteredRows) : rawRows ? computeMetrics(filteredRows) : null), [filteredRows, rawRows])
  // For metrics when no filtered rows but raw exists with filters that yield 0, keep 0 metrics
  const timeSeries = useMemo(() => (filteredRows.length ? toTimeSeries(filteredRows, 'date', 'sales') : []), [filteredRows])
  const byCity = useMemo(() => (filteredRows.length ? toBarData(filteredRows, 'city', 'sales').slice(0, 6) : []), [filteredRows])
  const byCategory = useMemo(() => (filteredRows.length ? toBarData(filteredRows, 'category', 'sales').slice(0, 6) : []), [filteredRows])
  const byProduct = useMemo(() => (filteredRows.length ? toBarData(filteredRows, 'product', 'sales').slice(0, 6) : []), [filteredRows])
  const anomalies = useMemo(() => (filteredRows.length ? detectAnomaliesZScore(filteredRows, 'sales', 2.5).slice(0, 5) : []), [filteredRows])
  const autoCharts = useMemo(() => suggestCharts(columns, filteredRows), [columns, filteredRows])

  const setDataset = useCallback((rows: Row[], info: FileInfo) => {
    if (!rows.length) { setError('CSV is empty or has no valid rows. Try another file or use demo data.'); return }
    setRawRows(rows)
    setFileInfo(info)
    setFilters([])
    setActiveChart(null)
    setError(null)
  }, [])

  const clearDataset = useCallback(() => {
    setRawRows(null)
    setFileInfo(null)
    setFilters([])
    setActiveChart(null)
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

  const value: DashboardContextValue = {
    rawRows, fileInfo, filters, activeChart, error, loading,
    profile, columns, filteredRows, metrics, timeSeries, byCity, byCategory, byProduct, anomalies, autoCharts,
    setDataset, clearDataset, addFilter, removeFilter, clearFilters, setActiveChart, setError, setLoading,
  }

  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>
}

export function useDashboard() {
  const ctx = useContext(DashboardContext)
  if (!ctx) throw new Error('useDashboard must be used within DashboardProvider')
  return ctx
}
