import { useState, useMemo } from "react"
import { useNavigate, Navigate } from "react-router-dom"
import { Database, Settings2, LogOut, Sparkles } from "lucide-react"
import TicketDatabase from "@/pages/utilities/TicketDatabase"
import TicketConfig from "@/pages/admin/TicketConfig"
import AITraining from "@/pages/admin/AITraining"
import { useAuthStore } from "@/store/authStore"

export default function TicketConfigHub() {
  const navigate = useNavigate()
  const { user, canView, canManage } = useAuthStore()

  const isAdmin = ["ADMIN", "SUPERUSER", "IT"].includes(user?.department)
  const isTeamLead = user?.is_team_lead === true

  // Team Leader con canView("ticket_config") vede la tab config
  const canSeeConfig = isAdmin || (isTeamLead && canView("ticket_config"))
  // Team Leader con canManage("ticket_config") può modificare le regole
  const canEditConfig = isAdmin || (isTeamLead && canManage("ticket_config"))

  // Guard: se non è né admin né team leader con permesso, redirect
  if (!isAdmin && !canSeeConfig) {
    return <Navigate to="/unauthorized" replace />
  }

  const tabs = useMemo(() => {
    const list = []
    if (isAdmin) {
      list.push({ id: "database", label: "Gestione Database Ticket", icon: Database })
    }
    if (canSeeConfig) {
      list.push({ id: "config", label: "Configurazione Team e Regole", icon: Settings2 })
    }
    if (isAdmin) {
      list.push({ id: "training", label: "Training AI", icon: Sparkles })
    }
    return list
  }, [isAdmin, canSeeConfig])

  const [tab, setTab] = useState(() => tabs[0]?.id || "config")

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-800">Configurazione Ticket</h1>
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 border border-gray-300 hover:border-gray-400 text-gray-500 hover:text-gray-700 font-semibold py-2 px-4 rounded-xl transition text-sm"
        >
          <LogOut size={15} aria-hidden="true" />
          Esci
        </button>
      </div>

      {/* Tab bar */}
      <div className="flex gap-0 border-b border-gray-200">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-5 py-2.5 text-sm font-semibold border-b-2 transition -mb-px ${
              tab === id
                ? "border-[#1e3a5f] text-[#1e3a5f]"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            <Icon size={15} aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {tab === "database" && isAdmin && <TicketDatabase />}
        {tab === "config" && canSeeConfig && <TicketConfig readOnly={!canEditConfig} />}
        {tab === "training" && isAdmin && <AITraining />}
      </div>
    </div>
  )
}
