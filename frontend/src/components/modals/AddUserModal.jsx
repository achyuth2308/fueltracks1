import React, { useState, useEffect } from 'react';
import { X, Loader2, Search, Cpu } from 'lucide-react';
import * as adminApi from '../../api/adminApi';

const AddUserModal = ({ isOpen, onClose, onSave, editingUser = null, orgs = [] }) => {
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('customer');
  const [orgId, setOrgId] = useState('');
  const [selectedGroups, setSelectedGroups] = useState([]);
  const [availableGroups, setAvailableGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [deviceLimits, setDeviceLimits] = useState({ Starter: 0, Basic: 0, Advanced: 0, Premium: 0 });

  // Extra UI Fields (Frontend only for layout matching)
  const [altEmail, setAltEmail] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [zoho, setZoho] = useState('');
  const [defaultMap, setDefaultMap] = useState('OSM');
  const [enableDebugs, setEnableDebugs] = useState('Disable');
  const [assetUser, setAssetUser] = useState(false);
  const [virtualAccount, setVirtualAccount] = useState(true);
  const [groupSearch, setGroupSearch] = useState('');

  useEffect(() => {
    if (editingUser) {
      setName(editingUser.name || '');
      setUsername(editingUser.username || '');
      setEmail(editingUser.email || '');
      setPhone(editingUser.phone || '');
      setPassword(''); // Password cannot be restored
      setRole(editingUser.role || 'customer');
      setOrgId(editingUser.org_id || '');
      setSelectedGroups(editingUser.groups ? editingUser.groups.map(g => g.id) : []);
      // Reset device limits to zero; they will be loaded below if dealer
      setDeviceLimits({ Starter: 0, Basic: 0, Advanced: 0, Premium: 0 });

      // If editing a dealer, pre-load their CURRENT quota from the API
      // so the admin sees all existing values and only changes what they want
      if (editingUser.role === 'dealer' && editingUser.org_id) {
        adminApi.getDeviceQuota(editingUser.org_id)
          .then(res => {
            if (res.success && res.data?.limits) {
              setDeviceLimits({
                Starter:  res.data.limits.Starter  ?? 0,
                Basic:    res.data.limits.Basic    ?? 0,
                Advanced: res.data.limits.Advanced ?? 0,
                Premium:  res.data.limits.Premium  ?? 0,
              });
            }
          })
          .catch(err => console.warn('Could not load existing device limits:', err.message));
      }
    } else {
      setName('');
      setUsername('');
      setEmail('');
      setPhone('');
      setPassword('');
      setRole('customer');
      setOrgId(orgs.length > 0 ? orgs[0].id : '');
      setSelectedGroups([]);
      setDeviceLimits({ Starter: 0, Basic: 0, Advanced: 0, Premium: 0 });
    }
  }, [editingUser, isOpen, orgs]);

  // Fetch groups based on orgId
  useEffect(() => {
    const fetchGroups = async () => {
      try {
        const response = await adminApi.getGroups();
        if (response.success) {
          setAvailableGroups(response.data);
        }
      } catch (err) {
        console.error('Failed to fetch groups:', err);
      }
    };

    if (isOpen) {
      fetchGroups();
    }
  }, [orgId, editingUser, isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!editingUser && !password) {
      setError('Password is required for new users.');
      return;
    }

    setLoading(true);
    setError(null);

    const payload = {
      name,
      username,
      email,
      phone,
      role,
      orgId,
      groupIds: selectedGroups
    };

    if (password) {
      payload.password = password;
    }

    try {
      await onSave(payload);
      // If role is dealer, also update the device limits for the selected org
      if (role === 'dealer' && orgId) {
        try {
          await adminApi.setDeviceLimits(orgId, deviceLimits);
        } catch (limitErr) {
          console.warn('Device limits update failed (non-critical):', limitErr.message);
        }
      }
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save user details');
    } finally {
      setLoading(false);
    }
  };

  const handleGroupToggle = (groupId) => {
    setSelectedGroups(prev =>
      prev.includes(groupId)
        ? prev.filter(id => id !== groupId)
        : [...prev, groupId]
    );
  };

  const handleSelectAllGroups = (e) => {
    if (e.target.checked) {
      setSelectedGroups(availableGroups.map(g => g.id));
    } else {
      setSelectedGroups([]);
    }
  };

  const filteredGroups = availableGroups.filter(g => g.name.toLowerCase().includes(groupSearch.toLowerCase()));
  const isAllSelected = availableGroups.length > 0 && selectedGroups.length === availableGroups.length;

  if (!isOpen) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifycontent: 'center', justifyContent: 'center', background: 'rgba(17, 24, 39, 0.4)', backdropFilter: 'blur(4px)', padding: '16px' }} onClick={onClose}>
      <div style={{ position: 'relative', width: '100%', maxWidth: '900px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 24px', borderBottom: '1px solid #F1F5F9', background: '#EEF5F8' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 800, color: '#111827', margin: 0 }}>
            {editingUser ? 'Edit User' : 'Create User'}
          </h2>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ flex: 1, overflowY: 'auto', padding: '16px 24px', background: '#FFFFFF', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {error && (
            <div style={{ padding: '10px 14px', fontSize: '13px', fontWeight: 600, background: '#FEF2F2', color: '#DC2626', border: '1px solid #FEE2E2', borderRadius: '8px' }}>
              {error}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px 20px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: '4px' }}>
                User Name<span style={{ color: '#EF4444' }}>*</span>
              </label>
              <input
                type="text" required value={name} onChange={(e) => setName(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', fontSize: '13px', background: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: '8px', color: '#111827', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: '4px' }}>
                Mobile Number<span style={{ color: '#EF4444' }}>*</span>
              </label>
              <input
                type="text" required value={phone} onChange={(e) => setPhone(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', fontSize: '13px', background: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: '8px', color: '#111827', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: '4px' }}>
                Email<span style={{ color: '#EF4444' }}>*</span>
              </label>
              <input
                type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', fontSize: '13px', background: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: '8px', color: '#111827', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: '4px' }}>
                Username (Optional)
              </label>
              <input
                type="text" value={username} onChange={(e) => setUsername(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', fontSize: '13px', background: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: '8px', color: '#111827', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: '4px' }}>
                Alternate Email
              </label>
              <input
                type="email" value={altEmail} onChange={(e) => setAltEmail(e.target.value)} placeholder="Alternate Email"
                style={{ width: '100%', padding: '8px 12px', fontSize: '13px', background: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: '8px', color: '#111827', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: '4px' }}>
                Organization<span style={{ color: '#EF4444' }}>*</span>
              </label>
              <select
                required value={orgId} onChange={(e) => setOrgId(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', fontSize: '13px', background: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: '8px', color: '#111827', outline: 'none', boxSizing: 'border-box' }}
              >
                {orgs.map(org => (
                  <option key={org.id} value={org.id}>{org.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: '4px' }}>
                Role<span style={{ color: '#EF4444' }}>*</span>
              </label>
              <select
                required value={role} onChange={(e) => setRole(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', fontSize: '13px', background: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: '8px', color: '#111827', outline: 'none', boxSizing: 'border-box' }}
              >
                <option value="customer">Customer</option>
                <option value="dealer">Dealer</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: '4px' }}>
                Zoho<span style={{ color: '#EF4444' }}>*</span>
              </label>
              <input
                type="text" value={zoho} onChange={(e) => setZoho(e.target.value)} placeholder="Zoho"
                style={{ width: '100%', padding: '8px 12px', fontSize: '13px', background: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: '8px', color: '#111827', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: '4px' }}>
                Default Map
              </label>
              <select
                value={defaultMap} onChange={(e) => setDefaultMap(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', fontSize: '13px', background: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: '8px', color: '#111827', outline: 'none', boxSizing: 'border-box' }}
              >
                <option value="OSM">OSM</option>
                <option value="Google">Google Maps</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: '4px' }}>
                Enable Debugs
              </label>
              <select
                value={enableDebugs} onChange={(e) => setEnableDebugs(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', fontSize: '13px', background: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: '8px', color: '#111827', outline: 'none', boxSizing: 'border-box' }}
              >
                <option value="Disable">Disable</option>
                <option value="Enable">Enable</option>
              </select>
            </div>

            {!editingUser && (
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: '4px' }}>
                  Password<span style={{ color: '#EF4444' }}>*</span>
                </label>
                <input
                  type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••"
                  style={{ width: '100%', padding: '8px 12px', fontSize: '13px', background: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: '8px', color: '#111827', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
            )}
          </div>

          {/* Device Limits — only shown when Dealer role is selected */}
          {role === 'dealer' && (
            <div style={{ marginTop: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <Cpu size={14} color="#f97316" />
                <label style={{ fontSize: '13px', fontWeight: 700, color: '#3B82F6' }}>
                  Device Allowances (by Tier) :
                </label>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px 20px', padding: '12px', background: '#EEF5F8', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                {['Starter', 'Basic', 'Advanced', 'Premium'].map(tier => (
                  <div key={tier}>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                      {tier} <span style={{ color: '#94A3B8', fontWeight: 'normal' }}>(No. of Devices)</span>
                    </label>
                    <input
                      type="number" min="0"
                      value={deviceLimits[tier]}
                      onChange={e => setDeviceLimits(prev => ({ ...prev, [tier]: parseInt(e.target.value) || 0 }))}
                      style={{ width: '100%', padding: '6px 10px', fontSize: '13px', background: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: '6px', color: '#111827', outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ marginTop: '4px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#3B82F6', marginBottom: '6px' }}>
              User Mode :
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '24px', paddingLeft: '4px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: '#111827' }}>
                <input
                  type="checkbox" checked={assetUser} onChange={(e) => setAssetUser(e.target.checked)}
                  style={{ width: '15px', height: '15px', accentColor: '#3B82F6', cursor: 'pointer' }}
                />
                <span style={{ fontWeight: 500 }}>Asset User</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: '#111827' }}>
                <input
                  type="checkbox" checked={virtualAccount} onChange={(e) => setVirtualAccount(e.target.checked)}
                  style={{ width: '15px', height: '15px', accentColor: '#3B82F6', cursor: 'pointer' }}
                />
                <span style={{ fontWeight: 500 }}>Virtual Account</span>
              </label>
            </div>
          </div>

          {/* Centered Update Button matching the screenshot */}
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '12px', marginBottom: '12px', borderBottom: '1px solid #F1F5F9', paddingBottom: '12px' }}>
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '8px 24px', background: '#3B82F6', color: '#FFFFFF',
                fontSize: '13px', fontWeight: 600, border: 'none', borderRadius: '6px',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
                boxShadow: '0 2px 4px rgba(59, 130, 246, 0.2)'
              }}
            >
              {loading && <Loader2 size={14} className="animate-spin" />}
              {editingUser ? 'Update User' : 'Create User'}
            </button>
          </div>

          {/* Groups Section */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', itemsAlign: 'center', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid #F1F5F9' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, color: '#111827' }}>
                <input
                  type="checkbox" checked={isAllSelected} onChange={handleSelectAllGroups}
                  style={{ width: '15px', height: '15px', accentColor: '#3B82F6', cursor: 'pointer' }}
                />
                <span>Select All Groups</span>
              </label>

              <div style={{ display: 'flex', alignItems: 'center' }}>
                <input
                  type="text" value={groupSearch} onChange={(e) => setGroupSearch(e.target.value)} placeholder="Search..."
                  style={{ width: '200px', padding: '6px 12px', fontSize: '13px', border: '1px solid #CBD5E1', borderTopLeftRadius: '6px', borderBottomLeftRadius: '6px', outline: 'none', color: '#111827', background: '#FFFFFF' }}
                />
                <button type="button" style={{ padding: '7px 12px', background: '#3B82F6', color: '#FFFFFF', border: '1px solid #3B82F6', borderTopRightRadius: '6px', borderBottomRightRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Search size={14} />
                </button>
              </div>
            </div>

            <div>
              <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#111827', margin: '0 0 8px 0' }}>Select the Groups:</h4>
              {filteredGroups.length === 0 ? (
                <div style={{ fontSize: '12px', color: '#94A3B8', fontStyle: 'italic' }}>No groups available in this organization.</div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                  {filteredGroups.map(g => (
                    <label key={g.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12px', color: '#000000' }}>
                      <input
                        type="checkbox" checked={selectedGroups.includes(g.id)} onChange={() => handleGroupToggle(g.id)}
                        style={{ width: '14px', height: '14px', accentColor: '#3B82F6', cursor: 'pointer' }}
                      />
                      <span style={{ fontWeight: 600, textTransform: 'uppercase' }}>{g.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

          </div>
        </form>

      </div>
    </div>
  );
};

export default AddUserModal;
