import { describe, expect, it } from 'vitest'
import { paginate } from './pagination'

describe('paginate', () => {
  const rows = Array.from({ length: 245 }, (_, index) => index + 1)

  it('returns 100 rows per page and preserves the final partial page', () => {
    expect(paginate(rows, 1, 100)).toMatchObject({
      currentPage: 1,
      totalPages: 3,
      startIndex: 0,
      endIndex: 100,
    })
    expect(paginate(rows, 2, 100).items).toEqual(rows.slice(100, 200))
    expect(paginate(rows, 3, 100).items).toEqual(rows.slice(200))
  })

  it('clamps invalid pages and handles empty input safely', () => {
    expect(paginate(rows, 99, 100).currentPage).toBe(3)
    expect(paginate(rows, -2, 100).currentPage).toBe(1)
    expect(paginate([], 4, 100)).toEqual({
      currentPage: 1,
      totalPages: 1,
      startIndex: 0,
      endIndex: 0,
      items: [],
    })
  })
})
