import {
  BadgeCheck,
  ChevronDown,
  Database,
  FileBarChart2,
  FolderTree,
  GitBranch,
  Layers3,
  Link2,
  Search,
  ShieldCheck,
  Sigma,
  Table2,
  X,
} from 'lucide-react'
import { useMemo, useState } from 'react'
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
          <strong>{na(metric.measureName)}</strong>
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
          <div className="glossary-drawer-table-wrap glossary-linked-wrap">
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
                    <td>{asset.name}</td>
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

function DashboardCard({
  dashboard,
  expanded,
  forceOpen,
  query,
  onToggle,
  onViewLineage,
}: {
  dashboard: GlossaryDashboard
  expanded: boolean
  forceOpen: boolean
  query: string
  onToggle: () => void
  onViewLineage: (metricId: string) => void
}) {
  const [openMetricId, setOpenMetricId] = useState<string | null>(null)
  const certEntries = (Object.entries(dashboard.certification) as Array<
    [CertStatus, number]
  >).filter(([, count]) => count > 0)

  return (
    <section className={`glossary-dash ${expanded ? 'is-open' : ''}`}>
      <button
        aria-expanded={expanded}
        className="glossary-dash-head"
        onClick={onToggle}
        type="button"
      >
        <ChevronDown
          className={`glossary-dash-chevron ${expanded ? '' : 'collapsed'}`}
          size={16}
        />
        <div className="glossary-dash-title">
          <strong>{dashboard.name}</strong>
          <small>{dashboard.owner ? `Owner · ${dashboard.owner}` : 'Report / Dashboard'}</small>
        </div>
        <div className="glossary-dash-meta">
          <span>{dashboard.metricCount} metric{dashboard.metricCount === 1 ? '' : 's'}</span>
          {dashboard.groupCount > 0 && (
            <span>{dashboard.groupCount} group{dashboard.groupCount === 1 ? '' : 's'}</span>
          )}
          <span>{dashboard.tableCount} table{dashboard.tableCount === 1 ? '' : 's'}</span>
          <span>{dashboard.measureCount} measure{dashboard.measureCount === 1 ? '' : 's'}</span>
          {certEntries.length > 0 ? (
            certEntries.map(([status, count]) => (
              <span className={`glossary-badge cert-${CERT_CLASS[status]}`} key={status}>
                {status}: {count}
              </span>
            ))
          ) : (
            <span className="glossary-badge cert-unknown">No metrics</span>
          )}
        </div>
      </button>

      {expanded && (
        <div className="glossary-dash-body">
          {dashboard.groups.length === 0 ? (
            <div className="glossary-group-empty">
              No metrics from Project Explorer are linked to this dashboard yet.
            </div>
          ) : (
            dashboard.groups.map((group) => (
              <div className="glossary-group" key={group.name}>
                <div className="glossary-group-head">
                  <FolderTree size={13} />
                  <span>{group.name}</span>
                  <small>{group.metrics.length}</small>
                </div>
                {group.metrics.map((metric) => {
                  const open =
                    openMetricId === metric.id ||
                    (forceOpen && metric.search.includes(query))
                  return (
                    <div className="glossary-kpi" key={metric.id}>
                      <button
                        aria-expanded={open}
                        className="glossary-kpi-head"
                        onClick={() =>
                          setOpenMetricId((current) =>
                            current === metric.id ? null : metric.id,
                          )
                        }
                        type="button"
                      >
                        <Sigma size={14} />
                        <span className="glossary-kpi-name">{metric.name}</span>
                        <span className="glossary-kpi-measure">
                          {metric.measureName || '—'}
                        </span>
                        <CertBadge status={metric.certification} />
                        <ChevronDown
                          className={`glossary-kpi-chevron ${open ? '' : 'collapsed'}`}
                          size={15}
                        />
                      </button>
                      {open && (
                        <MetricDetail
                          metric={metric}
                          onViewLineage={() => onViewLineage(metric.id)}
                        />
                      )}
                    </div>
                  )
                })}
              </div>
            ))
          )}
        </div>
      )}
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
  const [expandedId, setExpandedId] = useState<string | null>(null)

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

  // Empty state — no processed workbook yet.
  if (!rows.length) {
    return (
      <div className="page-content workspace-page glossary-page">
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
    )
  }

  const effectiveExpandedId =
    expandedId && glossary.dashboards.some((d) => d.id === expandedId)
      ? expandedId
      : filteredDashboards[0]?.id ?? null

  const summary = [
    { label: 'Dashboards', value: glossary.totals.dashboards, icon: <FileBarChart2 size={18} /> },
    { label: 'Metrics', value: glossary.totals.metrics, icon: <Sigma size={18} /> },
    { label: 'Certified Metrics', value: glossary.totals.certified, icon: <ShieldCheck size={18} /> },
    { label: 'Under Review', value: glossary.totals.underReview, icon: <BadgeCheck size={18} /> },
    { label: 'Linked Tables', value: glossary.totals.tables, icon: <Table2 size={18} /> },
  ]

  return (
    <div className="page-content workspace-page glossary-page">
      <div className="page-heading glossary-heading">
        <div>
          <span className="eyebrow">Data governance</span>
          <h1>Glossary</h1>
          <p>
            Search dashboards, metrics, definitions, linked assets, and lineage
            from processed workbook data.
          </p>
        </div>
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
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search dashboards, metrics, groups, tables, columns, measures, owners, certification..."
          value={query}
        />
        {query && (
          <button
            aria-label="Clear search"
            className="glossary-search-clear"
            onClick={() => setQuery('')}
            type="button"
          >
            <X size={14} />
          </button>
        )}
      </div>

      <div className="glossary-body glossary-body-single">
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
                expanded={
                  normalizedQuery
                    ? true
                    : effectiveExpandedId === dashboard.id
                }
                forceOpen={Boolean(normalizedQuery)}
                key={dashboard.id}
                onToggle={() =>
                  setExpandedId((current) =>
                    current === dashboard.id ? null : dashboard.id,
                  )
                }
                onViewLineage={onViewLineage}
                query={normalizedQuery}
              />
            ))
          )}
        </div>

        <aside className="glossary-governance">
          <div className="glossary-governance-head">
            <Layers3 size={16} />
            <h2>About this glossary</h2>
          </div>
          <p>
            Every dashboard, metric, and linked asset here is derived live from
            your processed workbook, Project Explorer metrics, and the lineage
            graph — there is no sample data.
          </p>
          <ul>
            <li>Dashboards are the report nodes from your lineage.</li>
            <li>Metric groups mirror your Project Explorer views.</li>
            <li>
              Governance fields (owner, certification) come from the workbook
              when present, otherwise show “Not available”.
            </li>
            <li>“View Lineage” focuses the metric in the Lineage tab.</li>
          </ul>
        </aside>
      </div>
    </div>
  )
}
