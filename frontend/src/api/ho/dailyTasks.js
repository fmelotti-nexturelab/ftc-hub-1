import { apiClient } from "@/api/client"

export const dailyTasksApi = {
  getTasks:  ()              => apiClient.get("/api/ho/daily-tasks"),
  complete:  (task_ids, notes) => apiClient.post("/api/ho/daily-tasks/complete", { task_ids, notes }),
  getHistory: (days = 7)    => apiClient.get("/api/ho/daily-tasks/history", { params: { days } }),
}
