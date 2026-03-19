import { useState, useRef, useEffect, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { LifeBuoy, AlertCircle, Info, Upload, X } from "lucide-react"
import { ticketsApi } from "@/api/tickets"
import { ticketConfigApi } from "@/api/ticketConfig"

const PRIORITIES = [
  { value: "low",      label: "Bassa" },
  { value: "medium",   label: "Media" },
  { value: "high",     label: "Alta" },
  { value: "critical", label: "Critica" },
]

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
    category_id: "",
    subcategory_id: "",
    priority: "",
    requester_name: "",
    requester_email: "",
    requester_phone: "",
    teamviewer_code: "",
  })

  // Pre-compila nome e email dal backend
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
  const [image, setImage] = useState(null)

  // Paste globale — cattura immagini da clipboard ovunque sulla pagina
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

  const { data: categories = [] } = useQuery({
    queryKey: ["ticket-categories"],
    queryFn: () => ticketConfigApi.getCategories().then(r => r.data),
  })

  const { data: subcategories = [] } = useQuery({
    queryKey: ["ticket-subcategories", form.category_id],
    queryFn: () => ticketConfigApi.getSubcategories(form.category_id).then(r => r.data),
    enabled: !!form.category_id,
  })

  const { data: routingPreview } = useQuery({
    queryKey: ["ticket-routing-preview", form.category_id, form.subcategory_id],
    queryFn: () =>
      ticketConfigApi
        .getRoutingPreview(form.category_id, form.subcategory_id || null)
        .then(r => r.data),
    enabled: !!form.category_id,
  })

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        title: form.title,
        description: form.description,
        category_id: parseInt(form.category_id),
        subcategory_id: form.subcategory_id ? parseInt(form.subcategory_id) : null,
        priority: form.priority,
        requester_name: form.requester_name,
        requester_email: form.requester_email || null,
        requester_phone: form.requester_phone,
        teamviewer_code: form.teamviewer_code,
      }
      const res = await ticketsApi.create(payload)
      if (image) {
        await ticketsApi.uploadAttachment(res.data.id, image)
      }
      return res
    },
    onSuccess: (res) => navigate(`/tickets/${res.data.id}`),
  })

  const set = (k) => (e) => {
    const value = e.target.value
    setForm(f => {
      const next = { ...f, [k]: value }
      if (k === "category_id") next.subcategory_id = ""
      return next
    })
  }

  const valid =
    form.title &&
    form.description &&
    form.category_id &&
    form.priority &&
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

      {mutation.isError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm flex items-center gap-2">
          <AlertCircle size={15} />
          Errore durante la creazione del ticket.
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-5">

        {/* ── Dati richiedente ── */}
        <div>
          <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Dati richiedente
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Nome richiedente *</label>
              <input
                type="text"
                value={form.requester_name}
                onChange={set("requester_name")}
                placeholder="Nome e Cognome"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2563eb] focus:border-transparent outline-none transition"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Recapito telefonico *</label>
              <input
                type="tel"
                value={form.requester_phone}
                onChange={set("requester_phone")}
                placeholder="+39 ..."
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2563eb] focus:border-transparent outline-none transition"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Email richiedente
                <span className="ml-1 font-normal text-gray-400 text-xs">(opzionale)</span>
              </label>
              <input
                type="email"
                value={form.requester_email}
                onChange={set("requester_email")}
                placeholder="es. mario.rossi@email.com"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2563eb] focus:border-transparent outline-none transition"
              />
            </div>
          </div>
          <div className="mt-4">
            <label className="block text-sm font-semibold text-gray-700 mb-1">Codice TeamViewer *</label>
            <input
              type="text"
              value={form.teamviewer_code}
              onChange={set("teamviewer_code")}
              placeholder="Es. 123 456 789"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2563eb] focus:border-transparent outline-none transition font-mono tracking-wider"
            />
          </div>
        </div>

        <hr className="border-gray-100" />

        {/* ── Dettagli richiesta ── */}
        <div>
          <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Dettagli richiesta
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Titolo *</label>
              <input
                type="text"
                value={form.title}
                onChange={set("title")}
                placeholder="Descrivi brevemente il problema"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2563eb] focus:border-transparent outline-none transition"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Categoria *</label>
                <select
                  value={form.category_id}
                  onChange={set("category_id")}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2563eb] focus:border-transparent outline-none transition bg-white"
                >
                  <option value="">Seleziona...</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Priorità *</label>
                <select
                  value={form.priority}
                  onChange={set("priority")}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2563eb] focus:border-transparent outline-none transition bg-white"
                >
                  <option value="">Seleziona...</option>
                  {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>
            </div>

            {form.category_id && subcategories.length > 0 && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Sottocategoria
                  <span className="ml-1 font-normal text-gray-400 text-xs">(opzionale)</span>
                </label>
                <select
                  value={form.subcategory_id}
                  onChange={set("subcategory_id")}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2563eb] focus:border-transparent outline-none transition bg-white"
                >
                  <option value="">Seleziona sottocategoria...</option>
                  {subcategories.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            )}

            {form.category_id && routingPreview?.team_name && (
              <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs text-blue-700">
                <Info size={14} className="shrink-0" />
                <span>
                  Questo ticket verrà assegnato a: <strong>{routingPreview.team_name}</strong>
                  {routingPreview.priority_override && (
                    <> — priorità impostata automaticamente a <strong>{routingPreview.priority_override}</strong></>
                  )}
                </span>
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Descrizione *</label>
              <textarea
                value={form.description}
                onChange={set("description")}
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
            Screenshot / Foto
            <span className="ml-2 font-normal normal-case text-gray-300">(opzionale)</span>
          </div>
          <ImageDropZone
            image={image}
            onImage={setImage}
            onRemove={() => setImage(null)}
          />
        </div>

        <div className="flex justify-end gap-3 pt-1">
          <button
            type="button"
            onClick={() => navigate("/tickets")}
            className="px-4 py-2.5 rounded-xl text-sm text-gray-500 hover:bg-gray-100 transition"
          >
            Annulla
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={!valid || mutation.isPending}
            className="bg-[#1e3a5f] hover:bg-[#2563eb] disabled:opacity-40 text-white font-semibold py-2.5 px-6 rounded-xl shadow transition"
          >
            {mutation.isPending ? "Apertura..." : "Apri ticket"}
          </button>
        </div>
      </div>
    </div>
  )
}
