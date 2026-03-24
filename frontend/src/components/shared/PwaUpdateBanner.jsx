import { useState, useEffect } from "react"
import { RefreshCw } from "lucide-react"

export default function PwaUpdateBanner() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return

    // Quando il SW cambia (nuova versione attivata), mostra il banner
    const handleControllerChange = () => setShow(true)
    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange)

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange)
    }
  }, [])

  if (!show) return null

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-[#1e3a5f] text-white text-sm px-5 py-3 rounded-xl shadow-xl border border-white/10">
      <RefreshCw size={15} className="shrink-0" />
      <span>È disponibile una nuova versione.</span>
      <button
        onClick={() => window.location.reload()}
        className="ml-1 bg-white text-[#1e3a5f] font-semibold text-xs px-3 py-1.5 rounded-lg hover:bg-gray-100 transition"
      >
        Aggiorna ora
      </button>
    </div>
  )
}
