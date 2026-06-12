import { describe, expect, it } from 'vitest'
import type {
  Layer,
  ProcessedRow,
  SheetData,
  UploadedWorkbook,
} from '../types'
import {
  ALL_DASHBOARD_SHEETS,
  ALL_DASHBOARD_WORKBOOKS,
  computeDashboardMetrics,
  getDashboardRows,
  getDashboardSheetOptions,
} from './dashboardMetrics'

let rowId = 0

const row = (
  values: Partial<ProcessedRow> & Pick<ProcessedRow, 'sheet'>,
): ProcessedRow => ({
  id: `row-${rowId++}`,
  original: {},
  sourceAsset: 'Sales Model',
  impactedAsset: 'Warehouse Table',
  direction: 'upstream',
  qualifiedName: '',
  projectName: '',
  datasetName: '',
  tableName: '',
  mdrAvailability: false,
  layer: 'No Layers',
  ...values,
})

const sheet = (name: string, rows: ProcessedRow[]): SheetData => ({
  name,
  originalColumns: [],
  rows,
  errors: [],
  warnings: [],
})

const workbook = (
  id: string,
  displayName: string,
  sheets: SheetData[],
): UploadedWorkbook => ({
  id,
  displayName,
  originalFileName: `${displayName}.xlsx`,
  sizeLabel: '1 KB',
  loadedAt: new Date('2026-01-01'),
  sheets,
})

describe('dashboard calculations', () => {
  it('calculates every KPI from processed rows rather than graph nodes', () => {
    const rows = [
      row({
        sheet: 'Sales',
        sourceAsset: ' Sales Model ',
        direction: ' UPSTREAM ',
        layer: 'Gold',
        mdrAvailability: true,
      }),
      row({
        sheet: 'Sales',
        sourceAsset: 'sales model',
        direction: 'upstream',
        layer: 'Silver',
      }),
      row({
        sheet: 'Sales',
        sourceAsset: 'Finance Model',
        impactedAsset: 'Executive Dashboard',
        impactedAssetType: undefined,
        direction: 'DownStream',
        layer: 'Raw',
        mdrAvailability: true,
      }),
      row({
        sheet: 'Sales',
        sourceAsset: 'Finance Model',
        impactedAsset: 'Sales output',
        impactedAssetType: 'DATASET',
        direction: 'downstream',
        layer: 'Bronze' as Layer,
      }),
      row({
        sheet: 'Sales',
        sourceAsset: '',
        impactedAsset: 'Unclassified output',
        direction: 'downstream',
        layer: 'No Layers',
      }),
    ]

    expect(computeDashboardMetrics(rows)).toEqual({
      totalAssets: 5,
      upstreamAssets: 2,
      downstreamAssets: 3,
      powerbiAssets: 2,
      reports: 1,
      datasets: 1,
      gold: 1,
      silver: 1,
      raw: 2,
      noLayer: 1,
      mdrYes: 2,
      mdrNo: 3,
    })
  })

  it('scopes rows by workbook and sheet across the full collection', () => {
    const workbooks = [
      workbook('one', 'One', [
        sheet('Sales', [row({ sheet: 'Sales' }), row({ sheet: 'Sales' })]),
        sheet('Finance', [row({ sheet: 'Finance' })]),
      ]),
      workbook('two', 'Two', [
        sheet('sales', [row({ sheet: 'sales' })]),
        sheet('Marketing', [row({ sheet: 'Marketing' })]),
      ]),
    ]

    expect(
      getDashboardRows(workbooks, {
        workbookId: ALL_DASHBOARD_WORKBOOKS,
        sheetName: ALL_DASHBOARD_SHEETS,
      }),
    ).toHaveLength(5)
    expect(
      getDashboardRows(workbooks, {
        workbookId: 'one',
        sheetName: ALL_DASHBOARD_SHEETS,
      }),
    ).toHaveLength(3)
    expect(
      getDashboardRows(workbooks, {
        workbookId: ALL_DASHBOARD_WORKBOOKS,
        sheetName: 'Sales',
      }),
    ).toHaveLength(3)
    expect(getDashboardSheetOptions(workbooks, 'one')).toEqual([
      'Finance',
      'Sales',
    ])
    expect(
      getDashboardSheetOptions(workbooks, ALL_DASHBOARD_WORKBOOKS),
    ).toEqual(['Finance', 'Marketing', 'Sales'])
  })

  it('handles empty input without throwing', () => {
    expect(computeDashboardMetrics([])).toEqual({
      totalAssets: 0,
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
    })
    expect(
      getDashboardRows([], {
        workbookId: ALL_DASHBOARD_WORKBOOKS,
        sheetName: ALL_DASHBOARD_SHEETS,
      }),
    ).toEqual([])
  })
})
