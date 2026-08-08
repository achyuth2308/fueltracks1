#!/bin/bash
# =====================================================================
# FUELTRACKS DATABASE BACKUP — runs via cron: 0 3 * * *
# =====================================================================

DB_NAME="fueltracks"
BACKUP_DIR="/var/backups/postgres"
DATE=$(date +"%Y%m%d_%H%M%S")
FILE_NAME="${DB_NAME}_${DATE}.dump"
LOG_FILE="/var/log/fueltracks_backup.log"
S3_BUCKET="s3://fueltracks-backups"   # set this up in AWS first

mkdir -p $BACKUP_DIR
echo "[$(date)] Starting backup" >> $LOG_FILE

if sudo -u postgres pg_dump -Fc -Z9 $DB_NAME > "$BACKUP_DIR/$FILE_NAME"; then
    echo "[$(date)] Backup successful: $FILE_NAME" >> $LOG_FILE

    if aws s3 cp "$BACKUP_DIR/$FILE_NAME" "$S3_BUCKET/" >> $LOG_FILE 2>&1; then
        echo "[$(date)] Uploaded to S3 successfully" >> $LOG_FILE
    else
        echo "[$(date)] ERROR: S3 upload FAILED — backup is only local!" >> $LOG_FILE
        # Add alerting here (webhook/email) — this must not fail silently
    fi
else
    echo "[$(date)] ERROR: pg_dump failed!" >> $LOG_FILE
    exit 1
fi

# Keep last 14 days locally, S3 lifecycle rules handle long-term retention
find $BACKUP_DIR -type f -name "*.dump" -mtime +14 -exec rm {} \;
echo "[$(date)] Cleaned up old local backups" >> $LOG_FILE
