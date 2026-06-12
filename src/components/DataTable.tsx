import {
  ArrowDown,
  ArrowUp,
  Check,
  Download,
  Filter,
  Search,
  Sigma,
  SlidersHorizontal,
} from 'lucide-react'
import { useState } from 'react'
import type { ProcessedRow, SheetData } from '../types'
import { DERIVED_COLUMNS } from '../types'
import {
  DEFAULT_METRIC_COLUMNS,
  metricColumnsForEntries,
  metricValueForRow,
  type MetricTableEntry,
  type MetricTableContext,
} from '../utils/metricData'
import {
  IMPACTED_ASSET_TYPE_WARNING,
  isImpactedAssetTypeMismatch,
} from '../utils/processedDataValidation'
import {
  exportRows,
  getTableColumns,
  type MetricExportSheet,
} from '../utils/workbook'

interface DataTableProps {
  sheets: SheetData[]
  includeDerived: boolean
  selectedSheet: string
  onSheetChange: (sheet: string) => void
  /** All project metrics and their processed-data enrichment contexts. */
  metricEntries?: MetricTableEntry[]
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

interface TableRow {
  key: string
  row: ProcessedRow
  metricContext: MetricTableContext | null
}

export function DataTable({
  sheets,
  includeDerived,
  selectedSheet,
  onSheetChange,
  metricEntries = [],
  directionFilter,
}: DataTableProps) {
  const [search, setSearch] = useState('')
  const [layer, setLayer] = useState('All layers')
  const [selectedMetricId, setSelectedMetricId] = useState('all')
  const [sort, setSort] = useState<{ column: string; ascending: boolean } | null>(
    null,
  )

  const selectedSheets =
    selectedSheet === 'all'
      ? sheets.filter((sheet) => !sheet.errors.length)
      : sheets.filter((sheet) => sheet.name === selectedSheet)

  const effectiveMetricId =
    selectedMetricId === 'all' ||
    metricEntries.some((entry) => entry.metric.id === selectedMetricId)
      ? selectedMetricId
      : 'all'
  const activeMetricEntries =
    effectiveMetricId === 'all'
      ? metricEntries
      : metricEntries.filter((entry) => entry.metric.id === effectiveMetricId)
  const hasMetrics = metricEntries.length > 0
  const metricColumns = hasMetrics
    ? metricColumnsForEntries(activeMetricEntries)
    : []
  const baseColumns = getTableColumns(selectedSheets, includeDerived)
  const columns = [
    ...metricColumns,
    ...baseColumns,
  ]

  const flatRows = selectedSheets
    .flatMap((sheet) => sheet.rows)
    .filter((row) => !directionFilter || row.direction === directionFilter)
  const rows: TableRow[] = hasMetrics
    ? activeMetricEntries.flatMap((entry) => {
        if (!entry.context) return []
        const sheetRank = new Map(
          entry.context.connectedSheets.map((name, index) => [name, index]),
        )
        return flatRows
          .filter((row) => entry.context!.byRowId.has(row.id))
          .sort(
            (a, b) =>
              (sheetRank.get(a.sheet) ?? 0) -
              (sheetRank.get(b.sheet) ?? 0),
          )
          .map((row) => ({
            key: `${entry.metric.id}:${row.id}`,
            row,
            metricContext: entry.context,
          }))
      })
    : flatRows.map((row) => ({
        key: row.id,
        row,
        metricContext: null,
      }))

  const getValue = (item: TableRow, column: string) =>
    metricColumns.includes(column)
      ? metricValueForRow(item.metricContext, item.row.id, column)
      : valueForColumn(item.row, column)

  const filteredRows = (() => {
    const query = search.trim().toLowerCase()
    const filtered = rows.filter((item) => {
      const matchesSearch =
        !query ||
        columns.some((column) =>
          String(getValue(item, column)).toLowerCase().includes(query),
        )
      const matchesLayer =
        !includeDerived ||
        layer === 'All layers' ||
        item.row.layer === layer
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
  })()

  const colHeaderClass = (col: string) =>
    metricColumns.includes(col) ||
    (DERIVED_COLUMNS as readonly string[]).includes(col)
      ? 'th-derived'
      : 'th-original'

  const extrasForContext = (
    context: MetricTableContext | null,
    columnsForMetric: string[],
    metricName: string,
    measureName: string,
  ) => ({
    columns: columnsForMetric,
    valueFor: (row: ProcessedRow) => {
      const values: Record<string, string> = {}
      columnsForMetric.forEach((column) => {
        values[column] = context
          ? String(metricValueForRow(context, row.id, column))
          : column === 'Metric Name'
            ? metricName
            : column === 'Measure Name'
              ? measureName
              : ''
      })
      return values
    },
  })

  const metricExportSheets: MetricExportSheet[] | undefined = hasMetrics
    ? activeMetricEntries.map((entry) => {
        const columnsForMetric = entry.context?.columns ?? [
          ...DEFAULT_METRIC_COLUMNS,
        ]
        return {
          metricName: entry.metric.name,
          rows: filteredRows
            .filter(
              (item) =>
                item.metricContext?.metric.id === entry.metric.id,
            )
            .map((item) => item.row),
          columns: [...columnsForMetric, ...baseColumns],
          extras: extrasForContext(
            entry.context,
            columnsForMetric,
            entry.metric.name,
            entry.metric.measureName,
          ),
        }
      })
    : undefined

  const toggleSort = (column: string) => {
    setSort((current) =>
      current?.column === column
        ? { column, ascending: !current.ascending }
        : { column, ascending: true },
    )
  }

  const renderCell = (item: TableRow, column: string) => {
    if (metricColumns.includes(column)) {
      const value = String(
        metricValueForRow(item.metricContext, item.row.id, column),
      )
      if (!value) return <span className="metric-cell-empty" />
      const highlight = column === 'Metric Name' || column === 'Measure Name'
      return highlight ? <span className="metric-cell">{value}</span> : value
    }
    const value = valueForColumn(item.row, column)
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
          {includeDerived && hasMetrics && (
            <label className="select-with-icon">
              <Sigma size={15} />
              <select
                aria-label="Filter by metric"
                onChange={(event) => setSelectedMetricId(event.target.value)}
                value={effectiveMetricId}
              >
                <option value="all">All Metrics</option>
                {metricEntries.map((entry) => (
                  <option key={entry.metric.id} value={entry.metric.id}>
                    {entry.metric.name}
                  </option>
                ))}
              </select>
            </label>
          )}
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
            <button
              className="primary-button compact"
              onClick={() =>
                exportRows(
                  filteredRows.map((item) => item.row),
                  columns,
                  undefined,
                  metricExportSheets,
                )
              }
              type="button"
            >
              <Download size={15} />
              Export Excel
            </button>
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
                <th className={colHeaderClass(column)} key={column}>
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
            {filteredRows.map((item, index) => {
              const hasAssetTypeMismatch =
                isImpactedAssetTypeMismatch(item.row)
              return (
                <tr
                  className={
                    hasAssetTypeMismatch
                      ? 'processed-row-validation-warning'
                      : undefined
                  }
                  key={item.key}
                >
                  <td className="row-number">
                    {index + 1}
                    {hasAssetTypeMismatch && (
                      <span
                        aria-label={IMPACTED_ASSET_TYPE_WARNING}
                        className="row-validation-indicator"
                        title={IMPACTED_ASSET_TYPE_WARNING}
                      >
                        !
                      </span>
                    )}
                  </td>
                  {selectedSheet === 'all' && (
                    <td className="sheet-cell">{item.row.sheet}</td>
                  )}
                  {columns.map((column) => (
                    <td
                      key={column}
                      title={String(getValue(item, column) ?? '')}
                    >
                      {renderCell(item, column)}
                    </td>
                  ))}
                </tr>
              )
            })}
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
