const reportService = require('../services/reportService');

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

  async getDashboardStats(req, res, next) {
    try {
      const orgId = req.user?.role === 'superadmin' ? req.query.orgId : req.user?.org_id;
      const data = await reportService.getDashboardStats(orgId);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new ReportController();
