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
      const parsedLimit = parseInt(limit) || 100;

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
        metadata,
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
        return res.status(403).json({
          success: false,
          error: 'Cannot reassign vehicle to another dealer organization.',
          code: 'FORBIDDEN'
        });
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
      let finalMetadata = metadata ? { ...metadata } : {};
      if (metadata && metadata.odometerReading !== undefined) {
        const oldBaseline = String(oldVehicle.metadata?.odometerReading || '0');
        const newBaseline = String(metadata.odometerReading || '0');
        if (oldBaseline !== newBaseline) {
          // Fetch current GPS device odometer from vehicle_latest_state
          const vls = await db.query(
            'SELECT odometer FROM vehicle_latest_state WHERE vehicle_id = $1',
            [id]
          );
          const currentGpsOdo = vls.rows[0]?.odometer ?? 0;
          finalMetadata.odometerSnapshot = String(currentGpsOdo);
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
      const { overSpeedLimit, overspeedDurationAlert, idleDurationAlert } = req.body;

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

      // Perform update
      const updated = await VehicleModel.update(id, { metadata: newMetadata });

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
   * Get paginated GPS history
   */
  async getVehicleHistory(req, res, next) {
    try {
      const { id } = req.params;
      const { startDate, endDate, page, limit } = req.query;

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
        limit: parseInt(limit) || 100
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

      res.status(200).json({
        success: true,
        data: points,
        warning: isTruncated ? 'Results truncated due to safety limit. Please select a smaller date range.' : undefined
      });
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
      const { page, limit } = req.query;

      // Access Check
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

      // We need the IMEI of the vehicle
      const vehicle = await VehicleModel.findById(id);
      if (!vehicle || !vehicle.imei) {
        return res.status(404).json({
          success: false,
          error: 'Vehicle or IMEI not found.',
          code: 'NOT_FOUND'
        });
      }

      const result = await GpsModel.getRawMessages(vehicle.imei, {
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 100
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
