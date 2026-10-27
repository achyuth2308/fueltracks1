import React, { useState, useEffect } from 'react';
import TelematicsDatePicker from '../../components/ui/TelematicsDatePicker';
import TelematicsTimePicker, { to12Hour } from '../../components/ui/TelematicsTimePicker';
import {
  FileSpreadsheet, FileText, Search, Loader2, Calendar, Info
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
  if (isNaN(d.getTime())) return String(isoStr);
  const timeStr = d.toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata', hour12: false });
  const parts = d.toLocaleDateString('en-GB', { timeZone: 'Asia/Kolkata' }).split('/');
  const dateStr = parts.length === 3 ? `${parts[0]}-${parts[1]}-${parts[2]}` : d.toLocaleDateString('en-GB');
  return `${timeStr} ${dateStr}`;
};

// Format Date & Time for Banner: e.g. "12:00 AM 25-10-2026"
const formatBannerDateTime = (dateStr, timeStr) => {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  const formattedDate = (y && m && d) ? `${d}-${m}-${y}` : dateStr;
  const time12 = to12Hour(timeStr);
  return `${time12} ${formattedDate}`;
};

const getYesterdayString = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return getLocalDateString(d);
};

// Merges brief traffic halts (<= 120s / 2 min, whether Idle or momentary Parked) into surrounding 'Moving' intervals
const mergeTrafficIdles = (intervals, maxHaltSec = 120) => {
  if (!intervals || intervals.length <= 1) return intervals;

  const result = [];
  let i = 0;

  while (i < intervals.length) {
    let cur = { ...intervals[i] };

    if (cur.status === 'Moving') {
      let j = i + 1;
      let accumDuration = cur.duration_seconds;
      let accumDistance = cur.distance || 0;
      let maxSpeed = cur.max_speed || 0;
      let speedTimeProduct = (cur.avg_speed || 0) * (cur.duration_seconds || 1);
      let totalTimeForAvg = cur.duration_seconds || 1;
      let lastEndTime = cur.end_time;
      let lastLat = cur.lat;
      let lastLng = cur.lng;

      while (j < intervals.length) {
        let nextMovingIndex = -1;
        let cumulativePauseSec = 0;

        for (let k = j; k < intervals.length; k++) {
          if (intervals[k].status === 'Moving') {
            nextMovingIndex = k;
            break;
          }
          cumulativePauseSec += (intervals[k].duration_seconds || 0);
          if (cumulativePauseSec > maxHaltSec) {
            break;
          }
        }

        if (nextMovingIndex !== -1 && cumulativePauseSec <= maxHaltSec) {
          for (let m = j; m < nextMovingIndex; m++) {
            accumDuration += (intervals[m].duration_seconds || 0);
            lastEndTime = intervals[m].end_time;
            lastLat = intervals[m].lat || lastLat;
            lastLng = intervals[m].lng || lastLng;
          }

          const nextMoving = intervals[nextMovingIndex];
          accumDuration += (nextMoving.duration_seconds || 0);
          accumDistance += (nextMoving.distance || 0);
          maxSpeed = Math.max(maxSpeed, nextMoving.max_speed || 0);
          speedTimeProduct += (nextMoving.avg_speed || 0) * (nextMoving.duration_seconds || 1);
          totalTimeForAvg += (nextMoving.duration_seconds || 1);
          lastEndTime = nextMoving.end_time;
          lastLat = nextMoving.lat || lastLat;
          lastLng = nextMoving.lng || lastLng;

          j = nextMovingIndex + 1;
        } else {
          break;
        }
      }

      cur.duration_seconds = accumDuration;
      cur.end_time = lastEndTime;
      cur.distance = Math.round(accumDistance * 100) / 100;
      cur.max_speed = Math.round(maxSpeed);
      cur.avg_speed = totalTimeForAvg > 0 ? Math.round(speedTimeProduct / totalTimeForAvg) : cur.avg_speed;
      cur.lat = lastLat;
      cur.lng = lastLng;

      result.push(cur);
      i = j;
    } else {
      result.push(cur);
      i++;
    }
  }

  return result;
};

const ConsolidatedReportPage = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [vehicles, setVehicles] = useState([]);

  // Default to yesterday full 24h
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
      const intervals = mergeTrafficIdles(v.intervals || [], 120);
      if (intervals && intervals.length > 0) {
        intervals.forEach((interval) => {
          rows.push({
            'Vehicle Name': vName,
            'Status': interval.status,
            'Start Time': formatDateTime(interval.start_time),
            'End Time': formatDateTime(interval.end_time),
            'Duration': formatHMS(interval.duration_seconds),
            'Length (km)': interval.status === 'Moving' ? Math.round(interval.distance || 0) : '-',
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

  const cellBorder = '1px solid #d9d9d9';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%', boxSizing: 'border-box', color: '#0F172A', padding: '16px' }}>

      {/* Top Filter Bar Matching Telematics Header Exactly */}
      <div style={{
        background: '#FFFFFF',
        borderRadius: '6px',
        padding: '12px 16px',
        border: '1px solid #CBD5E1',
        marginBottom: '16px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}>
        {/* Title row with Yesterday button */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#1E293B' }}>
              Consolidated Report
            </h3>
            <Info size={16} color="#0284C7" style={{ cursor: 'pointer' }} />
          </div>

          <button
            type="button"
            onClick={handleSetYesterday}
            style={{
              padding: '6px 14px',
              borderRadius: '4px',
              border: 'none',
              background: '#0284C7',
              color: '#FFFFFF',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 1px 3px rgba(2, 132, 199, 0.25)'
            }}
            title="Set date range to Yesterday full 24h"
          >
            Yesterday
          </button>
        </div>

        {/* Filters Row: Vehicle | From Date | From Time | To Date | To Time | Submit | Export */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '10px'
        }}>
          {/* Vehicle Dropdown */}
          <select
            value={filters.vehicleId}
            onChange={e => setFilters(prev => ({ ...prev, vehicleId: e.target.value }))}
            style={{
              padding: '6px 10px',
              borderRadius: '4px',
              border: '1px solid #CBD5E1',
              background: '#FFFFFF',
              color: '#0F172A',
              fontSize: '13px',
              fontWeight: 500,
              outline: 'none',
              minWidth: '160px'
            }}
          >
            <option value="">All Vehicles</option>
            {vehicles.map(v => (
              <option key={v.id} value={v.id}>
                {v.name} {v.plate ? `(${v.plate})` : ''}
              </option>
            ))}
          </select>

          {/* From Date: DD-MM-YYYY */}
          <TelematicsDatePicker
            value={filters.startDate}
            onChange={(isoDate) => setFilters(prev => ({ ...prev, startDate: isoDate }))}
          />

          {/* From Time: 12:00 AM */}
          <TelematicsTimePicker
            value={filters.startTime}
            onChange={(time24) => setFilters(prev => ({ ...prev, startTime: time24 }))}
          />

          {/* To Date: DD-MM-YYYY */}
          <TelematicsDatePicker
            value={filters.endDate}
            onChange={(isoDate) => setFilters(prev => ({ ...prev, endDate: isoDate }))}
          />

          {/* To Time: 11:59 PM */}
          <TelematicsTimePicker
            value={filters.endTime}
            onChange={(time24) => setFilters(prev => ({ ...prev, endTime: time24 }))}
          />

          {/* Submit Button */}
          <button
            type="button"
            onClick={() => handleFetchReport()}
            disabled={loading}
            style={{
              padding: '6px 14px',
              borderRadius: '4px',
              border: '1px solid #CBD5E1',
              background: '#FFFFFF',
              color: '#0F172A',
              fontSize: '13px',
              fontWeight: 600,
              cursor: loading ? 'wait' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            {loading ? <Loader2 size={13} className="animate-spin" /> : null}
            Submit
          </button>

          {/* Export Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' }}>
            <button
              type="button"
              onClick={() => exportToExcel(getExportData(), 'Consolidated_Report')}
              disabled={data.length === 0}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '6px 12px',
                borderRadius: '4px',
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
                gap: '5px',
                padding: '6px 12px',
                borderRadius: '4px',
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
          borderRadius: '6px',
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
          borderRadius: '6px',
          border: '2px dashed #E2E8F0',
          textAlign: 'center'
        }}>
          <div style={{
            width: '44px',
            height: '44px',
            borderRadius: '50%',
            background: '#F1F5F9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '10px'
          }}>
            <Calendar size={20} color="#94A3B8" />
          </div>
          <h4 style={{ margin: '0 0 4px 0', fontSize: '14px', fontWeight: 700, color: '#1E293B' }}>
            No Data Generated Yet
          </h4>
          <p style={{ margin: 0, fontSize: '12px', color: '#64748B' }}>
            Select your vehicle and date range above, then click <strong>Submit</strong> or <strong>Yesterday</strong> to view the report.
          </p>
        </div>
      ) : (
        /* Unified Continuous Telematics Table Matching Classic Layout Exactly */
        <div style={{ width: '100%', overflowX: 'auto', background: '#FFFFFF', border: cellBorder }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', fontSize: '13px', color: '#333333' }}>
            <tbody>
              {data.map((vehicleItem) => {
                const vName = vehicleItem.vehicle_name || vehicleItem.plate || 'Vehicle';
                const distanceKm = Math.round(vehicleItem.distance_travelled || 0);
                const intervals = mergeTrafficIdles(vehicleItem.intervals || [], 120);

                let movingSec = 0;
                let idleSec = 0;
                let parkedSec = 0;
                intervals.forEach(inv => {
                  if (inv.status === 'Moving') movingSec += (inv.duration_seconds || 0);
                  else if (inv.status === 'Idle') idleSec += (inv.duration_seconds || 0);
                  else parkedSec += (inv.duration_seconds || 0);
                });

                const movingHMS = formatHMS(movingSec || vehicleItem.running_seconds);
                const parkedHMS = formatHMS(parkedSec || vehicleItem.stopped_seconds);
                const idleHMS = formatHMS(idleSec || vehicleItem.idle_seconds);
                const speedHikeKm = Math.round(vehicleItem.max_speed || 0);
                const avgSpeedKm = Math.round(vehicleItem.avg_speed || 0);

                return (
                  <React.Fragment key={vehicleItem.vehicle_id}>
                    {/* 1. Classic Light Sky Blue Banner */}
                    <tr style={{ backgroundColor: '#cce5ff' }}>
                      <td colSpan={7} style={{ border: cellBorder, padding: '7px 16px', fontWeight: 'bold', fontSize: '13px', color: '#000000' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                          <span>Vehicle Name : {vName}</span>
                          <span>From : {bannerStart} - To : {bannerEnd}</span>
                          <span>Trip Distance : {distanceKm}</span>
                        </div>
                      </td>
                    </tr>

                    {/* 2. Secondary Summary Strip Row */}
                    <tr style={{ backgroundColor: '#ffffff' }}>
                      <td colSpan={7} style={{ border: cellBorder, padding: '7px 16px', fontWeight: 'bold', fontSize: '13px', color: '#000000', textAlign: 'center' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', width: '100%' }}>
                          <span>Moving : {movingHMS}</span>
                          <span>Parked : {parkedHMS}</span>
                          <span>Idle : {idleHMS}</span>
                          <span>Speed Hike : {speedHikeKm} Km</span>
                          <span>Avg Speed : {avgSpeedKm} Km</span>
                        </div>
                      </td>
                    </tr>

                    {/* 3. Two-Row Table Header */}
                    <tr style={{ backgroundColor: '#ffffff' }}>
                      <th rowSpan={2} style={{ border: cellBorder, padding: '6px 8px', textAlign: 'center', verticalAlign: 'middle', fontWeight: 'bold', fontSize: '13px', color: '#000000', width: '110px' }}>
                        Status
                      </th>
                      <th rowSpan={2} style={{ border: cellBorder, padding: '6px 8px', textAlign: 'center', verticalAlign: 'middle', fontWeight: 'bold', fontSize: '13px', color: '#000000', width: '180px' }}>
                        Start
                      </th>
                      <th rowSpan={2} style={{ border: cellBorder, padding: '6px 8px', textAlign: 'center', verticalAlign: 'middle', fontWeight: 'bold', fontSize: '13px', color: '#000000', width: '180px' }}>
                        End
                      </th>
                      <th rowSpan={2} style={{ border: cellBorder, padding: '6px 8px', textAlign: 'center', verticalAlign: 'middle', fontWeight: 'bold', fontSize: '13px', color: '#000000', width: '160px' }}>
                        Duration (HH:MM:SS)
                      </th>
                      <th colSpan={3} style={{ border: cellBorder, padding: '6px 8px', textAlign: 'center', fontWeight: 'bold', fontSize: '13px', color: '#000000' }}>
                        Location Details
                      </th>
                    </tr>
                    <tr style={{ backgroundColor: '#ffffff' }}>
                      <th style={{ border: cellBorder, padding: '6px 8px', textAlign: 'center', fontWeight: 'bold', fontSize: '13px', color: '#000000', width: '110px' }}>
                        Length
                      </th>
                      <th style={{ border: cellBorder, padding: '6px 8px', textAlign: 'center', fontWeight: 'bold', fontSize: '13px', color: '#000000', width: '120px' }}>
                        Speed Hike
                      </th>
                      <th style={{ border: cellBorder, padding: '6px 8px', textAlign: 'center', fontWeight: 'bold', fontSize: '13px', color: '#000000', width: '110px' }}>
                        Speed Avg
                      </th>
                    </tr>

                    {/* 4. Interval Data Rows */}
                    {intervals.length > 0 ? (
                      intervals.map((item, idx) => {
                        const isMoving = item.status === 'Moving';

                        if (isMoving) {
                          return (
                            <tr key={idx} style={{ backgroundColor: '#ffffff' }}>
                              <td style={{ border: cellBorder, padding: '6px 8px', textAlign: 'center', fontSize: '13px', color: '#000000' }}>
                                Moving
                              </td>
                              <td style={{ border: cellBorder, padding: '6px 8px', textAlign: 'center', fontSize: '13px', color: '#000000' }}>
                                {formatDateTime(item.start_time)}
                              </td>
                              <td style={{ border: cellBorder, padding: '6px 8px', textAlign: 'center', fontSize: '13px', color: '#000000' }}>
                                {formatDateTime(item.end_time)}
                              </td>
                              <td style={{ border: cellBorder, padding: '6px 8px', textAlign: 'center', fontSize: '13px', color: '#000000' }}>
                                {formatHMS(item.duration_seconds)}
                              </td>
                              <td style={{ border: cellBorder, padding: '6px 8px', textAlign: 'center', fontSize: '13px', color: '#000000' }}>
                                {item.distance !== undefined ? `${Math.round(item.distance)} Km` : '0 Km'}
                              </td>
                              <td style={{ border: cellBorder, padding: '6px 8px', textAlign: 'center', fontSize: '13px', color: '#000000' }}>
                                {item.max_speed ? `${item.max_speed} Km` : ' Km'}
                              </td>
                              <td style={{ border: cellBorder, padding: '6px 8px', textAlign: 'center', fontSize: '13px', color: '#000000' }}>
                                {item.avg_speed !== undefined ? `${item.avg_speed} Km` : '0 Km'}
                              </td>
                            </tr>
                          );
                        }

                        // Idle or Parked - Location Details spans all 3 columns
                        return (
                          <tr key={idx} style={{ backgroundColor: '#ffffff' }}>
                            <td style={{ border: cellBorder, padding: '6px 8px', textAlign: 'center', fontSize: '13px', color: '#000000' }}>
                              {item.status}
                            </td>
                            <td style={{ border: cellBorder, padding: '6px 8px', textAlign: 'center', fontSize: '13px', color: '#000000' }}>
                              {formatDateTime(item.start_time)}
                            </td>
                            <td style={{ border: cellBorder, padding: '6px 8px', textAlign: 'center', fontSize: '13px', color: '#000000' }}>
                              {formatDateTime(item.end_time)}
                            </td>
                            <td style={{ border: cellBorder, padding: '6px 8px', textAlign: 'center', fontSize: '13px', color: '#000000' }}>
                              {formatHMS(item.duration_seconds)}
                            </td>
                            <td colSpan={3} style={{ border: cellBorder, padding: '6px 8px', textAlign: 'center', fontSize: '13px', color: '#000000' }}>
                              {item.lat && item.lng ? (
                                <AddressText lat={item.lat} lng={item.lng} />
                              ) : (
                                '-'
                              )}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      /* Fallback Parked row */
                      <tr style={{ backgroundColor: '#ffffff' }}>
                        <td style={{ border: cellBorder, padding: '6px 8px', textAlign: 'center', fontSize: '13px', color: '#000000' }}>
                          Parked
                        </td>
                        <td style={{ border: cellBorder, padding: '6px 8px', textAlign: 'center', fontSize: '13px', color: '#000000' }}>
                          {bannerStart}
                        </td>
                        <td style={{ border: cellBorder, padding: '6px 8px', textAlign: 'center', fontSize: '13px', color: '#000000' }}>
                          {bannerEnd}
                        </td>
                        <td style={{ border: cellBorder, padding: '6px 8px', textAlign: 'center', fontSize: '13px', color: '#000000' }}>
                          {formatHMS(vehicleItem.stopped_seconds || 86400)}
                        </td>
                        <td colSpan={3} style={{ border: cellBorder, padding: '6px 8px', textAlign: 'center', fontSize: '13px', color: '#000000' }}>
                          {vehicleItem.start_lat && vehicleItem.start_lng ? (
                            <AddressText lat={vehicleItem.start_lat} lng={vehicleItem.start_lng} />
                          ) : (
                            '-'
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default ConsolidatedReportPage;
