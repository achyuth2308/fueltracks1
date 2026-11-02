# FuelTracks Document Scanner & Extractor Runbook

## 1. Overview
The Document Scanner subsystem processes GPS Fitment Certificates (FuelTracks, Volty), Indian Vehicle Registration Certificates (RC), and Aadhaar cards. It extracts structured fields, computes per-field confidence scores, cross-validates data across multi-source OCR/QR layers, and prepares vehicle onboarding/update records.

---

## 2. Feature Flag & Rollout
The scanner subsystem is governed by the environment variable:
```bash
DOCUMENT_SCANNER_ENABLED=true  # or false to disable
```
- **Flag Parsing**: Strict boolean evaluation via `env.parseStrictBoolean` (`=== 'true'`, case-insensitive).
- **Disabled State**: When `DOCUMENT_SCANNER_ENABLED=false`:
  - API routes under `/api/v1/document-scans` are **unmounted** and return standard `404 Not Found`.
  - The background worker process (`documentScanWorker.js`) immediately exits with exit code 0 without establishing any database connections or loading Tesseract/WASM into memory.

---

## 3. Architecture & Isolation
- **Process Isolation**: The background worker runs as an independent PM2 fork (`fueltracks-doc-scanner`).
- **Connection Isolation**: Scanner queries execute through `scannerPool` (max 3 connections in API, max 1 in worker), preventing any contention with the primary `apiPool` (max 15) or `gpsPool` (max 10).
- **Graceful Shutdown**: Handles `SIGTERM` and `SIGINT` with a 10s grace period (`kill_timeout: 10000`).

---

## 4. Operational Runbook & Health Checks
- **Health Verification**: Check that `fueltracks-doc-scanner` is online in PM2:
  ```bash
  pm2 show fueltracks-doc-scanner
  ```
- **Disk Space Monitoring**: Storage uploads are monitored via `diskGuard.js`. If free disk space drops below 2 GB or inode capacity drops below 5%, uploads are rejected with `507 Insufficient Storage`.

---

## 5. Retention & Privacy Purge
The purge job (`scanRetentionPurgeJob.js`) runs periodically:
- Aadhaar files and records: Unlinked from disk and purged from database after 7 days (or immediately upon confirmation/rejection).
- User Confirmed Data & PII: `user_confirmed_data = NULL`, `extracted_data = {}`, `aadhaar_hmac = NULL`, and `document_scan_fields` cleared.
- Failed scans: Unlinked and purged after 7 days.
- Verified fitment certificates: Unlinked and purged after 90 days.

---

## 6. Manual Revert Procedure for Vehicle Confirmation (Phase 1B)
A scan confirmation applies to exactly one vehicle and is irreversible through the scanner module in v1. If a confirmation was applied mistakenly:
1. Locate the confirmation audit record in `audit_logs`:
   ```sql
   SELECT id, old_data, new_data, performed_by_email, created_at
   FROM audit_logs
   WHERE entity_type = 'Vehicle'
     AND entity_id = '<vehicle_uuid>'
     AND action = 'UPDATED'
     AND new_data->'audit_metadata'->>'scan_id' = '<scan_uuid>'
   ORDER BY id DESC LIMIT 1;
   ```
2. Inspect `old_data` for the vehicle's pre-confirmation state (`model`, `gps_sim_no`, `metadata`).
3. Restore the prior vehicle values via SQL:
   ```sql
   UPDATE vehicles
   SET model = (old_data->>'model'),
       gps_sim_no = (old_data->>'gps_sim_no'),
       metadata = (old_data->'metadata'),
       updated_at = NOW()
   WHERE id = '<vehicle_uuid>';
   ```
4. Purge Redis cache keys for the affected vehicle:
   ```bash
   redis-cli del "vehicle:obj:<vehicle_uuid>"
   redis-cli del "vehicle:imei:<imei>"
   redis-cli del "vehicles:all"
   ```

---

## 7. Package Dependency Clarification (Phase 0 Correction)
In the initial Phase 0 discovery notes, `jimp@1.6.1` was erroneously referenced as an existing installed package. In fact:
- The base repository did **not** have `jimp` in `package.json`.
- `jimp@0.22.12` (pure JavaScript, sharp-free, compatible with CommonJS without native compilation) was introduced and pinned as an exact dependency (`0.22.12`) alongside `jsqr@1.4.0`, `pdfjs-dist@3.11.174`, and `rate-limit-redis@4.2.0`.

---

## 8. PDF Security (CVE-2024-4367) Accepted Exception

| Field | Detail |
|---|---|
| **Vulnerability** | CVE-2024-4367 (PDF.js code execution via font matrix eval) |
| **Affected Package** | `pdfjs-dist@3.11.174` |
| **Mitigation & Interim Controls** | 1. **Code Execution Disablement:** Enforced `isEvalSupported: false`, `disableFontFace: true`, and `useSystemFonts: false` in `pdfTextExtractor.js`. Disabling `isEvalSupported` eliminates the eval path that triggers CVE-2024-4367.<br>2. **Process Isolation:** PDF parsing is performed exclusively inside the background worker process (`fueltracks-doc-scanner`), completely isolated from the main `fueltracks-api` HTTP server.<br>3. **Resource Bounds:** The worker process enforces `--max-old-space-size=768`, a 1G PM2 memory restart ceiling, and a 30s job execution timeout. |
| **Risk Assessment** | Negligible in current runtime configuration because font eval is completely disabled and isolated in a sandboxed worker. |
| **Named Owner** | OWNER: TBD (to be named by Madhu) |
| **Firm Upgrade Target Date** | Q1 2027 (no later than March 31, 2027, upon migrating Node backend services to native ESM / dynamic import for `pdfjs-dist >= 4.2.67`) |

---

## 9. Image Parser & file-type (GHSA-5v7r-6r5c-r473) Advisory Mitigation

| Field | Detail |
|---|---|
| **Vulnerability** | GHSA-5v7r-6r5c-r473 (Infinite loop in ASF parser on malformed input with zero-size sub-header) |
| **Transitive Dependency** | `file-type@16.5.4` (brought in via `jimp@0.22.12`) |
| **Interim Controls & Defense-in-Depth** | 1. **Strict Magic Bytes Intake:** `scannerService.detectTypeFromMagicBytes` inspects the initial 16 bytes of every file before any library processing. Only PDF (`%PDF`), PNG (`0x89 0x50 0x4E 0x47`), and JPEG (`0xFF 0xD8`) are accepted. Any file beginning with ASF GUID (`0x30 0x26 0xB2 0x75...`) or arbitrary headers returns `null` and is immediately rejected.<br>2. **Pre-Decode Header Dimension Validation:** `imagePreprocessor.js` parses width and height directly from standard PNG/JPEG header segments, rejecting decompression bombs (>12 MP / >4000 px) before bitmap instantiation.<br>3. **Zero-Execution of ASF Parser:** Because non-PDF/PNG/JPEG files are rejected before `jimp.read` is called, the vulnerable ASF parsing code path is never reachable. Verified by unit tests in `phase1bConfirmAndMatches.test.js`. |
| **Named Owner** | OWNER: TBD (to be named by Madhu) |
| **Firm Upgrade Target Date** | Q1 2027 (no later than March 31, 2027, when upgrading to modern image pipeline with ESM support) |
