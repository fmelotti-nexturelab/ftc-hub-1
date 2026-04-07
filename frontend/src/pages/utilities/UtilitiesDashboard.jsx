import { useNavigate } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { Users, Settings2, Database, TableProperties, Clock } from "lucide-react"
import { utilitiesApi } from "@/api/utilities"
import { useAuthStore } from "@/store/authStore"

// Genera Tabelle è un contenitore: visibile se almeno una delle sue sotto-utility è abilitata
const GENERA_CODES = ["utilities_stock_nav", "items_view", "check_prezzi"]

function SectionTitle({ children }) {
  return (
    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">{children}</h3>
  )
}

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
  const { hasRole } = useAuthStore()

  const isItAdmin = hasRole("ADMIN", "IT")

  const { data: access, isLoading, isError } = useQuery({
    queryKey: ["utilities-my-access"],
    queryFn: () => utilitiesApi.getMyAccess().then((r) => r.data),
  })

  // Gestione & Configurazione (solo IT/ADMIN)
  const adminModules = isItAdmin ? [
    { path: "/admin", icon: Users, label: "Gestione Utenti", color: "bg-[#1e3a5f]", desc: "Crea e gestisci gli utenti della piattaforma" },
    { path: "/utilities/ticket-config", icon: Settings2, label: "Configurazione Ticket", color: "bg-[#1e3a5f]", desc: "Database ticket, team e regole di smistamento" },
    { path: "/admin/scheduler", icon: Clock, label: "Task Scheduler", color: "bg-[#1e3a5f]", desc: "Gestisci i task schedulati del sistema" },
  ] : []

  // Database
  const dbModules = [
    ...(!isError && access && GENERA_CODES.some((c) => access[c]?.can_manage) ? [
      { path: "/utilities/genera-tabelle", icon: Database, label: "Genera Tabelle Database", color: "bg-violet-600", desc: "Genera le tabelle per i tool" },
    ] : []),
    ...(!isError && access && ["utilities_stores", "utilities_stock_nav", "utilities_sales", "items_view"].some((c) => access[c]?.can_view) ? [
      { path: "/utilities/consulta-database", icon: TableProperties, label: "Consulta Tabelle Database", color: "bg-blue-500", desc: "Vedi il contenuto delle tabelle" },
    ] : []),
  ]

  if (isLoading) {
    return <div className="py-16 text-center text-gray-400 text-sm">Caricamento...</div>
  }

  const hasAdmin = adminModules.length > 0
  const hasDb = dbModules.length > 0

  if (!hasAdmin && !hasDb) {
    return (
      <div>
        <h2 className="text-xl font-bold text-gray-800 mb-6">Utilities</h2>
        <div className="py-16 text-center text-gray-400 text-sm">Nessuna utility disponibile per il tuo profilo.</div>
      </div>
    )
  }

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-800 mb-6">Utilities</h2>

      <div className="space-y-8">
        {hasAdmin && (
          <div>
            <SectionTitle>Gestione &amp; Configurazione</SectionTitle>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {adminModules.map((m) => (
                <CardButton key={m.path} {...m} navigate={navigate} />
              ))}
            </div>
          </div>
        )}

        {hasDb && (
          <div>
            <SectionTitle>Database</SectionTitle>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {dbModules.map((m) => (
                <CardButton key={m.path} {...m} navigate={navigate} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
