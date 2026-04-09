import { useState, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { createPortal } from "react-dom"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Plus, Filter, LayoutDashboard, X, CheckSquare, History, User, Users, Inbox, LogOut, Paperclip, MessageSquare, Lock, Lightbulb, Store } from "lucide-react"
import { ticketsApi } from "@/api/tickets"
import { ticketConfigApi } from "@/api/ticketConfig"
import { useAuthStore } from "@/store/authStore"
import TicketStatusBadge from "@/components/tickets/TicketStatusBadge"
import TicketPriorityBadge from "@/components/tickets/TicketPriorityBadge"

const STATUSES = ["open", "in_progress", "waiting", "closed"]
const STATUS_LABELS = { open: "Aperto", in_progress: "In lavorazione", waiting: "In attesa", closed: "Chiuso" }

function IconTip({ icon: Icon, color, label }) {
  const ref = useRef(null)
  const [pos, setPos] = useState(null)
  return (
    <>
      <span
        ref={ref}
        role="img"
        aria-label={label}
        className="flex items-center cursor-default"
        onMouseEnter={() => {
          const r = ref.current?.getBoundingClientRect()
          if (r) setPos({ x: r.left + r.width / 2, y: r.top })
        }}
        onMouseLeave={() => setPos(null)}
      >
        <Icon size={13} aria-hidden="true" className={color} />
      </span>
      {pos && createPortal(
        <div
          style={{ position: "fixed", left: pos.x, top: pos.y - 6, transform: "translate(-50%, -100%)", zIndex: 99999, pointerEvents: "none" }}
          className="bg-gray-800 text-white text-[11px] font-medium px-2 py-1 rounded-lg shadow-lg whitespace-nowrap"
        >
          {label}
        </div>,
        document.body
      )}
    </>
  )
}
const PRIORITIES = ["low", "medium", "high", "critical"]
const PRIORITY_LABELS = { low: "Bassa", medium: "Media", high: "Alta", critical: "Critica" }

function elapsed(from, to = new Date()) {
  const ms = new Date(to) - new Date(from)
  const m = Math.floor(ms / 60000)
  if (m < 60)   return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24)   return `${h}h`
  const d = Math.floor(h / 24)
  if (d < 30)   return `${d}g`
  const mo = Math.floor(d / 30)
  return `${mo}mesi`
}

function ElapsedBadge({ ticket }) {
  const closed = ticket.status === "closed"
  const duration = closed
    ? elapsed(ticket.created_at, ticket.closed_at)
    : elapsed(ticket.created_at)

  const days = (new Date() - new Date(ticket.created_at)) / 86400000
  const color = closed
    ? "text-gray-400"
    : days > 7  ? "text-red-500 font-semibold"
    : days > 3  ? "text-amber-500"
    : "text-gray-400"

  return (
    <span className={`text-xs ${color}`} title={closed ? "Tempo totale apertura" : "Aperto da"}>
      {duration}
    </span>
  )
}

export default function TicketList() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { hasRole, user } = useAuthStore()
  const isAdmin = hasRole("ADMIN")
  const isStore = ["STORE", "STOREMANAGER"].includes(user?.department)
  const canSeeHistory = ["ADMIN", "SUPERUSER", "IT"].includes(user?.department) || user?.is_team_lead

  const canSeeTeam = !isStore
  const canSeeAll = isAdmin || user?.department === "IT"

  // ── Store: storico mode ────────────────────────────────────────────────────
  const [storicoMode, setStoricoMode] = useState(false)
  const [storicoCategory, setStoricoCategory] = useState("")
  const [storicoYear, setStoricoYear] = useState("")

  const currentYear = new Date().getFullYear()
  const yearOptions = [currentYear, currentYear - 1, currentYear - 2, currentYear - 3]

  // ── Admin/HO: filters + viewMode ──────────────────────────────────────────
  // HO non-admin: default "team"; admin: default null (tutti); store: n/a
  const defaultViewMode = !isStore && !canSeeAll ? "team" : null
  const [viewMode, setViewMode] = useState(defaultViewMode) // null | "mine" | "team" | "all"

  const [filters, setFilters] = useState({
    status: "",
    priority: "",
    category_id: "",
    subcategory_id: "",
    team_id: "",
  })
  const [searchText, setSearchText] = useState("")
  const [storeFilter, setStoreFilter] = useState(null) // null=tutti, "store"=negozio, "mine"=miei

  const [selected, setSelected] = useState(new Set())
  const [bulkAssignTo, setBulkAssignTo] = useState("")

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
    enabled: canSeeTeam,
  })

  const { data: usersData } = useQuery({
    queryKey: ["ticket-users"],
    queryFn: () => ticketsApi.listUsers().then(r => r.data),
    enabled: canSeeTeam,
  })
  const users = usersData?.users ?? []

  const params = {}
  if (filters.status)         params.status = filters.status
  if (filters.priority)       params.priority = filters.priority
  if (filters.category_id)    params.category_id = filters.category_id
  if (filters.subcategory_id) params.subcategory_id = filters.subcategory_id
  if (filters.team_id)        params.team_id = filters.team_id
  if (viewMode === "mine" && canSeeAll) params.assigned_to_id = user?.id
  if (viewMode === "mine" && !canSeeAll) params.created_by_id = user?.id
  if (viewMode === "team")  params.my_team = true
  // viewMode === "all" → nessun param extra, il backend restituisce tutti i ticket

  const storicoParams = { include_closed: true }
  if (storicoCategory) storicoParams.category_id = storicoCategory

  const { data: rawTickets = [], isLoading } = useQuery({
    queryKey: ["tickets", params, viewMode],
    queryFn: () => ticketsApi.list(params).then(r => r.data),
    enabled: !isStore || !storicoMode,
    refetchInterval: 30_000,
  })

  const { data: storicoRaw = [], isLoading: storicoLoading } = useQuery({
    queryKey: ["tickets-storico", storicoParams],
    queryFn: () => ticketsApi.list(storicoParams).then(r => r.data),
    enabled: isStore && storicoMode,
  })

  // Per la vista store default: escludi closed client-side
  // Per la vista storico: applica filtro anno client-side
  const baseTickets = isStore
    ? storicoMode
      ? storicoRaw.filter(t =>
          (!storicoYear || new Date(t.created_at).getFullYear() === parseInt(storicoYear))
        )
      : rawTickets.filter(t => t.status !== "closed")
    : rawTickets

  // Filtro store (negozio vs miei) per store manager
  const storeFiltered = isStore && storeFilter
    ? storeFilter === "mine"
      ? baseTickets.filter(t => t.created_by === user?.id)
      : baseTickets.filter(t => t.created_by !== user?.id)
    : baseTickets

  // Filtro testo su negozio/richiedente
  const tickets = searchText
    ? storeFiltered.filter(t => {
        const q = searchText.toLowerCase()
        const ticketNum = String(t.ticket_number || "").padStart(4, "0")
        return ticketNum.includes(q)
          || (t.requester_name || "").toLowerCase().includes(q)
          || (t.creator_name || "").toLowerCase().includes(q)
          || (t.store_number || "").toLowerCase().includes(q)
      })
    : storeFiltered

  // Contatori per store manager
  const storeTicketCount = isStore ? baseTickets.filter(t => t.created_by !== user?.id).length : 0
  const myTicketCount = isStore ? baseTickets.filter(t => t.created_by === user?.id).length : 0

  const bulkMutation = useMutation({
    mutationFn: (data) => ticketsApi.bulkAction(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tickets"] })
      setSelected(new Set())
      setBulkAssignTo("")
    },
  })

  const set = (k) => (e) => {
    const value = e.target.value
    setFilters(f => {
      const next = { ...f, [k]: value }
      if (k === "category_id") next.subcategory_id = ""
      return next
    })
  }

  const toggleViewMode = (mode) => {
    setViewMode(prev => prev === mode ? null : mode)
  }

  const resetAll = () => {
    setFilters({ status: "", priority: "", category_id: "", subcategory_id: "", team_id: "" })
    setSearchText("")
    setStoreFilter(null)
    setViewMode(null)
  }

  const hasFilters = Object.values(filters).some(Boolean) || viewMode !== null || searchText || storeFilter

  const toggleOne = (id) => setSelected(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  const toggleAll = () => {
    if (selected.size === tickets.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(tickets.map(t => t.id)))
    }
  }

  const handleBulkClose = () => {
    bulkMutation.mutate({ ticket_ids: [...selected], action: "close" })
  }

  const handleBulkAssign = () => {
    if (!bulkAssignTo) return
    bulkMutation.mutate({
      ticket_ids: [...selected],
      action: "assign",
      assigned_to: bulkAssignTo || null,
    })
  }

  const allChecked = tickets.length > 0 && selected.size === tickets.length
  const someChecked = selected.size > 0 && selected.size < tickets.length

  const selectClass = "text-xs border border-gray-300 rounded-lg px-2 py-1.5 bg-white focus:ring-2 focus:ring-[#2563eb] outline-none"

  // ── Vista STORE ─────────────────────────────────────────────────────────────
  if (isStore) {
    const loading = storicoMode ? storicoLoading : isLoading
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-800">I miei ticket</h1>
            <p className="text-xs text-gray-400 mt-0.5">
              {storicoMode ? "Storico completo — tutti gli stati" : "Ticket aperti del tuo negozio"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setStoricoMode(v => !v); setStoricoCategory(""); setStoricoYear("") }}
              className={`flex items-center gap-2 font-semibold py-2.5 px-4 rounded-xl border transition text-sm ${
                storicoMode
                  ? "bg-[#1e3a5f] text-white border-[#1e3a5f]"
                  : "border-gray-300 hover:border-[#2563eb] hover:text-[#2563eb] text-gray-600"
              }`}
            >
              <History size={16} />
              Storico
            </button>
            <button
              onClick={() => navigate("/tickets/new")}
              className="flex items-center gap-2 bg-[#1e3a5f] hover:bg-[#2563eb] text-white font-semibold py-2.5 px-5 rounded-xl shadow transition text-sm"
            >
              <Plus size={16} />
              Nuovo ticket
            </button>
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition"
            >
              <LogOut size={15} aria-hidden="true" />
              Esci
            </button>
          </div>
        </div>

        {/* Filtri Negozio / I miei */}
        {!storicoMode && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setStoreFilter(storeFilter === "store" ? null : "store")}
              className={`flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl border transition ${
                storeFilter === "store"
                  ? "bg-blue-500 text-white border-blue-500"
                  : "bg-white text-gray-600 border-gray-300 hover:border-blue-400 hover:text-blue-600"
              }`}
            >
              <Store size={15} />
              Negozio
              {storeTicketCount > 0 && (
                <span className={`ml-1 text-[10px] font-bold min-w-[18px] h-[16px] flex items-center justify-center rounded-full px-1 ${
                  storeFilter === "store" ? "bg-white/30 text-white" : "bg-blue-100 text-blue-700"
                }`}>{storeTicketCount}</span>
              )}
            </button>
            <button
              onClick={() => setStoreFilter(storeFilter === "mine" ? null : "mine")}
              className={`flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl border transition ${
                storeFilter === "mine"
                  ? "bg-emerald-500 text-white border-emerald-500"
                  : "bg-white text-gray-600 border-gray-300 hover:border-emerald-400 hover:text-emerald-600"
              }`}
            >
              <User size={15} />
              I miei
              {myTicketCount > 0 && (
                <span className={`ml-1 text-[10px] font-bold min-w-[18px] h-[16px] flex items-center justify-center rounded-full px-1 ${
                  storeFilter === "mine" ? "bg-white/30 text-white" : "bg-emerald-100 text-emerald-700"
                }`}>{myTicketCount}</span>
              )}
            </button>
            {storeFilter && (
              <button
                onClick={() => setStoreFilter(null)}
                className="text-xs text-gray-400 hover:text-gray-600 transition underline"
              >
                Mostra tutti
              </button>
            )}
          </div>
        )}

        {/* Filtri storico */}
        {storicoMode && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-3 flex items-center gap-3 flex-wrap">
            <Filter size={14} className="text-gray-400 shrink-0" />
            <select
              value={storicoCategory}
              onChange={e => setStoricoCategory(e.target.value)}
              className={selectClass}
            >
              <option value="">Tutte le categorie</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select
              value={storicoYear}
              onChange={e => setStoricoYear(e.target.value)}
              className={selectClass}
            >
              <option value="">Tutti gli anni</option>
              {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            {(storicoCategory || storicoYear) && (
              <button
                onClick={() => { setStoricoCategory(""); setStoricoYear("") }}
                className="text-xs text-gray-400 hover:text-gray-600 transition underline"
              >
                Reset
              </button>
            )}
            <span className="ml-auto text-xs text-gray-400">{tickets.length} ticket</span>
          </div>
        )}

        {/* Tabella store */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="py-16 text-center text-gray-400 text-sm">Caricamento...</div>
          ) : tickets.length === 0 ? (
            <div className="py-16 text-center text-gray-400 text-sm">
              {storicoMode ? "Nessun ticket trovato." : "Nessun ticket aperto."}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-gray-600 font-semibold text-xs">
                  <th scope="col" className="px-4 py-3 text-left">#</th>
                  <th scope="col" className="px-4 py-3 text-left">Titolo</th>
                  <th scope="col" className="px-4 py-3 text-left">Ambito</th>
                  <th scope="col" className="px-4 py-3 text-left">Priorità</th>
                  <th scope="col" className="px-4 py-3 text-left">Stato</th>
                  <th scope="col" className="px-4 py-3 text-left">Data</th>
                  <th scope="col" className="px-4 py-3 text-left">Durata</th>
                  <th scope="col" className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((t) => (
                  <tr
                    key={t.id}
                    onClick={() => navigate(`/tickets/${t.id}`)}
                    className={`border-b border-gray-100 last:border-0 hover:bg-blue-50/40 cursor-pointer transition ${
                      t.created_by === user?.id ? "bg-emerald-50/60" : "bg-blue-50/40"
                    }`}
                  >
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">
                      #{String(t.ticket_number).padStart(4, "0")}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-800 max-w-xs truncate">{t.title}</td>
                    <td className="px-4 py-3 text-xs">
                      {t.category_name && <span className="text-gray-500">{t.category_name}</span>}
                      {t.subcategory_name && <span className="block text-gray-400 text-[11px]">{t.subcategory_name}</span>}
                      {!t.category_name && !t.subcategory_name && "—"}
                    </td>
                    <td className="px-4 py-3"><TicketPriorityBadge priority={t.priority} /></td>
                    <td className="px-4 py-3"><TicketStatusBadge status={t.status} /></td>
                    <td className="px-4 py-3 text-xs text-gray-400">
                      {new Date(t.created_at).toLocaleDateString("it-IT")}
                    </td>
                    <td className="px-4 py-3"><ElapsedBadge ticket={t} /></td>
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {t.has_attachments && <IconTip icon={Paperclip} color="text-blue-400" label="Ha allegati" />}
                        {t.has_comments && <IconTip icon={MessageSquare} color="text-emerald-500" label="Ha commenti" />}
                        {t.has_internal_notes && <IconTip icon={Lock} color="text-amber-500" label="Ha note interne" />}
                        {t.has_solution && <IconTip icon={Lightbulb} color="text-violet-500" label="Soluzione presente" />}
                      </div>
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

  // ── Vista Admin / HO ─────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Ticket di assistenza</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {isAdmin ? "Tutti i ticket" : user?.department === "DM" ? "Ticket dei miei negozi" : canSeeTeam ? "Ticket del team" : "I miei ticket"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canSeeHistory && (
            <button
              onClick={() => navigate("/tickets/dashboard")}
              className="flex items-center gap-2 border border-gray-300 hover:border-[#2563eb] hover:text-[#2563eb] text-gray-600 font-semibold py-2.5 px-4 rounded-xl transition text-sm"
            >
              <LayoutDashboard size={16} />
              Dashboard
            </button>
          )}
          {canSeeHistory && (
            <button
              onClick={() => navigate("/tickets/history")}
              className="flex items-center gap-2 border border-gray-300 hover:border-[#2563eb] hover:text-[#2563eb] text-gray-600 font-semibold py-2.5 px-4 rounded-xl transition text-sm"
            >
              <History size={16} />
              Storico
            </button>
          )}
          <button
            onClick={() => navigate("/tickets/new")}
            className="flex items-center gap-2 bg-[#1e3a5f] hover:bg-[#2563eb] text-white font-semibold py-2.5 px-5 rounded-xl shadow transition text-sm"
          >
            <Plus size={16} />
            Nuovo ticket
          </button>
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition"
          >
            <LogOut size={15} aria-hidden="true" />
            Esci
          </button>
        </div>
      </div>

      {/* Filtri store manager: Negozio / I miei */}
      {isStore && !storicoMode && (
        <div className="flex items-center gap-2">
          <button
            onClick={() => setStoreFilter(storeFilter === "store" ? null : "store")}
            className={`flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl border transition ${
              storeFilter === "store"
                ? "bg-blue-500 text-white border-blue-500"
                : "bg-white text-gray-600 border-gray-300 hover:border-blue-400 hover:text-blue-600"
            }`}
          >
            <Store size={15} />
            Negozio
            {storeTicketCount > 0 && (
              <span className={`ml-1 text-[10px] font-bold min-w-[18px] h-[16px] flex items-center justify-center rounded-full px-1 ${
                storeFilter === "store" ? "bg-white/30 text-white" : "bg-blue-100 text-blue-700"
              }`}>{storeTicketCount}</span>
            )}
          </button>
          <button
            onClick={() => setStoreFilter(storeFilter === "mine" ? null : "mine")}
            className={`flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl border transition ${
              storeFilter === "mine"
                ? "bg-emerald-500 text-white border-emerald-500"
                : "bg-white text-gray-600 border-gray-300 hover:border-emerald-400 hover:text-emerald-600"
            }`}
          >
            <User size={15} />
            I miei
            {myTicketCount > 0 && (
              <span className={`ml-1 text-[10px] font-bold min-w-[18px] h-[16px] flex items-center justify-center rounded-full px-1 ${
                storeFilter === "mine" ? "bg-white/30 text-white" : "bg-emerald-100 text-emerald-700"
              }`}>{myTicketCount}</span>
            )}
          </button>
          {storeFilter && (
            <button
              onClick={() => setStoreFilter(null)}
              className="text-xs text-gray-400 hover:text-gray-600 transition underline"
            >
              Mostra tutti
            </button>
          )}
        </div>
      )}

      {/* Quick view buttons */}
      <div className="flex items-center gap-2">
        {!isStore && (
          <button
            onClick={() => toggleViewMode("mine")}
            className={`flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl border transition ${
              viewMode === "mine"
                ? "bg-[#1e3a5f] text-white border-[#1e3a5f]"
                : "bg-white text-gray-600 border-gray-300 hover:border-[#2563eb] hover:text-[#2563eb]"
            }`}
          >
            <User size={15} />
            I miei ticket
          </button>
        )}
        {canSeeTeam && (
          <button
            onClick={() => toggleViewMode("team")}
            className={`flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl border transition ${
              viewMode === "team"
                ? "bg-[#1e3a5f] text-white border-[#1e3a5f]"
                : "bg-white text-gray-600 border-gray-300 hover:border-[#2563eb] hover:text-[#2563eb]"
            }`}
          >
            <Users size={15} />
            {user?.department === "DM" ? "I miei negozi" : "Ticket del team"}
          </button>
        )}
        {canSeeAll && (
          <button
            onClick={() => toggleViewMode("all")}
            className={`flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl border transition ${
              viewMode === "all"
                ? "bg-[#1e3a5f] text-white border-[#1e3a5f]"
                : "bg-white text-gray-600 border-gray-300 hover:border-[#2563eb] hover:text-[#2563eb]"
            }`}
          >
            <Inbox size={15} />
            Tutti i ticket
          </button>
        )}
      </div>

      {/* Filtri */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-3 flex items-center gap-3 flex-wrap">
        <Filter size={14} className="text-gray-400 shrink-0" />

        <select value={filters.status} onChange={set("status")} className={selectClass}>
          <option value="">Tutti gli stati</option>
          {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s] ?? s}</option>)}
        </select>

        <select value={filters.priority} onChange={set("priority")} className={selectClass}>
          <option value="">Tutte le priorità</option>
          {PRIORITIES.map(p => <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>)}
        </select>


        {canSeeTeam && (
          <select value={filters.team_id} onChange={set("team_id")} className={selectClass}>
            <option value="">Tutti i team</option>
            {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        )}

        <div className="relative">
          <label htmlFor="search-requester" className="sr-only">Cerca per numero ticket, negozio o richiedente</label>
          <input
            id="search-requester"
            type="text"
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            placeholder="N° Ticket / Negozio / Richiedente"
            className="w-56 px-3 py-1.5 text-xs border border-gray-200 rounded-lg bg-white focus:ring-2 focus:ring-[#2563eb] focus:border-transparent outline-none transition"
          />
        </div>

        <select value={filters.subcategory_id} onChange={set("subcategory_id")} className={selectClass}>
          <option value="">Tutti gli ambiti</option>
          {(() => {
            const seen = new Map()
            ;(tickets || []).forEach(t => {
              if (t.subcategory_id && t.subcategory_name && !seen.has(t.subcategory_id))
                seen.set(t.subcategory_id, t.subcategory_name)
            })
            return [...seen.entries()]
              .sort((a, b) => a[1].localeCompare(b[1]))
              .map(([id, name]) => <option key={id} value={id}>{name}</option>)
          })()}
        </select>

        {hasFilters && (
          <button
            onClick={resetAll}
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
                {canSeeTeam && (
                  <th scope="col" className="px-3 py-3 w-8">
                    <input
                      type="checkbox"
                      checked={allChecked}
                      ref={el => { if (el) el.indeterminate = someChecked }}
                      onChange={toggleAll}
                      className="rounded border-gray-300 text-[#2563eb] cursor-pointer"
                    />
                  </th>
                )}
                <th scope="col" className="px-4 py-3 text-left">#</th>
                <th scope="col" className="px-4 py-3 text-left">Titolo</th>
                <th scope="col" className="px-4 py-3 text-left">Negozio / Richiedente</th>
                {canSeeTeam && <th scope="col" className="px-4 py-3 text-left">Team</th>}
                <th scope="col" className="px-4 py-3 text-left">Ambito</th>
                <th scope="col" className="px-4 py-3 text-left">Priorità</th>
                <th scope="col" className="px-4 py-3 text-left">Stato</th>
                {canSeeTeam && <th scope="col" className="px-4 py-3 text-left">Assegnato a</th>}
                <th scope="col" className="px-4 py-3 text-left">Data</th>
                <th scope="col" className="px-4 py-3 text-left">Durata</th>
                <th scope="col" className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((t) => (
                <tr
                  key={t.id}
                  onClick={() => navigate(`/tickets/${t.id}`)}
                  className={`border-b border-gray-100 last:border-0 hover:bg-blue-50/40 cursor-pointer transition ${
                    selected.has(t.id) ? "bg-blue-50"
                    : isStore && t.created_by === user?.id ? "bg-emerald-50/60"
                    : isStore && t.created_by !== user?.id ? "bg-blue-50/40"
                    : !isStore && t.assigned_to_id === user?.id ? "bg-emerald-50/60"
                    : !isStore && !t.assigned_to_id ? "bg-amber-50/40"
                    : "odd:bg-white even:bg-gray-50/50"
                  }`}
                >
                  {canSeeTeam && (
                    <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                      <input type="checkbox" checked={selected.has(t.id)} onChange={() => toggleOne(t.id)} className="rounded border-gray-300 text-[#2563eb] cursor-pointer" />
                    </td>
                  )}
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">
                    #{String(t.ticket_number).padStart(4, "0")}
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-800 max-w-xs truncate">
                    {t.title}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <span className="font-semibold text-gray-700">{t.requester_name || t.creator_name || "—"}</span>
                    {t.store_number && (
                      <span className="block font-mono text-[11px] text-gray-400 mt-0.5">{t.store_number}</span>
                    )}
                  </td>
                  {canSeeTeam && (
                    <td className="px-4 py-3 text-xs">
                      {t.team_name ? (
                        <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs font-medium">
                          {t.team_name}
                        </span>
                      ) : "—"}
                    </td>
                  )}
                  <td className="px-4 py-3 text-gray-500 text-xs">{t.subcategory_name ?? "—"}</td>
                  <td className="px-4 py-3"><TicketPriorityBadge priority={t.priority} /></td>
                  <td className="px-4 py-3"><TicketStatusBadge status={t.status} /></td>
                  {canSeeTeam && <td className="px-4 py-3 text-xs text-gray-500">{t.assignee_name ?? "—"}</td>}
                  <td className="px-4 py-3 text-xs text-gray-400">
                    {new Date(t.created_at).toLocaleDateString("it-IT")}
                  </td>
                  <td className="px-4 py-3">
                    <ElapsedBadge ticket={t} />
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {t.has_attachments && <IconTip icon={Paperclip} color="text-blue-400" label="Ha allegati" />}
                      {t.has_comments && <IconTip icon={MessageSquare} color="text-emerald-500" label="Ha commenti" />}
                      {t.has_internal_notes && <IconTip icon={Lock} color="text-amber-500" label="Ha note interne" />}
                      {t.has_solution && <IconTip icon={Lightbulb} color="text-violet-500" label="Soluzione presente" />}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Barra azioni bulk */}
      {canSeeTeam && selected.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
          <div className="flex items-center gap-3 bg-[#1e3a5f] text-white rounded-2xl shadow-2xl px-5 py-3">
            <CheckSquare size={16} className="text-white/70 shrink-0" />
            <span className="text-sm font-semibold whitespace-nowrap">
              {selected.size} ticket selezionat{selected.size === 1 ? "o" : "i"}
            </span>

            <div className="w-px h-5 bg-white/20" />

            <button
              onClick={handleBulkClose}
              disabled={bulkMutation.isPending}
              className="text-sm font-semibold bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg transition disabled:opacity-50"
            >
              Chiudi tutti
            </button>

            <div className="flex items-center gap-2">
              <select
                value={bulkAssignTo}
                onChange={e => setBulkAssignTo(e.target.value)}
                className="text-xs bg-white/10 border border-white/20 rounded-lg px-2 py-1.5 text-white focus:outline-none focus:ring-2 focus:ring-white/40"
              >
                <option value="" className="text-gray-800">Assegna a...</option>
                {users.map(u => (
                  <option key={u.id} value={u.id} className="text-gray-800">
                    {u.full_name || u.username}
                  </option>
                ))}
              </select>
              <button
                onClick={handleBulkAssign}
                disabled={!bulkAssignTo || bulkMutation.isPending}
                className="text-sm font-semibold bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg transition disabled:opacity-40"
              >
                Assegna
              </button>
            </div>

            <div className="w-px h-5 bg-white/20" />

            <button
              onClick={() => setSelected(new Set())}
              aria-label="Deseleziona tutto"
              className="p-1 rounded-lg hover:bg-white/20 transition"
            >
              <X size={15} aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
