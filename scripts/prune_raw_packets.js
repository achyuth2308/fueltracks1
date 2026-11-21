/**
 * FuelTracks Production Emergency & Scheduled Raw Packets Pruning Script
 *
 * Usage:
 *   node scripts/prune_raw_packets.js               # Delete older than 3 days & VACUUM
 *   node scripts/prune_raw_packets.js --days 1       # Delete older than 1 day & VACUUM
 *   node scripts/prune_raw_packets.js --truncate     # INSTANT: Truncate raw_packets (reclaim 100% space)
 */

'use strict';

const db = require('../backend/config/db');

async function prune() {
  const args = process.argv.slice(2);
  const isTruncate = args.includes('--truncate');
  let days = 3;

  const daysIdx = args.indexOf('--days');
  if (daysIdx !== -1 && args[daysIdx + 1]) {
    days = Math.max(0, parseInt(args[daysIdx + 1], 10) || 3);
  }

  console.log('====================================================');
  console.log('  FuelTracks Raw Packets Maintenance & Disk Pruner  ');
  console.log('====================================================');

  try {
    if (isTruncate) {
      console.log('[WARN] Emergency Truncate selected: Reclaiming 100% of raw_packets disk space immediately...');
      await db.query('TRUNCATE TABLE raw_packets');
      console.log('[SUCCESS] raw_packets truncated. Disk space fully returned to filesystem.');
      process.exit(0);
    }

    console.log(`[INFO] Pruning raw packets older than ${days} day(s)...`);

    // Check count first
    const countRes = await db.query(
      `SELECT COUNT(*) FROM raw_packets WHERE received_at < NOW() - ($1 || ' days')::INTERVAL`,
      [days]
    );
    const totalToDelete = parseInt(countRes.rows[0]?.count || 0, 10);
    console.log(`[INFO] Found ${totalToDelete.toLocaleString()} rows to remove.`);

    if (totalToDelete === 0) {
      console.log('[INFO] No rows older than retention threshold. Exiting.');
      process.exit(0);
    }

    // Delete in safe micro-batches of 10,000 to prevent table lockups and connection timeouts
    const BATCH_SIZE = 10000;
    let deletedSoFar = 0;

    while (deletedSoFar < totalToDelete) {
      const delRes = await db.query(
        `WITH to_delete AS (
           SELECT id FROM raw_packets
           WHERE received_at < NOW() - ($1 || ' days')::INTERVAL
           LIMIT $2
         )
         DELETE FROM raw_packets
         WHERE id IN (SELECT id FROM to_delete)
         RETURNING id`,
        [days, BATCH_SIZE]
      );

      const count = delRes.rowCount || 0;
      if (count === 0) break;

      deletedSoFar += count;
      const pct = Math.min(100, Math.round((deletedSoFar / totalToDelete) * 100));
      console.log(`[PRUNER] Deleted ${deletedSoFar.toLocaleString()} / ${totalToDelete.toLocaleString()} (${pct}%)...`);

      // Gentle pause to release lock and CPU
      await new Promise(r => setTimeout(r, 25));
    }

    console.log('[INFO] Rows deleted. Running VACUUM (ANALYZE) to reclaim disk pages...');
    await db.query('VACUUM (ANALYZE) raw_packets');
    console.log('[SUCCESS] Pruning and VACUUM completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('[ERROR] Pruning failed:', err.message);
    process.exit(1);
  }
}

prune();
