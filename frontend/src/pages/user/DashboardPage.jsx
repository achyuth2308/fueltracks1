import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Users2, Truck, Activity, AlertTriangle } from 'lucide-react';

import { useVehicles } from '../../hooks/useVehicles';
import { getDashboardStats } from '../../api/adminApi';
import { useAuth } from '../../hooks/useAuth';
import CustomerDashboard from './CustomerDashboard';

const StatCard = ({ label, value, color, icon: Icon, onClick }) => (
  <div
    onClick={onClick}
    style={{
      background: '#FFFFFF',
      borderRadius: '16px',
      padding: '16px',
      display: 'flex',
      alignItems: 'center',
      gap: '16px',
      flex: 1,
      minWidth: '160px',
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
      width: '40px', height: '40px',
      borderRadius: '12px',
      background: `${color}10`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0
    }}>
      <Icon size={20} color={color} />
    </div>
    <div>
      <div style={{ fontSize: '24px', fontWeight: 800, color: '#111827', lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ fontSize: '13px', color: '#6B7280', fontWeight: 600, marginTop: '2px' }}>
        {label}
      </div>
    </div>
  </div>
);

const LicenseCard = ({ title, total, used, available, color, labelUsed = 'Used', labelAvailable = 'Available' }) => (
  <div style={{
    background: '#FFFFFF',
    borderRadius: '16px',
    padding: '16px 20px',
    border: '1px solid #F1F5F9',
    boxShadow: '0 4px 12px rgba(0,0,0,0.02)',
    width: '220px',
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
        <span style={{ fontSize: '11px', color: '#6B7280', fontWeight: 600 }}>{labelUsed}</span>
        <span style={{ fontSize: '15px', color: color, fontWeight: 700 }}>{used}</span>
      </div>
      <div style={{ width: '1px', background: '#F8FAFC' }}></div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <span style={{ fontSize: '11px', color: '#6B7280', fontWeight: 600 }}>{labelAvailable}</span>
        <span style={{ fontSize: '15px', color: color, fontWeight: 700 }}>{available}</span>
      </div>
    </div>
  </div>
);



const DashboardPage = ({ setAppVehicles }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { vehicles, groups, loading, error } = useVehicles();
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [quota, setQuota] = useState(null);
  const [apiStats, setApiStats] = useState(null);
  const isDealer = user?.role === 'dealer';

  // Customer role gets the map-based fleet dashboard
  if (user?.role === 'customer') {
    return <CustomerDashboard setAppVehicles={setAppVehicles} />;
  }

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

  useEffect(() => {
    if (isDealer) {
      import('../../api/adminApi').then(api => {
        api.getDeviceQuota().then(res => {
          if (res.success) setQuota(res.data);
        }).catch(err => console.error("Failed to fetch quota", err));
      });
    }
  }, [isDealer]);

  const onlineCount = vehicles.filter(v => v.is_online).length;

  const totalUsers = apiStats?.users ?? '-';
  const totalGroups = groups.length || '-';
  const totalVehicles = apiStats?.total_vehicles ?? vehicles.length;

  const getTierStats = (type) => {
    if (isDealer && quota) {
      return {
        total: quota.limits?.[type] || 0,
        used: quota.used?.[type] || 0,
        available: quota.available?.[type] || 0,
        labelUsed: 'Used',
        labelAvailable: 'Available'
      };
    } else {
      // Superadmin or fallback
      const typePrefixes = { 'Starter': 'ST', 'Basic': 'BC', 'Advanced': 'AD', 'Premium': 'EN' };
      const prefix = typePrefixes[type];

      let typeVehicles = vehicles.filter(v => {
        if (v.metadata?.licenceType === type) return true;
        if (v.licenceId && v.licenceId.startsWith(prefix)) return true;
        return false;
      });

      if (typeVehicles.length === 0 && type === 'Basic') {
        typeVehicles = vehicles;
      }

      const online = typeVehicles.filter(v => v.is_online).length;
      return {
        total: typeVehicles.length,
        used: online,
        available: typeVehicles.length - online,
        labelUsed: 'Online',
        labelAvailable: 'Offline'
      };
    }
  };

  const starterStats = getTierStats('Starter');
  const basicStats = getTierStats('Basic');
  const advancedStats = getTierStats('Advanced');
  const premiumStats = getTierStats('Premium');

  // Compute expiring licenses within 30 days
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

  const expiringVehicles = vehicles.filter(v => {
    if (!v.licence_expire_date) return false;
    const expireDate = new Date(v.licence_expire_date);
    return expireDate <= thirtyDaysFromNow;
  }).sort((a, b) => new Date(a.licence_expire_date) - new Date(b.licence_expire_date));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 56px)', background: 'linear-gradient(to bottom, #f0f9ff 0%, #f0f9ff 30%, #f0f9ff 30%, #f0f9ff 100%)', overflowY: 'auto' }}>

      {/* KPI Cards Row (Moved Basic Card Here) */}
      <div style={{ padding: '24px', display: 'flex', gap: '20px', flexShrink: 0, flexWrap: 'wrap', alignItems: 'stretch' }}>
        <StatCard label="Users" value={totalUsers} color="#7C3AED" icon={Users} onClick={() => navigate('/admin/users')} />
        <StatCard label="Groups" value={totalGroups} color="#3B82F6" icon={Users2} onClick={() => navigate('/admin/groups')} />
        <StatCard label="Vehicles" value={totalVehicles} color="#EC4899" icon={Truck} onClick={() => navigate('/admin/vehicles')} />

        <LicenseCard
          title="Starter"
          total={starterStats.total}
          used={starterStats.used}
          available={starterStats.available}
          labelUsed={starterStats.labelUsed}
          labelAvailable={starterStats.labelAvailable}
          color="#10B981"
        />
        <LicenseCard
          title="Basic"
          total={basicStats.total}
          used={basicStats.used}
          available={basicStats.available}
          labelUsed={basicStats.labelUsed}
          labelAvailable={basicStats.labelAvailable}
          color="#3B82F6"
        />
        <LicenseCard
          title="Advanced"
          total={advancedStats.total}
          used={advancedStats.used}
          available={advancedStats.available}
          labelUsed={advancedStats.labelUsed}
          labelAvailable={advancedStats.labelAvailable}
          color="#F59E0B"
        />
        <LicenseCard
          title="Premium"
          total={premiumStats.total}
          used={premiumStats.used}
          available={premiumStats.available}
          labelUsed={premiumStats.labelUsed}
          labelAvailable={premiumStats.labelAvailable}
          color="#8B5CF6"
        />
      </div>

      {/* Main Layout: Expiring Licenses */}
      <div style={{ display: 'flex', padding: '0 24px 24px 24px', minHeight: '500px', flexShrink: 0 }}>
        <div style={{
          flex: 1,
          background: '#FFFFFF',
          borderRadius: '16px',
          border: '1px solid #E2E8F0',
          boxShadow: '0 4px 6px rgba(0,0,0,0.02)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}>
          <div style={{ padding: '20px', borderBottom: '1px solid #F1F5F9', background: '#FAFAF9' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#111827', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle size={20} color="#F59E0B" />
              Licenses Expiring Within 30 Days
            </h3>
            <p style={{ fontSize: '13px', color: '#6B7280', marginTop: '4px' }}>Vehicles requiring license renewal</p>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '0' }}>
            {expiringVehicles.length > 0 ? (
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead style={{ position: 'sticky', top: 0, background: '#FFFFFF', zIndex: 1 }}>
                  <tr style={{ borderBottom: '2px solid #F1F5F9' }}>
                    <th style={{ padding: '16px 20px', fontSize: '13px', color: '#6B7280', fontWeight: 600 }}>Vehicle Name</th>
                    <th style={{ padding: '16px 20px', fontSize: '13px', color: '#6B7280', fontWeight: 600 }}>Registration No</th>
                    <th style={{ padding: '16px 20px', fontSize: '13px', color: '#6B7280', fontWeight: 600 }}>Expiry Date</th>
                    <th style={{ padding: '16px 20px', fontSize: '13px', color: '#6B7280', fontWeight: 600 }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {expiringVehicles.map(v => {
                    const exp = new Date(v.licence_expire_date);
                    const isExpired = exp < new Date();
                    return (
                      <tr key={v.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                        <td style={{ padding: '16px 20px', fontSize: '14px', color: '#111827', fontWeight: 500 }}>{v.name}</td>
                        <td style={{ padding: '16px 20px', fontSize: '14px', color: '#475569' }}>{v.plate || '-'}</td>
                        <td style={{ padding: '16px 20px', fontSize: '14px', color: '#475569' }}>{exp.toLocaleDateString('en-GB')}</td>
                        <td style={{ padding: '16px 20px' }}>
                          <span style={{
                            padding: '6px 12px', borderRadius: '12px', fontSize: '12px', fontWeight: 600,
                            background: isExpired ? '#FEE2E2' : '#FEF3C7',
                            color: isExpired ? '#DC2626' : '#D97706'
                          }}>
                            {isExpired ? 'Expired' : 'Expiring Soon'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '300px', gap: '12px', opacity: 0.6 }}>
                <div style={{ width: '64px', height: '64px', borderRadius: '32px', background: '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <AlertTriangle size={32} color="#94A3B8" />
                </div>
                <p style={{ fontSize: '15px', color: '#64748B', fontWeight: 500 }}>No licenses expiring within 30 days</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
