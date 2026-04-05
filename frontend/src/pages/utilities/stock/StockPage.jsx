import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { LogOut, Upload, Trash2, FileSpreadsheet, Package, ArrowLeft } from "lucide-react"
import { stockApi } from "@/api/stock"
import StockTable from "./components/StockTable"
import StockUploadDialog from "./components/StockUploadDialog"
import ExcelExportModal from "./components/ExcelExportModal"

export default function StockPage({
  entity,
  hideExit = false,
  // Quando `hideActionBar` e' true, il parent (StockUnifiedPage entity-mode)
  // controlla da solo i bottoni Carica CSV / Esporta Excel.
  hideActionBar = false,
  // Quando `forceTableMode` e' true, nasconde la lista sessioni e mostra solo
  // la StockTable per `forceTableSessionId`. Usato dal bottone "Vedi stock".
  forceTableMode = false,
  forceTableSessionId = null,
  onBackToList = null,
}) {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [selectedSessionId, setSelectedSessionId] = useState(null)
  const [showUpload, setShowUpload] = useState(false)
  const [showExport, setShowExport] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)

  const { data: sessions = [], isLoading: loadingSessions } = useQuery({
    queryKey: ["stock-sessions", entity],
    queryFn: () => stockApi.getSessions(entity).then((r) => r.data),
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => stockApi.deleteSession(id),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ["stock-sessions", entity] })
      qc.invalidateQueries({ queryKey: ["stock-stats"] })
      if (selectedSessionId === id) setSelectedSessionId(null)
      setConfirmDelete(null)
    },
  })

  const existingDates = sessions.map((s) => s.stock_date)

  return (
    <div className="space-y-5">
      {/* Header — mostrato solo in modalità standalone */}
      {!hideExit && (
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-amber-500/10 rounded-xl flex items-center justify-center">
            <Package size={18} className="text-amber-600" />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-gray-800">Stock {entity}</h1>
            <p className="text-xs text-gray-400 mt-0.5">Gestione stock giornaliero da Navision</p>
          </div>
          {selectedSessionId && (
            <button
              onClick={() => setShowExport(true)}
              className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-800 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition"
            >
              <FileSpreadsheet size={15} />
              Esporta Excel
            </button>
          )}
          <button
            onClick={() => setShowUpload(true)}
            className="flex items-center gap-1.5 text-sm bg-[#1e3a5f] hover:bg-[#2563eb] text-white font-semibold px-4 py-2 rounded-xl shadow transition"
          >
            <Upload size={15} />
            Carica CSV
          </button>
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition"
          >
            <LogOut size={15} aria-hidden="true" />
            Esci
          </button>
        </div>
      )}

      {/* Action bar — mostrata solo in modalità unificata (hideExit=true) e non esterna */}
      {hideExit && !hideActionBar && (
        <div className="flex justify-end gap-2">
          {selectedSessionId && (
            <button
              onClick={() => setShowExport(true)}
              className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-800 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition"
            >
              <FileSpreadsheet size={15} />
              Esporta Excel
            </button>
          )}
          <button
            onClick={() => setShowUpload(true)}
            className="flex items-center gap-1.5 text-sm bg-[#1e3a5f] hover:bg-[#2563eb] text-white font-semibold px-4 py-2 rounded-xl shadow transition"
          >
            <Upload size={15} />
            Carica CSV
          </button>
        </div>
      )}

      {/* Modalita' "Vedi stock": nascondo la lista e mostro solo la StockTable */}
      {forceTableMode && forceTableSessionId && (
        <div className="space-y-3">
          {onBackToList && (
            <button
              onClick={onBackToList}
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition"
            >
              <ArrowLeft size={13} aria-hidden="true" />
              Torna alla lista delle estrazioni
            </button>
          )}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <StockTable sessionId={forceTableSessionId} />
          </div>
        </div>
      )}

      {/* Sessions list (nascosta in modalita' "Vedi stock") */}
      {!forceTableMode && (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
          <span className="text-sm font-semibold text-gray-700">Sessioni caricate</span>
          <span className="ml-2 text-xs text-gray-400">(ultimi 30 giorni, una per data)</span>
        </div>
        {loadingSessions ? (
          <div className="px-4 py-6 text-center text-sm text-gray-400">Caricamento...</div>
        ) : sessions.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-gray-400">Nessuna sessione. Carica un CSV per iniziare.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600">Data stock</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600">File</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-600">Articoli</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-600">Negozi</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-600">Caricato il</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr
                  key={s.id}
                  onClick={() => setSelectedSessionId(s.id)}
                  className={`border-b border-gray-100 last:border-0 cursor-pointer transition
                    ${selectedSessionId === s.id ? "bg-blue-50" : "hover:bg-gray-50"}`}
                >
                  <td className="px-4 py-2.5 font-semibold text-gray-800">{s.stock_date}</td>
                  <td className="px-4 py-2.5 text-gray-500 text-xs font-mono truncate max-w-[200px]">{s.filename}</td>
                  <td className="px-4 py-2.5 text-right text-gray-700">{s.total_items.toLocaleString("it-IT")}</td>
                  <td className="px-4 py-2.5 text-right text-gray-700">{s.total_stores}</td>
                  <td className="px-4 py-2.5 text-right text-gray-400 text-xs">
                    {s.created_at ? new Date(s.created_at).toLocaleDateString("it-IT") : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      onClick={(e) => { e.stopPropagation(); setConfirmDelete(s.id) }}
                      className="text-gray-300 hover:text-red-500 transition"
                      title="Elimina sessione"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      )}

      {/* Data view (solo in modalita' lista) */}
      {!forceTableMode && selectedSessionId && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <StockTable sessionId={selectedSessionId} />
        </div>
      )}

      {/* Excel export modal */}
      {showExport && (
        <ExcelExportModal
          entity={entity}
          stockDate={sessions.find(s => s.id === selectedSessionId)?.stock_date}
          onClose={() => setShowExport(false)}
        />
      )}

      {/* Upload dialog */}
      {showUpload && (
        <StockUploadDialog
          entity={entity}
          existingDates={existingDates}
          onClose={() => setShowUpload(false)}
        />
      )}

      {/* Delete confirm */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6">
            <h3 className="text-base font-bold text-gray-800 mb-2">Elimina sessione</h3>
            <p className="text-sm text-gray-600 mb-5">Sei sicuro? Tutti i dati di questa sessione verranno eliminati permanentemente.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition">
                Annulla
              </button>
              <button
                onClick={() => deleteMutation.mutate(confirmDelete)}
                disabled={deleteMutation.isPending}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl text-sm transition disabled:opacity-50"
              >
                {deleteMutation.isPending ? "Eliminazione..." : "Elimina"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
