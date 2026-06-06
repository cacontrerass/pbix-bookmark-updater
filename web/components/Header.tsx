"use client"

import { ConfigDialog } from "./ConfigDialog"
import { InfoDialog } from "./InfoDialog"

export function Header() {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
      <div className="min-w-0 flex-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Actualización de Bookmarks · Power BI
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          PBIX directo (ZIP) — Layout legacy o definición bookmarks
        </p>
      </div>

      <div className="flex w-full gap-2 md:w-auto md:gap-3">
        <ConfigDialog triggerClassName="flex-1 md:flex-none" />
        <InfoDialog triggerClassName="flex-1 md:flex-none" />
      </div>
    </div>
  )
}
