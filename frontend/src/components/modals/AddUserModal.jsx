import React, { useState, useEffect } from 'react';
import { X, Loader2, Search, Cpu, Eye, EyeOff } from 'lucide-react';
import * as adminApi from '../../api/adminApi';

const AddUserModal = ({ isOpen, onClose, onSave, editingUser = null, orgs = [] }) => {
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('customer');
  const [orgId, setOrgId] = useState('');
  const [selectedGroups, setSelectedGroups] = useState([]);
  const [availableGroups, setAvailableGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [deviceLimits, setDeviceLimits] = useState({ Starter: 0, Basic: 0, Advanced: 0, Premium: 0 });
  const [existingLimits, setExistingLimits] = useState({ Starter: 0, Basic: 0, Advanced: 0, Premium: 0 });
  const [addedLimits, setAddedLimits] = useState({ Starter: 0, Basic: 0, Advanced: 0, Premium: 0 });
  const [quotaMode, setQuotaMode] = useState('add');
  const [isNewOrg, setIsNewOrg] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [autoCreateGroup, setAutoCreateGroup] = useState(false);
  const [noDataMinutes, setNoDataMinutes] = useState(30);

  // Extra UI Fields
  const [altEmail, setAltEmail] = useState('');
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
      setPassword('');
      setShowPassword(false);
      setRole(editingUser.role || 'customer');
      setOrgId(editingUser.org_id || '');
      setSelectedGroups(editingUser.groups ? editingUser.groups.map(g => g.id) : []);
      setNoDataMinutes(editingUser.no_data_minutes !== undefined && editingUser.no_data_minutes !== null ? Number(editingUser.no_data_minutes) : 30);
      if (editingUser.device_limits && typeof editingUser.device_limits === 'object') {
        const cur = {
          Starter: Number(editingUser.device_limits.Starter) || 0,
          Basic: Number(editingUser.device_limits.Basic) || 0,
          Advanced: Number(editingUser.device_limits.Advanced) || 0,
          Premium: Number(editingUser.device_limits.Premium) || 0,
        };
        setExistingLimits(cur);
        setAddedLimits({ Starter: 0, Basic: 0, Advanced: 0, Premium: 0 });
        setDeviceLimits(cur);
        setQuotaMode('add');
      } else {
        setExistingLimits({ Starter: 0, Basic: 0, Advanced: 0, Premium: 0 });
        setAddedLimits({ Starter: 0, Basic: 0, Advanced: 0, Premium: 0 });
        setDeviceLimits({ Starter: 0, Basic: 0, Advanced: 0, Premium: 0 });
        setQuotaMode('add');
      }
    } else {
      setName('');
      setUsername('');
      setEmail('');
      setPhone('');
      setPassword('');
      setShowPassword(false);
      setRole('customer');
      setOrgId('');
      setIsNewOrg(false);
      setNewOrgName('');
      setAutoCreateGroup(false);
      setSelectedGroups([]);
      setDeviceLimits({ Starter: 0, Basic: 0, Advanced: 0, Premium: 0 });
      setNoDataMinutes(30);
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
    if (!username || username.trim() === '') {
      setError('Username is required.');
      return;
    }
    if (!editingUser && !password) {
      setError('Password is required for new users.');
      return;
    }

    if (isNewOrg && !newOrgName.trim()) {
      setError('Please enter a name for the new Organization.');
      return;
    }

    setLoading(true);
    setError(null);

    let finalDeviceLimits = undefined;
    if (role === 'dealer') {
      if (editingUser && quotaMode === 'add') {
        finalDeviceLimits = {
          Starter: Math.max(0, (Number(existingLimits.Starter) || 0) + (parseInt(addedLimits.Starter, 10) || 0)),
          Basic: Math.max(0, (Number(existingLimits.Basic) || 0) + (parseInt(addedLimits.Basic, 10) || 0)),
          Advanced: Math.max(0, (Number(existingLimits.Advanced) || 0) + (parseInt(addedLimits.Advanced, 10) || 0)),
          Premium: Math.max(0, (Number(existingLimits.Premium) || 0) + (parseInt(addedLimits.Premium, 10) || 0)),
        };
      } else {
        finalDeviceLimits = {
          Starter: Math.max(0, parseInt(deviceLimits.Starter, 10) || 0),
          Basic: Math.max(0, parseInt(deviceLimits.Basic, 10) || 0),
          Advanced: Math.max(0, parseInt(deviceLimits.Advanced, 10) || 0),
          Premium: Math.max(0, parseInt(deviceLimits.Premium, 10) || 0),
        };
      }
    }

    const payload = {
      name,
      username,
      email,
      phone,
      role,
      orgId: isNewOrg ? undefined : orgId,
      newOrgName: isNewOrg ? newOrgName.trim() : undefined,
      groupIds: role === 'dealer' ? [] : selectedGroups,
      autoCreateGroup: role === 'dealer' ? false : (selectedGroups.length > 0 ? autoCreateGroup : true),
      noDataMinutes: Number(noDataMinutes) || 30,
      deviceLimits: finalDeviceLimits
    };

    if (password) {
      payload.password = password;
    }

    try {
      await onSave(payload);
      if (role === 'dealer' && orgId) {
        try {
          await adminApi.setDeviceLimits(orgId, finalDeviceLimits);
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
  const selectedGroupsList = filteredGroups.filter(g => selectedGroups.includes(g.id));
  const unselectedGroupsList = filteredGroups.filter(g => !selectedGroups.includes(g.id));
  const isAllSelected = availableGroups.length > 0 && selectedGroups.length === availableGroups.length;

  if (!isOpen) return null;

  const labelStyle = {
    display: 'block',
    fontSize: '11px',
    fontWeight: 700,
    color: '#475569',
    textTransform: 'uppercase',
    marginBottom: '3px',
    letterSpacing: '0.02em'
  };

  const inputStyle = {
    width: '100%',
    height: '34px',
    padding: '0 10px',
    fontSize: '12.5px',
    background: '#FFFFFF',
    border: '1px solid #CBD5E1',
    borderRadius: '6px',
    color: '#111827',
    outline: 'none',
    boxSizing: 'border-box'
  };

  return (
    <div
      className="user-modal-overlay"
      style={{
        position: 'fixed',
        top: '56px',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(17, 24, 39, 0.45)',
        backdropFilter: 'blur(4px)',
        padding: '24px 16px',
        boxSizing: 'border-box'
      }}
      onClick={onClose}
    >
      <div
        className="user-modal-card"
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '620px',
          background: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: '12px',
          boxShadow: '0 20px 40px -12px rgba(0,0,0,0.22)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: 'calc(100vh - 105px)',
          margin: 'auto'
        }}
        onClick={e => e.stopPropagation()}
      >
        <style>{`
          .user-modal-overlay {
            top: 56px !important;
            padding: 24px 16px !important;
          }
          .user-modal-card {
            max-width: 620px;
            width: 100%;
            max-height: calc(100vh - 105px) !important;
          }
          .user-modal-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 8px 14px;
          }
          .user-modal-groups-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 6px 10px;
          }
          @media (max-width: 640px) {
            .user-modal-overlay {
              top: 56px !important;
              padding: 10px 8px !important;
            }
            .user-modal-card {
              max-height: calc(100vh - 78px) !important;
              border-radius: 10px !important;
              max-width: 100% !important;
            }
            .user-modal-header {
              padding: 10px 14px !important;
            }
            .user-modal-body {
              padding: 10px 12px !important;
              gap: 8px !important;
            }
            .user-modal-grid {
              grid-template-columns: 1fr !important;
              gap: 8px !important;
            }
            .user-modal-groups-grid {
              grid-template-columns: repeat(2, 1fr) !important;
              gap: 6px !important;
            }
            .user-modal-groups-bar {
              flex-direction: column !important;
              align-items: stretch !important;
              gap: 8px !important;
            }
            .user-modal-search-wrap {
              width: 100% !important;
            }
            .user-modal-search-input {
              flex: 1 !important;
              width: 100% !important;
            }
          }
          @media (max-width: 420px) {
            .user-modal-groups-grid {
              grid-template-columns: 1fr !important;
            }
          }
        `}</style>

        {/* Header */}
        <div
          className="user-modal-header"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '10px 18px',
            borderBottom: '1px solid #F1F5F9',
            background: '#fff7ed'
          }}
        >
          <h2 style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
            {editingUser ? 'Edit User' : 'Create User'}
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94A3B8',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Form Body */}
        <form
          onSubmit={handleSubmit}
          className="user-modal-body"
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '14px 18px',
            background: '#FFFFFF',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px'
          }}
        >
          {error && (
            <div
              style={{
                padding: '8px 12px',
                fontSize: '12px',
                fontWeight: 600,
                background: '#FEF2F2',
                color: '#DC2626',
                border: '1px solid #FEE2E2',
                borderRadius: '6px'
              }}
            >
              {error}
            </div>
          )}

          <div className="user-modal-grid">
            {/* Customer Name */}
            <div>
              <label style={labelStyle}>
                Customer Name<span style={{ color: '#EF4444' }}>*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={inputStyle}
              />
            </div>

            {/* Mobile Number */}
            <div>
              <label style={labelStyle}>
                Mobile Number<span style={{ color: '#EF4444' }}>*</span>
              </label>
              <input
                type="text"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                style={inputStyle}
              />
            </div>

            {/* Email */}
            <div>
              <label style={labelStyle}>
                Email<span style={{ color: '#EF4444' }}>*</span>
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="off"
                style={inputStyle}
              />
            </div>

            {/* Username */}
            <div>
              <label style={labelStyle}>
                Username<span style={{ color: '#EF4444' }}>*</span>
              </label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="off"
                style={inputStyle}
              />
            </div>

            {/* Alternate Email */}
            <div>
              <label style={labelStyle}>Alternate Email</label>
              <input
                type="email"
                value={altEmail}
                onChange={(e) => setAltEmail(e.target.value)}
                placeholder="Alternate Email"
                style={inputStyle}
              />
            </div>

            {/* Organization */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
                <label style={{ ...labelStyle, marginBottom: 0 }}>
                  Organization<span style={{ color: '#EF4444' }}>*</span>
                </label>
                {!editingUser && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsNewOrg(!isNewOrg);
                      setError(null);
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#ea580c',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      padding: 0
                    }}
                  >
                    {isNewOrg ? '← Existing Org' : '+ Create New Org'}
                  </button>
                )}
              </div>
              {isNewOrg ? (
                <input
                  type="text"
                  required
                  value={newOrgName}
                  onChange={(e) => setNewOrgName(e.target.value)}
                  placeholder="Enter New Org Name"
                  style={{ ...inputStyle, border: '1.5px solid #f97316' }}
                />
              ) : (
                <select
                  value={orgId}
                  onChange={(e) => setOrgId(e.target.value)}
                  style={inputStyle}
                >
                  <option value="">SELECT</option>
                  {orgs && orgs.map(org => (
                    <option key={org.id} value={org.id}>{org.name}</option>
                  ))}
                </select>
              )}
            </div>

            {/* Role */}
            <div>
              <label style={labelStyle}>
                Role<span style={{ color: '#EF4444' }}>*</span>
              </label>
              <select
                required
                value={role}
                onChange={(e) => {
                  const newRole = e.target.value;
                  setRole(newRole);
                  if (newRole === 'dealer') {
                    setSelectedGroups([]);
                    setAutoCreateGroup(false);
                  }
                }}
                style={inputStyle}
              >
                <option value="customer">Customer</option>
                <option value="dealer">Dealer</option>
              </select>
            </div>

            {/* No Data Threshold */}
            <div>
              <label style={labelStyle}>
                No Data Threshold
              </label>
              <select
                value={noDataMinutes}
                onChange={(e) => setNoDataMinutes(Number(e.target.value))}
                style={inputStyle}
              >
                <option value={15}>15 min</option>
                <option value={30}>30 min (Default)</option>
                <option value={60}>1 hr</option>
                <option value={120}>2 hrs</option>
                <option value={180}>3 hrs</option>
                <option value={360}>6 hrs</option>
                <option value={720}>12 hrs</option>
                <option value={1440}>24 hrs</option>
              </select>
            </div>

            {/* Default Map */}
            <div>
              <label style={labelStyle}>Default Map</label>
              <select
                value={defaultMap}
                onChange={(e) => setDefaultMap(e.target.value)}
                style={inputStyle}
              >
                <option value="OSM">OSM</option>
                <option value="Google">Google Maps</option>
              </select>
            </div>

            {/* Enable Debugs */}
            <div>
              <label style={labelStyle}>Enable Debugs</label>
              <select
                value={enableDebugs}
                onChange={(e) => setEnableDebugs(e.target.value)}
                style={inputStyle}
              >
                <option value="Disable">Disable</option>
                <option value="Enable">Enable</option>
              </select>
            </div>

            {/* Password Field - Shown for New User (required) & Edit User (optional) */}
            <div>
              <label style={labelStyle}>
                {editingUser ? 'New Password (leave blank to keep current)' : 'Password'}
                {!editingUser && <span style={{ color: '#EF4444' }}>*</span>}
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required={!editingUser}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={editingUser ? 'Leave blank to keep unchanged' : '••••••••'}
                  autoComplete="new-password"
                  style={{ ...inputStyle, paddingRight: '36px' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: '#94A3B8',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '2px'
                  }}
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
          </div>

          {/* Device Limits — only shown when creating a NEW Dealer role */}
          {role === 'dealer' && (
            <div style={{ marginTop: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Cpu size={13} color="#f97316" />
                  <label style={{ fontSize: '12px', fontWeight: 700, color: '#ea580c' }}>
                    Organization Device Allowances (Quota) :
                  </label>
                </div>
                {editingUser && (
                  <button
                    type="button"
                    onClick={() => setQuotaMode(m => m === 'add' ? 'direct' : 'add')}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#2563eb',
                      fontSize: '11px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      textDecoration: 'underline'
                    }}
                  >
                    {quotaMode === 'add' ? 'Switch to Direct Override' : 'Switch to Add Quota (+0)'}
                  </button>
                )}
              </div>

              {editingUser && quotaMode === 'add' ? (
                /* INCREMENTAL ADD MODE - STARTS FROM 0 AND INSTANTLY CALCULATES NEW TOTAL */
                <div
                  style={{
                    background: '#fff7ed',
                    borderRadius: '8px',
                    border: '1px solid #fed7aa',
                    padding: '12px'
                  }}
                >
                  <div style={{ fontSize: '11px', color: '#9a3412', fontWeight: 600, marginBottom: '8px' }}>
                    Enter additional licenses to add (starts from 0). New total updates live:
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(2, 1fr)',
                      gap: '10px 14px',
                    }}
                  >
                    {['Starter', 'Basic', 'Advanced', 'Premium'].map(tier => {
                      const current = existingLimits[tier] || 0;
                      const added = parseInt(addedLimits[tier]) || 0;
                      const newTotal = current + added;

                      return (
                        <div key={tier} style={{ background: '#ffffff', padding: '8px 10px', borderRadius: '6px', border: '1px solid #ffedd5' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                            <span style={{ fontSize: '11px', fontWeight: 700, color: '#1e293b' }}>
                              {tier}
                            </span>
                            <span style={{ fontSize: '10px', fontWeight: 600, color: '#64748b', background: '#f1f5f9', padding: '1px 6px', borderRadius: '4px' }}>
                              Current: {current}
                            </span>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '12px', fontWeight: 700, color: '#ea580c' }}>+</span>
                            <input
                              type="number"
                              min="0"
                              value={addedLimits[tier]}
                              onChange={e => {
                                const val = e.target.value === '' ? '' : parseInt(e.target.value) || 0;
                                setAddedLimits(prev => ({ ...prev, [tier]: val }));
                              }}
                              style={{ ...inputStyle, height: '28px', fontSize: '12px', flex: 1 }}
                              placeholder="0"
                            />
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px', paddingTop: '4px', borderTop: '1px dashed #fed7aa' }}>
                            <span style={{ fontSize: '10px', color: '#64748b' }}>New Total:</span>
                            <span style={{ fontSize: '11.5px', fontWeight: 800, color: added > 0 ? '#16a34a' : '#0f172a' }}>
                              {newTotal} Devices
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Summary Bar */}
                  <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px solid #fed7aa', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11.5px' }}>
                    <span style={{ color: '#7c2d12', fontWeight: 600 }}>
                      Current: {Object.values(existingLimits).reduce((a, b) => a + (Number(b) || 0), 0)}
                      {' '}+ Adding: {Object.values(addedLimits).reduce((a, b) => a + (parseInt(b) || 0), 0)}
                    </span>
                    <span style={{ fontWeight: 800, color: '#c2410c' }}>
                      Total Quota: {Object.keys(existingLimits).reduce((acc, t) => acc + (existingLimits[t] || 0) + (parseInt(addedLimits[t]) || 0), 0)} Devices
                    </span>
                  </div>
                </div>
              ) : (
                /* DIRECT OVERRIDE / NEW USER MODE */
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: '8px 14px',
                    padding: '10px 12px',
                    background: '#fff7ed',
                    borderRadius: '6px',
                    border: '1px solid #fed7aa'
                  }}
                >
                  {['Starter', 'Basic', 'Advanced', 'Premium'].map(tier => (
                    <div key={tier}>
                      <label style={{ display: 'block', fontSize: '10.5px', fontWeight: 700, color: '#475569', marginBottom: '3px' }}>
                        {tier} <span style={{ color: '#94A3B8', fontWeight: 'normal' }}>(No. of Devices)</span>
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={deviceLimits[tier]}
                        onChange={e => setDeviceLimits(prev => ({ ...prev, [tier]: parseInt(e.target.value) || 0 }))}
                        style={{ ...inputStyle, height: '30px', fontSize: '12px' }}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* User Mode Checkboxes */}
          <div style={{ marginTop: '2px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#ea580c', marginBottom: '4px' }}>
              User Mode :
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', paddingLeft: '2px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '12.5px', color: '#111827' }}>
                <input
                  type="checkbox"
                  checked={assetUser}
                  onChange={(e) => setAssetUser(e.target.checked)}
                  style={{ width: '14px', height: '14px', accentColor: '#f97316', cursor: 'pointer' }}
                />
                <span style={{ fontWeight: 500 }}>Asset User</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '12.5px', color: '#111827' }}>
                <input
                  type="checkbox"
                  checked={virtualAccount}
                  onChange={(e) => setVirtualAccount(e.target.checked)}
                  style={{ width: '14px', height: '14px', accentColor: '#f97316', cursor: 'pointer' }}
                />
                <span style={{ fontWeight: 500 }}>Virtual Account</span>
              </label>
            </div>
          </div>

          {/* Centered Submit Button */}
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '6px', marginBottom: '6px', borderBottom: '1px solid #F1F5F9', paddingBottom: '10px' }}>
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '7px 24px',
                background: '#f97316',
                color: '#FFFFFF',
                fontSize: '12.5px',
                fontWeight: 700,
                border: 'none',
                borderRadius: '6px',
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 2px 6px rgba(249, 115, 22, 0.28)',
                opacity: loading ? 0.75 : 1
              }}
            >
              {loading && <Loader2 size={13} className="animate-spin" />}
              {editingUser ? 'Update User' : 'Create User'}
            </button>
          </div>

          {/* Groups Section */}
          {role === 'dealer' ? (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '40px 20px',
              background: '#F8FAFC',
              borderRadius: '8px',
              border: '1.5px dashed #CBD5E1',
              textAlign: 'center',
              gap: '8px',
            }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>
                Dealer Organization
              </div>
              <div style={{ fontSize: '12px', color: '#64748B', maxWidth: '300px', lineHeight: 1.5 }}>
                Dealers manage their own organizations, fleets, and groups. No operational groups are automatically created or assigned.
              </div>
            </div>
          ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div className="user-modal-groups-bar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '6px', borderBottom: '1px solid #F1F5F9' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '12.5px', fontWeight: 600, color: '#111827' }}>
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  onChange={handleSelectAllGroups}
                  style={{ width: '14px', height: '14px', accentColor: '#f97316', cursor: 'pointer' }}
                />
                <span>Select All Groups</span>
              </label>

              <div className="user-modal-search-wrap" style={{ display: 'flex', alignItems: 'center' }}>
                <input
                  type="text"
                  value={groupSearch}
                  onChange={(e) => setGroupSearch(e.target.value)}
                  placeholder="Search..."
                  className="user-modal-search-input"
                  style={{
                    width: '160px',
                    height: '30px',
                    padding: '0 10px',
                    fontSize: '12px',
                    border: '1px solid #CBD5E1',
                    borderTopLeftRadius: '6px',
                    borderBottomLeftRadius: '6px',
                    outline: 'none',
                    color: '#111827',
                    background: '#FFFFFF',
                    boxSizing: 'border-box'
                  }}
                />
                <button
                  type="button"
                  style={{
                    height: '30px',
                    padding: '0 10px',
                    background: '#f97316',
                    color: '#FFFFFF',
                    border: '1px solid #f97316',
                    borderTopRightRadius: '6px',
                    borderBottomRightRadius: '6px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <Search size={13} />
                </button>
              </div>
            </div>

            {availableGroups.length === 0 ? (
              <div style={{ fontSize: '11.5px', color: '#94A3B8', fontStyle: 'italic', padding: '6px 0' }}>
                No groups available in this organization.
              </div>
            ) : (
              <>
                {/* 1. SELECTED GROUPS (Only shown when at least one group is selected) */}
                {selectedGroupsList.length > 0 && (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                      <h4 style={{ fontSize: '12px', fontWeight: 700, color: '#ea580c', margin: 0 }}>
                        Selected Groups :
                      </h4>
                      <span style={{
                        fontSize: '10.5px',
                        fontWeight: 700,
                        color: '#c2410c',
                        background: '#ffedd5',
                        padding: '1px 7px',
                        borderRadius: '10px'
                      }}>
                        {selectedGroupsList.length}
                      </span>
                    </div>

                    <div className="user-modal-groups-grid">
                      {selectedGroupsList.map(g => (
                        <label
                          key={g.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '5px 8px',
                            background: '#fff7ed',
                            border: '1px solid #fed7aa',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '11.5px',
                            userSelect: 'none'
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={true}
                            onChange={() => handleGroupToggle(g.id)}
                            style={{ width: '13px', height: '13px', accentColor: '#f97316', cursor: 'pointer' }}
                          />
                          <span style={{ fontWeight: 700, color: '#9a3412', textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {g.name}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* 2. UNSELECTED GROUPS */}
                <div style={{ marginTop: selectedGroupsList.length > 0 ? '6px' : '0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                    <h4 style={{ fontSize: '12px', fontWeight: 700, color: '#475569', margin: 0 }}>
                      Unselected Groups :
                    </h4>
                    <span style={{
                      fontSize: '10.5px',
                      fontWeight: 700,
                      color: '#475569',
                      background: '#f1f5f9',
                      padding: '1px 7px',
                      borderRadius: '10px'
                    }}>
                      {unselectedGroupsList.length}
                    </span>
                  </div>

                  {unselectedGroupsList.length === 0 ? (
                    <div style={{
                      padding: '8px 12px',
                      background: '#f8fafc',
                      borderRadius: '6px',
                      border: '1px dashed #cbd5e1',
                      color: '#64748b',
                      fontSize: '11.5px',
                      fontStyle: 'italic'
                    }}>
                      All available groups are currently selected.
                    </div>
                  ) : (
                    <div className="user-modal-groups-grid">
                      {unselectedGroupsList.map(g => (
                        <label
                          key={g.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '5px 8px',
                            background: '#FFFFFF',
                            border: '1px solid #E2E8F0',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '11.5px',
                            userSelect: 'none'
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={false}
                            onChange={() => handleGroupToggle(g.id)}
                            style={{ width: '13px', height: '13px', accentColor: '#f97316', cursor: 'pointer' }}
                          />
                          <span style={{ fontWeight: 600, color: '#334155', textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {g.name}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
          )}
        </form>
      </div>
    </div>
  );
};

export default AddUserModal;
