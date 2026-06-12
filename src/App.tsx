import { AnimatePresence, motion } from 'framer-motion'
import {
  AlertTriangle,
  ArrowDownToLine,
  CheckCircle2,
  GitBranch,
  Sigma,
} from 'lucide-react'
import React, { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './index.css'
import './workspace.css'
import { ConfirmDialog } from './components/ConfirmDialog'
import { DashboardPage } from './components/DashboardPage'
import { DataTable } from './components/DataTable'
import { MetricModal, type MetricFormValues } from './components/MetricModal'
import { MetricWorkspace } from './components/MetricWorkspace'
import { Sidebar } from './components/Sidebar'
import { Topbar } from './components/Topbar'
import { UploadWorkspace } from './components/UploadWorkspace'
import { allMetrics, findMetric, useProject } from './hooks/useProject'
import { useWorkbooks } from './hooks/useWorkbooks'
import type { AppView, Layer, MetricRecord, WorkbookData } from './types'
import { buildLineage } from './utils/lineage'
import { buildMetricTableEntries } from './utils/metricData'
import { downloadProjectFile, parseProjectFile } from './utils/storage'

const LineageGraph = lazy(() =>
  import('./components/LineageGraph').then((module) => ({
    default: module.LineageGraph,
  })),
)

interface MetricModalState {
  open: boolean
  viewId: string | null
  editing: MetricRecord | null
}

const LINEAGE_FILTER_OPTS = [
  { key: 'Gold', label: 'Gold', cls: 'gold' },
  { key: 'Silver', label: 'Silver', cls: 'silver' },
  { key: 'Raw', label: 'Bronze / Raw', cls: 'raw' },
  { key: 'mdr', label: 'MDR available', cls: 'mdr' },
  { key: 'no-mdr', label: 'Not in MDR', cls: 'no-mdr' },
] as const

function App() {
  const [activeView, setActiveView] = useState<AppView>('upload')
  const [selectedSheet, setSelectedSheet] = useState('all')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState<{
    message: string
    tone: 'success' | 'error'
  } | null>(null)
  const [modal, setModal] = useState<MetricModalState>({
    open: false,
    viewId: null,
    editing: null,
  })
  const [deleteCandidateId, setDeleteCandidateId] = useState<string | null>(null)
  const [lineageFilter, setLineageFilter] = useState<string | null>(null)
  const [lineageMetricFilter, setLineageMetricFilter] = useState<string | null>(null)
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    const stored = localStorage.getItem('polan-sidebar-w')
    return stored ? Math.max(200, Math.min(480, Number(stored))) : 242
  })
  const fileInputRef = useRef<HTMLInputElement>(null)

  const {
    project,
    renameProject,
    addView,
    renameView,
    deleteView,
    toggleView,
    addMetric,
    updateMetric,
    deleteMetric,
    selectMetric,
    toggleConnectedSheet,
    setConnectedSheets,
    replaceProject,
  } = useProject()

  const {
    workbooks,
    activeWorkbookId,
    activeWorkbook,
    workbookState,
    addWorkbooks,
    renameWorkbook,
    deleteWorkbook,
    selectWorkbook,
    replaceWorkbooks,
  } = useWorkbooks()

  // Present the active workbook through the existing WorkbookData shape so the
  // downstream views stay unchanged.
  const workbook = useMemo<WorkbookData | null>(
    () =>
      activeWorkbook
        ? {
            name: activeWorkbook.displayName,
            sizeLabel: activeWorkbook.sizeLabel,
            loadedAt:
              activeWorkbook.loadedAt instanceof Date
                ? activeWorkbook.loadedAt
                : new Date(activeWorkbook.loadedAt),
            sheets: activeWorkbook.sheets,
          }
        : null,
    [activeWorkbook],
  )

  // Switching the active workbook resets sheet selection and all lineage filters.
  useEffect(() => {
    setSelectedSheet('all')
    setLineageFilter(null)
    setLineageMetricFilter(null)
  }, [activeWorkbookId])

  const handleSidebarWidthChange = useCallback((w: number) => {
    setSidebarWidth(w)
    localStorage.setItem('polan-sidebar-w', String(w))
  }, [])

  const validSheets =
    workbook?.sheets.filter((sheet) => !sheet.errors.length) ?? []
  const allRows = validSheets.flatMap((sheet) => sheet.rows)
  const selectedRows =
    selectedSheet === 'all'
      ? allRows
      : validSheets
          .filter((sheet) => sheet.name === selectedSheet)
          .flatMap((sheet) => sheet.rows)

  const metrics = useMemo(() => allMetrics(project), [project])
  const activeMetric = findMetric(project, project.selectedMetricId)

  const graph = useMemo(
    () => buildLineage(allRows, metrics),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [workbook, metrics],
  )

  const metricEntries = useMemo(
    () => buildMetricTableEntries(metrics, allRows, graph.assets),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [metrics, workbook, graph],
  )

  // Rows passed to the lineage graph, filtered by the active chip + metric.
  const lineageRows = useMemo(() => {
    let filtered = selectedRows
    if (lineageFilter === 'mdr') filtered = filtered.filter((r) => r.mdrAvailability)
    else if (lineageFilter === 'no-mdr') filtered = filtered.filter((r) => !r.mdrAvailability)
    else if (lineageFilter) filtered = filtered.filter((r) => r.layer === (lineageFilter as Layer))
    if (lineageMetricFilter) {
      const m = metrics.find((x) => x.id === lineageMetricFilter)
      if (m) filtered = filtered.filter((r) => m.connectedSheets.includes(r.sheet))
    }
    return filtered
  }, [selectedRows, lineageFilter, lineageMetricFilter, metrics])

  // When a metric filter is active, only inject that metric's node so the graph
  // stays focused on the selected metric's lineage.
  const lineageMetrics = useMemo(
    () => (lineageMetricFilter ? metrics.filter((m) => m.id === lineageMetricFilter) : metrics),
    [metrics, lineageMetricFilter],
  )

  const warningCount =
    workbook?.sheets.reduce(
      (count, sheet) => count + sheet.warnings.length + sheet.errors.length,
      0,
    ) ?? 0

  const handleFiles = async (files: File[]) => {
    const excelFiles = files.filter((file) => /\.xlsx?$/i.test(file.name))
    const rejected = files.length - excelFiles.length
    setIsLoading(true)
    setError('')
    const { added, errors } = await addWorkbooks(excelFiles)
    if (rejected > 0) {
      errors.push(
        `${rejected} file${rejected === 1 ? '' : 's'} skipped — only .xlsx and .xls are supported.`,
      )
    }
    setIsLoading(false)
    const errorText = errors.join(' ')
    if (added > 0) {
      setError('')
      setActiveView('preview')
      if (errorText) flashNotice(`Some files were skipped: ${errorText}`, 'error')
      else flashNotice(added === 1 ? 'Workbook added.' : `${added} workbooks added.`)
    } else {
      setError(errorText || 'No valid workbooks were found in your selection.')
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleSaveProject = () => {
    downloadProjectFile(project, workbookState)
    flashNotice('Project saved as a .polan.json download.')
  }

  const handleOpenProject = async (file: File) => {
    setError('')
    try {
      const { project: nextProject, workbooks: nextWorkbooks } =
        parseProjectFile(await file.text())
      replaceProject(nextProject)
      replaceWorkbooks(nextWorkbooks)
      setSelectedSheet('all')
      setLineageFilter(null)
      setActiveView(nextWorkbooks.workbooks.length ? 'preview' : 'upload')
      flashNotice(`Project "${nextProject.name}" restored.`)
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'The project file could not be read.',
      )
      setActiveView('upload')
    }
  }

  const deleteCandidate = workbooks.find((wb) => wb.id === deleteCandidateId)
  const confirmDeleteWorkbook = () => {
    if (!deleteCandidateId) return
    const wasLast = workbooks.length === 1
    deleteWorkbook(deleteCandidateId)
    setDeleteCandidateId(null)
    if (wasLast) setActiveView('upload')
    flashNotice('Workbook deleted.')
  }

  const noticeTimer = useRef<number | undefined>(undefined)
  const flashNotice = (
    message: string,
    tone: 'success' | 'error' = 'success',
  ) => {
    setNotice({ message, tone })
    window.clearTimeout(noticeTimer.current)
    noticeTimer.current = window.setTimeout(() => setNotice(null), 4200)
  }

  const openCreateMetric = (viewId: string) =>
    setModal({ open: true, viewId, editing: null })
  const openEditMetric = (metric: MetricRecord) =>
    setModal({ open: true, viewId: null, editing: metric })

  const handleMetricSubmit = (values: MetricFormValues) => {
    if (modal.editing) {
      updateMetric(modal.editing.id, values)
    } else if (modal.viewId) {
      addMetric(modal.viewId, values)
      setActiveView('metric')
    }
    setModal({ open: false, viewId: null, editing: null })
  }

  const handleSelectMetric = (metricId: string) => {
    selectMetric(metricId)
    setActiveView('metric')
  }

  const handleDeleteMetric = (metricId: string) => {
    deleteMetric(metricId)
    if (activeView === 'metric' && project.selectedMetricId === metricId) {
      setActiveView(workbook ? 'lineage' : 'upload')
    }
  }

  const warningBanner = warningCount > 0 && (
    <div className="warning-banner">
      <AlertTriangle size={16} />
      <span>
        <strong>
          {warningCount} data quality note{warningCount === 1 ? '' : 's'}
        </strong>
        Some rows have incomplete qualified names or validation issues.
      </span>
    </div>
  )

  const renderWorkspace = () => {
    // ── Metric workspace ────────────────────────────────────────────────────
    if (activeView === 'metric') {
      if (!activeMetric) {
        return (
          <div className="page-content workspace-page">
            <div className="metric-missing">
              <Sigma size={24} />
              <strong>No metric selected</strong>
              <span>
                Pick a metric in the Project Explorer, or create one with the +
                button on a view.
              </span>
            </div>
          </div>
        )
      }
      return (
        <div className="page-content workspace-page">
          <div className="page-heading workspace-heading">
            <div>
              <span className="eyebrow">Metric workspace</span>
              <h1>{activeMetric.name}</h1>
              <p>
                Connect this metric to Power BI tables to place it inside the
                lineage and enrich the processed data output.
              </p>
            </div>
          </div>
          <MetricWorkspace
            metric={activeMetric}
            onDelete={() => handleDeleteMetric(activeMetric.id)}
            onDisconnectMissing={(sheet) =>
              setConnectedSheets(
                activeMetric.id,
                activeMetric.connectedSheets.filter((name) => name !== sheet),
              )
            }
            onEdit={() => openEditMetric(activeMetric)}
            onGoToUpload={() => setActiveView('upload')}
            onOpenLineage={() => setActiveView('lineage')}
            onToggleSheet={(sheet) =>
              toggleConnectedSheet(activeMetric.id, sheet)
            }
            sheets={workbook?.sheets ?? []}
          />
        </div>
      )
    }

    // ── Upload / no workbook ─────────────────────────────────────────────────
    if (activeView === 'upload' || !workbook) {
      return (
        <UploadWorkspace
          error={error}
          isLoading={isLoading}
          onContinue={() => setActiveView('lineage')}
          onFiles={handleFiles}
          workbook={workbook}
        />
      )
    }

    // ── Dashboard ────────────────────────────────────────────────────────────
    if (activeView === 'preview') {
      return (
        <DashboardPage
          activeWorkbookId={activeWorkbookId}
          metrics={metrics}
          onSelectWorkbook={selectWorkbook}
          onSheetChange={setSelectedSheet}
          rows={selectedRows}
          selectedSheet={selectedSheet}
          sheets={validSheets}
          workbooks={workbooks}
        />
      )
    }

    // ── Lineage graph ─────────────────────────────────────────────────────────
    if (activeView === 'lineage') {
      return (
        <div className="page-content workspace-page lineage-view">
          <div className="page-heading workspace-heading">
            <div>
              <span className="eyebrow">Relationship explorer</span>
              <h1>Lineage graph</h1>
              <p>
                Trace every dependency from raw source tables to
                business-facing reports.
              </p>
            </div>
            <div className="lineage-controls">
              <div className="sheet-switcher">
                <span>Viewing</span>
                <select
                  onChange={(e) => setSelectedSheet(e.target.value)}
                  value={selectedSheet}
                >
                  <option value="all">All workbook sheets</option>
                  {validSheets.map((sheet) => (
                    <option key={sheet.name} value={sheet.name}>
                      {sheet.name}
                    </option>
                  ))}
                </select>
              </div>
              {metrics.length > 0 && (
                <div className="lineage-metric-filter">
                  <select
                    aria-label="Filter by metric"
                    onChange={(e) => setLineageMetricFilter(e.target.value || null)}
                    value={lineageMetricFilter ?? ''}
                  >
                    <option value="">All metrics</option>
                    {metrics.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="lineage-filters">
                {LINEAGE_FILTER_OPTS.map(({ key, label, cls }) => (
                  <button
                    className={`filter-chip ${
                      lineageFilter === key ? `active active-${cls}` : ''
                    }`}
                    key={key}
                    onClick={() =>
                      setLineageFilter((f) => (f === key ? null : key))
                    }
                    type="button"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {warningBanner}
          <Suspense
            fallback={
              <div className="graph-loading">
                <GitBranch size={20} />
                Building lineage canvas...
              </div>
            }
          >
            <LineageGraph metrics={lineageMetrics} rows={lineageRows} />
          </Suspense>
        </div>
      )
    }

    // ── Processed data ────────────────────────────────────────────────────────
    return (
      <div className="page-content workspace-page">
        <div className="page-heading workspace-heading">
          <div>
            <span className="eyebrow">Governed output</span>
            <h1>Processed data</h1>
            <p>
              Search, filter, and export your enriched lineage inventory.
              Upstream rows only.
            </p>
          </div>
          <div className="sheet-switcher">
            <span>Viewing</span>
            <select
              onChange={(e) => setSelectedSheet(e.target.value)}
              value={selectedSheet}
            >
              <option value="all">All workbook sheets</option>
              {validSheets.map((sheet) => (
                <option key={sheet.name} value={sheet.name}>
                  {sheet.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        {warningBanner}
        <div className="enrichment-note">
          <CheckCircle2 size={17} />
          <span>
            <strong>Enrichment complete</strong>
            Project, dataset, table, MDR availability, and layer fields were
            generated from Qualified Name.
            {metrics.length > 0 &&
              ` Showing processed lineage for ${metrics.length} metric${metrics.length === 1 ? '' : 's'}.`}
          </span>
          <ArrowDownToLine size={18} />
        </div>
        <DataTable
          directionFilter="upstream"
          includeDerived
          metricEntries={metricEntries}
          onSheetChange={setSelectedSheet}
          selectedSheet={selectedSheet}
          sheets={workbook.sheets}
        />
      </div>
    )
  }

  return (
    <div
      className="app-shell"
      style={{ '--sidebar-w': `${sidebarWidth}px` } as React.CSSProperties}
    >
      <Sidebar
        activeMetricId={project.selectedMetricId}
        activeView={activeView}
        activeWorkbookId={activeWorkbookId}
        hasWorkbook={Boolean(workbook)}
        onAddView={addView}
        onChange={setActiveView}
        onCreateMetric={openCreateMetric}
        onDeleteMetric={handleDeleteMetric}
        onDeleteView={deleteView}
        onRenameMetric={(metricId, name) => updateMetric(metricId, { name })}
        onRenameProject={renameProject}
        onRenameView={renameView}
        onRenameWorkbook={renameWorkbook}
        onRequestDeleteWorkbook={setDeleteCandidateId}
        onSelectMetric={handleSelectMetric}
        onSelectWorkbook={selectWorkbook}
        onToggleView={toggleView}
        onUploadWorkbook={() => fileInputRef.current?.click()}
        onWidthChange={handleSidebarWidthChange}
        project={project}
        width={sidebarWidth}
        workbooks={workbooks}
      />
      <div className="main-column">
        <Topbar
          onOpenProject={handleOpenProject}
          onSaveProject={handleSaveProject}
          onUploadClick={() => fileInputRef.current?.click()}
          workbook={workbook}
        />
        <input
          accept=".xlsx,.xls"
          className="hidden-input"
          multiple
          onChange={(event) => {
            const files = Array.from(event.target.files ?? [])
            if (files.length) handleFiles(files)
          }}
          ref={fileInputRef}
          type="file"
        />
        <main>
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="view-motion"
            initial={{ opacity: 0, y: 6 }}
            key={
              activeView === 'metric'
                ? `metric-${activeMetric?.id}`
                : activeView
            }
            transition={{ duration: 0.18 }}
          >
            {renderWorkspace()}
          </motion.div>
        </main>
      </div>

      <MetricModal
        metric={modal.editing}
        onClose={() => setModal({ open: false, viewId: null, editing: null })}
        onSubmit={handleMetricSubmit}
        open={modal.open}
      />

      <ConfirmDialog
        confirmLabel="Delete workbook"
        message={
          deleteCandidate
            ? `"${deleteCandidate.displayName}" and its parsed data will be removed. This cannot be undone.`
            : ''
        }
        onCancel={() => setDeleteCandidateId(null)}
        onConfirm={confirmDeleteWorkbook}
        open={Boolean(deleteCandidate)}
        title="Delete workbook?"
      />

      <AnimatePresence>
        {notice && (
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className={`toast ${notice.tone === 'error' ? 'toast-error' : ''}`}
            exit={{ opacity: 0, y: 8 }}
            initial={{ opacity: 0, y: 8 }}
          >
            {notice.tone === 'error' ? (
              <AlertTriangle size={15} />
            ) : (
              <CheckCircle2 size={15} />
            )}
            {notice.message}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default App
