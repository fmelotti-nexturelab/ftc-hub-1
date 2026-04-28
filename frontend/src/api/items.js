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
  exportCurrentIT01: () => apiClient.get("/api/items/it01/current/export"),

  generateItemList: (entity, rows) =>
    apiClient.post(`/api/items/${entity}/generate`, { rows }, { responseType: "arraybuffer" }),

  getPromo: () => apiClient.get("/api/items/promo"),
  replacePromo: (rows) => apiClient.put("/api/items/promo", { rows }),

  getBlackFriday: () => apiClient.get("/api/items/blackfriday"),
  replaceBlackFriday: (rows) => apiClient.put("/api/items/blackfriday", { rows }),

  getEccezioniLastSync: () => apiClient.get("/api/items/eccezioni/last-sync"),
  getEccezioni: () => apiClient.get("/api/items/eccezioni"),
  replaceEccezioni: (eccezioni, bestseller) => apiClient.put("/api/items/eccezioni", { eccezioni, bestseller }),
  appendEccezioni: (rows) => apiClient.post("/api/items/eccezioni/eccezioni", { rows }),
  updateEccezione: (id, data) => apiClient.patch(`/api/items/eccezioni/eccezioni/${id}`, data),
  deleteEccezioni: (ids) => apiClient.delete("/api/items/eccezioni/eccezioni", { data: { ids } }),
  appendBestSeller: (rows) => apiClient.post("/api/items/eccezioni/bestseller", { rows }),
  updateBestSeller: (id, data) => apiClient.patch(`/api/items/eccezioni/bestseller/${id}`, data),
  deleteBestSeller: (ids) => apiClient.delete("/api/items/eccezioni/bestseller", { data: { ids } }),

  lookupItem: (item_no) => apiClient.get("/api/items/it01/lookup", { params: { item_no } }),

  getScrapInv: () => apiClient.get("/api/items/scrap-inv"),
  replaceScrapInv: (rows) => apiClient.put("/api/items/scrap-inv", { rows }),
  appendScrapInv: (rows) => apiClient.post("/api/items/scrap-inv", { rows }),
  updateScrapInv: (id, data) => apiClient.patch(`/api/items/scrap-inv/${id}`, data),
  deleteScrapInv: (ids) => apiClient.delete("/api/items/scrap-inv", { data: { ids } }),

  getScrapWd: () => apiClient.get("/api/items/scrap-wd"),
  replaceScrapWd: (rows) => apiClient.put("/api/items/scrap-wd", { rows }),
  appendScrapWd: (rows) => apiClient.post("/api/items/scrap-wd", { rows }),
  updateScrapWd: (id, data) => apiClient.patch(`/api/items/scrap-wd/${id}`, data),
  deleteScrapWd: (ids) => apiClient.delete("/api/items/scrap-wd", { data: { ids } }),

  getPicking: () => apiClient.get("/api/items/picking"),
  replacePicking: (rows) => apiClient.put("/api/items/picking", { rows }),
  appendPicking: (rows) => apiClient.post("/api/items/picking", { rows }),
  updatePicking: (id, data) => apiClient.patch(`/api/items/picking/${id}`, data),
  deletePicking: (ids) => apiClient.delete("/api/items/picking", { data: { ids } }),

  enrichLabels: (zebraCodes, mode = "normal") => apiClient.post("/api/items/labels/enrich", { zebra_codes: zebraCodes, mode }),

  getExpoListLastSync: () => apiClient.get("/api/items/expo-list/last-sync"),
  syncExpoList: (items) => apiClient.post("/api/items/expo-list/sync", { items }),

  getEcoListLastSync: () => apiClient.get("/api/items/eco-list/last-sync"),
  syncEcoList: (items) => apiClient.post("/api/items/eco-list/sync", { items }),

  getKglListLastSync: () => apiClient.get("/api/items/kgl-list/last-sync"),
  syncKglList: (items) => apiClient.post("/api/items/kgl-list/sync", { items }),
}