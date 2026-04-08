import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Database, Settings2, LogOut, Sparkles } from "lucide-react"
import TicketDatabase from "@/pages/utilities/TicketDatabase"
import TicketConfig from "@/pages/admin/TicketConfig"
import AITraining from "@/pages/admin/AITraining"

const TABS = [
  { id: "database", label: "Gestione Database Ticket", icon: Database },
  { id: "config",   label: "Configurazione Team e Regole", icon: Settings2 },
  { id: "training", label: "Training AI", icon: Sparkles },
]

export default function TicketConfigHub() {
  const [tab, setTab] = useState("database")
  const navigate = useNavigate()

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
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-5 py-2.5 text-sm font-semibold border-b-2 transition -mb-px ${
              tab === id
                ? "border-[#1e3a5f] text-[#1e3a5f]"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {tab === "database" && <TicketDatabase />}
        {tab === "config" && <TicketConfig />}
        {tab === "training" && <AITraining />}
      </div>
    </div>
  )
}
