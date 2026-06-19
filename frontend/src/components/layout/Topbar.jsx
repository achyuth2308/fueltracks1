import React, { useState, useEffect } from 'react';
import { Menu, Building, Radio, Wifi, WifiOff, Bell, Clock as ClockIcon, Truck } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useSocket } from '../../hooks/useSocket';
import * as adminApi from '../../api/adminApi';

const Topbar = ({ onMenuClick, vehicles = [] }) => {
  const { user } = useAuth();
  const { connected } = useSocket();
  const [stats, setStats] = useState({ total: 0, online: 0, offline: 0 });
  const [time, setTime] = useState(new Date());

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
      background: '#f5efe4',
      borderBottom: '1px solid #dfd0bf',
      flexShrink: 0,
      zIndex: 30,
    }}>
      {/* Left: org / logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>


        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginRight: '24px' }}>
          <div style={{
            width: '32px', height: '32px',
            background: 'linear-gradient(135deg, #8ba0b5 0%, #7ea0b6 100%)',
            borderRadius: '8px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 10px rgba(139, 160, 181, 0.3)',
          }}>
            <Truck size={16} color="white" />
          </div>
          <div>
            <div style={{ fontSize: '16px', fontWeight: 800, color: '#4d6076', letterSpacing: '-0.03em', lineHeight: 1.1 }}>
              FuelTracks
            </div>
            <div style={{ fontSize: '9px', fontWeight: 600, color: '#8ba0b5', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
              Enterprise
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
          <div style={{
            width: '5px', height: '5px', borderRadius: '50%',
            background: '#8ba0b5',
            boxShadow: '0 0 6px rgba(139,160,181,0.5)',
          }} />
          <span style={{
            fontSize: '12px', fontWeight: 600, color: '#4d6076',
            maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {user?.orgName || 'Platform Workspace'}
          </span>
        </div>
      </div>

      {/* Right: stats + clock + socket */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>

        {/* Fleet stats */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {[
            { label: 'Total', value: stats.total, color: '#4d6076' },
            { label: 'Online', value: stats.online, color: '#8ba0b5', dot: true },
            { label: 'Offline', value: stats.offline, color: '#b8a693', dot: true },
          ].map(({ label, value, color, dot }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              {dot && (
                <div style={{
                  width: '6px', height: '6px', borderRadius: '50%', background: color,
                  boxShadow: color === '#8ba0b5' ? '0 0 6px rgba(139,160,181,0.4)' : 'none',
                }} />
              )}
              <span style={{ fontSize: '11px', color: '#6e859b', fontWeight: 500 }}>{label}</span>
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
        <div style={{ width: '1px', height: '20px', background: '#dfd0bf' }} />

        {/* Live clock */}
        <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ClockIcon size={14} color="#6b7280" />
          <div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#4d6076', fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.02em', lineHeight: '1' }}>
              {timeStr}
            </div>
            <div style={{ fontSize: '9px', color: '#6e859b', fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: '2px' }}>
              {dateStr}
            </div>
          </div>
        </div>

        {/* Divider */}
        <div style={{ width: '1px', height: '20px', background: '#dfd0bf' }} />

        {/* Notifications */}
        <div style={{ position: 'relative', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Bell size={18} color="#4b5563" />
          <div style={{
            position: 'absolute', top: '-2px', right: '-2px',
            width: '14px', height: '14px', borderRadius: '50%',
            background: '#8ba0b5', color: 'white',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '9px', fontWeight: 'bold', border: '2px solid #f5efe4',
          }}>
            3
          </div>
        </div>

        {/* Socket status pill */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '5px',
          padding: '4px 10px',
          borderRadius: '99px',
          background: connected ? '#8ba0b5' : '#dfd0bf',
          border: `1px solid ${connected ? '#7ea0b6' : '#c3b29f'}`,
        }}>
          {connected
            ? <Wifi size={12} color="#ffffff" />
            : <WifiOff size={12} color="#4d6076" />
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
    </header>
  );
};

export default Topbar;
