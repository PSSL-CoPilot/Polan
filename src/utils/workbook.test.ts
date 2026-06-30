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

  it('parses sheets whose header is preceded by blank/title rows', async () => {
    // A newly added sheet whose data does not start on row 1: a title row, a
    // blank row, then the real header and one data row.
    const aoa = [
      ['Quarterly lineage export'],
      [],
      ['Source Asset', 'Impacted Asset', 'Direction', 'Qualified Name'],
      [
        'Customer Table',
        'bq_customer',
        'upstream',
        'a/b/c/project_alpha/customer_USL/customer',
      ],
    ]
    const worksheet = XLSX.utils.aoa_to_sheet(aoa)
    // Native hyperlink on the data row's Source Asset cell (A4).
    worksheet.A4 = {
      ...(worksheet.A4 as XLSX.CellObject),
      l: { Target: 'https://example.atlan.com/assets/customer' },
    }
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Offset Header')
    const bytes = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
    const file = new File([bytes], 'offset-header.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })

    const parsed = await parseWorkbookFile(file)
    const sheet = parsed.sheets[0]

    expect(sheet.errors).toEqual([])
    expect(sheet.originalColumns).toEqual([
      'Source Asset',
      'Impacted Asset',
      'Direction',
      'Qualified Name',
    ])
    expect(sheet.rows).toHaveLength(1)
    expect(sheet.rows[0]).toMatchObject({
      sourceAsset: 'Customer Table',
      impactedAsset: 'bq_customer',
      direction: 'upstream',
      layer: 'Gold',
    })
    // The hyperlink must still line up with the correct (offset) data row.
    expect(sheet.rows[0].hyperlinks?.['Source Asset']?.target).toBe(
      'https://example.atlan.com/assets/customer',
    )
  })

  it('treats the first column as Source Asset for Atlan exports lacking one', async () => {
    // Mirrors Check1.xlsx / T_Cancels_By_Channel: the first column is named
    // after the asset ("Cancels"), there is no explicit "Source Asset" column,
    // but Impacted Asset / Direction / Qualified Name are present.
    const header = [
      'Cancels',
      'Source Asset Connector',
      'Source Asset Type',
      'Impacted Asset',
      'Impacted Asset Type',
      'Direction',
      'Qualified Name',
      'Source Asset GUID',
    ]
    const dataRow = [
      'T_cancels by channel',
      'Power BI',
      'Table',
      'CUST_ACCT_DIM_MV',
      'View',
      'upstream',
      'default/bigquery/1760585669/da-prod-dwh-dw01/DWH_QF_MM_BQD/CUST_ACCT_DIM_MV',
      'c4c9e452-9fb5-4b8f-924e-2c075fc75482',
    ]
    const worksheet = XLSX.utils.aoa_to_sheet([header, dataRow])
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'T_Cancels_By_Channel')
    const bytes = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
    const file = new File([bytes], 'check1.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })

    const parsed = await parseWorkbookFile(file)
    const sheet = parsed.sheets[0]

    // Not marked invalid despite the missing "Source Asset" column.
    expect(sheet.errors).toEqual([])
    expect(sheet.rows).toHaveLength(1)
    // Original first-column name is preserved for the table UI...
    expect(sheet.originalColumns[0]).toBe('Cancels')
    // ...but its value is mapped internally as the Source Asset.
    expect(sheet.rows[0].sourceAsset).toBe('T_cancels by channel')
    expect(sheet.rows[0].impactedAsset).toBe('CUST_ACCT_DIM_MV')
    expect(sheet.rows[0].impactedAssetType).toBe('View')
    expect(sheet.rows[0].direction).toBe('upstream')
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
