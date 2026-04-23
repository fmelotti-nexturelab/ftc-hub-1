import { useState, useRef, useCallback, useMemo, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useAuthStore } from "@/store/authStore"
import {
  LogOut, UserCheck, X, CheckCircle, AlertCircle, AlertTriangle,
  User, Building2, Calendar, Mail, Hash, Search, Clock, PlayCircle, FileDown,
  Upload, XCircle, Info, ChevronRight, ChevronLeft, Columns, MailPlus, MailCheck, MailX, Send,
} from "lucide-react"
import { operatorCodeApi } from "@/api/ho/operatorCode"
import { getFolderHandle } from "@/utils/folderStorage"

const inputClass = "w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#2563eb] focus:border-transparent outline-none transition"
const labelClass = "block text-xs font-medium text-gray-600 mb-1"
const EMPTY_FORM = { last_name: "", first_name: "", store_number: "", start_date: "" }
const DOMAIN_DISPLAY = "@flyingtigeritalia.com"

// ── Riga dettaglio modal ──────────────────────────────────────────────────────
function DetailRow({ icon, label, value }) {
  return (
    <div className="flex items-start gap-3 py-2 border-b border-gray-100 last:border-0">
      <span className="text-gray-400 mt-0.5 shrink-0">{icon}</span>
      <div>
        <div className="text-xs text-gray-400 mb-0.5">{label}</div>
        <div className="text-sm font-medium text-gray-700">{value || "—"}</div>
      </div>
    </div>
  )
}

// ── Modal codice già esistente ────────────────────────────────────────────────
function ExistingCodeModal({ code, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      role="button" tabIndex={0} aria-label="Chiudi" onClick={onClose}
      onKeyDown={e => e.key === "Escape" && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between p-5 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
              <AlertCircle size={16} className="text-amber-600" aria-hidden="true" />
            </div>
            <div>
              <h2 className="font-bold text-gray-800 text-sm">Codice già esistente</h2>
              <p className="text-xs text-gray-400 mt-0.5">L'operatore è già presente nel sistema</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Chiudi" className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition">
            <X size={16} aria-hidden="true" />
          </button>
        </div>
        <div className="p-5 space-y-0">
          <DetailRow icon={<User size={14} />} label="Nome e Cognome" value={`${code.first_name || ""} ${code.last_name || ""}`.trim()} />
          <DetailRow icon={<Hash size={14} />} label="Codice operatore" value={code.code} />
          <DetailRow icon={<Mail size={14} />} label="Email operatore" value={code.email} />
          <DetailRow icon={<Building2 size={14} />} label="Negozio" value={code.store_number} />
          <DetailRow icon={<Calendar size={14} />} label="Data inizio" value={code.start_date ? new Date(code.start_date).toLocaleDateString("it-IT") : null} />
          <DetailRow icon={<User size={14} />} label="Richiedente originale" value={code.requester_name} />
          <DetailRow icon={<Calendar size={14} />} label="Data richiesta" value={code.requested_at ? new Date(code.requested_at).toLocaleDateString("it-IT") : null} />
          <DetailRow icon={<Calendar size={14} />} label="Data creazione codice" value={code.created_at ? new Date(code.created_at).toLocaleDateString("it-IT") : null} />
          <DetailRow icon={<User size={14} />} label="Creato da" value={code.creator_name} />
        </div>
        <div className="px-5 pb-5">
          <button onClick={onClose} className="w-full py-2 text-sm bg-[#1e3a5f] hover:bg-[#2563eb] text-white font-semibold rounded-xl shadow transition">
            Chiudi
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Modal richiesta già in attesa ─────────────────────────────────────────────
function PendingRequestModal({ request, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      role="button" tabIndex={0} aria-label="Chiudi" onClick={onClose}
      onKeyDown={e => e.key === "Escape" && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between p-5 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <Clock size={16} className="text-blue-600" aria-hidden="true" />
            </div>
            <div>
              <h2 className="font-bold text-gray-800 text-sm">Richiesta già in attesa</h2>
              <p className="text-xs text-gray-400 mt-0.5">L'operatore è già in coda di gestione</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Chiudi" className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition">
            <X size={16} aria-hidden="true" />
          </button>
        </div>
        <div className="p-5 space-y-0">
          <DetailRow icon={<User size={14} />} label="Nome e Cognome" value={`${request.first_name || ""} ${request.last_name || ""}`.trim()} />
          <DetailRow icon={<Building2 size={14} />} label="Negozio" value={request.store_number} />
          <DetailRow icon={<Calendar size={14} />} label="Data inizio" value={request.start_date ? new Date(request.start_date).toLocaleDateString("it-IT") : null} />
          <DetailRow icon={<User size={14} />} label="Richiesta da" value={request.requester_name} />
          <DetailRow icon={<Calendar size={14} />} label="Data richiesta" value={request.created_at ? new Date(request.created_at).toLocaleDateString("it-IT") : null} />
        </div>
        <div className="px-5 pb-5">
          <button onClick={onClose} className="w-full py-2 text-sm bg-[#1e3a5f] hover:bg-[#2563eb] text-white font-semibold rounded-xl shadow transition">
            Chiudi
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Modal conferma nomi simili ────────────────────────────────────────────────
function SimilarNamesModal({ candidates, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      role="button" tabIndex={0} aria-label="Chiudi" onClick={onCancel}
      onKeyDown={e => e.key === "Escape" && onCancel()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between p-5 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
              <AlertTriangle size={16} className="text-amber-600" aria-hidden="true" />
            </div>
            <div>
              <h2 className="font-bold text-gray-800 text-sm">Possibile duplicato</h2>
              <p className="text-xs text-gray-400 mt-0.5">Esistono operatori con lo stesso cognome</p>
            </div>
          </div>
          <button onClick={onCancel} aria-label="Chiudi" className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition">
            <X size={16} aria-hidden="true" />
          </button>
        </div>
        <div className="p-5">
          <p className="text-xs text-gray-500 mb-3">
            Prima di procedere, verifica che la persona non sia già presente nell'elenco:
          </p>
          <div className="border border-gray-200 rounded-lg overflow-hidden mb-4">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th scope="col" className="px-3 py-2 text-left font-semibold text-gray-600">Cognome</th>
                  <th scope="col" className="px-3 py-2 text-left font-semibold text-gray-600">Nome</th>
                  <th scope="col" className="px-3 py-2 text-left font-semibold text-gray-600">Negozio</th>
                  <th scope="col" className="px-3 py-2 text-left font-semibold text-gray-600">Data inizio</th>
                </tr>
              </thead>
              <tbody>
                {candidates.map((c, i) => (
                  <tr key={c.id} className={i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
                    <td className="px-3 py-2 font-medium text-gray-800">{c.last_name}</td>
                    <td className="px-3 py-2 text-gray-700">{c.first_name}</td>
                    <td className="px-3 py-2 text-gray-500 font-mono">{c.store_number}</td>
                    <td className="px-3 py-2 text-gray-500">{c.start_date ? new Date(c.start_date).toLocaleDateString("it-IT") : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-500 mb-4">
            Se si tratta di una persona diversa, conferma la creazione della richiesta.
          </p>
          <div className="flex gap-2">
            <button onClick={onCancel}
              className="flex-1 py-2 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition">
              Annulla
            </button>
            <button onClick={onConfirm}
              className="flex-1 py-2 text-sm bg-[#1e3a5f] hover:bg-[#2563eb] text-white font-semibold rounded-xl shadow transition">
              Crea comunque
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Tabella codici operatore ──────────────────────────────────────────────────
function OperatorCodesTable({ codes, pendingCodes = [], isLoading, search, onSearchChange }) {
  const [storeFilter, setStoreFilter] = useState("")

  const stores = useMemo(() => {
    const s = [...new Set(codes.map(c => c.store_number).filter(Boolean))].sort()
    return s
  }, [codes])

  const filtered = useMemo(() => {
    if (!search.trim() && !storeFilter) return []
    let list = codes
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(c =>
        (c.last_name || "").toLowerCase().includes(q) ||
        (c.first_name || "").toLowerCase().includes(q) ||
        (c.email || "").toLowerCase().includes(q)
      )
    }
    if (storeFilter) list = list.filter(c => c.store_number === storeFilter)
    return list
  }, [codes, search, storeFilter])

  const filteredPending = useMemo(() => {
    if (!search.trim()) return []
    const q = search.trim().toLowerCase()
    return pendingCodes.filter(c =>
      (c.last_name || "").toLowerCase().includes(q) ||
      (c.first_name || "").toLowerCase().includes(q)
    )
  }, [pendingCodes, search])

  const totalCount = filtered.length + filteredPending.length

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col min-h-0 flex-1">
      <div className="p-3 border-b border-gray-100 flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-36">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
          <label htmlFor="oc-table-search" className="sr-only">Cerca operatore</label>
          <input id="oc-table-search" type="text" placeholder="Cerca cognome, nome, email…"
            value={search} onChange={e => onSearchChange(e.target.value)}
            className="pl-7 pr-3 py-1.5 w-full border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-[#2563eb] focus:border-transparent outline-none transition" />
        </div>
        <div>
          <label htmlFor="oc-table-store" className="sr-only">Filtra per negozio</label>
          <select id="oc-table-store" value={storeFilter} onChange={e => setStoreFilter(e.target.value)}
            className="px-2 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-[#2563eb] outline-none transition bg-white">
            <option value="">Tutti i negozi</option>
            {stores.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <span className="ml-auto text-xs text-gray-400 self-center">
          {isLoading ? "Caricamento…" : `${totalCount} risultati`}
        </span>
      </div>
      <div className="overflow-auto flex-1">
        <table className="w-full text-xs">
          <thead className="sticky top-0 z-10">
            <tr className="bg-gray-50 border-b border-gray-200 text-gray-600 font-semibold">
              <th scope="col" className="px-3 py-2 text-left">Cognome</th>
              <th scope="col" className="px-3 py-2 text-left">Nome</th>
              <th scope="col" className="px-3 py-2 text-left">Negozio</th>
              <th scope="col" className="px-3 py-2 text-left">Data inizio</th>
              <th scope="col" className="px-3 py-2 text-left">Email</th>
              <th scope="col" className="px-3 py-2 text-left">Codice</th>
            </tr>
          </thead>
          <tbody>
            {filteredPending.map((c, i) => (
              <tr key={`pending-${c.id}`} className="border-b border-amber-100 bg-amber-50/60">
                <td className="px-3 py-1.5 font-medium text-gray-800">{c.last_name}</td>
                <td className="px-3 py-1.5 text-gray-700">{c.first_name}</td>
                <td className="px-3 py-1.5 font-mono text-gray-500">{c.store_number}</td>
                <td className="px-3 py-1.5 text-gray-500">
                  {c.start_date ? new Date(c.start_date).toLocaleDateString("it-IT") : "—"}
                </td>
                <td className="px-3 py-1.5 text-gray-400">—</td>
                <td className="px-3 py-1.5">
                  <span className="bg-amber-100 text-amber-700 font-semibold text-[10px] px-2 py-0.5 rounded">In attesa</span>
                </td>
              </tr>
            ))}
            {filtered.map((c, i) => (
              <tr key={c.id}
                className={`border-b border-gray-100 ${i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}`}>
                <td className="px-3 py-1.5 font-medium text-gray-800">{c.last_name}</td>
                <td className="px-3 py-1.5 text-gray-700">{c.first_name}</td>
                <td className="px-3 py-1.5 font-mono text-gray-500">{c.store_number}</td>
                <td className="px-3 py-1.5 text-gray-500">
                  {c.start_date ? new Date(c.start_date).toLocaleDateString("it-IT") : "—"}
                </td>
                <td className="px-3 py-1.5 text-gray-400">{c.email}</td>
                <td className="px-3 py-1.5 font-mono text-gray-500">{c.code || "—"}</td>
              </tr>
            ))}
            {!isLoading && totalCount === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-gray-400">
                  {!search.trim() && !storeFilter
                    ? "Digita un cognome per cercare tra gli operatori"
                    : "Nessun operatore trovato"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Parsing CSV ──────────────────────────────────────────────────────────────
const HEADER_MAP = {
  cognome: "last_name", nome: "first_name",
  negozio: "store_number", "data inizio": "start_date", datainizio: "start_date",
  last_name: "last_name", first_name: "first_name",
  store_number: "store_number", start_date: "start_date",
}

function parseItalianDate(s) {
  if (!s) return ""
  const p = s.split("/")
  if (p.length === 3) return `${p[2]}-${p[1].padStart(2, "0")}-${p[0].padStart(2, "0")}`
  return s
}

function parsePastedText(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  if (lines.length < 2) throw new Error("Dati insufficienti — servono almeno intestazione + una riga")
  const sep = lines[0].includes("\t") ? "\t" : ";"
  const rawHeaders = lines[0].split(sep).map(h => h.trim().toLowerCase().replace(/"/g, ""))
  const headers = rawHeaders.map(h => HEADER_MAP[h] || h)
  return lines.slice(1).map(line => {
    const vals = line.split(sep).map(v => v.trim().replace(/^"|"$/g, ""))
    const row = {}
    headers.forEach((h, i) => { row[h] = vals[i] || "" })
    if (row.last_name) row.last_name = row.last_name[0].toUpperCase() + row.last_name.slice(1).toLowerCase()
    if (row.first_name) row.first_name = row.first_name[0].toUpperCase() + row.first_name.slice(1).toLowerCase()
    if (row.store_number) row.store_number = row.store_number.toUpperCase()
    if (row.start_date) row.start_date = parseItalianDate(row.start_date)
    return row
  }).filter(r => r.last_name || r.first_name)
}

// ── Area incolla dati ─────────────────────────────────────────────────────────
function PasteZone({ onRows, onError }) {
  const [hint, setHint] = useState(null)

  const handlePaste = (e) => {
    e.preventDefault()
    const text = e.clipboardData.getData("text")
    try {
      const rows = parsePastedText(text)
      setHint(`${rows.length} righe rilevate`)
      onRows(rows)
    } catch (err) {
      onError(err.message)
    }
  }

  return (
    <div className="mt-3">
      <textarea
        onPaste={handlePaste}
        readOnly
        placeholder="Incolla qui i dati copiati da Excel o CSV (Ctrl+V)…"
        aria-label="Area incolla dati operatori"
        className="w-full h-16 px-3 py-2.5 border-2 border-dashed border-gray-200 rounded-xl text-xs text-gray-400 placeholder-gray-300 bg-gray-50 focus:border-[#2563eb] focus:outline-none resize-none transition cursor-pointer"
      />
      {hint && <p className="text-[10px] text-[#2563eb] mt-1 text-center">{hint}</p>}
    </div>
  )
}

// ── Tabella risultati import massivo ──────────────────────────────────────────
function BulkResultsTable({ rows, results, onReset, onImport, isImporting }) {
  const inserted = results?.filter(r => r.status === "inserted").length ?? 0
  const errors = results?.filter(r => r.status !== "inserted").length ?? 0

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col min-h-0 flex-1">
      <div className="p-3 border-b border-gray-100 flex items-center gap-3 flex-wrap">
        <span className="text-xs font-semibold text-gray-700">{rows.length} righe caricate</span>
        {results ? (
          <>
            <span className="text-xs font-semibold text-green-600">{inserted} inserite</span>
            {errors > 0 && <span className="text-xs font-semibold text-red-600">{errors} con problemi</span>}
          </>
        ) : (
          <button
            onClick={onImport}
            disabled={isImporting}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1e3a5f] hover:bg-[#2563eb] text-white text-xs font-semibold rounded-lg shadow transition disabled:opacity-40"
          >
            <Upload size={12} aria-hidden="true" />
            {isImporting ? "Importazione…" : `Importa ${rows.length} righe`}
          </button>
        )}
        <button onClick={onReset} aria-label="Annulla import" className="ml-auto flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition">
          <X size={12} aria-hidden="true" /> Annulla
        </button>
      </div>
      <div className="overflow-auto flex-1">
        <table className="w-full text-xs">
          <thead className="sticky top-0 z-10">
            <tr className="bg-gray-50 border-b border-gray-200 text-gray-600 font-semibold">
              <th scope="col" className="px-3 py-2 text-left">Cognome</th>
              <th scope="col" className="px-3 py-2 text-left">Nome</th>
              <th scope="col" className="px-3 py-2 text-left">Negozio</th>
              <th scope="col" className="px-3 py-2 text-left">Data inizio</th>
              <th scope="col" className="px-3 py-2 text-left">Esito</th>
              <th scope="col" className="px-3 py-2 text-left">Note</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const res = results?.[i]
              return (
                <tr key={i} className={`border-b border-gray-100 ${i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}`}>
                  <td className="px-3 py-1.5 font-medium text-gray-800">{row.last_name}</td>
                  <td className="px-3 py-1.5 text-gray-700">{row.first_name}</td>
                  <td className="px-3 py-1.5 font-mono text-gray-500">{row.store_number}</td>
                  <td className="px-3 py-1.5 text-gray-500">
                    {row.start_date ? new Date(row.start_date).toLocaleDateString("it-IT") : "—"}
                  </td>
                  <td className="px-3 py-1.5">
                    {!res && <span className="text-gray-300">—</span>}
                    {res?.status === "inserted" && (
                      <span className="flex items-center gap-1 text-green-600 font-semibold">
                        <CheckCircle size={13} aria-hidden="true" /> OK
                      </span>
                    )}
                    {(res?.status === "exists" || res?.status === "pending" || res?.status === "error") && (
                      <span className="flex items-center gap-1 text-red-600 font-semibold">
                        <XCircle size={13} aria-hidden="true" /> KO
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-1.5 text-gray-500">{res?.note || "—"}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Wizard import per colonne ─────────────────────────────────────────────────
const WIZARD_STEPS = [
  { key: "last_names",    label: "Cognomi",         hint: "Incolla i cognomi — uno per riga" },
  { key: "first_names",   label: "Nomi",            hint: "Incolla i nomi — uno per riga (stessa sequenza)" },
  { key: "store_numbers", label: "Negozi",          hint: "Incolla i codici negozio — uno per riga (es. IT01055)" },
  { key: "start_dates",   label: "Date di inizio",  hint: "Incolla le date — uno per riga (gg/mm/aaaa o aaaa-mm-gg)" },
]

function parseLines(text) {
  return text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
}

function ColumnImportWizard({ onImport, isImporting, onClose }) {
  const [step, setStep] = useState(0)
  const [data, setData] = useState({ last_names: [], first_names: [], store_numbers: [], start_dates: [] })
  const [input, setInput] = useState("")
  const [error, setError] = useState(null)
  const textareaRef = useRef(null)

  useEffect(() => {
    setTimeout(() => textareaRef.current?.focus(), 80)
  }, [step])

  const current = WIZARD_STEPS[step]
  const expectedCount = data.last_names.length

  function handleNext() {
    const lines = parseLines(input)
    if (lines.length === 0) {
      setError("Incolla almeno una riga prima di continuare")
      return
    }
    if (step > 0 && lines.length !== expectedCount) {
      setError(`Hai incollato ${lines.length} righe ma i cognomi erano ${expectedCount} — le sequenze devono corrispondere`)
      return
    }
    setData(d => ({ ...d, [current.key]: lines }))
    setError(null)
    setInput("")
    setStep(s => s + 1)
  }

  function handleBack() {
    setError(null)
    setInput("")
    setStep(s => s - 1)
  }

  function handleImport() {
    // Costruisce le righe e converte le date
    const rows = data.last_names.map((ln, i) => {
      let sd = data.start_dates[i] || ""
      // Converte dd/mm/yyyy → yyyy-mm-dd
      const p = sd.split("/")
      if (p.length === 3) sd = `${p[2]}-${p[1].padStart(2,"0")}-${p[0].padStart(2,"0")}`
      const sn = (data.store_numbers[i] || "").toUpperCase()
      return {
        last_name:    ln[0].toUpperCase() + ln.slice(1).toLowerCase(),
        first_name:   (data.first_names[i] || "")[0]?.toUpperCase() + (data.first_names[i] || "").slice(1).toLowerCase(),
        store_number: sn,
        start_date:   sd,
      }
    })
    onImport(rows)
  }

  // Righe preview costruite con i dati finora
  const previewRows = data.last_names.map((ln, i) => ({
    last_name:    ln,
    first_name:   data.first_names[i] ?? null,
    store_number: data.store_numbers[i] ?? null,
    start_date:   data.start_dates[i] ?? null,
  }))

  const isLastStep = step === WIZARD_STEPS.length - 1
  const isDone = step === WIZARD_STEPS.length

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={onClose} onKeyDown={e => e.key === "Escape" && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-[#1e3a5f]/10 rounded-lg flex items-center justify-center">
              <Columns size={15} className="text-[#1e3a5f]" aria-hidden="true" />
            </div>
            <div>
              <h2 className="font-bold text-gray-800 text-sm">Importa per colonne</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                {isDone ? "Anteprima completata — pronto per l'importazione" : `Step ${step + 1} di ${WIZARD_STEPS.length}`}
              </p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Chiudi" className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition">
            <X size={15} aria-hidden="true" />
          </button>
        </div>

        {/* Step indicators */}
        <div className="flex gap-1 px-6 pt-4 shrink-0">
          {WIZARD_STEPS.map((s, i) => (
            <div key={s.key} className="flex items-center gap-1 flex-1">
              <div className={`flex items-center gap-1.5 flex-1 ${i < step || isDone ? "opacity-100" : i === step ? "opacity-100" : "opacity-30"}`}>
                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0
                  ${i < step || isDone ? "bg-green-500 text-white" : i === step ? "bg-[#1e3a5f] text-white" : "bg-gray-200 text-gray-500"}`}>
                  {i < step || isDone ? <CheckCircle size={12} aria-hidden="true" /> : i + 1}
                </div>
                <span className="text-[11px] font-medium text-gray-600 truncate">{s.label}</span>
              </div>
              {i < WIZARD_STEPS.length - 1 && <div className="w-4 h-px bg-gray-200 shrink-0" />}
            </div>
          ))}
        </div>

        <div className="flex gap-5 p-6 overflow-hidden flex-1 min-h-0">
          {/* Sinistra: input */}
          {!isDone && (
            <div className="w-64 shrink-0 flex flex-col gap-3">
              <div>
                <p className="text-xs font-semibold text-gray-700 mb-1">{current.label}</p>
                <p className="text-[11px] text-gray-400 mb-2">{current.hint}</p>
                <label htmlFor="wizard-paste" className="sr-only">{current.label}</label>
                <textarea
                  id="wizard-paste"
                  ref={textareaRef}
                  value={input}
                  onChange={e => { setInput(e.target.value); setError(null) }}
                  placeholder={`Es:\n${step === 0 ? "Rossi\nBianchi\nVerdi" : step === 1 ? "Mario\nGianni\nLuca" : step === 2 ? "IT01055\nIT02010\nIT03003" : "01/05/2026\n15/05/2026\n20/05/2026"}`}
                  rows={10}
                  className="w-full px-3 py-2.5 border-2 border-dashed border-gray-200 rounded-xl text-xs font-mono focus:border-[#2563eb] focus:outline-none resize-none transition bg-gray-50"
                />
              </div>
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 flex items-start gap-2 text-xs text-red-700">
                  <AlertCircle size={13} className="shrink-0 mt-0.5" aria-hidden="true" /> {error}
                </div>
              )}
              <div className="flex gap-2 mt-auto">
                {step > 0 && (
                  <button onClick={handleBack}
                    className="flex items-center gap-1 px-3 py-2 text-xs text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition">
                    <ChevronLeft size={13} aria-hidden="true" /> Indietro
                  </button>
                )}
                <button onClick={handleNext}
                  className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-[#1e3a5f] hover:bg-[#2563eb] text-white text-xs font-semibold rounded-lg shadow transition focus-visible:ring-2 focus-visible:ring-[#2563eb]">
                  {isLastStep ? "Conferma" : "Avanti"} <ChevronRight size={13} aria-hidden="true" />
                </button>
              </div>
            </div>
          )}

          {/* Destra: tabella preview */}
          <div className="flex-1 min-w-0 overflow-auto">
            {previewRows.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-gray-400">
                La tabella si riempirà man mano che incolli i dati
              </div>
            ) : (
              <table className="w-full text-xs">
                <thead className="sticky top-0">
                  <tr className="bg-gray-50 border-b border-gray-200 text-gray-600 font-semibold">
                    <th scope="col" className="px-3 py-2 text-left">#</th>
                    <th scope="col" className="px-3 py-2 text-left">Cognome</th>
                    <th scope="col" className="px-3 py-2 text-left">Nome</th>
                    <th scope="col" className="px-3 py-2 text-left">Negozio</th>
                    <th scope="col" className="px-3 py-2 text-left">Data inizio</th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, i) => (
                    <tr key={i} className={`border-b border-gray-100 ${i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}`}>
                      <td className="px-3 py-1.5 text-gray-400">{i + 1}</td>
                      <td className="px-3 py-1.5 font-medium text-gray-800">{row.last_name}</td>
                      <td className={`px-3 py-1.5 ${row.first_name ? "text-gray-700" : "text-gray-200"}`}>
                        {row.first_name ?? "—"}
                      </td>
                      <td className={`px-3 py-1.5 font-mono ${row.store_number ? "text-gray-500" : "text-gray-200"}`}>
                        {row.store_number ?? "—"}
                      </td>
                      <td className={`px-3 py-1.5 ${row.start_date ? "text-gray-500" : "text-gray-200"}`}>
                        {row.start_date ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Footer import (solo step finale) */}
        {isDone && (
          <div className="px-6 pb-5 shrink-0 flex items-center justify-between border-t border-gray-100 pt-4">
            <span className="text-xs text-gray-500">{previewRows.length} righe pronte per l'importazione</span>
            <div className="flex gap-2">
              <button onClick={() => { setStep(3); setInput("") }}
                className="flex items-center gap-1 px-3 py-2 text-xs text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition">
                <ChevronLeft size={13} aria-hidden="true" /> Modifica
              </button>
              <button onClick={handleImport} disabled={isImporting}
                className="flex items-center gap-1.5 px-4 py-2 bg-[#1e3a5f] hover:bg-[#2563eb] text-white text-xs font-semibold rounded-lg shadow transition disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-[#2563eb]">
                <Upload size={13} aria-hidden="true" />
                {isImporting ? "Importazione…" : `Importa ${previewRows.length} righe`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Vista HR/Visualizza: form richiesta ───────────────────────────────────────
function RichiestView({ user }) {
  const today = new Date().toLocaleDateString("it-IT")
  const [form, setForm] = useState(EMPTY_FORM)
  const [success, setSuccess] = useState(false)
  const [existingCode, setExistingCode] = useState(null)
  const [pendingRequest, setPendingRequest] = useState(null)
  const [similarCandidates, setSimilarCandidates] = useState(null)
  const [csvRows, setCsvRows] = useState(null)
  const [csvResults, setCsvResults] = useState(null)
  const [csvError, setCsvError] = useState(null)
  const [wizardOpen, setWizardOpen] = useState(false)
  const cognomeRef = useRef(null)

  const bulkMutation = useMutation({
    mutationFn: (rows) => operatorCodeApi.bulkRequest(rows),
    onSuccess: (res) => setCsvResults(res.data.results),
  })

  const { data: codes = [], isLoading: codesLoading } = useQuery({
    queryKey: ["operator-codes"],
    queryFn: () => operatorCodeApi.list().then(r => r.data),
  })

  const { data: pendingData } = useQuery({
    queryKey: ["operator-code-requests-all"],
    queryFn: () => operatorCodeApi.listRequests().then(r => r.data.items ?? []),
    refetchInterval: 30_000,
  })

  const resetAndFocus = useCallback(() => {
    setForm(EMPTY_FORM)
    setTimeout(() => cognomeRef.current?.focus(), 50)
  }, [])

  const doRequest = useCallback((force = false) => {
    return operatorCodeApi.request({
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      store_number: form.store_number.trim().toUpperCase(),
      start_date: form.start_date,
      force,
    })
  }, [form])

  const mutation = useMutation({
    mutationFn: () => doRequest(false),
    onSuccess: (res) => {
      const { found, pending, code, pending_request, similar } = res.data
      if (found) {
        setExistingCode(code)
        resetAndFocus()
      } else if (pending) {
        setPendingRequest(pending_request)
        resetAndFocus()
      } else if (similar?.length > 0) {
        setSimilarCandidates(similar)
      } else {
        setSuccess(true)
        setTimeout(() => setSuccess(false), 1500)
        resetAndFocus()
      }
    },
    onError: () => resetAndFocus(),
  })

  const forceMutation = useMutation({
    mutationFn: () => doRequest(true),
    onSuccess: () => {
      setSimilarCandidates(null)
      setSuccess(true)
      setTimeout(() => setSuccess(false), 2000)
      resetAndFocus()
    },
    onError: () => {
      setSimilarCandidates(null)
      resetAndFocus()
    },
  })

  const set = k => e => {
    let v = e.target.value
    if (k === "last_name" || k === "first_name")
      v = v.length > 0 ? v[0].toUpperCase() + v.slice(1).toLowerCase() : v
    if (k === "store_number")
      v = v.toUpperCase()
    setForm(f => ({ ...f, [k]: v }))
  }
  const isValid = form.last_name.trim() && form.first_name.trim() && form.store_number.trim() && form.start_date
  const error = mutation.error?.response?.data?.detail || forceMutation.error?.response?.data?.detail

  return (
    <>
      {success && (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div className="flex items-center gap-2 bg-green-500 text-white text-sm font-semibold px-6 py-4 rounded-xl shadow-2xl">
            <CheckCircle size={18} aria-hidden="true" />
            Richiesta inviata con successo
          </div>
        </div>
      )}
      {existingCode && <ExistingCodeModal code={existingCode} onClose={() => setExistingCode(null)} />}
      {pendingRequest && <PendingRequestModal request={pendingRequest} onClose={() => setPendingRequest(null)} />}
      {wizardOpen && (
        <ColumnImportWizard
          onClose={() => setWizardOpen(false)}
          isImporting={bulkMutation.isPending}
          onImport={rows => {
            setCsvRows(rows)
            setCsvResults(null)
            setWizardOpen(false)
            bulkMutation.mutate(rows)
          }}
        />
      )}
      {similarCandidates && (
        <SimilarNamesModal
          candidates={similarCandidates}
          onConfirm={() => forceMutation.mutate()}
          onCancel={() => { setSimilarCandidates(null); resetAndFocus() }}
        />
      )}

      <div className="flex gap-5 items-start min-h-0">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 w-80 shrink-0">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Nuova richiesta</h2>

          <div className="grid grid-cols-2 gap-3 mb-4 p-3 bg-gray-50 rounded-lg border border-gray-100">
            <div>
              <div className={labelClass}>Data richiesta</div>
              <div className="text-sm text-gray-700 font-medium">{today}</div>
            </div>
            <div>
              <div className={labelClass}>Richiedente</div>
              <div className="text-sm text-gray-700 font-medium truncate">{user?.full_name || user?.username}</div>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label htmlFor="oc-cognome" className={labelClass}>Cognome *</label>
              <input ref={cognomeRef} id="oc-cognome" type="text" value={form.last_name}
                onChange={set("last_name")} className={inputClass} placeholder="Cognome" />
            </div>
            <div>
              <label htmlFor="oc-nome" className={labelClass}>Nome *</label>
              <input id="oc-nome" type="text" value={form.first_name}
                onChange={set("first_name")} className={inputClass} placeholder="Nome" />
            </div>
            <div>
              <label htmlFor="oc-store" className={labelClass}>Negozio di destinazione *</label>
              <input id="oc-store" type="text" value={form.store_number}
                onChange={set("store_number")} className={inputClass} placeholder="Es. IT01055" />
            </div>
            <div>
              <label htmlFor="oc-start" className={labelClass}>Data inizio *</label>
              <input id="oc-start" type="date" value={form.start_date}
                onChange={set("start_date")} className={inputClass} />
            </div>
          </div>

          {error && (
            <div className="mt-3 bg-red-50 border border-red-200 rounded-lg px-3 py-2 flex items-center gap-2 text-xs text-red-700">
              <AlertCircle size={13} aria-hidden="true" />
              {error}
            </div>
          )}

          <button
            onClick={() => { setSuccess(false); setExistingCode(null); setPendingRequest(null); setSimilarCandidates(null); mutation.mutate() }}
            disabled={!isValid || mutation.isPending || forceMutation.isPending}
            className="mt-4 w-full py-2.5 bg-[#1e3a5f] hover:bg-[#2563eb] text-white text-sm font-semibold rounded-xl shadow transition disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-[#2563eb]"
          >
            {mutation.isPending ? "Verifica in corso…" : "Richiedi Codice Operatore"}
          </button>

          <button
            onClick={() => setWizardOpen(true)}
            className="mt-2 w-full py-2 flex items-center justify-center gap-1.5 text-xs text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50 hover:text-gray-700 transition focus-visible:ring-2 focus-visible:ring-[#2563eb]"
          >
            <Columns size={13} aria-hidden="true" />
            Importa per colonne
          </button>

          {csvError && (
            <div className="mt-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 flex items-center gap-2 text-xs text-red-700">
              <AlertCircle size={13} aria-hidden="true" /> {csvError}
            </div>
          )}
          <PasteZone
            onRows={rows => { setCsvRows(rows); setCsvResults(null); setCsvError(null) }}
            onError={msg => { setCsvError(msg); setCsvRows(null) }}
          />
        </div>

        <div className="flex-1 min-w-0" style={{ height: "calc(100vh - 180px)" }}>
          {csvRows ? (
            <BulkResultsTable
              rows={csvRows}
              results={csvResults}
              isImporting={bulkMutation.isPending}
              onImport={() => bulkMutation.mutate(csvRows)}
              onReset={() => { setCsvRows(null); setCsvResults(null); setCsvError(null) }}
            />
          ) : (
            <OperatorCodesTable
              codes={codes}
              pendingCodes={pendingData ?? []}
              isLoading={codesLoading}
              search={form.last_name}
              onSearchChange={v => setForm(f => ({ ...f, last_name: v }))}
            />
          )}
        </div>
      </div>
    </>
  )
}

// ── Modal installazione Tampermonkey ─────────────────────────────────────────
function ArubaTmModal({ pendingCount, onClose, onGo }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      role="button" tabIndex={0} aria-label="Chiudi" onClick={onClose}
      onKeyDown={e => e.key === "Escape" && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between p-5 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-violet-100 rounded-lg flex items-center justify-center">
              <MailPlus size={16} className="text-violet-600" aria-hidden="true" />
            </div>
            <div>
              <h2 className="font-bold text-gray-800 text-sm">Genera Casella Mail</h2>
              <p className="text-xs text-gray-400 mt-0.5">Automazione tramite Tampermonkey</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Chiudi"
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition">
            <X size={16} aria-hidden="true" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-xs text-gray-600">
            Lo script compila automaticamente il form Aruba per ogni casella in coda
            (profilo + antispam). La password va inserita manualmente per ciascuna.
          </p>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <span className="w-5 h-5 rounded-full bg-[#1e3a5f] text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">1</span>
              <div>
                <p className="text-xs font-semibold text-gray-700">Installa Tampermonkey</p>
                <p className="text-xs text-gray-400 mb-1">Estensione browser (Chrome, Firefox, Edge) — da fare una volta sola</p>
                <a href="https://www.tampermonkey.net/" target="_blank" rel="noreferrer"
                  className="text-xs text-[#2563eb] hover:underline">tampermonkey.net →</a>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="w-5 h-5 rounded-full bg-[#1e3a5f] text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">2</span>
              <div>
                <p className="text-xs font-semibold text-gray-700">Installa lo script FTC HUB</p>
                <p className="text-xs text-gray-400 mb-1">Da fare una volta sola — Tampermonkey chiederà conferma automaticamente</p>
                <a href="/aruba-autocompile.user.js" target="_blank" rel="noreferrer"
                  className="text-xs text-[#2563eb] hover:underline">Installa script →</a>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="w-5 h-5 rounded-full bg-violet-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">3</span>
              <div>
                <p className="text-xs font-semibold text-gray-700">Avvia la compilazione automatica</p>
                <p className="text-xs text-gray-400">Lo script si attiva su Aruba e compila un form alla volta. Un pannello blu ti guiderà per ogni casella.</p>
              </div>
            </div>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-start gap-2">
            <AlertCircle size={13} className="text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
            <p className="text-xs text-amber-700">
              Se hai già installato lo script in precedenza, clicca direttamente <strong>Vai ad Aruba</strong>.
            </p>
          </div>
        </div>
        <div className="px-5 pb-5 flex gap-2">
          <button onClick={onClose}
            className="flex-1 py-2 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition">
            Annulla
          </button>
          <button onClick={onGo}
            className="flex-1 py-2.5 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold rounded-xl shadow transition focus-visible:ring-2 focus-visible:ring-violet-500 flex items-center justify-center gap-2">
            <MailPlus size={15} aria-hidden="true" />
            Vai ad Aruba ({pendingCount})
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Modal anteprima email ─────────────────────────────────────────────────────
function EmailPreviewModal({ results, onClose, onConfirm, isSending }) {
  const [selected, setSelected] = useState(0)
  const current = results[selected]

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onKeyDown={e => e.key === "Escape" && onClose()} role="dialog" aria-modal="true" aria-label="Anteprima email">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
              <Mail size={15} className="text-amber-600" aria-hidden="true" />
            </div>
            <div>
              <h2 className="font-bold text-gray-800 text-sm">Anteprima email — {results.length} operatori</h2>
              <p className="text-xs text-gray-400 mt-0.5">Verifica il contenuto prima di spedire</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Chiudi" className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition">
            <X size={15} aria-hidden="true" />
          </button>
        </div>

        <div className="flex flex-1 min-h-0">
          {/* Lista operatori a sinistra */}
          <div className="w-56 shrink-0 border-r border-gray-100 overflow-y-auto">
            {results.map((r, i) => (
              <button
                key={r.request_id}
                onClick={() => setSelected(i)}
                className={`w-full text-left px-4 py-3 border-b border-gray-50 transition ${i === selected ? "bg-blue-50 border-l-2 border-l-blue-500" : "hover:bg-gray-50"}`}
              >
                <div className="text-xs font-semibold text-gray-800 truncate">{r.last_name} {r.first_name}</div>
                <div className="text-[10px] font-mono text-gray-400 mt-0.5">{r.store_number}</div>
                <div className="flex gap-1 mt-1">
                  {r.sm_mail
                    ? <span className="text-[9px] bg-green-100 text-green-700 px-1 rounded">SM ✓</span>
                    : <span className="text-[9px] bg-gray-100 text-gray-400 px-1 rounded">SM —</span>
                  }
                  {r.dm_mail
                    ? <span className="text-[9px] bg-green-100 text-green-700 px-1 rounded">DM ✓</span>
                    : <span className="text-[9px] bg-gray-100 text-gray-400 px-1 rounded">DM —</span>
                  }
                </div>
              </button>
            ))}
          </div>

          {/* Anteprima HTML a destra */}
          <div className="flex-1 min-w-0 flex flex-col">
            <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 shrink-0 flex items-center gap-4 text-xs text-gray-500">
              <span><strong>A:</strong> {[current.sm_mail, current.dm_mail].filter(Boolean).join(", ") || "Nessun destinatario"}</span>
              <span><strong>Oggetto:</strong> [FTC HUB] Nuovo operatore assegnato — {current.store_number}</span>
            </div>
            {current.html_preview ? (
              <iframe
                srcDoc={current.html_preview}
                title="Anteprima email"
                className="flex-1 w-full border-0"
                sandbox="allow-same-origin"
              />
            ) : (
              <div className="flex-1 flex items-center justify-center text-xs text-red-500">
                {current.error || "Nessuna anteprima disponibile"}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 shrink-0 flex items-center justify-between">
          <p className="text-xs text-gray-400">
            Le email verranno inviate a SM e DM di ogni negozio
          </p>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition">
              Annulla
            </button>
            <button
              onClick={onConfirm}
              disabled={isSending}
              className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl shadow transition disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <Send size={14} aria-hidden="true" />
              {isSending ? "Invio in corso…" : `Conferma e invia (${results.length})`}
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}

// ── Modal risultati bulk evadi ────────────────────────────────────────────────
function BulkEvadiResultModal({ results, ok, errors, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={onClose} onKeyDown={e => e.key === "Escape" && onClose()} role="button" tabIndex={0} aria-label="Chiudi">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
              <CheckCircle size={15} className="text-green-600" aria-hidden="true" />
            </div>
            <div>
              <h2 className="font-bold text-gray-800 text-sm">Riepilogo evasione massiva</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                <span className="text-green-600 font-semibold">{ok} evase</span>
                {errors > 0 && <span className="text-red-500 font-semibold ml-2">{errors} errori</span>}
              </p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Chiudi" className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition">
            <X size={15} aria-hidden="true" />
          </button>
        </div>
        <div className="overflow-auto flex-1">
          <table className="w-full text-xs">
            <thead className="sticky top-0">
              <tr className="bg-gray-50 border-b border-gray-200 text-gray-600 font-semibold">
                <th scope="col" className="px-4 py-3 text-left">Negozio</th>
                <th scope="col" className="px-4 py-3 text-left">Operatore</th>
                <th scope="col" className="px-4 py-3 text-left">Codice</th>
                <th scope="col" className="px-4 py-3 text-left">PWD</th>
                <th scope="col" className="px-4 py-3 text-left">Email</th>
                <th scope="col" className="px-4 py-3 text-left">Esito</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r, i) => (
                <tr key={r.id} className={`border-b border-gray-100 ${i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}`}>
                  <td className="px-4 py-2.5 font-mono text-gray-500">{r.store_number}</td>
                  <td className="px-4 py-2.5 font-medium text-gray-800">{r.last_name} {r.first_name}</td>
                  <td className="px-4 py-2.5 font-mono font-bold text-[#1e3a5f]">{r.assigned_code ?? "—"}</td>
                  <td className="px-4 py-2.5 font-mono font-bold text-amber-700">{r.assigned_password ?? "—"}</td>
                  <td className="px-4 py-2.5 font-mono text-gray-500 text-[11px]">
                    {r.assigned_email?.replace("@flyingtigeritalia.com", "") ?? "—"}
                    {r.assigned_email && <span className="text-gray-300">@flyingtigeritalia.com</span>}
                  </td>
                  <td className="px-4 py-2.5">
                    {r.status === "ok"
                      ? <span className="flex items-center gap-1 text-green-600 font-semibold"><CheckCircle size={12} aria-hidden="true" /> OK</span>
                      : <span className="flex items-center gap-1 text-red-500 font-semibold"><XCircle size={12} aria-hidden="true" /> {r.note}</span>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 shrink-0">
          <button onClick={onClose} className="w-full py-2 text-sm bg-[#1e3a5f] hover:bg-[#2563eb] text-white font-semibold rounded-xl shadow transition focus-visible:ring-2 focus-visible:ring-[#2563eb]">
            Chiudi
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Modal risultati invio mail ────────────────────────────────────────────────
function NotifyResultModal({ results, sent, skipped, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={onClose} onKeyDown={e => e.key === "Escape" && onClose()} role="button" tabIndex={0} aria-label="Chiudi">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <Mail size={15} className="text-blue-600" aria-hidden="true" />
            </div>
            <div>
              <h2 className="font-bold text-gray-800 text-sm">Riepilogo invio notifiche</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                <span className="text-green-600 font-semibold">{sent} inviate</span>
                {skipped > 0 && <span className="text-amber-600 font-semibold ml-2">{skipped} con problemi</span>}
              </p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Chiudi" className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition">
            <X size={15} aria-hidden="true" />
          </button>
        </div>
        <div className="overflow-auto flex-1">
          <table className="w-full text-xs">
            <thead className="sticky top-0">
              <tr className="bg-gray-50 border-b border-gray-200 text-gray-600 font-semibold">
                <th scope="col" className="px-4 py-3 text-left">Negozio</th>
                <th scope="col" className="px-4 py-3 text-left">Operatore</th>
                <th scope="col" className="px-4 py-3 text-left">SM</th>
                <th scope="col" className="px-4 py-3 text-left">DM</th>
                <th scope="col" className="px-4 py-3 text-left">Esito</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r, i) => (
                <tr key={r.request_id} className={`border-b border-gray-100 ${i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}`}>
                  <td className="px-4 py-2.5 font-mono text-gray-500">{r.store_number}</td>
                  <td className="px-4 py-2.5 font-medium text-gray-800">{r.last_name} {r.first_name}</td>
                  <td className="px-4 py-2.5">
                    {r.sm_mail ? (
                      r.sm_sent
                        ? <span className="flex items-center gap-1 text-green-600"><CheckCircle size={12} aria-hidden="true" />{r.sm_mail}</span>
                        : <span className="flex items-center gap-1 text-red-500"><XCircle size={12} aria-hidden="true" />{r.sm_mail}</span>
                    ) : (
                      <span className="text-gray-300">no email</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    {r.dm_mail ? (
                      r.dm_sent
                        ? <span className="flex items-center gap-1 text-green-600"><CheckCircle size={12} aria-hidden="true" />{r.dm_mail}</span>
                        : <span className="flex items-center gap-1 text-red-500"><XCircle size={12} aria-hidden="true" />{r.dm_mail}</span>
                    ) : (
                      <span className="text-gray-300">no email</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    {r.error
                      ? <span className="text-red-600 font-semibold">{r.error}</span>
                      : (r.sm_sent || r.dm_sent)
                        ? <span className="text-green-600 font-semibold">✓ Inviata</span>
                        : <span className="text-amber-600 font-semibold">⚠ Nessun destinatario</span>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 shrink-0">
          <button onClick={onClose} className="w-full py-2 text-sm bg-[#1e3a5f] hover:bg-[#2563eb] text-white font-semibold rounded-xl shadow transition focus-visible:ring-2 focus-visible:ring-[#2563eb]">
            Chiudi
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Vista IT/Admin: gestione richieste ────────────────────────────────────────
function GestioneView() {
  const queryClient = useQueryClient()
  const [emailMap, setEmailMap] = useState({})
  const [generatedFiles, setGeneratedFiles] = useState([])
  const [showArubaTm, setShowArubaTm] = useState(false)
  const [sentMailboxIds, setSentMailboxIds] = useState(new Set())
  const [mailboxResults, setMailboxResults] = useState({}) // { [requestId]: 'created'|'exists'|'error'|'unknown' }
  const [notifyResult, setNotifyResult] = useState(null)
  const [bulkEvadiResult, setBulkEvadiResult] = useState(null)
  const [emailSendEnabled, setEmailSendEnabled] = useState(false)
  const [emailPreview, setEmailPreview] = useState(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const aruba = params.get('aruba')
    if (!aruba) return
    try {
      const results = JSON.parse(decodeURIComponent(escape(atob(aruba))))
      const map = {}
      results.forEach(r => { if (r.id) map[r.id] = r.status })
      setMailboxResults(map)
    } catch {}
    params.delete('aruba')
    const qs = params.toString()
    window.history.replaceState({}, '', window.location.pathname + (qs ? '?' + qs : ''))
  }, [])

  const { data, isLoading } = useQuery({
    queryKey: ["operator-code-requests"],
    queryFn: () => operatorCodeApi.listRequests().then(r => r.data),
    refetchInterval: 30_000,
  })

  const items = data?.items ?? []
  const ticketStatus = data?.ticket_status ?? null
  const isInProgress = ticketStatus === "in_progress"
  const pending = items.filter(r => !r.is_evaded)
  const evaded = items.filter(r => r.is_evaded)

  useEffect(() => {
    if (!items.length) return
    setEmailMap(prev => {
      const next = { ...prev }
      items.forEach(req => {
        if (!(req.id in next) && req.suggested_email) {
          next[req.id] = req.suggested_email
        }
      })
      return next
    })
  }, [data])

  const takeOverMutation = useMutation({
    mutationFn: () => operatorCodeApi.takeOver(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["operator-code-requests"] })
      queryClient.invalidateQueries({ queryKey: ["sidebar-opcode-badge"] })
    },
  })

  const evadiMutation = useMutation({
    mutationFn: ({ id, email }) => operatorCodeApi.evadiRequest(id, email),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["operator-code-requests"] })
      queryClient.invalidateQueries({ queryKey: ["sidebar-opcode-badge"] })
    },
  })

  const bulkEvadiMutation = useMutation({
    mutationFn: (rows) => operatorCodeApi.bulkEvadi(rows),
    onSuccess: (res) => {
      setBulkEvadiResult(res.data)
      queryClient.invalidateQueries({ queryKey: ["operator-code-requests"] })
      queryClient.invalidateQueries({ queryKey: ["sidebar-opcode-badge"] })
    },
  })

  const notifyMutation = useMutation({
    mutationFn: (preview) => operatorCodeApi.notifyOperators(preview),
    onSuccess: (res, preview) => {
      if (preview) {
        setEmailPreview(res.data)
      } else {
        setEmailPreview(null)
        setNotifyResult(res.data)
        queryClient.invalidateQueries({ queryKey: ["operator-code-requests"] })
      }
    },
  })

  const generateMutation = useMutation({
    mutationFn: async () => {
      // 1. Verifica cartella configurata
      const folderHandle = await getFolderHandle("onedrive_folder_it")
      if (!folderHandle) {
        throw new Error('Cartella "One Italy IT - Files" non collegata. Configurala in Impostazioni.')
      }
      const perm = await folderHandle.requestPermission({ mode: "readwrite" })
      if (perm !== "granted") {
        throw new Error("Permesso negato per la cartella. Riprova.")
      }

      // 2. Genera i file dal backend (ritorna base64)
      const res = await operatorCodeApi.generateNavFiles()
      const files = res.data.files ?? []

      // 3. Scrivi ogni file nella sottocartella dedicata all'entity
      const written = []
      for (const { filename, entity, content_b64 } of files) {
        const binary = atob(content_b64)
        const bytes = new Uint8Array(binary.length)
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
        const subFolder = await folderHandle.getDirectoryHandle(entity, { create: true })
        const fileHandle = await subFolder.getFileHandle(filename, { create: true })
        const writable = await fileHandle.createWritable()
        await writable.write(bytes)
        await writable.close()
        written.push(`${entity}/${filename}`)
      }
      return written
    },
    onSuccess: (written) => {
      setGeneratedFiles(written)
      queryClient.invalidateQueries({ queryKey: ["operator-code-requests"] })
    },
  })

  const handleGeneraCasellaMail = useCallback(() => {
    const toSend = pending.map(req => ({
      id: req.id,
      prefix: (emailMap[req.id] || req.suggested_email || "").replace(/@.*$/, "").trim(),
      name: `${req.last_name} ${req.first_name}`.trim(),
    })).filter(m => m.prefix)
    if (!toSend.length) return
    setSentMailboxIds(new Set(toSend.map(m => m.id)))
    const payload = {
      queue: toSend.map(({ id, prefix, name }) => ({ id, prefix, name })),
      returnUrl: window.location.href,
    }
    const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(payload))))
    setShowArubaTm(false)
    window.open(
      `https://webmail.aruba.it/new/management/home#ftchub=${encoded}`,
      "_blank", "noopener,noreferrer"
    )
  }, [pending, emailMap])

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-10 shadow-sm flex items-center justify-center">
        <span className="text-sm text-gray-400">Caricamento richieste…</span>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-10 shadow-sm flex flex-col items-center justify-center gap-3">
        <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center">
          <CheckCircle size={22} className="text-green-500" aria-hidden="true" />
        </div>
        <p className="text-sm font-medium text-gray-600">Nessuna richiesta in attesa</p>
        <p className="text-xs text-gray-400">Tutte le richieste sono state evase</p>
      </div>
    )
  }

  return (
    <>
      {emailPreview && (
        <EmailPreviewModal
          results={emailPreview.results}
          isSending={notifyMutation.isPending}
          onClose={() => setEmailPreview(null)}
          onConfirm={() => notifyMutation.mutate(false)}
        />
      )}
      {bulkEvadiResult && (
        <BulkEvadiResultModal
          results={bulkEvadiResult.results}
          ok={bulkEvadiResult.ok}
          errors={bulkEvadiResult.errors}
          onClose={() => setBulkEvadiResult(null)}
        />
      )}
      {notifyResult && (
        <NotifyResultModal
          results={notifyResult.results}
          sent={notifyResult.sent}
          skipped={notifyResult.skipped}
          onClose={() => setNotifyResult(null)}
        />
      )}
      {showArubaTm && (
        <ArubaTmModal
          pendingCount={pending.length}
          onClose={() => setShowArubaTm(false)}
          onGo={handleGeneraCasellaMail}
        />
      )}
      <div className="flex flex-col gap-3">
      {/* Banner stato */}
      <div className={`flex items-center justify-between px-4 py-3 rounded-xl border ${isInProgress ? "bg-amber-50 border-amber-200" : "bg-blue-50 border-blue-200"}`}>
        <div className="flex items-center gap-2">
          <Clock size={15} className={isInProgress ? "text-amber-600" : "text-blue-600"} aria-hidden="true" />
          <span className={`text-sm font-semibold ${isInProgress ? "text-amber-700" : "text-blue-700"}`}>
            {pending.length} {pending.length === 1 ? "richiesta in attesa" : "richieste in attesa"}
          </span>
          {isInProgress && (
            <span className="text-xs bg-amber-200 text-amber-800 font-semibold px-2 py-0.5 rounded-full">In lavorazione</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!isInProgress && pending.length > 0 && (
            <button
              onClick={() => takeOverMutation.mutate()}
              disabled={takeOverMutation.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1e3a5f] hover:bg-[#2563eb] text-white text-xs font-semibold rounded-lg shadow transition disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-[#2563eb]"
            >
              <PlayCircle size={13} aria-hidden="true" />
              {takeOverMutation.isPending ? "…" : "Prendi in carico"}
            </button>
          )}
          {pending.length > 0 && (
            <button
              onClick={() => setShowArubaTm(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold rounded-lg shadow transition focus-visible:ring-2 focus-visible:ring-violet-500"
            >
              <MailPlus size={13} aria-hidden="true" />
              Genera Casella Mail
            </button>
          )}
        </div>
      </div>

      {/* Errore generazione */}
      {generateMutation.isError && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center gap-2">
          <AlertCircle size={14} className="text-red-500 shrink-0" aria-hidden="true" />
          <span className="text-xs text-red-700">{generateMutation.error?.message || "Errore durante la generazione dei file"}</span>
        </div>
      )}

      {/* Pannello file generati */}
      {generatedFiles.length > 0 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex flex-col gap-1">
          <div className="flex items-center gap-2 mb-1">
            <FileDown size={13} className="text-emerald-600" aria-hidden="true" />
            <span className="text-xs font-semibold text-emerald-700">File salvati in One Italy IT - Files</span>
          </div>
          {generatedFiles.map(f => (
            <span key={f} className="text-xs font-mono text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded w-fit">{f}</span>
          ))}
        </div>
      )}

      {/* Tabella IN ATTESA */}
      {pending.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
          <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-600">
              {pending.length} {pending.length === 1 ? "richiesta in attesa" : "richieste in attesa"}
            </span>
            <button
              onClick={() => {
                const rows = pending.map(req => ({
                  id: req.id,
                  email: (emailMap[req.id] || req.suggested_email || "").replace(/@.*$/, "").trim() || null,
                }))
                bulkEvadiMutation.mutate(rows)
              }}
              disabled={bulkEvadiMutation.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded-lg shadow transition disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-green-500"
            >
              <CheckCircle size={13} aria-hidden="true" />
              {bulkEvadiMutation.isPending ? "Evasione…" : `Evadi tutte (${pending.length})`}
            </button>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-gray-600 font-semibold">
                <th scope="col" className="px-4 py-3 text-left">Negozio</th>
                <th scope="col" className="px-4 py-3 text-left">Cognome</th>
                <th scope="col" className="px-4 py-3 text-left">Nome</th>
                <th scope="col" className="px-4 py-3 text-left">Data inizio</th>
                <th scope="col" className="px-4 py-3 text-left">Richiesta da</th>
                <th scope="col" className="px-4 py-3 text-left w-52">Email proposta</th>
                <th scope="col" className="px-4 py-3 text-left">Azione</th>
              </tr>
            </thead>
            <tbody>
              {pending.map((req, i) => {
                const emailPrefix = emailMap[req.id] ?? ""
                const isPending = evadiMutation.isPending && evadiMutation.variables?.id === req.id
                return (
                  <tr key={req.id} className={`border-b border-gray-100 ${i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}`}>
                    <td className="px-4 py-2.5 font-mono text-gray-500">{req.store_number}</td>
                    <td className="px-4 py-2.5 font-medium text-gray-800">{req.last_name}</td>
                    <td className="px-4 py-2.5 text-gray-700">{req.first_name}</td>
                    <td className="px-4 py-2.5 text-gray-500">
                      {req.start_date ? new Date(req.start_date).toLocaleDateString("it-IT") : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-gray-500">{req.requester_name || "—"}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1">
                        <label htmlFor={`email-${req.id}`} className="sr-only">Email per {req.first_name} {req.last_name}</label>
                        <input
                          id={`email-${req.id}`}
                          type="text"
                          value={emailPrefix}
                          onChange={e => setEmailMap(m => ({ ...m, [req.id]: e.target.value.toLowerCase().replace(/\s/g, "") }))}
                          placeholder="prefisso"
                          className="w-28 px-2 py-1 border border-gray-300 rounded text-xs font-mono focus:ring-1 focus:ring-[#2563eb] focus:border-transparent outline-none transition"
                        />
                        <span className="text-gray-400 text-[10px] whitespace-nowrap">@flyingtigeritalia.com</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        {mailboxResults[req.id] === 'created' ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-green-100 text-green-700 border border-green-200" aria-label="Casella creata">
                            <MailCheck size={11} aria-hidden="true" /> Creata
                          </span>
                        ) : mailboxResults[req.id] === 'exists' ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-200" aria-label="Casella già esistente">
                            <MailX size={11} aria-hidden="true" /> Già esistente
                          </span>
                        ) : mailboxResults[req.id] ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700 border border-red-200" aria-label="Esito sconosciuto">
                            <MailX size={11} aria-hidden="true" /> Errore
                          </span>
                        ) : sentMailboxIds.has(req.id) ? (
                          <MailCheck size={15} className="text-green-500 shrink-0" aria-label="Casella inviata ad Aruba" />
                        ) : !emailPrefix ? (
                          <MailX size={15} className="text-red-400 shrink-0" aria-label="Email non configurata" />
                        ) : null}
                        <button
                          onClick={() => evadiMutation.mutate({ id: req.id, email: emailPrefix })}
                          disabled={isPending}
                          aria-label={`Evadi richiesta per ${req.first_name} ${req.last_name}`}
                          className="px-2.5 py-1 bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 text-xs font-semibold rounded-lg transition disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-[#2563eb]"
                        >
                          {isPending ? "…" : "Evadi"}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Tabella EVASE */}
      {evaded.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
          <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <CheckCircle size={13} className="text-green-500" aria-hidden="true" />
              <span className="text-xs font-semibold text-gray-600">{evaded.length} {evaded.length === 1 ? "richiesta evasa" : "richieste evase"}</span>
            </div>
            <div className="flex items-center gap-3 flex-wrap">

              {/* Toggle invio mail */}
              <label className="flex items-center gap-2 cursor-pointer select-none" htmlFor="toggle-send-mail">
                <span className="text-xs text-gray-500">Abilita invio mail</span>
                <button
                  id="toggle-send-mail"
                  role="switch"
                  aria-checked={emailSendEnabled}
                  onClick={() => setEmailSendEnabled(v => !v)}
                  className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors focus-visible:ring-2 focus-visible:ring-[#2563eb] ${emailSendEnabled ? "bg-blue-600" : "bg-gray-200"}`}
                >
                  <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${emailSendEnabled ? "translate-x-4" : "translate-x-0"}`} />
                </button>
                <span className={`text-[10px] font-bold ${emailSendEnabled ? "text-blue-600" : "text-gray-400"}`}>
                  {emailSendEnabled ? "ON" : "OFF"}
                </span>
              </label>

              {evaded.filter(r => !r.exported_at).length > 0 && (
                <button
                  onClick={() => { setGeneratedFiles([]); generateMutation.mutate() }}
                  disabled={generateMutation.isPending}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow transition disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-emerald-500"
                >
                  <FileDown size={13} aria-hidden="true" />
                  {generateMutation.isPending ? "Generazione…" : `Genera file NAV (${evaded.filter(r => !r.exported_at).length})`}
                </button>
              )}
              {evaded.filter(r => !r.notification_sent_at).length > 0 && (
                <button
                  onClick={() => notifyMutation.mutate(!emailSendEnabled)}
                  disabled={notifyMutation.isPending}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-white text-xs font-semibold rounded-lg shadow transition disabled:opacity-40 focus-visible:ring-2 ${emailSendEnabled ? "bg-blue-600 hover:bg-blue-700 focus-visible:ring-blue-500" : "bg-amber-500 hover:bg-amber-600 focus-visible:ring-amber-400"}`}
                >
                  {emailSendEnabled ? <Send size={13} aria-hidden="true" /> : <Mail size={13} aria-hidden="true" />}
                  {notifyMutation.isPending
                    ? (emailSendEnabled ? "Invio…" : "Caricamento…")
                    : emailSendEnabled
                      ? `Invia Mail (${evaded.filter(r => !r.notification_sent_at).length})`
                      : `Anteprima Mail (${evaded.filter(r => !r.notification_sent_at).length})`
                  }
                </button>
              )}
            </div>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-green-50/60 border-b border-gray-200 text-gray-600 font-semibold">
                <th scope="col" className="px-4 py-3 text-left">Negozio</th>
                <th scope="col" className="px-4 py-3 text-left">Cognome</th>
                <th scope="col" className="px-4 py-3 text-left">Nome</th>
                <th scope="col" className="px-4 py-3 text-left">Data inizio</th>
                <th scope="col" className="px-4 py-3 text-left">Richiesta da</th>
                <th scope="col" className="px-4 py-3 text-left">Email assegnata</th>
                <th scope="col" className="px-4 py-3 text-left">Codice</th>
                <th scope="col" className="px-4 py-3 text-left">PWD</th>
                <th scope="col" className="px-4 py-3 text-left">Evasa il</th>
                <th scope="col" className="px-4 py-3 text-left">NAV</th>
                <th scope="col" className="px-4 py-3 text-left">Notifica SM/DM</th>
              </tr>
            </thead>
            <tbody>
              {evaded.map((req, i) => (
                <tr key={req.id} className={`border-b border-gray-100 ${i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}`}>
                  <td className="px-4 py-2.5 font-mono text-gray-500">{req.store_number}</td>
                  <td className="px-4 py-2.5 font-medium text-gray-800">{req.last_name}</td>
                  <td className="px-4 py-2.5 text-gray-700">{req.first_name}</td>
                  <td className="px-4 py-2.5 text-gray-500">
                    {req.start_date ? new Date(req.start_date).toLocaleDateString("it-IT") : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-gray-500">{req.requester_name || "—"}</td>
                  <td className="px-4 py-2.5 font-mono text-gray-500 text-[11px]">
                    {req.assigned_email ? req.assigned_email.replace(DOMAIN_DISPLAY, "") : "—"}
                    {req.assigned_email && <span className="text-gray-300">@flyingtigeritalia.com</span>}
                  </td>
                  <td className="px-4 py-2.5 font-mono font-bold text-[#1e3a5f]">{req.assigned_code ?? "—"}</td>
                  <td className="px-4 py-2.5 font-mono font-bold text-amber-700">{req.assigned_password ?? "—"}</td>
                  <td className="px-4 py-2.5 text-gray-400">
                    {req.evaded_at ? new Date(req.evaded_at).toLocaleDateString("it-IT") : "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    {req.exported_at ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <FileDown size={11} aria-hidden="true" />
                        {new Date(req.exported_at).toLocaleDateString("it-IT")}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-100 text-gray-400">
                        <FileDown size={11} aria-hidden="true" />
                        Da esportare
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    {req.notification_sent_at ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                        <MailCheck size={11} aria-hidden="true" />
                        {new Date(req.notification_sent_at).toLocaleDateString("it-IT")}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-100 text-gray-400">
                        <Mail size={11} aria-hidden="true" />
                        Da inviare
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      </div>
    </>
  )
}

// ── Pagina principale ─────────────────────────────────────────────────────────
export default function CodiceOperatore() {
  const navigate = useNavigate()
  const { user } = useAuthStore()

  const isAdmin = ["IT", "ADMIN", "SUPERUSER"].includes(user?.department)
  const subtitle = isAdmin ? "Gestione" : "Richiesta"

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="flex items-center gap-3 shrink-0">
        <div className="w-9 h-9 bg-[#1e3a5f]/10 rounded-xl flex items-center justify-center">
          <UserCheck size={18} className="text-[#1e3a5f]" aria-hidden="true" />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-800">Codice Operatore</h1>
          <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>
        </div>
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition focus-visible:ring-2 focus-visible:ring-[#2563eb]"
        >
          <LogOut size={15} aria-hidden="true" />
          Esci
        </button>
      </div>

      {isAdmin ? <GestioneView /> : <RichiestView user={user} />}
    </div>
  )
}
