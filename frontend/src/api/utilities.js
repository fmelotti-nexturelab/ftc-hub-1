import { apiClient } from "@/api/client"

export const utilitiesApi = {
  getMyAccess: () => apiClient.get("/api/utilities/my-access"),
  getStores: (params) => apiClient.get("/api/utilities/stores", { params }),
  getStoreFilters: () => apiClient.get("/api/utilities/stores/filters"),
  createStore: (data) => apiClient.post("/api/utilities/stores", data),
  updateStore: (id, data) => apiClient.put(`/api/utilities/stores/${id}`, data),
  deleteStore: (id) => apiClient.delete(`/api/utilities/stores/${id}`),
}
