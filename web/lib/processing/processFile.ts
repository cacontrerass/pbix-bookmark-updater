// Pipeline browser-friendly de un .pbix individual.
// Mismas reglas y formatos que core-migration/src/pbix/pipeline.ts:processPbixFile,
// pero opera con bytes en memoria (sin node:fs). El ZIP se reempaqueta vía
// fflate en navegador. Toda la lógica de bookmarks/layout/PBIR se delega al core.

import {
  decodeLayout,
  encodeLayout,
  patchLayoutJsonString,
} from "@pbix/core/pbix/layout"
import {
  normArc,
  findLayoutMemberName,
  findPbirBookmarksMetadata,
  pbirCollectBookmarkReplacements,
} from "@pbix/core/pbix/pbir"
import { stripSecurityBindingsFromContentTypes } from "@pbix/core/pbix/contentTypes"
import type { ModelSetup } from "@pbix/core/pbix/types"

import { readZipEntries, writeZipEntries, uint8ArrayEqual } from "./zip"

const SECURITY_BINDINGS_PART = "securitybindings"
const CONTENT_TYPES_NAME = "[content_types].xml"

/**
 * Procesa los bytes de un único .pbix y devuelve los bytes del .pbix resultante.
 * Si no hay cambios efectivos, devuelve los bytes originales (mismo Uint8Array).
 */
export async function processPbixBytes(
  srcBytes: Uint8Array,
  fileName: string,
  mesNuevo: string,
  anioNuevo: string,
  mesesBytdStr: string,
  modelSetup: Partial<ModelSetup> | null | undefined
): Promise<Uint8Array> {
  const mesesBytd: string[] = mesesBytdStr.trim()
    ? mesesBytdStr.split(",").map((m) => m.trim()).filter(Boolean)
    : []

  console.log(`\n>> Pipeline ZIP (PBIX): ${fileName}`)

  const entries = await readZipEntries(srcBytes)
  const entryNames = [...entries.keys()]

  const layoutName = findLayoutMemberName(entryNames)
  const metaName = layoutName ? null : findPbirBookmarksMetadata(entryNames)

  const hadSecurityBindings = entryNames.some(
    (n) => normArc(n).toLowerCase() === SECURITY_BINDINGS_PART
  )

  let replacements = new Map<string, Uint8Array>()

  if (layoutName) {
    console.log(`   Formato: legacy — Layout '${layoutName}'`)
    const rawLayout = entries.get(layoutName)!.data
    const layoutText = decodeLayout(rawLayout)
    const { nuevoLayoutText, nModificados } = patchLayoutJsonString(
      layoutText,
      mesNuevo,
      anioNuevo,
      mesesBytd,
      modelSetup
    )
    const newBytes = encodeLayout(nuevoLayoutText)
    console.log(
      `   Bookmarks con reglas aplicadas (entradas tocadas): ${nModificados}`
    )

    if (uint8ArrayEqual(newBytes, rawLayout) && !hadSecurityBindings) {
      console.log(
        "   [i] Sin cambios binarios en Layout; se entrega el archivo igual."
      )
      return srcBytes
    }

    if (!uint8ArrayEqual(newBytes, rawLayout)) {
      replacements.set(normArc(layoutName).toLowerCase(), newBytes)
    }
  } else if (metaName) {
    console.log(`   Formato: definición Fabric — metadata '${metaName}'`)
    const entriesData = new Map<string, Uint8Array>(
      [...entries.entries()].map(([k, v]) => [k, v.data])
    )
    const { replacements: repByArc, count } =
      await pbirCollectBookmarkReplacements(
        entriesData,
        metaName,
        mesNuevo,
        anioNuevo,
        mesesBytd,
        modelSetup
      )
    console.log(`   Bookmarks con reglas aplicadas (entradas tocadas): ${count}`)

    if (repByArc.size === 0 && !hadSecurityBindings) {
      console.log(
        "   [i] Sin cambios en archivos de bookmark; se entrega el archivo igual."
      )
      return srcBytes
    }

    for (const [arc, payload] of repByArc) {
      replacements.set(normArc(arc).toLowerCase(), payload)
    }
  } else {
    throw new Error(
      `No se encontró 'Report/Layout' (legacy) ni 'Report/definition/bookmarks/bookmarks.json' (definición) en ${fileName}`
    )
  }

  const skipNorms = new Set<string>()
  if (hadSecurityBindings) {
    skipNorms.add(SECURITY_BINDINGS_PART)
    const ctKey = entryNames.find(
      (n) => normArc(n).toLowerCase() === CONTENT_TYPES_NAME
    )
    if (ctKey) {
      const ctEntry = entries.get(ctKey)!
      const patched = stripSecurityBindingsFromContentTypes(ctEntry.data)
      replacements = new Map([...replacements, [CONTENT_TYPES_NAME, patched]])
    }
    console.log(
      "   [i] SecurityBindings eliminado + [Content_Types].xml ajustado " +
        "(paquete OPC coherente con contenido modificado)."
    )
  }

  const out = await writeZipEntries(entries, replacements, skipNorms, normArc)
  console.log(`   [OK] Procesado: ${fileName}`)
  return out
}
