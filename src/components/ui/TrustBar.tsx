export function TrustBar() {
  return (
    <div className="card" style={{ marginTop: 16, background: 'var(--color-surface)', display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px' }} aria-label="Trust signals">
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', fontSize: 12, color: 'var(--color-muted)' }}>
        <span style={{ fontWeight: 700, color: 'var(--color-text)', fontSize: 13 }}>Trusted stack</span>
        <span className="badge">React 19</span>
        <span className="badge">TypeScript</span>
        <span className="badge">Vite + pnpm</span>
        <span className="badge">Radix UI</span>
        <span className="badge">Recharts</span>
        <span className="badge">Gemini + Vercel</span>
        <span className="badge">Vercel</span>
      </div>
      <div style={{ fontSize: 11, color: 'var(--color-muted)', maxWidth: 360 }}>
        Frontend-first · 0$ infra · Privacy by design · Validated AI actions · a11y AA — <strong style={{ color: 'var(--color-text)' }}>Portfolio-grade, production-ready</strong>
      </div>
    </div>
  )
}
