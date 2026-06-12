import type {
  AssetRecord,
  CellHyperlink,
  CellValue,
  ProcessedRow,
} from '../types'

const displayValue = (value: CellValue) =>
  value === null || value === undefined ? '' : String(value).trim()

export function safeBrowserHyperlink(
  hyperlink: CellHyperlink | undefined,
): string | undefined {
  const target = hyperlink?.target.trim()
  if (!target) return undefined

  if (target.startsWith('#') || target.startsWith('/')) return target

  try {
    const url = new URL(target)
    return ['http:', 'https:', 'mailto:', 'tel:'].includes(url.protocol)
      ? target
      : undefined
  } catch {
    return undefined
  }
}

export function hyperlinkForOriginalColumn(
  row: ProcessedRow,
  column: string,
): CellHyperlink | undefined {
  return row.hyperlinks?.[column]
}

export function hyperlinkForMatchingValue(
  row: ProcessedRow,
  value: CellValue,
): CellHyperlink | undefined {
  const expected = displayValue(value).toLowerCase()
  if (!expected) return undefined

  return Object.entries(row.hyperlinks ?? {}).find(([column]) => {
    return displayValue(row.original[column]).toLowerCase() === expected
  })?.[1]
}

export function hyperlinkForAsset(
  asset: AssetRecord | undefined,
): CellHyperlink | undefined {
  if (!asset) return undefined

  for (const row of asset.rows) {
    const hyperlink = hyperlinkForMatchingValue(row, asset.name)
    if (hyperlink) return hyperlink
  }
  return undefined
}
