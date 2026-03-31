import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useMutation } from "@tanstack/react-query"
import { salesApi } from "@/api/ho/sales"
import { useSalesCheckStore } from "@/store/salesCheckStore"
import { LogOut, AlertCircle, RotateCcw } from "lucide-react"

const fmt = (n) =>
  typeof n === "number"
    ? n.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : "—"

function getYesterdayKey() {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  const dd = String(d.getDate()).padStart(2, "0")
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const yy = String(d.getFullYear()).slice(-2)
  return `${dd}.${mm}.${yy}`
}

function YesterdayTable({ preview }) {
  if (!preview) return null

  const yesterday = getYesterdayKey()
  const col = preview.date_columns.find((d) => d === yesterday)

  if (!col) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 text-sm text-amber-700">
        Nessun dato trovato per ieri (<span className="font-mono font-semibold">{yesterday}</span>).
        Le date nei dati sono: {preview.date_columns.join(", ") || "nessuna"}.
      </div>
    )
  }

  const rows = preview.rows
    .filter((r) => r.has_data && r.dates[col] !== undefined && r.dates[col] !== 0)
    .sort((a, b) => a.store_code.localeCompare(b.store_code))

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
      <div className="bg-emerald-500 px-4 py-2 flex items-center justify-between">
        <span className="text-white font-bold">IT02 — {col}</span>
        <div className="flex items-center gap-3 text-white/80 text-xs">
          <span>{rows.length} negozi con dati</span>
          <span className="text-white font-bold text-sm">{fmt(rows.reduce((s, r) => s + (r.dates[col] ?? 0), 0))} &euro;</span>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th scope="col" className="text-left px-4 py-2.5 font-semibold text-gray-600">Negozio</th>
              <th scope="col" className="text-right px-4 py-2.5 font-semibold text-gray-600">{col}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.store_code} className={`border-b border-gray-100 ${i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}`}>
                <td className="px-4 py-2 font-mono font-semibold text-gray-800">{row.store_code}</td>
                <td className="text-right px-4 py-2 text-gray-800 tabular-nums">{fmt(row.dates[col])}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function SalesIT02() {
  const navigate = useNavigate()
  const [tsv, setTsv] = useState("")
  const preview = useSalesCheckStore((s) => s.it02)
  const setPreview = useSalesCheckStore((s) => s.setPreview)

  const parseMut = useMutation({
    mutationFn: (raw) => salesApi.parseSalesData({ raw_tsv_it02: raw }),
    onSuccess: (res) => setPreview("it02", res.data.it02),
  })

  function handlePaste(e) {
    const text = e.target.value
    setTsv(text)
    if (text.includes("\t")) parseMut.mutate(text)
  }

  function resetPreview() {
    setTsv("")
    setPreview("it02", null)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-800">Vendite IT02</h1>
        <button onClick={() => navigate("/utilities/genera-tabelle?group=sales")} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition focus-visible:ring-2 focus-visible:ring-[#2563eb]">
          <LogOut size={15} aria-hidden="true" />
          Esci
        </button>
      </div>
      {!preview ? (
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-700">IT02</span>
            <span className="text-xs text-gray-400">Incolla dati da NAV (Ctrl+V)</span>
            {tsv && <button onClick={() => setTsv("")} className="ml-auto text-xs text-red-400 hover:text-red-600">Cancella</button>}
          </div>
          <label htmlFor="tsv-it02" className="sr-only">Dati TSV IT02</label>
          <textarea
            id="tsv-it02"
            value={tsv}
            onChange={handlePaste}
            placeholder="Incolla qui i dati IT02 copiati da Navision (Ctrl+V)..."
            rows={6}
            className="w-full text-xs font-mono bg-gray-50 border-2 border-emerald-400 rounded-lg px-3 py-2 outline-none resize-y focus:ring-2 focus:ring-emerald-300"
          />
          {parseMut.isPending && <p className="text-xs text-gray-500">Elaborazione...</p>}
          {parseMut.isError && <p className="text-xs text-red-600">Errore nel parsing dei dati.</p>}
        </div>
      ) : (
        <>
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-3">
            {(() => {
              const yKey = getYesterdayKey()
              const col = preview.date_columns.find((d) => d === yKey)
              const lowStores = col ? preview.rows.filter((r) => r.has_data && r.dates[col] !== undefined && r.dates[col] > 0 && r.dates[col] < 1000) : []
              return (
                <>
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-xs font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-700">IT02</span>
                    <span className="text-xs text-gray-500">{preview.rows.length} negozi analizzati</span>
                    <button
                      onClick={resetPreview}
                      className="ml-auto flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 border border-gray-200 rounded-lg px-2.5 py-1 hover:bg-gray-50 transition"
                    >
                      <RotateCcw size={12} aria-hidden="true" />
                      Nuova analisi
                    </button>
                  </div>
                  {lowStores.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-red-600">
                        <AlertCircle size={13} aria-hidden="true" />
                        {lowStores.length} negozi con incasso &lt; 1.000
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {lowStores.sort((a, b) => a.store_code.localeCompare(b.store_code)).map((s) => (
                          <span key={s.store_code} className="text-xs bg-red-50 border border-red-200 text-red-700 px-2 py-0.5 rounded font-mono">
                            {s.store_code} ({fmt(s.dates[col])})
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )
            })()}
            {preview.missing_stores.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-700">
                  <AlertCircle size={13} aria-hidden="true" />
                  {preview.missing_stores.length} negozi senza dati
                </div>
                <div className="flex flex-wrap gap-1">
                  {preview.missing_stores.map((s) => (
                    <span key={s} className="text-xs bg-amber-50 border border-amber-200 text-amber-700 px-2 py-0.5 rounded font-mono">{s}</span>
                  ))}
                </div>
              </div>
            )}
            {preview.excluded_stores?.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500">
                  <AlertCircle size={13} aria-hidden="true" />
                  {preview.excluded_stores.length} negozi esclusi dal check
                </div>
                <div className="flex flex-wrap gap-1">
                  {preview.excluded_stores.map((s) => (
                    <span key={s} className="text-xs bg-gray-100 border border-gray-200 text-gray-500 px-2 py-0.5 rounded font-mono">{s}</span>
                  ))}
                </div>
              </div>
            )}
            {preview.missing_stores.length === 0 && (
              <p className="text-xs text-green-600 font-medium">Tutti i negozi hanno dati.</p>
            )}
          </div>

          <YesterdayTable preview={preview} />
        </>
      )}
    </div>
  )
}
