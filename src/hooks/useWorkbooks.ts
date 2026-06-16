import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { UploadedWorkbook, WorkbookState } from '../types'
import {
  loadWorkbooksFromIdb,
  saveWorkbooksToIdb,
  toUploadedWorkbook,
} from '../utils/storage'
import { parseWorkbookFile } from '../utils/workbook'

const MAX_FILE_BYTES = 25 * 1024 * 1024

/** Sentinel thrown by refreshWorkbook when no cached File is available. */
export const REFRESH_NEEDS_FILE = 'REFRESH_NEEDS_FILE'

export interface AddWorkbooksResult {
  added: number
  errors: string[]
}

/**
 * Multi-workbook collection store. Wraps the existing single-file parsing
 * engine (parseWorkbookFile) and tracks every uploaded workbook with a unique
 * id, a renameable display name, and one active selection. Persists to
 * IndexedDB (workbooks can be large) and restores on reload.
 */
export function useWorkbooks() {
  const [state, setState] = useState<WorkbookState>({
    workbooks: [],
    activeWorkbookId: null,
  })
  const hydratedRef = useRef(false)
  // In-memory cache of the original File objects keyed by workbook id. Files
  // can't be persisted to IndexedDB across reloads, so this only survives the
  // current session — refresh falls back to a file picker when it's empty.
  const filesRef = useRef<Map<string, File>>(new Map())

  // Restore the collection once on mount (migrates the legacy single key).
  useEffect(() => {
    let cancelled = false
    loadWorkbooksFromIdb().then((restored) => {
      if (cancelled) return
      if (restored.workbooks.length) setState(restored)
      hydratedRef.current = true
    })
    return () => {
      cancelled = true
    }
  }, [])

  // Debounced persistence, but never before the initial restore has run (so we
  // don't clobber stored data with the empty initial state).
  const saveTimer = useRef<number | undefined>(undefined)
  useEffect(() => {
    if (!hydratedRef.current) return
    window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => saveWorkbooksToIdb(state), 300)
    return () => window.clearTimeout(saveTimer.current)
  }, [state])

  const activeWorkbook = useMemo(
    () =>
      state.workbooks.find((wb) => wb.id === state.activeWorkbookId) ?? null,
    [state.workbooks, state.activeWorkbookId],
  )

  const addWorkbooks = useCallback(
    async (files: File[]): Promise<AddWorkbooksResult> => {
      hydratedRef.current = true
      const parsed: UploadedWorkbook[] = []
      const errors: string[] = []

      for (const file of files) {
        try {
          if (file.size > MAX_FILE_BYTES) {
            throw new Error('larger than the 25 MB limit')
          }
          const workbook = await parseWorkbookFile(file)
          const uploaded = toUploadedWorkbook(workbook)
          filesRef.current.set(uploaded.id, file)
          parsed.push(uploaded)
        } catch (caught) {
          const reason =
            caught instanceof Error ? caught.message : 'could not be read'
          errors.push(`"${file.name}" ${reason}`)
        }
      }

      if (parsed.length) {
        setState((current) => ({
          workbooks: [...current.workbooks, ...parsed],
          activeWorkbookId: parsed[parsed.length - 1].id,
        }))
      }

      return { added: parsed.length, errors }
    },
    [],
  )

  const renameWorkbook = useCallback((id: string, name: string) => {
    setState((current) => ({
      ...current,
      workbooks: current.workbooks.map((wb) =>
        wb.id === id
          ? {
              ...wb,
              displayName:
                name.trim() || wb.originalFileName || 'Untitled Workbook',
            }
          : wb,
      ),
    }))
  }, [])

  const deleteWorkbook = useCallback((id: string) => {
    hydratedRef.current = true
    filesRef.current.delete(id)
    setState((current) => {
      const workbooks = current.workbooks.filter((wb) => wb.id !== id)
      const activeWorkbookId =
        current.activeWorkbookId === id
          ? workbooks[0]?.id ?? null
          : current.activeWorkbookId
      return { workbooks, activeWorkbookId }
    })
  }, [])

  /** True when the original File for this workbook is still cached in memory. */
  const hasWorkbookFile = useCallback((id: string) => filesRef.current.has(id), [])

  /**
   * Re-parse a workbook in place. Uses the cached File when available, otherwise
   * the caller must supply a freshly picked File (e.g. after a reload cleared
   * the in-memory cache). The workbook id, display name, and original file name
   * are preserved so project metadata, metric links, and Immediate Tables
   * (keyed by sheet name) stay intact.
   */
  const refreshWorkbook = useCallback(
    async (id: string, file?: File): Promise<void> => {
      const target = file ?? filesRef.current.get(id)
      if (!target) throw new Error(REFRESH_NEEDS_FILE)
      if (target.size > MAX_FILE_BYTES) {
        throw new Error('The workbook is larger than the 25 MB limit.')
      }
      const workbook = await parseWorkbookFile(target)
      filesRef.current.set(id, target)
      hydratedRef.current = true
      setState((current) => ({
        ...current,
        workbooks: current.workbooks.map((wb) =>
          wb.id === id
            ? {
                ...wb,
                sizeLabel: workbook.sizeLabel,
                loadedAt: workbook.loadedAt,
                sheets: workbook.sheets,
              }
            : wb,
        ),
      }))
    },
    [],
  )

  const selectWorkbook = useCallback((id: string) => {
    setState((current) =>
      current.workbooks.some((wb) => wb.id === id)
        ? { ...current, activeWorkbookId: id }
        : current,
    )
  }, [])

  const replaceWorkbooks = useCallback((next: WorkbookState) => {
    hydratedRef.current = true
    setState(next)
  }, [])

  return {
    workbooks: state.workbooks,
    activeWorkbookId: state.activeWorkbookId,
    activeWorkbook,
    workbookState: state,
    addWorkbooks,
    renameWorkbook,
    deleteWorkbook,
    selectWorkbook,
    replaceWorkbooks,
    refreshWorkbook,
    hasWorkbookFile,
  }
}

/** Count of valid (error-free) processed rows across a workbook's sheets. */
export function workbookRowCount(workbook: UploadedWorkbook): number {
  return workbook.sheets.reduce(
    (total, sheet) => total + (sheet.errors.length ? 0 : sheet.rows.length),
    0,
  )
}
