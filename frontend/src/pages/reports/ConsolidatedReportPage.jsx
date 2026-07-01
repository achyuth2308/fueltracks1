import React, { useState } from 'react';
import CustomDatePicker from '../../components/ui/CustomDatePicker';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, Search, Loader2, Users, Filter, FileText } from 'lucide-react';
import axiosInstance from '../../api/axios';
import { exportToExcel, exportToPDF, exportToCSV } from '../../utils/exportUtils';

const ConsolidatedReportPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  
  // Filters
  const [filters, setFilters] = useState({
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });

  const handleGenerate = async () => {
    if(!filters.startDate || !filters.endDate) return;
    setLoading(true);
    try {
      const start = new Date(filters.startDate);
      start.setHours(0,0,0,0);
      const end = new Date(filters.endDate);
      end.setHours(23,59,59,999);

      const params = new URLSearchParams();
      params.append('startDate', start.toISOString());
      params.append('endDate', end.toISOString());

      const res = await axiosInstance.get(`/api/reports/consolidated?${params.toString()}`);
      if(res.data.success) {
        setData(res.data.data);
      }
    } catch (err) {
      console.error(err);
      alert('Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  const columns = ['Vehicle Name', 'Plate', 'Total Distance', 'Running Time (mins)', 'Idle Time (mins)', 'Stopped Time (mins)'];

  const getExportData = () => {
    return data.map(row => ({
      'Vehicle Name': row.vehicle_name || '-',
      'Plate': row.plate || '-',
      'Total Distance': row.distance_travelled || 0,
      'Running Time (mins)': row.running_seconds ? Math.floor(row.running_seconds / 60) : 0,
      'Idle Time (mins)': row.idle_seconds ? Math.floor(row.idle_seconds / 60) : 0,
      'Stopped Time (mins)': row.stopped_seconds ? Math.floor(row.stopped_seconds / 60) : 0
    }));
  };

  return (
    <div style={{ padding: '32px', background: 'linear-gradient(to bottom, #f5efe4 0%, #f5efe4 50%, #f5efe4 50%, #f5efe4 100%)', minHeight: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', color: '#000000' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '32px' }}>
        <button onClick={() => navigate('/admin/reports')} style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#FFFFFF', border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#475569' }}>
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#111827', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Users size={24} color="#0EA5E9" /> Consolidated Fleet Report
          </h1>
          <p style={{ fontSize: '14px', color: '#64748B', margin: '4px 0 0 0' }}>Daily overview of performance across the entire fleet.</p>
        </div>
      </div>

      {/* Filters Panel */}
      <div style={{ background: '#FFFFFF', padding: '24px', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px rgba(0,0,0,0.02)', marginBottom: '24px', display: 'flex', gap: '24px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ width: '150px' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>Start Date</label>
          <CustomDatePicker value={filters.startDate} onChange={e => setFilters({...filters, startDate: e.target.value})} style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #CBD5E1', outline: 'none', boxSizing: 'border-box', color: '#000000' }} />
        </div>
        <div style={{ width: '150px' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>End Date</label>
          <CustomDatePicker value={filters.endDate} onChange={e => setFilters({...filters, endDate: e.target.value})} style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #CBD5E1', outline: 'none', boxSizing: 'border-box', color: '#000000' }} />
        </div>
        <button onClick={handleGenerate} disabled={loading} style={{ padding: '12px 24px', borderRadius: '10px', background: '#8ba0b5', color: '#FFF', border: 'none', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(139,160,181,0.2)' }}>
          {loading ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
          Generate Report
        </button>
      </div>

      {/* Results */}
      <div style={{ background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '16px 24px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#FAFAFA' }}>
          <div style={{ fontSize: '15px', fontWeight: 700, color: '#111827' }}>Report Results <span style={{ color: '#64748B', fontWeight: 500, fontSize: '13px', marginLeft: '8px' }}>({data.length} records)</span></div>
          
          <div style={{ display: 'flex', gap: '12px' }}>
            <button onClick={() => exportToPDF(columns, getExportData(), 'Consolidated Report', 'consolidated_report')} disabled={data.length === 0} style={{ padding: '8px 16px', borderRadius: '8px', background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#475569', fontSize: '13px', fontWeight: 600, cursor: data.length ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: '6px', opacity: data.length ? 1 : 0.5 }}>
              <FileText size={16} color="#DC2626" /> PDF
            </button>
            <button onClick={() => exportToExcel(getExportData(), 'consolidated_report')} disabled={data.length === 0} style={{ padding: '8px 16px', borderRadius: '8px', background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#475569', fontSize: '13px', fontWeight: 600, cursor: data.length ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: '6px', opacity: data.length ? 1 : 0.5 }}>
              <Download size={16} color="#10B981" /> Excel
            </button>
          </div>
        </div>

        <div style={{ overflowX: 'auto', flex: 1 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '1000px' }}>
            <thead>
              <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                {columns.map(c => <th key={c} style={{ padding: '14px 24px', fontSize: '12px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{c}</th>)}
              </tr>
            </thead>
            <tbody>
              {data.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} style={{ padding: '60px', textAlign: 'center', color: '#94A3B8', fontSize: '14px' }}>
                    <Filter size={32} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
                    No data found for the selected criteria.
                  </td>
                </tr>
              ) : data.map((row, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid #F1F5F9' }}>
                  <td style={{ padding: '14px 24px', fontSize: '13px', fontWeight: 600, color: '#111827' }}>{row.vehicle_name || '-'}</td>
                  <td style={{ padding: '14px 24px', fontSize: '13px', color: '#475569' }}>{row.plate || '-'}</td>
                  <td style={{ padding: '14px 24px', fontSize: '13px', color: '#475569', fontWeight: 600 }}>{row.distance_travelled || 0}</td>
                  <td style={{ padding: '14px 24px', fontSize: '13px', color: '#10B981' }}>{row.running_seconds ? Math.floor(row.running_seconds / 60) : 0}</td>
                  <td style={{ padding: '14px 24px', fontSize: '13px', color: '#F59E0B' }}>{row.idle_seconds ? Math.floor(row.idle_seconds / 60) : 0}</td>
                  <td style={{ padding: '14px 24px', fontSize: '13px', color: '#64748B' }}>{row.stopped_seconds ? Math.floor(row.stopped_seconds / 60) : 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};

export default ConsolidatedReportPage;
