import type { Row, ColumnMeta } from '../data/types'

export type EmbeddingStatus = 'idle' | 'loading' | 'ready' | 'error'

const MAX_ROWS = 500
const MODEL = 'Xenova/all-MiniLM-L6-v2'

let pipeline: any = null
let cache = new Map<number, Float32Array>()
let status: EmbeddingStatus = 'idle'
let onProgress: ((p: number) => void) | null = null

export function getEmbeddingStatus(): EmbeddingStatus {
  return status
}

export function setProgressListener(fn: (p: number) => void) {
  onProgress = fn
}

function rowText(r: Row, cols: ColumnMeta[]): string {
  return cols.map((c) => `${c.name}=${r[c.name] ?? ''}`).join(', ')
}

export async function generateEmbeddings(rows: Row[], columns: ColumnMeta[], onProgressCb?: (p: number) => void): Promise<Map<number, Float32Array>> {
  status = 'loading'
  onProgress = onProgressCb ?? null
  const target = rows.slice(0, MAX_ROWS)
  if (!pipeline) {
    const { pipeline: p } = await import('@xenova/transformers')
    pipeline = await p('feature-extraction', MODEL, { progress_callback: (p: any) => {
      if (p.status === 'progress' && onProgress) onProgress(p.progress ?? 0)
    } })
  }
  cache.clear()
  const BATCH = 32
  for (let i = 0; i < target.length; i += BATCH) {
    const batch = target.slice(i, i + BATCH)
    const texts = batch.map((r) => rowText(r, columns))
    try {
      const outputs = await pipeline(texts, { pooling: 'mean', normalize: true })
      for (let j = 0; j < batch.length; j++) {
        const slice = outputs.dims.length > 1 ? outputs.data.slice(j * outputs.dims[1], (j + 1) * outputs.dims[1]) : outputs.data
        const arr = Array.from(slice as unknown as number[])
        cache.set(i + j, new Float32Array(arr))
      }
    } catch (err) {
      console.warn('[Embeddings] batch failed', i, err)
    }
    if (onProgress) onProgress(Math.min(1, (i + BATCH) / target.length))
  }
  status = 'ready'
  return cache
}

export function getCache(): Map<number, Float32Array> {
  return cache
}

export function cosineSim(a: Float32Array, b: Float32Array): number {
  let dot = 0, na = 0, nb = 0
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i] }
  const denom = Math.sqrt(na) * Math.sqrt(nb)
  return denom === 0 ? 0 : dot / denom
}

export async function embedQuery(text: string): Promise<Float32Array> {
  if (!pipeline) {
    const { pipeline: p } = await import('@xenova/transformers')
    pipeline = await p('feature-extraction', MODEL)
  }
  const output = await pipeline(text, { pooling: 'mean', normalize: true })
  const slice = output.dims.length > 1 ? output.data.slice(0, output.dims[1]) : output.data
  const arr = Array.from(slice as unknown as number[])
  return new Float32Array(arr)
}
