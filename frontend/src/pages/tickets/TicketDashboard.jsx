import { useQuery } from "@tanstack/react-query"
import { useNavigate } from "react-router-dom"
import {
  TicketCheck, Clock, Loader, PauseCircle, XCircle,
  LayoutDashboard, ArrowLeft, Users, TrendingUp,
} from "lucide-react"
import { ticketsApi } from "@/api/tickets"
import { useAuthStore } from "@/store/authStore"

const STATUS_COLS = [
  { key: "open",        label: "Aperti",        color: "text-blue-600" },
  { key: "in_progress", label: "In lavorazione", color: "text-amber-600" },
  { key: "waiting",     label: "In attesa",      color: "text-violet-600" },
  { key: "closed",      label: "Chiusi",         color: "text-gray-500" },
]

const SUMMARY_CARDS = [
  { key: "total",       label: "Totale",         bg: "bg-[#1e3a5f]",   text: "text-white",      icon: TicketCheck },
  { key: "open",        label: "Aperti",         bg: "bg-blue-50",     text: "text-blue-700",   icon: Clock },
  { key: "in_progress", label: "In lavorazione", bg: "bg-amber-50",    text: "text-amber-700",  icon: Loader },
  { key: "waiting",     label: "In attesa",      bg: "bg-violet-50",   text: "text-violet-700", icon: PauseCircle },
  { key: "closed",      label: "Chiusi",         bg: "bg-gray-100",    text: "text-gray-600",   icon: XCircle },
]

function mergeResolved(rows) {
  return rows?.map(r => ({ ...r, closed: (r.closed ?? 0) + (r.resolved ?? 0) })) ?? []
}

function StatsTable({ rows, showCategory = false }) {
  const merged = mergeResolved(rows)
  if (!merged.length) {
    return <p className="text-sm text-gray-400 py-4 text-center">Nessun dato.</p>
  }
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 font-semibold">
          <th className="px-3 py-2 text-left">Nome</th>
          {showCategory && <th className="px-3 py-2 text-left">Categoria</th>}
          <th className="px-3 py-2 text-right">Tot.</th>
          {STATUS_COLS.map(s => (
            <th key={s.key} className={`px-3 py-2 text-right ${s.color}`}>{s.label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {merged.map((r, i) => (
          <tr key={i} className="border-b border-gray-100 last:border-0 odd:bg-white even:bg-gray-50/50">
            <td className="px-3 py-2 font-medium text-gray-700">{r.name}</td>
            {showCategory && <td className="px-3 py-2 text-gray-500">{r.category}</td>}
            <td className="px-3 py-2 text-right font-bold text-gray-700">{r.total}</td>
            {STATUS_COLS.map(s => (
              <td key={s.key} className={`px-3 py-2 text-right ${r[s.key] > 0 ? s.color + " font-medium" : "text-gray-300"}`}>
                {r[s.key] || "—"}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function Card({ title, children }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100">
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{title}</p>
      </div>
      <div>{children}</div>
    </div>
  )
}

export default function TicketDashboard() {
  const navigate = useNavigate()
  const { hasRole } = useAuthStore()
  const isSuperuser = hasRole("ADMIN") // SUPERUSER ha role=ADMIN

  const { data: stats, isLoading } = useQuery({
    queryKey: ["ticket-stats"],
    queryFn: () => ticketsApi.stats().then(r => r.data),
    refetchInterval: 60_000,
  })

  if (isLoading) {
    return <div className="py-16 text-center text-gray-400 text-sm">Caricamento statistiche...</div>
  }

  const rawTotals = stats?.totals ?? {}
  // "resolved" è trattato come "closed" — sommiamo i due contatori
  const totals = { ...rawTotals, closed: (rawTotals.closed ?? 0) + (rawTotals.resolved ?? 0) }

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate("/tickets")}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition"
        >
          <ArrowLeft size={15} /> Lista ticket
        </button>
        <div className="flex items-center gap-2 flex-1">
          <LayoutDashboard size={18} className="text-[#1e3a5f]" />
          <h1 className="text-xl font-bold text-gray-800">Dashboard Ticket</h1>
        </div>
        {isSuperuser && (
          <button
            onClick={() => navigate("/tickets/performance")}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition"
          >
            <TrendingUp size={15} />
            Performance
          </button>
        )}
      </div>

      {/* Riepilogo totali */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {SUMMARY_CARDS.map(({ key, label, bg, text, icon: Icon }) => (
          <div key={key} className={`${bg} rounded-xl p-4 flex flex-col gap-1`}>
            <div className="flex items-center justify-between">
              <span className={`text-xs font-semibold ${text} opacity-80`}>{label}</span>
              <Icon size={15} className={`${text} opacity-60`} />
            </div>
            <span className={`text-2xl font-black ${text}`}>{totals[key] ?? 0}</span>
          </div>
        ))}
      </div>

      {/* Per team e per categoria affiancati */}
      <div className="grid grid-cols-2 gap-4">
        <Card title="Per team">
          <StatsTable rows={stats?.by_team} />
        </Card>
        <Card title="Per categoria">
          <StatsTable rows={stats?.by_category} />
        </Card>
      </div>

      {/* Per sottocategoria */}
      <Card title="Per sottocategoria">
        <StatsTable rows={stats?.by_subcategory} showCategory />
      </Card>

      {/* Chiusi per assegnatario — solo SUPERUSER */}
      {isSuperuser && stats?.by_assignee?.length > 0 && (
        <Card title="Ticket chiusi per assegnatario">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 font-semibold">
                <th className="px-3 py-2 text-left flex items-center gap-1.5">
                  <Users size={11} /> Assegnatario
                </th>
                <th className="px-3 py-2 text-right text-gray-500">Ticket chiusi</th>
              </tr>
            </thead>
            <tbody>
              {stats.by_assignee.map((r, i) => (
                <tr key={i} className="border-b border-gray-100 last:border-0 odd:bg-white even:bg-gray-50/50">
                  <td className="px-3 py-2 font-medium text-gray-700">{r.name}</td>
                  <td className="px-3 py-2 text-right font-bold text-green-600">{r.closed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

    </div>
  )
}
