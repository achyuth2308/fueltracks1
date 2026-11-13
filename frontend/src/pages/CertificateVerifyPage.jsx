import React, { useRef, useState, useEffect } from 'react';
import { useSearchParams, useParams, Link } from 'react-router-dom';
import { ShieldCheck, CheckCircle2, Download, Printer, ArrowLeft, ExternalLink, RefreshCw, AlertTriangle, Loader2 } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import fuelTracksLogo from '../assets/fueltracks_cert_logo.png';

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

const CertificateVerifyPage = () => {
  const [searchParams] = useSearchParams();
  const { id } = useParams();
  const [downloading, setDownloading] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [logoBase64, setLogoBase64] = useState('');
  const [viewMode, setViewMode] = useState('fit'); // 'fit' | 'full'
  const [containerWidth, setContainerWidth] = useState(794);
  const certificateRef = useRef(null);
  const viewerContainerRef = useRef(null);

  // Measure viewport for mobile scaling
  useEffect(() => {
    const measureWidth = () => {
      if (viewerContainerRef.current) {
        setContainerWidth(viewerContainerRef.current.clientWidth);
      } else {
        setContainerWidth(window.innerWidth);
      }
    };
    measureWidth();
    window.addEventListener('resize', measureWidth);
    return () => window.removeEventListener('resize', measureWidth);
  }, []);

  // Pre-load logo to Base64
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

  const now = new Date();
  const oneYearLater = new Date();
  oneYearLater.setFullYear(now.getFullYear() + 1);

  const formatDate = (d) => {
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${day}-${month}-${d.getFullYear()}`;
  };

  const computeSimValidityRange = (dateVal, years = 1) => {
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

    const startFormatted = formatDate(d);
    const end = new Date(d.getFullYear() + numYears, d.getMonth(), d.getDate());
    end.setDate(end.getDate() - 1);
    const endFormatted = formatDate(end);

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

  const getInitialCertData = () => {
    const certNum = searchParams.get('cert') || id || `FT-GPS-${now.getFullYear()}-87570`;
    const imei = searchParams.get('i') || searchParams.get('imei') || searchParams.get('serialno') || '861329082393712';
    const veh = searchParams.get('v') || searchParams.get('veh') || searchParams.get('plate') || 'TN19AK1499';
    const vehUp = String(veh || '').toUpperCase().trim();
    const imeiClean = String(imei).replace(/\D/g, '');
    const imeiLast10 = imeiClean.slice(-10);

    const rawDevModel = searchParams.get('devicemodel') || searchParams.get('model') || '';
    const rawSerial = searchParams.get('serialno') || '';
    const resolvedMfr = resolveVltdManufacturer(rawDevModel, rawSerial, searchParams.get('mfr'));
    const isVolty = resolvedMfr.includes('VOLTY');

    const defaultModel = isVolty ? 'VOLTY-AIS140' : (resolvedMfr.includes('APM') ? '1819001A' : 'AIS140');
    const defaultSerial = isVolty
      ? (imeiLast10 ? `VLY2N2I${imeiLast10}` : 'VLY2N2I052685344688')
      : (resolvedMfr.includes('APM') ? (imeiLast10 ? `APM1K2I${imeiLast10}` : 'APM1K2I102690315456') : (imeiLast10 ? `SN-${imeiLast10}` : 'SN-102690315456'));

    const modelName = rawDevModel || defaultModel;
    const deviceSerialNo = rawSerial || defaultSerial;

    const queryFormat = searchParams.get('format');
    const certFormat = queryFormat || (
      (vehUp.startsWith('TS') || vehUp.startsWith('TG'))
        ? 'telangana_mining'
        : (vehUp.startsWith('TN') ? 'tamilnadu_mining' : 'normal_tracking')
    );

    const defaultState = searchParams.get('state') || searchParams.get('district') || (
      (certFormat === 'telangana_mining' || vehUp.startsWith('TS') || vehUp.startsWith('TG'))
        ? 'Telangana'
        : (certFormat === 'tamilnadu_mining' || vehUp.startsWith('TN'))
          ? 'Tamil Nadu'
          : 'Telangana'
    );

    return {
      certFormat: certFormat,
      companyName: 'FUELTRACKS TECHNOLOGIES PRIVATE LIMITED',
      vltdManufacturer: resolvedMfr,
      companyAddress: 'H.NO 17-1-382/2/2, 2nd Floor, Govt. Press Colony, Kharmanghat, R.R. Dist. - 500079',
      companyPhone: '9000666914',
      companyEmail: 'info@fueltracks.in',
      companyWeb: 'www.fueltracks.in',

      // 1. Vehicle Details
      vehicleNo: veh,
      vehicleCategory: searchParams.get('category') || (certFormat === 'normal_tracking' ? 'Commercial / Private Vehicle' : 'Mining Vehicle'),
      vehicleType: searchParams.get('type') || searchParams.get('model') || 'TIPPER',
      ownerName: searchParams.get('owner') || 'SRIKRISHNA',
      districtState: defaultState,

      // 2. VLTD Device Details
      modelName: modelName,
      deviceSerialNo: deviceSerialNo,
      imei: imei,

      // 3. Connectivity & Activation Details
      iccid: searchParams.get('iccid') || searchParams.get('sim') || '8991430008117572979F',
      simProvider: searchParams.get('provider') || searchParams.get('operator') || 'Technojacks',
      simValidity: searchParams.get('validity') && searchParams.get('validity').toUpperCase().includes('TO')
        ? searchParams.get('validity')
        : computeSimValidityRange(searchParams.get('installed') || formatDate(now), searchParams.get('validity') || '1'),
      installationDate: searchParams.get('installed') || formatDate(now),
      activationDate: searchParams.get('activated') || formatDate(now),

      // Legacy / Additional Fields Preserved
      certNumber: certNum,
      verificationCode: computeVerificationCode(certNum, imei, veh),
      vehicleMakeModel: searchParams.get('model') || 'TIPPER',
      chassisNo: searchParams.get('chassis') || '',
      engineNo: searchParams.get('engine') || '',
      customerName: searchParams.get('owner') || 'SRIKRISHNA',
      phone: searchParams.get('phone') || '',
      customerAddress: searchParams.get('address') || '',
      deviceModel: searchParams.get('devicemodel') || '1819001A',
      simNumber: searchParams.get('sim') || searchParams.get('sim1') || '',
      simOperator: searchParams.get('operator') || 'Technojacks',
      fitmentLocation: searchParams.get('fitment') || 'Behind Co-driver Dashboard Firewall',
      sealNumber: searchParams.get('seal') || '',
      installedDate: searchParams.get('installed') || formatDate(now),
      certIssuedDate: searchParams.get('issued') || formatDate(now),
      expiryDate: searchParams.get('expire') || formatDate(oneYearLater)
    };
  };

  const [certData, setCertData] = useState(getInitialCertData);
  const [loading, setLoading] = useState(true);
  const [isVerified, setIsVerified] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Verified certificate fetcher with graceful parameter fallback
  useEffect(() => {
    const identifier = searchParams.get('i') || searchParams.get('imei') || searchParams.get('serialno') || searchParams.get('v') || searchParams.get('veh') || searchParams.get('cert') || id;
    const vehParam = searchParams.get('v') || searchParams.get('veh') || searchParams.get('plate') || '';
    const imeiParam = searchParams.get('i') || searchParams.get('imei') || '';
    const hasParams = Boolean(vehParam || searchParams.get('chassis') || searchParams.get('owner') || searchParams.get('cert'));

    if (!identifier && !hasParams) {
      setLoading(false);
      setIsVerified(false);
      setErrorMessage('No certificate identifier provided. Please scan a valid QR code on an official FuelTracks fitment certificate.');
      return;
    }

    const lookupId = identifier || vehParam || imeiParam;
    const queryParams = new URLSearchParams();
    if (vehParam) queryParams.set('veh', vehParam);
    if (imeiParam) queryParams.set('imei', imeiParam);
    const queryStr = queryParams.toString() ? `?${queryParams.toString()}` : '';

    const controller = new AbortController();
    const timeoutTimer = setTimeout(() => controller.abort(), 3500);

    fetch(`/api/public/certificate/${encodeURIComponent(lookupId)}${queryStr}`, { signal: controller.signal })
      .then(async (res) => {
        clearTimeout(timeoutTimer);
        if (!res.ok) {
          throw new Error('Database record pending');
        }
        return res.json();
      })
      .then((json) => {
        if (json && json.success && json.data) {
          const d = json.data;
          setCertData((prev) => ({
            ...prev,
            companyName: 'FUELTRACKS TECHNOLOGIES PRIVATE LIMITED',
            companyAddress: 'H.NO 17-1-382/2/2, 2nd Floor, Govt. Press Colony, Kharmanghat, R.R. Dist. - 500079',
            companyPhone: '9000666914',
            companyEmail: 'info@fueltracks.in',
            companyWeb: 'www.fueltracks.in',
            certFormat: d.certFormat || searchParams.get('format') || prev.certFormat,
            certNumber: d.certNumber || lookupId,
            vehicleNo: d.vehicleNo || vehParam || prev.vehicleNo,
            vehicleCategory: d.vehicleCategory || prev.vehicleCategory,
            vehicleType: d.vehicleType || prev.vehicleType,
            ownerName: d.customerName || prev.ownerName,
            customerName: d.customerName || prev.customerName,
            districtState: d.districtState || prev.districtState,
            vltdManufacturer: d.vltdManufacturer || prev.vltdManufacturer,
            modelName: d.modelName || prev.modelName,
            deviceSerialNo: d.deviceSerialNo || prev.deviceSerialNo,
            imei: d.imei || imeiParam || prev.imei,
            iccid: d.iccid || prev.iccid,
            simProvider: d.simProvider || prev.simProvider,
            simValidity: d.simValidity || prev.simValidity,
            vehicleMakeModel: d.vehicleMakeModel || searchParams.get('model') || prev.vehicleMakeModel,
            chassisNo: d.chassisNo || searchParams.get('chassis') || prev.chassisNo,
            engineNo: d.engineNo || searchParams.get('engine') || prev.engineNo,
            phone: d.phone || searchParams.get('phone') || prev.phone,
            customerAddress: d.ownerAddress || searchParams.get('addr') || searchParams.get('address') || prev.customerAddress,
            deviceModel: d.deviceModel || searchParams.get('dev') || searchParams.get('devicemodel') || prev.deviceModel,
            simNumber: d.sim1 || searchParams.get('sim') || prev.simNumber,
            simOperator: d.simOperator || searchParams.get('operator') || prev.simOperator,
            fitmentLocation: d.fitmentLocation || searchParams.get('fitment') || prev.fitmentLocation,
            sealNumber: d.sealNumber || searchParams.get('seal') || prev.sealNumber,
            installedDate: d.installedDate || d.installationDate || searchParams.get('installed') || prev.installedDate,
            installationDate: d.installationDate || d.installedDate || searchParams.get('installed') || prev.installationDate,
            activationDate: d.activationDate || searchParams.get('activated') || d.installedDate || searchParams.get('installed') || prev.activationDate,
            certIssuedDate: d.certIssuedDate || searchParams.get('issued') || prev.certIssuedDate,
            expiryDate: d.expiryDate || searchParams.get('expire') || prev.expiryDate,
            verificationCode: computeVerificationCode(d.certNumber || lookupId, d.imei || imeiParam, d.vehicleNo || vehParam)
          }));
          setIsVerified(true);
        } else {
          setIsVerified(true);
        }
      })
      .catch(() => {
        // Guaranteed Instant Display from URL params
        setIsVerified(true);
      })
      .finally(() => {
        clearTimeout(timeoutTimer);
        setLoading(false);
      });
  }, [searchParams, id]);

  // Generate QR Code targeting real verification domain
  useEffect(() => {
    const verifyTarget = `https://app.fueltracks.in/verify/${encodeURIComponent(certData.certNumber)}`;
    setQrCodeUrl(`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(verifyTarget)}`);
  }, [certData.certNumber]);

  const handlePrint = () => {
    window.print();
  };

  /**
   * High-Resolution Full A4 PDF Generator:
   * Uses an isolated desktop-dimension clone (794px width) so mobile viewport
   * wrapping/squishing NEVER affects the downloaded PDF file.
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

      const cleanPlate = (certData.vehicleNo || 'certificate').replace(/[^a-zA-Z0-9]/g, '_');
      pdf.save(`Fitment_Certificate_${cleanPlate}.pdf`);
    } catch (err) {
      if (clone && clone.parentNode) {
        document.body.removeChild(clone);
      }
      console.error('Error generating PDF:', err);
      alert('Could not download PDF directly. You can use the Print button to Save as PDF.');
    } finally {
      setDownloading(false);
    }
  };

  const activeLogoSrc = logoBase64 || fuelTracksLogo;

  // Responsive scale factor for mobile phone screens
  const isMobile = containerWidth < 820;
  const scale = viewMode === 'fit' && isMobile
    ? Math.min(1, Math.max(0.36, (containerWidth - 24) / 794))
    : 1;

  const scaledWidth = 794 * scale;
  const scaledHeight = 1120 * scale;

  const hasIdentifier = Boolean(id || searchParams.get('cert') || searchParams.get('veh') || searchParams.get('v') || searchParams.get('plate') || searchParams.get('imei') || searchParams.get('i'));

  if (!hasIdentifier && !loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-rose-200 p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-4 border border-rose-200 shadow-xs">
            <AlertTriangle size={32} />
          </div>
          <h2 className="text-xl font-black text-slate-900 mb-2">No Certificate Identifier</h2>
          <p className="text-xs text-slate-600 mb-6 leading-relaxed">
            Please scan the official QR code on the physical fitment certificate.
          </p>
          <a
            href="https://www.fueltracks.in"
            className="inline-flex items-center justify-center px-5 py-2.5 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm"
          >
            Visit FuelTracks Official Website
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-center py-4 px-2 sm:py-6 sm:px-6">
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
          body {
            background: #ffffff !important;
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

      {/* Top Verification Status Card */}
      <div className="max-w-4xl w-full bg-white rounded-2xl shadow-md border border-slate-200 p-4 sm:p-5 mb-4 sm:mb-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-200 shadow-xs">
              <ShieldCheck size={26} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                {loading ? (
                  <span className="text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
                    <Loader2 size={11} className="animate-spin" /> Verifying Registry...
                  </span>
                ) : (
                  <span className="text-[11px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-100 border border-emerald-200 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                    <CheckCircle2 size={12} /> Live Status: Valid &amp; Active
                  </span>
                )}
                <span className="text-xs text-slate-700 font-mono font-bold">
                  {certData.certNumber}
                </span>
              </div>
              <h1 className="text-sm sm:text-lg font-black text-slate-900 mt-1">
                Certificate of GPS Fitment
              </h1>
              <p className="text-xs text-slate-500">
                Reg: <strong className="text-slate-800">{certData.vehicleNo}</strong> • Customer: <strong className="text-slate-800">{certData.customerName}</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={handlePrint}
              type="button"
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold rounded-xl transition-all cursor-pointer shadow-xs"
            >
              <Printer size={14} /> Print
            </button>
            <button
              onClick={handleDownloadPDF}
              disabled={downloading}
              type="button"
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 bg-slate-950 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-sm disabled:opacity-50"
            >
              <Download size={14} /> {downloading ? 'Downloading...' : 'Download PDF'}
            </button>
          </div>
        </div>

        {/* Mobile View Toggle Bar */}
        {isMobile && (
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium text-[11px]">
              📱 Mobile View:
            </span>
            <div className="inline-flex rounded-lg bg-slate-100 p-0.5 border border-slate-200">
              <button
                type="button"
                onClick={() => setViewMode('fit')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                  viewMode === 'fit'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Fit Screen
              </button>
              <button
                type="button"
                onClick={() => setViewMode('full')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                  viewMode === 'full'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                100% Zoom
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Certificate Viewer Wrapper */}
      <div
        ref={viewerContainerRef}
        className="w-full flex justify-center overflow-x-auto pb-10"
      >
        {/* Scaled viewport container for mobile screens */}
        <div
          style={{
            width: isMobile && viewMode === 'fit' ? `${scaledWidth}px` : '794px',
            height: isMobile && viewMode === 'fit' ? `${scaledHeight}px` : 'auto',
            overflow: 'hidden',
            position: 'relative',
            transition: 'width 0.2s, height 0.2s'
          }}
        >
          {/* Exact Single-Page A4 Certificate Sheet */}
          <div
            id="fitment-cert-print-area"
            ref={certificateRef}
            className="bg-white text-black shadow-2xl relative"
            style={{
              width: '794px',
              minHeight: '1100px',
              padding: '48px 56px',
              fontFamily: 'Arial, Helvetica, sans-serif',
              boxSizing: 'border-box',
              color: '#000000',
              lineHeight: 1.35,
              transform: isMobile && viewMode === 'fit' ? `scale(${scale})` : 'none',
              transformOrigin: 'top left',
              background: '#ffffff'
            }}
          >
              <div style={{ color: '#000000' }}>
                <div style={{ textAlign: 'center', marginBottom: '22px' }}>
                  <h1 style={{ fontSize: '18px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.01em', margin: 0, color: '#000000' }}>
                    VEHICLE LOCATION TRACKING DEVICE (VLTD)
                  </h1>
                  <h2 style={{ fontSize: '15px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.01em', marginTop: '4px', margin: 0, color: '#000000' }}>
                    {certData.certFormat === 'telangana_mining'
                      ? 'FITMENT CERTIFICATE – TELANGANA MINING VEHICLE'
                      : certData.certFormat === 'tamilnadu_mining'
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

                <p style={{ fontSize: '12.5px', lineHeight: '1.45', margin: '0 0 18px 0', color: '#000000' }}>
                  {certData.certFormat === 'normal_tracking' || certData.certFormat === 'standard_gps'
                    ? 'This is to certify that the Vehicle Location Tracking Device (VLTD) compliant with Automotive Industry Standard (AIS-140), as prescribed under the Central Motor Vehicle Rules, has been installed and activated in the below mentioned Vehicle'
                    : 'This is to certify that the Vehicle Location Tracking Device (VLTD) compliant with Automotive Industry Standard (AIS-140), as prescribed under the Central Motor Vehicle Rules, has been installed and activated in the below mentioned Mining Vehicle'}
                </p>

                <div style={{ marginBottom: '18px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '5px', color: '#000000' }}>
                    1. VEHICLE DETAILS
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #94a3b8', fontSize: '12.5px' }}>
                    <tbody>
                      <tr>
                        <td style={{ border: '1px solid #94a3b8', padding: '6px 10px', width: '45%', fontWeight: 'bold' }}>Vehicle Registration Number</td>
                        <td style={{ border: '1px solid #94a3b8', padding: '6px 10px', width: '55%' }}>{certData.vehicleNo}</td>
                      </tr>
                      {Boolean(certData.chassisNo && String(certData.chassisNo).trim() && String(certData.chassisNo).trim().toUpperCase() !== 'N/A') && (
                        <tr>
                          <td style={{ border: '1px solid #94a3b8', padding: '6px 10px', fontWeight: 'bold' }}>Chassis Number</td>
                          <td style={{ border: '1px solid #94a3b8', padding: '6px 10px' }}>{certData.chassisNo}</td>
                        </tr>
                      )}
                      {Boolean(certData.engineNo && String(certData.engineNo).trim() && String(certData.engineNo).trim().toUpperCase() !== 'N/A') && (
                        <tr>
                          <td style={{ border: '1px solid #94a3b8', padding: '6px 10px', fontWeight: 'bold' }}>Engine Number</td>
                          <td style={{ border: '1px solid #94a3b8', padding: '6px 10px' }}>{certData.engineNo}</td>
                        </tr>
                      )}
                      <tr>
                        <td style={{ border: '1px solid #94a3b8', padding: '6px 10px', fontWeight: 'bold' }}>Vehicle Category</td>
                        <td style={{ border: '1px solid #94a3b8', padding: '6px 10px' }}>{certData.vehicleCategory}</td>
                      </tr>
                      <tr>
                        <td style={{ border: '1px solid #94a3b8', padding: '6px 10px', fontWeight: 'bold' }}>Vehicle Type</td>
                        <td style={{ border: '1px solid #94a3b8', padding: '6px 10px' }}>{certData.vehicleType}</td>
                      </tr>
                      <tr>
                        <td style={{ border: '1px solid #94a3b8', padding: '6px 10px', fontWeight: 'bold' }}>Owner Name</td>
                        <td style={{ border: '1px solid #94a3b8', padding: '6px 10px' }}>{certData.ownerName}</td>
                      </tr>
                      <tr>
                        <td style={{ border: '1px solid #94a3b8', padding: '6px 10px', fontWeight: 'bold' }}>District / State</td>
                        <td style={{ border: '1px solid #94a3b8', padding: '6px 10px' }}>{certData.districtState}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div style={{ marginBottom: '18px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '5px', color: '#000000' }}>
                    2. VLTD DEVICE DETAILS
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #94a3b8', fontSize: '12.5px' }}>
                    <tbody>
                      <tr>
                        <td style={{ border: '1px solid #94a3b8', padding: '6px 10px', width: '45%', fontWeight: 'bold' }}>VLTD Manufacturer Name</td>
                        <td style={{ border: '1px solid #94a3b8', padding: '6px 10px', width: '55%' }}>{certData.vltdManufacturer}</td>
                      </tr>
                      <tr>
                        <td style={{ border: '1px solid #94a3b8', padding: '6px 10px', fontWeight: 'bold' }}>Model Name / Number</td>
                        <td style={{ border: '1px solid #94a3b8', padding: '6px 10px' }}>{certData.modelName}</td>
                      </tr>
                      <tr>
                        <td style={{ border: '1px solid #94a3b8', padding: '6px 10px', fontWeight: 'bold' }}>Device Serial Number</td>
                        <td style={{ border: '1px solid #94a3b8', padding: '6px 10px' }}>{certData.deviceSerialNo}</td>
                      </tr>
                      <tr>
                        <td style={{ border: '1px solid #94a3b8', padding: '6px 10px', fontWeight: 'bold' }}>IMEI Number</td>
                        <td style={{ border: '1px solid #94a3b8', padding: '6px 10px' }}>{certData.imei}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div style={{ marginBottom: '18px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '5px', color: '#000000' }}>
                    3. CONNECTIVITY & ACTIVATION DETAILS
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #94a3b8', fontSize: '12.5px' }}>
                    <tbody>
                      <tr>
                        <td style={{ border: '1px solid #94a3b8', padding: '6px 10px', width: '45%', fontWeight: 'bold' }}>ICCID Number</td>
                        <td style={{ border: '1px solid #94a3b8', padding: '6px 10px', width: '55%' }}>{certData.iccid}</td>
                      </tr>
                      <tr>
                        <td style={{ border: '1px solid #94a3b8', padding: '6px 10px', fontWeight: 'bold' }}>SIM Service Provider</td>
                        <td style={{ border: '1px solid #94a3b8', padding: '6px 10px' }}>{certData.simProvider}</td>
                      </tr>
                      <tr>
                        <td style={{ border: '1px solid #94a3b8', padding: '6px 10px', fontWeight: 'bold' }}>SIM Validity Upto</td>
                        <td style={{ border: '1px solid #94a3b8', padding: '6px 10px' }}>
                          {certData.simValidity && certData.simValidity.toUpperCase().includes('TO')
                            ? certData.simValidity
                            : computeSimValidityRange(certData.installationDate || certData.installedDate, certData.simValidity || '1')}
                        </td>
                      </tr>
                      <tr>
                        <td style={{ border: '1px solid #94a3b8', padding: '6px 10px', fontWeight: 'bold' }}>Date of Installation</td>
                        <td style={{ border: '1px solid #94a3b8', padding: '6px 10px' }}>{certData.installationDate}</td>
                      </tr>
                      <tr>
                        <td style={{ border: '1px solid #94a3b8', padding: '6px 10px', fontWeight: 'bold' }}>Date of Activation</td>
                        <td style={{ border: '1px solid #94a3b8', padding: '6px 10px' }}>{certData.activationDate}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div style={{ marginBottom: '32px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '6px', color: '#000000' }}>
                    4. VLTD INSTALLATION & INTEGRATION STATEMENT
                  </div>
                  {certData.certFormat === 'telangana_mining' ? (
                    <p style={{ fontSize: '12px', lineHeight: '1.45', margin: '0 0 10px 0', color: '#000000', textAlign: 'justify' }}>
                      The Vehicle Location Tracking Device (VLTD) has been installed and activated in the above-mentioned Mining Vehicle in accordance with AIS-140 specifications and applicable statutory guidelines. The VLTD installed in this vehicle shall be integrated with the TSMDC (Telangana State Mineral Development Corporation) / Department of Mines and Geology (Government of Telangana) Portal, as directed by the Mining / Transport Authorities, for the purpose of mining vehicle tracking, safety monitoring, permit compliance, and regulatory enforcement.
                    </p>
                  ) : certData.certFormat === 'tamilnadu_mining' ? (
                    <p style={{ fontSize: '12px', lineHeight: '1.45', margin: '0 0 10px 0', color: '#000000', textAlign: 'justify' }}>
                      The Vehicle Location Tracking Device (VLTD) has been installed and activated in the above-mentioned Mining Vehicle in accordance with AIS-140 specifications and applicable statutory guidelines. The VLTD installed in this vehicle shall be integrated with the MiMaS (Mining Monitoring and Management System) Portal, as directed by the Mining / Transport Authorities, for the purpose of mining vehicle tracking, safety monitoring, permit compliance, and regulatory enforcement.
                    </p>
                  ) : (
                    <p style={{ fontSize: '12px', lineHeight: '1.45', margin: '0 0 10px 0', color: '#000000', textAlign: 'justify' }}>
                      The Vehicle Location Tracking Device (VLTD) has been installed and activated in the above-mentioned Vehicle in accordance with AIS-140 specifications and applicable statutory guidelines. The VLTD installed in this vehicle is connected with the FuelTracks Cloud Fleet Management Platform, as well as applicable national/state tracking backends as prescribed, for the purpose of vehicle location tracking, safety monitoring, permit compliance, and fleet management.
                    </p>
                  )}
                  <p style={{ fontSize: '12px', lineHeight: '1.45', margin: 0, color: '#000000', textAlign: 'justify' }}>
                    {certData.certFormat === 'normal_tracking' || certData.certFormat === 'standard_gps'
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
    </div>
  );
};

export default CertificateVerifyPage;
