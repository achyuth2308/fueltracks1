import React, { useState, useEffect, useRef } from 'react';
import { formatLocalDate } from '../../utils/dateUtils';
import { Menu, Wifi, WifiOff, Bell, Clock as ClockIcon, ShieldAlert, VolumeX, AlertTriangle, X } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useSocket } from '../../hooks/useSocket';
import * as adminApi from '../../api/adminApi';
import * as vehicleApi from '../../api/vehicleApi';
import axiosInstance from '../../api/axios';
import { applyBrowserBranding, getFullImageUrl } from '../../utils/branding';
import { getVehicleStatus, getNoDataThresholdHours, setNoDataThresholdHours, NO_DATA_OPTIONS } from '../../utils/markerUtils';

const Topbar = ({ onMenuClick, vehicles = [] }) => {
  const { user, restoreAdmin, hasAdminSession } = useAuth();
  const isImpersonating = hasAdminSession || (typeof window !== 'undefined' && !!localStorage.getItem('adminToken'));
  const { connected, socket, joinOrgRoom } = useSocket();
  const [stats, setStats] = useState({ total: 0, online: 0, offline: 0 });
  const [noDataThreshold, setNoDataThreshold] = useState(getNoDataThresholdHours());
  const [time, setTime] = useState(new Date());
  const [brandProfile, setBrandProfile] = useState(null);

  const [alerts, setAlerts] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [latestToast, setLatestToast] = useState(null);
  const [activeSirenAlert, setActiveSirenAlert] = useState(null);
  const sirenControllerRef = useRef(null);

  const stopPoliceSiren = () => {
    if (sirenControllerRef.current) {
      try {
        sirenControllerRef.current.stop();
      } catch (e) {}
      sirenControllerRef.current = null;
    }
    setActiveSirenAlert(null);
  };

  const startPoliceSiren = (alarmData) => {
    setActiveSirenAlert(alarmData);
    if (sirenControllerRef.current) return; // Already sounding

    try {
      // 1. Play authentic multi-harmonic police siren audio
      const audio = new Audio('/sounds/police_siren.wav');
      audio.loop = true;
      audio.volume = 1.0;

      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch((e) => {
          console.warn('[SIREN] Autoplay policy prevented immediate playback, unlocking on next click...', e);
          const unlock = () => {
            audio.play().catch(() => {});
            window.removeEventListener('click', unlock);
          };
          window.addEventListener('click', unlock);
        });
      }

      sirenControllerRef.current = {
        stop: () => {
          try {
            audio.pause();
            audio.currentTime = 0;
          } catch (e) {}
        }
      };
    } catch (err) {
      console.warn('[SIREN] Could not start audio:', err);
    }
  };

  // Listen for manual siren test events from anywhere in the app
  useEffect(() => {
    const handleManualTestSiren = (e) => {
      startPoliceSiren(e.detail || {
        vehicleName: 'Test Vehicle',
        plate: 'POLICE-01',
        alertText: '🚨 TEST THEFT ALARM: Police Siren Sound Test'
      });
    };
    window.addEventListener('test-police-siren', handleManualTestSiren);
    return () => window.removeEventListener('test-police-siren', handleManualTestSiren);
  }, []);

  const handleRestoreAdmin = async (e) => {
    if (e) e.preventDefault();
    try {
      const res = await restoreAdmin();
      if (res?.success) {
        window.location.href = '/dashboard';
      } else {
        alert(res?.error || 'Failed to restore admin session');
      }
    } catch (err) {
      alert('Error restoring admin session');
    }
  };

  useEffect(() => {
    const loadProfile = () => {
      axiosInstance.get('/api/profile').then(res => {
        if (res.data?.success && res.data.profile) {
          setBrandProfile(res.data.profile);
          if (user?.role !== 'superadmin') {
            applyBrowserBranding(res.data.profile);
          } else {
            document.title = 'FuelTracks — Enterprise Fleet Intelligence';
          }
        }
      }).catch(() => {});
    };

    loadProfile();

    const handleProfileUpdated = (e) => {
      if (e.detail) {
        setBrandProfile(e.detail);
        if (user?.role !== 'superadmin') {
          applyBrowserBranding(e.detail);
        } else {
          document.title = 'FuelTracks — Enterprise Fleet Intelligence';
        }
      } else {
        loadProfile();
      }
    };

    window.addEventListener('profile-updated', handleProfileUpdated);
    return () => window.removeEventListener('profile-updated', handleProfileUpdated);
  }, [user]);

  useEffect(() => {
    if (connected && user && (user.org_id || user.orgId)) {
      joinOrgRoom(user.org_id || user.orgId);
    }
  }, [connected, user, joinOrgRoom]);

  const [preferences, setPreferences] = useState(null);

  // Fetch initial alerts and preferences
  useEffect(() => {
    if (user?.role === 'superadmin' || user?.role === 'dealer') {
      return;
    }
    
    Promise.all([
      axiosInstance.get('/api/alerts/preferences').catch(err => {
        console.error('Failed to fetch preferences:', err);
        return null;
      }),
      axiosInstance.get('/api/alerts?limit=15').catch(err => {
        console.error('Failed to fetch recent alerts:', err);
        return null;
      })
    ]).then(([prefRes, alertsRes]) => {
      let fetchedPrefs = null;
      if (prefRes?.data?.success && prefRes.data.preferences) {
        fetchedPrefs = prefRes.data.preferences;
        setPreferences(fetchedPrefs);
      }
      
      const isAlertAllowed = (prefObj, type) => {
        if (!type) return false;
        const lower = type.toLowerCase();
        if (lower === 'low_battery' || lower === 'internal_battery_low') return false;
        if (!prefObj) return true;
        if (lower === 'main_battery_disconnected' || lower === 'main_battery_connected') {
          return prefObj.power_cut !== false;
        }
        return prefObj[lower] !== false;
      };

      if (alertsRes?.data && alertsRes.data.success) {
        let fetchedAlerts = alertsRes.data.alerts || alertsRes.data.data || [];
        if (fetchedPrefs) {
          fetchedAlerts = fetchedAlerts.filter(a => isAlertAllowed(fetchedPrefs, a.alertType));
        }
        setAlerts(fetchedAlerts);
      }
    });

    const handlePrefsUpdated = (e) => {
      const newPrefs = e.detail;
      setPreferences(newPrefs);
      const isAlertAllowed = (prefObj, type) => {
        if (!type) return false;
        const lower = type.toLowerCase();
        if (lower === 'low_battery' || lower === 'internal_battery_low') return false;
        if (!prefObj) return true;
        if (lower === 'main_battery_disconnected' || lower === 'main_battery_connected') {
          return prefObj.power_cut !== false;
        }
        return prefObj[lower] !== false;
      };
      setAlerts(prev => prev.filter(a => isAlertAllowed(newPrefs, a.alertType)));
    };
    window.addEventListener('preferences-updated', handlePrefsUpdated);
    return () => window.removeEventListener('preferences-updated', handlePrefsUpdated);
  }, []);

  // Handle live socket alerts
  useEffect(() => {
    if (!socket) return;
    const handleNewAlert = (data) => {
      const type = (data.alertType || '').toLowerCase();
      if (type === 'low_battery' || type === 'internal_battery_low') {
        return; // Suppress noisy battery chatter
      }

      // CRITICAL: Emergency Safety Parking Theft Alarms bypass all role and preference filters!
      if (type === 'safety_park') {
        setAlerts((prev) => [data, ...prev]);
        setLatestToast(data);
        setTimeout(() => setLatestToast(null), 8000);
        startPoliceSiren(data);
        return;
      }

      // If preferences aren't loaded yet, or user opted out, ignore it for live push/toast
      const isAllowed = !preferences || (
        (type === 'main_battery_disconnected' || type === 'main_battery_connected')
          ? preferences.power_cut !== false
          : preferences[type] !== false
      );
      if (!isAllowed) {
        return; 
      }

      // Prevent Superadmins and Dealers from getting flooded with live toasts for entire fleets
      if (user?.role === 'superadmin' || user?.role === 'dealer') {
        return;
      }

      setAlerts((prev) => [data, ...prev]); 

      // Play Sound
      try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        if (audioContext.state === 'suspended') {
          audioContext.resume();
        }
        const now = audioContext.currentTime;

        const playTone = (freq, type, startTime, duration, vol) => {
          const osc = audioContext.createOscillator();
          const gain = audioContext.createGain();
          osc.type = type;
          osc.frequency.setValueAtTime(freq, startTime);
          gain.gain.setValueAtTime(vol, startTime);
          gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
          osc.connect(gain);
          gain.connect(audioContext.destination);
          osc.start(startTime);
          osc.stop(startTime + duration);
        };

        if (data.alertType === 'overspeed') {
          // Rapid triple beep for warning
          playTone(900, 'sine', now, 0.1, 0.2);
          playTone(900, 'sine', now + 0.15, 0.1, 0.2);
          playTone(900, 'sine', now + 0.3, 0.2, 0.2);
        } else if (data.alertType === 'geofence' || data.alertType === 'geofence_enter' || data.alertType === 'geofence_exit') {
          // Pleasant double chime for info
          playTone(523.25, 'triangle', now, 0.3, 0.2); // C5
          playTone(659.25, 'triangle', now + 0.15, 0.4, 0.2); // E5
        } else {
          // Default soft ping (Ignition, etc)
          playTone(700, 'sine', now, 0.2, 0.15);
        }
      } catch (e) { console.warn('Audio play blocked'); }

      // Show Visual Toast
      setLatestToast(data);
      setTimeout(() => setLatestToast(null), 5000); // Hide after 5 seconds
    };
    
    // Listen for vehicle safety park toggle changes: if safety park is turned OFF, immediately stop police siren!
    const handleSafetyParkStateChange = (payload) => {
      if (payload?.safetyPark === 'NO') {
        stopPoliceSiren();
      }
    };

    socket.on('alert:new', handleNewAlert);
    socket.on('vehicle:safety_park', handleSafetyParkStateChange);

    return () => {
      socket.off('alert:new', handleNewAlert);
      socket.off('vehicle:safety_park', handleSafetyParkStateChange);
    };
  }, [socket, preferences]);

  // Live clock
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Listen for No Data threshold changes from anywhere in the app
  useEffect(() => {
    const handleThresholdChange = (e) => {
      setNoDataThreshold(e.detail || getNoDataThresholdHours());
    };
    window.addEventListener('nodata-threshold-changed', handleThresholdChange);
    return () => window.removeEventListener('nodata-threshold-changed', handleThresholdChange);
  }, []);

  const lastStatsFetchRef = useRef(0);

  // Fleet stats from vehicles prop or API fallback
  useEffect(() => {
    if (vehicles.length > 0) {
      const offlineCount = vehicles.filter(v => getVehicleStatus(v, noDataThreshold) === 'offline').length;
      const onlineCount = Math.max(0, vehicles.length - offlineCount);
      setStats({ total: vehicles.length, online: onlineCount, offline: offlineCount });
    } else {
      const now = Date.now();
      if (now - lastStatsFetchRef.current < 30000) return;
      lastStatsFetchRef.current = now;

      adminApi.getDashboardStats().then(res => {
        if (res?.success && res?.data) {
          const total = parseInt(res.data.total_vehicles || res.data.total_devices) || 0;
          const online = parseInt(res.data.online_vehicles) || 0;
          const offline = res.data.offline_vehicles !== undefined
            ? parseInt(res.data.offline_vehicles)
            : Math.max(0, total - online);
          setStats({
            total,
            online,
            offline,
          });
        }
      }).catch(() => { });
    }
  }, [vehicles, noDataThreshold]);

  const timeStr = time.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  const dateStr = formatLocalDate(time);

  return (
    <header style={{
      height: '56px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 20px',
      background: brandProfile?.secondary_color || '#1e1b4b',
      borderBottom: '1px solid rgba(255, 255, 255, 0.12)',
      flexShrink: 0,
      zIndex: 9999,
      transition: 'background-color 0.3s ease',
    }}>
      {/* Left: logo + org */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>

        {/* Hamburger Menu */}
        <button
          onClick={onMenuClick}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#f1f5f9',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '4px',
          }}
        >
          <Menu size={24} />
        </button>

        {/* Logo & Brand Identity */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '36px', height: '36px',
            borderRadius: '8px',
            overflow: 'hidden',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: brandProfile?.logo_url ? 'white' : 'transparent',
            boxShadow: '0 4px 10px rgba(99,102,241,0.3)',
            padding: brandProfile?.logo_url ? '2px' : '0'
          }}>
            <img 
              src={user?.role === 'superadmin' ? '/fuelimage.png' : (brandProfile?.logo_url ? getFullImageUrl(brandProfile.logo_url) : '/fuelimage.png')} 
              alt={user?.role === 'superadmin' ? 'FuelTracks' : (brandProfile?.brand_name || user?.orgName || 'FuelTracks')} 
              style={{ width: '100%', height: '100%', objectFit: 'contain' }} 
              onError={(e) => { e.currentTarget.src = '/fuelimage.png'; }}
            />
          </div>
          <div>
            <div style={{ fontSize: '15px', fontWeight: 800, color: '#f1f5f9', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
              {user?.role === 'superadmin' ? 'FuelTracks' : (brandProfile?.brand_name || user?.orgName || 'Telematics')}
            </div>
            {brandProfile?.brand_tagline && user?.role !== 'superadmin' ? (
              <div style={{ fontSize: '9px', fontWeight: 600, color: brandProfile?.primary_color || '#a78bfa', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                {brandProfile.brand_tagline.slice(0, 28)}
              </div>
            ) : (
              <div style={{ fontSize: '9px', fontWeight: 600, color: '#a78bfa', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                {user?.role === 'superadmin' ? 'Enterprise Admin' : 'Telematics Portal'}
              </div>
            )}
          </div>
        </div>

        {/* Superadmin Workspace Indicator */}
        {user?.role === 'superadmin' && user?.orgName && !user.orgName.toLowerCase().startsWith('fueltracks') && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginLeft: '16px' }}>
            <div style={{
              width: '5px', height: '5px', borderRadius: '50%',
              background: '#f97316',
              boxShadow: '0 0 6px rgba(249,115,22,0.5)',
            }} />
            <span
              className="hidden sm:block"
              style={{
                fontSize: '12px', fontWeight: 600, color: '#93c5fd',
                maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
              {user.orgName}
            </span>
          </div>
        )}
      </div>

      {/* Right: stats + clock + socket */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>

        {/* Fleet stats */}
        <div className="hidden md:flex" style={{ alignItems: 'center', gap: '12px' }}>
          {[
            { label: 'Total', value: stats.total, color: '#f1f5f9' },
            { label: 'Online', value: stats.online, color: '#f97316', dot: true },
            { label: 'No Data', value: stats.offline, color: '#0ea5e9', dot: true, isNoData: true },
          ].map(({ label, value, color, dot, isNoData }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              {dot && (
                <div style={{
                  width: '6px', height: '6px', borderRadius: '50%', background: color,
                  boxShadow: color === '#f97316' ? '0 0 6px rgba(249,115,22,0.4)' : 'none',
                }} />
              )}
              <span style={{ fontSize: '11px', color: '#93c5fd', fontWeight: 500 }}>{label}</span>
              <span style={{
                fontSize: '12px', fontWeight: 700, color,
                fontFamily: 'JetBrains Mono, monospace', letterSpacing: '-0.02em',
              }}>
                {value}
              </span>
              {isNoData && (
                <select
                  value={noDataThreshold}
                  onChange={(e) => setNoDataThresholdHours(Number(e.target.value))}
                  style={{
                    marginLeft: '3px',
                    background: 'rgba(255, 255, 255, 0.12)',
                    border: '1px solid rgba(255, 255, 255, 0.25)',
                    color: '#bae6fd',
                    borderRadius: '4px',
                    fontSize: '10px',
                    fontWeight: 700,
                    padding: '1px 4px',
                    cursor: 'pointer',
                    outline: 'none',
                  }}
                  title="No Data Rule: Keep vehicle in same state for this duration before marking as No Data"
                >
                  {NO_DATA_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value} style={{ background: '#1e1b4b', color: '#ffffff' }}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              )}
            </div>
          ))}
        </div>

        {/* Divider */}
        <div className="hidden md:block" style={{ width: '1px', height: '20px', background: '#ea580c' }} />

        {/* Live clock */}
        <div className="hidden sm:flex" style={{ textAlign: 'right', alignItems: 'center', gap: '8px' }}>
          <ClockIcon size={14} color="#93c5fd" />
          <div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#f1f5f9', fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.02em', lineHeight: '1' }}>
              {timeStr}
            </div>
            <div style={{ fontSize: '9px', color: '#93c5fd', fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: '2px' }}>
              {dateStr}
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="hidden sm:block" style={{ width: '1px', height: '20px', background: '#ea580c' }} />

        {/* Notifications */}
        {(user?.role !== 'superadmin' && user?.role !== 'dealer') && (() => {
          const unreadCount = alerts.filter(a => !a.isRead && !a.is_read).length;
          return (
            <div style={{ position: 'relative', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowDropdown(!showDropdown)}>
              <Bell size={18} color="#f1f5f9" />
              {unreadCount > 0 && (
                <div style={{
                  position: 'absolute', top: '-2px', right: '-2px',
                  width: '14px', height: '14px', borderRadius: '50%',
                  background: '#f97316', color: 'white',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '9px', fontWeight: 'bold', border: '2px solid #223A57',
                }}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </div>
              )}
            {showDropdown && (
              <div style={{
                position: 'absolute', top: '30px', right: '0', width: '300px', maxWidth: 'calc(100vw - 24px)', background: '#fff', borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', zIndex: 100, border: '1px solid #e5e7eb', overflow: 'hidden'
              }} onClick={(e) => e.stopPropagation()}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb', fontWeight: 700, fontSize: '13px', background: '#f8fafc', color: '#111827', display: 'flex', justifyContent: 'space-between' }}>
                  <span>Recent Alerts</span>
                  {unreadCount > 0 && (
                    <span style={{ fontSize: '11px', color: '#6B7280', cursor: 'pointer', fontWeight: 500 }} onClick={(e) => { 
                      e.stopPropagation(); 
                      axiosInstance.put('/api/alerts/read-all').catch(err => console.error(err));
                      setAlerts(alerts.map(a => ({ ...a, isRead: true }))); 
                    }}>Mark All Read</span>
                  )}
                </div>
                <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
                  {alerts.length === 0 ? (
                    <div style={{ padding: '32px 16px', textAlign: 'center', fontSize: '13px', color: '#9CA3B8' }}>No new alerts in this session</div>
                  ) : alerts.map((a, i) => (
                    <div key={i} style={{ padding: '12px 16px', borderBottom: i < alerts.length - 1 ? '1px solid #f3f4f6' : 'none', fontSize: '12px', display: 'flex', gap: '12px', background: (!a.isRead && !a.is_read) ? '#FFFBEB' : 'transparent' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: (!a.isRead && !a.is_read) ? '#F59E0B' : '#D1D5DB', flexShrink: 0, marginTop: '4px' }} />
                      <div>
                        <div style={{ fontWeight: 700, color: '#111827', marginBottom: '2px' }}>{a.vehicleName} <span style={{ color: '#6B7280', fontWeight: 500 }}>({a.plate})</span></div>
                        <div style={{ color: '#475569', lineHeight: 1.4, marginBottom: '6px' }}>{a.alertText}</div>
                        <div style={{ color: '#9ca3af', fontSize: '10px', fontWeight: 600 }}>{new Date(a.deviceTime || a.serverTime).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                        {a.address && <div style={{ color: '#9ca3af', fontSize: '10px', fontWeight: 500, marginTop: '2px' }}>📍 {a.address}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          );
        })()}

        {/* Socket status pill */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '5px',
          padding: '4px 10px',
          borderRadius: '99px',
          background: connected ? (brandProfile?.primary_color || '#f97316') : '#475569',
          border: `1px solid ${connected ? (brandProfile?.primary_color || '#7ea0b6') : '#3b82f6'}`,
        }}>
          {connected
            ? <Wifi size={12} color="#ffffff" />
            : <WifiOff size={12} color="#f1f5f9" />
          }
          <span style={{
            fontSize: '10px', fontWeight: 700,
            letterSpacing: '0.08em', textTransform: 'uppercase',
            color: connected ? '#ffffff' : '#4d6076',
          }}>
            {connected ? 'Live' : 'Off'}
          </span>
        </div>

        {/* Return to Admin Button if Impersonating */}
        {isImpersonating && (
          <button
            onClick={handleRestoreAdmin}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '5px 12px',
              borderRadius: '8px',
              background: '#d97706',
              color: '#ffffff',
              border: 'none',
              fontWeight: 700,
              fontSize: '12px',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(217,119,6,0.3)',
              transition: 'all 0.2s',
            }}
            className="hover:bg-amber-600 active:scale-95"
            title="Return to Admin Session"
          >
            <ShieldAlert size={15} className="text-amber-200" />
            <span className="hidden sm:inline">Return to Admin</span>
            <span className="sm:hidden">Admin</span>
          </button>
        )}
      </div>

      {/* Active Police Siren Emergency Theft Banner */}
      {activeSirenAlert && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 9999999,
          background: 'linear-gradient(90deg, #DC2626, #B91C1C, #7F1D1D)',
          color: '#FFFFFF',
          padding: '12px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 8px 30px rgba(220, 38, 38, 0.7)',
          borderBottom: '3px solid #EF4444',
          animation: 'sirenPulse 1s ease-in-out infinite'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 15px rgba(255,255,255,0.4)',
              flexShrink: 0
            }}>
              <ShieldAlert size={24} color="#FFFFFF" />
            </div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 900, letterSpacing: '0.05em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>🚨 THEFT ALARM (POLICE SIREN ACTIVE):</span>
                <span style={{ textDecoration: 'underline' }}>{activeSirenAlert.vehicleName || 'Vehicle'}</span>
                <span>({activeSirenAlert.plate || ''})</span>
              </div>
              <div style={{ fontSize: '12px', opacity: 0.95, marginTop: '2px', fontWeight: 500 }}>
                {activeSirenAlert.alertText || 'Vehicle moved (> 1 km/h) or Engine turned ON while Safety Parking was ACTIVE!'}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
            <button
              onClick={async () => {
                if (activeSirenAlert.vehicleId) {
                  try {
                    await vehicleApi.updateVehicleSettings(activeSirenAlert.vehicleId, { safetyPark: 'NO' });
                  } catch (e) {}
                }
                stopPoliceSiren();
              }}
              style={{
                padding: '8px 18px',
                borderRadius: '8px',
                background: '#FFFFFF',
                color: '#DC2626',
                border: 'none',
                fontSize: '12px',
                fontWeight: 800,
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
              }}
            >
              Turn OFF Safety Parking & Stop Siren
            </button>
            <button
              onClick={stopPoliceSiren}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                borderRadius: '8px',
                background: 'rgba(0,0,0,0.3)',
                color: '#FFFFFF',
                border: '1px solid rgba(255,255,255,0.4)',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              <VolumeX size={15} />
              Mute Siren
            </button>
          </div>
        </div>
      )}

      {/* Global Live Toast Notification */}
      {latestToast && (
        <div style={{
          position: 'fixed', top: '70px', right: '20px', zIndex: 1000,
          background: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(12px)',
          borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.1)',
          borderLeft: `4px solid ${latestToast.alertType === 'safety_park' || latestToast.alertType === 'main_battery_disconnected' ? '#ef4444' : latestToast.alertType === 'overspeed' ? '#f97316' : '#3b82f6'}`,
          boxShadow: '0 20px 40px rgba(0,0,0,0.4)', padding: '16px 20px',
          display: 'flex', gap: '16px', width: '340px', animation: 'fadeInRight 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
        }}>
          <div style={{
            width: '44px', height: '44px', borderRadius: '12px',
            background: 'rgba(255, 255, 255, 0.1)', 
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.05)'
          }}>
            <Bell size={22} color={latestToast.alertType === 'safety_park' || latestToast.alertType === 'main_battery_disconnected' ? '#ef4444' : latestToast.alertType === 'overspeed' ? '#f97316' : '#60a5fa'} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '13px', fontWeight: 800, color: '#f8fafc', marginBottom: '3px', textTransform: 'uppercase', letterSpacing: '1px' }}>
              {latestToast.alertType.replace(/_/g, ' ')}
            </div>
            <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '6px' }}>
              <span style={{ fontWeight: 700, color: '#e2e8f0' }}>{latestToast.vehicleName}</span> ({latestToast.plate})
            </div>
            <div style={{ fontSize: '13px', color: '#cbd5e1', lineHeight: 1.5, fontWeight: 500 }}>
              {latestToast.alertText}
            </div>
            <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '6px', fontWeight: 600 }}>
              {new Date(latestToast.deviceTime || latestToast.serverTime).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </div>
            {latestToast.address && (
              <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px', fontWeight: 500 }}>
                📍 {latestToast.address}
              </div>
            )}
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{
        __html: `
        @keyframes fadeInDown {
          from { opacity: 0; transform: translateY(-20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes sirenPulse {
          0%, 100% { filter: brightness(1); }
          50% { filter: brightness(1.3); }
        }
      `}} />
    </header>
  );
};

export default Topbar;
