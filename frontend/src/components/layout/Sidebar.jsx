import { NavLink, useNavigate } from "react-router-dom"
import { useAuthStore } from "@/store/authStore"
import { authApi } from "@/api/auth"
import { LogOut, Ticket, UserCircle, BookOpen, ShieldAlert, RefreshCw, CheckCircle, AlertTriangle, XCircle, Wrench, Settings, Globe } from "lucide-react"
import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { diagnosticsApi } from "@/api/diagnostics"

const displayUserType = (user) => {
  const t = user?.department || user?.role
  const labels = { SUPERUSER: "IT", ADMIN: "IT", HO: "Head Office", HR: "HR", FINANCE: "Finance", MARKETING: "Marketing", IT: "IT", COMMERCIAL: "Commercial", DM: "District Manager", STORE: "Store", STOREMANAGER: "Store Manager", RETAIL: "Retail", MANAGER: "Manager", TOPMGR: "Head" }
  return labels[t] || t
}


function DiagStatusIcon({ status }) {
  if (status === "ok") return <CheckCircle size={12} className="text-green-400 shrink-0" />
  if (status === "warning") return <AlertTriangle size={12} className="text-amber-400 shrink-0" />
  return <XCircle size={12} className="text-red-400 shrink-0" />
}

function SidebarDiagnostics({ user }) {
  const isPrivileged = ["SUPERUSER", "ADMIN"].includes(user?.department)
  const [open, setOpen] = useState(false)

  const { data, isFetching, refetch } = useQuery({
    queryKey: ["diagnostics"],
    queryFn: () => diagnosticsApi.get().then(r => r.data),
    refetchInterval: 5 * 60_000,
    enabled: true,
    staleTime: 60_000,
  })

  const status = data?.status ?? "ok"
  const dotColor = status === "ok" ? "bg-green-400" : status === "warning" ? "bg-amber-400" : "bg-red-500"
  const pulse = status !== "ok" ? "animate-pulse" : ""
  const tooltip = status === "ok" ? "Tutti i sistemi operativi" : status === "warning" ? "Attenzione richiesta" : "Problema critico rilevato"

  return (
    <div>
      {/* Riga titolo + dot */}
      <div className="flex items-center gap-2">
        <span className="font-black text-lg leading-none">FTC HUB</span>
        <button
          onClick={() => isPrivileged && setOpen(v => !v)}
          title={tooltip}
          className={`w-2.5 h-2.5 rounded-full shrink-0 ${dotColor} ${pulse} transition ${isPrivileged ? "hover:opacity-80 cursor-pointer" : "cursor-default"}`}
        />
      </div>
      <div className="text-xs text-white/50 mt-0.5">{displayUserType(user)} Module</div>

      {/* Pannello espandibile */}
      {isPrivileged && open && (
        <div className="mt-3 bg-white/5 rounded-xl border border-white/10 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
            <span className="text-[11px] font-semibold text-white/60">Stato sistema</span>
            <button onClick={() => refetch()} disabled={isFetching} aria-label="Aggiorna stato sistema" className="text-white/40 hover:text-white/70 transition disabled:opacity-30">
              <RefreshCw size={10} aria-hidden="true" className={isFetching ? "animate-spin" : ""} />
            </button>
          </div>
          {!data ? (
            <div className="px-3 py-3 text-center text-white/40 text-[10px]">Analisi in corso...</div>
          ) : (
            data.checks?.map((check, i) => (
              <div key={i} className="px-3 py-2 border-b border-white/5 last:border-0">
                <div className="flex items-center gap-2">
                  <DiagStatusIcon status={check.status} />
                  <span className="text-[11px] text-white/80 flex-1">{check.name}</span>
                </div>
                <p className="text-[10px] text-white/40 mt-0.5 ml-[18px] leading-snug">{check.detail}</p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

export default function Sidebar() {
  const { user, clearAuth, canView } = useAuthStore()
  const navigate = useNavigate()
  const handleLogout = async () => {
    try { await authApi.logout() } catch {}
    clearAuth()
    navigate("/login")
  }

  return (
    <aside className="w-64 bg-[#1e3a5f] text-white flex flex-col shadow-xl shrink-0">
      <div className="px-4 py-5 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-white/10 rounded-lg flex items-center justify-center shrink-0">
            <span className="font-black text-lg">F</span>
          </div>
          <div className="flex-1 min-w-0">
            <SidebarDiagnostics user={user} />
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 overflow-y-auto">

        {user?.department === "SUPERUSER" && (
          <div className="mt-4">
            <div className="px-3 mb-2 text-xs font-semibold text-white/40 tracking-wider">
              SUPPORTO
            </div>
            <NavLink
              to="/admin/support"
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 text-sm transition-all
                ${isActive ? "bg-white/15 text-white font-medium" : "text-white/70 hover:bg-white/10 hover:text-white"}`
              }
            >
              <ShieldAlert size={17} />
              <span>Lookup Codici</span>
            </NavLink>
          </div>
        )}

        <div className="mt-4">
          <div className="px-3 mb-2 text-xs font-semibold text-white/40 tracking-wider">
            DATABASE
          </div>
          <NavLink
            to="/utilities"
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 text-sm transition-all
              ${isActive ? "bg-white/15 text-white font-medium" : "text-white/70 hover:bg-white/10 hover:text-white"}`
            }
          >
            <Wrench size={17} aria-hidden="true" />
            <span>Database</span>
          </NavLink>
          {canView("navision") && (
            <NavLink
              to="/utilities/navision"
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 text-sm transition-all
                ${isActive ? "bg-white/15 text-white font-medium" : "text-white/70 hover:bg-white/10 hover:text-white"}`
              }
            >
              <Globe size={17} aria-hidden="true" />
              <span>Navision</span>
            </NavLink>
          )}
        </div>

        {canView("tickets") && (
          <div className="mt-4">
            <div className="px-3 mb-2 text-xs font-semibold text-white/40 tracking-wider">
              SUPPORTO
            </div>
            <NavLink
              to="/tickets"
              end
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all
                ${isActive ? "bg-white/15 text-white font-medium" : "text-white/70 hover:bg-white/10 hover:text-white"}`
              }
            >
              <Ticket size={17} />
              <span>Ticket</span>
            </NavLink>
          </div>
        )}
      </nav>

      <div className="px-3 pb-2">
        {["SUPERUSER", "ADMIN", "IT"].includes(user?.department) && (
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg mb-1 text-sm transition-all
              ${isActive ? "bg-white/15 text-white font-medium" : "text-white/60 hover:bg-white/10 hover:text-white"}`
            }
          >
            <Settings size={17} />
            <span>Impostazioni</span>
          </NavLink>
        )}
        <a
          href="/docs/index.html"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition text-sm"
        >
          <BookOpen size={17} />
          <span>Guide utente</span>
        </a>
      </div>

      <div className="px-3 py-4 border-t border-white/10">
        <NavLink
          to="/profile"
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2 rounded-lg bg-white/5 mb-2 cursor-pointer hover:bg-white/10 transition ${isActive ? "bg-white/15" : ""}`
          }
        >
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-sm font-bold">
            {user?.full_name?.[0] || user?.username?.[0]?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">{user?.full_name || user?.username}</div>
            <div className="text-xs text-white/50">{displayUserType(user)}</div>
          </div>
          <UserCircle size={15} className="text-white/30 shrink-0" />
        </NavLink>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2 w-full rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition text-sm"
        >
          <LogOut size={16} />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  )
}