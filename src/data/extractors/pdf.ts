import type { Row } from '../types'

// pdfjs-dist v6: ESM, needs worker. We use workerSrc from CDN fallback or bundled.
function heuristicTableParse(text: string): Row[] | null {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  if (lines.length < 2) return null
  const delimScores = (line: string) => {
    if (line.includes('\t')) return '\t'
    if (line.includes('|')) return '|'
    if ((line.match(/,/g) ?? []).length >= 1 && line.split(',').length >= 2) return ','
    if (/\s{2,}/.test(line)) return 'spaces'
    return null
  }
  const firstDelim = delimScores(lines[0])
  if (!firstDelim) return null
  const consistent = lines.slice(0, 6).every((l) => delimScores(l) === firstDelim)
  if (!consistent) return null
  const split = (l: string) => firstDelim === 'spaces' ? l.split(/\s{2,}/) : l.split(firstDelim as string)
  const header = split(lines[0]).map((h) => h.trim()).filter(Boolean)
  if (header.length < 2) return null
  const rows: Row[] = []
  for (let i = 1; i < lines.length; i++) {
    const cols = split(lines[i]).map((c) => c.trim())
    if (cols.length !== header.length) continue
    const row: Row = {}
    header.forEach((h, idx) => { row[h] = cols[idx] ?? null })
    rows.push(row)
  }
  if (rows.length < 2) return null
  return rows
}

export async function parsePdf(file: File): Promise<{ rows: Row[] | null; text: string }> {
  const pdfjs = await import('pdfjs-dist')
  // Set workerSrc to bundled worker (pdfjs 6 ships as ESM)
  // Use legacy worker entry if available
  try {
    const workerUrl = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`
    // @ts-ignore
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl
  } catch {}
  const buf = await file.arrayBuffer()
  const doc = await pdfjs.getDocument({ data: buf }).promise
  let fullText = ''
  const maxPages = Math.min(doc.numPages, 20) // token limit: 20 pages max
  for (let i = 1; i <= maxPages; i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    const pageText = content.items.map((it: any) => (it as { str: string }).str ?? '').join(' ')
    fullText += pageText + '\n'
  }
  fullText = fullText.trim()
  if (!fullText) throw new Error('PDF has no extractable text (scanned image?)')
  const rows = heuristicTableParse(fullText)
  return { rows, text: fullText }
}

export function truncateForGemini(text: string, maxChars = 8000): string {
  if (text.length <= maxChars) return text
  return text.slice(0, maxChars) + '\n[...truncated]'
}
