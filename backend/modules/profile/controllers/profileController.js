const profileService = require('../services/profileService');

class ProfileController {
  
  async getOrganizationId(req) {
    const db = require('../../../config/db');
    if (req.query.orgId) {
      if (req.user?.role === 'superadmin') {
        return req.query.orgId;
      }
      if (req.user?.role === 'dealer') {
        // Verify child org belongs to dealer
        const check = await db.query(
          'SELECT id FROM organizations WHERE id = $1 AND (id = $2 OR parent_id = $2)',
          [req.query.orgId, req.user.orgId]
        );
        if (check.rows.length > 0) {
          return req.query.orgId;
        }
      }
    }
    if (req.user?.role === 'superadmin') {
      const saCheck = await db.query("SELECT id FROM organizations WHERE id = 'a0000000-0000-0000-0000-000000000001'");
      if (saCheck.rows.length > 0) {
        return 'a0000000-0000-0000-0000-000000000001';
      }
      if (req.user?.orgId) {
        return req.user.orgId;
      }
    }

    // Verify if user's token orgId exists in organizations table
    if (req.user?.orgId) {
      const orgCheck = await db.query('SELECT id FROM organizations WHERE id = $1', [req.user.orgId]);
      if (orgCheck.rows.length > 0) {
        return req.user.orgId;
      }
    }

    // Fallback: look up user's active org_id directly from users table
    if (req.user?.userId) {
      const uCheck = await db.query('SELECT org_id FROM users WHERE id = $1', [req.user.userId]);
      if (uCheck.rows.length > 0 && uCheck.rows[0].org_id) {
        return uCheck.rows[0].org_id;
      }
    }

    return req.user?.orgId || null;
  }

  getUserContext(req) {
    return {
      ...req.user,
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.headers['user-agent']
    };
  }

  async getProfile(req, res, next) {
    try {
      const orgId = await this.getOrganizationId(req);
      const data = await profileService.getProfile(orgId);
      res.json({ success: true, ...data });
    } catch (err) {
      next(err);
    }
  }

  async getAllDealers(req, res, next) {
    try {
      const dealers = await profileService.getAllDealers();
      res.json({ success: true, data: dealers });
    } catch (err) {
      next(err);
    }
  }

  async getPublicBranding(req, res, next) {
    try {
      const { identifier } = req.params;
      const branding = await profileService.getPublicBranding(identifier);
      if (!branding) {
        return res.status(404).json({ success: false, message: 'Dealer branding not found' });
      }
      res.json({ success: true, data: branding });
    } catch (err) {
      next(err);
    }
  }

  async updateProfile(req, res, next) {
    try {
      const orgId = await this.getOrganizationId(req);
      const userContext = this.getUserContext(req);
      const profile = await profileService.updateProfile(orgId, req.body, userContext);
      res.json({ success: true, profile });
    } catch (err) {
      next(err);
    }
  }

  async uploadLogo(req, res, next) {
    try {
      const orgId = await this.getOrganizationId(req);
      const userContext = this.getUserContext(req);
      if (!req.file) throw new Error('No file uploaded');
      
      const fileUrl = `/uploads/profile/${req.file.filename}`;
      const profile = await profileService.updateLogo(orgId, 'logo_url', fileUrl, userContext);
      res.json({ success: true, profile, fileUrl });
    } catch (err) {
      next(err);
    }
  }

  async uploadFavicon(req, res, next) {
    try {
      const orgId = await this.getOrganizationId(req);
      const userContext = this.getUserContext(req);
      if (!req.file) throw new Error('No file uploaded');
      
      const fileUrl = `/uploads/profile/${req.file.filename}`;
      const profile = await profileService.updateLogo(orgId, 'favicon_url', fileUrl, userContext);
      res.json({ success: true, profile, fileUrl });
    } catch (err) {
      next(err);
    }
  }

  async uploadBackground(req, res, next) {
    try {
      const orgId = await this.getOrganizationId(req);
      const userContext = this.getUserContext(req);
      if (!req.file) throw new Error('No file uploaded');
      
      const fileUrl = `/uploads/profile/${req.file.filename}`;
      const profile = await profileService.updateLogo(orgId, 'login_background_url', fileUrl, userContext);
      res.json({ success: true, profile, fileUrl });
    } catch (err) {
      next(err);
    }
  }

  async changePassword(req, res, next) {
    try {
      const { currentPassword, newPassword, targetUserId } = req.body;
      const orgId = await this.getOrganizationId(req);
      const userContext = this.getUserContext(req);
      await profileService.changePassword({
        targetOrgId: orgId,
        targetUserId,
        currentPassword,
        newPassword,
        userContext
      });
      res.json({ success: true, message: 'Password updated successfully' });
    } catch (err) {
      next(err);
    }
  }

  async getAuditHistory(req, res, next) {
    try {
      const orgId = await this.getOrganizationId(req);
      const logs = await profileService.getAuditLogs(orgId);
      res.json({ success: true, data: logs });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new ProfileController();
