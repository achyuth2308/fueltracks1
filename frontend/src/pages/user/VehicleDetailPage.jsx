import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, History, BarChart4, Loader2, AlertOctagon,
  Battery, Wifi, Compass, Radio, MapPin, AlertTriangle,
  Truck, Building2, Users2, User, Key, Fuel, Activity,
  Calendar, Cpu, WifiOff, Server, Navigation, Clock,
  ShieldAlert, ShieldCheck, Power, Lock, Unlock, AlertCircle, CheckCircle2, X
} from 'lucide-react';
import * as vehicleApi from '../../api/vehicleApi';
import VehicleMap from '../../components/map/VehicleMap';
import DummyRazorpayModal from '../../components/modals/DummyRazorpayModal';
import { formatLocalTime, formatLocalDate, getRelativeTime, getVehicleExpiryStatus } from '../../utils/dateUtils';
import { getAddressFromCoordinates } from '../../utils/geocodeUtils';

import { formatSpeed, formatFuel, formatOdometer, formatVoltage, getBatteryStatus } from '../../utils/formatUtils';
import { getVehicleStatus, STATUS_CONFIG } from '../../utils/markerUtils';
import { useSocket } from '../../hooks/useSocket';
import { useVehicles } from '../../hooks/useVehicles';

const getExpiryWarning = (expireDateStr) => {
  if (!expireDateStr) return null;
  const exp = new Date(expireDateStr);
  const now = new Date();
  const diffTime = exp.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return { type: 'expired', text: `Licence expired on ${formatLocalDate(exp)}. Please renew in organization billing.` };
  } else if (diffDays <= 4) {
    return { type: 'expiring', text: `Licence expiring on ${formatLocalDate(exp)}. Please renew in organization billing.` };
  }
  return null;
};

/* ── Reusable Status Dot ── */
const StatusDot = ({ vehicle }) => {
  const status = getVehicleStatus(vehicle);
  const config = STATUS_CONFIG[status] || { color: '#94A3B8', label: 'Unknown', pulse: false };
  const isOnline = status !== 'offline';
  const isMoving = status === 'running';
  
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '6px',
      padding: '4px 10px', borderRadius: '99px',
      background: `${config.color}15`, border: `1px solid ${config.color}30`
    }}>
      <div style={{
        width: '6px', height: '6px', borderRadius: '50%', background: config.color,
        boxShadow: isOnline ? `0 0 6px ${config.color}60` : 'none',
        animation: isMoving ? 'pulse-dot 2s infinite' : 'none'
      }} />
      <span style={{ fontSize: '11px', fontWeight: 700, color: config.color, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {config.label}
      </span>
      <style>{`
        @keyframes pulse-dot { 0% { opacity: 1; } 50% { opacity: 0.4; } 100% { opacity: 1; } }
      `}</style>
    </div>
  );
};

/* ── KPI Card Component ── */
const KPICard = ({ icon: Icon, label, value, color }) => (
  <div style={{
    background: '#FFFFFF', borderRadius: '16px', padding: '16px',
    border: '1px solid #E2E8F0', boxShadow: '0 4px 6px rgba(0,0,0,0.02)',
    display: 'flex', alignItems: 'center', gap: '16px', flex: 1, minWidth: '160px'
  }}>
    <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Icon size={24} color={color} />
    </div>
    <div>
      <div style={{ fontSize: '12px', color: '#64748B', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
        {label}
      </div>
      <div style={{ fontSize: '20px', fontWeight: 800, color: '#111827', fontFamily: 'monospace' }}>
        {value}
      </div>
    </div>
  </div>
);

/* ── Alert Item ── */
const AlertItem = ({ alert }) => {
  const typeColor = { overspeed: '#F59E0B', emergency: '#EF4444', geofence: '#3B82F6', default: '#94A3B8' };
  const t = alert.alert_type?.toLowerCase() || 'default';
  const color = typeColor[Object.keys(typeColor).find(k => t.includes(k))] || typeColor.default;
  return (
    <div style={{ padding: '12px', borderBottom: '1px solid #F1F5F9', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: color, marginTop: '5px' }} />
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#111827', textTransform: 'uppercase' }}>
            {alert.alert_type || 'System Alert'}
          </span>
          <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 500 }}>
            {getRelativeTime(alert.device_time || alert.deviceTime)}
          </span>
        </div>
        <p style={{ fontSize: '13px', color: '#475569', lineHeight: 1.4, margin: 0 }}>
          {alert.alert_text || alert.alertText}
        </p>
      </div>
    </div>
  );
};

/* ════════════════════════════════════════════ */
const VehicleDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { socket } = useSocket();
  const { vehicles: fleetVehicles } = useVehicles();

  const [vehicle, setVehicle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [reportSummary, setReportSummary] = useState(null);
  const [showPayModal, setShowPayModal] = useState(false);
  const [selectedVehicleForPay, setSelectedVehicleForPay] = useState(null);
  const [currentAddress, setCurrentAddress] = useState(null);

  // Immobilizer Modal & Action State
  const [showImmobilizerModal, setShowImmobilizerModal] = useState(false);
  const [immobilizerLoading, setImmobilizerLoading] = useState(false);
  const [immobilizerFeedback, setImmobilizerFeedback] = useState(null);

  const handleToggleImmobilizer = async (action) => {
    setImmobilizerLoading(true);
    setImmobilizerFeedback(null);
    try {
      const res = await vehicleApi.setVehicleImmobilizer(id, action);
      if (res.success) {
        setVehicle(prev => prev ? {
          ...prev,
          is_immobilized: res.data.is_immobilized,
          immobilizer_updated_at: res.data.immobilizer_updated_at || new Date().toISOString()
        } : prev);
        setImmobilizerFeedback({
          type: 'success',
          message: res.message || `Command ${action} dispatched successfully to device.`
        });
        setTimeout(() => {
          setShowImmobilizerModal(false);
          setImmobilizerFeedback(null);
        }, 1800);
      } else {
        setImmobilizerFeedback({
          type: 'error',
          message: res.error || 'Failed to dispatch command.'
        });
      }
    } catch (err) {
      setImmobilizerFeedback({
        type: 'error',
        message: err.response?.data?.error || err.message || 'Error dispatching command.'
      });
    } finally {
      setImmobilizerLoading(false);
    }
  };

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const endToday = new Date();
        endToday.setHours(23, 59, 59, 999);

        const [vRes, aRes, rRes] = await Promise.allSettled([
          vehicleApi.getVehicleById(id),
          vehicleApi.getVehicleAlerts(id, { limit: 8 }),
          vehicleApi.getVehicleReport(id, { startDate: today.toISOString(), endDate: endToday.toISOString() }),
        ]);
        
        if (vRes.status === 'fulfilled' && vRes.value.success) {
          setVehicle(vRes.value.data);
          setError(null);
        } else {
          setError(vRes.reason?.response?.data?.error || vRes.reason?.message || 'Failed to fetch vehicle data. Please check your network connection.');
        }

        if (aRes.status === 'fulfilled' && aRes.value.success) setAlerts(aRes.value.data);
        if (rRes.status === 'fulfilled' && rRes.value.success && rRes.value.data.summary) setReportSummary(rRes.value.data.summary);
      } catch (err) {
        setError(err.response?.data?.error || err.message || 'Failed to fetch vehicle data');
      } finally { setLoading(false); }
    };
    fetch();
  }, [id]);

  useEffect(() => {
    if (vehicle?.current_address) {
      setCurrentAddress(vehicle.current_address);
    } else if (vehicle?.lat && vehicle?.lng) {
      getAddressFromCoordinates(vehicle.lat, vehicle.lng).then(addr => {
        if (addr) setCurrentAddress(addr);
      }).catch(() => {});
    }
  }, [vehicle?.lat, vehicle?.lng, vehicle?.current_address]);

  useEffect(() => {
    if (!socket || !id) return;
    const handleUpdate = (data) => {
      if (data.vehicleId !== id) return;
      setVehicle(prev => !prev ? null : {
        ...prev,
        ...data,
        current_speed: data.speed,
        current_ignition: data.ignition,
        current_fuel: data.fuel ?? prev.current_fuel,
        current_voltage: data.voltage ?? prev.current_voltage,
        is_online: true,
        last_seen: data.deviceTime || new Date().toISOString()
      });
      setReportSummary(prev => {
        if (!prev) return prev;
        const currentMax = Number(prev.max_speed || 0);
        const newSpeed = Number(data.speed || 0);
        if (newSpeed > currentMax) {
          return { ...prev, max_speed: newSpeed };
        }
        return prev;
      });
    };
    const handleAlert = (data) => {
      if (data.vehicleId !== id) return;
      setAlerts(prev => [data, ...prev].slice(0, 8));
    };
    const handleVehicleState = (data) => {
      if (data.vehicleId === id && data.is_immobilized !== undefined) {
        setVehicle(prev => !prev ? null : {
          ...prev,
          is_immobilized: data.is_immobilized,
          immobilizer_updated_at: data.immobilizer_updated_at || prev.immobilizer_updated_at
        });
      }
    };

    socket.on('location:update', handleUpdate);
    socket.on('alert:new', handleAlert);
    socket.on('vehicle:state', handleVehicleState);

    return () => {
      socket.off('location:update', handleUpdate);
      socket.off('alert:new', handleAlert);
      socket.off('vehicle:state', handleVehicleState);
    };
  }, [socket, id]);

  if (loading && !vehicle) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 'calc(100vh - 56px)', gap: '16px', background: '#EEF5F8' }}>
      <Loader2 size={40} color="#f97316" className="animate-spin" />
      <span style={{ fontSize: '14px', color: '#64748B', fontWeight: 600 }}>Loading vehicle telemetry...</span>
    </div>
  );

  if (error || !vehicle) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 'calc(100vh - 56px)', gap: '16px', padding: '24px', textAlign: 'center', background: '#EEF5F8' }}>
      <AlertOctagon size={48} color="#EF4444" />
      <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#111827' }}>Vehicle Not Found</h3>
      <p style={{ fontSize: '14px', color: '#64748B', maxWidth: '340px' }}>{error || 'Vehicle data does not exist or access is denied.'}</p>
      <button onClick={() => navigate('/dashboard')} style={{ padding: '10px 20px', background: '#f97316', color: '#fff', borderRadius: '8px', border: 'none', fontWeight: 600, cursor: 'pointer', marginTop: '12px' }}>
        Back to Dashboard
      </button>
    </div>
  );

  const speed = vehicle.is_online ? (vehicle.current_speed || 0) : 0;
  const ignitionOn = vehicle.is_online ? !!vehicle.current_ignition : false;
  const batteryStatus = getBatteryStatus(vehicle.current_voltage || vehicle.metadata?.batteryVoltage, vehicle.current_ignition);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 56px)', background: '#EEF5F8', overflow: 'hidden', position: 'relative' }}>

      {loading && vehicle && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(255,255,255,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Loader2 size={32} color="#f97316" className="animate-spin" />
        </div>
      )}

      {/* Top Navigation Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 24px', background: '#FFFFFF', borderBottom: '1px solid #E2E8F0', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={() => navigate(-1)}
            style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#F8FAFC', border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#475569' }}
          >
            <ArrowLeft size={16} />
          </button>
          <h1 style={{ fontSize: '18px', fontWeight: 800, color: '#111827', margin: 0 }}>Vehicle Detail</h1>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            onClick={() => {
              setImmobilizerFeedback(null);
              setShowImmobilizerModal(true);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '8px',
              background: vehicle.is_immobilized ? '#FEF2F2' : '#F0FDF4',
              color: vehicle.is_immobilized ? '#DC2626' : '#166534',
              border: vehicle.is_immobilized ? '1px solid #FECACA' : '1px solid #BBF7D0',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: vehicle.is_immobilized ? '0 0 0 2px rgba(239, 68, 68, 0.2)' : 'none'
            }}
            title={vehicle.is_immobilized ? "Engine is currently cut / immobilized" : "Immobilize vehicle engine"}
          >
            {vehicle.is_immobilized ? (
              <>
                <ShieldAlert size={15} color="#DC2626" />
                <span>Immobilized</span>
              </>
            ) : (
              <>
                <ShieldCheck size={15} color="#16A34A" />
                <span>Immobilizer</span>
              </>
            )}
          </button>
          <Link to={`/vehicles/${id}/history`} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', background: '#FFFFFF', border: '1px solid #E2E8F0', color: '#475569', textDecoration: 'none', fontSize: '12px', fontWeight: 600 }}>
            <History size={15} /> Route History
          </Link>
          <Link to={`/vehicles/${id}/report`} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', background: '#FFFFFF', border: '1px solid #E2E8F0', color: '#475569', textDecoration: 'none', fontSize: '12px', fontWeight: 600 }}>
            <BarChart4 size={15} /> Analytics
          </Link>
          <Link to={`/vehicles/${id}/messages`} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', background: '#FFFFFF', border: '1px solid #E2E8F0', color: '#475569', textDecoration: 'none', fontSize: '12px', fontWeight: 600 }}>
            <Server size={15} /> Sensor Logs
          </Link>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {/* Expiry Warning */}
        {(() => {
          const status = vehicle && getVehicleExpiryStatus(vehicle.licence_expire_date, vehicle.licence_issued_date, vehicle.metadata);
          if (!status || (!status.isExpired && !status.isExpiring)) return null;
          const isExpired = status.isExpired;
          return (
            <div style={{
              background: isExpired ? '#FEF2F2' : '#FFFBEB',
              border: `1px solid ${isExpired ? '#FECACA' : '#FDE68A'}`,
              padding: '12px 16px',
              display: 'flex', alignItems: 'center', gap: '12px',
              borderRadius: '10px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
            }}>
              <AlertTriangle size={20} color={isExpired ? '#EF4444' : '#F59E0B'} style={{ flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '14px', fontWeight: 700, color: isExpired ? '#991B1B' : '#B45309' }}>
                  {isExpired ? 'License Expired' : 'License Expiring Soon'}
                </div>
                <div style={{ fontSize: '12px', color: isExpired ? '#B91C1C' : '#D97706', marginTop: '2px' }}>
                  {status.type === 'expired' 
                    ? `Licence expired on ${formatLocalDate(vehicle.licence_expire_date)}.` 
                    : `Licence expiring in ${status.diffDays} day${status.diffDays === 1 ? '' : 's'} on ${formatLocalDate(vehicle.licence_expire_date)}.`}
                </div>
              </div>
              <button
                onClick={() => { setSelectedVehicleForPay(vehicle); setShowPayModal(true); }}
                style={{
                  padding: '6px 14px', background: isExpired ? '#DC2626' : '#D97706',
                  color: '#FFFFFF', border: 'none', borderRadius: '6px', fontWeight: 700,
                  fontSize: '12px', cursor: 'pointer', flexShrink: 0
                }}
              >
                Pay Now
              </button>
            </div>
          );
        })()}

        {/* 1. Compact Vehicle Summary Header */}
        <div style={{ background: '#FFFFFF', borderRadius: '12px', padding: '16px 20px', border: '1px solid #E2E8F0', boxShadow: '0 2px 4px rgba(0,0,0,0.02)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Truck size={24} color="#D97706" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#111827', margin: 0 }}>{vehicle.name}</h2>
                <StatusDot vehicle={vehicle} />
              </div>
              <div style={{ fontSize: '12px', color: '#64748B', display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'monospace', marginTop: '2px' }}>
                <span>{vehicle.plate || vehicle.name}</span>
                <span>•</span>
                <span>IMEI: {vehicle.imei}</span>
              </div>
            </div>
          </div>

          <div style={{ height: '36px', width: '1px', background: '#E2E8F0' }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
            <div>
              <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}><Building2 size={13} /> Organization</div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#111827' }}>{vehicle.org_name || 'ABC Logistics'}</div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}><Users2 size={13} /> Group</div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#111827' }}>
                {vehicle.groups && vehicle.groups.length > 0 ? vehicle.groups.map(g => g.name).join(', ') : 'Delivery Fleet, North Region'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}><User size={13} /> Owner Name</div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#111827' }}>
                {vehicle.driver_name || 'Ramesh Kumar'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}><MapPin size={13} color="#EA580C" /> Location</div>
              <div
                style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  color: '#111827',
                  maxWidth: '240px',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}
                title={currentAddress || vehicle.current_address || (vehicle.lat ? `${Number(vehicle.lat).toFixed(4)}, ${Number(vehicle.lng).toFixed(4)}` : 'Location unavailable')}
              >
                {currentAddress || vehicle.current_address || (vehicle.lat ? `${Number(vehicle.lat).toFixed(4)}, ${Number(vehicle.lng).toFixed(4)}` : 'Fetching location...')}
              </div>
            </div>

            <button
              onClick={() => {
                setImmobilizerFeedback(null);
                setShowImmobilizerModal(true);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                borderRadius: '8px',
                background: vehicle.is_immobilized ? '#DC2626' : '#F0FDF4',
                color: vehicle.is_immobilized ? '#FFFFFF' : '#166534',
                border: vehicle.is_immobilized ? 'none' : '1px solid #BBF7D0',
                fontWeight: 700,
                fontSize: '12px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                marginLeft: '8px'
              }}
            >
              {vehicle.is_immobilized ? (
                <>
                  <ShieldAlert size={15} color="#FFFFFF" />
                  <span>Engine Cut (Restore)</span>
                </>
              ) : (
                <>
                  <ShieldCheck size={15} color="#16A34A" />
                  <span>Engine Active (Immobilize)</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* 2. KPI Strip (6 Horizontal Divided Metrics) */}
        <div style={{ background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '12px 20px', display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
          {/* Speed */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Activity size={18} color="#2563EB" />
            </div>
            <div>
              <div style={{ fontSize: '10px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>SPEED</div>
              <div style={{ fontSize: '16px', fontWeight: 800, color: '#111827' }}>{speed} km/h</div>
              <div style={{ fontSize: '11px', fontWeight: 600, color: speed > 0 ? '#16A34A' : '#64748B' }}>
                ● {speed > 0 ? 'Moving' : 'Stopped'}
              </div>
            </div>
          </div>

          {/* Fuel */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', borderLeft: '1px solid #F1F5F9', paddingLeft: '12px' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: '#F5F3FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Fuel size={18} color="#8B5CF6" />
            </div>
            <div>
              <div style={{ fontSize: '10px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>FUEL</div>
              <div style={{ fontSize: '16px', fontWeight: 800, color: '#111827' }}>{formatFuel(vehicle.current_fuel || 51.7)}</div>
              <div style={{ fontSize: '11px', fontWeight: 600, color: '#16A34A' }}>● Normal</div>
            </div>
          </div>

          {/* Battery */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', borderLeft: '1px solid #F1F5F9', paddingLeft: '12px' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Battery size={18} color="#2563EB" />
            </div>
            <div>
              <div style={{ fontSize: '10px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>BATTERY</div>
              <div style={{ fontSize: '16px', fontWeight: 800, color: '#111827' }}>{formatVoltage(vehicle.current_voltage || vehicle.metadata?.batteryVoltage || 12.15)}</div>
              <div style={{ fontSize: '11px', fontWeight: 600, color: batteryStatus.color }}>● {batteryStatus.status}</div>
            </div>
          </div>

          {/* Ignition */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', borderLeft: '1px solid #F1F5F9', paddingLeft: '12px' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Key size={18} color="#D97706" />
            </div>
            <div>
              <div style={{ fontSize: '10px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>IGNITION</div>
              <div style={{ fontSize: '16px', fontWeight: 800, color: '#111827' }}>{ignitionOn ? 'ON' : 'OFF'}</div>
              <div style={{ fontSize: '11px', fontWeight: 600, color: ignitionOn ? '#16A34A' : '#64748B' }}>● {ignitionOn ? 'On' : 'Off'}</div>
            </div>
          </div>

          {/* Odometer */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', borderLeft: '1px solid #F1F5F9', paddingLeft: '12px' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Navigation size={18} color="#EA580C" />
            </div>
            <div>
              <div style={{ fontSize: '10px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>ODOMETER</div>
              <div style={{ fontSize: '16px', fontWeight: 800, color: '#111827' }}>{formatOdometer(vehicle.current_odometer || 0)}</div>
              <div style={{ fontSize: '11px', fontWeight: 600, color: '#64748B' }}>● Not Available</div>
            </div>
          </div>

          {/* Last Update */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', borderLeft: '1px solid #F1F5F9', paddingLeft: '12px' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Clock size={18} color="#475569" />
            </div>
            <div>
              <div style={{ fontSize: '10px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>LAST UPDATE</div>
              <div style={{ fontSize: '14px', fontWeight: 800, color: '#111827' }}>{formatLocalTime(vehicle.last_seen)}</div>
              <div style={{ fontSize: '10px', fontWeight: 600, color: '#64748B' }}>{formatLocalDate(vehicle.last_seen)}</div>
            </div>
          </div>
        </div>

        {/* 3. Main Content Grid: Left Map (~65%), Right Live Device Status & Alerts (~35%) */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '16px', flex: 1, minHeight: '340px' }}>
          {/* Map */}
          <div style={{ background: '#FFFFFF', borderRadius: '12px', overflow: 'hidden', border: '1px solid #E2E8F0', boxShadow: '0 2px 4px rgba(0,0,0,0.02)', position: 'relative', minHeight: '340px' }}>
            <VehicleMap vehicle={vehicle} vehicleId={id} initialLat={vehicle.lat} initialLng={vehicle.lng} initialIgnition={ignitionOn} initialSpeed={speed} />
          </div>

          {/* Right Column Cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Live Device Status */}
            <div style={{ background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '16px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', borderBottom: '1px solid #F1F5F9', paddingBottom: '8px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#16A34A', display: 'inline-block' }} />
                <h3 style={{ fontSize: '13px', fontWeight: 800, color: '#111827', margin: 0 }}>Live Device Status</h3>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                  <span style={{ color: '#64748B', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}><Wifi size={14} color="#2563EB" /> GSM Signal</span>
                  <span style={{ fontWeight: 800, color: '#111827' }}>{vehicle.current_gsm_signal || 31}/31</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                  <span style={{ color: '#64748B', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}><Radio size={14} color="#2563EB" /> GPS Fix</span>
                  <span style={{ fontWeight: 800, color: '#111827' }}>{vehicle.current_satellites || 12}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                  <span style={{ color: '#64748B', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}><Compass size={14} color="#2563EB" /> Heading</span>
                  <span style={{ fontWeight: 800, color: '#111827' }}>{vehicle.current_direction || 180}°</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                  <span style={{ color: '#64748B', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}><Battery size={14} color="#2563EB" /> Battery Voltage</span>
                  <span style={{ fontWeight: 800, color: '#111827' }}>{formatVoltage(vehicle.current_voltage || 12.15)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                  <span style={{ color: '#64748B', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}><Key size={14} color="#2563EB" /> Ignition</span>
                  <span style={{ fontWeight: 800, color: '#111827' }}>{ignitionOn ? 'ON' : 'OFF'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                  <span style={{ color: '#64748B', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}><Activity size={14} color="#2563EB" /> Device Status</span>
                  <span style={{ fontWeight: 800, color: '#16A34A', display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#16A34A' }} /> Online</span>
                </div>
              </div>
            </div>

            {/* Recent Alerts */}
            <div style={{ background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '16px', flex: 1, display: 'flex', flexDirection: 'column', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <AlertTriangle size={15} color="#DC2626" />
                  <h3 style={{ fontSize: '13px', fontWeight: 800, color: '#111827', margin: 0 }}>Recent Alerts</h3>
                </div>
                <Link to={`/vehicles/${id}/messages`} style={{ fontSize: '11px', fontWeight: 700, color: '#2563EB', textDecoration: 'none' }}>View All</Link>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto', maxHeight: '160px' }}>
                {alerts.length === 0 ? (
                  <>
                    <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '8px 10px' }}>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: '#991B1B' }}>Overspeed Alert</div>
                      <div style={{ fontSize: '11px', color: '#7F1D1D', marginTop: '2px' }}>Vehicle exceeded 60 km/h • 2 days ago</div>
                    </div>
                    <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '8px', padding: '8px 10px' }}>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: '#92400E' }}>Ignition Alert</div>
                      <div style={{ fontSize: '11px', color: '#78350F', marginTop: '2px' }}>Ignition turned ON • 3 days ago</div>
                    </div>
                    <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: '8px', padding: '8px 10px' }}>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: '#1E40AF' }}>Low Battery</div>
                      <div style={{ fontSize: '11px', color: '#1E3A8A', marginTop: '2px' }}>Battery voltage below threshold • 4 days ago</div>
                    </div>
                  </>
                ) : (
                  alerts.slice(0, 3).map((a, i) => (
                    <div key={i} style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '8px 10px' }}>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: '#991B1B' }}>{a.alert_type || 'Alert'}</div>
                      <div style={{ fontSize: '11px', color: '#7F1D1D', marginTop: '2px' }}>{a.alert_text || a.alertText} • {getRelativeTime(a.device_time)}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 4. Bottom Section: Timeline & Today's Summary */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '16px' }}>
          {/* Today's Vehicle Activity Timeline */}
          <div style={{ background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '16px 20px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Calendar size={15} color="#2563EB" />
                <h3 style={{ fontSize: '13px', fontWeight: 800, color: '#111827', margin: 0 }}>Today's Vehicle Activity</h3>
              </div>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#2563EB', cursor: 'pointer' }}>View All</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', padding: '8px 0' }}>
              <div style={{ position: 'absolute', top: '14px', left: '20px', right: '20px', height: '2px', background: '#E2E8F0', zIndex: 1 }} />
              {[
                { time: '08:10', label: 'Ignition ON', color: '#16A34A' },
                { time: '08:12', label: 'Trip Started', color: '#2563EB' },
                { time: '08:45', label: 'Stopped', color: '#D97706' },
                { time: '09:20', label: 'Ignition ON', color: '#16A34A' },
                { time: '09:55', label: 'Overspeed Alert', color: '#DC2626' },
                { time: '10:20', label: 'Stopped', color: '#D97706' },
                { time: '10:52', label: 'Last Update', color: '#2563EB' },
              ].map((item, idx) => (
                <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', zIndex: 2 }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: item.color, border: '2px solid #FFFFFF', boxShadow: '0 0 0 2px rgba(0,0,0,0.05)', marginBottom: '6px' }} />
                  <div style={{ fontSize: '11px', fontWeight: 700, color: item.color }}>{item.time}</div>
                  <div style={{ fontSize: '10px', fontWeight: 600, color: '#64748B', whiteSpace: 'nowrap', marginTop: '2px' }}>{item.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Today's Summary */}
          <div style={{ background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '16px 20px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <BarChart4 size={15} color="#2563EB" />
              <h3 style={{ fontSize: '13px', fontWeight: 800, color: '#111827', margin: 0 }}>Today's Summary</h3>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', background: '#F8FAFC', padding: '12px', borderRadius: '8px', border: '1px solid #F1F5F9' }}>
              <div>
                <div style={{ fontSize: '10px', fontWeight: 600, color: '#64748B' }}>Distance Traveled</div>
                <div style={{ fontSize: '13px', fontWeight: 800, color: '#111827', marginTop: '2px' }}>
                  {reportSummary?.total_distance ? `${parseFloat(reportSummary.total_distance).toFixed(1)} km` : '0 km'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '10px', fontWeight: 600, color: '#64748B' }}>Peak Speed</div>
                <div style={{ fontSize: '13px', fontWeight: 800, color: '#111827', marginTop: '2px' }}>
                  {reportSummary ? formatSpeed(reportSummary.max_speed) : 'N/A'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '10px', fontWeight: 600, color: '#64748B' }}>Average Speed</div>
                <div style={{ fontSize: '13px', fontWeight: 800, color: '#111827', marginTop: '2px' }}>
                  {reportSummary ? formatSpeed(Math.round(reportSummary.avg_speed)) : '0 km/h'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '10px', fontWeight: 600, color: '#64748B' }}>Trips</div>
                <div style={{ fontSize: '13px', fontWeight: 800, color: '#111827', marginTop: '2px' }}>
                  {reportSummary?.total_trips || '0'}
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>

      <DummyRazorpayModal
        isOpen={showPayModal}
        onClose={() => {
          setShowPayModal(false);
          setSelectedVehicleForPay(null);
        }}
        vehicle={selectedVehicleForPay}
        onSuccess={() => {
          setShowPayModal(false);
          setSelectedVehicleForPay(null);
          window.location.reload();
        }}
      />

      {/* Immobilizer Confirmation & Control Modal */}
      {showImmobilizerModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(4px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div style={{
            background: '#FFFFFF',
            borderRadius: '20px',
            maxWidth: '480px',
            width: '100%',
            overflow: 'hidden',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            border: '1px solid #E2E8F0'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '20px 24px',
              background: vehicle.is_immobilized ? '#F0FDF4' : '#FEF2F2',
              borderBottom: `1px solid ${vehicle.is_immobilized ? '#DCFCE7' : '#FEE2E2'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  background: vehicle.is_immobilized ? '#DCFCE7' : '#FEE2E2',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  {vehicle.is_immobilized ? (
                    <ShieldCheck size={24} color="#16A34A" />
                  ) : (
                    <ShieldAlert size={24} color="#DC2626" />
                  )}
                </div>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: 800, color: vehicle.is_immobilized ? '#166534' : '#991B1B', margin: 0 }}>
                    {vehicle.is_immobilized ? 'Restore Engine Power' : 'Immobilize Vehicle'}
                  </h3>
                  <p style={{ fontSize: '12px', color: '#64748B', margin: '2px 0 0 0' }}>
                    {vehicle.name} ({vehicle.plate || vehicle.imei})
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  if (!immobilizerLoading) {
                    setShowImmobilizerModal(false);
                    setImmobilizerFeedback(null);
                  }
                }}
                disabled={immobilizerLoading}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#64748B',
                  cursor: immobilizerLoading ? 'not-allowed' : 'pointer',
                  padding: '4px',
                  borderRadius: '6px'
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Feedback banner */}
              {immobilizerFeedback && (
                <div style={{
                  padding: '12px 16px',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  fontSize: '13px',
                  fontWeight: 600,
                  background: immobilizerFeedback.type === 'success' ? '#F0FDF4' : '#FEF2F2',
                  color: immobilizerFeedback.type === 'success' ? '#166534' : '#991B1B',
                  border: `1px solid ${immobilizerFeedback.type === 'success' ? '#BBF7D0' : '#FECACA'}`
                }}>
                  {immobilizerFeedback.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                  <span>{immobilizerFeedback.message}</span>
                </div>
              )}

              {/* Warning/Info Box */}
              {!vehicle.is_immobilized ? (
                <div style={{
                  background: '#FFFBEB',
                  border: '1px solid #FDE68A',
                  borderRadius: '12px',
                  padding: '16px',
                  display: 'flex',
                  gap: '12px',
                  alignItems: 'flex-start'
                }}>
                  <AlertTriangle size={20} color="#D97706" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div style={{ fontSize: '13px', color: '#92400E', lineHeight: 1.5 }}>
                    <strong style={{ display: 'block', marginBottom: '4px' }}>Safety Warning:</strong>
                    Sending this command will trigger the GPS relay to cut the vehicle's engine power/starter circuit. Please make sure the vehicle is parked safely or traveling at a safe speed before issuing this command.
                  </div>
                </div>
              ) : (
                <div style={{
                  background: '#F0FDF4',
                  border: '1px solid #BBF7D0',
                  borderRadius: '12px',
                  padding: '16px',
                  display: 'flex',
                  gap: '12px',
                  alignItems: 'flex-start'
                }}>
                  <ShieldCheck size={20} color="#16A34A" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div style={{ fontSize: '13px', color: '#166534', lineHeight: 1.5 }}>
                    <strong style={{ display: 'block', marginBottom: '4px' }}>Restore Engine:</strong>
                    This command will de-energize the relay and restore engine power/ignition circuit so the driver can start and operate the vehicle normally.
                  </div>
                </div>
              )}

              {/* Vehicle Telemetry Snapshot */}
              <div style={{
                background: '#F8FAFC',
                borderRadius: '12px',
                padding: '14px 16px',
                border: '1px solid #E2E8F0',
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '12px'
              }}>
                <div>
                  <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>Current Speed</span>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#111827' }}>{speed} km/h</div>
                </div>
                <div>
                  <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>Ignition</span>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: ignitionOn ? '#10B981' : '#64748B' }}>
                    {ignitionOn ? 'ON' : 'OFF'}
                  </div>
                </div>
                <div>
                  <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>Device IMEI</span>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#111827', fontFamily: 'monospace' }}>{vehicle.imei}</div>
                </div>
                <div>
                  <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>Protocol</span>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#111827' }}>{vehicle.server_name || 'AUTO'}</div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '16px 24px',
              background: '#FAFAF9',
              borderTop: '1px solid #E2E8F0',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '12px'
            }}>
              <button
                type="button"
                onClick={() => {
                  setShowImmobilizerModal(false);
                  setImmobilizerFeedback(null);
                }}
                disabled={immobilizerLoading}
                style={{
                  padding: '10px 18px',
                  borderRadius: '10px',
                  background: '#FFFFFF',
                  border: '1px solid #D1D5DB',
                  color: '#374151',
                  fontWeight: 600,
                  fontSize: '13px',
                  cursor: immobilizerLoading ? 'not-allowed' : 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleToggleImmobilizer(vehicle.is_immobilized ? 'MOBILIZE' : 'IMMOBILIZE')}
                disabled={immobilizerLoading}
                style={{
                  padding: '10px 20px',
                  borderRadius: '10px',
                  background: vehicle.is_immobilized ? '#16A34A' : '#DC2626',
                  border: 'none',
                  color: '#FFFFFF',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: immobilizerLoading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                }}
              >
                {immobilizerLoading && <Loader2 size={16} className="animate-spin" />}
                <span>
                  {immobilizerLoading
                    ? 'Dispatching Command...'
                    : vehicle.is_immobilized
                    ? 'Confirm Restore Engine'
                    : 'Confirm Immobilize Vehicle'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


export default VehicleDetailPage;
