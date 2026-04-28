import { useRef, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  Search, Download, Loader2, AlertCircle, ChevronLeft, ChevronRight, ImageOff,
} from "lucide-react"
import { stockApi } from "@/api/stock"

const PAGE_SIZE = 50

const PHOTO_URL = (itemNo) =>
  `https://productimages.flyingtiger.com/itemimages/${itemNo}.jpg`

// ── Larghezze colonne fisse (px) ─────────────────────────────────────────────
const CW = { no: 90, desc: 222, eco: 42, expo: 52, kgl: 58,
              prezzo: 72, promo: 72, bf: 50,
              bs: 56, si: 54, sw: 54, pk: 52, tot: 64 }

// Posizioni left cumulative per sticky
const CL = (() => {
  let c = 0; const r = {}
  for (const [k, v] of Object.entries(CW)) { r[k] = c; c += v }
  return r
})()
// CL.tot = posizione del TOT → box-shadow lì crea il "muro"
const STICKY_WIDTH = Object.values(CW).reduce((a, b) => a + b, 0)

const stickyTd = (key, extra = "") =>
  `bg-white group-hover:bg-blue-100/60 ${extra}`
const stickyStyle = (key, zIdx = 5) =>
  ({ position: "sticky", left: CL[key] + "px", zIndex: zIdx, width: CW[key] + "px", minWidth: CW[key] + "px" })

// Altezza riga 1 intestazione (py-1.5 × 2 + testo ~11px = ~29px)
const ROW1_H = 29
const stickyHeadStyle    = (key) => ({ ...stickyStyle(key, 20), top: 0 })
const stickyHeadRow2Style = (key) => ({ ...stickyStyle(key, 20), top: ROW1_H + "px" })

// Bordo/shadow dopo l'ultima colonna fissa (TOT)
const TOT_BORDER = {
  ...stickyStyle("tot"),
  boxShadow: "4px 0 8px -2px rgba(0,0,0,0.12)",
  borderRight: "2px solid #94a3b8",
}
const TOT_HEAD_BORDER = { ...stickyHeadStyle("tot"), boxShadow: "4px 0 8px -2px rgba(0,0,0,0.12)", borderRight: "2px solid #94a3b8" }
const TOT_HEAD_BORDER_R2 = { ...stickyHeadRow2Style("tot"), boxShadow: "4px 0 8px -2px rgba(0,0,0,0.12)", borderRight: "2px solid #94a3b8" }

// ─────────────────────────────────────────────────────────────────────────────

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
  return d.slice(0, 1).padStart(2, "0") + d.slice(1).padStart(3, "0")
}

function Check() {
  return <span className="text-emerald-500 font-bold text-[13px]">✓</span>
}

function StockCell({ value }) {
  if (!value || value === 0) return <span className="text-gray-200">—</span>
  return <span className={value > 0 ? "text-gray-700" : "text-red-500 font-medium"}>{value}</span>
}

const ENT = {
  IT01: { bg: "bg-blue-600",    light: "bg-blue-50/70",    text: "text-blue-700",    th: "bg-blue-100 text-blue-800"    },
  IT02: { bg: "bg-emerald-600", light: "bg-emerald-50/70", text: "text-emerald-700", th: "bg-emerald-100 text-emerald-800" },
  IT03: { bg: "bg-violet-600",  light: "bg-violet-50/70",  text: "text-violet-700",  th: "bg-violet-100 text-violet-800"  },
}

export default function AlldataView() {
  const [search, setSearch]       = useState("")
  const [debouncedSearch, setDeb] = useState("")
  const [page, setPage]           = useState(1)
  const [downloading, setDl]      = useState(false)
  const [dlError, setDlError]     = useState(null)
  const [tooltip, setTooltip]     = useState(null)
  const [imgOk, setImgOk]         = useState({})
  const debTimer                  = useRef(null)
  const hideTimer                 = useRef(null)
  const scrollRef                 = useRef(null)
  const entRefs                   = { IT01: useRef(null), IT02: useRef(null), IT03: useRef(null) }

  function handleSearch(val) {
    setSearch(val)
    clearTimeout(debTimer.current)
    debTimer.current = setTimeout(() => { setDeb(val); setPage(1) }, 320)
  }

  function scrollToEntity(ent) {
    const container = scrollRef.current
    const target    = entRefs[ent].current
    if (!container || !target) return
    const cr = container.getBoundingClientRect()
    const tr = target.getBoundingClientRect()
    container.scrollBy({ left: tr.left - cr.left - STICKY_WIDTH - 8, behavior: "smooth" })
  }

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
    const CARD_W = 280
    const CARD_H = 300
    let x = rect.right + 8
    let y = rect.top - 8
    if (x + CARD_W > window.innerWidth - 8) x = rect.left - CARD_W - 8
    if (y + CARD_H > window.innerHeight - 8) y = window.innerHeight - CARD_H - 8
    if (y < 8) y = 8
    setTooltip({ item, x, y })
  }
  function handleCellLeave() {
    hideTimer.current = setTimeout(() => setTooltip(null), 80)
  }

  const totalCols = Object.keys(CW).length  // include eco, expo, kgl
    + (sc.IT01.length > 0 ? 1 + sc.IT01.length : 0)
    + (sc.IT02.length > 0 ? 1 + sc.IT02.length : 0)
    + (sc.IT03.length > 0 ? 1 + sc.IT03.length : 0)


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
                aria-label={`Vai alle colonne ${ent}`}>
                {ent} · {formatDate(stats[`stock_date_${ent.toLowerCase()}`])} · {sc[ent].length} negozi
              </button>
            ))}
          </div>
        </div>
      )}

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
        <div className="overflow-auto max-h-[calc(100vh-280px)]" ref={scrollRef}>
          <table className="text-[11px] border-collapse" style={{ tableLayout: "fixed" }}>

            {/* Definisce larghezze esplicite — indispensabile per sticky multi-colonna */}
            <colgroup>
              <col style={{ width: CW.no    + "px" }} />
              <col style={{ width: CW.desc  + "px" }} />
              <col style={{ width: CW.eco   + "px" }} />
              <col style={{ width: CW.expo  + "px" }} />
              <col style={{ width: CW.kgl   + "px" }} />
              <col style={{ width: CW.prezzo + "px" }} />
              <col style={{ width: CW.promo  + "px" }} />
              <col style={{ width: CW.bf     + "px" }} />
              <col style={{ width: CW.bs     + "px" }} />
              <col style={{ width: CW.si     + "px" }} />
              <col style={{ width: CW.sw     + "px" }} />
              <col style={{ width: CW.pk     + "px" }} />
              <col style={{ width: CW.tot    + "px" }} />
              {sc.IT01.length > 0 && <col style={{ width: "68px" }} />}
              {sc.IT01.map(s => <col key={`cg-it01-${s}`} style={{ width: "52px" }} />)}
              {sc.IT02.length > 0 && <col style={{ width: "68px" }} />}
              {sc.IT02.map(s => <col key={`cg-it02-${s}`} style={{ width: "52px" }} />)}
              {sc.IT03.length > 0 && <col style={{ width: "68px" }} />}
              {sc.IT03.map(s => <col key={`cg-it03-${s}`} style={{ width: "52px" }} />)}
            </colgroup>

            <thead>
              {/* Riga 1: gruppi */}
              <tr className="border-b border-gray-300">
                <th scope="col" colSpan={12}
                  style={stickyHeadStyle("no")}
                  className="px-2 py-1.5 text-left bg-gray-100 text-gray-600 font-semibold whitespace-nowrap"
                  /* colSpan qui è solo visivo, lo sticky funziona per singola cella */
                />
                {/* Intestazione vuota per ciascuna colonna fissa — lo stile sticky le posiziona */}
                <th scope="col" style={TOT_HEAD_BORDER}
                  className="px-2 py-1.5 text-center bg-gray-700 text-white font-bold whitespace-nowrap">
                  TOT
                </th>
                {["IT01", "IT02", "IT03"].map(ent =>
                  sc[ent].length > 0 && (
                    <th key={ent} scope="col" colSpan={1 + sc[ent].length}
                      style={{ position: "sticky", top: 0, zIndex: 10 }}
                      className={`px-2 py-1.5 text-center font-bold border-r border-gray-200 ${ENT[ent].th}`}>
                      {ent} · ADM + {sc[ent].length} negozi
                    </th>
                  )
                )}
              </tr>

              {/* Riga 2: nomi colonne */}
              <tr className="border-b border-gray-200 text-gray-600 font-semibold">
                <th scope="col" style={stickyHeadRow2Style("no")}    className="px-2 py-1.5 text-left bg-gray-50 whitespace-nowrap border-r border-gray-100">No.</th>
                <th scope="col" style={stickyHeadRow2Style("desc")}  className="px-2 py-1.5 text-left bg-gray-50">Descrizione</th>
                <th scope="col" style={stickyHeadRow2Style("eco")}   className="px-1 py-1.5 text-center bg-green-50 text-green-700 whitespace-nowrap">ECO</th>
                <th scope="col" style={stickyHeadRow2Style("expo")}  className="px-1 py-1.5 text-center bg-teal-50 text-teal-700 whitespace-nowrap">Expo</th>
                <th scope="col" style={stickyHeadRow2Style("kgl")}   className="px-1 py-1.5 text-center bg-slate-50 text-slate-600 whitespace-nowrap">
                  <div>KGL</div><div className="text-[9px] font-normal text-slate-400">peso</div>
                </th>
                <th scope="col" style={stickyHeadRow2Style("prezzo")} className="px-2 py-1.5 text-center bg-gray-50 whitespace-nowrap">
                  <div>Prezzo</div><div className="text-[9px] text-gray-400 font-normal">€</div>
                </th>
                <th scope="col" style={stickyHeadRow2Style("promo")}  className="px-2 py-1.5 text-center bg-gray-50 whitespace-nowrap text-orange-600">
                  <div>Promo</div><div className="text-[9px] text-orange-300 font-normal">€</div>
                </th>
                <th scope="col" style={stickyHeadRow2Style("bf")}     className="px-2 py-1.5 text-center bg-gray-50 whitespace-nowrap text-indigo-600">
                  <div>BF</div><div className="text-[9px] text-indigo-300 font-normal">€</div>
                </th>
                <th scope="col" style={stickyHeadRow2Style("bs")} className="px-2 py-1.5 text-center bg-amber-50 text-amber-700 whitespace-nowrap">Best<br/>Seller</th>
                <th scope="col" style={stickyHeadRow2Style("si")} className="px-2 py-1.5 text-center bg-red-50 text-red-700 whitespace-nowrap">Scrap<br/>INV</th>
                <th scope="col" style={stickyHeadRow2Style("sw")} className="px-2 py-1.5 text-center bg-orange-50 text-orange-700 whitespace-nowrap">Scrap<br/>WD</th>
                <th scope="col" style={stickyHeadRow2Style("pk")} className="px-2 py-1.5 text-center bg-blue-50 text-blue-700 whitespace-nowrap">Picking</th>
                <th scope="col" style={TOT_HEAD_BORDER_R2}         className="px-2 py-1.5 text-center bg-gray-100 font-bold whitespace-nowrap">Pezzi</th>
                {["IT01", "IT02", "IT03"].map(ent =>
                  sc[ent].length > 0 && [
                    <th key={`adm-${ent}`} scope="col" ref={entRefs[ent]}
                      style={{ position: "sticky", top: ROW1_H + "px", zIndex: 10 }}
                      className={`px-2 py-1.5 text-center whitespace-nowrap font-bold ${ENT[ent].th}`}>ADM</th>,
                    ...sc[ent].map(store => (
                      <th key={`${ent}-${store}`} scope="col"
                        style={{ position: "sticky", top: ROW1_H + "px", zIndex: 10 }}
                        className={`px-1 py-1.5 text-center font-mono font-semibold ${ENT[ent].light} ${ENT[ent].text}`}>
                        <div className="text-[10px] leading-tight">{storeCodeFmt(store)}</div>
                      </th>
                    )),
                  ]
                )}
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
                const rowHov  = "group-hover:bg-blue-50"
                const sdBase  = `${rowBase} ${rowHov}`

                return (
                  <tr key={item.item_no}
                    className={`group border-b border-gray-100 ${rowBase} cursor-default`}>

                    {/* ── Colonne sticky ────────────────────────────────── */}
                    <td style={stickyStyle("no")}   className={`${sdBase} px-2 py-1 font-mono text-gray-700 whitespace-nowrap border-r border-gray-100 overflow-hidden cursor-pointer`}
                      onMouseEnter={e => handleCellEnter(e, item)} onMouseLeave={handleCellLeave}>{item.item_no}</td>
                    <td style={stickyStyle("desc")} className={`${sdBase} px-2 py-1 cursor-pointer`}
                      onMouseEnter={e => handleCellEnter(e, item)} onMouseLeave={handleCellLeave}>
                      <div className="text-gray-800 font-medium leading-tight truncate" title={item.description}>{item.description}</div>
                      {item.description_local && (
                        <div className="text-[9px] text-gray-400 leading-tight truncate mt-0.5" title={item.description_local}>{item.description_local}</div>
                      )}
                    </td>

                    {/* ── ECO / Expo / KGL (dopo descrizione) ──────────── */}
                    <td style={stickyStyle("eco")}  className={`${sdBase} px-1 py-1 text-center bg-green-50/50 group-hover:bg-blue-50`}>
                      {item.is_eco ? <Check /> : null}
                    </td>
                    <td style={stickyStyle("expo")} className={`${sdBase} px-1 py-1 text-center bg-teal-50/50 group-hover:bg-blue-50`}>
                      {item.expo_type
                        ? <span className={`text-[10px] font-bold px-1 py-0.5 rounded ${
                            item.expo_type === "TABLE"  ? "bg-teal-100 text-teal-700" :
                            item.expo_type === "WALL"   ? "bg-violet-100 text-violet-700" :
                                                          "bg-amber-100 text-amber-700"
                          }`}>{item.expo_type[0]}</span>
                        : null}
                    </td>
                    <td style={stickyStyle("kgl")}  className={`${sdBase} px-1 py-1 text-center tabular-nums bg-slate-50/50 group-hover:bg-blue-50`}>
                      {item.peso_corretto != null
                        ? <span className="text-slate-600 text-[10px]">{item.peso_corretto.toLocaleString("it-IT")}</span>
                        : null}
                    </td>

                    <td style={stickyStyle("prezzo")} className={`${sdBase} px-2 py-1 text-center text-gray-700 whitespace-nowrap tabular-nums`}>{fPrice(item.unit_price)}</td>
                    <td style={stickyStyle("promo")}  className={`${sdBase} px-2 py-1 text-center whitespace-nowrap tabular-nums`}>
                      {item.prezzo_promo != null ? <span className="text-orange-600 font-semibold">{fPrice(item.prezzo_promo)}</span> : <span className="text-gray-200">—</span>}
                    </td>
                    <td style={stickyStyle("bf")}     className={`${sdBase} px-2 py-1 text-center whitespace-nowrap tabular-nums`}>
                      {item.prezzo_bf != null ? <span className="text-indigo-600 font-semibold">{fPrice(item.prezzo_bf)}</span> : <span className="text-gray-200">—</span>}
                    </td>
                    <td style={stickyStyle("bs")} className={`${sdBase} px-2 py-1 text-center bg-amber-50 group-hover:bg-blue-50`}>{item.is_bestseller ? <Check /> : null}</td>
                    <td style={stickyStyle("si")} className={`${sdBase} px-2 py-1 text-center bg-red-50    group-hover:bg-blue-50`}>{item.is_scrap_inv   ? <Check /> : null}</td>
                    <td style={stickyStyle("sw")} className={`${sdBase} px-2 py-1 text-center bg-orange-50 group-hover:bg-blue-50`}>{item.is_scrap_wd   ? <Check /> : null}</td>
                    <td style={stickyStyle("pk")} className={`${sdBase} px-2 py-1 text-center bg-blue-50   group-hover:bg-blue-50`}>{item.is_picking     ? <Check /> : null}</td>
                    <td style={TOT_BORDER}
                      className={`${sdBase} px-2 py-1 text-center tabular-nums font-bold`}>
                      {tot > 0 ? <span className="text-gray-800">{tot.toLocaleString("it-IT")}</span> : <span className="text-gray-200">—</span>}
                    </td>

                    {/* ── Colonne scrollabili entity ─────────────────────── */}
                    {sc.IT01.length > 0 && (
                      <>
                        <td className={`px-2 py-1 text-center tabular-nums font-bold ${ENT.IT01.th}`}><StockCell value={item.adm_it01} /></td>
                        {sc.IT01.map(s => <td key={`it01-${s}`} className={`px-2 py-1 text-center tabular-nums ${ENT.IT01.light}`}><StockCell value={item.stock_it01?.[s] ?? 0} /></td>)}
                      </>
                    )}
                    {sc.IT02.length > 0 && (
                      <>
                        <td className={`px-2 py-1 text-center tabular-nums font-bold ${ENT.IT02.th}`}><StockCell value={item.adm_it02} /></td>
                        {sc.IT02.map(s => <td key={`it02-${s}`} className={`px-2 py-1 text-center tabular-nums ${ENT.IT02.light}`}><StockCell value={item.stock_it02?.[s] ?? 0} /></td>)}
                      </>
                    )}
                    {sc.IT03.length > 0 && (
                      <>
                        <td className={`px-2 py-1 text-center tabular-nums font-bold ${ENT.IT03.th}`}><StockCell value={item.adm_it03} /></td>
                        {sc.IT03.map(s => <td key={`it03-${s}`} className={`px-2 py-1 text-center tabular-nums ${ENT.IT03.light}`}><StockCell value={item.stock_it03?.[s] ?? 0} /></td>)}
                      </>
                    )}
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
        Scrap INV = blacklist inventario · Scrap WD = blacklist writedown
      </p>

      {/* Card foto contestuale (vicino alla cella) */}
      {tooltip && (
        <div className="fixed z-50 bg-white rounded-2xl shadow-2xl border border-gray-200 p-4 pointer-events-none"
          style={{ top: tooltip.y + "px", left: tooltip.x + "px", width: "280px" }}>
          <p className="font-mono text-[10px] text-gray-400 mb-0.5">{tooltip.item.item_no}</p>
          <p className="text-sm font-semibold text-gray-800 leading-tight mb-1 line-clamp-2">{tooltip.item.description}</p>
          {tooltip.item.description_local && (
            <p className="text-[11px] text-gray-400 mb-3 leading-tight">{tooltip.item.description_local}</p>
          )}
          {imgOk[tooltip.item.item_no] !== false ? (
            <img
              src={PHOTO_URL(tooltip.item.item_no)}
              alt={tooltip.item.description}
              className="w-full rounded-xl object-contain bg-gray-50"
              style={{ maxHeight: "220px" }}
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
