import { AnimatePresence, motion } from 'framer-motion'
import {
  AlertTriangle,
  ArrowDownToLine,
  CheckCircle2,
  Database,
  FileSpreadsheet,
  GitBranch,
  Layers3,
} from 'lucide-react'
import { lazy, Suspense, useRef, useState } from 'react'
import './index.css'
import { DataTable } from './components/DataTable'
import { Sidebar } from './components/Sidebar'
import { Topbar } from './components/Topbar'
import { UploadWorkspace } from './components/UploadWorkspace'
import type { AppView, WorkbookData } from './types'
import { buildLineage } from './utils/lineage'
import { parseWorkbookFile } from './utils/workbook'

const LineageGraph = lazy(() =>
  import('./components/LineageGraph').then((module) => ({
    default: module.LineageGraph,
  })),
)

const pageCopy: Record<
  Exclude<AppView, 'upload'>,
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

function App() {
  const [workbook, setWorkbook] = useState<WorkbookData | null>(null)
  const [activeView, setActiveView] = useState<AppView>('upload')
  const [selectedSheet, setSelectedSheet] = useState('all')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const validSheets =
    workbook?.sheets.filter((sheet) => !sheet.errors.length) ?? []
  const allRows = validSheets.flatMap((sheet) => sheet.rows)
  const selectedRows =
    selectedSheet === 'all'
      ? allRows
      : validSheets
          .filter((sheet) => sheet.name === selectedSheet)
          .flatMap((sheet) => sheet.rows)
  const graph = buildLineage(allRows)
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

  const handleFile = async (file: File) => {
    setIsLoading(true)
    setError('')
    try {
      if (file.size > 25 * 1024 * 1024) {
        throw new Error('The workbook is larger than the 25 MB upload limit.')
      }
      const nextWorkbook = await parseWorkbookFile(file)
      setWorkbook(nextWorkbook)
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

  const renderWorkspace = () => {
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
            <span className="metric-icon coral"><FileSpreadsheet size={17} /></span>
            <div><span>Workbook sheets</span><strong>{workbook.sheets.length}</strong></div>
            <small>{allRows.length} processed rows</small>
          </div>
        </div>

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
            <LineageGraph rows={selectedRows} />
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
              </span>
              <ArrowDownToLine size={18} />
            </div>
            <DataTable
              includeDerived
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
        activeView={activeView}
        hasWorkbook={Boolean(workbook)}
        onChange={setActiveView}
      />
      <div className="main-column">
        <Topbar
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
          <AnimatePresence mode="wait">
            <motion.div
              animate={{ opacity: 1, y: 0 }}
              className="view-motion"
              exit={{ opacity: 0, y: -4 }}
              initial={{ opacity: 0, y: 6 }}
              key={activeView}
              transition={{ duration: 0.18 }}
            >
              {renderWorkspace()}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  )
}

export default App
