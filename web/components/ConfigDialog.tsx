"use client"

import { useState } from "react"
import { Settings } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Separator } from "@/components/ui/separator"
import { TAXONOMY_CHOICES } from "@/lib/constants"
import { useAppStore } from "@/lib/store"

export function ConfigDialog() {
  const modelSetup = useAppStore((s) => s.modelSetup)
  const setModelSetup = useAppStore((s) => s.setModelSetup)

  const [open, setOpen] = useState(false)
  const [periodColumn, setPeriodColumn] = useState(modelSetup.periodColumn)
  const [yearColumn, setYearColumn] = useState(modelSetup.yearColumn)
  const [taxonomy, setTaxonomy] = useState(modelSetup.taxonomy)

  function handleOpen(isOpen: boolean) {
    if (isOpen) {
      setPeriodColumn(modelSetup.periodColumn)
      setYearColumn(modelSetup.yearColumn)
      setTaxonomy(modelSetup.taxonomy)
    }
    setOpen(isOpen)
  }

  function handleSave() {
    if (!periodColumn.trim() || !yearColumn.trim()) return
    setModelSetup({ periodColumn: periodColumn.trim(), yearColumn: yearColumn.trim(), taxonomy })
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger
        render={<Button variant="outline" size="sm" aria-label="Abrir configuración" />}
      >
        <Settings className="mr-1.5 size-3.5" />
        Configuración
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg ring-0 border dialog-brand-glow">
        <DialogHeader>
          <DialogTitle>Configuración del modelo de datos</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cfg-period-col">Campo Mes</Label>
              <Input
                id="cfg-period-col"
                value={periodColumn}
                onChange={(e) => setPeriodColumn(e.target.value)}
                placeholder="Mes corto"
                className="dark:bg-card dark:border-border/80"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cfg-year-col">Campo Año</Label>
              <Input
                id="cfg-year-col"
                value={yearColumn}
                onChange={(e) => setYearColumn(e.target.value)}
                placeholder="Año"
                className="dark:bg-card dark:border-border/80"
              />
            </div>
          </div>

          <Separator />

          <div className="flex flex-col gap-2">
            <Label className="text-sm font-medium">Taxonomía de meses</Label>
            <p className="text-xs text-muted-foreground">
              Elige una opción. Los ejemplos muestran solo el mes tal como se
              vería en el filtro (sin año en esta lista).
            </p>
            <RadioGroup
              value={taxonomy}
              onValueChange={(val) => { if (val) setTaxonomy(val) }}
              className="mt-1 gap-0.5"
            >
              {TAXONOMY_CHOICES.map((choice) => (
                <div
                  key={choice.id}
                  className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted/50"
                >
                  <RadioGroupItem value={choice.id} id={`tax-${choice.id}`} />
                  <Label
                    htmlFor={`tax-${choice.id}`}
                    className="flex flex-1 cursor-pointer items-center gap-4"
                  >
                    <span className="min-w-[5rem] text-lg font-semibold text-primary">
                      {choice.labelSinAnio}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {choice.description}
                    </span>
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={!periodColumn.trim() || !yearColumn.trim()}
          >
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
