import { useState, useCallback, useRef, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import {
  Monitor, LogOut, Terminal, AlertTriangle,
  Play, CircleCheck, Download, Settings,
} from "lucide-react"
import { navisionApi } from "@/api/navision"
import { useAuthStore } from "@/store/authStore"
import {
  AGENT_URL,
  SESSION_BUTTONS,
  buildRdpPath,
  getRdpFolder,
  checkAgentHealth,
  openRdp,
  killAllSessions,
} from "@/lib/navAgent"
import NavCredentialCard from "@/components/shared/NavCredentialCard"

// ── Helpers ──────────────────────────────────────────────────────────────────

function now() {
  return new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
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

  const rdpFolder = getRdpFolder()

  const addLog = useCallback((message) => {
    setLog((prev) => [...prev.slice(-49), { time: now(), message }])
  }, [])

  // ── Agent health check ──
  const checkAgent = useCallback(async () => {
    setAgentOk(await checkAgentHealth())
  }, [])

  useEffect(() => { checkAgent() }, [checkAgent])

  async function handleRetryAgent() {
    setAgentOk(null)
    addLog("Verifica agente in corso…")
    const ok = await checkAgentHealth()
    setAgentOk(ok)
    addLog(ok ? "Agente attivo!" : "Agente non raggiungibile — scarica e installa l'agente")
  }

  async function handleRestartAgent() {
    addLog("Riavvio agente in corso…")
    try {
      await fetch(`${AGENT_URL}/restart`, { method: "POST" })
    } catch {
      // Il processo si chiude prima di rispondere — è normale
    }
    // Attende che l'agente si riavvii, poi ri-verifica
    await new Promise(r => setTimeout(r, 2500))
    await handleRetryAgent()
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

    if (!rdpFolder) {
      setFolderWarning(true)
      addLog("Cartella RDP non configurata — vai in Impostazioni NAV Agent")
      return
    }

    const fullPath = buildRdpPath(rdpFolder, key)
    addLog(`Invio percorso: ${fullPath}`)
    const { ok, status } = await openRdp(fullPath)
    if (ok) {
      setFolderWarning(false)
      setAgentOk(true)
      addLog(`Avvio ${label}...`)
    } else if (status === 0) {
      setAgentOk(false)
      addLog("Agente NAV non raggiungibile — esegui installa_agente.bat")
    } else {
      addLog(`File non trovato — percorso inviato: ${fullPath}`)
    }
  }

  async function handleKillSessions() {
    addLog("Chiusura sessioni in corso…")
    const { ok, killed } = await killAllSessions()
    if (!ok) {
      addLog("Agente non raggiungibile — impossibile chiudere le sessioni")
      return
    }
    addLog(killed > 0 ? `${killed} sessioni chiuse` : "Nessuna sessione attiva")
  }

  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-800">Navision</h1>
        </div>
        <button
          onClick={() => navigate("/utilities/navision/settings")}
          aria-label="Impostazioni NAV Agent"
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition focus-visible:ring-2 focus-visible:ring-[#2563eb]"
        >
          <Settings size={15} aria-hidden="true" />
          Impostazioni
        </button>
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
          <div className="flex flex-col items-end gap-1">
            {agentOk === true && (
              <>
                <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-1.5">
                  <CircleCheck size={14} aria-hidden="true" />
                  Agent OK
                </span>
                <button
                  onClick={handleRestartAgent}
                  className="text-[11px] text-gray-400 hover:text-gray-600 underline underline-offset-2 transition"
                >
                  Riavvia
                </button>
              </>
            )}
            {agentOk === null && (
              <span className="flex items-center gap-1.5 text-xs text-gray-400 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5">
                <Play size={14} aria-hidden="true" />
                Verifica…
              </span>
            )}
          </div>
        </div>

        {/* Bottone avvia agente */}
        {agentOk === false && (
          <div className="mt-4 flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
            <AlertTriangle size={16} className="text-amber-500 shrink-0" aria-hidden="true" />
            <span className="text-sm text-amber-700 flex-1">Agente NAV non attivo</span>
            <button
              onClick={() => {
                window.location.href = "ftchub-agent://start"
                // Ricontrolla dopo 3 secondi
                setTimeout(() => handleRetryAgent(), 3000)
              }}
              className="flex items-center gap-1.5 text-xs font-semibold bg-[#1e3a5f] hover:bg-[#2563eb] text-white px-3 py-1.5 rounded-lg shadow transition focus-visible:ring-2 focus-visible:ring-[#2563eb]"
              aria-label="Avvia agente NAV"
            >
              <Play size={13} aria-hidden="true" />
              Avvia Agente
            </button>
            <button
              onClick={handleDownloadAgent}
              className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 border border-gray-300 bg-white px-3 py-1.5 rounded-lg hover:bg-gray-50 transition focus-visible:ring-2 focus-visible:ring-[#2563eb]"
              aria-label="Scarica installer agente NAV"
            >
              <Download size={13} aria-hidden="true" />
              Installa
            </button>
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
            <button onClick={() => navigate("/utilities/navision/settings")} className="ml-auto shrink-0 underline hover:text-amber-900 transition">
              Vai a Impostazioni
            </button>
          </div>
        )}
      </div>

      {/* ── Credenziali NAV — card singola per env selezionato ── */}
      {activeEnv && (
        <NavCredentialCard
          key={activeEnv}
          env={activeEnv}
          credentials={credentials}
          canManage={canManageNav}
          onClose={() => setActiveEnv(null)}
        />
      )}

      {/* ── Activity log ── */}
      <ActivityLog entries={log} />
    </div>
  )
}
