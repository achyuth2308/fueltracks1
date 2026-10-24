import React, { useState, useEffect } from 'react';
import CustomDatePicker from '../../components/ui/CustomDatePicker';
import { formatLocalTime, formatLocalDate, getLocalDateString } from '../../utils/dateUtils';
import AddressText from '../../components/ui/AddressText';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Download, Search, Loader2, Map, Filter, FileText,
  FileSpreadsheet, Truck, Calendar, Route, Navigation, Clock,
  ChevronDown, ChevronUp, MapPin, Flag, PauseCircle, PlayCircle, Gauge, Activity
} from 'lucide-react';
import axiosInstance from '../../api/axios';
import { exportToExcel, exportToPDF, exportToCSV } from '../../utils/exportUtils';
import * as vehicleApi from '../../api/vehicleApi';

const formatDuration = (seconds) => {
  if (!seconds || seconds <= 0) return '00:00:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

const formatDurationHuman = (seconds) => {
  if (!seconds || seconds <= 0) return '0m';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) {
    return `${h}h ${m}m`;
  }
  return `${m}m`;
};

const DailyTripReportPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [expandedRows, setExpandedRows] = useState({});

  // Filters
  const [vehicles, setVehicles] = useState([]);
  const [filters, setFilters] = useState(() => ({
    vehicleId: '',
    startDate: getLocalDateString(new Date()),
    endDate: getLocalDateString(new Date())
  }));

  useEffect(() => {
    vehicleApi.getVehicles({ t: Date.now() })
      .then(res => {
        if (res.success && res.data) {
          setVehicles(res.data);
          if (res.data.length > 0) {
            setFilters(prev => ({ ...prev, vehicleId: res.data[0].id }));
          }
        }
      })
      .catch(console.error);
  }, []);

  const handleGenerate = async () => {
    if (!filters.startDate || !filters.endDate) return;
    setLoading(true);
    try {
      const start = new Date(filters.startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(filters.endDate);
      end.setHours(23, 59, 59, 999);

      const params = new URLSearchParams();
      params.append('startDate', start.toISOString());
      params.append('endDate', end.toISOString());
      if (filters.vehicleId) params.append('vehicleId', filters.vehicleId);

      const res = await axiosInstance.get('/api/reports/daily-trip?' + params.toString());
      if (res.data?.success) {
        setData(res.data.data || []);
      }
    } catch (err) {
      console.error(err);
      alert('Failed to generate daily trip report');
    } finally {
      setLoading(false);
    }
  };

  const toggleRow = (id) => {
    setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Cumulative metrics across filtered rows
  const totals = data.reduce((acc, row) => ({
    distance: acc.distance + (parseFloat(row.total_distance) || 0),
    drivingSeconds: acc.drivingSeconds + (parseFloat(row.driving_seconds) || 0),
    stoppageSeconds: acc.stoppageSeconds + (parseFloat(row.stoppage_seconds) || 0),
    totalSpanSeconds: acc.totalSpanSeconds + (parseFloat(row.total_span_seconds) || 0),
    stops: acc.stops + (parseInt(row.stops_count) || 0),
    legs: acc.legs + (parseInt(row.legs_count) || 0)
  }), { distance: 0, drivingSeconds: 0, stoppageSeconds: 0, totalSpanSeconds: 0, stops: 0, legs: 0 });

  const getExportData = () => {
    return data.map(row => ({
      'Date': row.date,
      'Vehicle Name': row.vehicle_name || '-',
      'Plate': row.plate || '-',
      'Departure Time': formatLocalTime(row.start_time),
      'Departure Lat/Lng': `${row.start_lat}, ${row.start_lng}`,
      'Final Arrival Time': formatLocalTime(row.end_time),
      'Arrival Lat/Lng': `${row.end_lat}, ${row.end_lng}`,
      'Total Distance (km)': row.total_distance || 0,
      'Driving Time (HH:MM:SS)': formatDuration(row.driving_seconds),
      'Stoppage Time (HH:MM:SS)': formatDuration(row.stoppage_seconds),
      'Total Span (HH:MM:SS)': formatDuration(row.total_span_seconds),
      'Number of Stops': row.stops_count || 0,
      'Max Speed (km/h)': row.max_speed || 0,
      'Avg Speed (km/h)': row.avg_speed || 0
    }));
  };

  return (
    <div style={{ padding: '24px', background: '#F8FAFC', minHeight: '100vh', fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={() => navigate('/admin/reports')}
              style={{
                background: '#FFFFFF',
                border: '1px solid #CBD5E1',
                borderRadius: '8px',
                padding: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#475569'
              }}
            >
              <ArrowLeft size={16} />
            </button>
            <h1 style={{ fontSize: '20px', fontWeight: 800, color: '#0F172A', margin: 0, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Route size={22} color="#10B981" />
              Full Day Trips (Consolidated Journey)
            </h1>
          </div>
          <p style={{ margin: '4px 0 0 34px', fontSize: '13px', color: '#64748B' }}>
            Consolidates the complete day's journey from initial departure to final arrival with zero setup. View overall distance, driving & stoppage times, and intermediate legs.
          </p>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => exportToExcel(getExportData(), 'Daily_Trip_Report')}
            disabled={data.length === 0}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              background: data.length === 0 ? '#E2E8F0' : '#10B981',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: data.length === 0 ? 'not-allowed' : 'pointer'
            }}
          >
            <FileSpreadsheet size={14} />
            Excel
          </button>
          <button
            onClick={() => exportToPDF(['Date', 'Vehicle Name', 'Departure Time', 'Final Arrival Time', 'Total Distance (km)', 'Driving Time (HH:MM:SS)', 'Number of Stops'], getExportData(), 'Daily_Trip_Report')}
            disabled={data.length === 0}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              background: data.length === 0 ? '#E2E8F0' : '#EF4444',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: data.length === 0 ? 'not-allowed' : 'pointer'
            }}
          >
            <FileText size={14} />
            PDF
          </button>
        </div>
      </div>

      {/* Filter Card */}
      <div style={{
        background: '#FFFFFF',
        borderRadius: '12px',
        padding: '16px 20px',
        marginBottom: '20px',
        border: '1px solid #E2E8F0',
        boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        {/* Vehicle Select */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '220px' }}>
          <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Select Vehicle</label>
          <select
            value={filters.vehicleId}
            onChange={e => setFilters(prev => ({ ...prev, vehicleId: e.target.value }))}
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              border: '1px solid #CBD5E1',
              background: '#FFFFFF',
              color: '#0F172A',
              fontSize: '13px',
              fontWeight: 600,
              outline: 'none'
            }}
          >
            <option value="">All Vehicles</option>
            {vehicles.map(v => (
              <option key={v.id} value={v.id}>
                {v.name} {v.plate ? `(${v.plate})` : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Start Date */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Start Date</label>
          <CustomDatePicker
            value={filters.startDate}
            onChange={val => setFilters(prev => ({ ...prev, startDate: val }))}
          />
        </div>

        {/* End Date */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>End Date</label>
          <CustomDatePicker
            value={filters.endDate}
            onChange={val => setFilters(prev => ({ ...prev, endDate: val }))}
          />
        </div>

        {/* Generate Button */}
        <div style={{ display: 'flex', alignItems: 'flex-end', marginLeft: 'auto', paddingTop: '18px' }}>
          <button
            onClick={handleGenerate}
            disabled={loading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '9px 20px',
              background: '#0284C7',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 700,
              cursor: loading ? 'wait' : 'pointer',
              transition: 'background 0.15s'
            }}
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
            Generate Report
          </button>
        </div>
      </div>

      {/* KPI Overview Summary Bar */}
      {data.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '12px',
          marginBottom: '20px'
        }}>
          <div style={{ background: '#FFFFFF', padding: '14px 16px', borderRadius: '10px', border: '1px solid #E2E8F0', borderLeft: '4px solid #10B981' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Total Distance</span>
            <div style={{ fontSize: '20px', fontWeight: 800, color: '#0F172A', marginTop: '4px' }}>
              {totals.distance.toFixed(1)} <span style={{ fontSize: '12px', color: '#64748B', fontWeight: 600 }}>km</span>
            </div>
          </div>

          <div style={{ background: '#FFFFFF', padding: '14px 16px', borderRadius: '10px', border: '1px solid #E2E8F0', borderLeft: '4px solid #2563EB' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Driving Time</span>
            <div style={{ fontSize: '20px', fontWeight: 800, color: '#0F172A', marginTop: '4px' }}>
              {formatDurationHuman(totals.drivingSeconds)}
            </div>
          </div>

          <div style={{ background: '#FFFFFF', padding: '14px 16px', borderRadius: '10px', border: '1px solid #E2E8F0', borderLeft: '4px solid #F59E0B' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Stoppage Time</span>
            <div style={{ fontSize: '20px', fontWeight: 800, color: '#0F172A', marginTop: '4px' }}>
              {formatDurationHuman(totals.stoppageSeconds)}
            </div>
          </div>

          <div style={{ background: '#FFFFFF', padding: '14px 16px', borderRadius: '10px', border: '1px solid #E2E8F0', borderLeft: '4px solid #8B5CF6' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Total Days / Trips</span>
            <div style={{ fontSize: '20px', fontWeight: 800, color: '#0F172A', marginTop: '4px' }}>
              {data.length} <span style={{ fontSize: '12px', color: '#64748B', fontWeight: 600 }}>days ({totals.legs} legs)</span>
            </div>
          </div>

          <div style={{ background: '#FFFFFF', padding: '14px 16px', borderRadius: '10px', border: '1px solid #E2E8F0', borderLeft: '4px solid #EA580C' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Total Stops Made</span>
            <div style={{ fontSize: '20px', fontWeight: 800, color: '#0F172A', marginTop: '4px' }}>
              {totals.stops} <span style={{ fontSize: '12px', color: '#64748B', fontWeight: 600 }}>stops</span>
            </div>
          </div>
        </div>
      )}

      {/* Main Table Card */}
      <div style={{ background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                <th style={{ padding: '12px 16px', fontWeight: 800, color: '#475569', fontSize: '11px', textTransform: 'uppercase' }}>Date</th>
                <th style={{ padding: '12px 16px', fontWeight: 800, color: '#475569', fontSize: '11px', textTransform: 'uppercase' }}>Vehicle</th>
                <th style={{ padding: '12px 16px', fontWeight: 800, color: '#475569', fontSize: '11px', textTransform: 'uppercase' }}>Initial Departure (Start)</th>
                <th style={{ padding: '12px 16px', fontWeight: 800, color: '#475569', fontSize: '11px', textTransform: 'uppercase' }}>Final Arrival (End)</th>
                <th style={{ padding: '12px 16px', fontWeight: 800, color: '#475569', fontSize: '11px', textTransform: 'uppercase', textAlign: 'right' }}>Distance</th>
                <th style={{ padding: '12px 16px', fontWeight: 800, color: '#475569', fontSize: '11px', textTransform: 'uppercase', textAlign: 'center' }}>Driving Time</th>
                <th style={{ padding: '12px 16px', fontWeight: 800, color: '#475569', fontSize: '11px', textTransform: 'uppercase', textAlign: 'center' }}>Stoppage Time</th>
                <th style={{ padding: '12px 16px', fontWeight: 800, color: '#475569', fontSize: '11px', textTransform: 'uppercase', textAlign: 'center' }}>Total Span</th>
                <th style={{ padding: '12px 16px', fontWeight: 800, color: '#475569', fontSize: '11px', textTransform: 'uppercase', textAlign: 'center' }}>Stops</th>
                <th style={{ padding: '12px 16px', fontWeight: 800, color: '#475569', fontSize: '11px', textTransform: 'uppercase', textAlign: 'center' }}>Max/Avg</th>
                <th style={{ padding: '12px 16px', fontWeight: 800, color: '#475569', fontSize: '11px', textTransform: 'uppercase', textAlign: 'center' }}>Breakdown</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="11" style={{ textAlign: 'center', padding: '40px', color: '#64748B' }}>
                    <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto 8px auto', display: 'block', color: '#0284C7' }} />
                    Generating daily total trip journey details...
                  </td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan="11" style={{ textAlign: 'center', padding: '40px', color: '#64748B' }}>
                    <Route size={32} color="#CBD5E1" style={{ margin: '0 auto 8px auto', display: 'block' }} />
                    No trips recorded for the selected vehicle and date range. Click "Generate Report" to fetch data.
                  </td>
                </tr>
              ) : (
                data.map((row, idx) => {
                  const isExpanded = !!expandedRows[`${row.vehicle_id}-${row.date}`];
                  return (
                    <React.Fragment key={`${row.vehicle_id}-${row.date}-${idx}`}>
                      <tr
                        style={{
                          borderBottom: '1px solid #F1F5F9',
                          background: isExpanded ? '#F0FDF4' : (idx % 2 === 0 ? '#FFFFFF' : '#FAFAFA'),
                          transition: 'background 0.15s'
                        }}
                      >
                        {/* Date */}
                        <td style={{ padding: '12px 16px', fontWeight: 700, color: '#0F172A', whiteSpace: 'nowrap' }}>
                          {formatLocalDate(row.date)}
                        </td>

                        {/* Vehicle */}
                        <td style={{ padding: '12px 16px', fontWeight: 700, color: '#1E293B', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Truck size={14} color="#64748B" />
                            <span>{row.vehicle_name}</span>
                          </div>
                          {row.plate && <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 500 }}>{row.plate}</div>}
                        </td>

                        {/* Departure Start */}
                        <td style={{ padding: '12px 16px', minWidth: '180px', maxWidth: '240px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 700, color: '#10B981', fontSize: '12px' }}>
                            <PlayCircle size={13} color="#10B981" />
                            <span>{formatLocalTime(row.start_time)}</span>
                          </div>
                          <div style={{ fontSize: '11px', color: '#475569', marginTop: '2px' }}>
                            <AddressText lat={row.start_lat} lng={row.start_lng} />
                          </div>
                        </td>

                        {/* Final Arrival End */}
                        <td style={{ padding: '12px 16px', minWidth: '180px', maxWidth: '240px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 700, color: '#EF4444', fontSize: '12px' }}>
                            <Flag size={13} color="#EF4444" />
                            <span>{formatLocalTime(row.end_time)}</span>
                          </div>
                          <div style={{ fontSize: '11px', color: '#475569', marginTop: '2px' }}>
                            <AddressText lat={row.end_lat} lng={row.end_lng} />
                          </div>
                        </td>

                        {/* Distance */}
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 800, color: '#0F172A', whiteSpace: 'nowrap' }}>
                          {row.total_distance} <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 500 }}>km</span>
                        </td>

                        {/* Driving Time */}
                        <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700, color: '#2563EB', fontFamily: 'monospace' }}>
                          {formatDuration(row.driving_seconds)}
                        </td>

                        {/* Stoppage Time */}
                        <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700, color: '#D97706', fontFamily: 'monospace' }}>
                          {formatDuration(row.stoppage_seconds)}
                        </td>

                        {/* Total Span */}
                        <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700, color: '#475569', fontFamily: 'monospace' }}>
                          {formatDuration(row.total_span_seconds)}
                        </td>

                        {/* Stops Count */}
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                          <span style={{
                            padding: '3px 8px',
                            borderRadius: '12px',
                            background: row.stops_count > 0 ? '#FFF7ED' : '#F1F5F9',
                            color: row.stops_count > 0 ? '#C2410C' : '#64748B',
                            fontWeight: 700,
                            fontSize: '11px'
                          }}>
                            {row.stops_count} stop{row.stops_count !== 1 ? 's' : ''}
                          </span>
                        </td>

                        {/* Max / Avg Speed */}
                        <td style={{ padding: '12px 16px', textAlign: 'center', whiteSpace: 'nowrap', fontSize: '12px' }}>
                          <span style={{ fontWeight: 700, color: '#DC2626' }}>{row.max_speed}</span>
                          <span style={{ color: '#94A3B8' }}> / </span>
                          <span style={{ fontWeight: 600, color: '#475569' }}>{row.avg_speed}</span>
                          <span style={{ fontSize: '10px', color: '#94A3B8' }}> km/h</span>
                        </td>

                        {/* Action: Expand Legs */}
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                          <button
                            onClick={() => toggleRow(`${row.vehicle_id}-${row.date}`)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '5px 10px',
                              borderRadius: '6px',
                              background: isExpanded ? '#DCFCE7' : '#F1F5F9',
                              color: isExpanded ? '#15803D' : '#475569',
                              border: isExpanded ? '1px solid #86EFAC' : '1px solid #CBD5E1',
                              fontSize: '11px',
                              fontWeight: 700,
                              cursor: 'pointer'
                            }}
                          >
                            <span>{row.legs_count} Legs</span>
                            {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                          </button>
                        </td>
                      </tr>

                      {/* Expanded Drawer: Timeline of intermediate legs and stoppages */}
                      {isExpanded && row.timeline && (
                        <tr>
                          <td colSpan="11" style={{ padding: '0', background: '#F8FAFC', borderBottom: '2px solid #E2E8F0' }}>
                            <div style={{ padding: '16px 24px', background: 'linear-gradient(to right, #F8FAFC, #F1F5F9)' }}>
                              <div style={{ fontSize: '12px', fontWeight: 800, color: '#0F172A', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Activity size={14} color="#10B981" />
                                Intermediate Journey Timeline for {formatLocalDate(row.date)} ({row.vehicle_name})
                              </div>

                              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderLeft: '2px dashed #CBD5E1', marginLeft: '12px', paddingLeft: '16px' }}>
                                {row.timeline.map((item, tIdx) => {
                                  if (item.type === 'leg') {
                                    return (
                                      <div
                                        key={`leg-${tIdx}`}
                                        style={{
                                          background: '#FFFFFF',
                                          border: '1px solid #E2E8F0',
                                          borderRadius: '8px',
                                          padding: '10px 14px',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'space-between',
                                          boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
                                          position: 'relative'
                                        }}
                                      >
                                        <div style={{
                                          position: 'absolute',
                                          left: '-23px',
                                          width: '12px',
                                          height: '12px',
                                          borderRadius: '50%',
                                          background: '#10B981',
                                          border: '2px solid #FFFFFF'
                                        }} />
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                          <span style={{
                                            fontSize: '11px',
                                            fontWeight: 800,
                                            padding: '2px 8px',
                                            background: '#ECFDF5',
                                            color: '#059669',
                                            borderRadius: '6px',
                                            border: '1px solid #A7F3D0'
                                          }}>
                                            Leg {item.legNumber}
                                          </span>
                                          <div>
                                            <div style={{ fontSize: '12px', fontWeight: 700, color: '#1E293B' }}>
                                              {formatLocalTime(item.startTime)} ➔ {formatLocalTime(item.endTime)}
                                            </div>
                                            <div style={{ fontSize: '11px', color: '#64748B', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                                              <span>From: <AddressText lat={item.startLat} lng={item.startLng} /></span>
                                              <span>•</span>
                                              <span>To: <AddressText lat={item.endLat} lng={item.endLng} /></span>
                                            </div>
                                          </div>
                                        </div>

                                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', textAlign: 'right' }}>
                                          <div>
                                            <div style={{ fontSize: '13px', fontWeight: 800, color: '#0F172A' }}>{item.distance} km</div>
                                            <div style={{ fontSize: '10px', color: '#64748B' }}>Distance</div>
                                          </div>
                                          <div>
                                            <div style={{ fontSize: '13px', fontWeight: 700, color: '#2563EB', fontFamily: 'monospace' }}>
                                              {formatDuration(item.durationSeconds)}
                                            </div>
                                            <div style={{ fontSize: '10px', color: '#64748B' }}>Duration</div>
                                          </div>
                                          <div>
                                            <div style={{ fontSize: '12px', fontWeight: 700, color: '#DC2626' }}>{item.maxSpeed} km/h</div>
                                            <div style={{ fontSize: '10px', color: '#64748B' }}>Max Speed</div>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  } else {
                                    // Intermediate Stop
                                    return (
                                      <div
                                        key={`stop-${tIdx}`}
                                        style={{
                                          background: '#FFFBEB',
                                          border: '1px solid #FDE68A',
                                          borderRadius: '8px',
                                          padding: '8px 12px',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'space-between',
                                          position: 'relative'
                                        }}
                                      >
                                        <div style={{
                                          position: 'absolute',
                                          left: '-23px',
                                          width: '12px',
                                          height: '12px',
                                          borderRadius: '50%',
                                          background: '#D97706',
                                          border: '2px solid #FFFFFF'
                                        }} />
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                          <PauseCircle size={15} color="#D97706" />
                                          <span style={{ fontSize: '11px', fontWeight: 700, color: '#B45309' }}>
                                            Stop {item.stopNumber} ({formatDurationHuman(item.durationSeconds)} Stoppage)
                                          </span>
                                          <span style={{ fontSize: '11px', color: '#92400E' }}>
                                            {formatLocalTime(item.startTime)} - {formatLocalTime(item.endTime)}
                                          </span>
                                          <span style={{ fontSize: '11px', color: '#78350F' }}>
                                            at <AddressText lat={item.lat} lng={item.lng} />
                                          </span>
                                        </div>
                                        <span style={{ fontSize: '11px', fontWeight: 700, color: '#B45309', fontFamily: 'monospace' }}>
                                          {formatDuration(item.durationSeconds)}
                                        </span>
                                      </div>
                                    );
                                  }
                                })}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default DailyTripReportPage;
