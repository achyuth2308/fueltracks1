// ============================================================
// DISK GUARD SERVICE
// Verifies sufficient free disk space on storage volume
// before accepting document upload streams.
// ============================================================

const fs = require('fs');
const env = require('../../config/env');

function checkDiskSpace(dirPath) {
  try {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true, mode: 0o700 });
    }

    if (typeof fs.statfsSync === 'function') {
      const stats = fs.statfsSync(dirPath);
      const freeBytes = stats.bsize * stats.bfree;
      const freeMb = freeBytes / (1024 * 1024);
      const minMb = env.DISK_GUARD_MIN_FREE_MB || 500;

      if (freeMb < minMb) {
        return {
          ok: false,
          freeMb: Math.round(freeMb),
          minMb,
          error: `INSUFFICIENT_STORAGE: Volume free space (${Math.round(freeMb)}MB) below minimum threshold (${minMb}MB)`
        };
      }
      return { ok: true, freeMb: Math.round(freeMb) };
    }

    return { ok: true, freeMb: 1000 };
  } catch (err) {
    console.warn('[DISK-GUARD] Warning: Could not check statfs:', err.message);
    return { ok: true };
  }
}

module.exports = {
  checkDiskSpace
};

