import React, { useState, useEffect, useMemo } from 'react';
import { formatLocalDate, getVehicleExpiryStatus } from '../../utils/dateUtils';
import { useNavigate } from 'react-router-dom';
import {
  Users, Users2, Truck, Activity, AlertTriangle, ChevronRight, ArrowUpRight,
  Wifi, WifiOff, Navigation, PauseCircle, Shield, Cpu, Smartphone, Plus,
  ShieldCheck, CheckCircle2, Clock, Search, ExternalLink, RefreshCw, Radio
} from 'lucide-react';

import { useVehicles } from '../../hooks/useVehicles';
import { getDashboardStats } from '../../api/adminApi';
import { useAuth } from '../../hooks/useAuth';
import CustomerDashboard from './CustomerDashboard';
import { getVehicleStatus, getNoDataThresholdHours, setNoDataThresholdHours, NO_DATA_OPTIONS } from '../../utils/markerUtils';

/* Modern Stat Card with Top Color Accent */
const StatCard = ({ label, value, color, icon: Icon, subtext, onClick }) => (
  <div
    onClick={onClick}
    className="flex-1 min-w-[130px] p-3.5 bg-white rounded-xl cursor-pointer transition-all duration-200 flex flex-col justify-between"
    style={{
      border: '1px solid #e2e8f0',
      borderTop: `3px solid ${color}`,
      boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 4px 12px -2px rgba(15,23,42,0.03)',
    }}
    onMouseEnter={e => {
      e.currentTarget.style.transform = 'translateY(-2px)';
      e.currentTarget.style.boxShadow = `0 8px 20px -3px ${color}25`;
      e.currentTarget.style.borderColor = `${color}60`;
    }}
    onMouseLeave={e => {
      e.currentTarget.style.transform = 'none';
      e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04), 0 4px 12px -2px rgba(15,23,42,0.03)';
      e.currentTarget.style.borderColor = '#e2e8f0';
      e.currentTarget.style.borderTop = `3px solid ${color}`;
    }}
  >
    <div className="flex items-center justify-between">
      <span className="text-[12px] font-[700] text-slate-500 uppercase tracking-wider">{label}</span>
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: `${color}15` }}
      >
        <Icon className="w-4 h-4" color={color} />
      </div>
    </div>
    <div className="mt-2 mb-1">
      <div className="text-[26px] font-[800] text-slate-900 leading-tight">
        {value}
      </div>
    </div>
    {subtext && (
      <div className="text-[11px] font-[600] text-slate-400 flex items-center justify-between border-t border-slate-100 pt-2 mt-1">
        <span>{subtext}</span>
        <ChevronRight size={13} className="text-slate-300" />
      </div>
    )}
  </div>
);

/* Modern Vehicle Overview Card */
const VehicleOverviewCard = ({ total, online, offline, color = '#EC4899', onClick }) => (
  <div
    onClick={onClick}
    className="flex-1 min-w-[150px] p-3.5 bg-white rounded-xl cursor-pointer transition-all duration-200 flex flex-col justify-between"
    style={{
      border: '1px solid #e2e8f0',
      borderTop: `3px solid ${color}`,
      boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 4px 12px -2px rgba(15,23,42,0.03)',
    }}
    onMouseEnter={e => {
      e.currentTarget.style.transform = 'translateY(-2px)';
      e.currentTarget.style.boxShadow = `0 8px 20px -3px ${color}25`;
      e.currentTarget.style.borderColor = `${color}60`;
    }}
    onMouseLeave={e => {
      e.currentTarget.style.transform = 'none';
      e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04), 0 4px 12px -2px rgba(15,23,42,0.03)';
      e.currentTarget.style.borderColor = '#e2e8f0';
      e.currentTarget.style.borderTop = `3px solid ${color}`;
    }}
  >
    <div className="flex items-center justify-between">
      <span className="text-[12px] font-[700] text-slate-500 uppercase tracking-wider">Vehicles</span>
      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${color}15` }}>
        <Truck className="w-4 h-4" color={color} />
      </div>
    </div>
    <div className="mt-2 mb-1">
      <div className="text-[26px] font-[800] text-slate-900 leading-tight">
        {total}
      </div>
    </div>
    <div className="flex w-full items-center justify-between border-t border-slate-100 pt-2 mt-1">
      <span className="text-[11px] font-[700] text-emerald-600 flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
        {online} Online
      </span>
      <span className="text-[11px] font-[700] text-rose-500 flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-rose-500"></span>
        {offline} No Data
      </span>
    </div>
  </div>
);

/* Modern Tier License Card */
const LicenseCard = ({ title, total, used, available, color, labelUsed = 'Online', labelAvailable = 'No Data' }) => (
  <div
    className="flex-1 min-w-[130px] p-3.5 bg-white rounded-xl transition-all duration-200 flex flex-col justify-between"
    style={{
      border: '1px solid #e2e8f0',
      borderTop: `3px solid ${color}`,
      boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 4px 12px -2px rgba(15,23,42,0.03)',
    }}
    onMouseEnter={e => {
      e.currentTarget.style.transform = 'translateY(-2px)';
      e.currentTarget.style.boxShadow = `0 8px 20px -3px ${color}20`;
      e.currentTarget.style.borderColor = `${color}60`;
    }}
    onMouseLeave={e => {
      e.currentTarget.style.transform = 'none';
      e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04), 0 4px 12px -2px rgba(15,23,42,0.03)';
      e.currentTarget.style.borderColor = '#e2e8f0';
      e.currentTarget.style.borderTop = `3px solid ${color}`;
    }}
  >
    <div className="flex items-center justify-between">
      <span className="text-[12px] font-[700] text-slate-500 uppercase tracking-wider">{title}</span>
      <span className="text-[10px] font-[800] px-2 py-0.5 rounded-full" style={{ background: `${color}15`, color: color }}>
        TIER
      </span>
    </div>
    <div className="mt-2 mb-1">
      <div className="text-[26px] font-[800] text-slate-900 leading-tight">
        {total}
      </div>
    </div>
    <div className="flex w-full items-center justify-between border-t border-slate-100 pt-2 mt-1">
      <span className="text-[11px] font-[600] text-slate-500">
        <strong className="text-emerald-600 font-[700]">{used}</strong> {labelUsed}
      </span>
      <span className="text-[11px] font-[600] text-slate-500">
        <strong className={available > 0 ? "text-rose-500 font-[700]" : "text-slate-400 font-[700]"}>{available}</strong> {labelAvailable}
      </span>
    </div>
  </div>
);

/* Modern Device Telemetry Card with High-Impact Badges */
const DeviceStatusCard = ({ title, total, online, moving, idle, parked, offline, color = '#0EA5E9', icon: Icon, onClick }) => (
  <div
    onClick={onClick}
    className="flex-1 min-w-[280px] p-4 bg-white rounded-xl cursor-pointer transition-all duration-200 flex flex-col justify-between"
    style={{
      border: '1px solid #e2e8f0',
      boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 4px 12px -2px rgba(15,23,42,0.03)',
    }}
    onMouseEnter={e => {
      e.currentTarget.style.transform = 'translateY(-2px)';
      e.currentTarget.style.boxShadow = `0 10px 24px -4px ${color}25`;
      e.currentTarget.style.borderColor = `${color}70`;
    }}
    onMouseLeave={e => {
      e.currentTarget.style.transform = 'none';
      e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04), 0 4px 12px -2px rgba(15,23,42,0.03)';
      e.currentTarget.style.borderColor = '#e2e8f0';
    }}
  >
    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${color}15` }}>
          {Icon && <Icon className="w-4 h-4" color={color} />}
        </div>
        <div>
          <span className="text-[13.5px] font-[800] text-slate-900 block">{title}</span>
          <span className="text-[11px] font-[600] text-slate-400">Telemetry Status Breakdown</span>
        </div>
      </div>
      <div className="text-right">
        <span className="text-[20px] font-[900] text-slate-900">{total}</span>
        <span className="text-[11px] font-[600] text-slate-400 block -mt-1">Active Devices</span>
      </div>
    </div>

    {/* Telemetry Status Pills */}
    <div className="grid grid-cols-5 gap-2 pt-3">
      {/* Online */}
      <div className="flex flex-col items-center p-2 rounded-lg bg-emerald-50/60 border border-emerald-100/60">
        <span className="text-[10px] font-[700] text-emerald-700 flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
          Online
        </span>
        <span className="text-[15px] font-[800] text-emerald-700 mt-0.5">{online}</span>
      </div>

      {/* Moving */}
      <div className="flex flex-col items-center p-2 rounded-lg bg-teal-50/60 border border-teal-100/60">
        <span className="text-[10px] font-[700] text-teal-700 flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-teal-500"></span>
          Moving
        </span>
        <span className="text-[15px] font-[800] text-teal-700 mt-0.5">{moving}</span>
      </div>

      {/* Idle */}
      <div className="flex flex-col items-center p-2 rounded-lg bg-amber-50/60 border border-amber-100/60">
        <span className="text-[10px] font-[700] text-amber-700 flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
          Idle
        </span>
        <span className="text-[15px] font-[800] text-amber-700 mt-0.5">{idle}</span>
      </div>

      {/* Parked */}
      <div className="flex flex-col items-center p-2 rounded-lg bg-indigo-50/60 border border-indigo-100/60">
        <span className="text-[10px] font-[700] text-indigo-700 flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
          Parked
        </span>
        <span className="text-[15px] font-[800] text-indigo-700 mt-0.5">{parked}</span>
      </div>

      {/* No Data */}
      <div className="flex flex-col items-center p-2 rounded-lg bg-rose-50/60 border border-rose-100/60">
        <span className="text-[10px] font-[700] text-rose-700 flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
          No Data
        </span>
        <span className="text-[15px] font-[800] text-rose-700 mt-0.5">{offline}</span>
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
  const [noDataThreshold, setNoDataThreshold] = useState(getNoDataThresholdHours());

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

  const totalUsers = apiStats?.users ?? (user?.role === 'superadmin' ? '3' : '-');
  const totalGroups = groups.length || (user?.role === 'superadmin' ? '2' : '-');
  const totalVehicles = vehicles.length > 0
    ? vehicles.length
    : (apiStats?.total_vehicles !== undefined ? Number(apiStats.total_vehicles) : 0);

  const offlineCount = Math.max(0, totalVehicles - onlineCount);

  const normalizeDeviceType = (v) => {
    const raw = v.deviceType || v.device_version || v.metadata?.deviceModel || v.metadata?.deviceType || v.model || '';
    const str = String(raw).trim();
    const upper = str.toUpperCase();
    if (!str) return 'VOLTY';
    if (upper.includes('VOLTY')) return 'VOLTY';
    if (upper.includes('AIS140') || upper.includes('AIS-140') || upper.includes('AIS 140')) {
      if (upper.includes('V2')) return 'AIS140 V2';
      return 'AIS140';
    }
    if (upper.includes('CONCOX')) return 'CONCOX';
    if (upper.includes('FMB') || upper.includes('TELTONIKA')) return 'TELTONIKA';
    if (upper.includes('BSTPL') || upper.includes('TRACKNOW')) return 'TRACKNOW';
    return str || 'VOLTY';
  };

  const { allStats, voltyStats, otherDeviceCards } = useMemo(() => {
    const calcStats = (vehList) => {
      let online = 0;
      let moving = 0;
      let idle = 0;
      let parked = 0;
      let offline = 0;

      vehList.forEach(v => {
        const status = getVehicleStatus(v, noDataThreshold);
        if (status === 'running') {
          moving++;
          online++;
        } else if (status === 'idle') {
          idle++;
          online++;
        } else if (status === 'parked') {
          parked++;
          online++;
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
  }, [vehicles, apiStats, noDataThreshold]);

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
        labelAvailable: 'No Data'
      };
    }
  };

  const starterStats = getTierStats('Starter');
  const basicStats = getTierStats('Basic');
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
      <div className="px-4 md:px-6 pt-5 pb-3 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-[20px] md:text-[22px] font-[900] text-slate-900 tracking-tight m-0">
              Fleet Overview
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-[700] bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Live Telemetry
            </span>
          </div>
          <p className="text-[12px] md:text-[13px] text-slate-500 mt-0.5 font-[500] m-0">
            Real-time tracking diagnostics, telemetry status, and organizational metrics.
          </p>
        </div>
      </div>

      {/* Row 1: KPI Stats Grid (Uniform Heights & Modern Accents) */}
      <div className="px-4 md:px-6 pb-2.5 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3 shrink-0">
        <StatCard
          label="Users"
          value={totalUsers}
          color="#7C3AED"
          icon={Users}
          subtext="View Accounts"
          onClick={() => navigate('/admin/users')}
        />
        <StatCard
          label="Groups"
          value={totalGroups}
          color="#2563EB"
          icon={Users2}
          subtext="Operational Zones"
          onClick={() => navigate('/admin/groups')}
        />
        <VehicleOverviewCard
          total={totalVehicles}
          online={onlineCount}
          offline={offlineCount}
          color="#DB2777"
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
          color="#0284C7"
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

      {/* Row 2: Device Telemetry Overview Cards */}
      <div className="px-4 md:px-6 pb-4 grid grid-cols-1 md:grid-cols-2 gap-3.5 shrink-0">
        <DeviceStatusCard
          title="All Devices Telemetry"
          total={allStats.total}
          online={allStats.online}
          moving={allStats.moving}
          idle={allStats.idle}
          parked={allStats.parked}
          offline={allStats.offline}
          color="#2563EB"
          icon={Cpu}
          onClick={() => navigate('/admin/vehicles')}
        />
        <DeviceStatusCard
          title="VOLTY Devices Telemetry"
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
      <div className="px-4 md:px-6 pb-6 flex-1 min-h-[360px] flex shrink-0">
        <div className="w-full bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-200/60 flex items-center justify-center text-amber-600">
                <AlertTriangle size={18} />
              </div>
              <div>
                <h3 className="text-[16px] font-[800] text-slate-900 m-0 leading-tight">
                  Expiring Vehicle Licenses
                </h3>
                <p className="text-[12px] text-slate-500 m-0 mt-0.5 font-[500]">
                  Vehicles requiring license renewal
                </p>
              </div>
            </div>
            <button
              onClick={() => navigate('/admin/vehicles')}
              className="text-[12px] font-[700] text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer bg-transparent border-none"
            >
              View All <ChevronRight size={15} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto overflow-x-auto w-full">
            {expiringVehicles.length > 0 ? (
              <table className="w-full min-w-[680px] text-left border-collapse">
                <thead className="sticky top-0 bg-slate-50 border-b border-slate-100 z-1">
                  <tr className="text-[11.5px] font-[700] text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-4">Vehicle Name</th>
                    <th className="py-3 px-4">Registration No</th>
                    <th className="py-3 px-4">Customer Name</th>
                    <th className="py-3 px-4">Mobile Number</th>
                    <th className="py-3 px-4">Expiry Date</th>
                    <th className="py-3 px-4">Renewal Price</th>
                    <th className="py-3 px-4">Status</th>
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
                        <td className="py-3 px-4 text-[13px] font-[700] text-slate-900">{v.name}</td>
                        <td className="py-3 px-4 text-[13px] text-slate-700 font-mono">{v.plate || '-'}</td>
                        <td className="py-3 px-4 text-[13px] text-slate-800 font-[500]">{customerName}</td>
                        <td className="py-3 px-4 text-[13px] text-slate-600 font-mono">{mobileNumber}</td>
                        <td className="py-3 px-4 text-[13px] text-slate-600">{formatLocalDate(v.licence_expire_date)}</td>
                        <td className="py-3 px-4 text-[13px] font-[700]">
                          {(() => {
                            const ren = v.metadata?.renewal_price;
                            const disc = v.metadata?.discount_price;
                            if (disc && ren && parseFloat(disc) < parseFloat(ren)) {
                              return (
                                <div className="flex flex-col">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[11px] line-through text-slate-400">₹{parseFloat(ren).toFixed(2)}</span>
                                    <span className="text-[13px] font-extrabold text-emerald-600">₹{parseFloat(disc).toFixed(2)}</span>
                                  </div>
                                  <span className="text-[10px] text-emerald-600 font-bold">Save ₹{(parseFloat(ren) - parseFloat(disc)).toFixed(2)}</span>
                                </div>
                              );
                            } else if (ren) {
                              return <span className="text-slate-800">₹{parseFloat(ren).toFixed(2)}</span>;
                            }
                            return <span className="text-slate-400 font-normal">—</span>;
                          })()}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-[700] ${isExpired ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
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
