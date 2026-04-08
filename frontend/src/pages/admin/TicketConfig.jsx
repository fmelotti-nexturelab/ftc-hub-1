import { useState, useRef, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import * as Tabs from "@radix-ui/react-tabs"
import { Plus, Pencil, Trash2, ChevronRight, ChevronDown, Users, AlertCircle, Check, X, Search, LogOut } from "lucide-react"
import { ticketConfigApi } from "@/api/ticketConfig"
import { ticketsApi } from "@/api/tickets"

// ── Helpers ──────────────────────────────────────────────────────────────────

const PRIORITIES = ["low", "medium", "high", "critical"]

function ConfirmDelete({ label, onConfirm, onCancel }) {
  return (
    <span className="flex items-center gap-1">
      <span className="text-xs text-red-600 font-medium">Confermi?</span>
      <button onClick={onConfirm} className="text-red-600 hover:text-red-800 transition p-0.5">
        <Check size={13} />
      </button>
      <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 transition p-0.5">
        <X size={13} />
      </button>
    </span>
  )
}

// ── UserCombobox (ricerca dinamica) ──────────────────────────────────────────

function UserCombobox({ users, value, onChange, placeholder = "Cerca utente...", className = "" }) {
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  const selected = users.find(u => u.id === value)
  const filtered = query
    ? users.filter(u => (u.full_name || u.username).toLowerCase().includes(query.toLowerCase()))
    : users

  return (
    <div ref={ref} className="relative">
      <div
        className={`flex items-center gap-1 ${className}`}
        onClick={() => setOpen(true)}
      >
        <input
          type="text"
          value={open ? query : (selected ? (selected.full_name || selected.username) : "")}
          onChange={e => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => { setQuery(""); setOpen(true) }}
          placeholder={selected ? (selected.full_name || selected.username) : placeholder}
          className="w-full bg-transparent outline-none text-sm"
          aria-label="Cerca utente backup 2"
        />
        {value && (
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onChange(""); setQuery("") }}
            className="text-gray-400 hover:text-gray-600 shrink-0"
            aria-label="Rimuovi utente backup 2"
          >
            <X size={14} />
          </button>
        )}
      </div>
      {open && (
        <ul className="absolute z-50 mt-1 w-full max-h-48 overflow-auto bg-white border border-gray-200 rounded-lg shadow-lg text-sm">
          <li>
            <button
              type="button"
              className="w-full text-left px-3 py-1.5 text-gray-400 hover:bg-gray-50"
              onClick={() => { onChange(""); setQuery(""); setOpen(false) }}
            >
              Nessun backup
            </button>
          </li>
          {filtered.length === 0 && (
            <li className="px-3 py-2 text-gray-400 text-xs">Nessun risultato</li>
          )}
          {filtered.map(u => (
            <li key={u.id}>
              <button
                type="button"
                className={`w-full text-left px-3 py-1.5 hover:bg-blue-50 transition ${u.id === value ? "bg-blue-50 font-medium text-[#1e3a5f]" : ""}`}
                onClick={() => { onChange(u.id); setQuery(""); setOpen(false) }}
              >
                {u.full_name || u.username}
                {u.department && <span className="ml-1 text-xs text-gray-400">({u.department})</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ── MultiUserSelect ───────────────────────────────────────────────────────────

function MultiUserSelect({ users, selected, onChange }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [dropPos, setDropPos] = useState({ top: 0, left: 0, width: 0 })
  const triggerRef = useRef(null)
  const dropRef = useRef(null)

  useEffect(() => {
    const handler = (e) => {
      if (
        triggerRef.current && !triggerRef.current.contains(e.target) &&
        dropRef.current && !dropRef.current.contains(e.target)
      ) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  const handleOpen = () => {
    if (!open && triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect()
      const dropHeight = 280 // max altezza stimata dropdown
      const spaceBelow = window.innerHeight - r.bottom
      const openUpward = spaceBelow < dropHeight
      if (openUpward) {
        setDropPos({ bottom: window.innerHeight - r.top + 4, top: "auto", left: r.left, width: r.width })
      } else {
        setDropPos({ top: r.bottom + 4, bottom: "auto", left: r.left, width: r.width })
      }
    }
    setOpen(v => !v)
  }

  const filtered = users.filter(u =>
    (u.full_name || u.username).toLowerCase().includes(search.toLowerCase())
  )

  const toggle = (id) => {
    const next = new Set(selected)
    next.has(id) ? next.delete(id) : next.add(id)
    onChange(next)
  }

  const label = selected.size === 0
    ? "Seleziona utenti..."
    : `${selected.size} utente${selected.size > 1 ? "i" : ""} selezionato${selected.size > 1 ? "i" : ""}`

  return (
    <div className="relative flex-1">
      <button
        ref={triggerRef}
        type="button"
        onClick={handleOpen}
        className="w-full flex items-center justify-between text-xs px-3 py-2 border border-gray-300 rounded-lg bg-white hover:border-[#2563eb] outline-none text-left transition"
      >
        <span className={selected.size === 0 ? "text-gray-400" : "text-gray-700 font-medium"}>
          {label}
        </span>
        <ChevronDown size={13} className="text-gray-400 shrink-0" />
      </button>

      {open && (
        <div
          ref={dropRef}
          style={{ position: "fixed", top: dropPos.top, bottom: dropPos.bottom, left: dropPos.left, width: dropPos.width, zIndex: 9999 }}
          className="bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden"
        >
          {/* Search */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100">
            <Search size={13} className="text-gray-400 shrink-0" />
            <input
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Cerca per nome..."
              className="flex-1 text-xs outline-none bg-transparent"
            />
            {search && (
              <button onClick={() => setSearch("")} className="text-gray-300 hover:text-gray-500">
                <X size={12} />
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-60 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">Nessun utente trovato</p>
            ) : (
              filtered.map(u => {
                const checked = selected.has(u.id)
                return (
                  <div
                    key={u.id}
                    onClick={() => toggle(u.id)}
                    className={`flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-blue-50 transition ${checked ? "bg-blue-50/70" : ""}`}
                  >
                    <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition ${checked ? "bg-[#1e3a5f] border-[#1e3a5f]" : "border-gray-300"}`}>
                      {checked && <Check size={10} className="text-white" />}
                    </div>
                    <div className="w-6 h-6 rounded-full bg-[#1e3a5f]/10 flex items-center justify-center text-[10px] font-bold text-[#1e3a5f] shrink-0">
                      {(u.full_name || u.username)[0].toUpperCase()}
                    </div>
                    <span className="text-xs text-gray-700">{u.full_name || u.username}</span>
                  </div>
                )
              })
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-gray-100 px-3 py-2 flex justify-between items-center bg-gray-50">
            <span className="text-xs text-gray-400">{selected.size > 0 ? `${selected.size} selezionati` : `${filtered.length} disponibili`}</span>
            {selected.size > 0 && (
              <button onClick={() => onChange(new Set())} className="text-xs text-gray-400 hover:text-gray-600 underline">
                Deseleziona tutti
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── TAB 1: Categorie & Sottocategorie ─────────────────────────────────────────

function CategoriesTab() {
  const qc = useQueryClient()
  const [selectedCatId, setSelectedCatId] = useState(null)
  const [editingCat, setEditingCat] = useState(null)        // null | "new" | {id, name, ...}
  const [editingSub, setEditingSub] = useState(null)        // null | "new" | {id, name, ...}
  const [confirmDelete, setConfirmDelete] = useState(null)  // "cat-{id}" | "sub-{id}"

  const [catForm, setCatForm] = useState({ name: "", description: "", sort_order: 0 })
  const [subForm, setSubForm] = useState({ name: "", description: "", sort_order: 0 })

  const { data: categories = [] } = useQuery({
    queryKey: ["admin-categories"],
    queryFn: () => ticketConfigApi.adminGetCategories().then(r => r.data),
  })

  const { data: subcategories = [] } = useQuery({
    queryKey: ["admin-subcategories", selectedCatId],
    queryFn: () => ticketConfigApi.getSubcategories(selectedCatId).then(r => r.data),
    enabled: !!selectedCatId,
  })

  const createCat = useMutation({
    mutationFn: (data) => ticketConfigApi.createCategory(data),
    onSuccess: () => { qc.invalidateQueries(["admin-categories"]); setEditingCat(null) },
  })
  const updateCat = useMutation({
    mutationFn: ({ id, data }) => ticketConfigApi.updateCategory(id, data),
    onSuccess: () => { qc.invalidateQueries(["admin-categories"]); setEditingCat(null) },
  })
  const deleteCat = useMutation({
    mutationFn: (id) => ticketConfigApi.deleteCategory(id),
    onSuccess: () => { qc.invalidateQueries(["admin-categories"]); setConfirmDelete(null) },
  })

  const createSub = useMutation({
    mutationFn: (data) => ticketConfigApi.createSubcategory(data),
    onSuccess: () => { qc.invalidateQueries(["admin-subcategories", selectedCatId]); setEditingSub(null) },
  })
  const updateSub = useMutation({
    mutationFn: ({ id, data }) => ticketConfigApi.updateSubcategory(id, data),
    onSuccess: () => { qc.invalidateQueries(["admin-subcategories", selectedCatId]); setEditingSub(null) },
  })
  const deleteSub = useMutation({
    mutationFn: (id) => ticketConfigApi.deleteSubcategory(id),
    onSuccess: () => { qc.invalidateQueries(["admin-subcategories", selectedCatId]); setConfirmDelete(null) },
  })

  const selectedCat = categories.find(c => c.id === selectedCatId)

  const inputClass = "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2563eb] focus:border-transparent outline-none transition text-sm"

  return (
    <div className="grid grid-cols-2 gap-5">
      {/* Colonna sinistra: Categorie */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-700 text-sm">Categorie</h3>
          <button
            onClick={() => { setEditingCat("new"); setCatForm({ name: "", description: "", sort_order: 0 }) }}
            className="flex items-center gap-1 text-xs bg-[#1e3a5f] hover:bg-[#2563eb] text-white px-3 py-1.5 rounded-lg transition"
          >
            <Plus size={13} /> Nuova
          </button>
        </div>

        {editingCat === "new" && (
          <div className="border border-blue-200 bg-blue-50 rounded-lg p-3 space-y-2">
            <input placeholder="Nome *" value={catForm.name} onChange={e => setCatForm(f => ({ ...f, name: e.target.value }))} className={inputClass} />
            <input placeholder="Descrizione" value={catForm.description} onChange={e => setCatForm(f => ({ ...f, description: e.target.value }))} className={inputClass} />
            <input type="number" placeholder="Ordine" value={catForm.sort_order} onChange={e => setCatForm(f => ({ ...f, sort_order: parseInt(e.target.value) || 0 }))} className={inputClass} />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setEditingCat(null)} className="text-xs text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition">Annulla</button>
              <button
                onClick={() => createCat.mutate(catForm)}
                disabled={!catForm.name || createCat.isPending}
                className="text-xs bg-[#1e3a5f] hover:bg-[#2563eb] text-white px-3 py-1.5 rounded-lg transition disabled:opacity-40"
              >
                Salva
              </button>
            </div>
          </div>
        )}

        <div className="space-y-1">
          {categories.map(cat => (
            <div key={cat.id}>
              {editingCat && editingCat !== "new" && editingCat.id === cat.id ? (
                <div className="border border-blue-200 bg-blue-50 rounded-lg p-3 space-y-2">
                  <input value={catForm.name} onChange={e => setCatForm(f => ({ ...f, name: e.target.value }))} className={inputClass} />
                  <input placeholder="Descrizione" value={catForm.description} onChange={e => setCatForm(f => ({ ...f, description: e.target.value }))} className={inputClass} />
                  <input type="number" value={catForm.sort_order} onChange={e => setCatForm(f => ({ ...f, sort_order: parseInt(e.target.value) || 0 }))} className={inputClass} />
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => setEditingCat(null)} className="text-xs text-gray-500 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition">Annulla</button>
                    <button
                      onClick={() => updateCat.mutate({ id: cat.id, data: catForm })}
                      className="text-xs bg-[#1e3a5f] hover:bg-[#2563eb] text-white px-3 py-1.5 rounded-lg transition"
                    >
                      Salva
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => setSelectedCatId(cat.id === selectedCatId ? null : cat.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition text-sm ${
                    selectedCatId === cat.id ? "bg-[#1e3a5f] text-white" : "hover:bg-gray-50 text-gray-700"
                  }`}
                >
                  {selectedCatId === cat.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  <span className="flex-1 font-medium">{cat.name}</span>
                  {!cat.is_active && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-gray-200 text-gray-500 rounded">inattiva</span>
                  )}
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${selectedCatId === cat.id ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"}`}>
                    {cat.subcategory_count}
                  </span>
                  <button
                    onClick={e => { e.stopPropagation(); setEditingCat(cat); setCatForm({ name: cat.name, description: cat.description || "", sort_order: cat.sort_order }) }}
                    className={`p-1 rounded hover:bg-white/20 transition ${selectedCatId === cat.id ? "text-white/70 hover:text-white" : "text-gray-400 hover:text-gray-600"}`}
                  >
                    <Pencil size={12} />
                  </button>
                  {confirmDelete === `cat-${cat.id}` ? (
                    <span onClick={e => e.stopPropagation()}>
                      <ConfirmDelete
                        onConfirm={() => deleteCat.mutate(cat.id)}
                        onCancel={() => setConfirmDelete(null)}
                      />
                    </span>
                  ) : (
                    <button
                      onClick={e => { e.stopPropagation(); setConfirmDelete(`cat-${cat.id}`) }}
                      className={`p-1 rounded transition ${selectedCatId === cat.id ? "text-white/50 hover:text-white" : "text-gray-300 hover:text-red-500"}`}
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
          {categories.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-4">Nessuna categoria</p>
          )}
        </div>
      </div>

      {/* Colonna destra: Sottocategorie */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-700 text-sm">
            Sottocategorie
            {selectedCat && <span className="ml-2 text-gray-400 font-normal">— {selectedCat.name}</span>}
          </h3>
          {selectedCatId && (
            <button
              onClick={() => { setEditingSub("new"); setSubForm({ name: "", description: "", sort_order: 0 }) }}
              className="flex items-center gap-1 text-xs bg-[#1e3a5f] hover:bg-[#2563eb] text-white px-3 py-1.5 rounded-lg transition"
            >
              <Plus size={13} /> Nuova
            </button>
          )}
        </div>

        {!selectedCatId ? (
          <p className="text-xs text-gray-400 text-center py-8">Seleziona una categoria a sinistra</p>
        ) : (
          <>
            {editingSub === "new" && (
              <div className="border border-blue-200 bg-blue-50 rounded-lg p-3 space-y-2">
                <input placeholder="Nome *" value={subForm.name} onChange={e => setSubForm(f => ({ ...f, name: e.target.value }))} className={inputClass} />
                <input placeholder="Descrizione" value={subForm.description} onChange={e => setSubForm(f => ({ ...f, description: e.target.value }))} className={inputClass} />
                <input type="number" placeholder="Ordine" value={subForm.sort_order} onChange={e => setSubForm(f => ({ ...f, sort_order: parseInt(e.target.value) || 0 }))} className={inputClass} />
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setEditingSub(null)} className="text-xs text-gray-500 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition">Annulla</button>
                  <button
                    onClick={() => createSub.mutate({ ...subForm, category_id: selectedCatId })}
                    disabled={!subForm.name || createSub.isPending}
                    className="text-xs bg-[#1e3a5f] hover:bg-[#2563eb] text-white px-3 py-1.5 rounded-lg transition disabled:opacity-40"
                  >
                    Salva
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-1">
              {subcategories.map(sub => (
                <div key={sub.id}>
                  {editingSub && editingSub !== "new" && editingSub.id === sub.id ? (
                    <div className="border border-blue-200 bg-blue-50 rounded-lg p-3 space-y-2">
                      <input value={subForm.name} onChange={e => setSubForm(f => ({ ...f, name: e.target.value }))} className={inputClass} />
                      <input placeholder="Descrizione" value={subForm.description} onChange={e => setSubForm(f => ({ ...f, description: e.target.value }))} className={inputClass} />
                      <input type="number" value={subForm.sort_order} onChange={e => setSubForm(f => ({ ...f, sort_order: parseInt(e.target.value) || 0 }))} className={inputClass} />
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => setEditingSub(null)} className="text-xs text-gray-500 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition">Annulla</button>
                        <button
                          onClick={() => updateSub.mutate({ id: sub.id, data: subForm })}
                          className="text-xs bg-[#1e3a5f] hover:bg-[#2563eb] text-white px-3 py-1.5 rounded-lg transition"
                        >
                          Salva
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-50 transition text-sm text-gray-700">
                      <span className="flex-1">{sub.name}</span>
                      {!sub.is_active && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-gray-200 text-gray-500 rounded">inattiva</span>
                      )}
                      <button
                        onClick={() => { setEditingSub(sub); setSubForm({ name: sub.name, description: sub.description || "", sort_order: sub.sort_order }) }}
                        className="p-1 rounded text-gray-400 hover:text-gray-600 transition"
                      >
                        <Pencil size={12} />
                      </button>
                      {confirmDelete === `sub-${sub.id}` ? (
                        <ConfirmDelete
                          onConfirm={() => deleteSub.mutate(sub.id)}
                          onCancel={() => setConfirmDelete(null)}
                        />
                      ) : (
                        <button
                          onClick={() => setConfirmDelete(`sub-${sub.id}`)}
                          className="p-1 rounded text-gray-300 hover:text-red-500 transition"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {subcategories.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-4">Nessuna sottocategoria</p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── TAB 2: Team ───────────────────────────────────────────────────────────────

function TeamsTab() {
  const qc = useQueryClient()
  const [expandedTeamId, setExpandedTeamId] = useState(null)
  const [editingTeam, setEditingTeam] = useState(null) // null | "new" | {id,...}
  const [teamForm, setTeamForm] = useState({ name: "", email: "", description: "" })
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [addMemberUserIds, setAddMemberUserIds] = useState(new Set())
  const [addMemberLead, setAddMemberLead] = useState(false)
  const [addingMembers, setAddingMembers] = useState(false)

  const { data: teams = [] } = useQuery({
    queryKey: ["admin-teams"],
    queryFn: () => ticketConfigApi.getTeams().then(r => r.data),
  })

  const { data: members = [] } = useQuery({
    queryKey: ["admin-team-members", expandedTeamId],
    queryFn: () => ticketConfigApi.getTeamMembers(expandedTeamId).then(r => r.data),
    enabled: !!expandedTeamId,
  })

  const { data: usersData } = useQuery({
    queryKey: ["tickets-users"],
    queryFn: () => ticketsApi.listUsers().then(r => r.data),
  })
  const allUsers = usersData?.users ?? []

  const createTeam = useMutation({
    mutationFn: (data) => ticketConfigApi.createTeam(data),
    onSuccess: () => { qc.invalidateQueries(["admin-teams"]); setEditingTeam(null) },
  })
  const updateTeam = useMutation({
    mutationFn: ({ id, data }) => ticketConfigApi.updateTeam(id, data),
    onSuccess: () => { qc.invalidateQueries(["admin-teams"]); setEditingTeam(null) },
  })
  const deleteTeam = useMutation({
    mutationFn: (id) => ticketConfigApi.deleteTeam(id),
    onSuccess: () => { qc.invalidateQueries(["admin-teams"]); setConfirmDelete(null) },
  })
  const handleAddMembers = async (teamId) => {
    if (addMemberUserIds.size === 0) return
    setAddingMembers(true)
    try {
      await Promise.all(
        [...addMemberUserIds].map(userId =>
          ticketConfigApi.addTeamMember(teamId, { user_id: userId, is_team_lead: addMemberLead })
        )
      )
      qc.invalidateQueries(["admin-team-members", expandedTeamId])
      setAddMemberUserIds(new Set())
      setAddMemberLead(false)
    } finally {
      setAddingMembers(false)
    }
  }
  const removeMember = useMutation({
    mutationFn: ({ teamId, userId }) => ticketConfigApi.removeTeamMember(teamId, userId),
    onSuccess: () => { qc.invalidateQueries(["admin-team-members", expandedTeamId]) },
  })
  const toggleLead = useMutation({
    mutationFn: ({ teamId, userId, is_team_lead }) => ticketConfigApi.updateTeamMember(teamId, userId, { is_team_lead }),
    onSuccess: () => { qc.invalidateQueries(["admin-team-members", expandedTeamId]) },
  })

  const inputClass = "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2563eb] focus:border-transparent outline-none transition text-sm"

  // Utenti non ancora nel team, escludi STORE e STOREMANAGER
  const memberUserIds = new Set(members.map(m => m.user_id))
  const availableUsers = allUsers.filter(u =>
    !memberUserIds.has(u.id) &&
    !["STORE", "STOREMANAGER"].includes(u.department)
  )

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button
          onClick={() => { setEditingTeam("new"); setTeamForm({ name: "", email: "", description: "" }) }}
          className="flex items-center gap-1 text-sm bg-[#1e3a5f] hover:bg-[#2563eb] text-white px-4 py-2 rounded-xl shadow transition"
        >
          <Plus size={14} /> Nuovo team
        </button>
      </div>

      {editingTeam === "new" && (
        <div className="bg-white rounded-xl border border-blue-200 p-4 space-y-3">
          <h4 className="font-semibold text-gray-700 text-sm">Nuovo team</h4>
          <div className="grid grid-cols-2 gap-3">
            <input placeholder="Nome *" value={teamForm.name} onChange={e => setTeamForm(f => ({ ...f, name: e.target.value }))} className={inputClass} />
            <input placeholder="Email team" type="email" value={teamForm.email} onChange={e => setTeamForm(f => ({ ...f, email: e.target.value }))} className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Competenze <span className="font-normal text-gray-400">(usate dall'AI per il routing — es. "email, stampanti, software")</span></label>
            <textarea placeholder="Elenca le competenze del team..." value={teamForm.description} onChange={e => setTeamForm(f => ({ ...f, description: e.target.value }))} rows={2} className={inputClass + " resize-none"} />
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setEditingTeam(null)} className="text-sm text-gray-500 px-4 py-2 rounded-xl hover:bg-gray-100 transition">Annulla</button>
            <button
              onClick={() => createTeam.mutate(teamForm)}
              disabled={!teamForm.name || createTeam.isPending}
              className="text-sm bg-[#1e3a5f] hover:bg-[#2563eb] text-white px-4 py-2 rounded-xl shadow transition disabled:opacity-40"
            >
              Salva
            </button>
          </div>
        </div>
      )}

      {teams.map(team => (
        <div key={team.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {editingTeam && editingTeam !== "new" && editingTeam.id === team.id ? (
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <input value={teamForm.name} onChange={e => setTeamForm(f => ({ ...f, name: e.target.value }))} className={inputClass} />
                <input placeholder="Email" type="email" value={teamForm.email} onChange={e => setTeamForm(f => ({ ...f, email: e.target.value }))} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Competenze <span className="font-normal text-gray-400">(usate dall'AI per il routing)</span></label>
                <textarea placeholder="Elenca le competenze del team..." value={teamForm.description} onChange={e => setTeamForm(f => ({ ...f, description: e.target.value }))} rows={2} className={inputClass + " resize-none"} />
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setEditingTeam(null)} className="text-sm text-gray-500 px-4 py-2 rounded-xl hover:bg-gray-100 transition">Annulla</button>
                <button
                  onClick={() => updateTeam.mutate({ id: team.id, data: teamForm })}
                  className="text-sm bg-[#1e3a5f] hover:bg-[#2563eb] text-white px-4 py-2 rounded-xl shadow transition"
                >
                  Salva
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="w-8 h-8 bg-[#1e3a5f]/10 rounded-lg flex items-center justify-center">
                  <Users size={15} className="text-[#1e3a5f]" />
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-gray-800 text-sm">{team.name}</div>
                  {team.description
                    ? <div className="text-xs text-gray-400 truncate max-w-xs">{team.description}</div>
                    : <div className="text-xs text-amber-500 font-medium">⚠ Competenze non configurate</div>
                  }
                  {team.email && <div className="text-xs text-gray-400">{team.email}</div>}
                </div>
                {!team.is_active && (
                  <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-400 rounded">inattivo</span>
                )}
                <button
                  onClick={() => {
                    setExpandedTeamId(expandedTeamId === team.id ? null : team.id)
                  }}
                  className="flex items-center gap-1.5 text-xs text-[#1e3a5f] hover:text-[#2563eb] transition px-3 py-1.5 border border-[#1e3a5f]/30 hover:border-[#2563eb] rounded-lg"
                >
                  <Users size={12} />
                  Membri
                  {expandedTeamId === team.id ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                </button>
                <button
                  onClick={() => { setEditingTeam(team); setTeamForm({ name: team.name, email: team.email || "", description: team.description || "" }) }}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
                >
                  <Pencil size={14} />
                </button>
                {confirmDelete === `team-${team.id}` ? (
                  <ConfirmDelete
                    onConfirm={() => deleteTeam.mutate(team.id)}
                    onCancel={() => setConfirmDelete(null)}
                  />
                ) : (
                  <button
                    onClick={() => setConfirmDelete(`team-${team.id}`)}
                    className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>

              {expandedTeamId === team.id && (
                <div className="border-t border-gray-100 px-4 py-3 space-y-3 bg-gray-50/50">
                  {/* Aggiungi membri */}
                  <div className="flex gap-2 items-center">
                    <MultiUserSelect
                      users={availableUsers}
                      selected={addMemberUserIds}
                      onChange={setAddMemberUserIds}
                    />
                    <label className="flex items-center gap-1 text-xs text-gray-600 shrink-0">
                      <input
                        type="checkbox"
                        checked={addMemberLead}
                        onChange={e => setAddMemberLead(e.target.checked)}
                        className="rounded"
                      />
                      Team lead
                    </label>
                    <button
                      onClick={() => handleAddMembers(team.id)}
                      disabled={addMemberUserIds.size === 0 || addingMembers}
                      className="flex items-center gap-1 text-xs bg-[#1e3a5f] hover:bg-[#2563eb] text-white px-3 py-2 rounded-lg transition disabled:opacity-40 shrink-0"
                    >
                      <Plus size={13} />
                      {addMemberUserIds.size > 1 ? `Aggiungi (${addMemberUserIds.size})` : "Aggiungi"}
                    </button>
                  </div>

                  {/* Lista membri */}
                  {members.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-2">Nessun membro</p>
                  ) : (
                    <div className="space-y-1">
                      {members.map(m => (
                        <div key={m.id} className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 border border-gray-100">
                          <div className="w-6 h-6 rounded-full bg-[#1e3a5f]/10 flex items-center justify-center text-xs font-bold text-[#1e3a5f]">
                            {(m.full_name || m.username || "?")[0].toUpperCase()}
                          </div>
                          <span className="flex-1 text-sm text-gray-700">{m.full_name || m.username}</span>
                          <span className="text-xs text-gray-400">{m.username}</span>
                          <label className="flex items-center gap-1 text-xs text-gray-500 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={m.is_team_lead}
                              onChange={e => toggleLead.mutate({ teamId: team.id, userId: m.user_id, is_team_lead: e.target.checked })}
                              className="rounded"
                            />
                            Lead
                          </label>
                          <button
                            onClick={() => removeMember.mutate({ teamId: team.id, userId: m.user_id })}
                            className="p-1 rounded text-gray-300 hover:text-red-500 transition"
                          >
                            <X size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      ))}

      {teams.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm py-12 text-center text-gray-400 text-sm">
          Nessun team configurato.
        </div>
      )}
    </div>
  )
}

// ── TAB 3: Regole di assegnazione ─────────────────────────────────────────────

function RoutingRulesTab() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editingRule, setEditingRule] = useState(null) // null = nuova, id = modifica
  const [form, setForm] = useState({
    category_id: "",
    subcategory_id: "",
    team_id: "",
    assigned_user_id: "",
    backup_user_id_1: "",
    backup_user_id_2: "",
    priority_override: "",
  })
  const [confirmDelete, setConfirmDelete] = useState(null)

  const { data: rules = [] } = useQuery({
    queryKey: ["admin-routing-rules"],
    queryFn: () => ticketConfigApi.getRoutingRules().then(r => r.data),
  })
  const { data: categories = [] } = useQuery({
    queryKey: ["admin-categories"],
    queryFn: () => ticketConfigApi.adminGetCategories().then(r => r.data),
  })
  const { data: subcategories = [] } = useQuery({
    queryKey: ["admin-subcategories-form", form.category_id],
    queryFn: () => ticketConfigApi.getSubcategories(form.category_id).then(r => r.data),
    enabled: !!form.category_id,
  })
  const { data: allSubcategories = [] } = useQuery({
    queryKey: ["admin-all-subcategories"],
    queryFn: () => ticketConfigApi.adminGetSubcategories().then(r => r.data),
  })
  const { data: teams = [] } = useQuery({
    queryKey: ["admin-teams"],
    queryFn: () => ticketConfigApi.getTeams().then(r => r.data),
  })
  const { data: usersData } = useQuery({
    queryKey: ["tickets-users"],
    queryFn: () => ticketsApi.listUsers().then(r => r.data),
  })
  const allUsers = usersData?.users ?? []

  // Membri del team selezionato (per filtrare i dropdown utenti)
  const { data: formTeamMembers = [] } = useQuery({
    queryKey: ["admin-team-members", form.team_id],
    queryFn: () => ticketConfigApi.getTeamMembers(parseInt(form.team_id)).then(r => r.data),
    enabled: !!form.team_id,
  })
  const teamMemberIds = new Set(formTeamMembers.map(m => m.user_id))
  const userOptions = form.team_id
    ? allUsers.filter(u => teamMemberIds.has(u.id))
    : allUsers

  const resetForm = () => {
    setForm({ category_id: "", subcategory_id: "", team_id: "", assigned_user_id: "", backup_user_id_1: "", backup_user_id_2: "", priority_override: "" })
    setEditingRule(null)
    setShowForm(false)
  }
  const createRule = useMutation({
    mutationFn: (data) => ticketConfigApi.createRoutingRule(data),
    onSuccess: () => { qc.invalidateQueries(["admin-routing-rules"]); resetForm() },
  })
  const updateRule = useMutation({
    mutationFn: ({ id, data }) => ticketConfigApi.updateRoutingRule(id, data),
    onSuccess: () => { qc.invalidateQueries(["admin-routing-rules"]); resetForm() },
  })
  const deleteRule = useMutation({
    mutationFn: (id) => ticketConfigApi.deleteRoutingRule(id),
    onSuccess: () => { qc.invalidateQueries(["admin-routing-rules"]); setConfirmDelete(null) },
  })

  const setF = (k) => (e) => {
    const val = e.target.value
    setForm(f => {
      const next = { ...f, [k]: val }
      if (k === "category_id") next.subcategory_id = ""
      if (k === "team_id") {
        next.assigned_user_id = ""
        next.backup_user_id_1 = ""
        // backup_user_id_2 non si resetta: è cross-team
      }
      return next
    })
  }

  const selectClass = "w-full px-3 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-[#2563eb] focus:border-transparent outline-none transition text-sm"

  // Verifica duplicati: solo sulla coppia categoria+sottocategoria
  // (una categoria può avere più regole, una sottocategoria al massimo una)
  const isDuplicate = rules.some(r =>
    r.id !== editingRule &&
    r.category_id === parseInt(form.category_id) &&
    (form.subcategory_id
      ? r.subcategory_id === parseInt(form.subcategory_id)
      : !r.subcategory_id)
  )

  const [filterCat, setFilterCat] = useState("")
  const [filterSub, setFilterSub] = useState("")
  const [filterTeam, setFilterTeam] = useState("")

  const filterSubcats = filterCat ? allSubcategories.filter(s => s.category_id === parseInt(filterCat)) : []

  const filteredRules = rules.filter(r => {
    if (filterCat && r.category_id !== parseInt(filterCat)) return false
    if (filterSub && r.subcategory_id !== parseInt(filterSub)) return false
    if (filterTeam && r.team_id !== parseInt(filterTeam)) return false
    return true
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <select value={filterCat} onChange={e => { setFilterCat(e.target.value); setFilterSub("") }} className="w-44 px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm focus:ring-2 focus:ring-[#2563eb] outline-none">
          <option value="">Tutte le categorie</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={filterSub} onChange={e => setFilterSub(e.target.value)} className="w-48 px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm focus:ring-2 focus:ring-[#2563eb] outline-none disabled:opacity-40" disabled={!filterCat}>
          <option value="">Tutte le sottocategorie</option>
          {filterSubcats.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select value={filterTeam} onChange={e => setFilterTeam(e.target.value)} className="w-40 px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm focus:ring-2 focus:ring-[#2563eb] outline-none">
          <option value="">Tutti i team</option>
          {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        {(filterCat || filterSub || filterTeam) && (
          <button onClick={() => { setFilterCat(""); setFilterSub(""); setFilterTeam("") }} className="text-xs text-gray-400 hover:text-gray-600 transition underline">Reset</button>
        )}
        <button
          onClick={() => { if (showForm) { resetForm() } else { setEditingRule(null); setForm({ category_id: "", subcategory_id: "", team_id: "", assigned_user_id: "", backup_user_id_1: "", backup_user_id_2: "", priority_override: "" }); setShowForm(true) } }}
          className="flex items-center gap-1 text-sm bg-[#1e3a5f] hover:bg-[#2563eb] text-white px-4 py-2 rounded-xl shadow transition ml-auto"
        >
          <Plus size={14} /> Nuova regola
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border border-blue-200 p-4 space-y-3">
          <h4 className="font-semibold text-gray-700 text-sm">{editingRule ? "Modifica regola di assegnazione" : "Nuova regola di assegnazione"}</h4>
          {isDuplicate && (
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700">
              <AlertCircle size={13} />
              Esiste già una regola per questa categoria/sottocategoria.
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Categoria *</label>
              <select value={form.category_id} onChange={setF("category_id")} className={selectClass}>
                <option value="">Seleziona...</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Sottocategoria</label>
              <select value={form.subcategory_id} onChange={setF("subcategory_id")} className={selectClass} disabled={!form.category_id}>
                <option value="">Tutte (fallback categoria)</option>
                {subcategories.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Team destinatario</label>
              <select value={form.team_id} onChange={setF("team_id")} className={selectClass}>
                <option value="">Nessun team</option>
                {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                Utente principale
                {!form.team_id && <span className="ml-1 font-normal text-gray-400">(seleziona prima un team)</span>}
              </label>
              <select value={form.assigned_user_id} onChange={setF("assigned_user_id")} className={selectClass} disabled={!form.team_id}>
                <option value="">Nessun utente</option>
                {userOptions.map(u => <option key={u.id} value={u.id}>{u.full_name || u.username}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Utente Backup 1</label>
              <select value={form.backup_user_id_1} onChange={setF("backup_user_id_1")} className={selectClass} disabled={!form.team_id}>
                <option value="">Nessun backup</option>
                {userOptions.map(u => <option key={u.id} value={u.id}>{u.full_name || u.username}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                Utente Backup 2
                <span className="ml-1 font-normal text-gray-400">(cross-team)</span>
              </label>
              <UserCombobox
                users={allUsers}
                value={form.backup_user_id_2}
                onChange={val => setForm(f => ({ ...f, backup_user_id_2: val }))}
                placeholder="Cerca tra tutti gli utenti..."
                className={selectClass}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Override priorità</label>
              <select value={form.priority_override} onChange={setF("priority_override")} className={selectClass}>
                <option value="">Nessun override</option>
                {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={resetForm} className="text-sm text-gray-500 px-4 py-2 rounded-xl hover:bg-gray-100 transition">Annulla</button>
            <button
              onClick={() => {
                const payload = {
                  category_id: parseInt(form.category_id),
                  subcategory_id: form.subcategory_id ? parseInt(form.subcategory_id) : null,
                  team_id: form.team_id ? parseInt(form.team_id) : null,
                  assigned_user_id: form.assigned_user_id || null,
                  backup_user_id_1: form.backup_user_id_1 || null,
                  backup_user_id_2: form.backup_user_id_2 || null,
                  priority_override: form.priority_override || null,
                }
                if (editingRule) {
                  updateRule.mutate({ id: editingRule, data: payload })
                } else {
                  createRule.mutate(payload)
                }
              }}
              disabled={!form.category_id || (isDuplicate && !editingRule) || createRule.isPending || updateRule.isPending}
              className="text-sm bg-[#1e3a5f] hover:bg-[#2563eb] text-white px-4 py-2 rounded-xl shadow transition disabled:opacity-40"
            >
              {editingRule ? "Aggiorna" : "Salva"}
            </button>
          </div>
        </div>
      )}

      {/* Tabella regole */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {filteredRules.length === 0 ? (
          <div className="py-12 text-center text-gray-400 text-sm">Nessuna regola configurata.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-gray-600 font-semibold text-xs">
                <th scope="col" className="px-4 py-3 text-left">Categoria</th>
                <th scope="col" className="px-4 py-3 text-left">Sottocategoria</th>
                <th scope="col" className="px-4 py-3 text-left">Team</th>
                <th scope="col" className="px-4 py-3 text-left">Utente principale</th>
                <th scope="col" className="px-4 py-3 text-left">Backup 1</th>
                <th scope="col" className="px-4 py-3 text-left">Backup 2</th>
                <th scope="col" className="px-4 py-3 text-left">Priorità</th>
                <th scope="col" className="px-4 py-3 text-left">Stato</th>
                <th scope="col" className="px-4 py-3 text-left"></th>
              </tr>
            </thead>
            <tbody>
              {filteredRules.map(rule => (
                <tr key={rule.id} className="border-b border-gray-100 last:border-0 odd:bg-white even:bg-gray-50/50">
                  <td className="px-4 py-3 font-medium text-gray-800">{rule.category_name ?? rule.category_id}</td>
                  <td className="px-4 py-3 text-gray-500">{rule.subcategory_name ?? "—"}</td>
                  <td className="px-4 py-3">
                    {rule.team_name ? (
                      <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs font-medium">{rule.team_name}</span>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">{rule.assigned_user_name ?? "—"}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{rule.backup_user_name_1 ?? "—"}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{rule.backup_user_name_2 ?? "—"}</td>
                  <td className="px-4 py-3">
                    {rule.priority_override ? (
                      <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded text-xs font-medium">{rule.priority_override}</span>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      aria-label={rule.is_active ? "Disattiva regola" : "Attiva regola"}
                      onClick={() => updateRule.mutate({ id: rule.id, data: { ...rule, is_active: !rule.is_active } })}
                      className={`text-xs px-2 py-0.5 rounded font-medium cursor-pointer transition hover:opacity-70 ${rule.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}
                    >
                      {rule.is_active ? "attiva" : "inattiva"}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        aria-label="Modifica regola"
                        onClick={() => {
                          setEditingRule(rule.id)
                          setForm({
                            category_id: String(rule.category_id ?? ""),
                            subcategory_id: String(rule.subcategory_id ?? ""),
                            team_id: String(rule.team_id ?? ""),
                            assigned_user_id: rule.assigned_user_id ?? "",
                            backup_user_id_1: rule.backup_user_id_1 ?? "",
                            backup_user_id_2: rule.backup_user_id_2 ?? "",
                            priority_override: rule.priority_override ?? "",
                          })
                          setShowForm(true)
                        }}
                        className="p-1 rounded text-gray-300 hover:text-[#2563eb] transition"
                      >
                        <Pencil size={14} />
                      </button>
                      {confirmDelete === rule.id ? (
                        <ConfirmDelete
                          onConfirm={() => deleteRule.mutate(rule.id)}
                          onCancel={() => setConfirmDelete(null)}
                        />
                      ) : (
                        <button
                          aria-label="Elimina regola"
                          onClick={() => setConfirmDelete(rule.id)}
                          className="p-1 rounded text-gray-300 hover:text-red-500 transition"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function TicketConfig() {
  const navigate = useNavigate()
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Configurazione Ticketing</h1>
          <p className="text-xs text-gray-400 mt-0.5">Gestisci categorie, team e regole di assegnazione automatica</p>
        </div>
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition"
        >
          <LogOut size={15} aria-hidden="true" />
          Esci
        </button>
      </div>

      <Tabs.Root defaultValue="categories">
        <Tabs.List className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit mb-5">
          {[
            { value: "categories", label: "Categorie" },
            { value: "teams", label: "Team" },
            { value: "routing", label: "Regole assegnazione" },
          ].map(tab => (
            <Tabs.Trigger
              key={tab.value}
              value={tab.value}
              className="px-4 py-2 rounded-lg text-sm font-medium transition data-[state=active]:bg-white data-[state=active]:text-[#1e3a5f] data-[state=active]:shadow-sm text-gray-500 hover:text-gray-700"
            >
              {tab.label}
            </Tabs.Trigger>
          ))}
        </Tabs.List>

        <Tabs.Content value="categories">
          <CategoriesTab />
        </Tabs.Content>
        <Tabs.Content value="teams">
          <TeamsTab />
        </Tabs.Content>
        <Tabs.Content value="routing">
          <RoutingRulesTab />
        </Tabs.Content>
      </Tabs.Root>
    </div>
  )
}
