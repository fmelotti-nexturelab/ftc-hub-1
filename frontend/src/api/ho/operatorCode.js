import { apiClient } from "@/api/client"

export const operatorCodeApi = {
  list: () => apiClient.get("/api/ho/operator-codes"),
  request: (data) => apiClient.post("/api/ho/operator-codes/request", data),
  badgeCount: () => apiClient.get("/api/ho/operator-codes/badge-count"),
  listRequests: () => apiClient.get("/api/ho/operator-codes/requests"),
  takeOver: () => apiClient.post("/api/ho/operator-codes/requests/take-over"),
  processRequest: (id) => apiClient.delete(`/api/ho/operator-codes/requests/${id}`),
  bulkDeleteRequests: (ids) => apiClient.delete("/api/ho/operator-codes/requests/bulk-delete", { data: { ids } }),
  markNotified: (ids) => apiClient.post("/api/ho/operator-codes/requests/mark-notified", { ids }),
  bulkRequest: (rows) => apiClient.post("/api/ho/operator-codes/bulk-request", { rows }),
  evadiRequest: (id, email) => apiClient.patch(`/api/ho/operator-codes/requests/${id}/evadi`, { email }),
  bulkEvadi: (rows) => apiClient.post("/api/ho/operator-codes/requests/bulk-evadi", { rows }),
  notifyOperators: (preview = false, ids = null, overrides = []) => {
    const params = new URLSearchParams()
    if (preview) params.set("preview", "true")
    if (ids?.length) params.set("ids", ids.join(","))
    const qs = params.toString()
    return apiClient.post(`/api/ho/operator-codes/notify${qs ? "?" + qs : ""}`, { overrides })
  },
  generateNavFiles: (ids = null) => {
    const qs = ids?.length ? `?ids=${ids.join(",")}` : ""
    return apiClient.post(`/api/ho/operator-codes/generate-nav-files${qs}`)
  },
  closeTicket: () => apiClient.post("/api/ho/operator-codes/requests/close-ticket"),
  clearTable: () => apiClient.delete("/api/ho/operator-codes/clear"),
  clearPool: () => apiClient.delete("/api/ho/operator-codes/pool/clear"),
  listPool: () => apiClient.get("/api/ho/operator-codes/pool"),
  poolOverwrite: (file) => {
    const form = new FormData()
    form.append("file", file)
    return apiClient.post("/api/ho/operator-codes/pool/overwrite", form, {
      headers: { "Content-Type": "multipart/form-data" },
    })
  },
  poolPreview: (formData) => apiClient.post("/api/ho/operator-codes/pool/preview", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  }),
  poolImport: (rows) => apiClient.post("/api/ho/operator-codes/pool/import", { rows }),
}
