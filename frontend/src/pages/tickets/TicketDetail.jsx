import { useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  ArrowLeft, AlertCircle, Lock, Tag, Users, UserCheck,
  User, Calendar, Phone, Monitor, Building2, XCircle, Mail, UserPlus, Forward, ExternalLink,
} from "lucide-react"
import { ticketsApi } from "@/api/tickets"
import { ticketConfigApi } from "@/api/ticketConfig"
import { useAuthStore } from "@/store/authStore"
import TicketStatusBadge from "@/components/tickets/TicketStatusBadge"
import TicketPriorityBadge from "@/components/tickets/TicketPriorityBadge"
import TicketCommentForm from "@/components/tickets/TicketCommentForm"
import TicketAttachments from "@/components/tickets/TicketAttachments"

const STATUSES = [
  { value: "open",        label: "Aperto" },
  { value: "in_progress", label: "In lavorazione" },
  { value: "waiting",     label: "In attesa" },
  { value: "resolved",    label: "Risolto" },
  { value: "closed",      label: "Chiuso" },
]

function MetaRow({ icon: Icon, label, value }) {
  if (!value) return null
  return (
    <div className="flex items-start gap-2 text-xs">
      <Icon size={12} className="text-gray-400 mt-0.5 shrink-0" />
      <div className="min-w-0">
        <span className="text-gray-400">{label}</span>
        <p className="font-medium text-gray-700 break-words">{value}</p>
      </div>
    </div>
  )
}

export default function TicketDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { hasRole, user } = useAuthStore()
  const isAdmin = hasRole("ADMIN")
  const isHO = !["STORE", "STOREMANAGER"].includes(user?.department)
  const isPrivileged = isAdmin || ["IT", "SUPERUSER"].includes(user?.department)
  const canForward = isHO

  const [showForwardModal, setShowForwardModal] = useState(false)
  const [selectedTeam, setSelectedTeam] = useState(null)

  const { data: ticket, isLoading: ticketLoading } = useQuery({
    queryKey: ["ticket", id],
    queryFn: () => ticketsApi.get(id).then(r => r.data),
  })

  const { data: comments = [], isLoading: commentsLoading } = useQuery({
    queryKey: ["ticket-comments", id],
    queryFn: () => ticketsApi.getComments(id).then(r => r.data),
  })

  const { data: usersData } = useQuery({
    queryKey: ["ticket-users"],
    queryFn: () => ticketsApi.listUsers().then(r => r.data),
    enabled: isHO,
  })
  const users = usersData?.users ?? []

  const [actionError, setActionError] = useState(null)

  const invalidate = () => {
    setActionError(null)
    qc.invalidateQueries({ queryKey: ["ticket", id] })
    qc.invalidateQueries({ queryKey: ["ticket-comments", id] })
    qc.invalidateQueries({ queryKey: ["tickets"] })
  }

  const onError = (err) => {
    const msg = err?.response?.data?.detail || "Operazione non riuscita"
    setActionError(msg)
  }

  const statusMutation = useMutation({
    mutationFn: (status) => ticketsApi.updateStatus(id, status),
    onSuccess: invalidate,
    onError,
  })

  const assignMutation = useMutation({
    mutationFn: (assigned_to) => ticketsApi.assign(id, assigned_to || null),
    onSuccess: invalidate,
    onError,
  })

  const takeMutation = useMutation({
    mutationFn: () => ticketsApi.take(id),
    onSuccess: invalidate,
    onError,
  })

  const forwardMutation = useMutation({
    mutationFn: (team_id) => ticketsApi.forward(id, team_id),
    onSuccess: () => {
      invalidate()
      setShowForwardModal(false)
      setSelectedTeam(null)
    },
  })

  const { data: teams = [] } = useQuery({
    queryKey: ["ticket-teams"],
    queryFn: () => ticketConfigApi.getTeams().then(r => r.data),
    enabled: canForward,
  })

  const commentMutation = useMutation({
    mutationFn: (data) => ticketsApi.addComment(id, data),
    onSuccess: invalidate,
  })

  if (ticketLoading) {
    return <div className="py-16 text-center text-gray-400 text-sm">Caricamento...</div>
  }
  if (!ticket) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-red-700 text-sm flex items-center gap-2">
        <AlertCircle size={15} /> Ticket non trovato.
      </div>
    )
  }

  const isClosed = ticket.status === "closed"
  const isAlreadyAssignedToMe = ticket.assigned_to === user?.id
  const canTake = !isClosed && !isAlreadyAssignedToMe
  const canClose = !isClosed && (isPrivileged || isAlreadyAssignedToMe)
  const selectClass = "w-full text-xs border border-gray-300 rounded-lg px-2.5 py-2 bg-white focus:ring-2 focus:ring-[#2563eb] outline-none transition"

  return (
    <>
    {/* Modal Inoltra Ticket */}
    {showForwardModal && (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
          <div className="p-5 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-[#1e3a5f]/10 rounded-xl flex items-center justify-center">
                <Forward size={16} className="text-[#1e3a5f]" />
              </div>
              <div>
                <h2 className="font-bold text-gray-800">Inoltra ticket</h2>
                <p className="text-xs text-gray-400">Seleziona il team di destinazione</p>
              </div>
            </div>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-2 gap-2">
              {teams.map(t => (
                <button
                  key={t.id}
                  onClick={() => setSelectedTeam(t.id === selectedTeam ? null : t.id)}
                  className={`px-4 py-3 rounded-xl text-sm font-semibold border-2 transition ${
                    selectedTeam === t.id
                      ? "bg-[#1e3a5f] text-white border-[#1e3a5f]"
                      : "bg-white text-gray-700 border-gray-200 hover:border-[#1e3a5f] hover:text-[#1e3a5f]"
                  }`}
                >
                  {t.name}
                </button>
              ))}
            </div>
          </div>
          <div className="p-5 border-t border-gray-100 flex gap-2">
            <button
              onClick={() => { setShowForwardModal(false); setSelectedTeam(null) }}
              className="flex-1 border border-gray-300 text-gray-600 font-semibold py-2.5 rounded-xl hover:bg-gray-50 transition text-sm"
            >
              Annulla
            </button>
            <button
              onClick={() => forwardMutation.mutate(selectedTeam)}
              disabled={!selectedTeam || forwardMutation.isPending}
              className="flex-1 bg-[#1e3a5f] hover:bg-[#2563eb] text-white font-semibold py-2.5 rounded-xl shadow transition text-sm disabled:opacity-40"
            >
              {forwardMutation.isPending ? "Inoltro..." : "Conferma inoltro"}
            </button>
          </div>
        </div>
      </div>
    )}
    <div className="space-y-3">

      {/* Barra superiore: back + titolo + badge */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate("/tickets")}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition shrink-0"
        >
          <ArrowLeft size={15} /> Lista
        </button>
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-mono text-gray-400 shrink-0">
            #{String(ticket.ticket_number).padStart(4, "0")}
          </span>
          <TicketPriorityBadge priority={ticket.priority} />
          <TicketStatusBadge status={ticket.status} />
          <h1 className="text-base font-bold text-gray-800 truncate">{ticket.title}</h1>
        </div>
      </div>

      {/* Layout 2 colonne */}
      <div className="flex gap-4 items-start">

        {/* ── Colonna sinistra ── */}
        <div className="flex-1 min-w-0 space-y-4">

          {/* Informazioni */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Informazioni
            </p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              <MetaRow icon={Tag}       label="Categoria"      value={ticket.category_name} />
              <MetaRow icon={Tag}       label="Sottocategoria" value={ticket.subcategory_name} />
              <MetaRow icon={User}      label="Richiedente"    value={ticket.requester_name} />
              <MetaRow icon={Mail}      label="Email"          value={ticket.requester_email} />
              <MetaRow icon={Phone}     label="Telefono"       value={ticket.requester_phone} />
              {ticket.teamviewer_code && isHO ? (
                <div className="flex items-start gap-2 text-xs">
                  <Monitor size={12} className="text-gray-400 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <span className="text-gray-400">TeamViewer</span>
                    <a
                      href={`teamviewer10://control?device=${ticket.teamviewer_code.replace(/[\s-]/g, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 font-medium text-[#2563eb] hover:underline"
                    >
                      {ticket.teamviewer_code}
                      <ExternalLink size={10} />
                    </a>
                  </div>
                </div>
              ) : (
                <MetaRow icon={Monitor} label="TeamViewer" value={ticket.teamviewer_code} />
              )}
              <MetaRow icon={Building2} label="Negozio"        value={ticket.store_number} />
              <MetaRow icon={Users}     label="Team"           value={ticket.team_name} />
              <MetaRow icon={UserCheck} label="Assegnato a"    value={ticket.assignee_name} />
              <MetaRow icon={User}      label="Creato da"      value={ticket.creator_name} />
              <div className="flex items-start gap-2 text-xs">
                <Calendar size={12} className="text-gray-400 mt-0.5 shrink-0" />
                <div>
                  <span className="text-gray-400">Aperto il</span>
                  <p className="font-medium text-gray-700">
                    {new Date(ticket.created_at).toLocaleString("it-IT")}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Descrizione originale */}
          {ticket.original_description && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">
                Descrizione
              </p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                {ticket.original_description}
              </p>
            </div>
          )}

          {/* Descrizione assistita dall'AI */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Descrizione assistita
            </p>
            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
              {ticket.description}
            </p>
          </div>

          {/* Commenti */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-3">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
              Commenti {!commentsLoading && `(${comments.length})`}
            </p>

            {commentsLoading ? (
              <div className="text-center text-gray-400 text-sm py-4">Caricamento...</div>
            ) : comments.length === 0 ? (
              <div className="text-sm text-gray-400 py-2">Nessun commento ancora.</div>
            ) : (
              <div className="space-y-2">
                {comments.map(c => (
                  <div
                    key={c.id}
                    className={`rounded-lg p-3 text-sm ${
                      c.is_internal
                        ? "bg-amber-50 border border-amber-200"
                        : "bg-gray-50 border border-gray-100"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="font-semibold text-gray-700 text-xs">{c.author_name}</span>
                      <span className="text-gray-400 text-xs">
                        {new Date(c.created_at).toLocaleString("it-IT")}
                      </span>
                      {c.is_internal && (
                        <span className="flex items-center gap-1 text-[10px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded ml-auto">
                          <Lock size={9} /> Nota interna
                        </span>
                      )}
                    </div>
                    <p className="text-gray-700 whitespace-pre-wrap">{c.content}</p>
                  </div>
                ))}
              </div>
            )}

            {!isClosed && (
              <div className="pt-2 border-t border-gray-100">
                <TicketCommentForm
                  onSubmit={(data) => commentMutation.mutate(data)}
                  isManager={isHO}
                  isPending={commentMutation.isPending}
                />
              </div>
            )}
          </div>
        </div>

        {/* ── Colonna destra ── */}
        <div className="w-64 shrink-0 space-y-4">

          {actionError && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2">
              {actionError}
            </div>
          )}

          {/* Prendi in carico — visibile a tutti i manager */}
          {isHO && canTake && (
            <button
              onClick={() => takeMutation.mutate()}
              disabled={takeMutation.isPending}
              className="w-full flex items-center justify-center gap-2 bg-[#1e3a5f] hover:bg-[#2563eb] text-white font-semibold text-sm py-2.5 rounded-xl shadow transition disabled:opacity-40"
            >
              <UserPlus size={15} />
              {takeMutation.isPending ? "In corso..." : "Prendi in carico"}
            </button>
          )}

          {/* Inoltra ticket */}
          {canForward && !isClosed && (
            <button
              onClick={() => { setSelectedTeam(null); setShowForwardModal(true) }}
              className="w-full flex items-center justify-center gap-2 border border-[#1e3a5f] text-[#1e3a5f] hover:bg-[#1e3a5f] hover:text-white font-semibold text-sm py-2.5 rounded-xl transition"
            >
              <Forward size={15} />
              Inoltra ticket
            </button>
          )}

          {/* Gestione */}
          {isHO && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-3">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                Gestione
              </p>

              <div>
                <label className="block text-xs text-gray-500 mb-1">Stato</label>
                <select
                  value={ticket.status}
                  onChange={e => statusMutation.mutate(e.target.value)}
                  disabled={statusMutation.isPending}
                  className={selectClass}
                >
                  {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">Assegnato a</label>
                <select
                  value={ticket.assigned_to ?? ""}
                  onChange={e => assignMutation.mutate(e.target.value || null)}
                  disabled={assignMutation.isPending}
                  className={selectClass}
                >
                  <option value="">— Non assegnato —</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.full_name || u.username}</option>
                  ))}
                </select>
              </div>

              {/* Chiudi ticket */}
              {canClose && (
                <button
                  onClick={() => statusMutation.mutate("closed")}
                  disabled={statusMutation.isPending}
                  className="w-full flex items-center justify-center gap-2 bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 font-semibold text-xs py-2 rounded-lg transition disabled:opacity-40"
                >
                  <XCircle size={14} />
                  Chiudi ticket
                </button>
              )}

              {isClosed && (
                <div className="text-center text-xs text-gray-400 py-1">
                  Ticket chiuso
                  {ticket.closed_at && (
                    <p className="mt-0.5">{new Date(ticket.closed_at).toLocaleDateString("it-IT")}</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Allegati */}
          <TicketAttachments ticketId={id} />

        </div>
      </div>
    </div>
    </>
  )
}
