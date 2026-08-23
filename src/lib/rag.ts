import type { Row, ColumnMeta } from '../data/types'
import { generateEmbeddings, getCache, cosineSim, embedQuery, type EmbeddingStatus } from './embeddings'

export interface RagHit {
  index: number
  row: Row
  score: number
  snippet: string
}

export interface RagResult {
  query: string
  hits: RagHit[]
  status: EmbeddingStatus
  totalRows: number
}

export async function ragSearch(
  rows: Row[],
  columns: ColumnMeta[],
  query: string,
  topK = 3,
  onProgress?: (p: number) => void
): Promise<RagResult> {
  const target = rows.slice(0, 500)
  const cache = getCache()
  if (cache.size === 0 || cache.size !== target.length) {
    await generateEmbeddings(rows, columns, onProgress)
  }
  const qEmb = await embedQuery(query)
  const scored: RagHit[] = []
  for (const [idx, emb] of cache) {
    const score = cosineSim(qEmb, emb)
    const row = target[idx] ?? rows[idx] ?? {}
    const snippet = columns.slice(0, 4).map((c) => `${c.name}=${row[c.name] ?? ''}`).join(', ')
    scored.push({ index: idx, row, score, snippet })
  }
  scored.sort((a, b) => b.score - a.score)
  return { query, hits: scored.slice(0, topK), status: 'ready', totalRows: target.length }
}
