import { apiClient } from "./client"

export const schedulerApi = {
  getJobs: () => apiClient.get("/api/admin/scheduler/jobs"),
  toggleJob: (name) => apiClient.put(`/api/admin/scheduler/jobs/${name}/toggle`),
  runJobNow: (name) => apiClient.post(`/api/admin/scheduler/jobs/${name}/run`),
  getJobLogs: (name, limit = 20) => apiClient.get(`/api/admin/scheduler/jobs/${name}/logs`, { params: { limit } }),
}
