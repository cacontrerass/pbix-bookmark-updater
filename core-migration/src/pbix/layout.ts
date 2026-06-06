// Manejo del formato legacy de bookmarks: Report/Layout en UTF-16-LE
// Puerto de pbix_layout_pipeline: _decode_layout, _encode_layout, patch_layout_json_string

import type { ModelSetup, JsonObject } from "./types.js";
import { aplicarReglasABookmarkDict } from "../bookmarks/updater.js";

// ---------------------------------------------------------------------------
// Codificación UTF-16-LE (sin BOM)
// MIGRATION NOTE: TextEncoder no soporta UTF-16-LE nativamente en JS.
// Usamos charCodeAt() que devuelve code units (ya en UTF-16), y los escribimos
// en little-endian. Surrogate pairs (caracteres > U+FFFF) son transparentes
// porque charCodeAt() devuelve las dos mitades del par, que se escriben como
// dos palabras de 2 bytes = 4 bytes total, igual que UTF-16-LE de Python.
// ---------------------------------------------------------------------------

/**
 * Decodifica bytes UTF-16-LE (sin BOM) a string.
 * Puerto de pbix_layout_pipeline._decode_layout().
 */
export function decodeLayout(bytes: Uint8Array): string {
  // "utf-16le" ignora BOM por defecto; si el archivo tiene BOM lo procesa
  // como datos. La app Python tampoco añade BOM, así que en la práctica no hay.
  return new TextDecoder("utf-16le").decode(bytes);
}

/**
 * Codifica un string a UTF-16-LE sin BOM.
 * Puerto de pbix_layout_pipeline._encode_layout().
 */
export function encodeLayout(text: string): Uint8Array {
  const buf = new Uint8Array(text.length * 2);
  const view = new DataView(buf.buffer);
  for (let i = 0; i < text.length; i++) {
    view.setUint16(i * 2, text.charCodeAt(i), true); // true = little-endian
  }
  return buf;
}

// ---------------------------------------------------------------------------
// Parche del JSON de Layout (formato legacy)
// ---------------------------------------------------------------------------

export interface PatchLayoutResult {
  nuevoLayoutText: string;
  nModificados: number;
}

/**
 * Aplica las reglas de bookmarks al JSON externo de Report/Layout (formato legacy).
 *
 * El JSON de Layout tiene `outer.config` como STRING que a su vez es JSON.
 * Dentro de ese JSON anidado está `cfg.bookmarks` (array de dicts de bookmark).
 * Cada bookmark se modifica in-place con aplicarReglasABookmarkDict.
 *
 * Puerto de pbix_layout_pipeline.patch_layout_json_string().
 */
export function patchLayoutJsonString(
  layoutText: string,
  mesNuevo: string,
  anioNuevo: string,
  mesesBytd: string[] = [],
  modelSetup?: Partial<ModelSetup> | null,
): PatchLayoutResult {
  const outer = JSON.parse(layoutText) as JsonObject;
  const cfgRaw = outer["config"];
  if (typeof cfgRaw !== "string") {
    throw new Error(
      "El Layout no tiene 'config' como string JSON (formato no soportado por este pipeline).",
    );
  }

  const cfg = JSON.parse(cfgRaw) as JsonObject;
  const bookmarks = cfg["bookmarks"];
  if (!Array.isArray(bookmarks)) {
    throw new Error("La clave config.bookmarks no es una lista.");
  }

  let nModificados = 0;
  for (let idx = 0; idx < bookmarks.length; idx++) {
    const bm = bookmarks[idx];
    if (bm === null || typeof bm !== "object" || Array.isArray(bm)) continue;
    const bmObj = bm as JsonObject;

    const rawLabel = bmObj["displayName"] ?? bmObj["name"] ?? idx;
    const label = String(rawLabel).slice(0, 40);

    if (
      aplicarReglasABookmarkDict(
        bmObj,
        mesNuevo,
        anioNuevo,
        mesesBytd,
        `bookmark[${idx}] ${label}`,
        modelSetup,
      )
    ) {
      nModificados++;
    }
  }

  // Reserializar compacto (separadores sin espacios, Unicode sin escapar)
  cfg["bookmarks"] = bookmarks;
  outer["config"] = JSON.stringify(cfg);

  const nuevoLayoutText = JSON.stringify(outer);

  // Sanity check: verificar que el JSON resultante es válido
  JSON.parse(nuevoLayoutText);

  return { nuevoLayoutText, nModificados };
}
