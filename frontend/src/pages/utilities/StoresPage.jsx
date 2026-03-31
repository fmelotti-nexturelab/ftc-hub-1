import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "react-router-dom"
import { Store, Search, X, MapPin, Phone, Mail, User, Calendar, Building2, Plus, Pencil, Trash2, LogOut } from "lucide-react"
import { utilitiesApi } from "@/api/utilities"
import { useAuthStore } from "@/store/authStore"

const ENTITIES = ["IT01", "IT02", "IT03"]
const inputClass = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#2563eb] focus:border-transparent outline-none transition"
const selectClass = "px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#2563eb] focus:border-transparent outline-none transition bg-white"

const EMPTY_FORM = {
  store_number: "", store_name: "", entity: "IT01", district: "", city: "",
  location_type: "", opening_date: "", address: "", postal_code: "",
  full_address: "", nav_code: "", phone: "", email: "", dm_name: "", sm_name: "",
}

// ── Modal dettaglio ────────────────────────────────────────────────────────────
function StoreModal({ store, onClose }) {
  if (!store) return null
  const entityColor =
    store.entity === "IT01" ? "bg-blue-100 text-blue-700" :
    store.entity === "IT02" ? "bg-emerald-100 text-emerald-700" :
    "bg-violet-100 text-violet-700"

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" role="button" tabIndex={0} aria-label="Chiudi" onClick={onClose} onKeyDown={e => (e.key === "Enter" || e.key === " " || e.key === "Escape") && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between p-6 border-b border-gray-100">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-sm font-bold text-gray-500">{store.store_number}</span>
              <span className={`text-xs font-bold px-2 py-0.5 rounded ${entityColor}`}>{store.entity}</span>
              {store.nav_code && <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">NAV: {store.nav_code}</span>}
            </div>
            <h2 className="text-lg font-bold text-gray-800">{store.store_name}</h2>
          </div>
          <button onClick={onClose} aria-label="Chiudi" className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"><X size={18} aria-hidden="true" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-3">
              <Row icon={<MapPin size={14} />} label="Indirizzo" value={store.full_address || store.address} />
              <Row icon={<Building2 size={14} />} label="Distretto / Tipo" value={[store.district, store.location_type].filter(Boolean).join(" — ")} />
              <Row icon={<Calendar size={14} />} label="Apertura" value={store.opening_date ? new Date(store.opening_date).toLocaleDateString("it-IT") : null} />
            </div>
            <div className="space-y-3">
              <Row icon={<Phone size={14} />} label="Telefono" value={store.phone} />
              <Row icon={<Mail size={14} />} label="Email" value={store.email} />
              <Row icon={<User size={14} />} label="DM / SM" value={store.dm_name} sub={store.sm_name} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Row({ icon, label, value, sub }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-gray-400 mt-0.5 shrink-0">{icon}</span>
      <div>
        <div className="text-xs text-gray-400 mb-0.5">{label}</div>
        <div className="text-sm text-gray-700">{value || "—"}</div>
        {sub && <div className="text-xs text-gray-500">{sub}</div>}
      </div>
    </div>
  )
}

// ── Modal form add/edit ────────────────────────────────────────────────────────
function StoreFormModal({ initial, onClose, onSaved }) {
  const [form, setForm] = useState(initial || EMPTY_FORM)
  const [error, setError] = useState("")
  const isEdit = !!initial?.id
  const qc = useQueryClient()

  const mutation = useMutation({
    mutationFn: () => isEdit
      ? utilitiesApi.updateStore(initial.id, form)
      : utilitiesApi.createStore(form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["stores"] }); qc.invalidateQueries({ queryKey: ["store-filters"] }); onSaved(); onClose() },
    onError: (e) => setError(e.response?.data?.detail || "Errore durante il salvataggio"),
  })

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" role="button" tabIndex={0} aria-label="Chiudi" onClick={onClose} onKeyDown={e => (e.key === "Enter" || e.key === " " || e.key === "Escape") && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="font-bold text-gray-800">{isEdit ? "Modifica Store" : "Nuovo Store"}</h2>
          <button onClick={onClose} aria-label="Chiudi" className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"><X size={18} aria-hidden="true" /></button>
        </div>
        {error && <div className="mx-5 mt-4 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700">{error}</div>}
        <div className="p-5 grid grid-cols-2 gap-3">
          <Field label="Codice Store *" value={form.store_number} onChange={set("store_number")} />
          <Field label="Nome Store *" value={form.store_name} onChange={set("store_name")} />
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Entity *</label>
            <select value={form.entity} onChange={set("entity")} className={selectClass + " w-full"}>
              {ENTITIES.map(e => <option key={e} value={e}>{e}</option>)}
            </select>
          </div>
          <Field label="Distretto" value={form.district} onChange={set("district")} />
          <Field label="Città" value={form.city} onChange={set("city")} />
          <Field label="Tipo (Street/Mall...)" value={form.location_type} onChange={set("location_type")} />
          <Field label="Data apertura" type="date" value={form.opening_date} onChange={set("opening_date")} />
          <Field label="Codice NAV" value={form.nav_code} onChange={set("nav_code")} />
          <Field label="Indirizzo" value={form.address} onChange={set("address")} />
          <Field label="CAP" value={form.postal_code} onChange={set("postal_code")} />
          <div className="col-span-2">
            <Field label="Indirizzo completo" value={form.full_address} onChange={set("full_address")} />
          </div>
          <Field label="Telefono" value={form.phone} onChange={set("phone")} />
          <Field label="Email" type="email" value={form.email} onChange={set("email")} />
          <Field label="DM" value={form.dm_name} onChange={set("dm_name")} />
          <Field label="SM" value={form.sm_name} onChange={set("sm_name")} />
        </div>
        <div className="flex justify-end gap-2 px-5 pb-5">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-500 hover:bg-gray-100 rounded-xl transition">Annulla</button>
          <button onClick={() => mutation.mutate()} disabled={!form.store_number || !form.store_name || mutation.isPending}
            className="px-5 py-2 text-sm bg-[#1e3a5f] hover:bg-[#2563eb] text-white font-semibold rounded-xl shadow transition disabled:opacity-40">
            {mutation.isPending ? "Salvataggio..." : "Salva"}
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, value, onChange, type = "text" }) {
  const id = "field-" + label.toLowerCase().replace(/[^a-z0-9]+/g, "-")
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <input id={id} type={type} value={value || ""} onChange={onChange} className={inputClass} />
    </div>
  )
}

// ── Pagina principale ──────────────────────────────────────────────────────────
export default function StoresPage() {
  const navigate = useNavigate()
  const { hasRole } = useAuthStore()
  const isAdmin = hasRole("ADMIN")
  const qc = useQueryClient()

  const [search, setSearch] = useState("")
  const [entity, setEntity] = useState("")
  const [district, setDistrict] = useState("")
  const [dmName, setDmName] = useState("")
  const [selectedStore, setSelectedStore] = useState(null)
  const [editStore, setEditStore] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)

  const { data: filters } = useQuery({
    queryKey: ["store-filters"],
    queryFn: () => utilitiesApi.getStoreFilters().then(r => r.data),
  })

  const { data: stores = [], isFetching } = useQuery({
    queryKey: ["stores", search, entity, district, dmName],
    queryFn: () => utilitiesApi.getStores({
      ...(search && { search }),
      ...(entity && { entity }),
      ...(district && { district }),
      ...(dmName && { dm_name: dmName }),
    }).then(r => r.data),
  })

  const deleteMutation = useMutation({
    mutationFn: () => utilitiesApi.deleteStore(deleteTarget.id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["stores"] }); setDeleteTarget(null) },
  })

  const resetFilters = () => { setSearch(""); setEntity(""); setDistrict(""); setDmName("") }
  const hasFilters = search || entity || district || dmName

  return (
    <div>
      {/* Modali */}
      {selectedStore && !editStore && !showForm && (
        <StoreModal store={selectedStore} onClose={() => setSelectedStore(null)} />
      )}
      {(showForm || editStore) && (
        <StoreFormModal
          initial={editStore}
          onClose={() => { setShowForm(false); setEditStore(null) }}
          onSaved={() => { setShowForm(false); setEditStore(null) }}
        />
      )}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm">
            <h3 className="font-bold text-gray-800 mb-2">Elimina store</h3>
            <p className="text-sm text-gray-600 mb-5">Sei sicuro di voler eliminare <strong>{deleteTarget.store_name}</strong>?</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 text-sm text-gray-500 hover:bg-gray-100 rounded-xl transition">Annulla</button>
              <button onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending}
                className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl transition disabled:opacity-40">
                {deleteMutation.isPending ? "Eliminazione..." : "Elimina"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-[#1e3a5f]/10 rounded-xl flex items-center justify-center">
            <Store size={18} className="text-[#1e3a5f]" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-800">Info Stores</h1>
            <p className="text-xs text-gray-400 mt-0.5">Consulta l'anagrafica stores OneItaly</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <button onClick={() => { setEditStore(null); setShowForm(true) }}
              className="flex items-center gap-2 bg-[#1e3a5f] hover:bg-[#2563eb] text-white text-sm font-semibold px-4 py-2 rounded-xl shadow transition">
              <Plus size={15} /> Nuovo store
            </button>
          )}
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition"
          >
            <LogOut size={15} aria-hidden="true" />
            Esci
          </button>
        </div>
      </div>

      {/* Filtri */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-4">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="Cerca store, città, SM..." value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#2563eb] focus:border-transparent outline-none transition w-52" />
          </div>
          <select value={entity} onChange={e => setEntity(e.target.value)} className={selectClass}>
            <option value="">Tutte le entity</option>
            {ENTITIES.map(e => <option key={e} value={e}>{e}</option>)}
          </select>
          <select value={district} onChange={e => setDistrict(e.target.value)} className={selectClass}>
            <option value="">Tutti i distretti</option>
            {filters?.districts?.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <select value={dmName} onChange={e => setDmName(e.target.value)} className={selectClass}>
            <option value="">Tutti i DM</option>
            {filters?.dm_names?.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          {hasFilters && (
            <button onClick={resetFilters} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition">
              <X size={13} /> Reset
            </button>
          )}
          <span className="ml-auto text-xs text-gray-400">
            {isFetching ? "Caricamento..." : `${stores.length} store`}
          </span>
        </div>
      </div>

      {/* Tabella */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-gray-600 font-semibold">
                <th className="px-3 py-2.5 text-left">Codice</th>
                <th className="px-3 py-2.5 text-left">Nome</th>
                <th className="px-3 py-2.5 text-left">Entity</th>
                <th className="px-3 py-2.5 text-left">Distretto</th>
                <th className="px-3 py-2.5 text-left">Città</th>
                <th className="px-3 py-2.5 text-left">DM</th>
                <th className="px-3 py-2.5 text-left">SM</th>
                <th className="px-3 py-2.5 text-left">Telefono</th>
                <th className="px-3 py-2.5 text-left">Email</th>
                {isAdmin && <th className="px-3 py-2.5 text-center w-20">Azioni</th>}
              </tr>
            </thead>
            <tbody>
              {stores.map((s, i) => (
                <tr key={s.id} onDoubleClick={() => setSelectedStore(s)}
                  className={`border-b border-gray-100 transition-colors cursor-pointer group
                    ${selectedStore?.id === s.id ? "bg-blue-100" : i % 2 === 0 ? "bg-white hover:bg-blue-50/40" : "bg-gray-50/50 hover:bg-blue-50/40"}`}>
                  <td className="px-3 py-2 font-mono font-semibold text-gray-700">{s.store_number}</td>
                  <td className="px-3 py-2 text-gray-800">{s.store_name}</td>
                  <td className="px-3 py-2">
                    <span className={`font-bold px-1.5 py-0.5 rounded ${
                      s.entity === "IT01" ? "bg-blue-100 text-blue-700" :
                      s.entity === "IT02" ? "bg-emerald-100 text-emerald-700" :
                      "bg-violet-100 text-violet-700"}`}>{s.entity}</span>
                  </td>
                  <td className="px-3 py-2 text-gray-600">{s.district}</td>
                  <td className="px-3 py-2 text-gray-600">{s.city}</td>
                  <td className="px-3 py-2 text-gray-600">{s.dm_name}</td>
                  <td className="px-3 py-2 text-gray-600">{s.sm_name}</td>
                  <td className="px-3 py-2 text-gray-500">{s.phone}</td>
                  <td className="px-3 py-2 text-gray-500">{s.email}</td>
                  {isAdmin && (
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={e => { e.stopPropagation(); setEditStore(s); setShowForm(false) }}
                          className="p-1 rounded text-blue-500 hover:bg-blue-100 transition" title="Modifica">
                          <Pencil size={13} />
                        </button>
                        <button onClick={e => { e.stopPropagation(); setDeleteTarget(s) }}
                          className="p-1 rounded text-red-500 hover:bg-red-100 transition" title="Elimina">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {stores.length === 0 && !isFetching && (
                <tr>
                  <td colSpan={isAdmin ? 10 : 9} className="px-4 py-8 text-center text-gray-400">Nessuno store trovato</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
