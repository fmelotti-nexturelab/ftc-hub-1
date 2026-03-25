import { useCallback, useEffect, useState } from "react"
import { stockApi } from "@/api/stock"
import { getFolderHandle, removeFolderHandle, saveFolderHandle } from "@/utils/folderStorage"

const STOCK_RE = /^Stock-(\d{4}-\d{2}-\d{2})-(IT0[123])\.csv$/i
const FOLDER_KEY = "stock_folder"

/**
 * Used by ProfilePage settings section.
 * Manages connect/disconnect and on-demand manual import.
 */
export function useStockFolder() {
  const [folderName, setFolderName] = useState(null)
  const [isSupported] = useState(() => "showDirectoryPicker" in window)
  const [importing, setImporting] = useState(false)
  const [lastResult, setLastResult] = useState(null) // { count, error }

  // Load saved folder name on mount
  useEffect(() => {
    getFolderHandle(FOLDER_KEY).then((h) => {
      if (h) setFolderName(h.name)
    }).catch(() => {})
  }, [])

  const connect = useCallback(async () => {
    try {
      const handle = await window.showDirectoryPicker({ mode: "readwrite" })
      await saveFolderHandle(FOLDER_KEY, handle)
      setFolderName(handle.name)
      setLastResult(null)
    } catch (e) {
      if (e.name !== "AbortError") console.error(e)
    }
  }, [])

  const disconnect = useCallback(async () => {
    await removeFolderHandle(FOLDER_KEY)
    setFolderName(null)
    setLastResult(null)
  }, [])

  const importNow = useCallback(async () => {
    // Always request permission explicitly — avoids Chrome timing bug
    // where entries() returns nothing right after a fresh requestPermission
    let handle = await getFolderHandle(FOLDER_KEY)
    if (!handle) return

    const perm = await handle.requestPermission({ mode: "readwrite" })
    if (perm !== "granted") {
      setLastResult({ count: 0, error: "Permesso negato. Riconnetti la cartella." })
      return
    }

    // Re-read handle from IndexedDB after permission grant to get a fresh reference
    handle = await getFolderHandle(FOLDER_KEY)
    if (!handle) return

    setImporting(true)
    setLastResult(null)

    try {
      // Navigate into subfolder "91 - Files from NAV"
      let sourceHandle
      try {
        sourceHandle = await handle.getDirectoryHandle("91 - Files from NAV")
      } catch {
        setLastResult({ count: 0, error: 'Sottocartella "91 - Files from NAV" non trovata.' })
        setImporting(false)
        return
      }

      // Import all matching files — backend overwrites existing sessions for same date
      const toUpload = []
      for await (const [name, fileHandle] of sourceHandle.entries()) {
        if (fileHandle.kind !== "file") continue
        const m = STOCK_RE.exec(name)
        if (!m) continue
        const [, , entity] = m
        toUpload.push({ fileHandle, entity: entity.toUpperCase(), name })
      }

      let count = 0
      const failed = []
      for (const { fileHandle, entity, name } of toUpload) {
        try {
          const file = await fileHandle.getFile()
          await stockApi.uploadCsv(file, entity)
          count++
        } catch (e) {
          console.warn("Manual import error:", name, e)
          failed.push(name)
        }
      }

      setLastResult({ count, failed, error: null })
    } catch (e) {
      setLastResult({ count: 0, error: "Errore durante l'importazione" })
    } finally {
      setImporting(false)
    }
  }, [])

  return { folderName, isSupported, isConnected: !!folderName, connect, disconnect, importNow, importing, lastResult }
}
