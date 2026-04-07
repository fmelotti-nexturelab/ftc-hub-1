import { useState, useMemo, useRef, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { useMutation } from "@tanstack/react-query"
import {
  LogOut, Printer, Loader2, AlertCircle, Trash2, Star,
  Plus, Minus, Tag,
} from "lucide-react"
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
  const printRootRef = useRef(null)

  // Mutation per arricchimento dati
  const enrichMut = useMutation({
    mutationFn: (codes) => itemsApi.enrichLabels(codes, mode).then(r => r.data),
    onSuccess: (data) => {
      const newItems = data.items || []
      // Append: aggiungi solo articoli non già presenti
      setItems(prev => {
        const existing = new Set(prev.map(i => i.zebra))
        const toAdd = newItems.filter(i => !existing.has(i.zebra))
        return [...prev, ...toAdd]
      })
      setCopies(prev => {
        const c = { ...prev }
        newItems.forEach(i => { if (!i.not_found && !(i.zebra in c)) c[i.zebra] = 1 })
        return c
      })
      setInputText("")
    },
  })

  // Parsing codici dall'input
  const parseCodes = useCallback(() => {
    const raw = inputText.trim()
    if (!raw) return []
    return [...new Set(
      raw.split(/[\n,;\t]+/)
        .map(s => s.trim())
        .filter(s => s.length > 0)
    )]
  }, [inputText])

  function handleSearch() {
    const codes = parseCodes()
    if (codes.length === 0) return
    enrichMut.mutate(codes)
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && e.ctrlKey) {
      e.preventDefault()
      handleSearch()
    }
  }

  function setCopyCount(zebra, delta) {
    setCopies(prev => {
      const cur = prev[zebra] || 1
      const next = Math.max(1, Math.min(99, cur + delta))
      return { ...prev, [zebra]: next }
    })
  }

  function removeItem(zebra) {
    setItems(prev => prev.filter(i => i.zebra !== zebra))
    setCopies(prev => { const n = { ...prev }; delete n[zebra]; return n })
  }

  // Items espansi per copie (per la griglia di stampa)
  const expandedItems = useMemo(() => {
    const result = []
    for (const item of items) {
      if (item.not_found) continue
      const count = copies[item.zebra] || 1
      for (let i = 0; i < count; i++) result.push(item)
    }
    return result
  }, [items, copies])

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
                  onClick={() => { setMode(opt.id); setItems([]); setCopies({}) }}
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
                    {/* Riga di inserimento in cima */}
                    <tr className="bg-blue-50/30 border-b-2 border-blue-200">
                      <td className="px-2 py-1" colSpan={7}>
                        <div className="flex items-center gap-2">
                          <label htmlFor="zebra-add" className="sr-only">Aggiungi codice zebra</label>
                          <input
                            id="zebra-add"
                            type="text"
                            value={inputText}
                            onChange={e => setInputText(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Inserisci codici zebra (uno per riga, separati da virgola o incolla lista)..."
                            className="flex-1 px-3 py-2 text-xs font-mono border border-blue-300 rounded-lg focus:ring-1 focus:ring-blue-400 outline-none"
                          />
                          <button
                            onClick={handleSearch}
                            disabled={enrichMut.isPending || !inputText.trim()}
                            className="flex items-center gap-1.5 bg-[#1e3a5f] hover:bg-[#2563eb] text-white font-semibold py-2 px-4 rounded-lg shadow transition text-xs disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                          >
                            {enrichMut.isPending
                              ? <Loader2 size={13} className="animate-spin" aria-hidden="true" />
                              : <Plus size={13} aria-hidden="true" />}
                            Aggiungi
                          </button>
                        </div>
                      </td>
                    </tr>
                    {/* Righe articoli trovati */}
                    {foundItems.map(item => (
                      <tr key={item.zebra} className="odd:bg-white even:bg-gray-50/50 hover:bg-blue-50/40">
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
                        <td className="px-3 py-1.5 text-center text-gray-400 text-[10px]">—</td>
                        <td className="px-3 py-1.5">
                          <div className="flex items-center justify-center gap-1">
                            <button onClick={() => setCopyCount(item.zebra, -1)}
                              className="w-5 h-5 flex items-center justify-center rounded bg-gray-100 hover:bg-gray-200 text-gray-600 transition"
                              aria-label="Diminuisci copie">
                              <Minus size={10} />
                            </button>
                            <span className="w-6 text-center font-semibold text-gray-700 tabular-nums">{copies[item.zebra] || 1}</span>
                            <button onClick={() => setCopyCount(item.zebra, 1)}
                              className="w-5 h-5 flex items-center justify-center rounded bg-gray-100 hover:bg-gray-200 text-gray-600 transition"
                              aria-label="Aumenta copie">
                              <Plus size={10} />
                            </button>
                          </div>
                        </td>
                        <td className="px-2 py-1.5">
                          <button onClick={() => removeItem(item.zebra)} className="text-gray-300 hover:text-red-500 transition" aria-label="Rimuovi">
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
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-700 text-xs rounded-lg px-3 py-2">
                <AlertCircle size={13} className="shrink-0 mt-0.5" aria-hidden="true" />
                <span>
                  <strong>{notFoundItems.length} codic{notFoundItems.length === 1 ? "e" : "i"} non trovat{notFoundItems.length === 1 ? "o" : "i"}:</strong>{" "}
                  {notFoundItems.map(i => i.zebra).join(", ")}
                </span>
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
