import { useState, useMemo, useRef, useCallback } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  Download, Upload, Loader2, FileSpreadsheet, AlertCircle,
  Search, X, Plus, Trash2, FileUp, Save, Check,
} from "lucide-react"
import * as XLSX from "xlsx/dist/xlsx.full.min.js"

import { itemsApi } from "@/api/items"

const ECC_COLUMNS = ["zebra", "descrizione", "prezzo_1", "prezzo_2", "sconto", "testo_prezzo", "categoria", "eccezione", "testo_prezzo2", "col11", "col12"]
const ECC_HEADERS = ["ZEBRA", "DESCRIZIONE", "1 PREZZO", "2 PREZZO", "SCONTO", "TESTO PREZZO", "CATEGORIA", "ECCEZIONE", "TESTO PREZZO2", "Column11", "Column12"]
const ECC_HEADER_TO_FIELD = {
  "ZEBRA": "zebra", "DESCRIZIONE": "descrizione",
  "1 PREZZO": "prezzo_1", "2 PREZZO": "prezzo_2",
  "SCONTO": "sconto", "TESTO PREZZO": "testo_prezzo",
  "CATEGORIA": "categoria", "ECCEZIONE": "eccezione",
  "TESTO PREZZO2": "testo_prezzo2", "Column11": "col11", "Column12": "col12",
}

const EMPTY_ECC = { zebra: "", descrizione: "", prezzo_1: "", prezzo_2: "", sconto: "", testo_prezzo: "", categoria: "", eccezione: "", testo_prezzo2: "", col11: "", col12: "" }

// ── Sub-table per Eccezioni ──────────────────────────────────────────────────
function EccTable({ items, searchVal, onSearch, onRefresh }) {
  const qc = useQueryClient()
  const [mode, setMode] = useState(null) // null | "delete" | "edit"
  const [selected, setSelected] = useState(new Set())
  const [editingId, setEditingId] = useState(null)
  const [editRow, setEditRow] = useState(null)
  const [newRow, setNewRow] = useState(null)
  const [saving, setSaving] = useState(false)
  const [lookupStatus, setLookupStatus] = useState(null) // null | "found" | "not_found"
  const lookupTimer = useRef(null)
  const fileRef = useRef(null)

  const filtered = useMemo(() => {
    if (!searchVal.trim()) return items
    const t = searchVal.trim().toLowerCase()
    return items.filter(i => ECC_COLUMNS.some(k => i[k] != null && String(i[k]).toLowerCase().includes(t)))
  }, [items, searchVal])

  function toggleSelect(id) { setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n }) }
  function toggleAll() { setSelected(s => s.size === filtered.length ? new Set() : new Set(filtered.map(i => i.id))) }

  async function handleDelete() {
    if (!selected.size || !confirm(`Eliminare ${selected.size} righe da Eccezioni?`)) return
    setSaving(true)
    try { await itemsApi.deleteEccezioni([...selected]); setSelected(new Set()); setMode(null); onRefresh() }
    finally { setSaving(false) }
  }

  async function handleSaveEdit() {
    if (!editRow || !editingId) return
    setSaving(true)
    try { await itemsApi.updateEccezione(editingId, editRow); setEditingId(null); setEditRow(null); onRefresh() }
    finally { setSaving(false) }
  }

  async function handleSaveNew() {
    if (!newRow?.zebra) return
    setSaving(true)
    try { await itemsApi.appendEccezioni([newRow]); setNewRow(null); setLookupStatus(null); onRefresh() }
    finally { setSaving(false) }
  }

  function handleNewZebraChange(val) {
    setNewRow(prev => ({ ...prev, zebra: val }))
    setLookupStatus(null)
    if (lookupTimer.current) clearTimeout(lookupTimer.current)
    const trimmed = val.trim()
    if (!trimmed) return
    lookupTimer.current = setTimeout(async () => {
      try {
        const { data } = await itemsApi.lookupItem(trimmed)
        if (data.found) {
          setNewRow(prev => ({ ...prev, descrizione: data.description, categoria: data.category }))
          setLookupStatus("found")
        } else {
          setLookupStatus("not_found")
        }
      } catch { setLookupStatus("not_found") }
    }, 500)
  }

  function handleImportList(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async (evt) => {
      const wb = XLSX.read(new Uint8Array(evt.target.result), { type: "array", raw: true })
      const ws = wb.Sheets[wb.SheetNames.find(n => n.toUpperCase().includes("ECCEZIONI")) || wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: "" })
      let hi = 0
      for (let i = 0; i < Math.min(rows.length, 5); i++) { if (String(rows[i]?.[0] ?? "").trim().toUpperCase() === "ZEBRA") { hi = i; break } }
      const headers = rows[hi] || []
      const colMap = headers.map(h => ECC_HEADER_TO_FIELD[String(h ?? "").trim()] || null)
      const parsed = rows.slice(hi + 1).filter(r => r.some(c => c !== "" && c != null)).map(row => {
        const obj = {}; row.forEach((v, ci) => { const f = colMap[ci]; if (f) obj[f] = v === "" ? null : v }); return obj
      }).filter(r => r.zebra)
      if (parsed.length) { await itemsApi.appendEccezioni(parsed); onRefresh() }
    }
    reader.readAsArrayBuffer(file)
    e.target.value = ""
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <span className="text-sm font-bold text-gray-700">Eccezioni</span>
        <span className="text-xs text-gray-400 tabular-nums">{filtered.length.toLocaleString("it-IT")} righe</span>
        <div className="flex-1" />
        <input ref={fileRef} type="file" accept=".xlsx,.xlsm,.xls" onChange={handleImportList} className="hidden" />
        <button onClick={() => fileRef.current?.click()} className="flex items-center gap-1 text-[11px] text-gray-500 border border-gray-200 rounded-lg px-2 py-1 hover:bg-gray-50 transition" aria-label="Aggiungi da lista">
          <FileUp size={12} aria-hidden="true" /> Da lista
        </button>
        <button onClick={() => { setMode(mode === "edit" ? null : "edit"); setEditingId(null); setNewRow(mode === "edit" ? null : { ...EMPTY_ECC }); setLookupStatus(null) }}
          className={`flex items-center gap-1 text-[11px] border rounded-lg px-2 py-1 transition ${mode === "edit" ? "bg-blue-50 text-blue-600 border-blue-200" : "text-gray-500 border-gray-200 hover:bg-gray-50"}`} aria-label="Aggiungi manuale">
          <Plus size={12} aria-hidden="true" /> Manuale
        </button>
        <button onClick={() => { setMode(mode === "delete" ? null : "delete"); setSelected(new Set()) }}
          className={`flex items-center gap-1 text-[11px] border rounded-lg px-2 py-1 transition ${mode === "delete" ? "bg-red-50 text-red-600 border-red-200" : "text-gray-500 border-gray-200 hover:bg-gray-50"}`} aria-label="Elimina">
          <Trash2 size={12} aria-hidden="true" /> Elimina
        </button>
        {mode === "delete" && selected.size > 0 && (
          <button onClick={handleDelete} disabled={saving} className="flex items-center gap-1 text-[11px] font-semibold text-red-600 bg-red-50 border border-red-200 rounded-lg px-2 py-1 hover:bg-red-100 transition disabled:opacity-50">
            {saving ? <Loader2 size={12} className="animate-spin" aria-hidden="true" /> : <Trash2 size={12} aria-hidden="true" />}
            Elimina {selected.size}
          </button>
        )}
      </div>

      <div className="relative">
        <label htmlFor="ecc-search" className="sr-only">Cerca eccezione</label>
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
        <input id="ecc-search" type="text" placeholder="Cerca..." value={searchVal} onChange={e => onSearch(e.target.value)}
          className="w-full pl-9 pr-8 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2563eb] focus:border-transparent outline-none transition" />
        {searchVal && <button onClick={() => onSearch("")} aria-label="Cancella" className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X size={14} aria-hidden="true" /></button>}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto max-h-[55vh] overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
              <tr>
                {mode === "delete" && <th scope="col" className="px-2 py-2 w-8"><input type="checkbox" onChange={toggleAll} checked={selected.size === filtered.length && filtered.length > 0} className="rounded" aria-label="Seleziona tutto" /></th>}
                {ECC_HEADERS.map((h, i) => <th key={i} scope="col" className="px-2 py-2 text-left text-gray-600 font-semibold whitespace-nowrap text-[10px]">{h}</th>)}
                {mode === "edit" && <th scope="col" className="px-2 py-2 w-10" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {mode === "edit" && newRow && (
                <tr className="bg-blue-50/30 border-b-2 border-blue-200">
                  {ECC_COLUMNS.map((k, ci) => (
                    <td key={ci} className="px-1 py-0.5">
                      {k === "zebra" ? (
                        <input type="text" value={newRow.zebra} onChange={e => handleNewZebraChange(e.target.value)}
                          placeholder={ECC_HEADERS[ci]} autoFocus
                          className={`w-full px-1 py-0.5 text-xs border rounded focus:ring-1 outline-none placeholder:text-gray-300 ${lookupStatus === "not_found" ? "border-red-400 text-red-600 focus:ring-red-400" : "border-blue-300 focus:ring-blue-400"}`} />
                      ) : (
                        <input type="text" value={newRow[k] ?? ""} onChange={e => setNewRow({ ...newRow, [k]: e.target.value })}
                          placeholder={ECC_HEADERS[ci]} className="w-full px-1 py-0.5 text-xs border border-blue-300 rounded focus:ring-1 focus:ring-blue-400 outline-none placeholder:text-gray-300" />
                      )}
                    </td>
                  ))}
                  <td className="px-1 py-0.5">
                    <button onClick={handleSaveNew} disabled={saving || !newRow.zebra} className="text-green-600 hover:text-green-800 disabled:opacity-30" aria-label="Aggiungi">
                      {saving ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                    </button>
                  </td>
                </tr>
              )}
              {filtered.slice(0, 300).map((item) => (
                <tr key={item.id} className={`hover:bg-blue-50/40 ${selected.has(item.id) ? "bg-red-50" : "odd:bg-white even:bg-gray-50/50"}`}>
                  {mode === "delete" && <td className="px-2 py-1"><input type="checkbox" checked={selected.has(item.id)} onChange={() => toggleSelect(item.id)} aria-label={`Seleziona ${item.zebra}`} /></td>}
                  {editingId === item.id ? (
                    ECC_COLUMNS.map((k, ci) => (
                      <td key={ci} className="px-1 py-0.5">
                        <input type="text" value={editRow[k] ?? ""} onChange={e => setEditRow({ ...editRow, [k]: e.target.value })}
                          className="w-full px-1 py-0.5 text-xs border border-blue-300 rounded focus:ring-1 focus:ring-blue-400 outline-none" />
                      </td>
                    ))
                  ) : (
                    ECC_COLUMNS.map((k, ci) => (
                      <td key={ci} className="px-2 py-1.5 text-gray-700 whitespace-nowrap text-[11px]"
                        onDoubleClick={() => { if (mode === "edit") { setEditingId(item.id); setEditRow({ ...item }) } }}>
                        {item[k] != null ? String(item[k]) : ""}
                      </td>
                    ))
                  )}
                  {mode === "edit" && (
                    <td className="px-1 py-0.5">
                      {editingId === item.id ? (
                        <button onClick={handleSaveEdit} disabled={saving} className="text-green-600 hover:text-green-800" aria-label="Salva">
                          {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                        </button>
                      ) : (
                        <button onClick={() => { setEditingId(item.id); setEditRow({ ...item }) }} className="text-gray-400 hover:text-blue-600" aria-label="Modifica">
                          <Save size={12} />
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
              {filtered.length === 0 && !newRow && (
                <tr><td colSpan={ECC_HEADERS.length + (mode ? 1 : 0)} className="px-4 py-6 text-center text-sm text-gray-400">Nessun dato.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ── Sub-table per BestSeller ─────────────────────────────────────────────────
function BsTable({ items, searchVal, onSearch, onRefresh }) {
  const [mode, setMode] = useState(null)
  const [selected, setSelected] = useState(new Set())
  const [editingId, setEditingId] = useState(null)
  const [editVal, setEditVal] = useState("")
  const [newVal, setNewVal] = useState("")
  const [saving, setSaving] = useState(false)
  const [lookupStatus, setLookupStatus] = useState(null)
  const lookupTimer = useRef(null)
  const fileRef = useRef(null)

  const filtered = useMemo(() => {
    if (!searchVal.trim()) return items
    const t = searchVal.trim().toLowerCase()
    return items.filter(i => (i.item_no || "").toLowerCase().includes(t))
  }, [items, searchVal])

  function toggleSelect(id) { setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n }) }
  function toggleAll() { setSelected(s => s.size === filtered.length ? new Set() : new Set(filtered.map(i => i.id))) }

  async function handleDelete() {
    if (!selected.size || !confirm(`Eliminare ${selected.size} righe da Best Seller?`)) return
    setSaving(true)
    try { await itemsApi.deleteBestSeller([...selected]); setSelected(new Set()); setMode(null); onRefresh() }
    finally { setSaving(false) }
  }

  async function handleSaveEdit() {
    if (!editVal.trim() || !editingId) return
    setSaving(true)
    try { await itemsApi.updateBestSeller(editingId, { item_no: editVal.trim() }); setEditingId(null); onRefresh() }
    finally { setSaving(false) }
  }

  async function handleSaveNew() {
    if (!newVal.trim()) return
    setSaving(true)
    try { await itemsApi.appendBestSeller([{ item_no: newVal.trim() }]); setNewVal(""); setLookupStatus(null); onRefresh() }
    finally { setSaving(false) }
  }

  function handleNewItemChange(val) {
    setNewVal(val)
    setLookupStatus(null)
    if (lookupTimer.current) clearTimeout(lookupTimer.current)
    const trimmed = val.trim()
    if (!trimmed) return
    lookupTimer.current = setTimeout(async () => {
      try {
        const { data } = await itemsApi.lookupItem(trimmed)
        setLookupStatus(data.found ? "found" : "not_found")
      } catch { setLookupStatus("not_found") }
    }, 500)
  }

  function handleImportList(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async (evt) => {
      const wb = XLSX.read(new Uint8Array(evt.target.result), { type: "array", raw: true })
      const ws = wb.Sheets[wb.SheetNames.find(n => n.toUpperCase().includes("BEST") || n.toUpperCase().includes("SELLER")) || wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: "" })
      let hi = 0
      for (let i = 0; i < Math.min(rows.length, 5); i++) { if (String(rows[i]?.[0] ?? "").trim().toUpperCase() === "ITEM") { hi = i; break } }
      const parsed = rows.slice(hi + 1).filter(r => r[0] !== "" && r[0] != null).map(r => ({ item_no: String(r[0]).trim() })).filter(r => r.item_no)
      if (parsed.length) { await itemsApi.appendBestSeller(parsed); onRefresh() }
    }
    reader.readAsArrayBuffer(file)
    e.target.value = ""
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <span className="text-sm font-bold text-gray-700">Best Seller</span>
        <span className="text-xs text-gray-400 tabular-nums">{filtered.length.toLocaleString("it-IT")} righe</span>
        <div className="flex-1" />
        <input ref={fileRef} type="file" accept=".xlsx,.xlsm,.xls" onChange={handleImportList} className="hidden" />
        <button onClick={() => fileRef.current?.click()} className="flex items-center gap-1 text-[11px] text-gray-500 border border-gray-200 rounded-lg px-2 py-1 hover:bg-gray-50 transition" aria-label="Aggiungi da lista">
          <FileUp size={12} aria-hidden="true" /> Da lista
        </button>
        <button onClick={() => { setMode(mode === "edit" ? null : "edit"); setEditingId(null); setNewVal(""); setLookupStatus(null) }}
          className={`flex items-center gap-1 text-[11px] border rounded-lg px-2 py-1 transition ${mode === "edit" ? "bg-blue-50 text-blue-600 border-blue-200" : "text-gray-500 border-gray-200 hover:bg-gray-50"}`} aria-label="Aggiungi manuale">
          <Plus size={12} aria-hidden="true" /> Manuale
        </button>
        <button onClick={() => { setMode(mode === "delete" ? null : "delete"); setSelected(new Set()) }}
          className={`flex items-center gap-1 text-[11px] border rounded-lg px-2 py-1 transition ${mode === "delete" ? "bg-red-50 text-red-600 border-red-200" : "text-gray-500 border-gray-200 hover:bg-gray-50"}`} aria-label="Elimina">
          <Trash2 size={12} aria-hidden="true" /> Elimina
        </button>
        {mode === "delete" && selected.size > 0 && (
          <button onClick={handleDelete} disabled={saving} className="flex items-center gap-1 text-[11px] font-semibold text-red-600 bg-red-50 border border-red-200 rounded-lg px-2 py-1 hover:bg-red-100 transition disabled:opacity-50">
            {saving ? <Loader2 size={12} className="animate-spin" aria-hidden="true" /> : <Trash2 size={12} aria-hidden="true" />}
            Elimina {selected.size}
          </button>
        )}
      </div>

      <div className="relative">
        <label htmlFor="bs-search" className="sr-only">Cerca best seller</label>
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
        <input id="bs-search" type="text" placeholder="Cerca..." value={searchVal} onChange={e => onSearch(e.target.value)}
          className="w-full pl-9 pr-8 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2563eb] focus:border-transparent outline-none transition" />
        {searchVal && <button onClick={() => onSearch("")} aria-label="Cancella" className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X size={14} aria-hidden="true" /></button>}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="max-h-[55vh] overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
              <tr>
                {mode === "delete" && <th scope="col" className="px-2 py-2 w-8"><input type="checkbox" onChange={toggleAll} checked={selected.size === filtered.length && filtered.length > 0} className="rounded" aria-label="Seleziona tutto" /></th>}
                <th scope="col" className="px-3 py-2 text-left text-gray-600 font-semibold whitespace-nowrap">ITEM</th>
                {mode === "edit" && <th scope="col" className="px-2 py-2 w-10" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {mode === "edit" && (
                <tr className="bg-blue-50/30 border-b-2 border-blue-200">
                  <td className="px-1 py-0.5">
                    <input type="text" value={newVal} onChange={e => handleNewItemChange(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSaveNew()}
                      placeholder="Codice articolo" autoFocus
                      className={`w-full px-2 py-0.5 text-xs border rounded focus:ring-1 outline-none font-mono placeholder:text-gray-300 ${lookupStatus === "not_found" ? "border-red-400 text-red-600 focus:ring-red-400" : "border-blue-300 focus:ring-blue-400"}`} />
                  </td>
                  <td className="px-1 py-0.5">
                    <button onClick={handleSaveNew} disabled={saving || !newVal.trim()} className="text-green-600 hover:text-green-800 disabled:opacity-30" aria-label="Aggiungi">
                      {saving ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                    </button>
                  </td>
                </tr>
              )}
              {filtered.slice(0, 500).map((item) => (
                <tr key={item.id} className={`hover:bg-blue-50/40 ${selected.has(item.id) ? "bg-red-50" : "odd:bg-white even:bg-gray-50/50"}`}>
                  {mode === "delete" && <td className="px-2 py-1"><input type="checkbox" checked={selected.has(item.id)} onChange={() => toggleSelect(item.id)} aria-label={`Seleziona ${item.item_no}`} /></td>}
                  {editingId === item.id ? (
                    <td className="px-1 py-0.5">
                      <input type="text" value={editVal} onChange={e => setEditVal(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSaveEdit()}
                        className="w-full px-2 py-0.5 text-xs border border-blue-300 rounded focus:ring-1 focus:ring-blue-400 outline-none font-mono" autoFocus />
                    </td>
                  ) : (
                    <td className="px-3 py-1.5 text-gray-700 font-mono whitespace-nowrap"
                      onDoubleClick={() => { if (mode === "edit") { setEditingId(item.id); setEditVal(item.item_no) } }}>
                      {item.item_no}
                    </td>
                  )}
                  {mode === "edit" && (
                    <td className="px-1 py-0.5">
                      {editingId === item.id ? (
                        <button onClick={handleSaveEdit} disabled={saving} className="text-green-600 hover:text-green-800" aria-label="Salva">
                          {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                        </button>
                      ) : (
                        <button onClick={() => { setEditingId(item.id); setEditVal(item.item_no) }} className="text-gray-400 hover:text-blue-600" aria-label="Modifica">
                          <Save size={12} />
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
              {filtered.length === 0 && mode !== "edit" && (
                <tr><td colSpan={mode ? 3 : 1} className="px-4 py-6 text-center text-sm text-gray-400">Nessun dato.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ── Main Panel ───────────────────────────────────────────────────────────────
export default function EccezioniPanel() {
  const queryClient = useQueryClient()
  const [searchEcc, setSearchEcc] = useState("")
  const [searchBs, setSearchBs] = useState("")
  const [importedEcc, setImportedEcc] = useState(null)
  const [importedBs, setImportedBs] = useState(null)
  const [importFileName, setImportFileName] = useState(null)
  const [replacing, setReplacing] = useState(false)
  const [replaceError, setReplaceError] = useState(null)
  const fileInputRef = useRef(null)

  const { data, isLoading } = useQuery({
    queryKey: ["items-eccezioni"],
    queryFn: () => itemsApi.getEccezioni().then(r => r.data),
    staleTime: 30_000,
  })

  const eccezioni = data?.eccezioni ?? []
  const bestseller = data?.bestseller ?? []

  function refresh() { queryClient.invalidateQueries({ queryKey: ["items-eccezioni"] }) }

  function handleDownload() {
    if (!eccezioni.length && !bestseller.length) return
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([ECC_HEADERS, ...eccezioni.map(i => ECC_COLUMNS.map(k => i[k] ?? ""))]), "ECCEZIONI")
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["ITEM"], ...bestseller.map(i => [i.item_no])]), "BEST SELLER")
    XLSX.writeFile(wb, "Eccezioni.xlsx")
  }

  function handleImportFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setReplaceError(null)
    const reader = new FileReader()
    reader.onload = (evt) => {
      const fileData = new Uint8Array(evt.target.result)
      const wb = XLSX.read(fileData, { type: "array", raw: true })

      const eccSheet = wb.SheetNames.find(n => n.toUpperCase().includes("ECCEZIONI"))
      if (eccSheet) {
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[eccSheet], { header: 1, raw: true, defval: "" })
        let hi = 0
        for (let i = 0; i < Math.min(rows.length, 5); i++) { if (String(rows[i]?.[0] ?? "").trim().toUpperCase() === "ZEBRA") { hi = i; break } }
        const headers = rows[hi] || []
        const colMap = headers.map(h => ECC_HEADER_TO_FIELD[String(h ?? "").trim()] || null)
        setImportedEcc(rows.slice(hi + 1).filter(r => r.some(c => c !== "" && c != null)).map(row => {
          const obj = {}; row.forEach((v, ci) => { const f = colMap[ci]; if (f) obj[f] = v === "" ? null : v }); return obj
        }).filter(r => r.zebra))
      } else { setImportedEcc([]) }

      const bsSheet = wb.SheetNames.find(n => n.toUpperCase().includes("BEST") || n.toUpperCase().includes("SELLER"))
      if (bsSheet) {
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[bsSheet], { header: 1, raw: true, defval: "" })
        let hi = 0
        for (let i = 0; i < Math.min(rows.length, 5); i++) { if (String(rows[i]?.[0] ?? "").trim().toUpperCase() === "ITEM") { hi = i; break } }
        setImportedBs(rows.slice(hi + 1).filter(r => r[0] !== "" && r[0] != null).map(r => ({ item_no: String(r[0]).trim() })).filter(r => r.item_no))
      } else { setImportedBs([]) }

      setImportFileName(file.name)
    }
    reader.readAsArrayBuffer(file)
    e.target.value = ""
  }

  async function handleReplace() {
    if (!importedEcc && !importedBs) return
    if (!confirm("Sei sicuro? Questa operazione sostituirà i dati nelle tabelle Eccezioni e Best Seller.")) return
    setReplacing(true); setReplaceError(null)
    try {
      await itemsApi.replaceEccezioni(importedEcc || [], importedBs || [])

      setImportedEcc(null); setImportedBs(null); setImportFileName(null); refresh()
    } catch (e) {
      setReplaceError(e.response?.data?.detail || e.message || "Errore")
    } finally { setReplacing(false) }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 gap-2 text-gray-400">
        <Loader2 size={16} className="animate-spin" aria-hidden="true" />
        <span className="text-sm">Caricamento Eccezioni...</span>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Toolbar globale */}
      <div className="flex items-center gap-3 flex-wrap justify-between">
        <div className="flex items-center gap-2 text-xs">
          <span className="text-gray-400 font-semibold uppercase text-[9px] tracking-wider">Eccezioni</span>
          <span className="text-gray-700 font-semibold tabular-nums">{eccezioni.length.toLocaleString("it-IT")}</span>
          <span className="text-gray-300 mx-1">|</span>
          <span className="text-gray-400 font-semibold uppercase text-[9px] tracking-wider">Best Seller</span>
          <span className="text-gray-700 font-semibold tabular-nums">{bestseller.length.toLocaleString("it-IT")}</span>
        </div>
        <div className="flex items-center gap-2">
          {(eccezioni.length > 0 || bestseller.length > 0) && (
            <button onClick={handleDownload} className="flex items-center gap-2 border border-[#1e3a5f] text-[#1e3a5f] hover:bg-[#1e3a5f] hover:text-white font-semibold py-2 px-5 rounded-xl transition text-sm">
              <Download size={15} aria-hidden="true" /> Download
            </button>
          )}
          <input ref={fileInputRef} type="file" accept=".xlsx,.xlsm,.xls" onChange={handleImportFile} className="hidden" />
          <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 border border-gray-300 text-gray-600 hover:bg-gray-50 font-semibold py-2 px-5 rounded-xl transition text-sm">
            <Upload size={15} aria-hidden="true" /> Sovrascrivi da file
          </button>
          <button onClick={handleReplace} disabled={(!importedEcc && !importedBs) || replacing}
            className="flex items-center gap-2 bg-[#1e3a5f] hover:bg-[#2563eb] text-white font-semibold py-2 px-5 rounded-xl shadow transition text-sm disabled:opacity-40 disabled:cursor-not-allowed">
            {replacing ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <FileSpreadsheet size={15} aria-hidden="true" />}
            Sovrascrivi tabella
          </button>
        </div>
      </div>

      {importFileName && (
        <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5 text-xs">
          <FileSpreadsheet size={14} className="text-blue-500 shrink-0" aria-hidden="true" />
          <span className="text-blue-700 font-medium">{importFileName}</span>
          <span className="text-blue-500">— Eccezioni: {(importedEcc || []).length}, Best Seller: {(importedBs || []).length}</span>
          <button onClick={() => { setImportedEcc(null); setImportedBs(null); setImportFileName(null) }} className="ml-auto text-blue-400 hover:text-blue-600"><X size={14} aria-hidden="true" /></button>
        </div>
      )}

      {replaceError && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2">
          <AlertCircle size={13} className="shrink-0 mt-0.5" aria-hidden="true" /><span>{replaceError}</span>
        </div>
      )}

      {/* Due tabelle affiancate — Eccezioni ridotta */}
      <div className="grid grid-cols-1 lg:grid-cols-[3fr_1fr] gap-4">
        <EccTable items={eccezioni} searchVal={searchEcc} onSearch={setSearchEcc} onRefresh={refresh} />
        <BsTable items={bestseller} searchVal={searchBs} onSearch={setSearchBs} onRefresh={refresh} />
      </div>
    </div>
  )
}
