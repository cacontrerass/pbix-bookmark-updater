// Tipos de mensajes intercambiados entre el main thread y el web worker.
// Se definen en módulo separado para que el worker no tenga dependencias
// React/Next.

import type { ModelSetup } from "@pbix/core/pbix/types"

export interface WorkerFileInput {
  name: string
  bytes: Uint8Array
}

export interface BatchPayload {
  files: WorkerFileInput[]
  mesNuevo: string
  anioNuevo: string
  mesesBytdStr: string
  modelSetup: Partial<ModelSetup> | null
}

export type WorkerInMessage =
  | { type: "process_batch"; payload: BatchPayload }
  | { type: "cancel" }

export type WorkerOutMessage =
  | {
      type: "file_start"
      payload: { name: string; index: number; total: number }
    }
  | { type: "log_line"; payload: { line: string } }
  | {
      type: "file_done"
      payload: { name: string; durationMs: number; output: Uint8Array }
    }
  | { type: "file_error"; payload: { name: string; error: string } }
  | {
      type: "batch_done"
      payload: { success: number; failed: number; totalMs: number }
    }
  | { type: "cancelled" }
  | { type: "fatal"; payload: { error: string } }
