import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  List, LogOut, FolderOpen, Upload, Download, Loader2,
  CheckCircle, AlertCircle, Clock, FileSpreadsheet, TriangleAlert, ExternalLink, ArrowRight,
  Search, X, Play, Plus, Trash2, FileUp, Edit3, Save, Check,
} from "lucide-react"
import * as XLSX from "xlsx/dist/xlsx.full.min.js"
import { getFolderHandle } from "@/utils/folderStorage"
import { itemsApi } from "@/api/items"
import { loadItem } from "@/lib/checkPrezziStore"
import { checkAgentHealth } from "@/lib/navAgent"
import EccezioniPanel from "./EccezioniPanel"
import ScrapInvPanel from "./ScrapInvPanel"
import ScrapWdPanel from "./ScrapWdPanel"
import PickingPanel from "./PickingPanel"

// URL SharePoint del Convertitore Item List (stabile, condiviso tra utenti).
// Aperto in Excel desktop via protocollo ms-excel:ofe|u|<url> dal NAV agent.
const CONVERTER_SHAREPOINT_URL = "https://zebragroup.sharepoint.com/sites/IT01_Commercial/Files/15%20-%20Converitore%20item%20list%20NAV/New%20Converter%20Item%20List.xlsx"
const CONVERTER_FILENAME_MATCH = "New Converter Item List"
const AGENT_URL = "http://localhost:9999"

const TABS = [
  { id: "IT01",         label: "ItemList IT01",      soon: false },
  { id: "IT02",         label: "ItemList IT02",      soon: false },
  { id: "IT03",         label: "ItemList IT03",      soon: false },
  { id: "PROMO",        label: "ItemPromo",          soon: false },
  { id: "BF",           label: "ItemBlackFriday",    soon: false },
  { id: "ECCEZIONI",    label: "Eccezioni",          soon: false },
  { id: "SCRAP_INV",    label: "SCRAP INV",          soon: false },
  { id: "SCRAP_WD",     label: "SCRAP WD",           soon: false },
  { id: "PICK",         label: "ITEM for PICK",      soon: false },
]

const IMPORT_STEPS = [
  "Caricamento file nel database...",
  "Generazione file di archivio (tbl_ItemM, ItemM, ItemListPortale)...",
]

function formatDate(iso) {
  if (!iso) return "—"
  return new Date(iso).toLocaleString("it-IT", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  })
}

export default function ItemListPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [activeEntity, setActiveEntity] = useState("IT01")

  // ── Agent health check ──
  const [agentOk, setAgentOk] = useState(null) // null = checking, true/false

  const checkAgent = useCallback(async () => {
    setAgentOk(await checkAgentHealth())
  }, [])

  useEffect(() => { checkAgent() }, [checkAgent])

  async function handleRetryAgent() {
    setAgentOk(null)
    window.location.href = "ftchub-agent://start"
    setTimeout(async () => {
      setAgentOk(await checkAgentHealth())
    }, 3000)
  }

  const [fileObj, setFileObj] = useState(null)
  const [fileInfo, setFileInfo] = useState(null)
  const [converterRows, setConverterRows] = useState(null) // { headers, dataRows } dal foglio ITEM LIST
  const [reading, setReading] = useState(false)
  const [readError, setReadError] = useState(null)

  // Step progress
  const [importing, setImporting] = useState(false)
  const [stepStatus, setStepStatus] = useState(IMPORT_STEPS.map(() => "pending"))
  const [stepMessages, setStepMessages] = useState(IMPORT_STEPS.map(() => null))
  const [importError, setImportError] = useState(null)
  const [importDone, setImportDone] = useState(false)
  const [importResult, setImportResult] = useState(null)

  const { data: sessions = [], isLoading: loadingSessions } = useQuery({
    queryKey: ["items-sessions", "IT01"],
    queryFn: () => itemsApi.getSessionsIT01().then(r => r.data),
    staleTime: 30_000,
  })

  const { data: tblInfo, isLoading: loadingTbl } = useQuery({
    queryKey: ["items-tbl-info"],
    queryFn: () => itemsApi.getTblInfoIT01().then(r => r.data),
    staleTime: 30_000,
  })

  function setStep(i, status, message = null) {
    setStepStatus(s => s.map((v, idx) => idx === i ? status : v))
    if (message) setStepMessages(s => s.map((v, idx) => idx === i ? message : v))
  }

  function resetFile() {
    setFileObj(null)
    setFileInfo(null)
    setConverterRows(null)
    setReadError(null)
    setImportError(null)
    setImportDone(false)
    setImportResult(null)
    setStepStatus(IMPORT_STEPS.map(() => "pending"))
    setStepMessages(IMPORT_STEPS.map(() => null))
  }

  // ── Apri Convertitore: chiama NAV agent che apre il file SharePoint in Excel
  //    desktop (o porta in foreground la finestra se gia' aperto). L'agent fa
  //    polling fino a quando Excel ha effettivamente aperto il file (timeout 60s),
  //    quindi la nostra fetch resta in attesa e il modal overlay resta visibile.
  //    Applichiamo anche un minimo garantito di MIN_DISPLAY_MS per coerenza visiva:
  //    se l'agent torna prima (es. file gia' aperto → risposta immediata), il
  //    modal resta comunque visibile per MIN_DISPLAY_MS.
  const MIN_DISPLAY_MS = 3000
  const [openingConverter, setOpeningConverter] = useState(false)
  const [openConverterError, setOpenConverterError] = useState(null)
  async function handleApriConverter() {
    setOpeningConverter(true)
    setOpenConverterError(null)
    const startTime = Date.now()
    try {
      const res = await fetch(`${AGENT_URL}/open-converter`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: CONVERTER_SHAREPOINT_URL,
          filenameMatch: CONVERTER_FILENAME_MATCH,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `HTTP ${res.status}`)
      }
      // Attendi il tempo minimo di display (se l'agent e' stato veloce)
      const elapsed = Date.now() - startTime
      if (elapsed < MIN_DISPLAY_MS) {
        await new Promise(r => setTimeout(r, MIN_DISPLAY_MS - elapsed))
      }
    } catch (e) {
      // Anche in caso di errore, rispetta il tempo minimo prima di nascondere
      // il modal, cosi' l'utente non vede un flash veloce del popup.
      const elapsed = Date.now() - startTime
      if (elapsed < MIN_DISPLAY_MS) {
        await new Promise(r => setTimeout(r, MIN_DISPLAY_MS - elapsed))
      }
      setOpenConverterError(
        e.message === "Failed to fetch"
          ? "Agente NAV non raggiungibile — esegui installa_agente.bat"
          : `Errore apertura convertitore: ${e.message}`
      )
    } finally {
      setOpeningConverter(false)
    }
  }

  // ── da NAV ad APPOGGIO: copia i dati di Anagrafe ITEM IT01 (salvati in
  //    IndexedDB dalla pagina Check Prices) nel foglio "Appoggio" del
  //    Convertitore gia' aperto. Richiede che l'utente abbia prima cliccato
  //    "Apri Convertitore" e che Excel abbia il file attivo.
  const [pastingToConverter, setPastingToConverter] = useState(false)
  const [pasteError, setPasteError] = useState(null)
  const [pasteTickerVisible, setPasteTickerVisible] = useState(false)

  function parseItemTsv(text) {
    // Parsa il testo TSV in array 2D (righe x colonne).
    // Il testo proviene dal textarea "Anagrafe ITEM IT01" di Check Prices che
    // accetta il paste diretto da NAV/Excel (righe separate da newline,
    // colonne separate da TAB).
    if (!text) return []
    return text
      .split(/\r?\n/)
      .filter(line => line.length > 0) // elimina righe completamente vuote
      .map(line => line.split("\t"))
  }

  async function handleDaNavAdAppoggio() {
    setPastingToConverter(true)
    setPasteError(null)
    setPasteTickerVisible(false)

    try {
      // 1. Leggi dati ITEM IT01 da IndexedDB (pagina Check Prices)
      const entry = await loadItem("IT01")
      if (!entry.text || entry.text.trim().length === 0) {
        throw new Error("Anagrafe ITEM IT01 vuota in Check Prices. Vai su Check Prices IT01 e incolla prima l'export NAV.")
      }
      const rows = parseItemTsv(entry.text)
      if (rows.length === 0) {
        throw new Error("Nessuna riga valida trovata nei dati ITEM IT01.")
      }

      // 2. Manda all'agent che scrive via COM Excel nel foglio Appoggio
      const res = await fetch(`${AGENT_URL}/paste-to-converter`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filenameMatch: CONVERTER_FILENAME_MATCH,
          sheetName: "Appoggio",
          rows,
        }),
      })

      if (!res.ok) {
        // Status 404 = Excel o workbook non trovato = convertitore non pronto
        if (res.status === 404) {
          throw new Error("not-ready")
        }
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `HTTP ${res.status}`)
      }

      // 3. Mostra ticker scorrevole evidente
      setPasteTickerVisible(true)
    } catch (e) {
      if (e.message === "not-ready") {
        setPasteError("Convertitore non ancora pronto a ricevere i dati…. riprova tra una decina di secondi")
      } else if (e.message === "Failed to fetch") {
        setPasteError("Agente NAV non raggiungibile — esegui installa_agente.bat")
      } else {
        setPasteError(e.message)
      }
    } finally {
      setPastingToConverter(false)
    }
  }

  async function handleLeggiConverter() {
    setReading(true)
    setReadError(null)
    setFileObj(null)
    setFileInfo(null)
    setImportDone(false)
    setImportResult(null)
    setImportError(null)
    // Chiude il ticker "ora esegui operazioni sul convertitore" — l'utente e' tornato
    // qui e sta importando, quindi il messaggio non serve piu'.
    setPasteTickerVisible(false)
    setStepStatus(IMPORT_STEPS.map(() => "pending"))
    setStepMessages(IMPORT_STEPS.map(() => null))
    try {
      const commercialHandle = await getFolderHandle("stock_folder_commercial")
      if (!commercialHandle)
        throw new Error('Cartella "One Italy Commercial - Files" non collegata. Vai in Impostazioni e collega la cartella Commercial.')
      const perm = await commercialHandle.requestPermission({ mode: "read" })
      if (perm !== "granted") throw new Error("Permesso negato sulla cartella Commercial.")
      let converterDir
      try { converterDir = await commercialHandle.getDirectoryHandle("15 - Converitore item list NAV") }
      catch { throw new Error('Cartella "15 - Converitore item list NAV" non trovata in Commercial.') }
      let fileHandle
      try { fileHandle = await converterDir.getFileHandle("New Converter Item List.xlsx") }
      catch { throw new Error('"New Converter Item List.xlsx" non trovato in "15 - Converitore item list NAV".') }
      const file = await fileHandle.getFile()
      const buffer = await file.arrayBuffer()
      const wb = XLSX.read(buffer, { type: "array", raw: true })
      if (!wb.SheetNames.includes("ITEM LIST"))
        throw new Error('Foglio "ITEM LIST" non trovato nel file.')
      const ws = wb.Sheets["ITEM LIST"]
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: "" })
      const rawHeaders = rows[0] || []
      const dataRows = rows.slice(1).filter(r => r.slice(0, 5).some(c => c !== "" && c !== null))
      setFileObj(file)
      setFileInfo({ name: file.name, rowCount: dataRows.length })
      setConverterRows({ headers: rawHeaders, dataRows })
    } catch (e) {
      setReadError(e.message || "Errore lettura Converter.")
    } finally {
      setReading(false)
    }
  }

  const [downloadingIT01, setDownloadingIT01] = useState(false)

  async function handleDownloadIT01() {
    setDownloadingIT01(true)
    try {
      const { data: items } = await itemsApi.exportCurrentIT01()
      if (!items.length) return
      const FIELDS = ["item_no","description","description_local","warehouse","last_cost","unit_price","item_cat","net_weight","barcode","vat_code","units_per_pack","model_store","batteries","first_rp","category","barcode_ext","vat_pct","gm_pct","description1","description2","modulo","model_store_portale","modulo_numerico","model_store_portale_num"]
      const HEADERS = ["Nr.","Descrizione","Description Local","Magazzino","Ultimo costo","Prezzo unitario","Cat. articolo","Peso netto","Barcode","Cod. IVA","Unità/collo","Model Store","Batterie","First RP","Category","Barcode ext.","IVA %","GM %","Descrizione1","Descrizione2","Modulo","Model Store Portale","Modulo numerico","Model Store Portale Num."]
      const ws = XLSX.utils.aoa_to_sheet([HEADERS, ...items.map(i => FIELDS.map(f => i[f] ?? ""))])
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, "ItemList IT01")
      XLSX.writeFile(wb, "IT01_ItemList.xlsx")
    } finally {
      setDownloadingIT01(false)
    }
  }

  async function handleImporta() {
    if (!fileObj) return
    setImporting(true)
    setImportError(null)
    setImportDone(false)
    setImportResult(null)
    setStepStatus(IMPORT_STEPS.map(() => "pending"))
    setStepMessages(IMPORT_STEPS.map(() => null))

    try {
      // ── Step 0: Upload e import DB ─────────────────────────────────────────
      setStep(0, "running")
      const { data } = await itemsApi.uploadIT01(fileObj)
      setStep(0, "done", `${data.row_count.toLocaleString("it-IT")} articoli importati`)

      // ── Step 1: Generazione file archivio ──────────────────────────────────
      setStep(1, "running")
      try {
        const { data: genResult } = await itemsApi.generateFilesIT01(data.session_id)
        setStep(1, "done", `4 file generati (portale: ${genResult.portale_count.toLocaleString("it-IT")} articoli filtrati)`)
      } catch (genErr) {
        const genMsg = genErr.response?.data?.detail || genErr.message || "Errore generazione file"
        setStep(1, "warning", genMsg)
      }

      setImportResult({ row_count: data.row_count })
      setFileObj(null)
      setFileInfo(null)
      setImportDone(true)
      queryClient.invalidateQueries({ queryKey: ["items-sessions", "IT01"] })

    } catch (e) {
      const msg = e.response?.data?.detail || e.message || "Errore durante l'importazione."
      setImportError(msg)
      setStepStatus(prev => prev.map(s => s === "running" ? "warning" : s))
    } finally {
      setImporting(false)
    }
  }

  const showSteps = importing || importDone

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-teal-500/10 rounded-xl flex items-center justify-center">
          <List size={18} className="text-teal-600" aria-hidden="true" />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-800">Gestione Anagrafiche Articoli</h1>
          <p className="text-xs text-gray-400 mt-0.5">Gestione ItemList di IT01, IT02, IT03 · ItemP (promo) · ItemBF (BlackFriday) · SCRAPlist inventario · SCRAPlist Writedown · Articoli autorizzati al trasferimento tramite PickingList</p>
        </div>
        <div className="flex items-center gap-2">
          {agentOk === true && (
            <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-1.5">
              <CheckCircle size={14} aria-hidden="true" />
              Agent OK
            </span>
          )}
          {agentOk === null && (
            <span className="flex items-center gap-1.5 text-xs text-gray-400 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5">
              <Loader2 size={14} className="animate-spin" aria-hidden="true" />
              Verifica…
            </span>
          )}
          {agentOk === false && (
            <button
              onClick={handleRetryAgent}
              className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 hover:bg-amber-100 transition"
              aria-label="Avvia agente NAV"
            >
              <TriangleAlert size={14} aria-hidden="true" />
              Agent offline
              <Play size={12} aria-hidden="true" />
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

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-2">
        {TABS.map(({ id, label, soon }) => (
          <button
            key={id}
            onClick={() => !soon && setActiveEntity(id)}
            disabled={soon}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition
              ${soon
                ? "bg-white text-gray-300 border-gray-100 cursor-not-allowed"
                : activeEntity === id
                  ? "bg-[#1e3a5f] text-white border-[#1e3a5f] shadow-sm"
                  : "bg-white text-gray-600 border-gray-200 hover:border-[#2563eb] hover:text-[#2563eb]"
              }`}
          >
            {label}
            {soon && <span className="text-[10px] bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded">soon</span>}
          </button>
        ))}
      </div>

      {activeEntity === "IT01" && (
        <>
          {/* ── Card import ── */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
            <div>
              <h2 className="text-sm font-bold text-gray-700">Importa foglio ItemList dal Convertitore</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Leggi il file{" "}
                <span className="font-mono text-gray-500">New Converter Item List.xlsx</span>{" "}
                dalla cartella Commercial, caricalo nel database e genera i file di archivio.
                La cartella deve essere collegata nelle Impostazioni.
              </p>
            </div>

            {readError && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2.5">
                <AlertCircle size={13} className="shrink-0 mt-0.5" aria-hidden="true" />
                <span>{readError}</span>
              </div>
            )}

            {fileInfo && !importing && !importDone && (
              <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
                <FileSpreadsheet size={18} className="text-blue-500 shrink-0" aria-hidden="true" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-blue-800 truncate">{fileInfo.name}</p>
                  <p className="text-xs text-blue-500 mt-0.5">
                    {fileInfo.rowCount.toLocaleString("it-IT")} articoli rilevati
                  </p>
                </div>
              </div>
            )}

            {openConverterError && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700" role="alert">
                <AlertCircle size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
                <span className="flex-1">{openConverterError}</span>
                <button onClick={() => setOpenConverterError(null)} className="text-red-400 hover:text-red-600">×</button>
              </div>
            )}
            {pasteError && (
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-300 rounded-lg px-4 py-3 text-sm text-amber-800" role="alert">
                <TriangleAlert size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                <span className="flex-1 font-semibold">{pasteError}</span>
                <button onClick={() => setPasteError(null)} className="text-amber-500 hover:text-amber-700 text-lg leading-none">×</button>
              </div>
            )}
            {pasteTickerVisible && (
              <div className="relative overflow-hidden bg-amber-50 border border-amber-200 text-amber-700 rounded-xl" role="status">
                <button
                  onClick={() => setPasteTickerVisible(false)}
                  aria-label="Chiudi messaggio"
                  className="absolute right-2 top-1/2 -translate-y-1/2 z-10 text-amber-500 hover:text-amber-700 text-lg leading-none w-6 h-6 flex items-center justify-center rounded-full hover:bg-amber-100"
                >
                  ×
                </button>
                <div className="py-2.5 pr-10">
                  <div className="ftc-marquee">
                    <span className="text-sm font-semibold mx-12">Ora esegui tutte le operazioni sul Convertitore, poi torna qui e clicca su "Leggi da Convertitore"</span>
                    <span className="text-sm font-semibold mx-12">Ora esegui tutte le operazioni sul Convertitore, poi torna qui e clicca su "Leggi da Convertitore"</span>
                  </div>
                </div>
              </div>
            )}

            {/* ── 3 card azione principali (stile Genera Tabelle) ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <button
                onClick={handleApriConverter}
                disabled={openingConverter || importing}
                className="bg-white rounded-xl border border-gray-200 p-5 text-left shadow-sm hover:shadow-md hover:border-[#2563eb] cursor-pointer transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:shadow-sm disabled:hover:border-gray-200"
                title="Apre il file Convertitore in Excel desktop via SharePoint; se gia' aperto lo porta in primo piano"
              >
                <div className="w-11 h-11 bg-[#1e3a5f] rounded-xl flex items-center justify-center mb-3">
                  {openingConverter
                    ? <Loader2 size={20} className="text-white animate-spin" aria-hidden="true" />
                    : <ExternalLink size={20} className="text-white" aria-hidden="true" />}
                </div>
                <div className="font-semibold text-gray-800">Apri Convertitore</div>
                <div className="text-sm text-gray-500 mt-1">Apre il file in Excel via SharePoint</div>
              </button>

              <button
                onClick={handleDaNavAdAppoggio}
                disabled={pastingToConverter || importing}
                className="bg-white rounded-xl border border-gray-200 p-5 text-left shadow-sm hover:shadow-md hover:border-[#2563eb] cursor-pointer transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:shadow-sm disabled:hover:border-gray-200"
                title="Copia i dati di Anagrafe ITEM IT01 (da Check Prices) nel foglio Appoggio del Convertitore aperto"
              >
                <div className="w-11 h-11 bg-blue-500 rounded-xl flex items-center justify-center mb-3">
                  {pastingToConverter
                    ? <Loader2 size={20} className="text-white animate-spin" aria-hidden="true" />
                    : <ArrowRight size={20} className="text-white" aria-hidden="true" />}
                </div>
                <div className="font-semibold text-gray-800">da NAV ad APPOGGIO</div>
                <div className="text-sm text-gray-500 mt-1">Copia ITEM IT01 nel foglio Appoggio</div>
              </button>

              <button
                onClick={handleLeggiConverter}
                disabled={reading || importing}
                className="bg-white rounded-xl border border-gray-200 p-5 text-left shadow-sm hover:shadow-md hover:border-[#2563eb] cursor-pointer transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:shadow-sm disabled:hover:border-gray-200"
              >
                <div className="w-11 h-11 bg-teal-500 rounded-xl flex items-center justify-center mb-3">
                  {reading
                    ? <Loader2 size={20} className="text-white animate-spin" aria-hidden="true" />
                    : <FolderOpen size={20} className="text-white" aria-hidden="true" />}
                </div>
                <div className="font-semibold text-gray-800">
                  {fileInfo ? "Rileggi Converter" : "Leggi da Convertitore"}
                </div>
                <div className="text-sm text-gray-500 mt-1">Legge il file .xlsx dalla cartella Commercial</div>
              </button>
            </div>

            {/* Bottoni secondari: Importa / Annulla / Nuova importazione */}
            {((fileInfo && !importDone) || importDone) && (
              <div className="flex gap-3 flex-wrap">
                {fileInfo && !importDone && (
                  <>
                    <button
                      onClick={handleImporta}
                      disabled={importing}
                      className="flex-1 flex items-center justify-center gap-2 bg-[#1e3a5f] hover:bg-[#2563eb] text-white font-semibold py-2.5 rounded-xl shadow transition disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {importing
                        ? <Loader2 size={15} className="animate-spin" aria-hidden="true" />
                        : <Upload size={15} aria-hidden="true" />}
                      {importing ? "Elaborazione..." : "Importa nel database e genera file di archivio"}
                    </button>
                    <button
                      onClick={resetFile}
                      disabled={importing}
                      className="px-4 py-2.5 border border-gray-300 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition disabled:opacity-40"
                    >
                      Annulla
                    </button>
                  </>
                )}
                {importDone && (
                  <div className="text-xs text-green-600 font-semibold flex items-center gap-1.5">
                    <CheckCircle size={13} aria-hidden="true" />
                    Importazione completata
                  </div>
                )}
              </div>
            )}

            {/* ── Scheda avanzamento (sotto i bottoni, stile Stock) ── */}
            {showSteps && (
              <div className="border border-gray-200 rounded-xl p-4 space-y-3">
                {/* Header con badge entity */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-700">IT01</span>
                  <span className="text-xs text-gray-400">Importazione e generazione file</span>
                </div>

                {/* Errore globale */}
                {importError && (
                  <div className="flex items-start gap-2 text-xs text-red-600 py-1">
                    <AlertCircle size={13} className="shrink-0 mt-0.5" aria-hidden="true" />
                    <span>{importError}</span>
                  </div>
                )}

                {/* Step list */}
                <div className="space-y-1.5">
                  {IMPORT_STEPS.map((label, i) => {
                    const status = stepStatus[i]
                    const msg = stepMessages[i]
                    return (
                      <div key={i} className="flex items-start gap-2">
                        <div className="shrink-0 mt-0.5">
                          {status === "done" ? (
                            <CheckCircle size={13} className="text-green-500" aria-hidden="true" />
                          ) : status === "warning" ? (
                            <TriangleAlert size={13} className="text-amber-500" aria-hidden="true" />
                          ) : status === "running" ? (
                            <Loader2 size={13} className="text-blue-500 animate-spin" aria-hidden="true" />
                          ) : (
                            <div className="w-3 h-3 rounded-full border border-gray-200" aria-hidden="true" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <span className={`text-[11px] leading-snug block ${
                            status === "running" ? "text-blue-600 font-medium"
                            : status === "done" ? "text-gray-700"
                            : status === "warning" ? "text-amber-600"
                            : "text-gray-400"
                          }`}>
                            {label}
                          </span>
                          {msg && (
                            <span className={`text-[10px] leading-tight block mt-0.5 break-words ${
                              status === "warning" ? "text-amber-500" : "text-gray-400"
                            }`}>
                              {msg}
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}

                  {/* Completion summary */}
                  {importDone && (
                    <div className={`mt-2 flex items-center gap-1.5 text-xs font-semibold ${
                      stepStatus.some(s => s === "warning") ? "text-amber-600" : "text-green-600"
                    }`}>
                      {stepStatus.some(s => s === "warning")
                        ? <TriangleAlert size={12} aria-hidden="true" />
                        : <CheckCircle size={12} aria-hidden="true" />}
                      {stepStatus.some(s => s === "warning") ? "Completato con avvisi" : "Completato"}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ── Tabella anagrafe ITEM IT01 da Check Prices ── */}
          <ItemListTable entity="IT01" session={!loadingSessions && sessions.length > 0 ? (sessions.find(s => s.is_current) ?? sessions[0]) : null} loadingSession={loadingSessions} tblInfo={tblInfo} loadingTbl={loadingTbl} onDownload={handleDownloadIT01} downloading={downloadingIT01} onNewImport={resetFile} />
        </>
      )}

      {activeEntity === "IT02" && <ItemListTable entity="IT02" />}
      {activeEntity === "IT03" && <ItemListTable entity="IT03" />}
      {activeEntity === "PROMO" && <ItemGenericPanel key="PROMO" label="ItemPromo" queryKey="items-promo" getApi={itemsApi.getPromo} replaceApi={itemsApi.replacePromo} />}
      {activeEntity === "BF" && <ItemGenericPanel key="BF" label="ItemBlackFriday" queryKey="items-blackfriday" getApi={itemsApi.getBlackFriday} replaceApi={itemsApi.replaceBlackFriday} />}
      {activeEntity === "ECCEZIONI" && <EccezioniPanel />}
      {activeEntity === "SCRAP_INV" && <ScrapInvPanel />}
      {activeEntity === "SCRAP_WD" && <ScrapWdPanel />}
      {activeEntity === "PICK" && <PickingPanel />}

      {/* Modal overlay lampeggiante durante l'apertura del Convertitore.
          Resta visibile finche' l'agent non conferma che Excel ha aperto il file
          (polling fino a 60s). Il click sullo sfondo e' disabilitato: l'utente
          deve aspettare o chiudere Excel/fermare l'agent. */}
      {openingConverter && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" role="dialog" aria-modal="true" aria-live="polite">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md mx-4 animate-pulse">
            <div className="flex items-center gap-4">
              <Loader2 size={28} className="text-[#2563eb] animate-spin shrink-0" aria-hidden="true" />
              <div>
                <p className="text-base font-bold text-gray-800">Apertura convertitore in corso</p>
                <p className="text-sm text-gray-500 mt-1">Attendere prego&hellip;</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Componente tabella anagrafe ITEM generico (IT01, IT02, ...) ──────────────
export function ItemListTable({ entity, session = null, loadingSession = false, tblInfo = null, loadingTbl = false, onDownload = null, downloading = false, onNewImport = null }) {
  const [loading, setLoading] = useState(true)
  const [entry, setEntry] = useState(null)
  const [search, setSearch] = useState("")

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setSearch("")
    ;(async () => {
      const e = await loadItem(entity)
      if (!cancelled) {
        setEntry(e)
        setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [entity])

  const { headers, allRows, rows } = useMemo(() => {
    if (!entry?.text) return { headers: [], allRows: [], rows: [] }
    const lines = entry.text.split(/\r?\n/).filter(l => l.length > 0)
    if (lines.length === 0) return { headers: [], allRows: [], rows: [] }

    const parsed = lines.map(l => l.split("\t"))
    const hdrs = parsed[0]

    // Skip double header if present
    let startIdx = 1
    if (parsed.length > 2) {
      const h0 = (hdrs[0] || "").trim().toLowerCase()
      const h2 = (parsed[1][0] || "").trim().toLowerCase()
      if (h0 === h2) startIdx = 2
    }

    return { headers: hdrs, allRows: parsed, rows: parsed.slice(startIdx) }
  }, [entry])

  const filtered = useMemo(() => {
    if (!search.trim()) return rows
    const term = search.trim().toLowerCase()
    return rows.filter(r => r.some(c => (c || "").toLowerCase().includes(term)))
  }, [rows, search])

  function handleDownloadXlsx() {
    if (!headers.length || !rows.length) return
    const ws = {}
    headers.forEach((h, c) => {
      ws[XLSX.utils.encode_cell({ r: 0, c })] = { v: String(h), t: "s" }
    })
    rows.forEach((row, ri) => {
      row.forEach((cell, c) => {
        if (cell == null || cell === "") return
        const val = cell
        ws[XLSX.utils.encode_cell({ r: ri + 1, c })] = {
          v: val,
          t: typeof val === "number" ? "n" : "s",
        }
      })
    })
    ws["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length, c: headers.length - 1 } })
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, `ItemList ${entity}`)
    XLSX.writeFile(wb, `ItemList ${entity}.xlsx`)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 gap-2 text-gray-400">
        <Loader2 size={16} className="animate-spin" aria-hidden="true" />
        <span className="text-sm">Caricamento dati {entity}...</span>
      </div>
    )
  }

  if (!entry?.text) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 text-center space-y-2">
        <AlertCircle size={24} className="mx-auto text-gray-300" aria-hidden="true" />
        <p className="text-sm text-gray-500 font-medium">Nessun dato disponibile per {entity}</p>
        <p className="text-xs text-gray-400">
          Vai su <span className="font-semibold">Check Prices → {entity}</span> e incolla l'export NAV dell'anagrafe ITEM.
        </p>
      </div>
    )
  }

  const searchId = `${entity.toLowerCase()}-search`
  const showGenerate = entity === "IT02" || entity === "IT03"

  return (
    <div className="space-y-3">
      {/* Info bar unificata: Fonte + Ultima importazione */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm px-4 py-2.5 text-xs space-y-1.5">
        {/* Riga 1: Fonte anagrafe */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider">Fonte</span>
            <span className="text-gray-600">Anagrafe ITEM {entity} (Check Prices)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider">Articoli</span>
            <span className="text-gray-700 font-semibold tabular-nums">{rows.length.toLocaleString("it-IT")}</span>
          </div>
          {entry.savedAt && (
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider">Salvato il</span>
              <span className="text-gray-700 font-mono">{formatDate(entry.savedAt)}</span>
            </div>
          )}
          {entry.savedBy && (
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider">Da</span>
              <span className="text-gray-600">{entry.savedBy}</span>
            </div>
          )}
        </div>
        {/* Riga 2: Ultima importazione (solo se session disponibile) */}
        {loadingSession && (
          <div className="flex items-center gap-1.5 text-gray-400 border-t border-gray-100 pt-1.5">
            <Loader2 size={11} className="animate-spin" aria-hidden="true" />
            <span>Caricamento ultima importazione...</span>
          </div>
        )}
        {!loadingSession && session && (
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1 border-t border-gray-100 pt-1.5">
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider">Ultima importazione</span>
              <span className="text-gray-700 font-mono">{formatDate(session.imported_at)}</span>
            </div>
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider">File</span>
              <span className="text-gray-600 truncate" title={session.source_filename || "—"}>{session.source_filename || "—"}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider">Articoli DB</span>
              <span className="text-gray-700 font-semibold tabular-nums">{session.row_count.toLocaleString("it-IT")}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider">Batch</span>
              <span className="text-gray-500 font-mono">{session.batch_id}</span>
              {session.is_current && (
                <span className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded bg-green-100 text-green-700">
                  <CheckCircle size={8} aria-hidden="true" />
                  Corrente
                </span>
              )}
            </div>
          </div>
        )}
        {!loadingSession && !session && entity === "IT01" && (
          <div className="flex items-center gap-1.5 border-t border-gray-100 pt-1.5 text-gray-400">
            <span className="text-[9px] font-semibold uppercase tracking-wider">Ultimo caricamento DB</span>
            <span>Nessun caricamento effettuato</span>
          </div>
        )}
        {/* Riga 3: Ultima creazione tbl_ItemM (solo IT01) */}
        {loadingTbl && entity === "IT01" && (
          <div className="flex items-center gap-1.5 text-gray-400 border-t border-gray-100 pt-1.5">
            <Loader2 size={11} className="animate-spin" aria-hidden="true" />
            <span>Caricamento info file...</span>
          </div>
        )}
        {!loadingTbl && tblInfo?.exists && entity === "IT01" && (
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1 border-t border-gray-100 pt-1.5">
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider">Ultima creazione</span>
              <span className="text-gray-700 font-mono">{formatDate(tblInfo.created_at)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider">File</span>
              <span className="text-gray-600 font-mono">{tblInfo.filename}</span>
            </div>
            {tblInfo.row_count != null && (
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider">Articoli</span>
                <span className="text-gray-700 font-semibold tabular-nums">{tblInfo.row_count.toLocaleString("it-IT")}</span>
              </div>
            )}
            {tblInfo.created_by && (
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider">Creato da</span>
                <span className="text-gray-600">{tblInfo.created_by}</span>
              </div>
            )}
          </div>
        )}
        {!loadingTbl && tblInfo && !tblInfo.exists && entity === "IT01" && (
          <div className="border-t border-gray-100 pt-1.5 text-gray-400">
            File tbl_ItemM.xlsx non ancora generato.
          </div>
        )}
      </div>

      {/* Search + bottoni */}
      <div className="flex items-center gap-3 flex-wrap justify-between">
        <div className="relative max-w-sm flex-1 min-w-[200px]">
          <label htmlFor={searchId} className="sr-only">Cerca articolo</label>
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
          <input
            id={searchId}
            type="text"
            placeholder="Cerca articolo..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-8 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2563eb] focus:border-transparent outline-none transition"
          />
          {search && (
            <button onClick={() => setSearch("")} aria-label="Cancella ricerca" className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X size={14} aria-hidden="true" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {showGenerate && rows.length > 0 && (
            <button onClick={handleDownloadXlsx} className="flex items-center gap-2 border border-[#1e3a5f] text-[#1e3a5f] hover:bg-[#1e3a5f] hover:text-white font-semibold py-2 px-5 rounded-xl transition text-sm">
              <FileSpreadsheet size={15} aria-hidden="true" />
              Download ItemList
            </button>
          )}
          {onDownload && (
            <a href="http://ddt.tigeritalia.com/Account/Login?ReturnUrl=%2F" target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 bg-[#1e3a5f] hover:bg-[#2563eb] text-white font-semibold px-5 py-2 rounded-xl shadow transition text-sm focus-visible:ring-2 focus-visible:ring-[#2563eb]">
              <ExternalLink size={15} aria-hidden="true" />
              Carica su portale fatture
            </a>
          )}
          {onDownload && (
            <button onClick={onDownload} disabled={downloading}
              className="flex items-center gap-2 border border-[#1e3a5f] text-[#1e3a5f] hover:bg-[#1e3a5f] hover:text-white font-semibold py-2 px-5 rounded-xl transition text-sm disabled:opacity-50">
              {downloading ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <Download size={15} aria-hidden="true" />}
              Download ItemList
            </button>
          )}
          {onNewImport && (
            <button onClick={onNewImport} className="px-4 py-2 border border-gray-300 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition">
              Nuova importazione
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
              <tr>
                {headers.map((h, i) => (
                  <th key={i} scope="col" className="px-3 py-2 text-left text-gray-600 font-semibold whitespace-nowrap">
                    {h || `Col ${i + 1}`}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.slice(0, 500).map((row, ri) => (
                <tr key={ri} className="odd:bg-white even:bg-gray-50/50 hover:bg-blue-50/40">
                  {headers.map((_, ci) => (
                    <td key={ci} className="px-3 py-1.5 text-gray-700 whitespace-nowrap">
                      {row[ci] || ""}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length > 500 && (
          <div className="px-4 py-2 bg-gray-50 border-t border-gray-200 text-xs text-gray-400 text-center">
            Mostrate 500 righe su {filtered.length.toLocaleString("it-IT")} — usa la ricerca per filtrare
          </div>
        )}
        {search && filtered.length === 0 && (
          <div className="px-4 py-6 text-center text-sm text-gray-400">
            Nessun risultato per "{search}"
          </div>
        )}
      </div>
    </div>
  )
}

// ── ItemPromo Panel ──────────────────────────────────────────────────────────
const PROMO_COLUMNS = [
  "item_no", "description", "description_local", "warehouse",
  "last_cost", "unit_price", "item_cat", "net_weight",
  "barcode", "vat_code", "units_per_pack", "model_store",
  "batteries", "first_rp", "category", "barcode_ext",
  "vat_pct", "gm_pct", "description1", "description2",
  null, "modulo",
]

const PROMO_HEADERS = [
  "Nr.", "Descrizione", "Description in Local Language", "Magazzino",
  "Ultimo costo diretto", "Prezzo unitario", "Codice categoria articolo", "Peso netto",
  "Barcode", "Cat. reg. art./serv. IVA", "Unit\u00e0 per collo", "MODEL STORE",
  "Batterie", "First RP", "Category", "Barcode ext.",
  "IVA", "GM% escl. Trasporto", "Descrizione1", "Descrizione2",
  "", "Modulo",
]

function ItemGenericPanel({ label, queryKey, getApi, replaceApi }) {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState("")
  const [importedRows, setImportedRows] = useState(null)
  const [importedHeaders, setImportedHeaders] = useState(null)
  const [importFileName, setImportFileName] = useState(null)
  const [replacing, setReplacing] = useState(false)
  const [replaceError, setReplaceError] = useState(null)
  const fileInputRef = useRef(null)

  const { data: items = [], isLoading } = useQuery({
    queryKey: [queryKey],
    queryFn: () => getApi().then(r => r.data),
    staleTime: 30_000,
  })

  const filtered = useMemo(() => {
    if (!search.trim()) return items
    const term = search.trim().toLowerCase()
    return items.filter(item =>
      PROMO_COLUMNS.some(k => {
        const v = item[k]
        return v != null && String(v).toLowerCase().includes(term)
      })
    )
  }, [items, search])

  function handleDownload() {
    if (!items.length) return
    const aoa = [
      PROMO_HEADERS,
      ...items.map(i => PROMO_COLUMNS.map(k => k === null ? "" : (i[k] ?? ""))),
    ]
    const ws = XLSX.utils.aoa_to_sheet(aoa)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "ITEMS")
    XLSX.writeFile(wb, `${label}.xlsx`)
  }

  function handleImportFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setReplaceError(null)
    const reader = new FileReader()
    reader.onload = (evt) => {
      const data = new Uint8Array(evt.target.result)
      const wb = XLSX.read(data, { type: "array", raw: true })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: "" })
      if (rows.length < 2) {
        setReplaceError("File vuoto o senza dati.")
        return
      }
      // Trova la riga header (quella che contiene "Nr." nella prima colonna)
      let headerIdx = 0
      for (let i = 0; i < Math.min(rows.length, 5); i++) {
        const first = String(rows[i][0] || "").trim()
        if (first === "Nr." || first === "No.") { headerIdx = i; break }
      }
      setImportedHeaders(rows[headerIdx])
      setImportedRows(rows.slice(headerIdx + 1).filter(r => r.some(c => c !== "" && c != null)))
      setImportFileName(file.name)
    }
    reader.readAsArrayBuffer(file)
    e.target.value = ""
  }

  async function handleReplace() {
    if (!importedRows || !importedHeaders) return
    if (!confirm(`Sei sicuro? Questa operazione sostituirà tutti i dati correnti nella tabella ${label}.`)) return

    setReplacing(true)
    setReplaceError(null)
    try {
      // Mappa nome header Excel → nome campo DB
      const HEADER_TO_FIELD = {
        "Nr.": "item_no", "No.": "item_no",
        "Descrizione": "description", "Description": "description",
        "Description in Local Language": "description_local",
        "Magazzino": "warehouse", "Warehouse": "warehouse",
        "Ultimo costo diretto": "last_cost", "Last Direct Cost": "last_cost",
        "Prezzo unitario": "unit_price", "Unit Price": "unit_price",
        "Codice categoria articolo": "item_cat", "Item Category Code": "item_cat",
        "Peso netto": "net_weight", "Net Weight": "net_weight",
        "Barcode": "barcode",
        "Cat. reg. art./serv. IVA": "vat_code", "VAT Prod. Posting Group": "vat_code",
        "Unità per collo": "units_per_pack", "Unita per collo": "units_per_pack", "Units per Parcel": "units_per_pack",
        "MODEL STORE": "model_store",
        "Batterie": "batteries", "Batteries": "batteries",
        "First RP": "first_rp",
        "Category": "category",
        "Barcode ext.": "barcode_ext",
        "IVA": "vat_pct", "VAT %": "vat_pct",
        "GM% escl. Trasporto": "gm_pct",
        "Descrizione1": "description1",
        "Descrizione2": "description2",
        "Modulo": "modulo",
        "Model store per portale": "model_store_portale",
        "MODULO NUMERICO": "modulo_numerico",
        "MODEL STORE PORTALE NUMERICO": "model_store_portale_num",
      }

      // Mappa indice colonna → campo DB basato sugli header
      const colToField = importedHeaders.map(h => HEADER_TO_FIELD[String(h ?? "").trim()] || null)

      // Costruisci array di dict per il backend
      const dbRows = importedRows.map(row => {
        const obj = {}
        row.forEach((val, ci) => {
          const field = colToField[ci]
          if (field) obj[field] = val === "" ? null : val
        })
        return obj
      }).filter(obj => obj.item_no)

      await replaceApi(dbRows)

      setImportedRows(null)
      setImportedHeaders(null)
      setImportFileName(null)
      queryClient.invalidateQueries({ queryKey: [queryKey] })
    } catch (e) {
      setReplaceError(e.response?.data?.detail || e.message || "Errore durante la sovrascrittura")
    } finally {
      setReplacing(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 gap-2 text-gray-400">
        <Loader2 size={16} className="animate-spin" aria-hidden="true" />
        <span className="text-sm">Caricamento {label}...</span>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Info bar */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm px-4 py-2.5 flex flex-wrap items-center gap-x-6 gap-y-1 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider">Tabella</span>
          <span className="text-gray-600">{label}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider">Articoli</span>
          <span className="text-gray-700 font-semibold tabular-nums">{items.length.toLocaleString("it-IT")}</span>
        </div>
      </div>

      {/* Toolbar: Search + buttons */}
      <div className="flex items-center gap-3 flex-wrap justify-between">
        <div className="relative max-w-sm flex-1 min-w-[200px]">
          <label htmlFor={`${queryKey}-search`} className="sr-only">Cerca articolo</label>
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
          <input
            id={`${queryKey}-search`}
            type="text"
            placeholder="Cerca articolo..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-8 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2563eb] focus:border-transparent outline-none transition"
          />
          {search && (
            <button onClick={() => setSearch("")} aria-label="Cancella ricerca"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X size={14} aria-hidden="true" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {items.length > 0 && (
            <button onClick={handleDownload}
              className="flex items-center gap-2 border border-[#1e3a5f] text-[#1e3a5f] hover:bg-[#1e3a5f] hover:text-white font-semibold py-2 px-5 rounded-xl transition text-sm">
              <Download size={15} aria-hidden="true" />
              Download ItemList
            </button>
          )}
          <input ref={fileInputRef} type="file" accept=".xlsx,.xlsm,.xls" onChange={handleImportFile} className="hidden" />
          <button onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 border border-gray-300 text-gray-600 hover:bg-gray-50 font-semibold py-2 px-5 rounded-xl transition text-sm">
            <Upload size={15} aria-hidden="true" />
            Importa lista da file Excel
          </button>
          <button onClick={handleReplace} disabled={!importedRows || replacing}
            className="flex items-center gap-2 bg-[#1e3a5f] hover:bg-[#2563eb] text-white font-semibold py-2 px-5 rounded-xl shadow transition text-sm disabled:opacity-40 disabled:cursor-not-allowed">
            {replacing
              ? <Loader2 size={15} className="animate-spin" aria-hidden="true" />
              : <FileSpreadsheet size={15} aria-hidden="true" />}
            Sovrascrivi tabella
          </button>
        </div>
      </div>

      {/* Import preview */}
      {importedRows && (
        <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5 text-xs">
          <FileSpreadsheet size={14} className="text-blue-500 shrink-0" aria-hidden="true" />
          <span className="text-blue-700 font-medium">{importFileName}</span>
          <span className="text-blue-500">— {importedRows.length.toLocaleString("it-IT")} righe pronte per la sovrascrittura</span>
          <button onClick={() => { setImportedRows(null); setImportedHeaders(null); setImportFileName(null) }}
            className="ml-auto text-blue-400 hover:text-blue-600">
            <X size={14} aria-hidden="true" />
          </button>
        </div>
      )}

      {replaceError && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2">
          <AlertCircle size={13} className="shrink-0 mt-0.5" aria-hidden="true" />
          <span>{replaceError}</span>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
              <tr>
                {PROMO_HEADERS.filter(h => h !== "").map((h, i) => (
                  <th key={i} scope="col" className="px-3 py-2 text-left text-gray-600 font-semibold whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <tr><td colSpan={PROMO_HEADERS.filter(h => h !== "").length} className="px-4 py-8 text-center text-sm text-gray-400">
                  {items.length === 0 ? "Nessun dato. Importa un file Excel per popolare la tabella." : `Nessun risultato per "${search}"`}
                </td></tr>
              ) : (
                filtered.slice(0, 500).map((item, ri) => (
                  <tr key={item.id || ri} className="odd:bg-white even:bg-gray-50/50 hover:bg-blue-50/40">
                    {PROMO_COLUMNS.filter(k => k !== null).map((k, ci) => (
                      <td key={ci} className="px-3 py-1.5 text-gray-700 whitespace-nowrap">
                        {item[k] != null ? String(item[k]) : ""}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {filtered.length > 500 && (
          <div className="px-4 py-2 bg-gray-50 border-t border-gray-200 text-xs text-gray-400 text-center">
            Mostrate 500 righe su {filtered.length.toLocaleString("it-IT")} — usa la ricerca per filtrare
          </div>
        )}
      </div>
    </div>
  )
}

const ECC_COLUMNS = ["zebra", "descrizione", "prezzo_1", "prezzo_2", "sconto", "testo_prezzo", "categoria", "eccezione", "testo_prezzo2", "col11", "col12"]
const ECC_HEADERS = ["ZEBRA", "DESCRIZIONE", "1 PREZZO", "2 PREZZO", "SCONTO", "TESTO PREZZO", "CATEGORIA", "ECCEZIONE", "TESTO PREZZO2", "Column11", "Column12"]

const ECC_HEADER_TO_FIELD = {
  "ZEBRA": "zebra", "DESCRIZIONE": "descrizione",
  "1 PREZZO": "prezzo_1", "2 PREZZO": "prezzo_2",
  "SCONTO": "sconto", "TESTO PREZZO": "testo_prezzo",
  "CATEGORIA": "categoria", "ECCEZIONE": "eccezione",
  "TESTO PREZZO2": "testo_prezzo2", "Column11": "col11", "Column12": "col12",
}

// EccezioniPanel importato da EccezioniPanel.jsx
// Le costanti ECC_ sotto sono legacy e possono essere rimosse in futuro
function __UNUSED() {
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

  const filteredEcc = useMemo(() => {
    if (!searchEcc.trim()) return eccezioni
    const term = searchEcc.trim().toLowerCase()
    return eccezioni.filter(item => ECC_COLUMNS.some(k => item[k] != null && String(item[k]).toLowerCase().includes(term)))
  }, [eccezioni, searchEcc])

  const filteredBs = useMemo(() => {
    if (!searchBs.trim()) return bestseller
    const term = searchBs.trim().toLowerCase()
    return bestseller.filter(item => (item.item_no || "").toLowerCase().includes(term))
  }, [bestseller, searchBs])

  function handleDownload() {
    if (!eccezioni.length && !bestseller.length) return
    const wb = XLSX.utils.book_new()
    const eccAoa = [ECC_HEADERS, ...eccezioni.map(i => ECC_COLUMNS.map(k => i[k] ?? ""))]
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(eccAoa), "ECCEZIONI")
    const bsAoa = [["ITEM"], ...bestseller.map(i => [i.item_no])]
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(bsAoa), "BEST SELLER")
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

      // Foglio ECCEZIONI
      const eccSheet = wb.SheetNames.find(n => n.toUpperCase().includes("ECCEZIONI"))
      if (eccSheet) {
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[eccSheet], { header: 1, raw: true, defval: "" })
        let headerIdx = 0
        for (let i = 0; i < Math.min(rows.length, 5); i++) {
          if (String(rows[i]?.[0] ?? "").trim().toUpperCase() === "ZEBRA") { headerIdx = i; break }
        }
        const headers = rows[headerIdx] || []
        const colToField = headers.map(h => ECC_HEADER_TO_FIELD[String(h ?? "").trim()] || null)
        const dataRows = rows.slice(headerIdx + 1).filter(r => r.some(c => c !== "" && c != null))
        setImportedEcc(dataRows.map(row => {
          const obj = {}
          row.forEach((val, ci) => { const f = colToField[ci]; if (f) obj[f] = val === "" ? null : val })
          return obj
        }).filter(r => r.zebra))
      } else { setImportedEcc([]) }

      // Foglio BEST SELLER
      const bsSheet = wb.SheetNames.find(n => n.toUpperCase().includes("BEST") || n.toUpperCase().includes("SELLER"))
      if (bsSheet) {
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[bsSheet], { header: 1, raw: true, defval: "" })
        let headerIdx = 0
        for (let i = 0; i < Math.min(rows.length, 5); i++) {
          if (String(rows[i]?.[0] ?? "").trim().toUpperCase() === "ITEM") { headerIdx = i; break }
        }
        const dataRows = rows.slice(headerIdx + 1).filter(r => r[0] !== "" && r[0] != null)
        setImportedBs(dataRows.map(row => ({ item_no: String(row[0]).trim() })).filter(r => r.item_no))
      } else { setImportedBs([]) }

      setImportFileName(file.name)
    }
    reader.readAsArrayBuffer(file)
    e.target.value = ""
  }

  async function handleReplace() {
    if (!importedEcc && !importedBs) return
    if (!confirm("Sei sicuro? Questa operazione sostituirà i dati nelle tabelle Eccezioni e Best Seller.")) return
    setReplacing(true)
    setReplaceError(null)
    try {
      await itemsApi.replaceEccezioni(importedEcc || [], importedBs || [])

      setImportedEcc(null); setImportedBs(null); setImportFileName(null)
      queryClient.invalidateQueries({ queryKey: ["items-eccezioni"] })
    } catch (e) {
      setReplaceError(e.response?.data?.detail || e.message || "Errore durante la sovrascrittura")
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
      {/* Toolbar */}
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
            <Upload size={15} aria-hidden="true" /> Importa da file Excel
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
          <span className="text-blue-500">— Eccezioni: {(importedEcc || []).length} righe, Best Seller: {(importedBs || []).length} righe</span>
          <button onClick={() => { setImportedEcc(null); setImportedBs(null); setImportFileName(null) }} className="ml-auto text-blue-400 hover:text-blue-600"><X size={14} aria-hidden="true" /></button>
        </div>
      )}

      {replaceError && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2">
          <AlertCircle size={13} className="shrink-0 mt-0.5" aria-hidden="true" /><span>{replaceError}</span>
        </div>
      )}

      {/* Due tabelle affiancate */}
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4">
        {/* ECCEZIONI (più larga) */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-gray-700">Eccezioni</span>
            <span className="text-xs text-gray-400 tabular-nums">{filteredEcc.length.toLocaleString("it-IT")} righe</span>
          </div>
          <div className="relative">
            <label htmlFor="ecc-search" className="sr-only">Cerca eccezione</label>
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
            <input id="ecc-search" type="text" placeholder="Cerca..." value={searchEcc} onChange={e => setSearchEcc(e.target.value)}
              className="w-full pl-9 pr-8 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2563eb] focus:border-transparent outline-none transition" />
            {searchEcc && <button onClick={() => setSearchEcc("")} aria-label="Cancella" className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X size={14} aria-hidden="true" /></button>}
          </div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto max-h-[55vh] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
                  <tr>{ECC_HEADERS.map((h, i) => <th key={i} scope="col" className="px-3 py-2 text-left text-gray-600 font-semibold whitespace-nowrap">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredEcc.length === 0
                    ? <tr><td colSpan={ECC_HEADERS.length} className="px-4 py-6 text-center text-sm text-gray-400">{eccezioni.length === 0 ? "Nessun dato." : `Nessun risultato per "${searchEcc}"`}</td></tr>
                    : filteredEcc.slice(0, 300).map((item, ri) => (
                      <tr key={item.id || ri} className="odd:bg-white even:bg-gray-50/50 hover:bg-blue-50/40">
                        {ECC_COLUMNS.map((k, ci) => <td key={ci} className="px-3 py-1.5 text-gray-700 whitespace-nowrap">{item[k] != null ? String(item[k]) : ""}</td>)}
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            {filteredEcc.length > 300 && <div className="px-4 py-2 bg-gray-50 border-t border-gray-200 text-xs text-gray-400 text-center">Mostrate 300 su {filteredEcc.length.toLocaleString("it-IT")}</div>}
          </div>
        </div>

        {/* BEST SELLER (più stretta) */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-gray-700">Best Seller</span>
            <span className="text-xs text-gray-400 tabular-nums">{filteredBs.length.toLocaleString("it-IT")} righe</span>
          </div>
          <div className="relative">
            <label htmlFor="bs-search" className="sr-only">Cerca best seller</label>
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
            <input id="bs-search" type="text" placeholder="Cerca..." value={searchBs} onChange={e => setSearchBs(e.target.value)}
              className="w-full pl-9 pr-8 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2563eb] focus:border-transparent outline-none transition" />
            {searchBs && <button onClick={() => setSearchBs("")} aria-label="Cancella" className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X size={14} aria-hidden="true" /></button>}
          </div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="max-h-[55vh] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
                  <tr><th scope="col" className="px-3 py-2 text-left text-gray-600 font-semibold whitespace-nowrap">ITEM</th></tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredBs.length === 0
                    ? <tr><td className="px-4 py-6 text-center text-sm text-gray-400">{bestseller.length === 0 ? "Nessun dato." : `Nessun risultato per "${searchBs}"`}</td></tr>
                    : filteredBs.slice(0, 500).map((item, ri) => (
                      <tr key={item.id || ri} className="odd:bg-white even:bg-gray-50/50 hover:bg-blue-50/40">
                        <td className="px-3 py-1.5 text-gray-700 font-mono whitespace-nowrap">{item.item_no}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            {filteredBs.length > 500 && <div className="px-4 py-2 bg-gray-50 border-t border-gray-200 text-xs text-gray-400 text-center">Mostrate 500 su {filteredBs.length.toLocaleString("it-IT")}</div>}
          </div>
        </div>
      </div>
    </div>
  )
}
