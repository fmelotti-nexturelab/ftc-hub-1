import { useEffect, useRef, useState } from "react"
import { useAuthStore } from "@/store/authStore"
import { stockApi } from "@/api/stock"
import { getFolderHandle } from "@/utils/folderStorage"

const STOCK_RE = /^Stock-(\d{4}-\d{2}-\d{2})-(IT0[123])\.csv$/i
const ALLOWED_DEPTS = ["SUPERUSER", "ADMIN", "IT"]

/**
 * Runs once on mount (Shell).
 * Scans the saved stock folder, finds new CSV files not yet in DB, uploads them.
 * Returns { toast } — a string message to display, or null.
 */
export function useStockAutoImport() {
  const { user } = useAuthStore()
  const [toast, setToast] = useState(null)
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return
    if (!ALLOWED_DEPTS.includes(user?.department)) return
    if (!("showDirectoryPicker" in window)) return

    ran.current = true
    let cancelled = false

    async function run() {
      let handle = await getFolderHandle("stock_folder")
      if (!handle) return

      // requestPermission is safe to call even when already granted
      let perm
      try {
        perm = await handle.requestPermission({ mode: "read" })
      } catch {
        return
      }
      if (perm !== "granted") return

      // Re-read from IndexedDB after permission — avoids Chrome timing bug
      handle = await getFolderHandle("stock_folder")
      if (!handle) return

      // Fetch already-imported dates per entity
      const [r01, r02, r03] = await Promise.all([
        stockApi.getSessions("IT01").then((r) => r.data).catch(() => []),
        stockApi.getSessions("IT02").then((r) => r.data).catch(() => []),
        stockApi.getSessions("IT03").then((r) => r.data).catch(() => []),
      ])
      const imported = {
        IT01: new Set(r01.map((s) => s.stock_date)),
        IT02: new Set(r02.map((s) => s.stock_date)),
        IT03: new Set(r03.map((s) => s.stock_date)),
      }

      // Scan folder
      const toUpload = []
      for await (const [name, fileHandle] of handle.entries()) {
        if (fileHandle.kind !== "file") continue
        const m = STOCK_RE.exec(name)
        if (!m) continue
        const [, date, entity] = m
        const key = entity.toUpperCase()
        if (!imported[key]?.has(date)) {
          toUpload.push({ fileHandle, entity: key, name })
        }
      }

      if (toUpload.length === 0 || cancelled) return

      // Upload — most recent date first per entity
      toUpload.sort((a, b) => b.name.localeCompare(a.name))

      let count = 0
      for (const { fileHandle, entity } of toUpload) {
        if (cancelled) break
        try {
          const file = await fileHandle.getFile()
          await stockApi.uploadCsv(file, entity)
          count++
        } catch (e) {
          console.warn("Stock auto-import error:", e)
        }
      }

      if (count > 0 && !cancelled) {
        const msg = count === 1
          ? "1 file stock importato automaticamente"
          : `${count} file stock importati automaticamente`
        setToast(msg)
        setTimeout(() => setToast(null), 7000)
      }
    }

    run()
    return () => { cancelled = true }
  }, [user?.department])

  return { toast }
}
