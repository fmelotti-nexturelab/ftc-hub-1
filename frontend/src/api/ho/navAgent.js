import { apiClient } from "@/api/client"

export const navAgentApi = {
  getConfig: () => apiClient.get("/api/ho/nav-agent/config"),
  updateConfig: (updates) => apiClient.put("/api/ho/nav-agent/config", { updates }),
}
