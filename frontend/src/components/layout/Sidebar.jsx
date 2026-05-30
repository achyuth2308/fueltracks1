import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Truck,
  Building2,
  Users,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Layers,
  Activity,
  Settings,
  HelpCircle,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

const Sidebar = ({ isOpen, toggleMobileSidebar }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

  const isSuperAdmin = user?.role === 'superadmin';
  const isDealer = user?.role === 'dealer';

  const navGroups = [
    {
      label: 'Operations',
      items: [
        {
          name: 'Fleet Monitor',
          path: '/dashboard',
          icon: LayoutDashboard,
          roles: ['superadmin', 'dealer', 'customer'],
        },
      ],
    },
    {
      label: 'Management',
      items: [
        {
          name: 'Vehicles',
          path: '/admin/vehicles',
          icon: Truck,
          roles: ['superadmin', 'dealer'],
        },
        {
          name: 'Organizations',
          path: '/admin/organizations',
          icon: Building2,
          roles: ['superadmin'],
        },
        {
          name: 'Users',
          path: '/admin/users',
          icon: Users,
          roles: ['superadmin', 'dealer'],
        },
      ],
    },
  ];

  const roleColors = {
    superadmin: { bg: 'rgba(37,99,235,0.12)', text: '#60a5fa', border: 'rgba(37,99,235,0.25)' },
    dealer: { bg: 'rgba(16,185,129,0.1)', text: '#34d399', border: 'rgba(16,185,129,0.25)' },
    customer: { bg: 'rgba(99,102,241,0.1)', text: '#a5b4fc', border: 'rgba(99,102,241,0.25)' },
  };
  const rc = roleColors[user?.role] || roleColors.customer;

  const initials = user?.name
    ? user.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
    : 'U';

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={() => toggleMobileSidebar && toggleMobileSidebar(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 40,
            background: 'rgba(7, 10, 22, 0.7)',
            backdropFilter: 'blur(4px)',
          }}
          className="md:hidden"
        />
      )}

      <aside
        style={{
          width: collapsed ? '64px' : '220px',
          minWidth: collapsed ? '64px' : '220px',
          transition: 'width 0.25s ease, min-width 0.25s ease',
          background: 'linear-gradient(180deg, #0c1526 0%, #0a1020 100%)',
          borderRight: '1px solid rgba(255,255,255,0.05)',
          display: 'flex',
          flexDirection: 'column',
          height: '100vh',
          position: 'relative',
          flexShrink: 0,
          zIndex: 50,
        }}
        className={`${isOpen ? '' : '-translate-x-full'} md:translate-x-0 fixed md:static transition-transform`}
      >
        {/* Logo Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'space-between',
          padding: collapsed ? '0 16px' : '0 16px 0 16px',
          height: '56px',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '30px', height: '30px',
              background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
              borderRadius: '8px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
              boxShadow: '0 4px 12px rgba(37,99,235,0.4)',
            }}>
              <Truck size={14} color="white" />
            </div>
            {!collapsed && (
              <div style={{ animation: 'fade-in 0.2s ease' }}>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#e2e8f0', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
                  FuelTracks
                </div>
                <div style={{ fontSize: '9px', fontWeight: 500, color: '#4a5568', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  Enterprise
                </div>
              </div>
            )}
          </div>

          {!collapsed && (
            <button
              onClick={() => setCollapsed(true)}
              style={{
                width: '22px', height: '22px',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: '6px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', color: '#4a5568',
                transition: 'all 0.15s',
                flexShrink: 0,
              }}
              onMouseEnter={e => { e.currentTarget.style.color = '#7c8db0'; e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = '#4a5568'; e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
            >
              <ChevronLeft size={12} />
            </button>
          )}
        </div>

        {/* Expand Button (collapsed state) */}
        {collapsed && (
          <button
            onClick={() => setCollapsed(false)}
            style={{
              position: 'absolute', right: '-12px', top: '72px',
              width: '24px', height: '24px',
              background: '#131d30',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: '#7c8db0',
              zIndex: 10,
              transition: 'all 0.15s',
            }}
          >
            <ChevronRight size={12} />
          </button>
        )}

        {/* User Card */}
        {!collapsed && (
          <div style={{ padding: '12px', borderBottom: '1px solid rgba(255,255,255,0.04)', flexShrink: 0 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '8px 10px',
              background: 'rgba(255,255,255,0.025)',
              borderRadius: '8px',
              border: '1px solid rgba(255,255,255,0.04)',
            }}>
              <div style={{
                width: '30px', height: '30px', borderRadius: '8px', flexShrink: 0,
                background: `linear-gradient(135deg, ${rc.bg.replace(')', ', 0.6)').replace('rgba', 'rgba')} 0%, ${rc.bg} 100%)`,
                border: `1px solid ${rc.border}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '11px', fontWeight: 700, color: rc.text,
              }}>
                {initials}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#e2e8f0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {user?.name || 'User'}
                </div>
                <div style={{
                  display: 'inline-flex', alignItems: 'center',
                  padding: '1px 6px', borderRadius: '99px', marginTop: '2px',
                  background: rc.bg, color: rc.text,
                  border: `1px solid ${rc.border}`,
                  fontSize: '9px', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase',
                }}>
                  {user?.role}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Collapsed Avatar */}
        {collapsed && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', flexShrink: 0 }}>
            <div style={{
              width: '32px', height: '32px', borderRadius: '8px',
              background: `rgba(37,99,235,0.15)`,
              border: `1px solid rgba(37,99,235,0.3)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '12px', fontWeight: 700, color: '#60a5fa',
            }}>
              {initials}
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '8px 8px' }}>
          {navGroups.map((group) => {
            const visibleItems = group.items.filter(item => item.roles.includes(user?.role));
            if (visibleItems.length === 0) return null;
            return (
              <div key={group.label} style={{ marginBottom: '4px' }}>
                {!collapsed && (
                  <div style={{
                    fontSize: '9px', fontWeight: 700, letterSpacing: '0.1em',
                    textTransform: 'uppercase', color: '#2d3748',
                    padding: '8px 10px 4px',
                  }}>
                    {group.label}
                  </div>
                )}
                {collapsed && <div style={{ height: '8px' }} />}
                {visibleItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      onClick={() => toggleMobileSidebar && toggleMobileSidebar(false)}
                      style={({ isActive }) => ({
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: collapsed ? '8px' : '8px 10px',
                        borderRadius: '8px',
                        fontSize: '13px',
                        fontWeight: isActive ? 600 : 500,
                        color: isActive ? '#60a5fa' : '#4a5568',
                        textDecoration: 'none',
                        justifyContent: collapsed ? 'center' : 'flex-start',
                        background: isActive ? 'rgba(37,99,235,0.1)' : 'transparent',
                        borderLeft: isActive ? '3px solid #2563eb' : '3px solid transparent',
                        marginBottom: '2px',
                        transition: 'all 0.15s ease',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                      })}
                    >
                      {({ isActive }) => (
                        <>
                          <Icon size={16} style={{ flexShrink: 0 }} />
                          {!collapsed && (
                            <span style={{ fontSize: '13px' }}>{item.name}</span>
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

        {/* Footer */}
        <div style={{
          padding: '8px',
          borderTop: '1px solid rgba(255,255,255,0.05)',
          flexShrink: 0,
        }}>
          <button
            onClick={handleLogout}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: collapsed ? 'center' : 'flex-start',
              gap: '10px',
              width: '100%',
              padding: collapsed ? '8px' : '8px 10px',
              background: 'transparent',
              border: 'none',
              borderRadius: '8px',
              color: '#374151',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = '#f87171'; e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = '#374151'; e.currentTarget.style.background = 'transparent'; }}
          >
            <LogOut size={16} style={{ flexShrink: 0 }} />
            {!collapsed && <span>Sign Out</span>}
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
