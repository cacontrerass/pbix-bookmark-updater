"use client"

import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { useAppStore } from "@/lib/store"

export function YearInput() {
  const anioNuevo = useAppStore((s) => s.anioNuevo)
  const setAnioNuevo = useAppStore((s) => s.setAnioNuevo)

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="anio-nuevo">Año nuevo</Label>
      <Input
        id="anio-nuevo"
        type="number"
        placeholder="2026"
        value={anioNuevo}
        min={2000}
        max={2099}
        onChange={(e) => setAnioNuevo(e.target.value)}
        className="w-full"
      />
    </div>
  )
}
