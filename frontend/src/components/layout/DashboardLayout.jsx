import React, { useState, useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { useAuth } from '../../hooks/useAuth';
import ErrorBoundary from '../ErrorBoundary';
import axiosInstance from '../../api/axios';

const DashboardLayout = ({ vehicles = [] }) => {
  const { user, isAuthenticated, loading } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 768);
  const [brandProfile, setBrandProfile] = useState(null);
  const location = useLocation();

  useEffect(() => {
    const loadProfile = () => {
      axiosInstance.get('/api/profile').then(res => {
        if (res.data?.success && res.data.profile) {
          setBrandProfile(res.data.profile);
        }
      }).catch(() => { });
    };
    if (isAuthenticated) {
      loadProfile();
    }

    const handleProfileUpdated = (e) => {
      if (e.detail) setBrandProfile(e.detail);
      else loadProfile();
    };
    window.addEventListener('profile-updated', handleProfileUpdated);
    return () => window.removeEventListener('profile-updated', handleProfileUpdated);
  }, [user, isAuthenticated]);

  const isDealerUser = brandProfile?.is_dealer_customer || 
                       brandProfile?.org_type === 'dealer' || 
                       brandProfile?.is_dealer ||
                       (brandProfile?.brand_name && !['FUELTRACKS', 'FUELTRACKS PLATFORM'].includes(brandProfile.brand_name.toUpperCase())) ||
                       (user?.orgName && !['FUELTRACKS', 'FUELTRACKS PLATFORM'].includes(user.orgName.toUpperCase()) && user?.role !== 'superadmin');

  const isFuelTracksCustomer = !isDealerUser && (brandProfile?.is_fueltracks_direct || user?.role === 'superadmin' || !brandProfile?.is_whitelabel_enabled);

  const supportBrand = (brandProfile?.brand_name || brandProfile?.company_name || user?.orgName || 'FUELTRACKS').toUpperCase();
  const supportPhone = brandProfile?.support_phone || 
                       brandProfile?.dealer_phone || 
                       brandProfile?.whatsapp_number || 
                       brandProfile?.mobile || 
                       (isFuelTracksCustomer ? '7337433351' : '');
  const supportEmail = (brandProfile?.support_email || 
                       brandProfile?.dealer_email || 
                       brandProfile?.email || 
                       (isFuelTracksCustomer ? 'info@fueltracks.in' : '')).toLowerCase();
  const isAdmin = user?.role === 'superadmin' || location.pathname.startsWith('/admin');

  React.useEffect(() => {
    const handleResize = () => {
      setSidebarOpen(window.innerWidth > 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  React.useEffect(() => {
    if (window.innerWidth <= 768) {
      setSidebarOpen(false);
    }
  }, [location.pathname]);

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
            Loading...
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
        onMenuClick={() => setSidebarOpen(prev => !prev)}
        vehicles={vehicles}
      />

      <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <Sidebar
          isOpen={sidebarOpen}
          toggleMobileSidebar={setSidebarOpen}
        />

        <main style={{ flex: 1, overflowY: 'auto', background: '#EEF5F8', position: 'relative' }}>
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>

      {/* Floating Bottom Support Badge (Only for non-admin users / customers) */}
      {!isAdmin && (
        <div
          style={{
            position: 'fixed',
            bottom: '8px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 9995,
            background: '#006778',
            color: '#FFFFFF',
            padding: '4px 14px',
            borderRadius: '4px',
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '0.02em',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.25)',
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            pointerEvents: 'auto',
            userSelect: 'none',
            whiteSpace: 'nowrap',
            fontFamily: "'Inter', system-ui, sans-serif"
          }}
        >
          <span>Support Details:</span>
          <span style={{ color: '#E0F2FE' }}>{supportBrand}</span>
          {supportPhone && (
            <>
              <span>,</span>
              <a
                href={`tel:${supportPhone}`}
                style={{ color: '#FFFFFF', textDecoration: 'none' }}
                onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
                onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}
              >
                {supportPhone}
              </a>
            </>
          )}
          {supportEmail && (
            <>
              <span>,</span>
              <a
                href={`mailto:${supportEmail}`}
                style={{ color: '#FFFFFF', textDecoration: 'none' }}
                onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
                onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}
              >
                {supportEmail}
              </a>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default DashboardLayout;
