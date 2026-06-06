// Orquestador del procesamiento en lote de una carpeta de .pbix
// Puerto de pbix_layout_pipeline.batch_process_folder() con la decisión D1:
// si un archivo falla, continúa con los demás y reporta el error al final.

import { readdir, rm, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

import type { ModelSetup, BatchResult, SuccessItem, FailedItem } from "./types.js";
import { processPbixFile, mkdirSafe } from "./pipeline.js";

export interface BatchOptions {
  clearTargetFirst?: boolean;
}

/**
 * Procesa todos los .pbix del primer nivel de sourceDir y escribe los resultados
 * en targetDir.
 *
 * Diferencia respecto al Python original (D1): si un archivo falla, se registra
 * el error y se continúa con los demás (el Python re-lanza la excepción y corta).
 */
export async function batchProcessFolder(
  sourceDir:    string,
  targetDir:    string,
  mesNuevo:     string,
  anioNuevo:    string,
  mesesBytdStr: string,
  modelSetup:   Partial<ModelSetup> | null | undefined,
  options:      BatchOptions = {},
): Promise<BatchResult> {
  const { clearTargetFirst = true } = options;

  sourceDir = resolve(sourceDir);
  targetDir = resolve(targetDir);

  await mkdirSafe(targetDir);

  // Vaciar carpeta de salida si se pide (equivale a clear_target_first=True en Python)
  if (clearTargetFirst && existsSync(targetDir)) {
    const entries = await readdir(targetDir, { withFileTypes: true });
    await Promise.all(
      entries.map((e) =>
        rm(join(targetDir, e.name), { recursive: true, force: true }),
      ),
    );
  }

  // Listar .pbix del primer nivel, ordenados alfabéticamente
  const all = await readdir(sourceDir, { withFileTypes: true });
  const pbixFiles = all
    .filter((e) => e.isFile() && e.name.toLowerCase().endsWith(".pbix"))
    .map((e) => e.name)
    .sort();

  if (pbixFiles.length === 0) {
    console.log(`[WARN] No hay archivos .pbix en: ${sourceDir}`);
  } else {
    console.log(`\n[ZIP] ${pbixFiles.length} archivo(s) PBIX`);
  }

  const success: SuccessItem[] = [];
  const failed:  FailedItem[]  = [];
  const startTotal = Date.now();

  for (const name of pbixFiles) {
    const srcPath = join(sourceDir, name);
    const dstPath = join(targetDir, name);
    const t0 = Date.now();

    try {
      await processPbixFile(srcPath, dstPath, mesNuevo, anioNuevo, mesesBytdStr, modelSetup);
      const info = await stat(dstPath);
      success.push({ name, durationMs: Date.now() - t0, sizeBytes: info.size });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`   [ERR] Error en ${name}: ${msg}`);
      failed.push({ name, error: msg });
      // D1: continuar con el siguiente archivo
    }
  }

  return {
    success,
    failed,
    totalMs: Date.now() - startTotal,
  };
}
