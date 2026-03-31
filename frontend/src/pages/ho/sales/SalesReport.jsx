import { useNavigate } from "react-router-dom"
import { useSalesCheckStore } from "@/store/salesCheckStore"
import { useAuthStore } from "@/store/authStore"
import { LogOut, CheckCircle2, Clock, Mail } from "lucide-react"

const fmt = (n) =>
  typeof n === "number"
    ? n.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : "—"

function getYesterdayKey() {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  const dd = String(d.getDate()).padStart(2, "0")
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const yy = String(d.getFullYear()).slice(-2)
  return `${dd}.${mm}.${yy}`
}

const ENTITIES = [
  { key: "it01", label: "IT01", badgeBg: "bg-blue-100",    badgeText: "text-blue-700" },
  { key: "it02", label: "IT02", badgeBg: "bg-emerald-100", badgeText: "text-emerald-700" },
  { key: "it03", label: "IT03", badgeBg: "bg-violet-100",  badgeText: "text-violet-700" },
]

function useEntitySummary(preview, yesterday) {
  if (!preview) return null
  const col = preview.date_columns.find((d) => d === yesterday)
  if (!col) return { total: 0, missing: preview.missing_stores, low: [], ok: false }
  const rows = preview.rows.filter((r) => r.has_data && r.dates[col] !== undefined && r.dates[col] !== 0)
  const total = rows.reduce((s, r) => s + (r.dates[col] ?? 0), 0)
  const missing = preview.missing_stores
  const low = rows.filter((r) => r.dates[col] > 0 && r.dates[col] < 1000).sort((a, b) => a.store_code.localeCompare(b.store_code))
  return { total, missing, low, col, ok: missing.length === 0 && low.length === 0 }
}

function buildMailBody(yesterday, summaries, grandTotal, userName) {
  const rows = ENTITIES.map((e) => {
    const s = summaries[e.key]
    const tot = s ? `${fmt(s.total)} €` : "—"
    const stato = !s
      ? "Non importato"
      : s.missing.length === 0
        ? "TUTTO OK"
        : s.missing.join(", ")
    return `<tr>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-weight:bold">${e.label}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600">${tot}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;${!s ? 'color:#9ca3af' : s.missing.length === 0 ? 'color:#16a34a;font-weight:600' : 'color:#b45309'}">${stato}</td>
    </tr>`
  }).join("")

  return `<div style="font-family:Calibri,Arial,sans-serif;font-size:14px;color:#333">
<p>Ciao a tutti,</p>
<p><strong>Check vendite del ${yesterday}</strong></p>
<table style="border-collapse:collapse;border:1px solid #e5e7eb;border-radius:6px;min-width:500px;margin:16px 0">
  <thead>
    <tr style="background:#f9fafb">
      <th style="padding:8px 12px;border-bottom:2px solid #e5e7eb;text-align:left;font-size:12px;color:#6b7280">Entity</th>
      <th style="padding:8px 12px;border-bottom:2px solid #e5e7eb;text-align:right;font-size:12px;color:#6b7280">Totale</th>
      <th style="padding:8px 12px;border-bottom:2px solid #e5e7eb;text-align:left;font-size:12px;color:#6b7280">Stato</th>
    </tr>
  </thead>
  <tbody>${rows}</tbody>
  <tfoot>
    <tr style="background:#f9fafb">
      <td style="padding:8px 12px;font-weight:bold">TOTALE</td>
      <td style="padding:8px 12px;text-align:right;font-weight:bold">${fmt(grandTotal)} €</td>
      <td></td>
    </tr>
  </tfoot>
</table>
<p>Buona giornata<br>${userName}</p>
</div>`
}

export default function SalesReport() {
  const navigate = useNavigate()
  const { it01, it02, it03, clear } = useSalesCheckStore()
  const { user } = useAuthStore()
  const yesterday = getYesterdayKey()

  const previews = { it01, it02, it03 }
  const summaries = {
    it01: useEntitySummary(it01, yesterday),
    it02: useEntitySummary(it02, yesterday),
    it03: useEntitySummary(it03, yesterday),
  }

  const allLoaded = it01 && it02 && it03
  const grandTotal = ENTITIES.reduce((t, e) => t + (summaries[e.key]?.total ?? 0), 0)
  const userName = user?.full_name || user?.username || ""

  async function handleSendMail() {
    const subject = `Check vendite del ${yesterday}`
    const html = buildMailBody(yesterday, summaries, grandTotal, userName)

    try {
      // Prova via agente locale → Outlook COM
      const res = await fetch("http://localhost:9999/mail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, html }),
      })
      if (res.ok) {
        clear()
        return
      }
    } catch { /* agente non raggiungibile */ }

    // Fallback: copia HTML negli appunti + mailto
    const blob = new Blob([html], { type: "text/html" })
    const plainText = `Ciao a tutti,\n\nCheck vendite del ${yesterday}\n\n` +
      ENTITIES.map((e) => {
        const s = summaries[e.key]
        const tot = s ? `${fmt(s.total)} €` : "—"
        const stato = !s ? "Non importato" : s.missing.length === 0 ? "TUTTO OK" : `Mancanti: ${s.missing.join(", ")}`
        return `${e.label}  ${tot}  ${stato}`
      }).join("\n") +
      `\n\nTotale: ${fmt(grandTotal)} €\n\nBuona giornata\n${userName}`

    await navigator.clipboard.write([
      new ClipboardItem({
        "text/html": blob,
        "text/plain": new Blob([plainText], { type: "text/plain" }),
      }),
    ])
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent("(Incolla il contenuto dalla clipboard — Ctrl+V)")}`
    clear()
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Report Vendite</h1>
          <p className="text-xs text-gray-400 mt-0.5">Riepilogo check vendite del {yesterday}</p>
        </div>
        <button onClick={() => navigate("/utilities/genera-tabelle?group=sales")} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition focus-visible:ring-2 focus-visible:ring-[#2563eb]">
          <LogOut size={15} aria-hidden="true" />
          Esci
        </button>
      </div>

      {/* Banner totale */}
      <div className="bg-[#1e3a5f] rounded-xl p-5 flex items-center justify-between">
        <div>
          <p className="text-white/60 text-xs uppercase tracking-wider font-semibold">Totale giornata {yesterday}</p>
          <p className="text-white text-2xl font-bold mt-1">{allLoaded ? `${fmt(grandTotal)} €` : "—"}</p>
        </div>
        <div className="flex items-center gap-3">
          {ENTITIES.map((e) => (
            <div key={e.key} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg ${previews[e.key] ? "bg-white/15" : "bg-white/5"}`}>
              <div className={`w-2 h-2 rounded-full ${previews[e.key] ? "bg-green-400" : "bg-gray-500"}`} />
              <span className={`text-xs font-semibold ${previews[e.key] ? "text-white" : "text-white/40"}`}>{e.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Tabella riepilogativa */}
      <div className="flex justify-center">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden w-full max-w-2xl">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
            <span className="text-sm font-bold text-gray-800">Check vendite del {yesterday}</span>
            <span className="text-sm font-bold text-gray-800 tabular-nums">Totale {allLoaded ? `${fmt(grandTotal)} €` : "—"}</span>
          </div>
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th scope="col" className="text-left px-4 py-2.5 text-xs font-semibold text-gray-600 w-16">Entity</th>
                <th scope="col" className="text-right px-4 py-2.5 text-xs font-semibold text-gray-600 w-32">Totale</th>
                <th scope="col" className="text-left px-4 py-2.5 text-xs font-semibold text-gray-600">Stato</th>
              </tr>
            </thead>
            <tbody>
              {ENTITIES.map((e) => {
                const s = summaries[e.key]
                return (
                  <tr key={e.key} className="border-b border-gray-100 last:border-0">
                    <td className="px-4 py-3">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded ${e.badgeBg} ${e.badgeText}`}>{e.label}</span>
                    </td>
                    <td className="text-right px-4 py-3 text-sm font-semibold text-gray-800 tabular-nums">
                      {s ? `${fmt(s.total)} €` : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {!s ? (
                        <span className="flex items-center gap-1.5 text-sm text-gray-400">
                          <Clock size={14} aria-hidden="true" />
                          Non importato
                        </span>
                      ) : s.missing.length === 0 ? (
                        <span className="flex items-center gap-1.5 text-sm text-green-600 font-semibold">
                          <CheckCircle2 size={14} aria-hidden="true" />
                          TUTTO OK
                        </span>
                      ) : (
                        <p className="text-sm text-amber-700 font-medium">
                          {s.missing.join(", ")}
                        </p>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invia mail */}
      <div className="flex justify-center max-w-2xl mx-auto">
        <button
          onClick={handleSendMail}
          disabled={!allLoaded}
          className="flex items-center gap-2 bg-[#1e3a5f] hover:bg-[#2563eb] text-white px-6 py-2.5 rounded-xl font-semibold shadow transition disabled:opacity-40 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-[#2563eb]"
        >
          <Mail size={16} aria-hidden="true" />
          Invia mail check vendite
        </button>
      </div>
    </div>
  )
}
