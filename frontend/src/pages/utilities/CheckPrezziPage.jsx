import { useState, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { DollarSign, LogOut, ClipboardPaste, Play, CheckCircle, XCircle, HelpCircle, Trash2 } from "lucide-react"

const ENTITIES = ["IT01", "IT02", "IT03"]

const ENTITY_COLORS = {
  IT01: "bg-blue-100 text-blue-700",
  IT02: "bg-emerald-100 text-emerald-700",
  IT03: "bg-violet-100 text-violet-700",
}

// ── Parsing helpers ──────────────────────────────────────────────────────────

function parseTsv(text) {
  if (!text || !text.trim()) return []
  return text
    .split(/\r?\n/)
    .filter(l => l.trim())
    .map(l => l.split("\t"))
}

function parseNum(val) {
  if (val === null || val === undefined || val === "") return null
  const s = String(val).trim().replace(",", ".")
  const n = Number(s)
  return isNaN(n) ? null : n
}

/**
 * Parsa la lista cambi prezzi (2 colonne: codice, nuovo prezzo).
 * Salta la prima riga se sembra un header.
 */
function parseListaCambi(text) {
  const rows = parseTsv(text)
  if (!rows.length) return []
  // Detect header row
  const first = rows[0]
  const startsWithHeader =
    first.length >= 2 &&
    isNaN(parseNum(first[1])) &&
    /codice|code|nr/i.test(first[0] + first[1])
  const dataRows = startsWithHeader ? rows.slice(1) : rows
  return dataRows
    .map(r => ({ code: (r[0] || "").trim(), newPrice: parseNum(r[1]) }))
    .filter(r => r.code && r.newPrice !== null)
}

/**
 * Parsa anagrafe ITEM da NAV.
 * IT01: header italiano (Nr., Prezzo unitario = col F, index 5)
 * IT02/IT03: header inglese (No., Unit Price = col F, index 5)
 * Salta la doppia riga header se presente.
 */
function parseItem(text) {
  const rows = parseTsv(text)
  if (!rows.length) return new Map()
  // Find price column index: "Prezzo unitario" or "Unit Price"
  let priceIdx = -1
  let codeIdx = 0
  const headerRow = rows[0]
  for (let i = 0; i < headerRow.length; i++) {
    const h = (headerRow[i] || "").trim().toLowerCase()
    if (h === "prezzo unitario" || h === "unit price") priceIdx = i
    if (h === "nr." || h === "no.") codeIdx = i
  }
  if (priceIdx === -1) priceIdx = 5 // default col F

  // Skip header rows (1 or 2 if duplicated)
  let startIdx = 1
  if (rows.length > 2) {
    const r2 = rows[1]
    const h2 = (r2[codeIdx] || "").trim().toLowerCase()
    if (h2 === "nr." || h2 === "no." || h2 === headerRow[codeIdx]?.trim().toLowerCase()) {
      startIdx = 2
    }
  }

  const map = new Map()
  for (let i = startIdx; i < rows.length; i++) {
    const code = (rows[i][codeIdx] || "").trim()
    const price = parseNum(rows[i][priceIdx])
    if (code) map.set(code, price)
  }
  return map
}

/**
 * Parsa listino PRICE da NAV.
 * IT01: Nr. articolo (col C, index 2), Prezzo unitario (col F, index 5)
 * IT02/IT03: Item No. (col C, index 2), Unit Price (col F, index 5)
 */
function parsePrice(text) {
  const rows = parseTsv(text)
  if (!rows.length) return new Map()
  let codeIdx = 2
  let priceIdx = 5
  const headerRow = rows[0]
  for (let i = 0; i < headerRow.length; i++) {
    const h = (headerRow[i] || "").trim().toLowerCase()
    if (h === "nr. articolo" || h === "item no.") codeIdx = i
    if (h === "prezzo unitario" || h === "unit price") priceIdx = i
  }

  let startIdx = 1
  if (rows.length > 2) {
    const r2 = rows[1]
    const h2 = (r2[codeIdx] || "").trim().toLowerCase()
    if (h2 === "nr. articolo" || h2 === "item no." || h2 === headerRow[codeIdx]?.trim().toLowerCase()) {
      startIdx = 2
    }
  }

  const map = new Map()
  for (let i = startIdx; i < rows.length; i++) {
    const code = (rows[i][codeIdx] || "").trim()
    const price = parseNum(rows[i][priceIdx])
    if (code && !map.has(code)) map.set(code, price)
  }
  return map
}

// ── Verification logic ───────────────────────────────────────────────────────

function runVerification(lista, itemMap, priceMap) {
  return lista.map(({ code, newPrice }) => {
    const itemPrice = itemMap.get(code) ?? null
    const priceListPrice = priceMap.get(code) ?? null

    let itemStatus = "nd"
    if (itemPrice !== null) {
      itemStatus = Math.abs(itemPrice - newPrice) < 0.001 ? "ok" : "ko"
    }

    let priceStatus = "nd"
    if (priceListPrice !== null) {
      priceStatus = Math.abs(priceListPrice - newPrice) < 0.001 ? "ok" : "ko"
    }

    return { code, newPrice, itemPrice, itemStatus, priceListPrice, priceStatus }
  })
}

// ── Components ───────────────────────────────────────────────────────────────

function PasteArea({ label, hint, value, onChange, rowCount }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <ClipboardPaste size={14} className="text-gray-400" aria-hidden="true" />
        <label className="text-sm font-semibold text-gray-700">{label}</label>
        {rowCount > 0 && (
          <span className="text-xs text-gray-400 ml-auto">
            {rowCount.toLocaleString("it-IT")} righe
          </span>
        )}
      </div>
      {hint && <p className="text-xs text-gray-400">{hint}</p>}
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        rows={4}
        className="w-full px-3 py-2 text-xs font-mono bg-gray-50 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-[#2563eb] focus:border-transparent outline-none transition resize-y"
        placeholder="Incolla qui i dati da Excel/NAV (Ctrl+V)..."
      />
    </div>
  )
}

function StatusIcon({ status }) {
  if (status === "ok") return <CheckCircle size={15} className="text-green-500" aria-hidden="true" />
  if (status === "ko") return <XCircle size={15} className="text-red-500" aria-hidden="true" />
  return <HelpCircle size={15} className="text-gray-300" aria-hidden="true" />
}

function SummaryBadge({ label, count, color }) {
  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${color}`}>
      <span className="text-xs font-semibold">{label}</span>
      <span className="text-sm font-bold tabular-nums">{count.toLocaleString("it-IT")}</span>
    </div>
  )
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function CheckPrezziPage() {
  const navigate = useNavigate()
  const [activeEntity, setActiveEntity] = useState("IT01")

  // State per entity
  const [entityData, setEntityData] = useState(() => {
    const init = {}
    ENTITIES.forEach(e => {
      init[e] = { lista: "", item: "", price: "", results: null }
    })
    return init
  })

  const data = entityData[activeEntity]

  function updateField(field, value) {
    setEntityData(prev => ({
      ...prev,
      [activeEntity]: { ...prev[activeEntity], [field]: value, results: null },
    }))
  }

  function handleReset() {
    setEntityData(prev => ({
      ...prev,
      [activeEntity]: { lista: "", item: "", price: "", results: null },
    }))
  }

  const listaCount = useMemo(() => parseTsv(data.lista).length, [data.lista])
  const itemCount = useMemo(() => parseTsv(data.item).length, [data.item])
  const priceCount = useMemo(() => parseTsv(data.price).length, [data.price])

  const canVerify = listaCount > 0 && itemCount > 0 && priceCount > 0

  function handleVerifica() {
    const lista = parseListaCambi(data.lista)
    const itemMap = parseItem(data.item)
    const priceMap = parsePrice(data.price)
    const results = runVerification(lista, itemMap, priceMap)
    setEntityData(prev => ({
      ...prev,
      [activeEntity]: { ...prev[activeEntity], results },
    }))
  }

  const results = data.results
  const summary = useMemo(() => {
    if (!results) return null
    let ok = 0, ko = 0, nd = 0
    for (const r of results) {
      if (r.itemStatus === "ok" && r.priceStatus === "ok") ok++
      else if (r.itemStatus === "nd" && r.priceStatus === "nd") nd++
      else ko++
    }
    return { ok, ko, nd, total: results.length }
  }, [results])

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-green-500/10 rounded-xl flex items-center justify-center">
          <DollarSign size={18} className="text-green-600" aria-hidden="true" />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-800">Check Prezzi</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Verifica cambi prezzi su anagrafe e listini NAV per IT01, IT02, IT03
          </p>
        </div>
        <button
          onClick={() => navigate("/utilities/genera-tabelle")}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition"
        >
          <LogOut size={15} aria-hidden="true" />
          Esci
        </button>
      </div>

      {/* Entity tabs */}
      <div className="flex items-center gap-2">
        {ENTITIES.map(entity => (
          <button
            key={entity}
            onClick={() => setActiveEntity(entity)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold border transition
              ${activeEntity === entity
                ? "bg-[#1e3a5f] text-white border-[#1e3a5f] shadow-sm"
                : "bg-white text-gray-600 border-gray-200 hover:border-[#2563eb] hover:text-[#2563eb]"
              }`}
          >
            {entity}
          </button>
        ))}
      </div>

      {/* Paste areas */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-5">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-bold px-2 py-0.5 rounded ${ENTITY_COLORS[activeEntity]}`}>
            {activeEntity}
          </span>
          <span className="text-sm font-bold text-gray-700">Dati di input</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <PasteArea
            label="Lista Cambi Prezzi"
            hint="Dalla mail: codice articolo + nuovo prezzo (2 colonne)"
            value={data.lista}
            onChange={v => updateField("lista", v)}
            rowCount={listaCount}
          />
          <PasteArea
            label={`Anagrafe ITEM ${activeEntity}`}
            hint="Da NAV: export Item con Nr. e Prezzo unitario"
            value={data.item}
            onChange={v => updateField("item", v)}
            rowCount={itemCount}
          />
          <PasteArea
            label={`Listino PRICE ${activeEntity}`}
            hint="Da NAV: export Price List con Nr. articolo e Prezzo unitario"
            value={data.price}
            onChange={v => updateField("price", v)}
            rowCount={priceCount}
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleVerifica}
            disabled={!canVerify}
            className="flex items-center gap-2 bg-[#1e3a5f] hover:bg-[#2563eb] text-white font-semibold py-2.5 px-6 rounded-xl shadow transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Play size={15} aria-hidden="true" />
            Verifica
          </button>
          {(data.lista || data.item || data.price) && (
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 px-4 py-2.5 border border-gray-300 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition"
            >
              <Trash2 size={14} aria-hidden="true" />
              Pulisci
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      {results && summary && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {/* Summary bar */}
          <div className="px-5 py-3.5 border-b border-gray-100 flex items-center gap-4 flex-wrap">
            <span className="text-sm font-bold text-gray-700">
              Risultati — {summary.total.toLocaleString("it-IT")} articoli verificati
            </span>
            <div className="flex items-center gap-2 ml-auto">
              <SummaryBadge label="OK" count={summary.ok} color="bg-green-50 border-green-200 text-green-700" />
              <SummaryBadge label="KO" count={summary.ko} color="bg-red-50 border-red-200 text-red-700" />
              <SummaryBadge label="N/D" count={summary.nd} color="bg-gray-50 border-gray-200 text-gray-500" />
            </div>
          </div>

          {/* Results table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-gray-600 font-semibold text-xs">
                  <th scope="col" className="px-5 py-3 text-left">Codice</th>
                  <th scope="col" className="px-4 py-3 text-right">Nuovo prezzo</th>
                  <th scope="col" className="px-4 py-3 text-right">Prezzo anagrafe</th>
                  <th scope="col" className="px-4 py-3 text-center">Anagrafe</th>
                  <th scope="col" className="px-4 py-3 text-right">Prezzo listino</th>
                  <th scope="col" className="px-4 py-3 text-center">Listino</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => (
                  <tr key={`${r.code}-${i}`} className="odd:bg-white even:bg-gray-50/50 border-b border-gray-100 last:border-0">
                    <td className="px-5 py-2.5 text-gray-800 font-mono text-xs">{r.code}</td>
                    <td className="px-4 py-2.5 text-right text-gray-700 font-semibold tabular-nums">
                      {r.newPrice.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-2.5 text-right text-gray-600 tabular-nums">
                      {r.itemPrice !== null
                        ? r.itemPrice.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                        : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <StatusIcon status={r.itemStatus} />
                    </td>
                    <td className="px-4 py-2.5 text-right text-gray-600 tabular-nums">
                      {r.priceListPrice !== null
                        ? r.priceListPrice.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                        : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <StatusIcon status={r.priceStatus} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
