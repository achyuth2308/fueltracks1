import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { Cpu, Save, Loader2, Home, ChevronRight, CheckCircle, AlertTriangle, Upload, FileUp, Shield, FileSpreadsheet, Download, Plus, X } from 'lucide-react';
import { adminApi } from '../../api/axios';
import { getDeviceQuota, createOrg } from '../../api/adminApi';
import { useAuth } from '../../hooks/useAuth';
import ExcelBulkUploadModal from '../../components/ExcelBulkUploadModal';
import AddGroupModal from '../../components/modals/AddGroupModal';
import AddUserModal from '../../components/modals/AddUserModal';
import { generateVehicleOnboardingTemplate } from '../../utils/excelTemplateGenerator';

const OnBoardDevicePage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isDealer = user?.role === 'dealer';
  const isSuperAdmin = user?.role === 'superadmin';

  // Quick Modal States
  const [isAddGroupOpen, setIsAddGroupOpen] = useState(false);
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [isAddOrgOpen, setIsAddOrgOpen] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [newOrgType, setNewOrgType] = useState('company');
  const [orgCreating, setOrgCreating] = useState(false);

  // Step management
  const [step, setStep] = useState(1);
  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);

  // Pre-table state (Step 1)
  const [licenceType, setLicenceType] = useState('Starter');
  const [numDevices, setNumDevices] = useState('');

  // Quota state (for dealers)
  const [quota, setQuota] = useState(null);
  const [quotaLoading, setQuotaLoading] = useState(false);

  // Step 2 state
  const [userType, setUserType] = useState('new'); // 'new' | 'existing'
  const [deviceEntryMode, setDeviceEntryMode] = useState('details'); // 'upload' | 'details'

  const [newUser, setNewUser] = useState({ name: '', phone: '', location: '', email: '', username: '', password: '', aadhar: '' });
  const [existingUserSelection, setExistingUserSelection] = useState({ userId: '', groupId: '', orgId: '' });

  const [users, setUsers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [orgs, setOrgs] = useState([]);

  const [devices, setDevices] = useState([]);
  const [expandedRows, setExpandedRows] = useState({});

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const fileInputRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null);

  const handleDownloadTemplate = () => {
    const templateData = [{
      'VLTD SLNO': '',
      'Device Type (VOLTY/AIS140/CONCOX/AIS140V2/FMB 920)': '',
      'Vehicle Id': '',
      'Vehicle Name': '',
      'Registration No': '',
      'Vehicle Model': '',
      'Vehicle Type': '',
      'ICCID': '',
      'GPS SIMNO 1': '',
      'GPS SIMNO 2': '',
      'Odo Distance': '',
      'Vehicle Voltage': '',
      'Timezone': '',
      'Ignition Detection (ENGINE ON STATUS WITH IGNITION/IGNITION + VOLTAGE/VOLTAGE)': '',
      'Service Engineer': '',
      'Service Engineer Mobno': '',
      'Salesman': '',
      'Salesman Mobno': '',
      'Ticket Id': '',
      'Sensor No': ''
    }];
    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "Device_Upload_Template.xlsx");
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleImportExcel = () => {
    if (!selectedFile) {
      setError('Please choose a file to upload first.');
      return;
    }
    setError('');
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(worksheet);

        if (!json || json.length === 0) {
          setError('The uploaded Excel file is empty.');
          return;
        }

        const prefix = licenceType === 'Starter' ? 'ST' : licenceType === 'Basic' ? 'BC' : licenceType === 'Advanced' ? 'AD' : 'EN';

        const newDevices = json.map((row, idx) => ({
          id: Date.now() + idx,
          licenceId: `${prefix}6A1FE9FC0E${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
          deviceId: String(row['VLTD SLNO'] || row['Device ID / IMEI'] || row['Device Id'] || '').trim(),
          deviceType: String(row['Device Type (VOLTY/AIS140/CONCOX/AIS140V2/FMB 920)'] || row['Device Type (VOLTY/BSTPL/AS140/CONCOX/AIS140V2/FMB 920)'] || row['Device Type (BSTPL/AS140/AIS140V2/CONCOX/VOLTY/FMB 920)'] || row['Device Type (BSTPL/AS140/AIS140V2/CONCOX/VOLTY)'] || row['Device Type (BSTPL/AS140/AIS140V2/CONCOX)'] || 'VOLTY').trim(),
          vehicleId: String(row['Vehicle Id'] || '').trim(),
          vehicleName: String(row['Vehicle Name'] || '').trim(),
          registrationNo: String(row['Registration No'] || '').trim(),
          vehicleModel: String(row['Vehicle Model'] || '').trim(),
          vehicleTypeSelect: String(row['Vehicle Type'] || '').trim(),
          gpsSimNo: String(row['GPS SIMNO 1'] || row['GPS Sim No'] || '').trim(),
          gpsSimNo2: String(row['GPS SIMNO 2'] || '').trim(),
          odoDistance: String(row['Odo Distance'] || '').trim(),
          serviceEngineer: String(row['Service Engineer'] || '').trim(),
          serviceEngineerMob: String(row['Service Engineer Mobno'] || '').trim(),
          salesman: String(row['Salesman'] || '').trim(),
          salesmanMob: String(row['Salesman Mobno'] || '').trim(),
          ticketId: String(row['Ticket Id'] || '').trim(),
          sensorNo: String(row['Sensor No'] || '').trim(),
          iccid: String(row['ICCID'] || '').trim(),
          vehicleVoltage: String(row['Vehicle Voltage'] || '').trim(),
          timezone: String(row['Timezone'] || '').trim(),
          ignitionDetection: String(row['Ignition Detection'] || row['Ignition Detection (ENGINE ON STATUS WITH IGNITION/IGNITION + VOLTAGE/VOLTAGE)'] || 'ENGINE ON STATUS WITH IGNITION').trim(),
        }));

        setDevices(newDevices);
        setDeviceEntryMode('details');
        setMessage(`Successfully imported ${newDevices.length} devices.`);
        setTimeout(() => setMessage(''), 3000);
      } catch (err) {
        setError('Failed to parse the Excel file. Please ensure it matches the template.');
      }
    };
    reader.readAsArrayBuffer(selectedFile);
  };

  useEffect(() => {
    // Fetch data for dropdowns
    adminApi.getOrgs?.().then(res => setOrgs(res.data)).catch(console.error);
    adminApi.getUsers?.().then(res => setUsers(res.data)).catch(console.error);
    adminApi.getGroups?.().then(res => setGroups(res.data)).catch(console.error);
  }, []);

  // Fetch quota for dealer users when licenceType changes
  useEffect(() => {
    if (!isDealer) return;
    setQuotaLoading(true);
    getDeviceQuota()
      .then(res => { if (res.success) setQuota(res.data); })
      .catch(console.error)
      .finally(() => setQuotaLoading(false));
  }, [licenceType, isDealer]);

  const handleStep1Submit = () => {
    const qty = parseInt(numDevices);
    if (!qty || qty < 1) {
      setError('Please enter a valid quantity.');
      return;
    }

    // Quota check for dealers
    if (isDealer && quota) {
      const available = quota.available?.[licenceType] ?? 0;
      if (qty > available) {
        setError(`You only have ${available} available device slot(s) for the "${licenceType}" tier. Please contact your administrator to increase the limit.`);
        return;
      }
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
        vlttdSlno: '',
        deviceType: 'VOLTY',
        vehicleId: '',
        vehicleName: '',
        registrationNo: '',
        vehicleModel: '',
        vehicleTypeSelect: '',
        gpsSimNo: '',
        gpsSimNo2: '',
        odoDistance: '',
        serviceEngineer: '',
        serviceEngineerMob: '',
        salesman: '',
        salesmanMob: '',
        ticketId: '',
        sensorNo: '',
        iccid: '',
        vehicleVoltage: '',
        timezone: 'IST',
        ignitionDetection: 'ENGINE ON STATUS WITH IGNITION'
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
    <div style={{ padding: '32px', background: '#EEF5F8', minHeight: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>

      {/* Header and Breadcrumbs */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#111827', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
          <Cpu size={24} color="#f97316" />
          Add Device
        </h1>
      </div>

      {message && (
        <div style={{ padding: '16px', background: '#D1FAE5', border: '1px solid #A7F3D0', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '12px', color: '#059669', marginBottom: '24px' }}>
          <CheckCircle size={20} />
          <div style={{ fontSize: '14px', fontWeight: 600 }}>{message}</div>
        </div>
      )}

      {/* Fast Bulk Onboarding Banner */}
      <div className="bg-gradient-to-r from-orange-500 to-amber-500 rounded-2xl p-6 text-white shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
        <div>
          <span className="bg-white/20 text-white text-[11px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider">
            Fast Bulk Onboarding
          </span>
          <h2 className="text-xl font-extrabold mt-1.5 text-white">Have multiple devices to onboard at once?</h2>
          <p className="text-sm text-orange-100 mt-1">
            Download our pre-formatted Excel template with dropdowns, fill in your hardware data, and onboard in 1 click.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => generateVehicleOnboardingTemplate(groups, user?.orgName)}
            className="px-4 py-2.5 bg-white text-orange-700 hover:bg-orange-50 rounded-xl font-bold text-xs flex items-center gap-2 shadow-sm transition-all cursor-pointer"
          >
            <Download size={15} /> Excel Template
          </button>
          <button
            onClick={() => setIsExcelModalOpen(true)}
            className="px-5 py-2.5 bg-slate-900 hover:bg-black text-white rounded-xl font-bold text-xs flex items-center gap-2 shadow-md transition-all cursor-pointer"
          >
            <FileSpreadsheet size={15} className="text-orange-400" /> Upload Excel
          </button>
        </div>
      </div>

      <div style={{ background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '32px', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>

        {step === 1 && (
          <div style={{ maxWidth: '600px', margin: '0 auto' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
              {/* Quota Banner - only for dealers */}
              {isDealer && (
                <div style={{ background: '#EEF5F8', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '16px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                    <Shield size={16} color="#f97316" />
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#475569' }}>
                      Device Allowance — {licenceType}
                    </span>
                    {quotaLoading && <Loader2 size={13} color="#94A3B8" className="animate-spin" />}
                  </div>
                  {quota ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                      {[
                        { label: 'Total Allowed', value: quota.limits?.[licenceType] ?? 0, color: '#475569', bg: '#F1F5F9' },
                        { label: 'Already Used', value: quota.used?.[licenceType] ?? 0, color: '#DC2626', bg: '#FEF2F2' },
                        { label: 'Available', value: quota.available?.[licenceType] ?? 0, color: '#059669', bg: '#D1FAE5' },
                      ].map(({ label, value, color, bg }) => (
                        <div key={label} style={{ background: bg, borderRadius: '8px', padding: '10px 14px', textAlign: 'center' }}>
                          <div style={{ fontSize: '22px', fontWeight: 800, color }}>{value}</div>
                          <div style={{ fontSize: '11px', fontWeight: 600, color: '#64748B', marginTop: '2px' }}>{label}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ fontSize: '13px', color: '#94A3B8' }}>Loading quota information...</div>
                  )}
                </div>
              )}

              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-4">
                <label className="text-[14px] font-[600] text-slate-600 w-full sm:w-[40%] mb-2 sm:mb-0">Licence Type :</label>
                <select
                  className="w-full sm:w-[60%] px-[14px] py-[10px] rounded-[8px] border border-slate-300 text-[14px] outline-none bg-white text-gray-900"
                  value={licenceType}
                  onChange={e => setLicenceType(e.target.value)}
                >
                  <option value="Starter">Starter</option>
                  <option value="Basic">Basic</option>
                  <option value="Advanced">Advanced</option>
                  <option value="Premium">Premium</option>
                </select>
              </div>

              <div className="flex flex-col border-b border-slate-100 pb-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between">
                  <label className="text-[14px] font-[600] text-slate-600 w-full sm:w-[40%] mb-2 sm:mb-0">Quantity :</label>
                  <input
                    type="number" min="1"
                    placeholder="Enter Quantity"
                    className="w-full sm:w-[60%] px-[14px] py-[10px] rounded-[8px] border border-slate-300 text-[14px] outline-none text-gray-900"
                    value={numDevices}
                    onChange={e => setNumDevices(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'center', marginTop: '16px' }}>
                <button
                  onClick={handleStep1Submit}
                  style={{ padding: '10px 32px', borderRadius: '8px', fontSize: '14px', fontWeight: 600, color: '#FFFFFF', background: '#f97316', border: 'none', cursor: 'pointer', boxShadow: '0 4px 12px rgba(249,115,22,0.2)' }}
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
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#EEF5F8', color: '#f97316', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>2</div>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#111827', margin: 0 }}>Business Information</h2>
            </div>

            {/* Top Toggle */}
            <div className="flex flex-col sm:flex-row gap-4 sm:gap-12 mb-8 p-4 bg-slate-50 rounded-xl border border-slate-200">
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 600, color: userType === 'new' ? '#f97316' : '#475569' }}>
                <input
                  type="radio"
                  style={{ accentColor: '#f97316', width: '16px', height: '16px' }}
                  checked={userType === 'new'}
                  onChange={() => setUserType('new')}
                />
                New User
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 600, color: userType === 'existing' ? '#f97316' : '#475569' }}>
                <input
                  type="radio"
                  style={{ accentColor: '#f97316', width: '16px', height: '16px' }}
                  checked={userType === 'existing'}
                  onChange={() => setUserType('existing')}
                />
                Existing User
              </label>
            </div>

            {/* User Details Form */}
            {userType === 'new' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>Customer Name *</label>
                  <input
                    type="text" placeholder="Enter Name"
                    style={inputStyle}
                    value={newUser.name}
                    onChange={e => setNewUser({ ...newUser, name: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>Customer Mobile Number *</label>
                  <input
                    type="text" placeholder="Enter Mobile"
                    style={inputStyle}
                    value={newUser.phone}
                    onChange={e => setNewUser({ ...newUser, phone: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>Customer Loc</label>
                  <input
                    type="text" placeholder="Enter Location"
                    style={inputStyle}
                    value={newUser.location}
                    onChange={e => setNewUser({ ...newUser, location: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>Customer Aadhar</label>
                  <input
                    type="text" placeholder="Enter Aadhar"
                    style={inputStyle}
                    value={newUser.aadhar}
                    onChange={e => setNewUser({ ...newUser, aadhar: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>Customer Email ID *</label>
                  <input
                    type="email" placeholder="Enter Email"
                    style={inputStyle}
                    value={newUser.email}
                    onChange={e => setNewUser({ ...newUser, email: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>Username Name *</label>
                  <input
                    type="text" placeholder="Enter Username"
                    style={inputStyle}
                    autoComplete="new-password"
                    value={newUser.username}
                    onChange={e => setNewUser({ ...newUser, username: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>Password *</label>
                  <input
                    type="password" placeholder="Enter Password"
                    style={inputStyle}
                    autoComplete="new-password"
                    value={newUser.password}
                    onChange={e => setNewUser({ ...newUser, password: e.target.value })}
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569', margin: 0 }}>Select User</label>
                    <button
                      type="button"
                      onClick={() => setIsAddUserOpen(true)}
                      className="text-xs text-orange-600 font-bold hover:underline cursor-pointer flex items-center gap-0.5"
                    >
                      <Plus size={12} /> Add User
                    </button>
                  </div>
                  <select
                    style={inputStyle}
                    value={existingUserSelection.userId}
                    onChange={e => setExistingUserSelection({ ...existingUserSelection, userId: e.target.value })}
                  >
                    <option value="">-- Choose User --</option>
                    {users.filter(u => u.role !== 'superadmin').map(u => <option key={u.id} value={u.id}>{u.name || u.email}</option>)}
                  </select>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569', margin: 0 }}>Select Group</label>
                    <button
                      type="button"
                      onClick={() => setIsAddGroupOpen(true)}
                      className="text-xs text-orange-600 font-bold hover:underline cursor-pointer flex items-center gap-0.5"
                    >
                      <Plus size={12} /> Add Group
                    </button>
                  </div>
                  <select
                    style={inputStyle}
                    value={existingUserSelection.groupId}
                    onChange={e => setExistingUserSelection({ ...existingUserSelection, groupId: e.target.value })}
                  >
                    <option value="">-- Choose Group --</option>
                    {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569', margin: 0 }}>Select Organization</label>
                    {(isSuperAdmin || isDealer) && (
                      <button
                        type="button"
                        onClick={() => setIsAddOrgOpen(true)}
                        className="text-xs text-orange-600 font-bold hover:underline cursor-pointer flex items-center gap-0.5"
                      >
                        <Plus size={12} /> Add Org
                      </button>
                    )}
                  </div>
                  <select
                    style={inputStyle}
                    value={existingUserSelection.orgId}
                    onChange={e => setExistingUserSelection({ ...existingUserSelection, orgId: e.target.value })}
                  >
                    <option value="">-- Choose Organization --</option>
                    {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </select>
                </div>
              </div>
            )}

            <hr style={{ borderTop: '1px solid #F1F5F9', borderBottom: 'none', margin: '0 0 32px 0' }} />

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#EEF5F8', color: '#f97316', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>3</div>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#111827', margin: 0 }}>Device Configuration</h2>
            </div>

            {/* Device Table */}

            {devices.length > 0 && (
              <div style={{ overflowX: 'auto', border: '1px solid #E2E8F0', borderRadius: '12px', marginBottom: '40px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: '#F8FAFC', color: '#475569' }}>
                      <th style={{ padding: '14px 16px', fontSize: '13px', fontWeight: 600, width: '40px', borderRight: '1px solid rgba(255,255,255,0.2)' }}>No</th>
                      <th style={{ padding: '14px 16px', fontSize: '13px', fontWeight: 600, borderRight: '1px solid rgba(255,255,255,0.2)' }}>LicenceId ({licenceType})</th>
                      <th style={{ padding: '14px 16px', fontSize: '13px', fontWeight: 600, borderRight: '1px solid rgba(255,255,255,0.2)' }}>Device ID(IMEI)</th>
                      <th style={{ padding: '14px 16px', fontSize: '13px', fontWeight: 600, borderRight: '1px solid rgba(255,255,255,0.2)' }}>VLTD SLNO</th>
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
                            <div style={{ padding: '8px 12px', background: '#EEF5F8', border: '1px solid #E2E8F0', borderRadius: '6px', fontSize: '13px', color: '#64748B', fontFamily: 'monospace' }}>
                              {device.licenceId}
                            </div>
                          </td>
                          <td style={{ padding: '14px 16px', borderRight: '1px solid #F1F5F9' }}>
                            <input
                              type="text" placeholder="Enter Device ID" value={device.deviceId}
                              onChange={(e) => updateDevice(idx, 'deviceId', e.target.value)}
                              style={{ ...inputStyle, padding: '8px 12px' }}
                            />
                          </td>
                          <td style={{ padding: '14px 16px', borderRight: '1px solid #F1F5F9' }}>
                            <input
                              type="text" placeholder="Enter VLTD SLNO" value={device.vlttdSlno}
                              onChange={(e) => updateDevice(idx, 'vlttdSlno', e.target.value)}
                              style={{ ...inputStyle, padding: '8px 12px' }}
                            />
                          </td>
                          <td style={{ padding: '14px 16px', borderRight: '1px solid #F1F5F9' }}>
                            <select
                              value={device.deviceType}
                              onChange={(e) => updateDevice(idx, 'deviceType', e.target.value)}
                              style={{ ...inputStyle, padding: '8px 12px' }}
                            >
                              <option value="VOLTY">VOLTY (5004)</option>
                              <option value="CONCOX">CONCOX (5002)</option>
                              <option value="AIS140 V2">AIS140 V2 (5003)</option>
                              <option value="FMB 920">FMB 920 (5005)</option>
                              <option value="EC08">EC08 (5007)</option>
                              <option value="BSTPL">BSTPL (5000)</option>
                              <option value="AIS140">AIS140 (5001)</option>
                            </select>
                          </td>
                          <td style={{ padding: '14px 16px', borderRight: '1px solid #F1F5F9' }}>
                            <input
                              type="text" placeholder="Enter Vehicle Id" value={device.vehicleId}
                              onChange={(e) => updateDevice(idx, 'vehicleId', e.target.value)}
                              style={{ ...inputStyle, padding: '8px 12px' }}
                            />
                          </td>
                          <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                            <button
                              onClick={() => toggleRowExpansion(idx)}
                              style={{ padding: '8px 16px', background: '#f97316', color: '#FFF', fontSize: '12px', fontWeight: 600, border: 'none', borderRadius: '6px', cursor: 'pointer', boxShadow: '0 2px 4px rgba(16,185,129,0.2)' }}
                            >
                              {expandedRows[idx] ? 'Hide Details' : 'Show Details'}
                            </button>
                          </td>
                        </tr>
                        {expandedRows[idx] && (
                          <tr style={{ background: '#FAFAFA', borderBottom: '1px solid #E2E8F0' }}>
                            <td style={{ borderRight: '1px solid #F1F5F9' }}></td>
                            <td colSpan="5" style={{ padding: '24px' }}>
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 py-2">
                                <div>
                                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#64748B', marginBottom: '6px', display: 'block' }}>Vehicle Name</label>
                                  <input
                                    type="text" placeholder="Vehicle Name" value={device.vehicleName}
                                    onChange={(e) => updateDevice(idx, 'vehicleName', e.target.value)}
                                    style={{ ...inputStyle, padding: '10px 14px' }}
                                  />
                                </div>
                                <div>
                                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#64748B', marginBottom: '6px', display: 'block' }}>Registration No</label>
                                  <input
                                    type="text" placeholder="e.g. MH12AB1234" value={device.registrationNo}
                                    onChange={(e) => updateDevice(idx, 'registrationNo', e.target.value)}
                                    style={{ ...inputStyle, padding: '10px 14px' }}
                                  />
                                </div>
                                <div>
                                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#64748B', marginBottom: '6px', display: 'block' }}>Vehicle Type</label>
                                  <select
                                    value={device.vehicleTypeSelect}
                                    onChange={(e) => updateDevice(idx, 'vehicleTypeSelect', e.target.value)}
                                    style={{ ...inputStyle, padding: '10px 14px' }}
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
                                    style={{ ...inputStyle, padding: '10px 14px' }}
                                  />
                                </div>
                                <div>
                                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#64748B', marginBottom: '6px', display: 'block' }}>GPS SIMNO 1</label>
                                  <input
                                    type="text" placeholder="GPS SIMNO 1" value={device.gpsSimNo}
                                    onChange={(e) => updateDevice(idx, 'gpsSimNo', e.target.value)}
                                    style={{ ...inputStyle, padding: '10px 14px' }}
                                  />
                                </div>
                                <div>
                                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#64748B', marginBottom: '6px', display: 'block' }}>GPS SIMNO 2</label>
                                  <input
                                    type="text" placeholder="GPS SIMNO 2" value={device.gpsSimNo2 || ''}
                                    onChange={(e) => updateDevice(idx, 'gpsSimNo2', e.target.value)}
                                    style={{ ...inputStyle, padding: '10px 14px' }}
                                  />
                                </div>
                                <div>
                                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#64748B', marginBottom: '6px', display: 'block' }}>Odo Distance</label>
                                  <input
                                    type="text" placeholder="Odo Distance" value={device.odoDistance}
                                    onChange={(e) => updateDevice(idx, 'odoDistance', e.target.value)}
                                    style={{ ...inputStyle, padding: '10px 14px' }}
                                  />
                                </div>
                                <div>
                                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#64748B', marginBottom: '6px', display: 'block' }}>Service Engineer</label>
                                  <input
                                    type="text" placeholder="Service Engineer" value={device.serviceEngineer}
                                    onChange={(e) => updateDevice(idx, 'serviceEngineer', e.target.value)}
                                    style={{ ...inputStyle, padding: '10px 14px' }}
                                  />
                                </div>
                                <div>
                                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#64748B', marginBottom: '6px', display: 'block' }}>Service Engineer Mobno</label>
                                  <input
                                    type="text" placeholder="Engineer Mobno" value={device.serviceEngineerMob || ''}
                                    onChange={(e) => updateDevice(idx, 'serviceEngineerMob', e.target.value)}
                                    style={{ ...inputStyle, padding: '10px 14px' }}
                                  />
                                </div>
                                <div>
                                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#64748B', marginBottom: '6px', display: 'block' }}>Salesman</label>
                                  <input
                                    type="text" placeholder="Salesman" value={device.salesman}
                                    onChange={(e) => updateDevice(idx, 'salesman', e.target.value)}
                                    style={{ ...inputStyle, padding: '10px 14px' }}
                                  />
                                </div>
                                <div>
                                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#64748B', marginBottom: '6px', display: 'block' }}>Salesman Mobno</label>
                                  <input
                                    type="text" placeholder="Salesman Mobno" value={device.salesmanMob || ''}
                                    onChange={(e) => updateDevice(idx, 'salesmanMob', e.target.value)}
                                    style={{ ...inputStyle, padding: '10px 14px' }}
                                  />
                                </div>
                                <div>
                                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#64748B', marginBottom: '6px', display: 'block' }}>Ticket Id</label>
                                  <input
                                    type="text" placeholder="Ticket Id" value={device.ticketId}
                                    onChange={(e) => updateDevice(idx, 'ticketId', e.target.value)}
                                    style={{ ...inputStyle, padding: '10px 14px' }}
                                  />
                                </div>
                                <div>
                                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#64748B', marginBottom: '6px', display: 'block' }}>Sensor No</label>
                                  <input
                                    type="text" placeholder="Sensor No" value={device.sensorNo}
                                    onChange={(e) => updateDevice(idx, 'sensorNo', e.target.value)}
                                    style={{ ...inputStyle, padding: '10px 14px' }}
                                  />
                                </div>
                                <div>
                                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#64748B', marginBottom: '6px', display: 'block' }}>ICCID</label>
                                  <input
                                    type="text" placeholder="ICCID" value={device.iccid || ''}
                                    onChange={(e) => updateDevice(idx, 'iccid', e.target.value)}
                                    style={{ ...inputStyle, padding: '10px 14px' }}
                                  />
                                </div>
                                <div>
                                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#64748B', marginBottom: '6px', display: 'block' }}>Vehicle Voltage</label>
                                  <input
                                    type="text" placeholder="e.g. 12V" value={device.vehicleVoltage || ''}
                                    onChange={(e) => updateDevice(idx, 'vehicleVoltage', e.target.value)}
                                    style={{ ...inputStyle, padding: '10px 14px' }}
                                  />
                                </div>
                                <div>
                                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#64748B', marginBottom: '6px', display: 'block' }}>Timezone</label>
                                  <select
                                    value={device.timezone || 'IST'}
                                    onChange={(e) => updateDevice(idx, 'timezone', e.target.value)}
                                    style={{ ...inputStyle, padding: '10px 14px' }}
                                  >
                                    <option value="IST">IST</option>
                                    <option value="UTC">UTC</option>
                                    <option value="Asia/Kolkata">Asia/Kolkata</option>
                                  </select>
                                </div>
                                <div>
                                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#64748B', marginBottom: '6px', display: 'block' }}>Ignition Detection</label>
                                  <select
                                    value={device.ignitionDetection || 'ENGINE ON STATUS WITH IGNITION'}
                                    onChange={(e) => updateDevice(idx, 'ignitionDetection', e.target.value)}
                                    style={{ ...inputStyle, padding: '10px 14px' }}
                                  >
                                    <option value="ENGINE ON STATUS WITH IGNITION">ENGINE ON STATUS WITH IGNITION</option>
                                    <option value="IGNITION + VOLTAGE">IGNITION + VOLTAGE</option>
                                    <option value="VOLTAGE">VOLTAGE</option>
                                  </select>
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
                style={{ padding: '14px 48px', borderRadius: '10px', fontSize: '15px', fontWeight: 700, color: '#FFFFFF', background: '#f97316', border: 'none', cursor: isSubmitting ? 'not-allowed' : 'pointer', opacity: isSubmitting ? 0.7 : 1, display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 16px rgba(249,115,22,0.3)' }}
              >
                {isSubmitting ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
                Submit Devices
              </button>
            </div>
          </div>
        )}

      </div>

      {/* Excel Upload Modal */}
      <ExcelBulkUploadModal
        isOpen={isExcelModalOpen}
        onClose={() => setIsExcelModalOpen(false)}
        onSuccess={() => {
          setIsExcelModalOpen(false);
          navigate('/admin/devices');
        }}
        availableGroups={groups}
        availableOrgs={orgs}
        currentOrgId={user?.orgId}
        isSuperAdmin={isSuperAdmin}
      />

      {/* Quick Add Org Modal */}
      {isAddOrgOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 p-6 w-full max-w-md space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-800">Quick Add Organization</h3>
              <button onClick={() => setIsAddOrgOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Organization Name</label>
                <input type="text" value={newOrgName} onChange={e => setNewOrgName(e.target.value)} placeholder="e.g. Apex Logistics" className="w-full px-3 py-2 border rounded-lg text-xs" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Organization Type</label>
                <select value={newOrgType} onChange={e => setNewOrgType(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-xs">
                  <option value="company">Company</option>
                  <option value="dealer">Dealer</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setIsAddOrgOpen(false)} className="px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 rounded-lg">Cancel</button>
              <button
                disabled={orgCreating || !newOrgName.trim()}
                onClick={async () => {
                  setOrgCreating(true);
                  try {
                    const res = await createOrg({ name: newOrgName, type: newOrgType });
                    if (res.success) {
                      alert(`Organization "${newOrgName}" created successfully!`);
                      setIsAddOrgOpen(false);
                      setNewOrgName('');
                      adminApi.getOrgs?.().then(r => setOrgs(r.data || []));
                    }
                  } catch (err) {
                    alert(err.response?.data?.error || 'Failed to create organization');
                  } finally {
                    setOrgCreating(false);
                  }
                }}
                className="px-4 py-1.5 text-xs font-bold text-white bg-orange-600 rounded-lg cursor-pointer"
              >
                {orgCreating ? 'Creating...' : 'Save Organization'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Add Group Modal */}
      {isAddGroupOpen && (
        <AddGroupModal
          isOpen={isAddGroupOpen}
          onClose={() => setIsAddGroupOpen(false)}
          orgs={orgs}
          onSave={async (groupData) => {
            try {
              await adminApi.createGroup(groupData);
              setIsAddGroupOpen(false);
              const r = await adminApi.getGroups?.();
              setGroups(r?.data || []);
            } catch (err) {
              throw err;
            }
          }}
        />
      )}

      {/* Quick Add User Modal */}
      {isAddUserOpen && (
        <AddUserModal
          isOpen={isAddUserOpen}
          onClose={() => setIsAddUserOpen(false)}
          orgs={orgs}
          onSave={async (userData) => {
            try {
              await adminApi.createUser(userData);
              setIsAddUserOpen(false);
              const r = await adminApi.getUsers?.();
              setUsers(r?.data || []);
            } catch (err) {
              throw err;
            }
          }}
        />
      )}
    </div>
  );
};

export default OnBoardDevicePage;
