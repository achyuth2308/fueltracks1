// ============================================================
// FIELD EXTRACTOR (Label Anchoring & Multi-Column Table Layout)
// Production-grade extraction of structured fields:
//  - Coordinate-aware column matching (2-column & 3-column rows)
//  - Two-pairs-per-row Volty layout
//  - FuelTracks numbered sections (1-5) and 3-column dates
//  - Ignores FuelTracks company header phone (9000666914)
//  - Normalizes "N/A", "NA", "-" to null
// ============================================================

const templateRegistry = require('./templateRegistry');
const {
  cleanFieldValue,
  normalizeRegistrationNo,
  normalizeImei,
  normalizeSim,
  normalizeSerialNumber,
  normalizeDate,
  normalizePhone
} = require('./validationService');

class FieldExtractor {
  extractFields({ lines = [], fullText = '', source = 'pdf_text', templateId = null }) {
    const rawValues = {};
    const fieldConfidence = {};
    const fieldSource = {};

    const template = templateRegistry.getTemplate(templateId);

    if (templateId === 'fueltracks') {
      this._extractFuelTracks(lines, fullText, rawValues, fieldConfidence, fieldSource, source);
    } else if (templateId === 'volty') {
      this._extractVolty(lines, fullText, rawValues, fieldConfidence, fieldSource, source);
    } else {
      // Unknown template: run generic multi-strategy extraction
      this._extractVolty(lines, fullText, rawValues, fieldConfidence, fieldSource, source);
      this._extractFuelTracks(lines, fullText, rawValues, fieldConfidence, fieldSource, source);
    }

    // Fallback regex scan for any remaining missing fields
    this._fallbackRegex(fullText, rawValues, fieldConfidence, fieldSource, source);

    return this._finalizeFields(rawValues, fieldConfidence, fieldSource, source);
  }

  _extractVolty(lines, fullText, rawValues, fieldConfidence, fieldSource, source) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const text = line.text;

      // Header fields
      if (/Certificate No\s*:/i.test(text)) {
        const m = text.match(/Certificate No\s*:\s*([A-Za-z0-9\s\-]+?)(?=\s*Issued Date|$)/i);
        if (m && m[1]) {
          rawValues['certificate_number'] = m[1].replace(/\s+/g, '').trim();
          fieldConfidence['certificate_number'] = 0.98;
          fieldSource['certificate_number'] = source;
        }
      }
      if (/Issued Date\s*:/i.test(text)) {
        const m = text.match(/Issued Date\s*:\s*(\d{2}[\/\-\.]\d{2}[\/\-\.]\d{4})/i);
        if (m && m[1]) {
          rawValues['issued_date'] = m[1].trim();
          fieldConfidence['issued_date'] = 0.98;
          fieldSource['issued_date'] = source;
        }
      }
      if (/Date of Installation\s*:/i.test(text)) {
        const m = text.match(/Date of Installation\s*:\s*(\d{2}[\/\-\.]\d{2}[\/\-\.]\d{4})/i);
        if (m && m[1]) {
          rawValues['installation_date'] = m[1].trim();
          fieldConfidence['installation_date'] = 0.98;
          fieldSource['installation_date'] = source;
        }
      }
      if (/Expiry Date\s*:/i.test(text)) {
        const m = text.match(/Expiry Date\s*:\s*(\d{2}[\/\-\.]\d{2}[\/\-\.]\d{4})/i);
        if (m && m[1]) {
          rawValues['expiry_date'] = m[1].trim();
          fieldConfidence['expiry_date'] = 0.98;
          fieldSource['expiry_date'] = source;
        }
      }

      // Two-pairs-per-row tables
      // Row: Vehicle Number <val> Vehicle Type <val>
      if (/Vehicle Number/i.test(text) && /Vehicle Type/i.test(text)) {
        const m = text.match(/Vehicle Number\s+([A-Za-z0-9\s]+?)\s+Vehicle Type\s+([A-Za-z0-9\s]+)$/i);
        if (m) {
          rawValues['vehicle_registration_no'] = m[1].trim();
          rawValues['vehicle_type'] = m[2].trim();
          fieldConfidence['vehicle_registration_no'] = 0.98;
          fieldConfidence['vehicle_type'] = 0.95;
          fieldSource['vehicle_registration_no'] = source;
          fieldSource['vehicle_type'] = source;
        }
      }

      // Row: Make / Model <val> Chassis Number <val> (could be on line below)
      if (/Make \/ Model/i.test(text) && /Chassis Number/i.test(text)) {
        if (i + 1 < lines.length) {
          const next = lines[i + 1];
          const midX = (next.pageWidth || 600) * 0.48;
          const left = next.items.filter(it => it.x < midX).map(it => it.str).join(' ').trim();
          const right = next.items.filter(it => it.x >= midX).map(it => it.str).join(' ').trim();
          if (left && !/Engine Number/i.test(left)) rawValues['make_model'] = left.replace(/\s+/g, ' ');
          if (right && !/Owner Name/i.test(right)) rawValues['chassis_number'] = right.replace(/\s+/g, '');
          fieldConfidence['make_model'] = 0.95;
          fieldConfidence['chassis_number'] = 0.98;
          fieldSource['make_model'] = source;
          fieldSource['chassis_number'] = source;
        }
      }

      // Row: Engine Number <val> Owner Name <val>
      if (/Engine Number/i.test(text) && /Owner Name/i.test(text)) {
        const m = text.match(/Engine Number\s+([A-Za-z0-9]+)\s+Owner Name\s+([A-Za-z0-9\s\.]+)/i);
        if (m) {
          rawValues['engine_number'] = m[1].trim();
          rawValues['owner_name'] = m[2].trim();
          fieldConfidence['engine_number'] = 0.98;
          fieldConfidence['owner_name'] = 0.95;
          fieldSource['engine_number'] = source;
          fieldSource['owner_name'] = source;
        }
      }

      // Row: Device Make / Model <val> IMEI Number <val>
      if (/Device Make \/ Model/i.test(text) && /IMEI Number/i.test(text)) {
        const m = text.match(/Device Make \/ Model\s+([A-Za-z0-9\s]+?)\s+IMEI Number\s+([0-9]+)/i);
        if (m) {
          rawValues['device_name'] = m[1].trim();
          rawValues['imei_number'] = m[2].trim();
          fieldConfidence['device_name'] = 0.98;
          fieldConfidence['imei_number'] = 0.99;
          fieldSource['device_name'] = source;
          fieldSource['imei_number'] = source;
        }
      }

      // Row: SIM Number <val> Serial Number <val>
      if (/SIM Number/i.test(text) && /Serial Number/i.test(text)) {
        const m = text.match(/SIM Number\s+([0-9]+)\s+Serial Number\s+([A-Za-z0-9]+)/i);
        if (m) {
          rawValues['sim_number'] = m[1].trim();
          rawValues['serial_number'] = m[2].trim();
          fieldConfidence['sim_number'] = 0.98;
          fieldConfidence['serial_number'] = 0.98;
          fieldSource['sim_number'] = source;
          fieldSource['serial_number'] = source;
        }
      }

      // Row: Name <val> Contact Number <val> (in INSTALLER section)
      if (/INSTALLER/i.test(lines[Math.max(0, i - 1)]?.text || '')) {
        const m = text.match(/Name\s+([A-Za-z0-9\s]+?)\s+Contact Number\s+([0-9]+)/i);
        if (m) {
          rawValues['installer_name'] = m[1].trim();
          rawValues['installer_contact_number'] = m[2].trim();
          fieldConfidence['installer_name'] = 0.95;
          fieldConfidence['installer_contact_number'] = 0.98;
          fieldSource['installer_name'] = source;
          fieldSource['installer_contact_number'] = source;
        }
      }
    }
  }

  _extractFuelTracks(lines, fullText, rawValues, fieldConfidence, fieldSource, source) {
    // 1. Certificate Number
    const certM = fullText.match(/\b(FT-GPS-\d{4}-\w+)\b/i);
    if (certM && certM[1]) {
      rawValues['certificate_number'] = certM[1].trim();
      fieldConfidence['certificate_number'] = 0.99;
      fieldSource['certificate_number'] = source;
    }

    // 2. Verification Code (matches FT-VERIFY anywhere in text)
    const verifyM = fullText.match(/\b(FT-VERIFY-[A-Za-z0-9\-]+)\b/i);
    if (verifyM && verifyM[1]) {
      rawValues['verification_code'] = verifyM[1].trim();
      fieldConfidence['verification_code'] = 0.99;
      fieldSource['verification_code'] = source;
    }

    // 3. Line-by-line inspection supporting both two-column and stacked single-column
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const text = line.text;

      // Section 1: Vehicle details
      // Stacked label on line i, value on line i+1
      if (/^VEHICLE REGISTRATION NO\.?$/i.test(text.trim())) {
        if (i + 1 < lines.length && !this._isAnyLabel(lines[i + 1].text, null)) {
          rawValues['vehicle_registration_no'] = lines[i + 1].text.trim();
          fieldConfidence['vehicle_registration_no'] = 0.98;
          fieldSource['vehicle_registration_no'] = source;
        }
      }
      if (/^MAKE\s*(?:&|AND)\s*MODEL$/i.test(text.trim())) {
        if (i + 1 < lines.length && !this._isAnyLabel(lines[i + 1].text, null)) {
          rawValues['make_model'] = lines[i + 1].text.replace(/\s+/g, ' ').trim();
          fieldConfidence['make_model'] = 0.95;
          fieldSource['make_model'] = source;
        }
      }
      if (/^CHASSIS NUMBER$/i.test(text.trim())) {
        if (i + 1 < lines.length && !this._isAnyLabel(lines[i + 1].text, null)) {
          rawValues['chassis_number'] = lines[i + 1].text.replace(/\s+/g, '').trim();
          fieldConfidence['chassis_number'] = 0.98;
          fieldSource['chassis_number'] = source;
        }
      }
      if (/^ENGINE NUMBER$/i.test(text.trim())) {
        if (i + 1 < lines.length && !this._isAnyLabel(lines[i + 1].text, null)) {
          rawValues['engine_number'] = lines[i + 1].text.replace(/\s+/g, '').trim();
          fieldConfidence['engine_number'] = 0.98;
          fieldSource['engine_number'] = source;
        }
      }

      // Section 2: Customer Name, Phone, Address (Stacked)
      if (/^CUSTOMER NAME$/i.test(text.trim())) {
        if (i + 1 < lines.length && !this._isAnyLabel(lines[i + 1].text, null)) {
          rawValues['owner_name'] = lines[i + 1].text.replace(/\s+/g, ' ').trim();
          fieldConfidence['owner_name'] = 0.95;
          fieldSource['owner_name'] = source;
        }
      }
      if (/^CUSTOMER PHONE NUMBER$/i.test(text.trim())) {
        if (i + 1 < lines.length && !this._isAnyLabel(lines[i + 1].text, null)) {
          rawValues['customer_phone'] = lines[i + 1].text.trim();
          fieldConfidence['customer_phone'] = 0.95;
          fieldSource['customer_phone'] = source;
        }
      }

      // Section 3: Device Model, IMEI, SIM, Seal (Stacked)
      if (/^DEVICE MODEL$/i.test(text.trim())) {
        if (i + 1 < lines.length && !this._isAnyLabel(lines[i + 1].text, null)) {
          rawValues['device_name'] = lines[i + 1].text.replace(/\s+/g, ' ').trim();
          fieldConfidence['device_name'] = 0.98;
          fieldSource['device_name'] = source;
        }
      }
      if (/^IMEI NUMBER$/i.test(text.trim())) {
        if (i + 1 < lines.length && !this._isAnyLabel(lines[i + 1].text, null)) {
          rawValues['imei_number'] = lines[i + 1].text.replace(/\s+/g, '').trim();
          fieldConfidence['imei_number'] = 0.99;
          fieldSource['imei_number'] = source;
        }
      }
      if (/^GPS SIM(?:\s*1)?\s*NUMBER$/i.test(text.trim())) {
        if (i + 1 < lines.length && !this._isAnyLabel(lines[i + 1].text, null)) {
          rawValues['sim_number'] = lines[i + 1].text.trim();
          fieldConfidence['sim_number'] = 0.95;
          fieldSource['sim_number'] = source;
        }
      }
      if (/^SIM OPERATOR$/i.test(text.trim())) {
        if (i + 1 < lines.length && !this._isAnyLabel(lines[i + 1].text, null)) {
          rawValues['sim_operator'] = lines[i + 1].text.replace(/\s+/g, ' ').trim();
          fieldConfidence['sim_operator'] = 0.95;
          fieldSource['sim_operator'] = source;
        }
      }
      if (/^FITMENT LOCATION/i.test(text.trim())) {
        if (i + 1 < lines.length && !this._isAnyLabel(lines[i + 1].text, null)) {
          rawValues['fitment_location'] = lines[i + 1].text.replace(/\s+/g, ' ').trim();
        }
      }
      if (/^SEAL NUMBER/i.test(text.trim())) {
        if (i + 1 < lines.length && !this._isAnyLabel(lines[i + 1].text, null)) {
          rawValues['seal_number'] = lines[i + 1].text.replace(/\s+/g, '').trim();
          fieldConfidence['seal_number'] = 0.95;
          fieldSource['seal_number'] = source;
        }
      }

      // Two-column side-by-side labels (e.g. VEHICLE REGISTRATION NO. MAKE & MODEL)
      if (/VEHICLE REGISTRATION NO/i.test(text) && /MAKE\s*(?:&|AND)\s*MODEL/i.test(text)) {
        for (let j = i + 1; j <= Math.min(lines.length - 1, i + 3); j++) {
          const ahead = lines[j];
          if (/CHASSIS NUMBER/i.test(ahead.text)) break;
          const midX = (ahead.pageWidth || 600) * 0.48;
          const left = ahead.items.filter(it => it.x < midX).map(it => it.str).join(' ').trim();
          const right = ahead.items.filter(it => it.x >= midX).map(it => it.str).join(' ').trim();
          if (left && !rawValues['vehicle_registration_no']) {
            rawValues['vehicle_registration_no'] = left;
            fieldConfidence['vehicle_registration_no'] = 0.98;
            fieldSource['vehicle_registration_no'] = source;
          }
          if (right && !rawValues['make_model']) {
            rawValues['make_model'] = right.replace(/\s+/g, ' ');
            fieldConfidence['make_model'] = 0.95;
            fieldSource['make_model'] = source;
          }
        }
      }

      if (/CHASSIS NUMBER/i.test(text) && /ENGINE NUMBER/i.test(text)) {
        if (i + 1 < lines.length) {
          const next = lines[i + 1];
          const midX = (next.pageWidth || 600) * 0.48;
          const left = next.items.filter(it => it.x < midX).map(it => it.str).join(' ').trim();
          const right = next.items.filter(it => it.x >= midX).map(it => it.str).join(' ').trim();
          if (left && !/CUSTOMER/i.test(left)) rawValues['chassis_number'] = left.replace(/\s+/g, '');
          if (right && !/CUSTOMER/i.test(right)) rawValues['engine_number'] = right.replace(/\s+/g, '');
          fieldConfidence['chassis_number'] = 0.98;
          fieldConfidence['engine_number'] = 0.98;
          fieldSource['chassis_number'] = source;
          fieldSource['engine_number'] = source;
        }
      }

      if (/CUSTOMER NAME/i.test(text) && /CUSTOMER PHONE/i.test(text)) {
        if (i + 1 < lines.length) {
          const next = lines[i + 1];
          const midX = (next.pageWidth || 600) * 0.48;
          const left = next.items.filter(it => it.x < midX).map(it => it.str).join(' ').trim();
          const right = next.items.filter(it => it.x >= midX).map(it => it.str).join(' ').trim();
          if (left && !/FULL ADDRESS/i.test(left)) rawValues['owner_name'] = left.replace(/\s+/g, ' ');
          if (right && !/FULL ADDRESS/i.test(right)) rawValues['customer_phone'] = right;
          fieldConfidence['owner_name'] = 0.95;
          fieldConfidence['customer_phone'] = 0.95;
          fieldSource['owner_name'] = source;
          fieldSource['customer_phone'] = source;
        }
      }

      if (/CUSTOMER FULL ADDRESS/i.test(text)) {
        let addr = '';
        for (let j = i + 1; j <= Math.min(lines.length - 1, i + 3); j++) {
          if (/GPS DEVICE DETAILS/i.test(lines[j].text)) break;
          addr += ' ' + lines[j].text;
        }
        if (addr.trim()) {
          rawValues['customer_address'] = addr.replace(/\s+/g, ' ').trim();
          fieldConfidence['customer_address'] = 0.90;
          fieldSource['customer_address'] = source;
        }
      }

      if (/DEVICE MODEL/i.test(text) && /IMEI NUMBER/i.test(text)) {
        if (i + 1 < lines.length) {
          const next = lines[i + 1];
          const midX = (next.pageWidth || 600) * 0.48;
          const left = next.items.filter(it => it.x < midX).map(it => it.str).join(' ').trim();
          const right = next.items.filter(it => it.x >= midX).map(it => it.str).join(' ').trim();
          if (left && !/GPS SIM/i.test(left)) rawValues['device_name'] = left.replace(/\s+/g, ' ');
          if (right && !/GPS SIM/i.test(right)) rawValues['imei_number'] = right.replace(/\s+/g, '');
          fieldConfidence['device_name'] = 0.98;
          fieldConfidence['imei_number'] = 0.99;
          fieldSource['device_name'] = source;
          fieldSource['imei_number'] = source;
        }
      }

      if (/GPS SIM/i.test(text) && /SIM OPERATOR/i.test(text)) {
        if (i + 1 < lines.length) {
          const next = lines[i + 1];
          const midX = (next.pageWidth || 600) * 0.48;
          const left = next.items.filter(it => it.x < midX).map(it => it.str).join(' ').trim();
          const right = next.items.filter(it => it.x >= midX).map(it => it.str).join(' ').trim();
          if (left && !/FITMENT/i.test(left)) rawValues['sim_number'] = left;
          if (right && !/FITMENT/i.test(right)) rawValues['sim_operator'] = right.replace(/\s+/g, ' ');
          fieldConfidence['sim_number'] = 0.95;
          fieldConfidence['sim_operator'] = 0.95;
          fieldSource['sim_number'] = source;
          fieldSource['sim_operator'] = source;
        }
      }

      if (/FITMENT LOCATION/i.test(text) && /SEAL NUMBER/i.test(text)) {
        if (i + 1 < lines.length) {
          const next = lines[i + 1];
          const midX = (next.pageWidth || 600) * 0.48;
          const left = next.items.filter(it => it.x < midX).map(it => it.str).join(' ').trim();
          const right = next.items.filter(it => it.x >= midX).map(it => it.str).join(' ').trim();
          if (left && !/INSTALLATION/i.test(left)) rawValues['fitment_location'] = left.replace(/\s+/g, ' ');
          if (right && !/INSTALLATION/i.test(right)) rawValues['seal_number'] = right.replace(/\s+/g, '');
          fieldConfidence['seal_number'] = 0.95;
          fieldSource['seal_number'] = source;
        }
      }

      if (/INSTALLATION DATE/i.test(text) || /SERVICE \/ VALIDITY EXPIRY DATE/i.test(text)) {
        for (let j = i + 1; j <= Math.min(lines.length - 1, i + 4); j++) {
          const ahead = lines[j];
          if (/CUSTOMER CONFIRMATION/i.test(ahead.text) || /VERIFICATION CODE/i.test(ahead.text)) break;
          const datesInLine = Array.from(ahead.text.matchAll(/\b(\d{2}[\/\-\.]\d{2}[\/\-\.]\d{4})\b/g)).map(m => m[1]);
          for (const d of datesInLine) {
            if (!rawValues['installation_date']) {
              rawValues['installation_date'] = d;
              fieldConfidence['installation_date'] = 0.98;
              fieldSource['installation_date'] = source;
            } else if (!rawValues['issued_date']) {
              rawValues['issued_date'] = d;
              fieldConfidence['issued_date'] = 0.98;
              fieldSource['issued_date'] = source;
            } else if (!rawValues['expiry_date']) {
              rawValues['expiry_date'] = d;
              fieldConfidence['expiry_date'] = 0.98;
              fieldSource['expiry_date'] = source;
            }
          }
        }
      }
    }
  }

  _isAnyLabel(text) {
    if (!text) return false;
    const check = text.toLowerCase().trim();
    const commonLabels = [
      'vehicle registration no', 'vehicle number', 'vehicle type', 'make / model', 'make & model',
      'chassis number', 'engine number', 'owner name', 'customer name', 'customer phone',
      'customer full address', 'device make / model', 'device model', 'imei number', 'gps sim', 'sim number',
      'sim operator', 'fitment location', 'seal number', 'serial number', 'installer', 'name', 'contact number',
      'phone', 'installation date', 'certificate issue date', 'service / validity expiry date', 'validity expiry date',
      'verification code'
    ];
    return commonLabels.some(lbl => check === lbl || check.startsWith(lbl + ' ') || check.startsWith(lbl + ':'));
  }

  _fallbackRegex(fullText, rawValues, fieldConfidence, fieldSource, source) {
    if (!fullText) return;

    if (!rawValues['certificate_number']) {
      const m = fullText.match(/\b(FT-GPS-\d{4}-\w+|VFC-\d+)\b/i);
      if (m) {
        rawValues['certificate_number'] = m[1].trim();
        fieldConfidence['certificate_number'] = 0.92;
        fieldSource['certificate_number'] = source;
      }
    }
    if (!rawValues['vehicle_registration_no']) {
      const m = fullText.match(/\b([A-Z]{2}[0-9\s\-]{1,3}[A-Z\s]{0,3}[0-9]{4})\b/);
      if (m && !m[1].includes('GPS') && !m[1].includes('VERIFY')) {
        rawValues['vehicle_registration_no'] = m[1].trim();
        fieldConfidence['vehicle_registration_no'] = 0.88;
        fieldSource['vehicle_registration_no'] = source;
      }
    }
    if (!rawValues['imei_number']) {
      const m = fullText.match(/\b(\d{15})\b/);
      if (m) {
        rawValues['imei_number'] = m[1].trim();
        fieldConfidence['imei_number'] = 0.90;
        fieldSource['imei_number'] = source;
      }
    }
  }

  _finalizeFields(rawValues, fieldConfidence, fieldSource, defaultSource) {
    const fields = {};
    const pack = (val, conf, src, valid, warns = []) => ({
      value: val,
      confidence: Math.max(0, Math.min(1.0, conf)),
      source: src,
      validated: valid,
      warnings: warns
    });

    // 1. Certificate Number
    const rawCert = cleanFieldValue(rawValues['certificate_number']);
    const certVal = rawCert ? rawCert.replace(/\s+/g, '') : null;
    fields['certificate_number'] = pack(
      certVal,
      certVal ? (fieldConfidence['certificate_number'] || 0.95) : 0,
      fieldSource['certificate_number'] || defaultSource,
      Boolean(certVal)
    );

    // 2. Dates
    for (const dField of ['issued_date', 'installation_date', 'expiry_date']) {
      const rawD = cleanFieldValue(rawValues[dField]);
      if (rawD) {
        const norm = normalizeDate(rawD);
        fields[dField] = pack(
          norm.value,
          norm.validated ? (fieldConfidence[dField] || 0.95) : 0.6,
          fieldSource[dField] || defaultSource,
          norm.validated,
          norm.warnings
        );
      } else {
        fields[dField] = pack(null, 0, defaultSource, true, []);
      }
    }

    if (fields['installation_date'].value && fields['expiry_date'].value) {
      if (fields['expiry_date'].value < fields['installation_date'].value) {
        fields['expiry_date'].validated = false;
        fields['expiry_date'].warnings.push('EXPIRY_BEFORE_INSTALLATION: Expiry date is earlier than installation date');
      }
    }

    // 3. Verification Code
    const rawVerify = cleanFieldValue(rawValues['verification_code']);
    fields['verification_code'] = pack(
      rawVerify,
      rawVerify ? (fieldConfidence['verification_code'] || 0.95) : 0,
      fieldSource['verification_code'] || defaultSource,
      Boolean(rawVerify)
    );

    // 4. Vehicle Registration No
    const rawPlate = cleanFieldValue(rawValues['vehicle_registration_no']);
    const normPlate = normalizeRegistrationNo(rawPlate, fieldSource['vehicle_registration_no'] || defaultSource);
    fields['vehicle_registration_no'] = pack(
      normPlate.value,
      normPlate.validated ? (fieldConfidence['vehicle_registration_no'] || 0.98) : 0.4,
      fieldSource['vehicle_registration_no'] || defaultSource,
      normPlate.validated,
      normPlate.warnings
    );

    // 5. Vehicle Type, Make/Model, Chassis, Engine
    fields['vehicle_type'] = pack(
      cleanFieldValue(rawValues['vehicle_type']),
      rawValues['vehicle_type'] ? (fieldConfidence['vehicle_type'] || 0.92) : 0,
      fieldSource['vehicle_type'] || defaultSource,
      true
    );

    fields['make_model'] = pack(
      cleanFieldValue(rawValues['make_model']) ? cleanFieldValue(rawValues['make_model']).replace(/\s+/g, ' ') : null,
      rawValues['make_model'] ? (fieldConfidence['make_model'] || 0.94) : 0,
      fieldSource['make_model'] || defaultSource,
      true
    );

    const rawChassis = cleanFieldValue(rawValues['chassis_number']);
    fields['chassis_number'] = pack(
      rawChassis ? rawChassis.toUpperCase() : null,
      rawChassis ? (fieldConfidence['chassis_number'] || 0.95) : 0,
      fieldSource['chassis_number'] || defaultSource,
      true,
      (rawChassis && (rawChassis.length < 5 || rawChassis.length > 25)) ? ['ODD_CHASSIS_LENGTH'] : []
    );

    const rawEngine = cleanFieldValue(rawValues['engine_number']);
    fields['engine_number'] = pack(
      rawEngine ? rawEngine.toUpperCase() : null,
      rawEngine ? (fieldConfidence['engine_number'] || 0.95) : 0,
      fieldSource['engine_number'] || defaultSource,
      true,
      (rawEngine && (rawEngine.length < 5 || rawEngine.length > 25)) ? ['ODD_ENGINE_LENGTH'] : []
    );

    // 6. Owner & Customer Details
    fields['owner_name'] = pack(
      cleanFieldValue(rawValues['owner_name']),
      rawValues['owner_name'] ? (fieldConfidence['owner_name'] || 0.92) : 0,
      fieldSource['owner_name'] || defaultSource,
      true
    );

    const rawCustPhone = cleanFieldValue(rawValues['customer_phone']);
    if (rawCustPhone) {
      const normPhone = normalizePhone(rawCustPhone);
      fields['customer_phone'] = pack(
        normPhone.value,
        normPhone.validated ? (fieldConfidence['customer_phone'] || 0.95) : 0.5,
        fieldSource['customer_phone'] || defaultSource,
        normPhone.validated,
        normPhone.warnings
      );
    } else {
      fields['customer_phone'] = pack(null, 0, defaultSource, true);
    }

    fields['customer_address'] = pack(
      cleanFieldValue(rawValues['customer_address']),
      rawValues['customer_address'] ? (fieldConfidence['customer_address'] || 0.90) : 0,
      fieldSource['customer_address'] || defaultSource,
      true
    );

    // 7. Device Block
    fields['device_name'] = pack(
      cleanFieldValue(rawValues['device_name']),
      rawValues['device_name'] ? (fieldConfidence['device_name'] || 0.95) : 0,
      fieldSource['device_name'] || defaultSource,
      Boolean(cleanFieldValue(rawValues['device_name']))
    );

    const rawImei = cleanFieldValue(rawValues['imei_number']);
    const normImei = normalizeImei(rawImei);
    fields['imei_number'] = pack(
      normImei.value,
      normImei.validated ? (fieldConfidence['imei_number'] || 0.98) : 0.4,
      fieldSource['imei_number'] || defaultSource,
      normImei.validated,
      normImei.warnings
    );

    const rawSim = cleanFieldValue(rawValues['sim_number']);
    const normSim = normalizeSim(rawSim);
    fields['sim_number'] = pack(
      normSim.value,
      normSim.validated ? (fieldConfidence['sim_number'] || 0.95) : (rawSim ? 0.4 : 0),
      fieldSource['sim_number'] || defaultSource,
      normSim.validated,
      normSim.warnings
    );

    const rawSerial = cleanFieldValue(rawValues['serial_number']);
    const normSerial = normalizeSerialNumber(rawSerial, fieldSource['serial_number'] || defaultSource);
    fields['serial_number'] = pack(
      normSerial.value,
      normSerial.validated ? (fieldConfidence['serial_number'] || 0.95) + normSerial.confidenceModifier : 0,
      fieldSource['serial_number'] || defaultSource,
      normSerial.validated,
      normSerial.warnings
    );

    fields['sim_operator'] = pack(
      cleanFieldValue(rawValues['sim_operator']),
      rawValues['sim_operator'] ? (fieldConfidence['sim_operator'] || 0.90) : 0,
      fieldSource['sim_operator'] || defaultSource,
      true
    );

    fields['seal_number'] = pack(
      cleanFieldValue(rawValues['seal_number']),
      rawValues['seal_number'] ? (fieldConfidence['seal_number'] || 0.90) : 0,
      fieldSource['seal_number'] || defaultSource,
      true
    );

    // 8. Installer / Dealer Details
    fields['installer_name'] = pack(
      cleanFieldValue(rawValues['installer_name']),
      rawValues['installer_name'] ? (fieldConfidence['installer_name'] || 0.90) : 0,
      fieldSource['installer_name'] || defaultSource,
      true
    );

    const rawInstPhone = cleanFieldValue(rawValues['installer_contact_number']);
    if (rawInstPhone) {
      const normInstPhone = normalizePhone(rawInstPhone);
      fields['installer_contact_number'] = pack(
        normInstPhone.value,
        normInstPhone.validated ? (fieldConfidence['installer_contact_number'] || 0.95) : 0.5,
        fieldSource['installer_contact_number'] || defaultSource,
        normInstPhone.validated,
        normInstPhone.warnings
      );
    } else {
      fields['installer_contact_number'] = pack(null, 0, defaultSource, true);
    }

    return { fields, warnings: [] };
  }
}

module.exports = new FieldExtractor();
