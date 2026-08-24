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
 * Supports Excel (.xlsx, .xls) as well as CSV (.csv) and TSV (.tsv).
 */
export async function parseAnyFile(file: File): Promise<UniversalParseResult> {
  const ext = extOf(file.name)
  if (['.csv', '.tsv'].includes(ext)) {
    const { rows, errors } = await parseCSV(file)
    if (errors.length) console.warn('[Copixi] CSV errors', errors)
    if (!rows.length) throw new Error('El archivo CSV/TSV está vacío o no contiene filas válidas')
    return { rows: rows as unknown as Row[], source: 'csv' }
  }
  if (['.xlsx', '.xls'].includes(ext)) {
    const rows = await parseExcel(file)
    return { rows, source: 'excel' }
  }
  throw new Error(`Tipo no soportado "${ext}". Usa un archivo Excel (.xlsx, .xls) o CSV / TSV (.csv, .tsv).`)
}

export function validateAnyFile(file: File, maxSizeMB = 25): { valid: boolean; error?: string } {
  const ext = extOf(file.name.toLowerCase())
  const allowed = new Set(['.xlsx', '.xls', '.csv', '.tsv'])
  if (!allowed.has(ext)) {
    return { valid: false, error: `Formato no soportado "${ext}". Por favor sube un archivo Excel (.xlsx, .xls) o CSV (.csv, .tsv)` }
  }
  if (file.size === 0) return { valid: false, error: 'El archivo está vacío.' }
  if (file.size > maxSizeMB * 1024 * 1024) return { valid: false, error: `El archivo es muy pesado (máximo ${maxSizeMB} MB).` }
  return { valid: true }
}
