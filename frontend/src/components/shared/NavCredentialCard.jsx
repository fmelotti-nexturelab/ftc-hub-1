import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { User, Key, Pencil, Check, Plus, Trash2, X } from "lucide-react"
import { navisionApi } from "@/api/navision"
import { agentFocusRdp } from "@/lib/navAgent"

const ENVS  = ["IT01", "IT02", "IT03"]
const DEPTS = ["HO", "IT", "COMMERCIAL", "ADMIN", "SUPERUSER"]

// ── CredRow ───────────────────────────────────────────────────────────────────

export function CredRow({ cred, canManage, onDelete }) {
  const queryClient = useQueryClient()
  const [copied, setCopied]   = useState(null)
  const [editing, setEditing] = useState(false)
  const [newPwd, setNewPwd]   = useState("")

  const updatePwd = useMutation({
    mutationFn: ({ id, pwd }) => navisionApi.updatePassword(id, pwd),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nav-credentials"] })
      setEditing(false)
      setNewPwd("")
    },
  })

  function copy(type) {
    const text = type === "user" ? cred.nav_username : cred.nav_password
    navigator.clipboard.writeText(text ?? "")
    setCopied(type)
    agentFocusRdp()
    setTimeout(() => setCopied(null), 1800)
  }

  const btnBase = "flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-md border transition focus-visible:ring-2 focus-visible:ring-[#2563eb]"

  return (
    <div className="group py-1.5">
      <div className="flex items-center gap-2">
        <span className="flex-1 text-[13px] font-medium text-gray-700 truncate">{cred.nav_username}</span>
        <span className="text-xs text-gray-300 font-mono">••••••••</span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => copy("user")}
            aria-label={`Copia username ${cred.nav_username}`}
            className={`${btnBase} ${
              copied === "user"
                ? "bg-emerald-50 border-emerald-300 text-emerald-600"
                : "border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-gray-500"
            }`}
          >
            <User size={10} aria-hidden="true" />
            {copied === "user" ? "OK" : "User"}
          </button>
          <button
            onClick={() => copy("pwd")}
            aria-label={`Copia password di ${cred.nav_username}`}
            className={`${btnBase} ${
              copied === "pwd"
                ? "bg-emerald-50 border-emerald-300 text-emerald-600"
                : "border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-gray-500"
            }`}
          >
            <Key size={10} aria-hidden="true" />
            {copied === "pwd" ? "OK" : "Pwd"}
          </button>
          {canManage && (
            <button
              onClick={() => { setEditing((e) => !e); setNewPwd("") }}
              aria-label={`Modifica password di ${cred.nav_username}`}
              className={`${btnBase} border-gray-200 hover:border-amber-300 hover:bg-amber-50 text-gray-400 hover:text-amber-600`}
            >
              <Pencil size={10} aria-hidden="true" />
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => { if (window.confirm(`Eliminare ${cred.nav_username}?`)) onDelete() }}
              aria-label={`Elimina credenziale ${cred.nav_username}`}
              className="flex items-center text-[11px] px-1.5 py-1 rounded-md border border-transparent hover:border-red-200 hover:bg-red-50 text-gray-300 hover:text-red-500 transition opacity-0 group-hover:opacity-100"
            >
              <Trash2 size={10} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
      {editing && (
        <div className="flex gap-1.5 mt-2">
          <label htmlFor={`edit-pwd-${cred.id}`} className="sr-only">Nuova password</label>
          <input
            id={`edit-pwd-${cred.id}`}
            type="password"
            value={newPwd}
            onChange={(e) => setNewPwd(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && newPwd && updatePwd.mutate({ id: cred.id, pwd: newPwd })}
            placeholder="Nuova password…"
            className="flex-1 text-xs px-3 py-1.5 rounded-lg bg-gray-50 text-gray-800 placeholder-gray-400 border border-gray-300 outline-none focus:ring-2 focus:ring-[#2563eb] focus:border-transparent transition"
          />
          <button
            onClick={() => newPwd && updatePwd.mutate({ id: cred.id, pwd: newPwd })}
            disabled={!newPwd || updatePwd.isPending}
            aria-label="Salva nuova password"
            className="flex items-center gap-1 text-[11px] font-medium px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white disabled:opacity-40 transition"
          >
            <Check size={10} aria-hidden="true" />
          </button>
          <button
            onClick={() => setEditing(false)}
            aria-label="Annulla modifica password"
            className="flex items-center text-[11px] px-2 py-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition"
          >
            <X size={10} aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  )
}

// ── CredentialCard (per env) ─────────────────────────────────────────────────

export default function NavCredentialCard({ env, credentials, canManage, onClose }) {
  const queryClient = useQueryClient()
  const rows = (credentials ?? []).filter((c) => c.nav_env === env)

  const [addOpen, setAddOpen] = useState(false)
  const [form, setForm]       = useState({ department: "HO", nav_env: env, nav_username: "", nav_password: "" })

  const addMut = useMutation({
    mutationFn: (data) => navisionApi.addCredential(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nav-credentials"] })
      setForm({ department: "HO", nav_env: env, nav_username: "", nav_password: "" })
      setAddOpen(false)
    },
  })

  const deleteMut = useMutation({
    mutationFn: (id) => navisionApi.deleteCredential(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["nav-credentials"] }),
  })

  const envColors = { IT01: "text-blue-700",    IT02: "text-emerald-700",  IT03: "text-violet-700" }
  const envBorder = { IT01: "border-blue-200",  IT02: "border-emerald-200", IT03: "border-violet-200" }

  return (
    <div className={`bg-white rounded-xl border ${envBorder[env] ?? "border-gray-200"} shadow-sm p-4`}>
      <div className="flex items-center gap-2 mb-3">
        <span className={`text-sm font-bold ${envColors[env] ?? "text-gray-700"}`}>Credenziali NAV {env}</span>
        <div className="flex-1" />
        {canManage && (
          <button
            onClick={() => setAddOpen((v) => !v)}
            aria-label={`Aggiungi credenziale ${env}`}
            className={`p-1 rounded-md transition focus-visible:ring-2 focus-visible:ring-[#2563eb] ${
              addOpen ? "text-blue-600 bg-blue-50" : "text-gray-400 hover:text-gray-600 hover:bg-gray-50"
            }`}
          >
            <Plus size={14} aria-hidden="true" />
          </button>
        )}
        {onClose && (
          <button
            onClick={onClose}
            aria-label="Chiudi pannello credenziali"
            className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition focus-visible:ring-2 focus-visible:ring-[#2563eb]"
          >
            <X size={14} aria-hidden="true" />
          </button>
        )}
      </div>

      {/* add form */}
      {addOpen && canManage && (
        <div className="mb-3 p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor={`add-dept-${env}`} className="sr-only">Department</label>
              <select
                id={`add-dept-${env}`}
                value={form.department}
                onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}
                className="w-full text-xs px-2.5 py-1.5 rounded-lg bg-white text-gray-700 border border-gray-300 outline-none focus:ring-2 focus:ring-[#2563eb] focus:border-transparent transition"
              >
                {DEPTS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor={`add-env-${env}`} className="sr-only">Ambiente NAV</label>
              <select
                id={`add-env-${env}`}
                value={form.nav_env}
                onChange={(e) => setForm((f) => ({ ...f, nav_env: e.target.value }))}
                className="w-full text-xs px-2.5 py-1.5 rounded-lg bg-white text-gray-700 border border-gray-300 outline-none focus:ring-2 focus:ring-[#2563eb] focus:border-transparent transition"
              >
                {ENVS.map((e) => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
          </div>
          <input
            type="text"
            value={form.nav_username}
            onChange={(e) => setForm((f) => ({ ...f, nav_username: e.target.value }))}
            placeholder="Username"
            aria-label={`Username nuova credenziale ${env}`}
            className="w-full text-xs px-2.5 py-1.5 rounded-lg bg-white text-gray-700 placeholder-gray-400 border border-gray-300 outline-none focus:ring-2 focus:ring-[#2563eb] focus:border-transparent transition"
          />
          <input
            type="password"
            value={form.nav_password}
            onChange={(e) => setForm((f) => ({ ...f, nav_password: e.target.value }))}
            onKeyDown={(e) => e.key === "Enter" && form.nav_username.trim() && form.nav_password.trim() && addMut.mutate(form)}
            placeholder="Password"
            aria-label={`Password nuova credenziale ${env}`}
            className="w-full text-xs px-2.5 py-1.5 rounded-lg bg-white text-gray-700 placeholder-gray-400 border border-gray-300 outline-none focus:ring-2 focus:ring-[#2563eb] focus:border-transparent transition"
          />
          <button
            onClick={() => form.nav_username.trim() && form.nav_password.trim() && addMut.mutate(form)}
            disabled={!form.nav_username.trim() || !form.nav_password.trim() || addMut.isPending}
            className="w-full text-xs font-semibold py-2 rounded-lg bg-[#1e3a5f] hover:bg-[#2563eb] text-white disabled:opacity-40 transition"
          >
            {addMut.isPending ? "Salvataggio…" : "Aggiungi"}
          </button>
          {addMut.isError && (
            <p className="text-[11px] text-red-600">{addMut.error?.response?.data?.detail ?? "Errore"}</p>
          )}
        </div>
      )}

      {/* credentials list */}
      {rows.length === 0 ? (
        <p className="text-xs text-gray-400 py-2">Nessuna credenziale</p>
      ) : (
        <div className="divide-y divide-gray-100">
          {rows.map((c) => (
            <CredRow
              key={c.id}
              cred={c}
              canManage={canManage}
              onDelete={canManage ? () => deleteMut.mutate(c.id) : null}
            />
          ))}
        </div>
      )}
    </div>
  )
}
