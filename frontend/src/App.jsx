import React, { useState } from 'react';

import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import ProtectedRoute from './components/layout/ProtectedRoute';
import DashboardLayout from './components/layout/DashboardLayout';
import LoginPage from './pages/LoginPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import DashboardPage from './pages/user/DashboardPage';
import VehicleDetailPage from './pages/user/VehicleDetailPage';
import HistoryPage from './pages/user/HistoryPage';
import ReportPage from './pages/user/ReportPage';
import SensorLogsPage from './pages/user/SensorLogsPage';
import TrackingPage from './pages/user/TrackingPage';
import VehiclesAdminPage from './pages/admin/VehiclesAdminPage';
import OrgsAdminPage from './pages/admin/OrgsAdminPage';
import UsersAdminPage from './pages/admin/UsersAdminPage';
import GroupsAdminPage from './pages/admin/GroupsAdminPage';
import DevicesAdminPage from './pages/admin/DevicesAdminPage';
import EditVehiclePage from './pages/admin/EditVehiclePage';
import MigrationPage from './pages/admin/MigrationPage';
import DeviceOnboardingPage from './pages/admin/DeviceOnboardingPage';
import OnBoardDevicePage from './pages/admin/OnBoardDevicePage';
import FuelAdminPage from './pages/admin/FuelAdminPage';
import AlertsAdminPage from './pages/admin/AlertsAdminPage';
import GeofencesAdminPage from './pages/admin/GeofencesAdminPage';
import ReportsAdminPage from './pages/admin/ReportsAdminPage';
import TripReportPage from './pages/reports/TripReportPage';
import DailyDistanceReportPage from './pages/reports/DailyDistanceReportPage';
import RouteHistoryReportPage from './pages/reports/RouteHistoryReportPage';
import OverspeedingReportPage from './pages/reports/OverspeedingReportPage';
import StoppageReportPage from './pages/reports/StoppageReportPage';
import IdleReportPage from './pages/reports/IdleReportPage';
import ConsolidatedReportPage from './pages/reports/ConsolidatedReportPage';
import IndividualReportPage from './pages/reports/IndividualReportPage';
import OrganizationProfilePage from './modules/profile/OrganizationProfilePage';
import AuditLogsAdminPage from './pages/admin/AuditLogsAdminPage';
import SettingsAdminPage from './pages/admin/SettingsAdminPage';
import BillingAdminPage from './pages/admin/BillingAdminPage';
import AdminRenewalsPage from './pages/admin/AdminRenewalsPage';
import CustomerRenewalsPage from './pages/user/CustomerRenewalsPage';

function App() {
  // Share vehicles state list globally to update the Topbar statistics dynamically
  const [vehicles, setVehicles] = useState([]);

  return (
    <BrowserRouter>
      <AuthProvider>
        <SocketProvider>
          <Routes>
            {/* Public authentication route */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />

            {/* Guarded dashboard route layout shell */}
            <Route path="/" element={<DashboardLayout vehicles={vehicles} />}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<DashboardPage setAppVehicles={setVehicles} />} />
              <Route path="tracking" element={<TrackingPage setAppVehicles={setVehicles} />} />

              {/* Individual Vehicle details */}
              <Route path="vehicles/:id" element={<VehicleDetailPage />} />
              <Route path="vehicles/:id/history" element={<HistoryPage />} />
              <Route path="vehicles/:id/report" element={<ReportPage />} />
              <Route path="vehicles/:id/messages" element={<SensorLogsPage />} />

              {/* Admin Protected Routes (Strictly Superadmin/Dealer) */}
              <Route path="admin" element={<ProtectedRoute allowedRoles={['superadmin', 'dealer']}><Outlet /></ProtectedRoute>}>
                {/* Admin roster management grids */}
                <Route path="organizations" element={<OrgsAdminPage />} />
                <Route path="users" element={<UsersAdminPage />} />
                <Route path="groups" element={<GroupsAdminPage />} />
                <Route path="vehicles" element={<VehiclesAdminPage />} />
                <Route path="vehicles/add" element={<EditVehiclePage />} />
                <Route path="vehicles/edit/:id" element={<EditVehiclePage />} />
                <Route path="vehicles/migration/:id" element={<MigrationPage />} />
                <Route path="devices" element={<DevicesAdminPage />} />
                <Route path="billing" element={<BillingAdminPage />} />
                <Route path="renewal-config" element={<AdminRenewalsPage />} />
                <Route path="profile" element={<OrganizationProfilePage />} />
                <Route path="audit-logs" element={<AuditLogsAdminPage />} />
                <Route path="settings" element={<SettingsAdminPage />} />
              </Route>

              {/* Shared Protected Routes (All authenticated users including customers) */}
              <Route path="admin" element={<ProtectedRoute allowedRoles={['superadmin', 'dealer', 'customer']}><Outlet /></ProtectedRoute>}>
                {/* System and Integrations */}
                <Route path="fuel" element={<FuelAdminPage />} />
                <Route path="alerts" element={<AlertsAdminPage />} />
                <Route path="geofences" element={<GeofencesAdminPage />} />
                <Route path="reports" element={<ReportsAdminPage />}>
                  <Route path="trip" element={<TripReportPage />} />
                  <Route path="distance" element={<DailyDistanceReportPage />} />
                  <Route path="route" element={<RouteHistoryReportPage />} />
                  <Route path="overspeeding" element={<OverspeedingReportPage />} />
                  <Route path="stoppage" element={<StoppageReportPage />} />
                  <Route path="idle" element={<IdleReportPage />} />
                  <Route path="consolidated" element={<ConsolidatedReportPage />} />
                  <Route path="individual" element={<IndividualReportPage />} />
                </Route>
              </Route>

              {/* These are not strictly /admin paths but act like it, keeping them unprotected or as is based on existing paths */}
              <Route path="renewals" element={<CustomerRenewalsPage />} />
              <Route path="onBoardDevice" element={<OnBoardDevicePage />} />
            </Route>

            {/* Catch-all redirect */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </SocketProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
