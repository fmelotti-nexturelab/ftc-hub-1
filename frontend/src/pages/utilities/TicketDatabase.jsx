import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "react-router-dom"
import { Database, Trash2, AlertTriangle, ChevronLeft, RefreshCw, LogOut } from "lucide-react"
import { ticketsApi } from "@/api/tickets"
import { useAuthStore } from "@/store/authStore"
import TicketStatusBadge from "@/components/tickets/TicketStatusBadge"
import TicketPriorityBadge from "@/components/tickets/TicketPriorityBadge"

const ALLOWED_TYPES = ["SUPERUSER", "ADMIN", "IT"]

export default function TicketDatabase() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const queryClient = useQueryClient()

  // Accesso
  if (!ALLOWED_TYPES.includes(user?.department)) {
    return (
      <div className="py-16 text-center text-gray-400 text-sm">
        Accesso non autorizzato.
      </div>
    )
  }

  const [step, setStep] = useState(null)    // null | "password" | "confirm"
  const [password, setPassword] = useState("")
  const [pwError, setPwError] = useState("")

  const { data: tickets = [], isLoading, refetch } = useQuery({
    queryKey: ["admin-tickets-all"],
    queryFn: () => ticketsApi.adminAll().then(r => r.data),
  })

  const truncateMutation = useMutation({
    mutationFn: (pwd) => ticketsApi.adminTruncate(pwd),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-tickets-all"] })
      queryClient.invalidateQueries({ queryKey: ["tickets"] })
      setStep(null)
      setPassword("")
    },
  })

  const handlePasswordSubmit = () => {
    if (password !== "admink") {
      setPwError("Password non corretta")
      return
    }
    setPwError("")
    setStep("confirm")
  }

  const handleConfirm = () => {
    truncateMutation.mutate(password)
  }

  const handleCancel = () => {
    setStep(null)
    setPassword("")
    setPwError("")
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/utilities")}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
          >
            <ChevronLeft size={18} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-800">Gestione Database Ticket</h1>
            <p className="text-xs text-gray-400 mt-0.5">
              {isLoading ? "Caricamento..." : `${tickets.length} ticket nel database`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            className="flex items-center gap-2 border border-gray-300 hover:border-[#2563eb] hover:text-[#2563eb] text-gray-600 font-semibold py-2 px-4 rounded-xl transition text-sm"
          >
            <RefreshCw size={14} />
            Aggiorna
          </button>
          <button
            onClick={() => setStep("password")}
            disabled={tickets.length === 0}
            className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-xl shadow transition text-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Trash2 size={14} />
            Svuota tabella
          </button>
          <button
            onClick={() => navigate("/utilities")}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition"
          >
            <LogOut size={15} aria-hidden="true" />
            Esci
          </button>
        </div>
      </div>

      {/* Tabella */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="py-16 text-center text-gray-400 text-sm">Caricamento...</div>
        ) : tickets.length === 0 ? (
          <div className="py-16 text-center">
            <Database size={32} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-400 text-sm">La tabella è vuota</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-gray-600 font-semibold text-xs">
                  <th className="px-4 py-3 text-left">#</th>
                  <th className="px-4 py-3 text-left">Titolo</th>
                  <th className="px-4 py-3 text-left">Stato</th>
                  <th className="px-4 py-3 text-left">Priorità</th>
                  <th className="px-4 py-3 text-left">Categoria</th>
                  <th className="px-4 py-3 text-left">Team</th>
                  <th className="px-4 py-3 text-left">Negozio</th>
                  <th className="px-4 py-3 text-left">Creato da</th>
                  <th className="px-4 py-3 text-left">Assegnato a</th>
                  <th className="px-4 py-3 text-left">Data</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((t) => (
                  <tr key={t.id} className="border-b border-gray-100 last:border-0 odd:bg-white even:bg-gray-50/50 text-xs">
                    <td className="px-4 py-2.5 font-mono text-gray-500">
                      #{String(t.ticket_number).padStart(4, "0")}
                    </td>
                    <td className="px-4 py-2.5 font-medium text-gray-700 max-w-xs truncate">
                      {t.title}
                    </td>
                    <td className="px-4 py-2.5"><TicketStatusBadge status={t.status} /></td>
                    <td className="px-4 py-2.5"><TicketPriorityBadge priority={t.priority} /></td>
                    <td className="px-4 py-2.5 text-gray-600">{t.category_name ?? "—"}</td>
                    <td className="px-4 py-2.5">
                      {t.team_name
                        ? <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-medium">{t.team_name}</span>
                        : "—"}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-gray-600">{t.store_number ?? "—"}</td>
                    <td className="px-4 py-2.5 text-gray-600">{t.creator_name ?? "—"}</td>
                    <td className="px-4 py-2.5 text-gray-500">{t.assignee_name ?? "—"}</td>
                    <td className="px-4 py-2.5 text-gray-400">
                      {new Date(t.created_at).toLocaleDateString("it-IT")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal password */}
      {step === "password" && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center shrink-0">
                <Trash2 size={18} className="text-red-600" />
              </div>
              <div>
                <h2 className="font-bold text-gray-800">Svuota tabella ticket</h2>
                <p className="text-xs text-gray-500">Inserisci la password di conferma</p>
              </div>
            </div>
            <input
              type="password"
              value={password}
              onChange={e => { setPassword(e.target.value); setPwError("") }}
              onKeyDown={e => e.key === "Enter" && handlePasswordSubmit()}
              placeholder="Password..."
              autoFocus
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none transition text-sm mb-1"
            />
            {pwError && <p className="text-red-600 text-xs mb-3">{pwError}</p>}
            {!pwError && <div className="mb-3" />}
            <div className="flex gap-2">
              <button
                onClick={handleCancel}
                className="flex-1 border border-gray-300 text-gray-600 font-semibold py-2 rounded-xl hover:bg-gray-50 transition text-sm"
              >
                Annulla
              </button>
              <button
                onClick={handlePasswordSubmit}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-2 rounded-xl transition text-sm"
              >
                Continua
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal conferma */}
      {step === "confirm" && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center shrink-0">
                <AlertTriangle size={18} className="text-red-600" />
              </div>
              <div>
                <h2 className="font-bold text-gray-800">Conferma eliminazione</h2>
                <p className="text-xs text-gray-500">Questa operazione è irreversibile</p>
              </div>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4">
              <p className="text-red-700 text-sm font-medium">
                Stai per eliminare <span className="font-bold">{tickets.length} ticket</span> e tutti i dati collegati (commenti, allegati, notifiche).
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleCancel}
                disabled={truncateMutation.isPending}
                className="flex-1 border border-gray-300 text-gray-600 font-semibold py-2 rounded-xl hover:bg-gray-50 transition text-sm disabled:opacity-50"
              >
                Annulla
              </button>
              <button
                onClick={handleConfirm}
                disabled={truncateMutation.isPending}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-2 rounded-xl transition text-sm disabled:opacity-50"
              >
                {truncateMutation.isPending ? "Eliminazione..." : "Sì, svuota tutto"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
