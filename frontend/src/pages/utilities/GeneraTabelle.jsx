import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { BarChart3, Package, ShoppingCart, FileText, LogOut, Database, ChevronRight } from "lucide-react"

const GROUPS = [
  {
    id: "sales",
    icon: BarChart3,
    color: "bg-blue-500",
    label: "Sales Data",
    desc: "Vendite giornaliere per entity",
    items: [
      { path: "/ho/sales/it01",     icon: BarChart3, color: "bg-blue-500",    label: "Sales Data IT01",  desc: "Importa e visualizza le vendite IT01" },
      { path: "/ho/sales/it02",     icon: BarChart3, color: "bg-emerald-500", label: "Sales Data IT02",  desc: "Importa e visualizza le vendite IT02" },
      { path: "/ho/sales/it03",     icon: BarChart3, color: "bg-violet-500",  label: "Sales Data IT03",  desc: "Importa e visualizza le vendite IT03" },
      { path: "/ho/sales/report",   icon: BarChart3, color: "bg-[#1e3a5f]",   label: "Report Vendite",   desc: "Report aggregato per entity" },
      { path: "/ho/sales/excluded", icon: BarChart3, color: "bg-gray-500",    label: "Negozi Esclusi",   desc: "Gestione negozi esclusi dai calcoli" },
    ],
  },
  {
    id: "stock",
    icon: Package,
    color: "bg-amber-500",
    label: "Stock OneItaly",
    desc: "Stock giornaliero da Navision",
    directPath: "/utilities/genera-tabelle/stock",
    items: [],
  },
  {
    id: "orders",
    icon: ShoppingCart,
    color: "bg-orange-500",
    label: "Ordini",
    desc: "Genera tabelle ordini",
    soon: true,
    items: [],
  },
  {
    id: "ftp",
    icon: FileText,
    color: "bg-teal-500",
    label: "File FTP",
    desc: "Genera file per FTP",
    soon: true,
    items: [],
  },
]

export default function GeneraTabelle() {
  const navigate = useNavigate()
  const [activeGroup, setActiveGroup] = useState(null)

  const group = GROUPS.find((g) => g.id === activeGroup)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-[#1e3a5f]/10 rounded-xl flex items-center justify-center">
          <Database size={18} className="text-[#1e3a5f]" />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-800">Genera Tabelle</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {group ? group.label : "Genera le tabelle per i tool"}
          </p>
        </div>
        {group ? (
          <button
            onClick={() => setActiveGroup(null)}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition"
          >
            <LogOut size={15} />
            Indietro
          </button>
        ) : (
          <button
            onClick={() => navigate("/utilities")}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition"
          >
            <LogOut size={15} />
            Esci
          </button>
        )}
      </div>

      {/* Breadcrumb */}
      {group && (
        <div className="flex items-center gap-1.5 text-xs text-gray-400">
          <button onClick={() => setActiveGroup(null)} className="hover:text-gray-600 transition">
            Genera Tabelle
          </button>
          <ChevronRight size={12} />
          <span className="text-gray-600 font-medium">{group.label}</span>
        </div>
      )}

      {/* Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {!group
          ? /* Primo livello — gruppi */
            GROUPS.map(({ id, icon: Icon, color, label, desc, soon, directPath }) => (
              <button
                key={id}
                onClick={() => !soon && (directPath ? navigate(directPath) : setActiveGroup(id))}
                disabled={soon}
                className={`bg-white rounded-xl border border-gray-200 p-6 text-left shadow-sm hover:shadow-md transition-all
                  ${soon ? "opacity-50 cursor-not-allowed" : "hover:border-[#2563eb] cursor-pointer"}`}
              >
                <div className={`w-12 h-12 ${color} rounded-xl flex items-center justify-center mb-4`}>
                  <Icon className="text-white" size={22} />
                </div>
                <div className="font-semibold text-gray-800">{label}</div>
                <div className="text-sm text-gray-500 mt-1">{desc}</div>
                {soon && (
                  <span className="mt-2 inline-block text-xs bg-gray-100 text-gray-400 px-2 py-0.5 rounded">
                    Coming soon
                  </span>
                )}
              </button>
            ))
          : /* Secondo livello — sotto-card del gruppo */
            group.items.map(({ path, icon: Icon, color, label, desc, soon }) => (
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
                {soon && (
                  <span className="mt-2 inline-block text-xs bg-gray-100 text-gray-400 px-2 py-0.5 rounded">
                    Coming soon
                  </span>
                )}
              </button>
            ))}
      </div>
    </div>
  )
}
