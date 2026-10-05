import React, { useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { useAuth } from '../../hooks/useAuth';

const DashboardLayout = ({ vehicles = [] }) => {
  const { user, isAuthenticated, loading, restoreAdmin, hasAdminSession } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 768);
  const location = useLocation();
  const isHistoryPage = location.pathname.endsWith('/history');

  React.useEffect(() => {
    const handleResize = () => {
      setSidebarOpen(window.innerWidth > 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
      {hasAdminSession && (
        <div style={{
          background: '#FFFBEB',
          borderBottom: '1px solid #FCD34D',
          padding: '8px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '13px',
          fontWeight: 600,
          color: '#B45309',
          zIndex: 10001,
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '14px' }}>⚠️</span>
            <span>You are currently viewing as <strong>{user?.name || user?.email || 'impersonated user'}</strong> ({user?.role || 'user'}).</span>
          </div>
          <button
            onClick={async (e) => {
              e.preventDefault();
              const res = await restoreAdmin();
              if (res.success) {
                window.location.href = '/dashboard';
              } else {
                alert(res.error || 'Failed to restore admin session');
              }
            }}
            style={{
              background: '#D97706',
              color: '#FFFFFF',
              border: 'none',
              padding: '4px 12px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 2px 4px rgba(217,119,6,0.2)',
            }}
          >
            Return to Admin Panel
          </button>
        </div>
      )}

      <Topbar
        onMenuClick={() => setSidebarOpen(!sidebarOpen)}
        vehicles={vehicles}
      />

      <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {!isHistoryPage && (
          <Sidebar
            isOpen={sidebarOpen}
            toggleMobileSidebar={setSidebarOpen}
          />
        )}

        <main style={{ flex: 1, overflowY: 'auto', background: '#EEF5F8', position: 'relative' }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
