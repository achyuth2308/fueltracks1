import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, History, BarChart4, Loader2, AlertOctagon,
  Battery, Wifi, Compass, Radio, Key, Navigation,
  Fuel, Gauge, Clock, MapPin, AlertTriangle, Zap,
} from 'lucide-react';
import * as vehicleApi from '../api/vehicleApi';
import VehicleMap from '../components/map/VehicleMap';
import { formatLocalTime, getRelativeTime } from '../utils/dateUtils';
import { formatSpeed, formatFuel, formatOdometer, formatVoltage } from '../utils/formatUtils';
import { useSocket } from '../hooks/useSocket';

/* ── Metric tile ── */
const MetricTile = ({ icon: Icon, label, value, color = '#7c8db0', subValue }) => (
  <div style={{
    padding: '10px 12px', borderRadius: '8px',
    background: 'rgba(0,0,0,0.25)',
    border: '1px solid rgba(255,255,255,0.04)',
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '4px' }}>
      <Icon size={11} color={color} />
      <span style={{ fontSize: '9px', fontWeight: 700, color: '#2d3748', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{label}</span>
    </div>
    <div style={{ fontSize: '15px', fontWeight: 800, color, fontFamily: 'JetBrains Mono, monospace', letterSpacing: '-0.02em' }}>{value}</div>
    {subValue && <div style={{ fontSize: '9px', color: '#2d3748', marginTop: '2px' }}>{subValue}</div>}
  </div>
);

/* ── Fuel bar ── */
const FuelBar = ({ pct = 0 }) => {
  const color = pct > 40 ? '#10b981' : pct > 15 ? '#f59e0b' : '#ef4444';
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <Fuel size={11} color={color} />
          <span style={{ fontSize: '10px', fontWeight: 600, color: '#4a5568' }}>Fuel Level</span>
        </div>
        <span style={{ fontSize: '12px', fontWeight: 800, color, fontFamily: 'JetBrains Mono, monospace' }}>{Number(pct).toFixed(1)}%</span>
      </div>
      <div style={{ height: '5px', background: 'rgba(255,255,255,0.05)', borderRadius: '99px', overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(100, pct)}%`, height: '100%', background: `linear-gradient(90deg, ${color} 0%, ${color}cc 100%)`, borderRadius: '99px', transition: 'width 0.7s ease', boxShadow: `0 0 8px ${color}40` }} />
      </div>
    </div>
  );
};

/* ── Speed Gauge ── */
const SpeedArc = ({ speed = 0 }) => {
  const max = 120;
  const pct = Math.min(speed / max, 1);
  const angle = pct * 180;
  const color = speed > 80 ? '#ef4444' : speed > 50 ? '#f59e0b' : '#10b981';
  const r = 52, cx = 64, cy = 64;
  const startAngle = 180, endAngle = startAngle + angle;
  const toRad = d => (d * Math.PI) / 180;
  const x1 = cx + r * Math.cos(toRad(startAngle));
  const y1 = cy + r * Math.sin(toRad(startAngle));
  const x2 = cx + r * Math.cos(toRad(endAngle));
  const y2 = cy + r * Math.sin(toRad(endAngle));
  const largeArc = angle > 180 ? 1 : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <svg width="128" height="72" viewBox="0 0 128 74" style={{ overflow: 'visible' }}>
        {/* Track */}
        <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="6" strokeLinecap="round" />
        {/* Fill */}
        {speed > 0 && (
          <path d={`M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`}
            fill="none" stroke={color} strokeWidth="6" strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 4px ${color}60)`, transition: 'all 0.4s ease' }} />
        )}
        {/* Center label */}
        <text x={cx} y={cy - 4} textAnchor="middle" fill={color}
          fontSize="20" fontWeight="800" fontFamily="JetBrains Mono, monospace"
          style={{ transition: 'fill 0.3s ease' }}>
          {speed}
        </text>
        <text x={cx} y={cy + 12} textAnchor="middle" fill="#2d3748" fontSize="8" fontFamily="Inter, sans-serif" fontWeight="600" letterSpacing="1">
          KM/H
        </text>
      </svg>
    </div>
  );
};

/* ── Alert item ── */
const AlertItem = ({ alert }) => {
  const typeColor = {
    overspeed: '#f59e0b', emergency: '#ef4444', geofence: '#2563eb', default: '#7c8db0',
  };
  const t = alert.alert_type?.toLowerCase() || 'default';
  const color = typeColor[Object.keys(typeColor).find(k => t.includes(k))] || typeColor.default;
  return (
    <div style={{
      borderLeft: `3px solid ${color}`,
      padding: '8px 10px', borderRadius: '0 7px 7px 0',
      background: 'rgba(0,0,0,0.2)', marginBottom: '5px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '10px', fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {alert.alert_type || 'ALERT'}
        </span>
        <span style={{ fontSize: '9px', color: '#2d3748', fontFamily: 'JetBrains Mono, monospace' }}>
          {getRelativeTime(alert.device_time || alert.deviceTime)}
        </span>
      </div>
      <p style={{ fontSize: '11px', color: '#7c8db0', marginTop: '3px', lineHeight: 1.4 }}>
        {alert.alert_text || alert.alertText}
      </p>
    </div>
  );
};

/* ── Tab Button ── */
const TabBtn = ({ to, icon: Icon, label }) => (
  <Link to={to} style={{
    display: 'flex', alignItems: 'center', gap: '6px',
    padding: '6px 12px', borderRadius: '7px',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.06)',
    color: '#4a5568', fontSize: '12px', fontWeight: 600,
    textDecoration: 'none', transition: 'all 0.15s',
  }}
    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#e2e8f0'; }}
    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.color = '#4a5568'; }}
  >
    <Icon size={13} /> <span>{label}</span>
  </Link>
);

/* ════════════════════════════════════════════ */
const VehicleDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { socket } = useSocket();
  const [vehicle, setVehicle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [reportSummary, setReportSummary] = useState(null);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        const [vRes, aRes, rRes] = await Promise.allSettled([
          vehicleApi.getVehicleById(id),
          vehicleApi.getVehicleAlerts(id, { limit: 8 }),
          vehicleApi.getVehicleReport(id),
        ]);
        if (vRes.status === 'fulfilled' && vRes.value.success) setVehicle(vRes.value.data);
        if (aRes.status === 'fulfilled' && aRes.value.success) setAlerts(aRes.value.data);
        if (rRes.status === 'fulfilled' && rRes.value.success && rRes.value.data.summary) setReportSummary(rRes.value.data.summary);
        setError(null);
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to fetch vehicle data');
      } finally { setLoading(false); }
    };
    fetch();
  }, [id]);

  useEffect(() => {
    if (!socket || !id) return;
    const handleUpdate = (data) => {
      if (data.vehicleId !== id) return;
      setVehicle(prev => !prev ? null : { ...prev, ...data, current_speed: data.speed, current_ignition: data.ignition, current_fuel: data.fuel ?? prev.current_fuel, current_voltage: data.voltage ?? prev.current_voltage, is_online: true, last_seen: data.deviceTime || new Date().toISOString() });
    };
    const handleAlert = (data) => {
      if (data.vehicleId !== id) return;
      setAlerts(prev => [data, ...prev].slice(0, 8));
    };
    socket.on('location:update', handleUpdate);
    socket.on('alert:new', handleAlert);
    return () => { socket.off('location:update', handleUpdate); socket.off('alert:new', handleAlert); };
  }, [socket, id]);

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 'calc(100vh - 56px)', gap: '14px' }}>
      <div style={{ width: '36px', height: '36px', border: '2px solid rgba(37,99,235,0.15)', borderTopColor: '#2563eb', borderRadius: '50%', animation: 'spin 0.75s linear infinite' }} />
      <span style={{ fontSize: '12px', color: '#2d3748', fontWeight: 500 }}>Loading live data stream...</span>
    </div>
  );

  if (error || !vehicle) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 'calc(100vh - 56px)', gap: '12px', padding: '24px', textAlign: 'center' }}>
      <AlertOctagon size={40} color="#ef4444" />
      <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#e2e8f0' }}>Vehicle Not Found</h3>
      <p style={{ fontSize: '12px', color: '#4a5568', maxWidth: '340px' }}>{error || 'Vehicle data does not exist or access is denied.'}</p>
      <button onClick={() => navigate('/dashboard')} className="btn-ghost" style={{ marginTop: '8px' }}>
        ← Back to Monitor
      </button>
    </div>
  );

  const isOnline = !!vehicle.is_online;
  const ignitionOn = !!vehicle.current_ignition;
  const speed = vehicle.current_speed || 0;
  const statusColor = isOnline ? (speed > 0 ? '#10b981' : '#f59e0b') : '#374151';
  const statusLabel = isOnline ? (speed > 0 ? 'Moving' : 'Idle') : 'Offline';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 56px)', background: '#0a0f1e', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 18px',
        background: 'linear-gradient(90deg, #0c1526 0%, #0a1020 100%)',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={() => navigate('/dashboard')}
            style={{
              width: '28px', height: '28px', borderRadius: '7px',
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: '#4a5568', transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = '#e2e8f0'; e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = '#4a5568'; e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
          >
            <ArrowLeft size={14} />
          </button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#e2e8f0', letterSpacing: '-0.02em' }}>{vehicle.name}</h2>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '4px',
                padding: '2px 7px', borderRadius: '99px',
                background: `${statusColor}14`, border: `1px solid ${statusColor}28`,
              }}>
                <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: statusColor, boxShadow: isOnline ? `0 0 6px ${statusColor}60` : 'none', animation: isOnline && speed > 0 ? 'pulse-dot 2s ease-in-out infinite' : 'none' }} />
                <span style={{ fontSize: '9px', fontWeight: 700, color: statusColor, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{statusLabel}</span>
              </div>
            </div>
            <div style={{ fontSize: '10px', color: '#2d3748', fontFamily: 'JetBrains Mono, monospace', marginTop: '1px' }}>
              {vehicle.plate} · IMEI {vehicle.imei}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <TabBtn to={`/vehicles/${id}/history`} icon={History} label="Route History" />
          <TabBtn to={`/vehicles/${id}/report`} icon={BarChart4} label="Reports" />
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Map */}
        <div style={{ flex: 1, position: 'relative' }}>
          <VehicleMap vehicleId={id} initialLat={vehicle.lat} initialLng={vehicle.lng} initialIgnition={vehicle.current_ignition} />
        </div>

        {/* Right Panel */}
        <div style={{
          width: '300px', minWidth: '300px',
          overflowY: 'auto',
          borderLeft: '1px solid rgba(255,255,255,0.05)',
          background: 'linear-gradient(180deg, #0c1526 0%, #0a1020 100%)',
          padding: '14px',
          display: 'flex', flexDirection: 'column', gap: '12px',
        }}>
          {/* Speed Arc */}
          <div style={{ padding: '14px', borderRadius: '10px', background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.04)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <div style={{ alignSelf: 'flex-start', fontSize: '9px', fontWeight: 700, color: '#2d3748', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Live Speed</div>
            <SpeedArc speed={speed} />
            <FuelBar pct={vehicle.current_fuel || 0} />
            <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
              <span style={{ fontSize: '11px', color: '#4a5568', fontWeight: 500 }}>Ignition</span>
              <div style={{
                padding: '2px 8px', borderRadius: '99px', fontSize: '10px', fontWeight: 700,
                background: ignitionOn ? 'rgba(16,185,129,0.1)' : 'rgba(55,65,81,0.3)',
                color: ignitionOn ? '#34d399' : '#374151',
                border: `1px solid ${ignitionOn ? 'rgba(16,185,129,0.25)' : 'rgba(55,65,81,0.4)'}`,
                letterSpacing: '0.05em',
              }}>
                {ignitionOn ? '● ON' : '○ OFF'}
              </div>
            </div>
          </div>

          {/* Diagnostics */}
          <div style={{ borderRadius: '10px', border: '1px solid rgba(255,255,255,0.04)', overflow: 'hidden' }}>
            <div style={{ padding: '8px 12px', background: 'rgba(0,0,0,0.2)', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: '9px', fontWeight: 700, color: '#2d3748', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              Device Diagnostics
            </div>
            <div style={{ padding: '10px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
              <MetricTile icon={Battery} label="Voltage" value={formatVoltage(vehicle.current_voltage)} color="#60a5fa" />
              <MetricTile icon={Wifi} label="GSM" value={`${vehicle.current_gsm_signal || 0}/31`} color="#a78bfa" />
              <MetricTile icon={Radio} label="Satellites" value={`${vehicle.current_satellites || 0}`} color="#34d399" subValue="GPS fix" />
              <MetricTile icon={Compass} label="Heading" value={`${vehicle.current_direction || 0}°`} color="#fbbf24" />
            </div>
            <div style={{ padding: '8px 12px', borderTop: '1px solid rgba(255,255,255,0.04)', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '10px', color: '#2d3748' }}>Last packet</span>
              <span style={{ fontSize: '10px', color: '#4a5568', fontFamily: 'JetBrains Mono, monospace' }}>{formatLocalTime(vehicle.last_seen)}</span>
            </div>
          </div>

          {/* Summary */}
          <div style={{ borderRadius: '10px', border: '1px solid rgba(255,255,255,0.04)', overflow: 'hidden' }}>
            <div style={{ padding: '8px 12px', background: 'rgba(0,0,0,0.2)', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: '9px', fontWeight: 700, color: '#2d3748', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              Today's Summary
            </div>
            <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '7px' }}>
              {[
                { label: 'Total Odometer', value: formatOdometer(vehicle.current_odometer) },
                reportSummary && { label: "Today's Distance", value: reportSummary.total_distance ? `${parseFloat(reportSummary.total_distance).toFixed(1)} km` : '0 km' },
                reportSummary && { label: 'Peak Speed', value: formatSpeed(reportSummary.max_speed) },
                reportSummary && { label: 'Avg Speed', value: formatSpeed(Math.round(reportSummary.avg_speed)) },
              ].filter(Boolean).map(({ label, value }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', color: '#4a5568' }}>{label}</span>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#7c8db0', fontFamily: 'JetBrains Mono, monospace' }}>{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Alerts */}
          <div style={{ borderRadius: '10px', border: '1px solid rgba(255,255,255,0.04)', overflow: 'hidden' }}>
            <div style={{ padding: '8px 12px', background: 'rgba(0,0,0,0.2)', borderBottom: '1px solid rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <AlertTriangle size={11} color="#f59e0b" />
              <span style={{ fontSize: '9px', fontWeight: 700, color: '#2d3748', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Alert Feed</span>
              {alerts.length > 0 && <span style={{ marginLeft: 'auto', fontSize: '10px', fontWeight: 700, color: '#f59e0b', background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.2)', padding: '1px 6px', borderRadius: '99px' }}>{alerts.length}</span>}
            </div>
            <div style={{ padding: '8px 10px', maxHeight: '200px', overflowY: 'auto' }}>
              {alerts.length === 0 ? (
                <p style={{ fontSize: '11px', color: '#2d3748', textAlign: 'center', padding: '12px 0', fontStyle: 'italic' }}>No recent alerts</p>
              ) : (
                alerts.map((alert, i) => <AlertItem key={i} alert={alert} />)
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VehicleDetailPage;
