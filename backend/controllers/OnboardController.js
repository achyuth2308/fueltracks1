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
        const { name, phone, email, password, username, location, aadhar } = newUser;
        const finalUsername = (username || email).toLowerCase().trim();
        if (!email || !password || !name || !finalUsername) {
          throw new Error('Customer Name, Email, Password, and Username are required.');
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const userResult = await client.query(
          `INSERT INTO users (org_id, email, password, role, name, phone, username, location, aadhar)
           VALUES ($1, $2, $3, 'customer', $4, $5, $6, $7, $8)
           RETURNING id`,
          [targetOrgId, email.toLowerCase().trim(), hashedPassword, name, phone, finalUsername, location || '', aadhar || '']
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
          gpsSimNo, gpsSimNo2, odoDistance, serviceEngineer, salesman, serviceEngineerMob, salesmanMob, ticketId, sensorNo,
          iccid, vehicleVoltage, ignitionDetection, timezone
        } = device;

        // Upsert into devices table
        await client.query(
          `INSERT INTO devices 
            (org_id, device_id, device_type, licence_id, vehicle_id, assigned_user_id, assigned_group_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (device_id) DO UPDATE SET
             org_id = EXCLUDED.org_id,
             device_type = EXCLUDED.device_type,
             licence_id = EXCLUDED.licence_id,
             vehicle_id = EXCLUDED.vehicle_id,
             assigned_user_id = EXCLUDED.assigned_user_id,
             assigned_group_id = EXCLUDED.assigned_group_id`,
          [targetOrgId, deviceId, deviceType, licenceId, vehicleId, targetUserId, targetGroupId]
        );

        // Also create a vehicle in the vehicles table
        const metadata = {
          vehicleId: vehicleId || '',
          licenceNo: registrationNo || '',
          serviceEngineer: serviceEngineer || '',
          serviceEngineerMob: serviceEngineerMob || '',
          salesman: salesman || '',
          salesmanMob: salesmanMob || '',
          ticketId: ticketId || '',
          sensorNo: sensorNo || '',
          odoDistance: odoDistance || '',
          make: vehicleModel || '',
          gpsSimNo2: gpsSimNo2 || '',
          iccid: iccid || '',
          vehicleVoltage: vehicleVoltage || '',
          ignitionDetection: ignitionDetection || ''
        };

        const vehicleNameValue = vehicleName || `Vehicle ${deviceId}`;

        const issuedDate = new Date();
        const expireDate = new Date();
        expireDate.setFullYear(expireDate.getFullYear() + 1);

        await client.query(
          `INSERT INTO vehicles 
            (org_id, imei, name, plate, model, gps_sim_no, metadata, licence_issued_date, licence_expire_date, is_active, timezone)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, TRUE, $10)
           ON CONFLICT (imei) DO UPDATE SET
             org_id = EXCLUDED.org_id,
             name = EXCLUDED.name,
             plate = EXCLUDED.plate,
             model = EXCLUDED.model,
             gps_sim_no = EXCLUDED.gps_sim_no,
             metadata = EXCLUDED.metadata,
             licence_issued_date = EXCLUDED.licence_issued_date,
             licence_expire_date = EXCLUDED.licence_expire_date,
             timezone = EXCLUDED.timezone,
             is_active = TRUE`,
          [targetOrgId, deviceId, vehicleNameValue, registrationNo, vehicleTypeSelect, gpsSimNo, metadata, issuedDate, expireDate, timezone || 'UTC+05:30']
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
        let errorMsg = 'A record with this information already exists.';
        if (err.constraint && err.constraint.includes('email')) {
          errorMsg = 'A user with this email already exists.';
        } else if (err.constraint && (err.constraint.includes('device') || err.constraint.includes('imei'))) {
          errorMsg = 'One or more Device Ids are already registered in the system.';
        } else if (err.detail) {
          errorMsg = err.detail;
        }
        return res.status(400).json({ success: false, error: errorMsg });
      }
      res.status(400).json({ success: false, error: err.message || 'Failed to onboard devices.' });
    } finally {
      client.release();
    }
  },

  async bulkOnboardExcel(req, res, next) {
    const client = await db.getClient();
    try {
      const { records, defaultOrgId } = req.body;

      if (!records || !Array.isArray(records) || records.length === 0) {
        return res.status(400).json({ success: false, error: 'At least one vehicle record is required.' });
      }

      let callerOrgId = req.user.orgId;
      if (req.user.role === 'superadmin' && defaultOrgId) {
        callerOrgId = defaultOrgId;
      }

      await client.query('BEGIN');

      const onboardedResults = [];

      for (let i = 0; i < records.length; i++) {
        const row = records[i];
        const rawDeviceType = String(row['Device Type'] || row.deviceType || row['Device Type (BSTPL/AIS140/AIS140V2/CONCOX/VOLTY/FMB 920)'] || row['Device Model'] || 'AIS140').trim();
        const deviceType = rawDeviceType.split(' (')[0].trim();
        const imei = String(row['Device ID(IMEI)'] || row.imei || row['IMEI Number'] || row['IMEI'] || row.deviceId || '').trim();
        const category = String(row['Category'] || row.category || 'General').trim();
        const registrationNo = String(row['Registration Number'] || row['Registration No'] || row.registrationNo || row.plate || '').trim();
        const vehicleIdInput = String(row['Vehicle Id'] || row.vehicleId || '').trim();
        const vehicleNumber = registrationNo || vehicleIdInput || '';
        const vehicleModel = String(row['Vehicle Model'] || row.vehicleModel || row.model || 'Truck').trim();
        const vehicleName = String(row['Vehicle Name'] || row.vehicleName || vehicleNumber || `Vehicle ${imei}`).trim();

        if (!imei || !/^\d{10,20}$/.test(imei)) {
          throw new Error(`Row ${i + 1}: Invalid or missing IMEI number (${imei || 'empty'}). Must be 10-20 digits.`);
        }
        if (!vehicleNumber) {
          throw new Error(`Row ${i + 1} (IMEI ${imei}): Vehicle Id or Registration Number is required.`);
        }

        const vlttdSlno = String(row.vlttdSlno || row['VLTD SLNO'] || row['VLTTD SLNO'] || '').trim();
        const iccid = String(row.iccid || row['ICCID'] || '').trim();
        const sim1 = String(row.sim1 || row['GPS SIM Number 1'] || row['GPS SIMNO 1'] || row['GPS SIMNO1'] || row['SIM 1'] || row.gpsSimNo || '').trim();
        const sim2 = String(row.sim2 || row['GPS SIM Number 2'] || row['GPS SIMNO 2'] || row['GPS SIMNO2'] || row['SIM 2'] || '').trim();
        const chassisNo = String(row.chassisNo || row.chassisNumber || row['Chassis Number'] || '').trim();
        const engineNo = String(row.engineNo || row.engineNumber || row['Engine Number'] || '').trim();
        const sensorNo = String(row.sensorNo || row['Sensor Number'] || row['Sensor No'] || '').trim();
        const engineOnStatus = String(row.engineOnStatus || row['Ignition ON Status'] || row['Ignition Detection'] || row['engine on status'] || row['Engine ON Status'] || 'Voltage+Ignition').trim();
        const vehicleVoltage = String(row.vehicleVoltage || row['Vehicle Voltage'] || row['vehicle voltage'] || '').trim();
        const timezone = String(row.timezone || row['Timezone'] || row['timezone'] || 'IST').trim();
        const rtoLocation = String(row.rtoLocation || row['Owner Location'] || row['Customer Location'] || row['OWNER /RTO LOCATION'] || row['RTO or Customer Location'] || row.rto || '').trim();
        const installedDate = row.installedDate || row['Installation Date'] || row['Installed Date'] || null;
        const onboardingDate = row.onboardingDate || row['Onboarding Date'] || null;

        const serviceEngineer = String(row.serviceEngineer || row['Service Engineer Number'] || row['Service Engineer'] || row['service engineer'] || row['Installation Person Name'] || '').trim();
        const serviceEngineerPhone = String(row.serviceEngineerPhone || row['Service Mobile Number'] || row['Service Engineer Mobno'] || row['service engineer mobile number'] || row['Installation Person Phone Number'] || '').trim();
        const salesman = String(row.salesman || row['Salesman'] || row['Sales Person Name'] || '').trim();
        const salesmanPhone = String(row.salesmanPhone || row['Salesman Mobile Number'] || row['Salesman Mobno'] || row['salesman mobile number'] || row['Sales Person Phone Number'] || '').trim();

        const oldGroups = String(row.oldGroups || row['OLD GROUPS'] || '').trim();
        const customerName = String(row.ownerName || row['Owner Name'] || row['Customer Name'] || row['Owner name'] || row.name || '').trim();
        const customerPhone = String(row.ownerPhone || row['Owner Mobile Number'] || row['Customer Mobile Number'] || row['Owner mobile number'] || row['Customer Phone Number'] || row.phone || '').trim();
        const aadharNo = String(row.ownerAadhar || row['Owner Aadhar ID'] || row['Customer Aadhar'] || row['Owner AADHAR'] || row['Aadhar Number'] || row.aadharNo || '').trim();
        const panNo = String(row.ownerPan || row['Owner Pancard Number'] || row['Customer PAN'] || row['Owner PAN'] || row['PAN Number'] || row.panNo || '').trim();
        const email = String(row.email || row['Owner Email ID'] || row['Customer Email ID'] || row['Email'] || '').trim().toLowerCase();
        const username = String(row.username || row['Username'] || row['Username Name'] || '').trim();
        const password = String(row.password || row['Password'] || row['password'] || '').trim();

        const licenceId = String(row.licenceId || row['LicenceId'] || row['LicenceId (Starter)'] || '').trim();
        const vehicleTypeSelect = String(row.vehicleTypeSelect || row['Vehicle Type'] || '').trim();
        const odoDistance = String(row.odoDistance || row['Odometer'] || row['Odo Distance'] || '').trim();
        const ticketId = String(row.ticketId || row['Ticket Id'] || '').trim();

        const targetOrgId = row.orgId || callerOrgId;

        // 1. Customer User account handling
        let targetUserId = null;
        if (email || username || customerPhone) {
          const userSearchParam = username || email || customerPhone;
          const userQuery = `SELECT id FROM users WHERE (username = $1 OR email = $1 OR phone = $1) LIMIT 1`;
          const existingUserRes = await client.query(userQuery, [userSearchParam]);

          if (existingUserRes.rows.length > 0) {
            targetUserId = existingUserRes.rows[0].id;
          } else {
            // Create customer user
            const finalEmail = email || `${username || imei}@customer.fueltracks.in`;
            const finalUsername = username || (customerPhone ? `user_${customerPhone}` : `user_${imei}`);
            const finalPassword = password || customerPhone || 'FuelTracks@123';
            const finalName = customerName || `Owner ${vehicleNumber}`;

            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(finalPassword, salt);

            const newUserRes = await client.query(
              `INSERT INTO users (org_id, email, username, password, role, name, phone, aadhar_no, pan_no)
               VALUES ($1, $2, $3, $4, 'customer', $5, $6, $7, $8)
               ON CONFLICT (email) DO UPDATE SET
                 phone = COALESCE(EXCLUDED.phone, users.phone),
                 aadhar_no = COALESCE(EXCLUDED.aadhar_no, users.aadhar_no),
                 pan_no = COALESCE(EXCLUDED.pan_no, users.pan_no)
               RETURNING id`,
              [targetOrgId, finalEmail, finalUsername, hashedPassword, finalName, customerPhone || null, aadharNo || null, panNo || null]
            );
            targetUserId = newUserRes.rows[0]?.id;
          }
        }

        // 2. Group mapping (GROUP + OLD GROUPS)
        const groupRaw = row.group || row['GROUP'] || row.groups || row['Groups'] || '';
        const groupNames = Array.isArray(groupRaw)
          ? groupRaw
          : String(groupRaw).split(',').map(g => g.trim()).filter(Boolean);

        const groupIds = [];
        for (const gName of groupNames) {
          if (!gName) continue;
          let gRes = await client.query(
            `SELECT id FROM groups WHERE org_id = $1 AND name ILIKE $2 LIMIT 1`,
            [targetOrgId, gName]
          );
          if (gRes.rows.length > 0) {
            groupIds.push(gRes.rows[0].id);
          } else {
            // Auto-create group under this org
            const newGroupRes = await client.query(
              `INSERT INTO groups (org_id, name, description)
               VALUES ($1, $2, 'Auto-created during bulk Excel onboarding')
               RETURNING id`,
              [targetOrgId, gName]
            );
            groupIds.push(newGroupRes.rows[0].id);
          }
        }

        // Link customer to groups
        if (targetUserId && groupIds.length > 0) {
          for (const gId of groupIds) {
            await client.query(
              `INSERT INTO user_groups (user_id, group_id)
               VALUES ($1, $2) ON CONFLICT (user_id, group_id) DO NOTHING`,
              [targetUserId, gId]
            );
          }
        }

        // 3. Upsert Device
        await client.query(
          `INSERT INTO devices 
            (org_id, device_id, device_type, licence_id, assigned_user_id, assigned_group_id)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (device_id) DO UPDATE SET
             org_id = EXCLUDED.org_id,
             device_type = EXCLUDED.device_type,
             licence_id = EXCLUDED.licence_id,
             assigned_user_id = EXCLUDED.assigned_user_id,
             assigned_group_id = EXCLUDED.assigned_group_id`,
          [targetOrgId, imei, deviceType, licenceId || null, targetUserId, groupIds[0] || null]
        );

        // 4. Construct comprehensive metadata
        const metadata = {
          vehicleId: vehicleIdInput || vehicleNumber,
          vlttdSlno,
          iccid,
          sim1,
          sim2,
          chassisNo,
          engineNo,
          sensorNo,
          engineOnStatus,
          engineOn: engineOnStatus,
          batteryVoltage: vehicleVoltage,
          timezone,
          rtoLocation,
          installedDate,
          serviceEngineer,
          serviceEngineerPhone,
          salesman,
          salesmanPhone,
          oldGroups,
          ownerName: customerName,
          ownerPhone: customerPhone,
          customerName,
          customerPhone,
          aadharNo,
          panNo,
          deviceModel: deviceType,
          onboardedVia: 'EXCEL_BULK_IMPORT',
          registrationNo,
          vehicleTypeSelect,
          odoDistance,
          ticketId,
          licenceId,
          onboardingDate
        };

        let issuedDate = new Date();
        if (installedDate) {
          const d = new Date(installedDate);
          if (!isNaN(d.getTime())) {
            issuedDate = d;
          }
        }
        const expireDate = new Date(issuedDate.getTime());
        expireDate.setFullYear(expireDate.getFullYear() + 1);

        // 5. Upsert Vehicle
        const vehicleRes = await client.query(
          `INSERT INTO vehicles 
            (org_id, imei, name, plate, model, gps_sim_no, metadata, licence_issued_date, licence_expire_date, is_active, category)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, TRUE, $10)
           ON CONFLICT (imei) DO UPDATE SET
             org_id = EXCLUDED.org_id,
             name = EXCLUDED.name,
             plate = EXCLUDED.plate,
             model = EXCLUDED.model,
             gps_sim_no = EXCLUDED.gps_sim_no,
             metadata = EXCLUDED.metadata,
             licence_issued_date = EXCLUDED.licence_issued_date,
             licence_expire_date = EXCLUDED.licence_expire_date,
             is_active = TRUE,
             category = EXCLUDED.category
           RETURNING id, name, imei, plate, category`,
          [targetOrgId, imei, vehicleName, registrationNo || vehicleNumber, vehicleTypeSelect || vehicleModel || 'Truck', sim1, JSON.stringify(metadata), issuedDate, expireDate, category || 'General']
        );

        const vehicleId = vehicleRes.rows[0]?.id;

        // 6. Link Vehicle to Multiple Groups
        if (vehicleId && groupIds.length > 0) {
          for (const gId of groupIds) {
            await client.query(
              `INSERT INTO vehicle_groups (vehicle_id, group_id)
               VALUES ($1, $2) ON CONFLICT (vehicle_id, group_id) DO NOTHING`,
              [vehicleId, gId]
            );
          }
        }

        // 7. Ensure vehicle_latest_state exists
        if (vehicleId) {
          await client.query(
            `INSERT INTO vehicle_latest_state (vehicle_id, is_online)
             VALUES ($1, FALSE) ON CONFLICT (vehicle_id) DO NOTHING`,
            [vehicleId]
          );
        }

        onboardedResults.push({
          imei,
          vehicleNumber,
          vehicleName,
          category,
          groupsCount: groupIds.length
        });
      }

      await client.query('COMMIT');

      res.status(201).json({
        success: true,
        message: `Successfully onboarded ${onboardedResults.length} vehicles from Excel!`,
        count: onboardedResults.length,
        data: onboardedResults
      });

      // Background audit log
      try {
        await AuditService.log({
          auditType: 'vehicle', entityType: 'Vehicle',
          action: 'BULK_IMPORT',
          newData: { totalCount: onboardedResults.length, vehicles: onboardedResults.map(v => v.imei) },
          performedById: req.user.userId, performedByRole: req.user.role,
          orgId: callerOrgId,
          ipAddress: AuditService.getIp(req), userAgent: AuditService.getUserAgent(req),
        });
      } catch (auditErr) { console.error('[AUDIT]', auditErr.message); }
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('[BULK-ONBOARD-ERROR]', err);
      res.status(400).json({
        success: false,
        error: err.message || 'Failed to complete bulk vehicle onboarding.'
      });
    } finally {
      client.release();
    }
  }
};

module.exports = OnboardController;
