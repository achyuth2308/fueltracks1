// ============================================================
// SOCKET.IO ROOM MANAGEMENT (trackingSocket.js)
// Authenticates client sockets and manages room subscriptions
// ============================================================

const jwt = require('jsonwebtoken');
const env = require('../config/env');
const VehicleModel = require('../models/vehicleModel');

/**
 * Configure Socket.io server logic
 * @param {object} io - Socket.io Server instance
 */
function init(io) {
  // Authentication middleware for Socket.io
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;

    if (!token) {
      return next(new Error('Authentication error: No token provided'));
    }

    try {
      const decoded = jwt.verify(token, env.JWT_SECRET);
      socket.user = {
        userId: decoded.userId,
        role: decoded.role,
        orgId: decoded.orgId,
        orgType: decoded.orgType
      };
      next();
    } catch (err) {
      return next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const { userId, role, orgId } = socket.user;
    console.log(`[SOCKET] User connected: ${userId} (${role}) - Socket: ${socket.id}`);

    // Automatically join default room for organization fleet updates
    socket.join(`org:${orgId}`);
    console.log(`[SOCKET] Socket ${socket.id} automatically joined room: org:${orgId}`);

    // Join vehicle detail room (for individual live tracking page)
    socket.on('join:vehicle', async ({ vehicleId }) => {
      try {
        if (!vehicleId) return;

        // Verify authorization for the vehicle
        if (role !== 'superadmin') {
          const belongs = await VehicleModel.belongsToOrg(vehicleId, orgId);
          if (!belongs) {
            socket.emit('error:socket', { message: 'Access denied to vehicle tracking.' });
            return;
          }
        }

        socket.join(`vehicle:${vehicleId}`);
        console.log(`[SOCKET] Socket ${socket.id} joined room: vehicle:${vehicleId}`);
      } catch (err) {
        console.error('[SOCKET] Join vehicle error:', err.message);
      }
    });

    // Leave vehicle room
    socket.on('leave:vehicle', ({ vehicleId }) => {
      if (!vehicleId) return;
      socket.leave(`vehicle:${vehicleId}`);
      console.log(`[SOCKET] Socket ${socket.id} left room: vehicle:${vehicleId}`);
    });

    // Join organization room (specifically for switching views in Superadmin panel)
    socket.on('join:org', ({ targetOrgId }) => {
      if (!targetOrgId) return;

      // Only superadmin can join other orgs
      if (role !== 'superadmin' && targetOrgId !== orgId) {
        socket.emit('error:socket', { message: 'Access denied to organization updates.' });
        return;
      }

      socket.join(`org:${targetOrgId}`);
      console.log(`[SOCKET] Socket ${socket.id} joined room: org:${targetOrgId}`);
    });

    // Leave organization room
    socket.on('leave:org', ({ targetOrgId }) => {
      if (!targetOrgId) return;
      socket.leave(`org:${targetOrgId}`);
      console.log(`[SOCKET] Socket ${socket.id} left room: org:${targetOrgId}`);
    });

    socket.on('disconnect', () => {
      console.log(`[SOCKET] User disconnected: ${userId} - Socket: ${socket.id}`);
    });
  });
}

module.exports = { init };
