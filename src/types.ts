export const REQUIRED_COLUMNS = [
  'Source Asset',
  'Impacted Asset',
  'Direction',
  'Qualified Name',
] as const

export const DERIVED_COLUMNS = [
  'Project Name',
  'Dataset Name',
  'Table Name',
  'MDR Availability',
  'Layers',
] as const

export type RequiredColumn = (typeof REQUIRED_COLUMNS)[number]
export type Layer = 'Gold' | 'Silver' | 'Raw' | 'No Layers'
export type AssetType =
  | 'bigquery'
  | 'powerbi'
  | 'dataset'
  | 'report'
  | 'unknown'

export type CellValue = string | number | boolean | null | undefined
export type OriginalRow = Record<string, CellValue>

export interface ProcessedRow {
  id: string
  sheet: string
  original: OriginalRow
  sourceAsset: string
  impactedAsset: string
  direction: string
  qualifiedName: string
  projectName: string
  datasetName: string
  tableName: string
  mdrAvailability: boolean
  layer: Layer
  warning?: string
}

export interface SheetData {
  name: string
  originalColumns: string[]
  rows: ProcessedRow[]
  errors: string[]
  warnings: string[]
}

export interface WorkbookData {
  name: string
  sizeLabel: string
  loadedAt: Date
  sheets: SheetData[]
}

export interface AssetRecord {
  id: string
  name: string
  type: AssetType
  directions: string[]
  upstreamIds: string[]
  downstreamIds: string[]
  rows: ProcessedRow[]
  projectName: string
  datasetName: string
  tableName: string
  mdrAvailability: boolean
  layer: Layer
}

export type AppView = 'upload' | 'preview' | 'lineage' | 'processed'
