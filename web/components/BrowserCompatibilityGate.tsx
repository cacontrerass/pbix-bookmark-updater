"use client"

import { useEffect, useState } from "react"
import { AlertTriangle } from "lucide-react"
import { isFileSystemAccessSupported } from "@/lib/fs/fileSystemAccess"
import { isTouchDevice } from "@/lib/device"

interface Props {
  children: React.ReactNode
}

type CheckState = "checking" | "supported" | "unsupported" | "mobile-preview"

function MobilePreviewBanner() {
  return (
    <div
      role="status"
      className="mx-auto mb-4 w-full max-w-4xl rounded-lg border border-primary/20 bg-primary/10 px-4 py-3 text-sm leading-snug text-foreground"
    >
      📱 Para usar la herramienta necesitas un computador. Esta vista es solo
      para previsualización.
    </div>
  )
}

export function BrowserCompatibilityGate({ children }: Props) {
  const [state, setState] = useState<CheckState>("checking")

  useEffect(() => {
    if (isTouchDevice()) {
      setState("mobile-preview")
      return
    }
    setState(isFileSystemAccessSupported() ? "supported" : "unsupported")
  }, [])

  if (state === "checking") {
    return null
  }

  if (state === "unsupported") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
        <div className="w-full max-w-xl rounded-lg border border-destructive/40 bg-card p-8 shadow-lg">
          <div className="flex flex-col items-center text-center">
            <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle
                className="size-8 text-destructive"
                aria-hidden="true"
              />
            </div>
            <h1 className="text-xl font-semibold tracking-tight">
              Navegador no compatible
            </h1>
            <p className="mt-3 text-sm text-muted-foreground">
              Esta herramienta requiere File System Access API para procesar
              archivos directamente desde carpetas locales sin subirlos a
              internet. Tu navegador actual no la soporta.
            </p>
            <div className="mt-6 w-full rounded-md border border-border bg-muted/30 px-4 py-3 text-left">
              <p className="text-xs font-medium text-foreground">
                Navegadores compatibles
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Google Chrome, Microsoft Edge, Opera, Brave, Arc (versiones
                recientes en escritorio).
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (state === "mobile-preview") {
    return (
      <div className="min-h-screen">
        <div className="px-4 pt-6 sm:px-6 lg:px-8">
          <MobilePreviewBanner />
        </div>
        {children}
      </div>
    )
  }

  return <>{children}</>
}
