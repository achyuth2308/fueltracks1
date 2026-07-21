import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatLocalDate, formatLocalTime } from '../../utils/dateUtils';
import { Loader2, AlertTriangle, Search, FileText, CalendarX2, CreditCard, DollarSign, Edit3, Clock, CheckCircle, Settings } from 'lucide-react';
import * as adminApi from '../../api/adminApi';
import SetRenewalAmountModal from '../../components/modals/SetRenewalAmountModal';

const BillingAdminPage = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('licenses'); // 'licenses' | 'transactions'

  const [licenses, setLicenses] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Modal state
  const [selectedVehicleForAmount, setSelectedVehicleForAmount] = useState(null);
  const [isAmountModalOpen, setIsAmountModalOpen] = useState(false);

  const fetchLicenses = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminApi.getExpiredLicenses();
      if (res.success) {
        setLicenses(res.data);
      } else {
        setError('Failed to load vehicle licenses.');
      }
    } catch (err) {
      setError('An error occurred while fetching billing data.');
    } finally {
      setLoading(false);
    }
  };

  const fetchTransactions = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminApi.getRenewalTransactions();
      if (res.success) {
        setTransactions(res.data);
      } else {
        setError('Failed to load transaction history.');
      }
    } catch (err) {
      setError('An error occurred while fetching transactions.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'licenses') {
      fetchLicenses();
    } else {
      fetchTransactions();
    }
  }, [activeTab]);

  const openSetAmountModal = (license) => {
    setSelectedVehicleForAmount(license);
    setIsAmountModalOpen(true);
  };

  const handleSetAmountSuccess = () => {
    fetchLicenses();
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return formatLocalDate(dateStr);
  };

  const filteredLicenses = licenses.filter(l =>
    (l.vehicleName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (l.deviceId || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (l.licenceId || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (l.organization || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredTransactions = transactions.filter(t =>
    (t.payment_id || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (t.vehicle_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (t.user_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (t.user_email || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeCount = licenses.filter(l => l.status === 'Active').length;
  const expiringCount = licenses.filter(l => l.status === 'Expiring').length;
  const expiredCount = licenses.filter(l => l.status === 'Expired').length;

  return (
    <div style={{ padding: '32px', background: '#EEF5F8', height: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 shrink-0">
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#111827', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FileText size={28} color="#f97316" />
            Billing & Subscriptions
          </h1>
          <p style={{ fontSize: '14px', color: '#6B7280', marginTop: '4px' }}>
            Manage vehicle license prices, expiry warnings, and view payment transaction history.
          </p>
        </div>

        {/* Tab Navigation Buttons */}
        <div style={{ display: 'flex', gap: '8px', background: '#E2E8F0', padding: '4px', borderRadius: '12px' }}>
          <button
            onClick={() => { setActiveTab('licenses'); setSearchQuery(''); }}
            style={{
              padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 700,
              border: 'none', cursor: 'pointer', transition: 'all 0.15s',
              background: activeTab === 'licenses' ? '#FFFFFF' : 'transparent',
              color: activeTab === 'licenses' ? '#0F172A' : '#64748B',
              boxShadow: activeTab === 'licenses' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              display: 'flex', alignItems: 'center', gap: '8px'
            }}
          >
            <CreditCard size={16} />
            Vehicle Licenses
          </button>
          <button
            onClick={() => { setActiveTab('transactions'); setSearchQuery(''); }}
            style={{
              padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 700,
              border: 'none', cursor: 'pointer', transition: 'all 0.15s',
              background: activeTab === 'transactions' ? '#FFFFFF' : 'transparent',
              color: activeTab === 'transactions' ? '#0F172A' : '#64748B',
              boxShadow: activeTab === 'transactions' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              display: 'flex', alignItems: 'center', gap: '8px'
            }}
          >
            <Clock size={16} />
            Transaction History
          </button>
          <button
            onClick={() => navigate('/admin/renewal-config')}
            style={{
              padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 700,
              border: 'none', cursor: 'pointer', transition: 'all 0.15s',
              background: 'transparent', color: '#64748B',
              display: 'flex', alignItems: 'center', gap: '8px'
            }}
          >
            <Settings size={16} />
            Renewal Config
          </button>
        </div>
      </div>


      <div style={{ display: 'flex', gap: '24px', flex: 1, minHeight: 0 }}>
        <div style={{
          background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0',
          boxShadow: '0 4px 6px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column',
          flex: '1', overflow: 'hidden'
        }}>

          {/* Search Bar & Summary Stats */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-4 sm:px-5 border-b border-slate-200">
            <div style={{ position: 'relative', width: '100%', maxWidth: '360px' }}>
              <Search style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} size={16} />
              <input
                type="text"
                placeholder={activeTab === 'licenses' ? "Search vehicle, IMEI, or licence ID..." : "Search transaction ID, vehicle, user..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%', padding: '10px 14px 10px 38px',
                  borderRadius: '10px', border: '1px solid #CBD5E1',
                  fontSize: '14px', outline: 'none', color: '#111827', boxSizing: 'border-box'
                }}
              />
            </div>
            
            {activeTab === 'licenses' && (
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#475569', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                <span>Active: <span style={{ color: '#059669' }}>{activeCount}</span></span>
                <span>Expiring: <span style={{ color: '#D97706' }}>{expiringCount}</span></span>
                <span>Expired: <span style={{ color: '#DC2626' }}>{expiredCount}</span></span>
              </div>
            )}
          </div>

          {/* Loading or Error State */}
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
          ) : activeTab === 'licenses' ? (
            /* TAB 1: VEHICLE LICENSES & EXPIRY MANAGEMENT */
            <div style={{ overflowX: 'auto', overflowY: 'auto', flex: 1 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', whiteSpace: 'nowrap' }}>
                <thead>
                  <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                    {[
                      'Licence ID', 'Vehicle ID', 'Vehicle Name', 
                      'Device IMEI', 'Organization', 'Licence Issued', 'Licence Expiry',
                      'Plan Duration', 'Renewal Price', 'Status', 'Action'
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
                      <td colSpan="11" style={{ padding: '80px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: 0.5 }}>
                          <CalendarX2 size={48} color="#94A3B8" style={{ marginBottom: '16px' }} />
                          <div style={{ fontSize: '16px', fontWeight: 700, color: '#111827' }}>No vehicle licenses found</div>
                        </div>
                      </td>
                    </tr>
                  ) : filteredLicenses.map((l, index) => {
                    const isExp = l.status === 'Expired';
                    const isExpiring = l.status === 'Expiring';
                    const planLabel = l.durationMonths >= 6 ? '1 Year Plan (30-day alert)' : '1 Month Plan (7-day alert)';

                    return (
                      <tr
                        key={(l.dbVehicleId || l.vehicleId) + index}
                        style={{ borderBottom: '1px solid #F1F5F9', transition: 'background 0.2s' }}
                        onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <td style={{ padding: '16px 20px', fontSize: '13px', fontFamily: 'monospace', color: '#64748B' }}>{l.licenceId}</td>
                        <td style={{ padding: '16px 20px', fontSize: '13px', color: '#475569' }}>{l.vehicleId}</td>
                        <td style={{ padding: '16px 20px', fontSize: '14px', fontWeight: 700, color: '#111827' }}>{l.vehicleName}</td>
                        <td style={{ padding: '16px 20px', fontSize: '13px', color: '#475569', fontFamily: 'monospace' }}>{l.deviceId}</td>
                        <td style={{ padding: '16px 20px', fontSize: '13px', fontWeight: 600, color: '#111827' }}>{l.organization}</td>
                        <td style={{ padding: '16px 20px', fontSize: '13px', color: '#475569' }}>{formatDate(l.licenceIssuedDate)}</td>
                        <td style={{ padding: '16px 20px', fontSize: '13px', fontWeight: 700, color: isExp ? '#DC2626' : isExpiring ? '#D97706' : '#111827' }}>
                          {formatDate(l.licenceExpiryDate)}
                        </td>

                        <td style={{ padding: '16px 20px', fontSize: '12px', color: '#475569' }}>
                          <span style={{ background: '#F1F5F9', padding: '4px 8px', borderRadius: '6px', fontWeight: 600 }}>
                            {planLabel}
                          </span>
                        </td>
                        <td style={{ padding: '16px 20px', fontSize: '14px', fontWeight: 800, color: '#0F172A' }}>
                          {l.renewalPrice !== null && l.renewalPrice !== undefined ? `₹${parseFloat(l.renewalPrice).toFixed(2)}` : <span style={{ color: '#94A3B8', fontSize: '12px' }}>Not Set</span>}
                        </td>
                        <td style={{ padding: '16px 20px' }}>
                          <span
                            onClick={() => openSetAmountModal(l)}
                            title="Click to set renewal amount & duration"
                            style={{ 
                              padding: '5px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 800, cursor: 'pointer',
                              background: isExp ? '#FEE2E2' : isExpiring ? '#FEF3C7' : '#D1FAE5', 
                              color: isExp ? '#DC2626' : isExpiring ? '#D97706' : '#059669', 
                              border: `1px solid ${isExp ? '#FECACA' : isExpiring ? '#FDE68A' : '#A7F3D0'}`,
                              display: 'inline-flex', alignItems: 'center', gap: '6px'
                            }}
                          >
                            {isExp ? 'EXPIRED' : isExpiring ? `EXPIRING (${l.diffDays}d left)` : 'ACTIVE'}
                          </span>
                        </td>
                        <td style={{ padding: '16px 20px' }}>
                          <button
                            onClick={() => openSetAmountModal(l)}
                            style={{
                              padding: '6px 14px', background: '#F97316', color: '#FFFFFF',
                              border: 'none', borderRadius: '8px', fontWeight: 700, fontSize: '12px',
                              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
                              boxShadow: '0 2px 4px rgba(249, 115, 22, 0.2)'
                            }}
                          >
                            <Edit3 size={14} />
                            Set Amount
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            /* TAB 2: TRANSACTION HISTORY */
            <div style={{ overflowX: 'auto', overflowY: 'auto', flex: 1 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', whiteSpace: 'nowrap' }}>
                <thead>
                  <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                    {[
                      'Transaction / Payment ID', 'Payment Time', 'Vehicle', 
                      'User Name & Email', 'Duration', 'Amount Paid', 'Status'
                    ].map(h => (
                      <th key={h} style={{ padding: '16px 20px', fontSize: '12px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredTransactions.length === 0 ? (
                    <tr>
                      <td colSpan="7" style={{ padding: '80px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: 0.5 }}>
                          <Clock size={48} color="#94A3B8" style={{ marginBottom: '16px' }} />
                          <div style={{ fontSize: '16px', fontWeight: 700, color: '#111827' }}>No renewal transactions yet</div>
                          <div style={{ fontSize: '14px', color: '#6B7280', marginTop: '4px' }}>Transactions will appear here when users renew licenses.</div>
                        </div>
                      </td>
                    </tr>
                  ) : filteredTransactions.map((t) => (
                    <tr
                      key={t.id || t.payment_id}
                      style={{ borderBottom: '1px solid #F1F5F9', transition: 'background 0.2s' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ padding: '16px 20px', fontSize: '13px', fontFamily: 'monospace', fontWeight: 700, color: '#2563EB' }}>
                        {t.payment_id}
                      </td>
                      <td style={{ padding: '16px 20px', fontSize: '13px', color: '#475569' }}>
                        {formatLocalTime(t.created_at)}
                      </td>
                      <td style={{ padding: '16px 20px', fontSize: '14px', fontWeight: 700, color: '#111827' }}>
                        {t.vehicle_name}
                      </td>
                      <td style={{ padding: '16px 20px', fontSize: '13px', color: '#111827' }}>
                        <div style={{ fontWeight: 600 }}>{t.user_name}</div>
                        <div style={{ fontSize: '12px', color: '#64748B' }}>{t.user_email}</div>
                      </td>
                      <td style={{ padding: '16px 20px', fontSize: '13px', color: '#475569' }}>
                        {t.duration_months} Months
                      </td>
                      <td style={{ padding: '16px 20px', fontSize: '15px', fontWeight: 800, color: '#059669' }}>
                        ₹{parseFloat(t.amount).toFixed(2)}
                      </td>
                      <td style={{ padding: '16px 20px' }}>
                        <span style={{ 
                          padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 800, 
                          background: '#D1FAE5', color: '#059669', border: '1px solid #A7F3D0',
                          display: 'inline-flex', alignItems: 'center', gap: '4px'
                        }}>
                          <CheckCircle size={14} />
                          {t.status || 'SUCCESS'}
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

      {/* Set Renewal Amount Modal */}
      <SetRenewalAmountModal
        isOpen={isAmountModalOpen}
        onClose={() => {
          setIsAmountModalOpen(false);
          setSelectedVehicleForAmount(null);
        }}
        vehicle={selectedVehicleForAmount}
        onSuccess={handleSetAmountSuccess}
      />
    </div>
  );
};

export default BillingAdminPage;
