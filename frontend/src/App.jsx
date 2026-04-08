import { Routes, Route, Navigate } from "react-router-dom"
import { useAuthStore } from "@/store/authStore"
import ProtectedRoute from "@/routes/ProtectedRoute"
import RoleRoute from "@/routes/RoleRoute"
import Login from "@/pages/Login"
import Unauthorized from "@/pages/Unauthorized"
import Home from "@/pages/Home"
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
import SchedulerPage from "@/pages/admin/SchedulerPage"
import TicketConfigHub from "@/pages/utilities/TicketConfigHub"
import ProfilePage from "@/pages/ProfilePage"
import SettingsPage from "@/pages/SettingsPage"
import StockUnifiedPage from "@/pages/utilities/stock/StockUnifiedPage"
import StockNavPage from "@/pages/utilities/StockNavPage"
import ItemListPage from "@/pages/utilities/ItemListPage"
import ItemListConsultPage from "@/pages/utilities/ItemListConsultPage"
import ItemListHub from "@/pages/utilities/ItemListHub"
import CodiceOperatore from "@/pages/ho/CodiceOperatore"
import CheckPrezziPage from "@/pages/utilities/CheckPrezziPage"
import StampaEtichettePage from "@/pages/utilities/StampaEtichettePage"


function RoleRedirect() {
  const user = useAuthStore((s) => s.user)
  if (!user) return <Navigate to="/login" replace />
  if (["SUPERUSER", "ADMIN", "IT"].includes(user.department)) return <Navigate to="/admin" replace />
  return <Navigate to="/utilities" replace />
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
        <Route index element={<Home />} />
        <Route path="ho" element={<HODashboard />} />
        <Route path="ho/sales/it01" element={<SalesIT01 />} />
        <Route path="ho/sales/it02" element={<SalesIT02 />} />
        <Route path="ho/sales/it03" element={<SalesIT03 />} />
        <Route path="ho/sales/report" element={<SalesReport />} />
        <Route path="ho/sales/excluded" element={<ExcludedStores />} />
        <Route path="utilities/navision" element={<NavisionPage />} />
        <Route path="ho/codice-operatore" element={<CodiceOperatore />} />
        <Route path="admin" element={<RoleRoute roles={["ADMIN", "IT"]}><AdminUsers /></RoleRoute>} />
        <Route path="admin/support" element={<RoleRoute roles={["ADMIN", "IT"]}><SupportLookup /></RoleRoute>} />
        <Route path="admin/ticket-config" element={<RoleRoute roles={["ADMIN", "IT"]}><TicketConfig /></RoleRoute>} />
        <Route path="admin/scheduler" element={<RoleRoute roles={["ADMIN", "IT"]}><SchedulerPage /></RoleRoute>} />
        <Route path="utilities" element={<UtilitiesDashboard />} />
        <Route path="utilities/consulta-database" element={<ConsultaDatabase />} />
        <Route path="utilities/genera-tabelle" element={<GeneraTabelle />} />
        <Route path="utilities/stores" element={<StoresPage />} />
        <Route path="utilities/ticket-database" element={<RoleRoute roles={["ADMIN", "IT"]}><TicketDatabase /></RoleRoute>} />
        <Route path="utilities/ticket-config" element={<RoleRoute roles={["ADMIN", "IT"]}><TicketConfigHub /></RoleRoute>} />
        <Route path="utilities/genera-tabelle/stock" element={<StockUnifiedPage />} />
        <Route path="utilities/genera-tabelle/item-list" element={<ItemListPage />} />
        <Route path="utilities/genera-tabelle/check-prezzi" element={<CheckPrezziPage />} />
        <Route path="utilities/stampa-etichette" element={<StampaEtichettePage />} />
        <Route path="utilities/consulta-database/stock-nav" element={<StockNavPage />} />
        <Route path="utilities/consulta-database/item-list" element={<ItemListHub />} />
        <Route path="utilities/consulta-database/item-list/it01" element={<ItemListConsultPage />} />
        <Route path="utilities/consulta-database/item-list/it02" element={<ItemListConsultPage />} />
        <Route path="utilities/consulta-database/item-list/it03" element={<ItemListConsultPage />} />
        <Route path="tickets" element={<TicketList />} />
        <Route path="tickets/dashboard" element={<RoleRoute roles={["ADMIN", "IT", "SUPERUSER", "MANAGER", "HR", "COMMERCIAL", "FINANCE", "MARKETING", "RETAIL", "TOPMGR"]}><TicketDashboard /></RoleRoute>} />
        <Route path="tickets/history" element={<RoleRoute roles={["ADMIN", "IT", "SUPERUSER", "MANAGER", "HR", "COMMERCIAL", "FINANCE", "MARKETING", "RETAIL", "TOPMGR"]}><TicketHistory /></RoleRoute>} />
        <Route path="tickets/performance" element={<RoleRoute roles={["ADMIN", "IT", "SUPERUSER", "MANAGER", "HR", "COMMERCIAL", "FINANCE", "MARKETING", "RETAIL", "TOPMGR"]}><TicketPerformance /></RoleRoute>} />
        <Route path="tickets/new" element={<TicketCreate />} />
        <Route path="tickets/:id" element={<TicketDetail />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}