/** Report generation — client-side markdown (§32 P2) */
import type { Row, Metrics } from './types'

export function generateMarkdownReport(params: {
  fileName: string
  rowCount: number
  filteredCount: number
  metrics: Metrics | null
  filteredRows: Row[]
  byCity: { name: string; value: number }[]
  byCategory: { name: string; value: number }[]
  byProduct: { name: string; value: number }[]
  timeSeries: { date: string; value: number }[]
  filters: { column: string; operator: string; value: unknown }[]
}): string {
  const { fileName, rowCount, filteredCount, metrics, byCity, byCategory, byProduct, timeSeries, filters } = params
  const lines: string[] = []
  lines.push(`# Copixi Report — ${fileName}`)
  lines.push(`Generated: ${new Date().toLocaleString()}`)
  lines.push('')
  lines.push(`**Rows:** ${rowCount} total · ${filteredCount} filtered`)
  if (filters.length) lines.push(`**Filters:** ${filters.map((f) => `${f.column} ${f.operator} ${String(f.value)}`).join(', ')}`)
  else lines.push('**Filters:** none')
  lines.push('')
  if (metrics) {
    lines.push('## KPIs (filtered)')
    lines.push(`- Total sales: $${metrics.totalSales.toLocaleString()}`)
    lines.push(`- Avg sales: $${metrics.avgSales.toFixed(2)}`)
    lines.push(`- Total units: ${metrics.totalUnits.toLocaleString()}`)
    lines.push(`- Total customers: ${metrics.totalCustomers.toLocaleString()}`)
    lines.push('')
  }
  if (timeSeries.length) {
    lines.push('## Trend — monthly sales')
    for (const t of timeSeries) lines.push(`- ${t.date}: $${t.value.toLocaleString()}`)
    lines.push('')
  }
  if (byCity.length) {
    lines.push('## Sales by city (top)')
    for (const b of byCity.slice(0, 5)) lines.push(`- ${b.name}: $${b.value.toLocaleString()}`)
    lines.push('')
  }
  if (byCategory.length) {
    lines.push('## Sales by category')
    for (const b of byCategory) lines.push(`- ${b.name}: $${b.value.toLocaleString()}`)
    lines.push('')
  }
  if (byProduct.length) {
    lines.push('## Sales by product (top)')
    for (const b of byProduct.slice(0, 5)) lines.push(`- ${b.name}: $${b.value.toLocaleString()}`)
    lines.push('')
  }
  lines.push('---')
  lines.push('*Generated locally — data never left your browser (§8).*')
  return lines.join('\n')
}

export function downloadText(filename: string, content: string, mime = 'text/markdown'): void {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}
