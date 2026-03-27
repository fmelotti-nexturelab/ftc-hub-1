import { useNavigate } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { Users, Settings2, Database, ToggleRight, TableProperties } from "lucide-react"
import { utilitiesApi } from "@/api/utilities"
import { useAuthStore } from "@/store/authStore"

// Genera Tabelle è un contenitore: visibile se almeno una delle sue sotto-utility è abilitata
const GENERA_CODES = ["utilities_stock_nav", "items_view"]

export default function UtilitiesDashboard() {
  const navigate = useNavigate()
  const { hasRole } = useAuthStore()

  // Gestione Utenti e Configurazione Ticket: funzioni IT/ADMIN per natura, non in griglia
  const isItAdmin = hasRole("ADMIN", "IT")

  const { data: access, isLoading, isError } = useQuery({
    queryKey: ["utilities-my-access"],
    queryFn: () => utilitiesApi.getMyAccess().then((r) => r.data),
  })

  const visibleModules = [
    // Consulta Database: visibile se almeno una sotto-utility è ON (dalla griglia Utilities)
    ...(!isError && access && ["utilities_stores", "utilities_stock_nav", "utilities_sales", "items_view"].some((c) => access[c]?.can_view) ? [
      { path: "/utilities/consulta-database", icon: TableProperties, label: "Consulta Database", color: "bg-blue-500", desc: "Vedi il contenuto delle tabelle" },
    ] : []),
    // Genera Tabelle: visibile se almeno una sotto-utility è gestibile (can_manage) — generare = operazione di gestione
    ...(!isError && access && GENERA_CODES.some((c) => access[c]?.can_manage) ? [
      { path: "/utilities/genera-tabelle", icon: Database, label: "Genera Tabelle", color: "bg-violet-600", desc: "Genera le tabelle per i tool" },
    ] : []),
    // Online/Offline: coming soon — pilotato da canView quando sarà disponibile
    // Gestione Utenti e Configurazione Ticket: funzioni IT/ADMIN, non in griglia (regola 13 CLAUDE.md)
    ...(isItAdmin ? [
      { path: "/admin", icon: Users, label: "Gestione Utenti", color: "bg-[#1e3a5f]", desc: "Crea e gestisci gli utenti della piattaforma" },
      { path: "/utilities/ticket-config", icon: Settings2, label: "Configurazione Ticket", color: "bg-[#1e3a5f]", desc: "Database ticket, team e regole di smistamento" },
    ] : []),
  ]

  if (isLoading) {
    return <div className="py-16 text-center text-gray-400 text-sm">Caricamento...</div>
  }

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-800 mb-6">Utilities</h2>
      {visibleModules.length === 0 ? (
        <div className="py-16 text-center text-gray-400 text-sm">Nessuna utility disponibile per il tuo profilo.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {visibleModules.map(({ path, icon: Icon, label, color, desc, soon }) => (
            <button
              key={path}
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
          ))}
        </div>
      )}
    </div>
  )
}
