import React, { useState, useEffect } from 'react';
import { formatLocalDate } from '../../utils/dateUtils';
import { Loader2, AlertTriangle, Search, FileText, CalendarX2 } from 'lucide-react';
import * as adminApi from '../../api/adminApi';

const BillingAdminPage = () => {
  const [licenses, setLicenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await adminApi.getExpiredLicenses();
      if (res.success) {
        setLicenses(res.data);
      } else {
        setError('Failed to load expired licenses.');
      }
    } catch (err) {
      setError('An error occurred while fetching billing data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredLicenses = licenses.filter(l =>
    (l.vehicleName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (l.deviceId || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (l.licenceId || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (l.organization || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return formatLocalDate(d); // dd/mm/yyyy
  };

  return (
    <div style={{ padding: '32px', background: '#EEF5F8', height: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 shrink-0">
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#111827', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FileText size={28} color="#f97316" />
            Billing & Subscriptions
          </h1>
          <p style={{ fontSize: '14px', color: '#6B7280', marginTop: '4px' }}>Track vehicle licenses and renewals.</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '24px', flex: 1, minHeight: 0 }}>
        <div style={{
          background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0',
          boxShadow: '0 4px 6px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column',
          flex: '1', overflow: 'hidden'
        }}>
          {/* Search Bar */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-4 sm:px-5 border-b border-slate-200">
            <div style={{ position: 'relative', width: '100%', maxWidth: '320px' }}>
              <Search style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} size={16} />
              <input
                type="text"
                placeholder="Search by vehicle, IMEI, or licence ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%', padding: '10px 14px 10px 38px',
                  borderRadius: '10px', border: '1px solid #CBD5E1',
                  fontSize: '14px', outline: 'none', color: '#111827', boxSizing: 'border-box'
                }}
              />
            </div>
            
            <div style={{ fontSize: '14px', fontWeight: 600, color: '#475569', display: 'flex', gap: '16px' }}>
              <span>Total Active: <span style={{ color: '#059669' }}>{licenses.filter(l => l.status === 'Active').length}</span></span>
              <span>Total Expired: <span style={{ color: '#DC2626' }}>{licenses.filter(l => l.status === 'Expired').length}</span></span>
            </div>
          </div>

          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
              <Loader2 size={32} color="#f97316" className="animate-spin" />
              <span style={{ fontSize: '14px', color: '#6B7280', marginTop: '12px' }}>Loading billing data...</span>
            </div>
          ) : error ? (
            <div style={{ padding: '40px', textAlign: 'center', flex: 1 }}>
              <AlertTriangle size={32} color="#EF4444" style={{ margin: '0 auto 12px' }} />
              <div style={{ fontSize: '15px', fontWeight: 600, color: '#111827' }}>Failed to Load Records</div>
              <div style={{ fontSize: '13px', color: '#6B7280', marginTop: '4px' }}>{error}</div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto', overflowY: 'auto', flex: 1 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', whiteSpace: 'nowrap' }}>
                <thead>
                  <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                    {[
                      'Licence ID', 'Vehicle ID', 'Vehicle Name', 'Licence Type', 
                      'Device IMEI', 'Organization', 'Dealer Name', 'Device Model', 
                      'GPS Sim No', 'Licence Issued', 'Licence Expiry', 'Status'
                    ].map(h => (
                      <th key={h} style={{ padding: '16px 20px', fontSize: '12px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredLicenses.length === 0 ? (
                    <tr>
                      <td colSpan="12" style={{ padding: '80px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: 0.5 }}>
                          <CalendarX2 size={48} color="#94A3B8" style={{ marginBottom: '16px' }} />
                          <div style={{ fontSize: '16px', fontWeight: 700, color: '#111827' }}>No licenses found</div>
                          <div style={{ fontSize: '14px', color: '#6B7280', marginTop: '4px' }}>There are no vehicle subscriptions to display.</div>
                        </div>
                      </td>
                    </tr>
                  ) : filteredLicenses.map((l, index) => (
                    <tr
                      key={l.vehicleId + index}
                      style={{ borderBottom: '1px solid #F1F5F9', transition: 'background 0.2s' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ padding: '16px 20px', fontSize: '13px', fontFamily: 'monospace', color: '#64748B' }}>{l.licenceId}</td>
                      <td style={{ padding: '16px 20px', fontSize: '13px', color: '#475569' }}>{l.vehicleId}</td>
                      <td style={{ padding: '16px 20px', fontSize: '14px', fontWeight: 600, color: '#111827' }}>{l.vehicleName}</td>
                      <td style={{ padding: '16px 20px' }}>
                        <span style={{ 
                          padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 600, 
                          background: l.licenceType === 'Premium' ? '#E0E7FF' : l.licenceType === 'Advanced' ? '#FEF3C7' : l.licenceType === 'Basic' ? '#F3E8FF' : l.licenceType === 'Starter' ? '#D1FAE5' : '#F1F5F9',
                          color: l.licenceType === 'Premium' ? '#4338CA' : l.licenceType === 'Advanced' ? '#D97706' : l.licenceType === 'Basic' ? '#7E22CE' : l.licenceType === 'Starter' ? '#059669' : '#475569'
                        }}>
                          {l.licenceType}
                        </span>
                      </td>
                      <td style={{ padding: '16px 20px', fontSize: '13px', color: '#475569' }}>{l.deviceId}</td>
                      <td style={{ padding: '16px 20px', fontSize: '13px', fontWeight: 600, color: '#111827' }}>{l.organization}</td>
                      <td style={{ padding: '16px 20px', fontSize: '13px', color: '#475569' }}>{l.dealerName}</td>
                      <td style={{ padding: '16px 20px', fontSize: '13px', color: '#475569' }}>{l.deviceModel}</td>
                      <td style={{ padding: '16px 20px', fontSize: '13px', color: '#475569' }}>{l.gpsSimNo}</td>
                      <td style={{ padding: '16px 20px', fontSize: '13px', color: '#475569' }}>{formatDate(l.licenceIssuedDate)}</td>
                      <td style={{ padding: '16px 20px', fontSize: '13px', fontWeight: 600, color: l.status === 'Expired' ? '#DC2626' : '#111827' }}>{formatDate(l.licenceExpiryDate)}</td>
                      <td style={{ padding: '16px 20px' }}>
                        <span style={{ 
                          padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 700, 
                          background: l.status === 'Expired' ? '#FEE2E2' : '#D1FAE5', 
                          color: l.status === 'Expired' ? '#DC2626' : '#059669', 
                          border: `1px solid ${l.status === 'Expired' ? '#FECACA' : '#A7F3D0'}` 
                        }}>
                          {l.status.toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BillingAdminPage;
