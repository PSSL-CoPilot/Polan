import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type NodeProps,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import {
  ArrowLeftRight,
  ChevronRight,
  Crosshair,
  Database,
  ExternalLink,
  FileBarChart2,
  Layers3,
  Link2,
  PanelRightClose,
  Plus,
  Search,
  Sigma,
  Table2,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type {
  AssetRecord,
  AssetType,
  MetricRecord,
  ProcessedRow,
} from '../types'
import {
  ASSET_COLORS,
  buildFocusedView,
  buildLineage,
  getConnectedIds,
  pickDefaultFocus,
  type AssetNode,
  type ExpanderNode,
} from '../utils/lineage'

interface LineageGraphProps {
  rows: ProcessedRow[]
  metrics?: MetricRecord[]
}

const assetConfig: Record<
  AssetType,
  { label: string; color: string; icon: typeof Database }
> = {
  bigquery: { label: 'BigQuery', color: ASSET_COLORS.bigquery, icon: Database },
  powerbi: { label: 'Power BI table', color: ASSET_COLORS.powerbi, icon: Table2 },
  dataset: { label: 'Dataset', color: ASSET_COLORS.dataset, icon: Layers3 },
  report: { label: 'Report', color: ASSET_COLORS.report, icon: FileBarChart2 },
  metric: { label: 'Metric', color: ASSET_COLORS.metric, icon: Sigma },
  unknown: { label: 'Unknown asset', color: ASSET_COLORS.unknown, icon: Database },
}

function AssetNodeCard({ data }: NodeProps<AssetNode>) {
  const { asset, isDimmed, isSelected, isFocus } = data
  const config = assetConfig[asset.type]
  const Icon = config.icon

  return (
    <div
      className={`asset-node ${isSelected ? 'selected' : ''} ${
        isFocus ? 'is-focus' : ''
      } ${isDimmed ? 'dimmed' : ''}`}
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
      {isFocus ? (
        <span className="focus-pill">Focus</span>
      ) : (
        <ChevronRight className="node-chevron" size={16} />
      )}
      <Handle type="source" position={Position.Right} />
    </div>
  )
}

function ExpanderNodeCard({ data }: NodeProps<ExpanderNode>) {
  return (
    <div className={`expander-node ${data.side}`}>
      <Handle type="target" position={Position.Left} />
      <span className="expander-plus">
        <Plus size={14} />
      </span>
      <div className="expander-copy">
        <strong>Show {Math.min(3, data.hiddenCount)} more</strong>
        <span>{data.hiddenCount} hidden</span>
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  )
}

const nodeTypes = { asset: AssetNodeCard, expander: ExpanderNodeCard }

function RelationshipList({
  title,
  items,
  onSelect,
}: {
  title: string
  items: AssetRecord[]
  onSelect: (id: string) => void
}) {
  const [shown, setShown] = useState(3)
  useEffect(() => setShown(3), [items])
  const visible = items.slice(0, shown)
  const hidden = items.length - visible.length

  return (
    <div className="relationship-group">
      <span>
        {title} · {items.length}
      </span>
      {visible.map((item) => (
        <button
          className="relationship-item"
          key={item.id}
          onClick={() => onSelect(item.id)}
          type="button"
        >
          <i style={{ background: assetConfig[item.type].color }} />
          <strong>{item.name}</strong>
          <ExternalLink size={13} />
        </button>
      ))}
      {!items.length && <p>None connected.</p>}
      {hidden > 0 && (
        <button
          className="relationship-more"
          onClick={() => setShown((value) => value + 3)}
          type="button"
        >
          Show {Math.min(3, hidden)} more
        </button>
      )}
    </div>
  )
}

function DetailsPanel({
  asset,
  assets,
  isFocus,
  onClose,
  onFocus,
  onSelect,
}: {
  asset: AssetRecord
  assets: Map<string, AssetRecord>
  isFocus: boolean
  onClose: () => void
  onFocus: (id: string) => void
  onSelect: (id: string) => void
}) {
  const config = assetConfig[asset.type]
  const Icon = config.icon
  const upstream = asset.upstreamIds
    .map((id) => assets.get(id))
    .filter((value): value is AssetRecord => Boolean(value))
  const downstream = asset.downstreamIds
    .map((id) => assets.get(id))
    .filter((value): value is AssetRecord => Boolean(value))

  // For metric nodes: direct downstream is the Power BI tables; surface the
  // datasets/reports that live further down the chain too.
  const transitiveDownstream = useMemo(() => {
    if (asset.type !== 'metric') return []
    const found: AssetRecord[] = []
    const seen = new Set<string>([asset.id])
    const visit = (id: string, depth: number) => {
      if (seen.has(id) || depth > 4) return
      seen.add(id)
      const item = assets.get(id)
      if (!item) return
      if (item.type === 'dataset' || item.type === 'report') found.push(item)
      item.downstreamIds.forEach((next) => visit(next, depth + 1))
    }
    asset.downstreamIds.forEach((id) => visit(id, 1))
    return found
  }, [asset, assets])

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

      <button
        className="focus-button"
        disabled={isFocus}
        onClick={() => onFocus(asset.id)}
        type="button"
      >
        <Crosshair size={14} />
        {isFocus ? 'Centred in graph' : 'Center lineage on this asset'}
      </button>

      {asset.type === 'metric' && asset.metric && (
        <div className="details-section">
          <h4>Metric definition</h4>
          <dl className="metadata-grid single">
            <div>
              <dt>Metric Name</dt>
              <dd>{asset.metric.name}</dd>
            </div>
            <div>
              <dt>Measure Name</dt>
              <dd>{asset.metric.measureName}</dd>
            </div>
            <div>
              <dt>Atlan Link</dt>
              <dd>
                {asset.metric.atlanLink ? (
                  <a
                    className="atlan-link"
                    href={asset.metric.atlanLink}
                    rel="noreferrer"
                    target="_blank"
                  >
                    <Link2 size={11} />
                    Open in Atlan
                  </a>
                ) : (
                  'Not provided'
                )}
              </dd>
            </div>
            {asset.metric.description && (
              <div>
                <dt>Description</dt>
                <dd className="wrap">{asset.metric.description}</dd>
              </div>
            )}
            <div>
              <dt>Connected Power BI tables</dt>
              <dd className="wrap">
                {downstream.map((item) => item.name).join(', ') || '—'}
              </dd>
            </div>
            {transitiveDownstream.length > 0 && (
              <div>
                <dt>Downstream datasets &amp; reports</dt>
                <dd className="wrap">
                  {transitiveDownstream.map((item) => item.name).join(', ')}
                </dd>
              </div>
            )}
          </dl>
        </div>
      )}

      {asset.type !== 'metric' && (
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
              <span
                className={`layer-badge ${asset.layer
                  .toLowerCase()
                  .replace(' ', '-')}`}
              >
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
      )}

      <div className="details-section">
        <h4>Relationships</h4>
        <RelationshipList
          items={upstream}
          onSelect={onSelect}
          title="Upstream"
        />
        <RelationshipList
          items={downstream}
          onSelect={onSelect}
          title="Downstream"
        />
      </div>
    </aside>
  )
}

function GraphCanvas({ rows, metrics = [] }: LineageGraphProps) {
  const graph = useMemo(() => buildLineage(rows, metrics), [rows, metrics])
  const { fitView } = useReactFlow()

  const sortedAssets = useMemo(
    () =>
      Array.from(graph.assets.values()).sort((a, b) => {
        const degree = (asset: AssetRecord) =>
          asset.upstreamIds.length + asset.downstreamIds.length
        return degree(b) - degree(a) || a.name.localeCompare(b.name)
      }),
    [graph.assets],
  )

  const [focusId, setFocusId] = useState<string | null>(null)
  const [expansions, setExpansions] = useState<Record<string, number>>({})
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  // Reset the anchor whenever a new workbook / sheet is loaded.
  useEffect(() => {
    setFocusId(pickDefaultFocus(graph.assets))
    setExpansions({})
    setSelectedId(null)
    setSearch('')
  }, [graph])

  const effectiveFocusId =
    focusId && graph.assets.has(focusId)
      ? focusId
      : pickDefaultFocus(graph.assets)

  const view = useMemo(
    () =>
      effectiveFocusId
        ? buildFocusedView(
            effectiveFocusId,
            graph.assets,
            graph.relations,
            expansions,
            selectedId,
          )
        : null,
    [effectiveFocusId, graph, expansions, selectedId],
  )

  const connected = getConnectedIds(selectedId, view?.edges ?? [])

  const focusOn = (id: string) => {
    setFocusId(id)
    setExpansions({})
    setSelectedId(id)
    // Let the new layout mount before recentering.
    window.setTimeout(() => fitView({ padding: 0.18, duration: 420 }), 60)
  }

  const expandGroup = (groupKey: string) =>
    setExpansions((current) => ({
      ...current,
      [groupKey]: (current[groupKey] ?? 3) + 3,
    }))

  const nodes = (view?.nodes ?? []).map((node) => {
    if (node.type === 'expander') return node
    return {
      ...node,
      data: {
        ...node.data,
        isDimmed: Boolean(selectedId && !connected.has(node.id)),
      },
    }
  })

  const edges = (view?.edges ?? []).map((edge) => ({
    ...edge,
    style: {
      ...edge.style,
      opacity:
        selectedId &&
        !(edge.source === selectedId || edge.target === selectedId)
          ? 0.12
          : 1,
    },
  }))

  const selectedAsset = selectedId ? graph.assets.get(selectedId) : undefined
  const focusAsset = effectiveFocusId
    ? graph.assets.get(effectiveFocusId)
    : undefined

  const searchMatches = search.trim()
    ? sortedAssets
        .filter((asset) =>
          asset.name.toLowerCase().includes(search.trim().toLowerCase()),
        )
        .slice(0, 6)
    : []

  if (!graph.assets.size || !focusAsset) {
    return (
      <div className="graph-shell">
        <div className="empty-table" style={{ minHeight: 460 }}>
          <ArrowLeftRight size={24} />
          <strong>No lineage to display</strong>
          <span>Upload a workbook with valid upstream/downstream rows.</span>
        </div>
      </div>
    )
  }

  return (
    <div className="graph-shell">
      <div className="graph-toolbar">
        <div className="focus-picker">
          <Crosshair size={15} />
          <div className="focus-picker-copy">
            <span>Focused asset</span>
            <select
              onChange={(event) => focusOn(event.target.value)}
              value={effectiveFocusId ?? ''}
            >
              {sortedAssets.map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.name} · {assetConfig[asset.type].label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="graph-search">
          <Search size={16} />
          <input
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Find an asset to focus..."
            value={search}
          />
          {searchMatches.length > 0 && (
            <div className="search-results">
              {searchMatches.map((asset) => (
                <button
                  key={asset.id}
                  onClick={() => {
                    focusOn(asset.id)
                    setSearch('')
                  }}
                  type="button"
                >
                  <i style={{ background: assetConfig[asset.type].color }} />
                  <strong>{asset.name}</strong>
                  <small>{assetConfig[asset.type].label}</small>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="graph-count">
          <span>
            <i className="upstream-line" /> {view?.upstreamCount ?? 0} upstream
          </span>
          <span>
            <i className="downstream-line" /> {view?.downstreamCount ?? 0}{' '}
            downstream
          </span>
        </div>
      </div>

      <div className="graph-stage">
        <ReactFlow
          edges={edges}
          fitView
          fitViewOptions={{ padding: 0.18 }}
          minZoom={0.3}
          maxZoom={1.8}
          nodeTypes={nodeTypes}
          nodes={nodes}
          nodesConnectable={false}
          nodesDraggable
          onNodeClick={(_, node) => {
            if (node.type === 'expander') {
              expandGroup((node.data as { groupKey: string }).groupKey)
              return
            }
            setSelectedId(node.id)
          }}
          onNodeDoubleClick={(_, node) => {
            if (node.type === 'asset' && node.id !== effectiveFocusId) {
              focusOn(node.id)
            }
          }}
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
              node.type === 'expander'
                ? '#c4c0d0'
                : assetConfig[(node.data as { asset: AssetRecord }).asset.type]
                    .color
            }
            pannable
            position="bottom-right"
            zoomable
          />
          <div className="flow-legend">
            <span>
              <i className="upstream-line" /> Upstream
            </span>
            <span>
              <i className="downstream-line" /> Downstream
            </span>
            <span className="legend-hint">Double-click a node to re-center</span>
          </div>
        </ReactFlow>
        {selectedAsset ? (
          <DetailsPanel
            asset={selectedAsset}
            assets={graph.assets}
            isFocus={selectedAsset.id === effectiveFocusId}
            onClose={() => setSelectedId(null)}
            onFocus={focusOn}
            onSelect={(id) => setSelectedId(id)}
          />
        ) : (
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
