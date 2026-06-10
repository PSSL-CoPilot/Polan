import { Bell, ChevronDown, FileSpreadsheet, Plus, Search } from 'lucide-react'
import type { WorkbookData } from '../types'

interface TopbarProps {
  workbook: WorkbookData | null
  onUploadClick: () => void
}

export function Topbar({ workbook, onUploadClick }: TopbarProps) {
  return (
    <header className="topbar">
      <div className="global-search">
        <Search size={17} />
        <input
          aria-label="Search assets"
          disabled={!workbook}
          placeholder="Search assets, datasets, reports..."
        />
        <kbd>⌘ K</kbd>
      </div>
      <div className="topbar-actions">
        <div className="file-context" title={workbook?.name ?? 'No workbook loaded'}>
          <FileSpreadsheet size={17} />
          <span>{workbook?.name ?? 'No workbook loaded'}</span>
          <ChevronDown size={14} />
        </div>
        <button className="icon-button" type="button" aria-label="Notifications">
          <Bell size={18} />
          <i />
        </button>
        <button className="primary-button compact" type="button" onClick={onUploadClick}>
          <Plus size={16} />
          {workbook ? 'New workbook' : 'Upload workbook'}
        </button>
        <div className="avatar" title="Data platform workspace">
          DP
        </div>
      </div>
    </header>
  )
}
