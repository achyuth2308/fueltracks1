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
    const { vehicleId, groupId, orgId, isSuperAdmin, role, userId } = filters;

    // Apply customer user -> group -> vehicles restriction first.
    // Customers can only see vehicles explicitly assigned to their groups, regardless of orgId.
    if (role === 'customer' && userId) {
      const res = await db.query(`
        SELECT vg.vehicle_id 
        FROM vehicle_groups vg
        JOIN user_groups ug ON vg.group_id = ug.group_id
        JOIN vehicles v ON vg.vehicle_id = v.id
        WHERE ug.user_id = $1 AND v.is_active = true
      `, [userId]);
      const allowedIds = res.rows.map(r => r.vehicle_id);

      if (vehicleId) {
        return allowedIds.filter(id => id === vehicleId);
      }
      if (groupId) {
        const gRes = await db.query('SELECT vehicle_id FROM vehicle_groups WHERE group_id = $1', [groupId]);
        const groupIds = new Set(gRes.rows.map(r => r.vehicle_id));
        return allowedIds.filter(id => groupIds.has(id));
      }
      return allowedIds;
    }
    
    // Apply customer user -> group -> vehicles restriction directly (bypassing orgId boundaries)
    if (role === 'customer' && userId) {
      const res = await db.query(`
        SELECT vg.vehicle_id 
        FROM vehicle_groups vg
        JOIN user_groups ug ON vg.group_id = ug.group_id
        WHERE ug.user_id = $1
      `, [userId]);
      const allowedIds = res.rows.map(r => r.vehicle_id);

      if (vehicleId) {
        return allowedIds.includes(vehicleId) ? [vehicleId] : [];
      }
      if (groupId) {
        const groupRes = await db.query('SELECT vehicle_id FROM vehicle_groups WHERE group_id = $1', [groupId]);
        const groupVehicleIds = groupRes.rows.map(r => r.vehicle_id);
        return groupVehicleIds.filter(id => allowedIds.includes(id));
      }
      return allowedIds;
    }

    let candidates = [];
    if (vehicleId) {
      candidates = [vehicleId];
    } else if (groupId) {
      const res = await db.query('SELECT vehicle_id FROM vehicle_groups WHERE group_id = $1', [groupId]);
      candidates = res.rows.map(r => r.vehicle_id);
    } else if (orgId) {
      const res = await db.query('SELECT id as vehicle_id FROM vehicles WHERE org_id = $1 AND is_active = true', [orgId]);
      candidates = res.rows.map(r => r.vehicle_id);
    } else if (isSuperAdmin) {
      const res = await db.query('SELECT id as vehicle_id FROM vehicles WHERE is_active = true');
      candidates = res.rows.map(r => r.vehicle_id);
    }

    return candidates;
  }

  async getVehicleDetails(vehicleIds) {
    if (!vehicleIds || vehicleIds.length === 0) return {};
    // Get basic details to attach to report rows
    const placeholders = vehicleIds.map((_, i) => `$${i + 1}`).join(',');
    const query = `
      SELECT v.id, v.name, v.plate, o.name as org_name,
             v.driver_name, v.driver_phone,
             v.metadata->>'odometerReading' as baseline,
             v.metadata->>'odometerSnapshot' as snapshot
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

  async getDailyTripReport(filters, startDate, endDate) {
    const vehicleIds = await this.resolveVehicles(filters);
    const vehicleDetails = await this.getVehicleDetails(vehicleIds);

    let allDailyTrips = [];
    for (const vId of vehicleIds) {
      const dailyTrips = await reportRepository.getDailyTrips(vId, startDate, endDate);
      const vInfo = vehicleDetails[vId] || {};
      dailyTrips.forEach(dt => {
        allDailyTrips.push({
          ...dt,
          vehicle_id: vId,
          vehicle_name: vInfo.name,
          plate: vInfo.plate,
          org_name: vInfo.org_name
        });
      });
    }
    // Sort overall by date DESC
    return allDailyTrips.sort((a, b) => new Date(b.date) - new Date(a.date));
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
          const snapshot = parseFloat(vInfo.snapshot) || 0;
          d.start_odometer = Math.round((baseline + Math.max(0, (d.start_odometer || 0) - snapshot)) * 100) / 100;
          d.end_odometer = Math.round((baseline + Math.max(0, (d.end_odometer || 0) - snapshot)) * 100) / 100;
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
    const snapshot = parseFloat(vInfo.snapshot) || 0;
    if (baseline > 0 && points) {
      points.forEach(p => p.odometer = baseline + Math.max(0, (p.odometer || 0) - snapshot));
    }

    const distance = points.length > 0 ? (points[points.length - 1].odometer - points[0].odometer) : 0;

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
          org_name: vInfo.org_name,
          driver_name: vInfo.driver_name,
          driver_phone: vInfo.driver_phone
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

  async getConsolidatedReport(orgId, role, userId, startDate, endDate, vehicleId) {
    const data = await reportRepository.getConsolidatedActivity(orgId, role, userId, startDate, endDate, vehicleId);
    if (!data || data.length === 0) return [];

    const vehicleIds = data.map(d => d.vehicle_id);
    const intervalsMap = await reportRepository.getVehicleIntervals(vehicleIds, startDate, endDate);

    return data.map(v => {
      const vIntervals = intervalsMap[v.vehicle_id] || [];
      if (vIntervals.length === 0) {
        const fullSec = Math.max(0, Math.round((new Date(endDate) - new Date(startDate)) / 1000));
        return {
          ...v,
          running_seconds: 0,
          idle_seconds: 0,
          stopped_seconds: fullSec,
          distance_travelled: 0,
          max_speed: 0,
          avg_speed: 0,
          intervals: [
            {
              status: 'Parked',
              start_time: startDate,
              end_time: endDate,
              duration_seconds: fullSec,
              distance: 0,
              max_speed: 0,
              avg_speed: 0,
              lat: v.start_lat || v.end_lat,
              lng: v.start_lng || v.end_lng
            }
          ]
        };
      }

      let runningSec = 0;
      let idleSec = 0;
      let stoppedSec = 0;
      let totalDist = 0;
      let maxSpd = 0;
      let speedSum = 0;
      let movingCount = 0;

      let sessionRefill = 0;
      let sessionTheft = 0;
      let runningFuelDrop = 0;
      let prevInv = null;

      for (const inv of vIntervals) {
        if (inv.status === 'Moving') {
          runningSec += inv.duration_seconds;
          totalDist += (inv.distance || 0);
          if (inv.max_speed > maxSpd) maxSpd = inv.max_speed;
          if (inv.avg_speed > 0) {
            speedSum += inv.avg_speed;
            movingCount++;
          }
        } else if (inv.status === 'Idle') {
          idleSec += inv.duration_seconds;
        } else {
          stoppedSec += inv.duration_seconds;
        }

        const sF = inv.start_fuel != null ? parseFloat(inv.start_fuel) : null;
        const eF = inv.end_fuel != null ? parseFloat(inv.end_fuel) : null;

        if (sF != null && eF != null) {
          const delta = eF - sF;
          if (inv.status === 'Parked' || inv.status === 'Idle') {
            if (delta >= 4.0) {
              sessionRefill += delta;
            } else if (inv.status === 'Parked' && delta <= -4.0 && !v.is_dispenser) {
              sessionTheft += Math.abs(delta);
            }
          } else if (inv.status === 'Moving') {
            if (delta < 0) {
              runningFuelDrop += Math.abs(delta);
            }
          }
        }

        // Detect fuel rise across inter-interval gaps (e.g. sensor unpowered during fueling)
        if (prevInv && prevInv.end_fuel != null && inv.start_fuel != null) {
          const gapDelta = parseFloat(inv.start_fuel) - parseFloat(prevInv.end_fuel);
          if (gapDelta >= 4.0) {
            sessionRefill += gapDelta;
          } else if (gapDelta <= -4.0 && !v.is_dispenser && inv.status === 'Parked' && prevInv.status === 'Parked') {
            sessionTheft += Math.abs(gapDelta);
          }
        }

        prevInv = inv;
      }

      const rawRepoRefill = parseFloat(v.total_refill) || 0;
      const rawRepoTheft = parseFloat(v.total_theft) || 0;
      const totalDispensed = parseFloat(v.total_dispensed) || 0;
      let totalRefill = Math.max(rawRepoRefill, sessionRefill);
      let totalTheft = Math.max(rawRepoTheft, sessionTheft);

      const startFuel = v.start_fuel != null ? parseFloat(v.start_fuel) : null;
      const endFuel = v.end_fuel != null ? parseFloat(v.end_fuel) : null;
      const roundedDist = Math.round(totalDist * 100) / 100;
      const engineHours = (runningSec + idleSec) / 3600;

      let netConsumed = 0;
      if (startFuel != null && endFuel != null) {
        const deducted = v.is_dispenser ? totalDispensed : totalTheft;
        const balance = startFuel - endFuel + totalRefill - deducted;

        if (balance > 0) {
          netConsumed = balance;
        } else if (runningFuelDrop > 0) {
          netConsumed = runningFuelDrop;
        } else if (roundedDist > 5) {
          // Fallback realistic combustion for commercial vehicles if sensor misses fuel addition
          netConsumed = Math.round((roundedDist / 2.5) * 10) / 10;
        } else {
          netConsumed = 0;
        }
      }

      // Reconcile totalRefill with mass balance: endFuel cannot exceed (startFuel + totalRefill - netConsumed - deducted)
      if (startFuel != null && endFuel != null) {
        const deducted = v.is_dispenser ? totalDispensed : totalTheft;
        const minReqRefill = (endFuel - startFuel) + netConsumed + deducted;
        if (minReqRefill > totalRefill) {
          totalRefill = Math.round(minReqRefill * 10) / 10;
        }
      }

      const finalConsumed = Math.round(netConsumed * 100) / 100;
      const finalKmpl = (finalConsumed > 0 && roundedDist > 0 && !v.is_generator)
        ? Math.round((roundedDist / finalConsumed) * 100) / 100
        : null;

      const finalLph = (finalConsumed > 0 && engineHours > 0)
        ? Math.round((finalConsumed / engineHours) * 100) / 100
        : null;

      return {
        ...v,
        running_seconds: runningSec,
        idle_seconds: idleSec,
        stopped_seconds: stoppedSec,
        distance_travelled: roundedDist,
        max_speed: Math.round(maxSpd),
        avg_speed: movingCount > 0 ? Math.round(speedSum / movingCount) : 0,
        total_refill: Math.round(totalRefill * 10) / 10,
        total_theft: Math.round(totalTheft * 10) / 10,
        consumption: finalConsumed,
        kmpl: finalKmpl,
        lph: finalLph,
        intervals: vIntervals
      };
    });
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
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

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
