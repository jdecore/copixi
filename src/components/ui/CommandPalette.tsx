import { useEffect, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { useDashboard } from '../../state/DashboardContext'
import { track } from '../../lib/analytics'

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [idx, setIdx] = useState(0)
  const { rawRows, clearFilters, setActiveChart, filters } = useDashboard()

  useEffect(() => {
    if (open) { setQ(''); setIdx(0) }
  }, [open])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault(); setOpen((v) => !v); track('command_palette_toggle')
      }
      if (e.key === '/' && !open && !(e.target instanceof HTMLInputElement)) {
        const mod = e.metaKey || e.ctrlKey || e.altKey
        if (!mod) { e.preventDefault(); setOpen(true) }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const commands = [
    { id: 'clear', label: 'Clear all filters', icon: 'pixelart-icons-font-trash', run: () => { clearFilters(); track('cmd_clear_filters') }, disabled: !filters.length },
    { id: 'chart-bar-city', label: 'Chart: Bar — city → sales', icon: 'pixelart-icons-font-chart-bar', run: () => { setActiveChart({ chartType: 'bar', x: 'city', y: 'sales' }); track('cmd_chart_bar_city') }, disabled: !rawRows },
    { id: 'chart-line-time', label: 'Chart: Line — date → sales', icon: 'pixelart-icons-font-chart', run: () => { setActiveChart({ chartType: 'line', x: 'date', y: 'sales' }); track('cmd_chart_line') }, disabled: !rawRows },
    { id: 'chart-pie-category', label: 'Chart: Pie — category → sales', icon: 'pixelart-icons-font-chart', run: () => { setActiveChart({ chartType: 'pie', x: 'category', y: 'sales' }); track('cmd_chart_pie') }, disabled: !rawRows },
    { id: 'export', label: 'Export filtered CSV', icon: 'pixelart-icons-font-download', run: () => { document.querySelector<HTMLButtonElement>('[aria-label="Export bar"] button')?.click(); track('cmd_export') }, disabled: !rawRows },
    { id: 'demo', label: 'Load demo data', icon: 'pixelart-icons-font-play', run: () => { window.dispatchEvent(new Event('copixi:try-demo')); track('cmd_demo') }, disabled: false },
  ]

  const filtered = q.trim() ? commands.filter((c) => c.label.toLowerCase().includes(q.toLowerCase())) : commands

  useEffect(() => { setIdx(0) }, [filtered.length])

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setIdx((i) => Math.min(i + 1, filtered.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setIdx((i) => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter') {
      e.preventDefault()
      const cmd = filtered[idx]
      if (cmd && !cmd.disabled) { cmd.run(); setOpen(false); setQ('') }
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button className="btn btn-secondary small" type="button" aria-label="Open command palette (Ctrl+K)" style={{ borderStyle: 'dashed' }}>
          <i className="pixelart-icons-font-search" aria-hidden /> ⌘K
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(2px)' }} />
        <Dialog.Content aria-describedby={undefined} style={{ position: 'fixed', left: '50%', top: '18%', transform: 'translateX(-50%)', background: 'white', borderRadius: 12, width: 'min(560px, 92vw)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-md)', overflow: 'hidden', padding: 0 }}>
          <Dialog.Title style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>Command palette</Dialog.Title>
          <div style={{ padding: 12, borderBottom: '1px solid var(--color-border)', display: 'flex', gap: 8, alignItems: 'center' }}>
            <i className="pixelart-icons-font-search" aria-hidden style={{ color: 'var(--color-muted)' }} />
            <input autoFocus placeholder="Type a command… (e.g. clear, chart, export)" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={handleKey} style={{ flex: 1, border: 0, outline: 'none', fontSize: 14 }} aria-label="Search commands" />
            <span style={{ fontSize: 11, color: 'var(--color-muted)', border: '1px solid var(--color-border)', padding: '2px 6px', borderRadius: 6 }}>ESC</span>
          </div>
          <div style={{ maxHeight: 320, overflowY: 'auto', padding: 8 }}>
            {filtered.length ? filtered.map((c, i) => (
              <button key={c.id} disabled={c.disabled} onClick={() => { if (!c.disabled) { c.run(); setOpen(false); setQ(''); setIdx(0) } }} style={{
                width: '100%', textAlign: 'left', display: 'flex', gap: 10, alignItems: 'center',
                padding: '10px 12px', borderRadius: 8, border: 0, background: i === idx ? '#f1f5f9' : 'white', cursor: c.disabled ? 'not-allowed' : 'pointer',
                opacity: c.disabled ? 0.45 : 1, fontSize: 13, fontWeight: 500
              }}>
                <i className={c.icon} aria-hidden />
                {c.label}
              </button>
            )) : <div style={{ padding: 16, fontSize: 13, color: 'var(--color-muted)', textAlign: 'center' }}>No commands match “{q}”</div>}
          </div>
          <div style={{ padding: '8px 12px', borderTop: '1px solid var(--color-border)', fontSize: 11, color: 'var(--color-muted)', display: 'flex', justifyContent: 'space-between' }}>
            <span>Ctrl+K or / to open · ↑↓ navigate · Enter run</span>
            <span>Frontend-only, no LLM (§7)</span>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
