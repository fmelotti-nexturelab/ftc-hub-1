// Parser del file xlsx "Cambi Prezzi" inviato da casa madre.
//
// Formato atteso (prima riga = header):
//   A: Entity           (IT01 | IT02 | IT03)
//   B: Item number      (codice articolo)
//   C: Sales Price      (nuovo prezzo)
//   D: Reason for price change
//   E: Status
//   F: Old Price
//
// Usa SheetJS (`xlsx`) per il parsing. Ritorna un oggetto con:
//   rows: [{ entity, itemNumber, newPrice, oldPrice, reason, status }, ...]
//   detectedEntities: Set<string>  (entities presenti nel file)
//   filename: string (nome file originale)

import * as XLSX from "xlsx"

const HEADER_MAP = {
  entity:       ["entity"],
  itemNumber:   ["item number", "itemnumber", "item no.", "item no", "nr.", "nr"],
  newPrice:     ["sales price", "salesprice", "new price", "prezzo"],
  oldPrice:     ["old price", "oldprice"],
  reason:       ["reason for price change", "reason", "motivo"],
  status:       ["status", "stato"],
}

function normalizeHeader(h) {
  return String(h ?? "").trim().toLowerCase()
}

function findHeaderIndex(headerRow, candidates) {
  for (let i = 0; i < headerRow.length; i++) {
    const h = normalizeHeader(headerRow[i])
    if (candidates.includes(h)) return i
  }
  return -1
}

function parseNumber(val) {
  if (val === null || val === undefined || val === "") return null
  if (typeof val === "number") return val
  const s = String(val).trim().replace(/\./g, "").replace(",", ".")
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

/**
 * @param {File} file - File droppato o selezionato
 * @returns {Promise<{rows: Array, detectedEntities: Set<string>, filename: string}>}
 */
export async function parseCambiPrezziFile(file) {
  if (!file) throw new Error("Nessun file fornito")

  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: "array" })
  const firstSheetName = workbook.SheetNames[0]
  if (!firstSheetName) throw new Error("Il file non contiene fogli")

  const sheet = workbook.Sheets[firstSheetName]
  // array of arrays, preserva celle vuote come ""
  const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: true })
  if (aoa.length === 0) {
    return { rows: [], detectedEntities: new Set(), filename: file.name }
  }

  // Trova gli indici delle colonne dall'header
  const headerRow = aoa[0]
  const idx = {}
  for (const [key, candidates] of Object.entries(HEADER_MAP)) {
    idx[key] = findHeaderIndex(headerRow, candidates)
  }

  // Fallback posizionale se mancano header riconosciuti:
  if (idx.entity === -1)     idx.entity = 0
  if (idx.itemNumber === -1) idx.itemNumber = 1
  if (idx.newPrice === -1)   idx.newPrice = 2
  if (idx.reason === -1)     idx.reason = 3
  if (idx.status === -1)     idx.status = 4
  if (idx.oldPrice === -1)   idx.oldPrice = 5

  const rows = []
  const detectedEntities = new Set()

  for (let i = 1; i < aoa.length; i++) {
    const r = aoa[i]
    if (!r || r.length === 0) continue

    const itemNumber = String(r[idx.itemNumber] ?? "").trim()
    const newPrice   = parseNumber(r[idx.newPrice])
    if (!itemNumber || newPrice === null) continue

    const entity = String(r[idx.entity] ?? "").trim().toUpperCase()
    if (entity) detectedEntities.add(entity)

    rows.push({
      entity,
      itemNumber,
      newPrice,
      oldPrice: parseNumber(r[idx.oldPrice]),
      reason: String(r[idx.reason] ?? "").trim() || null,
      status: String(r[idx.status] ?? "").trim() || null,
    })
  }

  return { rows, detectedEntities, filename: file.name }
}

/**
 * Converte un array di righe parsate in testo TSV a 2 colonne (codice + nuovo prezzo).
 * Formato compatibile col parser `parseListaCambi` esistente in CheckPrezziPage.
 */
export function rowsToTsv(rows) {
  return rows
    .map(r => `${r.itemNumber}\t${r.newPrice}`)
    .join("\n")
}
