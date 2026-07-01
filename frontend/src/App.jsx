import React, { useState } from 'react';

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
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
import VehicleActivityReportPage from './pages/reports/VehicleActivityReportPage';
import RouteHistoryReportPage from './pages/reports/RouteHistoryReportPage';
import IgnitionReportPage from './pages/reports/IgnitionReportPage';
import OverspeedingReportPage from './pages/reports/OverspeedingReportPage';
import StoppageReportPage from './pages/reports/StoppageReportPage';
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

              {/* Admin roster management grids */}
              <Route path="admin/organizations" element={<OrgsAdminPage />} />
              <Route path="admin/users" element={<UsersAdminPage />} />
              <Route path="admin/groups" element={<GroupsAdminPage />} />
              <Route path="admin/vehicles" element={<VehiclesAdminPage />} />
              <Route path="admin/vehicles/add" element={<EditVehiclePage />} />
              <Route path="admin/vehicles/edit/:id" element={<EditVehiclePage />} />
              <Route path="admin/vehicles/migration/:id" element={<MigrationPage />} />
              <Route path="admin/devices" element={<DevicesAdminPage />} />
              <Route path="admin/billing" element={<BillingAdminPage />} />
              <Route path="admin/renewal-config" element={<AdminRenewalsPage />} />
              <Route path="renewals" element={<CustomerRenewalsPage />} />
              <Route path="onBoardDevice" element={<OnBoardDevicePage />} />

              {/* System and Integrations */}
              <Route path="admin/fuel" element={<FuelAdminPage />} />
              <Route path="admin/alerts" element={<AlertsAdminPage />} />
              <Route path="admin/geofences" element={<GeofencesAdminPage />} />
              <Route path="admin/reports" element={<ReportsAdminPage />} />
              <Route path="admin/reports/trip" element={<TripReportPage />} />
              <Route path="admin/reports/distance" element={<DailyDistanceReportPage />} />
              <Route path="admin/reports/activity" element={<VehicleActivityReportPage />} />
              <Route path="admin/reports/route" element={<RouteHistoryReportPage />} />
              <Route path="admin/reports/ignition" element={<IgnitionReportPage />} />
              <Route path="admin/reports/overspeeding" element={<OverspeedingReportPage />} />
              <Route path="admin/reports/stoppage" element={<StoppageReportPage />} />
              <Route path="admin/reports/consolidated" element={<ConsolidatedReportPage />} />
              <Route path="admin/reports/individual" element={<IndividualReportPage />} />
              <Route path="admin/profile" element={<OrganizationProfilePage />} />
              <Route path="admin/audit-logs" element={<AuditLogsAdminPage />} />
              <Route path="admin/settings" element={<SettingsAdminPage />} />
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
