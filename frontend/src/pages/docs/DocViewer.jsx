import { useState, useMemo } from "react"
import { useParams, useSearchParams, useNavigate, Navigate } from "react-router-dom"
import { useAuthStore } from "@/store/authStore"
import { GUIDES } from "./docsConfig"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { ArrowLeft, Printer, Globe } from "lucide-react"

// Carica tutti i file markdown al compile-time tramite Vite
const allDocs = import.meta.glob("/src/docs/**/*.md", { query: "?raw", import: "default", eager: true })

const getDoc = (lang, id) => allDocs[`/src/docs/${lang}/${id}.md`] || null

// Componenti Tailwind per il renderer markdown
const mdComponents = {
  h1: ({ children }) => (
    <h1 className="text-2xl font-bold text-gray-800 mb-4 mt-2 pb-3 border-b border-gray-200">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-lg font-bold text-gray-800 mb-3 mt-7 pb-2 border-b border-gray-100">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-base font-semibold text-gray-700 mb-2 mt-5">{children}</h3>
  ),
  h4: ({ children }) => (
    <h4 className="text-sm font-semibold text-gray-700 mb-1 mt-4">{children}</h4>
  ),
  p: ({ children }) => (
    <p className="text-gray-600 mb-3 leading-relaxed text-sm">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="list-disc pl-6 mb-3 space-y-1 text-gray-600 text-sm">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal pl-6 mb-3 space-y-1 text-gray-600 text-sm">{children}</ol>
  ),
  li: ({ children }) => (
    <li className="leading-relaxed">{children}</li>
  ),
  table: ({ children }) => (
    <div className="overflow-x-auto mb-4">
      <table className="w-full text-sm border-collapse">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-gray-50">{children}</thead>,
  tbody: ({ children }) => <tbody>{children}</tbody>,
  tr: ({ children }) => <tr className="even:bg-gray-50/50">{children}</tr>,
  th: ({ children }) => (
    <th className="px-4 py-2.5 text-left font-semibold text-gray-700 border border-gray-200 text-xs uppercase tracking-wide bg-gray-50">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="px-4 py-2.5 text-gray-600 border border-gray-200 text-sm">{children}</td>
  ),
  code: ({ inline, children }) =>
    inline ? (
      <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs font-mono text-gray-700">{children}</code>
    ) : (
      <code className="text-xs">{children}</code>
    ),
  pre: ({ children }) => (
    <pre className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 mb-3 overflow-x-auto text-xs font-mono">
      {children}
    </pre>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-4 border-blue-300 pl-4 py-2 bg-blue-50 rounded-r-lg mb-3 text-gray-600 text-sm">
      {children}
    </blockquote>
  ),
  strong: ({ children }) => <strong className="font-semibold text-gray-800">{children}</strong>,
  hr: () => <hr className="border-gray-200 my-6" />,
  a: ({ href, children }) => (
    <a href={href} className="text-[#2563eb] underline hover:text-[#1e3a5f] transition">{children}</a>
  ),
}

export default function DocViewer() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { hasRole } = useAuthStore()

  const [lang, setLang] = useState(() => {
    const fromUrl = searchParams.get("lang")
    if (fromUrl === "it" || fromUrl === "en") return fromUrl
    return localStorage.getItem("ftc_docs_lang") || "it"
  })

  const guide = GUIDES.find(g => g.id === id)

  // Guida non trovata o accesso negato
  if (!guide) return <Navigate to="/docs" replace />
  if (!hasRole(...guide.roles)) return <Navigate to="/unauthorized" replace />

  const content = getDoc(lang, id)

  const setLanguage = (l) => {
    setLang(l)
    localStorage.setItem("ftc_docs_lang", l)
  }

  const handlePrint = () => window.print()

  return (
    <div className="space-y-4">
      {/* Toolbar — nascosta in stampa */}
      <div className="flex items-center justify-between print:hidden">
        <button
          onClick={() => navigate("/docs")}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 transition"
        >
          <ArrowLeft size={16} />
          {lang === "it" ? "Torna alle guide" : "Back to guides"}
        </button>

        <div className="flex items-center gap-3">
          {/* Toggle lingua */}
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
                  {l.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Stampa */}
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 px-3 py-1.5 rounded-lg transition"
          >
            <Printer size={13} />
            {lang === "it" ? "Stampa / Salva PDF" : "Print / Save PDF"}
          </button>
        </div>
      </div>

      {/* Documento */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 max-w-4xl mx-auto print:shadow-none print:border-none print:p-0 print:rounded-none">
        {content ? (
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
            {content}
          </ReactMarkdown>
        ) : (
          <div className="text-center py-16">
            <p className="text-gray-400 text-sm">
              {lang === "it"
                ? "Documento non ancora disponibile in questa lingua."
                : "Document not yet available in this language."}
            </p>
            <button
              onClick={() => setLanguage(lang === "it" ? "en" : "it")}
              className="mt-3 text-xs text-[#2563eb] underline"
            >
              {lang === "it" ? "Prova in inglese" : "Try in Italian"}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
