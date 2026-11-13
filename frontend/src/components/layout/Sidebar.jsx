import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  ChevronDown,
  Cpu,
  Navigation,
  MapPin,
  Clock,
  ShieldAlert,
  RefreshCw,
  Bell,
  FileCheck,
  Sparkles,
  Building2,
  Palette,
  Terminal,
  Droplets,
  Fuel,
  Database,
  X,
  Check,
  RotateCcw,
  Headphones,
  Phone,
  Mail,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { SIDEBAR_THEMES, generateCustomTheme, getCurrentTheme, applyGlobalTheme } from '../../utils/theme';

const Sidebar = ({ isOpen, toggleMobileSidebar, vehicles = [] }) => {
  const { user, logout, restoreAdmin, hasAdminSession } = useAuth();
  const isImpersonating = hasAdminSession || (typeof window !== 'undefined' && !!(sessionStorage.getItem('adminToken') || localStorage.getItem('adminToken')));
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [brandProfile, setBrandProfile] = useState(null);

  // ── Sidebar Theme Customization ──────────────────────────────────
  const [themeId, setThemeId] = useState(() => {
    return localStorage.getItem('fueltracks_sidebar_theme') || 'orange';
  });
  const [customHex, setCustomHex] = useState(() => {
    return localStorage.getItem('fueltracks_sidebar_custom_color') || '#F97316';
  });
  const [showColorPicker, setShowColorPicker] = useState(false);
  const colorPickerRef = useRef(null);

  // Close color picker on outside click
  useEffect(() => {
    if (!showColorPicker) return;
    const handleClickOutside = (e) => {
      if (colorPickerRef.current && !colorPickerRef.current.contains(e.target)) {
        setShowColorPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showColorPicker]);

  const currentTheme = useMemo(() => {
    if (themeId === 'custom') {
      return generateCustomTheme(customHex);
    }
    const found = SIDEBAR_THEMES.find(t => t.id === themeId);
    if (found) return found;
    if (brandProfile?.secondary_color && /^#[0-9A-Fa-f]{6}$/.test(brandProfile.secondary_color)) {
      return generateCustomTheme(brandProfile.secondary_color);
    }
    return SIDEBAR_THEMES[0];
  }, [themeId, customHex, brandProfile]);

  // Synchronize global theme on load and changes
  useEffect(() => {
    applyGlobalTheme(currentTheme);
  }, [currentTheme]);

  // Listen for external theme change events
  useEffect(() => {
    const handleThemeEvent = (e) => {
      if (e?.detail) {
        setThemeId(e.detail.id);
        if (e.detail.id === 'custom' && e.detail.base) {
          setCustomHex(e.detail.base);
        }
      }
    };
    window.addEventListener('app-theme-changed', handleThemeEvent);
    return () => window.removeEventListener('app-theme-changed', handleThemeEvent);
  }, []);

  const handleSelectTheme = (id) => {
    setThemeId(id);
    const selected = SIDEBAR_THEMES.find(t => t.id === id) || SIDEBAR_THEMES[0];
    applyGlobalTheme(selected);
  };

  const handleCustomColorChange = (hex) => {
    setCustomHex(hex);
    setThemeId('custom');
    const custom = generateCustomTheme(hex);
    applyGlobalTheme(custom);
  };
  const isTripReportPath = (p) => {
    return p === '/admin/reports/trip' || 
           p === '/admin/reports/manual-trips' || 
           p === '/admin/reports/daily-trip' ||
           p.startsWith('/admin/reports/geofence');
  };

  const [openSubMenus, setOpenSubMenus] = useState(() => ({
    'Fuel Analytics': location.pathname.startsWith('/fuel-'),
    'Reports': location.pathname.startsWith('/admin/reports') && !isTripReportPath(location.pathname),
  }));

  const [openNestedSubMenus, setOpenNestedSubMenus] = useState(() => ({
    'Fuel Reports': location.pathname.startsWith('/admin/reports/fuel-') || 
                    location.pathname === '/admin/reports/kmpl-mileage' || 
                    location.pathname === '/admin/reports/lph-burn-rate'
  }));

  const [tripsExpanded, setTripsExpanded] = useState(() => {
    return location.pathname === '/trips' || isTripReportPath(location.pathname);
  });
  const [tripReportExpanded, setTripReportExpanded] = useState(() => {
    return isTripReportPath(location.pathname);
  });

  useEffect(() => {
    if (location.pathname.startsWith('/fuel-')) {
      setOpenSubMenus(prev => ({ ...prev, 'Fuel Analytics': true }));
    }
    if (location.pathname.startsWith('/admin/reports') && !isTripReportPath(location.pathname)) {
      setOpenSubMenus(prev => ({ ...prev, 'Reports': true }));
      if (location.pathname.startsWith('/admin/reports/fuel-') || 
          location.pathname === '/admin/reports/kmpl-mileage' || 
          location.pathname === '/admin/reports/lph-burn-rate') {
        setOpenNestedSubMenus(prev => ({ ...prev, 'Fuel Reports': true }));
      }
    }
    if (location.pathname === '/trips' || isTripReportPath(location.pathname)) {
      setTripsExpanded(true);
    }
    if (isTripReportPath(location.pathname)) {
      setTripReportExpanded(true);
    }
  }, [location.pathname]);

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

  // Check whether any vehicle has a fuel sensor or fuel monitoring
  const hasFuelFeature = useMemo(() => {
    if (user?.role === 'superadmin' || user?.role === 'dealer') return true;
    if (brandProfile?.has_fuel_vehicles !== undefined) return brandProfile.has_fuel_vehicles;
    if (vehicles && vehicles.length > 0) {
      return vehicles.some(v => 
        (v.tank_capacity && v.tank_capacity > 0) ||
        (v.metadata?.tankSize && parseFloat(v.metadata.tankSize) > 0) ||
        (v.metadata?.fuelCalibration && Object.keys(v.metadata.fuelCalibration).length > 0) ||
        (v.licenceId && (v.licenceId.startsWith('AD') || v.licenceId.startsWith('EN'))) ||
        (v.current_fuel !== undefined && v.current_fuel !== null && Number(v.current_fuel) > 0)
      );
    }
    return false;
  }, [user, brandProfile, vehicles]);

  const navGroups = useMemo(() => [
    {
      label: '',
      items: [
        { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, color: '#2563EB', roles: ['superadmin', 'dealer', 'customer'] },
        { name: 'Add Device', path: '/admin/devices', icon: Cpu, color: '#0284C7', roles: ['superadmin', 'dealer'] },
        { name: 'Billing', path: '/admin/billing', icon: FileText, color: '#059669', roles: ['superadmin', 'dealer'] },
        { name: 'Vehicles', path: '/admin/vehicles', icon: Truck, color: '#DB2777', roles: ['superadmin', 'dealer'] },
        { name: 'Groups', path: '/admin/groups', icon: Users, color: '#4F46E5', roles: ['superadmin', 'dealer'] },
        { name: 'Users', path: '/admin/users', icon: Users, color: '#7C3AED', roles: ['superadmin', 'dealer'] },
        { name: 'Organization', path: '/admin/organizations', icon: Briefcase, color: '#D97706', roles: ['superadmin', 'dealer'] },
        { name: 'Dealers', path: '/admin/dealers', icon: Building2, color: '#9333EA', roles: ['superadmin'] },
        { name: 'Terminal', path: '/admin/terminal', icon: Terminal, color: '#0D9488', roles: ['superadmin', 'dealer'] },
        { name: 'Audit', path: '/admin/audit-logs', icon: ClipboardList, color: '#EA580C', roles: ['superadmin', 'dealer'] },
        { name: 'Archived Audit', path: '/admin/audit-logs?archived=true', icon: Archive, color: '#475569', roles: ['superadmin', 'dealer'] },
        { name: 'Fuel Watcher', path: '/admin/fuel-watcher', icon: Droplets, color: '#0284C7', roles: ['superadmin', 'dealer'] },
        { name: 'Organisation Profile', path: '/admin/profile', icon: Settings, color: '#64748B', roles: ['superadmin', 'dealer'] },
        { name: 'Dealer White-Label', path: '/admin/dealer-profile', icon: Sparkles, color: '#F59E0B', roles: ['superadmin', 'dealer'] },
        {
          name: 'Track',
          path: '/tracking',
          icon: Navigation,
          color: '#10B981',
          roles: ['customer'],
          subItems: [
            { name: 'Live Tracking', path: '/tracking' },
            { name: 'History Tracking', path: '/history' },
            { name: 'Multi Tracking', path: '/tracking?mode=multi' },
          ],
        },
        {
          name: 'Trips',
          path: '/trips',
          icon: RouteIcon,
          color: '#0284C7',
          roles: ['customer'],
          subItems: [
            { name: 'Total Trip', path: '/trips?type=total', type: 'total' },
            { name: 'Automated Trips', path: '/trips?type=automated', type: 'automated' },
            { name: 'Manual Trips', path: '/trips?type=manual', type: 'manual' },
          ],
        },
        ...(hasFuelFeature ? [{
          name: 'Fuel Analytics',
          path: '/fuel-analytics',
          icon: Fuel,
          color: '#F97316',
          roles: ['customer'],
          subItems: [
            { name: 'Analytics Chart', path: '/fuel-analytics' },
            { name: 'Fuel Raw Data', path: '/fuel-raw-data' }
          ]
        }] : []),
        {
          name: 'Reports',
          path: '/admin/reports/dashboard',
          icon: FileText,
          color: '#7C3AED',
          roles: ['customer'],
          subItems: [
            { name: 'Fleet Dashboard', path: '/admin/reports/dashboard' },
            { name: 'Daily Distance', path: '/admin/reports/distance' },
            { name: 'Engine ON', path: '/admin/reports/ignition' },
            { name: 'Overspeeding', path: '/admin/reports/overspeeding' },
            { name: 'Stoppage', path: '/admin/reports/stoppage' },
            { name: 'Individual', path: '/admin/reports/individual' },
            { name: 'Vehicle Consolidated', path: '/admin/reports/consolidated' },
            ...(hasFuelFeature ? [{
              name: 'Fuel Reports',
              path: '/admin/reports/fuel-consumption',
              subItems: [
                { name: 'Fuel Refill Report', path: '/admin/reports/fuel-refill' },
                { name: 'Fuel Consumption', path: '/admin/reports/fuel-consumption' },
                { name: 'Fuel Theft Report', path: '/admin/reports/fuel-theft' },
                { name: 'Fuel Consolidated', path: '/admin/reports/fuel-consolidated' },
                { name: 'KMPL Mileage Report', path: '/admin/reports/kmpl-mileage' },
                { name: 'LPH Engine Burn Rate', path: '/admin/reports/lph-burn-rate' }
              ]
            }] : [])
          ],
        },
        { name: 'Renewals', path: '/renewals', icon: RefreshCw, color: '#0D9488', roles: ['customer'] },
        { name: 'Alerts', path: '/alerts', icon: Bell, color: '#EF4444', roles: ['customer'] },
      ],
    },
  ], [hasFuelFeature]);

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
  const isAdmin = user?.role === 'superadmin' || location.pathname.startsWith('/admin');

  // Support details determination:
  // If customer belongs to a dealer (e.g. SM Technologies), show dealer's details.
  // If customer is a FuelTracks direct customer, show FuelTracks details.
  const isDealerCustomer = brandProfile?.is_dealer_customer === true;

  const supportBrand = isDealerCustomer
    ? (brandProfile?.dealer_name || brandProfile?.support_brand || 'SM Technologies')
    : 'Fueltracks';

  const supportPhone = isDealerCustomer
    ? (brandProfile?.dealer_phone || brandProfile?.support_phone || '7337433351')
    : (brandProfile?.support_phone || '7337433351');

  const supportEmail = isDealerCustomer
    ? (brandProfile?.dealer_email || brandProfile?.support_email || 'fueltrackstpl@gmail.com').toLowerCase()
    : (brandProfile?.support_email || 'fueltrackstpl@gmail.com').toLowerCase();

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
          background: '#F8FAFC',
          borderRight: '1px solid #E2E8F0',
          boxShadow: '1px 0 4px rgba(0, 0, 0, 0.02)',
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          flexShrink: 0,
          zIndex: 10000,
          overflow: 'hidden',
          width: '210px',
          position: 'relative',
          marginLeft: isOpen ? '0px' : '-210px',
          transition: 'margin-left 0.3s cubic-bezier(0.4, 0, 0.2, 1), transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
        }}
        className={`fixed md:static top-0 bottom-0 left-0 w-[240px] md:w-[210px] ${
          isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Clean Sidebar Header - Just Customer Name / Super Admin Label */}
        <div style={{
          padding: '16px 14px 12px 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid #E2E8F0',
          marginBottom: '6px',
          position: 'relative',
          zIndex: 2
        }}>
          <div style={{
            fontSize: '14px',
            fontWeight: 800,
            color: '#0F172A',
            letterSpacing: '-0.02em',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}>
            {user?.role === 'superadmin' ? 'Super Admin' : (user?.name || 'Customer')}
          </div>

          {/* Close button for mobile */}
          <button
            onClick={() => toggleMobileSidebar && toggleMobileSidebar(false)}
            className="md:hidden p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer border-none bg-transparent"
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation */}
        <nav style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '6px 10px', scrollbarWidth: 'thin', scrollbarColor: '#E2E8F0 transparent', position: 'relative', zIndex: 2 }}>
          {navGroups.map((group) => {
            const visibleItems = group.items.filter(item => item.roles.includes(user?.role) || !user?.role);
            if (visibleItems.length === 0) return null;
            return (
              <div key={group.label || 'top'} style={{ marginBottom: '10px' }}>
                {!collapsed && group.label && (
                  <div
                    className="text-[9px] md:text-[10px] px-2 pb-1"
                    style={{
                      fontWeight: 700, letterSpacing: '0.08em',
                      textTransform: 'uppercase', color: '#94A3B8',
                    }}>
                    {group.label}
                  </div>
                )}
                {collapsed && group.label && <div style={{ height: '8px' }} />}
                {visibleItems.map((item) => {
                  const Icon = item.icon;

                  if (item.name === 'Trips') {
                    const isParentActive = location.pathname === '/trips' || isTripReportPath(location.pathname);
                    return (
                      <div key={item.path} style={{ marginBottom: '3px' }}>
                        <div
                          onClick={() => {
                            if (collapsed) setCollapsed(false);
                            setTripsExpanded(prev => !prev);
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: collapsed ? 'center' : 'flex-start',
                            padding: '8px 10px',
                            gap: '10px',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontSize: '13px',
                            fontWeight: isParentActive ? 800 : 700,
                            color: isParentActive ? '#FFFFFF' : '#0F172A',
                            background: isParentActive
                              ? (currentTheme.primary || 'var(--brand-primary, #EA580C)')
                              : 'transparent',
                            boxShadow: isParentActive
                              ? `0 3px 10px -1px ${currentTheme.primary}45`
                              : 'none',
                            position: 'relative',
                            overflow: 'hidden',
                            transition: 'all 0.15s ease',
                            userSelect: 'none'
                          }}
                          onMouseEnter={(e) => {
                            if (!isParentActive) {
                              e.currentTarget.style.backgroundColor = '#F1F5F9';
                              e.currentTarget.style.color = '#0F172A';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!isParentActive) {
                              e.currentTarget.style.backgroundColor = 'transparent';
                              e.currentTarget.style.color = '#0F172A';
                            }
                          }}
                        >
                          <div
                            style={{
                              width: '26px',
                              height: '26px',
                              borderRadius: '7px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              background: isParentActive ? 'rgba(255, 255, 255, 0.22)' : `${item.color || '#0284C7'}18`,
                              border: isParentActive ? '1px solid rgba(255, 255, 255, 0.35)' : `1px solid ${item.color || '#0284C7'}30`,
                              flexShrink: 0,
                              transition: 'all 0.18s ease'
                            }}
                          >
                            <Icon
                              size={14}
                              color={isParentActive ? '#FFFFFF' : (item.color || '#0284C7')}
                              strokeWidth={2.4}
                            />
                          </div>
                          {!collapsed && (
                            <>
                              <span style={{ flex: 1, letterSpacing: '0.01em', fontWeight: isParentActive ? 800 : 700 }}>{item.name}</span>
                              <ChevronDown
                                size={14}
                                color={isParentActive ? '#FFFFFF' : '#94A3B8'}
                                style={{
                                  transform: tripsExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                                  transition: 'transform 0.2s ease',
                                  opacity: 0.9,
                                }}
                              />
                            </>
                          )}
                        </div>

                        {/* Dropdown Sub-Items Under Trips */}
                        {tripsExpanded && !collapsed && (
                          <div style={{
                            paddingLeft: '10px',
                            marginLeft: '16px',
                            borderLeft: '1.5px solid #E2E8F0',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '3px',
                            marginTop: '3px',
                            marginBottom: '6px',
                          }}>
                            {/* 1. Add Geofence (navigates to /trips) */}
                            <NavLink
                              to="/trips"
                              onClick={() => {
                                if (toggleMobileSidebar) toggleMobileSidebar(false);
                              }}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '5px 8px',
                                borderRadius: '6px',
                                fontSize: '11.5px',
                                textDecoration: 'none',
                                color: location.pathname === '/trips' ? (currentTheme.activeText || '#EA580C') : '#1E293B',
                                background: location.pathname === '/trips'
                                  ? (currentTheme.activeBg || '#FFF7ED')
                                  : 'transparent',
                                fontWeight: location.pathname === '/trips' ? 800 : 700,
                                transition: 'all 0.15s ease',
                              }}
                              onMouseEnter={(e) => {
                                if (location.pathname !== '/trips') {
                                  e.currentTarget.style.backgroundColor = '#F1F5F9';
                                  e.currentTarget.style.color = '#0F172A';
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (location.pathname !== '/trips') {
                                  e.currentTarget.style.backgroundColor = 'transparent';
                                  e.currentTarget.style.color = '#1E293B';
                                }
                              }}
                            >
                              <div style={{
                                width: '5px',
                                height: '5px',
                                borderRadius: '50%',
                                background: location.pathname === '/trips' ? currentTheme.primary : '#64748B',
                                boxShadow: location.pathname === '/trips' ? `0 0 6px ${currentTheme.primary}` : 'none',
                                flexShrink: 0,
                              }} />
                              <span style={{ fontWeight: location.pathname === '/trips' ? 800 : 700 }}>Add Geofence</span>
                            </NavLink>

                            {/* 2. Trip Report Submenu */}
                            <div>
                              <div
                                onClick={() => setTripReportExpanded(prev => !prev)}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  padding: '5px 8px',
                                  borderRadius: '6px',
                                  fontSize: '11.5px',
                                  cursor: 'pointer',
                                  color: isTripReportPath(location.pathname) ? (currentTheme.activeText || '#EA580C') : '#1E293B',
                                  background: isTripReportPath(location.pathname)
                                    ? (currentTheme.activeBg || '#FFF7ED')
                                    : 'transparent',
                                  fontWeight: 800,
                                  transition: 'all 0.15s ease',
                                }}
                                onMouseEnter={(e) => {
                                  if (!isTripReportPath(location.pathname)) {
                                    e.currentTarget.style.backgroundColor = '#F1F5F9';
                                    e.currentTarget.style.color = '#0F172A';
                                  }
                                }}
                                onMouseLeave={(e) => {
                                  if (!isTripReportPath(location.pathname)) {
                                    e.currentTarget.style.backgroundColor = 'transparent';
                                    e.currentTarget.style.color = '#1E293B';
                                  }
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <div style={{
                                    width: '5px',
                                    height: '5px',
                                    borderRadius: '50%',
                                    background: isTripReportPath(location.pathname) ? currentTheme.primary : '#64748B',
                                    boxShadow: isTripReportPath(location.pathname) ? `0 0 6px ${currentTheme.primary}` : 'none',
                                    flexShrink: 0,
                                  }} />
                                  <span style={{ fontWeight: 800 }}>Trip Report</span>
                                </div>
                                <ChevronDown
                                  size={12}
                                  color={isTripReportPath(location.pathname) ? currentTheme.primary : '#64748B'}
                                  style={{
                                    transform: tripReportExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                                    transition: 'transform 0.2s ease',
                                    opacity: 0.9,
                                  }}
                                />
                              </div>

                              {/* Nested Reports: Automated Trips, Manual Trips, Total Trip */}
                              {tripReportExpanded && (
                                <div style={{
                                  paddingLeft: '8px',
                                  marginLeft: '6px',
                                  borderLeft: '1.5px solid #E2E8F0',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '2px',
                                  marginTop: '3px',
                                }}>
                                  {[
                                    { name: 'Automated Trips', path: '/admin/reports/trip' },
                                    { name: 'Manual Trips', path: '/admin/reports/manual-trips' },
                                    { name: hasFuelFeature ? 'Total Trip (Fuel Data)' : 'Total Trip', path: '/admin/reports/daily-trip' },
                                  ].map((rItem) => {
                                    const isRActive = location.pathname === rItem.path;
                                    return (
                                      <NavLink
                                        key={rItem.path}
                                        to={rItem.path}
                                        onClick={() => {
                                          if (typeof window !== "undefined" && window.innerWidth <= 768 && toggleMobileSidebar) toggleMobileSidebar(false);
                                        }}
                                        style={{
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: '6px',
                                          padding: '4px 6px',
                                          borderRadius: '5px',
                                          fontSize: '11px',
                                          whiteSpace: 'nowrap',
                                          textDecoration: 'none',
                                          color: isRActive ? (currentTheme.activeText || '#EA580C') : '#1E293B',
                                          background: isRActive ? (currentTheme.activeBg || '#FFF7ED') : 'transparent',
                                          fontWeight: isRActive ? 800 : 700,
                                          transition: 'all 0.15s ease',
                                        }}
                                        onMouseEnter={(e) => {
                                          if (!isRActive) {
                                            e.currentTarget.style.backgroundColor = '#F1F5F9';
                                            e.currentTarget.style.color = '#0F172A';
                                          }
                                        }}
                                        onMouseLeave={(e) => {
                                          if (!isRActive) {
                                            e.currentTarget.style.backgroundColor = 'transparent';
                                            e.currentTarget.style.color = '#1E293B';
                                          }
                                        }}
                                      >
                                        <span style={{
                                          width: '4px',
                                          height: '4px',
                                          borderRadius: '50%',
                                          background: isRActive ? currentTheme.primary : '#64748B',
                                          boxShadow: isRActive ? `0 0 6px ${currentTheme.primary}` : 'none',
                                          flexShrink: 0
                                        }} />
                                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: isRActive ? 800 : 700 }}>{rItem.name}</span>
                                      </NavLink>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  }

                  const [itemPathBase, itemSearch] = item.path.split('?');
                  const hasSubItems = Array.isArray(item.subItems) && item.subItems.length > 0;
                  const isAnySubActive = hasSubItems && item.subItems.some(sub => {
                    const [subBase, subQuery] = sub.path.split('?');
                    if (subQuery) {
                      return location.pathname === subBase && location.search.includes(subQuery);
                    }
                    if (sub.path === '/tracking') {
                      return location.pathname === '/tracking' && !location.search.includes('mode=multi');
                    }
                    if (sub.path === '/history') {
                      return location.pathname === '/history' || location.pathname.includes('/history');
                    }
                    return location.pathname === sub.path;
                  });
                  
                  let customIsActive = false;
                  if (itemSearch) {
                    customIsActive = location.pathname === itemPathBase && location.search.includes(itemSearch);
                  } else if (item.name === 'Track') {
                    customIsActive = location.pathname.startsWith('/tracking') || location.pathname.includes('/history');
                  } else if (item.path === '/admin/audit-logs') {
                    customIsActive = location.pathname === item.path && !location.search.includes('archived=true');
                  } else if (item.name === 'Reports') {
                    customIsActive = location.pathname.startsWith('/admin/reports') && !isTripReportPath(location.pathname);
                  } else if (hasSubItems) {
                    customIsActive = isAnySubActive || location.pathname === item.path;
                  } else {
                    customIsActive = location.pathname === item.path || (item.path !== '/dashboard' && location.pathname.startsWith(item.path + '/'));
                  }

                  const isSubMenuOpen = openSubMenus[item.name] ?? customIsActive;

                  return (
                    <React.Fragment key={item.path || item.name}>
                      <NavLink
                        to={item.path}
                        onClick={(e) => {
                          if (hasSubItems && !collapsed) {
                            e.preventDefault();
                            setOpenSubMenus(prev => ({
                              ...prev,
                              [item.name]: !isSubMenuOpen
                            }));
                            if (!customIsActive) {
                              navigate(item.path);
                            }
                            return;
                          }
                          const currentPath = window.location.pathname;
                          if (currentPath === '/dashboard' || currentPath === '/tracking') {
                            e.preventDefault();
                            if (typeof window !== "undefined" && window.innerWidth <= 768 && toggleMobileSidebar) toggleMobileSidebar(false);
                            window.location.href = item.path;
                            return;
                          }
                          if (typeof window !== "undefined" && window.innerWidth <= 768 && toggleMobileSidebar) toggleMobileSidebar(false);
                          navigate(item.path);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          textDecoration: 'none',
                          justifyContent: collapsed ? 'center' : 'flex-start',
                          padding: '8px 10px',
                          gap: '10px',
                          marginBottom: '3px',
                          borderRadius: '8px',
                          fontSize: '13px',
                          fontWeight: customIsActive ? 800 : 700,
                          color: customIsActive ? '#FFFFFF' : '#0F172A',
                          background: customIsActive
                            ? (currentTheme.primary || 'var(--brand-primary, #EA580C)')
                            : 'transparent',
                          boxShadow: customIsActive
                            ? `0 3px 10px -1px ${currentTheme.primary}45`
                            : 'none',
                          position: 'relative',
                          overflow: 'hidden',
                          whiteSpace: 'nowrap',
                          transition: 'all 0.15s ease',
                          userSelect: 'none'
                        }}
                        onMouseEnter={(e) => {
                          if (!customIsActive) {
                            e.currentTarget.style.backgroundColor = '#F1F5F9';
                            e.currentTarget.style.color = '#0F172A';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!customIsActive) {
                            e.currentTarget.style.backgroundColor = 'transparent';
                            e.currentTarget.style.color = '#0F172A';
                          }
                        }}
                      >
                        <div
                          style={{
                            width: '26px',
                            height: '26px',
                            borderRadius: '7px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: customIsActive ? 'rgba(255, 255, 255, 0.22)' : `${item.color || currentTheme.primary}18`,
                            border: customIsActive ? '1px solid rgba(255, 255, 255, 0.35)' : `1px solid ${item.color || currentTheme.primary}30`,
                            flexShrink: 0,
                            transition: 'all 0.18s ease'
                          }}
                        >
                          <Icon
                            size={14}
                            color={customIsActive ? '#FFFFFF' : (item.color || currentTheme.primary)}
                            strokeWidth={2.4}
                          />
                        </div>
                        {!collapsed && (
                          <>
                            <span style={{ flex: 1, letterSpacing: '0.01em', fontWeight: customIsActive ? 800 : 700 }}>{item.name}</span>
                            {hasSubItems && (
                              <ChevronDown
                                size={14}
                                color={customIsActive ? '#FFFFFF' : '#64748B'}
                                style={{
                                  transform: isSubMenuOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                                  transition: 'transform 0.2s ease',
                                  opacity: 0.9,
                                }}
                              />
                            )}
                          </>
                        )}
                      </NavLink>

                      {/* Render nested sub-items */}
                      {!collapsed && hasSubItems && isSubMenuOpen && (
                        <div style={{
                          marginLeft: '16px',
                          paddingLeft: '10px',
                          marginBottom: '6px',
                          borderLeft: '1.5px solid #E2E8F0',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '3px'
                        }}>
                          {item.subItems.map((sub) => {
                            const hasNested = sub.subItems && Array.isArray(sub.subItems) && sub.subItems.length > 0;
                            if (hasNested) {
                              const isNestedOpen = !!openNestedSubMenus[sub.name];
                              const isAnyChildActive = sub.subItems.some(n => location.pathname === n.path);
                              return (
                                <div key={sub.name} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                  <div
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setOpenNestedSubMenus(prev => ({ ...prev, [sub.name]: !prev[sub.name] }));
                                    }}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      padding: '5px 8px',
                                      borderRadius: '6px',
                                      fontSize: '11.5px',
                                      color: isAnyChildActive ? (currentTheme.activeText || '#EA580C') : '#1E293B',
                                      background: isAnyChildActive
                                        ? (currentTheme.activeBg || '#FFF7ED')
                                        : 'transparent',
                                      borderLeft: isAnyChildActive
                                        ? `3px solid ${currentTheme.primary || '#EA580C'}`
                                        : '3px solid transparent',
                                      cursor: 'pointer',
                                      fontWeight: isAnyChildActive ? 800 : 700,
                                      userSelect: 'none',
                                      transition: 'all 0.15s ease'
                                    }}
                                    onMouseEnter={(e) => {
                                      if (!isAnyChildActive) {
                                        e.currentTarget.style.backgroundColor = '#F1F5F9';
                                        e.currentTarget.style.color = '#0F172A';
                                      }
                                    }}
                                    onMouseLeave={(e) => {
                                      if (!isAnyChildActive) {
                                        e.currentTarget.style.backgroundColor = 'transparent';
                                        e.currentTarget.style.color = '#1E293B';
                                      }
                                    }}
                                  >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                      <span style={{
                                        width: isAnyChildActive ? '6px' : '4px',
                                        height: isAnyChildActive ? '6px' : '4px',
                                        borderRadius: '50%',
                                        background: isAnyChildActive ? (currentTheme.primary || '#EA580C') : '#64748B',
                                        boxShadow: isAnyChildActive ? `0 0 6px ${currentTheme.primary}` : 'none',
                                        flexShrink: 0
                                      }} />
                                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: isAnyChildActive ? 800 : 700 }}>
                                        {sub.name}
                                      </span>
                                    </div>
                                    <ChevronDown
                                      size={13}
                                      color={isAnyChildActive ? (currentTheme.primary || '#EA580C') : '#64748B'}
                                      style={{
                                        transform: isNestedOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                                        transition: 'transform 0.2s ease',
                                        flexShrink: 0
                                      }}
                                    />
                                  </div>

                                  {isNestedOpen && (
                                    <div style={{
                                      marginLeft: '12px',
                                      paddingLeft: '8px',
                                      borderLeft: '1.5px solid #CBD5E1',
                                      display: 'flex',
                                      flexDirection: 'column',
                                      gap: '2px',
                                      marginTop: '1px',
                                      marginBottom: '4px'
                                    }}>
                                      {sub.subItems.map((nested) => {
                                        const isNestedActive = location.pathname === nested.path;
                                        return (
                                          <NavLink
                                            key={nested.path}
                                            to={nested.path}
                                            onClick={(e) => {
                                              const currentPath = window.location.pathname;
                                              if (currentPath === '/dashboard' || currentPath === '/tracking') {
                                                e.preventDefault();
                                                if (typeof window !== "undefined" && window.innerWidth <= 768 && toggleMobileSidebar) toggleMobileSidebar(false);
                                                window.location.href = nested.path;
                                                return;
                                              }
                                              if (typeof window !== "undefined" && window.innerWidth <= 768 && toggleMobileSidebar) toggleMobileSidebar(false);
                                              navigate(nested.path);
                                            }}
                                            style={{
                                              display: 'flex',
                                              alignItems: 'center',
                                              gap: '7px',
                                              padding: '4px 8px',
                                              borderRadius: '5px',
                                              fontSize: '11px',
                                              textDecoration: 'none',
                                              color: isNestedActive ? (currentTheme.activeText || '#EA580C') : '#475569',
                                              background: isNestedActive
                                                ? (currentTheme.activeBg || '#FFF7ED')
                                                : 'transparent',
                                              borderLeft: isNestedActive
                                                ? `2.5px solid ${currentTheme.primary || '#EA580C'}`
                                                : '2.5px solid transparent',
                                              fontWeight: isNestedActive ? 800 : 600,
                                              transition: 'all 0.15s ease'
                                            }}
                                            onMouseEnter={(e) => {
                                              if (!isNestedActive) {
                                                e.currentTarget.style.backgroundColor = '#F1F5F9';
                                                e.currentTarget.style.color = '#0F172A';
                                              }
                                            }}
                                            onMouseLeave={(e) => {
                                              if (!isNestedActive) {
                                                e.currentTarget.style.backgroundColor = 'transparent';
                                                e.currentTarget.style.color = '#475569';
                                              }
                                            }}
                                          >
                                            <span style={{
                                              width: isNestedActive ? '5px' : '3px',
                                              height: isNestedActive ? '5px' : '3px',
                                              borderRadius: '50%',
                                              background: isNestedActive ? (currentTheme.primary || '#EA580C') : '#94A3B8',
                                              boxShadow: isNestedActive ? `0 0 5px ${currentTheme.primary}` : 'none',
                                              flexShrink: 0
                                            }} />
                                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                              {nested.name}
                                            </span>
                                          </NavLink>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              );
                            }

                            const [subBase, subQuery] = sub.path.split('?');
                            let isSubActive = false;
                            if (subQuery) {
                              isSubActive = location.pathname === subBase && location.search.includes(subQuery);
                            } else if (sub.path === '/tracking') {
                              isSubActive = location.pathname === '/tracking' && !location.search.includes('mode=multi');
                            } else if (sub.path === '/history') {
                              isSubActive = location.pathname === '/history' || location.pathname.includes('/history');
                            } else {
                              isSubActive = location.pathname === sub.path;
                            }
                            return (
                              <NavLink
                                key={sub.path}
                                to={sub.path}
                                onClick={(e) => {
                                  const currentPath = window.location.pathname;
                                  if (currentPath === '/dashboard' || currentPath === '/tracking') {
                                    e.preventDefault();
                                    if (typeof window !== "undefined" && window.innerWidth <= 768 && toggleMobileSidebar) toggleMobileSidebar(false);
                                    window.location.href = sub.path;
                                    return;
                                  }
                                  if (typeof window !== "undefined" && window.innerWidth <= 768 && toggleMobileSidebar) toggleMobileSidebar(false);
                                  navigate(sub.path);
                                }}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  padding: '5px 8px',
                                  borderRadius: '6px',
                                  fontSize: '11.5px',
                                  textDecoration: 'none',
                                  color: isSubActive ? (currentTheme.activeText || '#EA580C') : '#1E293B',
                                  background: isSubActive
                                    ? (currentTheme.activeBg || '#FFF7ED')
                                    : 'transparent',
                                  borderLeft: isSubActive
                                    ? `3px solid ${currentTheme.primary || '#EA580C'}`
                                    : '3px solid transparent',
                                  fontWeight: isSubActive ? 800 : 700,
                                  transition: 'all 0.15s ease'
                                }}
                                onMouseEnter={(e) => {
                                  if (!isSubActive) {
                                    e.currentTarget.style.backgroundColor = '#F1F5F9';
                                    e.currentTarget.style.color = '#0F172A';
                                  }
                                }}
                                onMouseLeave={(e) => {
                                  if (!isSubActive) {
                                    e.currentTarget.style.backgroundColor = 'transparent';
                                    e.currentTarget.style.color = '#1E293B';
                                  }
                                }}
                              >
                                <span style={{
                                  width: isSubActive ? '6px' : '4px',
                                  height: isSubActive ? '6px' : '4px',
                                  borderRadius: '50%',
                                  background: isSubActive ? (currentTheme.primary || '#EA580C') : '#64748B',
                                  boxShadow: isSubActive ? `0 0 6px ${currentTheme.primary}` : 'none',
                                  flexShrink: 0
                                }} />
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: isSubActive ? 800 : 700 }}>{sub.name}</span>
                              </NavLink>
                            );
                          })}
                        </div>
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            );
          })}
        </nav>

        {/* Bottom Actions Dock */}
        <div style={{
          padding: '10px',
          borderTop: '1px solid #E2E8F0',
          background: '#FFFFFF',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          flexShrink: 0,
          position: 'relative',
          zIndex: 3
        }}>
          {/* Support Helpline Box - Only for non-admin users (customers) with available support contact */}
          {!isAdmin && (supportPhone || supportEmail) && (!collapsed ? (
            <div
              style={{
                width: '100%',
                padding: '7px 9px',
                borderRadius: '8px',
                background: '#FFFFFF',
                border: '1px solid #E2E8F0',
                boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
                display: 'flex',
                flexDirection: 'column',
                gap: '3px',
                textAlign: 'left'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '9.5px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: currentTheme.primary, display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Headphones size={11} />
                  Support Helpline
                </span>
                <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#10B981' }} title="Support Available" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '2px' }}>
                {supportPhone && (
                  <a
                    href={`tel:${supportPhone}`}
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      color: '#334155',
                      textDecoration: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px'
                    }}
                    onMouseEnter={e => e.currentTarget.style.color = currentTheme.primary}
                    onMouseLeave={e => e.currentTarget.style.color = '#334155'}
                  >
                    <Phone size={11} className="text-slate-400 shrink-0" />
                    <span>{supportPhone}</span>
                  </a>
                )}
                {supportEmail && (
                  <a
                    href={`mailto:${supportEmail}`}
                    style={{
                      fontSize: '10.5px',
                      fontWeight: 600,
                      color: '#475569',
                      textDecoration: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      wordBreak: 'break-all',
                      whiteSpace: 'normal',
                      lineHeight: '1.25'
                    }}
                    onMouseEnter={e => e.currentTarget.style.color = currentTheme.primary}
                    onMouseLeave={e => e.currentTarget.style.color = '#475569'}
                  >
                    <Mail size={11} className="text-slate-400 shrink-0" />
                    <span>{supportEmail}</span>
                  </a>
                )}
              </div>
            </div>
          ) : (
            <div
              title={`Support: ${supportBrand}${supportPhone ? ` - ${supportPhone}` : ''}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '6px 0',
                color: currentTheme.primary,
                cursor: 'pointer'
              }}
            >
              <Headphones size={16} />
            </div>
          ))}

          <button
            onClick={handleLogout}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              width: '100%',
              padding: '7px 12px',
              borderRadius: '8px',
              background: '#F8FAFC',
              border: '1px solid #E2E8F0',
              color: '#1E293B',
              fontSize: '12.5px',
              fontWeight: 700,
              cursor: 'pointer',
              justifyContent: collapsed ? 'center' : 'flex-start',
              transition: 'all 0.18s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#FEF2F2';
              e.currentTarget.style.borderColor = '#FCA5A5';
              e.currentTarget.style.color = '#DC2626';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#F8FAFC';
              e.currentTarget.style.borderColor = '#E2E8F0';
              e.currentTarget.style.color = '#1E293B';
            }}
          >
            <LogOut size={16} className="shrink-0" />
            {!collapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Floating Theme / Color Picker Popover Panel */}
      {showColorPicker && (
        <div
          ref={colorPickerRef}
          style={{
            position: 'fixed',
            left: collapsed ? '65px' : '220px',
            bottom: '15px',
            width: '270px',
            background: '#FFFFFF',
            borderRadius: '16px',
            border: '1px solid #E2E8F0',
            boxShadow: '0 20px 40px -10px rgba(15, 23, 42, 0.15), 0 0 0 1px rgba(0, 0, 0, 0.04)',
            padding: '14px',
            zIndex: 10002,
            color: '#0F172A',
            animation: 'fadeIn 0.18s ease-out',
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Palette size={16} color={currentTheme.primary} />
              <span style={{ fontSize: '13px', fontWeight: 800, letterSpacing: '-0.01em', color: '#0F172A' }}>Accent Palette</span>
            </div>
            <button
              onClick={() => setShowColorPicker(false)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#64748B',
                cursor: 'pointer',
                padding: '2px',
                display: 'flex',
                alignItems: 'center'
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#0F172A')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#64748B')}
            >
              <X size={15} />
            </button>
          </div>

          {/* Preset Swatches Grid */}
          <div style={{ fontSize: '10.5px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
            Curated Themes
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '14px' }}>
            {SIDEBAR_THEMES.map((theme) => {
              const isSelected = themeId === theme.id;
              return (
                <button
                  key={theme.id}
                  onClick={() => handleSelectTheme(theme.id)}
                  title={theme.name}
                  style={{
                    height: '38px',
                    borderRadius: '10px',
                    background: theme.primary,
                    border: isSelected ? `2.5px solid #0F172A` : '1.5px solid #E2E8F0',
                    boxShadow: isSelected ? `0 0 0 2px ${theme.primary}` : '0 1px 3px rgba(0,0,0,0.08)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                    transition: 'all 0.15s ease',
                    outline: 'none',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'scale(1.06)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                  }}
                >
                  {isSelected && (
                    <Check size={16} color="#FFFFFF" strokeWidth={3} />
                  )}
                </button>
              );
            })}
          </div>

          {/* Custom Color Row */}
          <div style={{ fontSize: '10.5px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
            Custom Accent
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <div style={{ position: 'relative', width: '36px', height: '36px', flexShrink: 0, borderRadius: '8px', overflow: 'hidden', border: '1.5px solid #CBD5E1' }}>
              <input
                type="color"
                value={customHex}
                onChange={(e) => handleCustomColorChange(e.target.value)}
                style={{
                  position: 'absolute',
                  top: '-8px',
                  left: '-8px',
                  width: '52px',
                  height: '52px',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                  background: 'transparent'
                }}
              />
            </div>
            <input
              type="text"
              value={customHex}
              onChange={(e) => {
                const val = e.target.value;
                setCustomHex(val);
                if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
                  handleCustomColorChange(val);
                }
              }}
              placeholder="#F97316"
              maxLength={7}
              style={{
                flex: 1,
                height: '36px',
                background: '#F8FAFC',
                border: '1px solid #CBD5E1',
                borderRadius: '8px',
                padding: '0 10px',
                color: '#0F172A',
                fontSize: '12px',
                fontFamily: 'monospace',
                fontWeight: 700,
                outline: 'none',
                textTransform: 'uppercase'
              }}
            />
          </div>

          {/* Reset Default */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '8px', borderTop: '1px solid #F1F5F9' }}>
            <span style={{ fontSize: '11px', color: '#64748B' }}>Active: <strong style={{ color: currentTheme.primary }}>{currentTheme.name}</strong></span>
            <button
              onClick={() => handleSelectTheme('orange')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                background: 'transparent',
                border: 'none',
                color: currentTheme.primary,
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
                padding: '4px 6px',
                borderRadius: '6px'
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#F1F5F9')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <RotateCcw size={12} />
              <span>Reset</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default Sidebar;
