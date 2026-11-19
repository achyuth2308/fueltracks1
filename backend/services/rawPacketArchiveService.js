const zlib = require('zlib');
const { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');

// Configure S3 client: works with both explicit credentials (.env) and EC2 IAM Instance Profile
const s3Config = {
  region: process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'ap-south-1'
};

if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
  s3Config.credentials = {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  };
}

const s3 = new S3Client(s3Config);
const BUCKET_NAME = process.env.AWS_ARCHIVE_BUCKET || 'fueltracks-telemetry-archive-654059534655';
const S3_PREFIX = 'raw_packets';

/**
 * Returns S3 key path for a given date and vehicle IMEI.
 * Format: raw_packets/YYYY-MM-DD/<imei>.json.gz
 */
function getS3KeyForRawPackets(dateStr, imei) {
  const cleanImei = String(imei).trim();
  return `${S3_PREFIX}/${dateStr}/${cleanImei}.json.gz`;
}

/**
 * Uploads a list of raw packets for a given date and IMEI to S3 as a gzipped JSON file.
 * Verifies upload completion via HeadObject.
 */
async function uploadRawPacketsToS3(dateStr, imei, packets) {
  if (!packets || packets.length === 0) return { uploaded: false, count: 0 };

  const s3Key = getS3KeyForRawPackets(dateStr, imei);
  const jsonStr = JSON.stringify(packets);
  const gzBuffer = zlib.gzipSync(Buffer.from(jsonStr, 'utf8'), { level: 9 });

  await s3.send(new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: s3Key,
    Body: gzBuffer,
    ContentType: 'application/json',
    ContentEncoding: 'gzip',
    Metadata: {
      imei: String(imei),
      date: String(dateStr),
      packetCount: String(packets.length)
    }
  }));

  // Verify object existence and size on S3
  const head = await s3.send(new HeadObjectCommand({
    Bucket: BUCKET_NAME,
    Key: s3Key
  }));

  return {
    uploaded: true,
    s3Key,
    count: packets.length,
    rawBytes: Buffer.byteLength(jsonStr, 'utf8'),
    compressedBytes: gzBuffer.length,
    etag: head.ETag
  };
}

/**
 * Fetches and decompresses raw packets from S3 for a given IMEI and date range.
 * Returns array of parsed raw packet records.
 */
async function fetchRawPacketsFromS3(imei, startDateStr, endDateStr) {
  if (!imei || !startDateStr) return [];

  const start = new Date(startDateStr);
  const end = new Date(endDateStr || startDateStr);
  
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return [];

  const allPackets = [];
  const current = new Date(start);

  while (current <= end) {
    const dateStr = current.toISOString().split('T')[0];
    const s3Key = getS3KeyForRawPackets(dateStr, imei);

    try {
      const response = await s3.send(new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: s3Key
      }));

      // Stream decompression via gunzip
      const gunzip = zlib.createGunzip();
      const chunks = [];
      
      await new Promise((resolve, reject) => {
        response.Body.pipe(gunzip)
          .on('data', chunk => chunks.push(chunk))
          .on('end', resolve)
          .on('error', reject);
      });

      const decompressedStr = Buffer.concat(chunks).toString('utf8');
      const parsedList = JSON.parse(decompressedStr);

      if (Array.isArray(parsedList)) {
        allPackets.push(...parsedList);
      }
    } catch (err) {
      // If NoSuchKey, file simply doesn't exist for this day (expected for inactive devices)
      if (err.name !== 'NoSuchKey' && err.name !== 'NotFound') {
        console.warn(`[RAW-ARCHIVE-SERVICE] S3 fetch warning for ${s3Key}:`, err.message);
      }
    }

    current.setUTCDate(current.getUTCDate() + 1);
  }

  return allPackets;
}

module.exports = {
  getS3KeyForRawPackets,
  uploadRawPacketsToS3,
  fetchRawPacketsFromS3,
  BUCKET_NAME,
  S3_PREFIX
};
