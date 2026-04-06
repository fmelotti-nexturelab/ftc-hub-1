import { apiClient } from "@/api/client"

export const itemsApi = {
  uploadIT01: (file) => {
    const formData = new FormData()
    formData.append("file", file)
    return apiClient.post("/api/items/it01/import", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    })
  },

  getSessionsIT01: () => apiClient.get("/api/items/it01/sessions"),

  getItemsIT01: (sessionId, params = {}) =>
    apiClient.get(`/api/items/it01/sessions/${sessionId}/items`, { params }),

  exportItemsIT01: (sessionId, params = {}) =>
    apiClient.get(`/api/items/it01/sessions/${sessionId}/export`, { params }),

  generateFilesIT01: (sessionId) =>
    apiClient.post(`/api/items/it01/sessions/${sessionId}/generate-files`),

  downloadTblIT01: () =>
    apiClient.get("/api/items/it01/download-tbl", { responseType: "arraybuffer" }),

  getTblInfoIT01: () => apiClient.get("/api/items/it01/tbl-info"),

  generateItemList: (entity, rows) =>
    apiClient.post(`/api/items/${entity}/generate`, { rows }, { responseType: "arraybuffer" }),

  getPromo: () => apiClient.get("/api/items/promo"),
  replacePromo: (rows) => apiClient.put("/api/items/promo", { rows }),

  getBlackFriday: () => apiClient.get("/api/items/blackfriday"),
  replaceBlackFriday: (rows) => apiClient.put("/api/items/blackfriday", { rows }),

  getEccezioni: () => apiClient.get("/api/items/eccezioni"),
  replaceEccezioni: (eccezioni, bestseller) => apiClient.put("/api/items/eccezioni", { eccezioni, bestseller }),
  appendEccezioni: (rows) => apiClient.post("/api/items/eccezioni/eccezioni", { rows }),
  updateEccezione: (id, data) => apiClient.patch(`/api/items/eccezioni/eccezioni/${id}`, data),
  deleteEccezioni: (ids) => apiClient.delete("/api/items/eccezioni/eccezioni", { data: { ids } }),
  appendBestSeller: (rows) => apiClient.post("/api/items/eccezioni/bestseller", { rows }),
  updateBestSeller: (id, data) => apiClient.patch(`/api/items/eccezioni/bestseller/${id}`, data),
  deleteBestSeller: (ids) => apiClient.delete("/api/items/eccezioni/bestseller", { data: { ids } }),
}