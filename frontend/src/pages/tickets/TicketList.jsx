import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { Plus, Filter, ExternalLink } from "lucide-react"
import { ticketsApi } from "@/api/tickets"
import { ticketConfigApi } from "@/api/ticketConfig"
import { useAuthStore } from "@/store/authStore"
import TicketStatusBadge from "@/components/tickets/TicketStatusBadge"
import TicketPriorityBadge from "@/components/tickets/TicketPriorityBadge"

const STATUSES = ["open", "in_progress", "waiting", "resolved", "closed"]
const PRIORITIES = ["low", "medium", "high", "critical"]

export default function TicketList() {
  const navigate = useNavigate()
  const { hasRole } = useAuthStore()
  const isAdmin = hasRole("ADMIN")

  const [filters, setFilters] = useState({
    status: "",
    priority: "",
    category_id: "",
    subcategory_id: "",
    team_id: "",
  })

  // Carica categorie per filtro
  const { data: categories = [] } = useQuery({
    queryKey: ["ticket-categories"],
    queryFn: () => ticketConfigApi.getCategories().then(r => r.data),
  })

  // Carica sottocategorie per il filtro categoria selezionato
  const { data: subcategories = [] } = useQuery({
    queryKey: ["ticket-subcategories-filter", filters.category_id],
    queryFn: () => ticketConfigApi.getSubcategories(filters.category_id).then(r => r.data),
    enabled: !!filters.category_id,
  })

  // Carica team per filtro (solo admin)
  const { data: teams = [] } = useQuery({
    queryKey: ["ticket-teams"],
    queryFn: () => ticketConfigApi.getTeams().then(r => r.data),
    enabled: isAdmin,
  })

  const params = {}
  if (filters.status)       params.status = filters.status
  if (filters.priority)     params.priority = filters.priority
  if (filters.category_id)  params.category_id = filters.category_id
  if (filters.subcategory_id) params.subcategory_id = filters.subcategory_id
  if (filters.team_id)      params.team_id = filters.team_id

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ["tickets", params],
    queryFn: () => ticketsApi.list(params).then(r => r.data),
  })

  const set = (k) => (e) => {
    const value = e.target.value
    setFilters(f => {
      const next = { ...f, [k]: value }
      if (k === "category_id") {
        next.subcategory_id = ""
      }
      return next
    })
  }

  const hasFilters = Object.values(filters).some(Boolean)

  const selectClass = "text-xs border border-gray-300 rounded-lg px-2 py-1.5 bg-white focus:ring-2 focus:ring-[#2563eb] outline-none"

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Ticket di assistenza</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {isAdmin ? "Tutti i ticket" : "I miei ticket"}
          </p>
        </div>
        <button
          onClick={() => navigate("/tickets/new")}
          className="flex items-center gap-2 bg-[#1e3a5f] hover:bg-[#2563eb] text-white font-semibold py-2.5 px-5 rounded-xl shadow transition text-sm"
        >
          <Plus size={16} />
          Nuovo ticket
        </button>
      </div>

      {/* Filtri */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-3 flex items-center gap-3 flex-wrap">
        <Filter size={14} className="text-gray-400 shrink-0" />

        <select value={filters.status} onChange={set("status")} className={selectClass}>
          <option value="">Tutti gli stati</option>
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        <select value={filters.priority} onChange={set("priority")} className={selectClass}>
          <option value="">Tutte le priorità</option>
          {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
        </select>

        <select value={filters.category_id} onChange={set("category_id")} className={selectClass}>
          <option value="">Tutte le categorie</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>

        {filters.category_id && subcategories.length > 0 && (
          <select value={filters.subcategory_id} onChange={set("subcategory_id")} className={selectClass}>
            <option value="">Tutte le sottocategorie</option>
            {subcategories.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}

        {isAdmin && (
          <select value={filters.team_id} onChange={set("team_id")} className={selectClass}>
            <option value="">Tutti i team</option>
            {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        )}

        {hasFilters && (
          <button
            onClick={() => setFilters({ status: "", priority: "", category_id: "", subcategory_id: "", team_id: "" })}
            className="text-xs text-gray-400 hover:text-gray-600 transition underline"
          >
            Reset filtri
          </button>
        )}
        <span className="ml-auto text-xs text-gray-400">{tickets.length} ticket</span>
      </div>

      {/* Tabella */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="py-16 text-center text-gray-400 text-sm">Caricamento...</div>
        ) : tickets.length === 0 ? (
          <div className="py-16 text-center text-gray-400 text-sm">Nessun ticket trovato.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-gray-600 font-semibold text-xs">
                <th className="px-4 py-3 text-left">#</th>
                <th className="px-4 py-3 text-left">Titolo</th>
                <th className="px-4 py-3 text-left">Negozio / Richiedente</th>
                <th className="px-4 py-3 text-left">Categoria</th>
                <th className="px-4 py-3 text-left">Sottocategoria</th>
                {isAdmin && <th className="px-4 py-3 text-left">Team</th>}
                <th className="px-4 py-3 text-left">Priorità</th>
                <th className="px-4 py-3 text-left">Stato</th>
                {isAdmin && <th className="px-4 py-3 text-left">Creato da</th>}
                {isAdmin && <th className="px-4 py-3 text-left">Assegnato a</th>}
                <th className="px-4 py-3 text-left">Data</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((t) => (
                <tr
                  key={t.id}
                  onClick={() => navigate(`/tickets/${t.id}`)}
                  className="border-b border-gray-100 last:border-0 hover:bg-gray-50 cursor-pointer transition odd:bg-white even:bg-gray-50/50"
                >
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">
                    #{String(t.ticket_number).padStart(4, "0")}
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-800 max-w-xs truncate">
                    {t.title}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {t.store_number
                      ? <span className="font-mono font-semibold text-gray-700">{t.store_number}</span>
                      : <span className="text-gray-500">{t.requester_name || "—"}</span>
                    }
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{t.category_name ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{t.subcategory_name ?? "—"}</td>
                  {isAdmin && (
                    <td className="px-4 py-3 text-xs">
                      {t.team_name ? (
                        <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs font-medium">
                          {t.team_name}
                        </span>
                      ) : "—"}
                    </td>
                  )}
                  <td className="px-4 py-3"><TicketPriorityBadge priority={t.priority} /></td>
                  <td className="px-4 py-3"><TicketStatusBadge status={t.status} /></td>
                  {isAdmin && <td className="px-4 py-3 text-xs text-gray-600">{t.creator_name ?? "—"}</td>}
                  {isAdmin && <td className="px-4 py-3 text-xs text-gray-500">{t.assignee_name ?? "—"}</td>}
                  <td className="px-4 py-3 text-xs text-gray-400">
                    {new Date(t.created_at).toLocaleDateString("it-IT")}
                  </td>
                  <td className="px-3 py-3 text-right">
                    <button
                      onClick={e => { e.stopPropagation(); navigate(`/tickets/${t.id}`) }}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-[#1e3a5f] hover:bg-gray-100 transition"
                      title="Apri ticket"
                    >
                      <ExternalLink size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
