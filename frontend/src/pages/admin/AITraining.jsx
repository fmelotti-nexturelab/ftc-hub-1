import { useState, useMemo } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Save, CheckCircle, AlertCircle, Loader2, Search, RotateCcw } from "lucide-react"
import { ticketConfigApi } from "@/api/ticketConfig"

const PRIORITIES = ["critical", "high", "medium", "low"]
const PRIORITY_LABELS = { critical: "Critica", high: "Alta", medium: "Media", low: "Bassa" }

export default function AITraining() {
  const qc = useQueryClient()
  const [search, setSearch] = useState("")
  const [filterCat, setFilterCat] = useState("")
  const [filterStatus, setFilterStatus] = useState("")
  const [state, setState] = useState(null)
  const [saveResult, setSaveResult] = useState(null)

  const { data: rawTickets = [], isLoading } = useQuery({
    queryKey: ["training-tickets"],
    queryFn: () => ticketConfigApi.getTrainingTickets(300).then(r => r.data),
  })

  const { data: categories = [] } = useQuery({
    queryKey: ["admin-categories"],
    queryFn: () => ticketConfigApi.adminGetCategories().then(r => r.data),
  })

  const { data: allSubcategories = [] } = useQuery({
    queryKey: ["admin-all-subcategories"],
    queryFn: () => ticketConfigApi.adminGetSubcategories().then(r => r.data),
  })

  const { data: teams = [] } = useQuery({
    queryKey: ["admin-teams"],
    queryFn: () => ticketConfigApi.getTeams().then(r => r.data),
  })

  // Inizializza stato al primo caricamento
  if (rawTickets.length > 0 && !state) {
    setState(rawTickets.map(t => ({
      ...t,
      new_category_id: t.category_id,
      new_subcategory_id: t.subcategory_id,
      new_team_id: t.team_id,
      new_priority: t.priority,
      reviewed: false,
    })))
  }

  const items = state || []

  const modified = useMemo(() => items.filter(i =>
    i.new_category_id !== i.category_id || i.new_subcategory_id !== i.subcategory_id ||
    i.new_team_id !== i.team_id || i.new_priority !== i.priority
  ).length, [items])

  const reviewed = useMemo(() => items.filter(i => i.reviewed).length, [items])

  const filtered = useMemo(() => items.filter(i => {
    if (search) {
      const q = search.toLowerCase()
      if (!i.title.toLowerCase().includes(q) && !(i.description || "").toLowerCase().includes(q)) return false
    }
    if (filterCat && i.new_category_id !== parseInt(filterCat)) return false
    if (filterStatus === "modified" && i.new_category_id === i.category_id && i.new_subcategory_id === i.subcategory_id && i.new_team_id === i.team_id && i.new_priority === i.priority) return false
    if (filterStatus === "reviewed" && !i.reviewed) return false
    if (filterStatus === "pending" && i.reviewed) return false
    return true
  }), [items, search, filterCat, filterStatus])

  function update(idx, field, value) {
    setState(prev => prev.map((item, i) => {
      if (i !== idx) return item
      const next = { ...item, [field]: value }
      if (field === "new_category_id") next.new_subcategory_id = null
      return next
    }))
  }

  function toggleReviewed(idx) {
    setState(prev => prev.map((item, i) => i === idx ? { ...item, reviewed: !item.reviewed } : item))
  }

  function markAllReviewed() {
    setState(prev => prev.map(item => ({ ...item, reviewed: true })))
  }

  function resetAll() {
    setState(rawTickets.map(t => ({
      ...t,
      new_category_id: t.category_id,
      new_subcategory_id: t.subcategory_id,
      new_team_id: t.team_id,
      new_priority: t.priority,
      reviewed: false,
    })))
    setSaveResult(null)
  }

  const saveMutation = useMutation({
    mutationFn: () => {
      const examples = items.filter(i => i.reviewed).map(i => ({
        title: i.title,
        description: i.description,
        category_name: categories.find(c => c.id === i.new_category_id)?.name || null,
        subcategory_name: allSubcategories.find(s => s.id === i.new_subcategory_id)?.name || null,
        team_name: teams.find(t => t.id === i.new_team_id)?.name || null,
        priority: i.new_priority,
      }))
      return ticketConfigApi.saveTraining(examples).then(r => r.data)
    },
    onSuccess: (data) => setSaveResult(data),
  })

  const selectClass = "px-2 py-1 border border-gray-300 rounded text-xs bg-white focus:ring-1 focus:ring-[#2563eb] outline-none"

  if (isLoading) {
    return (
      <div className="py-16 text-center text-gray-400 text-sm">
        <Loader2 size={20} className="animate-spin mx-auto mb-2" />
        Caricamento ticket...
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Info + azioni */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-700">
        Rivedi le assegnazioni dei ticket. Correggi categoria, sottocategoria, team e priorità dove necessario,
        poi segna come "OK" e salva. L'assistente AI userà questi esempi per migliorare le sue previsioni.
      </div>

      {/* Filtri + bottoni */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative">
          <label htmlFor="training-search" className="sr-only">Cerca</label>
          <input id="training-search" type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Cerca..." className="w-40 pl-8 pr-3 py-1.5 border border-gray-300 rounded-lg text-xs bg-white focus:ring-1 focus:ring-[#2563eb] outline-none" />
          <Search size={12} className="absolute left-2.5 top-2 text-gray-400" />
        </div>
        <select value={filterCat} onChange={e => setFilterCat(e.target.value)} className={selectClass}>
          <option value="">Tutte le categorie</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className={selectClass}>
          <option value="">Tutti</option>
          <option value="modified">Modificati</option>
          <option value="reviewed">Revisionati</option>
          <option value="pending">Da revisionare</option>
        </select>
        {(search || filterCat || filterStatus) && (
          <button onClick={() => { setSearch(""); setFilterCat(""); setFilterStatus("") }} className="text-xs text-gray-400 hover:text-gray-600 underline">Reset filtri</button>
        )}

        <span className="text-xs text-gray-400 ml-auto">
          {reviewed}/{items.length} revisionati — {modified} modificati
        </span>

        <button onClick={markAllReviewed} className="text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition">
          Segna tutti OK
        </button>
        <button onClick={resetAll} className="text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition">
          <RotateCcw size={12} className="inline mr-1" />Reset
        </button>
        <button
          onClick={() => saveMutation.mutate()}
          disabled={reviewed === 0 || saveMutation.isPending}
          className="flex items-center gap-1.5 text-xs bg-[#1e3a5f] hover:bg-[#2563eb] text-white px-4 py-1.5 rounded-lg shadow transition disabled:opacity-40"
        >
          {saveMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
          Salva training ({reviewed})
        </button>
      </div>

      {saveResult && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-xs text-green-700">
          <CheckCircle size={14} />
          {saveResult.message}
        </div>
      )}

      {/* Tabella */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 text-gray-600 font-semibold">
              <th scope="col" className="px-3 py-2.5 text-left w-8">OK</th>
              <th scope="col" className="px-3 py-2.5 text-left w-12">#</th>
              <th scope="col" className="px-3 py-2.5 text-left w-48">Titolo</th>
              <th scope="col" className="px-3 py-2.5 text-left">Descrizione</th>
              <th scope="col" className="px-3 py-2.5 text-left w-36">Categoria</th>
              <th scope="col" className="px-3 py-2.5 text-left w-40">Sottocategoria</th>
              <th scope="col" className="px-3 py-2.5 text-left w-32">Team</th>
              <th scope="col" className="px-3 py-2.5 text-left w-24">Priorità</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((item) => {
              const idx = items.indexOf(item)
              const isModified = item.new_category_id !== item.category_id || item.new_subcategory_id !== item.subcategory_id || item.new_team_id !== item.team_id || item.new_priority !== item.priority
              const subcats = allSubcategories.filter(s => s.category_id === item.new_category_id)

              return (
                <tr key={item.id} className={`border-b border-gray-100 ${item.reviewed ? "bg-green-50/60" : isModified ? "bg-amber-50/60" : ""}`}>
                  <td className="px-3 py-2">
                    <button
                      onClick={() => toggleReviewed(idx)}
                      aria-label={item.reviewed ? "Segna come non revisionato" : "Segna come revisionato"}
                      className={`w-6 h-6 rounded border-2 flex items-center justify-center text-xs transition ${
                        item.reviewed ? "border-green-500 bg-green-100 text-green-600" : "border-gray-300 hover:border-gray-400"
                      }`}
                    >
                      {item.reviewed && "✓"}
                    </button>
                  </td>
                  <td className="px-3 py-2 text-gray-400">#{String(item.ticket_number).padStart(4, "0")}</td>
                  <td className="px-3 py-2 font-medium text-gray-800 truncate max-w-[200px]">{item.title}</td>
                  <td className="px-3 py-2 text-gray-500 truncate max-w-[250px]" title={item.description}>{item.description}</td>
                  <td className="px-3 py-2">
                    <select value={item.new_category_id || ""} onChange={e => update(idx, "new_category_id", parseInt(e.target.value))}
                      className={`${selectClass} w-full ${item.new_category_id !== item.category_id ? "border-amber-400 bg-amber-50" : ""}`}>
                      {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <select value={item.new_subcategory_id || ""} onChange={e => update(idx, "new_subcategory_id", e.target.value ? parseInt(e.target.value) : null)}
                      className={`${selectClass} w-full ${item.new_subcategory_id !== item.subcategory_id ? "border-amber-400 bg-amber-50" : ""}`}>
                      <option value="">—</option>
                      {subcats.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <select value={item.new_team_id || ""} onChange={e => update(idx, "new_team_id", e.target.value ? parseInt(e.target.value) : null)}
                      className={`${selectClass} w-full ${item.new_team_id !== item.team_id ? "border-amber-400 bg-amber-50" : ""}`}>
                      <option value="">—</option>
                      {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <select value={item.new_priority} onChange={e => update(idx, "new_priority", e.target.value)}
                      className={`${selectClass} w-full ${item.new_priority !== item.priority ? "border-amber-400 bg-amber-50" : ""}`}>
                      {PRIORITIES.map(p => <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>)}
                    </select>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="py-12 text-center text-gray-400 text-sm">Nessun ticket trovato.</div>
        )}
      </div>
    </div>
  )
}
