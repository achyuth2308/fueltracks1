import React, { useState, useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Building2, ArrowLeft, Plus, Edit, Trash2, Loader2, AlertTriangle, X, Settings, Shield, MapPin, Fuel, Radio, Users, Truck, ChevronRight, Bell, Search } from 'lucide-react';
import * as adminApi from '../../api/adminApi';
import { useAuth } from '../../hooks/useAuth';

const OrgsAdminPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  if (user?.role !== 'superadmin' && user?.role !== 'dealer') {
    return <Navigate to="/dashboard" replace />;
  }

  const [orgs, setOrgs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingOrg, setEditingOrg] = useState(null);
  const [activeActionOrgId, setActiveActionOrgId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Close Action dropdown when clicking anywhere outside
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (!e.target.closest('.action-dropdown-container')) {
        setActiveActionOrgId(null);
      }
    };
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, []);

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

  const handleOpenModal = async (org = null, tab = 'general') => {
    setEditingOrg(org);
    setActiveTab(tab);
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
    if (org.type === 'super' || org.id === 'a0000000-0000-0000-0000-000000000001') {
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
    return ((u.name || '').toLowerCase().includes(searchLower) || (u.email || '').toLowerCase().includes(searchLower) || (u.org_name || '').toLowerCase().includes(searchLower));
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

  const visibleOrgs = (Array.isArray(orgs) ? orgs : []).filter(org => {
    if (!org) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    const nameMatch = (org.name || '').toLowerCase().includes(q);
    const emailMatch = (org.email || '').toLowerCase().includes(q);
    const phoneMatch = (org.phone || '').toLowerCase().includes(q);
    const contactMatch = (org.contact_person || '').toLowerCase().includes(q);
    return nameMatch || emailMatch || phoneMatch || contactMatch;
  });

  return (
    <div className="pastel-page-bg" style={{ padding: '32px', minHeight: '100%', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 shrink-0">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            type="button"
            onClick={() => navigate(-1)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              border: '1px solid #CBD5E1',
              background: '#FFFFFF',
              cursor: 'pointer',
              color: '#334155',
              boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#F8FAFC'; e.currentTarget.style.borderColor = '#94A3B8'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#FFFFFF'; e.currentTarget.style.borderColor = '#CBD5E1'; }}
            title="Go Back"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#111827', letterSpacing: '-0.02em', margin: 0 }}>Organizations</h1>
            <p style={{ fontSize: '14px', color: '#6B7280', margin: '4px 0 0 0' }}>Manage workspace hierarchies and configuration policies.</p>
          </div>
        </div>
        <button
          onClick={() => handleOpenModal()}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            background: 'var(--brand-primary, #f97316)', color: '#FFFFFF',
            padding: '10px 20px', borderRadius: '10px',
            fontSize: '14px', fontWeight: 600, border: 'none',
            cursor: 'pointer', boxShadow: '0 4px 12px var(--brand-glow, rgba(249,115,22,0.2))',
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
        boxShadow: '0 4px 6px rgba(0,0,0,0.02)', overflow: 'visible', flex: 1
      }}>
        {/* Search Bar */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
          <div style={{ position: 'relative', width: '100%', maxWidth: '340px' }}>
            <Search style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} size={16} />
            <input
              type="text"
              placeholder="Search organizations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%', padding: '10px 14px 10px 38px',
                borderRadius: '10px', border: '1px solid #CBD5E1',
                fontSize: '14px', outline: 'none', color: '#111827', boxSizing: 'border-box'
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: '2px'
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>
          <div style={{ fontSize: '13px', color: '#64748B', fontWeight: 600 }}>
            {visibleOrgs.length} {visibleOrgs.length === 1 ? 'Organization' : 'Organizations'}
          </div>
        </div>

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
          <div style={{ overflowX: 'auto', minHeight: '320px' }}>
            <table className="pastel-table" style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse', textAlign: 'left', fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
              <colgroup>
                <col style={{ width: '80px' }} />
                <col style={{ width: '60%' }} />
                <col style={{ width: '30%' }} />
              </colgroup>
              <thead>
                <tr style={{ background: 'var(--brand-header, #1e1b4b)', borderBottom: '1px solid #E2E8F0' }}>
                  <th style={{ padding: '8px 10px', fontSize: '11.5px', fontWeight: 800, color: '#FFFFFF', textTransform: 'uppercase', letterSpacing: '0.02em', textAlign: 'center' }}>
                    SNO
                  </th>
                  <th style={{ padding: '8px 10px', fontSize: '11.5px', fontWeight: 800, color: '#FFFFFF', textTransform: 'uppercase', letterSpacing: '0.02em', textAlign: 'left' }}>
                    ORGANIZATION NAME
                  </th>
                  <th style={{ padding: '8px 10px', fontSize: '11.5px', fontWeight: 800, color: '#FFFFFF', textTransform: 'uppercase', letterSpacing: '0.02em', textAlign: 'center' }}>
                    ACTIONS
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibleOrgs.length === 0 ? (
                  <tr>
                    <td colSpan="3" style={{ padding: '40px', textAlign: 'center' }}>
                      <div style={{ fontSize: '13px', color: '#6B7280', fontWeight: 500 }}>{searchQuery.trim() ? `No organizations matching "${searchQuery}"` : 'No organizations available'}</div>
                    </td>
                  </tr>
                ) : visibleOrgs.map((org, index) => (
                  <tr key={org.id} style={{ borderBottom: '1px solid #e0e7ff', height: '38px', transition: 'background 0.15s' }} onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <td style={{ padding: '6px 10px', textAlign: 'center', fontWeight: 700, color: '#000000', fontSize: '12.5px' }}>
                      {index + 1}
                    </td>
                    <td style={{ padding: '6px 10px', textAlign: 'left' }}>
                      <div
                        onClick={() => navigate(`/admin/organizations/edit/${org.id}`)}
                        style={{ fontSize: '12.5px', fontWeight: 700, color: '#000000', cursor: 'pointer', transition: 'color 0.15s', display: 'inline-block' }}
                        onMouseEnter={e => e.currentTarget.style.color = '#f97316'}
                        onMouseLeave={e => e.currentTarget.style.color = '#000000'}
                        title="Click to edit organization"
                      >
                        {org.name}
                      </div>
                    </td>
                    <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                      <div className="action-dropdown-container" style={{ position: 'relative', display: 'inline-block' }}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveActionOrgId(activeActionOrgId === org.id ? null : org.id);
                          }}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '4px',
                            padding: '4px 12px',
                            background: 'var(--brand-primary, #f97316)',
                            color: '#FFFFFF',
                            borderRadius: '6px',
                            fontSize: '11.5px',
                            fontWeight: 700,
                            border: 'none',
                            cursor: 'pointer',
                            boxShadow: '0 2px 6px var(--brand-glow, rgba(249,115,22,0.25))',
                            transition: 'all 0.15s ease'
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.opacity = '0.9';
                            e.currentTarget.style.boxShadow = '0 4px 10px var(--brand-glow, rgba(249,115,22,0.35))';
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.opacity = '1';
                            e.currentTarget.style.boxShadow = '0 2px 6px var(--brand-glow, rgba(249,115,22,0.25))';
                          }}
                        >
                          <span>Actions</span>
                          <span style={{ fontSize: '10px' }}>▸</span>
                        </button>

                        {activeActionOrgId === org.id && (
                          <div
                            style={{
                              position: 'absolute',
                              right: 'calc(100% + 10px)',
                              top: '0',
                              background: '#FFFFFF',
                              borderRadius: '12px',
                              padding: '6px',
                              boxShadow: '0 12px 32px rgba(15, 23, 42, 0.15), 0 4px 10px rgba(15, 23, 42, 0.05)',
                              zIndex: 100,
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '3px',
                              minWidth: '205px',
                              border: '1px solid #E2E8F0',
                              textAlign: 'left'
                            }}
                            onClick={e => e.stopPropagation()}
                          >
                            {/* 1. Edit Organization */}
                            <button
                              type="button"
                              onClick={() => {
                                setActiveActionOrgId(null);
                                navigate(`/admin/organizations/edit/${org.id}`);
                              }}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                width: '100%',
                                padding: '9px 12px',
                                background: 'transparent',
                                color: '#1E293B',
                                border: 'none',
                                borderRadius: '8px',
                                fontSize: '13px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                textAlign: 'left',
                                transition: 'all 0.15s ease',
                                whiteSpace: 'nowrap'
                              }}
                              onMouseEnter={e => {
                                e.currentTarget.style.background = '#FFF7ED';
                                e.currentTarget.style.color = '#EA580C';
                              }}
                              onMouseLeave={e => {
                                e.currentTarget.style.background = 'transparent';
                                e.currentTarget.style.color = '#1E293B';
                              }}
                            >
                              <div style={{
                                width: '28px',
                                height: '28px',
                                borderRadius: '6px',
                                background: '#FFF7ED',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#F97316',
                                flexShrink: 0
                              }}>
                                <Building2 size={15} />
                              </div>
                              <span>Edit Organization</span>
                            </button>

                            {/* 2. Edit Alerts */}
                            <button
                              type="button"
                              onClick={() => {
                                setActiveActionOrgId(null);
                                navigate(`/admin/organizations/alerts/${org.id}`);
                              }}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                width: '100%',
                                padding: '9px 12px',
                                background: 'transparent',
                                color: '#1E293B',
                                border: 'none',
                                borderRadius: '8px',
                                fontSize: '13px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                textAlign: 'left',
                                transition: 'all 0.15s ease',
                                whiteSpace: 'nowrap'
                              }}
                              onMouseEnter={e => {
                                e.currentTarget.style.background = '#EEF2FF';
                                e.currentTarget.style.color = '#4F46E5';
                              }}
                              onMouseLeave={e => {
                                e.currentTarget.style.background = 'transparent';
                                e.currentTarget.style.color = '#1E293B';
                              }}
                            >
                              <div style={{
                                width: '28px',
                                height: '28px',
                                borderRadius: '6px',
                                background: '#EEF2FF',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#4F46E5',
                                flexShrink: 0
                              }}>
                                <Shield size={15} />
                              </div>
                              <span>Edit Alerts</span>
                            </button>

                            {/* 3. Site Notification */}
                            <button
                              type="button"
                              onClick={() => {
                                setActiveActionOrgId(null);
                                navigate(`/admin/organizations/site-notifications/${org.id}`);
                              }}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                width: '100%',
                                padding: '9px 12px',
                                background: 'transparent',
                                color: '#1E293B',
                                border: 'none',
                                borderRadius: '8px',
                                fontSize: '13px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                textAlign: 'left',
                                transition: 'all 0.15s ease',
                                whiteSpace: 'nowrap'
                              }}
                              onMouseEnter={e => {
                                e.currentTarget.style.background = '#F0F9FF';
                                e.currentTarget.style.color = '#0284C7';
                              }}
                              onMouseLeave={e => {
                                e.currentTarget.style.background = 'transparent';
                                e.currentTarget.style.color = '#1E293B';
                              }}
                            >
                              <div style={{
                                width: '28px',
                                height: '28px',
                                borderRadius: '6px',
                                background: '#F0F9FF',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#0284C7',
                                flexShrink: 0
                              }}>
                                <Bell size={15} />
                              </div>
                              <span>Site Notification</span>
                            </button>

                            {/* 4. Organization Track */}
                            <button
                              type="button"
                              onClick={() => {
                                setActiveActionOrgId(null);
                                navigate(`/admin/organizations/track/${org.id}`);
                              }}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                width: '100%',
                                padding: '9px 12px',
                                background: 'transparent',
                                color: '#1E293B',
                                border: 'none',
                                borderRadius: '8px',
                                fontSize: '13px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                textAlign: 'left',
                                transition: 'all 0.15s ease',
                                whiteSpace: 'nowrap'
                              }}
                              onMouseEnter={e => {
                                e.currentTarget.style.background = '#ECFDF5';
                                e.currentTarget.style.color = '#059669';
                              }}
                              onMouseLeave={e => {
                                e.currentTarget.style.background = 'transparent';
                                e.currentTarget.style.color = '#1E293B';
                              }}
                            >
                              <div style={{
                                width: '28px',
                                height: '28px',
                                borderRadius: '6px',
                                background: '#ECFDF5',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#059669',
                                flexShrink: 0
                              }}>
                                <MapPin size={15} />
                              </div>
                              <span>Organization Track</span>
                            </button>

                            <div style={{ height: '1px', background: '#F1F5F9', margin: '4px 0' }} />

                            {/* 5. Delete Organization */}
                            <button
                              type="button"
                              onClick={() => {
                                setActiveActionOrgId(null);
                                handleDelete(org);
                              }}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                width: '100%',
                                padding: '9px 12px',
                                background: 'transparent',
                                color: '#EF4444',
                                border: 'none',
                                borderRadius: '8px',
                                fontSize: '13px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                textAlign: 'left',
                                transition: 'all 0.15s ease',
                                whiteSpace: 'nowrap'
                              }}
                              onMouseEnter={e => {
                                e.currentTarget.style.background = '#FEF2F2';
                                e.currentTarget.style.color = '#DC2626';
                              }}
                              onMouseLeave={e => {
                                e.currentTarget.style.background = 'transparent';
                                e.currentTarget.style.color = '#EF4444';
                              }}
                            >
                              <div style={{
                                width: '28px',
                                height: '28px',
                                borderRadius: '6px',
                                background: '#FEF2F2',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#EF4444',
                                flexShrink: 0
                              }}>
                                <Trash2 size={15} />
                              </div>
                              <span>Delete Organization</span>
                            </button>
                          </div>
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
