import { useState, useEffect, useRef } from "react"
import { useQuery } from "@tanstack/react-query"
import { Activity, X, RefreshCw, CheckCircle, AlertTriangle, XCircle, ChevronDown, ChevronUp } from "lucide-react"
import { diagnosticsApi } from "@/api/diagnostics"
import { useAuthStore } from "@/store/authStore"
import { formatDistanceToNow } from "date-fns"
import { it } from "date-fns/locale"

function StatusIcon({ status, size = 14 }) {
  if (status === "ok") return <CheckCircle size={size} className="text-green-500 shrink-0" />
  if (status === "warning") return <AlertTriangle size={size} className="text-amber-500 shrink-0" />
  return <XCircle size={size} className="text-red-500 shrink-0" />
}

function globalBadgeClass(status) {
  if (status === "ok") return "bg-green-500"
  if (status === "warning") return "bg-amber-500"
  return "bg-red-500"
}

function CheckRow({ check }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-b border-gray-50 last:border-0">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full text-left px-4 py-3 hover:bg-gray-50 transition flex items-center gap-3"
      >
        <StatusIcon status={check.status} />
        <span className={`flex-1 text-xs ${check.status !== "ok" ? "font-semibold text-gray-800" : "text-gray-600"}`}>
          {check.name}
        </span>
        {check.count > 0 && (
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white ${
            check.status === "error" ? "bg-red-500" : "bg-amber-500"
          }`}>
            {check.count}
          </span>
        )}
        {open ? <ChevronUp size={12} className="text-gray-400" /> : <ChevronDown size={12} className="text-gray-400" />}
      </button>
      {open && (
        <div className="px-4 pb-3 ml-5">
          <p className="text-[11px] text-gray-400 mb-1">{check.description}</p>
          <p className={`text-xs font-medium ${
            check.status === "ok" ? "text-green-600" :
            check.status === "warning" ? "text-amber-600" : "text-red-600"
          }`}>
            {check.detail}
          </p>
        </div>
      )}
    </div>
  )
}

export default function DiagnosticsPanel() {
  const { user } = useAuthStore()
  const [open, setOpen] = useState(false)
  const panelRef = useRef(null)

  const isPrivileged = ["SUPERUSER", "ADMIN"].includes(user?.department)

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["diagnostics"],
    queryFn: () => diagnosticsApi.get().then(r => r.data),
    refetchInterval: 5 * 60_000, // ogni 5 minuti
    enabled: isPrivileged,
  })

  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [open])

  if (!isPrivileged) return null

  const status = data?.status ?? "ok"

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen(v => !v)}
        className="relative p-2 rounded-lg hover:bg-gray-100 transition text-gray-500 hover:text-gray-700"
        aria-label="Stato sistema"
      >
        <Activity size={20} />
        {!isLoading && (
          <span className={`absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${globalBadgeClass(status)}`} />
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 w-80 bg-white rounded-xl border border-gray-200 shadow-xl z-50 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <StatusIcon status={status} size={15} />
              <span className="font-bold text-gray-800 text-sm">Stato sistema</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => refetch()}
                disabled={isFetching}
                className="text-gray-400 hover:text-gray-600 transition disabled:opacity-40"
                title="Aggiorna"
              >
                <RefreshCw size={13} className={isFetching ? "animate-spin" : ""} />
              </button>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600 transition">
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Checks */}
          <div className="overflow-y-auto max-h-96">
            {isLoading ? (
              <div className="py-8 text-center text-gray-400 text-xs">Analisi in corso...</div>
            ) : (
              data?.checks?.map((check, i) => <CheckRow key={i} check={check} />)
            )}
          </div>

          {/* Footer */}
          {data?.checked_at && (
            <div className="px-4 py-2 border-t border-gray-100 text-[10px] text-gray-300 text-right">
              Aggiornato {formatDistanceToNow(new Date(data.checked_at), { addSuffix: true, locale: it })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
