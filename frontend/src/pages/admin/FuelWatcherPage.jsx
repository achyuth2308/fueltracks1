import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Droplets, RefreshCw, AlertTriangle, Zap, Activity,
  Search, Download, Clock, WifiOff, TrendingUp, TrendingDown,
  Minus, CheckCircle2, ChevronDown, Play, Pause, ShieldCheck
} from 'lucide-react';
import * as XLSX from 'xlsx';
import axiosInstance from '../../api/axios';

// Known primary transmitting devices
const KNOWN_JOINTECH_IMEI  = '861329086550044'; // voltytesting_jointech2
const KNOWN_TECHNOTON_IMEI = '861329086451516'; // voltyfuel_technoton (1516)

// ─────────────────────────────────────────────────────────
// Sensor detection
// ─────────────────────────────────────────────────────────
function detectSensorType(vehicle) {
  const name = (vehicle?.name || '').toLowerCase();
  const imei = (vehicle?.imei || '').trim();
  const sensorNo = (vehicle?.metadata?.sensorNo || '').toLowerCase();
  const fuelType = (vehicle?.metadata?.fuelType || '').toLowerCase();
  const deviceModel = (vehicle?.metadata?.deviceModel || '').toLowerCase();

  if (imei === KNOWN_JOINTECH_IMEI) return 'jointech';
  if (imei === KNOWN_TECHNOTON_IMEI) return 'technoton';

  if (name.includes('jointech') || name.includes('jointek') || sensorNo.includes('jt')) {
    return 'jointech';
  }
  if (
    name.includes('technoton') ||
    name.includes('technothon') ||
    name.includes('techno') ||
    sensorNo.includes('tn')
  ) {
    return 'technoton';
  }
  if (deviceModel.includes('voltyfuel')) {
    return 'technoton';
  }
  if (fuelType === 'digital' || fuelType === 'analog' || vehicle?.metadata?.sensorCount > 0) {
    return 'digital_unknown';
  }
  return null;
}

function getSensorLabel(type) {
  const MAP = {
    jointech: 'Jointech',
    technoton: 'Technoton',
    digital_unknown: 'Digital Sensor',
    raw: 'Raw Values',
  };
  return MAP[type] || 'Sensor';
}

function getSensorColor(type) {
  const MAP = {
    jointech: '#6366f1',
    technoton: '#0ea5e9',
    digital_unknown: '#f59e0b',
    raw: '#64748b',
  };
  return MAP[type] || '#64748b';
}

// ─────────────────────────────────────────────────────────
// Strict Fuel value conversion
// ─────────────────────────────────────────────────────────
function convertFuel(rawFuel, sensorType) {
  const raw = parseFloat(rawFuel);
  if (isNaN(raw)) return null;

  // STRICT ENFORCEMENT:
  // Jointech is strictly Raw / 100 = Litres
  // Technoton is strictly Raw / 10 = Litres
  if (sensorType === 'jointech') {
    return +(raw / 100).toFixed(2);
  }
  if (sensorType === 'technoton') {
    return +(raw / 10).toFixed(2);
  }
  if (sensorType === 'raw') {
    return +raw.toFixed(2);
  }
  // Fallback for digital_unknown
  return raw > 1000 ? +(raw / 100).toFixed(2) : +(raw / 10).toFixed(2);
}

function extractFuelRaw(packet) {
  if (packet.fuel != null && !isNaN(parseFloat(packet.fuel))) {
    return parseFloat(packet.fuel);
  }
  let p = {};
  if (packet.parsed_data) {
    if (typeof packet.parsed_data === 'string') {
      try { p = JSON.parse(packet.parsed_data); } catch { p = {}; }
    } else {
      p = packet.parsed_data || {};
    }
  }
  if (p.fuel != null && !isNaN(parseFloat(p.fuel))) return parseFloat(p.fuel);
  if (p.fuelLevel != null && !isNaN(parseFloat(p.fuelLevel))) return parseFloat(p.fuelLevel);
  if (p.rawFuel != null && !isNaN(parseFloat(p.rawFuel))) return parseFloat(p.rawFuel);
  return null;
}

function extractIgnition(packet) {
  let p = {};
  if (packet.parsed_data) {
    if (typeof packet.parsed_data === 'string') {
      try { p = JSON.parse(packet.parsed_data); } catch { p = {}; }
    } else {
      p = packet.parsed_data || {};
    }
  }
  const val = packet.ignition ?? p.ignition ?? p.acc ?? p.din1 ?? null;
  if (val === null) return null;
  return val === true || val === 1 || val === '1' || String(val).toLowerCase() === 'true';
}

function formatIST(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
    }).replace(',', '');
  } catch { return '—'; }
}

const SPIKE_THRESHOLD = 5; // litres

function getFluctuationLevel(delta) {
  if (delta === null) return 'none';
  const abs = Math.abs(delta);
  if (abs >= SPIKE_THRESHOLD) return 'high';
  if (abs >= 2) return 'medium';
  return 'low';
}

const STORAGE_KEY_DATA     = 'fuel_watcher_device_cache_v4';
const STORAGE_KEY_TAB      = 'fuel_watcher_active_tab_v4';
const STORAGE_KEY_AUTOREF  = 'fuel_watcher_auto_refresh_enabled';
const STORAGE_KEY_INTERVAL = 'fuel_watcher_auto_refresh_interval';

// ─────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────
const FuelWatcherPage = () => {
  const [allVehicles, setAllVehicles] = useState([]);
  const [loadingVehicles, setLoadingVehicles] = useState(true);
  const [search, setSearch] = useState('');
  
  // Persistent active tab: 'jointech' | 'technoton'
  const [activeTab, setActiveTab] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY_TAB) || 'jointech';
    } catch {
      return 'jointech';
    }
  });

  const [selectedVehicleId, setSelectedVehicleId] = useState(null);

  // Auto-refresh settings (Zero-overhead: only queries active vehicle, pauses when tab is hidden)
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_AUTOREF);
      return saved !== null ? saved === 'true' : true; // Default ON
    } catch {
      return true;
    }
  });

  const [refreshInterval, setRefreshInterval] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_INTERVAL);
      return saved ? parseInt(saved, 10) : 15; // Default 15s
    } catch {
      return 15;
    }
  });

  const [countdown, setCountdown] = useState(refreshInterval);
  const [isRefreshingSilently, setIsRefreshingSilently] = useState(false);

  // Persistent device packets cache
  const [deviceData, setDeviceData] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_DATA);
      if (saved) {
        const parsed = JSON.parse(saved);
        Object.keys(parsed).forEach(k => {
          if (parsed[k]?.fetchedAt) parsed[k].fetchedAt = new Date(parsed[k].fetchedAt);
        });
        return parsed;
      }
    } catch (e) {
      console.warn('[FuelWatcher] Failed to load cache:', e);
    }
    return {};
  });

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setSelectedVehicleId(null);
    setSearch('');
    setCountdown(refreshInterval);
    try {
      localStorage.setItem(STORAGE_KEY_TAB, tab);
    } catch {}
  };

  const handleToggleAutoRefresh = () => {
    const nextVal = !autoRefreshEnabled;
    setAutoRefreshEnabled(nextVal);
    setCountdown(refreshInterval);
    try {
      localStorage.setItem(STORAGE_KEY_AUTOREF, String(nextVal));
    } catch {}
  };

  const handleChangeInterval = (newSecs) => {
    setRefreshInterval(newSecs);
    setCountdown(newSecs);
    try {
      localStorage.setItem(STORAGE_KEY_INTERVAL, String(newSecs));
    } catch {}
  };

  useEffect(() => {
    try {
      if (Object.keys(deviceData).length > 0) {
        localStorage.setItem(STORAGE_KEY_DATA, JSON.stringify(deviceData));
      }
    } catch (e) {
      console.warn('[FuelWatcher] Save cache failed:', e);
    }
  }, [deviceData]);

  // Load all vehicles once
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingVehicles(true);
      try {
        const res = await axiosInstance.get('/api/vehicles');
        if (cancelled) return;
        const list = Array.isArray(res.data?.data)
          ? res.data.data
          : (Array.isArray(res.data?.vehicles) ? res.data.vehicles : []);
        setAllVehicles(list);
      } catch (err) {
        console.error('[FuelWatcher] Fetch error:', err);
      } finally {
        if (!cancelled) setLoadingVehicles(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Categorize vehicles
  const categorized = useMemo(() => {
    const jointech = [];
    const technoton = [];

    allVehicles.forEach(v => {
      const imei = (v.imei || '').trim();
      const type = detectSensorType(v);

      if (imei === KNOWN_JOINTECH_IMEI || type === 'jointech') {
        jointech.push(v);
      } else if (imei === KNOWN_TECHNOTON_IMEI || type === 'technoton') {
        technoton.push(v);
      }
    });

    // Ensure known active devices are at index 0
    jointech.sort((a, b) => (a.imei === KNOWN_JOINTECH_IMEI ? -1 : 1));
    technoton.sort((a, b) => (a.imei === KNOWN_TECHNOTON_IMEI ? -1 : 1));

    return { jointech, technoton };
  }, [allVehicles]);

  const primaryJointech = categorized.jointech[0] || allVehicles.find(v => v.imei === KNOWN_JOINTECH_IMEI);
  const primaryTechnoton = categorized.technoton[0] || allVehicles.find(v => v.imei === KNOWN_TECHNOTON_IMEI);

  // Search across the ENTIRE fleet
  const searchMatch = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return null;

    return allVehicles.find(v =>
      (v.imei || '').toLowerCase().includes(q) ||
      (v.name || '').toLowerCase().includes(q) ||
      (v.plate || '').toLowerCase().includes(q)
    ) || null;
  }, [allVehicles, search]);

  // Current active vehicle to display in table
  const activeVehicle = useMemo(() => {
    if (search.trim() !== '') {
      return searchMatch;
    }
    if (activeTab === 'jointech') {
      if (selectedVehicleId) {
        return categorized.jointech.find(v => v.id === selectedVehicleId) || primaryJointech;
      }
      return primaryJointech;
    } else {
      if (selectedVehicleId) {
        return categorized.technoton.find(v => v.id === selectedVehicleId) || primaryTechnoton;
      }
      return primaryTechnoton;
    }
  }, [search, searchMatch, activeTab, selectedVehicleId, categorized, primaryJointech, primaryTechnoton]);

  // Fetch packets for ONLY the active vehicle (Single indexed query, zero RAM/DB impact)
  const fetchPackets = useCallback(async (vehicle, isSilent = false) => {
    if (!vehicle?.id) return;
    const vid = vehicle.id;

    if (!isSilent) {
      setDeviceData(prev => ({
        ...prev,
        [vid]: { ...(prev[vid] || {}), loading: true, error: null }
      }));
    } else {
      setIsRefreshingSilently(true);
    }

    try {
      const res = await axiosInstance.get(`/api/vehicles/${vid}/messages`, {
        params: { page: 1, limit: 30 }
      });
      const pkts = res.data?.data || [];
      setDeviceData(prev => ({
        ...prev,
        [vid]: {
          ...(prev[vid] || {}),
          packets: pkts,
          loading: false,
          error: null,
          fetchedAt: new Date()
        }
      }));
    } catch (err) {
      if (!isSilent) {
        setDeviceData(prev => ({
          ...prev,
          [vid]: {
            ...(prev[vid] || {}),
            packets: [],
            loading: false,
            error: err.response?.data?.error || err.message || 'Failed to fetch packets',
            fetchedAt: new Date()
          }
        }));
      }
    } finally {
      if (isSilent) setIsRefreshingSilently(false);
    }
  }, []);

  // Initial fetch if active vehicle has no packets
  useEffect(() => {
    if (activeVehicle?.id) {
      const d = deviceData[activeVehicle.id];
      if (!d?.packets || !d?.fetchedAt) {
        fetchPackets(activeVehicle, false);
      }
    }
  }, [activeVehicle, deviceData, fetchPackets]);

  // ─────────────────────────────────────────────────────────
  // ZERO-OVERHEAD AUTO-REFRESH ENGINE
  // - Runs only when tab is visible (pauses on document.hidden)
  // - Only queries 1 single vehicle with LIMIT 30 (takes ~1ms DB time)
  // - Silent in-place refresh without flickering the screen
  // ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!autoRefreshEnabled || !activeVehicle?.id) {
      return;
    }

    const timer = setInterval(() => {
      // Guard: do not execute queries if the user has minimized or switched tabs
      if (document.hidden) {
        return;
      }

      setCountdown(prev => {
        if (prev <= 1) {
          fetchPackets(activeVehicle, true);
          return refreshInterval;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [autoRefreshEnabled, activeVehicle, refreshInterval, fetchPackets]);

  const setSensorOverride = (vehicleId, overrideType) => {
    setDeviceData(prev => ({
      ...prev,
      [vehicleId]: {
        ...(prev[vehicleId] || {}),
        sensorTypeOverride: overrideType
      }
    }));
  };

  // Determine effective sensor type for active vehicle
  const currentSensorType = useMemo(() => {
    if (!activeVehicle) return activeTab;
    const userOverride = deviceData[activeVehicle.id]?.sensorTypeOverride;
    if (userOverride) return userOverride;
    if (search.trim() !== '') {
      return detectSensorType(activeVehicle) || 'technoton';
    }
    return activeTab;
  }, [activeVehicle, deviceData, activeTab, search]);

  // Process rows for active table
  const rows = useMemo(() => {
    if (!activeVehicle?.id) return [];
    const pkts = deviceData[activeVehicle.id]?.packets || [];
    return pkts.map((pkt, idx) => {
      const rawFuel   = extractFuelRaw(pkt);
      const converted = convertFuel(rawFuel, currentSensorType);
      const prevRaw   = idx < pkts.length - 1 ? extractFuelRaw(pkts[idx + 1]) : null;
      const prevConv  = convertFuel(prevRaw, currentSensorType);
      const delta     = converted !== null && prevConv !== null ? +(converted - prevConv).toFixed(2) : null;
      return {
        pkt,
        rawFuel,
        converted,
        delta,
        fluctLevel: getFluctuationLevel(delta),
        ignition: extractIgnition(pkt)
      };
    });
  }, [activeVehicle, deviceData, currentSensorType]);

  const spikes = rows.filter(r => r.fluctLevel === 'high').length;

  const exportExcel = () => {
    if (!activeVehicle || !rows.length) return;
    const formulaDesc = currentSensorType === 'jointech' ? 'Raw ÷ 100' : (currentSensorType === 'technoton' ? 'Raw ÷ 10' : 'Raw');
    const exportRows = rows.map(({ pkt, rawFuel, converted, delta, ignition }, i) => ({
      'S.No': i + 1,
      'IMEI': pkt.imei || activeVehicle.imei || '',
      'Reg No': activeVehicle.plate || '',
      'Vehicle Name': activeVehicle.name || '',
      'Ignition': ignition === null ? '—' : ignition ? 'ON' : 'OFF',
      'Device Time (IST)': formatIST(pkt.device_time),
      'Server Time (IST)': formatIST(pkt.received_at),
      'Raw Fuel Value': rawFuel ?? '',
      [`Actual Fuel (${formulaDesc})`]: converted ?? '',
      'Delta Change': delta !== null ? `${delta > 0 ? '+' : ''}${delta} L` : ''
    }));
    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'FuelWatcher');
    XLSX.writeFile(wb, `fuel_${activeVehicle.imei || activeVehicle.name}_${Date.now()}.xlsx`);
  };

  const activeVehicleData = activeVehicle ? deviceData[activeVehicle.id] : null;

  return (
    <div style={{
      padding: '24px 28px 48px', background: '#F1F5F9',
      minHeight: '100%', boxSizing: 'border-box'
    }}>

      {/* ─────────────────────────────────────────────────────────
          1. HEADER
         ───────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'linear-gradient(135deg, #6366f1, #0ea5e9)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
            }}>
              <Droplets size={20} color="#fff" />
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0F172A', letterSpacing: '-0.02em', margin: 0 }}>
              Fuel Watcher
            </h1>
            <span style={{
              padding: '3px 10px', borderRadius: 99, fontSize: 10, fontWeight: 700,
              background: '#DCFCE7', color: '#16A34A', letterSpacing: '0.04em'
            }}>STRICT CALIBRATION · AUTO-LIVE</span>
          </div>
          <p style={{ fontSize: 13, color: '#64748B', margin: 0 }}>
            Strict conversion rules applied: <strong>Jointech = Raw ÷ 100</strong> | <strong>Technoton = Raw ÷ 10</strong>. Zero RAM/DB overhead auto-refresh.
          </p>
        </div>

        {/* Global Spikes Pill */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: '#FEF2F2', borderRadius: 10, padding: '7px 14px',
          border: '1.5px solid #FCA5A5', boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
        }}>
          <AlertTriangle size={14} color="#EF4444" />
          <span style={{ fontSize: 12, fontWeight: 600, color: '#DC2626' }}>
            Δ ≥ {SPIKE_THRESHOLD} L = Major Fluctuation (sensor fault indicator)
          </span>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────
          2. SEARCH BAR ABOVE THE CARDS
         ───────────────────────────────────────────────────────── */}
      <div style={{
        background: '#FFFFFF', borderRadius: 14, padding: '14px 18px',
        border: '1.5px solid #E2E8F0', marginBottom: 20,
        boxShadow: '0 1px 4px rgba(0,0,0,0.02)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 280 }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
            <input
              type="text"
              placeholder="Search any vehicle by IMEI, Plate, or Name (e.g. 861329086544187, 861329086451516)…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: '100%', padding: '10px 14px 10px 36px',
                border: search ? '2px solid #3B82F6' : '1.5px solid #CBD5E1', borderRadius: 10,
                fontSize: 13, color: '#0F172A', background: '#F8FAFC',
                outline: 'none', boxSizing: 'border-box'
              }}
            />
          </div>

          {search && (
            <button
              onClick={() => setSearch('')}
              style={{
                padding: '8px 14px', borderRadius: 8, background: '#E2E8F0',
                border: 'none', color: '#475569', fontSize: 12, fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Clear Search
            </button>
          )}

          {search.trim() !== '' && (
            <div style={{ fontSize: 12, fontWeight: 600, color: searchMatch ? '#16A34A' : '#DC2626' }}>
              {searchMatch ? (
                <span>Found: <strong>{searchMatch.name || searchMatch.plate}</strong> (IMEI: {searchMatch.imei})</span>
              ) : (
                <span>No vehicle matched "{search}"</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────
          3. SIDE-BY-SIDE CARDS: JOINTECH & TECHNOTON
         ───────────────────────────────────────────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: 16,
        marginBottom: 20
      }}>
        {/* JOINTECH CARD */}
        <div
          onClick={() => handleTabChange('jointech')}
          style={{
            cursor: 'pointer',
            background: activeTab === 'jointech' && !search ? '#FFFFFF' : '#F8FAFC',
            borderRadius: 14,
            padding: '18px 20px',
            border: activeTab === 'jointech' && !search ? '2.5px solid #6366F1' : '1.5px solid #E2E8F0',
            boxShadow: activeTab === 'jointech' && !search ? '0 10px 25px -5px rgba(99, 102, 241, 0.22)' : '0 1px 3px rgba(0,0,0,0.02)',
            transition: 'all 0.2s ease',
            position: 'relative'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#6366F1' }} />
              <span style={{ fontSize: 16, fontWeight: 800, color: '#1E293B', letterSpacing: '0.02em' }}>
                JOINTECH SENSOR
              </span>
            </div>

            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '3px 9px', borderRadius: 99, fontSize: 11, fontWeight: 700,
              background: '#DCFCE7', color: '#16A34A'
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#16A34A' }} />
              LIVE FUEL
            </span>
          </div>

          <div style={{ fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 2 }}>
            {primaryJointech?.name || 'voltytesting_jointech2'}
          </div>
          <div style={{ fontSize: 11, color: '#64748B', marginBottom: 8 }}>
            IMEI: <strong style={{ color: '#1E293B' }}>{primaryJointech?.imei || KNOWN_JOINTECH_IMEI}</strong>
          </div>

          <div style={{
            background: activeTab === 'jointech' && !search ? '#EEF2FF' : '#F1F5F9',
            padding: '8px 12px', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            border: '1px solid rgba(99, 102, 241, 0.15)'
          }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#4F46E5' }}>
              Strict Formula: Raw ÷ 100
            </span>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#475569' }}>
              e.g. 38800 raw → <strong style={{ color: '#4F46E5' }}>388.00 L</strong>
            </span>
          </div>

          {activeTab === 'jointech' && !search && (
            <div style={{ position: 'absolute', top: 14, right: 14, color: '#6366F1' }}>
              <CheckCircle2 size={20} />
            </div>
          )}
        </div>

        {/* TECHNOTON CARD (1516) */}
        <div
          onClick={() => handleTabChange('technoton')}
          style={{
            cursor: 'pointer',
            background: activeTab === 'technoton' && !search ? '#FFFFFF' : '#F8FAFC',
            borderRadius: 14,
            padding: '18px 20px',
            border: activeTab === 'technoton' && !search ? '2.5px solid #0EA5E9' : '1.5px solid #E2E8F0',
            boxShadow: activeTab === 'technoton' && !search ? '0 10px 25px -5px rgba(14, 165, 233, 0.22)' : '0 1px 3px rgba(0,0,0,0.02)',
            transition: 'all 0.2s ease',
            position: 'relative'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#0EA5E9' }} />
              <span style={{ fontSize: 16, fontWeight: 800, color: '#1E293B', letterSpacing: '0.02em' }}>
                TECHNOTON SENSOR
              </span>
            </div>

            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '3px 9px', borderRadius: 99, fontSize: 11, fontWeight: 700,
              background: '#DCFCE7', color: '#16A34A'
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#16A34A' }} />
              LIVE FUEL
            </span>
          </div>

          <div style={{ fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 2 }}>
            {primaryTechnoton?.name || 'voltyfuel_technoton'}
          </div>
          <div style={{ fontSize: 11, color: '#64748B', marginBottom: 8 }}>
            IMEI: <strong style={{ color: '#1E293B' }}>{primaryTechnoton?.imei || KNOWN_TECHNOTON_IMEI}</strong> (1516)
          </div>

          <div style={{
            background: activeTab === 'technoton' && !search ? '#E0F2FE' : '#F1F5F9',
            padding: '8px 12px', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            border: '1px solid rgba(14, 165, 233, 0.15)'
          }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#0284C7' }}>
              Strict Formula: Raw ÷ 10
            </span>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#475569' }}>
              e.g. 5000 raw → <strong style={{ color: '#0284C7' }}>500.00 L</strong>
            </span>
          </div>

          {activeTab === 'technoton' && !search && (
            <div style={{ position: 'absolute', top: 14, right: 14, color: '#0EA5E9' }}>
              <CheckCircle2 size={20} />
            </div>
          )}
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────
          4. ACTIVE TABLE SECTION WITH ZERO-OVERHEAD AUTO-REFRESH
         ───────────────────────────────────────────────────────── */}
      {loadingVehicles ? (
        <div style={{ background: '#FFFFFF', borderRadius: 14, padding: 48, textAlign: 'center', border: '1px solid #E2E8F0' }}>
          <RefreshCw size={26} color="#6366F1" style={{ animation: 'fwSpin 1s linear infinite', marginBottom: 10 }} />
          <div style={{ color: '#64748B', fontSize: 14, fontWeight: 500 }}>Loading vehicles from server…</div>
        </div>
      ) : !activeVehicle ? (
        <div style={{ background: '#FFFFFF', borderRadius: 14, padding: '48px 24px', textAlign: 'center', border: '1px solid #E2E8F0' }}>
          <Droplets size={40} color="#CBD5E1" style={{ marginBottom: 12 }} />
          <div style={{ fontSize: 16, fontWeight: 700, color: '#1E293B', marginBottom: 6 }}>
            {search ? `No vehicle found for "${search}"` : 'No active fuel vehicle selected'}
          </div>
          <div style={{ fontSize: 13, color: '#64748B' }}>
            Click either Jointech or Technoton card above to load live packets.
          </div>
        </div>
      ) : (
        <div style={{
          background: '#FFFFFF', borderRadius: 14,
          border: `2px solid ${getSensorColor(currentSensorType)}`,
          boxShadow: `0 8px 24px -4px ${getSensorColor(currentSensorType)}20`,
          overflow: 'hidden'
        }}>
          {/* Card Top Banner */}
          <div style={{
            padding: '14px 20px',
            background: `${getSensorColor(currentSensorType)}0D`,
            borderBottom: `1px solid ${getSensorColor(currentSensorType)}30`,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{
                padding: '4px 10px', borderRadius: 7, fontSize: 11, fontWeight: 800,
                background: `${getSensorColor(currentSensorType)}22`, color: getSensorColor(currentSensorType),
                letterSpacing: '0.04em'
              }}>
                {getSensorLabel(currentSensorType).toUpperCase()}
              </span>

              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 15, fontWeight: 800, color: '#0F172A' }}>
                    {activeVehicle.name || activeVehicle.plate}
                  </span>
                  {activeVehicle.plate && activeVehicle.name && (
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#64748B', background: '#F1F5F9', padding: '2px 6px', borderRadius: 4 }}>
                      {activeVehicle.plate}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: '#64748B', marginTop: 1 }}>
                  IMEI: <strong style={{ color: '#1E293B' }}>{activeVehicle.imei}</strong>
                  {activeVehicle.metadata?.deviceModel && (
                    <span> · Model: {activeVehicle.metadata.deviceModel}</span>
                  )}
                </div>
              </div>
            </div>

            {/* Secondary Device Dropdown (if any) */}
            {!search && (activeTab === 'jointech' ? categorized.jointech.length > 1 : categorized.technoton.length > 1) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, color: '#64748B', fontWeight: 600 }}>Switch device:</span>
                <select
                  value={activeVehicle.id}
                  onChange={e => setSelectedVehicleId(e.target.value)}
                  style={{
                    padding: '6px 10px', borderRadius: 8, border: '1px solid #CBD5E1',
                    fontSize: 12, fontWeight: 600, color: '#1E293B', background: '#FFFFFF',
                    outline: 'none'
                  }}
                >
                  {(activeTab === 'jointech' ? categorized.jointech : categorized.technoton).map(v => (
                    <option key={v.id} value={v.id}>
                      {v.name || v.plate || v.imei} ({v.imei})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Spikes pill */}
            {spikes > 0 && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '4px 10px', borderRadius: 8, background: '#FEF2F2', color: '#EF4444',
                fontSize: 11, fontWeight: 700
              }}>
                <AlertTriangle size={13} />
                {spikes} spike{spikes !== 1 ? 's' : ''} detected
              </span>
            )}
          </div>

          {/* Action Toolbar */}
          <div style={{
            padding: '12px 20px', display: 'flex', gap: 12, flexWrap: 'wrap',
            alignItems: 'center', background: '#FAFAFA', borderBottom: '1px solid #E2E8F0'
          }}>
            {/* Strict formula switcher */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#FFFFFF', padding: '3px 4px', borderRadius: 8, border: '1px solid #CBD5E1' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#475569', padding: '0 6px' }}>
                Strict Formula:
              </span>
              {[
                { type: 'jointech', label: 'Jointech (÷100)' },
                { type: 'technoton', label: 'Technoton (÷10)' },
                { type: 'raw', label: 'Raw' }
              ].map(opt => (
                <button
                  key={opt.type}
                  onClick={() => setSensorOverride(activeVehicle.id, opt.type)}
                  style={{
                    padding: '4px 9px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                    border: 'none', cursor: 'pointer',
                    background: currentSensorType === opt.type ? getSensorColor(opt.type) : 'transparent',
                    color: currentSensorType === opt.type ? '#FFFFFF' : '#64748B',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Auto-Refresh Control (Zero-overhead guarantee) */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: '#FFFFFF', padding: '4px 8px', borderRadius: 8, border: '1px solid #CBD5E1'
            }}>
              <button
                onClick={handleToggleAutoRefresh}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4, background: 'none',
                  border: 'none', cursor: 'pointer', padding: 0
                }}
              >
                {autoRefreshEnabled ? (
                  <span style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    fontSize: 11, fontWeight: 700, color: '#16A34A'
                  }}>
                    <span style={{
                      width: 8, height: 8, borderRadius: '50%', background: '#16A34A',
                      animation: isRefreshingSilently ? 'fwPulse 0.6s infinite' : 'none'
                    }} />
                    Auto-Refresh ON ({countdown}s)
                  </span>
                ) : (
                  <span style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    fontSize: 11, fontWeight: 700, color: '#64748B'
                  }}>
                    <Pause size={12} />
                    Auto-Refresh OFF
                  </span>
                )}
              </button>

              {autoRefreshEnabled && (
                <select
                  value={refreshInterval}
                  onChange={e => handleChangeInterval(parseInt(e.target.value, 10))}
                  style={{
                    border: 'none', background: '#F1F5F9', borderRadius: 4,
                    fontSize: 11, fontWeight: 600, color: '#334155', padding: '2px 4px',
                    outline: 'none', cursor: 'pointer'
                  }}
                >
                  <option value={10}>10s</option>
                  <option value={15}>15s</option>
                  <option value={30}>30s</option>
                  <option value={60}>60s</option>
                </select>
              )}
            </div>

            {/* Manual Refresh button */}
            <button
              onClick={() => fetchPackets(activeVehicle, false)}
              disabled={activeVehicleData?.loading}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
                borderRadius: 8, background: '#FFFFFF', border: '1px solid #CBD5E1',
                fontSize: 12, fontWeight: 600, color: '#1E293B',
                cursor: activeVehicleData?.loading ? 'not-allowed' : 'pointer',
                opacity: activeVehicleData?.loading ? 0.6 : 1
              }}
            >
              <RefreshCw size={12} style={activeVehicleData?.loading ? { animation: 'fwSpin 1s linear infinite' } : {}} />
              Fetch Now
            </button>

            {/* Export */}
            {rows.length > 0 && (
              <button
                onClick={exportExcel}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px',
                  borderRadius: 8, background: '#F0FDF4', border: '1px solid #BBF7D0',
                  fontSize: 12, fontWeight: 600, color: '#15803D', cursor: 'pointer'
                }}
              >
                <Download size={13} />
                Export Excel
              </button>
            )}

            {/* Timestamp & Silent Indicator */}
            {activeVehicleData?.fetchedAt && (
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
                {isRefreshingSilently && (
                  <span style={{ fontSize: 11, color: '#16A34A', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <RefreshCw size={10} style={{ animation: 'fwSpin 0.8s linear infinite' }} />
                    Syncing...
                  </span>
                )}
                <span style={{ fontSize: 11, color: '#64748B' }}>
                  <Clock size={11} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                  Last: {activeVehicleData.fetchedAt.toLocaleTimeString('en-IN')} ({rows.length} pkts)
                </span>
              </div>
            )}
          </div>

          {/* Initial Loading */}
          {activeVehicleData?.loading && (
            <div style={{ padding: '40px', textAlign: 'center', color: '#64748B', fontSize: 13 }}>
              <RefreshCw size={22} color={getSensorColor(currentSensorType)} style={{ animation: 'fwSpin 1s linear infinite', marginBottom: 8 }} />
              <div>Fetching latest sensor packets for {activeVehicle.name || activeVehicle.imei}…</div>
            </div>
          )}

          {/* Error */}
          {activeVehicleData?.error && (
            <div style={{
              margin: '14px 20px', padding: '10px 14px', borderRadius: 8,
              background: '#FEF2F2', color: '#EF4444', fontSize: 12, fontWeight: 600,
              border: '1px solid #FCA5A5', display: 'flex', alignItems: 'center', gap: 6
            }}>
              <AlertTriangle size={14} />
              {activeVehicleData.error}
            </div>
          )}

          {/* Table */}
          {!activeVehicleData?.loading && !activeVehicleData?.error && rows.length > 0 && (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                    <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>#</th>
                    <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Ignition</th>
                    <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Device Time (IST)</th>
                    <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Server Time (IST)</th>
                    <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Raw Value</th>
                    <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: getSensorColor(currentSensorType), textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      {currentSensorType === 'jointech'
                        ? 'Actual Fuel (L) [Raw ÷ 100]'
                        : currentSensorType === 'technoton'
                        ? 'Actual Fuel (L) [Raw ÷ 10]'
                        : 'Actual Fuel (Raw)'}
                    </th>
                    <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Δ Change</th>
                    <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ pkt, rawFuel, converted, delta, fluctLevel, ignition }, idx) => {
                    const high = fluctLevel === 'high';
                    const med  = fluctLevel === 'medium';
                    return (
                      <tr key={pkt.id || idx} style={{
                        background: high ? '#FEF2F2' : idx % 2 === 0 ? '#FFFFFF' : '#FAFAFA',
                        borderBottom: '1px solid #F1F5F9'
                      }}>
                        <td style={{ padding: '9px 14px', color: '#64748B', fontWeight: 600 }}>{idx + 1}</td>

                        <td style={{ padding: '9px 14px' }}>
                          {ignition === null ? <span style={{ color: '#CBD5E1' }}>—</span> : (
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: 4,
                              padding: '2px 8px', borderRadius: 99, fontSize: 10, fontWeight: 700,
                              background: ignition ? '#DCFCE7' : '#F1F5F9',
                              color: ignition ? '#16A34A' : '#64748B'
                            }}>
                              <Zap size={9} />{ignition ? 'ON' : 'OFF'}
                            </span>
                          )}
                        </td>

                        <td style={{ padding: '9px 14px', color: '#1E293B', whiteSpace: 'nowrap', fontWeight: 500 }}>
                          {formatIST(pkt.device_time)}
                        </td>

                        <td style={{ padding: '9px 14px', color: '#64748B', whiteSpace: 'nowrap' }}>
                          {formatIST(pkt.received_at)}
                        </td>

                        <td style={{ padding: '9px 14px', fontFamily: 'monospace', fontWeight: 600, color: '#334155' }}>
                          {rawFuel !== null ? rawFuel : <span style={{ color: '#CBD5E1' }}>—</span>}
                        </td>

                        <td style={{ padding: '9px 14px', fontWeight: 800, color: getSensorColor(currentSensorType) }}>
                          {converted !== null ? (
                            <span>
                              {converted} {currentSensorType !== 'raw' && <span style={{ fontSize: 10, fontWeight: 500, color: '#64748B' }}>L</span>}
                            </span>
                          ) : (
                            <span style={{ color: '#CBD5E1' }}>—</span>
                          )}
                        </td>

                        <td style={{ padding: '9px 14px' }}>
                          {delta === null ? <span style={{ color: '#CBD5E1' }}>—</span> : (
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: 3, fontWeight: 700,
                              color: delta > 0 ? '#16A34A' : delta < 0 ? '#EF4444' : '#64748B'
                            }}>
                              {delta > 0 ? <TrendingUp size={11} /> : delta < 0 ? <TrendingDown size={11} /> : <Minus size={11} />}
                              {delta > 0 ? '+' : ''}{delta} L
                            </span>
                          )}
                        </td>

                        <td style={{ padding: '9px 14px' }}>
                          {high ? (
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: 4,
                              padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 800,
                              background: '#FEE2E2', color: '#DC2626'
                            }}>
                              <AlertTriangle size={10} /> Major Spike
                            </span>
                          ) : med ? (
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: 4,
                              padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700,
                              background: '#FEF3C7', color: '#D97706'
                            }}>
                              <Activity size={10} /> Minor
                            </span>
                          ) : (
                            <span style={{ color: '#94A3B8', fontSize: 11, fontWeight: 500 }}>Stable</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Empty Table */}
          {!activeVehicleData?.loading && !activeVehicleData?.error && rows.length === 0 && (
            <div style={{ padding: '40px', textAlign: 'center', color: '#64748B', fontSize: 13 }}>
              <WifiOff size={24} style={{ marginBottom: 8, color: '#94A3B8' }} />
              <div style={{ fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                No packets found for this device
              </div>
              <div style={{ fontSize: 12, color: '#64748B' }}>
                Click "Fetch Now" to query the server for recent telemetry packets.
              </div>
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes fwSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes fwPulse { 0% { opacity: 1; } 50% { opacity: 0.3; } 100% { opacity: 1; } }
      `}</style>
    </div>
  );
};

export default FuelWatcherPage;
