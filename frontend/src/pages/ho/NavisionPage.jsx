import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  Monitor, Power, RefreshCw, LogOut, Plus, Pencil, Trash2,
  Loader2, AlertCircle, CheckCircle, ChevronDown, X,
} from "lucide-react"
import { navisionApi } from "@/api/navision"
import { useAuthStore } from "@/store/authStore"

const AGENT = "http://localhost:9999"

const ENV_ORDER = ["IT01_CLASSIC", "IT02_CLASSIC", "IT02_NEW", "IT03_CLASSIC", "IT03_NEW"]

const ENV_COLORS = {
  IT01_CLASSIC: "bg-blue-500 hover:bg-blue-600",
  IT02_CLASSIC: "bg-emerald-500 hover:bg-emerald-600",
  IT02_NEW:     "bg-emerald-700 hover:bg-emerald-800",
  IT03_CLASSIC: "bg-violet-500 hover:bg-violet-600",
  IT03_NEW:     "bg-violet-700 hover:bg-violet-800",
}

const ENV_LABELS = {
  IT01_CLASSIC: { main: "NAV IT01", sub: "CLASSIC" },
  IT02_CLASSIC: { main: "NAV IT02", sub: "CLASSIC" },
  IT02_NEW:     { main: "NAV IT02", sub: "NEW" },
  IT03_CLASSIC: { main: "NAV IT03", sub: "CLASSIC" },
  IT03_NEW:     { main: "NAV IT03", sub: "NEW" },
}

const ALL_DEPARTMENTS = [
  "IT", "FINANCE", "COMMERCIAL", "DM", "HR", "MARKETING",
  "RETAIL", "MANAGER", "TOPMGR", "HEALTHSAFETY", "FACILITIES",
]

const IT_DEPTS = new Set(["IT", "SUPERUSER", "ADMIN"])

// ── Componente picker utenze (quando ci sono più credenziali) ──────────────

function CredPicker({ configs, onSelect, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100">
          <h3 className="text-sm font-bold text-gray-800">Scegli utenza</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition" aria-label="Chiudi">
            <X size={17} />
          </button>
        </div>
        <div className="px-5 py-3 space-y-2">
          {configs.map(cfg => (
            <button
              key={cfg.id}
              onClick={() => onSelect(cfg)}
              className="w-full text-left px-4 py-3 rounded-xl border border-gray-200 hover:border-[#2563eb] hover:bg-blue-50 transition group"
            >
              <div className="text-sm font-semibold text-gray-800 group-hover:text-[#2563eb]">
                {cfg.display_label || cfg.nav_username}
              </div>
              <div className="text-xs text-gray-400 font-mono mt-0.5">{cfg.nav_username}</div>
              <div className="text-[10px] text-gray-300 mt-0.5">{cfg.department}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Modal gestione config (crea / modifica) ────────────────────────────────

function ConfigModal({ config, onClose, onSaved }) {
  const qc = useQueryClient()
  const isEdit = !!config

  const [form, setForm] = useState({
    department: config?.department ?? "IT",
    nav_env: config?.nav_env ?? "IT01_CLASSIC",
    server_host: config?.server_host ?? "",
    gateway_host: config?.gateway_host ?? "",
    rdp_app_name: config?.rdp_app_name ?? "",
    rdp_app_cmdline: config?.rdp_app_cmdline ?? "",
    nav_username: config?.nav_username ?? "",
    nav_password: "",
    display_label: config?.display_label ?? "",
  })

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const save = useMutation({
    mutationFn: () => isEdit
      ? navisionApi.updateConfig(config.id, {
          server_host: form.server_host || undefined,
          nav_username: form.nav_username || undefined,
          nav_password: form.nav_password || undefined,
          display_label: form.display_label || undefined,
        })
      : navisionApi.createConfig(form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["nav-configs"] })
      onSaved()
    },
  })

  const inputCls = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#2563eb] focus:border-transparent outline-none transition"

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
          <h3 className="text-sm font-bold text-gray-800">
            {isEdit ? "Modifica configurazione" : "Nuova configurazione"}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition" aria-label="Chiudi">
            <X size={17} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-3">
          {!isEdit && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="cfg-dept" className="block text-xs font-semibold text-gray-600 mb-1">Department</label>
                <select id="cfg-dept" value={form.department} onChange={e => set("department", e.target.value)} className={inputCls}>
                  {ALL_DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="cfg-env" className="block text-xs font-semibold text-gray-600 mb-1">Ambiente NAV</label>
                <select id="cfg-env" value={form.nav_env} onChange={e => set("nav_env", e.target.value)} className={inputCls}>
                  {ENV_ORDER.map(e => <option key={e} value={e}>{e}</option>)}
                </select>
              </div>
            </div>
          )}

          <div>
            <label htmlFor="cfg-server" className="block text-xs font-semibold text-gray-600 mb-1">Server RDP</label>
            <input id="cfg-server" value={form.server_host} onChange={e => set("server_host", e.target.value)}
              placeholder="es. R46-BR1.R46.LOCAL" className={inputCls} />
          </div>
          <div>
            <label htmlFor="cfg-gateway" className="block text-xs font-semibold text-gray-600 mb-1">
              Gateway RDP <span className="text-gray-400 font-normal">(opzionale)</span>
            </label>
            <input id="cfg-gateway" value={form.gateway_host} onChange={e => set("gateway_host", e.target.value)}
              placeholder="es. r46-rdgw.elvabaltic.lv" className={inputCls} />
          </div>
          <div>
            <label htmlFor="cfg-appname" className="block text-xs font-semibold text-gray-600 mb-1">
              RemoteApp name <span className="text-gray-400 font-normal">(opzionale — lascia vuoto per desktop completo)</span>
            </label>
            <input id="cfg-appname" value={form.rdp_app_name} onChange={e => set("rdp_app_name", e.target.value)}
              placeholder="es. finsql (29)" className={inputCls} />
          </div>
          {form.rdp_app_name && (
            <div>
              <label htmlFor="cfg-appcmd" className="block text-xs font-semibold text-gray-600 mb-1">RemoteApp cmdline</label>
              <textarea id="cfg-appcmd" value={form.rdp_app_cmdline} onChange={e => set("rdp_app_cmdline", e.target.value)}
                rows={3} placeholder="es. servername=R46-SQL-01.r46.local,database=P2920-TIGER_IT,..."
                className={inputCls + " resize-none font-mono text-xs"} />
            </div>
          )}
          <div>
            <label htmlFor="cfg-user" className="block text-xs font-semibold text-gray-600 mb-1">Username</label>
            <input id="cfg-user" value={form.nav_username} onChange={e => set("nav_username", e.target.value)}
              placeholder="es. R46\Tiger.IT.HO" className={inputCls} />
          </div>
          <div>
            <label htmlFor="cfg-pwd" className="block text-xs font-semibold text-gray-600 mb-1">
              Password {isEdit && <span className="text-gray-400 font-normal">(lascia vuoto per non modificare)</span>}
            </label>
            <input id="cfg-pwd" type="password" value={form.nav_password} onChange={e => set("nav_password", e.target.value)}
              placeholder="••••••••" className={inputCls} />
          </div>
          <div>
            <label htmlFor="cfg-label" className="block text-xs font-semibold text-gray-600 mb-1">Etichetta (opzionale)</label>
            <input id="cfg-label" value={form.display_label} onChange={e => set("display_label", e.target.value)}
              placeholder="es. NAV IT01 — Finance HQ" className={inputCls} />
          </div>

          {save.isError && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700">
              <AlertCircle size={13} />
              {save.error?.response?.data?.detail || "Errore durante il salvataggio"}
            </div>
          )}

          <button
            onClick={() => save.mutate()}
            disabled={save.isPending || (!isEdit && (!form.server_host || !form.nav_username || !form.nav_password))}
            className="w-full bg-[#1e3a5f] hover:bg-[#2563eb] text-white font-semibold py-2.5 rounded-xl shadow transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {save.isPending && <Loader2 size={14} className="animate-spin" />}
            {isEdit ? "Salva modifiche" : "Crea configurazione"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Pagina principale ──────────────────────────────────────────────────────

export default function NavisionPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const isIT = IT_DEPTS.has(user?.department)

  const [agentOk, setAgentOk] = useState(null)
  const [sessions, setSessions] = useState(0)
  const [launching, setLaunching] = useState(null)
  const [killingAll, setKillingAll] = useState(false)
  const [log, setLog] = useState([])
  const [picker, setPicker] = useState(null)     // { env, configs }
  const [editModal, setEditModal] = useState(null) // null | "new" | config object
  const [expandedEnv, setExpandedEnv] = useState(null)

  const qc = useQueryClient()

  const { data: configs = [], isLoading: configsLoading } = useQuery({
    queryKey: ["nav-configs"],
    queryFn: () => navisionApi.getConfigs().then(r => r.data),
  })

  // Raggruppa per nav_env
  const byEnv = ENV_ORDER.reduce((acc, env) => {
    acc[env] = configs.filter(c => c.nav_env === env)
    return acc
  }, {})

  const addLog = (msg) => setLog(l => [{ msg, time: new Date().toLocaleTimeString("it-IT") }, ...l].slice(0, 20))

  const checkAgent = async () => {
    try {
      const r = await fetch(AGENT + "/ping")
      const d = await r.json()
      setAgentOk(d.ok)
      const s = await fetch(AGENT + "/status")
      const sd = await s.json()
      setSessions(sd.sessions || 0)
    } catch {
      setAgentOk(false)
    }
  }

  useState(() => { checkAgent() }, [])

  async function launchRdp(cfg) {
    setPicker(null)
    if (!agentOk) { addLog("Agent non raggiungibile"); return }
    setLaunching(cfg.id)
    try {
      const { data: params } = await navisionApi.getRdpParams(cfg.id)
      const r = await fetch(AGENT + "/open-rdp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          server:     params.server_host,
          username:   params.nav_username,
          password:   params.nav_password,
          gateway:    params.gateway_host    || "",
          app_name:   params.rdp_app_name    || "",
          app_cmdline: params.rdp_app_cmdline || "",
          label:      cfg.display_label      || "",
        }),
      })
      const d = await r.json()
      if (d.ok) {
        addLog(`${cfg.display_label || cfg.nav_username} avviato — sessioni: ${d.sessions}`)
        setSessions(d.sessions)
      } else {
        addLog("Errore agent: " + d.error)
      }
    } catch {
      addLog("Agent non raggiungibile")
      setAgentOk(false)
    }
    setLaunching(null)
  }

  function handleEnvClick(env) {
    const envConfigs = byEnv[env]
    if (!envConfigs.length) return
    if (envConfigs.length === 1) {
      launchRdp(envConfigs[0])
    } else {
      setPicker({ env, configs: envConfigs })
    }
  }

  async function killAll() {
    if (!agentOk) return
    setKillingAll(true)
    try {
      const r = await fetch(AGENT + "/kill-nav", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })
      const d = await r.json()
      addLog(d.killed?.length ? "Chiuse: " + d.killed.join(", ") : "Nessuna sessione attiva")
      setSessions(0)
    } catch { addLog("Agent non raggiungibile") }
    setKillingAll(false)
  }

  const deleteConfig = useMutation({
    mutationFn: (id) => navisionApi.deleteConfig(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["nav-configs"] }),
  })

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
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition"
        >
          <LogOut size={15} aria-hidden="true" />
          Esci
        </button>
      </div>

      {/* Status bar */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-3 flex items-center gap-4 flex-wrap">
        <div className="text-xs text-gray-400">R46-BR1.R46.LOCAL · r46-rdgw.elvabaltic.lv</div>
        <div className="ml-auto flex items-center gap-3">
          <div className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full ${
            agentOk === null ? "bg-gray-100 text-gray-400"
            : agentOk ? "bg-green-100 text-green-700"
            : "bg-red-100 text-red-600"
          }`}>
            <div className={`w-1.5 h-1.5 rounded-full ${agentOk ? "bg-green-500" : "bg-red-500"}`} />
            {agentOk === null ? "Verifica..." : agentOk ? "Agent OK" : "Agent offline"}
          </div>
          {agentOk && (
            <div className="text-xs text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
              {sessions} sessioni attive
            </div>
          )}
          <button onClick={checkAgent} className="text-gray-400 hover:text-gray-600 transition" aria-label="Aggiorna stato agent">
            <RefreshCw size={14} aria-hidden="true" />
          </button>
          <button
            onClick={killAll}
            disabled={!agentOk || killingAll}
            className="flex items-center gap-1.5 bg-red-500 hover:bg-red-600 disabled:opacity-40 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition"
          >
            <Power size={12} aria-hidden="true" />
            {killingAll ? "Chiusura..." : "Chiudi tutte"}
          </button>
          {!agentOk && (
            <a
              href="/agent/ftchub-nav-agent.exe"
              download
              className="flex items-center gap-1.5 border border-[#1e3a5f] text-[#1e3a5f] hover:bg-[#1e3a5f] hover:text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition"
            >
              Scarica Agent
            </a>
          )}
        </div>
      </div>

      {/* Pulsanti ambienti */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-800">Apri sessione NAV</h3>
          {isIT && (
            <button
              onClick={() => setEditModal("new")}
              className="flex items-center gap-1.5 text-xs font-semibold border border-gray-200 rounded-lg px-3 py-1.5 text-gray-600 hover:border-[#2563eb] hover:text-[#2563eb] transition"
            >
              <Plus size={13} aria-hidden="true" />
              Aggiungi
            </button>
          )}
        </div>

        {configsLoading ? (
          <div className="flex items-center justify-center py-8 gap-2 text-gray-400">
            <Loader2 size={16} className="animate-spin" />
            <span className="text-sm">Caricamento configurazioni...</span>
          </div>
        ) : (
          <div className="grid grid-cols-5 gap-3">
            {ENV_ORDER.map(env => {
              const envConfigs = byEnv[env]
              const label = ENV_LABELS[env]
              const hasConfigs = envConfigs.length > 0
              const isLaunching = envConfigs.some(c => launching === c.id)

              return (
                <div key={env} className="flex flex-col gap-1">
                  <button
                    onClick={() => handleEnvClick(env)}
                    disabled={!agentOk || !hasConfigs || isLaunching}
                    className={`${ENV_COLORS[env]} disabled:opacity-40 text-white rounded-xl py-4 flex flex-col items-center gap-1 transition shadow-sm`}
                  >
                    {isLaunching
                      ? <Loader2 size={20} className="animate-spin" />
                      : <Monitor size={20} aria-hidden="true" />
                    }
                    <span className="font-bold text-sm">{label.main}</span>
                    <span className="text-xs opacity-80">{label.sub}</span>
                    {envConfigs.length > 1 && (
                      <span className="text-[10px] opacity-70">{envConfigs.length} utenze</span>
                    )}
                    {!hasConfigs && (
                      <span className="text-[10px] opacity-60">nessuna config</span>
                    )}
                  </button>

                  {/* Lista configs per IT (espandibile) */}
                  {isIT && hasConfigs && (
                    <div>
                      <button
                        onClick={() => setExpandedEnv(expandedEnv === env ? null : env)}
                        className="w-full flex items-center justify-center gap-1 text-[10px] text-gray-400 hover:text-gray-600 py-0.5 transition"
                        aria-label={`Gestisci configurazioni ${env}`}
                      >
                        <ChevronDown size={10} className={`transition-transform ${expandedEnv === env ? "rotate-180" : ""}`} aria-hidden="true" />
                        gestisci
                      </button>
                      {expandedEnv === env && (
                        <div className="space-y-1 mt-1">
                          {envConfigs.map(cfg => (
                            <div key={cfg.id} className="flex items-center gap-1 bg-gray-50 rounded-lg px-2 py-1.5 border border-gray-100">
                              <div className="flex-1 min-w-0">
                                <div className="text-[10px] font-semibold text-gray-700 truncate">{cfg.department}</div>
                                <div className="text-[9px] font-mono text-gray-400 truncate">{cfg.nav_username}</div>
                              </div>
                              <button
                                onClick={() => setEditModal(cfg)}
                                className="text-gray-300 hover:text-[#2563eb] transition p-0.5"
                                aria-label={`Modifica ${cfg.nav_username}`}
                              >
                                <Pencil size={10} />
                              </button>
                              <button
                                onClick={() => deleteConfig.mutate(cfg.id)}
                                className="text-gray-300 hover:text-red-500 transition p-0.5"
                                aria-label={`Elimina ${cfg.nav_username}`}
                              >
                                <Trash2 size={10} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Log */}
      {log.length > 0 && (
        <div className="bg-gray-900 rounded-xl p-4">
          <div className="text-xs text-gray-500 mb-2 font-mono">LOG</div>
          {log.map((l, i) => (
            <div key={i} className="text-xs font-mono text-green-400 flex gap-3">
              <span className="text-gray-600">{l.time}</span>
              <span>{l.msg}</span>
            </div>
          ))}
        </div>
      )}

      {/* Picker utenza */}
      {picker && (
        <CredPicker
          configs={picker.configs}
          onSelect={launchRdp}
          onClose={() => setPicker(null)}
        />
      )}

      {/* Modal crea/modifica */}
      {editModal && (
        <ConfigModal
          config={editModal === "new" ? null : editModal}
          onClose={() => setEditModal(null)}
          onSaved={() => setEditModal(null)}
        />
      )}
    </div>
  )
}
