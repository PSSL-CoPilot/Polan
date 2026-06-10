import type { Edge, MarkerType, Node } from '@xyflow/react'
import type { AssetRecord, AssetType, ProcessedRow } from '../types'

export interface AssetNodeData extends Record<string, unknown> {
  asset: AssetRecord
  isSelected: boolean
  isDimmed: boolean
}

export type AssetNode = Node<AssetNodeData, 'asset'>

const nodeId = (name: string) =>
  name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

function inferType(
  name: string,
  role: 'source' | 'impacted',
  direction: string,
): AssetType {
  const value = name.toLowerCase()
  if (/report|dashboard|scorecard/.test(value)) return 'report'
  if (/dataset|semantic|model/.test(value)) return 'dataset'
  if (/bigquery|^bq[_ -]|raw[_ -]|fact[_ -]|dim[_ -]/.test(value)) {
    return 'bigquery'
  }
  if (/power ?bi|pbi|table/.test(value)) return 'powerbi'
  if (role === 'impacted' && direction === 'upstream') return 'bigquery'
  if (role === 'source') return 'powerbi'
  return 'unknown'
}

const typePriority: Record<AssetType, number> = {
  unknown: 0,
  bigquery: 1,
  powerbi: 2,
  dataset: 3,
  report: 4,
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

export function buildLineage(rows: ProcessedRow[]) {
  const assets = new Map<string, AssetRecord>()
  const relationKeys = new Set<string>()
  const relations: Array<{ source: string; target: string; direction: string }> =
    []

  const upsert = (
    name: string,
    type: AssetType,
    row: ProcessedRow,
  ): AssetRecord => {
    const id = nodeId(name)
    const existing = assets.get(id) ?? emptyAsset(name, type)
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

    const source = upsert(
      row.sourceAsset,
      inferType(row.sourceAsset, 'source', row.direction),
      row,
    )
    const impacted = upsert(
      row.impactedAsset,
      inferType(row.impactedAsset, 'impacted', row.direction),
      row,
    )
    const from = row.direction === 'upstream' ? impacted : source
    const to = row.direction === 'upstream' ? source : impacted
    const key = `${from.id}->${to.id}`

    if (!relationKeys.has(key)) {
      relationKeys.add(key)
      relations.push({ source: from.id, target: to.id, direction: row.direction })
      from.downstreamIds.push(to.id)
      to.upstreamIds.push(from.id)
    }
  })

  const columns: AssetType[] = [
    'bigquery',
    'powerbi',
    'dataset',
    'report',
    'unknown',
  ]
  const columnX: Record<AssetType, number> = {
    bigquery: 40,
    powerbi: 355,
    dataset: 670,
    report: 985,
    unknown: 670,
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
        data: { asset, isSelected: false, isDimmed: false },
      })
    })
  })

  const edges: Edge[] = relations.map((relation, index) => ({
    id: `edge-${index}-${relation.source}-${relation.target}`,
    source: relation.source,
    target: relation.target,
    type: 'smoothstep',
    animated: relation.direction === 'downstream',
    markerEnd: {
      type: 'arrowclosed' as MarkerType,
      width: 16,
      height: 16,
    },
    style: {
      stroke: relation.direction === 'upstream' ? '#8f7cf6' : '#2a9d8f',
      strokeWidth: 1.8,
    },
    data: { direction: relation.direction },
  }))

  return {
    nodes,
    edges,
    assets,
    relations,
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
