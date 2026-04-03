import * as XLSX from "xlsx/dist/xlsx.full.min.js"

export const EXPORT_STEPS = [
  "Parsing dati incollati...",
  "Generazione tbl_ItemM.xlsm...",
  "Salvataggio in 97 - Service / 01 - Tables...",
  "Copia in Tables_for_FTP...",
  "Generazione ItemM.xlsx...",
  "Salvataggio in 01 - Item List...",
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
