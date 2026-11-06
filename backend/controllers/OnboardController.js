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
      const targetGroupIds = [];

      if (userType === 'new') {
        const { name, phone, email, password, username, location, aadhar, existingGroupId, additionalGroupId, orgId } = newUser;
        const finalUsername = (username || name || email || '').trim();
        if (!email || !password || !finalUsername) {
          throw new Error('User Name, Email, and Password are required.');
        }

        // Always auto-create Organization with exact username (preserving exact CAPITALS) for the new user
        const orgName = finalUsername;
        const parentOrgId = req.user.role === 'superadmin' ? null : req.user.orgId;

        let orgCheck;
        if (parentOrgId) {
          orgCheck = await client.query(
            'SELECT id FROM organizations WHERE (name = $1 OR LOWER(TRIM(name)) = LOWER(TRIM($1))) AND parent_id = $2 LIMIT 1',
            [orgName, parentOrgId]
          );
        } else {
          orgCheck = await client.query(
            'SELECT id FROM organizations WHERE name = $1 OR LOWER(TRIM(name)) = LOWER(TRIM($1)) LIMIT 1',
            [orgName]
          );
        }

        if (orgCheck.rows.length > 0) {
          targetOrgId = orgCheck.rows[0].id;
        } else {
          const newOrgRes = await client.query(
            `INSERT INTO organizations (name, type, parent_id, email, phone, contact_person)
             VALUES ($1, 'customer', $2, $3, $4, $5)
             RETURNING id`,
            [orgName, parentOrgId, email.toLowerCase().trim(), phone || null, name || finalUsername]
          );
          targetOrgId = newOrgRes.rows[0].id;
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const userResult = await client.query(
          `INSERT INTO users (org_id, email, password, role, name, phone, username, location, aadhar, temp_password)
           VALUES ($1, $2, $3, 'customer', $4, $5, $6, $7, $8, $9)
           RETURNING id`,
          [targetOrgId, email.toLowerCase().trim(), hashedPassword, name || finalUsername, phone || '', finalUsername, location || '', aadhar || '', password]
        );
        targetUserId = userResult.rows[0].id;

        // Auto-create Group with exact username (preserving exact CAPITALS) for the new user
        const groupName = finalUsername;
        let groupCheck = await client.query(
          `SELECT id FROM groups WHERE org_id = $1 AND name = $2 LIMIT 1`,
          [targetOrgId, groupName]
        );
        if (groupCheck.rows.length === 0) {
          groupCheck = await client.query(
            `SELECT id FROM groups WHERE org_id = $1 AND LOWER(TRIM(name)) = LOWER(TRIM($2)) LIMIT 1`,
            [targetOrgId, groupName]
          );
        }

        if (groupCheck.rows.length > 0) {
          targetGroupId = groupCheck.rows[0].id;
        } else {
          const newGroupRes = await client.query(
            `INSERT INTO groups (org_id, name, description, is_active)
             VALUES ($1, $2, $3, TRUE)
             RETURNING id`,
            [targetOrgId, groupName, `Auto-created group for user ${groupName}`]
          );
          targetGroupId = newGroupRes.rows[0].id;
        }

        if (targetGroupId) {
          targetGroupIds.push(targetGroupId);
        }

        const extraGroup = existingGroupId || additionalGroupId;
        if (extraGroup && String(extraGroup) !== String(targetGroupId)) {
          targetGroupIds.push(extraGroup);
        }

        // Link the new user ONLY to their primary group in user_groups
        if (targetUserId && targetGroupId) {
          await client.query(
            `INSERT INTO user_groups (user_id, group_id)
             VALUES ($1, $2)
             ON CONFLICT (user_id, group_id) DO NOTHING`,
            [targetUserId, targetGroupId]
          );
        }
      } else {
        if (!existingUser || !existingUser.userId) {
          throw new Error('Existing user details are required.');
        }
        targetUserId = existingUser.userId;

        // If orgId wasn't explicitly selected, retrieve it from the user's account
        if (existingUser.orgId) {
          targetOrgId = existingUser.orgId;
        } else {
          const userOrgRes = await client.query('SELECT org_id FROM users WHERE id = $1', [targetUserId]);
          if (userOrgRes.rows.length > 0 && userOrgRes.rows[0].org_id) {
            targetOrgId = userOrgRes.rows[0].org_id;
          }
        }

        targetGroupId = existingUser.groupId || null;
        if (targetGroupId) {
          targetGroupIds.push(targetGroupId);
        }

        const extraGroup = existingUser.additionalGroupId || existingUser.existingGroupId;
        if (extraGroup && String(extraGroup) !== String(targetGroupId)) {
          targetGroupIds.push(extraGroup);
        }

        // Link existing user ONLY to their primary group in user_groups
        if (targetUserId && targetGroupId) {
          await client.query(
            `INSERT INTO user_groups (user_id, group_id)
             VALUES ($1, $2)
             ON CONFLICT (user_id, group_id) DO NOTHING`,
            [targetUserId, targetGroupId]
          );
        }
      }

      // ── Validate device IDs & duplicate checks first ───────────
      const seenImeisForm = new Map();
      const seenPlatesForm = new Map();
      const seenIccidsForm = new Map();

      for (let i = 0; i < devices.length; i++) {
        const d = devices[i];
        if (!d.deviceId || !String(d.deviceId).trim()) {
          throw new Error(`Row ${i + 1}: Device Id (IMEI) is required.`);
        }
        const imei = String(d.deviceId).trim();
        const plate = String(d.registrationNo || d.vehicleId || '').trim().toUpperCase();
        const iccid = String(d.iccid || '').trim();

        if (seenImeisForm.has(imei)) {
          throw new Error(`Duplicate IMEI "${imei}" submitted in form (rows ${seenImeisForm.get(imei)} & ${i + 1}). Duplicate data is not allowed.`);
        }
        seenImeisForm.set(imei, i + 1);

        if (plate) {
          if (seenPlatesForm.has(plate)) {
            throw new Error(`Duplicate Registration Number / Vehicle ID "${plate}" submitted in form (rows ${seenPlatesForm.get(plate)} & ${i + 1}). Duplicate data is not allowed.`);
          }
          seenPlatesForm.set(plate, i + 1);
        }

        if (iccid) {
          if (seenIccidsForm.has(iccid)) {
            throw new Error(`Duplicate ICCID "${iccid}" submitted in form (rows ${seenIccidsForm.get(iccid)} & ${i + 1}). Duplicate data is not allowed.`);
          }
          seenIccidsForm.set(iccid, i + 1);
        }
      }

      // ── Database duplicate checks for single/form onboarding ─────
      const formImeis = Array.from(seenImeisForm.keys());
      if (formImeis.length > 0) {
        const existingDev = await client.query(`SELECT device_id FROM devices WHERE device_id = ANY($1::text[])`, [formImeis]);
        if (existingDev.rows.length > 0) {
          throw new Error(`Device with IMEI "${existingDev.rows[0].device_id}" is already registered in the system.`);
        }
        const existingVeh = await client.query(`SELECT imei FROM vehicles WHERE imei = ANY($1::text[])`, [formImeis]);
        if (existingVeh.rows.length > 0) {
          throw new Error(`Vehicle with IMEI "${existingVeh.rows[0].imei}" is already registered in the system.`);
        }
      }

      const formPlates = Array.from(seenPlatesForm.keys());
      if (formPlates.length > 0) {
        const existingPlate = await client.query(
          `SELECT plate, name FROM vehicles WHERE UPPER(TRIM(plate)) = ANY($1::text[]) OR UPPER(TRIM(name)) = ANY($1::text[])`,
          [formPlates]
        );
        if (existingPlate.rows.length > 0) {
          const matched = existingPlate.rows[0].plate || existingPlate.rows[0].name;
          throw new Error(`Vehicle with Registration Number / ID "${matched}" is already registered in the system.`);
        }
      }

      const formIccids = Array.from(seenIccidsForm.keys());
      if (formIccids.length > 0) {
        const existingIccid = await client.query(
          `SELECT metadata->>'iccid' as iccid FROM vehicles WHERE metadata->>'iccid' = ANY($1::text[])`,
          [formIccids]
        );
        if (existingIccid.rows.length > 0) {
          throw new Error(`SIM / ICCID "${existingIccid.rows[0].iccid}" is already registered in the system.`);
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

        const quotaOrgId = req.user.orgId || targetOrgId;
        const orgResult = await client.query(
          `SELECT device_limits FROM organizations WHERE id = $1`, [quotaOrgId]
        );
        const limits = orgResult.rows[0]?.device_limits || { Starter: 0, Basic: 0, Advanced: 0, Premium: 0 };

        const usedResult = await client.query(
          `SELECT
             COUNT(*) FILTER (WHERE licence_id LIKE 'ST%') AS "Starter",
             COUNT(*) FILTER (WHERE licence_id LIKE 'BC%') AS "Basic",
             COUNT(*) FILTER (WHERE licence_id LIKE 'AD%') AS "Advanced",
             COUNT(*) FILTER (WHERE licence_id LIKE 'EN%') AS "Premium"
           FROM devices WHERE org_id = $1 OR org_id IN (SELECT id FROM organizations WHERE parent_id = $1)`, [quotaOrgId]
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
        let {
          licenceId: rawDeviceLicenceId, deviceId, deviceType, vehicleId,
          vehicleName, registrationNo, vehicleModel, vehicleTypeSelect,
          gpsSimNo, gpsSimNo2, odoDistance, serviceEngineer, salesman, serviceEngineerMob, salesmanMob, ticketId, sensorNo,
          iccid, vehicleVoltage, ignitionDetection, timezone, vlttdSlno
        } = device;

        deviceId = String(deviceId || '').trim();
        registrationNo = String(registrationNo || '').trim();
        vehicleId = String(vehicleId || '').trim();
        iccid = String(iccid || '').trim();
        vehicleName = vehicleName ? String(vehicleName).trim() : (vehicleId || `Vehicle ${deviceId}`);
        gpsSimNo = String(gpsSimNo || '').trim();
        gpsSimNo2 = String(gpsSimNo2 || '').trim();

        // Auto-generate licenceId if not provided
        const licenceId = rawDeviceLicenceId || `ST${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

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
          ignitionDetection: ignitionDetection || '',
          vlttdSlno: vlttdSlno || ''
        };

        const vehicleNameValue = vehicleName || `Vehicle ${deviceId}`;

        const issuedDate = new Date();
        const expireDate = new Date(issuedDate.getTime());
        expireDate.setFullYear(expireDate.getFullYear() + 1);
        expireDate.setDate(expireDate.getDate() - 1);

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

          if (targetGroupIds.length > 0) {
            for (const gId of targetGroupIds) {
              await client.query(
                `INSERT INTO vehicle_groups (vehicle_id, group_id)
                 VALUES ($1, $2)
                 ON CONFLICT (vehicle_id, group_id) DO NOTHING`,
                [newVehicleId, gId]
              );
            }
          }
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
      console.error('[ONBOARD-ERROR]', err.message || err);
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

      // ── 1. Collect all IMEIs, plates, and ICCIDs from submitted file ──
      const rawImeisList = [];
      const rawPlatesList = [];
      const rawIccidsList = [];

      for (let i = 0; i < records.length; i++) {
        const row = records[i];
        let imei = String(row['Device ID(IMEI)'] || row.imei || row['IMEI Number'] || row['IMEI'] || row.deviceId || '').trim();
        if (imei.includes('e+') || imei.includes('E+')) {
          try { imei = BigInt(Number(imei)).toString(); } catch (e) {}
        }
        const regNo = String(row['Registration Number'] || row['Registration No'] || row.registrationNo || row.plate || row['Vehicle Id'] || row.vehicleId || '').trim().toUpperCase();
        const iccid = String(row.iccid || row['ICCID'] || '').trim();

        if (imei) rawImeisList.push(imei);
        if (regNo) rawPlatesList.push(regNo);
        if (iccid) rawIccidsList.push(iccid);
      }

      // ── 2. Pre-fetch existing database records for duplicate detection ──
      const existingImeisSet = new Set();
      if (rawImeisList.length > 0) {
        const dbDevRes = await client.query(`SELECT device_id FROM devices WHERE device_id = ANY($1::text[])`, [rawImeisList]);
        dbDevRes.rows.forEach(r => { if (r.device_id) existingImeisSet.add(String(r.device_id).trim()); });

        const dbVehRes = await client.query(`SELECT imei FROM vehicles WHERE imei = ANY($1::text[])`, [rawImeisList]);
        dbVehRes.rows.forEach(r => { if (r.imei) existingImeisSet.add(String(r.imei).trim()); });
      }

      const existingPlatesSet = new Set();
      if (rawPlatesList.length > 0) {
        const dbPlateRes = await client.query(
          `SELECT plate, name FROM vehicles WHERE UPPER(TRIM(plate)) = ANY($1::text[]) OR UPPER(TRIM(name)) = ANY($1::text[])`,
          [rawPlatesList]
        );
        dbPlateRes.rows.forEach(r => {
          if (r.plate) existingPlatesSet.add(String(r.plate).trim().toUpperCase());
          if (r.name) existingPlatesSet.add(String(r.name).trim().toUpperCase());
        });
      }

      const existingIccidsSet = new Set();
      if (rawIccidsList.length > 0) {
        const dbIccidRes = await client.query(
          `SELECT metadata->>'iccid' as iccid FROM vehicles WHERE metadata->>'iccid' = ANY($1::text[])`,
          [rawIccidsList]
        );
        dbIccidRes.rows.forEach(r => {
          if (r.iccid) existingIccidsSet.add(String(r.iccid).trim());
        });
      }

      const onboardedResults = [];
      const skippedResults = [];
      const seenImeisInBatch = new Set();
      const seenPlatesInBatch = new Set();

      for (let i = 0; i < records.length; i++) {
        const row = records[i];
        const rawDeviceType = String(row['Device Type'] || row.deviceType || row['Device Type (BSTPL/AIS140/AIS140V2/CONCOX/VOLTY/FMB 920)'] || row['Device Model'] || 'AIS140').trim();
        const deviceType = rawDeviceType.split(' (')[0].trim();
        let imei = String(row['Device ID(IMEI)'] || row.imei || row['IMEI Number'] || row['IMEI'] || row.deviceId || '').trim();
        if (imei.includes('e+') || imei.includes('E+')) {
          try { imei = BigInt(Number(imei)).toString(); } catch (e) {}
        }
        const category = String(row['Category'] || row.category || 'General').trim();
        const registrationNo = String(row['Registration Number'] || row['Registration No'] || row.registrationNo || row.plate || '').trim();
        const vehicleIdInput = String(row['Vehicle Id'] || row.vehicleId || '').trim();
        const upperPlate = (registrationNo || vehicleIdInput || '').toUpperCase().trim();
        const iccid = String(row.iccid || row['ICCID'] || '').trim();

        // 1. Validate IMEI format
        if (!imei || !/^\d{10,20}$/.test(imei)) {
          skippedResults.push({
            imei: imei || 'EMPTY',
            row: i + 1,
            reason: `Invalid or missing IMEI (${imei || 'empty'}). Must be 10-20 numeric digits.`
          });
          continue;
        }

        // 2. Check duplicate IMEI within the uploaded batch
        if (seenImeisInBatch.has(imei)) {
          skippedResults.push({
            imei,
            row: i + 1,
            reason: `Duplicate IMEI "${imei}" in uploaded file (already processed earlier row).`
          });
          continue;
        }
        seenImeisInBatch.add(imei);

        // 3. Skip if IMEI is already registered in database
        if (existingImeisSet.has(imei)) {
          skippedResults.push({
            imei,
            row: i + 1,
            reason: `Device with IMEI "${imei}" is already registered in the system.`
          });
          continue;
        }

        // 4. Check plate uniqueness if provided
        if (upperPlate) {
          if (seenPlatesInBatch.has(upperPlate)) {
            skippedResults.push({
              imei,
              plate: upperPlate,
              row: i + 1,
              reason: `Duplicate Registration / Vehicle ID "${upperPlate}" in uploaded file.`
            });
            continue;
          }
          seenPlatesInBatch.add(upperPlate);

          if (existingPlatesSet.has(upperPlate)) {
            skippedResults.push({
              imei,
              plate: upperPlate,
              row: i + 1,
              reason: `Vehicle with Registration Number / ID "${upperPlate}" is already registered in the system.`
            });
            continue;
          }
        }

        // 5. Check ICCID uniqueness if provided
        if (iccid && existingIccidsSet.has(iccid)) {
          skippedResults.push({
            imei,
            iccid,
            row: i + 1,
            reason: `SIM / ICCID "${iccid}" is already registered in the system.`
          });
          continue;
        }

        // Auto-assign vehicle identifiers if missing (supports IMEI-only bulk upload)
        const vehicleNumber = registrationNo || vehicleIdInput || `VEH-${imei}`;
        const vehicleModel = String(row['Vehicle Model'] || row.vehicleModel || row.model || 'Truck').trim();
        const vehicleName = String(row['Vehicle Name'] || row.vehicleName || (registrationNo || vehicleIdInput ? vehicleNumber : `Vehicle ${imei}`)).trim();

        const vlttdSlno = String(
          row.vlttdSlno || row.serialNo || row.deviceSerialNo ||
          row['VLTD SLNO'] || row['VLTTD SLNO'] || row['Device Serial Number'] ||
          row['Device Serial No'] || row['Serial Number'] || row['Serial No'] ||
          row['VLTD Serial Number'] || row['VLTD Serial No'] ||
          row['SLNO'] || row['SL NO'] || ''
        ).trim();

        const resolveBulkManufacturer = (m, s, explicit) => {
          if (explicit && typeof explicit === 'string' && explicit.trim() && explicit.trim() !== 'FUELTRACKS TECHNOLOGIES PRIVATE LIMITED') {
            const up = explicit.trim().toUpperCase();
            if (up.includes('VOLTY') || up.includes('VOLTSYS') || up === 'VOLTY') return 'VOLTY IOT SOLUTIONS PRIVATE LIMITED';
            if (up.includes('APM') || up.includes('KINGSTRACK')) return 'APM KINGSTRACK PRIVATE LIMITED';
            if (up.includes('TELTONIKA')) return 'TELTONIKA TELEMATICS';
            if (up.includes('CONCOX') || up.includes('JIMI')) return 'CONCOX / JIMI IOT';
            if (up.includes('BSTPL') || up.includes('BHARAT SATELLITE')) return 'BHARAT SATELLITE TRACKING PVT LTD';
            if (up.includes('TRACKNOW')) return 'TRACKNOW SOLUTIONS PRIVATE LIMITED';
            if (up.includes('VAMO')) return 'VAMO SYSTEMS PRIVATE LIMITED';
            if (up.includes('TRANSYNC')) return 'TRANSYNC TELEMATICS';
            return explicit.trim();
          }
          const text = `${m || ''} ${s || ''}`.toUpperCase().trim();
          if (text.includes('VOLTY') || text.includes('VOL1') || text.includes('VLY') || text.includes('VLT') || text.includes('VOLTSYS') || text.startsWith('VOL') || text.startsWith('VLY')) {
            return 'VOLTY IOT SOLUTIONS PRIVATE LIMITED';
          }
          if (text.includes('APM') || text.includes('KINGSTRACK') || text.startsWith('APM') || text.includes('1819001A')) {
            return 'APM KINGSTRACK PRIVATE LIMITED';
          }
          if (text.includes('TELTONIKA') || text.includes('FMC') || text.includes('FMB') || text.includes('FMM') || text.includes('TST')) {
            return 'TELTONIKA TELEMATICS';
          }
          if (text.includes('CONCOX') || text.includes('JIMI') || text.includes('WETRACK') || text.includes('GT06') || text.includes('GT800') || text.includes('V5')) {
            return 'CONCOX / JIMI IOT';
          }
          if (text.includes('BSTPL') || text.includes('BST')) {
            return 'BHARAT SATELLITE TRACKING PVT LTD';
          }
          if (text.includes('TRACKNOW') || text.includes('TRK')) {
            return 'TRACKNOW SOLUTIONS PRIVATE LIMITED';
          }
          if (text.includes('VAMO')) {
            return 'VAMO SYSTEMS PRIVATE LIMITED';
          }
          if (text.includes('TRANSYNC') || text.includes('NAV140') || text.includes('NAV 140')) {
            return 'TRANSYNC TELEMATICS';
          }
          return 'VOLTY IOT SOLUTIONS PRIVATE LIMITED';
        };

        const explicitMfr = String(row.manufacturer || row.vltdManufacturer || row['VLTD Manufacturer Name'] || row['Manufacturer'] || '').trim();
        const vltdManufacturer = resolveBulkManufacturer(deviceType, vlttdSlno, explicitMfr);
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

        // Auto-generate licenceId if not provided in Excel
        const rawLicenceId = String(row.licenceId || row['LicenceId'] || row['LicenceId (Starter)'] || '').trim();
        const licencePrefix = 'ST'; // Default tier prefix
        const licenceId = rawLicenceId || `${licencePrefix}${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
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
            const finalUsername = (username || (customerPhone ? `user_${customerPhone}` : `user_${imei}`)).trim().toLowerCase();
            const finalPassword = password || customerPhone || 'FuelTracks@123';
            const finalName = customerName || `Owner ${vehicleNumber}`;

            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(finalPassword, salt);

            const newUserRes = await client.query(
              `INSERT INTO users (org_id, email, username, password, role, name, phone, aadhar_no, pan_no, temp_password)
               VALUES ($1, $2, $3, $4, 'customer', $5, $6, $7, $8, $9)
               ON CONFLICT (email) DO UPDATE SET
                 phone = COALESCE(EXCLUDED.phone, users.phone),
                 aadhar_no = COALESCE(EXCLUDED.aadhar_no, users.aadhar_no),
                 pan_no = COALESCE(EXCLUDED.pan_no, users.pan_no)
               RETURNING id`,
              [targetOrgId, finalEmail, finalUsername, hashedPassword, finalName, customerPhone || null, aadharNo || null, panNo || null, finalPassword]
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

        // Also ensure a group with the username is automatically created and assigned
        const autoUserGroupName = (username || (customerPhone ? `user_${customerPhone}` : `user_${imei}`)).trim();
        if (autoUserGroupName && targetUserId) {
          let uGroupRes = await client.query(
            `SELECT id FROM groups WHERE org_id = $1 AND LOWER(TRIM(name)) = LOWER(TRIM($2)) LIMIT 1`,
            [targetOrgId, autoUserGroupName]
          );
          let uGroupId;
          if (uGroupRes.rows.length > 0) {
            uGroupId = uGroupRes.rows[0].id;
          } else {
            const newUGroupRes = await client.query(
              `INSERT INTO groups (org_id, name, description, is_active)
               VALUES ($1, $2, 'Auto-created group for user', TRUE)
               RETURNING id`,
              [targetOrgId, autoUserGroupName]
            );
            uGroupId = newUGroupRes.rows[0].id;
          }
          if (uGroupId && !groupIds.includes(uGroupId)) {
            groupIds.push(uGroupId);
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
          deviceSerialNo: vlttdSlno,
          serialNo: vlttdSlno,
          vltdManufacturer,
          modelName: deviceType,
          deviceModel: deviceType,
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
          email,
          username,
          password,
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
        expireDate.setDate(expireDate.getDate() - 1);

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

        // 8. Auto-populate device_inventory table with real hardware profile
        try {
          await client.query(
            `INSERT INTO device_inventory (
              org_id, imei, serial_no, iccid, device_model, manufacturer, sim_provider, sim_no, batch_name
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            ON CONFLICT (imei) DO UPDATE SET
              serial_no = COALESCE(EXCLUDED.serial_no, device_inventory.serial_no),
              iccid = COALESCE(EXCLUDED.iccid, device_inventory.iccid),
              device_model = COALESCE(EXCLUDED.device_model, device_inventory.device_model),
              manufacturer = COALESCE(EXCLUDED.manufacturer, device_inventory.manufacturer),
              sim_no = COALESCE(EXCLUDED.sim_no, device_inventory.sim_no),
              updated_at = NOW()`,
            [
              targetOrgId,
              imei,
              vlttdSlno || null,
              iccid || null,
              deviceType || null,
              vltdManufacturer,
              'Technojacks',
              sim1 || null,
              'Bulk_Onboarding'
            ]
          );
        } catch (_) {}

        onboardedResults.push({
          imei,
          vehicleNumber,
          vehicleName,
          category,
          groupsCount: groupIds.length
        });
      }

      await client.query('COMMIT');

      const totalOnboarded = onboardedResults.length;
      const totalSkipped = skippedResults.length;

      let summaryMsg = '';
      if (totalOnboarded > 0 && totalSkipped > 0) {
        summaryMsg = `Successfully onboarded ${totalOnboarded} new vehicles! (${totalSkipped} existing/duplicate records were skipped).`;
      } else if (totalOnboarded > 0) {
        summaryMsg = `Successfully onboarded all ${totalOnboarded} vehicles!`;
      } else {
        summaryMsg = `All ${totalSkipped} records are already registered in the system or duplicates. No new vehicles were added.`;
      }

      res.status(201).json({
        success: true,
        message: summaryMsg,
        count: totalOnboarded,
        skippedCount: totalSkipped,
        skipped: skippedResults,
        data: onboardedResults
      });

      // Background audit log
      if (totalOnboarded > 0) {
        try {
          await AuditService.log({
            auditType: 'vehicle', entityType: 'Vehicle',
            action: 'BULK_IMPORT',
            newData: {
              totalCount: totalOnboarded,
              skippedCount: totalSkipped,
              vehicles: onboardedResults.map(v => v.imei)
            },
            performedById: req.user.userId, performedByRole: req.user.role,
            orgId: callerOrgId,
            ipAddress: AuditService.getIp(req), userAgent: AuditService.getUserAgent(req),
          });
        } catch (auditErr) { console.error('[AUDIT]', auditErr.message); }
      }
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
