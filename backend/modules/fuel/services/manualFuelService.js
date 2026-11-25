
const db = require('../../../config/db');
const { redis } = require('../../../config/redis');

class ManualFuelService {
  /**
   * Determine Fuel Status based on remaining fuel & thresholds
   */
  static determineFuelStatus(currentFuel, config) {
    if (currentFuel === null || currentFuel === undefined) return 'No Fuel Data';
    const numFuel = Number(currentFuel);
    const criticalThreshold = Number(config?.critical_fuel_alert_threshold ?? 8);
    const lowThreshold = Number(config?.low_fuel_alert_threshold ?? 15);
    const tankCapacity = Number(config?.tank_capacity ?? 100);

    if (numFuel <= criticalThreshold) return 'Critical Fuel';
    if (numFuel <= lowThreshold) return 'Low Fuel';
    if (numFuel >= tankCapacity * 0.5) return 'Healthy';
    return 'Normal';
  }

  /**
   * Get or initialize Fuel Configuration for a vehicle
   */
  async getVehicleFuelConfig(vehicleId) {
    const res = await db.query(
      `SELECT vfc.*, v.plate, v.name as vehicle_name, v.category
       FROM vehicle_fuel_configs vfc
       JOIN vehicles v ON v.id = vfc.vehicle_id
       WHERE vfc.vehicle_id = $1`,
      [vehicleId]
    );
    return res.rows[0] || null;
  }

  /**
   * Save or update Vehicle Fuel Configuration
   */
  async upsertVehicleFuelConfig(vehicleId, orgId, configData) {
    const {
      fuelType = 'Diesel',
      tankCapacity,
      initialFuel = 0,
      initialOdometer = 0,
      initialMileage = 8.0,
      reserveFuelLevel = 10.0,
      lowFuelAlertThreshold = 15.0,
      criticalFuelAlertThreshold = 8.0,
    } = configData;

    if (!tankCapacity || Number(tankCapacity) <= 0) {
      throw new Error('Valid tank capacity in litres is required.');
    }
    if (Number(initialFuel) > Number(tankCapacity)) {
      throw new Error('Initial fuel cannot exceed vehicle tank capacity.');
    }

    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      // Verify or resolve valid organization UUID
      let validOrgId = (orgId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orgId)) ? orgId : null;
      if (validOrgId) {
        const orgCheck = await client.query('SELECT id FROM organizations WHERE id = $1', [validOrgId]);
        if (orgCheck.rows.length === 0) validOrgId = null;
      }
      if (!validOrgId) {
        const vOrg = await client.query('SELECT org_id FROM vehicles WHERE id = $1', [vehicleId]);
        const candidateOrg = vOrg.rows[0]?.org_id;
        if (candidateOrg && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(candidateOrg)) {
          const orgCheck2 = await client.query('SELECT id FROM organizations WHERE id = $1', [candidateOrg]);
          if (orgCheck2.rows.length > 0) validOrgId = candidateOrg;
        }
      }

      const configRes = await client.query(
        `INSERT INTO vehicle_fuel_configs
           (vehicle_id, org_id, fuel_type, tank_capacity, initial_fuel,
            initial_odometer, initial_mileage, reserve_fuel_level,
            low_fuel_alert_threshold, critical_fuel_alert_threshold, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
         ON CONFLICT (vehicle_id) DO UPDATE SET
           org_id = COALESCE(EXCLUDED.org_id, vehicle_fuel_configs.org_id),
           fuel_type = EXCLUDED.fuel_type,
           tank_capacity = EXCLUDED.tank_capacity,
           initial_fuel = EXCLUDED.initial_fuel,
           initial_odometer = EXCLUDED.initial_odometer,
           initial_mileage = EXCLUDED.initial_mileage,
           reserve_fuel_level = EXCLUDED.reserve_fuel_level,
           low_fuel_alert_threshold = EXCLUDED.low_fuel_alert_threshold,
           critical_fuel_alert_threshold = EXCLUDED.critical_fuel_alert_threshold,
           updated_at = NOW()
         RETURNING *`,
        [
          vehicleId,
          validOrgId,
          fuelType,
          tankCapacity,
          initialFuel,
          initialOdometer,
          initialMileage,
          reserveFuelLevel,
          lowFuelAlertThreshold,
          criticalFuelAlertThreshold,
        ]
      );

      const config = configRes.rows[0];

      // Check if fuel state exists; if not, initialize it from initial config
      const stateRes = await client.query(
        'SELECT * FROM vehicle_fuel_states WHERE vehicle_id = $1',
        [vehicleId]
      );

      const fixedMileage = Number(initialMileage || 8.0);
      if (stateRes.rows.length === 0) {
        const estRange = Math.round(Number(initialFuel) * fixedMileage);
        const status = ManualFuelService.determineFuelStatus(initialFuel, config);

        await client.query(
          `INSERT INTO vehicle_fuel_states
             (vehicle_id, current_fuel, current_mileage, total_distance_travelled,
              total_fuel_consumed, total_fuel_refilled, estimated_range_km,
              last_known_odometer, fuel_status, updated_at)
           VALUES ($1, $2, $3, 0, 0, 0, $4, $5, $6, NOW())`,
          [vehicleId, initialFuel, fixedMileage, estRange, initialOdometer, status]
        );
      } else {
        // Vehicle state already exists: update to the FIXED user-configured mileage and recompute range
        const curFuel = Number(stateRes.rows[0].current_fuel);
        const estRange = Math.round(curFuel * fixedMileage);
        await client.query(
          `UPDATE vehicle_fuel_states SET
             current_mileage = $1,
             estimated_range_km = $2,
             updated_at = NOW()
           WHERE vehicle_id = $3`,
          [fixedMileage, estRange, vehicleId]
        );
      }

      // Update vehicles.metadata safely with tankSize and manualTankCapacity
      await client.query(
        `UPDATE vehicles 
         SET metadata = jsonb_set(
           jsonb_set(COALESCE(metadata, '{}'::jsonb), '{manualTankCapacity}', to_jsonb($1::text), true),
           '{tankSize}', to_jsonb($1::text), true
         )
         WHERE id = $2`,
        [String(tankCapacity), vehicleId]
      );

      await client.query('COMMIT');
      return config;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Get Current Fuel State for a vehicle
   */
  async getVehicleFuelState(vehicleId) {
    const res = await db.query(
      `SELECT vfs.*, vfc.tank_capacity, vfc.fuel_type, vfc.low_fuel_alert_threshold,
              vfc.critical_fuel_alert_threshold, v.plate, v.name as vehicle_name
       FROM vehicle_fuel_states vfs
       JOIN vehicle_fuel_configs vfc ON vfc.vehicle_id = vfs.vehicle_id
       JOIN vehicles v ON v.id = vfs.vehicle_id
       WHERE vfs.vehicle_id = $1`,
      [vehicleId]
    );
    return res.rows[0] || null;
  }

  /**
   * Process a Manual Fuel Entry by driver
   * Types: INITIAL, REFILL, RECONCILIATION
   */
  async addManualFuelEntry(vehicleId, driverUser, entryData) {
    const {
      entryType, // 'INITIAL', 'REFILL', 'RECONCILIATION'
      fuelQuantity, // Tank level after entry (L)
      fuelFilled = 0, // Filled quantity if REFILL (L)
      odometer,
      receiptUrl = null,
      remarks = null,
      entryDate = null,
    } = entryData;

    if (!entryType || !['INITIAL', 'REFILL', 'RECONCILIATION'].includes(entryType)) {
      throw new Error("Invalid entry type. Must be 'INITIAL', 'REFILL', or 'RECONCILIATION'.");
    }

    const config = await this.getVehicleFuelConfig(vehicleId);
    if (!config) {
      throw new Error('Vehicle fuel configuration not found. Please configure vehicle fuel settings first.');
    }

    const tankCap = Number(config.tank_capacity);
    const numFuelQty = Number(fuelQuantity);
    const numFuelFilled = (entryType === 'INITIAL' && (!fuelFilled || Number(fuelFilled) === 0))
      ? numFuelQty
      : Number(fuelFilled || 0);
    const numOdo = Number(odometer);

    if (isNaN(numFuelQty) || numFuelQty < 0) {
      throw new Error('Fuel quantity cannot be negative.');
    }
    if (numFuelQty > tankCap) {
      throw new Error(`Fuel quantity (${numFuelQty} L) cannot exceed vehicle tank capacity (${tankCap} L).`);
    }
    if (isNaN(numOdo) || numOdo < 0) {
      throw new Error('Valid odometer reading is required.');
    }

    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      // Get current fuel state (or baseline)
      const stateRes = await client.query(
        'SELECT * FROM vehicle_fuel_states WHERE vehicle_id = $1 FOR UPDATE',
        [vehicleId]
      );

      let currentState = stateRes.rows[0];
      const prevEstFuel = currentState ? Number(currentState.current_fuel) : Number(config.initial_fuel);
      let newFuel = prevEstFuel;
      let fuelDifference = 0;

      if (entryType === 'INITIAL') {
        newFuel = numFuelQty;
        fuelDifference = 0;
      } else if (entryType === 'REFILL') {
        // Driver refilled fuelFilled litres.
        // If driver provided a fuel level less than fuelFilled, they entered pre-refill fuel!
        if (numFuelQty > 0 && numFuelQty < numFuelFilled) {
          newFuel = Math.min(tankCap, Math.round((numFuelQty + numFuelFilled) * 100) / 100);
          fuelDifference = 0;
        } else if (numFuelQty > 0) {
          newFuel = Math.min(tankCap, numFuelQty);
          fuelDifference = Math.round((numFuelQty - (prevEstFuel + numFuelFilled)) * 100) / 100;
        } else {
          newFuel = Math.min(tankCap, Math.round((prevEstFuel + numFuelFilled) * 100) / 100);
          fuelDifference = 0;
        }
      } else if (entryType === 'RECONCILIATION') {
        // Periodic manual check: reconcile system estimate to actual measured fuel
        newFuel = numFuelQty;
        fuelDifference = Math.round((numFuelQty - prevEstFuel) * 100) / 100;
      }

      // 1. Audit trail: insert into manual_fuel_entries
      const rawDriverId = driverUser?.userId || driverUser?.id || null;
      let driverId = (rawDriverId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawDriverId)) ? rawDriverId : null;
      if (driverId) {
        const userCheck = await client.query('SELECT id FROM users WHERE id = $1', [driverId]);
        if (userCheck.rows.length === 0) {
          driverId = null;
        }
      }

      let entryOrgId = (config.org_id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(config.org_id)) ? config.org_id : null;
      if (entryOrgId) {
        const orgCheck = await client.query('SELECT id FROM organizations WHERE id = $1', [entryOrgId]);
        if (orgCheck.rows.length === 0) {
          entryOrgId = null;
        }
      }

      const customEntryTime = (entryDate && !isNaN(new Date(entryDate).getTime())) ? new Date(entryDate) : new Date();

      const insertEntryRes = await client.query(
        `INSERT INTO manual_fuel_entries
           (vehicle_id, org_id, driver_id, driver_name, entry_type,
            fuel_quantity, fuel_filled, odometer, estimated_fuel_before,
            fuel_difference, receipt_url, remarks, entry_time)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         RETURNING *`,
        [
          vehicleId,
          entryOrgId,
          driverId,
          driverUser?.name || 'Driver / Admin',
          entryType,
          newFuel,
          numFuelFilled,
          numOdo,
          prevEstFuel,
          fuelDifference,
          receiptUrl,
          remarks,
          customEntryTime,
        ]
      );
      const entryRecord = insertEntryRes.rows[0];

      // 2. Mileage learning: calculate actual mileage between consecutive verified entries
      let updatedMileage = Number(config.initial_mileage || (currentState ? currentState.current_mileage : 8.0));

      if (entryType === 'REFILL' || entryType === 'RECONCILIATION') {
        const lastEntryRes = await client.query(
          `SELECT * FROM manual_fuel_entries
           WHERE vehicle_id = $1 AND id != $2
           ORDER BY entry_time DESC LIMIT 1`,
          [vehicleId, entryRecord.id]
        );

        if (lastEntryRes.rows.length > 0) {
          const lastEntry = lastEntryRes.rows[0];
          const distCovered = numOdo - Number(lastEntry.odometer);

          // Formula: Actual Fuel Consumed = (Previous Tank Fuel) + (Fuel Refilled) - (Current Tank Fuel)
          const actualConsumed = Number(lastEntry.fuel_quantity) + numFuelFilled - newFuel;

          if (distCovered > 30 && actualConsumed > 3) {
            const calculatedMileage = Math.round((distCovered / actualConsumed) * 100) / 100;
            // Realistic bounds (2.0 to 35.0 km/l)
            if (calculatedMileage >= 2.0 && calculatedMileage <= 35.0) {
              // Rolling average: 70% current rolling avg + 30% new verified observation
              updatedMileage = Math.round((updatedMileage * 0.7 + calculatedMileage * 0.3) * 100) / 100;

              await client.query(
                `INSERT INTO vehicle_mileage_history
                   (vehicle_id, previous_entry_id, current_entry_id,
                    distance_travelled, actual_fuel_consumed, calculated_mileage,
                    rolling_average_mileage)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [
                  vehicleId,
                  lastEntry.id,
                  entryRecord.id,
                  distCovered,
                  actualConsumed,
                  calculatedMileage,
                  updatedMileage,
                ]
              );
            }
          }
        }
      }

      // 3. Update vehicle_fuel_states
      const estRange = Math.round(newFuel * updatedMileage);
      const status = ManualFuelService.determineFuelStatus(newFuel, config);
      const addedRefill = entryType === 'REFILL' ? numFuelFilled : 0;

      await client.query(
        `INSERT INTO vehicle_fuel_states
           (vehicle_id, current_fuel, current_mileage, total_distance_travelled,
            total_fuel_consumed, total_fuel_refilled, estimated_range_km,
            last_known_odometer, last_refill_date, last_entry_date, fuel_status, updated_at)
         VALUES ($1, $2, $3, 0, 0, $4, $5, $6, $7, NOW(), $8, NOW())
         ON CONFLICT (vehicle_id) DO UPDATE SET
           current_fuel = $2,
           current_mileage = $3,
           total_distance_travelled = CASE WHEN $9 = 'INITIAL' OR $9 = 'REFILL' THEN 0 ELSE vehicle_fuel_states.total_distance_travelled END,
           total_fuel_consumed = CASE WHEN $9 = 'INITIAL' OR $9 = 'REFILL' THEN 0 ELSE vehicle_fuel_states.total_fuel_consumed END,
           total_fuel_refilled = vehicle_fuel_states.total_fuel_refilled + $4,
           estimated_range_km = $5,
           last_known_odometer = $6,
           last_refill_date = CASE WHEN $4 > 0 THEN NOW() ELSE vehicle_fuel_states.last_refill_date END,
           last_entry_date = NOW(),
           fuel_status = $8,
           updated_at = NOW()`,
        [
          vehicleId,
          newFuel,
          updatedMileage,
          addedRefill,
          estRange,
          numOdo,
          addedRefill > 0 ? new Date() : null,
          status,
          entryType,
        ]
      );

      // 3b. Sync vehicle_latest_state.fuel so dashboard & live maps see it immediately
      await client.query(
        `INSERT INTO vehicle_latest_state (vehicle_id, fuel, last_seen)
         VALUES ($1, $2, NOW())
         ON CONFLICT (vehicle_id) DO UPDATE SET fuel = $2`,
        [vehicleId, newFuel]
      );

      await client.query('COMMIT');

      // 4. Publish real-time notification & check for unusual fuel entry alert
      try {
        if (redis) {
          if (Math.abs(fuelDifference) >= 25) {
            await redis.publish('alerts', JSON.stringify({
              vehicleId,
              imei: config.plate,
              alertType: 'unusual_fuel_entry',
              alertText: `Unusual Fuel Entry: Vehicle ${config.plate} has a difference of ${fuelDifference > 0 ? '+' : ''}${fuelDifference.toFixed(1)}L between system estimate (${prevEstFuel}L) and driver measurement (${newFuel}L).`,
              deviceTime: new Date().toISOString(),
            }));
          }

          await redis.publish('manual_fuel_update', JSON.stringify({
            vehicleId,
            current_fuel: newFuel,
            current_mileage: updatedMileage,
            estimated_range_km: estRange,
            fuel_status: status,
            entryType,
          }));
        }
      } catch (notifyErr) {
        console.warn('[MANUAL-FUEL] Alert publishing error:', notifyErr.message);
      }

      return {
        entry: entryRecord,
        newFuelRemaining: newFuel,
        updatedMileage,
        estimatedRangeKm: estRange,
        status,
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Deduct fuel consumption based on incremental GPS distance travelled
   * Called safely from locationSubscriber when vehicle moves
   */
  async deductGpsDistanceFuel(vehicleId, distanceKm, currentOdometer) {
    if (!distanceKm || Number(distanceKm) <= 0.005) return null; // skip sub-5-metre micro-drift

    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      const stateRes = await client.query(
        `SELECT vfs.*, vfc.tank_capacity, vfc.low_fuel_alert_threshold,
                vfc.critical_fuel_alert_threshold, v.plate, v.name as vehicle_name
         FROM vehicle_fuel_states vfs
         JOIN vehicle_fuel_configs vfc ON vfc.vehicle_id = vfs.vehicle_id
         JOIN vehicles v ON v.id = vfs.vehicle_id
         WHERE vfs.vehicle_id = $1 FOR UPDATE`,
        [vehicleId]
      );

      if (stateRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return null;
      }

      const state = stateRes.rows[0];
      const mileage = Number(state.current_mileage || 8.0);
      const fuelBefore = Number(state.current_fuel);
      const dist = Number(distanceKm);

      // Fuel Consumed = Distance Travelled / Average Mileage
      const fuelConsumed = Math.round((dist / mileage) * 10000) / 10000;
      const fuelAfter = Math.max(0, Math.round((fuelBefore - fuelConsumed) * 10000) / 10000);
      const estRange = Math.round(fuelAfter * mileage);
      const status = ManualFuelService.determineFuelStatus(fuelAfter, state);

      // 1. Update fuel state
      await client.query(
        `UPDATE vehicle_fuel_states SET
           current_fuel = $1,
           total_distance_travelled = total_distance_travelled + $2,
           total_fuel_consumed = total_fuel_consumed + $3,
           estimated_range_km = $4,
           last_known_odometer = COALESCE($5, last_known_odometer),
           fuel_status = $6,
           updated_at = NOW()
         WHERE vehicle_id = $7`,
        [fuelAfter, dist, fuelConsumed, estRange, currentOdometer || null, status, vehicleId]
      );

      // 1b. Sync vehicle_latest_state.fuel
      await client.query(
        `UPDATE vehicle_latest_state SET fuel = $1 WHERE vehicle_id = $2`,
        [fuelAfter, vehicleId]
      );

      // 2. Log consumption transaction
      await client.query(
        `INSERT INTO fuel_consumption_logs
           (vehicle_id, distance_km, mileage_applied, fuel_consumed,
            fuel_before, fuel_after, end_odometer)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [vehicleId, dist, mileage, fuelConsumed, fuelBefore, fuelAfter, currentOdometer || null]
      );

      await client.query('COMMIT');

      // 3. Configurable Alerts with Redis Throttle Cooldown (6 hours = 21600 seconds)
      if (redis) {
        const vehName = state.vehicle_name || state.plate || 'Vehicle';
        const lowThresh = Number(state.low_fuel_alert_threshold ?? 15);
        const critThresh = Number(state.critical_fuel_alert_threshold ?? 8);

        // Critical Fuel Alert
        if (fuelAfter <= critThresh) {
          const critKey = `fuel:crit_alert_throttle:${vehicleId}`;
          const alreadySent = await redis.get(critKey);
          if (!alreadySent) {
            await redis.set(critKey, '1', 'EX', 21600);
            await redis.publish('alerts', JSON.stringify({
              vehicleId,
              imei: state.plate,
              alertType: 'critical_fuel',
              alertText: `Critical Fuel Alert: Estimated fuel for ${vehName} is critically low at ${fuelAfter.toFixed(1)}L. Refill immediately. [ESTIMATED VALUE]`,
              deviceTime: new Date().toISOString(),
            }));
          }
        }
        // Low Fuel Alert
        else if (fuelAfter <= lowThresh) {
          const lowKey = `fuel:low_alert_throttle:${vehicleId}`;
          const alreadySent = await redis.get(lowKey);
          if (!alreadySent) {
            await redis.set(lowKey, '1', 'EX', 21600);
            await redis.publish('alerts', JSON.stringify({
              vehicleId,
              imei: state.plate,
              alertType: 'low_fuel',
              alertText: `Low Fuel Alert: Estimated fuel for ${vehName} is low at ${fuelAfter.toFixed(1)}L (Range: ${estRange} km). [ESTIMATED VALUE]`,
              deviceTime: new Date().toISOString(),
            }));
          }
        }

        // Low Range Alert (< 50 km)
        if (estRange <= 50 && estRange > 0 && fuelAfter > critThresh) {
          const rangeKey = `fuel:range_alert_throttle:${vehicleId}`;
          const alreadySent = await redis.get(rangeKey);
          if (!alreadySent) {
            await redis.set(rangeKey, '1', 'EX', 21600);
            await redis.publish('alerts', JSON.stringify({
              vehicleId,
              imei: state.plate,
              alertType: 'low_range',
              alertText: `Low Range Alert: Estimated range for ${vehName} has dropped to ${estRange} km. [ESTIMATED VALUE]`,
              deviceTime: new Date().toISOString(),
            }));
          }
        }
      }

      return {
        vehicleId,
        fuelBefore,
        fuelAfter,
        fuelConsumed,
        distanceKm: dist,
        estimatedRangeKm: estRange,
        status,
      };
    } catch (err) {
      await client.query('ROLLBACK');
      console.warn(`[MANUAL-FUEL] Error deducting fuel for vehicle ${vehicleId}:`, err.message);
      return null;
    } finally {
      client.release();
    }
  }

  /**
   * Get Fuel Entries History for a vehicle
   */
  async getFuelEntries(vehicleId, options = {}) {
    const { page = 1, limit = 50, entryType } = options;
    const offset = (page - 1) * limit;
    const params = [vehicleId, limit, offset];
    let typeClause = '';
    if (entryType) {
      params.push(entryType);
      typeClause = `AND entry_type = $${params.length}`;
    }

    const res = await db.query(
      `SELECT * FROM manual_fuel_entries
       WHERE vehicle_id = $1 ${typeClause}
       ORDER BY entry_time DESC
       LIMIT $2 OFFSET $3`,
      params
    );

    const countRes = await db.query(
      `SELECT COUNT(*) FROM manual_fuel_entries WHERE vehicle_id = $1 ${typeClause}`,
      typeClause ? [vehicleId, entryType] : [vehicleId]
    );

    return {
      entries: res.rows,
      total: parseInt(countRes.rows[0]?.count || 0),
      page: Number(page),
      limit: Number(limit),
    };
  }

  /**
   * Get Fuel Trend & Mileage Graph data for a vehicle
   */
  async getFuelChartData(vehicleId, options = '30d') {
    let range = null;
    let startDate = null;
    let endDate = null;

    if (typeof options === 'string') {
      range = options;
    } else if (options && typeof options === 'object') {
      range = options.range;
      startDate = options.startDate || options.from;
      endDate = options.endDate || options.to;
    }

    const config = await this.getVehicleFuelConfig(vehicleId);
    const state = await this.getVehicleFuelState(vehicleId);

    let startIso = null;
    let endIso = null;
    if (startDate) {
      const s = new Date(startDate);
      if (!isNaN(s.getTime())) startIso = s.toISOString();
    }
    if (endDate) {
      const e = new Date(endDate);
      if (!isNaN(e.getTime())) endIso = e.toISOString();
    }

    let intervalClause = '';
    const queryParams = [vehicleId];

    if (startIso && endIso) {
      queryParams.push(startIso, endIso);
      intervalClause = `AND entry_time >= $2 AND entry_time <= $3`;
    } else if (startIso) {
      queryParams.push(startIso);
      intervalClause = `AND entry_time >= $2`;
    } else if (range === '7d') {
      intervalClause = "AND entry_time >= NOW() - INTERVAL '7 days'";
    } else if (range === '90d') {
      intervalClause = "AND entry_time >= NOW() - INTERVAL '90 days'";
    } else {
      intervalClause = "AND entry_time >= NOW() - INTERVAL '30 days'";
    }

    const entriesRes = await db.query(
      `SELECT * FROM manual_fuel_entries
       WHERE vehicle_id = $1 ${intervalClause}
       ORDER BY entry_time ASC`,
      queryParams
    );

    // Baseline entry prior to the window (if custom start date is specified)
    let baselineEntry = null;
    if (startIso) {
      const priorRes = await db.query(
        `SELECT * FROM manual_fuel_entries
         WHERE vehicle_id = $1 AND entry_time < $2
         ORDER BY entry_time DESC LIMIT 1`,
        [vehicleId, startIso]
      );
      if (priorRes.rows.length > 0) {
        baselineEntry = priorRes.rows[0];
      }
    }

    // Query GPS consumption logs for the selected window
    let logsClause = '';
    const logsParams = [vehicleId];
    if (startIso && endIso) {
      logsParams.push(startIso, endIso);
      logsClause = `AND created_at >= $2 AND created_at <= $3`;
    } else if (startIso) {
      logsParams.push(startIso);
      logsClause = `AND created_at >= $2`;
    } else if (range === '7d') {
      logsClause = "AND created_at >= NOW() - INTERVAL '7 days'";
    } else if (range === '90d') {
      logsClause = "AND created_at >= NOW() - INTERVAL '90 days'";
    } else {
      logsClause = "AND created_at >= NOW() - INTERVAL '30 days'";
    }

    const logsRes = await db.query(
      `SELECT distance_km, fuel_consumed, fuel_before, fuel_after, end_odometer, created_at
       FROM fuel_consumption_logs
       WHERE vehicle_id = $1 ${logsClause}
       ORDER BY created_at ASC`,
      logsParams
    );

    // Query fuel theft alerts for the selected window
    let alertsClause = '';
    const alertsParams = [vehicleId];
    if (startIso && endIso) {
      alertsParams.push(startIso, endIso);
      alertsClause = `AND server_time >= $2 AND server_time <= $3`;
    } else if (startIso) {
      alertsParams.push(startIso);
      alertsClause = `AND server_time >= $2`;
    } else if (range === '7d') {
      alertsClause = "AND server_time >= NOW() - INTERVAL '7 days'";
    } else if (range === '90d') {
      alertsClause = "AND server_time >= NOW() - INTERVAL '90 days'";
    } else {
      alertsClause = "AND server_time >= NOW() - INTERVAL '30 days'";
    }

    let alertsRes = { rows: [] };
    try {
      alertsRes = await db.query(
        `SELECT id, alert_type, alert_text, server_time
         FROM alerts
         WHERE vehicle_id = $1 AND alert_type IN ('fuel_theft', 'theft') ${alertsClause}
         ORDER BY server_time ASC`,
        alertsParams
      );
    } catch (alertErr) {
      // alerts table optional fallback
    }

    const mileageRes = await db.query(
      `SELECT * FROM vehicle_mileage_history
       WHERE vehicle_id = $1
       ORDER BY created_at ASC`,
      [vehicleId]
    );

    const timeline = [];
    const refillEvents = [];
    const theftEvents = [];

    // Prepend baseline entry if earlier than first entry in range
    if (baselineEntry && (entriesRes.rows.length === 0 || new Date(entriesRes.rows[0].entry_time).getTime() > new Date(startIso).getTime())) {
      const d = new Date(baselineEntry.entry_time);
      timeline.push({
        timestamp: baselineEntry.entry_time,
        date: isNaN(d.getTime()) ? 'Baseline' : d.toLocaleDateString('en-IN', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
        fuelLevel: Number(baselineEntry.fuel_quantity),
        fuelFilled: Number(baselineEntry.fuel_filled || 0),
        odometer: Number(baselineEntry.odometer || 0),
        entryType: baselineEntry.entry_type,
        remarks: 'Baseline before selected range',
        driverName: baselineEntry.driver_name || 'Driver',
        isRefill: false,
        isTheft: false,
        isInitial: baselineEntry.entry_type === 'INITIAL',
      });
    }

    // Add manual refill, level check & audit entries
    entriesRes.rows.forEach((e) => {
      const d = new Date(e.entry_time);
      const isRefill = e.entry_type === 'REFILL';
      const isTheft = (e.entry_type === 'LEVEL_CHECK' || e.entry_type === 'RECONCILIATION') && Number(e.fuel_difference || 0) <= -2;
      const timeFormatted = isNaN(d.getTime()) ? 'Entry' : d.toLocaleDateString('en-IN', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

      if (isRefill) {
        let fuelBefore = Number(e.estimated_fuel_before || 0);
        let fuelAfter = Number(e.fuel_quantity || 0);
        const refilled = Number(e.fuel_filled || 0);

        // Recalculate if fuelAfter <= refilled (anomaly where pre-refill fuel was recorded)
        if (fuelAfter <= refilled) {
          fuelAfter = Math.min(config ? Number(config.tank_capacity) : 100, fuelBefore + refilled);
        }

        refillEvents.push({
          time: e.entry_time,
          formattedTime: timeFormatted,
          liters: refilled,
          fuelBefore: fuelBefore,
          fuelAfter: fuelAfter,
          driverName: e.driver_name || 'Driver',
          remarks: e.remarks || 'Fuel Refill Entry'
        });

        // 1. Point immediately prior to refill (shows baseline before pump)
        const preTime = new Date(d.getTime() - 2000);
        timeline.push({
          timestamp: preTime.toISOString(),
          date: timeFormatted,
          fuelLevel: fuelBefore,
          fuelFilled: 0,
          odometer: Number(e.odometer || 0),
          entryType: 'PRE_REFILL',
          remarks: 'Before Refill',
          driverName: e.driver_name || 'Driver',
          isRefill: false,
          isTheft: false,
          isInitial: false,
        });

        // 2. Refill peak point (shows the jump from +L fuel)
        timeline.push({
          timestamp: e.entry_time,
          date: timeFormatted,
          fuelLevel: fuelAfter,
          fuelFilled: refilled,
          odometer: Number(e.odometer || 0),
          entryType: e.entry_type,
          remarks: e.remarks || '',
          driverName: e.driver_name || 'Driver',
          isRefill: true,
          refillLiters: refilled,
          refillEvent: {
            liters: refilled,
            startTime: timeFormatted,
            startFuel: fuelBefore,
            endFuel: fuelAfter,
            driverName: e.driver_name || 'Driver',
            remarks: e.remarks || 'Fuel Refill Entry'
          },
          isTheft: false,
          isInitial: false,
        });
        return;
      }

      if (isTheft) {
        const drop = Math.abs(Number(e.fuel_difference || 0));
        theftEvents.push({
          time: e.entry_time,
          formattedTime: timeFormatted,
          liters: drop,
          fuelBefore: Number(e.estimated_fuel_before || 0),
          fuelAfter: Number(e.fuel_quantity || 0),
          driverName: e.driver_name || 'Driver',
          remarks: e.remarks || 'Unaccounted fuel drop during level check'
        });
      }

      timeline.push({
        timestamp: e.entry_time,
        date: timeFormatted,
        fuelLevel: Number(e.fuel_quantity),
        fuelFilled: Number(e.fuel_filled || 0),
        odometer: Number(e.odometer || 0),
        entryType: e.entry_type,
        remarks: e.remarks || '',
        driverName: e.driver_name || 'Driver',
        isRefill: false,
        refillLiters: 0,
        refillEvent: null,
        isTheft,
        theftLiters: isTheft ? Math.abs(Number(e.fuel_difference || 0)) : 0,
        theftEvent: isTheft ? {
          liters: Math.abs(Number(e.fuel_difference || 0)),
          startTime: timeFormatted,
          startFuel: Number(e.estimated_fuel_before || 0),
          endFuel: Number(e.fuel_quantity || 0),
          driverName: e.driver_name || 'Driver',
          remarks: e.remarks || 'Unaccounted fuel drop during level check'
        } : null,
        isInitial: e.entry_type === 'INITIAL',
      });
    });

    // Add alert records if any
    alertsRes.rows.forEach(a => {
      const d = new Date(a.server_time);
      const timeFormatted = isNaN(d.getTime()) ? 'Alert' : d.toLocaleDateString('en-IN', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
      const dropLiters = 5.0;
      theftEvents.push({
        time: a.server_time,
        formattedTime: timeFormatted,
        liters: dropLiters,
        fuelBefore: 0,
        fuelAfter: 0,
        remarks: a.alert_text || 'Fuel Theft Alert'
      });
      timeline.push({
        timestamp: a.server_time,
        date: timeFormatted,
        fuelLevel: 0,
        fuelFilled: 0,
        odometer: 0,
        entryType: 'THEFT_ALERT',
        remarks: a.alert_text || 'Theft Alert',
        driverName: 'Security Siren',
        isRefill: false,
        isTheft: true,
        theftLiters: dropLiters,
        theftEvent: {
          liters: dropLiters,
          startTime: timeFormatted,
          startFuel: 0,
          endFuel: 0,
          remarks: a.alert_text || 'Stationary fuel theft alert'
        },
        isInitial: false,
      });
    });

    // Sample GPS consumption logs (max 100 points for smooth Recharts rendering)
    const logs = logsRes.rows;
    if (logs.length > 0) {
      const maxSample = 100;
      const step = logs.length > maxSample ? Math.ceil(logs.length / maxSample) : 1;
      for (let i = 0; i < logs.length; i += step) {
        const l = logs[i];
        const d = new Date(l.created_at);
        timeline.push({
          timestamp: l.created_at,
          date: isNaN(d.getTime()) ? 'GPS' : d.toLocaleDateString('en-IN', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          }),
          fuelLevel: Math.round(Number(l.fuel_after) * 10) / 10,
          fuelFilled: 0,
          odometer: Number(l.end_odometer || 0),
          entryType: 'GPS_DEPLETION',
          remarks: `GPS Move: -${Number(l.fuel_consumed).toFixed(2)}L (${Number(l.distance_km).toFixed(1)} km)`,
          driverName: 'GPS Telemetry',
          isRefill: false,
          isTheft: false,
          isInitial: false,
        });
      }
    }

    // Add current live estimate if window includes now
    const now = new Date();
    const isWindowLive = !endIso || new Date(endIso).getTime() >= (now.getTime() - 15 * 60 * 1000);
    if (state && isWindowLive) {
      const curFuel = Number(state.current_fuel);
      timeline.push({
        timestamp: now.toISOString(),
        date: 'Now (Live)',
        fuelLevel: Math.round(curFuel * 10) / 10,
        fuelFilled: 0,
        odometer: Number(state.last_known_odometer || 0),
        entryType: 'CURRENT_ESTIMATE',
        remarks: 'Live Telemetry Estimate',
        driverName: 'System GPS',
        isRefill: false,
        isTheft: false,
        isInitial: false,
      });
    }

    // Sort timeline chronologically
    timeline.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    // Window aggregations
    const windowDistance = logs.reduce((sum, r) => sum + Number(r.distance_km || 0), 0);
    const windowFuelConsumed = logs.reduce((sum, r) => sum + Number(r.fuel_consumed || 0), 0);
    const totalRefillLiters = refillEvents.reduce((acc, r) => acc + (r.liters || 0), 0);
    const totalTheftLiters = theftEvents.reduce((acc, t) => acc + (t.liters || 0), 0);

    return {
      vehicleId,
      tankCapacity: config ? Number(config.tank_capacity) : 100,
      lowFuelThreshold: config ? Number(config.low_fuel_alert_threshold || 15) : 15,
      criticalThreshold: config ? Number(config.critical_fuel_alert_threshold || 8) : 8,
      currentFuel: state ? Number(state.current_fuel) : 0,
      currentMileage: state ? Number(state.current_mileage) : (config ? Number(config.initial_mileage) : 4.5),
      totalDistance: Math.round((windowDistance > 0 ? windowDistance : (state ? Number(state.total_distance_travelled) : 0)) * 10) / 10,
      totalFuelConsumed: Math.round((windowFuelConsumed > 0 ? windowFuelConsumed : (state ? Number(state.total_fuel_consumed) : 0)) * 10) / 10,
      totalFuelRefilled: Math.round(totalRefillLiters * 10) / 10,
      refillCount: refillEvents.length,
      refills: refillEvents,
      totalFuelTheft: Math.round(totalTheftLiters * 10) / 10,
      theftCount: theftEvents.length,
      thefts: theftEvents,
      timeline,
      mileageHistory: mileageRes.rows.map(m => ({
        date: new Date(m.created_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
        calculatedMileage: Number(m.calculated_mileage),
        rollingAverage: Number(m.rolling_average_mileage),
        distance: Number(m.distance_travelled),
        fuelConsumed: Number(m.actual_fuel_consumed),
      })),
    };
  }

  /**
   * Fleet Fuel Overview Dashboard Summary
   */
  async getFleetFuelOverview(orgId, role, userId) {
    let whereClause = 'v.is_active = TRUE';
    const params = [];

    if (role === 'customer' && userId) {
      params.push(userId);
      whereClause += ` AND v.id IN (
        SELECT vg.vehicle_id 
        FROM vehicle_groups vg
        JOIN user_groups ug ON vg.group_id = ug.group_id
        WHERE ug.user_id = $${params.length}
      )`;
    } else if (role !== 'superadmin' && orgId) {
      params.push(orgId);
      whereClause += ` AND (o.id = $${params.length} OR o.parent_id = $${params.length})`;
    }

    const query = `
      SELECT
        v.id as vehicle_id,
        v.plate,
        COALESCE(v.name, v.plate) as vehicle_name,
        v.category,
        vfc.tank_capacity,
        vfc.fuel_type,
        vfc.initial_mileage,
        vfc.low_fuel_alert_threshold,
        vfc.critical_fuel_alert_threshold,
        vfs.current_fuel,
        vfs.current_mileage,
        vfs.total_distance_travelled,
        vfs.total_fuel_consumed,
        vfs.total_fuel_refilled,
        vfs.estimated_range_km,
        vfs.last_known_odometer,
        vfs.last_refill_date,
        vfs.last_entry_date,
        COALESCE(vfs.fuel_status, 'No Fuel Data') as fuel_status,
        mfe.fuel_difference as last_reconciliation_difference
      FROM vehicles v
      JOIN organizations o ON v.org_id = o.id
      LEFT JOIN vehicle_fuel_configs vfc ON vfc.vehicle_id = v.id
      LEFT JOIN vehicle_fuel_states vfs ON vfs.vehicle_id = v.id
      LEFT JOIN LATERAL (
        SELECT fuel_difference FROM manual_fuel_entries
        WHERE vehicle_id = v.id
        ORDER BY entry_time DESC LIMIT 1
      ) mfe ON true
      WHERE ${whereClause}
      ORDER BY v.name ASC
    `;

    const res = await db.query(query, params);
    return res.rows;
  }
}

module.exports = new ManualFuelService();
