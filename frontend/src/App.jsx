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
import AdminUsers from "@/pages/admin/AdminUsers"
import UtilitiesDashboard from "@/pages/utilities/UtilitiesDashboard"
import ConsultaDatabase from "@/pages/utilities/ConsultaDatabase"
import GeneraTabelle from "@/pages/utilities/GeneraTabelle"
import StoresPage from "@/pages/utilities/StoresPage"
import TicketDatabase from "@/pages/utilities/TicketDatabase"
import TicketList from "@/pages/tickets/TicketList"
import TicketCreate from "@/pages/tickets/TicketCreate"
import TicketDetail from "@/pages/tickets/TicketDetail"
import TicketDashboard from "@/pages/tickets/TicketDashboard"
import TicketHistory from "@/pages/tickets/TicketHistory"
import TicketPerformance from "@/pages/tickets/TicketPerformance"
import SupportLookup from "@/pages/admin/SupportLookup"
import TicketConfig from "@/pages/admin/TicketConfig"
import TicketConfigHub from "@/pages/utilities/TicketConfigHub"
import ProfilePage from "@/pages/ProfilePage"
import SettingsPage from "@/pages/SettingsPage"
import StockUnifiedPage from "@/pages/utilities/stock/StockUnifiedPage"


function RoleRedirect() {
  const user = useAuthStore((s) => s.user)
  if (!user) return <Navigate to="/login" replace />
  const roleHome = { ADMIN: "/ho", HO: "/ho", DM: "/ho", STORE: "/ho" }
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
        <Route path="ho" element={<RoleRoute roles={["ADMIN", "HO", "DM", "STORE"]}><HODashboard /></RoleRoute>} />
        <Route path="ho/sales/it01" element={<RoleRoute roles={["ADMIN", "HO", "DM", "STORE"]}><SalesIT01 /></RoleRoute>} />
        <Route path="ho/sales/it02" element={<RoleRoute roles={["ADMIN", "HO", "DM", "STORE"]}><SalesIT02 /></RoleRoute>} />
        <Route path="ho/sales/it03" element={<RoleRoute roles={["ADMIN", "HO", "DM", "STORE"]}><SalesIT03 /></RoleRoute>} />
        <Route path="ho/sales/report" element={<RoleRoute roles={["ADMIN", "HO", "DM", "STORE"]}><SalesReport /></RoleRoute>} />
        <Route path="ho/sales/excluded" element={<RoleRoute roles={["ADMIN", "HO", "DM", "STORE"]}><ExcludedStores /></RoleRoute>} />
        <Route path="utilities/navision" element={<RoleRoute roles={["ADMIN", "HO", "DM", "STORE"]}><NavisionPage /></RoleRoute>} />
        <Route path="admin" element={<RoleRoute roles={["ADMIN"]}><AdminUsers /></RoleRoute>} />
        <Route path="admin/support" element={<RoleRoute roles={["ADMIN"]}><SupportLookup /></RoleRoute>} />
        <Route path="admin/ticket-config" element={<RoleRoute roles={["ADMIN"]}><TicketConfig /></RoleRoute>} />
        <Route path="utilities" element={<RoleRoute roles={["ADMIN", "HO", "DM", "STORE"]}><UtilitiesDashboard /></RoleRoute>} />
        <Route path="utilities/consulta-database" element={<RoleRoute roles={["ADMIN", "HO", "DM", "STORE"]}><ConsultaDatabase /></RoleRoute>} />
        <Route path="utilities/genera-tabelle" element={<RoleRoute roles={["ADMIN", "HO"]}><GeneraTabelle /></RoleRoute>} />
        <Route path="utilities/stores" element={<RoleRoute roles={["ADMIN", "HO", "DM", "STORE"]}><StoresPage /></RoleRoute>} />
        <Route path="utilities/ticket-database" element={<RoleRoute roles={["ADMIN"]}><TicketDatabase /></RoleRoute>} />
        <Route path="utilities/ticket-config" element={<RoleRoute roles={["ADMIN"]}><TicketConfigHub /></RoleRoute>} />
        <Route path="utilities/genera-tabelle/stock" element={<RoleRoute roles={["ADMIN", "HO"]}><StockUnifiedPage /></RoleRoute>} />
        <Route path="tickets" element={<RoleRoute roles={["ADMIN", "HO", "DM", "STORE"]}><TicketList /></RoleRoute>} />
        <Route path="tickets/dashboard" element={<RoleRoute roles={["ADMIN"]}><TicketDashboard /></RoleRoute>} />
        <Route path="tickets/history" element={<RoleRoute roles={["ADMIN", "DM"]}><TicketHistory /></RoleRoute>} />
        <Route path="tickets/performance" element={<RoleRoute roles={["ADMIN"]}><TicketPerformance /></RoleRoute>} />
        <Route path="tickets/new" element={<RoleRoute roles={["ADMIN", "HO", "DM", "STORE"]}><TicketCreate /></RoleRoute>} />
        <Route path="tickets/:id" element={<RoleRoute roles={["ADMIN", "HO", "DM", "STORE"]}><TicketDetail /></RoleRoute>} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}