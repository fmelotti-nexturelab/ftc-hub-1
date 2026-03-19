import { useState, useRef, useEffect, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { useMutation, useQuery } from "@tanstack/react-query"
import { LifeBuoy, AlertCircle, Upload, X } from "lucide-react"
import { ticketsApi } from "@/api/tickets"


function ImageDropZone({ image, onImage, onRemove }) {
  const [dragging, setDragging] = useState(false)
  const fileInputRef = useRef(null)

  const previewUrl = useMemo(() => image ? URL.createObjectURL(image) : null, [image])

  const processFile = (file) => {
    if (!file || !file.type.startsWith("image/")) return
    if (file.size > 5 * 1024 * 1024) return
    onImage(file)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    processFile(e.dataTransfer.files[0])
  }

  if (image) {
    return (
      <div>
        <div className="relative rounded-lg border border-gray-200 overflow-hidden bg-gray-50">
          <img
            src={previewUrl}
            alt="Preview allegato"
            className="w-full max-h-52 object-contain"
          />
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
      className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition select-none ${
        dragging
          ? "border-[#2563eb] bg-blue-50"
          : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
      }`}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => processFile(e.target.files[0])}
      />
      <div className="flex flex-col items-center gap-2 text-gray-400 pointer-events-none">
        <Upload size={22} />
        <div className="text-sm">
          <span className="text-[#2563eb] font-medium">Clicca per caricare</span>
          {" "}o trascina qui
        </div>
        <div className="text-xs">Puoi anche incollare uno screenshot (Ctrl+V)</div>
        <div className="text-xs text-gray-300">PNG, JPG, GIF, WebP — max 5 MB</div>
      </div>
    </div>
  )
}

export default function TicketCreate() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    title: "",
    description: "",
    priority: "",
    requester_name: "",
    requester_email: "",
    requester_phone: "",
    teamviewer_code: "",
  })
  const [image, setImage] = useState(null)
  const [analysis, setAnalysis] = useState(null)   // risultato AI: { suggested_teams, enhanced_description, ... }
  const [aiError, setAiError] = useState("")        // messaggio rifiuto AI

  const { data: defaults } = useQuery({
    queryKey: ["ticket-requester-defaults"],
    queryFn: () => ticketsApi.requesterDefaults().then(r => r.data),
    staleTime: Infinity,
  })
  useEffect(() => {
    if (!defaults) return
    setForm(f => ({
      ...f,
      requester_name: f.requester_name || defaults.name || "",
      requester_email: f.requester_email || defaults.email || "",
    }))
  }, [defaults])

  useEffect(() => {
    const handler = (e) => {
      const items = e.clipboardData?.items
      if (!items) return
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile()
          if (file) { setImage(file); break }
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
      // AI non disponibile — apri modal con team vuoti (selezione manuale)
      setAnalysis({ suggested_teams: [], enhanced_description: form.description })
    },
  })

  // Step 2 — creazione ticket dopo selezione team
  const createMutation = useMutation({
    mutationFn: async (teamId) => {
      const payload = {
        title: form.title,
        description: analysis?.enhanced_description || form.description,
        category_id: analysis?.category_id || 1,
        subcategory_id: analysis?.subcategory_id || null,
        priority: analysis?.priority || form.priority || "medium",
        requester_name: form.requester_name,
        requester_email: form.requester_email || null,
        requester_phone: form.requester_phone,
        teamviewer_code: form.teamviewer_code,
        team_id: teamId || null,
      }
      const res = await ticketsApi.create(payload)
      if (image) await ticketsApi.uploadAttachment(res.data.id, image)
      return res.data
    },
    onSuccess: (ticket) => navigate(`/tickets/${ticket.id}`),
  })

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  const valid =
    form.title &&
    form.description &&
    form.requester_name &&
    form.requester_phone &&
    form.teamviewer_code

  return (
    <div className="max-w-2xl space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-[#1e3a5f]/10 rounded-xl flex items-center justify-center">
          <LifeBuoy size={18} className="text-[#1e3a5f]" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-800">Nuovo Ticket</h1>
          <p className="text-xs text-gray-400 mt-0.5">Apri una richiesta di assistenza</p>
        </div>
      </div>

      {aiError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm flex items-center gap-2">
          <AlertCircle size={15} className="shrink-0" />
          {aiError}
        </div>
      )}

      {createMutation.isError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm flex items-center gap-2">
          <AlertCircle size={15} />
          Errore durante la creazione del ticket.
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-5">

        {/* ── Dati richiedente ── */}
        <div>
          <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Dati richiedente</div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Nome richiedente *</label>
              <input type="text" value={form.requester_name} onChange={set("requester_name")}
                placeholder="Nome e Cognome"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2563eb] focus:border-transparent outline-none transition" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Recapito telefonico *</label>
              <input type="tel" value={form.requester_phone} onChange={set("requester_phone")}
                placeholder="+39 ..."
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2563eb] focus:border-transparent outline-none transition" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Email richiedente <span className="font-normal text-gray-400 text-xs">(opzionale)</span>
              </label>
              <input type="email" value={form.requester_email} onChange={set("requester_email")}
                placeholder="es. mario.rossi@email.com"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2563eb] focus:border-transparent outline-none transition" />
            </div>
          </div>
          <div className="mt-4">
            <label className="block text-sm font-semibold text-gray-700 mb-1">Codice TeamViewer *</label>
            <input type="text" value={form.teamviewer_code} onChange={set("teamviewer_code")}
              placeholder="Es. 123 456 789"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2563eb] focus:border-transparent outline-none transition font-mono tracking-wider" />
          </div>
        </div>

        <hr className="border-gray-100" />

        {/* ── Dettagli richiesta ── */}
        <div>
          <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Dettagli richiesta</div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Titolo *</label>
              <input type="text" value={form.title} onChange={set("title")}
                placeholder="Descrivi brevemente il problema"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2563eb] focus:border-transparent outline-none transition" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Descrizione *</label>
              <textarea value={form.description} onChange={set("description")}
                placeholder="Descrivi il problema in dettaglio..."
                rows={4}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2563eb] focus:border-transparent outline-none transition resize-none" />
            </div>
          </div>
        </div>

        <hr className="border-gray-100" />

        {/* ── Screenshot / Foto ── */}
        <div>
          <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Screenshot / Foto <span className="font-normal normal-case text-gray-300">(opzionale)</span>
          </div>
          <ImageDropZone image={image} onImage={setImage} onRemove={() => setImage(null)} />
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

      {/* Modal selezione team */}
      {analysis && !createMutation.isSuccess && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-5">
            <div>
              <h2 className="text-base font-bold text-gray-800">A chi vuoi inviare il ticket?</h2>
              <p className="text-xs text-gray-400 mt-1">Seleziona il team di destinazione</p>
            </div>

            <div className="flex flex-wrap gap-2">
              {analysis.suggested_teams?.length > 0
                ? analysis.suggested_teams.map(team => (
                    <button
                      key={team.id}
                      onClick={() => createMutation.mutate(team.id)}
                      disabled={createMutation.isPending}
                      className="px-4 py-2 bg-[#1e3a5f] hover:bg-[#2563eb] text-white text-sm font-semibold rounded-xl transition disabled:opacity-50"
                    >
                      {team.name}
                    </button>
                  ))
                : <p className="text-sm text-gray-400">Nessun team suggerito. Seleziona manualmente.</p>
              }
            </div>

            <div className="flex items-center justify-between pt-1">
              <button
                onClick={() => setAnalysis(null)}
                className="text-xs text-gray-400 hover:text-gray-600 transition"
              >
                ← Modifica
              </button>
              {createMutation.isPending && (
                <span className="text-xs text-gray-400">Creazione in corso...</span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
