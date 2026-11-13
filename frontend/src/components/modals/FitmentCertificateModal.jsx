import React, { useRef, useState, useEffect } from 'react';
import { X, Printer, Download, Edit3, Check, RotateCcw, ExternalLink, Globe, Wifi, CheckCircle2, Copy, RefreshCw, Upload, Save, Sparkles, Image as ImageIcon, AlertCircle, FileCheck, Loader2, ClipboardPaste, Cpu, ArrowLeft } from 'lucide-react';
import * as vehicleApi from '../../api/vehicleApi';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import fuelTracksLogo from '../../assets/fueltracks_cert_logo.png';
import DeviceInventoryUploadModal from './DeviceInventoryUploadModal';

const formatDateDDMMYYYY = (dateVal) => {
  if (!dateVal) return '';
  if (typeof dateVal === 'string') {
    const trimmed = dateVal.trim();
    if (/^\d{2}-\d{2}-\d{4}$/.test(trimmed)) return trimmed;
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) return trimmed.replace(/\//g, '-');
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
      const [y, m, d] = trimmed.split('T')[0].split('-');
      return `${d}-${m}-${y}`;
    }
  }
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return String(dateVal);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
};

export const computeSimValidityRange = (dateVal, years = 1) => {
  if (typeof years === 'string' && years.toUpperCase().includes('TO')) {
    return years.trim();
  }
  const numYears = parseInt(String(years || '1').replace(/\D/g, ''), 10) || 1;
  let d = null;
  if (typeof dateVal === 'string') {
    const trimmed = dateVal.trim();
    if (/^\d{2}-\d{2}-\d{4}$/.test(trimmed)) {
      const [day, m, y] = trimmed.split('-');
      d = new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(day, 10));
    } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
      const [day, m, y] = trimmed.split('/');
      d = new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(day, 10));
    } else if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
      const [y, m, day] = trimmed.split('T')[0].split('-');
      d = new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(day, 10));
    }
  } else if (dateVal instanceof Date) {
    d = new Date(dateVal.getTime());
  }
  if (!d || isNaN(d.getTime())) {
    d = new Date();
  }

  const startFormatted = formatDateDDMMYYYY(d);

  const end = new Date(d.getFullYear() + numYears, d.getMonth(), d.getDate());
  end.setDate(end.getDate() - 1);
  const endFormatted = formatDateDDMMYYYY(end);

  return `${startFormatted} TO ${endFormatted}`;
};

const computeVerificationCode = (cert, imei, veh) => {
  const seed = `${cert || 'FT'}:${imei || '0'}:${veh || '0'}`;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash |= 0;
  }
  const hex = Math.abs(hash).toString(16).padStart(8, '0').toUpperCase();
  return `FT-VERIFY-${hex.slice(0, 4)}-${hex.slice(4, 8)}-${hex.slice(-4)}`;
};

export function resolveVltdManufacturer(deviceModel, serialNo, explicitMfr) {
  if (explicitMfr && typeof explicitMfr === 'string' && explicitMfr.trim() && explicitMfr.trim() !== 'FUELTRACKS TECHNOLOGIES PRIVATE LIMITED') {
    const raw = explicitMfr.trim();
    const up = raw.toUpperCase();
    if (up.includes('VOLTY') || up.includes('VOLTSYS') || up.includes('VOL1') || up.includes('VLY') || up === 'VOLTY') {
      return 'VOLTY IOT SOLUTIONS PRIVATE LIMITED';
    }
    if (up.includes('APM') || up.includes('KINGSTRACK') || up.includes('KINGSTRACKS')) {
      return 'APM KINGSTRACK PRIVATE LIMITED';
    }
    if (up.includes('TELTONIKA')) {
      return 'TELTONIKA TELEMATICS';
    }
    if (up.includes('CONCOX') || up.includes('JIMI')) {
      return 'CONCOX / JIMI IOT';
    }
    if (up.includes('BSTPL') || up.includes('BHARAT SATELLITE')) {
      return 'BHARAT SATELLITE TRACKING PVT LTD';
    }
    if (up.includes('TRACKNOW')) {
      return 'TRACKNOW SOLUTIONS PRIVATE LIMITED';
    }
    if (up.includes('VAMO')) {
      return 'VAMO SYSTEMS PRIVATE LIMITED';
    }
    if (up.includes('TRANSYNC')) {
      return 'TRANSYNC TELEMATICS';
    }
    return raw;
  }
  const text = `${deviceModel || ''} ${serialNo || ''}`.toUpperCase().trim();
  if (text.includes('VOLTY') || text.includes('VOL1') || text.includes('VLY') || text.includes('VLT') || text.includes('VOLTSYS') || text.startsWith('VOL') || text.startsWith('VLY')) {
    return 'VOLTY IOT SOLUTIONS PRIVATE LIMITED';
  }
  if (text.includes('APM') || text.includes('KINGSTRACK') || text.startsWith('APM') || text.includes('1819001A')) {
    return 'APM KINGSTRACK PRIVATE LIMITED';
  }
  if (text.includes('TELTONIKA') || text.includes('FMC') || text.includes('FMB') || text.includes('FMM') || text.includes('TST')) {
    return 'TELTONIKA TELEMATICS';
  }
  if (text.includes('CONCOX') || text.includes('JIMI') || text.includes('WETRACK') || text.includes('GT06') || text.includes('GT800') || text.includes('V5')) {
    return 'CONCOX / JIMI IOT';
  }
  if (text.includes('BSTPL') || text.includes('BST')) {
    return 'BHARAT SATELLITE TRACKING PVT LTD';
  }
  if (text.includes('TRACKNOW') || text.includes('TRK')) {
    return 'TRACKNOW SOLUTIONS PRIVATE LIMITED';
  }
  if (text.includes('VAMO')) {
    return 'VAMO SYSTEMS PRIVATE LIMITED';
  }
  if (text.includes('TRANSYNC') || text.includes('NAV140') || text.includes('NAV 140')) {
    return 'TRANSYNC TELEMATICS';
  }
  return 'VOLTY IOT SOLUTIONS PRIVATE LIMITED';
}

const FitmentCertificateModal = ({ isOpen, onClose, vehicle, onSaved }) => {
  const [isDirty, setIsDirty] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [logoBase64, setLogoBase64] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);

  // RC Document Scanner States
  const [showRcScanner, setShowRcScanner] = useState(false);
  const [rcFrontFile, setRcFrontFile] = useState(null);
  const [rcBackFile, setRcBackFile] = useState(null);
  const [rcFrontPreview, setRcFrontPreview] = useState(vehicle?.metadata?.rcFrontUrl || null);
  const [rcBackPreview, setRcBackPreview] = useState(vehicle?.metadata?.rcBackUrl || null);
  const [isScanningRc, setIsScanningRc] = useState(false);
  const [rcScanSuccess, setRcScanSuccess] = useState('');
  const [rcScanError, setRcScanError] = useState('');
  const [activePasteSlot, setActivePasteSlot] = useState('front');

  const handlePastedFile = (file, slot = null) => {
    if (!file || !file.type.startsWith('image/')) {
      setRcScanError('Only image files (JPG, PNG, WebP) can be pasted.');
      setTimeout(() => setRcScanError(''), 3500);
      return;
    }
    const targetSlot = slot || (rcFrontFile && !rcBackFile ? 'back' : 'front');
    if (targetSlot === 'front') {
      setRcFrontFile(file);
      setRcFrontPreview(URL.createObjectURL(file));
      setRcScanSuccess('RC Front photo pasted from clipboard!');
    } else {
      setRcBackFile(file);
      setRcBackPreview(URL.createObjectURL(file));
      setRcScanSuccess('RC Back photo pasted from clipboard!');
    }
    setRcScanError('');
    setTimeout(() => setRcScanSuccess(''), 3500);
  };

  const handlePasteFromClipboard = async (targetSlot = 'front') => {
    try {
      if (navigator.clipboard && navigator.clipboard.read) {
        const items = await navigator.clipboard.read();
        for (const item of items) {
          for (const type of item.types) {
            if (type.startsWith('image/')) {
              const blob = await item.getType(type);
              const ext = type.split('/')[1] || 'png';
              const file = new File([blob], `rc_${targetSlot}_${Date.now()}.${ext}`, { type });
              handlePastedFile(file, targetSlot);
              return;
            }
          }
        }
        setRcScanError('No image found in clipboard. Copy an image first, then paste.');
        setTimeout(() => setRcScanError(''), 4000);
      } else {
        setRcScanError('Press Ctrl+V on your keyboard to paste the image.');
        setTimeout(() => setRcScanError(''), 4000);
      }
    } catch (err) {
      console.warn('Clipboard read error:', err);
      setRcScanError('Clipboard access blocked. Please press Ctrl+V to paste directly.');
      setTimeout(() => setRcScanError(''), 4000);
    }
  };

  // Global Ctrl+V listener while RC Scanner modal is open
  useEffect(() => {
    if (!showRcScanner) return;
    const onWindowPaste = (e) => {
      if (['INPUT', 'TEXTAREA'].includes(e.target?.tagName)) return;
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const file = items[i].getAsFile();
          if (file) {
            e.preventDefault();
            handlePastedFile(file, activePasteSlot);
            break;
          }
        }
      }
    };
    window.addEventListener('paste', onWindowPaste);
    return () => window.removeEventListener('paste', onWindowPaste);
  }, [showRcScanner, activePasteSlot, rcFrontFile, rcBackFile]);

  // Save to Database States
  const [isSavingCert, setIsSavingCert] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState('');
  const [saveError, setSaveError] = useState('');
  const [showInventoryModal, setShowInventoryModal] = useState(false);

  const fetchDeviceInventory = (imeiVal) => {
    if (!imeiVal) return;
    const clean = String(imeiVal).replace(/\D/g, '');
    if (!clean || clean.length < 10) return;
    fetch(`/api/admin/device-inventory/lookup?imei=${clean}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` }
    })
      .then(res => res.json())
      .then(resData => {
        if (resData && resData.success && resData.data) {
          const inv = resData.data;
          setFormData(prev => {
            const updated = {
              ...prev,
              deviceSerialNo: inv.serial_no || prev.deviceSerialNo,
              iccid: inv.iccid || prev.iccid,
              vltdManufacturer: inv.manufacturer || prev.vltdManufacturer,
              modelName: inv.device_model || prev.modelName,
              simProvider: inv.sim_provider || prev.simProvider,
              simNumber: inv.sim_no || prev.simNumber
            };
            // If the vehicle does not have created_at/onboardingDate, but inventory has created_at
            if (inv.created_at && (!vehicle?.created_at && !vehicle?.metadata?.onboardingDate)) {
              const invOnboardedDate = formatDateDDMMYYYY(inv.created_at);
              updated.installationDate = invOnboardedDate;
              updated.installedDate = invOnboardedDate;
              if (!prev.activationDate) {
                updated.activationDate = invOnboardedDate;
              }
            }
            generateQR(updated, qrTargetHost);
            return updated;
          });
        }
      })
      .catch(() => {});
  };

  const certificateRef = useRef(null);

  // Pre-load logo to Base64 to guarantee instantaneous and reliable PDF canvas capture
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const c = document.createElement('canvas');
        c.width = img.naturalWidth || img.width;
        c.height = img.naturalHeight || img.height;
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0);
        setLogoBase64(c.toDataURL('image/png'));
      } catch (_) {}
    };
    img.src = fuelTracksLogo;
  }, []);

  const getInitialFormData = (veh) => {
    if (!veh) return {};
    const metadata = veh.metadata || {};

    const plate = veh.plate || veh.name || metadata.registrationNo || metadata.vehicleId || 'TN19AK1499';
    const imei = veh.imei || metadata.imei || '861329082393712';
    const imeiClean = String(imei).replace(/\D/g, '');
    const imeiLast10 = imeiClean.slice(-10);

    const now = new Date();
    const oneYearLater = new Date();
    oneYearLater.setFullYear(now.getFullYear() + 1);
    oneYearLater.setDate(oneYearLater.getDate() - 1); // Exact 365-day validity

    // Device onboarded date: prioritized by the actual date the device/vehicle was added on
    const deviceOnboardedRaw =
      metadata.onboardingDate ||
      metadata.onboardedDate ||
      metadata.onboarded_at ||
      metadata.device_onboarded_date ||
      veh.created_at ||
      veh.createdAt ||
      veh.device_created_at ||
      veh.assigned_at ||
      veh.licence_issued_date ||
      metadata.installationDate ||
      metadata.installedDate ||
      now;

    const installedDate = formatDateDDMMYYYY(deviceOnboardedRaw);

    const activationDate = metadata.activationDate
      ? formatDateDDMMYYYY(metadata.activationDate)
      : installedDate;

    const certIssuedDate = veh.licence_issued_date
      ? formatDateDDMMYYYY(veh.licence_issued_date)
      : formatDateDDMMYYYY(now);

    const expiryDate = veh.licence_expire_date
      ? formatDateDDMMYYYY(veh.licence_expire_date)
      : formatDateDDMMYYYY(oneYearLater);

    const certNumber = metadata.certSerialNo || `FT-GPS-${now.getFullYear()}-${(imeiClean ? imeiClean.slice(-6) : String(veh.id || '').slice(-6) || '000001').toUpperCase()}`;

    const rawDevModel = metadata.modelName || metadata.deviceModel || veh.device_model || veh.device_version || veh.server_name || veh.model || '';
    const rawSerial =
      metadata.deviceSerialNo ||
      metadata.serialNo ||
      metadata.vlttdSlno ||
      metadata.vltdSlno ||
      metadata.vltd_slno ||
      metadata.device_serial_no ||
      veh.serial_no ||
      veh.deviceSerialNo ||
      veh.vlttdSlno ||
      '';
    const rawMfr = metadata.vltdManufacturer || metadata.manufacturer || metadata.mfr || veh.manufacturer || '';
    const resolvedMfr = resolveVltdManufacturer(rawDevModel, rawSerial, rawMfr);
    const isVolty = resolvedMfr.includes('VOLTY');
    const isApm = resolvedMfr.includes('APM');

    const defaultModel = isVolty ? 'VOLTY-AIS140' : (isApm ? '1819001A' : 'AIS140');
    const defaultSerial = isVolty
      ? (imeiLast10 ? `VLY2N2I${imeiLast10}` : 'VLY2N2I052685344688')
      : (isApm ? (imeiLast10 ? `APM1K2I${imeiLast10}` : 'APM1K2I102690315456') : (imeiLast10 ? `SN-${imeiLast10}` : 'SN-102690315456'));

    const modelName = metadata.modelName || metadata.deviceModel || veh.device_model || defaultModel;
    const deviceSerialNo = rawSerial || defaultSerial;

    const plateUp = String(plate || '').toUpperCase().trim();
    let initialCertFormat = metadata.certFormat;
    if (!initialCertFormat) {
      if (plateUp.startsWith('TS') || plateUp.startsWith('TG')) {
        initialCertFormat = 'telangana_mining';
      } else if (plateUp.startsWith('TN')) {
        initialCertFormat = 'tamilnadu_mining';
      } else {
        initialCertFormat = 'normal_tracking';
      }
    }

    const defaultDistrictState = metadata.districtState || metadata.state || (
      (initialCertFormat === 'telangana_mining' || plateUp.startsWith('TS') || plateUp.startsWith('TG'))
        ? 'Telangana'
        : (initialCertFormat === 'tamilnadu_mining' || plateUp.startsWith('TN'))
          ? 'Tamil Nadu'
          : 'Telangana'
    );

    return {
      // Certificate Format Selection: 'tamilnadu_mining' | 'telangana_mining' | 'normal_tracking'
      certFormat: initialCertFormat,

      // Company Details
      companyName: 'FUELTRACKS TECHNOLOGIES PRIVATE LIMITED',
      vltdManufacturer: resolvedMfr,
      companyAddress: 'H.NO 17-1-382/2/2, 2nd Floor, Govt. Press Colony, Kharmanghat, R.R. Dist. - 500079',
      companyPhone: '9000666914',
      companyEmail: 'info@fueltracks.in',
      companyWeb: 'www.fueltracks.in',

      // Section 1: Vehicle Details
      vehicleNo: plate,
      vehicleCategory: metadata.vehicleCategory || (initialCertFormat === 'normal_tracking' ? 'Commercial / Private Vehicle' : 'Mining Vehicle'),
      vehicleType: metadata.vehicleType || (metadata.vehicleMakeModel ? metadata.vehicleMakeModel : 'TIPPER'),
      ownerName: metadata.ownerName || metadata.customerName || veh.driver_name || veh.org_name || 'SRIKRISHNA',
      districtState: defaultDistrictState,

      // Section 2: VLTD Device Details
      modelName: modelName,
      deviceSerialNo: deviceSerialNo,
      imei: imei,

      // Section 3: Connectivity & Activation Details
      iccid: metadata.iccid || metadata.sim_number || (veh.gps_sim_no && veh.gps_sim_no.length >= 18 ? veh.gps_sim_no : '8991430008117572979F'),
      simProvider: metadata.simProvider || metadata.simOperator || 'Technojacks',
      simValidity: (metadata.simValidity && String(metadata.simValidity).toUpperCase().includes('TO'))
        ? String(metadata.simValidity).trim()
        : computeSimValidityRange(installedDate, metadata.simValidity || '1'),
      installationDate: installedDate,
      activationDate: activationDate,

      // Legacy / Additional Fields Preserved for Full Compatibility
      certNumber: certNumber,
      verificationCode: computeVerificationCode(certNumber, imei, plate),
      vehicleMakeModel: metadata.vehicleMakeModel || (veh.make && veh.model ? `${veh.make} - ${veh.model}` : 'Commercial Vehicle'),
      chassisNo: metadata.chassisNo || metadata.vin || veh.chassis_no || veh.vin || '',
      engineNo: metadata.engineNo || metadata.engine_number || veh.engine_no || veh.engine_number || '',
      customerName: metadata.ownerName || metadata.customerName || veh.driver_name || veh.org_name || 'SRIKRISHNA',
      phone: metadata.ownerPhone || metadata.customerPhone || veh.driver_phone || 'N/A',
      customerAddress: metadata.ownerAddress || metadata.address || 'N/A',
      deviceModel: metadata.deviceModel || veh.device_model || '1819001A',
      simNumber: veh.gps_sim_no || metadata.sim1 || metadata.gpsSimNo || metadata.gps_sim_no || metadata.sim || 'N/A',
      simOperator: metadata.primarySimOperator || metadata.telecomOperator || 'Technojacks',
      fitmentLocation: metadata.fitmentLocation || 'Behind Co-driver Dashboard Firewall',
      sealNumber: metadata.sealSerialNo || (imeiClean ? `FT-SEAL-${imeiClean.slice(-6)}` : 'N/A'),
      installedDate: installedDate,
      certIssuedDate: certIssuedDate,
      expiryDate: expiryDate
    };
  };

  const [formData, setFormData] = useState({});
  // QR Verification Domain State: 'prod' (default: fueltracks.in) or 'lan' (Wi-Fi test)
  const [qrTargetHost, setQrTargetHost] = useState('prod');
  const [lanIp, setLanIp] = useState('192.168.1.6');

  // Discover local Wi-Fi IP for optional local testing
  useEffect(() => {
    fetch('/api/network-info')
      .then(res => res.json())
      .then(info => {
        if (info && info.success && info.lanIp) {
          setLanIp(info.lanIp);
        }
      })
      .catch(() => {});
  }, []);

  const getVerificationUrl = (data, targetMode) => {
    if (!data) return '';
    const mode = targetMode || qrTargetHost;
    // Official domain by default — strictly eliminates random tunnel names
    const base = mode === 'lan' ? `http://${lanIp}:5173` : 'https://app.fueltracks.in';
    const certNum = data.certNumber || `FT-GPS-${new Date().getFullYear()}-${data.vehicleNo || '00001'}`;
    const veh = data.vehicleNo || '';
    const imei = data.imei || '';
    const query = new URLSearchParams();
    if (veh) query.set('v', veh);
    if (imei) query.set('i', imei);
    if (data.vltdManufacturer) query.set('mfr', data.vltdManufacturer);
    if (data.modelName) query.set('model', data.modelName);
    if (data.deviceSerialNo) query.set('serialno', data.deviceSerialNo);
    if (data.certFormat) query.set('format', data.certFormat);
    if (data.installationDate) query.set('installed', data.installationDate);
    if (data.activationDate) query.set('activated', data.activationDate);
    if (data.simValidity) query.set('validity', data.simValidity);
    if (data.chassisNo && String(data.chassisNo).trim().toUpperCase() !== 'N/A') query.set('chassis', data.chassisNo.trim());
    if (data.engineNo && String(data.engineNo).trim().toUpperCase() !== 'N/A') query.set('engine', data.engineNo.trim());
    const qs = query.toString() ? `?${query.toString()}` : '';
    return `${base}/verify/${encodeURIComponent(certNum)}${qs}`;
  };

  const generateQR = async (data, targetMode) => {
    try {
      const verifyUrl = getVerificationUrl(data, targetMode);
      setQrCodeUrl(`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(verifyUrl)}`);
    } catch (err) {
      console.error('Failed to generate QR code:', err);
    }
  };

  useEffect(() => {
    if (vehicle) {
      const initial = getInitialFormData(vehicle);
      setFormData(initial);
      generateQR(initial, qrTargetHost);
      if (vehicle.imei) {
        fetchDeviceInventory(vehicle.imei);
      }
    }
  }, [vehicle, qrTargetHost, lanIp]);

  useEffect(() => {
    if (formData && Object.keys(formData).length > 0) {
      generateQR(formData, qrTargetHost);
    }
  }, [qrTargetHost, lanIp]);

  const handleInputChange = (field, value) => {
    setIsDirty(true);
    setFormData((prev) => {
      const updated = { ...prev, [field]: value };
      if (field === 'installationDate' && value) {
        if (!prev.simValidity || prev._autoSimValidity || !prev.simValidity.toUpperCase().includes('TO')) {
          updated.simValidity = computeSimValidityRange(value, 1);
          updated._autoSimValidity = true;
        }
      }
      if (field === 'simValidity') {
        updated._autoSimValidity = false;
      }
      if (field === 'certFormat') {
        if (value === 'telangana_mining' && (!prev.districtState || prev.districtState === 'Tamil Nadu')) {
          updated.districtState = 'Telangana';
        } else if (value === 'tamilnadu_mining' && (!prev.districtState || prev.districtState === 'Telangana')) {
          updated.districtState = 'Tamil Nadu';
        }
        if (value === 'normal_tracking' && prev.vehicleCategory === 'Mining Vehicle') {
          updated.vehicleCategory = 'Commercial Vehicle';
        } else if ((value === 'tamilnadu_mining' || value === 'telangana_mining') && prev.vehicleCategory === 'Commercial Vehicle') {
          updated.vehicleCategory = 'Mining Vehicle';
        }
      }
      if (['vehicleNo', 'imei', 'certNumber', 'certFormat'].includes(field)) {
        updated.verificationCode = computeVerificationCode(updated.certNumber, updated.imei, updated.vehicleNo);
        generateQR(updated);
      }
      return updated;
    });
  };

  const handleScanRc = async () => {
    if (!rcFrontFile && !rcBackFile) {
      setRcScanError('Please select at least one RC image (Front or Back).');
      return;
    }
    setIsScanningRc(true);
    setRcScanError('');
    setRcScanSuccess('');

    try {
      const fd = new FormData();
      if (rcFrontFile) fd.append('rcFront', rcFrontFile);
      if (rcBackFile) fd.append('rcBack', rcBackFile);

      const res = await vehicleApi.scanRcDocument(fd);
      if (res && res.success && res.data) {
        const rc = res.data;
        setFormData((prev) => {
          const updated = {
            ...prev,
            vehicleNo: rc.registrationNo || prev.vehicleNo,
            ownerName: rc.ownerName || prev.ownerName,
            customerName: rc.ownerName || prev.customerName,
            vehicleType: rc.vehicleClass || prev.vehicleType,
            chassisNo: rc.chassisNo || prev.chassisNo,
            engineNo: rc.engineNo || prev.engineNo,
            customerAddress: rc.ownerAddress || prev.customerAddress,
            vehicleMakeModel: rc.vehicleMakeModel || prev.vehicleMakeModel,
            vehicleRegistrationDate: rc.registrationDate ? formatDateDDMMYYYY(rc.registrationDate) : (prev.vehicleRegistrationDate || ''),
            // Preserve device onboarded date as installationDate
            installationDate: prev.installationDate,
            installedDate: prev.installedDate,
            expiryDate: rc.fitnessUpto ? formatDateDDMMYYYY(rc.fitnessUpto) : prev.expiryDate,
            rcFrontUrl: rc.rcFrontUrl || prev.rcFrontUrl,
            rcBackUrl: rc.rcBackUrl || prev.rcBackUrl
          };
          updated.verificationCode = computeVerificationCode(updated.certNumber, updated.imei, updated.vehicleNo);
          generateQR(updated);
          return updated;
        });

        if (rc.rcFrontUrl) setRcFrontPreview(rc.rcFrontUrl);
        if (rc.rcBackUrl) setRcBackPreview(rc.rcBackUrl);

        setRcScanSuccess(`RC Scanned Successfully! Auto-filled: ${[rc.registrationNo, rc.chassisNo, rc.ownerName].filter(Boolean).join(' • ')}`);
      } else {
        setRcScanError(res?.error || 'Failed to scan RC details.');
      }
    } catch (err) {
      setRcScanError(err.response?.data?.error || err.message || 'Error occurred while scanning RC document.');
    } finally {
      setIsScanningRc(false);
    }
  };

  const handleSaveToDatabase = async () => {
    if (!vehicle?.id) return;
    setIsSavingCert(true);
    setSaveError('');
    setSaveSuccess('');

    try {
      const payload = {
        name: vehicle.name || formData.vehicleNo,
        plate: formData.vehicleNo,
        driverName: formData.ownerName || formData.customerName,
        driverPhone: formData.phone,
        metadata: {
          ...(vehicle.metadata || {}),
          certFormat: formData.certFormat,
          vltdManufacturer: formData.vltdManufacturer,
          vehicleCategory: formData.vehicleCategory,
          vehicleType: formData.vehicleType,
          ownerName: formData.ownerName,
          customerName: formData.ownerName,
          districtState: formData.districtState,
          modelName: formData.modelName,
          deviceModel: formData.modelName || formData.deviceModel,
          deviceSerialNo: formData.deviceSerialNo,
          serialNo: formData.deviceSerialNo,
          vlttdSlno: formData.deviceSerialNo,
          iccid: formData.iccid,
          sim_number: formData.iccid,
          simProvider: formData.simProvider,
          simValidity: formData.simValidity,
          installationDate: formData.installationDate,
          activationDate: formData.activationDate,
          certSerialNo: formData.certNumber,
          registrationNo: formData.vehicleNo,
          vehicleId: formData.vehicleNo,
          chassisNo: formData.chassisNo,
          engineNo: formData.engineNo,
          ownerAddress: formData.customerAddress,
          customerAddress: formData.customerAddress,
          ownerPhone: formData.phone,
          customerPhone: formData.phone,
          vehicleMakeModel: formData.vehicleMakeModel,
          fitmentLocation: formData.fitmentLocation,
          sealSerialNo: formData.sealNumber,
          installedDate: formData.installationDate || formData.installedDate,
          expiryDate: formData.expiryDate,
          rcFrontUrl: formData.rcFrontUrl || rcFrontPreview || vehicle.metadata?.rcFrontUrl,
          rcBackUrl: formData.rcBackUrl || rcBackPreview || vehicle.metadata?.rcBackUrl
        }
      };

      await vehicleApi.updateVehicle(vehicle.id, payload);
      if (vehicle.metadata) {
        Object.assign(vehicle.metadata, payload.metadata);
      }
      vehicle.plate = formData.vehicleNo;
      setIsDirty(false);
      if (onSaved) {
        onSaved();
      }

      setSaveSuccess('Certificate and RC details saved to vehicle database!');
      setTimeout(() => setSaveSuccess(''), 4500);
    } catch (err) {
      setSaveError(err.response?.data?.error || err.message || 'Failed to save certificate data.');
    } finally {
      setIsSavingCert(false);
    }
  };

  const handleReset = () => {
    if (vehicle) {
      const initial = getInitialFormData(vehicle);
      setFormData(initial);
      generateQR(initial);
      setIsDirty(false);
    }
  };

  const handleSafeClose = () => {
    if (isDirty) {
      if (window.confirm('You have unsaved certificate edits. Do you want to discard them?')) {
        setIsDirty(false);
        onClose();
      }
    } else {
      onClose();
    }
  };

  if (!isOpen || !vehicle) return null;

  const handlePrint = () => {
    window.print();
  };

  /**
   * Generates exact A4 single-page PDF with 10-12mm balanced print margins
   */
  const handleDownloadPDF = async () => {
    if (!certificateRef.current) return;
    setDownloading(true);

    let clone = null;
    try {
      const element = certificateRef.current;

      // Clone element into off-screen container with strict 794px A4 desktop width
      clone = element.cloneNode(true);
      clone.style.width = '794px';
      clone.style.minWidth = '794px';
      clone.style.maxWidth = '794px';
      clone.style.transform = 'none';
      clone.style.position = 'fixed';
      clone.style.left = '-9999px';
      clone.style.top = '0';
      clone.style.margin = '0';
      clone.style.boxShadow = 'none';
      clone.style.zIndex = '-9999';
      document.body.appendChild(clone);

      const canvas = await html2canvas(clone, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#FFFFFF',
        scrollX: 0,
        scrollY: 0,
        windowWidth: 1024,
        width: 794
      });

      // Remove clone immediately
      document.body.removeChild(clone);
      clone = null;

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = 210;
      const pdfHeight = 297;
      const margin = 10;
      const printableWidth = pdfWidth - margin * 2; // 190 mm
      const printableHeight = (canvas.height * printableWidth) / canvas.width;

      if (printableHeight > pdfHeight - margin * 2) {
        const scaleFactor = (pdfHeight - margin * 2) / printableHeight;
        const scaledWidth = printableWidth * scaleFactor;
        const scaledHeight = printableHeight * scaleFactor;
        const offsetX = (pdfWidth - scaledWidth) / 2;
        pdf.addImage(imgData, 'PNG', offsetX, margin, scaledWidth, scaledHeight, undefined, 'FAST');
      } else {
        pdf.addImage(imgData, 'PNG', margin, margin, printableWidth, printableHeight, undefined, 'FAST');
      }

      const cleanPlate = (formData.vehicleNo || vehicle.plate || vehicle.name || 'certificate').replace(/[^a-zA-Z0-9]/g, '_');
      pdf.save(`Fitment_Certificate_${cleanPlate}.pdf`);
    } catch (err) {
      if (clone && clone.parentNode) {
        document.body.removeChild(clone);
      }
      console.error('Error generating fitment certificate PDF:', err);
      alert(`Failed to generate PDF: ${err?.message || 'Unknown error'}. You can also use the Print button to Save as PDF.`);
    } finally {
      setDownloading(false);
    }
  };

  const activeLogoSrc = logoBase64 || fuelTracksLogo;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/75 backdrop-blur-sm overflow-y-auto"
      style={{ zIndex: 9999 }}
    >
      <style>{`
        @media print {
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          @page {
            size: A4 portrait;
            margin: 8mm 10mm;
          }
          body * {
            visibility: hidden !important;
          }
          #fitment-cert-print-area, #fitment-cert-print-area * {
            visibility: visible !important;
          }
          #fitment-cert-print-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: none !important;
            background: #ffffff !important;
            transform: none !important;
            z-index: 999999 !important;
          }
        }
      `}</style>

      {/* Modal Dialog Container */}
      <div className="relative bg-slate-100 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[96vh] flex flex-col overflow-hidden border border-slate-300">
        
        {/* Top Header Controls Bar */}
        <div className="bg-white border-b border-slate-200 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Prominent Back Button */}
            <button
              onClick={handleSafeClose}
              type="button"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 rounded-lg text-xs font-bold transition-all border border-slate-300 cursor-pointer shadow-2xs mr-1"
              title="Go back to Vehicles list"
            >
              <ArrowLeft size={14} className="text-slate-600" />
              <span>Back</span>
            </button>

            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-xs"></span>
            <span className="font-extrabold text-slate-800 text-sm tracking-tight">
              VLTD Fitment Certificate
            </span>
            <span className="text-[12px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-mono font-bold border border-slate-200">
              {formData.vehicleNo || 'TN19AK1499'}
            </span>

            {/* Certificate Format Selector */}
            <div className="hidden md:inline-flex items-center ml-1">
              <select
                value={formData.certFormat || 'tamilnadu_mining'}
                onChange={(e) => handleInputChange('certFormat', e.target.value)}
                className="bg-slate-100 hover:bg-slate-200/70 border border-slate-200 text-slate-700 text-[11px] font-bold rounded-lg px-2 py-1 transition-colors cursor-pointer outline-none"
              >
                <option value="tamilnadu_mining">Tamil Nadu Mining Vehicle (AIS-140 VLTD)</option>
                <option value="telangana_mining">Telangana Mining Vehicle (TSMDC / AIS-140 VLTD)</option>
                <option value="normal_tracking">Normal Vehicle Tracking (GPS Fitment)</option>
              </select>
            </div>

            {/* Discrete Domain Switcher */}
            <div className="hidden sm:inline-flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-[11px] font-semibold text-slate-600 ml-1">
              <button
                type="button"
                onClick={() => setQrTargetHost('prod')}
                className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                  qrTargetHost === 'prod' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Official production domain (app.fueltracks.in)"
              >
                app.fueltracks.in
              </button>
              <button
                type="button"
                onClick={() => setQrTargetHost('lan')}
                className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                  qrTargetHost === 'lan' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-500 hover:text-slate-800'
                }`}
                title={`Local Wi-Fi IP (${lanIp}:5173) for testing on mobile on the same Wi-Fi`}
              >
                Wi-Fi Test
              </button>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            {/* Import Devices Excel Master Button */}
            <button
              onClick={() => setShowInventoryModal(true)}
              type="button"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 transition-all cursor-pointer"
              title="Upload supplier Excel sheet with IMEIs, Serial Numbers and ICCIDs"
            >
              <Cpu size={13} className="text-blue-600" />
              <span>Import Devices Sheet</span>
            </button>

            {/* Scan RC Button */}
            <button
              onClick={() => setShowRcScanner(!showRcScanner)}
              type="button"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                showRcScanner
                  ? 'bg-orange-500 text-white shadow-xs'
                  : 'bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200'
              }`}
            >
              <Sparkles size={13} className={showRcScanner ? 'text-white' : 'text-orange-500'} />
              <span>{showRcScanner ? 'Close Scanner' : 'Scan RC Card'}</span>
            </button>

            {/* Edit Certificate Data */}
            <button
              onClick={() => setIsEditing(!isEditing)}
              type="button"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                isEditing
                  ? 'bg-slate-200 text-slate-800 border border-slate-300'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200'
              }`}
            >
              <Edit3 size={13} />
              <span>{isEditing ? 'Close Edit' : 'Edit'}</span>
            </button>

            {/* Print */}
            <button
              onClick={handlePrint}
              type="button"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold rounded-lg transition-all cursor-pointer"
            >
              <Printer size={13} />
              <span>Print</span>
            </button>

            {/* Download PDF */}
            <button
              onClick={handleDownloadPDF}
              disabled={downloading}
              type="button"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg shadow-xs transition-all cursor-pointer disabled:opacity-50"
            >
              <Download size={13} />
              <span>{downloading ? 'PDF...' : 'PDF'}</span>
            </button>

            {/* Save to Vehicle Database */}
            <button
              onClick={handleSaveToDatabase}
              disabled={isSavingCert}
              type="button"
              className={`flex items-center gap-1.5 px-3.5 py-1.5 text-white text-xs font-bold rounded-lg shadow-sm transition-all cursor-pointer disabled:opacity-50 ${
                isDirty
                  ? 'bg-emerald-600 hover:bg-emerald-700 ring-2 ring-emerald-300 animate-pulse'
                  : 'bg-[#f97316] hover:bg-[#ea580c]'
              }`}
              title="Save certificate edits & RC data directly to vehicle database"
            >
              {isSavingCert ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              <span>{isSavingCert ? 'Saving...' : isDirty ? 'Save Changes *' : 'Save to Vehicle'}</span>
            </button>

            {/* Close Modal */}
            <button
              onClick={handleSafeClose}
              type="button"
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors ml-1 cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Status Alerts */}
        {saveSuccess && (
          <div className="bg-emerald-50 border-b border-emerald-200 px-5 py-2 flex items-center justify-between text-xs text-emerald-800 font-bold shrink-0">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
              {saveSuccess}
            </span>
            <button onClick={() => setSaveSuccess('')} className="text-emerald-600 hover:text-emerald-800 font-bold">✕</button>
          </div>
        )}
        {saveError && (
          <div className="bg-rose-50 border-b border-rose-200 px-5 py-2 flex items-center justify-between text-xs text-rose-800 font-bold shrink-0">
            <span className="flex items-center gap-1.5">
              <AlertCircle size={14} className="text-rose-600 shrink-0" />
              {saveError}
            </span>
            <button onClick={() => setSaveError('')} className="text-rose-600 hover:text-rose-800 font-bold">✕</button>
          </div>
        )}

        {/* Dedicated, High-End RC Document Scanner Modal */}
        {showRcScanner && (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-fadeIn">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100 flex flex-col">
              
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-orange-50 border border-orange-200 text-orange-600 flex items-center justify-center shadow-xs">
                    <Sparkles size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900 tracking-tight">
                      Scan Vehicle RC Card
                    </h3>
                    <p className="text-xs text-slate-500">
                      Upload Front &amp; Back photos to auto-populate vehicle &amp; owner details
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowRcScanner(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Modal Body: Two Clean Photo Dropzones */}
              <div className="p-6 space-y-4">
                <div className="px-3.5 py-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-[11.5px] font-medium flex items-center gap-2 mb-3.5">
                  <Sparkles size={15} className="shrink-0 text-amber-600" />
                  <span><strong>Both sides in one photo?</strong> Just upload it in the first box below. The scanner automatically reads both front &amp; back together.</span>
                </div>
                <div className="grid grid-cols-2 gap-3.5">
                  
                  {/* RC Front Slot */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold text-slate-700">RC Photo (Front or Both in One)</span>
                      {rcFrontFile && (
                        <label
                          htmlFor="popup-rc-front"
                          className="text-[11px] font-semibold text-orange-600 hover:text-orange-700 cursor-pointer"
                        >
                          Change
                        </label>
                      )}
                    </div>
                    <input
                      id="popup-rc-front"
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const f = e.target.files[0];
                        if (f) {
                          setRcFrontFile(f);
                          setRcFrontPreview(URL.createObjectURL(f));
                        }
                      }}
                      className="hidden"
                    />
                    {rcFrontPreview ? (
                      <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-50 h-36 flex items-center justify-center group shadow-xs">
                        <img src={rcFrontPreview} alt="RC Front" className="h-full w-full object-contain p-1" />
                        <label
                          htmlFor="popup-rc-front"
                          className="absolute inset-0 bg-slate-900/40 text-white text-xs font-bold opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity cursor-pointer"
                        >
                          Change Photo
                        </label>
                      </div>
                    ) : (
                      <label
                        htmlFor="popup-rc-front"
                        className="border-2 border-dashed border-slate-200 hover:border-orange-400 rounded-xl h-36 flex flex-col items-center justify-center text-slate-400 hover:text-orange-600 bg-slate-50/50 hover:bg-orange-50/30 transition-all cursor-pointer p-3 text-center"
                      >
                        <ImageIcon size={24} className="mb-1.5 text-slate-400" />
                        <span className="text-xs font-bold text-slate-700">Upload RC Photo</span>
                        <span className="text-[10.5px] text-slate-400 mt-0.5">Both sides in one, or Front</span>
                      </label>
                    )}
                  </div>

                  {/* RC Back Slot */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold text-slate-700">RC Back (Optional)</span>
                      {rcBackFile && (
                        <label
                          htmlFor="popup-rc-back"
                          className="text-[11px] font-semibold text-orange-600 hover:text-orange-700 cursor-pointer"
                        >
                          Change
                        </label>
                      )}
                    </div>
                    <input
                      id="popup-rc-back"
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const f = e.target.files[0];
                        if (f) {
                          setRcBackFile(f);
                          setRcBackPreview(URL.createObjectURL(f));
                        }
                      }}
                      className="hidden"
                    />
                    {rcBackPreview ? (
                      <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-50 h-36 flex items-center justify-center group shadow-xs">
                        <img src={rcBackPreview} alt="RC Back" className="h-full w-full object-contain p-1" />
                        <label
                          htmlFor="popup-rc-back"
                          className="absolute inset-0 bg-slate-900/40 text-white text-xs font-bold opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity cursor-pointer"
                        >
                          Change Photo
                        </label>
                      </div>
                    ) : (
                      <label
                        htmlFor="popup-rc-back"
                        className="border-2 border-dashed border-slate-200 hover:border-orange-400 rounded-xl h-36 flex flex-col items-center justify-center text-slate-400 hover:text-orange-600 bg-slate-50/50 hover:bg-orange-50/30 transition-all cursor-pointer p-3 text-center"
                      >
                        <ImageIcon size={24} className="mb-1.5 text-slate-400" />
                        <span className="text-xs font-bold text-slate-700">Upload Back (Optional)</span>
                        <span className="text-[10.5px] text-slate-400 mt-0.5">Leave blank if single photo</span>
                      </label>
                    )}
                  </div>
                </div>

                {/* Status Message */}
                {rcScanError && (
                  <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
                    <AlertCircle size={14} className="shrink-0" />
                    <span>{rcScanError}</span>
                  </div>
                )}
                {rcScanSuccess && (
                  <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
                    <CheckCircle2 size={14} className="shrink-0 text-emerald-600" />
                    <span>{rcScanSuccess}</span>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setShowRcScanner(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 rounded-lg hover:bg-slate-200/60 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <div className="flex items-center gap-2">
                  {rcScanSuccess && (
                    <button
                      type="button"
                      onClick={() => setShowRcScanner(false)}
                      className="px-4 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors cursor-pointer"
                    >
                      Apply &amp; View Certificate
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={async () => {
                      await handleScanRc();
                    }}
                    disabled={isScanningRc || (!rcFrontFile && !rcBackFile)}
                    className="flex items-center gap-2 px-5 py-2.5 bg-[#f97316] hover:bg-[#ea580c] active:bg-[#c2410c] text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isScanningRc ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        <span>Extracting Details via OCR...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles size={14} />
                        <span>{rcScanSuccess ? 'Scan Again' : 'Extract & Apply Details'}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* Collapsible Edit Form Drawer */}
        {isEditing && (
          <div className="bg-slate-50 border-b border-slate-200 p-4 max-h-72 overflow-y-auto text-xs grid grid-cols-2 sm:grid-cols-4 gap-3 shrink-0">
            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase mb-0.5">Certificate Format</label>
              <select
                value={formData.certFormat || 'tamilnadu_mining'}
                onChange={(e) => handleInputChange('certFormat', e.target.value)}
                className="w-full px-2 py-1 bg-white border border-slate-300 rounded font-bold text-slate-800"
              >
                <option value="tamilnadu_mining">Tamil Nadu Mining Vehicle (AIS-140 VLTD)</option>
                <option value="telangana_mining">Telangana Mining Vehicle (TSMDC / AIS-140 VLTD)</option>
                <option value="normal_tracking">Normal Vehicle Tracking (GPS Fitment)</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase mb-0.5">Vehicle Registration No.</label>
              <input
                type="text"
                value={formData.vehicleNo || ''}
                onChange={(e) => handleInputChange('vehicleNo', e.target.value)}
                className="w-full px-2 py-1 bg-white border border-slate-300 rounded font-bold text-slate-800"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase mb-0.5">Vehicle Category</label>
              <input
                type="text"
                value={formData.vehicleCategory || ''}
                onChange={(e) => handleInputChange('vehicleCategory', e.target.value)}
                className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-slate-800"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase mb-0.5">Vehicle Type</label>
              <input
                type="text"
                value={formData.vehicleType || ''}
                onChange={(e) => handleInputChange('vehicleType', e.target.value)}
                className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-slate-800"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase mb-0.5">Owner Name</label>
              <input
                type="text"
                value={formData.ownerName || ''}
                onChange={(e) => handleInputChange('ownerName', e.target.value)}
                className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-slate-800"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase mb-0.5">District / State</label>
              <input
                type="text"
                value={formData.districtState || ''}
                onChange={(e) => handleInputChange('districtState', e.target.value)}
                className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-slate-800"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase mb-0.5">Chassis Number (Optional)</label>
              <input
                type="text"
                value={formData.chassisNo || ''}
                onChange={(e) => handleInputChange('chassisNo', e.target.value)}
                placeholder="Shows on cert if entered"
                className="w-full px-2 py-1 bg-white border border-slate-300 rounded font-mono text-slate-800"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase mb-0.5">Engine Number (Optional)</label>
              <input
                type="text"
                value={formData.engineNo || ''}
                onChange={(e) => handleInputChange('engineNo', e.target.value)}
                placeholder="Shows on cert if entered"
                className="w-full px-2 py-1 bg-white border border-slate-300 rounded font-mono text-slate-800"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-0.5">
                <label className="block text-[10px] font-bold text-slate-600 uppercase">VLTD Manufacturer Name</label>
                <span className="text-[9px] text-blue-600 font-semibold">Select or Type</span>
              </div>
              <input
                type="text"
                value={formData.vltdManufacturer || ''}
                onChange={(e) => handleInputChange('vltdManufacturer', e.target.value)}
                placeholder="e.g. VOLTY IOT SOLUTIONS PRIVATE LIMITED"
                className="w-full px-2 py-1 bg-white border border-slate-300 rounded font-semibold text-slate-800"
              />
              <div className="flex flex-wrap gap-1 mt-1.5">
                <button
                  type="button"
                  onClick={() => {
                    handleInputChange('vltdManufacturer', 'VOLTY IOT SOLUTIONS PRIVATE LIMITED');
                    if (!formData.modelName || formData.modelName === '1819001A') handleInputChange('modelName', 'VOLTY-AIS140');
                    if (!formData.deviceSerialNo || formData.deviceSerialNo.startsWith('APM')) handleInputChange('deviceSerialNo', `VLY2N2I${imeiLast10 || '052685344688'}`);
                  }}
                  className={`text-[9.5px] px-2 py-0.5 rounded font-bold border transition ${
                    formData.vltdManufacturer?.includes('VOLTY')
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                  }`}
                >
                  Volty
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleInputChange('vltdManufacturer', 'APM KINGSTRACK PRIVATE LIMITED');
                    if (!formData.modelName || formData.modelName === 'VOLTY-AIS140') handleInputChange('modelName', '1819001A');
                    if (!formData.deviceSerialNo || formData.deviceSerialNo.startsWith('VOL') || formData.deviceSerialNo.startsWith('VLY')) handleInputChange('deviceSerialNo', `APM1K2I${imeiLast10 || '102690315456'}`);
                  }}
                  className={`text-[9.5px] px-2 py-0.5 rounded font-bold border transition ${
                    formData.vltdManufacturer?.includes('APM')
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                  }`}
                >
                  APM
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleInputChange('vltdManufacturer', 'TELTONIKA TELEMATICS');
                    handleInputChange('modelName', 'FMB 920');
                    if (!formData.deviceSerialNo || formData.deviceSerialNo.startsWith('APM') || formData.deviceSerialNo.startsWith('VLY')) handleInputChange('deviceSerialNo', `FMB920-${imeiLast10 || '1026903154'}`);
                  }}
                  className={`text-[9.5px] px-2 py-0.5 rounded font-bold border transition ${
                    formData.vltdManufacturer?.includes('TELTONIKA')
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                  }`}
                >
                  Teltonika
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleInputChange('vltdManufacturer', 'CONCOX / JIMI IOT');
                    handleInputChange('modelName', 'V5 / GT800');
                  }}
                  className="text-[9.5px] bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded text-slate-700 border border-slate-300"
                >
                  Concox
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleInputChange('vltdManufacturer', 'BHARAT SATELLITE TRACKING PVT LTD');
                    handleInputChange('modelName', 'BSTPL-17');
                  }}
                  className="text-[9.5px] bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded text-slate-700 border border-slate-300"
                >
                  BSTPL
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleInputChange('vltdManufacturer', 'TRACKNOW SOLUTIONS PRIVATE LIMITED');
                    handleInputChange('modelName', 'AIS140');
                  }}
                  className="text-[9.5px] bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded text-slate-700 border border-slate-300"
                >
                  TrackNow
                </button>
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase mb-0.5">Model Name / Number</label>
              <input
                type="text"
                value={formData.modelName || ''}
                onChange={(e) => handleInputChange('modelName', e.target.value)}
                className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-slate-800"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase mb-0.5">Device Serial Number</label>
              <input
                type="text"
                value={formData.deviceSerialNo || ''}
                onChange={(e) => handleInputChange('deviceSerialNo', e.target.value)}
                className="w-full px-2 py-1 bg-white border border-slate-300 rounded font-mono text-slate-800"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase mb-0.5">IMEI Number</label>
              <input
                type="text"
                value={formData.imei || ''}
                onChange={(e) => handleInputChange('imei', e.target.value)}
                className="w-full px-2 py-1 bg-white border border-slate-300 rounded font-mono text-slate-800"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase mb-0.5">ICCID Number</label>
              <input
                type="text"
                value={formData.iccid || ''}
                onChange={(e) => handleInputChange('iccid', e.target.value)}
                className="w-full px-2 py-1 bg-white border border-slate-300 rounded font-mono text-slate-800"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase mb-0.5">SIM Service Provider</label>
              <input
                type="text"
                value={formData.simProvider || ''}
                onChange={(e) => handleInputChange('simProvider', e.target.value)}
                className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-slate-800"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase mb-0.5">SIM Validity</label>
              <input
                type="text"
                value={formData.simValidity || ''}
                onChange={(e) => handleInputChange('simValidity', e.target.value)}
                placeholder="02-11-2026 TO 01-11-2027"
                className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-slate-800"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase mb-0.5">Date of Installation (DD-MM-YYYY)</label>
              <input
                type="text"
                value={formData.installationDate || ''}
                onChange={(e) => handleInputChange('installationDate', e.target.value)}
                className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-slate-800"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase mb-0.5">Date of Activation (DD-MM-YYYY)</label>
              <input
                type="text"
                value={formData.activationDate || ''}
                onChange={(e) => handleInputChange('activationDate', e.target.value)}
                className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-slate-800"
              />
            </div>

            <div className="sm:col-span-4 flex justify-end gap-2 pt-1 border-t border-slate-200">
              <button
                type="button"
                onClick={handleReset}
                className="flex items-center gap-1 px-2.5 py-1 text-xs text-slate-600 hover:text-slate-800 font-semibold cursor-pointer"
              >
                <RotateCcw size={12} /> Reset to Defaults
              </button>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="flex items-center gap-1 px-3 py-1 text-xs bg-slate-900 text-white rounded font-semibold cursor-pointer"
              >
                <Check size={12} /> Done Editing
              </button>
            </div>
          </div>
        )}

        {/* Scrollable Document Container */}
        <div className="p-2 sm:p-6 overflow-x-auto overflow-y-auto bg-slate-200 flex justify-center">
          
          {/* Certificate Page - Strict Single A4 Fit Dimensions */}
          <div
            id="fitment-cert-print-area"
            ref={certificateRef}
            className="bg-white text-black shadow-xl relative"
            style={{
              width: '794px',
              minHeight: '1120px',
              padding: '48px 56px',
              fontFamily: 'Arial, Helvetica, sans-serif',
              boxSizing: 'border-box',
              color: '#000000',
              lineHeight: 1.35,
              background: '#ffffff'
            }}
          >
              <div style={{ color: '#000000' }}>
                {/* Header Titles */}
                <div style={{ textAlign: 'center', marginBottom: '22px' }}>
                  <h1 style={{ fontSize: '18px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.01em', margin: 0, color: '#000000' }}>
                    VEHICLE LOCATION TRACKING DEVICE (VLTD)
                  </h1>
                  <h2 style={{ fontSize: '15px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.01em', marginTop: '4px', margin: 0, color: '#000000' }}>
                    {formData.certFormat === 'telangana_mining'
                      ? 'FITMENT CERTIFICATE – TELANGANA MINING VEHICLE'
                      : formData.certFormat === 'tamilnadu_mining'
                        ? 'FITMENT CERTIFICATE – TAMILNADU MINING VEHICLE'
                        : 'FITMENT CERTIFICATE – NORMAL VEHICLE TRACKING'}
                  </h2>
                  <div style={{ marginTop: '8px' }}>
                    <div style={{
                      display: 'inline-block',
                      padding: '5px 14px',
                      backgroundColor: '#f8fafc',
                      border: '1.5px solid #0f172a',
                      borderRadius: '4px',
                      textAlign: 'center'
                    }}>
                      <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#334155', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        ISSUED BY :{' '}
                      </span>
                      <span style={{ fontSize: '15px', fontWeight: '900', color: '#000000', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                        FUELTRACKS TECHNOLOGIES PRIVATE LIMITED
                      </span>
                    </div>
                  </div>
                </div>

                {/* Opening Paragraph */}
                <p style={{ fontSize: '12.5px', lineHeight: '1.45', margin: '0 0 18px 0', color: '#000000' }}>
                  {formData.certFormat === 'normal_tracking' || formData.certFormat === 'standard_gps'
                    ? 'This is to certify that the Vehicle Location Tracking Device (VLTD) compliant with Automotive Industry Standard (AIS-140), as prescribed under the Central Motor Vehicle Rules, has been installed and activated in the below mentioned Vehicle'
                    : 'This is to certify that the Vehicle Location Tracking Device (VLTD) compliant with Automotive Industry Standard (AIS-140), as prescribed under the Central Motor Vehicle Rules, has been installed and activated in the below mentioned Mining Vehicle'}
                </p>

                {/* 1. VEHICLE DETAILS */}
                <div style={{ marginBottom: '18px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '5px', color: '#000000' }}>
                    1. VEHICLE DETAILS
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #94a3b8', fontSize: '12.5px' }}>
                    <tbody>
                      <tr>
                        <td style={{ border: '1px solid #94a3b8', padding: '6px 10px', width: '45%', fontWeight: 'bold' }}>Vehicle Registration Number</td>
                        <td style={{ border: '1px solid #94a3b8', padding: '6px 10px', width: '55%' }}>{formData.vehicleNo}</td>
                      </tr>
                      {Boolean(formData.chassisNo && String(formData.chassisNo).trim() && String(formData.chassisNo).trim().toUpperCase() !== 'N/A') && (
                        <tr>
                          <td style={{ border: '1px solid #94a3b8', padding: '6px 10px', fontWeight: 'bold' }}>Chassis Number</td>
                          <td style={{ border: '1px solid #94a3b8', padding: '6px 10px' }}>{formData.chassisNo}</td>
                        </tr>
                      )}
                      {Boolean(formData.engineNo && String(formData.engineNo).trim() && String(formData.engineNo).trim().toUpperCase() !== 'N/A') && (
                        <tr>
                          <td style={{ border: '1px solid #94a3b8', padding: '6px 10px', fontWeight: 'bold' }}>Engine Number</td>
                          <td style={{ border: '1px solid #94a3b8', padding: '6px 10px' }}>{formData.engineNo}</td>
                        </tr>
                      )}
                      <tr>
                        <td style={{ border: '1px solid #94a3b8', padding: '6px 10px', fontWeight: 'bold' }}>Vehicle Category</td>
                        <td style={{ border: '1px solid #94a3b8', padding: '6px 10px' }}>{formData.vehicleCategory}</td>
                      </tr>
                      <tr>
                        <td style={{ border: '1px solid #94a3b8', padding: '6px 10px', fontWeight: 'bold' }}>Vehicle Type</td>
                        <td style={{ border: '1px solid #94a3b8', padding: '6px 10px' }}>{formData.vehicleType}</td>
                      </tr>
                      <tr>
                        <td style={{ border: '1px solid #94a3b8', padding: '6px 10px', fontWeight: 'bold' }}>Owner Name</td>
                        <td style={{ border: '1px solid #94a3b8', padding: '6px 10px' }}>{formData.ownerName}</td>
                      </tr>
                      <tr>
                        <td style={{ border: '1px solid #94a3b8', padding: '6px 10px', fontWeight: 'bold' }}>District / State</td>
                        <td style={{ border: '1px solid #94a3b8', padding: '6px 10px' }}>{formData.districtState}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* 2. VLTD DEVICE DETAILS */}
                <div style={{ marginBottom: '18px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '5px', color: '#000000' }}>
                    2. VLTD DEVICE DETAILS
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #94a3b8', fontSize: '12.5px' }}>
                    <tbody>
                      <tr>
                        <td style={{ border: '1px solid #94a3b8', padding: '6px 10px', width: '45%', fontWeight: 'bold' }}>VLTD Manufacturer Name</td>
                        <td style={{ border: '1px solid #94a3b8', padding: '6px 10px', width: '55%' }}>{formData.vltdManufacturer}</td>
                      </tr>
                      <tr>
                        <td style={{ border: '1px solid #94a3b8', padding: '6px 10px', fontWeight: 'bold' }}>Model Name / Number</td>
                        <td style={{ border: '1px solid #94a3b8', padding: '6px 10px' }}>{formData.modelName}</td>
                      </tr>
                      <tr>
                        <td style={{ border: '1px solid #94a3b8', padding: '6px 10px', fontWeight: 'bold' }}>Device Serial Number</td>
                        <td style={{ border: '1px solid #94a3b8', padding: '6px 10px' }}>{formData.deviceSerialNo}</td>
                      </tr>
                      <tr>
                        <td style={{ border: '1px solid #94a3b8', padding: '6px 10px', fontWeight: 'bold' }}>IMEI Number</td>
                        <td style={{ border: '1px solid #94a3b8', padding: '6px 10px' }}>{formData.imei}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* 3. CONNECTIVITY & ACTIVATION DETAILS */}
                <div style={{ marginBottom: '18px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '5px', color: '#000000' }}>
                    3. CONNECTIVITY & ACTIVATION DETAILS
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #94a3b8', fontSize: '12.5px' }}>
                    <tbody>
                      <tr>
                        <td style={{ border: '1px solid #94a3b8', padding: '6px 10px', width: '45%', fontWeight: 'bold' }}>ICCID Number</td>
                        <td style={{ border: '1px solid #94a3b8', padding: '6px 10px', width: '55%' }}>{formData.iccid}</td>
                      </tr>
                      <tr>
                        <td style={{ border: '1px solid #94a3b8', padding: '6px 10px', fontWeight: 'bold' }}>SIM Service Provider</td>
                        <td style={{ border: '1px solid #94a3b8', padding: '6px 10px' }}>{formData.simProvider}</td>
                      </tr>
                      <tr>
                        <td style={{ border: '1px solid #94a3b8', padding: '6px 10px', fontWeight: 'bold' }}>SIM Validity Upto</td>
                        <td style={{ border: '1px solid #94a3b8', padding: '6px 10px' }}>
                          {formData.simValidity && formData.simValidity.toUpperCase().includes('TO')
                            ? formData.simValidity
                            : computeSimValidityRange(formData.installationDate || formData.installedDate, formData.simValidity || '1')}
                        </td>
                      </tr>
                      <tr>
                        <td style={{ border: '1px solid #94a3b8', padding: '6px 10px', fontWeight: 'bold' }}>Date of Installation</td>
                        <td style={{ border: '1px solid #94a3b8', padding: '6px 10px' }}>{formData.installationDate}</td>
                      </tr>
                      <tr>
                        <td style={{ border: '1px solid #94a3b8', padding: '6px 10px', fontWeight: 'bold' }}>Date of Activation</td>
                        <td style={{ border: '1px solid #94a3b8', padding: '6px 10px' }}>{formData.activationDate}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* 4. VLTD INSTALLATION & INTEGRATION STATEMENT */}
                <div style={{ marginBottom: '32px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '6px', color: '#000000' }}>
                    4. VLTD INSTALLATION & INTEGRATION STATEMENT
                  </div>
                  {formData.certFormat === 'telangana_mining' ? (
                    <p style={{ fontSize: '12px', lineHeight: '1.45', margin: '0 0 10px 0', color: '#000000', textAlign: 'justify' }}>
                      The Vehicle Location Tracking Device (VLTD) has been installed and activated in the above-mentioned Mining Vehicle in accordance with AIS-140 specifications and applicable statutory guidelines. The VLTD installed in this vehicle shall be integrated with the TSMDC (Telangana State Mineral Development Corporation) / Department of Mines and Geology (Government of Telangana) Portal, as directed by the Mining / Transport Authorities, for the purpose of mining vehicle tracking, safety monitoring, permit compliance, and regulatory enforcement.
                    </p>
                  ) : formData.certFormat === 'tamilnadu_mining' ? (
                    <p style={{ fontSize: '12px', lineHeight: '1.45', margin: '0 0 10px 0', color: '#000000', textAlign: 'justify' }}>
                      The Vehicle Location Tracking Device (VLTD) has been installed and activated in the above-mentioned Mining Vehicle in accordance with AIS-140 specifications and applicable statutory guidelines. The VLTD installed in this vehicle shall be integrated with the MiMaS (Mining Monitoring and Management System) Portal, as directed by the Mining / Transport Authorities, for the purpose of mining vehicle tracking, safety monitoring, permit compliance, and regulatory enforcement.
                    </p>
                  ) : (
                    <p style={{ fontSize: '12px', lineHeight: '1.45', margin: '0 0 10px 0', color: '#000000', textAlign: 'justify' }}>
                      The Vehicle Location Tracking Device (VLTD) has been installed and activated in the above-mentioned Vehicle in accordance with AIS-140 specifications and applicable statutory guidelines. The VLTD installed in this vehicle is connected with the FuelTracks Cloud Fleet Management Platform, as well as applicable national/state tracking backends as prescribed, for the purpose of vehicle location tracking, safety monitoring, permit compliance, and fleet management.
                    </p>
                  )}
                  <p style={{ fontSize: '12px', lineHeight: '1.45', margin: 0, color: '#000000', textAlign: 'justify' }}>
                    {formData.certFormat === 'normal_tracking' || formData.certFormat === 'standard_gps'
                      ? 'This certificate is issued for Vehicle VLTD fitment, compliance, and monitoring purposes, in accordance with applicable statutory guidelines.'
                      : 'This certificate is issued for Mining Vehicle VLTD compliance and monitoring purposes, in accordance with directions issued by the competent authorities.'}
                  </p>
                </div>

                {/* System Generated Certificate / Signatory Note */}
                <div style={{ textAlign: 'right', marginTop: '35px', paddingRight: '8px' }}>
                  <div style={{ fontSize: '13.5px', fontWeight: '900', color: '#000000', marginBottom: '8px', letterSpacing: '0.3px' }}>
                    For FUELTRACKS TECHNOLOGIES PRIVATE LIMITED
                  </div>
                  <div style={{ fontSize: '12px', fontStyle: 'italic', fontWeight: '600', color: '#1e293b' }}>
                    (This is a system generated certificate, hence no signature is required)
                  </div>
                </div>
              </div>
          </div>
        </div>
      </div>

      {/* Device Master Inventory Upload Modal */}
      <DeviceInventoryUploadModal
        isOpen={showInventoryModal}
        onClose={() => setShowInventoryModal(false)}
        onSuccess={() => {
          if (formData.imei || vehicle?.imei) {
            fetchDeviceInventory(formData.imei || vehicle?.imei);
          }
        }}
      />
    </div>
  );
};

export default FitmentCertificateModal;
