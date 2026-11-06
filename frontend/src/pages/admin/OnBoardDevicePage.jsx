import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { Cpu, ArrowLeft, Save, Loader2, Home, ChevronRight, ChevronDown, ChevronUp, CheckCircle, AlertTriangle, AlertCircle, Eye, EyeOff, Upload, FileUp, Shield, FileSpreadsheet, Download, Plus, X } from 'lucide-react';
import { adminApi } from '../../api/axios';
import { getDeviceQuota, createOrg } from '../../api/adminApi';
import { useAuth } from '../../hooks/useAuth';
import ExcelBulkUploadModal from '../../components/ExcelBulkUploadModal';
import AddGroupModal from '../../components/modals/AddGroupModal';
import AddUserModal from '../../components/modals/AddUserModal';
import { generateVehicleOnboardingTemplate } from '../../utils/excelTemplateGenerator';
import SearchableSelect from '../../components/ui/SearchableSelect';

// Device types in ascending order based on port numbers (5000 -> 5012)
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
  { value: 'APMK', label: 'APM - APM (5012)' },
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
  { value: 'Tipper', label: 'Tipper' },
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

  // Pre-table state (Step 1)
  const [licenceType, setLicenceType] = useState('Starter');
  const [numDevices, setNumDevices] = useState('');

  // Quota state (for dealers)
  const [quota, setQuota] = useState(null);
  const [quotaLoading, setQuotaLoading] = useState(false);

  // Step 2 state
  const [userType, setUserType] = useState('new'); // 'new' | 'existing'
  const [deviceEntryMode, setDeviceEntryMode] = useState('details'); // 'upload' | 'details'

  const [newUser, setNewUser] = useState({ name: '', phone: '', location: '', email: '', username: '', password: '', aadhar: '', existingGroupId: '' });
  const [existingUserSelection, setExistingUserSelection] = useState({ userId: '', groupId: '', additionalGroupId: '', orgId: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const isPasswordError = passwordTouched && newUser.password.length > 0 && newUser.password.length < 6;

  const [users, setUsers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [orgs, setOrgs] = useState([]);

  const [usernameTouched, setUsernameTouched] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);

  const isUsernameExists = useMemo(() => {
    if (!usernameTouched || !newUser.username?.trim()) return false;
    const clean = newUser.username.trim().toLowerCase();
    return users.some(u => (u.username || '').trim().toLowerCase() === clean);
  }, [usernameTouched, newUser.username, users]);

  const isEmailExists = useMemo(() => {
    if (!emailTouched || !newUser.email?.trim()) return false;
    const clean = newUser.email.trim().toLowerCase();
    return users.some(u => (u.email || '').trim().toLowerCase() === clean);
  }, [emailTouched, newUser.email, users]);

  // Whitelist: strictly API integration groups only for secondary group assignment
  const apiIntegrationGroups = useMemo(() => {
    const allowed = ['minestamilnadu', 'paddyap', 'telangana_civil_supplies'];
    return groups.filter(g => {
      const cleanName = String(g.name || '').trim().toLowerCase().replace(/\s+/g, '_');
      return allowed.some(a => cleanName === a || cleanName === a.replace(/_/g, ''));
    });
  }, [groups]);

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

    // Auto-select Organization matching user's org_id, org_name, or username
    let autoOrgId = userOrgId || '';
    if (!autoOrgId && selectedUser && orgs.length > 0) {
      const uUsername = (selectedUser.username || '').toLowerCase().trim();
      const uName = (selectedUser.name || '').toLowerCase().trim();
      const uOrgName = (selectedUser.org_name || '').toLowerCase().trim();
      const matchOrg = orgs.find(o => {
        const oName = (o.name || '').toLowerCase().trim();
        return (uOrgName && oName === uOrgName) || (uUsername && oName === uUsername) || (uName && oName === uName);
      });
      if (matchOrg) {
        autoOrgId = matchOrg.id;
      }
    }

    setExistingUserSelection(prev => ({
      ...prev,
      userId: selectedUserId,
      groupId: autoGroupId || '',
      orgId: autoOrgId || '',
      additionalGroupId: prev.additionalGroupId || ''
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
    const prevVehicleId = updated[index].vehicleId;
    updated[index][field] = value;
    if (field === 'vehicleId') {
      if (!updated[index].vehicleName || updated[index].vehicleName === prevVehicleId) {
        updated[index].vehicleName = value;
      }
    }
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
        const cleanUname = newUser.username.trim().toLowerCase();
        if (users.some(u => (u.username || '').trim().toLowerCase() === cleanUname)) {
          setUsernameTouched(true);
          throw new Error('User Name already exists. Please choose a different User Name.');
        }
        if (!newUser.email?.trim()) throw new Error('Email is required.');
        const cleanEmail = newUser.email.trim().toLowerCase();
        if (users.some(u => (u.email || '').trim().toLowerCase() === cleanEmail)) {
          setEmailTouched(true);
          throw new Error('Email already exists. Please choose a different Email.');
        } 
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
    width: '100%',
    height: '38px',
    padding: '7px 12px',
    borderRadius: '7px',
    border: '1px solid #CBD5E1',
    fontSize: '13px',
    outline: 'none',
    color: '#0F172A',
    background: '#FFFFFF',
    boxSizing: 'border-box',
    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.03)'
  };

  return (
    <div style={{ padding: '14px 20px', background: '#EEF5F8', minHeight: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>

      {/* Header and Breadcrumbs */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
        <button
          type="button"
          onClick={() => navigate(-1)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '32px',
            height: '32px',
            borderRadius: '8px',
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
          <ArrowLeft size={16} />
        </button>
        <h1 style={{ fontSize: '18px', fontWeight: 800, color: '#111827', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
          <Cpu size={20} color="#f97316" />
          Add Device
        </h1>
      </div>

      {message && (
        <div style={{ padding: '10px 14px', background: '#D1FAE5', border: '1px solid #A7F3D0', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px', color: '#059669', marginBottom: '12px' }}>
          <CheckCircle size={18} />
          <div style={{ fontSize: '13px', fontWeight: 600 }}>{message}</div>
        </div>
      )}

      {error && (
        <div style={{ padding: '10px 14px', background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px', color: '#B91C1C', marginBottom: '12px' }}>
          <AlertCircle size={18} />
          <div style={{ fontSize: '13px', fontWeight: 600 }}>{error}</div>
        </div>
      )}

      {/* Minimalist Bulk Onboarding Callout */}
      <div className="bg-white rounded-xl border border-slate-200/90 px-4 py-2.5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-orange-50 border border-orange-100 flex items-center justify-center shrink-0">
            <FileSpreadsheet size={16} className="text-orange-500" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-slate-800">Bulk Onboarding</span>
            <span className="text-[11px] font-semibold text-orange-600 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded">
              Fast Import
            </span>
          </div>
        </div>

        <div className="flex items-center flex-wrap gap-2 shrink-0">
          <button
            onClick={() => generateVehicleOnboardingTemplate(groups, user?.orgName)}
            className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg font-semibold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
          >
            <Download size={14} className="text-slate-500" />
            <span>Excel Template</span>
          </button>
          <button
            onClick={() => setIsExcelModalOpen(true)}
            className="px-3.5 py-1.5 bg-slate-900 hover:bg-black text-white rounded-lg font-semibold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
          >
            <FileSpreadsheet size={14} className="text-amber-400" />
            <span>Upload Excel</span>
          </button>
        </div>
      </div>

      <div style={{ background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '16px 20px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>

        {step === 1 && (
          <div>
            {/* Quota Banner - only for dealers */}
            {isDealer && (
              <div style={{ background: '#EEF5F8', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '14px 18px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
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
                      <div key={label} style={{ background: bg, borderRadius: '8px', padding: '8px 12px', textAlign: 'center' }}>
                        <div style={{ fontSize: '20px', fontWeight: 800, color }}>{value}</div>
                        <div style={{ fontSize: '11px', fontWeight: 600, color: '#64748B', marginTop: '2px' }}>{label}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: '13px', color: '#94A3B8' }}>Loading quota information...</div>
                )}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '32px 16px' }}>
              <div style={{ width: '100%', maxWidth: '340px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                    Licence Type <span style={{ color: '#EF4444' }}>*</span>
                  </label>
                  <SearchableSelect
                    options={LICENCE_TYPE_OPTIONS}
                    value={licenceType}
                    onChange={(val) => setLicenceType(val || 'Starter')}
                    placeholder="-- Select Licence Type --"
                    searchPlaceholder="Search licence type..."
                    triggerStyle={{
                      height: '40px',
                      padding: '8px 12px',
                      fontSize: '13px',
                      borderColor: '#CBD5E1',
                      borderRadius: '8px',
                      background: '#FFFFFF'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                    Quantity <span style={{ color: '#EF4444' }}>*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    placeholder="Enter Quantity"
                    style={{ ...inputStyle, height: '40px', borderRadius: '8px' }}
                    value={numDevices}
                    onChange={e => setNumDevices(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleStep1Submit(); }}
                  />
                </div>

                <div style={{ marginTop: '6px' }}>
                  <button
                    type="button"
                    onClick={handleStep1Submit}
                    style={{
                      width: '100%',
                      height: '42px',
                      padding: '0 24px',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: 700,
                      color: '#FFFFFF',
                      background: '#f97316',
                      border: 'none',
                      cursor: 'pointer',
                      boxShadow: '0 2px 8px rgba(249,115,22,0.25)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      whiteSpace: 'nowrap',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    Next Step
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            {/* Business Information Section Header with Segmented Pill Toggle */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-4 bg-orange-500 rounded-full inline-block" />
                <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#111827', margin: 0 }}>Business Information</h2>
              </div>

              {/* Segmented Pill Toggle */}
              <div className="inline-flex items-center p-1 bg-slate-100 rounded-lg border border-slate-200">
                <button
                  type="button"
                  onClick={() => setUserType('new')}
                  className={`px-4 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                    userType === 'new'
                      ? 'bg-white text-orange-600 shadow-xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  New User
                </button>
                <button
                  type="button"
                  onClick={() => setUserType('existing')}
                  className={`px-4 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                    userType === 'existing'
                      ? 'bg-white text-orange-600 shadow-xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Existing User
                </button>
              </div>
            </div>

            {/* User Details Form */}
            {userType === 'new' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3.5 mb-5">
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '5px' }}>
                    User Name <span style={{ color: '#EF4444' }}>*</span>
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="text"
                      placeholder="Enter User Name"
                      style={{
                        ...inputStyle,
                        paddingRight: isUsernameExists ? '32px' : '10px',
                        borderColor: isUsernameExists ? '#EF4444' : '#CBD5E1',
                        boxShadow: isUsernameExists ? '0 0 0 1px rgba(239, 68, 68, 0.2)' : '0 1px 2px rgba(0, 0, 0, 0.03)'
                      }}
                      autoComplete="new-password"
                      value={newUser.username}
                      onChange={e => {
                        setNewUser({ ...newUser, username: e.target.value, name: e.target.value });
                      }}
                      onBlur={() => setUsernameTouched(true)}
                    />
                    {isUsernameExists && (
                      <div style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center' }}>
                        <AlertCircle size={15} color="#EF4444" />
                      </div>
                    )}
                  </div>
                  {isUsernameExists && (
                    <div style={{ fontSize: '11px', color: '#EF4444', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <AlertCircle size={12} /> Username already exists
                    </div>
                  )}
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '5px' }}>
                    Mobile Number <span style={{ color: '#EF4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Enter Mobile Number"
                    style={inputStyle}
                    value={newUser.phone}
                    onChange={e => setNewUser({ ...newUser, phone: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '5px' }}>
                    Email <span style={{ color: '#EF4444' }}>*</span>
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="email"
                      placeholder="Enter Email"
                      style={{
                        ...inputStyle,
                        paddingRight: isEmailExists ? '32px' : '10px',
                        borderColor: isEmailExists ? '#EF4444' : '#CBD5E1',
                        boxShadow: isEmailExists ? '0 0 0 1px rgba(239, 68, 68, 0.2)' : '0 1px 2px rgba(0, 0, 0, 0.03)'
                      }}
                      value={newUser.email}
                      onChange={e => {
                        setNewUser({ ...newUser, email: e.target.value });
                      }}
                      onBlur={() => setEmailTouched(true)}
                    />
                    {isEmailExists && (
                      <div style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center' }}>
                        <AlertCircle size={15} color="#EF4444" />
                      </div>
                    )}
                  </div>
                  {isEmailExists && (
                    <div style={{ fontSize: '11px', color: '#EF4444', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <AlertCircle size={12} /> Email already exists
                    </div>
                  )}
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '5px' }}>
                    Password <span style={{ color: '#EF4444' }}>*</span>
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Enter Password"
                      style={{
                        ...inputStyle,
                        paddingRight: '32px',
                        borderColor: isPasswordError ? '#EF4444' : '#CBD5E1',
                        boxShadow: isPasswordError ? '0 0 0 1px rgba(239, 68, 68, 0.2)' : '0 1px 2px rgba(0, 0, 0, 0.03)'
                      }}
                      autoComplete="new-password"
                      value={newUser.password}
                      onChange={e => {
                        setPasswordTouched(true);
                        setNewUser({ ...newUser, password: e.target.value });
                      }}
                      onBlur={() => setPasswordTouched(true)}
                    />
                    <div style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center' }}>
                      {isPasswordError ? (
                        <AlertCircle size={15} color="#EF4444" />
                      ) : newUser.password ? (
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', color: '#94A3B8', display: 'flex', alignItems: 'center' }}
                        >
                          {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      ) : null}
                    </div>
                  </div>
                  {isPasswordError && (
                    <div style={{ color: '#EF4444', fontSize: '11px', marginTop: '3px', fontWeight: 500 }}>
                      Please, Enter minimum 6 characters or more
                    </div>
                  )}
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '5px' }}>
                    Add to Existing Group <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 400 }}>(Optional)</span>
                  </label>
                  <SearchableSelect
                    options={apiIntegrationGroups.map(g => ({
                      value: g.id,
                      label: g.name
                    }))}
                    value={newUser.existingGroupId || ''}
                    onChange={val => setNewUser(prev => ({ ...prev, existingGroupId: val }))}
                    placeholder="-- Select Group (Optional) --"
                    searchPlaceholder="Search group..."
                    emptyMessage="No groups found"
                    triggerStyle={{ height: '38px', borderRadius: '7px', borderColor: '#CBD5E1', fontSize: '13px' }}
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 mb-5">
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '5px' }}>
                    Select User <span style={{ color: '#EF4444' }}>*</span>
                  </label>
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
                    triggerStyle={{ height: '38px', borderRadius: '7px', borderColor: '#CBD5E1', fontSize: '13px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '5px' }}>
                    Select Group <span style={{ color: '#EF4444' }}>*</span>
                  </label>
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
                    triggerStyle={{ height: '38px', borderRadius: '7px', borderColor: '#CBD5E1', fontSize: '13px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '5px' }}>
                    Add to Existing Group <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 400 }}>(Optional)</span>
                  </label>
                  <SearchableSelect
                    options={apiIntegrationGroups
                      .filter(g => String(g.id) !== String(existingUserSelection.groupId))
                      .map(g => ({
                        value: g.id,
                        label: g.name
                      }))}
                    value={existingUserSelection.additionalGroupId || ''}
                    onChange={val => setExistingUserSelection(prev => ({ ...prev, additionalGroupId: val }))}
                    placeholder="-- Select Group (Optional) --"
                    searchPlaceholder="Search group..."
                    emptyMessage="No groups found"
                    triggerStyle={{ height: '38px', borderRadius: '7px', borderColor: '#CBD5E1', fontSize: '13px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '5px' }}>
                    Select Organization
                  </label>
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
                    triggerStyle={{ height: '38px', borderRadius: '7px', borderColor: '#CBD5E1', fontSize: '13px' }}
                  />
                </div>
              </div>
            )}

            {/* Device Configuration Header */}
            <div className="flex items-center gap-2 mb-3 mt-4 pt-4 border-t border-slate-100">
              <span className="w-1.5 h-4 bg-orange-500 rounded-full inline-block" />
              <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#111827', margin: 0 }}>Device Configuration</h2>
              <span style={{ fontSize: '12px', color: '#64748B', fontWeight: 500, marginLeft: '4px' }}>
                ({devices.length} {devices.length === 1 ? 'device' : 'devices'})
              </span>
            </div>

            {/* Device Table */}
            {devices.length > 0 && (
              <div style={{ overflowX: 'auto', border: '1px solid #CBD5E1', borderRadius: '8px', marginBottom: '20px', background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: '#F8FAFC', color: '#334155', borderBottom: '1px solid #CBD5E1' }}>
                      <th style={{ padding: '7px 8px', fontSize: '11.5px', fontWeight: 700, width: '34px', textAlign: 'center', borderRight: '1px solid #E2E8F0' }}>No</th>
                      <th style={{ padding: '7px 8px', fontSize: '11.5px', fontWeight: 700, width: '130px', borderRight: '1px solid #E2E8F0' }}>LicenceId</th>
                      <th style={{ padding: '7px 8px', fontSize: '11.5px', fontWeight: 700, width: '135px', borderRight: '1px solid #E2E8F0' }}>
                        Device ID(IMEI) <span style={{ color: '#EF4444' }}>*</span>
                      </th>
                      <th style={{ padding: '7px 8px', fontSize: '11.5px', fontWeight: 700, width: '165px', borderRight: '1px solid #E2E8F0' }}>
                        Device Type <span style={{ color: '#EF4444' }}>*</span>
                      </th>
                      <th style={{ padding: '7px 8px', fontSize: '11.5px', fontWeight: 700, width: '125px', borderRight: '1px solid #E2E8F0' }}>Vehicle Id</th>
                      <th style={{ padding: '7px 8px', fontSize: '11.5px', fontWeight: 700, width: '135px', borderRight: '1px solid #E2E8F0' }}>Vehicle Type</th>
                      <th style={{ padding: '7px 8px', fontSize: '11.5px', fontWeight: 700, width: '120px', borderRight: '1px solid #E2E8F0' }}>GPS SIM No</th>
                      <th style={{ padding: '7px 8px', fontSize: '11.5px', fontWeight: 700, textAlign: 'center', width: '95px' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {devices.map((device, idx) => (
                      <React.Fragment key={device.id}>
                        <tr style={{ borderBottom: '1px solid #E2E8F0', background: '#FFFFFF' }}>
                          <td style={{ padding: '6px 6px', fontSize: '11.5px', fontWeight: 600, color: '#64748B', textAlign: 'center', borderRight: '1px solid #E2E8F0', width: '34px' }}>{idx + 1}</td>
                          <td style={{ padding: '6px 6px', borderRight: '1px solid #E2E8F0', width: '130px' }}>
                            <div style={{ padding: '4px 6px', background: '#F1F5F9', border: '1px solid #CBD5E1', borderRadius: '5px', fontSize: '11px', color: '#334155', fontFamily: 'monospace', fontWeight: 600, letterSpacing: '0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {device.licenceId}
                            </div>
                          </td>
                          <td style={{ padding: '6px 6px', borderRight: '1px solid #E2E8F0', width: '135px' }}>
                            <input
                              type="text" placeholder="Device IMEI" value={device.deviceId}
                              onChange={(e) => updateDevice(idx, 'deviceId', e.target.value)}
                              style={{ ...inputStyle, height: '32px', padding: '3px 8px', fontSize: '11.5px' }}
                            />
                          </td>
                          <td style={{ padding: '6px 6px', borderRight: '1px solid #E2E8F0', width: '165px' }}>
                            <SearchableSelect
                              options={DEVICE_TYPE_OPTIONS}
                              value={device.deviceType}
                              onChange={(val) => updateDevice(idx, 'deviceType', val || 'VOLTY')}
                              placeholder="-- Device Type --"
                              searchPlaceholder="Search type..."
                              emptyMessage="No type found"
                              usePortal={true}
                              triggerStyle={{
                                height: '32px',
                                padding: '3px 8px',
                                fontSize: '11.5px',
                                borderColor: '#CBD5E1',
                                borderRadius: '5px',
                                background: '#FFFFFF'
                              }}
                            />
                          </td>
                          <td style={{ padding: '6px 6px', borderRight: '1px solid #E2E8F0', width: '125px' }}>
                            <input
                              type="text" placeholder="Vehicle Id" value={device.vehicleId}
                              onChange={(e) => updateDevice(idx, 'vehicleId', e.target.value)}
                              style={{ ...inputStyle, height: '32px', padding: '3px 8px', fontSize: '11.5px' }}
                            />
                          </td>
                          <td style={{ padding: '6px 6px', borderRight: '1px solid #E2E8F0', width: '135px' }}>
                            <SearchableSelect
                              options={VEHICLE_TYPE_OPTIONS}
                              value={device.vehicleTypeSelect}
                              onChange={(val) => updateDevice(idx, 'vehicleTypeSelect', val)}
                              placeholder="-- Vehicle Type --"
                              searchPlaceholder="Search type..."
                              emptyMessage="No type found"
                              usePortal={true}
                              triggerStyle={{
                                height: '32px',
                                padding: '3px 8px',
                                fontSize: '11.5px',
                                borderColor: '#CBD5E1',
                                borderRadius: '5px',
                                background: '#FFFFFF'
                              }}
                            />
                          </td>
                          <td style={{ padding: '6px 6px', borderRight: '1px solid #E2E8F0', width: '120px' }}>
                            <input
                              type="text" placeholder="GPS SIM No" value={device.gpsSimNo}
                              onChange={(e) => updateDevice(idx, 'gpsSimNo', e.target.value)}
                              style={{ ...inputStyle, height: '32px', padding: '3px 8px', fontSize: '11.5px' }}
                            />
                          </td>
                          <td style={{ padding: '6px 6px', textAlign: 'center', width: '95px' }}>
                            <button
                              type="button"
                              onClick={() => toggleRowExpansion(idx)}
                              style={{
                                padding: '5px 10px',
                                background: expandedRows[idx] ? '#F1F5F9' : '#f97316',
                                color: expandedRows[idx] ? '#334155' : '#FFFFFF',
                                fontSize: '11px',
                                fontWeight: 600,
                                border: expandedRows[idx] ? '1px solid #CBD5E1' : 'none',
                                borderRadius: '5px',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                boxShadow: expandedRows[idx] ? 'none' : '0 2px 4px rgba(249,115,22,0.15)'
                              }}
                            >
                              {expandedRows[idx] ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                              {expandedRows[idx] ? 'Hide' : 'Show Details'}
                            </button>
                          </td>
                        </tr>
                        {expandedRows[idx] && (
                          <tr style={{ background: '#FAFAFA', borderBottom: '1px solid #E2E8F0' }}>
                            <td style={{ borderRight: '1px solid #F1F5F9' }}></td>
                            <td colSpan="7" style={{ padding: '12px 14px' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {/* Row 1: 4 fields (Full 4-column row) */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                  <div>
                                    <label style={{ fontSize: '11px', fontWeight: 600, color: '#111827', marginBottom: '3px', display: 'block' }}>Vehicle Name</label>
                                    <input
                                      type="text" placeholder="Vehicle Name" value={device.vehicleName}
                                      onChange={(e) => updateDevice(idx, 'vehicleName', e.target.value)}
                                      style={{ ...inputStyle, padding: '5px 8px', fontSize: '12px' }}
                                    />
                                  </div>
                                  <div>
                                    <label style={{ fontSize: '11px', fontWeight: 600, color: '#111827', marginBottom: '3px', display: 'block' }}>Odo Distance</label>
                                    <input
                                      type="text" placeholder="Odo Distance" value={device.odoDistance}
                                      onChange={(e) => updateDevice(idx, 'odoDistance', e.target.value)}
                                      style={{ ...inputStyle, padding: '5px 8px', fontSize: '12px' }}
                                    />
                                  </div>
                                  <div>
                                    <label style={{ fontSize: '11px', fontWeight: 600, color: '#111827', marginBottom: '3px', display: 'block' }}>Service Engineer</label>
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
                                        padding: '5px 8px',
                                        fontSize: '12px',
                                        borderColor: '#CBD5E1',
                                        background: '#FFFFFF'
                                      }}
                                    />
                                  </div>
                                  <div>
                                    <label style={{ fontSize: '11px', fontWeight: 600, color: '#111827', marginBottom: '3px', display: 'block' }}>Salesman</label>
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
                                        padding: '5px 8px',
                                        fontSize: '12px',
                                        borderColor: '#CBD5E1',
                                        background: '#FFFFFF'
                                      }}
                                    />
                                  </div>
                                </div>

                                {/* Row 2: 3 fields (Full 3-column row) */}
                                <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-3 gap-3">
                                  <div>
                                    <label style={{ fontSize: '11px', fontWeight: 600, color: '#111827', marginBottom: '3px', display: 'block' }}>Support Person</label>
                                    <input
                                      type="text" placeholder="Support Person" value={device.supportPerson || ''}
                                      onChange={(e) => updateDevice(idx, 'supportPerson', e.target.value)}
                                      style={{ ...inputStyle, padding: '5px 8px', fontSize: '12px' }}
                                    />
                                  </div>
                                  <div>
                                    <label style={{ fontSize: '11px', fontWeight: 600, color: '#111827', marginBottom: '3px', display: 'block' }}>Ticket Id</label>
                                    <input
                                      type="text" placeholder="Ticket Id" value={device.ticketId}
                                      onChange={(e) => updateDevice(idx, 'ticketId', e.target.value)}
                                      style={{ ...inputStyle, padding: '5px 8px', fontSize: '12px' }}
                                    />
                                  </div>
                                  <div>
                                    <label style={{ fontSize: '11px', fontWeight: 600, color: '#111827', marginBottom: '3px', display: 'block' }}>Sensor No</label>
                                    <input
                                      type="text" placeholder="Sensor No" value={device.sensorNo}
                                      onChange={(e) => updateDevice(idx, 'sensorNo', e.target.value)}
                                      style={{ ...inputStyle, padding: '5px 8px', fontSize: '12px' }}
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
            <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '8px' }}>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting}
                style={{
                  padding: '9px 36px',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 700,
                  color: '#FFFFFF',
                  background: '#f97316',
                  border: 'none',
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  opacity: isSubmitting ? 0.7 : 1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 3px 10px rgba(249,115,22,0.3)',
                  transition: 'all 0.15s ease'
                }}
              >
                {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                <span>{devices.length > 1 ? 'Submit Devices' : 'Submit'}</span>
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
