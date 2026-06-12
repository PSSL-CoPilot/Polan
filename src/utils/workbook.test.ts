import { describe, expect, it, vi } from 'vitest'
import * as XLSX from 'xlsx'
import { buildLineage } from './lineage'
import {
  deriveGovernance,
  exportRows,
  parseQualifiedName,
  parseWorkbookFile,
  processSheet,
  safeExcelSheetNames,
} from './workbook'
import { DERIVED_COLUMNS, type OriginalRow } from '../types'

const exportCapture = vi.hoisted(() => ({
  workbook: null as XLSX.WorkBook | null,
}))

vi.mock('xlsx-js-style', async () => {
  const actual = await vi.importActual<typeof import('xlsx')>('xlsx')
  return {
    default: {
      ...actual,
      writeFile: (workbook: XLSX.WorkBook) => {
        exportCapture.workbook = workbook
      },
    },
  }
})

const columns = [
  'Source Asset',
  'Impacted Asset',
  'Direction',
  'Qualified Name',
]

const row: OriginalRow = {
  'Source Asset': 'Customer Table',
  'Impacted Asset': 'bq_customer',
  Direction: 'upstream',
  'Qualified Name': 'a/b/c/project_alpha/customer_USL/customer',
}

describe('workbook enrichment', () => {
  it('derives qualified-name fields and applies layer priority', () => {
    expect(
      parseQualifiedName('a/b/c/project_alpha/customer_USL/customer'),
    ).toMatchObject({
      projectName: 'project_alpha',
      datasetName: 'customer_USL',
      tableName: 'customer',
    })
    expect(deriveGovernance('mixed_STG_INT_USL')).toEqual({
      mdrAvailability: true,
      layer: 'Gold',
    })
    expect(deriveGovernance('unclassified')).toEqual({
      mdrAvailability: false,
      layer: 'No Layers',
    })
  })

  it('reads and processes every sheet in a real workbook', async () => {
    const workbook = XLSX.utils.book_new()
    const primarySheet = XLSX.utils.json_to_sheet([row])
    primarySheet.A2.l = {
      Target: 'https://example.atlan.com/assets/customer',
      Tooltip: 'Open customer asset',
    }
    XLSX.utils.book_append_sheet(
      workbook,
      primarySheet,
      'Primary',
    )
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet([
        {
          ...row,
          'Source Asset': 'Revenue Table',
          'Impacted Asset': 'Revenue Dataset',
          Direction: 'downstream',
        },
      ]),
      'Secondary',
    )
    const bytes = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
    const file = new File([bytes], 'lineage.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })

    const parsed = await parseWorkbookFile(file)

    expect(parsed.sheets).toHaveLength(2)
    expect(parsed.sheets.map((sheet) => sheet.name)).toEqual([
      'Primary',
      'Secondary',
    ])
    expect(parsed.sheets.flatMap((sheet) => sheet.rows)).toHaveLength(2)
    expect(parsed.sheets[0].rows[0].layer).toBe('Gold')
    expect(parsed.sheets[0].rows[0].hyperlinks?.['Source Asset']).toEqual({
      target: 'https://example.atlan.com/assets/customer',
      tooltip: 'Open customer asset',
    })
  })

  it('captures =HYPERLINK() formula links while keeping the visible text', async () => {
    const worksheet = XLSX.utils.json_to_sheet([row])
    // Real BI/Atlan exports store links as HYPERLINK formulas, not cell.l.
    worksheet.A2 = {
      t: 's',
      f: 'HYPERLINK("https://example.atlan.com/assets/customer","Customer Table")',
      v: 'Customer Table',
    }
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Primary')
    const bytes = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
    const file = new File([bytes], 'formula-links.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })

    const parsed = await parseWorkbookFile(file)
    const parsedRow = parsed.sheets[0].rows[0]

    expect(parsedRow.hyperlinks?.['Source Asset']?.target).toBe(
      'https://example.atlan.com/assets/customer',
    )
    // The visible text must stay the label, never the raw URL.
    expect(parsedRow.sourceAsset).toBe('Customer Table')
  })

  it('de-duplicates graph nodes and repeated relationships', () => {
    const sheet = processSheet('Lineage', [row, { ...row }], columns)
    const graph = buildLineage(sheet.rows)

    expect(graph.nodes).toHaveLength(2)
    expect(graph.edges).toHaveLength(1)
    expect(graph.edges[0]).toMatchObject({
      source: 'bq-customer',
      target: 'customer-table',
    })
  })

  it('creates safe, unique Excel sheet names for metrics', () => {
    const names = safeExcelSheetNames([
      'Unique Sales',
      'Unique Sales',
      'Installs: Mobile/Weekly?',
      'A metric name that is much longer than thirty-one characters',
      '[]:*?/\\',
    ])

    expect(names).toEqual([
      'Unique Sales',
      'Unique Sales (2)',
      'Installs Mobile Weekly',
      'A metric name that is much long',
      'Metric',
    ])
    expect(names.every((name) => name.length <= 31)).toBe(true)
  })

  it('highlights invalid impacted asset type rows in Excel exports', async () => {
    const exportColumns = [...columns, 'Impacted Asset Type']
    const processedColumns = [...exportColumns, ...DERIVED_COLUMNS]
    const sheet = processSheet(
      'Lineage',
      [
        {
          ...row,
          'Impacted Asset': 'customer_orders',
          'Impacted Asset Type': 'table',
        },
        {
          ...row,
          'Impacted Asset': 'customer_orders_V',
          'Impacted Asset Type': 'table',
        },
      ],
      exportColumns,
    )

    await exportRows(sheet.rows, processedColumns)

    const worksheet = exportCapture.workbook?.Sheets['Processed Lineage']
    expect(worksheet?.A1.s.fill.fgColor.rgb).toBe('1E3A5F')
    expect(worksheet?.A2.s?.fill).toBeUndefined()
    expect(worksheet?.A3.s.fill.fgColor.rgb).toBe('FFF2CC')
    expect(worksheet?.E3.s.fill.fgColor.rgb).toBe('FFF2CC')
    expect(worksheet?.J3.s.fill.fgColor.rgb).toBe('FFF2CC')
    // "Issue?" is the rightmost column (K) and tracks the same validation.
    expect(worksheet?.K1.v).toBe('Issue?')
    expect(worksheet?.K2.v).toBe('No')
    expect(worksheet?.K3.v).toBe('Yes')
    expect(worksheet?.K3.s.fill.fgColor.rgb).toBe('FFF2CC')
    expect(worksheet?.['!autofilter']).toEqual({ ref: 'A1:K1' })
  })

  it('exports workbook and metric hyperlinks with borders and a lineage link', async () => {
    const processed = processSheet('Lineage', [row], columns)
    processed.rows[0].hyperlinks = {
      'Source Asset': {
        target: 'https://example.atlan.com/assets/customer',
      },
    }

    await exportRows(processed.rows, columns, undefined, [
      {
        metricName: 'Unique Sales',
        rows: processed.rows,
        columns: ['Measure Name', ...columns],
        extras: {
          columns: ['Measure Name'],
          valueFor: () => ({ 'Measure Name': 'Unique Sales Measure' }),
          hyperlinkFor: (_, column) =>
            column === 'Measure Name'
              ? { target: 'https://example.atlan.com/metrics/unique-sales' }
              : undefined,
        },
        lineageUrl:
          'https://example.com/Polan/#/lineage?metricId=metric-1',
      },
    ])

    const worksheet = exportCapture.workbook?.Sheets['Unique Sales']
    expect(worksheet?.A2.l.Target).toBe(
      'https://example.atlan.com/metrics/unique-sales',
    )
    expect(worksheet?.B2.l.Target).toBe(
      'https://example.atlan.com/assets/customer',
    )
    expect(worksheet?.A1.s.border.top.style).toBe('thin')
    expect(worksheet?.E2.s.border.right.style).toBe('thin')
    expect(worksheet?.A5.v).toBe('To view lineage for this metric,')
    expect(worksheet?.B5.v).toBe('click here')
    expect(worksheet?.B5.l.Target).toBe(
      'https://example.com/Polan/#/lineage?metricId=metric-1',
    )
    expect(worksheet?.B5.s.border.bottom.style).toBe('thin')
    expect(worksheet?.['!autofilter']).toEqual({ ref: 'A1:E1' })
  })
})
