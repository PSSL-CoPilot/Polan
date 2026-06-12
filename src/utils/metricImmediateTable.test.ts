import { describe, expect, it } from 'vitest'
import type { MetricRecord, OriginalRow } from '../types'
import {
  immediateTableExists,
  immediateTableOptions,
  metricImmediateTable,
  resolveImmediateUpstreamAsset,
} from './metricImmediateTable'
import { processSheet } from './workbook'

const columns = [
  'Source Asset',
  'Impacted Asset',
  'Direction',
  'Qualified Name',
]

const input = (
  impactedAsset: string,
  direction = 'upstream',
): OriginalRow => ({
  'Source Asset': 'Sales Model',
  'Impacted Asset': impactedAsset,
  Direction: direction,
  'Qualified Name': 'a/b/c/proj/sales_USL/table',
})

describe('metric Immediate Table helpers', () => {
  it('returns unique, sorted Impacted Asset values for a sheet', () => {
    const sheet = processSheet(
      'Sales',
      [
        input(' bq_orders '),
        input('BQ_ORDERS'),
        input('Revenue Report', 'downstream'),
        input('bq_customers'),
      ],
      columns,
    )

    expect(immediateTableOptions(sheet)).toEqual([
      'bq_customers',
      'bq_orders',
      'Revenue Report',
    ])
  })

  it('resolves selections case-insensitively only from upstream rows', () => {
    const sheet = processSheet(
      'Sales',
      [input('bq_orders'), input('Revenue Report', 'downstream')],
      columns,
    )

    expect(
      resolveImmediateUpstreamAsset(
        sheet.rows,
        'Sales',
        ' BQ_ORDERS ',
      ),
    ).toBe('bq_orders')
    expect(
      resolveImmediateUpstreamAsset(
        sheet.rows,
        'Sales',
        'Revenue Report',
      ),
    ).toBeUndefined()
  })

  it('reads selections and detects missing saved values safely', () => {
    const metric: MetricRecord = {
      id: 'metric',
      name: 'Revenue',
      measureName: 'SUM(revenue)',
      connectedSheets: ['Sales'],
      immediateTables: { Sales: 'bq_orders' },
    }

    expect(metricImmediateTable(metric, 'Sales')).toBe('bq_orders')
    expect(immediateTableExists(['BQ_ORDERS'], 'bq_orders')).toBe(true)
    expect(immediateTableExists(['bq_customers'], 'bq_orders')).toBe(false)
  })
})
