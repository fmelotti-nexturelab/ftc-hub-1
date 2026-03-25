import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useMutation, useQuery } from "@tanstack/react-query"
import { LifeBuoy, AlertCircle, CheckCircle2, LogOut } from "lucide-react"
import { ticketsApi } from "@/api/tickets"
import RequesterFields from "@/components/shared/RequesterFields"
import ImageDropZone from "@/components/shared/ImageDropZone"
import TeamSelectModal from "@/components/shared/TeamSelectModal"

export default function TicketCreate() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    title: "",
    description: "",
    requester_name: "",
    requester_email: "",
    requester_phone: "",
  })
  const [images, setImages] = useState([])
  const [analysis, setAnalysis] = useState(null)
  const [aiError, setAiError] = useState("")
  const [successTicket, setSuccessTicket] = useState(null)

  // Carica i dati richiedente dal DB (usati come placeholder e fallback al submit)
  const { data: defaults } = useQuery({
    queryKey: ["ticket-requester-defaults"],
    queryFn: () => ticketsApi.requesterDefaults().then(r => r.data),
  })

  // Paste screenshot (Ctrl+V) — aggiunge all'array
  useEffect(() => {
    const handler = (e) => {
      for (const item of e.clipboardData?.items ?? []) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile()
          if (file) {
            setImages(prev => {
              const exists = prev.some(f => f.name === file.name && f.size === file.size)
              return exists ? prev : [...prev, file]
            })
            break
          }
        }
      }
    }
    document.addEventListener("paste", handler)
    return () => document.removeEventListener("paste", handler)
  }, [])

  // Step 1 — analisi AI
  const analyzeMutation = useMutation({
    mutationFn: () => ticketsApi.analyze(form.title, form.description).then(r => r.data),
    onSuccess: (data) => {
      if (!data.relevant) {
        setAiError(data.rejection_reason || "Richiesta non pertinente. Riformula il problema.")
      } else {
        setAiError("")
        setAnalysis(data)
      }
    },
    onError: () => {
      // AI non disponibile — apri modal con selezione manuale
      setAnalysis({ suggested_teams: [], enhanced_description: form.description })
    },
  })

  // Step 2 — creazione ticket dopo selezione team
  const createMutation = useMutation({
    mutationFn: async ({ teamId, tvCode }) => {
      const payload = {
        title: form.title,
        original_description: form.description,
        description: analysis?.enhanced_description || form.description,
        category_id: analysis?.category_id || 1,
        subcategory_id: analysis?.subcategory_id || null,
        priority: analysis?.priority || "medium",
        requester_name:  form.requester_name  || defaults?.name  || "",
        requester_email: form.requester_email || defaults?.email || null,
        requester_phone: form.requester_phone || defaults?.phone || "",
        teamviewer_code: tvCode || "",
        team_id: teamId || null,
      }
      const res = await ticketsApi.create(payload)
      for (const img of images) {
        await ticketsApi.uploadAttachment(res.data.id, img)
      }
      return res.data
    },
    onSuccess: (ticket) => {
      setAnalysis(null)
      setSuccessTicket(ticket)
    },
  })

  useEffect(() => {
    if (!successTicket) return
    const t = setTimeout(() => navigate("/tickets"), 2000)
    return () => clearTimeout(t)
  }, [successTicket, navigate])

  const set = (field, value) => setForm(f => ({ ...f, [field]: value }))

  const effectiveName  = form.requester_name  || defaults?.name
  const effectivePhone = form.requester_phone || defaults?.phone
  const valid = form.title && form.description && effectiveName && effectivePhone

  return (
    <div className="max-w-2xl space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-[#1e3a5f]/10 rounded-xl flex items-center justify-center">
            <LifeBuoy size={18} className="text-[#1e3a5f]" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-800">Nuovo Ticket</h1>
            <p className="text-xs text-gray-400 mt-0.5">Apri una richiesta di assistenza</p>
          </div>
        </div>
        <button
          onClick={() => navigate("/tickets")}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition"
        >
          <LogOut size={15} aria-hidden="true" />
          Esci
        </button>
      </div>

      {/* Popup errore AI */}
      {aiError && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-start gap-3">
              <AlertCircle size={22} className="text-red-500 shrink-0 mt-0.5" />
              <div>
                <h2 className="text-sm font-bold text-gray-800 mb-1">Richiesta non accettata</h2>
                <p className="text-sm text-gray-600">{aiError}</p>
              </div>
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => setAiError("")}
                className="bg-[#1e3a5f] hover:bg-[#2563eb] text-white text-sm font-semibold px-5 py-2 rounded-xl transition"
              >
                Ok, riprovo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Popup successo creazione */}
      {successTicket && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 size={22} className="text-green-500 shrink-0 mt-0.5" />
              <div>
                <h2 className="text-sm font-bold text-gray-800 mb-1">
                  Ticket n° {successTicket.ticket_number}
                </h2>
                <p className="text-sm text-green-600 font-semibold">CREATO CON SUCCESSO</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Popup errore creazione */}
      {createMutation.isError && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-start gap-3">
              <AlertCircle size={22} className="text-red-500 shrink-0 mt-0.5" />
              <div>
                <h2 className="text-sm font-bold text-gray-800 mb-1">Errore</h2>
                <p className="text-sm text-gray-600">Errore durante la creazione del ticket. Riprova.</p>
              </div>
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => createMutation.reset()}
                className="bg-[#1e3a5f] hover:bg-[#2563eb] text-white text-sm font-semibold px-5 py-2 rounded-xl transition"
              >
                Ok
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-5">

        <RequesterFields values={form} onChange={set} defaults={defaults} />

        <hr className="border-gray-100" />

        {/* ── Dettagli richiesta ── */}
        <div>
          <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Dettagli richiesta</div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Titolo *</label>
              <input
                type="text"
                value={form.title}
                onChange={e => set("title", e.target.value)}
                placeholder="Descrivi brevemente il problema"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2563eb] focus:border-transparent outline-none transition"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Descrizione *</label>
              <textarea
                value={form.description}
                onChange={e => set("description", e.target.value)}
                placeholder="Descrivi il problema in dettaglio..."
                rows={4}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2563eb] focus:border-transparent outline-none transition resize-none"
              />
            </div>
          </div>
        </div>

        <hr className="border-gray-100" />

        {/* ── Screenshot / Foto ── */}
        <div>
          <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Screenshot / Foto <span className="font-normal normal-case text-gray-300">(opzionale)</span>
          </div>
          <ImageDropZone multiple images={images} onImages={setImages} />
        </div>

        <div className="flex justify-end gap-3 pt-1">
          <button type="button" onClick={() => navigate("/tickets")}
            className="px-4 py-2.5 rounded-xl text-sm text-gray-500 hover:bg-gray-100 transition">
            Annulla
          </button>
          <button
            onClick={() => { setAiError(""); analyzeMutation.mutate() }}
            disabled={!valid || analyzeMutation.isPending}
            className="bg-[#1e3a5f] hover:bg-[#2563eb] disabled:opacity-40 text-white font-semibold py-2.5 px-6 rounded-xl shadow transition"
          >
            {analyzeMutation.isPending ? "Analisi in corso..." : "Apri ticket"}
          </button>
        </div>
      </div>

      {analysis && !createMutation.isSuccess && (
        <TeamSelectModal
          analysis={analysis}
          onSelect={(args) => createMutation.mutate(args)}
          onClose={() => setAnalysis(null)}
          isPending={createMutation.isPending}
        />
      )}
    </div>
  )
}
