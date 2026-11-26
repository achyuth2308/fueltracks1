import ManualFuelChartCard from '../../components/fuel/ManualFuelChartCard';
import React, { useState, useEffect, useMemo } from 'react';
import {
  Fuel,
  Droplets,
  Gauge,
  Calendar,
  Clock,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Info,
  History,
  Search,
  Filter,
  Plus,
  ArrowRight,
  ShieldAlert,
  ChevronRight,
  RefreshCw,
  Settings,
  Edit3
} from 'lucide-react';
import { useVehicles } from '../../hooks/useVehicles';
import {
  getVehicleFuelState,
  getVehicleFuelConfig,
  submitFuelEntry,
  getFuelEntries,
  saveVehicleFuelConfig
} from '../../api/manualFuelApi';

const ManualFuelEntryPage = () => {
  const { vehicles, loading: loadingVehicles } = useVehicles();
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [fuelState, setFuelState] = useState(null);
  const [fuelConfig, setFuelConfig] = useState(null);
  const [entries, setEntries] = useState([]);
  const [loadingState, setLoadingState] = useState(false);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [needsConfig, setNeedsConfig] = useState(false);
  const [isEditingSpecs, setIsEditingSpecs] = useState(false);

  // Form State
  const [entryType, setEntryType] = useState('INITIAL'); // 'REFILL' | 'RECONCILIATION' | 'INITIAL'
  const [fuelFilled, setFuelFilled] = useState('');
  const [currentTankFuel, setCurrentTankFuel] = useState('');
  const [odometer, setOdometer] = useState('');
  const [remarks, setRemarks] = useState('');
  const [entryDate, setEntryDate] = useState(new Date().toISOString().slice(0, 16));

  // Vehicle Fuel Specifications (Tank Capacity, Mileage, Fuel Type)
  const [customTankCapacity, setCustomTankCapacity] = useState('385');
  const [customFuelType, setCustomFuelType] = useState('Diesel');
  const [customMileage, setCustomMileage] = useState('4.5');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Default to first vehicle
  useEffect(() => {
    if (!selectedVehicleId && vehicles && vehicles.length > 0) {
      setSelectedVehicleId(vehicles[0].id);
    }
  }, [vehicles, selectedVehicleId]);

  // Load data on vehicle selection
  const loadVehicleData = () => {
    if (!selectedVehicleId) return;

    setLoadingState(true);
    setError(null);
    setFuelFilled('');
    setRemarks('');

    Promise.allSettled([
      getVehicleFuelState(selectedVehicleId),
      getVehicleFuelConfig(selectedVehicleId)
    ]).then(([stateRes, configRes]) => {
      let sData = null;
      if (stateRes.status === 'fulfilled' && stateRes.value?.success) {
        sData = stateRes.value.data;
        setFuelState(sData);
      } else {
        setFuelState(null);
      }

      const activeVeh = vehicles?.find(v => v.id === selectedVehicleId);

      if (configRes.status === 'fulfilled' && configRes.value?.success && configRes.value.data) {
        const cfg = configRes.value.data;
        setFuelConfig(cfg);
        setCustomTankCapacity(String(cfg.tank_capacity || '385'));
        setCustomFuelType(cfg.fuel_type || 'Diesel');
        setCustomMileage(String(cfg.initial_mileage || '4.5'));
        setNeedsConfig(false);
        // If config already exists, default to REFILL mode
        setEntryType('REFILL');
      } else {
        setFuelConfig(null);
        setNeedsConfig(true);
        // Default to INITIAL mode for unconfigured vehicles
        setEntryType('INITIAL');
      }

      // Automatically sync odometer to selected vehicle
      const currentVehOdo = sData?.last_known_odometer || activeVeh?.odometer || activeVeh?.today_distance || 0;
      setOdometer(currentVehOdo > 0 ? String(currentVehOdo) : '');

      // Automatically sync current fuel to selected vehicle
      if (sData?.current_fuel != null) {
        setCurrentTankFuel(String(Math.round(sData.current_fuel * 10) / 10));
      } else {
        setCurrentTankFuel('');
      }
    }).finally(() => {
      setLoadingState(false);
    });

    // Load recent entries
    setLoadingEntries(true);
    getFuelEntries(selectedVehicleId, { limit: 10 })
      .then(res => {
        if (res?.success) {
          setEntries(res.data || []);
        }
      })
      .catch(err => console.error('Failed to load fuel entries:', err))
      .finally(() => setLoadingEntries(false));
  };

  useEffect(() => {
    loadVehicleData();
  }, [selectedVehicleId]);

  const activeVehicle = vehicles?.find(v => v.id === selectedVehicleId) || null;
  const effectiveTankCapacity = fuelConfig ? Number(fuelConfig.tank_capacity) : Number(customTankCapacity || 0);
  const prevFuel = fuelState ? Number(fuelState.current_fuel) : 0;
  const currentMileage = fuelConfig?.initial_mileage ? Number(fuelConfig.initial_mileage) : (fuelState?.current_mileage ? Number(fuelState.current_mileage) : Number(customMileage || 8.0));

  // Baseline odometer for selected vehicle before user's trip input
  const baseOdometer = useMemo(() => {
    return Number(fuelState?.last_known_odometer || fuelConfig?.initial_odometer || activeVehicle?.odometer || 0);
  }, [fuelState, fuelConfig, activeVehicle]);

  // Incremental distance driven based on user's odometer input
  const inputOdometer = parseFloat(odometer);
  const incrementalDistance = useMemo(() => {
    if (!isNaN(inputOdometer) && baseOdometer > 0 && inputOdometer > baseOdometer) {
      const diff = Math.round((inputOdometer - baseOdometer) * 10) / 10;
      // If difference is abnormally large (> 3,000 KM), it indicates a baseline dashboard odometer adjustment, not a single trip
      if (diff > 3000) return 0;
      return diff;
    }
    return 0;
  }, [inputOdometer, baseOdometer]);

  // Fuel consumed for the incremental distance
  const incrementalFuelConsumed = useMemo(() => {
    if (incrementalDistance > 0 && currentMileage > 0) {
      return Math.round((incrementalDistance / currentMileage) * 10) / 10;
    }
    return 0;
  }, [incrementalDistance, currentMileage]);

  // Live preview calculation: accounts for distance driven AND fuel refilled
  const calculatedNewFuel = useMemo(() => {
    const cap = effectiveTankCapacity > 0 ? effectiveTankCapacity : 9999;
    const fuelAfterTrip = Math.max(0, Math.round((prevFuel - incrementalFuelConsumed) * 10) / 10);

    if (entryType === 'INITIAL') {
      const q = parseFloat(currentTankFuel);
      return isNaN(q) ? 0 : Math.min(q, cap);
    }
    if (entryType === 'REFILL') {
      const filled = parseFloat(fuelFilled) || 0;
      if (currentTankFuel && !isNaN(parseFloat(currentTankFuel))) {
        return Math.min(parseFloat(currentTankFuel), cap);
      }
      return Math.min(cap, Math.round((fuelAfterTrip + filled) * 10) / 10);
    }
    if (entryType === 'RECONCILIATION') {
      const actual = parseFloat(currentTankFuel);
      return isNaN(actual) ? fuelAfterTrip : Math.min(actual, cap);
    }
    return fuelAfterTrip;
  }, [entryType, fuelFilled, currentTankFuel, prevFuel, incrementalFuelConsumed, effectiveTankCapacity]);

  const fuelFillPercentage = effectiveTankCapacity > 0 ? Math.min(100, Math.max(0, (calculatedNewFuel / effectiveTankCapacity) * 100)) : 0;
  const estimatedRange = Math.round(calculatedNewFuel * currentMileage);

  // Handle Save Tank Specifications
  const handleSaveSpecsOnly = async (e) => {
    if (e) e.preventDefault();
    const cap = parseFloat(customTankCapacity);
    const mil = parseFloat(customMileage);
    if (isNaN(cap) || cap <= 0) {
      setError('Please provide a valid tank capacity in litres.');
      return;
    }
    if (isNaN(mil) || mil <= 0) {
      setError('Please provide a valid average mileage.');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      await saveVehicleFuelConfig(selectedVehicleId, {
        fuelType: customFuelType,
        tankCapacity: cap,
        initialFuel: fuelState ? Number(fuelState.current_fuel) : 0,
        initialOdometer: fuelState ? Number(fuelState.last_known_odometer) : (parseFloat(odometer) || 0),
        initialMileage: mil,
        reserveFuelLevel: 10,
        lowFuelAlertThreshold: 15,
        criticalFuelAlertThreshold: 8,
      });
      setSuccess('Vehicle tank capacity and fuel specifications updated successfully!');
      setIsEditingSpecs(false);
      loadVehicleData();
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Failed to update vehicle specifications.');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!selectedVehicleId) {
      setError('Please select a vehicle.');
      return;
    }

    const cap = parseFloat(customTankCapacity);
    const mil = parseFloat(customMileage);

    // If vehicle has no config yet OR user is running INITIAL setup, configure vehicle specs first
    if (needsConfig || entryType === 'INITIAL' || isEditingSpecs) {
      if (isNaN(cap) || cap <= 0) {
        setError('Please enter a valid tank capacity in litres (e.g. 50L, 200L, 385L).');
        return;
      }
      if (isNaN(mil) || mil <= 0) {
        setError('Please enter estimated average mileage (KM/L).');
        return;
      }

      const initialFuelQty = parseFloat(currentTankFuel);
      if (entryType === 'INITIAL') {
        if (isNaN(initialFuelQty) || initialFuelQty < 0) {
          setError('Please enter current/initial fuel available in tank (Litres).');
          return;
        }
        if (initialFuelQty > cap) {
          setError(`Initial fuel (${initialFuelQty} L) cannot exceed vehicle tank capacity (${cap} L).`);
          return;
        }
      }

      try {
        setSaving(true);
        await saveVehicleFuelConfig(selectedVehicleId, {
          fuelType: customFuelType,
          tankCapacity: cap,
          initialFuel: entryType === 'INITIAL' ? initialFuelQty : (fuelState ? Number(fuelState.current_fuel) : 0),
          initialOdometer: parseFloat(odometer) || 0,
          initialMileage: mil,
          reserveFuelLevel: 10,
          lowFuelAlertThreshold: 15,
          criticalFuelAlertThreshold: 8,
        });
        setNeedsConfig(false);
        setIsEditingSpecs(false);
      } catch (cfgErr) {
        setSaving(false);
        setError(cfgErr?.response?.data?.error || cfgErr.message || 'Failed to initialize vehicle fuel configuration.');
        return;
      }
    }

    const numOdo = parseFloat(odometer);
    if (isNaN(numOdo) || numOdo < 0) {
      setError('Please provide a valid odometer reading (KM).');
      return;
    }

    let payload = {
      entryType,
      odometer: numOdo,
      remarks: remarks.trim() || null,
      entryDate: entryDate ? new Date(entryDate).toISOString() : new Date().toISOString(),
    };

    if (entryType === 'INITIAL') {
      const initialQty = parseFloat(currentTankFuel);
      payload.fuelQuantity = initialQty;
      payload.fuelFilled = initialQty;
    } else if (entryType === 'REFILL') {
      const filled = parseFloat(fuelFilled);
      if (isNaN(filled) || filled <= 0) {
        setError('Please enter litres of fuel filled.');
        return;
      }
      if (cap > 0 && filled > cap) {
        setError(`Fuel filled (${filled} L) cannot exceed vehicle tank capacity (${cap} L).`);
        return;
      }
      payload.fuelFilled = filled;
      if (currentTankFuel && !isNaN(parseFloat(currentTankFuel))) {
        const afterRefill = parseFloat(currentTankFuel);
        if (cap > 0 && afterRefill > cap) {
          setError(`Fuel level (${afterRefill} L) cannot exceed tank capacity (${cap} L).`);
          return;
        }
        payload.fuelQuantity = afterRefill;
      } else {
        payload.fuelQuantity = calculatedNewFuel;
      }
    } else if (entryType === 'RECONCILIATION') {
      const actualQty = parseFloat(currentTankFuel);
      if (isNaN(actualQty) || actualQty < 0) {
        setError('Please enter verified current fuel quantity in litres.');
        return;
      }
      if (cap > 0 && actualQty > cap) {
        setError(`Fuel quantity (${actualQty} L) cannot exceed tank capacity (${cap} L).`);
        return;
      }
      payload.fuelQuantity = actualQty;
      payload.fuelFilled = 0;
    }

    try {
      setSaving(true);
      const res = await submitFuelEntry(selectedVehicleId, payload);
      if (res?.success) {
        setSuccess(entryType === 'INITIAL'
          ? 'Initial fuel baseline saved successfully! Switched to Fuel Refill mode.'
          : 'Fuel entry recorded successfully! Vehicle telemetry and range updated.');
        setFuelFilled('');
        setRemarks('');
        if (entryType === 'INITIAL') {
          setEntryType('REFILL');
        }
        loadVehicleData();
      } else {
        setError(res?.message || 'Failed to submit fuel entry.');
      }
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Error submitting fuel entry.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center text-white shadow-lg shadow-orange-500/20">
            <Fuel size={24} strokeWidth={2.4} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Manual Fuel Monitoring Entry</h1>
              <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-orange-100 text-orange-800 tracking-wider">
                Fleet Portal
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Enter vehicle tank capacity, fuel refills & tank level reconciliations. System computes consumption via GPS distance.
            </p>
          </div>
        </div>

        {/* Vehicle Selector Dropdown */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-slate-600 uppercase tracking-wider shrink-0">
            Vehicle:
          </label>
          <select
            value={selectedVehicleId}
            onChange={(e) => setSelectedVehicleId(e.target.value)}
            className="px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 shadow-2xs focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
          >
            {vehicles.map(v => (
              <option key={v.id} value={v.id}>
                {v.plate || v.name} {v.name && v.plate && v.name !== v.plate ? `(${v.name})` : ''}
              </option>
            ))}
          </select>
          <button
            onClick={loadVehicleData}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 border border-slate-200 bg-white"
            title="Refresh"
          >
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      {/* ESTIMATED VALUE Banner */}
      <div className="flex items-center gap-3 p-3.5 rounded-xl bg-amber-50/80 border border-amber-200 text-amber-900 text-xs">
        <Info size={18} className="text-amber-600 shrink-0" />
        <div className="leading-relaxed">
          <strong className="font-extrabold">ESTIMATED VALUE SYSTEM:</strong> No physical sensor installation required. Each vehicle maintains its own configured tank capacity and mileage. Fuel consumed is computed automatically: <code className="font-mono bg-amber-100/70 px-1.5 py-0.5 rounded text-[11px]">Fuel Consumed = GPS Distance / Average Mileage</code>.
        </div>
      </div>

      {/* Main Grid: Form on Left, Vehicle Telemetry on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Form (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h2 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <span>Log Fuel Transaction</span>
            </h2>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-orange-600 bg-orange-50 px-2.5 py-0.5 rounded-lg border border-orange-100">
                {activeVehicle?.plate || activeVehicle?.name}
              </span>
              {fuelConfig && (
                <button
                  type="button"
                  onClick={() => setIsEditingSpecs(prev => !prev)}
                  className="flex items-center gap-1 text-[11px] font-bold text-slate-600 hover:text-orange-600 bg-slate-100 hover:bg-orange-50 px-2 py-0.5 rounded-lg border border-slate-200 transition-colors"
                  title="Edit Tank Capacity & Specs"
                >
                  <Edit3 size={11} />
                  <span>{isEditingSpecs ? 'Close Specs' : `Tank: ${fuelConfig.tank_capacity}L`}</span>
                </button>
              )}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Entry Type Selector */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Entry Type
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'REFILL', label: 'Fuel Refill', desc: 'Added fuel to tank', icon: Droplets },
                  { id: 'RECONCILIATION', label: 'Level Check', desc: 'Verified tank level', icon: Gauge },
                  { id: 'INITIAL', label: 'Initial Setup', desc: 'Set capacity & baseline', icon: Fuel },
                ].map(tab => {
                  const Icon = tab.icon;
                  const isSelected = entryType === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setEntryType(tab.id)}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        isSelected
                          ? 'border-orange-500 bg-orange-50/80 shadow-xs ring-1 ring-orange-500'
                          : 'border-slate-200 bg-white hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 mb-1">
                        <Icon size={14} className={isSelected ? 'text-orange-600' : 'text-slate-400'} />
                        <span className={`text-xs font-bold ${isSelected ? 'text-orange-950' : 'text-slate-800'}`}>
                          {tab.label}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500 block leading-tight">
                        {tab.desc}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* VEHICLE TANK SPECIFICATIONS (Displayed when in INITIAL setup, needsConfig, or when user clicks Edit Specs) */}
            {(entryType === 'INITIAL' || needsConfig || isEditingSpecs) && (
              <div className="p-4 rounded-xl bg-gradient-to-r from-orange-50/80 to-amber-50/60 border border-orange-200/80 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase text-orange-950 flex items-center gap-1.5">
                    <Settings size={14} className="text-orange-600" />
                    <span>Vehicle Tank & Mileage Configuration</span>
                  </span>
                  <span className="text-[10px] font-bold text-orange-800 bg-orange-100 px-2 py-0.5 rounded-full">
                    {needsConfig ? 'Setup Required' : 'Custom Specs'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Tank Capacity (L) */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-800 uppercase tracking-wider mb-1">
                      Tank Capacity (L) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={customTankCapacity}
                      onChange={(e) => setCustomTankCapacity(e.target.value)}
                      placeholder="e.g. 50, 200, 385"
                      required
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono font-black text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                    />
                    {/* Common Capacity Presets */}
                    <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                      {['45', '60', '100', '200', '300', '385', '450'].map(preset => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setCustomTankCapacity(preset)}
                          className={`text-[9.5px] font-bold px-1.5 py-0.5 rounded border transition-colors ${
                            customTankCapacity === preset
                              ? 'bg-orange-500 text-white border-orange-600'
                              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {preset}L
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Fuel Type */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-800 uppercase tracking-wider mb-1">
                      Fuel Type
                    </label>
                    <select
                      value={customFuelType}
                      onChange={(e) => setCustomFuelType(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                    >
                      <option value="Diesel">Diesel</option>
                      <option value="Petrol">Petrol</option>
                      <option value="CNG">CNG</option>
                    </select>
                  </div>

                  {/* Initial Mileage (KM/L) */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-800 uppercase tracking-wider mb-1">
                      Avg Mileage (KM/L) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="0.5"
                      step="0.1"
                      value={customMileage}
                      onChange={(e) => setCustomMileage(e.target.value)}
                      placeholder="e.g. 4.5, 8.0"
                      required
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono font-black text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                    />
                    <span className="text-[10px] text-slate-500 mt-1 block">Truck: 3.5-5 | Car: 12-18</span>
                  </div>
                </div>

                {isEditingSpecs && !needsConfig && (
                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      onClick={handleSaveSpecsOnly}
                      disabled={saving}
                      className="text-xs font-bold px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white shadow-xs cursor-pointer transition-colors"
                    >
                      {saving ? 'Updating...' : 'Save Tank Specifications'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Inputs based on entry type */}
            {entryType === 'REFILL' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Fuel Filled (Litres) <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.1"
                      min="0.1"
                      max={effectiveTankCapacity > 0 ? effectiveTankCapacity : undefined}
                      value={fuelFilled}
                      onChange={(e) => setFuelFilled(e.target.value)}
                      placeholder="e.g. 50"
                      required
                      className="w-full px-3.5 py-2.5 pl-10 bg-slate-50 border border-slate-300 rounded-xl font-mono text-sm font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                    />
                    <Droplets size={16} className="absolute left-3.5 top-3 text-slate-400" />
                    <span className="absolute right-3.5 top-2.5 text-xs font-bold text-slate-400">Litres</span>
                  </div>
                  {effectiveTankCapacity > 0 && (
                    <span className="text-[10px] text-slate-500 mt-1 block">
                      Vehicle Tank Capacity: <strong>{effectiveTankCapacity} Litres</strong>
                    </span>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Current Tank Level (Optional)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max={effectiveTankCapacity > 0 ? effectiveTankCapacity : undefined}
                      value={currentTankFuel}
                      onChange={(e) => setCurrentTankFuel(e.target.value)}
                      placeholder={`Calculated: ~${Math.round(calculatedNewFuel)} L`}
                      className="w-full px-3.5 py-2.5 pl-10 bg-slate-50 border border-slate-300 rounded-xl font-mono text-sm font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                    />
                    <Gauge size={16} className="absolute left-3.5 top-3 text-slate-400" />
                    <span className="absolute right-3.5 top-2.5 text-xs font-bold text-slate-400">Litres</span>
                  </div>
                </div>
              </div>
            )}

            {(entryType === 'RECONCILIATION' || entryType === 'INITIAL') && (
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  {entryType === 'INITIAL' ? 'Initial Fuel Currently in Tank (Litres)' : 'Actual Verified Fuel Level (Litres)'}{' '}
                  <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max={effectiveTankCapacity > 0 ? effectiveTankCapacity : undefined}
                    value={currentTankFuel}
                    onChange={(e) => setCurrentTankFuel(e.target.value)}
                    placeholder={`e.g. ${effectiveTankCapacity > 0 ? Math.round(effectiveTankCapacity * 0.5) : 50}`}
                    required
                    className="w-full px-3.5 py-2.5 pl-10 bg-slate-50 border border-slate-300 rounded-xl font-mono text-sm font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                  />
                  <Gauge size={16} className="absolute left-3.5 top-3 text-slate-400" />
                  <span className="absolute right-3.5 top-2.5 text-xs font-bold text-slate-400">Litres</span>
                </div>
                {effectiveTankCapacity > 0 && (
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    Cannot exceed tank capacity: <strong>{effectiveTankCapacity} Litres</strong>
                  </span>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Odometer Reading (KM) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={odometer}
                    onChange={(e) => setOdometer(e.target.value)}
                    placeholder="e.g. 45200"
                    required
                    className="w-full px-3.5 py-2.5 pl-10 bg-slate-50 border border-slate-300 rounded-xl font-mono text-sm font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                  />
                  <TrendingUp size={16} className="absolute left-3.5 top-3 text-slate-400" />
                  <span className="absolute right-3.5 top-2.5 text-xs font-bold text-slate-400">KM</span>
                </div>
                {incrementalDistance > 0 && (
                  <div className="flex items-center gap-1.5 mt-2 p-2 rounded-lg bg-orange-50 border border-orange-200/80 text-[11px] font-bold text-orange-950 flex-wrap">
                    <span className="text-blue-700">+{incrementalDistance.toLocaleString()} KM driven</span>
                    <span>•</span>
                    <span className="text-rose-700">-{incrementalFuelConsumed} L consumed (at {currentMileage} km/l)</span>
                    <span>•</span>
                    <span className="text-emerald-700">Est. Remaining: {Math.round(calculatedNewFuel)} L</span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Entry Date & Time
                </label>
                <div className="relative">
                  <input
                    type="datetime-local"
                    value={entryDate}
                    onChange={(e) => setEntryDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 pl-10 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                  />
                  <Calendar size={16} className="absolute left-3.5 top-3 text-slate-400" />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Remarks / Notes (Optional)
              </label>
              <textarea
                rows={2}
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Driver notes, bunk name, invoice or receipt details"
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-normal text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
              />
            </div>

            {/* Error / Success alert */}
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
                <AlertCircle size={16} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold">
                <CheckCircle2 size={16} className="shrink-0" />
                <span>{success}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={saving}
              className="w-full flex items-center justify-center gap-2 py-3 px-5 rounded-xl text-sm font-extrabold text-white bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 shadow-md shadow-orange-500/20 hover:shadow-lg transition-all cursor-pointer disabled:opacity-50"
            >
              <Fuel size={16} />
              <span>{saving ? 'Submitting Fuel Entry...' : 'Save Fuel Entry'}</span>
            </button>
          </form>
        </div>

        {/* Right Status Card (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Real-time Tank Card */}
          <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Live Fuel Status
                </span>
                <h3 className="text-base font-extrabold text-white mt-0.5">
                  {activeVehicle?.plate || activeVehicle?.name}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-slate-800 text-slate-300 border border-slate-700">
                  {fuelConfig?.fuel_type || customFuelType}
                </span>
                <div className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-orange-500/20 text-orange-400 border border-orange-500/30">
                  {fuelState?.fuel_status || 'Normal'}
                </div>
              </div>
            </div>

            {/* Gauge Display */}
            <div className="p-4 rounded-xl bg-slate-800/80 border border-slate-700/60 space-y-3">
              <div className="flex items-baseline justify-between">
                <div>
                  <span className="text-3xl font-extrabold text-white tracking-tight">
                    {Math.round(calculatedNewFuel)}
                  </span>
                  <span className="text-sm font-bold text-slate-400 ml-1.5">
                    / {effectiveTankCapacity > 0 ? `${effectiveTankCapacity} L` : 'Not Set'}
                  </span>
                </div>
                <span className="text-lg font-black text-orange-400">
                  {effectiveTankCapacity > 0 ? `${Math.round(fuelFillPercentage)}%` : '--'}
                </span>
              </div>

              {/* Progress fill bar */}
              <div className="w-full bg-slate-700 rounded-full h-3 overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 rounded-full ${
                    fuelFillPercentage <= 15
                      ? 'bg-rose-500'
                      : fuelFillPercentage <= 25
                      ? 'bg-amber-500'
                      : 'bg-emerald-500'
                  }`}
                  style={{ width: `${fuelFillPercentage}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-700/60">
                <span>Estimated Driving Range:</span>
                <span className="font-extrabold text-white text-sm">~{estimatedRange.toLocaleString()} KM</span>
              </div>
            </div>

            {/* Vehicle Tank Specs Card */}
            <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/40 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 font-semibold">Vehicle Tank Capacity:</span>
                <span className="font-extrabold text-amber-400">
                  {effectiveTankCapacity > 0 ? `${effectiveTankCapacity} Litres` : 'Not Configured'}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 font-semibold">Average Mileage:</span>
                <span className="font-extrabold text-emerald-400">
                  {Number(currentMileage).toFixed(1)} km/l
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 font-semibold">Total GPS Distance:</span>
                <span className="font-extrabold text-sky-400">
                  {fuelState?.total_distance_travelled
                    ? (Number(fuelState.total_distance_travelled) + incrementalDistance).toFixed(1)
                    : incrementalDistance.toFixed(1)} km
                </span>
              </div>
              {incrementalFuelConsumed > 0 && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400 font-semibold">Trip Fuel Consumed:</span>
                  <span className="font-extrabold text-rose-400">
                    -{incrementalFuelConsumed.toFixed(1)} L
                  </span>
                </div>
              )}

              <button
                type="button"
                onClick={() => setIsEditingSpecs(prev => !prev)}
                className="w-full mt-2 py-1.5 px-3 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Settings size={12} />
                <span>{isEditingSpecs ? 'Hide Tank Settings' : 'Change Tank Capacity / Mileage'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Fuel Trend Graph */}
      {selectedVehicleId && (
        <ManualFuelChartCard
          vehicleId={selectedVehicleId}
          vehicleName={activeVehicle?.name || activeVehicle?.plate || 'Vehicle'}
          plate={activeVehicle?.plate || ''}
        />
      )}

      {/* Bottom Audit Log Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <History size={18} className="text-slate-500" />
            <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">
              Recent Fuel Entries & Audit History
            </h3>
          </div>
          <span className="text-xs text-slate-500 font-semibold">
            Showing last {entries.length} records
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[10px] font-extrabold">
                <th className="py-2.5 px-3">Date & Time</th>
                <th className="py-2.5 px-3">Entry Type</th>
                <th className="py-2.5 px-3 text-right">Odometer (KM)</th>
                <th className="py-2.5 px-3 text-right">Filled (L)</th>
                <th className="py-2.5 px-3 text-right">Fuel Level (L)</th>
                <th className="py-2.5 px-3">Driver / User</th>
                <th className="py-2.5 px-3">Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loadingEntries ? (
                <tr>
                  <td colSpan="7" className="py-8 text-center text-slate-400">
                    Loading fuel audit history...
                  </td>
                </tr>
              ) : entries.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-8 text-center text-slate-400">
                    No fuel entries recorded yet for this vehicle.
                  </td>
                </tr>
              ) : (
                entries.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600">
                      {new Date(item.entry_time || item.created_at || item.entry_date || Date.now()).toLocaleString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`inline-block px-2 py-0.5 rounded-md font-bold text-[10px] uppercase ${
                        item.entry_type === 'REFILL'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : item.entry_type === 'RECONCILIATION'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : 'bg-orange-50 text-orange-700 border border-orange-200'
                      }`}>
                        {item.entry_type}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                      {(item.odometer != null && !isNaN(Number(item.odometer)))
                        ? `${Number(item.odometer).toLocaleString()} KM`
                        : (item.odometer_reading != null && !isNaN(Number(item.odometer_reading)))
                        ? `${Number(item.odometer_reading).toLocaleString()} KM`
                        : '-'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700">
                      {item.fuel_filled != null && Number(item.fuel_filled) > 0
                        ? `+${Number(item.fuel_filled).toFixed(1)} L`
                        : item.entry_type === 'INITIAL' && item.fuel_quantity != null && Number(item.fuel_quantity) > 0
                        ? `${Number(item.fuel_quantity).toFixed(1)} L`
                        : '-'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-extrabold text-slate-900">
                      {item.fuel_quantity != null && !isNaN(Number(item.fuel_quantity)) ? `${Number(item.fuel_quantity).toFixed(1)} L` : '-'}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">
                      {item.driver_name || 'Driver / Admin'}
                    </td>
                    <td className="py-2.5 px-3 text-slate-500 max-w-xs truncate">
                      {item.remarks || '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ManualFuelEntryPage;
