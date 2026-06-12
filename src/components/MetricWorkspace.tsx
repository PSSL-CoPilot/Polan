import {
  AlertTriangle,
  ArrowRight,
  Check,
  ChevronDown,
  ExternalLink,
  FileSpreadsheet,
  GitBranch,
  Link2,
  Pencil,
  Search,
  Sigma,
  Table2,
  Trash2,
  UploadCloud,
} from 'lucide-react'
import { useState } from 'react'
import type { MetricRecord, SheetData } from '../types'
import {
  immediateTableExists,
  immediateTableOptions,
  metricImmediateTable,
} from '../utils/metricImmediateTable'

interface MetricWorkspaceProps {
  metric: MetricRecord
  sheets: SheetData[]
  onToggleSheet: (sheet: string) => void
  onSetImmediateTable: (sheet: string, table: string | null) => void
  onDisconnectMissing: (sheet: string) => void
  onEdit: () => void
  onDelete: () => void
  onOpenLineage: () => void
  onGoToUpload: () => void
}

function ImmediateTableSelect({
  options,
  selected,
  sheetName,
  onChange,
}: {
  options: string[]
  selected: string | undefined
  sheetName: string
  onChange: (value: string | null) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const normalizedQuery = query.trim().toLowerCase()
  const filteredOptions = options.filter((option) =>
    option.toLowerCase().includes(normalizedQuery),
  )
  const missing = Boolean(selected) && !immediateTableExists(options, selected)

  return (
    <div
      className="immediate-table-select"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setOpen(false)
          setQuery('')
        }
      }}
    >
      <button
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={`Select Immediate Table for ${sheetName}`}
        className={`immediate-table-trigger ${missing ? 'missing' : ''}`}
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <span>{selected || 'Select Immediate Table'}</span>
        <ChevronDown size={14} />
      </button>

      {open && (
        <div className="immediate-table-menu">
          <label className="immediate-table-search">
            <Search size={13} />
            <input
              aria-label={`Search Immediate Tables for ${sheetName}`}
              autoFocus
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  setOpen(false)
                  setQuery('')
                }
              }}
              placeholder="Search impacted assets..."
              value={query}
            />
          </label>
          <div
            aria-label={`Immediate Table options for ${sheetName}`}
            className="immediate-table-options"
            role="listbox"
          >
            {selected && (
              <button
                className="immediate-table-clear"
                onClick={() => {
                  onChange(null)
                  setOpen(false)
                  setQuery('')
                }}
                type="button"
              >
                Clear selection
              </button>
            )}
            {filteredOptions.map((option) => {
              const active =
                selected?.trim().toLowerCase() === option.toLowerCase()
              return (
                <button
                  aria-selected={active}
                  className={active ? 'selected' : ''}
                  key={option}
                  onClick={() => {
                    onChange(option)
                    setOpen(false)
                    setQuery('')
                  }}
                  role="option"
                  type="button"
                >
                  <span>{option}</span>
                  {active && <Check size={13} />}
                </button>
              )
            })}
            {!filteredOptions.length && (
              <span className="immediate-table-empty">
                No matching impacted assets
              </span>
            )}
          </div>
        </div>
      )}

      {missing && (
        <span className="immediate-table-warning">
          <AlertTriangle size={12} />
          Saved table is missing from this sheet.
        </span>
      )}
    </div>
  )
}

export function MetricWorkspace({
  metric,
  sheets,
  onToggleSheet,
  onSetImmediateTable,
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
  const connectedSheets = metric.connectedSheets
    .map((name) => validSheets.find((sheet) => sheet.name === name))
    .filter((sheet): sheet is SheetData => Boolean(sheet))

  const tablesBySheet = new Map(
    validSheets.map((sheet) => [
      sheet.name,
      Array.from(
        new Set(sheet.rows.map((row) => row.sourceAsset).filter(Boolean)),
      ),
    ]),
  )
  const immediateOptionsBySheet = new Map(
    validSheets.map((sheet) => [
      sheet.name,
      immediateTableOptions(sheet),
    ]),
  )

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
            least one table above and it will appear after the Power BI table.
          </div>
        )}
      </section>

      {connectedSheets.length > 0 && (
        <section className="connect-card immediate-table-card">
          <div className="section-title-row">
            <div>
              <span className="eyebrow">Metric routing</span>
              <h2>Immediate Tables</h2>
              <p className="section-sub">
                Choose the impacted table that should feed directly into the
                Power BI table for each connected sheet.
              </p>
            </div>
          </div>

          <div className="immediate-table-grid">
            {connectedSheets.map((sheet) => {
              const selected = metricImmediateTable(metric, sheet.name)
              const options = immediateOptionsBySheet.get(sheet.name) ?? []
              return (
                <div className="immediate-table-config" key={sheet.name}>
                  <div className="immediate-table-config-head">
                    <span className="sheet-tile-icon">
                      <FileSpreadsheet size={16} />
                    </span>
                    <div>
                      <strong>{sheet.name}</strong>
                      <small>
                        {options.length} unique impacted asset
                        {options.length === 1 ? '' : 's'}
                      </small>
                    </div>
                  </div>
                  <ImmediateTableSelect
                    onChange={(table) =>
                      onSetImmediateTable(sheet.name, table)
                    }
                    options={options}
                    selected={selected}
                    sheetName={sheet.name}
                  />
                </div>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}
