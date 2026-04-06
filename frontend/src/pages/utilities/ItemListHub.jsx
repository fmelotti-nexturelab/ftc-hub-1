import { useNavigate } from "react-router-dom"
import { List, LogOut } from "lucide-react"

const CARDS = [
  {
    path: "/utilities/consulta-database/item-list/it01",
    label: "ItemList IT01",
    desc: "Consulta l'anagrafe articoli IT01",
    color: "bg-blue-100 text-blue-700",
    iconColor: "bg-blue-500",
  },
  {
    path: "/utilities/consulta-database/item-list/it02",
    label: "ItemList IT02",
    desc: "Consulta l'anagrafe articoli IT02",
    color: "bg-emerald-100 text-emerald-700",
    iconColor: "bg-emerald-500",
  },
  {
    path: "/utilities/consulta-database/item-list/it03",
    label: "ItemList IT03",
    desc: "Consulta l'anagrafe articoli IT03",
    color: "bg-violet-100 text-violet-700",
    iconColor: "bg-violet-500",
  },
]

export default function ItemListHub() {
  const navigate = useNavigate()

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-teal-500/10 rounded-xl flex items-center justify-center">
          <List size={18} className="text-teal-600" aria-hidden="true" />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-800">ItemList</h1>
          <p className="text-xs text-gray-400 mt-0.5">Consulta tutte le tabelle relative all'ItemList</p>
        </div>
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition"
        >
          <LogOut size={15} aria-hidden="true" />
          Esci
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {CARDS.map(({ path, label, desc, iconColor }) => (
          <button
            key={path}
            onClick={() => navigate(path)}
            className="bg-white rounded-xl border border-gray-200 p-6 text-left shadow-sm hover:shadow-md hover:border-[#2563eb] transition-all cursor-pointer"
          >
            <div className={`w-12 h-12 ${iconColor} rounded-xl flex items-center justify-center mb-4`}>
              <List className="text-white" size={22} aria-hidden="true" />
            </div>
            <div className="font-semibold text-gray-800">{label}</div>
            <div className="text-sm text-gray-500 mt-1">{desc}</div>
          </button>
        ))}
      </div>
    </div>
  )
}
