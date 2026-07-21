import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Truck, Activity, MapPin, Navigation, RefreshCw, AlertCircle, ChevronRight, Users2, X, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useVehicles } from '../../hooks/useVehicles';
import { useAuth } from '../../hooks/useAuth';
import FleetMap from '../../components/map/FleetMap';
import DummyRazorpayModal from '../../components/modals/DummyRazorpayModal';
import { formatSpeed } from '../../utils/formatUtils';
import { getRelativeTime, getVehicleExpiryStatus } from '../../utils/dateUtils';

const getExpiryWarning = (vehicle) => {
  if (!vehicle || !vehicle.licence_expire_date) return null;
  const status = getVehicleExpiryStatus(vehicle.licence_expire_date, vehicle.licence_issued_date, vehicle.metadata);
  if (status.isExpired) {
    return { type: 'expired', text: 'License Expired' };
  } else if (status.isExpiring) {
    return { type: 'expiring', text: `License Expiring in ${status.diffDays} day${status.diffDays === 1 ? '' : 's'}` };
  }
  return null;
};


const StatusPill = ({ label, count, color, active, onClick }) => (
  <button
    onClick={onClick}
    style={{
      display: 'flex', alignItems: 'center', gap: '6px',
      padding: '6px 12px', borderRadius: '20px',
      border: active ? `2px solid ${color}` : '1px solid #e5e7eb',
      background: active ? `${color}15` : '#fff',
      cursor: 'pointer', fontSize: '12px', fontWeight: 700,
      color: active ? color : '#6b7280',
      transition: 'all 0.2s',
    }}
  >
    <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: color }} />
    {label}
    <span style={{ fontFamily: 'monospace', fontWeight: 800, color }}>{count}</span>
  </button>
);

const CustomerDashboard = ({ setAppVehicles }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { vehicles, loading, error, refetch } = useVehicles();
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [statusFilter, setStatusFilter] = useState(null);
  const [dismissedToastId, setDismissedToastId] = useState(null);

  // Reset dismissed toast when selecting a different vehicle
  useEffect(() => {
    if (selectedVehicle && selectedVehicle.id !== dismissedToastId) {
      setDismissedToastId(null);
    }
  }, [selectedVehicle, dismissedToastId]);

  // Sync vehicles up to App level
  React.useEffect(() => {
    if (vehicles && setAppVehicles) setAppVehicles(vehicles);
  }, [vehicles, setAppVehicles]);

  const getStatus = (v) => {
    if (!v.is_online) return 'offline';
    if ((v.current_speed || 0) > 0) return 'running';
    if (v.current_ignition) return 'idle';
    return 'parked';
  };

  const metrics = useMemo(() => {
    const m = { running: 0, idle: 0, parked: 0, offline: 0 };
    vehicles.forEach(v => m[getStatus(v)]++);
    return m;
  }, [vehicles]);

  const filtered = useMemo(() => {
    if (!statusFilter) return vehicles;
    return vehicles.filter(v => getStatus(v) === statusFilter);
  }, [vehicles, statusFilter]);

  const statusColors = { running: '#10b981', idle: '#f59e0b', parked: '#f97316', offline: '#ef4444' };
  const statusLabels = { running: 'Running', idle: 'Idle', parked: 'Parked', offline: 'Offline' };

  const currentSelected = useMemo(() => {
    if (!selectedVehicle) return null;
    return vehicles.find(v => v.id === selectedVehicle.id) || selectedVehicle;
  }, [vehicles, selectedVehicle]);

  const warning = currentSelected && dismissedToastId !== currentSelected.id ? getExpiryWarning(currentSelected) : null;


  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: 'calc(100vh - 56px)',
      fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
      background: '#f0f2f5', overflow: 'hidden', position: 'relative'
    }}>

      {/* ── Top Warning Toast ── */}
      <AnimatePresence>
        {warning && (
          <motion.div
            initial={{ opacity: 0, y: -50, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: -50, x: '-50%' }}
            style={{
              position: 'fixed',
              top: '80px',
              left: '50%',
              zIndex: 9999,
              background: warning.type === 'expired' ? '#FEF2F2' : '#FFFBEB',
              border: `2px solid ${warning.type === 'expired' ? '#FECACA' : '#FDE68A'}`,
              padding: '16px 24px',
              borderRadius: '16px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              minWidth: '400px'
            }}
          >
            <AlertTriangle size={32} color={warning.type === 'expired' ? '#EF4444' : '#F59E0B'} style={{ flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: '16px', color: warning.type === 'expired' ? '#991B1B' : '#B45309' }}>
                {warning.type === 'expired' ? 'License Expired!' : 'License Expiring Soon!'}
              </div>
              <div style={{ fontWeight: 600, fontSize: '14px', color: warning.type === 'expired' ? '#B91C1C' : '#D97706', marginTop: '2px' }}>
                {warning.text} for vehicle <span style={{ fontWeight: 800 }}>{currentSelected.name}</span>.
                <button
                  onClick={() => navigate('/renewals')}
                  style={{ marginLeft: '12px', padding: '6px 12px', background: warning.type === 'expired' ? '#EF4444' : '#F59E0B', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 700, cursor: 'pointer', fontSize: '12px' }}
                >
                  Renew Now
                </button>
              </div>
            </div>
            <button
              onClick={() => setDismissedToastId(currentSelected.id)}
              style={{
                background: warning.type === 'expired' ? '#FECACA' : '#FDE68A',
                border: 'none',
                width: '28px', height: '28px',
                borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer',
                flexShrink: 0,
                color: warning.type === 'expired' ? '#991B1B' : '#B45309'
              }}
            >
              <X size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Top Header Bar ── */}
      <div style={{
        background: '#fff', borderBottom: '1px solid #e5e7eb',
        padding: '12px 20px', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', flexShrink: 0,
        boxShadow: '0 1px 4px rgba(0,0,0,0.04)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: '10px',
            background: 'linear-gradient(135deg, #4d6076, #6e859b)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <MapPin size={18} color="#fff" />
          </div>
          <div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: '#111827' }}>
              {user?.name ? `${user.name}'s Dashboard` : 'Fleet Dashboard'}
            </div>
            <div style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 500 }}>
              {vehicles.length} vehicle{vehicles.length !== 1 ? 's' : ''} in your fleet
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Status filter pills */}
          {['running', 'idle', 'parked', 'offline'].map(s => (
            <StatusPill
              key={s} label={statusLabels[s]} count={metrics[s]}
              color={statusColors[s]} active={statusFilter === s}
              onClick={() => setStatusFilter(prev => prev === s ? null : s)}
            />
          ))}

          <div style={{
            padding: '6px 12px', borderRadius: '20px',
            background: '#f97316', color: '#fff',
            fontSize: '12px', fontWeight: 700, marginLeft: '4px'
          }}>
            Total {vehicles.length}
          </div>

          <button
            onClick={() => refetch()}
            style={{
              background: '#f9fafb', border: '1px solid #e5e7eb', color: '#6b7280',
              cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '7px',
              borderRadius: '8px', marginLeft: '4px'
            }}
            title="Refresh"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* ── Body: Vehicle List + Map ── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* Left Panel: Vehicle List */}
        <div style={{
          width: '280px', background: '#fff', borderRight: '1px solid #e5e7eb',
          display: 'flex', flexDirection: 'column', flexShrink: 0,
          boxShadow: '2px 0 8px rgba(0,0,0,0.04)'
        }}>
          <div style={{
            padding: '12px', borderBottom: '1px solid #f3f4f6',
            fontSize: '11px', fontWeight: 700, color: '#9ca3af',
            textTransform: 'uppercase', letterSpacing: '0.05em'
          }}>
            {filtered.length === vehicles.length
              ? `All Vehicles (${vehicles.length})`
              : `Filtered (${filtered.length} of ${vehicles.length})`}
            {statusFilter && (
              <button
                onClick={() => setStatusFilter(null)}
                style={{ marginLeft: '8px', fontSize: '10px', color: '#4d6076', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }}
              >Clear</button>
            )}
          </div>

          <div className="tracking-scroll" style={{ flex: 1, overflowY: 'auto', padding: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {loading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '8px', opacity: 0.5 }}>
                <RefreshCw size={18} color="#f97316" className="animate-spin" />
                <span style={{ fontSize: '12px', color: '#6b7280' }}>Loading...</span>
              </div>
            ) : error ? (
              <div style={{ padding: '20px', textAlign: 'center', opacity: 0.5 }}>
                <AlertCircle size={24} color="#ef4444" style={{ margin: '0 auto 8px' }} />
                <div style={{ fontSize: '12px', color: '#6b7280' }}>Failed to load vehicles</div>
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', opacity: 0.4, padding: '20px', textAlign: 'center' }}>
                <Truck size={28} color="#9ca3af" style={{ marginBottom: '8px' }} />
                <span style={{ fontSize: '12px', color: '#6b7280', fontWeight: 500 }}>
                  {vehicles.length === 0 ? 'No vehicles assigned to your groups' : 'No vehicles match the filter'}
                </span>
              </div>
            ) : (
              filtered.map(v => {
                const status = getStatus(v);
                const isSelected = currentSelected?.id === v.id;
                const sc = statusColors[status];
                return (
                  <div
                    key={v.id}
                    onClick={() => setSelectedVehicle(prev => prev?.id === v.id ? null : v)}
                    style={{
                      background: isSelected ? 'linear-gradient(135deg, #4d6076, #6e859b)' : '#fff',
                      border: `1px solid ${isSelected ? 'transparent' : '#f3f4f6'}`,
                      borderRadius: '10px', padding: '10px 12px',
                      cursor: 'pointer', transition: 'all 0.2s ease',
                    }}
                    onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = '#f9fafb'; }}
                    onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = '#fff'; }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: isSelected ? '#fff' : '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {v.name}
                        </div>
                        <div style={{ fontSize: '10px', color: isSelected ? 'rgba(255,255,255,0.7)' : '#9ca3af', marginTop: '2px' }}>
                          {v.plate || 'No plate'} · {formatSpeed(v.current_speed)}
                        </div>
                      </div>
                      <span style={{
                        fontSize: '10px', fontWeight: 700,
                        color: isSelected ? '#fff' : sc,
                        background: isSelected ? 'rgba(255,255,255,0.2)' : `${sc}15`,
                        padding: '3px 8px', borderRadius: '6px', flexShrink: 0, marginLeft: '8px'
                      }}>
                        {statusLabels[status]}
                      </span>
                    </div>
                    <div style={{ fontSize: '10px', color: isSelected ? 'rgba(255,255,255,0.55)' : '#9ca3af', marginTop: '4px' }}>
                      {getRelativeTime(v.last_seen)}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Map + optional vehicle detail */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          <FleetMap
            vehicles={filtered}
            selectedVehicles={currentSelected ? [currentSelected] : []}
            onMultiTrackClick={(v) => navigate(`/tracking?multitrack=${v.id}`)}
          />

        </div>
      </div>

      <style dangerouslySetInnerHTML={{
        __html: `
        .tracking-scroll::-webkit-scrollbar { width: 4px; }
        .tracking-scroll::-webkit-scrollbar-track { background: transparent; }
        .tracking-scroll::-webkit-scrollbar-thumb { background-color: #d1d5db; border-radius: 4px; }
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}} />
    </div>
  );
};

export default CustomerDashboard;
