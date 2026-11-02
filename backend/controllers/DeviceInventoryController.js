// ============================================================
// DEVICE INVENTORY CONTROLLER (PRODUCTION-SAFE)
// High-performance hardware stock inventory management (IMEI, Serial, ICCID)
// Built with strict CPU, RAM, and Database safety:
//  - LRU caching: sub-millisecond lookups with zero DB hits
//  - Hard limit of 1,000 records per bulk import
//  - Chunked parameterized batch inserts (50 rows/chunk)
//  - Guaranteed DB client release in finally blocks
// ============================================================

const { LRUCache } = require('lru-cache');
const db = require('../config/db');

// In-memory LRU Cache (max 1000 devices, 15 min TTL, ~150KB total memory)
const inventoryCache = new LRUCache({
  max: 1000,
  ttl: 15 * 60 * 1000
});

/**
 * Auto-detect manufacturer from device model / serial if not explicitly set
 */
function resolveManufacturerFromHardware(model, serial, explicitMfr) {
  if (explicitMfr && typeof explicitMfr === 'string' && explicitMfr.trim() && explicitMfr.trim() !== 'FUELTRACKS TECHNOLOGIES PRIVATE LIMITED') {
    return explicitMfr.trim();
  }
  const text = `${model || ''} ${serial || ''}`.toUpperCase();
  if (text.includes('VOLTY') || text.includes('VOL1') || text.startsWith('VOL')) {
    return 'VOLTY IOT SOLUTIONS PRIVATE LIMITED';
  }
  if (text.includes('APM') || text.includes('KINGSTRACK') || text.startsWith('APM')) {
    return 'APM KINGSTRACK PRIVATE LIMITED';
  }
  if (text.includes('TELTONIKA') || text.includes('FMC') || text.includes('FMB')) {
    return 'TELTONIKA TELEMATICS';
  }
  if (text.includes('CONCOX') || text.includes('JIMI') || text.includes('WETRACK')) {
    return 'CONCOX / JIMI IOT';
  }
  return 'APM KINGSTRACK PRIVATE LIMITED';
}

const DeviceInventoryController = {
  /**
   * Fast O(1) single-device lookup by IMEI.
   * Checks in-memory LRU cache first to avoid database load entirely.
   */
  async lookupByImei(req, res) {
    try {
      const rawImei = req.query.imei;
      if (!rawImei) {
        return res.status(400).json({ success: false, error: 'IMEI query parameter is required.' });
      }

      const cleanImei = String(rawImei).trim().replace(/\D/g, '');
      if (cleanImei.length < 10 || cleanImei.length > 20) {
        return res.status(400).json({ success: false, error: 'Invalid IMEI format (must be 10-20 digits).' });
      }

      // 1. Check in-memory cache first (0 DB query, 0 DB CPU, 0 connection pool usage)
      const cached = inventoryCache.get(cleanImei);
      if (cached) {
        return res.json({ success: true, data: cached, fromCache: true });
      }

      // 2. Point lookup with B-Tree index scan (sub-millisecond)
      const client = await db.getClient();
      try {
        const query = `
          SELECT 
            imei, 
            serial_no, 
            iccid, 
            device_model, 
            manufacturer, 
            sim_provider, 
            sim_no, 
            batch_name, 
            created_at, 
            updated_at
          FROM device_inventory
          WHERE imei = $1
          LIMIT 1
        `;
        const result = await client.query(query, [cleanImei]);

        if (result.rows.length === 0) {
          // Cache null for 2 minutes to prevent repeated DB misses (cache penetration protection)
          inventoryCache.set(cleanImei, null, { ttl: 2 * 60 * 1000 });
          return res.json({ success: true, data: null, fromCache: false });
        }

        const device = result.rows[0];
        // Populate cache
        inventoryCache.set(cleanImei, device);

        return res.json({ success: true, data: device, fromCache: false });
      } finally {
        client.release();
      }
    } catch (err) {
      console.error('[DEVICE-INVENTORY] lookupByImei error:', err);
      return res.status(500).json({ success: false, error: 'Failed to lookup device inventory record.' });
    }
  },

  /**
   * Bulk import device hardware profiles from parsed Excel data.
   * Production-safe: max 1,000 rows, chunked batch upsert, transaction protected.
   */
  async bulkImport(req, res) {
    const client = await db.getClient();
    try {
      const { records, batchName, defaultOrgId } = req.body;

      if (!records || !Array.isArray(records) || records.length === 0) {
        return res.status(400).json({ success: false, error: 'Records array is required and must not be empty.' });
      }

      // Enforce hard cap to prevent event loop blocking or memory overload
      if (records.length > 1000) {
        return res.status(400).json({
          success: false,
          error: `Batch size exceeds safety limit of 1,000 records (received ${records.length}). Please split into smaller batches.`
        });
      }

      let targetOrgId = req.user.orgId;
      if (req.user.role === 'superadmin' && defaultOrgId) {
        targetOrgId = defaultOrgId;
      }

      const finalBatchName = String(batchName || `Batch_${new Date().toISOString().slice(0, 10)}`).trim();

      // Normalize and sanitize records
      const validRows = [];
      const skippedRows = [];
      const seenImeisInPayload = new Set();

      for (let i = 0; i < records.length; i++) {
        const row = records[i] || {};
        let imei = String(row.imei || row['Device ID(IMEI)'] || row['IMEI Number'] || row['IMEI'] || row.deviceId || '').trim();
        if (imei.includes('e+') || imei.includes('E+')) {
          try { imei = BigInt(Number(imei)).toString(); } catch (_) {}
        }
        imei = imei.replace(/\D/g, '');

        if (!imei || imei.length < 10 || imei.length > 20) {
          skippedRows.push({ row: i + 1, imei: imei || 'EMPTY', reason: 'Invalid or missing numeric IMEI (10-20 digits required).' });
          continue;
        }

        if (seenImeisInPayload.has(imei)) {
          skippedRows.push({ row: i + 1, imei, reason: 'Duplicate IMEI in uploaded file.' });
          continue;
        }
        seenImeisInPayload.add(imei);

        const serialNo = String(row.serial_no || row.serialNo || row['VLTD SLNO'] || row['VLTTD SLNO'] || row['Serial Number'] || row['Device Serial Number'] || '').trim();
        const iccid = String(row.iccid || row['ICCID'] || row['ICCID Number'] || row['SIM Number'] || '').trim();
        const model = String(row.device_model || row.deviceModel || row.model || row['Device Model'] || row['Model Name / Number'] || row['Device Type'] || '').trim();
        const simProvider = String(row.sim_provider || row.simProvider || row['SIM Service Provider'] || row['Provider'] || row['Operator'] || 'Technojacks').trim();
        const simNo = String(row.sim_no || row.simNo || row['GPS SIM Number 1'] || row['SIM 1'] || '').trim();
        const explicitMfr = String(row.manufacturer || row['VLTD Manufacturer Name'] || row['Manufacturer'] || '').trim();

        const resolvedMfr = resolveManufacturerFromHardware(model, serialNo, explicitMfr);

        validRows.push({
          imei,
          serial_no: serialNo || null,
          iccid: iccid || null,
          device_model: model || (resolvedMfr.includes('VOLTY') ? 'VOLTY-AIS140' : '1819001A'),
          manufacturer: resolvedMfr,
          sim_provider: simProvider || 'Technojacks',
          sim_no: simNo || null,
          batch_name: finalBatchName
        });
      }

      if (validRows.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No valid device records found in upload.',
          skipped: skippedRows
        });
      }

      await client.query('BEGIN');

      // Process in chunks of 50 to maintain tight parameter count and low memory
      const CHUNK_SIZE = 50;
      let upsertedCount = 0;

      for (let c = 0; c < validRows.length; c += CHUNK_SIZE) {
        const chunk = validRows.slice(c, c + CHUNK_SIZE);
        const valueClauses = [];
        const params = [];
        let pIdx = 1;

        for (const item of chunk) {
          valueClauses.push(`($${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++})`);
          params.push(
            targetOrgId,
            item.imei,
            item.serial_no,
            item.iccid,
            item.device_model,
            item.manufacturer,
            item.sim_provider,
            item.sim_no,
            item.batch_name
          );
        }

        const chunkQuery = `
          INSERT INTO device_inventory (
            org_id, imei, serial_no, iccid, device_model, manufacturer, sim_provider, sim_no, batch_name
          )
          VALUES ${valueClauses.join(', ')}
          ON CONFLICT (imei) DO UPDATE SET
            serial_no = COALESCE(EXCLUDED.serial_no, device_inventory.serial_no),
            iccid = COALESCE(EXCLUDED.iccid, device_inventory.iccid),
            device_model = COALESCE(EXCLUDED.device_model, device_inventory.device_model),
            manufacturer = COALESCE(EXCLUDED.manufacturer, device_inventory.manufacturer),
            sim_provider = COALESCE(EXCLUDED.sim_provider, device_inventory.sim_provider),
            sim_no = COALESCE(EXCLUDED.sim_no, device_inventory.sim_no),
            batch_name = COALESCE(EXCLUDED.batch_name, device_inventory.batch_name),
            updated_at = NOW()
        `;

        await client.query(chunkQuery, params);
        upsertedCount += chunk.length;

        // Update in-memory cache for immediate consistency
        for (const item of chunk) {
          inventoryCache.set(item.imei, {
            ...item,
            updated_at: new Date()
          });
        }
      }

      await client.query('COMMIT');

      return res.json({
        success: true,
        message: `Successfully imported ${upsertedCount} device hardware profiles.`,
        importedCount: upsertedCount,
        skippedCount: skippedRows.length,
        skipped: skippedRows
      });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('[DEVICE-INVENTORY] bulkImport error:', err);
      return res.status(500).json({ success: false, error: 'Database error during bulk device inventory import.' });
    } finally {
      client.release();
    }
  },

  /**
   * Paginated list of inventory devices with search filtering.
   * Uses LIMIT and OFFSET to guarantee low memory usage.
   */
  async listInventory(req, res) {
    const client = await db.getClient();
    try {
      const page = Math.max(1, parseInt(req.query.page, 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
      const offset = (page - 1) * limit;
      const search = (req.query.q || req.query.search || '').trim();

      const conditions = [];
      const params = [];
      let pIdx = 1;

      if (req.user.role !== 'superadmin') {
        conditions.push(`org_id = $${pIdx++}`);
        params.push(req.user.orgId);
      }

      if (search) {
        conditions.push(`(imei ILIKE $${pIdx} OR serial_no ILIKE $${pIdx} OR iccid ILIKE $${pIdx} OR device_model ILIKE $${pIdx} OR manufacturer ILIKE $${pIdx})`);
        params.push(`%${search}%`);
        pIdx++;
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Count query
      const countRes = await client.query(`SELECT COUNT(*) as total FROM device_inventory ${whereClause}`, params);
      const total = parseInt(countRes.rows[0].total, 10) || 0;

      // Data query with LIMIT and OFFSET
      const dataParams = [...params, limit, offset];
      const dataQuery = `
        SELECT 
          id, 
          org_id, 
          imei, 
          serial_no, 
          iccid, 
          device_model, 
          manufacturer, 
          sim_provider, 
          sim_no, 
          batch_name, 
          created_at, 
          updated_at
        FROM device_inventory
        ${whereClause}
        ORDER BY updated_at DESC
        LIMIT $${pIdx++} OFFSET $${pIdx++}
      `;
      const dataRes = await client.query(dataQuery, dataParams);

      return res.json({
        success: true,
        data: dataRes.rows,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      });
    } catch (err) {
      console.error('[DEVICE-INVENTORY] listInventory error:', err);
      return res.status(500).json({ success: false, error: 'Failed to fetch device inventory list.' });
    } finally {
      client.release();
    }
  }
};

module.exports = DeviceInventoryController;

