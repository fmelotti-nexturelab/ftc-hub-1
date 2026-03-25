import React from "react"
import { useNavigate } from "react-router-dom"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { LogOut } from "lucide-react"
import { modulesApi } from "@/api/modules"

const CONFIGURABLE_TYPES = ["HR", "FINANCE", "MARKETING", "IT", "COMMERCIAL", "DM", "STORE", "STOREMANAGER", "RETAIL"]

const TYPE_LABEL = {
  HR:           "HR",
  FINANCE:      "Finance",
  MARKETING:    "Mktg",
  IT:           "IT",
  COMMERCIAL:   "Comm.",
  DM:           "DM",
  STORE:        "Store",
  STOREMANAGER: "StoreMgr",
  RETAIL:       "Retail",
}

const UTILITY_TABLES = [
  { code: "utilities_stores", name: "Info Stores" },
]

function Toggle({ checked, onChange, disabled }) {
  return (
    <button
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={`w-12 h-5 rounded-full transition-colors relative ${
        checked ? "bg-emerald-500" : "bg-rose-400"
      } ${disabled ? "opacity-25 cursor-not-allowed" : "cursor-pointer hover:brightness-110"}`}
    >
      <span
        className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all duration-200 ${
          checked ? "right-0.5" : "left-0.5"
        }`}
      />
      <span
        className={`absolute inset-0 flex items-center text-white font-bold select-none transition-all duration-200 ${
          checked ? "justify-start pl-1.5" : "justify-end pr-1.5"
        }`}
        style={{ fontSize: "8px", letterSpacing: "0.03em" }}
      >
        {checked ? "ON" : "OFF"}
      </span>
    </button>
  )
}

export default function UtilitiesConfig() {
  const navigate = useNavigate()
  const qc = useQueryClient()

  const { data: accessList = [], isLoading } = useQuery({
    queryKey: ["admin-modules-access"],
    queryFn: () => modulesApi.getAllAccess().then((r) => r.data),
  })

  const updateAccess = useMutation({
    mutationFn: ({ department, module_code, can_view, can_manage }) =>
      modulesApi.updateAccess(department, module_code, { can_view, can_manage }),
    onSuccess: () => qc.invalidateQueries(["admin-modules-access"]),
  })

  const accessMap = {}
  for (const a of accessList) {
    accessMap[`${a.department}:${a.module_code}`] = a
  }

  const getAccess = (department, module_code) =>
    accessMap[`${department}:${module_code}`] || { can_view: false, can_manage: false }

  const handleToggle = (department, module_code, field, value) => {
    const current = getAccess(department, module_code)
    const next = { ...current, [field]: value }
    if (field === "can_view" && !value) next.can_manage = false
    if (field === "can_manage" && value) next.can_view = true
    updateAccess.mutate({ department, module_code, ...next })
  }

  if (isLoading) {
    return <div className="py-16 text-center text-gray-400 text-sm">Caricamento...</div>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Accessi Utilities</h1>
          <p className="text-sm text-gray-600">Configura quali tabelle sono visibili per ogni tipo di utente.</p>
        </div>
        <button
          onClick={() => navigate("/utilities")}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition"
        >
          <LogOut size={15} />
          Esci
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
        <table className="text-xs w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-4 py-3 text-left text-gray-600 font-semibold w-40">Tabella</th>
              {CONFIGURABLE_TYPES.map((t) => (
                <th key={t} className="px-2 py-3 text-center text-gray-600 font-semibold" colSpan={2}>
                  {TYPE_LABEL[t]}
                </th>
              ))}
            </tr>
            <tr className="bg-gray-50 border-b border-gray-200 text-gray-400">
              <th className="px-4 py-2" />
              {CONFIGURABLE_TYPES.map((t) => (
                <React.Fragment key={t}>
                  <th className="px-2 py-1 text-center font-normal">Visualizza</th>
                  <th className="px-2 py-1 text-center font-normal">Gestisci</th>
                </React.Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {UTILITY_TABLES.map((table) => (
              <tr
                key={table.code}
                className="border-b border-gray-100 last:border-0 odd:bg-white even:bg-gray-50/50"
              >
                <td className="px-4 py-2.5 text-gray-700 font-medium whitespace-nowrap">
                  {table.name}
                </td>
                {CONFIGURABLE_TYPES.map((department) => {
                  const access = getAccess(department, table.code)
                  return (
                    <React.Fragment key={department}>
                      <td className="px-2 py-2.5 text-center">
                        <div className="flex justify-center">
                          <Toggle
                            checked={access.can_view}
                            onChange={(val) => handleToggle(department, table.code, "can_view", val)}
                            disabled={false}
                          />
                        </div>
                      </td>
                      <td className="px-2 py-2.5 text-center">
                        <div className="flex justify-center">
                          <Toggle
                            checked={access.can_manage}
                            onChange={(val) => handleToggle(department, table.code, "can_manage", val)}
                            disabled={!access.can_view}
                          />
                        </div>
                      </td>
                    </React.Fragment>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-400">
        <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 mr-1" /> Abilitato &nbsp;|&nbsp;
        <span className="inline-block w-2 h-2 rounded-full bg-rose-400 mr-1 ml-1" /> Disabilitato
      </p>
    </div>
  )
}
