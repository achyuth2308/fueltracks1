import React, { useState, useEffect } from 'react';
import { formatLocalDate } from '../../utils/dateUtils';
import { Menu, Wifi, WifiOff, Bell, Clock as ClockIcon } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useSocket } from '../../hooks/useSocket';
import * as adminApi from '../../api/adminApi';
import axiosInstance from '../../api/axios';

const Topbar = ({ onMenuClick, vehicles = [] }) => {
  const { user } = useAuth();
  const { connected, socket, joinOrgRoom } = useSocket();
  const [stats, setStats] = useState({ total: 0, online: 0, offline: 0 });
  const [time, setTime] = useState(new Date());

  const [alerts, setAlerts] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [latestToast, setLatestToast] = useState(null);

  useEffect(() => {
    if (connected && user && (user.org_id || user.orgId)) {
      joinOrgRoom(user.org_id || user.orgId);
    }
  }, [connected, user, joinOrgRoom]);

  const [preferences, setPreferences] = useState(null);

  // Fetch initial alerts and preferences
  useEffect(() => {
    axiosInstance.get('/api/alerts?limit=15')
      .then(res => {
        if (res.data && res.data.success) {
          setAlerts(res.data.alerts || res.data.data || []);
        }
      })
      .catch(err => console.error('Failed to fetch recent alerts:', err));

    axiosInstance.get('/api/alerts/preferences')
      .then(res => {
        if (res.data?.success && res.data.preferences) {
          setPreferences(res.data.preferences);
        }
      })
      .catch(err => console.error('Failed to fetch preferences:', err));
  }, []);

  // Handle live socket alerts
  useEffect(() => {
    if (!socket) return;
    const handleNewAlert = (data) => {
      // If user opted out in preferences, ignore it for live push/toast
      if (preferences && preferences[data.alertType] === false) {
        return; 
      }

      setAlerts((prev) => [data, ...prev]); 

      // Play Sound
      try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
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

        if (data.alertType === 'safety_park') {
          // Dramatic Alert for Parking/Theft
          for (let i = 0; i < 6; i++) {
            playTone(800, 'square', now + i * 0.3, 0.25, 0.15);
            playTone(600, 'square', now + i * 0.3 + 0.15, 0.25, 0.15);
          }
        } else if (data.alertType === 'overspeed') {
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
    
    socket.on('alert:new', handleNewAlert);
    return () => socket.off('alert:new', handleNewAlert);
  }, [socket, preferences]);

  // Live clock
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Fleet stats from vehicles prop or API fallback
  useEffect(() => {
    if (vehicles.length > 0) {
      const online = vehicles.filter(v => v.is_online).length;
      setStats({ total: vehicles.length, online, offline: vehicles.length - online });
    } else {
      adminApi.getDashboardStats().then(res => {
        if (res?.success && res?.data) {
          setStats({
            total: parseInt(res.data.total_vehicles) || 0,
            online: parseInt(res.data.online_vehicles) || 0,
            offline: parseInt(res.data.offline_vehicles) || 0,
          });
        }
      }).catch(() => { });
    }
  }, [vehicles]);

  const timeStr = time.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  const dateStr = formatLocalDate(time);

  return (
    <header style={{
      height: '56px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 20px',
      background: '#223A57',
      borderBottom: '1px solid #475569',
      flexShrink: 0,
      zIndex: 9999,
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

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginRight: '24px' }}>
          <div style={{
            width: '36px', height: '36px',
            borderRadius: '8px',
            overflow: 'hidden',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 10px rgba(249,115,22,0.3)',
          }}>
            <img src="/fuelimage.png" alt="FuelTracks" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <div>
            <div style={{ fontSize: '16px', fontWeight: 800, color: '#f1f5f9', letterSpacing: '-0.03em', lineHeight: 1.1 }}>
              FuelTracks
            </div>
            <div style={{ fontSize: '9px', fontWeight: 600, color: '#f97316', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
              Enterprise
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
          <div style={{
            width: '5px', height: '5px', borderRadius: '50%',
            background: '#f97316',
            boxShadow: '0 0 6px rgba(249,115,22,0.5)',
          }} />
          <span
            className="hidden sm:block"
            style={{
              fontSize: '12px', fontWeight: 600, color: '#f1f5f9',
              maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
            {user?.orgName || 'Platform Workspace'}
          </span>
        </div>
      </div>

      {/* Right: stats + clock + socket */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>

        {/* Fleet stats */}
        <div className="hidden md:flex" style={{ alignItems: 'center', gap: '12px' }}>
          {[
            { label: 'Total', value: stats.total, color: '#f1f5f9' },
            { label: 'Online', value: stats.online, color: '#f97316', dot: true },
            { label: 'Offline', value: stats.offline, color: '#0ea5e9', dot: true },
          ].map(({ label, value, color, dot }) => (
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
                position: 'absolute', top: '30px', right: '0', width: '300px', background: '#fff', borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', zIndex: 100, border: '1px solid #e5e7eb', overflow: 'hidden'
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
                        <div style={{ color: '#9ca3af', fontSize: '10px', fontWeight: 600 }}>{new Date(a.deviceTime || a.serverTime).toLocaleTimeString()}</div>
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
          background: connected ? '#f97316' : '#475569',
          border: `1px solid ${connected ? '#7ea0b6' : '#3b82f6'}`,
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
      </div>

      {/* Global Live Toast Notification */}
      {latestToast && (
        <div style={{
          position: 'fixed', top: '70px', right: '20px', zIndex: 1000,
          background: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(12px)',
          borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.1)',
          borderLeft: `4px solid ${latestToast.alertType === 'safety_park' ? '#ef4444' : latestToast.alertType === 'overspeed' ? '#f97316' : '#3b82f6'}`,
          boxShadow: '0 20px 40px rgba(0,0,0,0.4)', padding: '16px 20px',
          display: 'flex', gap: '16px', width: '340px', animation: 'fadeInRight 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
        }}>
          <div style={{
            width: '44px', height: '44px', borderRadius: '12px',
            background: 'rgba(255, 255, 255, 0.1)', 
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.05)'
          }}>
            <Bell size={22} color={latestToast.alertType === 'safety_park' ? '#ef4444' : latestToast.alertType === 'overspeed' ? '#f97316' : '#60a5fa'} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '13px', fontWeight: 800, color: '#f8fafc', marginBottom: '3px', textTransform: 'uppercase', letterSpacing: '1px' }}>
              {latestToast.alertType.replace('_', ' ')}
            </div>
            <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '6px' }}>
              <span style={{ fontWeight: 700, color: '#e2e8f0' }}>{latestToast.vehicleName}</span> ({latestToast.plate})
            </div>
            <div style={{ fontSize: '13px', color: '#cbd5e1', lineHeight: 1.5, fontWeight: 500 }}>
              {latestToast.alertText}
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{
        __html: `
        @keyframes fadeInDown {
          from { opacity: 0; transform: translateY(-20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}} />
    </header>
  );
};

export default Topbar;
