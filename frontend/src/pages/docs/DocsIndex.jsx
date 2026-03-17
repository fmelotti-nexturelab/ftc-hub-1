import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useAuthStore } from "@/store/authStore"
import { GUIDES } from "./docsConfig"
import { BookOpen, Shield, Users, LifeBuoy, BarChart2, ChevronRight, Globe } from "lucide-react"

const ICONS = { BookOpen, Shield, Users, LifeBuoy, BarChart2 }

const LANG_LABEL = { it: "IT", en: "EN" }

export default function DocsIndex() {
  const { user, hasRole } = useAuthStore()
  const navigate = useNavigate()
  const [lang, setLang] = useState(() => localStorage.getItem("ftc_docs_lang") || "it")

  const setLanguage = (l) => {
    setLang(l)
    localStorage.setItem("ftc_docs_lang", l)
  }

  const visibleGuides = GUIDES.filter(g => hasRole(...g.roles))

  const categories = [...new Set(visibleGuides.map(g => g.category[lang]))]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Guide & Manuali</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {lang === "it"
              ? "Documentazione operativa per l'utilizzo di FTC HUB"
              : "Operational documentation for FTC HUB usage"}
          </p>
        </div>

        {/* Selezione lingua */}
        <div className="flex items-center gap-2">
          <Globe size={14} className="text-gray-400" />
          <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs">
            {["it", "en"].map(l => (
              <button
                key={l}
                onClick={() => setLanguage(l)}
                className={`px-3 py-1.5 font-semibold transition ${
                  lang === l
                    ? "bg-[#1e3a5f] text-white"
                    : "bg-white text-gray-500 hover:bg-gray-50"
                }`}
              >
                {LANG_LABEL[l]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {visibleGuides.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center">
          <BookOpen size={32} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">
            {lang === "it"
              ? "Nessuna guida disponibile per il tuo profilo"
              : "No guides available for your profile"}
          </p>
        </div>
      ) : (
        categories.map(cat => {
          const guides = visibleGuides.filter(g => g.category[lang] === cat)
          return (
            <div key={cat}>
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 px-1">
                {cat}
              </h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {guides.map(guide => {
                  const Icon = ICONS[guide.icon] || BookOpen
                  return (
                    <button
                      key={guide.id}
                      onClick={() => navigate(`/docs/${guide.id}?lang=${lang}`)}
                      className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 text-left hover:border-[#1e3a5f]/30 hover:shadow-md transition-all group"
                    >
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-xl bg-[#1e3a5f]/8 flex items-center justify-center shrink-0 group-hover:bg-[#1e3a5f]/15 transition">
                          <Icon size={20} className="text-[#1e3a5f]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-gray-800 text-sm mb-1">
                            {guide.title[lang]}
                          </div>
                          <div className="text-xs text-gray-500 leading-relaxed">
                            {guide.description[lang]}
                          </div>
                          <div className="flex items-center gap-1 mt-3 text-xs text-[#1e3a5f] font-medium opacity-0 group-hover:opacity-100 transition">
                            {lang === "it" ? "Apri manuale" : "Open manual"}
                            <ChevronRight size={12} />
                          </div>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}
