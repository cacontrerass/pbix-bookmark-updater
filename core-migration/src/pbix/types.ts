// Tipos base compartidos por todo el core de migración

export type Mes =
  | "Ene" | "Feb" | "Mar" | "Abr" | "May" | "Jun"
  | "Jul" | "Ago" | "Sep" | "Oct" | "Nov" | "Dic";

export type TaxonomyId =
  | "es_short_only"
  | "es_short_lower_year"
  | "es_long_cap_year"
  | "es_long_lower_year"
  | "en_short_cap_year"
  | "en_short_lower_year"
  | "en_long_year"
  | "month_number";

export interface ModelSetup {
  period_column_property: string;
  year_column_property: string;
  taxonomy_ids: TaxonomyId[];
}

// Resultado de procesar un archivo individual (éxito)
export interface SuccessItem {
  name: string;
  durationMs: number;
  sizeBytes: number;
}

// Resultado de procesar un archivo individual (fallo)
export interface FailedItem {
  name: string;
  error: string;
}

// Resultado agregado del procesamiento de una carpeta
export interface BatchResult {
  success: SuccessItem[];
  failed: FailedItem[];
  totalMs: number;
}

// Parámetros de ejecución del pipeline
export interface PipelineParams {
  mesNuevo: Mes;
  anioNuevo: string;          // ej. "2026L" o ""
  mesesBytd: Mes[];
  modelSetup: ModelSetup;
}

// Valor JSON genérico (para tipado seguro de la travesía del bookmark)
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonObject
  | JsonArray;

export type JsonObject = { [key: string]: JsonValue };
export type JsonArray = JsonValue[];
