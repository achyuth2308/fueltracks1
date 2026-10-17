import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Terminal as TerminalIcon, Search, Calendar, RefreshCw, Download,
  Copy, Check, ChevronLeft, ChevronRight, AlertCircle, Loader2,
  FileSpreadsheet, Filter, CheckCircle2, XCircle, ArrowUpDown, X
} from 'lucide-react';
import * as XLSX from 'xlsx';
import axiosInstance from '../../api/axios';
import { useSocket } from '../../hooks/useSocket';

function formatTerminalDateTime(isoString) {
  if (!isoString) return '—';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '—';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return `${day}-${month}-${year} ${hours}:${minutes} ${ampm}`;
  } catch (e) {
    return '—';
  }
}

function formatTerminalDate(isoString) {
  if (!isoString) return '—';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '—';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  } catch (e) {
    return '—';
  }
}

function formatTerminalTime(isoString) {
  if (!isoString) return '—';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '—';
    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return `${hours}:${minutes} ${ampm}`;
  } catch (e) {
    return '—';
  }
}

function getTodayString() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function extractParsedData(m) {
  let p = {};
  if (m.parsed_data) {
    if (typeof m.parsed_data === 'string') {
      try { p = JSON.parse(m.parsed_data); } catch (e) { p = {}; }
    } else if (typeof m.parsed_data === 'object') {
      p = m.parsed_data;
    }
  }
  return {
    ...m,
    fuel: p.fuel != null ? p.fuel : (m.fuel != null ? m.fuel : null),
    serial: p.serial || p.serialData || p.rfid || m.serial || m.rfid || null,
    voltage: p.voltage != null ? p.voltage : (m.voltage != null ? m.voltage : null),
    battery: p.battery != null ? p.battery : (m.battery != null ? m.battery : null),
    ignition: p.ignition !== undefined ? p.ignition : (m.ignition !== undefined ? m.ignition : null),
    speed: p.speed != null ? p.speed : (m.speed != null ? m.speed : 0),
    lat: p.lat != null ? p.lat : (m.lat != null ? m.lat : null),
    lng: p.lng != null ? p.lng : (m.lng != null ? m.lng : null),
    gpsValid: p.gpsValid || m.gpsValid || (m.parsed ? 'A' : 'V'),
    direction: p.direction != null ? p.direction : (m.direction != null ? m.direction : null),
    satellites: p.satellites != null ? p.satellites : (m.satellites != null ? m.satellites : null),
    gsmSignal: p.gsmSignal != null ? p.gsmSignal : (m.gsmSignal != null ? m.gsmSignal : null),
    lac: p.lac || m.lac || null,
    cellId: p.cellId || m.cellId || null,
    output1: p.output1 !== undefined ? p.output1 : (m.output1 !== undefined ? m.output1 : null),
    alertText: p.alertText || m.alertText || null,
    alertType: p.alertType || m.alertType || null,
    rawParsed: p
  };
}

const AdminTerminalPage = () => {
  const { socket } = useSocket();

  // State
  const [vehicles, setVehicles] = useState([]);
  const [selectedVehicle, setSelectedVehicle] = useState(null); // { id, plate, imei }
  const [inputValue, setInputValue] = useState(''); // text typed by user in selector
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const [recordLimit, setRecordLimit] = useState(10);
  const [selectedDate, setSelectedDate] = useState(getTodayString());
  const [activeTab, setActiveTab] = useState('raw'); // 'raw' | 'parsed'

  const [packets, setPackets] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(false);
  const [fetchingVehicles, setFetchingVehicles] = useState(true);
  const [error, setError] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch all vehicles for selector
  useEffect(() => {
    const fetchVehiclesList = async () => {
      setFetchingVehicles(true);
      try {
        const res = await axiosInstance.get('/api/vehicles');
        // Backend returns: { success: true, data: [...] }
        const list = Array.isArray(res.data?.data)
          ? res.data.data
          : (Array.isArray(res.data?.vehicles) ? res.data.vehicles : []);

        setVehicles(list);

        // Default to AP07TH2233 or first vehicle
        const target = list.find(v => v.plate === 'AP07TH2233' || v.imei === '868329088498955') || list[0];
        if (target) {
          setSelectedVehicle(target);
          setInputValue(`${target.plate} (${target.imei})`);
        }
      } catch (err) {
        console.error('Failed to load vehicles list for terminal:', err);
      } finally {
        setFetchingVehicles(false);
      }
    };
    fetchVehiclesList();
  }, []);

  // Get active identifier (vehicle ID or typed IMEI)
  const activeIdentifier = useMemo(() => {
    if (selectedVehicle?.id) return selectedVehicle.id;
    if (selectedVehicle?.imei) return selectedVehicle.imei;
    const clean = inputValue.trim();
    if (/^\d{15}$/.test(clean)) return clean;
    // Extract IMEI from "PLATE (IMEI)" if present
    const match = clean.match(/\((\d{15})\)/);
    if (match) return match[1];
    return clean;
  }, [selectedVehicle, inputValue]);

  // Fetch packets
  const fetchPackets = async (page = 1) => {
    if (!activeIdentifier) return;
    setLoading(true);
    setError(null);
    try {
      const res = await axiosInstance.get(`/api/vehicles/${activeIdentifier}/messages`, {
        params: {
          page,
          limit: recordLimit,
          date: selectedDate || null
        }
      });
      if (res.data?.success) {
        const extracted = (res.data.data || []).map(extractParsedData);
        setPackets(extracted);
        if (res.data.pagination) {
          setPagination(res.data.pagination);
        }
      } else {
        setError(res.data?.error || 'Failed to fetch terminal packets.');
      }
    } catch (err) {
      console.error('Error fetching terminal packets:', err);
      setError(err.response?.data?.error || err.message || 'Error communicating with server.');
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch when vehicle selection changes
  useEffect(() => {
    if (activeIdentifier) {
      fetchPackets(1);
    }
  }, [selectedVehicle]);

  // Live Socket.io updates for selected vehicle
  useEffect(() => {
    if (!socket || !activeIdentifier) return;

    const currentImei = selectedVehicle?.imei || (String(activeIdentifier).length === 15 ? activeIdentifier : null);
    if (!currentImei) return;

    const handleRawUpdate = (data) => {
      if (data && String(data.imei) === String(currentImei)) {
        const newMsg = extractParsedData(data);
        setPackets((prev) => {
          if (prev.some(p => p.id && newMsg.id && p.id === newMsg.id)) {
            return prev;
          }
          const updated = [newMsg, ...prev];
          return updated.slice(0, recordLimit);
        });
        setPagination(prev => ({ ...prev, total: prev.total + 1 }));
      }
    };

    socket.on('raw:update', handleRawUpdate);
    return () => {
      socket.off('raw:update', handleRawUpdate);
    };
  }, [socket, activeIdentifier, selectedVehicle, recordLimit]);

  // Filter vehicles for dropdown
  const filteredVehicles = useMemo(() => {
    if (!inputValue) return vehicles;
    const q = inputValue.toLowerCase().trim();
    // Ignore parenthesized imei for filtering if already selected
    const cleanQ = q.includes('(') ? q.split('(')[0].trim() : q;
    return vehicles.filter(v =>
      (v.plate && v.plate.toLowerCase().includes(cleanQ)) ||
      (v.imei && v.imei.toLowerCase().includes(cleanQ))
    );
  }, [vehicles, inputValue]);

  const isExactImei = useMemo(() => {
    const clean = inputValue.trim();
    return /^\d{15}$/.test(clean);
  }, [inputValue]);

  const handleCopyRaw = (text, id) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleExportExcel = () => {
    if (!packets || packets.length === 0) return;

    let exportRows = [];
    if (activeTab === 'raw') {
      exportRows = packets.map(p => ({
        'IMEI': p.imei || '',
        'Time': formatTerminalDateTime(p.device_time || p.received_at),
        'Valid': p.parsed ? 'true' : (p.gpsValid === 'A' ? 'true' : 'false'),
        'Raw Data': p.raw_hex || p.raw || '',
        'Source': 'INDIA',
        'Processed': 'true'
      }));
    } else {
      exportRows = packets.map((p, idx) => ({
        'S.No': (pagination.page - 1) * pagination.limit + idx + 1,
        'Date': formatTerminalDate(p.device_time || p.received_at),
        'Format': p.packet_type ? p.packet_type.replace('_NORMAL', '') : 'VT02',
        'Command': p.rawParsed?.command || 'DAT',
        'Time': formatTerminalTime(p.device_time || p.received_at),
        'Engine': p.ignition ? 'On' : 'Off',
        'ADC': p.rawParsed?.adc2Mv || p.rawParsed?.adc1Mv || 0,
        'Temperature': p.rawParsed?.temperature != null ? `${p.rawParsed.temperature}°C` : 'N/A',
        'GSM': p.gsmSignal != null ? p.gsmSignal : '—',
        'Satellites': p.satellites != null ? p.satellites : '—',
        'Accuracy': p.rawParsed?.hdop || 0,
        'Latitude': p.lat != null ? Number(p.lat).toFixed(6) : '—',
        'Longitude': p.lng != null ? Number(p.lng).toFixed(6) : '—',
        'Speed': p.speed != null ? `${Math.round(p.speed)} km/h` : '0 km/h',
        'Voltage': p.voltage != null ? `${p.voltage} V` : '—',
        'Fuel (L)': p.fuel != null ? `${p.fuel} L` : '—'
      }));
    }

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, activeTab === 'raw' ? 'RawData' : 'ParsedData');
    const fileName = `Terminal_${selectedVehicle?.plate || activeIdentifier}_${activeTab}_${selectedDate || 'all'}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  return (
    <div style={{ background: '#F8FAFC', minHeight: '100%', padding: '24px', boxSizing: 'border-box' }}>
      
      {/* Top Breadcrumb & Page Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #0F766E 0%, #115E59 100%)',
        borderRadius: '16px',
        padding: '20px 24px',
        color: '#FFFFFF',
        marginBottom: '20px',
        boxShadow: '0 4px 14px rgba(15, 118, 110, 0.15)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            background: 'rgba(255, 255, 255, 0.18)',
            borderRadius: '12px',
            padding: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <TerminalIcon size={26} color="#FFFFFF" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 800, letterSpacing: '-0.02em' }}>
                Terminal
              </h1>
              <span style={{
                background: 'rgba(255, 255, 255, 0.2)',
                padding: '3px 8px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '0.04em'
              }}>
                RAW & PARSED PACKET STREAM
              </span>
            </div>
            <p style={{ margin: '3px 0 0', fontSize: '13px', opacity: 0.85 }}>
              Inspect live incoming hexadecimal and decoded sensor packets from GPS trackers.
            </p>
          </div>
        </div>

        {activeIdentifier && (
          <div style={{
            background: 'rgba(0, 0, 0, 0.2)',
            padding: '8px 14px',
            borderRadius: '10px',
            fontSize: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <span style={{ opacity: 0.8 }}>Target:</span>
            <span style={{ fontWeight: 700, color: '#A7F3D0' }}>{selectedVehicle?.plate || 'Device IMEI'}</span>
            <span style={{ opacity: 0.6 }}>•</span>
            <span style={{ fontFamily: 'monospace' }}>{selectedVehicle?.imei || activeIdentifier}</span>
          </div>
        )}
      </div>

      {/* Filter Control Card */}
      <div style={{
        background: '#FFFFFF',
        borderRadius: '14px',
        border: '1px solid #E2E8F0',
        padding: '20px 24px',
        marginBottom: '20px',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)'
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '20px',
          alignItems: 'flex-end'
        }}>

          {/* Reg No / IMEI Editable Search Dropdown */}
          <div style={{ position: 'relative' }} ref={dropdownRef}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
              Reg No/IMEI :
            </label>
            <div
              style={{
                border: '1.5px solid #F97316',
                borderRadius: '8px',
                padding: '2px 8px',
                background: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                minHeight: '38px',
                boxSizing: 'border-box'
              }}
            >
              <input
                type="text"
                placeholder="Type plate or IMEI (e.g. 861329...)"
                value={inputValue}
                onChange={(e) => {
                  setInputValue(e.target.value);
                  setIsDropdownOpen(true);
                  // If cleared or changed, check if exact match
                  const val = e.target.value.trim().toLowerCase();
                  const exact = vehicles.find(v => v.plate?.toLowerCase() === val || v.imei === val);
                  if (exact) {
                    setSelectedVehicle(exact);
                  } else {
                    setSelectedVehicle(null);
                  }
                }}
                onFocus={() => setIsDropdownOpen(true)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setIsDropdownOpen(false);
                    fetchPackets(1);
                  }
                }}
                style={{
                  border: 'none',
                  outline: 'none',
                  background: 'transparent',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: '#0F172A',
                  width: '100%',
                  padding: '6px 4px'
                }}
              />

              {inputValue && (
                <button
                  type="button"
                  onClick={() => {
                    setInputValue('');
                    setSelectedVehicle(null);
                    setIsDropdownOpen(true);
                  }}
                  style={{
                    border: 'none',
                    background: 'none',
                    cursor: 'pointer',
                    padding: '2px',
                    color: '#94A3B8'
                  }}
                >
                  <X size={15} />
                </button>
              )}

              <span
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                style={{ color: '#F97316', fontSize: '10px', marginLeft: '6px', cursor: 'pointer', padding: '4px' }}
              >
                ▼
              </span>
            </div>

            {/* Dropdown Menu */}
            {isDropdownOpen && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                zIndex: 50,
                marginTop: '4px',
                background: '#FFFFFF',
                borderRadius: '10px',
                border: '1px solid #CBD5E1',
                boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
                maxHeight: '260px',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden'
              }}>
                {/* Direct IMEI fallback option if typed 15 digits */}
                {isExactImei && !vehicles.some(v => v.imei === inputValue.trim()) && (
                  <div
                    onClick={() => {
                      setSelectedVehicle({ id: inputValue.trim(), plate: 'Custom IMEI', imei: inputValue.trim() });
                      setIsDropdownOpen(false);
                    }}
                    style={{
                      padding: '10px 12px',
                      background: '#EFF6FF',
                      borderBottom: '1px solid #DBEAFE',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: 700,
                      color: '#1D4ED8',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    <span>Use direct IMEI: <b>{inputValue.trim()}</b></span>
                  </div>
                )}

                <div style={{ overflowY: 'auto', flex: 1 }}>
                  {filteredVehicles.length === 0 ? (
                    <div style={{ padding: '16px', fontSize: '12px', color: '#94A3B8', textAlign: 'center' }}>
                      {isExactImei ? (
                        <span>Press <b>Submit</b> to query IMEI: <code>{inputValue.trim()}</code></span>
                      ) : (
                        <span>No vehicles matching "{inputValue}"</span>
                      )}
                    </div>
                  ) : (
                    filteredVehicles.map(v => (
                      <div
                        key={v.id}
                        onClick={() => {
                          setSelectedVehicle(v);
                          setInputValue(`${v.plate} (${v.imei})`);
                          setIsDropdownOpen(false);
                        }}
                        style={{
                          padding: '8px 12px',
                          fontSize: '12px',
                          cursor: 'pointer',
                          borderBottom: '1px solid #F8FAFC',
                          background: selectedVehicle?.id === v.id ? '#FFF7ED' : 'transparent',
                          color: selectedVehicle?.id === v.id ? '#C2410C' : '#1E293B',
                          fontWeight: selectedVehicle?.id === v.id ? 700 : 500,
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#F1F5F9'}
                        onMouseLeave={(e) => e.currentTarget.style.background = selectedVehicle?.id === v.id ? '#FFF7ED' : 'transparent'}
                      >
                        <span style={{ fontWeight: 600 }}>{v.plate}</span>
                        <span style={{ fontSize: '11px', color: '#64748B', fontFamily: 'monospace' }}>{v.imei}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* No Of Records */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
              No Of Records :
            </label>
            <input
              type="number"
              min="1"
              max="500"
              value={recordLimit}
              onChange={(e) => setRecordLimit(Math.max(1, parseInt(e.target.value) || 10))}
              style={{
                width: '100%',
                border: '1px solid #CBD5E1',
                borderRadius: '8px',
                padding: '8px 12px',
                fontSize: '13px',
                fontWeight: 600,
                color: '#0F172A',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {/* Date Picker */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
              Date :
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              style={{
                width: '100%',
                border: '1px solid #CBD5E1',
                borderRadius: '8px',
                padding: '8px 12px',
                fontSize: '13px',
                fontWeight: 600,
                color: '#0F172A',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={() => fetchPackets(1)}
              disabled={loading || !activeIdentifier}
              style={{
                background: '#C2410C',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '8px',
                padding: '9px 24px',
                fontSize: '14px',
                fontWeight: 700,
                cursor: loading || !activeIdentifier ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 2px 8px rgba(194, 65, 12, 0.25)',
                opacity: loading || !activeIdentifier ? 0.7 : 1,
                transition: 'all 0.15s ease'
              }}
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : null}
              <span>Submit</span>
            </button>

            <button
              onClick={handleExportExcel}
              disabled={packets.length === 0}
              title="Export table to Excel"
              style={{
                background: '#FFFFFF',
                color: '#334155',
                border: '1px solid #CBD5E1',
                borderRadius: '8px',
                padding: '9px 14px',
                cursor: packets.length === 0 ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                opacity: packets.length === 0 ? 0.5 : 1
              }}
            >
              <Download size={18} color="#0F766E" />
            </button>
          </div>

        </div>
      </div>

      {/* Tabs Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '24px',
        borderBottom: '2px solid #E2E8F0',
        marginBottom: '16px',
        paddingLeft: '4px'
      }}>
        <button
          onClick={() => setActiveTab('raw')}
          style={{
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'raw' ? '3px solid #C2410C' : '3px solid transparent',
            padding: '10px 16px',
            fontSize: '14px',
            fontWeight: 700,
            color: activeTab === 'raw' ? '#C2410C' : '#64748B',
            cursor: 'pointer',
            marginBottom: '-2px',
            transition: 'all 0.15s ease'
          }}
        >
          RawData
        </button>

        <button
          onClick={() => setActiveTab('parsed')}
          style={{
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'parsed' ? '3px solid #C2410C' : '3px solid transparent',
            padding: '10px 16px',
            fontSize: '14px',
            fontWeight: 700,
            color: activeTab === 'parsed' ? '#C2410C' : '#64748B',
            cursor: 'pointer',
            marginBottom: '-2px',
            transition: 'all 0.15s ease'
          }}
        >
          Parsed Data
        </button>
      </div>

      {/* Error Alert */}
      {error && (
        <div style={{
          background: '#FEF2F2',
          border: '1px solid #FCA5A5',
          borderRadius: '10px',
          padding: '12px 16px',
          color: '#991B1B',
          fontSize: '13px',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Main Table Card */}
      <div style={{
        background: '#FFFFFF',
        borderRadius: '12px',
        border: '1px solid #E2E8F0',
        boxShadow: '0 2px 10px rgba(0, 0, 0, 0.03)',
        overflow: 'hidden'
      }}>

        {loading ? (
          <div style={{ padding: '60px', textAlign: 'center', color: '#64748B' }}>
            <Loader2 size={32} className="animate-spin" style={{ margin: '0 auto 12px', color: '#0F766E' }} />
            <div style={{ fontSize: '14px', fontWeight: 600 }}>Loading terminal packets...</div>
          </div>
        ) : packets.length === 0 ? (
          <div style={{ padding: '60px', textAlign: 'center', color: '#94A3B8' }}>
            <TerminalIcon size={40} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
            <div style={{ fontSize: '15px', fontWeight: 600, color: '#475569' }}>No packets found</div>
            <div style={{ fontSize: '13px', marginTop: '4px' }}>
              Select a vehicle or enter an IMEI and click <b>Submit</b> to query raw & parsed packets.
            </div>
          </div>
        ) : activeTab === 'raw' ? (

          /* ── TAB 1: RAW DATA TABLE ── */
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12.5px' }}>
              <thead>
                <tr style={{ background: '#1E293B', color: '#F8FAFC', fontWeight: 700, borderBottom: '1px solid #0F172A' }}>
                  <th style={{ padding: '12px 16px', width: '160px' }}>imei</th>
                  <th style={{ padding: '12px 16px', width: '180px' }}>time</th>
                  <th style={{ padding: '12px 16px', width: '90px' }}>valid</th>
                  <th style={{ padding: '12px 16px' }}>data</th>
                  <th style={{ padding: '12px 16px', width: '100px' }}>source</th>
                  <th style={{ padding: '12px 16px', width: '100px' }}>processed</th>
                </tr>
              </thead>
              <tbody>
                {packets.map((p, idx) => {
                  const rawContent = p.raw_hex || p.raw || '—';
                  const isValid = p.parsed ? true : (p.gpsValid === 'A');
                  const isCopied = copiedId === (p.id || idx);

                  return (
                    <tr
                      key={p.id || idx}
                      style={{
                        borderBottom: '1px solid #F1F5F9',
                        background: idx % 2 === 0 ? '#FFFFFF' : '#F8FAFC',
                        transition: 'background 0.1s ease'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#F1F5F9'}
                      onMouseLeave={(e) => e.currentTarget.style.background = idx % 2 === 0 ? '#FFFFFF' : '#F8FAFC'}
                    >
                      {/* IMEI */}
                      <td style={{ padding: '12px 16px', fontWeight: 600, color: '#334155', fontFamily: 'monospace' }}>
                        {p.imei || '—'}
                      </td>

                      {/* Time */}
                      <td style={{ padding: '12px 16px', color: '#475569', whiteSpace: 'nowrap' }}>
                        {formatTerminalDateTime(p.device_time || p.received_at)}
                      </td>

                      {/* Valid */}
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{
                          color: isValid ? '#16A34A' : '#DC2626',
                          fontWeight: 700,
                          fontSize: '12px'
                        }}>
                          {isValid ? 'true' : 'false'}
                        </span>
                      </td>

                      {/* Data (Raw string monospace) */}
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{
                            fontFamily: 'Consolas, Monaco, monospace',
                            fontSize: '11.5px',
                            color: '#0F172A',
                            wordBreak: 'break-all',
                            lineHeight: 1.4
                          }}>
                            {rawContent}
                          </span>
                          <button
                            onClick={() => handleCopyRaw(rawContent, p.id || idx)}
                            title="Copy packet"
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              padding: '3px',
                              borderRadius: '4px',
                              color: isCopied ? '#16A34A' : '#94A3B8',
                              flexShrink: 0
                            }}
                          >
                            {isCopied ? <Check size={14} /> : <Copy size={14} />}
                          </button>
                        </div>
                      </td>

                      {/* Source */}
                      <td style={{ padding: '12px 16px', fontWeight: 600, color: '#475569' }}>
                        INDIA
                      </td>

                      {/* Processed */}
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ color: '#16A34A', fontWeight: 700 }}>
                          true
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

        ) : (

          /* ── TAB 2: PARSED DATA TABLE ── */
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12.5px', whiteSpace: 'nowrap' }}>
              <thead>
                <tr style={{ background: '#1E293B', color: '#F8FAFC', fontWeight: 700, borderBottom: '1px solid #0F172A' }}>
                  <th style={{ padding: '12px 14px' }}>S.No</th>
                  <th style={{ padding: '12px 14px' }}>Date</th>
                  <th style={{ padding: '12px 14px' }}>Format</th>
                  <th style={{ padding: '12px 14px' }}>Command</th>
                  <th style={{ padding: '12px 14px' }}>Time</th>
                  <th style={{ padding: '12px 14px' }}>Engine</th>
                  <th style={{ padding: '12px 14px' }}>ADC</th>
                  <th style={{ padding: '12px 14px' }}>Temperature</th>
                  <th style={{ padding: '12px 14px' }}>GSM</th>
                  <th style={{ padding: '12px 14px' }}>Satellites</th>
                  <th style={{ padding: '12px 14px' }}>Accuracy</th>
                  <th style={{ padding: '12px 14px' }}>Latitude</th>
                  <th style={{ padding: '12px 14px' }}>Longitude</th>
                  <th style={{ padding: '12px 14px' }}>Speed</th>
                  <th style={{ padding: '12px 14px' }}>Voltage</th>
                  <th style={{ padding: '12px 14px' }}>Fuel (L)</th>
                </tr>
              </thead>
              <tbody>
                {packets.map((p, idx) => {
                  const sNo = (pagination.page - 1) * pagination.limit + idx + 1;
                  const formatStr = p.packet_type ? p.packet_type.replace('_NORMAL', '').replace('_EXT', '') : 'VT02';
                  const commandStr = p.rawParsed?.command || (p.packet_type?.includes('NORMAL') ? 'DAT' : (p.packet_type || 'DAT'));
                  const isIgnOn = !!p.ignition;
                  const adcVal = p.rawParsed?.adc2Mv != null ? p.rawParsed.adc2Mv : (p.rawParsed?.adc1Mv || 0);

                  return (
                    <tr
                      key={p.id || idx}
                      style={{
                        borderBottom: '1px solid #F1F5F9',
                        background: idx % 2 === 0 ? '#FFFFFF' : '#F8FAFC',
                        transition: 'background 0.1s ease'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#F1F5F9'}
                      onMouseLeave={(e) => e.currentTarget.style.background = idx % 2 === 0 ? '#FFFFFF' : '#F8FAFC'}
                    >
                      {/* S.No */}
                      <td style={{ padding: '12px 14px', color: '#64748B', fontWeight: 600 }}>
                        {sNo}
                      </td>

                      {/* Date */}
                      <td style={{ padding: '12px 14px', fontWeight: 600, color: '#334155' }}>
                        {formatTerminalDate(p.device_time || p.received_at)}
                      </td>

                      {/* Format */}
                      <td style={{ padding: '12px 14px', color: '#475569', fontWeight: 600 }}>
                        {formatStr}
                      </td>

                      {/* Command */}
                      <td style={{ padding: '12px 14px', color: '#475569' }}>
                        {commandStr}
                      </td>

                      {/* Time */}
                      <td style={{ padding: '12px 14px', color: '#0F172A', fontWeight: 600 }}>
                        {formatTerminalTime(p.device_time || p.received_at)}
                      </td>

                      {/* Engine */}
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontSize: '11.5px',
                          fontWeight: 700,
                          background: isIgnOn ? '#DCFCE7' : '#F1F5F9',
                          color: isIgnOn ? '#15803D' : '#64748B'
                        }}>
                          {isIgnOn ? 'On' : 'Off'}
                        </span>
                      </td>

                      {/* ADC */}
                      <td style={{ padding: '12px 14px', color: '#475569' }}>
                        {adcVal}
                      </td>

                      {/* Temperature */}
                      <td style={{ padding: '12px 14px', color: '#64748B' }}>
                        {p.rawParsed?.temperature != null ? `${p.rawParsed.temperature}°C` : 'N/A'}
                      </td>

                      {/* GSM */}
                      <td style={{ padding: '12px 14px', color: '#334155' }}>
                        {p.gsmSignal != null ? p.gsmSignal : (p.rawParsed?.csq != null ? p.rawParsed.csq : '5')}
                      </td>

                      {/* Satellites */}
                      <td style={{ padding: '12px 14px', color: '#334155', fontWeight: 600 }}>
                        {p.satellites != null ? p.satellites : '—'}
                      </td>

                      {/* Accuracy */}
                      <td style={{ padding: '12px 14px', color: '#64748B' }}>
                        {p.rawParsed?.accuracy != null ? p.rawParsed.accuracy : (p.rawParsed?.hdop || 0)}
                      </td>

                      {/* Latitude */}
                      <td style={{ padding: '12px 14px', fontFamily: 'monospace', color: '#1E293B' }}>
                        {p.lat != null ? Number(p.lat).toFixed(6) : '—'}
                      </td>

                      {/* Longitude */}
                      <td style={{ padding: '12px 14px', fontFamily: 'monospace', color: '#1E293B' }}>
                        {p.lng != null ? Number(p.lng).toFixed(6) : '—'}
                      </td>

                      {/* Speed */}
                      <td style={{ padding: '12px 14px', color: '#0F172A' }}>
                        {p.speed != null ? `${Math.round(p.speed)} km/h` : '0 km/h'}
                      </td>

                      {/* Voltage */}
                      <td style={{ padding: '12px 14px', fontWeight: 600, color: '#0F766E' }}>
                        {p.voltage != null ? `${p.voltage} V` : '—'}
                      </td>

                      {/* Fuel (L) */}
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontSize: '11.5px',
                          fontWeight: 700,
                          background: '#EFF6FF',
                          color: '#2563EB'
                        }}>
                          {p.fuel != null ? `${p.fuel} L` : '0 L'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination & Footer Controls */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 20px',
          borderTop: '1px solid #E2E8F0',
          background: '#F8FAFC',
          fontSize: '12.5px',
          color: '#64748B',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>Rows per page:</span>
            <select
              value={recordLimit}
              onChange={(e) => {
                const newLimit = parseInt(e.target.value);
                setRecordLimit(newLimit);
              }}
              style={{
                border: '1px solid #CBD5E1',
                borderRadius: '6px',
                padding: '3px 8px',
                fontSize: '12px',
                background: '#FFFFFF',
                color: '#1E293B',
                outline: 'none'
              }}
            >
              <option value="10">10</option>
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </select>
          </div>

          <div>
            Showing <b>{packets.length > 0 ? (pagination.page - 1) * pagination.limit + 1 : 0}</b> - <b>{(pagination.page - 1) * pagination.limit + packets.length}</b> of <b>{pagination.total}</b>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              onClick={() => fetchPackets(Math.max(1, pagination.page - 1))}
              disabled={pagination.page <= 1 || loading}
              style={{
                border: '1px solid #CBD5E1',
                background: '#FFFFFF',
                borderRadius: '6px',
                padding: '5px 10px',
                cursor: pagination.page <= 1 || loading ? 'not-allowed' : 'pointer',
                opacity: pagination.page <= 1 || loading ? 0.5 : 1,
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <ChevronLeft size={16} />
              <span>Previous</span>
            </button>

            <span style={{ padding: '0 6px', fontWeight: 700, color: '#0F172A' }}>
              Page {pagination.page} / {pagination.totalPages || 1}
            </span>

            <button
              onClick={() => fetchPackets(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages || loading}
              style={{
                border: '1px solid #CBD5E1',
                background: '#FFFFFF',
                borderRadius: '6px',
                padding: '5px 10px',
                cursor: pagination.page >= pagination.totalPages || loading ? 'not-allowed' : 'pointer',
                opacity: pagination.page >= pagination.totalPages || loading ? 0.5 : 1,
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <span>Next</span>
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

      </div>

    </div>
  );
};

export default AdminTerminalPage;
