import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatBytes(bytes: number, decimals = 1): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B"
  const k = 1024
  if (bytes < k) return `${bytes} B`
  const units = ["KB", "MB", "GB", "TB"]
  let value = bytes / k
  let unitIndex = 0
  while (value >= k && unitIndex < units.length - 1) {
    value /= k
    unitIndex++
  }
  const factor = Math.pow(10, decimals)
  const rounded = Math.round(value * factor) / factor
  return `${rounded.toFixed(decimals)} ${units[unitIndex]}`
}
