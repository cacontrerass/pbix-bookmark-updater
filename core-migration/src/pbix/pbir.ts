// Manejo del formato Fabric/PBIR de bookmarks (Report/definition/bookmarks/*.bookmark.json)
// Puerto de pbix_layout_pipeline: _enumerate_pbir_bookmark_members,
// _bookmark_id_from_arc, _pbir_collect_bookmark_replacements

import type { ModelSetup, JsonObject } from "./types.js";
import { aplicarReglasABookmarkDict } from "../bookmarks/updater.js";

// Puerto de pbix_layout_pipeline._norm_arc() — normaliza separadores ZIP
export function normArc(name: string): string {
  return name.replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/+$/, "");
}

const BOOKMARKS_META_SUFFIX = "definition/bookmarks/bookmarks.json";

/**
 * Lista todos los archivos *.bookmark.json bajo el directorio base del ZIP.
 * Puerto de pbix_layout_pipeline._enumerate_pbir_bookmark_members().
 */
export function enumeratePbirBookmarkMembers(
  entryNames: string[],
  baseDir: string,
): string[] {
  const prefix = normArc(baseDir).toLowerCase().replace(/\/$/, "") + "/";
  return entryNames
    .filter((n) => {
      const norm = normArc(n).toLowerCase();
      return norm.startsWith(prefix) && norm.endsWith(".bookmark.json");
    })
    .sort();
}

/**
 * Extrae el ID del bookmark del nombre del archivo (quita .bookmark.json).
 * Puerto de pbix_layout_pipeline._bookmark_id_from_arc().
 */
export function bookmarkIdFromArc(arcname: string): string {
  const base = arcname.replace(/\\/g, "/").split("/").pop() ?? arcname;
  if (base.toLowerCase().endsWith(".bookmark.json")) {
    return base.slice(0, -".bookmark.json".length);
  }
  return base;
}

export interface PbirReplacements {
  replacements: Map<string, Uint8Array>; // clave = arcname exacto
  count: number;                          // bookmarks con reglas aplicadas
}

/**
 * Recorre todos los *.bookmark.json del ZIP, aplica reglas y devuelve los
 * payloads nuevos para los que cambiaron.
 *
 * Decisión de diseño:
 * - Lee y escribe en UTF-8 sin BOM (descarta BOM en lectura si existe).
 * - Usa separadores compactos sin espacios, igual que el pipeline Python.
 * - Avisa por stdout sobre referencias huérfanas en bookmarks.json.
 *
 * Puerto de pbix_layout_pipeline._pbir_collect_bookmark_replacements().
 */
export async function pbirCollectBookmarkReplacements(
  entries: Map<string, Uint8Array>,
  metaArcname: string,
  mesNuevo: string,
  anioNuevo: string,
  mesesBytd: string[],
  modelSetup?: Partial<ModelSetup> | null,
): Promise<PbirReplacements> {
  const metaBytes = entries.get(metaArcname);
  if (!metaBytes) {
    throw new Error(`No se encontró el miembro ${metaArcname} en el ZIP.`);
  }

  // Decodificar bookmarks.json (UTF-8, tolerar BOM)
  const metaText = decodUtf8Sig(metaBytes);
  const metaObj = JSON.parse(metaText) as JsonObject;
  const items: unknown[] = Array.isArray(metaObj["items"]) ? metaObj["items"] as unknown[] : [];

  const baseDir = metaArcname.replace(/\\/g, "/").split("/").slice(0, -1).join("/");
  const bookmarkArcs = enumeratePbirBookmarkMembers([...entries.keys()], baseDir);

  console.log(`   [i] Archivos *.bookmark.json en el paquete: ${bookmarkArcs.length}`);

  // Detectar referencias huérfanas (en bookmarks.json pero sin archivo físico)
  const indexedNames = new Set<string>(
    items
      .filter((it) => it !== null && typeof it === "object" && !Array.isArray(it))
      .map((it) => String((it as JsonObject)["name"] ?? ""))
      .filter(Boolean),
  );
  const diskNames = new Set(bookmarkArcs.map(bookmarkIdFromArc));

  for (const bid of [...indexedNames].filter((b) => !diskNames.has(b)).sort()) {
    console.log(
      `   [WARN] bookmarks.json indexa '${bid}' pero no hay archivo homónimo ` +
        `.bookmark.json (índice desincronizado).`,
    );
  }
  const onlyOnDisk = [...diskNames].filter((b) => !indexedNames.has(b));
  if (onlyOnDisk.length > 0) {
    console.log(
      `   [i] ${onlyOnDisk.length} archivo(s) en el ZIP no figuran en ` +
        `bookmarks.json; se aplican reglas igualmente.`,
    );
  }

  const replacements = new Map<string, Uint8Array>();
  let rulesHits = 0;

  for (let idx = 0; idx < bookmarkArcs.length; idx++) {
    const arc = bookmarkArcs[idx];
    const rawBytes = entries.get(arc);
    if (!rawBytes) continue;

    const rawText = decodUtf8Sig(rawBytes);
    const bm = JSON.parse(rawText) as JsonObject;

    const rawLabel = bm["displayName"] ?? bm["name"] ?? bookmarkIdFromArc(arc);
    const label = String(rawLabel).slice(0, 40);

    if (
      aplicarReglasABookmarkDict(
        bm,
        mesNuevo,
        anioNuevo,
        mesesBytd,
        `bookmark[${idx}] ${label}`,
        modelSetup,
      )
    ) {
      rulesHits++;
    }

    // Reserializar compacto, UTF-8 sin BOM
    const newPayload = new TextEncoder().encode(JSON.stringify(bm));
    if (!uint8ArrayEqual(newPayload, rawBytes)) {
      replacements.set(arc, newPayload);
    }
  }

  return { replacements, count: rulesHits };
}

// ---------------------------------------------------------------------------
// Helpers internos
// ---------------------------------------------------------------------------

/** Decodifica bytes UTF-8 descartando BOM si existe. */
function decodUtf8Sig(bytes: Uint8Array): string {
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    bytes = bytes.slice(3);
  }
  return new TextDecoder("utf-8").decode(bytes);
}

function uint8ArrayEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/** Detecta el miembro bookmarks.json en formato Fabric/PBIR. */
export function findPbirBookmarksMetadata(entryNames: string[]): string | null {
  for (const n of entryNames) {
    if (normArc(n).toLowerCase().endsWith(BOOKMARKS_META_SUFFIX)) return n;
  }
  return null;
}

/** Detecta el miembro Report/Layout (legacy) — case-insensitive. */
export function findLayoutMemberName(entryNames: string[]): string | null {
  for (const n of entryNames) {
    if (normArc(n).toLowerCase().endsWith("/report/layout")) return n;
  }
  return null;
}
