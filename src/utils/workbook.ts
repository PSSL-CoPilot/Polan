import {
  DERIVED_COLUMNS,
  REQUIRED_COLUMNS,
  type CellHyperlink,
  type CellValue,
  type Layer,
  type OriginalRow,
  type ProcessedRow,
  type RequiredColumn,
  type RowHyperlinks,
  type SheetData,
  type WorkbookData,
} from '../types'
import {
  hyperlinkForMatchingValue,
  hyperlinkForOriginalColumn,
} from './hyperlinks'
import { isImpactedAssetTypeMismatch } from './processedDataValidation'
import type { CellObject, WorkSheet } from 'xlsx'

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
  hyperlinksByRow?: Map<number, RowHyperlinks>,
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
      const sourceRow = (original as OriginalRow & { __rowNum__?: number })
        .__rowNum__

      return {
        id: `${name}-${index}`,
        sheet: name,
        original,
        hyperlinks:
          sourceRow === undefined ? undefined : hyperlinksByRow?.get(sourceRow),
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

/**
 * Pull the URL out of an `=HYPERLINK("url", "label")` formula. Many tools
 * (Atlan, Power BI, BigQuery exports) store links as HYPERLINK formulas rather
 * than native cell hyperlinks, so the link lives on `cell.f`, not `cell.l`.
 * Returns the first quoted argument (the URL); the visible label is left on the
 * cell value untouched. String references like `HYPERLINK(A1, ...)` have no
 * literal URL and are skipped.
 */
function hyperlinkFromFormula(formula: string | undefined): string | undefined {
  if (!formula) return undefined
  // Capture the first string argument, allowing Excel's "" escaped quotes.
  const match = /hyperlink\s*\(\s*"((?:[^"]|"")*)"/i.exec(formula)
  if (!match) return undefined
  const url = match[1].replace(/""/g, '"').trim()
  return url || undefined
}

function extractWorksheetHyperlinks(
  XLSX: typeof import('xlsx'),
  worksheet: WorkSheet,
  headerRow: CellValue[],
): Map<number, RowHyperlinks> {
  const linksByRow = new Map<number, RowHyperlinks>()
  if (!worksheet['!ref']) return linksByRow

  const range = XLSX.utils.decode_range(worksheet['!ref'])
  for (let row = range.s.r + 1; row <= range.e.r; row += 1) {
    for (let column = range.s.c; column <= range.e.c; column += 1) {
      const header = displayValue(headerRow[column - range.s.c])
      if (!header) continue

      const cell = worksheet[
        XLSX.utils.encode_cell({ r: row, c: column })
      ] as CellObject | undefined
      // Prefer a native hyperlink; fall back to a HYPERLINK() formula.
      const target =
        cell?.l?.Target?.trim() || hyperlinkFromFormula(cell?.f)
      if (!target) continue

      const hyperlinks = linksByRow.get(row) ?? {}
      hyperlinks[header] = {
        target,
        tooltip: cell?.l?.Tooltip?.trim() || undefined,
      }
      linksByRow.set(row, hyperlinks)
    }
  }
  return linksByRow
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
    const hyperlinksByRow = extractWorksheetHyperlinks(
      XLSX,
      worksheet,
      matrix[0] ?? [],
    )
    return processSheet(sheetName, rows, originalColumns, hyperlinksByRow)
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
  // Same validation that drives the yellow row highlight, surfaced as a column.
  record['Issue?'] = isImpactedAssetTypeMismatch(row) ? 'Yes' : 'No'
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
  hyperlinkFor?: (
    row: ProcessedRow,
    column: string,
  ) => CellHyperlink | undefined
}

export interface MetricExportSheet {
  metricName: string
  rows: ProcessedRow[]
  columns: string[]
  extras: ExportExtras
  lineageUrl?: string
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
    lineageUrl?: string,
  ) => {
    const originalColumns = sheetColumns.filter(
      (column) =>
        !(DERIVED_COLUMNS as readonly string[]).includes(column) &&
        !sheetExtras?.columns.includes(column),
    )
    const records = sheetRows.map((row) => {
      const values = {
        ...(sheetExtras ? sheetExtras.valueFor(row) : {}),
        ...processedRowToRecord(row, originalColumns),
      }
      return Object.fromEntries(
        sheetColumns.map((column) => [column, values[column] ?? '']),
      )
    })
    const sheet = XLSX.utils.json_to_sheet(records, { header: sheetColumns })
    const border = {
      top: { style: 'thin', color: { rgb: 'D8D5DE' } },
      bottom: { style: 'thin', color: { rgb: 'D8D5DE' } },
      left: { style: 'thin', color: { rgb: 'D8D5DE' } },
      right: { style: 'thin', color: { rgb: 'D8D5DE' } },
    }

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
          border,
        },
      }
    })

    sheetRows.forEach((row, rowIndex) => {
      sheetColumns.forEach((column, columnIndex) => {
        const ref = XLSX.utils.encode_cell({
          r: rowIndex + 1,
          c: columnIndex,
        })
        const cell = sheet[ref] ?? { v: '', t: 's' }
        const value = records[rowIndex]?.[column]
        const hyperlink =
          sheetExtras?.hyperlinkFor?.(row, column) ??
          hyperlinkForOriginalColumn(row, column) ??
          hyperlinkForMatchingValue(row, value)

        cell.s = {
          ...(cell.s ?? {}),
          border,
          ...(hyperlink
            ? {
                font: {
                  ...(cell.s?.font ?? {}),
                  color: { rgb: '0563C1' },
                  underline: true,
                },
              }
            : {}),
        }
        if (hyperlink) {
          cell.l = {
            Target: hyperlink.target,
            ...(hyperlink.tooltip ? { Tooltip: hyperlink.tooltip } : {}),
          }
        }
        sheet[ref] = cell
      })
    })

    // Highlight invalid Impacted Asset / Impacted Asset Type relationships.
    sheetRows.forEach((row, rowIndex) => {
      if (!isImpactedAssetTypeMismatch(row)) return

      sheetColumns.forEach((_, columnIndex) => {
        const ref = XLSX.utils.encode_cell({
          r: rowIndex + 1,
          c: columnIndex,
        })
        const cell = sheet[ref] ?? { v: '', t: 's' }
        cell.s = {
          ...(cell.s ?? {}),
          border,
          fill: {
            patternType: 'solid',
            fgColor: { rgb: 'FFF2CC' },
          },
        }
        sheet[ref] = cell
      })
    })

    if (lineageUrl) {
      const lineageRow = sheetRows.length + 3
      const messageRef = XLSX.utils.encode_cell({ r: lineageRow, c: 0 })
      const linkRef = XLSX.utils.encode_cell({ r: lineageRow, c: 1 })
      sheet[messageRef] = {
        v: 'To view lineage for this metric,',
        t: 's',
        s: { border },
      }
      sheet[linkRef] = {
        v: 'click here',
        t: 's',
        l: { Target: lineageUrl },
        s: {
          border,
          font: { color: { rgb: '0563C1' }, underline: true },
        },
      }
      sheet['!ref'] = XLSX.utils.encode_range(
        { r: 0, c: 0 },
        { r: lineageRow, c: Math.max(sheetColumns.length - 1, 1) },
      )
    }

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
          metricSheet.lineageUrl,
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
  // `compression: true` switches the .xlsx ZIP from STORED to DEFLATE, which
  // shrinks styled exports dramatically (~80%) with zero data, style, hyperlink,
  // border, filter, or metric-sheet loss.
  XLSX.writeFile(workbook, 'processed-lineage.xlsx', { compression: true })
}
