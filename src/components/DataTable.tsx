import {
  ArrowDown,
  ArrowUp,
  Check,
  Download,
  Filter,
  Search,
  SlidersHorizontal,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import type { ProcessedRow, SheetData } from '../types'
import {
  metricValueForRow,
  type MetricTableContext,
} from '../utils/metricData'
import { exportRows, getTableColumns } from '../utils/workbook'

interface DataTableProps {
  sheets: SheetData[]
  includeDerived: boolean
  selectedSheet: string
  onSheetChange: (sheet: string) => void
  /** Active-metric enrichment: prepends Report/Dataset/Metric columns. */
  metricContext?: MetricTableContext | null
  /** When set, only rows matching this direction are shown. */
  directionFilter?: 'upstream' | 'downstream'
}

const valueForColumn = (row: ProcessedRow, column: string) => {
  if (column === 'Project Name') return row.projectName
  if (column === 'Dataset Name') return row.datasetName
  if (column === 'Table Name') return row.tableName
  if (column === 'MDR Availability') return row.mdrAvailability
  if (column === 'Layers') return row.layer
  return row.original[column] ?? ''
}

export function DataTable({
  sheets,
  includeDerived,
  selectedSheet,
  onSheetChange,
  metricContext = null,
  directionFilter,
}: DataTableProps) {
  const [search, setSearch] = useState('')
  const [layer, setLayer] = useState('All layers')
  const [sort, setSort] = useState<{ column: string; ascending: boolean } | null>(
    null,
  )

  const selectedSheets =
    selectedSheet === 'all'
      ? sheets.filter((sheet) => !sheet.errors.length)
      : sheets.filter((sheet) => sheet.name === selectedSheet)

  const metricColumns = metricContext?.columns ?? []
  const columns = [
    ...metricColumns,
    ...getTableColumns(selectedSheets, includeDerived),
  ]

  const rows = useMemo(() => {
    const flat = selectedSheets
      .flatMap((sheet) => sheet.rows)
      .filter((row) => !directionFilter || row.direction === directionFilter)
    if (!metricContext) return flat
    // Active metric: related rows first, grouped table by table in the order
    // the tables were connected; everything else keeps its original order.
    const sheetRank = new Map(
      metricContext.connectedSheets.map((name, index) => [name, index]),
    )
    const related = flat.filter((row) => metricContext.byRowId.has(row.id))
    const others = flat.filter((row) => !metricContext.byRowId.has(row.id))
    related.sort(
      (a, b) => (sheetRank.get(a.sheet) ?? 0) - (sheetRank.get(b.sheet) ?? 0),
    )
    return [...related, ...others]
  }, [selectedSheets, metricContext, directionFilter])

  const getValue = (row: ProcessedRow, column: string) =>
    metricColumns.includes(column)
      ? metricValueForRow(metricContext, row.id, column)
      : valueForColumn(row, column)

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase()
    const filtered = rows.filter((row) => {
      const matchesSearch =
        !query ||
        columns.some((column) =>
          String(getValue(row, column)).toLowerCase().includes(query),
        )
      const matchesLayer =
        !includeDerived || layer === 'All layers' || row.layer === layer
      return matchesSearch && matchesLayer
    })

    if (!sort) return filtered
    return [...filtered].sort((a, b) => {
      const aValue = String(getValue(a, sort.column))
      const bValue = String(getValue(b, sort.column))
      const result = aValue.localeCompare(bValue, undefined, {
        numeric: true,
        sensitivity: 'base',
      })
      return sort.ascending ? result : -result
    })
  }, [columns, includeDerived, layer, rows, search, sort, metricContext])

  const exportExtras = metricContext
    ? {
        columns: metricColumns,
        valueFor: (row: ProcessedRow) => {
          const values: Record<string, string> = {}
          metricColumns.forEach((column) => {
            values[column] = String(
              metricValueForRow(metricContext, row.id, column),
            )
          })
          return values
        },
      }
    : undefined

  const toggleSort = (column: string) => {
    setSort((current) =>
      current?.column === column
        ? { column, ascending: !current.ascending }
        : { column, ascending: true },
    )
  }

  const renderCell = (row: ProcessedRow, column: string) => {
    if (metricColumns.includes(column)) {
      const value = String(metricValueForRow(metricContext, row.id, column))
      if (!value) return <span className="metric-cell-empty" />
      const highlight = column === 'Metric Name' || column === 'Measure Name'
      return highlight ? <span className="metric-cell">{value}</span> : value
    }
    const value = valueForColumn(row, column)
    if (column === 'MDR Availability') {
      return (
        <span className={`checkbox-cell ${value ? 'checked' : ''}`}>
          {value ? <Check size={13} /> : null}
        </span>
      )
    }
    if (column === 'Layers') {
      return (
        <span
          className={`layer-badge ${String(value).toLowerCase().replace(' ', '-')}`}
        >
          {String(value)}
        </span>
      )
    }
    if (column.toLowerCase() === 'direction') {
      return (
        <span
          className={`direction-badge ${String(value).toLowerCase()}`}
        >
          {String(value)}
        </span>
      )
    }
    return String(value || '—')
  }

  return (
    <section className="table-card">
      <div className="table-toolbar">
        <div className="table-search">
          <Search size={16} />
          <input
            aria-label="Search table"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search across all columns..."
            value={search}
          />
        </div>
        <div className="toolbar-group">
          <select
            aria-label="Select sheet"
            onChange={(event) => onSheetChange(event.target.value)}
            value={selectedSheet}
          >
            <option value="all">All sheets</option>
            {sheets.map((sheet) => (
              <option key={sheet.name} value={sheet.name}>
                {sheet.name}
              </option>
            ))}
          </select>
          {includeDerived && (
            <label className="select-with-icon">
              <Filter size={15} />
              <select
                value={layer}
                onChange={(event) => setLayer(event.target.value)}
              >
                <option>All layers</option>
                <option>Gold</option>
                <option>Silver</option>
                <option>Raw</option>
                <option>No Layers</option>
              </select>
            </label>
          )}
          <button className="ghost-button" type="button">
            <SlidersHorizontal size={15} />
            Columns
          </button>
          {includeDerived && (
            <div className="export-menu">
              <button
                className="ghost-button"
                onClick={() =>
                  exportRows(filteredRows, columns, 'csv', exportExtras)
                }
                type="button"
              >
                <Download size={15} />
                CSV
              </button>
              <button
                className="primary-button compact"
                onClick={() =>
                  exportRows(filteredRows, columns, 'xlsx', exportExtras)
                }
                type="button"
              >
                <Download size={15} />
                Excel
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th className="row-number">#</th>
              {selectedSheet === 'all' && <th>Sheet</th>}
              {columns.map((column) => (
                <th key={column}>
                  <button onClick={() => toggleSort(column)} type="button">
                    {column}
                    {sort?.column === column &&
                      (sort.ascending ? (
                        <ArrowUp size={13} />
                      ) : (
                        <ArrowDown size={13} />
                      ))}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row, index) => (
              <tr key={row.id}>
                <td className="row-number">{index + 1}</td>
                {selectedSheet === 'all' && (
                  <td className="sheet-cell">{row.sheet}</td>
                )}
                {columns.map((column) => (
                  <td
                    key={column}
                    title={String(getValue(row, column) ?? '')}
                  >
                    {renderCell(row, column)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {!filteredRows.length && (
          <div className="empty-table">
            <Search size={24} />
            <strong>No matching rows</strong>
            <span>Try adjusting your search or filters.</span>
          </div>
        )}
      </div>

      <footer className="table-footer">
        <span>
          {filteredRows.length} of {rows.length}{' '}
          row{rows.length === 1 ? '' : 's'}
        </span>
      </footer>
    </section>
  )
}
