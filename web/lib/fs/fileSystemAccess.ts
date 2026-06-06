import type { FsPermissionMode, PbixFileInfo } from "./types"

export function isFileSystemAccessSupported(): boolean {
  return typeof window !== "undefined" && "showDirectoryPicker" in window
}

function isAbortError(err: unknown): boolean {
  return (
    err instanceof DOMException &&
    (err.name === "AbortError" || err.code === 20)
  )
}

async function pickDirectory(
  mode: FsPermissionMode,
  id: string
): Promise<FileSystemDirectoryHandle | null> {
  if (!isFileSystemAccessSupported()) {
    throw new Error("File System Access API no disponible en este navegador.")
  }
  try {
    const picker = (window as Window).showDirectoryPicker
    if (!picker) {
      throw new Error("showDirectoryPicker no disponible.")
    }
    const handle = await picker({ mode, id })
    return handle
  } catch (err) {
    if (isAbortError(err)) {
      return null
    }
    throw err
  }
}

export function pickInputFolder(): Promise<FileSystemDirectoryHandle | null> {
  return pickDirectory("read", "pbix-input")
}

export function pickOutputFolder(): Promise<FileSystemDirectoryHandle | null> {
  return pickDirectory("readwrite", "pbix-output")
}

export async function listPbixFiles(
  dirHandle: FileSystemDirectoryHandle
): Promise<PbixFileInfo[]> {
  const result: PbixFileInfo[] = []
  // dirHandle.entries() yields [name, handle] tuples
  for await (const [name, entry] of dirHandle.entries()) {
    if (entry.kind !== "file") continue
    if (!name.toLowerCase().endsWith(".pbix")) continue
    const fileHandle = entry as FileSystemFileHandle
    try {
      const file = await fileHandle.getFile()
      result.push({ name, size: file.size, handle: fileHandle })
    } catch {
      // If we can't read the file, skip but keep going
    }
  }
  result.sort((a, b) => a.name.localeCompare(b.name, "es", { sensitivity: "base" }))
  return result
}

export async function verifyPermission(
  handle: FileSystemHandle,
  mode: FsPermissionMode
): Promise<boolean> {
  const opts = { mode }
  if (typeof handle.queryPermission === "function") {
    const status = await handle.queryPermission(opts)
    if (status === "granted") return true
  }
  if (typeof handle.requestPermission === "function") {
    const status = await handle.requestPermission(opts)
    return status === "granted"
  }
  return false
}
