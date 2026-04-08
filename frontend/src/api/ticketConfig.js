import { apiClient } from "@/api/client"

export const ticketConfigApi = {
  // Pubblici (richiedono tickets.view)
  getCategories: () => apiClient.get("/api/tickets/categories"),
  getSubcategories: (categoryId) => apiClient.get(`/api/tickets/categories/${categoryId}/subcategories`),
  getRoutingPreview: (categoryId, subcategoryId) =>
    apiClient.get(`/api/tickets/categories/${categoryId}/routing-preview`, {
      params: subcategoryId ? { subcategory_id: subcategoryId } : {},
    }),

  // Admin (richiedono tickets.admin)
  adminGetCategories: () => apiClient.get("/api/admin/tickets/categories"),
  createCategory: (data) => apiClient.post("/api/admin/tickets/categories", data),
  updateCategory: (id, data) => apiClient.put(`/api/admin/tickets/categories/${id}`, data),
  deleteCategory: (id) => apiClient.delete(`/api/admin/tickets/categories/${id}`),

  adminGetSubcategories: () => apiClient.get("/api/admin/tickets/subcategories"),
  createSubcategory: (data) => apiClient.post("/api/admin/tickets/subcategories", data),
  updateSubcategory: (id, data) => apiClient.put(`/api/admin/tickets/subcategories/${id}`, data),
  deleteSubcategory: (id) => apiClient.delete(`/api/admin/tickets/subcategories/${id}`),

  getTeams: () => apiClient.get("/api/admin/tickets/teams"),
  createTeam: (data) => apiClient.post("/api/admin/tickets/teams", data),
  updateTeam: (id, data) => apiClient.put(`/api/admin/tickets/teams/${id}`, data),
  deleteTeam: (id) => apiClient.delete(`/api/admin/tickets/teams/${id}`),

  getTeamMembers: (teamId) => apiClient.get(`/api/admin/tickets/teams/${teamId}/members`),
  addTeamMember: (teamId, data) => apiClient.post(`/api/admin/tickets/teams/${teamId}/members`, data),
  removeTeamMember: (teamId, userId) => apiClient.delete(`/api/admin/tickets/teams/${teamId}/members/${userId}`),
  updateTeamMember: (teamId, userId, data) => apiClient.put(`/api/admin/tickets/teams/${teamId}/members/${userId}`, data),

  getRoutingRules: () => apiClient.get("/api/admin/tickets/routing-rules"),
  createRoutingRule: (data) => apiClient.post("/api/admin/tickets/routing-rules", data),
  updateRoutingRule: (id, data) => apiClient.put(`/api/admin/tickets/routing-rules/${id}`, data),
  deleteRoutingRule: (id) => apiClient.delete(`/api/admin/tickets/routing-rules/${id}`),

  // Training AI
  getTrainingTickets: (limit = 300) => apiClient.get("/api/admin/tickets/training/tickets", { params: { limit } }),
  saveTraining: (examples) => apiClient.post("/api/admin/tickets/training/save", { examples }),
}
