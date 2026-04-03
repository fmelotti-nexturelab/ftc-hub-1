import { apiClient } from "./client"

export const appSettingsApi = {
  getAll: () => apiClient.get("/api/settings"),
  get: (key) => apiClient.get(`/api/settings/${key}`),
  update: (key, value) => apiClient.put(`/api/settings/${key}`, { value }),
}
