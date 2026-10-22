import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Home, ChevronRight, Loader2, AlertTriangle, CheckCircle, Fuel, ChevronDown, Check, X } from 'lucide-react';
import * as vehicleApi from '../../api/vehicleApi';

import FuelTracksSelect from '../../components/ui/FuelTracksSelect';

const EditCalibratePage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [vehicle, setVehicle] = useState(null);

  // Active tank tab
  const [activeTank, setActiveTank] = useState(1);

  // Form Fields matching screenshot
  const [modeOfVehicle, setModeOfVehicle] = useState('');
  const [fuelType, setFuelType] = useState('Analog');
  const [tankSize, setTankSize] = useState('');
  const [minAdc, setMinAdc] = useState('');
  const [maxAdc, setMaxAdc] = useState('');
  const [fuelTankShape, setFuelTankShape] = useState('');
  const [fuelTankPosition, setFuelTankPosition] = useState('');

  // General Fuel Configuration Details Modal State
  const [isGeneralModalOpen, setIsGeneralModalOpen] = useState(false);
  const [generalSaving, setGeneralSaving] = useState(false);
  const [modalVehicleName, setModalVehicleName] = useState('');
  const [noOfTank, setNoOfTank] = useState(1);
  const [noOfSensor, setNoOfSensor] = useState(1);
  const [minTheft, setMinTheft] = useState(5);
  const [minFilling, setMinFilling] = useState(9);
  const [modalTankSize, setModalTankSize] = useState(0);
  const [calibrateType, setCalibrateType] = useState('Auto'); // 'Auto' | 'Manual' | 'Direct'
  const [sensorDetails, setSensorDetails] = useState('');

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const modeOptions = [
    { value: '', label: '-- Select --' },
    { value: 'Moving Vehicle', label: 'Moving Vehicle' },
    { value: 'Machinery', label: 'Machinery' },
    { value: 'Dispenser', label: 'Dispenser' },
    { value: 'Diesel Generator(DG)', label: 'Diesel Generator(DG)' }
  ];

  const fuelTypeOptions = [
    { value: '', label: '-- Select --' },
    { value: 'Analog', label: 'Analog' },
    { value: 'Analog 2', label: 'Analog 2' },
    { value: 'LLS Fuel 1(Serial)', label: 'LLS Fuel 1(Serial)' },
    { value: 'LLS Fuel 2', label: 'LLS Fuel 2' },
    { value: 'LLS Fuel 3', label: 'LLS Fuel 3' },
    { value: 'BLE Fuel Level 1', label: 'BLE Fuel Level 1' },
    { value: 'BLE Fuel Level 2', label: 'BLE Fuel Level 2' },
    { value: 'BLE Fuel Level 3', label: 'BLE Fuel Level 3' },
    { value: 'BLE Fuel Level 4', label: 'BLE Fuel Level 4' }
  ];

  const tankShapeOptions = [
    { value: '', label: '-- SELECT --' },
    { value: 'Rectangle', label: 'Rectangle' },
    { value: 'Cylinder', label: 'Cylinder' }
  ];

  const tankPositionOptions = [
    { value: '', label: '-- SELECT --' },
    { value: 'Vertical', label: 'Vertical' },
    { value: 'Horizontal', label: 'Horizontal' }
  ];

  useEffect(() => {
    if (!id) {
      setError('No vehicle ID provided.');
      setLoading(false);
      return;
    }

    vehicleApi.getVehicleById(id)
      .then(res => {
        const v = res.data || res;
        setVehicle(v);

        // Preload from metadata if available
        const meta = v?.metadata || {};
        const cal = meta.fuelCalibration || {};
        const fuelCfg = meta.fuelConfig || {};

        setModeOfVehicle(cal.modeOfVehicle || meta.modeOfVehicle || '');
        setFuelType(cal.fuelType || meta.fuelType || 'Analog');
        setTankSize(cal.tankSize !== undefined ? cal.tankSize : (meta.tankSize || ''));
        setMinAdc(cal.minAdc !== undefined ? cal.minAdc : (meta.fuelEmptyAdc || ''));
        setMaxAdc(cal.maxAdc !== undefined ? cal.maxAdc : (meta.fuelFullAdc || ''));
        setFuelTankShape(cal.fuelTankShape || meta.fuelTankShape || '');
        setFuelTankPosition(cal.fuelTankPosition || meta.fuelTankPosition || '');

        // Preload General modal fields
        setModalVehicleName(v.name || '');
        setNoOfTank(fuelCfg.noOfTank ?? 1);
        setNoOfSensor(fuelCfg.noOfSensor ?? 1);
        setMinTheft(fuelCfg.minTheft ?? 5);
        setMinFilling(fuelCfg.minFilling ?? 9);
        setModalTankSize(fuelCfg.tankSize !== undefined ? fuelCfg.tankSize : (cal.tankSize !== undefined ? cal.tankSize : (meta.tankSize || 0)));
        setCalibrateType(fuelCfg.calibrateType || 'Auto');
        setSensorDetails(fuelCfg.sensorDetails || '');

        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load vehicle for calibration:', err);
        setError('Failed to load vehicle calibration details.');
        setLoading(false);
      });
  }, [id]);

  const handleSaveGeneral = async (e) => {
    if (e) e.preventDefault();
    setGeneralSaving(true);
    try {
      const payload = {
        name: modalVehicleName,
        noOfTank: parseInt(noOfTank) || 1,
        noOfSensor: parseInt(noOfSensor) || 1,
        minTheft: parseFloat(minTheft) || 5,
        minFilling: parseFloat(minFilling) || 9,
        tankSize: parseFloat(modalTankSize) || 0,
        calibrateType,
        sensorDetails
      };

      const res = await vehicleApi.calibrateVehicle(id, payload);
      if (res && res.data) {
        setVehicle(res.data);
      }
      if (modalTankSize !== '' && modalTankSize !== undefined) {
        setTankSize(modalTankSize);
      }
      setIsGeneralModalOpen(false);
      setSuccess('Fuel configuration details saved successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('General fuel config error:', err);
      alert(err.response?.data?.error || err.message || 'Failed to save fuel configuration details.');
    } finally {
      setGeneralSaving(false);
    }
  };

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const payload = {
        tankNo: activeTank,
        modeOfVehicle: modeOfVehicle || '',
        fuelType: fuelType || 'Analog',
        tankSize: tankSize !== '' ? parseFloat(tankSize) : '',
        minAdc: minAdc !== '' ? parseFloat(minAdc) : '',
        maxAdc: maxAdc !== '' ? parseFloat(maxAdc) : '',
        fuelTankShape: fuelTankShape || '',
        fuelTankPosition: fuelTankPosition || ''
      };

      await vehicleApi.calibrateVehicle(id, payload);
      setSuccess('Fuel calibration settings saved successfully!');
      setTimeout(() => {
        navigate('/admin/vehicles');
      }, 1500);
    } catch (err) {
      console.error('Calibration save error:', err);
      setError(err.response?.data?.error || err.message || 'Failed to save calibration.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '12px' }}>
        <Loader2 size={36} className="animate-spin" color="#f97316" />
        <span style={{ fontSize: '14px', color: '#64748b', fontWeight: 600 }}>Loading Fuel Calibration...</span>
      </div>
    );
  }

  const displayVehicleId = vehicle?.plate || vehicle?.name || vehicle?.imei || '125KVADGNEC_00135';

  return (
    <div className="pastel-page-bg" style={{ padding: '32px', minHeight: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
      <div style={{ maxWidth: '1150px', width: '100%', margin: '0 auto' }}>

        {/* Top Header & Breadcrumb Bar (Matching Screenshot: Edit Calibrate | Home > Vehicle list > Edit Calibrate > ID) */}
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
            Edit Calibrate
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
            <span style={{ color: '#64748b', fontWeight: 500 }}>Edit Calibrate</span>
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

        {/* Main Card (Matching Screenshot layout with FuelTracks UI brand aesthetics) */}
        <div style={{
          background: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 4px 16px rgba(15, 23, 42, 0.04)',
          overflow: 'hidden'
        }}>
          {/* Top Header Bar inside Card (FuelTracks Clean Off-White with Brand Orange Accents, NO blue) */}
          <div style={{
            background: '#fafbfc',
            borderBottom: '1px solid #f1f5f9',
            padding: '16px 26px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            flexWrap: 'wrap'
          }}>
            {/* Left: Tank 1 Tab Button */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setActiveTank(1)}
                style={{
                  background: activeTank === 1 ? '#f97316' : '#f1f5f9',
                  color: activeTank === 1 ? '#ffffff' : '#64748b',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '9px 24px',
                  fontSize: '13.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  boxShadow: activeTank === 1 ? '0 2px 8px rgba(249, 115, 22, 0.3)' : 'none'
                }}
                onMouseEnter={e => {
                  if (activeTank === 1) e.currentTarget.style.background = '#ea580c';
                }}
                onMouseLeave={e => {
                  if (activeTank === 1) e.currentTarget.style.background = '#f97316';
                }}
              >
                Tank 1
              </button>
            </div>

            {/* Right: Fuel Configuration Details Interactive Button */}
            <button
              type="button"
              onClick={() => setIsGeneralModalOpen(true)}
              style={{
                background: '#fff7ed',
                color: '#ea580c',
                border: '1px solid #fed7aa',
                borderRadius: '8px',
                padding: '8px 18px',
                fontSize: '13px',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                boxShadow: '0 1px 2px rgba(234, 88, 12, 0.08)'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = '#ffedd5';
                e.currentTarget.style.borderColor = '#fdba74';
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(234, 88, 12, 0.18)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = '#fff7ed';
                e.currentTarget.style.borderColor = '#fed7aa';
                e.currentTarget.style.boxShadow = '0 1px 2px rgba(234, 88, 12, 0.08)';
              }}
            >
              <Fuel size={15} color="#ea580c" />
              <span>Fuel Configuration Details</span>
            </button>
          </div>

          {/* Form Body: 3-column layout matching screenshot */}
          <form onSubmit={handleSave} style={{ padding: '36px 32px 44px 32px' }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '26px 32px',
              marginBottom: '40px'
            }}>

              {/* Row 1, Col 1: Mode of Vehicle (Custom Dropdown with Orange Highlight) */}
              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 700, color: '#334155', marginBottom: '8px' }}>
                  Mode of Vehicle
                </label>
                <FuelTracksSelect
                  value={modeOfVehicle}
                  onChange={setModeOfVehicle}
                  options={modeOptions}
                  placeholder="-- Select --"
                />
              </div>

              {/* Row 1, Col 2: Fuel Type (Custom Dropdown with Orange Highlight) */}
              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 700, color: '#334155', marginBottom: '8px' }}>
                  Fuel Type
                </label>
                <FuelTracksSelect
                  value={fuelType}
                  onChange={setFuelType}
                  options={fuelTypeOptions}
                  placeholder="-- Select --"
                />
              </div>

              {/* Row 1, Col 3: Tank Size (Note: In Litres) */}
              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 700, color: '#334155', marginBottom: '8px' }}>
                  Tank Size <span style={{ fontSize: '12px', fontWeight: 500, color: '#64748b' }}>(Note: In Litres)</span>
                </label>
                <input
                  type="number"
                  step="any"
                  value={tankSize}
                  onChange={e => setTankSize(e.target.value)}
                  placeholder="e.g. 200"
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

              {/* Row 2, Col 1: Minimum (RS value/Voltage) */}
              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 700, color: '#334155', marginBottom: '8px' }}>
                  Minimum (RS value/Voltage)
                </label>
                <input
                  type="number"
                  step="any"
                  value={minAdc}
                  onChange={e => setMinAdc(e.target.value)}
                  placeholder="e.g. 0 or 0.5"
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

              {/* Row 2, Col 2: Maximum (RS value/Voltage) */}
              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 700, color: '#334155', marginBottom: '8px' }}>
                  Maximum (RS value/Voltage)
                </label>
                <input
                  type="number"
                  step="any"
                  value={maxAdc}
                  onChange={e => setMaxAdc(e.target.value)}
                  placeholder="e.g. 4095 or 5.0"
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

              {/* Row 2, Col 3: Fuel Tank Shape (Custom Dropdown with Orange Highlight) */}
              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 700, color: '#334155', marginBottom: '8px' }}>
                  Fuel Tank Shape
                </label>
                <FuelTracksSelect
                  value={fuelTankShape}
                  onChange={setFuelTankShape}
                  options={tankShapeOptions}
                  placeholder="-- SELECT --"
                />
              </div>

              {/* Row 3, Col 1: Fuel Tank Position (Custom Dropdown with Orange Highlight) */}
              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 700, color: '#334155', marginBottom: '8px' }}>
                  Fuel Tank Position
                </label>
                <FuelTracksSelect
                  value={fuelTankPosition}
                  onChange={setFuelTankPosition}
                  options={tankPositionOptions}
                  placeholder="-- SELECT --"
                />
              </div>
            </div>

            {/* Bottom Centered Buttons (Cancel & Save with FuelTracks brand colors) */}
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
                disabled={saving}
                style={{
                  padding: '10px 38px',
                  borderRadius: '8px',
                  background: '#f97316',
                  color: '#ffffff',
                  fontSize: '14px',
                  fontWeight: 800,
                  border: 'none',
                  cursor: saving ? 'not-allowed' : 'pointer',
                  boxShadow: '0 4px 14px rgba(249, 115, 22, 0.3)',
                  transition: 'all 0.15s ease',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  opacity: saving ? 0.75 : 1
                }}
                onMouseEnter={e => {
                  if (!saving) {
                    e.currentTarget.style.background = '#ea580c';
                    e.currentTarget.style.boxShadow = '0 6px 18px rgba(249, 115, 22, 0.4)';
                  }
                }}
                onMouseLeave={e => {
                  if (!saving) {
                    e.currentTarget.style.background = '#f97316';
                    e.currentTarget.style.boxShadow = '0 4px 14px rgba(249, 115, 22, 0.3)';
                  }
                }}
              >
                {saving && <Loader2 size={16} className="animate-spin" />}
                <span>{saving ? 'Saving...' : 'Save'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* General Fuel Configuration Details Modal (Matching Screenshot) */}
      {isGeneralModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            padding: '16px'
          }}
          onClick={() => setIsGeneralModalOpen(false)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '820px',
              background: '#FFFFFF',
              borderRadius: '12px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              maxHeight: '92vh'
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '16px 24px',
              borderBottom: '1px solid #F1F5F9'
            }}>
              <h3 style={{
                fontSize: '17px',
                fontWeight: 700,
                color: '#EA580C',
                margin: 0
              }}>
                General
              </h3>
              <button
                type="button"
                onClick={() => setIsGeneralModalOpen(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#94A3B8',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  borderRadius: '6px'
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveGeneral} style={{
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '18px',
              overflowY: 'auto'
            }}>
              {/* Row 1: Vehicle Name & Vehicle ID */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                    Vehicle Name
                  </label>
                  <input
                    type="text"
                    value={modalVehicleName}
                    onChange={e => setModalVehicleName(e.target.value)}
                    placeholder="Enter Vehicle Name"
                    style={{
                      width: '100%',
                      height: '40px',
                      padding: '0 12px',
                      borderRadius: '6px',
                      border: '1px solid #CBD5E1',
                      background: '#FFFFFF',
                      fontSize: '13.5px',
                      color: '#0F172A',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                    Vehicle ID
                  </label>
                  <input
                    type="text"
                    readOnly
                    disabled
                    value={displayVehicleId}
                    style={{
                      width: '100%',
                      height: '40px',
                      padding: '0 12px',
                      borderRadius: '6px',
                      border: '1px solid #E2E8F0',
                      background: '#F1F5F9',
                      fontSize: '13.5px',
                      color: '#64748B',
                      outline: 'none',
                      boxSizing: 'border-box',
                      cursor: 'not-allowed'
                    }}
                  />
                </div>
              </div>

              {/* Row 2: Device Id / IMEI No & (No.of Tank, No.of Sensor) */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                    Device Id / IMEI No
                  </label>
                  <input
                    type="text"
                    readOnly
                    disabled
                    value={vehicle?.imei || ''}
                    style={{
                      width: '100%',
                      height: '40px',
                      padding: '0 12px',
                      borderRadius: '6px',
                      border: '1px solid #E2E8F0',
                      background: '#F1F5F9',
                      fontSize: '13.5px',
                      color: '#64748B',
                      outline: 'none',
                      boxSizing: 'border-box',
                      cursor: 'not-allowed'
                    }}
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                      No.of Tank <span style={{ color: '#EF4444' }}>*</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={noOfTank}
                      onChange={e => setNoOfTank(e.target.value)}
                      style={{
                        width: '100%',
                        height: '40px',
                        padding: '0 12px',
                        borderRadius: '6px',
                        border: '1px solid #CBD5E1',
                        background: '#FFFFFF',
                        fontSize: '13.5px',
                        color: '#0F172A',
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                      No.of Sensor <span style={{ color: '#EF4444' }}>*</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={noOfSensor}
                      onChange={e => setNoOfSensor(e.target.value)}
                      style={{
                        width: '100%',
                        height: '40px',
                        padding: '0 12px',
                        borderRadius: '6px',
                        border: '1px solid #CBD5E1',
                        background: '#FFFFFF',
                        fontSize: '13.5px',
                        color: '#0F172A',
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Row 3: Minimum Theft (Note: In litres) & Minimum Filling (Note: In litres) */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                    Minimum Theft <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 500 }}>(Note: In litres)</span>
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={minTheft}
                    onChange={e => setMinTheft(e.target.value)}
                    style={{
                      width: '100%',
                      height: '40px',
                      padding: '0 12px',
                      borderRadius: '6px',
                      border: '1px solid #CBD5E1',
                      background: '#FFFFFF',
                      fontSize: '13.5px',
                      color: '#0F172A',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                    Minimum Filling <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 500 }}>(Note: In litres)</span>
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={minFilling}
                    onChange={e => setMinFilling(e.target.value)}
                    style={{
                      width: '100%',
                      height: '40px',
                      padding: '0 12px',
                      borderRadius: '6px',
                      border: '1px solid #CBD5E1',
                      background: '#FFFFFF',
                      fontSize: '13.5px',
                      color: '#0F172A',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>

              {/* Row 4: Tank Size (Note: In Litres) * & Calibrate Type */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                    Tank Size <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 500 }}>(Note: In Litres)</span> <span style={{ color: '#EF4444' }}>*</span>
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={modalTankSize}
                    onChange={e => setModalTankSize(e.target.value)}
                    style={{
                      width: '100%',
                      height: '40px',
                      padding: '0 12px',
                      borderRadius: '6px',
                      border: '1px solid #CBD5E1',
                      background: '#FFFFFF',
                      fontSize: '13.5px',
                      color: '#0F172A',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                    Calibrate Type
                  </label>
                  <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                    {['Auto', 'Manual', 'Direct'].map(type => {
                      const isSelected = calibrateType === type;
                      return (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setCalibrateType(type)}
                          style={{
                            padding: '8px 22px',
                            borderRadius: '20px',
                            fontSize: '13px',
                            fontWeight: 700,
                            border: isSelected ? '1px solid #EA580C' : '1px solid #CBD5E1',
                            background: isSelected ? '#EA580C' : '#FFFFFF',
                            color: isSelected ? '#FFFFFF' : '#475569',
                            cursor: 'pointer',
                            boxShadow: isSelected ? '0 2px 6px rgba(234, 88, 12, 0.3)' : 'none',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          {type}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Row 5: Sensor Details */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Sensor Details
                </label>
                <textarea
                  rows={3}
                  value={sensorDetails}
                  onChange={e => setSensorDetails(e.target.value)}
                  placeholder=""
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '6px',
                    border: '1px solid #CBD5E1',
                    background: '#FFFFFF',
                    fontSize: '13.5px',
                    color: '#0F172A',
                    outline: 'none',
                    boxSizing: 'border-box',
                    resize: 'vertical'
                  }}
                />
              </div>

              {/* Footer Buttons Centered */}
              <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: '14px',
                marginTop: '10px',
                paddingTop: '16px',
                borderTop: '1px solid #F1F5F9'
              }}>
                <button
                  type="button"
                  onClick={() => setIsGeneralModalOpen(false)}
                  style={{
                    padding: '9px 26px',
                    borderRadius: '6px',
                    background: '#EF4444',
                    color: '#FFFFFF',
                    fontSize: '13.5px',
                    fontWeight: 700,
                    border: 'none',
                    cursor: 'pointer',
                    boxShadow: '0 2px 6px rgba(239, 68, 68, 0.25)',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = '#DC2626'}
                  onMouseLeave={e => e.currentTarget.style.background = '#EF4444'}
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={generalSaving}
                  style={{
                    padding: '9px 28px',
                    borderRadius: '6px',
                    background: '#EA580C',
                    color: '#FFFFFF',
                    fontSize: '13.5px',
                    fontWeight: 700,
                    border: 'none',
                    cursor: generalSaving ? 'not-allowed' : 'pointer',
                    opacity: generalSaving ? 0.75 : 1,
                    boxShadow: '0 2px 6px rgba(234, 88, 12, 0.3)',
                    transition: 'all 0.15s ease',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                  onMouseEnter={e => {
                    if (!generalSaving) e.currentTarget.style.background = '#C2410C';
                  }}
                  onMouseLeave={e => {
                    if (!generalSaving) e.currentTarget.style.background = '#EA580C';
                  }}
                >
                  {generalSaving && <Loader2 size={15} className="animate-spin" />}
                  <span>Save changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default EditCalibratePage;
