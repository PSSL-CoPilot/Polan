import {
  FileSpreadsheet,
  FolderOpen,
  Plus,
  Save,
  Search,
} from 'lucide-react'
import { useRef } from 'react'
import type { WorkbookData } from '../types'

interface TopbarProps {
  workbook: WorkbookData | null
  onUploadClick: () => void
  onSaveProject: () => void
  onOpenProject: (file: File) => void
}

export function Topbar({
  workbook,
  onUploadClick,
  onSaveProject,
  onOpenProject,
}: TopbarProps) {
  const projectInputRef = useRef<HTMLInputElement>(null)

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
        <div
          className="file-context"
          title={workbook?.name ?? 'No workbook loaded'}
        >
          <FileSpreadsheet size={17} />
          <span>{workbook?.name ?? 'No workbook loaded'}</span>
        </div>
        <input
          accept=".json,.polan.json,application/json"
          className="hidden-input"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) onOpenProject(file)
            event.target.value = ''
          }}
          ref={projectInputRef}
          type="file"
        />
        <button
          className="ghost-button"
          onClick={() => projectInputRef.current?.click()}
          title="Open a saved .polan.json project"
          type="button"
        >
          <FolderOpen size={14} />
          Open Project
        </button>
        <button
          className="ghost-button"
          onClick={onSaveProject}
          title="Download this project as a .polan.json file"
          type="button"
        >
          <Save size={14} />
          Save Project
        </button>
        <button
          className="primary-button compact"
          type="button"
          onClick={onUploadClick}
        >
          <Plus size={16} />
          {workbook ? 'New workbook' : 'Upload workbook'}
        </button>
      </div>
    </header>
  )
}
