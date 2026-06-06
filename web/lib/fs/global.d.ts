// Minimal shim for File System Access API where TypeScript's lib.dom
// may not include the latest definitions. Falls back to `any` so this
// works across TS versions without conflicting with built-ins.

interface ShowDirectoryPickerOptions {
  id?: string
  mode?: "read" | "readwrite"
  startIn?:
    | "desktop"
    | "documents"
    | "downloads"
    | "music"
    | "pictures"
    | "videos"
    | FileSystemHandle
}

interface Window {
  showDirectoryPicker?: (
    options?: ShowDirectoryPickerOptions
  ) => Promise<FileSystemDirectoryHandle>
}

interface FileSystemHandlePermissionDescriptor {
  mode?: "read" | "readwrite"
}

interface FileSystemHandle {
  queryPermission?: (
    descriptor?: FileSystemHandlePermissionDescriptor
  ) => Promise<PermissionState>
  requestPermission?: (
    descriptor?: FileSystemHandlePermissionDescriptor
  ) => Promise<PermissionState>
}

interface FileSystemDirectoryHandle {
  entries: () => AsyncIterableIterator<[string, FileSystemHandle]>
  removeEntry: (name: string, options?: { recursive?: boolean }) => Promise<void>
  getFileHandle: (
    name: string,
    options?: { create?: boolean }
  ) => Promise<FileSystemFileHandle>
}

interface FileSystemWritableFileStream {
  write: (data: BufferSource | Blob | string) => Promise<void>
  close: () => Promise<void>
}

interface FileSystemFileHandle {
  createWritable: (options?: {
    keepExistingData?: boolean
  }) => Promise<FileSystemWritableFileStream>
  getFile: () => Promise<File>
}
