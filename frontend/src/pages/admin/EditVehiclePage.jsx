import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Home, ChevronRight, Loader2, AlertTriangle, CheckCircle, Save, ArrowLeft, Fuel, Sliders
} from 'lucide-react';
import * as vehicleApi from '../../api/vehicleApi';
import * as adminApi from '../../api/adminApi';
import { expandScientificNotation } from '../../utils/formatUtils';

// FuelTracks Design System Theme Tokens
const inputBaseStyle = {
  width: '100%',
  padding: '10px 14px',
  borderRadius: '10px',
  border: '1px solid #cbd5e1',
  fontSize: '13px',
  fontWeight: 600,
  outline: 'none',
  color: '#0f172a',
  background: '#ffffff',
  boxSizing: 'border-box',
  transition: 'border-color 0.15s, box-shadow 0.15s',
  fontFamily: 'inherit'
};

const labelStyle = {
  display: 'block',
  fontSize: '12.5px',
  fontWeight: 700,
  color: '#334155',
  marginBottom: '6px'
};

const InputField = ({ label, type = "text", value, onChange, disabled, placeholder, focused, onFocus, onBlur }) => (
  <div style={{ display: 'flex', flexDirection: 'column' }}>
    <label style={labelStyle}>{label}</label>
    <input
      type={type}
      value={value ?? ''}
      onChange={onChange}
      disabled={disabled}
      placeholder={placeholder}
      onFocus={onFocus}
      onBlur={onBlur}
      style={{
        ...inputBaseStyle,
        background: disabled ? '#f1f5f9' : '#ffffff',
        borderColor: focused ? '#f97316' : '#cbd5e1',
        boxShadow: focused ? '0 0 0 3px rgba(249, 115, 22, 0.15)' : 'none',
        color: disabled ? '#64748b' : '#0f172a',
        cursor: disabled ? 'not-allowed' : 'text'
      }}
    />
  </div>
);

const SelectField = ({ label, value, onChange, options, placeholder = "-- Select --" }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef(null);
  const searchInputRef = useRef(null);

  // Normalize options to { value, label }
  const normalizedOptions = React.useMemo(() => {
    return (options || []).map(opt => {
      if (typeof opt === 'object' && opt !== null) {
        return { value: String(opt.value ?? ''), label: String(opt.label ?? opt.value ?? '') };
      }
      return { value: String(opt ?? ''), label: String(opt ?? '') };
    });
  }, [options]);

  // Current selected label
  const selected = normalizedOptions.find(opt => opt.value === String(value ?? ''));

  // Filter options by search term
  const filtered = normalizedOptions.filter(opt =>
    !search.trim() || opt.label.toLowerCase().includes(search.toLowerCase().trim())
  );

  useEffect(() => {
    const handleOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutside);
      setSearch('');
      setTimeout(() => searchInputRef.current?.focus(), 40);
    }
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [isOpen]);

  return (
    <div ref={containerRef} style={{ display: 'flex', flexDirection: 'column', position: 'relative' }}>
      <label style={labelStyle}>{label}</label>
      
      {/* Trigger Button */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        style={{
          ...inputBaseStyle,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          userSelect: 'none',
          borderColor: isOpen ? '#f97316' : '#cbd5e1',
          boxShadow: isOpen ? '0 0 0 3px rgba(249, 115, 22, 0.15)' : 'none',
          background: '#ffffff'
        }}
      >
        <span style={{
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          color: selected ? '#0f172a' : '#94a3b8',
          fontWeight: selected ? 600 : 500
        }}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronRight
          size={16}
          style={{
            transform: isOpen ? 'rotate(-90deg)' : 'rotate(90deg)',
            transition: 'transform 0.15s ease',
            color: '#64748b',
            flexShrink: 0,
            marginLeft: '8px'
          }}
        />
      </div>

      {/* Dropdown Menu with Search */}
      {isOpen && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 4px)',
          left: 0,
          right: 0,
          background: '#ffffff',
          borderRadius: '10px',
          border: '1px solid #cbd5e1',
          boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.15), 0 8px 10px -6px rgba(15, 23, 42, 0.1)',
          zIndex: 9999,
          overflow: 'hidden',
          animation: 'fadeIn 0.12s ease-out'
        }}>
          {/* Search Box */}
          <div style={{ padding: '8px', borderBottom: '1px solid #f1f5f9', background: '#f8fafc' }}>
            <input
              ref={searchInputRef}
              type="text"
              placeholder={`Search ${label}...`}
              value={search}
              onChange={e => setSearch(e.target.value)}
              onClick={e => e.stopPropagation()}
              style={{
                width: '100%',
                padding: '7px 10px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '12.5px',
                outline: 'none',
                color: '#0f172a',
                background: '#ffffff',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {/* Options List */}
          <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
            {filtered.length === 0 ? (
              <div style={{ padding: '12px 14px', fontSize: '12px', color: '#94a3b8', textAlign: 'center' }}>
                No options matching "{search}"
              </div>
            ) : (
              filtered.map((opt, i) => {
                const isSelected = opt.value === String(value ?? '');
                return (
                  <div
                    key={i}
                    onClick={() => {
                      onChange({ target: { value: opt.value } });
                      setIsOpen(false);
                    }}
                    style={{
                      padding: '9px 14px',
                      fontSize: '13px',
                      fontWeight: isSelected ? 700 : 500,
                      color: isSelected ? '#ea580c' : '#1e293b',
                      background: isSelected ? '#fff7ed' : 'transparent',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      transition: 'background 0.1s'
                    }}
                    onMouseEnter={e => {
                      if (!isSelected) e.currentTarget.style.background = '#f8fafc';
                    }}
                    onMouseLeave={e => {
                      if (!isSelected) e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <span>{opt.label}</span>
                    {isSelected && (
                      <span style={{ color: '#f97316', fontSize: '13px', fontWeight: 800 }}>✓</span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// FuelTracks Branded Pill Toggle
const PillToggle = ({ label, active, onChange, tooltip }) => {
  const isYes = active === 'YES' || active === true;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
        <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#334155' }}>{label}</span>
        <span
          title={tooltip || label}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '14px',
            height: '14px',
            borderRadius: '50%',
            background: '#ea580c',
            color: '#ffffff',
            fontSize: '9.5px',
            fontWeight: 800,
            cursor: 'help'
          }}
        >
          i
        </span>
      </div>
      <button
        type="button"
        onClick={() => onChange(isYes ? 'NO' : 'YES')}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexDirection: isYes ? 'row' : 'row-reverse',
          width: '76px',
          height: '30px',
          padding: '2px 4px',
          borderRadius: '9999px',
          border: isYes ? '1px solid #ea580c' : '1px solid #94a3b8',
          background: isYes ? '#f97316' : '#475569',
          color: '#ffffff',
          cursor: 'pointer',
          transition: 'all 0.18s ease',
          fontSize: '11px',
          fontWeight: 800,
          boxShadow: isYes ? '0 2px 6px rgba(249, 115, 22, 0.3)' : '0 1px 3px rgba(0,0,0,0.1)'
        }}
      >
        <span style={{
          width: '24px',
          height: '24px',
          borderRadius: '50%',
          background: '#ffffff',
          display: 'block',
          boxShadow: '0 1px 3px rgba(0,0,0,0.25)'
        }} />
        <span style={{ padding: '0 6px', letterSpacing: '0.04em' }}>
          {isYes ? 'YES' : 'NO'}
        </span>
      </button>
    </div>
  );
};

// Section Header matching FuelTracks Dark Navy + Orange Brand Theme
const SectionTitle = ({ title }) => (
  <div style={{
    margin: '32px 0 18px 0',
    borderBottom: '1px solid #e2e8f0',
    paddingBottom: '10px',
    display: 'flex',
    alignItems: 'center',
    gap: '10px'
  }}>
    <div style={{ width: '4px', height: '18px', background: '#f97316', borderRadius: '2px' }} />
    <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', margin: 0, letterSpacing: '-0.01em' }}>
      {title}
    </h3>
  </div>
);

const VEHICLE_TYPES = [
  'Bus', 'Truck', 'Car', 'Van', 'Scooty', 'Motorcycle', 'Tractor',
  'JCB', 'Crane', 'Ambulance', 'Pickup', 'Borewell', 'Tanker', 'Tipper'
];

const VEHICLE_MODELS = [
  'Mazda',
  'Tata Motors',
  'Ashok Leyland',
  'Eicher',
  'Mahindra & Mahindra',
  'BharatBenz',
  'Maruti Suzuki',
  'Hyundai',
  'Toyota',
  'Honda',
  'Force Motors',
  'Isuzu',
  'Volvo',
  'Scania',
  'Swaraj',
  'John Deere',
  'JCB',
  'Caterpillar',
  'Sonalika',
  'Escorts',
  'Other'
];

const DEVICE_MODELS = [
  'GT06N (9964)', 'AIS140', 'AIS140 V2', 'VOLTY', 'BSTPL',
  'BSTPL-17IS', 'CONCOX', 'V5 4G', 'FMB 920', 'PT06', 'EC08', 'PN02', 'VOLTYFUEL'
];

// Mapping of Device Model to Telemetry TCP Port
const DEVICE_MODEL_PORTS = {
  'BSTPL': '5000',
  'AIS140': '5001',
  'CONCOX': '5002',
  'AIS140 V2': '5003',
  'VOLTY': '5004',
  'FMB 920': '5005',
  'PT06': '5006',
  'EC08': '5007',
  'GT06N (9964)': '5007',
  'PN02': '5008',
  'V5 4G': '5009',
  'BSTPL-17IS': '5010',
  'VOLTYFUEL': '5011'
};

const getDevicePort = (model) => {
  if (!model) return '5007';
  const norm = String(model).trim().toUpperCase();
  if (DEVICE_MODEL_PORTS[norm]) return DEVICE_MODEL_PORTS[norm];
  // Sort keys by descending length so compound keys like 'VOLTYFUEL' match before 'VOLTY'
  const sortedKeys = Object.keys(DEVICE_MODEL_PORTS).sort((a, b) => b.length - a.length);
  const found = sortedKeys.find(key => 
    norm.includes(key.toUpperCase()) || key.toUpperCase().includes(norm)
  );
  return found ? DEVICE_MODEL_PORTS[found] : '5007';
};

const getDefaultServerIp = () => {
  // Always return the dedicated TCP socket relay IP for GPS trackers
  return '5.223.61.229';
};

const TELECOM_OPERATORS = ['AIRCEL', 'Airtel', 'Jio', 'Vodafone Idea (Vi)', 'BSNL', 'Other'];

const EditVehiclePage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditing = Boolean(id);

  const [loading, setLoading] = useState(isEditing);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [orgs, setOrgs] = useState([]);
  const [focusedField, setFocusedField] = useState(null);

  // Form State containing ONLY the requested fields
  const [form, setForm] = useState({
    imei: '',
    name: '',
    plate: '',
    model: 'Bus',
    serverName: '',
    gpsSimNo: '',
    deviceVersion: 'GT06N (9964)',
    timezone: 'IST',
    apn: '',
    licenceIssuedDate: '',
    licenceExpireDate: '',
    orgId: '',
    driverName: '',
    driverPhone: '',
    metadata: {
      vehicleId: '',
      registrationNo: '',
      vehicleTypeSelect: 'Bus',
      vehicleModel: 'Mazda',
      deviceModel: 'GT06N (9964)',
      iccid: '',
      telecomOperator: 'AIRCEL',
      installationDate: '',
      onboardDate: '',
      licenceId: '',
      licenceNo: '',
      // Fuel Sensor Details
      fuelMode: 'Auto Calibrate',
      sensorCount: '1',
      numberOfTank: '1',
      fuelType: 'Analog',
      modeOfVehicle: 'None',
      tankSize: '0',
      speedSource: '',
      fluctuations: 'YES',
      fuelBatteryVolt: 'NO',
      // Configuration Details
      deviceOdo: 'YES',
      assetTrack: 'NO',
      safetyPark: 'NO',
      rigMode: 'NO',
      acToggle: 'NO',
      secondaryEngine: 'Digital Input 2',
      engineOnStatus: 'Ignition',
      vehicleVoltage: '',
      odometerReading: '0',
      odometerSnapshot: '0',
      overSpeedLimit: '60',
      expectedMileage: '0',
      enableDebugs: 'Disable',
      countryTimezone: '',
      ipAddress: getDefaultServerIp(),
      portNo: getDevicePort('GT06N (9964)'),
      lowBattery: '20',
      externalDevice: 'NO',
      // Driver Details
      driverName: '',
      driverPhone: '',
      // Other Details
      madeIn: 'India',
      mfgDate: '',
      chassisNo: '',
      alternateVehicleName: '',
      description: '',
      serviceEngineer: 'Service Engineer',
      salesman: 'Salesman',
      supportPerson: '',
      ticketId: '',
      sensorNo: ''
    }
  });

  useEffect(() => {
    adminApi.getOrgs?.().then(res => setOrgs(res.data || [])).catch(console.error);

    if (isEditing) {
      vehicleApi.getVehicleById(id)
        .then(res => {
          const v = res.data;
          const meta = v.metadata || {};
          const currentDeviceModel = meta.deviceModel || v.device_version || 'GT06N (9964)';
          let dynamicIp = meta.ipAddress;
          if (!dynamicIp || dynamicIp.includes('fueltracks.in')) {
            dynamicIp = getDefaultServerIp();
          }
          let dynamicPort = meta.portNo;
          if (!dynamicPort || (currentDeviceModel.toUpperCase().includes('VOLTYFUEL') && dynamicPort === '5004')) {
            dynamicPort = getDevicePort(currentDeviceModel);
          }

          setForm({
            imei: v.imei || '',
            name: v.name || '',
            plate: v.plate || meta.registrationNo || meta.vehicleId || '',
            model: v.model || meta.vehicleTypeSelect || 'Bus',
            serverName: v.server_name || meta.serverName || '',
            gpsSimNo: expandScientificNotation(v.gps_sim_no || meta.sim1 || meta.simNo || ''),
            deviceVersion: currentDeviceModel,
            timezone: v.timezone || meta.timezone || 'IST',
            apn: v.apn || '',
            orgId: v.org_id || '',
            driverName: v.driver_name || meta.driverName || meta.ownerName || '',
            driverPhone: v.driver_phone || meta.driverPhone || meta.ownerPhone || '',
            licenceIssuedDate: v.licence_issued_date
              ? new Date(v.licence_issued_date).toISOString().split('T')[0]
              : (meta.licenceIssuedDate ? new Date(meta.licenceIssuedDate).toISOString().split('T')[0] : ''),
            licenceExpireDate: v.licence_expire_date
              ? new Date(v.licence_expire_date).toISOString().split('T')[0]
              : (meta.licenceExpireDate ? new Date(meta.licenceExpireDate).toISOString().split('T')[0] : ''),
            metadata: {
              ...meta,
              vehicleId: meta.vehicleId || v.plate || '',
              registrationNo: meta.registrationNo || v.plate || '',
              vehicleTypeSelect: meta.vehicleTypeSelect || v.model || 'Bus',
              vehicleModel: meta.vehicleModel || v.make || 'Mazda',
              deviceModel: currentDeviceModel,
              iccid: expandScientificNotation(meta.iccid || ''),
              telecomOperator: meta.telecomOperator || 'AIRCEL',
              installationDate: meta.installationDate || meta.installedDate || '',
              onboardDate: meta.onboardDate || meta.onboardingDate || (v.created_at ? new Date(v.created_at).toISOString().split('T')[0] : ''),
              licenceId: meta.licenceId || meta.licenceNo || v.licenceId || v.licence_no || '',
              // Fuel Sensor Details
              fuelMode: meta.fuelMode || 'Auto Calibrate',
              sensorCount: meta.sensorCount || '1',
              numberOfTank: meta.numberOfTank || '1',
              fuelType: meta.fuelType || 'Analog',
              modeOfVehicle: meta.modeOfVehicle || 'None',
              tankSize: meta.tankSize !== undefined ? String(meta.tankSize) : '0',
              speedSource: meta.speedSource || '',
              fluctuations: meta.fluctuations || 'YES',
              fuelBatteryVolt: meta.fuelBatteryVolt || 'NO',
              // Configuration Details
              deviceOdo: meta.deviceOdo || 'YES',
              assetTrack: meta.assetTrack || 'NO',
              safetyPark: meta.safetyPark || 'NO',
              rigMode: meta.rigMode || 'NO',
              acToggle: meta.acToggle || 'NO',
              secondaryEngine: meta.secondaryEngine || 'Digital Input 2',
              engineOnStatus: meta.engineOnStatus || meta.engineOn || 'Ignition',
              vehicleVoltage: meta.vehicleVoltage || meta.batteryVoltage || '',
              odometerReading: meta.odometerReading || meta.odoDistance || '0',
              odometerSnapshot: meta.odometerSnapshot || '0',
              overSpeedLimit: meta.overSpeedLimit || '60',
              expectedMileage: meta.expectedMileage || '0',
              enableDebugs: meta.enableDebugs || 'Disable',
              countryTimezone: meta.countryTimezone || '',
              ipAddress: dynamicIp,
              portNo: dynamicPort,
              lowBattery: meta.lowBattery || '20',
              externalDevice: meta.externalDevice || 'NO',
              // Driver Details
              driverName: meta.driverName || v.driver_name || '',
              driverPhone: meta.driverPhone || v.driver_phone || '',
              // Other Details
              madeIn: meta.madeIn || 'India',
              mfgDate: meta.mfgDate ? new Date(meta.mfgDate).toISOString().split('T')[0] : (meta.mfgDate || ''),
              chassisNo: meta.chassisNo || '',
              alternateVehicleName: meta.alternateVehicleName || '',
              description: meta.description || meta.remarks || '',
              serviceEngineer: meta.serviceEngineer || 'Service Engineer',
              salesman: meta.salesman || 'Salesman',
              supportPerson: meta.supportPerson || '',
              ticketId: meta.ticketId || '',
              sensorNo: meta.sensorNo || ''
            }
          });
          setLoading(false);
        })
        .catch(() => {
          setError('Failed to load vehicle details.');
          setLoading(false);
        });
    }
  }, [id, isEditing]);

  const updateField = (field, value) => setForm(prev => ({ ...prev, [field]: value }));
  const updateMeta = (field, value) => setForm(prev => ({ ...prev, metadata: { ...prev.metadata, [field]: value } }));

  const handleSave = async () => {
    if (!form.name || form.name.trim() === '') {
      setError('Vehicle Name is mandatory.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      const payload = {
        imei: form.imei,
        name: form.name,
        plate: form.plate || form.metadata.vehicleId || form.metadata.registrationNo,
        model: form.model || form.metadata.vehicleTypeSelect,
        orgId: form.orgId,
        serverName: form.serverName,
        gpsSimNo: form.gpsSimNo,
        deviceVersion: form.deviceVersion,
        timezone: form.timezone,
        apn: form.apn,
        licenceIssuedDate: form.licenceIssuedDate,
        licenceExpireDate: form.licenceExpireDate,
        driverName: form.metadata.driverName || form.driverName,
        driverPhone: form.metadata.driverPhone || form.driverPhone,
        metadata: {
          ...form.metadata,
          vehicleId: form.metadata.vehicleId || form.plate,
          registrationNo: form.plate || form.metadata.registrationNo,
          vehicleTypeSelect: form.model || form.metadata.vehicleTypeSelect,
          vehicleModel: form.metadata.vehicleModel,
          deviceModel: form.deviceVersion,
          sim1: form.gpsSimNo,
          licenceId: form.metadata.licenceId,
          licenceIssuedDate: form.licenceIssuedDate,
          licenceExpireDate: form.licenceExpireDate,
          driverName: form.metadata.driverName || form.driverName,
          driverPhone: form.metadata.driverPhone || form.driverPhone
        }
      };

      if (isEditing) {
        await vehicleApi.updateVehicle(id, payload);
        setSuccess('Vehicle updated successfully!');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        await vehicleApi.createVehicle(payload);
        setSuccess('Vehicle registered successfully!');
        setTimeout(() => navigate('/admin/vehicles'), 1200);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save vehicle');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '400px', background: '#EEF5F8' }}>
        <Loader2 size={36} className="animate-spin" color="#f97316" style={{ marginBottom: '12px' }} />
        <span style={{ fontSize: '14px', color: '#64748b', fontWeight: 600 }}>Loading Vehicle Details...</span>
      </div>
    );
  }

  const currentVehicleId = form.metadata.vehicleId || form.plate || form.name || 'Vehicle';

  return (
    <div style={{ background: '#EEF5F8', minHeight: '100%', padding: '20px 28px 60px 28px', boxSizing: 'border-box' }}>

      {/* Top Header & Breadcrumbs matching FuelTracks UI theme */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 900, color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>
          Edit Vehicle
        </h1>

        {/* Breadcrumbs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', fontSize: '13px', fontWeight: 600 }}>
          <Home size={15} style={{ color: '#64748b' }} />
          <ChevronRight size={13} style={{ color: '#94a3b8' }} />
          <span
            onClick={() => navigate('/admin/vehicles')}
            style={{ cursor: 'pointer', transition: 'color 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.color = '#ea580c'}
            onMouseLeave={e => e.currentTarget.style.color = '#64748b'}
          >
            Vehicle list
          </span>
          <ChevronRight size={13} style={{ color: '#94a3b8' }} />
          <span>Vehicle Edit</span>
          <ChevronRight size={13} style={{ color: '#94a3b8' }} />
          <span style={{ color: '#ea580c', fontWeight: 800 }}>{currentVehicleId}</span>
        </div>
      </div>

      {/* Status Alerts */}
      {error && (
        <div style={{ padding: '14px 18px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '10px', color: '#dc2626', marginBottom: '20px', fontSize: '13px', fontWeight: 700, boxShadow: '0 2px 4px rgba(220,38,38,0.06)' }}>
          <AlertTriangle size={18} />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div style={{ padding: '14px 18px', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '10px', color: '#059669', marginBottom: '20px', fontSize: '13px', fontWeight: 700, boxShadow: '0 2px 4px rgba(5,150,105,0.06)' }}>
          <CheckCircle size={18} />
          <span>{success}</span>
        </div>
      )}

      {/* Main White Card Container */}
      <div style={{
        background: '#ffffff',
        borderRadius: '16px',
        border: '1px solid #e2e8f0',
        padding: '28px 36px',
        boxShadow: '0 4px 6px rgba(0,0,0,0.02)'
      }}>

        {/* ============================================================ */}
        {/* SECTION 1: Vehicle Information                                */}
        {/* ============================================================ */}
        <SectionTitle title="Vehicle Information" />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', columnGap: '32px', rowGap: '16px' }}>
          {/* Row 1 */}
          <InputField
            label="Vehicle ID"
            value={form.metadata.vehicleId || form.plate || form.imei}
            disabled={true}
            placeholder="Vehicle ID"
          />
          <InputField
            label="Vehicle Name"
            value={form.name}
            onChange={e => updateField('name', e.target.value)}
            placeholder="Vehicle Name"
            focused={focusedField === 'name'}
            onFocus={() => setFocusedField('name')}
            onBlur={() => setFocusedField(null)}
          />

          {/* Row 2 */}
          <InputField
            label="Vehicle Registration Number"
            value={form.plate}
            onChange={e => { updateField('plate', e.target.value); updateMeta('registrationNo', e.target.value); }}
            placeholder="e.g. MH12AB1234"
            focused={focusedField === 'plate'}
            onFocus={() => setFocusedField('plate')}
            onBlur={() => setFocusedField(null)}
          />
          <SelectField
            label="Vehicle Type"
            value={form.model || form.metadata.vehicleTypeSelect}
            onChange={e => { updateField('model', e.target.value); updateMeta('vehicleTypeSelect', e.target.value); }}
            options={VEHICLE_TYPES}
            focused={focusedField === 'vType'}
            onFocus={() => setFocusedField('vType')}
            onBlur={() => setFocusedField(null)}
          />

          {/* Row 3 */}
          <SelectField
            label="Device Model"
            value={form.deviceVersion || form.metadata.deviceModel}
            onChange={e => {
              const newModel = e.target.value;
              const newPort = getDevicePort(newModel);
              setForm(prev => ({
                ...prev,
                deviceVersion: newModel,
                metadata: {
                  ...prev.metadata,
                  deviceModel: newModel,
                  portNo: newPort,
                  ipAddress: (!prev.metadata.ipAddress || prev.metadata.ipAddress.includes('fueltracks.in')) ? getDefaultServerIp() : prev.metadata.ipAddress
                }
              }));
            }}
            options={DEVICE_MODELS}
            focused={focusedField === 'dModel'}
            onFocus={() => setFocusedField('dModel')}
            onBlur={() => setFocusedField(null)}
          />
          <SelectField
            label="Vehicle Model"
            value={form.metadata.vehicleModel}
            onChange={e => updateMeta('vehicleModel', e.target.value)}
            options={
              form.metadata.vehicleModel && !VEHICLE_MODELS.includes(form.metadata.vehicleModel)
                ? [form.metadata.vehicleModel, ...VEHICLE_MODELS]
                : VEHICLE_MODELS
            }
            placeholder="-- Select Vehicle Model --"
            focused={focusedField === 'vModel'}
            onFocus={() => setFocusedField('vModel')}
            onBlur={() => setFocusedField(null)}
          />

          {/* Row 4 */}
          <InputField
            label="Device Id / IMEI No"
            value={form.imei}
            disabled={true}
            placeholder="IMEI Number"
          />
          <InputField
            label="GPS Sim Number"
            value={form.gpsSimNo}
            onChange={e => { updateField('gpsSimNo', e.target.value); updateMeta('sim1', e.target.value); }}
            placeholder="0123456789"
            focused={focusedField === 'sim1'}
            onFocus={() => setFocusedField('sim1')}
            onBlur={() => setFocusedField(null)}
          />

          {/* Row 5 */}
          <InputField
            label="GPS Sim ICCID"
            value={form.metadata.iccid}
            onChange={e => updateMeta('iccid', e.target.value)}
            placeholder="ICCID"
            focused={focusedField === 'iccid'}
            onFocus={() => setFocusedField('iccid')}
            onBlur={() => setFocusedField(null)}
          />
          <SelectField
            label="Telecom Operator Name"
            value={form.metadata.telecomOperator}
            onChange={e => updateMeta('telecomOperator', e.target.value)}
            options={TELECOM_OPERATORS}
            focused={focusedField === 'operator'}
            onFocus={() => setFocusedField('operator')}
            onBlur={() => setFocusedField(null)}
          />

          {/* Row 6 */}
          <InputField
            label="Installation Date"
            type="date"
            value={form.metadata.installationDate}
            onChange={e => updateMeta('installationDate', e.target.value)}
            focused={focusedField === 'instDate'}
            onFocus={() => setFocusedField('instDate')}
            onBlur={() => setFocusedField(null)}
          />
          <SelectField
            label="Organization Name"
            value={form.orgId}
            onChange={e => updateField('orgId', e.target.value)}
            options={orgs.map(o => ({ value: o.id, label: o.name }))}
            placeholder="DEFAULT"
            focused={focusedField === 'orgId'}
            onFocus={() => setFocusedField('orgId')}
            onBlur={() => setFocusedField(null)}
          />

          {/* Row 7 */}
          <InputField
            label="Onboard Date"
            type="date"
            value={form.metadata.onboardDate}
            onChange={e => updateMeta('onboardDate', e.target.value)}
            focused={focusedField === 'onboardDate'}
            onFocus={() => setFocusedField('onboardDate')}
            onBlur={() => setFocusedField(null)}
          />
          <InputField
            label="Licence Expiration Date"
            type="date"
            value={form.licenceExpireDate}
            onChange={e => { updateField('licenceExpireDate', e.target.value); updateMeta('licenceExpireDate', e.target.value); }}
            focused={focusedField === 'licExp'}
            onFocus={() => setFocusedField('licExp')}
            onBlur={() => setFocusedField(null)}
          />

          {/* Row 8 */}
          <InputField
            label="Licence Issued Date"
            type="date"
            value={form.licenceIssuedDate}
            onChange={e => { updateField('licenceIssuedDate', e.target.value); updateMeta('licenceIssuedDate', e.target.value); }}
            focused={focusedField === 'licIss'}
            onFocus={() => setFocusedField('licIss')}
            onBlur={() => setFocusedField(null)}
          />
          <InputField
            label="Licence"
            value={form.metadata.licenceId}
            onChange={e => updateMeta('licenceId', e.target.value)}
            placeholder="Licence ID"
            focused={focusedField === 'lic'}
            onFocus={() => setFocusedField('lic')}
            onBlur={() => setFocusedField(null)}
          />
        </div>

        {/* ============================================================ */}
        {/* SECTION 2: Fuel Sensor Details                               */}
        {/* ============================================================ */}
        <SectionTitle title="Fuel Sensor Details" />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', columnGap: '32px', rowGap: '16px' }}>
          {/* Row 1 */}
          <SelectField
            label="Fuel Mode"
            value={form.metadata.fuelMode}
            onChange={e => updateMeta('fuelMode', e.target.value)}
            options={['Auto Calibrate', 'Manual', 'None']}
            focused={focusedField === 'fuelMode'}
            onFocus={() => setFocusedField('fuelMode')}
            onBlur={() => setFocusedField(null)}
          />
          <InputField
            label="Sensor Count"
            type="number"
            value={form.metadata.sensorCount}
            onChange={e => updateMeta('sensorCount', e.target.value)}
            placeholder="1"
            focused={focusedField === 'sensorCount'}
            onFocus={() => setFocusedField('sensorCount')}
            onBlur={() => setFocusedField(null)}
          />

          {/* Row 2 */}
          <InputField
            label="Number of Tank"
            type="number"
            value={form.metadata.numberOfTank}
            onChange={e => updateMeta('numberOfTank', e.target.value)}
            placeholder="1"
            focused={focusedField === 'numTank'}
            onFocus={() => setFocusedField('numTank')}
            onBlur={() => setFocusedField(null)}
          />
          <SelectField
            label="Fuel Type"
            value={form.metadata.fuelType}
            onChange={e => updateMeta('fuelType', e.target.value)}
            options={['Analog', 'Digital', 'Frequency', 'None', 'Diesel', 'Petrol', 'CNG']}
            focused={focusedField === 'fType'}
            onFocus={() => setFocusedField('fType')}
            onBlur={() => setFocusedField(null)}
          />

          {/* Row 3 */}
          <SelectField
            label="Mode of Vehicle"
            value={form.metadata.modeOfVehicle}
            onChange={e => updateMeta('modeOfVehicle', e.target.value)}
            options={['None', 'Moving', 'Stationary']}
            focused={focusedField === 'modeVeh'}
            onFocus={() => setFocusedField('modeVeh')}
            onBlur={() => setFocusedField(null)}
          />
          <InputField
            label="Tank Size"
            type="number"
            value={form.metadata.tankSize}
            onChange={e => updateMeta('tankSize', e.target.value)}
            placeholder="0"
            focused={focusedField === 'tankSize'}
            onFocus={() => setFocusedField('tankSize')}
            onBlur={() => setFocusedField(null)}
          />

          {/* Row 4: Speed on Left, Toggles on Right */}
          <SelectField
            label="Speed"
            value={form.metadata.speedSource}
            onChange={e => updateMeta('speedSource', e.target.value)}
            options={['GPS Speed', 'CAN Speed', 'Sensor Speed', 'Pulse Speed']}
            placeholder="-- Select --"
            focused={focusedField === 'speed'}
            onFocus={() => setFocusedField('speed')}
            onBlur={() => setFocusedField(null)}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: '32px', paddingTop: '2px' }}>
            <PillToggle
              label="Fluctuations"
              active={form.metadata.fluctuations}
              onChange={val => updateMeta('fluctuations', val)}
              tooltip="Enable fuel level fluctuations filtering"
            />
            <PillToggle
              label="Fuel Battery Volt"
              active={form.metadata.fuelBatteryVolt}
              onChange={val => updateMeta('fuelBatteryVolt', val)}
              tooltip="Enable fuel sensor battery voltage readings"
            />
          </div>
        </div>

        {/* ============================================================ */}
        {/* SECTION 3: Configuration Details                             */}
        {/* ============================================================ */}
        <SectionTitle title="Configuration Details" />

        {/* Top Toggles Row */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '28px', marginBottom: '20px', alignItems: 'center' }}>
          <PillToggle
            label="Device Odo"
            active={form.metadata.deviceOdo}
            onChange={val => updateMeta('deviceOdo', val)}
            tooltip="Use device odometer packets"
          />
          <PillToggle
            label="Asset Tracker ..."
            active={form.metadata.assetTrack}
            onChange={val => updateMeta('assetTrack', val)}
            tooltip="Enable portable asset tracking mode"
          />
          <PillToggle
            label="Safety Parking ..."
            active={form.metadata.safetyPark}
            onChange={val => updateMeta('safetyPark', val)}
            tooltip="Activate safety parking alerts"
          />
          <PillToggle
            label="Rig Mode"
            active={form.metadata.rigMode}
            onChange={val => updateMeta('rigMode', val)}
            tooltip="Enable drilling rig / machinery mode"
          />
          <PillToggle
            label="AC"
            active={form.metadata.acToggle}
            onChange={val => updateMeta('acToggle', val)}
            tooltip="Monitor air conditioner on/off state"
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', columnGap: '32px', rowGap: '16px' }}>
          {/* Row 1 */}
          <SelectField
            label="Secondary Engine (AC)"
            value={form.metadata.secondaryEngine}
            onChange={e => updateMeta('secondaryEngine', e.target.value)}
            options={['Digital Input 2', 'Digital Input 1', 'Analog Input', 'Disabled']}
            focused={focusedField === 'secEngine'}
            onFocus={() => setFocusedField('secEngine')}
            onBlur={() => setFocusedField(null)}
          />
          <SelectField
            label="Engine ON"
            value={form.metadata.engineOnStatus}
            onChange={e => updateMeta('engineOnStatus', e.target.value)}
            options={['Ignition', 'Voltage', 'Voltage+Ignition', 'Digital Input 1', 'Digital Input 2']}
            focused={focusedField === 'engineOn'}
            onFocus={() => setFocusedField('engineOn')}
            onBlur={() => setFocusedField(null)}
          />

          {/* Row 2 */}
          <InputField
            label="Vehicle Battery Voltage"
            value={form.metadata.vehicleVoltage}
            onChange={e => updateMeta('vehicleVoltage', e.target.value)}
            placeholder="Vehicle Battery Voltage"
            focused={focusedField === 'vVolt'}
            onFocus={() => setFocusedField('vVolt')}
            onBlur={() => setFocusedField(null)}
          />
          <InputField
            label="Odometer Reading"
            type="number"
            value={form.metadata.odometerReading}
            onChange={e => updateMeta('odometerReading', e.target.value)}
            placeholder="0"
            focused={focusedField === 'odoRead'}
            onFocus={() => setFocusedField('odoRead')}
            onBlur={() => setFocusedField(null)}
          />

          {/* Row 3 */}
          <InputField
            label="OverSpeed Limit"
            type="number"
            value={form.metadata.overSpeedLimit}
            onChange={e => updateMeta('overSpeedLimit', e.target.value)}
            placeholder="60"
            focused={focusedField === 'osLimit'}
            onFocus={() => setFocusedField('osLimit')}
            onBlur={() => setFocusedField(null)}
          />
          <InputField
            label="Expected Mileage"
            type="number"
            value={form.metadata.expectedMileage}
            onChange={e => updateMeta('expectedMileage', e.target.value)}
            placeholder="0"
            focused={focusedField === 'expMileage'}
            onFocus={() => setFocusedField('expMileage')}
            onBlur={() => setFocusedField(null)}
          />

          <InputField
            label="Idle Duration Alert (mins)"
            type="number"
            value={form.metadata.idleDurationAlert || ''}
            onChange={e => updateMeta('idleDurationAlert', e.target.value)}
            placeholder="60 (default 1 hr)"
            focused={focusedField === 'idleDurAlert'}
            onFocus={() => setFocusedField('idleDurAlert')}
            onBlur={() => setFocusedField(null)}
          />
          <InputField
            label="Parking Duration Alert (mins)"
            type="number"
            value={form.metadata.parkingDurationAlert || ''}
            onChange={e => updateMeta('parkingDurationAlert', e.target.value)}
            placeholder="60 (default 1 hr)"
            focused={focusedField === 'parkDurAlert'}
            onFocus={() => setFocusedField('parkDurAlert')}
            onBlur={() => setFocusedField(null)}
          />

          {/* Row 4 */}
          <SelectField
            label="Enable Debugs"
            value={form.metadata.enableDebugs}
            onChange={e => updateMeta('enableDebugs', e.target.value)}
            options={['Disable', 'Enable']}
            focused={focusedField === 'dbg'}
            onFocus={() => setFocusedField('dbg')}
            onBlur={() => setFocusedField(null)}
          />
          <SelectField
            label="Country Timezone"
            value={form.metadata.countryTimezone}
            onChange={e => updateMeta('countryTimezone', e.target.value)}
            options={['India Standard Time (IST)', 'UTC (+00:00)', 'Asia/Kolkata', 'Asia/Dubai', 'US/Eastern']}
            placeholder="-- Select Timezone --"
            focused={focusedField === 'cTz'}
            onFocus={() => setFocusedField('cTz')}
            onBlur={() => setFocusedField(null)}
          />

          {/* Row 5 */}
          <SelectField
            label="Timezone"
            value={form.timezone}
            onChange={e => updateField('timezone', e.target.value)}
            options={['TIMEZONE', 'IST', 'UTC', 'Asia/Kolkata']}
            placeholder="TIMEZONE"
            focused={focusedField === 'tz'}
            onFocus={() => setFocusedField('tz')}
            onBlur={() => setFocusedField(null)}
          />
          <InputField
            label="IP Address"
            value={form.metadata.ipAddress}
            disabled={true}
            placeholder="Auto-fetched IP Address"
          />

          {/* Row 6 */}
          <InputField
            label="Communicating Port No"
            value={form.metadata.portNo}
            disabled={true}
            placeholder="Auto-fetched Port No"
          />
          <InputField
            label="Low Battery Percentage"
            type="number"
            value={form.metadata.lowBattery}
            onChange={e => updateMeta('lowBattery', e.target.value)}
            placeholder="20"
            focused={focusedField === 'lowBat'}
            onFocus={() => setFocusedField('lowBat')}
            onBlur={() => setFocusedField(null)}
          />

          {/* Row 7 */}
          <SelectField
            label="External Device"
            value={form.metadata.externalDevice}
            onChange={e => updateMeta('externalDevice', e.target.value)}
            options={['NO', 'YES']}
            placeholder="NO"
            focused={focusedField === 'extDev'}
            onFocus={() => setFocusedField('extDev')}
            onBlur={() => setFocusedField(null)}
          />
          <div />
        </div>

        {/* ============================================================ */}
        {/* SECTION 4: Driver Details                                    */}
        {/* ============================================================ */}
        <SectionTitle title="Driver Details" />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', columnGap: '32px', rowGap: '16px' }}>
          <InputField
            label="Driver Name"
            value={form.metadata.driverName}
            onChange={e => { updateMeta('driverName', e.target.value); updateField('driverName', e.target.value); }}
            placeholder="Driver Name"
            focused={focusedField === 'dName'}
            onFocus={() => setFocusedField('dName')}
            onBlur={() => setFocusedField(null)}
          />
          <InputField
            label="Driver Mobile No"
            value={form.metadata.driverPhone}
            onChange={e => { updateMeta('driverPhone', e.target.value); updateField('driverPhone', e.target.value); }}
            placeholder="Driver Mobile No"
            focused={focusedField === 'dPhone'}
            onFocus={() => setFocusedField('dPhone')}
            onBlur={() => setFocusedField(null)}
          />
        </div>

        {/* ============================================================ */}
        {/* SECTION 5: Other Details                                     */}
        {/* ============================================================ */}
        <SectionTitle title="Other Details" />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', columnGap: '32px', rowGap: '16px' }}>
          {/* Row 1 */}
          <InputField
            label="Made In"
            value={form.metadata.madeIn}
            onChange={e => updateMeta('madeIn', e.target.value)}
            placeholder="India"
            focused={focusedField === 'madeIn'}
            onFocus={() => setFocusedField('madeIn')}
            onBlur={() => setFocusedField(null)}
          />
          <InputField
            label="Manufacturing date"
            type="date"
            value={form.metadata.mfgDate}
            onChange={e => updateMeta('mfgDate', e.target.value)}
            focused={focusedField === 'mfgDate'}
            onFocus={() => setFocusedField('mfgDate')}
            onBlur={() => setFocusedField(null)}
          />

          {/* Row 2 */}
          <InputField
            label="Chassis Number"
            value={form.metadata.chassisNo}
            onChange={e => updateMeta('chassisNo', e.target.value)}
            placeholder="Chassis Number"
            focused={focusedField === 'chassis'}
            onFocus={() => setFocusedField('chassis')}
            onBlur={() => setFocusedField(null)}
          />
          <InputField
            label="Alternate Vehicle Name"
            value={form.metadata.alternateVehicleName}
            onChange={e => updateMeta('alternateVehicleName', e.target.value)}
            placeholder="Alternate Vehicle Name"
            focused={focusedField === 'altName'}
            onFocus={() => setFocusedField('altName')}
            onBlur={() => setFocusedField(null)}
          />

          {/* Row 3 */}
          <InputField
            label="Description / Remarks"
            value={form.metadata.description}
            onChange={e => updateMeta('description', e.target.value)}
            placeholder="Description / Remarks"
            focused={focusedField === 'desc'}
            onFocus={() => setFocusedField('desc')}
            onBlur={() => setFocusedField(null)}
          />
          <InputField
            label="Service Engineer"
            value={form.metadata.serviceEngineer}
            onChange={e => updateMeta('serviceEngineer', e.target.value)}
            placeholder="Service Engineer"
            focused={focusedField === 'eng'}
            onFocus={() => setFocusedField('eng')}
            onBlur={() => setFocusedField(null)}
          />

          {/* Row 4 */}
          <InputField
            label="Salesman"
            value={form.metadata.salesman}
            onChange={e => updateMeta('salesman', e.target.value)}
            placeholder="Salesman"
            focused={focusedField === 'sales'}
            onFocus={() => setFocusedField('sales')}
            onBlur={() => setFocusedField(null)}
          />
          <InputField
            label="Support Person"
            value={form.metadata.supportPerson}
            onChange={e => updateMeta('supportPerson', e.target.value)}
            placeholder="Support Person"
            focused={focusedField === 'supp'}
            onFocus={() => setFocusedField('supp')}
            onBlur={() => setFocusedField(null)}
          />

          {/* Row 5 */}
          <InputField
            label="Ticket Id"
            value={form.metadata.ticketId}
            onChange={e => updateMeta('ticketId', e.target.value)}
            placeholder="Ticket Id"
            focused={focusedField === 'ticketId'}
            onFocus={() => setFocusedField('ticketId')}
            onBlur={() => setFocusedField(null)}
          />
          <InputField
            label="Sensor No"
            value={form.metadata.sensorNo}
            onChange={e => updateMeta('sensorNo', e.target.value)}
            placeholder="Sensor No"
            focused={focusedField === 'sensorNo'}
            onFocus={() => setFocusedField('sensorNo')}
            onBlur={() => setFocusedField(null)}
          />
        </div>

        {/* ============================================================ */}
        {/* Bottom Action Buttons (FuelTracks Brand Colors)              */}
        {/* ============================================================ */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '14px', marginTop: '40px', paddingTop: '20px', borderTop: '1px solid #f1f5f9' }}>
          {/* Back Button */}
          <button
            type="button"
            onClick={() => navigate('/admin/vehicles')}
            style={{
              padding: '10px 24px',
              borderRadius: '10px',
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              color: '#334155',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s ease',
              boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.color = '#0f172a'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#ffffff'; e.currentTarget.style.color = '#334155'; }}
          >
            <ArrowLeft size={15} />
            <span>Back</span>
          </button>

          {/* Update Button (FuelTracks Primary Orange) */}
          <button
            type="button"
            onClick={handleSave}
            disabled={submitting}
            style={{
              padding: '10px 32px',
              borderRadius: '10px',
              background: '#f97316',
              border: 'none',
              color: '#ffffff',
              fontSize: '13px',
              fontWeight: 800,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              cursor: submitting ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s ease',
              boxShadow: '0 4px 12px rgba(249, 115, 22, 0.3)',
              opacity: submitting ? 0.75 : 1
            }}
            onMouseEnter={e => { if (!submitting) e.currentTarget.style.background = '#ea580c'; }}
            onMouseLeave={e => { if (!submitting) e.currentTarget.style.background = '#f97316'; }}
          >
            {submitting ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            <span>Update</span>
          </button>

          {/* Fuel Calibration Button (FuelTracks Dark Navy) */}
          <button
            type="button"
            onClick={() => {
              if (id) {
                navigate(`/admin/vehicles/calibrate/${id}`);
              } else {
                alert('Please register the vehicle first before configuring fuel calibration.');
              }
            }}
            style={{
              padding: '10px 24px',
              borderRadius: '10px',
              background: '#1e1b4b',
              border: 'none',
              color: '#ffffff',
              fontSize: '13px',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              boxShadow: '0 4px 12px rgba(30, 27, 75, 0.2)'
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#0f172a'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#1e1b4b'; }}
          >
            <Fuel size={15} color="#f97316" />
            <span>Fuel Calibration</span>
          </button>
        </div>

      </div>
    </div>
  );
};

export default EditVehiclePage;
