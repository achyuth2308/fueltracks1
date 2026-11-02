import React, { useState, useEffect } from 'react';
import { X, Zap, ShieldAlert, AlertTriangle, CheckCircle, Loader2, Key, Power } from 'lucide-react';
import * as vehicleApi from '../../api/vehicleApi';

const ImmobilizerModal = ({ isOpen, onClose, vehicle, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [confirmStep, setConfirmStep] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setSuccessMsg(null);
      setConfirmStep(false);
      setLoading(false);
    }
  }, [isOpen, vehicle?.id]);

  if (!isOpen || !vehicle) return null;

  const isImmobilized = !!vehicle.is_immobilized;
  const currentSpeed = parseFloat(vehicle.current_speed !== undefined ? vehicle.current_speed : (vehicle.speed || 0));
  const isMoving = currentSpeed > 5.0;

  const handleAction = async () => {
    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    const targetAction = isImmobilized ? 'MOBILIZE' : 'IMMOBILIZE';

    try {
      const res = await vehicleApi.setVehicleImmobilizer(vehicle.id, targetAction);
      if (res && res.success) {
        const nextState = !isImmobilized;
        setSuccessMsg(res.message || (nextState
          ? 'Immobilize command dispatched. Relay cut-off initiated.'
          : 'Mobilize command dispatched. Power circuit restored.'));
        setConfirmStep(false);

        if (onSuccess) {
          onSuccess({
            ...vehicle,
            is_immobilized: nextState,
            immobilizer_updated_at: new Date().toISOString()
          });
        }
      } else {
        setError(res?.error || 'Failed to dispatch command to vehicle.');
      }
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Error communicating with tracker.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="modal-overlay"
      style={{
        background: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) onClose();
      }}
    >
      <div
        className="modal-box"
        style={{
          width: '460px',
          maxWidth: '92vw',
          background: '#FFFFFF',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
          overflow: 'hidden',
          animation: 'modalSlideIn 0.2s ease-out'
        }}
      >
        {/* Header */}
        <div style={{ background: '#0F172A', padding: '20px 24px', position: 'relative' }}>
          <button
            onClick={onClose}
            disabled={loading}
            style={{
              position: 'absolute',
              top: '18px',
              right: '18px',
              background: 'rgba(255, 255, 255, 0.1)',
              border: 'none',
              borderRadius: '50%',
              width: '30px',
              height: '30px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#94A3B8',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.2)'; e.currentTarget.style.color = '#fff'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#94A3B8'; }}
          >
            <X size={16} />
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '10px',
                background: isImmobilized ? '#EF4444' : '#F97316',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: isImmobilized ? '0 0 16px rgba(239, 68, 68, 0.4)' : '0 0 16px rgba(249, 115, 22, 0.3)'
              }}
            >
              {isImmobilized ? <Key size={22} color="#FFFFFF" /> : <Power size={22} color="#FFFFFF" />}
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#F8FAFC', letterSpacing: '-0.02em' }}>
                Remote Engine Relay
              </h3>
              <div style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 500 }}>
                Hardware Circuit Immobilizer & Power Control
              </div>
            </div>
          </div>

          <div style={{ fontSize: '12.5px', color: '#CBD5E1', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, color: '#FFFFFF' }}>{vehicle.name}</span>
            <span>•</span>
            <span style={{ fontFamily: 'monospace', color: '#94A3B8' }}>{vehicle.plate || vehicle.name}</span>
            {vehicle.imei && (
              <>
                <span>•</span>
                <span style={{ fontSize: '11px', color: '#64748B' }}>IMEI: {vehicle.imei}</span>
              </>
            )}
          </div>
        </div>

        {/* Body Content */}
        <div style={{ padding: '24px' }}>
          {/* Status Display Card */}
          <div
            style={{
              padding: '14px 16px',
              borderRadius: '12px',
              border: `1.5px solid ${isImmobilized ? '#FECACA' : '#BBF7D0'}`,
              background: isImmobilized ? '#FEF2F2' : '#F0FDF4',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '16px'
            }}
          >
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: isImmobilized ? '#991B1B' : '#166534' }}>
                Current Relay Status
              </div>
              <div style={{ fontSize: '15px', fontWeight: 800, color: isImmobilized ? '#DC2626' : '#15803D', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span
                  style={{
                    display: 'inline-block',
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: isImmobilized ? '#DC2626' : '#15803D',
                    boxShadow: isImmobilized ? '0 0 8px #DC2626' : '0 0 8px #15803D'
                  }}
                />
                {isImmobilized ? 'IMMOBILIZED (Engine Cut)' : 'ACTIVE (Power Connected)'}
              </div>
            </div>

            <div
              style={{
                fontSize: '11px',
                fontWeight: 700,
                color: '#64748B',
                textAlign: 'right'
              }}
            >
              <div>Speed: <strong style={{ color: currentSpeed > 0 ? '#0F172A' : '#64748B' }}>{Math.round(currentSpeed)} km/h</strong></div>
              <div>Ignition: <strong style={{ color: vehicle.current_ignition ? '#10B981' : '#64748B' }}>{vehicle.current_ignition ? 'ON' : 'OFF'}</strong></div>
            </div>
          </div>

          {/* Speed Danger Warning */}
          {isMoving && !isImmobilized && (
            <div
              style={{
                padding: '12px 14px',
                borderRadius: '10px',
                background: '#FFFBEB',
                border: '1px solid #FDE68A',
                marginBottom: '16px',
                display: 'flex',
                gap: '10px',
                alignItems: 'flex-start'
              }}
            >
              <AlertTriangle size={18} color="#D97706" style={{ flexShrink: 0, marginTop: '1px' }} />
              <div style={{ fontSize: '12px', color: '#92400E', lineHeight: '1.4' }}>
                <strong>Safety Warning:</strong> The vehicle is actively in motion (<strong>{Math.round(currentSpeed)} km/h</strong>).
                Cutting engine power while travelling at speed may result in sudden deceleration or power-steering loss. Ensure the vehicle is in a safe location.
              </div>
            </div>
          )}

          {/* Description */}
          <div style={{ fontSize: '12.5px', color: '#475569', lineHeight: '1.5', marginBottom: '20px' }}>
            {isImmobilized ? (
              <span>
                Sending the <strong>MOBILIZE</strong> command will de-energize the tracker's relay, closing the power circuit so the driver can start the vehicle normally.
              </span>
            ) : (
              <span>
                Sending the <strong>IMMOBILIZE</strong> command sends a signal to the tracker relay to interrupt the fuel pump / starter motor circuit, preventing the engine from starting.
              </span>
            )}
          </div>

          {/* Success Message Banner */}
          {successMsg && (
            <div
              style={{
                padding: '12px 16px',
                borderRadius: '10px',
                background: '#ECFDF5',
                border: '1px solid #A7F3D0',
                color: '#065F46',
                fontSize: '13px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                marginBottom: '16px'
              }}
            >
              <CheckCircle size={18} color="#059669" style={{ flexShrink: 0 }} />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Error Banner */}
          {error && (
            <div
              style={{
                padding: '12px 16px',
                borderRadius: '10px',
                background: '#FEF2F2',
                border: '1px solid #FECACA',
                color: '#991B1B',
                fontSize: '13px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                marginBottom: '16px'
              }}
            >
              <AlertTriangle size={18} color="#DC2626" style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          {/* Confirmation Prompt / Action Buttons */}
          {confirmStep ? (
            <div
              style={{
                background: '#F8FAFC',
                border: '1px solid #E2E8F0',
                borderRadius: '12px',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}
            >
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A', textAlign: 'center' }}>
                {isImmobilized
                  ? `Are you sure you want to RESTORE engine power for ${vehicle.name}?`
                  : `Are you sure you want to CUT engine power for ${vehicle.name}?`}
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setConfirmStep(false)}
                  disabled={loading}
                  style={{
                    flex: 1,
                    padding: '10px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    background: '#FFFFFF',
                    color: '#475569',
                    fontWeight: 700,
                    fontSize: '12.5px',
                    cursor: loading ? 'not-allowed' : 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAction}
                  disabled={loading}
                  style={{
                    flex: 1,
                    padding: '10px',
                    borderRadius: '8px',
                    border: 'none',
                    background: isImmobilized ? '#059669' : '#DC2626',
                    color: '#FFFFFF',
                    fontWeight: 700,
                    fontSize: '12.5px',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    boxShadow: isImmobilized ? '0 2px 8px rgba(5,150,105,0.3)' : '0 2px 8px rgba(220,38,38,0.3)'
                  }}
                >
                  {loading ? (
                    <>
                      <Loader2 size={15} className="animate-spin" />
                      <span>Dispatching...</span>
                    </>
                  ) : (
                    <span>{isImmobilized ? 'Yes, Restore Power' : 'Yes, Cut Engine'}</span>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '10px',
                  border: '1px solid #E2E8F0',
                  background: '#FFFFFF',
                  color: '#475569',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                Close
              </button>

              <button
                type="button"
                onClick={() => setConfirmStep(true)}
                disabled={loading}
                style={{
                  flex: 1.6,
                  padding: '12px',
                  borderRadius: '10px',
                  border: 'none',
                  background: isImmobilized
                    ? 'linear-gradient(135deg, #059669, #047857)'
                    : 'linear-gradient(135deg, #DC2626, #B91C1C)',
                  color: '#FFFFFF',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: isImmobilized
                    ? '0 4px 14px rgba(5, 150, 105, 0.35)'
                    : '0 4px 14px rgba(220, 38, 38, 0.35)'
                }}
              >
                {isImmobilized ? (
                  <>
                    <Key size={16} />
                    <span>Restore Engine Power</span>
                  </>
                ) : (
                  <>
                    <Power size={16} />
                    <span>Cut Engine Power</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImmobilizerModal;
