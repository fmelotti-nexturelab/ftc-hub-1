import { apiClient } from "@/api/client"

export const ticketPerformanceApi = {
  get: (days = 30) => apiClient.get("/api/admin/tickets/performance", { params: { days } }),
}
