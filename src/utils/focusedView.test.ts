import { describe, expect, it } from 'vitest'
import { buildFocusedView, buildLineage } from './lineage'
import { processSheet } from './workbook'
import type { OriginalRow } from '../types'

const columns = ['Source Asset', 'Impacted Asset', 'Direction', 'Qualified Name']

const upstreamRow = (table: string): OriginalRow => ({
  'Source Asset': 'Sales Model',
  'Impacted Asset': `bq_${table}`,
  Direction: 'upstream',
  'Qualified Name': `a/b/c/proj/sales_USL/${table}`,
})

const downstreamRow = (impacted: string, dataset: string): OriginalRow => ({
  'Source Asset': 'Sales Model',
  'Impacted Asset': impacted,
  Direction: 'downstream',
  'Qualified Name': `a/b/c/proj/${dataset}/${impacted.toLowerCase()}`,
})

function lineageFor(rows: OriginalRow[]) {
  const sheet = processSheet('Lineage', rows, columns)
  return buildLineage(sheet.rows)
}

describe('focused lineage view', () => {
  it('shows only 3 siblings with an expander, then reveals more', () => {
    const rows = ['t1', 't2', 't3', 't4', 't5', 't6', 't7'].map(upstreamRow)
    const graph = lineageFor(rows)
    const focusId = 'sales-model'

    const collapsed = buildFocusedView(focusId, graph.assets, graph.relations)
    const assetNodes = collapsed.nodes.filter((node) => node.type === 'asset')
    const expanders = collapsed.nodes.filter((node) => node.type === 'expander')

    // focus + first 3 upstream siblings are visible; the other 4 are hidden.
    expect(assetNodes).toHaveLength(4)
    expect(collapsed.upstreamCount).toBe(3)
    expect(expanders).toHaveLength(1)
    expect((expanders[0].data as { hiddenCount: number }).hiddenCount).toBe(4)

    const groupKey = (expanders[0].data as { groupKey: string }).groupKey
    const expanded = buildFocusedView(focusId, graph.assets, graph.relations, {
      [groupKey]: 6,
    })
    expect(expanded.upstreamCount).toBe(6)
  })

  it('chains Power BI → single dataset → reports', () => {
    const rows = [
      downstreamRow('Sales Dataset', 'sales_USL'),
      downstreamRow('Revenue Report', 'sales_USL'),
      downstreamRow('Margin Report', 'sales_USL'),
    ]
    const graph = lineageFor(rows)
    const dataset = graph.assets.get('sales-dataset')

    // Reports hang off the dataset, not directly off the Power BI table.
    expect(graph.assets.get('sales-model')?.downstreamIds).toEqual([
      'sales-dataset',
    ])
    expect(dataset?.downstreamIds).toEqual(['revenue-report', 'margin-report'])
  })
})
