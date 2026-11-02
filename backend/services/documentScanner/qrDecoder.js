// ============================================================
// QR CODE DECODER SERVICE (jsQR + Jimp)
// Extracts QR payloads, verification URLs, and hashes from images.
// High-trust data source cross-checked against extracted fields.
// ============================================================

const Jimp = require('jimp');
const jsQR = require('jsqr');

/**
 * Decodes QR code from an image file
 * Returns { found: boolean, data?: string, error?: string }
 */
async function decodeQrCode(filePath) {
  try {
    const image = await Jimp.read(filePath);
    const { width, height, data } = image.bitmap;

    // Convert Jimp RGBA Uint8Array to ClampedArray for jsQR
    const clampedArray = new Uint8ClampedArray(data.buffer);
    const code = jsQR(clampedArray, width, height, {
      inversionAttempts: 'attemptBoth'
    });

    if (code && code.data) {
      return {
        found: true,
        data: code.data.trim(),
        location: code.location
      };
    }

    return { found: false, data: null };
  } catch (err) {
    return { found: false, error: err.message };
  }
}

/**
 * Parses verification QR URLs (e.g. https://www.fueltracks.in/verify/FT-GPS-2026-87570)
 */
function parseQrPayload(payload) {
  if (!payload || typeof payload !== 'string') return null;

  const urlMatch = payload.match(/verify\/(FT-GPS-\d{4}-\w+)/i);
  if (urlMatch) {
    return {
      type: 'fueltracks_verify_url',
      certificate_number: urlMatch[1]
    };
  }

  // Check if raw key-value or delimited QR
  if (payload.includes(':') && payload.includes('FT-GPS')) {
    const parts = payload.split(':');
    return {
      type: 'fueltracks_raw_hash',
      certificate_number: parts[0],
      imei: parts[1] || null,
      vehicle_no: parts[2] || null
    };
  }

  return {
    type: 'generic_qr',
    raw: payload
  };
}

module.exports = {
  decodeQrCode,
  parseQrPayload
};

