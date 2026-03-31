import { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import {
  List, LogOut, Search, X, ChevronUp, ChevronDown,
  ChevronLeft, ChevronRight, Loader2, Package, CalendarDays, Download, FilterX,
} from "lucide-react"
import { useQuery, useInfiniteQuery } from "@tanstack/react-query"
import * as XLSX from "xlsx/dist/xlsx.full.min.js"
import { itemsApi } from "@/api/items"
import { StockCalendar } from "./stock/components/StockCalendar"

const PAGE_SIZE = 50

function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

function isoToDateStr(iso) {
  return iso ? iso.slice(0, 10) : null
}

// ── DatePickerPopover ─────────────────────────────────────────────────────────
function DatePickerPopover({ value, sessionsByDate, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const highlightedDates = new Set(Object.keys(sessionsByDate))

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
    : "Seleziona importazione"

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
        <CalendarDays size={14} aria-hidden="true" />
        <span>{displayDate}</span>
        {value && (
          <span
            role="button"
            aria-label="Rimuovi selezione data"
            onClick={e => { e.stopPropagation(); onChange(null) }}
            className="ml-0.5 opacity-70 hover:opacity-100"
          >
            <X size={12} aria-hidden="true" />
          </span>
        )}
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-30 bg-white rounded-xl border border-gray-200 shadow-xl p-4 w-72">
          <StockCalendar
            value={value}
            onChange={d => { if (highlightedDates.has(d)) { onChange(d); setOpen(false) } }}
            highlightedDates={highlightedDates}
          />
          {highlightedDates.size > 0 && (
            <p className="mt-2 text-[10px] text-gray-400 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
              Date con importazione disponibile
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ── ProductImageTooltip ───────────────────────────────────────────────────────
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
        {imgStatus === "loading" && <Loader2 size={22} className="animate-spin text-gray-300" aria-hidden="true" />}
        <img
          src={src}
          alt={itemNo}
          className={`w-44 h-44 object-contain ${imgStatus === "loaded" ? "block" : "hidden"}`}
          onLoad={() => setImgStatus("loaded")}
          onError={() => setImgStatus("error")}
        />
        {imgStatus === "error" && (
          <div className="flex flex-col items-center gap-2 text-gray-300">
            <Package size={28} aria-hidden="true" />
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

// ── Columns ───────────────────────────────────────────────────────────────────
const COLUMNS = [
  { key: "item_no",        label: "Cod. Articolo", cls: "sticky left-0 bg-inherit z-[1] w-28 min-w-[7rem]" },
  { key: "description",    label: "Descrizione",   cls: "min-w-[15rem]" },
  { key: "unit_price",     label: "Prezzo unit.",  cls: "w-24 min-w-[6rem] text-center" },
  { key: "barcode",        label: "Barcode",       cls: "w-32 min-w-[8rem] text-center" },
  { key: "units_per_pack", label: "U/Collo",       cls: "w-16 min-w-[4rem] text-center" },
  { key: "model_store",    label: "Model Store",   cls: "w-28 min-w-[7rem] text-center" },
  { key: "category",       label: "Category",      cls: "w-28 min-w-[7rem] text-center" },
  { key: "vat_pct",        label: "IVA",           cls: "w-16 min-w-[4rem] text-center" },
  { key: "description2",   label: "Descrizione 2", cls: "min-w-[12rem]" },
]

function SortIcon({ col, sort }) {
  if (sort.by !== col) return <ChevronUp size={11} className="text-gray-300 shrink-0" aria-hidden="true" />
  return sort.dir === "asc"
    ? <ChevronUp size={11} className="text-[#2563eb] shrink-0" aria-hidden="true" />
    : <ChevronDown size={11} className="text-[#2563eb] shrink-0" aria-hidden="true" />
}

// ── XLSX export ───────────────────────────────────────────────────────────────
const EXPORT_HEADERS = [
  "Nr.", "Descrizione", "Desc. Locale",
  "Magazzino", "Ultimo costo", "Prezzo unitario",
  "Cat. Articolo", "Peso netto", "Barcode",
  "Cat. IVA", "U/Collo", "Model Store",
  "Batterie", "First RP", "Category",
  "Barcode Ext.", "IVA %", "GM %",
  "Descrizione 1", "Descrizione 2",
]

async function downloadXlsx(sessionId, params, filename) {
  const { data: rows } = await itemsApi.exportItemsIT01(sessionId, params)
  const aoa = [
    EXPORT_HEADERS,
    ...rows.map(i => [
      i.item_no, i.description, i.description_local,
      i.warehouse, i.last_cost, i.unit_price,
      i.item_cat, i.net_weight, i.barcode,
      i.vat_code, i.units_per_pack, i.model_store,
      i.batteries, i.first_rp, i.category,
      i.barcode_ext, i.vat_pct, i.gm_pct,
      i.description1, i.description2,
    ]),
  ]
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, "ItemList IT01")
  XLSX.writeFile(wb, filename)
}

// ── SmallFilterInput ──────────────────────────────────────────────────────────
function SmallFilterInput({ id, label, placeholder, value, onChange }) {
  return (
    <div className="relative">
      <label htmlFor={id} className="sr-only">{label}</label>
      <input
        id={id}
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="pl-3 pr-6 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#2563eb] focus:border-transparent outline-none transition w-40"
      />
      {value && (
        <button
          aria-label={`Cancella ${label}`}
          onClick={() => onChange("")}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
        >
          <X size={11} aria-hidden="true" />
        </button>
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ItemListConsultPage() {
  const navigate = useNavigate()

  const [search, setSearch]           = useState("")
  const [filterStore, setFilterStore] = useState("")
  const [filterCat, setFilterCat]     = useState("")
  const [sort, setSort]               = useState({ by: "item_no", dir: "asc" })
  const [exporting, setExporting]     = useState(false)

  const dSearch      = useDebounce(search, 300)
  const dFilterStore = useDebounce(filterStore, 300)
  const dFilterCat   = useDebounce(filterCat, 300)

  // Quando tutti i filtri vengono azzerati → torna all'ordinamento di default
  useEffect(() => {
    if (!search && !filterStore && !filterCat) {
      setSort({ by: "item_no", dir: "asc" })
    }
  }, [search, filterStore, filterCat])

  const tableContainerRef = useRef(null)
  const loaderRef         = useRef(null)
  const hoverTimerRef     = useRef(null)
  const [hoveredItemNo, setHoveredItemNo] = useState(null)
  const [tooltip, setTooltip]             = useState(null)

  function toggleSort(col) {
    setSort(s => s.by === col ? { by: col, dir: s.dir === "asc" ? "desc" : "asc" } : { by: col, dir: "asc" })
  }

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

  // Sessions
  const { data: sessions = [], isLoading: loadingSessions } = useQuery({
    queryKey: ["items-sessions", "IT01"],
    queryFn: () => itemsApi.getSessionsIT01().then(r => r.data),
    staleTime: 30_000,
  })

  const sessionsByDate = {}
  for (const s of [...sessions].reverse()) {
    sessionsByDate[isoToDateStr(s.imported_at)] = s
  }

  const currentSession = sessions.find(s => s.is_current) ?? sessions[0] ?? null
  const defaultDate    = currentSession ? isoToDateStr(currentSession.imported_at) : null
  const [selectedDate, setSelectedDate] = useState(null)
  const activeDate  = selectedDate ?? defaultDate
  const sessionId   = activeDate ? sessionsByDate[activeDate]?.id ?? null : null

  const sortedDates     = Object.keys(sessionsByDate).sort()
  const currentDateIdx  = activeDate ? sortedDates.indexOf(activeDate) : -1
  const prevDate        = currentDateIdx > 0 ? sortedDates[currentDateIdx - 1] : null
  const nextDate        = currentDateIdx !== -1 && currentDateIdx < sortedDates.length - 1 ? sortedDates[currentDateIdx + 1] : null

  // Reset scroll on filter/sort change
  useEffect(() => {
    if (tableContainerRef.current) tableContainerRef.current.scrollTop = 0
  }, [dSearch, dFilterStore, dFilterCat, sort, sessionId])

  const queryParams = {
    search:      dSearch || undefined,
    model_store: dFilterStore || undefined,
    category:    dFilterCat || undefined,
    sort_by:     sort.by,
    sort_dir:    sort.dir,
  }

  // Items — infinite scroll
  const {
    data: itemsInfinite,
    isLoading: loadingItems,
    isFetchingNextPage,
    fetchNextPage,
    hasNextPage,
  } = useInfiniteQuery({
    queryKey: ["items-consult-it01", sessionId, dSearch, dFilterStore, dFilterCat, sort],
    queryFn: ({ pageParam }) => itemsApi.getItemsIT01(sessionId, {
      ...queryParams,
      page: pageParam,
      page_size: PAGE_SIZE,
    }).then(r => r.data),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const totalPages = Math.ceil(lastPage.total / PAGE_SIZE)
      return allPages.length < totalPages ? allPages.length + 1 : undefined
    },
    enabled: !!sessionId,
    placeholderData: prev => prev,
  })

  const items = itemsInfinite?.pages.flatMap(p => p.items) ?? []
  const total = itemsInfinite?.pages[0]?.total ?? 0

  // IntersectionObserver
  useEffect(() => {
    const container = tableContainerRef.current
    const sentinel  = loaderRef.current
    if (!container || !sentinel) return
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting && hasNextPage && !isFetchingNextPage) fetchNextPage() },
      { root: container, threshold: 0 }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  async function handleExport() {
    if (!sessionId || exporting) return
    setExporting(true)
    try {
      const dateStr = activeDate?.replace(/-/g, "") ?? "export"
      await downloadXlsx(sessionId, queryParams, `ItemList IT01 ${dateStr}.xlsx`)
    } finally {
      setExporting(false)
    }
  }

  const hasFilters = !!(search || filterStore || filterCat)

  function resetFilters() {
    setSearch("")
    setFilterStore("")
    setFilterCat("")
    setSort({ by: "item_no", dir: "asc" })
  }

  return (
    <div className="flex flex-col gap-3" style={{ height: "calc(100vh - 110px)" }}>
      {/* Header */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="w-9 h-9 bg-teal-500/10 rounded-xl flex items-center justify-center">
          <List size={18} className="text-teal-600" aria-hidden="true" />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-800">Consulta ItemList IT01</h1>
          <p className="text-xs text-gray-400 mt-0.5">Anagrafe articoli importata dal Convertitore</p>
        </div>
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition"
        >
          <LogOut size={15} aria-hidden="true" />
          Esci
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 shrink-0">
        {/* Date picker */}
        {loadingSessions ? (
          <div className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-400">
            <Loader2 size={13} className="animate-spin" aria-hidden="true" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-sm text-gray-400">Nessuna importazione disponibile.</div>
        ) : (
          <>
            <button
              aria-label="Importazione precedente"
              disabled={!prevDate}
              onClick={() => setSelectedDate(prevDate)}
              className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition"
            >
              <ChevronLeft size={14} aria-hidden="true" />
            </button>
            <DatePickerPopover
              value={activeDate}
              sessionsByDate={sessionsByDate}
              onChange={d => setSelectedDate(d)}
            />
            <button
              aria-label="Importazione successiva"
              disabled={!nextDate}
              onClick={() => setSelectedDate(nextDate)}
              className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition"
            >
              <ChevronRight size={14} aria-hidden="true" />
            </button>
          </>
        )}

        {/* Separator */}
        {sessionId && <div className="w-px h-6 bg-gray-200 mx-1" />}

        {/* 3 filtri */}
        {sessionId && (
          <>
            {/* Search */}
            <div className="relative">
              <label htmlFor="item-search" className="sr-only">Cerca articolo</label>
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" aria-hidden="true" />
              <input
                id="item-search"
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Codice, descrizione, barcode..."
                className="pl-7 pr-6 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#2563eb] focus:border-transparent outline-none transition w-52"
              />
              {search && (
                <button aria-label="Cancella ricerca" onClick={() => setSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <X size={11} aria-hidden="true" />
                </button>
              )}
            </div>

            <SmallFilterInput
              id="filter-store"
              label="Filtra Model Store"
              placeholder="Model Store"
              value={filterStore}
              onChange={setFilterStore}
            />

            <SmallFilterInput
              id="filter-cat"
              label="Filtra Category"
              placeholder="Category"
              value={filterCat}
              onChange={setFilterCat}
            />

            {/* Reset filtri */}
            {hasFilters && (
              <button
                onClick={resetFilters}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-red-600 border border-red-200 hover:bg-red-50 rounded-lg transition"
              >
                <FilterX size={13} aria-hidden="true" />
                Reset filtri
              </button>
            )}
          </>
        )}

        {/* Count + Export — sempre a destra */}
        {sessionId && !loadingItems && (
          <div className="ml-auto flex items-center gap-2">
            <span className={`text-xs tabular-nums ${hasFilters ? "text-[#2563eb] font-semibold" : "text-gray-400"}`}>
              {total.toLocaleString("it-IT")} articoli
            </span>
            <button
              onClick={handleExport}
              disabled={exporting || total === 0}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold border border-[#1e3a5f] text-[#1e3a5f] hover:bg-[#1e3a5f] hover:text-white rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {exporting
                ? <Loader2 size={13} className="animate-spin" aria-hidden="true" />
                : <Download size={13} aria-hidden="true" />}
              Estrai Vista
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      {!sessionId ? (
        <div className="flex-1 flex items-center justify-center text-sm text-gray-400">
          Nessuna importazione disponibile.
        </div>
      ) : loadingItems && items.length === 0 ? (
        <div className="flex-1 flex items-center justify-center gap-2 text-gray-400">
          <Loader2 size={18} className="animate-spin" aria-hidden="true" />
          <span className="text-sm">Caricamento...</span>
        </div>
      ) : (
        <div
          ref={tableContainerRef}
          className="flex-1 min-h-0 bg-white rounded-xl border border-gray-200 shadow-sm overflow-auto"
        >
          <table className="text-sm border-collapse" style={{ minWidth: "max-content", width: "100%" }}>
            <thead className="sticky top-0 z-10">
              <tr className="bg-gray-50 border-b border-gray-200">
                {COLUMNS.map(col => (
                  <th
                    key={col.key}
                    scope="col"
                    className={`px-3 py-2.5 text-xs font-semibold text-gray-600 whitespace-nowrap bg-gray-50 ${col.cls ?? ""}`}
                  >
                    <button
                      onClick={() => toggleSort(col.key)}
                      className="flex items-center gap-1 hover:text-[#2563eb] transition focus-visible:ring-2 focus-visible:ring-[#2563eb] rounded"
                    >
                      {col.label}
                      <SortIcon col={col.key} sort={sort} />
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={COLUMNS.length} className="px-5 py-12 text-center text-sm text-gray-400">
                    Nessun articolo trovato.
                  </td>
                </tr>
              ) : (
                items.map(item => (
                  <tr
                    key={item.id}
                    onMouseEnter={e => handleRowEnter(item.item_no, e)}
                    onMouseLeave={handleRowLeave}
                    className={`border-b border-gray-100 last:border-0 transition-colors ${
                      hoveredItemNo === item.item_no ? "bg-blue-50" : "odd:bg-white even:bg-gray-50/50"
                    }`}
                  >
                    {/* Cod. Articolo — sticky */}
                    <td className={`px-3 py-2 font-mono text-xs text-gray-700 whitespace-nowrap sticky left-0 ${
                      hoveredItemNo === item.item_no ? "bg-blue-50" : "odd:bg-white even:bg-gray-50/50 bg-inherit"
                    }`}>
                      {item.item_no}
                    </td>
                    {/* Descrizione + Desc. Locale inline */}
                    <td className="px-3 py-2 text-xs max-w-[17rem]">
                      <div className="text-gray-700 truncate">{item.description || "—"}</div>
                      {item.description_local && (
                        <div className="text-gray-400 truncate mt-0.5">{item.description_local}</div>
                      )}
                    </td>
                    {/* Prezzo */}
                    <td className="px-3 py-2 text-center text-gray-700 tabular-nums text-xs whitespace-nowrap">
                      {item.unit_price != null
                        ? item.unit_price.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                        : "—"}
                    </td>
                    {/* Barcode */}
                    <td className="px-3 py-2 text-center font-mono text-xs text-gray-500 whitespace-nowrap">{item.barcode ?? "—"}</td>
                    {/* U/Collo */}
                    <td className="px-3 py-2 text-center text-xs text-gray-500 tabular-nums whitespace-nowrap">
                      {item.units_per_pack ?? "—"}
                    </td>
                    {/* Model Store */}
                    <td className="px-3 py-2 text-center text-xs text-gray-500 whitespace-nowrap">{item.model_store || "—"}</td>
                    {/* Category */}
                    <td className="px-3 py-2 text-center text-xs text-gray-500 whitespace-nowrap">{item.category || "—"}</td>
                    {/* IVA */}
                    <td className="px-3 py-2 text-center text-xs text-gray-500 tabular-nums whitespace-nowrap">
                      {item.vat_pct != null
                        ? item.vat_pct.toLocaleString("it-IT", { minimumFractionDigits: 0, maximumFractionDigits: 1 }) + "%"
                        : "—"}
                    </td>
                    {/* Descrizione 2 — blank se "No Name 2" o "0" */}
                    <td className="px-3 py-2 text-xs text-gray-400 max-w-[14rem] truncate">
                      {item.description2 && item.description2 !== "No Name 2" && item.description2 !== "0"
                        ? item.description2
                        : "—"}
                    </td>
                  </tr>
                ))
              )}
              <tr ref={loaderRef}><td colSpan={COLUMNS.length} className="py-0" /></tr>
            </tbody>
          </table>

          {isFetchingNextPage && (
            <div className="flex items-center justify-center py-3 gap-2 text-gray-400">
              <Loader2 size={14} className="animate-spin" aria-hidden="true" />
              <span className="text-xs">Caricamento...</span>
            </div>
          )}
        </div>
      )}

      {tooltip && <ProductImageTooltip itemNo={tooltip.itemNo} x={tooltip.x} y={tooltip.y} />}
    </div>
  )
}
