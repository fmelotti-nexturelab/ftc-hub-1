import { NavLink, useNavigate, useLocation } from "react-router-dom"
import { useAuthStore } from "@/store/authStore"
import { authApi } from "@/api/auth"
import { BarChart3, ShoppingCart, Package, FileText, Wifi, LogOut, ChevronDown, ChevronRight, Monitor, Ticket, Wrench, UserCircle, BookOpen } from "lucide-react"
import { useState } from "react"

const displayUserType = (user) => {
  const t = user?.user_type || user?.role
  const labels = { SUPERUSER: "IT", ADMIN: "IT", HO: "Head Office", HR: "HR", FINANCE: "Finance", MARKETING: "Marketing", IT: "IT", COMMERCIAL: "Commercial", DM: "District Manager", STORE: "Store", STOREMANAGER: "Store Manager", RETAIL: "Retail", MANAGER: "Manager", TOPMGR: "Head" }
  return labels[t] || t
}

const SALES_SUBMENU = [
  { path: "/ho/sales/it01", label: "Sales Data IT01" },
  { path: "/ho/sales/it02", label: "Sales Data IT02" },
  { path: "/ho/sales/it03", label: "Sales Data IT03" },
  { path: "/ho/sales/report", label: "Report" },
  { path: "/ho/sales/excluded", label: "Negozi Esclusi" },
]

const HO_MENU = [
  { path: "/ho/stock", icon: Package, label: "Stock", soon: true },
  { path: "/ho/orders", icon: ShoppingCart, label: "Ordini", soon: true },
  { path: "/ho/ftp", icon: FileText, label: "File FTP", soon: true },
  { path: "/ho/status", icon: Wifi, label: "Online/Offline", soon: true },
]

export default function Sidebar() {
  const { user, clearAuth, hasRole } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  const [salesOpen, setSalesOpen] = useState(
    location.pathname.startsWith("/ho/sales")
  )

  const handleLogout = async () => {
    try { await authApi.logout() } catch {}
    clearAuth()
    navigate("/login")
  }

  const isSalesActive = location.pathname.startsWith("/ho/sales")

  return (
    <aside className="w-64 bg-[#1e3a5f] text-white flex flex-col shadow-xl shrink-0">
      <div className="px-6 py-5 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-white/10 rounded-lg flex items-center justify-center">
            <span className="font-black text-lg">F</span>
          </div>
          <div>
            <div className="font-black text-lg leading-none">FTC HUB</div>
            <div className="text-xs text-white/50 mt-0.5">{displayUserType(user)} Module</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        {hasRole("ADMIN", "HO") && (
          <div>
            <div className="px-3 mb-2 text-xs font-semibold text-white/40 tracking-wider">
              TABLES ADMIN functions
            </div>

            {/* Navision — PRIMO */}
            <NavLink
              to="/ho/navision"
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 text-sm transition-all
                ${isActive ? "bg-white/15 text-white font-medium" : "text-white/70 hover:bg-white/10 hover:text-white"}`
              }
            >
              <Monitor size={17} />
              <span>Navision</span>
            </NavLink>

            {/* Sales Data con submenu */}
            <div>
              <button
                onClick={() => setSalesOpen(!salesOpen)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 text-sm transition-all w-full
                  ${isSalesActive
                    ? "bg-white/15 text-white font-medium"
                    : "text-white/70 hover:bg-white/10 hover:text-white"
                  }`}
              >
                <BarChart3 size={17} />
                <span className="flex-1 text-left">Sales Data</span>
                {salesOpen
                  ? <ChevronDown size={14} className="text-white/50" />
                  : <ChevronRight size={14} className="text-white/50" />
                }
              </button>

              {salesOpen && (
                <div className="ml-4 border-l border-white/10 pl-3 mb-1">
                  {SALES_SUBMENU.map(({ path, label }) => (
                    <NavLink
                      key={path}
                      to={path}
                      className={({ isActive }) =>
                        `flex items-center px-3 py-2 rounded-lg mb-0.5 text-xs transition-all
                        ${isActive
                          ? "bg-white/15 text-white font-medium"
                          : "text-white/60 hover:bg-white/10 hover:text-white"
                        }`
                      }
                    >
                      {label}
                    </NavLink>
                  ))}
                </div>
              )}
            </div>

            {/* Altri menu soon */}
            {HO_MENU.map(({ path, icon: Icon, label }) => (
              <div
                key={path}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 text-sm text-white/30 cursor-not-allowed"
              >
                <Icon size={17} />
                <span>{label}</span>
                <span className="ml-auto text-[10px] bg-white/10 px-1.5 py-0.5 rounded text-white/40">
                  soon
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4">
          <div className="px-3 mb-2 text-xs font-semibold text-white/40 tracking-wider">
            UTILITIES
          </div>
          <NavLink
            to="/utilities"
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 text-sm transition-all
              ${isActive ? "bg-white/15 text-white font-medium" : "text-white/70 hover:bg-white/10 hover:text-white"}`
            }
          >
            <Wrench size={17} />
            <span>Utilities</span>
          </NavLink>
        </div>

        <div className="mt-4">
          <div className="px-3 mb-2 text-xs font-semibold text-white/40 tracking-wider">
            SUPPORTO
          </div>
          <NavLink
            to="/tickets"
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all
              ${isActive ? "bg-white/15 text-white font-medium" : "text-white/70 hover:bg-white/10 hover:text-white"}`
            }
          >
            <Ticket size={17} />
            <span>Ticket</span>
          </NavLink>
        </div>
      </nav>

      <div className="px-3 pb-2">
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