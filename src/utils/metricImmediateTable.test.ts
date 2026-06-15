import { describe, expect, it } from 'vitest'
import type { MetricRecord, OriginalRow } from '../types'
import {
  immediateTableExists,
  immediateTableOptions,
  metricImmediateTables,
  resolveImmediateUpstreamAssets,
  toImmediateTableList,
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

  it('resolves multiple selections case-insensitively from upstream rows only', () => {
    const sheet = processSheet(
      'Sales',
      [
        input('bq_orders'),
        input('bq_customers'),
        input('Revenue Report', 'downstream'),
      ],
      columns,
    )

    // Resolves upstream matches, drops downstream/unknown, de-duplicates.
    expect(
      resolveImmediateUpstreamAssets(sheet.rows, 'Sales', [
        ' BQ_ORDERS ',
        'bq_customers',
        'bq_orders',
        'Revenue Report',
        'missing_table',
      ]),
    ).toEqual(['bq_orders', 'bq_customers'])
    expect(resolveImmediateUpstreamAssets(sheet.rows, 'Sales', [])).toEqual([])
  })

  it('reads array selections, migrates legacy strings, and detects missing values', () => {
    const metric: MetricRecord = {
      id: 'metric',
      name: 'Revenue',
      measureName: 'SUM(revenue)',
      connectedSheets: ['Sales'],
      immediateTables: { Sales: ['bq_orders', 'bq_customers'] },
    }

    expect(metricImmediateTables(metric, 'Sales')).toEqual([
      'bq_orders',
      'bq_customers',
    ])
    // Legacy single-string value is normalized to a one-element list.
    expect(
      metricImmediateTables(
        {
          ...metric,
          immediateTables: { Sales: 'bq_orders' as unknown as string[] },
        },
        'Sales',
      ),
    ).toEqual(['bq_orders'])
    expect(toImmediateTableList(' bq_orders ')).toEqual(['bq_orders'])
    expect(toImmediateTableList(['a', 'A', ' a ', '', 7])).toEqual(['a'])
    expect(immediateTableExists(['BQ_ORDERS'], 'bq_orders')).toBe(true)
    expect(immediateTableExists(['bq_customers'], 'bq_orders')).toBe(false)
  })
})
