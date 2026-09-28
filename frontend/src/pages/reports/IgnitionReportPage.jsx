import React, { useState, useEffect } from 'react';
import CustomDatePicker from '../../components/ui/CustomDatePicker';
import { formatLocalTime } from '../../utils/dateUtils';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, Loader2, Zap, Download, FileText } from 'lucide-react';
import axiosInstance from '../../api/axios';
import * as vehicleApi from '../../api/vehicleApi';
import { exportToExcel, exportToPDF, exportToCSV } from '../../utils/exportUtils';

const formatDuration = (ms) => {
  if (!ms || ms < 0) return '00:00:00';
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

const IgnitionReportPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [filters, setFilters] = useState({
    vehicleId: '',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });
  
  useEffect(() => {
    vehicleApi.getVehicles({ t: Date.now() })
      .then(res => { 
        if (res.success) {
          setVehicles(res.data); 
          if (res.data.length > 0 && !filters.vehicleId) {
            setFilters(prev => ({...prev, vehicleId: res.data[0].id}));
          }
        }
      })
      .catch(console.error);
  }, []);

  const handleGenerate = async () => {
    if (!filters.startDate || !filters.endDate || !filters.vehicleId) {
      alert("Please select a vehicle and date range.");
      return;
    }
    setLoading(true);
    try {
      const start = new Date(filters.startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(filters.endDate);
      end.setHours(23, 59, 59, 999);

      const params = new URLSearchParams();
      params.append('startDate', start.toISOString());
      params.append('endDate', end.toISOString());

      const res = await axiosInstance.get(`/api/vehicles/${filters.vehicleId}/ignition-report?${params.toString()}`);
      if (res.data.success) {
        setReportData(res.data.data);
      }
    } catch (err) {
      console.error(err);
      alert('Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  const selectedVehicleObj = vehicles.find(v => v.id === filters.vehicleId);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%', boxSizing: 'border-box', color: '#0F172A' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '16px' }}>
        <button onClick={() => navigate('/admin/reports')} style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#FFFFFF', border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#475569' }}>
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#111827', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Zap size={24} color="#0284C7" /> Ignition Report
          </h1>
        </div>
      </div>

      {/* Filters Panel */}
      <div style={{ background: '#FFFFFF', padding: '16px', borderRadius: '12px', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px rgba(0,0,0,0.02)', marginBottom: '16px', display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ flex: 1, minWidth: '200px' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>Select Vehicle</label>
          <select value={filters.vehicleId} onChange={e => setFilters({ ...filters, vehicleId: e.target.value })} style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #CBD5E1', outline: 'none', background: '#EEF5F8', color: '#000000' }}>
            <option value="">Select...</option>
            {vehicles.map(v => <option key={v.id} value={v.id}>{v.name} ({v.plate})</option>)}
          </select>
        </div>
        <div style={{ width: '180px' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>Start Date</label>
          <CustomDatePicker value={filters.startDate} onChange={e => setFilters({ ...filters, startDate: e.target.value })} style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #CBD5E1', outline: 'none', boxSizing: 'border-box', color: '#000000' }} />
        </div>
        <div style={{ width: '180px' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>End Date</label>
          <CustomDatePicker value={filters.endDate} onChange={e => setFilters({ ...filters, endDate: e.target.value })} style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #CBD5E1', outline: 'none', boxSizing: 'border-box', color: '#000000' }} />
        </div>
        <button onClick={handleGenerate} disabled={loading} style={{ padding: '12px 24px', borderRadius: '10px', background: '#0284C7', color: '#FFF', border: 'none', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
          {loading ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
          Generate Report
        </button>
      </div>

      {reportData && reportData.intervals.length === 0 && (
        <div style={{ background: '#FFF', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '60px 20px', textAlign: 'center', color: '#94A3B8' }}>
          <Zap size={40} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
          <div style={{ fontSize: '16px', fontWeight: 600, marginBottom: '6px', color: '#64748B' }}>No ignition events found</div>
          <div style={{ fontSize: '13px' }}>There is no GPS data for <strong>{selectedVehicleObj?.name}</strong> in the selected date range.</div>
        </div>
      )}

      {reportData && reportData.intervals.length > 0 && (
        <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
          {/* Left Table Section */}
          <div style={{ flex: 1, minWidth: '600px', background: '#FFF', borderRadius: '8px', border: '1px solid #E2E8F0', padding: '16px', overflowX: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0 }}>Ignition Report</h2>
              <div style={{ fontSize: '13px', color: '#64748B', fontWeight: 600 }}>
                From: {filters.startDate} - To: {filters.endDate}
              </div>
            </div>

            {/* Sub-header info table */}
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px', border: '1px solid #E2E8F0', fontSize: '13px' }}>
              <tbody>
                <tr>
                  <td style={{ background: '#F8FAFC', padding: '10px', border: '1px solid #E2E8F0', fontWeight: 'bold', width: '20%' }}>Vehicle Group</td>
                  <td style={{ padding: '10px', border: '1px solid #E2E8F0', width: '30%' }}>-</td>
                  <td style={{ background: '#F8FAFC', padding: '10px', border: '1px solid #E2E8F0', fontWeight: 'bold', width: '20%' }}>Vehicle Name</td>
                  <td style={{ padding: '10px', border: '1px solid #E2E8F0', width: '30%', fontWeight: 'bold' }}>{selectedVehicleObj?.name}</td>
                </tr>
                <tr>
                  <td style={{ background: '#F8FAFC', padding: '10px', border: '1px solid #E2E8F0', fontWeight: 'bold' }}>Reg No</td>
                  <td style={{ padding: '10px', border: '1px solid #E2E8F0' }}>{selectedVehicleObj?.plate || '-'}</td>
                  <td style={{ background: '#F8FAFC', padding: '10px', border: '1px solid #E2E8F0', fontWeight: 'bold' }}>Total Duration</td>
                  <td style={{ padding: '10px', border: '1px solid #E2E8F0' }}>{formatDuration(reportData.summary.totalRunningMs + reportData.summary.totalParkedMs)}</td>
                </tr>
              </tbody>
            </table>

            {/* Main Data Table */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#E2E8F0', color: '#334155' }}>
                    <th style={{ padding: '10px', border: '1px solid #CBD5E1' }}>Date & Time</th>
                    <th style={{ padding: '10px', border: '1px solid #CBD5E1' }}>Status</th>
                    <th style={{ padding: '10px', border: '1px solid #CBD5E1' }}>Duration (HH:MM:SS)</th>
                    <th style={{ padding: '10px', border: '1px solid #CBD5E1' }}>Nearest Location</th>
                    <th style={{ padding: '10px', border: '1px solid #CBD5E1' }}>G-Map</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.intervals.map((inv, idx) => (
                    <tr key={idx}>
                      <td style={{ padding: '10px', border: '1px solid #E2E8F0' }}>{formatLocalTime(inv.startTime)}</td>
                      <td style={{ padding: '10px', border: '1px solid #E2E8F0', fontWeight: 'bold', color: inv.status === 'ON' ? '#10B981' : '#64748B' }}>{inv.status}</td>
                      <td style={{ padding: '10px', border: '1px solid #E2E8F0' }}>{formatDuration(inv.durationMs)}</td>
                      <td style={{ padding: '10px', border: '1px solid #E2E8F0', textAlign: 'left' }}>
                        {inv.startLat && inv.startLng ? `${inv.startLat.toFixed(5)}, ${inv.startLng.toFixed(5)}` : '-'}
                      </td>
                      <td style={{ padding: '10px', border: '1px solid #E2E8F0' }}>
                        {inv.startLat && inv.startLng ? (
                          <a href={`https://www.google.com/maps?q=${inv.startLat},${inv.startLng}`} target="_blank" rel="noreferrer" style={{ color: '#0284C7', textDecoration: 'underline' }}>Link</a>
                        ) : '-'}
                      </td>
                    </tr>
                  ))}
                  {reportData.intervals.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ padding: '20px', color: '#94A3B8' }}>No ignition events found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right Summary Cards — minimal style */}
          <div style={{ width: '220px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>

            {/* Top Speed */}
            <div style={{ background: '#FFF', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '16px 20px', borderLeft: '4px solid #10B981' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>Top Speed</div>
              <div style={{ fontSize: '26px', fontWeight: 800, color: '#10B981', lineHeight: 1 }}>
                {reportData.summary.topSpeed} <span style={{ fontSize: '13px', fontWeight: 600, color: '#94A3B8' }}>km/h</span>
              </div>
              {reportData.summary.topSpeedTime && (
                <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '4px' }}>{formatLocalTime(reportData.summary.topSpeedTime)}</div>
              )}
            </div>

            {/* Total Distance */}
            <div style={{ background: '#FFF', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '16px 20px', borderLeft: '4px solid #0284C7' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>Total Distance</div>
              <div style={{ fontSize: '26px', fontWeight: 800, color: '#0284C7', lineHeight: 1 }}>
                {reportData.summary.totalDistance} <span style={{ fontSize: '13px', fontWeight: 600, color: '#94A3B8' }}>km</span>
              </div>
            </div>

            {/* Running Time */}
            <div style={{ background: '#FFF', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '16px 20px', borderLeft: '4px solid #F59E0B' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>Running Time</div>
              <div style={{ fontSize: '22px', fontWeight: 800, color: '#F59E0B', lineHeight: 1, fontFamily: 'monospace' }}>
                {formatDuration(reportData.summary.totalRunningMs)}
              </div>
            </div>

            {/* Parked Time */}
            <div style={{ background: '#FFF', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '16px 20px', borderLeft: '4px solid #64748B' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>Parked Time</div>
              <div style={{ fontSize: '22px', fontWeight: 800, color: '#64748B', lineHeight: 1, fontFamily: 'monospace' }}>
                {formatDuration(reportData.summary.totalParkedMs)}
              </div>
            </div>

          </div>

        </div>
      )}
    </div>
  );
};

export default IgnitionReportPage;
