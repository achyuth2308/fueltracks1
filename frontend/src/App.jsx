import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import DashboardLayout from './components/layout/DashboardLayout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import VehicleDetailPage from './pages/VehicleDetailPage';
import HistoryPage from './pages/HistoryPage';
import ReportPage from './pages/ReportPage';
import VehiclesAdminPage from './pages/admin/VehiclesAdminPage';
import OrgsAdminPage from './pages/admin/OrgsAdminPage';
import UsersAdminPage from './pages/admin/UsersAdminPage';

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

            {/* Guarded dashboard route layout shell */}
            <Route path="/" element={<DashboardLayout vehicles={vehicles} />}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<DashboardPage setAppVehicles={setVehicles} />} />
              
              {/* Individual Vehicle details */}
              <Route path="vehicles/:id" element={<VehicleDetailPage />} />
              <Route path="vehicles/:id/history" element={<HistoryPage />} />
              <Route path="vehicles/:id/report" element={<ReportPage />} />

              {/* Admin roster management grids */}
              <Route path="admin/vehicles" element={<VehiclesAdminPage />} />
              <Route path="admin/organizations" element={<OrgsAdminPage />} />
              <Route path="admin/users" element={<UsersAdminPage />} />
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
