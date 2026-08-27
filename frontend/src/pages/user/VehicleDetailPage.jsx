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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', background: '#FFFFFF', borderBottom: '1px solid #E2E8F0', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button
            onClick={() => navigate('/admin/vehicles')}
            style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#F8FAFC', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#475569' }}
          >
            <ArrowLeft size={18} />
          </button>
          <h1 style={{ fontSize: '20px', fontWeight: 800, color: '#111827', margin: 0 }}>Vehicle Detail</h1>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button
            onClick={() => {
              setImmobilizerFeedback(null);
              setShowImmobilizerModal(true);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 16px',
              borderRadius: '8px',
              background: vehicle.is_immobilized ? '#FEF2F2' : '#F8FAFC',
              color: vehicle.is_immobilized ? '#DC2626' : '#475569',
              border: vehicle.is_immobilized ? '1px solid #FECACA' : '1px solid #E2E8F0',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: vehicle.is_immobilized ? '0 0 0 2px rgba(239, 68, 68, 0.2)' : 'none',
              transition: 'all 0.2s'
            }}
            title={vehicle.is_immobilized ? "Engine is currently cut / immobilized" : "Immobilize vehicle engine"}
          >
            {vehicle.is_immobilized ? (
              <>
                <ShieldAlert size={16} color="#DC2626" />
                <span>Immobilized</span>
              </>
            ) : (
              <>
                <ShieldCheck size={16} color="#10B981" />
                <span>Immobilizer</span>
              </>
            )}
          </button>
          <Link to={`/vehicles/${id}/history`} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', borderRadius: '8px', background: '#F8FAFC', color: '#475569', textDecoration: 'none', fontSize: '13px', fontWeight: 600 }}>
            <History size={16} /> Route History
          </Link>
          <Link to={`/vehicles/${id}/report`} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', borderRadius: '8px', background: '#F8FAFC', color: '#475569', textDecoration: 'none', fontSize: '13px', fontWeight: 600 }}>
            <BarChart4 size={16} /> Analytics
          </Link>
          <Link to={`/vehicles/${id}/messages`} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', borderRadius: '8px', background: '#F8FAFC', color: '#475569', textDecoration: 'none', fontSize: '13px', fontWeight: 600 }}>
            <Server size={16} /> Sensor Logs
          </Link>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>

        {/* Expiry Warning */}
        {(() => {
          const status = vehicle && getVehicleExpiryStatus(vehicle.licence_expire_date, vehicle.licence_issued_date, vehicle.metadata);
          if (!status || (!status.isExpired && !status.isExpiring)) return null;
          const isExpired = status.isExpired;
          return (
            <div style={{
              background: isExpired ? '#FEF2F2' : '#FFFBEB',
              border: `1px solid ${isExpired ? '#FECACA' : '#FDE68A'}`,
              padding: '16px 20px',
              display: 'flex', alignItems: 'center', gap: '12px',
              borderRadius: '12px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
            }}>
              <AlertTriangle size={24} color={isExpired ? '#EF4444' : '#F59E0B'} style={{ flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '15px', fontWeight: 700, color: isExpired ? '#991B1B' : '#B45309' }}>
                  {isExpired ? 'License Expired' : 'License Expiring Soon'}
                </div>
                <div style={{ fontSize: '14px', color: isExpired ? '#B91C1C' : '#D97706', marginTop: '2px' }}>
                  {status.type === 'expired' 
                    ? `Licence expired on ${formatLocalDate(vehicle.licence_expire_date)}.` 
                    : `Licence expiring in ${status.diffDays} day${status.diffDays === 1 ? '' : 's'} on ${formatLocalDate(vehicle.licence_expire_date)}.`}
                </div>
              </div>
              <button
                onClick={() => { setSelectedVehicleForPay(vehicle); setShowPayModal(true); }}
                style={{
                  padding: '8px 16px', background: isExpired ? '#DC2626' : '#D97706',
                  color: '#FFFFFF', border: 'none', borderRadius: '8px', fontWeight: 700,
                  fontSize: '13px', cursor: 'pointer', flexShrink: 0,
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                }}
              >
                Pay Now
              </button>
            </div>
          );
        })()}



        {/* 1. Vehicle Summary Card */}
        <div style={{ background: '#FFFFFF', borderRadius: '16px', padding: '24px', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px rgba(0,0,0,0.02)', display: 'flex', flexWrap: 'wrap', gap: '24px', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px', minWidth: '300px' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '16px', background: '#EEF5F8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Truck size={32} color="#f97316" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
                <h2 style={{ fontSize: '24px', fontWeight: 800, color: '#111827', margin: 0 }}>{vehicle.name}</h2>
                <StatusDot vehicle={vehicle} />
              </div>
              <div style={{ fontSize: '14px', color: '#64748B', display: 'flex', alignItems: 'center', gap: '12px', fontFamily: 'monospace' }}>
                <span>{vehicle.plate || vehicle.name}</span>
                <span>•</span>
                <span>IMEI: {vehicle.imei}</span>
              </div>
            </div>
          </div>

          <div style={{ width: '1px', height: '48px', background: '#E2E8F0', display: 'none' }} />

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '32px', flex: 1, paddingLeft: '24px', borderLeft: '1px solid #E2E8F0', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '12px', color: '#64748B', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}><Building2 size={14} /> Organization</div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#111827' }}>{vehicle.org_name || '—'}</div>
            </div>
            <div>
              <div style={{ fontSize: '12px', color: '#64748B', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}><Users2 size={14} /> Group</div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#111827' }}>
                {vehicle.groups && vehicle.groups.length > 0 ? vehicle.groups.map(g => g.name).join(', ') : '—'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '12px', color: '#64748B', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}><User size={14} /> Driver</div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#111827' }}>
                {vehicle.driver_name || '—'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '12px', color: '#64748B', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}><MapPin size={14} /> Location</div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#111827' }}>
                {vehicle.lat ? `${Number(vehicle.lat).toFixed(4)}, ${Number(vehicle.lng).toFixed(4)}` : 'Unknown'}
              </div>
            </div>

            {/* Immobilizer Quick Action Badge & Button */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginLeft: 'auto' }}>
              <button
                onClick={() => {
                  setImmobilizerFeedback(null);
                  setShowImmobilizerModal(true);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 14px',
                  borderRadius: '10px',
                  background: vehicle.is_immobilized ? '#DC2626' : '#F0FDF4',
                  color: vehicle.is_immobilized ? '#FFFFFF' : '#166534',
                  border: vehicle.is_immobilized ? 'none' : '1px solid #BBF7D0',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.06)',
                  transition: 'all 0.2s'
                }}
              >
                {vehicle.is_immobilized ? (
                  <>
                    <ShieldAlert size={16} color="#FFFFFF" />
                    <span>Engine Cut (Restore)</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck size={16} color="#16A34A" />
                    <span>Engine Active (Immobilize)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* 2. KPI Cards Row */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px' }}>
          <KPICard icon={Activity} label="Speed" value={`${speed} km/h`} color={speed > 80 ? '#EF4444' : speed > 0 ? '#10B981' : '#3B82F6'} />
          <KPICard icon={Fuel} label="Fuel Level" value={formatFuel(vehicle.current_fuel)} color="#8B5CF6" />
          <KPICard icon={Battery} label="Battery Volts" value={`${batteryStatus.value} (${batteryStatus.status})`} color={batteryStatus.color} />
          <KPICard icon={Key} label="Ignition" value={ignitionOn ? 'ON' : 'OFF'} color={ignitionOn ? '#10B981' : '#94A3B8'} />
          <KPICard icon={Navigation} label="Odometer" value={formatOdometer(vehicle.current_odometer)} color="#F59E0B" />
          <KPICard icon={Clock} label="Last Updated" value={formatLocalTime(vehicle.last_seen)} color="#64748B" />
        </div>

        {/* 3. Main Content */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', flex: 1, minHeight: '500px' }}>

          {/* Large Map */}
          <div style={{ flex: 1, minHeight: '400px', background: '#FFFFFF', borderRadius: '16px', overflow: 'hidden', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px rgba(0,0,0,0.02)', position: 'relative' }}>
            <VehicleMap vehicle={vehicle} vehicleId={id} initialLat={vehicle.lat} initialLng={vehicle.lng} initialIgnition={ignitionOn} initialSpeed={speed} />
          </div>

          {/* 4. Bottom Information Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '24px' }}>

            {/* Diagnostics */}
            <div style={{ background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px rgba(0,0,0,0.02)', overflow: 'hidden' }}>
              <div style={{ padding: '16px', borderBottom: '1px solid #F1F5F9', background: '#FAFAF9', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Cpu size={18} color="#f97316" />
                <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#111827', margin: 0 }}>Device Diagnostics</h3>
              </div>
              <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid #F1F5F9' }}>
                  <span style={{ fontSize: '13px', color: '#64748B', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}><Wifi size={14} /> GSM Signal</span>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#111827' }}>{vehicle.current_gsm_signal || 0}/31</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid #F1F5F9' }}>
                  <span style={{ fontSize: '13px', color: '#64748B', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}><Radio size={14} /> Satellites</span>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#111827' }}>{vehicle.current_satellites || 0} GPS Fix</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '13px', color: '#64748B', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}><Compass size={14} /> Heading</span>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#111827' }}>{vehicle.current_direction || 0}°</span>
                </div>
              </div>
            </div>

            {/* Today's Summary */}
            <div style={{ background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px rgba(0,0,0,0.02)', overflow: 'hidden' }}>
              <div style={{ padding: '16px', borderBottom: '1px solid #F1F5F9', background: '#FAFAF9', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Calendar size={18} color="#f97316" />
                <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#111827', margin: 0 }}>Today's Summary</h3>
              </div>
              <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid #F1F5F9' }}>
                  <span style={{ fontSize: '13px', color: '#64748B', fontWeight: 600 }}>Distance Traveled</span>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#111827' }}>
                    {reportSummary?.total_distance ? `${parseFloat(reportSummary.total_distance).toFixed(1)} km` : '0 km'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid #F1F5F9' }}>
                  <span style={{ fontSize: '13px', color: '#64748B', fontWeight: 600 }}>Peak Speed</span>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#111827' }}>
                    {reportSummary ? formatSpeed(reportSummary.max_speed) : '0 km/h'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '13px', color: '#64748B', fontWeight: 600 }}>Average Speed</span>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#111827' }}>
                    {reportSummary ? formatSpeed(Math.round(reportSummary.avg_speed)) : '0 km/h'}
                  </span>
                </div>
              </div>
            </div>

            {/* Alerts Summary */}
            <div style={{ background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px rgba(0,0,0,0.02)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '16px', borderBottom: '1px solid #F1F5F9', background: '#FAFAF9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AlertTriangle size={18} color="#f97316" />
                  <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#111827', margin: 0 }}>Recent Alerts</h3>
                </div>
                {alerts.length > 0 && <span style={{ padding: '2px 8px', borderRadius: '99px', background: '#FEF2F2', color: '#EF4444', fontSize: '11px', fontWeight: 700 }}>{alerts.length}</span>}
              </div>
              <div style={{ flex: 1, overflowY: 'auto', maxHeight: '200px' }}>
                {alerts.length === 0 ? (
                  <div style={{ padding: '24px', textAlign: 'center', color: '#94A3B8', fontSize: '13px', fontWeight: 500 }}>No recent alerts</div>
                ) : (
                  alerts.map((a, i) => <AlertItem key={i} alert={a} />)
                )}
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
