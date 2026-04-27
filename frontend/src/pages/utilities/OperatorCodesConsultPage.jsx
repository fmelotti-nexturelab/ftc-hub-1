import { useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { LogOut, Search, Users, Download, Upload, FileSpreadsheet, Loader2 } from "lucide-react"
import * as XLSX from "xlsx"
import { apiClient } from "@/api/client"

export default function OperatorCodesConsultPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const fileInputRef = useRef(null)
  const [search, setSearch] = useState("")
  const [stagedFile, setStagedFile] = useState(null)

  const { data: operators = [], isLoading } = useQuery({
    queryKey: ["operator-codes-consult"],
    queryFn: () => apiClient.get("/api/ho/operator-codes").then((r) => r.data),
    staleTime: 60_000,
  })

  const overwriteMutation = useMutation({
    mutationFn: (file) => {
      const form = new FormData()
      form.append("file", file)
      return apiClient.post("/api/ho/operator-codes/overwrite", form, {
        headers: { "Content-Type": "multipart/form-data" },
      })
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["operator-codes-consult"] })
      setStagedFile(null)
      alert(`Tabella aggiornata: ${res.data.inserted} operatori importati.`)
    },
    onError: (e) => {
      alert(e.response?.data?.detail || "Errore durante l'importazione.")
    },
  })

  function handleDownload() {
    const rows = operators.map((o) => ({
      Codice: o.code ?? "",
      Nome: o.first_name ?? "",
      Cognome: o.last_name ?? "",
      Email: o.email ?? "",
      Store: o.store_number ?? "",
      "Data Inizio": o.start_date ? new Date(o.start_date).toLocaleDateString("it-IT") : "",
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Operatori")
    XLSX.writeFile(wb, "operator_codes.xlsx")
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (file) setStagedFile(file)
    e.target.value = ""
  }

  const filtered = operators.filter((o) => {
    const q = search.toLowerCase()
    return (
      (o.code ?? "").toLowerCase().includes(q) ||
      (o.first_name ?? "").toLowerCase().includes(q) ||
      (o.last_name ?? "").toLowerCase().includes(q) ||
      (o.email ?? "").toLowerCase().includes(q) ||
      (o.store_number ?? "").toLowerCase().includes(q)
    )
  })

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-violet-100 rounded-xl flex items-center justify-center">
            <Users size={18} className="text-violet-600" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-800">Codici Operatore</h1>
            <p className="text-xs text-gray-400 mt-0.5">
              Consulta la tabella con i codici operatori @flyingtigeritalia
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {operators.length > 0 && (
            <button
              onClick={handleDownload}
              className="flex items-center gap-2 border border-[#1e3a5f] text-[#1e3a5f] hover:bg-[#1e3a5f] hover:text-white font-semibold py-2 px-5 rounded-xl transition text-sm"
              aria-label="Download Excel"
            >
              <Download size={15} aria-hidden="true" /> Download
            </button>
          )}
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleFileChange} className="hidden" />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 border border-gray-300 text-gray-600 hover:bg-gray-50 font-semibold py-2 px-5 rounded-xl transition text-sm"
            aria-label="Sovrascrivi da file"
          >
            <Upload size={15} aria-hidden="true" /> Sovrascrivi da file
          </button>
          <button
            onClick={() => overwriteMutation.mutate(stagedFile)}
            disabled={!stagedFile || overwriteMutation.isPending}
            className="flex items-center gap-2 bg-[#1e3a5f] hover:bg-[#2563eb] text-white font-semibold py-2 px-5 rounded-xl shadow transition text-sm disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="Sovrascrivi tabella"
          >
            {overwriteMutation.isPending
              ? <Loader2 size={15} className="animate-spin" aria-hidden="true" />
              : <FileSpreadsheet size={15} aria-hidden="true" />}
            Sovrascrivi tabella
          </button>
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition"
            aria-label="Esci"
          >
            <LogOut size={15} aria-hidden="true" />
            Esci
          </button>
        </div>
      </div>

      {/* Banner file staged */}
      {stagedFile && (
        <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5 text-xs">
          <FileSpreadsheet size={14} className="text-blue-500 shrink-0" aria-hidden="true" />
          <span className="text-blue-700 font-medium">{stagedFile.name}</span>
          <span className="text-blue-500">— pronto per l'importazione</span>
        </div>
      )}

      {/* Search + counter */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative max-w-sm flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
          <label htmlFor="search-operator" className="sr-only">Cerca operatore</label>
          <input
            id="search-operator"
            type="text"
            placeholder="Cerca per nome, codice, store, email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2563eb] focus:border-transparent outline-none transition text-sm"
          />
        </div>
        {!isLoading && (
          <span className="text-xs text-gray-500 shrink-0">
            {filtered.length} / {operators.length} operatori
          </span>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="py-16 text-center text-gray-400 text-sm">Caricamento…</div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-gray-400 text-sm">Nessun risultato</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-gray-600 font-semibold text-xs">
                  <th scope="col" className="px-4 py-3 text-left">Codice</th>
                  <th scope="col" className="px-4 py-3 text-left">Cognome</th>
                  <th scope="col" className="px-4 py-3 text-left">Nome</th>
                  <th scope="col" className="px-4 py-3 text-left">Email</th>
                  <th scope="col" className="px-4 py-3 text-left">Store</th>
                  <th scope="col" className="px-4 py-3 text-left">Data Inizio</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((o) => (
                  <tr key={o.id} className="odd:bg-white even:bg-gray-50/50 border-b border-gray-100 last:border-0">
                    <td className="px-4 py-2.5 font-mono font-semibold text-gray-800">
                      {o.code ?? <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-gray-700">{o.last_name ?? "—"}</td>
                    <td className="px-4 py-2.5 text-gray-700">{o.first_name ?? "—"}</td>
                    <td className="px-4 py-2.5 text-gray-500">{o.email ?? "—"}</td>
                    <td className="px-4 py-2.5">
                      {o.store_number ? (
                        <span className="text-xs font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-700">
                          {o.store_number}
                        </span>
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-gray-500">
                      {o.start_date
                        ? new Date(o.start_date).toLocaleDateString("it-IT")
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
