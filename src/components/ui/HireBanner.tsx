import { useEffect, useState } from 'react'

const KEY = 'copixi:hire-banner-dismissed'

export function HireBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (typeof localStorage === 'undefined') return
    const dismissed = localStorage.getItem(KEY)
    if (!dismissed) setVisible(true)
  }, [])

  if (!visible) return null

  const dismiss = () => {
    localStorage.setItem(KEY, '1')
    setVisible(false)
  }

  return (
    <div role="banner" aria-label="Available for hire" style={{
      background: '#0f172a', color: 'white', padding: '10px 16px',
      display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'center',
      flexWrap: 'wrap', fontSize: 13, position: 'sticky', top: 0, zIndex: 40,
      borderBottom: '1px solid #1e293b'
    }}>
      <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <span aria-hidden>◈</span>
        <strong>Copixi</strong> — Built by Juan Xi · <span style={{ opacity: 0.9 }}>Available for hire — Product Engineer (React/TS/AI)</span>
        <span style={{ background: '#1e293b', border: '1px solid #334155', padding: '2px 8px', borderRadius: 999, fontSize: 11, marginLeft: 6 }}>Frontend-first · AI-native · 0$ infra</span>
      </span>
      <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
        <a href="https://linkedin.com/in/tu-perfil" target="_blank" rel="noreferrer" style={{ background: 'white', color: '#0f172a', padding: '6px 12px', borderRadius: 8, fontWeight: 700, textDecoration: 'none', fontSize: 12 }}>LinkedIn — Hablemos</a>
        <a href="mailto:tu-email@dominio.com" style={{ background: 'transparent', color: 'white', border: '1px solid #334155', padding: '6px 12px', borderRadius: 8, fontWeight: 600, textDecoration: 'none', fontSize: 12 }}>Email</a>
        <button onClick={dismiss} aria-label="Dismiss hire banner" style={{ background: 'transparent', color: '#94a3b8', border: 0, cursor: 'pointer', fontSize: 16, padding: '2px 6px' }}>×</button>
      </span>
    </div>
  )
}
