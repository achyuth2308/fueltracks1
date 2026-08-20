const db = require('../config/db');
const zlib = require('zlib');
const { S3Client, PutObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const { getS3KeyForDateAndVehicle } = require('../utils/archiveUtils');
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
 * Runs daily. Archives GPS points exactly 170 days old to S3, verifies them, and then safely drops older chunks.
 */
async function runArchiveJob() {
  console.log('[ArchiverJob] Starting nightly archive job...');
  try {
    // 1. Calculate target date (170 days ago)
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() - 170);
    const dateStr = targetDate.toISOString().split('T')[0];

    // 2. Fetch all points for that date
    console.log(`[ArchiverJob] Fetching points for ${dateStr}...`);
    const result = await db.query(
      `SELECT * FROM gps_points 
       WHERE device_time >= $1::timestamp 
         AND device_time < ($1::timestamp + interval '1 day')`,
      [dateStr]
    );

    const points = result.rows;
    if (points.length === 0) {
      console.log(`[ArchiverJob] No points to archive for ${dateStr}. Done.`);
      return;
    }

    // 3. Group by vehicle
    const byVehicle = {};
    for (const pt of points) {
      if (!byVehicle[pt.vehicle_id]) {
        byVehicle[pt.vehicle_id] = [];
      }
      byVehicle[pt.vehicle_id].push(pt);
    }

    // 4. Compress, Upload to S3, and Verify for each vehicle
    let uploadedCount = 0;
    for (const [vehicleId, vehiclePoints] of Object.entries(byVehicle)) {
      const s3Key = getS3KeyForDateAndVehicle(targetDate, vehicleId);
      
      const jsonStr = JSON.stringify(vehiclePoints);
      const compressed = zlib.gzipSync(jsonStr);

      // Upload
      await s3.send(new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: s3Key,
        Body: compressed,
        ContentType: 'application/json',
        ContentEncoding: 'gzip'
      }));
      
      // VERIFY it exists on S3
      await s3.send(new HeadObjectCommand({ Bucket: BUCKET_NAME, Key: s3Key }));
      
      uploadedCount++;
    }

    console.log(`[ArchiverJob] Uploaded and VERIFIED ${uploadedCount} vehicle files to S3 for ${dateStr}.`);

    // 5. Delete from Postgres using TimescaleDB native drop_chunks for performance and safety
    // Drops chunks strictly older than 171 days, leaving the just-archived 170th day safely as a buffer
    console.log(`[ArchiverJob] Executing TimescaleDB drop_chunks for data older than 171 days...`);
    const deleteResult = await db.query(`SELECT drop_chunks('gps_points', older_than => interval '171 days');`);
    
    console.log(`[ArchiverJob] Dropped old chunks successfully. Job complete.`);

  } catch (err) {
    console.error('[ArchiverJob] CRITICAL ERROR:', err);
    // Fire an emergency email to admin!
    try {
      await emailService.sendArchivalStatusEmail(
        'info@fueltracks.in', 
        'failed', 
        'SYSTEM ARCHIVE JOB'
      );
    } catch (emailErr) {
      console.error('[ArchiverJob] Also failed to send emergency alert email:', emailErr);
    }
  }
}

// If run directly via node
if (require.main === module) {
  runArchiveJob().then(() => process.exit(0));
}

module.exports = { runArchiveJob };
