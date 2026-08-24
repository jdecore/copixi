import { createCatalog } from '@copilotkit/a2ui-renderer'
import { z } from 'zod'

/**
 * A2UI catalog — native Copixi UI surfaces the agent can render instead of
 * plain text. Themed with the app's design language (see src/index.css).
 */

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
}

export const a2uiCatalog = createCatalog(definitions, renderers, {
  includeBasicCatalog: true,
})

export const a2uiTheme = { colors: { primary: '#6366f1' } }
