const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

// 1. Read template and assets
const templatePath = path.join(__dirname, '..', 'templates', 'fitment_certificate_template.html');
let html = fs.readFileSync(templatePath, 'utf8');

// Generate QR code targeting live verify URL
const QRCode = require('../frontend/node_modules/qrcode');
const certNo = 'FT-GPS-2026-87570';
const verifyUrl = `https://www.fueltracks.in/verify/${certNo}`;

const logoPath = path.join(__dirname, '..', 'templates', 'logo.png');
const logoBuf = fs.readFileSync(logoPath);
const logoBase64 = `data:image/png;base64,${logoBuf.toString('base64')}`;

QRCode.toDataURL(verifyUrl, { width: 160, margin: 0 }).then((qrBase64) => {
  // 2. Real 12-character SHA-256 verification hash
  const rawCertString = `${certNo}:861329086570201:TS07UJ1278:20261027`;
  const fullHash = crypto.createHash('sha256').update(rawCertString).digest('hex').toUpperCase();
  const verificationCode = `${fullHash.slice(0, 4)}-${fullHash.slice(4, 8)}-${fullHash.slice(8, 12)}`;

  // 3. Fake test data map labeled SAMPLE
  const sampleData = {
    '{{logo_base64}}': logoBase64,
    '{{qr_code_base64}}': qrBase64,
    '{{certificate_no}}': certNo,
    '{{vehicle_reg}}': 'TS07 UJ 1278',
    '{{vehicle_make_model}}': 'Tata Motors - Prima 4028.S',
    '{{chassis_no}}': 'MB1H3LHD26578201',
    '{{engine_no}}': 'NMHZ6578201',

    '{{customer_name}}': 'Ramesh Kumar Yadav',
    '{{customer_phone}}': '+91 90006 66914',
    '{{customer_address}}': 'Plot No. 42, Sri Sai Enclave, Road No. 4, Opposite Govt. Press Colony, L.B. Nagar, Kharmanghat, R.R. District, Hyderabad, Telangana - 500074',

    '{{device_model}}': 'Volty GPS Tracker (Voltsys)',
    '{{imei}}': '861329086570201',
    '{{sim_number}}': '+91 90865 78201',
    '{{sim_operator}}': 'Airtel IoT (M2M Data APN)',
    '{{fitment_location}}': 'Behind Co-driver Dashboard Firewall',
    '{{seal_number}}': 'FT-SEAL-894102',

    '{{installed_date}}': '27/10/2026',
    '{{cert_issue_date}}': '27/10/2026',
    '{{expiry_date}}': '26/10/2027',

    '{{verification_code}}': `FT-VERIFY-${verificationCode}`
  };

  // Replace placeholders
  for (const [key, val] of Object.entries(sampleData)) {
    html = html.split(key).join(val);
  }

  // Add distinct red SAMPLE watermark banner
  const sampleBanner = `
<div style="position: absolute; top: 12mm; right: 38mm; transform: rotate(-15deg); border: 2pt solid #dc2626; color: #dc2626; font-size: 16pt; font-weight: 900; padding: 2px 14px; letter-spacing: 0.15em; border-radius: 4px; opacity: 0.85; pointer-events: none; z-index: 50;">
  SAMPLE SPECIMEN
</div>
`;
  html = html.replace('<div class="cert-content">', `<div class="cert-content">${sampleBanner}`);

  // Save sample HTML
  const sampleHtmlPath = path.join(__dirname, '..', 'templates', 'fitment_certificate_sample.html');
  fs.writeFileSync(sampleHtmlPath, html, 'utf8');
  console.log('Sample HTML created at:', sampleHtmlPath);

  // Generate sample PDF using Headless Edge
  const samplePdfPath = path.join(__dirname, '..', 'templates', 'fitment_certificate_sample.pdf');
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

  if (fs.existsSync(edgePath)) {
    try {
      const cmd = `"${edgePath}" --headless --disable-gpu --print-to-pdf="${samplePdfPath}" --no-pdf-header-footer "${sampleHtmlPath}"`;
      console.log('Generating PDF via headless Edge...');
      execSync(cmd, { stdio: 'inherit' });
      if (fs.existsSync(samplePdfPath)) {
        console.log('SUCCESS: Generated PDF at:', samplePdfPath, '(Size:', fs.statSync(samplePdfPath).size, 'bytes)');
      }
    } catch (err) {
      console.warn('Edge PDF generation warning:', err.message);
    }
  } else {
    console.log('Edge executable not found at standard path.');
  }
});
