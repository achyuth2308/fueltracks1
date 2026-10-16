import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { Cpu, Save, Loader2, Home, ChevronRight, CheckCircle, AlertTriangle, AlertCircle, Eye, EyeOff, Upload, FileUp, Shield, FileSpreadsheet, Download, Plus, X, Globe } from 'lucide-react';
import { adminApi } from '../../api/axios';
import { getDeviceQuota, createOrg } from '../../api/adminApi';
import { useAuth } from '../../hooks/useAuth';
import ExcelBulkUploadModal from '../../components/ExcelBulkUploadModal';
import GoogleFormModal from '../../components/GoogleFormModal';
import AddGroupModal from '../../components/modals/AddGroupModal';
import AddUserModal from '../../components/modals/AddUserModal';
import { generateVehicleOnboardingTemplate } from '../../utils/excelTemplateGenerator';
import SearchableSelect from '../../components/ui/SearchableSelect';

// Device types in ascending order based on port numbers (5000 -> 5011)
const DEVICE_TYPE_OPTIONS = [
  { value: 'BSTPL', label: 'BSTPL - BSTPL-17 (5000)' },
  { value: 'AIS140', label: 'TrackNow - AIS140 (5001)' },
  { value: 'CONCOX', label: 'CONCOX - V5/GT800 (5002)' },
  { value: 'AIS140 V2', label: 'VAMO - AIS140 V2 (5003)' },
  { value: 'VOLTY', label: 'VOLTY - AIS140 (5004)' },
  { value: 'FMB 920', label: 'Teltonika - FMB 920 (5005)' },
  { value: 'PT06', label: 'PT06 - Binary (5006)' },
  { value: 'EC08', label: 'EC08 - GT06 (5007)' },
  { value: 'PN02', label: 'PN02 - Binary (5008)' },
  { value: 'V5 4G', label: 'CONCOX - V5 4G (5009)' },
  { value: 'BSTPL-17IS', label: 'BSTPL - BSTPL-17IS (5010)' },
  { value: 'VOLTYFUEL', label: 'TranSync - NAV 140 (5011)' },
];

const LICENCE_TYPE_OPTIONS = [
  { value: 'Starter', label: 'Starter' },
  { value: 'Basic', label: 'Basic' },
  { value: 'Advanced', label: 'Advanced' },
  { value: 'Premium', label: 'Premium' },
];

const VEHICLE_TYPE_OPTIONS = [
  { value: 'Truck', label: 'Truck' },
  { value: 'Car', label: 'Car' },
  { value: 'Van', label: 'Van' },
  { value: 'Bus', label: 'Bus' },
  { value: 'Scooty', label: 'Scooty' },
  { value: 'Motorcycle', label: 'Motorcycle' },
  { value: 'Tractor', label: 'Tractor' },
  { value: 'JCB', label: 'JCB' },
  { value: 'Crane', label: 'Crane' },
  { value: 'Ambulance', label: 'Ambulance' },
  { value: 'Pickup', label: 'Pickup' },
  { value: 'Borewell', label: 'Borewell' },
  { value: 'Tanker', label: 'Tanker' },
];

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
  const [isGoogleFormModalOpen, setIsGoogleFormModalOpen] = useState(false);

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
  const [showPassword, setShowPassword] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const isPasswordError = passwordTouched && newUser.password.length > 0 && newUser.password.length < 6;

  const [users, setUsers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [orgs, setOrgs] = useState([]);

  const handleExistingUserChange = (selectedUserId) => {
    if (!selectedUserId) {
      setExistingUserSelection({ userId: '', groupId: '', orgId: '' });
      return;
    }

    const selectedUser = users.find(u => String(u.id) === String(selectedUserId));
    let autoGroupId = '';

    // 1. Try to find group from selectedUser.groups (joined array from backend)
    if (selectedUser?.groups && Array.isArray(selectedUser.groups) && selectedUser.groups.length > 0) {
      autoGroupId = selectedUser.groups[0].id;
    }

    // 2. If not found, match group name with user's name or username (e.g. "SRISAIMANIKANTABOREWELL:VAM")
    if (!autoGroupId && selectedUser && groups.length > 0) {
      const uName = (selectedUser.name || '').toLowerCase().trim();
      const uUsername = (selectedUser.username || '').toLowerCase().trim();
      const match = groups.find(g => {
        const gName = (g.name || '').toLowerCase().trim();
        return (uName && gName.includes(uName)) || (uUsername && gName.includes(uUsername));
      });
      if (match) {
        autoGroupId = match.id;
      }
    }

    // 3. Fallback: If user belongs to an org, check if there's a group in that org
    const userOrgId = selectedUser?.org_id || selectedUser?.orgId || '';
    if (!autoGroupId && userOrgId && groups.length > 0) {
      const orgGroup = groups.find(g => g.org_id === userOrgId || g.orgId === userOrgId);
      if (orgGroup) {
        autoGroupId = orgGroup.id;
      }
    }

    setExistingUserSelection(prev => ({
      ...prev,
      userId: selectedUserId,
      groupId: autoGroupId || ''
    }));
  };

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
          deviceType: String(row['Device Type'] || row['Device Type (VOLTY/AIS140/CONCOX/AIS140V2/FMB 920)'] || row['Device Type (VOLTY/BSTPL/AS140/CONCOX/AIS140V2/FMB 920)'] || row['Device Type (BSTPL/AS140/AIS140V2/CONCOX/VOLTY/FMB 920)'] || row['Device Type (BSTPL/AS140/AIS140V2/CONCOX/VOLTY)'] || row['Device Type (BSTPL/AS140/AIS140V2/CONCOX)'] || 'VOLTY').trim(),
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
        deviceType: 'VOLTY',
        vehicleId: '',
        vehicleName: '',
        vehicleTypeSelect: '',
        gpsSimNo: '',
        odoDistance: '',
        serviceEngineer: '',
        salesman: '',
        supportPerson: '',
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

      if (userType === 'new') {
        if (!newUser.username?.trim()) throw new Error('User Name is required.');
        if (!newUser.email?.trim()) throw new Error('Email is required.');
        if (!newUser.password) {
          setPasswordTouched(true);
          throw new Error('Password is required.');
        }
        if (newUser.password.length < 6) {
          setPasswordTouched(true);
          throw new Error('Please, Enter minimum 6 characters or more for password.');
        }
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
    color: '#475569', // Distinct Dark Slate Grey for entered values
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

      {/* Minimalist Bulk Onboarding Callout */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-5 mb-6">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-orange-50 border border-orange-100 flex items-center justify-center shrink-0">
            <FileSpreadsheet size={22} className="text-orange-500" />
          </div>
          <div className="flex items-center gap-2.5">
            <span className="text-base font-bold text-slate-800">Bulk Onboarding</span>
            <span className="text-xs font-semibold text-orange-600 bg-orange-50 border border-orange-200 px-2.5 py-0.5 rounded-md">
              Fast Import
            </span>
          </div>
        </div>

        <div className="flex items-center flex-wrap gap-3 shrink-0">
          <button
            onClick={() => setIsGoogleFormModalOpen(true)}
            className="px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl font-semibold text-xs sm:text-sm flex items-center gap-2 transition-all cursor-pointer shadow-xs"
          >
            <Globe size={16} className="text-slate-500" />
            <span>Google Form</span>
          </button>
          <button
            onClick={() => generateVehicleOnboardingTemplate(groups, user?.orgName)}
            className="px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl font-semibold text-xs sm:text-sm flex items-center gap-2 transition-all cursor-pointer shadow-xs"
          >
            <Download size={16} className="text-slate-500" />
            <span>Excel Template</span>
          </button>
          <button
            onClick={() => setIsExcelModalOpen(true)}
            className="px-5 py-2.5 bg-slate-900 hover:bg-black text-white rounded-xl font-semibold text-xs sm:text-sm flex items-center gap-2 transition-all cursor-pointer shadow-sm"
          >
            <FileSpreadsheet size={16} className="text-amber-400" />
            <span>Upload Excel</span>
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
                <label className="text-[14px] font-[600] text-gray-900 w-full sm:w-[40%] mb-2 sm:mb-0">Licence Type :</label>
                <div className="w-full sm:w-[60%]">
                  <SearchableSelect
                    options={LICENCE_TYPE_OPTIONS}
                    value={licenceType}
                    onChange={(val) => setLicenceType(val || 'Starter')}
                    placeholder="-- Select Licence Type --"
                    searchPlaceholder="Search licence type..."
                    triggerStyle={{
                      padding: '10px 14px',
                      fontSize: '14px',
                      borderColor: '#CBD5E1',
                      background: '#FFFFFF'
                    }}
                  />
                </div>
              </div>

              <div className="flex flex-col border-b border-slate-100 pb-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between">
                  <label className="text-[14px] font-[600] text-gray-900 w-full sm:w-[40%] mb-2 sm:mb-0">Quantity :</label>
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
            <div style={{ marginBottom: '24px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#111827', margin: 0 }}>Business Information</h2>
            </div>

            {/* Top Toggle */}
            <div className="flex flex-col sm:flex-row gap-4 sm:gap-12 mb-8 p-4 bg-slate-50 rounded-xl border border-slate-200">
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 600, color: userType === 'new' ? '#f97316' : '#111827' }}>
                <input
                  type="radio"
                  style={{ accentColor: '#f97316', width: '16px', height: '16px' }}
                  checked={userType === 'new'}
                  onChange={() => setUserType('new')}
                />
                New User
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 600, color: userType === 'existing' ? '#f97316' : '#111827' }}>
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
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#111827', marginBottom: '8px' }}>User Name *</label>
                  <input
                    type="text" placeholder="User Name"
                    style={inputStyle}
                    autoComplete="new-password"
                    value={newUser.username}
                    onChange={e => setNewUser({ ...newUser, username: e.target.value, name: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#111827', marginBottom: '8px' }}>Mobile Number *</label>
                  <input
                    type="text" placeholder="Mobile Number"
                    style={inputStyle}
                    value={newUser.phone}
                    onChange={e => setNewUser({ ...newUser, phone: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#111827', marginBottom: '8px' }}>Email *</label>
                  <input
                    type="email" placeholder="Email"
                    style={inputStyle}
                    value={newUser.email}
                    onChange={e => setNewUser({ ...newUser, email: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#111827', marginBottom: '8px' }}>Password *</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Password"
                      style={{
                        ...inputStyle,
                        paddingRight: '36px',
                        borderColor: isPasswordError ? '#EF4444' : '#CBD5E1',
                        boxShadow: isPasswordError ? '0 0 0 1px rgba(239, 68, 68, 0.2)' : 'none'
                      }}
                      autoComplete="new-password"
                      value={newUser.password}
                      onChange={e => {
                        setPasswordTouched(true);
                        setNewUser({ ...newUser, password: e.target.value });
                      }}
                      onBlur={() => setPasswordTouched(true)}
                    />
                    <div style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center' }}>
                      {isPasswordError ? (
                        <AlertCircle size={16} color="#EF4444" />
                      ) : newUser.password ? (
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', color: '#94A3B8', display: 'flex', alignItems: 'center' }}
                        >
                          {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      ) : null}
                    </div>
                  </div>
                  {isPasswordError && (
                    <div style={{ color: '#EF4444', fontSize: '12px', marginTop: '6px', fontWeight: 500 }}>
                      Please, Enter minimum 6 characters or more
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label style={{ fontSize: '13px', fontWeight: 600, color: '#111827', margin: 0 }}>Select User</label>
                  </div>
                  <SearchableSelect
                    options={users
                      .filter(u => u.role !== 'superadmin')
                      .map(u => ({
                        value: u.id,
                        label: u.name || u.email,
                        sublabel: u.name && u.email ? u.email : undefined
                      }))}
                    value={existingUserSelection.userId}
                    onChange={handleExistingUserChange}
                    placeholder="-- Choose User --"
                    searchPlaceholder="Search user..."
                    emptyMessage="No users found"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label style={{ fontSize: '13px', fontWeight: 600, color: '#111827', margin: 0 }}>Select Group</label>
                  </div>
                  <SearchableSelect
                    options={groups.map(g => ({
                      value: g.id,
                      label: g.name
                    }))}
                    value={existingUserSelection.groupId}
                    onChange={val => setExistingUserSelection(prev => ({ ...prev, groupId: val }))}
                    placeholder="-- Choose Group --"
                    searchPlaceholder="Search group..."
                    emptyMessage="No groups found"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label style={{ fontSize: '13px', fontWeight: 600, color: '#111827', margin: 0 }}>Select Organization</label>
                  </div>
                  <SearchableSelect
                    options={orgs.map(o => ({
                      value: o.id,
                      label: o.name
                    }))}
                    value={existingUserSelection.orgId}
                    onChange={val => setExistingUserSelection(prev => ({ ...prev, orgId: val }))}
                    placeholder="-- Choose Organization --"
                    searchPlaceholder="Search organization..."
                    emptyMessage="No organizations found"
                  />
                </div>
              </div>
            )}

            <hr style={{ borderTop: '1px solid #F1F5F9', borderBottom: 'none', margin: '0 0 32px 0' }} />

            <div style={{ marginBottom: '20px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#111827', margin: 0 }}>Device Configuration</h2>
            </div>

            {/* Device Table */}
            {devices.length > 0 && (
              <div style={{ overflowX: 'auto', border: '1px solid #E2E8F0', borderRadius: '12px', marginBottom: '40px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: '#F1F5F9', color: '#000000' }}>
                      <th style={{ padding: '14px 16px', fontSize: '13px', fontWeight: 700, width: '40px', borderRight: '1px solid #E2E8F0' }}>No</th>
                      <th style={{ padding: '14px 16px', fontSize: '13px', fontWeight: 700, borderRight: '1px solid #E2E8F0' }}>LicenceId ({licenceType})</th>
                      <th style={{ padding: '14px 16px', fontSize: '13px', fontWeight: 700, borderRight: '1px solid #E2E8F0' }}>Device ID(IMEI)</th>
                      <th style={{ padding: '14px 16px', fontSize: '13px', fontWeight: 700, borderRight: '1px solid #E2E8F0' }}>Device Type</th>
                      <th style={{ padding: '14px 16px', fontSize: '13px', fontWeight: 700, borderRight: '1px solid #E2E8F0' }}>Vehicle Id</th>
                      <th style={{ padding: '14px 16px', fontSize: '13px', fontWeight: 700, textAlign: 'center' }}>Action</th>
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
                          <td style={{ padding: '14px 16px', borderRight: '1px solid #F1F5F9', minWidth: '240px' }}>
                            <SearchableSelect
                              options={DEVICE_TYPE_OPTIONS}
                              value={device.deviceType}
                              onChange={(val) => updateDevice(idx, 'deviceType', val || 'VOLTY')}
                              placeholder="-- Select Device Type --"
                              searchPlaceholder="Search type or port..."
                              emptyMessage="No device type found"
                              usePortal={true}
                              triggerStyle={{
                                padding: '8px 12px',
                                fontSize: '13px',
                                borderColor: '#CBD5E1',
                                background: '#FFFFFF'
                              }}
                            />
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
                              type="button"
                              onClick={() => toggleRowExpansion(idx)}
                              style={{ padding: '8px 16px', background: '#f97316', color: '#FFF', fontSize: '12px', fontWeight: 600, border: 'none', borderRadius: '6px', cursor: 'pointer', boxShadow: '0 2px 4px rgba(249,115,22,0.2)' }}
                            >
                              {expandedRows[idx] ? 'Hide Details' : 'Show Details'}
                            </button>
                          </td>
                        </tr>
                        {expandedRows[idx] && (
                          <tr style={{ background: '#FAFAFA', borderBottom: '1px solid #E2E8F0' }}>
                            <td style={{ borderRight: '1px solid #F1F5F9' }}></td>
                            <td colSpan="5" style={{ padding: '24px' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                {/* Row 1: 4 fields */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                                  <div>
                                    <label style={{ fontSize: '12px', fontWeight: 600, color: '#111827', marginBottom: '6px', display: 'block' }}>Vehicle Name</label>
                                    <input
                                      type="text" placeholder="Vehicle Name" value={device.vehicleName}
                                      onChange={(e) => updateDevice(idx, 'vehicleName', e.target.value)}
                                      style={{ ...inputStyle, padding: '10px 14px' }}
                                    />
                                  </div>
                                  <div>
                                    <label style={{ fontSize: '12px', fontWeight: 600, color: '#111827', marginBottom: '6px', display: 'block' }}>Vehicle Type</label>
                                    <SearchableSelect
                                      options={VEHICLE_TYPE_OPTIONS}
                                      value={device.vehicleTypeSelect}
                                      onChange={(val) => updateDevice(idx, 'vehicleTypeSelect', val)}
                                      placeholder="-- Select Vehicle Type --"
                                      searchPlaceholder="Search vehicle type..."
                                      emptyMessage="No vehicle type found"
                                      usePortal={true}
                                      triggerStyle={{
                                        padding: '10px 14px',
                                        fontSize: '14px',
                                        borderColor: '#CBD5E1',
                                        background: '#FFFFFF'
                                      }}
                                    />
                                  </div>
                                  <div>
                                    <label style={{ fontSize: '12px', fontWeight: 600, color: '#111827', marginBottom: '6px', display: 'block' }}>GPS SIM No</label>
                                    <input
                                      type="text" placeholder="GPS SIM No" value={device.gpsSimNo}
                                      onChange={(e) => updateDevice(idx, 'gpsSimNo', e.target.value)}
                                      style={{ ...inputStyle, padding: '10px 14px' }}
                                    />
                                  </div>
                                  <div>
                                    <label style={{ fontSize: '12px', fontWeight: 600, color: '#111827', marginBottom: '6px', display: 'block' }}>Odo Distance</label>
                                    <input
                                      type="text" placeholder="Odo Distance" value={device.odoDistance}
                                      onChange={(e) => updateDevice(idx, 'odoDistance', e.target.value)}
                                      style={{ ...inputStyle, padding: '10px 14px' }}
                                    />
                                  </div>
                                </div>

                                {/* Row 2: 5 fields */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
                                  <div>
                                    <label style={{ fontSize: '12px', fontWeight: 600, color: '#111827', marginBottom: '6px', display: 'block' }}>Service Engineer</label>
                                    <SearchableSelect
                                      options={users.map(u => ({
                                        value: u.name || u.email,
                                        label: u.name || u.email,
                                        sublabel: u.name && u.email ? u.email : undefined
                                      }))}
                                      value={device.serviceEngineer}
                                      onChange={(val) => updateDevice(idx, 'serviceEngineer', val)}
                                      placeholder="-- Select Engineer --"
                                      searchPlaceholder="Search engineer..."
                                      emptyMessage="No engineer found"
                                      usePortal={true}
                                      triggerStyle={{
                                        padding: '10px 14px',
                                        fontSize: '14px',
                                        borderColor: '#CBD5E1',
                                        background: '#FFFFFF'
                                      }}
                                    />
                                  </div>
                                  <div>
                                    <label style={{ fontSize: '12px', fontWeight: 600, color: '#111827', marginBottom: '6px', display: 'block' }}>Salesman</label>
                                    <SearchableSelect
                                      options={users.map(u => ({
                                        value: u.name || u.email,
                                        label: u.name || u.email,
                                        sublabel: u.name && u.email ? u.email : undefined
                                      }))}
                                      value={device.salesman}
                                      onChange={(val) => updateDevice(idx, 'salesman', val)}
                                      placeholder="-- Select Salesman --"
                                      searchPlaceholder="Search salesman..."
                                      emptyMessage="No salesman found"
                                      usePortal={true}
                                      triggerStyle={{
                                        padding: '10px 14px',
                                        fontSize: '14px',
                                        borderColor: '#CBD5E1',
                                        background: '#FFFFFF'
                                      }}
                                    />
                                  </div>
                                  <div>
                                    <label style={{ fontSize: '12px', fontWeight: 600, color: '#111827', marginBottom: '6px', display: 'block' }}>Support Person</label>
                                    <input
                                      type="text" placeholder="Support Person" value={device.supportPerson || ''}
                                      onChange={(e) => updateDevice(idx, 'supportPerson', e.target.value)}
                                      style={{ ...inputStyle, padding: '10px 14px' }}
                                    />
                                  </div>
                                  <div>
                                    <label style={{ fontSize: '12px', fontWeight: 600, color: '#111827', marginBottom: '6px', display: 'block' }}>Ticket Id</label>
                                    <input
                                      type="text" placeholder="Ticket Id" value={device.ticketId}
                                      onChange={(e) => updateDevice(idx, 'ticketId', e.target.value)}
                                      style={{ ...inputStyle, padding: '10px 14px' }}
                                    />
                                  </div>
                                  <div>
                                    <label style={{ fontSize: '12px', fontWeight: 600, color: '#111827', marginBottom: '6px', display: 'block' }}>Sensor No</label>
                                    <input
                                      type="text" placeholder="Sensor No" value={device.sensorNo}
                                      onChange={(e) => updateDevice(idx, 'sensorNo', e.target.value)}
                                      style={{ ...inputStyle, padding: '10px 14px' }}
                                    />
                                  </div>
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
                {devices.length > 1 ? 'Submit Devices' : 'Submit'}
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

      {/* Google Form Link & Integration Modal */}
      <GoogleFormModal
        isOpen={isGoogleFormModalOpen}
        onClose={() => setIsGoogleFormModalOpen(false)}
      />
    </div>
  );
};

export default OnBoardDevicePage;
