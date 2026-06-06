// Orquestador de alto nivel del procesamiento batch.
// - Pide/verifica permiso readwrite sobre la carpeta destino.
// - Pregunta confirmación (D7) si el destino tiene archivos.
// - Vacía el destino tras confirmación.
// - Arranca un Web Worker dedicado y le envía los .pbix UNO POR UNO
//   (un "process_batch" de un solo archivo por iteración). Esto evita
//   tener varios .pbix en RAM a la vez (D3 — archivos de 444 MB) y permite
//   escribir cada salida en disco antes de continuar.
// - Cancelación cooperativa (D8): si signal.aborted, dejamos terminar el
//   archivo en curso y luego paramos.

import type { PbixFileInfo } from "@/lib/fs/types"
import { verifyPermission } from "@/lib/fs/fileSystemAccess"
import type { ModelSetup } from "@pbix/core/pbix/types"
import type { WorkerInMessage, WorkerOutMessage } from "./messages"

export interface FailedFile {
  name: string
  error: string
}

export interface BatchSummary {
  success: number
  failed: number
  totalMs: number
  averageMs: number
  totalBytes: number
  failedFiles: FailedFile[]
}

export type StartBatchOutcome =
  | { kind: "completed"; summary: BatchSummary }
  | { kind: "cancelled"; summary: BatchSummary }
  | { kind: "user_cancelled_clear" } // usuario dijo "no" al confirmar vaciar

export interface StartBatchParams {
  sourceHandle: FileSystemDirectoryHandle
  targetHandle: FileSystemDirectoryHandle
  sourceFiles: PbixFileInfo[]
  mesNuevo: string
  anioNuevo: string
  mesesBytdStr: string
  modelSetup: Partial<ModelSetup> | null
  onProgress: (current: number, total: number, currentName: string) => void
  onLog: (line: string) => void
  onConfirmClear: (filesCount: number) => Promise<boolean>
  signal: AbortSignal
}

/** Cuenta cuántas entradas (de cualquier tipo) tiene un directorio. */
async function countEntries(
  dirHandle: FileSystemDirectoryHandle
): Promise<number> {
  let n = 0
  for await (const _entry of dirHandle.entries()) {
    void _entry
    n++
  }
  return n
}

/** Borra recursivamente todo el contenido del directorio (no el directorio mismo). */
async function clearDirectory(
  dirHandle: FileSystemDirectoryHandle
): Promise<void> {
  const names: string[] = []
  for await (const [name] of dirHandle.entries()) {
    names.push(name)
  }
  for (const name of names) {
    try {
      await dirHandle.removeEntry(name, { recursive: true })
    } catch (err) {
      throw new Error(`No se pudo borrar '${name}' del destino: ${(err as Error).message}`)
    }
  }
}

async function writeBytesToTarget(
  targetHandle: FileSystemDirectoryHandle,
  name: string,
  bytes: Uint8Array
): Promise<void> {
  const fileHandle = await targetHandle.getFileHandle(name, { create: true })
  const writable = await fileHandle.createWritable()
  try {
    // Pasamos un Blob para evitar problemas de tipos entre ArrayBufferLike y
    // ArrayBuffer estricto que exige FileSystemWriteChunkType.
    await writable.write(new Blob([bytes as BlobPart]))
  } finally {
    await writable.close()
  }
}

/** Crea el Web Worker apuntando al bundle del worker (Next handles `new URL(...,import.meta.url)`). */
function createWorker(): Worker {
  return new Worker(new URL("./worker.ts", import.meta.url), {
    type: "module",
  })
}

interface ProcessOneResult {
  ok: boolean
  output?: Uint8Array
  error?: string
  durationMs: number
}

/**
 * Envía UN archivo al worker dentro de un process_batch de un solo elemento
 * y espera al primer file_done/file_error (o batch_done). Reusa el worker
 * (no lo termina entre archivos).
 */
function processOneInWorker(
  worker: Worker,
  file: { name: string; bytes: Uint8Array },
  mesNuevo: string,
  anioNuevo: string,
  mesesBytdStr: string,
  modelSetup: Partial<ModelSetup> | null,
  onLog: (line: string) => void
): Promise<ProcessOneResult> {
  return new Promise((resolve, reject) => {
    let resolved = false

    function onMessage(ev: MessageEvent<WorkerOutMessage>) {
      const m = ev.data
      switch (m.type) {
        case "log_line":
          onLog(m.payload.line)
          return
        case "file_start":
          return
        case "file_done":
          resolved = true
          worker.removeEventListener("message", onMessage)
          worker.removeEventListener("error", onError)
          resolve({
            ok: true,
            output: m.payload.output,
            durationMs: m.payload.durationMs,
          })
          return
        case "file_error":
          resolved = true
          worker.removeEventListener("message", onMessage)
          worker.removeEventListener("error", onError)
          resolve({
            ok: false,
            error: m.payload.error,
            durationMs: 0,
          })
          return
        case "batch_done":
          // Si no hubo file_done ni file_error pero llegó batch_done con 0/0,
          // significa que el batch se completó sin producir resultado: tratar
          // como error sintético para no quedar colgados.
          if (!resolved) {
            resolved = true
            worker.removeEventListener("message", onMessage)
            worker.removeEventListener("error", onError)
            resolve({
              ok: false,
              error: "El worker terminó sin emitir resultado para el archivo.",
              durationMs: 0,
            })
          }
          return
        case "cancelled":
          if (!resolved) {
            resolved = true
            worker.removeEventListener("message", onMessage)
            worker.removeEventListener("error", onError)
            resolve({
              ok: false,
              error: "Cancelado por el usuario antes de procesar.",
              durationMs: 0,
            })
          }
          return
        case "fatal":
          worker.removeEventListener("message", onMessage)
          worker.removeEventListener("error", onError)
          reject(new Error(m.payload.error))
          return
      }
    }

    function onError(ev: ErrorEvent) {
      worker.removeEventListener("message", onMessage)
      worker.removeEventListener("error", onError)
      reject(new Error(ev.message || "Error en el Web Worker"))
    }

    worker.addEventListener("message", onMessage)
    worker.addEventListener("error", onError)

    const msg: WorkerInMessage = {
      type: "process_batch",
      payload: {
        files: [file],
        mesNuevo,
        anioNuevo,
        mesesBytdStr,
        modelSetup,
      },
    }
    worker.postMessage(msg, [file.bytes.buffer])
  })
}

export async function startBatch(
  params: StartBatchParams
): Promise<StartBatchOutcome> {
  const {
    sourceHandle,
    targetHandle,
    sourceFiles,
    mesNuevo,
    anioNuevo,
    mesesBytdStr,
    modelSetup,
    onProgress,
    onLog,
    onConfirmClear,
    signal,
  } = params

  // 1) Permiso readwrite sobre destino
  const targetOk = await verifyPermission(targetHandle, "readwrite")
  if (!targetOk) {
    throw new Error(
      "No se concedió permiso de escritura sobre la carpeta de destino."
    )
  }

  // 2) Confirmar vaciado si destino no está vacío (D7)
  const existing = await countEntries(targetHandle)
  if (existing > 0) {
    const proceed = await onConfirmClear(existing)
    if (!proceed) {
      return { kind: "user_cancelled_clear" }
    }
    onLog(`[i] Vaciando carpeta de destino (${existing} entrada(s))…`)
    await clearDirectory(targetHandle)
  }

  // 3) Procesar archivos uno a uno via worker
  const worker = createWorker()
  const summary: BatchSummary = {
    success: 0,
    failed: 0,
    totalMs: 0,
    averageMs: 0,
    totalBytes: 0,
    failedFiles: [],
  }
  const start = Date.now()

  function finalize(kind: "completed" | "cancelled"): StartBatchOutcome {
    summary.totalMs = Date.now() - start
    const processed = summary.success + summary.failed
    summary.averageMs = processed > 0 ? Math.round(summary.totalMs / processed) : 0
    return { kind, summary }
  }

  try {
    for (let i = 0; i < sourceFiles.length; i++) {
      // Cancelación cooperativa (D8): si se pidió detener, paramos AQUÍ,
      // antes de comenzar el siguiente archivo (el anterior, si estaba en
      // curso, ya terminó porque el bucle es secuencial).
      if (signal.aborted) {
        return finalize("cancelled")
      }

      const info = sourceFiles[i]
      summary.totalBytes += info.size
      onProgress(i + 1, sourceFiles.length, info.name)

      // Obtener handle y bytes
      let fileHandle: FileSystemFileHandle
      try {
        fileHandle = (info.handle ??
          (await sourceHandle.getFileHandle(info.name))) as FileSystemFileHandle
      } catch (err) {
        const msg = (err as Error).message
        summary.failed++
        summary.failedFiles.push({ name: info.name, error: `No se pudo abrir: ${msg}` })
        onLog(`[ERR] ${info.name}: no se pudo abrir (${msg})`)
        continue
      }

      let inputBytes: Uint8Array
      try {
        const file = await fileHandle.getFile()
        inputBytes = new Uint8Array(await file.arrayBuffer())
      } catch (err) {
        const msg = (err as Error).message
        summary.failed++
        summary.failedFiles.push({ name: info.name, error: `No se pudo leer: ${msg}` })
        onLog(`[ERR] ${info.name}: no se pudo leer (${msg})`)
        continue
      }

      const result = await processOneInWorker(
        worker,
        { name: info.name, bytes: inputBytes },
        mesNuevo,
        anioNuevo,
        mesesBytdStr,
        modelSetup,
        onLog
      )

      if (!result.ok || !result.output) {
        summary.failed++
        summary.failedFiles.push({
          name: info.name,
          error: result.error ?? "Error desconocido",
        })
        continue
      }

      // Escribir salida en destino
      try {
        await writeBytesToTarget(targetHandle, info.name, result.output)
        summary.success++
      } catch (err) {
        const msg = (err as Error).message
        summary.failed++
        summary.failedFiles.push({
          name: info.name,
          error: `No se pudo escribir en destino: ${msg}`,
        })
        onLog(`[ERR] ${info.name}: ${msg}`)
      }
    }

    return finalize("completed")
  } finally {
    try {
      worker.postMessage({ type: "cancel" } as WorkerInMessage)
    } catch {
      // ignore
    }
    worker.terminate()
  }
}
