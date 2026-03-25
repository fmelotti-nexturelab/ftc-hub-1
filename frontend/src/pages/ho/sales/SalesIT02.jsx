import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useMutation } from "@tanstack/react-query"
import { salesApi } from "@/api/ho/sales"
import { Upload, AlertCircle, ChevronDown, ChevronUp, LogOut } from "lucide-react"

const fmt = (n) =>
  typeof n === "number"
    ? n.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : n

function SalesTable({ preview }) {
  const [showMissing, setShowMissing] = useState(false)
  if (!preview) return null
  const { date_columns, rows, missing_stores, total_by_date, grand_total } = preview
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
      <div className="bg-emerald-500 px-4 py-2 flex items-center justify-between">
        <span className="text-white font-bold">IT02</span>
        <div className="flex items-center gap-3 text-white/80 text-xs">
          <span>{rows.length} negozi</span><span>•</span>
          <span>{date_columns.length} date</span><span>•</span>
          <span className="font-semibold">Totale: {fmt(grand_total)}</span>
        </div>
      </div>
      {missing_stores.length > 0 && (
        <button onClick={() => setShowMissing(!showMissing)} className="w-full flex items-center gap-2 px-4 py-2 bg-amber-50 border-b border-amber-200 text-amber-700 text-xs hover:bg-amber-100 transition">
          <AlertCircle size={14} />
          <span className="font-medium">{missing_stores.length} negozi senza dati</span>
          {showMissing ? <ChevronUp size={14} className="ml-auto" /> : <ChevronDown size={14} className="ml-auto" />}
        </button>
      )}
      {showMissing && (
        <div className="px-4 py-2 bg-amber-50 border-b border-amber-200 flex flex-wrap gap-1">
          {missing_stores.map((s) => <span key={s} className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded font-mono">{s}</span>)}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-3 py-2 font-semibold text-gray-600 sticky left-0 bg-gray-50">Negozio</th>
              {date_columns.map((d) => <th key={d} className="text-right px-3 py-2 font-semibold text-gray-600 whitespace-nowrap">{d}</th>)}
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
              {date_columns.map((d) => <td key={d} className="text-right px-3 py-2">{fmt(total_by_date[d] || 0)}</td>)}
              <td className="text-right px-3 py-2">{fmt(grand_total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

export default function SalesIT02() {
  const navigate = useNavigate()
  const [tsv, setTsv] = useState("")
  const [preview, setPreview] = useState(null)
  const parseMut = useMutation({
    mutationFn: () => salesApi.parseSalesData({ raw_tsv_it02: tsv }),
    onSuccess: (res) => setPreview(res.data.it02),
  })
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-800">Vendite IT02</h1>
        <button onClick={() => navigate("/ho/sales")} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition">
          <LogOut size={15} aria-hidden="true" />
          Esci
        </button>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-700">IT02</span>
          <span className="text-xs text-gray-400">Incolla dati da NAV (Ctrl+V)</span>
          {tsv && <button onClick={() => { setTsv(""); setPreview(null) }} className="ml-auto text-xs text-red-400 hover:text-red-600">Cancella</button>}
        </div>
        <textarea value={tsv} onChange={(e) => setTsv(e.target.value)} placeholder="Incolla qui i dati IT02 copiati da Navision..." rows={6}
          className="w-full text-xs font-mono bg-gray-50 border-2 border-emerald-400 rounded-lg px-3 py-2 outline-none resize-y focus:ring-2 focus:ring-emerald-300" />
        <button onClick={() => parseMut.mutate()} disabled={!tsv || parseMut.isPending}
          className="flex items-center gap-2 bg-[#1e3a5f] hover:bg-[#2563eb] text-white px-6 py-2.5 rounded-xl font-semibold shadow transition disabled:opacity-50">
          <Upload size={16} />
          {parseMut.isPending ? "Elaborazione..." : "Analizza IT02"}
        </button>
      </div>
      {preview && <SalesTable preview={preview} />}
    </div>
  )
}