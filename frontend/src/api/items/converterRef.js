import { apiClient } from "@/api/client"
import { useAuthStore } from "@/store/authStore"
import { AGENT_URL } from "@/lib/navAgent"

const BASE = "/api/items/converter"

export const converterRefApi = {
  getIva: () => apiClient.get(`${BASE}/iva`),

  getStats:  (table)               => apiClient.get(`${BASE}/${table}/stats`),
  getItems:  (table, params = {})  => apiClient.get(`${BASE}/${table}`, { params }),

  importFromExcel: (table, file) => {
    const fd = new FormData()
    fd.append("file", file)
    return apiClient.post(`${BASE}/${table}/import`, fd)
  },

  importFromTsv: (tsv) => apiClient.post(`${BASE}/raw-nav/import-tsv`, { tsv }),

  getStatus: ()     => apiClient.get(`${BASE}/status`),
  assemble:  ()     => apiClient.post(`${BASE}/assemble`),

  bridgeSync: (noExcel = false) => {
    const token = useAuthStore.getState().accessToken
    const backendUrl = window.location.origin
    return fetch(`${AGENT_URL}/bridge-sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ no_excel: noExcel, backend_url: backendUrl, token }),
    }).then(r => r.ok ? r.json() : r.json().then(d => Promise.reject(d)))
  },
}
