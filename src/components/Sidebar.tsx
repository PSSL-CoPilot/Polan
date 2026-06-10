import {
  ArrowUpDown,
  Database,
  FileSpreadsheet,
  GitBranch,
  PanelLeftClose,
  Sparkles,
  TableProperties,
} from 'lucide-react'
import type { AppView } from '../types'

interface SidebarProps {
  activeView: AppView
  hasWorkbook: boolean
  onChange: (view: AppView) => void
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

export function Sidebar({ activeView, hasWorkbook, onChange }: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark" aria-hidden="true">
          <ArrowUpDown size={18} strokeWidth={2.4} />
        </div>
        <div>
          <strong>:Polan</strong>
          <span>Lineage Studio</span>
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

      <div className="sidebar-spacer" />
      <div className="sidebar-callout">
        <Sparkles size={17} />
        <strong>Smart enrichment</strong>
        <p>Projects, layers, and MDR coverage are derived automatically.</p>
      </div>
      <button className="collapse-button" type="button" aria-label="Collapse menu">
        <PanelLeftClose size={17} />
        Collapse menu
      </button>
    </aside>
  )
}
