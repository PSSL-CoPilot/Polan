import type { ProcessedRow } from '../types'

type ImpactedAssetFields = Partial<
  Pick<ProcessedRow, 'impactedAsset' | 'impactedAssetType'>
>

export const IMPACTED_ASSET_TYPE_WARNING =
  'Impacted Asset Type should be "view" when Impacted Asset ends with "_V"; otherwise it should be "table".'

export function isImpactedAssetTypeMismatch(
  row: ImpactedAssetFields,
): boolean {
  const impactedAsset = row.impactedAsset?.trim() ?? ''
  if (!impactedAsset) return false

  const expectedType = impactedAsset.toLowerCase().endsWith('_v')
    ? 'view'
    : 'table'
  const actualType = row.impactedAssetType?.trim().toLowerCase() ?? ''

  return actualType !== expectedType
}
