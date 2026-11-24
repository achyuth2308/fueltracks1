import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Fuel,
  Droplets,
  Gauge,
  Calendar,
  FileText,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Sparkles,
  ArrowRight,
  TrendingUp,
  Info,
  Settings,
  Edit3
} from 'lucide-react';
import { submitFuelEntry, getVehicleFuelState, getVehicleFuelConfig, saveVehicleFuelConfig } from '../../api/manualFuelApi';

/**
 * ManualFuelEntryModal
 *
 * Professional Manual Fuel Entry Modal for Fleet Managers & Drivers.
 * Allows entering Initial Fuel, Fuel Refills, and Current Fuel Level checks (Reconciliation).
 * Provides live calculation previews, custom per-vehicle tank capacity & mileage checks, and audit logging.
 */
const ManualFuelEntryModal = ({
  isOpen = true,
  vehicle = null,
  vehicles = [],
  onClose,
  onEntryAdded,
}) => {
  const [selectedVehicleId, setSelectedVehicleId] = useState(
    vehicle?.id || vehicle?.vehicle_id || (vehicles.length > 0 ? (vehicles[0].id || vehicles[0].vehicle_id) : '')
  );

  const [fuelState, setFuelState] = useState(null);
  const [fuelConfig, setFuelConfig] = useState(null);
  const [loadingState, setLoadingState] = useState(false);
  const [needsConfig, setNeedsConfig] = useState(false);
  const [isEditingSpecs, setIsEditingSpecs] = useState(false);

  // Form State
  const [entryType, setEntryType] = useState('REFILL'); // 'REFILL' | 'RECONCILIATION' | 'INITIAL'
  const [fuelFilled, setFuelFilled] = useState('');
  const [currentTankFuel, setCurrentTankFuel] = useState('');
  const [odometer, setOdometer] = useState('');
  const [remarks, setRemarks] = useState('');
  const [entryDate, setEntryDate] = useState(new Date().toISOString().slice(0, 16));

  // Vehicle Fuel Specifications
  const [customTankCapacity, setCustomTankCapacity] = useState('385');
  const [customFuelType, setCustomFuelType] = useState('Diesel');
  const [customMileage, setCustomMileage] = useState('4.5');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Sync selected vehicle prop if it changes
  useEffect(() => {
    if (vehicle?.id || vehicle?.vehicle_id) {
      setSelectedVehicleId(vehicle.vehicle_id || vehicle.id);
    }
  }, [vehicle]);

  // Load fuel state and config whenever selected vehicle changes
  useEffect(() => {
    if (!selectedVehicleId) return;

    setLoadingState(true);
    setError(null);
    setNeedsConfig(false);

    Promise.allSettled([
      getVehicleFuelState(selectedVehicleId),
      getVehicleFuelConfig(selectedVehicleId)
    ]).then(([stateResult, configResult]) => {
      let stateData = null;

      if (stateResult.status === 'fulfilled' && stateResult.value?.success) {
        stateData = stateResult.value.data;
        setFuelState(stateData);
      } else {
        setFuelState(null);
      }

      if (configResult.status === 'fulfilled' && configResult.value?.success && configResult.value.data) {
        const cfg = configResult.value.data;
        setFuelConfig(cfg);
        setCustomTankCapacity(String(cfg.tank_capacity || '385'));
        setCustomFuelType(cfg.fuel_type || 'Diesel');
        setCustomMileage(String(cfg.initial_mileage || '4.5'));
        setNeedsConfig(false);
        setEntryType('REFILL');
      } else {
        setFuelConfig(null);
        setNeedsConfig(true);
        setEntryType('INITIAL');
      }

      // Pre-fill odometer
      const lastOdo = stateData?.last_known_odometer || 0;
      if (lastOdo > 0) {
        setOdometer(String(lastOdo));
      }

      // Pre-fill current tank fuel
      if (stateData?.current_fuel != null) {
        setCurrentTankFuel(String(Math.round(stateData.current_fuel)));
      }
    }).finally(() => {
      setLoadingState(false);
    });
  }, [selectedVehicleId]);

  // Active vehicle object
  const activeVehicle = useMemo(() => {
    if (vehicle && (vehicle.id === selectedVehicleId || vehicle.vehicle_id === selectedVehicleId)) {
      return vehicle;
    }
    return vehicles.find(v => (v.id || v.vehicle_id) === selectedVehicleId) || null;
  }, [selectedVehicleId, vehicle, vehicles]);

  // Effective Calculations
  const effectiveTankCapacity = fuelConfig ? Number(fuelConfig.tank_capacity) : Number(customTankCapacity || 0);
  const prevFuel = fuelState ? Number(fuelState.current_fuel) : 0;
  const currentMileage = fuelState?.current_mileage ? Number(fuelState.current_mileage) : (fuelConfig ? Number(fuelConfig.initial_mileage) : Number(customMileage || 4.5));

  // Baseline odometer for selected vehicle before user's trip input
  const baseOdometer = useMemo(() => {
    return Number(fuelState?.last_known_odometer || fuelConfig?.initial_odometer || activeVehicle?.odometer || 0);
  }, [fuelState, fuelConfig, activeVehicle]);

  // Incremental distance driven based on user's odometer input
  const inputOdometer = parseFloat(odometer);
  const incrementalDistance = useMemo(() => {
    if (!isNaN(inputOdometer) && baseOdometer > 0 && inputOdometer > baseOdometer) {
      return Math.round((inputOdometer - baseOdometer) * 10) / 10;
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

  // Live estimated new fuel: accounts for distance driven AND refilled fuel
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

  // Submit Handler
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

    // Save configuration if first-time or INITIAL setup
    if (needsConfig || entryType === 'INITIAL' || isEditingSpecs) {
      if (isNaN(cap) || cap <= 0) {
        setError('Please enter a valid tank capacity in litres (e.g. 50L, 200L, 385L).');
        return;
      }
      if (isNaN(mil) || mil <= 0) {
        setError('Please enter a valid average mileage.');
        return;
      }

      const initialFuelQty = parseFloat(currentTankFuel);
      if (entryType === 'INITIAL') {
        if (isNaN(initialFuelQty) || initialFuelQty < 0) {
          setError('Please enter initial fuel currently available in tank (Litres).');
          return;
        }
        if (initialFuelQty > cap) {
          setError(`Initial fuel (${initialFuelQty} L) cannot exceed tank capacity (${cap} L).`);
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
        setError(cfgErr?.response?.data?.error || cfgErr.message || 'Failed to save vehicle fuel configuration.');
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
      payload.fuelQuantity = parseFloat(currentTankFuel);
      payload.fuelFilled = 0;
    } else if (entryType === 'REFILL') {
      const filled = parseFloat(fuelFilled);
      if (isNaN(filled) || filled <= 0) {
        setError('Please enter litres of fuel filled (must be greater than 0).');
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
          setError(`Current fuel (${afterRefill} L) exceeds tank capacity (${cap} L).`);
          return;
        }
        payload.fuelQuantity = afterRefill;
      } else {
        payload.fuelQuantity = Math.min(prevFuel + filled, cap);
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
        setSuccess('Fuel entry recorded successfully! Vehicle metrics updated.');
        if (onEntryAdded) {
          onEntryAdded(res.data);
        }
        setTimeout(() => {
          if (onClose) onClose();
        }, 1200);
      } else {
        setError(res?.message || 'Failed to submit fuel entry.');
      }
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Error submitting fuel entry.');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[10050] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl max-h-[92vh] flex flex-col overflow-hidden"
        style={{ fontFamily: "'Inter', system-ui, sans-serif" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-orange-50 via-white to-amber-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center text-white shadow-md shadow-orange-500/20">
              <Fuel size={20} strokeWidth={2.4} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-slate-900">Manual Fuel Entry</h3>
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 tracking-wider">
                  Customer Portal
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Record fuel refills, current tank checks & configure vehicle tank capacity
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* ESTIMATED VALUE Disclaimer Banner */}
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs">
            <Info size={16} className="text-amber-600 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <strong className="font-bold">ESTIMATED VALUE SYSTEM:</strong> Physical sensors are not required. Each vehicle has its own configured tank capacity and mileage.
            </div>
          </div>

          {/* Vehicle Selector */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Select Vehicle
              </label>
              {fuelConfig && (
                <button
                  type="button"
                  onClick={() => setIsEditingSpecs(prev => !prev)}
                  className="flex items-center gap-1 text-[11px] font-bold text-slate-600 hover:text-orange-600 bg-slate-100 hover:bg-orange-50 px-2 py-0.5 rounded-lg border border-slate-200"
                >
                  <Edit3 size={11} />
                  <span>{isEditingSpecs ? 'Close Specs' : `Tank: ${fuelConfig.tank_capacity}L`}</span>
                </button>
              )}
            </div>
            <select
              value={selectedVehicleId}
              onChange={(e) => setSelectedVehicleId(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
            >
              {vehicles && vehicles.length > 0 ? (
                vehicles.map(v => (
                  <option key={v.id || v.vehicle_id} value={v.id || v.vehicle_id}>
                    {v.plate || v.name} {v.name && v.plate && v.name !== v.plate ? `(${v.name})` : ''}
                  </option>
                ))
              ) : activeVehicle ? (
                <option value={activeVehicle.id || activeVehicle.vehicle_id}>
                  {activeVehicle.plate || activeVehicle.name}
                </option>
              ) : (
                <option value="">No vehicles available</option>
              )}
            </select>
          </div>

          {/* Vehicle Tank Specifications (Capacity, Fuel Type, Mileage) */}
          {(entryType === 'INITIAL' || needsConfig || isEditingSpecs) && (
            <div className="p-4 rounded-xl bg-orange-50/80 border border-orange-200 space-y-3">
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
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-mono font-black text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                  />
                  {/* Presets */}
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
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                  >
                    <option value="Diesel">Diesel</option>
                    <option value="Petrol">Petrol</option>
                    <option value="CNG">CNG</option>
                  </select>
                </div>

                {/* Avg Mileage (KM/L) */}
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
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-mono font-black text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">Truck: 3.5-5 | Car: 12-18</span>
                </div>
              </div>
            </div>
          )}

          {/* Vehicle Live State Badge */}
          {fuelState && (
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-3 gap-2 text-center">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Current Est. Fuel</span>
                <span className="text-base font-extrabold text-orange-600">
                  {Math.round(fuelState.current_fuel)} <span className="text-xs font-normal text-slate-500">/ {effectiveTankCapacity > 0 ? `${effectiveTankCapacity}L` : '--'}</span>
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Avg Mileage</span>
                <span className="text-base font-extrabold text-emerald-600">
                  {Number(currentMileage).toFixed(1)} <span className="text-xs font-normal text-slate-500">km/l</span>
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Est. Range</span>
                <span className="text-base font-extrabold text-slate-900">
                  ~{fuelState.estimated_range_km || Math.round(fuelState.current_fuel * currentMileage)} <span className="text-xs font-normal text-slate-500">km</span>
                </span>
              </div>
            </div>
          )}

          {/* Entry Type Selector Tabs */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Entry Type
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'REFILL', label: 'Fuel Refill', desc: 'Added fuel to tank', icon: Droplets },
                { id: 'RECONCILIATION', label: 'Level Check', desc: 'Verified tank level', icon: Gauge },
                { id: 'INITIAL', label: 'Initial Setup', desc: 'Set capacity & baseline', icon: Sparkles },
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

          {/* Form Inputs based on Entry Type */}
          <div className="space-y-4">
            {entryType === 'REFILL' && (
              <>
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
                      Tank Capacity: <strong>{effectiveTankCapacity} Litres</strong>
                    </span>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Current Tank Level After Refill (Optional)
                    </label>
                    <span className="text-[10px] text-slate-400">Auto-calculated if blank</span>
                  </div>
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
              </>
            )}

            {(entryType === 'RECONCILIATION' || entryType === 'INITIAL') && (
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  {entryType === 'INITIAL' ? 'Initial Fuel Currently in Tank (Litres)' : 'Actual Verified Fuel in Tank (Litres)'}{' '}
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
                    placeholder="e.g. 60"
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

            {/* Odometer Reading */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Vehicle Odometer Reading (KM) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={odometer}
                  onChange={(e) => setOdometer(e.target.value)}
                  placeholder="e.g. 45230"
                  required
                  className="w-full px-3.5 py-2.5 pl-10 bg-slate-50 border border-slate-300 rounded-xl font-mono text-sm font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                />
                <TrendingUp size={16} className="absolute left-3.5 top-3 text-slate-400" />
                <span className="absolute right-3.5 top-2.5 text-xs font-bold text-slate-400">KM</span>
              </div>
            </div>

            {/* Date and Time */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Entry Date & Time
              </label>
              <div className="relative">
                <input
                  type="datetime-local"
                  value={entryDate}
                  onChange={(e) => setEntryDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 pl-10 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                />
                <Calendar size={16} className="absolute left-3.5 top-3 text-slate-400" />
              </div>
            </div>

            {/* Remarks / Notes */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Remarks / Driver Notes (Optional)
              </label>
              <textarea
                rows={2}
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="e.g. Full tank at HPCL bunk, invoice #4921"
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-normal text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
              />
            </div>
          </div>

          {/* Live Tank Preview Gauge */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-slate-900 to-slate-800 text-white shadow-inner space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-300">Estimated Tank Level After Entry:</span>
              <span className="font-extrabold text-orange-400 text-sm">
                {Math.round(calculatedNewFuel)} L{' '}
                <span className="text-slate-400 text-xs font-normal">
                  / {effectiveTankCapacity > 0 ? `${effectiveTankCapacity} L` : 'Not Set'} ({effectiveTankCapacity > 0 ? `${Math.round(fuelFillPercentage)}%` : '--'})
                </span>
              </span>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-slate-700/60 rounded-full h-2.5 overflow-hidden">
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

            <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-700/50">
              <span>Est. Remaining Driving Range:</span>
              <span className="font-bold text-white">~{estimatedRange.toLocaleString()} KM</span>
            </div>
          </div>

          {/* Alerts: Error / Success */}
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

          {/* Footer Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-extrabold text-white bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 shadow-md shadow-orange-500/20 hover:shadow-lg hover:shadow-orange-500/30 transition-all cursor-pointer disabled:opacity-50"
            >
              <Fuel size={14} />
              <span>{saving ? 'Recording Fuel...' : 'Save Fuel Entry'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ManualFuelEntryModal;
