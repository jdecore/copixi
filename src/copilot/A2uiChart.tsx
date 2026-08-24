import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts'

export type ChartPoint = { name: string; value: number }

/**
 * A2UI chart surfaces rendered by CopilotKit. Lazy-loaded so Recharts stays
 * out of the initial bundle (only fetched when the agent emits a chart).
 * Themed with Copixi tokens (--color-primary, --color-surface, ...).
 */

export function AreaChartCard({
  title,
  data,
  yLabel,
}: {
  title?: string
  data: ChartPoint[]
  yLabel?: string
}) {
  return (
    <div className="a2ui-chart">
      {title ? <div className="a2ui-chart-title">{title}</div> : null}
      <ResponsiveContainer width="100%" height={240}>
        <AreaChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} width={48} />
          <Tooltip />
          <Area
            type="monotone"
            dataKey="value"
            name={yLabel ?? 'value'}
            stroke="var(--color-primary)"
            fill="var(--color-primary)"
            fillOpacity={0.15}
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

export function BarChartCard({
  title,
  data,
  yLabel,
}: {
  title?: string
  data: ChartPoint[]
  yLabel?: string
}) {
  return (
    <div className="a2ui-chart">
      {title ? <div className="a2ui-chart-title">{title}</div> : null}
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} width={48} />
          <Tooltip />
          <Bar
            dataKey="value"
            name={yLabel ?? 'value'}
            fill="var(--color-primary)"
            radius={[6, 6, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
