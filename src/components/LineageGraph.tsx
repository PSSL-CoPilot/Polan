import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  ReactFlowProvider,
  type NodeProps,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import {
  Check,
  ChevronRight,
  Database,
  ExternalLink,
  FileBarChart2,
  Layers3,
  PanelRightClose,
  Search,
  Table2,
  X,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import type { AssetRecord, AssetType, ProcessedRow } from '../types'
import {
  buildLineage,
  getConnectedIds,
  type AssetNode,
} from '../utils/lineage'

interface LineageGraphProps {
  rows: ProcessedRow[]
}

const assetConfig: Record<
  AssetType,
  { label: string; color: string; icon: typeof Database }
> = {
  bigquery: { label: 'BigQuery', color: '#6f63e8', icon: Database },
  powerbi: { label: 'Power BI table', color: '#e5a82d', icon: Table2 },
  dataset: { label: 'Dataset', color: '#26968a', icon: Layers3 },
  report: { label: 'Report', color: '#e1695d', icon: FileBarChart2 },
  unknown: { label: 'Unknown asset', color: '#75808f', icon: Database },
}

function AssetNodeCard({ data }: NodeProps<AssetNode>) {
  const { asset, isDimmed, isSelected } = data
  const config = assetConfig[asset.type]
  const Icon = config.icon

  return (
    <div
      className={`asset-node ${isSelected ? 'selected' : ''} ${isDimmed ? 'dimmed' : ''}`}
      style={{ '--asset-color': config.color } as React.CSSProperties}
    >
      <Handle type="target" position={Position.Left} />
      <div className="asset-node-icon">
        <Icon size={18} />
      </div>
      <div className="asset-node-copy">
        <span>{config.label}</span>
        <strong>{asset.name}</strong>
      </div>
      <ChevronRight className="node-chevron" size={16} />
      <Handle type="source" position={Position.Right} />
    </div>
  )
}

const nodeTypes = { asset: AssetNodeCard }

function DetailsPanel({
  asset,
  assets,
  onClose,
}: {
  asset: AssetRecord
  assets: Map<string, AssetRecord>
  onClose: () => void
}) {
  const config = assetConfig[asset.type]
  const Icon = config.icon
  const upstream = asset.upstreamIds.map((id) => assets.get(id)).filter(Boolean)
  const downstream = asset.downstreamIds
    .map((id) => assets.get(id))
    .filter(Boolean)

  return (
    <aside className="details-panel">
      <div className="details-top">
        <span>Asset details</span>
        <button onClick={onClose} type="button" aria-label="Close asset details">
          <X size={17} />
        </button>
      </div>
      <div className="asset-hero">
        <div
          className="asset-hero-icon"
          style={{ '--asset-color': config.color } as React.CSSProperties}
        >
          <Icon size={22} />
        </div>
        <div>
          <span>{config.label}</span>
          <h3>{asset.name}</h3>
        </div>
      </div>

      <div className="verified-line">
        <Check size={14} />
        Metadata enriched
      </div>

      <div className="details-section">
        <h4>Governance</h4>
        <dl className="metadata-grid">
          <div>
            <dt>Project</dt>
            <dd>{asset.projectName || 'Not available'}</dd>
          </div>
          <div>
            <dt>Dataset</dt>
            <dd>{asset.datasetName || 'Not available'}</dd>
          </div>
          <div>
            <dt>Table</dt>
            <dd>{asset.tableName || 'Not available'}</dd>
          </div>
          <div>
            <dt>Layer</dt>
            <dd>
              <span className={`layer-badge ${asset.layer.toLowerCase().replace(' ', '-')}`}>
                {asset.layer}
              </span>
            </dd>
          </div>
          <div>
            <dt>MDR availability</dt>
            <dd className={asset.mdrAvailability ? 'mdr-yes' : ''}>
              {asset.mdrAvailability ? 'Available' : 'Not available'}
            </dd>
          </div>
          <div>
            <dt>Direction</dt>
            <dd>{asset.directions.join(', ') || '—'}</dd>
          </div>
        </dl>
      </div>

      <div className="details-section">
        <h4>Relationships</h4>
        <div className="relationship-group">
          <span>Upstream · {upstream.length}</span>
          {upstream.map((item) => (
            <div className="relationship-item" key={item!.id}>
              <i style={{ background: assetConfig[item!.type].color }} />
              <strong>{item!.name}</strong>
              <ExternalLink size={13} />
            </div>
          ))}
          {!upstream.length && <p>No upstream assets connected.</p>}
        </div>
        <div className="relationship-group">
          <span>Downstream · {downstream.length}</span>
          {downstream.map((item) => (
            <div className="relationship-item" key={item!.id}>
              <i style={{ background: assetConfig[item!.type].color }} />
              <strong>{item!.name}</strong>
              <ExternalLink size={13} />
            </div>
          ))}
          {!downstream.length && <p>No downstream assets connected.</p>}
        </div>
      </div>
    </aside>
  )
}

function GraphCanvas({ rows }: LineageGraphProps) {
  const graph = useMemo(() => buildLineage(rows), [rows])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<AssetType | 'all'>('all')
  const effectiveSelectedId =
    selectedId && graph.assets.has(selectedId) ? selectedId : null
  const connected = getConnectedIds(effectiveSelectedId, graph.edges)
  const query = search.trim().toLowerCase()
  const visibleIds = new Set(
    graph.nodes
      .filter((node) => {
        const matchesType =
          typeFilter === 'all' || node.data.asset.type === typeFilter
        const matchesSearch =
          !query || node.data.asset.name.toLowerCase().includes(query)
        return matchesType && matchesSearch
      })
      .map((node) => node.id),
  )
  const hasFilters = Boolean(query || typeFilter !== 'all')
  const nodes = graph.nodes.map((node) => ({
    ...node,
    hidden: hasFilters && !visibleIds.has(node.id),
    data: {
      ...node.data,
      isSelected: node.id === effectiveSelectedId,
      isDimmed: Boolean(effectiveSelectedId && !connected.has(node.id)),
    },
  }))
  const edges = graph.edges.map((edge) => ({
    ...edge,
    hidden:
      (hasFilters &&
        (!visibleIds.has(edge.source) || !visibleIds.has(edge.target))) ||
      false,
    style: {
      ...edge.style,
      opacity:
        effectiveSelectedId &&
        !(
          edge.source === effectiveSelectedId ||
          edge.target === effectiveSelectedId
        )
          ? 0.12
          : 1,
      strokeWidth:
        effectiveSelectedId &&
        (edge.source === effectiveSelectedId ||
          edge.target === effectiveSelectedId)
          ? 2.8
          : 1.8,
    },
  }))
  const selectedAsset = effectiveSelectedId
    ? graph.assets.get(effectiveSelectedId)
    : undefined

  return (
    <div className="graph-shell">
      <div className="graph-toolbar">
        <div className="graph-search">
          <Search size={16} />
          <input
            placeholder="Find an asset..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <div className="graph-filters">
          {(['all', 'bigquery', 'powerbi', 'dataset', 'report'] as const).map(
            (type) => (
              <button
                className={typeFilter === type ? 'active' : ''}
                key={type}
                onClick={() => setTypeFilter(type)}
                type="button"
              >
                {type === 'all' ? 'All assets' : assetConfig[type].label}
              </button>
            ),
          )}
        </div>
        <div className="graph-count">{graph.nodes.length} assets</div>
      </div>

      <div className="graph-stage">
        <ReactFlow
          defaultEdges={edges}
          defaultNodes={nodes}
          edges={edges}
          fitView
          fitViewOptions={{ padding: 0.16 }}
          minZoom={0.35}
          maxZoom={1.8}
          nodeTypes={nodeTypes}
          nodes={nodes}
          nodesDraggable
          onNodeClick={(_, node) => setSelectedId(node.id)}
          onPaneClick={() => setSelectedId(null)}
          proOptions={{ hideAttribution: true }}
        >
          <Background
            color="#dedbe7"
            gap={22}
            size={1.2}
            variant={BackgroundVariant.Dots}
          />
          <Controls position="bottom-left" showInteractive={false} />
          <MiniMap
            maskColor="rgba(248, 247, 251, 0.82)"
            nodeColor={(node) =>
              assetConfig[(node.data as { asset: AssetRecord }).asset.type].color
            }
            pannable
            position="bottom-right"
            zoomable
          />
          <div className="flow-legend">
            <span><i className="upstream-line" /> Upstream</span>
            <span><i className="downstream-line" /> Downstream</span>
          </div>
        </ReactFlow>
        {selectedAsset && (
          <DetailsPanel
            asset={selectedAsset}
            assets={graph.assets}
            onClose={() => setSelectedId(null)}
          />
        )}
        {!selectedAsset && (
          <div className="panel-hint">
            <PanelRightClose size={16} />
            Select a node to inspect details
          </div>
        )}
      </div>
    </div>
  )
}

export function LineageGraph(props: LineageGraphProps) {
  return (
    <ReactFlowProvider>
      <GraphCanvas {...props} />
    </ReactFlowProvider>
  )
}
