import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Server, Loader2, AlertOctagon } from 'lucide-react';
import api from '../../api/axiosConfig';
import { formatLocalTime } from '../../utils/dateUtils';
import { formatOdometer } from '../../utils/formatUtils';

const SensorLogsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 100, total: 0 });

  useEffect(() => {
    fetchMessages(1);
  }, [id]);

  const fetchMessages = async (page = 1) => {
    setLoading(true);
    try {
      const res = await api.get(`/api/vehicles/${id}/messages`, { params: { page, limit: 100 } });
      setMessages(res.data.data || []);
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

  if (loading && messages.length === 0) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '16px' }}>
      <Loader2 size={40} color="#f97316" className="animate-spin" />
      <span style={{ fontSize: '14px', color: '#64748B', fontWeight: 600 }}>Loading sensor data...</span>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 56px)', background: '#EEF5F8' }}>
      {/* Top Navigation */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', background: '#FFFFFF', borderBottom: '1px solid #E2E8F0', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button
            onClick={() => navigate(`/vehicles/${id}`)}
            style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#F8FAFC', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#475569' }}
          >
            <ArrowLeft size={18} />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Server size={18} color="#f97316" />
            </div>
            <div>
              <h1 style={{ fontSize: '18px', fontWeight: 800, color: '#111827', margin: 0 }}>Sensor Data Logs</h1>
              <span style={{ fontSize: '12px', color: '#64748B', fontWeight: 500 }}>Raw telemetry packets from hardware</span>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <span style={{ fontSize: '13px', color: '#64748B', fontWeight: 600 }}>
            Page {pagination.page} of {pagination.totalPages || 1}
          </span>
          <div style={{ display: 'flex', gap: '4px' }}>
            <button 
              onClick={() => handlePageChange(pagination.page - 1)} 
              disabled={pagination.page <= 1}
              style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #E2E8F0', background: pagination.page <= 1 ? '#F8FAFC' : '#FFFFFF', color: pagination.page <= 1 ? '#94A3B8' : '#111827', cursor: pagination.page <= 1 ? 'not-allowed' : 'pointer' }}
            >
              Prev
            </button>
            <button 
              onClick={() => handlePageChange(pagination.page + 1)} 
              disabled={pagination.page >= (pagination.totalPages || 1)}
              style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #E2E8F0', background: pagination.page >= (pagination.totalPages || 1) ? '#F8FAFC' : '#FFFFFF', color: pagination.page >= (pagination.totalPages || 1) ? '#94A3B8' : '#111827', cursor: pagination.page >= (pagination.totalPages || 1) ? 'not-allowed' : 'pointer' }}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, padding: '24px', overflowY: 'auto' }}>
        {error ? (
          <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', padding: '16px', borderRadius: '12px', color: '#991B1B', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <AlertOctagon size={24} color="#EF4444" />
            <div>
              <div style={{ fontWeight: 700, fontSize: '14px' }}>Error Loading Logs</div>
              <div style={{ fontSize: '13px', marginTop: '2px' }}>{error}</div>
            </div>
          </div>
        ) : (
          <div style={{ background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', overflow: 'hidden', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                  <th style={{ padding: '12px 16px', color: '#64748B', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '11px' }}>Date & Time</th>
                  <th style={{ padding: '12px 16px', color: '#64748B', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '11px' }}>Device Time</th>
                  <th style={{ padding: '12px 16px', color: '#64748B', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '11px' }}>Device Odo</th>
                  <th style={{ padding: '12px 16px', color: '#64748B', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '11px' }}>Protocol Status</th>
                  <th style={{ padding: '12px 16px', color: '#64748B', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '11px' }}>Packet Type</th>
                  <th style={{ padding: '12px 16px', color: '#64748B', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '11px' }}>Device Message</th>
                </tr>
              </thead>
              <tbody>
                {messages.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ padding: '48px 24px', textAlign: 'center', color: '#94A3B8' }}>
                      <Server size={32} style={{ marginBottom: '12px', opacity: 0.5 }} />
                      <div style={{ fontSize: '14px', fontWeight: 600 }}>No Sensor Data Found</div>
                      <div style={{ fontSize: '13px', marginTop: '4px' }}>Raw telemetry logs will appear here once the device connects.</div>
                    </td>
                  </tr>
                ) : (
                  messages.map((m) => (
                    <tr key={m.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '12px 16px', color: '#475569', fontWeight: 500, whiteSpace: 'nowrap' }}>
                        {formatLocalTime(m.received_at)}
                      </td>
                      <td style={{ padding: '12px 16px', color: '#475569', whiteSpace: 'nowrap' }}>
                        {m.device_time ? formatLocalTime(m.device_time) : '—'}
                      </td>
                      <td style={{ padding: '12px 16px', color: '#111827', fontWeight: 600 }}>
                        {m.odometer != null ? m.odometer : '—'}
                      </td>
                      <td style={{ padding: '12px 16px', color: m.parsed ? '#10B981' : '#EF4444', fontWeight: 600 }}>
                        {m.parsed ? 'Valid' : 'Invalid'}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ background: '#F1F5F9', color: '#475569', padding: '4px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, fontFamily: 'monospace' }}>
                          {m.packet_type || 'UNKNOWN'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontSize: '12px', color: '#f97316', maxWidth: '400px', overflowX: 'auto', whiteSpace: 'nowrap' }}>
                        {m.raw_hex || m.raw || '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default SensorLogsPage;
