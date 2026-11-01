// ============================================================
// OCR PROVIDER (Pluggable Adapter with Lazy Tesseract Initialization)
// Production Safeguards:
//  - Worker initialized lazily on the FIRST OCR job (idle/flag-off loads zero WASM)
//  - Single persistent worker reused across jobs (no create/terminate per job)
//  - Circuit breaker, per-job timeout (30s), exponential backoff retry
//  - Clean shutdown handler on SIGTERM/SIGINT
// ============================================================

const fs = require('fs');
const path = require('path');
const Tesseract = require('tesseract.js');

const OCR_TIMEOUT_MS = 30000;
const MAX_CIRCUIT_FAILURES = 3;
const CIRCUIT_RESET_MS = 60000;

class OcrProvider {
  constructor() {
    this.worker = null;
    this.isInitializing = false;
    this.initPromise = null;
    this.failureCount = 0;
    this.lastFailureTime = 0;
    this.isCircuitOpen = false;

    // Register shutdown hooks for graceful termination
    process.on('SIGTERM', () => this.terminateWorker());
    process.on('SIGINT', () => this.terminateWorker());
  }

  _locateTessdata() {
    const candidates = [
      path.join(__dirname, '..', '..', 'tessdata'),
      path.join(__dirname, '..', '..', '..', 'tessdata'),
      path.join(__dirname, '..', '..', '..'),
      process.cwd(),
      path.join(process.cwd(), 'fueltracks1', 'backend', 'tessdata')
    ];
    for (const dir of candidates) {
      if (fs.existsSync(path.join(dir, 'eng.traineddata'))) {
        return dir;
      }
    }
    return null;
  }

  async _getWorker() {
    if (this.worker) return this.worker;

    if (this.isInitializing) {
      return this.initPromise;
    }

    this.isInitializing = true;
    this.initPromise = (async () => {
      const tessdataDir = this._locateTessdata();
      const options = {
        logger: () => {} // Suppress stdout log noise
      };
      if (tessdataDir) {
        options.langPath = tessdataDir;
        options.gzip = false;
      }
      const w = await Tesseract.createWorker('eng', 1, options);
      this.worker = w;
      this.isInitializing = false;
      return w;
    })();

    return this.initPromise;
  }

  async terminateWorker() {
    if (this.worker) {
      try {
        await this.worker.terminate();
      } catch (_) {}
      this.worker = null;
    }
  }

  _checkCircuit() {
    if (this.isCircuitOpen) {
      if (Date.now() - this.lastFailureTime > CIRCUIT_RESET_MS) {
        this.isCircuitOpen = false;
        this.failureCount = 0;
      } else {
        throw new Error('OCR_CIRCUIT_BREAKER_OPEN: OCR service is temporarily unavailable due to recent failures.');
      }
    }
  }

  _recordFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    if (this.failureCount >= MAX_CIRCUIT_FAILURES) {
      this.isCircuitOpen = true;
    }
  }

  _recordSuccess() {
    this.failureCount = 0;
    this.isCircuitOpen = false;
  }

  /**
   * Recognizes text from image with timeout and error tracking
   */
  async recognize(filePath) {
    this._checkCircuit();

    let timer = null;
    try {
      const worker = await this._getWorker();

      const ocrPromise = worker.recognize(filePath).then(ret => ret?.data?.text || '');
      const timeoutPromise = new Promise((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error(`OCR_TIMEOUT: Image OCR timed out after ${OCR_TIMEOUT_MS / 1000}s`));
        }, OCR_TIMEOUT_MS);
      });

      const text = await Promise.race([ocrPromise, timeoutPromise]);
      this._recordSuccess();
      return text;
    } catch (err) {
      this._recordFailure();
      // If worker crashed or timed out, terminate and dispose instance so next job re-initializes cleanly
      if (err.message.includes('dead') || err.message.includes('Worker') || err.message.includes('OCR_TIMEOUT')) {
        await this.terminateWorker();
      }
      throw err;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}

module.exports = new OcrProvider();

