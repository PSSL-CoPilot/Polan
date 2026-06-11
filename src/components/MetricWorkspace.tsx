import {
  AlertTriangle,
  ArrowRight,
  Check,
  ExternalLink,
  FileSpreadsheet,
  GitBranch,
  Link2,
  Pencil,
  Sigma,
  Table2,
  Trash2,
  UploadCloud,
} from 'lucide-react'
import { useMemo } from 'react'
import type { MetricRecord, SheetData } from '../types'

interface MetricWorkspaceProps {
  metric: MetricRecord
  sheets: SheetData[]
  onToggleSheet: (sheet: string) => void
  onDisconnectMissing: (sheet: string) => void
  onEdit: () => void
  onDelete: () => void
  onOpenLineage: () => void
  onGoToUpload: () => void
}

export function MetricWorkspace({
  metric,
  sheets,
  onToggleSheet,
  onDisconnectMissing,
  onEdit,
  onDelete,
  onOpenLineage,
  onGoToUpload,
}: MetricWorkspaceProps) {
  const validSheets = sheets.filter((sheet) => !sheet.errors.length)
  const sheetNames = new Set(validSheets.map((sheet) => sheet.name))
  const missingSheets = metric.connectedSheets.filter(
    (name) => !sheetNames.has(name),
  )
  const connectedCount = metric.connectedSheets.filter((name) =>
    sheetNames.has(name),
  ).length

  const tablesBySheet = useMemo(() => {
    const map = new Map<string, string[]>()
    validSheets.forEach((sheet) => {
      const tables = Array.from(
        new Set(
          sheet.rows.map((row) => row.sourceAsset).filter(Boolean),
        ),
      )
      map.set(sheet.name, tables)
    })
    return map
  }, [validSheets])

  return (
    <div className="metric-workspace">
      <section className="metric-card-hero">
        <div className="metric-hero-icon">
          <Sigma size={22} />
        </div>
        <div className="metric-hero-copy">
          <span className="eyebrow">Metric</span>
          <h2>
            {metric.atlanLink ? (
              <a href={metric.atlanLink} rel="noreferrer" target="_blank">
                {metric.name}
                <ExternalLink size={14} />
              </a>
            ) : (
              metric.name
            )}
          </h2>
          <div className="metric-hero-meta">
            <span className="measure-chip">
              <Sigma size={11} />
              {metric.measureName}
            </span>
            {metric.atlanLink && (
              <a
                className="atlan-chip"
                href={metric.atlanLink}
                rel="noreferrer"
                target="_blank"
              >
                <Link2 size={11} />
                Atlan
              </a>
            )}
          </div>
          {metric.description && <p>{metric.description}</p>}
        </div>
        <div className="metric-hero-actions">
          <button className="ghost-button" onClick={onEdit} type="button">
            <Pencil size={13} />
            Edit
          </button>
          <button
            className="ghost-button danger"
            onClick={onDelete}
            type="button"
          >
            <Trash2 size={13} />
            Delete
          </button>
        </div>
      </section>

      {missingSheets.length > 0 && (
        <div className="warning-banner">
          <AlertTriangle size={16} />
          <span>
            <strong>
              {missingSheets.length} connected table
              {missingSheets.length === 1 ? ' is' : 's are'} missing from the
              current workbook
            </strong>
            {missingSheets.join(', ')} — re-upload the workbook or disconnect
            them below.
          </span>
        </div>
      )}

      <section className="connect-card">
        <div className="section-title-row">
          <div>
            <span className="eyebrow">Metric-to-table linking</span>
            <h2>Connected Power BI tables</h2>
            <p className="section-sub">
              Each workbook sheet represents one Power BI table. Connect this
              metric to one or more tables to place it in the lineage.
            </p>
          </div>
          {connectedCount > 0 && (
            <button
              className="primary-button compact"
              onClick={onOpenLineage}
              type="button"
            >
              <GitBranch size={14} />
              View in lineage
            </button>
          )}
        </div>

        {!validSheets.length ? (
          <div className="connect-empty">
            <UploadCloud size={26} />
            <strong>No workbook loaded</strong>
            <span>
              Upload an Excel workbook first — its sheets will appear here as
              connectable Power BI tables.
            </span>
            <button
              className="secondary-button"
              onClick={onGoToUpload}
              type="button"
            >
              Go to upload
              <ArrowRight size={14} />
            </button>
          </div>
        ) : (
          <div className="sheet-grid">
            {validSheets.map((sheet) => {
              const connected = metric.connectedSheets.includes(sheet.name)
              const tables = tablesBySheet.get(sheet.name) ?? []
              return (
                <button
                  className={`sheet-tile ${connected ? 'connected' : ''}`}
                  key={sheet.name}
                  onClick={() => onToggleSheet(sheet.name)}
                  type="button"
                >
                  <span className="sheet-tile-check">
                    {connected && <Check size={12} />}
                  </span>
                  <span className="sheet-tile-icon">
                    <FileSpreadsheet size={17} />
                  </span>
                  <span className="sheet-tile-copy">
                    <strong>{sheet.name}</strong>
                    <small>
                      {sheet.rows.length} rows
                      {tables.length > 0 && (
                        <>
                          {' · '}
                          <Table2 size={10} /> {tables.join(', ')}
                        </>
                      )}
                    </small>
                  </span>
                </button>
              )
            })}
            {missingSheets.map((name) => (
              <div className="sheet-tile missing" key={`missing-${name}`}>
                <span className="sheet-tile-check missing-mark">
                  <AlertTriangle size={11} />
                </span>
                <span className="sheet-tile-icon">
                  <FileSpreadsheet size={17} />
                </span>
                <span className="sheet-tile-copy">
                  <strong>{name}</strong>
                  <small>Missing from current workbook</small>
                </span>
                <button
                  className="text-button"
                  onClick={() => onDisconnectMissing(name)}
                  type="button"
                >
                  Disconnect
                </button>
              </div>
            ))}
          </div>
        )}

        {validSheets.length > 0 && !metric.connectedSheets.length && (
          <div className="connect-hint">
            <GitBranch size={14} />
            This metric exists but is not part of the lineage yet — connect at
            least one table above and it will appear between the source tables
            and the Power BI table.
          </div>
        )}
      </section>
    </div>
  )
}
