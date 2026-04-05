// Vista "Consulta Stock" per una singola entity (IT01 / IT02 / IT03).
// Estratta da StockNavPage per poter essere riutilizzata anche dal drill-down
// di StockUnifiedPage (cross-entity mode) dentro Genera Tabelle.
//
// Include: DatePickerPopover (calendario), search, store filter, tabella con
// infinite scroll, esportazioni Excel (singolo store o tutti), tooltip immagine
// prodotto on hover.

import { useState, useEffect, useRef } from "react"
import {
  Package, CalendarDays, Search, X, Download,
  ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Loader2,
} from "lucide-react"
import { useQuery, useInfiniteQuery } from "@tanstack/react-query"
import { stockApi } from "@/api/stock"
import { StockCalendar } from "./StockCalendar"

const ENTITY_COLORS = {
  IT01: "bg-blue-100 text-blue-700",
  IT02: "bg-emerald-100 text-emerald-700",
  IT03: "bg-violet-100 text-violet-700",
}
const PAGE_SIZE = 50

function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

function DatePickerPopover({ value, sessions, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const highlightedDates = new Set(sessions.map(s => s.stock_date))

  useEffect(() => {
    if (!open) return
    function onMouseDown(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener("mousedown", onMouseDown)
    return () => document.removeEventListener("mousedown", onMouseDown)
  }, [open])

  const displayDate = value
    ? new Date(value + "T00:00:00").toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" })
    : "Seleziona data"

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition ${
          value
            ? "bg-[#1e3a5f] text-white border-[#1e3a5f]"
            : "bg-white text-gray-600 border-gray-200 hover:border-[#2563eb] hover:text-[#2563eb]"
        }`}
      >
        <CalendarDays size={14} />
        <span>{displayDate}</span>
        {value && (
          <span
            role="button"
            onClick={e => { e.stopPropagation(); onChange(null) }}
            className="ml-0.5 opacity-70 hover:opacity-100"
          >
            <X size={12} />
          </span>
        )}
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-30 bg-white rounded-xl border border-gray-200 shadow-xl p-4 w-72">
          <StockCalendar
            value={value}
            onChange={d => { onChange(d); setOpen(false) }}
            highlightedDates={highlightedDates}
          />
          {highlightedDates.size > 0 && (
            <p className="mt-2 text-[10px] text-gray-400 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
              Date con stock disponibile
            </p>
          )}
        </div>
      )}
    </div>
  )
}

async function downloadExcel(sessionId, storeCode, filename) {
  const response = await stockApi.exportExcel(sessionId, storeCode)
  const blob = new Blob([response.data], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function ProductImageTooltip({ itemNo, x, y }) {
  const [imgStatus, setImgStatus] = useState("loading")
  const src = `https://productimages.flyingtiger.com/itemimages/${itemNo}.jpg`
  const left = Math.min(x, window.innerWidth - 210)
  const top = Math.min(Math.max(y, 8), window.innerHeight - 230)

  return (
    <div
      style={{ position: "fixed", left, top, zIndex: 9999, pointerEvents: "none" }}
      className="bg-white rounded-xl border border-gray-200 shadow-xl overflow-hidden w-48"
    >
      <div className="p-2 flex items-center justify-center" style={{ minHeight: 176 }}>
        {imgStatus === "loading" && (
          <Loader2 size={22} className="animate-spin text-gray-300" />
        )}
        <img
          src={src}
          alt={itemNo}
          className={`w-44 h-44 object-contain ${imgStatus === "loaded" ? "block" : "hidden"}`}
          onLoad={() => setImgStatus("loaded")}
          onError={() => setImgStatus("error")}
        />
        {imgStatus === "error" && (
          <div className="flex flex-col items-center gap-2 text-gray-300">
            <Package size={28} />
            <span className="text-xs">Immagine non disponibile</span>
          </div>
        )}
      </div>
      <div className="px-3 py-2 bg-gray-50 border-t border-gray-100">
        <span className="text-xs font-mono text-gray-500">{itemNo}</span>
      </div>
    </div>
  )
}

/**
 * Vista consulta stock per una entity. Carica sessioni, permette selezione data
 * via calendario, filtri (search + store), infinite scroll sulla tabella e
 * esportazioni Excel.
 */
export default function StockConsultaEntityView({ entity }) {
  const [selectedDate, setSelectedDate] = useState(() => {
    const t = new Date()
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`
  })
  const [search, setSearch] = useState("")
  const [selectedStore, setSelectedStore] = useState("")
  const [sort, setSort] = useState({ by: "item_no", dir: "asc" })
  const [exportingAll, setExportingAll] = useState(false)
  const [exportingStore, setExportingStore] = useState(false)
  const debouncedSearch = useDebounce(search, 300)

  function toggleSort(col) {
    setSort((s) => s.by === col ? { by: col, dir: s.dir === "asc" ? "desc" : "asc" } : { by: col, dir: "asc" })
  }
  const tableContainerRef = useRef(null)
  const loaderRef = useRef(null)
  const hoverTimerRef = useRef(null)
  const [hoveredItemNo, setHoveredItemNo] = useState(null)
  const [tooltip, setTooltip] = useState(null)

  function handleRowEnter(itemNo, e) {
    setHoveredItemNo(itemNo)
    const x = e.clientX + 20
    const y = e.clientY - 80
    hoverTimerRef.current = setTimeout(() => setTooltip({ itemNo, x, y }), 1000)
  }

  function handleRowLeave() {
    setHoveredItemNo(null)
    clearTimeout(hoverTimerRef.current)
    setTooltip(null)
  }

  // Scroll to top when filters change
  useEffect(() => {
    if (tableContainerRef.current) tableContainerRef.current.scrollTop = 0
  }, [debouncedSearch, selectedStore, selectedDate])

  const { data: sessions = [] } = useQuery({
    queryKey: ["stock-sessions", entity],
    queryFn: () => stockApi.getSessions(entity).then(r => r.data),
  })

  const session = sessions.find(s => s.stock_date === selectedDate) ?? null

  // Navigazione data prev/next tra sessioni disponibili
  const sortedDates = [...sessions].sort((a, b) => a.stock_date.localeCompare(b.stock_date)).map(s => s.stock_date)
  const currentDateIdx = selectedDate ? sortedDates.indexOf(selectedDate) : -1
  const prevDate = currentDateIdx > 0 ? sortedDates[currentDateIdx - 1] : null
  const nextDate = currentDateIdx !== -1 && currentDateIdx < sortedDates.length - 1 ? sortedDates[currentDateIdx + 1] : null

  // Store codes: prima dal session metadata, fallback da endpoint dedicato
  const { data: storesData } = useQuery({
    queryKey: ["stock-session-stores", session?.id],
    queryFn: () => stockApi.getSessionStores(session.id).then(r => r.data.store_codes),
    enabled: !!session,
    staleTime: Infinity,
  })
  const storeCodes = storesData ?? session?.store_codes ?? []

  // Items query — infinite scroll
  const {
    data: itemsInfinite,
    isLoading: loadingItems,
    isFetchingNextPage,
    fetchNextPage,
    hasNextPage,
  } = useInfiniteQuery({
    queryKey: ["stock-consulta-items", entity, session?.id, debouncedSearch, selectedStore, sort],
    queryFn: ({ pageParam }) => stockApi.getSessionItems(session.id, {
      page: pageParam,
      page_size: PAGE_SIZE,
      search: debouncedSearch,
      store_code: selectedStore || undefined,
      sort_by: sort.by,
      sort_dir: sort.dir,
    }).then(r => r.data),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const totalPages = Math.ceil(lastPage.total / PAGE_SIZE)
      return allPages.length < totalPages ? allPages.length + 1 : undefined
    },
    enabled: !!session,
    placeholderData: (prev) => prev,
  })

  const items = itemsInfinite?.pages.flatMap(p => p.items) ?? []
  const total = itemsInfinite?.pages[0]?.total ?? 0

  // IntersectionObserver — carica la pagina successiva quando il sentinel e' visibile
  useEffect(() => {
    const container = tableContainerRef.current
    const sentinel = loaderRef.current
    if (!container || !sentinel) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasNextPage && !isFetchingNextPage) fetchNextPage()
      },
      { root: container, threshold: 0 }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  function handleDateChange(d) {
    setSelectedDate(d)
  }

  async function handleExportAll() {
    if (!session) return
    setExportingAll(true)
    try {
      const datePart = session.stock_date.replace(/-/g, "")
      await downloadExcel(session.id, null, `${datePart} Stock ${entity}.xlsx`)
    } finally { setExportingAll(false) }
  }

  async function handleExportStore() {
    if (!session || !selectedStore) return
    setExportingStore(true)
    try {
      const datePart = session.stock_date.replace(/-/g, "")
      await downloadExcel(session.id, selectedStore, `${datePart} Stock ${entity} ${selectedStore}.xlsx`)
    } finally { setExportingStore(false) }
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <DatePickerPopover value={selectedDate} sessions={sessions} onChange={handleDateChange} />

        {session && (
          <>
            {/* Search */}
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Cerca articolo o descrizione..."
                className="pl-7 pr-7 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#2563eb] focus:border-transparent outline-none transition w-64"
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Store select */}
            <select
              value={selectedStore}
              onChange={e => setSelectedStore(e.target.value)}
              className="py-2 pl-3 pr-7 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#2563eb] outline-none transition text-gray-600 bg-white"
            >
              <option value="">Tutti i negozi</option>
              {storeCodes.map(code => (
                <option key={code} value={code}>{code}</option>
              ))}
            </select>

            <div className="flex-1" />

            {/* Export store */}
            <button
              onClick={handleExportStore}
              disabled={!selectedStore || exportingStore}
              className="flex items-center gap-1.5 text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-600 hover:bg-gray-50 hover:text-gray-800 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {exportingStore ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              Esporta {selectedStore || "store"}
            </button>

            {/* Export all */}
            <button
              onClick={handleExportAll}
              disabled={exportingAll}
              className="flex items-center gap-1.5 text-sm bg-[#1e3a5f] hover:bg-[#2563eb] text-white font-semibold px-3 py-2 rounded-lg shadow transition disabled:opacity-50"
            >
              {exportingAll ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              Esporta tutto
            </button>
          </>
        )}
      </div>

      {/* Stats bar */}
      {session && (
        <div className="flex items-center gap-3 bg-[#1e3a5f] text-white rounded-xl px-4 py-2.5">
          <span className={`text-xs font-bold px-2 py-0.5 rounded ${ENTITY_COLORS[entity]}`}>{entity}</span>
          <button
            onClick={() => prevDate && handleDateChange(prevDate)}
            disabled={!prevDate}
            className="w-5 h-5 flex items-center justify-center rounded hover:bg-white/15 disabled:opacity-25 transition"
          >
            <ChevronLeft size={14} />
          </button>
          <span className="text-sm font-semibold">
            {new Date(session.stock_date + "T00:00:00").toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric" })}
          </span>
          <button
            onClick={() => nextDate && handleDateChange(nextDate)}
            disabled={!nextDate}
            className="w-5 h-5 flex items-center justify-center rounded hover:bg-white/15 disabled:opacity-25 transition"
          >
            <ChevronRight size={14} />
          </button>
          <div className="w-px h-4 bg-white/20" />
          <span className="text-xs text-white/70">{session.total_items.toLocaleString("it-IT")} articoli</span>
          <div className="w-px h-4 bg-white/20" />
          <span className="text-xs text-white/70">{session.total_stores} negozi</span>
          {total !== session.total_items && (
            <>
              <div className="w-px h-4 bg-white/20" />
              <span className="text-xs text-amber-300">{total.toLocaleString("it-IT")} risultati</span>
            </>
          )}
        </div>
      )}

      {/* Empty states */}
      {!selectedDate && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm py-16 text-center">
          <CalendarDays size={32} className="mx-auto text-gray-300 mb-3" />
          <p className="text-sm text-gray-500">Seleziona una data per visualizzare lo stock</p>
          <p className="text-xs text-gray-400 mt-1">Le date con il pallino arancio hanno dati disponibili</p>
        </div>
      )}

      {selectedDate && !session && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm py-16 text-center">
          <Package size={32} className="mx-auto text-gray-300 mb-3" />
          <p className="text-sm text-gray-500">Nessuno stock caricato per il {new Date(selectedDate + "T00:00:00").toLocaleDateString("it-IT")}</p>
        </div>
      )}

      {/* Table */}
      {session && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div
            ref={tableContainerRef}
            className="overflow-auto"
            style={{ maxHeight: "calc(100vh - 340px)" }}
          >
            <table className="text-sm" style={{ minWidth: "max-content" }}>
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th scope="col" className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 sticky top-0 left-0 bg-gray-50 z-30">
                    <button onClick={() => toggleSort("item_no")} className="flex items-center gap-1 hover:text-gray-900 transition" aria-label="Ordina per No.">
                      No.
                      {sort.by === "item_no"
                        ? sort.dir === "asc" ? <ChevronUp size={11} aria-hidden="true" /> : <ChevronDown size={11} aria-hidden="true" />
                        : <ChevronUp size={11} className="text-gray-300" aria-hidden="true" />}
                    </button>
                  </th>
                  <th scope="col" className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 sticky top-0 left-[88px] bg-gray-50 z-30 min-w-[220px]">
                    <button onClick={() => toggleSort("description")} className="flex items-center gap-1 hover:text-gray-900 transition" aria-label="Ordina per Descrizione">
                      Descrizione
                      {sort.by === "description"
                        ? sort.dir === "asc" ? <ChevronUp size={11} aria-hidden="true" /> : <ChevronDown size={11} aria-hidden="true" />
                        : <ChevronUp size={11} className="text-gray-300" aria-hidden="true" />}
                    </button>
                  </th>
                  {!selectedStore && <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-600 sticky top-0 bg-gray-50 z-20">ADM</th>}
                  {selectedStore
                    ? <th className="px-4 py-2.5 text-right text-xs font-semibold text-[#1e3a5f] sticky top-0 bg-gray-50 z-20">{selectedStore}</th>
                    : storeCodes.map(code => (
                        <th key={code} className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 whitespace-nowrap sticky top-0 bg-gray-50 z-20">{code}</th>
                      ))
                  }
                </tr>
              </thead>
              <tbody>
                {loadingItems ? (
                  <tr>
                    <td colSpan={selectedStore ? 3 : 3 + storeCodes.length} className="px-4 py-10 text-center text-gray-400 text-xs">
                      <Loader2 size={18} className="animate-spin mx-auto mb-2" />
                      Caricamento...
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={selectedStore ? 3 : 3 + storeCodes.length} className="px-4 py-10 text-center text-gray-400 text-xs">
                      Nessun risultato
                    </td>
                  </tr>
                ) : (
                  items.map((item, i) => {
                    const isHovered = hoveredItemNo === item.item_no
                    const rowBg = isHovered ? "bg-blue-50" : i % 2 === 0 ? "bg-white" : "bg-gray-50/50"
                    return (
                    <tr
                      key={item.item_no + i}
                      className={`border-b border-gray-100 last:border-0 transition-colors cursor-default ${rowBg}`}
                      onMouseEnter={(e) => handleRowEnter(item.item_no, e)}
                      onMouseLeave={handleRowLeave}
                    >
                      <td className={`px-4 py-2 font-mono text-xs text-gray-700 sticky left-0 transition-colors ${rowBg}`}>{item.item_no}</td>
                      <td className={`px-4 py-2 text-gray-600 text-xs sticky left-[88px] transition-colors ${rowBg} min-w-[220px]`}>
                        <div>{item.description}</div>
                        {item.description_local && item.description_local !== item.description && (
                          <div className="text-gray-400" style={{ fontSize: "10px" }}>{item.description_local}</div>
                        )}
                      </td>
                      {!selectedStore && <td className="px-4 py-2 text-right text-gray-700 text-xs">{item.adm_stock?.toLocaleString("it-IT") ?? "—"}</td>}
                      {selectedStore
                        ? <td className="px-4 py-2 text-right font-semibold text-gray-800 text-xs">
                            {(item.stores?.[selectedStore] ?? 0).toLocaleString("it-IT")}
                          </td>
                        : storeCodes.map(code => (
                            <td key={code} className="px-3 py-2 text-right text-xs text-gray-600">
                              {item.stores?.[code] ? item.stores[code].toLocaleString("it-IT") : <span className="text-gray-300">—</span>}
                            </td>
                          ))
                      }
                    </tr>
                  )})
                )}
              </tbody>
              <tfoot>
                <tr>
                  <td ref={loaderRef} colSpan={selectedStore ? 3 : 3 + storeCodes.length} className="px-4 py-3 text-center">
                    {isFetchingNextPage && (
                      <span className="flex items-center justify-center gap-2 text-xs text-gray-400">
                        <Loader2 size={13} className="animate-spin" />
                        Caricamento...
                      </span>
                    )}
                    {!hasNextPage && items.length > 0 && (
                      <span className="text-[10px] text-gray-300">
                        — {items.length.toLocaleString("it-IT")} articoli —
                      </span>
                    )}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {tooltip && (
        <ProductImageTooltip itemNo={tooltip.itemNo} x={tooltip.x} y={tooltip.y} />
      )}
    </div>
  )
}
