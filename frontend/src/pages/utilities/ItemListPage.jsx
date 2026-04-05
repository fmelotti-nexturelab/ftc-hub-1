import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  List, LogOut, FolderOpen, Upload, Loader2,
  CheckCircle, AlertCircle, Clock, FileSpreadsheet, TriangleAlert,
} from "lucide-react"
import * as XLSX from "xlsx/dist/xlsx.full.min.js"
import { getFolderHandle } from "@/utils/folderStorage"
import { itemsApi } from "@/api/items"

const TABS = [
  { id: "IT01",         label: "ItemList IT01",      soon: false },
  { id: "IT02",         label: "ItemList IT02",      soon: true  },
  { id: "IT03",         label: "ItemList IT03",      soon: true  },
  { id: "PROMO",        label: "ItemPromo",          soon: true  },
  { id: "BF",           label: "ItemBlackFriday",    soon: true  },
  { id: "SCRAP_INV",    label: "SCRAP INV",          soon: true  },
  { id: "SCRAP_WD",     label: "SCRAP WD",           soon: true  },
  { id: "PICK",         label: "ITEM for PICK",      soon: true  },
]

const IMPORT_STEPS = [
  "Caricamento file nel database...",
  "Generazione file di archivio (tbl_ItemM, ItemM, ItemListPortale)...",
  "Salvataggio nelle cartelle legacy (Stores + Commercial)...",
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

  const [fileObj, setFileObj] = useState(null)
  const [fileInfo, setFileInfo] = useState(null)
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

  function setStep(i, status, message = null) {
    setStepStatus(s => s.map((v, idx) => idx === i ? status : v))
    if (message) setStepMessages(s => s.map((v, idx) => idx === i ? message : v))
  }

  function resetFile() {
    setFileObj(null)
    setFileInfo(null)
    setReadError(null)
    setImportError(null)
    setImportDone(false)
    setImportResult(null)
    setStepStatus(IMPORT_STEPS.map(() => "pending"))
    setStepMessages(IMPORT_STEPS.map(() => null))
  }

  async function handleLeggiConverter() {
    setReading(true)
    setReadError(null)
    setFileObj(null)
    setFileInfo(null)
    setImportDone(false)
    setImportResult(null)
    setImportError(null)
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
      const dataRows = rows.slice(1).filter(r => r.slice(0, 5).some(c => c !== "" && c !== null))
      setFileObj(file)
      setFileInfo({ name: file.name, rowCount: dataRows.length })
    } catch (e) {
      setReadError(e.message || "Errore lettura Converter.")
    } finally {
      setReading(false)
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

      // ── Step 2: Legacy save (se attivo) ───────────────────────────────────
      const legacyMode = localStorage.getItem("ftchub_legacy_mode") !== "false"
      if (legacyMode) {
        setStep(2, "running")
        try {
          const { data: tblBytes } = await itemsApi.downloadTblIT01()
          const tblData = new Uint8Array(tblBytes)

          const storesHandle = await getFolderHandle("stock_folder")
          if (storesHandle) {
            const perm = await storesHandle.requestPermission({ mode: "readwrite" })
            if (perm === "granted") {
              // 97 - Service / 01 - Tables / tbl_ItemM.xlsm
              try {
                const serviceDir = await storesHandle.getDirectoryHandle("97 - Service")
                const tablesDir = await serviceDir.getDirectoryHandle("01 - Tables")
                const fh = await tablesDir.getFileHandle("tbl_ItemM.xlsm", { create: true })
                const w = await fh.createWritable()
                await w.write(tblData)
                await w.close()

                // Tables_for_FTP / tbl_ItemM.xlsm
                try {
                  const ftpDir = await tablesDir.getDirectoryHandle("Tables_for_FTP")
                  const fh2 = await ftpDir.getFileHandle("tbl_ItemM.xlsm", { create: true })
                  const w2 = await fh2.createWritable()
                  await w2.write(tblData)
                  await w2.close()
                } catch { /* Tables_for_FTP non trovata — ignora */ }
              } catch (e) {
                setStep(2, "warning", "Stores: " + (e.message || "cartella non trovata"))
              }
            }
          }

          const commercialHandle = await getFolderHandle("stock_folder_commercial")
          if (commercialHandle) {
            const perm = await commercialHandle.requestPermission({ mode: "readwrite" })
            if (perm === "granted") {
              try {
                const sharedDir = await commercialHandle.getDirectoryHandle("28 - Italy Shared Folder")
                const fh = await sharedDir.getFileHandle("tbl_ItemM.xlsm", { create: true })
                const w = await fh.createWritable()
                await w.write(tblData)
                await w.close()
              } catch (e) {
                setStep(2, "warning", "Commercial: " + (e.message || "cartella non trovata"))
              }
            }
          }

          setStep(2, "done", "Copiato in Stores e Commercial")
        } catch (e) {
          setStep(2, "warning", e.message || "Errore salvataggio legacy")
        }
      } else {
        setStep(2, "done", "Legacy mode disattivato — skip")
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
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition"
        >
          <LogOut size={15} aria-hidden="true" />
          Esci
        </button>
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

            {/* ── Scheda avanzamento (stile Stock) ── */}
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

            <div className="flex gap-3">
              <button
                onClick={handleLeggiConverter}
                disabled={reading || importing}
                className="flex items-center gap-1.5 px-4 py-2.5 border border-[#1e3a5f] text-[#1e3a5f] hover:bg-[#1e3a5f] hover:text-white text-sm font-semibold rounded-xl transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {reading
                  ? <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                  : <FolderOpen size={14} aria-hidden="true" />}
                {fileInfo ? "Rileggi Converter" : "Leggi da Convertitore"}
              </button>

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
                <button
                  onClick={resetFile}
                  className="px-4 py-2.5 border border-gray-300 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition"
                >
                  Nuova importazione
                </button>
              )}
            </div>
          </div>

          {/* ── Card sessioni ── */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-gray-100 flex items-center gap-2">
              <Clock size={14} className="text-gray-400" aria-hidden="true" />
              <h2 className="text-sm font-bold text-gray-700">Storico importazioni IT01</h2>
              {sessions.length > 0 && (
                <span className="ml-auto text-xs text-gray-400">{sessions.length} import</span>
              )}
            </div>

            {loadingSessions ? (
              <div className="flex items-center justify-center py-10 gap-2 text-gray-400">
                <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                <span className="text-sm">Caricamento...</span>
              </div>
            ) : sessions.length === 0 ? (
              <div className="py-10 text-center text-sm text-gray-400">
                Nessuna importazione effettuata.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200 text-gray-600 font-semibold text-xs">
                      <th scope="col" className="px-5 py-3 text-left">Data importazione</th>
                      <th scope="col" className="px-4 py-3 text-left">File sorgente</th>
                      <th scope="col" className="px-4 py-3 text-right">Articoli</th>
                      <th scope="col" className="px-4 py-3 text-left">Batch ID</th>
                      <th scope="col" className="px-4 py-3 text-center">Stato</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.map(s => (
                      <tr key={s.id} className="odd:bg-white even:bg-gray-50/50 border-b border-gray-100 last:border-0">
                        <td className="px-5 py-3 text-gray-700 whitespace-nowrap font-mono text-xs">
                          {formatDate(s.imported_at)}
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs max-w-[200px] truncate">
                          {s.source_filename || "—"}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-700 font-semibold tabular-nums">
                          {s.row_count.toLocaleString("it-IT")}
                        </td>
                        <td className="px-4 py-3 text-gray-400 font-mono text-xs">
                          {s.batch_id}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {s.is_current ? (
                            <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded bg-green-100 text-green-700">
                              <CheckCircle size={10} aria-hidden="true" />
                              Corrente
                            </span>
                          ) : (
                            <span className="text-xs text-gray-300 font-medium">Storico</span>
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
      )}
    </div>
  )
}
