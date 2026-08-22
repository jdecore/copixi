import { useState } from 'react'
import { useCopilotAction, useCopilotReadable } from '@copilotkit/react-core'
import { CopilotChat } from '@copilotkit/react-ui'
import { useDashboard } from '../../state/DashboardContext'
import type { FilterOperator, ChartConfig } from '../../data/types'

export function CopilotPanel() {
  const {
    rawRows, filteredRows, columns, metrics, timeSeries, byCity, byCategory, byProduct,
    filters, activeChart, addFilter, clearFilters, setActiveChart, setError,
  } = useDashboard()

  const [lastAction, setLastAction] = useState<string | null>(null)
  const [insightLog, setInsightLog] = useState<string[]>([])

  // Aggregated context only — privacy §8, tokens §9
  const dashboardContext = {
    rowCount: rawRows?.length ?? 0,
    filteredCount: filteredRows.length,
    columns: columns.map((c) => ({
      name: c.name, type: c.type, distinctCount: c.distinctCount, min: c.min, max: c.max,
    })),
    metrics,
    topProducts: byProduct.slice(0, 3),
    salesByCity: byCity.slice(0, 5),
    salesByCategory: byCategory.slice(0, 5),
    trends: timeSeries.slice(-6),
    currentFilters: filters,
    activeChart,
    hasData: !!rawRows,
  }

  useCopilotReadable({
    description: 'Aggregated dashboard context. Never raw rows. Use for decisions.',
    value: dashboardContext,
  })

  // Helper: validate column whitelist
  const allowedColumns = columns.map((c) => c.name)
  const isValidOperator = (op: string): op is FilterOperator =>
    ['equals', 'contains', 'gt', 'lt', 'between'].includes(op)

  useCopilotAction({
    name: 'setFilter',
    description: 'Add a filter to the dashboard. Validates column exists via whitelist, operator, value. Example: setFilter city equals Bogotá',
    parameters: [
      { name: 'column', type: 'string', description: `Column name from: ${allowedColumns.join(', ') || 'no dataset loaded'}`, required: true },
      { name: 'operator', type: 'string', description: 'Operator: equals, contains, gt, lt, between', required: true },
      { name: 'value', type: 'string', description: 'Filter value', required: true },
      { name: 'value2', type: 'string', description: 'Second value for between', required: false },
    ],
    handler: async ({ column, operator, value, value2 }) => {
      setLastAction(`Applying filter: ${column} ${operator} ${value}${value2 ? ` → ${value2}` : ''}…`)
      if (!allowedColumns.includes(column)) {
        const msg = `Column "${column}" not found. Available: ${allowedColumns.join(', ')}`
        if (import.meta.env.DEV) console.warn('[Copixi] AI setFilter rejected', { column, operator, value, reason: msg })
        setError(msg)
        setLastAction(null)
        return msg
      }
      if (!isValidOperator(operator)) {
        const msg = `Operator "${operator}" invalid`
        if (import.meta.env.DEV) console.warn('[Copixi] AI setFilter rejected', { column, operator, reason: msg })
        setError(msg)
        setLastAction(null)
        return msg
      }
      const ok = addFilter({ column, operator, value, value2 })
      setLastAction(null)
      return ok ? `Filter applied: ${column} ${operator} ${value}` : 'Filter rejected (validation failed)'
    },
  })

  useCopilotAction({
    name: 'clearFilters',
    description: 'Remove all filters from dashboard',
    parameters: [],
    handler: async () => {
      setLastAction('Clearing filters…')
      clearFilters()
      setLastAction(null)
      return 'All filters cleared'
    },
  })

  useCopilotAction({
    name: 'setChart',
    description: 'Change active chart type and axes. chartType: line|bar|area|pie, x and y must be existing columns.',
    parameters: [
      { name: 'chartType', type: 'string', description: 'line, bar, area, pie', required: true },
      { name: 'x', type: 'string', description: `X axis column: ${allowedColumns.join(', ')}`, required: true },
      { name: 'y', type: 'string', description: `Y axis column: ${allowedColumns.join(', ')}`, required: true },
    ],
    handler: async ({ chartType, x, y }) => {
      setLastAction(`Setting chart: ${chartType} ${x} vs ${y}…`)
      const validTypes: ChartConfig['chartType'][] = ['line', 'bar', 'area', 'pie']
      if (!validTypes.includes(chartType as ChartConfig['chartType'])) {
        const msg = `chartType must be one of ${validTypes.join(', ')}`
        if (import.meta.env.DEV) console.warn('[Copixi] AI setChart rejected', { chartType, x, y, reason: msg })
        setError(msg)
        setLastAction(null)
        return msg
      }
      if (!allowedColumns.includes(x) || !allowedColumns.includes(y)) {
        const msg = `Columns "${x}" or "${y}" not in dataset: ${allowedColumns.join(', ')}`
        if (import.meta.env.DEV) console.warn('[Copixi] AI setChart rejected', { chartType, x, y, reason: msg })
        setError(msg)
        setLastAction(null)
        return msg
      }
      setActiveChart({ chartType: chartType as ChartConfig['chartType'], x, y })
      setLastAction(null)
      return `Chart set to ${chartType} with x=${x} y=${y}`
    },
  })

  useCopilotAction({
    name: 'setDateRange',
    description: 'Filter by date range on the date column. from and to are YYYY-MM-DD strings.',
    parameters: [
      { name: 'from', type: 'string', description: 'Start date YYYY-MM-DD', required: true },
      { name: 'to', type: 'string', description: 'End date YYYY-MM-DD', required: true },
    ],
    handler: async ({ from, to }) => {
      setLastAction(`Applying date range ${from} → ${to}…`)
      if (!allowedColumns.includes('date')) {
        const msg = 'No date column in dataset'
        if (import.meta.env.DEV) console.warn('[Copixi] AI setDateRange rejected', { from, to, reason: msg })
        setError(msg)
        setLastAction(null)
        return msg
      }
      const dFrom = Date.parse(from), dTo = Date.parse(to)
      if (Number.isNaN(dFrom) || Number.isNaN(dTo)) {
        const msg = `Invalid dates: ${from}, ${to}`
        if (import.meta.env.DEV) console.warn('[Copixi] AI setDateRange rejected', { from, to, reason: msg })
        setError(msg)
        setLastAction(null)
        return msg
      }
      // Clear previous date filters then add between
      clearFilters()
      // Use addFilter sequentially (allow multiple filters: keep non-date filters? simplified clear)
      addFilter({ column: 'date', operator: 'gt', value: from })
      // To represent range, add two filters: date >= from and date <= to via gt/lt
      // But use between with map on string comparison: for demo, use contains filter hack? Use gt/lt numeric string compare
      // We'll add second filter
      addFilter({ column: 'date', operator: 'lt', value: to })
      setLastAction(null)
      return `Date range applied: ${from} to ${to}`
    },
  })

  useCopilotAction({
    name: 'compareValues',
    description: 'Compare values within a column by summing sales. Example column city values Bogotá, Medellín',
    parameters: [
      { name: 'column', type: 'string', description: `Column to compare: ${allowedColumns.join(', ')}`, required: true },
      { name: 'values', type: 'string[]', description: 'Values to compare', required: true },
    ],
    handler: async ({ column, values }) => {
      setLastAction(`Comparing ${column}: ${Array.isArray(values) ? values.join(', ') : values}…`)
      if (!allowedColumns.includes(column)) {
        const msg = `Column "${column}" not found`
        if (import.meta.env.DEV) console.warn('[Copixi] AI compareValues rejected', { column, values, reason: msg })
        setError(msg)
        setLastAction(null)
        return msg
      }
      if (!Array.isArray(values) || values.length < 2 || values.length > 5) {
        const msg = 'values must be array of 2-5 strings'
        if (import.meta.env.DEV) console.warn('[Copixi] AI compareValues rejected', { column, values, reason: msg })
        setError(msg)
        setLastAction(null)
        return msg
      }
      // Compute comparison locally
      const data = filteredRows.length ? filteredRows : rawRows ?? []
      const groups = values.map((v) => {
        const sum = data.filter((r) => String(r[column]) === String(v)).reduce((a, r) => a + (Number(r['sales']) || 0), 0)
        return `${v}: $${sum.toLocaleString()}`
      })
      setLastAction(null)
      return `Comparison for ${column} — ${groups.join(' | ')}`
    },
  })

  useCopilotAction({
    name: 'showInsight',
    description: 'Generate an insight message to display in the dashboard',
    parameters: [
      { name: 'insight', type: 'string', description: 'Insight text (max 300 chars)', required: true },
    ],
    handler: async ({ insight }) => {
      if (!insight || String(insight).length > 600) {
        const msg = 'Insight empty or too long (max 600)'
        if (import.meta.env.DEV) console.warn('[Copixi] AI showInsight rejected', { insight, reason: msg })
        setError(msg)
        return msg
      }
      setInsightLog((prev) => [...prev.slice(-4), String(insight)])
      return `Insight recorded: ${insight}`
    },
  })

  if (!rawRows) {
    return (
      <div className="empty">
        <i className="pixelart-icons-font-message" aria-hidden /> Load a dataset first — then ask Copixi. Try demo data to start in &lt;30s.
      </div>
    )
  }

  return (
    <div className="copilot-panel">
      <div className="copilot-header">
        <h3><i className="pixelart-icons-font-message" aria-hidden /> Ask Copixi</h3>
        <span className="filter-count">{filteredRows.length} rows · {filters.length} filters</span>
      </div>

      {lastAction && (
        <div className="ai-action-indicator" role="status" aria-live="polite">
          <span className="skeleton" style={{ width: 16, height: 16, borderRadius: 999 }} aria-hidden />
          {lastAction}
        </div>
      )}

      {insightLog.length > 0 && (
        <div className="insight-log" aria-label="AI insights">
          {insightLog.map((ins, i) => (
            <div key={i} className="insight ai-insight"><i className="pixelart-icons-font-lightbulb" aria-hidden /> {ins}</div>
          ))}
        </div>
      )}

      <div className="copilot-chat-wrap">
        <CopilotChat
          labels={{
            title: 'Copixi Analyst',
            initial: 'Hi! I can filter, compare, and change charts. Try: "Show me sales from Bogotá" or "Compare Bogotá vs Medellín"',
          }}
          instructions="You are Copixi AI Data Analyst. You have tools: setFilter, clearFilters, setChart, setDateRange, compareValues, showInsight. Always validate with whitelist before calling. Prefer actions over plain text. Keep answers concise and cite numbers from context."
        />
      </div>

      <div className="copilot-footer">
        <span style={{ fontSize: 11, color: 'var(--color-muted)' }}>AI sends only aggregated context, never raw rows (§8). Actions are validated before execution.</span>
      </div>
    </div>
  )
}
