const manualFuelService = require('../services/manualFuelService');
const VehicleModel = require('../../../models/vehicleModel');

class ManualFuelController {
  /**
   * GET /api/fuel/manual/config/:vehicleId
   */
  async getConfig(req, res, next) {
    try {
      const { vehicleId } = req.params;
      const config = await manualFuelService.getVehicleFuelConfig(vehicleId);
      res.json({ success: true, data: config, config: config });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/fuel/manual/config/:vehicleId
   */
  async saveConfig(req, res, next) {
    try {
      const { vehicleId } = req.params;
      const orgId = req.user.orgId;
      const config = await manualFuelService.upsertVehicleFuelConfig(vehicleId, orgId, req.body);
      res.json({ success: true, message: 'Vehicle fuel configuration saved successfully.', data: config });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/fuel/manual/state/:vehicleId
   */
  async getState(req, res, next) {
    try {
      const { vehicleId } = req.params;
      const state = await manualFuelService.getVehicleFuelState(vehicleId);
      res.json({ success: true, data: state });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/fuel/manual/entry/:vehicleId
   * Driver manual fuel entry: Initial, Refill, or Current Tank reconciliation
   */
  async submitEntry(req, res, next) {
    try {
      const { vehicleId } = req.params;
      const driverUser = req.user;
      const result = await manualFuelService.addManualFuelEntry(vehicleId, driverUser, req.body);
      res.json({
        success: true,
        message: 'Fuel entry recorded successfully.',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/fuel/manual/entries/:vehicleId
   */
  async getEntries(req, res, next) {
    try {
      const { vehicleId } = req.params;
      const { page, limit, entryType } = req.query;
      const result = await manualFuelService.getFuelEntries(vehicleId, { page, limit, entryType });
      res.json({ success: true, data: result.entries, pagination: { total: result.total, page: result.page, limit: result.limit } });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/fuel/manual/chart/:vehicleId
   * Chart timeline, refills & mileage history for manual fuel
   */
  async getChartData(req, res, next) {
    try {
      const { vehicleId } = req.params;
      const { range } = req.query;
      const data = await manualFuelService.getFuelChartData(vehicleId, range);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/fuel/manual/overview
   * Fleet-wide manual fuel monitoring summary for dashboard
   */
  async getOverview(req, res, next) {
    try {
      const orgId = req.user.orgId;
      const role = req.user.role;
      const userId = req.user.userId;
      const data = await manualFuelService.getFleetFuelOverview(orgId, role, userId);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new ManualFuelController();
