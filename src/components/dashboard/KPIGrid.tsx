import { useDashboard } from '../../state/DashboardContext'

export function KPIGrid() {
  const { metrics } = useDashboard()
  if (!metrics) return <div className="empty">No metrics — load data.</div>
  return (
    <div className="kpis" aria-label="KPIs">
      <div className="kpi">
        <div className="kpi-label">Total sales</div>
        <div className="kpi-value">${metrics.totalSales.toLocaleString()}</div>
        <div className="kpi-sub">{metrics.rowCount} records</div>
      </div>
      <div className="kpi">
        <div className="kpi-label">Avg sales</div>
        <div className="kpi-value">${metrics.avgSales.toFixed(0)}</div>
        <div className="kpi-sub">per row</div>
      </div>
      <div className="kpi">
        <div className="kpi-label">Total units</div>
        <div className="kpi-value">{metrics.totalUnits.toLocaleString()}</div>
        <div className="kpi-sub">units sold</div>
      </div>
      <div className="kpi">
        <div className="kpi-label">Total customers</div>
        <div className="kpi-value">{metrics.totalCustomers.toLocaleString()}</div>
        <div className="kpi-sub">customers</div>
      </div>
    </div>
  )
}
