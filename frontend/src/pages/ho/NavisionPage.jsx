import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { Monitor, Power, RefreshCw, Copy, Check, Eye, EyeOff, LogOut } from "lucide-react"

const AGENT = "http://localhost:9999"

const NAV_BUTTONS = [
  { key: "it01_classic", label: "NAV IT01", sub: "CLASSIC", color: "bg-blue-500 hover:bg-blue-600" },
  { key: "it02_classic", label: "NAV IT02", sub: "CLASSIC", color: "bg-emerald-500 hover:bg-emerald-600" },
  { key: "it02_new",     label: "NAV IT02", sub: "NEW",     color: "bg-emerald-700 hover:bg-emerald-800" },
  { key: "it03_classic", label: "NAV IT03", sub: "CLASSIC", color: "bg-violet-500 hover:bg-violet-600" },
  { key: "it03_new",     label: "NAV IT03", sub: "NEW",     color: "bg-violet-700 hover:bg-violet-800" },
]

const CREDS = {
  IT01: [
    { user: "r46\\tiger.it.emanuele.l", pwd: "Fausto25!" },
    { user: "R46\\Tiger.IT.Fabrizio.R", pwd: "navINV2025" },
    { user: "tiger.it.ho",              pwd: "navINV2025!" },
  ],
  IT02: [
    { user: "R46\\Tiger.IT2.IT",    pwd: "navINV2026" },
    { user: "R46\\Tiger.IT2.IT206", pwd: "Cordialmente25" },
    { user: "tiger.it2.hq",          pwd: "navINV2026!" },
  ],
  IT03: [
    { user: "R46\\Tiger.IT3.IT",      pwd: "navINV2025!" },
    { user: "R46\\Tiger.IT3.Support", pwd: "T1g3r2025#" },
    { user: "tiger.it3.ho",            pwd: "navINV2026!" },
  ],
}

function CopyBtn({ text, label }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <button onClick={copy}
      className={"flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition " +
        (copied ? "bg-green-100 text-green-700" : "bg-gray-100 hover:bg-gray-200 text-gray-600")}>
      {copied ? <Check size={11} /> : <Copy size={11} />}
      {copied ? "Copiato" : label}
    </button>
  )
}

function CredRow({ user, pwd }) {
  const [show, setShow] = useState(false)
  return (
    <div className="flex items-center gap-2 py-1.5 border-b border-gray-100 last:border-0">
      <div className="flex-1 min-w-0">
        <div className="text-xs font-mono text-gray-700 truncate">{user}</div>
        <div className="text-xs font-mono text-gray-400">{show ? pwd : "••••••••••"}</div>
      </div>
      <button onClick={() => setShow(!show)} className="text-gray-300 hover:text-gray-500 transition">
        {show ? <EyeOff size={13} /> : <Eye size={13} />}
      </button>
      <CopyBtn text={user} label="User" />
      <CopyBtn text={pwd} label="Pwd" />
    </div>
  )
}

export default function NavisionPage() {
  const navigate = useNavigate()
  const [agentOk, setAgentOk] = useState(null)
  const [sessions, setSessions] = useState(0)
  const [loading, setLoading] = useState(null)
  const [log, setLog] = useState([])

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

  useEffect(() => { checkAgent() }, [])

  const openRdp = async (key, label) => {
    if (!agentOk) { addLog("Agent non raggiungibile"); return }
    setLoading(key)
    try {
      const r = await fetch(AGENT + "/open-rdp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key })
      })
      const d = await r.json()
      if (d.ok) {
        addLog(label + " avviato — sessioni attive: " + d.sessions)
        setSessions(d.sessions)
      } else {
        addLog("Errore: " + d.error)
      }
    } catch {
      addLog("Agent non raggiungibile")
      setAgentOk(false)
    }
    setLoading(null)
  }

  const killNav = async () => {
    if (!agentOk) return
    setLoading("kill")
    try {
      const r = await fetch(AGENT + "/kill-nav", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}"
      })
      const d = await r.json()
      addLog(d.killed && d.killed.length ? "Chiuse: " + d.killed.join(", ") : "Nessuna sessione attiva")
      setSessions(0)
    } catch {
      addLog("Agent non raggiungibile")
    }
    setLoading(null)
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-xl font-bold text-gray-800">Navision</h1>
        <button onClick={() => navigate("/utilities")} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition">
          <LogOut size={15} aria-hidden="true" />
          Esci
        </button>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-3 flex items-center gap-4">
        <Monitor size={20} className="text-[#1e3a5f]" />
        <div>
          <div className="font-bold text-gray-800">Microsoft Dynamics NAV 2009 R2</div>
          <div className="text-xs text-gray-400">R46-BR1.R46.LOCAL · r46-rdgw.elvabaltic.lv</div>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <div className={"flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full " +
            (agentOk === null ? "bg-gray-100 text-gray-400" : agentOk ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600")}>
            <div className={"w-1.5 h-1.5 rounded-full " + (agentOk ? "bg-green-500" : "bg-red-500")} />
            {agentOk === null ? "Verifica..." : agentOk ? "Agent OK" : "Agent offline"}
          </div>
          {agentOk && (
            <div className="text-xs text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
              {sessions} sessioni attive
            </div>
          )}
          <button onClick={checkAgent} className="text-gray-400 hover:text-gray-600 transition">
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-800">Apri sessione NAV</h3>
          <button onClick={killNav} disabled={!agentOk || loading === "kill"}
            className="flex items-center gap-2 bg-red-500 hover:bg-red-600 disabled:opacity-40 text-white px-4 py-2 rounded-lg text-sm font-medium transition">
            <Power size={14} />
            {loading === "kill" ? "Chiusura..." : "Chiudi tutte le sessioni"}
          </button>
        </div>
        <div className="grid grid-cols-5 gap-3">
          {NAV_BUTTONS.map(({ key, label, sub, color }) => (
            <button key={key}
              onClick={() => openRdp(key, label + " " + sub)}
              disabled={!agentOk || loading === key}
              className={color + " disabled:opacity-40 text-white rounded-xl py-4 flex flex-col items-center gap-1 transition shadow-sm"}>
              <Monitor size={20} />
              <span className="font-bold text-sm">{label}</span>
              <span className="text-xs opacity-80">{sub}</span>
              {loading === key && <span className="text-xs opacity-70 mt-1">Apertura...</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {Object.entries(CREDS).map(([nav, creds]) => (
          <div key={nav} className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="px-4 py-2.5 border-b border-gray-100 flex items-center gap-2">
              <span className="font-bold text-sm text-[#1e3a5f]">NAV {nav}</span>
              <span className="text-xs text-gray-400">R46-BR1.r46.local</span>
            </div>
            <div className="px-4 py-2">
              {creds.map((c) => <CredRow key={c.user} user={c.user} pwd={c.pwd} />)}
            </div>
          </div>
        ))}
      </div>

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
    </div>
  )
}