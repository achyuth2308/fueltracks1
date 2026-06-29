import React, { useState, useEffect } from 'react';
import { Loader2, AlertTriangle, CreditCard, Save, RefreshCw } from 'lucide-react';
import * as adminApi from '../../api/adminApi';

const AdminRenewalsPage = () => {
  const [settings, setSettings] = useState({ amount: '' });
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [settingsRes, transRes] = await Promise.all([
        adminApi.getRenewalSettings(),
        adminApi.getRenewalTransactions()
      ]);
      
      if (settingsRes.success) {
        setSettings(settingsRes.data || { amount: 2000 });
      }
      if (transRes.success) {
        setTransactions(transRes.data || []);
      }
    } catch (err) {
      setError('An error occurred while fetching renewal data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSaveSettings = async () => {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await adminApi.updateRenewalSettings(settings.amount);
      if (res.success) {
        setMessage('Renewal settings updated successfully.');
      } else {
        setError(res.error || 'Failed to update settings.');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update settings.');
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('en-GB');
  };

  return (
    <div style={{ padding: '32px', background: '#EEF5F8', height: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexShrink: 0 }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#111827', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <RefreshCw size={28} color="#f97316" />
            Renewal License Management
          </h1>
          <p style={{ fontSize: '14px', color: '#6B7280', marginTop: '4px' }}>Configure renewal prices and view transaction history.</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '24px', flex: 1, minHeight: 0, flexDirection: 'column' }}>
        
        {/* Settings Card */}
        <div style={{ background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '24px', boxShadow: '0 4px 6px rgba(0,0,0,0.02)', flexShrink: 0 }}>
          <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#111827', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CreditCard size={18} color="#f97316" /> Renewal Price Configuration
          </h2>
          
          {error && <div style={{ marginBottom: '16px', padding: '10px', background: '#FEF2F2', color: '#DC2626', borderRadius: '8px', fontSize: '13px', fontWeight: 600 }}>{error}</div>}
          {message && <div style={{ marginBottom: '16px', padding: '10px', background: '#F0FDF4', color: '#16A34A', borderRadius: '8px', fontSize: '13px', fontWeight: 600 }}>{message}</div>}

          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '16px' }}>
            <div style={{ flex: 1, maxWidth: '300px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>Annual Renewal Amount (₹)</label>
              <input
                type="number"
                value={settings.amount}
                onChange={e => setSettings({ ...settings, amount: e.target.value })}
                style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '14px', outline: 'none', color: '#000000' }}
              />
            </div>
            <button
              onClick={handleSaveSettings}
              disabled={saving}
              style={{ padding: '10px 20px', background: '#111827', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save Amount
            </button>
          </div>
        </div>

        {/* Transactions Table */}
        <div style={{ background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2E8F0', background: '#F8FAFC' }}>
            <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#111827', margin: 0 }}>Transaction History</h2>
          </div>

          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
              <Loader2 size={32} color="#f97316" className="animate-spin" />
            </div>
          ) : (
            <div style={{ overflowX: 'auto', overflowY: 'auto', flex: 1 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', whiteSpace: 'nowrap' }}>
                <thead>
                  <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                    <th style={{ padding: '12px 20px', fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Date</th>
                    <th style={{ padding: '12px 20px', fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>User</th>
                    <th style={{ padding: '12px 20px', fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Vehicle</th>
                    <th style={{ padding: '12px 20px', fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Amount</th>
                    <th style={{ padding: '12px 20px', fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Payment ID</th>
                    <th style={{ padding: '12px 20px', fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map(t => (
                    <tr key={t.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '12px 20px', fontSize: '13px', color: '#475569' }}>{formatDate(t.created_at)}</td>
                      <td style={{ padding: '12px 20px', fontSize: '13px', color: '#111827', fontWeight: 600 }}>
                        {t.user_name} <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 400 }}>{t.user_email}</div>
                      </td>
                      <td style={{ padding: '12px 20px', fontSize: '13px', color: '#111827', fontWeight: 600 }}>{t.vehicle_name}</td>
                      <td style={{ padding: '12px 20px', fontSize: '13px', color: '#111827', fontWeight: 700 }}>₹{parseFloat(t.amount).toFixed(2)}</td>
                      <td style={{ padding: '12px 20px', fontSize: '12px', color: '#64748B', fontFamily: 'monospace' }}>{t.payment_id}</td>
                      <td style={{ padding: '12px 20px' }}>
                        <span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700, background: '#D1FAE5', color: '#065F46' }}>
                          {t.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {transactions.length === 0 && (
                    <tr>
                      <td colSpan="6" style={{ padding: '40px', textAlign: 'center', color: '#94A3B8', fontSize: '14px' }}>
                        No transactions found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}} />
    </div>
  );
};

export default AdminRenewalsPage;
