const GeofenceModel = require('../models/geofenceModel');
const RouteModel = require('../models/routeModel');

const GeofenceRouteController = {
  // ══════════════════════════════════════════════════════════
  // GEOFENCES (admin-only, called from adminRoutes)
  // ══════════════════════════════════════════════════════════

  async getGeofences(req, res, next) {
    try {
      const orgId = req.user.orgId;
      const geofences = await GeofenceModel.findAll(orgId);
      res.json({ success: true, data: geofences });
    } catch (err) {
      next(err);
    }
  },

  async createGeofence(req, res, next) {
    try {
      const orgId = req.user.orgId;
      const { name, type, coordinates, radius, center_lat, center_lng } = req.body;
      if (!name || !coordinates) {
        return res.status(400).json({ success: false, error: 'Name and coordinates are required.' });
      }
      const geofence = await GeofenceModel.create({
        orgId, name, type, coordinates, radius, center_lat, center_lng
      });
      res.status(201).json({ success: true, data: geofence });
    } catch (err) {
      next(err);
    }
  },

  async updateGeofence(req, res, next) {
    try {
      const { id } = req.params;
      const { name, type, coordinates, radius, center_lat, center_lng, is_active } = req.body;
      const updated = await GeofenceModel.update(id, {
        name, type, coordinates, radius, center_lat, center_lng, is_active
      });
      res.json({ success: true, data: updated });
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
      const { id } = req.params;
      const vehicles = await GeofenceModel.findVehiclesForGeofence(id);
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
      const orgId = req.user.orgId;
      const routes = await RouteModel.findAll(orgId);
      res.json({ success: true, data: routes });
    } catch (err) {
      next(err);
    }
  },

  async createRoute(req, res, next) {
    try {
      const orgId = req.user.orgId;
      const { name, coordinates, tolerance } = req.body;
      if (!name || !coordinates) {
        return res.status(400).json({ success: false, error: 'Name and coordinates are required.' });
      }
      const route = await RouteModel.create({ orgId, name, coordinates, tolerance });
      res.status(201).json({ success: true, data: route });
    } catch (err) {
      next(err);
    }
  },

  async updateRoute(req, res, next) {
    try {
      const { id } = req.params;
      const { name, coordinates, tolerance, is_active } = req.body;
      const updated = await RouteModel.update(id, { name, coordinates, tolerance, is_active });
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
