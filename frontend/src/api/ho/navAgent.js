import { apiClient } from "@/api/client"

export const navAgentApi = {
  getConfig: () => apiClient.get("/api/ho/navision/config"),
  updateConfig: (updates) => apiClient.put("/api/ho/navision/config", { updates }),
}
