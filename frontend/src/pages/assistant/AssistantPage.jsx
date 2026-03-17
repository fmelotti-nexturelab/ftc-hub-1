import { useState, useRef, useEffect } from "react"
import { Send, Bot, User, AlertCircle, Sparkles } from "lucide-react"
import { useAuthStore } from "@/store/authStore"

const API_BASE = "/api/assistant/chat"

function MessageBubble({ msg }) {
  const isUser = msg.role === "user"
  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      {/* Avatar */}
      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
        isUser ? "bg-[#1e3a5f]" : "bg-gray-100"
      }`}>
        {isUser
          ? <User size={14} className="text-white" />
          : <Bot size={14} className="text-[#1e3a5f]" />
        }
      </div>

      {/* Testo */}
      <div className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
        isUser
          ? "bg-[#1e3a5f] text-white rounded-tr-sm"
          : "bg-gray-100 text-gray-800 rounded-tl-sm"
      }`}>
        {msg.content || (
          <span className="flex gap-1 items-center text-gray-400">
            <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]" />
            <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]" />
            <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]" />
          </span>
        )}
      </div>
    </div>
  )
}

export default function AssistantPage() {
  const { accessToken } = useAuthStore()
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [unavailable, setUnavailable] = useState(false)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const sendMessage = async () => {
    const text = input.trim()
    if (!text || loading) return

    const userMsg = { role: "user", content: text }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput("")
    setLoading(true)

    // Invia solo gli ultimi 4 messaggi (2 scambi: domanda+risposta x2)
    const contextMessages = newMessages.slice(-4)

    // Placeholder risposta assistente
    setMessages(prev => [...prev, { role: "assistant", content: "" }])

    try {
      const resp = await fetch(API_BASE, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ messages: contextMessages }),
      })

      if (resp.status === 503) {
        setUnavailable(true)
        setMessages(prev => prev.slice(0, -1)) // rimuove placeholder
        setLoading(false)
        return
      }

      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}`)
      }

      const reader = resp.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() // ultima riga potrebbe essere incompleta

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue
          const data = line.slice(6).trim()
          if (data === "[DONE]") break

          try {
            const parsed = JSON.parse(data)
            if (parsed.error) {
              setMessages(prev => {
                const updated = [...prev]
                updated[updated.length - 1] = { role: "assistant", content: `⚠️ ${parsed.error}` }
                return updated
              })
            } else if (parsed.text) {
              setMessages(prev => {
                const updated = [...prev]
                updated[updated.length - 1] = {
                  role: "assistant",
                  content: (updated[updated.length - 1].content || "") + parsed.text,
                }
                return updated
              })
            }
          } catch {}
        }
      }
    } catch (err) {
      setMessages(prev => {
        const updated = [...prev]
        updated[updated.length - 1] = {
          role: "assistant",
          content: "⚠️ Errore di connessione. Riprova tra qualche istante.",
        }
        return updated
      })
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)]">
      {/* Header */}
      <div className="mb-4">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold text-gray-800">Assistente FTC HUB</h1>
          <span className="flex items-center gap-1 text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">
            <Sparkles size={10} /> AI
          </span>
        </div>
        <p className="text-xs text-gray-400 mt-0.5">Fai domande su come usare il sistema</p>
      </div>

      {/* Non disponibile */}
      {unavailable && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-3 mb-4">
          <AlertCircle size={16} className="text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-700">Assistente non ancora attivo</p>
            <p className="text-xs text-amber-600 mt-0.5">
              L'API key Anthropic non è ancora configurata. Contatta l'amministratore di sistema per attivare il servizio.
            </p>
          </div>
        </div>
      )}

      {/* Area messaggi */}
      <div className="flex-1 bg-white rounded-xl border border-gray-200 shadow-sm overflow-y-auto p-5 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <div className="w-14 h-14 bg-[#1e3a5f]/8 rounded-2xl flex items-center justify-center mb-4">
              <Bot size={26} className="text-[#1e3a5f]" />
            </div>
            <p className="text-gray-700 font-semibold mb-1">Come posso aiutarti?</p>
            <p className="text-xs text-gray-400 max-w-xs">
              Puoi chiedermi come funziona il sistema, come configurare utenti e permessi, come usare i ticket e molto altro.
            </p>
            <div className="mt-5 flex flex-wrap gap-2 justify-center">
              {[
                "Come creo un nuovo utente?",
                "Perché un utente non vede le categorie ticket?",
                "Come funziona il sistema RBAC?",
                "Come importo i dati da Navision?",
              ].map(q => (
                <button
                  key={q}
                  onClick={() => { setInput(q); inputRef.current?.focus() }}
                  className="text-xs bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-600 px-3 py-1.5 rounded-lg transition"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg, i) => <MessageBubble key={i} msg={msg} />)
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="mt-3 flex gap-2">
        <textarea
          ref={inputRef}
          rows={1}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Scrivi una domanda… (Invio per inviare, Shift+Invio per andare a capo)"
          disabled={loading || unavailable}
          className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#2563eb] focus:border-transparent outline-none transition text-sm resize-none disabled:opacity-50 disabled:bg-gray-50"
          style={{ minHeight: "48px", maxHeight: "120px" }}
        />
        <button
          onClick={sendMessage}
          disabled={!input.trim() || loading || unavailable}
          className="px-4 py-3 bg-[#1e3a5f] hover:bg-[#2563eb] text-white rounded-xl transition disabled:opacity-40 shrink-0"
        >
          <Send size={16} />
        </button>
      </div>
      <p className="text-[10px] text-gray-300 text-center mt-1.5">
        Risposte generate da AI — verifica sempre le informazioni critiche
      </p>
    </div>
  )
}
