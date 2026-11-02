const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const templatePath = path.join(__dirname, '..', 'templates', 'fitment_certificate_template.html');
let html = fs.readFileSync(templatePath, 'utf8');

const logoPath = path.join(__dirname, '..', 'templates', 'logo.png');
const logoBuf = fs.readFileSync(logoPath);
const logoBase64 = `data:image/png;base64,${logoBuf.toString('base64')}`;

const certNo = 'FT-GPS-2026-00001';

const sampleData = {
  '{{logo_base64}}': logoBase64,
  '{{qr_code_base64}}': logoBase64,
  '{{certificate_no}}': certNo,
  '{{vehicle_reg}}': 'KA05LT0001',
  '{{vehicle_make_model}}': 'N/A',
  '{{chassis_no}}': 'N/A',
  '{{engine_no}}': 'N/A',
  '{{customer_name}}': 'N/A',
  '{{customer_phone}}': 'N/A',
  '{{customer_address}}': 'N/A',
  '{{device_model}}': 'Volty GPS Tracker',
  '{{imei}}': '880000000000001',
  '{{sim_number}}': 'N/A',
  '{{sim_operator}}': 'Airtel IoT (M2M Data APN)',
  '{{fitment_location}}': 'Co-driver Dashboard',
  '{{seal_number}}': 'FT-SEAL-000001',
  '{{installed_date}}': '01/11/2026',
  '{{cert_issue_date}}': '01/11/2026',
  '{{expiry_date}}': '31/10/2027',
  '{{verification_code}}': 'FT-VERIFY-1A1D-481F-481F'
};

for (const [key, val] of Object.entries(sampleData)) {
  html = html.split(key).join(val);
}

const htmlPath = path.join(__dirname, '..', 'backend', 'tests', 'fixtures', 'fueltracks_sample.html');
fs.writeFileSync(htmlPath, html, 'utf8');

const pdfPath = path.join(__dirname, '..', 'backend', 'tests', 'fixtures', 'fueltracks_sample.pdf');
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

if (fs.existsSync(edgePath)) {
  const cmd = `"${edgePath}" --headless --disable-gpu --print-to-pdf="${pdfPath}" --no-pdf-header-footer "${htmlPath}"`;
  execSync(cmd, { stdio: 'inherit' });
  console.log('SUCCESS: Generated Golden 1 PDF at:', pdfPath, '(Size:', fs.statSync(pdfPath).size, 'bytes)');
} else {
  console.error('Edge executable not found');
}

