import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useAuthStore } from "@/store/authStore"
import { useQuery } from "@tanstack/react-query"
import { Search, Copy, Check, ShieldAlert } from "lucide-react"
import { apiClient } from "@/api/client"

export default function SupportLookup() {
  const user = useAuthStore((s) => s.user)
  const navigate = useNavigate()

  if (user?.user_type !== "SUPERUSER") {
    navigate("/unauthorized", { replace: true })
    return null
  }

  const [code, setCode] = useState("")
  const [query, setQuery] = useState("")
  const [copied, setCopied] = useState(false)

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["support-lookup", query],
    queryFn: () => apiClient.get(`/api/admin/support/lookup/${query}`).then(r => r.data),
    enabled: !!query,
    retry: false,
  })

  const { data: allCodes = [] } = useQuery({
    queryKey: ["support-codes"],
    queryFn: () => apiClient.get("/api/admin/support/codes").then(r => r.data),
  })

  function handleSearch(e) {
    e.preventDefault()
    if (code.trim()) setQuery(code.trim().toUpperCase())
  }

  function copyPrompt() {
    if (!data?.prompt) return
    navigator.clipboard.writeText(data.prompt).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    })
  }

  const MODULE_COLORS = {
    tickets: "bg-blue-100 text-blue-700",
    pwa: "bg-violet-100 text-violet-700",
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-[#1e3a5f]/10 rounded-xl flex items-center justify-center">
          <ShieldAlert size={18} className="text-[#1e3a5f]" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-800">Lookup Codici Supporto</h1>
          <p className="text-xs text-gray-400 mt-0.5">Inserisci il codice ricevuto dal tester per ottenere le istruzioni di intervento</p>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <form onSubmit={handleSearch} className="flex gap-3">
          <input
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase())}
            placeholder="es. TCKT-0001"
            className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2563eb] focus:border-transparent outline-none transition font-mono text-sm uppercase"
          />
          <button
            type="submit"
            disabled={!code.trim()}
            className="flex items-center gap-2 bg-[#1e3a5f] hover:bg-[#2563eb] text-white font-semibold px-5 py-2.5 rounded-xl shadow transition disabled:opacity-50"
          >
            <Search size={15} />
            Cerca
          </button>
        </form>
      </div>

      {/* Risultato */}
      {isLoading && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 text-center text-gray-400 text-sm">
          Ricerca in corso...
        </div>
      )}

      {isError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-red-700 text-sm">
          {error?.response?.status === 404
            ? `Nessun codice trovato per "${query}". Verifica che il codice sia corretto.`
            : "Errore durante la ricerca. Riprova."}
        </div>
      )}

      {data && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="bg-[#1e3a5f] px-5 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="font-mono font-bold text-white text-sm">{data.code}</span>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded ${MODULE_COLORS[data.module] || "bg-gray-100 text-gray-600"}`}>
                {data.module}
              </span>
            </div>
          </div>

          <div className="p-5 space-y-4">
            <div>
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Problema segnalato</div>
              <div className="text-sm font-medium text-gray-800">{data.description}</div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Istruzioni di intervento</div>
                <button
                  onClick={copyPrompt}
                  className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition ${
                    copied
                      ? "bg-green-100 text-green-700"
                      : "bg-[#1e3a5f] hover:bg-[#2563eb] text-white"
                  }`}
                >
                  {copied ? <><Check size={13} /> Copiato!</> : <><Copy size={13} /> Copia</>}
                </button>
              </div>
              <div className="text-xs font-mono bg-gray-50 border-2 border-blue-400 rounded-lg px-4 py-3 text-gray-700 leading-relaxed whitespace-pre-wrap">
                {data.prompt}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabella tutti i codici */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="bg-gray-50 border-b border-gray-200 px-5 py-3">
          <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
            Tutti i codici — {allCodes.length} disponibili
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 font-semibold">
                <th className="text-left px-4 py-2.5">Codice</th>
                <th className="text-left px-4 py-2.5">Modulo</th>
                <th className="text-left px-4 py-2.5">Descrizione</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {allCodes.map((c, i) => (
                <tr key={c.code} className={`border-b border-gray-50 hover:bg-blue-50/30 transition ${i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}`}>
                  <td className="px-4 py-2.5 font-mono font-bold text-[#1e3a5f]">{c.code}</td>
                  <td className="px-4 py-2.5">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded ${MODULE_COLORS[c.module] || "bg-gray-100 text-gray-500"}`}>
                      {c.module}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-gray-600">{c.description}</td>
                  <td className="px-4 py-2.5">
                    <button
                      onClick={() => { setCode(c.code); setQuery(c.code) }}
                      className="text-xs text-[#2563eb] hover:underline"
                    >
                      Dettaglio
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
