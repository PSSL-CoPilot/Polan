import type { MetricRecord, ProcessedRow, SheetData } from '../types'

const normalized = (value: string) => value.trim().toLowerCase()

export function immediateTableOptions(sheet: SheetData): string[] {
  const values = new Map<string, string>()

  sheet.rows.forEach((row) => {
    const value = row.impactedAsset.trim()
    const key = normalized(value)
    if (key && !values.has(key)) values.set(key, value)
  })

  return Array.from(values.values()).sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: 'base' }),
  )
}

/**
 * Normalize a stored Immediate Table value into a clean, de-duplicated list.
 * Accepts both the legacy single-string shape and the new string-array shape,
 * so old `.polan.json` projects migrate transparently.
 */
export function toImmediateTableList(value: unknown): string[] {
  const raw = Array.isArray(value) ? value : [value]
  const seen = new Set<string>()
  const list: string[] = []
  raw.forEach((entry) => {
    if (typeof entry !== 'string') return
    const trimmed = entry.trim()
    const key = normalized(trimmed)
    if (!trimmed || seen.has(key)) return
    seen.add(key)
    list.push(trimmed)
  })
  return list
}

/** Selected Immediate Tables for a metric-sheet connection (possibly empty). */
export function metricImmediateTables(
  metric: MetricRecord,
  sheetName: string,
): string[] {
  return toImmediateTableList(metric.immediateTables?.[sheetName])
}

export function immediateTableExists(
  options: string[],
  selected: string | undefined,
): boolean {
  if (!selected) return false
  const key = normalized(selected)
  return options.some((option) => normalized(option) === key)
}

/**
 * Resolve the selected Immediate Tables to the actual upstream Impacted Asset
 * names present in the sheet. Selections that no longer exist (or are not
 * upstream rows) are dropped, so a missing table degrades gracefully.
 */
export function resolveImmediateUpstreamAssets(
  rows: ProcessedRow[],
  sheetName: string,
  selected: string[],
): string[] {
  if (!selected.length) return []
  const seen = new Set<string>()
  const resolved: string[] = []
  selected.forEach((value) => {
    const selectedKey = normalized(value)
    const match = rows.find(
      (row) =>
        row.sheet === sheetName &&
        row.direction.trim().toLowerCase() === 'upstream' &&
        normalized(row.impactedAsset) === selectedKey,
    )?.impactedAsset
    if (!match) return
    const matchKey = normalized(match)
    if (seen.has(matchKey)) return
    seen.add(matchKey)
    resolved.push(match)
  })
  return resolved
}
