import { useState, useEffect, useMemo, useRef } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Settings, Save, Check, AlertCircle, FolderOpen, Loader2 } from "lucide-react"
import { navAgentApi } from "@/api/ho/navAgent"
import { useAuthStore } from "@/store/authStore"

const CONFIG_FIELDS = [
  {
    key: "agent_url",
    label: "URL NAV Agent",
    description: "Indirizzo dove gira nav_agent.py sul tuo PC. Il browser si connette direttamente a questo URL per aprire/chiudere sessioni RDP.",
    placeholder: "http://localhost:9999",
    span: 2,
  },
  {
    key: "rdp_base_path",
    label: "Cartella base RDP",
    description: "Percorso locale della cartella che contiene i file .rdp.",
    placeholder: "C:\\Users\\...\\01 - NAVISION",
    span: 2,
    browse: true,
  },
  {
    key: "rdp_it01_classic",
    label: "IT01 Classic — file RDP",
    description: "Nome del file .rdp relativo alla cartella base.",
    placeholder: "NAV IT01.rdp",
    span: 1,
  },
  {
    key: "rdp_it02_classic",
    label: "IT02 Classic — file RDP",
    description: "",
    placeholder: "NAV IT02.rdp",
    span: 1,
  },
  {
    key: "rdp_it02_new",
    label: "IT02 New — file RDP",
    description: "",
    placeholder: "NEW NAV IT02.rdp",
    span: 1,
  },
  {
    key: "rdp_it03_classic",
    label: "IT03 Classic — file RDP",
    description: "",
    placeholder: "NAV IT03.rdp",
    span: 1,
  },
  {
    key: "rdp_it03_new",
    label: "IT03 New — file RDP",
    description: "",
    placeholder: "NEW NAV IT03.rdp",
    span: 1,
  },
]

export default function NavAgentSettingsPage() {
  const { hasRole } = useAuthStore()
  const canEdit = hasRole("HO", "ADMIN")
  const queryClient = useQueryClient()
  const folderInputRef = useRef(null)

  const { data, isLoading, isError } = useQuery({
    queryKey: ["nav-agent-config"],
    queryFn: () => navAgentApi.getConfig().then(r => r.data),
    staleTime: 5 * 60 * 1000,
  })

  const [draft, setDraft] = useState({})
  const [browsingFolder, setBrowsingFolder] = useState(false)

  const agentUrl = useMemo(() => {
    if (!data?.items) return "http://localhost:9999"
    return data.items.find(i => i.config_key === "agent_url")?.config_value ?? "http://localhost:9999"
  }, [data])

  useEffect(() => {
    if (data?.items) {
      const map = {}
      data.items.forEach(item => { map[item.config_key] = item.config_value })
      setDraft(map)
    }
  }, [data])

  const isDirty = useMemo(() => {
    if (!data?.items) return false
    return data.items.some(item => draft[item.config_key] !== item.config_value)
  }, [draft, data])

  const mutation = useMutation({
    mutationFn: (updates) => navAgentApi.updateConfig(updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nav-agent-config"] })
    },
  })

  const handleBrowseFolder = async () => {
    setBrowsingFolder(true)
    try {
      const r = await fetch(agentUrl + "/browse-folder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      })
      const d = await r.json()
      if (d.ok && d.path) {
        setDraft(prev => ({ ...prev, rdp_base_path: d.path }))
      }
      // d.cancelled → utente ha chiuso il dialog, non fare nulla
    } catch {
      // Agent offline → fallback su <input webkitdirectory>
      folderInputRef.current?.click()
    } finally {
      setBrowsingFolder(false)
    }
  }

  const handleFolderInputChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    // webkitRelativePath = "NomeCartella/file.rdp" — estraiamo solo il nome cartella
    const folderName = file.webkitRelativePath?.split("/")?.[0] ?? ""
    if (folderName) {
      setDraft(prev => ({ ...prev, rdp_base_path: folderName }))
    }
    e.target.value = ""
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-400 text-sm">
        Caricamento impostazioni...
      </div>
    )
  }

  if (isError) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-red-700 text-sm flex items-center gap-2">
        <AlertCircle size={16} />
        Impossibile caricare le impostazioni. Verifica i permessi.
      </div>
    )
  }

  return (
    <div className="space-y-5 max-w-3xl">
      {/* input nascosto per fallback webkitdirectory */}
      <input
        ref={folderInputRef}
        type="file"
        // @ts-ignore
        webkitdirectory=""
        className="hidden"
        onChange={handleFolderInputChange}
      />

      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-[#1e3a5f]/10 rounded-xl flex items-center justify-center">
          <Settings size={18} className="text-[#1e3a5f]" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-800">Impostazioni NAV Agent</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Configurazione del servizio locale di connessione a Microsoft Dynamics NAV.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <div className="grid grid-cols-2 gap-x-5 gap-y-4">
          {CONFIG_FIELDS.map(({ key, label, description, placeholder, span, browse }) => (
            <div key={key} className={span === 2 ? "col-span-2" : ""}>
              <label className="block text-sm font-semibold text-gray-700 mb-0.5">{label}</label>
              {description && (
                <p className="text-xs text-gray-400 mb-1.5">{description}</p>
              )}
              {browse && canEdit ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={draft[key] ?? ""}
                    onChange={e => setDraft(d => ({ ...d, [key]: e.target.value }))}
                    placeholder={placeholder}
                    className="flex-1 px-3 py-2 text-sm font-mono border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2563eb] focus:border-transparent outline-none transition"
                  />
                  <button
                    type="button"
                    onClick={handleBrowseFolder}
                    disabled={browsingFolder}
                    title="Sfoglia cartella"
                    className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-600 hover:text-gray-800 transition disabled:opacity-40 cursor-pointer"
                  >
                    {browsingFolder
                      ? <Loader2 size={15} className="animate-spin" />
                      : <FolderOpen size={15} />
                    }
                  </button>
                </div>
              ) : (
                <input
                  type="text"
                  value={draft[key] ?? ""}
                  onChange={e => setDraft(d => ({ ...d, [key]: e.target.value }))}
                  disabled={!canEdit}
                  placeholder={placeholder}
                  className="w-full px-3 py-2 text-sm font-mono border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2563eb] focus:border-transparent outline-none transition disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed"
                />
              )}
            </div>
          ))}
        </div>

        {canEdit && (
          <div className="flex items-center justify-between mt-6 pt-5 border-t border-gray-100">
            <div className="text-xs text-gray-400">
              {isDirty ? "Modifiche non salvate" : "Nessuna modifica"}
            </div>
            <div className="flex items-center gap-3">
              {mutation.isSuccess && (
                <span className="text-xs text-green-600 flex items-center gap-1">
                  <Check size={13} /> Salvato
                </span>
              )}
              {mutation.isError && (
                <span className="text-xs text-red-600">Errore nel salvataggio</span>
              )}
              <button
                onClick={() => mutation.mutate(draft)}
                disabled={!isDirty || mutation.isPending}
                className="flex items-center gap-2 bg-[#1e3a5f] hover:bg-[#2563eb] disabled:opacity-40 text-white px-5 py-2.5 rounded-xl text-sm font-semibold shadow transition"
              >
                <Save size={15} />
                {mutation.isPending ? "Salvataggio..." : "Salva"}
              </button>
            </div>
          </div>
        )}

        {!canEdit && (
          <div className="mt-5 pt-4 border-t border-gray-100 text-xs text-gray-400">
            Solo visualizzazione — contatta un amministratore per modificare le impostazioni.
          </div>
        )}
      </div>
    </div>
  )
}
