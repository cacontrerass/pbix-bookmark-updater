"use client"

import { useEffect, useRef, useState } from "react"
import { Copy, Play, Square, FileText } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { ConfirmClearDialog } from "@/components/ConfirmClearDialog"
import { useAppStore } from "@/lib/store"
import { MESES_CORTOS } from "@/lib/constants"
import { formatBytes } from "@/lib/utils"
import { startBatch } from "@/lib/processing/processor"
import type { TaxonomyId } from "@pbix/core/pbix/types"

const STATUS_LABELS: Record<string, string> = {
  idle: "Listo",
  running: "Procesando…",
  stopped: "Detenido",
  done: "Completado",
  error: "Error",
}

const STATUS_COLORS: Record<string, string> = {
  idle: "text-muted-foreground",
  running: "text-primary",
  stopped: "text-warning",
  done: "text-success",
  error: "text-destructive",
}

interface PendingConfirm {
  count: number
  resolve: (yes: boolean) => void
}

const EMPTY_SUMMARY = {
  success: 0,
  failed: 0,
  totalMs: 0,
  averageMs: 0,
  totalBytes: 0,
  failedFiles: [] as { name: string; error: string }[],
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s
}

export function ExecutionFooter() {
  const status = useAppStore((s) => s.status)
  const log = useAppStore((s) => s.log)
  const progress = useAppStore((s) => s.progress)
  const summary = useAppStore((s) => s.summary)
  const setStatus = useAppStore((s) => s.setStatus)
  const appendLog = useAppStore((s) => s.appendLog)
  const startProcessing = useAppStore((s) => s.startProcessing)
  const updateProgress = useAppStore((s) => s.updateProgress)
  const finishProcessing = useAppStore((s) => s.finishProcessing)
  const cancelProcessing = useAppStore((s) => s.cancelProcessing)

  const sourceHandle = useAppStore((s) => s.sourceFolderHandle)
  const targetHandle = useAppStore((s) => s.targetFolderHandle)
  const targetFolderName = useAppStore((s) => s.targetFolderName)
  const sourceFiles = useAppStore((s) => s.sourceFiles)
  const mesNuevo = useAppStore((s) => s.mesNuevo)
  const anioNuevo = useAppStore((s) => s.anioNuevo)
  const mesesBytd = useAppStore((s) => s.mesesBytd)
  const modelSetup = useAppStore((s) => s.modelSetup)

  const [logOpen, setLogOpen] = useState(false)
  const [pendingConfirm, setPendingConfirm] =
    useState<PendingConfirm | null>(null)
  const [copied, setCopied] = useState(false)
  const runningRef = useRef(false)

  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(t)
  }, [copied])

  async function handleCopyLog() {
    if (log.length === 0) return
    try {
      await navigator.clipboard.writeText(log.join("\n"))
      setCopied(true)
      toast.success("Log copiado al portapapeles")
    } catch {
      toast.error("No se pudo copiar el log al portapapeles.")
    }
  }

  function resolveConfirm(yes: boolean) {
    if (pendingConfirm) {
      pendingConfirm.resolve(yes)
      setPendingConfirm(null)
    }
  }

  async function handleRun() {
    if (runningRef.current) return

    if (!sourceHandle || !targetHandle) {
      toast.error("Selecciona las carpetas de origen y destino antes de ejecutar.")
      return
    }
    if (sourceFiles.length === 0) {
      toast.error("La carpeta de origen no contiene archivos .pbix.")
      return
    }
    if (!mesNuevo) {
      toast.error("Selecciona un mes antes de ejecutar.")
      return
    }
    if (anioNuevo && !/^\d+$/.test(anioNuevo)) {
      toast.error("El año debe ser numérico.")
      return
    }

    runningRef.current = true
    const ac = startProcessing()

    // Construir parámetros equivalentes a los del worker_runner Python
    const anioConL = anioNuevo ? `${anioNuevo}L` : ""
    const mesesOrdenados = MESES_CORTOS.filter((m) => mesesBytd.has(m))
    const mesesBytdStr = mesesOrdenados.join(",")
    const coreModelSetup = {
      period_column_property: modelSetup.periodColumn,
      year_column_property: modelSetup.yearColumn,
      taxonomy_ids: [modelSetup.taxonomy as TaxonomyId],
    }

    appendLog("==============================================")
    appendLog(`>> Iniciando procesamiento`)
    appendLog(`   Mes nuevo  : ${mesNuevo}`)
    appendLog(`   Año nuevo  : ${anioConL || "(vacío)"}`)
    appendLog(`   BYTD       : ${mesesBytdStr || "(vacío)"}`)
    appendLog(`   Origen     : ${sourceHandle.name}`)
    appendLog(`   Destino    : ${targetHandle.name}`)
    appendLog(`   Archivos   : ${sourceFiles.length}`)
    appendLog("==============================================")

    try {
      const outcome = await startBatch({
        sourceHandle,
        targetHandle,
        sourceFiles,
        mesNuevo,
        anioNuevo: anioConL,
        mesesBytdStr,
        modelSetup: coreModelSetup,
        onProgress: (current, total, currentName) =>
          updateProgress(current, total, currentName),
        onLog: (line) => appendLog(line),
        onConfirmClear: (count) =>
          new Promise<boolean>((resolve) => {
            setPendingConfirm({ count, resolve })
          }),
        signal: ac.signal,
      })

      if (outcome.kind === "user_cancelled_clear") {
        appendLog("[i] El usuario canceló el vaciado de la carpeta destino.")
        finishProcessing(EMPTY_SUMMARY, "idle")
        return
      }

      if (outcome.kind === "cancelled") {
        appendLog(
          `[i] Proceso detenido. Procesados ${outcome.summary.success}, ` +
            `con error ${outcome.summary.failed}.`
        )
        finishProcessing(outcome.summary, "stopped")
        return
      }

      const s = outcome.summary
      appendLog(
        `==============================================\n` +
          `>> Completado en ${(s.totalMs / 1000).toFixed(1)}s — ` +
          `${s.success} exitosos, ${s.failed} con errores.`
      )
      if (s.failedFiles.length > 0) {
        for (const f of s.failedFiles) {
          appendLog(`   [ERR] ${f.name}: ${f.error}`)
        }
      }

      const finalStatus =
        s.success === 0 && s.failed > 0 ? "error" : "done"
      finishProcessing(s, finalStatus)

      if (finalStatus === "done") {
        if (s.failed === 0) {
          toast.success(`Procesados ${s.success} archivo(s) sin errores.`)
        } else {
          toast.warning(
            `Procesados ${s.success}, con ${s.failed} error(es). ` +
              `Revisa el log para más detalles.`
          )
        }
      } else {
        toast.error(
          `Falló el procesamiento de los ${s.failed} archivo(s). Revisa el log.`
        )
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      appendLog(`[FATAL] ${msg}`)
      toast.error(`Error fatal: ${msg}`)
      finishProcessing(EMPTY_SUMMARY, "error")
    } finally {
      runningRef.current = false
    }
  }

  function handleStop() {
    cancelProcessing()
    setStatus("running") // sigue en running hasta que el archivo en curso termine
    appendLog("[i] Detener solicitado. Esperando a que termine el archivo actual…")
  }

  const isRunning = status === "running"
  const statusLabel = STATUS_LABELS[status] ?? status
  const statusColor = STATUS_COLORS[status] ?? "text-muted-foreground"
  const progressPct = progress
    ? Math.round(((progress.current - 1) / Math.max(progress.total, 1)) * 100)
    : 0
  const showSummaryPanel =
    summary !== null && (status === "done" || status === "stopped" || status === "error")
  const processedCount = summary ? summary.success + summary.failed : 0

  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-4">
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-muted-foreground">Estado:</span>
          <span className={`text-sm font-medium ${statusColor}`}>
            {statusLabel}
          </span>

          {status === "done" && summary && (
            <span
              className={`text-sm font-medium ${
                summary.failed === 0 ? "text-success" : "text-warning"
              }`}
            >
              {summary.failed === 0
                ? `${summary.success} exitosos`
                : `${summary.success} exitosos, ${summary.failed} con errores`}
            </span>
          )}
          {status === "stopped" && summary && (
            <span className="text-sm text-muted-foreground">
              {summary.success} procesados antes de detener.
            </span>
          )}

          {log.length > 0 && (
            <Sheet open={logOpen} onOpenChange={setLogOpen}>
              <SheetTrigger
                render={
                  <button className="flex items-center gap-1 text-xs text-primary underline-offset-3 hover:underline" />
                }
              >
                <FileText className="size-3.5" />
                Ver log de ejecución
              </SheetTrigger>
              <SheetContent side="right" className="w-full sm:max-w-xl">
                <SheetHeader className="flex flex-row items-center justify-between gap-2 pr-8">
                  <SheetTitle>Log de ejecución</SheetTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopyLog}
                    disabled={log.length === 0}
                    aria-label="Copiar log"
                  >
                    <Copy className="mr-1.5 size-3.5" />
                    {copied ? "Copiado ✓" : "Copiar log"}
                  </Button>
                </SheetHeader>
                <div className="mt-4 flex-1 overflow-y-auto px-4">
                  <pre className="rounded-lg bg-muted p-3 text-xs leading-relaxed text-muted-foreground whitespace-pre-wrap break-words font-mono">
                    {log.join("\n")}
                  </pre>
                </div>
              </SheetContent>
            </Sheet>
          )}
        </div>

        <div className="flex gap-2 sm:flex-row sm:justify-end">
          <Button
            onClick={handleStop}
            disabled={!isRunning}
            variant="outline"
            className="flex-1 sm:flex-none"
            aria-label="Detener proceso"
          >
            <Square className="mr-1.5 size-4" />
            Detener
          </Button>
          <Button
            onClick={handleRun}
            disabled={isRunning}
            className="flex-1 sm:flex-none"
            aria-label="Ejecutar proceso"
          >
            <Play className="mr-1.5 size-4" />
            Ejecutar proceso
          </Button>
        </div>
      </div>

      {isRunning && progress && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span className="truncate">
              Procesando archivo {progress.current} de {progress.total}:{" "}
              <span className="font-mono text-foreground">
                {progress.currentName}
              </span>
            </span>
            <span className="shrink-0 tabular-nums">
              {progressPct}%
            </span>
          </div>
          <Progress value={progressPct} />
        </div>
      )}

      {showSummaryPanel && summary && (
        <div className="space-y-1 border-t border-border/50 pt-3 text-sm">
          <div className="text-muted-foreground">
            Procesados:{" "}
            <span className="text-foreground">
              {processedCount} {processedCount === 1 ? "archivo" : "archivos"}
            </span>
            {summary.totalBytes > 0 && (
              <>
                {" · "}
                <span className="text-foreground">
                  {formatBytes(summary.totalBytes)} total
                </span>
              </>
            )}
          </div>
          <div className="text-muted-foreground">
            Tiempo:{" "}
            <span className="text-foreground tabular-nums">
              {(summary.totalMs / 1000).toFixed(1)}s
            </span>
            {processedCount > 0 && (
              <>
                {" "}
                <span className="text-muted-foreground/80">
                  ({(summary.averageMs / 1000).toFixed(1)}s promedio)
                </span>
              </>
            )}
          </div>
          <div className="text-muted-foreground">
            Resultado:{" "}
            <span className="font-medium text-success">
              {summary.success} {summary.success === 1 ? "exitoso" : "exitosos"}
            </span>
            {summary.failed > 0 && (
              <>
                {", "}
                <span className="font-medium text-warning">
                  {summary.failed} {summary.failed === 1 ? "fallido" : "fallidos"}
                </span>
              </>
            )}
          </div>

          {summary.failedFiles.length > 0 && (
            <div className="pt-1">
              <div className="text-muted-foreground">Errores:</div>
              <ul className="mt-1 space-y-0.5">
                {summary.failedFiles.map((f) => (
                  <li
                    key={f.name}
                    className="font-mono text-xs"
                  >
                    <span className="text-muted-foreground">• {f.name}</span>
                    {" — "}
                    <span className="text-destructive/80" title={f.error}>
                      {truncate(f.error, 60)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <ConfirmClearDialog
        open={pendingConfirm !== null}
        folderName={targetFolderName}
        filesCount={pendingConfirm?.count ?? 0}
        onConfirm={() => resolveConfirm(true)}
        onCancel={() => resolveConfirm(false)}
      />
    </div>
  )
}
