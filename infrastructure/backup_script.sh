#!/bin/bash
# =====================================================================
# FUELTRACKS DATABASE BACKUP — runs via cron: 0 3 * * *
#
# SETUP:
#   1. Set ALERT_WEBHOOK_URL in /etc/environment or the crontab environment:
#      ALERT_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
#      (Slack, Discord, and any generic HTTP POST webhook are supported.)
#      Leave unset to disable webhook alerting (log-only mode).
#   2. Ensure S3_BUCKET below points at your actual bucket.
#   3. Ensure the 'fueltracks' user has AWS credentials via ~/.aws/credentials
#      or an IAM instance role.
#   4. Test the restore path before relying on this script in production:
#        pg_restore -Fc -d fueltracks_restore <backup_file>
# =====================================================================

DB_NAME="fueltracks"
BACKUP_DIR="/var/backups/postgres"
DATE=$(date +"%Y%m%d_%H%M%S")
FILE_NAME="${DB_NAME}_${DATE}.dump"
LOG_FILE="/var/log/fueltracks_backup.log"
S3_BUCKET="s3://fueltracks-backups"   # set this up in AWS first

# Webhook URL for failure alerting (Slack, Discord, generic HTTP POST).
# Set in /etc/environment or as a cron environment variable.
# Leave empty to disable webhook alerting (logs will still capture the error).
ALERT_WEBHOOK_URL="${ALERT_WEBHOOK_URL:-}"

# ── Alert helper ──────────────────────────────────────────────────────
# Logs the message and POSTs to the webhook if one is configured.
# This function never itself exits non-zero — it wraps all errors.
send_alert() {
  local msg="$1"
  echo "[$(date)] ALERT: $msg" >> "$LOG_FILE"
  if [ -n "$ALERT_WEBHOOK_URL" ]; then
    curl -s --max-time 10 -X POST \
      -H "Content-Type: application/json" \
      -d "{\"text\": \"🚨 FuelTracks Backup Alert ($(hostname)): $msg\"}" \
      "$ALERT_WEBHOOK_URL" >> "$LOG_FILE" 2>&1 || \
      echo "[$(date)] WARNING: webhook POST itself failed — check ALERT_WEBHOOK_URL" >> "$LOG_FILE"
  fi
}
# ─────────────────────────────────────────────────────────────────────

mkdir -p "$BACKUP_DIR"
echo "[$(date)] Starting backup" >> "$LOG_FILE"

if sudo -u postgres pg_dump -Fc -Z9 "$DB_NAME" > "$BACKUP_DIR/$FILE_NAME"; then
    echo "[$(date)] Backup successful: $FILE_NAME" >> "$LOG_FILE"

    if aws s3 cp "$BACKUP_DIR/$FILE_NAME" "$S3_BUCKET/" >> "$LOG_FILE" 2>&1; then
        echo "[$(date)] Uploaded to S3 successfully" >> "$LOG_FILE"
    else
        send_alert "S3 upload FAILED — backup is only local at $BACKUP_DIR/$FILE_NAME. Investigate and re-upload manually."
        exit 1
    fi
else
    send_alert "pg_dump FAILED on $(hostname) — no backup was created! Database may be in trouble."
    exit 1
fi

# Keep last 14 days locally, S3 lifecycle rules handle long-term retention
find "$BACKUP_DIR" -type f -name "*.dump" -mtime +14 -exec rm {} \;
echo "[$(date)] Cleaned up old local backups" >> "$LOG_FILE"

