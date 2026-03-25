import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Package, LogOut, Scissors, FileOutput, PlayCircle } from "lucide-react"
import StockPage from "./StockPage"
import GeneraTuttiModal from "./components/GeneraTuttiModal"
import StockSplitModal from "./components/StockSplitModal"
import EstraiAdmModal from "./components/EstraiAdmModal"

const ENTITIES = [
  { id: "IT01", color: "bg-amber-500", activeRing: "ring-amber-400" },
  { id: "IT02", color: "bg-amber-600", activeRing: "ring-amber-500" },
  { id: "IT03", color: "bg-amber-700", activeRing: "ring-amber-600" },
]

export default function StockUnifiedPage() {
  const navigate = useNavigate()
  const [activeEntity, setActiveEntity] = useState("IT01")
  const [showGeneraTutti, setShowGeneraTutti] = useState(false)
  const [showStockSplit, setShowStockSplit] = useState(false)
  const [showEstraiAdm, setShowEstraiAdm] = useState(false)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-amber-500/10 rounded-xl flex items-center justify-center">
          <Package size={18} className="text-amber-600" />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-800">Stock OneItaly</h1>
          <p className="text-xs text-gray-400 mt-0.5">Gestione stock giornaliero da Navision</p>
        </div>
        <button
          onClick={() => navigate("/utilities/genera-tabelle")}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition"
        >
          <LogOut size={15} aria-hidden="true" />
          Esci
        </button>
      </div>

      {/* Entity tabs + azioni extra */}
      <div className="flex items-center gap-2 flex-wrap">
        {ENTITIES.map(({ id, color }) => (
          <button
            key={id}
            onClick={() => setActiveEntity(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition
              ${activeEntity === id
                ? "bg-[#1e3a5f] text-white border-[#1e3a5f] shadow-sm"
                : "bg-white text-gray-600 border-gray-200 hover:border-[#2563eb] hover:text-[#2563eb]"
              }`}
          >
            <span className={`w-2.5 h-2.5 rounded-full ${color}`} />
            {id}
          </button>
        ))}

        <div className="w-px h-6 bg-gray-200 mx-1" />

        <button
          onClick={() => setShowGeneraTutti(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold border border-gray-200 bg-white text-gray-600 hover:border-[#2563eb] hover:text-[#2563eb] transition"
        >
          <PlayCircle size={14} />
          Genera tutti
        </button>

        <div className="w-px h-6 bg-gray-200 mx-1" />

        <button
          onClick={() => setShowStockSplit(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold border border-gray-200 bg-white text-gray-600 hover:border-[#2563eb] hover:text-[#2563eb] transition"
        >
          <Scissors size={14} />
          StockSplit
        </button>
        <button
          onClick={() => setShowEstraiAdm(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold border border-gray-200 bg-white text-gray-600 hover:border-[#2563eb] hover:text-[#2563eb] transition"
        >
          <FileOutput size={14} />
          Estrai ADM
        </button>
      </div>

      {/* Content */}
      <StockPage key={activeEntity} entity={activeEntity} hideExit />

      {showGeneraTutti && (
        <GeneraTuttiModal onClose={() => setShowGeneraTutti(false)} />
      )}
      {showStockSplit && (
        <StockSplitModal onClose={() => setShowStockSplit(false)} />
      )}
      {showEstraiAdm && (
        <EstraiAdmModal onClose={() => setShowEstraiAdm(false)} />
      )}
    </div>
  )
}
