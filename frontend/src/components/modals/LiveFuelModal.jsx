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
    deviceTime: null
  });

  const [packetCount, setPacketCount] = useState(0);
  const [lastPacketTime, setLastPacketTime] = useState(null);
  const [timeAgo, setTimeAgo] = useState('Waiting for data...');
  const [loading, setLoading] = useState(false);

  // Sync initialFuel if provided
  useEffect(() => {
    if (initialFuel !== null && initialFuel !== undefined && !isNaN(Number(initialFuel))) {
      setLiveData(prev => ({ ...prev, fuel: Number(initialFuel) }));
    }
  }, [initialFuel]);

  // Fetch initial telemetry from API so screen is immediately populated
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
          deviceTime: v.last_seen ?? v.deviceTime ?? prev.deviceTime
        }));
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

  // WebSocket Subscription
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

          return {
            ...prev,
            fuel: nextFuel,
            voltage: data.voltage !== undefined && data.voltage !== null ? data.voltage : prev.voltage,
            battery: data.battery !== undefined && data.battery !== null ? data.battery : prev.battery,
            ignition: data.ignition !== undefined ? !!data.ignition : prev.ignition,
            speed: data.speed !== undefined ? data.speed : prev.speed,
            satellites: data.satellites !== undefined ? data.satellites : prev.satellites,
            deviceTime: data.deviceTime || now.toISOString()
          };
        });
      }
    };

    if (socket) {
      socket.on('location:update', handlePacket);
      socket.on('fleet:update', handlePacket);
    }

    // 15-second background polling fallback
    const pollTimer = setInterval(fetchCurrentVehicleState, 15000);

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
        <div style={{ padding: '22px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          
          {/* Main Visual Fuel Tank Display */}
          <div style={{
            background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
            border: '1px solid #e2e8f0',
            borderRadius: '14px',
            padding: '20px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '24px'
          }}>
            {/* Numeric Volume & Status */}
            <div>
              <span style={{
                fontSize: '12px',
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

              <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
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

            {/* Visual Tank Graphic */}
            <div style={{
              width: '90px',
              height: '110px',
              border: '3px solid #cbd5e1',
              borderRadius: '18px',
              background: '#ffffff',
              position: 'relative',
              overflow: 'hidden',
              boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.06)'
            }}>
              {/* Level Fluid */}
              <div style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                height: `${fillPercentage}%`,
                background: `linear-gradient(180deg, ${fillTheme.bar}ee 0%, ${fillTheme.bar} 100%)`,
                transition: 'height 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                {fillPercentage > 15 && (
                  <span style={{
                    fontSize: '11px',
                    fontWeight: 900,
                    color: '#ffffff',
                    textShadow: '0 1px 2px rgba(0,0,0,0.3)'
                  }}>
                    {fillPercentage}%
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Real-Time Sensor Telemetry Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '12px'
          }}>
            {/* Tile 1: Probe Voltage / Raw Signal */}
            <div style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              padding: '12px 14px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b', marginBottom: '6px' }}>
                <Zap size={14} color="#f59e0b" />
                <span style={{ fontSize: '11.5px', fontWeight: 700 }}>PROBE SIGNAL</span>
              </div>
              <div style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a' }}>
                {liveData.voltage !== null ? `${Number(liveData.voltage).toFixed(2)} V` : (fuelType || 'LLS / Analog')}
              </div>
              <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                {sensorType || 'Fuel Sensor 1'}
              </div>
            </div>

            {/* Tile 2: Engine Ignition */}
            <div style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              padding: '12px 14px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b', marginBottom: '6px' }}>
                <Activity size={14} color={liveData.ignition ? '#10b981' : '#94a3b8'} />
                <span style={{ fontSize: '11.5px', fontWeight: 700 }}>IGNITION</span>
              </div>
              <div style={{
                fontSize: '15px',
                fontWeight: 800,
                color: liveData.ignition ? '#059669' : '#64748b'
              }}>
                {liveData.ignition ? 'ENGINE ON' : 'ENGINE OFF'}
              </div>
              <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                Speed: {liveData.speed || 0} km/h
              </div>
            </div>

            {/* Tile 3: Tracker Health & Sats */}
            <div style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              padding: '12px 14px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b', marginBottom: '6px' }}>
                <Radio size={14} color="#3b82f6" />
                <span style={{ fontSize: '11.5px', fontWeight: 700 }}>TELEMETRY STREAM</span>
              </div>
              <div style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a' }}>
                {packetCount > 0 ? `${packetCount} Packets` : 'Active'}
              </div>
              <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                {liveData.satellites ? `${liveData.satellites} Satellites` : 'GPS Connected'}
              </div>
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
