import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { ProcessedRow, SheetData } from '../types'
import { DataTable } from './DataTable'

const makeRow = (index: number): ProcessedRow => ({
  id: `row-${index}`,
  sheet: 'Sales',
  original: {
    'Source Asset': `Source ${index}`,
    'Impacted Asset': `Table ${index}`,
    Direction: 'upstream',
    'Qualified Name': `project/dataset/table_${index}`,
  },
  sourceAsset: `Source ${index}`,
  impactedAsset: `Table ${index}`,
  direction: 'upstream',
  qualifiedName: `project/dataset/table_${index}`,
  projectName: 'project',
  datasetName: 'dataset',
  tableName: `table_${index}`,
  mdrAvailability: false,
  layer: 'No Layers',
})

describe('DataTable pagination', () => {
  it('renders only the first 100 filtered rows while reporting all pages', () => {
    const sheet: SheetData = {
      name: 'Sales',
      originalColumns: [
        'Source Asset',
        'Impacted Asset',
        'Direction',
        'Qualified Name',
      ],
      rows: Array.from({ length: 245 }, (_, index) => makeRow(index + 1)),
      errors: [],
      warnings: [],
    }

    const markup = renderToStaticMarkup(
      <DataTable
        directionFilter="upstream"
        includeDerived
        onSheetChange={() => undefined}
        selectedSheet="all"
        sheets={[sheet]}
      />,
    )

    expect((markup.match(/<tr/g) ?? []).length).toBe(101)
    expect((markup.match(/class="row-number"/g) ?? []).length).toBe(101)
    expect(markup).toContain('Page 1 of 3')
    expect(markup).toContain('1-100 of ')
    expect(markup).toContain('245 filtered')
    expect(markup).not.toContain('Source 101')
  })
})
