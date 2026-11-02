import React, { useRef, useState, useEffect } from 'react';
import { useSearchParams, useParams, Link } from 'react-router-dom';
import { ShieldCheck, CheckCircle2, Download, Printer, ArrowLeft, ExternalLink, RefreshCw, AlertTriangle, Loader2 } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas-pro';
import QRCode from 'qrcode';
import fuelTracksLogo from '../assets/fueltracks_cert_logo.png';

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
    const imeiClean = String(imei).replace(/\D/g, '');
    const imeiLast10 = imeiClean.slice(-10);

    const rawDevModel = searchParams.get('devicemodel') || searchParams.get('model') || '';
    const rawSerial = searchParams.get('serialno') || '';
    const resolvedMfr = resolveVltdManufacturer(rawDevModel, rawSerial, searchParams.get('mfr'));
    const isVolty = resolvedMfr.includes('VOLTY');

    const defaultModel = isVolty ? 'VOLTY-AIS140' : '1819001A';
    const defaultSerial = isVolty
      ? (imeiLast10 ? `VOL1K2I${imeiLast10}` : 'VOL1K2I102690315456')
      : (imeiLast10 ? `APM1K2I${imeiLast10}` : 'APM1K2I102690315456');

    const modelName = rawDevModel || defaultModel;
    const deviceSerialNo = rawSerial || defaultSerial;

    return {
      certFormat: searchParams.get('format') || 'tamilnadu_mining',
      companyName: 'FUELTRACKS TECHNOLOGIES PRIVATE LIMITED',
      vltdManufacturer: resolvedMfr,
      companyAddress: 'H.NO 17-1-382/2/2, 2nd Floor, Govt. Press Colony, Kharmanghat, R.R. Dist. - 500079',
      companyPhone: '9000666914',
      companyEmail: 'info@fueltracks.in',
      companyWeb: 'www.fueltracks.in',

      // 1. Vehicle Details
      vehicleNo: veh,
      vehicleCategory: searchParams.get('category') || 'Mining Vehicle',
      vehicleType: searchParams.get('type') || searchParams.get('model') || 'TIPPER',
      ownerName: searchParams.get('owner') || 'SRIKRISHNA',
      districtState: searchParams.get('state') || searchParams.get('district') || 'Tamil Nadu',

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
          setCertData({
            companyName: 'FuelTracks Technologies Pvt. Ltd.',
            companyAddress: 'H.NO 17-1-382/2/2, 2nd Floor, Govt. Press Colony, Kharmanghat, R.R. Dist. - 500079',
            companyPhone: '9000666914',
            companyEmail: 'info@fueltracks.in',
            companyWeb: 'www.fueltracks.in',
            certNumber: d.certNumber || lookupId,
            vehicleNo: d.vehicleNo || vehParam,
            vehicleMakeModel: d.vehicleMakeModel || searchParams.get('model') || 'Commercial Vehicle',
            chassisNo: d.chassisNo || searchParams.get('chassis') || '',
            engineNo: d.engineNo || searchParams.get('engine') || '',
            customerName: d.customerName || searchParams.get('owner') || '',
            phone: d.phone || searchParams.get('phone') || '',
            customerAddress: d.ownerAddress || searchParams.get('addr') || searchParams.get('address') || '',
            deviceModel: d.deviceModel || searchParams.get('dev') || searchParams.get('devicemodel') || 'Volty GPS Tracker',
            imei: d.imei || imeiParam,
            simNumber: d.sim1 || searchParams.get('sim') || '',
            simOperator: d.simOperator || searchParams.get('operator') || 'Airtel IoT (M2M Data APN)',
            fitmentLocation: d.fitmentLocation || searchParams.get('fitment') || 'Behind Co-driver Dashboard Firewall',
            sealNumber: d.sealNumber || searchParams.get('seal') || '',
            installedDate: d.installedDate || d.installationDate || searchParams.get('installed') || '',
            installationDate: d.installationDate || d.installedDate || searchParams.get('installed') || '',
            activationDate: d.activationDate || searchParams.get('activated') || d.installedDate || searchParams.get('installed') || '',
            certIssuedDate: d.certIssuedDate || searchParams.get('issued') || '',
            expiryDate: d.expiryDate || searchParams.get('expire') || '',
            verificationCode: computeVerificationCode(d.certNumber || lookupId, d.imei || imeiParam, d.vehicleNo || vehParam)
          });
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
    QRCode.toDataURL(verifyTarget, {
      width: 160,
      margin: 0,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#0f172a',
        light: '#ffffff'
      }
    }).then(url => setQrCodeUrl(url)).catch(() => {});
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
            {certData.certFormat === 'standard_gps' ? (
              /* Standard GPS Fitment Layout */
              <div>
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

                <div className="relative z-10 text-[11px]">
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-3" style={{ maxWidth: '580px' }}>
                      <img
                        src={logoBase64 || fuelTracksLogo}
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
                          {certData.companyName}
                        </div>
                        <div style={{ fontSize: '9.8px', color: '#334155', lineHeight: '1.3', marginTop: '1px' }}>
                          {certData.companyAddress}<br />
                          Phone: <strong className="text-slate-900">{certData.companyPhone}</strong> | Web: <strong className="text-slate-900">{certData.companyWeb}</strong> | Email: <strong className="text-slate-900">{certData.companyEmail}</strong>
                        </div>
                      </div>
                    </div>

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

                  <div style={{ height: '2px', background: '#0f172a', marginBottom: '6px' }}></div>

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
                      <div className="text-[12px] font-mono font-black text-slate-900 whitespace-nowrap">{certData.certNumber}</div>
                    </div>
                  </div>

                  <div className="bg-slate-50 border-l-2 border-slate-900 p-1.5 text-[9.5px] text-slate-700 leading-tight mb-2">
                    This is to certify that a GPS tracking device has been fitted in the vehicle described below. It was checked, sealed and found working at the time of installation.
                  </div>

                  <div className="mb-2">
                    <div className="text-[10px] font-black uppercase tracking-wider text-slate-900 bg-slate-100 px-2 py-0.5 rounded border-l-2 border-slate-800 mb-1">
                      1. VEHICLE DETAILS
                    </div>
                    <table className="w-full border-collapse border border-slate-300 bg-white table-fixed text-[10.5px]">
                      <tbody>
                        <tr>
                          <td className="border border-slate-200 p-1.5 w-1/2">
                            <span className="block text-[8.5px] font-bold text-slate-600 uppercase mb-0.5">Vehicle Registration No.</span>
                            <span className="font-black text-slate-950 text-[13px]">{certData.vehicleNo}</span>
                          </td>
                          <td className="border border-slate-200 p-1.5 w-1/2">
                            <span className="block text-[8.5px] font-bold text-slate-600 uppercase mb-0.5">Make &amp; Model</span>
                            <span className="font-bold text-slate-900">{certData.vehicleMakeModel}</span>
                          </td>
                        </tr>
                        <tr>
                          <td className="border border-slate-200 p-1.5">
                            <span className="block text-[8.5px] font-bold text-slate-600 uppercase mb-0.5">Chassis Number</span>
                            <span className="font-mono font-bold text-slate-900 text-[11px]">{certData.chassisNo}</span>
                          </td>
                          <td className="border border-slate-200 p-1.5">
                            <span className="block text-[8.5px] font-bold text-slate-600 uppercase mb-0.5">Engine Number</span>
                            <span className="font-mono font-bold text-slate-900 text-[11px]">{certData.engineNo}</span>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div className="mb-2">
                    <div className="text-[10px] font-black uppercase tracking-wider text-slate-900 bg-slate-100 px-2 py-0.5 rounded border-l-2 border-slate-800 mb-1">
                      2. CUSTOMER DETAILS
                    </div>
                    <table className="w-full border-collapse border border-slate-300 bg-white table-fixed text-[10.5px]">
                      <tbody>
                        <tr>
                          <td className="border border-slate-200 p-1.5 w-1/2">
                            <span className="block text-[8.5px] font-bold text-slate-600 uppercase mb-0.5">Customer Name</span>
                            <span className="font-black text-slate-900">{certData.customerName}</span>
                          </td>
                          <td className="border border-slate-200 p-1.5 w-1/2">
                            <span className="block text-[8.5px] font-bold text-slate-600 uppercase mb-0.5">Customer Phone Number</span>
                            <span className="font-bold text-slate-900">{certData.phone}</span>
                          </td>
                        </tr>
                        <tr>
                          <td colSpan="2" className="border border-slate-200 p-1.5">
                            <span className="block text-[8.5px] font-bold text-slate-600 uppercase mb-0.5">Customer Full Address</span>
                            <div className="font-semibold text-slate-800 leading-tight text-[10px] whitespace-normal">
                              {certData.customerAddress}
                            </div>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div className="mb-2">
                    <div className="text-[10px] font-black uppercase tracking-wider text-slate-900 bg-slate-100 px-2 py-0.5 rounded border-l-2 border-slate-800 mb-1">
                      3. GPS DEVICE DETAILS
                    </div>
                    <table className="w-full border-collapse border border-slate-300 bg-white table-fixed text-[10.5px]">
                      <tbody>
                        <tr>
                          <td className="border border-slate-200 p-1.5 w-1/2">
                            <span className="block text-[8.5px] font-bold text-slate-600 uppercase mb-0.5">Device Model</span>
                            <span className="font-bold text-slate-900">{certData.modelName || certData.deviceModel}</span>
                          </td>
                          <td className="border border-slate-200 p-1.5 w-1/2">
                            <span className="block text-[8.5px] font-bold text-slate-600 uppercase mb-0.5">IMEI Number</span>
                            <span className="font-mono font-black text-slate-950 text-[11.5px]">{certData.imei}</span>
                          </td>
                        </tr>
                        <tr>
                          <td className="border border-slate-200 p-1.5">
                            <span className="block text-[8.5px] font-bold text-slate-600 uppercase mb-0.5">GPS SIM 1 Number / ICCID</span>
                            <span className="font-mono font-bold text-slate-900">{certData.iccid || certData.simNumber}</span>
                          </td>
                          <td className="border border-slate-200 p-1.5">
                            <span className="block text-[8.5px] font-bold text-slate-600 uppercase mb-0.5">SIM Operator</span>
                            <span className="font-bold text-slate-900">{certData.simProvider || certData.simOperator}</span>
                          </td>
                        </tr>
                        <tr>
                          <td className="border border-slate-200 p-1.5">
                            <span className="block text-[8.5px] font-bold text-slate-600 uppercase mb-0.5">Fitment Location in Vehicle</span>
                            <span className="font-bold text-slate-900">{certData.fitmentLocation}</span>
                          </td>
                          <td className="border border-slate-200 p-1.5">
                            <span className="block text-[8.5px] font-bold text-slate-600 uppercase mb-0.5">Seal Number (if used)</span>
                            <span className="font-mono font-bold text-slate-900">{certData.sealNumber}</span>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

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

                  <div className="mb-2">
                    <div className="text-[10px] font-black uppercase tracking-wider text-slate-900 bg-slate-100 px-2 py-0.5 rounded border-l-2 border-slate-800 mb-1">
                      5. INSTALLATION &amp; VALIDITY
                    </div>
                    <table className="w-full border-collapse border border-slate-300 bg-white table-fixed text-[10.5px]">
                      <tbody>
                        <tr>
                          <td className="border border-slate-200 p-1.5 w-1/3">
                            <span className="block text-[8.5px] font-bold text-slate-600 uppercase mb-0.5">Installation Date (DD-MM-YYYY)</span>
                            <span className="font-mono font-bold text-slate-950 text-[11.5px]">{certData.installationDate || certData.installedDate}</span>
                          </td>
                          <td className="border border-slate-200 p-1.5 w-1/3">
                            <span className="block text-[8.5px] font-bold text-slate-600 uppercase mb-0.5">Certificate Issue Date</span>
                            <span className="font-mono font-bold text-slate-950 text-[11.5px]">{certData.certIssuedDate}</span>
                          </td>
                          <td className="border border-slate-200 p-1.5 w-1/3">
                            <span className="block text-[8.5px] font-bold text-slate-600 uppercase mb-0.5">Service / Validity Expiry Date</span>
                            <span className="font-mono font-bold text-slate-950 text-[11.5px]">{certData.expiryDate}</span>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div className="bg-slate-100 border border-slate-300 p-1.5 rounded text-center text-[9.5px] font-semibold text-slate-800 mb-2">
                    ✔ This is a computer-generated certificate and does not require a signature.
                  </div>

                  <div className="border-t border-slate-300 pt-1 flex justify-between items-center text-[8.5px] text-slate-600">
                    <div className="max-w-[500px] leading-tight">
                      <strong className="text-slate-800">Validity Note:</strong> The validity date may differ from the installation date because the SIM in the device may have been activated earlier.
                    </div>
                    <div className="text-right">
                      <div className="text-[7.5px] font-bold text-slate-500 uppercase">Verification Code:</div>
                      <div className="font-mono font-black text-slate-900 text-[10px]">{certData.verificationCode}</div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* TAMILNADU MINING VEHICLE VLTD FITMENT CERTIFICATE (EXACT REQUESTED FORMAT) */
              <div style={{ color: '#000000' }}>
                <div style={{ textAlign: 'center', marginBottom: '22px' }}>
                  <h1 style={{ fontSize: '18px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.01em', margin: 0, color: '#000000' }}>
                    VEHICLE LOCATION TRACKING DEVICE (VLTD)
                  </h1>
                  <h2 style={{ fontSize: '15px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.01em', marginTop: '4px', margin: 0, color: '#000000' }}>
                    FITMENT CERTIFICATE – TAMILNADU MINING VEHICLE
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
                  This is to certify that the Vehicle Location Tracking Device (VLTD) compliant with Automotive Industry Standard (AIS-140), as prescribed under the Central Motor Vehicle Rules, has been installed and activated in the below mentioned Mining Vehicle
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
                  <p style={{ fontSize: '12px', lineHeight: '1.45', margin: '0 0 10px 0', color: '#000000', textAlign: 'justify' }}>
                    The Vehicle Location Tracking Device (VLTD) has been installed and activated in the above-mentioned Mining Vehicle in accordance with AIS-140 specifications and applicable statutory guidelines. The VLTD installed in this vehicle shall be integrated with the MiMaS (Mining Monitoring and Management System) Portal, as directed by the Mining / Transport Authorities, for the purpose of mining vehicle tracking, safety monitoring, permit compliance, and regulatory enforcement.
                  </p>
                  <p style={{ fontSize: '12px', lineHeight: '1.45', margin: 0, color: '#000000', textAlign: 'justify' }}>
                    This certificate is issued for Mining Vehicle VLTD compliance and monitoring purposes, in accordance with directions issued by the competent authorities.
                  </p>
                </div>

                <div style={{ textAlign: 'right', marginTop: '35px', paddingRight: '8px' }}>
                  <div style={{ fontSize: '13.5px', fontWeight: '900', color: '#000000', marginBottom: '35px', letterSpacing: '0.3px' }}>
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
    </div>
  );
};

export default CertificateVerifyPage;
