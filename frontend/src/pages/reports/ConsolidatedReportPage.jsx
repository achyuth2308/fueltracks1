import React, { useState, useEffect, useMemo } from 'react';
import CustomDatePicker from '../../components/ui/CustomDatePicker';
import { useNavigate } from 'react-router-dom';
import {
  FileSpreadsheet, FileText, Search, Loader2, Calendar,
  Clock, CheckCircle2, Navigation, MapPin
} from 'lucide-react';
import axiosInstance from '../../api/axios';
import { exportToExcel, exportToPDF } from '../../utils/exportUtils';
import AddressText from '../../components/ui/AddressText';
import { getLocalDateString } from '../../utils/dateUtils';
import * as vehicleApi from '../../api/vehicleApi';

// Format seconds into HH:MM:SS
const formatHMS = (seconds) => {
  if (!seconds || seconds <= 0) return '00:00:00';
  const totalSecs = Math.round(seconds);
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

// Format timestamp into "HH:MM:SS DD-MM-YYYY"
const formatDateTime = (isoStr) => {
  if (!isoStr) return '-';
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return '-';
  const timeStr = d.toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata', hour12: false });
  const dateStr = d.toLocaleDateString('en-GB', { timeZone: 'Asia/Kolkata' }).replace(/\//g, '-');
  return `${timeStr} ${dateStr}`;
};

// Format Date & Time for Banner: e.g. "12:00 AM 25-10-2026"
const formatBannerDateTime = (dateStr, timeStr) => {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  const formattedDate = (y && m && d) ? `${d}-${m}-${y}` : dateStr;

  if (!timeStr) return formattedDate;
  const [hr, min] = timeStr.split(':');
  const h = parseInt(hr, 10);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const displayH = h === 0 ? 12 : (h > 12 ? h - 12 : h);
  return `${String(displayH).padStart(2, '0')}:${min || '00'} ${ampm} ${formattedDate}`;
};

const getYesterdayString = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return getLocalDateString(d);
};

const ConsolidatedReportPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [vehicles, setVehicles] = useState([]);

  // Default to yesterday (complete 24h cycle)
  const defaultYesterday = getYesterdayString();
  const [filters, setFilters] = useState(() => ({
    vehicleId: '',
    startDate: defaultYesterday,
    startTime: '00:00',
    endDate: defaultYesterday,
    endTime: '23:59'
  }));

  // Fetch vehicles for the dropdown
  useEffect(() => {
    vehicleApi.getVehicles({ t: Date.now() })
      .then(res => {
        if (res.success && res.data) {
          setVehicles(res.data);
        }
      })
      .catch(console.error);
  }, []);

  const handleFetchReport = async (overrideFilters = null) => {
    const activeFilters = overrideFilters || filters;
    if (!activeFilters.startDate || !activeFilters.endDate) return;

    setLoading(true);
    try {
      const [sY, sM, sD] = activeFilters.startDate.split('-');
      const [sH, sMin] = (activeFilters.startTime || '00:00').split(':');
      const start = new Date(parseInt(sY, 10), parseInt(sM, 10) - 1, parseInt(sD, 10), parseInt(sH, 10), parseInt(sMin, 10), 0);

      const [eY, eM, eD] = activeFilters.endDate.split('-');
      const [eH, eMin] = (activeFilters.endTime || '23:59').split(':');
      const end = new Date(parseInt(eY, 10), parseInt(eM, 10) - 1, parseInt(eD, 10), parseInt(eH, 10), parseInt(eMin, 10), 59, 999);

      const params = new URLSearchParams();
      params.append('startDate', start.toISOString());
      params.append('endDate', end.toISOString());
      if (activeFilters.vehicleId) {
        params.append('vehicleId', activeFilters.vehicleId);
      }

      const res = await axiosInstance.get(`/api/reports/consolidated?${params.toString()}`);
      if (res.data?.success) {
        setData(res.data.data || []);
      }
    } catch (err) {
      console.error('Error fetching consolidated report:', err);
      alert('Failed to generate consolidated report');
    } finally {
      setLoading(false);
    }
  };

  // Quick 1-click set to Yesterday and generate
  const handleSetYesterday = () => {
    const yStr = getYesterdayString();
    const updated = {
      ...filters,
      startDate: yStr,
      startTime: '00:00',
      endDate: yStr,
      endTime: '23:59'
    };
    setFilters(updated);
    handleFetchReport(updated);
  };

  // Build flattened export data for Excel & PDF
  const getExportData = () => {
    const rows = [];
    data.forEach(v => {
      const vName = v.vehicle_name || v.plate || 'Vehicle';
      if (v.intervals && v.intervals.length > 0) {
        v.intervals.forEach((interval, idx) => {
          rows.push({
            'Vehicle Name': vName,
            'Status': interval.status,
            'Start Time': formatDateTime(interval.start_time),
            'End Time': formatDateTime(interval.end_time),
            'Duration': formatHMS(interval.duration_seconds),
            'Length (km)': interval.status === 'Moving' ? (interval.distance || 0) : '-',
            'Speed Hike (km/h)': interval.status === 'Moving' ? (interval.max_speed || 0) : 0,
            'Speed Avg (km/h)': interval.status === 'Moving' ? (interval.avg_speed || 0) : 0,
            'Latitude': interval.lat || v.start_lat || '-',
            'Longitude': interval.lng || v.start_lng || '-'
          });
        });
      } else {
        rows.push({
          'Vehicle Name': vName,
          'Status': 'Parked',
          'Start Time': formatBannerDateTime(filters.startDate, filters.startTime),
          'End Time': formatBannerDateTime(filters.endDate, filters.endTime),
          'Duration': formatHMS(v.stopped_seconds || 86400),
          'Length (km)': '-',
          'Speed Hike (km/h)': 0,
          'Speed Avg (km/h)': 0,
          'Latitude': v.start_lat || '-',
          'Longitude': v.start_lng || '-'
        });
      }
    });
    return rows;
  };

  const bannerStart = formatBannerDateTime(filters.startDate, filters.startTime);
  const bannerEnd = formatBannerDateTime(filters.endDate, filters.endTime);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%', boxSizing: 'border-box', color: '#0F172A', padding: '16px' }}>

      {/* Top Filter Bar */}
      <div style={{
        background: '#FFFFFF',
        borderRadius: '10px',
        padding: '16px 20px',
        border: '1px solid #E2E8F0',
        marginBottom: '20px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '12px'
      }}>
        {/* Vehicle Selector */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '200px' }}>
          <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Select Vehicle</label>
          <select
            value={filters.vehicleId}
            onChange={e => setFilters(prev => ({ ...prev, vehicleId: e.target.value }))}
            style={{
              padding: '7px 10px',
              borderRadius: '6px',
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

        {/* Start Date & Time */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>From</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '140px' }}>
              <CustomDatePicker
                value={filters.startDate}
                onChange={e => setFilters(prev => ({ ...prev, startDate: e?.target ? e.target.value : e }))}
              />
            </div>
            <input
              type="time"
              value={filters.startTime}
              onChange={e => setFilters(prev => ({ ...prev, startTime: e.target.value }))}
              style={{
                padding: '7px 10px',
                borderRadius: '6px',
                border: '1px solid #CBD5E1',
                background: '#FAFAFA',
                fontSize: '13px',
                fontWeight: 600,
                color: '#0F172A',
                outline: 'none'
              }}
            />
          </div>
        </div>

        {/* End Date & Time */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>To</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '140px' }}>
              <CustomDatePicker
                value={filters.endDate}
                onChange={e => setFilters(prev => ({ ...prev, endDate: e?.target ? e.target.value : e }))}
              />
            </div>
            <input
              type="time"
              value={filters.endTime}
              onChange={e => setFilters(prev => ({ ...prev, endTime: e.target.value }))}
              style={{
                padding: '7px 10px',
                borderRadius: '6px',
                border: '1px solid #CBD5E1',
                background: '#FAFAFA',
                fontSize: '13px',
                fontWeight: 600,
                color: '#0F172A',
                outline: 'none'
              }}
            />
          </div>
        </div>

        {/* Quick "Yesterday" Button */}
        <div style={{ display: 'flex', alignItems: 'flex-end', paddingTop: '18px' }}>
          <button
            type="button"
            onClick={handleSetYesterday}
            style={{
              padding: '8px 14px',
              borderRadius: '6px',
              border: '1px solid #0284C7',
              background: '#F0F9FF',
              color: '#0284C7',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
            title="Set date range to Yesterday full 24h"
          >
            Yesterday
          </button>
        </div>

        {/* Submit / Generate Button */}
        <div style={{ display: 'flex', alignItems: 'flex-end', paddingTop: '18px' }}>
          <button
            type="button"
            onClick={() => handleFetchReport()}
            disabled={loading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 18px',
              borderRadius: '6px',
              border: 'none',
              background: '#0284C7',
              color: '#FFFFFF',
              fontSize: '13px',
              fontWeight: 700,
              cursor: loading ? 'wait' : 'pointer',
              boxShadow: '0 2px 6px rgba(2, 132, 199, 0.25)'
            }}
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
            Submit
          </button>
        </div>

        {/* Export Buttons */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', marginLeft: 'auto', paddingTop: '18px' }}>
          <button
            type="button"
            onClick={() => exportToExcel(getExportData(), 'Consolidated_Report')}
            disabled={data.length === 0}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 12px',
              borderRadius: '6px',
              border: 'none',
              background: data.length === 0 ? '#E2E8F0' : '#10B981',
              color: '#FFFFFF',
              fontSize: '12px',
              fontWeight: 700,
              cursor: data.length === 0 ? 'not-allowed' : 'pointer'
            }}
            title="Export to Excel"
          >
            <FileSpreadsheet size={14} />
            Excel
          </button>
          <button
            type="button"
            onClick={() => exportToPDF(['Vehicle Name', 'Status', 'Start Time', 'End Time', 'Duration', 'Length (km)', 'Speed Hike (km/h)', 'Speed Avg (km/h)'], getExportData(), 'Consolidated_Report')}
            disabled={data.length === 0}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 12px',
              borderRadius: '6px',
              border: 'none',
              background: data.length === 0 ? '#E2E8F0' : '#EF4444',
              color: '#FFFFFF',
              fontSize: '12px',
              fontWeight: 700,
              cursor: data.length === 0 ? 'not-allowed' : 'pointer'
            }}
            title="Export to PDF"
          >
            <FileText size={14} />
            PDF
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '60px 20px',
          background: '#FFFFFF',
          borderRadius: '10px',
          border: '1px solid #E2E8F0',
          gap: '12px'
        }}>
          <Loader2 size={32} color="#0284C7" className="animate-spin" />
          <span style={{ fontSize: '13px', color: '#64748B', fontWeight: 600 }}>Loading consolidated report...</span>
        </div>
      ) : data.length === 0 ? (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '60px 20px',
          background: '#FFFFFF',
          borderRadius: '10px',
          border: '2px dashed #E2E8F0',
          textAlign: 'center'
        }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            background: '#F1F5F9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '10px'
          }}>
            <Calendar size={22} color="#94A3B8" />
          </div>
          <h4 style={{ margin: '0 0 4px 0', fontSize: '15px', fontWeight: 700, color: '#1E293B' }}>
            No Data Generated Yet
          </h4>
          <p style={{ margin: 0, fontSize: '13px', color: '#64748B' }}>
            Select your vehicle and date range above, then click <strong>Submit</strong> or <strong>Yesterday</strong> to view the report.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {data.map((vehicleItem) => {
            const vName = vehicleItem.vehicle_name || vehicleItem.plate || 'Vehicle';
            const distanceKm = Math.round((vehicleItem.distance_travelled || 0) * 10) / 10;
            const movingHMS = formatHMS(vehicleItem.running_seconds);
            const parkedHMS = formatHMS(vehicleItem.stopped_seconds);
            const idleHMS = formatHMS(vehicleItem.idle_seconds);
            const speedHikeKm = Math.round(vehicleItem.max_speed || 0);
            const avgSpeedKm = Math.round(vehicleItem.avg_speed || 0);

            const intervals = vehicleItem.intervals || [];

            return (
              <div
                key={vehicleItem.vehicle_id}
                style={{
                  background: '#FFFFFF',
                  borderRadius: '10px',
                  border: '1.5px solid #CBD5E1',
                  overflow: 'hidden',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
                }}
              >
                {/* 1. Classic Blue Header Bar */}
                <div style={{
                  background: '#D9EEF8',
                  borderBottom: '1px solid #BAE6FD',
                  padding: '10px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '12px'
                }}>
                  <div style={{ fontSize: '13px', fontWeight: 800, color: '#0F172A' }}>
                    Vehicle Name : <span style={{ color: '#0369A1' }}>{vName}</span>
                  </div>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>
                    From : <span style={{ fontWeight: 700, color: '#0F172A' }}>{bannerStart}</span> - To : <span style={{ fontWeight: 700, color: '#0F172A' }}>{bannerEnd}</span>
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: 800, color: '#0F172A' }}>
                    Trip Distance : <span style={{ color: '#0284C7' }}>{distanceKm} Km</span>
                  </div>
                </div>

                {/* 2. Secondary Summary Row */}
                <div style={{
                  background: '#F8FAFC',
                  borderBottom: '1px solid #E2E8F0',
                  padding: '8px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-start',
                  flexWrap: 'wrap',
                  gap: '24px',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#475569'
                }}>
                  <div>
                    Moving : <strong style={{ color: '#16A34A' }}>{movingHMS}</strong>
                  </div>
                  <div style={{ color: '#CBD5E1' }}>|</div>
                  <div>
                    Parked : <strong style={{ color: '#475569' }}>{parkedHMS}</strong>
                  </div>
                  <div style={{ color: '#CBD5E1' }}>|</div>
                  <div>
                    Idle : <strong style={{ color: '#D97706' }}>{idleHMS}</strong>
                  </div>
                  <div style={{ color: '#CBD5E1' }}>|</div>
                  <div>
                    Speed Hike : <strong style={{ color: '#DC2626' }}>{speedHikeKm} Km</strong>
                  </div>
                  <div style={{ color: '#CBD5E1' }}>|</div>
                  <div>
                    Avg Speed : <strong style={{ color: '#2563EB' }}>{avgSpeedKm} Km</strong>
                  </div>
                </div>

                {/* 3. Detailed Interval Table */}
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
                    <thead>
                      <tr style={{ background: '#F1F5F9', borderBottom: '1px solid #E2E8F0' }}>
                        <th style={{ padding: '8px 12px', fontWeight: 700, color: '#475569', width: '100px' }}>Status</th>
                        <th style={{ padding: '8px 12px', fontWeight: 700, color: '#475569', width: '160px' }}>Start</th>
                        <th style={{ padding: '8px 12px', fontWeight: 700, color: '#475569', width: '160px' }}>End</th>
                        <th style={{ padding: '8px 12px', fontWeight: 700, color: '#475569', width: '120px' }}>Duration (HH:MM:SS)</th>
                        <th style={{ padding: '8px 12px', fontWeight: 700, color: '#475569', width: '90px' }}>Length</th>
                        <th style={{ padding: '8px 12px', fontWeight: 700, color: '#475569', width: '90px' }}>Speed Hike</th>
                        <th style={{ padding: '8px 12px', fontWeight: 700, color: '#475569', width: '90px' }}>Speed Avg</th>
                        <th style={{ padding: '8px 12px', fontWeight: 700, color: '#475569' }}>Location Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {intervals.length > 0 ? (
                        intervals.map((item, idx) => {
                          const isMoving = item.status === 'Moving';
                          const isIdle = item.status === 'Idle';
                          const isParked = item.status === 'Parked';

                          const statusBadgeBg = isMoving ? '#DEF7EC' : (isIdle ? '#FEF08A' : '#F1F5F9');
                          const statusBadgeColor = isMoving ? '#03543F' : (isIdle ? '#713F12' : '#334155');

                          return (
                            <tr
                              key={idx}
                              style={{
                                borderBottom: '1px solid #F1F5F9',
                                background: idx % 2 === 0 ? '#FFFFFF' : '#FAFAFA'
                              }}
                            >
                              <td style={{ padding: '8px 12px' }}>
                                <span style={{
                                  display: 'inline-block',
                                  padding: '2px 8px',
                                  borderRadius: '4px',
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  background: statusBadgeBg,
                                  color: statusBadgeColor
                                }}>
                                  {item.status}
                                </span>
                              </td>
                              <td style={{ padding: '8px 12px', color: '#1E293B', fontWeight: 500 }}>
                                {formatDateTime(item.start_time)}
                              </td>
                              <td style={{ padding: '8px 12px', color: '#1E293B', fontWeight: 500 }}>
                                {formatDateTime(item.end_time)}
                              </td>
                              <td style={{ padding: '8px 12px', color: '#0F172A', fontWeight: 700 }}>
                                {formatHMS(item.duration_seconds)}
                              </td>
                              <td style={{ padding: '8px 12px', color: isMoving ? '#15803D' : '#64748B', fontWeight: isMoving ? 700 : 500 }}>
                                {isMoving ? `${item.distance} km` : '-'}
                              </td>
                              <td style={{ padding: '8px 12px', color: isMoving ? '#DC2626' : '#64748B', fontWeight: isMoving ? 700 : 500 }}>
                                {isMoving ? `${item.max_speed} Km` : '0 Km'}
                              </td>
                              <td style={{ padding: '8px 12px', color: isMoving ? '#2563EB' : '#64748B', fontWeight: isMoving ? 700 : 500 }}>
                                {isMoving ? `${item.avg_speed} Km` : '0 Km'}
                              </td>
                              <td style={{ padding: '8px 12px', color: '#475569' }}>
                                {item.lat && item.lng ? (
                                  <AddressText lat={item.lat} lng={item.lng} />
                                ) : (
                                  <span>-</span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        /* When no intervals detected (e.g. parked all day or zero motion) */
                        <tr style={{ background: '#FFFFFF' }}>
                          <td style={{ padding: '8px 12px' }}>
                            <span style={{
                              display: 'inline-block',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: 700,
                              background: '#F1F5F9',
                              color: '#334155'
                            }}>
                              Parked
                            </span>
                          </td>
                          <td style={{ padding: '8px 12px', color: '#1E293B', fontWeight: 500 }}>
                            {bannerStart}
                          </td>
                          <td style={{ padding: '8px 12px', color: '#1E293B', fontWeight: 500 }}>
                            {bannerEnd}
                          </td>
                          <td style={{ padding: '8px 12px', color: '#0F172A', fontWeight: 700 }}>
                            {formatHMS(vehicleItem.stopped_seconds || 86400)}
                          </td>
                          <td style={{ padding: '8px 12px', color: '#64748B' }}>-</td>
                          <td style={{ padding: '8px 12px', color: '#64748B' }}>0 Km</td>
                          <td style={{ padding: '8px 12px', color: '#64748B' }}>0 Km</td>
                          <td style={{ padding: '8px 12px', color: '#475569' }}>
                            {vehicleItem.start_lat && vehicleItem.start_lng ? (
                              <AddressText lat={vehicleItem.start_lat} lng={vehicleItem.start_lng} />
                            ) : (
                              <span>No location records during this period</span>
                            )}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ConsolidatedReportPage;
