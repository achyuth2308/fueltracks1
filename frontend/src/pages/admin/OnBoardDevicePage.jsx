import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Cpu, Save, Loader2, Home, ChevronRight, CheckCircle, AlertTriangle, Upload, FileUp } from 'lucide-react';
import { adminApi } from '../../api/axios';

const OnBoardDevicePage = () => {
  const navigate = useNavigate();
  
  // Step management
  const [step, setStep] = useState(1);

  // Pre-table state (Step 1)
  const [licenceType, setLicenceType] = useState('Starter');
  const [numDevices, setNumDevices] = useState('');
  
  // Step 2 state
  const [userType, setUserType] = useState('new'); // 'new' | 'existing'
  const [deviceEntryMode, setDeviceEntryMode] = useState('details'); // 'upload' | 'details'

  const [newUser, setNewUser] = useState({ name: '', phone: '', email: '', password: '' });
  const [existingUserSelection, setExistingUserSelection] = useState({ userId: '', groupId: '', orgId: '' });

  const [users, setUsers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [orgs, setOrgs] = useState([]);

  const [devices, setDevices] = useState([]);
  const [expandedRows, setExpandedRows] = useState({});

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    // Fetch data for dropdowns
    adminApi.getOrgs?.().then(res => setOrgs(res.data)).catch(console.error);
    adminApi.getUsers?.().then(res => setUsers(res.data)).catch(console.error);
    adminApi.getGroups?.().then(res => setGroups(res.data)).catch(console.error);
  }, []);

  const handleStep1Submit = () => {
    const qty = parseInt(numDevices);
    if (!qty || qty < 1) {
      setError('Please enter a valid quantity.');
      return;
    }
    setError('');
    
    // Generate rows
    const newRows = [];
    const prefix = licenceType === 'Starter' ? 'ST' : licenceType === 'Basic' ? 'BC' : licenceType === 'Advanced' ? 'AD' : 'EN';
    for (let i = 0; i < qty; i++) {
      newRows.push({
        id: Date.now() + i, 
        licenceId: `${prefix}6A1FE9FC0E${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
        deviceId: '',
        deviceType: 'BSTPL',
        vehicleId: '',
        vehicleName: '',
        registrationNo: '',
        vehicleModel: '',
        vehicleTypeSelect: '',
        gpsSimNo: '',
        odoDistance: '',
        serviceEngineer: '',
        salesman: '',
        ticketId: '',
        sensorNo: ''
      });
    }
    setDevices(newRows);
    setStep(2);
  };

  const updateDevice = (index, field, value) => {
    const updated = [...devices];
    updated[index][field] = value;
    setDevices(updated);
  };

  const toggleRowExpansion = (index) => {
    setExpandedRows(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  const handleSubmit = async () => {
    setMessage('');
    setError('');
    setIsSubmitting(true);

    try {
      if (deviceEntryMode === 'details' && devices.length === 0) {
        throw new Error('Please generate and fill in at least one device row.');
      }

      if (deviceEntryMode === 'details') {
        const missingIds = devices.filter(d => !d.deviceId);
        if (missingIds.length > 0) throw new Error('All rows must have a valid Device Id.');
      }

      const payload = {
        userType,
        newUser: userType === 'new' ? newUser : undefined,
        existingUser: userType === 'existing' ? existingUserSelection : undefined,
        devices: devices.map(({ id, ...rest }) => rest)
      };

      const res = await adminApi.onboardDevices(payload);
      if (res.success) {
        setMessage(res.message);
        setTimeout(() => {
          navigate('/admin/devices');
        }, 2000);
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputStyle = {
    width: '100%', padding: '10px 14px', borderRadius: '8px', 
    border: '1px solid #CBD5E1', fontSize: '14px', outline: 'none', 
    color: '#111827', // Black color explicitly set for typing
    background: '#FFFFFF', boxSizing: 'border-box'
  };

  return (
    <div style={{ padding: '32px', background: 'linear-gradient(to bottom, #f5efe4 0%, #f5efe4 50%, #F8FAFC 50%, #F8FAFC 100%)', minHeight: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
      
      {/* Header and Breadcrumbs */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#111827', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
          <Cpu size={24} color="#8ba0b5" />
          Add Device
        </h1>
      </div>

      {message && (
        <div style={{ padding: '16px', background: '#D1FAE5', border: '1px solid #A7F3D0', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '12px', color: '#059669', marginBottom: '24px' }}>
          <CheckCircle size={20} />
          <div style={{ fontSize: '14px', fontWeight: 600 }}>{message}</div>
        </div>
      )}

      {error && (
        <div style={{ padding: '16px', background: '#FEF2F2', border: '1px solid #FEE2E2', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '12px', color: '#DC2626', marginBottom: '24px' }}>
          <AlertTriangle size={20} />
          <div style={{ fontSize: '14px', fontWeight: 600 }}>{error}</div>
        </div>
      )}

      <div style={{ background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '32px', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
        
        {step === 1 && (
          <div style={{ maxWidth: '600px', margin: '0 auto' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #F1F5F9', paddingBottom: '16px' }}>
                <label style={{ fontSize: '14px', fontWeight: 600, color: '#475569', width: '40%' }}>Licence Type :</label>
                <select 
                  style={{ width: '60%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '14px', outline: 'none', background: '#FFF', color: '#111827' }}
                  value={licenceType}
                  onChange={e => setLicenceType(e.target.value)}
                >
                  <option value="Starter">Starter</option>
                  <option value="Basic">Basic</option>
                  <option value="Advanced">Advanced</option>
                  <option value="Premium">Premium</option>
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', borderBottom: '1px solid #F1F5F9', paddingBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <label style={{ fontSize: '14px', fontWeight: 600, color: '#475569', width: '40%' }}>Quantity :</label>
                  <input 
                    type="number" min="1"
                    placeholder="Enter Quantity"
                    style={{ width: '60%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '14px', outline: 'none', color: '#111827' }}
                    value={numDevices}
                    onChange={e => setNumDevices(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'center', marginTop: '16px' }}>
                <button 
                  onClick={handleStep1Submit}
                  style={{ padding: '10px 32px', borderRadius: '8px', fontSize: '14px', fontWeight: 600, color: '#FFFFFF', background: '#8ba0b5', border: 'none', cursor: 'pointer', boxShadow: '0 4px 12px rgba(139,160,181,0.2)' }}
                >
                  Next Step
                </button>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#f5efe4', color: '#8ba0b5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>2</div>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#111827', margin: 0 }}>Business Information</h2>
            </div>

            {/* Top Toggle */}
            <div style={{ display: 'flex', gap: '48px', marginBottom: '32px', padding: '16px', background: '#F8FAFC', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 600, color: userType === 'new' ? '#8ba0b5' : '#475569' }}>
                <input 
                  type="radio" 
                  style={{ accentColor: '#8ba0b5', width: '16px', height: '16px' }} 
                  checked={userType === 'new'} 
                  onChange={() => setUserType('new')}
                />
                New User
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 600, color: userType === 'existing' ? '#8ba0b5' : '#475569' }}>
                <input 
                  type="radio" 
                  style={{ accentColor: '#8ba0b5', width: '16px', height: '16px' }} 
                  checked={userType === 'existing'} 
                  onChange={() => setUserType('existing')}
                />
                Existing User
              </label>
            </div>

            {/* User Details Form */}
            {userType === 'new' ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '24px', marginBottom: '48px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>User Name</label>
                  <input 
                    type="text" placeholder="Enter Name" 
                    style={inputStyle}
                    value={newUser.name}
                    onChange={e => setNewUser({...newUser, name: e.target.value})}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>Mobile Number</label>
                  <input 
                    type="text" placeholder="Enter Mobile" 
                    style={inputStyle}
                    value={newUser.phone}
                    onChange={e => setNewUser({...newUser, phone: e.target.value})}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>Email</label>
                  <input 
                    type="email" placeholder="Enter Email" 
                    style={inputStyle}
                    value={newUser.email}
                    onChange={e => setNewUser({...newUser, email: e.target.value})}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>Password</label>
                  <input 
                    type="password" placeholder="Enter Password" 
                    style={inputStyle}
                    value={newUser.password}
                    onChange={e => setNewUser({...newUser, password: e.target.value})}
                  />
                </div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px', marginBottom: '48px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>Select User</label>
                  <select 
                    style={inputStyle}
                    value={existingUserSelection.userId}
                    onChange={e => setExistingUserSelection({...existingUserSelection, userId: e.target.value})}
                  >
                    <option value="">-- Choose User --</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.name || u.email}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>Select Group</label>
                  <select 
                    style={inputStyle}
                    value={existingUserSelection.groupId}
                    onChange={e => setExistingUserSelection({...existingUserSelection, groupId: e.target.value})}
                  >
                    <option value="">-- Choose Group --</option>
                    {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>Select Organization</label>
                  <select 
                    style={inputStyle}
                    value={existingUserSelection.orgId}
                    onChange={e => setExistingUserSelection({...existingUserSelection, orgId: e.target.value})}
                  >
                    <option value="">-- Choose Organization --</option>
                    {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </select>
                </div>
              </div>
            )}

            <hr style={{ borderTop: '1px solid #F1F5F9', borderBottom: 'none', margin: '0 0 32px 0' }} />

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#f5efe4', color: '#8ba0b5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>3</div>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#111827', margin: 0 }}>Device Configuration</h2>
            </div>

            {/* Middle Toggle */}
            <div style={{ display: 'flex', gap: '48px', marginBottom: '24px', padding: '16px', background: '#F8FAFC', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 600, color: deviceEntryMode === 'upload' ? '#8ba0b5' : '#475569' }}>
                <input 
                  type="radio" 
                  style={{ accentColor: '#8ba0b5', width: '16px', height: '16px' }} 
                  checked={deviceEntryMode === 'upload'} 
                  onChange={() => setDeviceEntryMode('upload')}
                />
                Bulk Upload via Excel
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 600, color: deviceEntryMode === 'details' ? '#8ba0b5' : '#475569' }}>
                <input 
                  type="radio" 
                  style={{ accentColor: '#8ba0b5', width: '16px', height: '16px' }} 
                  checked={deviceEntryMode === 'details'} 
                  onChange={() => setDeviceEntryMode('details')}
                />
                Manual Entry
              </label>
            </div>

            {/* Upload Devices View */}
            {deviceEntryMode === 'upload' && (
              <div style={{ padding: '32px', background: '#f5efe4', borderRadius: '12px', border: '1px dashed #FFBE98', textAlign: 'center', marginBottom: '40px' }}>
                <Upload size={32} color="#8ba0b5" style={{ marginBottom: '16px' }} />
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#111827', marginBottom: '8px' }}>Upload Device Excel File</h3>
                <p style={{ fontSize: '14px', color: '#64748B', marginBottom: '24px' }}>Download our template, fill it out, and upload it here.</p>
                
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
                  <button style={{ padding: '10px 20px', background: '#FFFFFF', color: '#111827', fontSize: '13px', fontWeight: 600, border: '1px solid #E2E8F0', borderRadius: '8px', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                    Download Template
                  </button>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <div style={{ padding: '10px 16px', border: '1px solid #CBD5E1', borderRight: 'none', borderRadius: '8px 0 0 8px', fontSize: '13px', color: '#94A3B8', width: '200px', background: '#FFF', textAlign: 'left' }}>
                      Choose a File
                    </div>
                    <button style={{ padding: '10px 20px', background: '#F1F5F9', color: '#475569', fontSize: '13px', fontWeight: 600, border: '1px solid #CBD5E1', borderRadius: '0 8px 8px 0', cursor: 'pointer' }}>
                      Browse
                    </button>
                  </div>
                  <button style={{ padding: '10px 24px', background: '#8ba0b5', color: '#FFF', fontSize: '13px', fontWeight: 600, border: 'none', borderRadius: '8px', cursor: 'pointer', boxShadow: '0 4px 12px rgba(139,160,181,0.2)' }}>
                    Import Excel
                  </button>
                </div>
              </div>
            )}

            {/* Device Table */}
            {deviceEntryMode === 'details' && devices.length > 0 && (
              <div style={{ overflowX: 'auto', border: '1px solid #E2E8F0', borderRadius: '12px', marginBottom: '40px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: '#8ba0b5', color: '#FFFFFF' }}>
                      <th style={{ padding: '14px 16px', fontSize: '13px', fontWeight: 600, width: '40px', borderRight: '1px solid rgba(255,255,255,0.2)' }}>No</th>
                      <th style={{ padding: '14px 16px', fontSize: '13px', fontWeight: 600, borderRight: '1px solid rgba(255,255,255,0.2)' }}>LicenceId ({licenceType})</th>
                      <th style={{ padding: '14px 16px', fontSize: '13px', fontWeight: 600, borderRight: '1px solid rgba(255,255,255,0.2)' }}>Device Id</th>
                      <th style={{ padding: '14px 16px', fontSize: '13px', fontWeight: 600, borderRight: '1px solid rgba(255,255,255,0.2)' }}>Device Type</th>
                      <th style={{ padding: '14px 16px', fontSize: '13px', fontWeight: 600, borderRight: '1px solid rgba(255,255,255,0.2)' }}>Vehicle Id</th>
                      <th style={{ padding: '14px 16px', fontSize: '13px', fontWeight: 600, textAlign: 'center' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {devices.map((device, idx) => (
                      <React.Fragment key={device.id}>
                        <tr style={{ borderBottom: '1px solid #F1F5F9', background: '#FFFFFF' }}>
                          <td style={{ padding: '14px 16px', fontSize: '14px', fontWeight: 600, color: '#475569', textAlign: 'center', borderRight: '1px solid #F1F5F9' }}>{idx + 1}</td>
                          <td style={{ padding: '14px 16px', borderRight: '1px solid #F1F5F9' }}>
                            <div style={{ padding: '8px 12px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '6px', fontSize: '13px', color: '#64748B', fontFamily: 'monospace' }}>
                              {device.licenceId}
                            </div>
                          </td>
                          <td style={{ padding: '14px 16px', borderRight: '1px solid #F1F5F9' }}>
                            <input 
                              type="text" placeholder="Enter Device Id" value={device.deviceId}
                              onChange={(e) => updateDevice(idx, 'deviceId', e.target.value)}
                              style={{...inputStyle, padding: '8px 12px'}}
                            />
                          </td>
                          <td style={{ padding: '14px 16px', borderRight: '1px solid #F1F5F9' }}>
                            <select 
                              value={device.deviceType}
                              onChange={(e) => updateDevice(idx, 'deviceType', e.target.value)}
                              style={{...inputStyle, padding: '8px 12px'}}
                            >
                              <option value="BSTPL">BSTPL</option>
                              <option value="AS140">AS140</option>
                            </select>
                          </td>
                          <td style={{ padding: '14px 16px', borderRight: '1px solid #F1F5F9' }}>
                            <input 
                              type="text" placeholder="Enter Vehicle Id" value={device.vehicleId}
                              onChange={(e) => updateDevice(idx, 'vehicleId', e.target.value)}
                              style={{...inputStyle, padding: '8px 12px'}}
                            />
                          </td>
                          <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                            <button 
                              onClick={() => toggleRowExpansion(idx)}
                              style={{ padding: '8px 16px', background: '#10B981', color: '#FFF', fontSize: '12px', fontWeight: 600, border: 'none', borderRadius: '6px', cursor: 'pointer', boxShadow: '0 2px 4px rgba(16,185,129,0.2)' }}
                            >
                              {expandedRows[idx] ? 'Hide Details' : 'Show Details'}
                            </button>
                          </td>
                        </tr>
                        {expandedRows[idx] && (
                          <tr style={{ background: '#FAFAFA', borderBottom: '1px solid #E2E8F0' }}>
                            <td style={{ borderRight: '1px solid #F1F5F9' }}></td>
                            <td colSpan="5" style={{ padding: '24px' }}>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', padding: '8px 0' }}>
                                <div>
                                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#64748B', marginBottom: '6px', display: 'block' }}>Vehicle Name</label>
                                  <input 
                                    type="text" placeholder="Vehicle Name" value={device.vehicleName}
                                    onChange={(e) => updateDevice(idx, 'vehicleName', e.target.value)}
                                    style={{...inputStyle, padding: '10px 14px'}}
                                  />
                                </div>
                                <div>
                                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#64748B', marginBottom: '6px', display: 'block' }}>Registration No</label>
                                  <input 
                                    type="text" placeholder="e.g. MH12AB1234" value={device.registrationNo}
                                    onChange={(e) => updateDevice(idx, 'registrationNo', e.target.value)}
                                    style={{...inputStyle, padding: '10px 14px'}}
                                  />
                                </div>
                                <div>
                                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#64748B', marginBottom: '6px', display: 'block' }}>Vehicle Type</label>
                                  <select 
                                    value={device.vehicleTypeSelect}
                                    onChange={(e) => updateDevice(idx, 'vehicleTypeSelect', e.target.value)}
                                    style={{...inputStyle, padding: '10px 14px'}}
                                  >
                                    <option value="">Select Type</option>
                                    <option value="Truck">Truck</option>
                                    <option value="Car">Car</option>
                                    <option value="Van">Van</option>
                                    <option value="Bus">Bus</option>
                                    <option value="Scooty">Scooty</option>
                                    <option value="Motorcycle">Motorcycle</option>
                                    <option value="Tractor">Tractor</option>
                                    <option value="JCB">JCB</option>
                                    <option value="Crane">Crane</option>
                                    <option value="Ambulance">Ambulance</option>
                                    <option value="Pickup">Pickup</option>
                                    <option value="Borewell">Borewell</option>
                                    <option value="Tanker">Tanker</option>
                                  </select>
                                </div>
                                <div>
                                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#64748B', marginBottom: '6px', display: 'block' }}>Vehicle Model</label>
                                  <input 
                                    type="text" placeholder="e.g. Tata Prima" value={device.vehicleModel}
                                    onChange={(e) => updateDevice(idx, 'vehicleModel', e.target.value)}
                                    style={{...inputStyle, padding: '10px 14px'}}
                                  />
                                </div>
                                <div>
                                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#64748B', marginBottom: '6px', display: 'block' }}>GPS Sim No</label>
                                  <input 
                                    type="text" placeholder="GPS Sim No" value={device.gpsSimNo}
                                    onChange={(e) => updateDevice(idx, 'gpsSimNo', e.target.value)}
                                    style={{...inputStyle, padding: '10px 14px'}}
                                  />
                                </div>
                                <div>
                                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#64748B', marginBottom: '6px', display: 'block' }}>Odo Distance</label>
                                  <input 
                                    type="text" placeholder="Odo Distance" value={device.odoDistance}
                                    onChange={(e) => updateDevice(idx, 'odoDistance', e.target.value)}
                                    style={{...inputStyle, padding: '10px 14px'}}
                                  />
                                </div>
                                <div>
                                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#64748B', marginBottom: '6px', display: 'block' }}>Service Engineer</label>
                                  <input 
                                    type="text" placeholder="Service Engineer" value={device.serviceEngineer}
                                    onChange={(e) => updateDevice(idx, 'serviceEngineer', e.target.value)}
                                    style={{...inputStyle, padding: '10px 14px'}}
                                  />
                                </div>
                                <div>
                                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#64748B', marginBottom: '6px', display: 'block' }}>Salesman</label>
                                  <input 
                                    type="text" placeholder="Salesman" value={device.salesman}
                                    onChange={(e) => updateDevice(idx, 'salesman', e.target.value)}
                                    style={{...inputStyle, padding: '10px 14px'}}
                                  />
                                </div>
                                <div>
                                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#64748B', marginBottom: '6px', display: 'block' }}>Ticket Id</label>
                                  <input 
                                    type="text" placeholder="Ticket Id" value={device.ticketId}
                                    onChange={(e) => updateDevice(idx, 'ticketId', e.target.value)}
                                    style={{...inputStyle, padding: '10px 14px'}}
                                  />
                                </div>
                                <div>
                                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#64748B', marginBottom: '6px', display: 'block' }}>Sensor No</label>
                                  <input 
                                    type="text" placeholder="Sensor No" value={device.sensorNo}
                                    onChange={(e) => updateDevice(idx, 'sensorNo', e.target.value)}
                                    style={{...inputStyle, padding: '10px 14px'}}
                                  />
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Final Submit Button */}
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <button 
                onClick={handleSubmit}
                disabled={isSubmitting}
                style={{ padding: '14px 48px', borderRadius: '10px', fontSize: '15px', fontWeight: 700, color: '#FFFFFF', background: '#8ba0b5', border: 'none', cursor: isSubmitting ? 'not-allowed' : 'pointer', opacity: isSubmitting ? 0.7 : 1, display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 16px rgba(139,160,181,0.3)' }}
              >
                {isSubmitting ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
                Submit Devices
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default OnBoardDevicePage;
