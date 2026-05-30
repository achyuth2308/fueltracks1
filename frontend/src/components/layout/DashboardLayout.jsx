import React, { useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { useAuth } from '../../hooks/useAuth';

const DashboardLayout = ({ vehicles = [] }) => {
  const { isAuthenticated, loading } = useAuth();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  if (loading) {
    return (
      <div className="loading-screen">
        <div style={{ position: 'relative', width: '48px', height: '48px' }}>
          <div style={{
            position: 'absolute', inset: 0,
            border: '2px solid rgba(37,99,235,0.12)',
            borderTopColor: '#2563eb',
            borderRadius: '50%',
            animation: 'spin 0.75s linear infinite',
          }} />
          <div style={{
            position: 'absolute', inset: '8px',
            border: '2px solid rgba(37,99,235,0.08)',
            borderTopColor: 'rgba(37,99,235,0.4)',
            borderRadius: '50%',
            animation: 'spin 1.2s linear infinite reverse',
          }} />
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#7c8db0', letterSpacing: '0.02em' }}>
            Loading FuelTracks
          </div>
          <div style={{ fontSize: '10px', color: '#2d3748', marginTop: '4px', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Restoring session...
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div style={{
      display: 'flex',
      height: '100vh',
      background: '#0a0f1e',
      overflow: 'hidden',
    }}>
      <Sidebar
        isOpen={mobileSidebarOpen}
        toggleMobileSidebar={setMobileSidebarOpen}
      />

      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, overflow: 'hidden' }}>
        <Topbar
          onMenuClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
          vehicles={vehicles}
        />
        <main style={{ flex: 1, overflowY: 'auto', background: '#0a0f1e', position: 'relative' }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
