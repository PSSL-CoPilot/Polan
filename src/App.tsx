import { AnimatePresence, motion } from 'framer-motion'
import {
  AlertTriangle,
  ArrowDownToLine,
  CheckCircle2,
  Database,
  GitBranch,
  Layers3,
  Sigma,
} from 'lucide-react'
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import './index.css'
import './workspace.css'
import { DataTable } from './components/DataTable'
import { MetricModal, type MetricFormValues } from './components/MetricModal'
import { MetricWorkspace } from './components/MetricWorkspace'
import { Sidebar } from './components/Sidebar'
import { Topbar } from './components/Topbar'
import { UploadWorkspace } from './components/UploadWorkspace'
import { allMetrics, findMetric, useProject } from './hooks/useProject'
import type { AppView, MetricRecord, WorkbookData } from './types'
import { buildLineage } from './utils/lineage'
import { buildMetricTableContext } from './utils/metricData'
import {
  downloadProjectFile,
  loadWorkbookFromIdb,
  parseProjectFile,
  saveWorkbookToIdb,
} from './utils/storage'
import { parseWorkbookFile } from './utils/workbook'

const LineageGraph = lazy(() =>
  import('./components/LineageGraph').then((module) => ({
    default: module.LineageGraph,
  })),
)

const pageCopy: Record<
  Exclude<AppView, 'upload' | 'metric'>,
  { eyebrow: string; title: string; description: string }
> = {
  preview: {
    eyebrow: 'Source inspection',
    title: 'Data preview',
    description:
      'Review the source records exactly as they appear in the workbook.',
  },
  lineage: {
    eyebrow: 'Relationship explorer',
    title: 'Lineage graph',
    description:
      'Trace every dependency from raw source tables to business-facing reports.',
  },
  processed: {
    eyebrow: 'Governed output',
    title: 'Processed data',
    description:
      'Search, filter, and export your enriched lineage inventory.',
  },
}

interface MetricModalState {
  open: boolean
  viewId: string | null
  editing: MetricRecord | null
}

function App() {
  const [workbook, setWorkbook] = useState<WorkbookData | null>(null)
  const [activeView, setActiveView] = useState<AppView>('upload')
  const [selectedSheet, setSelectedSheet] = useState('all')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [modal, setModal] = useState<MetricModalState>({
    open: false,
    viewId: null,
    editing: null,
  })
  const fileInputRef = useRef<HTMLInputElement>(null)
  const restoredRef = useRef(false)

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

  // Restore the last parsed workbook from IndexedDB so a reload keeps the
  // whole workspace alive. Project metadata restores from localStorage
  // synchronously inside useProject.
  useEffect(() => {
    if (restoredRef.current) return
    restoredRef.current = true
    loadWorkbookFromIdb().then((stored) => {
      if (stored) {
        setWorkbook((current) => current ?? stored)
      }
    })
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

  const metricContext = useMemo(
    () => buildMetricTableContext(activeMetric, allRows, graph.assets),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeMetric, workbook, graph],
  )

  const warningCount =
    workbook?.sheets.reduce(
      (count, sheet) => count + sheet.warnings.length + sheet.errors.length,
      0,
    ) ?? 0
  const mdrCoverage = allRows.length
    ? Math.round(
        (allRows.filter((row) => row.mdrAvailability).length / allRows.length) *
          100,
      )
    : 0

  const applyWorkbook = (next: WorkbookData | null) => {
    setWorkbook(next)
    void saveWorkbookToIdb(next)
  }

  const handleFile = async (file: File) => {
    setIsLoading(true)
    setError('')
    try {
      if (file.size > 25 * 1024 * 1024) {
        throw new Error('The workbook is larger than the 25 MB upload limit.')
      }
      const nextWorkbook = await parseWorkbookFile(file)
      applyWorkbook(nextWorkbook)
      setSelectedSheet('all')
      setActiveView('preview')
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'The workbook could not be read.',
      )
    } finally {
      setIsLoading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleSaveProject = () => {
    downloadProjectFile(project, workbook)
    flashNotice('Project saved as a .polan.json download.')
  }

  const handleOpenProject = async (file: File) => {
    setError('')
    try {
      const { project: nextProject, workbook: nextWorkbook } =
        parseProjectFile(await file.text())
      replaceProject(nextProject)
      if (nextWorkbook) {
        applyWorkbook(nextWorkbook)
        setSelectedSheet('all')
      }
      setActiveView(nextWorkbook ? 'preview' : 'upload')
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

  const noticeTimer = useRef<number | undefined>(undefined)
  const flashNotice = (message: string) => {
    setNotice(message)
    window.clearTimeout(noticeTimer.current)
    noticeTimer.current = window.setTimeout(() => setNotice(''), 3200)
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

  const renderMetricsBar = () => (
    <div className="metrics-grid">
      <div className="metric-card">
        <span className="metric-icon violet"><Database size={17} /></span>
        <div><span>Total assets</span><strong>{graph.nodes.length}</strong></div>
        <small>Unique across sheets</small>
      </div>
      <div className="metric-card">
        <span className="metric-icon teal"><GitBranch size={17} /></span>
        <div><span>Relationships</span><strong>{graph.edges.length}</strong></div>
        <small>Validated connections</small>
      </div>
      <div className="metric-card">
        <span className="metric-icon amber"><Layers3 size={17} /></span>
        <div><span>MDR coverage</span><strong>{mdrCoverage}%</strong></div>
        <small>Governed datasets</small>
      </div>
      <div className="metric-card">
        <span className="metric-icon pink"><Sigma size={17} /></span>
        <div><span>Metrics</span><strong>{metrics.length}</strong></div>
        <small>
          {metrics.filter((metric) => metric.connectedSheets.length).length}{' '}
          connected to lineage
        </small>
      </div>
    </div>
  )

  const renderWorkspace = () => {
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

    if (activeView === 'upload' || !workbook) {
      return (
        <UploadWorkspace
          error={error}
          isLoading={isLoading}
          onContinue={() => setActiveView('lineage')}
          onFile={handleFile}
          workbook={workbook}
        />
      )
    }

    const copy = pageCopy[activeView]
    return (
      <div className="page-content workspace-page">
        <div className="page-heading workspace-heading">
          <div>
            <span className="eyebrow">{copy.eyebrow}</span>
            <h1>{copy.title}</h1>
            <p>{copy.description}</p>
          </div>
          <div className="sheet-switcher">
            <span>Viewing</span>
            <select
              onChange={(event) => setSelectedSheet(event.target.value)}
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

        {renderMetricsBar()}

        {warningCount > 0 && (
          <div className="warning-banner">
            <AlertTriangle size={16} />
            <span>
              <strong>{warningCount} data quality note{warningCount === 1 ? '' : 's'}</strong>
              Some rows have incomplete qualified names or validation issues.
            </span>
          </div>
        )}

        {activeView === 'lineage' && (
          <Suspense
            fallback={
              <div className="graph-loading">
                <GitBranch size={20} />
                Building lineage canvas...
              </div>
            }
          >
            <LineageGraph metrics={metrics} rows={selectedRows} />
          </Suspense>
        )}
        {activeView === 'preview' && (
          <DataTable
            includeDerived={false}
            onSheetChange={setSelectedSheet}
            selectedSheet={selectedSheet}
            sheets={workbook.sheets}
          />
        )}
        {activeView === 'processed' && (
          <>
            <div className="enrichment-note">
              <CheckCircle2 size={17} />
              <span>
                <strong>Enrichment complete</strong>
                Project, dataset, table, MDR availability, and layer fields were
                generated from Qualified Name.
                {metricContext &&
                  ` Showing "${metricContext.metric.name}" metric columns for connected tables.`}
              </span>
              <ArrowDownToLine size={18} />
            </div>
            <DataTable
              includeDerived
              metricContext={metricContext}
              onSheetChange={setSelectedSheet}
              selectedSheet={selectedSheet}
              sheets={workbook.sheets}
            />
          </>
        )}
      </div>
    )
  }

  return (
    <div className="app-shell">
      <Sidebar
        activeMetricId={project.selectedMetricId}
        activeView={activeView}
        hasWorkbook={Boolean(workbook)}
        onAddView={addView}
        onChange={setActiveView}
        onCreateMetric={openCreateMetric}
        onDeleteMetric={handleDeleteMetric}
        onDeleteView={deleteView}
        onRenameMetric={(metricId, name) => updateMetric(metricId, { name })}
        onRenameProject={renameProject}
        onRenameView={renameView}
        onSelectMetric={handleSelectMetric}
        onToggleView={toggleView}
        project={project}
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
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) handleFile(file)
          }}
          ref={fileInputRef}
          type="file"
        />
        <main>
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="view-motion"
            initial={{ opacity: 0, y: 6 }}
            key={activeView === 'metric' ? `metric-${activeMetric?.id}` : activeView}
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

      <AnimatePresence>
        {notice && (
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="toast"
            exit={{ opacity: 0, y: 8 }}
            initial={{ opacity: 0, y: 8 }}
          >
            <CheckCircle2 size={15} />
            {notice}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default App
