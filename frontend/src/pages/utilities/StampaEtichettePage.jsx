import { useState, useMemo, useRef, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { useMutation } from "@tanstack/react-query"
import {
  LogOut, Printer, Loader2, AlertCircle, Trash2, Star,
  Plus, Minus, Tag, X,
} from "lucide-react"

// Keywords riconosciute nell'input Barcode/Zebra per impostare la modalità EXPO
const EXPO_KEYWORDS = ["TABLE", "WALL", "BUCKET"]
const EXPO_OFF_KEYWORDS = ["OFF", "NONE", "CLEAR"]
const EXPO_OPTIONS = ["TABLE", "WALL", "BUCKET"]
import { itemsApi } from "@/api/items"
import LabelGrid from "@/components/labels/LabelGrid"
import "@/components/labels/label-print.css"

const MODE_OPTIONS = [
  { id: "advance",  label: "Stampa in anticipo" },
  { id: "normal",   label: "Normale" },
  { id: "promo",    label: "Promo" },
  { id: "bf",       label: "Black Friday" },
  { id: "special",  label: "Special" },
]

const FORMAT_OPTIONS = [
  { id: "large", label: "Grandi (3×3)", desc: "A4 landscape — 9 per pagina" },
  { id: "small", label: "Piccole (3×7)", desc: "A4 portrait — 21 per pagina" },
]

export default function StampaEtichettePage() {
  const navigate = useNavigate()
  const [mode, setMode] = useState("normal")
  const [inputText, setInputText] = useState("")
  const [format, setFormat] = useState("large")
  const [items, setItems] = useState([])
  const [copies, setCopies] = useState({}) // { zebra: number }
  const [expoMode, setExpoMode] = useState(null) // null | "TABLE" | "WALL" | "BUCKET"
  const [rowExpo, setRowExpo] = useState({}) // rowId -> "TABLE"|"WALL"|"BUCKET"|""
  const printRootRef = useRef(null)
  const inputRef = useRef(null)
  const pendingExpoRef = useRef({}) // map code -> expo da assegnare dopo enrich
  const rowIdCounterRef = useRef(0)

  // Genera un identificativo univoco per una riga (item duplicato = righe con stesso zebra ma rowId diversi)
  const nextRowId = () => `row-${++rowIdCounterRef.current}`

  // EXPO di una riga identificata dal rowId
  const getItemExpo = (rowId) => rowExpo[rowId] ?? ""

  // Normalizza un singolo token: se è in notazione scientifica (anche con virgola italiana
  // come separatore decimale, es. "2,00031E+11"), lo converte in intero stringa.
  const normalizeToken = (token) => {
    const normalized = token.replace(",", ".")
    if (/^\d+(?:\.\d+)?e[+-]?\d+$/i.test(normalized)) {
      const num = Number(normalized)
      if (Number.isFinite(num) && num > 0) {
        return Math.round(num).toString()
      }
    }
    return token
  }

  // Parsing: estrae token puliti da un testo.
  // Splitting "smart": splitta su newline/tab/punto e virgola, poi per ogni riga
  // se il contenuto NON è notazione scientifica (che contiene virgola decimale),
  // applica uno split ulteriore su virgola/spazio.
  const parseTokensFromText = useCallback((raw) => {
    if (!raw) return []
    const lines = raw.split(/[\n;\t]+/)
    const result = []
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue
      // Riga intera è notazione scientifica (con virgola o punto): tienila intera
      if (/^\d+[.,]?\d*e[+-]?\d+$/i.test(trimmed)) {
        result.push(normalizeToken(trimmed))
        continue
      }
      // Altrimenti splitta su virgola/spazio e normalizza ogni pezzo
      for (const part of trimmed.split(/[,\s]+/)) {
        const p = part.trim()
        if (p) result.push(normalizeToken(p))
      }
    }
    return result
  }, [])

  // Processa una lista di token in ordine: riconosce le keyword EXPO (switch modalità)
  // e restituisce la lista dei codici con l'expo associato al momento della lettura.
  // Nessuna deduplicazione: ogni occorrenza diventa un entry indipendente (nuova riga/tentativo).
  const processTokens = useCallback((tokens) => {
    const codes = []
    let currentMode = expoMode
    for (const t of tokens) {
      const upper = t.toUpperCase()
      if (EXPO_KEYWORDS.includes(upper)) {
        currentMode = upper
        continue
      }
      if (EXPO_OFF_KEYWORDS.includes(upper)) {
        currentMode = null
        continue
      }
      codes.push({ code: t, expo: currentMode || "" })
    }
    return { codes, finalMode: currentMode }
  }, [expoMode])

  // Mutation per arricchimento dati. Ogni nuovo item riceve un rowId univoco.
  const enrichMut = useMutation({
    mutationFn: (codes) => itemsApi.enrichLabels(codes, mode).then(r => r.data),
    onSuccess: (data) => {
      const raw = data.items || []
      // Snapshot locale del ref: gli updater di setState in React 18 vengono invocati
      // durante il prossimo render, quando pendingExpoRef.current potrebbe già essere
      // stato resettato. Catturiamo il valore QUI, in modo sincrono.
      const expoByZebra = { ...pendingExpoRef.current }
      pendingExpoRef.current = {}

      // Ogni item (trovato o non trovato) riceve un rowId univoco
      const enriched = raw.map(i => ({ ...i, rowId: nextRowId() }))
      setItems(prev => [...prev, ...enriched])
      const found = enriched.filter(i => !i.not_found)
      setCopies(prev => {
        const c = { ...prev }
        found.forEach(i => { c[i.rowId] = 1 })
        return c
      })
      setRowExpo(prev => {
        const r = { ...prev }
        found.forEach(i => {
          // Lookup via requested_code (il token originariamente digitato) se disponibile,
          // altrimenti fallback a zebra (item_no)
          const key = i.requested_code || i.zebra
          r[i.rowId] = expoByZebra[key] || ""
        })
        return r
      })
      setInputText("")
      setTimeout(() => inputRef.current?.focus(), 0)
    },
  })

  function runTokens(tokens) {
    const { codes, finalMode } = processTokens(tokens)
    // Cambia solo lo stato del mode globale (le righe già in tabella NON cambiano)
    if (finalMode !== expoMode) {
      setExpoMode(finalMode)
    }
    if (codes.length === 0) {
      setInputText("")
      setTimeout(() => inputRef.current?.focus(), 0)
      return
    }
    // Costruisce una map token -> primo item trovato (per clonare senza rifare la chiamata API).
    // Indicizza sia per item_no (zebra) sia per barcode / barcode_ext, così i re-inserimenti via
    // barcode convertito da notazione scientifica ritrovano il template senza chiamare l'API.
    const foundTemplate = new Map()
    for (const i of items) {
      if (i.not_found) continue
      if (i.zebra && !foundTemplate.has(i.zebra)) foundTemplate.set(i.zebra, i)
      if (i.barcode && !foundTemplate.has(String(i.barcode))) {
        foundTemplate.set(String(i.barcode), i)
      }
      if (i.barcode_ext && !foundTemplate.has(String(i.barcode_ext))) {
        foundTemplate.set(String(i.barcode_ext), i)
      }
    }

    const clonesToAdd = [] // [{ item, expo }]
    const newCodesToEnrich = []
    const newCodesExpo = {}
    for (const { code, expo } of codes) {
      if (foundTemplate.has(code)) {
        // Clone client-side: nuova riga, stessa data, nuovo rowId, nuovo expo
        const original = foundTemplate.get(code)
        clonesToAdd.push({ item: { ...original, rowId: nextRowId() }, expo })
      } else {
        // Nuovo codice (o duplicato di un codice non ancora in tabella): va al backend.
        // Se già in newCodesExpo, l'expo più recente sostituisce quello vecchio.
        newCodesToEnrich.push(code)
        newCodesExpo[code] = expo
      }
    }

    if (clonesToAdd.length > 0) {
      setItems(prev => [...prev, ...clonesToAdd.map(c => c.item)])
      setCopies(prev => {
        const c = { ...prev }
        clonesToAdd.forEach(({ item }) => { c[item.rowId] = 1 })
        return c
      })
      setRowExpo(prev => {
        const r = { ...prev }
        clonesToAdd.forEach(({ item, expo }) => { r[item.rowId] = expo })
        return r
      })
    }

    if (newCodesToEnrich.length > 0) {
      pendingExpoRef.current = newCodesExpo
      enrichMut.mutate(newCodesToEnrich)
    } else {
      // Solo cloni o skip: pulisci input e rifocus
      setInputText("")
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }

  function handleSearch() {
    const tokens = parseTokensFromText(inputText)
    if (tokens.length === 0) return
    runTokens(tokens)
  }

  function handleKeyDown(e) {
    // Enter e Tab entrambi confermano l'inserimento, evitando che Tab sposti il focus
    // al prossimo elemento tabbabile (es. bottone Stampa)
    if (e.key === "Enter" || e.key === "Tab") {
      if (!inputText.trim()) return // se vuoto lascia comportamento default
      e.preventDefault()
      handleSearch()
    }
  }

  // Incolla lista: se contiene separatori, scatena immediatamente la ricerca
  function handlePaste(e) {
    const pasted = e.clipboardData.getData("text")
    if (!pasted) return
    const tokens = parseTokensFromText(pasted)
    if (tokens.length >= 2 || /[\n,;\t]/.test(pasted)) {
      e.preventDefault()
      runTokens(tokens)
    }
  }

  function setCopyCount(rowId, delta) {
    setCopies(prev => {
      const cur = prev[rowId] || 1
      const next = Math.max(1, Math.min(99, cur + delta))
      return { ...prev, [rowId]: next }
    })
  }

  function removeItem(rowId) {
    setItems(prev => prev.filter(i => i.rowId !== rowId))
    setCopies(prev => { const n = { ...prev }; delete n[rowId]; return n })
    setRowExpo(prev => { const n = { ...prev }; delete n[rowId]; return n })
  }

  function removeNotFoundByZebra(zebra) {
    setItems(prev => prev.filter(i => !(i.not_found && i.zebra === zebra)))
  }

  function clearAllNotFound() {
    setItems(prev => prev.filter(i => !i.not_found))
  }

  function setItemExpo(rowId, value) {
    setRowExpo(prev => ({ ...prev, [rowId]: value }))
  }

  // Items espansi per copie (per la griglia di stampa)
  const expandedItems = useMemo(() => {
    const result = []
    for (const item of items) {
      if (item.not_found) continue
      const count = copies[item.rowId] || 1
      for (let i = 0; i < count; i++) result.push(item)
    }
    return result
  }, [items, copies])

  // Non-trovati raggruppati per zebra con conteggio (×N) per display compatto
  const notFoundGrouped = useMemo(() => {
    const map = new Map()
    for (const i of items) {
      if (!i.not_found) continue
      map.set(i.zebra, (map.get(i.zebra) || 0) + 1)
    }
    return [...map.entries()].map(([zebra, count]) => ({ zebra, count }))
  }, [items])

  const foundItems = items.filter(i => !i.not_found)
  const notFoundItems = items.filter(i => i.not_found)
  const totalLabels = expandedItems.length
  const perPage = format === "large" ? 9 : 21
  const totalPages = Math.ceil(totalLabels / perPage)

  // Stampa
  function handlePrint() {
    if (expandedItems.length === 0) return

    // Inietta @page con orientamento corretto
    const styleId = "__label-print-page-style"
    let styleEl = document.getElementById(styleId)
    if (!styleEl) {
      styleEl = document.createElement("style")
      styleEl.id = styleId
      document.head.appendChild(styleEl)
    }
    if (format === "large") {
      styleEl.textContent = "@page { size: A4 landscape; margin: 14mm 30mm 14mm 33mm; }"
    } else {
      styleEl.textContent = "@page { size: A4 portrait; margin: 16mm 4mm 13mm 23mm; }"
    }

    window.print()
  }

  return (
    <>
      {/* ── Area stampabile (nascosta a schermo, visibile in print) ── */}
      <div id="label-print-root" ref={printRootRef}>
        <LabelGrid items={expandedItems} format={format} />
      </div>

      {/* ── UI normale ── */}
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Tag size={22} className="text-[#1e3a5f]" aria-hidden="true" />
            <h1 className="text-xl font-bold text-gray-800">Stampa Etichette</h1>
          </div>
          <button
            onClick={() => navigate("/utilities")}
            className="flex items-center gap-2 border border-gray-300 text-gray-600 hover:bg-gray-50 font-semibold py-2 px-5 rounded-xl transition text-sm"
          >
            <LogOut size={15} aria-hidden="true" /> Esci
          </button>
        </div>

        {/* Selettore modalità */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="text-sm font-bold text-gray-700 uppercase tracking-wide whitespace-nowrap">Seleziona la modalità</span>
            <div className="flex items-center gap-1.5 flex-wrap">
              {MODE_OPTIONS.map(opt => (
                <button
                  key={opt.id}
                  onClick={() => { setMode(opt.id); setItems([]); setCopies({}); setRowExpo({}); setExpoMode(null) }}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
                    mode === opt.id
                      ? "bg-[#1e3a5f] text-white shadow"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <span className="text-xs text-gray-400 ml-auto">
              {mode === "normal" && "Dati da ItemList IT01 (master data)"}
              {mode === "promo" && "Dati da ItemPromo"}
              {mode === "bf" && "Dati da ItemBlackFriday"}
              {mode === "advance" && "Stampa in anticipo (prezzi futuri)"}
              {mode === "special" && "Etichette speciali"}
            </span>
          </div>
        </div>

        {/* Input tabella + Format */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4">
          {/* Tabella input articoli */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-gray-700">Lista Etichette</span>
              <span className="text-xs text-gray-400">{foundItems.length} articol{foundItems.length === 1 ? "o" : "i"} caricati</span>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto max-h-[45vh] overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
                    <tr>
                      <th scope="col" className="px-3 py-2 text-left text-gray-600 font-semibold w-[130px]">BARCODE / ZEBRA</th>
                      <th scope="col" className="px-3 py-2 text-left text-gray-600 font-semibold">DESCRIZIONE</th>
                      <th scope="col" className="px-3 py-2 text-center text-gray-600 font-semibold w-[90px]">TIPOLOGIA</th>
                      <th scope="col" className="px-3 py-2 text-right text-gray-600 font-semibold w-[90px]">PREZZO</th>
                      <th scope="col" className="px-3 py-2 text-center text-gray-600 font-semibold w-[70px]">EXPO</th>
                      <th scope="col" className="px-3 py-2 text-center text-gray-600 font-semibold w-[70px]">COPIE</th>
                      <th scope="col" className="px-3 py-2 w-8" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {/* Riga di inserimento: input solo nella colonna Barcode/Zebra */}
                    <tr className="bg-blue-50/30 border-b-2 border-blue-200">
                      <td className="px-2 py-1">
                        <label htmlFor="zebra-add" className="sr-only">Aggiungi codice zebra</label>
                        <div className="relative">
                          <input
                            id="zebra-add"
                            ref={inputRef}
                            type="text"
                            name="zebra-add-no-autofill"
                            value={inputText}
                            onChange={e => setInputText(e.target.value)}
                            onKeyDown={handleKeyDown}
                            onPaste={handlePaste}
                            placeholder="Codice Zebra..."
                            autoFocus
                            autoComplete="off"
                            autoCorrect="off"
                            autoCapitalize="off"
                            spellCheck={false}
                            data-lpignore="true"
                            data-form-type="other"
                            disabled={enrichMut.isPending}
                            className="w-full px-3 py-2 text-xs font-mono border border-blue-300 rounded-lg focus:ring-1 focus:ring-blue-400 outline-none disabled:opacity-60"
                          />
                          {enrichMut.isPending && (
                            <Loader2 size={13} className="absolute right-2 top-1/2 -translate-y-1/2 animate-spin text-blue-400" aria-hidden="true" />
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-1 text-[10px]" colSpan={6}>
                        <div className="flex items-center gap-2">
                          {expoMode ? (
                            <button
                              type="button"
                              onClick={() => setExpoMode(null)}
                              aria-label={`Disattiva modalità ${expoMode}`}
                              title="Clicca per disattivare (o digita OFF)"
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-100 text-amber-700 font-bold text-[10px] border border-amber-300 hover:bg-amber-200 transition"
                            >
                              EXPO: {expoMode}
                              <X size={10} aria-hidden="true" />
                            </button>
                          ) : (
                            <span className="text-gray-400 italic">
                              Premi <kbd className="px-1 py-0.5 bg-white border border-gray-300 rounded font-mono text-[10px]">Invio</kbd> per aggiungere — digita <strong>TABLE</strong>/<strong>WALL</strong>/<strong>BUCKET</strong> per impostare EXPO
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                    {/* Righe articoli trovati */}
                    {foundItems.map(item => (
                      <tr key={item.rowId} className="odd:bg-white even:bg-gray-50/50 hover:bg-blue-50/40">
                        <td className="px-3 py-1.5">
                          <div className="font-mono text-gray-700 whitespace-nowrap">{item.zebra}</div>
                          {item.barcode && <div className="font-mono text-[10px] text-gray-400">{item.barcode}</div>}
                        </td>
                        <td className="px-3 py-1.5 text-gray-700">
                          <div className="truncate max-w-[280px]">{item.description}</div>
                          {item.description2 && <div className="text-[10px] text-gray-400 truncate max-w-[280px]">{item.description2}</div>}
                        </td>
                        <td className="px-3 py-1.5 text-center">
                          <span className="text-[10px] font-semibold text-gray-500 uppercase">{item.category || "—"}</span>
                          {item.is_bestseller && (
                            <div className="mt-0.5"><Star size={11} className="inline text-amber-500 fill-amber-500" aria-label="Best Seller" /></div>
                          )}
                        </td>
                        <td className="px-3 py-1.5 text-right">
                          <div className="text-gray-700 font-semibold whitespace-nowrap">
                            {item.effective_price != null
                              ? item.effective_price.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " \u20AC"
                              : "—"}
                          </div>
                          {item.discount_pct
                            ? <div className="text-red-600 font-bold text-[10px]">-{item.discount_pct}%</div>
                            : item.ecc_sconto
                              ? <div className="text-red-600 font-bold text-[10px]">{item.ecc_sconto}</div>
                              : null}
                        </td>
                        <td className="px-3 py-1.5 text-center">
                          <select
                            value={getItemExpo(item.rowId)}
                            onChange={e => setItemExpo(item.rowId, e.target.value)}
                            aria-label={`Expo per ${item.zebra}`}
                            className={`text-[10px] font-bold uppercase border rounded px-1 py-0.5 bg-white focus:ring-1 focus:ring-blue-400 outline-none ${
                              getItemExpo(item.rowId)
                                ? "border-amber-300 text-amber-700"
                                : "border-gray-200 text-gray-400"
                            }`}
                          >
                            <option value="">—</option>
                            {EXPO_OPTIONS.map(opt => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-1.5">
                          <div className="flex items-center justify-center gap-1">
                            <button onClick={() => setCopyCount(item.rowId, -1)}
                              className="w-5 h-5 flex items-center justify-center rounded bg-gray-100 hover:bg-gray-200 text-gray-600 transition"
                              aria-label="Diminuisci copie">
                              <Minus size={10} />
                            </button>
                            <span className="w-6 text-center font-semibold text-gray-700 tabular-nums">{copies[item.rowId] || 1}</span>
                            <button onClick={() => setCopyCount(item.rowId, 1)}
                              className="w-5 h-5 flex items-center justify-center rounded bg-gray-100 hover:bg-gray-200 text-gray-600 transition"
                              aria-label="Aumenta copie">
                              <Plus size={10} />
                            </button>
                          </div>
                        </td>
                        <td className="px-2 py-1.5">
                          <button onClick={() => removeItem(item.rowId)} className="text-gray-300 hover:text-red-500 transition" aria-label="Rimuovi">
                            <Trash2 size={12} />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {foundItems.length === 0 && (
                      <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-400">Nessun articolo. Inserisci i codici zebra sopra.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Articoli non trovati */}
            {notFoundItems.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-amber-700 text-xs font-semibold">
                    <AlertCircle size={13} aria-hidden="true" />
                    <span>
                      {notFoundItems.length} tentativ{notFoundItems.length === 1 ? "o" : "i"} non trovat{notFoundItems.length === 1 ? "o" : "i"}
                      {notFoundGrouped.length < notFoundItems.length && (
                        <span className="ml-1 font-normal text-amber-600">
                          ({notFoundGrouped.length} codice{notFoundGrouped.length === 1 ? "" : " unici"})
                        </span>
                      )}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={clearAllNotFound}
                    className="text-[10px] text-amber-700 hover:text-amber-900 underline transition"
                  >
                    Rimuovi tutti
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {notFoundGrouped.map(({ zebra, count }) => (
                    <span
                      key={zebra}
                      className="inline-flex items-center gap-1.5 bg-white border border-amber-300 rounded-md pl-2 pr-1 py-0.5 font-mono text-[11px] text-amber-700"
                    >
                      {zebra}
                      {count > 1 && (
                        <span className="text-[9px] font-bold text-amber-600 bg-amber-100 px-1 rounded">×{count}</span>
                      )}
                      <button
                        type="button"
                        onClick={() => removeNotFoundByZebra(zebra)}
                        aria-label={`Rimuovi ${zebra}`}
                        className="w-4 h-4 flex items-center justify-center rounded hover:bg-amber-100 text-amber-400 hover:text-red-500 transition"
                      >
                        <X size={10} aria-hidden="true" />
                      </button>
                    </span>
                  ))}
                </div>
                {notFoundGrouped.some(g => g.count >= 3) && (
                  <div className="mt-2 pt-2 border-t border-amber-200 text-[10px] text-amber-700 italic">
                    Suggerimento: se hai copiato da Excel e i codici dovrebbero essere diversi,
                    la notazione scientifica potrebbe aver appiattito i valori. Formatta la colonna
                    come <strong>Testo</strong> in Excel prima di copiare.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Formato etichette */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
            <span className="text-sm font-bold text-gray-700">Formato</span>
            <div className="space-y-2">
              {FORMAT_OPTIONS.map(opt => (
                <button
                  key={opt.id}
                  onClick={() => setFormat(opt.id)}
                  className={`w-full text-left px-4 py-3 rounded-lg border-2 transition ${
                    format === opt.id
                      ? "border-[#2563eb] bg-blue-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <div className={`text-sm font-semibold ${format === opt.id ? "text-[#2563eb]" : "text-gray-700"}`}>{opt.label}</div>
                  <div className="text-xs text-gray-400">{opt.desc}</div>
                </button>
              ))}
            </div>

            {/* Riepilogo stampa */}
            {foundItems.length > 0 && (
              <div className="border-t border-gray-200 pt-3 space-y-1">
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Articoli</span>
                  <span className="font-semibold text-gray-700">{foundItems.length}</span>
                </div>
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Etichette totali</span>
                  <span className="font-semibold text-gray-700">{totalLabels}</span>
                </div>
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Pagine</span>
                  <span className="font-semibold text-gray-700">{totalPages}</span>
                </div>
              </div>
            )}

            {/* Bottone stampa */}
            <button
              onClick={handlePrint}
              disabled={expandedItems.length === 0}
              className="w-full flex items-center justify-center gap-2 bg-[#1e3a5f] hover:bg-[#2563eb] text-white font-semibold py-2.5 px-6 rounded-xl shadow transition text-sm disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Printer size={15} aria-hidden="true" /> Stampa
            </button>
          </div>
        </div>

        {/* Errore API */}
        {enrichMut.isError && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2">
            <AlertCircle size={13} className="shrink-0 mt-0.5" aria-hidden="true" />
            <span>{enrichMut.error?.response?.data?.detail || enrichMut.error?.message || "Errore"}</span>
          </div>
        )}
      </div>
    </>
  )
}
