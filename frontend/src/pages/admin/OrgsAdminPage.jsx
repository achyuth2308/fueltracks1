import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { Building2, Plus, Edit, Trash2, Loader2, AlertTriangle, X, Settings, Shield, Bell, MapPin, Fuel, Radio } from 'lucide-react';
import * as adminApi from '../../api/adminApi';
import { useAuth } from '../../hooks/useAuth';

const OrgsAdminPage = () => {
  const { user } = useAuth();

  if (user?.role !== 'superadmin') {
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

  const [modalError, setModalError] = useState(null);

  const fetchOrgs = async () => {
    setLoading(true);
    try {
      const response = await adminApi.getOrgs();
      if (response.success) {
        setOrgs(response.data);
      }
    } catch (err) {
      setError('Failed to fetch organization records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrgs();
  }, []);

  const handleOpenModal = (org = null) => {
    setEditingOrg(org);
    setActiveTab('general');
    setModalError(null);

    if (org) {
      setName(org.name || '');
      setPhone(org.phone || '');
      setAddress(org.address || '');
      setType(org.type || 'customer');
      setParentId(org.parent_id || '');
      setContactPerson(org.contact_person || '');
      setEmail(org.email || '');
      setStatus(org.is_active === false ? 'Suspended' : 'Active');
    } else {
      setName('');
      setPhone('');
      setAddress('');
      setType('customer');
      setParentId('');
      setContactPerson('');
      setEmail('');
      setStatus('Active');
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

    // In a real app we'd pass all the tab settings to the API, 
    // but we can't change backend API. We send what it accepts.

    try {
      if (editingOrg) {
        await adminApi.updateOrg(editingOrg.id, payload);
      } else {
        await adminApi.createOrg(payload);
      }
      setModalOpen(false);
      fetchOrgs();
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
        if (response.success) fetchOrgs();
      } catch (err) {
        alert(err.response?.data?.error || 'Failed to delete organization.');
      }
    }
  };

  const tabs = [
    { id: 'general', label: 'General', icon: Building2 },
    { id: 'alerts', label: 'Alert Policies', icon: Shield },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'geofence', label: 'Geofences', icon: MapPin },
    { id: 'fuel', label: 'Fuel Monitor', icon: Fuel },
    { id: 'advanced', label: 'Advanced', icon: Settings },
  ];

  return (
    <div style={{ padding: '32px', background: 'linear-gradient(to bottom, #f5efe4 0%, #f5efe4 50%, #F8FAFC 50%, #F8FAFC 100%)', minHeight: '100%', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#111827', letterSpacing: '-0.02em' }}>Organizations</h1>
          <p style={{ fontSize: '14px', color: '#6B7280', marginTop: '4px' }}>Manage workspace hierarchies and configuration policies.</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            background: '#8ba0b5', color: '#FFFFFF',
            padding: '10px 20px', borderRadius: '10px',
            fontSize: '14px', fontWeight: 600, border: 'none',
            cursor: 'pointer', boxShadow: '0 4px 12px rgba(139,160,181,0.2)',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 16px rgba(139,160,181,0.3)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(139,160,181,0.2)'; }}
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
            <Loader2 size={32} color="#8ba0b5" className="animate-spin" />
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
            <table style={{ w: '100%', minWidth: '1000px', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#f5efe4', borderBottom: '1px solid #E2E8F0' }}>
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
                  <tr key={org.id} style={{ borderBottom: '1px solid #F1F5F9', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = '#f5efe4'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <td style={{ padding: '16px 20px' }}>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: '#111827' }}>{org.name}</div>
                      <div style={{ fontSize: '12px', color: '#6B7280', marginTop: '2px', textTransform: 'capitalize' }}>{org.type}</div>
                    </td>
                    <td style={{ padding: '16px 20px' }}>
                      <div style={{ fontSize: '13px', color: '#111827', fontWeight: 600 }}>{org.contact_person || '—'}</div>
                      <div style={{ fontSize: '12px', color: '#6B7280', marginTop: '2px' }}>{org.phone || '—'}</div>
                      {org.email && <div style={{ fontSize: '12px', color: '#6B7280' }}>{org.email}</div>}
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
                        <button onClick={() => handleOpenModal(org)} style={{ padding: '6px', background: '#F1F5F9', border: 'none', borderRadius: '6px', color: '#64748B', cursor: 'pointer' }}><Edit size={16} /></button>
                        {org.type !== 'super' && (
                          <button onClick={() => handleDelete(org)} style={{ padding: '6px', background: '#FEF2F2', border: 'none', borderRadius: '6px', color: '#EF4444', cursor: 'pointer' }}><Trash2 size={16} /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Enhanced Modal */}
      {modalOpen && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100,
          background: 'rgba(17,24,39,0.4)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px'
        }}>
          <div style={{
            background: '#FFFFFF', borderRadius: '20px', width: '100%', maxWidth: '800px',
            maxHeight: '90vh', display: 'flex', flexDirection: 'column',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
            overflow: 'hidden'
          }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid #E2E8F0' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#111827' }}>
                {editingOrg ? 'Configure Organization' : 'Create Organization'}
              </h2>
              <button onClick={() => setModalOpen(false)} style={{ background: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer' }}><X size={20} /></button>
            </div>

            {/* Modal Body with Sidebar Tabs */}
            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
              {/* Sidebar Tabs */}
              <div style={{ width: '220px', borderRight: '1px solid #E2E8F0', background: '#f5efe4', padding: '16px' }}>
                {tabs.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
                      padding: '12px 14px', borderRadius: '10px',
                      background: activeTab === tab.id ? '#f5efe4' : 'transparent',
                      color: activeTab === tab.id ? '#8ba0b5' : '#64748B',
                      border: 'none', cursor: 'pointer', textAlign: 'left',
                      fontSize: '13px', fontWeight: activeTab === tab.id ? 700 : 500,
                      marginBottom: '4px', transition: 'all 0.2s'
                    }}
                  >
                    <tab.icon size={16} />
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              <div style={{ flex: 1, padding: '24px', overflowY: 'auto' }}>
                {modalError && (
                  <div style={{ padding: '12px', background: '#FEF2F2', color: '#DC2626', borderRadius: '8px', fontSize: '13px', fontWeight: 500, marginBottom: '20px' }}>
                    {modalError}
                  </div>
                )}

                {activeTab === 'general' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '8px' }}>Organization Name *</label>
                      <input type="text" value={name} onChange={e => setName(e.target.value)} style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '14px', outline: 'none', boxSizing: 'border-box', color: '#111827' }} />
                    </div>
                    <div style={{ display: 'flex', gap: '16px' }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '8px' }}>Tenant Type</label>
                        <select value={type} onChange={e => setType(e.target.value)} style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '14px', outline: 'none', background: '#fff', boxSizing: 'border-box', color: '#111827' }}>
                          <option value="customer">Customer</option>
                          <option value="dealer">Dealer</option>
                          <option value="super">Platform Super</option>
                        </select>
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '8px' }}>Status</label>
                        <select value={status} onChange={e => setStatus(e.target.value)} style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '14px', outline: 'none', background: '#fff', boxSizing: 'border-box', color: '#111827' }}>
                          <option value="Active">Active</option>
                          <option value="Suspended">Suspended</option>
                        </select>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '16px' }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '8px' }}>Contact Person</label>
                        <input type="text" value={contactPerson} onChange={e => setContactPerson(e.target.value)} style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '14px', outline: 'none', boxSizing: 'border-box', color: '#111827' }} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '8px' }}>Mobile Number</label>
                        <input type="text" value={phone} onChange={e => setPhone(e.target.value)} style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '14px', outline: 'none', boxSizing: 'border-box', color: '#111827' }} />
                      </div>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '8px' }}>Email</label>
                      <input type="email" value={email} onChange={e => setEmail(e.target.value)} style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '14px', outline: 'none', boxSizing: 'border-box', color: '#111827' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '8px' }}>Address</label>
                      <textarea value={address} onChange={e => setAddress(e.target.value)} style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '14px', outline: 'none', height: '60px', resize: 'none', boxSizing: 'border-box', color: '#111827' }} />
                    </div>
                  </div>
                )}

                {activeTab === 'alerts' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#111827', marginBottom: '8px' }}>Alert Policies</h3>
                    {['Parking Alert', 'Idle Alert', 'Overspeed Alert', 'SOS Alert', 'Harsh Braking Alert', 'Power Disconnect Alert', 'Ignition ON Alert', 'Ignition OFF Alert', 'Route Deviation Alert', 'Tamper Alert', 'Low Battery Alert'].map(item => (
                      <label key={item} style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
                        <input type="checkbox" defaultChecked style={{ width: '16px', height: '16px', accentColor: '#8ba0b5' }} />
                        <span style={{ fontSize: '14px', color: '#475569', fontWeight: 500 }}>{item}</span>
                      </label>
                    ))}
                  </div>
                )}

                {activeTab === 'notifications' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#111827', marginBottom: '8px' }}>Notification Channels</h3>
                    {['SMS Notifications', 'Email Notifications', 'WhatsApp Notifications', 'Telegram Notifications'].map(item => (
                      <label key={item} style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
                        <input type="checkbox" style={{ width: '16px', height: '16px', accentColor: '#8ba0b5' }} />
                        <span style={{ fontSize: '14px', color: '#475569', fontWeight: 500 }}>{item}</span>
                      </label>
                    ))}
                    <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: '16px', marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '8px' }}>Notification Mobile Number</label>
                        <input type="text" placeholder="+1 234 567 8900" style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '14px', outline: 'none', boxSizing: 'border-box', color: '#111827' }} />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '8px' }}>Notification Email</label>
                        <input type="email" placeholder="alerts@organization.com" style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '14px', outline: 'none', boxSizing: 'border-box', color: '#111827' }} />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '8px' }}>WhatsApp Number</label>
                        <input type="text" placeholder="+1 234 567 8900" style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '14px', outline: 'none', boxSizing: 'border-box', color: '#111827' }} />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '8px' }}>Telegram Chat ID</label>
                        <input type="text" placeholder="@org_alerts" style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '14px', outline: 'none', boxSizing: 'border-box', color: '#111827' }} />
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'geofence' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#111827', marginBottom: '8px' }}>Geofence Configuration</h3>
                    {['Geofence Enabled', 'Entry Alert', 'Exit Alert', 'Geofence Immobilizer'].map(item => (
                      <label key={item} style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
                        <input type="checkbox" style={{ width: '16px', height: '16px', accentColor: '#8ba0b5' }} />
                        <span style={{ fontSize: '14px', color: '#475569', fontWeight: 500 }}>{item}</span>
                      </label>
                    ))}
                  </div>
                )}

                {activeTab === 'fuel' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#111827', marginBottom: '8px' }}>Fuel Monitoring Status</h3>
                    <div style={{ background: '#f5efe4', padding: '16px', borderRadius: '12px', border: '1px solid #E2E8F0', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span style={{ fontSize: '13px', color: '#64748B', fontWeight: 600 }}>Fuel Sensors Connected:</span>
                        <span style={{ fontSize: '13px', color: '#111827', fontWeight: 800 }}>—</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '13px', color: '#64748B', fontWeight: 600 }}>Fuel Enabled Vehicles:</span>
                        <span style={{ fontSize: '13px', color: '#111827', fontWeight: 800 }}>—</span>
                      </div>
                    </div>
                    {['Fuel Monitoring Enabled', 'Fuel Fill Alert', 'Fuel Theft Alert', 'Low Fuel Alert', 'Fuel Reports Enabled', 'Fuel Sensor Enabled'].map(item => (
                      <label key={item} style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
                        <input type="checkbox" disabled style={{ width: '16px', height: '16px', accentColor: '#8ba0b5', opacity: 0.5 }} />
                        <span style={{ fontSize: '14px', color: '#94A3B8', fontWeight: 500 }}>{item} (Disabled)</span>
                      </label>
                    ))}
                    <div style={{ marginTop: '12px', fontSize: '12px', color: '#64748B', display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <Radio size={14} color="#8ba0b5" />
                      Module ready for hardware integration.
                    </div>
                  </div>
                )}

                {activeTab === 'advanced' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#111827', marginBottom: '8px' }}>Advanced Settings</h3>
                    {['RFID Enabled', 'Temperature Sensor Enabled', 'Camera Enabled', 'Debug Mode'].map(item => (
                      <label key={item} style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
                        <input type="checkbox" style={{ width: '16px', height: '16px', accentColor: '#8ba0b5' }} />
                        <span style={{ fontSize: '14px', color: '#475569', fontWeight: 500 }}>{item}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{ padding: '20px 24px', borderTop: '1px solid #E2E8F0', background: '#FAFAF9', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button onClick={() => setModalOpen(false)} style={{ padding: '10px 20px', borderRadius: '10px', fontSize: '14px', fontWeight: 600, color: '#64748B', background: 'transparent', border: '1px solid #CBD5E1', cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleSubmit} style={{ padding: '10px 20px', borderRadius: '10px', fontSize: '14px', fontWeight: 600, color: '#FFFFFF', background: '#8ba0b5', border: 'none', cursor: 'pointer', boxShadow: '0 4px 12px rgba(139,160,181,0.2)' }}>Save Configuration</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrgsAdminPage;
