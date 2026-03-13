import { apiClient } from "./client"

export const authApi = {
  login: (username, password) =>
    apiClient.post("/api/auth/login", { username, password }),
  logout: () => apiClient.post("/api/auth/logout"),
  me: () => apiClient.get("/api/auth/me"),
}
