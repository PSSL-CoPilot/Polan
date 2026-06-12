import {
  ArrowUpDown,
  BarChart3,
  ChevronDown,
  Database,
  GitBranch,
  Plus,
  TableProperties,
} from 'lucide-react'
import { useCallback, useState } from 'react'
import type { AppView, ProjectState, UploadedWorkbook } from '../types'
import { ProjectExplorer } from './ProjectExplorer'
import { WorkbookList } from './WorkbookList'

interface SidebarProps {
  activeView: AppView
  hasWorkbook: boolean
  onChange: (view: AppView) => void
  project: ProjectState
  activeMetricId: string | null
  workbooks: UploadedWorkbook[]
  activeWorkbookId: string | null
  onSelectWorkbook: (id: string) => void
  onRenameWorkbook: (id: string, name: string) => void
  onRequestDeleteWorkbook: (id: string) => void
  onUploadWorkbook: () => void
  onRenameProject: (name: string) => void
  onAddView: () => void
  onRenameView: (viewId: string, name: string) => void
  onDeleteView: (viewId: string) => void
  onToggleView: (viewId: string) => void
  onSelectMetric: (metricId: string) => void
  onRenameMetric: (metricId: string, name: string) => void
  onDeleteMetric: (metricId: string) => void
  onCreateMetric: (viewId: string) => void
  /** Current sidebar width in px. */
  width: number
  /** Called while the user drags the resize handle. */
  onWidthChange: (w: number) => void
}

const NAV_ITEMS: Array<{
  id: AppView
  label: string
  description: string
  icon: typeof BarChart3
}> = [
  { id: 'preview', label: 'Dashboard', description: 'KPI overview', icon: BarChart3 },
  { id: 'lineage', label: 'Lineage graph', description: 'Asset relationships', icon: GitBranch },
  { id: 'processed', label: 'Processed data', description: 'Enriched output', icon: Database },
  { id: 'metric', label: 'Metric workspace', description: 'Metric definitions', icon: TableProperties },
]

/** Thin chevron button used for collapsing/expanding each pane. */
function PaneHeader({
  title,
  open,
  onToggle,
  action,
}: {
  title: string
  open: boolean
  onToggle: () => void
  action?: { label: string; icon: React.ReactNode; onClick: () => void }
}) {
  return (
    <div className="pane-header" onClick={onToggle} role="button" tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onToggle() }}
    >
      <ChevronDown
        className={`pane-chevron${open ? '' : ' pane-collapsed'}`}
        size={12}
      />
      <span className="pane-title">{title}</span>
      {action && (
        <button
          aria-label={action.label}
          className="pane-action-btn"
          onClick={(e) => { e.stopPropagation(); action.onClick() }}
          title={action.label}
          type="button"
        >
          {action.icon}
        </button>
      )}
    </div>
  )
}

export function Sidebar({
  activeView,
  hasWorkbook,
  onChange,
  project,
  activeMetricId,
  workbooks,
  activeWorkbookId,
  onSelectWorkbook,
  onRenameWorkbook,
  onRequestDeleteWorkbook,
  onUploadWorkbook,
  onRenameProject,
  onAddView,
  onRenameView,
  onDeleteView,
  onToggleView,
  onSelectMetric,
  onRenameMetric,
  onDeleteMetric,
  onCreateMetric,
  width,
  onWidthChange,
}: SidebarProps) {
  const [navOpen, setNavOpen] = useState(true)
  const [workbooksOpen, setWorkbooksOpen] = useState(true)
  const [explorerOpen, setExplorerOpen] = useState(true)

  const handleResizeMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      const startX = e.clientX
      const startW = width

      const onMove = (ev: MouseEvent) => {
        const next = Math.max(200, Math.min(480, startW + ev.clientX - startX))
        onWidthChange(next)
      }
      const onUp = () => {
        document.removeEventListener('mousemove', onMove)
        document.removeEventListener('mouseup', onUp)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }

      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
      document.addEventListener('mousemove', onMove)
      document.addEventListener('mouseup', onUp)
    },
    [width, onWidthChange],
  )

  return (
    <aside className="sidebar" style={{ width }}>
      {/* ── Brand ── */}
      <div className="sidebar-brand">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">
            <ArrowUpDown size={18} strokeWidth={2.4} />
          </div>
          <div>
            <strong>Polan</strong>
            <span className="brand-byline">by Polestar Analytics</span>
          </div>
        </div>
      </div>

      {/* ── Navigation pane ── */}
      <div className="sidebar-pane">
        <PaneHeader
          onToggle={() => setNavOpen((v) => !v)}
          open={navOpen}
          title="Workspace"
        />
        {navOpen && (
          <div className="pane-body">
            <nav className="sidebar-nav" aria-label="Workspace navigation">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon
                const disabled = !hasWorkbook
                return (
                  <button
                    className={`nav-item ${activeView === item.id ? 'active' : ''}`}
                    disabled={disabled}
                    key={item.id}
                    onClick={() => onChange(item.id)}
                    type="button"
                  >
                    <Icon size={19} />
                    <span>
                      <strong>{item.label}</strong>
                      <small>{item.description}</small>
                    </span>
                  </button>
                )
              })}
            </nav>
          </div>
        )}
      </div>

      {/* ── Workbooks pane ── */}
      <div className="sidebar-pane">
        <PaneHeader
          action={{ label: 'Upload workbook', icon: <Plus size={12} />, onClick: onUploadWorkbook }}
          onToggle={() => setWorkbooksOpen((v) => !v)}
          open={workbooksOpen}
          title="Workbooks"
        />
        {workbooksOpen && (
          <div className="pane-body">
            <WorkbookList
              activeWorkbookId={activeWorkbookId}
              onRename={onRenameWorkbook}
              onRequestDelete={onRequestDeleteWorkbook}
              onSelect={onSelectWorkbook}
              onUpload={onUploadWorkbook}
              workbooks={workbooks}
            />
          </div>
        )}
      </div>

      {/* ── Project Explorer pane ── */}
      <div className="sidebar-pane pane-explorer">
        <PaneHeader
          action={{ label: 'Add view', icon: <Plus size={12} />, onClick: onAddView }}
          onToggle={() => setExplorerOpen((v) => !v)}
          open={explorerOpen}
          title="Project Explorer"
        />
        {explorerOpen && (
          <div className="pane-body pane-body-grow">
            <ProjectExplorer
              activeMetricId={activeView === 'metric' ? activeMetricId : null}
              onAddView={onAddView}
              onCreateMetric={onCreateMetric}
              onDeleteMetric={onDeleteMetric}
              onDeleteView={onDeleteView}
              onRenameMetric={onRenameMetric}
              onRenameProject={onRenameProject}
              onRenameView={onRenameView}
              onSelectMetric={onSelectMetric}
              onToggleView={onToggleView}
              project={project}
            />
          </div>
        )}
      </div>

      {/* ── Resize handle ── */}
      <div
        aria-hidden="true"
        className="sidebar-resize-handle"
        onMouseDown={handleResizeMouseDown}
      />
    </aside>
  )
}
