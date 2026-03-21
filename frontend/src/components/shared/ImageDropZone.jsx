import { useState, useRef, useMemo } from "react"
import { Upload, X, Plus } from "lucide-react"

const MAX_SIZE = 5 * 1024 * 1024 // 5 MB

/**
 * ImageDropZone — upload immagine/i con drag & drop e paste (Ctrl+V).
 *
 * Props:
 *   multiple: bool (default false) — se true, gestisce una lista di file
 *
 * Modalità singola (multiple=false):
 *   image: File | null
 *   onImage: (file: File) => void
 *   onRemove: () => void
 *
 * Modalità multipla (multiple=true):
 *   images: File[]
 *   onImages: (files: File[]) => void   ← riceve la lista aggiornata
 */
export default function ImageDropZone({ multiple = false, image, onImage, onRemove, images = [], onImages }) {
  const [dragging, setDragging] = useState(false)
  const fileInputRef = useRef(null)

  // ── Modalità singola ────────────────────────────────────────────────────────
  const previewUrl = useMemo(() => image ? URL.createObjectURL(image) : null, [image])

  const processSingle = (file) => {
    if (!file || !file.type.startsWith("image/")) return
    if (file.size > MAX_SIZE) return
    onImage(file)
  }

  // ── Modalità multipla ───────────────────────────────────────────────────────
  const addFiles = (fileList) => {
    const valid = Array.from(fileList).filter(
      f => f.type.startsWith("image/") && f.size <= MAX_SIZE
    )
    if (!valid.length) return
    // deduplicazione per nome+size
    const existing = new Set(images.map(f => `${f.name}-${f.size}`))
    const news = valid.filter(f => !existing.has(`${f.name}-${f.size}`))
    if (news.length) onImages([...images, ...news])
  }

  const removeAt = (idx) => onImages(images.filter((_, i) => i !== idx))

  // ── Handlers comuni ─────────────────────────────────────────────────────────
  const handleDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    if (multiple) addFiles(e.dataTransfer.files)
    else processSingle(e.dataTransfer.files[0])
  }

  const handleChange = (e) => {
    if (multiple) addFiles(e.target.files)
    else processSingle(e.target.files[0])
    e.target.value = ""
  }

  const dropZoneClass = `border-2 border-dashed rounded-lg text-center cursor-pointer transition select-none ${
    dragging ? "border-[#2563eb] bg-blue-50" : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
  }`

  // ── Render singola ──────────────────────────────────────────────────────────
  if (!multiple) {
    if (image) {
      return (
        <div>
          <div className="relative rounded-lg border border-gray-200 overflow-hidden bg-gray-50">
            <img src={previewUrl} alt="Preview allegato" className="w-full max-h-52 object-contain" />
            <button
              type="button"
              onClick={onRemove}
              className="absolute top-2 right-2 w-7 h-7 bg-white rounded-full shadow border border-gray-200 flex items-center justify-center hover:bg-red-50 hover:border-red-300 transition"
            >
              <X size={13} className="text-gray-500" />
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-1.5">
            {image.name} &middot; {(image.size / 1024).toFixed(0)} KB
          </p>
        </div>
      )
    }

    return (
      <div
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onClick={() => fileInputRef.current?.click()}
        className={`${dropZoneClass} p-6`}
      >
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleChange} />
        <div className="flex flex-col items-center gap-2 text-gray-400 pointer-events-none">
          <Upload size={22} />
          <div className="text-sm">
            <span className="text-[#2563eb] font-medium">Clicca per caricare</span>{" "}o trascina qui
          </div>
          <div className="text-xs">Puoi anche incollare uno screenshot (Ctrl+V)</div>
          <div className="text-xs text-gray-300">PNG, JPG, GIF, WebP — max 5 MB</div>
        </div>
      </div>
    )
  }

  // ── Render multipla ─────────────────────────────────────────────────────────
  return (
    <div className="space-y-3">

      {/* Griglia preview */}
      {images.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {images.map((file, idx) => (
            <Thumb key={`${file.name}-${file.size}-${idx}`} file={file} onRemove={() => removeAt(idx)} />
          ))}
        </div>
      )}

      {/* Drop zone — compatta se ci sono già file, normale se vuota */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onClick={() => fileInputRef.current?.click()}
        className={`${dropZoneClass} ${images.length > 0 ? "py-3 px-4" : "p-6"}`}
      >
        <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleChange} />

        {images.length > 0 ? (
          <div className="flex items-center justify-center gap-2 text-gray-400 pointer-events-none">
            <Plus size={15} className="text-[#2563eb]" />
            <span className="text-sm"><span className="text-[#2563eb] font-medium">Aggiungi altri</span> o trascina qui</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-gray-400 pointer-events-none">
            <Upload size={22} />
            <div className="text-sm">
              <span className="text-[#2563eb] font-medium">Clicca per caricare</span>{" "}o trascina qui
            </div>
            <div className="text-xs">Puoi anche incollare uno screenshot (Ctrl+V)</div>
            <div className="text-xs text-gray-300">PNG, JPG, GIF, WebP — max 5 MB per file</div>
          </div>
        )}
      </div>
    </div>
  )
}

function Thumb({ file, onRemove }) {
  const url = useMemo(() => URL.createObjectURL(file), [file])

  return (
    <div className="relative group w-20 h-20 rounded-lg border border-gray-200 overflow-hidden bg-gray-50 shrink-0">
      <img src={url} alt={file.name} className="w-full h-full object-cover" />
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition" />
      <button
        type="button"
        onClick={onRemove}
        className="absolute top-1 right-1 w-5 h-5 bg-white rounded-full shadow border border-gray-200 flex items-center justify-center opacity-0 group-hover:opacity-100 transition hover:bg-red-50 hover:border-red-300"
      >
        <X size={10} className="text-gray-600" />
      </button>
      <p className="absolute bottom-0 left-0 right-0 text-[9px] text-white bg-black/40 px-1 py-0.5 truncate opacity-0 group-hover:opacity-100 transition">
        {file.name}
      </p>
    </div>
  )
}
