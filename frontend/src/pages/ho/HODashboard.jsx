import { useNavigate } from "react-router-dom"
import { BarChart3, Package, ShoppingCart, Wifi } from "lucide-react"

const MODULES = [
  { path: "/ho/sales", icon: BarChart3, label: "Sales Data", color: "bg-blue-500", desc: "Vendite giornaliere IT01/IT02/IT03" },
  { path: "/ho/stock", icon: Package, label: "Stock", color: "bg-emerald-500", desc: "Gestione magazzino", soon: true },
  { path: "/ho/orders", icon: ShoppingCart, label: "Ordini", color: "bg-violet-500", desc: "Gestione ordini", soon: true },
  { path: "/ho/status", icon: Wifi, label: "Online/Offline", color: "bg-amber-500", desc: "Stato negozi", soon: true },
]

export default function HODashboard() {
  const navigate = useNavigate()
  return (
    <div>
      <h2 className="text-xl font-bold text-gray-800 mb-6">Moduli IT</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {MODULES.map(({ path, icon: Icon, label, color, desc, soon }) => (
          <button
            key={path}
            onClick={() => !soon && navigate(path)}
            disabled={soon}
            className={`bg-white rounded-xl border border-gray-200 p-6 text-left shadow-sm hover:shadow-md transition-all
              ${soon ? "opacity-50 cursor-not-allowed" : "hover:border-[#2563eb] cursor-pointer"}`}
          >
            <div className={`w-12 h-12 ${color} rounded-xl flex items-center justify-center mb-4`}>
              <Icon className="text-white" size={22} />
            </div>
            <div className="font-semibold text-gray-800">{label}</div>
            <div className="text-sm text-gray-500 mt-1">{desc}</div>
            {soon && <span className="mt-2 inline-block text-xs bg-gray-100 text-gray-400 px-2 py-0.5 rounded">Coming soon</span>}
          </button>
        ))}
      </div>
    </div>
  )
}
