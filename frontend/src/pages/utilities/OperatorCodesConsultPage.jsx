import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { LogOut, Search, Users } from "lucide-react"
import { apiClient } from "@/api/client"

export default function OperatorCodesConsultPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState("")

  const { data: operators = [], isLoading } = useQuery({
    queryKey: ["operator-codes-consult"],
    queryFn: () => apiClient.get("/api/ho/operator-codes").then((r) => r.data),
    staleTime: 60_000,
  })

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
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-violet-100 rounded-xl flex items-center justify-center">
          <Users size={18} className="text-violet-600" aria-hidden="true" />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-800">Codici Operatore</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Consulta la tabella con i codici operatori @flyingtigeritalia
          </p>
        </div>
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition"
          aria-label="Esci"
        >
          <LogOut size={15} aria-hidden="true" />
          Esci
        </button>
      </div>

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
