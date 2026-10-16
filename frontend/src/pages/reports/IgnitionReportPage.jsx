import React, { useState, useEffect } from 'react';
import { Loader2, Zap, FileSpreadsheet, FileText, Download, ExternalLink } from 'lucide-react';
import axiosInstance from '../../api/axios';
import * as vehicleApi from '../../api/vehicleApi';
import { exportToExcel, exportToPDF, exportToCSV } from '../../utils/exportUtils';
import { getAddressFromCoordinates } from '../../utils/geocodeUtils';

const formatDuration = (ms) => {
  if (ms === null || ms === undefined || ms <= 0) return '';
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

const formatDateTime12 = (dateInput) => {
  if (!dateInput) return '-';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '-';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  return `${hours}:${minutes}:${seconds} ${day}-${month}-${year}`;
};

const formatHeaderTime12 = (dateStr, timeStr) => {
  if (!dateStr) return '-';
  const parts = dateStr.split('-');
  if (parts.length < 3) return '-';
  const [year, month, day] = parts;
  let timePart = '12:00 AM';
  if (timeStr) {
    const [h, m] = timeStr.split(':');
    let hours = parseInt(h, 10);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    const strHours = String(hours ? hours : 12).padStart(2, '0');
    timePart = `${strHours}:${m} ${ampm}`;
  }
  return `${timePart} ${day}-${month}-${year}`;
};

const getTodayDateStr = () => new Date().toISOString().split('T')[0];

const IgnitionReportPage = () => {
  const [loading, setLoading] = useState(false);
  const [vehicles, setVehicles] = useState([]);
  const [reportData, setReportData] = useState(null);
  const [addresses, setAddresses] = useState({});

  const [filters, setFilters] = useState({
    vehicleId: '',
    startDate: getTodayDateStr(),
    startTime: '00:00',
    endDate: getTodayDateStr(),
    endTime: '23:59'
  });

  // Fetch Vehicles on mount safely
  useEffect(() => {
    vehicleApi.getVehicles({ t: Date.now() })
      .then(res => {
        let vList = [];
        if (Array.isArray(res)) vList = res;
        else if (res && res.success && Array.isArray(res.data)) vList = res.data;
        else if (res && Array.isArray(res.data)) vList = res.data;

        if (vList.length > 0) {
          setVehicles(vList);
          setFilters(prev => ({
            ...prev,
            vehicleId: prev.vehicleId || vList[0].id
          }));
        }
      })
      .catch(console.error);
  }, []);

  const fetchReport = async (customFilters = null) => {
    const activeFilters = customFilters || filters;
    if (!activeFilters.vehicleId || !activeFilters.startDate || !activeFilters.endDate) {
      alert("Please select a vehicle.");
      return;
    }
    setLoading(true);
    try {
      const startIso = `${activeFilters.startDate}T${activeFilters.startTime || '00:00'}:00`;
      const endIso = `${activeFilters.endDate}T${activeFilters.endTime || '23:59'}:59`;

      const params = new URLSearchParams();
      params.append('startDate', startIso);
      params.append('endDate', endIso);

      const res = await axiosInstance.get(`/api/vehicles/${activeFilters.vehicleId}/ignition-report?${params.toString()}`);
      if (res.data.success) {
        const data = res.data.data;
        setReportData(data);

        if (data.events && data.events.length > 0) {
          const uniqueCoords = Array.from(
            new Set(data.events.filter(e => e.lat && e.lng).map(e => `${e.lat},${e.lng}`))
          );

          const newAddresses = {};
          await Promise.all(
            uniqueCoords.map(async (coordKey) => {
              const [lat, lng] = coordKey.split(',');
              const addr = await getAddressFromCoordinates(parseFloat(lat), parseFloat(lng));
              newAddresses[coordKey] = addr;
            })
          );

          setAddresses(prev => ({ ...prev, ...newAddresses }));
        }
      }
    } catch (err) {
      console.error('Report fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickPreset = (preset) => {
    const now = new Date();
    let sDate = new Date();
    let eDate = new Date();

    if (preset === 'today') {
      sDate = now;
      eDate = now;
    } else if (preset === 'yesterday') {
      sDate.setDate(now.getDate() - 1);
      eDate.setDate(now.getDate() - 1);
    } else if (preset === 'thisWeek') {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      sDate = new Date(now.setDate(diff));
      eDate = new Date();
    } else if (preset === 'lastWeek') {
      const day = now.getDay();
      const diff = now.getDate() - day - 6;
      sDate = new Date(now.setDate(diff));
      eDate = new Date(sDate);
      eDate.setDate(sDate.getDate() + 6);
    } else if (preset === 'thisMonth') {
      sDate = new Date(now.getFullYear(), now.getMonth(), 1);
      eDate = new Date();
    } else if (preset === 'lastMonth') {
      sDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      eDate = new Date(now.getFullYear(), now.getMonth(), 0);
    }

    const sStr = sDate.toISOString().split('T')[0];
    const eStr = eDate.toISOString().split('T')[0];

    const updatedFilters = {
      ...filters,
      startDate: sStr,
      startTime: '00:00',
      endDate: eStr,
      endTime: '23:59'
    };
    setFilters(updatedFilters);
    fetchReport(updatedFilters);
  };

  const prepareRowRenderSpecs = (events) => {
    if (!events || !events.length) return [];
    const specs = [];
    let i = 0;
    while (i < events.length) {
      const ev = events[i];
      if (ev.status === 'ON' && i + 1 < events.length && events[i + 1].status === 'OFF') {
        const nextEv = events[i + 1];
        const durationText = formatDuration(nextEv.durationMs);

        specs.push({
          ev: ev,
          renderDurationCell: true,
          durationRowSpan: 2,
          durationText: durationText
        });

        specs.push({
          ev: nextEv,
          renderDurationCell: false,
          durationRowSpan: 0,
          durationText: ''
        });

        i += 2;
      } else {
        specs.push({
          ev: ev,
          renderDurationCell: true,
          durationRowSpan: 1,
          durationText: ev.durationMs ? formatDuration(ev.durationMs) : ''
        });
        i += 1;
      }
    }
    return specs;
  };

  const selectedVehicleObj = vehicles.find(v => v.id === filters.vehicleId);

  const getExportData = () => {
    if (!reportData || !reportData.events) return [];
    const rowSpecs = prepareRowRenderSpecs(reportData.events);
    return rowSpecs.map(spec => {
      const ev = spec.ev;
      const coordKey = `${ev.lat},${ev.lng}`;
      const addr = addresses[coordKey] || (ev.lat && ev.lng ? `${ev.lat?.toFixed(5)}, ${ev.lng?.toFixed(5)}` : '-');
      return {
        'Date & Time': formatDateTime12(ev.time),
        'Engine Status': ev.status,
        'Duration': spec.renderDurationCell ? spec.durationText : (ev.durationMs ? formatDuration(ev.durationMs) : ''),
        'Address': addr,
        'Latitude': ev.lat || '',
        'Longitude': ev.lng || ''
      };
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', boxSizing: 'border-box', background: '#F8FAFC', fontFamily: "'Inter', sans-serif", color: '#0F172A', gap: '14px' }}>
      
      {/* Filters Control Bar */}
      <div style={{ background: '#FFFFFF', padding: '12px 16px', border: '1px solid #CBD5E1', borderRadius: '6px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          
          {/* Vehicle Dropdown */}
          <div style={{ flex: '1 1 200px', minWidth: '180px' }}>
            <select value={filters.vehicleId} onChange={e => setFilters({ ...filters, vehicleId: e.target.value })} style={{ width: '100%', padding: '7px 10px', borderRadius: '4px', border: '1px solid #CBD5E1', outline: 'none', background: '#FFFFFF', color: '#0F172A', fontSize: '13px', fontWeight: 600 }}>
              <option value="">Select Vehicle...</option>
              {vehicles.map(v => (
                <option key={v.id} value={v.id}>
                  {v.name} ({v.plate || 'No Plate'})
                </option>
              ))}
            </select>
          </div>

          {/* Start Date & Time */}
          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
            <input type="date" value={filters.startDate} onChange={e => setFilters({ ...filters, startDate: e.target.value })} style={{ padding: '7px 10px', borderRadius: '4px', border: '1px solid #CBD5E1', outline: 'none', fontSize: '13px', background: '#FFF' }} />
            <input type="time" value={filters.startTime} onChange={e => setFilters({ ...filters, startTime: e.target.value })} style={{ padding: '7px 8px', borderRadius: '4px', border: '1px solid #CBD5E1', outline: 'none', fontSize: '13px', background: '#FFF' }} />
          </div>

          <span style={{ color: '#94A3B8', fontSize: '13px' }}>to</span>

          {/* End Date & Time */}
          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
            <input type="date" value={filters.endDate} onChange={e => setFilters({ ...filters, endDate: e.target.value })} style={{ padding: '7px 10px', borderRadius: '4px', border: '1px solid #CBD5E1', outline: 'none', fontSize: '13px', background: '#FFF' }} />
            <input type="time" value={filters.endTime} onChange={e => setFilters({ ...filters, endTime: e.target.value })} style={{ padding: '7px 8px', borderRadius: '4px', border: '1px solid #CBD5E1', outline: 'none', fontSize: '13px', background: '#FFF' }} />
          </div>

          {/* Submit Button */}
          <button onClick={() => fetchReport()} disabled={loading} style={{ padding: '8px 20px', borderRadius: '4px', background: '#0284C7', color: '#FFFFFF', border: 'none', fontWeight: 700, fontSize: '13px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            {loading ? <Loader2 size={15} className="animate-spin" /> : null}
            Submit
          </button>
        </div>

        {/* Quick Presets Bar */}
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center', paddingTop: '6px', borderTop: '1px solid #F1F5F9' }}>
          {[
            { id: 'today', label: 'Today' },
            { id: 'yesterday', label: 'Yesterday' },
            { id: 'thisWeek', label: 'This Week' },
            { id: 'lastWeek', label: 'Last Week' },
            { id: 'thisMonth', label: 'This Month' },
            { id: 'lastMonth', label: 'Last Month' }
          ].map(p => (
            <button key={p.id} onClick={() => handleQuickPreset(p.id)} style={{ background: 'none', border: 'none', color: '#0284C7', fontSize: '13px', fontWeight: 700, cursor: 'pointer', padding: 0, textDecoration: 'none' }} onMouseEnter={e => e.target.style.textDecoration = 'underline'} onMouseLeave={e => e.target.style.textDecoration = 'none'}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      {reportData && (
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          
          {/* Top Export Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button title="Export to Excel" onClick={() => exportToExcel(getExportData(), 'Engine_ON_Report')} disabled={!reportData.events?.length} style={{ padding: '5px 12px', borderRadius: '4px', background: '#22C55E', color: '#FFF', border: 'none', cursor: reportData.events?.length ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 700, opacity: reportData.events?.length ? 1 : 0.5 }}>
              <FileSpreadsheet size={15} /> Excel
            </button>
            <button title="Export to CSV" onClick={() => exportToCSV(getExportData(), 'Engine_ON_Report')} disabled={!reportData.events?.length} style={{ padding: '5px 12px', borderRadius: '4px', background: '#10B981', color: '#FFF', border: 'none', cursor: reportData.events?.length ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 700, opacity: reportData.events?.length ? 1 : 0.5 }}>
              <FileText size={15} /> CSV
            </button>
            <button title="Export to PDF" onClick={() => exportToPDF(['Date & Time', 'Engine Status', 'Duration', 'Address'], getExportData(), 'Engine ON Report', 'Engine_ON_Report')} disabled={!reportData.events?.length} style={{ padding: '5px 12px', borderRadius: '4px', background: '#EF4444', color: '#FFF', border: 'none', cursor: reportData.events?.length ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 700, opacity: reportData.events?.length ? 1 : 0.5 }}>
              <Download size={15} /> PDF
            </button>
          </div>

          {/* Summary Box */}
          <div style={{ width: '100%', border: '1px solid #00A3AD', borderRadius: '2px', overflow: 'hidden', background: '#FFFFFF' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <tbody>
                <tr style={{ borderBottom: '1px solid #E0F2FE' }}>
                  <td style={{ background: '#E0F2FE', padding: '8px 12px', width: '20%', fontWeight: 700, color: '#0F172A', borderRight: '1px solid #BAE6FD' }}>Vehicle Group</td>
                  <td style={{ padding: '8px 12px', width: '30%', fontWeight: 700, color: '#334155', borderRight: '1px solid #BAE6FD' }}>{reportData.vehicleInfo?.vehicleGroup || selectedVehicleObj?.org_name || 'Fleet Group'}</td>
                  <td style={{ background: '#E0F2FE', padding: '8px 12px', width: '20%', fontWeight: 700, color: '#0F172A', borderRight: '1px solid #BAE6FD' }}>Vehicle Name / Id</td>
                  <td style={{ padding: '8px 12px', width: '30%', fontWeight: 700, color: '#334155' }}>{selectedVehicleObj?.name} / {selectedVehicleObj?.name}</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #E0F2FE' }}>
                  <td style={{ background: '#E0F2FE', padding: '8px 12px', fontWeight: 700, color: '#0F172A', borderRight: '1px solid #BAE6FD' }}>Engine ON</td>
                  <td style={{ padding: '8px 12px', color: '#334155', borderRight: '1px solid #BAE6FD' }}>{reportData.vehicleInfo?.engineOnDetection || 'Voltage + Ignition ( 26.0 )'}</td>
                  <td style={{ background: '#E0F2FE', padding: '8px 12px', fontWeight: 700, color: '#0F172A', borderRight: '1px solid #BAE6FD' }}>Total Duration</td>
                  <td style={{ padding: '8px 12px', fontWeight: 700, color: '#0F172A' }}>{formatDuration(reportData.summary?.totalRunningMs) || '00:00:00'}</td>
                </tr>
                <tr>
                  <td style={{ background: '#E0F2FE', padding: '8px 12px', fontWeight: 700, color: '#0F172A', borderRight: '1px solid #BAE6FD' }}>From Date & Time</td>
                  <td style={{ padding: '8px 12px', color: '#334155', borderRight: '1px solid #BAE6FD' }}>{formatHeaderTime12(filters.startDate, filters.startTime)}</td>
                  <td style={{ background: '#E0F2FE', padding: '8px 12px', fontWeight: 700, color: '#0F172A', borderRight: '1px solid #BAE6FD' }}>To Date & Time</td>
                  <td style={{ padding: '8px 12px', color: '#334155' }}>{formatHeaderTime12(filters.endDate, filters.endTime)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Engine ON Events Main Data Table */}
          <div style={{ overflowX: 'auto', border: '1px solid #CBD5E1', borderRadius: '2px', background: '#FFFFFF' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'center' }}>
              <thead>
                <tr style={{ background: '#E6F0F5', color: '#334155', borderBottom: '1px solid #CBD5E1' }}>
                  <th style={{ padding: '10px 12px', borderRight: '1px solid #CBD5E1', fontWeight: 700, width: '20%' }}>Date & Time</th>
                  <th style={{ padding: '10px 12px', borderRight: '1px solid #CBD5E1', fontWeight: 700, width: '12%' }}>Engine Status</th>
                  <th style={{ padding: '10px 12px', borderRight: '1px solid #CBD5E1', fontWeight: 700, width: '15%' }}>Duration</th>
                  <th style={{ padding: '10px 12px', borderRight: '1px solid #CBD5E1', fontWeight: 700, width: '43%' }}>Address</th>
                  <th style={{ padding: '10px 12px', fontWeight: 700, width: '10%' }}>G-Map</th>
                </tr>
              </thead>
              <tbody>
                {reportData.events && reportData.events.length > 0 ? (
                  (() => {
                    const rowSpecs = prepareRowRenderSpecs(reportData.events);
                    return rowSpecs.map((spec, idx) => {
                      const ev = spec.ev;
                      const coordKey = `${ev.lat},${ev.lng}`;
                      const addressText = addresses[coordKey] || (ev.lat && ev.lng ? 'Loading address...' : '-');

                      return (
                        <tr key={idx} style={{ borderBottom: '1px solid #E2E8F0', background: idx % 2 === 0 ? '#FFFFFF' : '#F9FAFB' }}>
                          <td style={{ padding: '8px 12px', borderRight: '1px solid #E2E8F0', color: '#1E293B', fontWeight: 500 }}>
                            {formatDateTime12(ev.time)}
                          </td>
                          <td style={{ padding: '8px 12px', borderRight: '1px solid #E2E8F0', fontWeight: 800, color: ev.status === 'ON' ? '#1E293B' : '#64748B' }}>
                            {ev.status}
                          </td>
                          {spec.renderDurationCell && (
                            <td
                              rowSpan={spec.durationRowSpan}
                              style={{
                                padding: '8px 12px',
                                borderRight: '1px solid #E2E8F0',
                                color: '#0F172A',
                                fontWeight: 600,
                                fontFamily: 'monospace',
                                verticalAlign: 'middle'
                              }}
                            >
                              {spec.durationText}
                            </td>
                          )}
                          <td style={{ padding: '8px 12px', borderRight: '1px solid #E2E8F0', textAlign: 'left', color: '#334155' }}>
                            {addressText}
                          </td>
                          <td style={{ padding: '8px 12px' }}>
                            {ev.lat && ev.lng ? (
                              <a href={`https://www.google.com/maps?q=${ev.lat},${ev.lng}`} target="_blank" rel="noreferrer" style={{ color: '#0284C7', fontWeight: 600, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                Link <ExternalLink size={12} />
                              </a>
                            ) : '-'}
                          </td>
                        </tr>
                      );
                    });
                  })()
                ) : (
                  <tr>
                    <td colSpan={5} style={{ padding: '30px', color: '#64748B', fontSize: '13px', background: '#FFF' }}>
                      <Zap size={28} style={{ margin: '0 auto 6px', opacity: 0.3 }} />
                      <div>No Engine ON events found for <strong>{selectedVehicleObj?.name}</strong> in the selected date range.</div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

        </div>
      )}
    </div>
  );
};

export default IgnitionReportPage;
