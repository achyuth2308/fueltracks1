import React, { useState, useEffect } from 'react';
import { X, DollarSign, Calendar, Loader2, ShieldCheck, AlertCircle } from 'lucide-react';
import * as adminApi from '../../api/adminApi';

const SetRenewalAmountModal = ({ isOpen, onClose, vehicle, onSuccess }) => {
  const [price, setPrice] = useState('');
  const [durationMonths, setDurationMonths] = useState(12);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && vehicle) {
      setPrice(vehicle.renewalPrice !== undefined && vehicle.renewalPrice !== null ? vehicle.renewalPrice : '');
      setDurationMonths(vehicle.durationMonths ? vehicle.durationMonths : 12);
      setError('');
    }
  }, [isOpen, vehicle]);

  if (!isOpen || !vehicle) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (price === '' || isNaN(price) || parseFloat(price) < 0) {
      setError('Please enter a valid renewal price (₹).');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const dbVehicleId = vehicle.dbVehicleId || vehicle.id || vehicle.vehicleId || vehicle.deviceId;
      const res = await adminApi.setVehicleBillingAmount({
        vehicleId: dbVehicleId,
        price: parseFloat(price),
        durationMonths: parseInt(durationMonths, 10)
      });


      if (res.success) {
        if (onSuccess) onSuccess(res.data);
        onClose();
      } else {
        setError(res.error || 'Failed to save renewal price.');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Error updating renewal amount.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 10000, padding: '16px'
    }}>
      <div style={{
        width: '100%', maxWidth: '440px', background: '#FFFFFF',
        borderRadius: '16px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        overflow: 'hidden', border: '1px solid #E2E8F0'
      }}>
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
          padding: '20px 24px', position: 'relative', display: 'flex', alignItems: 'center', gap: '12px'
        }}>
          <div style={{
            width: '40px', height: '40px', background: '#F97316',
            borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <DollarSign size={22} color="#FFFFFF" />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#F8FAFC' }}>
              Set Vehicle Renewal Amount
            </h3>
            <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#94A3B8' }}>
              Configure license pricing and alert thresholds
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={saving}
            style={{
              position: 'absolute', top: '20px', right: '20px',
              background: 'transparent', border: 'none', color: '#94A3B8',
              cursor: saving ? 'not-allowed' : 'pointer', padding: '4px'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ padding: '24px' }}>
          
          {/* Vehicle Info Header */}
          <div style={{
            background: '#F8FAFC', border: '1px solid #E2E8F0',
            borderRadius: '10px', padding: '12px 16px', marginBottom: '20px',
            fontSize: '13px', color: '#334155'
          }}>
            <div style={{ fontWeight: 700, color: '#0F172A', fontSize: '14px', marginBottom: '2px' }}>
              {vehicle.vehicleName}
            </div>
            <div style={{ color: '#64748B', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
              <span>IMEI: <strong>{vehicle.deviceId || vehicle.imei}</strong></span>
              <span>Org: <strong>{vehicle.organization}</strong></span>
            </div>
          </div>

          {error && (
            <div style={{
              background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px',
              padding: '12px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px',
              color: '#DC2626', fontSize: '13px'
            }}>
              <AlertCircle size={16} style={{ shrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          {/* Renewal Amount Field */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
              Renewal Price (₹) <span style={{ color: '#EF4444' }}>*</span>
            </label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#64748B', fontWeight: 700 }}>₹</span>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="e.g. 2500"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                required
                style={{
                  width: '100%', padding: '10px 14px 10px 32px',
                  borderRadius: '10px', border: '1px solid #CBD5E1',
                  fontSize: '15px', fontWeight: 700, outline: 'none', color: '#0F172A',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          </div>

          {/* Plan Duration Option */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
              Plan Duration & Warning Threshold
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div
                onClick={() => setDurationMonths(12)}
                style={{
                  padding: '12px', borderRadius: '10px', cursor: 'pointer',
                  border: `2px solid ${durationMonths === 12 ? '#F97316' : '#E2E8F0'}`,
                  background: durationMonths === 12 ? '#FFF7ED' : '#F8FAFC',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ fontWeight: 800, fontSize: '14px', color: durationMonths === 12 ? '#C2410C' : '#334155' }}>
                  1 Year Plan
                </div>
                <div style={{ fontSize: '11px', color: '#64748B', marginTop: '4px' }}>
                  Alert starts <strong>30 days</strong> before expiry
                </div>
              </div>

              <div
                onClick={() => setDurationMonths(1)}
                style={{
                  padding: '12px', borderRadius: '10px', cursor: 'pointer',
                  border: `2px solid ${durationMonths === 1 ? '#F97316' : '#E2E8F0'}`,
                  background: durationMonths === 1 ? '#FFF7ED' : '#F8FAFC',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ fontWeight: 800, fontSize: '14px', color: durationMonths === 1 ? '#C2410C' : '#334155' }}>
                  1 Month Plan
                </div>
                <div style={{ fontSize: '11px', color: '#64748B', marginTop: '4px' }}>
                  Alert starts <strong>7 days</strong> before expiry
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              style={{
                padding: '10px 18px', background: '#F1F5F9', color: '#475569',
                border: '1px solid #CBD5E1', borderRadius: '10px', fontSize: '14px',
                fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              style={{
                padding: '10px 22px', background: '#F97316', color: '#FFFFFF',
                border: 'none', borderRadius: '10px', fontSize: '14px',
                fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 6px -1px rgba(249, 115, 22, 0.3)'
              }}
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : null}
              Save Amount
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};

export default SetRenewalAmountModal;
