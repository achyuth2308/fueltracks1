import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Home, ChevronRight, Loader2, AlertTriangle, CheckCircle, RotateCw, Download,
  Radio, Fuel, Settings2, SlidersHorizontal, X, ArrowRight, Box,
  Table, Plus, Trash2, Upload, FileSpreadsheet, Activity, Cpu, Sparkles, Check, Info
} from 'lucide-react';
import * as XLSX from 'xlsx';
import * as vehicleApi from '../../api/vehicleApi';
import FuelTracksSelect from '../../components/ui/FuelTracksSelect';

const EditCalibratePage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [vehicle, setVehicle] = useState(null);

  // Active Tank Tab (Tank 1, Tank 2, etc.) & Multi-Tank State Preservation
  const [activeTank, setActiveTank] = useState(1);
  const [tanksData, setTanksData] = useState({});
  const [showFrequencyModal, setShowFrequencyModal] = useState(false);

  // General Configuration Fields
  const [vehicleName, setVehicleName] = useState('');
  const [noOfTank, setNoOfTank] = useState(1);
  const [noOfSensor, setNoOfSensor] = useState(1);
  const [sensorType, setSensorType] = useState('');
  const [minTheft, setMinTheft] = useState('');
  const [minFilling, setMinFilling] = useState('');
  const [calibrateType, setCalibrateType] = useState('Auto'); // 'Auto' | 'Manual' | 'Direct'
  const [sensorDetails, setSensorDetails] = useState('');

  // Fuel Calibration Parameters Fields
  const [modeOfVehicle, setModeOfVehicle] = useState('');
  const [fuelType, setFuelType] = useState('');
  const [tankSize, setTankSize] = useState('');
  const [minAdc, setMinAdc] = useState('');
  const [maxAdc, setMaxAdc] = useState('');
  const [fuelTankShape, setFuelTankShape] = useState('');
  const [fuelTankPosition, setFuelTankPosition] = useState('');

  // Dynamic Calculation Fields (Auto Mode)
  const [calculate, setCalculate] = useState(''); // 'Yes' | 'No'
  const [lengthMm, setLengthMm] = useState('');
  const [heightMm, setHeightMm] = useState('');
  const [widthMm, setWidthMm] = useState('');
  const [radiusMm, setRadiusMm] = useState('');

  // Manual Mode Multi-Point Table State
  const [manualSubMode, setManualSubMode] = useState('details'); // 'details' | 'upload'
  const [differenceOfLtrs, setDifferenceOfLtrs] = useState('');
  const [addCount, setAddCount] = useState('');
  const [calibrationPoints, setCalibrationPoints] = useState([]);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState('');

  // Direct Mode States
  const [directSensorType, setDirectSensorType] = useState('BLE Fuel Level 1');
  const [directUnit, setDirectUnit] = useState('Litres'); // 'Litres' | 'Percentage'
  const [directMultiplier, setDirectMultiplier] = useState('1.0');
  const [directOffset, setDirectOffset] = useState('0.0');
  const [directTestInput, setDirectTestInput] = useState('250');

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const sensorTypeOptions = [
    { value: '', label: '-- Select --' },
    { value: 'Jointech', label: 'Jointech' },
    { value: 'Technoton', label: 'Technoton' }
  ];

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
    { value: 'BLE Fuel Level 4', label: 'BLE Fuel Level 4' },
    { value: 'CAN-Bus / OBD-II', label: 'CAN-Bus / OBD-II' }
  ];

  const directUnitOptions = [
    { value: 'Litres', label: 'Litres (Actual Volume)' },
    { value: 'Percentage', label: 'Percentage (0 - 100%)' }
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

  const calculateOptions = [
    { value: '', label: '-- SELECT --' },
    { value: 'Yes', label: 'Yes' },
    { value: 'No', label: 'No' }
  ];

  const loadVehicleData = () => {
    if (!id) {
      setError('No vehicle ID provided.');
      setLoading(false);
      return;
    }

    setLoading(true);
    vehicleApi.getVehicleById(id)
      .then(res => {
        const v = res.data || res;
        setVehicle(v);

        // Preload metadata
        const meta = v?.metadata || {};
        const cal = meta.fuelCalibration || {};
        const fuelCfg = meta.fuelConfig || {};

        // General settings
        setVehicleName(v.name || '');
        setNoOfTank(fuelCfg.noOfTank ?? 1);
        setNoOfSensor(fuelCfg.noOfSensor ?? 1);
        setSensorType(fuelCfg.sensorType || cal.sensorType || meta.sensorType || '');
        setMinTheft(fuelCfg.minTheft !== undefined && fuelCfg.minTheft !== null ? fuelCfg.minTheft : '');
        setMinFilling(fuelCfg.minFilling !== undefined && fuelCfg.minFilling !== null ? fuelCfg.minFilling : '');
        setCalibrateType(cal.calibrateType || fuelCfg.calibrateType || 'Auto');
        setSensorDetails(fuelCfg.sensorDetails || '');

        // Calibration parameters
        const initialTankSize = fuelCfg.tankSize !== undefined && fuelCfg.tankSize !== ''
          ? fuelCfg.tankSize
          : (cal.tankSize !== undefined && cal.tankSize !== '' ? cal.tankSize : (meta.tankSize || ''));

        setTankSize(initialTankSize);
        setModeOfVehicle(cal.modeOfVehicle || meta.modeOfVehicle || '');
        setFuelType(cal.fuelType || meta.fuelType || '');
        setMinAdc(cal.minAdc !== undefined && cal.minAdc !== '' ? String(cal.minAdc) : (meta.fuelEmptyAdc !== undefined && meta.fuelEmptyAdc !== null ? String(meta.fuelEmptyAdc) : ''));
        setMaxAdc(cal.maxAdc !== undefined && cal.maxAdc !== '' ? String(cal.maxAdc) : (meta.fuelFullAdc !== undefined && meta.fuelFullAdc !== null ? String(meta.fuelFullAdc) : ''));
        setFuelTankShape(cal.fuelTankShape || meta.fuelTankShape || '');
        setFuelTankPosition(cal.fuelTankPosition || meta.fuelTankPosition || '');

        // Dimensions & Calculation
        setCalculate(cal.calculate || '');
        setLengthMm(cal.tankLength || '');
        setHeightMm(cal.tankHeight || '');
        setWidthMm(cal.tankWidth || '');
        setRadiusMm(cal.tankRadius || '');

        // Preload Manual Mode Calibration Points
        if (Array.isArray(cal.calibrationPoints) && cal.calibrationPoints.length > 0) {
          setCalibrationPoints(cal.calibrationPoints.map((p, idx) => ({
            id: idx + 1,
            litres: p.litres !== undefined ? p.litres : 0,
            volt: p.volt !== undefined ? p.volt : '0.00',
            frequency: p.frequency !== undefined ? p.frequency : (p.adcValue !== undefined ? p.adcValue : '0.00')
          })));
        } else {
          setCalibrationPoints([]);
        }

        // Preload Direct Mode Telemetry Configuration
        setDirectSensorType(cal.directSensorType || cal.fuelType || 'BLE Fuel Level 1');
        setDirectUnit(cal.directUnit || 'Litres');
        setDirectMultiplier(cal.directMultiplier !== undefined ? String(cal.directMultiplier) : '1.0');
        if (cal.tanks) {
          setTanksData(cal.tanks);
        }

        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load vehicle for calibration:', err);
        setError('Failed to load vehicle calibration details.');
        setLoading(false);
      });
  };

  const handleSwitchTank = (newTankNum) => {
    if (newTankNum === activeTank) return;

    // Snapshot current active tank state
    const currentSnapshot = {
      tankSize,
      modeOfVehicle,
      fuelType,
      minAdc,
      maxAdc,
      fuelTankShape,
      fuelTankPosition,
      calculate,
      tankLength: lengthMm,
      tankHeight: heightMm,
      tankWidth: widthMm,
      tankRadius: radiusMm,
      calibrateType,
      calibrationPoints,
      directSensorType,
      directUnit,
      directMultiplier,
      directOffset
    };

    const nextTanks = {
      ...tanksData,
      [activeTank]: currentSnapshot
    };
    setTanksData(nextTanks);

    // Load target tank configuration if present
    const target = nextTanks[newTankNum] || vehicle?.metadata?.fuelCalibration?.tanks?.[newTankNum];
    if (target) {
      setTankSize(target.tankSize !== undefined ? String(target.tankSize) : '');
      setModeOfVehicle(target.modeOfVehicle || '');
      setFuelType(target.fuelType || '');
      setMinAdc(target.minAdc !== undefined ? String(target.minAdc) : '');
      setMaxAdc(target.maxAdc !== undefined ? String(target.maxAdc) : '');
      setFuelTankShape(target.fuelTankShape || '');
      setFuelTankPosition(target.fuelTankPosition || '');
      setCalculate(target.calculate || '');
      setLengthMm(target.tankLength || '');
      setHeightMm(target.tankHeight || '');
      setWidthMm(target.tankWidth || '');
      setRadiusMm(target.tankRadius || '');
      setCalibrateType(target.calibrateType || 'Auto');
      if (Array.isArray(target.calibrationPoints) && target.calibrationPoints.length > 0) {
        setCalibrationPoints(target.calibrationPoints);
      } else {
        setCalibrationPoints([]);
      }
      setDirectSensorType(target.directSensorType || 'BLE Fuel Level 1');
      setDirectUnit(target.directUnit || 'Litres');
      setDirectMultiplier(target.directMultiplier !== undefined ? String(target.directMultiplier) : '1.0');
      setDirectOffset(target.directOffset !== undefined ? String(target.directOffset) : '0.0');
    } else {
      setTankSize('');
      setModeOfVehicle('');
      setFuelType('');
      setMinAdc('');
      setMaxAdc('');
      setFuelTankShape('');
      setFuelTankPosition('');
      setCalculate('');
      setLengthMm('');
      setHeightMm('');
      setWidthMm('');
      setRadiusMm('');
      setCalibrationPoints([]);
    }

    setActiveTank(newTankNum);
  };

  useEffect(() => {
    loadVehicleData();
  }, [id]);

  // Dynamically compute volume based on dimensions if Calculate is Yes
  const computedLitres = useMemo(() => {
    if (calculate !== 'Yes') {
      return tankSize && parseFloat(tankSize) > 0 ? parseFloat(tankSize) : 0;
    }
    if (fuelTankShape === 'Rectangle') {
      const l = parseFloat(lengthMm);
      const h = parseFloat(heightMm);
      const w = parseFloat(widthMm);
      if (l > 0 && h > 0 && w > 0) {
        // (L * H * W in mm^3) / 1,000,000 = Litres
        return Math.round((l * h * w) / 1000000 * 100) / 100;
      }
    } else if (fuelTankShape === 'Cylinder') {
      const r = parseFloat(radiusMm);
      const l = parseFloat(lengthMm);
      if (r > 0 && l > 0) {
        // (pi * r^2 * l in mm^3) / 1,000,000 = Litres
        return Math.round((Math.PI * Math.pow(r, 2) * l) / 1000000 * 100) / 100;
      }
    }
    return tankSize && parseFloat(tankSize) > 0 ? parseFloat(tankSize) : 0;
  }, [fuelTankShape, calculate, lengthMm, heightMm, widthMm, radiusMm, tankSize]);

  // Auto-sync tankSize when dimension values are entered
  useEffect(() => {
    if (calculate !== 'Yes') return;
    if (fuelTankShape === 'Rectangle') {
      const l = parseFloat(lengthMm);
      const h = parseFloat(heightMm);
      const w = parseFloat(widthMm);
      if (l > 0 && h > 0 && w > 0) {
        const litres = Math.round((l * h * w) / 1000000 * 100) / 100;
        setTankSize(litres.toString());
      }
    } else if (fuelTankShape === 'Cylinder') {
      const r = parseFloat(radiusMm);
      const l = parseFloat(lengthMm);
      if (r > 0 && l > 0) {
        const litres = Math.round((Math.PI * Math.pow(r, 2) * l) / 1000000 * 100) / 100;
        setTankSize(litres.toString());
      }
    }
  }, [fuelTankShape, calculate, lengthMm, heightMm, widthMm, radiusMm]);

  // Dynamic rectangular box scale & aspect ratio based on the actual values
  const visualTankDimensions = useMemo(() => {
    const l = parseFloat(lengthMm) || 0;
    const h = parseFloat(heightMm) || 0;

    let widthPx = 240;
    let heightPx = 120;

    if (fuelTankShape === 'Rectangle') {
      if (l > 0 && h > 0) {
        const ratio = l / h;
        if (fuelTankPosition === 'Vertical') {
          // Standing vertical: ensure adequate width for text
          heightPx = 190;
          widthPx = Math.max(155, Math.min(230, Math.round(190 / ratio)));
        } else {
          // Lying horizontal: broad and balanced
          widthPx = Math.max(190, Math.min(280, Math.round(130 * Math.sqrt(ratio))));
          heightPx = Math.max(90, Math.min(160, Math.round(widthPx / ratio)));
        }
      } else if (fuelTankPosition === 'Vertical') {
        widthPx = 160;
        heightPx = 190;
      } else {
        widthPx = 240;
        heightPx = 120;
      }
    }

    return { widthPx, heightPx };
  }, [fuelTankShape, lengthMm, heightMm, fuelTankPosition]);

  // Automatically populate Min/Max voltage or RS value based on selected Fuel Type
  const handleFuelTypeChange = (selectedType) => {
    setFuelType(selectedType);
    if (!selectedType) return;
    const lower = selectedType.toLowerCase();
    if (lower.includes('analog')) {
      setMinAdc('0.00');
      setMaxAdc('5.00');
    } else if (lower.includes('serial') || lower.includes('lls')) {
      setMinAdc('0');
      setMaxAdc('4095');
    }
  };

  // Helper functions for Manual Multi-Point Calibration Table
  const handleAddPoint = () => {
    setCalibrationPoints(prev => {
      const diff = parseFloat(differenceOfLtrs) || 5;
      const last = prev[prev.length - 1];
      const nextLitres = last ? (parseFloat(last.litres) || 0) + diff : diff;
      const lastFreq = last ? (parseFloat(last.frequency) || 100) : 100;
      const lastVolt = last ? (parseFloat(last.volt) || 0) : 0;
      const isAnalog = fuelType && fuelType.toLowerCase().includes('analog');
      const nextFreq = Math.round((lastFreq + 50) * 100) / 100;
      const nextVolt = isAnalog ? (Math.round((lastVolt + 0.45) * 100) / 100).toFixed(2) : '0.00';
      return [
        ...prev,
        {
          id: Date.now(),
          litres: nextLitres,
          volt: nextVolt,
          frequency: String(nextFreq)
        }
      ];
    });
  };

  const handleGenerateSteps = () => {
    const diff = parseFloat(differenceOfLtrs);
    const count = parseInt(addCount, 10);
    if (!diff || diff <= 0 || !count || count <= 0) {
      alert('Please enter valid positive values for Difference of Litres and Add Count.');
      return;
    }

    setCalibrationPoints(prev => {
      const lastLitres = prev.length > 0 ? (parseFloat(prev[prev.length - 1].litres) || 0) : 0;
      const lastFreq = prev.length > 0 ? (parseFloat(prev[prev.length - 1].frequency) || 100) : 100;
      const lastVolt = prev.length > 0 ? (parseFloat(prev[prev.length - 1].volt) || 0) : 0;
      const isAnalog = fuelType && fuelType.toLowerCase().includes('analog');
      const newRows = [];

      for (let i = 1; i <= count; i++) {
        const nextLitres = lastLitres + (i * diff);
        const estimatedFreq = Math.round((lastFreq + (i * 55)) * 100) / 100;
        const estimatedVolt = isAnalog 
          ? (Math.min(5.0, Math.round((lastVolt + (i * 0.45)) * 100) / 100)).toFixed(2) 
          : '0.00';
        newRows.push({
          id: Date.now() + i,
          litres: nextLitres,
          volt: estimatedVolt,
          frequency: String(estimatedFreq)
        });
      }

      return [...prev, ...newRows];
    });
  };

  const handleGetVolt = (rowId) => {
    // Capture live voltage or frequency from active vehicle/device metadata
    const liveVolt = vehicle?.metadata?.fuelVolt !== undefined
      ? parseFloat(vehicle.metadata.fuelVolt).toFixed(2)
      : (vehicle?.metadata?.batteryVoltage ? parseFloat(vehicle.metadata.batteryVoltage).toFixed(2) : '0.00');
    const liveFreq = vehicle?.metadata?.fuelFrequency !== undefined
      ? parseFloat(vehicle.metadata.fuelFrequency).toFixed(2)
      : (vehicle?.metadata?.fuelEmptyAdc ? String(vehicle.metadata.fuelEmptyAdc) : '134.00');

    setCalibrationPoints(prev => prev.map(p => {
      if (p.id === rowId) {
        return {
          ...p,
          volt: liveVolt,
          frequency: liveFreq
        };
      }
      return p;
    }));
  };

  const handleDeletePoint = (id) => {
    setCalibrationPoints(prev => prev.filter(p => p.id !== id));
  };

  const handleUpdatePoint = (id, field, value) => {
    setCalibrationPoints(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const handleExportExcel = () => {
    try {
      const sheetData = calibrationPoints.map((p, idx) => ({
        'Step #': idx + 1,
        'Litre': parseFloat(p.litres) || 0,
        'Volt': parseFloat(p.volt) || 0,
        'Frequency': parseFloat(p.frequency) || 0
      }));
      const ws = XLSX.utils.json_to_sheet(sheetData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, `Tank ${activeTank}`);
      XLSX.writeFile(wb, `Calibration_Tank_${activeTank}_${vehicle?.plate || displayVehicleId}.xlsx`);
    } catch (err) {
      console.error('Failed to export excel:', err);
      alert('Failed to export calibration points to Excel.');
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setUploadError('');
    setUploadSuccess('');

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws, { defval: '' });

        if (!data || data.length === 0) {
          setUploadError('The selected file contains no data rows.');
          return;
        }

        const parsed = [];
        data.forEach((rawRow, idx) => {
          // Normalize row keys: trimmed and lowercase
          const row = {};
          Object.keys(rawRow).forEach(k => {
            row[k.trim().toLowerCase()] = rawRow[k];
          });

          const litresVal = row['litre'] ?? row['litres'] ?? row['liters'] ?? row['fuel'] ?? row['step'] ?? row['volume'];
          const voltVal = row['volt'] ?? row['volts'] ?? row['voltage'] ?? 0;
          const freqVal = row['frequency'] ?? row['freq'] ?? row['sensor value (adc/rs)'] ?? row['adc'] ?? row['rs'] ?? 0;

          const l = parseFloat(litresVal);
          const v = parseFloat(voltVal) || 0;
          const f = parseFloat(freqVal) || 0;
          if (!isNaN(l)) {
            parsed.push({
              id: Date.now() + idx,
              litres: l,
              volt: v.toFixed(2),
              frequency: f.toFixed(2)
            });
          }
        });

        if (parsed.length < 1) {
          setUploadError('Could not find valid rows with Litre and Volt/Frequency values.');
          return;
        }

        parsed.sort((a, b) => a.litres - b.litres);
        setCalibrationPoints(parsed);
        setUploadSuccess(`Successfully imported ${parsed.length} calibration points!`);
        setTimeout(() => {
          setUploadSuccess('');
        }, 2000);
      } catch (err) {
        console.error('Excel parse error:', err);
        setUploadError('Failed to parse spreadsheet file. Please ensure valid file format.');
      }
    };
    reader.readAsBinaryString(file);
  };

  // Direct Mode Dynamic Simulator Calculation
  const directComputedLitres = useMemo(() => {
    const raw = parseFloat(directTestInput);
    if (isNaN(raw)) return 0;
    const mult = parseFloat(directMultiplier);
    const offset = parseFloat(directOffset);
    const m = !isNaN(mult) ? mult : 1.0;
    const o = !isNaN(offset) ? offset : 0.0;
    const scaled = (raw * m) + o;
    const cap = parseFloat(tankSize) || 0;
    if (directUnit === 'Percentage') {
      return cap > 0 ? Math.round(((scaled / 100) * cap) * 100) / 100 : Math.round(scaled * 100) / 100;
    }
    return Math.round(scaled * 100) / 100;
  }, [directTestInput, directMultiplier, directOffset, directUnit, tankSize]);

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    setError('');
    setSuccess('');

    const parsedTankSize = computedLitres > 0 ? computedLitres : (tankSize !== '' ? parseFloat(tankSize) : 0);

    // Validation checks for Auto, Manual, and Direct modes
    if (calibrateType === 'Auto') {
      if (parsedTankSize <= 0) {
        setError('Please specify a valid Tank Size (Litres) or valid dimensions for Auto calibration.');
        return;
      }
      if (minAdc !== '' && maxAdc !== '' && parseFloat(minAdc) === parseFloat(maxAdc)) {
        setError('Minimum and Maximum (RS value/Voltage) cannot be identical.');
        return;
      }
    } else if (calibrateType === 'Manual') {
      if (!Array.isArray(calibrationPoints) || calibrationPoints.length < 2) {
        setError('Manual calibration requires at least 2 calibration points in the table.');
        return;
      }
    }

    setSaving(true);

    try {
      const payload = {
        name: vehicleName,
        tankNo: activeTank,
        noOfTank: parseInt(noOfTank) || 1,
        noOfSensor: parseInt(noOfSensor) || 1,
        sensorType: sensorType || '',
        minTheft: parseFloat(minTheft) || 5,
        minFilling: parseFloat(minFilling) || 9,
        tankSize: parsedTankSize,
        calibrateType,
        sensorDetails,
        modeOfVehicle: modeOfVehicle || '',
        fuelType: calibrateType === 'Direct' ? directSensorType : (fuelType || 'Analog'),
        minAdc: minAdc !== '' ? parseFloat(minAdc) : '',
        maxAdc: maxAdc !== '' ? parseFloat(maxAdc) : '',
        fuelTankShape: fuelTankShape || '',
        fuelTankPosition: fuelTankPosition || '',
        calculate,
        tankLength: lengthMm,
        tankHeight: heightMm,
        tankWidth: widthMm,
        tankRadius: radiusMm,
        calibrationPoints: calibrationPoints.map(p => {
          const v = parseFloat(p.volt) || 0;
          const f = parseFloat(p.frequency) || 0;
          const isAnalog = fuelType && fuelType.toLowerCase().includes('analog');
          const adc = (isAnalog && v > 0) ? v : (f > 0 ? f : v);
          return {
            litres: parseFloat(p.litres) || 0,
            volt: v,
            frequency: f,
            adcValue: adc
          };
        }),
        directSensorType,
        directUnit,
        directMultiplier: parseFloat(directMultiplier) || 1.0,
        directOffset: parseFloat(directOffset) || 0.0,
        tanks: {
          ...tanksData,
          [activeTank]: {
            tankNo: activeTank,
            tankSize: parsedTankSize,
            modeOfVehicle,
            fuelType: calibrateType === 'Direct' ? directSensorType : (fuelType || 'Analog'),
            minAdc: minAdc !== '' ? parseFloat(minAdc) : '',
            maxAdc: maxAdc !== '' ? parseFloat(maxAdc) : '',
            fuelTankShape,
            fuelTankPosition,
            calculate,
            tankLength: lengthMm,
            tankHeight: heightMm,
            tankWidth: widthMm,
            tankRadius: radiusMm,
            calibrateType,
            calibrationPoints: calibrationPoints.map(p => {
              const v = parseFloat(p.volt) || 0;
              const f = parseFloat(p.frequency) || 0;
              const isAnalog = fuelType && fuelType.toLowerCase().includes('analog');
              const adc = (isAnalog && v > 0) ? v : (f > 0 ? f : v);
              return {
                litres: parseFloat(p.litres) || 0,
                volt: v,
                frequency: f,
                adcValue: adc
              };
            })
          }
        }
      };

      const res = await vehicleApi.calibrateVehicle(id, payload);
      if (res && res.data) {
        setVehicle(res.data);
      }
      setSuccess('Vehicle fuel configuration and calibration saved successfully.');
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

  const handleExportCalibration = () => {
    let modeDetails = '';
    if (calibrateType === 'Manual') {
      const rows = calibrationPoints.map((p, i) => `Step ${i + 1}: ${p.litres} L = ${p.adcValue} ADC`).join('\n');
      modeDetails = `Calibration Type: Manual (Dip Table)\nCalibration Points:\n${rows}`;
    } else if (calibrateType === 'Direct') {
      modeDetails = [
        `Calibration Type: Direct (Digital Sensor)`,
        `Sensor Protocol: ${directSensorType}`,
        `Direct Unit: ${directUnit}`,
        `Multiplier: ${directMultiplier}`,
        `Offset: ${directOffset}`,
        `Bypass ADC Conversion: Yes`
      ].join('\n');
    } else {
      modeDetails = [
        `Calibration Type: Auto (Dimension & Linear)`,
        `Minimum RS/Voltage: ${minAdc}`,
        `Maximum RS/Voltage: ${maxAdc}`,
        `Tank Shape: ${fuelTankShape}`,
        `Tank Position: ${fuelTankPosition}`,
        `Length (mm): ${lengthMm || 'N/A'}`,
        `Height (mm): ${heightMm || 'N/A'}`,
        `Width (mm): ${widthMm || 'N/A'}`,
        `Calculated Litres: ${computedLitres}`
      ].join('\n');
    }

    const data = [
      `Vehicle: ${vehicle?.name || displayVehicleId}`,
      `IMEI: ${vehicle?.imei || 'N/A'}`,
      `Tank: ${activeTank}`,
      `Mode: ${modeOfVehicle}`,
      `Tank Size (L): ${tankSize}`,
      modeDetails,
      `Exported At: ${new Date().toLocaleString()}`
    ].join('\n');

    const blob = new Blob([data], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Calibration_${vehicle?.plate || displayVehicleId}_Tank${activeTank}_${calibrateType}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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
  const tankCount = Math.max(1, parseInt(noOfTank) || 1);

  return (
    <div className="pastel-page-bg" style={{ padding: '28px 32px', minHeight: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
      <div style={{ maxWidth: '1200px', width: '100%', margin: '0 auto' }}>

        {/* Top Header & Breadcrumb Bar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          marginBottom: '22px',
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

          <div style={{ width: '1px', height: '20px', background: '#cbd5e1' }} />

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

        {/* Main Card with FuelTracks Design System */}
        <div style={{
          background: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 4px 16px rgba(15, 23, 42, 0.04)',
          overflow: 'hidden'
        }}>
          {/* Card Top Tab Bar */}
          <div style={{
            background: '#fafbfc',
            borderBottom: '1px solid #f1f5f9',
            padding: '14px 24px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            flexWrap: 'wrap'
          }}>
            {Array.from({ length: tankCount }, (_, i) => i + 1).map(tankNum => {
              const isSelected = activeTank === tankNum;
              return (
                <button
                  key={tankNum}
                  type="button"
                  onClick={() => handleSwitchTank(tankNum)}
                  style={{
                    background: isSelected ? '#f97316' : '#f1f5f9',
                    color: isSelected ? '#ffffff' : '#64748b',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '8px 22px',
                    fontSize: '13.5px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    boxShadow: isSelected ? '0 2px 8px rgba(249, 115, 22, 0.3)' : 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                  onMouseEnter={e => {
                    if (isSelected) e.currentTarget.style.background = '#ea580c';
                  }}
                  onMouseLeave={e => {
                    if (isSelected) e.currentTarget.style.background = '#f97316';
                  }}
                >
                  <Fuel size={14} />
                  <span>{`Tank ${tankNum}`}</span>
                </button>
              );
            })}
          </div>

          {/* Form Body */}
          <form onSubmit={handleSave} style={{ padding: '30px 28px 36px 28px' }}>

            {/* SECTION 1: General Configuration */}
            <div style={{
              marginBottom: '32px',
              background: '#f8fafc',
              border: '1px solid #f1f5f9',
              borderRadius: '10px',
              padding: '20px 24px'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '16px',
                paddingBottom: '10px',
                borderBottom: '1px solid #e2e8f0'
              }}>
                <Settings2 size={16} color="#ea580c" />
                <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                  General Configuration
                </h3>
                <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 500, marginLeft: '6px' }}>
                  (Vehicle Identity & Sensor Specifications)
                </span>
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                gap: '16px 24px'
              }}>
                {/* Vehicle ID (Read-only) */}
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
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
                      border: '1px solid #e2e8f0',
                      background: '#f1f5f9',
                      fontSize: '13.5px',
                      color: '#64748b',
                      outline: 'none',
                      boxSizing: 'border-box',
                      cursor: 'not-allowed'
                    }}
                  />
                </div>

                {/* Vehicle Name (Read-only) */}
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                    Vehicle Name
                  </label>
                  <input
                    type="text"
                    readOnly
                    disabled
                    value={vehicleName || vehicle?.name || ''}
                    style={{
                      width: '100%',
                      height: '40px',
                      padding: '0 12px',
                      borderRadius: '6px',
                      border: '1px solid #e2e8f0',
                      background: '#f1f5f9',
                      fontSize: '13.5px',
                      color: '#64748b',
                      outline: 'none',
                      boxSizing: 'border-box',
                      cursor: 'not-allowed'
                    }}
                  />
                </div>

                {/* Device Id / IMEI No (Read-only) */}
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
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
                      border: '1px solid #e2e8f0',
                      background: '#f1f5f9',
                      fontSize: '13.5px',
                      color: '#64748b',
                      outline: 'none',
                      boxSizing: 'border-box',
                      cursor: 'not-allowed'
                    }}
                  />
                </div>

                {/* No. of Tank */}
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                    No.of Tank <span style={{ color: '#ef4444' }}>*</span>
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
                      border: '1px solid #cbd5e1',
                      background: '#ffffff',
                      fontSize: '13.5px',
                      color: '#0f172a',
                      outline: 'none',
                      boxSizing: 'border-box'
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

                {/* No. of Sensor */}
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                    No.of Sensor <span style={{ color: '#ef4444' }}>*</span>
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
                      border: '1px solid #cbd5e1',
                      background: '#ffffff',
                      fontSize: '13.5px',
                      color: '#0f172a',
                      outline: 'none',
                      boxSizing: 'border-box'
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

                {/* Sensor Type */}
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                    Sensor Type
                  </label>
                  <FuelTracksSelect
                    value={sensorType}
                    onChange={setSensorType}
                    options={sensorTypeOptions}
                    placeholder="-- Select --"
                    height="40px"
                  />
                </div>

                {/* Calibrate Type */}
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                    Calibrate Type
                  </label>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                    {['Auto', 'Manual', 'Direct'].map(type => {
                      const isSelected = calibrateType === type;
                      return (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setCalibrateType(type)}
                          style={{
                            padding: '7px 18px',
                            borderRadius: '20px',
                            fontSize: '12.5px',
                            fontWeight: 700,
                            border: isSelected ? '1px solid #f97316' : '1px solid #cbd5e1',
                            background: isSelected ? '#f97316' : '#ffffff',
                            color: isSelected ? '#ffffff' : '#475569',
                            cursor: 'pointer',
                            boxShadow: isSelected ? '0 2px 6px rgba(249, 115, 22, 0.25)' : 'none',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          {type}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Minimum Theft */}
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                    Minimum Theft <span style={{ fontSize: '11px', color: '#64748b' }}>(Note: In litres)</span>
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
                      border: '1px solid #cbd5e1',
                      background: '#ffffff',
                      fontSize: '13.5px',
                      color: '#0f172a',
                      outline: 'none',
                      boxSizing: 'border-box'
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

                {/* Minimum Filling */}
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                    Minimum Filling <span style={{ fontSize: '11px', color: '#64748b' }}>(Note: In litres)</span>
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
                      border: '1px solid #cbd5e1',
                      background: '#ffffff',
                      fontSize: '13.5px',
                      color: '#0f172a',
                      outline: 'none',
                      boxSizing: 'border-box'
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

                {/* Sensor Details */}
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                    Sensor Details
                  </label>
                  <textarea
                    rows={2}
                    value={sensorDetails}
                    onChange={e => setSensorDetails(e.target.value)}
                    placeholder="Enter sensor specifications or installation details..."
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      background: '#ffffff',
                      fontSize: '13px',
                      color: '#0f172a',
                      outline: 'none',
                      boxSizing: 'border-box',
                      resize: 'vertical'
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
            </div>

            {/* SECTION 2: Tank Parameters Form matching Screenshot */}
            <div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '18px',
                paddingBottom: '10px',
                borderBottom: '1px solid #e2e8f0'
              }}>
                <SlidersHorizontal size={16} color="#ea580c" />
                <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                  {`Tank ${activeTank} Parameters`}
                </h3>
              </div>

              {/* Row 1: Mode of Vehicle, Fuel Type, Tank Size */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                gap: '18px 24px',
                marginBottom: '20px'
              }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13.5px', fontWeight: 700, color: '#334155', marginBottom: '7px' }}>
                    Mode of Vehicle
                  </label>
                  <FuelTracksSelect
                    value={modeOfVehicle}
                    onChange={setModeOfVehicle}
                    options={modeOptions}
                    placeholder="-- Select --"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13.5px', fontWeight: 700, color: '#334155', marginBottom: '7px' }}>
                    Fuel Type
                  </label>
                  <FuelTracksSelect
                    value={fuelType}
                    onChange={handleFuelTypeChange}
                    options={fuelTypeOptions}
                    placeholder="-- Select --"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13.5px', fontWeight: 700, color: '#334155', marginBottom: '7px' }}>
                    Tank Size <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 400 }}>(Note: In Litres)</span>
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={tankSize}
                    onChange={e => setTankSize(e.target.value)}
                    placeholder="e.g. 500"
                    style={{
                      width: '100%',
                      height: '42px',
                      padding: '0 14px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      background: '#ffffff',
                      fontSize: '13.5px',
                      color: '#0f172a',
                      outline: 'none',
                      boxSizing: 'border-box'
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

              {/* WHEN CALIBRATE TYPE IS AUTO: Render Min/Max ADC, Shape, Position, Dimensions, and Tank Preview */}
              {calibrateType === 'Auto' && (
                <>
                  {/* Row 2: Fuel Tank Shape, Fuel Tank Position, Calculate */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                    gap: '18px 24px',
                    marginBottom: '20px'
                  }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '13.5px', fontWeight: 700, color: '#334155', marginBottom: '7px' }}>
                        Fuel Tank Shape
                      </label>
                      <FuelTracksSelect
                        value={fuelTankShape}
                        onChange={setFuelTankShape}
                        options={tankShapeOptions}
                        placeholder="-- SELECT --"
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '13.5px', fontWeight: 700, color: '#334155', marginBottom: '7px' }}>
                        Fuel Tank Position
                      </label>
                      <FuelTracksSelect
                        value={fuelTankPosition}
                        onChange={setFuelTankPosition}
                        options={tankPositionOptions}
                        placeholder="-- SELECT --"
                      />
                    </div>

                    {(fuelTankShape === 'Rectangle' || fuelTankShape === 'Cylinder') && (
                      <div>
                        <label style={{ display: 'block', fontSize: '13.5px', fontWeight: 700, color: '#334155', marginBottom: '7px' }}>
                          Calculate
                        </label>
                        <FuelTracksSelect
                          value={calculate}
                          onChange={setCalculate}
                          options={calculateOptions}
                          placeholder="-- SELECT --"
                        />
                      </div>
                    )}
                  </div>

                  {/* Row 3: Minimum & Maximum Calibration Sensor Value */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                    gap: '18px 24px',
                    marginBottom: '20px'
                  }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '13.5px', fontWeight: 700, color: '#334155', marginBottom: '7px' }}>
                        {fuelType && fuelType.toLowerCase().includes('analog')
                          ? 'Minimum Voltage (V)'
                          : (fuelType && (fuelType.toLowerCase().includes('serial') || fuelType.toLowerCase().includes('lls'))
                            ? 'Minimum RS Value'
                            : 'Minimum (RS value/Voltage)')}
                      </label>
                      <input
                        type="number"
                        step="any"
                        value={minAdc}
                        onChange={e => setMinAdc(e.target.value)}
                        placeholder={fuelType && fuelType.toLowerCase().includes('analog') ? '0.00' : '0'}
                        style={{
                          width: '100%',
                          height: '42px',
                          padding: '0 14px',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1',
                          background: '#ffffff',
                          fontSize: '13.5px',
                          color: '#0f172a',
                          outline: 'none',
                          boxSizing: 'border-box'
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

                    <div>
                      <label style={{ display: 'block', fontSize: '13.5px', fontWeight: 700, color: '#334155', marginBottom: '7px' }}>
                        {fuelType && fuelType.toLowerCase().includes('analog')
                          ? 'Maximum Voltage (V)'
                          : (fuelType && (fuelType.toLowerCase().includes('serial') || fuelType.toLowerCase().includes('lls'))
                            ? 'Maximum RS Value'
                            : 'Maximum (RS value/Voltage)')}
                      </label>
                      <input
                        type="number"
                        step="any"
                        value={maxAdc}
                        onChange={e => setMaxAdc(e.target.value)}
                        placeholder={fuelType && fuelType.toLowerCase().includes('analog') ? '5.00' : '4095'}
                        style={{
                          width: '100%',
                          height: '42px',
                          padding: '0 14px',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1',
                          background: '#ffffff',
                          fontSize: '13.5px',
                          color: '#0f172a',
                          outline: 'none',
                          boxSizing: 'border-box'
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

                  {/* Dynamic Dimension Inputs for Cylinder */}
                  {fuelTankShape === 'Cylinder' && (
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                      gap: '18px 24px',
                      marginBottom: '20px'
                    }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '13.5px', fontWeight: 700, color: '#334155', marginBottom: '7px' }}>
                          Radius <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 400 }}>(in mm)</span>
                        </label>
                        <input
                          type="number"
                          step="any"
                          value={radiusMm}
                          onChange={e => setRadiusMm(e.target.value)}
                          placeholder="Radius"
                          style={{
                            width: '100%',
                            height: '42px',
                            padding: '0 14px',
                            borderRadius: '6px',
                            border: '1px solid #cbd5e1',
                            background: '#ffffff',
                            fontSize: '13.5px',
                            color: '#0f172a',
                            outline: 'none',
                            boxSizing: 'border-box'
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

                      <div>
                        <label style={{ display: 'block', fontSize: '13.5px', fontWeight: 700, color: '#334155', marginBottom: '7px' }}>
                          Length <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 400 }}>(in mm)</span>
                        </label>
                        <input
                          type="number"
                          step="any"
                          value={lengthMm}
                          onChange={e => setLengthMm(e.target.value)}
                          placeholder="Length"
                          style={{
                            width: '100%',
                            height: '42px',
                            padding: '0 14px',
                            borderRadius: '6px',
                            border: '1px solid #cbd5e1',
                            background: '#ffffff',
                            fontSize: '13.5px',
                            color: '#0f172a',
                            outline: 'none',
                            boxSizing: 'border-box'
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

                  {/* Dynamic Dimension Inputs for Rectangle when Calculate === 'Yes' */}
                  {fuelTankShape === 'Rectangle' && calculate === 'Yes' && (
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                      gap: '18px 24px',
                      marginBottom: '24px'
                    }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '13.5px', fontWeight: 700, color: '#334155', marginBottom: '7px' }}>
                          Length <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 400 }}>(in mm)</span>
                        </label>
                        <input
                          type="number"
                          step="any"
                          value={lengthMm}
                          onChange={e => setLengthMm(e.target.value)}
                          placeholder="Length"
                          style={{
                            width: '100%',
                            height: '42px',
                            padding: '0 14px',
                            borderRadius: '6px',
                            border: '1px solid #cbd5e1',
                            background: '#ffffff',
                            fontSize: '13.5px',
                            color: '#0f172a',
                            outline: 'none',
                            boxSizing: 'border-box'
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

                      <div>
                        <label style={{ display: 'block', fontSize: '13.5px', fontWeight: 700, color: '#334155', marginBottom: '7px' }}>
                          Height <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 400 }}>(in mm)</span>
                        </label>
                        <input
                          type="number"
                          step="any"
                          value={heightMm}
                          onChange={e => setHeightMm(e.target.value)}
                          placeholder="Height"
                          style={{
                            width: '100%',
                            height: '42px',
                            padding: '0 14px',
                            borderRadius: '6px',
                            border: '1px solid #cbd5e1',
                            background: '#ffffff',
                            fontSize: '13.5px',
                            color: '#0f172a',
                            outline: 'none',
                            boxSizing: 'border-box'
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

                      <div>
                        <label style={{ display: 'block', fontSize: '13.5px', fontWeight: 700, color: '#334155', marginBottom: '7px' }}>
                          Width <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 400 }}>(in mm)</span>
                        </label>
                        <input
                          type="number"
                          step="any"
                          value={widthMm}
                          onChange={e => setWidthMm(e.target.value)}
                          placeholder="Width"
                          style={{
                            width: '100%',
                            height: '42px',
                            padding: '0 14px',
                            borderRadius: '6px',
                            border: '1px solid #cbd5e1',
                            background: '#ffffff',
                            fontSize: '13.5px',
                            color: '#0f172a',
                            outline: 'none',
                            boxSizing: 'border-box'
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

                  {/* DEDICATED VISUAL TANK CARD (SHOWN BASED ON VALUES, NEVER HIDDEN) */}
                  {fuelTankShape && (
                    <div style={{
                      marginTop: '16px',
                      marginBottom: '24px',
                      background: '#fafbfc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '12px',
                      padding: '24px 28px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '16px',
                      position: 'relative'
                    }}>
                      {/* Card Title & Info */}
                      <div style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '10px',
                        borderBottom: '1px solid #e2e8f0',
                        paddingBottom: '12px'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Box size={16} color="#ea580c" />
                          <span style={{ fontSize: '13.5px', fontWeight: 800, color: '#0f172a' }}>
                            {`${fuelTankShape} Tank Preview`}
                          </span>
                          <span style={{
                            fontSize: '11.5px',
                            fontWeight: 700,
                            color: '#ea580c',
                            background: '#fff7ed',
                            padding: '2px 8px',
                            borderRadius: '12px',
                            border: '1px solid #fed7aa'
                          }}>
                            {`${fuelTankPosition}`}
                          </span>
                        </div>

                        {/* Formula Calculation Badge */}
                        <div style={{ fontSize: '12.5px', color: '#475569', fontWeight: 600 }}>
                          {fuelTankShape === 'Rectangle' && calculate === 'Yes' && lengthMm && heightMm && widthMm ? (
                            <span>
                              Volume = ({lengthMm} × {heightMm} × {widthMm}) ÷ 1,000,000 = <strong style={{ color: '#ea580c' }}>{computedLitres} Litres</strong>
                            </span>
                          ) : (
                            <span>
                              Calibrated Capacity: <strong style={{ color: '#ea580c' }}>{computedLitres || tankSize || 0} Litres</strong>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* RECTANGLE TANK RENDERING BASED ON THE VALUES */}
                      {fuelTankShape === 'Rectangle' && (
                        <div style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '16px 0'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                            {/* Left Dimension Badge: Height */}
                            {heightMm && (
                              <div style={{
                                fontSize: '11.5px',
                                fontWeight: 700,
                                color: '#334155',
                                background: '#ffffff',
                                padding: '4px 10px',
                                borderRadius: '0px',
                                border: '1px solid #cbd5e1',
                                whiteSpace: 'nowrap'
                              }}>
                                {`Height: ${heightMm} mm`}
                              </div>
                            )}

                            {/* Center Column: Top Length Badge directly aligned over the Tank Box */}
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                              {/* Top Dimension Badge: Length */}
                              {lengthMm && (
                                <div style={{
                                  fontSize: '11.5px',
                                  fontWeight: 700,
                                  color: '#334155',
                                  background: '#ffffff',
                                  padding: '3px 12px',
                                  borderRadius: '0px',
                                  border: '1px solid #cbd5e1',
                                  whiteSpace: 'nowrap'
                                }}>
                                  {`Length: ${lengthMm} mm`}
                                </div>
                              )}

                              {/* Sharp Rectangle Box in Theme Light Orange with NO CURVES */}
                              <div style={{
                                width: `${visualTankDimensions.widthPx}px`,
                                height: `${visualTankDimensions.heightPx}px`,
                                background: '#f97316',
                                borderRadius: '0px',
                                border: '2px solid #ea580c',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'all 0.2s ease',
                                padding: '12px',
                                boxSizing: 'border-box'
                              }}>
                                <span style={{
                                  color: '#ffffff',
                                  fontWeight: 800,
                                  fontSize: '19px',
                                  letterSpacing: '-0.01em',
                                  whiteSpace: 'nowrap'
                                }}>
                                  {`${computedLitres || tankSize || 0} Litre`}
                                </span>

                                {widthMm && (
                                  <span style={{
                                    color: '#ffffff',
                                    fontWeight: 700,
                                    fontSize: '12px',
                                    marginTop: '6px',
                                    whiteSpace: 'nowrap'
                                  }}>
                                    {`Width: ${widthMm} mm`}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* CYLINDER TANK RENDERING BASED ON THE VALUES */}
                      {fuelTankShape === 'Cylinder' && (() => {
                        const cylinderHeightVal = radiusMm ? (parseFloat(radiusMm) * 2) : (heightMm || '940');
                        const cylinderLengthVal = lengthMm || '650';
                        const numLitres = computedLitres || (tankSize ? parseFloat(tankSize) : 451);
                        const displayLitres = Math.abs(numLitres - Math.round(numLitres)) < 0.15 
                          ? Math.round(numLitres) 
                          : (Math.round(numLitres * 10) / 10);

                        return (
                          <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '12px',
                            padding: '16px 0'
                          }}>
                            {/* Conditionally Render Vertical vs Horizontal Cylinder in Theme Orange */}
                            {fuelTankPosition === 'Vertical' ? (
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                                  {/* Standing Vertical Cylinder in Theme Orange */}
                                  <svg width="200" height="240" viewBox="0 0 200 240" style={{ overflow: 'visible' }}>
                                    <defs>
                                      <linearGradient id="cylinderThemeOrangeGradV" x1="0" y1="0" x2="1" y2="0">
                                        <stop offset="0%" stopColor="#f97316" />
                                        <stop offset="35%" stopColor="#fb923c" />
                                        <stop offset="70%" stopColor="#f97316" />
                                        <stop offset="100%" stopColor="#ea580c" />
                                      </linearGradient>
                                      <filter id="cylinderOrangeShadow" x="-15%" y="-15%" width="130%" height="130%">
                                        <feDropShadow dx="0" dy="6" stdDeviation="8" floodColor="#ea580c" floodOpacity="0.2" />
                                      </filter>
                                    </defs>

                                    {/* Vertical Cylinder Body */}
                                    <path
                                      d="M 35 30 L 35 190 A 65 16 0 0 0 165 190 L 165 30 Z"
                                      fill="url(#cylinderThemeOrangeGradV)"
                                      stroke="#ea580c"
                                      strokeWidth="2.5"
                                      filter="url(#cylinderOrangeShadow)"
                                    />

                                    {/* Bottom Interior Depth */}
                                    <ellipse
                                      cx="100"
                                      cy="190"
                                      rx="65"
                                      ry="16"
                                      fill="rgba(234, 88, 12, 0.25)"
                                      stroke="#ea580c"
                                      strokeWidth="1.5"
                                      strokeOpacity="0.4"
                                    />

                                    {/* Bottom Cap Front Rim */}
                                    <path
                                      d="M 35 190 A 65 16 0 0 0 165 190"
                                      fill="none"
                                      stroke="#ea580c"
                                      strokeWidth="2.5"
                                    />

                                    {/* Top Ellipse Cap */}
                                    <ellipse
                                      cx="100"
                                      cy="30"
                                      rx="65"
                                      ry="16"
                                      fill="#fdba74"
                                      stroke="#ea580c"
                                      strokeWidth="2.5"
                                    />

                                    {/* Center Litres Volume Text in Crisp White */}
                                    <text
                                      x="100"
                                      y="118"
                                      textAnchor="middle"
                                      fill="#ffffff"
                                      fontSize="18"
                                      fontWeight="800"
                                      fontFamily="Inter, system-ui, -apple-system, sans-serif"
                                      style={{ textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}
                                    >
                                      {`${displayLitres} Litre`}
                                    </text>
                                  </svg>

                                  {/* Right Side Dimension Badge: Length */}
                                  <div style={{
                                    fontSize: '11.5px',
                                    fontWeight: 700,
                                    color: '#334155',
                                    background: '#ffffff',
                                    padding: '4px 8px',
                                    borderRadius: '0px',
                                    border: '1px solid #cbd5e1',
                                    writingMode: 'vertical-rl',
                                    textOrientation: 'mixed',
                                    letterSpacing: '0.02em'
                                  }}>
                                    {`Length: ${cylinderLengthVal} mm`}
                                  </div>
                                </div>

                                {/* Bottom Dimension Badge: Height */}
                                <div style={{
                                  fontSize: '11.5px',
                                  fontWeight: 700,
                                  color: '#334155',
                                  background: '#ffffff',
                                  padding: '3px 12px',
                                  borderRadius: '0px',
                                  border: '1px solid #cbd5e1',
                                  marginTop: '2px'
                                }}>
                                  {`Height: ${cylinderHeightVal} mm`}
                                </div>
                              </div>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                  {/* Left Dimension Badge: Height */}
                                  <div style={{
                                    fontSize: '11.5px',
                                    fontWeight: 700,
                                    color: '#334155',
                                    background: '#ffffff',
                                    padding: '3px 8px',
                                    borderRadius: '0px',
                                    border: '1px solid #cbd5e1'
                                  }}>
                                    {`Height: ${cylinderHeightVal} mm`}
                                  </div>

                                  {/* Lying Horizontal Cylinder in Theme Orange */}
                                  <svg width="260" height="150" viewBox="0 0 260 150" style={{ overflow: 'visible' }}>
                                    <defs>
                                      <linearGradient id="cylinderThemeOrangeGradH" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#fb923c" />
                                        <stop offset="50%" stopColor="#f97316" />
                                        <stop offset="100%" stopColor="#ea580c" />
                                      </linearGradient>
                                      <filter id="cylinderOrangeHShadow" x="-15%" y="-15%" width="130%" height="130%">
                                        <feDropShadow dx="0" dy="6" stdDeviation="8" floodColor="#ea580c" floodOpacity="0.2" />
                                      </filter>
                                    </defs>

                                    {/* Main Horizontal Cylinder body */}
                                    <path
                                      d="M 45 25 L 215 25 A 18 45 0 0 1 215 115 L 45 115 Z"
                                      fill="url(#cylinderThemeOrangeGradH)"
                                      stroke="#ea580c"
                                      strokeWidth="2.5"
                                      filter="url(#cylinderOrangeHShadow)"
                                    />

                                    {/* Left Ellipse Cap */}
                                    <ellipse
                                      cx="45"
                                      cy="70"
                                      rx="18"
                                      ry="45"
                                      fill="#fdba74"
                                      stroke="#ea580c"
                                      strokeWidth="2.5"
                                    />

                                    {/* Right End Curve */}
                                    <path
                                      d="M 215 25 A 18 45 0 0 1 215 115"
                                      fill="none"
                                      stroke="#ea580c"
                                      strokeWidth="2.5"
                                    />

                                    {/* Center Litres Volume Text in Crisp White */}
                                    <text
                                      x="130"
                                      y="76"
                                      textAnchor="middle"
                                      fill="#ffffff"
                                      fontSize="18"
                                      fontWeight="800"
                                      fontFamily="Inter, system-ui, -apple-system, sans-serif"
                                      style={{ textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}
                                    >
                                      {`${displayLitres} Litre`}
                                    </text>
                                  </svg>
                                </div>

                                {/* Bottom Dimension Badge: Length */}
                                <div style={{
                                  fontSize: '11.5px',
                                  fontWeight: 700,
                                  color: '#334155',
                                  background: '#ffffff',
                                  padding: '3px 12px',
                                  borderRadius: '0px',
                                  border: '1px solid #cbd5e1',
                                  marginTop: '2px'
                                }}>
                                  {`Length: ${cylinderLengthVal} mm`}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </>
              )}

              {/* WHEN CALIBRATE TYPE IS MANUAL: Render Multi-Point Step-by-Step Calibration Table */}
              {calibrateType === 'Manual' && (
                <div style={{ marginTop: '16px' }}>
                  {/* Sub-mode Selection Bar: Upload Calibration vs Calibration Details */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '16px',
                    padding: '14px 18px',
                    background: '#fafbfc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    marginBottom: '20px'
                  }}>
                    {/* Radio Buttons for Sub-mode */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '28px' }}>
                      <label style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        cursor: 'pointer',
                        fontSize: '13.5px',
                        fontWeight: 700,
                        color: manualSubMode === 'details' ? '#0f172a' : '#64748b'
                      }}>
                        <input
                          type="radio"
                          name="manualSubMode"
                          checked={manualSubMode === 'details'}
                          onChange={() => setManualSubMode('details')}
                          style={{ accentColor: '#f97316', width: '17px', height: '17px', cursor: 'pointer' }}
                        />
                        <span>Calibration Details</span>
                      </label>

                      <label style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        cursor: 'pointer',
                        fontSize: '13.5px',
                        fontWeight: 700,
                        color: manualSubMode === 'upload' ? '#0f172a' : '#64748b'
                      }}>
                        <input
                          type="radio"
                          name="manualSubMode"
                          checked={manualSubMode === 'upload'}
                          onChange={() => setManualSubMode('upload')}
                          style={{ accentColor: '#f97316', width: '17px', height: '17px', cursor: 'pointer' }}
                        />
                        <span>Upload Calibration</span>
                      </label>
                    </div>

                    {/* Difference of Ltrs & Add Count controls (Shown when in Calibration Details) */}
                    {manualSubMode === 'details' && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '13px', fontWeight: 700, color: '#334155' }}>
                            Difference of Ltrs
                          </span>
                          <input
                            type="number"
                            step="any"
                            value={differenceOfLtrs}
                            onChange={e => setDifferenceOfLtrs(e.target.value)}
                            placeholder="1"
                            style={{
                              width: '75px',
                              height: '36px',
                              padding: '0 10px',
                              borderRadius: '6px',
                              border: '1px solid #cbd5e1',
                              background: '#ffffff',
                              fontSize: '13px',
                              fontWeight: 700,
                              color: '#0f172a',
                              outline: 'none',
                              textAlign: 'center',
                              boxSizing: 'border-box'
                            }}
                            onFocus={e => {
                              e.target.style.borderColor = '#f97316';
                              e.target.style.boxShadow = '0 0 0 2px rgba(249, 115, 22, 0.15)';
                            }}
                            onBlur={e => {
                              e.target.style.borderColor = '#cbd5e1';
                              e.target.style.boxShadow = 'none';
                            }}
                          />
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '13px', fontWeight: 700, color: '#334155' }}>
                            Add Count
                          </span>
                          <input
                            type="number"
                            min="1"
                            value={addCount}
                            onChange={e => setAddCount(e.target.value)}
                            placeholder="Count"
                            style={{
                              width: '85px',
                              height: '36px',
                              padding: '0 10px',
                              borderRadius: '6px',
                              border: '1px solid #cbd5e1',
                              background: '#ffffff',
                              fontSize: '13px',
                              fontWeight: 700,
                              color: '#0f172a',
                              outline: 'none',
                              textAlign: 'center',
                              boxSizing: 'border-box'
                            }}
                            onFocus={e => {
                              e.target.style.borderColor = '#f97316';
                              e.target.style.boxShadow = '0 0 0 2px rgba(249, 115, 22, 0.15)';
                            }}
                            onBlur={e => {
                              e.target.style.borderColor = '#cbd5e1';
                              e.target.style.boxShadow = 'none';
                            }}
                          />
                        </div>

                        <button
                          type="button"
                          onClick={handleGenerateSteps}
                          style={{
                            height: '36px',
                            padding: '0 16px',
                            borderRadius: '6px',
                            background: '#f97316',
                            color: '#ffffff',
                            border: 'none',
                            fontSize: '13px',
                            fontWeight: 800,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            boxShadow: '0 2px 6px rgba(249, 115, 22, 0.25)',
                            transition: 'all 0.15s ease'
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = '#ea580c'}
                          onMouseLeave={e => e.currentTarget.style.background = '#f97316'}
                        >
                          <Plus size={15} />
                          <span>Add</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* SUB-VIEW 1: CALIBRATION DETAILS TABLE */}
                  {manualSubMode === 'details' && (
                    <div style={{
                      background: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '10px',
                      overflow: 'hidden',
                      boxShadow: '0 1px 4px rgba(0,0,0,0.02)'
                    }}>
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                          <thead>
                            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 700 }}>
                              <th style={{ padding: '12px 18px', width: '28%' }}>Litre</th>
                              <th style={{ padding: '12px 18px', width: '28%' }}>Volt</th>
                              <th style={{ padding: '12px 18px', width: '28%' }}>Frequency</th>
                              <th style={{ padding: '12px 18px', width: '16%', textAlign: 'center' }}>Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {calibrationPoints.length === 0 ? (
                              <tr>
                                <td colSpan={4} style={{ padding: '48px 18px', textAlign: 'center', background: '#ffffff' }}>
                                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                                    <Table size={32} color="#cbd5e1" />
                                    <span style={{ fontSize: '14px', fontWeight: 700, color: '#475569' }}>
                                      No Calibration Points Added
                                    </span>
                                    <span style={{ fontSize: '12.5px', color: '#94a3b8', maxWidth: '440px', lineHeight: 1.5 }}>
                                      Enter a <strong>Difference of Ltrs</strong> and <strong>Add Count</strong> above then click <strong>Add</strong>, or switch to <strong>Upload Calibration</strong> to import an Excel / CSV sheet.
                                    </span>
                                  </div>
                                </td>
                              </tr>
                            ) : (
                              calibrationPoints.map((point, index) => (
                              <tr
                                key={point.id}
                                style={{
                                  borderBottom: '1px solid #f1f5f9',
                                  background: index % 2 === 0 ? '#ffffff' : '#fafbfc'
                                }}
                              >
                                {/* Litre */}
                                <td style={{ padding: '8px 18px' }}>
                                  <input
                                    type="number"
                                    step="any"
                                    value={point.litres}
                                    onChange={e => handleUpdatePoint(point.id, 'litres', e.target.value)}
                                    placeholder="0"
                                    style={{
                                      width: '100%',
                                      maxWidth: '220px',
                                      height: '38px',
                                      padding: '0 12px',
                                      borderRadius: '6px',
                                      border: '1px solid #cbd5e1',
                                      background: '#ffffff',
                                      fontSize: '13px',
                                      fontWeight: 600,
                                      color: '#0f172a',
                                      outline: 'none',
                                      boxSizing: 'border-box'
                                    }}
                                    onFocus={e => {
                                      e.target.style.borderColor = '#f97316';
                                      e.target.style.boxShadow = '0 0 0 2px rgba(249, 115, 22, 0.15)';
                                    }}
                                    onBlur={e => {
                                      e.target.style.borderColor = '#cbd5e1';
                                      e.target.style.boxShadow = 'none';
                                    }}
                                  />
                                </td>

                                {/* Volt */}
                                <td style={{ padding: '8px 18px' }}>
                                  <input
                                    type="text"
                                    value={point.volt !== undefined ? point.volt : '0.00'}
                                    onChange={e => handleUpdatePoint(point.id, 'volt', e.target.value)}
                                    placeholder="0.00"
                                    style={{
                                      width: '100%',
                                      maxWidth: '220px',
                                      height: '38px',
                                      padding: '0 12px',
                                      borderRadius: '6px',
                                      border: '1px solid #cbd5e1',
                                      background: '#ffffff',
                                      fontSize: '13px',
                                      fontWeight: 600,
                                      color: '#0f172a',
                                      outline: 'none',
                                      boxSizing: 'border-box'
                                    }}
                                    onFocus={e => {
                                      e.target.style.borderColor = '#f97316';
                                      e.target.style.boxShadow = '0 0 0 2px rgba(249, 115, 22, 0.15)';
                                    }}
                                    onBlur={e => {
                                      e.target.style.borderColor = '#cbd5e1';
                                      e.target.style.boxShadow = 'none';
                                    }}
                                  />
                                </td>

                                {/* Frequency */}
                                <td style={{ padding: '8px 18px' }}>
                                  <input
                                    type="text"
                                    value={point.frequency !== undefined ? point.frequency : (point.adcValue !== undefined ? point.adcValue : '')}
                                    onChange={e => handleUpdatePoint(point.id, 'frequency', e.target.value)}
                                    placeholder="0.00"
                                    style={{
                                      width: '100%',
                                      maxWidth: '220px',
                                      height: '38px',
                                      padding: '0 12px',
                                      borderRadius: '6px',
                                      border: '1px solid #cbd5e1',
                                      background: '#ffffff',
                                      fontSize: '13px',
                                      fontWeight: 600,
                                      color: '#0f172a',
                                      outline: 'none',
                                      boxSizing: 'border-box'
                                    }}
                                    onFocus={e => {
                                      e.target.style.borderColor = '#f97316';
                                      e.target.style.boxShadow = '0 0 0 2px rgba(249, 115, 22, 0.15)';
                                    }}
                                    onBlur={e => {
                                      e.target.style.borderColor = '#cbd5e1';
                                      e.target.style.boxShadow = 'none';
                                    }}
                                  />
                                </td>

                                {/* Actions: Get Volt & Remove */}
                                <td style={{ padding: '8px 18px', textAlign: 'center' }}>
                                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                                    <button
                                      type="button"
                                      onClick={() => handleGetVolt(point.id)}
                                      style={{
                                        background: '#fff7ed',
                                        color: '#ea580c',
                                        border: '1px solid #fdba74',
                                        borderRadius: '6px',
                                        padding: '5px 12px',
                                        fontSize: '12px',
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                        whiteSpace: 'nowrap',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '5px',
                                        transition: 'all 0.15s ease'
                                      }}
                                      onMouseEnter={e => {
                                        e.currentTarget.style.background = '#f97316';
                                        e.currentTarget.style.color = '#ffffff';
                                        e.currentTarget.style.borderColor = '#ea580c';
                                      }}
                                      onMouseLeave={e => {
                                        e.currentTarget.style.background = '#fff7ed';
                                        e.currentTarget.style.color = '#ea580c';
                                        e.currentTarget.style.borderColor = '#fdba74';
                                      }}
                                      title="Capture live reading from sensor"
                                    >
                                      <Activity size={13} />
                                      <span>Get Volt</span>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => handleDeletePoint(point.id)}
                                      style={{
                                        background: '#fef2f2',
                                        color: '#dc2626',
                                        border: '1px solid #fecaca',
                                        borderRadius: '6px',
                                        padding: '5px 12px',
                                        fontSize: '12px',
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                        whiteSpace: 'nowrap',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '5px',
                                        transition: 'all 0.15s ease'
                                      }}
                                      onMouseEnter={e => {
                                        e.currentTarget.style.background = '#dc2626';
                                        e.currentTarget.style.color = '#ffffff';
                                        e.currentTarget.style.borderColor = '#dc2626';
                                      }}
                                      onMouseLeave={e => {
                                        e.currentTarget.style.background = '#fef2f2';
                                        e.currentTarget.style.color = '#dc2626';
                                        e.currentTarget.style.borderColor = '#fecaca';
                                      }}
                                      title="Remove this row"
                                    >
                                      <Trash2 size={13} />
                                      <span>Remove</span>
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            )))}
                          </tbody>
                        </table>
                      </div>

                      {/* Bottom bar with Export helper */}
                      <div style={{
                        padding: '12px 18px',
                        background: '#f8fafc',
                        borderTop: '1px solid #e2e8f0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '12px'
                      }}>
                        <span style={{ fontSize: '12.5px', color: '#64748b' }}>
                          Total steps: <strong style={{ color: '#0f172a' }}>{calibrationPoints.length}</strong>
                          {calibrationPoints.length > 0 ? (
                            <> | Range: <strong style={{ color: '#ea580c' }}>{calibrationPoints[0]?.litres || 0} L ➔ {calibrationPoints[calibrationPoints.length - 1]?.litres || 0} L</strong></>
                          ) : (
                            <span style={{ color: '#94a3b8', marginLeft: '6px' }}>(Table is empty)</span>
                          )}
                        </span>

                        {calibrationPoints.length > 0 && (
                          <button
                            type="button"
                            onClick={handleExportExcel}
                            style={{
                              background: '#ffffff',
                              color: '#0f172a',
                              border: '1px solid #cbd5e1',
                              borderRadius: '6px',
                              padding: '6px 14px',
                              fontSize: '12px',
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px'
                            }}
                          >
                            <Download size={13} color="#16a34a" />
                            <span>Export Sheet</span>
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* SUB-VIEW 2: UPLOAD CALIBRATION */}
                  {manualSubMode === 'upload' && (
                    <div style={{
                      background: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '10px',
                      padding: '28px',
                      boxShadow: '0 1px 4px rgba(0,0,0,0.02)'
                    }}>
                      <div style={{ maxWidth: '600px', margin: '0 auto', textAlign: 'center' }}>
                        <FileSpreadsheet size={36} color="#ea580c" style={{ margin: '0 auto 12px auto' }} />
                        <h4 style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', margin: '0 0 6px 0' }}>
                          Upload Calibration File
                        </h4>
                        <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 20px 0', lineHeight: 1.5 }}>
                          Upload an Excel (.xlsx / .xls) or CSV (.csv) file with columns for <strong>Litre</strong>, <strong>Volt</strong>, and <strong>Frequency</strong>.
                        </p>

                        {uploadError && (
                          <div style={{
                            background: '#fef2f2',
                            border: '1px solid #fecaca',
                            borderRadius: '8px',
                            padding: '10px 14px',
                            color: '#dc2626',
                            fontSize: '12.5px',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            marginBottom: '16px',
                            textAlign: 'left'
                          }}>
                            <AlertTriangle size={16} />
                            <span>{uploadError}</span>
                          </div>
                        )}

                        {uploadSuccess && (
                          <div style={{
                            background: '#f0fdf4',
                            border: '1px solid #bbf7d0',
                            borderRadius: '8px',
                            padding: '10px 14px',
                            color: '#16a34a',
                            fontSize: '12.5px',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            marginBottom: '16px',
                            textAlign: 'left'
                          }}>
                            <CheckCircle size={16} />
                            <span>{uploadSuccess}</span>
                          </div>
                        )}

                        {/* Upload Dropzone */}
                        <label style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          border: '2px dashed #fed7aa',
                          borderRadius: '10px',
                          padding: '36px 20px',
                          background: '#fff7ed',
                          cursor: 'pointer',
                          marginBottom: '18px',
                          transition: 'all 0.15s ease'
                        }}>
                          <Upload size={36} color="#f97316" style={{ marginBottom: '10px' }} />
                          <span style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', marginBottom: '4px' }}>
                            Click to choose spreadsheet file
                          </span>
                          <span style={{ fontSize: '12px', color: '#64748b' }}>
                            Accepts .xlsx, .xls, .csv files
                          </span>
                          <input
                            type="file"
                            accept=".xlsx, .xls, .csv"
                            onChange={handleFileUpload}
                            style={{ display: 'none' }}
                          />
                        </label>

                        <button
                          type="button"
                          onClick={handleExportExcel}
                          style={{
                            background: 'none',
                            border: 'none',
                            padding: 0,
                            fontSize: '13px',
                            fontWeight: 700,
                            color: '#ea580c',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            textDecoration: 'underline'
                          }}
                        >
                          <Download size={14} />
                          <span>Download Sample Template</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* WHEN CALIBRATE TYPE IS DIRECT: Render Digital Telemetry Settings & Simulator */}
              {calibrateType === 'Direct' && (
                <div style={{ marginTop: '20px' }}>
                  {/* Row 2 for Direct: Direct Reading Unit, Multiplier, Offset */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                    gap: '18px 24px',
                    marginBottom: '20px'
                  }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '13.5px', fontWeight: 700, color: '#334155', marginBottom: '7px' }}>
                        Direct Reading Unit
                      </label>
                      <FuelTracksSelect
                        value={directUnit}
                        onChange={setDirectUnit}
                        options={directUnitOptions}
                        placeholder="Select Unit"
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '13.5px', fontWeight: 700, color: '#334155', marginBottom: '7px' }}>
                        Value Multiplier <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 400 }}>(Default 1.0)</span>
                      </label>
                      <input
                        type="number"
                        step="any"
                        value={directMultiplier}
                        onChange={e => setDirectMultiplier(e.target.value)}
                        placeholder="1.0"
                        style={{
                          width: '100%',
                          height: '42px',
                          padding: '0 14px',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1',
                          background: '#ffffff',
                          fontSize: '13.5px',
                          color: '#0f172a',
                          outline: 'none',
                          boxSizing: 'border-box'
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

                    <div>
                      <label style={{ display: 'block', fontSize: '13.5px', fontWeight: 700, color: '#334155', marginBottom: '7px' }}>
                        Value Offset <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 400 }}>(Default 0.0)</span>
                      </label>
                      <input
                        type="number"
                        step="any"
                        value={directOffset}
                        onChange={e => setDirectOffset(e.target.value)}
                        placeholder="0.0"
                        style={{
                          width: '100%',
                          height: '42px',
                          padding: '0 14px',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1',
                          background: '#ffffff',
                          fontSize: '13.5px',
                          color: '#0f172a',
                          outline: 'none',
                          boxSizing: 'border-box'
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

                  {/* Direct Telemetry Architecture & Simulator Card */}
                  <div style={{
                    background: '#fafbfc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    padding: '24px 28px',
                    marginBottom: '24px'
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '10px',
                      paddingBottom: '14px',
                      borderBottom: '1px solid #e2e8f0',
                      marginBottom: '18px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Cpu size={18} color="#ea580c" />
                        <span style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>
                          Pre-Calibrated Digital Telemetry Protocol
                        </span>
                        <span style={{
                          fontSize: '11.5px',
                          fontWeight: 700,
                          color: '#16a34a',
                          background: '#f0fdf4',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          border: '1px solid #bbf7d0'
                        }}>
                          Bypasses Raw ADC Curve
                        </span>
                      </div>

                      <div style={{ fontSize: '12.5px', color: '#475569', fontWeight: 600 }}>
                        <span>
                          Active Protocol: <strong style={{ color: '#ea580c' }}>{fuelType}</strong>
                        </span>
                      </div>
                    </div>

                    <div style={{
                      background: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      padding: '16px 20px',
                      marginBottom: '20px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#334155' }}>
                        <Info size={16} color="#f97316" />
                        <span>
                          Digital sensors transmit calibrated fuel level directly. Ingested value formula:
                        </span>
                      </div>
                      <div style={{
                        background: '#fff7ed',
                        border: '1px dashed #fdba74',
                        borderRadius: '6px',
                        padding: '10px 16px',
                        fontSize: '13px',
                        fontWeight: 700,
                        color: '#c2410c'
                      }}>
                        {`Computed Litres = (Packet Telemetry × ${directMultiplier || 1.0}) + ${directOffset || 0.0} ${directUnit === 'Percentage' ? `× (${tankSize || 500}L ÷ 100)` : ''}`}
                      </div>
                    </div>

                    {/* Live Interactive Telemetry Simulator */}
                    <div style={{
                      background: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      padding: '18px 20px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                        <Activity size={16} color="#ea580c" />
                        <span style={{ fontSize: '13.5px', fontWeight: 800, color: '#0f172a' }}>
                          Interactive Sensor Packet Simulator
                        </span>
                        <span style={{ fontSize: '12px', color: '#64748b' }}>
                          (Simulate live packet payload to verify output)
                        </span>
                      </div>

                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                        gap: '16px',
                        alignItems: 'center'
                      }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
                            Simulated Telemetry Value {directUnit === 'Percentage' ? '(%)' : '(Litres)'}:
                          </label>
                          <input
                            type="number"
                            step="any"
                            value={directTestInput}
                            onChange={e => setDirectTestInput(e.target.value)}
                            placeholder="e.g. 250"
                            style={{
                              width: '100%',
                              height: '40px',
                              padding: '0 12px',
                              borderRadius: '6px',
                              border: '1px solid #cbd5e1',
                              background: '#ffffff',
                              fontSize: '13.5px',
                              fontWeight: 700,
                              color: '#0f172a',
                              outline: 'none',
                              boxSizing: 'border-box'
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

                        <div style={{
                          background: '#fafbfc',
                          border: '1px solid #e2e8f0',
                          borderRadius: '8px',
                          padding: '12px 18px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#64748b' }}>
                            <span>Live Processed Output:</span>
                            <strong style={{ color: '#ea580c', fontSize: '14px' }}>{`${directComputedLitres} Litres`}</strong>
                          </div>

                          {/* Gauge progress bar in Theme Orange */}
                          <div style={{ width: '100%', height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                            <div style={{
                              width: `${parseFloat(tankSize) > 0 ? Math.min(100, Math.max(0, (directComputedLitres / parseFloat(tankSize)) * 100)) : 0}%`,
                              height: '100%',
                              background: '#f97316',
                              borderRadius: '4px',
                              transition: 'width 0.2s ease'
                            }} />
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#94a3b8' }}>
                            <span>0 L</span>
                            <span>{`${parseFloat(tankSize) > 0 ? Math.round((directComputedLitres / parseFloat(tankSize)) * 1000) / 10 : 0}% Capacity`}</span>
                            <span>{`${tankSize || 500} L`}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Practical Action Buttons */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowFrequencyModal(true)}
                  style={{
                    background: '#fff7ed',
                    color: '#ea580c',
                    border: '1px solid #fed7aa',
                    borderRadius: '20px',
                    padding: '8px 20px',
                    fontSize: '12.5px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    boxShadow: '0 1px 2px rgba(234, 88, 12, 0.08)'
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = '#ffedd5';
                    e.currentTarget.style.borderColor = '#fdba74';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = '#fff7ed';
                    e.currentTarget.style.borderColor = '#fed7aa';
                  }}
                >
                  Show Frequency
                </button>

                <button
                  type="button"
                  onClick={loadVehicleData}
                  title="Reload Calibration Data"
                  style={{
                    background: '#f1f5f9',
                    color: '#475569',
                    border: '1px solid #cbd5e1',
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = '#e2e8f0';
                    e.currentTarget.style.color = '#0f172a';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = '#f1f5f9';
                    e.currentTarget.style.color = '#475569';
                  }}
                >
                  <RotateCw size={15} />
                </button>

                <button
                  type="button"
                  onClick={handleExportCalibration}
                  title="Export Calibration Settings"
                  style={{
                    background: '#f0fdf4',
                    color: '#16a34a',
                    border: '1px solid #bbf7d0',
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = '#dcfce7';
                    e.currentTarget.style.borderColor = '#86efac';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = '#f0fdf4';
                    e.currentTarget.style.borderColor = '#bbf7d0';
                  }}
                >
                  <Download size={15} />
                </button>
              </div>
            </div>

            {/* Bottom Centered Buttons */}
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '14px',
              marginTop: '40px',
              paddingTop: '20px',
              borderTop: '1px solid #f1f5f9'
            }}>
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
                  padding: '10px 40px',
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

      {/* Show Frequency Modal */}
      {showFrequencyModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100000,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
          onClick={() => setShowFrequencyModal(false)}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '12px',
              padding: '24px',
              width: '100%',
              maxWidth: '460px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
              position: 'relative'
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Radio size={18} color="#ea580c" />
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>
                  Live Sensor Frequency
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowFrequencyModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ background: '#f8fafc', borderRadius: '8px', padding: '16px', marginBottom: '18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px' }}>
                <span style={{ color: '#64748b', fontWeight: 500 }}>Vehicle:</span>
                <span style={{ color: '#0f172a', fontWeight: 700 }}>{displayVehicleId}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px' }}>
                <span style={{ color: '#64748b', fontWeight: 500 }}>Sensor Type:</span>
                <span style={{ color: '#0f172a', fontWeight: 700 }}>{fuelType}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px' }}>
                <span style={{ color: '#64748b', fontWeight: 500 }}>Calibrated ADC Range:</span>
                <span style={{ color: '#ea580c', fontWeight: 800 }}>{`${minAdc || 0} ~ ${maxAdc || 4095}`}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <span style={{ color: '#64748b', fontWeight: 500 }}>Tank Volume:</span>
                <span style={{ color: '#16a34a', fontWeight: 800 }}>{`${computedLitres} Litres`}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowFrequencyModal(false)}
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: '6px',
                background: '#f97316',
                color: '#ffffff',
                border: 'none',
                fontWeight: 700,
                fontSize: '13.5px',
                cursor: 'pointer'
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Excel / CSV Import Modal for Manual Calibration */}
      {showUploadModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100000,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
          onClick={() => {
            setShowUploadModal(false);
            setUploadError('');
            setUploadSuccess('');
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '12px',
              padding: '26px 28px',
              width: '100%',
              maxWidth: '520px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
              position: 'relative'
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileSpreadsheet size={20} color="#ea580c" />
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>
                  Import Calibration Spreadsheet
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowUploadModal(false);
                  setUploadError('');
                  setUploadSuccess('');
                }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
              >
                <X size={20} />
              </button>
            </div>

            <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 16px 0', lineHeight: 1.5 }}>
              Upload an Excel (.xlsx / .xls) or CSV (.csv) file containing calibration step data. The sheet should have columns for <strong>Litres</strong> and <strong>Sensor Value (ADC/RS)</strong>.
            </p>

            {uploadError && (
              <div style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '8px',
                padding: '10px 14px',
                color: '#dc2626',
                fontSize: '12.5px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '14px'
              }}>
                <AlertTriangle size={16} />
                <span>{uploadError}</span>
              </div>
            )}

            {uploadSuccess && (
              <div style={{
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: '8px',
                padding: '10px 14px',
                color: '#16a34a',
                fontSize: '12.5px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '14px'
              }}>
                <CheckCircle size={16} />
                <span>{uploadSuccess}</span>
              </div>
            )}

            {/* Drag & Drop / File Select Box */}
            <label style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              border: '2px dashed #fed7aa',
              borderRadius: '10px',
              padding: '28px 20px',
              background: '#fff7ed',
              cursor: 'pointer',
              marginBottom: '18px',
              transition: 'all 0.15s ease'
            }}>
              <Upload size={32} color="#f97316" style={{ marginBottom: '10px' }} />
              <span style={{ fontSize: '13.5px', fontWeight: 700, color: '#0f172a', marginBottom: '4px' }}>
                Click to choose spreadsheet file
              </span>
              <span style={{ fontSize: '11.5px', color: '#64748b' }}>
                Supports .xlsx, .xls, .csv files
              </span>
              <input
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleFileUpload}
                style={{ display: 'none' }}
              />
            </label>

            {/* Action buttons */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                type="button"
                onClick={handleExportExcel}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  fontSize: '12.5px',
                  fontWeight: 600,
                  color: '#ea580c',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  textDecoration: 'underline'
                }}
              >
                <Download size={13} />
                <span>Download Sample Template</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowUploadModal(false);
                  setUploadError('');
                  setUploadSuccess('');
                }}
                style={{
                  padding: '8px 22px',
                  borderRadius: '6px',
                  background: '#f1f5f9',
                  color: '#475569',
                  border: '1px solid #cbd5e1',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EditCalibratePage;
