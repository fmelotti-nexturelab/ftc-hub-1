import { apiClient } from "@/api/client"

export const navisionApi = {
  getConfigs: () => apiClient.get("/api/navision/configs"),
  getRdpParams: (configId) => apiClient.get(`/api/navision/rdp-params/${configId}`),
  createConfig: (data) => apiClient.post("/api/navision/configs", data),
  updateConfig: (configId, data) => apiClient.put(`/api/navision/configs/${configId}`, data),
  deleteConfig: (configId) => apiClient.delete(`/api/navision/configs/${configId}`),
}
