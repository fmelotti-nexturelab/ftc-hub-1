import { useState } from "react"
import { X, CheckCircle, AlertCircle, Loader2, TriangleAlert } from "lucide-react"
import { getFolderHandle } from "@/utils/folderStorage"
import { stockApi } from "@/api/stock"
import * as XLSX from "xlsx/dist/xlsx.full.min.js"

const STOCK_RE = /^Stock-(\d{4}-\d{2}-\d{2})-(IT0[123])\.csv$/i

function randomString8() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("")
}

const STEPS = [
  "Lettura CSV dalla cartella...",
  "Creazione file Excel...",
  "Salvataggio FTC HUB Storage...",
  "Caricamento nel DB...",
]

export default function ExcelExportModal({ entity, stockDate, onClose }) {
  const [stepStatus, setStepStatus] = useState(STEPS.map(() => "pending"))
  const [stepMessages, setStepMessages] = useState(STEPS.map(() => null))
  const [error, setError] = useState(null)
  const [done, setDone] = useState(false)
  const [started, setStarted] = useState(false)

  function setStep(i, status, message = null) {
    setStepStatus(s => s.map((v, idx) => idx === i ? status : v))
    if (message) setStepMessages(s => s.map((v, idx) => idx === i ? message : v))
  }

  function handleStart() {
    setStarted(true)
    runExport()
  }

  async function runExport() {
    try {
      const datePart = stockDate ? stockDate.replace(/-/g, "") : new Date().toISOString().slice(0, 10).replace(/-/g, "")
      const [yyyy, mm, dd] = datePart.length === 8
        ? [datePart.slice(0, 4), datePart.slice(4, 6), datePart.slice(6, 8)]
        : ["", "", ""]

      // ── Step 0: leggi CSV ────────────────────────────────────────────────
      setStep(0, "running")
      const rootHandle = await getFolderHandle("stock_folder")
      if (!rootHandle) throw new Error("Nessuna cartella collegata nelle impostazioni")
      const perm = await rootHandle.requestPermission({ mode: "readwrite" })
      if (perm !== "granted") throw new Error("Permesso negato. Riconnetti la cartella.")
      let navHandle
      try { navHandle = await rootHandle.getDirectoryHandle("91 - Files from NAV") }
      catch { throw new Error('Sottocartella "91 - Files from NAV" non trovata') }
      const STOCK_RE = /^Stock-(\d{4}-\d{2}-\d{2})-(IT0[123])\.csv$/i
      const preferredName = stockDate ? `Stock-${stockDate}-${entity}.csv` : null
      let csvFileHandle = null
      for await (const [name, fh] of navHandle.entries()) {
        if (fh.kind !== "file") continue
        const m = STOCK_RE.exec(name)
        if (!m || m[2].toUpperCase() !== entity) continue
        if (preferredName && name === preferredName) { csvFileHandle = fh; break }
        if (!csvFileHandle) csvFileHandle = fh
      }
      if (!csvFileHandle) throw new Error(`Nessun file CSV trovato per ${entity} in "91 - Files from NAV"`)
      const csvFile = await csvFileHandle.getFile()
      const csvBuffer = await csvFile.arrayBuffer()
      const text = new TextDecoder("iso-8859-1").decode(csvBuffer)
      const lines = text.split(/\r?\n/)
      const headers = lines[0].split(";").map(h => h.trim())
      const EXCLUDED = { IT01: new Set(["IT105A"]), IT03: new Set(["IT131"]) }
      const excluded = EXCLUDED[entity] ?? new Set()
      const storeColsWithIdx = headers.map((h, i) => ({ code: h, idx: i })).slice(4).filter(({ code }) => code && !excluded.has(code))
      const storeCols = storeColsWithIdx.map(({ code }) => code)
      const parseQty = (val) => !val || !val.trim() ? 0 : Math.round(parseFloat(val.trim().replace(",", ".")) || 0)
      const items = []
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim(); if (!line) continue
        const cols = line.split(";"); const itemNo = cols[0]?.trim(); if (!itemNo) continue
        const stores = {}
        storeColsWithIdx.forEach(({ code, idx }) => { stores[code] = parseQty(cols[idx]) })
        items.push({ item_no: itemNo, description: cols[1]?.trim() || "", description_local: cols[2]?.trim() || "", adm_stock: parseQty(cols[3]), stores })
      }
      if (!items.length) throw new Error("Il file CSV è vuoto o non leggibile")
      const fixedHeaders = [headers[0], headers[1], headers[2], headers[3]]
      const headerRow = [...fixedHeaders, ...storeCols]
      setStep(0, "done")

      // ── Step 1: costruisci Excel da zero ─────────────────────────────────
      setStep(1, "running")
      const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
      const batchId = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("")
      const wb = XLSX.utils.book_new()
      const stockSheet = {}
      stockSheet[XLSX.utils.encode_cell({ r: 0, c: 1 })] = { v: batchId, t: "s" }
      headerRow.forEach((val, c) => { stockSheet[XLSX.utils.encode_cell({ r: 1, c })] = { v: val, t: "s" } })
      items.forEach((item, rowIdx) => {
        const r = rowIdx + 2
        ;[item.item_no, item.description, item.description_local, item.adm_stock].forEach((val, c) => {
          stockSheet[XLSX.utils.encode_cell({ r, c })] = { v: val, t: typeof val === "number" ? "n" : "s" }
        })
        storeCols.forEach((s, idx) => {
          stockSheet[XLSX.utils.encode_cell({ r, c: 4 + idx })] = { v: item.stores?.[s] ?? 0, t: "n" }
        })
      })
      stockSheet["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: 2 + items.length - 1, c: headerRow.length - 1 } })
      XLSX.utils.book_append_sheet(wb, stockSheet, "STOCK")
      const now = new Date()
      const dataSheet = {
        B1: { v: now.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" }), t: "s" },
        C1: { v: `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`, t: "s" },
        B5: { v: batchId, t: "s" },
        "!ref": "A1:C5",
      }
      XLSX.utils.book_append_sheet(wb, dataSheet, "data")
      const wbBytes = new Uint8Array(XLSX.write(wb, { type: "array", bookType: "xlsx", compression: true, bookSST: true }))
      setStep(1, "done")

      // ── Step 2: salva in FTC HUB Storage via backend ─────────────────
      setStep(2, "running")
      if (!yyyy) throw new Error("Data non valida")
      const ftchubFileName = `${datePart}_${entity}_StockNAV.xlsx`
      const filePath = `01_StockNAV/${yyyy}/${ftchubFileName}`
      const blob = new Blob([wbBytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
      await stockApi.saveFileToStorage(blob, filePath)
      setStep(2, "done")

      // ── Step 3: carica nel DB + registra ────────────────────────────────
      setStep(3, "running")
      await stockApi.uploadCsv(csvFile, entity)
      try {
        await stockApi.registerArchive({ file_type: "STOCK_NAV", entity, file_date: stockDate, file_path: filePath })
      } catch { /* non blocca */ }
      setStep(3, "done")

      setDone(true)
    } catch (e) {
      setError(e.message || "Errore imprevisto")
    }
  }

  const completedCount = stepStatus.filter(s => s === "done" || s === "warning").length
  const progress = Math.round((completedCount / STEPS.length) * 100)
  const hasWarnings = stepStatus.some(s => s === "warning")

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-bold text-gray-800">Esportazione Excel</h3>
          {(!started || done || error) && (
            <button onClick={onClose} aria-label="Chiudi" className="text-gray-400 hover:text-gray-600 transition">
              <X size={18} aria-hidden="true" />
            </button>
          )}
        </div>

        {/* Avvia — visibile solo prima di partire */}
        {!started && (
          <div className="mb-5">
            <button
              onClick={handleStart}
              className="w-full bg-[#1e3a5f] hover:bg-[#2563eb] text-white font-semibold py-2.5 rounded-xl shadow transition"
            >
              Avvia esportazione
            </button>
          </div>
        )}

        {started && (
        <div className="h-1.5 bg-gray-100 rounded-full mb-5 overflow-hidden">
          <div
            className="h-full bg-[#1e3a5f] rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        )}

        {started && <div className="space-y-3">
          {STEPS.map((label, i) => {
            const status = stepStatus[i]
            const msg = stepMessages[i]
            return (
              <div key={i} className="flex items-start gap-3">
                <div className="shrink-0 mt-0.5">
                  {status === "done" ? (
                    <CheckCircle size={15} className="text-green-500" />
                  ) : status === "warning" ? (
                    <TriangleAlert size={15} className="text-amber-500" />
                  ) : status === "running" ? (
                    <Loader2 size={15} className="text-[#1e3a5f] animate-spin" />
                  ) : (
                    <div className="w-[15px] h-[15px] rounded-full border-2 border-gray-200" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <span className={`text-sm ${status === "done" ? "text-gray-400" : status === "warning" ? "text-amber-700 font-medium" : status === "running" ? "text-gray-800 font-medium" : "text-gray-400"}`}>
                    {label}
                  </span>
                  {status === "warning" && msg && (
                    <p className="text-xs text-amber-600 mt-0.5">{msg}</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>}

        {error && (
          <div className="mt-5 flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2.5 leading-relaxed">
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            {error}
          </div>
        )}

        {done && !hasWarnings && (
          <div className="mt-5 flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-3 py-2.5">
            <CheckCircle size={14} className="shrink-0" />
            File aggiornato con successo.
          </div>
        )}
        {done && hasWarnings && (
          <div className="mt-5 flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-700 text-sm rounded-lg px-3 py-2.5">
            <TriangleAlert size={14} className="shrink-0" />
            File principale salvato. Alcuni archivi non sono stati aggiornati.
          </div>
        )}
      </div>
    </div>
  )
}
