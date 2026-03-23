import { apiClient } from "./client"

export const authApi = {
  login: (username, password) =>
    apiClient.post("/api/auth/login", { username, password }),
  logout: () => apiClient.post("/api/auth/logout"),
  me: () => apiClient.get("/api/auth/me"),
  getProfile: () => apiClient.get("/api/auth/profile"),
  updateProfile: (data) => apiClient.put("/api/auth/profile", data),
  changePassword: (data) => apiClient.put("/api/auth/password", data),

  // Admin — user management
  listUsers: (params) => apiClient.get("/api/admin/users", { params }),
  getUser: (id) => apiClient.get(`/api/admin/users/${id}`),
  createUser: (data) => apiClient.post("/api/admin/users", data),
  updateUser: (id, data) => apiClient.patch(`/api/admin/users/${id}`, data),
  deleteUser: (id) => apiClient.delete(`/api/admin/users/${id}`),
  changeDepartment: (id, department) =>
    apiClient.patch(`/api/admin/users/${id}/department`, { department }),
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
