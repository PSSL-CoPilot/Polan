import {
  Check,
  ChevronRight,
  FileSpreadsheet,
  Pencil,
  Plus,
  Table2,
  Trash2,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { UploadedWorkbook } from '../types'
import { workbookRowCount } from '../hooks/useWorkbooks'

interface WorkbookListProps {
  workbooks: UploadedWorkbook[]
  activeWorkbookId: string | null
  selectedSheet: string
  onSelect: (id: string) => void
  onSelectSheet: (workbookId: string, sheetName: string) => void
  onRename: (id: string, name: string) => void
  onRequestDelete: (id: string) => void
  onUpload: () => void
}

function RenameField({
  value,
  onCommit,
  onCancel,
}: {
  value: string
  onCommit: (next: string) => void
  onCancel: () => void
}) {
  const [draft, setDraft] = useState(value)
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  const commit = () => {
    if (draft.trim() !== value) onCommit(draft)
    else onCancel()
  }

  return (
    <input
      className="wb-rename"
      onBlur={commit}
      onChange={(event) => setDraft(event.target.value)}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        if (event.key === 'Enter') commit()
        if (event.key === 'Escape') onCancel()
      }}
      ref={inputRef}
      value={draft}
    />
  )
}

const readExpandedWorkbooks = () => {
  try {
    const stored = JSON.parse(
      localStorage.getItem('polan-expanded-workbooks') ?? '[]',
    )
    return new Set<string>(
      Array.isArray(stored)
        ? stored.filter((value): value is string => typeof value === 'string')
        : [],
    )
  } catch {
    return new Set<string>()
  }
}

export function WorkbookList({
  workbooks,
  activeWorkbookId,
  selectedSheet,
  onSelect,
  onSelectSheet,
  onRename,
  onRequestDelete,
  onUpload,
}: WorkbookListProps) {
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [expandedIds, setExpandedIds] = useState(readExpandedWorkbooks)

  const toggleExpanded = (workbookId: string) => {
    setExpandedIds((current) => {
      const next = new Set(current)
      if (next.has(workbookId)) next.delete(workbookId)
      else next.add(workbookId)
      localStorage.setItem(
        'polan-expanded-workbooks',
        JSON.stringify(Array.from(next)),
      )
      return next
    })
  }

  return (
    <div className="workbook-list">
      <div className="sidebar-label explorer-label">
        Workbooks
        <button
          aria-label="Upload workbook"
          onClick={onUpload}
          title="Upload workbook"
          type="button"
        >
          <Plus size={12} />
        </button>
      </div>

      {workbooks.length === 0 ? (
        <button className="wb-empty" onClick={onUpload} type="button">
          <FileSpreadsheet size={15} />
          No workbooks yet - upload one
        </button>
      ) : (
        <div className="wb-items">
          {workbooks.map((workbook) => {
            const active = workbook.id === activeWorkbookId
            const expanded = expandedIds.has(workbook.id)
            const sheetCount = workbook.sheets.length
            const rowCount = workbookRowCount(workbook)
            return (
              <div className="wb-entry" key={workbook.id}>
                <div
                  className={`wb-item ${active ? 'active' : ''}`}
                  onClick={() => onSelect(workbook.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      onSelect(workbook.id)
                    }
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <span className="wb-icon">
                    <FileSpreadsheet size={15} />
                  </span>
                  <div className="wb-copy">
                    {renamingId === workbook.id ? (
                      <RenameField
                        onCancel={() => setRenamingId(null)}
                        onCommit={(name) => {
                          onRename(workbook.id, name)
                          setRenamingId(null)
                        }}
                        value={workbook.displayName}
                      />
                    ) : (
                      <strong
                        onDoubleClick={(event) => {
                          event.stopPropagation()
                          setRenamingId(workbook.id)
                        }}
                        title={workbook.originalFileName}
                      >
                        {workbook.displayName}
                      </strong>
                    )}
                    <small>
                      {sheetCount} sheet{sheetCount === 1 ? '' : 's'} · {rowCount}{' '}
                      row{rowCount === 1 ? '' : 's'}
                    </small>
                  </div>
                  <div className="wb-actions">
                    <button
                      aria-label={`Rename ${workbook.displayName}`}
                      onClick={(event) => {
                        event.stopPropagation()
                        setRenamingId(workbook.id)
                      }}
                      title="Rename"
                      type="button"
                    >
                      <Pencil size={11} />
                    </button>
                    <button
                      aria-label={`Delete ${workbook.displayName}`}
                      className="danger"
                      onClick={(event) => {
                        event.stopPropagation()
                        onRequestDelete(workbook.id)
                      }}
                      title="Delete"
                      type="button"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                  {active && (
                    <span className="wb-active-dot" aria-hidden="true">
                      <Check size={10} />
                    </span>
                  )}
                  <button
                    aria-expanded={expanded}
                    aria-label={`${expanded ? 'Collapse' : 'Expand'} ${workbook.displayName}`}
                    className={`wb-expand${expanded ? ' expanded' : ''}`}
                    onClick={(event) => {
                      event.stopPropagation()
                      toggleExpanded(workbook.id)
                    }}
                    title={expanded ? 'Hide sheets' : 'Show sheets'}
                    type="button"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>

                {expanded && (
                  <div className="wb-sheets">
                    {workbook.sheets.length ? (
                      workbook.sheets.map((sheet) => {
                        const selected =
                          active && selectedSheet === sheet.name
                        return (
                          <button
                            className={`wb-sheet${selected ? ' active' : ''}`}
                            key={sheet.name}
                            onClick={() =>
                              onSelectSheet(workbook.id, sheet.name)
                            }
                            title={`${sheet.name} · ${sheet.rows.length} rows`}
                            type="button"
                          >
                            <Table2 size={12} />
                            <span>{sheet.name}</span>
                            <small>{sheet.rows.length}</small>
                          </button>
                        )
                      })
                    ) : (
                      <span className="wb-no-sheets">No sheets found</span>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
