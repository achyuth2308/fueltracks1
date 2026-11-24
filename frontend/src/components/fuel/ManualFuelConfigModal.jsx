import React, { useState, useEffect } from 'react';
import { X, Fuel, Save, AlertCircle, CheckCircle2 } from 'lucide-react';
import { getVehicleFuelConfig, saveVehicleFuelConfig } from '../../api/manualFuelApi';

const ManualFuelConfigModal = ({ vehicle, onClose, onSaved }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const [formData, setFormData] = useState({
    fuelType: 'Diesel',
    tankCapacity: '',
    initialFuel: '',
    initialOdometer: '',
    initialMileage: '8.0',
    reserveFuelLevel: '10.0',
    lowFuelAlertThreshold: '15.0',
    criticalFuelAlertThreshold: '8.0',
  });

  useEffect(() => {
    if (!vehicle?.id && !vehicle?.vehicle_id) return;
    const vId = vehicle.vehicle_id || vehicle.id;
    setLoading(true);
    getVehicleFuelConfig(vId)
      .then(res => {
        if (res?.success && res.config) {
          const cfg = res.config;
          setFormData({
            fuelType: cfg.fuel_type || 'Diesel',
            tankCapacity: cfg.tank_capacity || '',
            initialFuel: cfg.initial_fuel || '',
            initialOdometer: cfg.initial_odometer || '',
            initialMileage: cfg.initial_mileage || '8.0',
            reserveFuelLevel: cfg.reserve_fuel_level || '10.0',
            lowFuelAlertThreshold: cfg.low_fuel_alert_threshold || '15.0',
            criticalFuelAlertThreshold: cfg.critical_fuel_alert_threshold || '8.0',
          });
        }
      })
      .catch(err => {
        console.error('Failed to load vehicle fuel config:', err);
      })
      .finally(() => setLoading(false));
  }, [vehicle]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const tankCap = parseFloat(formData.tankCapacity);
    const initFuel = parseFloat(formData.initialFuel || 0);
    const initMileage = parseFloat(formData.initialMileage || 0);

    if (isNaN(tankCap) || tankCap <= 0) {
      setError('Please provide a valid tank capacity in litres.');
      return;
    }
    if (initFuel > tankCap) {
      setError(`Initial fuel (${initFuel} L) cannot exceed tank capacity (${tankCap} L).`);
      return;
    }
    if (initMileage <= 0) {
      setError('Initial estimated mileage must be greater than 0.');
      return;
    }

    try {
      setSaving(true);
      const vId = vehicle.vehicle_id || vehicle.id;
      const res = await saveVehicleFuelConfig(vId, {
        fuelType: formData.fuelType,
        tankCapacity: tankCap,
        initialFuel: initFuel,
        initialOdometer: parseFloat(formData.initialOdometer || 0),
        initialMileage: initMileage,
        reserveFuelLevel: parseFloat(formData.reserveFuelLevel || 10),
        lowFuelAlertThreshold: parseFloat(formData.lowFuelAlertThreshold || 15),
        criticalFuelAlertThreshold: parseFloat(formData.criticalFuelAlertThreshold || 8),
      });

      if (res.success) {
        setSuccess('Fuel configuration saved successfully.');
        setTimeout(() => {
          if (onSaved) onSaved(res.config);
          onClose();
        }, 900);
      } else {
        setError(res.error || 'Failed to save configuration');
      }
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Error saving fuel config');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/20 text-orange-400 flex items-center justify-center">
              <Fuel size={20} />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Vehicle Fuel Configuration</h3>
              <p className="text-xs text-slate-300">
                {vehicle?.vehicle_name || vehicle?.name || 'Vehicle'} • {vehicle?.plate || ''}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-slate-800"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="p-8 flex items-center justify-center gap-3 text-slate-500">
            <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm font-medium">Loading configuration...</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-rose-700 text-xs font-semibold">
                <AlertCircle size={16} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-emerald-700 text-xs font-semibold">
                <CheckCircle2 size={16} className="shrink-0" />
                <span>{success}</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Fuel Type</label>
                <select
                  name="fuelType"
                  value={formData.fuelType}
                  onChange={handleChange}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="Diesel">Diesel</option>
                  <option value="Petrol">Petrol</option>
                  <option value="CNG">CNG</option>
                  <option value="Electric">Electric</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Tank Capacity (Litres) *</label>
                <input
                  type="number"
                  step="0.1"
                  required
                  name="tankCapacity"
                  placeholder="e.g. 120"
                  value={formData.tankCapacity}
                  onChange={handleChange}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Initial Fuel Level (L)</label>
                <input
                  type="number"
                  step="0.1"
                  name="initialFuel"
                  placeholder="e.g. 80"
                  value={formData.initialFuel}
                  onChange={handleChange}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Initial Odometer (KM)</label>
                <input
                  type="number"
                  step="0.1"
                  name="initialOdometer"
                  placeholder="e.g. 15400"
                  value={formData.initialOdometer}
                  onChange={handleChange}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Initial Mileage (KM/L) *</label>
                <input
                  type="number"
                  step="0.1"
                  required
                  name="initialMileage"
                  placeholder="e.g. 8.5"
                  value={formData.initialMileage}
                  onChange={handleChange}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Reserve Fuel (L)</label>
                <input
                  type="number"
                  step="0.1"
                  name="reserveFuelLevel"
                  placeholder="e.g. 10"
                  value={formData.reserveFuelLevel}
                  onChange={handleChange}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Low Fuel Alert (L)</label>
                <input
                  type="number"
                  step="0.1"
                  name="lowFuelAlertThreshold"
                  placeholder="e.g. 15"
                  value={formData.lowFuelAlertThreshold}
                  onChange={handleChange}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Critical Fuel Alert (L)</label>
                <input
                  type="number"
                  step="0.1"
                  name="criticalFuelAlertThreshold"
                  placeholder="e.g. 8"
                  value={formData.criticalFuelAlertThreshold}
                  onChange={handleChange}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-[11px] leading-relaxed">
              <strong>Notice:</strong> Fuel consumption is calculated using vehicle GPS distance increments divided by active rolling mileage. No physical hardware sensors are required.
            </div>

            {/* Actions */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 text-sm font-bold bg-orange-600 hover:bg-orange-700 text-white rounded-lg shadow-sm flex items-center gap-2 transition-colors disabled:opacity-50"
              >
                <Save size={16} />
                <span>{saving ? 'Saving...' : 'Save Configuration'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default ManualFuelConfigModal;
