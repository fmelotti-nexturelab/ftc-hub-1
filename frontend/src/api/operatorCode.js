import { apiClient } from "@/api/client"

export const operatorCodeApi = {
  list: () => apiClient.get("/api/ho/operator-codes").then((r) => r.data),
}
