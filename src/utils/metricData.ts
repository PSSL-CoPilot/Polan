import type {
  AssetRecord,
  CellValue,
  MetricRecord,
  ProcessedRow,
} from '../types'

/**
 * Enrichment of the Processed Data table for the active metric:
 * Report 1..N / Dataset / Metric Name / Measure Name columns, filled on every
 * row that belongs to a sheet (= Power BI table) the metric is connected to.
 */
export interface MetricTableContext {
  metric: MetricRecord
  columns: string[]
  /** row id → values for the metric columns. */
  byRowId: Map<string, Record<string, string>>
  /** sheets the metric is connected to, in connection order. */
  connectedSheets: string[]
}

export function buildMetricTableContext(
  metric: MetricRecord | null,
  rows: ProcessedRow[],
  assets: Map<string, AssetRecord>,
): MetricTableContext | null {
  if (!metric || !metric.connectedSheets.length) return null

  const connected = new Set(metric.connectedSheets)
  const byRowId = new Map<string, Record<string, string>>()
  let maxReports = 0

  const nodeId = (name: string) =>
    name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

  rows.forEach((row) => {
    if (!connected.has(row.sheet) || !row.sourceAsset) return
    const table = assets.get(nodeId(row.sourceAsset))
    if (!table) return

    const datasets: AssetRecord[] = []
    const reports: AssetRecord[] = []
    const visit = (asset: AssetRecord | undefined, depth: number) => {
      if (!asset || depth > 3) return
      if (asset.type === 'dataset' && !datasets.includes(asset)) {
        datasets.push(asset)
      }
      if (asset.type === 'report' && !reports.includes(asset)) {
        reports.push(asset)
      }
      asset.downstreamIds.forEach((id) => visit(assets.get(id), depth + 1))
    }
    table.downstreamIds.forEach((id) => visit(assets.get(id), 1))

    maxReports = Math.max(maxReports, reports.length)
    const values: Record<string, string> = {
      Dataset: datasets.map((asset) => asset.name).join(', '),
      'Metric Name': metric.name,
      'Measure Name': metric.measureName,
    }
    reports.forEach((report, index) => {
      values[`Report ${index + 1}`] = report.name
    })
    byRowId.set(row.id, values)
  })

  if (!byRowId.size) return null

  const reportColumns = Array.from(
    { length: maxReports },
    (_, index) => `Report ${index + 1}`,
  )
  return {
    metric,
    columns: [...reportColumns, 'Dataset', 'Metric Name', 'Measure Name'],
    byRowId,
    connectedSheets: metric.connectedSheets,
  }
}

export function metricValueForRow(
  context: MetricTableContext | null,
  rowId: string,
  column: string,
): CellValue {
  return context?.byRowId.get(rowId)?.[column] ?? ''
}
