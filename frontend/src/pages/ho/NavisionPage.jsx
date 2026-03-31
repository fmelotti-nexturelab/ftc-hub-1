import { useState, useCallback, useRef, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Monitor, LogOut, ScreenShare, Terminal, AlertTriangle, X, User, Key, Pencil, Check, Plus, Trash2 } from "lucide-react"
import { navisionApi } from "@/api/navision"
import { useAuthStore } from "@/store/authStore"

// ── Helpers ──────────────────────────────────────────────────────────────────

function now() {
  return new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
}

// ── Window management via agente locale ──────────────────────────────────────

function agentSnap() {
  fetch("http://localhost:9999/snap", { method: "POST" }).catch(() => {})
}

function agentRestore() {
  fetch("http://localhost:9999/restore", { method: "POST" }).catch(() => {})
}

function agentFocusRdp() {
  fetch("http://localhost:9999/focus", { method: "POST" }).catch(() => {})
}

// Nome effettivo del file .rdp nella cartella locale dell'utente
const RDP_FILENAMES = {
  it01_classic: "NAV IT01.rdp",
  archivio:     "NAV archivio.rdp",
  it02_classic: "NAV IT02.rdp",
  it02_new:     "NEW NAV IT02.rdp",
  it03_classic: "NAV IT03.rdp",
  it03_new:     "NEW NAV IT03.rdp",
}



// ── CredRow ───────────────────────────────────────────────────────────────────

function CredRow({ cred, canManage, onDelete, onPwdCopied }) {
  const queryClient                   = useQueryClient()
  const [copied, setCopied]           = useState(null)   // "user" | "pwd"
  const [editing, setEditing]         = useState(false)
  const [newPwd, setNewPwd]           = useState("")

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
    // Porta mstsc in primo piano via agente locale
    agentFocusRdp()
    if (type === "pwd" && onPwdCopied) {
      setTimeout(() => onPwdCopied(), 800)
    }
    setTimeout(() => setCopied(null), 1800)
  }

  return (
    <div className="group py-2.5 px-3 rounded-lg hover:bg-white/[0.04] transition">
      <div className="flex items-center gap-2">
        <span className="flex-1 text-[13px] font-medium text-white/85 tracking-wide truncate">{cred.nav_username}</span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => copy("user")}
            aria-label={`Copia username ${cred.nav_username}`}
            className={`flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-md border transition ${
              copied === "user"
                ? "bg-emerald-500/20 border-emerald-400/30 text-emerald-300"
                : "border-white/10 hover:border-white/25 hover:bg-white/10 text-white/60 hover:text-white/90"
            }`}
          >
            <User size={10} aria-hidden="true" />
            {copied === "user" ? "Copiato" : "User"}
          </button>
          <button
            onClick={() => copy("pwd")}
            aria-label={`Copia password di ${cred.nav_username}`}
            className={`flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-md border transition ${
              copied === "pwd"
                ? "bg-emerald-500/20 border-emerald-400/30 text-emerald-300"
                : "border-white/10 hover:border-white/25 hover:bg-white/10 text-white/60 hover:text-white/90"
            }`}
          >
            <Key size={10} aria-hidden="true" />
            {copied === "pwd" ? "Copiato" : "Pwd"}
          </button>
          {canManage && (
            <button
              onClick={() => { setEditing((e) => !e); setNewPwd("") }}
              aria-label={`Modifica password di ${cred.nav_username}`}
              className="flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-md border border-white/10 hover:border-amber-400/30 hover:bg-amber-500/10 text-white/60 hover:text-amber-300 transition"
            >
              <Pencil size={10} aria-hidden="true" />
              Mod
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => { if (window.confirm(`Eliminare ${cred.nav_username}?`)) onDelete() }}
              aria-label={`Elimina credenziale ${cred.nav_username}`}
              className="flex items-center text-[11px] px-1.5 py-1 rounded-md border border-transparent hover:border-red-400/30 hover:bg-red-500/10 text-white/30 hover:text-red-300 transition opacity-0 group-hover:opacity-100"
            >
              <Trash2 size={10} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
      {editing && (
        <div className="flex gap-1.5 mt-2 pl-0">
          <input
            type="password"
            value={newPwd}
            onChange={(e) => setNewPwd(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && newPwd && updatePwd.mutate({ id: cred.id, pwd: newPwd })}
            placeholder="Nuova password…"
            aria-label="Nuova password"
            className="flex-1 text-xs px-3 py-1.5 rounded-md bg-white/[0.06] text-white placeholder-white/25 border border-white/15 outline-none focus:border-blue-400/50 focus:bg-white/[0.08] transition"
          />
          <button
            onClick={() => newPwd && updatePwd.mutate({ id: cred.id, pwd: newPwd })}
            disabled={!newPwd || updatePwd.isPending}
            aria-label="Salva nuova password"
            className="flex items-center gap-1 text-[11px] font-medium px-3 py-1.5 rounded-md bg-emerald-600/80 hover:bg-emerald-500/80 text-white disabled:opacity-40 transition"
          >
            <Check size={10} aria-hidden="true" />
          </button>
          <button
            onClick={() => setEditing(false)}
            aria-label="Annulla modifica password"
            className="flex items-center text-[11px] px-2 py-1.5 rounded-md hover:bg-white/10 text-white/50 hover:text-white/80 transition"
          >
            <X size={10} aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  )
}

// ── CredentialsPanel ──────────────────────────────────────────────────────────

const ENVS = ["IT01", "IT02", "IT03"]
const DEPTS = ["HO", "IT", "COMMERCIAL", "ADMIN", "SUPERUSER"]

function CredentialsPanel({ open, onClose, rdpLabel, credentials, canManage }) {
  const queryClient = useQueryClient()
  const byEnv = (env) => (credentials ?? []).filter((c) => c.nav_env === env)

  const [addOpen, setAddOpen]     = useState(false)
  const [form, setForm]           = useState({ department: "HO", nav_env: "IT01", nav_username: "", nav_password: "" })

  const addMut = useMutation({
    mutationFn: (data) => navisionApi.addCredential(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nav-credentials"] })
      setForm({ department: "HO", nav_env: "IT01", nav_username: "", nav_password: "" })
      setAddOpen(false)
    },
  })

  const deleteMut = useMutation({
    mutationFn: (id) => navisionApi.deleteCredential(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["nav-credentials"] }),
  })

  function submitAdd() {
    if (!form.nav_username.trim() || !form.nav_password.trim()) return
    addMut.mutate(form)
  }

  return (
    <div className="rounded-xl overflow-hidden border border-white/[0.08] shadow-lg" style={{ background: "linear-gradient(135deg, #0f1f36 0%, #162d4d 50%, #1a3354 100%)" }}>
      {/* header */}
      <div className="flex items-center gap-3 px-6 py-3.5 border-b border-white/[0.06] bg-white/[0.02]">
        <Key size={15} className="text-blue-400/70" aria-hidden="true" />
        <span className="flex-1 text-sm font-semibold text-white/90 tracking-wide">{rdpLabel || "Credenziali NAV"}</span>
        {canManage && (
          <button
            onClick={() => setAddOpen((v) => !v)}
            aria-label="Aggiungi credenziale"
            className={`p-1 rounded-md transition focus-visible:ring-2 focus-visible:ring-blue-400 ${addOpen ? "text-blue-300 bg-blue-500/15" : "text-white/35 hover:text-white/70 hover:bg-white/[0.06]"}`}
          >
            <Plus size={15} aria-hidden="true" />
          </button>
        )}
        <button
          onClick={onClose}
          aria-label="Chiudi pannello credenziali"
          className="p-1 rounded-md text-white/35 hover:text-white/70 hover:bg-white/[0.06] transition focus-visible:ring-2 focus-visible:ring-blue-400"
        >
          <X size={15} aria-hidden="true" />
        </button>
      </div>

      {/* add form */}
      {addOpen && canManage && (
        <div className="px-6 py-4 border-b border-white/[0.06] space-y-2.5 bg-white/[0.02]">
          <p className="text-[10px] font-semibold text-blue-300/50 uppercase tracking-[0.15em]">Nuova credenziale</p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="add-dept" className="sr-only">Department</label>
              <select
                id="add-dept"
                value={form.department}
                onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}
                className="w-full text-xs px-2.5 py-1.5 rounded-md bg-white/[0.06] text-white/80 border border-white/10 outline-none focus:border-blue-400/40 transition"
              >
                {DEPTS.map((d) => <option key={d} value={d} className="bg-[#162d4d]">{d}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="add-env" className="sr-only">Ambiente NAV</label>
              <select
                id="add-env"
                value={form.nav_env}
                onChange={(e) => setForm((f) => ({ ...f, nav_env: e.target.value }))}
                className="w-full text-xs px-2.5 py-1.5 rounded-md bg-white/[0.06] text-white/80 border border-white/10 outline-none focus:border-blue-400/40 transition"
              >
                {ENVS.map((e) => <option key={e} value={e} className="bg-[#162d4d]">{e}</option>)}
              </select>
            </div>
          </div>
          <input
            id="add-user"
            type="text"
            value={form.nav_username}
            onChange={(e) => setForm((f) => ({ ...f, nav_username: e.target.value }))}
            placeholder="Username"
            aria-label="Username"
            className="w-full text-xs px-2.5 py-1.5 rounded-md bg-white/[0.06] text-white/80 placeholder-white/20 border border-white/10 outline-none focus:border-blue-400/40 transition"
          />
          <input
            id="add-pwd"
            type="password"
            value={form.nav_password}
            onChange={(e) => setForm((f) => ({ ...f, nav_password: e.target.value }))}
            onKeyDown={(e) => e.key === "Enter" && submitAdd()}
            placeholder="Password"
            aria-label="Password"
            className="w-full text-xs px-2.5 py-1.5 rounded-md bg-white/[0.06] text-white/80 placeholder-white/20 border border-white/10 outline-none focus:border-blue-400/40 transition"
          />
          <button
            onClick={submitAdd}
            disabled={!form.nav_username.trim() || !form.nav_password.trim() || addMut.isPending}
            className="w-full text-xs font-semibold py-2 rounded-md bg-blue-500/80 hover:bg-blue-400/80 text-white disabled:opacity-40 transition"
          >
            {addMut.isPending ? "Salvataggio…" : "Aggiungi"}
          </button>
          {addMut.isError && (
            <p className="text-[11px] text-red-400/80">{addMut.error?.response?.data?.detail ?? "Errore"}</p>
          )}
        </div>
      )}

      {/* body — 3 colonne per env */}
      <div className="px-6 py-4">
        {!credentials ? (
          <p className="text-xs text-white/30 font-mono text-center py-3">Caricamento…</p>
        ) : credentials.length === 0 ? (
          <p className="text-xs text-white/30 font-mono text-center py-3">
            Nessuna credenziale.{canManage ? " Usa + per aggiungerne." : ""}
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-6">
            {ENVS.map((env) => {
              const rows = byEnv(env)
              if (rows.length === 0) return null
              return (
                <div key={env}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[11px] font-semibold text-blue-300/50 uppercase tracking-[0.15em]">{env}</span>
                    <div className="flex-1 h-px bg-gradient-to-r from-white/[0.08] to-transparent" />
                  </div>
                  <div className="space-y-0.5">
                    {rows.map((c) => (
                      <CredRow key={c.id} cred={c} canManage={canManage} onDelete={canManage ? () => deleteMut.mutate(c.id) : null} onPwdCopied={onClose} />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}


// ── ActivityLog ───────────────────────────────────────────────────────────────

function ActivityLog({ entries }) {
  const endRef = useRef(null)
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [entries])

  return (
    <div className="bg-gray-950 rounded-xl border border-gray-800 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Terminal size={14} className="text-green-400" aria-hidden="true" />
        <span className="text-xs font-semibold text-green-400 tracking-wider uppercase">Log attività</span>
      </div>
      <div className="space-y-1 max-h-36 overflow-y-auto pr-1 scrollbar-thin">
        {entries.length === 0 ? (
          <p className="text-xs text-gray-600 font-mono">In attesa di attività…</p>
        ) : (
          entries.map((e, i) => (
            <div key={i} className="flex items-start gap-2 text-xs font-mono">
              <span className="text-gray-500 shrink-0">{e.time}</span>
              <span className="text-green-300">{e.message}</span>
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>
    </div>
  )
}


// ── Main Page ─────────────────────────────────────────────────────────────────

export default function NavisionPage() {
  const navigate = useNavigate()
  const { canManage }                     = useAuthStore()
  const [log, setLog]                     = useState([])
  const [folderWarning, setFolderWarning] = useState(false)
  const [agentError, setAgentError]       = useState(false)
  const [panelOpen, setPanelOpen]         = useState(false)
  const [panelLabel, setPanelLabel]       = useState("")
  const rdpFolder = localStorage.getItem("navision_rdp_folder") || ""
  const canManageNav = canManage("navision")

  const { data: credentials } = useQuery({
    queryKey: ["nav-credentials"],
    queryFn: navisionApi.getCredentials,
    staleTime: 5 * 60 * 1000,
  })

  const addLog = useCallback((message) => {
    setLog((prev) => [...prev.slice(-49), { time: now(), message }])
  }, [])

  async function handleRdpOpen(key, label) {
    setPanelLabel(label)
    setPanelOpen(true)

    if (!rdpFolder.trim()) {
      setFolderWarning(true)
      setAgentError(false)
      addLog(`Cartella RDP non configurata — vai in Impostazioni`)
      return
    }

    const filename  = RDP_FILENAMES[key] ?? `${key}.rdp`
    // Pulizia: rimuove virgolette accidentali e trailing slash
    const cleanFolder = rdpFolder.trim().replace(/^["']|["']$/g, "").replace(/[/\\]+$/, "")
    const fullPath    = `${cleanFolder}\\${filename}`

    addLog(`Invio percorso: ${fullPath}`)

    try {
      const res = await fetch("http://localhost:9999/open", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: fullPath }),
      })

      if (res.ok) {
        setFolderWarning(false)
        setAgentError(false)
        addLog(`Avvio ${label}…`)
        // Aspetta che mstsc si apra, poi affianca le finestre
        setTimeout(() => agentSnap(), 1500)
      } else {
        addLog(`File non trovato — percorso inviato: ${fullPath}`)
      }
    } catch {
      setAgentError(true)
      addLog(`Agente NAV non raggiungibile — esegui installa_agente.bat`)
    }
  }

  async function handleKillSessions() {
    addLog("Chiusura sessioni in corso…")
    try {
      const res = await fetch("http://localhost:9999/kill", { method: "POST" })
      const data = await res.json()
      addLog(data.killed > 0 ? `${data.killed} sessioni chiuse` : "Nessuna sessione attiva")
    } catch {
      addLog("Agente non raggiungibile — impossibile chiudere le sessioni")
    }
  }

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-[#1e3a5f]/10 rounded-xl flex items-center justify-center">
          <Monitor size={18} className="text-[#1e3a5f]" aria-hidden="true" />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-800">Navision</h1>
          <p className="text-xs text-gray-400 mt-0.5">Microsoft Dynamics NAV 2009 R2</p>
        </div>
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition focus-visible:ring-2 focus-visible:ring-[#2563eb]"
        >
          <LogOut size={15} aria-hidden="true" />
          Esci
        </button>
      </div>

      {/* Launch buttons */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        <div className="grid grid-cols-3 gap-3">
          {/* Colonna 1: CHIUDI + IT01 + ARCHIVIO */}
          <div className="space-y-2">
            <button
              onClick={handleKillSessions}
              className="w-full flex items-center justify-center gap-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-semibold text-sm rounded-xl py-2.5 transition focus-visible:ring-2 focus-visible:ring-red-400"
              aria-label="Copia comando per chiudere tutte le sessioni NAV"
            >
              <Terminal size={15} aria-hidden="true" />
              CHIUDI SESSIONI
            </button>
            <button
              onClick={() => handleRdpOpen("it01_classic", "NAV IT01")}
              className="w-full flex items-center justify-center gap-2 bg-[#1e3a5f] hover:bg-[#2563eb] text-white font-semibold text-sm rounded-xl py-2.5 shadow transition focus-visible:ring-2 focus-visible:ring-[#2563eb]"
              aria-label="Apri NAV IT01"
            >
              <ScreenShare size={15} aria-hidden="true" />
              NAV IT01
            </button>
            <button
              onClick={() => handleRdpOpen("archivio", "NAV IT01 ARCHIVIO")}
              className="w-full flex flex-col items-center gap-0.5 bg-[#1e3a5f] hover:bg-[#2563eb] text-white font-semibold rounded-xl py-2 shadow transition focus-visible:ring-2 focus-visible:ring-[#2563eb]"
              aria-label="Apri NAV IT01 Archivio (dati fino a giugno 2024)"
            >
              <span className="flex items-center gap-2 text-sm"><ScreenShare size={15} aria-hidden="true" />NAV IT01 ARCHIVIO</span>
              <span className="text-[10px] font-normal text-white/50">dati fino a giugno 2024</span>
            </button>
          </div>

          {/* Colonna 2: IT02 CLASSIC + IT02 NEW */}
          <div className="space-y-2">
            {[
              { key: "it02_classic", label: "NAV IT02" },
              { key: "it02_new",     label: "NEW NAV IT02" },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => handleRdpOpen(key, label)}
                className="w-full flex items-center justify-center gap-2 bg-[#1e3a5f] hover:bg-[#2563eb] text-white font-semibold text-sm rounded-xl py-2.5 shadow transition focus-visible:ring-2 focus-visible:ring-[#2563eb]"
                aria-label={`Apri ${label}`}
              >
                <ScreenShare size={15} aria-hidden="true" />
                {label}
              </button>
            ))}
          </div>

          {/* Colonna 3: IT03 CLASSIC + IT03 NEW */}
          <div className="space-y-2">
            {[
              { key: "it03_classic", label: "NAV IT03" },
              { key: "it03_new",     label: "NEW NAV IT03" },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => handleRdpOpen(key, label)}
                className="w-full flex items-center justify-center gap-2 bg-[#1e3a5f] hover:bg-[#2563eb] text-white font-semibold text-sm rounded-xl py-2.5 shadow transition focus-visible:ring-2 focus-visible:ring-[#2563eb]"
                aria-label={`Apri ${label}`}
              >
                <ScreenShare size={15} aria-hidden="true" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {folderWarning && (
          <div className="mt-3 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700" role="alert">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>Configura la <strong>cartella dei file RDP</strong> nelle impostazioni.</span>
            <button onClick={() => navigate("/settings")} className="ml-auto shrink-0 underline hover:text-amber-900 transition">
              Vai a Impostazioni
            </button>
          </div>
        )}
        {agentError && (
          <div className="mt-3 flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700" role="alert">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>
              Agente NAV non attivo. Esegui <strong>installa_agente.bat</strong> dalla cartella{" "}
              <span className="font-mono">navision_agent\</span> del progetto.
            </span>
          </div>
        )}

        <p className="text-xs text-gray-400 mt-3 text-center">
          Cliccando un NAV si avvia la sessione remota e si aprono le credenziali. CHIUDI SESSIONI termina tutte le connessioni attive.
        </p>
      </div>

      {/* Credenziali NAV */}
      {panelOpen && (
        <CredentialsPanel
          open={panelOpen}
          onClose={() => { setPanelOpen(false); agentRestore() }}
          rdpLabel={panelLabel}
          credentials={credentials}
          canManage={canManageNav}
        />
      )}

      {/* Activity log */}
      <ActivityLog entries={log} />
    </div>
  )
}
