import { useCallback, useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { Monitor, Terminal, AlertTriangle, CircleCheck, Play, Download } from "lucide-react"
import { navisionApi } from "@/api/navision"
import { useAuthStore } from "@/store/authStore"
import {
  getSessionsForEnv,
  buildRdpPath,
  getRdpFolder,
  checkAgentHealth,
  openRdp,
  killAllSessions,
} from "@/lib/navAgent"
import NavCredentialCard from "@/components/shared/NavCredentialCard"

// Componente compatto per il launcher RDP di UNA entity, embeddabile dentro
// i drill-down di GeneraTabelle. Include:
//  - badge stato agent (+ Avvia/Installa se non raggiungibile)
//  - bottoni sessione NAV filtrati per env
//  - chiudi tutte le sessioni
//  - card credenziali sempre visibile per quell'env
export default function NavEntityLauncher({ env }) {
  const navigate = useNavigate()
  const { canManage } = useAuthStore()
  const canManageNav = canManage("navision")

  const [agentOk, setAgentOk]             = useState(null)
  const [folderWarning, setFolderWarning] = useState(false)
  const [lastMessage, setLastMessage]     = useState(null)

  const { data: credentials } = useQuery({
    queryKey: ["nav-credentials"],
    queryFn: navisionApi.getCredentials,
    staleTime: 5 * 60 * 1000,
  })

  const sessions = getSessionsForEnv(env)
  const rdpFolder = getRdpFolder()

  const checkAgent = useCallback(async () => {
    setAgentOk(await checkAgentHealth())
  }, [])

  useEffect(() => { checkAgent() }, [checkAgent])

  async function handleRetryAgent() {
    setAgentOk(null)
    setLastMessage("Verifica agente in corso…")
    const ok = await checkAgentHealth()
    setAgentOk(ok)
    setLastMessage(ok ? "Agente attivo" : "Agente non raggiungibile")
  }

  async function handleDownloadAgent() {
    setLastMessage("Download installer agente…")
    try {
      await navisionApi.downloadAgentInstaller()
      setLastMessage("Installer scaricato — esegui installa_agente.bat")
    } catch {
      setLastMessage("Errore download installer")
    }
  }

  async function handleOpenRdp(key, label) {
    if (!rdpFolder) {
      setFolderWarning(true)
      setLastMessage("Cartella RDP non configurata")
      return
    }
    const fullPath = buildRdpPath(rdpFolder, key)
    const { ok, status } = await openRdp(fullPath)
    if (ok) {
      setFolderWarning(false)
      setAgentOk(true)
      setLastMessage(`Avvio ${label}…`)
    } else if (status === 0) {
      setAgentOk(false)
      setLastMessage("Agente NAV non raggiungibile")
    } else {
      setLastMessage(`File non trovato: ${fullPath}`)
    }
  }

  async function handleKill() {
    setLastMessage("Chiusura sessioni in corso…")
    const { ok, killed } = await killAllSessions()
    if (!ok) {
      setLastMessage("Agente non raggiungibile")
      return
    }
    setLastMessage(killed > 0 ? `${killed} sessioni chiuse` : "Nessuna sessione attiva")
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
      {/* Header: titolo + stato agent + chiudi sessioni */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-gray-100 rounded-xl flex items-center justify-center">
          <Monitor size={18} className="text-gray-600" aria-hidden="true" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-gray-800">Sessione NAV {env}</p>
          <p className="text-xs text-gray-400 mt-0.5">Apri Remote Desktop e usa i bottoni User/Pwd per incollare le credenziali</p>
        </div>
        {agentOk === true && (
          <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-1.5">
            <CircleCheck size={13} aria-hidden="true" />
            Agent OK
          </span>
        )}
        {agentOk === null && (
          <span className="flex items-center gap-1.5 text-xs text-gray-400 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5">
            <Play size={13} aria-hidden="true" />
            Verifica…
          </span>
        )}
        <button
          onClick={handleKill}
          className="flex items-center gap-1.5 text-xs font-semibold text-red-600 border border-red-200 rounded-lg px-3 py-1.5 hover:bg-red-50 transition focus-visible:ring-2 focus-visible:ring-red-400"
          aria-label="Chiudi tutte le sessioni NAV"
        >
          <Terminal size={13} aria-hidden="true" />
          Chiudi sessioni
        </button>
      </div>

      {/* Stato agent offline */}
      {agentOk === false && (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <AlertTriangle size={16} className="text-amber-500 shrink-0" aria-hidden="true" />
          <span className="text-sm text-amber-700 flex-1">Agente NAV non attivo</span>
          <button
            onClick={() => {
              window.location.href = "ftchub-agent://start"
              setTimeout(() => handleRetryAgent(), 3000)
            }}
            className="flex items-center gap-1.5 text-xs font-semibold bg-[#1e3a5f] hover:bg-[#2563eb] text-white px-3 py-1.5 rounded-lg shadow transition focus-visible:ring-2 focus-visible:ring-[#2563eb]"
            aria-label="Avvia agente NAV"
          >
            <Play size={13} aria-hidden="true" />
            Avvia
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

      {/* Bottoni sessione NAV per questa entity */}
      {sessions.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {sessions.map(({ key, label, sub, color }) => (
            <button
              key={key}
              onClick={() => handleOpenRdp(key, `${label} ${sub}`)}
              className={`flex-1 min-w-[140px] flex flex-col items-center gap-1 ${color} text-white font-semibold rounded-xl py-3 shadow transition focus-visible:ring-2 focus-visible:ring-[#2563eb]`}
              aria-label={`Apri ${label} ${sub}`}
            >
              <Monitor size={18} aria-hidden="true" />
              <span className="text-sm">{label}</span>
              <span className="text-[10px] font-medium text-white/70 uppercase tracking-wider">{sub}</span>
            </button>
          ))}
        </div>
      )}

      {/* Warning cartella non configurata */}
      {folderWarning && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700" role="alert">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>Configura la <strong>cartella dei file RDP</strong> nelle impostazioni.</span>
          <button onClick={() => navigate("/settings")} className="ml-auto shrink-0 underline hover:text-amber-900 transition">
            Vai a Impostazioni
          </button>
        </div>
      )}

      {/* Ultimo messaggio (log compatto) */}
      {lastMessage && (
        <p className="text-xs text-gray-400 font-mono">{lastMessage}</p>
      )}

      {/* Credenziali sempre visibili per questa entity */}
      <NavCredentialCard
        env={env}
        credentials={credentials}
        canManage={canManageNav}
      />
    </div>
  )
}
