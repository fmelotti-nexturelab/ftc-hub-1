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
}