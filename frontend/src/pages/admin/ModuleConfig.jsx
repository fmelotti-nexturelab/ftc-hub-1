import React from "react"
import { useNavigate } from "react-router-dom"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { LogOut } from "lucide-react"
import { modulesApi } from "@/api/modules"

// User types che hanno accesso configurabile (SUPERUSER e ADMIN bypassano sempre)
const CONFIGURABLE_TYPES = [
  "HR", "FINANCE", "MARKETING", "IT", "COMMERCIAL",
  "MANAGER", "TOPMGR", "HEALTHSAFETY", "FACILITIES", "RETAIL",
  "DM", "STORE", "STOREMANAGER",
]

const TYPE_LABEL = {
  HR:           "HR",
  FINANCE:      "Fin.",
  MARKETING:    "Mktg",
  IT:           "IT",
  COMMERCIAL:   "Comm.",
  MANAGER:      "Mgr",
  TOPMGR:       "Top",
  HEALTHSAFETY: "H&S",
  FACILITIES:   "Fac.",
  RETAIL:       "Ret.",
  DM:           "DM",
  STORE:        "Store",
  STOREMANAGER: "SM",
}

function Toggle({ checked, onChange, disabled }) {
  return (
    <button
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={`w-3.5 h-3.5 rounded-full transition-colors
        ${checked ? "bg-emerald-500" : "bg-rose-400"}
        ${disabled ? "cursor-not-allowed" : "cursor-pointer hover:brightness-110"}`}
    />
  )
}

export default function ModuleConfig() {
  const navigate = useNavigate()
  const qc = useQueryClient()

  const { data: modules = [], isLoading: loadingModules } = useQuery({
    queryKey: ["admin-modules"],
    queryFn: () => modulesApi.listModules().then((r) => r.data.filter((m) => m.code !== "licenze")),
  })

  const { data: accessList = [], isLoading: loadingAccess } = useQuery({
    queryKey: ["admin-modules-access"],
    queryFn: () => modulesApi.getAllAccess().then((r) => r.data),
  })

  const updateAccess = useMutation({
    mutationFn: ({ department, module_code, can_view, can_manage }) =>
      modulesApi.updateAccess(department, module_code, { can_view, can_manage }),
    onSuccess: () => qc.invalidateQueries(["admin-modules-access"]),
  })

  // Crea una mappa { "department:module_code": { can_view, can_manage } }
  const accessMap = {}
  for (const a of accessList) {
    accessMap[`${a.department}:${a.module_code}`] = a
  }

  const getAccess = (department, module_code) =>
    accessMap[`${department}:${module_code}`] || { can_view: false, can_manage: false }

  const handleToggle = (department, module_code, field, value) => {
    const current = getAccess(department, module_code)
    const next = { ...current, [field]: value }
    // Se disabilito view, disabilito anche manage
    if (field === "can_view" && !value) next.can_manage = false
    // Se abilito manage, abilito anche view
    if (field === "can_manage" && value) next.can_view = true
    updateAccess.mutate({ department, module_code, ...next })
  }

  if (loadingModules || loadingAccess) {
    return <div className="py-16 text-center text-gray-400 text-sm">Caricamento...</div>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Accessi Moduli</h1>
          <p className="text-sm text-gray-600">Configura quali moduli sono accessibili per ogni tipo di utente.</p>
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
        <table style={{ fontSize: "11px", borderCollapse: "collapse" }} className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-2 py-2 text-left text-gray-600 font-semibold" style={{ width: "80px", minWidth: "80px" }}>Modulo</th>
              {CONFIGURABLE_TYPES.map((t) => (
                <th key={t} className="py-2 text-center text-gray-600 font-semibold" colSpan={2} style={{ minWidth: "44px" }}>
                  {TYPE_LABEL[t]}
                </th>
              ))}
            </tr>
            <tr className="bg-gray-50 border-b border-gray-200 text-gray-400" style={{ fontSize: "10px" }}>
              <th className="px-2 py-1" />
              {CONFIGURABLE_TYPES.map((t) => (
                <React.Fragment key={t}>
                  <th className="py-1 text-center font-normal pl-2" style={{ width: "22px" }}>V</th>
                  <th className="py-1 text-center font-normal pr-2" style={{ width: "22px" }}>G</th>
                </React.Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {modules.map((module) => (
              <tr
                key={module.code}
                className="border-b border-gray-100 last:border-0 odd:bg-white even:bg-gray-50/50"
              >
                <td
                  title={module.name}
                  className="px-2 py-1.5 text-gray-700 font-medium whitespace-nowrap"
                  style={{ width: "80px", maxWidth: "80px", overflow: "hidden", textOverflow: "ellipsis" }}
                >
                  {module.name}
                  {module.code === "licenze" && (
                    <span className="ml-1 text-[9px] bg-red-100 text-red-600 px-1 py-0.5 rounded font-bold">SU</span>
                  )}
                </td>
                {CONFIGURABLE_TYPES.map((department) => {
                  const access = getAccess(department, module.code)
                  const isLicenze = module.code === "licenze"
                  return (
                    <React.Fragment key={department}>
                      <td className="py-1.5 pl-2 text-center" style={{ width: "22px" }}>
                        <div className="flex justify-center">
                          <Toggle
                            checked={access.can_view}
                            onChange={(val) => handleToggle(department, module.code, "can_view", val)}
                            disabled={isLicenze || !module.has_view}
                          />
                        </div>
                      </td>
                      <td className="py-1.5 pr-2 text-center" style={{ width: "22px" }}>
                        <div className="flex justify-center">
                          <Toggle
                            checked={access.can_manage}
                            onChange={(val) => handleToggle(department, module.code, "can_manage", val)}
                            disabled={isLicenze || !module.has_manage || !access.can_view}
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
