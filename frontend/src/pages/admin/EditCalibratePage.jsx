import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Home, ChevronRight, Loader2, AlertTriangle, CheckCircle, RotateCw, Download,
  Radio, Fuel, Settings2, SlidersHorizontal, X, ArrowRight, ArrowLeft, Box,
  Table, Plus, Trash2, Upload, FileSpreadsheet, Activity, Cpu, Sparkles, Check, Info,
  ChevronDown, Gauge
} from 'lucide-react';
import * as XLSX from 'xlsx';
import * as vehicleApi from '../../api/vehicleApi';
import FuelTracksSelect from '../../components/ui/FuelTracksSelect';
import LiveFuelModal from '../../components/modals/LiveFuelModal';

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
  const [freqModalViewMode, setFreqModalViewMode] = useState('volt'); // 'volt' | 'frequency'
  const [showLiveFuelModal, setShowLiveFuelModal] = useState(false);

  // Active Sensor Tab (Sensor 1, Sensor 2, etc.) inside Active Tank
  const [activeSensor, setActiveSensor] = useState(1);
  const [sensorFormula, setSensorFormula] = useState('Average'); // 'Average' | 'Sum' | 'Failover'

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
  const [directTestInput, setDirectTestInput] = useState('35');
  const [showDirectAdvanced, setShowDirectAdvanced] = useState(false);

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
        const loadedNoOfTank = fuelCfg.noOfTank ?? cal.noOfTank ?? 1;
        const loadedNoOfSensor = fuelCfg.noOfSensor ?? cal.noOfSensor ?? 1;
        setNoOfTank(loadedNoOfTank);
        setNoOfSensor(loadedNoOfSensor);
        setSensorFormula(cal.sensorFormula || fuelCfg.sensorFormula || 'Average');
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
        setDirectOffset(cal.directOffset !== undefined ? String(cal.directOffset) : '0.0');

        // Initialize tanks and sensors state safely with 100% backward compatibility
        const rawTanks = cal.tanks ? { ...cal.tanks } : {};
        const tank1 = rawTanks[1] ? { ...rawTanks[1] } : {};
        const tank1Sensors = tank1.sensors ? { ...tank1.sensors } : (cal.sensors ? { ...cal.sensors } : {});

        if (!tank1Sensors[1]) {
          tank1Sensors[1] = {
            sensorType: fuelCfg.sensorType || cal.sensorType || meta.sensorType || '',
            fuelType: cal.fuelType || meta.fuelType || 'LLS Fuel 1(Serial)',
            calibrateType: cal.calibrateType || fuelCfg.calibrateType || 'Auto',
            minAdc: cal.minAdc !== undefined && cal.minAdc !== '' ? String(cal.minAdc) : (meta.fuelEmptyAdc !== undefined && meta.fuelEmptyAdc !== null ? String(meta.fuelEmptyAdc) : ''),
            maxAdc: cal.maxAdc !== undefined && cal.maxAdc !== '' ? String(cal.maxAdc) : (meta.fuelFullAdc !== undefined && meta.fuelFullAdc !== null ? String(meta.fuelFullAdc) : ''),
            calibrationPoints: Array.isArray(cal.calibrationPoints) ? cal.calibrationPoints : [],
            directSensorType: cal.directSensorType || cal.fuelType || 'BLE Fuel Level 1',
            directUnit: cal.directUnit || 'Litres',
            directMultiplier: cal.directMultiplier !== undefined ? String(cal.directMultiplier) : '1.0',
            directOffset: cal.directOffset !== undefined ? String(cal.directOffset) : '0.0'
          };
        }

        rawTanks[1] = {
          ...tank1,
          sensorFormula: cal.sensorFormula || fuelCfg.sensorFormula || 'Average',
          sensors: tank1Sensors
        };
        setTanksData(rawTanks);
        setActiveSensor(1);

        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load vehicle for calibration:', err);
        setError('Failed to load vehicle calibration details.');
        setLoading(false);
      });
  };

  const handleSwitchSensor = (newSensorNum) => {
    if (newSensorNum === activeSensor) return;

    // 1. Snapshot current active sensor
    const currentSensorSnapshot = {
      sensorType,
      fuelType: calibrateType === 'Direct' ? directSensorType : (fuelType || ''),
      calibrateType,
      minAdc,
      maxAdc,
      differenceOfLtrs,
      addCount,
      calibrationPoints,
      directSensorType,
      directUnit,
      directMultiplier,
      directOffset
    };

    // 2. Persist into tanksData for activeTank
    const currentTank = tanksData[activeTank] || {};
    const currentSensors = currentTank.sensors || {};
    const nextSensors = {
      ...currentSensors,
      [activeSensor]: currentSensorSnapshot
    };

    const nextTanks = {
      ...tanksData,
      [activeTank]: {
        ...currentTank,
        tankSize,
        modeOfVehicle,
        fuelTankShape,
        fuelTankPosition,
        calculate,
        tankLength: lengthMm,
        tankHeight: heightMm,
        tankWidth: widthMm,
        tankRadius: radiusMm,
        sensorFormula,
        sensors: nextSensors
      }
    };
    setTanksData(nextTanks);

    // 3. Load target sensor data
    const targetSensor = nextSensors[newSensorNum] ||
      vehicle?.metadata?.fuelCalibration?.tanks?.[activeTank]?.sensors?.[newSensorNum] ||
      vehicle?.metadata?.fuelCalibration?.sensors?.[newSensorNum];

    if (targetSensor) {
      setSensorType(targetSensor.sensorType || sensorType || '');
      setFuelType(targetSensor.fuelType || (newSensorNum === 2 ? 'LLS Fuel 2' : 'LLS Fuel 1(Serial)'));
      setCalibrateType(targetSensor.calibrateType || 'Auto');
      setMinAdc(targetSensor.minAdc !== undefined ? String(targetSensor.minAdc) : '');
      setMaxAdc(targetSensor.maxAdc !== undefined ? String(targetSensor.maxAdc) : '');
      setDifferenceOfLtrs(targetSensor.differenceOfLtrs || '');
      setAddCount(targetSensor.addCount || '');
      setCalibrationPoints(Array.isArray(targetSensor.calibrationPoints) ? targetSensor.calibrationPoints : []);
      setDirectSensorType(targetSensor.directSensorType || (newSensorNum === 2 ? 'BLE Fuel Level 2' : 'BLE Fuel Level 1'));
      setDirectUnit(targetSensor.directUnit || 'Litres');
      setDirectMultiplier(targetSensor.directMultiplier !== undefined ? String(targetSensor.directMultiplier) : '1.0');
      setDirectOffset(targetSensor.directOffset !== undefined ? String(targetSensor.directOffset) : '0.0');
    } else {
      // Smart default when opening Sensor 2 (or N) for the first time
      let suggestedFuelType = 'LLS Fuel 2';
      if (fuelType && fuelType.includes('BLE')) {
        suggestedFuelType = `BLE Fuel Level ${newSensorNum}`;
      } else if (fuelType && fuelType.includes('Analog')) {
        suggestedFuelType = `Analog ${newSensorNum}`;
      } else if (fuelType && fuelType.includes('LLS')) {
        suggestedFuelType = `LLS Fuel ${newSensorNum}`;
      }

      setFuelType(suggestedFuelType);
      setCalibrateType(calibrateType || 'Auto');
      setMinAdc(minAdc || '');
      setMaxAdc(maxAdc || '');
      setDifferenceOfLtrs('');
      setAddCount('');
      setCalibrationPoints([]);
      setDirectSensorType(`BLE Fuel Level ${newSensorNum}`);
      setDirectUnit(directUnit || 'Litres');
      setDirectMultiplier('1.0');
      setDirectOffset('0.0');
    }

    setActiveSensor(newSensorNum);
  };

  const handleSwitchTank = (newTankNum) => {
    if (newTankNum === activeTank) return;

    // Snapshot current active sensor
    const currentSensorSnapshot = {
      sensorType,
      fuelType: calibrateType === 'Direct' ? directSensorType : (fuelType || ''),
      calibrateType,
      minAdc,
      maxAdc,
      differenceOfLtrs,
      addCount,
      calibrationPoints,
      directSensorType,
      directUnit,
      directMultiplier,
      directOffset
    };

    const currentTank = tanksData[activeTank] || {};
    const currentSensors = currentTank.sensors || {};
    const updatedSensors = {
      ...currentSensors,
      [activeSensor]: currentSensorSnapshot
    };

    // Snapshot current active tank state
    const currentSnapshot = {
      ...currentTank,
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
      directOffset,
      sensorFormula,
      sensors: updatedSensors
    };

    const nextTanks = {
      ...tanksData,
      [activeTank]: currentSnapshot
    };
    setTanksData(nextTanks);

    // Target tank
    const target = nextTanks[newTankNum] || vehicle?.metadata?.fuelCalibration?.tanks?.[newTankNum];
    if (target) {
      setTankSize(target.tankSize !== undefined ? String(target.tankSize) : '');
      setModeOfVehicle(target.modeOfVehicle || '');
      setFuelTankShape(target.fuelTankShape || '');
      setFuelTankPosition(target.fuelTankPosition || '');
      setCalculate(target.calculate || '');
      setLengthMm(target.tankLength || '');
      setHeightMm(target.tankHeight || '');
      setWidthMm(target.tankWidth || '');
      setRadiusMm(target.tankRadius || '');
      setSensorFormula(target.sensorFormula || 'Average');

      // Load Sensor 1 of target tank
      const targetSensor1 = target.sensors?.[1] || target;
      setSensorType(targetSensor1.sensorType || sensorType || '');
      setFuelType(targetSensor1.fuelType || '');
      setMinAdc(targetSensor1.minAdc !== undefined ? String(targetSensor1.minAdc) : '');
      setMaxAdc(targetSensor1.maxAdc !== undefined ? String(targetSensor1.maxAdc) : '');
      setCalibrateType(targetSensor1.calibrateType || 'Auto');
      setCalibrationPoints(Array.isArray(targetSensor1.calibrationPoints) ? targetSensor1.calibrationPoints : []);
      setDirectSensorType(targetSensor1.directSensorType || 'BLE Fuel Level 1');
      setDirectUnit(targetSensor1.directUnit || 'Litres');
      setDirectMultiplier(targetSensor1.directMultiplier !== undefined ? String(targetSensor1.directMultiplier) : '1.0');
      setDirectOffset(targetSensor1.directOffset !== undefined ? String(targetSensor1.directOffset) : '0.0');
    } else {
      setTankSize('');
      setModeOfVehicle('');
      setFuelTankShape('');
      setFuelTankPosition('');
      setCalculate('');
      setLengthMm('');
      setHeightMm('');
      setWidthMm('');
      setRadiusMm('');
      setFuelType('');
      setMinAdc('');
      setMaxAdc('');
      setCalibrationPoints([]);
    }

    setActiveTank(newTankNum);
    setActiveSensor(1);
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

  // Dynamic calibration rows for "Show Frequency / Show Volt" dual-column modal
  const displayCalibrationRows = useMemo(() => {
    // 1. If manual points are available, format and use them
    if (Array.isArray(calibrationPoints) && calibrationPoints.length > 0) {
      return calibrationPoints.map((p, idx) => {
        const l = parseFloat(p.litres) || 0;
        let v = p.volt !== undefined && p.volt !== '' && p.volt !== null ? parseFloat(p.volt) : null;
        let f = p.frequency !== undefined && p.frequency !== '' && p.frequency !== null
          ? parseFloat(p.frequency)
          : (p.adcValue !== undefined && p.adcValue !== '' && p.adcValue !== null ? parseFloat(p.adcValue) : null);

        // Calculate missing values if one is supplied
        if (v === null && f !== null) {
          v = Math.round((f / 4095 * 5.0) * 100) / 100;
        }
        if (f === null && v !== null) {
          f = Math.round((v / 5.0 * 4095));
        }
        return {
          id: p.id || idx + 1,
          litres: l.toFixed(2),
          volt: v !== null ? v.toFixed(2) : '0.00',
          frequency: f !== null ? String(f) : '0'
        };
      });
    }

    // 2. If in Auto mode or no manual points, synthesize points from tank dimensions or volume
    const totalLitres = computedLitres > 0 ? computedLitres : (parseFloat(tankSize) || 50);
    const minVal = parseFloat(minAdc) || 0;
    const isAnalog = fuelType && fuelType.toLowerCase().includes('analog');
    const maxVal = parseFloat(maxAdc) || (isAnalog ? 5.0 : 4095);

    const steps = 10;
    const generated = [];
    for (let i = 0; i <= steps; i++) {
      const frac = i / steps;
      const l = Math.round(totalLitres * frac * 100) / 100;
      const raw = minVal + ((maxVal - minVal) * frac);
      let v, f;
      if (isAnalog) {
        v = raw.toFixed(2);
        f = Math.round(raw / 5.0 * 4095).toString();
      } else {
        f = Math.round(raw).toString();
        v = (raw / 4095 * 5.0).toFixed(2);
      }
      generated.push({
        id: i + 1,
        litres: l.toFixed(2),
        volt: v,
        frequency: f
      });
    }
    return generated;
  }, [calibrationPoints, computedLitres, tankSize, minAdc, maxAdc, fuelType]);

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
      return [
        ...prev,
        {
          id: Date.now(),
          litres: nextLitres,
          volt: '',
          frequency: ''
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
      const newRows = [];

      for (let i = 1; i <= count; i++) {
        const nextLitres = lastLitres + (i * diff);
        newRows.push({
          id: Date.now() + i,
          litres: nextLitres,
          volt: '',
          frequency: ''
        });
      }

      return [...prev, ...newRows];
    });
  };

  const handleGetVolt = (rowId) => {
    // Capture live voltage or frequency from active vehicle/device metadata based on sensor type
    const isAnalogMode = fuelType && fuelType.toLowerCase().includes('analog');
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
          volt: isAnalogMode ? liveVolt : (p.volt || '0.00'),
          frequency: !isAnalogMode ? liveFreq : (p.frequency || '0.00')
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
      const isAnalogMode = fuelType && fuelType.toLowerCase().includes('analog');
      const sheetData = calibrationPoints.map((p, idx) => {
        if (isAnalogMode) {
          return {
            'Step #': idx + 1,
            'Litre': parseFloat(p.litres) || 0,
            'Volt': parseFloat(p.volt) || 0
          };
        } else {
          return {
            'Step #': idx + 1,
            'Litre': parseFloat(p.litres) || 0,
            'Frequency': parseFloat(p.frequency !== undefined ? p.frequency : (p.adcValue !== undefined ? p.adcValue : 0)) || 0
          };
        }
      });

      const dataToExport = sheetData.length > 0 ? sheetData : (
        isAnalogMode ? [
          { 'Step #': 1, 'Litre': 10, 'Volt': 0.45 },
          { 'Step #': 2, 'Litre': 20, 'Volt': 0.90 },
          { 'Step #': 3, 'Litre': 30, 'Volt': 1.35 }
        ] : [
          { 'Step #': 1, 'Litre': 10, 'Frequency': 155 },
          { 'Step #': 2, 'Litre': 20, 'Frequency': 210 },
          { 'Step #': 3, 'Litre': 30, 'Frequency': 265 }
        ]
      );

      const ws = XLSX.utils.json_to_sheet(dataToExport);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, `Tank ${activeTank}`);
      XLSX.writeFile(wb, `Calibration_${isAnalogMode ? 'Analog_Volt' : 'Serial_Frequency'}_Tank_${activeTank}_${vehicle?.plate || displayVehicleId}.xlsx`);
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
    const cap = computedLitres > 0 ? computedLitres : (parseFloat(tankSize) || 0);
    if (directUnit === 'Percentage') {
      return cap > 0 ? Math.round(((scaled / 100) * cap) * 100) / 100 : Math.round(scaled * 100) / 100;
    }
    return Math.round(scaled * 100) / 100;
  }, [directTestInput, directMultiplier, directOffset, directUnit, tankSize, computedLitres]);

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
      const isAnalog = fuelType && fuelType.toLowerCase().includes('analog');
      const hasEmptyValues = calibrationPoints.some(p => {
        if (isAnalog) {
          return p.volt === undefined || p.volt === null || String(p.volt).trim() === '';
        } else {
          const freqVal = p.frequency !== undefined ? p.frequency : p.adcValue;
          return freqVal === undefined || freqVal === null || String(freqVal).trim() === '';
        }
      });
      if (hasEmptyValues) {
        setError(`Please enter ${isAnalog ? 'voltage' : 'frequency'} values for all calibration rows (or click "Get ${isAnalog ? 'Volt' : 'Frequency'}").`);
        return;
      }

      // Check strictly ascending order of litres and sensor values to prevent typos (e.g. entering 1090 after 3931)
      for (let i = 0; i < calibrationPoints.length - 1; i++) {
        const currLitres = parseFloat(calibrationPoints[i].litres) || 0;
        const nextLitres = parseFloat(calibrationPoints[i + 1].litres) || 0;
        if (nextLitres <= currLitres) {
          setError(`Step ${i + 2} Litres (${nextLitres} L) must be greater than Step ${i + 1} Litres (${currLitres} L).`);
          return;
        }

        const currVal = parseFloat(isAnalog ? calibrationPoints[i].volt : (calibrationPoints[i].frequency ?? calibrationPoints[i].adcValue)) || 0;
        const nextVal = parseFloat(isAnalog ? calibrationPoints[i + 1].volt : (calibrationPoints[i + 1].frequency ?? calibrationPoints[i + 1].adcValue)) || 0;
        if (nextVal <= currVal) {
          setError(`Step ${i + 2} sensor value (${nextVal}) cannot be less than or equal to Step ${i + 1} (${currVal}). Please verify your calibration steps.`);
          return;
        }
      }
    }

    setSaving(true);

    try {
      // 1. Snapshot current active sensor into updatedSensors
      const currentSensorSnapshot = {
        sensorType,
        fuelType: calibrateType === 'Direct' ? directSensorType : (fuelType || 'Analog'),
        calibrateType,
        minAdc: minAdc !== '' ? parseFloat(minAdc) : '',
        maxAdc: maxAdc !== '' ? parseFloat(maxAdc) : '',
        differenceOfLtrs,
        addCount,
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
        directOffset: parseFloat(directOffset) || 0.0
      };

      const currentTank = tanksData[activeTank] || {};
      const currentSensors = currentTank.sensors || {};
      const updatedSensors = {
        ...currentSensors,
        [activeSensor]: currentSensorSnapshot
      };

      if (!updatedSensors[1]) {
        updatedSensors[1] = currentSensorSnapshot;
      }

      // 2. Build full active tank snapshot
      const activeTankSnapshot = {
        tankNo: activeTank,
        tankSize: parsedTankSize,
        modeOfVehicle,
        fuelType: updatedSensors[1]?.fuelType || (fuelType || 'Analog'),
        minAdc: updatedSensors[1]?.minAdc !== undefined ? updatedSensors[1].minAdc : (minAdc !== '' ? parseFloat(minAdc) : ''),
        maxAdc: updatedSensors[1]?.maxAdc !== undefined ? updatedSensors[1].maxAdc : (maxAdc !== '' ? parseFloat(maxAdc) : ''),
        fuelTankShape,
        fuelTankPosition,
        calculate,
        tankLength: lengthMm,
        tankHeight: heightMm,
        tankWidth: widthMm,
        tankRadius: radiusMm,
        calibrateType: updatedSensors[1]?.calibrateType || calibrateType,
        calibrationPoints: updatedSensors[1]?.calibrationPoints || [],
        directSensorType: updatedSensors[1]?.directSensorType || directSensorType,
        directUnit: updatedSensors[1]?.directUnit || directUnit,
        directMultiplier: updatedSensors[1]?.directMultiplier !== undefined ? updatedSensors[1].directMultiplier : 1.0,
        directOffset: updatedSensors[1]?.directOffset !== undefined ? updatedSensors[1].directOffset : 0.0,
        noOfSensor: parseInt(noOfSensor) || 1,
        sensorFormula,
        sensors: updatedSensors
      };

      const finalTanks = {
        ...tanksData,
        [activeTank]: activeTankSnapshot
      };

      const payload = {
        name: vehicleName,
        tankNo: activeTank,
        noOfTank: parseInt(noOfTank) || 1,
        noOfSensor: parseInt(noOfSensor) || 1,
        sensorType: sensorType || '',
        sensorFormula,
        sensors: updatedSensors,
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
        calibrationPoints: currentSensorSnapshot.calibrationPoints,
        directSensorType,
        directUnit,
        directMultiplier: parseFloat(directMultiplier) || 1.0,
        directOffset: parseFloat(directOffset) || 0.0,
        tanks: finalTanks
      };

      const res = await vehicleApi.calibrateVehicle(id, payload);
      if (res && res.data) {
        setVehicle(res.data);
      }
      setSuccess('Vehicle fuel configuration and calibration saved successfully.');
      // Immediately open the Live Fuel Monitor so technician sees real-time fuel packets
      setShowLiveFuelModal(true);
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
      `Sensor: ${activeSensor} of ${sensorCount}`,
      `Multi-Sensor Formula: ${sensorFormula}`,
      `Mode: ${modeOfVehicle}`,
      `Tank Size (L): ${tankSize}`,
      modeDetails,
      `Exported At: ${new Date().toLocaleString()}`
    ].join('\n');

    const blob = new Blob([data], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Calibration_${vehicle?.plate || displayVehicleId}_Tank${activeTank}_Sensor${activeSensor}_${calibrateType}.txt`;
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
  const sensorCount = Math.max(1, parseInt(noOfSensor) || 1);
  const isAnalogMode = fuelType && fuelType.toLowerCase().includes('analog');

  return (
    <div className="pastel-page-bg calib-page-container" style={{ minHeight: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
      <div style={{ width: '100%' }}>

        {/* Top Header & Breadcrumb Bar */}
        <div className="calib-header-wrap" style={{
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          marginBottom: '10px',
          flexWrap: 'wrap'
        }}>
          <h1 className="calib-header-title" style={{
            fontSize: '24px',
            fontWeight: 800,
            color: '#0f172a',
            letterSpacing: '-0.02em',
            margin: 0
          }}>
            Fuel Calibration
          </h1>

          <div className="calib-header-sep" style={{ width: '1px', height: '20px', background: '#cbd5e1' }} />

          {/* Breadcrumb line */}
          <div className="calib-breadcrumb" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#64748b', flexWrap: 'wrap' }}>
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
              onMouseEnter={e => e.currentTarget.style.color = '#ea580c'}
              onMouseLeave={e => e.currentTarget.style.color = '#64748b'}
            >
              Vehicle list
            </button>
            <ChevronRight size={13} color="#94a3b8" />
            <button
              type="button"
              onClick={() => id && navigate(`/admin/vehicles/edit/${id}`)}
              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#64748b', fontWeight: 600 }}
              onMouseEnter={e => e.currentTarget.style.color = '#ea580c'}
              onMouseLeave={e => e.currentTarget.style.color = '#64748b'}
            >
              {displayVehicleId}
            </button>
            <ChevronRight size={13} color="#94a3b8" />
            <span style={{ color: '#ea580c', fontWeight: 700 }}>Fuel Calibration</span>
          </div>

          {/* Top Right Action Buttons */}
          <div className="calib-header-actions" style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              onClick={() => id ? navigate(`/admin/vehicles/edit/${id}`) : navigate('/admin/vehicles')}
              style={{
                background: '#ffffff',
                color: '#334155',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                padding: '7px 14px',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = '#f1f5f9';
                e.currentTarget.style.color = '#0f172a';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = '#ffffff';
                e.currentTarget.style.color = '#334155';
              }}
            >
              <ArrowLeft size={14} />
              <span>Back to Vehicle</span>
            </button>
            <button
              type="button"
              onClick={() => setShowLiveFuelModal(true)}
              style={{
                background: '#ecfdf5',
                color: '#059669',
                border: '1px solid #a7f3d0',
                borderRadius: '8px',
                padding: '7px 16px',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 1px 2px rgba(5, 150, 105, 0.08)',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = '#d1fae5';
                e.currentTarget.style.borderColor = '#6ee7b7';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = '#ecfdf5';
                e.currentTarget.style.borderColor = '#a7f3d0';
              }}
            >
              <span style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: '#10b981',
                boxShadow: '0 0 6px rgba(16, 185, 129, 0.8)'
              }} />
              Live Fuel
            </button>
          </div>
        </div>

        {/* Status Alerts */}
        {error && (
          <div style={{
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '8px',
            padding: '8px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            color: '#dc2626',
            fontSize: '13px',
            fontWeight: 600,
            marginBottom: '10px',
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
            borderRadius: '8px',
            padding: '8px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            color: '#16a34a',
            fontSize: '13px',
            fontWeight: 600,
            marginBottom: '10px',
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
          {/* Form Body */}
          <form onSubmit={handleSave} className="calib-card-body">

            {/* SECTION 1: General Configuration */}
            <div className="calib-section-box" style={{
              marginBottom: '10px',
              background: '#f8fafc',
              border: '1px solid #f1f5f9',
              borderRadius: '8px',
              padding: '10px 12px'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '8px',
                paddingBottom: '6px',
                borderBottom: '1px solid #e2e8f0'
              }}>
                <Settings2 size={16} color="#ea580c" />
                <h3 style={{ fontSize: '14.5px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                  General Configuration
                </h3>
              </div>

              <style>{`
                .calib-page-container {
                  padding: 8px 12px;
                }
                .calib-card-body {
                  padding: 10px 12px 14px 12px;
                }
                .calib-grid-3 {
                  display: grid;
                  grid-template-columns: repeat(3, minmax(0, 1fr));
                  gap: 8px 10px;
                  margin-bottom: 8px;
                }
                .calib-grid-2 {
                  display: grid;
                  grid-template-columns: repeat(2, minmax(0, 1fr));
                  gap: 8px 10px;
                  margin-bottom: 8px;
                }
                .calib-footer-actions {
                  display: flex;
                  justify-content: center;
                  align-items: center;
                  gap: 14px;
                  margin-top: 20px;
                  padding-top: 16px;
                  border-top: 1px solid #f1f5f9;
                }
                .calib-tools-bar {
                  display: flex;
                  align-items: center;
                  gap: 8px;
                  height: 38px;
                }
                .calib-tank-preview-card {
                  margin-top: 12px;
                  margin-bottom: 16px;
                  background: #fafbfc;
                  border: 1px solid #e2e8f0;
                  border-radius: 10px;
                  padding: 16px 20px;
                  display: flex;
                  flex-direction: column;
                  align-items: center;
                  justify-content: center;
                  gap: 12px;
                  position: relative;
                  max-width: 100%;
                  box-sizing: border-box;
                }
                @media (max-width: 900px) {
                  .calib-grid-3 {
                    grid-template-columns: repeat(2, minmax(0, 1fr));
                  }
                }
                @media (max-width: 768px) {
                  .calib-page-container {
                    padding: 10px 8px !important;
                  }
                  .calib-card-body {
                    padding: 12px 10px 18px 10px !important;
                  }
                  .calib-grid-3, .calib-grid-2 {
                    grid-template-columns: 1fr !important;
                    gap: 10px 0 !important;
                    margin-bottom: 10px !important;
                  }
                  .calib-header-wrap {
                    flex-direction: column !important;
                    align-items: flex-start !important;
                    gap: 8px !important;
                    margin-bottom: 14px !important;
                  }
                  .calib-header-title {
                    font-size: 20px !important;
                  }
                  .calib-header-sep {
                    display: none !important;
                  }
                  .calib-breadcrumb {
                    font-size: 12px !important;
                    gap: 6px !important;
                  }
                  .calib-header-actions {
                    margin-left: 0 !important;
                    width: 100% !important;
                    justify-content: flex-start !important;
                    display: flex !important;
                    flex-wrap: wrap !important;
                    gap: 8px !important;
                  }
                  .calib-header-actions button {
                    flex: 1 1 calc(50% - 6px) !important;
                    justify-content: center !important;
                    min-width: 135px !important;
                    padding: 8px 10px !important;
                    font-size: 12.5px !important;
                  }
                  .calib-tabs-bar {
                    padding: 10px 12px !important;
                    gap: 8px !important;
                  }
                  .calib-sensor-switcher {
                    margin-left: 0 !important;
                    padding-left: 0 !important;
                    border-left: none !important;
                    width: 100% !important;
                    margin-top: 4px !important;
                  }
                  .calib-section-box {
                    padding: 12px 10px !important;
                  }
                  .calib-tools-bar {
                    height: auto !important;
                    flex-wrap: wrap !important;
                    gap: 6px !important;
                  }
                  .calib-tools-bar button {
                    height: 36px !important;
                  }
                  .calib-tank-preview-card {
                    padding: 12px 10px !important;
                  }
                  .calib-tank-preview-row {
                    flex-direction: column !important;
                    align-items: center !important;
                    gap: 8px !important;
                  }
                  .calib-tank-rect-box {
                    max-width: 100% !important;
                  }
                  .calib-cylinder-svg {
                    max-width: 100% !important;
                    height: auto !important;
                  }
                  .calib-manual-submode-bar {
                    flex-direction: column !important;
                    align-items: stretch !important;
                    gap: 10px !important;
                  }
                  .calib-manual-radios {
                    gap: 16px !important;
                  }
                  .calib-manual-inputs {
                    justify-content: space-between !important;
                    width: 100% !important;
                  }
                  .calib-table th, .calib-table td {
                    padding: 8px 8px !important;
                    font-size: 12px !important;
                  }
                  .calib-footer-actions {
                    flex-direction: column-reverse !important;
                    width: 100% !important;
                    gap: 10px !important;
                    margin-top: 14px !important;
                    padding-top: 14px !important;
                  }
                  .calib-footer-actions button {
                    width: 100% !important;
                    justify-content: center !important;
                    padding: 11px !important;
                  }
                  .calib-modal-overlay {
                    padding: 10px !important;
                  }
                  .calib-modal-box {
                    width: 100% !important;
                    max-width: 100% !important;
                    padding: 16px 14px !important;
                    border-radius: 10px !important;
                  }
                  .calib-modal-freq-table th, .calib-modal-freq-table td {
                    padding: 6px 4px !important;
                    font-size: 11px !important;
                  }
                }
                @media (max-width: 480px) {
                  .calib-header-title {
                    font-size: 18px !important;
                  }
                  .calib-header-actions button {
                    flex: 1 1 100% !important;
                    width: 100% !important;
                  }
                  .calib-tools-bar button {
                    flex: 1 1 45% !important;
                  }
                  .calib-manual-inputs {
                    flex-direction: column !important;
                    align-items: stretch !important;
                    gap: 8px !important;
                  }
                  .calib-manual-inputs > div {
                    justify-content: space-between !important;
                    width: 100% !important;
                  }
                  .calib-manual-inputs input {
                    width: 110px !important;
                  }
                  .calib-manual-inputs button {
                    width: 100% !important;
                    justify-content: center !important;
                  }
                }
              `}</style>

              {/* ROW 1: Vehicle Identity Information (Read-Only) */}
              <div className="calib-grid-3">
                {/* Vehicle ID (Read-only) */}
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                    Vehicle ID
                  </label>
                  <input
                    type="text"
                    readOnly
                    disabled
                    value={displayVehicleId}
                    style={{
                      width: '100%',
                      height: '38px',
                      padding: '0 12px',
                      borderRadius: '6px',
                      border: '1px solid #e2e8f0',
                      background: '#f1f5f9',
                      fontSize: '13px',
                      fontWeight: 600,
                      color: '#475569',
                      outline: 'none',
                      boxSizing: 'border-box',
                      cursor: 'not-allowed'
                    }}
                  />
                </div>

                {/* Vehicle Name (Read-only) */}
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                    Vehicle Name
                  </label>
                  <input
                    type="text"
                    readOnly
                    disabled
                    value={vehicleName || vehicle?.name || ''}
                    style={{
                      width: '100%',
                      height: '38px',
                      padding: '0 12px',
                      borderRadius: '6px',
                      border: '1px solid #e2e8f0',
                      background: '#f1f5f9',
                      fontSize: '13px',
                      fontWeight: 600,
                      color: '#475569',
                      outline: 'none',
                      boxSizing: 'border-box',
                      cursor: 'not-allowed'
                    }}
                  />
                </div>

                {/* Device Id / IMEI No (Read-only) */}
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                    Device Id / IMEI No
                  </label>
                  <input
                    type="text"
                    readOnly
                    disabled
                    value={vehicle?.imei || ''}
                    style={{
                      width: '100%',
                      height: '38px',
                      padding: '0 12px',
                      borderRadius: '6px',
                      border: '1px solid #e2e8f0',
                      background: '#f1f5f9',
                      fontSize: '13px',
                      fontWeight: 600,
                      color: '#475569',
                      outline: 'none',
                      boxSizing: 'border-box',
                      cursor: 'not-allowed'
                    }}
                  />
                </div>
              </div>

              {/* Subtle separation between Vehicle Identity & Calibration Hardware */}
              <div style={{ height: '1px', background: '#e2e8f0', margin: '4px 0 14px 0' }} />

              {/* ROW 2: Hardware Configuration & Calibration Mode (Editable) */}
              <div className="calib-grid-3">
                {/* No. of Tank */}
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
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
                      height: '38px',
                      padding: '0 12px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      background: '#ffffff',
                      fontSize: '13px',
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
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                    No.of Sensor <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={noOfSensor}
                    onChange={e => {
                      const val = e.target.value;
                      setNoOfSensor(val);
                      const parsed = Math.max(1, parseInt(val) || 1);
                      if (activeSensor > parsed) {
                        setActiveSensor(1);
                      }
                    }}
                    style={{
                      width: '100%',
                      height: '38px',
                      padding: '0 12px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      background: '#ffffff',
                      fontSize: '13px',
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
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                    Sensor Details
                  </label>
                  <input
                    type="text"
                    value={sensorDetails}
                    onChange={e => setSensorDetails(e.target.value)}
                    placeholder="Specifications, notes..."
                    style={{
                      width: '100%',
                      height: '38px',
                      padding: '0 12px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      background: '#ffffff',
                      fontSize: '13px',
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

              {/* ROW 3: Detection Thresholds (Theft & Filling) */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px 10px' }}>
                {/* Minimum Theft */}
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                    Minimum Theft <span style={{ fontSize: '11px', color: '#64748b' }}>(In litres)</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={minTheft}
                    onWheel={e => e.target.blur()}
                    onChange={e => {
                      const val = e.target.value;
                      if (val === '' || parseFloat(val) >= 0) setMinTheft(val);
                    }}
                    style={{
                      width: '100%',
                      height: '38px',
                      padding: '0 12px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      background: '#ffffff',
                      fontSize: '13px',
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
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                    Minimum Filling <span style={{ fontSize: '11px', color: '#64748b' }}>(In litres)</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={minFilling}
                    onWheel={e => e.target.blur()}
                    onChange={e => {
                      const val = e.target.value;
                      if (val === '' || parseFloat(val) >= 0) setMinFilling(val);
                    }}
                    style={{
                      width: '100%',
                      height: '38px',
                      padding: '0 12px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      background: '#ffffff',
                      fontSize: '13px',
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
            </div>

            {/* BAR: Tanks, Calibration Type & Sensor Number (After General Configuration) */}
            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '10px 14px',
              marginBottom: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px'
            }}>
              {/* 1. Tank Switcher */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#334155', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Fuel size={14} color="#ea580c" />
                  Tank:
                </span>
                <div style={{ display: 'inline-flex', gap: '6px' }}>
                  {Array.from({ length: tankCount }, (_, i) => i + 1).map(tankNum => {
                    const isSelected = activeTank === tankNum;
                    return (
                      <button
                        key={tankNum}
                        type="button"
                        onClick={() => handleSwitchTank(tankNum)}
                        style={{
                          background: isSelected ? '#f97316' : '#ffffff',
                          color: isSelected ? '#ffffff' : '#475569',
                          border: isSelected ? '1px solid #ea580c' : '1px solid #cbd5e1',
                          borderRadius: '6px',
                          padding: '6px 16px',
                          fontSize: '12.5px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          boxShadow: isSelected ? '0 2px 6px rgba(249, 115, 22, 0.28)' : 'none',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        <Fuel size={13} />
                        <span>{`Tank ${tankNum}`}</span>
                      </button>
                    );
                  })}
                  {tankCount === 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        setNoOfTank('2');
                        handleSwitchTank(2);
                      }}
                      title="Add Tank 2"
                      style={{
                        background: '#ffffff',
                        color: '#ea580c',
                        border: '1px dashed #cbd5e1',
                        borderRadius: '6px',
                        padding: '6px 12px',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <Plus size={12} />
                      <span>Add Tank 2</span>
                    </button>
                  )}
                </div>
              </div>

              {/* 2. Calibration Type */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#334155' }}>
                  Calibration Type:
                </span>
                <div style={{ display: 'inline-flex', background: '#ffffff', padding: '3px', borderRadius: '7px', gap: '4px', border: '1px solid #cbd5e1' }}>
                  {['Auto', 'Manual', 'Direct'].map(type => {
                    const isSelected = calibrateType === type;
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setCalibrateType(type)}
                        style={{
                          height: '30px',
                          padding: '0 14px',
                          borderRadius: '5px',
                          fontSize: '12px',
                          fontWeight: 700,
                          border: 'none',
                          background: isSelected ? '#f97316' : 'transparent',
                          color: isSelected ? '#ffffff' : '#475569',
                          cursor: 'pointer',
                          boxShadow: isSelected ? '0 2px 4px rgba(249, 115, 22, 0.25)' : 'none',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        {type}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 3. Sensor Number Switcher */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#334155', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Cpu size={14} color="#ea580c" />
                  Sensor Number:
                </span>
                <div style={{ display: 'inline-flex', background: '#ffffff', padding: '3px', borderRadius: '7px', gap: '4px', border: '1px solid #cbd5e1', alignItems: 'center' }}>
                  {Array.from({ length: sensorCount }, (_, i) => i + 1).map(sensorNum => {
                    const isSelected = activeSensor === sensorNum;
                    return (
                      <button
                        key={sensorNum}
                        type="button"
                        onClick={() => handleSwitchSensor(sensorNum)}
                        style={{
                          background: isSelected ? '#f97316' : 'transparent',
                          color: isSelected ? '#ffffff' : '#64748b',
                          border: 'none',
                          borderRadius: '5px',
                          padding: '5px 12px',
                          fontSize: '12px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          boxShadow: isSelected ? '0 2px 4px rgba(249, 115, 22, 0.25)' : 'none',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <Cpu size={12} />
                        <span>{`Sensor ${sensorNum}`}</span>
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => {
                      const nextSensor = sensorCount + 1;
                      setNoOfSensor(String(nextSensor));
                      handleSwitchSensor(nextSensor);
                    }}
                    title="Add another sensor to this tank"
                    style={{
                      background: 'transparent',
                      color: '#ea580c',
                      border: '1px dashed #cbd5e1',
                      borderRadius: '5px',
                      padding: '4px 8px',
                      fontSize: '11px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '3px'
                    }}
                  >
                    <Plus size={12} />
                    <span>Add Sensor</span>
                  </button>
                </div>
              </div>
            </div>

            {/* SECTION 2: Tank Parameters Form matching Screenshot */}
            <div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '10px',
                marginBottom: '8px',
                paddingBottom: '6px',
                borderBottom: '1px solid #e2e8f0'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <SlidersHorizontal size={16} color="#ea580c" />
                  <h3 style={{ fontSize: '14.5px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                    {`Tank ${activeTank}${sensorCount > 1 ? ` — Sensor ${activeSensor}` : ''} Calibration Details`}
                  </h3>
                </div>

                
              </div>

              {/* Row 1: Mode of Vehicle, Fuel Type, Tank Size */}
              <div className="calib-grid-3">
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                    Mode of Vehicle
                  </label>
                  <FuelTracksSelect
                    height="38px"
                    value={modeOfVehicle}
                    onChange={setModeOfVehicle}
                    options={modeOptions}
                    placeholder="-- Select --"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                    {sensorCount > 1 ? `Fuel Type / Channel (Sensor ${activeSensor})` : 'Fuel Type'}
                  </label>
                  <FuelTracksSelect
                    height="38px"
                    value={fuelType}
                    onChange={handleFuelTypeChange}
                    options={fuelTypeOptions}
                    placeholder="-- Select --"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                    Tank Size <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 400 }}>(In Litres)</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={tankSize}
                    onWheel={e => e.target.blur()}
                    onChange={e => {
                      const val = e.target.value;
                      if (val === '' || parseFloat(val) >= 0) setTankSize(val);
                    }}
                    placeholder="e.g. 500"
                    style={{
                      width: '100%',
                      height: '38px',
                      padding: '0 12px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      background: '#ffffff',
                      fontSize: '13px',
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
                  <div className="calib-grid-3">
                    <div>
                      <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                        Fuel Tank Shape
                      </label>
                      <FuelTracksSelect
                        height="38px"
                        value={fuelTankShape}
                        onChange={setFuelTankShape}
                        options={tankShapeOptions}
                        placeholder="-- SELECT --"
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                        Fuel Tank Position
                      </label>
                      <FuelTracksSelect
                        height="38px"
                        value={fuelTankPosition}
                        onChange={setFuelTankPosition}
                        options={tankPositionOptions}
                        placeholder="-- SELECT --"
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                        Calculate
                      </label>
                      <FuelTracksSelect
                        height="38px"
                        value={calculate}
                        onChange={val => {
                          setCalculate(val);
                          if (val === 'Yes' && !fuelTankShape) {
                            setFuelTankShape('Rectangle');
                          }
                        }}
                        options={calculateOptions}
                        placeholder="-- SELECT --"
                      />
                    </div>
                  </div>

                  {/* Row 3: Minimum & Maximum Calibration Sensor Value + Live Diagnostics Buttons */}
                  <div className="calib-grid-3">
                    <div>
                      <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
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
                          height: '38px',
                          padding: '0 12px',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1',
                          background: '#ffffff',
                          fontSize: '13px',
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
                      <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
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
                          height: '38px',
                          padding: '0 12px',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1',
                          background: '#ffffff',
                          fontSize: '13px',
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

                    {/* Diagnostics & Live Telemetry Tools */}
                    <div>
                      <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                        Live Diagnostics & Tools
                      </label>
                      <div className="calib-tools-bar" style={{ display: 'flex', alignItems: 'center', gap: '8px', height: '38px' }}>
                        <button
                          type="button"
                          onClick={() => {
                            if (fuelType && fuelType.toLowerCase().includes('analog')) {
                              setFreqModalViewMode('volt');
                            } else {
                              setFreqModalViewMode('frequency');
                            }
                            setShowFrequencyModal(true);
                          }}
                          style={{
                            background: '#fff7ed',
                            color: '#ea580c',
                            border: '1px solid #fed7aa',
                            borderRadius: '6px',
                            padding: '0 12px',
                            height: '38px',
                            fontSize: '12px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                            boxShadow: '0 1px 2px rgba(234, 88, 12, 0.08)',
                            transition: 'all 0.15s ease'
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
                          onClick={() => setShowLiveFuelModal(true)}
                          style={{
                            background: '#ecfdf5',
                            color: '#059669',
                            border: '1px solid #a7f3d0',
                            borderRadius: '6px',
                            padding: '0 12px',
                            height: '38px',
                            fontSize: '12px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            whiteSpace: 'nowrap',
                            boxShadow: '0 1px 2px rgba(5, 150, 105, 0.08)',
                            transition: 'all 0.15s ease'
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.background = '#d1fae5';
                            e.currentTarget.style.borderColor = '#6ee7b7';
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.background = '#ecfdf5';
                            e.currentTarget.style.borderColor = '#a7f3d0';
                          }}
                        >
                          <span style={{
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            background: '#10b981',
                            boxShadow: '0 0 6px rgba(16, 185, 129, 0.8)'
                          }} />
                          Live Fuel
                        </button>

                        <button
                          type="button"
                          onClick={loadVehicleData}
                          title="Reload Calibration Data"
                          style={{
                            background: '#f1f5f9',
                            color: '#475569',
                            border: '1px solid #cbd5e1',
                            width: '38px',
                            height: '38px',
                            borderRadius: '6px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            flexShrink: 0,
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
                          <RotateCw size={14} />
                        </button>

                        <button
                          type="button"
                          onClick={handleExportCalibration}
                          title="Export Calibration Settings"
                          style={{
                            background: '#f0fdf4',
                            color: '#16a34a',
                            border: '1px solid #bbf7d0',
                            width: '38px',
                            height: '38px',
                            borderRadius: '6px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            flexShrink: 0,
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
                          <Download size={14} />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Dynamic Dimension Inputs for Cylinder */}
                  {fuelTankShape === 'Cylinder' && (
                    <div className="calib-grid-2">
                      <div>
                        <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
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
                            height: '38px',
                            padding: '0 12px',
                            borderRadius: '6px',
                            border: '1px solid #cbd5e1',
                            background: '#ffffff',
                            fontSize: '13px',
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
                        <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
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
                            height: '38px',
                            padding: '0 12px',
                            borderRadius: '6px',
                            border: '1px solid #cbd5e1',
                            background: '#ffffff',
                            fontSize: '13px',
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
                    <div className="calib-grid-3">
                      <div>
                        <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
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
                            height: '38px',
                            padding: '0 12px',
                            borderRadius: '6px',
                            border: '1px solid #cbd5e1',
                            background: '#ffffff',
                            fontSize: '13px',
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
                        <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
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
                            height: '38px',
                            padding: '0 12px',
                            borderRadius: '6px',
                            border: '1px solid #cbd5e1',
                            background: '#ffffff',
                            fontSize: '13px',
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
                        <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
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
                            height: '38px',
                            padding: '0 12px',
                            borderRadius: '6px',
                            border: '1px solid #cbd5e1',
                            background: '#ffffff',
                            fontSize: '13px',
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
                    <div className="calib-tank-preview-card" style={{
                      marginTop: '12px',
                      marginBottom: '16px',
                      background: '#fafbfc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '10px',
                      padding: '16px 20px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '12px',
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
                        paddingBottom: '8px'
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
                          <div className="calib-tank-preview-row" style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
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
                              <div className="calib-tank-rect-box" style={{
                                width: `${visualTankDimensions.widthPx}px`,
                                height: `${visualTankDimensions.heightPx}px`,
                                maxWidth: '100%',
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
                                <div className="calib-tank-preview-row" style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                                  {/* Standing Vertical Cylinder in Theme Orange */}
                                  <svg className="calib-cylinder-svg" width="200" height="240" viewBox="0 0 200 240" style={{ maxWidth: '100%', height: 'auto', overflow: 'visible' }}>
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
                                <div className="calib-tank-preview-row" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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
                                  <svg className="calib-cylinder-svg" width="260" height="150" viewBox="0 0 260 150" style={{ maxWidth: '100%', height: 'auto', overflow: 'visible' }}>
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
                <div style={{ marginTop: '12px' }}>
                  {/* Sub-mode Selection Bar: Upload Calibration vs Calibration Details */}
                  <div className="calib-manual-submode-bar" style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '12px',
                    padding: '10px 14px',
                    background: '#fafbfc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    marginBottom: '14px'
                  }}>
                    {/* Radio Buttons for Sub-mode */}
                    <div className="calib-manual-radios" style={{ display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
                      <label style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        cursor: 'pointer',
                        fontSize: '13px',
                        fontWeight: 700,
                        color: manualSubMode === 'details' ? '#0f172a' : '#64748b'
                      }}>
                        <input
                          type="radio"
                          name="manualSubMode"
                          checked={manualSubMode === 'details'}
                          onChange={() => setManualSubMode('details')}
                          style={{ accentColor: '#f97316', width: '16px', height: '16px', cursor: 'pointer' }}
                        />
                        <span>Calibration Details</span>
                      </label>

                      <label style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        cursor: 'pointer',
                        fontSize: '13px',
                        fontWeight: 700,
                        color: manualSubMode === 'upload' ? '#0f172a' : '#64748b'
                      }}>
                        <input
                          type="radio"
                          name="manualSubMode"
                          checked={manualSubMode === 'upload'}
                          onChange={() => setManualSubMode('upload')}
                          style={{ accentColor: '#f97316', width: '16px', height: '16px', cursor: 'pointer' }}
                        />
                        <span>Upload Calibration</span>
                      </label>
                    </div>

                    {/* Difference of Ltrs & Add Count controls (Shown when in Calibration Details) */}
                    {manualSubMode === 'details' && (
                      <div className="calib-manual-inputs" style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#334155' }}>
                            Difference of Ltrs
                          </span>
                          <input
                            type="number"
                            min="0.1"
                            step="any"
                            value={differenceOfLtrs}
                            onWheel={e => e.target.blur()}
                            onChange={e => setDifferenceOfLtrs(e.target.value)}
                            placeholder="1"
                            style={{
                              width: '75px',
                              height: '34px',
                              padding: '0 8px',
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

                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#334155' }}>
                            Add Count
                          </span>
                          <input
                            type="number"
                            min="1"
                            value={addCount}
                            onWheel={e => e.target.blur()}
                            onChange={e => setAddCount(e.target.value)}
                            placeholder="Count"
                            style={{
                              width: '80px',
                              height: '34px',
                              padding: '0 8px',
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
                            height: '34px',
                            padding: '0 14px',
                            borderRadius: '6px',
                            background: '#f97316',
                            color: '#ffffff',
                            border: 'none',
                            fontSize: '12.5px',
                            fontWeight: 800,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
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
                      <div className="calib-table-scroll" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                        <table className="calib-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                          <thead>
                            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 700 }}>
                              <th style={{ padding: '12px 18px', width: '42%' }}>Litre</th>
                              {isAnalogMode ? (
                                <th style={{ padding: '12px 18px', width: '42%' }}>Volt</th>
                              ) : (
                                <th style={{ padding: '12px 18px', width: '42%' }}>Frequency</th>
                              )}
                              <th style={{ padding: '12px 18px', width: '16%', textAlign: 'center' }}>Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {calibrationPoints.length === 0 ? (
                              <tr>
                                <td colSpan={3} style={{ padding: '48px 18px', textAlign: 'center', background: '#ffffff' }}>
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
                                    min="0"
                                    step="any"
                                    value={point.litres}
                                    onWheel={e => e.target.blur()}
                                    onChange={e => handleUpdatePoint(point.id, 'litres', e.target.value)}
                                    placeholder="0"
                                    style={{
                                      width: '100%',
                                      maxWidth: '280px',
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

                                {/* Volt (ONLY for Analog) */}
                                {isAnalogMode && (
                                  <td style={{ padding: '8px 18px' }}>
                                    <input
                                      type="text"
                                      value={point.volt !== undefined && point.volt !== null ? point.volt : ''}
                                      onChange={e => handleUpdatePoint(point.id, 'volt', e.target.value)}
                                      placeholder="Enter Volt (e.g. 0.85)"
                                      style={{
                                        width: '100%',
                                        maxWidth: '280px',
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
                                )}

                                {/* Frequency (ONLY for Serial / Digital) */}
                                {!isAnalogMode && (
                                  <td style={{ padding: '8px 18px' }}>
                                    <input
                                      type="text"
                                      value={point.frequency !== undefined && point.frequency !== null ? point.frequency : (point.adcValue !== undefined && point.adcValue !== null ? point.adcValue : '')}
                                      onChange={e => handleUpdatePoint(point.id, 'frequency', e.target.value)}
                                      placeholder="Enter Frequency (e.g. 155)"
                                      style={{
                                        width: '100%',
                                        maxWidth: '280px',
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
                                )}

                                {/* Actions: Get Volt / Get Frequency & Remove */}
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
                                      title={isAnalogMode ? "Capture live voltage from sensor" : "Capture live frequency from sensor"}
                                    >
                                      <Activity size={13} />
                                      <span>{isAnalogMode ? 'Get Volt' : 'Get Frequency'}</span>
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

              {/* WHEN CALIBRATE TYPE IS DIRECT: Clean & Streamlined Pre-Calibrated Sensor Configuration */}
              {calibrateType === 'Direct' && (
                <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  
                  {/* Transmission Unit Selector */}
                  <div>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                      Transmission Unit
                    </label>
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                      <label
                        onClick={() => setDirectUnit('Litres')}
                        style={{
                          flex: '1 1 200px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '8px 14px',
                          borderRadius: '8px',
                          border: directUnit === 'Litres' ? '2px solid #f97316' : '1px solid #cbd5e1',
                          background: directUnit === 'Litres' ? '#fff7ed' : '#ffffff',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          userSelect: 'none'
                        }}
                      >
                        <div style={{
                          width: '16px',
                          height: '16px',
                          borderRadius: '50%',
                          border: directUnit === 'Litres' ? '5px solid #f97316' : '2px solid #cbd5e1',
                          background: '#ffffff',
                          flexShrink: 0
                        }} />
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: 700, color: directUnit === 'Litres' ? '#9a3412' : '#0f172a' }}>
                            Direct Litres (L)
                          </div>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>
                            Sensor transmits fuel volume directly in litres
                          </div>
                        </div>
                      </label>

                      <label
                        onClick={() => setDirectUnit('Percentage')}
                        style={{
                          flex: '1 1 200px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '8px 14px',
                          borderRadius: '8px',
                          border: directUnit === 'Percentage' ? '2px solid #f97316' : '1px solid #cbd5e1',
                          background: directUnit === 'Percentage' ? '#fff7ed' : '#ffffff',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          userSelect: 'none'
                        }}
                      >
                        <div style={{
                          width: '16px',
                          height: '16px',
                          borderRadius: '50%',
                          border: directUnit === 'Percentage' ? '5px solid #f97316' : '2px solid #cbd5e1',
                          background: '#ffffff',
                          flexShrink: 0
                        }} />
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: 700, color: directUnit === 'Percentage' ? '#9a3412' : '#0f172a' }}>
                            Percentage (0% – 100%)
                          </div>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>
                            Computed automatically against Tank Size
                          </div>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Advanced Multiplier & Offset (Optional Collapsible) */}
                  <div style={{
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    background: '#f8fafc'
                  }}>
                    <button
                      type="button"
                      onClick={() => setShowDirectAdvanced(prev => !prev)}
                      style={{
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        width: '100%'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Settings2 size={15} color="#ea580c" />
                        <span style={{ fontSize: '13px', fontWeight: 700, color: '#334155' }}>
                          Sensor Multiplier & Offset (Optional)
                        </span>
                      </div>
                      <ChevronDown
                        size={16}
                        color="#64748b"
                        style={{
                          transform: showDirectAdvanced ? 'rotate(180deg)' : 'rotate(0deg)',
                          transition: 'transform 0.2s ease'
                        }}
                      />
                    </button>

                    {showDirectAdvanced && (
                      <div style={{
                        marginTop: '10px',
                        paddingTop: '10px',
                        borderTop: '1px solid #e2e8f0',
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                        gap: '12px'
                      }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                            Multiplier (Default: 1.0)
                          </label>
                          <input
                            type="number"
                            step="any"
                            value={directMultiplier}
                            onChange={e => setDirectMultiplier(e.target.value)}
                            placeholder="1.0"
                            style={{
                              width: '100%',
                              height: '36px',
                              padding: '0 10px',
                              borderRadius: '6px',
                              border: '1px solid #cbd5e1',
                              background: '#ffffff',
                              fontSize: '13px',
                              outline: 'none',
                              boxSizing: 'border-box'
                            }}
                          />
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                            Offset (Default: 0.0)
                          </label>
                          <input
                            type="number"
                            step="any"
                            value={directOffset}
                            onChange={e => setDirectOffset(e.target.value)}
                            placeholder="0.0"
                            style={{
                              width: '100%',
                              height: '36px',
                              padding: '0 10px',
                              borderRadius: '6px',
                              border: '1px solid #cbd5e1',
                              background: '#ffffff',
                              fontSize: '13px',
                              outline: 'none',
                              boxSizing: 'border-box'
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                </div>
              )}

              {/* Practical Action Buttons (For Manual & Direct Modes) */}
              {calibrateType !== 'Auto' && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  marginTop: '16px',
                  paddingTop: '12px',
                  borderTop: '1px solid #f1f5f9'
                }}>
                  <button
                    type="button"
                    onClick={() => {
                      if (fuelType && fuelType.toLowerCase().includes('analog')) {
                        setFreqModalViewMode('volt');
                      } else {
                        setFreqModalViewMode('frequency');
                      }
                      setShowFrequencyModal(true);
                    }}
                    style={{
                      background: '#fff7ed',
                      color: '#ea580c',
                      border: '1px solid #fed7aa',
                      borderRadius: '20px',
                      padding: '7px 18px',
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
                    onClick={() => setShowLiveFuelModal(true)}
                    style={{
                      background: '#ecfdf5',
                      color: '#059669',
                      border: '1px solid #a7f3d0',
                      borderRadius: '20px',
                      padding: '7px 18px',
                      fontSize: '12.5px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      boxShadow: '0 1px 2px rgba(5, 150, 105, 0.08)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = '#d1fae5';
                      e.currentTarget.style.borderColor = '#6ee7b7';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = '#ecfdf5';
                      e.currentTarget.style.borderColor = '#a7f3d0';
                    }}
                  >
                    <span style={{
                      width: '7px',
                      height: '7px',
                      borderRadius: '50%',
                      background: '#10b981',
                      boxShadow: '0 0 6px rgba(16, 185, 129, 0.8)'
                    }} />
                    Live Fuel
                  </button>

                  <button
                    type="button"
                    onClick={loadVehicleData}
                    title="Reload Calibration Data"
                    style={{
                      background: '#f1f5f9',
                      color: '#475569',
                      border: '1px solid #cbd5e1',
                      width: '34px',
                      height: '34px',
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
                      width: '34px',
                      height: '34px',
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
              )}
            </div>

            {/* Bottom Centered Buttons */}
            <div className="calib-footer-actions">
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

      {/* Show Frequency / Litre & Volt Dual-Column Modal */}
      {showFrequencyModal && (() => {
        const half = Math.ceil(displayCalibrationRows.length / 2);
        const leftHalf = displayCalibrationRows.slice(0, half);
        const rightHalf = displayCalibrationRows.slice(half);

        return (
          <div
            className="calib-modal-overlay"
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
              className="calib-modal-box"
              style={{
                background: '#ffffff',
                borderRadius: '14px',
                width: '100%',
                maxWidth: '660px',
                boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.25)',
                border: '1px solid #e2e8f0',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden'
              }}
              onClick={e => e.stopPropagation()}
            >
              {/* Top Action Bar */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 20px',
                borderBottom: '1px solid #e2e8f0',
                background: '#f8fafc'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {/* Mode Toggle Button: Show Frequency <-> Show Volt */}
                  <button
                    type="button"
                    onClick={() => setFreqModalViewMode(prev => prev === 'volt' ? 'frequency' : 'volt')}
                    style={{
                      background: '#fff7ed',
                      color: '#ea580c',
                      border: '1px solid #fed7aa',
                      borderRadius: '6px',
                      padding: '6px 14px',
                      fontSize: '12.5px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      boxShadow: '0 1px 2px rgba(234, 88, 12, 0.08)',
                      transition: 'all 0.15s ease'
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
                    {freqModalViewMode === 'volt' ? 'Show Frequency' : 'Show Volt'}
                  </button>

                  {/* Reload Button */}
                  <button
                    type="button"
                    onClick={loadVehicleData}
                    title="Reload Calibration Data"
                    style={{
                      background: '#ffffff',
                      color: '#475569',
                      border: '1px solid #cbd5e1',
                      width: '32px',
                      height: '32px',
                      borderRadius: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = '#f1f5f9';
                      e.currentTarget.style.color = '#0f172a';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = '#ffffff';
                      e.currentTarget.style.color = '#475569';
                    }}
                  >
                    <RotateCw size={14} />
                  </button>

                  {/* Export / Download Button */}
                  <button
                    type="button"
                    onClick={handleExportExcel}
                    title="Export Calibration to Excel"
                    style={{
                      background: '#ffffff',
                      color: '#16a34a',
                      border: '1px solid #bbf7d0',
                      width: '32px',
                      height: '32px',
                      borderRadius: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = '#f0fdf4';
                      e.currentTarget.style.borderColor = '#86efac';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = '#ffffff';
                      e.currentTarget.style.borderColor = '#bbf7d0';
                    }}
                  >
                    <Download size={14} />
                  </button>
                </div>

                {/* Close Button */}
                <button
                  type="button"
                  onClick={() => setShowFrequencyModal(false)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    padding: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '6px',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.color = '#0f172a';
                    e.currentTarget.style.background = '#e2e8f0';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.color = '#94a3b8';
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <X size={18} />
                </button>
              </div>

              {/* Title Section */}
              <div style={{
                textAlign: 'center',
                padding: '12px 20px 8px',
                borderBottom: '1px solid #f1f5f9'
              }}>
                <h3 style={{
                  margin: 0,
                  fontSize: '17px',
                  fontWeight: 800,
                  color: '#ea580c',
                  letterSpacing: '-0.01em'
                }}>
                  {freqModalViewMode === 'volt' ? 'Litre and Volt' : 'Litre and Frequency'}
                </h3>
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                  {displayVehicleId} • Tank {activeTank} (Sensor {activeSensor}) • {displayCalibrationRows.length} Calibration Points
                </div>
              </div>

              {/* Dual-Column Calibration Table */}
              <div style={{
                maxHeight: '400px',
                overflowY: 'auto',
                padding: '14px 20px'
              }}>
                {displayCalibrationRows.length === 0 ? (
                  <div style={{ padding: '30px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
                    No calibration points available.
                  </div>
                ) : (
                  <div style={{
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    overflow: 'hidden'
                  }}>
                    <table className="calib-modal-freq-table" style={{
                      width: '100%',
                      borderCollapse: 'collapse',
                      fontSize: '13px',
                      textAlign: 'center'
                    }}>
                      <thead style={{
                        position: 'sticky',
                        top: 0,
                        zIndex: 5,
                        background: '#f8fafc',
                        borderBottom: '2px solid #e2e8f0'
                      }}>
                        <tr>
                          {/* Left Column Header */}
                          <th style={{ padding: '8px 10px', fontWeight: 700, color: '#334155', width: '25%' }}>Litre</th>
                          <th style={{ padding: '8px 10px', fontWeight: 700, color: '#334155', width: '25%', borderRight: '2px solid #e2e8f0' }}>
                            {freqModalViewMode === 'volt' ? 'Volt' : 'Frequency'}
                          </th>

                          {/* Right Column Header */}
                          <th style={{ padding: '8px 10px', fontWeight: 700, color: '#334155', width: '25%' }}>Litre</th>
                          <th style={{ padding: '8px 10px', fontWeight: 700, color: '#334155', width: '25%' }}>
                            {freqModalViewMode === 'volt' ? 'Volt' : 'Frequency'}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {leftHalf.map((leftRow, idx) => {
                          const rightRow = rightHalf[idx];
                          const isEven = idx % 2 === 0;
                          return (
                            <tr
                              key={leftRow.id || idx}
                              style={{
                                background: isEven ? '#ffffff' : '#f8fafc',
                                borderBottom: '1px solid #f1f5f9'
                              }}
                            >
                              {/* Left Pair */}
                              <td style={{ padding: '7px 10px', fontWeight: 600, color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>
                                {leftRow.litres}
                              </td>
                              <td style={{
                                padding: '7px 10px',
                                fontWeight: 700,
                                color: '#ea580c',
                                fontVariantNumeric: 'tabular-nums',
                                borderRight: '2px solid #e2e8f0'
                              }}>
                                {freqModalViewMode === 'volt' ? leftRow.volt : leftRow.frequency}
                              </td>

                              {/* Right Pair */}
                              <td style={{ padding: '7px 10px', fontWeight: 600, color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>
                                {rightRow ? rightRow.litres : '-'}
                              </td>
                              <td style={{
                                padding: '7px 10px',
                                fontWeight: 700,
                                color: '#ea580c',
                                fontVariantNumeric: 'tabular-nums'
                              }}>
                                {rightRow ? (freqModalViewMode === 'volt' ? rightRow.volt : rightRow.frequency) : '-'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Bottom Footer */}
              <div style={{
                display: 'flex',
                justifyContent: 'flex-end',
                padding: '12px 20px',
                borderTop: '1px solid #e2e8f0',
                background: '#f8fafc'
              }}>
                <button
                  type="button"
                  onClick={() => setShowFrequencyModal(false)}
                  style={{
                    padding: '8px 26px',
                    borderRadius: '8px',
                    background: '#f97316',
                    color: '#ffffff',
                    border: 'none',
                    fontWeight: 700,
                    fontSize: '13px',
                    cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(249, 115, 22, 0.28)',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = '#ea580c';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(249, 115, 22, 0.38)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = '#f97316';
                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(249, 115, 22, 0.28)';
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Real-time Live Fuel Telemetry Modal */}
      <LiveFuelModal
        isOpen={showLiveFuelModal}
        onClose={() => setShowLiveFuelModal(false)}
        vehicleId={id}
        vehicleName={vehicleName || vehicle?.name || displayVehicleId}
        plate={vehicle?.plate}
        imei={vehicle?.imei}
        tankCapacity={computedLitres > 0 ? computedLitres : (parseFloat(tankSize) || 0)}
        initialFuel={vehicle?.current_fuel}
        initialOdometer={vehicle?.current_odometer ?? vehicle?.odometer ?? vehicle?.metadata?.odometerReading}
        fuelType={fuelType}
        sensorType={sensorType}
      />

      {/* Excel / CSV Import Modal for Manual Calibration */}
      {showUploadModal && (
        <div
          className="calib-modal-overlay"
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
            className="calib-modal-box"
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
