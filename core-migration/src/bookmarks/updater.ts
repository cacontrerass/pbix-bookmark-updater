// Puerto de bookmarks_updater.aplicar_reglas_a_bookmark_dict y helpers.
// Toda la lógica de reglas (sufijos, BYTD, BP) vive aquí.

import type { ModelSetup, JsonValue, JsonObject } from "../pbix/types.js";
import { normalizeModelSetup } from "./taxonomy.js";
import {
  desplazarMes,
  desplazarMesYAnioCalendario,
  formatPeriodFilterValue,
  pickOutputTaxonomy,
  yearDisplay,
} from "./shifting.js";
import { daxLiteralValue, buildBytdValues } from "./dax.js";

// ---------------------------------------------------------------------------
// Helpers de travesía JSON (iter_dict_or_list y get_first_from de Python)
// ---------------------------------------------------------------------------

/** Devuelve array de valores si es objeto, o el array directamente, o []. */
function iterDictOrList(obj: JsonValue): JsonValue[] {
  if (Array.isArray(obj)) return obj;
  if (obj !== null && typeof obj === "object") return Object.values(obj);
  return [];
}

/** Primer elemento de una lista, o primer valor de un objeto. */
function getFirst(obj: JsonValue): JsonValue | null {
  if (Array.isArray(obj)) return obj.length > 0 ? obj[0] : null;
  if (obj !== null && typeof obj === "object") {
    const vals = Object.values(obj);
    return vals.length > 0 ? vals[0] : null;
  }
  return null;
}

/** Acceso seguro a una ruta de claves anidadas en un objeto. */
function getIn(obj: JsonValue, ...keys: string[]): JsonValue | null {
  let cur: JsonValue = obj;
  for (const k of keys) {
    if (cur === null || typeof cur !== "object" || Array.isArray(cur)) return null;
    cur = (cur as JsonObject)[k] ?? null;
    if (cur === undefined) return null;
  }
  return cur;
}

// ---------------------------------------------------------------------------
// Travesía del árbol explorationState del bookmark
//
// Ruta: data.explorationState.sections → visualContainers
//       → singleVisual.objects.merge[].properties.filter.filter
//       → Where[0].Condition.In.Expressions[0].Column.Property
//
// Puerto de _forzar_period_month_single_value y _forzar_anio_unico en Python.
// ---------------------------------------------------------------------------

/**
 * Para cada visual del bookmark que tenga un filtro de selección única
 * sobre `columnProperty`, aplica `patchFn` al objeto Values.
 * Retorna true si se modificó al menos un filtro.
 */
function patchSingleValueFilters(
  data: JsonObject,
  columnProperty: string,
  patchFn: (
    valuesArr: JsonValue[],
    inObj: JsonObject,
  ) => boolean,
): boolean {
  let changed = false;

  const sections = iterDictOrList(getIn(data, "explorationState", "sections"));

  for (const sec of sections) {
    if (sec === null || typeof sec !== "object" || Array.isArray(sec)) continue;

    const vcs = iterDictOrList(getIn(sec, "visualContainers"));

    for (const vc of vcs) {
      if (vc === null || typeof vc !== "object" || Array.isArray(vc)) continue;

      // merge es un dict con clave "general" → [{properties: ...}]
      // Puerto exacto de bookmarks_updater._forzar_period_month_single_value (línea 303-308)
      const mergeVal = getIn(vc, "singleVisual", "objects", "merge");
      if (mergeVal === null || typeof mergeVal !== "object" || Array.isArray(mergeVal)) continue;
      const mergeObj = mergeVal as JsonObject;

      const generalArr = iterDictOrList(mergeObj["general"] ?? null);

      for (const g of generalArr) {
        if (g === null || typeof g !== "object" || Array.isArray(g)) continue;

        const filterObj = getIn(g, "properties", "filter", "filter");
        if (filterObj === null || typeof filterObj !== "object" || Array.isArray(filterObj)) continue;
        const filter = filterObj as JsonObject;

        const firstWhere = getFirst(filter["Where"] ?? null);
        if (firstWhere === null || typeof firstWhere !== "object" || Array.isArray(firstWhere)) continue;
        const where = firstWhere as JsonObject;

        const cond = where["Condition"];
        if (cond === null || typeof cond !== "object" || Array.isArray(cond)) continue;
        const condObj = cond as JsonObject;

        const inVal = condObj["In"];
        if (inVal === null || typeof inVal !== "object" || Array.isArray(inVal)) continue;
        const inObj = inVal as JsonObject;

        const exprs = iterDictOrList(inObj["Expressions"] ?? null);
        const firstExpr = getFirst(exprs.length > 0 ? exprs : null);
        if (firstExpr === null || typeof firstExpr !== "object" || Array.isArray(firstExpr)) continue;

        const col = getIn(firstExpr, "Column") as JsonObject | null;
        if (!col || col["Property"] !== columnProperty) continue;

        const values = inObj["Values"];
        if (!Array.isArray(values)) continue;

        if (patchFn(values, inObj)) changed = true;
      }
    }
  }

  return changed;
}

// ---------------------------------------------------------------------------
// Forzar filtro de período (un solo valor)
// Puerto de bookmarks_updater._forzar_period_month_single_value()
// ---------------------------------------------------------------------------

function forzarPeriodMonthSingleValue(
  data: JsonObject,
  mesKey: string,
  anioForPeriodFormat: string,
  model: ModelSetup,
): boolean {
  if (!mesKey) return false;

  const tax = pickOutputTaxonomy(model.taxonomy_ids, anioForPeriodFormat);
  const inner = formatPeriodFilterValue(mesKey, anioForPeriodFormat, tax);
  const nuevoLiteral = daxLiteralValue(inner);

  return patchSingleValueFilters(
    data,
    model.period_column_property,
    (values) => {
      // Solo actúa cuando hay exactamente un valor seleccionado
      if (values.length !== 1) return false;
      const v = values[0];
      if (!Array.isArray(v) || v.length === 0) return false;
      const literal = getIn(v[0] as JsonValue, "Literal", "Value");
      if (typeof literal !== "string") return false;
      if (literal === nuevoLiteral) return false;
      ((v[0] as JsonObject)["Literal"] as JsonObject)["Value"] = nuevoLiteral;
      return true;
    },
  );
}

// ---------------------------------------------------------------------------
// Forzar filtro de año (un solo valor)
// Puerto de bookmarks_updater._forzar_anio_unico()
// ---------------------------------------------------------------------------

function forzarAnioUnico(
  data: JsonObject,
  anioNuevo: string,
  yearProperty: string,
): boolean {
  if (!anioNuevo) return false;

  return patchSingleValueFilters(
    data,
    yearProperty,
    (values) => {
      if (values.length !== 1) return false;
      const v = values[0];
      if (!Array.isArray(v) || v.length === 0) return false;
      const lit = getIn(v[0] as JsonValue, "Literal", "Value");
      if (typeof lit !== "string") return false;
      if (lit === anioNuevo) return false;
      ((v[0] as JsonObject)["Literal"] as JsonObject)["Value"] = anioNuevo;
      return true;
    },
  );
}

// ---------------------------------------------------------------------------
// Actualizar filtro BYTD (selección múltiple)
// Puerto de bookmarks_updater._actualizar_bytd_en_objeto()
// ---------------------------------------------------------------------------

function actualizarBytdEnObjeto(
  data: JsonObject,
  mesesBytd: string[],
  model: ModelSetup,
  anioNuevo: string,
): boolean {
  if (!mesesBytd.length) return false;

  const tax = pickOutputTaxonomy(model.taxonomy_ids, anioNuevo);
  let changed = false;

  const sections = iterDictOrList(getIn(data, "explorationState", "sections"));

  for (const sec of sections) {
    if (sec === null || typeof sec !== "object" || Array.isArray(sec)) continue;

    const vcs = iterDictOrList(getIn(sec, "visualContainers"));
    for (const vc of vcs) {
      if (vc === null || typeof vc !== "object" || Array.isArray(vc)) continue;

      // merge["general"] sigue la misma estructura que en patchSingleValueFilters
      const mergeValB = getIn(vc, "singleVisual", "objects", "merge");
      if (mergeValB === null || typeof mergeValB !== "object" || Array.isArray(mergeValB)) continue;
      const mergeObjB = mergeValB as JsonObject;
      const generalArrB = iterDictOrList(mergeObjB["general"] ?? null);

      for (const g of generalArrB) {
        if (g === null || typeof g !== "object" || Array.isArray(g)) continue;

        const filterObj = getIn(g, "properties", "filter", "filter");
        if (filterObj === null || typeof filterObj !== "object" || Array.isArray(filterObj)) continue;
        const filter = filterObj as JsonObject;

        const firstWhere = getFirst(filter["Where"] ?? null);
        if (firstWhere === null || typeof firstWhere !== "object" || Array.isArray(firstWhere)) continue;
        const where = firstWhere as JsonObject;

        const cond = where["Condition"];
        if (cond === null || typeof cond !== "object" || Array.isArray(cond)) continue;
        const condObj = cond as JsonObject;

        // Colapso Not.In → In (bookmarks con selección negativa en la UI de PBI)
        const notExpr = condObj["Not"];
        if (notExpr !== null && typeof notExpr === "object" && !Array.isArray(notExpr)) {
          const innerIn = getIn(notExpr as JsonObject, "Expression", "In");
          if (innerIn !== null) {
            // Reemplazar condObj: quitar "Not", poner "In"
            delete condObj["Not"];
            condObj["In"] = innerIn;
          }
        }

        const inVal = condObj["In"];
        if (inVal === null || typeof inVal !== "object" || Array.isArray(inVal)) continue;
        const inObj = inVal as JsonObject;

        const exprs = iterDictOrList(inObj["Expressions"] ?? null);
        const firstExpr = getFirst(exprs.length > 0 ? exprs : null);
        if (firstExpr === null || typeof firstExpr !== "object" || Array.isArray(firstExpr)) continue;

        const col = getIn(firstExpr, "Column") as JsonObject | null;
        if (!col || col["Property"] !== model.period_column_property) continue;

        // Reconstruir Values con los meses BYTD
        const newValues = buildBytdValues(
          mesesBytd.map((m) => formatPeriodFilterValue(m, anioNuevo, tax)),
        );

        if (JSON.stringify(inObj["Values"]) !== JSON.stringify(newValues)) {
          inObj["Values"] = newValues as JsonValue;
          changed = true;
        }
      }
    }
  }

  if (changed) {
    const etiquetas = mesesBytd.map((m) =>
      formatPeriodFilterValue(m, anioNuevo, tax),
    );
    console.log(`  -> Bookmark BYTD actualizado: ${etiquetas.join(", ")}`);
  }

  return changed;
}

// ---------------------------------------------------------------------------
// Punto de entrada principal
// Puerto de bookmarks_updater.aplicar_reglas_a_bookmark_dict()
// ---------------------------------------------------------------------------

/**
 * Aplica las reglas de actualización de bookmarks al dict `data` (in-place).
 * Retorna true si se modificó algo.
 *
 * @param data        - Objeto JSON del bookmark (mutado in-place)
 * @param mesNuevo    - Mes destino (ej. "Nov")
 * @param anioNuevo   - Año destino con sufijo L (ej. "2026L") o ""
 * @param mesesBytd   - Lista de meses para bookmarks _BYTD
 * @param etiquetaLog - Texto para el prefijo de logs (ej. "bookmark[1] RESU_restablecer")
 * @param modelSetup  - Configuración del modelo (columnas y taxonomía)
 */
export function aplicarReglasABookmarkDict(
  data: JsonObject,
  mesNuevo: string,
  anioNuevo: string,
  mesesBytd: string[] = [],
  etiquetaLog = "",
  modelSetup?: Partial<ModelSetup> | null,
): boolean {
  const model = normalizeModelSetup(modelSetup);
  const periodCol = model.period_column_property;
  const yearCol   = model.year_column_property;

  const prefix = etiquetaLog ? `[${etiquetaLog}] ` : "";

  // Leer displayName para decidir la regla
  const displayName = typeof data["displayName"] === "string" ? data["displayName"] : "";

  // Regla _NEDIT: no modificar
  if (displayName.endsWith("_NEDIT")) {
    console.log(`${prefix}-> Bookmark NO editable (_NEDIT): '${displayName}'`);
    return false;
  }

  const esBytd = displayName.endsWith("_BYTD");
  const esBp1  = displayName.endsWith("_BP-1");
  const esBp2  = displayName.endsWith("_BP-2");

  let cambioMes  = false;
  let cambioAnio = false;
  let bytdChanged = false;
  // Bandera: BP con año ya calculó el año desplazado; no repetir el año global
  let bpConAnioEvitaAnioGlobal = false;

  // --- Filtro de Mes (no aplica a BYTD) ---
  if (!esBytd && mesNuevo) {
    if (esBp1 || esBp2) {
      const offset     = esBp1 ? -1 : -2;
      const etiquetaBp = esBp1 ? "BP-1" : "BP-2";
      let mesObjetivo  = "";

      if (anioNuevo) {
        try {
          const shifted = desplazarMesYAnioCalendario(mesNuevo, anioNuevo, offset);
          mesObjetivo = shifted.mes;
          const anioBp = shifted.anio;
          bpConAnioEvitaAnioGlobal = true;

          cambioMes = forzarPeriodMonthSingleValue(data, mesObjetivo, anioBp, model);
          if (cambioMes) {
            const inner = formatPeriodFilterValue(
              mesObjetivo,
              anioBp,
              pickOutputTaxonomy(model.taxonomy_ids, anioBp),
            );
            console.log(
              `${prefix}-> Periodo (${periodCol}) (${etiquetaBp}, calendario): ${inner}.`,
            );
          }

          cambioAnio = forzarAnioUnico(data, anioBp, yearCol);
          if (cambioAnio) {
            console.log(`${prefix}-> ${yearCol} (${etiquetaBp}, calendario): ${anioBp}.`);
          }
        } catch {
          // Si el año no es parseable, caer al desplazamiento cíclico sin año
          try { mesObjetivo = desplazarMes(mesNuevo, offset); } catch { mesObjetivo = ""; }
          if (mesObjetivo) {
            cambioMes = forzarPeriodMonthSingleValue(data, mesObjetivo, anioNuevo, model);
            if (cambioMes) {
              console.log(
                `${prefix}-> Periodo (${periodCol}) (${etiquetaBp}): ${mesObjetivo}.`,
              );
            }
          }
        }
      } else {
        try { mesObjetivo = desplazarMes(mesNuevo, offset); } catch { mesObjetivo = ""; }
        if (mesObjetivo) {
          cambioMes = forzarPeriodMonthSingleValue(data, mesObjetivo, "", model);
          if (cambioMes) {
            console.log(
              `${prefix}-> Periodo (${periodCol}) (${etiquetaBp}): ${mesObjetivo}.`,
            );
          }
        }
      }
    } else {
      // Regla normal (sin sufijo especial)
      cambioMes = forzarPeriodMonthSingleValue(data, mesNuevo, anioNuevo, model);
      if (cambioMes) {
        const inner = formatPeriodFilterValue(
          mesNuevo,
          anioNuevo,
          pickOutputTaxonomy(model.taxonomy_ids, anioNuevo),
        );
        console.log(`${prefix}-> Periodo (${periodCol}) (normal): ${inner}.`);
      }
    }
  }

  // --- Filtro de Año ---
  if (anioNuevo) {
    if (esBytd) {
      const ca = forzarAnioUnico(data, anioNuevo, yearCol);
      if (ca) {
        cambioAnio = true;
        console.log(`${prefix}-> ${yearCol}: ${anioNuevo}.`);
      }
    } else if (!bpConAnioEvitaAnioGlobal) {
      const ca = forzarAnioUnico(data, anioNuevo, yearCol);
      if (ca) {
        cambioAnio = true;
        console.log(`${prefix}-> ${yearCol}: ${anioNuevo}.`);
      }
    }
  }

  // --- Meses BYTD ---
  if (esBytd && mesesBytd.length > 0) {
    bytdChanged = actualizarBytdEnObjeto(data, mesesBytd, model, anioNuevo);
  }

  return Boolean(cambioMes || cambioAnio || bytdChanged);
}
