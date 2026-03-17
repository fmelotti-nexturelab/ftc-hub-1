const PRIORITY_CONFIG = {
  low:      { label: "Bassa",   className: "bg-gray-100 text-gray-700" },
  medium:   { label: "Media",   className: "bg-blue-100 text-blue-700" },
  high:     { label: "Alta",    className: "bg-amber-100 text-amber-700" },
  critical: { label: "Critica", className: "bg-red-100 text-red-700" },
}

export default function TicketPriorityBadge({ priority }) {
  const cfg = PRIORITY_CONFIG[priority] ?? { label: priority, className: "bg-gray-100 text-gray-700" }
  return (
    <span className={`text-xs font-bold px-2 py-0.5 rounded ${cfg.className}`}>
      {cfg.label}
    </span>
  )
}
