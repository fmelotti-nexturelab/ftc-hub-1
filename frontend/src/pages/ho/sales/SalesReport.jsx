import { useNavigate } from "react-router-dom"
import { LogOut } from "lucide-react"

export default function SalesReport() {
  const navigate = useNavigate()
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-800">Report Vendite</h1>
        <button onClick={() => navigate("/ho/sales")} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition">
          <LogOut size={15} aria-hidden="true" />
          Esci
        </button>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center shadow-sm">
        <div className="text-4xl mb-4">📊</div>
        <h2 className="text-xl font-bold text-gray-800 mb-2">Report Vendite</h2>
        <p className="text-gray-500">In sviluppo — disponibile a breve</p>
      </div>
    </div>
  )
}
