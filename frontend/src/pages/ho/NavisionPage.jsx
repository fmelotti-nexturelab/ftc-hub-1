import { useState, useCallback, useRef, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  Monitor, LogOut, ScreenShare, Terminal, AlertTriangle, X,
  User, Key, Pencil, Check, Plus, Trash2, Play, CircleCheck, CircleX, Download,
} from "lucide-react"
import { navisionApi } from "@/api/navision"
import { useAuthStore } from "@/store/authStore"

// ── Helpers ──────────────────────────────────────────────────────────────────

function now() {
  return new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
}

const AGENT_URL = "http://localhost:9999"

function agentSnap() {
  fetch(`${AGENT_URL}/snap`, { method: "POST" }).catch(() => {})
}

function agentRestore() {
  fetch(`${AGENT_URL}/restore`, { method: "POST" }).catch(() => {})
}

function agentFocusRdp() {
  fetch(`${AGENT_URL}/focus`, { method: "POST" }).catch(() => {})
}

// Fallback hardcoded — usati solo se il config backend non ha il valore
const RDP_FILENAMES_DEFAULT = {
  it01_classic: "NAV IT01.rdp",
  archivio:     "NAV archivio.rdp",
  it02_classic: "NAV IT02.rdp",
  it02_new:     "NEW NAV IT02.rdp",
  it03_classic: "NAV IT03.rdp",
  it03_new:     "NEW NAV IT03.rdp",
}


const SESSION_BUTTONS = [
  { key: "it01_classic", label: "NAV IT01",     sub: "CLASSIC", env: "IT01", color: "bg-emerald-500 hover:bg-emerald-600" },
  { key: "it02_classic", label: "NAV IT02",     sub: "CLASSIC", env: "IT02", color: "bg-emerald-500 hover:bg-emerald-600" },
  { key: "it02_new",     label: "NAV IT02",     sub: "NEW",     env: "IT02", color: "bg-teal-500 hover:bg-teal-600" },
  { key: "it03_classic", label: "NAV IT03",     sub: "CLASSIC", env: "IT03", color: "bg-violet-600 hover:bg-violet-700" },
  { key: "it03_new",     label: "NAV IT03",     sub: "NEW",     env: "IT03", color: "bg-red-500 hover:bg-red-600" },
  { key: "archivio",     label: "ARCHIVIO",     sub: "IT01 · fino giu 2024", env: "IT01", color: "bg-gray-500 hover:bg-gray-600" },
]

const ENVS = ["IT01", "IT02", "IT03"]
const DEPTS = ["HO", "IT", "COMMERCIAL", "ADMIN", "SUPERUSER"]

// ── CredRow ───────────────────────────────────────────────────────────────────

function CredRow({ cred, canManage, onDelete }) {
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

function CredentialCard({ env, credentials, canManage, onClose }) {
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

  const envColors = { IT01: "text-blue-700", IT02: "text-emerald-700", IT03: "text-violet-700" }
  const envBorder = { IT01: "border-blue-200", IT02: "border-emerald-200", IT03: "border-violet-200" }

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

// ── ActivityLog ───────────────────────────────────────────────────────────────

function ActivityLog({ entries }) {
  const endRef = useRef(null)
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [entries])

  if (entries.length === 0) return null

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
      <div className="flex items-center gap-2 mb-3">
        <Terminal size={14} className="text-gray-500" aria-hidden="true" />
        <span className="text-xs font-semibold text-gray-500 tracking-wider uppercase">Log attività</span>
      </div>
      <div className="space-y-1 max-h-36 overflow-y-auto pr-1 scrollbar-thin bg-gray-50 rounded-lg p-3">
        {entries.map((e, i) => (
          <div key={i} className="flex items-start gap-2 text-xs font-mono">
            <span className="text-gray-400 shrink-0">{e.time}</span>
            <span className="text-gray-600">{e.message}</span>
          </div>
        ))}
        <div ref={endRef} />
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function NavisionPage() {
  const navigate    = useNavigate()
  const { canManage } = useAuthStore()
  const [log, setLog]                     = useState([])
  const [folderWarning, setFolderWarning] = useState(false)
  const [agentOk, setAgentOk]             = useState(null) // null = checking, true/false
  const [activeEnv, setActiveEnv]         = useState(null)  // "IT01" | "IT02" | "IT03" | null
  const canManageNav = canManage("navision")

  const { data: credentials } = useQuery({
    queryKey: ["nav-credentials"],
    queryFn: navisionApi.getCredentials,
    staleTime: 5 * 60 * 1000,
  })

  const rdpFolder = localStorage.getItem("navision_rdp_folder") || ""

  const addLog = useCallback((message) => {
    setLog((prev) => [...prev.slice(-49), { time: now(), message }])
  }, [])

  // ── Agent health check ──
  const checkAgent = useCallback(async () => {
    try {
      const res = await fetch(`${AGENT_URL}/ping`, { signal: AbortSignal.timeout(2000) })
      setAgentOk(res.ok)
    } catch {
      setAgentOk(false)
    }
  }, [])

  useEffect(() => { checkAgent() }, [checkAgent])

  async function handleRetryAgent() {
    setAgentOk(null)
    addLog("Verifica agente in corso…")
    try {
      const res = await fetch(`${AGENT_URL}/ping`, { signal: AbortSignal.timeout(2000) })
      if (res.ok) {
        setAgentOk(true)
        addLog("Agente attivo!")
        return
      }
    } catch { /* non raggiungibile */ }
    setAgentOk(false)
    addLog("Agente non raggiungibile — scarica e installa l'agente")
  }

  async function handleDownloadAgent() {
    addLog("Download installer agente…")
    try {
      await navisionApi.downloadAgentInstaller()
      addLog("Download completato — esegui installa_agente.bat dal file zip scaricato")
    } catch {
      addLog("Errore nel download dell'installer")
    }
  }

  async function handleRdpOpen(key, label, env) {
    setActiveEnv(env)

    if (!rdpFolder.trim()) {
      setFolderWarning(true)
      addLog("Cartella RDP non configurata — vai in Impostazioni NAV Agent")
      return
    }

    const filename    = RDP_FILENAMES_DEFAULT[key] ?? `${key}.rdp`
    const cleanFolder = rdpFolder.trim().replace(/^["']|["']$/g, "").replace(/[/\\]+$/, "")
    const fullPath    = `${cleanFolder}\\${filename}`

    // Cerca la credenziale per questo ambiente
    const creds = Array.isArray(credentials) ? credentials : []
    const cred = creds.find((c) => c.nav_env === env)

    if (cred?.nav_username && cred?.nav_password) {
      // Auto-login: invia credenziali all'agente
      addLog(`Auto-login ${label} (${cred.nav_username})...`)
      try {
        const res = await fetch(`${AGENT_URL}/open-auto`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            path: fullPath,
            username: cred.nav_username,
            password: cred.nav_password,
          }),
        })

        if (res.ok) {
          setFolderWarning(false)
          setAgentOk(true)
          addLog(`Avvio ${label} con auto-login...`)
          setTimeout(() => agentSnap(), 1500)
        } else {
          const data = await res.json().catch(() => ({}))
          addLog(data.error || `Errore avvio ${label}`)
        }
      } catch {
        setAgentOk(false)
        addLog("Agente NAV non raggiungibile — esegui installa_agente.bat")
      }
    } else {
      // Fallback: apertura senza credenziali (chiede password)
      addLog(`Invio percorso: ${fullPath}`)
      try {
        const res = await fetch(`${AGENT_URL}/open`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: fullPath }),
        })

        if (res.ok) {
          setFolderWarning(false)
          setAgentOk(true)
          addLog(`Avvio ${label}...`)
          setTimeout(() => agentSnap(), 1500)
        } else {
          addLog(`File non trovato — percorso inviato: ${fullPath}`)
        }
      } catch {
        setAgentOk(false)
        addLog("Agente NAV non raggiungibile — esegui installa_agente.bat")
      }
    }
  }

  async function handleKillSessions() {
    addLog("Chiusura sessioni in corso…")
    try {
      const res = await fetch(`${AGENT_URL}/kill`, { method: "POST" })
      const data = await res.json()
      addLog(data.killed > 0 ? `${data.killed} sessioni chiuse` : "Nessuna sessione attiva")
    } catch {
      addLog("Agente non raggiungibile — impossibile chiudere le sessioni")
    }
  }

  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-800">Navision</h1>
        </div>
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition focus-visible:ring-2 focus-visible:ring-[#2563eb]"
        >
          <LogOut size={15} aria-hidden="true" />
          Esci
        </button>
      </div>

      {/* ── Info card con stato agente ── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center">
            <Monitor size={20} className="text-gray-600" aria-hidden="true" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-gray-800">Microsoft Dynamics NAV 2009 R2</p>
            <p className="text-xs text-gray-400 mt-0.5">Sessioni Remote Desktop per Navision</p>
          </div>
          <div className="flex items-center gap-2">
            {agentOk === true && (
              <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-1.5">
                <CircleCheck size={14} aria-hidden="true" />
                Agent OK
              </span>
            )}
            {agentOk === null && (
              <span className="flex items-center gap-1.5 text-xs text-gray-400 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5">
                <Play size={14} aria-hidden="true" />
                Verifica…
              </span>
            )}
          </div>
        </div>

        {/* Pannello installazione agente */}
        {agentOk === false && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle size={18} className="text-red-500 mt-0.5 shrink-0" aria-hidden="true" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-red-700">Agente NAV non attivo</p>
                <p className="text-xs text-red-600 mt-1">
                  L'agente locale è necessario per aprire le sessioni Navision.
                  Scarica il pacchetto, estrai lo zip ed esegui <strong>installa_agente.bat</strong>.
                </p>
                <div className="flex items-center gap-2 mt-3">
                  <button
                    onClick={handleDownloadAgent}
                    className="flex items-center gap-1.5 text-xs font-semibold bg-[#1e3a5f] hover:bg-[#2563eb] text-white px-4 py-2 rounded-lg shadow transition focus-visible:ring-2 focus-visible:ring-[#2563eb]"
                    aria-label="Scarica installer agente NAV"
                  >
                    <Download size={13} aria-hidden="true" />
                    Scarica Installer
                  </button>
                  <button
                    onClick={handleRetryAgent}
                    className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 transition focus-visible:ring-2 focus-visible:ring-[#2563eb]"
                    aria-label="Riprova connessione agente"
                  >
                    <Play size={13} aria-hidden="true" />
                    Riprova
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Bottoni sessione NAV ── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-semibold text-gray-700">Apri sessione NAV</p>
          <button
            onClick={handleKillSessions}
            className="flex items-center gap-1.5 text-xs font-semibold text-red-600 border border-red-200 rounded-lg px-3 py-1.5 hover:bg-red-50 transition focus-visible:ring-2 focus-visible:ring-red-400"
            aria-label="Chiudi tutte le sessioni NAV"
          >
            <Terminal size={13} aria-hidden="true" />
            Chiudi tutte le sessioni
          </button>
        </div>

        <div className="flex gap-3">
          {SESSION_BUTTONS.map(({ key, label, sub, env, color }) => (
            <button
              key={key}
              onClick={() => handleRdpOpen(key, `${label} ${sub}`, env)}
              className={`flex-1 flex flex-col items-center gap-1 ${color} text-white font-semibold rounded-xl py-3 shadow transition focus-visible:ring-2 focus-visible:ring-[#2563eb]`}
              aria-label={`Apri ${label} ${sub}`}
            >
              <Monitor size={18} aria-hidden="true" />
              <span className="text-sm">{label}</span>
              <span className="text-[10px] font-medium text-white/70 uppercase tracking-wider">{sub}</span>
            </button>
          ))}
        </div>

        {folderWarning && (
          <div className="mt-4 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700" role="alert">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>Configura la <strong>cartella dei file RDP</strong> nelle impostazioni.</span>
            <button onClick={() => navigate("/settings")} className="ml-auto shrink-0 underline hover:text-amber-900 transition">
              Vai a Impostazioni
            </button>
          </div>
        )}
      </div>

      {/* ── Credenziali NAV — card singola per env selezionato ── */}
      {activeEnv && (
        <CredentialCard
          key={activeEnv}
          env={activeEnv}
          credentials={credentials}
          canManage={canManageNav}
          onClose={() => { setActiveEnv(null); agentRestore() }}
        />
      )}

      {/* ── Activity log ── */}
      <ActivityLog entries={log} />
    </div>
  )
}
