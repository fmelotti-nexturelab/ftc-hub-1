import * as XLSX from "xlsx/dist/xlsx.full.min.js"
import { stockApi } from "@/api/stock"

const FILE_NAMES = {
  IT01: "tbl_Stock IT01 NAV.xlsm",
  IT02: "tbl_Stock IT02 NAV.xlsm",
  IT03: "tbl_Stock IT03 NAV.xlsm",
}

const ARCHIVE_FILE_NAMES = {
  IT01: "tbl_StockIT01NAV.xlsm",
  IT02: "tbl_StockIT02NAV.xlsm",
  IT03: "tbl_StockIT03NAV.xlsm",
}

const EXCLUDED_STORE_COLS = {
  IT01: new Set(["IT105A"]),
  IT03: new Set(["IT131"]),
}

// Step legacy (compatibilità vecchi tool)
export const EXPORT_STEPS = [
  "Lettura CSV...",
  "Apertura file Excel...",
  "Aggiornamento foglio STOCK...",
  "Aggiornamento foglio data...",
  "Salvataggio file principale...",
  "Generazione files di archivio...",
  "Archivio: Stock by location...",
  "Archivio: Commercial...",
  "Archivio: Tables_for_FTP...",
  "Archivio: FTC HUB Storage...",
]

// Step nuovo archivio (compatibilità disabilitata)
export const EXPORT_STEPS_NEW = [
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

async function writeToFolder(dirHandle, name, bytes) {
  const fh = await dirHandle.getFileHandle(name, { create: true })
  const w = await fh.createWritable()
  await w.write(bytes)
  await w.close()
}

/**
 * Flusso NUOVO (legacyMode=false):
 * 0. Lettura CSV
 * 1. Creazione Excel da zero (batchId B1, headers riga 2, dati riga 3, zeri espliciti, foglio data)
 * 2. Salvataggio FTC HUB Storage  → YYYYMMDD_STOCK_IT01_NAV.xlsx
 * 3. Caricamento nel DB + registrazione file_archive
 */
async function runStockExportNew({ entity, csvFileHandle, stockDate, ftchubStorageHandle, onStep }) {
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

  // ── Step 2: salva in FTC HUB Storage ──────────────────────────────────────
  onStep(2, "running")
  const ftchubFileName = `${datePart}_STOCK_${entity}_NAV.xlsx`
  const filePath = `stock_nav/${entity}/${yyyy}/${mm}/${dd}/${ftchubFileName}`
  if (!ftchubStorageHandle) throw new Error("Cartella FTC HUB Storage non collegata — vai in Impostazioni")
  let dir = ftchubStorageHandle
  for (const part of ["stock_nav", entity, yyyy, mm, dd]) {
    dir = await dir.getDirectoryHandle(part, { create: true })
  }
  await writeToFolder(dir, ftchubFileName, wbBytes)
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

/**
 * Esegue l'esportazione Excel per una singola entity.
 * legacyMode=true  → flusso completo con template + archivi legacy
 * legacyMode=false → solo FTC HUB Storage + DB
 */
export async function runStockExport({
  entity,
  csvFileHandle,
  stockDate,
  rootHandle,
  commercialHandle,
  ftchubStorageHandle,
  writeZeros,
  legacyMode = true,
  onStep,
}) {
  if (!legacyMode) {
    return await runStockExportNew({ entity, csvFileHandle, stockDate, ftchubStorageHandle, onStep })
  }

  // ── Step 0: leggi CSV ──────────────────────────────────────────────────────
  onStep(0, "running")
  const csvFile = await csvFileHandle.getFile()
  const csvBuffer = await csvFile.arrayBuffer()
  const { stores, fixedHeaders, items } = parseCsv(csvBuffer, entity)
  if (!items.length) throw new Error("Il file CSV è vuoto o non leggibile")
  onStep(0, "done")

  // ── Step 1: apri template Excel ────────────────────────────────────────────
  onStep(1, "running")
  let tablesHandle, xlsxFileHandle
  try {
    const serviceHandle = await rootHandle.getDirectoryHandle("97 - Service")
    tablesHandle = await serviceHandle.getDirectoryHandle("01 - Tables")
  } catch {
    throw new Error('Percorso "97 - Service / 01 - Tables" non trovato')
  }
  try {
    xlsxFileHandle = await tablesHandle.getFileHandle(FILE_NAMES[entity])
  } catch {
    throw new Error(`File "${FILE_NAMES[entity]}" non trovato in 97 - Service / 01 - Tables`)
  }
  const xlsxFile = await xlsxFileHandle.getFile()
  const xlsxBuffer = await xlsxFile.arrayBuffer()
  const workbook = XLSX.read(xlsxBuffer, { type: "array", cellStyles: false, cellNF: false, cellFormula: false })
  onStep(1, "done")

  // ── Step 2: aggiorna foglio STOCK ──────────────────────────────────────────
  onStep(2, "running")
  if (!workbook.SheetNames.includes("STOCK"))
    throw new Error('Foglio "STOCK" non trovato nel file')
  const stockSheet = workbook.Sheets["STOCK"]
  delete stockSheet["!protect"]
  for (const key of Object.keys(stockSheet)) {
    if (key.startsWith("!")) continue
    delete stockSheet[key]
  }
  const batchId = randomString8()
  stockSheet[XLSX.utils.encode_cell({ r: 0, c: 1 })] = { v: batchId, t: "s" }
  const headerRow = [...fixedHeaders, ...stores]
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
      if (!writeZeros && qty === 0) return
      stockSheet[XLSX.utils.encode_cell({ r, c: 4 + idx })] = { v: qty, t: "n" }
    })
  })
  stockSheet["!ref"] = XLSX.utils.encode_range({
    s: { r: 0, c: 0 },
    e: { r: 2 + items.length - 1, c: headerRow.length - 1 },
  })
  stockSheet["!protect"] = { password: "lol", sheet: true }
  onStep(2, "done")

  // ── Step 3: aggiorna foglio data ───────────────────────────────────────────
  onStep(3, "running")
  if (!workbook.SheetNames.includes("data"))
    throw new Error('Foglio "data" non trovato nel file')
  const dataSheet = workbook.Sheets["data"]
  delete dataSheet["!protect"]
  const now = new Date()
  dataSheet["B1"] = { v: now.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" }), t: "s" }
  dataSheet["C1"] = { v: `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`, t: "s" }
  dataSheet["B5"] = { v: batchId, t: "s" }
  dataSheet["!protect"] = { password: "lol", sheet: true }
  onStep(3, "done")

  // ── Step 4: salva file principale ──────────────────────────────────────────
  onStep(4, "running")
  const wbout = XLSX.write(workbook, { type: "array", bookType: "xlsm", compression: true, bookSST: true })
  const wbBytes = new Uint8Array(wbout)
  const writable = await xlsxFileHandle.createWritable()
  await writable.write(wbBytes)
  await writable.close()
  onStep(4, "done")

  const datePart = stockDate.replace(/-/g, "")
  const archiveFileName = `${datePart} ${entity} STOCK NAV.xlsx`

  // Buffer FTP: identico al principale ma con zeri espliciti
  if (!writeZeros) {
    items.forEach((item, rowIdx) => {
      const r = rowIdx + 2
      stores.forEach((s, idx) => {
        const cell = XLSX.utils.encode_cell({ r, c: 4 + idx })
        if (!stockSheet[cell]) {
          stockSheet[cell] = { v: 0, t: "n" }
        }
      })
    })
  }
  const wbBytesForFTP = new Uint8Array(XLSX.write(workbook, { type: "array", bookType: "xlsm", compression: true, bookSST: true }))

  // ── Step 5: genera workbook archivio pulito ────────────────────────────────
  onStep(5, "running")
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
  onStep(5, "done")

  // ── Step 6: archivio Stock by location ─────────────────────────────────────
  onStep(6, "running")
  try {
    let d1, d2
    try { d1 = await rootHandle.getDirectoryHandle("02 - Stock by location") }
    catch { throw new Error("Cartella '02 - Stock by location' non trovata nella root") }
    try { d2 = await d1.getDirectoryHandle("NAV  ( dati solo di test )") }
    catch { throw new Error("Sottocartella 'NAV  ( dati solo di test )' non trovata in '02 - Stock by location'") }
    try { await writeToFolder(d2, archiveFileName, archiveBytesXlsx) }
    catch { throw new Error(`Impossibile scrivere '${archiveFileName}' in 'NAV  ( dati solo di test )'`) }
    onStep(6, "done")
  } catch (e) { onStep(6, "warning", e.message) }

  // ── Step 7: archivio Commercial ────────────────────────────────────────────
  onStep(7, "running")
  try {
    if (!commercialHandle) throw new Error("Cartella Commercial non collegata — vai in Impostazioni e collega 'One Italy Commercial - Files'")
    let d1
    try { d1 = await commercialHandle.getDirectoryHandle("28 - Italy Shared Folder") }
    catch { throw new Error("Sottocartella '28 - Italy Shared Folder' non trovata nella cartella Commercial") }
    try { await writeToFolder(d1, archiveFileName, archiveBytesXlsx) }
    catch { throw new Error(`Impossibile scrivere '${archiveFileName}' in '28 - Italy Shared Folder'`) }
    onStep(7, "done")
  } catch (e) { onStep(7, "warning", e.message) }

  // ── Step 8: archivio Tables_for_FTP ───────────────────────────────────────
  onStep(8, "running")
  try {
    let d1, d2, d3
    try { d1 = await rootHandle.getDirectoryHandle("97 - Service") }
    catch { throw new Error("Cartella '97 - Service' non trovata nella root") }
    try { d2 = await d1.getDirectoryHandle("01 - Tables") }
    catch { throw new Error("Sottocartella '01 - Tables' non trovata in '97 - Service'") }
    try { d3 = await d2.getDirectoryHandle("Tables_for_FTP") }
    catch { throw new Error("Sottocartella 'Tables_for_FTP' non trovata in '97 - Service/01 - Tables'") }
    try { await writeToFolder(d3, ARCHIVE_FILE_NAMES[entity], wbBytesForFTP) }
    catch { throw new Error(`Impossibile scrivere '${ARCHIVE_FILE_NAMES[entity]}' in 'Tables_for_FTP'`) }
    onStep(8, "done")
  } catch (e) { onStep(8, "warning", e.message) }

  // ── Step 9: archivio FTC HUB Storage ──────────────────────────────────────
  onStep(9, "running")
  try {
    if (!ftchubStorageHandle) throw new Error("Cartella FTC HUB Storage non collegata — vai in Impostazioni e collega la cartella")
    const [yyyy, mm, dd] = stockDate.split("-")
    const ftchubFileName = `${datePart}_STOCK_${entity}_NAV.xlsx`
    const filePath = `stock_nav/${entity}/${yyyy}/${mm}/${dd}/${ftchubFileName}`
    let dir = ftchubStorageHandle
    for (const part of ["stock_nav", entity, yyyy, mm, dd]) {
      dir = await dir.getDirectoryHandle(part, { create: true })
    }
    await writeToFolder(dir, ftchubFileName, archiveBytesXlsx)
    try {
      await stockApi.registerArchive({ file_type: "STOCK_NAV", entity, file_date: stockDate, file_path: filePath })
    } catch { /* non blocca se la registrazione fallisce */ }
    onStep(9, "done")
  } catch (e) { onStep(9, "warning", e.message) }
}
