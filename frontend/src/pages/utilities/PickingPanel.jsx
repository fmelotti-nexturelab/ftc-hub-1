import { useState, useMemo, useRef } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  Download, Upload, Loader2, FileSpreadsheet, AlertCircle,
  Search, X, Plus, Trash2, FileUp, Save, Check,
} from "lucide-react"
import * as XLSX from "xlsx/dist/xlsx.full.min.js"

import { itemsApi } from "@/api/items"

export default function PickingPanel() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState("")
  const [mode, setMode] = useState(null) // null | "delete" | "edit"
  const [selected, setSelected] = useState(new Set())
  const [editingId, setEditingId] = useState(null)
  const [editVal, setEditVal] = useState("")
  const [newVal, setNewVal] = useState("")
  const [saving, setSaving] = useState(false)
  const [lookupStatus, setLookupStatus] = useState(null)
  const lookupTimer = useRef(null)
  const [importedRows, setImportedRows] = useState(null)
  const [importFileName, setImportFileName] = useState(null)
  const [replacing, setReplacing] = useState(false)
  const [replaceError, setReplaceError] = useState(null)
  const fileRef = useRef(null)
  const importRef = useRef(null)

  const { data, isLoading } = useQuery({
    queryKey: ["items-picking"],
    queryFn: () => itemsApi.getPicking().then(r => r.data),
    staleTime: 30_000,
  })

  const rows = data?.rows ?? []

  function refresh() { queryClient.invalidateQueries({ queryKey: ["items-picking"] }) }

  const filtered = useMemo(() => {
    if (!search.trim()) return rows
    const t = search.trim().toLowerCase()
    return rows.filter(i => (i.item_no || "").toLowerCase().includes(t))
  }, [rows, search])

  function toggleSelect(id) { setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n }) }
  function toggleAll() { setSelected(s => s.size === filtered.length ? new Set() : new Set(filtered.map(i => i.id))) }

  async function handleDelete() {
    if (!selected.size || !confirm(`Eliminare ${selected.size} righe da ITEM for PICK?`)) return
    setSaving(true)
    try { await itemsApi.deletePicking([...selected]); setSelected(new Set()); setMode(null); refresh() }
    finally { setSaving(false) }
  }

  async function handleSaveEdit() {
    if (!editVal.trim() || !editingId) return
    setSaving(true)
    try { await itemsApi.updatePicking(editingId, { item_no: editVal.trim() }); setEditingId(null); refresh() }
    finally { setSaving(false) }
  }

  async function handleSaveNew() {
    if (!newVal.trim()) return
    setSaving(true)
    try { await itemsApi.appendPicking([{ item_no: newVal.trim() }]); setNewVal(""); setLookupStatus(null); refresh() }
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
      const ws = wb.Sheets[wb.SheetNames.find(n => n.toUpperCase().includes("PICK")) || wb.SheetNames[0]]
      const rawRows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: "" })
      let hi = 0
      for (let i = 0; i < Math.min(rawRows.length, 5); i++) { if (String(rawRows[i]?.[0] ?? "").trim().toUpperCase() === "ITEM") { hi = i; break } }
      const parsed = rawRows.slice(hi + 1).filter(r => r[0] !== "" && r[0] != null).map(r => ({ item_no: String(r[0]).trim() })).filter(r => r.item_no)
      if (parsed.length) { await itemsApi.appendPicking(parsed); refresh() }
    }
    reader.readAsArrayBuffer(file)
    e.target.value = ""
  }

  function handleImportFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setReplaceError(null)
    const reader = new FileReader()
    reader.onload = (evt) => {
      const wb = XLSX.read(new Uint8Array(evt.target.result), { type: "array", raw: true })
      const ws = wb.Sheets[wb.SheetNames.find(n => n.toUpperCase().includes("PICK")) || wb.SheetNames[0]]
      const rawRows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: "" })
      let hi = 0
      for (let i = 0; i < Math.min(rawRows.length, 5); i++) { if (String(rawRows[i]?.[0] ?? "").trim().toUpperCase() === "ITEM") { hi = i; break } }
      const parsed = rawRows.slice(hi + 1).filter(r => r[0] !== "" && r[0] != null).map(r => ({ item_no: String(r[0]).trim() })).filter(r => r.item_no)
      setImportedRows(parsed)
      setImportFileName(file.name)
    }
    reader.readAsArrayBuffer(file)
    e.target.value = ""
  }

  function handleDownload() {
    if (!rows.length) return
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["ITEM"], ...rows.map(i => [i.item_no])]), "ITEM FOR PICK")
    XLSX.writeFile(wb, "ItemForPick.xlsx")
  }

  async function handleReplace() {
    if (!importedRows) return
    if (!confirm("Sei sicuro? Questa operazione sostituira i dati nella tabella ITEM for PICK.")) return
    setReplacing(true); setReplaceError(null)
    try {
      await itemsApi.replacePicking(importedRows)

      setImportedRows(null); setImportFileName(null); refresh()
    } catch (e) {
      setReplaceError(e.response?.data?.detail || e.message || "Errore")
    } finally { setReplacing(false) }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 gap-2 text-gray-400">
        <Loader2 size={16} className="animate-spin" aria-hidden="true" />
        <span className="text-sm">Caricamento ITEM for PICK...</span>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Toolbar globale */}
      <div className="flex items-center gap-3 flex-wrap justify-between">
        <div className="flex items-center gap-2 text-xs">
          <span className="text-gray-400 font-semibold uppercase text-[9px] tracking-wider">Item for Pick</span>
          <span className="text-gray-700 font-semibold tabular-nums">{rows.length.toLocaleString("it-IT")}</span>
        </div>
        <div className="flex items-center gap-2">
          {rows.length > 0 && (
            <button onClick={handleDownload} className="flex items-center gap-2 border border-[#1e3a5f] text-[#1e3a5f] hover:bg-[#1e3a5f] hover:text-white font-semibold py-2 px-5 rounded-xl transition text-sm">
              <Download size={15} aria-hidden="true" /> Download
            </button>
          )}
          <input ref={importRef} type="file" accept=".xlsx,.xlsm,.xls" onChange={handleImportFile} className="hidden" />
          <button onClick={() => importRef.current?.click()} className="flex items-center gap-2 border border-gray-300 text-gray-600 hover:bg-gray-50 font-semibold py-2 px-5 rounded-xl transition text-sm">
            <Upload size={15} aria-hidden="true" /> Importa da lista Excel
          </button>
          <button onClick={handleReplace} disabled={!importedRows || replacing}
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
          <span className="text-blue-500">— {(importedRows || []).length} righe</span>
          <button onClick={() => { setImportedRows(null); setImportFileName(null) }} className="ml-auto text-blue-400 hover:text-blue-600" aria-label="Annulla importazione"><X size={14} aria-hidden="true" /></button>
        </div>
      )}

      {replaceError && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2">
          <AlertCircle size={13} className="shrink-0 mt-0.5" aria-hidden="true" /><span>{replaceError}</span>
        </div>
      )}

      {/* Toolbar tabella */}
      <div className="flex items-center gap-1.5">
        <span className="text-sm font-bold text-gray-700">ITEM for PICK</span>
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

      {/* Search */}
      <div className="relative">
        <label htmlFor="picking-search" className="sr-only">Cerca item picking</label>
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
        <input id="picking-search" type="text" placeholder="Cerca..." value={search} onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-8 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2563eb] focus:border-transparent outline-none transition" />
        {search && <button onClick={() => setSearch("")} aria-label="Cancella" className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X size={14} aria-hidden="true" /></button>}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="max-h-[60vh] overflow-y-auto">
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
