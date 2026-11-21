/**
 * Fuel Filter & Telematics Processing Engine
 * 
 * Provides 100% mathematical parity with the Fuel Analytics Chart:
 * 1. Sensor ADC/BLE Calibration (Auto, Manual, Direct).
 * 2. Speed-Adaptive Anti-Slosh Filter (Window 5 Median + Conditional EMA).
 * 3. Physical Reality Normalization (Ramp Refuel & Theft Window Verification).
 * 4. Mileage (km/L) & Engine Burn (L/h) calculation.
 */

'use strict';

/**
 * Haversine formula for calculating distance in kilometers between two GPS coordinates
 */
function haversine(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calibrates raw fuel sensor reading into Litres according to vehicle metadata
 */
function calibrateFuelValue(rawFuel, pointDeviceTime, vehicle) {
  if (rawFuel == null || isNaN(rawFuel)) return null;
  const num = parseFloat(rawFuel);
  if (isNaN(num)) return null;

  // Disconnect & Open-Circuit Guard:
  // BLE offline sends 32767 (0x7FFF), open-circuit analog sends 0 or near 0.
  if (num <= 0 || num === 32767 || num === 0x7FFF) return null;

  const meta = vehicle?.metadata || {};
  const tankCapacity = parseFloat(meta.tankSize) || 200;
  const cal = meta.fuelCalibration || meta.fuel || {};
  const calUpdatedAt = cal.updatedAt ? new Date(cal.updatedAt).getTime() : 0;
  const ptTime = pointDeviceTime ? new Date(pointDeviceTime).getTime() : 0;

  const points = cal.calibrationPoints || cal.tanks?.['1']?.calibrationPoints || cal.tanks?.tank1?.calibrationPoints || [];
  let minCalibratedLtr = 0;
  let minCalibratedAdc = 0;
  let sortedPoints = [];
  if (Array.isArray(points) && points.length >= 2) {
    sortedPoints = points
      .map(p => ({
        adc: parseFloat(p.adcValue !== undefined ? p.adcValue : (p.frequency !== undefined ? p.frequency : p.volt)),
        ltr: parseFloat(p.litres)
      }))
      .filter(p => !isNaN(p.adc) && !isNaN(p.ltr))
      .sort((a, b) => a.adc - b.adc);

    if (sortedPoints.length >= 2) {
      minCalibratedLtr = sortedPoints[0].ltr;
      minCalibratedAdc = sortedPoints[0].adc;
    }
  }

  // Open-Circuit / Disconnected Sensor Floor:
  // If the lowest calibration point is at ground / 0 ADC (<= 20 ADC), receiving num <= minCalibratedLtr
  // represents an open circuit / unplugged probe (0 Volts), NOT real fuel!
  if (minCalibratedLtr > 0 && minCalibratedAdc <= 20 && num <= minCalibratedLtr) {
    return null;
  }

  // If point was recorded after calibration was configured AND is within reasonable tank limits,
  // it was already calibrated by the ingestion pipeline.
  const isAfterCalibration = calUpdatedAt > 0 && ptTime >= calUpdatedAt;
  if (isAfterCalibration && num <= tankCapacity * 1.15) {
    return Math.round(num * 10) / 10;
  }

  const sCalType = cal.calibrateType || 'Auto';

  // 1. Direct Calibration (Technoton / Jointech / BLE direct)
  if (sCalType === 'Direct') {
    const mult = parseFloat(cal.directMultiplier ?? 1.0) || 1.0;
    const offset = parseFloat(cal.directOffset ?? 0.0) || 0.0;
    const unit = cal.directUnit || 'Litres';
    const scaled = (num * mult) + offset;
    if (unit === 'Percentage' && tankCapacity > 0) {
      return Math.max(0, Math.min(tankCapacity, Math.round(((scaled / 100) * tankCapacity) * 10) / 10));
    }
    return Math.max(0, tankCapacity > 0 ? Math.min(tankCapacity, Math.round(scaled * 10) / 10) : Math.round(scaled * 10) / 10);
  }

  // 2. Manual Calibration (Points table)
  if (sortedPoints.length >= 2) {
    if (sortedPoints[0].adc > 50 && num < sortedPoints[0].adc * 0.4) {
      return null;
    }
    if (isAfterCalibration && num <= sortedPoints[sortedPoints.length - 1].ltr * 1.1) {
      return Math.round(num * 10) / 10;
    }
    if (num <= sortedPoints[0].adc) return sortedPoints[0].ltr;
    if (num >= sortedPoints[sortedPoints.length - 1].adc) return sortedPoints[sortedPoints.length - 1].ltr;

    for (let i = 0; i < sortedPoints.length - 1; i++) {
      const p1 = sortedPoints[i];
      const p2 = sortedPoints[i + 1];
      if (num >= p1.adc && num <= p2.adc) {
        const range = p2.adc - p1.adc;
        const ratio = range !== 0 ? (num - p1.adc) / range : 0;
        const val = p1.ltr + ratio * (p2.ltr - p1.ltr);
        return Math.max(0, Math.min(tankCapacity, Math.round(val * 10) / 10));
      }
    }
  }

  // 3. Auto Calibration (minAdc -> maxAdc)
  const emptyAdc = parseFloat(cal.minAdc ?? meta.fuelEmptyAdc ?? 0);
  const fullAdc = parseFloat(cal.maxAdc ?? meta.fuelFullAdc ?? 4095);
  if (tankCapacity > 0 && fullAdc !== emptyAdc && !isNaN(emptyAdc) && !isNaN(fullAdc)) {
    if (emptyAdc > 50 && num < emptyAdc * 0.4) {
      return null;
    }
    if (num > tankCapacity * 1.15 || !isAfterCalibration) {
      let frac = (num - emptyAdc) / (fullAdc - emptyAdc);
      frac = Math.max(0, Math.min(1, frac));
      return Math.round((tankCapacity * frac) * 10) / 10;
    }
  }

  // Fallback
  if (num > 1000) return Math.round((num / 10) * 10) / 10;
  return Math.max(0, Math.min(tankCapacity, Math.round(num * 10) / 10));
}

/**
 * Processes a sequence of GPS points for a vehicle and extracts exact Filtered Fuel metrics
 * 
 * @param {Array} points - Array of GPS points { device_time, fuel, speed, ignition, lat, lng, odometer }
 * @param {Object} vehicle - Vehicle object with metadata
 * @returns {Object} Comprehensive filtered fuel metrics matching Fuel Analytics Chart
 */
function processVehicleFuelHistory(points, vehicle) {
  if (!Array.isArray(points) || points.length === 0) {
    return {
      start_fuel: null,
      end_fuel: null,
      total_refill: 0,
      total_theft: 0,
      consumption: 0,
      distance_travelled: 0,
      kmpl: null,
      lph: null,
      running_seconds: 0,
      idle_seconds: 0,
      stopped_seconds: 0,
      engine_on_seconds: 0,
      max_speed: 0,
      avg_speed: 0,
      refuels: [],
      thefts: [],
      start_lat: null,
      start_lng: null,
      end_lat: null,
      end_lng: null,
      refill_location: null
    };
  }

  const meta = vehicle?.metadata || {};
  const tankCapacity = parseFloat(meta.tankSize) || 200;
  const fuelCfg = meta.fuelConfig || {};
  const cal = meta.fuelCalibration || meta.fuel || {};
  const calPoints = cal.calibrationPoints || cal.tanks?.['1']?.calibrationPoints || cal.tanks?.tank1?.calibrationPoints || [];
  let minCalibratedLtr = 0;
  if (Array.isArray(calPoints) && calPoints.length >= 2) {
    const sp = calPoints
      .map(p => ({
        adc: parseFloat(p.adcValue !== undefined ? p.adcValue : (p.frequency !== undefined ? p.frequency : p.volt)),
        ltr: parseFloat(p.litres)
      }))
      .filter(p => !isNaN(p.adc) && !isNaN(p.ltr))
      .sort((a, b) => a.adc - b.adc);
    if (sp.length >= 2) {
      minCalibratedLtr = sp[0].ltr;
    }
  }

  // Configured thresholds: strictly enforce 5.0L minimum
  const configuredMinRefill = parseFloat(fuelCfg.minFilling);
  const refuelThreshold = (!isNaN(configuredMinRefill) && configuredMinRefill > 0)
    ? Math.max(5.0, configuredMinRefill)
    : Math.max(5.0, Math.min(30.0, tankCapacity * 0.05));

  const configuredMinTheft = parseFloat(fuelCfg.minTheft);
  const theftThreshold = (!isNaN(configuredMinTheft) && configuredMinTheft > 0)
    ? Math.max(5.0, configuredMinTheft)
    : Math.max(5.0, Math.min(25.0, tankCapacity * 0.04));

  // Sort chronologically
  const sorted = [...points].sort((a, b) => new Date(a.device_time) - new Date(b.device_time));

  // 1. Raw Fuel Calibration
  const rawFuels = sorted.map(pt => pt.fuel != null ? calibrateFuelValue(pt.fuel, pt.device_time, vehicle) : null);

  // 2. Speed-Adaptive Anti-Slosh Filter: Window 5 Median + Conditional EMA -> "Filtered Fuel"
  const filteredFuels = new Array(sorted.length).fill(null);
  let lastEma = null;

  // Seed lastEma with first valid non-null fuel point in dataset above calibration floor
  const firstValidRaw = rawFuels.find(f => f != null && f > (minCalibratedLtr || 0));
  if (firstValidRaw != null) {
    lastEma = firstValidRaw;
  }

  for (let i = 0; i < sorted.length; i++) {
    const windowVals = [];
    for (let w = Math.max(0, i - 2); w <= Math.min(sorted.length - 1, i + 2); w++) {
      if (rawFuels[w] != null) windowVals.push(rawFuels[w]);
    }
    if (windowVals.length > 0) {
      windowVals.sort((a, b) => a - b);
      const median = windowVals[Math.floor(windowVals.length / 2)];
      const spd = parseFloat(sorted[i]?.speed) || 0;

      if (lastEma == null) {
        lastEma = median;
      } else if (spd <= 6.0) {
        // Stationary at bunk or parked: no road slosh waves.
        // Disconnect cliff drop guard:
        // A stationary vehicle CANNOT drop > 35% of tank capacity in one step straight down to the calibration floor (<= minCalibratedLtr + 5).
        // If median suddenly collapses while previous fuel was high, it is a disconnected sensor! Hold lastEma!
        const isSuddenCollapse = (lastEma - median) > (tankCapacity * 0.35) && median <= (minCalibratedLtr + 5);
        if (isSuddenCollapse) {
          // Sensor disconnect artifact: hold lastEma
        } else if (Math.abs(median - lastEma) >= 3.0) {
          lastEma = median;
        } else {
          lastEma = (0.5 * median) + (0.5 * lastEma);
        }
      } else {
        // Moving on road: heavy EMA filter rejects highway liquid slosh ripples
        lastEma = (0.25 * median) + (0.75 * lastEma);
      }
      filteredFuels[i] = Math.max(0, Math.min(tankCapacity, Math.round(lastEma * 10) / 10));
    } else {
      filteredFuels[i] = lastEma;
    }
  }

  // 3. Physical Reality Normalization (Ramp Refuel & Theft Window Verification)
  const normalizedFuels = new Array(sorted.length).fill(null);
  const refuelEvents = [];
  const dropEvents = [];

  const firstValidFiltered = filteredFuels.find(f => f != null);
  let currentNormalized = firstValidFiltered != null ? firstValidFiltered : 0;

  // Pre-compute ignition-state transition pairs for slant-parking theft detection
  const PRE_POST_WINDOW = 5 * 60 * 1000;
  const ignOffTransitionFuel = new Map();
  const ignOnTransitionFuel = new Map();

  for (let i = 1; i < sorted.length; i++) {
    const prevIgnOn = sorted[i - 1].ignition === true || sorted[i - 1].ignition === 'true' || sorted[i - 1].ignition === 1;
    const currIgnOn = sorted[i].ignition === true || sorted[i].ignition === 'true' || sorted[i].ignition === 1;
    const tCurr = new Date(sorted[i].device_time).getTime();

    if (prevIgnOn && !currIgnOn) {
      const preFuels = [];
      for (let j = i - 1; j >= 0; j--) {
        const tJ = new Date(sorted[j].device_time).getTime();
        if (tCurr - tJ > PRE_POST_WINDOW) break;
        if (filteredFuels[j] != null) preFuels.push(filteredFuels[j]);
      }
      if (preFuels.length > 0) {
        ignOffTransitionFuel.set(i, preFuels.reduce((s, v) => s + v, 0) / preFuels.length);
      }
    }

    if (!prevIgnOn && currIgnOn) {
      const postFuels = [];
      for (let j = i; j < sorted.length; j++) {
        const tJ = new Date(sorted[j].device_time).getTime();
        if (tJ - tCurr > PRE_POST_WINDOW) break;
        if (filteredFuels[j] != null) postFuels.push(filteredFuels[j]);
      }
      if (postFuels.length > 0) {
        ignOnTransitionFuel.set(i, postFuels.reduce((s, v) => s + v, 0) / postFuels.length);
      }
    }
  }

  const offToOnPairs = [];
  const offIdxs = Array.from(ignOffTransitionFuel.keys()).sort((a, b) => a - b);
  const onIdxs = Array.from(ignOnTransitionFuel.keys()).sort((a, b) => a - b);
  for (const offIdx of offIdxs) {
    const nextOnIdx = onIdxs.find(idx => idx > offIdx);
    if (nextOnIdx !== undefined) {
      offToOnPairs.push({
        offIdx,
        onIdx: nextOnIdx,
        preFuel: ignOffTransitionFuel.get(offIdx),
        postFuel: ignOnTransitionFuel.get(nextOnIdx)
      });
    }
  }

  const confirmedTheftWindows = new Set();
  for (const pair of offToOnPairs) {
    if (pair.preFuel - pair.postFuel >= theftThreshold) {
      confirmedTheftWindows.add(pair.offIdx);
    }
  }

  let cumulativeDist = 0;
  let maxSpd = 0;
  let sumSpd = 0;
  let speedSamples = 0;
  let runningSec = 0;
  let idleSec = 0;
  let stoppedSec = 0;
  let engineOnSec = 0;

  for (let i = 0; i < sorted.length; i++) {
    const pt = sorted[i];
    const rawSpeed = parseFloat(pt.speed) || 0;
    const ign = pt.ignition === true || pt.ignition === 'true' || pt.ignition === 1;
    const fVal = filteredFuels[i];

    if (fVal != null) {
      const diff = fVal - currentNormalized;
      let rampHandled = false;

      // Refuel detection
      if (rawSpeed <= 6.0 && diff >= 2.0) {
        const tStart = new Date(pt.device_time).getTime();
        let maxRampVal = fVal;
        let maxRampIdx = i;
        let k = i + 1;

        while (k < sorted.length) {
          const nextPt = sorted[k];
          const nextSpd = parseFloat(nextPt.speed) || 0;
          const nextTime = new Date(nextPt.device_time).getTime();

          if ((nextTime - tStart) > 25 * 60 * 1000) break;
          if (nextSpd > 6.0) break;

          const nextF = filteredFuels[k];
          if (nextF != null && nextF > maxRampVal) {
            maxRampVal = nextF;
            maxRampIdx = k;
          }
          k++;
        }

        const cumRise = maxRampVal - currentNormalized;
        const tEnd = new Date(sorted[maxRampIdx].device_time).getTime();
        const fillDurationMs = tEnd - tStart;

        // Sustained rise check
        if (cumRise >= refuelThreshold && maxRampIdx > i && fillDurationMs >= 45 * 1000) {
          let isStable = true;
          let stableChecks = 0;
          for (let s = maxRampIdx + 1; s < sorted.length && stableChecks < 5; s++) {
            const sf = filteredFuels[s];
            if (sf == null) continue;
            if (sf < currentNormalized + (cumRise * 0.5)) {
              isStable = false;
              break;
            }
            stableChecks++;
          }

          if (isStable) {
            rampHandled = true;
            const refuelLiters = Math.round(cumRise * 10) / 10;
            const durMin = Math.max(1, Math.round(fillDurationMs / 60000));
            const startFuelVal = Math.round(currentNormalized * 10) / 10;
            const endFuelVal = Math.round(maxRampVal * 10) / 10;

            const startPt = pt;
            const endPt = sorted[maxRampIdx];
            const latVal = endPt.lat || startPt.lat || null;
            const lngVal = endPt.lng || startPt.lng || null;

            refuelEvents.push({
              id: refuelEvents.length + 1,
              startIdx: i,
              endIdx: maxRampIdx,
              startTime: pt.device_time,
              endTime: sorted[maxRampIdx].device_time,
              startFuel: startFuelVal,
              endFuel: endFuelVal,
              liters: refuelLiters,
              durationMin: durMin,
              lat: latVal,
              lng: lngVal
            });

            for (let fillIdx = i; fillIdx <= maxRampIdx; fillIdx++) {
              if (filteredFuels[fillIdx] != null) {
                currentNormalized = Math.max(currentNormalized, filteredFuels[fillIdx]);
              }
              normalizedFuels[fillIdx] = Math.max(0, Math.min(tankCapacity, Math.round(currentNormalized * 10) / 10));
            }
            currentNormalized = maxRampVal;
            i = maxRampIdx;
            continue;
          }
        }
      }

      // Theft / drain detection
      if (!rampHandled && rawSpeed <= 6.0 && !ign && diff <= -2.0) {
        let isConfirmedTheft = false;
        for (const pair of offToOnPairs) {
          if (i >= pair.offIdx && i < pair.onIdx) {
            if (confirmedTheftWindows.has(pair.offIdx)) {
              isConfirmedTheft = true;
            }
            break;
          }
        }

        if (isConfirmedTheft) {
          const tStart = new Date(pt.device_time).getTime();
          let minRampVal = fVal;
          let minRampIdx = i;
          let k = i + 1;

          while (k < sorted.length) {
            const nextPt = sorted[k];
            const nextSpd = parseFloat(nextPt.speed) || 0;
            const nextIgn = nextPt.ignition === true || nextPt.ignition === 'true' || nextPt.ignition === 1;
            const nextTime = new Date(nextPt.device_time).getTime();

            if ((nextTime - tStart) > 25 * 60 * 1000) break;
            if (nextSpd > 6.0 || nextIgn) break;

            const nextF = filteredFuels[k];
            if (nextF != null && nextF < minRampVal) {
              minRampVal = nextF;
              minRampIdx = k;
            }
            k++;
          }

          const cumDrop = currentNormalized - minRampVal;
          const tEnd = new Date(sorted[minRampIdx].device_time).getTime();
          const drainDurationMs = tEnd - tStart;
          if (cumDrop >= theftThreshold && minRampIdx > i && drainDurationMs >= 30 * 1000) {
            rampHandled = true;
            const dropLiters = Math.round(cumDrop * 10) / 10;
            const durMin = Math.max(1, Math.round(drainDurationMs / 60000));
            const startFuelVal = Math.round(currentNormalized * 10) / 10;
            const endFuelVal = Math.round(minRampVal * 10) / 10;

            const startPtTheft = pt;
            const endPtTheft = sorted[minRampIdx];
            const latValTheft = endPtTheft.lat || startPtTheft.lat || null;
            const lngValTheft = endPtTheft.lng || startPtTheft.lng || null;

            dropEvents.push({
              id: dropEvents.length + 1,
              startIdx: i,
              endIdx: minRampIdx,
              startTime: pt.device_time,
              endTime: sorted[minRampIdx].device_time,
              startFuel: startFuelVal,
              endFuel: endFuelVal,
              liters: dropLiters,
              durationMin: durMin,
              lat: latValTheft,
              lng: lngValTheft
            });

            for (let fillIdx = i; fillIdx <= minRampIdx; fillIdx++) {
              if (filteredFuels[fillIdx] != null) {
                currentNormalized = Math.min(currentNormalized, filteredFuels[fillIdx]);
              }
              normalizedFuels[fillIdx] = Math.max(0, Math.min(tankCapacity, Math.round(currentNormalized * 10) / 10));
            }
            currentNormalized = minRampVal;
            i = minRampIdx;
            continue;
          }
        }
      }

      // Motion & consumption rules
      if (!rampHandled) {
        if (rawSpeed > 6.0) {
          if (diff >= refuelThreshold) {
            let sustainedCount = 0;
            let sampleCount = 0;
            const lookAhead = Math.min(sorted.length, i + 6);
            for (let j = i + 1; j < lookAhead; j++) {
              const fj = filteredFuels[j];
              if (fj != null) {
                sampleCount++;
                if (fj >= currentNormalized + (refuelThreshold * 0.6)) sustainedCount++;
              }
            }
            if (sampleCount === 0 || sustainedCount >= Math.ceil(sampleCount * 0.75)) {
              currentNormalized = fVal;
            }
          } else if (diff < 0) {
            currentNormalized = (0.88 * currentNormalized) + (0.12 * fVal);
          }
        } else if (ign) {
          if (diff < 0) {
            currentNormalized = (0.92 * currentNormalized) + (0.08 * fVal);
          }
        } else {
          if (Math.abs(diff) < refuelThreshold) {
            currentNormalized = (0.88 * currentNormalized) + (0.12 * fVal);
          }
        }
      }
    }

    normalizedFuels[i] = Math.max(0, Math.min(tankCapacity, Math.round(currentNormalized * 10) / 10));

    // Distance & Operating Time
    if (i > 0) {
      const prevPt = sorted[i - 1];
      if (pt.lat && pt.lng && prevPt.lat && prevPt.lng) {
        const segDist = haversine(prevPt.lat, prevPt.lng, pt.lat, pt.lng);
        if (segDist > 0.005 && segDist < 10) {
          cumulativeDist += segDist;
        }
      }

      const prevTime = new Date(prevPt.device_time).getTime();
      const currTime = new Date(pt.device_time).getTime();
      if (currTime > prevTime) {
        const segSec = Math.min(900, Math.max(0, (currTime - prevTime) / 1000));
        if (rawSpeed > 6.0) {
          runningSec += segSec;
          engineOnSec += segSec;
        } else if (ign) {
          idleSec += segSec;
          engineOnSec += segSec;
        } else {
          stoppedSec += segSec;
        }
      }
    }

    if (rawSpeed > maxSpd) maxSpd = rawSpeed;
    sumSpd += rawSpeed;
    speedSamples++;
  }

  // Start & End Fuel from Normalized Fuel curve
  const validNorms = normalizedFuels.filter(p => p != null);
  const startF = validNorms.length > 0 ? validNorms[0] : 0;
  const endF = validNorms.length > 0 ? validNorms[validNorms.length - 1] : 0;

  const totalRefueled = refuelEvents.reduce((acc, r) => acc + (r.liters || 0), 0);
  const totalTheft = dropEvents.reduce((acc, d) => acc + (d.liters || 0), 0);

  const grossConsumed = Math.max(0, (startF + totalRefueled) - endF - totalTheft);
  const netDistance = Math.round(cumulativeDist * 10) / 10;
  const mileage = (grossConsumed > 0 && netDistance > 0)
    ? Math.round((netDistance / grossConsumed) * 100) / 100
    : null;

  const engineHours = engineOnSec / 3600;
  const burnRate = (grossConsumed > 0 && engineHours > 0)
    ? Math.round((grossConsumed / engineHours) * 100) / 100
    : null;

  const firstPt = sorted[0];
  const lastPt = sorted[sorted.length - 1];
  const lastRefill = refuelEvents.length > 0 ? refuelEvents[refuelEvents.length - 1] : null;

  return {
    start_fuel: Math.round(startF * 10) / 10,
    end_fuel: Math.round(endF * 10) / 10,
    total_refill: Math.round(totalRefueled * 10) / 10,
    total_theft: Math.round(totalTheft * 10) / 10,
    consumption: Math.round(grossConsumed * 100) / 100,
    distance_travelled: netDistance,
    kmpl: mileage,
    lph: burnRate,
    running_seconds: Math.round(runningSec),
    idle_seconds: Math.round(idleSec),
    stopped_seconds: Math.round(stoppedSec),
    engine_on_seconds: Math.round(engineOnSec),
    max_speed: Math.round(maxSpd),
    avg_speed: speedSamples > 0 ? Math.round(sumSpd / speedSamples) : 0,
    refuels: refuelEvents,
    thefts: dropEvents,
    start_lat: firstPt?.lat || null,
    start_lng: firstPt?.lng || null,
    end_lat: lastPt?.lat || null,
    end_lng: lastPt?.lng || null,
    refill_lat: lastRefill?.lat || null,
    refill_lng: lastRefill?.lng || null
  };
}

module.exports = {
  haversine,
  calibrateFuelValue,
  processVehicleFuelHistory
};
