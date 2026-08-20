const db = require('../config/db');
const { S3Client, HeadObjectCommand } = require('@aws-sdk/client-s3');
const emailService = require('../services/emailService');

const s3 = new S3Client({
  region: process.env.AWS_DEFAULT_REGION || 'ap-south-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});
const BUCKET_NAME = process.env.AWS_ARCHIVE_BUCKET || 'fueltracks-archive';

/**
 * Runs every ~30 minutes to check if pending Glacier restores have finished thawing.
 * Sends an email notification to the user who requested it.
 */
async function checkPendingRestores() {
  console.log('[RestoreMonitorJob] Checking pending S3 restores...');
  try {
    // Get distinct request groups that have pending restores
    const groupResult = await db.query(`SELECT DISTINCT request_group_id, requested_by_email, vehicle_id FROM restore_requests WHERE status = 'pending'`);
    if (groupResult.rows.length === 0) return;

    for (const group of groupResult.rows) {
      // Get all pending keys for this group
      const keysResult = await db.query(`SELECT id, s3_key, created_at FROM restore_requests WHERE request_group_id = $1 AND status = 'pending'`, [group.request_group_id]);
      
      let allReady = true;
      let completedIds = [];
      let isExpired = false;
      
      // Cutoff time: 48 hours ago. If it hasn't thawed by now, it failed.
      const cutoffDate = new Date(Date.now() - 48 * 60 * 60 * 1000);

      for (const req of keysResult.rows) {
        if (new Date(req.created_at) < cutoffDate) {
          isExpired = true;
        }
        try {
          const headResult = await s3.send(new HeadObjectCommand({ Bucket: BUCKET_NAME, Key: req.s3_key }));
          const restoreStatus = headResult.Restore;
          
          if (restoreStatus && restoreStatus.includes('ongoing-request="false"')) {
            completedIds.push(req.id);
          } else {
            allReady = false; // At least one file is still thawing
          }
        } catch (err) {
          console.error(`[RestoreMonitorJob] Error checking S3 object ${req.s3_key}:`, err.message);
          allReady = false; // Treat error as not ready
        }
      }

      // If the request has permanently stuck/failed past 48 hours
      if (isExpired) {
        console.error(`[RestoreMonitorJob] Restore for group ${group.request_group_id} permanently failed (stuck > 48h).`);
        await db.query(`UPDATE restore_requests SET status = 'failed' WHERE request_group_id = $1`, [group.request_group_id]);
        
        try {
          await emailService.sendArchivalStatusEmail(group.requested_by_email, 'failed', group.vehicle_id);
          // Only mark notified_at if email successfully sends
          await db.query(`UPDATE restore_requests SET notified_at = NOW() WHERE request_group_id = $1`, [group.request_group_id]);
        } catch (err) {
          console.error(`[RestoreMonitorJob] Failed to send failure email to ${group.requested_by_email}`);
        }
        
        continue; // Move on to the next group
      }

      // If any files finished successfully, mark them as completed in DB
      if (completedIds.length > 0) {
        await db.query(`UPDATE restore_requests SET status = 'completed' WHERE id = ANY($1::int[])`, [completedIds]);
      }

      // ONLY notify if ALL files for this entire trip request are finally ready
      if (allReady) {
        console.log(`[RestoreMonitorJob] ALL files restored for group ${group.request_group_id}. Notifying ${group.requested_by_email}`);
        
        try {
          await emailService.sendArchivalStatusEmail(group.requested_by_email, 'completed', group.vehicle_id);
          // Only mark notified_at if email successfully sends
          await db.query(`UPDATE restore_requests SET notified_at = NOW() WHERE request_group_id = $1`, [group.request_group_id]);
        } catch (err) {
          console.error(`[RestoreMonitorJob] Failed to send success email to ${group.requested_by_email}`);
        }
      }
    }
  } catch (err) {
    console.error('[RestoreMonitorJob] Error:', err);
  }
}

// If run directly via node
if (require.main === module) {
  checkPendingRestores().then(() => process.exit(0));
}

module.exports = { checkPendingRestores };
