"use client"

import { Info } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"

const SUFFIX_RULES = [
  {
    suffix: "_NEDIT",
    description: "No se modifica. El bookmark se omite completamente.",
    example: "Resumen_Inicial_NEDIT",
  },
  {
    suffix: "_BYTD",
    description:
      "Usa los meses seleccionados en «Meses BYTD» (Bookmark Year To Date) para construir el filtro acumulado de meses. El año se actualiza al valor configurado.",
    example: "Overview_Graphic_BYTD",
  },
  {
    suffix: "_BP-1",
    description:
      "El filtro de mes se desplaza 1 mes hacia atrás (con ajuste de año si es necesario). Útil para comparativas mes anterior.",
    example: "Comparativo_Ventas_BP-1",
  },
  {
    suffix: "_BP-2",
    description:
      "El filtro de mes se desplaza 2 meses hacia atrás. Útil para comparativas de hace dos meses.",
    example: "Comparativo_Ventas_BP-2",
  },
  {
    suffix: "(sin sufijo)",
    description:
      "Se actualiza al mes y año seleccionados en los parámetros principales.",
    example: "Overview_Graphic",
  },
]

export function InfoDialog() {
  return (
    <Dialog>
      <DialogTrigger
        render={<Button variant="outline" size="sm" aria-label="Ver información" />}
      >
        <Info className="mr-1.5 size-3.5" />
        Información
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg ring-0 border dialog-brand-glow">
        <DialogHeader>
          <DialogTitle>Información</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1 text-sm">
          <p className="leading-relaxed text-muted-foreground">
            Esta herramienta actualiza los bookmarks de archivos{" "}
            <strong className="text-foreground">.pbix</strong> (Power BI) sin
            necesidad de abrir Power BI Desktop. Trata el archivo como un ZIP,
            detecta el formato (legacy <code>Report/Layout</code> o moderno{" "}
            <code>Report/definition/bookmarks/</code>) y aplica reglas
            parametrizadas según el nombre de cada bookmark.
          </p>

          <Separator />

          <div className="space-y-2">
            <p className="font-medium text-foreground">Reglas por sufijo del bookmark:</p>
            <ul className="space-y-3">
              {SUFFIX_RULES.map((rule) => (
                <li key={rule.suffix} className="flex items-start gap-2">
                  <code className="mt-0.5 shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                    {rule.suffix}
                  </code>
                  <span className="text-xs leading-relaxed text-muted-foreground">
                    {rule.description}
                    <br />
                    <span className="italic">
                      Ejemplo:{" "}
                      <code className="rounded bg-muted px-1 py-0.5 font-mono not-italic">
                        {rule.example}
                      </code>
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <Separator />

          <p className="text-xs leading-relaxed text-muted-foreground">
            Los bookmarks se procesan en bloque. Si algún archivo falla, el
            proceso continúa con los demás y reporta los errores al finalizar.
            El archivo de destino se genera en la carpeta de salida configurada;
            la carpeta se vacía antes de cada ejecución.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
