import { apiClient } from "@/api/client"

export const rbacApi = {
  getRoles: () => apiClient.get("/api/admin/rbac/roles"),
  getRolePermissions: (roleId) => apiClient.get(`/api/admin/rbac/roles/${roleId}/permissions`),
  addRolePermission: (roleId, data) => apiClient.post(`/api/admin/rbac/roles/${roleId}/permissions`, data),
  removeRolePermission: (roleId, rpsId) => apiClient.delete(`/api/admin/rbac/roles/${roleId}/permissions/${rpsId}`),
  getPermissions: () => apiClient.get("/api/admin/rbac/permissions"),
  getScopes: () => apiClient.get("/api/admin/rbac/scopes"),

  getUserRoles: (userId) => apiClient.get(`/api/admin/rbac/users/${userId}/roles`),
  addUserRole: (userId, roleId) => apiClient.post(`/api/admin/rbac/users/${userId}/roles`, { role_id: roleId }),
  removeUserRole: (userId, assignmentId) => apiClient.delete(`/api/admin/rbac/users/${userId}/roles/${assignmentId}`),

  getUserOverrides: (userId) => apiClient.get(`/api/admin/rbac/users/${userId}/overrides`),
  addUserOverride: (userId, data) => apiClient.post(`/api/admin/rbac/users/${userId}/overrides`, data),
  removeUserOverride: (userId, overrideId) => apiClient.delete(`/api/admin/rbac/users/${userId}/overrides/${overrideId}`),

  getUserAssignments: (userId) => apiClient.get(`/api/admin/rbac/users/${userId}/assignments`),
  addUserAssignment: (userId, data) => apiClient.post(`/api/admin/rbac/users/${userId}/assignments`, data),
  removeUserAssignment: (userId, assignmentId) => apiClient.delete(`/api/admin/rbac/users/${userId}/assignments/${assignmentId}`),
}
