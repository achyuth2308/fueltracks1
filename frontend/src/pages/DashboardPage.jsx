import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Users2, Truck, Activity, AlertTriangle } from 'lucide-react';
import FleetMap from '../components/map/FleetMap';
import { useVehicles } from '../hooks/useVehicles';
import { getDashboardStats } from '../api/adminApi';

const StatCard = ({ label, value, color, icon: Icon, onClick }) => (
  <div
    onClick={onClick}
    style={{
      background: '#FFFFFF',
      borderRadius: '16px',
      padding: '20px',
      display: 'flex',
      alignItems: 'center',
      gap: '16px',
      flex: 1,
      minWidth: '180px',
      border: '1px solid #F1F5F9',
      boxShadow: '0 4px 12px rgba(0,0,0,0.02)',
      cursor: 'pointer',
      transition: 'all 0.2s ease',
    }}
    onMouseEnter={e => {
      e.currentTarget.style.transform = 'translateY(-2px)';
      e.currentTarget.style.boxShadow = `0 8px 24px ${color}15`;
      e.currentTarget.style.borderColor = `${color}30`;
    }}
    onMouseLeave={e => {
      e.currentTarget.style.transform = 'none';
      e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.02)';
      e.currentTarget.style.borderColor = '#F1F5F9';
    }}
  >
    <div style={{
      width: '48px', height: '48px',
      borderRadius: '12px',
      background: `${color}10`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0
    }}>
      <Icon size={24} color={color} />
    </div>
    <div>
      <div style={{ fontSize: '28px', fontWeight: 800, color: '#111827', lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ fontSize: '13px', color: '#6B7280', fontWeight: 600, marginTop: '4px' }}>
        {label}
      </div>
    </div>
  </div>
);

const LicenseCard = ({ title, total, used, available, color }) => (
  <div style={{
    background: '#FFFFFF',
    borderRadius: '16px',
    padding: '20px 24px',
    border: '1px solid #F1F5F9',
    boxShadow: '0 4px 12px rgba(0,0,0,0.02)',
    width: '240px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s ease',
  }}
  onMouseEnter={e => {
    e.currentTarget.style.transform = 'translateY(-2px)';
    e.currentTarget.style.boxShadow = `0 8px 24px ${color}15`;
    e.currentTarget.style.borderColor = `${color}30`;
  }}
  onMouseLeave={e => {
    e.currentTarget.style.transform = 'none';
    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.02)';
    e.currentTarget.style.borderColor = '#F1F5F9';
  }}
  >
    <div style={{ fontSize: '14px', color: '#111827', fontWeight: 700 }}>{title}</div>
    <div style={{ fontSize: '32px', color: color, fontWeight: 800, marginTop: '6px', marginBottom: '12px', lineHeight: 1 }}>{total}</div>
    <div style={{ display: 'flex', width: '100%', justifyContent: 'space-around', borderTop: '1px solid #F1F5F9', paddingTop: '12px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <span style={{ fontSize: '11px', color: '#6B7280', fontWeight: 600 }}>Used</span>
        <span style={{ fontSize: '15px', color: color, fontWeight: 700 }}>{used}</span>
      </div>
      <div style={{ width: '1px', background: '#F1F5F9' }}></div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <span style={{ fontSize: '11px', color: '#6B7280', fontWeight: 600 }}>Available</span>
        <span style={{ fontSize: '15px', color: color, fontWeight: 700 }}>{available}</span>
      </div>
    </div>
  </div>
);

const ActivityItem = ({ title, subtitle, time, color }) => (
  <div style={{ display: 'flex', gap: '12px', padding: '12px 0', borderBottom: '1px solid #F1F5F9' }}>
    <div style={{ marginTop: '4px' }}>
      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: color }} />
    </div>
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: '13px', fontWeight: 600, color: '#111827' }}>{title}</div>
      <div style={{ fontSize: '12px', color: '#6B7280', marginTop: '2px' }}>{subtitle}</div>
    </div>
    <div style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 500 }}>{time}</div>
  </div>
);

const DashboardPage = ({ setAppVehicles }) => {
  const navigate = useNavigate();
  const { vehicles, groups, loading, error } = useVehicles();
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [apiStats, setApiStats] = useState(null);

  useEffect(() => {
    if (vehicles && setAppVehicles) setAppVehicles(vehicles);
  }, [vehicles, setAppVehicles]);

  useEffect(() => {
    getDashboardStats()
      .then(res => {
        if (res.success) setApiStats(res.data);
      })
      .catch(err => console.error("Failed to fetch dashboard stats", err));
  }, [vehicles]);

  const onlineCount = vehicles.filter(v => v.is_online).length;

  const recentActivities = [...vehicles]
    .sort((a, b) => new Date(b.last_update) - new Date(a.last_update))
    .slice(0, 5)
    .map(v => ({
      id: v.id,
      title: `Location Update: ${v.name}`,
      subtitle: `${v.current_speed || 0} km/h • ${v.is_online ? 'Online' : 'Offline'}`,
      time: new Date(v.last_update).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      color: v.is_online ? '#10B981' : '#6B7280'
    }));

  const totalUsers = apiStats?.users ?? '-';
  const totalGroups = groups.length || '-';
  const totalVehicles = apiStats?.total_vehicles ?? vehicles.length;

  // Simulator dynamic values mapping (using live data)
  const basicTotal = vehicles.length;
  const basicUsed = onlineCount;
  const basicAvailable = vehicles.length - onlineCount;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 56px)', background: 'linear-gradient(to bottom, #FFF7ED 0%, #FFF7ED 30%, #F8FAFC 30%, #F8FAFC 100%)', overflowY: 'auto' }}>

      {/* KPI Cards Row (Moved Basic Card Here) */}
      <div style={{ padding: '24px', display: 'flex', gap: '20px', flexShrink: 0, flexWrap: 'wrap', alignItems: 'stretch' }}>
        <StatCard label="Users" value={totalUsers} color="#7C3AED" icon={Users} onClick={() => navigate('/admin/users')} />
        <StatCard label="Groups" value={totalGroups} color="#3B82F6" icon={Users2} onClick={() => navigate('/admin/groups')} />
        <StatCard label="Vehicles" value={totalVehicles} color="#EC4899" icon={Truck} onClick={() => navigate('/admin/vehicles')} />
        
        <LicenseCard 
          title="Basic" 
          total={basicTotal} 
          used={basicUsed} 
          available={basicAvailable} 
          color="#3B82F6"
        />
      </div>

      {/* Main Layout: Map & Activity */}
      <div style={{ display: 'flex', padding: '0 24px 24px 24px', gap: '24px', minHeight: '500px', flexShrink: 0 }}>
        <div style={{
          flex: 1,
          background: '#FFFFFF',
          borderRadius: '16px',
          border: '1px solid #E2E8F0',
          boxShadow: '0 4px 6px rgba(0,0,0,0.02)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          position: 'relative'
        }}>
          <div style={{
            position: 'absolute', top: '16px', left: '16px', right: '16px',
            display: 'flex', justifyContent: 'space-between', zIndex: 500, pointerEvents: 'none'
          }}>
            <div style={{
              background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(8px)',
              padding: '10px 16px', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
              border: '1px solid rgba(226,232,240,0.8)',
              pointerEvents: 'auto', display: 'flex', gap: '16px'
            }}>
              <div>
                <div style={{ fontSize: '11px', color: '#6B7280', fontWeight: 600, textTransform: 'uppercase' }}>Fleet Status</div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#111827' }}>
                  {onlineCount} <span style={{ color: '#10B981' }}>Online</span> / {vehicles.length} Total
                </div>
              </div>
            </div>

            {loading && (
              <div style={{
                background: 'rgba(255,255,255,0.95)', padding: '10px', borderRadius: '12px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center'
              }}>
                <div style={{ width: '16px', height: '16px', border: '2px solid #FF6B00', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
              </div>
            )}
          </div>

          <FleetMap
            vehicles={vehicles}
            selectedVehicle={selectedVehicle}
            onMarkerClick={(v) => setSelectedVehicle(v)}
          />
        </div>

        <div style={{
          width: '340px',
          minWidth: '340px',
          background: '#FFFFFF',
          borderRadius: '16px',
          border: '1px solid #E2E8F0',
          boxShadow: '0 4px 6px rgba(0,0,0,0.02)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}>
          <div style={{ padding: '20px', borderBottom: '1px solid #F1F5F9', background: '#FAFAF9' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#111827', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Activity size={18} color="#FF6B00" />
              Recent Activity
            </h3>
            <p style={{ fontSize: '12px', color: '#6B7280', marginTop: '4px' }}>Latest updates across the platform</p>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px' }}>
            {recentActivities.length > 0 ? (
              recentActivities.map((act, i) => (
                <ActivityItem key={act.id + i} {...act} />
              ))
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '12px', opacity: 0.6 }}>
                <AlertTriangle size={32} color="#94A3B8" />
                <p style={{ fontSize: '13px', color: '#64748B', fontWeight: 500 }}>No recent activity found</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
