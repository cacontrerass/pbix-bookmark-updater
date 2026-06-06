// Web Worker dedicado al procesamiento secuencial de .pbix.
// - Recibe los bytes de cada archivo desde el main thread (transferable).
// - Procesa uno por uno via processPbixBytes() (delega en @pbix/core).
// - Intercepta console.log para reenviar la traza como mensajes "log_line"
//   (el core escribe logs ricos a stdout; en navegador no hay stdout, así que
//   esta es la forma de capturarlo sin tocar el core).
// - Soporta cancelación cooperativa entre archivos (D8): si llega "cancel"
//   se termina el archivo en curso y luego se emite "cancelled".

/// <reference lib="webworker" />

import { processPbixBytes } from "./processFile"
import type { WorkerInMessage, WorkerOutMessage } from "./messages"

declare const self: DedicatedWorkerGlobalScope

let cancelRequested = false

function post(msg: WorkerOutMessage, transfer?: Transferable[]) {
  if (transfer && transfer.length > 0) {
    self.postMessage(msg, transfer)
  } else {
    self.postMessage(msg)
  }
}

function installLogCapture(): () => void {
  const originalLog = console.log
  const originalErr = console.error
  const originalWarn = console.warn

  function forward(args: unknown[]) {
    const line = args
      .map((a) => (typeof a === "string" ? a : safeStringify(a)))
      .join(" ")
    // El core ya inserta "\n" al inicio de algunas líneas: lo respetamos
    // dividiendo por saltos para que el log se muestre línea a línea.
    for (const part of line.split("\n")) {
      post({ type: "log_line", payload: { line: part } })
    }
  }

  console.log = (...args: unknown[]) => {
    forward(args)
    originalLog.apply(console, args as never[])
  }
  console.error = (...args: unknown[]) => {
    forward(args)
    originalErr.apply(console, args as never[])
  }
  console.warn = (...args: unknown[]) => {
    forward(args)
    originalWarn.apply(console, args as never[])
  }

  return () => {
    console.log = originalLog
    console.error = originalErr
    console.warn = originalWarn
  }
}

function safeStringify(v: unknown): string {
  try {
    return JSON.stringify(v)
  } catch {
    return String(v)
  }
}

self.onmessage = async (ev: MessageEvent<WorkerInMessage>) => {
  const msg = ev.data
  if (msg.type === "cancel") {
    cancelRequested = true
    return
  }
  if (msg.type !== "process_batch") return

  cancelRequested = false
  const restoreLog = installLogCapture()
  const startTotal = Date.now()
  let success = 0
  let failed = 0

  const { files, mesNuevo, anioNuevo, mesesBytdStr, modelSetup } = msg.payload

  try {
    for (let i = 0; i < files.length; i++) {
      if (cancelRequested) {
        post({ type: "cancelled" })
        return
      }
      const f = files[i]
      post({
        type: "file_start",
        payload: { name: f.name, index: i, total: files.length },
      })

      const t0 = Date.now()
      try {
        const out = await processPbixBytes(
          f.bytes,
          f.name,
          mesNuevo,
          anioNuevo,
          mesesBytdStr,
          modelSetup
        )
        success++
        // Transferir el buffer de salida para evitar copia
        post(
          {
            type: "file_done",
            payload: { name: f.name, durationMs: Date.now() - t0, output: out },
          },
          [out.buffer]
        )
      } catch (err) {
        failed++
        const errorMsg = err instanceof Error ? err.message : String(err)
        post({
          type: "file_error",
          payload: { name: f.name, error: errorMsg },
        })
        // D1: continuar con el siguiente archivo
      }
    }

    post({
      type: "batch_done",
      payload: { success, failed, totalMs: Date.now() - startTotal },
    })
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    post({ type: "fatal", payload: { error: errorMsg } })
  } finally {
    restoreLog()
  }
}
