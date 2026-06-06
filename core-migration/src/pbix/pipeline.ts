// Manipulación del .pbix como ZIP con fflate (streaming asíncrono)
// Puerto de pbix_layout_pipeline: repack_pbix_with_replacements, process_pbix_file
//
// MIGRATION NOTE: fflate no expone los bytes comprimidos raw de entradas existentes,
// por lo que todos los miembros se recomprimen con nivel 6. Esto es aceptable
// según la decisión D2 (paridad funcional, no byte-a-byte).
// Python también recomprime todo vía zipfile.ZipFile con ZIP_DEFLATED.
//
// MIGRATION NOTE: fflate 0.8.x UnzipFile no expone mtime, externalAttr ni comment
// (solo name, compression, size, originalSize). Por tanto los metadatos del ZIP
// original (fechas, atributos Unix) NO se preservan en el output.
// Power BI no verifica estos metadatos para abrir el archivo (D2 OK).

import { Unzip, UnzipInflate, Zip, ZipDeflate } from "fflate";
import type { UnzipFile } from "fflate";
import { readFile, writeFile, rename, unlink, copyFile, utimes, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { randomBytes } from "node:crypto";

import type { ModelSetup } from "./types.js";
import {
  normArc,
  findLayoutMemberName,
  findPbirBookmarksMetadata,
  pbirCollectBookmarkReplacements,
} from "./pbir.js";
import {
  decodeLayout,
  encodeLayout,
  patchLayoutJsonString,
} from "./layout.js";
import { stripSecurityBindingsFromContentTypes } from "./contentTypes.js";

/** Crea un directorio (y padres) si no existe. */
export async function mkdirSafe(path: string): Promise<void> {
  await mkdir(path, { recursive: true });
}

const SECURITY_BINDINGS_PART = "securitybindings";
const CONTENT_TYPES_NAME     = "[content_types].xml";

// ---------------------------------------------------------------------------
// Estructura interna de una entrada ZIP
// (fflate 0.8.x no expone metadatos como mtime/externalAttr en UnzipFile)
// ---------------------------------------------------------------------------

interface ZipEntry {
  data: Uint8Array;
}

// ---------------------------------------------------------------------------
// Lectura del ZIP con Unzip streaming (preserva metadatos)
// ---------------------------------------------------------------------------

/**
 * Descomprime todas las entradas del ZIP y devuelve un Map nombre → entry.
 * Usa la API streaming de fflate (Unzip) para no bloquear el event loop.
 */
function readZipEntries(srcBytes: Uint8Array): Promise<Map<string, ZipEntry>> {
  return new Promise((resolve, reject) => {
    const entries = new Map<string, ZipEntry>();
    const pending = new Set<string>();
    let pushDone  = false;

    function checkDone() {
      if (pushDone && pending.size === 0) resolve(entries);
    }

    const uz = new Unzip((file: UnzipFile) => {
      // El handler se asigna en el constructor; register va antes de push
      pending.add(file.name);
      const chunks: Uint8Array[] = [];

      file.ondata = (err, chunk, final) => {
        if (err) { reject(err); return; }
        chunks.push(chunk);
        if (final) {
          entries.set(file.name, {
            data: concatUint8Arrays(chunks),
          });
          pending.delete(file.name);
          checkDone();
        }
      };
      file.start();
    });

    // Registrar decoder DEFLATE (tipo 8) — obligatorio en fflate streaming
    uz.register(UnzipInflate);
    uz.push(srcBytes, true);
    pushDone = true;
    checkDone();
  });
}

// ---------------------------------------------------------------------------
// Escritura del ZIP con Zip streaming
// ---------------------------------------------------------------------------

/**
 * Construye un ZIP nuevo a partir del Map de entradas, aplicando los
 * reemplazos indicados y omitiendo las entradas excluidas.
 * Devuelve los bytes del ZIP resultante.
 */
function writeZipEntries(
  entries: Map<string, ZipEntry>,
  /** Clave = normArc(nombre).toLowerCase() → payload nuevo */
  replacements: Map<string, Uint8Array>,
  /** Conjuntos de nombres a omitir (normalizados, lowercase) */
  skipNorms: Set<string>,
): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const chunks: Uint8Array[] = [];

    const z = new Zip((err, data, final) => {
      if (err) { reject(err); return; }
      chunks.push(data);
      if (final) resolve(concatUint8Arrays(chunks));
    });

    for (const [name, entry] of entries) {
      const normKey = normArc(name).toLowerCase();
      if (skipNorms.has(normKey)) continue;

      const payload = replacements.get(normKey) ?? entry.data;

      const zipFile = new ZipDeflate(name, { level: 6 });
      z.add(zipFile);
      zipFile.push(payload, true);
    }

    z.end();
  });
}

// ---------------------------------------------------------------------------
// Reempaquetado principal
// Puerto de pbix_layout_pipeline.repack_pbix_with_replacements()
// ---------------------------------------------------------------------------

/**
 * Copia el ZIP sustituyendo los miembros indicados.
 * Elimina SecurityBindings si stripSecurityBindings=true.
 * Escribe a archivo temporal y luego hace rename atómico.
 */
export async function repackPbixWithReplacements(
  srcPath: string,
  dstPath: string,
  /** Clave = normArc(arcname).toLowerCase() → payload nuevo */
  replacements: Map<string, Uint8Array>,
  stripSecurityBindings = true,
): Promise<void> {
  const srcBytes = new Uint8Array(await readFile(srcPath));
  const entries  = await readZipEntries(srcBytes);

  const entryNames = [...entries.keys()];
  const hadSecurityBindings = entryNames.some(
    (n) => normArc(n).toLowerCase() === SECURITY_BINDINGS_PART,
  );

  const skipNorms = new Set<string>();
  if (stripSecurityBindings && hadSecurityBindings) {
    skipNorms.add(SECURITY_BINDINGS_PART);
  }

  // Si se eliminó SecurityBindings, parchear [Content_Types].xml
  if (stripSecurityBindings && hadSecurityBindings) {
    const ctKey = entryNames.find(
      (n) => normArc(n).toLowerCase() === CONTENT_TYPES_NAME,
    );
    if (ctKey) {
      const ctEntry = entries.get(ctKey)!;
      const patched = stripSecurityBindingsFromContentTypes(ctEntry.data);
      replacements = new Map([...replacements, [CONTENT_TYPES_NAME, patched]]);
    }
  }

  const outputBytes = await writeZipEntries(entries, replacements, skipNorms);

  // Escribir a tempfile y luego rename atómico
  const tmpPath = join(tmpdir(), `pbix-${randomBytes(8).toString("hex")}.pbix`);
  try {
    await writeFile(tmpPath, outputBytes);
    // Asegurar que el directorio de destino existe
    await mkdirSafe(dirname(dstPath));
    await rename(tmpPath, dstPath);
  } catch (err) {
    if (existsSync(tmpPath)) await unlink(tmpPath).catch(() => { /* ignore */ });
    throw err;
  }

  if (stripSecurityBindings && hadSecurityBindings) {
    console.log(
      "   [i] SecurityBindings eliminado + [Content_Types].xml ajustado " +
        "(paquete OPC coherente con contenido modificado).",
    );
  }
}

// ---------------------------------------------------------------------------
// Procesamiento de un archivo .pbix individual
// Puerto de pbix_layout_pipeline.process_pbix_file()
// ---------------------------------------------------------------------------

/**
 * Procesa un único .pbix y escribe la copia actualizada en dstPath.
 */
export async function processPbixFile(
  srcPath: string,
  dstPath: string,
  mesNuevo: string,
  anioNuevo: string,
  mesesBytdStr: string,
  modelSetup?: Partial<ModelSetup> | null,
): Promise<void> {
  const mesesBytd: string[] = mesesBytdStr.trim()
    ? mesesBytdStr.split(",").map((m) => m.trim()).filter(Boolean)
    : [];

  const fileName = srcPath.replace(/\\/g, "/").split("/").pop() ?? srcPath;
  console.log(`\n>> Pipeline ZIP (PBIX): ${fileName}`);
  console.log(`   Origen : ${srcPath}`);
  console.log(`   Destino: ${dstPath}`);

  // Leer el ZIP y sus entradas (solo metadata, sin descomprimir todo aún)
  const srcBytes   = new Uint8Array(await readFile(srcPath));
  const entries    = await readZipEntries(srcBytes);
  const entryNames = [...entries.keys()];

  const layoutName = findLayoutMemberName(entryNames);
  const metaName   = layoutName ? null : findPbirBookmarksMetadata(entryNames);

  if (layoutName) {
    // -----------------------------------------------------------------------
    // Camino LEGACY: Report/Layout (UTF-16-LE)
    // -----------------------------------------------------------------------
    console.log(`   Formato: legacy — Layout '${layoutName}'`);

    const rawLayout = entries.get(layoutName)!.data;
    const layoutText = decodeLayout(rawLayout);
    const { nuevoLayoutText, nModificados } = patchLayoutJsonString(
      layoutText,
      mesNuevo,
      anioNuevo,
      mesesBytd,
      modelSetup,
    );
    const newBytes = encodeLayout(nuevoLayoutText);

    console.log(`   Bookmarks con reglas aplicadas (entradas tocadas): ${nModificados}`);

    // Sin cambios → copiar el archivo sin reprocesar
    if (uint8ArrayEqual(newBytes, rawLayout)) {
      console.log("   [i] Sin cambios binarios en Layout; se copia el archivo igual.");
      await mkdirSafe(dirname(dstPath));
      await copyFile(srcPath, dstPath);
      await stampMtime(dstPath);
      return;
    }

    const replacements = new Map<string, Uint8Array>([
      [normArc(layoutName).toLowerCase(), newBytes],
    ]);
    await repackPbixWithReplacements(srcPath, dstPath, replacements);
    console.log(`   [OK] Escrito: ${dstPath}`);
    return;
  }

  if (metaName) {
    // -----------------------------------------------------------------------
    // Camino FABRIC / PBIR: *.bookmark.json
    // -----------------------------------------------------------------------
    console.log(`   Formato: definición Fabric — metadata '${metaName}'`);

    // Convertir Map<name, ZipEntry> → Map<name, Uint8Array> para el colector PBIR
    const entriesData = new Map<string, Uint8Array>(
      [...entries.entries()].map(([k, v]) => [k, v.data]),
    );
    const { replacements, count } = await pbirCollectBookmarkReplacements(
      entriesData,
      metaName,
      mesNuevo,
      anioNuevo,
      mesesBytd,
      modelSetup,
    );

    console.log(`   Bookmarks con reglas aplicadas (entradas tocadas): ${count}`);

    if (replacements.size === 0) {
      console.log("   [i] Sin cambios en archivos de bookmark; se copia el archivo igual.");
      await mkdirSafe(dirname(dstPath));
      await copyFile(srcPath, dstPath);
      await stampMtime(dstPath);
      return;
    }

    // Convertir Map<arcname, Uint8Array> → Map<normLower, Uint8Array>
    const repNormalized = new Map<string, Uint8Array>(
      [...replacements.entries()].map(([k, v]) => [normArc(k).toLowerCase(), v]),
    );
    await repackPbixWithReplacements(srcPath, dstPath, repNormalized);
    console.log(`   [OK] Archivos de bookmark actualizados: ${replacements.size}`);
    console.log(`   [OK] Escrito: ${dstPath}`);
    return;
  }

  throw new Error(
    `No se encontró 'Report/Layout' (legacy) ni ` +
      `'Report/definition/bookmarks/bookmarks.json' (definición) en ${srcPath}`,
  );
}

// ---------------------------------------------------------------------------
// Helpers internos
// ---------------------------------------------------------------------------

export { normArc };

function concatUint8Arrays(arrays: Uint8Array[]): Uint8Array {
  const totalLen = arrays.reduce((s, a) => s + a.length, 0);
  const out = new Uint8Array(totalLen);
  let offset = 0;
  for (const a of arrays) { out.set(a, offset); offset += a.length; }
  return out;
}

function uint8ArrayEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

async function stampMtime(path: string): Promise<void> {
  const now = new Date();
  await utimes(path, now, now).catch(() => { /* ignorar errores de permisos */ });
}
