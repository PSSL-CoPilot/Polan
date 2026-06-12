import type { Edge, MarkerType, Node } from '@xyflow/react'
import type {
  AssetRecord,
  AssetType,
  MetricRecord,
  ProcessedRow,
  Relation,
} from '../types'
import {
  metricImmediateTable,
  resolveImmediateUpstreamAsset,
} from './metricImmediateTable'

/**
 * Lineage engine
 * ----------------------------------------------------------------------------
 * Two layers live here:
 *   1. buildLineage()      – turns processed rows into a de-duplicated asset
 *                            map + directed relations (+ a simple column layout
 *                            kept for backwards compatibility / tests).
 *   2. buildFocusedView()  – produces an *anchored* React Flow layout for one
 *                            focus asset: upstream on the left, downstream on
 *                            the right, with per-parent "show 3 + Show more"
 *                            grouping so dense graphs stay readable.
 *
 * Edge direction convention (matches the Excel spec):
 *   upstream   row → edge  ImpactedAsset (BigQuery) → SourceAsset (Power BI)
 *   downstream row → edge  SourceAsset (Power BI)    → ImpactedAsset (dataset/report)
 * so an edge always points in the direction data flows.
 */

export interface AssetNodeData extends Record<string, unknown> {
  asset: AssetRecord
  isSelected: boolean
  isDimmed: boolean
  isFocus: boolean
}

export interface ExpanderNodeData extends Record<string, unknown> {
  kind: 'expander'
  groupKey: string
  parentName: string
  hiddenCount: number
  side: 'upstream' | 'downstream'
}

export type AssetNode = Node<AssetNodeData, 'asset'>
export type ExpanderNode = Node<ExpanderNodeData, 'expander'>
export type FlowNode = AssetNode | ExpanderNode

const nodeId = (name: string) =>
  name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

/**
 * Infer an asset type. The Excel spec is authoritative about roles:
 *   - the Source Asset is always the Power BI table
 *   - an upstream Impacted Asset is the BigQuery / source table
 *   - a downstream Impacted Asset is a dataset or a report
 *
 * For downstream impacted assets, the optional `impactedAssetType` value
 * (read directly from the "Impacted Asset Type" column when present) takes
 * priority over name-keyword detection, giving an authoritative signal without
 * relying on heuristics.
 */
function inferType(
  name: string,
  role: 'source' | 'impacted',
  direction: string,
  impactedAssetType?: string,
): AssetType {
  // The Source Asset is, by spec, always the Power BI table — this wins over
  // any keyword in the name (e.g. "Sales Dashboard Model" is a Power BI table,
  // not a report).
  if (role === 'source') return 'powerbi'
  // Upstream Impacted Assets are the BigQuery / source tables that feed it.
  if (direction === 'upstream') return 'bigquery'
  // Downstream: use the explicit "Impacted Asset Type" column first (case-insensitive).
  if (impactedAssetType) {
    const t = impactedAssetType.toLowerCase()
    if (t.includes('dataset')) return 'dataset'
    if (/report|dashboard|scorecard|paginated/.test(t)) return 'report'
  }
  // Name-based fallback when the column is absent or unrecognised.
  const value = name.toLowerCase()
  if (/report|dashboard|scorecard|paginated|\.rdl/.test(value)) return 'report'
  if (/semantic|\bdataset\b|\bmodel\b|\.pbix|workspace/.test(value)) {
    return 'dataset'
  }
  if (direction === 'downstream') return 'dataset'
  if (/bigquery|^bq[_ -]|raw[_ -]|fact[_ -]|dim[_ -]/.test(value)) {
    return 'bigquery'
  }
  return 'unknown'
}

const typePriority: Record<AssetType, number> = {
  unknown: 0,
  bigquery: 1,
  powerbi: 2,
  dataset: 3,
  report: 4,
  metric: 5,
}

function chooseType(current: AssetType, next: AssetType) {
  return typePriority[next] > typePriority[current] ? next : current
}

function emptyAsset(name: string, type: AssetType): AssetRecord {
  return {
    id: nodeId(name),
    name,
    type,
    directions: [],
    upstreamIds: [],
    downstreamIds: [],
    rows: [],
    projectName: '',
    datasetName: '',
    tableName: '',
    mdrAvailability: false,
    layer: 'No Layers',
  }
}

const ASSET_COLORS: Record<AssetType, string> = {
  bigquery: '#6f63e8',
  powerbi: '#e5a82d',
  dataset: '#26968a',
  report: '#e1695d',
  metric: '#c2417f',
  unknown: '#75808f',
}

/**
 * Rewire a Power BI table's downstream fan-out into the canonical
 * Power BI → Dataset → Report chain when the data supports it.
 *
 * The spec notes "one or multiple reports connected to one dataset", so when a
 * Power BI table has exactly one downstream dataset plus one or more reports,
 * we route those reports *through* the dataset instead of straight off the
 * table. With multiple datasets the mapping is ambiguous, so we leave the
 * relations flat rather than guess.
 */
function chainDatasetsToReports(
  relations: Relation[],
  assets: Map<string, AssetRecord>,
): Relation[] {
  const downstreamBySource = new Map<string, Relation[]>()
  relations.forEach((relation) => {
    if (relation.direction !== 'downstream') return
    const bucket = downstreamBySource.get(relation.source) ?? []
    bucket.push(relation)
    downstreamBySource.set(relation.source, bucket)
  })

  const rerouted = new Map<Relation, Relation>()
  downstreamBySource.forEach((bucket) => {
    const datasets = bucket.filter(
      (relation) => assets.get(relation.target)?.type === 'dataset',
    )
    const reports = bucket.filter(
      (relation) => assets.get(relation.target)?.type === 'report',
    )
    if (datasets.length === 1 && reports.length) {
      const datasetId = datasets[0].target
      reports.forEach((reportRelation) => {
        rerouted.set(reportRelation, {
          source: datasetId,
          target: reportRelation.target,
          direction: 'downstream',
        })
      })
    }
  })

  if (!rerouted.size) return relations

  const next: Relation[] = []
  const seen = new Set<string>()
  const push = (relation: Relation) => {
    const key = `${relation.source}->${relation.target}`
    if (seen.has(key)) return
    seen.add(key)
    next.push(relation)
  }
  relations.forEach((relation) => push(rerouted.get(relation) ?? relation))
  return next
}

/**
 * Inject project metrics into the relation set as first-class nodes:
 *
 *   BigQuery / source tables → Power BI table → Metric → Dataset → Report
 *
 * Each metric is connected to the Power BI tables found in its connected
 * workbook sheets. Existing downstream edges from those tables are rerouted
 * through the metric; upstream edges stay connected to the Power BI table.
 */
function insertMetricNodesWithoutImmediateTables(
  rows: ProcessedRow[],
  metrics: MetricRecord[],
  assets: Map<string, AssetRecord>,
  relations: Relation[],
): Relation[] {
  if (!metrics.length) return relations

  // sheet name → Power BI table asset ids seen in that sheet.
  const sheetTables = new Map<string, Set<string>>()
  rows.forEach((row) => {
    if (!row.sourceAsset) return
    const id = nodeId(row.sourceAsset)
    if (!assets.has(id)) return
    if (!sheetTables.has(row.sheet)) sheetTables.set(row.sheet, new Set())
    sheetTables.get(row.sheet)!.add(id)
  })

  // table id → metric node ids attached to it.
  const metricsByTable = new Map<string, string[]>()
  metrics.forEach((metric) => {
    const tableIds = new Set<string>()
    metric.connectedSheets.forEach((sheet) => {
      sheetTables.get(sheet)?.forEach((id) => tableIds.add(id))
    })
    if (!tableIds.size) return

    const metricId = `metric-${nodeId(metric.id) || metric.id}`
    assets.set(metricId, {
      ...emptyAsset(metric.name, 'metric'),
      id: metricId,
      metric,
    })
    tableIds.forEach((tableId) => {
      const bucket = metricsByTable.get(tableId) ?? []
      bucket.push(metricId)
      metricsByTable.set(tableId, bucket)
    })
  })

  if (!metricsByTable.size) return relations

  const next: Relation[] = []
  const seen = new Set<string>()
  const push = (relation: Relation) => {
    const key = `${relation.source}->${relation.target}`
    if (seen.has(key) || relation.source === relation.target) return
    seen.add(key)
    next.push(relation)
  }

  relations.forEach((relation) => {
    const tableMetrics =
      relation.direction === 'downstream'
        ? metricsByTable.get(relation.source)
        : undefined
    if (tableMetrics?.length) {
      tableMetrics.forEach((metricId) => {
        push({
          source: relation.source,
          target: metricId,
          direction: 'downstream',
        })
        push({
          source: metricId,
          target: relation.target,
          direction: 'downstream',
        })
      })
      return
    }
    push(relation)
  })

  // Keep the metric visible even when the table has no downstream assets.
  metricsByTable.forEach((metricIds, tableId) => {
    metricIds.forEach((metricId) =>
      push({ source: tableId, target: metricId, direction: 'downstream' }),
    )
  })

  return next
}

interface MetricTableRoute {
  metricId: string
  immediateId?: string
  upstreamIds: Set<string>
}

function insertMetricNodes(
  rows: ProcessedRow[],
  metrics: MetricRecord[],
  assets: Map<string, AssetRecord>,
  relations: Relation[],
): Relation[] {
  if (
    !metrics.some((metric) =>
      Object.values(metric.immediateTables ?? {}).some((value) =>
        value.trim(),
      ),
    )
  ) {
    return insertMetricNodesWithoutImmediateTables(
      rows,
      metrics,
      assets,
      relations,
    )
  }

  const sheetTables = new Map<string, Set<string>>()
  const upstreamBySheetTable = new Map<string, Set<string>>()
  const sheetTableKey = (sheet: string, tableId: string) =>
    `${sheet}\u0000${tableId}`

  rows.forEach((row) => {
    if (!row.sourceAsset) return
    const tableId = nodeId(row.sourceAsset)
    if (!assets.has(tableId)) return
    const tables = sheetTables.get(row.sheet) ?? new Set<string>()
    tables.add(tableId)
    sheetTables.set(row.sheet, tables)

    if (
      row.direction.trim().toLowerCase() !== 'upstream' ||
      !row.impactedAsset
    ) {
      return
    }
    const key = sheetTableKey(row.sheet, tableId)
    const upstreamIds = upstreamBySheetTable.get(key) ?? new Set<string>()
    upstreamIds.add(nodeId(row.impactedAsset))
    upstreamBySheetTable.set(key, upstreamIds)
  })

  const routesByTable = new Map<string, MetricTableRoute[]>()
  metrics.forEach((metric) => {
    const metricId = `metric-${nodeId(metric.id) || metric.id}`
    let connected = false

    metric.connectedSheets.forEach((sheet) => {
      const selected = metricImmediateTable(metric, sheet)
      const resolved = resolveImmediateUpstreamAsset(rows, sheet, selected)
      const immediateId = resolved ? nodeId(resolved) : undefined

      sheetTables.get(sheet)?.forEach((tableId) => {
        connected = true
        const upstreamIds =
          upstreamBySheetTable.get(sheetTableKey(sheet, tableId)) ??
          new Set<string>()
        const routes = routesByTable.get(tableId) ?? []
        const safeImmediateId =
          immediateId && immediateId !== tableId && assets.has(immediateId)
            ? immediateId
            : undefined
        const existing = routes.find(
          (route) =>
            route.metricId === metricId &&
            route.immediateId === safeImmediateId,
        )
        if (existing) {
          upstreamIds.forEach((id) => existing.upstreamIds.add(id))
        } else {
          routes.push({
            metricId,
            immediateId: safeImmediateId,
            upstreamIds: new Set(upstreamIds),
          })
        }
        routesByTable.set(tableId, routes)
      })
    })

    if (connected) {
      assets.set(metricId, {
        ...emptyAsset(metric.name, 'metric'),
        id: metricId,
        metric,
      })
    }
  })

  if (!routesByTable.size) return relations

  const next: Relation[] = []
  const seen = new Set<string>()
  const push = (relation: Relation) => {
    const key = `${relation.source}->${relation.target}`
    if (seen.has(key) || relation.source === relation.target) return
    seen.add(key)
    next.push(relation)
  }

  // For an upstream edge `source → table`, decide how the Immediate Table
  // reshapes it. Only the Immediate Table feeds the Power BI table directly
  // (that edge is emitted in the final block); its sibling upstream sources are
  // rerouted to flow *through* the Immediate Table instead. A source that also
  // belongs to a route without an Immediate Table keeps its direct edge.
  const immediateReroute = (
    routes: MetricTableRoute[],
    source: string,
  ): { isImmediate: boolean; reroute?: string } => {
    let isImmediate = false
    let reroute: string | undefined
    let staysDirect = false
    routes.forEach((route) => {
      if (route.immediateId === source) {
        isImmediate = true
        return
      }
      if (!route.upstreamIds.has(source)) return
      if (route.immediateId) reroute ??= route.immediateId
      else staysDirect = true
    })
    return { isImmediate, reroute: staysDirect ? undefined : reroute }
  }

  relations.forEach((relation) => {
    if (relation.direction === 'downstream') {
      const routes = routesByTable.get(relation.source)
      if (!routes?.length) {
        push(relation)
        return
      }
      routes.forEach((route) => {
        push({
          source: relation.source,
          target: route.metricId,
          direction: 'downstream',
        })
        push({
          source: route.metricId,
          target: relation.target,
          direction: 'downstream',
        })
      })
      return
    }

    // Upstream edge into a Power BI table.
    const routes = routesByTable.get(relation.target)
    if (!routes?.some((route) => route.immediateId)) {
      push(relation)
      return
    }
    const { isImmediate, reroute } = immediateReroute(routes, relation.source)
    // The Immediate Table itself feeds the Power BI table via the final block.
    if (isImmediate) return
    if (reroute) {
      push({ source: relation.source, target: reroute, direction: 'upstream' })
    } else {
      push(relation)
    }
  })

  routesByTable.forEach((routes, tableId) => {
    routes.forEach((route) => {
      // Immediate Table → Power BI table (upstream), so the selected table
      // appears in the path directly before the Power BI table.
      if (route.immediateId) {
        push({
          source: route.immediateId,
          target: tableId,
          direction: 'upstream',
        })
      }
      push({
        source: tableId,
        target: route.metricId,
        direction: 'downstream',
      })
    })
  })

  return next
}

export function buildLineage(
  rows: ProcessedRow[],
  metrics: MetricRecord[] = [],
) {
  const assets = new Map<string, AssetRecord>()
  const relationKeys = new Set<string>()
  let relations: Relation[] = []

  // Pre-pass: find downstream impacted asset names that appear with conflicting
  // explicit types (e.g. "Executive Key Metrics Dashboard" is both a Dataset row
  // and a Report row).  Power BI allows a dataset and a report to share a display
  // name — they are distinct assets and need distinct node IDs.
  const conflictNames = new Set<string>()
  {
    const seenType = new Map<string, AssetType>()
    rows.forEach((row) => {
      if (!row.impactedAsset || row.direction !== 'downstream' || !row.impactedAssetType) return
      const key = row.impactedAsset.trim().toLowerCase()
      const t = inferType(row.impactedAsset, 'impacted', 'downstream', row.impactedAssetType)
      if (t === 'unknown') return
      const prev = seenType.get(key)
      if (prev === undefined) seenType.set(key, t)
      else if (prev !== t) conflictNames.add(key)
    })
  }

  // Returns a stable node ID, using a type suffix for names that carry two
  // different explicit types (to avoid the two assets collapsing into one).
  const resolveId = (name: string, type: AssetType, isDownstreamImpacted: boolean): string => {
    if (isDownstreamImpacted && conflictNames.has(name.trim().toLowerCase())) {
      return `${nodeId(name)}--${type}`
    }
    return nodeId(name)
  }

  const upsert = (
    id: string,
    name: string,
    type: AssetType,
    row: ProcessedRow,
  ): AssetRecord => {
    const existing = assets.get(id) ?? { ...emptyAsset(name, type), id }
    existing.type = chooseType(existing.type, type)
    existing.rows.push(row)
    if (!existing.directions.includes(row.direction)) {
      existing.directions.push(row.direction)
    }
    existing.projectName ||= row.projectName
    existing.datasetName ||= row.datasetName
    existing.tableName ||= row.tableName
    existing.mdrAvailability ||= row.mdrAvailability
    if (existing.layer === 'No Layers') existing.layer = row.layer
    assets.set(id, existing)
    return existing
  }

  rows.forEach((row) => {
    if (
      !row.sourceAsset ||
      !row.impactedAsset ||
      !['upstream', 'downstream'].includes(row.direction)
    ) {
      return
    }

    const sourceType = inferType(row.sourceAsset, 'source', row.direction)
    const impactedType = inferType(row.impactedAsset, 'impacted', row.direction, row.impactedAssetType)
    const sourceId = resolveId(row.sourceAsset, sourceType, false)
    const impId = resolveId(row.impactedAsset, impactedType, row.direction === 'downstream')

    const source = upsert(sourceId, row.sourceAsset, sourceType, row)
    const impacted = upsert(impId, row.impactedAsset, impactedType, row)
    const from = row.direction === 'upstream' ? impacted : source
    const to = row.direction === 'upstream' ? source : impacted
    const key = `${from.id}->${to.id}`

    if (from.id !== to.id && !relationKeys.has(key)) {
      relationKeys.add(key)
      relations.push({ source: from.id, target: to.id, direction: row.direction })
    }
  })

  // Promote Power BI → Dataset → Report chains and inject metric nodes, then
  // derive the adjacency lists from the final relation set so the details
  // panel stays accurate.
  relations = chainDatasetsToReports(relations, assets)
  relations = insertMetricNodes(rows, metrics, assets, relations)
  relations.forEach((relation) => {
    const from = assets.get(relation.source)
    const to = assets.get(relation.target)
    if (!from || !to) return
    if (!from.downstreamIds.includes(to.id)) from.downstreamIds.push(to.id)
    if (!to.upstreamIds.includes(from.id)) to.upstreamIds.push(from.id)
  })

  // Lightweight column layout retained for the overview / unit tests.
  const columns: AssetType[] = [
    'bigquery',
    'powerbi',
    'metric',
    'dataset',
    'report',
    'unknown',
  ]
  const columnX: Record<AssetType, number> = {
    bigquery: 40,
    powerbi: 330,
    metric: 620,
    dataset: 910,
    report: 1200,
    unknown: 910,
  }

  const grouped = new Map<AssetType, AssetRecord[]>()
  columns.forEach((type) => grouped.set(type, []))
  assets.forEach((asset) => grouped.get(asset.type)?.push(asset))

  const nodes: AssetNode[] = []
  columns.forEach((type) => {
    const group = grouped.get(type) ?? []
    const gap = 150
    const startY = Math.max(36, 270 - ((group.length - 1) * gap) / 2)
    group.forEach((asset, index) => {
      nodes.push({
        id: asset.id,
        type: 'asset',
        position: { x: columnX[type], y: startY + index * gap },
        data: { asset, isSelected: false, isDimmed: false, isFocus: false },
      })
    })
  })

  const edges: Edge[] = relations.map((relation, index) =>
    makeEdge(relation, index),
  )

  return { nodes, edges, assets, relations }
}

function makeEdge(relation: Relation, index: number): Edge {
  return {
    id: `edge-${index}-${relation.source}-${relation.target}`,
    source: relation.source,
    target: relation.target,
    type: 'smoothstep',
    animated: relation.direction === 'downstream',
    markerEnd: { type: 'arrowclosed' as MarkerType, width: 16, height: 16 },
    style: {
      stroke: relation.direction === 'upstream' ? '#8f7cf6' : '#2a9d8f',
      strokeWidth: 1.8,
    },
    data: { direction: relation.direction },
  }
}

export function getConnectedIds(
  selectedId: string | null,
  edges: Edge[],
): Set<string> {
  const connected = new Set<string>()
  if (!selectedId) return connected
  connected.add(selectedId)
  edges.forEach((edge) => {
    if (edge.source === selectedId) connected.add(edge.target)
    if (edge.target === selectedId) connected.add(edge.source)
  })
  return connected
}

/** Pick a sensible default anchor: the most-connected Power BI table. */
export function pickDefaultFocus(assets: Map<string, AssetRecord>): string | null {
  let best: AssetRecord | null = null
  let bestScore = -1
  assets.forEach((asset) => {
    const degree = asset.upstreamIds.length + asset.downstreamIds.length
    // Power BI tables are the natural centre of a lineage map.
    const score = degree + (asset.type === 'powerbi' ? 1000 : 0)
    if (score > bestScore) {
      bestScore = score
      best = asset
    }
  })
  return best ? (best as AssetRecord).id : null
}

// ── Focused, anchored layout with "show 3 + Show more" grouping ──────────────

const FOCUS_BATCH = 3
const MAX_DEPTH = 3
const COLUMN_PITCH = 320
const ROW_GAP = 92

interface PlacedItem {
  level: number
  node: FlowNode
}

/**
 * Build a React Flow layout centred on `focusId`.
 *
 * @param expansions map of groupKey → how many siblings to reveal (defaults to
 *                   FOCUS_BATCH). Each "Show more" click bumps this by a batch.
 */
export function buildFocusedView(
  focusId: string,
  assets: Map<string, AssetRecord>,
  relations: Relation[],
  expansions: Record<string, number> = {},
  selectedId: string | null = null,
): {
  nodes: FlowNode[]
  edges: Edge[]
  visibleAssetIds: Set<string>
  upstreamCount: number
  downstreamCount: number
} {
  const focus = assets.get(focusId)
  const empty = {
    nodes: [] as FlowNode[],
    edges: [] as Edge[],
    visibleAssetIds: new Set<string>(),
    upstreamCount: 0,
    downstreamCount: 0,
  }
  if (!focus) return empty

  const outgoing = new Map<string, string[]>()
  const incoming = new Map<string, string[]>()
  relations.forEach(({ source, target }) => {
    if (!outgoing.has(source)) outgoing.set(source, [])
    if (!incoming.has(target)) incoming.set(target, [])
    outgoing.get(source)!.push(target)
    incoming.get(target)!.push(source)
  })

  const placed = new Set<string>([focusId])
  const items: PlacedItem[] = []
  const visibleAssetIds = new Set<string>([focusId])
  let upstreamCount = 0
  let downstreamCount = 0

  const makeAssetNode = (id: string): FlowNode | null => {
    const asset = assets.get(id)
    if (!asset) return null
    return {
      id,
      type: 'asset',
      position: { x: 0, y: 0 },
      data: {
        asset,
        isSelected: id === selectedId,
        isDimmed: false,
        isFocus: id === focusId,
      },
    }
  }

  /** Walk one side (upstream = incoming edges, downstream = outgoing). */
  const walk = (side: 'upstream' | 'downstream') => {
    const neighbours = side === 'upstream' ? incoming : outgoing
    let parents = [focusId]
    for (let depth = 1; depth <= MAX_DEPTH; depth += 1) {
      const level = side === 'upstream' ? -depth : depth
      const nextParents: string[] = []

      for (const parentId of parents) {
        const children = (neighbours.get(parentId) ?? []).filter(
          (id) => !placed.has(id),
        )
        if (!children.length) continue

        const groupKey = `${side}:${level}:${parentId}`
        const visible = Math.max(
          FOCUS_BATCH,
          expansions[groupKey] ?? FOCUS_BATCH,
        )
        const shown = children.slice(0, visible)
        const hidden = children.length - shown.length

        shown.forEach((childId) => {
          placed.add(childId)
          visibleAssetIds.add(childId)
          if (side === 'upstream') upstreamCount += 1
          else downstreamCount += 1
          const node = makeAssetNode(childId)
          if (node) {
            items.push({ level, node })
            nextParents.push(childId)
          }
        })

        if (hidden > 0) {
          items.push({
            level,
            node: {
              id: `more-${groupKey}`,
              type: 'expander',
              position: { x: 0, y: 0 },
              data: {
                kind: 'expander',
                groupKey,
                parentName: assets.get(parentId)?.name ?? '',
                hiddenCount: hidden,
                side,
              },
            },
          })
        }
      }

      parents = nextParents
      if (!parents.length) break
    }
  }

  walk('upstream')
  walk('downstream')

  // Focus node sits dead centre.
  items.push({ level: 0, node: makeAssetNode(focusId)! })

  // Lay out each level as a vertically centred column.
  const byLevel = new Map<number, PlacedItem[]>()
  items.forEach((item) => {
    if (!byLevel.has(item.level)) byLevel.set(item.level, [])
    byLevel.get(item.level)!.push(item)
  })
  byLevel.forEach((levelItems, level) => {
    const startY = -((levelItems.length - 1) * ROW_GAP) / 2
    levelItems.forEach((item, index) => {
      item.node.position = {
        x: level * COLUMN_PITCH,
        y: startY + index * ROW_GAP,
      }
    })
  })

  const nodes = items.map((item) => item.node)

  // Draw every relation whose endpoints are both currently visible.
  const edges: Edge[] = []
  const seenEdges = new Set<string>()
  relations.forEach((relation, index) => {
    if (
      !visibleAssetIds.has(relation.source) ||
      !visibleAssetIds.has(relation.target)
    ) {
      return
    }
    const key = `${relation.source}->${relation.target}`
    if (seenEdges.has(key)) return
    seenEdges.add(key)
    const edge = makeEdge(relation, index)
    const touchesFocus =
      relation.source === focusId || relation.target === focusId
    edge.style = {
      ...edge.style,
      strokeWidth: touchesFocus ? 2.6 : 1.8,
    }
    edges.push(edge)
  })

  return { nodes, edges, visibleAssetIds, upstreamCount, downstreamCount }
}

export { ASSET_COLORS }
