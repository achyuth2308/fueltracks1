const bcrypt = require('bcryptjs');
const db = require('../config/db');
const AuditService = require('../services/auditService');

const OnboardController = {
  async onboardDevices(req, res, next) {
    const client = await db.getClient();
    try {
      const { userType, newUser, existingUser, devices } = req.body;

      if (!devices || !Array.isArray(devices) || devices.length === 0) {
        return res.status(400).json({ success: false, error: 'At least one device is required.' });
      }

      await client.query('BEGIN');

      let targetUserId = null;
      let targetOrgId = req.user.orgId; // Default to caller's org
      let targetGroupId = null;

      if (userType === 'new') {
        const { name, phone, email, password } = newUser;
        if (!email || !password || !name) {
          throw new Error('Name, Email, and Password are required for a new user.');
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const userResult = await client.query(
          `INSERT INTO users (org_id, email, password, role, name, phone)
           VALUES ($1, $2, $3, 'customer', $4, $5)
           RETURNING id`,
          [targetOrgId, email.toLowerCase().trim(), hashedPassword, name, phone]
        );
        targetUserId = userResult.rows[0].id;
      } else {
        if (!existingUser || !existingUser.userId || !existingUser.orgId) {
          throw new Error('Existing user details (User, Org) are required.');
        }
        targetUserId = existingUser.userId;
        targetOrgId = existingUser.orgId;
        targetGroupId = existingUser.groupId || null;
      }

      // ── Validate device IDs first ───────────────────────────────
      for (const device of devices) {
        if (!device.deviceId) {
          throw new Error('Device Id is required for all rows.');
        }
      }

      // ── Quota enforcement (per tier, only for non-superadmin) ───
      if (req.user.role !== 'superadmin') {
        const tierPrefixMap = { Starter: 'ST', Basic: 'BC', Advanced: 'AD', Premium: 'EN' };
        const tierCount = { Starter: 0, Basic: 0, Advanced: 0, Premium: 0 };
        for (const device of devices) {
          if (device.licenceId) {
            for (const [tier, prefix] of Object.entries(tierPrefixMap)) {
              if (device.licenceId.startsWith(prefix)) { tierCount[tier]++; break; }
            }
          }
        }

        const orgResult = await client.query(
          `SELECT device_limits FROM organizations WHERE id = $1`, [targetOrgId]
        );
        const limits = orgResult.rows[0]?.device_limits || { Starter: 0, Basic: 0, Advanced: 0, Premium: 0 };

        const usedResult = await client.query(
          `SELECT
             COUNT(*) FILTER (WHERE licence_id LIKE 'ST%') AS "Starter",
             COUNT(*) FILTER (WHERE licence_id LIKE 'BC%') AS "Basic",
             COUNT(*) FILTER (WHERE licence_id LIKE 'AD%') AS "Advanced",
             COUNT(*) FILTER (WHERE licence_id LIKE 'EN%') AS "Premium"
           FROM devices WHERE org_id = $1`, [targetOrgId]
        );
        const used = {
          Starter:  parseInt(usedResult.rows[0]?.Starter  || 0, 10),
          Basic:    parseInt(usedResult.rows[0]?.Basic    || 0, 10),
          Advanced: parseInt(usedResult.rows[0]?.Advanced || 0, 10),
          Premium:  parseInt(usedResult.rows[0]?.Premium  || 0, 10),
        };

        for (const tier of Object.keys(tierCount)) {
          if (tierCount[tier] === 0) continue;
          const available = Math.max(0, (limits[tier] || 0) - used[tier]);
          if (tierCount[tier] > available) {
            throw new Error(
              `Device limit exceeded for "${tier}" tier. Available: ${available}, Requested: ${tierCount[tier]}.`
            );
          }
        }
      }
      // ── End quota enforcement ───────────────────────────────────

      for (const device of devices) {
        const {
          licenceId, deviceId, deviceType, vehicleId,
          vehicleName, registrationNo, vehicleModel, vehicleTypeSelect,
          gpsSimNo, odoDistance, serviceEngineer, salesman, ticketId, sensorNo
        } = device;

        // Insert into devices table
        await client.query(
          `INSERT INTO devices 
            (org_id, device_id, device_type, licence_id, vehicle_id, assigned_user_id, assigned_group_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [targetOrgId, deviceId, deviceType, licenceId, vehicleId, targetUserId, targetGroupId]
        );

        // Also create a vehicle in the vehicles table
        const metadata = {
          vehicleId: vehicleId || '',
          licenceNo: registrationNo || '',
          serviceEngineer: serviceEngineer || '',
          salesman: salesman || '',
          ticketId: ticketId || '',
          sensorNo: sensorNo || '',
          odoDistance: odoDistance || '',
          make: vehicleModel || ''
        };

        const vehicleNameValue = vehicleName || `Vehicle ${deviceId}`;

        const issuedDate = new Date();
        const expireDate = new Date();
        expireDate.setFullYear(expireDate.getFullYear() + 1);

        await client.query(
          `INSERT INTO vehicles 
            (org_id, imei, name, plate, model, gps_sim_no, metadata, licence_issued_date, licence_expire_date)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [targetOrgId, deviceId, vehicleNameValue, registrationNo, vehicleTypeSelect, gpsSimNo, metadata, issuedDate, expireDate]
        );

        // Ensure vehicle_latest_state exists for the new vehicle
        const vehicleResult = await client.query('SELECT id FROM vehicles WHERE imei = $1', [deviceId]);
        if (vehicleResult.rows.length > 0) {
          const newVehicleId = vehicleResult.rows[0].id;
          await client.query(
            `INSERT INTO vehicle_latest_state (vehicle_id, is_online)
             VALUES ($1, FALSE) ON CONFLICT DO NOTHING`,
            [newVehicleId]
          );
        }
      }

      await client.query('COMMIT');

      res.status(201).json({
        success: true,
        message: 'Devices successfully onboarded!'
      });

      // Audit: device registered + vehicle created (after response, non-blocking)
      for (const device of devices) {
        const vehicleNameValue = device.vehicleName || `Vehicle ${device.deviceId}`;
        try {
          await AuditService.log({
            auditType: 'device', entityType: 'Device',
            entityId: device.deviceId, entityName: device.deviceId, action: 'REGISTERED',
            newData: { deviceId: device.deviceId, deviceType: device.deviceType, licenceId: device.licenceId },
            performedById: req.user.userId, performedByRole: req.user.role,
            orgId: targetOrgId,
            ipAddress: AuditService.getIp(req), userAgent: AuditService.getUserAgent(req),
          });
        } catch (auditErr) { console.error('[AUDIT]', auditErr.message); }
        try {
          await AuditService.log({
            auditType: 'vehicle', entityType: 'Vehicle',
            entityName: vehicleNameValue, action: 'CREATED',
            newData: { name: vehicleNameValue, imei: device.deviceId, plate: device.registrationNo, model: device.vehicleTypeSelect },
            performedById: req.user.userId, performedByRole: req.user.role,
            orgId: targetOrgId,
            ipAddress: AuditService.getIp(req), userAgent: AuditService.getUserAgent(req),
          });
        } catch (auditErr) { console.error('[AUDIT]', auditErr.message); }
      }
    } catch (err) {
      await client.query('ROLLBACK');
      if (err.code === '23505') {
        return res.status(400).json({ success: false, error: 'One or more Device Ids are already registered in the system.' });
      }
      res.status(400).json({ success: false, error: err.message || 'Failed to onboard devices.' });
    } finally {
      client.release();
    }
  }
};

module.exports = OnboardController;
