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

  // Optional column — present in some workbooks, not required.
  const impactedAssetTypeCol = columns.find(
    (col) => normalizedHeader(col) === 'impacted asset type',
  )

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

      const impactedAssetType = impactedAssetTypeCol
        ? displayValue(original[impactedAssetTypeCol]) || undefined
        : undefined

      return {
        id: `${name}-${index}`,
        sheet: name,
        original,
        sourceAsset,
        impactedAsset,
        impactedAssetType,
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

interface ExportExtras {
  columns: string[]
  valueFor: (row: ProcessedRow) => Record<string, CellValue>
}

export interface MetricExportSheet {
  metricName: string
  rows: ProcessedRow[]
  columns: string[]
  extras: ExportExtras
}

export function safeExcelSheetNames(names: string[]): string[] {
  const used = new Set<string>()

  return names.map((name) => {
    const cleaned =
      name
        .replace(/[\\/?*[\]:]/g, ' ')
        .split('')
        .map((character) =>
          character.charCodeAt(0) < 32 ? ' ' : character,
        )
        .join('')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/^'+|'+$/g, '') || 'Metric'
    const base = cleaned.slice(0, 31).trim() || 'Metric'
    let candidate = base
    let duplicateIndex = 2

    while (used.has(candidate.toLowerCase())) {
      const suffix = ` (${duplicateIndex})`
      candidate =
        `${base.slice(0, Math.max(1, 31 - suffix.length)).trimEnd()}${suffix}`
      duplicateIndex += 1
    }

    used.add(candidate.toLowerCase())
    return candidate
  })
}

export async function exportRows(
  rows: ProcessedRow[],
  columns: string[],
  extras?: ExportExtras,
  metricSheets?: MetricExportSheet[],
) {
  // xlsx-js-style is a SheetJS CE fork that adds cell-style support.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mod = (await import('xlsx-js-style')) as any
  const XLSX = mod.default ?? mod

  const createSheet = (
    sheetRows: ProcessedRow[],
    sheetColumns: string[],
    sheetExtras?: ExportExtras,
  ) => {
    const originalColumns = sheetColumns.filter(
      (column) =>
        !(DERIVED_COLUMNS as readonly string[]).includes(column) &&
        !sheetExtras?.columns.includes(column),
    )
    const records = sheetRows.map((row) => ({
      ...(sheetExtras ? sheetExtras.valueFor(row) : {}),
      ...processedRowToRecord(row, originalColumns),
    }))
    const sheet = XLSX.utils.json_to_sheet(records, { header: sheetColumns })

    // Colour the header row: original Excel columns = dark blue, derived/metric = dark orange.
    const isOriginal = (col: string) =>
      !(DERIVED_COLUMNS as readonly string[]).includes(col) &&
      !sheetExtras?.columns.includes(col)

    sheetColumns.forEach((col, idx) => {
      const ref = XLSX.utils.encode_cell({ r: 0, c: idx })
      sheet[ref] = {
        v: col,
        t: 's',
        s: {
          fill: {
            patternType: 'solid',
            fgColor: { rgb: isOriginal(col) ? '1E3A5F' : 'C2410C' },
          },
          font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11 },
          alignment: { vertical: 'center' },
        },
      }
    })

    // Enable Excel auto-filter on all columns.
    if (sheet['!ref']) {
      const range = XLSX.utils.decode_range(sheet['!ref'])
      sheet['!autofilter'] = {
        ref: XLSX.utils.encode_range(
          { r: 0, c: 0 },
          { r: 0, c: range.e.c },
        ),
      }
    }
    return sheet
  }

  const workbook = XLSX.utils.book_new()
  if (metricSheets?.length) {
    const sheetNames = safeExcelSheetNames(
      metricSheets.map((metricSheet) => metricSheet.metricName),
    )
    metricSheets.forEach((metricSheet, index) => {
      XLSX.utils.book_append_sheet(
        workbook,
        createSheet(
          metricSheet.rows,
          metricSheet.columns,
          metricSheet.extras,
        ),
        sheetNames[index],
      )
    })
  } else {
    XLSX.utils.book_append_sheet(
      workbook,
      createSheet(rows, columns, extras),
      'Processed Lineage',
    )
  }
  XLSX.writeFile(workbook, 'processed-lineage.xlsx')
}
