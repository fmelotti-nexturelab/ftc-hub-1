import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { History, ExternalLink, Clock, LogOut } from "lucide-react"
import { ticketsApi } from "@/api/tickets"
import { ticketConfigApi } from "@/api/ticketConfig"
import { useAuthStore } from "@/store/authStore"
import TicketPriorityBadge from "@/components/tickets/TicketPriorityBadge"

const PRIORITIES = ["low", "medium", "high", "critical"]
const PRIORITY_LABELS = { low: "Bassa", medium: "Media", high: "Alta", critical: "Critica" }

function formatResolution(minutes) {
  if (minutes == null) return "—"
  if (minutes < 60) return `${minutes}m`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h < 24) return m > 0 ? `${h}h ${m}m` : `${h}h`
  const d = Math.floor(h / 24)
  const rh = h % 24
  return rh > 0 ? `${d}g ${rh}h` : `${d}g`
}

export default function TicketHistory() {
  const navigate = useNavigate()
  const { hasRole } = useAuthStore()
  const isAdmin = hasRole("ADMIN")

  const [filters, setFilters] = useState({
    team_id: "",
    priority: "",
    category_id: "",
  })

  const { data: categories = [] } = useQuery({
    queryKey: ["ticket-categories"],
    queryFn: () => ticketConfigApi.getCategories().then(r => r.data),
  })

  const { data: teams = [] } = useQuery({
    queryKey: ["ticket-teams"],
    queryFn: () => ticketConfigApi.getTeams().then(r => r.data),
    enabled: isAdmin,
  })

  const activeFilters = Object.fromEntries(
    Object.entries(filters).filter(([, v]) => v !== "")
  )

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ["ticket-history", activeFilters],
    queryFn: () => ticketsApi.history(activeFilters).then(r => r.data),
  })

  const set = (field, value) => setFilters(f => ({ ...f, [field]: value }))

  const selectClass = "text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:ring-2 focus:ring-[#2563eb] outline-none"

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-[#1e3a5f]/10 rounded-xl flex items-center justify-center">
          <History size={18} className="text-[#1e3a5f]" />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-800">Storico Ticket</h1>
          <p className="text-xs text-gray-400 mt-0.5">Ticket chiusi e tempi di risoluzione</p>
        </div>
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition"
        >
          <LogOut size={15} aria-hidden="true" />
          Esci
        </button>
      </div>

      {/* Filtri */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider mr-1">Filtra</span>

          {isAdmin && (
            <select value={filters.team_id} onChange={e => set("team_id", e.target.value)} className={selectClass}>
              <option value="">Tutti i team</option>
              {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          )}

          <select value={filters.priority} onChange={e => set("priority", e.target.value)} className={selectClass}>
            <option value="">Tutte le priorità</option>
            {PRIORITIES.map(p => <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>)}
          </select>

          <select value={filters.category_id} onChange={e => set("category_id", e.target.value)} className={selectClass}>
            <option value="">Tutte le categorie</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>

          {Object.values(filters).some(Boolean) && (
            <button
              onClick={() => setFilters({ team_id: "", priority: "", category_id: "" })}
              className="text-xs text-gray-400 hover:text-gray-600 transition ml-1"
            >
              Azzera filtri
            </button>
          )}
        </div>
      </div>

      {/* Tabella */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Banner conteggio */}
        <div className="bg-[#1e3a5f] px-4 py-2 flex items-center justify-between">
          <span className="text-white text-xs font-semibold">
            {isLoading ? "Caricamento..." : `${tickets.length} ticket chiusi`}
          </span>
          <div className="flex items-center gap-1 text-white/70 text-xs">
            <Clock size={11} />
            Tempo = da presa in carico a chiusura
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-gray-600 font-semibold">
                <th scope="col" className="text-left px-4 py-2.5">#</th>
                <th scope="col" className="text-left px-4 py-2.5">Titolo</th>
                <th scope="col" className="text-left px-4 py-2.5">Priorità</th>
                <th scope="col" className="text-left px-4 py-2.5">Categoria</th>
                {isAdmin && <th scope="col" className="text-left px-4 py-2.5">Team</th>}
                <th scope="col" className="text-left px-4 py-2.5">Assegnato a</th>
                <th scope="col" className="text-left px-4 py-2.5">Chiuso il</th>
                <th scope="col" className="text-right px-4 py-2.5">Tempo risoluzione</th>
                <th scope="col" className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={isAdmin ? 9 : 8} className="text-center py-10 text-gray-400">
                    Caricamento...
                  </td>
                </tr>
              ) : tickets.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 9 : 8} className="text-center py-10 text-gray-400">
                    Nessun ticket chiuso trovato.
                  </td>
                </tr>
              ) : tickets.map((t, i) => (
                <tr
                  key={t.id}
                  className={`border-b border-gray-100 hover:bg-blue-50/30 transition ${i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}`}
                >
                  <td className="px-4 py-2.5 font-mono text-gray-400">
                    #{String(t.ticket_number).padStart(4, "0")}
                  </td>
                  <td className="px-4 py-2.5 max-w-[200px] truncate font-medium text-gray-700">
                    {t.title}
                  </td>
                  <td className="px-4 py-2.5">
                    <TicketPriorityBadge priority={t.priority} />
                  </td>
                  <td className="px-4 py-2.5 text-gray-500">{t.category_name || "—"}</td>
                  {isAdmin && <td className="px-4 py-2.5 text-gray-500">{t.team_name || "—"}</td>}
                  <td className="px-4 py-2.5 text-gray-600">{t.assignee_name || "—"}</td>
                  <td className="px-4 py-2.5 text-gray-400">
                    {t.closed_at
                      ? new Date(t.closed_at).toLocaleDateString("it-IT", {
                          day: "2-digit", month: "2-digit", year: "numeric",
                        })
                      : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {t.resolution_minutes != null ? (
                      <span className="font-semibold text-[#1e3a5f]">
                        {formatResolution(t.resolution_minutes)}
                      </span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <button
                      onClick={() => navigate(`/tickets/${t.id}`)}
                      className="text-gray-400 hover:text-[#2563eb] transition"
                      title="Apri ticket"
                    >
                      <ExternalLink size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
