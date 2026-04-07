import { apiClient } from "@/api/client"

export const ticketPerformanceApi = {
  get: (days = 30) => apiClient.get("/api/admin/tickets/performance", { params: { days } }),
  askAnalyst: (question, off_topic_count = 0) => apiClient.post("/api/admin/tickets/performance/analyst", { question, off_topic_count }),
}
