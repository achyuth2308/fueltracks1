const GeofenceModel = require('../models/geofenceModel');
const RouteModel = require('../models/routeModel');

const GeofenceRouteController = {
  // Geofences
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
      const { vehicleIds } = req.body; // Array of vehicle IDs
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

  // Routes
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
      const route = await RouteModel.create({
        orgId, name, coordinates, tolerance
      });
      res.status(201).json({ success: true, data: route });
    } catch (err) {
      next(err);
    }
  },

  async updateRoute(req, res, next) {
    try {
      const { id } = req.params;
      const { name, coordinates, tolerance, is_active } = req.body;
      const updated = await RouteModel.update(id, {
        name, coordinates, tolerance, is_active
      });
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
      const { vehicleIds } = req.body; // Array of vehicle IDs
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
  }
};

module.exports = GeofenceRouteController;
