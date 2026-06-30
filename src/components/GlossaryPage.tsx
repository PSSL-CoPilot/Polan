import {
  BadgeCheck,
  Bot,
  ChevronDown,
  Database,
  FileBarChart2,
  GitBranch,
  Layers3,
  Link2,
  Search,
  ShieldCheck,
  Sigma,
  Sparkles,
  UserCheck,
  X,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import '../glossary.css'
import {
  glossaryData,
  governanceRules,
  type CertificationStatus,
  type Kpi,
  type Measure,
  type MetadataSource,
} from '../data/glossaryData'

interface GlossaryPageProps {
  /**
   * Navigate to the existing lineage view for a measure. Wired by App to switch
   * to the Lineage tab. See the TODO in the handler for deep-linking a specific
   * measure once glossary measures are connected to real workbook metrics.
   */
  onViewMeasureLineage: (measure: Measure) => void
}

const CERT_CLASS: Record<CertificationStatus, string> = {
  Draft: 'draft',
  'Under Review': 'review',
  Certified: 'certified',
  Deprecated: 'deprecated',
}

const SOURCE_CLASS: Record<MetadataSource, string> = {
  'AI Suggested': 'ai',
  'Manually Added': 'manual',
  'Human Verified': 'verified',
  Certified: 'certified',
}

function CertBadge({ status }: { status: CertificationStatus }) {
  return (
    <span className={`glossary-badge cert-${CERT_CLASS[status]}`}>
      <BadgeCheck size={11} />
      {status}
    </span>
  )
}

function SourceBadge({ source }: { source: MetadataSource }) {
  const Icon =
    source === 'AI Suggested'
      ? Bot
      : source === 'Human Verified'
        ? UserCheck
        : source === 'Certified'
          ? ShieldCheck
          : Sparkles
  return (
    <span className={`glossary-badge src-${SOURCE_CLASS[source]}`}>
      <Icon size={11} />
      {source}
    </span>
  )
}

function KpiDetail({
  kpi,
  measure,
  onViewLineage,
  onViewLinkedAssets,
}: {
  kpi: Kpi
  measure: Measure | undefined
  onViewLineage: () => void
  onViewLinkedAssets: () => void
}) {
  return (
    <div className="kpi-detail">
      <div className="kpi-detail-grid">
        <div className="kpi-field span-2">
          <span className="kpi-field-label">Business definition</span>
          <p>{kpi.definition}</p>
        </div>
        <div className="kpi-field span-2">
          <span className="kpi-field-label">Formula</span>
          <code className="kpi-formula">{kpi.formula}</code>
        </div>
        <div className="kpi-field span-2">
          <span className="kpi-field-label">Business logic / assumptions</span>
          <p>{kpi.businessLogic}</p>
        </div>
        <div className="kpi-field">
          <span className="kpi-field-label">Associated measure</span>
          <strong>{measure?.name ?? '—'}</strong>
        </div>
        <div className="kpi-field">
          <span className="kpi-field-label">Measure type</span>
          <strong>{measure?.type ?? '—'}</strong>
        </div>
        <div className="kpi-field">
          <span className="kpi-field-label">KPI owner</span>
          <strong>{kpi.kpiOwner}</strong>
        </div>
        <div className="kpi-field">
          <span className="kpi-field-label">Technical owner</span>
          <strong>{kpi.technicalOwner}</strong>
        </div>
        <div className="kpi-field">
          <span className="kpi-field-label">Certification</span>
          <CertBadge status={kpi.certification} />
        </div>
        <div className="kpi-field">
          <span className="kpi-field-label">Last reviewed</span>
          <strong>{kpi.lastReviewed}</strong>
        </div>
      </div>

      <div className="kpi-audit">
        <span className="kpi-field-label">Audit &amp; approval</span>
        <div className="kpi-audit-row">
          <span>Created by <strong>{kpi.audit.createdBy}</strong></span>
          <span>Last updated by <strong>{kpi.audit.lastUpdatedBy}</strong></span>
          <span>Approved by <strong>{kpi.audit.approvedBy}</strong></span>
          <span>
            Approval{' '}
            <span className={`glossary-badge approval-${kpi.audit.approvalStatus.toLowerCase()}`}>
              {kpi.audit.approvalStatus}
            </span>
          </span>
          <span>Audit log entries <strong>{kpi.audit.auditLogCount}</strong></span>
        </div>
        <p className="kpi-change-reason">
          Change reason: {kpi.audit.changeReason}
        </p>
      </div>

      <div className="kpi-detail-actions">
        <button
          className="primary-button compact"
          onClick={onViewLineage}
          type="button"
        >
          <GitBranch size={14} />
          View Measure Lineage
        </button>
        <button
          className="ghost-button"
          onClick={onViewLinkedAssets}
          type="button"
        >
          <Link2 size={14} />
          View Linked Assets
        </button>
      </div>
    </div>
  )
}

function LinkedAssetsDrawer({
  measure,
  onClose,
}: {
  measure: Measure
  onClose: () => void
}) {
  return (
    <div
      className="glossary-drawer-scrim"
      onClick={onClose}
      role="presentation"
    >
      <aside
        aria-label={`Linked assets for ${measure.name}`}
        className="glossary-drawer"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="glossary-drawer-head">
          <div>
            <span className="eyebrow">Linked assets</span>
            <h3>{measure.name}</h3>
          </div>
          <button aria-label="Close linked assets" onClick={onClose} type="button">
            <X size={18} />
          </button>
        </div>

        <div className="glossary-drawer-meta">
          <div>
            <Database size={14} />
            <span>BigQuery table</span>
            <strong>{measure.bigQueryTable}</strong>
          </div>
          <div>
            <Layers3 size={14} />
            <span>Power BI dataset</span>
            <strong>{measure.powerBiDataset}</strong>
          </div>
          <div>
            <GitBranch size={14} />
            <span>Upstream source</span>
            <strong>{measure.upstreamSource}</strong>
          </div>
          <div>
            <FileBarChart2 size={14} />
            <span>Downstream dashboards</span>
            <strong>{measure.downstreamDashboards.join(', ') || '—'}</strong>
          </div>
          <div>
            <Sigma size={14} />
            <span>Columns used</span>
            <strong>{measure.columnsUsed.join(', ')}</strong>
          </div>
          <div>
            <Sigma size={14} />
            <span>Related KPIs</span>
            <strong>{measure.relatedKpis.join(', ')}</strong>
          </div>
        </div>

        <div className="glossary-drawer-table-wrap">
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
              {measure.linkedAssets.map((asset) => (
                <tr key={`${asset.name}-${asset.relationship}`}>
                  <td>{asset.name}</td>
                  <td>{asset.type}</td>
                  <td>{asset.relationship}</td>
                  <td>{asset.owner}</td>
                  <td>{asset.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </aside>
    </div>
  )
}

export function GlossaryPage({ onViewMeasureLineage }: GlossaryPageProps) {
  const { dashboards, kpis, measures } = glossaryData
  const [query, setQuery] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(
    dashboards[0]?.id ?? null,
  )
  const [openKpiId, setOpenKpiId] = useState<string | null>(null)
  const [drawerMeasure, setDrawerMeasure] = useState<Measure | null>(null)

  // One searchable haystack per dashboard, spanning dashboard / KPI / measure /
  // table / column / owner / certification — so a single query hits any of them.
  const searchIndex = useMemo(() => {
    const index = new Map<string, string>()
    dashboards.forEach((dashboard) => {
      const parts = [
        dashboard.name,
        dashboard.domain,
        dashboard.owner,
        dashboard.certification,
      ]
      dashboard.kpiIds.forEach((kpiId) => {
        const kpi = kpis[kpiId]
        if (!kpi) return
        parts.push(kpi.name, kpi.kpiOwner, kpi.technicalOwner, kpi.certification)
        const measure = measures[kpi.measureId]
        if (measure) {
          parts.push(
            measure.name,
            measure.bigQueryTable,
            ...measure.columnsUsed,
            measure.powerBiDataset,
          )
        }
      })
      index.set(dashboard.id, parts.join('   ').toLowerCase())
    })
    return index
  }, [dashboards, kpis, measures])

  const normalizedQuery = query.trim().toLowerCase()
  const filteredDashboards = useMemo(
    () =>
      normalizedQuery
        ? dashboards.filter((dashboard) =>
            searchIndex.get(dashboard.id)?.includes(normalizedQuery),
          )
        : dashboards,
    [dashboards, normalizedQuery, searchIndex],
  )

  const summary = useMemo(() => {
    const kpiList = Object.values(kpis)
    return {
      dashboards: dashboards.length,
      kpis: kpiList.length,
      measures: Object.keys(measures).length,
      certified: kpiList.filter((kpi) => kpi.certification === 'Certified')
        .length,
    }
  }, [dashboards, kpis, measures])

  const toggleDashboard = (id: string) => {
    setExpandedId((current) => (current === id ? null : id))
    setOpenKpiId(null)
  }

  const handleViewLineage = (measure: Measure) => {
    // Navigate to the existing lineage view. The glossary measures are mock
    // governance data and aren't yet bound to real workbook metric nodes, so we
    // open the lineage tab rather than deep-linking a specific node.
    // TODO: when glossary measures map to workbook metrics, pass the metric id
    // here and deep-link via buildMetricLineageUrl(metricId, workbookId).
    onViewMeasureLineage(measure)
  }

  return (
    <div className="page-content workspace-page glossary-page">
      <div className="page-heading glossary-heading">
        <div>
          <span className="eyebrow">Data governance</span>
          <h1>Glossary</h1>
          <p>
            Search certified dashboards, KPIs, and measures — then trace any
            measure to its linked assets and lineage.
          </p>
        </div>
      </div>

      <div className="glossary-summary">
        <article className="glossary-stat">
          <FileBarChart2 size={18} />
          <div>
            <strong>{summary.dashboards}</strong>
            <span>Dashboards</span>
          </div>
        </article>
        <article className="glossary-stat">
          <Sigma size={18} />
          <div>
            <strong>{summary.kpis}</strong>
            <span>KPIs</span>
          </div>
        </article>
        <article className="glossary-stat">
          <Database size={18} />
          <div>
            <strong>{summary.measures}</strong>
            <span>Measures</span>
          </div>
        </article>
        <article className="glossary-stat">
          <ShieldCheck size={18} />
          <div>
            <strong>{summary.certified}</strong>
            <span>Certified KPIs</span>
          </div>
        </article>
      </div>

      <div className="glossary-search">
        <Search size={16} />
        <input
          aria-label="Search dashboards, KPIs, measures, tables, columns, owners"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search dashboards, KPIs, measures, tables, columns, owners, certification..."
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

      <div className="glossary-body">
        <div className="glossary-list">
          {filteredDashboards.length === 0 ? (
            <div className="glossary-empty">
              <Search size={22} />
              <strong>No matches found</strong>
              <span>
                Nothing matched “{query}”. Try a dashboard, KPI, measure, table,
                column, owner, or certification status.
              </span>
            </div>
          ) : (
            filteredDashboards.map((dashboard) => {
              const expanded = expandedId === dashboard.id
              return (
                <section
                  className={`glossary-dash ${expanded ? 'is-open' : ''}`}
                  key={dashboard.id}
                >
                  <button
                    aria-expanded={expanded}
                    className="glossary-dash-head"
                    onClick={() => toggleDashboard(dashboard.id)}
                    type="button"
                  >
                    <ChevronDown
                      className={`glossary-dash-chevron ${expanded ? '' : 'collapsed'}`}
                      size={16}
                    />
                    <div className="glossary-dash-title">
                      <strong>{dashboard.name}</strong>
                      <small>{dashboard.domain}</small>
                    </div>
                    <div className="glossary-dash-meta">
                      <span>
                        Owner <strong>{dashboard.owner}</strong>
                      </span>
                      <span>
                        Updated <strong>{dashboard.lastUpdated}</strong>
                      </span>
                      <span className="glossary-kpi-count">
                        {dashboard.kpiIds.length} KPI
                        {dashboard.kpiIds.length === 1 ? '' : 's'}
                      </span>
                      <CertBadge status={dashboard.certification} />
                    </div>
                  </button>

                  {expanded && (
                    <div className="glossary-dash-body">
                      {dashboard.kpiIds.map((kpiId) => {
                        const kpi = kpis[kpiId]
                        if (!kpi) return null
                        const measure = measures[kpi.measureId]
                        const open = openKpiId === `${dashboard.id}:${kpiId}`
                        return (
                          <div className="glossary-kpi" key={kpiId}>
                            <button
                              aria-expanded={open}
                              className="glossary-kpi-head"
                              onClick={() =>
                                setOpenKpiId((current) =>
                                  current === `${dashboard.id}:${kpiId}`
                                    ? null
                                    : `${dashboard.id}:${kpiId}`,
                                )
                              }
                              type="button"
                            >
                              <Sigma size={14} />
                              <span className="glossary-kpi-name">
                                {kpi.name}
                              </span>
                              <span className="glossary-kpi-measure">
                                {measure?.name ?? '—'}
                              </span>
                              <SourceBadge source={kpi.metadataSource} />
                              <CertBadge status={kpi.certification} />
                              <ChevronDown
                                className={`glossary-kpi-chevron ${open ? '' : 'collapsed'}`}
                                size={15}
                              />
                            </button>
                            {open && (
                              <KpiDetail
                                kpi={kpi}
                                measure={measure}
                                onViewLineage={() =>
                                  measure && handleViewLineage(measure)
                                }
                                onViewLinkedAssets={() =>
                                  measure && setDrawerMeasure(measure)
                                }
                              />
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </section>
              )
            })
          )}
        </div>

        <aside className="glossary-governance">
          <div className="glossary-governance-head">
            <ShieldCheck size={16} />
            <h2>Change Governance</h2>
          </div>
          <p>
            Atlan / glossary updates are <strong>mandatory</strong> whenever any
            of the following change, so lineage and certification stay accurate:
          </p>
          <ul>
            {governanceRules.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
          <div className="glossary-governance-note">
            <Sparkles size={13} />
            AI can suggest metadata, but human approval is required before a KPI
            or measure can be certified.
          </div>
        </aside>
      </div>

      {drawerMeasure && (
        <LinkedAssetsDrawer
          measure={drawerMeasure}
          onClose={() => setDrawerMeasure(null)}
        />
      )}
    </div>
  )
}
