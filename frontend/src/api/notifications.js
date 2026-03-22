import { apiClient } from "@/api/client";

export const notificationsApi = {
  list: () => apiClient.get("/api/notifications"),
  unreadCount: () => apiClient.get("/api/notifications/unread-count"),
  markRead: (id) => apiClient.post(`/api/notifications/${id}/read`),
  markAllRead: () => apiClient.post("/api/notifications/read-all"),
};
