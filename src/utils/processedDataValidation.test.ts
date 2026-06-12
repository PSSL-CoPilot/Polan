import { describe, expect, it } from 'vitest'
import { isImpactedAssetTypeMismatch } from './processedDataValidation'

const mismatch = (impactedAsset: string, impactedAssetType?: string) =>
  isImpactedAssetTypeMismatch({ impactedAsset, impactedAssetType })

describe('Processed Data impacted asset validation', () => {
  it('accepts matching view and table asset types', () => {
    expect(mismatch('customer_orders_V', 'view')).toBe(false)
    expect(mismatch('customer_orders', 'table')).toBe(false)
  })

  it('flags mismatched view and table asset types', () => {
    expect(mismatch('customer_orders_V', 'table')).toBe(true)
    expect(mismatch('customer_orders', 'view')).toBe(true)
  })

  it('trims values and compares them case-insensitively', () => {
    expect(mismatch('  customer_orders_v  ', ' VIEW ')).toBe(false)
    expect(mismatch('  customer_orders  ', ' TABLE ')).toBe(false)
  })

  it('ignores blank assets and flags a blank type for a present asset', () => {
    expect(mismatch('   ', 'view')).toBe(false)
    expect(mismatch('', undefined)).toBe(false)
    expect(isImpactedAssetTypeMismatch({})).toBe(false)
    expect(mismatch('customer_orders', '')).toBe(true)
    expect(mismatch('customer_orders_V', undefined)).toBe(true)
  })
})
