import { useState } from "react"
import { Settings, FolderOpen, RefreshCw, Unlink, CheckCircle, AlertCircle, Check, Search } from "lucide-react"
import { useStockFolder } from "@/hooks/useStockFolder"
import { useFolderConnect } from "@/hooks/useFolderConnect"
import { useAuthStore } from "@/store/authStore"

const STOCK_DEPTS = ["SUPERUSER", "ADMIN", "IT"]

function FolderRow({ label, hint, folderKey }) {
  const { folderName, isSupported, isConnected, connect, disconnect } = useFolderConnect(folderKey)

  if (!isSupported) return null

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-3">
        <span className="text-sm font-semibold text-gray-700 shrink-0">{label}</span>
        <div className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 flex-1 min-w-0 ${isConnected ? "bg-green-50 border-green-200" : "bg-gray-50 border-gray-200"}`}>
          <FolderOpen size={14} className={isConnected ? "text-green-600" : "text-gray-400"} />
          <span className="text-xs font-medium text-gray-700 truncate flex-1">
            {isConnected ? folderName || "Cartella collegata" : "Nessuna cartella collegata"}
          </span>
          {isConnected ? (
            <button onClick={disconnect} className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 border border-red-200 rounded px-1.5 py-0.5 hover:bg-red-50 transition shrink-0">
              <Unlink size={11} />
              Disconnetti
            </button>
          ) : (
            <button onClick={connect} className="flex items-center gap-1 text-xs bg-[#1e3a5f] hover:bg-[#2563eb] text-white font-semibold rounded px-2 py-0.5 transition shrink-0">
              <FolderOpen size={11} />
              Collega
            </button>
          )}
        </div>
      </div>
      {hint && <p className="text-[11px] text-gray-400 leading-relaxed">{hint}</p>}
    </div>
  )
}

function StockFolderSettings() {
  const { folderName, isSupported, isConnected, connect, disconnect, importNow, importing, lastResult } = useStockFolder()

  if (!isSupported) return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-xs text-amber-700">
      Il tuo browser non supporta la File System Access API. Usa Chrome o Edge.
    </div>
  )

  return (
    <div className="space-y-1.5">
      {/* Riga unica: titolo | box verde | importa ora */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-semibold text-gray-700 shrink-0">OneItaly Stores/Files/00 - Estrazioni</span>

        {/* Box stato cartella */}
        <div className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 flex-1 min-w-0 ${isConnected ? "bg-green-50 border-green-200" : "bg-gray-50 border-gray-200"}`}>
          <FolderOpen size={14} className={isConnected ? "text-green-600" : "text-gray-400"} />
          <span className="text-xs font-medium text-gray-700 truncate flex-1">
            {isConnected ? folderName || "Cartella collegata" : "Nessuna cartella collegata"}
          </span>
          {isConnected ? (
            <button onClick={disconnect} className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 border border-red-200 rounded px-1.5 py-0.5 hover:bg-red-50 transition shrink-0">
              <Unlink size={11} />
              Disconnetti
            </button>
          ) : (
            <button onClick={connect} className="flex items-center gap-1 text-xs bg-[#1e3a5f] hover:bg-[#2563eb] text-white font-semibold rounded px-2 py-0.5 transition shrink-0">
              <FolderOpen size={11} />
              Collega
            </button>
          )}
        </div>

        {/* Importa ora */}
        {isConnected && (
          <button
            onClick={importNow}
            disabled={importing}
            className="flex items-center gap-1.5 text-sm border border-gray-200 rounded-lg px-3 py-1.5 text-gray-600 hover:bg-gray-50 hover:text-gray-800 transition disabled:opacity-50 shrink-0"
          >
            <RefreshCw size={14} className={importing ? "animate-spin" : ""} />
            {importing ? "Importazione..." : "Importa ora"}
          </button>
        )}

        {/* Risultato import */}
        {lastResult && (
          lastResult.error ? (
            <div className="flex items-center gap-1.5 text-xs text-red-600 shrink-0">
              <AlertCircle size={13} />
              {lastResult.error}
            </div>
          ) : (
            <div className="flex flex-col gap-0.5 shrink-0">
              <div className="flex items-center gap-1.5 text-xs text-green-600">
                <CheckCircle size={13} />
                {lastResult.count === 0 ? "Nessun file importato" : `${lastResult.count} file importati`}
              </div>
              {lastResult.failed?.length > 0 && (
                <div className="flex items-center gap-1.5 text-xs text-red-500">
                  <AlertCircle size={13} />
                  Errore: {lastResult.failed.join(", ")}
                </div>
              )}
            </div>
          )
        )}
      </div>

      <p className="text-[11px] text-gray-400 leading-relaxed">
        Collega la cartella ZEBRA A S — ESTRAZIONI &nbsp;es: <span className="font-mono">C:\Users\nomeutente\Zebra A S\One Italy Stores - Files\00 - Estrazioni\</span>
      </p>
    </div>
  )
}

function NavisionFolderSetting() {
  const [folder, setFolder] = useState(() => localStorage.getItem("navision_rdp_folder") || "")
  const [saved, setSaved]   = useState(false)

  function save() {
    const trimmed = folder.trim()
    setFolder(trimmed)
    localStorage.setItem("navision_rdp_folder", trimmed)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <div className="space-y-1.5">
      <label htmlFor="nav-rdp-folder" className="block text-sm font-semibold text-gray-700">
        Cartella file RDP
      </label>
      <div className="flex gap-2">
        <div className="flex-1 flex border border-gray-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-[#2563eb] focus-within:border-transparent">
          <input
            id="nav-rdp-folder"
            type="text"
            value={folder}
            onChange={(e) => { setFolder(e.target.value); setSaved(false) }}
            onKeyDown={(e) => e.key === "Enter" && save()}
            placeholder="es. C:\Users\nomeutente\OneDrive - Zebra A S\01 - NAVISION"
            className="flex-1 text-sm font-mono px-3 py-1.5 outline-none bg-white"
          />
          {"showDirectoryPicker" in window && (
            <button
              type="button"
              onClick={async () => {
                try {
                  const handle = await window.showDirectoryPicker({ mode: "read" })
                  setFolder(handle.name)
                  setSaved(false)
                } catch (e) {
                  if (e.name !== "AbortError") console.error(e)
                }
              }}
              title="Sfoglia cartelle"
              aria-label="Sfoglia cartelle"
              className="px-2.5 border-l border-gray-300 text-gray-400 hover:text-[#1e3a5f] hover:bg-gray-50 transition"
            >
              <FolderOpen size={15} aria-hidden="true" />
            </button>
          )}
        </div>
        <button
          onClick={save}
          aria-label="Salva cartella RDP"
          className={`flex items-center gap-1.5 text-sm px-4 py-1.5 font-semibold rounded-lg transition ${
            saved ? "bg-green-500 text-white" : "bg-[#1e3a5f] hover:bg-[#2563eb] text-white"
          }`}
        >
          {saved && <Check size={13} aria-hidden="true" />}
          {saved ? "Salvato" : "Salva"}
        </button>
      </div>
      <p className="text-[11px] text-gray-400 leading-relaxed">
        Percorso completo della cartella con i file .rdp — es:{" "}
        <span className="font-mono">C:\Users\nomeutente\OneDrive - Zebra A S\01 - NAVISION</span>
      </p>
    </div>
  )
}


export default function SettingsPage() {
  const { user, canView } = useAuthStore()

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-[#1e3a5f]/10 rounded-xl flex items-center justify-center">
          <Settings size={18} className="text-[#1e3a5f]" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-800">Impostazioni</h1>
          <p className="text-xs text-gray-400 mt-0.5">Configurazione applicazione</p>
        </div>
      </div>

      {canView("navision") && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h2 className="text-sm font-bold text-gray-700 mb-4">Navision</h2>
          <NavisionFolderSetting />
        </div>
      )}

      {STOCK_DEPTS.includes(user?.department) && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-5">
          <h2 className="text-sm font-bold text-gray-700">Cartelle Stock</h2>
          <StockFolderSettings />
          <div className="border-t border-gray-100" />
          <FolderRow
            folderKey="stock_folder_commercial"
            label="One Italy Commercial - Files"
            hint={`Cartella COMMERCIAL — es: C:\\Users\\nomeutente\\Zebra A S\\One Italy Commercial - Files\\`}
          />
          <div className="border-t border-gray-100" />
          <FolderRow
            folderKey="ftchub_storage"
            label="FTC HUB Storage"
            hint={`Cartella archivio locale FTC HUB — es: D:\\ftchub_data\\`}
          />
        </div>
      )}

    </div>
  )
}
