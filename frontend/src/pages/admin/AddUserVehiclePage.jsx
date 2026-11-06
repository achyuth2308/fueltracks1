import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Home, ChevronRight, Loader2, AlertTriangle, CheckCircle } from 'lucide-react';
import * as vehicleApi from '../../api/vehicleApi';
import * as adminApi from '../../api/adminApi';
import FuelTracksSelect from '../../components/ui/FuelTracksSelect';

const AddUserVehiclePage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [vehicle, setVehicle] = useState(null);

  // Mode: 'new' or 'existing' (default to 'new' when requested, or toggleable)
  const [userType, setUserType] = useState('new');

  // Lists
  const [organizations, setOrganizations] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [allGroups, setAllGroups] = useState([]);

  // Existing User form fields
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [selectedOrgId, setSelectedOrgId] = useState('');

  // New User form fields (Exact 4 fields matching screenshot)
  const [userName, setUserName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Load initial vehicle and data
  useEffect(() => {
    const initData = async () => {
      setLoading(true);
      setError('');
      try {
        const [orgsRes, usersRes, groupsRes] = await Promise.all([
          adminApi.getOrgs().catch(() => ({ data: [] })),
          adminApi.getUsers().catch(() => ({ data: [] })),
          adminApi.getGroups().catch(() => ({ data: [] }))
        ]);

        const orgList = orgsRes?.data || (Array.isArray(orgsRes) ? orgsRes : []);
        const userList = usersRes?.data || (Array.isArray(usersRes) ? usersRes : []);
        const groupList = groupsRes?.data || (Array.isArray(groupsRes) ? groupsRes : []);

        setOrganizations(orgList);
        setAllUsers(userList);
        setAllGroups(groupList);

        if (id) {
          const vRes = await vehicleApi.getVehicleById(id);
          const v = vRes?.data || vRes;
          setVehicle(v);

          // Pre-select vehicle's organization
          if (v?.org_id) {
            setSelectedOrgId(v.org_id);
          } else if (orgList.length > 0) {
            setSelectedOrgId(orgList[0].id);
          }
        } else if (orgList.length > 0) {
          setSelectedOrgId(orgList[0].id);
        }
      } catch (err) {
        console.error('Failed to load data for Add User page:', err);
        setError('Failed to load vehicle or directory data.');
      } finally {
        setLoading(false);
      }
    };

    initData();
  }, [id]);

  // Filter users by selected organization
  const filteredUsers = allUsers.filter(u => {
    if (!selectedOrgId) return true;
    return u.org_id === selectedOrgId;
  });

  // Filter groups by selected organization
  const filteredGroups = allGroups.filter(g => {
    if (!selectedOrgId) return true;
    return g.org_id === selectedOrgId;
  });

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setError('');
    setSuccess('');

    if (userType === 'existing') {
      if (!selectedUserId) {
        setError('Please select a User Name.');
        return;
      }
    } else {
      if (!userName.trim()) {
        setError('Please enter User Name.');
        return;
      }
      if (!password.trim()) {
        setError('Please enter Password.');
        return;
      }
    }

    setSubmitting(true);
    try {
      const payload = {
        isNewUser: userType === 'new',
        orgId: userType === 'new' ? null : (selectedOrgId || vehicle?.org_id || null),
        groupId: userType === 'new' ? null : (selectedGroupId || null),
        userId: selectedUserId || null,
        name: userName.trim(),
        username: userName.trim(),
        email: email.trim() || `${userName.trim().toLowerCase().replace(/[^a-z0-9]/g, '')}@fueltracks.com`,
        phone: mobileNumber.trim(),
        password: password,
        role: 'customer'
      };

      if (id) {
        await vehicleApi.addUserToVehicle(id, payload);
      } else if (userType === 'new') {
        await adminApi.createUser({
          name: userName.trim(),
          username: userName.trim(),
          email: email.trim() || `${userName.trim().toLowerCase().replace(/[^a-z0-9]/g, '')}@fueltracks.com`,
          phone: mobileNumber.trim(),
          password: password,
          role: 'customer',
          autoCreateGroup: true
        });
      }

      setSuccess(userType === 'new' ? 'New user created and attached successfully!' : 'User attached to vehicle successfully!');
      setTimeout(() => {
        navigate('/admin/vehicles');
      }, 1500);
    } catch (err) {
      console.error('Submit error:', err);
      setError(err.response?.data?.error || err.message || 'Failed to submit user assignment.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '12px' }}>
        <Loader2 size={36} className="animate-spin" color="#f97316" />
        <span style={{ fontSize: '14px', color: '#64748b', fontWeight: 600 }}>Loading Add User...</span>
      </div>
    );
  }

  const displayVehicleId = vehicle?.plate || vehicle?.name || vehicle?.imei || '125KVADGNEC_00135';

  return (
    <div className="pastel-page-bg" style={{ padding: '32px', minHeight: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
      <div style={{ maxWidth: '1150px', width: '100%', margin: '0 auto' }}>

        {/* Top Header & Breadcrumb Bar (Matching Screenshot structure with FuelTracks UI styling) */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '18px',
          marginBottom: '24px',
          flexWrap: 'wrap'
        }}>
          <h1 style={{
            fontSize: '24px',
            fontWeight: 800,
            color: '#0f172a',
            letterSpacing: '-0.02em',
            margin: 0
          }}>
            Add User
          </h1>

          <div style={{ width: '1px', height: '22px', background: '#cbd5e1' }} />

          {/* Breadcrumb line */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#64748b' }}>
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center' }}
              title="Dashboard"
            >
              <Home size={15} />
            </button>
            <ChevronRight size={13} color="#94a3b8" />
            <button
              type="button"
              onClick={() => navigate('/admin/vehicles')}
              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#64748b', fontWeight: 500 }}
            >
              Vehicle list
            </button>
            <ChevronRight size={13} color="#94a3b8" />
            <span style={{ color: '#ea580c', fontWeight: 700 }}>{displayVehicleId}</span>
          </div>
        </div>

        {/* Status Alerts */}
        {error && (
          <div style={{
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '10px',
            padding: '12px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            color: '#dc2626',
            fontSize: '13.5px',
            fontWeight: 600,
            marginBottom: '18px',
            boxShadow: '0 2px 6px rgba(220, 38, 38, 0.06)'
          }}>
            <AlertTriangle size={18} />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div style={{
            background: '#f0fdf4',
            border: '1px solid #bbf7d0',
            borderRadius: '10px',
            padding: '12px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            color: '#16a34a',
            fontSize: '13.5px',
            fontWeight: 600,
            marginBottom: '18px',
            boxShadow: '0 2px 6px rgba(22, 163, 74, 0.06)'
          }}>
            <CheckCircle size={18} />
            <span>{success}</span>
          </div>
        )}

        {/* Main Card (FuelTracks Theme & Clean Modern Styling) */}
        <div style={{
          background: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 4px 16px rgba(15, 23, 42, 0.04)',
          overflow: 'hidden'
        }}>
          {/* Radio Buttons Row at Top (New User | Existing User) */}
          <div style={{
            padding: '24px 32px 20px 32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '64px',
            borderBottom: '1px solid #f1f5f9'
          }}>
            <label style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '10px',
              fontSize: '14.5px',
              fontWeight: 600,
              color: userType === 'new' ? '#0f172a' : '#64748b',
              cursor: 'pointer',
              userSelect: 'none'
            }}>
              <input
                type="radio"
                name="userType"
                value="new"
                checked={userType === 'new'}
                onChange={() => setUserType('new')}
                style={{
                  accentColor: '#f97316',
                  width: '18px',
                  height: '18px',
                  cursor: 'pointer'
                }}
              />
              <span>New User</span>
            </label>

            <label style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '10px',
              fontSize: '14.5px',
              fontWeight: 600,
              color: userType === 'existing' ? '#0f172a' : '#64748b',
              cursor: 'pointer',
              userSelect: 'none'
            }}>
              <input
                type="radio"
                name="userType"
                value="existing"
                checked={userType === 'existing'}
                onChange={() => setUserType('existing')}
                style={{
                  accentColor: '#f97316',
                  width: '18px',
                  height: '18px',
                  cursor: 'pointer'
                }}
              />
              <span>Existing User</span>
            </label>
          </div>

          {/* Form Content */}
          <form onSubmit={handleSubmit} style={{ padding: '40px 36px 48px 36px' }}>

            {/* NEW USER MODE (Matching Screenshot: User Name, Mobile Number, Email, Password in 2x2 grid) */}
            {userType === 'new' && (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: '24px 32px',
                marginBottom: '38px'
              }}>
                {/* Row 1, Col 1: User Name */}
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: 700, color: '#334155', marginBottom: '8px' }}>
                    User Name
                  </label>
                  <input
                    type="text"
                    value={userName}
                    onChange={e => setUserName(e.target.value)}
                    placeholder="User Name"
                    style={{
                      width: '100%',
                      height: '42px',
                      padding: '0 16px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      background: '#ffffff',
                      fontSize: '14px',
                      fontWeight: 500,
                      color: '#0f172a',
                      outline: 'none',
                      boxSizing: 'border-box',
                      transition: 'border-color 0.15s ease, box-shadow 0.15s ease'
                    }}
                    onFocus={e => {
                      e.target.style.borderColor = '#f97316';
                      e.target.style.boxShadow = '0 0 0 3px rgba(249, 115, 22, 0.15)';
                    }}
                    onBlur={e => {
                      e.target.style.borderColor = '#cbd5e1';
                      e.target.style.boxShadow = 'none';
                    }}
                  />
                </div>

                {/* Row 1, Col 2: Mobile Number */}
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: 700, color: '#334155', marginBottom: '8px' }}>
                    Mobile Number
                  </label>
                  <input
                    type="text"
                    value={mobileNumber}
                    onChange={e => setMobileNumber(e.target.value)}
                    placeholder="Mobile Number"
                    style={{
                      width: '100%',
                      height: '42px',
                      padding: '0 16px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      background: '#ffffff',
                      fontSize: '14px',
                      fontWeight: 500,
                      color: '#0f172a',
                      outline: 'none',
                      boxSizing: 'border-box',
                      transition: 'border-color 0.15s ease, box-shadow 0.15s ease'
                    }}
                    onFocus={e => {
                      e.target.style.borderColor = '#f97316';
                      e.target.style.boxShadow = '0 0 0 3px rgba(249, 115, 22, 0.15)';
                    }}
                    onBlur={e => {
                      e.target.style.borderColor = '#cbd5e1';
                      e.target.style.boxShadow = 'none';
                    }}
                  />
                </div>

                {/* Row 2, Col 1: Email */}
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: 700, color: '#334155', marginBottom: '8px' }}>
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="Email"
                    style={{
                      width: '100%',
                      height: '42px',
                      padding: '0 16px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      background: '#ffffff',
                      fontSize: '14px',
                      fontWeight: 500,
                      color: '#0f172a',
                      outline: 'none',
                      boxSizing: 'border-box',
                      transition: 'border-color 0.15s ease, box-shadow 0.15s ease'
                    }}
                    onFocus={e => {
                      e.target.style.borderColor = '#f97316';
                      e.target.style.boxShadow = '0 0 0 3px rgba(249, 115, 22, 0.15)';
                    }}
                    onBlur={e => {
                      e.target.style.borderColor = '#cbd5e1';
                      e.target.style.boxShadow = 'none';
                    }}
                  />
                </div>

                {/* Row 2, Col 2: Password */}
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: 700, color: '#334155', marginBottom: '8px' }}>
                    Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Password"
                    style={{
                      width: '100%',
                      height: '42px',
                      padding: '0 16px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      background: '#ffffff',
                      fontSize: '14px',
                      fontWeight: 500,
                      color: '#0f172a',
                      outline: 'none',
                      boxSizing: 'border-box',
                      transition: 'border-color 0.15s ease, box-shadow 0.15s ease'
                    }}
                    onFocus={e => {
                      e.target.style.borderColor = '#f97316';
                      e.target.style.boxShadow = '0 0 0 3px rgba(249, 115, 22, 0.15)';
                    }}
                    onBlur={e => {
                      e.target.style.borderColor = '#cbd5e1';
                      e.target.style.boxShadow = 'none';
                    }}
                  />
                </div>
              </div>
            )}

            {/* EXISTING USER MODE (Matching Screenshot 3-column layout) */}
            {userType === 'existing' && (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: '24px',
                marginBottom: '40px'
              }}>
                {/* 1. User Name */}
                <div>
                  <label style={{ display: 'block', fontSize: '13.5px', fontWeight: 700, color: '#334155', marginBottom: '8px' }}>
                    User Name
                  </label>
                  <FuelTracksSelect
                    value={selectedUserId}
                    onChange={setSelectedUserId}
                    placeholder="select user"
                    searchable={true}
                    searchPlaceholder="Search User..."
                    options={[
                      { value: '', label: 'select user' },
                      ...filteredUsers.map(u => ({
                        value: u.id,
                        label: `${u.name || u.username || u.email}${u.phone ? ` (${u.phone})` : ''}`
                      }))
                    ]}
                  />
                </div>

                {/* 2. Group Name */}
                <div>
                  <label style={{ display: 'block', fontSize: '13.5px', fontWeight: 700, color: '#334155', marginBottom: '8px' }}>
                    Group Name
                  </label>
                  <FuelTracksSelect
                    value={selectedGroupId}
                    onChange={setSelectedGroupId}
                    placeholder="select group"
                    searchable={true}
                    searchPlaceholder="Search Group..."
                    options={[
                      { value: '', label: 'select group' },
                      ...filteredGroups.map(g => ({
                        value: g.id,
                        label: g.name
                      }))
                    ]}
                  />
                </div>

                {/* 3. Organization Name */}
                <div>
                  <label style={{ display: 'block', fontSize: '13.5px', fontWeight: 700, color: '#334155', marginBottom: '8px' }}>
                    Organization Name
                  </label>
                  <FuelTracksSelect
                    value={selectedOrgId}
                    onChange={(val) => {
                      setSelectedOrgId(val);
                      setSelectedUserId('');
                      setSelectedGroupId('');
                    }}
                    placeholder="select organization"
                    searchable={true}
                    searchPlaceholder="Search Organization..."
                    options={[
                      { value: '', label: 'select organization' },
                      ...organizations.map(org => ({
                        value: org.id,
                        label: org.name
                      }))
                    ]}
                  />
                </div>
              </div>
            )}

            {/* Centered Submit Button */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '14px' }}>
              <button
                type="button"
                onClick={() => navigate('/admin/vehicles')}
                style={{
                  padding: '10px 32px',
                  borderRadius: '8px',
                  background: '#ffffff',
                  color: '#475569',
                  fontSize: '14px',
                  fontWeight: 700,
                  border: '1px solid #cbd5e1',
                  cursor: 'pointer',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = '#f8fafc';
                  e.currentTarget.style.borderColor = '#94a3b8';
                  e.currentTarget.style.color = '#0f172a';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = '#ffffff';
                  e.currentTarget.style.borderColor = '#cbd5e1';
                  e.currentTarget.style.color = '#475569';
                }}
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={submitting}
                style={{
                  padding: '10px 38px',
                  borderRadius: '8px',
                  background: '#f97316',
                  color: '#ffffff',
                  fontSize: '14px',
                  fontWeight: 800,
                  border: 'none',
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  boxShadow: '0 4px 14px rgba(249, 115, 22, 0.3)',
                  transition: 'all 0.15s ease',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  opacity: submitting ? 0.75 : 1
                }}
                onMouseEnter={e => {
                  if (!submitting) {
                    e.currentTarget.style.background = '#ea580c';
                    e.currentTarget.style.boxShadow = '0 6px 18px rgba(249, 115, 22, 0.4)';
                  }
                }}
                onMouseLeave={e => {
                  if (!submitting) {
                    e.currentTarget.style.background = '#f97316';
                    e.currentTarget.style.boxShadow = '0 4px 14px rgba(249, 115, 22, 0.3)';
                  }
                }}
              >
                {submitting && <Loader2 size={16} className="animate-spin" />}
                <span>{submitting ? 'Submitting...' : 'Submit'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AddUserVehiclePage;
