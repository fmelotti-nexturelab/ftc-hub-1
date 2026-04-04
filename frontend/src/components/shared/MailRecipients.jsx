import { useState, useMemo, useCallback } from "react"
import { useQuery } from "@tanstack/react-query"
import { Search, ChevronDown, ChevronUp, Users, X } from "lucide-react"
import { authApi } from "@/api/auth"

/**
 * Componente riusabile per selezionare destinatari mail.
 * Ogni servizio ha la sua lista salvata in localStorage tramite `storageKey`.
 *
 * Props:
 *  - storageKey: string — chiave localStorage (es. "salesReport", "stockReport")
 *  - recipients / setRecipients: state esterno { [userId]: { to: bool, cc: bool } }
 *
 * Uso:
 *   const [recipients, setRecipients] = useMailRecipients("salesReport")
 *   <MailRecipients storageKey="salesReport" recipients={recipients} setRecipients={setRecipients} />
 *   <MailRecipientsSummary storageKey="salesReport" recipients={recipients} />
 */

// ── Hook per gestire lo state dei destinatari ──
export function useMailRecipients(storageKey) {
  const key = `mail_recipients_${storageKey}`
  const [recipients, setRecipientsRaw] = useState(() => {
    try { return JSON.parse(localStorage.getItem(key)) || {} } catch { return {} }
  })

  const setRecipients = useCallback((updater) => {
    setRecipientsRaw((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater
      localStorage.setItem(key, JSON.stringify(next))
      return next
    })
  }, [key])

  return [recipients, setRecipients]
}

// ── Hook per ottenere le email dai recipients ──
export function useRecipientEmails(recipients) {
  const { data: allUsers } = useQuery({
    queryKey: ["users-for-mail"],
    queryFn: () => authApi.listUsers({ is_active: true }).then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  })

  return useMemo(() => {
    if (!allUsers) return { toEmails: [], ccEmails: [], toUsers: [], ccUsers: [], hasRecipients: false }
    const toUsers = allUsers.filter((u) => recipients[u.id]?.to)
    const ccUsers = allUsers.filter((u) => recipients[u.id]?.cc)
    const toEmails = toUsers.map((u) => u.email)
    const ccEmails = ccUsers.map((u) => u.email)
    return { toEmails, ccEmails, toUsers, ccUsers, hasRecipients: toEmails.length > 0 || ccEmails.length > 0 }
  }, [allUsers, recipients])
}

// ── Pannello selettore destinatari (collassabile) ──
export default function MailRecipients({ recipients, setRecipients }) {
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState("")

  const { data: allUsers } = useQuery({
    queryKey: ["users-for-mail"],
    queryFn: () => authApi.listUsers({ is_active: true }).then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  })

  const filteredUsers = useMemo(() => {
    if (!allUsers) return []
    const q = filter.toLowerCase()
    return allUsers
      .filter((u) => u.email && (
        !q ||
        u.full_name?.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.department?.toLowerCase().includes(q)
      ))
      .sort((a, b) => (a.full_name || "").localeCompare(b.full_name || ""))
  }, [allUsers, filter])

  const toggle = useCallback((userId, field) => {
    setRecipients((prev) => {
      const cur = prev[userId] || { to: false, cc: false }
      const next = { ...cur, [field]: !cur[field] }
      if (field === "to" && next.to) next.cc = false
      if (field === "cc" && next.cc) next.to = false
      const updated = { ...prev, [userId]: next }
      if (!next.to && !next.cc) delete updated[userId]
      return updated
    })
  }, [setRecipients])

  const selectedCount = Object.keys(recipients).length

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-gray-50 transition"
        aria-expanded={open}
      >
        <Users size={14} className="text-gray-500 shrink-0" aria-hidden="true" />
        <span className="text-sm font-bold text-gray-800 flex-1">Seleziona destinatari</span>
        <span className="text-xs text-gray-400">{selectedCount > 0 ? `${selectedCount} selezionati` : "Nessuno"}</span>
        {open
          ? <ChevronUp size={14} className="text-gray-400" aria-hidden="true" />
          : <ChevronDown size={14} className="text-gray-400" aria-hidden="true" />
        }
      </button>

      {open && (
        <>
          <div className="px-4 py-2 border-t border-gray-100">
            <div className="relative">
              <label htmlFor="recipient-filter" className="sr-only">Filtra destinatari</label>
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
              <input
                id="recipient-filter"
                type="text"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Cerca per nome, email o department..."
                className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#2563eb] focus:border-transparent outline-none transition"
              />
            </div>
          </div>
          <div className="max-h-48 overflow-y-auto border-t border-gray-100">
            {filteredUsers.length === 0 ? (
              <p className="text-xs text-gray-400 px-4 py-3 text-center">Nessun utente trovato</p>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 sticky top-0">
                    <th scope="col" className="text-left px-4 py-1.5 font-semibold text-gray-500">Nome</th>
                    <th scope="col" className="text-left px-2 py-1.5 font-semibold text-gray-500">Email</th>
                    <th scope="col" className="text-center px-2 py-1.5 font-semibold text-gray-500 w-10">A</th>
                    <th scope="col" className="text-center px-2 py-1.5 font-semibold text-gray-500 w-10">CC</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((u) => {
                    const r = recipients[u.id] || { to: false, cc: false }
                    return (
                      <tr key={u.id} className={`border-b border-gray-50 ${r.to || r.cc ? "bg-blue-50/50" : "hover:bg-gray-50/50"}`}>
                        <td className="px-4 py-1.5 font-medium text-gray-800">{u.full_name || u.username}</td>
                        <td className="px-2 py-1.5 text-gray-500">{u.email}</td>
                        <td className="text-center px-2 py-1.5">
                          <input
                            type="checkbox"
                            checked={r.to}
                            onChange={() => toggle(u.id, "to")}
                            className="rounded border-gray-300 text-[#1e3a5f] focus:ring-[#2563eb]"
                            aria-label={`${u.full_name || u.username} come destinatario`}
                          />
                        </td>
                        <td className="text-center px-2 py-1.5">
                          <input
                            type="checkbox"
                            checked={r.cc}
                            onChange={() => toggle(u.id, "cc")}
                            className="rounded border-gray-300 text-[#1e3a5f] focus:ring-[#2563eb]"
                            aria-label={`${u.full_name || u.username} in copia conoscenza`}
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ── Riepilogo destinatari selezionati (da affiancare alla tabella) ──
export function MailRecipientsSummary({ recipients, setRecipients }) {
  const { toUsers, ccUsers, hasRecipients } = useRecipientEmails(recipients)

  const remove = useCallback((userId) => {
    setRecipients((prev) => {
      const updated = { ...prev }
      delete updated[userId]
      return updated
    })
  }, [setRecipients])

  if (!hasRecipients) return null

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
      <div className="flex items-center gap-2 mb-3">
        <Users size={14} className="text-gray-500" aria-hidden="true" />
        <span className="text-sm font-bold text-gray-800">Destinatari mail</span>
      </div>
      {toUsers.length > 0 && (
        <div className="mb-2">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">A</span>
          <div className="flex flex-wrap gap-1 mt-1">
            {toUsers.map((u) => (
              <span key={u.id} className="inline-flex items-center gap-1 text-xs bg-blue-50 border border-blue-200 text-blue-700 pl-2 pr-1 py-0.5 rounded">
                {u.full_name || u.username}
                <button
                  onClick={() => remove(u.id)}
                  className="hover:bg-blue-200 rounded p-0.5 transition"
                  aria-label={`Rimuovi ${u.full_name || u.username}`}
                >
                  <X size={10} aria-hidden="true" />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}
      {ccUsers.length > 0 && (
        <div>
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">CC</span>
          <div className="flex flex-wrap gap-1 mt-1">
            {ccUsers.map((u) => (
              <span key={u.id} className="inline-flex items-center gap-1 text-xs bg-gray-100 border border-gray-200 text-gray-600 pl-2 pr-1 py-0.5 rounded">
                {u.full_name || u.username}
                <button
                  onClick={() => remove(u.id)}
                  className="hover:bg-gray-300 rounded p-0.5 transition"
                  aria-label={`Rimuovi ${u.full_name || u.username}`}
                >
                  <X size={10} aria-hidden="true" />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
