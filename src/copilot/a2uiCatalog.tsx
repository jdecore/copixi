import { lazy, Suspense } from 'react'
import { createCatalog } from '@copilotkit/a2ui-renderer'
import { z } from 'zod'

/**
 * A2UI catalog — native Copixi UI surfaces the agent can render instead of
 * plain text. Themed with the app's design language (see src/index.css).
 *
 * Chart components are lazy-loaded (React.lazy) so Recharts stays out of the
 * initial bundle and is only fetched when the agent emits a chart surface.
 */

const AreaChartCard = lazy(() =>
  import('./A2uiChart').then((m) => ({ default: m.AreaChartCard })),
)
const BarChartCard = lazy(() =>
  import('./A2uiChart').then((m) => ({ default: m.BarChartCard })),
)

const chartPoint = z.object({
  name: z.string().describe('X axis / category label'),
  value: z.number().describe('Y axis numeric value'),
})

const definitions = {
  InsightCard: {
    description: 'A highlighted insight or recommendation for the dashboard.',
    props: z.object({
      title: z.string().describe('Short title for the insight'),
      body: z.string().describe('Insight or recommendation text'),
      tone: z.enum(['info', 'success', 'warning']).optional().describe('Visual tone'),
    }),
  },
  KpiStat: {
    description: 'A single KPI statistic with a label and a value.',
    props: z.object({
      label: z.string().describe('Metric label'),
      value: z.string().describe('Formatted value, e.g. "$1,234"'),
      delta: z.string().optional().describe('Change vs previous period'),
    }),
  },
  AreaChartCard: {
    description:
      'A trend area chart. Pass title and data as an array of { name, value } points (e.g. a monthly time series). Use for trends over time.',
    props: z.object({
      title: z.string().describe('Chart title'),
      data: z.array(chartPoint).describe('Array of { name, value } points'),
      yLabel: z.string().optional().describe('Optional Y axis label'),
    }),
  },
  BarChartCard: {
    description:
      'A bar chart for comparisons. Pass title and data as an array of { name, value } points (e.g. sales by city or by category).',
    props: z.object({
      title: z.string().describe('Chart title'),
      data: z.array(chartPoint).describe('Array of { name, value } points'),
      yLabel: z.string().optional().describe('Optional Y axis label'),
    }),
  },
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const renderers: any = {
  InsightCard: ({ props }: { props: any }) => (
    <div className={`insight ai-insight a2ui-insight tone-${props.tone ?? 'info'}`}>
      <i className="pixelart-icons-font-lightbulb" aria-hidden />
      <div>
        <strong>{props.title}</strong>
        <div>{props.body}</div>
      </div>
    </div>
  ),
  KpiStat: ({ props }: { props: any }) => (
    <div className="kpi-card a2ui-kpi">
      <span className="kpi-label">{props.label}</span>
      <span className="kpi-value">{props.value}</span>
      {props.delta ? <span className="kpi-delta">{props.delta}</span> : null}
    </div>
  ),
  AreaChartCard: ({ props }: { props: any }) => (
    <Suspense fallback={<div className="skeleton" style={{ width: '100%', height: 240 }} />}>
      <AreaChartCard title={props.title} data={props.data ?? []} yLabel={props.yLabel} />
    </Suspense>
  ),
  BarChartCard: ({ props }: { props: any }) => (
    <Suspense fallback={<div className="skeleton" style={{ width: '100%', height: 240 }} />}>
      <BarChartCard title={props.title} data={props.data ?? []} yLabel={props.yLabel} />
    </Suspense>
  ),
}

export const a2uiCatalog = createCatalog(definitions, renderers, {
  includeBasicCatalog: true,
})

export const a2uiTheme = { colors: { primary: '#6366f1' } }
