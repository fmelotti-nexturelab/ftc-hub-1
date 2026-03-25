import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { stockApi } from "@/api/stock"

export default function StockTable({ sessionId }) {
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 50

  const { data, isLoading } = useQuery({
    queryKey: ["stock-items", sessionId, page],
    queryFn: () =>
      stockApi.getSessionItems(sessionId, { page, page_size: PAGE_SIZE }).then((r) => r.data),
    enabled: !!sessionId,
    keepPreviousData: true,
  })

  const stores = data?.stores ?? []
  const items = data?.items ?? []
  const total = data?.total ?? 0
  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="space-y-3">
      {/* Stats */}
      <div className="text-xs text-gray-400">
        {isLoading ? "Caricamento..." : `${total.toLocaleString("it-IT")} articoli · ${stores.length} negozi`}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="text-xs" style={{ borderCollapse: "collapse" }}>
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-2 py-1.5 text-left font-semibold text-gray-600 sticky left-0 bg-gray-50 z-10 whitespace-nowrap min-w-[80px]">No.</th>
              <th className="px-2 py-1.5 text-left font-semibold text-gray-600 whitespace-nowrap min-w-[160px]">Descrizione</th>
              <th className="px-2 py-1.5 text-right font-semibold text-gray-600 whitespace-nowrap min-w-[44px]">ADM</th>
              {stores.map((s) => (
                <th key={s} className="px-1 py-1.5 text-right font-semibold text-gray-600 whitespace-nowrap min-w-[40px]">{s}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={3 + stores.length} className="px-3 py-8 text-center text-gray-400">Caricamento...</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={3 + stores.length} className="px-3 py-8 text-center text-gray-400">Nessun risultato</td></tr>
            ) : items.map((item, i) => (
              <tr key={i} className="odd:bg-white even:bg-gray-50/50 border-b border-gray-100 last:border-0">
                <td className="px-2 py-1 font-mono text-gray-700 sticky left-0 odd:bg-white even:bg-gray-50/50 whitespace-nowrap">{item.item_no}</td>
                <td className="px-2 py-1 text-gray-600 max-w-[200px]">
                  <div className="truncate">{item.description}</div>
                  {item.description_local && item.description_local !== item.description && (
                    <div className="truncate text-gray-400" style={{ fontSize: "10px" }}>{item.description_local}</div>
                  )}
                </td>
                <td className={`px-2 py-1 text-right font-mono ${item.adm_stock === 0 ? "text-gray-300" : "text-gray-700"}`}>{item.adm_stock}</td>
                {stores.map((s) => {
                  const qty = item.stores?.[s] ?? 0
                  return (
                    <td key={s} className={`px-1 py-1 text-right font-mono ${qty < 0 ? "text-red-500" : qty === 0 ? "text-gray-300" : "text-gray-700"}`}>
                      {qty}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>Pagina {page} di {totalPages}</span>
          <div className="flex gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
              className="p-1.5 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-40 transition">
              <ChevronLeft size={14} />
            </button>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="p-1.5 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-40 transition">
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
