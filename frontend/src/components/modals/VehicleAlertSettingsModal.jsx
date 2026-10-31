import React, { useState } from 'react';
import { X, Clock, Gauge, ShieldAlert, ShieldCheck, Check, Loader2, AlertCircle, Shield } from 'lucide-react';
import { updateVehicleSettings } from '../../api/vehicleApi';

const PRESET_IDLE = [15, 30, 60, 120];
const PRESET_PARK = [30, 60, 120, 240];
const PRESET_MOVING = [5, 15, 30, 60];

export default function VehicleAlertSettingsModal({ isOpen, onClose, vehicle, onSaved }) {
  if (!isOpen || !vehicle) return null;

  const meta = vehicle.metadata || {};
  const [idleDuration, setIdleDuration] = useState(meta.idleDurationAlert !== undefined ? String(meta.idleDurationAlert) : '60');
  const [parkingDuration, setParkingDuration] = useState(
    meta.parkingDurationAlert !== undefined ? String(meta.parkingDurationAlert) : (meta.parkDurationAlert !== undefined ? String(meta.parkDurationAlert) : '60')
  );
  const [movingDuration, setMovingDuration] = useState(
    meta.movingDurationAlert !== undefined ? String(meta.movingDurationAlert) : '60'
  );
  const [overspeedLimit, setOverspeedLimit] = useState(meta.overSpeedLimit !== undefined ? String(meta.overSpeedLimit) : '60');
  const [overspeedDuration, setOverspeedDuration] = useState(meta.overspeedDurationAlert !== undefined ? String(meta.overspeedDurationAlert) : '3');
  const [safetyPark, setSafetyPark] = useState(meta.safetyPark === 'YES');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const isIgnitionOn = vehicle.current_ignition === true || vehicle.ignition === true;
  const currentSpeed = parseFloat(vehicle.current_speed ?? vehicle.speed ?? 0);
  const isMovingWithIgnition = isIgnitionOn && currentSpeed > 2;

  const handleSave = async (e) => {
    e.preventDefault();
    if (safetyPark && isMovingWithIgnition) {
      setError('Cannot enable Safety Parking while vehicle ignition is ON and speed > 2 km/h. Vehicle must be stopped with engine OFF.');
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const payload = {
        idleDurationAlert: Math.max(1, parseFloat(idleDuration) || 60),
        parkingDurationAlert: Math.max(1, parseFloat(parkingDuration) || 60),
        movingDurationAlert: Math.max(5, parseFloat(movingDuration) || 60),
        overSpeedLimit: Math.max(10, parseFloat(overspeedLimit) || 60),
        overspeedDurationAlert: Math.max(1, parseFloat(overspeedDuration) || 3),
        safetyPark: safetyPark ? 'YES' : 'NO'
      };

      const res = await updateVehicleSettings(vehicle.id, payload);
      if (res.success) {
        setSuccess(true);
        if (onSaved) onSaved(res.data);
        setTimeout(() => {
          onClose();
        }, 1200);
      } else {
        setError(res.error || 'Failed to update vehicle alert settings.');
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Error updating settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#FFFFFF',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '520px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          border: '1px solid #E2E8F0'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '18px 24px',
          borderBottom: '1px solid #F1F5F9',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: '#F8FAFC'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: '#EA580C15',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#EA580C'
            }}>
              <Clock size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                Alert & Idling Settings
              </h3>
              <p style={{ fontSize: '12px', color: '#64748B', margin: '2px 0 0 0' }}>
                {vehicle.name} ({vehicle.plate})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: '#94A3B8',
              padding: '4px',
              borderRadius: '6px'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {error && (
            <div style={{
              background: '#FEF2F2',
              border: '1px solid #FECACA',
              padding: '10px 14px',
              borderRadius: '8px',
              color: '#DC2626',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div style={{
              background: '#F0FDF4',
              border: '1px solid #BBF7D0',
              padding: '10px 14px',
              borderRadius: '8px',
              color: '#16A34A',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <Check size={16} />
              <span>Vehicle alert settings saved successfully!</span>
            </div>
          )}

          {/* 1. Idling Duration Alert */}
          <div style={{ background: '#FFF7ED', border: '1px solid #FFEDD5', borderRadius: '12px', padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label style={{ fontSize: '13px', fontWeight: 800, color: '#9A3412', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Clock size={16} color="#EA580C" />
                Idling Duration Alert
              </label>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#C2410C', background: '#FED7AA', padding: '2px 8px', borderRadius: '4px' }}>
                Default: 60 mins (1 hr)
              </span>
            </div>
            <p style={{ fontSize: '12px', color: '#B45309', margin: '0 0 10px 0', lineHeight: 1.4 }}>
              Alert triggers when ignition is ON but speed is 0 for longer than this duration.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
              <input
                type="number"
                min="1"
                max="1440"
                value={idleDuration}
                onChange={e => setIdleDuration(e.target.value)}
                style={{
                  width: '90px',
                  padding: '7px 10px',
                  borderRadius: '8px',
                  border: '1px solid #FDBA74',
                  background: '#FFFFFF',
                  fontSize: '14px',
                  fontWeight: 700,
                  color: '#1E293B',
                  textAlign: 'center'
                }}
              />
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#7C2D12' }}>Minutes</span>
            </div>
            {/* Quick Presets */}
            <div style={{ display: 'flex', gap: '6px' }}>
              {PRESET_IDLE.map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setIdleDuration(String(m))}
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '3px 10px',
                    borderRadius: '6px',
                    border: String(idleDuration) === String(m) ? '1px solid #EA580C' : '1px solid #FED7AA',
                    background: String(idleDuration) === String(m) ? '#EA580C' : '#FFFFFF',
                    color: String(idleDuration) === String(m) ? '#FFFFFF' : '#9A3412',
                    cursor: 'pointer',
                    transition: 'all 0.15s'
                  }}
                >
                  {m >= 60 ? `${m / 60} hr${m > 60 ? 's' : ''}` : `${m}m`} {m === 60 ? '(Default)' : ''}
                </button>
              ))}
            </div>
          </div>

          {/* 2. Parking Duration Alert */}
          <div style={{ background: '#EFF6FF', border: '1px solid #DBEAFE', borderRadius: '12px', padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label style={{ fontSize: '13px', fontWeight: 800, color: '#1E40AF', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Clock size={16} color="#2563EB" />
                Parking Duration Alert
              </label>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#1D4ED8', background: '#BFDBFE', padding: '2px 8px', borderRadius: '4px' }}>
                Default: 60 mins (1 hr)
              </span>
            </div>
            <p style={{ fontSize: '12px', color: '#1D4ED8', margin: '0 0 10px 0', lineHeight: 1.4 }}>
              Alert triggers when vehicle is continuously parked (ignition OFF, speed 0) for this duration.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
              <input
                type="number"
                min="1"
                max="1440"
                value={parkingDuration}
                onChange={e => setParkingDuration(e.target.value)}
                style={{
                  width: '90px',
                  padding: '7px 10px',
                  borderRadius: '8px',
                  border: '1px solid #93C5FD',
                  background: '#FFFFFF',
                  fontSize: '14px',
                  fontWeight: 700,
                  color: '#1E293B',
                  textAlign: 'center'
                }}
              />
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#1E3A8A' }}>Minutes</span>
            </div>
            {/* Quick Presets */}
            <div style={{ display: 'flex', gap: '6px' }}>
              {PRESET_PARK.map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setParkingDuration(String(m))}
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '3px 10px',
                    borderRadius: '6px',
                    border: String(parkingDuration) === String(m) ? '1px solid #2563EB' : '1px solid #BFDBFE',
                    background: String(parkingDuration) === String(m) ? '#2563EB' : '#FFFFFF',
                    color: String(parkingDuration) === String(m) ? '#FFFFFF' : '#1E40AF',
                    cursor: 'pointer',
                    transition: 'all 0.15s'
                  }}
                >
                  {m >= 60 ? `${m / 60} hr${m > 60 ? 's' : ''}` : `${m}m`} {m === 60 ? '(Default)' : ''}
                </button>
              ))}
            </div>
          </div>

          {/* 3. Moving Alert (After Stoppage) */}
          <div style={{ background: '#F0FDF4', border: '1px solid #DCFCE7', borderRadius: '12px', padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label style={{ fontSize: '13px', fontWeight: 800, color: '#166534', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Clock size={16} color="#16A34A" />
                Moving Alert (After Stoppage)
              </label>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#15803D', background: '#BBF7D0', padding: '2px 8px', borderRadius: '4px' }}>
                Default: 60 mins (1 hr)
              </span>
            </div>
            <p style={{ fontSize: '12px', color: '#15803D', margin: '0 0 10px 0', lineHeight: 1.4 }}>
              Alert triggers when vehicle starts moving (speed &gt; 10 km/h) after being stopped for at least this duration (min: 5 mins).
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
              <input
                type="number"
                min="5"
                max="1440"
                value={movingDuration}
                onChange={e => setMovingDuration(e.target.value)}
                style={{
                  width: '90px',
                  padding: '7px 10px',
                  borderRadius: '8px',
                  border: '1px solid #86EFAC',
                  background: '#FFFFFF',
                  fontSize: '14px',
                  fontWeight: 700,
                  color: '#1E293B',
                  textAlign: 'center'
                }}
              />
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#14532D' }}>Minutes (Min 5m)</span>
            </div>
            {/* Quick Presets */}
            <div style={{ display: 'flex', gap: '6px' }}>
              {PRESET_MOVING.map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMovingDuration(String(m))}
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '3px 10px',
                    borderRadius: '6px',
                    border: String(movingDuration) === String(m) ? '1px solid #16A34A' : '1px solid #BBF7D0',
                    background: String(movingDuration) === String(m) ? '#16A34A' : '#FFFFFF',
                    color: String(movingDuration) === String(m) ? '#FFFFFF' : '#166534',
                    cursor: 'pointer',
                    transition: 'all 0.15s'
                  }}
                >
                  {m >= 60 ? `${m / 60} hr${m > 60 ? 's' : ''}` : `${m}m`} {m === 60 ? '(Default)' : ''}
                </button>
              ))}
            </div>
          </div>

          {/* 4. Overspeed Limit */}
          <div style={{ background: '#FFFBEB', border: '1px solid #FEF3C7', borderRadius: '12px', padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label style={{ fontSize: '13px', fontWeight: 800, color: '#92400E', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Gauge size={16} color="#D97706" />
                OverSpeed Limit
              </label>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#B45309', background: '#FDE68A', padding: '2px 8px', borderRadius: '4px' }}>
                Immediate + 10m Continuous Check
              </span>
            </div>
            <p style={{ fontSize: '12px', color: '#B45309', margin: '0 0 10px 0', lineHeight: 1.4 }}>
              Alert triggers immediately once speed exceeds this limit. If overspeeding continues, alerts every 10 mins reporting the duration since it started.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <input
                type="number"
                min="20"
                max="200"
                value={overspeedLimit}
                onChange={e => setOverspeedLimit(e.target.value)}
                style={{
                  width: '90px',
                  padding: '7px 10px',
                  borderRadius: '8px',
                  border: '1px solid #FCD34D',
                  background: '#FFFFFF',
                  fontSize: '14px',
                  fontWeight: 700,
                  color: '#1E293B',
                  textAlign: 'center'
                }}
              />
            </div>
          </div>

          {/* 5. Safety Parking (Theft Siren Alarm) */}
          <div style={{
            background: safetyPark ? '#FEF2F2' : '#F8FAFC',
            border: safetyPark ? '1px solid #FECACA' : '1px solid #E2E8F0',
            borderRadius: '12px',
            padding: '16px',
            transition: 'all 0.2s'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={{ fontSize: '13px', fontWeight: 800, color: safetyPark ? '#DC2626' : '#1E293B', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <ShieldAlert size={16} color={safetyPark ? '#DC2626' : '#64748B'} />
                Safety Parking (Theft Police Siren)
              </label>
              <button
                type="button"
                onClick={() => {
                  if (!safetyPark && isMovingWithIgnition) {
                    setError('Cannot enable Safety Parking while vehicle ignition is ON and speed > 2 km/h. Vehicle must be stopped with engine OFF.');
                    return;
                  }
                  setError(null);
                  setSafetyPark(!safetyPark);
                }}
                disabled={!safetyPark && isMovingWithIgnition}
                style={{
                  padding: '4px 12px',
                  borderRadius: '20px',
                  border: 'none',
                  background: safetyPark ? '#DC2626' : (isMovingWithIgnition ? '#E2E8F0' : '#CBD5E1'),
                  color: (isMovingWithIgnition && !safetyPark) ? '#94A3B8' : '#FFFFFF',
                  fontSize: '11px',
                  fontWeight: 800,
                  cursor: (isMovingWithIgnition && !safetyPark) ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  transition: 'background 0.2s'
                }}
              >
                {safetyPark ? <ShieldCheck size={13} /> : <Shield size={13} />}
                {safetyPark ? 'ARMED / ON' : 'OFF'}
              </button>
            </div>
            <p style={{ fontSize: '12px', color: safetyPark ? '#991B1B' : '#64748B', margin: 0, lineHeight: 1.4 }}>
              When armed, if this vehicle moves (speed &gt; 1 km/h) or the engine turns ON, an immediate continuous police siren will sound across the application until turned off.
            </p>
            {isMovingWithIgnition && (
              <div style={{ marginTop: '8px', fontSize: '12px', color: '#DC2626', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                <AlertCircle size={14} />
                Vehicle is currently moving with ignition ON ({Math.round(currentSpeed)} km/h). Safety Parking cannot be armed.
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              style={{
                padding: '9px 18px',
                borderRadius: '8px',
                border: '1px solid #CBD5E1',
                background: '#FFFFFF',
                color: '#475569',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '9px 22px',
                borderRadius: '8px',
                border: 'none',
                background: '#EA580C',
                color: '#FFFFFF',
                fontSize: '13px',
                fontWeight: 700,
                cursor: saving ? 'wait' : 'pointer',
                boxShadow: '0 4px 12px rgba(234, 88, 12, 0.25)'
              }}
            >
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
