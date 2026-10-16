import React, { useState, useEffect, useMemo } from 'react';
import { formatLocalDate, getVehicleExpiryStatus } from '../../utils/dateUtils';


import { useNavigate } from 'react-router-dom';
import { Users, Users2, Truck, Activity, AlertTriangle, ChevronRight, ArrowUpRight, Wifi, WifiOff, Navigation, PauseCircle, Shield, Cpu, Smartphone } from 'lucide-react';

import { useVehicles } from '../../hooks/useVehicles';
import { getDashboardStats } from '../../api/adminApi';
import { useAuth } from '../../hooks/useAuth';
import CustomerDashboard from './CustomerDashboard';
import { getVehicleStatus } from '../../utils/markerUtils';

const StatCard = ({ label, value, color, icon: Icon, onClick }) => (
  <div
    onClick={onClick}
    className="flex-1 min-w-[130px] md:min-w-[150px] p-2.5 md:p-3 bg-white rounded-[12px] md:rounded-[14px] cursor-pointer transition-all duration-200"
    style={{
      border: `2px solid ${color}`,
      boxShadow: `0 2px 8px ${color}1A`,
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
    }}
    onMouseEnter={e => {
      e.currentTarget.style.transform = 'translateY(-2px)';
      e.currentTarget.style.boxShadow = `0 8px 18px ${color}30`;
    }}
    onMouseLeave={e => {
      e.currentTarget.style.transform = 'none';
      e.currentTarget.style.boxShadow = `0 2px 8px ${color}1A`;
    }}
  >
    <div className="w-[30px] h-[30px] md:w-[36px] md:h-[36px] rounded-[8px] md:rounded-[10px] shrink-0 flex items-center justify-center" style={{
      background: `${color}10`,
    }}>
      <Icon className="w-[15px] md:w-[18px] h-[15px] md:h-[18px]" color={color} />
    </div>
    <div>
      <div className="text-[16px] md:text-[22px] font-[800] text-gray-900 leading-none">
        {value}
      </div>
      <div className="text-[10px] md:text-[12px] text-gray-500 font-[600] mt-[2px]">
        {label}
      </div>
    </div>
  </div>
);

const VehicleOverviewCard = ({ total, online, offline, color = '#EC4899', onClick }) => (
  <div
    onClick={onClick}
    className="flex-1 min-w-[130px] md:max-w-[200px] p-2.5 md:p-3 bg-white rounded-[12px] md:rounded-[14px] cursor-pointer transition-all duration-200 flex flex-col items-center justify-center"
    style={{
      border: `2px solid ${color}`,
      boxShadow: `0 2px 8px ${color}1A`,
    }}
    onMouseEnter={e => {
      e.currentTarget.style.transform = 'translateY(-2px)';
      e.currentTarget.style.boxShadow = `0 8px 18px ${color}30`;
    }}
    onMouseLeave={e => {
      e.currentTarget.style.transform = 'none';
      e.currentTarget.style.boxShadow = `0 2px 8px ${color}1A`;
    }}
  >
    <div className="flex items-center gap-1.5 text-[12px] md:text-[13px] text-gray-900 font-[700]">
      <Truck className="w-[15px] h-[15px]" color={color} />
      <span>Vehicles</span>
    </div>
    <div className="text-[22px] md:text-[28px] font-[800] leading-none mt-[4px] mb-[8px]" style={{ color: color }}>
      {total}
    </div>
    <div className="flex w-full justify-around border-t border-slate-100 pt-[6px]">
      <div className="flex flex-col items-center">
        <span className="text-[9px] md:text-[10px] text-emerald-600 font-[700] flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
          Online
        </span>
        <span className="text-[12px] md:text-[14px] font-[800] text-emerald-600">{online}</span>
      </div>
      <div className="w-[1px] bg-slate-100"></div>
      <div className="flex flex-col items-center">
        <span className="text-[9px] md:text-[10px] text-rose-500 font-[700] flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 inline-block"></span>
          Offline
        </span>
        <span className="text-[12px] md:text-[14px] font-[800] text-rose-500">{offline}</span>
      </div>
    </div>
  </div>
);

const LicenseCard = ({ title, total, used, available, color, labelUsed = 'Used', labelAvailable = 'Available' }) => (
  <div
    className="flex-1 min-w-[130px] md:max-w-[200px] p-2.5 md:p-3 bg-white rounded-[12px] md:rounded-[14px] transition-all duration-200 flex flex-col items-center justify-center"
    style={{
      border: `2px solid ${color}`,
      boxShadow: `0 2px 8px ${color}1A`,
    }}
    onMouseEnter={e => {
      e.currentTarget.style.transform = 'translateY(-2px)';
      e.currentTarget.style.boxShadow = `0 8px 18px ${color}30`;
    }}
    onMouseLeave={e => {
      e.currentTarget.style.transform = 'none';
      e.currentTarget.style.boxShadow = `0 2px 8px ${color}1A`;
    }}
  >
    <div className="text-[12px] md:text-[13px] text-gray-900 font-[700]">{title}</div>
    <div className="text-[22px] md:text-[28px] font-[800] leading-none mt-[4px] mb-[8px]" style={{ color: color }}>{total}</div>
    <div className="flex w-full justify-around border-t border-slate-100 pt-[6px]">
      <div className="flex flex-col items-center">
        <span className="text-[9px] md:text-[10px] text-gray-500 font-[600]">{labelUsed}</span>
        <span className="text-[12px] md:text-[14px] font-[700]" style={{ color: color }}>{used}</span>
      </div>
      <div className="w-[1px] bg-slate-100"></div>
      <div className="flex flex-col items-center">
        <span className="text-[9px] md:text-[10px] text-gray-500 font-[600]">{labelAvailable}</span>
        <span className="text-[12px] md:text-[14px] font-[700]" style={{ color: color }}>{available}</span>
      </div>
    </div>
  </div>
);

const DeviceStatusCard = ({ title, total, online, moving, idle, parked, offline, color = '#0EA5E9', icon: Icon, onClick }) => (
  <div
    onClick={onClick}
    className="flex-1 min-w-[240px] p-2.5 md:p-3 bg-white rounded-[12px] md:rounded-[14px] cursor-pointer transition-all duration-200 flex flex-col items-center justify-center"
    style={{
      border: `2px solid ${color}`,
      boxShadow: `0 2px 8px ${color}1A`,
    }}
    onMouseEnter={e => {
      e.currentTarget.style.transform = 'translateY(-2px)';
      e.currentTarget.style.boxShadow = `0 8px 18px ${color}30`;
    }}
    onMouseLeave={e => {
      e.currentTarget.style.transform = 'none';
      e.currentTarget.style.boxShadow = `0 2px 8px ${color}1A`;
    }}
  >
    <div className="flex items-center gap-1.5 text-[12px] md:text-[13px] text-gray-900 font-[700]">
      {Icon && <Icon className="w-[15px] h-[15px]" color={color} />}
      <span>{title}</span>
    </div>

    <div className="text-[22px] md:text-[28px] font-[800] leading-none mt-[4px] mb-[8px]" style={{ color: color }}>
      {total}
    </div>

    <div className="flex w-full justify-around border-t border-slate-100 pt-[6px]">
      <div className="flex flex-col items-center">
        <span className="text-[9px] md:text-[10px] text-emerald-600 font-[700] flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
          Online
        </span>
        <span className="text-[12px] md:text-[14px] font-[800] text-emerald-600">{online}</span>
      </div>

      <div className="w-[1px] bg-slate-100"></div>

      <div className="flex flex-col items-center">
        <span className="text-[9px] md:text-[10px] text-teal-600 font-[700] flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-teal-500 inline-block"></span>
          Moving
        </span>
        <span className="text-[12px] md:text-[14px] font-[800] text-teal-600">{moving}</span>
      </div>

      <div className="w-[1px] bg-slate-100"></div>

      <div className="flex flex-col items-center">
        <span className="text-[9px] md:text-[10px] text-amber-500 font-[700] flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block"></span>
          Idle
        </span>
        <span className="text-[12px] md:text-[14px] font-[800] text-amber-600">{idle}</span>
      </div>

      <div className="w-[1px] bg-slate-100"></div>

      <div className="flex flex-col items-center">
        <span className="text-[9px] md:text-[10px] text-indigo-500 font-[700] flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 inline-block"></span>
          Parked
        </span>
        <span className="text-[12px] md:text-[14px] font-[800] text-indigo-600">{parked}</span>
      </div>

      <div className="w-[1px] bg-slate-100"></div>

      <div className="flex flex-col items-center">
        <span className="text-[9px] md:text-[10px] text-rose-500 font-[700] flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 inline-block"></span>
          Offline
        </span>
        <span className="text-[12px] md:text-[14px] font-[800] text-rose-500">{offline}</span>
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
    if (vehicles && setAppVehicles) {
      setAppVehicles(prev => {
        if (!prev || prev.length !== vehicles.length) return vehicles;
        const prevOnline = prev.filter(v => v.is_online).length;
        const currOnline = vehicles.filter(v => v.is_online).length;
        if (prevOnline !== currOnline) return vehicles;
        return prev;
      });
    }
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

  const onlineCount = vehicles.length > 0
    ? vehicles.filter(v => v.is_online).length
    : (apiStats?.online_vehicles !== undefined ? Number(apiStats.online_vehicles) : 0);

  const totalUsers = apiStats?.users ?? '-';
  const totalGroups = groups.length || '-';
  const totalVehicles = vehicles.length > 0
    ? vehicles.length
    : (apiStats?.total_vehicles !== undefined ? Number(apiStats.total_vehicles) : 0);

  const offlineCount = Math.max(0, totalVehicles - onlineCount);

  const normalizeDeviceType = (v) => {
    const raw = v.deviceType || v.device_version || v.metadata?.deviceModel || v.metadata?.deviceType || v.model || '';
    const str = String(raw).trim();
    const upper = str.toUpperCase();
    if (!str) return 'Other';
    if (upper.includes('VOLTY')) return 'VOLTY';
    if (upper.includes('AIS140') || upper.includes('AIS-140') || upper.includes('AIS 140')) {
      if (upper.includes('V2')) return 'AIS140 V2';
      return 'AIS140';
    }
    if (upper.includes('CONCOX')) return 'CONCOX';
    if (upper.includes('FMB') || upper.includes('TELTONIKA')) return 'TELTONIKA';
    if (upper.includes('BSTPL') || upper.includes('TRACKNOW')) return 'TRACKNOW';
    return str;
  };

  const { allStats, voltyStats, otherDeviceCards } = useMemo(() => {
    const calcStats = (vehList) => {
      let online = 0;
      let moving = 0;
      let idle = 0;
      let parked = 0;
      let offline = 0;

      vehList.forEach(v => {
        const status = getVehicleStatus(v);
        if (status === 'running') {
          moving++;
          online++;
        } else if (status === 'idle') {
          idle++;
          online++;
        } else if (status === 'parked') {
          parked++;
          if (v.is_online) online++;
          else offline++;
        } else {
          offline++;
        }
      });

      return {
        total: vehList.length,
        online,
        moving,
        idle,
        parked,
        offline
      };
    };

    const all = calcStats(vehicles);
    if (vehicles.length === 0 && apiStats) {
      all.total = Number(apiStats.total_vehicles || 0);
      all.online = Number(apiStats.online_vehicles || 0);
      all.offline = Math.max(0, all.total - all.online);
    }

    const voltyVehicles = vehicles.filter(v => normalizeDeviceType(v) === 'VOLTY');
    const volty = calcStats(voltyVehicles);

    const otherGroups = {};
    const colorPalette = ['#8B5CF6', '#F59E0B', '#10B981', '#EC4899'];
    let colorIdx = 0;

    vehicles.forEach(v => {
      const type = normalizeDeviceType(v);
      if (type !== 'VOLTY' && type !== 'Other') {
        if (!otherGroups[type]) {
          otherGroups[type] = [];
        }
        otherGroups[type].push(v);
      }
    });

    const otherCards = Object.entries(otherGroups).map(([type, list]) => ({
      title: `${type} Devices`,
      color: colorPalette[colorIdx++ % colorPalette.length],
      ...calcStats(list)
    }));

    return {
      allStats: all,
      voltyStats: volty,
      otherDeviceCards: otherCards
    };
  }, [vehicles, apiStats]);

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

      {/* KPI Cards Row 1 */}
      <div className="p-3 md:p-4 pb-2 md:pb-2 flex flex-wrap items-stretch shrink-0 gap-2.5 md:gap-3">
        <StatCard label="Users" value={totalUsers} color="#7C3AED" icon={Users} onClick={() => navigate('/admin/users')} />
        <StatCard label="Groups" value={totalGroups} color="#3B82F6" icon={Users2} onClick={() => navigate('/admin/groups')} />
        <VehicleOverviewCard
          total={totalVehicles}
          online={onlineCount}
          offline={offlineCount}
          color="#EC4899"
          onClick={() => navigate('/admin/vehicles')}
        />

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

      {/* Device Telemetry Overview Cards (Prepared like LicenseCard) */}
      <div className="px-3 md:px-4 pb-3 md:pb-3 flex flex-wrap items-stretch shrink-0 gap-2.5 md:gap-3">
        <DeviceStatusCard
          title="All Devices"
          total={allStats.total}
          online={allStats.online}
          moving={allStats.moving}
          idle={allStats.idle}
          parked={allStats.parked}
          offline={allStats.offline}
          color="#3B82F6"
          icon={Cpu}
          onClick={() => navigate('/admin/vehicles')}
        />
        <DeviceStatusCard
          title="VOLTY Devices"
          total={voltyStats.total}
          online={voltyStats.online}
          moving={voltyStats.moving}
          idle={voltyStats.idle}
          parked={voltyStats.parked}
          offline={voltyStats.offline}
          color="#0EA5E9"
          icon={Smartphone}
          onClick={() => navigate('/admin/vehicles')}
        />
        {otherDeviceCards.map(dev => (
          <DeviceStatusCard
            key={dev.title}
            title={dev.title}
            total={dev.total}
            online={dev.online}
            moving={dev.moving}
            idle={dev.idle}
            parked={dev.parked}
            offline={dev.offline}
            color={dev.color}
            icon={Cpu}
            onClick={() => navigate('/admin/vehicles')}
          />
        ))}
      </div>

      {/* Main Layout: Expiring Licenses */}
      <div style={{ display: 'flex', padding: '0 16px 16px 16px', minHeight: '360px', flexShrink: 0 }}>
        <div style={{
          flex: 1,
          background: '#FFFFFF',
          borderRadius: '16px',
          border: '2px solid #F59E0B',
          boxShadow: '0 4px 12px rgba(245,158,11,0.12)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #F1F5F9', background: '#FAFAF9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#111827', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                <AlertTriangle size={20} color="#F59E0B" />
                Expiring Vehicle Licenses
              </h3>
              <p style={{ fontSize: '13px', color: '#6B7280', marginTop: '4px', margin: 0 }}>Vehicles requiring license renewal</p>
            </div>
            <button
              onClick={() => navigate('/admin/vehicles')}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#2563EB',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              View All <ChevronRight size={16} />
            </button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '0' }}>
            {expiringVehicles.length > 0 ? (
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead style={{ position: 'sticky', top: 0, background: '#FFFFFF', zIndex: 1 }}>
                  <tr style={{ borderBottom: '2px solid #F1F5F9' }}>
                    <th style={{ padding: '14px 18px', fontSize: '13px', color: '#6B7280', fontWeight: 600 }}>Vehicle Name</th>
                    <th style={{ padding: '14px 18px', fontSize: '13px', color: '#6B7280', fontWeight: 600 }}>Registration No</th>
                    <th style={{ padding: '14px 18px', fontSize: '13px', color: '#6B7280', fontWeight: 600 }}>Customer Name</th>
                    <th style={{ padding: '14px 18px', fontSize: '13px', color: '#6B7280', fontWeight: 600 }}>Mobile Number</th>
                    <th style={{ padding: '14px 18px', fontSize: '13px', color: '#6B7280', fontWeight: 600 }}>Expiry Date</th>
                    <th style={{ padding: '14px 18px', fontSize: '13px', color: '#6B7280', fontWeight: 600 }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {expiringVehicles.map(v => {
                    const status = getVehicleExpiryStatus(v.licence_expire_date, v.licence_issued_date, v.metadata);
                    const isExpired = status.isExpired;
                    const customerName = v.metadata?.ownerName || v.metadata?.customerName || v.driver_name || v.org_name || '—';
                    const mobileNumber = v.metadata?.ownerPhone || v.metadata?.customerPhone || v.driver_phone || '—';

                    return (
                      <tr key={v.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                        <td style={{ padding: '14px 18px', fontSize: '14px', color: '#111827', fontWeight: 600 }}>{v.name}</td>
                        <td style={{ padding: '14px 18px', fontSize: '14px', color: '#475569' }}>{v.plate || '-'}</td>
                        <td style={{ padding: '14px 18px', fontSize: '14px', color: '#1E293B', fontWeight: 500 }}>{customerName}</td>
                        <td style={{ padding: '14px 18px', fontSize: '14px', color: '#475569', fontFamily: 'monospace' }}>{mobileNumber}</td>
                        <td style={{ padding: '14px 18px', fontSize: '14px', color: '#475569' }}>{formatLocalDate(v.licence_expire_date)}</td>
                        <td style={{ padding: '14px 18px' }}>
                          <span style={{
                            padding: '5px 12px', borderRadius: '12px', fontSize: '12px', fontWeight: 700,
                            background: isExpired ? '#FEE2E2' : '#FEF3C7',
                            color: isExpired ? '#DC2626' : '#D97706'
                          }}>
                            {status.text}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '200px', gap: '12px', opacity: 0.6 }}>
                <AlertTriangle size={32} color="#94A3B8" />
                <p style={{ fontSize: '15px', color: '#64748B', fontWeight: 500, margin: 0 }}>All vehicle licenses are active and up to date!</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
