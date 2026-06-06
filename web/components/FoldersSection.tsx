"use client"

import { FolderOpen } from "lucide-react"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { useAppStore } from "@/lib/store"
import {
  pickInputFolder,
  pickOutputFolder,
  listPbixFiles,
} from "@/lib/fs/fileSystemAccess"
import { formatBytes } from "@/lib/utils"
import { useIsTouchDevice } from "@/lib/device"

const MOBILE_BROWSE_HINT =
  "Requiere un computador con Chrome o Edge. No disponible en dispositivos móviles."

export function FoldersSection() {
  const isMobile = useIsTouchDevice()
  const sourceFolderHandle = useAppStore((s) => s.sourceFolderHandle)
  const sourceFolderName = useAppStore((s) => s.sourceFolderName)
  const sourceFiles = useAppStore((s) => s.sourceFiles)
  const targetFolderHandle = useAppStore((s) => s.targetFolderHandle)
  const targetFolderName = useAppStore((s) => s.targetFolderName)
  const setSourceFolder = useAppStore((s) => s.setSourceFolder)
  const setTargetFolder = useAppStore((s) => s.setTargetFolder)

  async function handleBrowseSource() {
    try {
      const handle = await pickInputFolder()
      if (!handle) return
      try {
        const files = await listPbixFiles(handle)
        setSourceFolder(handle, files)
      } catch {
        toast.error("Error al leer la carpeta. Intenta seleccionarla nuevamente.")
      }
    } catch {
      toast.error(
        "No se pudo abrir el selector de carpetas. Verifica que tu navegador esté actualizado."
      )
    }
  }

  async function handleBrowseTarget() {
    try {
      const handle = await pickOutputFolder()
      if (!handle) return
      setTargetFolder(handle)
    } catch {
      toast.error(
        "No se pudo abrir el selector de carpetas. Verifica que tu navegador esté actualizado."
      )
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Rutas de archivos .pbix</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="source-folder">Carpeta de entrada (origen)</Label>
          <div className="flex gap-2">
            <Input
              id="source-folder"
              readOnly
              value={sourceFolderName ?? ""}
              placeholder="Ninguna carpeta seleccionada…"
              className="flex-1 cursor-default dark:bg-card dark:border-border/80 dark:text-foreground"
            />
            <Button
              variant="outline"
              onClick={handleBrowseSource}
              disabled={isMobile}
              title={isMobile ? MOBILE_BROWSE_HINT : undefined}
              aria-label="Examinar carpeta de origen"
              aria-disabled={isMobile}
              className="shrink-0 border-primary/60 text-primary hover:bg-primary/10 hover:text-primary disabled:pointer-events-auto disabled:cursor-not-allowed disabled:opacity-50"
            >
              <FolderOpen className="mr-1.5 size-4" />
              Examinar…
            </Button>
          </div>
        </div>

        {sourceFolderHandle !== null && sourceFiles.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">
              Archivos .pbix detectados ({sourceFiles.length}):
            </p>
            <div className="max-h-60 overflow-y-auto rounded-md border border-border bg-muted/30">
              <ul className="divide-y divide-border">
                {sourceFiles.map((file) => (
                  <li
                    key={file.name}
                    className="flex items-center justify-between gap-3 px-3 py-1.5 text-sm transition-colors hover:bg-muted/60"
                  >
                    <span className="truncate" title={file.name}>
                      {file.name}
                    </span>
                    <span className="shrink-0 font-mono text-xs text-muted-foreground tabular-nums">
                      {formatBytes(file.size)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {sourceFolderHandle !== null && sourceFiles.length === 0 && (
          <p className="text-xs text-muted-foreground">
            No se encontraron archivos .pbix en esta carpeta.
          </p>
        )}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="target-folder">Carpeta de salida (destino)</Label>
          <div className="flex gap-2">
            <Input
              id="target-folder"
              readOnly
              value={targetFolderName ?? ""}
              placeholder="Ninguna carpeta seleccionada…"
              className="flex-1 cursor-default dark:bg-card dark:border-border/80 dark:text-foreground"
            />
            <Button
              variant="outline"
              onClick={handleBrowseTarget}
              disabled={isMobile}
              title={isMobile ? MOBILE_BROWSE_HINT : undefined}
              aria-label="Examinar carpeta de destino"
              aria-disabled={isMobile}
              className="shrink-0 border-primary/60 text-primary hover:bg-primary/10 hover:text-primary disabled:pointer-events-auto disabled:cursor-not-allowed disabled:opacity-50"
            >
              <FolderOpen className="mr-1.5 size-4" />
              Examinar…
            </Button>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          <strong>Aviso:</strong> la carpeta de destino se vaciará antes de iniciar el proceso.
        </p>
      </CardContent>
    </Card>
  )
}
