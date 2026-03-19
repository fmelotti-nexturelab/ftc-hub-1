import { apiClient } from "@/api/client"

export const ticketsApi = {
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
  uploadAttachment: (ticketId, file) => {
    const form = new FormData()
    form.append("file", file)
    return apiClient.post(`/api/tickets/${ticketId}/attachments`, form, {
      headers: { "Content-Type": "multipart/form-data" },
    })
  },
  fetchAttachmentBlob: (attachmentId) =>
    apiClient.get(`/api/tickets/attachments/${attachmentId}`, { responseType: "blob" }),

  // Users (for assign dropdown)
  listUsers: () => apiClient.get("/api/tickets/users"),
}
