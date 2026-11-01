// ============================================================
// DOCUMENT SCAN RETENTION & PURGE JOB
// Compliance & Storage Cleanup:
//  - Aadhaar hard retention cap: AADHAAR_RETENTION_DAYS (default 7 days)
//  - Failed scans file cleanup: 7 days
//  - Fitment/RC scan data & file cleanup: SCAN_RETENTION_DAYS (default 90 days)
//  - Purges in small batches (100 rows per loop with pause) to avoid locks
//  - Sets aadhaar_hmac and file_path to NULL upon purge
// ============================================================

const fs = require('fs');
const { getScannerPool } = require('../config/scannerDb');
const env = require('../config/env');

const BATCH_SIZE = 100;
const PAUSE_BETWEEN_BATCHES_MS = 250;

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runRetentionPurge() {
  const pool = getScannerPool('fueltracks-scanner-purge', 1);
  if (!pool) return;

  const aadhaarDays = env.AADHAAR_RETENTION_DAYS || 7;
  const scanDays = env.SCAN_RETENTION_DAYS || 90;

  console.log(`[RETENTION-PURGE] Starting purge (Aadhaar: ${aadhaarDays}d, Scans: ${scanDays}d)...`);

  let totalFilesUnlinked = 0;
  let totalScansPurged = 0;

  try {
    // 1. Purge Aadhaar Scans past AADHAAR_RETENTION_DAYS
    while (true) {
      const candidates = await pool.query(`
        SELECT id, file_path FROM document_scans
        WHERE document_type = 'aadhaar'
          AND status != 'purged'
          AND (status IN ('rejected', 'confirmed') OR created_at < NOW() - ($1 || ' days')::interval)
        LIMIT $2
      `, [String(aadhaarDays), BATCH_SIZE]);

      if (candidates.rows.length === 0) break;

      for (const row of candidates.rows) {
        if (row.file_path && fs.existsSync(row.file_path)) {
          try {
            fs.unlinkSync(row.file_path);
            totalFilesUnlinked++;
          } catch (_) {}
        }

        await pool.query(`
          UPDATE document_scans
          SET status = 'purged',
              file_path = '[PURGED]',
              extracted_data = '{}'::jsonb,
              user_confirmed_data = NULL,
              aadhaar_last4 = NULL,
              aadhaar_hmac = NULL,
              updated_at = NOW()
          WHERE id = $1
        `, [row.id]);

        await pool.query('DELETE FROM document_scan_fields WHERE scan_id = $1', [row.id]);
        totalScansPurged++;
      }

      await sleep(PAUSE_BETWEEN_BATCHES_MS);
    }

    // 2. Purge General Scans past SCAN_RETENTION_DAYS
    while (true) {
      const candidates = await pool.query(`
        SELECT id, file_path FROM document_scans
        WHERE status != 'purged'
          AND created_at < NOW() - ($1 || ' days')::interval
        LIMIT $2
      `, [String(scanDays), BATCH_SIZE]);

      if (candidates.rows.length === 0) break;

      for (const row of candidates.rows) {
        if (row.file_path && fs.existsSync(row.file_path)) {
          try {
            fs.unlinkSync(row.file_path);
            totalFilesUnlinked++;
          } catch (_) {}
        }

        await pool.query(`
          UPDATE document_scans
          SET status = 'purged',
              file_path = '[PURGED]',
              extracted_data = '{}'::jsonb,
              user_confirmed_data = NULL,
              updated_at = NOW()
          WHERE id = $1
        `, [row.id]);

        await pool.query('DELETE FROM document_scan_fields WHERE scan_id = $1', [row.id]);
        totalScansPurged++;
      }

      await sleep(PAUSE_BETWEEN_BATCHES_MS);
    }

    // 3. Purge Orphaned Failed Scan Files older than 7 days
    while (true) {
      const candidates = await pool.query(`
        SELECT id, file_path FROM document_scans
        WHERE status = 'failed'
          AND file_path != '[PURGED]'
          AND created_at < NOW() - INTERVAL '7 days'
        LIMIT $1
      `, [BATCH_SIZE]);

      if (candidates.rows.length === 0) break;

      for (const row of candidates.rows) {
        if (row.file_path && fs.existsSync(row.file_path)) {
          try {
            fs.unlinkSync(row.file_path);
            totalFilesUnlinked++;
          } catch (_) {}
        }

        await pool.query(`
          UPDATE document_scans
          SET file_path = '[PURGED]',
              updated_at = NOW()
          WHERE id = $1
        `, [row.id]);
      }

      await sleep(PAUSE_BETWEEN_BATCHES_MS);
    }

    console.log(`[RETENTION-PURGE] Finished. Purged ${totalScansPurged} scans, unlinked ${totalFilesUnlinked} files.`);
  } catch (err) {
    console.error('[RETENTION-PURGE] Error during purge:', err.message);
  }
}

if (require.main === module) {
  runRetentionPurge().then(() => process.exit(0));
}

module.exports = {
  runRetentionPurge
};

