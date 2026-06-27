const reportRepository = require('../repositories/reportRepository');
const db = require('../../../config/db');

class ReportService {
  /**
   * Resolve vehicles based on filters.
   * If vehicleId is provided, returns [vehicleId].
   * If groupId is provided, returns all vehicleIds in that group.
   * If orgId is provided, returns all vehicleIds in that org.
   */
  async resolveVehicles(filters) {
    const { vehicleId, groupId, orgId, isSuperAdmin } = filters;
    if (vehicleId) {
      return [vehicleId];
    }
    if (groupId) {
      const res = await db.query('SELECT vehicle_id FROM vehicle_groups WHERE group_id = $1', [groupId]);
      return res.rows.map(r => r.vehicle_id);
    }
    if (orgId) {
      const res = await db.query('SELECT id as vehicle_id FROM vehicles WHERE org_id = $1', [orgId]);
      return res.rows.map(r => r.vehicle_id);
    }
    if (isSuperAdmin) {
      const res = await db.query('SELECT id as vehicle_id FROM vehicles WHERE is_active = true');
      return res.rows.map(r => r.vehicle_id);
    }
    return [];
  }

  async getVehicleDetails(vehicleIds) {
    if (!vehicleIds || vehicleIds.length === 0) return {};
    // Get basic details to attach to report rows
    const placeholders = vehicleIds.map((_, i) => `$${i + 1}`).join(',');
    const query = `
      SELECT v.id, v.name, v.plate, o.name as org_name, v.metadata->>'odometerReading' as baseline
      FROM vehicles v
      LEFT JOIN organizations o ON v.org_id = o.id
      WHERE v.id IN (${placeholders})
    `;
    const res = await db.query(query, vehicleIds);
    const map = {};
    res.rows.forEach(r => { map[r.id] = r; });
    return map;
  }

  async getTripReport(filters, startDate, endDate) {
    const vehicleIds = await this.resolveVehicles(filters);
    const vehicleDetails = await this.getVehicleDetails(vehicleIds);
    
    let allTrips = [];
    for (const vId of vehicleIds) {
      const trips = await reportRepository.getTrips(vId, startDate, endDate);
      const vInfo = vehicleDetails[vId] || {};
      trips.forEach(t => {
        allTrips.push({
          ...t,
          vehicle_id: vId,
          vehicle_name: vInfo.name,
          plate: vInfo.plate,
          org_name: vInfo.org_name
        });
      });
    }
    // Sort overall by start_time
    return allTrips.sort((a, b) => new Date(b.start_time) - new Date(a.start_time));
  }

  async getDailyDistanceReport(filters, startDate, endDate) {
    const vehicleIds = await this.resolveVehicles(filters);
    const vehicleDetails = await this.getVehicleDetails(vehicleIds);

    let allData = [];
    for (const vId of vehicleIds) {
      const data = await reportRepository.getDailyDistance(vId, startDate, endDate);
      const vInfo = vehicleDetails[vId] || {};
      const baseline = parseFloat(vInfo.baseline) || 0;
      
      // We can also fetch trip count for that day
      // But to keep it efficient, we just return the distance for now, or we can do a sub-fetch.
      data.forEach(d => {
        if (baseline > 0) {
          d.start_odometer = (d.start_odometer || 0) + baseline;
          d.end_odometer = (d.end_odometer || 0) + baseline;
        }
        allData.push({
          ...d,
          vehicle_id: vId,
          vehicle_name: vInfo.name,
          plate: vInfo.plate,
          org_name: vInfo.org_name
        });
      });
    }
    return allData.sort((a, b) => new Date(b.date) - new Date(a.date));
  }

  async getVehicleActivityReport(filters, startDate, endDate) {
    const vehicleIds = await this.resolveVehicles(filters);
    const vehicleDetails = await this.getVehicleDetails(vehicleIds);

    let allData = [];
    for (const vId of vehicleIds) {
      const data = await reportRepository.getActivity(vId, startDate, endDate);
      const trips = await reportRepository.getTrips(vId, startDate, endDate);
      
      const vInfo = vehicleDetails[vId] || {};
      if (data) {
        allData.push({
          ...data,
          trip_count: trips.length,
          vehicle_id: vId,
          vehicle_name: vInfo.name,
          plate: vInfo.plate,
          org_name: vInfo.org_name
        });
      }
    }
    return allData;
  }

  async getRouteHistoryReport(vehicleId, startDate, endDate) {
    // Route history is typically for a single vehicle
    const vehicleDetails = await this.getVehicleDetails([vehicleId]);
    const vInfo = vehicleDetails[vehicleId] || {};
    
    const points = await reportRepository.getRouteHistory(vehicleId, startDate, endDate);
    const trips = await reportRepository.getTrips(vehicleId, startDate, endDate);
    
    const baseline = parseFloat(vInfo.baseline) || 0;
    if (baseline > 0 && points) {
      points.forEach(p => p.odometer = (p.odometer || 0) + baseline);
    }
    
    const distance = points.length > 0 ? (points[points.length-1].odometer - points[0].odometer) : 0;
    
    return {
      vehicle: vInfo,
      points,
      summary: {
        distance,
        trip_count: trips.length,
        point_count: points.length
      }
    };
  }

  async getIgnitionReport(filters, startDate, endDate) {
    const vehicleIds = await this.resolveVehicles(filters);
    const vehicleDetails = await this.getVehicleDetails(vehicleIds);

    let allEvents = [];
    for (const vId of vehicleIds) {
      const events = await reportRepository.getIgnitionEvents(vId, startDate, endDate);
      const vInfo = vehicleDetails[vId] || {};
      events.forEach(e => {
        allEvents.push({
          ...e,
          vehicle_id: vId,
          vehicle_name: vInfo.name,
          plate: vInfo.plate,
          org_name: vInfo.org_name
        });
      });
    }
    return allEvents.sort((a, b) => new Date(b.device_time) - new Date(a.device_time));
  }

  async getOverspeedingReport(filters, startDate, endDate, speedLimit = 60) {
    const vehicleIds = await this.resolveVehicles(filters);
    const vehicleDetails = await this.getVehicleDetails(vehicleIds);

    let allEvents = [];
    for (const vId of vehicleIds) {
      const events = await reportRepository.getOverspeeding(vId, startDate, endDate, speedLimit);
      const vInfo = vehicleDetails[vId] || {};
      events.forEach(e => {
        allEvents.push({
          ...e,
          vehicle_id: vId,
          vehicle_name: vInfo.name,
          plate: vInfo.plate,
          org_name: vInfo.org_name
        });
      });
    }
    return allEvents.sort((a, b) => new Date(b.start_time) - new Date(a.start_time));
  }

  async getStoppagesReport(filters, startDate, endDate) {
    const vehicleIds = await this.resolveVehicles(filters);
    const vehicleDetails = await this.getVehicleDetails(vehicleIds);

    let allStoppages = [];
    for (const vId of vehicleIds) {
      const stoppages = await reportRepository.getStoppages(vId, startDate, endDate);
      const vInfo = vehicleDetails[vId] || {};
      stoppages.forEach(s => {
        allStoppages.push({
          ...s,
          vehicle_id: vId,
          vehicle_name: vInfo.name,
          plate: vInfo.plate,
          org_name: vInfo.org_name
        });
      });
    }
    return allStoppages.sort((a, b) => new Date(b.start_time) - new Date(a.start_time));
  }

  async getConsolidatedReport(orgId, startDate, endDate) {
    const data = await reportRepository.getConsolidatedActivity(orgId, startDate, endDate);
    return data;
  }

  async getIndividualReport(vehicleId, startDate, endDate) {
    const vehicleDetails = await this.getVehicleDetails([vehicleId]);
    const vInfo = vehicleDetails[vehicleId] || {};
    
    const activity = await reportRepository.getActivity(vehicleId, startDate, endDate);
    const trips = await reportRepository.getTrips(vehicleId, startDate, endDate);
    const stoppages = await reportRepository.getStoppages(vehicleId, startDate, endDate);
    const overspeeding = await reportRepository.getOverspeeding(vehicleId, startDate, endDate, 60);

    return {
      vehicle: vInfo,
      activity: activity || { running_seconds: 0, idle_seconds: 0, stopped_seconds: 0, distance_travelled: 0 },
      trips,
      stoppages,
      overspeeding,
      summary: {
        trip_count: trips.length,
        stoppage_count: stoppages.length,
        overspeeding_count: overspeeding.length
      }
    };
  }

  async getDashboardStats(orgId) {
    // Dashboard stats:
    // Today's boundaries
    const todayStart = new Date();
    todayStart.setHours(0,0,0,0);
    const todayEnd = new Date();
    todayEnd.setHours(23,59,59,999);

    const filters = { orgId }; // For superadmin, orgId might be null, resolveVehicles handles it? 
    // Wait, if no orgId, resolveVehicles returns []. We need a way to get all vehicles.
    let vehicleIds = [];
    if (orgId) {
      vehicleIds = await this.resolveVehicles({ orgId });
    } else {
      const res = await db.query('SELECT id as vehicle_id FROM vehicles WHERE is_active = true');
      vehicleIds = res.rows.map(r => r.vehicle_id);
    }

    if (vehicleIds.length === 0) {
      return { tripsToday: 0, distanceToday: 0, running: 0, idle: 0, stopped: 0, offline: 0, ignitionEvents: 0 };
    }

    // Vehicle states from vehicle_latest_state
    const placeholders = vehicleIds.map((_, i) => `$${i + 1}`).join(',');
    const stateQuery = `
      SELECT 
        COUNT(*) FILTER (WHERE is_online = true AND speed > 0) as running,
        COUNT(*) FILTER (WHERE is_online = true AND speed = 0 AND ignition = true) as idle,
        COUNT(*) FILTER (WHERE is_online = true AND speed = 0 AND (ignition = false OR ignition IS NULL)) as stopped,
        COUNT(*) FILTER (WHERE is_online = false) as offline
      FROM vehicle_latest_state
      WHERE vehicle_id IN (${placeholders})
    `;
    const stateRes = await db.query(stateQuery, vehicleIds);
    const states = stateRes.rows[0];

    // For performance, we can just return these states quickly.
    // Calculating trips today across ALL vehicles might be heavy. Let's do it if vehicle count is reasonable.
    // Instead of querying all gps_points for all vehicles, we can use a simpler query if needed, but repo has the logic.
    let tripsToday = 0;
    let distanceToday = 0;
    let ignitionEvents = 0;


    // Let's rewrite safely with ANY for large arrays
    const distResSafe = await db.query(`
      SELECT SUM(max_odo - min_odo) as total_dist
      FROM (
        SELECT MAX(odometer) as max_odo, MIN(odometer) as min_odo
        FROM gps_points
        WHERE vehicle_id = ANY($1) AND device_time BETWEEN $2 AND $3
        GROUP BY vehicle_id
      ) sub
    `, [vehicleIds, todayStart, todayEnd]);
    
    distanceToday = distResSafe.rows[0]?.total_dist || 0;

    return {
      tripsToday: 0, // Simplified for dashboard performance
      distanceToday: distanceToday,
      running: parseInt(states.running || 0),
      idle: parseInt(states.idle || 0),
      stopped: parseInt(states.stopped || 0),
      offline: parseInt(states.offline || 0),
      ignitionEvents: 0 // Simplified
    };
  }
}

module.exports = new ReportService();
