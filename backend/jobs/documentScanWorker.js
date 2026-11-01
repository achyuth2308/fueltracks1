// ============================================================
// DOCUMENT SCANNER BACKGROUND WORKER
// Production-grade queue worker claiming rows with SKIP LOCKED
//  - Concurrency bounded (default 1)
//  - Increments attempts at CLAIM time (crash & OOM protection)
//  - Connects ONLY to scannerPool (never touches apiPool or gpsPool)
//  - Visibility timeout (5m) recovers zombie processing rows
//  - Rechecks DOCUMENT_SCANNER_ENABLED flag every poll loop
//  - Graceful shutdown handling (releases current claim on SIGTERM)
// ============================================================

const { getScannerPool } = require('../config/db');
const env = require('../config/env');
const scannerService = require('../services/documentScanner/scannerService');
const ocrProvider = require('../services/documentScanner/ocrProvider');

const WORKER_ID = `scanner-worker-${process.pid}`;
const POLL_INTERVAL_MS = 2000;
const MAX_BACKOFF_MS = 10000;
const VISIBILITY_TIMEOUT_SECONDS = 300; // 5 minutes

let isRunning = false;
let isShuttingDown = false;
let currentJobId = null;
let emptyPollCount = 0;

// Worker metrics
const metrics = {
  jobsClaimed: 0,
  jobsCompleted: 0,
  jobsFailed: 0,
  resolvedWithoutOcr: 0,
  totalProcessingTimeMs: 0
};

/**
 * Recovers stuck jobs in 'processing' state where visibility timeout expired
 */
async function recoverStuckJobs() {
  const pool = getScannerPool();
  try {
    const res = await pool.query(`
      UPDATE document_scans
      SET status = CASE WHEN attempts >= max_attempts THEN 'failed' ELSE 'queued' END,
          error_code = CASE WHEN attempts >= max_attempts THEN 'MAX_ATTEMPTS_EXCEEDED' ELSE 'VISIBILITY_TIMEOUT_RECOVERED' END,
          error_message = 'Job recovered after worker visibility timeout',
          next_attempt_at = NOW(),
          updated_at = NOW()
      WHERE status = 'processing'
        AND locked_at < NOW() - ($1 || ' seconds')::interval
      RETURNING id, attempts, status
    `, [String(VISIBILITY_TIMEOUT_SECONDS)]);

    if (res.rowCount > 0) {
      console.warn(`[SCANNER-WORKER] Recovered ${res.rowCount} stuck processing job(s).`);
    }
    return res.rowCount;
  } catch (err) {
    console.error('[SCANNER-WORKER] Error recovering stuck jobs:', err.message);
    return 0;
  }
}

/**
 * Claims a single queued job atomically using SKIP LOCKED
 */
async function claimNextJob() {
  const pool = getScannerPool();
  try {
    const res = await pool.query(`
      UPDATE document_scans
      SET status = 'processing',
          attempts = attempts + 1,
          locked_at = NOW(),
          locked_by = $1,
          updated_at = NOW()
      WHERE id = (
        SELECT id FROM document_scans
        WHERE status = 'queued'
          AND next_attempt_at <= NOW()
          AND attempts < max_attempts
          AND deleted_at IS NULL
        ORDER BY next_attempt_at ASC, created_at ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      )
      RETURNING *
    `, [WORKER_ID]);

    if (res.rowCount > 0) {
      return res.rows[0];
    }
    return null;
  } catch (err) {
    console.error('[SCANNER-WORKER] Claim error:', err.message);
    return null;
  }
}

/**
 * Main worker loop iteration
 */
async function pollAndProcess() {
  if (!isRunning || isShuttingDown) return;

  // 1. Feature Flag Guard: If disabled, stay idle and do not query database
  if (!env.DOCUMENT_SCANNER_ENABLED && process.env.DOCUMENT_SCANNER_ENABLED !== 'true') {
    setTimeout(pollAndProcess, 5000);
    return;
  }

  // Periodic visibility recovery (every ~30 polls)
  if (Math.random() < 0.03) {
    await recoverStuckJobs();
  }

  const job = await claimNextJob();

  if (!job) {
    emptyPollCount++;
    const backoff = Math.min(MAX_BACKOFF_MS, POLL_INTERVAL_MS * Math.pow(1.5, Math.min(emptyPollCount, 5)));
    setTimeout(pollAndProcess, backoff);
    return;
  }

  emptyPollCount = 0;
  currentJobId = job.id;
  metrics.jobsClaimed++;
  const startTime = Date.now();

  try {
    const result = await scannerService.processScanJob(job, WORKER_ID);
    const duration = Date.now() - startTime;
    metrics.jobsCompleted++;
    metrics.totalProcessingTimeMs += duration;

    if (result.sourceUsed === 'pdf_text') {
      metrics.resolvedWithoutOcr++;
    }

    console.log(`[SCANNER-WORKER] Completed job ${job.id} [${result.status}] in ${duration}ms`);
  } catch (err) {
    metrics.jobsFailed++;
    console.error(`[SCANNER-WORKER] Job ${job.id} failed:`, err.message);
  } finally {
    currentJobId = null;
    if (isRunning && !isShuttingDown) {
      setImmediate(pollAndProcess);
    }
  }
}

function start() {
  if (isRunning) return;
  isRunning = true;
  console.log(`[SCANNER-WORKER] Started ${WORKER_ID} (Concurrency: ${env.DOCUMENT_SCANNER_WORKERS || 1})`);
  pollAndProcess();
}

async function stop() {
  if (!isRunning) return;
  isShuttingDown = true;
  isRunning = false;
  console.log(`[SCANNER-WORKER] Stopping ${WORKER_ID}...`);

  // If a job is currently claimed, wait briefly or release lock
  if (currentJobId) {
    try {
      const pool = getScannerPool();
      await pool.query(`
        UPDATE document_scans
        SET status = 'queued',
            locked_at = NULL,
            locked_by = NULL,
            updated_at = NOW()
        WHERE id = $1 AND status = 'processing' AND locked_by = $2
      `, [currentJobId, WORKER_ID]);
      console.log(`[SCANNER-WORKER] Released in-flight job ${currentJobId} back to queued`);
    } catch (_) {}
  }

  await ocrProvider.terminateWorker();
  console.log(`[SCANNER-WORKER] Stopped successfully.`);
}

function getMetrics() {
  return {
    ...metrics,
    avgProcessingTimeMs: metrics.jobsCompleted > 0 ? Math.round(metrics.totalProcessingTimeMs / metrics.jobsCompleted) : 0,
    pctResolvedWithoutOcr: metrics.jobsCompleted > 0 ? Math.round((metrics.resolvedWithoutOcr / metrics.jobsCompleted) * 100) : 0
  };
}

// Standalone execution entrypoint: node backend/jobs/documentScanWorker.js
if (require.main === module) {
  start();
  process.on('SIGTERM', async () => {
    await stop();
    process.exit(0);
  });
  process.on('SIGINT', async () => {
    await stop();
    process.exit(0);
  });
}

module.exports = {
  start,
  stop,
  getMetrics,
  claimNextJob,
  recoverStuckJobs
};
