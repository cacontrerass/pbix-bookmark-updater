import { MESES_CORTOS } from "./constants"

export function presetMesNuevo(): string {
  return MESES_CORTOS[new Date().getMonth()]
}

export function presetAnioNuevo(): string {
  return String(new Date().getFullYear())
}

export function presetBytdSelection(): Set<string> {
  const mesActual = new Date().getMonth() // 0-indexed
  return new Set(MESES_CORTOS.slice(0, mesActual))
}
