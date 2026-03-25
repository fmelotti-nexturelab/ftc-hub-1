import { useEffect, useState } from "react"
import { X, CheckCircle, AlertCircle, Loader2, TriangleAlert } from "lucide-react"
import { getFolderHandle } from "@/utils/folderStorage"
import * as XLSX from "xlsx/dist/xlsx.full.min.js"

const FILE_NAMES = {
  IT01: "tbl_Stock IT01 NAV.xlsm",
  IT02: "tbl_Stock IT02 NAV.xlsm",
  IT03: "tbl_Stock IT03 NAV.xlsm",
}

const STOCK_RE = /^Stock-(\d{4}-\d{2}-\d{2})-(IT0[123])\.csv$/i

function randomString8() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("")
}

const EXCLUDED_STORE_COLS = {
  IT01: new Set(["IT105A"]),
  IT03: new Set(["IT131"]),
}

/** Parse a latin-1 CSV with ; delimiter. Returns { stores, fixedHeaders, items } */
function parseCsv(arrayBuffer, entity) {
  const text = new TextDecoder("iso-8859-1").decode(arrayBuffer)
  const lines = text.split(/\r?\n/)

  const headers = lines[0].split(";").map(h => h.trim())
  const excluded = EXCLUDED_STORE_COLS[entity] ?? new Set()
  // Columns: item_no(0), description(1), description_local(2), adm(3), stores(4+)
  // Mappa { code: originalIndex } per le colonne store da tenere
  const storeColsWithIdx = headers
    .map((h, i) => ({ code: h, idx: i }))
    .slice(4)
    .filter(({ code }) => code && !excluded.has(code))
  const storeCols = storeColsWithIdx.map(({ code }) => code)

  const parseQty = (val) => {
    if (!val || !val.trim()) return 0
    return Math.round(parseFloat(val.trim().replace(",", ".")) || 0)
  }

  const items = []
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    const cols = line.split(";")
    const itemNo = cols[0]?.trim()
    if (!itemNo) continue
    const stores = {}
    storeColsWithIdx.forEach(({ code, idx }) => {
      stores[code] = parseQty(cols[idx])
    })
    items.push({
      item_no: itemNo,
      description: cols[1]?.trim() || "",
      description_local: cols[2]?.trim() || "",
      adm_stock: parseQty(cols[3]),
      stores,
    })
  }

  const fixedHeaders = [headers[0], headers[1], headers[2], headers[3]] // item_no, description, description_local, adm
  return { stores: storeCols, fixedHeaders, items }
}

const ARCHIVE_FILE_NAMES = {
  IT01: "tbl_StockIT01NAV.xlsm",
  IT02: "tbl_StockIT02NAV.xlsm",
  IT03: "tbl_StockIT03NAV.xlsm",
}

const STEPS = [
  "Lettura CSV dalla cartella...",
  "Apertura file Excel...",
  "Aggiornamento foglio STOCK...",
  "Aggiornamento foglio data...",
  "Salvataggio file principale...",
  "Generazione files di archivio...",
  "Archivio: Stock by location...",
  "Archivio: Commercial...",
  "Archivio: Tables_for_FTP...",
]

export default function ExcelExportModal({ entity, stockDate, onClose }) {
  const [stepStatus, setStepStatus] = useState(STEPS.map(() => "pending"))
  const [stepMessages, setStepMessages] = useState(STEPS.map(() => null))
  const [error, setError] = useState(null)
  const [done, setDone] = useState(false)
  const [writeZeros, setWriteZeros] = useState(false)
  const [started, setStarted] = useState(false)

  function setStep(i, status, message = null) {
    setStepStatus(s => s.map((v, idx) => idx === i ? status : v))
    if (message) setStepMessages(s => s.map((v, idx) => idx === i ? message : v))
  }

  function handleStart() {
    setStarted(true)
    runExport(writeZeros)
  }

  async function runExport(withZeros) {
    try {
      // ── Step 0: read CSV ───────────────────────────────────────────────────
      setStep(0, "running")
      const rootHandle = await getFolderHandle("stock_folder")
      if (!rootHandle) throw new Error("Nessuna cartella collegata nelle impostazioni")

      const perm = await rootHandle.requestPermission({ mode: "readwrite" })
      if (perm !== "granted") throw new Error("Permesso negato. Riconnetti la cartella.")

      let navHandle
      try {
        navHandle = await rootHandle.getDirectoryHandle("91 - Files from NAV")
      } catch {
        throw new Error('Sottocartella "91 - Files from NAV" non trovata')
      }

      let csvFileHandle = null
      const preferredName = stockDate ? `Stock-${stockDate}-${entity}.csv` : null
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
      const { stores, fixedHeaders, items } = parseCsv(csvBuffer, entity)
      if (!items.length) throw new Error("Il file CSV è vuoto o non leggibile")
      setStep(0, "done")

      // ── Step 1: open xlsx template ─────────────────────────────────────────
      setStep(1, "running")
      let tablesHandle
      try {
        const serviceHandle = await rootHandle.getDirectoryHandle("97 - Service")
        tablesHandle = await serviceHandle.getDirectoryHandle("01 - Tables")
      } catch {
        throw new Error('Percorso "97 - Service / 01 - Tables" non trovato')
      }

      const fileName = FILE_NAMES[entity]
      let xlsxFileHandle
      try {
        xlsxFileHandle = await tablesHandle.getFileHandle(fileName)
      } catch {
        throw new Error(`File "${fileName}" non trovato in 97 - Service / 01 - Tables`)
      }

      const xlsxFile = await xlsxFileHandle.getFile()
      const xlsxBuffer = await xlsxFile.arrayBuffer()
      const workbook = XLSX.read(xlsxBuffer, { type: "array", cellStyles: false, cellNF: false, cellFormula: false })
      setStep(1, "done")

      // ── Step 2: update STOCK sheet ─────────────────────────────────────────
      setStep(2, "running")
      if (!workbook.SheetNames.includes("STOCK"))
        throw new Error('Foglio "STOCK" non trovato nel file')

      const stockSheet = workbook.Sheets["STOCK"]
      delete stockSheet["!protect"]

      // Clear tutto il foglio (header incluso)
      for (const key of Object.keys(stockSheet)) {
        if (key.startsWith("!")) continue
        delete stockSheet[key]
      }

      const batchId = randomString8()

      // Riga 1 (r=0): solo batchId in B1
      stockSheet[XLSX.utils.encode_cell({ r: 0, c: 1 })] = { v: batchId, t: "s" }

      // Riga 2 (r=1): intestazioni
      const headerRow = [...fixedHeaders, ...stores]
      headerRow.forEach((val, c) => {
        stockSheet[XLSX.utils.encode_cell({ r: 1, c })] = { v: val, t: "s" }
      })

      // Riga 3+ (r=2+): dati
      items.forEach((item, rowIdx) => {
        const r = rowIdx + 2
        const fixedCols = [item.item_no, item.description, item.description_local, item.adm_stock]
        // Colonne fisse sempre scritte
        fixedCols.forEach((val, c) => {
          stockSheet[XLSX.utils.encode_cell({ r, c })] = { v: val, t: typeof val === "number" ? "n" : "s" }
        })
        // Colonne store: scrivi sempre se withZeros, altrimenti salta gli zeri
        stores.forEach((s, idx) => {
          const qty = item.stores?.[s] ?? 0
          if (!withZeros && qty === 0) return
          stockSheet[XLSX.utils.encode_cell({ r, c: 4 + idx })] = { v: qty, t: "n" }
        })
      })

      stockSheet["!ref"] = XLSX.utils.encode_range({
        s: { r: 0, c: 0 },
        e: { r: 2 + items.length - 1, c: headerRow.length - 1 },
      })
      stockSheet["!protect"] = { password: "lol", sheet: true }
      setStep(2, "done")

      // ── Step 3: update data sheet ──────────────────────────────────────────
      setStep(3, "running")
      if (!workbook.SheetNames.includes("data"))
        throw new Error('Foglio "data" non trovato nel file')

      const dataSheet = workbook.Sheets["data"]
      delete dataSheet["!protect"]

      const now = new Date()
      dataSheet["B1"] = { v: now.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" }), t: "s" }
      dataSheet["C1"] = { v: `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`, t: "s" }
      dataSheet["B5"] = { v: batchId, t: "s" }
      dataSheet["!protect"] = { password: "lol", sheet: true }
      setStep(3, "done")

      // ── Step 4: salva file principale ─────────────────────────────────────
      setStep(4, "running")
      const wbout = XLSX.write(workbook, { type: "array", bookType: "xlsm", compression: true, bookSST: true })
      const wbBytes = new Uint8Array(wbout)
      // Buffer xlsx per le copie archivio con estensione .xlsx
      const wboutXlsx = XLSX.write(workbook, { type: "array", bookType: "xlsx", compression: true, bookSST: true })
      const wbBytesXlsx = new Uint8Array(wboutXlsx)
      const writable = await xlsxFileHandle.createWritable()
      await writable.write(wbBytes)
      await writable.close()
      setStep(4, "done")

      // Nome file archivio con data: yyyymmdd IT0x STOCK NAV.xlsx
      const datePart = stockDate ? stockDate.replace(/-/g, "") : new Date().toISOString().slice(0, 10).replace(/-/g, "")
      const archiveFileName = `${datePart} ${entity} STOCK NAV.xlsx`

      // Helper: scrive bytes in una cartella con create:true
      async function writeToFolder(dirHandle, name, bytes) {
        const fh = await dirHandle.getFileHandle(name, { create: true })
        const w = await fh.createWritable()
        await w.write(bytes)
        await w.close()
      }

      // ── Step 5: genera workbook archivio pulito (intestazione in riga 1, no batchId) ──
      setStep(5, "running")
      const buildArchiveWb = (withZeros) => {
        const rows = [
          headerRow,
          ...items.map(item => [
            item.item_no,
            item.description,
            item.description_local,
            item.adm_stock,
            ...stores.map(s => { const q = item.stores?.[s] ?? 0; return (withZeros || q !== 0) ? q : null }),
          ]),
        ]
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), "STOCK")
        return wb
      }
      const archiveBytesXlsx = new Uint8Array(XLSX.write(buildArchiveWb(false), { type: "array", bookType: "xlsx", compression: true }))
      const archiveBytesXlsm = new Uint8Array(XLSX.write(buildArchiveWb(true),  { type: "array", bookType: "xlsm", compression: true }))
      setStep(5, "done")

      // ── Step 6: archivio Stock by location ────────────────────────────────
      setStep(6, "running")
      try {
        let d1, d2
        try { d1 = await rootHandle.getDirectoryHandle("02 - Stock by location") }
        catch { throw new Error("Cartella '02 - Stock by location' non trovata nella root") }
        try { d2 = await d1.getDirectoryHandle("NAV  ( dati solo di test )") }
        catch { throw new Error("Sottocartella 'NAV  ( dati solo di test )' non trovata in '02 - Stock by location'") }
        try { await writeToFolder(d2, archiveFileName, archiveBytesXlsx) }
        catch { throw new Error(`Impossibile scrivere '${archiveFileName}' in '02 - Stock by location/NAV'`) }
        setStep(6, "done")
      } catch (e) {
        setStep(6, "warning", e.message)
      }

      // ── Step 7: archivio Commercial ───────────────────────────────────────
      setStep(7, "running")
      try {
        const commercialRoot = await getFolderHandle("stock_folder_commercial")
        if (!commercialRoot) throw new Error("Cartella Commercial non collegata — vai in Impostazioni e collega 'One Italy Commercial - Files'")
        const perm2 = await commercialRoot.requestPermission({ mode: "readwrite" })
        if (perm2 !== "granted") throw new Error("Permesso negato sulla cartella Commercial — riconnettila nelle Impostazioni")
        let d1
        try { d1 = await commercialRoot.getDirectoryHandle("28 - Italy Shared Folder") }
        catch { throw new Error("Sottocartella '28 - Italy Shared Folder' non trovata nella cartella Commercial") }
        try { await writeToFolder(d1, archiveFileName, archiveBytesXlsx) }
        catch { throw new Error(`Impossibile scrivere '${archiveFileName}' in '28 - Italy Shared Folder'`) }
        setStep(7, "done")
      } catch (e) {
        setStep(7, "warning", e.message)
      }

      // ── Step 8: archivio Tables_for_FTP ───────────────────────────────────
      setStep(8, "running")
      try {
        let d1, d2, d3
        try { d1 = await rootHandle.getDirectoryHandle("97 - Service") }
        catch { throw new Error("Cartella '97 - Service' non trovata nella root") }
        try { d2 = await d1.getDirectoryHandle("01 - Tables") }
        catch { throw new Error("Sottocartella '01 - Tables' non trovata in '97 - Service'") }
        try { d3 = await d2.getDirectoryHandle("Tables_for_FTP") }
        catch { throw new Error("Sottocartella 'Tables_for_FTP' non trovata in '97 - Service/01 - Tables'") }
        try { await writeToFolder(d3, ARCHIVE_FILE_NAMES[entity], archiveBytesXlsm) }
        catch { throw new Error(`Impossibile scrivere '${ARCHIVE_FILE_NAMES[entity]}' in 'Tables_for_FTP'`) }
        setStep(8, "done")
      } catch (e) {
        setStep(8, "warning", e.message)
      }

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

        {/* Toggle + avvia — visibile solo prima di partire */}
        {!started && (
          <div className="mb-5 space-y-4">
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={writeZeros}
                onChange={e => setWriteZeros(e.target.checked)}
                className="w-4 h-4 accent-[#1e3a5f]"
              />
              <div>
                <span className="text-sm font-medium text-gray-700">Scrivi zeri espliciti</span>
                <p className="text-xs text-gray-400 mt-0.5">File più grande ma mostra 0 per ogni negozio senza stock</p>
              </div>
            </label>
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
