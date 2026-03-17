import { useState } from "react"
import { Send, Lock } from "lucide-react"

export default function TicketCommentForm({ onSubmit, isManager, isPending }) {
  const [content, setContent] = useState("")
  const [isInternal, setIsInternal] = useState(false)

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!content.trim()) return
    onSubmit({ content: content.trim(), is_internal: isInternal })
    setContent("")
    setIsInternal(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <textarea
        value={content}
        onChange={e => setContent(e.target.value)}
        placeholder="Scrivi un commento..."
        rows={3}
        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2563eb] focus:border-transparent outline-none transition text-sm resize-none"
      />
      <div className="flex items-center justify-between">
        {isManager ? (
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
        ) : (
          <span />
        )}
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
