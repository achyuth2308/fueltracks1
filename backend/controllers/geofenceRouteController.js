const GeofenceModel = require('../models/geofenceModel');
const RouteModel = require('../models/routeModel');
const VehicleModel = require('../models/vehicleModel');

const GeofenceRouteController = {
  // ══════════════════════════════════════════════════════════
  // GEOFENCES (admin & organization level)
  // ══════════════════════════════════════════════════════════

  async getGeofences(req, res, next) {
    try {
      const orgId = req.query.org_id || req.query.orgId || req.user.orgId;
      const geofences = await GeofenceModel.findAll(orgId);
      res.json({ success: true, data: geofences });
    } catch (err) {
      next(err);
    }
  },

  async createGeofence(req, res, next) {
    try {
      const orgId = req.body.org_id || req.body.orgId || req.user.orgId;
      const { name, type, coordinates, radius, center_lat, center_lng, is_active, notification_time, color, alert_on_enter, alert_on_exit } = req.body;
      if (!name) {
        return res.status(400).json({ success: false, error: 'Name is required.' });
      }
      const geofence = await GeofenceModel.create({
        orgId, name, type, coordinates: coordinates || [], radius, center_lat, center_lng, is_active, notification_time,
        color: color || '#3B82F6', alert_on_enter: alert_on_enter !== false, alert_on_exit: alert_on_exit !== false
      });
      res.status(201).json({ success: true, data: geofence });
    } catch (err) {
      next(err);
    }
  },

  async updateGeofence(req, res, next) {
    try {
      const { id } = req.params;
      const { name, type, coordinates, radius, center_lat, center_lng, is_active, notification_time, color, alert_on_enter, alert_on_exit } = req.body;
      const updated = await GeofenceModel.update(id, {
        name, type, coordinates, radius, center_lat, center_lng, is_active, notification_time,
        color, alert_on_enter, alert_on_exit
      });
      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  },

  // ══════════════════════════════════════════════════════════
  // VEHICLE-CENTRIC GEOFENCES (Per Single Vehicle)
  // ══════════════════════════════════════════════════════════

  async getVehicleGeofences(req, res, next) {
    try {
      const { id: vehicleId } = req.params;
      const vehicle = await VehicleModel.findById(vehicleId);
      if (!vehicle) {
        return res.status(404).json({ success: false, error: 'Vehicle not found.' });
      }
      if (req.user.role !== 'superadmin') {
        const belongs = await VehicleModel.belongsToOrg(vehicleId, req.user.orgId, req.user.userId, req.user.role);
        if (!belongs) {
          return res.status(403).json({ success: false, error: 'Access denied to vehicle.' });
        }
      }
      const geofences = await GeofenceModel.findGeofencesByVehicleId(vehicleId, true);
      res.json({ success: true, data: geofences });
    } catch (err) {
      next(err);
    }
  },

  async createVehicleGeofence(req, res, next) {
    try {
      const { id: vehicleId } = req.params;
      const vehicle = await VehicleModel.findById(vehicleId);
      if (!vehicle) {
        return res.status(404).json({ success: false, error: 'Vehicle not found.' });
      }
      if (req.user.role !== 'superadmin') {
        const belongs = await VehicleModel.belongsToOrg(vehicleId, req.user.orgId, req.user.userId, req.user.role);
        if (!belongs) {
          return res.status(403).json({ success: false, error: 'Access denied to vehicle.' });
        }
      }

      const { name, type, coordinates, radius, center_lat, center_lng, is_active, color, alert_on_enter, alert_on_exit, vehicleIds } = req.body;
      if (!name) {
        return res.status(400).json({ success: false, error: 'Geofence name is required.' });
      }

      const effectiveOrgId = vehicle.org_id || req.user?.orgId || req.user?.org_id;
      if (!effectiveOrgId) {
        return res.status(400).json({ success: false, error: 'Vehicle organization could not be resolved.' });
      }

      const geofence = await GeofenceModel.create({
        orgId: effectiveOrgId,
        name,
        type: type || 'circle',
        coordinates: coordinates || [],
        radius: radius != null ? parseFloat(radius) : null,
        center_lat: center_lat != null ? parseFloat(center_lat) : null,
        center_lng: center_lng != null ? parseFloat(center_lng) : null,
        is_active: is_active !== false,
        color: color || '#3B82F6',
        alert_on_enter: alert_on_enter !== false,
        alert_on_exit: alert_on_exit !== false
      });

      // Directly link this geofence to primary vehicle and any additional vehicles selected
      const targetVehicleIds = Array.isArray(vehicleIds) && vehicleIds.length > 0
        ? Array.from(new Set([vehicleId, ...vehicleIds]))
        : [vehicleId];
      await GeofenceModel.assignToVehicles(geofence.id, targetVehicleIds);

      res.status(201).json({ success: true, data: geofence });
    } catch (err) {
      next(err);
    }
  },

  async updateVehicleGeofence(req, res, next) {
    try {
      const { id: vehicleId, geofenceId } = req.params;
      const vehicle = await VehicleModel.findById(vehicleId);
      if (!vehicle) {
        return res.status(404).json({ success: false, error: 'Vehicle not found.' });
      }
      if (req.user.role !== 'superadmin') {
        const belongs = await VehicleModel.belongsToOrg(vehicleId, req.user.orgId, req.user.userId, req.user.role);
        if (!belongs) {
          return res.status(403).json({ success: false, error: 'Access denied to vehicle.' });
        }
      }

      const { name, type, coordinates, radius, center_lat, center_lng, is_active, color, alert_on_enter, alert_on_exit, vehicleIds } = req.body;
      const updated = await GeofenceModel.update(geofenceId, {
        name,
        type,
        coordinates,
        radius: radius != null ? parseFloat(radius) : undefined,
        center_lat: center_lat != null ? parseFloat(center_lat) : undefined,
        center_lng: center_lng != null ? parseFloat(center_lng) : undefined,
        is_active,
        color,
        alert_on_enter,
        alert_on_exit
      });

      if (Array.isArray(vehicleIds) && vehicleIds.length > 0) {
        const targetVehicleIds = Array.from(new Set([vehicleId, ...vehicleIds]));
        await GeofenceModel.assignToVehicles(geofenceId, targetVehicleIds);
      }

      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  },

  async deleteVehicleGeofence(req, res, next) {
    try {
      const { id: vehicleId, geofenceId } = req.params;
      const vehicle = await VehicleModel.findById(vehicleId);
      if (!vehicle) {
        return res.status(404).json({ success: false, error: 'Vehicle not found.' });
      }
      if (req.user.role !== 'superadmin') {
        const belongs = await VehicleModel.belongsToOrg(vehicleId, req.user.orgId, req.user.userId, req.user.role);
        if (!belongs) {
          return res.status(403).json({ success: false, error: 'Access denied to vehicle.' });
        }
      }

      // Unlink vehicle from this geofence (preserves the master geofence for other vehicles)
      await GeofenceModel.unlinkVehicle(geofenceId, vehicleId);

      // If explicitly requested to delete master and no other vehicles are assigned
      if (req.query.deleteMaster === 'true') {
        const otherVehicles = await GeofenceModel.findVehiclesForGeofence(geofenceId);
        if (otherVehicles.length === 0) {
          await GeofenceModel.delete(geofenceId);
        }
      }

      res.json({ success: true, message: 'Geofence unlinked from vehicle successfully.' });
    } catch (err) {
      next(err);
    }
  },

  async getAvailableGeofences(req, res, next) {
    try {
      const { id: vehicleId } = req.params;
      const vehicle = await VehicleModel.findById(vehicleId);
      if (!vehicle) {
        return res.status(404).json({ success: false, error: 'Vehicle not found.' });
      }
      if (req.user.role !== 'superadmin') {
        const belongs = await VehicleModel.belongsToOrg(vehicleId, req.user.orgId, req.user.userId, req.user.role);
        if (!belongs) {
          return res.status(403).json({ success: false, error: 'Access denied to vehicle.' });
        }
      }

      const allGeofences = await GeofenceModel.findAllWithStats(vehicle.org_id);
      const current = await GeofenceModel.findGeofencesByVehicleId(vehicleId, false);
      const currentIds = new Set(current.map(g => g.id));

      const enriched = allGeofences.map(g => ({
        ...g,
        is_assigned_to_vehicle: currentIds.has(g.id)
      }));

      res.json({ success: true, data: enriched });
    } catch (err) {
      next(err);
    }
  },

  async linkVehicleGeofence(req, res, next) {
    try {
      const { id: vehicleId } = req.params;
      const { geofenceId, replaceGeofenceId } = req.body;
      if (!geofenceId) {
        return res.status(400).json({ success: false, error: 'geofenceId is required.' });
      }

      const vehicle = await VehicleModel.findById(vehicleId);
      if (!vehicle) {
        return res.status(404).json({ success: false, error: 'Vehicle not found.' });
      }
      if (req.user.role !== 'superadmin') {
        const belongs = await VehicleModel.belongsToOrg(vehicleId, req.user.orgId, req.user.userId, req.user.role);
        if (!belongs) {
          return res.status(403).json({ success: false, error: 'Access denied to vehicle.' });
        }
      }

      // If replacing an old geofence (e.g. replacing Guntur with Nellore)
      if (replaceGeofenceId) {
        await GeofenceModel.unlinkVehicle(replaceGeofenceId, vehicleId);
      }

      if (Array.isArray(req.body.vehicleIds) && req.body.vehicleIds.length > 0) {
        const targetVehicleIds = Array.from(new Set(req.body.vehicleIds));
        await GeofenceModel.assignToVehicles(geofenceId, targetVehicleIds);
      } else {
        await GeofenceModel.linkVehicle(geofenceId, vehicleId);
      }
      res.json({ success: true, message: 'Geofence linked to vehicle successfully.' });
    } catch (err) {
      next(err);
    }
  },

  async toggleVehicleGeofence(req, res, next) {
    try {
      const { id: vehicleId, geofenceId } = req.params;
      const vehicle = await VehicleModel.findById(vehicleId);
      if (!vehicle) {
        return res.status(404).json({ success: false, error: 'Vehicle not found.' });
      }
      if (req.user.role !== 'superadmin') {
        const belongs = await VehicleModel.belongsToOrg(vehicleId, req.user.orgId, req.user.userId, req.user.role);
        if (!belongs) {
          return res.status(403).json({ success: false, error: 'Access denied to vehicle.' });
        }
      }

      const { is_active } = req.body;
      const updated = await GeofenceModel.update(geofenceId, { is_active });
      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  },

  async copyVehicleGeofencesFrom(req, res, next) {
    try {
      const { id: targetVehicleId } = req.params;
      const { sourceVehicleId, replaceExisting = true } = req.body;

      if (!sourceVehicleId) {
        return res.status(400).json({ success: false, error: 'sourceVehicleId is required.' });
      }
      if (String(sourceVehicleId) === String(targetVehicleId)) {
        return res.status(400).json({ success: false, error: 'Cannot copy geofences from the same vehicle.' });
      }

      // Check permission on target vehicle
      const targetVehicle = await VehicleModel.findById(targetVehicleId);
      if (!targetVehicle) {
        return res.status(404).json({ success: false, error: 'Target vehicle not found.' });
      }
      if (req.user.role !== 'superadmin') {
        const belongsTarget = await VehicleModel.belongsToOrg(targetVehicleId, req.user.orgId, req.user.userId, req.user.role);
        if (!belongsTarget) {
          return res.status(403).json({ success: false, error: 'Access denied to target vehicle.' });
        }
      }

      // Check permission on source vehicle
      const sourceVehicle = await VehicleModel.findById(sourceVehicleId);
      if (!sourceVehicle) {
        return res.status(404).json({ success: false, error: 'Source vehicle not found.' });
      }
      if (req.user.role !== 'superadmin') {
        const belongsSource = await VehicleModel.belongsToOrg(sourceVehicleId, req.user.orgId, req.user.userId, req.user.role);
        if (!belongsSource) {
          return res.status(403).json({ success: false, error: 'Access denied to source vehicle.' });
        }
      }

      const result = await GeofenceModel.copyVehicleGeofences({
        sourceVehicleId,
        targetVehicleId,
        replaceExisting: replaceExisting !== false
      });

      if (!result.success) {
        return res.status(400).json(result);
      }

      // Return updated geofences for target vehicle
      const updatedGeofences = await GeofenceModel.findGeofencesByVehicleId(targetVehicleId, true);

      res.json({
        success: true,
        message: `Successfully copied ${result.count} geofence(s) from ${sourceVehicle.name || sourceVehicle.plate} to ${targetVehicle.name || targetVehicle.plate}.`,
        count: result.count,
        data: updatedGeofences
      });
    } catch (err) {
      next(err);
    }
  },

  async copyVehicleGeofencesTo(req, res, next) {
    try {
      const { id: sourceVehicleId } = req.params;
      const { targetVehicleIds, replaceExisting = true } = req.body;

      if (!Array.isArray(targetVehicleIds) || targetVehicleIds.length === 0) {
        return res.status(400).json({ success: false, error: 'targetVehicleIds array is required.' });
      }

      // Check permission on source vehicle
      const sourceVehicle = await VehicleModel.findById(sourceVehicleId);
      if (!sourceVehicle) {
        return res.status(404).json({ success: false, error: 'Source vehicle not found.' });
      }
      if (req.user.role !== 'superadmin') {
        const belongsSource = await VehicleModel.belongsToOrg(sourceVehicleId, req.user.orgId, req.user.userId, req.user.role);
        if (!belongsSource) {
          return res.status(403).json({ success: false, error: 'Access denied to source vehicle.' });
        }
      }

      // Filter out sourceVehicleId if present in targets
      const cleanTargetIds = targetVehicleIds.filter(id => String(id) !== String(sourceVehicleId));
      if (cleanTargetIds.length === 0) {
        return res.status(400).json({ success: false, error: 'No valid target vehicles provided.' });
      }

      // Validate target permissions
      if (req.user.role !== 'superadmin') {
        for (const tId of cleanTargetIds) {
          const belongs = await VehicleModel.belongsToOrg(tId, req.user.orgId, req.user.userId, req.user.role);
          if (!belongs) {
            return res.status(403).json({ success: false, error: `Access denied to vehicle ${tId}.` });
          }
        }
      }

      const result = await GeofenceModel.copyVehicleGeofencesToMultiple({
        sourceVehicleId,
        targetVehicleIds: cleanTargetIds,
        replaceExisting: replaceExisting !== false
      });

      if (!result.success) {
        return res.status(400).json(result);
      }

      res.json({
        success: true,
        message: `Successfully applied ${result.count} geofence(s) to ${result.targetVehiclesCount} vehicle(s).`,
        count: result.count,
        targetVehiclesCount: result.targetVehiclesCount
      });
    } catch (err) {
      next(err);
    }
  },

  async getVehiclesGeofenceSummary(req, res, next) {
    try {
      const orgId = req.query.org_id || req.query.orgId || req.user.orgId;
      const list = await GeofenceModel.getVehiclesWithGeofenceCounts(orgId, req.user.userId, req.user.role);
      res.json({ success: true, data: list });
    } catch (err) {
      next(err);
    }
  },

  async deleteGeofence(req, res, next) {
    try {
      const { id } = req.params;
      await GeofenceModel.delete(id);
      res.json({ success: true, message: 'Geofence deleted successfully.' });
    } catch (err) {
      next(err);
    }
  },

  async assignGeofence(req, res, next) {
    try {
      const { id } = req.params;
      const { vehicleIds } = req.body;
      if (!Array.isArray(vehicleIds)) {
        return res.status(400).json({ success: false, error: 'vehicleIds must be an array.' });
      }
      await GeofenceModel.assignToVehicles(id, vehicleIds);
      res.json({ success: true, message: 'Geofence assigned successfully.' });
    } catch (err) {
      next(err);
    }
  },

  async getGeofenceVehicles(req, res, next) {
    try {
      const { id, geofenceId } = req.params;
      const targetId = geofenceId || id;
      const vehicles = await GeofenceModel.findVehiclesForGeofence(targetId);
      res.json({ success: true, data: vehicles });
    } catch (err) {
      next(err);
    }
  },

  // ══════════════════════════════════════════════════════════
  // ROUTES — Admin versions (called from adminRoutes, no org guard needed
  // because the admin endpoints already require superadmin/dealer role and
  // the RouteModel.findAll already filters by orgId).
  // ══════════════════════════════════════════════════════════

  async getRoutes(req, res, next) {
    try {
      const orgId = req.query.org_id || req.query.orgId || req.user.orgId;
      const routes = await RouteModel.findAll(orgId);
      const enriched = await Promise.all(routes.map(async (r) => {
        const vehicles = await RouteModel.findVehiclesForRoute(r.id);
        return {
          ...r,
          vehicles,
          vehicle: vehicles[0] || null
        };
      }));
      res.json({ success: true, data: enriched });
    } catch (err) {
      next(err);
    }
  },

  async createRoute(req, res, next) {
    try {
      const orgId = req.body.org_id || req.body.orgId || req.user.orgId;
      const { name, coordinates, tolerance, direction, vehicle_id, vehicleId } = req.body;
      if (!name) {
        return res.status(400).json({ success: false, error: 'Name is required.' });
      }
      const coords = Array.isArray(coordinates) && coordinates.length > 0
        ? coordinates
        : [{ lat: 17.3850, lng: 78.4867 }, { lat: 17.3900, lng: 78.4900 }];
      const route = await RouteModel.create({
        orgId,
        name: name.trim(),
        coordinates: coords,
        tolerance: tolerance || 100,
        direction: direction || 'two_way'
      });
      const targetVehId = vehicle_id || vehicleId;
      if (targetVehId) {
        await RouteModel.assignToVehicles(route.id, [targetVehId]);
      }
      res.status(201).json({ success: true, data: route });
    } catch (err) {
      next(err);
    }
  },

  async updateRoute(req, res, next) {
    try {
      const { id } = req.params;
      const { name, coordinates, tolerance, direction, is_active } = req.body;
      const updated = await RouteModel.update(id, { name, coordinates, tolerance, direction, is_active });
      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  },

  async deleteRoute(req, res, next) {
    try {
      const { id } = req.params;
      await RouteModel.delete(id);
      res.json({ success: true, message: 'Route deleted successfully.' });
    } catch (err) {
      next(err);
    }
  },

  async assignRoute(req, res, next) {
    try {
      const { id } = req.params;
      const { vehicleIds } = req.body;
      if (!Array.isArray(vehicleIds)) {
        return res.status(400).json({ success: false, error: 'vehicleIds must be an array.' });
      }
      await RouteModel.assignToVehicles(id, vehicleIds);
      res.json({ success: true, message: 'Route assigned successfully.' });
    } catch (err) {
      next(err);
    }
  },

  async getRouteVehicles(req, res, next) {
    try {
      const { id } = req.params;
      const vehicles = await RouteModel.findVehiclesForRoute(id);
      res.json({ success: true, data: vehicles });
    } catch (err) {
      next(err);
    }
  },

  // ══════════════════════════════════════════════════════════
  // ROUTES — Customer-facing (called from vehicleRoutes)
  // Any authenticated user (including role='customer') can manage
  // routes that belong to their own organisation. Each method
  // enforces org ownership before mutating data.
  // ══════════════════════════════════════════════════════════

  async getMyRoutes(req, res, next) {
    try {
      const routes = await RouteModel.findAll(req.user.orgId);
      res.json({ success: true, data: routes });
    } catch (err) {
      next(err);
    }
  },

  async createMyRoute(req, res, next) {
    try {
      const { name, coordinates, tolerance } = req.body;
      if (!name || !coordinates || !Array.isArray(coordinates) || coordinates.length < 2) {
        return res.status(400).json({
          success: false,
          error: 'Name and at least 2 coordinate points are required.',
        });
      }
      const route = await RouteModel.create({
        orgId: req.user.orgId,
        name,
        coordinates,
        tolerance,
      });
      res.status(201).json({ success: true, data: route });
    } catch (err) {
      next(err);
    }
  },

  async updateMyRoute(req, res, next) {
    try {
      const { id } = req.params;
      const existing = await RouteModel.findById(id);
      if (!existing || existing.org_id !== req.user.orgId) {
        return res.status(404).json({ success: false, error: 'Route not found.' });
      }
      const { name, coordinates, tolerance, is_active } = req.body;
      const updated = await RouteModel.update(id, { name, coordinates, tolerance, is_active });
      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  },

  async deleteMyRoute(req, res, next) {
    try {
      const { id } = req.params;
      const existing = await RouteModel.findById(id);
      if (!existing || existing.org_id !== req.user.orgId) {
        return res.status(404).json({ success: false, error: 'Route not found.' });
      }
      await RouteModel.delete(id);
      res.json({ success: true, message: 'Route deleted.' });
    } catch (err) {
      next(err);
    }
  },

  async assignMyRoute(req, res, next) {
    try {
      const { id } = req.params;
      const { vehicleIds } = req.body;
      if (!Array.isArray(vehicleIds)) {
        return res.status(400).json({ success: false, error: 'vehicleIds must be an array.' });
      }
      const existing = await RouteModel.findById(id);
      if (!existing || existing.org_id !== req.user.orgId) {
        return res.status(404).json({ success: false, error: 'Route not found.' });
      }
      await RouteModel.assignToVehicles(id, vehicleIds);
      res.json({ success: true, message: 'Route assigned to vehicles.' });
    } catch (err) {
      next(err);
    }
  },

  async getMyRouteVehicles(req, res, next) {
    try {
      const { id } = req.params;
      const existing = await RouteModel.findById(id);
      if (!existing || existing.org_id !== req.user.orgId) {
        return res.status(404).json({ success: false, error: 'Route not found.' });
      }
      const vehicles = await RouteModel.findVehiclesForRoute(id);
      res.json({ success: true, data: vehicles });
    } catch (err) {
      next(err);
    }
  },
};

module.exports = GeofenceRouteController;
