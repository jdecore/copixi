/** Export utilities — client-side only (Blob), no backend (§6) */
import type { Row } from './types'

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

function escapeCSV(value: unknown): string {
  const s = String(value ?? '')
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export function exportRowsCSV(rows: Row[], filename = 'copixi-export.csv'): void {
  if (!rows.length) return
  const cols = Object.keys(rows[0])
  const header = cols.map(escapeCSV).join(',')
  const lines = rows.map((r) => cols.map((c) => escapeCSV(r[c])).join(','))
  const csv = [header, ...lines].join('\n')
  downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), filename)
}

export function exportRowsJSON(rows: Row[], filename = 'copixi-export.json'): void {
  downloadBlob(new Blob([JSON.stringify(rows, null, 2)], { type: 'application/json' }), filename)
}

/** Export a chart container as PNG — serializes SVG inside Recharts ResponsiveContainer */
export async function exportChartPNG(container: HTMLElement, filename = 'copixi-chart.png'): Promise<void> {
  const svg = container.querySelector('svg')
  if (!svg) {
    // Fallback: text canvas
    const canvas = document.createElement('canvas')
    canvas.width = 800; canvas.height = 400
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = '#0f172a'; ctx.font = '14px sans-serif'
    ctx.fillText('Copixi — no chart SVG found for PNG export', 20, 40)
    canvas.toBlob((b) => b && downloadBlob(b, filename), 'image/png')
    return
  }
  const clone = svg.cloneNode(true) as SVGElement
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  const style = getComputedStyle(svg)
  const w = parseInt(style.width) || svg.clientWidth || 800
  const h = parseInt(style.height) || 260
  clone.setAttribute('width', String(w))
  clone.setAttribute('height', String(h))
  const serializer = new XMLSerializer()
  const svgStr = serializer.serializeToString(clone)
  const svgBlob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(svgBlob)
  const img = new Image()
  img.onload = () => {
    const canvas = document.createElement('canvas')
    canvas.width = w * 2; canvas.height = h * 2
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    canvas.toBlob((b) => { if (b) downloadBlob(b, filename); URL.revokeObjectURL(url) }, 'image/png')
  }
  img.onerror = () => URL.revokeObjectURL(url)
  img.src = url
}
