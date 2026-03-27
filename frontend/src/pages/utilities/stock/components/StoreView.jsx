import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Search, ChevronLeft, ChevronRight, ChevronUp, ChevronDown } from "lucide-react"
import { stockApi } from "@/api/stock"

export default function StoreView({ sessionId, stores }) {
  const [selectedStore, setSelectedStore] = useState(stores?.[0] ?? "")
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [searchInput, setSearchInput] = useState("")
  const [hideZero, setHideZero] = useState(true)
  const [sort, setSort] = useState({ by: "item_no", dir: "asc" })
  const PAGE_SIZE = 50

  function toggleSort(col) {
    setPage(1)
    setSort((s) => s.by === col ? { by: col, dir: s.dir === "asc" ? "desc" : "asc" } : { by: col, dir: "asc" })
  }

  const { data, isLoading } = useQuery({
    queryKey: ["stock-store", sessionId, selectedStore, page, search, hideZero, sort],
    queryFn: () =>
      stockApi.getStoreItems(sessionId, selectedStore, {
        page,
        page_size: PAGE_SIZE,
        search,
        hide_zero: hideZero,
        sort_by: sort.by,
        sort_dir: sort.dir,
      }).then((r) => r.data),
    enabled: !!sessionId && !!selectedStore,
    keepPreviousData: true,
  })

  function handleSearch(e) {
    e.preventDefault()
    setPage(1)
    setSearch(searchInput)
  }

  const items = data?.items ?? []
  const total = data?.total ?? 0
  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="space-y-3">
      {/* Controls */}
      <div className="flex flex-wrap gap-3 items-center">
        <select
          value={selectedStore}
          onChange={(e) => { setSelectedStore(e.target.value); setPage(1) }}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#2563eb] outline-none"
        >
          {(stores ?? []).map((s) => <option key={s} value={s}>{s}</option>)}
        </select>

        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
          <input
            type="checkbox"
            checked={hideZero}
            onChange={(e) => { setHideZero(e.target.checked); setPage(1) }}
            className="accent-[#1e3a5f]"
          />
          Nascondi stock zero
        </label>

        <form onSubmit={handleSearch} className="flex gap-2 flex-1">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Cerca articolo..."
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#2563eb] focus:border-transparent outline-none"
            />
          </div>
          <button type="submit" className="px-4 py-2 bg-[#1e3a5f] hover:bg-[#2563eb] text-white text-sm font-semibold rounded-lg transition">
            Cerca
          </button>
          {search && (
            <button type="button" onClick={() => { setSearch(""); setSearchInput(""); setPage(1) }}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition">
              Reset
            </button>
          )}
        </form>
      </div>

      <div className="text-xs text-gray-400">
        {isLoading ? "Caricamento..." : `${total.toLocaleString("it-IT")} articoli`}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="text-xs w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th scope="col" className="px-2 py-1.5 text-left font-semibold text-gray-600 min-w-[80px]">
                <button onClick={() => toggleSort("item_no")} className="flex items-center gap-1 hover:text-gray-900 transition" aria-label="Ordina per No.">
                  No.
                  {sort.by === "item_no"
                    ? sort.dir === "asc" ? <ChevronUp size={12} aria-hidden="true" /> : <ChevronDown size={12} aria-hidden="true" />
                    : <ChevronUp size={12} className="text-gray-300" aria-hidden="true" />}
                </button>
              </th>
              <th scope="col" className="px-2 py-1.5 text-left font-semibold text-gray-600">
                <button onClick={() => toggleSort("description")} className="flex items-center gap-1 hover:text-gray-900 transition" aria-label="Ordina per Descrizione">
                  Descrizione
                  {sort.by === "description"
                    ? sort.dir === "asc" ? <ChevronUp size={12} aria-hidden="true" /> : <ChevronDown size={12} aria-hidden="true" />
                    : <ChevronUp size={12} className="text-gray-300" aria-hidden="true" />}
                </button>
              </th>
              <th scope="col" className="px-2 py-1.5 text-right font-semibold text-gray-600 min-w-[44px]">ADM</th>
              <th scope="col" className="px-2 py-1.5 text-right font-semibold text-gray-600 min-w-[60px]">Quantità</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={4} className="px-3 py-8 text-center text-gray-400">Caricamento...</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={4} className="px-3 py-8 text-center text-gray-400">Nessun articolo trovato</td></tr>
            ) : items.map((item, i) => (
              <tr key={i} className="odd:bg-white even:bg-gray-50/50 border-b border-gray-100 last:border-0">
                <td className="px-2 py-1 font-mono text-gray-700">{item.item_no}</td>
                <td className="px-2 py-1 text-gray-600">{item.description}</td>
                <td className={`px-2 py-1 text-right font-mono ${item.adm_stock === 0 ? "text-gray-300" : "text-gray-700"}`}>{item.adm_stock}</td>
                <td className={`px-2 py-1 text-right font-mono font-semibold ${item.quantity < 0 ? "text-red-500" : item.quantity === 0 ? "text-gray-300" : "text-gray-800"}`}>
                  {item.quantity}
                </td>
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
