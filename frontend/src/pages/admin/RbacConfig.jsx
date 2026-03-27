import { useState, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import * as Tabs from "@radix-ui/react-tabs"
import { Shield, Plus, Trash2, Check, X, ChevronRight, ChevronDown, Tag, Search, LogOut } from "lucide-react"
import { rbacApi } from "@/api/rbac"
import { authApi } from "@/api/auth"

const MODULE_COLORS = {
  system:   "bg-red-100 text-red-700",
  sales:    "bg-blue-100 text-blue-700",
  stores:   "bg-emerald-100 text-emerald-700",
  nav:      "bg-violet-100 text-violet-700",
  tickets:  "bg-amber-100 text-amber-700",
  users:    "bg-pink-100 text-pink-700",
  inventory:"bg-gray-100 text-gray-600",
}
const moduleColor = (m) => MODULE_COLORS[m] || "bg-gray-100 text-gray-600"

const SCOPE_COLORS = {
  GLOBAL: "bg-green-100 text-green-700",
  ENTITY: "bg-blue-100 text-blue-700",
  STORE:  "bg-orange-100 text-orange-700",
  MODULE: "bg-purple-100 text-purple-700",
}

function ConfirmDelete({ onConfirm, onCancel }) {
  return (
    <span className="flex items-center gap-1">
      <span className="text-xs text-red-600 font-medium">Confermi?</span>
      <button onClick={onConfirm} className="text-red-600 hover:text-red-800 p-0.5"><Check size={13} /></button>
      <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 p-0.5"><X size={13} /></button>
    </span>
  )
}

// ── Modal selezione permessi con checkbox ─────────────────────────────────────

function AddPermissionsModal({ availablePerms, onConfirm, onClose, isPending }) {
  const [search, setSearch] = useState("")
  const [selected, setSelected] = useState(new Set())

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return availablePerms.filter(
      p => p.code.toLowerCase().includes(q) || p.module.toLowerCase().includes(q) || (p.name || "").toLowerCase().includes(q)
    )
  }, [availablePerms, search])

  const byModule = useMemo(() => filtered.reduce((acc, p) => {
    if (!acc[p.module]) acc[p.module] = []
    acc[p.module].push(p)
    return acc
  }, {}), [filtered])

  const toggle = (id) => setSelected(s => {
    const next = new Set(s)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  const toggleModule = (perms) => {
    const ids = perms.map(p => p.id)
    const allSelected = ids.every(id => selected.has(id))
    setSelected(s => {
      const next = new Set(s)
      ids.forEach(id => allSelected ? next.delete(id) : next.add(id))
      return next
    })
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h2 className="font-bold text-gray-800">Aggiungi permessi</h2>
            <p className="text-xs text-gray-400 mt-0.5">{selected.size} selezionati</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition">
            <X size={18} />
          </button>
        </div>

        {/* Ricerca */}
        <div className="px-5 py-3 border-b border-gray-100">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              autoFocus
              placeholder="Cerca permesso..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2563eb] focus:border-transparent outline-none"
            />
          </div>
        </div>

        {/* Lista con checkbox */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-4">
          {Object.keys(byModule).length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-6">Nessun permesso disponibile</p>
          ) : (
            Object.entries(byModule).map(([module, perms]) => {
              const allSel = perms.every(p => selected.has(p.id))
              const someSel = perms.some(p => selected.has(p.id))
              return (
                <div key={module}>
                  {/* Header modulo con checkbox seleziona-tutto */}
                  <div
                    className="flex items-center gap-2 mb-2 cursor-pointer group"
                    onClick={() => toggleModule(perms)}
                  >
                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition ${
                      allSel ? "bg-[#1e3a5f] border-[#1e3a5f]" : someSel ? "bg-[#1e3a5f]/30 border-[#1e3a5f]" : "border-gray-300 group-hover:border-[#1e3a5f]"
                    }`}>
                      {(allSel || someSel) && <Check size={10} className="text-white" />}
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${moduleColor(module)}`}>{module}</span>
                    <span className="text-xs text-gray-400">{perms.length} permessi</span>
                  </div>

                  {/* Permessi del modulo */}
                  <div className="space-y-1 ml-6">
                    {perms.map(p => (
                      <label
                        key={p.id}
                        className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 cursor-pointer transition"
                      >
                        <div
                          onClick={() => toggle(p.id)}
                          className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition ${
                            selected.has(p.id) ? "bg-[#1e3a5f] border-[#1e3a5f]" : "border-gray-300 hover:border-[#1e3a5f]"
                          }`}
                        >
                          {selected.has(p.id) && <Check size={10} className="text-white" />}
                        </div>
                        <div className="flex-1 min-w-0" onClick={() => toggle(p.id)}>
                          <div className="text-xs font-mono text-gray-800">{p.code}</div>
                          {p.name && p.name !== p.code && (
                            <div className="text-[10px] text-gray-400 truncate">{p.name}</div>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-between">
          <button
            onClick={() => setSelected(new Set(availablePerms.map(p => p.id)))}
            className="text-xs text-gray-400 hover:text-gray-600 transition underline"
          >
            Seleziona tutti
          </button>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm text-gray-500 hover:bg-gray-100 rounded-xl transition">
              Annulla
            </button>
            <button
              onClick={() => onConfirm([...selected])}
              disabled={selected.size === 0 || isPending}
              className="px-5 py-2 text-sm bg-[#1e3a5f] hover:bg-[#2563eb] text-white font-semibold rounded-xl shadow transition disabled:opacity-40"
            >
              {isPending ? "Salvataggio..." : `Aggiungi ${selected.size > 0 ? `(${selected.size})` : ""}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Tab 1: Ruoli ──────────────────────────────────────────────────────────────

function RolesTab() {
  const qc = useQueryClient()
  const [selectedRoleId, setSelectedRoleId] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [saving, setSaving] = useState(false)

  const { data: roles = [] } = useQuery({
    queryKey: ["admin-rbac-roles"],
    queryFn: () => rbacApi.getRoles().then(r => r.data),
  })
  const { data: rolePerms = [] } = useQuery({
    queryKey: ["admin-rbac-role-perms", selectedRoleId],
    queryFn: () => rbacApi.getRolePermissions(selectedRoleId).then(r => r.data),
    enabled: !!selectedRoleId,
  })
  const { data: allPerms = [] } = useQuery({
    queryKey: ["admin-rbac-permissions"],
    queryFn: () => rbacApi.getPermissions().then(r => r.data),
  })

  const removePerm = useMutation({
    mutationFn: (rpsId) => rbacApi.removeRolePermission(selectedRoleId, rpsId),
    onSuccess: () => {
      qc.invalidateQueries(["admin-rbac-role-perms", selectedRoleId])
      qc.invalidateQueries(["admin-rbac-roles"])
      setConfirmDelete(null)
    },
  })

  const handleConfirmAdd = async (permIds) => {
    setSaving(true)
    try {
      for (const permId of permIds) {
        await rbacApi.addRolePermission(selectedRoleId, { permission_id: permId, scope_type: "GLOBAL" })
      }
      qc.invalidateQueries(["admin-rbac-role-perms", selectedRoleId])
      qc.invalidateQueries(["admin-rbac-roles"])
      setShowModal(false)
    } finally {
      setSaving(false)
    }
  }

  const selectedRole = roles.find(r => r.id === selectedRoleId)
  const assignedPermIds = new Set(rolePerms.map(p => p.permission_id))
  const availablePerms = allPerms.filter(p => !assignedPermIds.has(p.id))

  const permsByModule = rolePerms.reduce((acc, p) => {
    if (!acc[p.module]) acc[p.module] = []
    acc[p.module].push(p)
    return acc
  }, {})

  return (
    <>
      {showModal && (
        <AddPermissionsModal
          availablePerms={availablePerms}
          onConfirm={handleConfirmAdd}
          onClose={() => setShowModal(false)}
          isPending={saving}
        />
      )}

      <div className="grid grid-cols-5 gap-5">
        {/* Lista ruoli (2/5) */}
        <div className="col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-1">
          <h3 className="font-semibold text-gray-700 text-sm mb-3">Ruoli</h3>
          {roles.map(role => (
            <div
              key={role.id}
              onClick={() => { setSelectedRoleId(role.id === selectedRoleId ? null : role.id); setConfirmDelete(null) }}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition text-sm ${
                selectedRoleId === role.id ? "bg-[#1e3a5f] text-white" : "hover:bg-gray-50 text-gray-700"
              }`}
            >
              {selectedRoleId === role.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              <div className="flex-1">
                <div className="font-semibold">{role.name}</div>
                <div className={`text-xs ${selectedRoleId === role.id ? "text-white/60" : "text-gray-400"}`}>{role.code}</div>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded font-medium ${selectedRoleId === role.id ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"}`}>
                {role.permission_count} permessi
              </span>
              {!role.is_active && (
                <span className="text-[10px] px-1.5 py-0.5 bg-gray-200 text-gray-500 rounded">inattivo</span>
              )}
            </div>
          ))}
        </div>

        {/* Permessi del ruolo (3/5) */}
        <div className="col-span-3 bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-700 text-sm">
              Permessi
              {selectedRole && <span className="ml-2 text-gray-400 font-normal">— {selectedRole.name}</span>}
            </h3>
            {selectedRoleId && (
              <button
                onClick={() => setShowModal(true)}
                className="flex items-center gap-1 text-xs bg-[#1e3a5f] hover:bg-[#2563eb] text-white px-3 py-1.5 rounded-lg transition"
              >
                <Plus size={13} /> Aggiungi
              </button>
            )}
          </div>

          {!selectedRoleId ? (
            <p className="text-xs text-gray-400 text-center py-8">Seleziona un ruolo a sinistra</p>
          ) : rolePerms.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-4">Nessun permesso assegnato</p>
          ) : (
            <div className="space-y-3">
              {Object.entries(permsByModule).map(([module, perms]) => (
                <div key={module}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <Tag size={11} className="text-gray-400" />
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${moduleColor(module)}`}>{module}</span>
                  </div>
                  <div className="space-y-1 ml-4">
                    {perms.map(p => (
                      <div key={p.rps_id} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
                        <span className="flex-1 text-xs text-gray-700 font-mono">{p.permission_code}</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${SCOPE_COLORS[p.scope_type] || "bg-gray-100 text-gray-500"}`}>
                          {p.scope_type}
                        </span>
                        {confirmDelete === p.rps_id ? (
                          <ConfirmDelete
                            onConfirm={() => removePerm.mutate(p.rps_id)}
                            onCancel={() => setConfirmDelete(null)}
                          />
                        ) : (
                          <button
                            onClick={() => setConfirmDelete(p.rps_id)}
                            className="p-1 rounded text-gray-300 hover:text-red-500 transition"
                          >
                            <Trash2 size={11} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

// ── Assignments Panel ─────────────────────────────────────────────────────────

const ENTITIES = ["IT01", "IT02", "IT03"]
const ASSIGNMENT_TYPES = ["PRIMARY", "SECONDARY", "TEMP"]
const TYPE_COLORS = {
  PRIMARY:   "bg-blue-100 text-blue-700",
  SECONDARY: "bg-gray-100 text-gray-600",
  TEMP:      "bg-amber-100 text-amber-700",
}

function AssignmentsPanel({ userId }) {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ type: "entity", entity_code: "", store_code: "", assignment_type: "PRIMARY", notes: "" })
  const [confirmDelete, setConfirmDelete] = useState(null)

  const { data: assignments = [] } = useQuery({
    queryKey: ["admin-rbac-user-assignments", userId],
    queryFn: () => rbacApi.getUserAssignments(userId).then(r => r.data),
    enabled: !!userId,
  })

  const addAssignment = useMutation({
    mutationFn: () => rbacApi.addUserAssignment(userId, {
      entity_code: form.type === "entity" ? form.entity_code || null : null,
      store_code: form.type === "store" ? form.store_code || null : null,
      assignment_type: form.assignment_type,
      notes: form.notes || null,
    }),
    onSuccess: () => {
      qc.invalidateQueries(["admin-rbac-user-assignments", userId])
      setShowForm(false)
      setForm({ type: "entity", entity_code: "", store_code: "", assignment_type: "PRIMARY", notes: "" })
    },
  })

  const removeAssignment = useMutation({
    mutationFn: (id) => rbacApi.removeUserAssignment(userId, id),
    onSuccess: () => {
      qc.invalidateQueries(["admin-rbac-user-assignments", userId])
      setConfirmDelete(null)
    },
  })

  const entityAssignments = assignments.filter(a => a.entity_code)
  const storeAssignments = assignments.filter(a => a.store_code)
  const isFormValid = form.type === "entity" ? !!form.entity_code : !!form.store_code

  const selectClass = "px-3 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-[#2563eb] focus:border-transparent outline-none transition text-sm"

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-700 text-sm">Assegnazioni Entity / Store</h3>
          <p className="text-xs text-gray-400 mt-0.5">Definisce su quali dati l'utente può operare</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1 text-xs bg-[#1e3a5f] hover:bg-[#2563eb] text-white px-3 py-1.5 rounded-lg transition"
        >
          <Plus size={13} /> Aggiungi
        </button>
      </div>

      {showForm && (
        <div className="border border-blue-200 bg-blue-50 rounded-lg p-3 space-y-2">
          <div className="flex gap-2">
            {/* Tipo: entity o store */}
            <div className="flex rounded-lg border border-gray-300 overflow-hidden text-xs">
              <button
                onClick={() => setForm(f => ({ ...f, type: "entity", store_code: "" }))}
                className={`px-3 py-1.5 transition ${form.type === "entity" ? "bg-[#1e3a5f] text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
              >
                Entity
              </button>
              <button
                onClick={() => setForm(f => ({ ...f, type: "store", entity_code: "" }))}
                className={`px-3 py-1.5 transition ${form.type === "store" ? "bg-[#1e3a5f] text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
              >
                Store
              </button>
            </div>

            {form.type === "entity" ? (
              <select value={form.entity_code} onChange={e => setForm(f => ({ ...f, entity_code: e.target.value }))} className={selectClass}>
                <option value="">Seleziona entity...</option>
                {ENTITIES.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
            ) : (
              <input
                placeholder="Codice store (es. IT207)"
                value={form.store_code}
                onChange={e => setForm(f => ({ ...f, store_code: e.target.value.toUpperCase() }))}
                className={selectClass + " uppercase placeholder:normal-case"}
              />
            )}

            <select value={form.assignment_type} onChange={e => setForm(f => ({ ...f, assignment_type: e.target.value }))} className={selectClass}>
              {ASSIGNMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div className="flex gap-2">
            <input
              placeholder="Note (opzionale)"
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              className={selectClass + " flex-1"}
            />
            <button
              onClick={() => addAssignment.mutate()}
              disabled={!isFormValid || addAssignment.isPending}
              className="text-xs bg-[#1e3a5f] hover:bg-[#2563eb] text-white px-3 py-2 rounded-lg transition disabled:opacity-40"
            >
              {addAssignment.isPending ? "..." : <Check size={13} />}
            </button>
            <button onClick={() => setShowForm(false)} className="text-xs text-gray-400 hover:text-gray-600 px-2 py-2 rounded-lg transition">
              <X size={13} />
            </button>
          </div>
        </div>
      )}

      {assignments.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-4">Nessuna assegnazione — accesso determinato solo dal ruolo</p>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {/* Entity */}
          <div>
            <div className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Entity ({entityAssignments.length})</div>
            {entityAssignments.length === 0 ? (
              <p className="text-xs text-gray-300 italic">Nessuna</p>
            ) : (
              <div className="space-y-1">
                {entityAssignments.map(a => (
                  <div key={a.id} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                      a.entity_code === "IT01" ? "bg-blue-100 text-blue-700" :
                      a.entity_code === "IT02" ? "bg-emerald-100 text-emerald-700" :
                      "bg-violet-100 text-violet-700"
                    }`}>{a.entity_code}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${TYPE_COLORS[a.assignment_type]}`}>{a.assignment_type}</span>
                    {a.notes && <span className="text-xs text-gray-400 truncate flex-1">{a.notes}</span>}
                    {confirmDelete === a.id ? (
                      <ConfirmDelete onConfirm={() => removeAssignment.mutate(a.id)} onCancel={() => setConfirmDelete(null)} />
                    ) : (
                      <button onClick={() => setConfirmDelete(a.id)} className="p-1 rounded text-gray-300 hover:text-red-500 transition ml-auto"><Trash2 size={11} /></button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Store */}
          <div>
            <div className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Store ({storeAssignments.length})</div>
            {storeAssignments.length === 0 ? (
              <p className="text-xs text-gray-300 italic">Nessuna</p>
            ) : (
              <div className="space-y-1">
                {storeAssignments.map(a => (
                  <div key={a.id} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
                    <span className="text-xs font-mono font-bold text-gray-700">{a.store_code}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${TYPE_COLORS[a.assignment_type]}`}>{a.assignment_type}</span>
                    {a.notes && <span className="text-xs text-gray-400 truncate flex-1">{a.notes}</span>}
                    {confirmDelete === a.id ? (
                      <ConfirmDelete onConfirm={() => removeAssignment.mutate(a.id)} onCancel={() => setConfirmDelete(null)} />
                    ) : (
                      <button onClick={() => setConfirmDelete(a.id)} className="p-1 rounded text-gray-300 hover:text-red-500 transition ml-auto"><Trash2 size={11} /></button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Tab 2: Permessi utente ────────────────────────────────────────────────────

function UserPermissionsTab() {
  const qc = useQueryClient()
  const [selectedUserId, setSelectedUserId] = useState("")
  const [showAddRole, setShowAddRole] = useState(false)
  const [addRoleId, setAddRoleId] = useState("")
  const [showAddOverride, setShowAddOverride] = useState(false)
  const [overrideForm, setOverrideForm] = useState({ permission_id: "", scope_id: "", effect: "allow", notes: "" })
  const [confirmDelete, setConfirmDelete] = useState(null)

  const { data: usersData } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => authApi.listUsers().then(r => r.data),
  })
  const users = usersData ?? []

  const { data: roles = [] } = useQuery({
    queryKey: ["admin-rbac-roles"],
    queryFn: () => rbacApi.getRoles().then(r => r.data),
  })
  const { data: allPerms = [] } = useQuery({
    queryKey: ["admin-rbac-permissions"],
    queryFn: () => rbacApi.getPermissions().then(r => r.data),
  })
  const { data: scopes = [] } = useQuery({
    queryKey: ["admin-rbac-scopes"],
    queryFn: () => rbacApi.getScopes().then(r => r.data),
  })
  const { data: userRoles = [] } = useQuery({
    queryKey: ["admin-rbac-user-roles", selectedUserId],
    queryFn: () => rbacApi.getUserRoles(selectedUserId).then(r => r.data),
    enabled: !!selectedUserId,
  })
  const { data: userOverrides = [] } = useQuery({
    queryKey: ["admin-rbac-user-overrides", selectedUserId],
    queryFn: () => rbacApi.getUserOverrides(selectedUserId).then(r => r.data),
    enabled: !!selectedUserId,
  })

  const addRole = useMutation({
    mutationFn: () => rbacApi.addUserRole(selectedUserId, addRoleId),
    onSuccess: () => { qc.invalidateQueries(["admin-rbac-user-roles", selectedUserId]); setShowAddRole(false); setAddRoleId("") },
  })
  const removeRole = useMutation({
    mutationFn: (assignmentId) => rbacApi.removeUserRole(selectedUserId, assignmentId),
    onSuccess: () => { qc.invalidateQueries(["admin-rbac-user-roles", selectedUserId]); setConfirmDelete(null) },
  })
  const addOverride = useMutation({
    mutationFn: () => rbacApi.addUserOverride(selectedUserId, {
      permission_id: overrideForm.permission_id,
      scope_id: overrideForm.scope_id,
      effect: overrideForm.effect,
      notes: overrideForm.notes || null,
    }),
    onSuccess: () => {
      qc.invalidateQueries(["admin-rbac-user-overrides", selectedUserId])
      setShowAddOverride(false)
      setOverrideForm({ permission_id: "", scope_id: "", effect: "allow", notes: "" })
    },
  })
  const removeOverride = useMutation({
    mutationFn: (overrideId) => rbacApi.removeUserOverride(selectedUserId, overrideId),
    onSuccess: () => { qc.invalidateQueries(["admin-rbac-user-overrides", selectedUserId]); setConfirmDelete(null) },
  })

  const assignedRoleIds = new Set(userRoles.map(r => r.role_id))
  const availableRoles = roles.filter(r => !assignedRoleIds.has(r.id))

  const selectClass = "w-full px-3 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-[#2563eb] focus:border-transparent outline-none transition text-sm"

  return (
    <div className="space-y-4">
      {/* Selezione utente */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        <label className="block text-xs font-semibold text-gray-600 mb-2">Seleziona utente</label>
        <select
          value={selectedUserId}
          onChange={e => { setSelectedUserId(e.target.value); setConfirmDelete(null) }}
          className={selectClass}
        >
          <option value="">Seleziona...</option>
          {users.map(u => (
            <option key={u.id} value={u.id}>{u.full_name || u.username} ({u.role})</option>
          ))}
        </select>
      </div>

      {selectedUserId && (
        <div className="grid grid-cols-2 gap-5">
          {/* Ruoli RBAC assegnati */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-700 text-sm">Ruoli RBAC</h3>
              <button
                onClick={() => setShowAddRole(!showAddRole)}
                className="flex items-center gap-1 text-xs bg-[#1e3a5f] hover:bg-[#2563eb] text-white px-3 py-1.5 rounded-lg transition"
              >
                <Plus size={13} /> Aggiungi
              </button>
            </div>

            {showAddRole && (
              <div className="border border-blue-200 bg-blue-50 rounded-lg p-3 flex gap-2">
                <select value={addRoleId} onChange={e => setAddRoleId(e.target.value)} className="flex-1 text-xs px-3 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-[#2563eb] outline-none">
                  <option value="">Seleziona ruolo...</option>
                  {availableRoles.map(r => <option key={r.id} value={r.id}>{r.name} ({r.code})</option>)}
                </select>
                <button onClick={() => addRole.mutate()} disabled={!addRoleId || addRole.isPending} className="text-xs bg-[#1e3a5f] hover:bg-[#2563eb] text-white px-3 py-2 rounded-lg transition disabled:opacity-40"><Check size={13} /></button>
                <button onClick={() => { setShowAddRole(false); setAddRoleId("") }} className="text-xs text-gray-400 px-2 py-2 rounded-lg hover:text-gray-600 transition"><X size={13} /></button>
              </div>
            )}

            {userRoles.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">Nessun ruolo RBAC assegnato</p>
            ) : (
              <div className="space-y-1">
                {userRoles.map(r => (
                  <div key={r.assignment_id} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
                    <Shield size={13} className="text-[#1e3a5f]" />
                    <span className="flex-1 text-sm font-medium text-gray-700">{r.role_name}</span>
                    <span className="text-xs text-gray-400 font-mono">{r.role_code}</span>
                    {confirmDelete === r.assignment_id ? (
                      <ConfirmDelete onConfirm={() => removeRole.mutate(r.assignment_id)} onCancel={() => setConfirmDelete(null)} />
                    ) : (
                      <button onClick={() => setConfirmDelete(r.assignment_id)} className="p-1 rounded text-gray-300 hover:text-red-500 transition"><Trash2 size={12} /></button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Override permessi */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-700 text-sm">Override permessi</h3>
              <button
                onClick={() => setShowAddOverride(!showAddOverride)}
                className="flex items-center gap-1 text-xs bg-[#1e3a5f] hover:bg-[#2563eb] text-white px-3 py-1.5 rounded-lg transition"
              >
                <Plus size={13} /> Aggiungi
              </button>
            </div>

            {showAddOverride && (
              <div className="border border-blue-200 bg-blue-50 rounded-lg p-3 space-y-2">
                <select value={overrideForm.permission_id} onChange={e => setOverrideForm(f => ({ ...f, permission_id: e.target.value }))} className="w-full text-xs px-3 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-[#2563eb] outline-none">
                  <option value="">Permesso...</option>
                  {allPerms.map(p => <option key={p.id} value={p.id}>[{p.module}] {p.code}</option>)}
                </select>
                <select value={overrideForm.scope_id} onChange={e => setOverrideForm(f => ({ ...f, scope_id: e.target.value }))} className="w-full text-xs px-3 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-[#2563eb] outline-none">
                  <option value="">Scope...</option>
                  {scopes.map(s => <option key={s.id} value={s.id}>{s.scope_type} — {s.scope_code}</option>)}
                </select>
                <div className="flex gap-2">
                  <select value={overrideForm.effect} onChange={e => setOverrideForm(f => ({ ...f, effect: e.target.value }))} className="flex-1 text-xs px-3 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-[#2563eb] outline-none">
                    <option value="allow">Allow</option>
                    <option value="deny">Deny</option>
                  </select>
                  <input
                    placeholder="Note (opzionale)"
                    value={overrideForm.notes}
                    onChange={e => setOverrideForm(f => ({ ...f, notes: e.target.value }))}
                    className="flex-1 text-xs px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2563eb] outline-none"
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setShowAddOverride(false)} className="text-xs text-gray-500 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition">Annulla</button>
                  <button
                    onClick={() => addOverride.mutate()}
                    disabled={!overrideForm.permission_id || !overrideForm.scope_id || addOverride.isPending}
                    className="text-xs bg-[#1e3a5f] hover:bg-[#2563eb] text-white px-3 py-1.5 rounded-lg transition disabled:opacity-40"
                  >
                    Salva
                  </button>
                </div>
              </div>
            )}

            {userOverrides.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">Nessun override</p>
            ) : (
              <div className="space-y-1">
                {userOverrides.map(ov => (
                  <div key={ov.id} className={`flex items-center gap-2 rounded-lg px-3 py-2 ${ov.effect === "allow" ? "bg-green-50" : "bg-red-50"}`}>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${ov.effect === "allow" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                      {ov.effect}
                    </span>
                    <span className="flex-1 text-xs font-mono text-gray-700">{ov.permission_code}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${SCOPE_COLORS[ov.scope_type] || "bg-gray-100 text-gray-500"}`}>
                      {ov.scope_type}
                    </span>
                    {confirmDelete === ov.id ? (
                      <ConfirmDelete onConfirm={() => removeOverride.mutate(ov.id)} onCancel={() => setConfirmDelete(null)} />
                    ) : (
                      <button onClick={() => setConfirmDelete(ov.id)} className="p-1 rounded text-gray-300 hover:text-red-500 transition"><Trash2 size={11} /></button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="col-span-2">
            <AssignmentsPanel userId={selectedUserId} />
          </div>

        </div>
      )}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function RbacConfig({ embedded = false }) {
  const navigate = useNavigate()
  return (
    <div className="space-y-5">
      {!embedded && (
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-800">Ruoli & Permessi</h1>
            <p className="text-xs text-gray-400 mt-0.5">Gestisci permessi per ruolo e override per singolo utente</p>
          </div>
          <button
            onClick={() => navigate("/utilities")}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition"
          >
            <LogOut size={15} aria-hidden="true" />
            Esci
          </button>
        </div>
      )}

      <Tabs.Root defaultValue="roles">
        <Tabs.List className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit mb-5">
          {[
            { value: "roles", label: "Ruoli" },
            { value: "users", label: "Permessi utente" },
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

        <Tabs.Content value="roles"><RolesTab /></Tabs.Content>
        <Tabs.Content value="users"><UserPermissionsTab /></Tabs.Content>
      </Tabs.Root>
    </div>
  )
}
