import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { CheckCircle, AlertTriangle, XCircle, ChevronDown, ChevronUp, RefreshCw } from "lucide-react"
import { diagnosticsApi } from "@/api/diagnostics"
import { useAuthStore } from "@/store/authStore"

function StatusDot({ status }) {
  const color = status === "ok" ? "bg-green-400" : status === "warning" ? "bg-amber-400" : "bg-red-500"
  const pulse = status !== "ok" ? "animate-pulse" : ""
  return <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${color} ${pulse}`} />
}

function StatusIcon({ status }) {
  if (status === "ok") return <CheckCircle size={13} className="text-green-400 shrink-0" />
  if (status === "warning") return <AlertTriangle size={13} className="text-amber-400 shrink-0" />
  return <XCircle size={13} className="text-red-400 shrink-0" />
}

function statusLabel(status) {
  if (status === "ok") return "Tutti i sistemi operativi"
  if (status === "warning") return "Attenzione richiesta"
  return "Problema critico rilevato"
}

export default function DiagnosticsPanel() {
  const { user } = useAuthStore()
  const [open, setOpen] = useState(false)
  const isPrivileged = ["SUPERUSER", "ADMIN", "IT"].includes(user?.department)

  const { data, isFetching, refetch } = useQuery({
    queryKey: ["diagnostics"],
    queryFn: () => diagnosticsApi.get().then(r => r.data),
    refetchInterval: 5 * 60_000,
    enabled: isPrivileged,
  })

  if (!isPrivileged) return null

  const status = data?.status ?? "ok"

  return (
    <div>
      {/* Badge cliccabile accanto a FTC HUB — iniettato dalla Sidebar */}
      <button
        onClick={() => setOpen(v => !v)}
        title={statusLabel(status)}
        className="flex items-center"
      >
        <StatusDot status={status} />
      </button>

      {/* Pannello espandibile inline */}
      {open && (
        <div className="mt-3 mx-1 bg-white/5 rounded-xl border border-white/10 overflow-hidden">
          {/* Header pannello */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
            <span className="text-xs font-semibold text-white/70">Stato sistema</span>
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="text-white/40 hover:text-white/70 transition disabled:opacity-30"
            >
              <RefreshCw size={11} className={isFetching ? "animate-spin" : ""} />
            </button>
          </div>

          {/* Check list */}
          {!data ? (
            <div className="px-3 py-4 text-center text-white/40 text-xs">Analisi in corso...</div>
          ) : (
            data.checks?.map((check, i) => (
              <div key={i} className="px-3 py-2 border-b border-white/5 last:border-0">
                <div className="flex items-center gap-2">
                  <StatusIcon status={check.status} />
                  <span className="text-xs text-white/80 flex-1">{check.name}</span>
                </div>
                <p className="text-[10px] text-white/40 mt-0.5 ml-5">{check.detail}</p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

// Componente separato solo per il dot — usato inline nella sidebar header
export function DiagnosticsDot() {
  const { user } = useAuthStore()
  const isPrivileged = ["SUPERUSER", "ADMIN", "IT"].includes(user?.department)

  const { data } = useQuery({
    queryKey: ["diagnostics"],
    queryFn: () => diagnosticsApi.get().then(r => r.data),
    refetchInterval: 5 * 60_000,
    enabled: isPrivileged,
    staleTime: 60_000,
  })

  if (!isPrivileged) return null

  const status = data?.status ?? "ok"
  const color = status === "ok" ? "bg-green-400" : status === "warning" ? "bg-amber-400" : "bg-red-500"
  const pulse = status !== "ok" ? "animate-pulse" : ""
  const label = statusLabel(status)

  return (
    <span
      className={`w-2.5 h-2.5 rounded-full shrink-0 ${color} ${pulse}`}
      title={label}
    />
  )
}
