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

const env = require('./config/env');
const db = require('./config/db');
const redisConfig = require('./config/redis');

// Import routes
const authRoutes = require('./routes/authRoutes');
const vehicleRoutes = require('./routes/vehicleRoutes');
const adminRoutes = require('./routes/adminRoutes');

// Import middleware
const { errorHandler, notFoundHandler } = require('./middleware/error');

// Import subscribers & socket manager
const locationSubscriber = require('./subscribers/locationSubscriber');
const alertSubscriber = require('./subscribers/alertSubscriber');
const trackingSocket = require('./sockets/trackingSocket');

const app = express();
const server = http.createServer(app);

// Attach Socket.io
const io = socketIo(server, {
  cors: {
    origin: env.CORS_ORIGIN,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
  },
});

// Middleware
app.use(helmet()); // Secure HTTP headers
app.use(cors({ origin: env.CORS_ORIGIN }));
app.use(express.json()); // JSON parser
app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev')); // HTTP Logging

// Mount REST routes
app.use('/api/auth', authRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/admin', adminRoutes);

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
      console.log('============================================================');
    });

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

module.exports = { app, server, io };
