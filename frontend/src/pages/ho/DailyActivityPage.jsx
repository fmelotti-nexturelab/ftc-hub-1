import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  CheckSquare, Square, ChevronDown, ChevronUp, Clock, CheckCircle2,
  AlertTriangle, Loader2, LogOut, CalendarDays, History,
} from "lucide-react"
import { useNavigate } from "react-router-dom"
import { dailyTasksApi } from "@/api/ho/dailyTasks"

const FREQ_LABEL = { daily: "Giornaliero", monday: "Lunedì", weekly: "Settimanale" }

function lastDoneLabel(last_done_at, done_today) {
  if (!last_done_at) return null
  const d = new Date(last_done_at)
  const now = new Date()
  const diffDays = Math.floor((now - d) / 86400000)
  const time = d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })
  if (done_today) return { label: `Oggi ${time}`, cls: "text-emerald-600 bg-emerald-50" }
  if (diffDays === 1) return { label: `Ieri ${time}`, cls: "text-amber-600 bg-amber-50" }
  return {
    label: d.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit" }) + ` ${time}`,
    cls: "text-red-500 bg-red-50",
  }
}

function TaskCard({ task, checked, onToggle }) {
  const [open, setOpen] = useState(false)
  const badge = lastDoneLabel(task.last_done_at, task.done_today)

  return (
    <div className={`bg-white rounded-xl border shadow-sm transition-all ${
      task.done_today ? "border-emerald-200" : checked ? "border-[#2563eb]" : "border-gray-200"
    }`}>
      <div className="flex items-center gap-3 px-4 py-3">
        <button
          onClick={() => onToggle(task.id)}
          aria-label={checked ? `Deseleziona ${task.name}` : `Seleziona ${task.name}`}
          className="shrink-0 text-gray-400 hover:text-[#2563eb] transition focus-visible:ring-2 focus-visible:ring-[#2563eb] rounded"
        >
          {checked
            ? <CheckSquare size={20} className="text-[#2563eb]" aria-hidden="true" />
            : <Square size={20} aria-hidden="true" />}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-gray-800 text-sm">{task.name}</span>
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
              {FREQ_LABEL[task.frequency] ?? task.frequency}
            </span>
            {task.done_today && (
              <span className="flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">
                <CheckCircle2 size={10} aria-hidden="true" /> Completato
              </span>
            )}
          </div>
          {badge && (
            <div className={`mt-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded inline-flex items-center gap-1 ${badge.cls}`}>
              <Clock size={9} aria-hidden="true" />
              {badge.label}
              {task.last_done_by && ` · ${task.last_done_by}`}
            </div>
          )}
          {!task.last_done_at && (
            <div className="mt-0.5 text-[10px] text-gray-400 italic">Mai completato</div>
          )}
        </div>

        {task.instructions && (
          <button
            onClick={() => setOpen(v => !v)}
            aria-label={open ? "Chiudi istruzioni" : "Apri istruzioni"}
            aria-expanded={open}
            className="shrink-0 text-gray-400 hover:text-gray-600 transition focus-visible:ring-2 focus-visible:ring-[#2563eb] rounded p-1"
          >
            {open ? <ChevronUp size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />}
          </button>
        )}
      </div>

      {open && task.instructions && (
        <div className="border-t border-gray-100 px-4 py-3 bg-gray-50 rounded-b-xl">
          <p className="text-[11px] font-semibold text-gray-500 mb-2 uppercase tracking-wide">Istruzioni</p>
          <pre className="text-xs text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">
            {task.instructions}
          </pre>
        </div>
      )}
    </div>
  )
}

export default function DailyActivityPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [selected, setSelected] = useState(new Set())
  const [showHistory, setShowHistory] = useState(false)
  const [doneMsg, setDoneMsg] = useState(null)

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["daily-tasks"],
    queryFn: () => dailyTasksApi.getTasks().then(r => r.data),
    staleTime: 30_000,
  })

  const { data: history = [] } = useQuery({
    queryKey: ["daily-tasks-history"],
    queryFn: () => dailyTasksApi.getHistory(7).then(r => r.data),
    enabled: showHistory,
    staleTime: 30_000,
  })

  const mutation = useMutation({
    mutationFn: ({ ids }) => dailyTasksApi.complete(ids),
    onSuccess: (res) => {
      const { completed, done_at } = res.data
      const time = new Date(done_at).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })
      setDoneMsg(`${completed} ${completed === 1 ? "attività completata" : "attività completate"} alle ${time}`)
      setSelected(new Set())
      queryClient.invalidateQueries({ queryKey: ["daily-tasks"] })
      queryClient.invalidateQueries({ queryKey: ["daily-tasks-history"] })
    },
  })

  function toggleSelect(id) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleAll() {
    const uncompleted = tasks.filter(t => !t.done_today).map(t => t.id)
    if (selected.size === uncompleted.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(uncompleted))
    }
  }

  const today = new Date().toLocaleDateString("it-IT", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })
  const completedToday = tasks.filter(t => t.done_today).length
  const total = tasks.length
  const progress = total > 0 ? Math.round((completedToday / total) * 100) : 0

  return (
    <div className="space-y-5 max-w-2xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Attività Giornaliere</h1>
          <p className="text-xs text-gray-400 mt-0.5 capitalize">{today}</p>
        </div>
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-300 text-sm text-gray-600 hover:bg-gray-50 transition focus-visible:ring-2 focus-visible:ring-[#2563eb]"
          aria-label="Esci"
        >
          <LogOut size={15} aria-hidden="true" /> Esci
        </button>
      </div>

      {/* Progress */}
      {total > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-gray-700">
              {completedToday} / {total} completate oggi
            </span>
            <span className={`text-sm font-bold ${progress === 100 ? "text-emerald-600" : "text-gray-500"}`}>
              {progress}%
            </span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
            <div
              className={`h-full rounded-full transition-all duration-500 ${progress === 100 ? "bg-emerald-500" : "bg-[#2563eb]"}`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Messaggio completamento */}
      {doneMsg && (
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-sm text-emerald-700 font-medium">
          <CheckCircle2 size={16} aria-hidden="true" /> {doneMsg}
        </div>
      )}

      {/* Lista task */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <Loader2 size={20} className="animate-spin mr-2" aria-hidden="true" /> Caricamento…
        </div>
      ) : tasks.length === 0 ? (
        <div className="text-center py-16 text-gray-400 text-sm">Nessuna attività configurata</div>
      ) : (
        <div className="space-y-2">
          {tasks.map(task => (
            <TaskCard
              key={task.id}
              task={task}
              checked={selected.has(task.id)}
              onToggle={toggleSelect}
            />
          ))}
        </div>
      )}

      {/* Azioni bulk */}
      {tasks.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-3 flex items-center gap-3 flex-wrap">
          <button
            onClick={toggleAll}
            className="text-xs text-[#2563eb] hover:underline focus-visible:ring-2 focus-visible:ring-[#2563eb] rounded"
          >
            {selected.size === tasks.filter(t => !t.done_today).length && selected.size > 0
              ? "Deseleziona tutte"
              : "Seleziona tutte"}
          </button>
          <div className="ml-auto flex items-center gap-2">
            {mutation.isPending && (
              <Loader2 size={14} className="animate-spin text-gray-400" aria-hidden="true" />
            )}
            <button
              onClick={() => mutation.mutate({ ids: Array.from(selected) })}
              disabled={selected.size === 0 || mutation.isPending}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-[#1e3a5f] hover:bg-[#2563eb] text-white shadow transition disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-[#2563eb]"
            >
              <CheckCircle2 size={14} aria-hidden="true" />
              Segna come completate{selected.size > 0 ? ` (${selected.size})` : ""}
            </button>
          </div>
        </div>
      )}

      {/* Storico */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <button
          onClick={() => setShowHistory(v => !v)}
          className="w-full flex items-center gap-2 px-4 py-3 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition focus-visible:ring-2 focus-visible:ring-[#2563eb]"
          aria-expanded={showHistory}
        >
          <History size={15} aria-hidden="true" />
          Storico ultimi 7 giorni
          {showHistory ? <ChevronUp size={14} className="ml-auto" aria-hidden="true" /> : <ChevronDown size={14} className="ml-auto" aria-hidden="true" />}
        </button>
        {showHistory && (
          <div className="border-t border-gray-100">
            {history.length === 0 ? (
              <p className="px-4 py-4 text-sm text-gray-400 italic">Nessun completamento registrato</p>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100 text-gray-500 font-semibold">
                    <th scope="col" className="px-4 py-2 text-left">Attività</th>
                    <th scope="col" className="px-4 py-2 text-left">Completata il</th>
                    <th scope="col" className="px-4 py-2 text-left">Da</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h, i) => (
                    <tr key={i} className="border-b border-gray-50 odd:bg-white even:bg-gray-50/50">
                      <td className="px-4 py-2 font-medium text-gray-700">{h.task_name}</td>
                      <td className="px-4 py-2 text-gray-500">
                        {new Date(h.done_at).toLocaleString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td className="px-4 py-2 text-gray-500">{h.done_by ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

    </div>
  )
}
