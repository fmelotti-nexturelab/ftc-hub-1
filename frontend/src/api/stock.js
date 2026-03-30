import { apiClient } from "@/api/client"

export const stockApi = {
  uploadCsv: (file, entity) => {
    const formData = new FormData()
    formData.append("file", file)
    formData.append("entity", entity)
    return apiClient.post("/api/stock/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    })
  },
  getSessions: (entity) => apiClient.get("/api/stock/sessions", { params: { entity } }),
  getSessionItems: (sessionId, params) =>
    apiClient.get(`/api/stock/sessions/${sessionId}/items`, { params }),
  getAllItems: (sessionId) =>
    apiClient.get(`/api/stock/sessions/${sessionId}/all-items`),
  getStoreItems: (sessionId, storeCode, params) =>
    apiClient.get(`/api/stock/sessions/${sessionId}/by-store/${storeCode}`, { params }),
  getSessionStores: (sessionId) =>
    apiClient.get(`/api/stock/sessions/${sessionId}/stores`),
  exportExcel: (sessionId, storeCode) =>
    apiClient.get(`/api/stock/sessions/${sessionId}/export`, {
      params: { format: "xlsx", store_code: storeCode || undefined },
      responseType: "blob",
    }),
  stockSplit: (stockDate, onDownloadProgress) =>
    apiClient.get("/api/stock/stocksplit", { params: { stock_date: stockDate }, responseType: "blob", onDownloadProgress }),
  admExtract: (stockDate, onDownloadProgress) =>
    apiClient.get("/api/stock/adm-extract", { params: { stock_date: stockDate }, responseType: "blob", onDownloadProgress }),
  deleteSession: (sessionId) => apiClient.delete(`/api/stock/sessions/${sessionId}`),
  getStats: () => apiClient.get("/api/stock/stats"),
  getArchiveDates: (fileType, entity) =>
    apiClient.get("/api/archive/dates", { params: { file_type: fileType, entity } }),
  registerArchive: (payload) => apiClient.post("/api/archive/register", payload),
}
