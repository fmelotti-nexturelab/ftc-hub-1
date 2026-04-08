import { useState, useMemo } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Save, CheckCircle, AlertCircle, Loader2, Search, RotateCcw, Trash2, Pencil, X, Check, Eye, EyeOff, ChevronDown, ChevronRight } from "lucide-react"
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
  const [includeDesc, setIncludeDesc] = useState(false)

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
      return ticketConfigApi.saveTraining(examples, includeDesc).then(r => r.data)
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
        <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer select-none border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition">
          <input
            type="checkbox"
            checked={includeDesc}
            onChange={e => setIncludeDesc(e.target.checked)}
            className="rounded border-gray-300 text-[#1e3a5f] focus:ring-[#2563eb]"
          />
          Includi descrizione
        </label>
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
              <th scope="col" className="px-3 py-2.5 text-left w-72">Titolo</th>
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
                  <td className="px-3 py-2 font-medium text-gray-800 truncate max-w-[300px]" title={item.title}>{item.title}</td>
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

      {/* ── Pannello esempi attivi ── */}
      <TrainingExamplesPanel />
    </div>
  )
}


// ── Pannello gestione esempi di training attivi ──────────────────────────────

function TrainingExamplesPanel() {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [searchEx, setSearchEx] = useState("")
  const [filterCatEx, setFilterCatEx] = useState("")
  const [filterActiveEx, setFilterActiveEx] = useState("")
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)

  const { data: examples = [], isLoading } = useQuery({
    queryKey: ["training-examples"],
    queryFn: () => ticketConfigApi.getTrainingExamples().then(r => r.data),
    enabled: open,
  })

  const toggleMutation = useMutation({
    mutationFn: (id) => ticketConfigApi.toggleTrainingExample(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["training-examples"] }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => ticketConfigApi.deleteTrainingExample(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["training-examples"] }); setConfirmDeleteId(null) },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => ticketConfigApi.updateTrainingExample(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["training-examples"] }); setEditingId(null) },
  })

  const filtered = useMemo(() => examples.filter(ex => {
    if (searchEx) {
      const q = searchEx.toLowerCase()
      if (!ex.title.toLowerCase().includes(q) && !(ex.description || "").toLowerCase().includes(q)) return false
    }
    if (filterCatEx && ex.category_name !== filterCatEx) return false
    if (filterActiveEx === "active" && !ex.is_active) return false
    if (filterActiveEx === "inactive" && ex.is_active) return false
    return true
  }), [examples, searchEx, filterCatEx, filterActiveEx])

  const categoryNames = useMemo(() => [...new Set(examples.map(e => e.category_name))].sort(), [examples])
  const activeCount = examples.filter(e => e.is_active).length

  function startEdit(ex) {
    setEditingId(ex.id)
    setEditForm({
      title: ex.title,
      description: ex.description || "",
      category_name: ex.category_name,
      subcategory_name: ex.subcategory_name || "",
      team_name: ex.team_name || "",
      priority: ex.priority,
    })
  }

  function saveEdit() {
    const data = { ...editForm }
    if (!data.subcategory_name) data.subcategory_name = null
    if (!data.team_name) data.team_name = null
    updateMutation.mutate({ id: editingId, data })
  }

  const selectClass = "px-2 py-1 border border-gray-300 rounded text-xs bg-white focus:ring-1 focus:ring-[#2563eb] outline-none"

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-5 py-4 text-left hover:bg-gray-50 transition rounded-xl"
        aria-expanded={open}
      >
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        <span className="font-bold text-gray-800">Istruzioni AI attive</span>
        <span className="text-xs text-gray-400 ml-2">
          {examples.length > 0 ? `${activeCount} attivi / ${examples.length} totali` : ""}
        </span>
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-3">
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700">
            Questi sono gli esempi che l'AI usa come riferimento per classificare i ticket.
            Puoi modificarli, disattivarli temporaneamente o eliminarli.
          </div>

          {/* Filtri */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <label htmlFor="examples-search" className="sr-only">Cerca negli esempi</label>
              <input id="examples-search" type="text" value={searchEx} onChange={e => setSearchEx(e.target.value)}
                placeholder="Cerca..." className="w-40 pl-8 pr-3 py-1.5 border border-gray-300 rounded-lg text-xs bg-white focus:ring-1 focus:ring-[#2563eb] outline-none" />
              <Search size={12} className="absolute left-2.5 top-2 text-gray-400" aria-hidden="true" />
            </div>
            <label htmlFor="examples-filter-cat" className="sr-only">Filtra per categoria</label>
            <select id="examples-filter-cat" value={filterCatEx} onChange={e => setFilterCatEx(e.target.value)} className={selectClass}>
              <option value="">Tutte le categorie</option>
              {categoryNames.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <label htmlFor="examples-filter-status" className="sr-only">Filtra per stato</label>
            <select id="examples-filter-status" value={filterActiveEx} onChange={e => setFilterActiveEx(e.target.value)} className={selectClass}>
              <option value="">Tutti</option>
              <option value="active">Attivi</option>
              <option value="inactive">Disattivati</option>
            </select>
            {(searchEx || filterCatEx || filterActiveEx) && (
              <button onClick={() => { setSearchEx(""); setFilterCatEx(""); setFilterActiveEx("") }}
                className="text-xs text-gray-400 hover:text-gray-600 underline">Reset filtri</button>
            )}
            <span className="text-xs text-gray-400 ml-auto">{filtered.length} risultati</span>
          </div>

          {isLoading ? (
            <div className="py-8 text-center text-gray-400 text-sm">
              <Loader2 size={18} className="animate-spin mx-auto mb-2" />
              Caricamento...
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-gray-600 font-semibold">
                    <th scope="col" className="px-3 py-2.5 text-left w-8">Stato</th>
                    <th scope="col" className="px-3 py-2.5 text-left">Titolo</th>
                    <th scope="col" className="px-3 py-2.5 text-left">Descrizione</th>
                    <th scope="col" className="px-3 py-2.5 text-left w-32">Categoria</th>
                    <th scope="col" className="px-3 py-2.5 text-left w-40">Sottocategoria</th>
                    <th scope="col" className="px-3 py-2.5 text-left w-28">Team</th>
                    <th scope="col" className="px-3 py-2.5 text-left w-20">Priorità</th>
                    <th scope="col" className="px-3 py-2.5 text-right w-24">Azioni</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(ex => (
                    <tr key={ex.id} className={`border-b border-gray-100 ${!ex.is_active ? "opacity-40" : ""} ${editingId === ex.id ? "bg-blue-50/50" : ""}`}>
                      {editingId === ex.id ? (
                        <>
                          <td className="px-3 py-2">
                            <button onClick={() => toggleMutation.mutate(ex.id)}
                              aria-label={ex.is_active ? "Disattiva esempio" : "Attiva esempio"}
                              className="text-gray-400 hover:text-gray-600">
                              {ex.is_active ? <Eye size={14} /> : <EyeOff size={14} />}
                            </button>
                          </td>
                          <td className="px-3 py-1.5">
                            <label htmlFor={`edit-title-${ex.id}`} className="sr-only">Titolo</label>
                            <input id={`edit-title-${ex.id}`} type="text" value={editForm.title}
                              onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
                              className="w-full px-2 py-1 border border-blue-300 rounded text-xs bg-white focus:ring-1 focus:ring-[#2563eb] outline-none" />
                          </td>
                          <td className="px-3 py-1.5">
                            <label htmlFor={`edit-desc-${ex.id}`} className="sr-only">Descrizione</label>
                            <input id={`edit-desc-${ex.id}`} type="text" value={editForm.description}
                              onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                              className="w-full px-2 py-1 border border-blue-300 rounded text-xs bg-white focus:ring-1 focus:ring-[#2563eb] outline-none"
                              placeholder="Opzionale" />
                          </td>
                          <td className="px-3 py-1.5">
                            <label htmlFor={`edit-cat-${ex.id}`} className="sr-only">Categoria</label>
                            <input id={`edit-cat-${ex.id}`} type="text" value={editForm.category_name}
                              onChange={e => setEditForm(f => ({ ...f, category_name: e.target.value }))}
                              className="w-full px-2 py-1 border border-blue-300 rounded text-xs bg-white focus:ring-1 focus:ring-[#2563eb] outline-none" />
                          </td>
                          <td className="px-3 py-1.5">
                            <label htmlFor={`edit-subcat-${ex.id}`} className="sr-only">Sottocategoria</label>
                            <input id={`edit-subcat-${ex.id}`} type="text" value={editForm.subcategory_name}
                              onChange={e => setEditForm(f => ({ ...f, subcategory_name: e.target.value }))}
                              className="w-full px-2 py-1 border border-blue-300 rounded text-xs bg-white focus:ring-1 focus:ring-[#2563eb] outline-none" />
                          </td>
                          <td className="px-3 py-1.5">
                            <label htmlFor={`edit-team-${ex.id}`} className="sr-only">Team</label>
                            <input id={`edit-team-${ex.id}`} type="text" value={editForm.team_name}
                              onChange={e => setEditForm(f => ({ ...f, team_name: e.target.value }))}
                              className="w-full px-2 py-1 border border-blue-300 rounded text-xs bg-white focus:ring-1 focus:ring-[#2563eb] outline-none" />
                          </td>
                          <td className="px-3 py-1.5">
                            <label htmlFor={`edit-priority-${ex.id}`} className="sr-only">Priorità</label>
                            <select id={`edit-priority-${ex.id}`} value={editForm.priority}
                              onChange={e => setEditForm(f => ({ ...f, priority: e.target.value }))}
                              className={selectClass}>
                              {PRIORITIES.map(p => <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>)}
                            </select>
                          </td>
                          <td className="px-3 py-2 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button onClick={saveEdit} className="text-green-600 hover:text-green-800 p-1" aria-label="Salva modifiche">
                                {updateMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                              </button>
                              <button onClick={() => setEditingId(null)} className="text-gray-400 hover:text-gray-600 p-1" aria-label="Annulla modifica">
                                <X size={13} />
                              </button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-3 py-2">
                            <button onClick={() => toggleMutation.mutate(ex.id)}
                              aria-label={ex.is_active ? "Disattiva esempio" : "Attiva esempio"}
                              className={`transition ${ex.is_active ? "text-green-500 hover:text-green-700" : "text-gray-300 hover:text-gray-500"}`}>
                              {ex.is_active ? <Eye size={14} /> : <EyeOff size={14} />}
                            </button>
                          </td>
                          <td className="px-3 py-2 font-medium text-gray-800 truncate max-w-[250px]" title={ex.title}>{ex.title}</td>
                          <td className="px-3 py-2 text-gray-500 truncate max-w-[200px]" title={ex.description || ""}>{ex.description || "—"}</td>
                          <td className="px-3 py-2 text-gray-600">{ex.category_name}</td>
                          <td className="px-3 py-2 text-gray-500">{ex.subcategory_name || "—"}</td>
                          <td className="px-3 py-2 text-gray-500">{ex.team_name || "—"}</td>
                          <td className="px-3 py-2">
                            <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
                              ex.priority === "critical" ? "bg-red-100 text-red-700" :
                              ex.priority === "high" ? "bg-orange-100 text-orange-700" :
                              ex.priority === "medium" ? "bg-yellow-100 text-yellow-700" :
                              "bg-gray-100 text-gray-600"
                            }`}>
                              {PRIORITY_LABELS[ex.priority] || ex.priority}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button onClick={() => startEdit(ex)} className="text-gray-400 hover:text-[#2563eb] p-1 transition" aria-label="Modifica esempio">
                                <Pencil size={13} />
                              </button>
                              {confirmDeleteId === ex.id ? (
                                <>
                                  <button onClick={() => deleteMutation.mutate(ex.id)} className="text-red-600 hover:text-red-800 p-1" aria-label="Conferma eliminazione">
                                    <Check size={13} />
                                  </button>
                                  <button onClick={() => setConfirmDeleteId(null)} className="text-gray-400 hover:text-gray-600 p-1" aria-label="Annulla eliminazione">
                                    <X size={13} />
                                  </button>
                                </>
                              ) : (
                                <button onClick={() => setConfirmDeleteId(ex.id)} className="text-gray-400 hover:text-red-500 p-1 transition" aria-label="Elimina esempio">
                                  <Trash2 size={13} />
                                </button>
                              )}
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
              {filtered.length === 0 && !isLoading && (
                <div className="py-8 text-center text-gray-400 text-sm">Nessun esempio trovato.</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
