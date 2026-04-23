import { apiClient } from "@/api/client"

export const operatorCodeApi = {
  list: () => apiClient.get("/api/ho/operator-codes"),
  request: (data) => apiClient.post("/api/ho/operator-codes/request", data),
  badgeCount: () => apiClient.get("/api/ho/operator-codes/badge-count"),
  listRequests: () => apiClient.get("/api/ho/operator-codes/requests"),
  takeOver: () => apiClient.post("/api/ho/operator-codes/requests/take-over"),
  processRequest: (id) => apiClient.delete(`/api/ho/operator-codes/requests/${id}`),
  bulkRequest: (rows) => apiClient.post("/api/ho/operator-codes/bulk-request", { rows }),
  evadiRequest: (id, email) => apiClient.patch(`/api/ho/operator-codes/requests/${id}/evadi`, { email }),
  generateNavFiles: () => apiClient.post("/api/ho/operator-codes/generate-nav-files"),
  bulkEvadi: (rows) => apiClient.post("/api/ho/operator-codes/requests/bulk-evadi", { rows }),
  notifyOperators: () => apiClient.post("/api/ho/operator-codes/notify"),
}
