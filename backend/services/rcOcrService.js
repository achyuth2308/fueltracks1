// ============================================================
// RC OCR & REGISTRATION CERTIFICATE PARSER SERVICE
// ============================================================
// Handles bounded-concurrency text extraction from vehicle RC
// images using Tesseract.js worker threads without blocking
// the Node.js main event loop.
// Robust against Indian Smart Card RC text & OCR substitutions.
// ============================================================

const fs = require('fs');
const path = require('path');
const Tesseract = require('tesseract.js');

// Bounded Concurrency Configuration
const MAX_CONCURRENT_OCR = 1;
const MAX_QUEUE_DEPTH = 5;
const OCR_TIMEOUT_MS = 25000; // 25s timeout per image

let activeWorkersCount = 0;
const waitingQueue = [];

/**
 * Acquire execution slot with queue depth protection
 */
function acquireSlot() {
  return new Promise((resolve, reject) => {
    if (activeWorkersCount < MAX_CONCURRENT_OCR) {
      activeWorkersCount++;
      return resolve();
    }

    if (waitingQueue.length >= MAX_QUEUE_DEPTH) {
      return reject(new Error('OCR_QUEUE_FULL: Server OCR queue is currently full. Please retry in a moment.'));
    }

    waitingQueue.push({ resolve, reject });
  });
}

/**
 * Release execution slot and wake up next in queue
 */
function releaseSlot() {
  activeWorkersCount = Math.max(0, activeWorkersCount - 1);
  if (waitingQueue.length > 0 && activeWorkersCount < MAX_CONCURRENT_OCR) {
    activeWorkersCount++;
    const next = waitingQueue.shift();
    next.resolve();
  }
}

/**
 * Run OCR on a single image file with timeout & explicit worker termination
 * @param {string} filePath - Absolute path to image on disk
 * @returns {Promise<string>} Recognized text
 */
async function recognizeImage(filePath) {
  await acquireSlot();

  let worker = null;
  let timer = null;

  try {
    const ocrPromise = (async () => {
      worker = await Tesseract.createWorker('eng', 1, {
        logger: () => {} // Suppress stdout noise
      });
      const ret = await worker.recognize(filePath);
      await worker.terminate();
      worker = null;
      return ret?.data?.text || '';
    })();

    const timeoutPromise = new Promise((_, reject) => {
      timer = setTimeout(() => {
        reject(new Error('OCR_TIMEOUT: Image text extraction timed out after 25 seconds.'));
      }, OCR_TIMEOUT_MS);
    });

    return await Promise.race([ocrPromise, timeoutPromise]);
  } catch (err) {
    if (worker) {
      try {
        await worker.terminate();
      } catch (_) {}
      worker = null;
    }
    throw err;
  } finally {
    if (timer) clearTimeout(timer);
    releaseSlot();
  }
}

/**
 * Clean common OCR artifacts in alphanumeric strings (e.g., plates, VIN)
 */
function cleanAlphaNumeric(val) {
  if (!val) return '';
  return val.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}

/**
 * Normalize dates to YYYY-MM-DD
 */
function normalizeDateStr(dateStr) {
  if (!dateStr) return '';
  const cleaned = dateStr.trim().replace(/[\.\-]/g, '/');
  const parts = cleaned.split('/');
  if (parts.length === 3) {
    let day = parts[0].padStart(2, '0');
    let month = parts[1].padStart(2, '0');
    let year = parts[2];
    if (year.length === 2) {
      year = parseInt(year, 10) > 50 ? `19${year}` : `20${year}`;
    }
    return `${year}-${month}-${day}`;
  }
  return dateStr;
}

/**
 * Convert common OCR misread letters into digits for numeric RTO and series positions
 */
function fixOcrDigits(str) {
  if (!str) return '';
  return str
    .replace(/S/g, '5')
    .replace(/O/g, '0')
    .replace(/I/g, '1')
    .replace(/B/g, '8')
    .replace(/Z/g, '2')
    .replace(/G/g, '6')
    .replace(/D/g, '0');
}

/**
 * Parse structured vehicle information from combined front & back RC texts
 * @param {string} rawText Combined OCR text
 * @returns {object} Extracted vehicle attributes
 */
function parseRcDocumentText(rawText) {
  if (!rawText) return {};

  const lines = rawText
    .replace(/\r/g, '\n')
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean);

  const cleanText = lines.join('\n');
  const result = {
    registrationNo: '',
    chassisNo: '',
    engineNo: '',
    ownerName: '',
    ownerAddress: '',
    vehicleMakeModel: '',
    vehicleClass: '',
    registrationDate: '',
    fitnessUpto: '',
    fuelType: '',
    hypothecation: '',
    rawText: cleanText
  };

  const stateCodes = [
    'TN', 'TS', 'AP', 'KA', 'MH', 'DL', 'KL', 'GJ', 'RJ', 'UP',
    'MP', 'HR', 'PB', 'WB', 'OD', 'BR', 'JH', 'CH', 'CG', 'GA',
    'UK', 'TR', 'AS', 'HP', 'JK', 'PY', 'NL', 'ML', 'MN', 'MZ'
  ];

  // 1. Vehicle Registration Plate
  // Collect candidates and rank by confidence (real digits count)
  let plateCandidates = [];
  for (const line of lines) {
    for (const sc of stateCodes) {
      const regRegex = new RegExp(
        '\\b(' + sc + '[\\s\\-_OISB0-9]{1,4}[A-Z]{0,3}[\\s\\-_OISB0-9]{3,5})\\b',
        'i'
      );
      const match = line.match(regRegex);
      if (match) {
        const rawCandidate = match[1].toUpperCase().replace(/[\s\-_]/g, '');
        if (rawCandidate.length >= 8 && rawCandidate.length <= 11) {
          const cState = rawCandidate.slice(0, 2);
          const rawRto = rawCandidate.slice(2, 4);
          const fixedRto = fixOcrDigits(rawRto);
          const rest = rawCandidate.slice(4);
          if (rest.length >= 4) {
            const series = rest.slice(0, -4);
            const rawLast4 = rest.slice(-4);
            const fixedLast4 = fixOcrDigits(rawLast4);
            // Must have numeric digits
            if (/^\d{2}$/.test(fixedRto) && /^\d{4}$/.test(fixedLast4)) {
              // Count how many original 0-9 digits were present
              const origDigitsCount = (rawRto.match(/\d/g) || []).length + (rawLast4.match(/\d/g) || []).length;
              plateCandidates.push({
                plate: `${cState}${fixedRto}${series}${fixedLast4}`,
                score: origDigitsCount + (line.toLowerCase().includes('number') ? 2 : 0)
              });
            }
          }
        }
      }
    }
  }

  if (plateCandidates.length > 0) {
    plateCandidates.sort((a, b) => b.score - a.score);
    result.registrationNo = plateCandidates[0].plate;
  }

  // Fallback explicit regex
  if (!result.registrationNo) {
    const regPatternExplicit = /(?:Regn?\.?\s*No|Reg\s*No|Vehicle\s*No|Plate\s*No)\s*[:.\-]?\s*([A-Z]{2}[^\S\r\n]?[0-9]{1,2}[^\S\r\n]?[A-Z]{0,3}[^\S\r\n]?[0-9]{4})/i;
    const mRegExplicit = cleanText.match(regPatternExplicit);
    if (mRegExplicit) {
      result.registrationNo = cleanAlphaNumeric(mRegExplicit[1]);
    }
  }

  // 2. 17-character VIN / Chassis Number
  // Scans for exact 17-char alphanumeric VIN sequences (allowing I/O commonly substituted by OCR)
  for (const line of lines) {
    const vinMatches = line.match(/\b([A-Z0-9]{17})\b/g);
    if (vinMatches) {
      for (const vm of vinMatches) {
        if (!/^\d+$/.test(vm) && !/^[A-Z]+$/.test(vm) && !vm.includes('CERTIFICATE')) {
          result.chassisNo = vm.toUpperCase();
          break;
        }
      }
    }
    if (result.chassisNo) break;
  }

  // If not found by standalone scan, look near Chassis label
  if (!result.chassisNo) {
    for (let i = 0; i < lines.length; i++) {
      if (/chass|shah\s*-\s*ass|c\.?\s*no/i.test(lines[i])) {
        const windowLines = lines.slice(i, i + 3);
        for (const wl of windowLines) {
          const m = wl.match(/([A-Z0-9]{14,21})/);
          if (m && m[1] !== result.registrationNo) {
            result.chassisNo = m[1].toUpperCase();
            break;
          }
        }
      }
      if (result.chassisNo) break;
    }
  }

  // 3. Engine Number
  for (let i = 0; i < lines.length; i++) {
    if (/engine|motor|eng\.?\s*no/i.test(lines[i])) {
      const windowLines = lines.slice(i, i + 3);
      for (const wl of windowLines) {
        // Strip single noise prefix (e.g. "a ICPZ129746" -> "ICPZ129746", but preserve the rest)
        const stripped = wl
          .replace(/^[^A-Za-z0-9]*[a-z|._©#*]\s+/i, '')
          .replace(/^[^A-Za-z0-9]+/, '')
          .trim();
        const m = stripped.match(/\b([A-Z0-9]{6,18})\b/);
        if (m && m[1] !== result.chassisNo && !/engine|motor|owner/i.test(m[1])) {
          result.engineNo = m[1].toUpperCase();
          break;
        }
      }
    }
    if (result.engineNo) break;
  }

  // 4. Owner Name
  for (let i = 0; i < lines.length; i++) {
    if (/owner\s*name|customer\s*name|registered\s*owner/i.test(lines[i])) {
      const sameLineMatch = lines[i].match(/(?:owner\s*name|customer\s*name)\s*[:.\-]?\s*([A-Z\s.]{3,35})$/i);
      if (sameLineMatch && sameLineMatch[1].trim().length > 2) {
        result.ownerName = sameLineMatch[1].trim().toUpperCase();
        break;
      }
      if (i + 1 < lines.length) {
        const nextLine = lines[i + 1].replace(/^[|:._\s*#]+/g, '').trim();
        if (nextLine.length > 2 && !/son|wife|daughter|address|chassis|vehicle/i.test(nextLine)) {
          let name = nextLine.toUpperCase();
          if (/^[A-Z][A-Z]{3,}$/.test(name) && !['TATA', 'ASHOK', 'MAHINDRA', 'MARUTI', 'HERO'].includes(name)) {
            name = `${name[0]} ${name.slice(1)}`;
          }
          result.ownerName = name;
          break;
        }
      }
    }
  }

  // 5. Maker & Model
  let foundMaker = '';
  const knownMakers = [
    'ASHOK LEYLAND', 'TATA MOTORS', 'BHARATBENZ', 'EICHER', 'MAHINDRA',
    'MARUTI SUZUKI', 'HYUNDAI', 'ISUZU', 'SWARAJ MAZDA', 'VOLVO', 'SCANIA',
    'FORCE MOTORS', 'TOYOTA', 'HONDA', 'KIA'
  ];

  for (const line of lines) {
    for (const km of knownMakers) {
      if (new RegExp(km, 'i').test(line)) {
        foundMaker = km;
        if (/ltd/i.test(line)) foundMaker += ' LTD.';
        break;
      }
    }
    if (foundMaker) break;
  }

  let foundModel = '';
  for (const line of lines) {
    const modelMatch = line.match(/\b(U-?\d{4}\s*[A-Z0-9.]+|PRIMA\s*[\d.A-Z]+|PRO\s*\d{4}|SIGN\s*\d{4}|BOLERO|SCORPIO|ACE|SUPER\s*ACE|DOST|BADA\s*DOST|BLAZO)\b/i);
    if (modelMatch) {
      foundModel = modelMatch[1].trim().toUpperCase();
      break;
    }
  }

  if (foundMaker && foundModel) {
    result.vehicleMakeModel = `${foundMaker} - ${foundModel}`;
  } else if (foundMaker) {
    result.vehicleMakeModel = foundMaker;
  } else if (foundModel) {
    result.vehicleMakeModel = foundModel;
  }

  // 6. Registration Date / Issue Date
  for (const line of lines) {
    const dateMatch = line.match(/\b(\d{1,2}[-/\.]\d{1,2}[-/\.]\d{4})\b/);
    if (dateMatch && !result.registrationDate) {
      result.registrationDate = normalizeDateStr(dateMatch[1]);
      break;
    }
  }

  // 7. Registered Address
  let addrLines = [];
  let inAddress = false;
  for (const line of lines) {
    if (/\baddress\b/i.test(line)) {
      inAddress = true;
      continue;
    }
    if (inAddress) {
      let clean = line.replace(/^[_{|!&A-Z\s+*#@\(\)]+(?=[0-9A-Za-z])/g, '').trim();
      clean = clean.replace(/^[A-Z\s]{1,4}\+/g, '').trim();
      if (/maker|model|fuel|chassis|engine|weight|colour|body|seating|unladen/i.test(clean)) {
        break;
      }
      if (/\d{6}/.test(line)) {
        clean = clean.replace(/^[^\w\d]+/, '');
        if (clean.length > 3) addrLines.push(clean);
        break;
      }
      if (clean.length > 3) {
        addrLines.push(clean);
      }
    }
  }

  if (addrLines.length > 0) {
    result.ownerAddress = addrLines.join(', ').replace(/\s+,/g, ',').replace(/,+/g, ',');
  }

  // 8. Vehicle Class
  for (const line of lines) {
    const classMatch = line.match(/(?:Vehicle\s*Class|Class\s*of\s*Vehicle)\s*[:.\-]?\s*([A-Za-z\s.,-]+)(?:\n|$)/i);
    if (classMatch) {
      result.vehicleClass = classMatch[1].trim().toUpperCase();
      break;
    }
  }

  // 9. Fuel Type
  for (const line of lines) {
    if (/\b(DIESEL)\b/i.test(line)) {
      result.fuelType = 'DIESEL';
      break;
    }
    if (/\b(PETROL)\b/i.test(line)) {
      result.fuelType = 'PETROL';
      break;
    }
    if (/\b(CNG)\b/i.test(line)) {
      result.fuelType = 'CNG';
      break;
    }
    if (/\b(ELECTRIC|BATTERY)\b/i.test(line)) {
      result.fuelType = 'ELECTRIC';
      break;
    }
  }

  // 10. Hypothecation (Financier)
  for (const line of lines) {
    if (/INDUSIND|HDFC|ICICI|SBI|KOTAK|CHOLAMANDALAM|SUNDARAM|SHRIRAM|AXIS|TATA\s*CAPITAL/i.test(line)) {
      const bankMatch = line.match(/(INDUSIND|HDFC|ICICI|SBI|KOTAK|CHOLAMANDALAM|SUNDARAM|SHRIRAM|AXIS|TATA\s*CAPITAL)[\sA-Z]*(?:BANK|FINANCE|LTD)?/i);
      if (bankMatch) {
        result.hypothecation = bankMatch[0].trim().toUpperCase();
        break;
      }
    }
  }

  return result;
}

/**
 * Process front and back RC files, perform OCR, and extract vehicle metadata
 * @param {object} files - Object containing uploaded files ({ rcFront, rcBack })
 * @returns {Promise<object>} Structured vehicle details and relative URLs
 */
async function processRcFiles(files = {}) {
  const frontFile = files.rcFront ? files.rcFront[0] : null;
  const backFile = files.rcBack ? files.rcBack[0] : null;

  if (!frontFile && !backFile) {
    throw new Error('NO_FILES: Please upload at least one RC image (Front or Back).');
  }

  let frontText = '';
  let backText = '';

  if (frontFile) {
    frontText = await recognizeImage(frontFile.path);
  }
  if (backFile) {
    backText = await recognizeImage(backFile.path);
  }

  const combinedText = [frontText, backText].filter(Boolean).join('\n---\n');
  const parsedData = parseRcDocumentText(combinedText);

  if (frontFile) {
    parsedData.rcFrontUrl = `/uploads/rc/${path.basename(frontFile.path)}`;
  }
  if (backFile) {
    parsedData.rcBackUrl = `/uploads/rc/${path.basename(backFile.path)}`;
  }

  return parsedData;
}

module.exports = {
  recognizeImage,
  parseRcDocumentText,
  processRcFiles
};
