import { useMemo, useState } from 'react'
import type { Row } from '../../data/types'
import { useDashboard } from '../../state/DashboardContext'
import { sortBy } from '../../data/transformations'

const PAGE_SIZE = 10

export function DataTable() {
  const { filteredRows, columns, sortCol, sortDir, setSort, searchQuery, setSearch } = useDashboard()
  const [page, setPage] = useState(0)

  const searched = useMemo(() => {
    if (!searchQuery.trim()) return filteredRows
    const q = searchQuery.toLowerCase()
    return filteredRows.filter((r) => Object.values(r).some((v) => String(v ?? '').toLowerCase().includes(q)))
  }, [filteredRows, searchQuery])

  const sorted = useMemo(() => {
    if (!sortCol) return searched
    return sortBy(searched, sortCol, sortDir)
  }, [searched, sortCol, sortDir])

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages - 1)
  const pageRows = useMemo(() => sorted.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE), [sorted, currentPage])

  const handleSort = (col: string) => {
    if (sortCol === col) setSort(col, sortDir === 'asc' ? 'desc' : 'asc')
    else setSort(col, 'asc')
  }

  if (!filteredRows.length && !searchQuery) {
    return <div className="empty">No rows — adjust filters.</div>
  }

  return (
    <div className="card">
      <div className="table-toolbar">
        <h3><i className="pixelart-icons-font-table" aria-hidden /> Data — {sorted.length.toLocaleString()} rows</h3>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            className="filter-input"
            placeholder="Search all columns…"
            value={searchQuery}
            onChange={(e) => { setSearch(e.target.value); setPage(0) }}
            aria-label="Search table"
            style={{ minWidth: 220 }}
          />
          <span className="filter-count">{currentPage * PAGE_SIZE + 1}–{Math.min((currentPage + 1) * PAGE_SIZE, sorted.length)} of {sorted.length}</span>
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table className="table">
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.name}>
                  <button
                    className="th-sort"
                    onClick={() => handleSort(c.name)}
                    type="button"
                    aria-label={`Sort by ${c.name}`}
                    aria-sort={sortCol === c.name ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                  >
                    {c.name}
                    <i className={`pixelart-icons-font-${sortCol === c.name ? (sortDir === 'asc' ? 'chevron-up' : 'chevron-down') : 'chevron-down'}`} aria-hidden style={{ opacity: sortCol === c.name ? 1 : 0.3 }} />
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((r: Row, idx: number) => (
              <tr key={idx}>
                {columns.map((c) => (
                  <td key={c.name} title={String(r[c.name] ?? '')}>{String(r[c.name] ?? '—')}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {sorted.length === 0 && (
        <div className="empty" style={{ marginTop: 12 }}>No matching rows for “{searchQuery}”.</div>
      )}

      <div className="pagination" role="navigation" aria-label="Pagination">
        <button className="btn btn-secondary small" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={currentPage === 0} type="button">Prev</button>
        <span className="page-indicator">Page {currentPage + 1} / {totalPages}</span>
        <button className="btn btn-secondary small" onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={currentPage >= totalPages - 1} type="button">Next</button>
      </div>
    </div>
  )
}
