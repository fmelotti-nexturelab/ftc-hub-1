import { apiClient } from "@/api/client"

export const salesApi = {
  getExcludedStores: () => apiClient.get("/api/ho/sales/excluded-stores"),
  addExcludedStore: (data) => apiClient.post("/api/ho/sales/excluded-stores", data),
  removeExcludedStore: (id) => apiClient.delete(`/api/ho/sales/excluded-stores/${id}`),
  parseSalesData: (payload) => apiClient.post("/api/ho/sales/parse", payload),
}
