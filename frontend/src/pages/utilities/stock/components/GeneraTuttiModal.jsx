import { useState, useEffect, useRef } from "react"
import { X, CheckCircle, Loader2, AlertCircle, TriangleAlert, FileText, Trash2 } from "lucide-react"
import { getFolderHandle } from "@/utils/folderStorage"
import { EXPORT_STEPS, EXPORT_STEPS_NEW, runStockExport } from "../stockExportRunner"

const ALL_ENTITIES = ["IT01", "IT02", "IT03"]
const STOCK_RE = /^Stock-(\d{4}-\d{2}-\d{2})-(IT0[123])\.csv$/i

const ENTITY_COLORS = {
  IT01: "bg-blue-100 text-blue-700",
  IT02: "bg-emerald-100 text-emerald-700",
  IT03: "bg-violet-100 text-violet-700",
}

function makeEntityState(steps) {
  return {
    fileName: null,
    stockDate: null,
    csvFileHandle: null,
    stepStatus: steps.map(() => "pending"),
    stepMessages: steps.map(() => null),
    error: null,
    done: false,
    skipped: false,
  }
}

function StepIcon({ status }) {
  if (status === "done") return <CheckCircle size={13} className="text-green-500 shrink-0 mt-0.5" />
  if (status === "running") return <Loader2 size={13} className="text-blue-500 animate-spin shrink-0 mt-0.5" />
  if (status === "warning") return <TriangleAlert size={13} className="text-amber-500 shrink-0 mt-0.5" />
  return <div className="w-3 h-3 rounded-full border border-gray-200 shrink-0 mt-0.5" />
}

function EntityColumn({ entity, state, activeSteps }) {
  const hasWarnings = state.stepStatus.some(s => s === "warning")

  return (
    <div className="flex-1 min-w-0 border border-gray-200 rounded-xl p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <span className={`text-xs font-bold px-2 py-0.5 rounded ${ENTITY_COLORS[entity]}`}>{entity}</span>
        {state.stockDate && (
          <span className="text-xs text-gray-400">
            {state.stockDate.split("-").reverse().join("/")}
          </span>
        )}
      </div>

      {/* Content */}
      {state.skipped ? (
        <div className="flex items-start gap-2 text-xs text-gray-400 py-1">
          <AlertCircle size={13} className="text-amber-400 shrink-0 mt-0.5" />
          <span>Nessun file trovato — elaborazione scartata</span>
        </div>
      ) : state.error ? (
        <div className="flex items-start gap-2 text-xs text-red-600 py-1">
          <AlertCircle size={13} className="shrink-0 mt-0.5" />
          <span>{state.error}</span>
        </div>
      ) : (
        <div className="space-y-1.5">
          {activeSteps.map((label, i) => {
            const status = state.stepStatus[i]
            const msg = state.stepMessages[i]
            return (
              <div key={i} className="flex items-start gap-2">
                <StepIcon status={status} />
                <div className="min-w-0">
                  <span className={`text-[11px] leading-snug block ${
                    status === "running" ? "text-blue-600 font-medium" :
                    status === "done" ? "text-gray-700" :
                    status === "warning" ? "text-amber-600" :
                    "text-gray-400"
                  }`}>
                    {label}
                  </span>
                  {msg && (
                    <span className="text-[10px] text-amber-500 leading-tight block mt-0.5 break-words">
                      {msg}
                    </span>
                  )}
                </div>
              </div>
            )
          })}

          {state.done && (
            <div className={`mt-2 flex items-center gap-1.5 text-xs font-semibold ${hasWarnings ? "text-amber-600" : "text-green-600"}`}>
              {hasWarnings ? <TriangleAlert size={12} /> : <CheckCircle size={12} />}
              {hasWarnings ? "Completato con avvisi" : "Completato"}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function GeneraTuttiModal({ onClose, entities = ALL_ENTITIES }) {
  const legacyMode = localStorage.getItem("ftchub_legacy_mode") !== "false"
  const activeSteps = legacyMode ? EXPORT_STEPS : EXPORT_STEPS_NEW

  // entities = le entity target per questa esecuzione. Se e' la lista completa
  // (IT01/IT02/IT03) siamo in modalita' "Genera tutti"; se e' una sola, siamo
  // in modalita' per-entity chiamata dal drill-down di Genera Tabelle.
  const isSingleEntity = entities.length === 1
  const modalTitle = isSingleEntity ? `Genera stock ${entities[0]}` : "Genera tutti"
  const modalSubtitle = isSingleEntity
    ? `Esportazione ${entities[0]} dalla cartella Estrazioni`
    : "Esportazione simultanea IT01 · IT02 · IT03"

  const [phase, setPhase] = useState("scanning")   // scanning | preflight | running | done
  const [scanError, setScanError] = useState(null)
  const [writeZeros, setWriteZeros] = useState(false)
  const [deletedFiles, setDeletedFiles] = useState([])
  const [entityStates, setEntityStates] = useState(() => {
    const init = {}
    for (const e of entities) init[e] = makeEntityState(activeSteps)
    return init
  })

  const rootHandleRef = useRef(null)
  const commercialHandleRef = useRef(null)

  const today = new Date().toISOString().slice(0, 10)
  const todayFormatted = new Date().toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" })

  useEffect(() => { scan() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function scan() {
    try {
      const rootHandle = await getFolderHandle("stock_folder")
      if (!rootHandle) {
        setScanError("Nessuna cartella collegata. Vai in Impostazioni e collega la cartella Estrazioni.")
        setPhase("preflight")
        return
      }

      const perm = await rootHandle.requestPermission({ mode: "readwrite" })
      if (perm !== "granted") {
        setScanError("Permesso negato sulla cartella. Riconnetti la cartella nelle Impostazioni.")
        setPhase("preflight")
        return
      }

      rootHandleRef.current = rootHandle

      // Try commercial folder
      const commercialHandle = await getFolderHandle("stock_folder_commercial")
      if (commercialHandle) {
        try {
          const perm2 = await commercialHandle.requestPermission({ mode: "readwrite" })
          if (perm2 === "granted") commercialHandleRef.current = commercialHandle
        } catch { /* silently skip */ }
      }

      // Open NAV subfolder
      let navHandle
      try {
        navHandle = await rootHandle.getDirectoryHandle("91 - Files from NAV")
      } catch {
        setScanError('Sottocartella "91 - Files from NAV" non trovata nella cartella Estrazioni.')
        setPhase("preflight")
        return
      }

      const foundFiles = {}
      const toDelete = []

      for await (const [name, fh] of navHandle.entries()) {
        if (fh.kind !== "file") continue
        const m = STOCK_RE.exec(name)
        if (!m) continue
        const fileDate = m[1]
        const fileEntity = m[2].toUpperCase()
        if (fileDate === today) {
          if (!foundFiles[fileEntity]) {
            foundFiles[fileEntity] = { handle: fh, fileName: name, stockDate: fileDate }
          }
        } else {
          toDelete.push({ name, navHandle })
        }
      }

      // Delete old files
      const deleted = []
      for (const { name, navHandle: nh } of toDelete) {
        try {
          await nh.removeEntry(name)
          deleted.push(name)
        } catch { /* ignore */ }
      }
      setDeletedFiles(deleted)

      // Update entity states
      setEntityStates(prev => {
        const next = { ...prev }
        for (const entity of entities) {
          const found = foundFiles[entity]
          next[entity] = {
            ...prev[entity],
            fileName: found?.fileName ?? null,
            stockDate: found?.stockDate ?? null,
            csvFileHandle: found?.handle ?? null,
          }
        }
        return next
      })

      setPhase("preflight")
    } catch (e) {
      setScanError(e.message || "Errore durante la scansione")
      setPhase("preflight")
    }
  }

  async function handleAvvia() {
    // Snapshot handles before any state change
    const snapshots = {}
    for (const entity of entities) {
      snapshots[entity] = {
        csvFileHandle: entityStates[entity].csvFileHandle,
        stockDate: entityStates[entity].stockDate,
      }
    }

    setPhase("running")

    // Mark skipped entities immediately
    setEntityStates(prev => {
      const next = { ...prev }
      for (const entity of entities) {
        if (!snapshots[entity].csvFileHandle) {
          next[entity] = { ...prev[entity], skipped: true }
        }
      }
      return next
    })

    const rootHandle = rootHandleRef.current
    const commercialHandle = commercialHandleRef.current

    const makeOnStep = (entity) => (stepIndex, status, message = null) => {
      setEntityStates(prev => {
        const e = prev[entity]
        const newStepStatus = e.stepStatus.map((v, i) => i === stepIndex ? status : v)
        const newStepMessages = message
          ? e.stepMessages.map((v, i) => i === stepIndex ? message : v)
          : e.stepMessages
        return { ...prev, [entity]: { ...e, stepStatus: newStepStatus, stepMessages: newStepMessages } }
      })
    }

    await Promise.all(
      entities.map(async (entity) => {
        const { csvFileHandle, stockDate } = snapshots[entity]
        if (!csvFileHandle) return

        try {
          await runStockExport({
            entity,
            csvFileHandle,
            stockDate,
            rootHandle,
            commercialHandle,
            writeZeros,
            legacyMode,
            onStep: makeOnStep(entity),
          })
          setEntityStates(prev => ({
            ...prev,
            [entity]: { ...prev[entity], done: true },
          }))
        } catch (e) {
          setEntityStates(prev => ({
            ...prev,
            [entity]: { ...prev[entity], error: e.message || "Errore imprevisto" },
          }))
        }
      })
    )

    setPhase("done")
  }

  // Validazione: si puo' avviare solo se TUTTE le entity target hanno il csv del giorno.
  // Nella modalita' "Genera tutti" significa tutti e 3, in modalita' single-entity
  // significa solo quella selezionata.
  const allTargetsFound = entities.every(e => entityStates[e].csvFileHandle !== null)
  const missingEntities = entities.filter(e => entityStates[e].csvFileHandle === null)
  const canClose = phase === "preflight" || phase === "done"

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className={`bg-white rounded-2xl shadow-2xl w-full mx-4 ${phase === "running" || phase === "done" ? "max-w-4xl" : "max-w-xl"} transition-all`}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
          <div>
            <h3 className="text-base font-bold text-gray-800">{modalTitle}</h3>
            <p className="text-xs text-gray-400 mt-0.5">{modalSubtitle}</p>
          </div>
          {canClose && (
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition">
              <X size={18} />
            </button>
          )}
        </div>

        <div className="px-6 py-5">
          {/* SCANNING */}
          {phase === "scanning" && (
            <div className="flex items-center gap-3 py-6 justify-center">
              <Loader2 size={18} className="text-[#1e3a5f] animate-spin" />
              <span className="text-sm text-gray-600">Scansione della cartella in corso...</span>
            </div>
          )}

          {/* PREFLIGHT */}
          {phase === "preflight" && (
            <div className="space-y-5">
              {scanError ? (
                <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
                  <AlertCircle size={15} className="shrink-0 mt-0.5" />
                  {scanError}
                </div>
              ) : (
                <>
                  <div>
                    <p className="text-sm font-semibold text-gray-700 mb-3">
                      File trovati per oggi ({todayFormatted})
                    </p>
                    <div className="space-y-2">
                      {entities.map(entity => {
                        const state = entityStates[entity]
                        return (
                          <div key={entity} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                            <span className={`text-xs font-bold px-2 py-0.5 rounded shrink-0 ${ENTITY_COLORS[entity]}`}>
                              {entity}
                            </span>
                            {state.fileName ? (
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <CheckCircle size={13} className="text-green-500 shrink-0" />
                                <span className="text-xs font-mono text-gray-600 truncate">{state.fileName}</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <AlertCircle size={13} className="text-amber-400 shrink-0" />
                                <span className="text-xs text-gray-400">Non trovato — elaborazione verrà scartata</span>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {deletedFiles.length > 0 && (
                    <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
                      <Trash2 size={13} className="text-amber-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-semibold text-amber-700 mb-1">
                          File eliminati (data diversa da oggi)
                        </p>
                        <div className="space-y-0.5">
                          {deletedFiles.map(f => (
                            <p key={f} className="text-[11px] font-mono text-amber-600">{f}</p>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  <label className="flex items-center gap-3 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={writeZeros}
                      onChange={e => setWriteZeros(e.target.checked)}
                      className="w-4 h-4 accent-[#1e3a5f]"
                    />
                    <div>
                      <span className="text-sm font-medium text-gray-700">Scrivi zeri espliciti</span>
                      <p className="text-xs text-gray-400 mt-0.5">File più grande ma mostra 0 per ogni negozio senza stock</p>
                    </div>
                  </label>

                  <button
                    onClick={handleAvvia}
                    disabled={!allTargetsFound}
                    className="w-full bg-[#1e3a5f] hover:bg-[#2563eb] text-white font-semibold py-2.5 rounded-xl shadow transition disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Avvia esportazione
                  </button>

                  {!allTargetsFound && (
                    <p className="text-center text-xs text-amber-600">
                      {isSingleEntity
                        ? `Il file Stock-${today}-${entities[0]}.csv non e' presente nella cartella.`
                        : `File mancanti per: ${missingEntities.join(", ")}. Per avviare servono i CSV di oggi per tutte e tre le entity.`}
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          {/* RUNNING / DONE */}
          {(phase === "running" || phase === "done") && (
            <div className="space-y-4">
              <div className="flex gap-4">
                {entities.map(entity => (
                  <EntityColumn key={entity} entity={entity} state={entityStates[entity]} activeSteps={activeSteps} />
                ))}
              </div>

              {phase === "done" && (
                <div className="flex justify-end pt-2">
                  <button
                    onClick={onClose}
                    className="bg-[#1e3a5f] hover:bg-[#2563eb] text-white font-semibold px-6 py-2 rounded-xl shadow transition"
                  >
                    Chiudi
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
