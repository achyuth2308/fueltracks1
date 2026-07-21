import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatLocalTime } from '../../utils/dateUtils';
import { Loader2, Plus, RefreshCw, Trash2, Tag, Building2, Calendar, FileText, Edit2, Save, X, CreditCard, ShieldAlert } from 'lucide-react';
import * as adminApi from '../../api/adminApi';
import { useAuth } from '../../hooks/useAuth';

const AdminRenewalsPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [plans, setPlans] = useState([]);
  const [orgs, setOrgs] = useState([]);
  const [users, setUsers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [editingPlan, setEditingPlan] = useState(null);
  
  const [newPlan, setNewPlan] = useState({ name: '', duration_months: '', price: '', org_id: '', target_type: 'org', user_id: '', group_id: '' });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [plansRes, transRes, orgsRes, usersRes, groupsRes] = await Promise.all([
        adminApi.getRenewalPlans(),
        adminApi.getRenewalTransactions(),
        adminApi.getOrgs(),
        adminApi.getUsers(),
        adminApi.getGroups()
      ]);
      
      if (plansRes.success) setPlans(plansRes.data || []);
      if (transRes.success) setTransactions(transRes.data || []);
      if (orgsRes.success) {
        const fetchedOrgs = orgsRes.data || [];
        setOrgs(fetchedOrgs);
        if (user?.role !== 'superadmin' && fetchedOrgs.length > 0 && !newPlan.org_id) {
          setNewPlan(prev => ({ ...prev, org_id: fetchedOrgs[0].id }));
        }
      }
      if (usersRes.success) setUsers(usersRes.data || []);
      if (groupsRes.success) setGroups(groupsRes.data || []);
    } catch (err) {
      setError('An error occurred while fetching data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreatePlan = async () => {
    if (!newPlan.name || !newPlan.duration_months || !newPlan.price) {
      setError('Name, Duration, and Price are required.');
      setTimeout(() => setError(null), 3000);
      return;
    }

    setCreating(true);
    setError(null);
    setMessage(null);
    try {
      const data = {
        name: newPlan.name,
        duration_months: parseInt(newPlan.duration_months),
        price: parseFloat(newPlan.price),
        org_id: newPlan.org_id || null,
        user_id: newPlan.target_type === 'user' ? newPlan.user_id : null,
        group_id: newPlan.target_type === 'group' ? newPlan.group_id : null,
      };
      const res = await adminApi.createRenewalPlan(data);
      if (res.success) {
        setMessage('Renewal plan created successfully.');
        setNewPlan({ name: '', duration_months: '', price: '', org_id: user?.role === 'superadmin' ? '' : (orgs[0]?.id || ''), target_type: 'org', user_id: '', group_id: '' });
        fetchData();
      } else {
        setError(res.error || 'Failed to create plan.');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create plan.');
    } finally {
      setCreating(false);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const handleUpdatePlan = async () => {
    if (!editingPlan.name || !editingPlan.duration_months || !editingPlan.price) {
      setError('Name, Duration, and Price are required.');
      setTimeout(() => setError(null), 3000);
      return;
    }
    
    setError(null);
    setMessage(null);
    try {
      const updateData = {
        name: editingPlan.name,
        duration_months: parseInt(editingPlan.duration_months),
        price: parseFloat(editingPlan.price),
        org_id: editingPlan.org_id || null,
        user_id: editingPlan.target_type === 'user' ? editingPlan.user_id : null,
        group_id: editingPlan.target_type === 'group' ? editingPlan.group_id : null,
      };
      const res = await adminApi.updateRenewalPlan(editingPlan.id, updateData);
      if (res.success) {
        setMessage('Renewal plan updated successfully.');
        setEditingPlan(null);
        fetchData();
      } else {
        setError(res.error || 'Failed to update plan.');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update plan.');
    } finally {
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const handleDeletePlan = async (id) => {
    if (!window.confirm('Are you sure you want to delete this plan?')) return;
    try {
      const res = await adminApi.deleteRenewalPlan(id);
      if (res.success) {
        setMessage('Plan deleted.');
        fetchData();
      } else {
        setError(res.error || 'Failed to delete plan.');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete plan.');
    }
    setTimeout(() => setMessage(null), 3000);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return formatLocalTime(dateStr);
  };

  return (
    <div style={{ padding: '32px', background: '#EEF5F8', height: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 shrink-0">
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#111827', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <RefreshCw size={28} color="#f97316" />
            Renewal License Management
          </h1>
          <p style={{ fontSize: '14px', color: '#6B7280', marginTop: '4px' }}>
            Configure default and targeted pricing plans. Thresholds: 1-Year Plan (30 days alert) & 1-Month Plan (7 days alert).
          </p>
        </div>

        <button
          onClick={() => navigate('/admin/billing')}
          style={{
            padding: '10px 18px', background: '#FFFFFF', color: '#0F172A',
            border: '1px solid #CBD5E1', borderRadius: '10px', fontSize: '13px',
            fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
          }}
        >
          <CreditCard size={16} color="#f97316" />
          Vehicle Licenses & Expiry
        </button>
      </div>

      <div style={{ display: 'flex', gap: '24px', flex: 1, minHeight: 0, flexDirection: 'column', overflowY: 'auto' }}>
        

        {/* Transactions Table */}
        <div style={{ background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column', flexShrink: 0, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2E8F0', background: '#FAFAFA' }}>
            <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#111827', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}><FileText size={18} color="#f97316" /> Transaction History</h2>
          </div>
          {loading ? (
             <div style={{ padding: '40px', textAlign: 'center' }}><Loader2 size={24} className="animate-spin" color="#f97316" style={{margin:'0 auto'}}/></div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', whiteSpace: 'nowrap' }}>
                <thead>
                  <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                    <th style={{ padding: '12px 20px', fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Date</th>
                    <th style={{ padding: '12px 20px', fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>User</th>
                    <th style={{ padding: '12px 20px', fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Vehicle</th>
                    <th style={{ padding: '12px 20px', fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Plan</th>
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
                      <td style={{ padding: '12px 20px', fontSize: '13px', color: '#475569' }}>{t.plan_name || 'Vehicle Renewal Plan'}</td>
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
                      <td colSpan="7" style={{ padding: '40px', textAlign: 'center', color: '#94A3B8', fontSize: '14px' }}>
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
