import { apiClient } from "./client"

export const authApi = {
  login: (username, password) =>
    apiClient.post("/api/auth/login", { username, password }),
  logout: () => apiClient.post("/api/auth/logout"),
  me: () => apiClient.get("/api/auth/me"),

  // Admin — user management
  listUsers: (params) => apiClient.get("/api/admin/users", { params }),
  getUser: (id) => apiClient.get(`/api/admin/users/${id}`),
  createUser: (data) => apiClient.post("/api/admin/users", data),
  updateUser: (id, data) => apiClient.patch(`/api/admin/users/${id}`, data),
  deleteUser: (id) => apiClient.delete(`/api/admin/users/${id}`),
  changeUserType: (id, user_type) =>
    apiClient.patch(`/api/admin/users/${id}/user-type`, { user_type }),
  resetPassword: (id, password) =>
    apiClient.patch(`/api/admin/users/${id}`, { password }),
  getEffectivePermissions: (id) =>
    apiClient.get(`/api/admin/users/${id}/effective-permissions`),

  // Admin — module blacklist
  listBlacklist: () => apiClient.get("/api/admin/users/blacklist/modules"),
  addBlacklist: (data) => apiClient.post("/api/admin/users/blacklist/modules", data),
  removeBlacklist: (module_code) =>
    apiClient.delete(`/api/admin/users/blacklist/modules/${module_code}`),
}
