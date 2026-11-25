import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import {
  Gauge,
  Fuel,
  TrendingUp,
  Droplets,
  Calendar,
  Clock,
  ArrowRight,
  RefreshCw,
  Plus,
  ChevronRight,
  Info,
  Truck,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { useVehicles } from '../../hooks/useVehicles';
import { getVehicleFuelState, getVehicleFuelConfig } from '../../api/manualFuelApi';
import ManualFuelChartCard from '../../components/fuel/ManualFuelChartCard';

const NonSensorFuelGraphPage = () => {
  const { vehicles, loading: loadingVehicles } = useVehicles();
  const location = useLocation();
  const navigate = useNavigate();

  // Parse vehicleId from URL query (?vehicle=...)
  const queryParams = new URLSearchParams(location.search);
  const initialVehicleId = queryParams.get('vehicle');

  const [selectedVehicleId, setSelectedVehicleId] = useState(initialVehicleId || '');
  const [fuelState, setFuelState] = useState(null);
  const [fuelConfig, setFuelConfig] = useState(null);
  const [loadingMetrics, setLoadingMetrics] = useState(false);

  // Sync initial vehicle when vehicles finish loading
  useEffect(() => {
    if (!selectedVehicleId && vehicles && vehicles.length > 0) {
      const target = initialVehicleId && vehicles.find(v => (v.id || v.vehicle_id) === initialVehicleId)
        ? initialVehicleId
        : (vehicles[0].id || vehicles[0].vehicle_id);
      setSelectedVehicleId(target);
    }
  }, [vehicles, selectedVehicleId, initialVehicleId]);

  // Update URL when vehicle changes
  const handleSelectVehicle = (vId) => {
    setSelectedVehicleId(vId);
    navigate(`/fuel-graph?vehicle=${vId}`, { replace: true });
  };

  // Fetch quick metrics for the selected vehicle
  const fetchVehicleMetrics = () => {
    if (!selectedVehicleId) return;
    setLoadingMetrics(true);

    Promise.allSettled([
      getVehicleFuelState(selectedVehicleId),
      getVehicleFuelConfig(selectedVehicleId)
    ]).then(([stateRes, configRes]) => {
      if (stateRes.status === 'fulfilled' && stateRes.value?.success) {
        setFuelState(stateRes.value.data);
      } else {
        setFuelState(null);
      }
      if (configRes.status === 'fulfilled' && configRes.value?.success) {
        setFuelConfig(configRes.value.data);
      } else {
        setFuelConfig(null);
      }
    }).finally(() => {
      setLoadingMetrics(false);
    });
  };

  useEffect(() => {
    fetchVehicleMetrics();
  }, [selectedVehicleId]);

  const activeVehicle = useMemo(() => {
    return vehicles?.find(v => (v.id || v.vehicle_id) === selectedVehicleId) || null;
  }, [vehicles, selectedVehicleId]);

  const tankCapacity = fuelConfig?.tank_capacity ? Number(fuelConfig.tank_capacity) : 50;
  const currentFuel = fuelState?.current_fuel != null ? Number(fuelState.current_fuel) : (activeVehicle?.current_fuel ? Number(activeVehicle.current_fuel) : 0);
  const mileage = fuelConfig?.initial_mileage ? Number(fuelConfig.initial_mileage) : (fuelState?.current_mileage ? Number(fuelState.current_mileage) : 16.0);
  const rangeKm = fuelState?.estimated_range_km ? Number(fuelState.estimated_range_km) : Math.round(currentFuel * mileage);
  const totalDist = fuelState?.total_distance_travelled ? Number(fuelState.total_distance_travelled) : 0;
  const fuelPercent = tankCapacity > 0 ? Math.min(100, Math.round((currentFuel / tankCapacity) * 100)) : 0;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Breadcrumbs */}
      <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
        <Link to="/dashboard" className="hover:text-slate-800 transition-colors">Dashboard</Link>
        <ChevronRight size={13} className="text-slate-400" />
        <Link to="/fuel-overview" className="hover:text-slate-800 transition-colors text-orange-600 font-semibold">Non-Sensor Fuel</Link>
        <ChevronRight size={13} className="text-slate-400" />
        <span className="text-slate-800 font-bold">Fuel Trend Graph</span>
      </div>

      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center text-white shadow-lg shadow-orange-500/20">
            <TrendingUp size={24} strokeWidth={2.4} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Non-Sensor Fuel Trend Graph</h1>
              <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-orange-100 text-orange-800 tracking-wider">
                Telemetry Analytics
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5 font-medium">
              Real-time fuel depletion curve calculated from GPS distance and verified driver refill history.
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Vehicle Dropdown */}
          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-300 shadow-2xs">
            <Truck size={15} className="text-slate-500" />
            <select
              value={selectedVehicleId}
              onChange={(e) => handleSelectVehicle(e.target.value)}
              className="text-xs font-bold text-slate-900 bg-transparent focus:outline-none cursor-pointer"
            >
              {vehicles.map(v => (
                <option key={v.id || v.vehicle_id} value={v.id || v.vehicle_id}>
                  {v.plate || v.name} {v.name && v.plate && v.name !== v.plate ? `(${v.name})` : ''}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={fetchVehicleMetrics}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 border border-slate-200 bg-white transition-colors cursor-pointer"
            title="Refresh Graph"
          >
            <RefreshCw size={15} className={loadingMetrics ? 'animate-spin' : ''} />
          </button>

          <Link
            to={`/fuel-entry${selectedVehicleId ? `?vehicle=${selectedVehicleId}` : ''}`}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-extrabold text-white bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 shadow-sm shadow-orange-500/20 transition-all cursor-pointer"
          >
            <Plus size={14} strokeWidth={2.5} />
            <span>Log Fuel Entry</span>
          </Link>
        </div>
      </div>

      {/* Informational Banner */}
      <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-3.5 flex items-center gap-3 text-amber-900 text-xs">
        <Info size={18} className="text-amber-600 shrink-0" />
        <div className="leading-relaxed">
          <strong className="font-extrabold">GPS-BASED MILEAGE DEPLETION:</strong> This graph displays the mathematical fuel depletion curve: <code className="font-mono bg-amber-100/70 px-1.5 py-0.5 rounded text-[11px]">Fuel Consumed = GPS Distance / {mileage.toFixed(1)} km/l</code>. Refill markers (<span className="text-emerald-700 font-bold">+L</span>) and theft/drain events (<span className="text-rose-700 font-bold">-L</span>) are correlated directly on the timeline.
        </div>
      </div>

      {/* Real-time Summary Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Current Fuel */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs font-bold uppercase tracking-wider">
            <span>Estimated Fuel</span>
            <Droplets size={16} className="text-orange-500" />
          </div>
          <div className="flex items-baseline gap-1.5 pt-1">
            <span className="text-2xl font-black text-slate-900 font-mono">
              {currentFuel.toFixed(1)}
            </span>
            <span className="text-xs font-bold text-slate-500">/ {tankCapacity} L</span>
            <span className={`ml-auto text-[11px] font-extrabold px-2 py-0.5 rounded-full ${
              fuelPercent > 40 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
            }`}>
              {fuelPercent}%
            </span>
          </div>
        </div>

        {/* Average Mileage */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs font-bold uppercase tracking-wider">
            <span>Average Mileage</span>
            <Gauge size={16} className="text-emerald-500" />
          </div>
          <div className="flex items-baseline gap-1.5 pt-1">
            <span className="text-2xl font-black text-emerald-700 font-mono">
              {mileage.toFixed(1)}
            </span>
            <span className="text-xs font-bold text-slate-500">km/l</span>
            <span className="ml-auto text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
              Fixed
            </span>
          </div>
        </div>

        {/* Estimated Range */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs font-bold uppercase tracking-wider">
            <span>Estimated Range</span>
            <TrendingUp size={16} className="text-blue-500" />
          </div>
          <div className="flex items-baseline gap-1.5 pt-1">
            <span className="text-2xl font-black text-slate-900 font-mono">
              {rangeKm.toLocaleString()}
            </span>
            <span className="text-xs font-bold text-slate-500">KM</span>
          </div>
        </div>

        {/* Distance Travelled */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs font-bold uppercase tracking-wider">
            <span>Distance Since Entry</span>
            <Clock size={16} className="text-sky-500" />
          </div>
          <div className="flex items-baseline gap-1.5 pt-1">
            <span className="text-2xl font-black text-slate-900 font-mono">
              {totalDist.toFixed(1)}
            </span>
            <span className="text-xs font-bold text-slate-500">KM</span>
          </div>
        </div>
      </div>

      {/* Main Interactive Chart Card */}
      {selectedVehicleId ? (
        <ManualFuelChartCard
          vehicleId={selectedVehicleId}
          vehicleName={activeVehicle?.name || activeVehicle?.plate || 'Vehicle'}
          plate={activeVehicle?.plate || ''}
          vehicles={vehicles}
          onSelectVehicle={handleSelectVehicle}
        />
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">
          <Fuel size={36} className="mx-auto mb-2 text-slate-300" />
          <p className="text-sm font-semibold">Please select a vehicle to view its fuel trend graph.</p>
        </div>
      )}
    </div>
  );
};

export default NonSensorFuelGraphPage;
