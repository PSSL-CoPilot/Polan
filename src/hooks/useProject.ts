import { useCallback, useEffect, useRef, useState } from 'react'
import type { MetricRecord, ProjectState, ViewRecord } from '../types'
import {
  createId,
  defaultProject,
  loadProjectFromLocal,
  saveProjectToLocal,
} from '../utils/storage'

export interface MetricDraft {
  name: string
  measureName: string
  atlanLink?: string
  description?: string
}

/**
 * Workspace project store: the Project → View → Metric hierarchy plus
 * selection state. Auto-saves (debounced) to localStorage so edits survive
 * reloads; the heavyweight workbook is persisted separately in IndexedDB.
 */
export function useProject() {
  const [project, setProject] = useState<ProjectState>(
    () => loadProjectFromLocal() ?? defaultProject(),
  )

  const saveTimer = useRef<number | undefined>(undefined)
  useEffect(() => {
    window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(
      () => saveProjectToLocal(project),
      350,
    )
    return () => window.clearTimeout(saveTimer.current)
  }, [project])

  const updateView = useCallback(
    (viewId: string, mutate: (view: ViewRecord) => ViewRecord) => {
      setProject((current) => ({
        ...current,
        views: current.views.map((view) =>
          view.id === viewId ? mutate(view) : view,
        ),
      }))
    },
    [],
  )

  const renameProject = useCallback((name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return
    setProject((current) => ({ ...current, name: trimmed }))
  }, [])

  const addView = useCallback(() => {
    const view: ViewRecord = {
      id: createId(),
      name: 'New View',
      isExpanded: true,
      metrics: [],
    }
    setProject((current) => ({
      ...current,
      views: [...current.views, view],
      selectedViewId: view.id,
    }))
    return view
  }, [])

  const renameView = useCallback(
    (viewId: string, name: string) => {
      const trimmed = name.trim()
      if (!trimmed) return
      updateView(viewId, (view) => ({ ...view, name: trimmed }))
    },
    [updateView],
  )

  const deleteView = useCallback((viewId: string) => {
    setProject((current) => {
      const removed = current.views.find((view) => view.id === viewId)
      const removedMetricIds = new Set(
        removed?.metrics.map((metric) => metric.id) ?? [],
      )
      return {
        ...current,
        views: current.views.filter((view) => view.id !== viewId),
        selectedViewId:
          current.selectedViewId === viewId ? null : current.selectedViewId,
        selectedMetricId:
          current.selectedMetricId &&
          removedMetricIds.has(current.selectedMetricId)
            ? null
            : current.selectedMetricId,
      }
    })
  }, [])

  const toggleView = useCallback(
    (viewId: string) => {
      updateView(viewId, (view) => ({ ...view, isExpanded: !view.isExpanded }))
    },
    [updateView],
  )

  const selectView = useCallback((viewId: string | null) => {
    setProject((current) => ({ ...current, selectedViewId: viewId }))
  }, [])

  const addMetric = useCallback(
    (viewId: string, draft: MetricDraft) => {
      const metric: MetricRecord = {
        id: createId(),
        name: draft.name.trim(),
        measureName: draft.measureName.trim(),
        atlanLink: draft.atlanLink?.trim() || undefined,
        description: draft.description?.trim() || undefined,
        connectedSheets: [],
        immediateTables: {},
      }
      updateView(viewId, (view) => ({
        ...view,
        isExpanded: true,
        metrics: [...view.metrics, metric],
      }))
      setProject((current) => ({
        ...current,
        selectedViewId: viewId,
        selectedMetricId: metric.id,
      }))
      return metric
    },
    [updateView],
  )

  const updateMetric = useCallback(
    (metricId: string, patch: Partial<Omit<MetricRecord, 'id'>>) => {
      setProject((current) => ({
        ...current,
        views: current.views.map((view) => ({
          ...view,
          metrics: view.metrics.map((metric) =>
            metric.id === metricId ? { ...metric, ...patch } : metric,
          ),
        })),
      }))
    },
    [],
  )

  const deleteMetric = useCallback((metricId: string) => {
    setProject((current) => ({
      ...current,
      views: current.views.map((view) => ({
        ...view,
        metrics: view.metrics.filter((metric) => metric.id !== metricId),
      })),
      selectedMetricId:
        current.selectedMetricId === metricId ? null : current.selectedMetricId,
    }))
  }, [])

  const selectMetric = useCallback((metricId: string | null) => {
    setProject((current) => {
      const owner = metricId
        ? current.views.find((view) =>
            view.metrics.some((metric) => metric.id === metricId),
          )
        : null
      return {
        ...current,
        selectedMetricId: metricId,
        selectedViewId: owner?.id ?? current.selectedViewId,
      }
    })
  }, [])

  const setConnectedSheets = useCallback(
    (metricId: string, sheets: string[]) => {
      updateMetricSheets(setProject, metricId, () => sheets)
    },
    [],
  )

  const toggleConnectedSheet = useCallback(
    (metricId: string, sheet: string) => {
      updateMetricSheets(setProject, metricId, (current) =>
        current.includes(sheet)
          ? current.filter((name) => name !== sheet)
          : [...current, sheet],
      )
    },
    [],
  )

  const setImmediateTable = useCallback(
    (metricId: string, sheet: string, table: string | null) => {
      const sheetName = sheet.trim()
      if (!sheetName) return
      setProject((current) => ({
        ...current,
        views: current.views.map((view) => ({
          ...view,
          metrics: view.metrics.map((metric) => {
            if (metric.id !== metricId) return metric
            const immediateTables = { ...(metric.immediateTables ?? {}) }
            const value = table?.trim()
            if (value) immediateTables[sheetName] = value
            else delete immediateTables[sheetName]
            return { ...metric, immediateTables }
          }),
        })),
      }))
    },
    [],
  )

  const replaceProject = useCallback((next: ProjectState) => {
    setProject(next)
  }, [])

  return {
    project,
    renameProject,
    addView,
    renameView,
    deleteView,
    toggleView,
    selectView,
    addMetric,
    updateMetric,
    deleteMetric,
    selectMetric,
    setConnectedSheets,
    toggleConnectedSheet,
    setImmediateTable,
    replaceProject,
  }
}

function updateMetricSheets(
  setProject: React.Dispatch<React.SetStateAction<ProjectState>>,
  metricId: string,
  mutate: (sheets: string[]) => string[],
) {
  setProject((current) => ({
    ...current,
    views: current.views.map((view) => ({
      ...view,
      metrics: view.metrics.map((metric) => {
        if (metric.id !== metricId) return metric
        const connectedSheets = mutate(metric.connectedSheets)
        const connected = new Set(connectedSheets)
        const immediateTables = Object.fromEntries(
          Object.entries(metric.immediateTables ?? {}).filter(([sheet]) =>
            connected.has(sheet),
          ),
        )
        return { ...metric, connectedSheets, immediateTables }
      }),
    })),
  }))
}

export function findMetric(
  project: ProjectState,
  metricId: string | null,
): MetricRecord | null {
  if (!metricId) return null
  for (const view of project.views) {
    const metric = view.metrics.find((item) => item.id === metricId)
    if (metric) return metric
  }
  return null
}

export function allMetrics(project: ProjectState): MetricRecord[] {
  return project.views.flatMap((view) => view.metrics)
}
