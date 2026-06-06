// Lógica de desplazamiento de mes/año y formateo de valores de período
// Puerto de bookmarks_updater.py: desplazar_mes, desplazar_mes_y_anio_calendario,
// format_period_filter_value, pick_output_taxonomy, etc.

import type { TaxonomyId } from "../pbix/types.js";
import {
  MESES_CORTOS,
  MESES_LARGOS_ES,
  MESES_LARGOS_ES_CAP,
  MESES_LARGOS_EN,
  MESES_CORTOS_EN,
  ORDERED_TAXONOMY_IDS,
} from "./taxonomy.js";

// ---------------------------------------------------------------------------
// Helpers de año literal ("2026L")
// ---------------------------------------------------------------------------

/** Quita el sufijo "L" para mostrar al usuario. "2026L" → "2026". */
export function yearDisplay(anioLiteral: string): string {
  const s = String(anioLiteral ?? "").trim();
  return s.endsWith("L") ? s.slice(0, -1) : s;
}

/**
 * Parsea un literal de año tipo "2025L" o "2025".
 * Puerto de bookmarks_updater._parse_anio_literal().
 */
export function parseAnioLiteral(anioLiteral: string): { anio: number; sufijo: string } {
  const s = String(anioLiteral).trim();
  if (!s) throw new Error("año vacío");
  if (s.endsWith("L")) return { anio: parseInt(s.slice(0, -1), 10), sufijo: "L" };
  return { anio: parseInt(s, 10), sufijo: "" };
}

// ---------------------------------------------------------------------------
// Desplazamiento de meses
// ---------------------------------------------------------------------------

/**
 * Desplaza el mes offset posiciones en el ciclo de 12 meses (puede cambiar de año
 * cíclicamente pero NO devuelve el nuevo año).
 * Puerto de bookmarks_updater.desplazar_mes().
 */
export function desplazarMes(mes: string, offset: number): string {
  const idx = (MESES_CORTOS as readonly string[]).indexOf(mes);
  if (idx === -1) throw new Error(`Mes desconocido: ${mes}`);
  // Módulo positivo garantizado (JS % puede ser negativo)
  const newIdx = ((idx + offset) % 12 + 12) % 12;
  return MESES_CORTOS[newIdx];
}

/**
 * Desplaza mes y año de forma continua (cruza año si es necesario).
 * Puerto de bookmarks_updater.desplazar_mes_y_anio_calendario().
 * Ej.: ("Feb", "2025L", -2) → { mes: "Dic", anio: "2024L" }
 */
export function desplazarMesYAnioCalendario(
  mes: string,
  anioLiteral: string,
  delta: number,
): { mes: string; anio: string } {
  const { anio: yearNum, sufijo } = parseAnioLiteral(anioLiteral);
  const idx = (MESES_CORTOS as readonly string[]).indexOf(mes);
  if (idx === -1) throw new Error(`Mes desconocido: ${mes}`);

  const total = yearNum * 12 + idx + delta;
  const newYear = Math.floor(total / 12);
  const newIdx  = ((total % 12) + 12) % 12;

  return {
    mes:  MESES_CORTOS[newIdx],
    anio: sufijo ? `${newYear}${sufijo}` : String(newYear),
  };
}

// ---------------------------------------------------------------------------
// Taxonomía y formateo
// ---------------------------------------------------------------------------

/**
 * True para las taxonomías que requieren año en el literal del filtro.
 * Puerto de bookmarks_updater.taxonomy_requires_year().
 */
export function taxonomyRequiresYear(tid: TaxonomyId): boolean {
  return tid !== "es_short_only" && tid !== "month_number";
}

/**
 * Elige el primer TaxonomyId aplicable según ORDERED_TAXONOMY_IDS.
 * Si el seleccionado requiere año y no hay año, hace fallback a "es_short_only".
 * Puerto de bookmarks_updater.pick_output_taxonomy().
 */
export function pickOutputTaxonomy(tids: TaxonomyId[], anioLiteral: string): TaxonomyId {
  const selected = new Set(tids);
  const hasYear = Boolean(yearDisplay(anioLiteral));
  for (const tid of ORDERED_TAXONOMY_IDS) {
    if (!selected.has(tid)) continue;
    if (taxonomyRequiresYear(tid) && !hasYear) continue;
    return tid;
  }
  return "es_short_only";
}

/**
 * Devuelve el texto INNER del literal DAX (sin comillas envolventes).
 * Puerto de bookmarks_updater.format_period_filter_value().
 * Ej.: ("Nov", "2026L", "es_long_cap_year") → "Noviembre 2026"
 *       ("Nov", "2026L", "es_short_only")    → "Nov"
 */
export function formatPeriodFilterValue(
  mes: string,
  anioLiteral: string,
  tid: TaxonomyId,
): string {
  const idx = (MESES_CORTOS as readonly string[]).indexOf(mes);
  if (idx === -1) return mes; // mes desconocido: devolver tal cual

  const ydisp = yearDisplay(anioLiteral);

  switch (tid) {
    case "es_short_only":
      return mes;

    case "es_short_lower_year":
      return ydisp ? `${mes.toLowerCase()} ${ydisp}` : mes.toLowerCase();

    case "es_long_cap_year":
      return ydisp ? `${MESES_LARGOS_ES_CAP[idx]} ${ydisp}` : MESES_LARGOS_ES_CAP[idx];

    case "es_long_lower_year":
      return ydisp ? `${MESES_LARGOS_ES[idx]} ${ydisp}` : MESES_LARGOS_ES[idx];

    case "en_short_cap_year":
      return ydisp ? `${MESES_CORTOS_EN[idx]} ${ydisp}` : MESES_CORTOS_EN[idx];

    case "en_short_lower_year": {
      const low = MESES_CORTOS_EN[idx].toLowerCase();
      return ydisp ? `${low} ${ydisp}` : low;
    }

    case "en_long_year":
      return ydisp ? `${MESES_LARGOS_EN[idx]} ${ydisp}` : MESES_LARGOS_EN[idx];

    case "month_number":
      return String(idx + 1);

    default:
      return mes;
  }
}
