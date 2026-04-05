import { useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { Package, LogOut, Scissors, FileOutput, PlayCircle, Upload, Eye, Search, ArrowLeft } from "lucide-react"
import { stockApi } from "@/api/stock"
import StockPage from "./StockPage"
import StockUploadDialog from "./components/StockUploadDialog"
import GeneraTuttiModal from "./components/GeneraTuttiModal"
import StockSplitModal from "./components/StockSplitModal"
import EstraiAdmModal from "./components/EstraiAdmModal"
import StockConsultaEntityView from "./components/StockConsultaEntityView"

const VALID_ENTITIES = ["IT01", "IT02", "IT03"]

function formatItalianDate(isoDate) {
  if (!isoDate) return ""
  const [y, m, d] = isoDate.split("-")
  return `${d}/${m}/${y}`
}

export default function StockUnifiedPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  // Dual-mode:
  //   - con ?entity=IT0X (dai drill-down in Genera Tabelle) → solo StockPage di quella entity
  //     + bottone "Genera stock IT0X" (mono-entity)
  //   - senza ?entity → pagina "operazioni cross-entity":
  //     bottoni StockSplit, Estrai ADM, Genera tutti (con validazione tutti e 3 i csv)
  const urlEntity = (searchParams.get("entity") || "").toUpperCase()
  const entity    = VALID_ENTITIES.includes(urlEntity) ? urlEntity : null
  const isEntityMode = entity !== null

  const [showGeneraTutti, setShowGeneraTutti]       = useState(false)
  const [showGeneraSingolo, setShowGeneraSingolo]   = useState(false)
  const [showStockSplit, setShowStockSplit]         = useState(false)
  const [showEstraiAdm, setShowEstraiAdm]           = useState(false)
  const [showUpload, setShowUpload]                 = useState(false)
  const [viewTableMode, setViewTableMode]           = useState(false)
  // Drill-down consulta per entity nel cross-entity mode: null | "IT01" | "IT02" | "IT03"
  const [consultaEntity, setConsultaEntity]         = useState(null)

  // In entity mode, carichiamo qui le sessioni per sapere qual e' la piu' recente
  // (per il bottone "Vedi stock {data}"). React Query fa deduplicazione sulla stessa
  // queryKey, quindi StockPage (che usa la stessa key) condivide la cache.
  const { data: sessions = [] } = useQuery({
    queryKey: ["stock-sessions", entity],
    queryFn: () => stockApi.getSessions(entity).then(r => r.data),
    enabled: isEntityMode,
  })

  // Sessione piu' recente per data (difensivo: ordino anche se il backend dovesse cambiare)
  const latestSession = isEntityMode && sessions.length > 0
    ? [...sessions].sort((a, b) => (b.stock_date || "").localeCompare(a.stock_date || ""))[0]
    : null
  const existingDates = sessions.map(s => s.stock_date)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-amber-500/10 rounded-xl flex items-center justify-center">
          <Package size={18} className="text-amber-600" />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-800">
            {isEntityMode ? `Stock OneItaly ${entity}` : "Stock OneItaly"}
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {isEntityMode
              ? `Gestione stock giornaliero da Navision per ${entity}`
              : "Operazioni cross-entity: Genera tutti, StockSplit, Estrai ADM"}
          </p>
        </div>
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition"
        >
          <LogOut size={15} aria-hidden="true" />
          Esci
        </button>
      </div>

      {isEntityMode ? (
        <>
          {/* Action bar: Genera stock IT0X + Carica CSV + Vedi stock {data} */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setShowGeneraSingolo(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-[#1e3a5f] hover:bg-[#2563eb] text-white shadow transition"
            >
              <PlayCircle size={14} aria-hidden="true" />
              Genera stock {entity}
            </button>
            <button
              onClick={() => setShowUpload(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-[#1e3a5f] hover:bg-[#2563eb] text-white shadow transition"
            >
              <Upload size={14} aria-hidden="true" />
              Carica CSV
            </button>
            {latestSession && (
              <button
                onClick={() => setViewTableMode(v => !v)}
                aria-pressed={viewTableMode}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition border
                  ${viewTableMode
                    ? "bg-emerald-500 border-emerald-600 text-white shadow"
                    : "bg-white border-gray-200 text-gray-600 hover:border-[#2563eb] hover:text-[#2563eb]"}`}
              >
                <Eye size={14} aria-hidden="true" />
                Vedi stock {formatItalianDate(latestSession.stock_date)}
              </button>
            )}
          </div>

          {/* Gestione sessioni stock + tabella per la entity.
              hideActionBar=true perche' i bottoni sono sopra qui.
              forceTableMode attiva la modalita' "tabella-only" quando clicchi "Vedi stock". */}
          <StockPage
            key={entity}
            entity={entity}
            hideExit
            hideActionBar
            forceTableMode={viewTableMode && !!latestSession}
            forceTableSessionId={latestSession?.id ?? null}
            onBackToList={() => setViewTableMode(false)}
          />
        </>
      ) : consultaEntity ? (
        /* Drill-down consulta: mostra la vista EntityView per la entity selezionata */
        <div className="space-y-3">
          <button
            onClick={() => setConsultaEntity(null)}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition"
          >
            <ArrowLeft size={13} aria-hidden="true" />
            Torna alle card
          </button>
          <StockConsultaEntityView key={consultaEntity} entity={consultaEntity} />
        </div>
      ) : (
        /* Modalita' operazioni cross-entity: 3 card operazioni + 3 card consulta */
        <div className="space-y-6">
          {/* Sezione 1: operazioni di generazione */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Operazioni</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <button
                onClick={() => setShowGeneraTutti(true)}
                className="bg-white rounded-xl border border-gray-200 p-6 text-left shadow-sm hover:shadow-md hover:border-[#2563eb] cursor-pointer transition-all"
              >
                <div className="w-12 h-12 bg-[#1e3a5f] rounded-xl flex items-center justify-center mb-4">
                  <PlayCircle className="text-white" size={22} aria-hidden="true" />
                </div>
                <div className="font-semibold text-gray-800">Genera tutti</div>
                <div className="text-sm text-gray-500 mt-1">Esportazione simultanea IT01 · IT02 · IT03</div>
              </button>

              <button
                onClick={() => setShowStockSplit(true)}
                className="bg-white rounded-xl border border-gray-200 p-6 text-left shadow-sm hover:shadow-md hover:border-[#2563eb] cursor-pointer transition-all"
              >
                <div className="w-12 h-12 bg-orange-500 rounded-xl flex items-center justify-center mb-4">
                  <Scissors className="text-white" size={22} aria-hidden="true" />
                </div>
                <div className="font-semibold text-gray-800">StockSplit</div>
                <div className="text-sm text-gray-500 mt-1">Suddivide gli stock secondo regole di split</div>
              </button>

              <button
                onClick={() => setShowEstraiAdm(true)}
                className="bg-white rounded-xl border border-gray-200 p-6 text-left shadow-sm hover:shadow-md hover:border-[#2563eb] cursor-pointer transition-all"
              >
                <div className="w-12 h-12 bg-teal-500 rounded-xl flex items-center justify-center mb-4">
                  <FileOutput className="text-white" size={22} aria-hidden="true" />
                </div>
                <div className="font-semibold text-gray-800">Estrai ADM</div>
                <div className="text-sm text-gray-500 mt-1">Export ADM a partire dagli stock generati</div>
              </button>
            </div>
            <p className="text-xs text-gray-400">
              Genera tutti richiede che siano presenti i CSV di oggi per tutte e tre le entity (IT01, IT02, IT03).
            </p>
          </div>

          {/* Sezione 2: consulta stock per entity (calendario, filtri, esportazioni) */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Consulta stock per entity</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <button
                onClick={() => setConsultaEntity("IT01")}
                className="bg-white rounded-xl border border-gray-200 p-6 text-left shadow-sm hover:shadow-md hover:border-[#2563eb] cursor-pointer transition-all"
              >
                <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center mb-4">
                  <Search className="text-white" size={22} aria-hidden="true" />
                </div>
                <div className="font-semibold text-gray-800">Stock IT01</div>
                <div className="text-sm text-gray-500 mt-1">Calendario, filtri, export Excel</div>
              </button>

              <button
                onClick={() => setConsultaEntity("IT02")}
                className="bg-white rounded-xl border border-gray-200 p-6 text-left shadow-sm hover:shadow-md hover:border-[#2563eb] cursor-pointer transition-all"
              >
                <div className="w-12 h-12 bg-emerald-500 rounded-xl flex items-center justify-center mb-4">
                  <Search className="text-white" size={22} aria-hidden="true" />
                </div>
                <div className="font-semibold text-gray-800">Stock IT02</div>
                <div className="text-sm text-gray-500 mt-1">Calendario, filtri, export Excel</div>
              </button>

              <button
                onClick={() => setConsultaEntity("IT03")}
                className="bg-white rounded-xl border border-gray-200 p-6 text-left shadow-sm hover:shadow-md hover:border-[#2563eb] cursor-pointer transition-all"
              >
                <div className="w-12 h-12 bg-violet-500 rounded-xl flex items-center justify-center mb-4">
                  <Search className="text-white" size={22} aria-hidden="true" />
                </div>
                <div className="font-semibold text-gray-800">Stock IT03</div>
                <div className="text-sm text-gray-500 mt-1">Calendario, filtri, export Excel</div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modali */}
      {showGeneraTutti && (
        <GeneraTuttiModal onClose={() => setShowGeneraTutti(false)} />
      )}
      {showGeneraSingolo && isEntityMode && (
        <GeneraTuttiModal
          onClose={() => setShowGeneraSingolo(false)}
          entities={[entity]}
        />
      )}
      {showStockSplit && (
        <StockSplitModal onClose={() => setShowStockSplit(false)} />
      )}
      {showEstraiAdm && (
        <EstraiAdmModal onClose={() => setShowEstraiAdm(false)} />
      )}
      {showUpload && isEntityMode && (
        <StockUploadDialog
          entity={entity}
          existingDates={existingDates}
          onClose={() => setShowUpload(false)}
        />
      )}
    </div>
  )
}
