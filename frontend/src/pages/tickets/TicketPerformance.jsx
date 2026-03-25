import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import {
  TrendingUp, TrendingDown, Minus, AlertTriangle, Clock,
  Users, BarChart2, LogOut, RefreshCw, CheckCircle, XCircle,
} from "lucide-react"
import { ticketPerformanceApi } from "@/api/ticketPerformance"

const PRIORITY_LABELS = { critical: "Critica", high: "Alta", medium: "Media", low: "Bassa" }
const PRIORITY_COLORS = {
  critical: "text-red-600 bg-red-50 border-red-200",
  high:     "text-orange-600 bg-orange-50 border-orange-200",
  medium:   "text-amber-600 bg-amber-50 border-amber-200",
  low:      "text-green-600 bg-green-50 border-green-200",
}
const PRIORITY_BAR = {
  critical: "bg-red-500",
  high:     "bg-orange-400",
  medium:   "bg-amber-400",
  low:      "bg-green-400",
}
const PERIOD_OPTIONS = [
  { value: 7,   label: "7 giorni" },
  { value: 30,  label: "30 giorni" },
  { value: 60,  label: "60 giorni" },
  { value: 90,  label: "90 giorni" },
]

function fmt(minutes) {
  if (minutes == null || minutes === 0) return "—"
  if (minutes < 60) return `${minutes}m`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h < 24) return m > 0 ? `${h}h ${m}m` : `${h}h`
  const d = Math.floor(h / 24)
  const rh = h % 24
  return rh > 0 ? `${d}g ${rh}h` : `${d}g`
}

function SectionTitle({ children }) {
  return (
    <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">{children}</h2>
  )
}

function KpiCard({ label, value, sub, icon: Icon, color = "text-[#1e3a5f]", bg = "bg-[#1e3a5f]/5" }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
      <div className="flex items-start justify-between mb-2">
        <span className="text-xs text-gray-400 font-medium">{label}</span>
        <div className={`w-8 h-8 ${bg} rounded-lg flex items-center justify-center`}>
          <Icon size={15} className={color} />
        </div>
      </div>
      <div className={`text-2xl font-black ${color}`}>{value ?? "—"}</div>
      {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
    </div>
  )
}

function BarRow({ label, value, max, color = "bg-[#2563eb]", suffix = "" }) {
  const pct = max > 0 ? Math.round(value / max * 100) : 0
  return (
    <div className="flex items-center gap-3 py-1.5">
      <span className="text-xs text-gray-600 w-28 shrink-0 truncate">{label}</span>
      <div className="flex-1 bg-gray-100 rounded-full h-2">
        <div className={`${color} h-2 rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-semibold text-gray-700 w-8 text-right">{value}{suffix}</span>
    </div>
  )
}

function SlaBar({ pct, sla_hours, total }) {
  if (total === 0) return <span className="text-xs text-gray-300">nessun dato</span>
  const color = pct >= 90 ? "bg-green-500" : pct >= 70 ? "bg-amber-400" : "bg-red-500"
  const text  = pct >= 90 ? "text-green-600" : pct >= 70 ? "text-amber-600" : "text-red-600"
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-100 rounded-full h-2">
        <div className={`${color} h-2 rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-xs font-bold w-10 text-right ${text}`}>{pct}%</span>
      <span className="text-xs text-gray-300">({total})</span>
    </div>
  )
}

function TrendChart({ trend }) {
  if (!trend?.length) return <p className="text-xs text-gray-300 py-4 text-center">Nessun dato</p>
  const maxVal = Math.max(...trend.map(d => d.opened), 1)
  const barW = Math.max(4, Math.min(16, Math.floor(560 / trend.length) - 2))

  return (
    <div className="overflow-x-auto">
      <div className="flex items-end gap-[2px] h-24 min-w-0 px-1">
        {trend.map((d, i) => (
          <div key={i} className="flex flex-col items-center gap-[2px] group relative" style={{ minWidth: barW }}>
            <div
              className="w-full bg-[#2563eb]/70 rounded-sm hover:bg-[#2563eb] transition"
              style={{ height: `${Math.round(d.opened / maxVal * 88)}px` }}
            />
            <div
              className="absolute bottom-0 left-1/2 -translate-x-1/2 mb-28 bg-gray-800 text-white text-[10px] rounded px-1.5 py-0.5 whitespace-nowrap opacity-0 group-hover:opacity-100 transition pointer-events-none z-10"
            >
              {d.day.slice(5)}: {d.opened} aperti / {d.closed} chiusi
            </div>
          </div>
        ))}
      </div>
      <div className="flex justify-between text-[10px] text-gray-400 mt-1 px-1">
        <span>{trend[0]?.day?.slice(5)}</span>
        <span>{trend[trend.length - 1]?.day?.slice(5)}</span>
      </div>
    </div>
  )
}

export default function TicketPerformance() {
  const navigate = useNavigate()
  const [days, setDays] = useState(30)

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["ticket-performance", days],
    queryFn: () => ticketPerformanceApi.get(days).then(r => r.data),
    staleTime: 2 * 60 * 1000,
  })

  const vol = data?.volume
  const open = data?.open_now
  const sla = data?.sla ?? {}
  const times = data?.times_by_priority ?? {}
  const byTeam = data?.by_team ?? []
  const topCat = data?.top_categories ?? []
  const topStores = data?.top_stores ?? []
  const trend = data?.trend ?? []
  const maxCat = Math.max(...topCat.map(c => c.count), 1)
  const maxStore = Math.max(...topStores.map(s => s.count), 1)

  const DeltaIcon = !vol?.delta_pct ? Minus
    : vol.delta_pct > 0 ? TrendingUp : TrendingDown
  const deltaColor = !vol?.delta_pct ? "text-gray-400"
    : vol.delta_pct > 0 ? "text-red-500" : "text-green-500"

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-[#1e3a5f]/10 rounded-xl flex items-center justify-center">
          <BarChart2 size={18} className="text-[#1e3a5f]" />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-800">Performance Ticket</h1>
          <p className="text-xs text-gray-400 mt-0.5">KPI e tempi di risoluzione</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={days}
            onChange={e => setDays(Number(e.target.value))}
            className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:ring-2 focus:ring-[#2563eb] outline-none"
          >
            {PERIOD_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition disabled:opacity-40"
          >
            <RefreshCw size={13} className={isFetching ? "animate-spin" : ""} />
          </button>
          <button
            onClick={() => navigate("/tickets")}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition"
          >
            <LogOut size={15} aria-hidden="true" />
            Esci
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="py-20 text-center text-gray-400 text-sm">Caricamento...</div>
      ) : (
        <>
          {/* Riga 1 — KPI principali */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard
              label={`Ticket aperti (${days}gg)`}
              value={vol?.current}
              sub={vol?.delta_pct != null ? (
                <span className={`flex items-center gap-1 ${deltaColor}`}>
                  <DeltaIcon size={11} />
                  {Math.abs(vol.delta_pct)}% vs periodo prec.
                </span>
              ) : "nessun confronto"}
              icon={BarChart2}
            />
            <KpiCard
              label="Ticket aperti ora"
              value={open?.total}
              sub={open?.unassigned > 0 ? `${open.unassigned} non assegnati` : "tutti assegnati"}
              icon={Clock}
              color={open?.unassigned > 0 ? "text-amber-600" : "text-[#1e3a5f]"}
              bg={open?.unassigned > 0 ? "bg-amber-50" : "bg-[#1e3a5f]/5"}
            />
            <KpiCard
              label="In ritardo (SLA)"
              value={open?.overdue}
              sub="aperti oltre la soglia di priorità"
              icon={AlertTriangle}
              color={open?.overdue > 0 ? "text-red-600" : "text-green-600"}
              bg={open?.overdue > 0 ? "bg-red-50" : "bg-green-50"}
            />
            <KpiCard
              label="Team attivi"
              value={byTeam.length}
              sub={`${byTeam.reduce((a, t) => a + t.closed_period, 0)} chiusi nel periodo`}
              icon={Users}
            />
          </div>

          {/* Riga 2 — Ticket aperti per priorità + SLA */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            {/* Ticket aperti ora per priorità */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <SectionTitle>Ticket aperti per priorità</SectionTitle>
              <div className="grid grid-cols-2 gap-2">
                {["critical", "high", "medium", "low"].map(p => (
                  <div key={p} className={`rounded-lg border p-3 ${PRIORITY_COLORS[p]}`}>
                    <div className="text-xs font-medium opacity-70">{PRIORITY_LABELS[p]}</div>
                    <div className="text-2xl font-black mt-0.5">{open?.[p] ?? 0}</div>
                    <div className="text-[10px] opacity-60 mt-0.5">
                      SLA: {data?.sla_thresholds?.[p]}h
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* SLA Compliance */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <SectionTitle>SLA Compliance (ticket chiusi)</SectionTitle>
              <div className="space-y-3">
                {["critical", "high", "medium", "low"].map(p => (
                  <div key={p}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-gray-600">{PRIORITY_LABELS[p]}</span>
                      <span className="text-[10px] text-gray-400">entro {data?.sla_thresholds?.[p]}h</span>
                    </div>
                    <SlaBar
                      pct={sla[p]?.pct}
                      sla_hours={data?.sla_thresholds?.[p]}
                      total={sla[p]?.total ?? 0}
                    />
                  </div>
                ))}
              </div>
              {Object.values(sla).every(s => s.total === 0) && (
                <p className="text-xs text-gray-300 text-center py-4">Nessun ticket chiuso nel periodo</p>
              )}
            </div>
          </div>

          {/* Riga 3 — Tempi medi per priorità */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <SectionTitle>Tempi medi per priorità (ticket chiusi nel periodo)</SectionTitle>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100 text-gray-500 font-semibold">
                    <th scope="col" className="px-4 py-2.5 text-left">Priorità</th>
                    <th scope="col" className="px-4 py-2.5 text-right">Ticket chiusi</th>
                    <th scope="col" className="px-4 py-2.5 text-right">T. presa in carico</th>
                    <th scope="col" className="px-4 py-2.5 text-right">T. risoluzione</th>
                    <th scope="col" className="px-4 py-2.5 text-right">T. totale</th>
                  </tr>
                </thead>
                <tbody>
                  {["critical", "high", "medium", "low"].map(p => {
                    const t = times[p]
                    return (
                      <tr key={p} className="border-b border-gray-50 last:border-0 odd:bg-white even:bg-gray-50/50">
                        <td className="px-4 py-2.5">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded border ${PRIORITY_COLORS[p]}`}>
                            {PRIORITY_LABELS[p]}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right font-semibold text-gray-700">{t?.count ?? "—"}</td>
                        <td className="px-4 py-2.5 text-right text-gray-600">{fmt(t?.avg_response_min)}</td>
                        <td className="px-4 py-2.5 text-right text-gray-600">{fmt(t?.avg_resolution_min)}</td>
                        <td className="px-4 py-2.5 text-right font-semibold text-[#1e3a5f]">{fmt(t?.avg_total_min)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Riga 4 — Per team */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <SectionTitle>Performance per team</SectionTitle>
            </div>
            {byTeam.length === 0 ? (
              <p className="text-xs text-gray-300 text-center py-6">Nessun dato</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100 text-gray-500 font-semibold">
                      <th scope="col" className="px-4 py-2.5 text-left">Team</th>
                      <th scope="col" className="px-4 py-2.5 text-right text-blue-600">Aperti</th>
                      <th scope="col" className="px-4 py-2.5 text-right text-amber-600">In lav.</th>
                      <th scope="col" className="px-4 py-2.5 text-right text-violet-600">In attesa</th>
                      <th scope="col" className="px-4 py-2.5 text-right text-gray-500">Chiusi (periodo)</th>
                      <th scope="col" className="px-4 py-2.5 text-right">T. medio risoluzione</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byTeam.map((t, i) => (
                      <tr key={i} className="border-b border-gray-50 last:border-0 odd:bg-white even:bg-gray-50/50">
                        <td className="px-4 py-2.5 font-medium text-gray-700">{t.team}</td>
                        <td className="px-4 py-2.5 text-right text-blue-600 font-semibold">{t.open || "—"}</td>
                        <td className="px-4 py-2.5 text-right text-amber-600 font-semibold">{t.in_progress || "—"}</td>
                        <td className="px-4 py-2.5 text-right text-violet-600 font-semibold">{t.waiting || "—"}</td>
                        <td className="px-4 py-2.5 text-right text-gray-500">{t.closed_period || "—"}</td>
                        <td className="px-4 py-2.5 text-right font-semibold text-[#1e3a5f]">{fmt(t.avg_res_min)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Riga 5 — Top categorie + Top negozi */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <SectionTitle>Top categorie (volume)</SectionTitle>
              {topCat.length === 0
                ? <p className="text-xs text-gray-300 text-center py-4">Nessun dato</p>
                : topCat.map((c, i) => (
                    <BarRow key={i} label={c.category} value={c.count} max={maxCat} color="bg-[#2563eb]" />
                  ))
              }
            </div>
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <SectionTitle>Top negozi per volume</SectionTitle>
              {topStores.length === 0
                ? <p className="text-xs text-gray-300 text-center py-4">Nessun dato</p>
                : topStores.map((s, i) => (
                    <BarRow key={i} label={s.store} value={s.count} max={maxStore} color="bg-[#1e3a5f]" />
                  ))
              }
            </div>
          </div>

          {/* Riga 6 — Trend */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <SectionTitle>Trend apertura ticket (ultimi {Math.min(days, 60)} giorni)</SectionTitle>
            <TrendChart trend={trend} />
          </div>
        </>
      )}
    </div>
  )
}
