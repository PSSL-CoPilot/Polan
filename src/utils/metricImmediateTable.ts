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

export function metricImmediateTable(
  metric: MetricRecord,
  sheetName: string,
): string | undefined {
  const value = metric.immediateTables?.[sheetName]?.trim()
  return value || undefined
}

export function immediateTableExists(
  options: string[],
  selected: string | undefined,
): boolean {
  if (!selected) return false
  const key = normalized(selected)
  return options.some((option) => normalized(option) === key)
}

export function resolveImmediateUpstreamAsset(
  rows: ProcessedRow[],
  sheetName: string,
  selected: string | undefined,
): string | undefined {
  if (!selected) return undefined
  const selectedKey = normalized(selected)
  return rows.find(
    (row) =>
      row.sheet === sheetName &&
      row.direction.trim().toLowerCase() === 'upstream' &&
      normalized(row.impactedAsset) === selectedKey,
  )?.impactedAsset
}
