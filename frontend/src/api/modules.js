import { apiClient } from "@/api/client"

export const modulesApi = {
  listModules: () => apiClient.get("/api/admin/modules"),
  getAllAccess: () => apiClient.get("/api/admin/modules/access"),
  updateAccess: (department, module_code, data) =>
    apiClient.put(`/api/admin/modules/access/${department}/${module_code}`, data),

  getUserPermissions: (userId) =>
    apiClient.get(`/api/admin/modules/users/${userId}/permissions`),
  setUserPermission: (userId, module_code, data) =>
    apiClient.put(`/api/admin/modules/users/${userId}/permissions/${module_code}`, data),
  deleteUserPermission: (userId, module_code) =>
    apiClient.delete(`/api/admin/modules/users/${userId}/permissions/${module_code}`),
}
