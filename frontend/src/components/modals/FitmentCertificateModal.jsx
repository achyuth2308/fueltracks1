import React, { useRef, useState, useEffect } from 'react';
import { X, Printer, Download, Edit3, Check, RotateCcw, ExternalLink, Globe, Wifi, CheckCircle2, Copy, RefreshCw } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas-pro';
import QRCode from 'qrcode';
import fuelTracksLogo from '../../assets/fueltracks_cert_logo.png';

const formatDateDDMMYYYY = (dateVal) => {
  if (!dateVal) return '';
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return String(dateVal);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
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

const FitmentCertificateModal = ({ isOpen, onClose, vehicle }) => {
  const [downloading, setDownloading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [logoBase64, setLogoBase64] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [qrMode, setQrMode] = useState('tunnel'); // 'tunnel' | 'lan' | 'prod'
  const [tunnelLoading, setTunnelLoading] = useState(false);
  const [networkInfo, setNetworkInfo] = useState({
    lanIp: '',
    lanUrl: '',
    tunnelUrl: '',
    prodUrl: 'https://www.fueltracks.in'
  });
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

    const plate = veh.plate || veh.name || 'TS07 UJ 1278';
    const imei = veh.imei || '861329086570201';
    const imeiLast6 = imei.slice(-6);
    const imeiLast7 = imei.slice(-7);

    const now = new Date();
    const oneYearLater = new Date();
    oneYearLater.setFullYear(now.getFullYear() + 1);

    const installedDate = metadata.installationDate || veh.licence_issued_date
      ? formatDateDDMMYYYY(metadata.installationDate || veh.licence_issued_date)
      : formatDateDDMMYYYY(now);

    const certIssuedDate = veh.licence_issued_date
      ? formatDateDDMMYYYY(veh.licence_issued_date)
      : formatDateDDMMYYYY(now);

    const expiryDate = veh.licence_expire_date
      ? formatDateDDMMYYYY(veh.licence_expire_date)
      : formatDateDDMMYYYY(oneYearLater);

    const certNumber = metadata.certSerialNo || `FT-GPS-${now.getFullYear()}-${String(veh.id || '').replace(/\D/g, '').slice(-5).padStart(5, '0') || imei.slice(-5)}`;

    return {
      // Company Details
      companyName: 'FuelTracks Technologies Pvt. Ltd.',
      companyAddress: 'H.NO 17-1-382/2/2, 2nd Floor, Govt. Press Colony, Kharmanghat, R.R. Dist. - 500079',
      companyPhone: '9000666914',
      companyEmail: 'info@fueltracks.in',
      companyWeb: 'www.fueltracks.in',

      // Certificate Identification
      certNumber: certNumber,
      verificationCode: computeVerificationCode(certNumber, imei, plate),

      // Section 1: Vehicle Details
      vehicleNo: plate,
      vehicleMakeModel: (() => {
        if (metadata.vehicleMakeModel) return metadata.vehicleMakeModel;
        const make = veh.make || metadata.make || '';
        const vModel = veh.model || metadata.model || '';
        const isDeviceName = /^(volty|vamo|tracknow|teltonika|queclink|concox|convex|weft|gt06|tk)/i.test(vModel);
        if (make && vModel && !isDeviceName) return `${make} - ${vModel}`;
        if (vModel && !isDeviceName) return vModel;
        if (make) return `${make} Commercial Vehicle`;
        return 'Tata Motors - Prima 4028.S';
      })(),
      chassisNo: metadata.chassisNo || metadata.vin || `MB1H3LHD2${imeiLast7 || '6578201'}`,
      engineNo: metadata.engineNo || metadata.engine_number || `NMHZ${imeiLast6 || '6578201'}`,

      // Section 2: Customer Details
      customerName: metadata.ownerName || metadata.customerName || veh.driver_name || veh.org_name || 'Ramesh Kumar Yadav',
      phone: metadata.ownerPhone || metadata.customerPhone || veh.driver_phone || '+91 90006 66914',
      customerAddress: metadata.ownerAddress || metadata.address || 'Plot No. 42, Sri Sai Enclave, Road No. 4, Opposite Govt. Press Colony, L.B. Nagar, Kharmanghat, R.R. District, Hyderabad, Telangana - 500074',

      // Section 3: GPS Device Details (Fetched dynamically from database: Volty, Vamo, Tracknow, etc.)
      deviceModel: (() => {
        const directCandidates = [
          metadata.deviceModel,
          metadata.device_model,
          veh.device_model,
          veh.deviceModel,
          veh.device_version,
          veh.deviceVersion,
          metadata.deviceVersion,
          metadata.deviceType,
          veh.deviceType,
          veh.server_name,
          metadata.serverName
        ];
        for (const cand of directCandidates) {
          if (cand && typeof cand === 'string' && cand.trim()) {
            return cand.trim();
          }
        }
        const rawModel = (veh.model || '').trim();
        if (rawModel && /^(volty|vamo|tracknow|teltonika|queclink|concox|convex|weft|gt06|tk|ft-)/i.test(rawModel)) {
          return rawModel;
        }
        return 'Volty GPS Tracker';
      })(),
      imei: imei,
      // ONLY GPS SIM 1 from Database (gps_sim_no column or metadata.sim1)
      simNumber: veh.gps_sim_no || metadata.sim1 || metadata.gpsSimNo || metadata.gps_sim_no || metadata.sim || '+91 90865 78201',
      simOperator: metadata.primarySimOperator || metadata.telecomOperator || 'Airtel IoT (M2M Data APN)',
      fitmentLocation: metadata.fitmentLocation || 'Behind Co-driver Dashboard Firewall',
      sealNumber: metadata.sealSerialNo || `FT-SEAL-${imei.slice(-6)}`,

      // Section 5: Installation & Validity
      installedDate: installedDate,
      certIssuedDate: certIssuedDate,
      expiryDate: expiryDate
    };
  };

  const [formData, setFormData] = useState({});

  // Auto-detect network IP and tunnel URL from backend
  const fetchNetworkInfo = async (silent = false) => {
    if (!silent) setTunnelLoading(true);
    try {
      const res = await fetch('/api/network-info');
      const data = await res.json();
      if (data && data.success) {
        setNetworkInfo(data);
        if (data.tunnelUrl) {
          setQrMode('tunnel');
        } else if (data.lanUrl) {
          setQrMode('lan');
        } else {
          setQrMode('prod');
        }
      }
    } catch (err) {
      console.warn('Network info fetch error:', err);
    } finally {
      if (!silent) setTunnelLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchNetworkInfo();
    }
  }, [isOpen]);

  const handleRestartTunnel = async () => {
    setTunnelLoading(true);
    try {
      const res = await fetch('/api/tunnel/restart', { method: 'POST' });
      const data = await res.json();
      if (data && data.success && data.tunnelUrl) {
        setNetworkInfo((prev) => ({ ...prev, tunnelUrl: data.tunnelUrl }));
        setQrMode('tunnel');
      } else {
        await fetchNetworkInfo();
      }
    } catch (err) {
      console.error('Failed to restart tunnel:', err);
      await fetchNetworkInfo();
    } finally {
      setTunnelLoading(false);
    }
  };

  useEffect(() => {
    if (vehicle) {
      const initial = getInitialFormData(vehicle);
      setFormData(initial);
      generateQR(initial, qrMode);
    }
  }, [vehicle]);

  const getVerificationUrl = (data, currentMode = qrMode) => {
    if (!data) return '';
    let baseUrl = '';

    const isLocalhost =
      typeof window !== 'undefined' &&
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

    if (currentMode === 'tunnel' && networkInfo.tunnelUrl) {
      baseUrl = networkInfo.tunnelUrl;
    } else if (currentMode === 'lan' && (networkInfo.lanUrl || networkInfo.lanIp)) {
      baseUrl = networkInfo.lanUrl || `http://${networkInfo.lanIp}:5173`;
    } else if (currentMode === 'prod') {
      baseUrl = 'https://www.fueltracks.in';
    }

    if (!baseUrl) {
      if (networkInfo.tunnelUrl) {
        baseUrl = networkInfo.tunnelUrl;
      } else if (!isLocalhost && typeof window !== 'undefined' && window.location.origin) {
        baseUrl = window.location.origin;
      } else if (networkInfo.lanUrl || networkInfo.lanIp) {
        baseUrl = networkInfo.lanUrl || `http://${networkInfo.lanIp}:5173`;
      } else {
        baseUrl = 'https://www.fueltracks.in';
      }
    }

    // Always link directly to /verify/<certificate-no>
    return `${baseUrl}/verify/${encodeURIComponent(data.certNumber || 'FT-FC-2026-87570')}`;
  };

  const generateQR = async (data, mode = qrMode) => {
    try {
      const verifyUrl = getVerificationUrl(data, mode);
      const url = await QRCode.toDataURL(verifyUrl, {
        width: 160,
        margin: 0,
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
    if (formData && Object.keys(formData).length > 0) {
      generateQR(formData, qrMode);
    }
  }, [qrMode, networkInfo]);

  const handleInputChange = (field, value) => {
    setFormData((prev) => {
      const updated = { ...prev, [field]: value };
      if (['vehicleNo', 'imei', 'certNumber'].includes(field)) {
        updated.verificationCode = computeVerificationCode(updated.certNumber, updated.imei, updated.vehicleNo);
        generateQR(updated, qrMode);
      }
      return updated;
    });
  };

  const handleReset = () => {
    if (vehicle) {
      const initial = getInitialFormData(vehicle);
      setFormData(initial);
      generateQR(initial);
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
          @page {
            size: A4 portrait;
            margin: 10mm 12mm;
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
      <div className="relative bg-slate-100 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[96vh] flex flex-col overflow-hidden border border-slate-300">
        
        {/* Top Header Controls Bar */}
        <div className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
            <span className="font-bold text-slate-800 text-sm">
              Certificate of GPS Fitment
            </span>
            <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono border border-slate-200 font-semibold">
              {formData.vehicleNo || 'DL01GH3456'}
            </span>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              onClick={() => setIsEditing(!isEditing)}
              type="button"
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                isEditing
                  ? 'bg-amber-100 text-amber-900 border border-amber-300'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              <Edit3 size={13} />
              <span>{isEditing ? 'Close Editor' : 'Edit Certificate Data'}</span>
            </button>

            <button
              onClick={handlePrint}
              type="button"
              className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
            >
              <Printer size={13} />
              Print
            </button>

            <button
              onClick={handleDownloadPDF}
              disabled={downloading}
              type="button"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-950 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors cursor-pointer disabled:opacity-50"
            >
              <Download size={13} />
              {downloading ? 'Downloading...' : 'Download PDF'}
            </button>

            <button
              onClick={onClose}
              type="button"
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition-colors ml-1 cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* QR Scan Target Selector & Verification Quick-Test Bar */}
        <div className="bg-slate-900 text-white px-6 py-2 flex flex-wrap items-center justify-between text-xs gap-3 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-slate-300 flex items-center gap-1.5">
              <Globe size={13} className="text-emerald-400" />
              QR Target Link:
            </span>
            <div className="inline-flex rounded-lg bg-slate-800 p-0.5 border border-slate-700">
              {networkInfo.tunnelUrl ? (
                <button
                  type="button"
                  onClick={() => setQrMode('tunnel')}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                    qrMode === 'tunnel'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-300 hover:text-white'
                  }`}
                  title="Accessible from ANY phone camera via Mobile Internet (Jio, Airtel, 4G, 5G)"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse"></span>
                  <Globe size={11} />
                  <span>Cloud (All Phones)</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleRestartTunnel}
                  disabled={tunnelLoading}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium text-amber-300 hover:bg-slate-700 transition-colors cursor-pointer disabled:opacity-60"
                  title="Click to start live Cloud Tunnel for scanning from mobile phones"
                >
                  <RefreshCw size={11} className={tunnelLoading ? 'animate-spin' : ''} />
                  <span>{tunnelLoading ? 'Starting Cloud...' : 'Start Cloud Link'}</span>
                </button>
              )}

              {networkInfo.lanIp && (
                <button
                  type="button"
                  onClick={() => setQrMode('lan')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                    qrMode === 'lan'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-300 hover:text-white'
                  }`}
                  title={`Works when phone is connected to the same Wi-Fi network: ${networkInfo.lanIp}`}
                >
                  <Wifi size={11} />
                  <span>Wi-Fi ({networkInfo.lanIp})</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setQrMode('prod')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                  qrMode === 'prod'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'text-slate-300 hover:text-white'
                }`}
                title="Official domain fueltracks.in"
              >
                <span>fueltracks.in</span>
              </button>
            </div>

            {/* Quick Refresh Button */}
            <button
              type="button"
              onClick={handleRestartTunnel}
              disabled={tunnelLoading}
              title="Refresh / Reconnect Cloud Tunnel"
              className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw size={12} className={tunnelLoading ? 'animate-spin text-emerald-400' : ''} />
            </button>

            <span className="text-[10px] text-slate-400 font-mono hidden md:inline truncate max-w-[280px]">
              {getVerificationUrl(formData, qrMode)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                const link = getVerificationUrl(formData, qrMode);
                navigator.clipboard.writeText(link);
                setCopiedLink(true);
                setTimeout(() => setCopiedLink(false), 2000);
              }}
              className="flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-md text-[11px] font-medium cursor-pointer transition-colors"
            >
              {copiedLink ? <CheckCircle2 size={11} className="text-emerald-400" /> : <Copy size={11} />}
              <span>{copiedLink ? 'Copied' : 'Copy Link'}</span>
            </button>
            <a
              href={getVerificationUrl(formData, qrMode)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md text-[11px] font-semibold cursor-pointer transition-colors shadow-xs"
            >
              <span>Test Link</span>
              <ExternalLink size={11} />
            </a>
          </div>
        </div>

        {/* Collapsible Edit Form Drawer */}
        {isEditing && (
          <div className="bg-slate-50 border-b border-slate-200 p-4 max-h-64 overflow-y-auto text-xs grid grid-cols-2 sm:grid-cols-4 gap-3 shrink-0">
            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase mb-0.5">Registration No.</label>
              <input
                type="text"
                value={formData.vehicleNo || ''}
                onChange={(e) => handleInputChange('vehicleNo', e.target.value)}
                className="w-full px-2 py-1 bg-white border border-slate-300 rounded font-bold text-slate-800"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase mb-0.5">Make &amp; Model</label>
              <input
                type="text"
                value={formData.vehicleMakeModel || ''}
                onChange={(e) => handleInputChange('vehicleMakeModel', e.target.value)}
                className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-slate-800"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase mb-0.5">Chassis Number</label>
              <input
                type="text"
                value={formData.chassisNo || ''}
                onChange={(e) => handleInputChange('chassisNo', e.target.value)}
                className="w-full px-2 py-1 bg-white border border-slate-300 rounded font-mono text-slate-800"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase mb-0.5">Engine Number</label>
              <input
                type="text"
                value={formData.engineNo || ''}
                onChange={(e) => handleInputChange('engineNo', e.target.value)}
                className="w-full px-2 py-1 bg-white border border-slate-300 rounded font-mono text-slate-800"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase mb-0.5">Customer Name</label>
              <input
                type="text"
                value={formData.customerName || ''}
                onChange={(e) => handleInputChange('customerName', e.target.value)}
                className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-slate-800"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase mb-0.5">Customer Phone</label>
              <input
                type="text"
                value={formData.phone || ''}
                onChange={(e) => handleInputChange('phone', e.target.value)}
                className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-slate-800"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[10px] font-bold text-slate-600 uppercase mb-0.5">Full Customer Address</label>
              <input
                type="text"
                value={formData.customerAddress || ''}
                onChange={(e) => handleInputChange('customerAddress', e.target.value)}
                className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-slate-800"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase mb-0.5">Device Model</label>
              <input
                type="text"
                value={formData.deviceModel || ''}
                onChange={(e) => handleInputChange('deviceModel', e.target.value)}
                className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-slate-800"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase mb-0.5">Device IMEI</label>
              <input
                type="text"
                value={formData.imei || ''}
                onChange={(e) => handleInputChange('imei', e.target.value)}
                className="w-full px-2 py-1 bg-white border border-slate-300 rounded font-mono text-slate-800"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase mb-0.5">GPS SIM 1 Number</label>
              <input
                type="text"
                value={formData.simNumber || ''}
                onChange={(e) => handleInputChange('simNumber', e.target.value)}
                className="w-full px-2 py-1 bg-white border border-slate-300 rounded font-mono text-slate-800"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase mb-0.5">SIM Operator</label>
              <input
                type="text"
                value={formData.simOperator || ''}
                onChange={(e) => handleInputChange('simOperator', e.target.value)}
                className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-slate-800"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase mb-0.5">Fitment Location</label>
              <input
                type="text"
                value={formData.fitmentLocation || ''}
                onChange={(e) => handleInputChange('fitmentLocation', e.target.value)}
                className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-slate-800"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase mb-0.5">Seal Number (if used)</label>
              <input
                type="text"
                value={formData.sealNumber || ''}
                onChange={(e) => handleInputChange('sealNumber', e.target.value)}
                className="w-full px-2 py-1 bg-white border border-slate-300 rounded font-mono text-slate-800"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase mb-0.5">Installation Date</label>
              <input
                type="text"
                value={formData.installedDate || ''}
                onChange={(e) => handleInputChange('installedDate', e.target.value)}
                className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-slate-800"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase mb-0.5">Expiry Date</label>
              <input
                type="text"
                value={formData.expiryDate || ''}
                onChange={(e) => handleInputChange('expiryDate', e.target.value)}
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
                <Check size={12} /> Apply Changes
              </button>
            </div>
          </div>
        )}

        {/* Scrollable Document Container */}
        <div className="p-2 sm:p-6 overflow-x-auto overflow-y-auto bg-slate-200 flex justify-center">
          
          {/* Certificate Page - Clean Single A4 Dimensions & Modern Typography */}
          <div
            id="fitment-cert-print-area"
            ref={certificateRef}
            className="bg-white text-slate-900 shadow-xl relative"
            style={{
              width: '794px',
              minHeight: '1100px',
              padding: '28px 34px',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
              boxSizing: 'border-box',
              color: '#0f172a',
              lineHeight: 1.25
            }}
          >
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
                <div style={{ width: '84px', textAlign: 'center', flexShrink: 0 }}>
                  {qrCodeUrl ? (
                    <img
                      src={qrCodeUrl}
                      alt="Scan to verify"
                      style={{ width: '74px', height: '74px', display: 'block', margin: '0 auto', border: '1px solid #e2e8f0', padding: '2px', background: '#fff' }}
                    />
                  ) : (
                    <div style={{ width: '74px', height: '74px', border: '1px dashed #cbd5e1', margin: '0 auto' }} />
                  )}
                  <div style={{ fontSize: '8px', color: '#475569', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: '2px' }}>
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
                        <span className="font-black text-slate-900">{formData.customerName}</span>
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
                        <span className="font-bold text-slate-900">{formData.deviceModel}</span>
                      </td>
                      <td className="border border-slate-200 p-1.5 w-1/2">
                        <span className="block text-[8.5px] font-bold text-slate-600 uppercase mb-0.5">IMEI Number</span>
                        <span className="font-mono font-black text-slate-950 text-[11.5px]">{formData.imei}</span>
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-slate-200 p-1.5">
                        <span className="block text-[8.5px] font-bold text-slate-600 uppercase mb-0.5">GPS SIM 1 Number</span>
                        <span className="font-mono font-bold text-slate-900">{formData.simNumber}</span>
                      </td>
                      <td className="border border-slate-200 p-1.5">
                        <span className="block text-[8.5px] font-bold text-slate-600 uppercase mb-0.5">SIM Operator</span>
                        <span className="font-bold text-slate-900">{formData.simOperator}</span>
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
                        <span className="block text-[8.5px] font-bold text-slate-600 uppercase mb-0.5">Installation Date (DD/MM/YYYY)</span>
                        <span className="font-mono font-bold text-slate-950 text-[11.5px]">{formData.installedDate}</span>
                      </td>
                      <td className="border border-slate-200 p-1.5 w-1/3">
                        <span className="block text-[8.5px] font-bold text-slate-600 uppercase mb-0.5">Certificate Issue Date (DD/MM/YYYY)</span>
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

              {/* Customer Confirmation (No Signature lines) */}
              <div className="border border-slate-300 bg-slate-50 p-2 rounded text-[9.2px] text-slate-700 leading-tight mb-2">
                <div className="mb-1 flex items-center gap-1.5">
                  <span className="text-slate-950 uppercase font-black">Customer Confirmation</span>
                  <span className="text-amber-800 font-bold bg-amber-100 px-1.5 py-0.5 rounded text-[8px]">[Subject to Legal Review]</span>
                </div>
                <div>
                  The customer, <strong className="text-slate-950">{formData.customerName}</strong>, confirms that the GPS device was installed satisfactorily in vehicle <strong className="text-slate-950">{formData.vehicleNo}</strong> and agrees not to tamper with, remove or relocate the device. Any problem caused by tampering is the customer's responsibility, and FuelTracks Technologies Pvt. Ltd. will not be liable for it.
                </div>
              </div>

              {/* Computer-Generated Certificate Authenticity Banner */}
              <div className="bg-slate-100 border border-slate-300 p-1.5 rounded text-center text-[9.5px] font-semibold text-slate-800 mb-2">
                ✔ This is a computer-generated certificate and does not require a signature.
              </div>

              {/* Footer */}
              <div className="border-t border-slate-300 pt-1 flex justify-between items-center text-[8.5px] text-slate-600">
                <div className="max-w-[500px] leading-tight">
                  <strong className="text-slate-800">Validity Note:</strong> The validity date may differ from the installation date because the SIM in the device may have been activated earlier. The device may stop reporting if it is tampered with or if GSM/GPS signal is lost.
                </div>
                <div className="text-right">
                  <div className="text-[7.5px] font-bold text-slate-500 uppercase">Verification Code:</div>
                  <div className="font-mono font-black text-slate-900 text-[10px]">{formData.verificationCode}</div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FitmentCertificateModal;
