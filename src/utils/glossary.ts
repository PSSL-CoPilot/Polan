import type {
  AssetRecord,
  AssetType,
  ProcessedRow,
  ViewRecord,
} from '../types'

/**
 * Glossary derivation
 * ----------------------------------------------------------------------------
 * The Glossary tab is built entirely from Polan's real data — there is no mock
 * dataset. Inputs:
 *   - processed rows  (Processed Data pane / generated workbook)
 *   - lineage assets  (buildLineage → report / dataset / table / metric nodes)
 *   - project views   (Project Explorer → metric groups + metrics)
 *
 * In Polan "report" and "dashboard" are the same concept, so report-type
 * lineage assets become the glossary's dashboards. Metric nodes injected into
 * the graph carry their MetricRecord, which we group by the Project Explorer
 * View the metric belongs to. Governance fields (owner, certification,
 * description) are read from the original Atlan columns on each row when present
 * and reported as "Not available"/"Unknown" otherwise — nothing is fabricated.
 */

export type CertStatus =
  | 'Certified'
  | 'Under Review'
  | 'Draft'
  | 'Deprecated'
  | 'Unknown'

export const CERT_STATUSES: CertStatus[] = [
  'Certified',
  'Under Review',
  'Draft',
  'Deprecated',
  'Unknown',
]

export interface GlossaryLinkedAsset {
  name: string
  type: string
  relationship: string
  owner: string | null
  status: string
}

export interface GlossaryMetricCounts {
  tables: number
  columns: number
  measures: number
  upstream: number
  downstream: number
  dashboards: number
  warnings: number
}

export interface GlossaryMetric {
  /** MetricRecord id — used to focus the metric in the Lineage tab. */
  id: string
  /** Lineage node id (metric-<id>); present only when a graph node exists. */
  lineageNodeId: string | null
  name: string
  measureName: string
  groupName: string
  definition: string | null
  formula: string | null
  measureType: string
  owner: string | null
  technicalOwner: string | null
  certification: CertStatus
  lastUpdated: string | null
  lastReviewed: string | null
  atlanLink: string | null
  counts: GlossaryMetricCounts
  linkedAssets: GlossaryLinkedAsset[]
  reportNames: string[]
  /** lower-cased haystack for search. */
  search: string
}

export interface GlossaryGroup {
  name: string
  metrics: GlossaryMetric[]
}

export interface GlossaryDashboard {
  id: string
  name: string
  groups: GlossaryGroup[]
  metricCount: number
  groupCount: number
  tableCount: number
  measureCount: number
  certification: Record<CertStatus, number>
  owner: string | null
  lastUpdated: string | null
  /** lower-cased haystack covering the dashboard and all its metrics. */
  search: string
}

export interface GlossaryTotals {
  dashboards: number
  metrics: number
  certified: number
  underReview: number
  tables: number
}

export interface Glossary {
  dashboards: GlossaryDashboard[]
  totals: GlossaryTotals
}

// ── Original (Atlan) column readers ──────────────────────────────────────────

/** Read the first non-empty value for any of the given header names (case-insensitive). */
function readOriginal(row: ProcessedRow, names: string[]): string | null {
  const wanted = new Set(names.map((name) => name.trim().toLowerCase()))
  for (const key of Object.keys(row.original)) {
    if (!wanted.has(key.trim().toLowerCase())) continue
    const value = row.original[key]
    const text = value === null || value === undefined ? '' : String(value).trim()
    if (text) return text
  }
  return null
}

function firstFromRows(rows: ProcessedRow[], names: string[]): string | null {
  for (const row of rows) {
    const value = readOriginal(row, names)
    if (value) return value
  }
  return null
}

/** First matching original value across the rows of several assets. */
function firstFromAssets(
  assetList: AssetRecord[],
  names: string[],
): string | null {
  for (const asset of assetList) {
    const value = firstFromRows(asset.rows, names)
    if (value) return value
  }
  return null
}

function mapCertification(value: string | null): CertStatus {
  if (!value) return 'Unknown'
  const text = value.toLowerCase()
  if (/verified|certified/.test(text)) return 'Certified'
  if (/review/.test(text)) return 'Under Review'
  if (/draft/.test(text)) return 'Draft'
  if (/deprecat/.test(text)) return 'Deprecated'
  return 'Unknown'
}

/** Certification of an asset, read from its rows' Atlan "Certification Status". */
function assetCertification(asset: AssetRecord): CertStatus {
  return mapCertification(firstFromRows(asset.rows, ['certification status']))
}

/** Owner of an asset, from Atlan "Owner Users" / "Owner Groups". */
function assetOwner(asset: AssetRecord): string | null {
  return firstFromRows(asset.rows, ['owner users', 'owner groups'])
}

/** A short, human status for a linked asset: certification, else layer/MDR. */
function assetStatus(asset: AssetRecord): string {
  const cert = assetCertification(asset)
  if (cert !== 'Unknown') return cert
  if (asset.layer && asset.layer !== 'No Layers') return `${asset.layer} layer`
  if (asset.mdrAvailability) return 'MDR available'
  return 'Unknown'
}

// ── Graph traversal ──────────────────────────────────────────────────────────

/** Transitive upstream/downstream closure of an asset (excludes the start). */
function closure(
  startId: string,
  assets: Map<string, AssetRecord>,
  direction: 'up' | 'down',
): Set<string> {
  const seen = new Set<string>()
  const stack = [startId]
  while (stack.length) {
    const current = assets.get(stack.pop()!)
    if (!current) continue
    const neighbours =
      direction === 'up' ? current.upstreamIds : current.downstreamIds
    for (const id of neighbours) {
      if (id === startId || seen.has(id)) continue
      seen.add(id)
      stack.push(id)
    }
  }
  return seen
}

const isTableType = (type: AssetType) =>
  type === 'bigquery' || type === 'powerbi'

// ── Metric builder ───────────────────────────────────────────────────────────

function buildGlossaryMetric(
  metricAsset: AssetRecord,
  assets: Map<string, AssetRecord>,
  groupName: string,
): GlossaryMetric {
  const record = metricAsset.metric
  const upstream = closure(metricAsset.id, assets, 'up')
  const downstream = closure(metricAsset.id, assets, 'down')

  const upAssets = [...upstream]
    .map((id) => assets.get(id))
    .filter((asset): asset is AssetRecord => Boolean(asset))
  const downAssets = [...downstream]
    .map((id) => assets.get(id))
    .filter((asset): asset is AssetRecord => Boolean(asset))

  const tables = upAssets.filter((asset) => isTableType(asset.type))
  const bigqueryTables = tables.filter((asset) => asset.type === 'bigquery')
  const datasets = downAssets.filter((asset) => asset.type === 'dataset')
  const reports = downAssets.filter((asset) => asset.type === 'report')

  const measureName = record?.measureName ?? ''
  const definition =
    record?.description ?? firstFromAssets(tables, ['description'])
  const owner = firstFromAssets(tables, ['owner users', 'owner groups'])
  // A metric's certification reflects its upstream source tables (real Atlan
  // governance); Unknown when the workbook carries no certification column.
  const certification = bigqueryTables.length
    ? mapCertification(
        firstFromAssets(bigqueryTables, ['certification status']),
      )
    : 'Unknown'

  const warnings = tables.reduce(
    (total, asset) =>
      total + asset.rows.filter((row) => Boolean(row.warning)).length,
    0,
  )

  const linkedAssets: GlossaryLinkedAsset[] = []
  if (measureName) {
    linkedAssets.push({
      name: measureName,
      type: 'Measure',
      relationship: 'Used By Metric',
      owner: null,
      status: certification,
    })
  }
  tables.forEach((asset) => {
    linkedAssets.push({
      name: asset.name,
      type: asset.type === 'powerbi' ? 'Power BI Table' : 'Table',
      relationship:
        asset.type === 'powerbi' ? 'Direct Dependency' : 'Upstream',
      owner: assetOwner(asset),
      status: assetStatus(asset),
    })
  })
  datasets.forEach((asset) => {
    linkedAssets.push({
      name: asset.name,
      type: 'Dataset',
      relationship: 'Downstream',
      owner: assetOwner(asset),
      status: assetStatus(asset),
    })
  })
  reports.forEach((asset) => {
    linkedAssets.push({
      name: asset.name,
      type: 'Report',
      relationship: 'Downstream',
      owner: assetOwner(asset),
      status: assetStatus(asset),
    })
  })

  const reportNames = reports.map((asset) => asset.name)

  const metric: GlossaryMetric = {
    id: record?.id ?? metricAsset.id,
    lineageNodeId: metricAsset.id,
    name: record?.name ?? metricAsset.name,
    measureName,
    groupName,
    definition,
    // Polan does not store a formula or measure-type field; surface honestly.
    formula: null,
    measureType: 'Unknown',
    owner,
    technicalOwner: null,
    certification,
    lastUpdated: null,
    lastReviewed: null,
    atlanLink: record?.atlanLink ?? null,
    counts: {
      tables: tables.length,
      // Polan lineage is asset-level, not column-level — no column count.
      columns: 0,
      measures: measureName ? 1 : 0,
      upstream: upstream.size,
      downstream: downstream.size,
      dashboards: reports.length,
      warnings,
    },
    linkedAssets,
    reportNames,
    search: '',
  }
  // Search haystack: the metric's own identity plus its upstream tables/measure.
  // Downstream report names are deliberately excluded so a metric shared across
  // several dashboards does not make all of them match a single report's name —
  // the dashboard's own name is matched separately at the dashboard level.
  metric.search = [
    metric.name,
    metric.measureName,
    metric.groupName,
    metric.definition ?? '',
    metric.owner ?? '',
    metric.certification,
    ...linkedAssets
      .filter((asset) => asset.type !== 'Report')
      .map((asset) => `${asset.name} ${asset.type}`),
  ]
    .join('   ')
    .toLowerCase()

  return metric
}

// ── Glossary builder ─────────────────────────────────────────────────────────

export function buildGlossary(
  rows: ProcessedRow[],
  assets: Map<string, AssetRecord>,
  views: ViewRecord[],
): Glossary {
  const empty: Glossary = {
    dashboards: [],
    totals: {
      dashboards: 0,
      metrics: 0,
      certified: 0,
      underReview: 0,
      tables: 0,
    },
  }
  if (!rows.length || !assets.size) return empty

  // MetricRecord id → owning Project Explorer View name (the metric group).
  const groupByMetricId = new Map<string, string>()
  views.forEach((view) => {
    view.metrics.forEach((metric) => {
      groupByMetricId.set(metric.id, view.name)
    })
  })

  const allAssets = [...assets.values()]
  const reportAssets = allAssets.filter((asset) => asset.type === 'report')
  const metricAssets = allAssets.filter((asset) => asset.type === 'metric')

  // Pre-build each metric once, with its downstream report set for grouping.
  const builtMetrics = metricAssets.map((metricAsset) => {
    const groupName =
      groupByMetricId.get(metricAsset.metric?.id ?? '') ?? 'Ungrouped Metrics'
    return {
      metric: buildGlossaryMetric(metricAsset, assets, groupName),
      reportIds: closure(metricAsset.id, assets, 'down'),
    }
  })

  const tableIds = new Set<string>()
  let certifiedTotal = 0
  let underReviewTotal = 0

  const dashboards: GlossaryDashboard[] = reportAssets.map((report) => {
    const metricsForDashboard = builtMetrics
      .filter((entry) => entry.reportIds.has(report.id))
      .map((entry) => entry.metric)

    // Group the dashboard's metrics by their Project Explorer View.
    const groupMap = new Map<string, GlossaryMetric[]>()
    metricsForDashboard.forEach((metric) => {
      const bucket = groupMap.get(metric.groupName) ?? []
      bucket.push(metric)
      groupMap.set(metric.groupName, bucket)
    })
    const groups: GlossaryGroup[] = [...groupMap.entries()]
      .map(([name, metrics]) => ({ name, metrics }))
      .sort((a, b) => a.name.localeCompare(b.name))

    // Linked tables for the whole dashboard = its upstream table closure.
    const upstream = closure(report.id, assets, 'up')
    const dashTables = [...upstream]
      .map((id) => assets.get(id))
      .filter(
        (asset): asset is AssetRecord =>
          Boolean(asset) && isTableType(asset!.type),
      )
    dashTables.forEach((asset) => tableIds.add(asset.id))

    const measureNames = new Set(
      metricsForDashboard.map((metric) => metric.measureName).filter(Boolean),
    )

    const certification: Record<CertStatus, number> = {
      Certified: 0,
      'Under Review': 0,
      Draft: 0,
      Deprecated: 0,
      Unknown: 0,
    }
    metricsForDashboard.forEach((metric) => {
      certification[metric.certification] += 1
    })
    certifiedTotal += certification.Certified
    underReviewTotal += certification['Under Review']

    const search = [
      report.name,
      assetOwner(report) ?? '',
      ...metricsForDashboard.map((metric) => metric.search),
      ...dashTables.map((asset) => asset.name),
    ]
      .join('   ')
      .toLowerCase()

    return {
      id: report.id,
      name: report.name,
      groups,
      metricCount: metricsForDashboard.length,
      groupCount: groups.length,
      tableCount: dashTables.length,
      measureCount: measureNames.size,
      certification,
      owner: assetOwner(report),
      lastUpdated: null,
      search,
    }
  })

  dashboards.sort((a, b) => a.name.localeCompare(b.name))

  return {
    dashboards,
    totals: {
      dashboards: dashboards.length,
      metrics: metricAssets.length,
      certified: certifiedTotal,
      underReview: underReviewTotal,
      tables: tableIds.size,
    },
  }
}

/**
 * Map a glossary metric to the lineage node id to focus in the Lineage tab.
 *
 * Priority: exact lineage node id → exact metric id → exact name+report →
 * case-insensitive name → normalized name → first measure/metric node.
 * Returns null when nothing matches (View Lineage is disabled in that case).
 */
export function mapMetricToLineageNode(
  metric: GlossaryMetric,
  assets: Map<string, AssetRecord>,
): string | null {
  if (metric.lineageNodeId && assets.has(metric.lineageNodeId)) {
    return metric.lineageNodeId
  }

  const metricNodes = [...assets.values()].filter(
    (asset) => asset.type === 'metric',
  )
  const normalize = (value: string) =>
    value.toLowerCase().replace(/[^a-z0-9]+/g, '')

  // Exact metric record id.
  const byId = metricNodes.find((node) => node.metric?.id === metric.id)
  if (byId) return byId.id

  // Exact name + a shared downstream report.
  const byNameAndReport = metricNodes.find(
    (node) =>
      node.name === metric.name &&
      closure(node.id, assets, 'down').size >= 0 &&
      metric.reportNames.some((report) =>
        [...closure(node.id, assets, 'down')]
          .map((id) => assets.get(id)?.name)
          .includes(report),
      ),
  )
  if (byNameAndReport) return byNameAndReport.id

  // Case-insensitive name.
  const byName = metricNodes.find(
    (node) => node.name.toLowerCase() === metric.name.toLowerCase(),
  )
  if (byName) return byName.id

  // Normalized name (strip spaces/underscores/punctuation).
  const target = normalize(metric.name)
  const byNormalized = metricNodes.find(
    (node) => normalize(node.name) === target,
  )
  if (byNormalized) return byNormalized.id

  // Fallback: first metric node.
  return metricNodes[0]?.id ?? null
}
