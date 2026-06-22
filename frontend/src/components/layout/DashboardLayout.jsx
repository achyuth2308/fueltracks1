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
      <div className="loading-screen" style={{ background: '#EEF5F8' }}>
        <div style={{ position: 'relative', width: '48px', height: '48px' }}>
          <div style={{
            position: 'absolute', inset: 0,
            border: '2px solid rgba(249,115,22,0.12)',
            borderTopColor: '#7ea0b6',
            borderRadius: '50%',
            animation: 'spin 0.75s linear infinite',
          }} />
          <div style={{
            position: 'absolute', inset: '8px',
            border: '2px solid rgba(249,115,22,0.08)',
            borderTopColor: 'rgba(249,115,22,0.4)',
            borderRadius: '50%',
            animation: 'spin 1.2s linear infinite reverse',
          }} />
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#4b5563', letterSpacing: '0.02em' }}>
            Loading FuelTracks
          </div>
          <div style={{ fontSize: '10px', color: '#6b7280', marginTop: '4px', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
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
      flexDirection: 'column',
      height: '100vh',
      background: '#EEF5F8',
      overflow: 'hidden',
    }}>
      <Topbar
        onMenuClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
        vehicles={vehicles}
      />

      <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <Sidebar
          isOpen={mobileSidebarOpen}
          toggleMobileSidebar={setMobileSidebarOpen}
        />
        
        <main style={{ flex: 1, overflowY: 'auto', background: '#EEF5F8', position: 'relative' }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
