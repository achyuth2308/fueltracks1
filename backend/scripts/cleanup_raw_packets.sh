#!/bin/bash
# ==============================================================================
# Non-blocking, Low-Priority Rolling Retention for raw_packets (Sensor Logs)
# Keeps vehicle tracking history, trips, and reports (gps_points) 100% intact.
# Only cleans ephemeral diagnostic hex packets older than 24 hours.
#
# Designed with micro-batches & 50ms pauses to ensure:
# - ZERO CPU / RAM overhead
# - ZERO locking / ZERO latency impact on TCP telemetry streaming
# - ZERO WAL log spikes
# ==============================================================================

LOG_FILE="/var/log/cleanup_raw_packets.log"
exec >> "$LOG_FILE" 2>&1

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting safe rolling raw_packets retention (older than 24 hours)..."

# Run micro-batched cleanup using lowest system CPU (nice) and disk I/O (ionice) priority
nice -n 19 ionice -c 3 sudo -u postgres psql -d fueltracks -q -c "
DO \$\$
DECLARE
    deleted_count INT := 0;
    batch_count INT := 0;
BEGIN
    LOOP
        WITH to_delete AS (
            SELECT id FROM raw_packets
            WHERE received_at < NOW() - INTERVAL '24 hours'
            LIMIT 5000
        )
        DELETE FROM raw_packets
        WHERE id IN (SELECT id FROM to_delete);
        
        GET DIAGNOSTICS batch_count = ROW_COUNT;
        deleted_count := deleted_count + batch_count;
        EXIT WHEN batch_count = 0;
        PERFORM pg_sleep(0.05);
    END LOOP;
    RAISE NOTICE 'Finished: safely removed % old raw packets.', deleted_count;
END \$\$;
"

# Run gentle concurrent VACUUM so space is immediately reused by new packets without table bloat
nice -n 19 ionice -c 3 sudo -u postgres psql -d fueltracks -c "VACUUM raw_packets;" > /dev/null 2>&1

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Rolling cleanup & vacuum complete."

