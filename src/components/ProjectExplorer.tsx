import {
  ChevronDown,
  ChevronRight,
  FolderKanban,
  Pencil,
  Plus,
  Sigma,
  Trash2,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { ProjectState, ViewRecord } from '../types'

interface ProjectExplorerProps {
  project: ProjectState
  activeMetricId: string | null
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

function InlineRename({
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
    const trimmed = draft.trim()
    if (trimmed && trimmed !== value) onCommit(trimmed)
    else onCancel()
  }

  return (
    <input
      className="tree-rename"
      onBlur={commit}
      onChange={(event) => setDraft(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') commit()
        if (event.key === 'Escape') onCancel()
      }}
      ref={inputRef}
      value={draft}
    />
  )
}

function ViewRow({
  view,
  activeMetricId,
  onRename,
  onDelete,
  onToggle,
  onSelectMetric,
  onRenameMetric,
  onDeleteMetric,
  onCreateMetric,
}: {
  view: ViewRecord
  activeMetricId: string | null
  onRename: (name: string) => void
  onDelete: () => void
  onToggle: () => void
  onSelectMetric: (metricId: string) => void
  onRenameMetric: (metricId: string, name: string) => void
  onDeleteMetric: (metricId: string) => void
  onCreateMetric: () => void
}) {
  const [renaming, setRenaming] = useState(false)
  const [renamingMetricId, setRenamingMetricId] = useState<string | null>(null)
  const Chevron = view.isExpanded ? ChevronDown : ChevronRight

  return (
    <div className="tree-view">
      <div className="tree-row view-row">
        <button
          aria-label={view.isExpanded ? 'Collapse view' : 'Expand view'}
          className="tree-chevron"
          onClick={onToggle}
          type="button"
        >
          <Chevron size={13} />
        </button>
        {renaming ? (
          <InlineRename
            onCancel={() => setRenaming(false)}
            onCommit={(name) => {
              onRename(name)
              setRenaming(false)
            }}
            value={view.name}
          />
        ) : (
          <button className="tree-label" onClick={onToggle} type="button">
            {view.name}
            <small>{view.metrics.length}</small>
          </button>
        )}
        <div className="tree-actions">
          <button
            aria-label={`Create metric in ${view.name}`}
            onClick={onCreateMetric}
            title="Create Metric"
            type="button"
          >
            <Plus size={12} />
          </button>
          <button
            aria-label={`Rename ${view.name}`}
            onClick={() => setRenaming(true)}
            title="Rename View"
            type="button"
          >
            <Pencil size={11} />
          </button>
          <button
            aria-label={`Delete ${view.name}`}
            className="danger"
            onClick={onDelete}
            title="Delete View"
            type="button"
          >
            <Trash2 size={11} />
          </button>
        </div>
      </div>

      {view.isExpanded && (
        <div className="tree-metrics">
          {view.metrics.map((metric) =>
            renamingMetricId === metric.id ? (
              <div className="tree-row metric-row" key={metric.id}>
                <Sigma size={12} />
                <InlineRename
                  onCancel={() => setRenamingMetricId(null)}
                  onCommit={(name) => {
                    onRenameMetric(metric.id, name)
                    setRenamingMetricId(null)
                  }}
                  value={metric.name}
                />
              </div>
            ) : (
              <div
                className={`tree-row metric-row ${
                  metric.id === activeMetricId ? 'active' : ''
                }`}
                key={metric.id}
              >
                <button
                  className="tree-label"
                  onClick={() => onSelectMetric(metric.id)}
                  type="button"
                >
                  <Sigma size={12} />
                  {metric.name}
                </button>
                <div className="tree-actions">
                  <button
                    aria-label={`Rename ${metric.name}`}
                    onClick={() => setRenamingMetricId(metric.id)}
                    title="Rename Metric"
                    type="button"
                  >
                    <Pencil size={11} />
                  </button>
                  <button
                    aria-label={`Delete ${metric.name}`}
                    className="danger"
                    onClick={() => onDeleteMetric(metric.id)}
                    title="Delete Metric"
                    type="button"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>
            ),
          )}
          {!view.metrics.length && (
            <button
              className="tree-empty"
              onClick={onCreateMetric}
              type="button"
            >
              <Plus size={11} />
              Create Metric
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export function ProjectExplorer({
  project,
  activeMetricId,
  onRenameProject,
  onAddView,
  onRenameView,
  onDeleteView,
  onToggleView,
  onSelectMetric,
  onRenameMetric,
  onDeleteMetric,
  onCreateMetric,
}: ProjectExplorerProps) {
  const [renamingProject, setRenamingProject] = useState(false)

  return (
    <div className="project-explorer">
      <div className="sidebar-label explorer-label">
        Project Explorer
        <button
          aria-label="Add view"
          onClick={onAddView}
          title="Add View"
          type="button"
        >
          <Plus size={12} />
        </button>
      </div>

      <div className="tree-row project-row">
        <FolderKanban size={14} />
        {renamingProject ? (
          <InlineRename
            onCancel={() => setRenamingProject(false)}
            onCommit={(name) => {
              onRenameProject(name)
              setRenamingProject(false)
            }}
            value={project.name}
          />
        ) : (
          <>
            <span className="tree-label">{project.name}</span>
            <div className="tree-actions">
              <button
                aria-label="Rename project"
                onClick={() => setRenamingProject(true)}
                title="Rename Project"
                type="button"
              >
                <Pencil size={11} />
              </button>
            </div>
          </>
        )}
      </div>

      <div className="tree-views">
        {project.views.map((view) => (
          <ViewRow
            activeMetricId={activeMetricId}
            key={view.id}
            onCreateMetric={() => onCreateMetric(view.id)}
            onDelete={() => onDeleteView(view.id)}
            onDeleteMetric={onDeleteMetric}
            onRename={(name) => onRenameView(view.id, name)}
            onRenameMetric={onRenameMetric}
            onSelectMetric={onSelectMetric}
            onToggle={() => onToggleView(view.id)}
            view={view}
          />
        ))}
      </div>
    </div>
  )
}
