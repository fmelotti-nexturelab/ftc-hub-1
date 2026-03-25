import { Outlet } from "react-router-dom"
import Sidebar from "./Sidebar"
import Header from "./Header"
import PwaUpdateBanner from "@/components/shared/PwaUpdateBanner"
import { useStockAutoImport } from "@/hooks/useStockAutoImport"
import { CheckCircle } from "lucide-react"

function ImportToast({ message }) {
  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-[#1e3a5f] text-white text-sm font-medium px-4 py-3 rounded-xl shadow-xl">
      <CheckCircle size={16} className="text-green-400 shrink-0" />
      {message}
    </div>
  )
}

export default function Shell() {
  const { toast } = useStockAutoImport()

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
      <PwaUpdateBanner />
      {toast && <ImportToast message={toast} />}
    </div>
  )
}
