import { useState, useRef, Component } from "react"
import { useNavigate } from "react-router-dom"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  LogOut, Upload, Search, RefreshCw, Tag, ShoppingBag, Layers,
  Megaphone, Percent, Database, DollarSign, Globe2, Package,
  Monitor, BarChart2, CheckCircle, XCircle, Play, AlertCircle,
  Loader2, ClipboardPaste, X, CloudDownload,
} from "lucide-react"
import { converterRefApi } from "@/api/items/converterRef"
import { loadItem } from "@/lib/checkPrezziStore"

// ── Error boundary ────────────────────────────────────────────────────────────

class ConverterErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null } }
  static getDerivedStateFromError(error) { return { error } }
  render() {
    if (this.state.error) {
      return (
        <div className="p-6 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm font-mono">
          <div className="font-bold mb-2">Errore nel Converter:</div>
          <div>{this.state.error?.message}</div>
          <div className="mt-2 text-xs text-red-500 whitespace-pre-wrap">{this.state.error?.stack?.split("\n").slice(0,5).join("\n")}</div>
        </div>
      )
    }
    return this.props.children
  }
}

// ── Tabella dati generica ─────────────────────────────────────────────────────

function DataTable({ columns, rows, loading }) {
  if (loading) return <div className="py-10 text-center text-gray-400 text-sm">Caricamento…</div>
  if (!rows?.length) return <div className="py-10 text-center text-gray-400 text-sm">Nessun dato.</div>

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            {columns.map((c) => (
              <th key={c.key} scope="col" className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 whitespace-nowrap">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="odd:bg-white even:bg-gray-50/50 border-b border-gray-100 last:border-0">
              {columns.map((c) => (
                <td key={c.key} className="px-4 py-2 text-gray-700 whitespace-nowrap font-mono text-xs">
                  {row[c.key] ?? "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Banner statistiche ────────────────────────────────────────────────────────

function StatsBanner({ table }) {
  const { data } = useQuery({
    queryKey: ["converter-stats", table],
    queryFn: () => converterRefApi.getStats(table).then((r) => r.data),
  })

  const lastSync = data?.last_sync
    ? new Date(data.last_sync).toLocaleString("it-IT")
    : "Mai sincronizzato"

  return (
    <div className="bg-blue-500 rounded-xl px-4 py-2.5 flex items-center gap-6 text-white text-sm">
      <span className="font-bold text-base">{data?.count?.toLocaleString("it-IT") ?? "…"} righe</span>
      <span className="text-blue-100 text-xs">Ultimo import: {lastSync}</span>
    </div>
  )
}

// ── Tab con ricerca e tabella ─────────────────────────────────────────────────

function RefTab({ table, columns, searchPlaceholder, extraButton }) {
  const [search, setSearch] = useState("")
  const [query, setQuery] = useState("")
  const fileRef = useRef(null)
  const qc = useQueryClient()

  const { data: rows, isLoading } = useQuery({
    queryKey: ["converter-items", table, query],
    queryFn: () => converterRefApi.getItems(table, { limit: 300, search: query }).then((r) => r.data),
  })

  const importMut = useMutation({
    mutationFn: (file) => converterRefApi.importFromExcel(table, file).then((r) => r.data),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["converter-stats", table] })
      qc.invalidateQueries({ queryKey: ["converter-items", table] })
      qc.invalidateQueries({ queryKey: ["converter-status"] })
      alert(`Import completato: ${data.synced.toLocaleString("it-IT")} righe caricate.`)
    },
    onError: (e) => alert(`Errore import: ${e.response?.data?.detail ?? e.message}`),
  })

  const handleFile = (e) => {
    const f = e.target.files?.[0]
    if (f) importMut.mutate(f)
    e.target.value = ""
  }

  return (
    <div className="space-y-4">
      <StatsBanner table={table} />

      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
          <label htmlFor={`search-${table}`} className="sr-only">Cerca in {table}</label>
          <input
            id={`search-${table}`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && setQuery(search)}
            placeholder={searchPlaceholder}
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2563eb] focus:border-transparent outline-none"
          />
        </div>
        <button
          onClick={() => setQuery(search)}
          className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition text-gray-500 focus-visible:ring-2 focus-visible:ring-[#2563eb]"
          aria-label="Cerca"
        >
          <RefreshCw size={15} aria-hidden="true" />
        </button>

        {extraButton}

        <input ref={fileRef} type="file" accept=".xlsx,.xlsm" onChange={handleFile} className="hidden" aria-label="Seleziona file Excel" />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={importMut.isPending}
          className="flex items-center gap-2 bg-[#1e3a5f] hover:bg-[#2563eb] text-white text-sm font-semibold px-4 py-2 rounded-xl shadow transition disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-[#2563eb]"
        >
          <Upload size={15} aria-hidden="true" />
          {importMut.isPending ? "Import…" : "Importa Excel"}
        </button>
      </div>

      <p className="text-xs text-gray-400">Carica il file Converter Excel — viene letto il foglio corrispondente e sostituisce tutti i dati esistenti.</p>

      <DataTable columns={columns} rows={rows} loading={isLoading} />
    </div>
  )
}

// ── Tab solo importazione (nessuna lista) ─────────────────────────────────────

function ImportOnlyTab({ table, sheetHint }) {
  const fileRef = useRef(null)
  const qc = useQueryClient()

  const importMut = useMutation({
    mutationFn: (file) => converterRefApi.importFromExcel(table, file).then((r) => r.data),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["converter-stats", table] })
      qc.invalidateQueries({ queryKey: ["converter-status"] })
      alert(`Import completato: ${data.synced.toLocaleString("it-IT")} righe caricate.`)
    },
    onError: (e) => alert(`Errore import: ${e.response?.data?.detail ?? e.message}`),
  })

  const handleFile = (e) => {
    const f = e.target.files?.[0]
    if (f) importMut.mutate(f)
    e.target.value = ""
  }

  return (
    <div className="space-y-4">
      <StatsBanner table={table} />

      <div className="flex items-center gap-3">
        <input ref={fileRef} type="file" accept=".xlsx,.xlsm" onChange={handleFile} className="hidden" aria-label="Seleziona file Excel" />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={importMut.isPending}
          className="flex items-center gap-2 bg-[#1e3a5f] hover:bg-[#2563eb] text-white text-sm font-semibold px-4 py-2 rounded-xl shadow transition disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-[#2563eb]"
        >
          <Upload size={15} aria-hidden="true" />
          {importMut.isPending ? "Import…" : "Importa Excel"}
        </button>
      </div>

      <p className="text-xs text-gray-400">
        Foglio atteso: <span className="font-mono font-medium text-gray-600">{sheetHint}</span> — carica il file Converter Excel. I dati esistenti vengono sostituiti completamente.
      </p>
    </div>
  )
}

// ── Tab IVA (sola lettura, dati statici) ──────────────────────────────────────

function IvaTab() {
  const { data: rows, isLoading } = useQuery({
    queryKey: ["converter-iva"],
    queryFn: () => converterRefApi.getIva().then((r) => r.data),
  })

  const columns = [
    { key: "vat_code", label: "Codice IVA (Navision)" },
    { key: "vat_pct",  label: "Aliquota %" },
  ]

  return (
    <div className="space-y-4">
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700">
        Tabella di lookup IVA — associa i codici Navision alle aliquote percentuali. Valori di sistema, non modificabili da UI.
      </div>
      <DataTable columns={columns} rows={rows} loading={isLoading} />
    </div>
  )
}

// ── Pannello stato + pulsante Assembla ────────────────────────────────────────

function StatusPanel() {
  const qc = useQueryClient()
  const [syncState, setSyncState] = useState({ loading: false, result: null })

  const { data: statuses, isLoading, refetch } = useQuery({
    queryKey: ["converter-status"],
    queryFn: () => converterRefApi.getStatus().then((r) => r.data),
  })

  const assembleMut = useMutation({
    mutationFn: () => converterRefApi.assemble().then((r) => r.data),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["converter-status"] })
      alert(
        `Anagrafica IT01 assemblata!\n\n` +
        `Articoli: ${data.row_count.toLocaleString("it-IT")}\n` +
        `Durata: ${data.duration_ms.toLocaleString("it-IT")} ms\n` +
        `Batch: ${data.batch_id}`
      )
    },
    onError: (e) => alert(`Errore assemblaggio: ${e.response?.data?.detail ?? e.message}`),
  })

  async function handleBridgeSync(noExcel) {
    setSyncState({ loading: true, result: null })
    try {
      const data = await converterRefApi.bridgeSync(noExcel)
      qc.invalidateQueries({ queryKey: ["converter-status"] })
      qc.invalidateQueries({ queryKey: ["converter-stats"] })
      qc.invalidateQueries({ queryKey: ["converter-items"] })
      setSyncState({ loading: false, result: { ok: true, data } })
    } catch (e) {
      const msg = e?.detail || e?.message || "Agente NAV non raggiungibile"
      setSyncState({ loading: false, result: { ok: false, msg } })
    }
  }

  const anyOk  = statuses?.some((s) => s.ok)
  const allOk  = statuses?.every((s) => s.ok)

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-3">
      <div className="flex items-start gap-6">
        {/* Griglia stato tabelle */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-sm font-semibold text-gray-700">Stato Tabelle Converter</h2>
            <button
              onClick={() => refetch()}
              className="p-1 text-gray-400 hover:text-gray-600 transition rounded focus-visible:ring-2 focus-visible:ring-[#2563eb]"
              aria-label="Aggiorna stato tabelle"
            >
              <RefreshCw size={12} aria-hidden="true" />
            </button>
          </div>

          {isLoading ? (
            <p className="text-xs text-gray-400">Caricamento…</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-x-6 gap-y-2">
              {statuses?.map((s) => (
                <div key={s.key} className="flex items-center gap-1.5 min-w-0">
                  {s.ok ? (
                    <CheckCircle size={12} className="text-green-500 shrink-0" aria-hidden="true" />
                  ) : (
                    <XCircle size={12} className="text-red-400 shrink-0" aria-hidden="true" />
                  )}
                  <span className="text-xs text-gray-600 truncate flex-1">{s.label}</span>
                  <span className="text-xs font-mono text-gray-400 shrink-0 ml-1">
                    {(s.count ?? 0).toLocaleString("it-IT")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pulsanti azione */}
        <div className="shrink-0 flex flex-col items-end gap-2">
          {/* Sincronizza Bridge */}
          <div className="flex gap-2">
            <button
              onClick={() => handleBridgeSync(false)}
              disabled={syncState.loading}
              title="Apre Excel, refresha Power BI, poi sincronizza tutti i fogli"
              className="flex items-center gap-2 border border-[#1e3a5f] text-[#1e3a5f] hover:bg-[#1e3a5f] hover:text-white text-sm font-semibold px-4 py-2 rounded-xl transition disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-[#2563eb]"
            >
              {syncState.loading
                ? <Loader2 size={15} className="animate-spin" aria-hidden="true" />
                : <CloudDownload size={15} aria-hidden="true" />
              }
              {syncState.loading ? "Sync in corso…" : "Sincronizza Bridge"}
            </button>
            <button
              onClick={() => handleBridgeSync(true)}
              disabled={syncState.loading}
              title="Sincronizza senza refreshare Excel (file già aggiornato)"
              className="flex items-center gap-1.5 border border-gray-300 text-gray-500 hover:bg-gray-50 text-xs font-medium px-3 py-2 rounded-xl transition disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-[#2563eb]"
            >
              <RefreshCw size={13} aria-hidden="true" />
              Solo dati
            </button>
          </div>

          {/* Assembla */}
          <button
            onClick={() => assembleMut.mutate()}
            disabled={assembleMut.isPending || !anyOk}
            className="flex items-center gap-2 bg-[#1e3a5f] hover:bg-[#2563eb] text-white text-sm font-semibold px-5 py-2 rounded-xl shadow transition disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-[#2563eb]"
          >
            <Play size={15} aria-hidden="true" />
            {assembleMut.isPending ? "Assemblaggio…" : "Assembla Anagrafica"}
          </button>

          {!isLoading && !anyOk && (
            <p className="text-xs text-amber-600 flex items-center gap-1">
              <AlertCircle size={11} aria-hidden="true" />
              Importa prima i dati Raw NAV
            </p>
          )}
          {!isLoading && allOk && (
            <p className="text-xs text-green-600 flex items-center gap-1">
              <CheckCircle size={11} aria-hidden="true" />
              Tutte le tabelle caricate
            </p>
          )}
        </div>
      </div>

      {/* Risultato Bridge Sync */}
      {syncState.result && (
        <div
          className={`flex items-start gap-2 rounded-lg px-3 py-2 text-xs border ${
            syncState.result.ok ? "bg-green-50 border-green-200 text-green-700" : "bg-red-50 border-red-200 text-red-700"
          }`}
          role="alert"
        >
          {syncState.result.ok ? (
            <>
              <CheckCircle size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
              <span>
                {Object.entries(syncState.result.data.results || {})
                  .map(([k, n]) => `${k}: ${n.toLocaleString("it-IT")} righe`)
                  .join(" · ")}
                {syncState.result.data.errors?.length > 0 && (
                  <span className="ml-2 text-amber-600">
                    · Avvisi: {syncState.result.data.errors.join("; ")}
                  </span>
                )}
              </span>
            </>
          ) : (
            <>
              <AlertCircle size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
              <span>{syncState.result.msg}</span>
            </>
          )}
          <button onClick={() => setSyncState({ loading: false, result: null })} className="ml-auto shrink-0 opacity-60 hover:opacity-100" aria-label="Chiudi">
            <X size={12} aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  )
}

// ── Tab Appoggio NAV con import da Check Prices ───────────────────────────────

function RawNavTab() {
  const [loading, setLoading] = useState(false)
  const [result, setResult]   = useState(null)
  const qc = useQueryClient()

  async function handleImportFromStore() {
    setLoading(true)
    setResult(null)
    try {
      const entry = await loadItem("IT01")
      if (!entry?.text?.trim()) {
        setResult({ ok: false, msg: "Nessun dato trovato in Check Prices IT01. Incolla prima l'Anagrafe ITEM IT01 in Check Prices." })
        return
      }
      const res = await converterRefApi.importFromTsv(entry.text)
      qc.invalidateQueries({ queryKey: ["converter-stats", "raw-nav"] })
      qc.invalidateQueries({ queryKey: ["converter-items", "raw-nav"] })
      qc.invalidateQueries({ queryKey: ["converter-status"] })
      setResult({ ok: true, msg: `${res.data.synced.toLocaleString("it-IT")} righe importate da Check Prices IT01` })
    } catch (err) {
      const msg = err?.response?.data?.detail || err?.message || "Errore sconosciuto"
      setResult({ ok: false, msg })
    } finally {
      setLoading(false)
    }
  }

  const fromStoreBtn = (
    <button
      onClick={handleImportFromStore}
      disabled={loading}
      className="flex items-center gap-2 border border-[#1e3a5f] text-[#1e3a5f] hover:bg-[#1e3a5f] hover:text-white text-sm font-semibold px-4 py-2 rounded-xl transition disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-[#2563eb]"
      aria-label="Importa Anagrafe IT01 da Check Prices"
    >
      {loading
        ? <Loader2 size={15} className="animate-spin" aria-hidden="true" />
        : <ClipboardPaste size={15} aria-hidden="true" />
      }
      {loading ? "Importazione…" : "Da Check Prices IT01"}
    </button>
  )

  return (
    <div className="space-y-3">
      {result && (
        <div
          className={`flex items-start gap-2 rounded-lg px-3 py-2 text-xs border ${
            result.ok ? "bg-green-50 border-green-200 text-green-700" : "bg-red-50 border-red-200 text-red-700"
          }`}
          role="alert"
        >
          {result.ok
            ? <CheckCircle size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
            : <AlertCircle size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
          }
          <span>{result.msg}</span>
          <button onClick={() => setResult(null)} className="ml-auto shrink-0 opacity-60 hover:opacity-100" aria-label="Chiudi">
            <X size={12} aria-hidden="true" />
          </button>
        </div>
      )}
      <RefTab
        table="raw-nav"
        searchPlaceholder="Cerca per codice o descrizione…"
        columns={[
          { key: "item_no",        label: "Nr. Articolo" },
          { key: "description",    label: "Descrizione" },
          { key: "warehouse",      label: "Magazzino" },
          { key: "unit_price",     label: "Prezzo" },
          { key: "vat_code",       label: "Cod. IVA" },
          { key: "units_per_pack", label: "UPP" },
        ]}
        extraButton={fromStoreBtn}
      />
    </div>
  )
}

// ── Configurazione tab ────────────────────────────────────────────────────────

const TABS = [
  // Dati da Navision / Staging
  {
    id: "raw-nav",
    label: "Appoggio NAV",
    icon: Database,
    content: <RawNavTab />,
  },
  {
    id: "price",
    label: "Prezzi",
    icon: DollarSign,
    content: (
      <RefTab
        table="price"
        searchPlaceholder="Cerca per codice articolo…"
        columns={[
          { key: "item_no",    label: "Nr. Articolo" },
          { key: "country_rp", label: "Country RP (€)" },
        ]}
      />
    ),
  },
  {
    id: "translations",
    label: "Traduzioni",
    icon: Globe2,
    content: <ImportOnlyTab table="translations" sheetHint="TRADUZIONI" />,
  },
  {
    id: "box-size",
    label: "Box Size",
    icon: Package,
    content: (
      <RefTab
        table="box-size"
        searchPlaceholder="Cerca per codice articolo…"
        columns={[
          { key: "item_no",  label: "Nr. Articolo" },
          { key: "box_size", label: "No. Unit per Parcel (Store)" },
        ]}
      />
    ),
  },
  {
    id: "display",
    label: "Display",
    icon: Monitor,
    content: (
      <RefTab
        table="display"
        searchPlaceholder="Cerca per codice, VM Module o modulo…"
        columns={[
          { key: "item_no",              label: "Nr. Articolo" },
          { key: "vm_module",            label: "VM Module" },
          { key: "flag_hanging_display", label: "Hanging" },
          { key: "modulo",               label: "Modulo" },
        ]}
      />
    ),
  },
  {
    id: "master-bi",
    label: "Master BI",
    icon: BarChart2,
    content: (
      <RefTab
        table="master-bi"
        searchPlaceholder="Cerca per codice, categoria o tipo…"
        columns={[
          { key: "item_no",      label: "Nr. Articolo" },
          { key: "category",     label: "Category" },
          { key: "subcategory",  label: "Subcategory" },
          { key: "barcode_ext",  label: "Barcode Ext." },
          { key: "item_type_bi", label: "Item Type" },
        ]}
      />
    ),
  },
  // Liste di priorità
  {
    id: "kvi",
    label: "KVI",
    icon: Tag,
    content: (
      <RefTab
        table="kvi"
        searchPlaceholder="Cerca per codice o nome articolo…"
        columns={[
          { key: "item_no",   label: "Nr. Articolo" },
          { key: "item_name", label: "Descrizione" },
          { key: "type",      label: "Tipo" },
        ]}
      />
    ),
  },
  {
    id: "sb-list",
    label: "SB List",
    icon: ShoppingBag,
    content: (
      <RefTab
        table="sb-list"
        searchPlaceholder="Cerca per codice o promo name…"
        columns={[
          { key: "item_no",            label: "Nr. Articolo" },
          { key: "promo_name",         label: "Promo Name" },
          { key: "data_variazione",    label: "Data Var." },
          { key: "model_store_finale", label: "Model Store" },
        ]}
      />
    ),
  },
  {
    id: "core-list",
    label: "Core List",
    icon: Layers,
    content: (
      <RefTab
        table="core-list"
        searchPlaceholder="Cerca per codice, modulo o tipo…"
        columns={[
          { key: "item_no",        label: "Nr. Articolo" },
          { key: "ax_module_code", label: "AX Module Code" },
          { key: "type",           label: "Tipo (conv.)" },
          { key: "type_original",  label: "Tipo Originale" },
        ]}
      />
    ),
  },
  {
    id: "campaigns",
    label: "Campagne",
    icon: Megaphone,
    content: (
      <RefTab
        table="campaigns"
        searchPlaceholder="Cerca per codice, promo o status…"
        columns={[
          { key: "item_no",           label: "Nr. Articolo" },
          { key: "promo_name",        label: "Promo Name" },
          { key: "prezzo_attuale",    label: "Prezzo Att." },
          { key: "prezzo_precedente", label: "Prezzo Prec." },
          { key: "type_item",         label: "Tipo" },
          { key: "type_after_promo",  label: "Tipo dopo Promo" },
          { key: "status",            label: "Status" },
          { key: "fine_promo",        label: "Fine Promo" },
        ]}
      />
    ),
  },
  {
    id: "iva",
    label: "IVA",
    icon: Percent,
    content: <IvaTab />,
  },
]

// ── Pagina principale ─────────────────────────────────────────────────────────

export default function ConverterPage() {
  const navigate  = useNavigate()
  const [activeTab, setActiveTab] = useState("raw-nav")

  const current = TABS.find((t) => t.id === activeTab)

  return (
    <ConverterErrorBoundary>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-[#1e3a5f]/10 rounded-xl flex items-center justify-center">
            <Layers size={18} className="text-[#1e3a5f]" aria-hidden="true" />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-gray-800">Converter — Tabelle di Riferimento</h1>
            <p className="text-xs text-gray-400 mt-0.5">Staging NAV · Prezzi · Traduzioni · Box Size · Display · Master BI · KVI · SB List · Core List · Campagne · IVA</p>
          </div>
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition focus-visible:ring-2 focus-visible:ring-[#2563eb]"
          >
            <LogOut size={15} aria-hidden="true" />
            Esci
          </button>
        </div>

        {/* Pannello stato + pulsante Assembla */}
        <StatusPanel />

        {/* Tab bar (scrollabile) */}
        <div className="overflow-x-auto">
          <div className="flex gap-1 border-b border-gray-200 min-w-max">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 transition -mb-px whitespace-nowrap
                  ${activeTab === id
                    ? "border-[#2563eb] text-[#1e3a5f]"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }`}
              >
                <Icon size={13} aria-hidden="true" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Contenuto tab attivo */}
        <div>{current?.content}</div>
      </div>
    </ConverterErrorBoundary>
  )
}
