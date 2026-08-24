import { parseCSV } from './parser'
import type { Row } from './types'
import { parseExcel } from './extractors/excel'

export type UniversalParseResult =
  | { rows: Row[]; source: 'csv' | 'excel' | 'heuristic'; text?: string }
  | { rows: null; needsGemini: true; text: string; filename: string; hint: string }

function extOf(name: string): string {
  const i = name.lastIndexOf('.')
  return i >= 0 ? name.slice(i).toLowerCase() : ''
}

/**
 * Universal parser — frontend-first (§6), pure browser.
 * Returns rows directly when deterministic, or truncated text for Gemini JSON extraction (§8, tokens mínimos).
 */
export async function parseAnyFile(file: File): Promise<UniversalParseResult> {
  const ext = extOf(file.name)
  if (['.csv', '.tsv'].includes(ext)) {
    const { rows, errors } = await parseCSV(file)
    if (errors.length) console.warn('[Copixi] CSV errors', errors)
    if (!rows.length) throw new Error('CSV is empty or has no valid rows')
    return { rows: rows as unknown as Row[], source: 'csv' }
  }
  if (['.xlsx', '.xls'].includes(ext)) {
    const rows = await parseExcel(file)
    return { rows, source: 'excel' }
  }
  if (ext === '.docx') {
    const { parseDocx, truncateForGemini } = await import('./extractors/docx')
    const { rows, text } = await parseDocx(file)
    if (rows && rows.length) return { rows, source: 'heuristic', text }
    // Fallback: Gemini JSON extraction with truncated text (token-efficient)
    return { rows: null, needsGemini: true, text: truncateForGemini(text, 6000), filename: file.name, hint: 'docx' }
  }
  if (ext === '.doc') {
    throw new Error('.doc (Word 97-2003) not supported — export to .docx')
  }
  if (ext === '.pdf') {
    const { parsePdf, truncateForGemini } = await import('./extractors/pdf')
    const { rows, text } = await parsePdf(file)
    if (rows && rows.length) return { rows, source: 'heuristic', text }
    return { rows: null, needsGemini: true, text: truncateForGemini(text, 6000), filename: file.name, hint: 'pdf' }
  }
  throw new Error(`Unsupported file type "${ext}". Allowed: .csv, .tsv, .xlsx, .xls, .pdf, .docx`)
}

export function validateAnyFile(file: File, maxSizeMB = 15): { valid: boolean; error?: string } {
  const ext = extOf(file.name.toLowerCase())
  const allowed = new Set(['.csv', '.tsv', '.xlsx', '.xls', '.pdf', '.docx'])
  if (!allowed.has(ext)) {
    return { valid: false, error: `Tipo no soportado "${ext}". Usa .csv, .xlsx, .pdf o .docx` }
  }
  if (file.size === 0) return { valid: false, error: 'File is empty.' }
  if (file.size > maxSizeMB * 1024 * 1024) return { valid: false, error: `File too large (max ${maxSizeMB} MB).` }
  return { valid: true }
}
