// Parche de [Content_Types].xml para eliminar la referencia a SecurityBindings
// Puerto de pbix_layout_pipeline.strip_security_bindings_from_content_types()
//
// Usa @xmldom/xmldom porque Node.js no tiene DOMParser/XMLSerializer nativos.

import { DOMParser, XMLSerializer } from "@xmldom/xmldom";

const SECURITY_BINDINGS_PART = "securitybindings"; // lower-case, sin /

/**
 * Elimina la entrada <Override PartName="SecurityBindings"/> de [Content_Types].xml.
 * Retorna los bytes UTF-8 del XML modificado con declaración XML antepuesta.
 *
 * Puerto de pbix_layout_pipeline.strip_security_bindings_from_content_types().
 */
export function stripSecurityBindingsFromContentTypes(rawBytes: Uint8Array): Uint8Array {
  // Descartar BOM UTF-8 si existe (0xEF 0xBB 0xBF)
  let bytes = rawBytes;
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    bytes = bytes.slice(3);
  }

  const xmlString = new TextDecoder("utf-8").decode(bytes);

  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, "text/xml");

  const root = doc.documentElement;
  if (!root) return rawBytes; // Fallback: devolver sin cambios si falla el parse

  // Recorrer hijos del root y eliminar el Override de SecurityBindings
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const toRemove: any[] = [];
  for (let i = 0; i < root.childNodes.length; i++) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const child = root.childNodes[i] as any;
    if (child.nodeType !== 1 /* ELEMENT_NODE */) continue;

    // Obtener nombre local (ignora namespace prefix)
    const localName: string = child.localName ?? (child.nodeName as string).split(":").pop() ?? "";
    if (localName !== "Override") continue;

    const partName: string = (child.getAttribute("PartName") ?? "")
      .replace(/\\/g, "/")
      .replace(/^\//, "");

    if (partName.toLowerCase() === SECURITY_BINDINGS_PART) {
      toRemove.push(child);
    }
  }
  for (const node of toRemove) {
    root.removeChild(node);
  }

  // Serializar el documento
  const serializer = new XMLSerializer();
  let output = serializer.serializeToString(doc);

  // XMLSerializer puede incluir o no la declaración XML; la normalizamos
  // anteponiéndola siempre con dobles comillas (Python usa simples, pero ambas son válidas)
  output = output.replace(/^<\?xml[^?]*\?>\s*/i, "");
  const declaration = '<?xml version="1.0" encoding="utf-8"?>\n';
  output = declaration + output;

  return new TextEncoder().encode(output);
}
