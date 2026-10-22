import React, { useState, useEffect } from 'react';
import { X, Loader2, CheckCircle, AlertTriangle, RotateCw } from 'lucide-react';
import * as vehicleApi from '../../api/vehicleApi';

const ReprocessModal = ({ isOpen, onClose, vehicle, onSuccess }) => {
  // Format today as DD-MM-YYYY
  const getTodayFormatted = () => {
    const now = new Date();
    const d = String(now.getDate()).padStart(2, '0');
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const y = now.getFullYear();
    return `${d}-${m}-${y}`;
  };

  const [date, setDate] = useState(getTodayFormatted());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (isOpen) {
      setDate(getTodayFormatted());
      setError('');
      setSuccess('');
      setLoading(false);
    }
  }, [isOpen, vehicle]);

  if (!isOpen || !vehicle) return null;

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!date.trim()) {
      setError('Please select or enter a date.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const res = await vehicleApi.reprocessVehicle(vehicle.id, date.trim());
      setSuccess(res.message || 'Reprocessing initiated successfully!');
      if (onSuccess) onSuccess();
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err) {
      console.error('Reprocess error:', err);
      setError(err.response?.data?.error || err.message || 'Failed to initiate reprocessing.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.45)',
        backdropFilter: 'blur(3px)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) onClose();
      }}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: '14px',
          width: '100%',
          maxWidth: '460px',
          padding: '32px 36px',
          border: '1px solid #fed7aa',
          boxShadow: '0 20px 25px -5px rgba(249, 115, 22, 0.12), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          position: 'relative',
          boxSizing: 'border-box',
          animation: 'modalSlideIn 0.2s ease-out'
        }}
      >
        {/* Close Button X (Top Right) */}
        <button
          type="button"
          onClick={onClose}
          disabled={loading}
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            background: 'transparent',
            border: 'none',
            color: '#94a3b8',
            cursor: 'pointer',
            padding: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '6px',
            transition: 'color 0.15s ease, background 0.15s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = '#ea580c';
            e.currentTarget.style.background = '#fff7ed';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = '#94a3b8';
            e.currentTarget.style.background = 'transparent';
          }}
        >
          <X size={18} strokeWidth={2.2} />
        </button>

        {/* Modal Header with FuelTracks Orange Accent */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '10px',
          marginBottom: '26px'
        }}>
          <div style={{
            width: '46px',
            height: '46px',
            borderRadius: '12px',
            background: '#fff7ed',
            color: '#ea580c',
            border: '1px solid #fed7aa',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(249, 115, 22, 0.18)'
          }}>
            <RotateCw size={22} color="#ea580c" />
          </div>
          <h2
            style={{
              textAlign: 'center',
              fontSize: '21px',
              fontWeight: 800,
              color: '#0f172a',
              margin: 0,
              letterSpacing: '-0.02em'
            }}
          >
            Reprocess for vehicle
          </h2>
          <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 600 }}>
            {vehicle?.name || vehicle?.plate || 'Vehicle'}
          </span>
        </div>

        {/* Error / Success Alerts */}
        {error && (
          <div style={{
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '8px',
            padding: '10px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            color: '#dc2626',
            fontSize: '13px',
            fontWeight: 600,
            marginBottom: '18px'
          }}>
            <AlertTriangle size={16} />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div style={{
            background: '#f0fdf4',
            border: '1px solid #bbf7d0',
            borderRadius: '8px',
            padding: '10px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            color: '#16a34a',
            fontSize: '13px',
            fontWeight: 600,
            marginBottom: '18px'
          }}>
            <CheckCircle size={16} />
            <span>{success}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Date Input Field with FuelTracks Orange Theme */}
          <div style={{ marginBottom: '28px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '8px' }}>
              Date
            </label>
            <input
              type="text"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              placeholder="DD-MM-YYYY"
              style={{
                width: '100%',
                height: '42px',
                padding: '0 16px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                fontSize: '14px',
                fontWeight: 600,
                color: '#0f172a',
                outline: 'none',
                boxSizing: 'border-box',
                transition: 'border-color 0.15s ease, box-shadow 0.15s ease'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#f97316';
                e.target.style.boxShadow = '0 0 0 3px rgba(249, 115, 22, 0.18)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#cbd5e1';
                e.target.style.boxShadow = 'none';
              }}
            />
          </div>

          {/* Centered Action Buttons (FuelTracks Brand Orange Theme) */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '14px'
          }}>
            {/* Submit Button (Signature FuelTracks Brand Orange) */}
            <button
              type="submit"
              disabled={loading}
              style={{
                background: '#f97316',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                padding: '10px 30px',
                fontSize: '13.5px',
                fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 12px rgba(249, 115, 22, 0.3)',
                transition: 'all 0.15s ease',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                opacity: loading ? 0.75 : 1
              }}
              onMouseEnter={(e) => {
                if (!loading) {
                  e.currentTarget.style.background = '#ea580c';
                  e.currentTarget.style.boxShadow = '0 6px 16px rgba(249, 115, 22, 0.4)';
                }
              }}
              onMouseLeave={(e) => {
                if (!loading) {
                  e.currentTarget.style.background = '#f97316';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(249, 115, 22, 0.3)';
                }
              }}
            >
              {loading ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <span>Submit</span>
              )}
            </button>

            {/* Cancel Button (Clean Neutral Secondary with Orange Hover) */}
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              style={{
                background: '#ffffff',
                color: '#475569',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                padding: '10px 30px',
                fontSize: '13.5px',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#fff7ed';
                e.currentTarget.style.color = '#ea580c';
                e.currentTarget.style.borderColor = '#fed7aa';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#ffffff';
                e.currentTarget.style.color = '#475569';
                e.currentTarget.style.borderColor = '#cbd5e1';
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ReprocessModal;
