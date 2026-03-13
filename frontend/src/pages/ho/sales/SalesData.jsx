import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { salesApi } from "@/api/ho/sales"
import { Upload, Trash2, Plus, AlertCircle, CheckCircle2, ChevronDown, ChevronUp } from "lucide-react"

const SOURCES = ["IT01", "IT02", "IT03"]
const REASONS = ["CLOSED", "RESTYLING", "NEW OPENING"]

const fmt = (n) =>
  typeof n === "number"
    ? n.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : n

function PasteArea({ source, value, onChange }) {
  const colors = {
    IT01: "border-blue-400 focus:ring-blue-300",
    IT02: "border-emerald-400 focus:ring-emerald-300",
    IT03: "border-violet-400 focus:ring-violet-300",
  }
  const badges = {
    IT01: "bg-blue-100 text-blue-700",
    IT02: "bg-emerald-100 text-emerald-700",
    IT03: "bg-violet-100 text-violet-700",
  }
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <span className={`text-xs font-bold px-2 py-0.5 rounded ${badges[source]}`}>{source}</span>
        <span className="text-xs text-gray-400">Incolla dati da NAV (Ctrl+V)</span>
        {value && (
          <button onClick={() => onChange("")} className="ml-auto text-xs text-red-400 hover:text-red-600">
            Cancella
          </button>
        )}
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={`Incolla qui i dati ${source} copiati da Navision...`}
        rows={5}
        className={`w-full text-xs font-mono bg-gray-50 border-2 rounded-lg px-3 py-2 outline-none resize-y transition focus:ring-2 ${colors[source]}`}
      />
    </div>
  )
}

function SalesTable({ preview }) {
  const [showMissing, setShowMissing] = useState(false)
  const sourceBadge = { IT01: "bg-blue-500", IT02: "bg-emerald-500", IT03: "bg-violet-500" }
  if (!preview) return null
  const { source, date_columns, rows, missing_stores, total_by_date, grand_total } = preview

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
      <div className={`${sourceBadge[source]} px-4 py-2 flex items-center justify-between`}>
        <span className="text-white font-bold">{source}</span>
        <div className="flex items-center gap-3 text-white/80 text-xs">
          <span>{rows.length} negozi</span>
          <span>•</span>
          <span>{date_columns.length} date</span>
          <span>•</span>
          <span className="font-semibold">Totale: {fmt(grand_total)}</span>
        </div>
      </div>

      {missing_stores.length > 0 && (
        <button
          onClick={() => setShowMissing(!showMissing)}
          className="w-full flex items-center gap-2 px-4 py-2 bg-amber-50 border-b border-amber-200 text-amber-700 text-xs hover:bg-amber-100 transition"
        >
          <AlertCircle size={14} />
          <span className="font-medium">{missing_stores.length} negozi senza dati</span>
          {showMissing ? <ChevronUp size={14} className="ml-auto" /> : <ChevronDown size={14} className="ml-auto" />}
        </button>
      )}
      {showMissing && missing_stores.length > 0 && (
        <div className="px-4 py-2 bg-amber-50 border-b border-amber-200 flex flex-wrap gap-1">
          {missing_stores.map((s) => (
            <span key={s} className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded font-mono">{s}</span>
          ))}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-3 py-2 font-semibold text-gray-600 sticky left-0 bg-gray-50">Negozio</th>
              {date_columns.map((d) => (
                <th key={d} className="text-right px-3 py-2 font-semibold text-gray-600 whitespace-nowrap">{d}</th>
              ))}
              <th className="text-right px-3 py-2 font-semibold text-gray-800">Totale</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.store_code} className={`border-b border-gray-100 ${!row.has_data ? "bg-red-50" : i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}`}>
                <td className={`px-3 py-1.5 font-mono sticky left-0 ${!row.has_data ? "bg-red-50" : i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}`}>
                  <div className="font-semibold">{row.store_code}</div>
                  <div className="text-gray-400">{row.store_name !== row.store_code && row.store_name}</div>
                </td>
                {date_columns.map((d) => (
                  <td key={d} className={`text-right px-3 py-1.5 ${row.dates[d] === 0 ? "text-gray-300" : "text-gray-800"}`}>
                    {row.dates[d] !== undefined ? fmt(row.dates[d]) : "—"}
                  </td>
                ))}
                <td className="text-right px-3 py-1.5 font-semibold text-gray-800">{fmt(row.total)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-gray-100 border-t-2 border-gray-300 font-bold">
              <td className="px-3 py-2 sticky left-0 bg-gray-100">TOTALE</td>
              {date_columns.map((d) => (
                <td key={d} className="text-right px-3 py-2">{fmt(total_by_date[d] || 0)}</td>
              ))}
              <td className="text-right px-3 py-2">{fmt(grand_total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

function ExcludedStoresPanel() {
  const qc = useQueryClient()
  const [newStore, setNewStore] = useState({ store_code: "", store_name: "", reason: "CLOSED", notes: "" })
  const [showAdd, setShowAdd] = useState(false)

  const { data: stores = [] } = useQuery({
    queryKey: ["excluded-stores"],
    queryFn: () => salesApi.getExcludedStores().then((r) => r.data),
  })

  const addMut = useMutation({
    mutationFn: salesApi.addExcludedStore,
    onSuccess: () => {
      qc.invalidateQueries(["excluded-stores"])
      setNewStore({ store_code: "", store_name: "", reason: "CLOSED", notes: "" })
      setShowAdd(false)
    },
  })

  const removeMut = useMutation({
    mutationFn: salesApi.removeExcludedStore,
    onSuccess: () => qc.invalidateQueries(["excluded-stores"]),
  })

  const reasonColor = {
    CLOSED: "bg-red-100 text-red-700",
    RESTYLING: "bg-amber-100 text-amber-700",
    "NEW OPENING": "bg-green-100 text-green-700",
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <h3 className="font-semibold text-gray-800">Negozi esclusi dal check</h3>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-1 text-xs bg-[#1e3a5f] text-white px-3 py-1.5 rounded-lg hover:bg-[#2563eb] transition"
        >
          <Plus size={13} /> Aggiungi
        </button>
      </div>

      {showAdd && (
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 grid grid-cols-2 gap-3">
          <input
            placeholder="Codice store *"
            value={newStore.store_code}
            onChange={(e) => setNewStore((s) => ({ ...s, store_code: e.target.value }))}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-300 outline-none"
          />
          <input
            placeholder="Nome store"
            value={newStore.store_name}
            onChange={(e) => setNewStore((s) => ({ ...s, store_name: e.target.value }))}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-300 outline-none"
          />
          <select
            value={newStore.reason}
            onChange={(e) => setNewStore((s) => ({ ...s, reason: e.target.value }))}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-300 outline-none"
          >
            {REASONS.map((r) => <option key={r}>{r}</option>)}
          </select>
          <input
            placeholder="Note (opzionale)"
            value={newStore.notes}
            onChange={(e) => setNewStore((s) => ({ ...s, notes: e.target.value }))}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-300 outline-none"
          />
          <button
            onClick={() => addMut.mutate(newStore)}
            disabled={!newStore.store_code || addMut.isPending}
            className="col-span-2 bg-[#1e3a5f] text-white py-2 rounded-lg text-sm font-medium hover:bg-[#2563eb] transition disabled:opacity-50"
          >
            {addMut.isPending ? "Salvataggio..." : "Salva"}
          </button>
        </div>
      )}

      <div className="divide-y divide-gray-100">
        {stores.length === 0 && (
          <p className="text-center text-gray-400 text-sm py-6">Nessun negozio escluso</p>
        )}
        {stores.map((s) => (
          <div key={s.id} className="flex items-center gap-3 px-4 py-2.5">
            <code className="text-xs font-bold text-gray-700 w-16">{s.store_code}</code>
            <span className="text-sm text-gray-600 flex-1">{s.store_name || "—"}</span>
            <span className={`text-xs px-2 py-0.5 rounded font-medium ${reasonColor[s.reason]}`}>{s.reason}</span>
            {s.notes && <span className="text-xs text-gray-400 italic">{s.notes}</span>}
            <button onClick={() => removeMut.mutate(s.id)} className="text-red-400 hover:text-red-600 transition">
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function SalesData() {
  const [tsvData, setTsvData] = useState({ IT01: "", IT02: "", IT03: "" })
  const [previews, setPreviews] = useState(null)
  const [activeTab, setActiveTab] = useState("input")

  const parseMut = useMutation({
    mutationFn: () =>
      salesApi.parseSalesData({
        raw_tsv_it01: tsvData.IT01 || null,
        raw_tsv_it02: tsvData.IT02 || null,
        raw_tsv_it03: tsvData.IT03 || null,
      }),
    onSuccess: (res) => {
      setPreviews(res.data)
      setActiveTab("preview")
    },
  })

  const hasAnyData = Object.values(tsvData).some(Boolean)
  const hasResults = previews && Object.values(previews).some(Boolean)

  return (
    <div className="space-y-6">
      <div className="flex gap-1 bg-white border border-gray-200 rounded-xl p-1 w-fit shadow-sm">
        {[
          { id: "input", label: "Inserimento dati" },
          { id: "preview", label: "Anteprime", disabled: !hasResults },
          { id: "excluded", label: "Negozi esclusi" },
        ].map(({ id, label, disabled }) => (
          <button
            key={id}
            onClick={() => !disabled && setActiveTab(id)}
            disabled={disabled}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition
              ${activeTab === id ? "bg-[#1e3a5f] text-white" : disabled ? "text-gray-300 cursor-not-allowed" : "text-gray-600 hover:bg-gray-100"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === "input" && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-4">
            <p className="text-sm text-gray-500">
              Copia i dati dalle finestre NAV (Ctrl+A → Ctrl+C) e incollali nelle aree corrispondenti.
              Verranno filtrate automaticamente le colonne +/- e le date precedenti ad oggi.
            </p>
            {SOURCES.map((src) => (
              <PasteArea
                key={src}
                source={src}
                value={tsvData[src]}
                onChange={(val) => setTsvData((prev) => ({ ...prev, [src]: val }))}
              />
            ))}
          </div>

          <button
            onClick={() => parseMut.mutate()}
            disabled={!hasAnyData || parseMut.isPending}
            className="flex items-center gap-2 bg-[#1e3a5f] hover:bg-[#2563eb] text-white px-6 py-3 rounded-xl font-semibold shadow transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Upload size={18} />
            {parseMut.isPending ? "Elaborazione..." : "Analizza dati"}
          </button>

          {parseMut.isError && (
            <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm">
              <AlertCircle size={16} />
              Errore durante l analisi. Verifica il formato dei dati.
            </div>
          )}
        </div>
      )}

      {activeTab === "preview" && previews && (
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-4">
            {SOURCES.map((src) => {
              const p = previews[src.toLowerCase()]
              return (
                <div key={src} className={`bg-white rounded-xl border p-4 shadow-sm ${p ? "border-gray-200" : "border-dashed border-gray-200 opacity-50"}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-gray-700">{src}</span>
                    {p ? <CheckCircle2 size={16} className="text-green-500" /> : <AlertCircle size={16} className="text-gray-300" />}
                  </div>
                  {p ? (
                    <>
                      <div className="text-2xl font-black text-[#1e3a5f]">{fmt(p.grand_total)}</div>
                      <div className="text-xs text-gray-400 mt-1">{p.rows.length} negozi · {p.missing_stores.length} senza dati</div>
                    </>
                  ) : (
                    <div className="text-sm text-gray-400">Nessun dato</div>
                  )}
                </div>
              )
            })}
          </div>
          {SOURCES.map((src) => {
            const p = previews[src.toLowerCase()]
            return p ? <SalesTable key={src} preview={p} /> : null
          })}
        </div>
      )}

      {activeTab === "excluded" && <ExcludedStoresPanel />}
    </div>
  )
}
