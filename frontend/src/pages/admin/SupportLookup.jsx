import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useAuthStore } from "@/store/authStore"
import { useQuery } from "@tanstack/react-query"
import { Search, Copy, Check, ShieldAlert, ChevronDown, ChevronUp, LogOut } from "lucide-react"
import { apiClient } from "@/api/client"

export default function SupportLookup() {
  const user = useAuthStore((s) => s.user)
  const navigate = useNavigate()

  if (user?.department !== "SUPERUSER") {
    navigate("/unauthorized", { replace: true })
    return null
  }

  const [searchCode, setSearchCode] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [expandedCode, setExpandedCode] = useState(null)
  const [copiedCode, setCopiedCode] = useState(null)

  // Query per la ricerca rapida via barra
  const { data: searchResult, isLoading: searchLoading, isError: searchError, error: searchErr } = useQuery({
    queryKey: ["support-lookup", searchQuery],
    queryFn: () => apiClient.get(`/api/admin/support/lookup/${searchQuery}`).then(r => r.data),
    enabled: !!searchQuery,
    retry: false,
  })

  // Query per il dettaglio inline della riga espansa
  const { data: expandedData } = useQuery({
    queryKey: ["support-lookup", expandedCode],
    queryFn: () => apiClient.get(`/api/admin/support/lookup/${expandedCode}`).then(r => r.data),
    enabled: !!expandedCode,
    retry: false,
  })

  const { data: allCodes = [] } = useQuery({
    queryKey: ["support-codes"],
    queryFn: () => apiClient.get("/api/admin/support/codes").then(r => r.data),
  })

  function handleSearch(e) {
    e.preventDefault()
    if (searchCode.trim()) setSearchQuery(searchCode.trim().toUpperCase())
  }

  function toggleExpand(code) {
    setExpandedCode(prev => prev === code ? null : code)
  }

  function copyPrompt(prompt, code) {
    navigator.clipboard.writeText(prompt).then(() => {
      setCopiedCode(code)
      setTimeout(() => setCopiedCode(null), 2500)
    })
  }

  const MODULE_COLORS = {
    tickets: "bg-blue-100 text-blue-700",
    pwa:     "bg-violet-100 text-violet-700",
    users:   "bg-emerald-100 text-emerald-700",
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-[#1e3a5f]/10 rounded-xl flex items-center justify-center">
            <ShieldAlert size={18} className="text-[#1e3a5f]" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-800">Lookup Codici Supporto</h1>
            <p className="text-xs text-gray-400 mt-0.5">Inserisci il codice ricevuto dal tester oppure clicca su una riga per vedere le istruzioni</p>
          </div>
        </div>
        <button
          onClick={() => navigate("/utilities")}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition"
        >
          <LogOut size={15} />
          Esci
        </button>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <form onSubmit={handleSearch} className="flex gap-3">
          <input
            value={searchCode}
            onChange={e => setSearchCode(e.target.value.toUpperCase())}
            placeholder="es. TCKT-0001 o USR-0023"
            className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2563eb] focus:border-transparent outline-none transition font-mono text-sm uppercase"
          />
          <button
            type="submit"
            disabled={!searchCode.trim()}
            className="flex items-center gap-2 bg-[#1e3a5f] hover:bg-[#2563eb] text-white font-semibold px-5 py-2.5 rounded-xl shadow transition disabled:opacity-50"
          >
            <Search size={15} />
            Cerca
          </button>
        </form>
      </div>

      {/* Risultato ricerca rapida */}
      {searchLoading && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 text-center text-gray-400 text-sm">
          Ricerca in corso...
        </div>
      )}
      {searchError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-red-700 text-sm">
          {searchErr?.response?.status === 404
            ? `Nessun codice trovato per "${searchQuery}".`
            : "Errore durante la ricerca. Riprova."}
        </div>
      )}
      {searchResult && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="bg-[#1e3a5f] px-5 py-3 flex items-center gap-3">
            <span className="font-mono font-bold text-white text-sm">{searchResult.code}</span>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded ${MODULE_COLORS[searchResult.module] || "bg-gray-100 text-gray-600"}`}>
              {searchResult.module}
            </span>
          </div>
          <div className="p-5 space-y-4">
            <div>
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Problema segnalato</div>
              <div className="text-sm font-medium text-gray-800">{searchResult.description}</div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Istruzioni di intervento</div>
                <button
                  onClick={() => copyPrompt(searchResult.prompt, searchResult.code)}
                  className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition ${
                    copiedCode === searchResult.code ? "bg-green-100 text-green-700" : "bg-[#1e3a5f] hover:bg-[#2563eb] text-white"
                  }`}
                >
                  {copiedCode === searchResult.code ? <><Check size={13} /> Copiato!</> : <><Copy size={13} /> Copia</>}
                </button>
              </div>
              <div className="text-xs font-mono bg-gray-50 border-2 border-blue-400 rounded-lg px-4 py-3 text-gray-700 leading-relaxed whitespace-pre-wrap">
                {searchResult.prompt}
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
                <th className="px-4 py-2.5 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {allCodes.map((c, i) => {
                const isExpanded = expandedCode === c.code
                return (
                  <>
                    <tr
                      key={c.code}
                      onClick={() => toggleExpand(c.code)}
                      className={`border-b border-gray-100 cursor-pointer transition ${
                        isExpanded
                          ? "bg-[#1e3a5f]/5 border-b-0"
                          : i % 2 === 0 ? "bg-white hover:bg-blue-50/30" : "bg-gray-50/50 hover:bg-blue-50/30"
                      }`}
                    >
                      <td className="px-4 py-2.5 font-mono font-bold text-[#1e3a5f]">{c.code}</td>
                      <td className="px-4 py-2.5">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded ${MODULE_COLORS[c.module] || "bg-gray-100 text-gray-500"}`}>
                          {c.module}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-gray-600">{c.description}</td>
                      <td className="px-4 py-2.5 text-gray-400">
                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </td>
                    </tr>

                    {isExpanded && expandedData && (
                      <tr key={`${c.code}-detail`} className="bg-[#1e3a5f]/5 border-b border-gray-200">
                        <td colSpan={4} className="px-5 py-4">
                          <div className="space-y-3">
                            <div>
                              <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Problema segnalato</div>
                              <div className="text-xs font-medium text-gray-800">{expandedData.description}</div>
                            </div>
                            <div>
                              <div className="flex items-center justify-between mb-1.5">
                                <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Istruzioni di intervento</div>
                                <button
                                  onClick={e => { e.stopPropagation(); copyPrompt(expandedData.prompt, c.code) }}
                                  className={`flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg transition ${
                                    copiedCode === c.code ? "bg-green-100 text-green-700" : "bg-[#1e3a5f] hover:bg-[#2563eb] text-white"
                                  }`}
                                >
                                  {copiedCode === c.code ? <><Check size={11} /> Copiato!</> : <><Copy size={11} /> Copia</>}
                                </button>
                              </div>
                              <div className="text-[11px] font-mono bg-white border-2 border-blue-400 rounded-lg px-4 py-3 text-gray-700 leading-relaxed whitespace-pre-wrap">
                                {expandedData.prompt}
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
