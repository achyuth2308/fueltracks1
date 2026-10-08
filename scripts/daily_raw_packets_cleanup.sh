#!/bin/bash
# fueltracks1/scripts/daily_raw_packets_cleanup.sh
# Scheduled via crontab to run daily during off-peak hours (e.g., 03:00 AM)
# Purges raw_packets older than 7 days using batched primary key ranges.
set -u

DB_NAME="fueltracks"
TABLE="raw_packets"
BATCH_SIZE=20000
SLEEP_SECS=2
MIN_DISK_KB=15360000       # 15 GB
MAX_WAL_BYTES=4294967296   # 4 GB
LOG_FILE="/home/fueltracks/daily_raw_packets_cleanup.log"
STOP_FILE="/home/fueltracks/STOP_DAILY_CLEANUP"

log_info() { echo "[$(date -u +'%Y-%m-%dT%H:%M:%SZ')] INFO: $1" | tee -a "$LOG_FILE"; }
log_error() { echo "[$(date -u +'%Y-%m-%dT%H:%M:%SZ')] ERROR: $1" | tee -a "$LOG_FILE" >&2; }

validate_number() {
    local val="$1"
    local name="$2"
    if ! [[ "$val" =~ ^[0-9]+$ ]]; then
        log_error "Validation failed for $name. Expected number, got: '$val'"
        exit 1
    fi
}

log_info "============================================="
log_info "Starting daily batch delete on $DB_NAME.$TABLE"
log_info "PID: $$ | To stop safely: touch $STOP_FILE"
log_info "============================================="

if [ -f "$STOP_FILE" ]; then rm "$STOP_FILE"; fi

# 1. Compute CUTOFF_TIME
CUTOFF_TIME=$(sudo -u postgres psql -d "$DB_NAME" -q -t -A -v ON_ERROR_STOP=1 -c "SELECT NOW() - INTERVAL '7 days';")
if [ $? -ne 0 ] || [ -z "$CUTOFF_TIME" ]; then
    log_error "Failed to compute CUTOFF_TIME."
    exit 1
fi
log_info "Fixed CUTOFF_TIME: $CUTOFF_TIME"

# 2. Get min ID and max old ID
MIN_ID=$(sudo -u postgres psql -d "$DB_NAME" -q -t -A -v ON_ERROR_STOP=1 -c "SELECT COALESCE(min(id), 0) FROM $TABLE;")
validate_number "$MIN_ID" "MIN_ID"
if [ "$MIN_ID" -eq 0 ]; then
    log_info "Table empty. Exiting."
    exit 0
fi

MAX_OLD_ID=$(sudo -u postgres psql -d "$DB_NAME" -q -t -A -v ON_ERROR_STOP=1 -c "SELECT COALESCE(max(id), 0) FROM $TABLE WHERE received_at < '$CUTOFF_TIME';")
validate_number "$MAX_OLD_ID" "MAX_OLD_ID"
if [ "$MAX_OLD_ID" -eq 0 ]; then
    log_info "No rows older than cutoff found. Exiting."
    exit 0
fi

log_info "Delete range: ID >= $MIN_ID and ID <= $MAX_OLD_ID"

LO=$MIN_ID
TOTAL_DELETED=0

while [ "$LO" -le "$MAX_OLD_ID" ]; do
    if [ -f "$STOP_FILE" ]; then
        log_info "STOP_FILE detected. Aborting safely."
        exit 1
    fi
    
    AVAIL_KB=$(df -P / | awk 'NR==2 {print $4}')
    validate_number "$AVAIL_KB" "AVAIL_KB"
    if [ "$AVAIL_KB" -lt "$MIN_DISK_KB" ]; then
        log_error "Disk space below threshold (${AVAIL_KB} KB free). Aborting safely."
        exit 1
    fi

    WAL_SIZE_BYTES=$(sudo -u postgres psql -q -t -A -v ON_ERROR_STOP=1 -c "SELECT sum(size) FROM pg_ls_waldir();")
    validate_number "$WAL_SIZE_BYTES" "WAL_SIZE_BYTES"
    if [ "$WAL_SIZE_BYTES" -gt "$MAX_WAL_BYTES" ]; then
        log_error "pg_wal too large ($WAL_SIZE_BYTES bytes). Autovacuum lagging. Aborting safely."
        exit 1
    fi

    HI=$((LO + BATCH_SIZE))
    START_TIME=$(date +%s.%N)
    
    OUTPUT=$(sudo -u postgres psql -d "$DB_NAME" -q -t -A -v ON_ERROR_STOP=1 -c "
        SET lock_timeout = '2s';
        SET statement_timeout = '30s';
        WITH d AS (
            DELETE FROM $TABLE 
            WHERE id >= $LO AND id < $HI 
            AND received_at < '$CUTOFF_TIME'
            RETURNING 1
        ) SELECT count(*) FROM d;
    " 2>&1)
    
    if [ $? -ne 0 ]; then
        log_error "psql failed. Output: $OUTPUT"
        exit 1
    fi
    
    DELETED=$(echo "$OUTPUT" | xargs)
    validate_number "$DELETED" "DELETED_COUNT"
    
    TOTAL_DELETED=$((TOTAL_DELETED + DELETED))
    
    LO=$HI
    sleep $SLEEP_SECS
done

log_info "Daily cleanup finished. Total rows deleted: $TOTAL_DELETED"
exit 0
