import React, { useState, useEffect } from 'react';
import { Menu, Building, Radio, Wifi, WifiOff, Bell, Clock as ClockIcon, Truck } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useSocket } from '../../hooks/useSocket';
import * as adminApi from '../../api/adminApi';

const Topbar = ({ onMenuClick, vehicles = [] }) => {
  const { user } = useAuth();
  const { connected, socket } = useSocket();
  const [stats, setStats] = useState({ total: 0, online: 0, offline: 0 });
  const [time, setTime] = useState(new Date());

  const [alerts, setAlerts] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [latestToast, setLatestToast] = useState(null);

  useEffect(() => {
    if (!socket) return;
    const handleNewAlert = (data) => {
      setAlerts((prev) => [data, ...prev].slice(0, 15)); // Keep 15 latest

      // Play Beep Sound
      try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(800, audioContext.currentTime); // 800Hz beep
        gainNode.gain.setValueAtTime(0.5, audioContext.currentTime);
        oscillator.start();
        setTimeout(() => oscillator.stop(), 200); // 200ms beep
      } catch (e) { console.warn('Audio play blocked'); }

      // Show Visual Toast
      setLatestToast(data);
      setTimeout(() => setLatestToast(null), 5000); // Hide after 5 seconds
    };
    socket.on('alert:new', handleNewAlert);
    return () => socket.off('alert:new', handleNewAlert);
  }, [socket]);

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
  const dateStr = time.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });

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
      zIndex: 30,
    }}>
      {/* Left: org / logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>


        {/* Hamburger Menu (Mobile Only) */}
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
          className="md:hidden"
        >
          <Menu size={24} />
        </button>

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginRight: '24px' }}>
          <div style={{
            width: '32px', height: '32px',
            background: 'linear-gradient(135deg, #f97316 0%, #7ea0b6 100%)',
            borderRadius: '8px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 10px rgba(249,115,22,0.3)',
          }}>
            <Truck size={16} color="white" />
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
        <div style={{ position: 'relative', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowDropdown(!showDropdown)}>
          <Bell size={18} color="#f1f5f9" />
          {alerts.length > 0 && (
            <div style={{
              position: 'absolute', top: '-2px', right: '-2px',
              width: '14px', height: '14px', borderRadius: '50%',
              background: '#f97316', color: 'white',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '9px', fontWeight: 'bold', border: '2px solid #223A57',
            }}>
              {alerts.length}
            </div>
          )}
          {showDropdown && (
            <div style={{
              position: 'absolute', top: '30px', right: '0', width: '300px', background: '#fff', borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', zIndex: 100, border: '1px solid #e5e7eb', overflow: 'hidden'
            }} onClick={(e) => e.stopPropagation()}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb', fontWeight: 700, fontSize: '13px', background: '#f8fafc', color: '#111827', display: 'flex', justifyContent: 'space-between' }}>
                <span>Recent Alerts</span>
                {alerts.length > 0 && (
                  <span style={{ fontSize: '11px', color: '#6B7280', cursor: 'pointer', fontWeight: 500 }} onClick={(e) => { e.stopPropagation(); setAlerts([]); }}>Clear</span>
                )}
              </div>
              <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
                {alerts.length === 0 ? (
                  <div style={{ padding: '32px 16px', textAlign: 'center', fontSize: '13px', color: '#9CA3B8' }}>No new alerts in this session</div>
                ) : alerts.map((a, i) => (
                  <div key={i} style={{ padding: '12px 16px', borderBottom: i < alerts.length - 1 ? '1px solid #f3f4f6' : 'none', fontSize: '12px', display: 'flex', gap: '12px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#EF4444', flexShrink: 0, marginTop: '4px' }} />
                    <div>
                      <div style={{ fontWeight: 700, color: '#111827', marginBottom: '2px' }}>{a.vehicleName} <span style={{ color: '#6B7280', fontWeight: 500 }}>({a.plate})</span></div>
                      <div style={{ color: '#475569', lineHeight: 1.4, marginBottom: '6px' }}>{a.alertText}</div>
                      <div style={{ color: '#9ca3af', fontSize: '10px', fontWeight: 600 }}>{new Date(a.deviceTime).toLocaleTimeString()}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

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
          background: '#fff', borderRadius: '12px', borderLeft: '4px solid #EF4444',
          boxShadow: '0 10px 25px rgba(0,0,0,0.15)', padding: '16px',
          display: 'flex', gap: '12px', width: '320px', animation: 'fadeInDown 0.3s ease'
        }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Bell size={20} color="#EF4444" />
          </div>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 800, color: '#111827', marginBottom: '2px' }}>{latestToast.alertType.toUpperCase()} ALERT</div>
            <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '4px' }}>
              <span style={{ fontWeight: 700, color: '#4d6076' }}>{latestToast.vehicleName}</span> ({latestToast.plate})
            </div>
            <div style={{ fontSize: '13px', color: '#111827', lineHeight: 1.4 }}>{latestToast.alertText}</div>
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
