"use client"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface ConfirmClearDialogProps {
  open: boolean
  folderName: string | null
  filesCount: number
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmClearDialog({
  open,
  folderName,
  filesCount,
  onConfirm,
  onCancel,
}: ConfirmClearDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onCancel()
      }}
    >
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Vaciar carpeta de destino</DialogTitle>
          <DialogDescription>
            La carpeta <strong>{folderName ?? "destino"}</strong> contiene{" "}
            <strong>{filesCount}</strong>{" "}
            {filesCount === 1 ? "elemento" : "elementos"}. Para iniciar el proceso
            se vaciará completamente. ¿Continuar?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={onConfirm}>
            Vaciar y continuar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
