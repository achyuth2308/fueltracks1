const crypto = require('crypto');
const { S3Client, GetObjectCommand, HeadObjectCommand, RestoreObjectCommand } = require('@aws-sdk/client-s3');
const zlib = require('zlib');
const db = require('../config/db');
const { getKeysForDateRange } = require('../utils/archiveUtils');

const s3 = new S3Client({
  region: process.env.AWS_DEFAULT_REGION || 'ap-south-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

const BUCKET_NAME = process.env.AWS_ARCHIVE_BUCKET || 'fueltracks-archive';

class ArchiveService {
  /**
   * Verify that the requesting user's organization actually owns the vehicle
   */
  async verifyVehicleOwnership(vehicleId, orgId) {
    const result = await db.query(
      `SELECT id FROM vehicles WHERE id = $1 AND org_id = $2`,
      [vehicleId, orgId]
    );
    if (result.rows.length === 0) {
      throw new Error(`Unauthorized: Vehicle ${vehicleId} does not belong to organization ${orgId}`);
    }
  }

  /**
   * Fetch historical route from S3 archive.
   * Checks storage class and initiates restore if necessary.
   */
  async getArchivedRoute(vehicleId, orgId, startDate, endDate, reqUserEmail = null) {
    // 1. MUST verify ownership before any S3 action
    await this.verifyVehicleOwnership(vehicleId, orgId);

    const keys = getKeysForDateRange(startDate, endDate, vehicleId);
    let allPoints = [];
    let isRestoring = false;
    const requestGroupId = crypto.randomUUID();

    // 2. Check all required files in S3
    for (const key of keys) {
      try {
        const headParams = { Bucket: BUCKET_NAME, Key: key };
        const headResult = await s3.send(new HeadObjectCommand(headParams));
        
        // If file is in Glacier/Deep Archive
        if (['GLACIER', 'DEEP_ARCHIVE'].includes(headResult.StorageClass)) {
          // Check if it's already restored
          const restoreStatus = headResult.Restore;
          if (!restoreStatus || restoreStatus.includes('ongoing-request="true"')) {
            isRestoring = true;
            // Initiate restore if not already ongoing
            if (!restoreStatus) {
              await s3.send(new RestoreObjectCommand({
                Bucket: BUCKET_NAME,
                Key: key,
                RestoreRequest: {
                  Days: 3,
                  GlacierJobParameters: { Tier: 'Standard' }
                }
              }));
              
              // Log to DB for polling job to notify user
              if (reqUserEmail) {
                await this.registerRestoreRequest(vehicleId, key, reqUserEmail, requestGroupId);
              }
            }
          }
        }
      } catch (err) {
        if (err.name === 'NotFound') {
          // No data for this day, skip safely
          continue;
        }
        console.error(`[ArchiveService] Error checking HeadObject for ${key}:`, err);
      }
    }

    // 3. If any file is still restoring, stop and inform the user
    if (isRestoring) {
      return { 
        status: 'restoring', 
        estimatedHours: 12,
        message: 'Historical data is in cold storage. Retrieval has been initiated and will be available in ~12 hours.'
      };
    }

    // 4. All files are ready/standard, fetch and parse
    for (const key of keys) {
      try {
        const getParams = { Bucket: BUCKET_NAME, Key: key };
        const response = await s3.send(new GetObjectCommand(getParams));
        
        // Read stream and decompress
        const stream = response.Body.pipe(zlib.createGunzip());
        let rawData = '';
        for await (const chunk of stream) {
          rawData += chunk;
        }
        
        try {
          const dailyPoints = JSON.parse(rawData);
          if (Array.isArray(dailyPoints)) {
            allPoints = allPoints.concat(dailyPoints);
          }
        } catch (parseErr) {
          console.error(`[ArchiveService] Malformed JSON in S3 key ${key}. Skipping this day to prevent crash.`, parseErr.message);
          // Skipping this specific corrupted day-file, but letting the rest of the route load
        }
        
      } catch (err) {
        if (err.name === 'NoSuchKey' || err.name === 'NotFound') continue;
        console.error(`[ArchiveService] Error fetching ${key}:`, err);
      }
    }

    // 5. Sort chronologically
    allPoints.sort((a, b) => new Date(a.device_time) - new Date(b.device_time));

    // 6. Filter precisely by the requested start/end time (since S3 files are whole days)
    const startObj = new Date(startDate);
    const endObj = new Date(endDate);
    const finalRoute = allPoints.filter(pt => {
      const ptTime = new Date(pt.device_time);
      return ptTime >= startObj && ptTime <= endObj;
    });

    return {
      status: 'ready',
      data: finalRoute
    };
  }

  /**
   * Register a restore request in DB so a polling job can notify the user
   */
  async registerRestoreRequest(vehicleId, s3Key, email, requestGroupId) {
    try {
      await db.query(
        `INSERT INTO restore_requests (vehicle_id, s3_key, requested_by_email, request_group_id, status, created_at)
         VALUES ($1, $2, $3, $4, 'pending', NOW())
         ON CONFLICT (s3_key, requested_by_email) DO NOTHING`,
        [vehicleId, s3Key, email, requestGroupId]
      );
    } catch (err) {
      console.error('[ArchiveService] Failed to register restore request:', err);
    }
  }
}

module.exports = new ArchiveService();
