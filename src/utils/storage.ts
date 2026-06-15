import type {
  MetricRecord,
  ProjectState,
  UploadedWorkbook,
  ViewRecord,
  WorkbookData,
  WorkbookState,
} from '../types'
import { toImmediateTableList } from './metricImmediateTable'

/**
 * Persistence layer
 * ----------------------------------------------------------------------------
 *  - Project metadata (views, metrics, links) → localStorage (tiny JSON).
 *  - Parsed workbook (sheets + processed rows)  → IndexedDB, which has no
 *    practical size ceiling, so large Excel files never touch localStorage.
 *  - "Save Project" bundles both into a downloadable `.polan.json`;
 *    "Open Project" restores from one. Every reader validates defensively —
 *    corrupt or hand-edited files fall back to safe defaults instead of
 *    crashing the app.
 */

const PROJECT_KEY = 'polan.project.v1'
const DB_NAME = 'polan-studio'
const DB_STORE = 'kv'
const WORKBOOK_KEY = 'workbook' // legacy single-workbook key (migrated on load)
const WORKBOOKS_KEY = 'workbooks.v2'
export const PROJECT_FILE_VERSION = 2

export const createId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`

export function defaultProject(): ProjectState {
  return {
    name: 'Lineage Dashboard',
    views: [
      { id: createId(), name: 'Main View', isExpanded: true, metrics: [] },
    ],
    selectedViewId: null,
    selectedMetricId: null,
  }
}

const asString = (value: unknown, fallback = '') =>
  typeof value === 'string' ? value : fallback

function sanitizeMetric(value: unknown): MetricRecord | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as Record<string, unknown>
  const name = asString(raw.name).trim()
  const measureName = asString(raw.measureName).trim()
  if (!name || !measureName) return null
  // Immediate Tables migrate from the legacy `Record<string, string>` shape to
  // the new `Record<string, string[]>` shape; `toImmediateTableList` accepts
  // both, so old saved projects keep working.
  const immediateTables =
    raw.immediateTables && typeof raw.immediateTables === 'object'
      ? Object.fromEntries(
          Object.entries(raw.immediateTables as Record<string, unknown>)
            .map(([sheet, tables]): [string, string[]] => [
              sheet.trim(),
              toImmediateTableList(tables),
            ])
            .filter(([sheet, tables]) => Boolean(sheet) && tables.length > 0),
        )
      : {}
  return {
    id: asString(raw.id) || createId(),
    name,
    measureName,
    atlanLink: asString(raw.atlanLink) || undefined,
    description: asString(raw.description) || undefined,
    connectedSheets: Array.isArray(raw.connectedSheets)
      ? raw.connectedSheets.filter(
          (sheet): sheet is string => typeof sheet === 'string',
        )
      : [],
    immediateTables,
  }
}

function sanitizeView(value: unknown): ViewRecord | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as Record<string, unknown>
  const name = asString(raw.name).trim()
  if (!name) return null
  return {
    id: asString(raw.id) || createId(),
    name,
    isExpanded: raw.isExpanded !== false,
    metrics: Array.isArray(raw.metrics)
      ? raw.metrics
          .map(sanitizeMetric)
          .filter((metric): metric is MetricRecord => Boolean(metric))
      : [],
  }
}

export function sanitizeProject(value: unknown): ProjectState | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as Record<string, unknown>
  const views = Array.isArray(raw.views)
    ? raw.views
        .map(sanitizeView)
        .filter((view): view is ViewRecord => Boolean(view))
    : []
  if (!views.length) views.push(...defaultProject().views)

  const metricIds = new Set(
    views.flatMap((view) => view.metrics.map((metric) => metric.id)),
  )
  const viewIds = new Set(views.map((view) => view.id))
  const selectedViewId = asString(raw.selectedViewId) || null
  const selectedMetricId = asString(raw.selectedMetricId) || null

  return {
    name: asString(raw.name).trim() || 'Lineage Dashboard',
    views,
    selectedViewId:
      selectedViewId && viewIds.has(selectedViewId) ? selectedViewId : null,
    selectedMetricId:
      selectedMetricId && metricIds.has(selectedMetricId)
        ? selectedMetricId
        : null,
  }
}

// ── localStorage: project metadata ───────────────────────────────────────────

export function loadProjectFromLocal(): ProjectState | null {
  try {
    const raw = window.localStorage.getItem(PROJECT_KEY)
    if (!raw) return null
    return sanitizeProject(JSON.parse(raw))
  } catch {
    return null
  }
}

export function saveProjectToLocal(project: ProjectState) {
  try {
    window.localStorage.setItem(PROJECT_KEY, JSON.stringify(project))
  } catch {
    // Quota or privacy-mode failure — auto-save is best-effort.
  }
}

// ── IndexedDB: parsed workbook ────────────────────────────────────────────────

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(DB_STORE)) {
        request.result.createObjectStore(DB_STORE)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

/** Wrap a freshly parsed workbook (or a legacy single workbook) into a
 *  tracked collection entry. */
export function toUploadedWorkbook(
  workbook: WorkbookData,
  displayName?: string,
): UploadedWorkbook {
  return {
    id: createId(),
    displayName: displayName?.trim() || workbook.name || 'Untitled Workbook',
    originalFileName: workbook.name || 'workbook.xlsx',
    sizeLabel: workbook.sizeLabel,
    loadedAt: workbook.loadedAt,
    sheets: workbook.sheets,
  }
}

function sanitizeUploadedWorkbook(value: unknown): UploadedWorkbook | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as Record<string, unknown>
  if (!Array.isArray(raw.sheets)) return null
  const originalFileName = asString(raw.originalFileName || raw.name, 'workbook.xlsx')
  return {
    id: asString(raw.id) || createId(),
    displayName:
      asString(raw.displayName).trim() || originalFileName || 'Untitled Workbook',
    originalFileName,
    sizeLabel: asString(raw.sizeLabel, ''),
    loadedAt: asString(raw.loadedAt) || new Date().toISOString(),
    sheets: raw.sheets as UploadedWorkbook['sheets'],
  }
}

export function sanitizeWorkbookState(value: unknown): WorkbookState {
  const empty: WorkbookState = { workbooks: [], activeWorkbookId: null }
  if (!value || typeof value !== 'object') return empty
  const raw = value as Record<string, unknown>

  // New collection shape.
  if (Array.isArray(raw.workbooks)) {
    const workbooks = raw.workbooks
      .map(sanitizeUploadedWorkbook)
      .filter((wb): wb is UploadedWorkbook => Boolean(wb))
    const ids = new Set(workbooks.map((wb) => wb.id))
    const activeId = asString(raw.activeWorkbookId) || null
    return {
      workbooks,
      activeWorkbookId:
        activeId && ids.has(activeId) ? activeId : workbooks[0]?.id ?? null,
    }
  }

  // Legacy single-workbook shape (migration).
  const single = sanitizeUploadedWorkbook(raw)
  if (single) return { workbooks: [single], activeWorkbookId: single.id }
  return empty
}

export async function saveWorkbooksToIdb(state: WorkbookState) {
  try {
    const db = await openDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(DB_STORE, 'readwrite')
      const store = tx.objectStore(DB_STORE)
      store.put(state, WORKBOOKS_KEY)
      store.delete(WORKBOOK_KEY) // drop the legacy entry once migrated
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    db.close()
  } catch {
    // IndexedDB unavailable — the session simply won't survive a reload.
  }
}

export async function loadWorkbooksFromIdb(): Promise<WorkbookState> {
  try {
    const db = await openDb()
    const [collection, legacy] = await Promise.all([
      idbGet(db, WORKBOOKS_KEY),
      idbGet(db, WORKBOOK_KEY),
    ])
    db.close()
    if (collection) return sanitizeWorkbookState(collection)
    if (legacy) return sanitizeWorkbookState(legacy) // migrate old single key
    return { workbooks: [], activeWorkbookId: null }
  } catch {
    return { workbooks: [], activeWorkbookId: null }
  }
}

function idbGet(db: IDBDatabase, key: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readonly')
    const request = tx.objectStore(DB_STORE).get(key)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

// ── .polan.json: save / open project files ───────────────────────────────────

export function downloadProjectFile(
  project: ProjectState,
  workbooks: WorkbookState,
) {
  const payload = {
    format: 'polan-project',
    version: PROJECT_FILE_VERSION,
    savedAt: new Date().toISOString(),
    project,
    workbooks: workbooks.workbooks,
    activeWorkbookId: workbooks.activeWorkbookId,
  }
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  const slug = project.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')
  anchor.href = url
  anchor.download = `${slug || 'project'}.polan.json`
  anchor.click()
  URL.revokeObjectURL(url)
}

export function parseProjectFile(text: string): {
  project: ProjectState
  workbooks: WorkbookState
} {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new Error('This file is not valid JSON.')
  }
  if (!raw || typeof raw !== 'object') {
    throw new Error('This file does not look like a Polan project.')
  }
  const data = raw as Record<string, unknown>
  if (data.format !== 'polan-project') {
    throw new Error('This file does not look like a Polan project.')
  }
  const project = sanitizeProject(data.project)
  if (!project) {
    throw new Error('The project data inside this file is invalid.')
  }
  // v2 carries a workbook collection; v1 carried a single `workbook`.
  const workbooks = data.workbooks
    ? sanitizeWorkbookState(data)
    : sanitizeWorkbookState(data.workbook)
  return { project, workbooks }
}

export function isValidHttpUrl(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}
