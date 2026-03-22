import { useLocation } from "react-router-dom"
import NotificationPanel from "@/components/shared/NotificationPanel"

const ROUTE_LABELS = {
  "/ho": "Dashboard IT",
  "/ho/sales": "Sales Data",
  "/ho/stock": "Stock",
  "/ho/orders": "Ordini",
  "/ho/ftp": "File FTP",
  "/ho/status": "Online/Offline",
  "/admin": "Amministrazione",
}

export default function Header() {
  const { pathname } = useLocation()
  const title = ROUTE_LABELS[pathname] || "FTC HUB"
  const now = new Date().toLocaleDateString("it-IT", {
    weekday: "long", day: "numeric", month: "long", year: "numeric"
  })

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-3.5 flex items-center justify-between shrink-0">
      <h1 className="text-lg font-bold text-[#1e3a5f]">{title}</h1>
      <div className="flex items-center gap-3">
        <NotificationPanel />
        <span className="text-sm text-gray-400 capitalize">{now}</span>
      </div>
    </header>
  )
}
