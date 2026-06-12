import { describe, expect, it } from 'vitest'
import type { MetricRecord, OriginalRow } from '../types'
import { buildFocusedView, buildLineage } from './lineage'
import {
  buildMetricTableContext,
  buildMetricTableEntries,
  metricColumnsForEntries,
} from './metricData'
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
  immediateTables: {},
}

describe('metric lineage insertion', () => {
  it('places the metric between the Power BI table and downstream assets', () => {
    const sheet = processSheet('Sales', sheetRows, columns)
    const graph = buildLineage(sheet.rows, [metric])
    const metricAsset = Array.from(graph.assets.values()).find(
      (asset) => asset.type === 'metric',
    )

    expect(metricAsset).toBeDefined()
    expect(metricAsset!.metric?.measureName).toBe('SUM(net_revenue)')
    // The Power BI table feeds the metric, which feeds the dataset.
    expect(metricAsset!.upstreamIds).toEqual(['sales-model'])
    expect(metricAsset!.downstreamIds).toEqual(['sales-dataset'])
    // Upstream source tables remain connected directly to Power BI.
    expect(graph.assets.get('sales-model')?.upstreamIds).toEqual(['bq-orders'])
    // The downstream chain is PBI → Metric → Dataset → Report.
    expect(graph.assets.get('sales-model')?.downstreamIds).toEqual([
      metricAsset!.id,
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

  it('connects the selected Immediate Table directly into Power BI once', () => {
    const sheet = processSheet(
      'Sales',
      [
        sheetRows[0],
        {
          ...sheetRows[0],
          'Impacted Asset': 'bq_customers',
          'Qualified Name': 'a/b/c/proj/sales_USL/customers',
        },
        ...sheetRows.slice(1),
      ],
      columns,
    )
    const configuredMetric: MetricRecord = {
      ...metric,
      immediateTables: { Sales: ' BQ_ORDERS ' },
    }
    const graph = buildLineage(sheet.rows, [configuredMetric])
    const metricAsset = Array.from(graph.assets.values()).find(
      (asset) => asset.type === 'metric',
    )
    const relationKeys = graph.relations.map(
      (relation) => `${relation.source}->${relation.target}`,
    )

    expect(metricAsset?.upstreamIds).toEqual(['sales-model'])
    expect(relationKeys).toContain('bq-orders->sales-model')
    expect(relationKeys).toContain('bq-customers->sales-model')
    expect(relationKeys).toContain(`sales-model->${metricAsset!.id}`)
    expect(relationKeys).toContain(`${metricAsset!.id}->sales-dataset`)
    expect(relationKeys).not.toContain('bq-customers->bq-orders')
    expect(
      relationKeys.filter((key) => key === 'bq-orders->sales-model'),
    ).toHaveLength(1)
    expect(new Set(relationKeys).size).toBe(relationKeys.length)

    const focused = buildFocusedView(
      'sales-model',
      graph.assets,
      graph.relations,
    )
    expect(focused.visibleAssetIds).toEqual(
      new Set([
        'sales-model',
        metricAsset!.id,
        'bq-orders',
        'bq-customers',
        'sales-dataset',
        'revenue-report',
      ]),
    )
  })

  it('keeps existing metric routing when the saved Immediate Table is missing', () => {
    const sheet = processSheet(
      'Sales',
      [
        sheetRows[0],
        {
          ...sheetRows[0],
          'Impacted Asset': 'bq_customers',
          'Qualified Name': 'a/b/c/proj/sales_USL/customers',
        },
      ],
      columns,
    )
    const graph = buildLineage(sheet.rows, [
      {
        ...metric,
        immediateTables: { Sales: 'removed_table' },
      },
    ])
    const metricAsset = Array.from(graph.assets.values()).find(
      (asset) => asset.type === 'metric',
    )

    expect(metricAsset?.upstreamIds).toEqual(['sales-model'])
    expect(graph.assets.get('sales-model')?.upstreamIds).toEqual([
      'bq-orders',
      'bq-customers',
    ])
  })

  it('applies a separate Immediate Table for every linked sheet', () => {
    const sales = processSheet(
      'Sales',
      [
        sheetRows[0],
        {
          ...sheetRows[0],
          'Impacted Asset': 'bq_customers',
        },
      ],
      columns,
    )
    const marketing = processSheet(
      'Marketing',
      [
        {
          ...sheetRows[0],
          'Source Asset': 'Campaign Model',
          'Impacted Asset': 'bq_campaigns',
        },
        {
          ...sheetRows[0],
          'Source Asset': 'Campaign Model',
          'Impacted Asset': 'bq_channels',
        },
      ],
      columns,
    )
    const graph = buildLineage([...sales.rows, ...marketing.rows], [
      {
        ...metric,
        connectedSheets: ['Sales', 'Marketing'],
        immediateTables: {
          Sales: 'bq_orders',
          Marketing: 'bq_campaigns',
        },
      },
    ])
    const metricAsset = Array.from(graph.assets.values()).find(
      (asset) => asset.type === 'metric',
    )

    expect(metricAsset?.upstreamIds).toEqual([
      'sales-model',
      'campaign-model',
    ])
    expect(graph.assets.get('sales-model')?.upstreamIds).toEqual([
      'bq-orders',
      'bq-customers',
    ])
    expect(graph.assets.get('campaign-model')?.upstreamIds).toEqual([
      'bq-campaigns',
      'bq-channels',
    ])
    expect(metricAsset?.downstreamIds).toEqual([])
  })

  it('builds independent processed-data contexts for every metric', () => {
    const secondMetric: MetricRecord = {
      ...metric,
      id: 'm2',
      name: 'Unique Sales',
      measureName: 'DISTINCTCOUNT(order_id)',
    }
    const sheet = processSheet('Sales', sheetRows, columns)
    const graph = buildLineage(sheet.rows, [metric, secondMetric])
    const entries = buildMetricTableEntries(
      [metric, secondMetric],
      sheet.rows,
      graph.assets,
    )

    expect(entries).toHaveLength(2)
    expect(entries.map((entry) => entry.metric.name)).toEqual([
      'Net Revenue',
      'Unique Sales',
    ])
    expect(entries.every((entry) => entry.context?.byRowId.size === 3)).toBe(
      true,
    )
    expect(metricColumnsForEntries(entries)).toEqual([
      'Report 1',
      'Dataset',
      'Metric Name',
      'Measure Name',
    ])
  })
})
