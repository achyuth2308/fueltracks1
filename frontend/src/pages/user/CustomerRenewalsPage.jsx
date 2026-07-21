import React, { useState } from 'react';
import { formatLocalDate, getVehicleExpiryStatus } from '../../utils/dateUtils';
import { Loader2, Truck, CheckCircle, RefreshCw, CreditCard } from 'lucide-react';
import { useVehicles } from '../../hooks/useVehicles';
import DummyRazorpayModal from '../../components/modals/DummyRazorpayModal';

const CustomerRenewalsPage = () => {
  const { vehicles, loading: vehiclesLoading } = useVehicles();
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [showRazorpay, setShowRazorpay] = useState(false);

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return formatLocalDate(dateStr);
  };

  const handleRenewClick = (vehicle) => {
    setSelectedVehicle(vehicle);
    setShowRazorpay(true);
  };

  return (
    <div style={{ padding: '32px', background: '#EEF5F8', height: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexShrink: 0 }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#111827', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <RefreshCw size={28} color="#f97316" />
            My Renewals
          </h1>
          <p style={{ fontSize: '14px', color: '#6B7280', marginTop: '4px' }}>Manage and renew licenses for your vehicles.</p>
        </div>
      </div>

      <div style={{ background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
        {vehiclesLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
            <Loader2 size={32} color="#f97316" className="animate-spin" />
          </div>
        ) : vehicles.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#64748B' }}>No vehicles found in your account.</div>
        ) : (
          <div style={{ overflowX: 'auto', overflowY: 'auto', flex: 1 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', whiteSpace: 'nowrap' }}>
              <thead>
                <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                  <th style={{ padding: '16px 20px', fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Vehicle</th>

                  <th style={{ padding: '16px 20px', fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>IMEI / Device</th>
                  <th style={{ padding: '16px 20px', fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Issued Date</th>
                  <th style={{ padding: '16px 20px', fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Expiry Date</th>
                  <th style={{ padding: '16px 20px', fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Plan Threshold</th>
                  <th style={{ padding: '16px 20px', fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Renewal Price</th>
                  <th style={{ padding: '16px 20px', fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Status</th>
                  <th style={{ padding: '16px 20px', fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {vehicles.map(v => {
                  const status = getVehicleExpiryStatus(v.licence_expire_date, v.licence_issued_date, v.metadata);
                  const needsRenewal = status.isExpiring || status.isExpired;
                  const planText = status.durationMonths >= 6 ? '1 Year Plan (30-day alert)' : '1 Month Plan (7-day alert)';
                  const customPrice = v.metadata?.renewal_price !== undefined && v.metadata?.renewal_price !== null 
                    ? `₹${parseFloat(v.metadata.renewal_price).toFixed(2)}` 
                    : null;

                  let bg = '#D1FAE5';
                  let color = '#059669';
                  if (status.type === 'expired') {
                    bg = '#FEF2F2';
                    color = '#DC2626';
                  } else if (status.type === 'expiring') {
                    bg = '#FFFBEB';
                    color = '#D97706';
                  }

                  return (
                    <tr key={v.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '16px 20px', fontSize: '14px', color: '#111827', fontWeight: 700 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Truck size={16} color="#64748B" />
                          {v.name}
                        </div>
                      </td>
                      <td style={{ padding: '16px 20px', fontSize: '13px', color: '#475569', fontFamily: 'monospace' }}>{v.imei}</td>
                      <td style={{ padding: '16px 20px', fontSize: '13px', color: '#475569' }}>{formatDate(v.licence_issued_date)}</td>
                      <td style={{ padding: '16px 20px', fontSize: '13px', color: '#111827', fontWeight: 600 }}>{formatDate(v.licence_expire_date)}</td>

                      <td style={{ padding: '16px 20px', fontSize: '12px', color: '#64748B' }}>
                        <span style={{ background: '#F1F5F9', padding: '4px 8px', borderRadius: '6px', fontWeight: 600 }}>
                          {planText}
                        </span>
                      </td>
                      <td style={{ padding: '16px 20px', fontSize: '14px', fontWeight: 800, color: '#10B981' }}>
                        {customPrice || <span style={{ fontSize: '12px', color: '#64748B', fontWeight: 500 }}>Default Plan</span>}
                      </td>

                      <td style={{ padding: '16px 20px' }}>
                        <span style={{ padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 800, background: bg, color: color }}>
                          {status.text}
                        </span>
                      </td>
                      <td style={{ padding: '16px 20px' }}>
                        {needsRenewal ? (
                          <button
                            onClick={() => handleRenewClick(v)}
                            style={{
                              padding: '8px 18px', background: status.type === 'expired' ? '#EF4444' : '#F59E0B',
                              color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 800, fontSize: '13px',
                              cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', transition: 'all 0.15s',
                              display: 'inline-flex', alignItems: 'center', gap: '6px'
                            }}
                          >
                            <CreditCard size={15} />
                            Pay Now
                          </button>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#10B981', fontSize: '13px', fontWeight: 700 }}>
                            <CheckCircle size={16} /> Up to date
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <DummyRazorpayModal
        isOpen={showRazorpay}
        onClose={() => {
          setShowRazorpay(false);
          setSelectedVehicle(null);
        }}
        vehicle={selectedVehicle}
        onSuccess={() => {
          setShowRazorpay(false);
          setSelectedVehicle(null);
          window.location.reload();
        }}
      />

      <style dangerouslySetInnerHTML={{
        __html: `
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}} />
    </div>
  );
};

export default CustomerRenewalsPage;
