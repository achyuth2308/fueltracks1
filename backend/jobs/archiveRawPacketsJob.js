const db = require('../config/db');
const { uploadRawPacketsToS3, BUCKET_NAME } = require('../services/rawPacketArchiveService');

const RETENTION_DAYS = parseInt(process.env.RAW_PACKETS_RETENTION_DAYS, 10) || 3;
const BATCH_SIZE = 5000;

/**
 * Archives raw packets older than RETENTION_DAYS (default 3 days) to AWS S3,
 * verifies the upload, and deletes the archived records from PostgreSQL.
 */
async function runRawPacketsArchiveJob() {
  console.log(`[RAW-ARCHIVER] Starting raw_packets S3 archive job (Retention: ${RETENTION_DAYS} days)...`);
  console.log(`[RAW-ARCHIVER] Target S3 Bucket: ${BUCKET_NAME}`);

  try {
    // 1. Identify cutoff timestamp
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);
    cutoffDate.setHours(0, 0, 0, 0); // Start of cutoff day in local time
    const cutoffStr = cutoffDate.toISOString().split('T')[0];

    console.log(`[RAW-ARCHIVER] Archiving raw packets received before: ${cutoffStr} 00:00:00 UTC`);

    // 2. Find all distinct dates older than cutoff that have packets in raw_packets
    // We check day by day starting from the oldest available day
    const oldestRes = await db.query(
      `SELECT received_at::date AS oldest_day 
       FROM raw_packets 
       WHERE received_at < $1::timestamp 
       ORDER BY received_at ASC 
       LIMIT 1`,
      [cutoffStr]
    );

    if (oldestRes.rows.length === 0 || !oldestRes.rows[0].oldest_day) {
      console.log(`[RAW-ARCHIVER] No raw packets older than ${RETENTION_DAYS} days found. Database is clean.`);
      return;
    }

    const oldestDay = new Date(oldestRes.rows[0].oldest_day);
    const endDay = new Date(cutoffDate);

    console.log(`[RAW-ARCHIVER] Date range to archive: ${oldestDay.toISOString().split('T')[0]} to ${endDay.toISOString().split('T')[0]}`);

    // 3. Get all active & known vehicle IMEIs to query efficiently via index
    const vehRes = await db.query(
      `SELECT DISTINCT imei FROM vehicles WHERE imei IS NOT NULL AND TRIM(imei) != ''`
    );
    const vehicleImeis = vehRes.rows.map(r => String(r.imei).trim());
    console.log(`[RAW-ARCHIVER] Found ${vehicleImeis.length} registered vehicles to check.`);

    // 4. Iterate through each day
    let curDay = new Date(oldestDay);
    while (curDay < endDay) {
      const dayStartStr = curDay.toISOString().split('T')[0];
      const nextDay = new Date(curDay);
      nextDay.setDate(nextDay.getDate() + 1);
      const dayEndStr = nextDay.toISOString().split('T')[0];

      console.log(`\n============================================================`);
      console.log(`[RAW-ARCHIVER] Processing Day: ${dayStartStr}`);
      console.log(`============================================================`);

      let totalDayPackets = 0;
      let totalDayUploaded = 0;
      let totalCompressedBytes = 0;

      // Archive per vehicle IMEI using btree index (idx_raw_packets_imei_time)
      for (const imei of vehicleImeis) {
        try {
          const packetsRes = await db.query(
            `SELECT id, imei, raw, parsed, error, received_at, packet_type, device_time, odometer, raw_hex, parsed_data
             FROM raw_packets
             WHERE imei = $1 AND received_at >= $2::timestamp AND received_at < $3::timestamp
             ORDER BY received_at ASC, id ASC`,
            [imei, dayStartStr, dayEndStr]
          );

          if (packetsRes.rows.length > 0) {
            const uploadRes = await uploadRawPacketsToS3(dayStartStr, imei, packetsRes.rows);
            if (uploadRes.uploaded) {
              totalDayPackets += uploadRes.count;
              totalCompressedBytes += uploadRes.compressedBytes;
              totalDayUploaded++;
            }
          }
        } catch (vehErr) {
          console.error(`[RAW-ARCHIVER] Error archiving IMEI ${imei} for ${dayStartStr}:`, vehErr.message);
        }
      }

      console.log(`[RAW-ARCHIVER] Day ${dayStartStr} S3 Upload Complete: ${totalDayPackets} packets across ${totalDayUploaded} vehicles (${(totalCompressedBytes / (1024 * 1024)).toFixed(2)} MB compressed).`);

      // 5. Safe Micro-Batch Deletion in PostgreSQL for this day
      console.log(`[RAW-ARCHIVER] Safely deleting raw packets for ${dayStartStr} from PostgreSQL in micro-batches...`);
      let deletedForDay = 0;
      let hasMore = true;

      while (hasMore) {
        const deleteRes = await db.query(
          `WITH to_delete AS (
             SELECT id FROM raw_packets
             WHERE received_at >= $1::timestamp AND received_at < $2::timestamp
             LIMIT $3
           )
           DELETE FROM raw_packets
           WHERE id IN (SELECT id FROM to_delete)
           RETURNING id`,
          [dayStartStr, dayEndStr, BATCH_SIZE]
        );

        const count = deleteRes.rowCount || 0;
        deletedForDay += count;

        if (count < BATCH_SIZE) {
          hasMore = false;
        } else {
          // Pause 30ms between batches to release database locks and CPU
          await new Promise(resolve => setTimeout(resolve, 30));
        }

        if (deletedForDay % 50000 === 0 && deletedForDay > 0) {
          console.log(`[RAW-ARCHIVER] Progress: deleted ${deletedForDay} packets for ${dayStartStr}...`);
        }
      }

      console.log(`[RAW-ARCHIVER] Day ${dayStartStr} finished: safely removed ${deletedForDay} rows from PostgreSQL.`);

      curDay = nextDay;
    }

    console.log(`\n[RAW-ARCHIVER] All historical raw packets older than ${RETENTION_DAYS} days successfully archived to S3 and pruned!`);

    // 6. Request gentle VACUUM so PostgreSQL reclaims the disk pages immediately
    console.log(`[RAW-ARCHIVER] Triggering concurrent VACUUM on raw_packets to reclaim disk space...`);
    try {
      await db.query(`VACUUM (ANALYZE) raw_packets`);
      console.log(`[RAW-ARCHIVER] VACUUM complete. Disk space reclaimed.`);
    } catch (vacErr) {
      console.warn(`[RAW-ARCHIVER] VACUUM notice:`, vacErr.message);
    }

  } catch (err) {
    console.error(`[RAW-ARCHIVER] Critical archive error:`, err);
  }
}

// Standalone execution support
if (require.main === module) {
  runRawPacketsArchiveJob().then(() => {
    console.log('[RAW-ARCHIVER] Job finished successfully.');
    process.exit(0);
  }).catch((err) => {
    console.error('[RAW-ARCHIVER] Unhandled error:', err);
    process.exit(1);
  });
}

module.exports = { runRawPacketsArchiveJob };
