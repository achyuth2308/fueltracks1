import React, { useState, useEffect, useMemo } from 'react';
import {
  Fuel,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Settings,
  History,
  Search,
  RefreshCw,
  Gauge,
  Navigation,
  Droplets,
  Calendar
} from 'lucide-react';
import { getFleetFuelOverview } from '../../api/manualFuelApi';
import ManualFuelConfigModal from './ManualFuelConfigModal';
import ManualFuelHistoryModal from './ManualFuelHistoryModal';
import ManualFuelEntryModal from './ManualFuelEntryModal';

const getStatusBadge = (status) => {
  switch (status) {
    case 'Healthy':
      return {
        bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        dot: 'bg-emerald-500',
        icon: CheckCircle2,
        label: 'Healthy'
      };
    case 'Normal':
      return {
        bg: 'bg-blue-50 text-blue-700 border-blue-200',
        dot: 'bg-blue-500',
        icon: CheckCircle2,
        label: 'Normal'
      };
    case 'Low Fuel':
      return {
        bg: 'bg-amber-50 text-amber-700 border-amber-200',
        dot: 'bg-amber-500',
        icon: AlertTriangle,
        label: 'Low Fuel'
      };
    case 'Critical Fuel':
      return {
        bg: 'bg-rose-50 text-rose-700 border-rose-200',
        dot: 'bg-rose-500',
        icon: AlertCircle,
        label: 'Critical Fuel'
      };
    default:
      return {
        bg: 'bg-slate-50 text-slate-600 border-slate-200',
        dot: 'bg-slate-400',
        icon: HelpCircle,
        label: 'No Fuel Data'
      };
  }
};

/* Modern Fuel Stat Card - Style A (Top Accent Line matching Fleet Overview) */
const FuelStatCard = ({ label, value, unit, color, icon: Icon, subtext }) => (
  <div
    className="bg-white rounded-xl p-3 transition-all duration-200 flex flex-col justify-between hover:-translate-y-0.5"
    style={{
      border: '1px solid #E2E8F0',
      borderTop: `3.5px solid ${color}`,
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
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

    <div className="my-1.5 flex items-baseline gap-1.5">
      <div style={{ fontSize: '24px', fontWeight: 900, color: '#000000', lineHeight: 1 }}>
        {value}
      </div>
      {unit && (
        <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#64748B' }}>
          {unit}
        </span>
      )}
    </div>

    {subtext && (
      <div className="flex items-center justify-between pt-1 border-t border-slate-100">
        <span style={{ fontSize: '10.5px', fontWeight: 700, color: '#475569' }}>
          {subtext}
        </span>
      </div>
    )}
  </div>
);

const ManualFuelDashboardSection = () => {
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modals state
  const [configModalVehicle, setConfigModalVehicle] = useState(null);
  const [historyModalVehicle, setHistoryModalVehicle] = useState(null);
  const [entryModalVehicle, setEntryModalVehicle] = useState(null);
  const [isEntryOpen, setIsEntryOpen] = useState(false);

  const fetchOverview = () => {
    setLoading(true);
    getFleetFuelOverview()
      .then(res => {
        if (res?.success) {
          setVehicles(res.data || []);
        }
      })
      .catch(err => {
        console.error('Failed to load fleet fuel overview:', err);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchOverview();
  }, []);

  const filteredVehicles = useMemo(() => {
    return vehicles.filter(v => {
      const matchSearch =
        (v.plate || '').toLowerCase().includes(search.toLowerCase()) ||
        (v.vehicle_name || '').toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === 'ALL' || v.fuel_status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [vehicles, search, statusFilter]);

  // Aggregate stats
  const stats = useMemo(() => {
    let totalFuel = 0;
    let totalDist = 0;
    let totalConsumed = 0;
    let countHealthy = 0;
    let countLow = 0;
    let countCritical = 0;

    vehicles.forEach(v => {
      if (v.current_fuel != null) totalFuel += Number(v.current_fuel);
      if (v.total_distance_travelled != null) totalDist += Number(v.total_distance_travelled);
      if (v.total_fuel_consumed != null) totalConsumed += Number(v.total_fuel_consumed);
      if (v.fuel_status === 'Healthy' || v.fuel_status === 'Normal') countHealthy++;
      if (v.fuel_status === 'Low Fuel') countLow++;
      if (v.fuel_status === 'Critical Fuel') countCritical++;
    });

    return {
      totalFuel: totalFuel.toFixed(1),
      totalDist: Math.round(totalDist),
      totalConsumed: totalConsumed.toFixed(1),
      countHealthy,
      countLow,
      countCritical,
    };
  }, [vehicles]);

  return (
    <div className="w-full bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
      {/* Card Header matching Fleet Overview & Expiring Vehicles */}
      <div className="py-2.5 px-3.5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2 bg-slate-50/50">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-amber-50 border border-amber-200/60 flex items-center justify-center text-amber-600">
            <Fuel size={15} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-[14px] font-[800] text-slate-900 m-0 leading-tight">
                Manual Fuel Monitoring & Mileage Prediction
              </h3>
              <span className="px-1.5 py-0.5 rounded text-[9.5px] font-[700] bg-amber-100/80 text-amber-800 border border-amber-200/70">
                ESTIMATED VALUES
              </span>
            </div>
            <p className="text-[11px] text-slate-500 m-0 mt-0.5 font-[500]">
              Note: Fuel values are estimated based on driver manual entries and GPS distance calculation (physical fuel sensors not installed)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => {
              setEntryModalVehicle(null);
              setIsEntryOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 shadow-sm transition-all shrink-0 cursor-pointer"
          >
            <Fuel size={13} />
            <span>+ Add Fuel Entry</span>
          </button>
          <button
            onClick={fetchOverview}
            disabled={loading}
            className="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition-colors shrink-0 cursor-pointer"
            title="Refresh fuel stats"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <div className="p-3.5 space-y-3.5">
        {/* Aggregate KPI Cards - matching Style A Top Accent StatCard */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          <FuelStatCard
            label="Total Estimated Fuel"
            value={stats.totalFuel}
            unit="Litres"
            color="#EA580C"
            icon={Fuel}
            subtext="Remaining in fleet tanks"
          />
          <FuelStatCard
            label="GPS Distance Tracked"
            value={stats.totalDist.toLocaleString()}
            unit="KM"
            color="#2563EB"
            icon={Navigation}
            subtext="Total fleet distance tracked"
          />
          <FuelStatCard
            label="Estimated Consumption"
            value={stats.totalConsumed}
            unit="Litres"
            color="#7C3AED"
            icon={Droplets}
            subtext="Estimated fuel consumed"
          />
          <FuelStatCard
            label="Fleet Fuel Status"
            value={`${stats.countHealthy} Normal`}
            unit=""
            color={stats.countCritical > 0 ? '#E11D48' : stats.countLow > 0 ? '#D97706' : '#059669'}
            icon={Gauge}
            subtext={
              stats.countLow > 0 || stats.countCritical > 0
                ? `${stats.countLow} Low Fuel • ${stats.countCritical} Critical`
                : 'All monitored vehicles healthy'
            }
          />
        </div>

        {/* Filter & Search Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
          <div className="relative w-full sm:w-64">
            <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search vehicle..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>

          {/* Status Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
            {['ALL', 'Healthy', 'Normal', 'Low Fuel', 'Critical Fuel', 'No Fuel Data'].map(st => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-lg border transition-all whitespace-nowrap cursor-pointer ${
                  statusFilter === st
                    ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        {/* Vehicle-Wise Fuel Table */}
        <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto max-h-[460px]">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 z-10" style={{ background: 'var(--brand-header, #1e1b4b)' }}>
                <tr className="text-[11px] font-[800] uppercase tracking-wider" style={{ color: '#ffffff' }}>
                  <th className="py-2.5 px-3 border-r border-white/10" style={{ color: '#ffffff', letterSpacing: '0.04em' }}>Vehicle</th>
                  <th className="py-2.5 px-3 border-r border-white/10" style={{ color: '#ffffff', letterSpacing: '0.04em' }}>Fuel Status</th>
                  <th className="py-2.5 px-3 border-r border-white/10 text-right" style={{ color: '#ffffff', letterSpacing: '0.04em' }}>Estimated Fuel</th>
                  <th className="py-2.5 px-3 border-r border-white/10 text-right" style={{ color: '#ffffff', letterSpacing: '0.04em' }}>Estimated Consumption</th>
                  <th className="py-2.5 px-3 border-r border-white/10 text-right" style={{ color: '#ffffff', letterSpacing: '0.04em' }}>Average Mileage</th>
                  <th className="py-2.5 px-3 border-r border-white/10 text-right" style={{ color: '#ffffff', letterSpacing: '0.04em' }}>Estimated Range</th>
                  <th className="py-2.5 px-3 border-r border-white/10 text-right" style={{ color: '#ffffff', letterSpacing: '0.04em' }}>Distance Since Entry</th>
                  <th className="py-2.5 px-3 border-r border-white/10" style={{ color: '#ffffff', letterSpacing: '0.04em' }}>Last Refill / Entry</th>
                  <th className="py-2.5 px-3 text-center" style={{ color: '#ffffff', letterSpacing: '0.04em' }}>Actions</th>
                </tr>
              </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {filteredVehicles.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400">
                    {loading ? 'Loading fuel data...' : 'No vehicles found matching filter.'}
                  </td>
                </tr>
              ) : (
                filteredVehicles.map(veh => {
                  const badge = getStatusBadge(veh.fuel_status);
                  const Icon = badge.icon;
                  const hasFuelData = veh.current_fuel != null;

                  return (
                    <tr key={veh.vehicle_id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Vehicle Name & Plate */}
                      <td className="py-2.5 px-3">
                        <div className="font-bold text-slate-900">{veh.vehicle_name}</div>
                        <div className="text-[11px] font-mono text-slate-500 uppercase">{veh.plate}</div>
                      </td>

                      {/* Fuel Status Badge */}
                      <td className="py-2.5 px-3">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${badge.bg}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                          <span>{badge.label}</span>
                        </span>
                      </td>

                      {/* Estimated Remaining Fuel */}
                      <td className="py-2.5 px-3 text-right">
                        {hasFuelData ? (
                          <div>
                            <span className="font-extrabold text-slate-900 text-sm">
                              {Number(veh.current_fuel).toFixed(1)} L
                            </span>
                            {veh.tank_capacity && (
                              <div className="text-[10px] text-slate-400">
                                / {veh.tank_capacity} L ({Math.round((veh.current_fuel / veh.tank_capacity) * 100)}%)
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Unconfigured</span>
                        )}
                      </td>

                      {/* Estimated Consumption */}
                      <td className="py-2.5 px-3 text-right">
                        {hasFuelData && veh.total_fuel_consumed != null ? (
                          <span className="font-bold text-slate-700">
                            {Number(veh.total_fuel_consumed).toFixed(1)} L
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>

                      {/* Average Mileage */}
                      <td className="py-2.5 px-3 text-right">
                        {hasFuelData && veh.current_mileage != null ? (
                          <span className="inline-flex items-center gap-1 font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                            {Number(veh.current_mileage).toFixed(1)} km/l
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>

                      {/* Estimated Remaining Range */}
                      <td className="py-2.5 px-3 text-right">
                        {hasFuelData && veh.estimated_range_km != null ? (
                          <span className="font-extrabold text-slate-900">
                            {Number(veh.estimated_range_km).toLocaleString()} km
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>

                      {/* Distance Travelled */}
                      <td className="py-2.5 px-3 text-right font-mono">
                        {veh.total_distance_travelled != null ? (
                          <span>{Number(veh.total_distance_travelled).toFixed(1)} km</span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>

                      {/* Last Refill / Entry Date */}
                      <td className="py-2.5 px-3 text-slate-600 text-[11px]">
                        {veh.last_refill_date ? (
                          <div>
                            <span className="font-semibold text-slate-800">
                              Refill: {new Date(veh.last_refill_date).toLocaleDateString('en-IN')}
                            </span>
                          </div>
                        ) : veh.last_entry_date ? (
                          <div>
                            <span>Entry: {new Date(veh.last_entry_date).toLocaleDateString('en-IN')}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400">No entry yet</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-2.5 px-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => {
                              setEntryModalVehicle(veh);
                              setIsEntryOpen(true);
                            }}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                            title="Log Fuel Entry for this Vehicle"
                          >
                            <Fuel size={15} />
                          </button>
                          <button
                            onClick={() => setConfigModalVehicle(veh)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-orange-600 hover:bg-orange-50 transition-colors"
                            title="Configure Vehicle Fuel"
                          >
                            <Settings size={15} />
                          </button>
                          <button
                            onClick={() => setHistoryModalVehicle(veh)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                            title="View Fuel History & Audit"
                          >
                            <History size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>

      {/* Modals */}
      {configModalVehicle && (
        <ManualFuelConfigModal
          vehicle={configModalVehicle}
          onClose={() => setConfigModalVehicle(null)}
          onSaved={() => {
            fetchOverview();
          }}
        />
      )}

      {historyModalVehicle && (
        <ManualFuelHistoryModal
          vehicle={historyModalVehicle}
          onClose={() => setHistoryModalVehicle(null)}
        />
      )}

      {isEntryOpen && (
        <ManualFuelEntryModal
          isOpen={isEntryOpen}
          vehicle={entryModalVehicle}
          vehicles={vehicles}
          onClose={() => {
            setIsEntryOpen(false);
            setEntryModalVehicle(null);
          }}
          onEntryAdded={() => {
            fetchOverview();
          }}
        />
      )}
    </div>
  );
};

export default ManualFuelDashboardSection;
