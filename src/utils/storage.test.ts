import { describe, expect, it } from 'vitest'
import { sanitizeProject } from './storage'

describe('metric Immediate Table persistence', () => {
  it('sanitizes saved per-sheet Immediate Tables (new array shape)', () => {
    const project = sanitizeProject({
      name: 'Project',
      views: [
        {
          id: 'view',
          name: 'View',
          metrics: [
            {
              id: 'metric',
              name: 'Revenue',
              measureName: 'SUM(revenue)',
              connectedSheets: ['Sales'],
              immediateTables: {
                ' Sales ': [' bq_orders ', 'bq_customers', 'bq_orders'],
                Empty: [],
                Invalid: [42, null],
              },
            },
          ],
        },
      ],
    })

    // Trimmed, de-duplicated, empties dropped.
    expect(project?.views[0].metrics[0].immediateTables).toEqual({
      Sales: ['bq_orders', 'bq_customers'],
    })
  })

  it('migrates legacy single-string Immediate Tables into arrays', () => {
    const project = sanitizeProject({
      name: 'Project',
      views: [
        {
          id: 'view',
          name: 'View',
          metrics: [
            {
              id: 'metric',
              name: 'Revenue',
              measureName: 'SUM(revenue)',
              connectedSheets: ['Sales'],
              // Old `.polan.json` shape: one string per sheet.
              immediateTables: { Sales: ' bq_orders ', Empty: '' },
            },
          ],
        },
      ],
    })

    expect(project?.views[0].metrics[0].immediateTables).toEqual({
      Sales: ['bq_orders'],
    })
  })

  it('migrates older metrics without Immediate Table metadata', () => {
    const project = sanitizeProject({
      name: 'Project',
      views: [
        {
          id: 'view',
          name: 'View',
          metrics: [
            {
              id: 'metric',
              name: 'Revenue',
              measureName: 'SUM(revenue)',
              connectedSheets: ['Sales'],
            },
          ],
        },
      ],
    })

    expect(project?.views[0].metrics[0].immediateTables).toEqual({})
  })
})
