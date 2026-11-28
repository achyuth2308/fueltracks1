import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Loader2, Calendar, FileSpreadsheet, FileText, Download, Play } from 'lucide-react';
import { exportToExcel, exportToPDF, exportToCSV } from '../../utils/exportUtils';
import axiosInstance from '../../api/axios';
import * as vehicleApi from '../../api/vehicleApi';
import ReportGroupVehicleSidebar from '../../components/reports/ReportGroupVehicleSidebar';

const getTodayDateStr = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const formatDurationHMS = (seconds) => {
  if (!seconds || isNaN(seconds) || seconds <= 0) return '00:00:00';
  const sec = Math.round(Number(seconds));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

const formatLegacyDateTime = (dateVal) => {
  if (!dateVal) return '-';
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return '-';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  return `${hours}:${minutes}:${seconds} ${day}-${month}-${year}`;
};

const formatHeaderDate = (dStr) => {
  if (!dStr) return '';
  const parts = dStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return dStr;
};

const IndividualReportPage = () => {
  const todayStr = getTodayDateStr();
  const [vehicles, setVehicles] = useState([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState(null);

  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState(todayStr);
  const [activePreset, setActivePreset] = useState('today');

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  // Load vehicles
  useEffect(() => {
    vehicleApi.getVehicles({ t: Date.now(), limit: 1000 })
      .then(res => {
        if (res.success && res.data?.length > 0) {
          setVehicles(res.data);
          setSelectedVehicleId(res.data[0].id);
        }
      })
      .catch(console.error);
  }, []);

  // Fetch report data
  const handleGenerate = useCallback(async (sDate, eDate, vId, explicitVIds) => {
    const curStart = sDate || startDate;
    const curEnd = eDate || endDate;

    let targetIds = [];
    if (Array.isArray(explicitVIds) && explicitVIds.length > 0) {
      targetIds = explicitVIds;
    } else {
      const curVId = vId !== undefined ? vId : selectedVehicleId;
      if (curVId === 'ALL') {
        targetIds = vehicles.map(v => v.id);
      } else if (curVId) {
        targetIds = [curVId];
      }
    }

    if (!curStart || !curEnd || targetIds.length === 0) return;
    setLoading(true);

    try {
      const start = new Date(curStart);
      start.setHours(0, 0, 0, 0);
      const end = new Date(curEnd);
      end.setHours(23, 59, 59, 999);

      const params = new URLSearchParams();
      params.append('startDate', start.toISOString());
      params.append('endDate', end.toISOString());
      params.append('vehicleIds', targetIds.join(','));

      const res = await axiosInstance.get(`/api/reports/individual?${params.toString()}`);
      if (res.data?.success) {
        setData(res.data.data);
      } else {
        setData(null);
      }
    } catch (err) {
      console.error('Failed to load individual report:', err);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, selectedVehicleId, vehicles]);

  // Initial fetch on vehicle load
  useEffect(() => {
    if (selectedVehicleId && vehicles.length > 0 && !data && !loading) {
      handleGenerate(startDate, endDate, selectedVehicleId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVehicleId, vehicles.length]);

  // Quick Date Range Presets
  const setQuickRange = (preset) => {
    setActivePreset(preset);
    const now = new Date();
    const toISO = (d) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    let sDate = todayStr;
    let eDate = todayStr;

    if (preset === 'today') {
      sDate = todayStr;
      eDate = todayStr;
    } else if (preset === 'yesterday') {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      sDate = toISO(y);
      eDate = sDate;
    } else if (preset === 'this_week') {
      const cur = new Date(now);
      const day = cur.getDay();
      const diff = cur.getDate() - day + (day === 0 ? -6 : 1);
      const mon = new Date(cur.setDate(diff));
      sDate = toISO(mon);
      eDate = todayStr;
    } else if (preset === 'last_week') {
      const cur = new Date(now);
      const day = cur.getDay();
      const diffToMon = cur.getDate() - day + (day === 0 ? -6 : 1) - 7;
      const lastMon = new Date(cur.setDate(diffToMon));
      const lastSun = new Date(lastMon);
      lastSun.setDate(lastSun.getDate() + 6);
      sDate = toISO(lastMon);
      eDate = toISO(lastSun);
    } else if (preset === 'this_month') {
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      sDate = toISO(first);
      eDate = todayStr;
    } else if (preset === 'last_month') {
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const last = new Date(now.getFullYear(), now.getMonth(), 0);
      sDate = toISO(first);
      eDate = toISO(last);
    }

    setStartDate(sDate);
    setEndDate(eDate);
    handleGenerate(sDate, eDate, selectedVehicleId);
  };

  // Resolved vehicle timeline reports array
  const vehicleReports = useMemo(() => {
    if (!data) return [];
    if (Array.isArray(data.vehicles) && data.vehicles.length > 0) {
      return data.vehicles;
    }
    if (data.vehicle) {
      return [{
        vehicle: data.vehicle,
        summary: data.summary || {},
        intervals: data.intervals || []
      }];
    }
    return [];
  }, [data]);

  const columns = ['Vehicle Name', 'Status', 'Start', 'End', 'Duration (HH:MM:SS)', 'Length', 'Location Details', 'Speed Hike', 'Speed Avg'];

  const getExportData = () => {
    if (!vehicleReports || vehicleReports.length === 0) return [];
    const rows = [];
    vehicleReports.forEach(vr => {
      const vName = vr.vehicle?.name || vr.vehicle?.plate || '-';
      (vr.intervals || []).forEach(it => {
        rows.push({
          'Vehicle Name': vName,
          'Status': it.status,
          'Start': formatLegacyDateTime(it.start_time),
          'End': formatLegacyDateTime(it.end_time),
          'Duration (HH:MM:SS)': formatDurationHMS(it.duration_seconds),
          'Length': it.status === 'Moving' ? `${it.distance || 0} Km` : '-',
          'Location Details': it.address || (it.start_lat ? `${Number(it.start_lat).toFixed(4)}, ${Number(it.start_lng).toFixed(4)}` : '-'),
          'Speed Hike': it.status === 'Moving' ? `${it.max_speed || 0} Km` : '-',
          'Speed Avg': it.status === 'Moving' ? `${it.avg_speed || it.max_speed || 0} Km` : '-'
        });
      });
    });
    return rows;
  };

  return (
    <div style={{
      display: 'flex',
      flex: 1,
      height: '100%',
      minHeight: 0,
      overflow: 'hidden',
      background: '#F8FAFC',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    }}>

      {/* ═══════════ LEFT: GROUP ACCORDION VEHICLE SIDEBAR ═══════════ */}
      <ReportGroupVehicleSidebar
        vehicles={vehicles}
        selectedVehicleId={selectedVehicleId}
        selectedGroupId={selectedGroupId}
        showAllOption={true}
        onSelectVehicle={(id) => {
          setSelectedVehicleId(id);
          setSelectedGroupId(null);
          handleGenerate(startDate, endDate, id);
        }}
        onSelectGroup={(grpId, grpVehicles) => {
          setSelectedGroupId(grpId);
          setSelectedVehicleId('ALL');
          const ids = (grpVehicles || []).map(v => v.id);
          handleGenerate(startDate, endDate, null, ids);
        }}
        width="175px"
      />

      {/* ═══════════ RIGHT: REPORT WORKSPACE ═══════════ */}
      <div style={{
        flex: 1,
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        background: '#FFFFFF',
        padding: '10px 14px',
        overflow: 'hidden',
        gap: '8px'
      }}>

        {/* ── 1. Top Controls Bar: Dates + Generate + Exports ── */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '8px',
          paddingBottom: '4px',
          borderBottom: '1px solid #E2E8F0'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {/* Start Date */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', border: '1px solid #CBD5E1', padding: '3px 8px', borderRadius: '5px', background: '#F8FAFC' }}>
              <Calendar size={13} color="#64748B" />
              <input
                type="date"
                value={startDate}
                onChange={e => { setStartDate(e.target.value); setActivePreset(''); }}
                style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: '11.5px', color: '#0F172A', cursor: 'pointer', fontWeight: 500 }}
              />
            </div>

            <span style={{ fontSize: '12px', color: '#94A3B8', fontWeight: 600 }}>→</span>

            {/* End Date */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', border: '1px solid #CBD5E1', padding: '3px 8px', borderRadius: '5px', background: '#F8FAFC' }}>
              <Calendar size={13} color="#64748B" />
              <input
                type="date"
                value={endDate}
                onChange={e => { setEndDate(e.target.value); setActivePreset(''); }}
                style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: '11.5px', color: '#0F172A', cursor: 'pointer', fontWeight: 500 }}
              />
            </div>

            {/* Generate Button */}
            <button
              onClick={() => handleGenerate(startDate, endDate, selectedVehicleId)}
              disabled={loading}
              style={{
                background: 'linear-gradient(135deg, #059669, #047857)',
                color: '#FFFFFF',
                border: 'none',
                padding: '5px 16px',
                borderRadius: '999px',
                fontSize: '11.5px',
                fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                boxShadow: '0 2px 4px rgba(5,150,105,0.25)'
              }}
            >
              {loading ? <Loader2 size={12} className="animate-spin" /> : <Play size={10} fill="#FFFFFF" color="#FFFFFF" />}
              <span>Generate</span>
            </button>
          </div>

          {/* Export Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              onClick={() => exportToExcel(getExportData(), 'individual_report')}
              disabled={!data}
              title="Download Excel Report"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                background: '#F0FDF4',
                border: '1px solid #DCFCE7',
                padding: '3px 8px',
                borderRadius: '5px',
                cursor: data ? 'pointer' : 'not-allowed',
                opacity: data ? 1 : 0.5
              }}
            >
              <FileSpreadsheet size={13} color="#16A34A" />
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#15803D' }}>Excel</span>
            </button>

            <button
              onClick={() => exportToPDF(columns, getExportData(), 'Individual Vehicle Report', 'individual_report')}
              disabled={!data}
              title="Download PDF Report"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                background: '#FEF2F2',
                border: '1px solid #FEE2E2',
                padding: '3px 8px',
                borderRadius: '5px',
                cursor: data ? 'pointer' : 'not-allowed',
                opacity: data ? 1 : 0.5
              }}
            >
              <FileText size={13} color="#DC2626" />
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#B91C1C' }}>PDF</span>
            </button>

            <button
              onClick={() => exportToCSV(getExportData(), 'individual_report')}
              disabled={!data}
              title="Download CSV"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                background: '#EFF6FF',
                border: '1px solid #DBEAFE',
                padding: '3px 8px',
                borderRadius: '5px',
                cursor: data ? 'pointer' : 'not-allowed',
                opacity: data ? 1 : 0.5
              }}
            >
              <Download size={13} color="#2563EB" />
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#1D4ED8' }}>CSV</span>
            </button>
          </div>
        </div>

        {/* ── 2. Segmented Quick Date Pill Bar ── */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '6px',
          padding: '2px',
          width: 'fit-content',
          margin: '0 auto'
        }}>
          {[
            { id: 'today', label: 'Today' },
            { id: 'yesterday', label: 'Yesterday' },
            { id: 'this_week', label: 'This Week' },
            { id: 'last_week', label: 'Last Week' },
            { id: 'this_month', label: 'This Month' },
            { id: 'last_month', label: 'Last Month' }
          ].map(p => {
            const isActive = activePreset === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setQuickRange(p.id)}
                style={{
                  background: isActive ? '#064E3B' : '#E6F4EA',
                  border: 'none',
                  color: isActive ? '#FFFFFF' : '#334155',
                  fontSize: '11px',
                  fontWeight: isActive ? 700 : 600,
                  cursor: 'pointer',
                  padding: '4px 14px',
                  borderRadius: '999px',
                  boxShadow: isActive ? '0 1px 3px rgba(6,78,59,0.3)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                {p.label}
              </button>
            );
          })}
        </div>

        {/* ── 3. Main Data Container (Stacked Vehicle Tables) ── */}
        <div style={{
          flex: 1,
          border: '1px solid #CBD5E1',
          overflow: 'auto',
          background: '#F8FAFC',
          padding: '8px'
        }}>
          {loading ? (
            <div style={{ padding: '60px', textAlign: 'center' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: '#059669', fontSize: '13px', fontWeight: 600 }}>
                <Loader2 size={18} className="animate-spin" />
                <span>Generating vehicle timeline report...</span>
              </div>
            </div>
          ) : vehicleReports.length === 0 ? (
            <div style={{ padding: '60px', textAlign: 'center', color: '#64748B', fontSize: '12px' }}>
              No vehicle timeline records found for the selected period.
            </div>
          ) : (
            vehicleReports.map((vRep, vIdx) => {
              const summary = vRep.summary || {};
              const intervals = vRep.intervals || [];
              const vName = vRep.vehicle?.name || vRep.vehicle?.plate || `Vehicle ${vIdx + 1}`;

              return (
                <div
                  key={vRep.vehicle?.id || vIdx}
                  style={{
                    marginBottom: '16px',
                    border: '1px solid #B6D4FE',
                    borderRadius: '4px',
                    overflow: 'hidden',
                    background: '#FFFFFF',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                  }}
                >
                  {/* Executive Blue Summary Banner */}
                  <div style={{
                    background: '#CFE2FF',
                    borderBottom: '1px solid #9EC5FE',
                    padding: '6px 12px',
                    fontSize: '11.5px',
                    lineHeight: '1.4'
                  }}>
                    {/* Top Row: Vehicle Name, Date Range, Trip Distance */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '8px',
                      color: '#084298',
                      paddingBottom: '3px',
                      borderBottom: '1px solid rgba(13, 110, 253, 0.2)'
                    }}>
                      <div style={{ fontWeight: 800 }}>
                        Vehicle Name : <span style={{ color: '#052c65' }}>{vName}</span>
                      </div>
                      <div style={{ fontWeight: 600 }}>
                        From : 12:00 AM {formatHeaderDate(startDate)} - To: 11:59 PM {formatHeaderDate(endDate)}
                      </div>
                      <div style={{ fontWeight: 700 }}>
                        Trip Distance : <span style={{ color: '#052c65' }}>{summary.tripDistance || 0}</span>
                      </div>
                    </div>

                    {/* Bottom Row: Moving, Parked, Idle, Speed Hike, Avg Speed */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '12px',
                      color: '#084298',
                      paddingTop: '3px',
                      fontSize: '11px'
                    }}>
                      <div>
                        Moving : <strong style={{ color: '#052c65' }}>{formatDurationHMS(summary.movingSeconds)}</strong>
                      </div>
                      <div>
                        Parked : <strong style={{ color: '#052c65' }}>{formatDurationHMS(summary.parkedSeconds)}</strong>
                      </div>
                      <div>
                        Idle : <strong style={{ color: '#052c65' }}>{formatDurationHMS(summary.idleSeconds)}</strong>
                      </div>
                      <div>
                        Speed Hike : <strong style={{ color: '#052c65' }}>{summary.speedHike || 0} Km</strong>
                      </div>
                      <div>
                        Avg Speed : <strong style={{ color: '#052c65' }}>{summary.avgSpeed || 0} Km</strong>
                      </div>
                    </div>
                  </div>

                  {/* Interval Timeline Table */}
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'center' }}>
                      <thead>
                        <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #CBD5E1', color: '#475569', fontWeight: 700 }}>
                          <th style={{ padding: '6px 6px', border: '1px solid #E2E8F0', width: '35px' }}>#</th>
                          <th style={{ padding: '6px 8px', border: '1px solid #E2E8F0', width: '75px' }}>Status</th>
                          <th style={{ padding: '6px 8px', border: '1px solid #E2E8F0', width: '145px' }}>Start</th>
                          <th style={{ padding: '6px 8px', border: '1px solid #E2E8F0', width: '145px' }}>End</th>
                          <th style={{ padding: '6px 8px', border: '1px solid #E2E8F0', width: '130px' }}>Duration (HH:MM:SS)</th>
                          <th style={{ padding: '6px 8px', border: '1px solid #E2E8F0', width: '75px' }}>Length</th>
                          <th style={{ padding: '6px 8px', border: '1px solid #E2E8F0', textAlign: 'left' }}>Location Details</th>
                          <th style={{ padding: '6px 8px', border: '1px solid #E2E8F0', width: '80px' }}>Speed Hike</th>
                          <th style={{ padding: '6px 8px', border: '1px solid #E2E8F0', width: '80px' }}>Speed Avg</th>
                        </tr>
                      </thead>
                      <tbody>
                        {intervals.length === 0 ? (
                          <tr>
                            <td colSpan={9} style={{ padding: '16px', color: '#64748B', border: '1px solid #E2E8F0' }}>
                              No activity recorded for this vehicle.
                            </td>
                          </tr>
                        ) : (
                          intervals.map((it, itIdx) => {
                            const isMoving = it.status === 'Moving';
                            const isIdle = it.status === 'Idle';
                            const isParked = it.status === 'Parked';
                            const isNoData = it.status === 'No Data';

                            const statusColor = isMoving ? '#15803D' : (isIdle ? '#B45309' : (isParked ? '#1D4ED8' : '#B91C1C'));

                            return (
                              <tr
                                key={itIdx}
                                style={{
                                  background: itIdx % 2 === 0 ? '#FFFFFF' : '#FAFAFA',
                                  transition: 'background 0.1s ease'
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = '#F0F9FF'}
                                onMouseLeave={e => e.currentTarget.style.background = itIdx % 2 === 0 ? '#FFFFFF' : '#FAFAFA'}
                              >
                                <td style={{ padding: '4px 6px', border: '1px solid #E2E8F0', color: '#64748B' }}>
                                  {itIdx + 1}
                                </td>
                                <td style={{ padding: '4px 6px', border: '1px solid #E2E8F0', fontWeight: 700, color: statusColor }}>
                                  {it.status}
                                </td>
                                <td style={{ padding: '4px 6px', border: '1px solid #E2E8F0', fontFamily: 'monospace', fontSize: '10.5px' }}>
                                  {formatLegacyDateTime(it.start_time)}
                                </td>
                                <td style={{ padding: '4px 6px', border: '1px solid #E2E8F0', fontFamily: 'monospace', fontSize: '10.5px' }}>
                                  {formatLegacyDateTime(it.end_time)}
                                </td>
                                <td style={{ padding: '4px 6px', border: '1px solid #E2E8F0', fontWeight: 600 }}>
                                  {formatDurationHMS(it.duration_seconds)}
                                </td>
                                <td style={{ padding: '4px 6px', border: '1px solid #E2E8F0' }}>
                                  {isMoving ? `${it.distance || 0} Km` : (it.distance > 0 ? `${it.distance} Km` : '')}
                                </td>
                                <td style={{ padding: '4px 8px', border: '1px solid #E2E8F0', textAlign: 'left', color: '#1E293B', fontSize: '10.5px', lineHeight: '1.3' }}>
                                  {it.address || (it.start_lat ? `${Number(it.start_lat).toFixed(4)}, ${Number(it.start_lng).toFixed(4)}` : '-')}
                                </td>
                                <td style={{ padding: '4px 6px', border: '1px solid #E2E8F0' }}>
                                  {isMoving ? `${it.max_speed || 0} Km` : ''}
                                </td>
                                <td style={{ padding: '4px 6px', border: '1px solid #E2E8F0' }}>
                                  {isMoving ? `${it.avg_speed || it.max_speed || 0} Km` : ''}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })
          )}
        </div>

      </div>
    </div>
  );
};

export default IndividualReportPage;
