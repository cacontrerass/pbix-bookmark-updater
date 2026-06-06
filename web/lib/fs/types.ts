export interface PbixFileInfo {
  name: string
  size: number
  handle?: FileSystemFileHandle
}

export type FsPermissionMode = "read" | "readwrite"
