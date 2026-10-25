import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { Route as RouteIcon } from 'lucide-react';
import axiosInstance from '../../api/axios';
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
  Bell,
  FileCheck,
  Sparkles,
  Palette,
  Terminal,
  Droplets,
  Fuel,
  X,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

const Sidebar = ({ isOpen, toggleMobileSidebar }) => {
  const { user, logout, restoreAdmin, hasAdminSession } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [brandProfile, setBrandProfile] = useState(null);

  useEffect(() => {
    const loadProfile = () => {
      axiosInstance.get('/api/profile').then(res => {
        if (res.data?.success && res.data.profile) {
          setBrandProfile(res.data.profile);
        }
      }).catch(() => { });
    };
    loadProfile();

    const handleProfileUpdated = (e) => {
      if (e.detail) {
        setBrandProfile(e.detail);
      } else {
        loadProfile();
      }
    };
    window.addEventListener('profile-updated', handleProfileUpdated);
    return () => window.removeEventListener('profile-updated', handleProfileUpdated);
  }, [user]);

  const navGroups = [
    {
      label: '',
      items: [
        { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, roles: ['superadmin', 'dealer', 'customer'] },
        { name: 'Live Tracking', path: '/tracking', icon: Navigation, roles: ['customer'] },
        { name: 'Fuel Analytics', path: '/fuel-analytics', icon: Fuel, roles: ['customer', 'superadmin', 'dealer'] },
        { name: 'Devices', path: '/admin/devices', icon: Cpu, roles: ['superadmin', 'dealer'] },
        { name: 'Terminal', path: '/admin/terminal', icon: Terminal, roles: ['superadmin', 'dealer'] },
        { name: 'Fuel Watcher', path: '/admin/fuel-watcher', icon: Droplets, roles: ['superadmin', 'dealer'] },
        { name: 'Registrations', path: '/admin/mining-registrations', icon: ClipboardList, roles: ['superadmin', 'dealer'] },
        { name: 'Billing', path: '/admin/billing', icon: FileText, roles: ['superadmin', 'dealer'] },
        { name: 'Audit', path: '/admin/audit-logs', icon: ClipboardList, roles: ['superadmin', 'dealer'] },
        { name: 'Archived Audit', path: '/admin/audit-logs?archived=true', icon: Archive, roles: ['superadmin', 'dealer'] },
        { name: 'Vehicles', path: '/admin/vehicles', icon: Truck, roles: ['superadmin', 'dealer'] },
        { name: 'Groups', path: '/admin/groups', icon: Users, roles: ['superadmin', 'dealer'] },
        { name: 'Users', path: '/admin/users', icon: Users, roles: ['superadmin', 'dealer'] },
        { name: 'Geofences', path: '/admin/geofences', icon: ShieldAlert, roles: ['customer'] },
        { name: 'Routes', path: '/admin/routes', icon: Navigation, roles: ['customer'] },
        { name: 'Trips', path: '/trips', icon: RouteIcon, roles: ['customer'] },
        { name: 'Reports', path: '/admin/reports/daily-trip', icon: FileText, roles: ['customer'] },
        { name: 'Renewals', path: '/renewals', icon: RefreshCw, roles: ['customer'] },
        { name: 'Alerts', path: '/alerts', icon: Bell, roles: ['customer'] },
        { name: 'Organisation', path: '/admin/organizations', icon: Briefcase, roles: ['superadmin', 'dealer'] },
        { name: 'Organisation Profile', path: '/admin/profile', icon: Settings, roles: ['superadmin', 'dealer'] },
        { name: 'Dealer White-Label', path: '/admin/dealer-profile', icon: Sparkles, roles: ['superadmin', 'dealer'] },
      ],
    },
  ];

  const handleRestoreAdmin = async (e) => {
    if (e) e.preventDefault();
    const res = await restoreAdmin();
    if (res.success) {
      window.location.href = '/admin/users';
    } else {
      console.error(res.error || 'Failed to restore admin session');
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
      {/* Mobile Backdrop Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-[9998] md:hidden backdrop-blur-xs transition-opacity duration-300"
          onClick={() => toggleMobileSidebar && toggleMobileSidebar(false)}
          aria-hidden="true"
        />
      )}

      <aside
        style={{
          background: user?.role === 'superadmin' ? '#1e1b4b' : (brandProfile?.secondary_color || '#1e1b4b'),
          borderRight: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '4px 0 24px rgba(0,0,0,0.2)',
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          flexShrink: 0,
          zIndex: 10000,
          overflow: 'hidden'
        }}
        className={`transition-all duration-300 ease-in-out fixed md:static top-0 bottom-0 left-0 w-[240px] md:w-[185px] ${
          isOpen ? 'translate-x-0 ml-0' : '-translate-x-full md:translate-x-0 md:-ml-[185px]'
        }`}
      >
        {/* User Profile Header */}
        <div
          className="p-3 pb-3"
          style={{
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '10px'
          }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0,
              background: user?.role === 'superadmin' ? '#6366f1' : (brandProfile?.primary_color || '#6366f1'), color: 'white',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '13px', fontWeight: 700,
              boxShadow: `0 4px 12px ${user?.role === 'superadmin' ? 'rgba(99,102,241,0.4)' : (brandProfile?.primary_color ? brandProfile.primary_color + '40' : 'rgba(99,102,241,0.4)')}`,
            }}>
              {initials}
            </div>
            {!collapsed && (
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {user?.name || 'Administrator'}
                </div>
                <div style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'capitalize' }}>
                  {roleLabel}
                </div>
              </div>
            )}
          </div>

          {/* Close button for mobile */}
          <button
            onClick={() => toggleMobileSidebar && toggleMobileSidebar(false)}
            className="md:hidden p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer border-none bg-transparent"
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation */}
        <nav style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '12px 8px' }}>
          {navGroups.map((group) => {
            const visibleItems = group.items.filter(item => item.roles.includes(user?.role) || !user?.role);
            if (visibleItems.length === 0) return null;
            return (
              <div key={group.label || 'top'} style={{ marginBottom: '12px' }}>
                {!collapsed && group.label && (
                  <div
                    className="text-[9px] md:text-[10px] px-2 pb-1"
                    style={{
                      fontWeight: 700, letterSpacing: '0.1em',
                      textTransform: 'uppercase', color: brandProfile?.primary_color || '#99f6e4',
                    }}>
                    {group.label}
                  </div>
                )}
                {collapsed && group.label && <div style={{ height: '8px' }} />}
                {visibleItems.map((item) => {
                  const Icon = item.icon;
                  const [itemPathBase, itemSearch] = item.path.split('?');
                  let customIsActive = false;

                  if (itemSearch) {
                    customIsActive = location.pathname === itemPathBase && location.search.includes(itemSearch);
                  } else if (item.path === '/admin/audit-logs') {
                    customIsActive = location.pathname === item.path && !location.search.includes('archived=true');
                  } else if (item.name === 'Reports') {
                    customIsActive = location.pathname.startsWith('/admin/reports');
                  } else {
                    customIsActive = location.pathname === item.path || (item.path !== '/dashboard' && location.pathname.startsWith(item.path + '/'));
                  }

                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      onClick={(e) => {
                        const currentPath = window.location.pathname;
                        if (currentPath === '/dashboard' || currentPath === '/tracking') {
                          e.preventDefault();
                          if (toggleMobileSidebar) toggleMobileSidebar(false);
                          window.location.href = item.path;
                          return;
                        }
                        if (toggleMobileSidebar) toggleMobileSidebar(false);
                        navigate(item.path);
                      }}
                      className={`text-[12px] md:text-[13px] px-2.5 py-2 mb-1 gap-2.5 rounded-[8px] ${customIsActive ? 'text-white font-semibold shadow-xs' : 'text-slate-200 font-medium hover:text-white'
                        }`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        textDecoration: 'none',
                        justifyContent: collapsed ? 'center' : 'flex-start',
                        transition: 'all 0.2s ease',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        position: 'relative',
                        backgroundColor: customIsActive ? 'rgba(255, 255, 255, 0.16)' : 'transparent',
                      }}
                      onMouseEnter={(e) => {
                        if (!customIsActive) e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
                      }}
                      onMouseLeave={(e) => {
                        if (!customIsActive) e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      {customIsActive && !collapsed && (
                        <div style={{
                          position: 'absolute', left: 0, top: '15%', bottom: '15%', width: '3px',
                          background: brandProfile?.primary_color || '#a855f7', borderRadius: '0 3px 3px 0'
                        }} />
                      )}
                      <div className="w-[16px] flex items-center justify-center shrink-0">
                        <Icon className="w-full h-full" />
                      </div>
                      {!collapsed && (
                        <span style={{ flex: 1 }}>{item.name}</span>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            );
          })}
        </nav>

        <div style={{
          padding: '12px 8px',
          borderTop: '1px solid #475569',
          flexShrink: 0,
        }}>
          {hasAdminSession && (
            <button
              onClick={handleRestoreAdmin}
              className="text-[12px] md:text-[14px] px-2 py-1.5 md:px-3 md:py-2.5 mb-1 md:mb-2 gap-2 md:gap-3 rounded-[6px] md:rounded-[10px] hover:bg-[#64748b]"
              style={{
                display: 'flex',
                alignItems: 'center',
                width: '100%',
                background: '#475569',
                border: 'none',
                color: '#ffffff',
                cursor: 'pointer',
                justifyContent: collapsed ? 'center' : 'flex-start',
                fontWeight: 600,
                transition: 'all 0.2s',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              }}
            >
              <div className="w-[16px] md:w-[18px] flex items-center justify-center shrink-0">
                <ShieldAlert className="w-full h-full" />
              </div>
              {!collapsed && <span>Return to Admin</span>}
            </button>
          )}
          <button
            onClick={handleLogout}
            className="text-[12px] md:text-[14px] px-2 py-1.5 md:px-3 md:py-2.5 gap-2 md:gap-3 rounded-[6px] md:rounded-[10px] hover:bg-[#ea580c] hover:text-white"
            style={{
              display: 'flex', alignItems: 'center',
              width: '100%',
              background: 'transparent',
              border: 'none',
              color: '#f1f5f9',
              cursor: 'pointer',
              justifyContent: collapsed ? 'center' : 'flex-start',
              fontWeight: 600,
              transition: 'all 0.2s',
            }}
          >
            <div className="w-[16px] md:w-[18px] flex items-center justify-center shrink-0">
              <LogOut className="w-full h-full" />
            </div>
            {!collapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
