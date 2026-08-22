import { Component, type ReactNode } from 'react'

type Props = { children: ReactNode }
type State = { hasError: boolean; error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }
  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }
  componentDidCatch(error: Error) {
    if (import.meta.env.DEV) console.error('[Copixi] ErrorBoundary', error)
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="empty" role="alert" style={{ margin: 24 }}>
          <h3 style={{ margin: 0 }}><i className="pixelart-icons-font-alert" aria-hidden /> Something went wrong</h3>
          <p style={{ color: 'var(--color-muted)', fontSize: 13, margin: '8px 0 12px' }}>
            {this.state.error?.message ?? 'Unknown error'}. Try reloading or use demo data.
          </p>
          <button className="btn btn-secondary" onClick={() => this.setState({ hasError: false, error: null })} type="button">Try again</button>
        </div>
      )
    }
    return this.props.children
  }
}
