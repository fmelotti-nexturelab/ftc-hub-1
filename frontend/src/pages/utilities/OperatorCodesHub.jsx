import { useNavigate } from "react-router-dom"
import { Users, LogOut } from "lucide-react"

const CARDS = [
  {
    path: "/utilities/consulta-database/operator-codes/flyingtigeritalia",
    label: "Codici Operatore flyingtigeritalia.com",
    desc: "Consulta la tabella con i codici operatori @flyingtigeritalia",
    iconColor: "bg-violet-500",
  },
  {
    path: "/utilities/consulta-database/operator-codes/pool",
    label: "Pool Codici per Entity",
    desc: "Importa e consulta il pool di codici operatore distinto per entity",
    iconColor: "bg-indigo-500",
  },
]

export default function OperatorCodesHub() {
  const navigate = useNavigate()

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-violet-500/10 rounded-xl flex items-center justify-center">
          <Users size={18} className="text-violet-600" aria-hidden="true" />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-800">Codici Operatore</h1>
          <p className="text-xs text-gray-400 mt-0.5">Consulta le tabelle relative ai codici operatore</p>
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
              <Users className="text-white" size={22} aria-hidden="true" />
            </div>
            <div className="font-semibold text-gray-800">{label}</div>
            <div className="text-sm text-gray-500 mt-1">{desc}</div>
          </button>
        ))}
      </div>
    </div>
  )
}
