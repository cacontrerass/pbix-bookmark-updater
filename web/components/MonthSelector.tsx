"use client"

import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { MESES_CORTOS } from "@/lib/constants"
import { useAppStore } from "@/lib/store"

export function MonthSelector() {
  const mesNuevo = useAppStore((s) => s.mesNuevo)
  const setMesNuevo = useAppStore((s) => s.setMesNuevo)

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="mes-nuevo">Mes nuevo</Label>
      <Select
        value={mesNuevo}
        onValueChange={(value) => {
          if (value) setMesNuevo(value)
        }}
      >
        <SelectTrigger id="mes-nuevo" className="w-full">
          <SelectValue placeholder="Seleccionar mes…" />
        </SelectTrigger>
        <SelectContent>
          {MESES_CORTOS.map((mes) => (
            <SelectItem key={mes} value={mes}>
              {mes}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
