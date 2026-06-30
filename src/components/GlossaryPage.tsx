import {
  BadgeCheck,
  ChevronRight,
  Database,
  FileBarChart2,
  FolderTree,
  GitBranch,
  Info,
  Link2,
  Search,
  ShieldCheck,
  Sigma,
  Table2,
  X,
} from 'lucide-react'
import {
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react'
import '../glossary.css'
import type { AssetRecord, ProcessedRow, ViewRecord } from '../types'
import {
  buildGlossary,
  type CertStatus,
  type GlossaryDashboard,
  type GlossaryMetric,
} from '../utils/glossary'

interface GlossaryPageProps {
  rows: ProcessedRow[]
  assets: Map<string, AssetRecord>
  views: ViewRecord[]
  /** Focus a metric in the Lineage tab. Receives the MetricRecord id. */
  onViewLineage: (metricId: string) => void
}

const CERT_CLASS: Record<CertStatus, string> = {
  Certified: 'certified',
  'Under Review': 'review',
  Draft: 'draft',
  Deprecated: 'deprecated',
  Unknown: 'unknown',
}

function CertBadge({ status }: { status: CertStatus }) {
  return (
    <span className={`glossary-badge cert-${CERT_CLASS[status]}`}>
      <BadgeCheck size={11} />
      {status}
    </span>
  )
}

const na = (value: string | null | undefined) =>
  value && value.trim() ? value : 'Not available'

function MetricDetail({
  metric,
  onViewLineage,
}: {
  metric: GlossaryMetric
  onViewLineage: () => void
}) {
  const counts: Array<{ label: string; value: number }> = [
    { label: 'Tables', value: metric.counts.tables },
    { label: 'Columns', value: metric.counts.columns },
    { label: 'Measures', value: metric.counts.measures },
    { label: 'Upstream', value: metric.counts.upstream },
    { label: 'Downstream', value: metric.counts.downstream },
    { label: 'Dashboards', value: metric.counts.dashboards },
    { label: 'Issues', value: metric.counts.warnings },
  ]

  return (
    <div className="kpi-detail">
      <div className="kpi-count-strip">
        {counts.map((count) => (
          <div className="kpi-count" key={count.label}>
            <strong>{count.value}</strong>
            <span>{count.label}</span>
          </div>
        ))}
      </div>

      <div className="kpi-detail-grid">
        <div className="kpi-field span-2">
          <span className="kpi-field-label">Business definition</span>
          <p>{na(metric.definition)}</p>
        </div>
        <div className="kpi-field span-2">
          <span className="kpi-field-label">Formula / calculation logic</span>
          {metric.formula ? (
            <code className="kpi-formula">{metric.formula}</code>
          ) : (
            <p>Not available</p>
          )}
        </div>
        <div className="kpi-field">
          <span className="kpi-field-label">Associated measure</span>
          <strong className="kpi-field-mono">{na(metric.measureName)}</strong>
        </div>
        <div className="kpi-field">
          <span className="kpi-field-label">Measure type</span>
          <strong>{metric.measureType}</strong>
        </div>
        <div className="kpi-field">
          <span className="kpi-field-label">Metric group</span>
          <strong>{metric.groupName}</strong>
        </div>
        <div className="kpi-field">
          <span className="kpi-field-label">Dashboards / reports</span>
          <strong>{metric.reportNames.join(', ') || 'Not available'}</strong>
        </div>
        <div className="kpi-field">
          <span className="kpi-field-label">Owner</span>
          <strong>{na(metric.owner)}</strong>
        </div>
        <div className="kpi-field">
          <span className="kpi-field-label">Technical owner</span>
          <strong>{na(metric.technicalOwner)}</strong>
        </div>
        <div className="kpi-field">
          <span className="kpi-field-label">Certification</span>
          <CertBadge status={metric.certification} />
        </div>
        <div className="kpi-field">
          <span className="kpi-field-label">Last reviewed</span>
          <strong>{na(metric.lastReviewed)}</strong>
        </div>
      </div>

      {metric.linkedAssets.length > 0 && (
        <div className="kpi-linked">
          <span className="kpi-field-label">Linked assets</span>
          <div className="glossary-linked-wrap">
            <table className="glossary-asset-table">
              <thead>
                <tr>
                  <th>Asset</th>
                  <th>Type</th>
                  <th>Relationship</th>
                  <th>Owner</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {metric.linkedAssets.map((asset, index) => (
                  <tr key={`${asset.name}-${asset.relationship}-${index}`}>
                    <td className="asset-name-cell">{asset.name}</td>
                    <td>{asset.type}</td>
                    <td>{asset.relationship}</td>
                    <td>{asset.owner ?? 'Not available'}</td>
                    <td>{asset.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="kpi-detail-actions">
        <button
          className="primary-button compact"
          disabled={!metric.lineageNodeId}
          onClick={onViewLineage}
          title={
            metric.lineageNodeId
              ? 'Focus this metric in the lineage graph'
              : 'Lineage not available for this metric.'
          }
          type="button"
        >
          <GitBranch size={14} />
          View Lineage
        </button>
        {metric.atlanLink && (
          <a
            className="ghost-button"
            href={metric.atlanLink}
            rel="noreferrer"
            target="_blank"
          >
            <Link2 size={14} />
            Open in Atlan
          </a>
        )}
      </div>
    </div>
  )
}

function MetricRow({
  metric,
  open,
  onToggle,
  onViewLineage,
}: {
  metric: GlossaryMetric
  open: boolean
  onToggle: () => void
  onViewLineage: () => void
}) {
  return (
    <div className={`glossary-kpi ${open ? 'is-open' : ''}`}>
      <button
        aria-expanded={open}
        className="glossary-kpi-head"
        onClick={onToggle}
        type="button"
      >
        <ChevronRight className="glossary-chevron" size={14} />
        <Sigma size={14} className="glossary-kpi-icon" />
        <span className="glossary-kpi-name">{metric.name}</span>
        <span className="glossary-kpi-measure">{metric.measureName || '—'}</span>
        <CertBadge status={metric.certification} />
      </button>
      {open && (
        <MetricDetail metric={metric} onViewLineage={onViewLineage} />
      )}
    </div>
  )
}

function DashboardCard({
  dashboard,
  open,
  query,
  openMetrics,
  onToggle,
  onToggleMetric,
  onViewLineage,
}: {
  dashboard: GlossaryDashboard
  open: boolean
  query: string
  openMetrics: Set<string>
  onToggle: () => void
  onToggleMetric: (metricId: string) => void
  onViewLineage: (metricId: string) => void
}) {
  const certEntries = (
    Object.entries(dashboard.certification) as Array<[CertStatus, number]>
  ).filter(([, count]) => count > 0)

  const metricIsOpen = (metric: GlossaryMetric) =>
    query ? metric.search.includes(query) : openMetrics.has(metric.id)

  return (
    <section className={`glossary-dash ${open ? 'is-open' : ''}`}>
      <button
        aria-expanded={open}
        className="glossary-dash-head"
        onClick={onToggle}
        type="button"
      >
        <ChevronRight className="glossary-chevron" size={16} />
        <span className="glossary-dash-icon">
          <FileBarChart2 size={15} />
        </span>
        <div className="glossary-dash-title">
          <strong>{dashboard.name}</strong>
          <small>
            {dashboard.owner ? `Owner · ${dashboard.owner}` : 'Report / Dashboard'}
          </small>
        </div>
        <div className="glossary-dash-meta">
          <span className="glossary-chip">
            {dashboard.metricCount} metric{dashboard.metricCount === 1 ? '' : 's'}
          </span>
          {dashboard.groupCount > 0 && (
            <span className="glossary-chip">
              {dashboard.groupCount} group{dashboard.groupCount === 1 ? '' : 's'}
            </span>
          )}
          <span className="glossary-chip">
            {dashboard.tableCount} table{dashboard.tableCount === 1 ? '' : 's'}
          </span>
          <span className="glossary-chip">
            {dashboard.measureCount} measure
            {dashboard.measureCount === 1 ? '' : 's'}
          </span>
          {certEntries.map(([status, count]) => (
            <span
              className={`glossary-badge cert-${CERT_CLASS[status]}`}
              key={status}
            >
              {status}: {count}
            </span>
          ))}
        </div>
      </button>

      <div className="glossary-collapse">
        <div className="glossary-collapse-inner">
          <div className="glossary-dash-body">
            {dashboard.groups.length === 0 ? (
              <div className="glossary-group-empty">
                No metrics from Project Explorer are linked to this dashboard
                yet.
              </div>
            ) : (
              dashboard.groups.map((group) => (
                <div className="glossary-group" key={group.name}>
                  <div className="glossary-group-head">
                    <FolderTree size={13} />
                    <span>{group.name}</span>
                    <small>{group.metrics.length}</small>
                  </div>
                  <div className="glossary-group-metrics">
                    {group.metrics.map((metric) => (
                      <MetricRow
                        key={metric.id}
                        metric={metric}
                        onToggle={() => onToggleMetric(metric.id)}
                        onViewLineage={() => onViewLineage(metric.id)}
                        open={metricIsOpen(metric)}
                      />
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

export function GlossaryPage({
  rows,
  assets,
  views,
  onViewLineage,
}: GlossaryPageProps) {
  const glossary = useMemo(
    () => buildGlossary(rows, assets, views),
    [rows, assets, views],
  )
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [openMetrics, setOpenMetrics] = useState<Set<string>>(new Set())

  const normalizedQuery = query.trim().toLowerCase()
  const filteredDashboards = useMemo(
    () =>
      normalizedQuery
        ? glossary.dashboards.filter((dashboard) =>
            dashboard.search.includes(normalizedQuery),
          )
        : glossary.dashboards,
    [glossary.dashboards, normalizedQuery],
  )

  const updateQuery = (value: string) => {
    setQuery(value)
    // Clearing the search returns dashboards to the collapsed default state.
    if (!value.trim()) {
      setExpanded(new Set())
      setOpenMetrics(new Set())
    }
  }

  const toggleSet = (
    setter: Dispatch<SetStateAction<Set<string>>>,
    id: string,
  ) => {
    setter((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Empty state — no processed workbook yet.
  if (!rows.length) {
    return (
      <div className="glossary-page">
        <div className="glossary-inner">
          <div className="page-heading glossary-heading">
            <div>
              <span className="eyebrow">Data governance</span>
              <h1>Glossary</h1>
              <p>
                Search dashboards, metrics, definitions, linked assets, and
                lineage from processed workbook data.
              </p>
            </div>
          </div>
          <div className="glossary-empty glossary-empty-page">
            <Database size={26} />
            <strong>No glossary data available</strong>
            <span>Process a workbook first to generate glossary metadata.</span>
          </div>
        </div>
      </div>
    )
  }

  const summary = [
    { label: 'Dashboards', value: glossary.totals.dashboards, icon: <FileBarChart2 size={18} /> },
    { label: 'Metrics', value: glossary.totals.metrics, icon: <Sigma size={18} /> },
    { label: 'Certified Metrics', value: glossary.totals.certified, icon: <ShieldCheck size={18} /> },
    { label: 'Under Review', value: glossary.totals.underReview, icon: <BadgeCheck size={18} /> },
    { label: 'Linked Tables', value: glossary.totals.tables, icon: <Table2 size={18} /> },
  ]

  return (
    <div className="glossary-page">
      <div className="glossary-inner">
        <div className="page-heading glossary-heading">
          <div>
            <span className="eyebrow">Data governance</span>
            <h1>Glossary</h1>
            <p>
              Search dashboards, metrics, definitions, linked assets, and
              lineage from processed workbook data.
            </p>
          </div>
        </div>

        <div className="glossary-note">
          <Info size={13} />
          Derived live from your processed workbook, Project Explorer metrics,
          and the lineage graph. Expand a dashboard to see its metric groups and
          metrics.
        </div>

        <div className="glossary-summary glossary-summary-5">
          {summary.map((card) => (
            <article className="glossary-stat" key={card.label}>
              {card.icon}
              <div>
                <strong>{card.value}</strong>
                <span>{card.label}</span>
              </div>
            </article>
          ))}
        </div>

        <div className="glossary-search">
          <Search size={16} />
          <input
            aria-label="Search dashboards, metrics, tables, columns, measures, owners"
            onChange={(event) => updateQuery(event.target.value)}
            placeholder="Search dashboards, metrics, groups, tables, columns, measures, owners, certification..."
            value={query}
          />
          {query && (
            <button
              aria-label="Clear search"
              className="glossary-search-clear"
              onClick={() => updateQuery('')}
              type="button"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="glossary-list">
          {filteredDashboards.length === 0 ? (
            <div className="glossary-empty">
              <Search size={22} />
              <strong>No matching dashboards or metrics found</strong>
              <span>
                Nothing matched “{query}”. Try a dashboard, metric, group, table,
                measure, owner, or certification status.
              </span>
            </div>
          ) : (
            filteredDashboards.map((dashboard) => (
              <DashboardCard
                dashboard={dashboard}
                key={dashboard.id}
                onToggle={() => toggleSet(setExpanded, dashboard.id)}
                onToggleMetric={(metricId) =>
                  toggleSet(setOpenMetrics, metricId)
                }
                onViewLineage={onViewLineage}
                open={normalizedQuery ? true : expanded.has(dashboard.id)}
                openMetrics={openMetrics}
                query={normalizedQuery}
              />
            ))
          )}
        </div>
      </div>
    </div>
  )
}
