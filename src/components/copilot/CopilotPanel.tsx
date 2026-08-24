import { useState } from 'react'
import { useFrontendTool, useAgentContext, CopilotChat } from '@copilotkit/react-core/v2'
import { z } from 'zod'
import { useDashboard } from '../../state/DashboardContext'
import type { FilterOperator, ChartConfig } from '../../data/types'
import type { MascotaMood } from '../../types/mascota'

function setMascotaMood(mood: MascotaMood) {
  window.dispatchEvent(new CustomEvent('copixi:mascota-mood', { detail: mood }))
}

function mascotaSpeak(text: string) {
  try { (window as any).mascotaSpeak?.(text) } catch {}
}

export function CopilotPanel() {
  const {
    rawRows, filteredRows, columns, filters, activeChart, addFilter, removeFilter, clearFilters, setActiveChart, setError, setSort, setSearch,
    nullPercentages, dateRange, topCategories, suggestedQuestions, anomalies, autoCharts, metrics, timeSeries, byCity, byCategory, byProduct,
    embeddingStatus, topSimilarRows, ragQuery,
  } = useDashboard()

  const [lastAction, setLastAction] = useState<string | null>(null)
  const [insightLog, setInsightLog] = useState<string[]>([])

  const allowedColumns = columns.map((c) => c.name)

  const dashboardContext = {
    rowCount: rawRows?.length ?? 0,
    filteredCount: filteredRows.length,
    columns: columns.map((c) => ({
      name: c.name, type: c.type, distinctCount: c.distinctCount, nullCount: c.nullCount, nullPct: nullPercentages[c.name] ?? 0, min: c.min, max: c.max, sampleValues: c.sampleValues,
    })),
    metrics,
    topProducts: byProduct.slice(0, 3),
    salesByCity: byCity.slice(0, 5),
    salesByCategory: byCategory.slice(0, 5),
    trends: timeSeries.slice(-6),
    currentFilters: filters,
    activeChart,
    hasData: !!rawRows,
    dateRange,
    nullPercentages,
    topCategories,
    autoCharts: autoCharts.map((c) => ({ chartType: c.config.chartType, x: c.config.x, y: c.config.y, title: c.config.title, pointCount: c.data.length })),
    suggestedQuestions,
    anomalies: anomalies.slice(0, 3).map((a) => ({ type: a.type, date: String(a.row['date'] ?? `#${a.index}`), column: a.column, value: a.value, zScore: a.zScore })),
    embeddingStatus,
    embeddingRowCount: rawRows?.length ?? 0,
    topSimilarRows: topSimilarRows?.slice(0, 3).map((r) => ({ index: r.index, score: r.score.toFixed(3), snippet: r.snippet })) ?? [],
  }

  // v2 useAgentContext requires JSON-serializable values (no `undefined`).
  // Serialize once to guarantee a clean, serializable snapshot.
  const serializableContext = JSON.parse(JSON.stringify(dashboardContext))

  useAgentContext({
    description: 'Aggregated dashboard context. Never raw rows. Use for decisions.',
    value: serializableContext,
  })

  const isValidOperator = (op: string): op is FilterOperator =>
    ['equals', 'contains', 'gt', 'lt', 'between'].includes(op)

  useFrontendTool({
    name: 'setFilter',
    description: 'Add a filter to the dashboard. Validates column exists via whitelist, operator, value. Example: setFilter city equals Bogotá',
    parameters: z.object({
      column: z.string().describe(`Column name from: ${allowedColumns.join(', ') || 'no dataset loaded'}`),
      operator: z.string().describe('Operator: equals, contains, gt, lt, between'),
      value: z.string().describe('Filter value'),
      value2: z.string().optional().describe('Second value for between'),
    }),
    handler: async ({ column, operator, value, value2 }) => {
      setMascotaMood('guino')
      setLastAction(`Applying filter: ${column} ${operator} ${value}${value2 ? ` → ${value2}` : ''}…`)
      if (!allowedColumns.includes(column)) {
        const msg = `Column "${column}" not found. Available: ${allowedColumns.join(', ')}`
        if (import.meta.env.DEV) console.warn('[Copixi] AI setFilter rejected', { column, operator, value, reason: msg })
        setError(msg); setLastAction(null); setMascotaMood('enojado')
        return msg
      }
      if (!isValidOperator(operator)) {
        const msg = `Operator "${operator}" invalid`
        if (import.meta.env.DEV) console.warn('[Copixi] AI setFilter rejected', { column, operator, reason: msg })
        setError(msg); setLastAction(null); setMascotaMood('enojado')
        return msg
      }
      const ok = addFilter({ column, operator, value, value2 })
      setLastAction(null)
      setMascotaMood(ok ? 'feliz' : 'enojado')
      return ok ? `Filter applied: ${column} ${operator} ${value}` : 'Filter rejected (validation failed)'
    },
  })

  useFrontendTool({
    name: 'clearFilters',
    description: 'Remove all filters from dashboard',
    parameters: z.object({}),
    handler: async () => {
      setMascotaMood('guino')
      setLastAction('Clearing filters…')
      clearFilters()
      setLastAction(null)
      setMascotaMood('feliz')
      return 'All filters cleared'
    },
  })

  useFrontendTool({
    name: 'removeFilter',
    description: 'Remove a single filter by column name. If multiple filters exist on the same column, removes the first match.',
    parameters: z.object({
      column: z.string().describe(`Column name from: ${allowedColumns.join(', ') || 'no dataset loaded'}`),
    }),
    handler: async ({ column }) => {
      setMascotaMood('guino')
      setLastAction(`Removing filter: ${column}…`)
      if (!allowedColumns.includes(column)) {
        const msg = `Column "${column}" not found`
        if (import.meta.env.DEV) console.warn('[Copixi] AI removeFilter rejected', { column, reason: msg })
        setError(msg); setLastAction(null); setMascotaMood('enojado')
        return msg
      }
      const idx = filters.findIndex((f) => f.column === column)
      if (idx === -1) {
        setLastAction(null)
        setMascotaMood('duda')
        return `No filter found on ${column}`
      }
      removeFilter(idx)
      setLastAction(null)
      setMascotaMood('feliz')
      return `Filter removed from ${column}`
    },
  })

  useFrontendTool({
    name: 'setChart',
    description: 'Change active chart type and axes. chartType: line|bar|area|pie, x and y must be existing columns.',
    parameters: z.object({
      chartType: z.string().describe('line, bar, area, pie'),
      x: z.string().describe(`X axis column: ${allowedColumns.join(', ')}`),
      y: z.string().describe(`Y axis column: ${allowedColumns.join(', ')}`),
    }),
    handler: async ({ chartType, x, y }) => {
      setMascotaMood('guino')
      setLastAction(`Setting chart: ${chartType} ${x} vs ${y}…`)
      const validTypes: ChartConfig['chartType'][] = ['line', 'bar', 'area', 'pie', 'scatter']
      if (!validTypes.includes(chartType as ChartConfig['chartType'])) {
        const msg = `chartType must be one of ${validTypes.join(', ')}`
        if (import.meta.env.DEV) console.warn('[Copixi] AI setChart rejected', { chartType, x, y, reason: msg })
        setError(msg); setLastAction(null); setMascotaMood('enojado')
        return msg
      }
      if (!allowedColumns.includes(x) || !allowedColumns.includes(y)) {
        const msg = `Columns "${x}" or "${y}" not in dataset: ${allowedColumns.join(', ')}`
        if (import.meta.env.DEV) console.warn('[Copixi] AI setChart rejected', { chartType, x, y, reason: msg })
        setError(msg); setLastAction(null); setMascotaMood('enojado')
        return msg
      }
      setActiveChart({ chartType: chartType as ChartConfig['chartType'], x, y })
      setLastAction(null)
      setMascotaMood('feliz')
      return `Chart set to ${chartType} with x=${x} y=${y}`
    },
  })

  useFrontendTool({
    name: 'setDateRange',
    description: 'Filter by date range on the date column. Preserves existing non-date filters. from and to are YYYY-MM-DD strings.',
    parameters: z.object({
      from: z.string().describe('Start date YYYY-MM-DD'),
      to: z.string().describe('End date YYYY-MM-DD'),
    }),
    handler: async ({ from, to }) => {
      setMascotaMood('guino')
      setLastAction(`Applying date range ${from} → ${to}…`)
      const dateCol = columns.find((c) => c.type === 'date')?.name ?? columns.find((c) => /date|time|fecha|day/i.test(c.name))?.name
      if (!dateCol) {
        const msg = 'No date column in dataset'
        if (import.meta.env.DEV) console.warn('[Copixi] AI setDateRange rejected', { from, to, reason: msg })
        setError(msg); setLastAction(null); setMascotaMood('enojado')
        return msg
      }
      const dFrom = Date.parse(from), dTo = Date.parse(to)
      if (Number.isNaN(dFrom) || Number.isNaN(dTo)) {
        const msg = `Invalid dates: ${from}, ${to}`
        if (import.meta.env.DEV) console.warn('[Copixi] AI setDateRange rejected', { from, to, reason: msg })
        setError(msg); setLastAction(null); setMascotaMood('enojado')
        return msg
      }
      const preserved = filters.filter((f) => f.column !== dateCol)
      clearFilters()
      for (const f of preserved) addFilter(f)
      addFilter({ column: dateCol, operator: 'gt', value: from })
      addFilter({ column: dateCol, operator: 'lt', value: to })
      setLastAction(null)
      setMascotaMood('feliz')
      mascotaSpeak(`Date range ${from} to ${to}`)
      return `Date range applied: ${from} to ${to}`
    },
  })

  useFrontendTool({
    name: 'compareValues',
    description: 'Compare values within a column by summing a metric. metric defaults to sales, can be units or customers.',
    parameters: z.object({
      column: z.string().describe(`Column to compare: ${allowedColumns.join(', ')}`),
      values: z.array(z.string()).describe('Values to compare'),
      metric: z.string().optional().describe('Metric to sum: sales, units, customers (default sales)'),
    }),
    handler: async ({ column, values, metric }) => {
      setMascotaMood('guino')
      setLastAction(`Comparing ${column}: ${Array.isArray(values) ? values.join(', ') : String(values)}…`)
      if (!allowedColumns.includes(column)) {
        const msg = `Column "${column}" not found`
        if (import.meta.env.DEV) console.warn('[Copixi] AI compareValues rejected', { column, values, reason: msg })
        setError(msg); setLastAction(null); setMascotaMood('enojado')
        return msg
      }
      if (!Array.isArray(values) || values.length < 2 || values.length > 5) {
        const msg = 'values must be array of 2-5 strings'
        if (import.meta.env.DEV) console.warn('[Copixi] AI compareValues rejected', { column, values, reason: msg })
        setError(msg); setLastAction(null); setMascotaMood('enojado')
        return msg
      }
      const m = String(metric ?? 'sales')
      if (!['sales', 'units', 'customers'].includes(m)) {
        const msg = `metric must be one of sales, units, customers`
        if (import.meta.env.DEV) console.warn('[Copixi] AI compareValues rejected', { column, values, metric: m, reason: msg })
        setError(msg); setLastAction(null); setMascotaMood('enojado')
        return msg
      }
      const _data = filteredRows.length ? filteredRows : rawRows ?? []
      const groups = values.map((v) => {
        const sum = _data.filter((r) => String(r[column]) === String(v)).reduce((a, r) => a + (Number(r[m]) || 0), 0)
        return `${v}: $${sum.toLocaleString()}`
      })
      setLastAction(null)
      setMascotaMood('feliz')
      return `Comparison for ${column} (${m}) — ${groups.join(' | ')}`
    },
  })

  useFrontendTool({
    name: 'showInsight',
    description: 'Generate an insight message to display in the dashboard',
    parameters: z.object({
      insight: z.string().describe('Insight text (max 600 chars)'),
    }),
    handler: async ({ insight }) => {
      setMascotaMood('duda')
      if (!insight || String(insight).length > 600) {
        const msg = 'Insight empty or too long (max 600)'
        if (import.meta.env.DEV) console.warn('[Copixi] AI showInsight rejected', { insight, reason: msg })
        setError(msg); setMascotaMood('enojado')
        return msg
      }
      setInsightLog((prev) => [...prev.slice(-4), String(insight)])
      setLastAction(null)
      setMascotaMood('feliz')
      return `Insight recorded: ${insight}`
    },
  })

  useFrontendTool({
    name: 'sortData',
    description: 'Sort the data table by a column. direction: asc or desc.',
    parameters: z.object({
      column: z.string().describe(`Column to sort by: ${allowedColumns.join(', ')}`),
      direction: z.string().describe('asc or desc'),
    }),
    handler: async ({ column, direction }) => {
      setMascotaMood('guino')
      setLastAction(`Sorting table by ${column} ${direction}…`)
      if (!allowedColumns.includes(column)) {
        const msg = `Column "${column}" not found`
        if (import.meta.env.DEV) console.warn('[Copixi] AI sortData rejected', { column, reason: msg })
        setError(msg); setLastAction(null); setMascotaMood('enojado')
        return msg
      }
      const dir = direction === 'desc' ? 'desc' : 'asc'
      setSort(column, dir)
      setLastAction(null)
      setMascotaMood('feliz')
      return `Table sorted by ${column} ${dir}`
    },
  })

  useFrontendTool({
    name: 'searchData',
    description: 'Search all columns in the data table for a query string.',
    parameters: z.object({
      query: z.string().describe('Search query'),
    }),
    handler: async ({ query }) => {
      setMascotaMood('guino')
      setLastAction(`Searching for "${query}"…`)
      setSearch(String(query))
      setLastAction(null)
      setMascotaMood('feliz')
      return `Search applied: "${query}"`
    },
  })

  useFrontendTool({
    name: 'explainColumn',
    description: 'Explain a column: type, null %, distinct count, min/max, sample values.',
    parameters: z.object({
      column: z.string().describe(`Column name from: ${allowedColumns.join(', ') || 'no dataset loaded'}`),
    }),
    handler: async ({ column }) => {
      setMascotaMood('duda')
      setLastAction(`Explaining column ${column}…`)
      if (!allowedColumns.includes(column)) {
        const msg = `Column "${column}" not found`
        if (import.meta.env.DEV) console.warn('[Copixi] AI explainColumn rejected', { column, reason: msg })
        setError(msg); setLastAction(null); setMascotaMood('enojado')
        return msg
      }
      const col = columns.find((c) => c.name === column)
      if (!col) {
        setLastAction(null)
        setMascotaMood('duda')
        return `Column ${column} not found`
      }
      const nullPct = nullPercentages[column] ?? 0
      const explanation = `${col.name}: type=${col.type}, distinct=${col.distinctCount}, nulls=${nullPct}%, min=${col.min ?? 'n/a'}, max=${col.max ?? 'n/a'}, samples=${(col.sampleValues ?? []).slice(0, 3).join(', ')}`
      setLastAction(null)
      setMascotaMood('feliz')
      return explanation
    },
  })

  useFrontendTool({
    name: 'getTopCategories',
    description: 'Get top N values for a categorical column by sales. n is 3-10.',
    parameters: z.object({
      column: z.string().describe(`Categorical column from: ${allowedColumns.join(', ') || 'no dataset loaded'}`),
      n: z.number().describe('How many top values (3-10)'),
    }),
    handler: async ({ column, n }) => {
      setMascotaMood('duda')
      setLastAction(`Getting top ${n} ${column}…`)
      if (!allowedColumns.includes(column)) {
        const msg = `Column "${column}" not found`
        if (import.meta.env.DEV) console.warn('[Copixi] AI getTopCategories rejected', { column, reason: msg })
        setError(msg); setLastAction(null); setMascotaMood('enojado')
        return msg
      }
      const top = (topCategories[column] ?? []).slice(0, Math.min(10, Math.max(3, Number(n) || 5)))
      const text = top.map((t, i) => `${i + 1}. ${t.name}: $${t.value.toLocaleString()}`).join('\n')
      setLastAction(null)
      setMascotaMood('feliz')
      mascotaSpeak(`Top ${top.length} ${column} by sales`)
      return `Top ${top.length} ${column} by sales:\n${text}`
    },
  })

  useFrontendTool({
    name: 'ragQuery',
    description: 'Semantic search across dataset rows. Use this for vague questions like "what do you see", "find rows about X", "search for Y". Returns top-K matching rows as snippets.',
    parameters: z.object({
      query: z.string().describe('Natural language search query'),
      topK: z.number().optional().describe('Number of results (1-5, default 3)'),
    }),
    handler: async ({ query, topK }) => {
      setMascotaMood('duda')
      setLastAction(`Searching semantically: "${query}"…`)
      const k = Math.min(5, Math.max(1, Number(topK) || 3))
      const hits = await ragQuery(query, k)
      if (!hits || hits.length === 0) {
        setLastAction(null); setMascotaMood('duda')
        return 'No matching rows found for that query.'
      }
      const snippets = hits.map((h, i) => `${i + 1}. [${h.score.toFixed(2)}] ${h.snippet}`).join('\n')
      setLastAction(null); setMascotaMood('feliz')
      mascotaSpeak(`Found ${hits.length} matching rows`)
      return `Semantic search results for "${query}":\n${snippets}`
    },
  })

  const handleTryDemo = () => {
    setLastAction('Loading demo data…')
    window.dispatchEvent(new Event('copixi:try-demo'))
  }

  if (!rawRows) {
    return (
      <div className="empty">
        <i className="pixelart-icons-font-message" aria-hidden /> Load a dataset first — then ask Copixi.
        <div style={{ marginTop: 12 }}>
          <button className="btn btn-secondary small" type="button" onClick={handleTryDemo}>
            <i className="pixelart-icons-font-play" aria-hidden /> Try demo data
          </button>
        </div>
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

      {suggestedQuestions.length > 0 && (
        <div className="smart-suggestions" aria-label="Suggested questions">
          {suggestedQuestions.map((q, i) => (
            <button key={i} className="suggestion-chip" type="button" onClick={() => {
              const chatInput = document.querySelector('.copilot-chat-wrap input') as HTMLInputElement | null
              if (chatInput) {
                chatInput.value = q
                chatInput.dispatchEvent(new Event('input', { bubbles: true }))
                chatInput.focus()
              }
            }}>{q}</button>
          ))}
        </div>
      )}

      <div className="copilot-chat-wrap">
        <CopilotChat
          agentId="default"
          labels={{
            welcomeMessageText: 'Hi! I can filter, compare, change charts, sort/search data, explain columns, and suggest insights. Try: "Show me sales from Bogotá" or "Explain the city column"',
          }}
        />
      </div>

      <div className="copilot-footer">
        <span style={{ fontSize: 11, color: 'var(--color-muted)' }}>AI sends only aggregated context, never raw rows (§8). Actions are validated before execution.</span>
      </div>
    </div>
  )
}
