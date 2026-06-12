import { describe, expect, it } from 'vitest'
import { sanitizeProject } from './storage'

describe('metric Immediate Table persistence', () => {
  it('sanitizes saved per-sheet Immediate Tables', () => {
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
                ' Sales ': ' bq_orders ',
                Empty: '',
                Invalid: 42,
              },
            },
          ],
        },
      ],
    })

    expect(project?.views[0].metrics[0].immediateTables).toEqual({
      Sales: 'bq_orders',
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
