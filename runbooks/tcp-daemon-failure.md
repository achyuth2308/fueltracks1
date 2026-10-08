# Incident: TCP Ingestion Server Failure

## Purpose
Recovery guide for when GPS trackers stop reporting data to the platform because the raw TCP ingestion daemon (`fueltracks-tcp`) has crashed, frozen, or failed to bind to its listening ports (5000, 5001, 5002).

## Impact
- Hardware GPS devices cannot establish connections.
- Vehicles show as "Offline" on the dashboard.
- No new historical data is saved to PostgreSQL.

## Symptoms
- Devices report "Offline" across the entire platform.
- `pm2 status` shows `fueltracks-tcp` restarting continuously or stopped.
- Logs (`/var/log/pm2/fueltracks-tcp-error.log`) contain:
  - `Error: listen EADDRINUSE: address already in use :::5000`
  - Unhandled exception errors in protocol parsers.

## Severity
**P0**

## Immediate Actions
1. Attempt a standard restart:
   ```bash
   pm2 restart fueltracks-tcp
   ```
2. If the logs indicate `EADDRINUSE`, a stale ghost process is holding the ports. Proceed to Diagnosis & Recovery.

## Diagnosis
1. Check which process is holding the TCP ports:
   ```bash
   sudo netstat -tulpn | grep -E '5000|5001|5002'
   # OR
   sudo fuser 5000/tcp 5001/tcp 5002/tcp
   ```
2. Check recent errors in the TCP log:
   ```bash
   pm2 logs fueltracks-tcp --lines 50 --nostream
   ```
   *Look for malformed hex strings crashing the Concox or BSTPL parsers.*

## Recovery
1. **Kill stale processes holding ports:**
   ```bash
   sudo fuser -k 5000/tcp 5001/tcp 5002/tcp
   ```
2. **Restart the TCP Daemon:**
   ```bash
   pm2 start fueltracks-tcp  # or pm2 restart
   ```

## Validation
1. Verify the daemon is running and bound to ports:
   ```bash
   pm2 logs fueltracks-tcp --lines 20 --nostream
   ```
   *You should see "BSTPL Server listening on 5000", "AIS140 Server listening on 5001", etc.*
2. Check the frontend dashboard: Vehicles should begin updating their "Last Seen" times within 1-2 minutes as devices reconnect and transmit heartbeats.

## Rollback
No verified rollback mechanism found, as this is a process recovery operation, not a deployment.

## Escalation
If `fueltracks-tcp` continues to crash immediately upon receiving a specific packet from a device, a human developer MUST inspect the protocol parser (e.g., `tcp-server/parser/concoxParser.js`) to add an error boundary around the malformed packet parsing.

## Do Not
- **Do not** change `ecosystem.config.js` to run `fueltracks-tcp` in cluster mode (`instances: max`). Hardware TCP sockets require persistent connection state (fork mode). Cluster mode will instantly break multi-packet protocols.
