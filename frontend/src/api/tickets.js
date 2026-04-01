import { apiClient } from "@/api/client"

export const ticketsApi = {
  stats: () => apiClient.get("/api/tickets/stats"),
  requesterDefaults: () => apiClient.get("/api/tickets/requester-defaults"),

  // Tickets — data deve avere { title, description, category_id, subcategory_id?, priority }
  create: (data) => apiClient.post("/api/tickets", data),
  list: (params) => apiClient.get("/api/tickets", { params }),
  get: (id) => apiClient.get(`/api/tickets/${id}`),
  updateStatus: (id, status) => apiClient.put(`/api/tickets/${id}/status`, { status }),
  assign: (id, assigned_to) => apiClient.put(`/api/tickets/${id}/assign`, { assigned_to }),

  // Comments
  getComments: (ticketId) => apiClient.get(`/api/tickets/${ticketId}/comments`),
  addComment: (ticketId, data) => apiClient.post(`/api/tickets/${ticketId}/comments`, data),

  // Attachments
  listAttachments: (ticketId) => apiClient.get(`/api/tickets/${ticketId}/attachments`),
  uploadAttachment: (ticketId, file, commentId = null) => {
    const form = new FormData()
    form.append("file", file)
    const params = commentId ? { comment_id: commentId } : {}
    return apiClient.post(`/api/tickets/${ticketId}/attachments`, form, {
      headers: { "Content-Type": "multipart/form-data" },
      params,
    })
  },
  fetchAttachmentBlob: (attachmentId) =>
    apiClient.get(`/api/tickets/attachments/${attachmentId}`, { responseType: "blob" }),

  // Users (for assign dropdown)
  listUsers: () => apiClient.get("/api/tickets/users"),

  // Prendi in carico
  take: (id) => apiClient.post(`/api/tickets/${id}/take`),

  // Inoltra a team (con assegnatario opzionale)
  forward: (id, team_id, assigned_to = null) =>
    apiClient.post(`/api/tickets/${id}/forward`, { team_id, assigned_to }),

  // Membri di un team (per modale inoltro)
  getTeamMembers: (teamId) => apiClient.get(`/api/tickets/teams/${teamId}/members`),

  // Storico chiusi
  history: (params) => apiClient.get("/api/tickets/history", { params }),

  // Bulk actions
  bulkAction: (data) => apiClient.put("/api/tickets/bulk", data),

  // Admin DB management
  adminAll: () => apiClient.get("/api/tickets/admin/all"),
  adminTruncate: (password) => apiClient.delete("/api/tickets/admin/truncate", { data: { password } }),

  // Chat / AI
  chatStatus: () => apiClient.get("/api/tickets/chat/status"),
  chat: (messages) => apiClient.post("/api/tickets/chat", { messages }),
  analyze: (title, description) => apiClient.post("/api/tickets/chat/analyze", { title, description }),
}
