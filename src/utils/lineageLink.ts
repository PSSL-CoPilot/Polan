export interface LineageRoute {
  metricId: string
  workbookId?: string
}

export function parseLineageRoute(hash: string): LineageRoute | null {
  const normalized = hash.startsWith('#') ? hash.slice(1) : hash
  const [path, query = ''] = normalized.split('?')
  if (path !== '/lineage') return null

  const params = new URLSearchParams(query)
  const metricId = params.get('metricId')?.trim()
  if (!metricId) return null

  return {
    metricId,
    workbookId: params.get('workbookId')?.trim() || undefined,
  }
}

export function buildMetricLineageUrl(
  metricId: string,
  workbookId?: string | null,
) {
  const url = new URL(window.location.href)
  const params = new URLSearchParams({ metricId })
  if (workbookId) params.set('workbookId', workbookId)
  url.hash = `/lineage?${params.toString()}`
  return url.toString()
}
