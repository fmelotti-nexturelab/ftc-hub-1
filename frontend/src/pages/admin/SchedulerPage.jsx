import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Clock, Play, ChevronDown, ChevronRight, CheckCircle, AlertCircle, LogOut, Loader2 } from "lucide-react"
import { schedulerApi } from "@/api/scheduler"

function formatDate(iso) {
  if (!iso) return "—"
  return new Date(iso).toLocaleString("it-IT", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  })
}

function formatDuration(ms) {
  if (!ms && ms !== 0) return "—"
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function JobLogs({ name }) {
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["scheduler-logs", name],
    queryFn: () => schedulerApi.getJobLogs(name).then(r => r.data),
  })

  if (isLoading) return <div className="py-4 text-center text-gray-400 text-xs">Caricamento...</div>
  if (!logs.length) return <div className="py-4 text-center text-gray-400 text-xs">Nessuna esecuzione registrata.</div>

  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 font-semibold">
          <th scope="col" className="px-4 py-2 text-left">Data</th>
          <th scope="col" className="px-4 py-2 text-left">Durata</th>
          <th scope="col" className="px-4 py-2 text-left">Esito</th>
          <th scope="col" className="px-4 py-2 text-right">Record</th>
          <th scope="col" className="px-4 py-2 text-left">Dettaglio</th>
        </tr>
      </thead>
      <tbody>
        {logs.map(log => (
          <tr key={log.id} className="border-b border-gray-100">
            <td className="px-4 py-2 text-gray-600">{formatDate(log.started_at)}</td>
            <td className="px-4 py-2 text-gray-500">{formatDuration(log.duration_ms)}</td>
            <td className="px-4 py-2">
              <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded ${
                log.status === "ok" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
              }`}>
                {log.status === "ok" ? <CheckCircle size={10} /> : <AlertCircle size={10} />}
                {log.status}
              </span>
            </td>
            <td className="px-4 py-2 text-right text-gray-500">{log.records_affected ?? "—"}</td>
            <td className="px-4 py-2 text-gray-400 truncate max-w-[300px]" title={log.detail}>{log.detail || "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export default function SchedulerPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [expandedJob, setExpandedJob] = useState(null)

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ["scheduler-jobs"],
    queryFn: () => schedulerApi.getJobs().then(r => r.data),
    refetchInterval: 30000,
  })

  const toggleJob = useMutation({
    mutationFn: (name) => schedulerApi.toggleJob(name),
    onSuccess: () => qc.invalidateQueries(["scheduler-jobs"]),
  })

  const runNow = useMutation({
    mutationFn: (name) => schedulerApi.runJobNow(name),
    onSuccess: (_, name) => {
      qc.invalidateQueries(["scheduler-jobs"])
      qc.invalidateQueries(["scheduler-logs", name])
    },
  })

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-[#1e3a5f]/10 rounded-xl flex items-center justify-center">
          <Clock size={18} className="text-[#1e3a5f]" />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-800">Task Scheduler</h1>
          <p className="text-xs text-gray-400 mt-0.5">Gestisci i task schedulati del sistema</p>
        </div>
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition"
        >
          <LogOut size={15} aria-hidden="true" />
          Esci
        </button>
      </div>

      {/* Jobs */}
      {isLoading ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center text-gray-400">
          <Loader2 size={20} className="animate-spin mx-auto mb-2" />
          Caricamento...
        </div>
      ) : jobs.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center text-gray-400 text-sm">
          Nessun job configurato.
        </div>
      ) : (
        <div className="space-y-3">
          {jobs.map(job => (
            <div key={job.name} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              {/* Job row */}
              <div className="flex items-center gap-4 px-5 py-4">
                {/* Expand toggle */}
                <button
                  aria-label={expandedJob === job.name ? "Chiudi log" : "Mostra log"}
                  onClick={() => setExpandedJob(expandedJob === job.name ? null : job.name)}
                  className="text-gray-400 hover:text-gray-600 transition"
                >
                  {expandedJob === job.name
                    ? <ChevronDown size={16} />
                    : <ChevronRight size={16} />
                  }
                </button>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-800 text-sm">{job.name}</span>
                    <span className="text-xs text-gray-400 font-mono bg-gray-50 px-1.5 py-0.5 rounded">{job.cron_expression}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{job.description}</p>
                </div>

                {/* Ultima esecuzione */}
                <div className="text-right hidden sm:block">
                  <div className="text-xs text-gray-400">Ultima esecuzione</div>
                  <div className="text-xs text-gray-600 font-medium">{formatDate(job.last_run_at)}</div>
                  {job.last_run_status && (
                    <span className={`inline-flex items-center gap-1 text-[10px] font-medium mt-0.5 ${
                      job.last_run_status === "ok" ? "text-green-600" : "text-red-600"
                    }`}>
                      {job.last_run_status === "ok" ? <CheckCircle size={9} /> : <AlertCircle size={9} />}
                      {job.last_run_status} — {formatDuration(job.last_run_duration_ms)}
                    </span>
                  )}
                </div>

                {/* Prossima esecuzione */}
                <div className="text-right hidden sm:block">
                  <div className="text-xs text-gray-400">Prossima</div>
                  <div className="text-xs text-gray-600 font-medium">{formatDate(job.next_run_at)}</div>
                </div>

                {/* Toggle attivo */}
                <button
                  aria-label={job.is_active ? "Disattiva job" : "Attiva job"}
                  onClick={() => toggleJob.mutate(job.name)}
                  className={`text-xs px-2.5 py-1 rounded font-medium cursor-pointer transition hover:opacity-70 ${
                    job.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {job.is_active ? "attivo" : "inattivo"}
                </button>

                {/* Esegui ora */}
                <button
                  aria-label="Esegui ora"
                  onClick={() => runNow.mutate(job.name)}
                  disabled={runNow.isPending}
                  className="flex items-center gap-1.5 text-xs font-medium text-[#1e3a5f] hover:text-[#2563eb] border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition disabled:opacity-40"
                >
                  {runNow.isPending ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
                  Esegui ora
                </button>
              </div>

              {/* Log espandibile */}
              {expandedJob === job.name && (
                <div className="border-t border-gray-100 bg-gray-50/50">
                  <JobLogs name={job.name} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
