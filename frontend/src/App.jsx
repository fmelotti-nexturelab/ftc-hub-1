import { Routes, Route, Navigate } from "react-router-dom"
import { useAuthStore } from "@/store/authStore"
import ProtectedRoute from "@/routes/ProtectedRoute"
import RoleRoute from "@/routes/RoleRoute"
import Login from "@/pages/Login"
import Unauthorized from "@/pages/Unauthorized"
import Shell from "@/components/layout/Shell"
import HODashboard from "@/pages/ho/HODashboard"
import SalesIT01 from "@/pages/ho/sales/SalesIT01"
import SalesIT02 from "@/pages/ho/sales/SalesIT02"
import SalesIT03 from "@/pages/ho/sales/SalesIT03"
import SalesReport from "@/pages/ho/sales/SalesReport"
import ExcludedStores from "@/pages/ho/sales/ExcludedStores"
import NavisionPage from "@/pages/ho/NavisionPage"


function RoleRedirect() {
  const user = useAuthStore((s) => s.user)
  if (!user) return <Navigate to="/login" replace />
  const roleHome = { ADMIN: "/ho", HO: "/ho", DM: "/dm", STORE: "/store" }
  return <Navigate to={roleHome[user.role] || "/ho"} replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/unauthorized" element={<Unauthorized />} />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Shell />
          </ProtectedRoute>
        }
      >
        <Route index element={<RoleRedirect />} />
        <Route path="ho" element={<RoleRoute roles={["ADMIN", "HO"]}><HODashboard /></RoleRoute>} />
        <Route path="ho/sales/it01" element={<RoleRoute roles={["ADMIN", "HO"]}><SalesIT01 /></RoleRoute>} />
        <Route path="ho/sales/it02" element={<RoleRoute roles={["ADMIN", "HO"]}><SalesIT02 /></RoleRoute>} />
        <Route path="ho/sales/it03" element={<RoleRoute roles={["ADMIN", "HO"]}><SalesIT03 /></RoleRoute>} />
        <Route path="ho/sales/report" element={<RoleRoute roles={["ADMIN", "HO"]}><SalesReport /></RoleRoute>} />
        <Route path="ho/sales/excluded" element={<RoleRoute roles={["ADMIN", "HO"]}><ExcludedStores /></RoleRoute>} />
        <Route path="ho/navision" element={<RoleRoute roles={["ADMIN", "HO"]}><NavisionPage /></RoleRoute>} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}