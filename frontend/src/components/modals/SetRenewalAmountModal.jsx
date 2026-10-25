import React, { useState, useEffect, useMemo } from 'react';
import { X, DollarSign, Calendar, Loader2, AlertCircle, Clock } from 'lucide-react';
import * as adminApi from '../../api/adminApi';

const getToday = () => {
  const d = new Date();
  return d.toISOString().split('T')[0];
};

const addMonthsToDate = (dateStr, months) => {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return '';
  // Construct date in local timezone: month is 0-indexed
  const dt = new Date(y, m - 1 + months, d);
  // Expiry is one day before the anniversary (e.g. 24-10-2026 to 23-10-2027)
  dt.setDate(dt.getDate() - 1);
  const year = dt.getFullYear();
  const month = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const SetRenewalAmountModal = ({ isOpen, onClose, vehicle, onSuccess }) => {
  const [price, setPrice] = useState('');
  const [discountPrice, setDiscountPrice] = useState('');
  const [startDate, setStartDate] = useState(getToday());
  const [expiryDate, setExpiryDate] = useState(addMonthsToDate(getToday(), 12));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && vehicle) {
      setPrice(vehicle.renewalPrice !== undefined && vehicle.renewalPrice !== null ? vehicle.renewalPrice : '');
      setDiscountPrice(vehicle.discountPrice !== undefined && vehicle.discountPrice !== null ? vehicle.discountPrice : '');

      const defaultStart = vehicle.licenceIssuedDate
        ? new Date(vehicle.licenceIssuedDate).toISOString().split('T')[0]
        : getToday();

      let defaultExpiry = '';
      if (vehicle.licenceExpiryDate) {
        defaultExpiry = new Date(vehicle.licenceExpiryDate).toISOString().split('T')[0];
      } else {
        const months = vehicle.durationMonths || 12;
        defaultExpiry = addMonthsToDate(defaultStart, months);
      }

      setStartDate(defaultStart);
      setExpiryDate(defaultExpiry);
      setError('');
    }
  }, [isOpen, vehicle]);

  // Calculate range information
  const dateInfo = useMemo(() => {
    if (!startDate || !expiryDate) return null;
    const s = new Date(startDate);
    const e = new Date(expiryDate);
    if (isNaN(s.getTime()) || isNaN(e.getTime())) return null;
    const diffTime = e - s;
    // Total duration inclusive of both start and end days
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;
    if (diffDays <= 0) {
      return { isValid: false, message: 'Expiry date must be after Start date' };
    }
    const approxMonths = Math.max(1, Math.round(diffDays / 30.4));
    const alertDays = diffDays >= 180 ? 30 : (diffDays >= 45 ? 15 : 7);
    return {
      isValid: true,
      diffDays,
      approxMonths,
      alertDays
    };
  }, [startDate, expiryDate]);

  if (!isOpen || !vehicle) return null;

  const handleStartDateChange = (newStart) => {
    setStartDate(newStart);
    const currentMonths = dateInfo?.approxMonths || 12;
    setExpiryDate(addMonthsToDate(newStart, currentMonths));
  };

  const applyPresetMonths = (months) => {
    const base = startDate || getToday();
    const newExp = addMonthsToDate(base, months);
    setExpiryDate(newExp);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (price === '' || isNaN(price) || parseFloat(price) < 0) {
      setError('Please enter a valid renewal price (₹).');
      return;
    }

    if (discountPrice !== '' && (isNaN(discountPrice) || parseFloat(discountPrice) < 0)) {
      setError('Discount price must be a valid positive number.');
      return;
    }

    if (!startDate || !expiryDate) {
      setError('Please select both Start Date and Expiry Date.');
      return;
    }

    if (dateInfo && !dateInfo.isValid) {
      setError(dateInfo.message || 'Invalid date range.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const dbVehicleId = vehicle.dbVehicleId || vehicle.id || vehicle.vehicleId || vehicle.deviceId;
      const res = await adminApi.setVehicleBillingAmount({
        vehicleId: dbVehicleId,
        price: parseFloat(price),
        discountPrice: discountPrice !== '' && !isNaN(discountPrice) ? parseFloat(discountPrice) : null,
        durationMonths: dateInfo?.approxMonths || 12,
        startDate,
        expiryDate
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
        width: '100%', maxWidth: '480px', background: '#FFFFFF',
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
              Configure license pricing and custom validity range
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

          {/* Renewal Amount & Discount Price Fields */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
            <div>
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

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                Discount Price (₹) <span style={{ fontSize: '11px', color: '#059669', fontWeight: 600 }}>(Renew Today)</span>
              </label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#059669', fontWeight: 700 }}>₹</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="e.g. 2000 (Optional)"
                  value={discountPrice}
                  onChange={(e) => setDiscountPrice(e.target.value)}
                  style={{
                    width: '100%', padding: '10px 14px 10px 32px',
                    borderRadius: '10px', border: '1px solid #CBD5E1',
                    fontSize: '15px', fontWeight: 700, outline: 'none', color: '#059669',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>
          </div>

          {/* Savings Callout if discount price is entered */}
          {price !== '' && discountPrice !== '' && !isNaN(price) && !isNaN(discountPrice) && parseFloat(discountPrice) < parseFloat(price) && (
            <div style={{
              marginTop: '-4px', marginBottom: '20px', padding: '10px 14px',
              borderRadius: '8px', background: '#ECFDF5', border: '1px solid #A7F3D0',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              fontSize: '12px', color: '#065F46', fontWeight: 700
            }}>
              <span>🏷️ Renew Today Offer: Customer saves ₹{(parseFloat(price) - parseFloat(discountPrice)).toFixed(2)}</span>
              <span style={{ background: '#10B981', color: '#FFFFFF', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 800 }}>
                {Math.round(((parseFloat(price) - parseFloat(discountPrice)) / parseFloat(price)) * 100)}% OFF
              </span>
            </div>
          )}

          {/* Custom Date Range Picker */}
          <div style={{ marginBottom: '22px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '6px' }}>
              <label style={{ fontSize: '13px', fontWeight: 700, color: '#334155', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Calendar size={15} color="#EA580C" />
                Custom Date Range (Validity)
              </label>

              {/* Quick Presets */}
              <div style={{ display: 'flex', gap: '5px' }}>
                {[
                  { label: '1 Mo', months: 1 },
                  { label: '3 Mo', months: 3 },
                  { label: '6 Mo', months: 6 },
                  { label: '1 Yr', months: 12 }
                ].map(p => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => applyPresetMonths(p.months)}
                    title={`Set expiry to +${p.label} from start date`}
                    style={{
                      background: '#F1F5F9',
                      border: '1px solid #CBD5E1',
                      borderRadius: '6px',
                      padding: '2px 8px',
                      fontSize: '11px',
                      fontWeight: 700,
                      color: '#475569',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#FFEDD5'; e.currentTarget.style.borderColor = '#F97316'; e.currentTarget.style.color = '#C2410C'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = '#F1F5F9'; e.currentTarget.style.borderColor = '#CBD5E1'; e.currentTarget.style.color = '#475569'; }}
                  >
                    +{p.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <span style={{ display: 'block', fontSize: '11.5px', color: '#64748B', fontWeight: 600, marginBottom: '4px' }}>
                  Valid From (Start)
                </span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => handleStartDateChange(e.target.value)}
                  required
                  style={{
                    width: '100%', padding: '9px 12px',
                    borderRadius: '9px', border: '1px solid #CBD5E1',
                    fontSize: '13px', fontWeight: 600, outline: 'none', color: '#0F172A',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <span style={{ display: 'block', fontSize: '11.5px', color: '#64748B', fontWeight: 600, marginBottom: '4px' }}>
                  Valid To (Expiry Date)
                </span>
                <input
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  required
                  style={{
                    width: '100%', padding: '9px 12px',
                    borderRadius: '9px',
                    border: `1px solid ${dateInfo && !dateInfo.isValid ? '#EF4444' : '#CBD5E1'}`,
                    fontSize: '13px', fontWeight: 600, outline: 'none', color: '#0F172A',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>

            {/* Calculated duration & alert banner */}
            {dateInfo && dateInfo.isValid ? (
              <div style={{
                marginTop: '10px',
                background: '#F8FAFC',
                border: '1px solid #E2E8F0',
                borderRadius: '8px',
                padding: '9px 12px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '8px',
                fontSize: '12px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#0F172A', fontWeight: 700 }}>
                  <Clock size={14} color="#0284C7" />
                  <span>Duration: {dateInfo.diffDays} Days {dateInfo.approxMonths ? `(~${dateInfo.approxMonths} mo)` : ''}</span>
                </div>
                <div style={{ color: '#C2410C', fontWeight: 600, fontSize: '11.5px', background: '#FFF7ED', padding: '2px 8px', borderRadius: '5px' }}>
                  Alert starts {dateInfo.alertDays} days before expiry
                </div>
              </div>
            ) : dateInfo && !dateInfo.isValid ? (
              <div style={{ marginTop: '8px', color: '#DC2626', fontSize: '12px', fontWeight: 600 }}>
                {dateInfo.message}
              </div>
            ) : null}
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
              disabled={saving || (dateInfo && !dateInfo.isValid)}
              style={{
                padding: '10px 22px',
                background: (saving || (dateInfo && !dateInfo.isValid)) ? '#94A3B8' : '#F97316',
                color: '#FFFFFF',
                border: 'none', borderRadius: '10px', fontSize: '14px',
                fontWeight: 700,
                cursor: (saving || (dateInfo && !dateInfo.isValid)) ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', gap: '8px',
                boxShadow: (saving || (dateInfo && !dateInfo.isValid)) ? 'none' : '0 4px 6px -1px rgba(249, 115, 22, 0.3)',
                transition: 'all 0.15s ease'
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
