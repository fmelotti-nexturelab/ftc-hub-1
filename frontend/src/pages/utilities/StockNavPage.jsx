import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Package, LogOut } from "lucide-react"
import StockConsultaEntityView from "./stock/components/StockConsultaEntityView"

const ENTITIES = ["IT01", "IT02", "IT03"]

export default function StockNavPage() {
  const navigate = useNavigate()
  const [activeEntity, setActiveEntity] = useState("IT01")

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-amber-500/10 rounded-xl flex items-center justify-center">
          <Package size={18} className="text-amber-600" />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-800">Stock NAV</h1>
          <p className="text-xs text-gray-400 mt-0.5">Consulta lo stock giornaliero estratto da Navision</p>
        </div>
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition"
        >
          <LogOut size={15} aria-hidden="true" />
          Esci
        </button>
      </div>

      {/* Entity tabs */}
      <div className="flex items-center gap-2">
        {ENTITIES.map(entity => (
          <button
            key={entity}
            onClick={() => setActiveEntity(entity)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition
              ${activeEntity === entity
                ? "bg-[#1e3a5f] text-white border-[#1e3a5f] shadow-sm"
                : "bg-white text-gray-600 border-gray-200 hover:border-[#2563eb] hover:text-[#2563eb]"
              }`}
          >
            <span className={`w-2 h-2 rounded-full ${
              entity === "IT01" ? "bg-blue-400" : entity === "IT02" ? "bg-emerald-400" : "bg-violet-400"
            }`} />
            {entity}
          </button>
        ))}
      </div>

      {/* Content — key forces remount on tab change */}
      <StockConsultaEntityView key={activeEntity} entity={activeEntity} />
    </div>
  )
}
