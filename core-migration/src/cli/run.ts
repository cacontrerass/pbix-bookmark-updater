#!/usr/bin/env node
// CLI de línea de comandos equivalente a worker_runner.py + Master_process.py
// Uso: npm run dev -- --source <path> --target <path> --mes-nuevo <mes> ...

import { batchProcessFolder } from "../pbix/processor.js";
import { normalizeModelSetup } from "../bookmarks/taxonomy.js";
import type { Mes, TaxonomyId } from "../pbix/types.js";

// ---------------------------------------------------------------------------
// Parseo de argv
// ---------------------------------------------------------------------------

interface CliArgs {
  source:         string;
  target:         string;
  mesNuevo:       Mes;
  anioNuevo:      string;
  mesesBytd:      string;
  periodColumn:   string;
  yearColumn:     string;
  taxonomy:       TaxonomyId;
  noClearTarget:  boolean;
}

const MESES_VALIDOS = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

function parseArgs(argv: string[]): CliArgs {
  const args = argv.slice(2); // quitar node + script
  const get  = (flag: string): string | undefined => {
    const i = args.indexOf(flag);
    return i !== -1 && i + 1 < args.length ? args[i + 1] : undefined;
  };
  const has  = (flag: string): boolean => args.includes(flag);

  const source = get("--source");
  const target = get("--target");

  if (!source) { console.error("ERROR: --source es requerido"); process.exit(2); }
  if (!target) { console.error("ERROR: --target es requerido"); process.exit(2); }

  const mesNuevo = get("--mes-nuevo") ?? "";
  if (!MESES_VALIDOS.includes(mesNuevo)) {
    console.error(`ERROR: --mes-nuevo debe ser uno de: ${MESES_VALIDOS.join(", ")}`);
    process.exit(2);
  }

  const anioNuevo    = get("--anio-nuevo")    ?? "";
  const mesesBytd    = get("--meses-bytd")    ?? "";
  const periodColumn = get("--period-column") ?? "Mes corto";
  const yearColumn   = get("--year-column")   ?? "Año";
  const taxonomy     = (get("--taxonomy")     ?? "es_short_only") as TaxonomyId;

  return {
    source,
    target,
    mesNuevo:      mesNuevo as Mes,
    anioNuevo,
    mesesBytd,
    periodColumn,
    yearColumn,
    taxonomy,
    noClearTarget: has("--no-clear-target"),
  };
}

// ---------------------------------------------------------------------------
// Entrypoint
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const args = parseArgs(process.argv);

  const modelSetup = normalizeModelSetup({
    period_column_property: args.periodColumn,
    year_column_property:   args.yearColumn,
    taxonomy_ids:           [args.taxonomy],
  });

  // Cabecera igual a la versión Python
  console.log("========== PIPELINE v2: PBIX (ZIP) — actualización de bookmarks ==========");
  console.log(`SOURCE_PBIX_FOLDER : ${args.source}`);
  console.log(`TARGET_PBIX_FOLDER : ${args.target}`);
  console.log(`MES_NUEVO          : ${args.mesNuevo}`);
  console.log(`ANIO_NUEVO         : ${args.anioNuevo}`);
  console.log(`MESES_BYTD         : ${args.mesesBytd}`);
  console.log(`MODEL_SETUP        : ${JSON.stringify(modelSetup)}`);
  console.log("=======================================================================\n");

  const result = await batchProcessFolder(
    args.source,
    args.target,
    args.mesNuevo,
    args.anioNuevo,
    args.mesesBytd,
    modelSetup,
    { clearTargetFirst: !args.noClearTarget },
  );

  // Reporte final (D1: éxitos y fallos)
  console.log("\n========== REPORTE FINAL ==========");
  if (result.success.length > 0) {
    console.log(`✓ Procesados correctamente: ${result.success.length}`);
    for (const s of result.success) {
      const mb  = (s.sizeBytes / 1_048_576).toFixed(1);
      const sec = (s.durationMs / 1000).toFixed(1);
      console.log(`    ${s.name}  (${mb} MB, ${sec} s)`);
    }
  }
  if (result.failed.length > 0) {
    console.log(`✗ Fallidos: ${result.failed.length}`);
    for (const f of result.failed) {
      console.log(`    ${f.name}: ${f.error}`);
    }
  }
  const totalSec = (result.totalMs / 1000).toFixed(1);
  console.log(`Tiempo total: ${totalSec} s`);
  console.log("===================================\n");

  process.exit(result.failed.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("ERROR fatal:", err);
  process.exit(1);
});
