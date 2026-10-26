const reportService = require('../services/reportService');
const geofenceTransitService = require('../services/geofenceTransitService');
const VehicleModel = require('../../../models/vehicleModel');

class ReportController {
  
  // Helper to parse dates
  parseDates(req) {
    const { startDate, endDate } = req.query;
    if (!startDate || !endDate) {
      throw new Error('startDate and endDate are required');
    }
    return {
      start: new Date(startDate),
      end: new Date(endDate)
    };
  }

  // Helper to inject user scope
  enrichFilters(req) {
    const filters = { ...req.query };
    if (req.user?.role !== 'superadmin' && req.user?.orgId) {
      filters.orgId = req.user.orgId;
    } else if (req.user?.role === 'superadmin') {
      filters.isSuperAdmin = true;
    }
    filters.role = req.user?.role;
    filters.userId = req.user?.userId;
    return filters;
  }

  async getTripReport(req, res, next) {
    try {
      const { start, end } = this.parseDates(req);
      const filters = this.enrichFilters(req);
      const data = await reportService.getTripReport(filters, start, end);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async getDailyTripReport(req, res, next) {
    try {
      const { start, end } = this.parseDates(req);
      const filters = this.enrichFilters(req);
      const data = await reportService.getDailyTripReport(filters, start, end);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async getDailyDistanceReport(req, res, next) {
    try {
      const { start, end } = this.parseDates(req);
      const filters = this.enrichFilters(req);
      const data = await reportService.getDailyDistanceReport(filters, start, end);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async getVehicleActivityReport(req, res, next) {
    try {
      const { start, end } = this.parseDates(req);
      const filters = this.enrichFilters(req);
      const data = await reportService.getVehicleActivityReport(filters, start, end);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async getRouteHistoryReport(req, res, next) {
    try {
      const { start, end } = this.parseDates(req);
      const { vehicleId } = req.query;
      if (!vehicleId) throw new Error('vehicleId is required for Route History');
      
      if (req.user?.role === 'customer') {
        const hasAccess = await VehicleModel.belongsToOrg(vehicleId, req.user.orgId, req.user.userId, req.user.role);
        if (!hasAccess) {
          return res.status(403).json({ success: false, error: 'Access denied to vehicle' });
        }
      }
      
      const data = await reportService.getRouteHistoryReport(vehicleId, start, end);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async getIgnitionReport(req, res, next) {
    try {
      const { start, end } = this.parseDates(req);
      const filters = this.enrichFilters(req);
      const data = await reportService.getIgnitionReport(filters, start, end);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async getOverspeedingReport(req, res, next) {
    try {
      const { start, end } = this.parseDates(req);
      const filters = this.enrichFilters(req);
      const speedLimit = req.query.speedLimit ? parseInt(req.query.speedLimit) : 60;
      const data = await reportService.getOverspeedingReport(filters, start, end, speedLimit);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async getStoppagesReport(req, res, next) {
    try {
      const { start, end } = this.parseDates(req);
      const filters = this.enrichFilters(req);
      const data = await reportService.getStoppagesReport(filters, start, end);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async getConsolidatedReport(req, res, next) {
    try {
      const { start, end } = this.parseDates(req);
      // For consolidated report, orgId must be tied to user or selected by superadmin
      const orgId = req.user?.role === 'superadmin' ? req.query.orgId : req.user?.orgId;
      if (!orgId && req.user?.role !== 'customer' && req.user?.role !== 'superadmin') throw new Error('orgId is required for Consolidated Report');
      
      const role = req.user?.role;
      const userId = req.user?.userId;
      const vehicleId = req.query.vehicleId || null;
      
      const data = await reportService.getConsolidatedReport(orgId, role, userId, start, end, vehicleId);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async getIndividualReport(req, res, next) {
    try {
      const { start, end } = this.parseDates(req);
      const { vehicleId } = req.query;
      if (!vehicleId) throw new Error('vehicleId is required for Individual Report');
      
      if (req.user?.role === 'customer') {
        const hasAccess = await VehicleModel.belongsToOrg(vehicleId, req.user.orgId, req.user.userId, req.user.role);
        if (!hasAccess) {
          return res.status(403).json({ success: false, error: 'Access denied to vehicle' });
        }
      }
      
      const data = await reportService.getIndividualReport(vehicleId, start, end);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async getDashboardStats(req, res, next) {
    try {
      const orgId = req.user?.role === 'superadmin' ? req.query.orgId : req.user?.orgId;
      const data = await reportService.getDashboardStats(orgId);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async getGeofenceTransitReport(req, res, next) {
    try {
      const { start, end } = this.parseDates(req);
      const filters = this.enrichFilters(req);
      const data = await geofenceTransitService.getTransitReport(filters, start, end);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async getGeofenceSinglePlaceReport(req, res, next) {
    try {
      const { start, end } = this.parseDates(req);
      const filters = this.enrichFilters(req);
      if (req.query.geofenceId) {
        filters.geofenceId = req.query.geofenceId;
      }
      const result = await geofenceTransitService.getSinglePlaceActivityReport(filters, start, end);
      res.json({ success: true, data: result.rows, summary: result.summary });
    } catch (err) {
      next(err);
    }
  }

  async getGeofenceOneWayReport(req, res, next) {
    try {
      const { start, end } = this.parseDates(req);
      const filters = this.enrichFilters(req);
      if (req.query.fromGeofenceId) filters.fromGeofenceId = req.query.fromGeofenceId;
      if (req.query.toGeofenceId) filters.toGeofenceId = req.query.toGeofenceId;

      const result = await geofenceTransitService.getOneWayActivityReport(filters, start, end);
      res.json({ success: true, data: result.rows, summary: result.summary });
    } catch (err) {
      next(err);
    }
  }

  async getGeofenceTwoWayReport(req, res, next) {
    try {
      const { start, end } = this.parseDates(req);
      const filters = this.enrichFilters(req);
      if (req.query.fromGeofenceId) filters.fromGeofenceId = req.query.fromGeofenceId;
      if (req.query.toGeofenceId) filters.toGeofenceId = req.query.toGeofenceId;

      const result = await geofenceTransitService.getTwoWayActivityReport(filters, start, end);
      res.json({ success: true, data: result.rows, summary: result.summary });
    } catch (err) {
      next(err);
    }
  }

  async getGeofenceRoundTripReport(req, res, next) {
    try {
      const { start, end } = this.parseDates(req);
      const filters = this.enrichFilters(req);
      if (req.query.geofenceId) filters.geofenceId = req.query.geofenceId;

      const result = await geofenceTransitService.getRoundTripActivityReport(filters, start, end);
      res.json({ success: true, data: result.rows, summary: result.summary });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new ReportController();
