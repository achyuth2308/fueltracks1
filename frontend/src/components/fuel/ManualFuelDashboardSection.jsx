import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
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
import ManualFuelChartCard from './ManualFuelChartCard';

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
  const [graphModalVehicle, setGraphModalVehicle] = useState(null);

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
    const interval = setInterval(fetchOverview, 5000); // Live poll every 5s for real-time distance & fuel consumption
    return () => clearInterval(interval);
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
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4 my-6">
      {/* Top Banner / Disclaimer */}
      <div className="bg-amber-50/80 border border-amber-200/80 rounded-xl p-3.5 flex items-start gap-3">
        <div className="p-1.5 bg-amber-500/10 text-amber-700 rounded-lg shrink-0 mt-0.5">
          <Fuel size={18} />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h4 className="text-xs font-black uppercase tracking-wider text-amber-900">
              Manual Fuel Monitoring & Mileage Prediction
            </h4>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-200/60 text-amber-900">
              ESTIMATED VALUES
            </span>
          </div>
          <p className="text-xs text-amber-800/90 mt-0.5 font-medium leading-relaxed">
            Note: Fuel values are estimated based on driver manual entries and GPS distance calculation. Physical fuel sensors are not installed.
          </p>
        </div>
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
          className="p-1.5 text-amber-700 hover:text-amber-900 rounded-lg hover:bg-amber-100/60 transition-colors shrink-0"
          title="Refresh fuel stats"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Aggregate KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl">
          <span className="text-[10px] font-extrabold uppercase text-slate-500 tracking-wider">
            Total Estimated Fuel
          </span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl font-black text-slate-900">{stats.totalFuel}</span>
            <span className="text-xs font-bold text-slate-500">Litres</span>
          </div>
        </div>

        <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl">
          <span className="text-[10px] font-extrabold uppercase text-slate-500 tracking-wider">
            GPS Distance Tracked
          </span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl font-black text-slate-900">{stats.totalDist.toLocaleString()}</span>
            <span className="text-xs font-bold text-slate-500">KM</span>
          </div>
        </div>

        <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl">
          <span className="text-[10px] font-extrabold uppercase text-slate-500 tracking-wider">
            Estimated Consumption
          </span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl font-black text-slate-900">{stats.totalConsumed}</span>
            <span className="text-xs font-bold text-slate-500">Litres</span>
          </div>
        </div>

        <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl">
          <span className="text-[10px] font-extrabold uppercase text-slate-500 tracking-wider">
            Fleet Fuel Status
          </span>
          <div className="flex items-center gap-2 mt-1.5 text-xs font-bold">
            <span className="text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-md">
              {stats.countHealthy} Normal
            </span>
            {stats.countLow > 0 && (
              <span className="text-amber-700 bg-amber-100/70 px-2 py-0.5 rounded-md">
                {stats.countLow} Low
              </span>
            )}
            {stats.countCritical > 0 && (
              <span className="text-rose-700 bg-rose-100/70 px-2 py-0.5 rounded-md">
                {stats.countCritical} Critical
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
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
              className={`px-2.5 py-1 text-[11px] font-bold rounded-lg border transition-all whitespace-nowrap ${
                statusFilter === st
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Vehicle-Wise Fuel Table */}
      <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto max-h-[460px]">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50/90 sticky top-0 z-10 border-b border-slate-200 text-slate-700 font-extrabold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-3">Vehicle</th>
                <th className="py-3 px-3">Fuel Status</th>
                <th className="py-3 px-3 text-right">Estimated Fuel</th>
                <th className="py-3 px-3 text-right">Estimated Consumption</th>
                <th className="py-3 px-3 text-right">Average Mileage</th>
                <th className="py-3 px-3 text-right">Estimated Range</th>
                <th className="py-3 px-3 text-right">Distance Since Entry</th>
                <th className="py-3 px-3">Last Refill / Entry</th>
                <th className="py-3 px-3 text-center">Actions</th>
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
                            onClick={() => setGraphModalVehicle(veh)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-orange-600 hover:bg-orange-50 transition-colors"
                            title="View Non-Sensor Fuel Graph"
                          >
                            <TrendingUp size={15} />
                          </button>
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

      {/* Fuel Graph Modal Popup */}
      {graphModalVehicle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between p-4 px-6 border-b border-slate-100 bg-slate-50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-orange-100 text-orange-600 rounded-xl">
                  <TrendingUp size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">
                    {graphModalVehicle.vehicle_name || graphModalVehicle.plate} - Fuel Trend Graph
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Non-Sensor GPS telemetry depletion curve & verified driver refill events
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  to={`/fuel-graph?vehicle=${graphModalVehicle.vehicle_id || graphModalVehicle.id}`}
                  className="text-xs font-bold text-orange-600 hover:text-orange-700 bg-orange-50 px-3 py-1.5 rounded-xl border border-orange-200 transition-colors"
                >
                  Full Page ↗
                </Link>
                <button
                  onClick={() => setGraphModalVehicle(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
            <div className="p-5 max-h-[80vh] overflow-y-auto">
              <ManualFuelChartCard
                vehicleId={graphModalVehicle.vehicle_id || graphModalVehicle.id}
                vehicleName={graphModalVehicle.vehicle_name || graphModalVehicle.plate}
                plate={graphModalVehicle.plate || ''}
              />
            </div>
          </div>
        </div>
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
