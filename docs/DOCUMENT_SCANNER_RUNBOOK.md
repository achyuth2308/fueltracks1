# Document Scanner & Extractor - Operations & Engineering Runbook

## 1. Architecture Overview

The Document Scanner module provides asynchronous, privacy-preserving document intake, classification, and field extraction for FuelTracks fleet management (supporting GPS Fitment Certificates, Indian Vehicle RCs, and Aadhaar cards).

### Key Architectural Tenets
- **Asynchronous Intake:** Intake endpoint (`POST /api/v1/document-scans`) validates MIME magic bytes, enforces tenant idempotency, writes file outside public web directories, enqueues to PostgreSQL, and returns HTTP 202 immediately.
- **Dedicated Worker:** `documentScanWorker.js` runs as an isolated PM2 process claiming jobs using `SELECT ... FOR UPDATE SKIP LOCKED` with bounded concurrency (default: 1 worker).
- **Zero OCR Fast-Path for Digital PDFs:** Uses coordinate-based text extraction (`pdfjs-dist@3.11.174` legacy). When an embedded text layer is present, text is extracted with exact coordinates and zero OCR/rasterisation overhead.
- **Lazy OCR Engine:** `ocrProvider.js` loads Tesseract.js WASM and models only on the first OCR job. When idle or when the feature flag is disabled, zero WASM memory or workers are allocated.
- **DPDP & Aadhaar Privacy Compliance:** Full 12-digit Aadhaar numbers are **NEVER** stored in the database or logged in plain text. Numbers are immediately validated with the Verhoeff algorithm, masked to `XXXX-XXXX-last4`, and fingerprinted with a salted HMAC (`AADHAAR_HMAC_PEPPER`). If consent is missing, the file is unlinked immediately and failed with `AADHAAR_CONSENT_REQUIRED`.
- **Database Connection Isolation:** Uses an isolated `scannerPool` (max 3 connections, `options: '-c timezone=UTC'`) completely separate from the core API and GPS ingest pools.

---

## 2. Process & PM2 Management

The scanner and its scheduled purge job are managed via `ecosystem.config.js`:

```bash
# Start background worker
pm2 start ecosystem.config.js --only fueltracks-doc-scanner

# Start daily retention purge job
pm2 start ecosystem.config.js --only fueltracks-scanner-purge

# Check status and memory
pm2 status
pm2 logs fueltracks-doc-scanner
```

### Resource Limits
- `fueltracks-doc-scanner`: Concurrency 1 (single worker loop), memory threshold 350MB (`max_memory_restart: '400M'`).
- `fueltracks-scanner-purge`: Runs once daily at 03:00 IST / 21:30 UTC.

---

## 3. Database Connection Budget

Total connection budget across all processes against PostgreSQL `max_connections = 50`:

| Process / Pool | Pool Size | Notes |
| :--- | :--- | :--- |
| `fueltracks-api` (API Pool) | 15 (max 25) | Handles client HTTP traffic |
| `fueltracks-subscriber` / TCP | 10 | Real-time GPS device packets |
| `fueltracks-doc-scanner` (`scannerPool`) | 3 | Worker pool for claiming and updating scan jobs |
| `fueltracks-scanner-purge` | 1 | Ephemeral connection during daily purge run |
| Superuser reserved | 3 | Reserved by PostgreSQL for maintenance/admin (`superuser_reserved_connections`) |
| **Total Peak Usage** | **32** | **Headroom: 18 connections remaining** |

---

## 4. Migration & Rollback Runbook

### Migration Policy
Migrations must be run **ONCE manually** by an operations engineer using the dedicated migration scripts. Migrations must **NEVER** auto-run on boot of every PM2 instance to avoid schema lock contention and race conditions.

```bash
# Run migration manually on target database
node scripts/testMigrationUpDown.js
# OR execute via psql:
# psql -h 127.0.0.1 -p 5433 -U postgres -d fueltracks -f database/document_scanner_migration.sql
```

### Strict Rollback Procedure (4-Step Order)
If an emergency rollback is required, perform the steps in this strict sequential order:

1. **Step 1 - Disable Feature Flag:**
   Set `DOCUMENT_SCANNER_ENABLED=false` in `.env` and reload the API:
   ```bash
   pm2 reload fueltracks-api
   ```
   *Result:* All scanner endpoints immediately return 503 and reject new uploads.

2. **Step 2 - Stop the Scanner Worker:**
   ```bash
   pm2 stop fueltracks-doc-scanner
   pm2 stop fueltracks-scanner-purge
   ```
   *Result:* No active queries or transactions are open on the scanner tables.

3. **Step 3 - Dump Data for Backup:**
   Before dropping any schema, backup the two tables:
   ```bash
   pg_dump -h 127.0.0.1 -p 5433 -U postgres -d fueltracks -t document_scans -t document_scan_fields -F c -b -v -f /var/backups/document_scans_pre_rollback_$(date +%Y%m%d%H%M%S).dump
   ```

4. **Step 4 - Execute DOWN Migration:**
   Only after Steps 1-3 are verified, execute the down migration:
   ```bash
   psql -h 127.0.0.1 -p 5433 -U postgres -d fueltracks -f database/document_scanner_migration_down.sql
   ```

---

## 5. Adding a New Document Template

Template definitions are config-driven and reside in `backend/config/templates/`:

1. Create a new JSON file: `backend/config/templates/<template_name>.json`.
2. Define:
   - `id`: unique identifier (e.g., `volty`, `fueltracks`).
   - `name`: Human-readable name.
   - `documentType`: `fitment_certificate`, `rc`, or `aadhaar`.
   - `headerRules`: Array of required identifying substrings and layout signals.
   - `sections`: Coordinate boundaries or label identifiers.
   - `fieldMappings`: Mapping from recognized labels to standardized field keys.
3. Add a golden test in `backend/tests/` asserting 100% extraction accuracy on real or synthetic samples.
4. Restart the worker (`pm2 restart fueltracks-doc-scanner`).

---

## 6. Data Retention & Purge Policy

Executed by `backend/jobs/scanRetentionPurgeJob.js`:

| Data Category | Retention Period | Action Taken |
| :--- | :--- | :--- |
| **Aadhaar Records** | 7 days | Masked record retained; underlying image file unlinked from disk; status set to `purged`. |
| **Failed Scans** | 7 days | Temporary upload unlinked from disk; status set to `purged`. |
| **General Scans** | 90 days | Scanned records marked `purged` and binary files removed to conserve tenant storage. |

---

## 7. Monitoring & Alerting

### Key Health Metrics to Monitor
- `queue_depth`: `SELECT count(*) FROM document_scans WHERE status = 'queued';` (Alert if > 50 for > 5 mins).
- `stale_locks`: `SELECT count(*) FROM document_scans WHERE status = 'processing' AND locked_at < NOW() - INTERVAL '5 minutes';` (Alert if > 2).
- `circuit_breaker_tripped`: Alert if worker logs contain `CIRCUIT_BREAKER_OPEN`.
- `disk_space_guard`: Alert if storage volume drops below 2GB free disk.
