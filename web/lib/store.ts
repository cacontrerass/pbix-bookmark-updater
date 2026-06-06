"use client"

import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"
import { DEFAULT_MODEL_SETUP } from "./constants"
import { presetMesNuevo, presetAnioNuevo, presetBytdSelection } from "./presets"
import type { ModelSetup, AppStatus } from "./types"
import type { PbixFileInfo } from "./fs/types"

export interface ProgressInfo {
  current: number
  total: number
  currentName: string
}

export interface FailedFileInfo {
  name: string
  error: string
}

export interface BatchSummaryInfo {
  success: number
  failed: number
  totalMs: number
  averageMs: number
  totalBytes: number
  failedFiles: FailedFileInfo[]
}

interface AppState {
  mesNuevo: string
  anioNuevo: string
  mesesBytd: Set<string>
  sourceFolderHandle: FileSystemDirectoryHandle | null
  sourceFolderName: string | null
  sourceFiles: PbixFileInfo[]
  targetFolderHandle: FileSystemDirectoryHandle | null
  targetFolderName: string | null
  modelSetup: ModelSetup
  status: AppStatus
  log: string[]

  // Procesamiento en sesión (NO persistido)
  progress: ProgressInfo | null
  summary: BatchSummaryInfo | null
  abortController: AbortController | null

  setMesNuevo: (mes: string) => void
  setAnioNuevo: (anio: string) => void
  toggleMesBytd: (mes: string) => void
  setMesesBytd: (meses: Set<string>) => void
  setSourceFolder: (
    handle: FileSystemDirectoryHandle,
    files: PbixFileInfo[]
  ) => void
  setTargetFolder: (handle: FileSystemDirectoryHandle) => void
  clearSourceFolder: () => void
  clearTargetFolder: () => void
  setModelSetup: (setup: Partial<ModelSetup>) => void
  setStatus: (status: AppStatus) => void
  appendLog: (line: string) => void
  clearLog: () => void
  reset: () => void

  // Procesamiento
  startProcessing: () => AbortController
  updateProgress: (current: number, total: number, currentName: string) => void
  finishProcessing: (
    summary: BatchSummaryInfo,
    status: AppStatus
  ) => void
  cancelProcessing: () => void
}

function getInitialState() {
  return {
    mesNuevo: presetMesNuevo(),
    anioNuevo: presetAnioNuevo(),
    mesesBytd: presetBytdSelection(),
    sourceFolderHandle: null,
    sourceFolderName: null,
    sourceFiles: [] as PbixFileInfo[],
    targetFolderHandle: null,
    targetFolderName: null,
    modelSetup: { ...DEFAULT_MODEL_SETUP },
    status: "idle" as AppStatus,
    log: [] as string[],
    progress: null as ProgressInfo | null,
    summary: null as BatchSummaryInfo | null,
    abortController: null as AbortController | null,
  }
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      ...getInitialState(),

      setMesNuevo: (mes) => set({ mesNuevo: mes }),
      setAnioNuevo: (anio) => set({ anioNuevo: anio }),
      toggleMesBytd: (mes) =>
        set((state) => {
          const next = new Set(state.mesesBytd)
          if (next.has(mes)) {
            next.delete(mes)
          } else {
            next.add(mes)
          }
          return { mesesBytd: next }
        }),
      setMesesBytd: (meses) => set({ mesesBytd: new Set(meses) }),
      setSourceFolder: (handle, files) =>
        set({
          sourceFolderHandle: handle,
          sourceFolderName: handle.name,
          sourceFiles: files,
        }),
      setTargetFolder: (handle) =>
        set({
          targetFolderHandle: handle,
          targetFolderName: handle.name,
        }),
      clearSourceFolder: () =>
        set({
          sourceFolderHandle: null,
          sourceFolderName: null,
          sourceFiles: [],
        }),
      clearTargetFolder: () =>
        set({
          targetFolderHandle: null,
          targetFolderName: null,
        }),
      setModelSetup: (setup) =>
        set((state) => ({ modelSetup: { ...state.modelSetup, ...setup } })),
      setStatus: (status) => set({ status }),
      appendLog: (line) => set((state) => ({ log: [...state.log, line] })),
      clearLog: () => set({ log: [] }),
      reset: () => set(getInitialState()),

      startProcessing: () => {
        const ac = new AbortController()
        set({
          status: "running",
          progress: null,
          summary: null,
          log: [],
          abortController: ac,
        })
        return ac
      },
      updateProgress: (current, total, currentName) =>
        set({ progress: { current, total, currentName } }),
      finishProcessing: (summary, status) =>
        set({
          status,
          summary,
          abortController: null,
          progress: null,
        }),
      cancelProcessing: () => {
        const ac = get().abortController
        if (ac && !ac.signal.aborted) ac.abort()
      },
    }),
    {
      name: "pbix-updater-state",
      storage: createJSONStorage(
        () => {
          if (typeof window === "undefined") {
            return {
              getItem: () => null,
              setItem: () => {},
              removeItem: () => {},
            }
          }
          return localStorage
        },
        {
          replacer: (key, value) => {
            if (key === "mesesBytd" && value instanceof Set) {
              return Array.from(value as Set<string>)
            }
            return value
          },
          reviver: (key, value) => {
            if (key === "mesesBytd" && Array.isArray(value)) {
              return new Set(value as string[])
            }
            return value
          },
        }
      ),
      partialize: (state) => ({
        mesNuevo: state.mesNuevo,
        anioNuevo: state.anioNuevo,
        mesesBytd: state.mesesBytd,
        modelSetup: state.modelSetup,
      }),
    }
  )
)
