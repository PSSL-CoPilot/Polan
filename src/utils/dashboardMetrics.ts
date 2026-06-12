import type { MetricRecord, ProcessedRow } from '../types'
import { buildLineage } from './lineage'

export interface DashboardMetrics {
  totalAssets: number
  upstreamAssets: number
  downstreamAssets: number
  powerbiAssets: number
  gold: number
  silver: number
  raw: number
  noLayer: number
  mdrYes: number
  mdrNo: number
  reports: number
  datasets: number
}

export function computeDashboardMetrics(
  rows: ProcessedRow[],
  metrics: MetricRecord[] = [],
): DashboardMetrics | null {
  if (!rows.length) return null

  const { assets } = buildLineage(rows, metrics)

  const m: DashboardMetrics = {
    totalAssets: assets.size,
    upstreamAssets: 0,
    downstreamAssets: 0,
    powerbiAssets: 0,
    gold: 0,
    silver: 0,
    raw: 0,
    noLayer: 0,
    mdrYes: 0,
    mdrNo: 0,
    reports: 0,
    datasets: 0,
  }

  assets.forEach((asset) => {
    switch (asset.type) {
      case 'bigquery':
        m.upstreamAssets++
        break
      case 'powerbi':
        m.powerbiAssets++
        break
      case 'dataset':
        m.downstreamAssets++
        m.datasets++
        break
      case 'report':
        m.downstreamAssets++
        m.reports++
        break
    }

    switch (asset.layer) {
      case 'Gold':
        m.gold++
        break
      case 'Silver':
        m.silver++
        break
      case 'Raw':
        m.raw++
        break
      default:
        m.noLayer++
        break
    }

    if (asset.mdrAvailability) m.mdrYes++
    else m.mdrNo++
  })

  return m
}
