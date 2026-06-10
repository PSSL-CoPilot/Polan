import {
  DERIVED_COLUMNS,
  REQUIRED_COLUMNS,
  type CellValue,
  type Layer,
  type OriginalRow,
  type ProcessedRow,
  type RequiredColumn,
  type SheetData,
  type WorkbookData,
} from '../types'

const normalizedHeader = (value: string) =>
  value.trim().toLowerCase().replace(/\s+/g, ' ')

const displayValue = (value: CellValue) =>
  value === null || value === undefined ? '' : String(value).trim()

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function parseQualifiedName(value: string) {
  const parts = value
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean)

  if (parts.length < 6) {
    return {
      projectName: '',
      datasetName: '',
      tableName: '',
      warning: value
        ? 'Qualified Name has fewer than six slash-separated parts.'
        : 'Qualified Name is empty.',
    }
  }

  return {
    projectName: parts[3] ?? '',
    datasetName: parts[4] ?? '',
    tableName: parts.at(-1) ?? '',
    warning: undefined,
  }
}

export function deriveGovernance(datasetName: string): {
  mdrAvailability: boolean
  layer: Layer
} {
  const value = datasetName.toLowerCase()
  const isGold = value.includes('usl') || value.includes('gsl')
  const isSilver = value.includes('int')
  const isRaw = value.includes('stg') || value.includes('base')

  return {
    mdrAvailability: isGold || isSilver || isRaw,
    layer: isGold
      ? 'Gold'
      : isSilver
        ? 'Silver'
        : isRaw
          ? 'Raw'
          : 'No Layers',
  }
}

function resolveColumns(columns: string[]) {
  const byNormalizedName = new Map(
    columns.map((column) => [normalizedHeader(column), column]),
  )

  const mapping = {} as Record<RequiredColumn, string | undefined>
  REQUIRED_COLUMNS.forEach((column) => {
    mapping[column] = byNormalizedName.get(normalizedHeader(column))
  })

  return mapping
}

function isEmptyRow(row: OriginalRow) {
  return Object.values(row).every((value) => displayValue(value) === '')
}

export function processSheet(
  name: string,
  inputRows: OriginalRow[],
  originalColumns: string[],
): SheetData {
  const columns = originalColumns.filter(Boolean)
  const mapping = resolveColumns(columns)
  const missingColumns = REQUIRED_COLUMNS.filter((column) => !mapping[column])
  const errors = missingColumns.length
    ? [`Missing required columns: ${missingColumns.join(', ')}`]
    : []
  const warnings: string[] = []

  if (errors.length) {
    return { name, originalColumns: columns, rows: [], errors, warnings }
  }

  const rows = inputRows
    .filter((row) => !isEmptyRow(row))
    .map((original, index): ProcessedRow => {
      const sourceAsset = displayValue(original[mapping['Source Asset']!])
      const impactedAsset = displayValue(original[mapping['Impacted Asset']!])
      const direction = displayValue(original[mapping.Direction!]).toLowerCase()
      const qualifiedName = displayValue(original[mapping['Qualified Name']!])
      const parsed = parseQualifiedName(qualifiedName)
      const governance = deriveGovernance(parsed.datasetName)
      const rowWarnings: string[] = []

      if (!sourceAsset || !impactedAsset) {
        rowWarnings.push('Source Asset or Impacted Asset is blank.')
      }
      if (direction !== 'upstream' && direction !== 'downstream') {
        rowWarnings.push(`Invalid direction "${direction || 'blank'}".`)
      }
      if (parsed.warning) rowWarnings.push(parsed.warning)
      if (rowWarnings.length) {
        warnings.push(`Row ${index + 2}: ${rowWarnings.join(' ')}`)
      }

      return {
        id: `${name}-${index}`,
        sheet: name,
        original,
        sourceAsset,
        impactedAsset,
        direction,
        qualifiedName,
        projectName: parsed.projectName,
        datasetName: parsed.datasetName,
        tableName: parsed.tableName,
        mdrAvailability: governance.mdrAvailability,
        layer: governance.layer,
        warning: rowWarnings.join(' ') || undefined,
      }
    })

  return { name, originalColumns: columns, rows, errors, warnings }
}

export async function parseWorkbookFile(file: File): Promise<WorkbookData> {
  const extension = file.name.split('.').pop()?.toLowerCase()
  if (extension !== 'xlsx' && extension !== 'xls') {
    throw new Error('Choose an Excel workbook with a .xlsx or .xls extension.')
  }

  const XLSX = await import('xlsx')
  const workbook = XLSX.read(await file.arrayBuffer(), {
    type: 'array',
    cellDates: true,
  })

  if (!workbook.SheetNames.length) {
    throw new Error('This workbook does not contain any readable sheets.')
  }

  const sheets = workbook.SheetNames.map((sheetName) => {
    const worksheet = workbook.Sheets[sheetName]
    const matrix = XLSX.utils.sheet_to_json<CellValue[]>(worksheet, {
      header: 1,
      defval: null,
      raw: false,
    })
    const originalColumns = (matrix[0] ?? [])
      .map((value) => displayValue(value))
      .filter(Boolean)
    const rows = XLSX.utils.sheet_to_json<OriginalRow>(worksheet, {
      defval: null,
      raw: false,
    })
    return processSheet(sheetName, rows, originalColumns)
  })

  return {
    name: file.name,
    sizeLabel: formatBytes(file.size),
    loadedAt: new Date(),
    sheets,
  }
}

export function processedRowToRecord(
  row: ProcessedRow,
  originalColumns: string[],
) {
  const record: Record<string, CellValue> = {}
  originalColumns.forEach((column) => {
    record[column] = row.original[column]
  })
  record['Project Name'] = row.projectName
  record['Dataset Name'] = row.datasetName
  record['Table Name'] = row.tableName
  record['MDR Availability'] = row.mdrAvailability ? 'Yes' : ''
  record.Layers = row.layer
  return record
}

export function getTableColumns(
  sheets: SheetData[],
  includeDerived: boolean,
) {
  const originals = Array.from(
    new Set(sheets.flatMap((sheet) => sheet.originalColumns)),
  )
  return includeDerived ? [...originals, ...DERIVED_COLUMNS] : originals
}

export async function exportRows(
  rows: ProcessedRow[],
  columns: string[],
  format: 'xlsx' | 'csv',
) {
  const XLSX = await import('xlsx')
  const records = rows.map((row) => {
    const originalColumns = columns.filter(
      (column) => !(DERIVED_COLUMNS as readonly string[]).includes(column),
    )
    return processedRowToRecord(row, originalColumns)
  })
  const sheet = XLSX.utils.json_to_sheet(records, { header: columns })

  if (format === 'xlsx') {
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, sheet, 'Processed Lineage')
    XLSX.writeFile(workbook, 'processed-lineage.xlsx')
    return
  }

  const csv = XLSX.utils.sheet_to_csv(sheet)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'processed-lineage.csv'
  anchor.click()
  URL.revokeObjectURL(url)
}
