#!/bin/bash
# =====================================================================
# FUELTRACKS DAILY GPS DATA ARCHIVAL — runs via cron: 5 0 * * *
# Exports yesterday's completed GPS data, uploads to S3
# =====================================================================

DB_NAME="fueltracks"
YESTERDAY=$(date -d "yesterday" +"%Y-%m-%d")
YEAR=$(date -d "yesterday" +"%Y")
MONTH=$(date -d "yesterday" +"%m")
DAY=$(date -d "yesterday" +"%d")
EXPORT_DIR="/tmp/fueltracks_export"
FILE="$EXPORT_DIR/${DAY}.json"
S3_PATH="s3://fueltracks-archive/${YEAR}/${MONTH}/${DAY}.json.gz"
LOG_FILE="/var/log/fueltracks_archive.log"

mkdir -p $EXPORT_DIR
echo "[$(date)] Exporting GPS data for $YESTERDAY" >> $LOG_FILE

sudo -u postgres psql -d $DB_NAME -t -A -c "
  SELECT json_agg(row_to_json(t))
  FROM (
    SELECT * FROM gps_pings
    WHERE recorded_at::date = '$YESTERDAY'
  ) t
" > $FILE

gzip -f $FILE

if aws s3 cp "${FILE}.gz" "$S3_PATH" >> $LOG_FILE 2>&1; then
    echo "[$(date)] Archived to $S3_PATH" >> $LOG_FILE
    rm -f "${FILE}.gz"
else
    echo "[$(date)] ERROR: archive upload failed, keeping local copy" >> $LOG_FILE
fi
