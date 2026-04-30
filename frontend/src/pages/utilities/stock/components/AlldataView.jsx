import { useRef, useState, useEffect, useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  Search, Download, Loader2, AlertCircle, ChevronLeft, ChevronRight, ImageOff,
  ChevronsLeft, ChevronsRight,
} from "lucide-react"
import { stockApi } from "@/api/stock"
import { itemsApi } from "@/api/items"

const PAGE_SIZE = 50
const PHOTO_URL = (itemNo) => `https://productimages.flyingtiger.com/itemimages/${itemNo}.jpg`
const COLL_W = 22

const ANA_COLS = { category: 90, item_cat: 65, barcode: 110, upk: 55, nw: 65, vat: 50, gm: 50, ms: 80, frp: 72 }
const OTH_COLS = { eco: 42, expo: 52, kgl: 58, kgl_um: 60, prezzo: 72, promo: 72, bf: 50, bs: 56, si: 54, sw: 54, pk: 52 }
const CW_ECC  = [55, 65, 120, 65]
const CW_INFO = [140, 140, 80, 65]
const ECC_SPAN  = CW_ECC.length
const INFO_SPAN = CW_INFO.length

// Altezze righe thead (per sticky top)
const ROW1_H = 29
const ROW2_H = 28

function formatDate(iso) {
  if (!iso) return "—"
  const [y, m, d] = iso.split("-")
  return `${d}/${m}/${y}`
}
function fPrice(v) {
  if (v == null) return "—"
  return v.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function storeCodeFmt(code) {
  const d = code.replace(/\D/g, "")
  return "IT" + d.slice(0, 1).padStart(2, "0") + d.slice(1).padStart(3, "0")
}
function Check() { return <span className="text-emerald-500 font-bold text-[13px]">✓</span> }
function Dash()  { return <span className="text-gray-200">—</span> }
function StockCell({ value }) {
  if (!value || value === 0) return <span className="text-gray-200">—</span>
  return <span className={value > 0 ? "text-gray-700" : "text-red-500 font-medium"}>{value}</span>
}
function SalesCell({ value }) {
  if (!value || value === 0) return <span className="text-gray-200">—</span>
  return <span className="text-[#b8bec8]">{value.toLocaleString("it-IT")}</span>
}

const ENT = {
  IT01: { bg: "bg-blue-600",    light: "bg-blue-50",    text: "text-blue-700",    th: "bg-blue-100 text-blue-800",    sales: "bg-blue-50/80"    },
  IT02: { bg: "bg-emerald-600", light: "bg-emerald-50", text: "text-emerald-700", th: "bg-emerald-100 text-emerald-800", sales: "bg-emerald-50/80" },
  IT03: { bg: "bg-violet-600",  light: "bg-violet-50",  text: "text-violet-700",  th: "bg-violet-100 text-violet-800",  sales: "bg-violet-50/80"  },
}

function ToggleBtn({ collapsed, onClick, label, colorClass = "text-gray-500" }) {
  return (
    <button
      onClick={e => { e.stopPropagation(); onClick() }}
      aria-label={collapsed ? `Espandi ${label}` : `Comprimi ${label}`}
      title={collapsed ? `Espandi ${label}` : `Comprimi ${label}`}
      className={`inline-flex items-center justify-center rounded transition hover:opacity-60 active:scale-95 shrink-0 ${colorClass}`}
      style={{ width: 14, height: 14 }}
    >
      {collapsed ? <ChevronsRight size={11} /> : <ChevronsLeft size={11} />}
    </button>
  )
}

export default function AlldataView() {
  const [search, setSearch]         = useState("")
  const [debouncedSearch, setDeb]   = useState("")
  const [page, setPage]             = useState(1)
  const [downloading, setDl]        = useState(false)
  const [dlError, setDlError]       = useState(null)
  const [tooltip, setTooltip]       = useState(null)
  const [imgOk, setImgOk]           = useState({})
  const [coll, setColl]           = useState({ ana: false, oth: false, ecc: false, inf: false, IT01: false, IT02: false, IT03: false })
  const debTimer                  = useRef(null)
  const hideTimer                 = useRef(null)
  const scrollRef                 = useRef(null)
  const topScrollRef              = useRef(null)
  const tableRef                  = useRef(null)
  const entRefs                   = { IT01: useRef(null), IT02: useRef(null), IT03: useRef(null) }

  const toggle = (key) => setColl(p => ({ ...p, [key]: !p[key] }))

  // ── CW / CL dinamici ─────────────────────────────────────────────────────
  const CW = useMemo(() => ({
    no: 90, desc: 222,
    ...(coll.ana ? { ana_col: COLL_W } : ANA_COLS),
    ...(coll.oth ? { oth_col: COLL_W } : OTH_COLS),
    tot: 64,
  }), [coll.ana, coll.oth])

  const CL = useMemo(() => {
    let c = 0; const r = {}
    for (const [k, v] of Object.entries(CW)) { r[k] = c; c += v }
    return r
  }, [CW])

  const STICKY_WIDTH = useMemo(() => Object.values(CW).reduce((a, b) => a + b, 0), [CW])

  function ss(key, z = 5) {
    return { position: "sticky", left: (CL[key] ?? 0) + "px", zIndex: z, width: (CW[key] ?? COLL_W) + "px", minWidth: (CW[key] ?? COLL_W) + "px" }
  }
  function sh(key)  { return { ...ss(key, 20), top: 0 } }
  function sh2(key) { return { ...ss(key, 20), top: ROW1_H + "px" } }

  const TOT_EXT    = { boxShadow: "4px 0 8px -2px rgba(0,0,0,0.12)", borderRight: "2px solid #94a3b8" }
  const TOT_BORDER = { ...ss("tot"),  ...TOT_EXT }
  const TOT_H1     = { ...sh("tot"),  ...TOT_EXT }
  const TOT_H2     = { ...sh2("tot"), ...TOT_EXT }

  // Riga 2 scrollabile (non-sticky): sticky solo verticale
  const th2Scroll  = { position: "sticky", top: ROW1_H + "px", zIndex: 10 }
  // Riga 3 scrollabile: sticky sotto le righe 1+2
  const th3Scroll  = { position: "sticky", top: (ROW1_H + ROW2_H) + "px", zIndex: 10 }

  function handleSearch(val) {
    setSearch(val)
    clearTimeout(debTimer.current)
    debTimer.current = setTimeout(() => { setDeb(val); setPage(1) }, 320)
  }

  function scrollToEntity(ent) {
    if (coll[ent]) setColl(p => ({ ...p, [ent]: false }))
    setTimeout(() => {
      const container = scrollRef.current
      const target    = entRefs[ent].current
      if (!container || !target) return
      const cr = container.getBoundingClientRect()
      const tr = target.getBoundingClientRect()
      container.scrollBy({ left: tr.left - cr.left - STICKY_WIDTH - 8, behavior: "smooth" })
    }, 60)
  }

  const { data: salesSync } = useQuery({
    queryKey: ["sales-l2w-last-sync"],
    queryFn: () => itemsApi.getSalesL2WLastSync().then(r => r.data),
    staleTime: 60_000,
  })

  const { data: stats } = useQuery({
    queryKey: ["alldata-stats"],
    queryFn: () => stockApi.getAlldataStats().then(r => r.data),
    staleTime: 120_000,
  })

  const { data, isLoading, isError } = useQuery({
    queryKey: ["alldata", debouncedSearch, page],
    queryFn: () =>
      stockApi.getAlldata({ page, page_size: PAGE_SIZE, search: debouncedSearch }).then(r => r.data),
    staleTime: 60_000,
    keepPreviousData: true,
  })

  const total      = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const items      = data?.items ?? []

  const sc = {
    IT01: stats?.store_codes_it01 ?? [],
    IT02: stats?.store_codes_it02 ?? [],
    IT03: stats?.store_codes_it03 ?? [],
  }

  function calcTot(item) {
    let t = 0
    sc.IT01.forEach(s => { t += item.stock_it01?.[s] ?? 0 })
    sc.IT02.forEach(s => { t += item.stock_it02?.[s] ?? 0 })
    sc.IT03.forEach(s => { t += item.stock_it03?.[s] ?? 0 })
    return t
  }

  async function handleDownload() {
    setDl(true); setDlError(null)
    try {
      const resp = await stockApi.exportAlldata()
      const cd = resp.headers?.["content-disposition"] || ""
      const m  = cd.match(/filename="?([^"]+)"?/)
      const fn = m ? m[1] : `ALLDATA_${new Date().toISOString().slice(0, 10).replace(/-/g, "")}.xlsx`
      const url = URL.createObjectURL(resp.data)
      const a = document.createElement("a"); a.href = url; a.download = fn; a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      setDlError(e?.response?.data?.detail || e?.message || "Errore download")
    } finally { setDl(false) }
  }

  function handleCellEnter(e, item) {
    clearTimeout(hideTimer.current)
    const rect = e.currentTarget.getBoundingClientRect()
    const CARD_W = 280, CARD_H = 300
    let x = rect.right + 8, y = rect.top - 8
    if (x + CARD_W > window.innerWidth - 8)  x = rect.left - CARD_W - 8
    if (y + CARD_H > window.innerHeight - 8) y = window.innerHeight - CARD_H - 8
    if (y < 8) y = 8
    setTooltip({ item, x, y })
  }
  function handleCellLeave() {
    hideTimer.current = setTimeout(() => setTooltip(null), 80)
  }

  useEffect(() => {
    const top = topScrollRef.current
    const bot = scrollRef.current
    if (!top || !bot) return
    let busy = false
    const fromTop = () => { if (!busy) { busy = true; bot.scrollLeft = top.scrollLeft; busy = false } }
    const fromBot = () => { if (!busy) { busy = true; top.scrollLeft = bot.scrollLeft; busy = false } }
    top.addEventListener("scroll", fromTop, { passive: true })
    bot.addEventListener("scroll", fromBot, { passive: true })
    return () => {
      top.removeEventListener("scroll", fromTop)
      bot.removeEventListener("scroll", fromBot)
    }
  }, [])

  useEffect(() => {
    const tbl    = tableRef.current
    const topDiv = topScrollRef.current
    if (!tbl || !topDiv) return
    const spacer = topDiv.querySelector("[data-spacer]")
    if (spacer) spacer.style.width = tbl.scrollWidth + "px"
  }, [items, sc.IT01.length, sc.IT02.length, sc.IT03.length, coll])

  // 1 ADM + 2 cols (stock+sales) per negozio
  const entCols = (ent) => coll[ent] ? 1 : (sc[ent].length > 0 ? 1 + 2 * sc[ent].length : 0)
  const totalCols = Object.keys(CW).length
    + (coll.ecc ? 1 : ECC_SPAN)
    + (coll.inf ? 1 : INFO_SPAN)
    + entCols("IT01") + entCols("IT02") + entCols("IT03")

  return (
    <div className="space-y-4">

      {/* Banner */}
      {stats && (
        <div className="bg-[#1e3a5f] rounded-xl px-5 py-3 flex flex-wrap items-center gap-x-6 gap-y-2">
          <div className="text-white font-bold text-sm">
            {stats.total_items.toLocaleString("it-IT")} articoli
          </div>
          <div className="flex items-center gap-4 text-white/70 text-xs">
            <span>Promo: <b className="text-white">{stats.items_with_promo.toLocaleString("it-IT")}</b></span>
            <span>BF: <b className="text-white">{stats.items_with_bf.toLocaleString("it-IT")}</b></span>
            <span>Eccezioni: <b className="text-white">{stats.items_with_eccezione.toLocaleString("it-IT")}</b></span>
            <span>BestSeller: <b className="text-white">{stats.items_bestseller.toLocaleString("it-IT")}</b></span>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            {["IT01", "IT02", "IT03"].map(ent => (
              <button key={ent} onClick={() => scrollToEntity(ent)}
                className={`text-[10px] font-bold px-2 py-1 rounded ${ENT[ent].bg} text-white hover:opacity-80 active:scale-95 transition`}
                aria-label={`Vai a stock ${ent}`}>
                STOCK {ent} · {formatDate(stats[`stock_date_${ent.toLowerCase()}`])} · {sc[ent].length} negozi
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Info Sales L2W */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-2.5 flex items-center gap-3 text-xs text-gray-500">
        <span className="font-semibold text-gray-700">Sales L2W</span>
        {salesSync?.last_sync ? (
          <>
            <span>Ultimo aggiornamento: <b className="text-gray-700">{new Date(salesSync.last_sync).toLocaleString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}</b></span>
            {salesSync.week_from && salesSync.week_to && (
              <span className="text-emerald-600 font-medium">· settimane {salesSync.week_from} → {salesSync.week_to}</span>
            )}
          </>
        ) : (
          <span className="italic text-gray-400">Nessun dato — esegui sales_sync.py</span>
        )}
        <span className="ml-auto text-gray-300 text-[10px]">aggiornato da sales_sync.py</span>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <label htmlFor="alldata-search" className="sr-only">Cerca articolo</label>
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
          <input id="alldata-search" type="text" placeholder="Cerca per codice o descrizione…"
            value={search} onChange={e => handleSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2563eb] focus:border-transparent outline-none transition" />
        </div>
        <button onClick={handleDownload} disabled={downloading}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-purple-600 hover:bg-purple-700 text-white shadow transition disabled:opacity-50">
          {downloading
            ? <><Loader2 size={13} className="animate-spin" aria-hidden="true" /> Generazione…</>
            : <><Download size={13} aria-hidden="true" /> Scarica Excel</>}
        </button>
      </div>

      {dlError && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
          <AlertCircle size={13} aria-hidden="true" /> {dlError}
        </div>
      )}

      {/* Tabella */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">

        {/* Scrollbar superiore */}
        <div ref={topScrollRef} className="overflow-x-auto overflow-y-hidden border-b border-gray-100" style={{ height: "14px" }}>
          <div data-spacer style={{ height: "1px" }} />
        </div>

        <div className="overflow-auto max-h-[calc(100vh-280px)]" ref={scrollRef}>
          <table ref={tableRef} className="text-[11px] border-collapse" style={{ tableLayout: "fixed" }}>

            <colgroup>
              <col style={{ width: CW.no   + "px" }} />
              <col style={{ width: CW.desc + "px" }} />
              {coll.ana
                ? <col style={{ width: COLL_W + "px" }} />
                : Object.values(ANA_COLS).map((w, i) => <col key={`cg-a${i}`} style={{ width: w + "px" }} />)
              }
              {coll.oth
                ? <col style={{ width: COLL_W + "px" }} />
                : Object.values(OTH_COLS).map((w, i) => <col key={`cg-o${i}`} style={{ width: w + "px" }} />)
              }
              <col style={{ width: CW.tot + "px" }} />
              {CW_ECC.map((w, i)  => <col key={`cg-ecc-${i}`}  style={{ width: w + "px" }} />)}
              {CW_INFO.map((w, i) => <col key={`cg-inf-${i}`}  style={{ width: w + "px" }} />)}
              {/* Entity: ADM + (stock 52px + sales 52px) per negozio */}
              {sc.IT01.length > 0 && (coll.IT01
                ? <col key="cg-01c" style={{ width: COLL_W + "px" }} />
                : [<col key="cg-01-adm" style={{ width: "68px" }} />,
                   ...sc.IT01.flatMap(s => [
                     <col key={`cg-01-stk-${s}`} style={{ width: "52px" }} />,
                     <col key={`cg-01-sls-${s}`} style={{ width: "52px" }} />,
                   ])]
              )}
              {sc.IT02.length > 0 && (coll.IT02
                ? <col key="cg-02c" style={{ width: COLL_W + "px" }} />
                : [<col key="cg-02-adm" style={{ width: "68px" }} />,
                   ...sc.IT02.flatMap(s => [
                     <col key={`cg-02-stk-${s}`} style={{ width: "52px" }} />,
                     <col key={`cg-02-sls-${s}`} style={{ width: "52px" }} />,
                   ])]
              )}
              {sc.IT03.length > 0 && (coll.IT03
                ? <col key="cg-03c" style={{ width: COLL_W + "px" }} />
                : [<col key="cg-03-adm" style={{ width: "68px" }} />,
                   ...sc.IT03.flatMap(s => [
                     <col key={`cg-03-stk-${s}`} style={{ width: "52px" }} />,
                     <col key={`cg-03-sls-${s}`} style={{ width: "52px" }} />,
                   ])]
              )}
            </colgroup>

            <thead>
              {/* ── Riga 1: gruppi ── */}
              <tr className="border-b border-gray-300">
                <th scope="col" colSpan={2} style={sh("no")} className="bg-gray-100 px-2 py-1.5" />

                {/* ANAGRAFICA */}
                {coll.ana ? (
                  <th scope="col" style={sh("ana_col")}
                    className="bg-sky-100 cursor-pointer hover:bg-sky-200 transition border-r border-sky-300"
                    onClick={() => toggle("ana")} title="Espandi Anagrafica">
                    <div className="flex items-center justify-center"><ChevronsRight size={11} className="text-sky-600" aria-hidden="true" /></div>
                  </th>
                ) : (
                  <th scope="col" colSpan={Object.keys(ANA_COLS).length} style={sh("category")}
                    className="px-2 py-1.5 text-center font-bold bg-sky-100 text-sky-800 border-r border-sky-300 whitespace-nowrap">
                    <div className="flex items-center justify-center gap-1.5">
                      ANAGRAFICA
                      <ToggleBtn collapsed={false} onClick={() => toggle("ana")} label="Anagrafica" colorClass="text-sky-600" />
                    </div>
                  </th>
                )}

                {/* OTHER DATA */}
                {coll.oth ? (
                  <th scope="col" style={sh("oth_col")}
                    className="bg-gray-100 cursor-pointer hover:bg-gray-200 transition border-r border-gray-300"
                    onClick={() => toggle("oth")} title="Espandi Other Data">
                    <div className="flex items-center justify-center"><ChevronsRight size={11} className="text-gray-500" aria-hidden="true" /></div>
                  </th>
                ) : (
                  <th scope="col" colSpan={Object.keys(OTH_COLS).length} style={sh("eco")}
                    className="px-2 py-1.5 text-center font-bold bg-gray-100 text-gray-600 border-r border-gray-300 whitespace-nowrap">
                    <div className="flex items-center justify-center gap-1.5">
                      OTHER DATA
                      <ToggleBtn collapsed={false} onClick={() => toggle("oth")} label="Other Data" colorClass="text-gray-500" />
                    </div>
                  </th>
                )}

                {/* TOT */}
                <th scope="col" style={TOT_H1} className="px-2 py-1.5 text-center bg-gray-700 text-white font-bold whitespace-nowrap">TOT</th>

                {/* ECCEZIONI */}
                {coll.ecc ? (
                  <th scope="col"
                    style={{ position: "sticky", top: 0, zIndex: 10, width: COLL_W + "px", minWidth: COLL_W + "px" }}
                    className="bg-rose-100 cursor-pointer hover:bg-rose-200 transition border-r border-rose-200"
                    onClick={() => toggle("ecc")} title="Espandi Eccezioni">
                    <div className="flex items-center justify-center"><ChevronsRight size={11} className="text-rose-500" aria-hidden="true" /></div>
                  </th>
                ) : (
                  <th scope="col" colSpan={ECC_SPAN} style={{ position: "sticky", top: 0, zIndex: 10 }}
                    className="px-2 py-1.5 text-center font-bold bg-rose-100 text-rose-800 border-r border-rose-200 whitespace-nowrap">
                    <div className="flex items-center justify-center gap-1.5">
                      ECCEZIONI
                      <ToggleBtn collapsed={false} onClick={() => toggle("ecc")} label="Eccezioni" colorClass="text-rose-500" />
                    </div>
                  </th>
                )}

                {/* INFO */}
                {coll.inf ? (
                  <th scope="col"
                    style={{ position: "sticky", top: 0, zIndex: 10, width: COLL_W + "px", minWidth: COLL_W + "px" }}
                    className="bg-purple-100 cursor-pointer hover:bg-purple-200 transition border-r border-purple-200"
                    onClick={() => toggle("inf")} title="Espandi Info">
                    <div className="flex items-center justify-center"><ChevronsRight size={11} className="text-purple-500" aria-hidden="true" /></div>
                  </th>
                ) : (
                  <th scope="col" colSpan={INFO_SPAN} style={{ position: "sticky", top: 0, zIndex: 10 }}
                    className="px-2 py-1.5 text-center font-bold bg-purple-100 text-purple-800 border-r border-purple-200 whitespace-nowrap">
                    <div className="flex items-center justify-center gap-1.5">
                      INFO
                      <ToggleBtn collapsed={false} onClick={() => toggle("inf")} label="Info" colorClass="text-purple-500" />
                    </div>
                  </th>
                )}

                {/* STOCK entity — colSpan = ADM(1) + 2 cols per store */}
                {["IT01", "IT02", "IT03"].flatMap(ent => {
                  if (!sc[ent].length) return []
                  if (coll[ent]) return [(
                    <th key={ent} scope="col"
                      style={{ position: "sticky", top: 0, zIndex: 10, width: COLL_W + "px", minWidth: COLL_W + "px" }}
                      className={`cursor-pointer hover:opacity-80 transition border-r border-gray-200 ${ENT[ent].th}`}
                      onClick={() => toggle(ent)} title={`Espandi Stock ${ent}`}>
                      <div className="flex items-center justify-center"><ChevronsRight size={11} aria-hidden="true" /></div>
                    </th>
                  )]
                  return [(
                    <th key={ent} scope="col" colSpan={1 + 2 * sc[ent].length}
                      style={{ position: "sticky", top: 0, zIndex: 10 }}
                      className={`px-2 py-1.5 text-center font-bold border-r border-gray-200 ${ENT[ent].th}`}>
                      <div className="flex items-center justify-center gap-1.5">
                        STOCK {ent} · {formatDate(stats?.[`stock_date_${ent.toLowerCase()}`])} · {sc[ent].length} negozi
                        <ToggleBtn collapsed={false} onClick={() => toggle(ent)} label={`Stock ${ent}`} colorClass={ENT[ent].text} />
                      </div>
                    </th>
                  )]
                })}
              </tr>

              {/* ── Riga 2: intestazioni colonne + codice negozio (colSpan=2) ── */}
              {/* Tutti gli header non-entity hanno rowSpan={2} per coprire anche riga 3 */}
              <tr className="border-b border-gray-100 text-gray-600 font-semibold">
                <th rowSpan={2} scope="col" style={sh2("no")}   className="px-2 py-1.5 text-left bg-gray-50 whitespace-nowrap border-r border-gray-100">No.</th>
                <th rowSpan={2} scope="col" style={sh2("desc")} className="px-2 py-1.5 text-left bg-gray-50 border-r border-sky-200">Descrizione</th>

                {/* ANAGRAFICA */}
                {coll.ana ? (
                  <th rowSpan={2} scope="col" style={sh2("ana_col")} className="bg-sky-100 border-r border-sky-300" />
                ) : (
                  <>
                    <th rowSpan={2} scope="col" style={sh2("category")} className="px-2 py-1.5 text-center bg-sky-50 text-sky-700 whitespace-nowrap">Categoria</th>
                    <th rowSpan={2} scope="col" style={sh2("item_cat")} className="px-2 py-1.5 text-center bg-sky-50 text-sky-700 whitespace-nowrap">Cat.Art</th>
                    <th rowSpan={2} scope="col" style={sh2("barcode")}  className="px-2 py-1.5 text-center bg-sky-50 text-sky-700 whitespace-nowrap">Barcode</th>
                    <th rowSpan={2} scope="col" style={sh2("upk")}      className="px-2 py-1.5 text-center bg-sky-50 text-sky-700 whitespace-nowrap">Pz/Conf</th>
                    <th rowSpan={2} scope="col" style={sh2("nw")}       className="px-2 py-1.5 text-center bg-sky-50 text-sky-700 whitespace-nowrap">Peso<br/>netto</th>
                    <th rowSpan={2} scope="col" style={sh2("vat")}      className="px-2 py-1.5 text-center bg-sky-50 text-sky-700 whitespace-nowrap">IVA%</th>
                    <th rowSpan={2} scope="col" style={sh2("gm")}       className="px-2 py-1.5 text-center bg-sky-50 text-sky-700 whitespace-nowrap">GM%</th>
                    <th rowSpan={2} scope="col" style={sh2("ms")}       className="px-2 py-1.5 text-center bg-sky-50 text-sky-700 whitespace-nowrap">Modello</th>
                    <th rowSpan={2} scope="col" style={{ ...sh2("frp"), borderRight: "1px solid #bae6fd" }} className="px-2 py-1.5 text-center bg-sky-50 text-sky-700 whitespace-nowrap">First RP</th>
                  </>
                )}

                {/* OTHER DATA */}
                {coll.oth ? (
                  <th rowSpan={2} scope="col" style={sh2("oth_col")} className="bg-gray-100 border-r border-gray-300" />
                ) : (
                  <>
                    <th rowSpan={2} scope="col" style={sh2("eco")}    className="px-1 py-1.5 text-center bg-green-50 text-green-700 whitespace-nowrap">ECO</th>
                    <th rowSpan={2} scope="col" style={sh2("expo")}   className="px-1 py-1.5 text-center bg-teal-50 text-teal-700 whitespace-nowrap">Expo</th>
                    <th rowSpan={2} scope="col" style={sh2("kgl")}    className="px-1 py-1.5 text-center bg-slate-50 text-slate-600 whitespace-nowrap">
                      <div>KGL</div><div className="text-[9px] font-normal text-slate-400">peso</div>
                    </th>
                    <th rowSpan={2} scope="col" style={sh2("kgl_um")} className="px-1 py-1.5 text-center bg-slate-50 text-slate-600 whitespace-nowrap">
                      <div>KGL</div><div className="text-[9px] font-normal text-slate-400">u.m.</div>
                    </th>
                    <th rowSpan={2} scope="col" style={sh2("prezzo")} className="px-2 py-1.5 text-center bg-gray-50 whitespace-nowrap">
                      <div>Prezzo</div><div className="text-[9px] text-gray-400 font-normal">€</div>
                    </th>
                    <th rowSpan={2} scope="col" style={sh2("promo")}  className="px-2 py-1.5 text-center bg-gray-50 text-orange-600 whitespace-nowrap">
                      <div>Promo</div><div className="text-[9px] text-orange-300 font-normal">€</div>
                    </th>
                    <th rowSpan={2} scope="col" style={sh2("bf")}     className="px-2 py-1.5 text-center bg-gray-50 text-indigo-600 whitespace-nowrap">
                      <div>BF</div><div className="text-[9px] text-indigo-300 font-normal">€</div>
                    </th>
                    <th rowSpan={2} scope="col" style={sh2("bs")} className="px-2 py-1.5 text-center bg-amber-50 text-amber-700 whitespace-nowrap">Best<br/>Seller</th>
                    <th rowSpan={2} scope="col" style={sh2("si")} className="px-2 py-1.5 text-center bg-red-50 text-red-700 whitespace-nowrap">Scrap<br/>INV</th>
                    <th rowSpan={2} scope="col" style={sh2("sw")} className="px-2 py-1.5 text-center bg-orange-50 text-orange-700 whitespace-nowrap">Scrap<br/>WD</th>
                    <th rowSpan={2} scope="col" style={{ ...sh2("pk"), borderRight: "1px solid #e5e7eb" }} className="px-2 py-1.5 text-center bg-blue-50 text-blue-700 whitespace-nowrap">Picking</th>
                  </>
                )}

                <th rowSpan={2} scope="col" style={TOT_H2} className="px-2 py-1.5 text-center bg-gray-100 font-bold whitespace-nowrap">Pezzi</th>

                {/* ECCEZIONI */}
                {coll.ecc ? (
                  <th rowSpan={2} scope="col" style={{ ...th2Scroll, width: COLL_W + "px", minWidth: COLL_W + "px" }}
                    className="bg-rose-50 border-r border-rose-200" />
                ) : (
                  <>
                    <th rowSpan={2} scope="col" style={th2Scroll} className="px-2 py-1.5 text-center bg-rose-50 text-rose-700 whitespace-nowrap">P.Ecc</th>
                    <th rowSpan={2} scope="col" style={th2Scroll} className="px-2 py-1.5 text-center bg-rose-50 text-rose-700 whitespace-nowrap">Sconto</th>
                    <th rowSpan={2} scope="col" style={th2Scroll} className="px-2 py-1.5 text-center bg-rose-50 text-rose-700 whitespace-nowrap">Testo</th>
                    <th rowSpan={2} scope="col" style={th2Scroll} className="px-2 py-1.5 text-center bg-rose-50 text-rose-700 border-r border-rose-200 whitespace-nowrap">Tipo</th>
                  </>
                )}

                {/* INFO */}
                {coll.inf ? (
                  <th rowSpan={2} scope="col" style={{ ...th2Scroll, width: COLL_W + "px", minWidth: COLL_W + "px" }}
                    className="bg-purple-50 border-r border-purple-200" />
                ) : (
                  <>
                    <th rowSpan={2} scope="col" style={th2Scroll} className="px-2 py-1.5 text-center bg-purple-50 text-purple-700 whitespace-nowrap">Desc. 1</th>
                    <th rowSpan={2} scope="col" style={th2Scroll} className="px-2 py-1.5 text-center bg-purple-50 text-purple-700 whitespace-nowrap">Desc. 2</th>
                    <th rowSpan={2} scope="col" style={th2Scroll} className="px-2 py-1.5 text-center bg-purple-50 text-purple-700 whitespace-nowrap">Modulo</th>
                    <th rowSpan={2} scope="col" style={th2Scroll} className="px-2 py-1.5 text-center bg-purple-50 text-purple-700 border-r border-purple-200 whitespace-nowrap">Costo</th>
                  </>
                )}

                {/* Entity: ADM rowSpan=2, poi codice negozio colSpan=2 */}
                {["IT01", "IT02", "IT03"].flatMap(ent => {
                  if (!sc[ent].length) return []
                  if (coll[ent]) return [
                    <th key={`r2-${ent}`} rowSpan={2} scope="col"
                      style={{ ...th2Scroll, width: COLL_W + "px", minWidth: COLL_W + "px" }}
                      className={ENT[ent].th} />
                  ]
                  return [
                    <th key={`adm-${ent}`} rowSpan={2} scope="col" ref={entRefs[ent]} style={th2Scroll}
                      className={`px-2 py-1.5 text-center whitespace-nowrap font-bold border-r border-gray-200 ${ENT[ent].th}`}>ADM</th>,
                    ...sc[ent].map(store => (
                      <th key={`${ent}-${store}`} scope="col" colSpan={2} style={th2Scroll}
                        className={`px-1 py-1.5 text-center font-mono font-semibold border-r border-gray-100 ${ENT[ent].light} ${ENT[ent].text}`}>
                        <div className="text-[10px] leading-tight">{storeCodeFmt(store)}</div>
                      </th>
                    )),
                  ]
                })}
              </tr>

              {/* ── Riga 3: sub-intestazioni STOCK / SALES per negozio ── */}
              <tr className="border-b border-gray-200 text-gray-500">
                {/* Nessuna cella per sticky+eccezioni+info: coperte da rowSpan=2 in riga 2 */}
                {["IT01", "IT02", "IT03"].flatMap(ent => {
                  if (!sc[ent].length || coll[ent]) return []
                  return sc[ent].flatMap(store => [
                    <th key={`stk-${ent}-${store}`} scope="col" style={th3Scroll}
                      className={`px-1 py-0.5 text-center text-[9px] font-bold ${ENT[ent].light} ${ENT[ent].text} whitespace-nowrap`}>
                      STOCK
                    </th>,
                    <th key={`sls-${ent}-${store}`} scope="col"
                      style={{ ...th3Scroll, backgroundColor: "rgb(248 250 252)" }}
                      className="px-1 py-0.5 text-center text-[9px] font-semibold border-r border-gray-100 whitespace-nowrap">
                      SALES
                    </th>,
                  ])
                })}
              </tr>
            </thead>

            <tbody>
              {isLoading && (
                <tr><td colSpan={totalCols} className="px-4 py-10 text-center text-gray-400">
                  <Loader2 size={18} className="animate-spin inline mr-2" aria-hidden="true" />Caricamento…
                </td></tr>
              )}
              {isError && !isLoading && (
                <tr><td colSpan={totalCols} className="px-4 py-8 text-center text-red-500">
                  <AlertCircle size={14} className="inline mr-1" aria-hidden="true" />Errore nel caricamento dei dati
                </td></tr>
              )}
              {!isLoading && !isError && items.length === 0 && (
                <tr><td colSpan={totalCols} className="px-4 py-8 text-center text-gray-400">Nessun articolo trovato</td></tr>
              )}

              {!isLoading && items.map((item, idx) => {
                const tot     = calcTot(item)
                const rowBase = idx % 2 === 0 ? "bg-white" : "bg-gray-50"
                const hov     = "group-hover:bg-blue-50"

                return (
                  <tr key={item.item_no} className={`group border-b border-gray-100 ${rowBase} cursor-default`}>

                    <td style={ss("no")}
                      className={`${rowBase} ${hov} px-2 py-1 font-mono text-gray-700 whitespace-nowrap border-r border-gray-100 overflow-hidden cursor-pointer`}
                      onMouseEnter={e => handleCellEnter(e, item)} onMouseLeave={handleCellLeave}>
                      {item.item_no}
                    </td>

                    <td style={{ ...ss("desc"), borderRight: "1px solid #bae6fd" }}
                      className={`${rowBase} ${hov} px-2 py-1 cursor-pointer`}
                      onMouseEnter={e => handleCellEnter(e, item)} onMouseLeave={handleCellLeave}>
                      <div className="text-gray-800 font-medium leading-tight truncate" title={item.description}>{item.description}</div>
                      {item.description_local && (
                        <div className="text-[9px] text-gray-400 leading-tight truncate mt-0.5" title={item.description_local}>{item.description_local}</div>
                      )}
                    </td>

                    {/* ANAGRAFICA */}
                    {coll.ana ? (
                      <td style={{ ...ss("ana_col"), borderRight: "1px solid #bae6fd" }} className="bg-sky-100" />
                    ) : (
                      <>
                        <td style={ss("category")} className={`bg-sky-50 ${hov} px-2 py-1 text-center text-sky-800 whitespace-nowrap`}>{item.category ?? <Dash />}</td>
                        <td style={ss("item_cat")} className={`bg-sky-50 ${hov} px-2 py-1 text-center text-sky-800 whitespace-nowrap`}>{item.item_cat ?? <Dash />}</td>
                        <td style={ss("barcode")}  className={`bg-sky-50 ${hov} px-2 py-1 text-center font-mono text-sky-800 whitespace-nowrap`}>{item.barcode ?? <Dash />}</td>
                        <td style={ss("upk")}      className={`bg-sky-50 ${hov} px-2 py-1 text-center tabular-nums text-sky-800 whitespace-nowrap`}>{item.units_per_pack ?? <Dash />}</td>
                        <td style={ss("nw")}       className={`bg-sky-50 ${hov} px-2 py-1 text-center tabular-nums text-sky-800 whitespace-nowrap`}>
                          {item.net_weight != null ? item.net_weight.toLocaleString("it-IT") : <Dash />}
                        </td>
                        <td style={ss("vat")}      className={`bg-sky-50 ${hov} px-2 py-1 text-center tabular-nums text-sky-800 whitespace-nowrap`}>
                          {item.vat_pct != null ? item.vat_pct.toLocaleString("it-IT") + "%" : <Dash />}
                        </td>
                        <td style={ss("gm")}       className={`bg-sky-50 ${hov} px-2 py-1 text-center tabular-nums text-sky-800 whitespace-nowrap`}>
                          {item.gm_pct != null ? item.gm_pct.toLocaleString("it-IT") + "%" : <Dash />}
                        </td>
                        <td style={ss("ms")}       className={`bg-sky-50 ${hov} px-2 py-1 text-center text-sky-800`}>
                          <div className="truncate w-[76px]" title={item.model_store ?? ""}>{item.model_store ?? <Dash />}</div>
                        </td>
                        <td style={{ ...ss("frp"), borderRight: "1px solid #bae6fd" }}
                          className={`bg-sky-50 ${hov} px-2 py-1 text-center tabular-nums text-sky-800 whitespace-nowrap`}>
                          {item.first_rp != null ? fPrice(item.first_rp) : <Dash />}
                        </td>
                      </>
                    )}

                    {/* OTHER DATA */}
                    {coll.oth ? (
                      <td style={{ ...ss("oth_col"), borderRight: "1px solid #e5e7eb" }} className="bg-gray-100" />
                    ) : (
                      <>
                        <td style={ss("eco")}    className={`bg-green-50 ${hov} px-1 py-1 text-center`}>{item.is_eco ? <Check /> : null}</td>
                        <td style={ss("expo")}   className={`bg-teal-50 ${hov} px-1 py-1 text-center`}>
                          {item.expo_type
                            ? <span className={`text-[10px] font-bold px-1 py-0.5 rounded ${
                                item.expo_type === "TABLE" ? "bg-teal-100 text-teal-700" :
                                item.expo_type === "WALL"  ? "bg-violet-100 text-violet-700" :
                                                              "bg-amber-100 text-amber-700"
                              }`}>{item.expo_type[0]}</span>
                            : null}
                        </td>
                        <td style={ss("kgl")}    className={`bg-slate-50 ${hov} px-1 py-1 text-center tabular-nums`}>
                          {item.peso_corretto != null
                            ? <span className="text-slate-600 text-[10px]">{item.peso_corretto.toLocaleString("it-IT")}</span>
                            : null}
                        </td>
                        <td style={ss("kgl_um")} className={`bg-slate-50 ${hov} px-1 py-1 text-center tabular-nums`}
                          title={item.kgl_l != null ? `KGL unità misura: ${item.kgl_l.toLocaleString("it-IT")}` : ""}>
                          {item.kgl_l != null
                            ? <span className="text-slate-600 text-[10px]">{item.kgl_l.toLocaleString("it-IT")}</span>
                            : null}
                        </td>
                        <td style={ss("prezzo")} className={`${rowBase} ${hov} px-2 py-1 text-center text-gray-700 whitespace-nowrap tabular-nums`}>{fPrice(item.unit_price)}</td>
                        <td style={ss("promo")}  className={`${rowBase} ${hov} px-2 py-1 text-center whitespace-nowrap tabular-nums`}>
                          {item.prezzo_promo != null ? <span className="text-orange-600 font-semibold">{fPrice(item.prezzo_promo)}</span> : <span className="text-gray-200">—</span>}
                        </td>
                        <td style={ss("bf")}     className={`${rowBase} ${hov} px-2 py-1 text-center whitespace-nowrap tabular-nums`}>
                          {item.prezzo_bf != null ? <span className="text-indigo-600 font-semibold">{fPrice(item.prezzo_bf)}</span> : <span className="text-gray-200">—</span>}
                        </td>
                        <td style={ss("bs")} className={`bg-amber-50  ${hov} px-2 py-1 text-center`}>{item.is_bestseller ? <Check /> : null}</td>
                        <td style={ss("si")} className={`bg-red-50    ${hov} px-2 py-1 text-center`}>{item.is_scrap_inv   ? <Check /> : null}</td>
                        <td style={ss("sw")} className={`bg-orange-50 ${hov} px-2 py-1 text-center`}>{item.is_scrap_wd   ? <Check /> : null}</td>
                        <td style={{ ...ss("pk"), borderRight: "1px solid #e5e7eb" }}
                          className={`bg-blue-50 ${hov} px-2 py-1 text-center`}>{item.is_picking ? <Check /> : null}</td>
                      </>
                    )}

                    {/* TOT */}
                    <td style={TOT_BORDER} className={`${rowBase} ${hov} px-2 py-1 text-center tabular-nums font-bold`}>
                      {tot > 0 ? <span className="text-gray-800">{tot.toLocaleString("it-IT")}</span> : <span className="text-gray-200">—</span>}
                    </td>

                    {/* ECCEZIONI */}
                    {coll.ecc ? (
                      <td className="bg-rose-50 border-r border-rose-100" style={{ width: COLL_W + "px", minWidth: COLL_W + "px" }} />
                    ) : (
                      <>
                        <td className={`${rowBase} ${hov} px-2 py-1 text-center tabular-nums whitespace-nowrap ${item.eccezione_prezzo_1 != null ? "text-rose-600 font-semibold" : ""}`}>
                          {item.eccezione_prezzo_1 != null ? fPrice(item.eccezione_prezzo_1) : <Dash />}
                        </td>
                        <td className={`${rowBase} ${hov} px-2 py-1 text-center text-rose-600 whitespace-nowrap`}>{item.eccezione_sconto ?? <Dash />}</td>
                        <td className={`${rowBase} ${hov} px-2 py-1 text-left`}>
                          <div className="truncate w-[116px] text-rose-700 text-[10px]" title={item.eccezione_testo ?? ""}>{item.eccezione_testo ?? <Dash />}</div>
                        </td>
                        <td className={`${rowBase} ${hov} px-2 py-1 text-center border-r border-rose-100`}>
                          {item.eccezione_tipo
                            ? <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-700">{item.eccezione_tipo}</span>
                            : <Dash />}
                        </td>
                      </>
                    )}

                    {/* INFO */}
                    {coll.inf ? (
                      <td className="bg-purple-50 border-r border-purple-100" style={{ width: COLL_W + "px", minWidth: COLL_W + "px" }} />
                    ) : (
                      <>
                        <td className={`${rowBase} ${hov} px-2 py-1 text-left`}>
                          <div className="truncate w-[136px] text-purple-700 text-[10px]" title={item.description1 ?? ""}>{item.description1 ?? <Dash />}</div>
                        </td>
                        <td className={`${rowBase} ${hov} px-2 py-1 text-left`}>
                          <div className="truncate w-[136px] text-purple-700 text-[10px]" title={item.description2 ?? ""}>{item.description2 ?? <Dash />}</div>
                        </td>
                        <td className={`${rowBase} ${hov} px-2 py-1 text-center text-purple-700 whitespace-nowrap`}>{item.modulo ?? <Dash />}</td>
                        <td className={`${rowBase} ${hov} px-2 py-1 text-center tabular-nums text-gray-600 whitespace-nowrap border-r border-purple-100`}>
                          {item.last_cost != null ? fPrice(item.last_cost) : <Dash />}
                        </td>
                      </>
                    )}

                    {/* STOCK entity: ADM + (STOCK + SALES) per negozio */}
                    {["IT01", "IT02", "IT03"].flatMap(ent => {
                      if (!sc[ent].length) return []
                      if (coll[ent]) return [
                        <td key={`coll-${ent}`} className={ENT[ent].th}
                          style={{ width: COLL_W + "px", minWidth: COLL_W + "px" }} />
                      ]
                      return [
                        <td key={`adm-${ent}`} className={`px-2 py-1 text-center tabular-nums font-bold border-r border-gray-200 ${ENT[ent].th}`}>
                          <StockCell value={item[`adm_${ent.toLowerCase()}`]} />
                        </td>,
                        ...sc[ent].flatMap(s => [
                          <td key={`stk-${ent}-${s}`} className={`px-2 py-1 text-center tabular-nums ${ENT[ent].light}`}>
                            <StockCell value={item[`stock_${ent.toLowerCase()}`]?.[s] ?? 0} />
                          </td>,
                            <td key={`sls-${ent}-${s}`} className={`px-2 py-1 text-center tabular-nums border-r border-gray-100 bg-gray-50`}>
                            <SalesCell value={item[`sales_${ent.toLowerCase()}`]?.[s] ?? 0} />
                          </td>,
                        ]),
                      ]
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {total > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50/50 text-xs text-gray-500">
            <span>
              {((page - 1) * PAGE_SIZE + 1).toLocaleString("it-IT")}–
              {Math.min(page * PAGE_SIZE, total).toLocaleString("it-IT")} di{" "}
              <b className="text-gray-700">{total.toLocaleString("it-IT")}</b> articoli
            </span>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                aria-label="Pagina precedente" className="p-1.5 rounded-lg hover:bg-gray-200 disabled:opacity-40 transition">
                <ChevronLeft size={14} aria-hidden="true" />
              </button>
              <span className="px-2 font-medium text-gray-700">{page} / {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                aria-label="Pagina successiva" className="p-1.5 rounded-lg hover:bg-gray-200 disabled:opacity-40 transition">
                <ChevronRight size={14} aria-hidden="true" />
              </button>
            </div>
          </div>
        )}
      </div>

      <p className="text-[10px] text-gray-400">
        TOT = somma pezzi tutti i negozi (escluso ADM warehouse) ·
        Scrap INV = blacklist inventario · Scrap WD = blacklist writedown ·
        SALES = venduto ultime 2 settimane (sincronizzato da SALES X WEEK MASTER.xlsx)
      </p>

      {tooltip && (
        <div className="fixed z-50 bg-white rounded-2xl shadow-2xl border border-gray-200 p-4 pointer-events-none"
          style={{ top: tooltip.y + "px", left: tooltip.x + "px", width: "280px" }}>
          <p className="font-mono text-[10px] text-gray-400 mb-0.5">{tooltip.item.item_no}</p>
          <p className="text-sm font-semibold text-gray-800 leading-tight mb-1 line-clamp-2">{tooltip.item.description}</p>
          {tooltip.item.description_local && (
            <p className="text-[11px] text-gray-400 mb-3 leading-tight">{tooltip.item.description_local}</p>
          )}
          {imgOk[tooltip.item.item_no] !== false ? (
            <img src={PHOTO_URL(tooltip.item.item_no)} alt={tooltip.item.description}
              className="w-full rounded-xl object-contain bg-gray-50" style={{ maxHeight: "220px" }}
              onLoad={() => setImgOk(p => ({ ...p, [tooltip.item.item_no]: true }))}
              onError={() => setImgOk(p => ({ ...p, [tooltip.item.item_no]: false }))}
            />
          ) : (
            <div className="flex items-center justify-center h-32 bg-gray-50 rounded-xl text-gray-300">
              <ImageOff size={32} aria-hidden="true" />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
