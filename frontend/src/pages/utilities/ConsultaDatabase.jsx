import { useNavigate } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { Store, LogOut, Database, Package, List, Users } from "lucide-react"
import { utilitiesApi } from "@/api/utilities"

const CARDS = [
  {
    path: "/utilities/stores",
    icon: Store,
    color: "bg-blue-500",
    label: "Info Stores",
    desc: "Consulta l'anagrafica stores OneItaly",
    moduleCode: "utilities_stores",
  },
  {
    path: "/utilities/consulta-database/stock-nav",
    icon: Package,
    color: "bg-amber-500",
    label: "Stock NAV",
    desc: "Consulta lo stock giornaliero estratto da Navision",
    moduleCode: "utilities_stock_nav",
  },
  {
    path: "/utilities/consulta-database/item-list",
    icon: List,
    color: "bg-teal-500",
    label: "ItemList",
    desc: "Consulta tutte le tabelle relative all'ItemList",
    moduleCode: "items_view",
  },
  {
    path: "/ho/codice-operatore",
    icon: Users,
    color: "bg-violet-500",
    label: "Codici Operatore",
    desc: "Gestione e consultazione codici operatore NAV",
    moduleCode: "codici_operatore",
  },
]

export default function ConsultaDatabase() {
  const navigate = useNavigate()

  const { data: access } = useQuery({
    queryKey: ["utilities-my-access"],
    queryFn: () => utilitiesApi.getMyAccess().then((r) => r.data),
  })

  const visibleCards = CARDS.filter((c) => access?.[c.moduleCode]?.can_view ?? false)

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-[#1e3a5f]/10 rounded-xl flex items-center justify-center">
          <Database size={18} className="text-[#1e3a5f]" />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-800">Consulta Database</h1>
          <p className="text-xs text-gray-400 mt-0.5">Vedi il contenuto delle tabelle</p>
        </div>
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition"
        >
          <LogOut size={15} aria-hidden="true" />
          Esci
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {visibleCards.map(({ path, icon: Icon, color, label, desc }) => (
          <button
            key={path}
            onClick={() => navigate(path)}
            className="bg-white rounded-xl border border-gray-200 p-6 text-left shadow-sm hover:shadow-md hover:border-[#2563eb] transition-all cursor-pointer"
          >
            <div className={`w-12 h-12 ${color} rounded-xl flex items-center justify-center mb-4`}>
              <Icon className="text-white" size={22} />
            </div>
            <div className="font-semibold text-gray-800">{label}</div>
            <div className="text-sm text-gray-500 mt-1">{desc}</div>
          </button>
        ))}
      </div>
    </div>
  )
}
