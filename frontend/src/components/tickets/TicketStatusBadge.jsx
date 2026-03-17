const STATUS_CONFIG = {
  open:        { label: "Aperto",       className: "bg-blue-100 text-blue-700" },
  in_progress: { label: "In lavorazione", className: "bg-amber-100 text-amber-700" },
  waiting:     { label: "In attesa",    className: "bg-purple-100 text-purple-700" },
  resolved:    { label: "Risolto",      className: "bg-green-100 text-green-700" },
  closed:      { label: "Chiuso",       className: "bg-gray-100 text-gray-500" },
}

export default function TicketStatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, className: "bg-gray-100 text-gray-500" }
  return (
    <span className={`text-xs font-bold px-2 py-0.5 rounded ${cfg.className}`}>
      {cfg.label}
    </span>
  )
}
