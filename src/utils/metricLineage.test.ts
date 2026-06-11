import { describe, expect, it } from 'vitest'
import type { MetricRecord, OriginalRow } from '../types'
import { buildLineage } from './lineage'
import { buildMetricTableContext } from './metricData'
import { processSheet } from './workbook'

const columns = ['Source Asset', 'Impacted Asset', 'Direction', 'Qualified Name']

const sheetRows: OriginalRow[] = [
  {
    'Source Asset': 'Sales Model',
    'Impacted Asset': 'bq_orders',
    Direction: 'upstream',
    'Qualified Name': 'a/b/c/proj/sales_USL/orders',
  },
  {
    'Source Asset': 'Sales Model',
    'Impacted Asset': 'Sales Dataset',
    Direction: 'downstream',
    'Qualified Name': 'a/b/c/proj/sales_USL/sales_dataset',
  },
  {
    'Source Asset': 'Sales Model',
    'Impacted Asset': 'Revenue Report',
    Direction: 'downstream',
    'Qualified Name': 'a/b/c/proj/sales_USL/revenue_report',
  },
]

const metric: MetricRecord = {
  id: 'm1',
  name: 'Net Revenue',
  measureName: 'SUM(net_revenue)',
  atlanLink: 'https://example.atlan.com/metric/net-revenue',
  connectedSheets: ['Sales'],
}

describe('metric lineage insertion', () => {
  it('places the metric between source tables and the Power BI table', () => {
    const sheet = processSheet('Sales', sheetRows, columns)
    const graph = buildLineage(sheet.rows, [metric])
    const metricAsset = Array.from(graph.assets.values()).find(
      (asset) => asset.type === 'metric',
    )

    expect(metricAsset).toBeDefined()
    expect(metricAsset!.metric?.measureName).toBe('SUM(net_revenue)')
    // BigQuery table now feeds the metric, and the metric feeds the table.
    expect(metricAsset!.upstreamIds).toEqual(['bq-orders'])
    expect(metricAsset!.downstreamIds).toEqual(['sales-model'])
    // The Power BI table's only upstream is the metric (rerouted).
    expect(graph.assets.get('sales-model')?.upstreamIds).toEqual([
      metricAsset!.id,
    ])
    // Downstream chain is untouched: PBI → Dataset → Report.
    expect(graph.assets.get('sales-model')?.downstreamIds).toEqual([
      'sales-dataset',
    ])
    expect(graph.assets.get('sales-dataset')?.downstreamIds).toEqual([
      'revenue-report',
    ])
  })

  it('does not alter the graph when the metric has no connected sheets', () => {
    const sheet = processSheet('Sales', sheetRows, columns)
    const plain = buildLineage(sheet.rows)
    const withUnconnected = buildLineage(sheet.rows, [
      { ...metric, connectedSheets: [] },
    ])
    expect(withUnconnected.relations).toEqual(plain.relations)
    expect(withUnconnected.assets.size).toBe(plain.assets.size)
  })

  it('builds processed-data extras for connected rows', () => {
    const sheet = processSheet('Sales', sheetRows, columns)
    const graph = buildLineage(sheet.rows, [metric])
    const context = buildMetricTableContext(metric, sheet.rows, graph.assets)

    expect(context).not.toBeNull()
    expect(context!.columns).toEqual([
      'Report 1',
      'Dataset',
      'Metric Name',
      'Measure Name',
    ])
    const first = context!.byRowId.get(sheet.rows[0].id)
    expect(first).toMatchObject({
      Dataset: 'Sales Dataset',
      'Metric Name': 'Net Revenue',
      'Measure Name': 'SUM(net_revenue)',
      'Report 1': 'Revenue Report',
    })
  })
})
