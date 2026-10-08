# Incident: API Server 502 Bad Gateway / Out of Memory (OOM) Crash

## Purpose
Recovery guide for when the FuelTracks REST API (`fueltracks-api`) becomes unresponsive, returns 502 Bad Gateway, or is caught in an endless crash loop by PM2 due to heap memory exhaustion.

## Impact
- Frontend dashboard fails to load data (API calls fail).
- Real-time Socket.io connections drop for users.
- Third-party API integrations (e.g., Cement OMS) fail.

## Symptoms
- HTTP 502 Bad Gateway observed by users or clients.
- `pm2 status` shows `fueltracks-api` with high restart count.
- Logs (`/var/log/pm2/fueltracks-api-error.log`) contain:
  - `FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory`
  - `[SCLEN PUSH] ❌ Failed to push for ... timeout of 5000ms exceeded`
  - `[DB] Query error: timeout exceeded when trying to connect`

## Severity
**P0**

## Immediate Actions
1. Restart the API to temporarily flush memory:
   `pm2 restart fueltracks-api`
2. If it crashes again within minutes, proceed to Diagnosis.

## Diagnosis
1. Check PM2 logs for the API process:
   ```bash
   pm2 logs fueltracks-api --lines 100 --nostream
   ```
2. Look for blocked promises or external request timeouts. The most common verified cause in this project is synchronous/heavy operations (like reverse-geocoding via `getAddress`) inside fire-and-forget loops like `backend/services/sclenPushService.js` or `backend/services/webhookService.js`.

## Recovery
1. **Disable External Dependencies (If blocking):**
   If third-party webhooks (e.g., Coromandel) are timing out and causing the memory leak:
   - Edit `backend/services/sclenPushService.js`.
   - Temporarily bypass synchronous external calls (e.g., replace `await getAddress(...)` with a hardcoded string `"LIVE LOCATION"`).
2. **Apply the fix and restart:**
   ```bash
   pm2 restart fueltracks-api --update-env
   ```

## Validation
- Monitor PM2 memory usage: `pm2 monit` (Watch `fueltracks-api` memory). It should remain well below the 512MB limit defined in `ecosystem.config.js`.
- Make a test API call: `curl -I https://api.fueltracks.in/api/v1/vehicles` (Should return 200/401, NOT 502).

## Rollback
- Revert changes to `sclenPushService.js` or `webhookService.js` once the external service stabilizes.
- `pm2 restart fueltracks-api`.

## Escalation
If memory leaks persist after disabling external webhooks, human intervention is required to profile Node.js memory usage (e.g., via Chrome DevTools inspector).

## Do Not
- **Do not** increase `max-old-space-size` in `ecosystem.config.js` beyond safe server limits; fixing the memory leak is required, not delaying it.
