import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Home, ChevronRight, Loader2, AlertTriangle, CheckCircle, Fuel, ChevronDown, Check } from 'lucide-react';
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

        setModeOfVehicle(cal.modeOfVehicle || meta.modeOfVehicle || '');
        setFuelType(cal.fuelType || meta.fuelType || 'Analog');
        setTankSize(cal.tankSize !== undefined ? cal.tankSize : (meta.tankSize || ''));
        setMinAdc(cal.minAdc !== undefined ? cal.minAdc : (meta.fuelEmptyAdc || ''));
        setMaxAdc(cal.maxAdc !== undefined ? cal.maxAdc : (meta.fuelFullAdc || ''));
        setFuelTankShape(cal.fuelTankShape || meta.fuelTankShape || '');
        setFuelTankPosition(cal.fuelTankPosition || meta.fuelTankPosition || '');

        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load vehicle for calibration:', err);
        setError('Failed to load vehicle calibration details.');
        setLoading(false);
      });
  }, [id]);

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

            {/* Right: Fuel Configuration Details Badge/Button */}
            <div style={{
              background: '#fff7ed',
              color: '#ea580c',
              border: '1px solid #fed7aa',
              borderRadius: '8px',
              padding: '8px 18px',
              fontSize: '13px',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              userSelect: 'none'
            }}>
              <Fuel size={15} color="#ea580c" />
              <span>Fuel Configuration Details</span>
            </div>
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
    </div>
  );
};

export default EditCalibratePage;
