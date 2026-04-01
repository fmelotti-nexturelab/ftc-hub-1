import { apiClient } from "@/api/client"

export const navisionApi = {
  // Credenziali
  getCredentials: () =>
    apiClient.get("/api/ho/navision/credentials").then((r) => r.data),

  addCredential: (data) =>
    apiClient.post("/api/ho/navision/credentials", data).then((r) => r.data),

  updatePassword: (credId, nav_password) =>
    apiClient
      .put(`/api/ho/navision/credentials/${credId}/password`, { nav_password })
      .then((r) => r.data),

  deleteCredential: (credId) =>
    apiClient.delete(`/api/ho/navision/credentials/${credId}`).then((r) => r.data),

  // RDP download
  downloadRdp: async (rdpKey) => {
    const response = await apiClient.get(`/api/ho/navision/rdp/${rdpKey}`, {
      responseType: "blob",
    })
    const url = URL.createObjectURL(response.data)
    const a = document.createElement("a")
    a.href = url
    a.download = `nav_${rdpKey}.rdp`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  },

  // RDP upload (solo IT/ADMIN)
  uploadRdp: (rdpKey, file) => {
    const formData = new FormData()
    formData.append("file", file)
    return apiClient
      .post(`/api/ho/navision/rdp/${rdpKey}`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then((r) => r.data)
  },

  // Download agent installer
  downloadAgentInstaller: async () => {
    const response = await apiClient.get("/api/ho/navision/agent-installer", {
      responseType: "blob",
    })
    const url = URL.createObjectURL(response.data)
    const a = document.createElement("a")
    a.href = url
    a.download = "ftchub_nav_agent.zip"
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  },

  // Config (solo IT/ADMIN)
  getConfig: () =>
    apiClient.get("/api/ho/navision/config").then((r) => r.data),

  updateConfig: (updates) =>
    apiClient.put("/api/ho/navision/config", { updates }).then((r) => r.data),
}
