import type { ReactNode } from 'react'

type Props = {
  title: string
  icon?: string
  action?: ReactNode
  children: ReactNode
  empty?: string | null
}

export function ChartCard({ title, icon, action, children, empty }: Props) {
  return (
    <div className="card">
      <div className="card-head">
        <h3>{icon ? <i className={icon} aria-hidden /> : null} {title}</h3>
        {action}
      </div>
      {empty ? <div className="empty">{empty}</div> : children}
    </div>
  )
}
