// Puerto de bookmarks_updater.py: constantes de taxonomía y configuración del modelo
import type { ModelSetup, TaxonomyId } from "../pbix/types.js";

export const MESES_CORTOS = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
] as const;

export const MESES_LARGOS_ES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
] as const;

export const MESES_LARGOS_EN = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

export const MESES_CORTOS_EN = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

export const MESES_LARGOS_ES_CAP = MESES_LARGOS_ES.map(
  (m) => m.charAt(0).toUpperCase() + m.slice(1),
) as string[];

// Orden canónico de taxonomías (la GUI selecciona de a una)
export const ORDERED_TAXONOMY_IDS: TaxonomyId[] = [
  "es_short_only",
  "es_short_lower_year",
  "es_long_cap_year",
  "es_long_lower_year",
  "en_short_cap_year",
  "en_short_lower_year",
  "en_long_year",
  "month_number",
];

// (id, ejemplo sin año, descripción larga) — igual a la GUI Python
export const MONTH_TAXONOMY_CHOICES: [TaxonomyId, string, string][] = [
  ["es_short_only",       "Ene",     "Mes corto (español, capitalizado)"],
  ["es_short_lower_year", "ene",     "Mes corto (español, minúsculas)"],
  ["es_long_cap_year",    "Enero",   "Mes largo (español, capitalizado)"],
  ["es_long_lower_year",  "enero",   "Mes largo (español, minúsculas)"],
  ["en_short_cap_year",   "Jan",     "Mes corto inglés (capitalizado)"],
  ["en_short_lower_year", "jan",     "Mes corto inglés (minúsculas)"],
  ["en_long_year",        "January", "Mes largo inglés"],
  ["month_number",        "1",       "Formato numérico del mes (1 a 12)"],
];

export const DEFAULT_MODEL_SETUP: ModelSetup = {
  period_column_property: "Mes corto",
  year_column_property:   "Año",
  taxonomy_ids:           ["es_short_only"],
};

/**
 * Fusiona la entrada del usuario con los defaults y valida las taxonomías.
 * Migra el ID legacy "es_short_year" → "es_short_only".
 * Puerto de bookmarks_updater.normalize_model_setup().
 */
export function normalizeModelSetup(raw?: Partial<ModelSetup> | null): ModelSetup {
  const valid = new Set<string>(ORDERED_TAXONOMY_IDS);
  const base: ModelSetup = {
    period_column_property: DEFAULT_MODEL_SETUP.period_column_property,
    year_column_property:   DEFAULT_MODEL_SETUP.year_column_property,
    taxonomy_ids:           [...DEFAULT_MODEL_SETUP.taxonomy_ids],
  };
  if (!raw) return base;

  const p = String(raw.period_column_property ?? "").trim();
  const y = String(raw.year_column_property ?? "").trim();
  if (p) base.period_column_property = p;
  if (y) base.year_column_property = y;

  if (Array.isArray(raw.taxonomy_ids)) {
    const migrated = raw.taxonomy_ids.map((x) => {
      const s = String(x).trim();
      // migración ID legacy
      return s === "es_short_year" ? "es_short_only" : s;
    });
    const cleaned = migrated.filter((x) => valid.has(x)) as TaxonomyId[];
    if (cleaned.length > 0) {
      const ordered = ORDERED_TAXONOMY_IDS.filter((id) => cleaned.includes(id));
      base.taxonomy_ids = ordered.length > 0 ? [ordered[0]] : [...DEFAULT_MODEL_SETUP.taxonomy_ids];
    }
  }
  return base;
}
