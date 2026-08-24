import type { Row } from '../types'

export async function parseExcel(file: File): Promise<Row[]> {
  const XLSX = await import('xlsx')
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array', cellDates: true })
  const firstSheet = wb.SheetNames[0]
  if (!firstSheet) throw new Error('Excel has no sheets')
  const sheet = wb.Sheets[firstSheet]
  // header:1 to preserve raw, then use sheet_to_json with header row
  const json = XLSX.utils.sheet_to_json<Row>(sheet, { defval: null, raw: false })
  // sheet_to_json keeps strings; filter empty rows
  const rows = json.filter((r) => Object.values(r).some((v) => v !== null && v !== '' && v !== undefined))
  if (!rows.length) throw new Error('Excel sheet is empty or has no valid rows')
  return rows
}
