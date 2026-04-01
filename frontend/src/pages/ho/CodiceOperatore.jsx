import { useNavigate } from "react-router-dom"
import { useAuthStore } from "@/store/authStore"
import { LogOut, UserCheck } from "lucide-react"

export default function CodiceOperatore() {
  const navigate = useNavigate()
  const { user } = useAuthStore()

  const isHR = user?.department === "HR"
  const isAdmin = ["IT", "ADMIN", "SUPERUSER"].includes(user?.department)

  const subtitle = isHR ? "Richiesta" : isAdmin ? "Gestione" : null

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-[#1e3a5f]/10 rounded-xl flex items-center justify-center">
          <UserCheck size={18} className="text-[#1e3a5f]" aria-hidden="true" />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-800">CODICE OPERATORE</h1>
          {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
        </div>
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition focus-visible:ring-2 focus-visible:ring-[#2563eb]"
        >
          <LogOut size={15} aria-hidden="true" />
          Esci
        </button>
      </div>

      {/* Contenuto placeholder */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <p className="text-sm text-gray-500">Modulo in fase di sviluppo.</p>
      </div>
    </div>
  )
}
