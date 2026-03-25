import { useCallback, useEffect, useState } from "react"
import { getFolderHandle, removeFolderHandle, saveFolderHandle } from "@/utils/folderStorage"

/**
 * Hook generico per collegare/scollegare una cartella tramite File System Access API.
 * Usato nelle impostazioni per qualsiasi cartella (stock, commercial, ecc.)
 */
export function useFolderConnect(key) {
  const [folderName, setFolderName] = useState(null)
  const [isSupported] = useState(() => "showDirectoryPicker" in window)

  useEffect(() => {
    getFolderHandle(key).then((h) => {
      if (h) setFolderName(h.name)
    }).catch(() => {})
  }, [key])

  const connect = useCallback(async () => {
    try {
      const handle = await window.showDirectoryPicker({ mode: "readwrite" })
      await saveFolderHandle(key, handle)
      setFolderName(handle.name)
    } catch (e) {
      if (e.name !== "AbortError") console.error(e)
    }
  }, [key])

  const disconnect = useCallback(async () => {
    await removeFolderHandle(key)
    setFolderName(null)
  }, [key])

  return { folderName, isSupported, isConnected: !!folderName, connect, disconnect }
}
