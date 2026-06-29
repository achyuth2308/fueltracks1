import React, { useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Briefcase,
  FileText,
  ClipboardList,
  Archive,
  Truck,
  Users,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Cpu,
  Navigation,
  ShieldAlert,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

const Sidebar = ({ isOpen, toggleMobileSidebar }) => {
  const { user, logout, restoreAdmin, hasAdminSession } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  const navGroups = [
    {
      label: '',
      items: [
        { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, roles: ['superadmin', 'dealer', 'customer'] },
        { name: 'Live Tracking', path: '/tracking', icon: Navigation, roles: ['customer'] },
        { name: 'Organisation', path: '/admin/organizations', icon: Briefcase, roles: ['superadmin', 'dealer'] },
        { name: 'Devices', path: '/admin/devices', icon: Cpu, roles: ['superadmin', 'dealer'] },
        { name: 'Billing', path: '/admin/billing', icon: FileText, roles: ['superadmin', 'dealer'] },
        { name: 'Renewal Config', path: '/admin/renewal-config', icon: RefreshCw, roles: ['superadmin', 'dealer'] },
        { name: 'Audit', path: '/admin/audit-logs', icon: ClipboardList, roles: ['superadmin', 'dealer'] },
        { name: 'Archived Audit', path: '/admin/audit-logs?archived=true', icon: Archive, roles: ['superadmin', 'dealer'] },
        { name: 'Vehicles', path: '/admin/vehicles', icon: Truck, roles: ['superadmin', 'dealer'] },
        { name: 'Groups', path: '/admin/groups', icon: Users, roles: ['superadmin', 'dealer'] },
        { name: 'Users', path: '/admin/users', icon: Users, roles: ['superadmin', 'dealer'] },
        { name: 'Geofences & Routes', path: '/admin/geofences', icon: ShieldAlert, roles: ['customer'] },
        { name: 'Reports', path: '/admin/reports', icon: FileText, roles: ['customer'] },
        { name: 'Renewals', path: '/renewals', icon: RefreshCw, roles: ['customer'] },
        { name: 'Organisation Profile', path: '/admin/profile', icon: Settings, roles: ['superadmin', 'dealer'] },
      ],
    },
  ];

  const handleRestoreAdmin = async () => {
    const res = await restoreAdmin();
    if (res.success) {
      navigate('/admin/users');
    } else {
      alert(res.error || 'Failed to restore admin session');
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const initials = user?.name
    ? user.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
    : 'U';

  const roleLabel = user?.role || 'Customer';

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={() => toggleMobileSidebar && toggleMobileSidebar(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 40,
            background: 'rgba(17, 24, 39, 0.5)',
            backdropFilter: 'blur(4px)',
          }}
          className="md:hidden"
        />
      )}

      <aside
        style={{
          width: collapsed ? '72px' : '260px',
          minWidth: collapsed ? '72px' : '260px',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          background: '#2E4867', // Live Color
          borderRight: '1px solid #475569',
          boxShadow: '4px 0 24px rgba(249,115,22,0.05)',
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          position: 'relative',
          flexShrink: 0,
          zIndex: 50,
        }}
        className={`${isOpen ? '' : '-translate-x-full'} md:translate-x-0 fixed md:static transition-transform`}
      >
        {/* User Profile Header */}
        <div style={{
          padding: '24px 16px 16px',
          borderBottom: '1px solid #475569',
          display: 'flex', flexDirection: 'column', gap: '16px',
          alignItems: collapsed ? 'center' : 'flex-start',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px', height: '40px', borderRadius: '50%', flexShrink: 0,
              background: '#2E4867', color: 'white',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '14px', fontWeight: 700,
              boxShadow: '0 4px 12px rgba(249,115,22,0.2)',
            }}>
              {initials}
            </div>
            {!collapsed && (
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#ffffff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {user?.name || 'Administrator'}
                </div>
                <div style={{ fontSize: '11px', color: '#f1f5f9', textTransform: 'capitalize' }}>
                  {roleLabel}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Expand Button (collapsed state) */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          style={{
            position: 'absolute', right: '-14px', top: '24px',
            width: '28px', height: '28px',
            background: '#2E4867',
            border: '1px solid #475569',
            borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: '#f1f5f9',
            zIndex: 60,
            boxShadow: '0 2px 8px rgba(249,115,22,0.05)',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = '#ffffff'; e.currentTarget.style.borderColor = '#5eead4'; }}
          onMouseLeave={e => { e.currentTarget.style.color = '#f1f5f9'; e.currentTarget.style.borderColor = '#475569'; }}
          className="hidden md:flex"
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>

        {/* Navigation */}
        <nav style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '16px 12px' }}>
          {navGroups.map((group) => {
            const visibleItems = group.items.filter(item => item.roles.includes(user?.role) || !user?.role);
            if (visibleItems.length === 0) return null;
            return (
              <div key={group.label || 'top'} style={{ marginBottom: '16px' }}>
                {!collapsed && group.label && (
                  <div style={{
                    fontSize: '11px', fontWeight: 700, letterSpacing: '0.12em',
                    textTransform: 'uppercase', color: '#99f6e4',
                    padding: '0 12px 8px',
                  }}>
                    {group.label}
                  </div>
                )}
                {collapsed && group.label && <div style={{ height: '12px' }} />}
                {visibleItems.map((item) => {
                  const Icon = item.icon;
                  const [itemPathBase, itemSearch] = item.path.split('?');
                  let customIsActive = false;

                  if (itemSearch) {
                    customIsActive = location.pathname === itemPathBase && location.search.includes(itemSearch);
                  } else if (item.path === '/admin/audit-logs') {
                    customIsActive = location.pathname === item.path && !location.search.includes('archived=true');
                  } else {
                    customIsActive = location.pathname === item.path || (item.path !== '/dashboard' && location.pathname.startsWith(item.path + '/'));
                  }

                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      onClick={() => toggleMobileSidebar && toggleMobileSidebar(false)}
                      style={() => ({
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: collapsed ? '10px' : '10px 14px',
                        borderRadius: '10px',
                        fontSize: '14px',
                        fontWeight: customIsActive ? 600 : 500,
                        color: customIsActive ? '#ffffff' : '#ccfbf1',
                        textDecoration: 'none',
                        justifyContent: collapsed ? 'center' : 'flex-start',
                        background: customIsActive ? '#475569' : 'transparent',
                        marginBottom: '4px',
                        transition: 'all 0.2s ease',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        position: 'relative'
                      })}
                      onMouseEnter={e => {
                        if (!e.currentTarget.style.background.includes('172a45')) {
                          e.currentTarget.style.color = '#ffffff';
                          e.currentTarget.style.background = '#475569';
                        }
                      }}
                      onMouseLeave={e => {
                        if (!e.currentTarget.style.background.includes('172a45')) {
                          e.currentTarget.style.color = customIsActive ? '#ffffff' : '#ccfbf1';
                          e.currentTarget.style.background = customIsActive ? '#475569' : 'transparent';
                        }
                      }}
                    >
                      {() => (
                        <>
                          {customIsActive && !collapsed && (
                            <div style={{
                              position: 'absolute', left: 0, top: '20%', bottom: '20%', width: '4px',
                              background: '#ffffff', borderRadius: '0 4px 4px 0'
                            }} />
                          )}
                          <Icon size={18} style={{ flexShrink: 0 }} />
                          {!collapsed && (
                            <span style={{ flex: 1 }}>{item.name}</span>
                          )}
                        </>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            );
          })}
        </nav>

        <div style={{
          padding: '16px 12px',
          borderTop: '1px solid #475569',
          flexShrink: 0,
        }}>
          {hasAdminSession && (
            <button
              onClick={handleRestoreAdmin}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                width: '100%',
                padding: collapsed ? '10px' : '10px 14px',
                background: '#475569',
                border: 'none',
                color: '#ffffff',
                cursor: 'pointer',
                justifyContent: collapsed ? 'center' : 'flex-start',
                borderRadius: '10px',
                fontSize: '14px',
                fontWeight: 600,
                transition: 'all 0.2s',
                marginBottom: '8px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = '#64748b';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = '#475569';
              }}
            >
              <ShieldAlert size={18} style={{ flexShrink: 0 }} />
              {!collapsed && <span>Return to Admin</span>}
            </button>
          )}
          <button
            onClick={handleLogout}
            style={{
              display: 'flex', alignItems: 'center', gap: '12px',
              width: '100%', padding: collapsed ? '10px' : '10px 14px',
              background: 'transparent',
              border: 'none',
              color: '#f1f5f9',
              cursor: 'pointer',
              justifyContent: collapsed ? 'center' : 'flex-start',
              borderRadius: '10px',
              fontSize: '14px', fontWeight: 600,
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#ea580c'; e.currentTarget.style.color = '#ffffff'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#f1f5f9'; }}
          >
            <LogOut size={18} style={{ flexShrink: 0 }} />
            {!collapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
