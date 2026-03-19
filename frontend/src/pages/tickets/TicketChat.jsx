import { useState, useRef, useEffect } from "react"
import { useMutation } from "@tanstack/react-query"
import { Send, Paperclip, X, Loader2, CheckCircle2 } from "lucide-react"
import { ticketsApi } from "@/api/tickets"
import { useAuthStore } from "@/store/authStore"
import TicketPriorityBadge from "@/components/tickets/TicketPriorityBadge"

const PRIORITY_LABELS = { low: "Bassa", medium: "Media", high: "Alta", critical: "Critica" }

export default function TicketChat({ onCreated }) {
  const { user } = useAuthStore()
  const bottomRef = useRef(null)
  const fileInputRef = useRef(null)

  const firstName = user?.full_name?.split(" ")[0] || user?.username || ""

  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: `Ciao ${firstName}. Helpdesk IT. Descrivi il problema.`,
    },
  ])
  const [input, setInput] = useState("")
  const [attachment, setAttachment] = useState(null) // { file, preview }
  const [ticketData, setTicketData] = useState(null)  // dati estratti quando complete=true
  const [confirmed, setConfirmed] = useState(false)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const chatMutation = useMutation({
    mutationFn: (msgs) => ticketsApi.chat(msgs).then(r => r.data),
    onSuccess: (data) => {
      setMessages(prev => [...prev, { role: "assistant", content: data.reply }])
      if (data.complete) {
        setTicketData(data.ticket_data)
      }
    },
  })

  const createMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        title: ticketData.title,
        description: ticketData.description,
        category_id: ticketData.category_id,
        subcategory_id: ticketData.subcategory_id || undefined,
        priority: ticketData.priority,
        requester_name: user?.full_name || user?.username || "",
        requester_phone: ticketData.requester_phone || "",
        teamviewer_code: ticketData.teamviewer_code || "",
      }
      const res = await ticketsApi.create(payload)
      const ticket = res.data

      if (attachment?.file) {
        await ticketsApi.uploadAttachment(ticket.id, attachment.file)
      }

      return ticket
    },
    onSuccess: (ticket) => {
      setConfirmed(true)
      setTimeout(() => onCreated(ticket.id), 1500)
    },
  })

  const sendMessage = () => {
    const text = input.trim()
    if (!text || chatMutation.isPending) return

    const newMessages = [...messages, { role: "user", content: text }]
    setMessages(newMessages)
    setInput("")

    // Invia solo role+content (senza il messaggio iniziale di sistema)
    const apiMessages = newMessages.map(m => ({ role: m.role, content: m.content }))
    chatMutation.mutate(apiMessages)
  }

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const handleFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const preview = file.type.startsWith("image/") ? URL.createObjectURL(file) : null
    setAttachment({ file, preview })
  }

  const removeAttachment = () => {
    if (attachment?.preview) URL.revokeObjectURL(attachment.preview)
    setAttachment(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  if (confirmed) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-green-600">
        <CheckCircle2 size={48} />
        <p className="text-lg font-semibold">Ticket creato con successo!</p>
        <p className="text-sm text-gray-400">Reindirizzamento in corso...</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100vh-160px)] max-w-2xl mx-auto">

      {/* Messaggi */}
      <div className="flex-1 overflow-y-auto space-y-4 py-4 px-1">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            {m.role === "assistant" && (
              <div className="w-7 h-7 rounded-full bg-[#1e3a5f] text-white text-[10px] font-black flex items-center justify-center mr-2 mt-1 shrink-0">
                IT
              </div>
            )}
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                m.role === "user"
                  ? "bg-[#1e3a5f] text-white rounded-br-sm"
                  : "bg-white border border-gray-200 text-gray-800 rounded-bl-sm shadow-sm"
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}

        {chatMutation.isPending && (
          <div className="flex justify-start">
            <div className="w-7 h-7 rounded-full bg-[#1e3a5f] text-white text-[10px] font-black flex items-center justify-center mr-2 shrink-0">
                IT
              </div>
            <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
              <Loader2 size={16} className="animate-spin text-gray-400" />
            </div>
          </div>
        )}

        {/* Preview ticket pronto */}
        {ticketData && !confirmed && (
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 space-y-3">
            <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider">Riepilogo ticket</p>
            <div className="space-y-1.5 text-sm">
              <div><span className="font-semibold text-gray-700">Titolo:</span> <span className="text-gray-800">{ticketData.title}</span></div>
              <div><span className="font-semibold text-gray-700">Categoria:</span> <span className="text-gray-600">ID {ticketData.category_id}{ticketData.subcategory_id ? ` / ${ticketData.subcategory_id}` : ""}</span></div>
              <div className="flex items-center gap-2"><span className="font-semibold text-gray-700">Priorità:</span> <TicketPriorityBadge priority={ticketData.priority} /></div>
              <div><span className="font-semibold text-gray-700">Descrizione:</span> <span className="text-gray-600">{ticketData.description}</span></div>
              {ticketData.requester_phone && <div><span className="font-semibold text-gray-700">Telefono:</span> <span className="text-gray-600">{ticketData.requester_phone}</span></div>}
              {ticketData.teamviewer_code && <div><span className="font-semibold text-gray-700">TeamViewer:</span> <span className="font-mono text-gray-600">{ticketData.teamviewer_code}</span></div>}
            </div>

            {/* Allegato */}
            {attachment ? (
              <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2">
                {attachment.preview
                  ? <img src={attachment.preview} className="h-10 w-10 object-cover rounded" alt="" />
                  : <Paperclip size={14} className="text-gray-400" />
                }
                <span className="text-xs text-gray-600 truncate flex-1">{attachment.file.name}</span>
                <button onClick={removeAttachment} className="text-gray-400 hover:text-red-500 transition"><X size={14} /></button>
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 text-xs text-blue-600 hover:text-blue-800 transition"
              >
                <Paperclip size={13} /> Aggiungi allegato (opzionale)
              </button>
            )}
            <input ref={fileInputRef} type="file" accept="image/*,.pdf" className="hidden" onChange={handleFile} />

            <button
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending}
              className="w-full bg-[#1e3a5f] hover:bg-[#2563eb] text-white font-semibold py-2.5 rounded-xl transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {createMutation.isPending ? <><Loader2 size={16} className="animate-spin" /> Creazione in corso...</> : "Conferma e crea ticket"}
            </button>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      {!ticketData && (
        <div className="border-t border-gray-200 pt-3 pb-1">
          <div className="flex items-end gap-2 bg-white border border-gray-300 rounded-2xl px-4 py-2 focus-within:ring-2 focus-within:ring-[#2563eb] focus-within:border-transparent transition">
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Scrivi qui..."
              rows={1}
              className="flex-1 resize-none outline-none text-sm text-gray-800 placeholder-gray-400 max-h-32 bg-transparent"
              style={{ height: "auto" }}
              ref={el => {
                if (el) {
                  el.style.height = "auto"
                  el.style.height = Math.min(el.scrollHeight, 128) + "px"
                }
              }}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || chatMutation.isPending}
              className="p-2 rounded-xl bg-[#1e3a5f] hover:bg-[#2563eb] text-white transition disabled:opacity-40 shrink-0"
            >
              <Send size={15} />
            </button>
          </div>
          <p className="text-[10px] text-gray-300 text-center mt-1.5">Invio con ↵ · Nuova riga con Shift+↵</p>
        </div>
      )}
    </div>
  )
}
