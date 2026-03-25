import { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Bell, Ticket, CheckCheck, X } from "lucide-react"
import { notificationsApi } from "@/api/notifications"
import { formatDistanceToNow } from "date-fns"
import { it } from "date-fns/locale"

const TYPE_TABS = [
  { key: "all", label: "Tutte" },
  { key: "tickets", label: "Tickets" },
]

const TICKET_TYPES = ["ticket_new", "ticket_status", "ticket_comment", "ticket_assigned"]

function timeAgo(dateStr) {
  try {
    return formatDistanceToNow(new Date(dateStr), { addSuffix: true, locale: it })
  } catch {
    return ""
  }
}

function NotifIcon({ type }) {
  if (TICKET_TYPES.includes(type)) return <Ticket size={15} className="text-blue-500 shrink-0 mt-0.5" />
  return <Bell size={15} className="text-gray-400 shrink-0 mt-0.5" />
}

export default function NotificationPanel() {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState("all")
  const panelRef = useRef(null)
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  // Polling ogni 30 secondi
  const { data } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => notificationsApi.list().then((r) => r.data),
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  })

  const notifications = data?.notifications ?? []
  const unreadCount = data?.unread_count ?? 0

  // Badge PWA sulla taskbar
  useEffect(() => {
    if ("setAppBadge" in navigator) {
      if (unreadCount > 0) {
        navigator.setAppBadge(unreadCount).catch(() => {})
      } else {
        navigator.clearAppBadge().catch(() => {})
      }
    }
  }, [unreadCount])

  // Chiude il pannello cliccando fuori
  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [open])

  const { mutate: markRead } = useMutation({
    mutationFn: (id) => notificationsApi.markRead(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  })

  const { mutate: markAllRead } = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  })

  const filtered = notifications.filter((n) => {
    if (tab === "tickets") return TICKET_TYPES.includes(n.type)
    return true
  })

  function handleNotifClick(notif) {
    if (!notif.is_read) markRead(notif.id)
    if (notif.ticket_id) navigate(`/tickets/${notif.ticket_id}`)
    setOpen(false)
  }

  return (
    <div className="relative" ref={panelRef}>
      {/* Campanella */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded-lg hover:bg-gray-100 transition text-gray-500 hover:text-gray-700"
        aria-label="Notifiche"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 leading-none">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Pannello */}
      {open && (
        <div className="absolute right-0 top-11 w-96 bg-white rounded-xl border border-gray-200 shadow-xl z-50 flex flex-col max-h-[520px]">
          {/* Header pannello */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <span className="font-bold text-gray-800 text-sm">Notifiche</span>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={() => markAllRead()}
                  className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 transition"
                >
                  <CheckCheck size={13} />
                  Segna tutte lette
                </button>
              )}
              <button onClick={() => setOpen(false)} aria-label="Chiudi notifiche" className="text-gray-400 hover:text-gray-600 transition">
                <X size={16} aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-100 px-4">
            {TYPE_TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`py-2 px-3 text-xs font-semibold border-b-2 transition -mb-px ${
                  tab === t.key
                    ? "border-[#1e3a5f] text-[#1e3a5f]"
                    : "border-transparent text-gray-400 hover:text-gray-600"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Lista */}
          <div className="overflow-y-auto flex-1">
            {filtered.length === 0 ? (
              <div className="py-12 text-center text-gray-400 text-sm">Nessuna notifica</div>
            ) : (
              filtered.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleNotifClick(n)}
                  className={`w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition flex gap-3 items-start ${
                    !n.is_read ? "bg-blue-50/50" : ""
                  }`}
                >
                  <NotifIcon type={n.type} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <span className={`text-xs ${!n.is_read ? "font-semibold text-gray-800" : "text-gray-600"} leading-snug`}>
                        {n.title}
                      </span>
                      {!n.is_read && (
                        <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0 mt-1" />
                      )}
                    </div>
                    {n.body && (
                      <p className="text-xs text-gray-500 mt-0.5 truncate">{n.body}</p>
                    )}
                    <p className="text-[10px] text-gray-500 mt-1">{timeAgo(n.created_at)}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
