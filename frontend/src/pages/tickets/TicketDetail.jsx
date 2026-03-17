import { useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { ArrowLeft, User, Calendar, Tag, AlertCircle, Lock, Paperclip, UserCheck, Users } from "lucide-react"
import { ticketsApi } from "@/api/tickets"
import { useAuthStore } from "@/store/authStore"
import TicketStatusBadge from "@/components/tickets/TicketStatusBadge"
import TicketPriorityBadge from "@/components/tickets/TicketPriorityBadge"
import TicketCommentForm from "@/components/tickets/TicketCommentForm"

const STATUSES = [
  { value: "open",        label: "Aperto" },
  { value: "in_progress", label: "In lavorazione" },
  { value: "waiting",     label: "In attesa" },
  { value: "resolved",    label: "Risolto" },
  { value: "closed",      label: "Chiuso" },
]


export default function TicketDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { hasRole } = useAuthStore()
  const isAdmin = hasRole("ADMIN")

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
    enabled: isAdmin,
  })
  const users = usersData?.users ?? []

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["ticket", id] })
    qc.invalidateQueries({ queryKey: ["ticket-comments", id] })
    qc.invalidateQueries({ queryKey: ["tickets"] })
  }

  const statusMutation = useMutation({
    mutationFn: (status) => ticketsApi.updateStatus(id, status),
    onSuccess: invalidate,
  })

  const assignMutation = useMutation({
    mutationFn: (assigned_to) => ticketsApi.assign(id, assigned_to || null),
    onSuccess: invalidate,
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

  return (
    <div className="max-w-3xl space-y-5">
      {/* Back */}
      <button
        onClick={() => navigate("/tickets")}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 transition"
      >
        <ArrowLeft size={15} /> Torna alla lista
      </button>

      {/* Header ticket */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono text-gray-400">
                #{String(ticket.ticket_number).padStart(4, "0")}
              </span>
              <TicketPriorityBadge priority={ticket.priority} />
              <TicketStatusBadge status={ticket.status} />
            </div>
            <h1 className="text-xl font-bold text-gray-800">{ticket.title}</h1>
          </div>

          {/* Azioni IT/Admin */}
          {isAdmin && (
            <div className="flex flex-col gap-2 shrink-0">
              {/* Cambia stato */}
              <select
                value={ticket.status}
                onChange={e => statusMutation.mutate(e.target.value)}
                disabled={statusMutation.isPending}
                className="text-xs border border-gray-300 rounded-lg px-2 py-1.5 bg-white focus:ring-2 focus:ring-[#2563eb] outline-none"
              >
                {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>

              {/* Assegna a */}
              <select
                value={ticket.assigned_to ?? ""}
                onChange={e => assignMutation.mutate(e.target.value || null)}
                disabled={assignMutation.isPending}
                className="text-xs border border-gray-300 rounded-lg px-2 py-1.5 bg-white focus:ring-2 focus:ring-[#2563eb] outline-none"
              >
                <option value="">— Non assegnato —</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.full_name || u.username}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Metadati */}
        <div className="grid grid-cols-2 gap-3 text-xs text-gray-500 mb-4">
          <div className="flex items-center gap-1.5">
            <Tag size={12} />
            <span>Categoria: <strong className="text-gray-700">{ticket.category_name ?? "—"}</strong></span>
          </div>
          <div className="flex items-center gap-1.5">
            <Tag size={12} className="opacity-0" />
            <span>Sottocategoria: <strong className="text-gray-700">{ticket.subcategory_name ?? "—"}</strong></span>
          </div>
          <div className="flex items-center gap-1.5">
            <User size={12} />
            <span>Creato da: <strong className="text-gray-700">{ticket.creator_name ?? "—"}</strong></span>
          </div>
          <div className="flex items-center gap-1.5">
            <Calendar size={12} />
            <span>{new Date(ticket.created_at).toLocaleString("it-IT")}</span>
          </div>
          {ticket.team_name && (
            <div className="flex items-center gap-1.5">
              <Users size={12} />
              <span>Team: <strong className="text-gray-700">{ticket.team_name}</strong></span>
            </div>
          )}
          {ticket.assignee_name && (
            <div className="flex items-center gap-1.5">
              <UserCheck size={12} />
              <span>Assegnato a: <strong className="text-gray-700">{ticket.assignee_name}</strong></span>
            </div>
          )}
        </div>

        {/* Descrizione */}
        <div className="bg-gray-50 rounded-lg px-4 py-3 text-sm text-gray-700 whitespace-pre-wrap">
          {ticket.description}
        </div>
      </div>

      {/* Commenti */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
        <h2 className="font-semibold text-gray-800 text-sm">
          Commenti {!commentsLoading && `(${comments.length})`}
        </h2>

        {commentsLoading ? (
          <div className="text-center text-gray-400 text-sm py-4">Caricamento...</div>
        ) : comments.length === 0 ? (
          <div className="text-center text-gray-400 text-sm py-4">Nessun commento ancora.</div>
        ) : (
          <div className="space-y-3">
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

        {/* Form commento */}
        {ticket.status !== "closed" && (
          <div className="pt-3 border-t border-gray-100">
            <TicketCommentForm
              onSubmit={(data) => commentMutation.mutate(data)}
              isManager={isAdmin}
              isPending={commentMutation.isPending}
            />
          </div>
        )}
      </div>
    </div>
  )
}
