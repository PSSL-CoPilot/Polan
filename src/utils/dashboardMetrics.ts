import type { ProcessedRow, UploadedWorkbook } from '../types'

export const ALL_DASHBOARD_WORKBOOKS = 'all'
export const ALL_DASHBOARD_SHEETS = 'all'

export interface DashboardScope {
  workbookId: string
  sheetName: string
}

export interface DashboardMetrics {
  totalAssets: number
  upstreamAssets: number
  downstreamAssets: number
  powerbiAssets: number
  reports: number
  datasets: number
  gold: number
  silver: number
  raw: number
  noLayer: number
  mdrYes: number
  mdrNo: number
  tableCount: number
  viewCount: number
}

const normalized = (value: unknown) =>
  value === null || value === undefined
    ? ''
    : String(value).trim().toLowerCase()

const isReportIndicator = (value: string) =>
  /report|dashboard|scorecard|paginated|\.rdl/.test(value)

const isDatasetIndicator = (value: string) =>
  /dataset|semantic|model|workspace|\.pbix/.test(value)

function downstreamAssetKind(
  row: ProcessedRow,
): 'report' | 'dataset' | null {
  const assetType = normalized(row.impactedAssetType)
  if (isReportIndicator(assetType)) return 'report'
  if (isDatasetIndicator(assetType)) return 'dataset'

  const assetName = normalized(row.impactedAsset)
  if (isReportIndicator(assetName)) return 'report'
  if (isDatasetIndicator(assetName)) return 'dataset'
  return null
}

function workbooksForScope(
  workbooks: UploadedWorkbook[],
  workbookId: string,
) {
  if (workbookId === ALL_DASHBOARD_WORKBOOKS) return workbooks
  return workbooks.filter((workbook) => workbook.id === workbookId)
}

export function getDashboardSheetOptions(
  workbooks: UploadedWorkbook[],
  workbookId: string,
): string[] {
  const names = new Map<string, string>()

  workbooksForScope(workbooks, workbookId).forEach((workbook) => {
    workbook.sheets.forEach((sheet) => {
      const key = normalized(sheet.name)
      if (key && !names.has(key)) names.set(key, sheet.name.trim())
    })
  })

  return Array.from(names.values()).sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: 'base' }),
  )
}

export function getDashboardRows(
  workbooks: UploadedWorkbook[],
  scope: DashboardScope,
): ProcessedRow[] {
  const selectedSheet = normalized(scope.sheetName)

  return workbooksForScope(workbooks, scope.workbookId).flatMap((workbook) =>
    workbook.sheets
      .filter(
        (sheet) =>
          scope.sheetName === ALL_DASHBOARD_SHEETS ||
          normalized(sheet.name) === selectedSheet,
      )
      .flatMap((sheet) => sheet.rows),
  )
}

export function computeDashboardMetrics(
  rows: ProcessedRow[],
): DashboardMetrics {
  const metrics: DashboardMetrics = {
    totalAssets: rows.length,
    upstreamAssets: 0,
    downstreamAssets: 0,
    powerbiAssets: 0,
    reports: 0,
    datasets: 0,
    gold: 0,
    silver: 0,
    raw: 0,
    noLayer: 0,
    mdrYes: 0,
    mdrNo: 0,
    tableCount: 0,
    viewCount: 0,
  }
  const sourceAssets = new Set<string>()

  rows.forEach((row) => {
    const direction = normalized(row.direction)
    if (direction === 'upstream') metrics.upstreamAssets += 1
    if (direction === 'downstream') {
      metrics.downstreamAssets += 1
      const kind = downstreamAssetKind(row)
      if (kind === 'report') metrics.reports += 1
      if (kind === 'dataset') metrics.datasets += 1
    }

    // Table vs View comparison — driven by the Impacted Asset Type column,
    // case-insensitive and null-safe (blank / other values count as neither).
    const assetType = normalized(row.impactedAssetType)
    if (assetType === 'table') metrics.tableCount += 1
    else if (assetType === 'view') metrics.viewCount += 1

    const sourceAsset = normalized(row.sourceAsset)
    if (sourceAsset) sourceAssets.add(sourceAsset)

    const layer = normalized(row.layer).replace(/[\s_-]+/g, '')
    if (layer === 'gold') metrics.gold += 1
    else if (layer === 'silver') metrics.silver += 1
    else if (layer === 'raw' || layer === 'bronze') metrics.raw += 1
    else metrics.noLayer += 1

    if (row.mdrAvailability === true) metrics.mdrYes += 1
    else metrics.mdrNo += 1
  })

  metrics.powerbiAssets = sourceAssets.size
  return metrics
}
