import type { TaxonomyChoice } from "./types"

export const MESES_CORTOS: readonly string[] = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
]

export const ORDERED_TAXONOMY_IDS: readonly string[] = [
  "es_short_only",
  "es_short_lower_year",
  "es_long_cap_year",
  "es_long_lower_year",
  "en_short_cap_year",
  "en_short_lower_year",
  "en_long_year",
  "month_number",
]

export const TAXONOMY_CHOICES: readonly TaxonomyChoice[] = [
  {
    id: "es_short_only",
    labelSinAnio: "Ene",
    labelConAnio: "Ene",
    requiresYear: false,
    description: "Mes corto (español, capitalizado)",
  },
  {
    id: "es_short_lower_year",
    labelSinAnio: "ene",
    labelConAnio: "ene 2026",
    requiresYear: true,
    description: "Mes corto (español, minúsculas)",
  },
  {
    id: "es_long_cap_year",
    labelSinAnio: "Enero",
    labelConAnio: "Enero 2026",
    requiresYear: true,
    description: "Mes largo (español, capitalizado)",
  },
  {
    id: "es_long_lower_year",
    labelSinAnio: "enero",
    labelConAnio: "enero 2026",
    requiresYear: true,
    description: "Mes largo (español, minúsculas)",
  },
  {
    id: "en_short_cap_year",
    labelSinAnio: "Jan",
    labelConAnio: "Jan 2026",
    requiresYear: true,
    description: "Mes corto inglés (capitalizado)",
  },
  {
    id: "en_short_lower_year",
    labelSinAnio: "jan",
    labelConAnio: "jan 2026",
    requiresYear: true,
    description: "Mes corto inglés (minúsculas)",
  },
  {
    id: "en_long_year",
    labelSinAnio: "January",
    labelConAnio: "January 2026",
    requiresYear: true,
    description: "Mes largo inglés",
  },
  {
    id: "month_number",
    labelSinAnio: "1",
    labelConAnio: "1",
    requiresYear: false,
    description: "Formato numérico del mes (1 a 12)",
  },
]

export const DEFAULT_MODEL_SETUP = {
  periodColumn: "Mes corto",
  yearColumn: "Año",
  taxonomy: "es_short_only",
} as const

export const EXECUTION_STEPS: readonly string[] = [
  "Configura los campos de Mes y Año del modelo de datos.",
  "Define el mes, año y meses BYTD para actualizar los bookmarks.",
  "Selecciona las carpetas de origen y destino, y ejecuta el proceso.",
]
