import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Paperclip, FileText, Image, X, Download, ZoomIn } from "lucide-react"
import { ticketsApi } from "@/api/tickets"

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function ImageLightbox({ src, filename, onClose }) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="relative max-w-5xl max-h-full" onClick={e => e.stopPropagation()}>
        <button
          onClick={onClose}
          className="absolute -top-10 right-0 text-white/70 hover:text-white transition flex items-center gap-1.5 text-sm"
        >
          <X size={16} /> Chiudi
        </button>
        <img
          src={src}
          alt={filename}
          className="max-w-full max-h-[85vh] rounded-xl shadow-2xl object-contain"
        />
        <p className="text-white/50 text-xs text-center mt-2">{filename}</p>
      </div>
    </div>
  )
}

function AttachmentItem({ attachment }) {
  const [blobUrl, setBlobUrl] = useState(null)
  const [loading, setLoading] = useState(false)
  const [lightbox, setLightbox] = useState(false)

  const isImage = attachment.mime_type.startsWith("image/")
  const isPdf = attachment.mime_type === "application/pdf"

  const loadBlob = async () => {
    if (blobUrl) return blobUrl
    setLoading(true)
    try {
      const res = await ticketsApi.fetchAttachmentBlob(attachment.id)
      const url = URL.createObjectURL(res.data)
      setBlobUrl(url)
      return url
    } finally {
      setLoading(false)
    }
  }

  const handleView = async () => {
    const url = await loadBlob()
    if (isImage) {
      setLightbox(true)
    } else if (isPdf) {
      window.open(url, "_blank")
    }
  }

  const handleDownload = async () => {
    const url = blobUrl || await loadBlob()
    const a = document.createElement("a")
    a.href = url
    a.download = attachment.filename
    a.click()
  }

  return (
    <>
      {lightbox && blobUrl && (
        <ImageLightbox
          src={blobUrl}
          filename={attachment.filename}
          onClose={() => setLightbox(false)}
        />
      )}

      <div className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 bg-gray-50 hover:bg-gray-100 transition group">
        {/* Icona tipo file */}
        <div className="w-9 h-9 rounded-lg bg-white border border-gray-200 flex items-center justify-center shrink-0 shadow-sm">
          {isImage
            ? <Image size={16} className="text-blue-500" />
            : <FileText size={16} className="text-red-500" />
          }
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-700 truncate">{attachment.filename}</p>
          <p className="text-xs text-gray-500">{formatSize(attachment.file_size)}</p>
        </div>

        {/* Preview thumbnail per immagini */}
        {isImage && blobUrl && (
          <img
            src={blobUrl}
            alt={attachment.filename}
            className="w-12 h-12 rounded object-cover border border-gray-200 shrink-0 cursor-pointer"
            onClick={() => setLightbox(true)}
          />
        )}

        {/* Azioni */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
          <button
            onClick={handleView}
            disabled={loading}
            title={isImage ? "Visualizza" : "Apri PDF"}
            className="p-1.5 rounded-lg hover:bg-white border border-transparent hover:border-gray-200 text-gray-500 hover:text-[#1e3a5f] transition disabled:opacity-40"
          >
            {loading ? (
              <span className="w-4 h-4 border-2 border-gray-300 border-t-[#2563eb] rounded-full animate-spin block" />
            ) : (
              <ZoomIn size={15} />
            )}
          </button>
          <button
            onClick={handleDownload}
            disabled={loading}
            title="Scarica"
            className="p-1.5 rounded-lg hover:bg-white border border-transparent hover:border-gray-200 text-gray-500 hover:text-[#1e3a5f] transition disabled:opacity-40"
          >
            <Download size={15} />
          </button>
        </div>
      </div>
    </>
  )
}

export default function TicketAttachments({ ticketId }) {
  const { data: attachments = [], isLoading } = useQuery({
    queryKey: ["ticket-attachments", ticketId],
    queryFn: () => ticketsApi.listAttachments(ticketId).then(r => r.data),
  })

  if (isLoading) return null

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
      <h2 className="font-semibold text-gray-800 text-sm mb-3 flex items-center gap-2">
        <Paperclip size={14} className="text-gray-400" />
        Allegati
        {attachments.length > 0 && (
          <span className="text-xs font-normal text-gray-500">({attachments.length})</span>
        )}
      </h2>

      {attachments.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-3">Nessun allegato.</p>
      ) : (
        <div className="space-y-2">
          {attachments.map(a => (
            <AttachmentItem key={a.id} attachment={a} />
          ))}
        </div>
      )}
    </div>
  )
}
