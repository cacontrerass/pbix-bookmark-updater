// ZIP read/write helpers en navegador, basados en fflate.
//
// IMPORTANTE: usamos las variantes SYNC (`unzipSync` / `zipSync`) en lugar de
// la API streaming (`new Unzip(...).push(buf, true)` / `new Zip(...)`).
//
// Razón histórica: la versión streaming usa `Unzip.prototype.push` que en
// fflate 0.8.x es RECURSIVA — al detectar cada local file header dentro del
// buffer, hace `return this.push(buf.subarray(i), final)`, y por cada entry
// cuyos bytes consumió, otra recursión. Pasarle un .pbix de 444 MB con miles
// de entries hace explotar el stack de V8 (~10K frames) con "Maximum call
// stack size exceeded" ANTES de procesar nada.
//
// La variante sync lee el central directory al final del ZIP e itera con un
// `for` clásico — sin recursión. Es la misma estrategia que usa
// zipfile.ZipFile en Python (la app de escritorio original). Como ya corremos
// dentro de un Web Worker dedicado, bloquear ese hilo durante la
// (des)compresión es lo deseado.

import { unzipSync, zipSync } from "fflate"

export interface ZipEntry {
  data: Uint8Array
}

export function readZipEntries(
  srcBytes: Uint8Array
): Promise<Map<string, ZipEntry>> {
  // Wrapper async para preservar el contrato anterior (Promise) y no tocar
  // los callers. Internamente la operación es síncrona.
  return new Promise((resolve, reject) => {
    try {
      const raw = unzipSync(srcBytes)
      const entries = new Map<string, ZipEntry>()
      for (const name of Object.keys(raw)) {
        entries.set(name, { data: raw[name] })
      }
      resolve(entries)
    } catch (err) {
      reject(err instanceof Error ? err : new Error(String(err)))
    }
  })
}

type ZipInput = Record<string, [Uint8Array, { level: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 }]>

export function writeZipEntries(
  entries: Map<string, ZipEntry>,
  /** Clave = normArc(nombre).toLowerCase() → payload nuevo */
  replacements: Map<string, Uint8Array>,
  /** Conjunto de nombres normalizados (lowercase) a omitir */
  skipNorms: Set<string>,
  normArc: (name: string) => string
): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    try {
      const filesObj: ZipInput = {}
      for (const [name, entry] of entries) {
        const normKey = normArc(name).toLowerCase()
        if (skipNorms.has(normKey)) continue
        const payload = replacements.get(normKey) ?? entry.data
        // Nivel 6 = mismo nivel que el pipeline de core (default DEFLATE).
        // fflate.fltn recorre el árbol pero como cada valor es un TypedArray
        // (ArrayBuffer.isView=true), NO recurse: se trata como hoja.
        filesObj[name] = [payload, { level: 6 }]
      }
      const out = zipSync(filesObj)
      resolve(out)
    } catch (err) {
      reject(err instanceof Error ? err : new Error(String(err)))
    }
  })
}

export function uint8ArrayEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
  return true
}
