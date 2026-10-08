# Incident: Database Connection Timeout / Pool Exhaustion

## Purpose
Recovery guide for when the PostgreSQL database becomes unresponsive to the application, causing queries to hang and eventually timeout.

## Impact
- API endpoints return 500 Internal Server Error (or 400 Bad Request if masked by global error handler).
- Real-time location data is dropped by the TCP subscriber.
- Log files fill rapidly with `[DB] Query error: timeout exceeded when trying to connect`.

## Symptoms
- Users report the dashboard is entirely broken or stuck loading.
- `pm2 logs fueltracks-api` shows continuous database timeout errors.
- External webhook pushes fail.

## Severity
**P1**

## Immediate Actions
1. **Restart API Service:**
   The connection pool is managed by Node.js (`pg` module). Often, a blocked Node event loop causes the pool connections to hang indefinitely.
   ```bash
   pm2 restart fueltracks-api
   ```

## Diagnosis
If restarting the API does not fix the issue, the problem lies with PostgreSQL itself:
1. Verify PostgreSQL service status:
   ```bash
   sudo systemctl status postgresql
   ```
2. Check if the disk is completely full (preventing DB writes):
   ```bash
   df -h /
   ```
   *(If disk is >95% full, proceed to the `disk-space-critical.md` runbook).*

## Recovery
1. **Restart PostgreSQL:**
   ```bash
   sudo systemctl restart postgresql
   ```
2. **Restart dependent services:**
   Once PostgreSQL is back online, restart the FuelTracks services to re-establish clean connection pools:
   ```bash
   pm2 restart fueltracks-api fueltracks-tcp
   ```

## Validation
1. Tail the API logs:
   ```bash
   pm2 logs fueltracks-api --lines 20 --nostream
   ```
   *Verify presence of `[DB] New API client connected to PostgreSQL`.*
2. Load the frontend dashboard and confirm vehicles/data populate successfully.

## Rollback
"No verified rollback mechanism found."

## Escalation
If PostgreSQL fails to start after a restart, a Database Administrator MUST investigate `/var/log/postgresql/postgresql-16-main.log` for data corruption or WAL (Write-Ahead Logging) failures. **REQUIRES HUMAN APPROVAL** before attempting any database restores from S3 backups.

## Do Not
- **Do not** delete PostgreSQL data directories (`/var/lib/postgresql`).
- **Do not** forcefully kill Postgres processes (`kill -9`) unless standard `systemctl` commands hang for >5 minutes.
