import { useState } from 'react'
import * as Select from '@radix-ui/react-select'
import * as Tooltip from '@radix-ui/react-tooltip'
import { useDashboard } from '../../state/DashboardContext'
import type { FilterOperator } from '../../data/types'

const OPS: { value: FilterOperator; label: string }[] = [
  { value: 'equals', label: 'equals' },
  { value: 'contains', label: 'contains' },
  { value: 'gt', label: '>' },
  { value: 'lt', label: '<' },
  { value: 'between', label: 'between' },
]

export function FilterBar() {
  const { columns, filters, addFilter, removeFilter, clearFilters, filteredRows, rawRows } = useDashboard()
  const [col, setCol] = useState('')
  const [op, setOp] = useState<FilterOperator>('equals')
  const [val, setVal] = useState('')
  const [val2, setVal2] = useState('')

  if (!rawRows) return null

  const canAdd = col && val.trim() !== '' && (op !== 'between' || val2.trim() !== '')

  const handleAdd = () => {
    if (!canAdd) return
    addFilter({ column: col, operator: op, value: val.trim(), value2: op === 'between' ? val2.trim() : undefined })
    setVal('')
    setVal2('')
  }

  const distinctForColumn = (() => {
    if (!col || !rawRows) return [] as string[]
    const set = new Set(rawRows.map((r) => String(r[col] ?? '')).filter(Boolean))
    return [...set].slice(0, 50)
  })()

  return (
    <div className="filter-bar" role="region" aria-label="Filters">
      <div className="filter-bar-title">
        <h3><i className="pixelart-icons-font-filter" aria-hidden /> Filters</h3>
        <span className="filter-count">{filteredRows.length} / {rawRows.length} rows</span>
      </div>

      <div className="filter-controls">
        {/* Column */}
        <Select.Root value={col} onValueChange={setCol}>
          <Select.Trigger className="select-trigger" aria-label="Select column">
            <Select.Value placeholder="Column" />
            <Select.Icon><i className="pixelart-icons-font-chevron-down" aria-hidden /></Select.Icon>
          </Select.Trigger>
          <Select.Portal>
            <Select.Content className="select-content">
              <Select.Viewport className="select-viewport">
                {columns.map((c) => (
                  <Select.Item key={c.name} value={c.name} className="select-item">
                    <Select.ItemText>{c.name} ({c.type})</Select.ItemText>
                    <Select.ItemIndicator><i className="pixelart-icons-font-check" aria-hidden /></Select.ItemIndicator>
                  </Select.Item>
                ))}
              </Select.Viewport>
            </Select.Content>
          </Select.Portal>
        </Select.Root>

        {/* Operator */}
        <Select.Root value={op} onValueChange={(v) => setOp(v as FilterOperator)}>
          <Select.Trigger className="select-trigger small" aria-label="Select operator">
            <Select.Value />
            <Select.Icon><i className="pixelart-icons-font-chevron-down" aria-hidden /></Select.Icon>
          </Select.Trigger>
          <Select.Portal>
            <Select.Content className="select-content">
              <Select.Viewport className="select-viewport">
                {OPS.map((o) => (
                  <Select.Item key={o.value} value={o.value} className="select-item">
                    <Select.ItemText>{o.label}</Select.ItemText>
                    <Select.ItemIndicator><i className="pixelart-icons-font-check" aria-hidden /></Select.ItemIndicator>
                  </Select.Item>
                ))}
              </Select.Viewport>
            </Select.Content>
          </Select.Portal>
        </Select.Root>

        {/* Value */}
        <input
          className="filter-input"
          placeholder={op === 'between' ? 'from' : 'value'}
          value={val}
          onChange={(e) => setVal(e.target.value)}
          list={col ? `list-${col}` : undefined}
          aria-label="Filter value"
        />
        {distinctForColumn.length > 0 && (
          <datalist id={`list-${col}`}>
            {distinctForColumn.map((v) => <option key={v} value={v} />)}
          </datalist>
        )}
        {op === 'between' && (
          <input className="filter-input" placeholder="to" value={val2} onChange={(e) => setVal2(e.target.value)} aria-label="Filter value 2" />
        )}

        <button className="btn btn-primary" onClick={handleAdd} disabled={!canAdd} type="button">
          <i className="pixelart-icons-font-plus" aria-hidden /> Add
        </button>
      </div>

      {filters.length > 0 && (
        <div className="filter-chips">
          {filters.map((f, i) => (
            <Tooltip.Provider key={`${f.column}-${i}`}>
              <Tooltip.Root>
                <Tooltip.Trigger asChild>
                  <span className="chip">
                    {f.column} {f.operator} {String(f.value)}{f.value2 ? ` → ${String(f.value2)}` : ''}
                    <button onClick={() => removeFilter(i)} aria-label={`Remove filter ${f.column}`} className="chip-x" type="button">
                      <i className="pixelart-icons-font-close" aria-hidden />
                    </button>
                  </span>
                </Tooltip.Trigger>
                <Tooltip.Portal>
                  <Tooltip.Content className="tooltip" sideOffset={5}>Click × to remove</Tooltip.Content>
                </Tooltip.Portal>
              </Tooltip.Root>
            </Tooltip.Provider>
          ))}
          <button className="btn btn-secondary small" onClick={clearFilters} type="button">
            <i className="pixelart-icons-font-trash" aria-hidden /> Clear all
          </button>
        </div>
      )}
    </div>
  )
}
