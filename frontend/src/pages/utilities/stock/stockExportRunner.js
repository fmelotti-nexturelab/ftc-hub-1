import * as XLSX from "xlsx/dist/xlsx.full.min.js"
import { stockApi } from "@/api/stock"

const EXCLUDED_STORE_COLS = {
  IT01: new Set(["IT105A"]),
  IT03: new Set(["IT131"]),
}

export const EXPORT_STEPS = [
  "Lettura CSV...",
  "Creazione file Excel...",
  "Salvataggio FTC HUB Storage...",
  "Caricamento nel DB...",
]

function randomString8() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("")
}

function parseCsv(arrayBuffer, entity) {
  const text = new TextDecoder("iso-8859-1").decode(arrayBuffer)
  const lines = text.split(/\r?\n/)
  const headers = lines[0].split(";").map(h => h.trim())
  const excluded = EXCLUDED_STORE_COLS[entity] ?? new Set()
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

  const fixedHeaders = [headers[0], headers[1], headers[2], headers[3]]
  return { stores: storeCols, fixedHeaders, items }
}

/**
 * Esegue l'esportazione Excel per una singola entity.
 * 0. Lettura CSV
 * 1. Creazione Excel (batchId B1, headers riga 2, dati riga 3, zeri espliciti, foglio data)
 * 2. Salvataggio FTC HUB Storage → YYYYMMDD_ENTITY_StockNAV.xlsx
 * 3. Caricamento nel DB + registrazione file_archive
 */
export async function runStockExport({ entity, csvFileHandle, stockDate, onStep }) {
  const datePart = stockDate.replace(/-/g, "")
  const [yyyy, mm, dd] = stockDate.split("-")

  // ── Step 0: leggi CSV ──────────────────────────────────────────────────────
  onStep(0, "running")
  const csvFile = await csvFileHandle.getFile()
  const csvBuffer = await csvFile.arrayBuffer()
  const { stores, fixedHeaders, items } = parseCsv(csvBuffer, entity)
  if (!items.length) throw new Error("Il file CSV è vuoto o non leggibile")
  onStep(0, "done")

  // ── Step 1: costruisci Excel da zero ───────────────────────────────────────
  onStep(1, "running")
  const batchId = randomString8()
  const headerRow = [...fixedHeaders, ...stores]
  const wb = XLSX.utils.book_new()

  // Foglio STOCK: riga 0 = batchId in B1, riga 1 = intestazioni, riga 2+ = dati
  const stockSheet = {}
  stockSheet[XLSX.utils.encode_cell({ r: 0, c: 1 })] = { v: batchId, t: "s" }
  headerRow.forEach((val, c) => {
    stockSheet[XLSX.utils.encode_cell({ r: 1, c })] = { v: val, t: "s" }
  })
  items.forEach((item, rowIdx) => {
    const r = rowIdx + 2
    const fixedCols = [item.item_no, item.description, item.description_local, item.adm_stock]
    fixedCols.forEach((val, c) => {
      stockSheet[XLSX.utils.encode_cell({ r, c })] = { v: val, t: typeof val === "number" ? "n" : "s" }
    })
    stores.forEach((s, idx) => {
      const qty = item.stores?.[s] ?? 0
      stockSheet[XLSX.utils.encode_cell({ r, c: 4 + idx })] = { v: qty, t: "n" }
    })
  })
  stockSheet["!ref"] = XLSX.utils.encode_range({
    s: { r: 0, c: 0 },
    e: { r: 2 + items.length - 1, c: headerRow.length - 1 },
  })
  XLSX.utils.book_append_sheet(wb, stockSheet, "STOCK")

  // Foglio data: B1=data, C1=ora, B5=batchId
  const now = new Date()
  const dataSheet = {
    B1: { v: now.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" }), t: "s" },
    C1: { v: `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`, t: "s" },
    B5: { v: batchId, t: "s" },
    "!ref": "A1:C5",
  }
  XLSX.utils.book_append_sheet(wb, dataSheet, "data")

  const wbBytes = new Uint8Array(XLSX.write(wb, { type: "array", bookType: "xlsx", compression: true, bookSST: true }))
  onStep(1, "done")

  // ── Step 2: salva in FTC HUB Storage via backend ──────────────────────────
  onStep(2, "running")
  const ftchubFileName = `${datePart}_${entity}_StockNAV.xlsx`
  const filePath = `01_StockNAV/${yyyy}/${ftchubFileName}`
  const blob = new Blob([wbBytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
  await stockApi.saveFileToStorage(blob, filePath)
  onStep(2, "done")

  // ── Step 3: carica nel DB + registra in file_archive ──────────────────────
  onStep(3, "running")
  await stockApi.uploadCsv(csvFile, entity)
  await stockApi.registerArchive({
    file_type: "STOCK_NAV",
    entity,
    file_date: stockDate,
    file_path: filePath,
  })
  onStep(3, "done")
}
