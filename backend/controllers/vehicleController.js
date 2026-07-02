// ============================================================
// VEHICLE CONTROLLER
// Handles CRUD operations, history tracking, route lines, alerts, and reports
// ============================================================

const VehicleModel = require('../models/vehicleModel');
const GpsModel = require('../models/gpsModel');
const GroupModel = require('../models/groupModel');
const AuditService = require('../services/auditService');
const db = require('../config/db');

const VehicleController = {
  /**
   * Get all vehicles with latest status
   */
  async getAllVehicles(req, res, next) {
    try {
      const { page, limit, search, groupId } = req.query;
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
        const belongs = await VehicleModel.belongsToOrg(id, req.user.orgId);
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
      const { imei, name, plate, model, driverName, driverPhone, orgId, groupIds, serverName, gpsSimNo, deviceVersion, timezone, apn, licenceIssuedDate, licenceExpireDate, metadata } = req.body;

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
        metadata
      });

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
          newData: { imei, name, plate, model, driverName, driverPhone, serverName, gpsSimNo, deviceVersion, metadata },
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
      const { name, plate, model, driverName, driverPhone, isActive, orgId, groupIds, serverName, gpsSimNo, deviceVersion, timezone, apn, licenceIssuedDate, licenceExpireDate, metadata } = req.body;

      if (!name || name.trim() === '') {
        return res.status(400).json({
          success: false,
          error: 'Vehicle Name is mandatory.',
          code: 'VALIDATION_ERROR'
        });
      }

      // Ownership check (unless superadmin)
      if (req.user.role !== 'superadmin') {
        const belongs = await VehicleModel.belongsToOrg(id, req.user.orgId);
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
        metadata: finalMetadata
      });

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
   * Delete vehicle (Soft delete)
   */
  async deleteVehicle(req, res, next) {
    try {
      const { id } = req.params;

      // Ownership check (unless superadmin)
      if (req.user.role !== 'superadmin') {
        const belongs = await VehicleModel.belongsToOrg(id, req.user.orgId);
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
        const belongs = await VehicleModel.belongsToOrg(id, req.user.orgId);
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
        const belongs = await VehicleModel.belongsToOrg(id, req.user.orgId);
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

      // Apply Odometer Baseline Offset
      const vehicle = await VehicleModel.findById(id);
      const baseline = parseFloat(vehicle?.metadata?.odometerReading) || 0;
      if (baseline > 0 && result.points) {
        result.points.forEach(p => p.odometer = (p.odometer || 0) + baseline);
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
        const belongs = await VehicleModel.belongsToOrg(id, req.user.orgId);
        if (!belongs) {
          return res.status(403).json({
            success: false,
            error: 'Access denied to vehicle.',
            code: 'FORBIDDEN'
          });
        }
      }

      const points = await GpsModel.getRoute(id, { startDate, endDate });

      // Apply Odometer Baseline Offset
      const vehicle = await VehicleModel.findById(id);
      const baseline = parseFloat(vehicle?.metadata?.odometerReading) || 0;
      if (baseline > 0 && points) {
        points.forEach(p => p.odometer = (p.odometer || 0) + baseline);
      }

      res.status(200).json({
        success: true,
        data: points
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
        const belongs = await VehicleModel.belongsToOrg(id, req.user.orgId);
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
        const belongs = await VehicleModel.belongsToOrg(id, req.user.orgId);
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
   * Get raw device messages (Sensor Data)
   * GET /api/vehicles/:id/messages
   */
  async getVehicleMessages(req, res, next) {
    try {
      const { id } = req.params;
      const { page, limit } = req.query;

      // Access Check
      if (req.user.role !== 'superadmin') {
        const belongs = await VehicleModel.belongsToOrg(id, req.user.orgId);
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
  }
};

module.exports = VehicleController;
