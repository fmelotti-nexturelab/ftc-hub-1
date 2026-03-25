import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { salesApi } from "@/api/ho/sales"
import { Trash2, Plus, LogOut } from "lucide-react"

const REASONS = ["CLOSED", "RESTYLING", "NEW OPENING"]

export default function ExcludedStores() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [newStore, setNewStore] = useState({ store_code: "", store_name: "", reason: "CLOSED", notes: "" })
  const [showAdd, setShowAdd] = useState(false)

  const { data: stores = [] } = useQuery({
    queryKey: ["excluded-stores"],
    queryFn: () => salesApi.getExcludedStores().then((r) => r.data),
  })

  const addMut = useMutation({
    mutationFn: salesApi.addExcludedStore,
    onSuccess: () => {
      qc.invalidateQueries(["excluded-stores"])
      setNewStore({ store_code: "", store_name: "", reason: "CLOSED", notes: "" })
      setShowAdd(false)
    },
  })

  const removeMut = useMutation({
    mutationFn: salesApi.removeExcludedStore,
    onSuccess: () => qc.invalidateQueries(["excluded-stores"]),
  })

  const reasonColor = {
    CLOSED: "bg-red-100 text-red-700",
    RESTYLING: "bg-amber-100 text-amber-700",
    "NEW OPENING": "bg-green-100 text-green-700",
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-800">Negozi Esclusi</h1>
        <button onClick={() => navigate("/ho/sales")} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition">
          <LogOut size={15} aria-hidden="true" />
          Esci
        </button>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <h3 className="font-semibold text-gray-800">Negozi esclusi dal check</h3>
        <button onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-1 text-xs bg-[#1e3a5f] text-white px-3 py-1.5 rounded-lg hover:bg-[#2563eb] transition">
          <Plus size={13} /> Aggiungi
        </button>
      </div>
      {showAdd && (
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="es-code" className="sr-only">Codice store</label>
            <input id="es-code" placeholder="Codice store *" value={newStore.store_code}
              onChange={(e) => setNewStore((s) => ({ ...s, store_code: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-300 outline-none" />
          </div>
          <div>
            <label htmlFor="es-name" className="sr-only">Nome store</label>
            <input id="es-name" placeholder="Nome store" value={newStore.store_name}
              onChange={(e) => setNewStore((s) => ({ ...s, store_name: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-300 outline-none" />
          </div>
          <div>
            <label htmlFor="es-reason" className="sr-only">Motivazione</label>
            <select id="es-reason" value={newStore.reason} onChange={(e) => setNewStore((s) => ({ ...s, reason: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-300 outline-none">
              {REASONS.map((r) => <option key={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="es-notes" className="sr-only">Note</label>
            <input id="es-notes" placeholder="Note (opzionale)" value={newStore.notes}
              onChange={(e) => setNewStore((s) => ({ ...s, notes: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-300 outline-none" />
          </div>
          <button onClick={() => addMut.mutate(newStore)} disabled={!newStore.store_code || addMut.isPending}
            className="col-span-2 bg-[#1e3a5f] text-white py-2 rounded-lg text-sm font-medium hover:bg-[#2563eb] transition disabled:opacity-50">
            {addMut.isPending ? "Salvataggio..." : "Salva"}
          </button>
        </div>
      )}
      <div className="divide-y divide-gray-100">
        {stores.length === 0 && <p className="text-center text-gray-400 text-sm py-6">Nessun negozio escluso</p>}
        {stores.map((s) => (
          <div key={s.id} className="flex items-center gap-3 px-4 py-2.5">
            <code className="text-xs font-bold text-gray-700 w-16">{s.store_code}</code>
            <span className="text-sm text-gray-600 flex-1">{s.store_name || "—"}</span>
            <span className={`text-xs px-2 py-0.5 rounded font-medium ${reasonColor[s.reason]}`}>{s.reason}</span>
            {s.notes && <span className="text-xs text-gray-400 italic">{s.notes}</span>}
            <button onClick={() => removeMut.mutate(s.id)} aria-label="Rimuovi store" className="text-red-400 hover:text-red-600 transition">
              <Trash2 size={14} aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    </div>
    </div>
  )
}