import React, { useRef, useState, useEffect } from 'react';
import { X, Printer, Download, Edit3, Check, RotateCcw, ExternalLink, Globe, Wifi, CheckCircle2, Copy, RefreshCw, Upload, Save, Sparkles, Image as ImageIcon, AlertCircle, FileCheck, Loader2, ClipboardPaste, Cpu, ArrowLeft } from 'lucide-react';
import * as vehicleApi from '../../api/vehicleApi';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas-pro';
import QRCode from 'qrcode';
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
    return explicitMfr.trim();
  }
  const text = `${deviceModel || ''} ${serialNo || ''}`.toUpperCase().trim();
  if (text.includes('VOLTY') || text.includes('VOL1') || text.startsWith('VOL')) {
    return 'VOLTY IOT SOLUTIONS PRIVATE LIMITED';
  }
  if (text.includes('APM') || text.includes('KINGSTRACK') || text.startsWith('APM')) {
    return 'APM KINGSTRACK PRIVATE LIMITED';
  }
  if (text.includes('TELTONIKA') || text.includes('FMC') || text.includes('FMB')) {
    return 'TELTONIKA TELEMATICS';
  }
  if (text.includes('CONCOX') || text.includes('JIMI') || text.includes('WETRACK')) {
    return 'CONCOX / JIMI IOT';
  }
  return 'APM KINGSTRACK PRIVATE LIMITED';
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

    const rawDevModel = metadata.deviceModel || veh.device_model || veh.device_version || veh.server_name || veh.model || '';
    const rawSerial = metadata.deviceSerialNo || metadata.serialNo || '';
    const resolvedMfr = resolveVltdManufacturer(rawDevModel, rawSerial, metadata.vltdManufacturer);
    const isVolty = resolvedMfr.includes('VOLTY');

    const defaultModel = isVolty ? 'VOLTY-AIS140' : '1819001A';
    const defaultSerial = isVolty
      ? (imeiLast10 ? `VOL1K2I${imeiLast10}` : 'VOL1K2I102690315456')
      : (imeiLast10 ? `APM1K2I${imeiLast10}` : 'APM1K2I102690315456');

    const modelName = metadata.modelName || metadata.deviceModel || veh.device_model || defaultModel;
    const deviceSerialNo = metadata.deviceSerialNo || metadata.serialNo || defaultSerial;

    return {
      // Certificate Format Selection: 'tamilnadu_mining' (default) | 'standard_gps'
      certFormat: metadata.certFormat || 'tamilnadu_mining',

      // Company Details
      companyName: 'FUELTRACKS TECHNOLOGIES PRIVATE LIMITED',
      vltdManufacturer: resolvedMfr,
      companyAddress: 'H.NO 17-1-382/2/2, 2nd Floor, Govt. Press Colony, Kharmanghat, R.R. Dist. - 500079',
      companyPhone: '9000666914',
      companyEmail: 'info@fueltracks.in',
      companyWeb: 'www.fueltracks.in',

      // Section 1: Vehicle Details
      vehicleNo: plate,
      vehicleCategory: metadata.vehicleCategory || 'Mining Vehicle',
      vehicleType: metadata.vehicleType || (metadata.vehicleMakeModel ? metadata.vehicleMakeModel : 'TIPPER'),
      ownerName: metadata.ownerName || metadata.customerName || veh.driver_name || veh.org_name || 'SRIKRISHNA',
      districtState: metadata.districtState || metadata.state || 'Tamil Nadu',

      // Section 2: VLTD Device Details
      modelName: modelName,
      deviceSerialNo: deviceSerialNo,
      imei: imei,

      // Section 3: Connectivity & Activation Details
      iccid: metadata.iccid || metadata.sim_number || (veh.gps_sim_no && veh.gps_sim_no.length >= 18 ? veh.gps_sim_no : '8991430008117572979F'),
      simProvider: metadata.simProvider || metadata.simOperator || 'Technojacks',
      simValidity: String(metadata.simValidity || '1'),
      installationDate: installedDate,
      activationDate: activationDate,

      // Legacy / Additional Fields Preserved for Full Compatibility
      certNumber: certNumber,
      verificationCode: computeVerificationCode(certNumber, imei, plate),
      vehicleMakeModel: metadata.vehicleMakeModel || (veh.make && veh.model ? `${veh.make} - ${veh.model}` : 'Commercial Vehicle'),
      chassisNo: metadata.chassisNo || metadata.vin || 'N/A',
      engineNo: metadata.engineNo || metadata.engine_number || 'N/A',
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
    const qs = query.toString() ? `?${query.toString()}` : '';
    return `${base}/verify/${encodeURIComponent(certNum)}${qs}`;
  };

  const generateQR = async (data, targetMode) => {
    try {
      const verifyUrl = getVerificationUrl(data, targetMode);
      const url = await QRCode.toDataURL(verifyUrl, {
        width: 200,
        margin: 1,
        errorCorrectionLevel: 'M',
        color: {
          dark: '#0f172a',
          light: '#ffffff'
        }
      });
      setQrCodeUrl(url);
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
      if (['vehicleNo', 'imei', 'certNumber'].includes(field)) {
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
                <option value="standard_gps">Standard FuelTracks GPS Fitment</option>
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
                <option value="standard_gps">Standard FuelTracks GPS Fitment</option>
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
              <label className="block text-[10px] font-bold text-slate-600 uppercase mb-0.5">VLTD Manufacturer Name</label>
              <input
                type="text"
                value={formData.vltdManufacturer || ''}
                onChange={(e) => handleInputChange('vltdManufacturer', e.target.value)}
                className="w-full px-2 py-1 bg-white border border-slate-300 rounded font-semibold text-slate-800"
              />
              <div className="flex gap-1.5 mt-1">
                <button
                  type="button"
                  onClick={() => {
                    handleInputChange('vltdManufacturer', 'APM KINGSTRACK PRIVATE LIMITED');
                    if (!formData.modelName || formData.modelName === 'VOLTY-AIS140') handleInputChange('modelName', '1819001A');
                    if (!formData.deviceSerialNo || formData.deviceSerialNo.startsWith('VOL')) handleInputChange('deviceSerialNo', `APM1K2I${imeiLast10 || '102690315456'}`);
                  }}
                  className="text-[9px] bg-slate-100 hover:bg-slate-200 px-1.5 py-0.5 rounded text-slate-700 border"
                >
                  APM
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleInputChange('vltdManufacturer', 'VOLTY IOT SOLUTIONS PRIVATE LIMITED');
                    if (!formData.modelName || formData.modelName === '1819001A') handleInputChange('modelName', 'VOLTY-AIS140');
                    if (!formData.deviceSerialNo || formData.deviceSerialNo.startsWith('APM')) handleInputChange('deviceSerialNo', `VOL1K2I${imeiLast10 || '102690315456'}`);
                  }}
                  className="text-[9px] bg-slate-100 hover:bg-slate-200 px-1.5 py-0.5 rounded text-slate-700 border"
                >
                  Volty
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
              <label className="block text-[10px] font-bold text-slate-600 uppercase mb-0.5">SIM Validity (years)</label>
              <input
                type="text"
                value={formData.simValidity || ''}
                onChange={(e) => handleInputChange('simValidity', e.target.value)}
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
            {formData.certFormat === 'standard_gps' ? (
              /* Standard FuelTracks GPS Fitment Layout */
              <div>
                {/* 5% Background Watermark */}
                <div
                  className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden"
                  style={{ zIndex: 0 }}
                >
                  <div
                    style={{
                      transform: 'rotate(-28deg)',
                      fontSize: '44px',
                      fontWeight: '900',
                      color: '#0f172a',
                      opacity: 0.05,
                      whiteSpace: 'nowrap',
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase'
                    }}
                  >
                    FUELTRACKS GPS TRACKING
                  </div>
                </div>

                {/* Document Body */}
                <div className="relative z-10 text-[11px]">
                  {/* Header with Logo, Company Details and QR Code */}
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-3" style={{ maxWidth: '580px' }}>
                      <img
                        src={activeLogoSrc}
                        alt="FuelTracks Logo"
                        style={{
                          width: '110px',
                          height: 'auto',
                          maxHeight: '46px',
                          objectFit: 'contain',
                          flexShrink: 0,
                          display: 'block'
                        }}
                      />
                      <div>
                        <div style={{ fontWeight: '900', fontSize: '15px', color: '#0f172a', letterSpacing: '0.01em' }}>
                          {formData.companyName}
                        </div>
                        <div style={{ fontSize: '9.8px', color: '#334155', lineHeight: '1.3', marginTop: '1px' }}>
                          {formData.companyAddress}<br />
                          Phone: <strong className="text-slate-900">{formData.companyPhone}</strong> | Web: <strong className="text-slate-900">{formData.companyWeb}</strong> | Email: <strong className="text-slate-900">{formData.companyEmail}</strong>
                        </div>
                      </div>
                    </div>

                    {/* QR Code */}
                    <div style={{ width: '96px', textAlign: 'center', flexShrink: 0 }}>
                      {qrCodeUrl ? (
                        <img
                          src={qrCodeUrl}
                          alt="Scan to verify"
                          style={{ width: '88px', height: '88px', display: 'block', margin: '0 auto', border: '1px solid #cbd5e1', padding: '3px', background: '#ffffff', borderRadius: '4px' }}
                        />
                      ) : (
                        <div style={{ width: '88px', height: '88px', border: '1px dashed #cbd5e1', margin: '0 auto' }} />
                      )}
                      <div style={{ fontSize: '8.5px', color: '#0f172a', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: '3px' }}>
                        Scan to verify
                      </div>
                    </div>
                  </div>

                  {/* Thick Divider Rule */}
                  <div style={{ height: '2px', background: '#0f172a', marginBottom: '6px' }}></div>

                  {/* Title Bar & Certificate Number */}
                  <div className="flex justify-between items-end border-b border-slate-300 pb-1.5 mb-2">
                    <div>
                      <div className="text-[14px] font-black uppercase tracking-wider text-slate-900">
                        CERTIFICATE OF GPS FITMENT
                      </div>
                      <div className="text-[9.5px] text-slate-500 font-semibold">
                        GPS Tracking Device Installation
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[8.5px] text-slate-500 uppercase font-bold">Certificate Number</div>
                      <div className="text-[12px] font-mono font-black text-slate-900 whitespace-nowrap">{formData.certNumber}</div>
                    </div>
                  </div>

                  {/* Opening Statement */}
                  <div className="bg-slate-50 border-l-2 border-slate-900 p-1.5 text-[9.5px] text-slate-700 leading-tight mb-2">
                    This is to certify that a GPS tracking device has been fitted in the vehicle described below. It was checked, sealed and found working at the time of installation.
                  </div>

                  {/* Section 1: Vehicle Details */}
                  <div className="mb-2">
                    <div className="text-[10px] font-black uppercase tracking-wider text-slate-900 bg-slate-100 px-2 py-0.5 rounded border-l-2 border-slate-800 mb-1">
                      1. VEHICLE DETAILS
                    </div>
                    <table className="w-full border-collapse border border-slate-300 bg-white table-fixed text-[10.5px]">
                      <tbody>
                        <tr>
                          <td className="border border-slate-200 p-1.5 w-1/2">
                            <span className="block text-[8.5px] font-bold text-slate-600 uppercase mb-0.5">Vehicle Registration No.</span>
                            <span className="font-black text-slate-950 text-[13px]">{formData.vehicleNo}</span>
                          </td>
                          <td className="border border-slate-200 p-1.5 w-1/2">
                            <span className="block text-[8.5px] font-bold text-slate-600 uppercase mb-0.5">Make &amp; Model</span>
                            <span className="font-bold text-slate-900">{formData.vehicleMakeModel}</span>
                          </td>
                        </tr>
                        <tr>
                          <td className="border border-slate-200 p-1.5">
                            <span className="block text-[8.5px] font-bold text-slate-600 uppercase mb-0.5">Chassis Number</span>
                            <span className="font-mono font-bold text-slate-900 text-[11px]">{formData.chassisNo}</span>
                          </td>
                          <td className="border border-slate-200 p-1.5">
                            <span className="block text-[8.5px] font-bold text-slate-600 uppercase mb-0.5">Engine Number</span>
                            <span className="font-mono font-bold text-slate-900 text-[11px]">{formData.engineNo}</span>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Section 2: Customer Details */}
                  <div className="mb-2">
                    <div className="text-[10px] font-black uppercase tracking-wider text-slate-900 bg-slate-100 px-2 py-0.5 rounded border-l-2 border-slate-800 mb-1">
                      2. CUSTOMER DETAILS
                    </div>
                    <table className="w-full border-collapse border border-slate-300 bg-white table-fixed text-[10.5px]">
                      <tbody>
                        <tr>
                          <td className="border border-slate-200 p-1.5 w-1/2">
                            <span className="block text-[8.5px] font-bold text-slate-600 uppercase mb-0.5">Customer Name</span>
                            <span className="font-black text-slate-900">{formData.ownerName || formData.customerName}</span>
                          </td>
                          <td className="border border-slate-200 p-1.5 w-1/2">
                            <span className="block text-[8.5px] font-bold text-slate-600 uppercase mb-0.5">Customer Phone Number</span>
                            <span className="font-bold text-slate-900">{formData.phone}</span>
                          </td>
                        </tr>
                        <tr>
                          <td colSpan="2" className="border border-slate-200 p-1.5">
                            <span className="block text-[8.5px] font-bold text-slate-600 uppercase mb-0.5">Customer Full Address</span>
                            <div className="font-semibold text-slate-800 leading-tight text-[10px] whitespace-normal">
                              {formData.customerAddress}
                            </div>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Section 3: GPS Device Details */}
                  <div className="mb-2">
                    <div className="text-[10px] font-black uppercase tracking-wider text-slate-900 bg-slate-100 px-2 py-0.5 rounded border-l-2 border-slate-800 mb-1">
                      3. GPS DEVICE DETAILS
                    </div>
                    <table className="w-full border-collapse border border-slate-300 bg-white table-fixed text-[10.5px]">
                      <tbody>
                        <tr>
                          <td className="border border-slate-200 p-1.5 w-1/2">
                            <span className="block text-[8.5px] font-bold text-slate-600 uppercase mb-0.5">Device Model</span>
                            <span className="font-bold text-slate-900">{formData.modelName || formData.deviceModel}</span>
                          </td>
                          <td className="border border-slate-200 p-1.5 w-1/2">
                            <span className="block text-[8.5px] font-bold text-slate-600 uppercase mb-0.5">IMEI Number</span>
                            <span className="font-mono font-black text-slate-950 text-[11.5px]">{formData.imei}</span>
                          </td>
                        </tr>
                        <tr>
                          <td className="border border-slate-200 p-1.5">
                            <span className="block text-[8.5px] font-bold text-slate-600 uppercase mb-0.5">GPS SIM 1 Number / ICCID</span>
                            <span className="font-mono font-bold text-slate-900">{formData.iccid || formData.simNumber}</span>
                          </td>
                          <td className="border border-slate-200 p-1.5">
                            <span className="block text-[8.5px] font-bold text-slate-600 uppercase mb-0.5">SIM Operator</span>
                            <span className="font-bold text-slate-900">{formData.simProvider || formData.simOperator}</span>
                          </td>
                        </tr>
                        <tr>
                          <td className="border border-slate-200 p-1.5">
                            <span className="block text-[8.5px] font-bold text-slate-600 uppercase mb-0.5">Fitment Location in Vehicle</span>
                            <span className="font-bold text-slate-900">{formData.fitmentLocation}</span>
                          </td>
                          <td className="border border-slate-200 p-1.5">
                            <span className="block text-[8.5px] font-bold text-slate-600 uppercase mb-0.5">Seal Number (if used)</span>
                            <span className="font-mono font-bold text-slate-900">{formData.sealNumber}</span>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Section 4: Installation Checks */}
                  <div className="mb-2">
                    <div className="text-[10px] font-black uppercase tracking-wider text-slate-900 bg-slate-100 px-2 py-0.5 rounded border-l-2 border-slate-800 mb-1">
                      4. INSTALLATION CHECKS
                    </div>
                    <table className="w-full border-collapse border border-slate-300 text-[9px]">
                      <thead>
                        <tr className="bg-slate-50 text-slate-700 font-bold uppercase text-[8px]">
                          <th className="border border-slate-200 p-1 text-left w-[35%]">Installation Check</th>
                          <th className="border border-slate-200 p-1 text-center w-[15%]">Result</th>
                          <th className="border border-slate-200 p-1 text-left w-[35%]">Installation Check</th>
                          <th className="border border-slate-200 p-1 text-center w-[15%]">Result</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className="border border-slate-200 p-1 text-slate-800 font-medium">1. GPS Signal &amp; Satellite Fix</td>
                          <td className="border border-slate-200 p-1 text-center"><span className="text-emerald-700 font-black bg-emerald-100 px-1.5 py-0.5 rounded text-[8px]">✔ PASS</span></td>
                          <td className="border border-slate-200 p-1 text-slate-800 font-medium">4. Ignition Detection</td>
                          <td className="border border-slate-200 p-1 text-center"><span className="text-emerald-700 font-black bg-emerald-100 px-1.5 py-0.5 rounded text-[8px]">✔ PASS</span></td>
                        </tr>
                        <tr>
                          <td className="border border-slate-200 p-1 text-slate-800 font-medium">2. Cellular Network Signal</td>
                          <td className="border border-slate-200 p-1 text-center"><span className="text-emerald-700 font-black bg-emerald-100 px-1.5 py-0.5 rounded text-[8px]">✔ PASS</span></td>
                          <td className="border border-slate-200 p-1 text-slate-800 font-medium">5. Data Reaching the Platform</td>
                          <td className="border border-slate-200 p-1 text-center"><span className="text-emerald-700 font-black bg-emerald-100 px-1.5 py-0.5 rounded text-[8px]">✔ PASS</span></td>
                        </tr>
                        <tr>
                          <td className="border border-slate-200 p-1 text-slate-800 font-medium">3. Main Power Connection</td>
                          <td className="border border-slate-200 p-1 text-center"><span className="text-emerald-700 font-black bg-emerald-100 px-1.5 py-0.5 rounded text-[8px]">✔ PASS</span></td>
                          <td className="border border-slate-200 p-1 text-slate-500 font-medium italic">All Hardware Pre-Checks</td>
                          <td className="border border-slate-200 p-1 text-center"><span className="text-emerald-700 font-black bg-emerald-100 px-1.5 py-0.5 rounded text-[8px]">✔ PASS</span></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Section 5: Installation & Validity */}
                  <div className="mb-2">
                    <div className="text-[10px] font-black uppercase tracking-wider text-slate-900 bg-slate-100 px-2 py-0.5 rounded border-l-2 border-slate-800 mb-1">
                      5. INSTALLATION &amp; VALIDITY
                    </div>
                    <table className="w-full border-collapse border border-slate-300 bg-white table-fixed text-[10.5px]">
                      <tbody>
                        <tr>
                          <td className="border border-slate-200 p-1.5 w-1/3">
                            <span className="block text-[8.5px] font-bold text-slate-600 uppercase mb-0.5">Installation Date (DD-MM-YYYY)</span>
                            <span className="font-mono font-bold text-slate-950 text-[11.5px]">{formData.installationDate || formData.installedDate}</span>
                          </td>
                          <td className="border border-slate-200 p-1.5 w-1/3">
                            <span className="block text-[8.5px] font-bold text-slate-600 uppercase mb-0.5">Certificate Issue Date</span>
                            <span className="font-mono font-bold text-slate-950 text-[11.5px]">{formData.certIssuedDate}</span>
                          </td>
                          <td className="border border-slate-200 p-1.5 w-1/3">
                            <span className="block text-[8.5px] font-bold text-slate-600 uppercase mb-0.5">Service / Validity Expiry Date</span>
                            <span className="font-mono font-bold text-slate-950 text-[11.5px]">{formData.expiryDate}</span>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Computer-Generated Certificate Authenticity Banner */}
                  <div className="bg-slate-100 border border-slate-300 p-1.5 rounded text-center text-[9.5px] font-semibold text-slate-800 mb-2">
                    ✔ This is a computer-generated certificate and does not require a signature.
                  </div>

                  {/* Footer */}
                  <div className="border-t border-slate-300 pt-1 flex justify-between items-center text-[8.5px] text-slate-600">
                    <div className="max-w-[500px] leading-tight">
                      <strong className="text-slate-800">Validity Note:</strong> The validity date may differ from the installation date because the SIM in the device may have been activated earlier.
                    </div>
                    <div className="text-right">
                      <div className="text-[7.5px] font-bold text-slate-500 uppercase">Verification Code:</div>
                      <div className="font-mono font-black text-slate-900 text-[10px]">{formData.verificationCode}</div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* TAMILNADU MINING VEHICLE VLTD FITMENT CERTIFICATE (EXACT REQUESTED FORMAT) */
              <div style={{ color: '#000000' }}>
                {/* Header Titles */}
                <div style={{ textAlign: 'center', marginBottom: '22px' }}>
                  <h1 style={{ fontSize: '18px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.01em', margin: 0, color: '#000000' }}>
                    VEHICLE LOCATION TRACKING DEVICE (VLTD)
                  </h1>
                  <h2 style={{ fontSize: '15px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.01em', marginTop: '4px', margin: 0, color: '#000000' }}>
                    FITMENT CERTIFICATE – TAMILNADU MINING VEHICLE
                  </h2>
                  <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#1e3a8a', textTransform: 'uppercase', marginTop: '6px', letterSpacing: '0.5px' }}>
                    Issued by Authorized Fitment Agency: FUELTRACKS TECHNOLOGIES PRIVATE LIMITED
                  </div>
                </div>

                {/* Opening Paragraph */}
                <p style={{ fontSize: '12.5px', lineHeight: '1.45', margin: '0 0 18px 0', color: '#000000' }}>
                  This is to certify that the Vehicle Location Tracking Device (VLTD) compliant with Automotive Industry Standard (AIS-140), as prescribed under the Central Motor Vehicle Rules, has been installed and activated in the below mentioned Mining Vehicle
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
                        <td style={{ border: '1px solid #94a3b8', padding: '6px 10px', fontWeight: 'bold' }}>SIM Validity Upto (years)</td>
                        <td style={{ border: '1px solid #94a3b8', padding: '6px 10px' }}>{formData.simValidity}</td>
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
                  <p style={{ fontSize: '12px', lineHeight: '1.45', margin: '0 0 10px 0', color: '#000000', textAlign: 'justify' }}>
                    The Vehicle Location Tracking Device (VLTD) has been installed and activated in the above-mentioned Mining Vehicle in accordance with AIS-140 specifications and applicable statutory guidelines. The VLTD installed in this vehicle shall be integrated with the MiMaS (Mining Monitoring and Management System) Portal, as directed by the Mining / Transport Authorities, for the purpose of mining vehicle tracking, safety monitoring, permit compliance, and regulatory enforcement.
                  </p>
                  <p style={{ fontSize: '12px', lineHeight: '1.45', margin: 0, color: '#000000', textAlign: 'justify' }}>
                    This certificate is issued for Mining Vehicle VLTD compliance and monitoring purposes, in accordance with directions issued by the competent authorities.
                  </p>
                </div>

                {/* Authorized Signatory */}
                <div style={{ textAlign: 'right', marginTop: '35px', paddingRight: '8px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#000000', marginBottom: '35px' }}>
                    For FUELTRACKS TECHNOLOGIES PRIVATE LIMITED
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#000000' }}>
                    Authorized Signatory
                  </div>
                </div>
              </div>
            )}
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
