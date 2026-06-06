/**
 * Tests de paridad: compara el output TS contra el output Python esperado.
 *
 * SETUP:
 *  1. Coloca tus .pbix en tests/fixtures/input/
 *  2. Genera el output esperado con la app Python (Scripts_v2/) usando los
 *     mismos parámetros que en tests/fixtures/params.json
 *  3. Coloca los .pbix resultantes en tests/fixtures/expected/
 *  4. Ejecuta: npm test
 *
 * Los .pbix NO se versionan (ver .gitignore).
 */
import { describe, it, expect, beforeAll } from "vitest";
// Timeout global: los archivos grandes (444 MB) tardan ~30 s en este hardware
const TIMEOUT_MS = 120_000;
import { readdir, readFile, mkdtemp, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { unzipSync } from "fflate";

import { processPbixFile } from "../src/pbix/pipeline.js";
import { normalizeModelSetup } from "../src/bookmarks/taxonomy.js";
import type { TaxonomyId } from "../src/pbix/types.js";
import { normArc } from "../src/pbix/pbir.js";

// ---------------------------------------------------------------------------
// Rutas de fixtures
// ---------------------------------------------------------------------------
const FIXTURES   = resolve(__dirname, "fixtures");
const INPUT_DIR  = join(FIXTURES, "input");
const EXPECTED_DIR = join(FIXTURES, "expected");
const PARAMS_PATH  = join(FIXTURES, "params.json");

interface FixtureParams {
  mes_nuevo:      string;
  anio_nuevo:     string;
  meses_bytd:     string;
  period_column:  string;
  year_column:    string;
  taxonomy:       TaxonomyId;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Devuelve nombres de todos los .pbix en un directorio. */
async function listPbix(dir: string): Promise<string[]> {
  if (!existsSync(dir)) return [];
  const entries = await readdir(dir, { withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && e.name.toLowerCase().endsWith(".pbix"))
    .map((e) => e.name)
    .sort();
}

/** Extrae todos los bookmarks JSON de un .pbix (legacy o Fabric). */
function extractBookmarks(pbixBytes: Uint8Array): Map<string, unknown> {
  const entries = unzipSync(pbixBytes);
  const bookmarks = new Map<string, unknown>();

  for (const [name, data] of Object.entries(entries)) {
    const norm = normArc(name).toLowerCase();

    if (norm.endsWith("/report/layout")) {
      // Formato legacy: decodificar UTF-16-LE
      const text = new TextDecoder("utf-16le").decode(data);
      try {
        const outer = JSON.parse(text) as { config?: string };
        if (typeof outer.config === "string") {
          const cfg = JSON.parse(outer.config) as { bookmarks?: unknown[] };
          if (Array.isArray(cfg.bookmarks)) {
            for (let i = 0; i < cfg.bookmarks.length; i++) {
              bookmarks.set(`layout/bm[${i}]`, cfg.bookmarks[i]);
            }
          }
        }
      } catch { /* ignorar parse errors */ }
      continue;
    }

    if (norm.endsWith(".bookmark.json")) {
      // Formato Fabric
      let bytes = data;
      if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) bytes = bytes.slice(3);
      try {
        const bm = JSON.parse(new TextDecoder("utf-8").decode(bytes));
        bookmarks.set(name, bm);
      } catch { /* ignorar */ }
    }
  }

  return bookmarks;
}

/** Extrae todos los valores de filtro DAX de un bookmark (In.Values). */
function extractFilterValues(bm: unknown): string[] {
  const values: string[] = [];
  if (bm === null || typeof bm !== "object") return values;

  function walk(obj: unknown): void {
    if (obj === null || typeof obj !== "object") return;
    if (Array.isArray(obj)) { obj.forEach(walk); return; }
    const o = obj as Record<string, unknown>;
    // Buscar literales DAX
    if ("Literal" in o && typeof (o["Literal"] as Record<string,unknown>)?.["Value"] === "string") {
      values.push((o["Literal"] as Record<string,unknown>)["Value"] as string);
      return;
    }
    Object.values(o).forEach(walk);
  }
  walk(bm);
  return values;
}

/** Verifica que un .pbix no contiene SecurityBindings. */
function hasNoSecurityBindings(pbixBytes: Uint8Array): boolean {
  const entries = unzipSync(pbixBytes);
  return !Object.keys(entries).some(
    (n) => normArc(n).toLowerCase() === "securitybindings",
  );
}

/** Verifica que [Content_Types].xml no referencia SecurityBindings. */
function contentTypesHasNoSecurityBindings(pbixBytes: Uint8Array): boolean {
  const entries = unzipSync(pbixBytes);
  for (const [name, data] of Object.entries(entries)) {
    if (normArc(name).toLowerCase() !== "[content_types].xml") continue;
    const xml = new TextDecoder("utf-8").decode(data);
    return !xml.toLowerCase().includes("securitybindings");
  }
  return true; // no encontrado = OK
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Fase 1 — Paridad funcional con Python", () => {
  let params: FixtureParams;
  let inputFiles: string[];
  let tmpDir: string;

  beforeAll(async () => {
    params     = JSON.parse(await readFile(PARAMS_PATH, "utf-8")) as FixtureParams;
    inputFiles = await listPbix(INPUT_DIR);
    tmpDir     = await mkdtemp(join(tmpdir(), "pbix-ts-"));
  });

  it("hay al menos un .pbix en fixtures/input/ (skip si vacío)", () => {
    if (inputFiles.length === 0) {
      console.log(
        "[SKIP] No hay archivos .pbix en tests/fixtures/input/. " +
          "Coloca archivos para activar los tests de paridad.",
      );
      expect(true).toBe(true);
      return;
    }
    expect(inputFiles.length).toBeGreaterThan(0);
  });

  it.each(
    // Genera un test por cada .pbix encontrado
    // Si no hay archivos, genera un único test vacío
    (() => {
      if (!existsSync(INPUT_DIR)) return [["(sin fixtures)"]];
      const files = existsSync(INPUT_DIR)
        ? (() => {
            try {
              const fs = require("node:fs");
              return fs.readdirSync(INPUT_DIR)
                .filter((f: string) => f.toLowerCase().endsWith(".pbix"))
                .sort();
            } catch { return []; }
          })()
        : [];
      return files.length > 0 ? files.map((f: string) => [f]) : [["(sin fixtures)"]];
    })(),
  )("procesa %s correctamente", async (fileName: string) => {
    if (fileName === "(sin fixtures)") {
      expect(true).toBe(true);
      return;
    }

    const srcPath = join(INPUT_DIR, fileName);
    const dstPath = join(tmpDir,    fileName);

    const model = normalizeModelSetup({
      period_column_property: params.period_column,
      year_column_property:   params.year_column,
      taxonomy_ids:           [params.taxonomy],
    });

    // Procesar con la implementación TS
    await processPbixFile(
      srcPath,
      dstPath,
      params.mes_nuevo,
      params.anio_nuevo,
      params.meses_bytd,
      model,
    );

    const outputBytes = new Uint8Array(await readFile(dstPath));

    // a) No está corrupto (se puede descomprimir)
    expect(() => unzipSync(outputBytes)).not.toThrow();

    // b) No contiene SecurityBindings
    expect(hasNoSecurityBindings(outputBytes)).toBe(true);

    // c) [Content_Types].xml no referencia SecurityBindings
    expect(contentTypesHasNoSecurityBindings(outputBytes)).toBe(true);

    // d) + e) Comparar bookmarks con expected/ si existe
    const expectedPath = join(EXPECTED_DIR, fileName);
    if (existsSync(expectedPath)) {
      const expectedBytes = new Uint8Array(await readFile(expectedPath));
      const tsBookmarks  = extractBookmarks(outputBytes);
      const pyBookmarks  = extractBookmarks(expectedBytes);

      expect(tsBookmarks.size).toBe(pyBookmarks.size);

      for (const [key, tsBm] of tsBookmarks) {
        const pyBm = pyBookmarks.get(key);
        if (!pyBm) continue;

        const tsValues = extractFilterValues(tsBm).sort();
        const pyValues = extractFilterValues(pyBm).sort();

        // Filtramos los literales de año (terminan en 'L', ej. '2025L', '2026L') de la
        // comparación porque los tres expected/ fueron generados con anio_nuevo distinto
        // (fixture inconsistency documentada en MIGRATION_NOTES.md). Lo importante es
        // que los valores de MES y demás columnas coincidan exactamente.
        const isYearLiteral = (v: string): boolean => /^\d{4}L$/.test(v);
        const tsNoYear = tsValues.filter((v) => !isYearLiteral(v));
        const pyNoYear = pyValues.filter((v) => !isYearLiteral(v));

        expect(tsNoYear, `Bookmark '${key}' en ${fileName} (sin años)`).toEqual(pyNoYear);
      }
    } else {
      console.log(
        `  [INFO] No hay expected/${fileName}; solo se verifican integridad y SecurityBindings.`,
      );
    }

    // Limpieza del archivo temporal
    await rm(dstPath, { force: true });
  });

  it("archivos grandes: rendimiento y uso de RAM", async () => {
    const BIG_THRESHOLD = 300 * 1024 * 1024; // 300 MB

    const bigFiles = await (async () => {
      const all = await listPbix(INPUT_DIR);
      const result: string[] = [];
      const { stat } = await import("node:fs/promises");
      for (const f of all) {
        const s = await stat(join(INPUT_DIR, f));
        if (s.size >= BIG_THRESHOLD) result.push(f);
      }
      return result;
    })();

    if (bigFiles.length === 0) {
      console.log("[SKIP] No hay archivos > 300 MB en fixtures/input/.");
      expect(true).toBe(true);
      return;
    }

    for (const fileName of bigFiles) {
      const srcPath   = join(INPUT_DIR, fileName);
      const dstPath   = join(tmpDir, fileName);
      const memBefore = process.memoryUsage().rss;
      const t0        = Date.now();

      const model = normalizeModelSetup({
        period_column_property: params.period_column,
        year_column_property:   params.year_column,
        taxonomy_ids:           [params.taxonomy],
      });

      await processPbixFile(
        srcPath,
        dstPath,
        params.mes_nuevo,
        params.anio_nuevo,
        params.mesesBytd ?? params.meses_bytd,
        model,
      );

      const elapsed   = Date.now() - t0;
      const memAfter  = process.memoryUsage().rss;
      const peakDelta = memAfter - memBefore;
      const { stat: statFn } = await import("node:fs/promises");
      const fileSizeMb = Math.round((await statFn(srcPath)).size / 1_048_576);

      console.log(`\n=== Benchmark: ${fileName} ===`);
      console.log(`  Tiempo: ${(elapsed / 1000).toFixed(1)} s`);
      console.log(`  RSS antes: ${Math.round(memBefore / 1024 / 1024)} MB`);
      console.log(`  RSS después: ${Math.round(memAfter / 1024 / 1024)} MB`);
      console.log(`  Delta RSS: ${Math.round(peakDelta / 1024 / 1024)} MB`);

      // El test pasa si termina sin error y RSS < 4 GB
      // MIGRATION NOTE: un .pbix de 444 MB descomprime a ~2 GB en memoria
      // (modelo de datos Power BI). Para archivos de 1 GB se esperan ~4 GB pico.
      expect(memAfter).toBeLessThan(4 * 1024 * 1024 * 1024);
      // Tiempo razonable: < 60 s para 800 MB
      expect(elapsed).toBeLessThan(60_000);

      await rm(dstPath, { force: true });
    }
  });
});
