import { useState, useRef } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Upload, X, FileText, AlertTriangle } from "lucide-react"
import { stockApi } from "@/api/stock"

const ENTITY_RE = /Stock-\d{4}-\d{2}-\d{2}-(IT0\d)\.csv/i

export default function StockUploadDialog({ entity, existingDates = [], onClose }) {
  const [file, setFile] = useState(null)
  const [detectedEntity, setDetectedEntity] = useState(entity)
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef(null)
  const qc = useQueryClient()

  const willOverwrite = file && existingDates.some((d) => file.name.includes(d))

  const mutation = useMutation({
    mutationFn: () => stockApi.uploadCsv(file, detectedEntity),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stock-sessions", entity] })
      qc.invalidateQueries({ queryKey: ["stock-stats"] })
      onClose()
    },
  })

  function handleFile(f) {
    setFile(f)
    const m = ENTITY_RE.exec(f.name)
    if (m) setDetectedEntity(m[1])
  }

  function handleDrop(e) {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-800">Carica CSV Stock {entity}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition">
            <X size={20} />
          </button>
        </div>

        {/* Dropzone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition
            ${dragging ? "border-[#2563eb] bg-blue-50" : "border-gray-300 hover:border-[#2563eb] hover:bg-gray-50"}`}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => e.target.files[0] && handleFile(e.target.files[0])}
          />
          {file ? (
            <div className="flex items-center justify-center gap-3">
              <FileText size={22} className="text-[#1e3a5f]" />
              <div className="text-left">
                <div className="text-sm font-semibold text-gray-800">{file.name}</div>
                <div className="text-xs text-gray-400">{(file.size / 1024 / 1024).toFixed(1)} MB</div>
              </div>
            </div>
          ) : (
            <div>
              <Upload size={28} className="mx-auto text-gray-300 mb-2" />
              <p className="text-sm text-gray-500">Trascina il file qui oppure <span className="text-[#2563eb] font-medium">clicca per selezionarlo</span></p>
              <p className="text-xs text-gray-400 mt-1">Solo file .csv (separatore `;`, encoding latin-1)</p>
            </div>
          )}
        </div>

        {/* Entity detected */}
        {file && (
          <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
            <span>Entity rilevata:</span>
            <span className="font-bold text-[#1e3a5f]">{detectedEntity}</span>
            {detectedEntity !== entity && (
              <span className="text-amber-600 font-medium">(diversa da {entity})</span>
            )}
          </div>
        )}

        {/* Overwrite warning */}
        {willOverwrite && (
          <div className="mt-3 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
            <AlertTriangle size={15} className="text-amber-500 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700">Esiste già una sessione per questa data. I dati esistenti verranno <strong>sovrascritti</strong>.</p>
          </div>
        )}

        {/* Error */}
        {mutation.isError && (
          <div className="mt-3 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700">
            {mutation.error?.response?.data?.detail || "Errore durante il caricamento"}
          </div>
        )}

        {/* Loading state */}
        {mutation.isPending && (
          <div className="mt-3 text-xs text-gray-500 text-center">Parsing e salvataggio in corso... (può richiedere qualche secondo)</div>
        )}

        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 px-4 py-2 border border-gray-300 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition">
            Annulla
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={!file || mutation.isPending}
            className="flex-1 px-4 py-2 bg-[#1e3a5f] hover:bg-[#2563eb] text-white font-semibold rounded-xl text-sm transition disabled:opacity-50"
          >
            {mutation.isPending ? "Caricamento..." : "Carica"}
          </button>
        </div>
      </div>
    </div>
  )
}
