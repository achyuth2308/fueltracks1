import React, { useState, useEffect } from 'react';
import { Menu, Building, Radio, Wifi, WifiOff, Bell } from 'lucide-react';
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
      }).catch(() => {});
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
      background: 'linear-gradient(90deg, #0c1526 0%, #0a1020 100%)',
      borderBottom: '1px solid rgba(255,255,255,0.05)',
      flexShrink: 0,
      zIndex: 30,
    }}>
      {/* Left: hamburger + org */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <button
          onClick={onMenuClick}
          style={{
            width: '30px', height: '30px',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: '7px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: '#4a5568',
            transition: 'all 0.15s',
          }}
          className="md:hidden"
        >
          <Menu size={15} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
          <div style={{
            width: '5px', height: '5px', borderRadius: '50%',
            background: '#2563eb',
            boxShadow: '0 0 6px rgba(37,99,235,0.7)',
          }} />
          <span style={{
            fontSize: '12px', fontWeight: 600, color: '#7c8db0',
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
            { label: 'Total', value: stats.total, color: '#7c8db0' },
            { label: 'Online', value: stats.online, color: '#10b981', dot: true },
            { label: 'Offline', value: stats.offline, color: '#374151', dot: true },
          ].map(({ label, value, color, dot }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              {dot && (
                <div style={{
                  width: '6px', height: '6px', borderRadius: '50%', background: color,
                  boxShadow: color === '#10b981' ? '0 0 6px rgba(16,185,129,0.5)' : 'none',
                }} />
              )}
              <span style={{ fontSize: '11px', color: '#4a5568', fontWeight: 500 }}>{label}</span>
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
        <div style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,0.06)' }} />

        {/* Live clock */}
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#e2e8f0', fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.02em' }}>
            {timeStr}
          </div>
          <div style={{ fontSize: '9px', color: '#2d3748', fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: '-1px' }}>
            {dateStr}
          </div>
        </div>

        {/* Divider */}
        <div style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,0.06)' }} />

        {/* Socket status pill */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '5px',
          padding: '3px 8px',
          borderRadius: '99px',
          background: connected ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
          border: `1px solid ${connected ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
        }}>
          {connected
            ? <Wifi size={11} color="#10b981" />
            : <WifiOff size={11} color="#ef4444" />
          }
          <span style={{
            fontSize: '9px', fontWeight: 700,
            letterSpacing: '0.08em', textTransform: 'uppercase',
            color: connected ? '#10b981' : '#ef4444',
          }}>
            {connected ? 'Live' : 'Off'}
          </span>
        </div>
      </div>
    </header>
  );
};

export default Topbar;
