import React, { useState, useEffect, useMemo } from 'react';
import { formatLocalDate, getVehicleExpiryStatus } from '../../utils/dateUtils';
import { useNavigate } from 'react-router-dom';
import {
  Users, Users2, Truck, Activity, AlertTriangle, ChevronRight, ArrowUpRight,
  Wifi, WifiOff, Navigation, PauseCircle, Shield, Plus, Building2,
  ShieldCheck, CheckCircle2, Clock, Search, ExternalLink, RefreshCw, Radio
} from 'lucide-react';

import { useVehicles } from '../../hooks/useVehicles';
import { getDashboardStats, getOrgs } from '../../api/adminApi';
import { useAuth } from '../../hooks/useAuth';
import CustomerDashboard from './CustomerDashboard';
import { getVehicleStatus, getNoDataThresholdHours, setNoDataThresholdHours, NO_DATA_OPTIONS } from '../../utils/markerUtils';
import { getVehicleLicenseTier } from '../../utils/licenseUtils';

/* Modern Entity Stat Card - Style A (Top Accent Line) */
const StatCard = ({ label, value, color, icon: Icon, subtext, onClick }) => (
  <div
    onClick={onClick}
    className="bg-white rounded-xl p-3 cursor-pointer transition-all duration-200 flex flex-col justify-between hover:-translate-y-0.5"
    style={{
      border: '1px solid #E2E8F0',
      borderTop: `3.5px solid ${color}`,
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    }}
    onMouseEnter={e => {
      e.currentTarget.style.boxShadow = `0 6px 16px -2px ${color}25`;
      e.currentTarget.style.borderColor = `${color}50`;
      e.currentTarget.style.borderTop = `3.5px solid ${color}`;
    }}
    onMouseLeave={e => {
      e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)';
      e.currentTarget.style.borderColor = '#E2E8F0';
      e.currentTarget.style.borderTop = `3.5px solid ${color}`;
    }}
  >
    <div className="flex items-center justify-between gap-1.5">
      <span style={{ fontSize: '11px', fontWeight: 800, color: '#000000', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label}
      </span>
      <div
        style={{
          width: '28px',
          height: '28px',
          borderRadius: '7px',
          background: `${color}14`,
          color: color,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Icon size={15} strokeWidth={2.4} />
      </div>
    </div>

    <div className="my-1.5">
      <div style={{ fontSize: '24px', fontWeight: 900, color: '#000000', lineHeight: 1 }}>
        {value}
      </div>
    </div>

    {subtext && (
      <div className="flex items-center justify-between pt-1 border-t border-slate-100">
        <span
          style={{
            fontSize: '10.5px',
            fontWeight: 700,
            color: '#000000',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '3px',
          }}
        >
          {subtext}
          <ChevronRight size={11} strokeWidth={2.8} color="#000000" />
        </span>
      </div>
    )}
  </div>
);

/* Modern Vehicle Overview Card - Style A (Top Accent Line) */
const VehicleOverviewCard = ({ total, online, offline, color = '#DB2777', onClick }) => {
  return (
    <div
      onClick={onClick}
      className="bg-white rounded-xl p-3 cursor-pointer transition-all duration-200 flex flex-col justify-between hover:-translate-y-0.5"
      style={{
        border: '1px solid #E2E8F0',
        borderTop: `3.5px solid ${color}`,
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.boxShadow = `0 6px 16px -2px ${color}25`;
        e.currentTarget.style.borderColor = `${color}50`;
        e.currentTarget.style.borderTop = `3.5px solid ${color}`;
      }}
      onMouseLeave={e => {
        e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)';
        e.currentTarget.style.borderColor = '#E2E8F0';
        e.currentTarget.style.borderTop = `3.5px solid ${color}`;
      }}
    >
      <div className="flex items-center justify-between gap-1.5">
        <span style={{ fontSize: '11px', fontWeight: 800, color: '#000000', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Vehicles
        </span>
        <div
          style={{
            width: '28px',
            height: '28px',
            borderRadius: '7px',
            background: `${color}14`,
            color: color,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Truck size={15} strokeWidth={2.4} />
        </div>
      </div>

      <div className="my-1.5">
        <div style={{ fontSize: '24px', fontWeight: 900, color: '#000000', lineHeight: 1 }}>
          {total}
        </div>
      </div>

      <div className="flex items-center justify-between pt-1 border-t border-slate-100" style={{ fontSize: '10.5px', fontWeight: 700 }}>
        <span className="text-emerald-600 flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
          {online} Online
        </span>
        <span className="text-rose-600 flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
          {offline} No Data
        </span>
      </div>
    </div>
  );
};

/* Modern Tier License Card - Style A (Top Accent Line) */
const LicenseCard = ({ title, total, used, available, color, labelUsed = 'Online', labelAvailable = 'No Data', onClick }) => {
  return (
    <div
      onClick={onClick}
      className="bg-white rounded-xl p-3 cursor-pointer transition-all duration-200 flex flex-col justify-between hover:-translate-y-0.5"
      style={{
        border: '1px solid #E2E8F0',
        borderTop: `3.5px solid ${color}`,
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.boxShadow = `0 6px 16px -2px ${color}25`;
        e.currentTarget.style.borderColor = `${color}50`;
        e.currentTarget.style.borderTop = `3.5px solid ${color}`;
      }}
      onMouseLeave={e => {
        e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)';
        e.currentTarget.style.borderColor = '#E2E8F0';
        e.currentTarget.style.borderTop = `3.5px solid ${color}`;
      }}
      title={`View ${title} License Vehicles`}
    >
      <div className="flex items-center justify-between gap-1.5">
        <span style={{ fontSize: '11px', fontWeight: 800, color: '#000000', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {title}
        </span>
        <span
          style={{
            fontSize: '9px',
            fontWeight: 800,
            padding: '1.5px 6px',
            borderRadius: '6px',
            background: `${color}14`,
            color: color,
            letterSpacing: '0.04em',
            flexShrink: 0
          }}
        >
          TIER
        </span>
      </div>

      <div className="my-1.5">
        <div style={{ fontSize: '24px', fontWeight: 900, color: '#000000', lineHeight: 1 }}>
          {total}
        </div>
      </div>

      <div className="flex items-center justify-between pt-1 border-t border-slate-100" style={{ fontSize: '10.5px', fontWeight: 700 }}>
        <span className="text-emerald-600">
          <strong className="font-[800]">{used}</strong> {labelUsed}
        </span>
        <span className={available > 0 ? "text-rose-600" : "text-black"}>
          <strong className="font-[800]">{available}</strong> {labelAvailable}
        </span>
      </div>
    </div>
  );
};


const DashboardPage = ({ setAppVehicles }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { vehicles, groups, loading, error } = useVehicles();
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [quota, setQuota] = useState(null);
  const [apiStats, setApiStats] = useState(null);
  const [totalOrgs, setTotalOrgs] = useState(0);
  const isDealer = user?.role === 'dealer';
  const [noDataThreshold, setNoDataThreshold] = useState(getNoDataThresholdHours());

  useEffect(() => {
    getOrgs()
      .then(res => {
        if (res?.success && Array.isArray(res.data)) {
          setTotalOrgs(res.data.length);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const handleThresholdChange = (e) => {
      setNoDataThreshold(e.detail || getNoDataThresholdHours());
    };
    window.addEventListener('nodata-threshold-changed', handleThresholdChange);
    return () => window.removeEventListener('nodata-threshold-changed', handleThresholdChange);
  }, []);

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
    let isMounted = true;
    const fetchStats = () => {
      getDashboardStats()
        .then(res => {
          if (isMounted && res?.success) setApiStats(res.data);
        })
        .catch(err => console.error("Failed to fetch dashboard stats", err));
    };

    fetchStats();
    const interval = setInterval(fetchStats, 60000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

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

  const totalOrgsCount = totalOrgs || (apiStats?.organizations !== undefined ? Number(apiStats.organizations) : (user?.role === 'superadmin' ? '1' : '-'));
  const totalUsers = apiStats?.users ?? (user?.role === 'superadmin' ? '3' : '-');
  const totalGroups = groups.length || (user?.role === 'superadmin' ? '2' : '-');
  const totalVehicles = vehicles.length > 0
    ? vehicles.length
    : (apiStats?.total_vehicles !== undefined ? Number(apiStats.total_vehicles) : 0);

  const offlineCount = Math.max(0, totalVehicles - onlineCount);

  const getTierStats = (type) => {
    if (isDealer && quota) {
      const limitVal = quota.limits?.[type] ??
        (type === 'Standard' ? quota.limits?.['Basic'] : undefined) ??
        (type === 'Standard Pro' ? quota.limits?.['Starter'] : undefined) ?? 0;
      const usedVal = quota.used?.[type] ??
        (type === 'Standard' ? quota.used?.['Basic'] : undefined) ??
        (type === 'Standard Pro' ? quota.used?.['Starter'] : undefined) ?? 0;
      const availVal = quota.available?.[type] ??
        (type === 'Standard' ? quota.available?.['Basic'] : undefined) ??
        (type === 'Standard Pro' ? quota.available?.['Starter'] : undefined) ?? 0;

      return {
        total: limitVal,
        used: usedVal,
        available: availVal,
        labelUsed: 'Used',
        labelAvailable: 'Available'
      };
    } else {
      let typeVehicles = vehicles.filter(v => getVehicleLicenseTier(v).toLowerCase() === type.toLowerCase());

      const online = typeVehicles.filter(v => v.is_online).length;
      return {
        total: typeVehicles.length,
        used: online,
        available: typeVehicles.length - online,
        labelUsed: 'Online',
        labelAvailable: 'No Data'
      };
    }
  };

  const standardStats = getTierStats('Standard');
  const standardProStats = getTierStats('Standard Pro');
  const advancedStats = getTierStats('Advanced');
  const premiumStats = getTierStats('Premium');

  // Compute expiring/expired licenses within threshold (7 days / 1 week alert window)
  const expiringVehicles = vehicles.filter(v => {
    if (!v.licence_expire_date) return false;
    const status = getVehicleExpiryStatus(v.licence_expire_date, v.licence_issued_date, v.metadata);
    return status.isExpiring || status.isExpired;
  }).sort((a, b) => new Date(a.licence_expire_date) - new Date(b.licence_expire_date));

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100vh - 56px)',
        background: '#f8fafc',
        overflowY: 'auto',
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif"
      }}
    >
      {/* Top Header & Welcome Banner */}
      <div className="px-4 md:px-6 pt-3 pb-2 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-[19px] md:text-[21px] font-[900] text-slate-900 tracking-tight m-0">
              Fleet Overview
            </h1>
            <span
              style={{
                background: 'var(--brand-badge-bg, #ecfdf5)',
                color: 'var(--brand-badge-text, #047857)',
                borderColor: 'var(--brand-badge-border, #a7f3d0)',
              }}
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10.5px] font-[700] border"
            >
              <span style={{ background: 'var(--brand-primary, #10b981)' }} className="w-1.5 h-1.5 rounded-full animate-pulse"></span>
              Live Telemetry
            </span>
          </div>
          <p className="text-[11.5px] md:text-[12px] text-slate-500 mt-0.5 font-[500] m-0">
            Real-time tracking diagnostics, telemetry status, and organizational metrics.
          </p>
        </div>
      </div>

      {/* Fleet Overview Cards (Style A: Compact 8-Card Single Row) */}
      <div className="px-4 md:px-6 pb-2.5 shrink-0">
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
          <StatCard
            label="Users"
            value={totalUsers}
            color="#7C3AED"
            icon={Users}
            subtext="View Users"
            onClick={() => navigate('/admin/users')}
          />
          <StatCard
            label="Groups"
            value={totalGroups}
            color="#2563EB"
            icon={Users2}
            subtext="View Groups"
            onClick={() => navigate('/admin/groups')}
          />
          <StatCard
            label="Organizations"
            value={totalOrgsCount}
            color="#D97706"
            icon={Building2}
            subtext="View Organizations"
            onClick={() => navigate('/admin/organizations')}
          />
          <VehicleOverviewCard
            total={totalVehicles}
            online={onlineCount}
            offline={offlineCount}
            color="#DB2777"
            onClick={() => navigate('/admin/vehicles')}
          />
          <LicenseCard
            title="Standard"
            total={standardStats.total}
            used={standardStats.used}
            available={standardStats.available}
            labelUsed={standardStats.labelUsed}
            labelAvailable={standardStats.labelAvailable}
            color="#0284C7"
            onClick={() => navigate('/admin/vehicles?tier=Standard')}
          />
          <LicenseCard
            title="Standard Pro"
            total={standardProStats.total}
            used={standardProStats.used}
            available={standardProStats.available}
            labelUsed={standardProStats.labelUsed}
            labelAvailable={standardProStats.labelAvailable}
            color="#10B981"
            onClick={() => navigate('/admin/vehicles?tier=Standard%20Pro')}
          />
          <LicenseCard
            title="Advanced"
            total={advancedStats.total}
            used={advancedStats.used}
            available={advancedStats.available}
            labelUsed={advancedStats.labelUsed}
            labelAvailable={advancedStats.labelAvailable}
            color="#F59E0B"
            onClick={() => navigate('/admin/vehicles?tier=Advanced')}
          />
          <LicenseCard
            title="Premium"
            total={premiumStats.total}
            used={premiumStats.used}
            available={premiumStats.available}
            labelUsed={premiumStats.labelUsed}
            labelAvailable={premiumStats.labelAvailable}
            color="#8B5CF6"
            onClick={() => navigate('/admin/vehicles?tier=Premium')}
          />
        </div>
      </div>

      {/* Prominent Quick Action Banner: Add Device */}
      <div className="px-4 md:px-6 pb-2.5 shrink-0">
        <div
          onClick={() => navigate('/onBoardDevice')}
          className="w-full rounded-xl px-5 py-3.5 flex items-center justify-between gap-4 cursor-pointer transition-all duration-150"
          style={{
            background: '#FFF7ED',
            border: '1.5px solid #EA580C',
            boxShadow: '0 2px 5px rgba(234, 88, 12, 0.08)',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = '#C2410C';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(234, 88, 12, 0.16)';
            e.currentTarget.style.transform = 'translateY(-1px)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = '#EA580C';
            e.currentTarget.style.boxShadow = '0 2px 5px rgba(234, 88, 12, 0.08)';
            e.currentTarget.style.transform = 'none';
          }}
        >
          <div className="flex items-center gap-3.5">
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '10px',
                background: '#FFFFFF',
                color: '#EA580C',
                border: '1px solid #FED7AA',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 1px 3px rgba(234, 88, 12, 0.12)',
                flexShrink: 0
              }}
            >
              <Plus size={22} strokeWidth={2.8} />
            </div>
            <div>
              <div style={{ fontSize: '15px', fontWeight: 800, color: '#000000', letterSpacing: '-0.01em', lineHeight: 1.2 }}>
                Add New Device
              </div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#000000', marginTop: '3px' }}>
                Quickly register and connect a new GPS tracking device to your fleet
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              navigate('/onBoardDevice');
            }}
            style={{
              background: '#EA580C',
              color: '#FFFFFF',
              border: 'none',
              padding: '10px 22px',
              borderRadius: '9px',
              fontSize: '14px',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 2px 6px rgba(234, 88, 12, 0.25)',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = '#C2410C';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = '#EA580C';
            }}
          >
            <Plus size={18} strokeWidth={2.8} />
            <span>Add Device</span>
          </button>
        </div>
      </div>

      {/* Main Layout: Expiring Licenses */}
      <div className="px-4 md:px-6 pb-4 flex-1 min-h-[220px] flex">
        <div className="w-full bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
          <div className="py-2.5 px-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-amber-50 border border-amber-200/60 flex items-center justify-center text-amber-600">
                <AlertTriangle size={15} />
              </div>
              <div>
                <h3 className="text-[14px] font-[800] text-slate-900 m-0 leading-tight">
                  Expiring Vehicle Licenses
                </h3>
                <p className="text-[11px] text-slate-500 m-0 mt-0.5 font-[500]">
                  Vehicles requiring license renewal
                </p>
              </div>
            </div>
            <button
              onClick={() => navigate('/admin/vehicles')}
              className="text-[11.5px] font-[700] text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer bg-transparent border-none"
            >
              View All <ChevronRight size={14} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto overflow-x-auto w-full">
            {expiringVehicles.length > 0 ? (
              <table className="w-full min-w-[680px] text-left border-collapse">
                <thead className="sticky top-0 z-10" style={{ background: 'var(--brand-header, #1e1b4b)' }}>
                  <tr className="text-[11px] font-[800] uppercase tracking-wider" style={{ color: '#ffffff' }}>
                    <th className="py-2.5 px-3 border-r border-white/10" style={{ color: '#ffffff', letterSpacing: '0.04em' }}>Vehicle Name</th>
                    <th className="py-2.5 px-3 border-r border-white/10" style={{ color: '#ffffff', letterSpacing: '0.04em' }}>Registration No</th>
                    <th className="py-2.5 px-3 border-r border-white/10" style={{ color: '#ffffff', letterSpacing: '0.04em' }}>Customer Name</th>
                    <th className="py-2.5 px-3 border-r border-white/10" style={{ color: '#ffffff', letterSpacing: '0.04em' }}>Mobile Number</th>
                    <th className="py-2.5 px-3 border-r border-white/10" style={{ color: '#ffffff', letterSpacing: '0.04em' }}>Expiry Date</th>
                    <th className="py-2.5 px-3 border-r border-white/10" style={{ color: '#ffffff', letterSpacing: '0.04em' }}>Renewal Price</th>
                    <th className="py-2.5 px-3" style={{ color: '#ffffff', letterSpacing: '0.04em' }}>Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {expiringVehicles.map(v => {
                    const status = getVehicleExpiryStatus(v.licence_expire_date, v.licence_issued_date, v.metadata);
                    const isExpired = status.isExpired;
                    const customerName = v.metadata?.ownerName || v.metadata?.customerName || v.driver_name || v.org_name || '—';
                    const mobileNumber = v.metadata?.ownerPhone || v.metadata?.customerPhone || v.driver_phone || '—';

                    return (
                      <tr key={v.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-2 px-3 text-[12.5px] font-[700] text-slate-900">{v.name}</td>
                        <td className="py-2 px-3 text-[12px] text-slate-700 font-mono">{v.plate || '-'}</td>
                        <td className="py-2 px-3 text-[12px] text-slate-800 font-[500]">{customerName}</td>
                        <td className="py-2 px-3 text-[12px] text-slate-600 font-mono">{mobileNumber}</td>
                        <td className="py-2 px-3 text-[12px] text-slate-600">{formatLocalDate(v.licence_expire_date)}</td>
                        <td className="py-2 px-3 text-[12px] font-[700]">
                          {(() => {
                            const ren = v.metadata?.renewal_price;
                            const disc = v.metadata?.discount_price;
                            if (disc && ren && parseFloat(disc) < parseFloat(ren)) {
                              return (
                                <div className="flex flex-col">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] line-through text-slate-400">₹{parseFloat(ren).toFixed(2)}</span>
                                    <span className="text-[12px] font-extrabold text-emerald-600">₹{parseFloat(disc).toFixed(2)}</span>
                                  </div>
                                  <span className="text-[9.5px] text-emerald-600 font-bold">Save ₹{(parseFloat(ren) - parseFloat(disc)).toFixed(2)}</span>
                                </div>
                              );
                            } else if (ren) {
                              return <span className="text-slate-800">₹{parseFloat(ren).toFixed(2)}</span>;
                            }
                            return <span className="text-slate-400 font-normal">—</span>;
                          })()}
                        </td>
                        <td className="py-2 px-3">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-[700] ${isExpired ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                            {status.text}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div className="flex flex-col items-center justify-center h-full min-h-[220px] gap-2.5 opacity-60">
                <AlertTriangle size={36} color="#94A3B8" />
                <p className="text-[14px] font-[500] text-slate-500 m-0">All vehicle licenses are active and up to date!</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
