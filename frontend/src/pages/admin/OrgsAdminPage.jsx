import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { Building2, Plus, Edit, Trash2, Loader2, AlertTriangle, X, Settings, Shield, MapPin, Fuel, Radio, Users, Truck, ChevronRight } from 'lucide-react';
import * as adminApi from '../../api/adminApi';
import { useAuth } from '../../hooks/useAuth';

const OrgsAdminPage = () => {
  const { user } = useAuth();

  if (user?.role !== 'superadmin' && user?.role !== 'dealer') {
    return <Navigate to="/dashboard" replace />;
  }

  const [orgs, setOrgs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingOrg, setEditingOrg] = useState(null);

  // Tab state
  const [activeTab, setActiveTab] = useState('general');

  // Form State - Tab 1: General
  const [name, setName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [status, setStatus] = useState('Active');
  const [type, setType] = useState('customer');
  const [parentId, setParentId] = useState('');
  const [assignedUserIds, setAssignedUserIds] = useState([]);
  const [userSearchQuery, setUserSearchQuery] = useState('');

  // Resources state (User -> Groups -> Vehicles hierarchy)
  const [orgResources, setOrgResources] = useState([]);
  const [resourcesLoading, setResourcesLoading] = useState(false);

  const [allUsers, setAllUsers] = useState([]);
  const [modalError, setModalError] = useState(null);

  const fetchOrgsAndUsers = async () => {
    setLoading(true);
    try {
      const [orgRes, userRes] = await Promise.all([
        adminApi.getOrgs(),
        adminApi.getUsers()
      ]);
      if (orgRes.success) setOrgs(orgRes.data);
      if (userRes.success) setAllUsers(userRes.data);
    } catch (err) {
      setError('Failed to fetch records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrgsAndUsers();
  }, []);

  const handleOpenModal = async (org = null) => {
    setEditingOrg(org);
    setActiveTab('general');
    setModalError(null);
    setOrgResources([]);

    if (org) {
      setName(org.name || '');
      setPhone(org.phone || org.primary_user_phone || '');
      setAddress(org.address || '');
      setType(org.type || 'customer');
      setParentId(org.parent_id || '');
      setContactPerson(org.contact_person || org.primary_user_name || '');
      setEmail(org.email || org.primary_user_email || '');
      setStatus(org.is_active === false ? 'Suspended' : 'Active');
      setAssignedUserIds(allUsers.filter(u => u.org_id === org.id).map(u => u.id));

      setResourcesLoading(true);
      try {
        const res = await adminApi.getOrgResources(org.id);
        if (res.success) {
          setOrgResources(res.data);
        }
      } catch (err) {
        console.error('Failed to load org resources:', err);
      } finally {
        setResourcesLoading(false);
      }
    } else {
      setName('');
      setPhone('');
      setAddress('');
      setType('customer');
      setParentId('');
      setContactPerson('');
      setEmail('');
      setStatus('Active');
      setAssignedUserIds([]);
    }
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name) {
      setModalError('Organization name is required.');
      return;
    }

    const payload = { name, type, address, phone, contactPerson, email, isActive: status === 'Active' };
    if (parentId) payload.parentId = parentId;

    try {
      if (editingOrg) {
        await adminApi.updateOrg(editingOrg.id, payload);
      } else {
        await adminApi.createOrg(payload);
      }
      setModalOpen(false);
      fetchOrgsAndUsers();
    } catch (err) {
      setModalError(err.response?.data?.error || 'Failed to save organization records.');
    }
  };

  const handleDelete = async (org) => {
    if (org.type === 'super') {
      alert('Access Denied: The root platform organization cannot be deleted as it hosts all other accounts and settings.');
      return;
    }
    if (window.confirm('Are you sure you want to completely delete this organization?')) {
      try {
        const response = await adminApi.deleteOrg(org.id);
        if (response.success) fetchOrgsAndUsers();
      } catch (err) {
        alert(err.response?.data?.error || 'Failed to delete organization.');
      }
    }
  };

  const tabs = [
    { id: 'general', label: 'General', icon: Building2 },
    { id: 'users', label: 'Users & Access', icon: Users },
    { id: 'alerts', label: 'Alert Policies', icon: Shield },
    { id: 'geofence', label: 'Geofences', icon: MapPin },
    { id: 'fuel', label: 'Fuel Monitor', icon: Fuel },
    { id: 'advanced', label: 'Advanced', icon: Settings },
  ];

  const filteredUsers = allUsers.filter(u => {
    if (!userSearchQuery) return true;
    const searchLower = userSearchQuery.toLowerCase();
    return (u.name?.toLowerCase().includes(searchLower) || u.email?.toLowerCase().includes(searchLower) || u.org_name?.toLowerCase().includes(searchLower));
  });

  const isAllUsersSelected = filteredUsers.length > 0 && filteredUsers.every(u => assignedUserIds.includes(u.id));

  const handleSelectAllUsers = (e) => {
    if (e.target.checked) {
      const newIds = new Set(assignedUserIds);
      filteredUsers.forEach(u => newIds.add(u.id));
      setAssignedUserIds(Array.from(newIds));
    } else {
      const newIds = new Set(assignedUserIds);
      filteredUsers.forEach(u => newIds.delete(u.id));
      setAssignedUserIds(Array.from(newIds));
    }
  };

  const handleUserCheckboxChange = (id) => {
    if (assignedUserIds.includes(id)) {
      setAssignedUserIds(assignedUserIds.filter(userId => userId !== id));
    } else {
      setAssignedUserIds([...assignedUserIds, id]);
    }
  };

  return (
    <div className="pastel-page-bg" style={{ padding: '32px', minHeight: '100%', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 shrink-0">
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#111827', letterSpacing: '-0.02em' }}>Organizations</h1>
          <p style={{ fontSize: '14px', color: '#6B7280', marginTop: '4px' }}>Manage workspace hierarchies and configuration policies.</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            background: '#f97316', color: '#FFFFFF',
            padding: '10px 20px', borderRadius: '10px',
            fontSize: '14px', fontWeight: 600, border: 'none',
            cursor: 'pointer', boxShadow: '0 4px 12px rgba(249,115,22,0.2)',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 16px rgba(249,115,22,0.3)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(249,115,22,0.2)'; }}
        >
          <Plus size={18} />
          <span>New Organization</span>
        </button>
      </div>

      {/* Main List */}
      <div style={{
        background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0',
        boxShadow: '0 4px 6px rgba(0,0,0,0.02)', overflow: 'hidden', flex: 1
      }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px' }}>
            <Loader2 size={32} color="#f97316" className="animate-spin" />
            <span style={{ fontSize: '14px', color: '#6B7280', marginTop: '12px' }}>Loading organizations...</span>
          </div>
        ) : error ? (
          <div style={{ padding: '40px', textAlign: 'center' }}>
            <AlertTriangle size={32} color="#EF4444" style={{ margin: '0 auto 12px' }} />
            <div style={{ fontSize: '15px', fontWeight: 600, color: '#111827' }}>Failed to Load Records</div>
            <div style={{ fontSize: '13px', color: '#6B7280', marginTop: '4px' }}>{error}</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="pastel-table" style={{ width: '100%', minWidth: '1000px', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                  {['Organization', 'Contact', 'Users', 'Groups', 'Vehicles', 'Devices', 'Status', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '16px 20px', fontSize: '12px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orgs.length === 0 ? (
                  <tr>
                    <td colSpan="8" style={{ padding: '40px', textAlign: 'center' }}>
                      <div style={{ fontSize: '14px', color: '#6B7280', fontWeight: 500 }}>No organizations available</div>
                    </td>
                  </tr>
                ) : orgs.filter(org => org.type !== 'super').map((org) => (
                  <tr key={org.id} style={{ borderBottom: '1px solid #F1F5F9', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <td style={{ padding: '16px 20px' }}>
                      <div 
                        onClick={() => handleOpenModal(org)} 
                        style={{ fontSize: '14px', fontWeight: 700, color: '#111827', cursor: 'pointer', transition: 'color 0.15s' }}
                        onMouseEnter={e => e.currentTarget.style.color = '#f97316'}
                        onMouseLeave={e => e.currentTarget.style.color = '#111827'}
                        title="Click to edit organization"
                      >
                        {org.name}
                      </div>
                      <div style={{ fontSize: '12px', color: '#6B7280', marginTop: '2px', textTransform: 'capitalize' }}>{org.type}</div>
                    </td>
                    <td style={{ padding: '16px 20px' }}>
                      <div style={{ fontSize: '13px', color: '#111827', fontWeight: 600 }}>{org.contact_person || org.primary_user_name || '—'}</div>
                      <div style={{ fontSize: '12px', color: '#6B7280', marginTop: '2px' }}>{org.phone || org.primary_user_phone || '—'}</div>
                      {(org.email || org.primary_user_email) && <div style={{ fontSize: '12px', color: '#6B7280' }}>{org.email || org.primary_user_email}</div>}
                    </td>
                    <td style={{ padding: '16px 20px', fontSize: '14px', fontWeight: 600, color: '#475569' }}>{org.user_count || 0}</td>
                    <td style={{ padding: '16px 20px', fontSize: '14px', fontWeight: 600, color: '#475569' }}>{org.groups_count || 0}</td>
                    <td style={{ padding: '16px 20px', fontSize: '14px', fontWeight: 600, color: '#475569' }}>{org.vehicle_count || 0}</td>
                    <td style={{ padding: '16px 20px', fontSize: '14px', fontWeight: 600, color: '#475569' }}>{org.devices_count || 0}</td>
                    <td style={{ padding: '16px 20px' }}>
                      <span style={{
                        padding: '4px 10px', borderRadius: '99px', fontSize: '11px', fontWeight: 700,
                        background: org.is_active === false ? '#FEE2E2' : '#D1FAE5',
                        color: org.is_active === false ? '#DC2626' : '#059669'
                      }}>
                        {org.is_active === false ? 'Suspended' : 'Active'}
                      </span>
                    </td>
                    <td style={{ padding: '16px 20px' }}>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={() => handleOpenModal(org)} title="Edit Organization" style={{ padding: '6px 10px', background: '#FFF7ED', border: '1px solid #FFEDD5', borderRadius: '6px', color: '#f97316', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 600 }}>
                          <Edit size={14} /> Edit
                        </button>
                        {org.type !== 'super' && parseInt(org.superadmin_count) === 0 && (
                          <button onClick={() => handleDelete(org)} title="Delete Organization" style={{ padding: '6px', background: '#FEF2F2', border: '1px solid #FEE2E2', borderRadius: '6px', color: '#EF4444', cursor: 'pointer' }}><Trash2 size={16} /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>      {/* Enhanced Modal */}
      {modalOpen && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(17,24,39,0.5)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
          padding: '75px 16px 24px 16px', overflowY: 'auto'
        }}>
          <div style={{
            background: '#FFFFFF', borderRadius: '16px', width: '100%', maxWidth: '720px',
            maxHeight: 'calc(100vh - 100px)', display: 'flex', flexDirection: 'column',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
            overflow: 'hidden', margin: '0 auto'
          }}>
            {/* Modal Header */}
            <div className="flex flex-row justify-between items-center gap-4 px-5 py-3 border-b border-slate-200 shrink-0">
              <h2 style={{ fontSize: '16px', fontWeight: 800, color: '#111827' }}>
                {editingOrg ? 'Configure Organization' : 'Create Organization'}
              </h2>
              <button onClick={() => setModalOpen(false)} style={{ background: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: '2px' }}><X size={18} /></button>
            </div>

            {/* Modal Body with Sidebar Tabs */}
            <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
              {/* Sidebar Tabs */}
              <div style={{ width: '180px', borderRight: '1px solid #E2E8F0', background: '#EEF5F8', padding: '10px', flexShrink: 0, overflowY: 'auto' }}>
                {tabs.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: '8px',
                      padding: '8px 10px', borderRadius: '8px',
                      background: activeTab === tab.id ? '#f0f9ff' : 'transparent',
                      color: activeTab === tab.id ? '#f97316' : '#64748B',
                      border: 'none', cursor: 'pointer', textAlign: 'left',
                      fontSize: '12px', fontWeight: activeTab === tab.id ? 700 : 500,
                      marginBottom: '2px', transition: 'all 0.2s'
                    }}
                  >
                    <tab.icon size={15} />
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              <div style={{ flex: 1, minHeight: 0, padding: '16px 20px', overflowY: 'auto' }}>
                {modalError && (
                  <div style={{ padding: '8px 12px', background: '#FEF2F2', color: '#DC2626', borderRadius: '6px', fontSize: '12px', fontWeight: 500, marginBottom: '12px' }}>
                    {modalError}
                  </div>
                )}

                {activeTab === 'general' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {/* Row 1: Org Name + Tenant Type */}
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <div style={{ flex: 2 }}>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '3px' }}>Organization Name *</label>
                        <input type="text" value={name} onChange={e => setName(e.target.value)} style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px', outline: 'none', boxSizing: 'border-box', color: '#111827' }} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '3px' }}>Tenant Type</label>
                        <select value={type} onChange={e => setType(e.target.value)} style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px', outline: 'none', background: '#fff', boxSizing: 'border-box', color: '#111827' }}>
                          <option value="customer">Customer</option>
                          <option value="dealer">Dealer</option>
                          <option value="super">Platform Super</option>
                        </select>
                      </div>
                    </div>

                    {/* Row 2: Status + Email */}
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '3px' }}>Status</label>
                        <select value={status} onChange={e => setStatus(e.target.value)} style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px', outline: 'none', background: '#fff', boxSizing: 'border-box', color: '#111827' }}>
                          <option value="Active">Active</option>
                          <option value="Suspended">Suspended</option>
                        </select>
                      </div>
                      <div style={{ flex: 2 }}>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '3px' }}>Email</label>
                        <input type="email" value={email} onChange={e => setEmail(e.target.value)} style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px', outline: 'none', boxSizing: 'border-box', color: '#111827' }} />
                      </div>
                    </div>

                    {/* Row 3: Contact Person + Mobile Number */}
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '3px' }}>Contact Person</label>
                        <input type="text" value={contactPerson} onChange={e => setContactPerson(e.target.value)} style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px', outline: 'none', boxSizing: 'border-box', color: '#111827' }} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '3px' }}>Mobile Number</label>
                        <input type="text" value={phone} onChange={e => setPhone(e.target.value)} style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px', outline: 'none', boxSizing: 'border-box', color: '#111827' }} />
                      </div>
                    </div>

                    {/* Row 4: Address */}
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '3px' }}>Address</label>
                        <textarea value={address} onChange={e => setAddress(e.target.value)} style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '12px', outline: 'none', height: '55px', resize: 'none', boxSizing: 'border-box', color: '#111827' }} />
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'users' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #E2E8F0', paddingBottom: '10px' }}>
                      <div>
                        <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#111827' }}>Users & Attached Access</h3>
                        <p style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>Users assigned to this organization, their attached groups, and group vehicles.</p>
                      </div>
                      <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 8px', background: '#FFF7ED', color: '#f97316', borderRadius: '12px', border: '1px solid #FFEDD5' }}>
                        {orgResources.length} Users
                      </span>
                    </div>

                    {resourcesLoading ? (
                      <div style={{ padding: '30px', textAlign: 'center' }}>
                        <Loader2 size={24} color="#f97316" className="animate-spin" style={{ margin: '0 auto 8px' }} />
                        <span style={{ fontSize: '12px', color: '#64748B' }}>Loading user and vehicle hierarchy...</span>
                      </div>
                    ) : orgResources.length === 0 ? (
                      <div style={{ padding: '24px', textAlign: 'center', background: '#F8FAFC', borderRadius: '10px', border: '1px dashed #CBD5E1' }}>
                        <Users size={28} color="#94A3B8" style={{ margin: '0 auto 8px' }} />
                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#475569' }}>No users assigned</div>
                        <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px' }}>Assign users to this organization in Users Management to grant access.</div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {orgResources.map((u) => (
                          <div key={u.id} style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
                            {/* User Header */}
                            <div style={{ padding: '10px 12px', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#FFF7ED', color: '#f97316', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '12px', border: '1px solid #FFEDD5' }}>
                                  {u.name ? u.name.charAt(0).toUpperCase() : u.email.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#111827' }}>{u.name || 'Unnamed User'}</div>
                                  <div style={{ fontSize: '11px', color: '#64748B' }}>{u.email} {u.phone ? `• ${u.phone}` : ''}</div>
                                </div>
                              </div>
                              <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', padding: '2px 8px', borderRadius: '4px', background: u.role === 'superadmin' ? '#FEE2E2' : u.role === 'dealer' ? '#FEF3C7' : '#E0F2FE', color: u.role === 'superadmin' ? '#DC2626' : u.role === 'dealer' ? '#D97706' : '#0369A1' }}>
                                {u.role}
                              </span>
                            </div>

                            {/* Groups & Vehicles */}
                            <div style={{ padding: '10px 12px' }}>
                              {!u.groups || u.groups.length === 0 ? (
                                <div style={{ fontSize: '11px', color: '#94A3B8', fontStyle: 'italic' }}>No groups attached to this user.</div>
                              ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                  {u.groups.map(g => (
                                    <div key={g.id} style={{ background: '#F1F5F9', borderRadius: '8px', padding: '8px 10px' }}>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                        <div style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                          <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#f97316' }}></span>
                                          Group: {g.name}
                                        </div>
                                        <span style={{ fontSize: '10px', color: '#64748B', fontWeight: 600 }}>
                                          {g.vehicles?.length || 0} Vehicles
                                        </span>
                                      </div>

                                      {/* Vehicles list inside group */}
                                      {!g.vehicles || g.vehicles.length === 0 ? (
                                        <div style={{ fontSize: '10px', color: '#94A3B8', marginTop: '2px' }}>No vehicles attached to this group.</div>
                                      ) : (
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '6px', marginTop: '6px' }}>
                                          {g.vehicles.map(v => (
                                            <div key={v.id} style={{ background: '#FFFFFF', padding: '6px 8px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                              <Truck size={14} color="#f97316" style={{ shrink: 0 }} />
                                              <div style={{ overflow: 'hidden' }}>
                                                <div style={{ fontWeight: 700, color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v.name}</div>
                                                <div style={{ color: '#64748B', fontSize: '10px' }}>IMEI: {v.imei}</div>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'alerts' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#111827', marginBottom: '4px' }}>Alert Policies</h3>
                    {['Parking Alert', 'Idle Alert', 'Overspeed Alert', 'SOS Alert', 'Harsh Braking Alert', 'Power Disconnect Alert', 'Ignition ON Alert', 'Ignition OFF Alert', 'Route Deviation Alert', 'Tamper Alert', 'Low Battery Alert'].map(item => (
                      <label key={item} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                        <input type="checkbox" defaultChecked style={{ width: '14px', height: '14px', accentColor: '#f97316' }} />
                        <span style={{ fontSize: '12px', color: '#475569', fontWeight: 500 }}>{item}</span>
                      </label>
                    ))}
                  </div>
                )}

                {activeTab === 'geofence' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#111827', marginBottom: '4px' }}>Geofence Configuration</h3>
                    {['Geofence Enabled', 'Entry Alert', 'Exit Alert', 'Geofence Immobilizer'].map(item => (
                      <label key={item} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                        <input type="checkbox" style={{ width: '14px', height: '14px', accentColor: '#f97316' }} />
                        <span style={{ fontSize: '12px', color: '#475569', fontWeight: 500 }}>{item}</span>
                      </label>
                    ))}
                  </div>
                )}

                {activeTab === 'fuel' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#111827', marginBottom: '4px' }}>Fuel Monitoring Status</h3>
                    <div style={{ background: '#EEF5F8', padding: '10px 12px', borderRadius: '8px', border: '1px solid #E2E8F0', marginBottom: '4px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ fontSize: '12px', color: '#64748B', fontWeight: 600 }}>Fuel Sensors Connected:</span>
                        <span style={{ fontSize: '12px', color: '#111827', fontWeight: 800 }}>—</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '12px', color: '#64748B', fontWeight: 600 }}>Fuel Enabled Vehicles:</span>
                        <span style={{ fontSize: '12px', color: '#111827', fontWeight: 800 }}>—</span>
                      </div>
                    </div>
                    {['Fuel Monitoring Enabled', 'Fuel Fill Alert', 'Fuel Theft Alert', 'Low Fuel Alert', 'Fuel Reports Enabled', 'Fuel Sensor Enabled'].map(item => (
                      <label key={item} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                        <input type="checkbox" disabled style={{ width: '14px', height: '14px', accentColor: '#f97316', opacity: 0.5 }} />
                        <span style={{ fontSize: '12px', color: '#94A3B8', fontWeight: 500 }}>{item} (Disabled)</span>
                      </label>
                    ))}
                    <div style={{ marginTop: '6px', fontSize: '11px', color: '#64748B', display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <Radio size={13} color="#f97316" />
                      Module ready for hardware integration.
                    </div>
                  </div>
                )}

                {activeTab === 'advanced' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#111827', marginBottom: '4px' }}>Advanced Settings</h3>
                    {['RFID Enabled', 'Temperature Sensor Enabled', 'Camera Enabled', 'Debug Mode'].map(item => (
                      <label key={item} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'not-allowed' }}>
                        <input type="checkbox" disabled style={{ width: '14px', height: '14px', accentColor: '#f97316', opacity: 0.5 }} />
                        <span style={{ fontSize: '12px', color: '#94A3B8', fontWeight: 500 }}>{item} (Disabled)</span>
                      </label>
                    ))}
                    <div style={{ marginTop: '8px', fontSize: '11px', color: '#64748B', display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <Radio size={13} color="#f97316" />
                      Advanced hardware module planned for next phase release.
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{ padding: '10px 20px', borderTop: '1px solid #E2E8F0', background: '#FAFAF9', display: 'flex', justifyContent: 'flex-end', gap: '10px', shrink: 0 }}>
              <button onClick={() => setModalOpen(false)} style={{ padding: '6px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, color: '#64748B', background: 'transparent', border: '1px solid #CBD5E1', cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleSubmit} style={{ padding: '6px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, color: '#FFFFFF', background: '#f97316', border: 'none', cursor: 'pointer', boxShadow: '0 4px 12px rgba(249,115,22,0.25)' }}>Save Configuration</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrgsAdminPage;
