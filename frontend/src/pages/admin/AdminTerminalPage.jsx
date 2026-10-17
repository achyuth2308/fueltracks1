import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Terminal as TerminalIcon, Search, RefreshCw, Download,
  MapPin, AlertCircle, Loader2, X, Navigation, Clock, Cpu, ExternalLink, ChevronDown,
  FileCode, Copy, Check, Maximize2
} from 'lucide-react';
import * as XLSX from 'xlsx';
import axiosInstance from '../../api/axios';
import { useSocket } from '../../hooks/useSocket';

function formatIST(isoString) {
  if (!isoString) return '—';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    }).replace(',', '');
  } catch (e) {
    return '—';
  }
}

function getTodayString() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function extractFields(m) {
  // Parse parsed_data if string
  let p = {};
  if (m.parsed_data) {
    if (typeof m.parsed_data === 'string') {
      try { p = JSON.parse(m.parsed_data); } catch (e) { p = {}; }
    } else if (typeof m.parsed_data === 'object') {
      p = m.parsed_data;
    }
  }

  // lat/lng: prefer DB-computed columns, fallback to parsed_data
  const lat = m.lat != null ? parseFloat(m.lat)
    : (p.lat != null ? parseFloat(p.lat) : null);
  const lng = m.lng != null ? parseFloat(m.lng)
    : (p.lng != null ? parseFloat(p.lng) : (p.lon != null ? parseFloat(p.lon) : null));

  // speed: prefer DB-computed columns, fallback to parsed_data
  const speed = m.speed != null ? parseFloat(m.speed)
    : (p.speed != null ? parseFloat(p.speed) : 0);

  // fuel: prefer DB-computed columns, fallback to parsed_data
  const fuel = m.fuel != null ? parseFloat(m.fuel)
    : (p.fuel != null ? parseFloat(p.fuel)
      : (p.fuelLevel != null ? parseFloat(p.fuelLevel) : null));

  return { lat, lng, speed, fuel };
}

const AdminTerminalPage = () => {
  const { socket } = useSocket();

  const [vehicles, setVehicles] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isInputFocused, setIsInputFocused] = useState(false);

  const [recordLimit, setRecordLimit] = useState(10);
  const [selectedDate, setSelectedDate] = useState(getTodayString());

  const [packets, setPackets] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(false);
  const [fetchingVehicles, setFetchingVehicles] = useState(true);
  const [error, setError] = useState(null);
  const [liveCount, setLiveCount] = useState(0);
  const [copiedId, setCopiedId] = useState(null);
  const [modalPacket, setModalPacket] = useState(null);

  const handleCopy = (id, text) => {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }).catch(err => {
      console.error('Failed to copy raw packet:', err);
    });
  };

  // Fetch vehicles list for client-side matching
  useEffect(() => {
    const fetchList = async () => {
      setFetchingVehicles(true);
      try {
        const res = await axiosInstance.get('/api/vehicles');
        const list = Array.isArray(res.data?.data)
          ? res.data.data
          : (Array.isArray(res.data?.vehicles) ? res.data.vehicles : []);
        setVehicles(list);
      } catch (err) {
        console.error('Failed to load vehicles:', err);
      } finally {
        setFetchingVehicles(false);
      }
    };
    fetchList();
  }, []);

  // Match vehicle by plate, name, or IMEI
  const matchedVehicle = useMemo(() => {
    const clean = inputValue.trim().toLowerCase();
    if (!clean) return null;
    return vehicles.find(v =>
      (v.plate && v.plate.toLowerCase() === clean) ||
      (v.imei && v.imei.toLowerCase() === clean) ||
      (v.name && v.name.toLowerCase() === clean)
    ) || null;
  }, [vehicles, inputValue]);

  // Active identifier: vehicle ID or typed 15-digit IMEI / plate
  const activeIdentifier = useMemo(() => {
    const clean = inputValue.trim();
    if (!clean) return '';
    if (matchedVehicle) return matchedVehicle.id || matchedVehicle.imei;
    return clean;
  }, [matchedVehicle, inputValue]);

  const activeImei = useMemo(() => {
    if (matchedVehicle?.imei) return matchedVehicle.imei;
    const clean = inputValue.trim();
    if (/^\d{15}$/.test(clean)) return clean;
    return null;
  }, [matchedVehicle, inputValue]);

  // Fetch packets from API
  const fetchPackets = async (page = 1) => {
    if (!activeIdentifier) return;
    setLoading(true);
    setError(null);
    try {
      const res = await axiosInstance.get(`/api/vehicles/${activeIdentifier}/messages`, {
        params: { page, limit: recordLimit, date: selectedDate || null }
      });
      if (res.data?.success) {
        setPackets(res.data.data || []);
        if (res.data.pagination) setPagination(res.data.pagination);
      } else {
        setError(res.data?.error || 'Failed to fetch packets.');
      }
    } catch (err) {
      console.error('Terminal fetch error:', err);
      setError(err.response?.data?.error || err.message || 'Server error.');
    } finally {
      setLoading(false);
    }
  };

  // Live Socket.io updates
  useEffect(() => {
    if (!socket || !activeImei) return;
    const handleRaw = (data) => {
      if (data && String(data.imei) === String(activeImei)) {
        setPackets((prev) => {
          if (prev.some(p => p.id && data.id && p.id === data.id)) return prev;
          const updated = [data, ...prev];
          return updated.slice(0, recordLimit);
        });
        setPagination(prev => ({ ...prev, total: prev.total + 1 }));
        setLiveCount(c => c + 1);
      }
    };
    socket.on('raw:update', handleRaw);
    return () => socket.off('raw:update', handleRaw);
  }, [socket, activeImei, recordLimit]);

  // Export to Excel
  const handleExport = () => {
    if (!packets.length) return;
    const rows = packets.map((p, idx) => {
      const { lat, lng, speed, fuel } = extractFields(p);
      const mapsUrl = (lat && lng && lat !== 0 && lng !== 0)
        ? `https://www.google.com/maps?q=${lat},${lng}` : '';
      return {
        'S.No': idx + 1,
        'IMEI': p.imei || '',
        'Server Time (IST)': formatIST(p.received_at),
        'Device / GPS Time (IST)': formatIST(p.device_time),
        'Speed (km/h)': speed != null ? Math.round(speed) : 0,
        'Fuel (L)': fuel != null ? Number(fuel).toFixed(2) : '',
        'Location (Google Maps)': mapsUrl,
        'Raw Packet': p.raw_hex || p.raw || ''
      };
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Terminal');
    XLSX.writeFile(wb, `Terminal_${matchedVehicle?.plate || activeIdentifier || 'data'}_${selectedDate || 'all'}.xlsx`);
  };

  return (
    <div style={{ background: '#F0F4F8', minHeight: '100%', padding: '20px', boxSizing: 'border-box' }}>

      {/* Header Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #1E3A5F 0%, #0F2744 100%)',
        borderRadius: '14px',
        padding: '18px 24px',
        color: '#FFFFFF',
        marginBottom: '18px',
        boxShadow: '0 4px 20px rgba(15, 39, 68, 0.25)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            background: 'rgba(255, 255, 255, 0.15)',
            borderRadius: '10px',
            padding: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <TerminalIcon size={24} color="#7DD3FC" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 800, letterSpacing: '-0.02em' }}>
              Live Terminal
            </h1>
            <p style={{ margin: '2px 0 0', fontSize: '12px', opacity: 0.8 }}>
              Real-time GPS packet stream | IMEI &bull; Server Time &bull; Speed &bull; Location
            </p>
          </div>
        </div>

        {/* Live badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {liveCount > 0 && (
            <div style={{
              background: 'rgba(34, 197, 94, 0.2)',
              border: '1px solid rgba(34, 197, 94, 0.4)',
              borderRadius: '20px',
              padding: '4px 12px',
              fontSize: '12px',
              color: '#86EFAC',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#22C55E', display: 'inline-block', animation: 'pulse 1.5s infinite' }} />
              {liveCount} live packets
            </div>
          )}
          {activeIdentifier && (
            <div style={{
              background: 'rgba(255,255,255,0.1)',
              padding: '6px 12px',
              borderRadius: '8px',
              fontSize: '12px',
              fontFamily: 'monospace',
              color: '#BAE6FD'
            }}>
              {matchedVehicle ? `${matchedVehicle.plate} (${matchedVehicle.imei})` : activeIdentifier}
            </div>
          )}
        </div>
      </div>

      {/* Filter Card */}
      <div style={{
        background: '#FFFFFF',
        borderRadius: '12px',
        border: '1px solid #E2E8F0',
        padding: '18px 22px',
        marginBottom: '18px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '18px',
          alignItems: 'flex-start'
        }}>
          {/* Reg No / IMEI text input (No dropdown, matching Image 1) */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
              Reg No/IMEI :
            </label>
            <div style={{
              border: isInputFocused ? '1.5px solid #EA580C' : '1px solid #CBD5E1',
              borderRadius: '10px',
              padding: '0 12px',
              background: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              minHeight: '42px',
              boxSizing: 'border-box',
              transition: 'all 0.15s ease'
            }}>
              <input
                type="text"
                placeholder="Search IMEI / Reg No / ICCID"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onFocus={() => setIsInputFocused(true)}
                onBlur={() => setIsInputFocused(false)}
                onKeyDown={(e) => { if (e.key === 'Enter') fetchPackets(1); }}
                style={{
                  border: 'none',
                  outline: 'none',
                  background: 'transparent',
                  fontSize: '13px',
                  fontWeight: 500,
                  color: '#0F172A',
                  width: '100%',
                  padding: '9px 0'
                }}
              />
              {inputValue && (
                <button
                  type="button"
                  onClick={() => setInputValue('')}
                  style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94A3B8', padding: '2px', display: 'flex', alignItems: 'center' }}
                >
                  <X size={15} />
                </button>
              )}
            </div>
            {isInputFocused && inputValue.trim().length > 0 && inputValue.trim().length < 4 && (
              <div style={{
                marginTop: '5px',
                padding: '3px 8px',
                background: '#F1F5F9',
                borderRadius: '6px',
                fontSize: '11px',
                color: '#64748B',
                display: 'inline-block'
              }}>
                Enter at least 4 characters
              </div>
            )}
          </div>

          {/* No of Records */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
              No Of Records :
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={recordLimit}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '');
                setRecordLimit(val);
              }}
              onBlur={() => {
                if (!recordLimit || Number(recordLimit) < 1) setRecordLimit(10);
                else if (Number(recordLimit) > 500) setRecordLimit(500);
              }}
              placeholder="10"
              style={{
                width: '100%',
                border: '1px solid #CBD5E1',
                borderRadius: '10px',
                padding: '9px 12px',
                minHeight: '42px',
                fontSize: '13px',
                fontWeight: 600,
                color: '#0F172A',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {/* Date */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
              Date :
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              style={{
                width: '100%',
                border: '1px solid #CBD5E1',
                borderRadius: '10px',
                padding: '9px 12px',
                minHeight: '42px',
                fontSize: '13px',
                fontWeight: 600,
                color: '#0F172A',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {/* Buttons */}
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '24px' }}>
            <button
              onClick={() => fetchPackets(1)}
              disabled={loading || !activeIdentifier}
              style={{
                background: loading || !activeIdentifier ? '#94A3B8' : '#C2410C',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '8px',
                padding: '10px 24px',
                fontSize: '13px',
                fontWeight: 700,
                cursor: loading || !activeIdentifier ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '7px',
                boxShadow: '0 2px 8px rgba(194, 65, 12, 0.25)',
                transition: 'all 0.15s ease'
              }}
            >
              {loading && <Loader2 size={15} className="animate-spin" />}
              Submit
            </button>

            <button
              onClick={handleExport}
              disabled={packets.length === 0}
              title="Export to Excel"
              style={{
                background: '#FFFFFF',
                color: '#334155',
                border: '1px solid #CBD5E1',
                borderRadius: '8px',
                padding: '10px 14px',
                minHeight: '40px',
                cursor: packets.length === 0 ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: packets.length === 0 ? 0.5 : 1,
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
              }}
            >
              <Download size={17} color="#16A34A" />
            </button>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{
          background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: '10px',
          padding: '12px 16px', color: '#991B1B', fontSize: '13px',
          marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px'
        }}>
          <AlertCircle size={16} /> <span>{error}</span>
        </div>
      )}

      {/* Stats Row */}
      {packets.length > 0 && !loading && (
        <div style={{ display: 'flex', gap: '12px', marginBottom: '14px', flexWrap: 'wrap' }}>
          {[
            { icon: <Cpu size={14} />, label: 'Total Packets', value: pagination.total || packets.length, color: '#1E3A5F' },
            { icon: <Clock size={14} />, label: 'Showing', value: packets.length, color: '#0F766E' },
            {
              icon: <Navigation size={14} />, label: 'GPS Valid',
              value: packets.filter(p => { const f = extractFields(p); return f.lat && f.lat !== 0 && f.lng && f.lng !== 0; }).length,
              color: '#16A34A'
            },
          ].map((s, i) => (
            <div key={i} style={{
              background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px',
              padding: '10px 18px', display: 'flex', alignItems: 'center', gap: '10px',
              boxShadow: '0 1px 4px rgba(0,0,0,0.04)'
            }}>
              <div style={{ color: s.color }}>{s.icon}</div>
              <div>
                <div style={{ fontSize: '18px', fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontSize: '11px', color: '#64748B', marginTop: '1px' }}>{s.label}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      <div style={{
        background: '#FFFFFF', borderRadius: '12px',
        border: '1px solid #E2E8F0', boxShadow: '0 2px 10px rgba(0,0,0,0.04)',
        overflow: 'hidden'
      }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: '1200px', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px', tableLayout: 'fixed' }}>
            <thead>
              <tr style={{ background: '#1E3A5F', color: '#F8FAFC' }}>
                <th style={{ padding: '13px 12px', fontWeight: 700, width: '45px', textAlign: 'center', fontSize: '12px' }}>#</th>
                <th style={{ padding: '13px 14px', fontWeight: 700, width: '145px', fontSize: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Cpu size={13} color="#7DD3FC" /> IMEI
                  </div>
                </th>
                <th style={{ padding: '13px 14px', fontWeight: 700, width: '190px', fontSize: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Clock size={13} color="#7DD3FC" /> Server Time (IST)
                  </div>
                </th>
                <th style={{ padding: '13px 12px', fontWeight: 700, width: '100px', fontSize: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Navigation size={13} color="#7DD3FC" /> Speed
                  </div>
                </th>
                <th style={{ padding: '13px 12px', fontWeight: 700, width: '100px', fontSize: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span role="img" aria-label="fuel">⛽</span> Fuel (L)
                  </div>
                </th>
                <th style={{ padding: '13px 14px', fontWeight: 700, width: '150px', fontSize: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <MapPin size={13} color="#7DD3FC" /> Location
                  </div>
                </th>
                <th style={{ padding: '13px 14px', fontWeight: 700, width: '380px', fontSize: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <FileCode size={13} color="#7DD3FC" /> Raw Packet
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" style={{ padding: '60px 20px', textAlign: 'center', color: '#64748B' }}>
                    <Loader2 size={30} className="animate-spin" style={{ margin: '0 auto 12px', color: '#1E3A5F', display: 'block' }} />
                    <div style={{ fontSize: '14px', fontWeight: 600 }}>Loading telemetry packets...</div>
                  </td>
                </tr>
              ) : packets.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ padding: '60px 20px', textAlign: 'center', color: '#94A3B8' }}>
                    <TerminalIcon size={36} style={{ margin: '0 auto 12px', opacity: 0.35, display: 'block' }} />
                    <div style={{ fontSize: '15px', fontWeight: 600, color: '#475569' }}>No telemetry packets found</div>
                    <div style={{ fontSize: '13px', marginTop: '4px', color: '#64748B' }}>
                      Select a vehicle or enter an IMEI and click <b>Submit</b> to query packets.
                    </div>
                  </td>
                </tr>
              ) : (
                packets.map((p, idx) => {
                  const { lat, lng, speed, fuel } = extractFields(p);
                  const hasGps = lat != null && lng != null && lat !== 0 && lng !== 0;
                  const mapsUrl = hasGps
                    ? `https://www.google.com/maps?q=${Number(lat).toFixed(6)},${Number(lng).toFixed(6)}`
                    : null;
                  const rawPacketStr = p.raw_hex || p.raw || '';
                  const isCopied = copiedId === (p.id || idx);

                  return (
                    <tr
                      key={p.id || idx}
                      style={{
                        borderBottom: '1px solid #F1F5F9',
                        background: idx % 2 === 0 ? '#FFFFFF' : '#FAFAFA',
                        transition: 'background 0.1s ease'
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = '#EFF6FF'}
                      onMouseLeave={e => e.currentTarget.style.background = idx % 2 === 0 ? '#FFFFFF' : '#FAFAFA'}
                    >
                      {/* S.No */}
                      <td style={{ padding: '12px 12px', textAlign: 'center', color: '#94A3B8', fontSize: '12px', fontWeight: 600 }}>
                        {(pagination.page - 1) * pagination.limit + idx + 1}
                      </td>

                      {/* IMEI */}
                      <td style={{ padding: '12px 14px', fontFamily: 'monospace', fontWeight: 700, color: '#1E3A5F', fontSize: '12.5px', letterSpacing: '0.02em' }}>
                        {p.imei || '—'}
                      </td>

                      {/* Server Time (IST) */}
                      <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <span style={{ color: '#0F172A', fontWeight: 600, fontSize: '12.5px' }}>
                            {formatIST(p.received_at)}
                          </span>
                          {p.device_time && (
                            <span style={{
                              fontSize: '11px',
                              color: p.device_time.startsWith('2004') ? '#DC2626' : '#64748B',
                              display: 'inline-flex', alignItems: 'center', gap: '4px'
                            }}>
                              <span style={{ fontWeight: 600, color: '#475569' }}>GPS:</span>
                              {formatIST(p.device_time)}
                              {p.device_time.startsWith('2004') && (
                                <span style={{
                                  fontSize: '9.5px', background: '#FEE2E2', color: '#991B1B',
                                  padding: '0 4px', borderRadius: '3px', fontWeight: 700
                                }}>
                                  Unsynced
                                </span>
                              )}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Speed */}
                      <td style={{ padding: '12px 12px' }}>
                        <div style={{
                          display: 'inline-flex', alignItems: 'center', gap: '5px',
                          padding: '4px 10px',
                          borderRadius: '20px',
                          background: speed > 0 ? '#DCFCE7' : '#F1F5F9',
                          color: speed > 0 ? '#15803D' : '#64748B',
                          fontWeight: 700,
                          fontSize: '12px'
                        }}>
                          <Navigation size={11} />
                          {speed != null ? `${Math.round(speed)} km/h` : '0 km/h'}
                        </div>
                      </td>

                      {/* Fuel */}
                      <td style={{ padding: '12px 12px' }}>
                        {fuel != null ? (
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: '4px',
                            padding: '4px 8px', borderRadius: '20px',
                            background: '#FFF7ED', color: '#C2410C',
                            fontWeight: 700, fontSize: '12px'
                          }}>
                            ⛽ {parseFloat(fuel).toFixed(2)} L
                          </span>
                        ) : (
                          <span style={{ color: '#CBD5E1', fontSize: '12px' }}>—</span>
                        )}
                      </td>

                      {/* Location */}
                      <td style={{ padding: '12px 14px' }}>
                        {hasGps ? (
                          <a
                            href={mapsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              color: '#1D4ED8',
                              textDecoration: 'none',
                              fontSize: '12px',
                              fontWeight: 600,
                              padding: '4px 10px',
                              borderRadius: '8px',
                              background: '#EFF6FF',
                              border: '1px solid #BFDBFE',
                              transition: 'all 0.15s ease'
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = '#DBEAFE'; e.currentTarget.style.borderColor = '#93C5FD'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = '#EFF6FF'; e.currentTarget.style.borderColor = '#BFDBFE'; }}
                          >
                            <MapPin size={11} color="#2563EB" />
                            {Number(lat).toFixed(4)}, {Number(lng).toFixed(4)}
                            <ExternalLink size={10} color="#3B82F6" />
                          </a>
                        ) : (
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: '4px',
                            color: '#94A3B8', fontSize: '11.5px', padding: '4px 8px',
                            borderRadius: '8px', background: '#F8FAFC',
                            border: '1px solid #E2E8F0'
                          }}>
                            <MapPin size={11} /> No GPS
                          </span>
                        )}
                      </td>

                      {/* Raw Packet */}
                      <td style={{ padding: '10px 14px' }}>
                        {rawPacketStr ? (
                          <div style={{
                            display: 'flex', alignItems: 'flex-start', gap: '8px',
                            background: '#F8FAFC', border: '1px solid #E2E8F0',
                            borderRadius: '6px', padding: '6px 10px', maxWidth: '100%'
                          }}>
                            <div style={{
                              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                              fontSize: '11px', color: '#1E293B',
                              wordBreak: 'break-all', whiteSpace: 'normal',
                              lineHeight: '1.45', letterSpacing: '0.02em',
                              flex: 1
                            }}>
                              {rawPacketStr}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flexShrink: 0 }}>
                              <button
                                type="button"
                                onClick={() => handleCopy(p.id || idx, rawPacketStr)}
                                title="Copy Raw Packet"
                                style={{
                                  background: isCopied ? '#DCFCE7' : '#FFFFFF',
                                  border: `1px solid ${isCopied ? '#86EFAC' : '#CBD5E1'}`,
                                  borderRadius: '4px', padding: '3px 7px',
                                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px',
                                  fontSize: '11px', fontWeight: 600,
                                  color: isCopied ? '#15803D' : '#475569',
                                  transition: 'all 0.15s ease'
                                }}
                              >
                                {isCopied ? <Check size={11} color="#16A34A" /> : <Copy size={11} />}
                                {isCopied ? 'Copied' : 'Copy'}
                              </button>
                              <button
                                type="button"
                                onClick={() => setModalPacket(p)}
                                title="View Full Packet In Modal"
                                style={{
                                  background: '#EFF6FF',
                                  border: '1px solid #BFDBFE',
                                  borderRadius: '4px', padding: '3px 7px',
                                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px',
                                  fontSize: '11px', fontWeight: 600,
                                  color: '#1D4ED8',
                                  transition: 'all 0.15s ease'
                                }}
                              >
                                <Maximize2 size={11} /> View
                              </button>
                            </div>
                          </div>
                        ) : (
                          <span style={{ color: '#CBD5E1', fontSize: '12px' }}>—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && !loading && (
          <div style={{
            padding: '14px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderTop: '1px solid #F1F5F9',
            background: '#FAFAFA',
            flexWrap: 'wrap',
            gap: '10px'
          }}>
            <span style={{ fontSize: '12px', color: '#64748B' }}>
              Page <b>{pagination.page}</b> of <b>{pagination.totalPages}</b> | {pagination.total} total packets
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                disabled={pagination.page <= 1}
                onClick={() => fetchPackets(pagination.page - 1)}
                style={{
                  padding: '6px 16px', borderRadius: '7px', border: '1px solid #E2E8F0',
                  background: '#FFFFFF', cursor: pagination.page <= 1 ? 'not-allowed' : 'pointer',
                  fontSize: '12px', fontWeight: 600, color: '#334155',
                  opacity: pagination.page <= 1 ? 0.4 : 1
                }}
              >&larr; Prev</button>
              <button
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => fetchPackets(pagination.page + 1)}
                style={{
                  padding: '6px 16px', borderRadius: '7px', border: '1px solid #E2E8F0',
                  background: '#FFFFFF', cursor: pagination.page >= pagination.totalPages ? 'not-allowed' : 'pointer',
                  fontSize: '12px', fontWeight: 600, color: '#334155',
                  opacity: pagination.page >= pagination.totalPages ? 0.4 : 1
                }}
              >Next &rarr;</button>
            </div>
          </div>
        )}
      </div>

      {/* Full Packet Modal */}
      {modalPacket && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(3px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
        }}>
          <div style={{
            background: '#FFFFFF', borderRadius: '14px', width: '100%', maxWidth: '780px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.2)', border: '1px solid #E2E8F0',
            overflow: 'hidden', display: 'flex', flexDirection: 'column'
          }}>
            {/* Header */}
            <div style={{
              background: '#1E3A5F', color: '#FFFFFF', padding: '16px 20px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileCode size={18} color="#7DD3FC" />
                <span style={{ fontWeight: 700, fontSize: '15px' }}>Full Raw Telemetry Packet</span>
              </div>
              <button
                type="button"
                onClick={() => setModalPacket(null)}
                style={{
                  background: 'transparent', border: 'none', color: '#FFFFFF',
                  cursor: 'pointer', padding: '4px', display: 'flex'
                }}
              >
                <X size={20} color="#FFFFFF" />
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', fontSize: '12.5px', color: '#475569' }}>
                <div><b>IMEI:</b> <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{modalPacket.imei}</span></div>
                <div><b>Server Time:</b> {formatIST(modalPacket.received_at)}</div>
                {modalPacket.device_time && <div><b>GPS Time:</b> {formatIST(modalPacket.device_time)}</div>}
                <div><b>Packet Length:</b> {(modalPacket.raw_hex || modalPacket.raw || '').length} characters ({(modalPacket.raw_hex || modalPacket.raw || '').length / 2} bytes)</div>
              </div>

              <div style={{
                background: '#0F172A', color: '#38BDF8', padding: '14px 16px',
                borderRadius: '8px', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                fontSize: '12.5px', lineHeight: '1.6', wordBreak: 'break-all',
                maxHeight: '260px', overflowY: 'auto', border: '1px solid #1E293B',
                letterSpacing: '0.04em'
              }}>
                {modalPacket.raw_hex || modalPacket.raw}
              </div>

              {/* Extra-Data breakdown helper if starts with 3A3A */}
              {(modalPacket.raw_hex || modalPacket.raw || '').startsWith('3A3A') && (
                <div style={{
                  background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '12px 14px',
                  fontSize: '12px', color: '#334155'
                }}>
                  <div style={{ fontWeight: 700, marginBottom: '6px', color: '#1E3A5F' }}>TranSync NAV 140 Structure:</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '4px', fontSize: '11.5px' }}>
                    <span style={{ fontWeight: 600 }}>Header:</span> <span>3A 3A (::)</span>
                    <span style={{ fontWeight: 600 }}>Footer:</span> <span>23 23 (##)</span>
                    <span style={{ fontWeight: 600 }}>Extra Data Tags:</span> <span>Tag 01 (Odometer) • Tag 02 (Fuel / RFID slot) • Tag 05 (Voltage ADC)</span>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{
              background: '#F8FAFC', borderTop: '1px solid #E2E8F0', padding: '12px 20px',
              display: 'flex', justifyContent: 'flex-end', gap: '10px'
            }}>
              <button
                type="button"
                onClick={() => {
                  handleCopy('modal', modalPacket.raw_hex || modalPacket.raw);
                }}
                style={{
                  background: copiedId === 'modal' ? '#DCFCE7' : '#1E3A5F',
                  color: copiedId === 'modal' ? '#15803D' : '#FFFFFF',
                  border: 'none', borderRadius: '7px', padding: '8px 16px',
                  fontWeight: 600, fontSize: '12.5px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '6px'
                }}
              >
                {copiedId === 'modal' ? <Check size={14} color="#16A34A" /> : <Copy size={14} />}
                {copiedId === 'modal' ? 'Copied Full Packet!' : 'Copy Entire Hex'}
              </button>
              <button
                type="button"
                onClick={() => setModalPacket(null)}
                style={{
                  background: '#FFFFFF', color: '#475569', border: '1px solid #CBD5E1',
                  borderRadius: '7px', padding: '8px 16px', fontWeight: 600,
                  fontSize: '12.5px', cursor: 'pointer'
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        .animate-spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default AdminTerminalPage;
