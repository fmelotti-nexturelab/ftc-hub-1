import { useNavigate } from "react-router-dom"
import { Monitor, LogOut } from "lucide-react"

export default function NavisionPage() {
  const navigate = useNavigate()

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-[#1e3a5f]/10 rounded-xl flex items-center justify-center">
          <Monitor size={18} className="text-[#1e3a5f]" aria-hidden="true" />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-800">Navision</h1>
          <p className="text-xs text-gray-400 mt-0.5">Microsoft Dynamics NAV 2009 R2</p>
        </div>
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition"
        >
          <LogOut size={15} aria-hidden="true" />
          Esci
        </button>
      </div>
    </div>
  )
}
