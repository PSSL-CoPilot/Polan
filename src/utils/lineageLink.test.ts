import { describe, expect, it } from 'vitest'
import { parseLineageRoute } from './lineageLink'

describe('metric lineage links', () => {
  it('parses metric and workbook identifiers from the hash route', () => {
    expect(
      parseLineageRoute(
        '#/lineage?metricId=metric-1&workbookId=workbook-1',
      ),
    ).toEqual({
      metricId: 'metric-1',
      workbookId: 'workbook-1',
    })
  })

  it('ignores unrelated or incomplete routes', () => {
    expect(parseLineageRoute('#/processed?metricId=metric-1')).toBeNull()
    expect(parseLineageRoute('#/lineage')).toBeNull()
  })
})
