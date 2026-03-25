import { useRef, useState } from "react"
import { Send, Lock, Paperclip, X, Lightbulb } from "lucide-react"

export default function TicketCommentForm({ onSubmit, isManager, isPending }) {
  const [content, setContent] = useState("")
  const [isInternal, setIsInternal] = useState(false)
  const [isSolution, setIsSolution] = useState(false)
  const [file, setFile] = useState(null)
  const fileRef = useRef(null)

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!content.trim()) return
    onSubmit({ content: content.trim(), is_internal: isInternal, is_solution: isSolution, file: file ?? undefined })
    setContent("")
    setIsInternal(false)
    setIsSolution(false)
    setFile(null)
  }

  const handleFile = (e) => {
    const f = e.target.files?.[0]
    if (f) setFile(f)
    e.target.value = ""
  }

  const handlePaste = (e) => {
    const item = Array.from(e.clipboardData?.items ?? []).find(i => i.type.startsWith("image/"))
    if (item) {
      const f = item.getAsFile()
      if (f) {
        // Rinomina con timestamp per chiarezza
        const ext = f.type.split("/")[1] || "png"
        const renamed = new File([f], `screenshot_${Date.now()}.${ext}`, { type: f.type })
        setFile(renamed)
      }
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <textarea
        value={content}
        onChange={e => setContent(e.target.value)}
        onPaste={handlePaste}
        placeholder="Scrivi un commento... (puoi incollare uno screenshot con Ctrl+V)"
        rows={3}
        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2563eb] focus:border-transparent outline-none transition text-sm resize-none"
      />

      {file && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700">
          <Paperclip size={12} className="shrink-0" />
          <span className="truncate flex-1">{file.name}</span>
          <button
            type="button"
            onClick={() => setFile(null)}
            className="shrink-0 hover:text-blue-900 transition"
          >
            <X size={13} />
          </button>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            title="Allega file"
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-[#1e3a5f] transition"
          >
            <Paperclip size={14} />
            Allega
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp,application/pdf"
            onChange={handleFile}
            className="hidden"
          />
          {isManager && (
            <>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isInternal}
                  onChange={e => setIsInternal(e.target.checked)}
                  className="rounded border-gray-300 text-[#2563eb] focus:ring-[#2563eb]"
                />
                <Lock size={13} className="text-gray-400" />
                <span className="text-xs text-gray-500">Nota interna</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isSolution}
                  onChange={e => setIsSolution(e.target.checked)}
                  className="rounded border-gray-300 text-violet-500 focus:ring-violet-400"
                />
                <Lightbulb size={13} className={isSolution ? "text-violet-500" : "text-gray-400"} />
                <span className={`text-xs ${isSolution ? "text-violet-600 font-medium" : "text-gray-500"}`}>Soluzione</span>
              </label>
            </>
          )}
        </div>
        <button
          type="submit"
          disabled={!content.trim() || isPending}
          className="flex items-center gap-2 bg-[#1e3a5f] hover:bg-[#2563eb] disabled:opacity-40 text-white px-4 py-2 rounded-lg text-sm font-semibold transition"
        >
          <Send size={14} />
          {isPending ? "Invio..." : "Commenta"}
        </button>
      </div>
    </form>
  )
}
