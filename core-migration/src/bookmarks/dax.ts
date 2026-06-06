// Helpers de literales DAX para filtros de bookmarks
// Puerto de bookmarks_updater.py: _dax_literal_value y construcción de Values BYTD

/**
 * Envuelve un string en comillas simples DAX escapando comillas internas.
 * Puerto de bookmarks_updater._dax_literal_value().
 * Ej.: "Ene" → "'Ene'"  |  "O'Brien" → "'O''Brien'"
 */
export function daxLiteralValue(inner: string): string {
  return "'" + inner.replace(/'/g, "''") + "'";
}

/**
 * Construye el array Values de un filtro DAX de selección múltiple (BYTD).
 * Cada elemento es [[{Literal: {Value: "'Ene'"}}], ...].
 * Puerto de la construcción inline en _actualizar_bytd_en_objeto().
 */
export function buildBytdValues(formattedLabels: string[]): unknown[] {
  return formattedLabels.map((label) => [
    { Literal: { Value: daxLiteralValue(label) } },
  ]);
}
