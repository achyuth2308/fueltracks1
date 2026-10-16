import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Server, Loader2, AlertOctagon, Download, Eye, X, Copy,
  Check, SlidersHorizontal, RefreshCw, FileSpreadsheet, ShieldAlert
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import api from '../../api/axios';
import { formatLocalTime } from '../../utils/dateUtils';
import { useSocket } from '../../hooks/useSocket';

const DEFAULT_COLUMNS = [
  { key: 'imei', label: 'Device IMEI', visible: true, width: '155px' },
  { key: 'received_at', label: 'Server Time', visible: true, width: '160px' },
  { key: 'device_time', label: 'GPS Time', visible: true, width: '160px' },
  { key: 'coords', label: 'Coordinates (Lat, Lng)', visible: true, width: '170px' },
  { key: 'speed', label: 'Speed', visible: true, width: '95px' },
  { key: 'heading', label: 'Heading', visible: true, width: '90px' },
  { key: 'ignition', label: 'Ignition', visible: true, width: '95px' },
  { key: 'fuel', label: 'Fuel (L)', visible: true, width: '110px' },
  { key: 'voltage', label: 'Main Voltage', visible: true, width: '110px' },
  { key: 'battery', label: 'Backup Batt', visible: true, width: '110px' },
  { key: 'serial', label: 'Serial Port Data', visible: false, width: '130px' },
  { key: 'gps_fix', label: 'GPS Fix', visible: false, width: '90px' },
  { key: 'odometer', label: 'Odometer', visible: false, width: '115px' },
  { key: 'satellites', label: 'Satellites', visible: false, width: '90px' },
  { key: 'gsm', label: 'GSM CSQ', visible: false, width: '90px' },
  { key: 'cell_lac', label: 'Cell ID / LAC', visible: false, width: '130px' },
  { key: 'relay', label: 'Relay (DO1)', visible: false, width: '100px' },
  { key: 'alert', label: 'Alert Status', visible: true, width: '140px' },
  { key: 'packet_type', label: 'Packet Type', visible: true, width: '130px' },
  { key: 'raw_hex', label: 'Raw Packet (Hex)', visible: true, width: '220px' }
];

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

const sortDesc = (list) => {
  return [...list].sort((a, b) => {
    const tA = new Date(a.device_time || a.received_at || 0).getTime();
    const tB = new Date(b.device_time || b.received_at || 0).getTime();
    return tB - tA;
  });
};

const SensorLogsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { socket } = useSocket();

  const [vehicle, setVehicle] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 100, total: 0 });
  const [columns, setColumns] = useState(DEFAULT_COLUMNS);
  const [showColPicker, setShowColPicker] = useState(false);
  const [inspectModal, setInspectModal] = useState(null);
  const [copiedHex, setCopiedHex] = useState(false);
  const [copiedImei, setCopiedImei] = useState(false);

  useEffect(() => {
    fetchVehicle();
    fetchMessages(1);
  }, [id]);

  const fetchVehicle = async () => {
    try {
      const res = await api.get(`/api/vehicles/${id}`);
      if (res.data?.data) {
        setVehicle(res.data.data);
      }
    } catch (e) {
      console.warn('Failed to fetch vehicle metadata', e);
    }
  };

  useEffect(() => {
    if (!socket || !id) return;
    socket.emit('join:vehicle', { vehicleId: id });

    const handleRaw = (data) => {
      if (data.vehicleId && String(data.vehicleId) !== String(id)) return;
      setMessages((prev) => {
        const enriched = extractParsedData(data);
        const filtered = prev.filter((m) => m.id !== enriched.id);
        return sortDesc([enriched, ...filtered]).slice(0, 100);
      });
    };

    socket.on('raw:update', handleRaw);

    return () => {
      socket.emit('leave:vehicle', { vehicleId: id });
      socket.off('raw:update', handleRaw);
    };
  }, [socket, id]);

  const fetchMessages = async (page = 1) => {
    setLoading(true);
    try {
      const res = await api.get(`/api/vehicles/${id}/messages`, { params: { page, limit: 100 } });
      const rawList = res.data.data || [];
      const enriched = rawList.map(extractParsedData);
      setMessages(sortDesc(enriched));
      if (res.data.pagination) setPagination(res.data.pagination);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch sensor logs');
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (newPage) => {
    if (newPage < 1 || newPage > (pagination.totalPages || 1)) return;
    fetchMessages(newPage);
  };

  const toggleColumn = (key) => {
    setColumns((prev) =>
      prev.map((col) => (col.key === key ? { ...col, visible: !col.visible } : col))
    );
  };

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedHex(true);
    setTimeout(() => setCopiedHex(false), 2000);
  };

  // Export to Excel / CSV
  const handleExportExcel = () => {
    if (messages.length === 0) return;
    const exportData = messages.map((m, idx) => ({
      No: idx + 1,
      'Device IMEI': m.imei || vehicle?.imei || '—',
      'Server Time': formatLocalTime(m.received_at),
      'GPS Time': m.device_time ? formatLocalTime(m.device_time) : '—',
      'GPS Fix': m.gpsValid === 'A' || m.parsed ? 'Valid' : 'No Fix',
      'Latitude': m.lat != null ? m.lat : '—',
      'Longitude': m.lng != null ? m.lng : '—',
      'Speed (km/h)': m.speed != null ? m.speed : 0,
      'Heading (deg)': m.direction != null ? `${m.direction}°` : '—',
      'Ignition': m.ignition ? 'ON' : 'OFF',
      'Fuel (L)': m.fuel != null ? `${m.fuel} L` : '—',
      'Serial Port Data': m.serial || '—',
      'Main Voltage (V)': m.voltage != null ? `${m.voltage} V` : '—',
      'Backup Batt (%)': m.battery != null ? `${m.battery}%` : '—',
      'Odometer (km)': m.odometer != null ? m.odometer : '—',
      'Satellites': m.satellites != null ? m.satellites : '—',
      'GSM CSQ': m.gsmSignal != null ? m.gsmSignal : '—',
      'Cell ID': m.cellId || '—',
      'LAC': m.lac || '—',
      'Relay Output': m.output1 ? 'ACTIVE' : 'OFF',
      'Alert': m.alertText || 'Normal',
      'Packet Type': m.packet_type || 'UNKNOWN',
      'Raw Packet Hex': m.raw_hex || m.raw || '—'
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sensor_Packets');
    const safeName = (vehicle?.plate || vehicle?.name || id).replace(/[^a-zA-Z0-9_-]/g, '_');
    XLSX.writeFile(wb, `sensor_logs_${safeName}_p${pagination.page}.xlsx`);
  };

  // Export to PDF
  const handleDownloadPDF = () => {
    if (messages.length === 0) return;
    const doc = new jsPDF('landscape');
    const vehicleLabel = vehicle?.plate || vehicle?.name || 'Vehicle';
    doc.text(`Sensor Data Logs — Telemetry Packets (${vehicleLabel})`, 14, 12);
    doc.setFontSize(9);
    doc.text(`Vehicle: ${vehicleLabel} | IMEI: ${vehicle?.imei || messages[0]?.imei || '—'} | Protocol: ${vehicle?.device_version || vehicle?.device_model || '—'} | Generated: ${formatLocalTime(new Date().toISOString())}`, 14, 18);

    const tableColumn = [
      'IMEI', 'Server Time', 'GPS Time', 'Fix', 'Speed', 'Ignition',
      'Fuel', 'Voltage', 'Batt', 'Sat', 'Packet Type'
    ];
    const tableRows = messages.map((m) => [
      m.imei || vehicle?.imei || '—',
      formatLocalTime(m.received_at),
      m.device_time ? formatLocalTime(m.device_time) : '—',
      m.gpsValid === 'A' || m.parsed ? 'Valid' : 'No Fix',
      `${m.speed || 0} km/h`,
      m.ignition ? 'ON' : 'OFF',
      m.fuel != null ? `${m.fuel} L` : '—',
      m.voltage != null ? `${m.voltage}V` : '—',
      m.battery != null ? `${m.battery}%` : '—',
      m.satellites || '—',
      m.packet_type || '—'
    ]);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 22,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [249, 115, 22] }
    });

    const safeName = (vehicle?.plate || vehicle?.name || id).replace(/[^a-zA-Z0-9_-]/g, '_');
    doc.save(`sensor_logs_${safeName}_page${pagination.page}.pdf`);
  };

  const activeCols = useMemo(() => columns.filter((c) => c.visible), [columns]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 56px)', background: '#F8FAFC' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 24px', background: '#FFFFFF', borderBottom: '1px solid #E2E8F0', flexShrink: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <button
            onClick={() => navigate(`/vehicles/${id}`)}
            style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#F1F5F9', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#475569' }}
            title="Back to Vehicle"
          >
            <ArrowLeft size={18} />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Server size={20} color="#f97316" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <h1 style={{ fontSize: '18px', fontWeight: 800, color: '#0F172A', margin: 0, letterSpacing: '-0.02em' }}>Sensor Data Logs</h1>

                {/* Vehicle Plate / Name Badge */}
                {vehicle && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '3px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 700, background: '#EFF6FF', color: '#1D4ED8', border: '1px solid #DBEAFE' }}>
                    🚗 {vehicle.plate || vehicle.name || 'Vehicle'}
                    {vehicle.name && vehicle.plate && vehicle.name !== vehicle.plate ? ` (${vehicle.name})` : ''}
                  </span>
                )}

                {/* Device IMEI Badge with Copy Button */}
                {(vehicle?.imei || messages[0]?.imei) && (
                  <button
                    onClick={() => {
                      const imeiToCopy = vehicle?.imei || messages[0]?.imei;
                      if (imeiToCopy) {
                        navigator.clipboard.writeText(imeiToCopy);
                        setCopiedImei(true);
                        setTimeout(() => setCopiedImei(false), 2000);
                      }
                    }}
                    title="Click to copy IMEI"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '3px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 700, background: '#F8FAFC', color: '#0F172A', border: '1px solid #CBD5E1', cursor: 'pointer', fontFamily: 'monospace' }}
                  >
                    <span style={{ color: '#64748B' }}>IMEI:</span>
                    <span style={{ color: '#EA580C', fontWeight: 800 }}>{vehicle?.imei || messages[0]?.imei}</span>
                    {copiedImei ? <Check size={13} color="#16A34A" /> : <Copy size={13} color="#64748B" />}
                  </button>
                )}

                {/* Device Protocol / Model Badge */}
                {(vehicle?.device_version || vehicle?.device_model) && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 9px', borderRadius: '6px', fontSize: '11px', fontWeight: 600, background: '#F0FDF4', color: '#15803D', border: '1px solid #DCFCE7' }}>
                    ⚡ {vehicle.device_version || vehicle.device_model}
                  </span>
                )}
              </div>
              <span style={{ fontSize: '12px', color: '#64748B', fontWeight: 500 }}>Protocol-accurate telemetry stream (Live Socket + Historical)</span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', position: 'relative' }}>
          <button
            onClick={() => fetchMessages(pagination.page)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 12px', borderRadius: '8px', border: '1px solid #E2E8F0', background: '#FFFFFF', color: '#334155', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}
            title="Refresh logs"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>

          {/* Column Toggle Button */}
          <button
            onClick={() => setShowColPicker(!showColPicker)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', background: showColPicker ? '#FFF7ED' : '#FFFFFF', color: showColPicker ? '#EA580C' : '#334155', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}
          >
            <SlidersHorizontal size={14} /> Columns ({activeCols.length})
          </button>

          {/* Column Picker Dropdown */}
          {showColPicker && (
            <div style={{ position: 'absolute', top: '44px', right: '160px', width: '240px', background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)', padding: '12px', zIndex: 100, maxHeight: '380px', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', paddingBottom: '6px', borderBottom: '1px solid #F1F5F9' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#0F172A' }}>Toggle Columns</span>
                <button onClick={() => setShowColPicker(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}><X size={14} /></button>
              </div>
              {columns.map((col) => (
                <label key={col.key} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 4px', fontSize: '12px', color: '#334155', cursor: 'pointer', borderRadius: '4px' }}>
                  <input
                    type="checkbox"
                    checked={col.visible}
                    onChange={() => toggleColumn(col.key)}
                    style={{ accentColor: '#f97316', cursor: 'pointer' }}
                  />
                  <span>{col.label}</span>
                </label>
              ))}
            </div>
          )}

          {/* Export Excel */}
          <button
            onClick={handleExportExcel}
            disabled={messages.length === 0}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 12px', borderRadius: '8px', border: '1px solid #10B981', background: '#ECFDF5', color: '#059669', cursor: messages.length === 0 ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: '13px', opacity: messages.length === 0 ? 0.5 : 1 }}
          >
            <FileSpreadsheet size={14} /> Excel
          </button>

          {/* Export PDF */}
          <button
            onClick={handleDownloadPDF}
            disabled={messages.length === 0}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 12px', borderRadius: '8px', border: '1px solid #f97316', background: '#FFF7ED', color: '#f97316', cursor: messages.length === 0 ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: '13px', opacity: messages.length === 0 ? 0.5 : 1 }}
          >
            <Download size={14} /> PDF
          </button>

          {/* Pagination Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', borderLeft: '1px solid #E2E8F0', paddingLeft: '12px' }}>
            <span style={{ fontSize: '12px', color: '#64748B', fontWeight: 600 }}>Page {pagination.page}/{pagination.totalPages || 1}</span>
            <button
              onClick={() => handlePageChange(pagination.page - 1)}
              disabled={pagination.page <= 1}
              style={{ padding: '5px 10px', borderRadius: '6px', border: '1px solid #E2E8F0', background: pagination.page <= 1 ? '#F8FAFC' : '#FFFFFF', color: pagination.page <= 1 ? '#94A3B8' : '#111827', cursor: pagination.page <= 1 ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: 600 }}
            >
              Prev
            </button>
            <button
              onClick={() => handlePageChange(pagination.page + 1)}
              disabled={pagination.page >= (pagination.totalPages || 1)}
              style={{ padding: '5px 10px', borderRadius: '6px', border: '1px solid #E2E8F0', background: pagination.page >= (pagination.totalPages || 1) ? '#F8FAFC' : '#FFFFFF', color: pagination.page >= (pagination.totalPages || 1) ? '#94A3B8' : '#111827', cursor: pagination.page >= (pagination.totalPages || 1) ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: 600 }}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div style={{ flex: 1, padding: '16px 24px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {error ? (
          <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', padding: '16px', borderRadius: '12px', color: '#991B1B', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <AlertOctagon size={24} color="#EF4444" />
            <div>
              <div style={{ fontWeight: 700, fontSize: '14px' }}>Error Loading Logs</div>
              <div style={{ fontSize: '13px', marginTop: '2px' }}>{error}</div>
            </div>
          </div>
        ) : loading && messages.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '14px' }}>
            <Loader2 size={36} color="#f97316" className="animate-spin" />
            <span style={{ fontSize: '13px', color: '#64748B', fontWeight: 600 }}>Streaming telemetry packets...</span>
          </div>
        ) : (
          <div style={{ flex: 1, background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', overflow: 'auto', boxShadow: '0 2px 6px rgba(0,0,0,0.03)' }}>
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, textAlign: 'left', fontSize: '12px', minWidth: '1600px' }}>
              <thead>
                <tr style={{ background: '#F8FAFC', position: 'sticky', top: 0, zIndex: 2 }}>
                  <th style={{ padding: '10px 14px', width: '45px', borderBottom: '2px solid #E2E8F0', borderRight: '1px solid #F1F5F9', color: '#475569', fontWeight: 700, textAlign: 'center', background: '#F8FAFC', position: 'sticky', left: 0, zIndex: 3 }}>
                    #
                  </th>
                  {columns.map((col) => {
                    if (!col.visible) return null;
                    return (
                      <th
                        key={col.key}
                        style={{
                          padding: '10px 14px',
                          color: '#475569',
                          fontWeight: 700,
                          fontSize: '11px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                          borderBottom: '2px solid #E2E8F0',
                          borderRight: '1px solid #F1F5F9',
                          width: col.width,
                          whiteSpace: 'nowrap',
                          background: '#F8FAFC'
                        }}
                      >
                        {col.label}
                      </th>
                    );
                  })}
                  <th style={{ padding: '10px 14px', width: '80px', borderBottom: '2px solid #E2E8F0', color: '#475569', fontWeight: 700, textAlign: 'center', background: '#F8FAFC' }}>
                    Inspect
                  </th>
                </tr>
              </thead>
              <tbody>
                {messages.length === 0 ? (
                  <tr>
                    <td colSpan={activeCols.length + 2} style={{ padding: '60px 24px', textAlign: 'center', color: '#94A3B8' }}>
                      <Server size={36} style={{ marginBottom: '12px', opacity: 0.4 }} />
                      <div style={{ fontSize: '15px', fontWeight: 700, color: '#334155' }}>No Sensor Packets Received</div>
                      <div style={{ fontSize: '13px', marginTop: '4px' }}>Packets from port 5000–5011 will appear here in real-time.</div>
                    </td>
                  </tr>
                ) : (
                  messages.map((m, idx) => {
                    const isValidFix = m.gpsValid === 'A' || m.parsed;
                    return (
                      <tr
                        key={m.id || `${m.received_at}_${idx}`}
                        style={{ borderBottom: '1px solid #F1F5F9', background: idx % 2 === 0 ? '#FFFFFF' : '#FAFAFA' }}
                      >
                        {/* Row Index */}
                        <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 600, color: '#64748B', borderRight: '1px solid #F1F5F9', background: idx % 2 === 0 ? '#FFFFFF' : '#FAFAFA', position: 'sticky', left: 0, zIndex: 1 }}>
                          {idx + 1}
                        </td>

                        {/* Device IMEI */}
                        {columns.find((c) => c.key === 'imei')?.visible && (
                          <td style={{ padding: '10px 14px', whiteSpace: 'nowrap', fontFamily: 'monospace', fontSize: '12px', fontWeight: 700, color: '#0F172A', borderRight: '1px solid #F1F5F9' }}>
                            {m.imei || vehicle?.imei || '—'}
                          </td>
                        )}

                        {/* Server Time */}
                        {columns.find((c) => c.key === 'received_at')?.visible && (
                          <td style={{ padding: '10px 14px', whiteSpace: 'nowrap', fontWeight: 600, color: '#0F172A', borderRight: '1px solid #F1F5F9' }}>
                            {formatLocalTime(m.received_at)}
                          </td>
                        )}

                        {/* GPS Time */}
                        {columns.find((c) => c.key === 'device_time')?.visible && (
                          <td style={{ padding: '10px 14px', whiteSpace: 'nowrap', color: '#334155', borderRight: '1px solid #F1F5F9' }}>
                            {m.device_time ? formatLocalTime(m.device_time) : '—'}
                          </td>
                        )}

                        {/* GPS Fix */}
                        {columns.find((c) => c.key === 'gps_fix')?.visible && (
                          <td style={{ padding: '10px 14px', borderRight: '1px solid #F1F5F9' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 7px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, background: isValidFix ? '#DCFCE7' : '#FEE2E2', color: isValidFix ? '#15803D' : '#B91C1C' }}>
                              {isValidFix ? '3D Fix' : 'No Fix'}
                            </span>
                          </td>
                        )}

                        {/* Coordinates */}
                        {columns.find((c) => c.key === 'coords')?.visible && (
                          <td style={{ padding: '10px 14px', borderRight: '1px solid #F1F5F9', fontFamily: 'monospace', fontSize: '12px', whiteSpace: 'nowrap' }}>
                            {m.lat != null && m.lng != null ? (
                              <a
                                href={`https://www.google.com/maps?q=${m.lat},${m.lng}`}
                                target="_blank"
                                rel="noreferrer"
                                style={{ color: '#2563EB', textDecoration: 'none', fontWeight: 600 }}
                              >
                                {Number(m.lat).toFixed(6)}, {Number(m.lng).toFixed(6)}
                              </a>
                            ) : (
                              <span style={{ color: '#94A3B8' }}>—</span>
                            )}
                          </td>
                        )}

                        {/* Speed */}
                        {columns.find((c) => c.key === 'speed')?.visible && (
                          <td style={{ padding: '10px 14px', borderRight: '1px solid #F1F5F9', fontWeight: 700, color: m.speed > 0 ? '#0F172A' : '#94A3B8' }}>
                            {m.speed != null ? `${m.speed} km/h` : '0 km/h'}
                          </td>
                        )}

                        {/* Heading */}
                        {columns.find((c) => c.key === 'heading')?.visible && (
                          <td style={{ padding: '10px 14px', borderRight: '1px solid #F1F5F9', color: '#475569' }}>
                            {m.direction != null ? `${m.direction}°` : '—'}
                          </td>
                        )}

                        {/* Ignition */}
                        {columns.find((c) => c.key === 'ignition')?.visible && (
                          <td style={{ padding: '10px 14px', borderRight: '1px solid #F1F5F9' }}>
                            <span style={{ display: 'inline-block', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, background: m.ignition ? '#DCFCE7' : '#F1F5F9', color: m.ignition ? '#166534' : '#64748B' }}>
                              {m.ignition ? 'ON' : 'OFF'}
                            </span>
                          </td>
                        )}

                        {/* Serial Fuel */}
                        {columns.find((c) => c.key === 'fuel')?.visible && (
                          <td style={{ padding: '10px 14px', borderRight: '1px solid #F1F5F9' }}>
                            {m.fuel != null ? (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '6px', fontSize: '12px', fontWeight: 800, background: '#E0F2FE', color: '#0369A1' }}>
                                {m.fuel} L
                              </span>
                            ) : (
                              <span style={{ color: '#CBD5E1' }}>—</span>
                            )}
                          </td>
                        )}

                        {/* Serial Port Raw */}
                        {columns.find((c) => c.key === 'serial')?.visible && (
                          <td style={{ padding: '10px 14px', borderRight: '1px solid #F1F5F9', fontFamily: 'monospace', fontSize: '11px', color: '#475569' }}>
                            {m.serial ? (
                              <span style={{ background: '#F8FAFC', padding: '2px 6px', borderRadius: '4px', border: '1px solid #E2E8F0' }}>
                                {m.serial}
                              </span>
                            ) : (
                              <span style={{ color: '#CBD5E1' }}>—</span>
                            )}
                          </td>
                        )}

                        {/* Main Voltage */}
                        {columns.find((c) => c.key === 'voltage')?.visible && (
                          <td style={{ padding: '10px 14px', borderRight: '1px solid #F1F5F9', fontWeight: 600, color: m.voltage > 10 ? '#0F172A' : '#EF4444' }}>
                            {m.voltage != null ? `${m.voltage} V` : '—'}
                          </td>
                        )}

                        {/* Backup Battery */}
                        {columns.find((c) => c.key === 'battery')?.visible && (
                          <td style={{ padding: '10px 14px', borderRight: '1px solid #F1F5F9', color: '#334155' }}>
                            {m.battery != null ? `${m.battery}%` : '—'}
                          </td>
                        )}

                        {/* Odometer */}
                        {columns.find((c) => c.key === 'odometer')?.visible && (
                          <td style={{ padding: '10px 14px', borderRight: '1px solid #F1F5F9', fontWeight: 600, color: '#0F172A' }}>
                            {m.odometer != null ? `${Number(m.odometer).toLocaleString()} km` : '—'}
                          </td>
                        )}

                        {/* Satellites */}
                        {columns.find((c) => c.key === 'satellites')?.visible && (
                          <td style={{ padding: '10px 14px', borderRight: '1px solid #F1F5F9', color: '#475569', textAlign: 'center' }}>
                            {m.satellites != null ? m.satellites : '—'}
                          </td>
                        )}

                        {/* GSM CSQ */}
                        {columns.find((c) => c.key === 'gsm')?.visible && (
                          <td style={{ padding: '10px 14px', borderRight: '1px solid #F1F5F9', color: '#475569', textAlign: 'center' }}>
                            {m.gsmSignal != null ? `${m.gsmSignal}/31` : '—'}
                          </td>
                        )}

                        {/* Cell ID / LAC */}
                        {columns.find((c) => c.key === 'cell_lac')?.visible && (
                          <td style={{ padding: '10px 14px', borderRight: '1px solid #F1F5F9', fontFamily: 'monospace', fontSize: '11px', color: '#64748B' }}>
                            {m.cellId || m.lac ? `CID:${m.cellId || '—'} LAC:${m.lac || '—'}` : '—'}
                          </td>
                        )}

                        {/* Relay Output */}
                        {columns.find((c) => c.key === 'relay')?.visible && (
                          <td style={{ padding: '10px 14px', borderRight: '1px solid #F1F5F9' }}>
                            {m.output1 !== null ? (
                              <span style={{ padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 700, background: m.output1 ? '#FEE2E2' : '#F1F5F9', color: m.output1 ? '#DC2626' : '#64748B' }}>
                                {m.output1 ? 'ACTIVE' : 'OFF'}
                              </span>
                            ) : (
                              '—'
                            )}
                          </td>
                        )}

                        {/* Alert Status */}
                        {columns.find((c) => c.key === 'alert')?.visible && (
                          <td style={{ padding: '10px 14px', borderRight: '1px solid #F1F5F9' }}>
                            {m.alertText ? (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, background: '#FEF3C7', color: '#B45309' }}>
                                <ShieldAlert size={12} /> {m.alertText}
                              </span>
                            ) : (
                              <span style={{ color: '#94A3B8' }}>Normal</span>
                            )}
                          </td>
                        )}

                        {/* Packet Type */}
                        {columns.find((c) => c.key === 'packet_type')?.visible && (
                          <td style={{ padding: '10px 14px', borderRight: '1px solid #F1F5F9' }}>
                            <span style={{ background: '#F1F5F9', color: '#334155', padding: '3px 7px', borderRadius: '5px', fontSize: '11px', fontWeight: 700, fontFamily: 'monospace' }}>
                              {m.packet_type || 'DATA'}
                            </span>
                          </td>
                        )}

                        {/* Raw Hex Packet */}
                        {columns.find((c) => c.key === 'raw_hex')?.visible && (
                          <td style={{ padding: '10px 14px', borderRight: '1px solid #F1F5F9', fontFamily: 'monospace', fontSize: '11px', color: '#EA580C', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={m.raw_hex || m.raw}>
                            {m.raw_hex || m.raw || '—'}
                          </td>
                        )}

                        {/* Inspect Action */}
                        <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                          <button
                            onClick={() => setInspectModal(m)}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 8px', borderRadius: '6px', border: '1px solid #CBD5E1', background: '#FFFFFF', color: '#334155', cursor: 'pointer', fontSize: '11px', fontWeight: 700 }}
                            title="Inspect complete packet"
                          >
                            <Eye size={12} color="#EA580C" /> View
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Packet Inspector Modal Drawer */}
      {inspectModal && (
        <div
          onClick={() => setInspectModal(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            justifyContent: 'flex-end',
            zIndex: 99999
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '560px',
              maxWidth: '90vw',
              height: '100%',
              background: '#FFFFFF',
              boxShadow: '-10px 0 30px rgba(0,0,0,0.25)',
              display: 'flex',
              flexDirection: 'column',
              zIndex: 100000
            }}
          >
            {/* Modal Header */}
            <div style={{ padding: '16px 24px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F8FAFC' }}>
              <div>
                <h2 style={{ fontSize: '16px', fontWeight: 800, color: '#0F172A', margin: 0 }}>Packet Field Inspector</h2>
                <span style={{ fontSize: '12px', color: '#64748B' }}>Complete decoded telemetry payload</span>
              </div>
              <button
                onClick={() => setInspectModal(null)}
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  background: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: '#0F172A',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                }}
                title="Close Inspector"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ flex: 1, padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Summary Badges */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                <div style={{ background: '#F8FAFC', padding: '12px', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                  <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 600, display: 'block', textTransform: 'uppercase' }}>Packet Type</span>
                  <span style={{ fontSize: '13px', fontWeight: 800, color: '#0F172A', fontFamily: 'monospace' }}>{inspectModal.packet_type || 'NORMAL'}</span>
                </div>
                <div style={{ background: '#F8FAFC', padding: '12px', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                  <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 600, display: 'block', textTransform: 'uppercase' }}>Fix Status</span>
                  <span style={{ fontSize: '13px', fontWeight: 800, color: inspectModal.gpsValid === 'A' || inspectModal.parsed ? '#166534' : '#DC2626' }}>
                    {inspectModal.gpsValid === 'A' || inspectModal.parsed ? 'Valid (3D Fix)' : 'Void (No Fix)'}
                  </span>
                </div>
                <div style={{ background: '#F8FAFC', padding: '12px', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                  <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 600, display: 'block', textTransform: 'uppercase' }}>Ignition ACC</span>
                  <span style={{ fontSize: '13px', fontWeight: 800, color: inspectModal.ignition ? '#166534' : '#64748B' }}>
                    {inspectModal.ignition ? 'ENGINE ON' : 'ENGINE OFF'}
                  </span>
                </div>
              </div>

              {/* Parsed Fields Grid */}
              <div>
                <h3 style={{ fontSize: '13px', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '10px' }}>
                  Decoded Protocol Fields
                </h3>
                <div style={{ border: '1px solid #E2E8F0', borderRadius: '10px', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <tbody>
                      {[
                        { label: 'Device IMEI', value: inspectModal.imei || vehicle?.imei || '—' },
                        { label: 'Assigned Vehicle', value: vehicle ? `${vehicle.plate || ''} ${vehicle.name ? `(${vehicle.name})` : ''}`.trim() : '—' },
                        { label: 'Configured Protocol', value: vehicle?.device_version || vehicle?.device_model || '—' },
                        { label: 'Server Reception Time', value: formatLocalTime(inspectModal.received_at) },
                        { label: 'Device GPS Time (UTC)', value: inspectModal.device_time ? formatLocalTime(inspectModal.device_time) : '—' },
                        { label: 'Latitude / Longitude', value: inspectModal.lat ? `${inspectModal.lat}, ${inspectModal.lng}` : '—' },
                        { label: 'Speed', value: `${inspectModal.speed || 0} km/h` },
                        { label: 'Heading / Course', value: inspectModal.direction != null ? `${inspectModal.direction}°` : '—' },
                        { label: 'Fuel Level (L)', value: inspectModal.fuel != null ? `${inspectModal.fuel} Litres` : '— (No fuel sensor reading)' },
                        { label: 'Serial Port Data (Hex)', value: inspectModal.serial || '—' },
                        { label: 'Main Battery Voltage', value: inspectModal.voltage != null ? `${inspectModal.voltage} V` : '—' },
                        { label: 'Internal Backup Battery', value: inspectModal.battery != null ? `${inspectModal.battery}%` : '—' },
                        { label: 'Cumulative Odometer', value: inspectModal.odometer != null ? `${inspectModal.odometer} km` : '—' },
                        { label: 'GPS Satellites Count', value: inspectModal.satellites != null ? inspectModal.satellites : '—' },
                        { label: 'Cellular CSQ Signal', value: inspectModal.gsmSignal != null ? `${inspectModal.gsmSignal} / 31` : '—' },
                        { label: 'Cell ID', value: inspectModal.cellId || '—' },
                        { label: 'Location Area Code (LAC)', value: inspectModal.lac || '—' },
                        { label: 'Digital Output 1 (Immobilizer)', value: inspectModal.output1 !== null ? (inspectModal.output1 ? 'ACTIVE (Cut)' : 'NORMAL') : '—' },
                        { label: 'Alert Reason', value: inspectModal.alertText || 'Normal' }
                      ].map((item, i) => (
                        <tr key={item.label} style={{ background: i % 2 === 0 ? '#FFFFFF' : '#F8FAFC', borderBottom: '1px solid #F1F5F9' }}>
                          <td style={{ padding: '9px 14px', fontWeight: 600, color: '#475569', width: '42%' }}>{item.label}</td>
                          <td style={{ padding: '9px 14px', fontWeight: 700, color: '#0F172A', fontFamily: item.label.includes('Hex') || item.label.includes('Lat') ? 'monospace' : 'inherit' }}>
                            {item.value}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Raw Wire Packet Box */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <h3 style={{ fontSize: '13px', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.04em', margin: 0 }}>
                    Raw Wire Hex Packet
                  </h3>
                  <button
                    onClick={() => handleCopy(inspectModal.raw_hex || inspectModal.raw || '')}
                    style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px', borderRadius: '6px', border: '1px solid #E2E8F0', background: '#FFFFFF', color: copiedHex ? '#10B981' : '#475569', cursor: 'pointer', fontSize: '11px', fontWeight: 600 }}
                  >
                    {copiedHex ? <Check size={12} color="#10B981" /> : <Copy size={12} />}
                    {copiedHex ? 'Copied!' : 'Copy Hex'}
                  </button>
                </div>
                <div style={{ background: '#0F172A', color: '#F97316', padding: '14px', borderRadius: '10px', fontFamily: 'monospace', fontSize: '12px', wordBreak: 'break-all', lineHeight: 1.6, maxHeight: '160px', overflowY: 'auto' }}>
                  {inspectModal.raw_hex || inspectModal.raw || 'No raw string available'}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SensorLogsPage;
