// ============================================================
// BACKEND API SERVER - FuelTracks
// Express.js REST API + Socket.io Real-time server
// Port 3001
// ============================================================

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const env = require('./config/env');
const db = require('./config/db');
const redisConfig = require('./config/redis');

// Import routes
const authRoutes = require('./routes/authRoutes');
const vehicleRoutes = require('./routes/vehicleRoutes');
const adminRoutes = require('./routes/adminRoutes');
const auditRoutes = require('./routes/auditRoutes');
const reportRoutes = require('./modules/reports/routes/reportRoutes');
const profileRoutes = require('./modules/profile/routes/profileRoutes');
const billingRoutes = require('./routes/billingRoutes');
const alertsRoutes = require('./routes/alertsRoutes');
const tripRoutes = require('./modules/trips/routes/tripRoutes');
const tripController = require('./modules/trips/controllers/tripController');
const path = require('path');
const publicApiRoutes = require('./routes/publicApiRoutes');
const geocodeRoutes = require('./routes/geocodeRoutes');

// Import middleware
const { errorHandler, notFoundHandler } = require('./middleware/error');

// Import subscribers & socket manager
const locationSubscriber = require('./subscribers/locationSubscriber');
const alertSubscriber = require('./subscribers/alertSubscriber');
const trackingSocket = require('./sockets/trackingSocket');

const app = express();
app.set('trust proxy', 1);
const server = http.createServer(app);

// ============================================================
// RATE LIMITERS
// ============================================================

const isDev = env.NODE_ENV !== 'production';

// General API limiter — 10,000 requests in dev, 200 in prod per 15 mins per IP
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 10000 : 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many requests from this IP, please try again after 15 minutes.',
    code: 'RATE_LIMIT_EXCEEDED',
  },
});

// Strict limiter for auth endpoints — 1,000 in dev, 20 in prod per 15 mins
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 1000 : 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many login attempts, please try again after 15 minutes.',
    code: 'AUTH_RATE_LIMIT_EXCEEDED',
  },
});


// ============================================================
// CORS CONFIGURATION
// ============================================================

// Build the CORS origin handler based on CORS_ORIGIN env var
const corsOriginHandler = (() => {
  const origin = env.CORS_ORIGIN;
  if (origin === '*') {
    // Wildcard — accept all (log a warning so operators know)
    console.warn('[SERVER] CORS_ORIGIN=* — all origins accepted. Set to your domain in production.');
    return true; // express/cors accepts `true` as "mirror request origin"
  }
  // Support comma-separated list of allowed origins
  const allowed = origin.split(',').map(o => o.trim()).filter(Boolean);
  return (requestOrigin, callback) => {
    // allow requests with no origin (like mobile apps or curl requests)
    // and allow 'null' origin (local file:// executions for testing)
    // and allow any localhost port (for Flutter web / local dev testing)
    const isLocalhost = requestOrigin && /^https?:\/\/localhost(:\d+)?$/.test(requestOrigin);
    if (!requestOrigin || requestOrigin === 'null' || isLocalhost || allowed.includes(requestOrigin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: origin ${requestOrigin} not allowed`));
    }
  };
})();


// Attach Socket.io
const io = socketIo(server, {
  cors: {
    origin: corsOriginHandler,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
  },
});
app.set('io', io);

// ============================================================
// MIDDLEWARE STACK
// ============================================================

app.use(helmet()); // Secure HTTP headers

app.use(cors({
  origin: corsOriginHandler,
  credentials: true,
}));

app.use(express.json({ limit: '1mb' })); // JSON parser with body size limit
app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev')); // HTTP Logging

// Apply rate limiters
app.use('/api', apiLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/forgot-password', authLimiter);
app.use('/api/auth/reset-password', authLimiter);

// ============================================================
// ROUTES
// ============================================================

const emailRoutes = require('./routes/emailExample.routes');

app.use('/api/auth', authRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/emails', emailRoutes);
app.use('/api/alerts', alertsRoutes);
app.use('/api/trips', tripRoutes);

// ─── Third-Party Public API ───────────────────────────────────
// Auth: X-API-Key header (no JWT required)
app.use('/api/v1', publicApiRoutes);
app.use('/api/geocode', geocodeRoutes);


// Mount Static File Serving for Uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Health Check
app.get('/health', async (req, res) => {
  try {
    // Check DB status
    await db.query('SELECT 1');
    // Check Redis status
    await redisConfig.redis.ping();

    res.status(200).json({
      success: true,
      status: 'OK',
      services: {
        database: 'connected',
        redis: 'connected',
      },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      status: 'DEGRADED',
      error: err.message,
    });
  }
});

// 404 Route handler
app.use(notFoundHandler);

// Global Error Handler
app.use(errorHandler);

// Initialize Subscribers and Sockets
async function bootstrap() {
  try {
    // 0. Ensure database tables and columns exist
    await db.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(255);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS location VARCHAR(255);

      CREATE TABLE IF NOT EXISTS renewal_plans (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        duration_months INT NOT NULL,
        price DECIMAL NOT NULL,
        org_id UUID REFERENCES organizations(id),
        user_id UUID REFERENCES users(id),
        group_id UUID REFERENCES groups(id),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS renewal_transactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
        amount DECIMAL NOT NULL,
        status VARCHAR(50) DEFAULT 'SUCCESS',
        payment_id VARCHAR(255) NOT NULL,
        plan_id INT REFERENCES renewal_plans(id),
        duration_months INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Alerts: add is_read column for read/unread tracking
      ALTER TABLE alerts ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT FALSE;

      -- Per-user FCM device tokens (supports multiple devices per user)
      CREATE TABLE IF NOT EXISTS user_fcm_tokens (
        id         BIGSERIAL PRIMARY KEY,
        user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        fcm_token  TEXT NOT NULL,
        device_info JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, fcm_token)
      );

      -- Per-user alert type preferences
      CREATE TABLE IF NOT EXISTS user_alert_preferences (
        user_id     UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        preferences JSONB NOT NULL DEFAULT '{"sos":true,"panic":true,"crash":true,"accident":true,"tow":true,"power_cut":true,"theft":true,"theft_alarm":true,"overspeed":true,"harsh_braking":true,"harsh_acceleration":true,"geofence_enter":true,"geofence_exit":true,"low_battery":true,"ignition_on":true,"ignition_off":true,"idle":false,"stoppage":false,"trip_started":true,"trip_ended":true,"route_deviation":true,"stopped":false}',
        updated_at  TIMESTAMP DEFAULT NOW()
      );

      -- Vehicle latest state immobilizer columns
      ALTER TABLE vehicle_latest_state ADD COLUMN IF NOT EXISTS is_immobilized BOOLEAN DEFAULT FALSE;
      ALTER TABLE vehicle_latest_state ADD COLUMN IF NOT EXISTS immobilizer_updated_at TIMESTAMP;
      ALTER TABLE vehicle_latest_state ADD COLUMN IF NOT EXISTS battery SMALLINT;

      -- User-defined trips table
      CREATE TABLE IF NOT EXISTS trips (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        vehicle_id    UUID NOT NULL REFERENCES vehicles(id),
        route_id      UUID REFERENCES routes(id),
        created_by    UUID REFERENCES users(id),
        name          VARCHAR(255) NOT NULL,
        origin        VARCHAR(500),
        destination   VARCHAR(500),
        status        VARCHAR(20) DEFAULT 'planned',
        start_time    TIMESTAMPTZ,
        end_time      TIMESTAMPTZ,
        start_lat     NUMERIC(10,7),
        start_lng     NUMERIC(10,7),
        end_lat       NUMERIC(10,7),
        end_lng       NUMERIC(10,7),
        distance_km   NUMERIC(10,3) DEFAULT 0,
        max_speed     SMALLINT DEFAULT 0,
        avg_speed     NUMERIC(5,1) DEFAULT 0,
        duration_secs INTEGER,
        point_count   INTEGER DEFAULT 0,
        notes         TEXT,
        created_at    TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_trips_vehicle_id ON trips(vehicle_id);
      CREATE INDEX IF NOT EXISTS idx_trips_status ON trips(status);
      CREATE INDEX IF NOT EXISTS idx_trips_start_time ON trips(start_time);

      -- ── Civil Supply / Third-Party API additions ─────────────────────────────
      -- Scope an API key to a specific group (NULL = org-wide access, unchanged behaviour)
      ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES groups(id) ON DELETE SET NULL;

      -- Webhook subscriptions: where to push GPS updates for each client
      CREATE TABLE IF NOT EXISTS webhook_subscriptions (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        group_id    UUID REFERENCES groups(id) ON DELETE SET NULL,
        url         TEXT NOT NULL,
        secret      TEXT,
        label       VARCHAR(255),
        is_active   BOOLEAN NOT NULL DEFAULT TRUE,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_webhook_subs_org   ON webhook_subscriptions(org_id);
      CREATE INDEX IF NOT EXISTS idx_webhook_subs_group ON webhook_subscriptions(group_id);

      -- Delivery log: audit trail for every webhook attempt
      CREATE TABLE IF NOT EXISTS webhook_delivery_log (
        id                BIGSERIAL PRIMARY KEY,
        subscription_id   UUID REFERENCES webhook_subscriptions(id) ON DELETE CASCADE,
        attempt           SMALLINT NOT NULL DEFAULT 1,
        status_code       SMALLINT,
        error             TEXT,
        delivered_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_webhook_log_sub ON webhook_delivery_log(subscription_id);
    `);
    console.log('[BOOT] Database tables & migrations verified');

    // 1. Initialize Socket.io room handlers
    trackingSocket.init(io);
    console.log('[BOOT] Socket.io event handlers configured');


    // 2. Start Redis subscribers for background processing
    await locationSubscriber.start(io);
    await alertSubscriber.start(io);
    console.log('[BOOT] Redis subscribers started');

    // 3. Start Express server
    server.listen(env.API_PORT, '0.0.0.0', () => {
      console.log('============================================================');
      console.log(`  FUELTRACKS BACKEND API`);
      console.log(`  Listening on port ${env.API_PORT}`);
      console.log(`  Environment: ${env.NODE_ENV}`);
      console.log(`  PostgreSQL: ${env.DB_HOST}:${env.DB_PORT}`);
      console.log(`  Redis Cache: ${env.REDIS_HOST}:${env.REDIS_PORT}`);
      console.log(`  Rate limiting: enabled`);
      console.log('============================================================');
    });

    // 4. Start Background Offline Checker
    setInterval(async () => {
      try {
        const result = await db.query(`
          UPDATE vehicle_latest_state 
          SET is_online = FALSE 
          WHERE is_online = TRUE AND last_seen < NOW() - INTERVAL '15 minutes'
          RETURNING vehicle_id;
        `);
        if (result.rowCount > 0) {
          console.log(`[CRON] Marked ${result.rowCount} vehicles as OFFLINE due to inactivity.`);
          // Notify connected clients that these vehicles went offline
          result.rows.forEach(row => {
            io.emit('fleet:update', {
              vehicleId: row.vehicle_id,
              is_online: false
            });
          });
        }
      } catch (err) {
        console.error('[CRON] Offline checker error:', err.message);
      }
    }, 60000); // Run every 60 seconds

    // 5b. Flush active trip stats from Redis → DB every 5 minutes (crash safety)
    setInterval(async () => {
      try {
        await tripController.flushActiveTripsToDb();
      } catch (err) {
        console.error('[CRON] Trip flush error:', err.message);
      }
    }, 5 * 60 * 1000);

  } catch (err) {
    console.error('[BOOT] Bootstrap failed:', err);
    process.exit(1);
  }
}

bootstrap();

// Graceful Shutdown
async function shutdown() {
  console.log('\n[SERVER] Shutting down gracefully...');
  server.close(async () => {
    try {
      await locationSubscriber.stop();
      await alertSubscriber.stop();
      await redisConfig.redis.quit();
      await db.pool.end();
      console.log('[SERVER] Connections closed. Exit complete.');
      process.exit(0);
    } catch (err) {
      console.error('[SERVER] Error during shutdown:', err);
      process.exit(1);
    }
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// ============================================================
// PROCESS-LEVEL ERROR GUARDS
// Catch any exception that escapes a try/catch.
// uncaughtException triggers graceful shutdown so PM2 can restart cleanly.
// unhandledRejection is logged but non-fatal — a single missed .catch()
// should not take down the whole server in production.
// ============================================================
process.on('uncaughtException', (err) => {
  console.error('[SERVER] Uncaught exception — initiating graceful shutdown:', err.stack || err.message);
  shutdown();
});

process.on('unhandledRejection', (reason) => {
  console.error('[SERVER] Unhandled promise rejection (non-fatal, logged for investigation):', reason);
});


module.exports = { app, server, io };
