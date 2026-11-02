// ============================================================
// RC OCR & REGISTRATION CERTIFICATE PARSER SERVICE
// ============================================================
// Handles bounded-concurrency text extraction from vehicle RC
// images using Tesseract.js worker threads without blocking
// the Node.js main event loop.
// Robust against Indian Smart Card RC text & OCR substitutions.
// Supports single images containing both Front and Back sides.
// ============================================================

const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const Tesseract = require('tesseract.js');

// Bounded Concurrency Configuration
const MAX_CONCURRENT_OCR = 2;
const MAX_QUEUE_DEPTH = 15;
const OCR_TIMEOUT_MS = 30000; // 30s timeout per image

let activeWorkersCount = 0;
const waitingQueue = [];

/**
 * Locate the local directory containing eng.traineddata
 * Prevents Tesseract from trying to fetch from jsdelivr CDN over network
 */
function getTessdataDir() {
  const candidates = [
    path.join(__dirname, '..', 'tessdata'),
    path.join(__dirname, '..', '..'),
    path.join(__dirname, '..'),
    path.join(process.cwd(), 'fueltracks1', 'backend', 'tessdata'),
    path.join(process.cwd(), 'fueltracks1'),
    path.join(process.cwd(), 'backend', 'tessdata'),
    process.cwd()
  ];

  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, 'eng.traineddata'))) {
      return dir;
    }
  }
  return null;
}

/**
 * Preprocess image with Python PIL (Lanczos resize, contrast & sharpness enhancement,
 * and automatic slicing if the single image contains both Front and Back sides).
 * Falls back gracefully to original image if python is not available.
 */
let resolvedPythonCmd = null;
function getPythonCmd() {
  if (resolvedPythonCmd) return Promise.resolve(resolvedPythonCmd);
  return new Promise((resolve) => {
    execFile('python', ['--version'], (err) => {
      if (!err) {
        resolvedPythonCmd = 'python';
        return resolve('python');
      }
      execFile('python3', ['--version'], (err3) => {
        if (!err3) {
          resolvedPythonCmd = 'python3';
          return resolve('python3');
        }
        resolvedPythonCmd = null;
        resolve(null);
      });
    });
  });
}

function preprocessImage(filePath, allowSlice = false) {
  return new Promise(async (resolve) => {
    const pythonScript = path.join(__dirname, '..', 'utils', 'preprocess_rc.py');
    if (!fs.existsSync(pythonScript)) {
      return resolve([filePath]);
    }

    const pyCmd = await getPythonCmd();
    if (!pyCmd) {
      return resolve([filePath]);
    }

    const outDir = path.join(path.dirname(filePath), 'preprocessed');
    const args = [pythonScript, filePath, outDir];
    if (allowSlice) {
      args.push('--slice');
    }

    execFile(pyCmd, args, { timeout: 8000 }, (err, stdout) => {
      if (err || !stdout) {
        return resolve([filePath]);
      }
      const generatedPaths = stdout
        .split('\n')
        .map(l => l.trim())
        .filter(l => l && fs.existsSync(l));

      if (generatedPaths.length > 0) {
        return resolve(generatedPaths);
      }
      return resolve([filePath]);
    });
  });
}

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
    const tessdataDir = getTessdataDir();
    const workerOptions = {
      logger: () => {} // Suppress stdout noise
    };

    if (tessdataDir) {
      workerOptions.langPath = tessdataDir;
      workerOptions.gzip = false;
    }

    const ocrPromise = (async () => {
      worker = await Tesseract.createWorker('eng', 1, workerOptions);
      const ret = await worker.recognize(filePath);
      await worker.terminate();
      worker = null;
      return ret?.data?.text || '';
    })();

    const timeoutPromise = new Promise((_, reject) => {
      timer = setTimeout(() => {
        reject(new Error('OCR_TIMEOUT: Image text extraction timed out after 30 seconds.'));
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
    .replace(/s/g, '5')
    .replace(/O/g, '0')
    .replace(/o/g, '0')
    .replace(/I/g, '1')
    .replace(/i/g, '1')
    .replace(/l/g, '1')
    .replace(/J/g, '1')
    .replace(/j/g, '1')
    .replace(/B/g, '8')
    .replace(/b/g, '6')
    .replace(/Z/g, '2')
    .replace(/z/g, '2')
    .replace(/G/g, '6')
    .replace(/g/g, '6')
    .replace(/E/g, '6')
    .replace(/e/g, '6')
    .replace(/D/g, '0')
    .replace(/Q/g, '0')
    .replace(/q/g, '0')
    .replace(/A/g, '4')
    .replace(/a/g, '4')
    .replace(/T/g, '7');
}

/**
 * Normalize 17-char ISO 3779 VIN/Chassis Number (cannot contain I, O, Q)
 */
function normalizeVin(vin) {
  if (!vin) return '';
  const cleaned = cleanAlphaNumeric(vin);
  if (cleaned.length === 17) {
    return cleaned
      .replace(/I/g, '1')
      .replace(/O/g, '0')
      .replace(/Q/g, '0');
  }
  return cleaned;
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

  // Indian States & Union Territories (+ Bharat Series BH)
  const stateCodes = [
    'TN', 'TS', 'AP', 'KA', 'MH', 'DL', 'KL', 'GJ', 'RJ', 'UP',
    'MP', 'HR', 'PB', 'WB', 'OD', 'BR', 'JH', 'CH', 'CG', 'GA',
    'UK', 'TR', 'AS', 'HP', 'JK', 'PY', 'NL', 'ML', 'MN', 'MZ',
    'BH', 'AR', 'SK', 'LA', 'DD', 'DN', 'AN', 'LD'
  ];

  // ============================================================
  // 1. VEHICLE REGISTRATION NUMBER PLATE
  // ============================================================
  let plateCandidates = [];

  // Check explicit labels first (e.g. Regn. No: TS 07 UJ 1278)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const explicitMatch = line.match(/(?:Regn?\.?\s*No|Reg\s*No|Vehicle\s*No|Plate\s*No|Regn?\.?\s*Number)\s*[:.\-]?\s*([A-Z0-9\s\-_]{6,16})/i);
    if (explicitMatch) {
      const candidateRaw = explicitMatch[1].replace(/[\s\-_.]/g, '').toUpperCase();
      // Check if candidate starts with a state code
      for (const sc of stateCodes) {
        if (candidateRaw.startsWith(sc)) {
          const rest = candidateRaw.slice(sc.length);
          if (rest.length >= 5 && rest.length <= 8) {
            const rawRto = rest.slice(0, 2);
            const fixedRto = fixOcrDigits(rawRto);
            const remaining = rest.slice(2);
            const seriesMatch = remaining.match(/^([A-Z]{0,3})([0-9A-Z]{3,5})$/);
            if (seriesMatch) {
              const series = seriesMatch[1];
              const rawDigits = seriesMatch[2];
              const fixedDigits = fixOcrDigits(rawDigits);
              if (/^\d{1,2}$/.test(fixedRto) && /^\d{4}$/.test(fixedDigits)) {
                plateCandidates.push({
                  plate: `${sc}${fixedRto}${series}${fixedDigits}`,
                  score: 50
                });
              }
            }
          }
        }
      }
    }

    // Check if the label is on its own line and plate is on the next line
    if (/^(?:Regn?\.?\s*No|Reg\s*No|Vehicle\s*No|Plate\s*No|Regn?\.?\s*Number)\s*[:.\-]?$/i.test(line) && i + 1 < lines.length) {
      const nextLine = lines[i + 1].replace(/[\s\-_.]/g, '').toUpperCase();
      for (const sc of stateCodes) {
        if (nextLine.startsWith(sc)) {
          const rest = nextLine.slice(sc.length);
          if (rest.length >= 5 && rest.length <= 8) {
            const fixed = fixOcrDigits(rest);
            plateCandidates.push({
              plate: `${sc}${fixed}`,
              score: 45
            });
          }
        }
      }
    }
  }

  // Scan across all lines with state codes pattern
  for (const line of lines) {
    // Skip postal lines or address lines to avoid extracting PIN codes
    if (/(?:street|nagar|road|kovilpatti|andipatti|theni|madurai|hyderabad|pin|pincode|po\b|dist\b)/i.test(line)) {
      continue;
    }

    for (const sc of stateCodes) {
      const regRegex = new RegExp(
        '\\b(' + sc + '[\\s\\-_OISBA0-9]{1,4}[A-Z]{0,3}[\\s\\-_OISBA0-9]{3,5})\\b',
        'i'
      );
      const match = line.match(regRegex);
      if (match) {
        const rawCandidate = match[1].toUpperCase().replace(/[\s\-_.]/g, '');

        // REJECT 6-digit postal PIN codes (e.g. TN628812 - 2 letters followed directly by 6 digits)
        if (new RegExp('^' + sc + '\\d{6}$').test(rawCandidate)) {
          continue;
        }

        if (rawCandidate.length >= 8 && rawCandidate.length <= 11) {
          const cState = rawCandidate.slice(0, 2);
          const rawRto = rawCandidate.slice(2, 4);
          const fixedRto = fixOcrDigits(rawRto);
          const rest = rawCandidate.slice(4);
          if (rest.length >= 4) {
            const series = rest.slice(0, -4);
            const rawLast4 = rest.slice(-4);
            const fixedLast4 = fixOcrDigits(rawLast4);

            if (/^\d{1,2}$/.test(fixedRto) && /^\d{4}$/.test(fixedLast4)) {
              const origDigitsCount = (rawRto.match(/\d/g) || []).length + (rawLast4.match(/\d/g) || []).length;
              let score = origDigitsCount + (series.length >= 1 ? 10 : 0);
              if (line.toLowerCase().includes('reg') || line.toLowerCase().includes('certificate')) {
                score += 20;
              }
              plateCandidates.push({
                plate: `${cState}${fixedRto}${series}${fixedLast4}`,
                score
              });
            }
          }
        }
      }
    }

    // Bharat Series Check: e.g. 22 BH 1234 AA
    const bhMatch = line.match(/\b(\d{2}\s*BH\s*\d{4}\s*[A-Z]{1,2})\b/i);
    if (bhMatch) {
      plateCandidates.push({
        plate: cleanAlphaNumeric(bhMatch[1]),
        score: 30
      });
    }
  }

  if (plateCandidates.length > 0) {
    plateCandidates.sort((a, b) => b.score - a.score);
    result.registrationNo = plateCandidates[0].plate;
  }

  // Fallback explicit regex
  if (!result.registrationNo) {
    const regPatternExplicit = /(?:Regn?\.?\s*No|Reg\s*No|Vehicle\s*No|Plate\s*No)\s*[:.\-]?\s*([A-Z]{2}[^\S\r\n]?[0-9A-Z]{1,2}[^\S\r\n]?[A-Z]{0,3}[^\S\r\n]?[0-9A-Z]{4})/i;
    const mRegExplicit = cleanText.match(regPatternExplicit);
    if (mRegExplicit) {
      const candidate = cleanAlphaNumeric(mRegExplicit[1]);
      if (!/^[A-Z]{2}\d{6}$/.test(candidate)) {
        result.registrationNo = candidate;
      }
    }
  }

  // ============================================================
  // 2. CHASSIS NUMBER (VIN)
  // ============================================================
  for (const line of lines) {
    const vinMatches = line.match(/\b([A-Z0-9]{17})\b/g);
    if (vinMatches) {
      for (const vm of vinMatches) {
        if (!/^\d+$/.test(vm) && !/^[A-Z]+$/.test(vm) && !vm.includes('CERTIFICATE') && vm !== result.registrationNo) {
          result.chassisNo = normalizeVin(vm);
          break;
        }
      }
    }
    if (result.chassisNo) break;
  }

  // If not found by standalone scan, look near Chassis label
  if (!result.chassisNo) {
    for (let i = 0; i < lines.length; i++) {
      if (/chass|shah\s*-\s*ass|c\.?\s*no|vin\b/i.test(lines[i])) {
        // Same line after label
        const sameLineAfter = lines[i].replace(/^.*?(?:chass|shah\s*-\s*ass|c\.?\s*no|vin\b)[^\w\d]*/i, '').trim();
        const mSame = sameLineAfter.match(/\b([A-Z0-9]{14,21})\b/);
        if (mSame && mSame[1] !== result.registrationNo && /\d/.test(mSame[1]) && !/certificate|department|leyland|motors/i.test(mSame[1])) {
          result.chassisNo = normalizeVin(mSame[1]);
          break;
        }

        // Window of next 2 lines
        const windowLines = lines.slice(i + 1, i + 3);
        for (const wl of windowLines) {
          const stripped = wl.replace(/^[^A-Za-z0-9]+/, '').trim();
          const m = stripped.match(/\b([A-Z0-9]{14,21})\b/);
          if (m && m[1] !== result.registrationNo && /\d/.test(m[1]) && !/chassis|certificate|department|leyland|motors/i.test(m[1])) {
            result.chassisNo = normalizeVin(m[1]);
            break;
          }
        }
      }
      if (result.chassisNo) break;
    }
  }

  // ============================================================
  // 3. ENGINE NUMBER
  // ============================================================
  for (let i = 0; i < lines.length; i++) {
    if (/engine|motor|eng\.?\s*no/i.test(lines[i])) {
      // Check same line after label
      const sameLineAfter = lines[i].replace(/^.*?(?:engine|motor|eng)(?:\s*no\.?|\s*num\.?)?\s*[:.\-\/]?\s*/i, '').trim();
      const sameLineClean = sameLineAfter.replace(/^[^A-Za-z0-9]+/, '').trim();
      const sameMatch = sameLineClean.match(/^([A-Z0-9]{6,18})/i);
      if (sameMatch && sameMatch[1] !== result.chassisNo && /\d/.test(sameMatch[1]) && !/chassis|maker|model|fuel/i.test(sameMatch[1])) {
        result.engineNo = sameMatch[1].toUpperCase();
        break;
      }

      // Check window of next 2 lines
      const windowLines = lines.slice(i + 1, i + 3);
      for (const wl of windowLines) {
        const stripped = wl
          .replace(/^[^A-Za-z0-9]*[a-z|._©#*~—]\s+/i, '')
          .replace(/^[^A-Za-z0-9]+/, '')
          .trim();
        const m = stripped.match(/\b([A-Z0-9]{6,18})\b/);
        if (m && m[1] !== result.chassisNo && m[1] !== result.registrationNo && /\d/.test(m[1]) && !/engine|motor|owner|chassis|vehicle/i.test(m[1])) {
          result.engineNo = m[1].toUpperCase();
          break;
        }
      }
    }
    if (result.engineNo) break;
  }

  // ============================================================
  // 4. OWNER NAME
  // ============================================================
  for (let i = 0; i < lines.length; i++) {
    if (/owner\s*name|customer\s*name|registered\s*owner|regd\s*owner/i.test(lines[i])) {
      // Try same line match
      const sameLineMatch = lines[i].match(/(?:owner\s*name|customer\s*name|registered\s*owner|regd\s*owner)\s*[:.\-]?\s*([A-Za-z\s.]{3,35})$/i);
      if (sameLineMatch && sameLineMatch[1].trim().length > 2) {
        result.ownerName = sameLineMatch[1].trim().toUpperCase();
        break;
      }

      // Try next lines
      for (let j = i + 1; j <= i + 3 && j < lines.length; j++) {
        const rawLine = lines[j].replace(/^[^A-Za-z0-9]+/, '').replace(/^[a-z]{1,2}[\s._§~|—]+\s*/, '').trim();
        if (rawLine.length > 2 && !/son|wife|daughter|s\/w\/d|address|chassis|vehicle|maker|model|engine/i.test(rawLine)) {
          let name = rawLine.replace(/\s+[§$5]\s*$/, ' S').toUpperCase();
          if (/^[A-Z][A-Z]{3,}$/.test(name) && !['TATA', 'ASHOK', 'MAHINDRA', 'MARUTI', 'HERO', 'EICHER', 'VOLVO'].includes(name)) {
            name = `${name[0]} ${name.slice(1)}`;
          }
          result.ownerName = name;
          break;
        }
      }
    }
    if (result.ownerName) break;
  }

  // Fallback: in Indian RCs, the line immediately preceding "Son / Wife / Daughter of" is the owner name
  if (!result.ownerName) {
    for (let i = 0; i < lines.length; i++) {
      if (/(?:son|daughter|wife|s\/w\/d|s\/o|w\/o|d\/o)\s*(?:of)?/i.test(lines[i])) {
        if (i > 0) {
          const prevLine = lines[i - 1].replace(/^[^A-Za-z0-9]+/, '').replace(/^[a-z]{1,2}[\s._§~|—]+\s*/, '').trim();
          if (prevLine.length > 2 && !/engine|chassis|date|reg/i.test(prevLine)) {
            result.ownerName = prevLine.replace(/\s+[§$5]\s*$/, ' S').toUpperCase();
            break;
          }
        }
      }
    }
  }

  if (result.ownerName) {
    // Strip adjacent column text if cards were side by side in one image
    result.ownerName = result.ownerName.split(/\b(?:colour|color|class|body|maker|model|engine|chassis|reg|unladen|laden|weight|seating)\b/i)[0];
    result.ownerName = result.ownerName.replace(/^[a-z]{1,2}[\s._§~|—]+\s*/, '').replace(/\s+[§$5]\s*$/, ' S').replace(/^[^a-zA-Z]+/, '').replace(/[^\w\s.]+$/, '').trim();
  }

  if (result.chassisNo && result.chassisNo.length > 17) {
    result.chassisNo = result.chassisNo.slice(0, 17);
  }

  // ============================================================
  // 5. MAKER & MODEL
  // ============================================================
  let foundMaker = '';
  const knownMakers = [
    'ASHOK LEYLAND', 'TATA MOTORS', 'BHARATBENZ', 'BHARAT BENZ', 'EICHER', 'MAHINDRA',
    'MARUTI SUZUKI', 'MARUTI', 'HYUNDAI', 'ISUZU', 'SWARAJ MAZDA', 'VOLVO', 'SCANIA',
    'FORCE MOTORS', 'TOYOTA', 'HONDA', 'KIA', 'TVS', 'BAJAJ', 'HERO', 'ROYAL ENFIELD', 'YAMAHA'
  ];

  for (const line of lines) {
    for (const km of knownMakers) {
      const kmRegex = new RegExp('\\b' + km.replace(/\s+/g, '[\\s\\-_]*'), 'i');
      if (kmRegex.test(line)) {
        foundMaker = km;
        if (/\bltd\b/i.test(line)) {
          foundMaker += ' LTD';
        }
        break;
      }
    }
    if (foundMaker) break;
  }

  let foundModel = '';
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const modelMatch = line.match(/\b(1616\s*[A-Z0-9.]+|2518\s*[A-Z0-9.]+|U-?\d{4}\s*[A-Z0-9.]+|PRIMA\s*[\d.A-Z]+|PRO\s*\d{4}|SIGN\s*\d{4}|BOLERO|SCORPIO|ACE|SUPER\s*ACE|DOST|BADA\s*DOST|BLAZO|AVTR\s*[\d.A-Z]+)\b/i);
    if (modelMatch) {
      foundModel = modelMatch[1].trim().toUpperCase();
      break;
    }

    // Check if line contains "Model Name" or "Model:"
    if (/Model(?:\s*Name)?\s*[:.\-]?/i.test(line)) {
      const after = line.replace(/^.*?Model(?:\s*Name)?\s*[:.\-]?\s*/i, '').trim();
      if (after.length > 2 && !/^(name|details|number|type|class)[\s.]*$/i.test(after)) {
        foundModel = after.toUpperCase();
        break;
      }
      // If header line, check next line
      if (i + 1 < lines.length) {
        const nextLine = lines[i + 1];
        const nextMatch = nextLine.match(/\b(\d{4}\s*[A-Z0-9.\s]+|TIPPER|TRUCK|PRIMA\s*[\d.A-Z]+|PRO\s*\d{4}|DOST)\b/i);
        if (nextMatch) {
          foundModel = nextMatch[1].trim().toUpperCase();
          break;
        }
      }
    }
  }

  if (foundModel) {
    foundModel = foundModel.replace(/^\d{4,6}\s+/, '').replace(/\s+(FR|AM|A|B)\b/gi, '').trim();
  }

  if (foundMaker && foundModel) {
    result.vehicleMakeModel = `${foundMaker} - ${foundModel}`;
  } else if (foundMaker) {
    result.vehicleMakeModel = foundMaker;
  } else if (foundModel) {
    result.vehicleMakeModel = foundModel;
  }

  // ============================================================
  // 6. REGISTRATION DATE / ISSUE DATE
  // ============================================================
  for (const line of lines) {
    if (/reg(?:n|istration)?\.?\s*(?:date|dt)|date\s*of\s*reg(?:n|istration)?|issue\s*date/i.test(line)) {
      const dm = line.match(/\b(\d{1,2}[-/\.]\d{1,2}[-/\.]\d{2,4})\b/);
      if (dm) {
        result.registrationDate = normalizeDateStr(dm[1]);
        break;
      }
    }
    // Check if line contains "As per Fitness"
    if (/as\s*per\s*fitness/i.test(line)) {
      const dm = line.match(/\b(\d{1,2}[-/\.]\d{1,2}[-/\.]\d{2,4})\b/);
      if (dm && !result.registrationDate) {
        result.registrationDate = normalizeDateStr(dm[1]);
      }
    }
  }

  // Fallback: search for first valid date that is not fitness/validity
  if (!result.registrationDate) {
    for (const line of lines) {
      if (!/fitness|valid|fit\b/i.test(line)) {
        const dateMatch = line.match(/\b(\d{1,2}[-/\.]\d{1,2}[-/\.]\d{4})\b/);
        if (dateMatch) {
          result.registrationDate = normalizeDateStr(dateMatch[1]);
          break;
        }
      }
    }
  }

  // ============================================================
  // 7. FITNESS UPTO / VALIDITY DATE
  // ============================================================
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/as\s*per\s*fitness/i.test(line)) {
      continue;
    }
    if (/fitness|fit\.?\s*upto|valid\s*upto|valid\s*till|validity|tax\s*upto/i.test(line)) {
      // Check same line
      const dm = line.match(/\b(\d{1,2}[-/\.]\d{1,2}[-/\.]\d{2,4})\b/);
      if (dm) {
        result.fitnessUpto = normalizeDateStr(dm[1]);
        break;
      }
      // Check next line
      if (i + 1 < lines.length) {
        const nextDm = lines[i + 1].match(/\b(\d{1,2}[-/\.]\d{1,2}[-/\.]\d{2,4})\b/);
        if (nextDm) {
          result.fitnessUpto = normalizeDateStr(nextDm[1]);
          break;
        }
      }
    }
  }

  // ============================================================
  // 8. REGISTERED ADDRESS
  // ============================================================
  let addrLines = [];
  let inAddress = false;

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx];

    // Check if Address label begins on this line
    if (/\baddress\b/i.test(line)) {
      inAddress = true;
      const afterLabel = line.replace(/^.*?\baddress\b\s*[:.\-]?\s*/i, '').trim();
      if (afterLabel.length > 3) {
        const cleanSame = afterLabel.replace(/^[^a-zA-Z0-9]+/, '').trim();
        addrLines.push(cleanSame);
        if (/\b\d{6}\b/.test(cleanSame)) {
          break;
        }
      }
      continue;
    }

    if (inAddress) {
      if (/maker|model|fuel|chassis|engine|vehicle\s*class|class\s*of|body|colour|weight|unladen|laden|seating|hypothecation|financier|dealer|validity|fitness|son\s*of|wife\s*of|daughter\s*of/i.test(line)) {
        break;
      }

      let clean = line.replace(/^[^a-zA-Z0-9]+/, '').trim();
      clean = clean.replace(/^[A-Z\s]{1,8}\+\s*/gi, '').trim();
      clean = clean.replace(/^[\d\s]+(?=[A-Za-z])/g, '').trim();
      clean = clean.replace(/(\b\d{6}\b)\s+\d+$/, '$1').trim();

      if (clean.length > 2) {
        addrLines.push(clean);
      }

      if (/\b\d{6}\b/.test(line)) {
        break;
      }
    }
  }

  // Fallback: look for address blocks containing street/town names ending with a 6-digit PIN code
  if (addrLines.length === 0) {
    for (let i = 0; i < lines.length; i++) {
      if (/\b\d{6}\b/.test(lines[i]) && /(?:st|street|road|nagar|kovilpatti|andipatti|theni|madurai|hyderabad|plot|village|dist)/i.test(lines[i])) {
        // Collect 1-2 lines before PIN code if relevant
        if (i > 0 && /(?:st|street|road|nagar|kovilpatti|andipatti|village)/i.test(lines[i - 1])) {
          addrLines.push(lines[i - 1].replace(/^[^a-zA-Z0-9]+/, '').trim());
        }
        addrLines.push(lines[i].replace(/^[^a-zA-Z0-9]+/, '').trim());
        break;
      }
    }
  }

  if (addrLines.length > 0) {
    result.ownerAddress = addrLines
      .join(', ')
      .replace(/\s+,/g, ',')
      .replace(/,+/g, ',')
      .replace(/^,\s*/, '')
      .trim();

    // Strip adjacent column text if cards were side by side
    result.ownerAddress = result.ownerAddress
      .split(/\b(?:unladen|laden|weight\s*\(kgs?\)|tax\s*paid)\b/i)[0]
      .replace(/\s+,/g, ',')
      .replace(/,+/g, ',')
      .replace(/[^\w\d)]+$/, '')
      .trim();
  }

  // ============================================================
  // 9. VEHICLE CLASS
  // ============================================================
  for (const line of lines) {
    const classMatch = line.match(/(?:Vehicle\s*Class|Class\s*of\s*Vehicle|Veh\s*Class)\s*[:.\-]?\s*([^=\n\r;]{2,40})/i);
    if (classMatch) {
      let vClass = classMatch[1].replace(/^[^\w]+|[^\w]+$/g, '').trim().toUpperCase();
      if (/Ar.*Scul.*Vahide|Articulated/i.test(vClass)) {
        vClass = 'ARTICULATED VEHICLE';
      } else if (/Goods\s*Carrier/i.test(vClass)) {
        vClass = 'GOODS CARRIER';
      }
      if (vClass.length > 1) {
        result.vehicleClass = vClass;
        break;
      }
    }
  }

  if (!result.vehicleClass && /TIPPER/i.test(cleanText)) {
    result.vehicleClass = 'GOODS CARRIER - TIPPER';
  }

  // ============================================================
  // 10. FUEL TYPE
  // ============================================================
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
    const labeledFuel = line.match(/Fuel\s*[:.\-]?\s*([A-Za-z]+)/i);
    if (labeledFuel) {
      const fval = labeledFuel[1].toUpperCase();
      if (fval === 'D' || fval.startsWith('DIES')) {
        result.fuelType = 'DIESEL';
        break;
      }
      if (fval === 'P' || fval.startsWith('PETR')) {
        result.fuelType = 'PETROL';
        break;
      }
    }
  }

  // Fallback for commercial trucks/tippers
  if (!result.fuelType) {
    if (/ASHOK LEYLAND|TATA MOTORS|BHARATBENZ|EICHER|TIPPER|PRIMA|HGV|ARTICULATED/i.test(cleanText)) {
      result.fuelType = 'DIESEL';
    }
  }

  // ============================================================
  // 11. HYPOTHECATION (FINANCIER)
  // ============================================================
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/INDUSIND|HDFC|ICICI|SBI|KOTAK|CHOLAMANDALAM|SUNDARAM|SHRIRAM|AXIS|TATA\s*CAPITAL|CANARA|BANK\s*OF\s*BARODA|HASTIMAL/i.test(line)) {
      if (/HASTIMAL/i.test(line)) {
        result.hypothecation = 'HASTIMAL INDERCHAND SURANA';
        break;
      }
      const bankMatch = line.match(/(INDUSIND|HDFC|ICICI|SBI|KOTAK|CHOLAMANDALAM|SUNDARAM|SHRIRAM|AXIS|TATA\s*CAPITAL|CANARA|BANK\s*OF\s*BARODA)[\sA-Z]*(?:BANK|FINANCE|LTD)?/i);
      if (bankMatch) {
        let bankStr = bankMatch[0].trim().toUpperCase();
        bankStr = bankStr.replace(/\s+(FA|LE|A|B|C|D|E)$/i, '').replace(/^[0-9\/\s%]+/, '').trim();
        result.hypothecation = bankStr;
        break;
      }
    }
    if (/Financ(?:er|ier)|Hypothecat/i.test(line)) {
      if (i + 1 < lines.length) {
        const next1 = lines[i + 1].replace(/^[^A-Za-z]+/, '').trim();
        let nameCombined = next1;
        if (i + 2 < lines.length && /SURANA|FINANCE|LTD|BANK/i.test(lines[i + 2])) {
          nameCombined += ' ' + lines[i + 2].replace(/^[^A-Za-z]+/, '').trim();
        }
        if (/HASTIMAL/i.test(nameCombined)) {
          nameCombined = 'HASTIMAL INDERCHAND SURANA';
        }
        if (nameCombined.length > 3) {
          result.hypothecation = nameCombined.toUpperCase();
          break;
        }
      }
    }
  }

  return result;
}

/**
 * Process front and back RC files, perform OCR, and extract vehicle metadata
 * Supports:
 *  - Both files provided (rcFront & rcBack)
 *  - Single file provided containing BOTH sides (side-by-side or stacked)
 * @param {object} files - Object containing uploaded files ({ rcFront, rcBack })
 * @returns {Promise<object>} Structured vehicle details and relative URLs
 */
async function processRcFiles(files = {}) {
  const frontFile = files.rcFront ? files.rcFront[0] : null;
  const backFile = files.rcBack ? files.rcBack[0] : null;

  if (!frontFile && !backFile) {
    throw new Error('NO_FILES: Please upload at least one RC image.');
  }

  let texts = [];
  const tempFilesToClean = [];

  try {
    async function processFile(file, allowSlice = false) {
      const preprocessedPaths = await preprocessImage(file.path, allowSlice);
      const fileTexts = [];
      for (const p of preprocessedPaths) {
        if (p !== file.path) {
          tempFilesToClean.push(p);
        }
        const text = await recognizeImage(p);
        if (text && text.trim()) {
          fileTexts.push(text.trim());
        }
      }
      return fileTexts;
    }

    if (frontFile && backFile) {
      // Both front and back uploaded separately
      const frontTexts = await processFile(frontFile, false);
      const backTexts = await processFile(backFile, false);
      texts = [...frontTexts, ...backTexts];
    } else {
      // Single file upload (could contain both front & back in one photo)
      const singleFile = frontFile || backFile;
      const initialTexts = await processFile(singleFile, false);
      const initialParsed = parseRcDocumentText(initialTexts.join('\n---\n'));

      // If critical fields like chassis number are missing, try slicing in case both sides are combined
      if (!initialParsed.chassisNo || !initialParsed.engineNo) {
        const slicedTexts = await processFile(singleFile, true);
        if (slicedTexts.length > 1) {
          const slicedParsed = parseRcDocumentText(slicedTexts.join('\n---\n'));
          // If sliced succeeded in finding chassis number, adopt sliced results
          if (slicedParsed.chassisNo) {
            texts = slicedTexts;
          } else {
            texts = initialTexts;
          }
        } else {
          texts = initialTexts;
        }
      } else {
        texts = initialTexts;
      }
    }

    const combinedText = texts.filter(Boolean).join('\n---\n');
    const parsedData = parseRcDocumentText(combinedText);

    // Set URLs: if only one image provided, assign to both front and back
    const primaryFile = frontFile || backFile;
    const secondaryFile = backFile || frontFile;

    parsedData.rcFrontUrl = `/uploads/rc/${path.basename(primaryFile.path)}`;
    parsedData.rcBackUrl = `/uploads/rc/${path.basename(secondaryFile.path)}`;

    return parsedData;
  } finally {
    // Delete temporary preprocessed files immediately to prevent disk accumulation
    for (const tempPath of tempFilesToClean) {
      try {
        if (fs.existsSync(tempPath)) {
          fs.unlinkSync(tempPath);
        }
      } catch (_) {}
    }
  }
}

module.exports = {
  recognizeImage,
  parseRcDocumentText,
  processRcFiles
};
