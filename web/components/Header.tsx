"use client"

import { Settings, Info } from "lucide-react"
import { ConfigDialog } from "./ConfigDialog"
import { InfoDialog } from "./InfoDialog"

export function Header() {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Actualización de Bookmarks · Power BI
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          PBIX directo (ZIP) — Layout legacy o definición bookmarks
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <ConfigDialog />
        <InfoDialog />
      </div>
    </div>
  )
}
