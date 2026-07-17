import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings, Plus, CheckCircle, AlertTriangle, Loader2, Save, Cpu, User, Building2, Layers, Truck } from 'lucide-react';
import * as adminApi from '../../api/adminApi';
import * as vehicleApi from '../../api/vehicleApi';
import { useAuth } from '../../hooks/useAuth';

const DeviceOnboardingPage = () => {
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();

  // General State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Step 0: Device Type & Quantity
  const [deviceType, setDeviceType] = useState('');
  const [quantity, setQuantity] = useState(1);

  // User Flow Selection
  const [flowType, setFlowType] = useState('existing'); // 'existing' | 'new'

  // Data Stores for Existing Flow
  const [allUsers, setAllUsers] = useState([]);
  const [allOrgs, setAllOrgs] = useState([]);
  const [allGroups, setAllGroups] = useState([]);
  const [allVehicles, setAllVehicles] = useState([]);

  // Existing Flow State
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedOrgId, setSelectedOrgId] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState('');

  // New Flow State
  const [newOrg, setNewOrg] = useState({ name: '', phone: '', email: '' });
  const [newUser, setNewUser] = useState({ name: '', mobile: '', email: '', password: '' });
  const [newGroup, setNewGroup] = useState({ name: '' });
  const [newVehicle, setNewVehicle] = useState({ number: '', name: '', type: 'Truck' });

  // Generated Rows
  const [deviceRows, setDeviceRows] = useState([]);

  useEffect(() => {
    // Fetch base data
    const fetchData = async () => {
      try {
        const [uRes, oRes, gRes, vRes] = await Promise.all([
          adminApi.getUsers().catch(() => ({ success: false, data: [] })),
          adminApi.getOrgs().catch(() => ({ success: false, data: [] })),
          adminApi.getGroups().catch(() => ({ success: false, data: [] })),
          vehicleApi.getVehicles().catch(() => ({ success: false, data: [] }))
        ]);
        if (uRes.success) setAllUsers(uRes.data);
        if (oRes.success) setAllOrgs(oRes.data);
        if (gRes.success) setAllGroups(gRes.data);
        if (vRes.success) setAllVehicles(vRes.data);
      } catch (err) {
        console.error(err);
      }
    };
    fetchData();
  }, []);

  // Handle User selection in Existing Flow -> auto populates org and available groups
  useEffect(() => {
    if (flowType === 'existing' && selectedUserId) {
      const userObj = allUsers.find(u => u.id === selectedUserId);
      if (userObj && userObj.org_id) {
        setSelectedOrgId(userObj.org_id);
      }
    }
  }, [selectedUserId, allUsers, flowType]);

  // Generate License IDs based on Type and Quantity
  useEffect(() => {
    if (deviceType && quantity > 0) {
      const prefix = `FT-${deviceType.toUpperCase()}-`;
      const rows = [];
      for (let i = 1; i <= quantity; i++) {
        // preserve existing input if any
        const existingRow = deviceRows[i - 1];
        rows.push({
          id: i,
          licenseId: `${prefix}${String(i).padStart(6, '0')}`,
          imei: existingRow ? existingRow.imei : '',
          type: deviceType,
          model: existingRow ? existingRow.model : '',
          vehicleId: existingRow ? existingRow.vehicleId : ''
        });
      }
      setDeviceRows(rows);
    } else {
      setDeviceRows([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceType, quantity]);

  const handleRowChange = (index, field, value) => {
    const newRows = [...deviceRows];
    newRows[index][field] = value;
    setDeviceRows(newRows);
  };

  const validate = () => {
    if (quantity < 1) return "Quantity must be greater than 0.";
    if (!deviceType) return "Please select a Device Type.";

    // Check rows
    const imeis = new Set();
    const vIds = new Set();

    for (const row of deviceRows) {
      if (!row.imei || row.imei.length < 5) return `IMEI cannot be empty or invalid for ${row.licenseId}.`;
      if (!row.model) return `Please select a Hardware Model for ${row.licenseId}.`;
      if (!row.vehicleId && flowType === 'existing') return `Please assign a vehicle for ${row.licenseId}.`;

      if (imeis.has(row.imei)) return `Duplicate IMEI detected: ${row.imei}.`;
      imeis.add(row.imei);

      if (row.vehicleId) {
        if (vIds.has(row.vehicleId) && row.vehicleId !== 'NEW_VEHICLE') return `A vehicle cannot have multiple active devices. Vehicle assigned multiple times.`;
        if (vIds.has(row.vehicleId) && row.vehicleId === 'NEW_VEHICLE') return `You cannot assign the same new vehicle to multiple devices. Please create more vehicles.`;
        vIds.add(row.vehicleId);
      }
    }
    return null;
  };

  const handleSave = async () => {
    const valError = validate();
    if (valError) {
      setError(valError);
      return;
    }
    setError(null);
    setLoading(true);

    try {
      let activeOrgId = selectedOrgId;
      let activeGroupId = selectedGroupId;
      let newlyCreatedVehicle = null;

      if (flowType === 'new') {
        // Step 1: Create Org
        if (!newOrg.name) throw new Error("Organization Name is required.");
        const orgRes = await adminApi.createOrg({ name: newOrg.name, phone: newOrg.phone, email: newOrg.email, type: 'customer' });
        activeOrgId = orgRes.data?.id;

        // Step 2: Create User
        if (!newUser.name || !newUser.email || !newUser.password) throw new Error("User details (name, email, password) are required.");
        const userRes = await adminApi.createUser({ name: newUser.name, email: newUser.email, password: newUser.password, role: 'customer', org_id: activeOrgId, is_active: true });

        // Step 3: Create Group
        if (!newGroup.name) throw new Error("Group Name is required.");
        const grpRes = await adminApi.createGroup({ name: newGroup.name, org_id: activeOrgId });
        activeGroupId = grpRes.data?.id;

        // Step 4: Create Vehicle
        if (!newVehicle.name || !newVehicle.number) throw new Error("Vehicle Name and Number are required.");
        // Note: we create vehicle without IMEI first, or assign the first row's IMEI
        // Since we have device rows that will assign IMEIs, we'll create the vehicle here without IMEI if possible,
        // or just wait and create it during row processing if row.vehicleId === 'NEW'
        // Let's create it here and use it for the first row if assigned.
        const vRes = await vehicleApi.createVehicle({
          name: newVehicle.name,
          plate: newVehicle.number,
          make: newVehicle.type,
          orgId: activeOrgId,
          groupIds: activeGroupId ? [activeGroupId] : [],
          imei: 'PENDING_ASSIGNMENT' // Will be updated
        });
        newlyCreatedVehicle = vRes.data;
      }

      // Step 5: Save Device Rows (Link Device -> Vehicle)
      // FuelTracks ties IMEI to Vehicle record.
      for (const row of deviceRows) {
        let vIdToUpdate = row.vehicleId;

        // If flow is new and they selected the "newly created vehicle" placeholder
        if (flowType === 'new' && row.vehicleId === 'NEW_VEHICLE') {
          vIdToUpdate = newlyCreatedVehicle.id;
        }

        if (vIdToUpdate) {
          // Update existing vehicle with new IMEI
          const targetVehicle = allVehicles.find(v => v.id === vIdToUpdate) || newlyCreatedVehicle;
          if (targetVehicle) {
            await vehicleApi.updateVehicle(vIdToUpdate, {
              imei: row.imei,
              name: targetVehicle.name,
              plate: targetVehicle.plate,
              orgId: targetVehicle.org_id || activeOrgId,
              groupIds: activeGroupId ? [activeGroupId] : []
            });
          }
        } else if (flowType === 'new') {
          // If no vehicle assigned in the row, but it's new flow, just create a placeholder vehicle to hold the IMEI
          await vehicleApi.createVehicle({
            name: `Asset ${row.licenseId}`,
            plate: 'TBD',
            imei: row.imei,
            orgId: activeOrgId,
            groupIds: activeGroupId ? [activeGroupId] : []
          });
        }
      }

      setSuccess("Devices successfully onboarded and linked!");
      setTimeout(() => {
        navigate('/admin/devices');
      }, 2000);

    } catch (err) {
      setError(err.message || err.response?.data?.error || "Failed to onboard devices.");
    } finally {
      setLoading(false);
    }
  };

  const getAvailableVehicles = () => {
    if (flowType === 'new') return [];
    if (!selectedGroupId) return allVehicles.filter(v => v.org_id === selectedOrgId);
    // Ideally filter by group, but for now filter by org
    return allVehicles.filter(v => v.org_id === selectedOrgId);
  };

  return (
    <div style={{ padding: '32px', background: '#EEF5F8', minHeight: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>

      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#111827', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Cpu size={24} color="#f97316" />
          Device Onboarding
        </h1>
        <p style={{ fontSize: '14px', color: '#6B7280', marginTop: '4px' }}>
          Provision new GPS hardware and link them to organizational fleets.
        </p>
      </div>

      <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>

        {/* Main Flow Form */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {error && (
            <div style={{ padding: '16px', background: '#FEF2F2', border: '1px solid #FEE2E2', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '12px', color: '#DC2626' }}>
              <AlertTriangle size={20} />
              <div style={{ fontSize: '14px', fontWeight: 600 }}>{error}</div>
            </div>
          )}

          {success && (
            <div style={{ padding: '16px', background: '#D1FAE5', border: '1px solid #A7F3D0', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '12px', color: '#059669' }}>
              <CheckCircle size={20} />
              <div style={{ fontSize: '14px', fontWeight: 600 }}>{success}</div>
            </div>
          )}

          {/* STEP 0: Device Type & Quantity */}
          <div style={{ background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '24px', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#111827', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#EEF5F8', color: '#f97316', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px' }}>0</span>
              Device Setup
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '8px' }}>Device Type *</label>
                <select
                  value={deviceType} onChange={e => setDeviceType(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '14px', outline: 'none', background: '#FFF', color: '#111827', boxSizing: 'border-box' }}
                >
                  <option value="">Select Type</option>
                  <option value="Starter">Starter</option>
                  <option value="Basic">Basic</option>
                  <option value="Advanced">Advanced</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '8px' }}>Quantity *</label>
                <input
                  type="number" min="1" max="50" value={quantity} onChange={e => setQuantity(parseInt(e.target.value) || 1)}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '14px', outline: 'none', color: '#111827', boxSizing: 'border-box' }}
                />
              </div>
            </div>
          </div>

          {/* USER FLOW SELECTION */}
          <div style={{ background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '24px', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
            <div style={{ display: 'flex', gap: '24px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 600, color: '#111827' }}>
                <input type="radio" name="flowType" value="existing" checked={flowType === 'existing'} onChange={() => setFlowType('existing')} style={{ accentColor: '#f97316', width: '16px', height: '16px' }} />
                Existing User Flow
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 600, color: '#111827' }}>
                <input type="radio" name="flowType" value="new" checked={flowType === 'new'} onChange={() => setFlowType('new')} style={{ accentColor: '#f97316', width: '16px', height: '16px' }} />
                New User Flow
              </label>
            </div>
          </div>

          {/* EXISTING USER FLOW */}
          {flowType === 'existing' && (
            <div style={{ background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '24px', boxShadow: '0 4px 6px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#111827', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#EEF5F8', color: '#f97316', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px' }}>1</span>
                  Select Existing User
                </h2>
                <select value={selectedUserId} onChange={e => setSelectedUserId(e.target.value)} style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '14px', outline: 'none', background: '#FFF', color: '#111827', boxSizing: 'border-box' }}>
                  <option value="">Select User...</option>
                  {allUsers.map(u => <option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}
                </select>
              </div>

              {selectedOrgId && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px', background: '#EEF5F8', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                  <Building2 size={16} color="#64748B" />
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#475569' }}>Auto-loaded Organization:</span>
                  <span style={{ fontSize: '13px', fontWeight: 800, color: '#111827' }}>{allOrgs.find(o => o.id === selectedOrgId)?.name || 'Unknown'}</span>
                </div>
              )}

              <div>
                <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#111827', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#EEF5F8', color: '#f97316', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px' }}>2</span>
                  Select Group
                </h2>
                <select value={selectedGroupId} onChange={e => setSelectedGroupId(e.target.value)} style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '14px', outline: 'none', background: '#FFF', color: '#111827', boxSizing: 'border-box' }}>
                  <option value="">None (Root Organization)</option>
                  {allGroups.filter(g => g.org_id === selectedOrgId).map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>
            </div>
          )}

          {/* NEW USER FLOW */}
          {flowType === 'new' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

              <div style={{ background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '24px', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
                <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#111827', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#EEF5F8', color: '#f97316', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px' }}>1</span>
                  Create Organization
                </h2>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '8px' }}>Organization Name *</label>
                    <input type="text" value={newOrg.name} onChange={e => setNewOrg({ ...newOrg, name: e.target.value })} style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '14px', color: '#111827', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '8px' }}>Mobile Number</label>
                    <input type="text" value={newOrg.phone} onChange={e => setNewOrg({ ...newOrg, phone: e.target.value })} style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '14px', color: '#111827', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '8px' }}>Email</label>
                    <input type="email" value={newOrg.email} onChange={e => setNewOrg({ ...newOrg, email: e.target.value })} style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '14px', color: '#111827', boxSizing: 'border-box' }} />
                  </div>
                </div>
              </div>

              <div style={{ background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '24px', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
                <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#111827', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#EEF5F8', color: '#f97316', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px' }}>2</span>
                  Create User
                </h2>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '8px' }}>User Name *</label>
                    <input type="text" value={newUser.name} onChange={e => setNewUser({ ...newUser, name: e.target.value })} style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '14px', color: '#111827', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '8px' }}>Mobile Number</label>
                    <input type="text" value={newUser.mobile} onChange={e => setNewUser({ ...newUser, mobile: e.target.value })} style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '14px', color: '#111827', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '8px' }}>Email *</label>
                    <input type="email" value={newUser.email} onChange={e => setNewUser({ ...newUser, email: e.target.value })} style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '14px', color: '#111827', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '8px' }}>Password *</label>
                    <input type="password" value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '14px', color: '#111827', boxSizing: 'border-box' }} />
                  </div>
                </div>
              </div>

              <div style={{ background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '24px', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
                <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#111827', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#EEF5F8', color: '#f97316', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px' }}>3</span>
                  Create Group
                </h2>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '8px' }}>Group Name *</label>
                  <input type="text" value={newGroup.name} onChange={e => setNewGroup({ ...newGroup, name: e.target.value })} style={{ width: '100%', maxWidth: '300px', padding: '10px 14px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '14px', color: '#111827', boxSizing: 'border-box' }} />
                </div>
              </div>

              <div style={{ background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '24px', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
                <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#111827', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#EEF5F8', color: '#f97316', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px' }}>4</span>
                  Create Vehicle
                </h2>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '8px' }}>Vehicle Number *</label>
                    <input type="text" value={newVehicle.number} onChange={e => setNewVehicle({ ...newVehicle, number: e.target.value })} style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '14px', color: '#111827', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '8px' }}>Vehicle Name *</label>
                    <input type="text" value={newVehicle.name} onChange={e => setNewVehicle({ ...newVehicle, name: e.target.value })} style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '14px', color: '#111827', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '8px' }}>Vehicle Type *</label>
                    <select value={newVehicle.type} onChange={e => setNewVehicle({ ...newVehicle, type: e.target.value })} style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '14px', outline: 'none', background: '#FFF', color: '#111827', boxSizing: 'border-box' }}>
                      <option value="Truck">Truck</option>
                      <option value="Car">Car</option>
                      <option value="Van">Van</option>
                      <option value="Bus">Bus</option>
                      <option value="Motorcycle">Motorcycle</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* DEVICE GENERATION TABLE */}
          {deviceRows.length > 0 && (
            <div style={{ background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '24px', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#111827', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#EEF5F8', color: '#f97316', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px' }}>
                  {flowType === 'new' ? '5' : '3'}
                </span>
                Generate Device Rows
              </h2>

              <div style={{ overflowX: 'auto', border: '1px solid #E2E8F0', borderRadius: '12px' }}>
                <table style={{ w: '100%', width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                      {['No', 'License ID', 'Device ID / IMEI', 'Hardware Model', 'Vehicle Assignment'].map(h => (
                        <th key={h} style={{ padding: '14px 16px', fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {deviceRows.map((row, idx) => (
                      <tr key={row.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                        <td style={{ padding: '14px 16px', fontSize: '13px', fontWeight: 600, color: '#475569' }}>{row.id}</td>
                        <td style={{ padding: '14px 16px', fontSize: '13px', fontWeight: 700, color: '#111827', fontFamily: 'monospace' }}>
                          <input type="text" readOnly value={row.licenseId} style={{ background: 'transparent', border: 'none', outline: 'none', width: '140px', fontWeight: 700, fontFamily: 'monospace', color: '#111827' }} />
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <input
                            type="text"
                            placeholder="Enter 15-digit IMEI"
                            value={row.imei}
                            onChange={e => handleRowChange(idx, 'imei', e.target.value.replace(/\D/g, ''))}
                            style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px', outline: 'none', color: '#111827', boxSizing: 'border-box' }}
                          />
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <select
                            value={row.model}
                            onChange={e => handleRowChange(idx, 'model', e.target.value)}
                            style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px', outline: 'none', background: '#FFF', color: '#111827', boxSizing: 'border-box' }}
                          >
                            <option value="">Select Model...</option>
                            <option value="BSTPL">BSTPL</option>
                            <option value="V5">V5</option>
                            <option value="Concox">Concox</option>
                            <option value="AIS140 V2">AIS140 V2</option>
                            <option value="Teltonika">Teltonika</option>
                            <option value="Coban">Coban</option>
                            <option value="Other">Other</option>
                          </select>
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          {flowType === 'existing' ? (
                            <select
                              value={row.vehicleId}
                              onChange={e => handleRowChange(idx, 'vehicleId', e.target.value)}
                              style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px', outline: 'none', background: '#FFF', color: '#111827', boxSizing: 'border-box' }}
                            >
                              <option value="">Select Vehicle...</option>
                              {getAvailableVehicles().map(v => (
                                <option key={v.id} value={v.id}>{v.name} ({v.plate})</option>
                              ))}
                            </select>
                          ) : (
                            <select
                              value={row.vehicleId}
                              onChange={e => handleRowChange(idx, 'vehicleId', e.target.value)}
                              style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px', outline: 'none', background: '#FFF', color: '#111827', boxSizing: 'border-box' }}
                            >
                              <option value="">Select Vehicle...</option>
                              {newVehicle.name ? <option value="NEW_VEHICLE">{newVehicle.name}</option> : null}
                            </select>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Action Footer */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '16px', marginTop: '10px', paddingBottom: '32px' }}>
            <button
              onClick={() => navigate('/admin/devices')}
              style={{ padding: '12px 24px', borderRadius: '10px', fontSize: '14px', fontWeight: 600, color: '#64748B', background: '#FFFFFF', border: '1px solid #CBD5E1', cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={loading || deviceRows.length === 0}
              style={{ padding: '12px 24px', borderRadius: '10px', fontSize: '14px', fontWeight: 600, color: '#FFFFFF', background: '#f97316', border: 'none', cursor: loading || deviceRows.length === 0 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(249,115,22,0.25)' }}
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
              Onboard Devices
            </button>
          </div>

        </div>

      </div>
    </div>
  );
};

export default DeviceOnboardingPage;
