import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Terminal as TerminalIcon, Search, RefreshCw, Download,
  MapPin, AlertCircle, Loader2, X, Navigation, Clock, Cpu, ExternalLink, ChevronDown
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
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [inputValue, setInputValue] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const [recordLimit, setRecordLimit] = useState(50);
  const [selectedDate, setSelectedDate] = useState(getTodayString());

  const [packets, setPackets] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(false);
  const [fetchingVehicles, setFetchingVehicles] = useState(true);
  const [error, setError] = useState(null);
  const [liveCount, setLiveCount] = useState(0);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Fetch vehicles list
  useEffect(() => {
    const fetchList = async () => {
      setFetchingVehicles(true);
      try {
        const res = await axiosInstance.get('/api/vehicles');
        const list = Array.isArray(res.data?.data)
          ? res.data.data
          : (Array.isArray(res.data?.vehicles) ? res.data.vehicles : []);
        setVehicles(list);
        if (list.length > 0) {
          const first = list[0];
          setSelectedVehicle(first);
          setInputValue(`${first.plate} (${first.imei})`);
        }
      } catch (err) {
        console.error('Failed to load vehicles:', err);
      } finally {
        setFetchingVehicles(false);
      }
    };
    fetchList();
  }, []);

  // Active identifier: vehicle ID or typed 15-digit IMEI
  const activeIdentifier = useMemo(() => {
    if (selectedVehicle?.id) return selectedVehicle.id;
    if (selectedVehicle?.imei) return selectedVehicle.imei;
    const clean = inputValue.trim();
    if (/^\d{15}$/.test(clean)) return clean;
    const match = clean.match(/\((\d{15})\)/);
    if (match) return match[1];
    return clean;
  }, [selectedVehicle, inputValue]);

  const activeImei = useMemo(() => {
    return selectedVehicle?.imei || (String(activeIdentifier).length === 15 ? activeIdentifier : null);
  }, [selectedVehicle, activeIdentifier]);

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

  // Fetch on vehicle selection change
  useEffect(() => {
    if (activeIdentifier) fetchPackets(1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVehicle]);

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

  // Filter vehicles for dropdown
  const filteredVehicles = useMemo(() => {
    if (!inputValue) return vehicles;
    const q = inputValue.toLowerCase().trim();
    const cleanQ = q.includes('(') ? q.split('(')[0].trim() : q;
    return vehicles.filter(v =>
      (v.plate && v.plate.toLowerCase().includes(cleanQ)) ||
      (v.imei && v.imei.includes(cleanQ))
    );
  }, [vehicles, inputValue]);

  const isExactImei = /^\d{15}$/.test(inputValue.trim());

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
        'Server Time (IST)': formatIST(p.device_time || p.received_at),
        'Speed (km/h)': speed != null ? Math.round(speed) : 0,
        'Fuel (L)': fuel != null ? Number(fuel).toFixed(2) : '',
        'Location (Google Maps)': mapsUrl
      };
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Terminal');
    XLSX.writeFile(wb, `Terminal_${selectedVehicle?.plate || activeIdentifier}_${selectedDate || 'all'}.xlsx`);
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
              {selectedVehicle?.plate || 'Direct IMEI'} | {selectedVehicle?.imei || activeIdentifier}
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
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '18px',
          alignItems: 'flex-end'
        }}>
          {/* Vehicle / IMEI selector */}
          <div style={{ position: 'relative' }} ref={dropdownRef}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Reg No / IMEI
            </label>
            <div style={{
              border: '1.5px solid #3B82F6',
              borderRadius: '8px',
              padding: '0 10px',
              background: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              minHeight: '38px'
            }}>
              <input
                type="text"
                placeholder="Search plate or IMEI..."
                value={inputValue}
                onChange={(e) => {
                  setInputValue(e.target.value);
                  setIsDropdownOpen(true);
                  const val = e.target.value.trim().toLowerCase();
                  const exact = vehicles.find(v => v.plate?.toLowerCase() === val || v.imei === val);
                  setSelectedVehicle(exact || null);
                }}
                onFocus={() => setIsDropdownOpen(true)}
                onKeyDown={(e) => { if (e.key === 'Enter') { setIsDropdownOpen(false); fetchPackets(1); } }}
                style={{
                  border: 'none', outline: 'none', background: 'transparent',
                  fontSize: '13px', fontWeight: 600, color: '#0F172A', width: '100%', padding: '8px 4px'
                }}
              />
              {inputValue && (
                <button type="button" onClick={() => { setInputValue(''); setSelectedVehicle(null); setIsDropdownOpen(true); }}
                  style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94A3B8', padding: '2px' }}>
                  <X size={14} />
                </button>
              )}
              <ChevronDown
                size={14}
                color="#3B82F6"
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                style={{ marginLeft: '4px', cursor: 'pointer', flexShrink: 0 }}
              />
            </div>

            {isDropdownOpen && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
                marginTop: '4px', background: '#FFF', borderRadius: '10px',
                border: '1px solid #CBD5E1', boxShadow: '0 10px 25px rgba(0,0,0,0.12)',
                maxHeight: '240px', display: 'flex', flexDirection: 'column', overflow: 'hidden'
              }}>
                {isExactImei && !vehicles.some(v => v.imei === inputValue.trim()) && (
                  <div onClick={() => { setSelectedVehicle({ id: inputValue.trim(), plate: 'Custom IMEI', imei: inputValue.trim() }); setIsDropdownOpen(false); }}
                    style={{ padding: '10px 12px', background: '#EFF6FF', borderBottom: '1px solid #DBEAFE', cursor: 'pointer', fontSize: '12px', fontWeight: 700, color: '#1D4ED8' }}>
                    ⚡ Use direct IMEI: <b>{inputValue.trim()}</b>
                  </div>
                )}
                <div style={{ overflowY: 'auto', flex: 1 }}>
                  {filteredVehicles.length === 0 ? (
                    <div style={{ padding: '16px', fontSize: '12px', color: '#94A3B8', textAlign: 'center' }}>No vehicles found</div>
                  ) : filteredVehicles.map(v => (
                    <div key={v.id}
                      onClick={() => { setSelectedVehicle(v); setInputValue(`${v.plate} (${v.imei})`); setIsDropdownOpen(false); }}
                      style={{
                        padding: '9px 12px', fontSize: '12px', cursor: 'pointer',
                        borderBottom: '1px solid #F8FAFC',
                        background: selectedVehicle?.id === v.id ? '#EFF6FF' : 'transparent',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'}
                      onMouseLeave={e => e.currentTarget.style.background = selectedVehicle?.id === v.id ? '#EFF6FF' : 'transparent'}
                    >
                      <span style={{ fontWeight: 600, color: '#0F172A' }}>{v.plate}</span>
                      <span style={{ fontSize: '11px', color: '#64748B', fontFamily: 'monospace' }}>{v.imei}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* No of Records */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              No. of Records
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
                if (!recordLimit || Number(recordLimit) < 1) setRecordLimit(50);
                else if (Number(recordLimit) > 500) setRecordLimit(500);
              }}
              placeholder="e.g. 50"
              style={{
                width: '100%', border: '1.5px solid #E2E8F0', borderRadius: '8px',
                padding: '9px 12px', fontSize: '13px', fontWeight: 600, color: '#0F172A',
                outline: 'none', boxSizing: 'border-box'
              }}
            />
          </div>

          {/* Date */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Date
            </label>
            <input
              type="date" value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              style={{
                width: '100%', border: '1.5px solid #E2E8F0', borderRadius: '8px',
                padding: '9px 12px', fontSize: '13px', fontWeight: 600, color: '#0F172A',
                outline: 'none', boxSizing: 'border-box'
              }}
            />
          </div>

          {/* Buttons */}
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button
              onClick={() => fetchPackets(1)}
              disabled={loading || !activeIdentifier}
              style={{
                background: loading || !activeIdentifier ? '#94A3B8' : '#1E3A5F',
                color: '#FFFFFF', border: 'none', borderRadius: '8px',
                padding: '9px 22px', fontSize: '13px', fontWeight: 700,
                cursor: loading || !activeIdentifier ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', gap: '7px',
                boxShadow: '0 2px 8px rgba(30, 58, 95, 0.25)',
                transition: 'all 0.15s ease'
              }}
            >
              {loading ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
              Submit
            </button>

            <button
              onClick={handleExport}
              disabled={packets.length === 0}
              title="Export to Excel"
              style={{
                background: '#FFFFFF', color: '#334155',
                border: '1.5px solid #E2E8F0', borderRadius: '8px',
                padding: '9px 14px', cursor: packets.length === 0 ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
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
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px', tableLayout: 'fixed' }}>
            <thead>
              <tr style={{ background: '#1E3A5F', color: '#F8FAFC' }}>
                <th style={{ padding: '13px 14px', fontWeight: 700, width: '6%', textAlign: 'center', fontSize: '12px' }}>#</th>
                <th style={{ padding: '13px 16px', fontWeight: 700, width: '20%', fontSize: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Cpu size={13} color="#7DD3FC" /> IMEI
                  </div>
                </th>
                <th style={{ padding: '13px 16px', fontWeight: 700, width: '22%', fontSize: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Clock size={13} color="#7DD3FC" /> Server Time (IST)
                  </div>
                </th>
                <th style={{ padding: '13px 16px', fontWeight: 700, width: '13%', fontSize: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Navigation size={13} color="#7DD3FC" /> Speed
                  </div>
                </th>
                <th style={{ padding: '13px 16px', fontWeight: 700, width: '13%', fontSize: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span role="img" aria-label="fuel">⛽</span> Fuel (L)
                  </div>
                </th>
                <th style={{ padding: '13px 16px', fontWeight: 700, width: '26%', fontSize: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <MapPin size={13} color="#7DD3FC" /> Location (Google Maps)
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6" style={{ padding: '60px 20px', textAlign: 'center', color: '#64748B' }}>
                    <Loader2 size={30} className="animate-spin" style={{ margin: '0 auto 12px', color: '#1E3A5F', display: 'block' }} />
                    <div style={{ fontSize: '14px', fontWeight: 600 }}>Loading telemetry packets...</div>
                  </td>
                </tr>
              ) : packets.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ padding: '60px 20px', textAlign: 'center', color: '#94A3B8' }}>
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
                      <td style={{ padding: '12px 16px', textAlign: 'center', color: '#94A3B8', fontSize: '12px', fontWeight: 600 }}>
                        {(pagination.page - 1) * pagination.limit + idx + 1}
                      </td>

                      {/* IMEI */}
                      <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontWeight: 700, color: '#1E3A5F', fontSize: '12.5px', letterSpacing: '0.02em' }}>
                        {p.imei || '—'}
                      </td>

                      {/* Server Time */}
                      <td style={{ padding: '12px 16px', color: '#334155', fontSize: '12.5px', whiteSpace: 'nowrap' }}>
                        {formatIST(p.device_time || p.received_at)}
                      </td>

                      {/* Speed */}
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{
                          display: 'inline-flex', alignItems: 'center', gap: '5px',
                          padding: '4px 12px',
                          borderRadius: '20px',
                          background: speed > 0 ? '#DCFCE7' : '#F1F5F9',
                          color: speed > 0 ? '#15803D' : '#64748B',
                          fontWeight: 700,
                          fontSize: '12.5px'
                        }}>
                          <Navigation size={11} />
                          {speed != null ? `${Math.round(speed)} km/h` : '0 km/h'}
                        </div>
                      </td>

                      {/* Fuel */}
                      <td style={{ padding: '12px 16px' }}>
                        {fuel != null ? (
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: '4px',
                            padding: '4px 10px', borderRadius: '20px',
                            background: '#FFF7ED', color: '#C2410C',
                            fontWeight: 700, fontSize: '12.5px'
                          }}>
                            ⛽ {parseFloat(fuel).toFixed(2)} L
                          </span>
                        ) : (
                          <span style={{ color: '#CBD5E1', fontSize: '12px' }}>—</span>
                        )}
                      </td>

                      {/* Location */}
                      <td style={{ padding: '12px 16px' }}>
                        {hasGps ? (
                          <a
                            href={mapsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              color: '#1D4ED8',
                              textDecoration: 'none',
                              fontSize: '12.5px',
                              fontWeight: 600,
                              padding: '5px 12px',
                              borderRadius: '8px',
                              background: '#EFF6FF',
                              border: '1px solid #BFDBFE',
                              transition: 'all 0.15s ease'
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = '#DBEAFE'; e.currentTarget.style.borderColor = '#93C5FD'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = '#EFF6FF'; e.currentTarget.style.borderColor = '#BFDBFE'; }}
                          >
                            <MapPin size={12} color="#2563EB" />
                            {Number(lat).toFixed(5)}, {Number(lng).toFixed(5)}
                            <ExternalLink size={11} color="#3B82F6" />
                          </a>
                        ) : (
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: '5px',
                            color: '#94A3B8', fontSize: '12px', padding: '5px 10px',
                            borderRadius: '8px', background: '#F8FAFC',
                            border: '1px solid #E2E8F0'
                          }}>
                            <MapPin size={12} /> No GPS
                          </span>
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
