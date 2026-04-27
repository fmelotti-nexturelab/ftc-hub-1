import { useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { LogOut, Search, Database, Download, Upload, FileSpreadsheet, Loader2, Trash2, AlertTriangle } from "lucide-react"
import * as XLSX from "xlsx"
import { operatorCodeApi } from "@/api/ho/operatorCode"

const ENTITY_COLORS = {
  IT01: "bg-blue-100 text-blue-700",
  IT02: "bg-emerald-100 text-emerald-700",
  IT03: "bg-violet-100 text-violet-700",
}

export default function OperatorCodePoolPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const fileInputRef = useRef(null)
  const [search, setSearch] = useState("")
  const [stagedFile, setStagedFile] = useState(null)
  const [step, setStep] = useState(null)
  const [password, setPassword] = useState("")
  const [pwError, setPwError] = useState("")

  const { data: pool = [], isLoading } = useQuery({
    queryKey: ["operator-code-pool"],
    queryFn: () => operatorCodeApi.listPool().then((r) => r.data),
    staleTime: 60_000,
  })

  const clearMutation = useMutation({
    mutationFn: () => operatorCodeApi.clearPool(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["operator-code-pool"] })
      setStep(null)
      setPassword("")
    },
    onError: () => alert("Errore durante lo svuotamento della tabella."),
  })

  const handlePasswordSubmit = () => {
    if (password !== "admink") { setPwError("Password non corretta"); return }
    setPwError("")
    setStep("confirm")
  }

  const handleCancel = () => { setStep(null); setPassword(""); setPwError("") }

  const overwriteMutation = useMutation({
    mutationFn: (file) => operatorCodeApi.poolOverwrite(file),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["operator-code-pool"] })
      setStagedFile(null)
      alert(`Tabella aggiornata: ${res.data.inserted} codici importati.`)
    },
    onError: (e) => alert(e.response?.data?.detail || "Errore durante l'importazione."),
  })

  function handleDownload() {
    const rows = pool.map((r) => ({
      Entity: r.entity ?? "",
      Codice: r.code ?? "",
      Nominativo: r.full_name ?? "",
      "Importato il": r.imported_at ? new Date(r.imported_at).toLocaleDateString("it-IT") : "",
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Pool")
    XLSX.writeFile(wb, "operator_code_pool.xlsx")
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (file) setStagedFile(file)
    e.target.value = ""
  }

  const filtered = pool.filter((r) => {
    const q = search.toLowerCase()
    return (
      (r.entity ?? "").toLowerCase().includes(q) ||
      String(r.code ?? "").includes(q) ||
      (r.full_name ?? "").toLowerCase().includes(q)
    )
  })

  return (
    <>
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-violet-100 rounded-xl flex items-center justify-center">
            <Database size={18} className="text-violet-600" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-800">Pool Codici Operatore</h1>
            <p className="text-xs text-gray-400 mt-0.5">Consulta la tabella dei codici per entity</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleDownload}
            disabled={pool.length === 0}
            className="flex items-center gap-2 border border-[#1e3a5f] text-[#1e3a5f] hover:bg-[#1e3a5f] hover:text-white font-semibold py-2 px-5 rounded-xl transition text-sm disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="Download Excel"
          >
            <Download size={15} aria-hidden="true" /> Download
          </button>

          <label htmlFor="pool-file-input" className="sr-only">Sovrascrivi da file</label>
          <input
            id="pool-file-input"
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 border border-gray-300 text-gray-600 hover:bg-gray-50 font-semibold py-2 px-5 rounded-xl transition text-sm"
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
            onClick={() => setStep("password")}
            disabled={pool.length === 0}
            className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-5 rounded-xl shadow transition text-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Trash2 size={15} aria-hidden="true" /> Svuota tabella
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

      {/* File staged banner */}
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
          <label htmlFor="search-pool" className="sr-only">Cerca nel pool</label>
          <input
            id="search-pool"
            type="text"
            placeholder="Cerca per entity, codice, nominativo…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2563eb] focus:border-transparent outline-none transition text-sm"
          />
        </div>
        {!isLoading && (
          <span className="text-xs text-gray-500 shrink-0">
            {filtered.length} / {pool.length} codici
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
                  <th scope="col" className="px-4 py-3 text-left">Entity</th>
                  <th scope="col" className="px-4 py-3 text-left">Codice</th>
                  <th scope="col" className="px-4 py-3 text-left">Nominativo</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr key={row.id} className="odd:bg-white even:bg-gray-50/50 border-b border-gray-100 last:border-0">
                    <td className="px-4 py-2.5">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded ${ENTITY_COLORS[row.entity] ?? "bg-gray-100 text-gray-700"}`}>
                        {row.entity}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-mono font-semibold text-gray-800">{row.code}</td>
                    <td className="px-4 py-2.5 text-gray-700">{row.full_name ?? <span className="text-gray-300">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>

    {/* Modal password */}
      {step === "password" && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center shrink-0">
                <Trash2 size={18} className="text-red-600" />
              </div>
              <div>
                <h2 className="font-bold text-gray-800">Svuota tabella pool</h2>
                <p className="text-xs text-gray-500">Inserisci la password di conferma</p>
              </div>
            </div>
            <input
              type="password"
              value={password}
              onChange={e => { setPassword(e.target.value); setPwError("") }}
              onKeyDown={e => e.key === "Enter" && handlePasswordSubmit()}
              placeholder="Password..."
              autoFocus
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none transition text-sm mb-1"
            />
            {pwError && <p className="text-red-600 text-xs mb-3">{pwError}</p>}
            {!pwError && <div className="mb-3" />}
            <div className="flex gap-2">
              <button onClick={handleCancel} className="flex-1 border border-gray-300 text-gray-600 font-semibold py-2 rounded-xl hover:bg-gray-50 transition text-sm">Annulla</button>
              <button onClick={handlePasswordSubmit} className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-2 rounded-xl transition text-sm">Continua</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal conferma */}
      {step === "confirm" && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center shrink-0">
                <AlertTriangle size={18} className="text-red-600" />
              </div>
              <div>
                <h2 className="font-bold text-gray-800">Conferma eliminazione</h2>
                <p className="text-xs text-gray-500">Questa operazione è irreversibile</p>
              </div>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4">
              <p className="text-red-700 text-sm font-medium">
                Stai per eliminare <span className="font-bold">{pool.length} codici</span> dal pool.
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={handleCancel} disabled={clearMutation.isPending} className="flex-1 border border-gray-300 text-gray-600 font-semibold py-2 rounded-xl hover:bg-gray-50 transition text-sm disabled:opacity-50">Annulla</button>
              <button onClick={() => clearMutation.mutate()} disabled={clearMutation.isPending} className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-2 rounded-xl transition text-sm disabled:opacity-50">
                {clearMutation.isPending ? "Eliminazione…" : "Elimina tutto"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
