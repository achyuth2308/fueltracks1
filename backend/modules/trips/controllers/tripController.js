const tripRepository = require('../repositories/tripRepository');
const { redis } = require('../../../config/redis');

// Redis key helpers
const ACTIVE_TRIP_KEY = (vehicleId) => `vehicle:active_trip:${vehicleId}`;
const TRIP_DIST_KEY   = (tripId)   => `trip:dist:${tripId}`;
const TRIP_PTS_KEY    = (tripId)   => `trip:pts:${tripId}`;
const TRIP_MAXSPD_KEY = (tripId)   => `trip:maxspd:${tripId}`;
const TRIP_SPDSUM_KEY = (tripId)   => `trip:spdsum:${tripId}`;
const TRIP_START_KEY  = (tripId)   => `trip:start_ts:${tripId}`;

class TripController {

  /** GET /api/trips — list trips */
  async list(req, res) {
    try {
      const { vehicleId, status } = req.query;
      const orgId = req.user.role === 'superadmin' ? null : req.user.org_id;
      const trips = await tripRepository.list({ vehicleId, orgId, status });
      res.json({ success: true, data: trips });
    } catch (err) {
      console.error('[TripController] list error:', err.message);
      res.status(500).json({ success: false, error: 'Failed to fetch trips' });
    }
  }

  /** POST /api/trips — create a new planned trip */
  async create(req, res) {
    try {
      const { vehicleId, routeId, name, origin, destination, notes } = req.body;
      if (!vehicleId || !name) {
        return res.status(400).json({ success: false, error: 'vehicleId and name are required' });
      }
      const trip = await tripRepository.create({
        vehicleId, routeId, name, origin, destination, notes,
        createdBy: req.user.id
      });
      res.status(201).json({ success: true, data: trip });
    } catch (err) {
      console.error('[TripController] create error:', err.message);
      res.status(500).json({ success: false, error: 'Failed to create trip' });
    }
  }

  /** POST /api/trips/:id/start — start a planned trip */
  async start(req, res) {
    try {
      const { id } = req.params;
      const { lat, lng } = req.body;

      // Check no other active trip for this vehicle
      const trip = await tripRepository.findById(id);
      if (!trip) return res.status(404).json({ success: false, error: 'Trip not found' });

      const existing = await tripRepository.findActiveForVehicle(trip.vehicle_id);
      if (existing && existing.id !== id) {
        return res.status(409).json({
          success: false,
          error: `Vehicle already has an active trip: "${existing.name}". End it first.`
        });
      }

      const started = await tripRepository.start(id, { lat, lng });
      if (!started) {
        return res.status(400).json({ success: false, error: 'Trip could not be started (already in progress or not found)' });
      }

      // Set Redis keys for live accumulation
      await redis.set(ACTIVE_TRIP_KEY(trip.vehicle_id), id, 'EX', 7 * 24 * 60 * 60); // 7 day safety cap
      await redis.set(TRIP_DIST_KEY(id), '0');
      await redis.set(TRIP_PTS_KEY(id), '0');
      await redis.set(TRIP_MAXSPD_KEY(id), '0');
      await redis.set(TRIP_SPDSUM_KEY(id), '0');
      await redis.set(TRIP_START_KEY(id), Date.now().toString());

      res.json({ success: true, data: started });
    } catch (err) {
      console.error('[TripController] start error:', err.message);
      res.status(500).json({ success: false, error: 'Failed to start trip' });
    }
  }

  /** POST /api/trips/:id/end — end an in-progress trip */
  async end(req, res) {
    try {
      const { id } = req.params;
      const { lat, lng } = req.body;

      const trip = await tripRepository.findById(id);
      if (!trip) return res.status(404).json({ success: false, error: 'Trip not found' });

      // Read accumulated stats from Redis
      const [distKm, pts, maxSpd, spdSum, startTs] = await Promise.all([
        redis.get(TRIP_DIST_KEY(id)),
        redis.get(TRIP_PTS_KEY(id)),
        redis.get(TRIP_MAXSPD_KEY(id)),
        redis.get(TRIP_SPDSUM_KEY(id)),
        redis.get(TRIP_START_KEY(id))
      ]);

      const pointCount  = parseInt(pts || 0);
      const avgSpeed    = pointCount > 0 ? (parseFloat(spdSum || 0) / pointCount) : 0;
      const durationSecs = startTs ? Math.round((Date.now() - parseInt(startTs)) / 1000) : 0;

      const ended = await tripRepository.end(id, {
        lat, lng,
        distanceKm: parseFloat(distKm || 0),
        maxSpeed: parseFloat(maxSpd || 0),
        avgSpeed,
        durationSecs,
        pointCount
      });

      if (!ended) {
        return res.status(400).json({ success: false, error: 'Trip not in progress or not found' });
      }

      // Clear Redis keys
      await redis.del(ACTIVE_TRIP_KEY(trip.vehicle_id));
      await redis.del(TRIP_DIST_KEY(id));
      await redis.del(TRIP_PTS_KEY(id));
      await redis.del(TRIP_MAXSPD_KEY(id));
      await redis.del(TRIP_SPDSUM_KEY(id));
      await redis.del(TRIP_START_KEY(id));

      res.json({ success: true, data: ended });
    } catch (err) {
      console.error('[TripController] end error:', err.message);
      res.status(500).json({ success: false, error: 'Failed to end trip' });
    }
  }

  /** DELETE /api/trips/:id — cancel a trip */
  async cancel(req, res) {
    try {
      const { id } = req.params;
      const trip = await tripRepository.findById(id);
      if (!trip) return res.status(404).json({ success: false, error: 'Trip not found' });

      // Clean up Redis if it was in_progress
      if (trip.status === 'in_progress') {
        await redis.del(ACTIVE_TRIP_KEY(trip.vehicle_id));
        await redis.del(TRIP_DIST_KEY(id));
        await redis.del(TRIP_PTS_KEY(id));
        await redis.del(TRIP_MAXSPD_KEY(id));
        await redis.del(TRIP_SPDSUM_KEY(id));
        await redis.del(TRIP_START_KEY(id));
      }

      const cancelled = await tripRepository.cancel(id);
      res.json({ success: true, data: cancelled });
    } catch (err) {
      console.error('[TripController] cancel error:', err.message);
      res.status(500).json({ success: false, error: 'Failed to cancel trip' });
    }
  }

  /** GET /api/trips/active/:vehicleId — get active trip for a vehicle */
  async getActive(req, res) {
    try {
      const trip = await tripRepository.findActiveForVehicle(req.params.vehicleId);
      res.json({ success: true, data: trip || null });
    } catch (err) {
      console.error('[TripController] getActive error:', err.message);
      res.status(500).json({ success: false, error: 'Failed to fetch active trip' });
    }
  }

  /** GET /api/trips/:id — get single trip */
  async getOne(req, res) {
    try {
      const trip = await tripRepository.findById(req.params.id);
      if (!trip) return res.status(404).json({ success: false, error: 'Trip not found' });

      // Augment with live Redis distance if in_progress
      if (trip.status === 'in_progress') {
        const liveDist = await redis.get(TRIP_DIST_KEY(trip.id));
        if (liveDist) trip.distance_km = parseFloat(liveDist).toFixed(3);
      }
      res.json({ success: true, data: trip });
    } catch (err) {
      console.error('[TripController] getOne error:', err.message);
      res.status(500).json({ success: false, error: 'Failed to fetch trip' });
    }
  }

  /**
   * Called every 5 minutes by the server cron job.
   * Reads Redis live stats and flushes to DB — prevents data loss on restart.
   */
  async flushActiveTripsToDb() {
    try {
      const activeTrips = await tripRepository.listInProgress();
      for (const { id: tripId } of activeTrips) {
        const [distKm, maxSpd] = await Promise.all([
          redis.get(TRIP_DIST_KEY(tripId)),
          redis.get(TRIP_MAXSPD_KEY(tripId))
        ]);
        if (distKm !== null) {
          await tripRepository.flushStats(tripId, {
            distanceKm: parseFloat(distKm),
            maxSpeed: parseFloat(maxSpd || 0)
          });
        }
      }
    } catch (err) {
      console.error('[TripController] flushActiveTripsToDb error:', err.message);
    }
  }
}

module.exports = new TripController();
