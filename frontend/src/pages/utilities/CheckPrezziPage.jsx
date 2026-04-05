import { useState, useMemo, useEffect, useRef, useCallback } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  DollarSign, LogOut, ClipboardPaste, Play, CheckCircle, XCircle, HelpCircle,
  Trash2, Upload, FileSpreadsheet, AlertTriangle, X, Loader2,
} from "lucide-react"
import { checkPrezziApi } from "@/api/checkPrezzi"
import { parseCambiPrezziFile, rowsToTsv } from "@/lib/xlsxCambiPrezzi"
import {
  loadItem, saveItem,
  loadPrice, savePrice,
} from "@/lib/checkPrezziStore"
import { useAuthStore } from "@/store/authStore"

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

/**
 * Overlay "Caricamento dati in corso" con pulse animation.
 * Si posiziona in absolute dentro un parent con `relative`.
 */
function LoadingOverlay({ show, message = "Caricamento dati in corso..." }) {
  if (!show) return null
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-white/75 backdrop-blur-[1px] rounded-lg z-10 pointer-events-none">
      <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-lg shadow-md border border-[#2563eb]/30 animate-pulse">
        <Loader2 size={14} className="text-[#2563eb] animate-spin" aria-hidden="true" />
        <span className="text-sm font-semibold text-gray-700">{message}</span>
      </div>
    </div>
  )
}

function PasteArea({ label, hint, value, onChange, rowCount, loading, onPaste, savedAt, savedBy, onClear }) {
  return (
    <div className="space-y-1.5">
      {/* min-h per allinearsi con la row-label del DropZoneLista che ha i bottoni */}
      <div className="flex items-center gap-2 min-h-[1.75rem]">
        <ClipboardPaste size={14} className="text-gray-400" aria-hidden="true" />
        <label className="text-sm font-semibold text-gray-700">{label}</label>
        {rowCount > 0 && (
          <span className="text-xs text-gray-400">
            {rowCount.toLocaleString("it-IT")} righe
          </span>
        )}
        <div className="flex-1" />
        {rowCount > 0 && onClear && (
          <button
            type="button"
            onClick={onClear}
            className="flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-md border border-gray-200 hover:border-red-300 hover:bg-red-50 text-gray-500 hover:text-red-600 transition"
            aria-label={`Svuota ${label}`}
          >
            <Trash2 size={11} aria-hidden="true" />
            Svuota
          </button>
        )}
      </div>
      {/* min-h per allineare con DropZoneLista (che ha hint su 2 righe) */}
      <p className="text-xs text-gray-400 min-h-[2rem]">{hint}</p>
      <div className="relative">
        <textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          onPaste={onPaste}
          rows={4}
          className="w-full px-3 py-2 text-xs font-mono bg-gray-50 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-[#2563eb] focus:border-transparent outline-none transition resize-y"
          placeholder="Incolla qui i dati da Excel/NAV (Ctrl+V)..."
        />
        <LoadingOverlay show={loading} />
      </div>
      {/* min-h per allineare con il meta footer del DropZoneLista */}
      <p className="text-[11px] text-gray-500 pt-1 min-h-[1.25rem]">
        {savedAt ? (
          <>
            Ultimo caricamento: {new Date(savedAt).toLocaleString("it-IT")}
            {savedBy && <> · {savedBy}</>}
          </>
        ) : null}
      </p>
    </div>
  )
}

/**
 * DropZone per la "Lista Cambi Prezzi": combina textarea (paste) con
 * drag & drop di un file .xlsx. Il parsing avviene nel parent via onFileDropped.
 */
function DropZoneLista({
  value,
  onChange,
  rowCount,
  meta,
  onFileDropped,
  onClear,
  busy,
  loadingMessage,
}) {
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef(null)

  function handleDragOver(e) {
    e.preventDefault()
    e.stopPropagation()
    if (!dragOver) setDragOver(true)
  }
  function handleDragLeave(e) {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
  }
  function handleDrop(e) {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) onFileDropped(file)
  }
  function handleFilePicked(e) {
    const file = e.target.files?.[0]
    if (file) onFileDropped(file)
    e.target.value = ""
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 min-h-[1.75rem]">
        <ClipboardPaste size={14} className="text-gray-400" aria-hidden="true" />
        <label className="text-sm font-semibold text-gray-700">Lista Cambi Prezzi</label>
        {rowCount > 0 && (
          <span className="text-xs text-gray-400">
            {rowCount.toLocaleString("it-IT")} righe
          </span>
        )}
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={busy}
          className="flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-md border border-gray-200 hover:border-[#2563eb] hover:bg-blue-50 text-gray-600 transition disabled:opacity-40"
          aria-label="Carica file xlsx"
        >
          <Upload size={11} aria-hidden="true" />
          Carica .xlsx
        </button>
        {rowCount > 0 && (
          <button
            type="button"
            onClick={onClear}
            disabled={busy}
            className="flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-md border border-gray-200 hover:border-red-300 hover:bg-red-50 text-gray-500 hover:text-red-600 transition disabled:opacity-40"
            aria-label="Svuota lista cambi prezzi"
          >
            <Trash2 size={11} aria-hidden="true" />
            Svuota
          </button>
        )}
      </div>
      <p className="text-xs text-gray-400 min-h-[2rem]">
        Trascina qui il file .xlsx ricevuto da casa madre, oppure incolla 2 colonne (codice + nuovo prezzo)
      </p>

      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls"
        onChange={handleFilePicked}
        className="hidden"
      />

      <div
        className="relative"
        onDragOver={handleDragOver}
        onDragEnter={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          rows={4}
          className={`w-full px-3 py-2 text-xs font-mono bg-gray-50 border-2 rounded-lg focus:ring-2 focus:ring-[#2563eb] focus:border-transparent outline-none transition resize-y
            ${dragOver ? "border-[#2563eb] bg-blue-50" : "border-gray-200"}`}
          placeholder="Trascina un file .xlsx qui oppure incolla con Ctrl+V..."
        />
        {dragOver && (
          <div className="absolute inset-0 flex items-center justify-center bg-blue-500/10 border-2 border-dashed border-[#2563eb] rounded-lg pointer-events-none">
            <div className="flex items-center gap-2 bg-white/90 px-4 py-2 rounded-lg shadow-sm text-sm font-semibold text-[#1e3a5f]">
              <FileSpreadsheet size={16} aria-hidden="true" />
              Rilascia il file .xlsx
            </div>
          </div>
        )}
        <LoadingOverlay show={busy} message={loadingMessage || "Caricamento dati in corso..."} />
      </div>

      <p className="text-[11px] text-gray-500 pt-1 min-h-[1.25rem]">
        {meta?.source_filename ? (
          <>
            Ultimo caricamento: {meta.source_filename}
            {meta.uploaded_at && <> · {new Date(meta.uploaded_at).toLocaleString("it-IT")}</>}
            {meta.uploaded_by_name && <> · {meta.uploaded_by_name}</>}
          </>
        ) : null}
      </p>
    </div>
  )
}

/** Modale di conferma quando il file droppato contiene una entity diversa da quella attiva. */
function EntityMismatchModal({ open, activeEntity, detectedEntities, filename, onProceed, onCancel }) {
  if (!open) return null
  const list = [...detectedEntities].join(", ")
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" role="dialog" aria-modal="true">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 p-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 bg-amber-100 rounded-xl flex items-center justify-center shrink-0">
            <AlertTriangle size={18} className="text-amber-600" aria-hidden="true" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-gray-800">Entity non corrispondente</p>
            <p className="text-xs text-gray-500 mt-1">
              Il file <span className="font-semibold">{filename}</span> contiene righe per
              <span className="font-semibold"> {list || "nessuna entity riconosciuta"}</span>,
              ma stai lavorando sulla tab <span className="font-semibold">{activeEntity}</span>.
            </p>
            <p className="text-xs text-gray-500 mt-2">
              Vuoi procedere comunque e salvare queste righe sotto <span className="font-semibold">{activeEntity}</span>?
            </p>
          </div>
          <button onClick={onCancel} aria-label="Chiudi" className="text-gray-400 hover:text-gray-600">
            <X size={16} aria-hidden="true" />
          </button>
        </div>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
          >
            Annulla
          </button>
          <button
            onClick={onProceed}
            className="px-4 py-2 text-sm font-semibold bg-[#1e3a5f] hover:bg-[#2563eb] text-white rounded-lg shadow transition"
          >
            Procedi su {activeEntity}
          </button>
        </div>
      </div>
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

/**
 * Pillola filtro cliccabile: OK verde / KO rosso / N/D grigio.
 * Quando active, ha background pieno e testo bianco.
 */
function FilterPill({ label, count, active, tone, onClick }) {
  const styles = {
    green: active
      ? "bg-green-500 border-green-600 text-white"
      : "bg-green-50 border-green-200 text-green-700 hover:bg-green-100",
    red: active
      ? "bg-red-500 border-red-600 text-white"
      : "bg-red-50 border-red-200 text-red-700 hover:bg-red-100",
    gray: active
      ? "bg-gray-500 border-gray-600 text-white"
      : "bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100",
  }
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold transition focus-visible:ring-2 focus-visible:ring-[#2563eb] ${styles[tone]}`}
    >
      <span>{label}</span>
      <span className="tabular-nums">{count.toLocaleString("it-IT")}</span>
    </button>
  )
}

/**
 * Riga per uno dei due gruppi di counter (anagrafe / listino).
 * Ritorna tre celle come fragment: label, totale, pillole.
 * Il parent deve essere un CSS Grid con `grid-cols-[auto_auto_1fr]` cosi'
 * i due gruppi si allineano automaticamente indipendentemente dalla lunghezza
 * del label.
 */
function CounterGroupRow({ title, counts, filter, onChange }) {
  return (
    <>
      <span className="text-xs font-semibold text-gray-700 uppercase tracking-wider">{title}</span>
      <span className="text-sm font-bold text-gray-800 tabular-nums">
        {counts.total.toLocaleString("it-IT")}
      </span>
      <div className="flex items-center gap-1.5">
        <FilterPill label="OK"  count={counts.ok} active={filter === "ok"} tone="green" onClick={() => onChange("ok")} />
        <FilterPill label="KO"  count={counts.ko} active={filter === "ko"} tone="red"   onClick={() => onChange("ko")} />
        <FilterPill label="N/D" count={counts.nd} active={filter === "nd"} tone="gray"  onClick={() => onChange("nd")} />
      </div>
    </>
  )
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function CheckPrezziPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [searchParams] = useSearchParams()
  const user = useAuthStore(s => s.user)
  const currentUserName = user?.full_name || user?.username || null

  // L'entity e' scopato dall'URL: la pagina viene richiamata da una card
  // entity-specific dentro Genera Tabelle (es. IT01 drill-down).
  // Se manca il query param (accesso diretto via bookmark), fallback IT01.
  const urlEntity  = (searchParams.get("entity") || "").toUpperCase()
  const activeEntity = ENTITIES.includes(urlEntity) ? urlEntity : "IT01"

  // Lista cambi prezzi: backend-backed via useQuery.
  // ITEM / PRICE: locali (IndexedDB) via useEffect, con metadata (savedAt, savedBy).
  const [entityData, setEntityData] = useState(() => {
    const init = {}
    ENTITIES.forEach(e => {
      init[e] = {
        lista: "", item: "", price: "",
        itemSavedAt: null, itemSavedBy: null,
        priceSavedAt: null, priceSavedBy: null,
        results: null,
      }
    })
    return init
  })

  const data = entityData[activeEntity]

  // ── Load lista cambi prezzi dal backend per entity attiva ──────────────────
  const listaQuery = useQuery({
    queryKey: ["check-prezzi-lista", activeEntity],
    queryFn: () => checkPrezziApi.getLista(activeEntity),
    staleTime: 60 * 1000,
  })

  // Quando arriva la response, popola la textarea "lista" della entity
  useEffect(() => {
    const res = listaQuery.data
    if (!res) return
    const tsv = res.items
      .map(it => `${it.item_number}\t${Number(it.new_price)}`)
      .join("\n")
    setEntityData(prev => ({
      ...prev,
      [res.entity]: { ...prev[res.entity], lista: tsv, results: null },
    }))
  }, [listaQuery.data])

  // ── Load ITEM / PRICE da IndexedDB al primo cambio entity ──────────────────
  const loadedEntitiesRef = useRef(new Set())
  const [idbLoadingItem, setIdbLoadingItem]   = useState(false)
  const [idbLoadingPrice, setIdbLoadingPrice] = useState(false)

  useEffect(() => {
    if (loadedEntitiesRef.current.has(activeEntity)) return
    loadedEntitiesRef.current.add(activeEntity)
    const entity = activeEntity
    ;(async () => {
      setIdbLoadingItem(true)
      setIdbLoadingPrice(true)
      try {
        const [itemEntry, priceEntry] = await Promise.all([
          loadItem(entity),
          loadPrice(entity),
        ])
        setEntityData(prev => ({
          ...prev,
          [entity]: {
            ...prev[entity],
            item: itemEntry.text || prev[entity].item,
            price: priceEntry.text || prev[entity].price,
            itemSavedAt: itemEntry.savedAt,
            itemSavedBy: itemEntry.savedBy,
            priceSavedAt: priceEntry.savedAt,
            priceSavedBy: priceEntry.savedBy,
          },
        }))
      } finally {
        setIdbLoadingItem(false)
        setIdbLoadingPrice(false)
      }
    })()
  }, [activeEntity])

  // ── Paste intercept: per pasta grossa (>100k caratteri) mostra loading e defer setState ──
  const [pasteLoadingItem, setPasteLoadingItem]   = useState(false)
  const [pasteLoadingPrice, setPasteLoadingPrice] = useState(false)
  const PASTE_BIG_THRESHOLD = 100_000

  function makePasteHandler(field, setPasteLoading) {
    return (e) => {
      const text = e.clipboardData?.getData("text") ?? ""
      if (text.length < PASTE_BIG_THRESHOLD) return // piccolo: flusso normale
      e.preventDefault()
      setPasteLoading(true)
      // Doppio setTimeout: il primo lascia a React il tempo di renderizzare il loading,
      // il secondo forza il browser a dipingere prima del setState pesante.
      setTimeout(() => {
        requestAnimationFrame(() => {
          updateField(field, text)
          setTimeout(() => setPasteLoading(false), 30)
        })
      }, 0)
    }
  }

  const handlePasteItem  = makePasteHandler("item",  setPasteLoadingItem)
  const handlePastePrice = makePasteHandler("price", setPasteLoadingPrice)

  // ── Debounced save ITEM / PRICE su IndexedDB ───────────────────────────────
  const saveTimersRef = useRef({})
  function debouncedSave(entity, field, text) {
    const key = `${entity}_${field}`
    clearTimeout(saveTimersRef.current[key])
    saveTimersRef.current[key] = setTimeout(async () => {
      let entry
      if (field === "item")  entry = await saveItem(entity, text, currentUserName)
      if (field === "price") entry = await savePrice(entity, text, currentUserName)
      if (!entry) return
      setEntityData(prev => ({
        ...prev,
        [entity]: {
          ...prev[entity],
          [`${field}SavedAt`]: entry.savedAt,
          [`${field}SavedBy`]: entry.savedBy,
        },
      }))
    }, 500)
  }

  function updateField(field, value) {
    setEntityData(prev => ({
      ...prev,
      [activeEntity]: { ...prev[activeEntity], [field]: value, results: null },
    }))
    if (field === "item" || field === "price") {
      debouncedSave(activeEntity, field, value)
    }
  }

  async function handleClearField(field) {
    setEntityData(prev => ({
      ...prev,
      [activeEntity]: {
        ...prev[activeEntity],
        [field]: "",
        [`${field}SavedAt`]: null,
        [`${field}SavedBy`]: null,
        results: null,
      },
    }))
    if (field === "item")  await saveItem(activeEntity, "")
    if (field === "price") await savePrice(activeEntity, "")
  }

  function handleReset() {
    setEntityData(prev => ({
      ...prev,
      [activeEntity]: {
        ...prev[activeEntity],
        item: "", price: "",
        itemSavedAt: null, itemSavedBy: null,
        priceSavedAt: null, priceSavedBy: null,
        results: null,
      },
    }))
    saveItem(activeEntity, "")
    savePrice(activeEntity, "")
  }

  // ── Upload lista cambi prezzi (drag & drop xlsx) ───────────────────────────
  const [parseError, setParseError]   = useState(null)
  const [mismatchOpen, setMismatchOpen] = useState(false)
  const [pendingParsed, setPendingParsed] = useState(null) // { rows, filename, detectedEntities }

  const replaceListaMut = useMutation({
    mutationFn: ({ entity, payload }) => checkPrezziApi.replaceLista(entity, payload),
    onSuccess: (res) => {
      queryClient.setQueryData(["check-prezzi-lista", res.entity], res)
    },
  })

  async function handleFileDropped(file) {
    setParseError(null)
    try {
      const parsed = await parseCambiPrezziFile(file)
      if (parsed.rows.length === 0) {
        setParseError("Il file non contiene righe valide (codice + prezzo).")
        return
      }

      // Se il file contiene entity diverse da quella attiva → chiedi conferma
      const detected = parsed.detectedEntities
      const hasActive = detected.has(activeEntity)
      const hasOther = [...detected].some(e => e !== activeEntity)
      if (!hasActive || hasOther) {
        setPendingParsed(parsed)
        setMismatchOpen(true)
        return
      }
      await uploadParsed(parsed)
    } catch (err) {
      console.error(err)
      setParseError(err?.message || "Errore durante il parsing del file")
    }
  }

  async function uploadParsed(parsed) {
    // Filtra solo le righe per entity attiva (se detected conteneva anche altre,
    // dopo la conferma nel modal prendiamo TUTTE le righe del file)
    const items = parsed.rows.map(r => ({
      item_number: r.itemNumber,
      new_price: r.newPrice,
      old_price: r.oldPrice,
      reason: r.reason,
      status: r.status,
    }))
    await replaceListaMut.mutateAsync({
      entity: activeEntity,
      payload: { items, source_filename: parsed.filename },
    })
  }

  async function handleMismatchProceed() {
    setMismatchOpen(false)
    if (pendingParsed) {
      await uploadParsed(pendingParsed)
      setPendingParsed(null)
    }
  }

  function handleMismatchCancel() {
    setMismatchOpen(false)
    setPendingParsed(null)
  }

  async function handleClearLista() {
    await replaceListaMut.mutateAsync({
      entity: activeEntity,
      payload: { items: [], source_filename: null },
    })
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

  // ── Filtri indipendenti per anagrafe e listino + filtro discrepanze ────────
  // itemFilter / priceFilter: null = nessun filtro, altrimenti "ok" | "ko" | "nd"
  // discrepanzeOnly: filtro mutuamente esclusivo coi per-group filter
  const [itemFilter, setItemFilter]           = useState(null)
  const [priceFilter, setPriceFilter]         = useState(null)
  const [discrepanzeOnly, setDiscrepanzeOnly] = useState(false)

  // Reset filtri quando cambiano i results o l'entity attiva
  useEffect(() => {
    setItemFilter(null)
    setPriceFilter(null)
    setDiscrepanzeOnly(false)
  }, [activeEntity, results])

  // Riga con discrepanza = le due fonti NAV non concordano tra loro
  function hasDiscrepancy(row) {
    const a = row.itemPrice
    const b = row.priceListPrice
    if (a === null && b === null) return false
    if (a === null || b === null) return true
    return Math.abs(a - b) > 0.001
  }

  const anagrafeCounts = useMemo(() => {
    if (!results) return null
    let ok = 0, ko = 0, nd = 0
    for (const r of results) {
      if (r.itemStatus === "ok") ok++
      else if (r.itemStatus === "ko") ko++
      else nd++
    }
    return { ok, ko, nd, total: results.length }
  }, [results])

  const listinoCounts = useMemo(() => {
    if (!results) return null
    let ok = 0, ko = 0, nd = 0
    for (const r of results) {
      if (r.priceStatus === "ok") ok++
      else if (r.priceStatus === "ko") ko++
      else nd++
    }
    return { ok, ko, nd, total: results.length }
  }, [results])

  const discrepancyCount = useMemo(() => {
    if (!results) return 0
    return results.reduce((acc, r) => acc + (hasDiscrepancy(r) ? 1 : 0), 0)
  }, [results])

  const filteredResults = useMemo(() => {
    if (!results) return null
    if (discrepanzeOnly) return results.filter(hasDiscrepancy)
    return results.filter(r => {
      if (itemFilter && r.itemStatus !== itemFilter) return false
      if (priceFilter && r.priceStatus !== priceFilter) return false
      return true
    })
  }, [results, itemFilter, priceFilter, discrepanzeOnly])

  // Toggle di un filtro per-group, mutuamente esclusivo col filtro discrepanze
  function toggleItemFilter(value) {
    setDiscrepanzeOnly(false)
    setItemFilter(prev => (prev === value ? null : value))
  }
  function togglePriceFilter(value) {
    setDiscrepanzeOnly(false)
    setPriceFilter(prev => (prev === value ? null : value))
  }
  function toggleDiscrepanze() {
    setDiscrepanzeOnly(prev => {
      const next = !prev
      if (next) {
        setItemFilter(null)
        setPriceFilter(null)
      }
      return next
    })
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-green-500/10 rounded-xl flex items-center justify-center">
          <DollarSign size={18} className="text-green-600" aria-hidden="true" />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-800">Check Prices {activeEntity}</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Verifica cambi prezzi su anagrafe e listini NAV per IT01, IT02, IT03
          </p>
        </div>
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition"
        >
          <LogOut size={15} aria-hidden="true" />
          Esci
        </button>
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
          <DropZoneLista
            value={data.lista}
            onChange={v => updateField("lista", v)}
            rowCount={listaCount}
            meta={listaQuery.data?.meta}
            onFileDropped={handleFileDropped}
            onClear={handleClearLista}
            busy={listaQuery.isFetching || replaceListaMut.isPending}
            loadingMessage={
              replaceListaMut.isPending ? "Salvataggio in corso..." : "Caricamento dati in corso..."
            }
          />
          <PasteArea
            label={`Anagrafe ITEM ${activeEntity}`}
            hint="Da NAV: export Item con Nr. e Prezzo unitario"
            value={data.item}
            onChange={v => updateField("item", v)}
            onPaste={handlePasteItem}
            rowCount={itemCount}
            loading={idbLoadingItem || pasteLoadingItem}
            savedAt={data.itemSavedAt}
            savedBy={data.itemSavedBy}
            onClear={() => handleClearField("item")}
          />
          <PasteArea
            label={`Listino PRICE ${activeEntity}`}
            hint="Da NAV: export Price List con Nr. articolo e Prezzo unitario"
            value={data.price}
            onChange={v => updateField("price", v)}
            onPaste={handlePastePrice}
            rowCount={priceCount}
            loading={idbLoadingPrice || pasteLoadingPrice}
            savedAt={data.priceSavedAt}
            savedBy={data.priceSavedBy}
            onClear={() => handleClearField("price")}
          />
        </div>

        {parseError && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700" role="alert">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>{parseError}</span>
            <button onClick={() => setParseError(null)} className="ml-auto shrink-0 text-red-400 hover:text-red-600">
              <X size={12} aria-hidden="true" />
            </button>
          </div>
        )}
        {replaceListaMut.isError && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700" role="alert">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>
              Errore salvataggio lista:{" "}
              {replaceListaMut.error?.response?.data?.detail || replaceListaMut.error?.message || "sconosciuto"}
            </span>
            <button onClick={() => replaceListaMut.reset()} className="ml-auto shrink-0 text-red-400 hover:text-red-600">
              <X size={12} aria-hidden="true" />
            </button>
          </div>
        )}
        {listaQuery.isError && (
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700" role="alert">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>
              Errore caricamento lista dal server:{" "}
              {listaQuery.error?.response?.data?.detail || listaQuery.error?.message || "sconosciuto"}
            </span>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={handleVerifica}
            disabled={!canVerify}
            className="flex items-center gap-2 bg-[#1e3a5f] hover:bg-[#2563eb] text-white font-semibold py-2.5 px-6 rounded-xl shadow transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Play size={15} aria-hidden="true" />
            Verifica
          </button>
          {(data.item || data.price) && (
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 px-4 py-2.5 border border-gray-300 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition"
            >
              <Trash2 size={14} aria-hidden="true" />
              Pulisci ITEM/PRICE
            </button>
          )}
        </div>
      </div>

      <EntityMismatchModal
        open={mismatchOpen}
        activeEntity={activeEntity}
        detectedEntities={pendingParsed?.detectedEntities ?? new Set()}
        filename={pendingParsed?.filename ?? ""}
        onProceed={handleMismatchProceed}
        onCancel={handleMismatchCancel}
      />

      {/* Results */}
      {results && anagrafeCounts && listinoCounts && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {/* Header con titolo + bottone Discrepanze */}
          <div className="px-5 py-3.5 border-b border-gray-100 flex items-center gap-3 flex-wrap">
            <span className="text-sm font-bold text-gray-700">
              Risultati ({results.length.toLocaleString("it-IT")})
            </span>
            <div className="flex-1" />
            <button
              type="button"
              onClick={toggleDiscrepanze}
              aria-pressed={discrepanzeOnly}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold transition focus-visible:ring-2 focus-visible:ring-[#2563eb] ${
                discrepanzeOnly
                  ? "bg-amber-500 border-amber-600 text-white"
                  : "bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100"
              }`}
            >
              <AlertTriangle size={13} aria-hidden="true" />
              <span>Discrepanze</span>
              <span className="tabular-nums">{discrepancyCount.toLocaleString("it-IT")}</span>
            </button>
          </div>

          {/* Due barre counter per-group: grid a 3 colonne per allineamento automatico
              (label | totale | pillole) indipendentemente dalla lunghezza del label */}
          <div className="px-5 py-3 border-b border-gray-100">
            <div className="grid grid-cols-[auto_auto_1fr] items-center gap-x-3 gap-y-2">
              <CounterGroupRow
                title="Anagrafe NAV"
                counts={anagrafeCounts}
                filter={itemFilter}
                onChange={toggleItemFilter}
              />
              <CounterGroupRow
                title="Listino NAV"
                counts={listinoCounts}
                filter={priceFilter}
                onChange={togglePriceFilter}
              />
            </div>
          </div>

          {/* Messaggio quando nessun risultato corrisponde ai filtri */}
          {filteredResults && filteredResults.length === 0 && (
            <div className="px-5 py-8 text-center">
              {discrepanzeOnly ? (
                <div className="flex flex-col items-center gap-2 text-emerald-600">
                  <CheckCircle size={24} aria-hidden="true" />
                  <span className="text-sm font-semibold">Nessuna discrepanza presente</span>
                  <span className="text-xs text-gray-400">Le due fonti NAV concordano su tutti gli articoli verificati.</span>
                </div>
              ) : (
                <span className="text-sm text-gray-400">Nessun risultato con i filtri correnti</span>
              )}
            </div>
          )}

          {/* Results table */}
          {filteredResults && filteredResults.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-gray-600 font-semibold text-xs">
                    <th scope="col" className="px-5 py-3 text-left w-[1%] whitespace-nowrap">Codice</th>
                    <th scope="col" className="px-2 py-3 text-right w-[1%] whitespace-nowrap">Nuovo prezzo</th>
                    <th scope="col" className="px-4 py-3 text-right">Prezzo presente in anagrafe NAV</th>
                    <th scope="col" className="px-4 py-3 text-center w-[1%] whitespace-nowrap">Anagrafe</th>
                    <th scope="col" className="px-4 py-3 text-right">Prezzo presente in listino NAV</th>
                    <th scope="col" className="px-4 py-3 text-center w-[1%] whitespace-nowrap">Listino</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredResults.map((r, i) => (
                    <tr key={`${r.code}-${i}`} className="odd:bg-white even:bg-gray-50/50 border-b border-gray-100 last:border-0">
                      <td className="px-5 py-2.5 text-gray-800 font-mono text-xs whitespace-nowrap">{r.code}</td>
                      <td className="px-2 py-2.5 text-right text-gray-700 font-semibold tabular-nums whitespace-nowrap">
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
          )}
        </div>
      )}
    </div>
  )
}
