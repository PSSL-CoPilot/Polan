import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  Filter,
  Search,
  SlidersHorizontal,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import type { ProcessedRow, SheetData } from '../types'
import {
  exportRows,
  getTableColumns,
  processedRowToRecord,
} from '../utils/workbook'

interface DataTableProps {
  sheets: SheetData[]
  includeDerived: boolean
  selectedSheet: string
  onSheetChange: (sheet: string) => void
}

const PAGE_SIZE = 8

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
}: DataTableProps) {
  const [search, setSearch] = useState('')
  const [layer, setLayer] = useState('All layers')
  const [sort, setSort] = useState<{ column: string; ascending: boolean } | null>(
    null,
  )
  const [page, setPage] = useState(1)
  const selectedSheets =
    selectedSheet === 'all'
      ? sheets.filter((sheet) => !sheet.errors.length)
      : sheets.filter((sheet) => sheet.name === selectedSheet)
  const columns = getTableColumns(selectedSheets, includeDerived)
  const rows = selectedSheets.flatMap((sheet) => sheet.rows)

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase()
    const filtered = rows.filter((row) => {
      const matchesSearch =
        !query ||
        columns.some((column) =>
          String(valueForColumn(row, column)).toLowerCase().includes(query),
        )
      const matchesLayer =
        !includeDerived || layer === 'All layers' || row.layer === layer
      return matchesSearch && matchesLayer
    })

    if (!sort) return filtered
    return [...filtered].sort((a, b) => {
      const aValue = String(valueForColumn(a, sort.column))
      const bValue = String(valueForColumn(b, sort.column))
      const result = aValue.localeCompare(bValue, undefined, {
        numeric: true,
        sensitivity: 'base',
      })
      return sort.ascending ? result : -result
    })
  }, [columns, includeDerived, layer, rows, search, sort])

  const pageCount = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const pageRows = filteredRows.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  )

  const toggleSort = (column: string) => {
    setPage(1)
    setSort((current) =>
      current?.column === column
        ? { column, ascending: !current.ascending }
        : { column, ascending: true },
    )
  }

  const renderCell = (row: ProcessedRow, column: string) => {
    const value = valueForColumn(row, column)
    if (column === 'MDR Availability') {
      return (
        <span className={`checkbox-cell ${value ? 'checked' : ''}`}>
          {value ? <Check size={13} /> : null}
        </span>
      )
    }
    if (column === 'Layers') {
      return <span className={`layer-badge ${String(value).toLowerCase().replace(' ', '-')}`}>{String(value)}</span>
    }
    if (column.toLowerCase() === 'direction') {
      return <span className={`direction-badge ${String(value).toLowerCase()}`}>{String(value)}</span>
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
            onChange={(event) => {
              setSearch(event.target.value)
              setPage(1)
            }}
            placeholder="Search across all columns..."
            value={search}
          />
        </div>
        <div className="toolbar-group">
          <select
            aria-label="Select sheet"
            onChange={(event) => {
              onSheetChange(event.target.value)
              setPage(1)
            }}
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
                onChange={(event) => {
                  setLayer(event.target.value)
                  setPage(1)
                }}
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
                onClick={() => exportRows(filteredRows, columns, 'csv')}
                type="button"
              >
                <Download size={15} />
                CSV
              </button>
              <button
                className="primary-button compact"
                onClick={() => exportRows(filteredRows, columns, 'xlsx')}
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
            {pageRows.map((row, index) => {
              const record = processedRowToRecord(row, columns)
              return (
                <tr key={row.id}>
                  <td className="row-number">
                    {(currentPage - 1) * PAGE_SIZE + index + 1}
                  </td>
                  {selectedSheet === 'all' && <td className="sheet-cell">{row.sheet}</td>}
                  {columns.map((column) => (
                    <td key={column} title={String(record[column] ?? '')}>
                      {renderCell(row, column)}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
        {!pageRows.length && (
          <div className="empty-table">
            <Search size={24} />
            <strong>No matching rows</strong>
            <span>Try adjusting your search or filters.</span>
          </div>
        )}
      </div>

      <footer className="table-footer">
        <span>
          Showing {pageRows.length ? (currentPage - 1) * PAGE_SIZE + 1 : 0}–
          {Math.min(currentPage * PAGE_SIZE, filteredRows.length)} of{' '}
          {filteredRows.length} rows
        </span>
        <div className="pagination">
          <button
            disabled={currentPage === 1}
            onClick={() => setPage((value) => Math.max(1, value - 1))}
            type="button"
          >
            <ChevronLeft size={15} />
          </button>
          <span>
            Page {currentPage} of {pageCount}
          </span>
          <button
            disabled={currentPage === pageCount}
            onClick={() => setPage((value) => Math.min(pageCount, value + 1))}
            type="button"
          >
            <ChevronRight size={15} />
          </button>
        </div>
      </footer>
    </section>
  )
}
