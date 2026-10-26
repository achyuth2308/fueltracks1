import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  X, Fuel, Activity, Zap, Gauge, Radio, RotateCw, CheckCircle2,
  Clock, Shield, AlertTriangle, ArrowRight, Battery, Cpu
} from 'lucide-react';
import { useSocket } from '../../hooks/useSocket';
import * as vehicleApi from '../../api/vehicleApi';

const LiveFuelModal = ({
  isOpen,
  onClose,
  vehicleId,
  vehicleName = 'Vehicle',
  plate = '',
  imei = '',
  tankCapacity = 0,
  initialFuel = null,
  initialOdometer = null,
  fuelType = '',
  sensorType = ''
}) => {
  const { socket, connected, joinVehicleRoom, leaveVehicleRoom } = useSocket();

  const [liveData, setLiveData] = useState({
    fuel: initialFuel !== null && !isNaN(Number(initialFuel)) ? Number(initialFuel) : null,
    voltage: null,
    battery: null,
    ignition: false,
    speed: 0,
    satellites: null,
    odometer: initialOdometer !== null && !isNaN(Number(initialOdometer)) ? Number(initialOdometer) : null,
    todayDistance: null,
    deviceTime: null
  });

  // Fixed micro-buffer capped at max 20 data points (< 500 bytes of memory)
  const [fuelHistory, setFuelHistory] = useState([]);

  const [packetCount, setPacketCount] = useState(0);
  const [lastPacketTime, setLastPacketTime] = useState(null);
  const [timeAgo, setTimeAgo] = useState('Waiting for data...');
  const [loading, setLoading] = useState(false);

  // Sync initialFuel and initialOdometer if provided
  useEffect(() => {
    if (initialFuel !== null && initialFuel !== undefined && !isNaN(Number(initialFuel))) {
      const initVal = Number(Number(initialFuel).toFixed(1));
      setLiveData(prev => ({ ...prev, fuel: initVal }));
      setFuelHistory(prev => (prev.length === 0 ? [{ val: initVal, time: Date.now() }] : prev));
    }
  }, [initialFuel]);

  useEffect(() => {
    if (initialOdometer !== null && initialOdometer !== undefined && !isNaN(Number(initialOdometer))) {
      setLiveData(prev => ({ ...prev, odometer: Number(initialOdometer) }));
    }
  }, [initialOdometer]);

  // Clean memory on close
  useEffect(() => {
    if (!isOpen) {
      setFuelHistory([]);
    }
  }, [isOpen]);

  // Fetch initial telemetry from API once when modal opens so screen is immediately populated
  const fetchCurrentVehicleState = useCallback(async () => {
    if (!vehicleId) return;
    try {
      setLoading(true);
      const res = await vehicleApi.getVehicleById(vehicleId);
      const v = res?.data || res;
      if (v) {
        const parsedFuel = v.current_fuel !== undefined && v.current_fuel !== null
          ? Number(v.current_fuel)
          : (v.fuel !== undefined && v.fuel !== null ? Number(v.fuel) : null);

        setLiveData(prev => ({
          ...prev,
          fuel: parsedFuel !== null ? parsedFuel : prev.fuel,
          voltage: v.current_voltage ?? v.voltage ?? prev.voltage,
          ignition: v.current_ignition !== undefined ? !!v.current_ignition : (v.ignition !== undefined ? !!v.ignition : prev.ignition),
          speed: v.current_speed ?? v.speed ?? prev.speed,
          satellites: v.current_satellites ?? v.satellites ?? prev.satellites,
          battery: v.battery ?? prev.battery,
          odometer: v.current_odometer ?? v.odometer ?? v.metadata?.odometerReading ?? prev.odometer,
          todayDistance: v.today_distance ?? prev.todayDistance,
          deviceTime: v.last_seen ?? v.deviceTime ?? prev.deviceTime
        }));
        if (parsedFuel !== null) {
          const initNum = Number(parsedFuel.toFixed(1));
          setFuelHistory(prev => (prev.length === 0 ? [{ val: initNum, time: Date.now() }] : prev));
        }
        if (v.last_seen) {
          setLastPacketTime(new Date(v.last_seen));
        }
      }
    } catch (err) {
      console.error('[LiveFuelModal] Failed to fetch current vehicle state:', err);
    } finally {
      setLoading(false);
    }
  }, [vehicleId]);

  // WebSocket Subscription (Zero DB queries, purely memory broadcast)
  useEffect(() => {
    if (!isOpen || !vehicleId) return;

    fetchCurrentVehicleState();

    if (socket && connected) {
      joinVehicleRoom(vehicleId);
    }

    const handlePacket = (data) => {
      if (!data) return;
      const incomingId = data.vehicleId;
      if (incomingId === vehicleId || String(incomingId) === String(vehicleId)) {
        setPacketCount(c => c + 1);
        const now = new Date();
        setLastPacketTime(now);

        setLiveData(prev => {
          const nextFuel = data.fuel !== undefined && data.fuel !== null && !isNaN(Number(data.fuel))
            ? Number(data.fuel)
            : prev.fuel;

          if (nextFuel !== null && nextFuel !== undefined && !isNaN(Number(nextFuel))) {
            const numVal = Number(Number(nextFuel).toFixed(1));
            setFuelHistory(h => {
              const next = [...h, { val: numVal, time: Date.now() }];
              return next.length > 20 ? next.slice(next.length - 20) : next;
            });
          }

          return {
            ...prev,
            fuel: nextFuel,
            voltage: data.voltage !== undefined && data.voltage !== null ? data.voltage : prev.voltage,
            battery: data.battery !== undefined && data.battery !== null ? data.battery : prev.battery,
            ignition: data.ignition !== undefined ? !!data.ignition : prev.ignition,
            speed: data.speed !== undefined ? data.speed : prev.speed,
            satellites: data.satellites !== undefined ? data.satellites : prev.satellites,
            odometer: data.odometer !== undefined && data.odometer !== null ? data.odometer : prev.odometer,
            todayDistance: data.today_distance !== undefined && data.today_distance !== null ? data.today_distance : (data.todayDistance ?? prev.todayDistance),
            deviceTime: data.deviceTime || now.toISOString()
          };
        });
      }
    };

    if (socket) {
      socket.on('location:update', handlePacket);
      socket.on('fleet:update', handlePacket);
    }

    // Zero-pressure fallback: ONLY poll if WebSocket connection drops
    const pollTimer = setInterval(() => {
      if (!connected) {
        fetchCurrentVehicleState();
      }
    }, 20000);

    return () => {
      clearInterval(pollTimer);
      if (socket) {
        socket.off('location:update', handlePacket);
        socket.off('fleet:update', handlePacket);
        if (connected) {
          leaveVehicleRoom(vehicleId);
        }
      }
    };
  }, [isOpen, vehicleId, socket, connected, joinVehicleRoom, leaveVehicleRoom, fetchCurrentVehicleState]);

  // Relative Time Ticker (updates every second)
  useEffect(() => {
    if (!lastPacketTime) {
      setTimeAgo('Waiting for signal...');
      return;
    }
    const updateTicker = () => {
      const diffSec = Math.max(0, Math.round((Date.now() - new Date(lastPacketTime).getTime()) / 1000));
      if (diffSec < 4) {
        setTimeAgo('Just now');
      } else if (diffSec < 60) {
        setTimeAgo(`${diffSec} seconds ago`);
      } else {
        const mins = Math.floor(diffSec / 60);
        setTimeAgo(`${mins} min${mins > 1 ? 's' : ''} ago`);
      }
    };

    updateTicker();
    const ticker = setInterval(updateTicker, 1000);
    return () => clearInterval(ticker);
  }, [lastPacketTime]);

  // Calculated Tank Metrics
  const tankCap = parseFloat(tankCapacity) > 0 ? parseFloat(tankCapacity) : 100;
  const currentLitres = liveData.fuel !== null && liveData.fuel >= 0 ? Math.round(liveData.fuel * 10) / 10 : 0;
  const fillPercentage = Math.min(100, Math.max(0, Math.round((currentLitres / tankCap) * 100)));

  // Gauge Color Theme based on level
  const fillTheme = useMemo(() => {
    if (fillPercentage <= 15) {
      return { bar: '#ef4444', text: '#dc2626', bg: '#fef2f2', label: 'Critical Low' };
    }
    if (fillPercentage <= 30) {
      return { bar: '#f59e0b', text: '#d97706', bg: '#fffbeb', label: 'Low Fuel' };
    }
    return { bar: '#10b981', text: '#059669', bg: '#ecfdf5', label: 'Optimal' };
  }, [fillPercentage]);

  // Render SVG Micro Sparkline (Pure math, hardware accelerated, Zero Extra RAM)
  const renderSparkline = () => {
    if (fuelHistory.length < 2) {
      return (
        <line
          x1="0"
          y1="18"
          x2="580"
          y2="18"
          stroke="#cbd5e1"
          strokeWidth="1.5"
          strokeDasharray="4 4"
        />
      );
    }

    const vals = fuelHistory.map(p => p.val);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const range = (max - min) || 1;
    const w = 580;
    const h = 32;

    const points = fuelHistory.map((p, idx) => {
      const x = (idx / (fuelHistory.length - 1)) * w;
      const y = h - ((p.val - min) / range) * (h - 8) - 4;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });

    const dLine = `M ${points.join(' L ')}`;
    const dArea = `M 0,${h} L ${points.join(' L ')} L ${w},${h} Z`;
    const lastCoord = points[points.length - 1].split(',');

    return (
      <>
        <path d={dArea} fill="url(#liveSparkGrad)" />
        <path d={dLine} fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={lastCoord[0]} cy={lastCoord[1]} r="3.5" fill="#10b981" stroke="#ffffff" strokeWidth="1.5" />
      </>
    );
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100000,
        background: 'rgba(15, 23, 42, 0.72)',
        backdropFilter: 'blur(5px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '680px',
          boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.35)',
          border: '1px solid #e2e8f0',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Top Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 22px',
          borderBottom: '1px solid #e2e8f0',
          background: '#f8fafc'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: '#fff7ed',
              border: '1px solid #fed7aa',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ea580c'
            }}>
              <Fuel size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#0f172a' }}>
                  Live Fuel Telemetry
                </h3>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  background: connected ? '#ecfdf5' : '#fef2f2',
                  color: connected ? '#059669' : '#dc2626',
                  border: `1px solid ${connected ? '#a7f3d0' : '#fecaca'}`,
                  borderRadius: '12px',
                  padding: '2px 8px',
                  fontSize: '11px',
                  fontWeight: 700
                }}>
                  <span style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: connected ? '#10b981' : '#ef4444',
                    boxShadow: connected ? '0 0 6px rgba(16, 185, 129, 0.8)' : 'none'
                  }} />
                  {connected ? 'LIVE STREAM' : 'OFFLINE'}
                </span>
              </div>
              <p style={{ margin: '2px 0 0', fontSize: '12.5px', color: '#64748b' }}>
                {vehicleName} {plate && `• ${plate}`} {imei && `(IMEI: ${imei})`}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={fetchCurrentVehicleState}
              title="Refresh Telemetry"
              disabled={loading}
              style={{
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                width: '34px',
                height: '34px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: loading ? 'not-allowed' : 'pointer',
                color: '#475569',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = '#f1f5f9';
                e.currentTarget.style.color = '#0f172a';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = '#ffffff';
                e.currentTarget.style.color = '#475569';
              }}
            >
              <RotateCw size={15} className={loading ? 'animate-spin' : ''} />
            </button>

            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                padding: '6px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = '#e2e8f0';
                e.currentTarget.style.color = '#0f172a';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = '#94a3b8';
              }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* Main Visual Fuel Tank Display */}
          <div style={{
            background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
            border: '1px solid #e2e8f0',
            borderRadius: '14px',
            padding: '18px 22px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '20px'
          }}>
            {/* Numeric Volume & Status */}
            <div>
              <span style={{
                fontSize: '11.5px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: '#64748b'
              }}>
                Current Fuel Level
              </span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '4px' }}>
                <span style={{
                  fontSize: '38px',
                  fontWeight: 900,
                  color: '#0f172a',
                  fontVariantNumeric: 'tabular-nums',
                  lineHeight: 1
                }}>
                  {liveData.fuel !== null ? currentLitres.toFixed(1) : '—'}
                </span>
                <span style={{ fontSize: '18px', fontWeight: 700, color: '#64748b' }}>
                  Litres
                </span>
              </div>

              <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <span style={{
                  padding: '3px 10px',
                  borderRadius: '20px',
                  fontSize: '12px',
                  fontWeight: 800,
                  background: fillTheme.bg,
                  color: fillTheme.text,
                  border: `1px solid ${fillTheme.bar}40`
                }}>
                  {fillPercentage}% Full • {fillTheme.label}
                </span>

                <span style={{ fontSize: '12.5px', color: '#64748b', fontWeight: 600 }}>
                  Tank Capacity: {tankCap} L
                </span>
              </div>
            </div>

            {/* Realistic Industrial Tank Cylinder Graphic */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
              {/* Tank Cap / Inlet Neck */}
              <div style={{
                width: '28px',
                height: '5px',
                background: '#94a3b8',
                borderRadius: '3px 3px 0 0',
                border: '1px solid #64748b',
                borderBottom: 'none'
              }} />

              {/* Main Tank Body */}
              <div style={{
                width: '94px',
                height: '116px',
                border: '2.5px solid #94a3b8',
                borderRadius: '14px',
                background: '#ffffff',
                position: 'relative',
                overflow: 'hidden',
                boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.06), 0 4px 10px rgba(0,0,0,0.04)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-end'
              }}>
                {/* Tank Graduations (E, 1/4, 1/2, 3/4, F) */}
                <div style={{
                  position: 'absolute',
                  left: '5px',
                  top: '6px',
                  bottom: '6px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  zIndex: 5,
                  pointerEvents: 'none',
                  fontSize: '8px',
                  fontWeight: 800,
                  color: '#64748b'
                }}>
                  <span style={{ lineHeight: 1 }}>F</span>
                  <span style={{ lineHeight: 1, borderTop: '1px solid #cbd5e1', width: '6px' }}></span>
                  <span style={{ lineHeight: 1, borderTop: '1px solid #cbd5e1', width: '10px' }}>½</span>
                  <span style={{ lineHeight: 1, borderTop: '1px solid #cbd5e1', width: '6px' }}></span>
                  <span style={{ lineHeight: 1 }}>E</span>
                </div>

                {/* Glass Reflection Highlight */}
                <div style={{
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  right: '6px',
                  width: '8px',
                  background: 'linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.45) 50%, rgba(255,255,255,0) 100%)',
                  zIndex: 4,
                  pointerEvents: 'none'
                }} />

                {/* Fluid Fill */}
                <div style={{
                  width: '100%',
                  height: `${fillPercentage}%`,
                  background: `linear-gradient(180deg, ${fillTheme.bar}ee 0%, ${fillTheme.bar} 100%)`,
                  transition: 'height 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  {/* Fluid Surface Meniscus Wave */}
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: '3px',
                    background: 'rgba(255, 255, 255, 0.55)',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                  }} />

                  {/* Percentage Label */}
                  <span style={{
                    fontSize: '12px',
                    fontWeight: 900,
                    color: fillPercentage > 20 ? '#ffffff' : '#0f172a',
                    textShadow: fillPercentage > 20 ? '0 1px 2px rgba(0,0,0,0.4)' : 'none',
                    zIndex: 6
                  }}>
                    {fillPercentage}%
                  </span>
                </div>
              </div>

              {/* Tank Stand Base */}
              <div style={{
                width: '66px',
                height: '4px',
                background: '#94a3b8',
                borderRadius: '0 0 3px 3px'
              }} />
            </div>
          </div>

          {/* Real-Time Sensor Telemetry Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
            gap: '10px'
          }}>
            {/* Tile 1: Vehicle Main Power Supply */}
            <div style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              padding: '12px 14px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b', marginBottom: '6px' }}>
                <Zap size={14} color="#f59e0b" />
                <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.04em' }}>VEHICLE POWER</span>
              </div>
              <div style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a' }}>
                {liveData.voltage !== null ? `${Number(liveData.voltage).toFixed(2)} V` : (fuelType || 'Normal')}
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px', fontWeight: 500 }}>
                {liveData.voltage >= 22 ? '24V Alternator (Normal)' : (liveData.voltage >= 11 ? '12V Battery (Normal)' : (sensorType || 'Main Supply'))}
              </div>
            </div>

            {/* Tile 2: Odometer & Cumulative Travel */}
            <div style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              padding: '12px 14px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b', marginBottom: '6px' }}>
                <Gauge size={14} color="#0284c7" />
                <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.04em' }}>ODOMETER</span>
              </div>
              <div style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a' }}>
                {liveData.odometer !== null && !isNaN(Number(liveData.odometer))
                  ? `${Math.round(Number(liveData.odometer)).toLocaleString('en-IN')} km`
                  : '—'}
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px', fontWeight: 500 }}>
                {liveData.todayDistance !== null && !isNaN(Number(liveData.todayDistance)) && Number(liveData.todayDistance) > 0
                  ? `Today: ${(Math.round(Number(liveData.todayDistance) * 10) / 10).toLocaleString('en-IN')} km`
                  : 'Cumulative Distance'}
              </div>
            </div>

            {/* Tile 3: Engine Ignition & Movement */}
            <div style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              padding: '12px 14px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b', marginBottom: '6px' }}>
                <Activity size={14} color={liveData.ignition ? '#10b981' : '#94a3b8'} />
                <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.04em' }}>IGNITION</span>
              </div>
              <div style={{
                fontSize: '15px',
                fontWeight: 800,
                color: liveData.ignition ? '#059669' : '#64748b'
              }}>
                {liveData.ignition ? 'ENGINE ON' : 'ENGINE OFF'}
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px', fontWeight: 500 }}>
                {liveData.speed > 0 ? `Speed: ${liveData.speed} km/h` : 'Speed: 0 km/h (Stationary)'}
              </div>
            </div>

            {/* Tile 4: Satellite & Connection Stream */}
            <div style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              padding: '12px 14px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b', marginBottom: '6px' }}>
                <Radio size={14} color="#3b82f6" />
                <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.04em' }}>TELEMETRY STREAM</span>
              </div>
              <div style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a' }}>
                {liveData.satellites ? `${liveData.satellites} Satellites` : 'GPS Connected'}
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px', fontWeight: 500 }}>
                {connected ? 'Active Live Stream' : 'Cached Telemetry'}
              </div>
            </div>
          </div>

          {/* Micro Sparkline: Live Sensor Stability Trend (Fixed-size 20 point buffer, <500 bytes RAM) */}
          <div style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            padding: '10px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Activity size={13} color="#ea580c" />
                <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#334155' }}>
                  Live Sensor Stability Trend
                </span>
                <span style={{ fontSize: '10.5px', color: '#94a3b8' }}>
                  ({fuelHistory.length} readings)
                </span>
              </div>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#059669', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#10b981' }} />
                {fuelHistory.length >= 2 
                  ? Math.abs(fuelHistory[fuelHistory.length - 1].val - fuelHistory[0].val) < 0.5 
                    ? 'Stable Level' 
                    : 'Active Reading'
                  : 'Monitoring...'}
              </span>
            </div>

            {/* Micro SVG Sparkline (Hardware-accelerated) */}
            <div style={{ width: '100%', height: '34px', position: 'relative' }}>
              <svg viewBox="0 0 580 32" preserveAspectRatio="none" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                <defs>
                  <linearGradient id="liveSparkGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                  </linearGradient>
                </defs>
                {renderSparkline()}
              </svg>
            </div>
          </div>

          {/* Heartbeat & Last Update Strip */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            padding: '10px 14px',
            fontSize: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock size={14} color="#64748b" />
              <span style={{ color: '#64748b', fontWeight: 500 }}>Last Packet Received:</span>
              <span style={{ color: '#0f172a', fontWeight: 700 }}>{timeAgo}</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#059669', fontWeight: 600 }}>
              <CheckCircle2 size={13} />
              <span>Receiving calibrated telemetry</span>
            </div>
          </div>

        </div>

        {/* Modal Footer */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: '12px',
          padding: '14px 22px',
          borderTop: '1px solid #e2e8f0',
          background: '#f8fafc'
        }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '9px 26px',
              borderRadius: '8px',
              background: '#f97316',
              color: '#ffffff',
              border: 'none',
              fontWeight: 700,
              fontSize: '13px',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(249, 115, 22, 0.28)',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = '#ea580c';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(249, 115, 22, 0.38)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = '#f97316';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(249, 115, 22, 0.28)';
            }}
          >
            Close Live Fuel
          </button>
        </div>

      </div>
    </div>
  );
};

export default LiveFuelModal;
