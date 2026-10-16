#!/bin/bash
# ==============================================================================
# Nightly Sensor Logs (raw_packets) Cleanup Job
# Keeps vehicle tracking history, trips, and reports (gps_points) 100% intact.
# Only deletes ephemeral hardware debug sensor logs older than 3 days.
# ==============================================================================

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting sensor logs cleanup (older than 3 days)..."

sudo -u postgres psql -d fueltracks -c "DELETE FROM raw_packets WHERE received_at < NOW() - INTERVAL '3 days';"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Sensor logs cleanup complete."
