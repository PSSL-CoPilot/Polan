import {
  ArrowUpDown,
  BarChart3,
  ChevronDown,
  Database,
  GitBranch,
  Plus,
  TableProperties,
} from 'lucide-react'
import {
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react'
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
  selectedSheet: string
  onSelectWorkbook: (id: string) => void
  onSelectSheet: (workbookId: string, sheetName: string) => void
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

const readPaneState = (key: string, fallback: boolean) => {
  const stored = localStorage.getItem(key)
  return stored === null ? fallback : stored === 'true'
}

function PaneHeader({
  title,
  open,
  onToggle,
  action,
}: {
  title: string
  open: boolean
  onToggle: () => void
  action?: { label: string; icon: ReactNode; onClick: () => void }
}) {
  return (
    <div
      className="pane-header"
      onClick={onToggle}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onToggle()
        }
      }}
      role="button"
      tabIndex={0}
      title={open ? `Collapse ${title}` : `Expand ${title}`}
    >
      <ChevronDown
        className={`pane-chevron${open ? '' : ' pane-collapsed'}`}
        size={13}
      />
      <span className="pane-title">{title}</span>
      {action && open && (
        <button
          aria-label={action.label}
          className="pane-action-btn"
          onClick={(event) => {
            event.stopPropagation()
            action.onClick()
          }}
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
  selectedSheet,
  onSelectWorkbook,
  onSelectSheet,
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
}: SidebarProps) {
  const [navOpen, setNavOpen] = useState(() =>
    readPaneState('polan-pane-main', true),
  )
  const [workbooksOpen, setWorkbooksOpen] = useState(() =>
    readPaneState('polan-pane-workbooks', true),
  )
  const [explorerOpen, setExplorerOpen] = useState(() =>
    readPaneState('polan-pane-explorer', true),
  )

  const togglePane = (
    key: string,
    setOpen: Dispatch<SetStateAction<boolean>>,
  ) => {
    setOpen((current) => {
      const next = !current
      localStorage.setItem(key, String(next))
      window.setTimeout(() => window.dispatchEvent(new Event('resize')), 220)
      return next
    })
  }

  return (
    <aside className="workspace-panes" aria-label="Workspace panels">
      <section
        className={`workspace-pane workspace-main-pane ${
          navOpen ? 'is-open' : 'is-collapsed'
        }`}
      >
        <div className="sidebar-brand">
          <div className="brand">
            <div className="brand-mark" aria-hidden="true">
              <ArrowUpDown size={18} strokeWidth={2.4} />
            </div>
            <div className="brand-copy">
              <strong>Polan</strong>
              <span className="brand-byline">by Polestar Analytics</span>
            </div>
          </div>
        </div>
        <PaneHeader
          onToggle={() => togglePane('polan-pane-main', setNavOpen)}
          open={navOpen}
          title="Main workspace"
        />
        <div className="pane-body workspace-nav-body">
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
                  title={!navOpen ? item.label : undefined}
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
      </section>

      <section
        className={`workspace-pane workbooks-pane ${
          workbooksOpen ? 'is-open' : 'is-collapsed'
        }`}
      >
        <PaneHeader
          action={{
            label: 'Upload workbook',
            icon: <Plus size={12} />,
            onClick: onUploadWorkbook,
          }}
          onToggle={() =>
            togglePane('polan-pane-workbooks', setWorkbooksOpen)
          }
          open={workbooksOpen}
          title="Workbooks"
        />
        {workbooksOpen && (
          <div className="pane-body pane-body-grow">
            <WorkbookList
              activeWorkbookId={activeWorkbookId}
              onRename={onRenameWorkbook}
              onRequestDelete={onRequestDeleteWorkbook}
              onSelect={onSelectWorkbook}
              onSelectSheet={onSelectSheet}
              onUpload={onUploadWorkbook}
              selectedSheet={selectedSheet}
              workbooks={workbooks}
            />
          </div>
        )}
      </section>

      <section
        className={`workspace-pane explorer-pane ${
          explorerOpen ? 'is-open' : 'is-collapsed'
        }`}
      >
        <PaneHeader
          action={{
            label: 'Add view',
            icon: <Plus size={12} />,
            onClick: onAddView,
          }}
          onToggle={() =>
            togglePane('polan-pane-explorer', setExplorerOpen)
          }
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
      </section>
    </aside>
  )
}
