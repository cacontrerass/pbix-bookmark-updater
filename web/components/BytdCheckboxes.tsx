"use client"

import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { MESES_CORTOS } from "@/lib/constants"
import { useAppStore } from "@/lib/store"

export function BytdCheckboxes() {
  const mesesBytd = useAppStore((s) => s.mesesBytd)
  const toggleMesBytd = useAppStore((s) => s.toggleMesBytd)

  return (
    <div className="flex flex-col gap-2">
      <Label className="text-sm font-medium">
        Meses BYTD{" "}
        <span className="text-xs font-normal text-muted-foreground">
          (Bookmark Year To Date)
        </span>
      </Label>
      <p className="text-xs text-muted-foreground">
        Meses incluidos en el filtro acumulado para bookmarks _BYTD
      </p>
      <div className="grid grid-cols-3 gap-x-4 gap-y-2 sm:grid-cols-6">
        {MESES_CORTOS.map((mes) => {
          const checked = mesesBytd.has(mes)
          return (
            <div key={mes} className="flex items-center gap-2">
              <Checkbox
                id={`bytd-${mes}`}
                checked={checked}
                onCheckedChange={() => toggleMesBytd(mes)}
              />
              <Label
                htmlFor={`bytd-${mes}`}
                className="cursor-pointer text-sm font-normal"
              >
                {mes}
              </Label>
            </div>
          )
        })}
      </div>
    </div>
  )
}
