import {
  FileSpreadsheet,
  FolderOpen,
  Plus,
  RefreshCw,
  Save,
} from 'lucide-react'
import { memo, useRef, useState } from 'react'
import logoUrl from '../assets/polestarlogo.png'
import type { WorkbookData } from '../types'

interface TopbarProps {
  workbook: WorkbookData | null
  onUploadClick: () => void
  onSaveProject: () => void
  onOpenProject: (file: File) => void
  onRefreshWorkbook: () => void
  isRefreshing: boolean
}

export const Topbar = memo(function Topbar({
  workbook,
  onUploadClick,
  onSaveProject,
  onOpenProject,
  onRefreshWorkbook,
  isRefreshing,
}: TopbarProps) {
  const projectInputRef = useRef<HTMLInputElement>(null)
  // Hide the logo gracefully if the asset ever fails to resolve.
  const [logoOk, setLogoOk] = useState(true)

  return (
    <header className="topbar">
      <div className="topbar-brand">
        {logoOk ? (
          <img
            alt="Polestar Analytics"
            className="topbar-logo"
            onError={() => setLogoOk(false)}
            src={logoUrl}
          />
        ) : (
          <span className="topbar-brand-fallback">Polestar Analytics</span>
        )}
      </div>
      <div className="topbar-actions">
        <div
          className="file-context"
          title={workbook?.name ?? 'No workbook loaded'}
        >
          <FileSpreadsheet size={17} />
          <span>{workbook?.name ?? 'No workbook loaded'}</span>
          {workbook && (
            <button
              aria-label="Refresh workbook data"
              className={`file-refresh ${isRefreshing ? 'is-busy' : ''}`}
              disabled={isRefreshing}
              onClick={onRefreshWorkbook}
              title="Re-parse the active workbook"
              type="button"
            >
              <RefreshCw size={14} />
            </button>
          )}
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
})
