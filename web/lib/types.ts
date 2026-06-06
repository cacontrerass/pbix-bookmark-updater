export interface ModelSetup {
  periodColumn: string
  yearColumn: string
  taxonomy: string
}

export type AppStatus = "idle" | "running" | "stopped" | "done" | "error"

export interface TaxonomyChoice {
  id: string
  labelSinAnio: string
  labelConAnio: string
  requiresYear: boolean
  description: string
}
