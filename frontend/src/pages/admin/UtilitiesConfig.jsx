import React from "react"
import { useNavigate } from "react-router-dom"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { LogOut } from "lucide-react"
import { modulesApi } from "@/api/modules"

const CONFIGURABLE_TYPES = [
  "HR", "FINANCE", "MARKETING", "IT", "COMMERCIAL",
  "MANAGER", "TOPMGR", "HEALTHSAFETY", "FACILITIES", "RETAIL",
  "DM", "STORE", "STOREMANAGER",
]

const TYPE_LABEL = {
  HR:           "HR",
  FINANCE:      "Finance",
  MARKETING:    "Mktg",
  IT:           "IT",
  COMMERCIAL:   "Comm.",
  MANAGER:      "Mgr",
  TOPMGR:       "Top",
  HEALTHSAFETY: "H&S",
  FACILITIES:   "Fac.",
  RETAIL:       "Retail",
  DM:           "DM",
  STORE:        "Store",
  STOREMANAGER: "StoreMgr",
}

const UTILITY_TABLES = [
  { code: "utilities_stores",    name: "Info Stores",  module: "utilities_stores" },
  { code: "utilities_sales",     name: "Sales Data",   module: "utilities_sales" },
  { code: "utilities_stock_nav", name: "Stock NAV",    module: "utilities_stock_nav" },
  { code: "items_view",          name: "ItemList",     module: "items_view" },
  { code: "ordini",              name: "Ordini",       module: "ordini" },
  { code: "check_prezzi",        name: "Check Prezzi", module: "check_prezzi" },
]

function Toggle({ checked, onChange, disabled }) {
  return (
    <button
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={`text-[10px] font-bold leading-none transition-colors
        ${checked ? "text-emerald-600 hover:text-emerald-800" : "text-rose-500 hover:text-rose-700"}
        ${disabled ? "opacity-30 cursor-not-allowed" : "cursor-pointer"}`}
    >
      {checked ? "ON" : "OFF"}
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
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition"
        >
          <LogOut size={15} aria-hidden="true" />
          Esci
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
        <table className="text-xs w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th scope="col" className="px-4 py-3 text-left text-gray-600 font-semibold w-40">Tabella</th>
              {CONFIGURABLE_TYPES.map((t) => (
                <th scope="col" key={t} className="px-2 py-3 text-center text-gray-600 font-semibold" colSpan={2}>
                  {TYPE_LABEL[t]}
                </th>
              ))}
            </tr>
            <tr className="bg-gray-50 border-b border-gray-200 text-gray-400">
              <th scope="col" className="px-4 py-2" />
              {CONFIGURABLE_TYPES.map((t) => (
                <React.Fragment key={t}>
                  <th scope="col" className="px-2 py-1 text-center font-normal">Visualizza</th>
                  <th scope="col" className="px-2 py-1 text-center font-normal">Gestisci</th>
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
                <td className="px-4 py-2.5 whitespace-nowrap">
                  <div className="text-gray-700 font-medium">{table.name}</div>
                  <div className="text-[10px] text-gray-400 font-normal">{table.module}</div>
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

      <p className="text-xs text-gray-400 flex items-center gap-2">
        <span className="text-[10px] font-bold text-emerald-600">ON</span> Abilitato
        <span className="mx-1">|</span>
        <span className="text-[10px] font-bold text-rose-500">OFF</span> Disabilitato
      </p>
    </div>
  )
}
