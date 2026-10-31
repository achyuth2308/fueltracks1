// ============================================================
// VEHICLE CONTROLLER
// Handles CRUD operations, history tracking, route lines, alerts, and reports
// ============================================================

const VehicleModel = require('../models/vehicleModel');
const GpsModel = require('../models/gpsModel');
const GroupModel = require('../models/groupModel');
const archiveService = require('../services/archiveService');
const GeofenceModel = require('../models/geofenceModel');
const AuditService = require('../services/auditService');
const UserModel = require('../models/userModel');
const bcrypt = require('bcryptjs');
const { redis } = require('../config/redis');
const db = require('../config/db');

const VehicleController = {
  /**
   * Get all vehicles with latest status
   */
  async getAllVehicles(req, res, next) {
    try {
      const { page, limit, search, groupId, category, orgId } = req.query;
      const parsedPage = parseInt(page) || 1;
      const parsedLimit = parseInt(limit) || 10000;

      // If groupId is provided, ensure user has access to it
      if (groupId && req.user.role !== 'superadmin') {
        const hasAccess = await GroupModel.belongsToOrg(groupId, req.user.orgId);
        if (!hasAccess) {
          return res.status(403).json({
            success: false,
            error: 'Access denied to group.',
            code: 'FORBIDDEN'
          });
        }
      }

      const result = await VehicleModel.findAll(req.user.orgId, req.user.role, {
        page: parsedPage,
        limit: parsedLimit,
        search,
        groupId,
        category,
        orgId,
        userId: req.user.userId
      });

      res.status(200).json({
        success: true,
        data: result.vehicles,
        pagination: result.pagination
      });
    } catch (err) {
      next(err);
    }
  },

  async getTodayMetrics(req, res, next) {
    try {
      const result = await db.query(`
        SELECT v.id as vehicle_id,
               COALESCE(vls.today_distance, 0) as cdist,
               GREATEST(0, CASE
                 WHEN v.metadata->>'odometerReading' IS NOT NULL AND v.metadata->>'odometerReading' != '' AND v.metadata->>'odometerReading' != '0'
                 THEN COALESCE(CAST(NULLIF(v.metadata->>'odometerReading','') AS NUMERIC), 0) + GREATEST(0, (COALESCE(vls.today_start_odometer, vls.odometer, 0) + COALESCE(vls.today_distance, 0)) - COALESCE(CAST(NULLIF(v.metadata->>'odometerSnapshot','') AS NUMERIC), 0))
                 ELSE COALESCE(vls.today_start_odometer, vls.odometer, 0) + COALESCE(vls.today_distance, 0)
               END) as dynamic_odo
        FROM vehicles v
        LEFT JOIN vehicle_latest_state vls ON v.id = vls.vehicle_id
      `);

      const metrics = {};
      result.rows.forEach(row => {
        metrics[row.vehicle_id] = {
          cDist: parseFloat(row.cdist || 0),
          dynamicOdo: Math.max(0, parseFloat(row.dynamic_odo || 0))
        };
      });

      res.json({ success: true, data: metrics });
    } catch (err) {
      next(err);
    }
  },

  /**
   * Get single vehicle details + latest state
   */
  async getVehicleById(req, res, next) {
    try {
      const { id } = req.params;

      // Ownership check (unless superadmin)
      if (req.user.role !== 'superadmin') {
        const belongs = await VehicleModel.belongsToOrg(id, req.user.orgId, req.user.userId, req.user.role);
        if (!belongs) {
          return res.status(403).json({
            success: false,
            error: 'Access denied to vehicle.',
            code: 'FORBIDDEN'
          });
        }
      }

      const vehicle = await VehicleModel.findById(id);
      if (!vehicle) {
        return res.status(404).json({
          success: false,
          error: 'Vehicle not found.',
          code: 'VEHICLE_NOT_FOUND'
        });
      }

      const groups = await VehicleModel.getGroups(id);

      res.status(200).json({
        success: true,
        data: {
          ...vehicle,
          groups
        }
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * Create vehicle (IMEI is mandatory)
   */
  async createVehicle(req, res, next) {
    try {
      const { imei, name, plate, model, driverName, driverPhone, orgId, groupIds, serverName, gpsSimNo, deviceVersion, timezone, apn, licenceIssuedDate, licenceExpireDate, metadata, category, isSandMining } = req.body;

      if (!imei || !/^\d{15}$/.test(imei)) {
        return res.status(400).json({
          success: false,
          error: 'A valid 15-digit IMEI number is required.',
          code: 'VALIDATION_ERROR'
        });
      }

      if (!name || name.trim() === '') {
        return res.status(400).json({
          success: false,
          error: 'Vehicle Name is mandatory.',
          code: 'VALIDATION_ERROR'
        });
      }

      // Determine organization to assign to
      let targetOrgId = req.user.orgId;
      if (req.user.role === 'superadmin' && orgId) {
        targetOrgId = orgId;
      } else if (orgId && orgId !== req.user.orgId) {
        // Dealer assigning to a child organization
        const checkOrg = await db.query('SELECT id FROM organizations WHERE id = $1 AND parent_id = $2', [orgId, req.user.orgId]);
        if (checkOrg.rows.length > 0) {
          targetOrgId = orgId;
        } else {
          return res.status(403).json({
            success: false,
            error: 'You can only assign vehicles to your own organization or your direct customers.',
            code: 'FORBIDDEN'
          });
        }
      }

      // Check if IMEI already exists
      const existing = await VehicleModel.findByImei(imei);
      if (existing) {
        return res.status(409).json({
          success: false,
          error: 'A vehicle with this IMEI is already registered.',
          code: 'IMEI_ALREADY_EXISTS'
        });
      }

      // Check if Registration Number / Plate already exists
      if (plate && plate.trim()) {
        const existingPlate = await db.query(
          `SELECT id FROM vehicles WHERE UPPER(TRIM(plate)) = UPPER(TRIM($1)) OR UPPER(TRIM(name)) = UPPER(TRIM($1))`,
          [plate.trim()]
        );
        if (existingPlate.rows.length > 0) {
          return res.status(409).json({
            success: false,
            error: `A vehicle with Registration Number "${plate.trim()}" is already registered.`,
            code: 'PLATE_ALREADY_EXISTS'
          });
        }
      }

      // Prepare final metadata and initialize odometerSnapshot
      let finalMetadata = metadata ? { ...metadata } : {};
      if (finalMetadata.engineOnStatus) {
        finalMetadata.engineOn = finalMetadata.engineOnStatus;
      } else if (finalMetadata.engineOn) {
        finalMetadata.engineOnStatus = finalMetadata.engineOn;
      }
      if (finalMetadata.vehicleVoltage) {
        finalMetadata.batteryVoltage = finalMetadata.vehicleVoltage;
      } else if (finalMetadata.batteryVoltage) {
        finalMetadata.vehicleVoltage = finalMetadata.batteryVoltage;
      }

      // If custom baseline odometerReading is set, check if device already has recorded distance
      const initialBaseline = parseFloat(finalMetadata.odometerReading);
      if (!isNaN(initialBaseline) && initialBaseline > 0) {
        const vls = await db.query(
          `SELECT vls.odometer FROM vehicle_latest_state vls 
           JOIN vehicles v ON v.id = vls.vehicle_id 
           WHERE v.imei = $1`,
          [imei]
        );
        const currentGpsOdo = vls.rows[0]?.odometer ?? 0;
        finalMetadata.odometerSnapshot = String(currentGpsOdo);
      }

      const newVehicle = await VehicleModel.create({
        orgId: targetOrgId,
        imei,
        name,
        plate,
        model,
        driverName,
        driverPhone,
        serverName,
        gpsSimNo,
        deviceVersion,
        timezone,
        apn,
        licenceIssuedDate,
        licenceExpireDate,
        metadata: finalMetadata,
        category: category || 'General',
        isSandMining: isSandMining === true
      });

      // Sync Sand Mining state to Redis
      if (isSandMining === true) {
        await redis.sadd('sand:mining_imeis', imei);
        // Store vehicle metadata for government bridge
        await redis.hset(`sand:vehicle:${imei}`, 'vehicleNo', plate || '', 'vehicleId', name || imei);
      }

      // Assign to groups if provided
      if (groupIds && Array.isArray(groupIds)) {
        // Filter groupIds to only those that belong to targetOrgId (or all if superadmin)
        const validGroupIds = [];
        for (const gId of groupIds) {
          if (req.user.role === 'superadmin') {
            validGroupIds.push(gId);
          } else {
            const belongs = await GroupModel.belongsToOrg(gId, targetOrgId);
            if (belongs) validGroupIds.push(gId);
          }
        }
        if (validGroupIds.length > 0) {
          await VehicleModel.assignToGroups(newVehicle.id, validGroupIds);
        }
      }

      res.status(201).json({
        success: true,
        data: newVehicle,
        message: 'Vehicle registered successfully.'
      });
      // Audit: vehicle created
      try {
        await AuditService.log({
          auditType: 'vehicle', entityType: 'Vehicle',
          entityId: newVehicle.id, entityName: newVehicle.name, action: 'CREATED',
          newData: { imei, name, plate, model, driverName, driverPhone, serverName, gpsSimNo, deviceVersion, metadata, category },
          performedById: req.user.userId, performedByRole: req.user.role,
          orgId: targetOrgId,
          ipAddress: AuditService.getIp(req), userAgent: AuditService.getUserAgent(req),
        });
      } catch (auditErr) { console.error('[AUDIT]', auditErr.message); }
    } catch (err) {
      next(err);
    }
  },

  /**
   * Update vehicle details
   */
  async updateVehicle(req, res, next) {
    try {
      const { id } = req.params;
      const { name, plate, model, driverName, driverPhone, isActive, orgId, groupIds, serverName, gpsSimNo, deviceVersion, timezone, apn, licenceIssuedDate, licenceExpireDate, metadata, category, isSandMining } = req.body;

      if (!name || name.trim() === '') {
        return res.status(400).json({
          success: false,
          error: 'Vehicle Name is mandatory.',
          code: 'VALIDATION_ERROR'
        });
      }

      // Ownership check (unless superadmin)
      if (req.user.role !== 'superadmin') {
        const belongs = await VehicleModel.belongsToOrg(id, req.user.orgId, req.user.userId, req.user.role);
        if (!belongs) {
          return res.status(403).json({
            success: false,
            error: 'Access denied to vehicle.',
            code: 'FORBIDDEN'
          });
        }
      }

      // Prevent dealers changing org to something they don't own
      let targetOrgId = orgId;
      if (orgId && req.user.role !== 'superadmin' && orgId !== req.user.orgId) {
        const checkOrg = await db.query('SELECT id FROM organizations WHERE id = $1 AND parent_id = $2', [orgId, req.user.orgId]);
        if (checkOrg.rows.length === 0) {
          return res.status(403).json({
            success: false,
            error: 'Cannot reassign vehicle to an organization you do not own.',
            code: 'FORBIDDEN'
          });
        }
      }

      // Fetch old data for audit
      const oldVehicle = await VehicleModel.findById(id);
      if (!oldVehicle) {
        return res.status(404).json({
          success: false,
          error: 'Vehicle not found.',
          code: 'VEHICLE_NOT_FOUND'
        });
      }
      // Check if Registration Number / Plate is changed to an existing plate on another vehicle
      if (plate && plate.trim()) {
        const existingPlate = await db.query(
          `SELECT id FROM vehicles WHERE (UPPER(TRIM(plate)) = UPPER(TRIM($1)) OR UPPER(TRIM(name)) = UPPER(TRIM($1))) AND id != $2`,
          [plate.trim(), id]
        );
        if (existingPlate.rows.length > 0) {
          return res.status(409).json({
            success: false,
            error: `A vehicle with Registration Number "${plate.trim()}" is already registered.`,
            code: 'PLATE_ALREADY_EXISTS'
          });
        }
      }

      const oldGroups = await VehicleModel.getGroups(id);
      const oldGroupIds = oldGroups.map(g => g.id);
      const oldGroupNames = await GroupModel.getNamesByIds(oldGroupIds);

      const oldData = {
        name: oldVehicle.name,
        plate: oldVehicle.plate,
        model: oldVehicle.model,
        driverName: oldVehicle.driver_name,
        driverPhone: oldVehicle.driver_phone,
        isActive: oldVehicle.is_active,
        serverName: oldVehicle.server_name,
        gpsSimNo: oldVehicle.gps_sim_no,
        metadata: oldVehicle.metadata,
        category: oldVehicle.category,
        groupNames: oldGroupNames
      };

      // If odometerReading changed, snapshot the current GPS device odometer so we can
      // compute: displayed_odo = baseline + (current_gps_odo - snapshot_gps_odo)
      // Synchronize engineOn / engineOnStatus and batteryVoltage / vehicleVoltage
      let finalMetadata = metadata ? { ...metadata } : {};
      if (finalMetadata.engineOnStatus) {
        finalMetadata.engineOn = finalMetadata.engineOnStatus;
      } else if (finalMetadata.engineOn) {
        finalMetadata.engineOnStatus = finalMetadata.engineOn;
      }
      if (finalMetadata.vehicleVoltage) {
        finalMetadata.batteryVoltage = finalMetadata.vehicleVoltage;
      } else if (finalMetadata.batteryVoltage) {
        finalMetadata.vehicleVoltage = finalMetadata.batteryVoltage;
      }

      if (metadata && metadata.odometerReading !== undefined) {
        const oldBaseline = String(oldVehicle.metadata?.odometerReading || '0');
        const newBaseline = String(metadata.odometerReading || '0');
        const oldSnapshot = String(oldVehicle.metadata?.odometerSnapshot || '0');
        const hasPositiveBaseline = parseFloat(newBaseline) > 0;

        // Snapshot if baseline changed, or if baseline > 0 but snapshot was 0/missing
        if (oldBaseline !== newBaseline || (hasPositiveBaseline && (oldSnapshot === '0' || !oldSnapshot))) {
          // Fetch current GPS device odometer from vehicle_latest_state
          const vls = await db.query(
            'SELECT odometer FROM vehicle_latest_state WHERE vehicle_id = $1',
            [id]
          );
          const currentGpsOdo = vls.rows[0]?.odometer ?? 0;
          finalMetadata.odometerSnapshot = String(currentGpsOdo);
        } else if (oldSnapshot && oldSnapshot !== '0' && (!finalMetadata.odometerSnapshot || finalMetadata.odometerSnapshot === '0')) {
          // Preserve valid existing snapshot so form submissions don't wipe it
          finalMetadata.odometerSnapshot = oldSnapshot;
        }
      }
      if (finalMetadata && (finalMetadata.safetyPark === 'YES' || finalMetadata.safetyPark === true)) {
        let isIgnitionOn = oldVehicle.current_ignition === true;
        let currentSpeed = parseFloat(oldVehicle.current_speed) || 0;

        if (oldVehicle.imei) {
          try {
            const stateRaw = await redis.get(`vehicle:state:${oldVehicle.imei}`);
            if (stateRaw) {
              const liveState = JSON.parse(stateRaw);
              if (liveState.finalIgnition !== undefined || liveState.ignition !== undefined) {
                isIgnitionOn = liveState.finalIgnition === true || liveState.ignition === true;
              }
              if (liveState.speed !== undefined) {
                currentSpeed = parseFloat(liveState.speed) || 0;
              }
            }
          } catch (_) {}
        }

        if (isIgnitionOn && currentSpeed > 2) {
          return res.status(400).json({
            success: false,
            error: 'Cannot enable Safety Parking while vehicle is running and moving (ignition ON and speed > 2 km/h). Vehicle must be stopped with engine OFF.',
            code: 'SAFETY_PARK_NOT_ALLOWED'
          });
        }
      }

      const updated = await VehicleModel.update(id, {
        name,
        plate,
        model,
        driverName,
        driverPhone,
        isActive,
        orgId: targetOrgId,
        serverName,
        gpsSimNo,
        deviceVersion,
        timezone,
        apn,
        licenceIssuedDate,
        licenceExpireDate,
        metadata: finalMetadata,
        category,
        isSandMining
      });

      // Sync device_type in devices table to match the updated deviceVersion
      // (The vehicle list reads device_type from the devices table via JOIN)
      if (deviceVersion !== undefined && oldVehicle.imei) {
        await db.query(
          `UPDATE devices SET device_type = $1 WHERE device_id = $2`,
          [deviceVersion, oldVehicle.imei]
        );
      }

      // Sync Sand Mining state to Redis
      if (isSandMining !== undefined) {
        if (isSandMining) {
          await redis.sadd('sand:mining_imeis', oldVehicle.imei);
          // Store vehicle metadata for government bridge
          const vehiclePlate = plate || oldVehicle.plate || '';
          const vehicleName = name || oldVehicle.name || oldVehicle.imei;
          await redis.hset(`sand:vehicle:${oldVehicle.imei}`, 'vehicleNo', vehiclePlate, 'vehicleId', vehicleName);
        } else {
          await redis.srem('sand:mining_imeis', oldVehicle.imei);
          await redis.del(`sand:vehicle:${oldVehicle.imei}`);
        }
      }

      // Update group assignments if provided
      if (groupIds && Array.isArray(groupIds)) {
        const activeOrg = targetOrgId || updated.org_id;
        const validGroupIds = [];
        for (const gId of groupIds) {
          if (req.user.role === 'superadmin') {
            validGroupIds.push(gId);
          } else {
            const belongs = await GroupModel.belongsToOrg(gId, activeOrg);
            if (belongs) validGroupIds.push(gId);
          }
        }
        await VehicleModel.assignToGroups(id, validGroupIds);
      }

      res.status(200).json({
        success: true,
        data: updated,
        message: 'Vehicle updated successfully.'
      });

      const finalGroupIds = groupIds !== undefined ? groupIds : oldGroupIds;
      const finalGroupNames = await GroupModel.getNamesByIds(finalGroupIds);

      const newData = {
        name: updated.name !== undefined ? updated.name : name,
        plate: updated.plate !== undefined ? updated.plate : plate,
        model: updated.model !== undefined ? updated.model : model,
        driverName: updated.driver_name !== undefined ? updated.driver_name : driverName,
        driverPhone: updated.driver_phone !== undefined ? updated.driver_phone : driverPhone,
        isActive: updated.is_active !== undefined ? updated.is_active : isActive,
        serverName: updated.server_name !== undefined ? updated.server_name : serverName,
        gpsSimNo: updated.gps_sim_no !== undefined ? updated.gps_sim_no : gpsSimNo,
        metadata: updated.metadata !== undefined ? updated.metadata : metadata,
        groupNames: finalGroupNames
      };

      // Audit: vehicle updated
      try {
        await AuditService.log({
          auditType: 'vehicle', entityType: 'Vehicle',
          entityId: id, entityName: updated.name, action: 'UPDATED',
          oldData,
          newData,
          performedById: req.user.userId, performedByRole: req.user.role,
          orgId: req.user.orgId,
          ipAddress: AuditService.getIp(req), userAgent: AuditService.getUserAgent(req),
        });
      } catch (auditErr) { console.error('[AUDIT]', auditErr.message); }
    } catch (err) {
      next(err);
    }
  },

  /**
   * Bulk assign groups to multiple vehicles
   */
  async bulkAssignGroups(req, res, next) {
    try {
      const { vehicleIds, groupIds, mode = 'replace' } = req.body;
      if (!Array.isArray(vehicleIds) || vehicleIds.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'At least one vehicle ID is required.'
        });
      }

      // Check access for each vehicle if not superadmin
      if (req.user.role !== 'superadmin') {
        for (const vId of vehicleIds) {
          const belongs = await VehicleModel.belongsToOrg(vId, req.user.orgId, req.user.userId, req.user.role);
          if (!belongs) {
            return res.status(403).json({
              success: false,
              error: `Access denied to vehicle ${vId}.`,
              code: 'FORBIDDEN'
            });
          }
        }
      }

      const result = await VehicleModel.bulkAssignGroups(vehicleIds, groupIds || [], mode);

      res.status(200).json({
        success: true,
        message: `Successfully updated groups for ${result.updatedCount} vehicles.`,
        data: result
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * Update vehicle settings (metadata) - Safe for customers
   */
  async updateVehicleSettings(req, res, next) {
    try {
      const { id } = req.params;
      const { overSpeedLimit, overspeedDurationAlert, idleDurationAlert, parkingDurationAlert, parkDurationAlert, movingDurationAlert, stoppageThreshold, alertConfig, safetyPark } = req.body;

      // Ownership check (unless superadmin)
      if (req.user.role !== 'superadmin') {
        const belongs = await VehicleModel.belongsToOrg(id, req.user.orgId, req.user.userId, req.user.role);
        if (!belongs) {
          return res.status(403).json({
            success: false,
            error: 'Access denied to vehicle.',
            code: 'FORBIDDEN'
          });
        }
      }

      // Fetch old vehicle to get existing metadata
      const vehicle = await VehicleModel.findById(id);
      if (!vehicle) {
        return res.status(404).json({
          success: false,
          error: 'Vehicle not found.',
          code: 'VEHICLE_NOT_FOUND'
        });
      }

      // Merge new settings into existing metadata
      const currentMetadata = vehicle.metadata || {};
      const newMetadata = { ...currentMetadata };

      if (overSpeedLimit !== undefined) newMetadata.overSpeedLimit = parseFloat(overSpeedLimit);
      if (overspeedDurationAlert !== undefined) newMetadata.overspeedDurationAlert = parseFloat(overspeedDurationAlert);
      if (idleDurationAlert !== undefined) newMetadata.idleDurationAlert = parseFloat(idleDurationAlert);
      if (parkingDurationAlert !== undefined) newMetadata.parkingDurationAlert = parseFloat(parkingDurationAlert);
      if (parkDurationAlert !== undefined) newMetadata.parkDurationAlert = parseFloat(parkDurationAlert);
      if (movingDurationAlert !== undefined) newMetadata.movingDurationAlert = Math.max(5, parseFloat(movingDurationAlert));
      if (stoppageThreshold !== undefined) newMetadata.stoppageThreshold = parseFloat(stoppageThreshold);
      if (alertConfig !== undefined && typeof alertConfig === 'object') newMetadata.alertConfig = alertConfig;
      if (safetyPark !== undefined) {
        const isSafetyParkOn = safetyPark === 'YES' || safetyPark === true;

        if (isSafetyParkOn) {
          // Disallow enabling Safety Parking if vehicle has ignition ON and speed > 0
          let isIgnitionOn = vehicle.current_ignition === true;
          let currentSpeed = parseFloat(vehicle.current_speed) || 0;

          if (vehicle.imei) {
            try {
              const stateRaw = await redis.get(`vehicle:state:${vehicle.imei}`);
              if (stateRaw) {
                const liveState = JSON.parse(stateRaw);
                if (liveState.finalIgnition !== undefined || liveState.ignition !== undefined) {
                  isIgnitionOn = liveState.finalIgnition === true || liveState.ignition === true;
                }
                if (liveState.speed !== undefined) {
                  currentSpeed = parseFloat(liveState.speed) || 0;
                }
              }
            } catch (_) {}
          }

          if (isIgnitionOn && currentSpeed > 2) {
            return res.status(400).json({
              success: false,
              error: 'Cannot enable Safety Parking while vehicle is running and moving (ignition ON and speed > 2 km/h). Vehicle must be stopped with engine OFF.',
              code: 'SAFETY_PARK_NOT_ALLOWED'
            });
          }
        }

        newMetadata.safetyPark = isSafetyParkOn ? 'YES' : 'NO';
        if (!isSafetyParkOn) {
          await redis.del(`vehicle:safety_park_fired:${id}`);
          await redis.del(`vehicle:safety_park_breach:${id}`);
        }
      }

      // Perform update
      const updated = await VehicleModel.update(id, { metadata: newMetadata });

      // Invalidate vehicle caches
      try {
        await redis.del('vehicles:all');
        await redis.del(`vehicle:obj:${id}`);
        if (vehicle.imei) await redis.del(`vehicle:imei:${vehicle.imei}`);
      } catch (cErr) {}

      // Emit real-time Socket.io update for safety park state
      const io = req.app.get('io');
      if (io && safetyPark !== undefined) {
        io.to(`vehicle:${id}`).emit('vehicle:safety_park', {
          vehicleId: id,
          safetyPark: newMetadata.safetyPark
        });
        io.to(`org:${vehicle.org_id}`).emit('vehicle:safety_park', {
          vehicleId: id,
          safetyPark: newMetadata.safetyPark
        });
      }

      res.status(200).json({
        success: true,
        data: updated,
        message: 'Vehicle settings updated successfully.'
      });

      // Audit: vehicle settings updated
      try {
        await AuditService.log({
          auditType: 'vehicle_settings', entityType: 'Vehicle',
          entityId: id, entityName: updated.name, action: 'UPDATED_SETTINGS',
          oldData: { metadata: currentMetadata },
          newData: { metadata: newMetadata },
          performedById: req.user.userId, performedByRole: req.user.role,
          orgId: req.user.orgId,
          ipAddress: AuditService.getIp(req), userAgent: AuditService.getUserAgent(req),
        });
      } catch (auditErr) { console.error('[AUDIT]', auditErr.message); }

    } catch (err) {
      next(err);
    }
  },

  /**
   * Delete vehicle (Soft delete)
   */
  async deleteVehicle(req, res, next) {
    try {
      const { id } = req.params;

      // Ownership check (unless superadmin)
      if (req.user.role !== 'superadmin') {
        const belongs = await VehicleModel.belongsToOrg(id, req.user.orgId, req.user.userId, req.user.role);
        if (!belongs) {
          return res.status(403).json({
            success: false,
            error: 'Access denied to vehicle.',
            code: 'FORBIDDEN'
          });
        }
      }

      const deleted = await VehicleModel.delete(id);
      if (!deleted) {
        return res.status(404).json({
          success: false,
          error: 'Vehicle not found.',
          code: 'VEHICLE_NOT_FOUND'
        });
      }

      res.status(200).json({
        success: true,
        message: 'Vehicle deleted successfully.'
      });
      // Audit: vehicle deleted
      try {
        await AuditService.log({
          auditType: 'vehicle', entityType: 'Vehicle',
          entityId: id, action: 'DELETED',
          performedById: req.user.userId, performedByRole: req.user.role,
          orgId: req.user.orgId,
          ipAddress: AuditService.getIp(req), userAgent: AuditService.getUserAgent(req),
        });
      } catch (auditErr) { console.error('[AUDIT]', auditErr.message); }
    } catch (err) {
      next(err);
    }
  },

  /**
   * Migrate Vehicle Device IMEI
   */
  async migrateVehicle(req, res, next) {
    try {
      const { id } = req.params;
      const { newImei } = req.body;

      if (!newImei || !/^\d{15}$/.test(newImei)) {
        return res.status(400).json({
          success: false,
          error: 'A valid 15-digit new IMEI number is required.',
          code: 'VALIDATION_ERROR'
        });
      }

      // Ownership check
      if (req.user.role !== 'superadmin') {
        const belongs = await VehicleModel.belongsToOrg(id, req.user.orgId, req.user.userId, req.user.role);
        if (!belongs) {
          return res.status(403).json({
            success: false,
            error: 'Access denied to vehicle.',
            code: 'FORBIDDEN'
          });
        }
      }

      // Check if new IMEI is already in use
      const existing = await VehicleModel.findByImei(newImei);
      if (existing && existing.id !== id) {
        return res.status(409).json({
          success: false,
          error: 'A vehicle with this new IMEI is already registered.',
          code: 'IMEI_ALREADY_EXISTS'
        });
      }

      const migrated = await VehicleModel.migrate(id, newImei);
      res.status(200).json({
        success: true,
        data: migrated,
        message: 'Vehicle device migrated successfully.'
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * Add / Assign user to vehicle (via group and organization)
   */
  async addUserToVehicle(req, res, next) {
    try {
      const { id } = req.params;
      const { isNewUser, userId, username, name, email, phone, password, role = 'customer', groupId, orgId } = req.body;

      // Ownership check
      if (req.user.role !== 'superadmin') {
        const belongs = await VehicleModel.belongsToOrg(id, req.user.orgId, req.user.userId, req.user.role);
        if (!belongs) {
          return res.status(403).json({
            success: false,
            error: 'Access denied to vehicle.',
            code: 'FORBIDDEN'
          });
        }
      }

      const vehicle = await VehicleModel.findById(id);
      if (!vehicle) {
        return res.status(404).json({ success: false, error: 'Vehicle not found.' });
      }

      const targetOrgId = orgId || vehicle.org_id || req.user.orgId;
      let finalUserId = userId;

      // Handle New User creation if selected
      if (isNewUser) {
        if (!username && !email && !name) {
          return res.status(400).json({ success: false, error: 'User Name / Username is required for new user.' });
        }
        if (!password) {
          return res.status(400).json({ success: false, error: 'Password is required for new user.' });
        }

        const cleanEmail = email ? email.toLowerCase().trim() : `${(username || name).toLowerCase().replace(/[^a-z0-9]/g, '')}@fueltracks.com`;
        const cleanUsername = username ? username.toLowerCase().trim() : (cleanEmail.split('@')[0] || 'user');

        // Check if user already exists
        const existingUser = await UserModel.findByIdentifier(cleanEmail) || await UserModel.findByIdentifier(cleanUsername);
        if (existingUser) {
          return res.status(409).json({ success: false, error: 'A user with this email or username already exists.' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newUser = await UserModel.create({
          orgId: targetOrgId,
          email: cleanEmail,
          username: cleanUsername,
          password: hashedPassword,
          role: role || 'customer',
          name: name || username,
          phone: phone || null
        });
        finalUserId = newUser.id;
      }

      if (!finalUserId) {
        return res.status(400).json({ success: false, error: 'Please select or create a user.' });
      }

      // If a group is selected, link vehicle and user to that group
      let finalGroupId = groupId;
      if (!finalGroupId) {
        // Look up if vehicle already has a group
        const existingGroupRes = await db.query(
          `SELECT vg.group_id FROM vehicle_groups vg
           JOIN groups g ON vg.group_id = g.id
           WHERE vg.vehicle_id = $1 LIMIT 1`,
          [id]
        );
        if (existingGroupRes.rows.length > 0) {
          finalGroupId = existingGroupRes.rows[0].group_id;
        } else {
          // Auto-create default group for vehicle
          const targetGroupName = `${vehicle.plate || vehicle.name || 'Vehicle'} Group`;
          const createdG = await GroupModel.create({
            orgId: targetOrgId,
            name: targetGroupName,
            description: `Group for vehicle ${vehicle.plate || vehicle.name}`
          });
          finalGroupId = createdG.id;
        }
      }

      // Assign vehicle to group
      if (finalGroupId) {
        await db.query(
          `INSERT INTO vehicle_groups (vehicle_id, group_id)
           VALUES ($1, $2)
           ON CONFLICT (vehicle_id, group_id) DO NOTHING`,
          [id, finalGroupId]
        );
        // Assign user to group
        await db.query(
          `INSERT INTO user_groups (user_id, group_id)
           VALUES ($1, $2)
           ON CONFLICT (user_id, group_id) DO NOTHING`,
          [finalUserId, finalGroupId]
        );
      }

      // If org changed, update vehicle's organization
      if (targetOrgId && targetOrgId !== vehicle.org_id) {
        await VehicleModel.update(id, { org_id: targetOrgId });
      }

      res.status(200).json({
        success: true,
        message: 'User assigned to vehicle successfully.',
        data: { userId: finalUserId, groupId: finalGroupId, orgId: targetOrgId }
      });
    } catch (err) {
      next(err);
    }
  },


  /**
   * Rename vehicle (Vehicle Id / Name)
   */
  async renameVehicle(req, res, next) {
    try {
      const { id } = req.params;
      const { name, vehicleId } = req.body;
      const newName = (name || vehicleId || '').trim();

      if (!newName) {
        return res.status(400).json({
          success: false,
          error: 'Vehicle Id / Name is required.',
          code: 'VALIDATION_ERROR'
        });
      }

      // Ownership check
      if (req.user.role !== 'superadmin') {
        const belongs = await VehicleModel.belongsToOrg(id, req.user.orgId, req.user.userId, req.user.role);
        if (!belongs) {
          return res.status(403).json({ success: false, error: 'Access denied to vehicle.' });
        }
      }

      const vehicle = await VehicleModel.findById(id);
      if (!vehicle) {
        return res.status(404).json({ success: false, error: 'Vehicle not found.' });
      }

      // Check if another vehicle in the same org already has this name
      const existingName = await db.query(
        `SELECT id FROM vehicles WHERE UPPER(TRIM(name)) = UPPER(TRIM($1)) AND id != $2 AND org_id = $3`,
        [newName, id, vehicle.org_id]
      );
      if (existingName.rows.length > 0) {
        return res.status(409).json({
          success: false,
          error: `Another vehicle in this organization is already named "${newName}".`,
          code: 'NAME_ALREADY_EXISTS'
        });
      }

      const updated = await VehicleModel.update(id, { name: newName });

      // Audit log
      await AuditService.log({
        auditType: 'vehicle',
        entityType: 'Vehicle',
        entityId: vehicle.id,
        entityName: newName,
        action: 'VEHICLE_RENAME',
        performedById: req.user.userId,
        orgId: vehicle.org_id,
        vehicleId: vehicle.id,
        vehicleName: newName,
        deviceId: vehicle.imei,
        oldData: { name: vehicle.name },
        newData: { name: newName },
        ipAddress: AuditService.getIp(req),
        userAgent: AuditService.getUserAgent(req)
      });

      res.status(200).json({
        success: true,
        message: 'Vehicle renamed successfully.',
        data: updated
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * Reprocess vehicle data for selected date
   */
  async reprocessVehicle(req, res, next) {
    try {
      const { id } = req.params;
      const { date } = req.body;

      if (!date) {
        return res.status(400).json({
          success: false,
          error: 'Date is required for reprocessing.',
          code: 'VALIDATION_ERROR'
        });
      }

      // Ownership check
      if (req.user.role !== 'superadmin') {
        const belongs = await VehicleModel.belongsToOrg(id, req.user.orgId, req.user.userId, req.user.role);
        if (!belongs) {
          return res.status(403).json({ success: false, error: 'Access denied to vehicle.' });
        }
      }

      const vehicle = await VehicleModel.findById(id);
      if (!vehicle) {
        return res.status(404).json({ success: false, error: 'Vehicle not found.' });
      }

      // Format date: convert DD-MM-YYYY to YYYY-MM-DD if needed
      let targetDate = date;
      if (/^\d{2}-\d{2}-\d{4}$/.test(date)) {
        const [d, m, y] = date.split('-');
        targetDate = `${y}-${m}-${d}`;
      }

      const startOfDay = `${targetDate} 00:00:00`;
      const endOfDay = `${targetDate} 23:59:59`;

      const pointsCountRes = await db.query(
        `SELECT COUNT(*) FROM gps_points WHERE vehicle_id = $1 AND device_time >= $2 AND device_time <= $3`,
        [id, startOfDay, endOfDay]
      );
      const pointsCount = parseInt(pointsCountRes.rows[0]?.count || 0);

      // Audit log
      await AuditService.log({
        auditType: 'vehicle',
        entityType: 'Vehicle',
        entityId: vehicle.id,
        entityName: vehicle.name || vehicle.plate,
        action: 'VEHICLE_REPROCESS',
        performedById: req.user.userId,
        orgId: vehicle.org_id,
        vehicleId: vehicle.id,
        vehicleName: vehicle.name || vehicle.plate,
        deviceId: vehicle.imei,
        details: { date: targetDate, pointsCount },
        ipAddress: AuditService.getIp(req),
        userAgent: AuditService.getUserAgent(req)
      });

      res.status(200).json({
        success: true,
        message: `Reprocessing successfully initiated for ${vehicle.name || vehicle.plate} on ${date}.`,
        data: {
          vehicleId: id,
          vehicleName: vehicle.name || vehicle.plate,
          date: targetDate,
          pointsCount
        }
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * Save vehicle fuel calibration & fuel configuration details
   */
  async calibrateVehicle(req, res, next) {
    try {
      const { id } = req.params;
      const {
        name,
        tankNo = 1,
        modeOfVehicle,
        fuelType,
        tankSize,
        minAdc,
        maxAdc,
        fuelTankShape,
        fuelTankPosition,
        calculate,
        tankLength,
        tankHeight,
        tankWidth,
        tankRadius,
        noOfTank,
        noOfSensor,
        sensorType,
        sensorFormula,
        sensors,
        tanks,
        minTheft,
        minFilling,
        calibrateType,
        sensorDetails,
        calibrationPoints,
        directSensorType,
        directUnit,
        directMultiplier,
        directOffset
      } = req.body;

      // Ownership check
      if (req.user.role !== 'superadmin') {
        const belongs = await VehicleModel.belongsToOrg(id, req.user.orgId, req.user.userId, req.user.role);
        if (!belongs) {
          return res.status(403).json({ success: false, error: 'Access denied to vehicle.' });
        }
      }

      const vehicle = await VehicleModel.findById(id);
      if (!vehicle) {
        return res.status(404).json({ success: false, error: 'Vehicle not found.' });
      }

      const currentMeta = vehicle.metadata || {};
      const fuelCal = currentMeta.fuelCalibration || {};
      const fuelConfig = currentMeta.fuelConfig || {};

      const currentTanks = fuelCal.tanks || {};
      const thisTankNo = Number(tankNo) || 1;
      const thisTankData = {
        tankNo: thisTankNo,
        modeOfVehicle: modeOfVehicle !== undefined ? modeOfVehicle : fuelCal.modeOfVehicle,
        fuelType: fuelType !== undefined ? fuelType : fuelCal.fuelType,
        tankSize: tankSize !== undefined ? tankSize : fuelCal.tankSize,
        minAdc: minAdc !== undefined ? minAdc : fuelCal.minAdc,
        maxAdc: maxAdc !== undefined ? maxAdc : fuelCal.maxAdc,
        fuelTankShape: fuelTankShape !== undefined ? fuelTankShape : fuelCal.fuelTankShape,
        fuelTankPosition: fuelTankPosition !== undefined ? fuelTankPosition : fuelCal.fuelTankPosition,
        calculate: calculate !== undefined ? calculate : fuelCal.calculate,
        tankLength: tankLength !== undefined ? tankLength : fuelCal.tankLength,
        tankHeight: tankHeight !== undefined ? tankHeight : fuelCal.tankHeight,
        tankWidth: tankWidth !== undefined ? tankWidth : fuelCal.tankWidth,
        tankRadius: tankRadius !== undefined ? tankRadius : fuelCal.tankRadius,
        calibrateType: calibrateType !== undefined ? calibrateType : (fuelCal.calibrateType || 'Auto'),
        calibrationPoints: Array.isArray(calibrationPoints) ? calibrationPoints : (fuelCal.calibrationPoints || []),
        directSensorType: directSensorType !== undefined ? directSensorType : (fuelCal.directSensorType || fuelType || 'Analog'),
        directUnit: directUnit !== undefined ? directUnit : (fuelCal.directUnit || 'Litres'),
        directMultiplier: directMultiplier !== undefined ? directMultiplier : (fuelCal.directMultiplier ?? 1.0),
        directOffset: directOffset !== undefined ? directOffset : (fuelCal.directOffset ?? 0.0),
        noOfSensor: noOfSensor !== undefined ? Number(noOfSensor) : (fuelCal.noOfSensor ?? 1),
        sensorFormula: sensorFormula !== undefined ? sensorFormula : (fuelCal.sensorFormula || 'Average'),
        sensors: sensors !== undefined ? sensors : (fuelCal.tanks?.[thisTankNo]?.sensors || fuelCal.sensors || {}),
        updatedAt: new Date().toISOString()
      };

      const updatedTanks = tanks && typeof tanks === 'object' && Object.keys(tanks).length > 0 ? {
        ...currentTanks,
        ...tanks,
        [thisTankNo]: {
          ...(tanks[thisTankNo] || {}),
          ...thisTankData
        }
      } : {
        ...currentTanks,
        [thisTankNo]: thisTankData
      };

      const updatedMeta = {
        ...currentMeta,
        modeOfVehicle: modeOfVehicle !== undefined ? modeOfVehicle : currentMeta.modeOfVehicle,
        fuelType: fuelType !== undefined ? fuelType : currentMeta.fuelType,
        tankSize: tankSize !== undefined ? tankSize : currentMeta.tankSize,
        fuelEmptyAdc: minAdc !== undefined ? minAdc : currentMeta.fuelEmptyAdc,
        fuelFullAdc: maxAdc !== undefined ? maxAdc : currentMeta.fuelFullAdc,
        fuelTankShape: fuelTankShape !== undefined ? fuelTankShape : currentMeta.fuelTankShape,
        fuelTankPosition: fuelTankPosition !== undefined ? fuelTankPosition : currentMeta.fuelTankPosition,
        sensorCount: noOfSensor !== undefined ? String(noOfSensor) : currentMeta.sensorCount,
        fuelCalibration: {
          ...fuelCal,
          tankNo: thisTankNo,
          modeOfVehicle: thisTankData.modeOfVehicle,
          fuelType: thisTankData.fuelType,
          tankSize: thisTankData.tankSize,
          minAdc: thisTankData.minAdc,
          maxAdc: thisTankData.maxAdc,
          fuelTankShape: thisTankData.fuelTankShape,
          fuelTankPosition: thisTankData.fuelTankPosition,
          calculate: thisTankData.calculate,
          tankLength: thisTankData.tankLength,
          tankHeight: thisTankData.tankHeight,
          tankWidth: thisTankData.tankWidth,
          tankRadius: thisTankData.tankRadius,
          calibrateType: thisTankData.calibrateType,
          calibrationPoints: thisTankData.calibrationPoints,
          directSensorType: thisTankData.directSensorType,
          directUnit: thisTankData.directUnit,
          directMultiplier: thisTankData.directMultiplier,
          directOffset: thisTankData.directOffset,
          noOfSensor: thisTankData.noOfSensor,
          sensorFormula: thisTankData.sensorFormula,
          sensors: thisTankData.sensors,
          tanks: updatedTanks,
          updatedAt: new Date().toISOString()
        },
        fuelConfig: {
          ...fuelConfig,
          noOfTank: noOfTank !== undefined ? noOfTank : (fuelConfig.noOfTank ?? 1),
          noOfSensor: noOfSensor !== undefined ? noOfSensor : (fuelConfig.noOfSensor ?? 1),
          sensorType: sensorType !== undefined ? sensorType : (fuelConfig.sensorType || ''),
          sensorFormula: sensorFormula !== undefined ? sensorFormula : (fuelConfig.sensorFormula || 'Average'),
          minTheft: minTheft !== undefined ? minTheft : (fuelConfig.minTheft ?? 5),
          minFilling: minFilling !== undefined ? minFilling : (fuelConfig.minFilling ?? 9),
          tankSize: tankSize !== undefined ? tankSize : (fuelConfig.tankSize ?? 0),
          calibrateType: calibrateType !== undefined ? calibrateType : (fuelConfig.calibrateType || 'Auto'),
          sensorDetails: sensorDetails !== undefined ? sensorDetails : (fuelConfig.sensorDetails || ''),
          updatedAt: new Date().toISOString()
        }
      };

      const updatePayload = { metadata: updatedMeta };
      if (name && name.trim() && name.trim() !== vehicle.name) {
        updatePayload.name = name.trim();
      }

      const updated = await VehicleModel.update(id, updatePayload);

      // Audit log
      await AuditService.log({
        auditType: 'vehicle',
        entityType: 'Vehicle',
        entityId: vehicle.id,
        entityName: updated?.name || vehicle.name,
        action: 'VEHICLE_CALIBRATE',
        performedById: req.user.userId,
        orgId: vehicle.org_id,
        vehicleId: vehicle.id,
        vehicleName: updated?.name || vehicle.name,
        deviceId: vehicle.imei,
        details: { metadata: updatedMeta },
        ipAddress: AuditService.getIp(req),
        userAgent: AuditService.getUserAgent(req)
      });

      res.status(200).json({
        success: true,
        message: 'Fuel calibration settings saved successfully.',
        data: updated
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * Get paginated GPS history
   */
  async getVehicleHistory(req, res, next) {
    try {
      const { id } = req.params;
      const { startDate, endDate, page, limit, noCount, sample, maxPoints } = req.query;

      // Ownership check
      if (req.user.role !== 'superadmin') {
        const belongs = await VehicleModel.belongsToOrg(id, req.user.orgId, req.user.userId, req.user.role);
        if (!belongs) {
          return res.status(403).json({
            success: false,
            error: 'Access denied to vehicle.',
            code: 'FORBIDDEN'
          });
        }
      }

      const result = await GpsModel.getHistory(id, {
        startDate,
        endDate,
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 100,
        noCount: noCount === 'true' || noCount === true,
        sample: sample === 'true' || sample === true,
        maxPoints: parseInt(maxPoints) || 500
      });

      // Apply Odometer Baseline Offset (baseline + distance driven since snapshot)
      const vehicle = await VehicleModel.findById(id);
      const baseline = parseFloat(vehicle?.metadata?.odometerReading) || 0;
      const snapshot  = parseFloat(vehicle?.metadata?.odometerSnapshot)  || 0;
      if (baseline > 0 && result.points) {
        result.points.forEach(p => p.odometer = baseline + Math.max(0, (p.odometer || 0) - snapshot));
      }

      res.status(200).json({
        success: true,
        data: result.points,
        pagination: result.pagination
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * Get route coordinates list for polyline mapping
   */
  async getVehicleRoute(req, res, next) {
    try {
      const { id } = req.params;
      const { startDate, endDate } = req.query;

      // Ownership check
      if (req.user.role !== 'superadmin') {
        const belongs = await VehicleModel.belongsToOrg(id, req.user.orgId, req.user.userId, req.user.role);
        if (!belongs) {
          return res.status(403).json({
            success: false,
            error: 'Access denied to vehicle.',
            code: 'FORBIDDEN'
          });
        }
      }

      // Quick memory cache to prevent frontend DDoS loops from crashing the server
      if (!global.routeCache) global.routeCache = new Map();
      const cacheKey = `${id}_${startDate}_${endDate}`;
      const cached = global.routeCache.get(cacheKey);
      if (cached && (Date.now() - cached.timestamp < 10000)) { // 10 seconds cache
        return res.status(200).json(cached.data);
      }

      let points = [];
      const reqStart = new Date(startDate);
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 180);

      // If the requested route starts more than 180 days ago, it's in cold storage
      if (reqStart < cutoff) {
        const orgId = req.user.orgId;
        const reqUserEmail = req.user.email; // assuming email is in jwt payload
        
        const archiveResult = await archiveService.getArchivedRoute(id, orgId, startDate, endDate, reqUserEmail);
        
        if (archiveResult.status === 'restoring') {
          return res.status(202).json({
            success: true,
            status: 'restoring',
            message: archiveResult.message
          });
        }
        points = archiveResult.data;
      } else {
        points = await GpsModel.getRoute(id, { startDate, endDate });
      }
      // Apply Odometer Baseline Offset (baseline + distance driven since snapshot)
      const vehicle = await VehicleModel.findById(id);
      const baseline = parseFloat(vehicle?.metadata?.odometerReading) || 0;
      const snapshot  = parseFloat(vehicle?.metadata?.odometerSnapshot)  || 0;
      if (baseline > 0 && points) {
        points.forEach(p => p.odometer = baseline + Math.max(0, (p.odometer || 0) - snapshot));
      }

      const MAX_ROUTE_POINTS = parseInt(process.env.MAX_ROUTE_POINTS) || 10000;
      const isTruncated = points && points.length >= MAX_ROUTE_POINTS;

      const responseData = {
        success: true,
        data: points,
        warning: isTruncated ? 'Results truncated due to safety limit. Please select a smaller date range.' : undefined
      };

      if (!global.routeCache) global.routeCache = new Map();
      global.routeCache.set(cacheKey, { timestamp: Date.now(), data: responseData });

      res.status(200).json(responseData);
    } catch (err) {
      next(err);
    }
  },

  /**
   * Get vehicle reports (daily summary + aggregates)
   */
  async getVehicleReport(req, res, next) {
    try {
      const { id } = req.params;
      const { startDate, endDate } = req.query;

      // Ownership check
      if (req.user.role !== 'superadmin') {
        const belongs = await VehicleModel.belongsToOrg(id, req.user.orgId, req.user.userId, req.user.role);
        if (!belongs) {
          return res.status(403).json({
            success: false,
            error: 'Access denied to vehicle.',
            code: 'FORBIDDEN'
          });
        }
      }

      const report = await GpsModel.getReport(id, { startDate, endDate });

      res.status(200).json({
        success: true,
        data: report
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * Get ignition report (ON/OFF intervals)
   */
  async getIgnitionReport(req, res, next) {
    try {
      const { id } = req.params;
      const { startDate, endDate } = req.query;

      // Ownership check
      if (req.user.role !== 'superadmin') {
        const belongs = await VehicleModel.belongsToOrg(id, req.user.orgId, req.user.userId, req.user.role);
        if (!belongs) {
          return res.status(403).json({
            success: false,
            error: 'Access denied to vehicle.',
            code: 'FORBIDDEN'
          });
        }
      }

      const report = await GpsModel.getIgnitionReport(id, { startDate, endDate });

      res.status(200).json({
        success: true,
        data: report
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * Get alerts history
   */
  async getVehicleAlerts(req, res, next) {
    try {
      const { id } = req.params;
      const { page, limit, alertType } = req.query;

      // Ownership check
      if (req.user.role !== 'superadmin') {
        const belongs = await VehicleModel.belongsToOrg(id, req.user.orgId, req.user.userId, req.user.role);
        if (!belongs) {
          return res.status(403).json({
            success: false,
            error: 'Access denied to vehicle.',
            code: 'FORBIDDEN'
          });
        }
      }

      const result = await GpsModel.getAlerts(id, {
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 50,
        alertType
      });

      res.status(200).json({
        success: true,
        data: result.alerts,
        pagination: result.pagination
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * Clear all alerts for a vehicle
   */
  async clearVehicleAlerts(req, res, next) {
    try {
      const { id } = req.params;

      // Ownership check
      if (req.user.role !== 'superadmin') {
        const belongs = await VehicleModel.belongsToOrg(id, req.user.orgId, req.user.userId, req.user.role);
        if (!belongs) {
          return res.status(403).json({
            success: false,
            error: 'Access denied to vehicle.',
            code: 'FORBIDDEN'
          });
        }
      }

      const targetOrgId = req.user.role === 'superadmin' ? null : req.user.orgId;
      const count = await GpsModel.clearAlertsForVehicle(id, targetOrgId);
      res.status(200).json({
        success: true,
        message: `${count} alerts cleared successfully.`,
        count
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * Get raw device messages (Sensor Data)
   * GET /api/vehicles/:id/messages
   */
  async getVehicleMessages(req, res, next) {
    try {
      const { id } = req.params;
      const { page, limit, date } = req.query;

      // Look up vehicle by either IMEI or numeric ID
      let imei = null;
      let vehicle = null;

      if (/^\d{15}$/.test(id)) {
        imei = id;
        vehicle = await VehicleModel.findByImei(id);
        if (req.user.role !== 'superadmin') {
          if (!vehicle) {
            return res.status(404).json({
              success: false,
              error: 'Vehicle with this IMEI not found.',
              code: 'NOT_FOUND'
            });
          }
          const belongs = await VehicleModel.belongsToOrg(vehicle.id, req.user.orgId, req.user.userId, req.user.role);
          if (!belongs) {
            return res.status(403).json({
              success: false,
              error: 'Access denied to vehicle.',
              code: 'FORBIDDEN'
            });
          }
        }
      } else {
        vehicle = await VehicleModel.findById(id);
        if (!vehicle || !vehicle.imei) {
          return res.status(404).json({
            success: false,
            error: 'Vehicle or IMEI not found.',
            code: 'NOT_FOUND'
          });
        }
        if (req.user.role !== 'superadmin') {
          const belongs = await VehicleModel.belongsToOrg(vehicle.id, req.user.orgId, req.user.userId, req.user.role);
          if (!belongs) {
            return res.status(403).json({
              success: false,
              error: 'Access denied to vehicle.',
              code: 'FORBIDDEN'
            });
          }
        }
        imei = vehicle.imei;
      }

      const result = await GpsModel.getRawMessages(imei || vehicle?.imei, {
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 100,
        date: date || null
      });

      res.status(200).json({
        success: true,
        data: result.messages,
        pagination: result.pagination
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * Control vehicle immobilizer (cut / restore engine power)
   * POST /api/vehicles/:id/immobilizer
   * Body: { action: 'IMMOBILIZE' | 'MOBILIZE' }
   */
  async toggleImmobilizer(req, res, next) {
    try {
      const { id } = req.params;
      const { action } = req.body;

      if (!action || !['IMMOBILIZE', 'MOBILIZE'].includes(action.toUpperCase())) {
        return res.status(400).json({
          success: false,
          error: "Invalid action. Must be 'IMMOBILIZE' or 'MOBILIZE'.",
          code: 'INVALID_ACTION'
        });
      }

      const isImmobilize = action.toUpperCase() === 'IMMOBILIZE';

      // Ownership check (unless superadmin)
      if (req.user.role !== 'superadmin') {
        const belongs = await VehicleModel.belongsToOrg(id, req.user.orgId, req.user.userId, req.user.role);
        if (!belongs) {
          return res.status(403).json({
            success: false,
            error: 'Access denied to vehicle.',
            code: 'FORBIDDEN'
          });
        }
      }

      const vehicle = await VehicleModel.findById(id);
      if (!vehicle) {
        return res.status(404).json({
          success: false,
          error: 'Vehicle not found.',
          code: 'VEHICLE_NOT_FOUND'
        });
      }

      if (!vehicle.imei) {
        return res.status(400).json({
          success: false,
          error: 'Vehicle has no assigned IMEI device.',
          code: 'NO_IMEI'
        });
      }

      const protocol = vehicle.server_name || 'AUTO';

      // 1. Publish command to Redis for TCP server downlink dispatcher
      const commandPayload = {
        imei: vehicle.imei,
        action: isImmobilize ? 'IMMOBILIZE' : 'MOBILIZE',
        protocol: protocol,
        requestedBy: req.user.userId,
        timestamp: new Date().toISOString()
      };

      await redis.publish('device_commands', JSON.stringify(commandPayload));

      // 2. Update state in database
      const updatedState = await VehicleModel.setImmobilizerState(vehicle.id, isImmobilize);

      // 3. Write to Audit Log
      await AuditService.log({
        auditType: 'vehicle',
        entityType: 'Vehicle',
        entityId: vehicle.id,
        entityName: vehicle.name || vehicle.plate,
        action: isImmobilize ? 'IMMOBILIZE' : 'MOBILIZE',
        performedById: req.user.userId,
        orgId: vehicle.org_id,
        vehicleId: vehicle.id,
        vehicleName: vehicle.name || vehicle.plate,
        deviceId: vehicle.imei,
        newData: { is_immobilized: isImmobilize, action: isImmobilize ? 'IMMOBILIZE' : 'MOBILIZE' },
        ipAddress: AuditService.getIp(req),
        userAgent: AuditService.getUserAgent(req)
      });

      // 4. Emit real-time Socket.io update if available
      const io = req.app.get('io');
      if (io) {
        io.to(`vehicle:${vehicle.id}`).emit('vehicle:state', {
          vehicleId: vehicle.id,
          is_immobilized: isImmobilize,
          immobilizer_updated_at: updatedState ? updatedState.immobilizer_updated_at : new Date()
        });
        io.to(`org:${vehicle.org_id}`).emit('fleet:update', {
          vehicleId: vehicle.id,
          is_immobilized: isImmobilize
        });
      }

      // 5. Return response
      // 202 Accepted: command was published to TCP server via Redis.
      // Delivery is async — we cannot guarantee the device had an active socket
      // at the exact moment of dispatch (it may have just reconnected).
      // The TCP server queues the command for up to 2 minutes if device is offline.
      res.status(202).json({
        success: true,
        message: isImmobilize
          ? 'Immobilize (Engine Cut) command dispatched. Will auto-retry for up to 2 minutes if device is momentarily offline.'
          : 'Mobilize (Engine Restore) command dispatched. Will auto-retry for up to 2 minutes if device is momentarily offline.',
        data: {
          vehicleId: vehicle.id,
          imei: vehicle.imei,
          is_immobilized: isImmobilize,
          action: isImmobilize ? 'IMMOBILIZE' : 'MOBILIZE',
          immobilizer_updated_at: updatedState ? updatedState.immobilizer_updated_at : new Date(),
          dispatched_at: new Date().toISOString()
        }
      });
    } catch (err) {
      next(err);
    }
  }
};

module.exports = VehicleController;
