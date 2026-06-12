import {
  ArrowUpDown,
  Database,
  FileSpreadsheet,
  GitBranch,
  TableProperties,
} from 'lucide-react'
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
}

const items: Array<{
  id: AppView
  label: string
  description: string
  icon: typeof FileSpreadsheet
}> = [
  {
    id: 'upload',
    label: 'Upload',
    description: 'Workbook intake',
    icon: FileSpreadsheet,
  },
  {
    id: 'preview',
    label: 'Data preview',
    description: 'Original records',
    icon: TableProperties,
  },
  {
    id: 'lineage',
    label: 'Lineage graph',
    description: 'Asset relationships',
    icon: GitBranch,
  },
  {
    id: 'processed',
    label: 'Processed data',
    description: 'Enriched output',
    icon: Database,
  },
]

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
  ...explorerActions
}: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark" aria-hidden="true">
          <ArrowUpDown size={18} strokeWidth={2.4} />
        </div>
        <div>
          <strong>Polan</strong>
          <span className="brand-byline">by Polestar Analytics</span>
        </div>
      </div>

      <div className="sidebar-label">Workspace</div>
      <nav className="sidebar-nav" aria-label="Workspace navigation">
        {items.map((item) => {
          const Icon = item.icon
          const disabled = item.id !== 'upload' && !hasWorkbook
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

      <WorkbookList
        activeWorkbookId={activeWorkbookId}
        onRename={onRenameWorkbook}
        onRequestDelete={onRequestDeleteWorkbook}
        onSelect={onSelectWorkbook}
        onUpload={onUploadWorkbook}
        workbooks={workbooks}
      />

      <ProjectExplorer
        activeMetricId={activeView === 'metric' ? activeMetricId : null}
        project={project}
        {...explorerActions}
      />
    </aside>
  )
}
