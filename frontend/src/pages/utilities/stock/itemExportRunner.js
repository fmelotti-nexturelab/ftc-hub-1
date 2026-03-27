import * as XLSX from "xlsx/dist/xlsx.full.min.js"

export const EXPORT_STEPS = [
  "Parsing dati incollati...",
  "Generazione tbl_ItemM.xlsm...",
  "Salvataggio in 97 - Service / 01 - Tables...",
  "Copia in Tables_for_FTP...",
  "Generazione ItemM.xlsx...",
  "Salvataggio in 01 - Item List...",
  "Generazione ItemList_portale.xlsx...",
]

// Le 12 colonne del file portale (sottoinsieme delle prime 12 di KEEP_COLUMNS)
const PORTALE_COL_COUNT = 12

// Righe fisse da appendere in fondo al portale (zone inventario)
const PORTALE_EXTRA_ROWS = [
  ["armadietto", "armadietto", "armadietto", 1, 1, 1, 1, 0, "armadietto",  "BTW22", 0, 0],
  ["table",      "table",      "table",      1, 1, 1, 1, 0, "table",       "BTW22", 0, 0],
  ["dogs",       "dogs",       "dogs",       1, 1, 1, 1, 0, "dogs",        "BTW22", 0, 0],
  ["extra",      "extra",      "extra",      1, 1, 1, 1, 0, "extra",       "BTW22", 0, 0],
  ["magazino",   "magazino",   "magazino",   1, 1, 1, 1, 0, "magazino1",   "BTW22", 0, 0],
  ["pallet",     "pallet",     "pallet",     1, 1, 1, 1, 0, "pallet",      "BTW22", 0, 0],
  ["reklamation","reklamation","reklamation",1, 1, 1, 1, 0, "reklamation", "BTW22", 0, 0],
  ["slatwall",   "slatwall",   "slatwall",   1, 1, 1, 1, 0, "slatwall",    "BTW22", 0, 0],
]

function randomString8() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("")
}

// Colonne da mantenere nell'output (nell'ordine del file di riferimento, 21 colonne)
const KEEP_COLUMNS = [
  "Nr.",
  "Descrizione",
  "Description in Local Language",
  "Magazzino",
  "Ultimo costo diretto",
  "Prezzo unitario",
  "Codice categoria articolo",
  "Peso netto",
  "Barcode",
  "Cat. reg. art./serv. IVA",
  "Unità per collo",
  "MODEL STORE",
  "Batterie",
  "First RP",
  "Category",
  "Barcode ext.",
  "IVA",
  "GM% escl. Trasporto",
  "Descrizione1",
  "Descrizione2",
]

function parseTsv(text) {
  const lines = text.split(/\r?\n/)
  const rows = []
  for (const line of lines) {
    if (!line.trim()) continue
    rows.push(line.split("\t"))
  }
  return rows
}

/**
 * Converte una stringa cella Excel (con formato italiano) nel tipo JS corretto.
 * Gestisce: interi, decimali con virgola ("1,25"), percentuali ("70%"),
 * notazione scientifica italiana ("1,41414E+12").
 */
function toValue(str) {
  if (str === undefined || str === null) return ""
  const trimmed = str.trim()
  if (trimmed === "") return ""

  // Percentuale italiana: "70%" o "70,5%" → 0.70 / 0.705
  if (/^-?\d+([,.]?\d+)?%$/.test(trimmed)) {
    const num = parseFloat(trimmed.replace(",", ".").replace("%", ""))
    return num / 100
  }

  // Notazione scientifica (con virgola o punto come separatore decimale)
  // Es: "1,41414E+12" → 1414140000000, "2E+11" → 200000000000
  if (/^-?\d+([,.]\d+)?[eE][+-]?\d+$/.test(trimmed)) {
    return Math.round(parseFloat(trimmed.replace(",", ".")))
  }

  // Intero puro
  if (/^-?\d+$/.test(trimmed)) return Number(trimmed)

  // Decimale con punto: "1.25"
  if (/^-?\d+\.\d+$/.test(trimmed)) return Number(trimmed)

  // Decimale italiano con virgola: "1,25"
  if (/^-?\d+,\d+$/.test(trimmed)) return parseFloat(trimmed.replace(",", "."))

  return trimmed
}

/** Calcola il numero settimana ISO per una data. */
function isoWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const day = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7)
}

async function writeToFolder(dirHandle, name, bytes) {
  const fh = await dirHandle.getFileHandle(name, { create: true })
  const w = await fh.createWritable()
  await w.write(bytes)
  await w.close()
}

/**
 * Filtra headers e dataRows mantenendo solo le colonne in KEEP_COLUMNS (nell'ordine definito).
 * Le colonne non presenti in KEEP_COLUMNS vengono scartate.
 * Le colonne in KEEP_COLUMNS non trovate nell'input vengono ignorate silenziosamente.
 */
function filterColumns(headers, dataRows) {
  const srcIdx = KEEP_COLUMNS.map(name => headers.indexOf(name)).filter(i => i !== -1)
  const keptHeaders = srcIdx.map(i => headers[i])
  const keptRows = dataRows.map(row => srcIdx.map(i => row[i] ?? ""))
  return { headers: keptHeaders, dataRows: keptRows, colCount: keptHeaders.length }
}

/**
 * Costruisce il foglio "ITEMS" e il foglio "data" per tbl_ItemM.xlsm.
 * Logica condivisa tra runItemExport e runItemDebug.
 */
function buildXlsm(headers, dataRows, colCount, batchId, today) {
  // ── Foglio ITEMS ────────────────────────────────────────────────────────────
  const itemsSheet = {}

  // A1: sentinel intero
  itemsSheet[XLSX.utils.encode_cell({ r: 0, c: 0 })] = { v: 98989898989898, t: "n" }
  // B1: batchId
  itemsSheet[XLSX.utils.encode_cell({ r: 0, c: 1 })] = { v: batchId, t: "s" }

  // Riga 2 (r=1): intestazioni
  headers.forEach((h, c) => {
    itemsSheet[XLSX.utils.encode_cell({ r: 1, c })] = { v: String(h), t: "s" }
  })

  // Riga 3+ (r=2+): dati
  dataRows.forEach((row, rowIdx) => {
    row.forEach((cell, c) => {
      const val = toValue(cell)
      if (val === "") return
      itemsSheet[XLSX.utils.encode_cell({ r: rowIdx + 2, c })] = {
        v: val,
        t: typeof val === "number" ? "n" : "s",
      }
    })
  })

  itemsSheet["!ref"] = XLSX.utils.encode_range({
    s: { r: 0, c: 0 },
    e: { r: dataRows.length + 1, c: colCount - 1 },
  })
  itemsSheet["!protect"] = { password: "lol", sheet: true }

  // ── Foglio data ─────────────────────────────────────────────────────────────
  const dataSheet = {}
  const week = isoWeek(today)
  const weekStr = `week ${String(week).padStart(2, "0")}`

  // Label colonna A
  dataSheet["A1"] = { v: "data ultima modifica", t: "s" }
  dataSheet["A2"] = { v: "messaggio", t: "s" }
  dataSheet["A5"] = { v: "matricola", t: "s" }

  // B1: solo data (senza orario) — come fa il tool di riferimento
  const dateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  dataSheet["B1"] = { v: dateOnly, t: "d", z: "mm-dd-yy" }
  // C1: solo orario come frazione di giorno (0..1) — valore numerico con formato ora
  const fracDay = (today.getHours() * 3600 + today.getMinutes() * 60 + today.getSeconds()) / 86400
  dataSheet["C1"] = { v: fracDay, t: "n", z: "h:mm;@" }

  // B2: settimana corrente
  dataSheet["B2"] = { v: weekStr, t: "s" }

  // B5: batchId (matricola)
  dataSheet["B5"] = { v: batchId, t: "s" }

  dataSheet["!ref"] = "A1:C5"
  dataSheet["!protect"] = { password: "lol", sheet: true }

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, itemsSheet, "ITEMS")
  XLSX.utils.book_append_sheet(wb, dataSheet, "data")

  return new Uint8Array(
    XLSX.write(wb, { type: "array", bookType: "xlsm", compression: true, bookSST: true })
  )
}

// ── ZIP / XLSX builder minimale (bypassa xlsx.js per evitare contaminazione) ─

const CRC32_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1)
    t[i] = c
  }
  return t
})()

function crc32(data) {
  let crc = 0xFFFFFFFF
  for (let i = 0; i < data.length; i++) crc = CRC32_TABLE[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8)
  return (crc ^ 0xFFFFFFFF) >>> 0
}

async function deflateData(data) {
  if (typeof CompressionStream === "undefined") return { out: data, method: 0 }
  const cs = new CompressionStream("deflate-raw")
  const writer = cs.writable.getWriter()
  writer.write(data)
  writer.close()
  const chunks = []
  const reader = cs.readable.getReader()
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
  }
  const len = chunks.reduce((s, c) => s + c.length, 0)
  const out = new Uint8Array(len)
  let pos = 0
  for (const c of chunks) { out.set(c, pos); pos += c.length }
  return out.length < data.length ? { out, method: 8 } : { out: data, method: 0 }
}

async function packZip(files) {
  const enc = new TextEncoder()
  const entries = []
  for (const file of files) {
    const nameBytes = enc.encode(file.name)
    const uncSize = file.data.length
    const crc = crc32(file.data)
    const { out: compressed, method } = await deflateData(file.data)
    entries.push({ nameBytes, uncSize, crc, compressed, method })
  }

  const localParts = []
  const centralDir = []
  let offset = 0
  for (let i = 0; i < entries.length; i++) {
    const { nameBytes, uncSize, crc, compressed, method } = entries[i]
    const lh = new Uint8Array(30 + nameBytes.length)
    const lv = new DataView(lh.buffer)
    lv.setUint32(0, 0x04034b50, true); lv.setUint16(4, 20, true);  lv.setUint16(6, 0, true)
    lv.setUint16(8, method, true);     lv.setUint16(10, 0, true);   lv.setUint16(12, 0, true)
    lv.setUint32(14, crc, true);       lv.setUint32(18, compressed.length, true)
    lv.setUint32(22, uncSize, true);   lv.setUint16(26, nameBytes.length, true); lv.setUint16(28, 0, true)
    lh.set(nameBytes, 30)

    const cd = new Uint8Array(46 + nameBytes.length)
    const cv = new DataView(cd.buffer)
    cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 20, true);  cv.setUint16(6, 20, true)
    cv.setUint16(8, 0, true);          cv.setUint16(10, method, true); cv.setUint16(12, 0, true)
    cv.setUint16(14, 0, true);         cv.setUint32(16, crc, true)
    cv.setUint32(20, compressed.length, true); cv.setUint32(24, uncSize, true)
    cv.setUint16(28, nameBytes.length, true);  cv.setUint16(30, 0, true); cv.setUint16(32, 0, true)
    cv.setUint16(34, 0, true);         cv.setUint16(36, 0, true)
    cv.setUint32(38, 0, true);         cv.setUint32(42, offset, true)
    cd.set(nameBytes, 46)

    localParts.push(lh, compressed)
    centralDir.push(cd)
    offset += lh.length + compressed.length
  }

  const cdOffset = offset
  const cdSize = centralDir.reduce((s, c) => s + c.length, 0)
  const eocd = new Uint8Array(22)
  const ev = new DataView(eocd.buffer)
  ev.setUint32(0, 0x06054b50, true); ev.setUint16(4, 0, true);  ev.setUint16(6, 0, true)
  ev.setUint16(8, entries.length, true); ev.setUint16(10, entries.length, true)
  ev.setUint32(12, cdSize, true);    ev.setUint32(16, cdOffset, true); ev.setUint16(20, 0, true)

  const all = [...localParts, ...centralDir, eocd]
  const total = all.reduce((s, p) => s + p.length, 0)
  const result = new Uint8Array(total)
  let pos = 0
  for (const p of all) { result.set(p, pos); pos += p.length }
  return result
}

/**
 * Costruisce yyyymmdd - ItemList_portale.xlsx.
 * Genera l'XLSX manualmente (ZIP + XML) senza XLSX.write() per evitare
 * la contaminazione con customXml/metadata/theme che causa il rifiuto del portale.
 */
async function buildPortaleXlsx(headers, dataRows) {
  const ENG_COL     = 1   // Descrizione
  const ITA_COL     = 2   // Description in Local Language
  const BARCODE_COL = 8   // Barcode (colonna I)
  const UPC_COL     = 10  // Unita per collo
  const IVA_COL     = 9   // Cat. reg. art./serv. IVA

  const portaleHeaders = headers.slice(0, PORTALE_COL_COUNT).map(h =>
    h === "Unità per collo" ? "Unita per collo" : h
  )

  // Step 3 — rimuovi righe con barcode vuoto/zero
  // Step 4 — rimuovi righe con UPC blank; rimuovi righe con IVA vuota
  const filtered = dataRows.filter(row => {
    const barcode = row[BARCODE_COL]
    const upc     = row[UPC_COL]
    const iva     = row[IVA_COL]
    const barcodeOk = barcode !== "" && barcode !== 0 && barcode !== "0"
    const upcOk     = upc !== "" && upc !== null && upc !== undefined
    const ivaOk     = iva !== "" && iva !== null && iva !== undefined
    return barcodeOk && upcOk && ivaOk
  })

  // Steps 6-7 — completa descrizioni mancanti (ITA ↔ ENG)
  const normalized = filtered.map(row => {
    const r   = [...row]
    const eng = (r[ENG_COL] ?? "").toString().trim()
    const ita = (r[ITA_COL] ?? "").toString().trim()
    if (ita === "" && eng !== "") r[ITA_COL] = eng
    if (eng === "" && ita !== "") r[ENG_COL] = ita
    return r
  })

  // ── Mappa delle celle: { val, isStr, isBarcode } ───────────────────────────
  // val === null → cella vuota (non emessa)
  const buildCells = (rawVals, isExtraRow) =>
    Array.from({ length: PORTALE_COL_COUNT }, (_, c) => {
      const raw = rawVals[c] ?? ""
      if (c === BARCODE_COL) {
        const s = raw.toString().trim()
        if (s === "") return { val: null, isStr: false, isBarcode: true }
        const n = typeof raw === "number" ? raw : toValue(s)
        return typeof n === "number"
          ? { val: n,  isStr: false, isBarcode: true }
          : { val: s,  isStr: true,  isBarcode: true }
      }
      const v = isExtraRow ? raw : (typeof raw === "string" ? toValue(raw) : raw)
      if (v === "" || v === null || v === undefined) return { val: null, isStr: false, isBarcode: false }
      return { val: v, isStr: typeof v === "string", isBarcode: false }
    })

  const allRows = [
    portaleHeaders.map((h, c) => ({ val: h, isStr: true, isBarcode: c === BARCODE_COL })),
    ...normalized.map(r => buildCells(r, false)),
    ...PORTALE_EXTRA_ROWS.map(r => buildCells(r, true)),
  ]

  // ── Genera sheet1.xml con inline strings (nessun SST) ─────────────────────
  const xmlEsc = s => String(s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;")
  const colLetter = c => {
    let s = ""; let n = c + 1
    while (n > 0) { s = String.fromCharCode(65 + (n - 1) % 26) + s; n = Math.floor((n - 1) / 26) }
    return s
  }
  const lastCol = colLetter(PORTALE_COL_COUNT - 1)
  const totalRows = allRows.length

  let sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`
  sheetXml += `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">`
  sheetXml += `<dimension ref="A1:${lastCol}${totalRows}"/>`
  sheetXml += `<cols><col min="${BARCODE_COL + 1}" max="${BARCODE_COL + 1}" width="14.140625" customWidth="1"/></cols>`
  sheetXml += `<sheetData>`
  for (let r = 0; r < totalRows; r++) {
    sheetXml += `<row r="${r + 1}">`
    for (let c = 0; c < PORTALE_COL_COUNT; c++) {
      const cell = allRows[r][c]
      if (cell.val === null) continue
      const ref  = colLetter(c) + (r + 1)
      const sAttr = cell.isBarcode ? ` s="1"` : ""
      if (cell.isStr) {
        sheetXml += `<c r="${ref}" t="inlineStr"${sAttr}><is><t>${xmlEsc(cell.val)}</t></is></c>`
      } else {
        sheetXml += `<c r="${ref}"${sAttr}><v>${cell.val}</v></c>`
      }
    }
    sheetXml += `</row>`
  }
  sheetXml += `</sheetData></worksheet>`

  // ── Parti OOXML ────────────────────────────────────────────────────────────
  const contentTypes =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
    `<Default Extension="xml" ContentType="application/xml"/>` +
    `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
    `<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>` +
    `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
    `</Types>`

  const dotRels =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
    `</Relationships>`

  const workbook =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
    `<sheets><sheet name="Foglio1" sheetId="1" r:id="rId1"/></sheets>` +
    `</workbook>`

  const workbookRels =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>` +
    `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
    `</Relationships>`

  // styles.xml: numFmtId 164 = "0" (integer) usato da colonna Barcode (s="1")
  const styles =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<numFmts count="1"><numFmt numFmtId="164" formatCode="0"/></numFmts>` +
    `<fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>` +
    `<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>` +
    `<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>` +
    `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
    `<cellXfs count="2">` +
    `<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>` +
    `<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0"/>` +
    `</cellXfs>` +
    `</styleSheet>`

  const enc = new TextEncoder()
  return packZip([
    { name: "[Content_Types].xml",          data: enc.encode(contentTypes) },
    { name: "_rels/.rels",                  data: enc.encode(dotRels) },
    { name: "xl/workbook.xml",              data: enc.encode(workbook) },
    { name: "xl/_rels/workbook.xml.rels",   data: enc.encode(workbookRels) },
    { name: "xl/styles.xml",               data: enc.encode(styles) },
    { name: "xl/worksheets/sheet1.xml",    data: enc.encode(sheetXml) },
  ])
}

/**
 * Esegue la generazione dell'anagrafe articoli IT01.
 *
 * @param {object} params
 * @param {string} params.tsvText       - Testo TSV incollato dall'utente
 * @param {FileSystemDirectoryHandle} params.rootHandle - Handle cartella 00 - Estrazioni
 * @param {function} params.onStep      - (stepIndex, status, message?) => void
 */
export async function runItemExport({ tsvText, rootHandle, onStep }) {
  // ── Step 0: parsing TSV ────────────────────────────────────────────────────
  onStep(0, "running")
  const rows = parseTsv(tsvText)
  if (rows.length < 2) throw new Error("Dati insufficienti: incolla almeno l'intestazione e una riga di dati")
  const { headers, dataRows, colCount } = filterColumns(rows[0], rows.slice(1))
  onStep(0, "done")

  const batchId = randomString8()
  const today = new Date()
  const yyyymmdd = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`

  // ── Step 1: build tbl_ItemM.xlsm ──────────────────────────────────────────
  onStep(1, "running")
  const xlsmBytes = buildXlsm(headers, dataRows, colCount, batchId, today)
  onStep(1, "done")

  // ── Step 2: salva tbl_ItemM.xlsm in 97 - Service / 01 - Tables ────────────
  onStep(2, "running")
  let tablesHandle
  try {
    const serviceHandle = await rootHandle.getDirectoryHandle("97 - Service")
    tablesHandle = await serviceHandle.getDirectoryHandle("01 - Tables")
  } catch {
    throw new Error('Percorso "97 - Service / 01 - Tables" non trovato nella cartella collegata')
  }
  await writeToFolder(tablesHandle, "tbl_ItemM.xlsm", xlsmBytes)
  onStep(2, "done")

  // ── Step 3: copia in Tables_for_FTP ───────────────────────────────────────
  onStep(3, "running")
  try {
    const ftpHandle = await tablesHandle.getDirectoryHandle("Tables_for_FTP")
    await writeToFolder(ftpHandle, "tbl_ItemM.xlsm", xlsmBytes)
    onStep(3, "done")
  } catch (e) {
    onStep(3, "warning", e.message || 'Cartella "Tables_for_FTP" non trovata in 01 - Tables')
  }

  // ── Step 4: build yyyymmdd - ItemM.xlsx ───────────────────────────────────
  onStep(4, "running")
  const xlsxSheet = {}

  // Riga 1 (r=0): intestazioni
  headers.forEach((h, c) => {
    xlsxSheet[XLSX.utils.encode_cell({ r: 0, c })] = { v: String(h), t: "s" }
  })

  // Riga 2+ (r=1+): dati
  dataRows.forEach((row, rowIdx) => {
    row.forEach((cell, c) => {
      const val = toValue(cell)
      if (val === "") return
      xlsxSheet[XLSX.utils.encode_cell({ r: rowIdx + 1, c })] = {
        v: val,
        t: typeof val === "number" ? "n" : "s",
      }
    })
  })

  xlsxSheet["!ref"] = XLSX.utils.encode_range({
    s: { r: 0, c: 0 },
    e: { r: dataRows.length, c: colCount - 1 },
  })

  const xlsxWb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(xlsxWb, xlsxSheet, "ITEMS")
  const xlsxBytes = new Uint8Array(
    XLSX.write(xlsxWb, { type: "array", bookType: "xlsx", compression: true, bookSST: true })
  )
  onStep(4, "done")

  // ── Step 5: salva yyyymmdd - ItemM.xlsx in 01 - Item List ─────────────────
  onStep(5, "running")
  let itemListHandle
  try {
    itemListHandle = await rootHandle.getDirectoryHandle("01 - Item List")
    await writeToFolder(itemListHandle, `${yyyymmdd} - ItemM.xlsx`, xlsxBytes)
    onStep(5, "done")
  } catch (e) {
    onStep(5, "warning", e.message || 'Cartella "01 - Item List" non trovata nella cartella collegata')
  }

  // ── Step 6: build e salva yyyymmdd - ItemList_portale.xlsx ────────────────
  onStep(6, "running")
  try {
    const portaleBytes = await buildPortaleXlsx(headers, dataRows)
    const handle = itemListHandle ?? await rootHandle.getDirectoryHandle("01 - Item List")
    await writeToFolder(handle, `${yyyymmdd} - ItemList_portale.xlsx`, portaleBytes)
    onStep(6, "done")
  } catch (e) {
    onStep(6, "warning", e.message || "Errore generazione ItemList_portale.xlsx")
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DEBUG — genera solo faustyitem.xlsm nella root (00 - Estrazioni)
// Usato per confrontare l'output con il tool di riferimento.
// NON tocca 01-Tables, Tables_for_FTP, 01-Item List.
// ─────────────────────────────────────────────────────────────────────────────
export async function runItemDebug({ tsvText, rootHandle }) {
  const rows = parseTsv(tsvText)
  if (rows.length < 2) throw new Error("Dati insufficienti")
  const { headers, dataRows, colCount } = filterColumns(rows[0], rows.slice(1))
  const batchId = randomString8()
  const today = new Date()

  const bytes = buildXlsm(headers, dataRows, colCount, batchId, today)
  await writeToFolder(rootHandle, "faustyitem.xlsm", bytes)
}
