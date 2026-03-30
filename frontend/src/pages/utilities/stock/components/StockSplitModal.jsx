import { useState, useRef } from "react"
import { X, Download, Loader2, AlertCircle, CheckCircle, Mail } from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import { stockApi } from "@/api/stock"
import { StockCalendar, toDateStr } from "./StockCalendar"

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function StockSplitModal({ onClose }) {
  const today = new Date()
  const todayStr = toDateStr(today.getFullYear(), today.getMonth(), today.getDate())

  const [stockDate, setStockDate] = useState(todayStr)
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(null)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const blobRef = useRef(null)

  const { data: archiveDates } = useQuery({
    queryKey: ["archive-dates", "STOCK_NAV"],
    queryFn: async () => {
      const [r1, r2, r3] = await Promise.all([
        stockApi.getArchiveDates("STOCK_NAV", "IT01"),
        stockApi.getArchiveDates("STOCK_NAV", "IT02"),
        stockApi.getArchiveDates("STOCK_NAV", "IT03"),
      ])
      const s1 = new Set(r1.data.dates)
      const s2 = new Set(r2.data.dates)
      const s3 = new Set(r3.data.dates)
      return new Set([...s1].filter(d => s2.has(d) && s3.has(d)))
    },
    staleTime: 60_000,
  })

  function handleDateChange(d) {
    setStockDate(d)
    setError(null)
    setSuccess(null)
    setProgress(null)
  }

  async function handleGenera() {
    setLoading(true)
    setError(null)
    setSuccess(null)
    setProgress({ pct: 0, loaded: 0, total: 0 })
    try {
      const response = await stockApi.stockSplit(stockDate, (evt) => {
        const loaded = evt.loaded ?? 0
        const total = evt.total ?? 0
        setProgress({ pct: total > 0 ? Math.round((loaded / total) * 100) : null, loaded, total })
      })
      const blob = new Blob([response.data], { type: "text/csv;charset=utf-8;" })
      const filename = `${stockDate.replace(/-/g, "")} STOCK SPLIT.csv`
      blobRef.current = { blob, filename }
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      setSuccess({ filename, size: blob.size })
    } catch (e) {
      const raw = e.response?.data
      if (raw instanceof Blob) {
        try {
          const txt = await raw.text()
          const d = JSON.parse(txt)?.detail
          setError(d?.missing
            ? { message: `Stock non trovato per: ${d.missing.join(", ")}`, missing: true }
            : { message: typeof d === "string" ? d : e.message || "Errore imprevisto" })
        } catch { setError({ message: e.message || "Errore imprevisto" }) }
      } else {
        const d = raw?.detail
        setError(d?.missing
          ? { message: `Stock non trovato per: ${d.missing.join(", ")}`, missing: true }
          : { message: typeof d === "string" ? d : e.message || "Errore imprevisto" })
      }
    } finally {
      setLoading(false)
    }
  }

  function handleSendEmail() {
    const { blob, filename } = blobRef.current ?? {}
    if (!blob) return
    const displayDate = new Date(stockDate + "T00:00:00").toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric" })
    const subject = encodeURIComponent(`${stockDate.replace(/-/g, "")} Stock Split OneItaly fonte NAV`)
    const body = encodeURIComponent(`In allegato il file Stock Split del ${displayDate}.\n\nFile: ${filename} (${formatBytes(blob.size)})`)
    window.open(`mailto:?subject=${subject}&body=${body}`)
  }

  const displayDate = stockDate
    ? new Date(stockDate + "T00:00:00").toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric" })
    : "—"

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
          <div>
            <h3 className="text-base font-bold text-gray-800">StockSplit</h3>
            <p className="text-xs text-gray-400 mt-0.5">Esporta stock unificato IT01 · IT02 · IT03</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition"><X size={18} /></button>
        </div>

        <div className="px-6 pt-5 pb-3">
          <StockCalendar value={stockDate} onChange={handleDateChange} highlightedDates={archiveDates} />
        </div>

        <div className="px-6 pb-5 space-y-3">
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
            <span className="text-xs text-gray-400 shrink-0">Data selezionata:</span>
            <span className="text-xs font-semibold text-gray-800 capitalize">{displayDate}</span>
          </div>

          {loading && progress !== null && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span className="flex items-center gap-1.5">
                  <Loader2 size={11} className="animate-spin" />
                  {progress.pct !== null ? "Download in corso..." : "Preparazione file..."}
                </span>
                <span className="font-mono font-semibold text-gray-700">
                  {progress.pct !== null ? `${progress.pct}%` : progress.loaded > 0 ? formatBytes(progress.loaded) : ""}
                </span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                {progress.pct !== null
                  ? <div className="h-full bg-[#1e3a5f] rounded-full transition-all duration-300" style={{ width: `${progress.pct}%` }} />
                  : <div className="h-full w-1/3 bg-[#1e3a5f]/60 rounded-full animate-pulse" />}
              </div>
              {progress.total > 0 && (
                <p className="text-[11px] text-gray-400 text-right">{formatBytes(progress.loaded)} / {formatBytes(progress.total)}</p>
              )}
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 text-xs text-red-700">
              <AlertCircle size={13} className="shrink-0 mt-0.5" />
              <div>
                <p>{error.message}</p>
                {error.missing && <p className="mt-1 text-red-500">Carica prima i CSV mancanti tramite "Carica CSV" per ciascuna entity.</p>}
              </div>
            </div>
          )}

          {success && (
            <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-3 space-y-2.5">
              <div className="flex items-start gap-2 text-xs text-green-700">
                <CheckCircle size={13} className="shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">File scaricato con successo</p>
                  <p className="mt-0.5 font-mono text-green-600">{success.filename}</p>
                  <p className="mt-0.5 text-green-500">{formatBytes(success.size)}</p>
                </div>
              </div>
              <button onClick={handleSendEmail} className="w-full flex items-center justify-center gap-2 border border-green-300 bg-white hover:bg-green-50 text-green-700 font-semibold text-xs py-2 rounded-lg transition">
                <Mail size={13} />
                Invia per email
              </button>
              <p className="text-[10px] text-green-500">Apre il client email con oggetto e testo precompilati.</p>
            </div>
          )}

          <button
            onClick={handleGenera}
            disabled={loading || !stockDate}
            className="w-full flex items-center justify-center gap-2 bg-[#1e3a5f] hover:bg-[#2563eb] text-white font-semibold py-2.5 rounded-xl shadow transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading
              ? <><Loader2 size={15} className="animate-spin" />Generazione in corso...</>
              : <><Download size={15} />Genera CSV</>}
          </button>
        </div>
      </div>
    </div>
  )
}
