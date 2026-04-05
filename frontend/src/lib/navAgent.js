// Helper condivisi per parlare con ftchub_nav_agent.ps1 (localhost:9999).
// Usati sia da NavisionPage che dai drill-down entity in GeneraTabelle.

export const AGENT_URL = "http://localhost:9999"

// Fallback filenames — usati solo se il config backend non ha il valore
export const RDP_FILENAMES_DEFAULT = {
  it01_classic: "NAV IT01.rdp",
  archivio:     "NAV archivio.rdp",
  it02_classic: "NAV IT02.rdp",
  it02_new:     "NEW NAV IT02.rdp",
  it03_classic: "NAV IT03.rdp",
  it03_new:     "NEW NAV IT03.rdp",
}

export const SESSION_BUTTONS = [
  { key: "it01_classic", label: "NAV IT01", sub: "CLASSIC",              env: "IT01", color: "bg-emerald-500 hover:bg-emerald-600" },
  { key: "it02_classic", label: "NAV IT02", sub: "CLASSIC",              env: "IT02", color: "bg-emerald-500 hover:bg-emerald-600" },
  { key: "it02_new",     label: "NAV IT02", sub: "NEW",                  env: "IT02", color: "bg-teal-500 hover:bg-teal-600" },
  { key: "it03_classic", label: "NAV IT03", sub: "CLASSIC",              env: "IT03", color: "bg-violet-600 hover:bg-violet-700" },
  { key: "it03_new",     label: "NAV IT03", sub: "NEW",                  env: "IT03", color: "bg-red-500 hover:bg-red-600" },
  { key: "archivio",     label: "ARCHIVIO", sub: "IT01 · fino giu 2024", env: "IT01", color: "bg-gray-500 hover:bg-gray-600" },
]

export function getSessionsForEnv(env) {
  return SESSION_BUTTONS.filter((b) => b.env === env)
}

export function getRdpFolder() {
  return (localStorage.getItem("navision_rdp_folder") || "").trim()
}

export function buildRdpPath(folder, key) {
  const filename    = RDP_FILENAMES_DEFAULT[key] ?? `${key}.rdp`
  const cleanFolder = folder.replace(/^["']|["']$/g, "").replace(/[/\\]+$/, "")
  return `${cleanFolder}\\${filename}`
}

// Porta la finestra mstsc piu' recente in primo piano.
// Chiamato dopo una copia in clipboard (user/pwd) cosi' l'utente puo' incollare.
export function agentFocusRdp() {
  fetch(`${AGENT_URL}/focus`, { method: "POST" }).catch(() => {})
}

export async function checkAgentHealth() {
  try {
    const res = await fetch(`${AGENT_URL}/ping`, { signal: AbortSignal.timeout(2000) })
    return res.ok
  } catch {
    return false
  }
}

export async function openRdp(path) {
  try {
    const res = await fetch(`${AGENT_URL}/open`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path }),
    })
    return { ok: res.ok, status: res.status }
  } catch {
    return { ok: false, status: 0 }
  }
}

export async function killAllSessions() {
  try {
    const res  = await fetch(`${AGENT_URL}/kill`, { method: "POST" })
    const data = await res.json()
    return { ok: true, killed: data.killed ?? 0 }
  } catch {
    return { ok: false, killed: 0 }
  }
}
