import { apiClient } from "@/api/client";

export const diagnosticsApi = {
  get: () => apiClient.get("/api/admin/diagnostics"),
};
