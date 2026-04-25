import { useNavigate, useSearchParams } from "react-router-dom"
import { BarChart3, Package, ShoppingCart, LogOut, Database, ChevronRight, List, Ban, Store, Building2 } from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import { utilitiesApi } from "@/api/utilities"
import NavEntityLauncher from "@/components/shared/NavEntityLauncher"

// Ogni group ha un moduleCode: visibile solo se can_manage è ON per quel modulo
// (generare = operazione di gestione, non solo visualizzazione)
// I group con desc array vengono renderizzati come lista puntata dentro la card.
const GROUPS = [
  {
    id: "entity-it01",
    moduleCode: "utilities_stock_nav",
    icon: Store,
    color: "bg-blue-500",
    label: "IT01",
    desc: ["Retail Sales Analysis", "Check Prices", "Stock Nav IT01"],
    items: [
      { path: "/ho/sales/it01", icon: BarChart3, color: "bg-blue-500", label: "Retail Sales Analysis", desc: "Vendite giornaliere IT01" },
      { path: "/utilities/genera-tabelle/check-prezzi?entity=IT01", icon: List, color: "bg-teal-500", label: "Check Prices", desc: "Check cambio prezzi" },
      { path: "/utilities/genera-tabelle/stock?entity=IT01", icon: Package, color: "bg-amber-500", label: "Stock Nav IT01", desc: "Stock giornaliero IT01" },
    ],
  },
  {
    id: "entity-it02",
    moduleCode: "utilities_stock_nav",
    icon: Store,
    color: "bg-emerald-500",
    label: "IT02",
    desc: ["Retail Sales Analysis", "Check Prices", "Stock Nav IT02"],
    items: [
      { path: "/ho/sales/it02", icon: BarChart3, color: "bg-emerald-500", label: "Retail Sales Analysis", desc: "Vendite giornaliere IT02" },
      { path: "/utilities/genera-tabelle/check-prezzi?entity=IT02", icon: List, color: "bg-teal-500", label: "Check Prices", desc: "Check cambio prezzi" },
      { path: "/utilities/genera-tabelle/stock?entity=IT02", icon: Package, color: "bg-amber-500", label: "Stock Nav IT02", desc: "Stock giornaliero IT02" },
    ],
  },
  {
    id: "entity-it03",
    moduleCode: "utilities_stock_nav",
    icon: Store,
    color: "bg-violet-500",
    label: "IT03",
    desc: ["Retail Sales Analysis", "Check Prices", "Stock Nav IT03"],
    items: [
      { path: "/ho/sales/it03", icon: BarChart3, color: "bg-violet-500", label: "Retail Sales Analysis", desc: "Vendite giornaliere IT03" },
      { path: "/utilities/genera-tabelle/check-prezzi?entity=IT03", icon: List, color: "bg-teal-500", label: "Check Prices", desc: "Check cambio prezzi" },
      { path: "/utilities/genera-tabelle/stock?entity=IT03", icon: Package, color: "bg-amber-500", label: "Stock Nav IT03", desc: "Stock giornaliero IT03" },
    ],
  },
  {
    id: "sales-report",
    moduleCode: "utilities_sales",
    icon: BarChart3,
    color: "bg-[#1e3a5f]",
    label: "Report Retail Sales Analysis",
    desc: "Report aggregato per entity",
    directPath: "/ho/sales/report",
    items: [],
  },
  {
    id: "item-list",
    moduleCode: "items_view",
    icon: List,
    color: "bg-teal-500",
    label: "Anagrafe Articoli",
    desc: "Genera tbl_ItemM da ITEM LIST NAV",
    directPath: "/utilities/genera-tabelle/item-list",
    items: [],
  },
  {
    id: "stock",
    moduleCode: "utilities_stock_nav",
    icon: Package,
    color: "bg-amber-500",
    label: "STOCK - Analisi & Estrazioni",
    desc: "Operazioni cross-entity: Genera tutti, StockSplit, Estrai ADM",
    directPath: "/utilities/genera-tabelle/stock",
    items: [],
  },
  {
    id: "anagrafe-negozi",
    moduleCode: "utilities_stores",
    icon: Building2,
    color: "bg-sky-500",
    label: "Anagrafe Negozi",
    desc: "Gestione della tabella Info Stores, assegnazioni negozi - SM - DM",
    directPath: "/utilities/stores",
    items: [],
  },
  {
    id: "orders",
    moduleCode: "ordini",
    icon: ShoppingCart,
    color: "bg-orange-500",
    label: "Ordini",
    desc: "Genera tabelle ordini",
    soon: true,
    items: [],
  },
]

export default function GeneraTabelle() {
  const navigate = useNavigate()
  // activeGroup e' derivato dalla URL: cosi' il drill-down viene preservato
  // quando si naviga verso una pagina figlia (es. /ho/sales/it01) e si torna
  // indietro via navigate(-1). Ogni cambio di drill-down push una nuova entry
  // nella history.
  const [searchParams, setSearchParams] = useSearchParams()
  const activeGroup = searchParams.get("group") || null
  function setActiveGroup(id) {
    setSearchParams(id ? { group: id } : {})
  }
  const { data: access } = useQuery({
    queryKey: ["utilities-my-access"],
    queryFn: () => utilitiesApi.getMyAccess().then((r) => r.data),
  })

  // Mostra la card se: soon (coming soon), nessun moduleCode (sempre visibile), oppure can_manage=ON
  const visibleGroups = GROUPS.filter(({ soon, moduleCode }) => {
    if (soon) return true
    if (!moduleCode) return true
    return access?.[moduleCode]?.can_manage === true
  })

  const group = visibleGroups.find((g) => g.id === activeGroup)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-[#1e3a5f]/10 rounded-xl flex items-center justify-center">
          <Database size={18} className="text-[#1e3a5f]" />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-800">Genera Tabelle</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {group ? group.label : "Genera le tabelle per i tool"}
          </p>
        </div>
        {(() => {
          // Nei drill-down degli entity group il pulsante "Esci" porta direttamente
          // alla pagina precedente nella history (bypass Genera Tabelle).
          // Negli altri drill-down resta "Indietro" che collassa il drill-down.
          const isEntityGroup = group && group.id.startsWith("entity-")
          if (group && !isEntityGroup) {
            return (
              <button
                onClick={() => setActiveGroup(null)}
                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition"
              >
                <LogOut size={15} aria-hidden="true" />
                Indietro
              </button>
            )
          }
          return (
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition"
            >
              <LogOut size={15} aria-hidden="true" />
              Esci
            </button>
          )
        })()}
      </div>

      {/* Breadcrumb */}
      {group && (
        <div className="flex items-center gap-1.5 text-xs text-gray-400">
          <button onClick={() => setActiveGroup(null)} className="hover:text-gray-600 transition">
            Genera Tabelle
          </button>
          <ChevronRight size={12} />
          <span className="text-gray-600 font-medium">{group.label}</span>
          {group.id.startsWith("entity-") && (
            <button
              onClick={() => navigate("/ho/sales/excluded")}
              className="ml-3 flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-800 border border-gray-200 rounded-lg px-2.5 py-1 hover:bg-gray-50 transition focus-visible:ring-2 focus-visible:ring-[#2563eb]"
            >
              <Ban size={12} aria-hidden="true" />
              Negozi Esclusi
            </button>
          )}
        </div>
      )}

      {/* Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {!group
          ? visibleGroups.map(({ id, icon: Icon, color, label, desc, soon, directPath }) => {
              const disabled = soon
              return (
                <button
                  key={id}
                  onClick={() => !disabled && (directPath ? navigate(directPath) : setActiveGroup(id))}
                  disabled={disabled}
                  className={`bg-white rounded-xl border border-gray-200 p-6 text-left shadow-sm hover:shadow-md transition-all
                    ${disabled ? "opacity-40 cursor-not-allowed" : "hover:border-[#2563eb] cursor-pointer"}`}
                >
                  <div className={`w-12 h-12 ${color} rounded-xl flex items-center justify-center mb-4`}>
                    <Icon className="text-white" size={22} aria-hidden="true" />
                  </div>
                  <div className="font-semibold text-gray-800">{label}</div>
                  {Array.isArray(desc) ? (
                    <ul className="text-sm text-gray-500 mt-1 space-y-0.5">
                      {desc.map((d, i) => (
                        <li key={i} className="flex gap-1.5">
                          <span className="text-gray-400">•</span>
                          <span>{d}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="text-sm text-gray-500 mt-1">{desc}</div>
                  )}
                  {soon && (
                    <span className="mt-2 inline-block text-xs bg-gray-100 text-gray-400 px-2 py-0.5 rounded">
                      Coming soon
                    </span>
                  )}
                </button>
              )
            })
          : group.items.map(({ path, icon: Icon, color, label, desc, soon }) => (
              <button
                key={path}
                onClick={() => !soon && navigate(path)}
                disabled={soon}
                className={`bg-white rounded-xl border border-gray-200 p-6 text-left shadow-sm hover:shadow-md transition-all
                  ${soon ? "opacity-50 cursor-not-allowed" : "hover:border-[#2563eb] cursor-pointer"}`}
              >
                <div className={`w-12 h-12 ${color} rounded-xl flex items-center justify-center mb-4`}>
                  <Icon className="text-white" size={22} aria-hidden="true" />
                </div>
                <div className="font-semibold text-gray-800">{label}</div>
                <div className="text-sm text-gray-500 mt-1">{desc}</div>
                {soon && (
                  <span className="mt-2 inline-block text-xs bg-gray-100 text-gray-400 px-2 py-0.5 rounded">
                    Coming soon
                  </span>
                )}
              </button>
            ))}
      </div>

      {/* RDP launcher per entity (solo nei drill-down IT01/IT02/IT03) */}
      {group && group.id.startsWith("entity-") && (
        <NavEntityLauncher env={group.label} />
      )}
    </div>
  )
}
