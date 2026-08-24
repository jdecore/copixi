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
  if (['.xlsx', '.xls'].includes(ext)) {
    const rows = await parseExcel(file)
    return { rows, source: 'excel' }
  }
  throw new Error(`Tipo no soportado "${ext}". Este asistente está optimizado exclusivamente para archivos Excel (.xlsx, .xls).`)
}

export function validateAnyFile(file: File, maxSizeMB = 20): { valid: boolean; error?: string } {
  const ext = extOf(file.name.toLowerCase())
  const allowed = new Set(['.xlsx', '.xls'])
  if (!allowed.has(ext)) {
    return { valid: false, error: `Formato no soportado "${ext}". Por favor sube un archivo Excel (.xlsx o .xls)` }
  }
  if (file.size === 0) return { valid: false, error: 'El archivo está vacío.' }
  if (file.size > maxSizeMB * 1024 * 1024) return { valid: false, error: `El archivo es muy pesado (máximo ${maxSizeMB} MB).` }
  return { valid: true }
}
