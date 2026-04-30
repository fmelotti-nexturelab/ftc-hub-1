import { useNavigate } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { Users, Settings2, Database, Clock, CalendarDays, Layers } from "lucide-react"
import { utilitiesApi } from "@/api/utilities"
import { useAuthStore } from "@/store/authStore"

// Genera Tabelle è un contenitore: visibile se almeno una delle sue sotto-utility è abilitata
const GENERA_CODES = ["utilities_stock_nav", "items_view", "check_prezzi"]

function CardButton({ path, icon: Icon, label, color, desc, soon, navigate }) {
  return (
    <button
      onClick={() => !soon && navigate(path)}
      disabled={soon}
      className={`bg-white rounded-xl border border-gray-200 p-6 text-left shadow-sm hover:shadow-md transition-all
        ${soon ? "opacity-50 cursor-not-allowed" : "hover:border-[#2563eb] cursor-pointer"}`}
    >
      <div className={`w-12 h-12 ${color} rounded-xl flex items-center justify-center mb-4`}>
        <Icon className="text-white" size={22} aria-hidden="true" />
      </div>
      <div className="font-semibold text-gray-800">{label}</div>
      <div className="text-sm text-gray-500 mt-1">{desc}</div>
      {soon && <span className="mt-2 inline-block text-xs bg-gray-100 text-gray-400 px-2 py-0.5 rounded">Coming soon</span>}
    </button>
  )
}

export default function UtilitiesDashboard() {
  const navigate = useNavigate()
  const { hasRole, user } = useAuthStore()

  const isItAdmin = hasRole("ADMIN", "IT")

  const { data: access, isLoading, isError } = useQuery({
    queryKey: ["utilities-my-access"],
    queryFn: () => utilitiesApi.getMyAccess().then((r) => r.data),
  })

  // Gestione & Configurazione (solo IT/ADMIN)
  const canSeeTicketConfig = isItAdmin || (user?.is_team_lead && !isError && access?.ticket_config?.can_view)
  const adminModules = [
    ...(isItAdmin ? [
      { path: "/admin", icon: Users, label: "Gestione Utenti", color: "bg-[#1e3a5f]", desc: "Crea e gestisci gli utenti della piattaforma" },
    ] : []),
    ...(canSeeTicketConfig ? [
      { path: "/utilities/ticket-config", icon: Settings2, label: "Configurazione Ticket", color: "bg-[#1e3a5f]", desc: "Database ticket, team e regole di smistamento" },
    ] : []),
    ...(isItAdmin ? [
      { path: "/admin/scheduler", icon: Clock, label: "Task Scheduler", color: "bg-[#1e3a5f]", desc: "Gestisci i task schedulati del sistema" },
      { path: "/ho/daily-activity", icon: CalendarDays, label: "Attività Giornaliere", color: "bg-[#1e3a5f]", desc: "Checklist operativa giornaliera con storico completamenti" },
    ] : []),
  ]

  const generaTabella = !isError && access && GENERA_CODES.some((c) => access[c]?.can_manage)
    ? [{ path: "/utilities/genera-tabelle", icon: Database, label: "Genera Tabelle Database", color: "bg-violet-600", desc: "Genera le tabelle per i tool" }]
    : []

  const converterCard = !isError && access?.items_view?.can_manage
    ? [{ path: "/utilities/converter", icon: Layers, label: "Converter", color: "bg-[#1e3a5f]", desc: "Import staging NAV · Assembla Item Master IT01" }]
    : []

  const allModules = [...adminModules, ...generaTabella, ...converterCard]

  if (isLoading) {
    return <div className="py-16 text-center text-gray-400 text-sm">Caricamento...</div>
  }

  if (allModules.length === 0) {
    return (
      <div>
        <h2 className="text-xl font-bold text-gray-800 mb-6">Database Gestione</h2>
        <div className="py-16 text-center text-gray-400 text-sm">Nessuna utility disponibile per il tuo profilo.</div>
      </div>
    )
  }

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-800 mb-6">Database Gestione</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {allModules.map((m) => (
          <CardButton key={m.path} {...m} navigate={navigate} />
        ))}
      </div>
    </div>
  )
}
