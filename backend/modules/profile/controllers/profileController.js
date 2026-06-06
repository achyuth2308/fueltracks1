const profileService = require('../services/profileService');

class ProfileController {
  
  getOrganizationId(req) {
    // If superadmin specifies an orgId in query, use it. Otherwise use their own orgId
    if (req.user?.role === 'superadmin' && req.query.orgId) {
      return req.query.orgId;
    }
    return req.user.orgId;
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
      const orgId = this.getOrganizationId(req);
      const data = await profileService.getProfile(orgId);
      res.json({ success: true, ...data });
    } catch (err) {
      next(err);
    }
  }

  async updateProfile(req, res, next) {
    try {
      const orgId = this.getOrganizationId(req);
      const userContext = this.getUserContext(req);
      const profile = await profileService.updateProfile(orgId, req.body, userContext);
      res.json({ success: true, profile });
    } catch (err) {
      next(err);
    }
  }

  async uploadLogo(req, res, next) {
    try {
      const orgId = this.getOrganizationId(req);
      const userContext = this.getUserContext(req);
      if (!req.file) throw new Error('No file uploaded');
      
      const fileUrl = `/uploads/profile/${req.file.filename}`;
      const profile = await profileService.updateLogo(orgId, 'logo_url', fileUrl, userContext);
      res.json({ success: true, profile });
    } catch (err) {
      next(err);
    }
  }

  async uploadFavicon(req, res, next) {
    try {
      const orgId = this.getOrganizationId(req);
      const userContext = this.getUserContext(req);
      if (!req.file) throw new Error('No file uploaded');
      
      const fileUrl = `/uploads/profile/${req.file.filename}`;
      const profile = await profileService.updateLogo(orgId, 'favicon_url', fileUrl, userContext);
      res.json({ success: true, profile });
    } catch (err) {
      next(err);
    }
  }

  async uploadBackground(req, res, next) {
    try {
      const orgId = this.getOrganizationId(req);
      const userContext = this.getUserContext(req);
      if (!req.file) throw new Error('No file uploaded');
      
      const fileUrl = `/uploads/profile/${req.file.filename}`;
      const profile = await profileService.updateLogo(orgId, 'login_background_url', fileUrl, userContext);
      res.json({ success: true, profile });
    } catch (err) {
      next(err);
    }
  }

  async changePassword(req, res, next) {
    try {
      const { currentPassword, newPassword } = req.body;
      const userContext = this.getUserContext(req);
      await profileService.changePassword(req.user.userId, currentPassword, newPassword, userContext);
      res.json({ success: true, message: 'Password changed successfully' });
    } catch (err) {
      next(err);
    }
  }

  async getAuditHistory(req, res, next) {
    try {
      const orgId = this.getOrganizationId(req);
      const logs = await profileService.getAuditLogs(orgId);
      res.json({ success: true, data: logs });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new ProfileController();
