import { Navigate } from "react-router-dom"
import { useAuthStore } from "@/store/authStore"

export default function RoleRoute({ children, roles }) {
  const hasRole = useAuthStore((s) => s.hasRole)

  if (!hasRole(...roles)) {
    return <Navigate to="/unauthorized" replace />
  }
  return children
}
