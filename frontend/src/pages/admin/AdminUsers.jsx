import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Plus, Pencil, KeyRound, UserX, UserCheck, X, Check, Trash2, ShieldCheck, Search } from "lucide-react"
import * as Tabs from "@radix-ui/react-tabs"
import { authApi } from "@/api/auth"
import ModuleConfig from "./ModuleConfig"
import UtilitiesConfig from "./UtilitiesConfig"

const USER_TYPES = ["ADMIN", "HR", "FINANCE", "MARKETING", "IT", "COMMERCIAL", "DM", "STORE", "STOREMANAGER", "RETAIL"]

const USER_TYPE_BADGE = {
  SUPERUSER:  "bg-red-100 text-red-700",
  ADMIN:      "bg-orange-100 text-orange-700",
  HR:         "bg-pink-100 text-pink-700",
  FINANCE:    "bg-yellow-100 text-yellow-700",
  MARKETING:  "bg-purple-100 text-purple-700",
  IT:         "bg-cyan-100 text-cyan-700",
  COMMERCIAL: "bg-blue-100 text-blue-700",
  DM:           "bg-violet-100 text-violet-700",
  STORE:        "bg-emerald-100 text-emerald-700",
  STOREMANAGER: "bg-teal-100 text-teal-700",
  RETAIL:       "bg-lime-100 text-lime-700",
}

const USER_TABS = [
  { value: "all",   label: "Tutti",  filter: () => true },
  { value: "it01",  label: "IT01",   filter: (u) => u.username.toUpperCase().startsWith("IT01") },
  { value: "it02",  label: "IT02",   filter: (u) => u.username.toUpperCase().startsWith("IT02") },
  { value: "it03",  label: "IT03",   filter: (u) => u.username.toUpperCase().startsWith("IT03") },
  { value: "altri", label: "Altri",  filter: (u) => !u.username.toUpperCase().match(/^IT0[123]/) },
]

const inputClass =
  "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2563eb] focus:border-transparent outline-none transition text-sm"

// ── Modals ────────────────────────────────────────────────────────────────────

function NewUserModal({ onClose, onSaved }) {
  const [form, setForm] = useState({ username: "", email: "", full_name: "", password: "", department: "COMMERCIAL" })
  const [error, setError] = useState("")
  const mutation = useMutation({
    mutationFn: () => authApi.createUser(form),
    onSuccess: () => { onSaved(); onClose() },
    onError: (e) => setError(e.response?.data?.detail || "Errore durante la creazione"),
  })
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const valid = form.username && form.email && form.password

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-gray-800 text-lg">Nuovo utente</h2>
          <button onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"><X size={18} /></button>
        </div>
        {error && <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700">{error}</div>}
        <div className="space-y-3">
          <input placeholder="Username *" value={form.username} onChange={set("username")} className={inputClass} />
          <input placeholder="Email *" type="email" value={form.email} onChange={set("email")} className={inputClass} />
          <input placeholder="Nome completo" value={form.full_name} onChange={set("full_name")} className={inputClass} />
          <input placeholder="Password *" type="password" value={form.password} onChange={set("password")} className={inputClass} />
          <select value={form.department} onChange={set("department")} className={inputClass + " bg-white"}>
            {USER_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="flex gap-2 justify-end pt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-500 hover:bg-gray-100 rounded-xl transition">Annulla</button>
          <button onClick={() => mutation.mutate()} disabled={!valid || mutation.isPending}
            className="px-5 py-2 text-sm bg-[#1e3a5f] hover:bg-[#2563eb] text-white font-semibold rounded-xl shadow transition disabled:opacity-40">
            {mutation.isPending ? "Salvataggio..." : "Crea utente"}
          </button>
        </div>
      </div>
    </div>
  )
}

function ChangeTypeModal({ user, onClose, onSaved }) {
  const [userType, setUserType] = useState(user.department)
  const [error, setError] = useState("")
  const mutation = useMutation({
    mutationFn: () => authApi.changeDepartment(user.id, userType),
    onSuccess: () => { onSaved(); onClose() },
    onError: (e) => setError(e.response?.data?.detail || "Errore"),
  })
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-gray-800">Cambia tipo utente</h2>
          <button onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"><X size={18} /></button>
        </div>
        <p className="text-sm text-gray-500">Utente: <strong>{user.full_name || user.username}</strong></p>
        {error && <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700">{error}</div>}
        <select value={userType} onChange={(e) => setUserType(e.target.value)} className={inputClass + " bg-white"}>
          {USER_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-500 hover:bg-gray-100 rounded-xl transition">Annulla</button>
          <button onClick={() => mutation.mutate()} disabled={mutation.isPending || userType === user.department}
            className="px-5 py-2 text-sm bg-[#1e3a5f] hover:bg-[#2563eb] text-white font-semibold rounded-xl shadow transition disabled:opacity-40">
            {mutation.isPending ? "Salvataggio..." : "Conferma"}
          </button>
        </div>
      </div>
    </div>
  )
}

function EditRow({ user, onClose, onSaved }) {
  const [form, setForm] = useState({ full_name: user.full_name || "", email: user.email })
  const mutation = useMutation({
    mutationFn: () => authApi.updateUser(user.id, form),
    onSuccess: () => { onSaved(); onClose() },
  })
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  return (
    <>
      <td className="px-4 py-2"><input value={form.full_name} onChange={set("full_name")} className={inputClass} /></td>
      <td className="px-4 py-2"><input value={form.email} onChange={set("email")} className={inputClass} /></td>
      <td className="px-4 py-2" /><td className="px-4 py-2" /><td className="px-4 py-2" />
      <td className="px-4 py-2" colSpan={2}>
        <div className="flex gap-2">
          <button onClick={() => mutation.mutate()} disabled={mutation.isPending}
            className="flex items-center gap-1 text-xs bg-[#1e3a5f] hover:bg-[#2563eb] text-white px-3 py-1.5 rounded-lg transition disabled:opacity-40">
            <Check size={12} /> Salva
          </button>
          <button onClick={onClose} className="flex items-center gap-1 text-xs text-gray-500 hover:bg-gray-100 px-3 py-1.5 rounded-lg transition">
            <X size={12} /> Annulla
          </button>
        </div>
      </td>
    </>
  )
}

function ResetPasswordModal({ user, onClose }) {
  const [password, setPassword] = useState("")
  const [done, setDone] = useState(false)
  const mutation = useMutation({
    mutationFn: () => authApi.resetPassword(user.id, password),
    onSuccess: () => setDone(true),
  })
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-gray-800">Reset password</h2>
          <button onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"><X size={18} /></button>
        </div>
        <p className="text-sm text-gray-500">Utente: <strong>{user.full_name || user.username}</strong></p>
        {done ? (
          <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-sm text-green-700">Password aggiornata con successo.</div>
        ) : (
          <>
            <input type="password" placeholder="Nuova password *" value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} />
            <div className="flex gap-2 justify-end">
              <button onClick={onClose} className="px-4 py-2 text-sm text-gray-500 hover:bg-gray-100 rounded-xl transition">Annulla</button>
              <button onClick={() => mutation.mutate()} disabled={!password || mutation.isPending}
                className="px-5 py-2 text-sm bg-[#1e3a5f] hover:bg-[#2563eb] text-white font-semibold rounded-xl shadow transition disabled:opacity-40">
                {mutation.isPending ? "Salvataggio..." : "Conferma"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Users Table ───────────────────────────────────────────────────────────────

function UsersTable({
  users, isLoading,
  editingId, setEditingId, onSaved,
  onChangeType, onReset,
  confirmToggle, setConfirmToggle, onToggleExecute,
  confirmDelete, setConfirmDelete, onDeleteExecute,
}) {
  const [search, setSearch] = useState("")

  const filtered = users.filter((u) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      u.username.toLowerCase().includes(q) ||
      (u.full_name || "").toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.department.toLowerCase().includes(q)
    )
  })

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          placeholder="Cerca per username, nome, email, tipo..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2563eb] focus:border-transparent outline-none transition text-sm"
        />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="py-16 text-center text-gray-400 text-sm">Caricamento...</div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-gray-400 text-sm">Nessun utente trovato.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-gray-600 font-semibold text-xs">
                <th className="px-4 py-3 text-left">Username</th>
                <th className="px-4 py-3 text-left">Nome</th>
                <th className="px-4 py-3 text-left">Email</th>
                <th className="px-4 py-3 text-left">Tipo</th>
                <th className="px-4 py-3 text-left">Stato</th>
                <th className="px-4 py-3 text-left">Ultimo accesso</th>
                <th className="px-4 py-3 text-left"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((user) => (
                <tr key={user.id} className="border-b border-gray-100 last:border-0 odd:bg-white even:bg-gray-50/50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">{user.username}</td>
                  {editingId === user.id ? (
                    <EditRow user={user} onClose={() => setEditingId(null)} onSaved={onSaved} />
                  ) : (
                    <>
                      <td className="px-4 py-3 text-gray-800 font-medium">{user.full_name || "—"}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{user.email}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded ${USER_TYPE_BADGE[user.department] || "bg-gray-100 text-gray-500"}`}>
                          {user.department}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded font-medium ${user.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-400"}`}>
                          {user.is_active ? "Attivo" : "Disattivato"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400">
                        {user.last_login ? new Date(user.last_login).toLocaleString("it-IT") : "Mai"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button onClick={() => setEditingId(user.id)} title="Modifica" className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"><Pencil size={14} /></button>
                          <button onClick={() => onChangeType(user)} title="Cambia tipo" className="p-1.5 rounded-lg text-gray-400 hover:text-violet-600 hover:bg-violet-50 transition"><ShieldCheck size={14} /></button>
                          <button onClick={() => onReset(user)} title="Reset password" className="p-1.5 rounded-lg text-gray-400 hover:text-[#2563eb] hover:bg-blue-50 transition"><KeyRound size={14} /></button>
                          {confirmToggle === user.id ? (
                            <span className="flex items-center gap-1">
                              <span className="text-xs text-red-600 font-medium">Confermi?</span>
                              <button onClick={() => onToggleExecute(user)} className="p-0.5 text-red-600 hover:text-red-800"><Check size={13} /></button>
                              <button onClick={() => setConfirmToggle(null)} className="p-0.5 text-gray-400 hover:text-gray-600"><X size={13} /></button>
                            </span>
                          ) : (
                            <button onClick={() => setConfirmToggle(user.id)} title={user.is_active ? "Disattiva" : "Riattiva"}
                              className={`p-1.5 rounded-lg transition ${user.is_active ? "text-gray-300 hover:text-red-500 hover:bg-red-50" : "text-gray-300 hover:text-green-600 hover:bg-green-50"}`}>
                              {user.is_active ? <UserX size={14} /> : <UserCheck size={14} />}
                            </button>
                          )}
                          {confirmDelete === user.id ? (
                            <span className="flex items-center gap-1 ml-1">
                              <span className="text-xs text-red-600 font-medium">Elimina?</span>
                              <button onClick={() => onDeleteExecute(user.id)} className="p-0.5 text-red-600 hover:text-red-800"><Check size={13} /></button>
                              <button onClick={() => setConfirmDelete(null)} className="p-0.5 text-gray-400 hover:text-gray-600"><X size={13} /></button>
                            </span>
                          ) : (
                            <button onClick={() => setConfirmDelete(user.id)} title="Elimina utente"
                              className="p-1.5 rounded-lg text-gray-300 hover:text-red-600 hover:bg-red-50 transition">
                              <Trash2 size={14} />
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
        )}
      </div>
      {!isLoading && (
        <p className="text-xs text-gray-400">
          {filtered.length === users.length ? `${users.length} utenti` : `${filtered.length} di ${users.length} utenti`}
        </p>
      )}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function AdminUsers() {
  const qc = useQueryClient()
  const [showNew, setShowNew] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [resetUser, setResetUser] = useState(null)
  const [changeTypeUser, setChangeTypeUser] = useState(null)
  const [confirmToggle, setConfirmToggle] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [userTab, setUserTab] = useState("all")

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => authApi.listUsers().then((r) => r.data.filter((u) => u.department !== "SUPERUSER")),
  })

  const toggleActive = useMutation({
    mutationFn: (user) => authApi.updateUser(user.id, { is_active: !user.is_active }),
    onSuccess: () => { qc.invalidateQueries(["admin-users"]); setConfirmToggle(null) },
  })

  const deleteUser = useMutation({
    mutationFn: (userId) => authApi.deleteUser(userId),
    onSuccess: () => { qc.invalidateQueries(["admin-users"]); setConfirmDelete(null) },
  })

  const invalidate = () => qc.invalidateQueries(["admin-users"])

  const activeTab = USER_TABS.find((t) => t.value === userTab)
  const tabUsers = activeTab ? users.filter(activeTab.filter) : users

  return (
    <div className="space-y-4">
      {showNew && <NewUserModal onClose={() => setShowNew(false)} onSaved={invalidate} />}
      {resetUser && <ResetPasswordModal user={resetUser} onClose={() => setResetUser(null)} />}
      {changeTypeUser && (
        <ChangeTypeModal user={changeTypeUser} onClose={() => setChangeTypeUser(null)} onSaved={invalidate} />
      )}

      <div>
        <h1 className="text-xl font-bold text-gray-800">Amministrazione</h1>
        <p className="text-xs text-gray-400 mt-0.5">Gestione utenti e accesso moduli</p>
      </div>

      <Tabs.Root defaultValue="users">
        <Tabs.List className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit mb-5">
          {[
            { value: "users", label: "Utenti" },
            { value: "modules", label: "Accesso Moduli" },
            { value: "utilities", label: "Utilities" },
          ].map((tab) => (
            <Tabs.Trigger key={tab.value} value={tab.value}
              className="px-4 py-2 rounded-lg text-sm font-medium transition data-[state=active]:bg-white data-[state=active]:text-[#1e3a5f] data-[state=active]:shadow-sm text-gray-500 hover:text-gray-700">
              {tab.label}
            </Tabs.Trigger>
          ))}
        </Tabs.List>

        <Tabs.Content value="users">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
                {USER_TABS.map((t) => {
                  const count = users.filter(t.filter).length
                  return (
                    <button key={t.value} onClick={() => setUserTab(t.value)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                        userTab === t.value
                          ? "bg-white text-[#1e3a5f] shadow-sm"
                          : "text-gray-500 hover:text-gray-700"
                      }`}>
                      {t.label}
                      <span className="ml-1.5 text-gray-400 font-normal">{count}</span>
                    </button>
                  )
                })}
              </div>
              <button onClick={() => setShowNew(true)}
                className="flex items-center gap-2 bg-[#1e3a5f] hover:bg-[#2563eb] text-white font-semibold py-2.5 px-5 rounded-xl shadow transition text-sm">
                <Plus size={16} /> Nuovo utente
              </button>
            </div>

            <UsersTable
              users={tabUsers}
              isLoading={isLoading}
              editingId={editingId}
              setEditingId={setEditingId}
              onSaved={invalidate}
              onChangeType={setChangeTypeUser}
              onReset={setResetUser}
              confirmToggle={confirmToggle}
              setConfirmToggle={setConfirmToggle}
              onToggleExecute={(user) => toggleActive.mutate(user)}
              confirmDelete={confirmDelete}
              setConfirmDelete={setConfirmDelete}
              onDeleteExecute={(userId) => deleteUser.mutate(userId)}
            />
          </div>
        </Tabs.Content>

        <Tabs.Content value="modules">
          <ModuleConfig />
        </Tabs.Content>

        <Tabs.Content value="utilities">
          <UtilitiesConfig />
        </Tabs.Content>
      </Tabs.Root>
    </div>
  )
}
