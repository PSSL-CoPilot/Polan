export interface PaginationResult<T> {
  currentPage: number
  totalPages: number
  startIndex: number
  endIndex: number
  items: T[]
}

export function paginate<T>(
  items: T[],
  requestedPage: number,
  pageSize: number,
): PaginationResult<T> {
  const safePageSize = Math.max(1, Math.floor(pageSize))
  const totalPages = Math.max(1, Math.ceil(items.length / safePageSize))
  const currentPage = Math.min(
    totalPages,
    Math.max(1, Math.floor(requestedPage) || 1),
  )
  const startIndex = (currentPage - 1) * safePageSize
  const endIndex = Math.min(startIndex + safePageSize, items.length)

  return {
    currentPage,
    totalPages,
    startIndex,
    endIndex,
    items: items.slice(startIndex, endIndex),
  }
}
