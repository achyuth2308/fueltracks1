import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, History, BarChart4, Loader2, AlertOctagon,
  Battery, Wifi, Compass, Radio, MapPin, AlertTriangle,
  Truck, Building2, Users2, User, Key, Fuel, Activity,
  Calendar, Cpu, WifiOff, Server, Navigation, Clock
} from 'lucide-react';
import * as vehicleApi from '../../api/vehicleApi';
import VehicleMap from '../../components/map/VehicleMap';
import { formatLocalTime, getRelativeTime } from '../../utils/dateUtils';
import { formatSpeed, formatOdometer, formatVoltage } from '../../utils/formatUtils';
import { useSocket } from '../../hooks/useSocket';
import { useVehicles } from '../../hooks/useVehicles';

/* ── Reusable Status Dot ── */
const StatusDot = ({ online, speed }) => {
  const isOnline = !!online;
  const isMoving = isOnline && (speed > 0);
  const color = isOnline ? (isMoving ? '#10B981' : '#F59E0B') : '#94A3B8';
  const label = isOnline ? (isMoving ? 'Moving' : 'Idle') : 'Offline';
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '6px',
      padding: '4px 10px', borderRadius: '99px',
      background: `${color}15`, border: `1px solid ${color}30`
    }}>
      <div style={{
        width: '6px', height: '6px', borderRadius: '50%', background: color,
        boxShadow: isOnline ? `0 0 6px ${color}60` : 'none',
        animation: isMoving ? 'pulse-dot 2s infinite' : 'none'
      }} />
      <span style={{ fontSize: '11px', fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
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
    };
    const handleAlert = (data) => {
      if (data.vehicleId !== id) return;
      setAlerts(prev => [data, ...prev].slice(0, 8));
    };
    socket.on('location:update', handleUpdate);
    socket.on('alert:new', handleAlert);
    return () => { socket.off('location:update', handleUpdate); socket.off('alert:new', handleAlert); };
  }, [socket, id]);

  if (loading && !vehicle) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 'calc(100vh - 56px)', gap: '16px', background: '#F8FAFC' }}>
      <Loader2 size={40} color="#8ba0b5" className="animate-spin" />
      <span style={{ fontSize: '14px', color: '#64748B', fontWeight: 600 }}>Loading vehicle telemetry...</span>
    </div>
  );

  if (error || !vehicle) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 'calc(100vh - 56px)', gap: '16px', padding: '24px', textAlign: 'center', background: '#F8FAFC' }}>
      <AlertOctagon size={48} color="#EF4444" />
      <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#111827' }}>Vehicle Not Found</h3>
      <p style={{ fontSize: '14px', color: '#64748B', maxWidth: '340px' }}>{error || 'Vehicle data does not exist or access is denied.'}</p>
      <button onClick={() => navigate('/dashboard')} style={{ padding: '10px 20px', background: '#8ba0b5', color: '#fff', borderRadius: '8px', border: 'none', fontWeight: 600, cursor: 'pointer', marginTop: '12px' }}>
        Back to Dashboard
      </button>
    </div>
  );

  const speed = vehicle.current_speed || 0;
  const ignitionOn = !!vehicle.current_ignition;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 56px)', background: 'linear-gradient(to bottom, #f5efe4 0%, #f5efe4 50%, #F8FAFC 50%, #F8FAFC 100%)', overflow: 'hidden', position: 'relative' }}>

      {loading && vehicle && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(255,255,255,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Loader2 size={32} color="#8ba0b5" className="animate-spin" />
        </div>
      )}

      {/* Top Navigation Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', background: '#FFFFFF', borderBottom: '1px solid #E2E8F0', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button
            onClick={() => navigate('/admin/vehicles')}
            style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#F1F5F9', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#475569' }}
          >
            <ArrowLeft size={18} />
          </button>
          <h1 style={{ fontSize: '20px', fontWeight: 800, color: '#111827', margin: 0 }}>Vehicle Detail</h1>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <Link to={`/vehicles/${id}/history`} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', borderRadius: '8px', background: '#F1F5F9', color: '#475569', textDecoration: 'none', fontSize: '13px', fontWeight: 600 }}>
            <History size={16} /> Route History
          </Link>
          <Link to={`/vehicles/${id}/report`} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', borderRadius: '8px', background: '#F1F5F9', color: '#475569', textDecoration: 'none', fontSize: '13px', fontWeight: 600 }}>
            <BarChart4 size={16} /> Analytics
          </Link>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>

        {/* 1. Vehicle Summary Card */}
        <div style={{ background: '#FFFFFF', borderRadius: '16px', padding: '24px', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px rgba(0,0,0,0.02)', display: 'flex', flexWrap: 'wrap', gap: '24px', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px', minWidth: '300px' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '16px', background: '#f5efe4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Truck size={32} color="#8ba0b5" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
                <h2 style={{ fontSize: '24px', fontWeight: 800, color: '#111827', margin: 0 }}>{vehicle.name}</h2>
                <StatusDot online={vehicle.is_online} speed={speed} />
              </div>
              <div style={{ fontSize: '14px', color: '#64748B', display: 'flex', alignItems: 'center', gap: '12px', fontFamily: 'monospace' }}>
                <span>{vehicle.plate || 'No Plate'}</span>
                <span>•</span>
                <span>IMEI: {vehicle.imei}</span>
              </div>
            </div>
          </div>

          <div style={{ width: '1px', height: '48px', background: '#E2E8F0', display: 'none' }} />

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '32px', flex: 1, paddingLeft: '24px', borderLeft: '1px solid #E2E8F0' }}>
            <div>
              <div style={{ fontSize: '12px', color: '#64748B', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}><Building2 size={14} /> Organization</div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#111827' }}>{vehicle.org_name || '—'}</div>
            </div>
            <div>
              <div style={{ fontSize: '12px', color: '#64748B', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}><Users2 size={14} /> Group</div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#111827' }}>—</div>
            </div>
            <div>
              <div style={{ fontSize: '12px', color: '#64748B', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}><User size={14} /> Driver</div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#111827' }}>—</div>
            </div>
            <div>
              <div style={{ fontSize: '12px', color: 'z#73849bff', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}><MapPin size={14} /> Location</div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#111827' }}>
                {vehicle.lat ? `${Number(vehicle.lat).toFixed(4)}, ${Number(vehicle.lng).toFixed(4)}` : 'Unknown'}
              </div>
            </div>
          </div>
        </div>

        {/* 2. KPI Cards Row */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px' }}>
          <KPICard icon={Activity} label="Speed" value={`${speed} km/h`} color={speed > 80 ? '#EF4444' : speed > 0 ? '#10B981' : '#3B82F6'} />
          <KPICard icon={Fuel} label="Fuel Level" value={`${Number(vehicle.current_fuel || 0).toFixed(1)}%`} color="#8B5CF6" />
          <KPICard icon={Battery} label="Battery Volts" value={formatVoltage(vehicle.current_voltage)} color="#EC4899" />
          <KPICard icon={Key} label="Ignition" value={ignitionOn ? 'ON' : 'OFF'} color={ignitionOn ? '#10B981' : '#94A3B8'} />
          <KPICard icon={Navigation} label="Odometer" value={formatOdometer(vehicle.current_odometer)} color="#F59E0B" />
          <KPICard icon={Clock} label="Last Updated" value={formatLocalTime(vehicle.last_seen)} color="#64748B" />
        </div>

        {/* 3. Main Content */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', flex: 1, minHeight: '500px' }}>

          {/* Large Map */}
          <div style={{ flex: 1, minHeight: '400px', background: '#FFFFFF', borderRadius: '16px', overflow: 'hidden', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px rgba(0,0,0,0.02)', position: 'relative' }}>
            <VehicleMap vehicleId={id} initialLat={vehicle.lat} initialLng={vehicle.lng} initialIgnition={vehicle.current_ignition} />
          </div>

          {/* 4. Bottom Information Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '24px' }}>

            {/* Diagnostics */}
            <div style={{ background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px rgba(0,0,0,0.02)', overflow: 'hidden' }}>
              <div style={{ padding: '16px', borderBottom: '1px solid #F1F5F9', background: '#FAFAF9', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Cpu size={18} color="#8ba0b5" />
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
                <Calendar size={18} color="#8ba0b5" />
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
                  <AlertTriangle size={18} color="#8ba0b5" />
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
    </div>
  );
};

export default VehicleDetailPage;
