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
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet([row]),
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
    expect(worksheet?.['!autofilter']).toEqual({ ref: 'A1:J1' })
  })
})
