// ============================================================
// ADMIN CONTROLLER
// Handles Organization management, User accounts, Group mappings, and Stats
// ============================================================

const bcrypt = require('bcryptjs');
const OrgModel = require('../models/orgModel');
const UserModel = require('../models/userModel');
const GroupModel = require('../models/groupModel');
const GpsModel = require('../models/gpsModel');

const AdminController = {
  // ============================================================
  // ORGANIZATIONS
  // ============================================================
  async getAllOrgs(req, res, next) {
    try {
      const orgs = await OrgModel.findAll(req.user.orgId, req.user.role);
      res.status(200).json({
        success: true,
        data: orgs
      });
    } catch (err) {
      next(err);
    }
  },

  async getOrgById(req, res, next) {
    try {
      const { id } = req.params;

      if (req.user.role !== 'superadmin' && id !== req.user.orgId) {
        // Dealer check - can only fetch child orgs
        const org = await OrgModel.findById(id);
        if (!org || org.parent_id !== req.user.orgId) {
          return res.status(403).json({
            success: false,
            error: 'Access denied.',
            code: 'FORBIDDEN'
          });
        }
      }

      const org = await OrgModel.findById(id);
      if (!org) {
        return res.status(404).json({
          success: false,
          error: 'Organization not found.',
          code: 'ORG_NOT_FOUND'
        });
      }

      res.status(200).json({
        success: true,
        data: org
      });
    } catch (err) {
      next(err);
    }
  },

  async createOrg(req, res, next) {
    try {
      const { name, type, parentId, address, phone } = req.body;

      if (!name || !type) {
        return res.status(400).json({
          success: false,
          error: 'Name and type are required.',
          code: 'VALIDATION_ERROR'
        });
      }

      // Check restrictions
      if (req.user.role !== 'superadmin') {
        // Dealers can only create customer organizations under themselves
        if (type !== 'customer') {
          return res.status(403).json({
            success: false,
            error: 'Dealers can only create customer organizations.',
            code: 'FORBIDDEN'
          });
        }
      }

      const parentOrgId = req.user.role === 'superadmin' ? parentId : req.user.orgId;

      const newOrg = await OrgModel.create({
        name,
        type,
        parentId: parentOrgId,
        address,
        phone
      });

      res.status(201).json({
        success: true,
        data: newOrg,
        message: 'Organization created successfully.'
      });
    } catch (err) {
      next(err);
    }
  },

  async updateOrg(req, res, next) {
    try {
      const { id } = req.params;
      const { name, type, address, phone, isActive } = req.body;

      if (req.user.role !== 'superadmin' && id !== req.user.orgId) {
        // Dealers can only update their child orgs
        const org = await OrgModel.findById(id);
        if (!org || org.parent_id !== req.user.orgId) {
          return res.status(403).json({
            success: false,
            error: 'Access denied to update organization.',
            code: 'FORBIDDEN'
          });
        }
      }

      const updated = await OrgModel.update(id, { name, type, address, phone, isActive });
      if (!updated) {
        return res.status(404).json({
          success: false,
          error: 'Organization not found.',
          code: 'ORG_NOT_FOUND'
        });
      }

      res.status(200).json({
        success: true,
        data: updated,
        message: 'Organization updated successfully.'
      });
    } catch (err) {
      next(err);
    }
  },

  async deleteOrg(req, res, next) {
    try {
      const { id } = req.params;

      if (req.user.role !== 'superadmin') {
        const org = await OrgModel.findById(id);
        if (!org || org.parent_id !== req.user.orgId) {
          return res.status(403).json({
            success: false,
            error: 'Access denied.',
            code: 'FORBIDDEN'
          });
        }
      }

      const deleted = await OrgModel.delete(id);
      if (!deleted) {
        return res.status(404).json({
          success: false,
          error: 'Organization not found.',
          code: 'ORG_NOT_FOUND'
        });
      }

      res.status(200).json({
        success: true,
        message: 'Organization deactivated successfully.'
      });
    } catch (err) {
      next(err);
    }
  },

  // ============================================================
  // USERS
  // ============================================================
  async getAllUsers(req, res, next) {
    try {
      const users = await UserModel.findAll(req.user.orgId, req.user.role);
      res.status(200).json({
        success: true,
        data: users
      });
    } catch (err) {
      next(err);
    }
  },

  async createUser(req, res, next) {
    try {
      const { orgId, email, password, role, name, phone, groupIds } = req.body;

      if (!email || !password || !role) {
        return res.status(400).json({
          success: false,
          error: 'Email, password and role are required.',
          code: 'VALIDATION_ERROR'
        });
      }

      // Check role authorization
      if (req.user.role !== 'superadmin') {
        // Dealer cannot create superadmins, and must place user in own or child org
        if (role === 'superadmin') {
          return res.status(403).json({
            success: false,
            error: 'Unauthorized role assignment.',
            code: 'FORBIDDEN'
          });
        }

        const targetOrg = await OrgModel.findById(orgId || req.user.orgId);
        if (!targetOrg || (targetOrg.id !== req.user.orgId && targetOrg.parent_id !== req.user.orgId)) {
          return res.status(403).json({
            success: false,
            error: 'Must create user inside your organization tree.',
            code: 'FORBIDDEN'
          });
        }
      }

      const targetOrgId = orgId || req.user.orgId;
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      const newUser = await UserModel.create({
        orgId: targetOrgId,
        email: email.toLowerCase().trim(),
        password: hashedPassword,
        role,
        name,
        phone
      });

      // Handle user group assignments
      if (groupIds && Array.isArray(groupIds)) {
        const validGroupIds = [];
        for (const gId of groupIds) {
          if (req.user.role === 'superadmin') {
            validGroupIds.push(gId);
          } else {
            const belongs = await GroupModel.belongsToOrg(gId, targetOrgId);
            if (belongs) validGroupIds.push(gId);
          }
        }
        if (validGroupIds.length > 0) {
          await GroupModel.assignUserToGroups(newUser.id, validGroupIds);
        }
      }

      res.status(201).json({
        success: true,
        data: newUser,
        message: 'User created successfully.'
      });
    } catch (err) {
      next(err);
    }
  },

  async updateUser(req, res, next) {
    try {
      const { id } = req.params;
      const { email, role, name, phone, isActive, groupIds } = req.body;

      // Ownership check for dealers editing other users
      if (req.user.role !== 'superadmin') {
        const user = await UserModel.findById(id);
        if (!user || (user.org_id !== req.user.orgId && user.org_type === 'dealer')) {
          return res.status(403).json({
            success: false,
            error: 'Access denied to update user.',
            code: 'FORBIDDEN'
          });
        }
        if (role === 'superadmin') {
          return res.status(403).json({
            success: false,
            error: 'Dealers cannot elevate users to superadmin.',
            code: 'FORBIDDEN'
          });
        }
      }

      const updated = await UserModel.update(id, { email, role, name, phone, isActive });
      if (!updated) {
        return res.status(404).json({
          success: false,
          error: 'User not found.',
          code: 'USER_NOT_FOUND'
        });
      }

      // Update user group assignments
      if (groupIds && Array.isArray(groupIds)) {
        const validGroupIds = [];
        for (const gId of groupIds) {
          if (req.user.role === 'superadmin') {
            validGroupIds.push(gId);
          } else {
            const belongs = await GroupModel.belongsToOrg(gId, updated.org_id);
            if (belongs) validGroupIds.push(gId);
          }
        }
        await GroupModel.assignUserToGroups(id, validGroupIds);
      }

      res.status(200).json({
        success: true,
        data: updated,
        message: 'User updated successfully.'
      });
    } catch (err) {
      next(err);
    }
  },

  async deleteUser(req, res, next) {
    try {
      const { id } = req.params;

      if (req.user.role !== 'superadmin') {
        const user = await UserModel.findById(id);
        if (!user || user.org_id !== req.user.orgId) {
          return res.status(403).json({
            success: false,
            error: 'Access denied.',
            code: 'FORBIDDEN'
          });
        }
      }

      const deleted = await UserModel.delete(id);
      if (!deleted) {
        return res.status(404).json({
          success: false,
          error: 'User not found.',
          code: 'USER_NOT_FOUND'
        });
      }

      res.status(200).json({
        success: true,
        message: 'User deactivated successfully.'
      });
    } catch (err) {
      next(err);
    }
  },

  // ============================================================
  // GROUPS
  // ============================================================
  async getAllGroups(req, res, next) {
    try {
      const groups = await GroupModel.findAll(req.user.orgId, req.user.role);
      res.status(200).json({
        success: true,
        data: groups
      });
    } catch (err) {
      next(err);
    }
  },

  async createGroup(req, res, next) {
    try {
      const { name, description, orgId } = req.body;

      if (!name) {
        return res.status(400).json({
          success: false,
          error: 'Group name is required.',
          code: 'VALIDATION_ERROR'
        });
      }

      let targetOrgId = req.user.orgId;
      if (req.user.role === 'superadmin' && orgId) {
        targetOrgId = orgId;
      }

      const newGroup = await GroupModel.create({
        orgId: targetOrgId,
        name,
        description
      });

      res.status(201).json({
        success: true,
        data: newGroup,
        message: 'Group created successfully.'
      });
    } catch (err) {
      next(err);
    }
  },

  async updateGroup(req, res, next) {
    try {
      const { id } = req.params;
      const { name, description, isActive } = req.body;

      if (req.user.role !== 'superadmin') {
        const belongs = await GroupModel.belongsToOrg(id, req.user.orgId);
        if (!belongs) {
          return res.status(403).json({
            success: false,
            error: 'Access denied to group.',
            code: 'FORBIDDEN'
          });
        }
      }

      const updated = await GroupModel.update(id, { name, description, isActive });
      if (!updated) {
        return res.status(404).json({
          success: false,
          error: 'Group not found.',
          code: 'GROUP_NOT_FOUND'
        });
      }

      res.status(200).json({
        success: true,
        data: updated,
        message: 'Group updated successfully.'
      });
    } catch (err) {
      next(err);
    }
  },

  async deleteGroup(req, res, next) {
    try {
      const { id } = req.params;

      if (req.user.role !== 'superadmin') {
        const belongs = await GroupModel.belongsToOrg(id, req.user.orgId);
        if (!belongs) {
          return res.status(403).json({
            success: false,
            error: 'Access denied.',
            code: 'FORBIDDEN'
          });
        }
      }

      const deleted = await GroupModel.delete(id);
      if (!deleted) {
        return res.status(404).json({
          success: false,
          error: 'Group not found.',
          code: 'GROUP_NOT_FOUND'
        });
      }

      res.status(200).json({
        success: true,
        message: 'Group deleted successfully.'
      });
    } catch (err) {
      next(err);
    }
  },

  // ============================================================
  // DASHBOARD STATS
  // ============================================================
  async getDashboardStats(req, res, next) {
    try {
      const stats = await GpsModel.getDashboardStats(req.user.orgId, req.user.role);
      res.status(200).json({
        success: true,
        data: stats
      });
    } catch (err) {
      next(err);
    }
  }
};

module.exports = AdminController;
