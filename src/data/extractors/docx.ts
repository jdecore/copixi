import type { Row } from '../types'

function heuristicTableParse(text: string): Row[] | null {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  if (lines.length < 2) return null
  // Detect delimiter per line: tab, comma, 2+ spaces, |
  const delimScores = (line: string) => {
    if (line.includes('\t')) return '\t'
    if (line.includes('|')) return '|'
    if ((line.match(/,/g) ?? []).length >= 1 && line.split(',').length >= 2) return ','
    if (/\s{2,}/.test(line)) return 'spaces'
    return null
  }
  const firstDelim = delimScores(lines[0])
  if (!firstDelim) return null
  // All lines should share same delim
  const consistent = lines.slice(0, 5).every((l) => delimScores(l) === firstDelim)
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

export async function parseDocx(file: File): Promise<{ rows: Row[] | null; text: string }> {
  const mammoth = await import('mammoth')
  const buf = await file.arrayBuffer()
  const result = await mammoth.extractRawText({ arrayBuffer: buf })
  const text = result.value ?? ''
  if (!text.trim()) throw new Error('DOCX has no readable text')
  const rows = heuristicTableParse(text)
  return { rows, text }
}

export function truncateForGemini(text: string, maxChars = 8000): string {
  if (text.length <= maxChars) return text
  return text.slice(0, maxChars) + '\n[...truncated]'
}
