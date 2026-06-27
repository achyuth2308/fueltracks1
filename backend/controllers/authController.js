// ============================================================
// AUTH CONTROLLER
// Handles user authentication, token generation, and me endpoint
// ============================================================

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const UserModel = require('../models/userModel');
const env = require('../config/env');
const AuditService = require('../services/auditService');

const AuthController = {
  /**
   * Log in user and return JWT
   */
  async login(req, res, next) {
    try {
      const { identifier, password } = req.body;

      if (!identifier || !password) {
        return res.status(400).json({
          success: false,
          error: 'Email/Username and password are required.',
          code: 'VALIDATION_ERROR'
        });
      }

      // Find user
      const user = await UserModel.findByIdentifier(identifier.toLowerCase().trim());
      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'Invalid email/username or password.',
          code: 'INVALID_CREDENTIALS'
        });
      }

      // Check password
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        // Audit: login failed
        try {
          await AuditService.log({
            auditType: 'login',
            entityType: 'User',
            entityId: user.id,
            entityName: user.name || user.email,
            action: 'LOGIN_FAILED',
            newData: { email: user.email, reason: 'Invalid password' },
            performedById: user.id,
            performedByName: user.name,
            performedByEmail: user.email,
            performedByRole: user.role,
            orgId: user.org_id,
            orgName: user.org_name,
            ipAddress: AuditService.getIp(req),
            userAgent: AuditService.getUserAgent(req),
          });
        } catch (auditErr) { console.error('[AUDIT]', auditErr.message); }
        return res.status(401).json({
          success: false,
          error: 'Invalid email/username or password.',
          code: 'INVALID_CREDENTIALS'
        });
      }

      // Generate JWT
      const token = jwt.sign(
        {
          userId: user.id,
          role: user.role,
          orgId: user.org_id,
          orgType: user.org_type
        },
        env.JWT_SECRET,
        { expiresIn: env.JWT_EXPIRES_IN }
      );

      // Update last login
      await UserModel.updateLastLogin(user.id);

      // Audit: login success
      try {
        await AuditService.log({
          auditType: 'login',
          entityType: 'User',
          entityId: user.id,
          entityName: user.name || user.email,
          action: 'LOGIN_SUCCESS',
          newData: { email: user.email, role: user.role },
          performedById: user.id,
          performedByName: user.name,
          performedByEmail: user.email,
          performedByRole: user.role,
          orgId: user.org_id,
          orgName: user.org_name,
          ipAddress: AuditService.getIp(req),
          userAgent: AuditService.getUserAgent(req),
        });
      } catch (auditErr) { console.error('[AUDIT]', auditErr.message); }

      res.status(200).json({
        success: true,
        data: {
          accessToken: token,
          user: {
            id: user.id,
            email: user.email,
            role: user.role,
            orgId: user.org_id,
            orgName: user.org_name,
            orgType: user.org_type,
            name: user.name,
            phone: user.phone
          }
        },
        message: 'Login successful'
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * Log out user (Client side discards JWT)
   */
  async logout(req, res, next) {
    try {
      // Audit: logout
      try {
        await AuditService.log({
          auditType: 'login',
          entityType: 'User',
          entityId: req.user?.userId,
          action: 'LOGOUT',
          performedById: req.user?.userId,
          performedByRole: req.user?.role,
          orgId: req.user?.orgId,
          ipAddress: AuditService.getIp(req),
          userAgent: AuditService.getUserAgent(req),
        });
      } catch (auditErr) { console.error('[AUDIT]', auditErr.message); }

      res.status(200).json({
        success: true,
        message: 'Logout successful'
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * Get current authenticated user details
   */
  async getMe(req, res, next) {
    try {
      const user = await UserModel.findById(req.user.userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found.',
          code: 'USER_NOT_FOUND'
        });
      }

      res.status(200).json({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            role: user.role,
            orgId: user.org_id,
            orgName: user.org_name,
            orgType: user.org_type,
            name: user.name,
            phone: user.phone,
            isActive: user.is_active,
            createdAt: user.created_at
          }
        }
      });
    } catch (err) {
      next(err);
    }
  }
};

module.exports = AuthController;
