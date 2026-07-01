import React, { useState, useEffect } from 'react';
import { Loader2, Plus, RefreshCw, Trash2, Tag, Building2, Calendar, FileText, Edit2, Save, X } from 'lucide-react';
import * as adminApi from '../../api/adminApi';
import { useAuth } from '../../hooks/useAuth';

const AdminRenewalsPage = () => {
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
    return new Date(dateStr).toLocaleString('en-GB');
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
          <p style={{ fontSize: '14px', color: '#6B7280', marginTop: '4px' }}>Configure renewal pricing plans and view transaction history.</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '24px', flex: 1, minHeight: 0, flexDirection: 'column', overflowY: 'auto' }}>
        
        {/* Plans Management Card */}
        <div style={{ background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '24px', boxShadow: '0 4px 6px rgba(0,0,0,0.02)', flexShrink: 0 }}>
          <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#111827', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Tag size={18} color="#f97316" /> Renewal Price Plans
          </h2>
          
          {error && <div style={{ marginBottom: '16px', padding: '10px', background: '#FEF2F2', color: '#DC2626', borderRadius: '8px', fontSize: '13px', fontWeight: 600 }}>{error}</div>}
          {message && <div style={{ marginBottom: '16px', padding: '10px', background: '#F0FDF4', color: '#16A34A', borderRadius: '8px', fontSize: '13px', fontWeight: 600 }}>{message}</div>}

          {/* Create Plan Form */}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '16px', marginBottom: '24px', flexWrap: 'wrap', background: '#F8FAFC', padding: '16px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
            <div style={{ flex: 1, minWidth: '150px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>Plan Name</label>
              <input type="text" placeholder="e.g. 1 Month Basic" value={newPlan.name} onChange={e => setNewPlan({...newPlan, name: e.target.value})} style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '14px', outline: 'none', color: '#000000', boxSizing: 'border-box' }} />
            </div>
            <div style={{ width: '120px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>Months</label>
              <input type="number" placeholder="1" value={newPlan.duration_months} onChange={e => setNewPlan({...newPlan, duration_months: e.target.value})} style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '14px', outline: 'none', color: '#000000', boxSizing: 'border-box' }} />
            </div>
            <div style={{ width: '120px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>Price (₹)</label>
              <input type="number" placeholder="300" value={newPlan.price} onChange={e => setNewPlan({...newPlan, price: e.target.value})} style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '14px', outline: 'none', color: '#000000', boxSizing: 'border-box' }} />
            </div>
            <div style={{ flex: 1, minWidth: '150px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>Target Level</label>
              <select value={newPlan.target_type} onChange={e => setNewPlan({...newPlan, target_type: e.target.value, user_id: '', group_id: ''})} style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '14px', outline: 'none', color: '#000000', boxSizing: 'border-box' }}>
                <option value="org">Organization</option>
                <option value="user">Specific User</option>
                <option value="group">Specific Group</option>
              </select>
            </div>
            <div style={{ flex: 1, minWidth: '200px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>Target Org (Required)</label>
              <select value={newPlan.org_id} onChange={e => setNewPlan({...newPlan, org_id: e.target.value, user_id: '', group_id: ''})} style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '14px', outline: 'none', color: '#000000', boxSizing: 'border-box' }}>
                {user?.role === 'superadmin' && <option value="">Global (All Users)</option>}
                {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>
            {newPlan.target_type === 'user' && (
              <div style={{ flex: 1, minWidth: '200px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>Target User</label>
                <select value={newPlan.user_id} onChange={e => setNewPlan({...newPlan, user_id: e.target.value})} style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '14px', outline: 'none', color: '#000000', boxSizing: 'border-box' }}>
                  <option value="">Select User...</option>
                  {users.filter(u => u.org_id === newPlan.org_id).map(u => <option key={u.id} value={u.id}>{u.name || u.email}</option>)}
                </select>
              </div>
            )}
            {newPlan.target_type === 'group' && (
              <div style={{ flex: 1, minWidth: '200px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>Target Group</label>
                <select value={newPlan.group_id} onChange={e => setNewPlan({...newPlan, group_id: e.target.value})} style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '14px', outline: 'none', color: '#000000', boxSizing: 'border-box' }}>
                  <option value="">Select Group...</option>
                  {groups.filter(g => g.org_id === newPlan.org_id).map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '2px' }}>
              <button onClick={handleCreatePlan} disabled={creating} style={{ padding: '10px 20px', background: '#111827', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', height: '42px' }}>
                {creating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Create
              </button>
            </div>
          </div>

          {/* Active Plans List */}
          <div style={{ border: '1px solid #E2E8F0', borderRadius: '12px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                  <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: '#64748B' }}>Plan Name</th>
                  <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: '#64748B' }}>Duration</th>
                  <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: '#64748B' }}>Price</th>
                  <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: '#64748B' }}>Target</th>
                  <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: '#64748B', textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {plans.map(p => (
                  <tr key={p.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                    {editingPlan?.id === p.id ? (
                      <>
                        <td style={{ padding: '12px 16px' }}>
                          <input type="text" value={editingPlan.name} onChange={e => setEditingPlan({...editingPlan, name: e.target.value})} style={{ width: '100%', padding: '6px 10px', borderRadius: '4px', border: '1px solid #CBD5E1', fontSize: '13px' }} />
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <input type="number" value={editingPlan.duration_months} onChange={e => setEditingPlan({...editingPlan, duration_months: e.target.value})} style={{ width: '100%', padding: '6px 10px', borderRadius: '4px', border: '1px solid #CBD5E1', fontSize: '13px' }} />
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <input type="number" value={editingPlan.price} onChange={e => setEditingPlan({...editingPlan, price: e.target.value})} style={{ width: '100%', padding: '6px 10px', borderRadius: '4px', border: '1px solid #CBD5E1', fontSize: '13px' }} />
                        </td>
                        <td style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <select value={editingPlan.target_type || (editingPlan.group_id ? 'group' : editingPlan.user_id ? 'user' : 'org')} onChange={e => setEditingPlan({...editingPlan, target_type: e.target.value, user_id: '', group_id: ''})} style={{ width: '100%', padding: '6px 10px', borderRadius: '4px', border: '1px solid #CBD5E1', fontSize: '13px' }}>
                            <option value="org">Org</option>
                            <option value="user">User</option>
                            <option value="group">Group</option>
                          </select>
                          <select value={editingPlan.org_id || ''} onChange={e => setEditingPlan({...editingPlan, org_id: e.target.value, user_id: '', group_id: ''})} style={{ width: '100%', padding: '6px 10px', borderRadius: '4px', border: '1px solid #CBD5E1', fontSize: '13px' }}>
                            <option value="">Global (All Users)</option>
                            {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                          </select>
                          {(editingPlan.target_type === 'user' || editingPlan.user_id) && (
                            <select value={editingPlan.user_id || ''} onChange={e => setEditingPlan({...editingPlan, user_id: e.target.value})} style={{ width: '100%', padding: '6px 10px', borderRadius: '4px', border: '1px solid #CBD5E1', fontSize: '13px' }}>
                              <option value="">Select User...</option>
                              {users.filter(u => u.org_id === editingPlan.org_id).map(u => <option key={u.id} value={u.id}>{u.name || u.email}</option>)}
                            </select>
                          )}
                          {(editingPlan.target_type === 'group' || editingPlan.group_id) && (
                            <select value={editingPlan.group_id || ''} onChange={e => setEditingPlan({...editingPlan, group_id: e.target.value})} style={{ width: '100%', padding: '6px 10px', borderRadius: '4px', border: '1px solid #CBD5E1', fontSize: '13px' }}>
                              <option value="">Select Group...</option>
                              {groups.filter(g => g.org_id === editingPlan.org_id).map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                            </select>
                          )}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                          <button onClick={handleUpdatePlan} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#10B981', padding: '4px' }}>
                            <Save size={16} />
                          </button>
                          <button onClick={() => setEditingPlan(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748B', padding: '4px' }}>
                            <X size={16} />
                          </button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td style={{ padding: '12px 16px', fontSize: '14px', fontWeight: 600, color: '#0F172A' }}>{p.name}</td>
                        <td style={{ padding: '12px 16px', fontSize: '14px', color: '#475569' }}><Calendar size={14} style={{display:'inline', marginRight:4, verticalAlign:'middle'}}/>{p.duration_months} Months</td>
                        <td style={{ padding: '12px 16px', fontSize: '14px', fontWeight: 700, color: '#10B981' }}>₹{parseFloat(p.price).toFixed(2)}</td>
                        <td style={{ padding: '12px 16px', fontSize: '13px', color: '#64748B' }}>
                          {p.group_id ? (
                            <><Building2 size={14} style={{display:'inline', marginRight:4, verticalAlign:'middle'}}/> Group: {p.group_name}</>
                          ) : p.user_id ? (
                            <><Building2 size={14} style={{display:'inline', marginRight:4, verticalAlign:'middle'}}/> User: {p.user_name}</>
                          ) : p.org_id ? (
                            <><Building2 size={14} style={{display:'inline', marginRight:4, verticalAlign:'middle'}}/> Org: {p.org_name}</>
                          ) : 'Global'}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                          {(!p.org_id && user?.role !== 'superadmin') ? null : (
                            <>
                              <button onClick={() => setEditingPlan(p)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#3B82F6', padding: '4px', marginRight: '8px' }}>
                                <Edit2 size={16} />
                              </button>
                              <button onClick={() => handleDeletePlan(p.id)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#EF4444', padding: '4px' }}>
                                <Trash2 size={16} />
                              </button>
                            </>
                          )}
                        </td>
                      </>
                    )}
                  </tr>
                ))}
                {plans.length === 0 && !loading && (
                  <tr>
                    <td colSpan="5" style={{ padding: '24px', textAlign: 'center', color: '#94A3B8', fontSize: '14px' }}>No active plans found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

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
                      <td style={{ padding: '12px 20px', fontSize: '13px', color: '#475569' }}>{t.plan_name || 'Legacy Plan'}</td>
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
