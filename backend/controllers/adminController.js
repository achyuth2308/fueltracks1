// ============================================================
// ADMIN CONTROLLER
// Handles Organization management, User accounts, Group mappings, and Stats
// ============================================================

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const OrgModel = require('../models/orgModel');
const UserModel = require('../models/userModel');
const GroupModel = require('../models/groupModel');
const VehicleModel = require('../models/vehicleModel');
const GpsModel = require('../models/gpsModel');
const db = require('../config/db');
const AuditService = require('../services/auditService');

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
      const { name, type, parentId, address, phone, contactPerson, email } = req.body;

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
        phone,
        contactPerson,
        email
      });

      res.status(201).json({
        success: true,
        data: newOrg,
        message: 'Organization created successfully.'
      });
      // Audit: organization created
      try {
        await AuditService.log({
          auditType: 'organization', entityType: 'Organization',
          entityId: newOrg.id, entityName: newOrg.name, action: 'CREATED',
          newData: { name: newOrg.name, type: newOrg.type, email: newOrg.email },
          performedById: req.user.userId, performedByRole: req.user.role,
          orgId: newOrg.id, orgName: newOrg.name,
          ipAddress: AuditService.getIp(req), userAgent: AuditService.getUserAgent(req),
        });
      } catch (auditErr) { console.error('[AUDIT]', auditErr.message); }
    } catch (err) {
      next(err);
    }
  },

  async updateOrg(req, res, next) {
    try {
      const { id } = req.params;
      const { name, type, address, phone, isActive, contactPerson, email } = req.body;

      // Fetch old org
      const oldOrg = await OrgModel.findById(id);
      if (!oldOrg) {
        return res.status(404).json({
          success: false,
          error: 'Organization not found.',
          code: 'ORG_NOT_FOUND'
        });
      }

      if (req.user.role !== 'superadmin' && id !== req.user.orgId) {
        // Dealers can only update their child orgs
        if (oldOrg.parent_id !== req.user.orgId) {
          return res.status(403).json({
            success: false,
            error: 'Access denied to update organization.',
            code: 'FORBIDDEN'
          });
        }
      }

      const oldData = {
        name: oldOrg.name,
        type: oldOrg.type,
        address: oldOrg.address,
        phone: oldOrg.phone,
        isActive: oldOrg.is_active,
        contactPerson: oldOrg.contact_person,
        email: oldOrg.email
      };

      const updated = await OrgModel.update(id, { name, type, address, phone, isActive, contactPerson, email });

      res.status(200).json({
        success: true,
        data: updated,
        message: 'Organization updated successfully.'
      });

      const newData = {
        name: updated.name !== undefined ? updated.name : name,
        type: updated.type !== undefined ? updated.type : type,
        address: updated.address !== undefined ? updated.address : address,
        phone: updated.phone !== undefined ? updated.phone : phone,
        isActive: updated.is_active !== undefined ? updated.is_active : isActive,
        contactPerson: updated.contact_person !== undefined ? updated.contact_person : contactPerson,
        email: updated.email !== undefined ? updated.email : email
      };

      // Audit: organization updated
      try {
        await AuditService.log({
          auditType: 'organization', entityType: 'Organization',
          entityId: id, entityName: updated.name, action: 'UPDATED',
          oldData,
          newData,
          performedById: req.user.userId, performedByRole: req.user.role,
          orgId: id, orgName: updated.name,
          ipAddress: AuditService.getIp(req), userAgent: AuditService.getUserAgent(req),
        });
      } catch (auditErr) { console.error('[AUDIT]', auditErr.message); }
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
      // Audit: organization deleted
      try {
        await AuditService.log({
          auditType: 'organization', entityType: 'Organization',
          entityId: id, action: 'DELETED',
          performedById: req.user.userId, performedByRole: req.user.role,
          orgId: id,
          ipAddress: AuditService.getIp(req), userAgent: AuditService.getUserAgent(req),
        });
      } catch (auditErr) { console.error('[AUDIT]', auditErr.message); }
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
      const { email, username, password, role, name, phone, orgId, groupIds } = req.body;

      if (!email || !password || !role) {
        return res.status(400).json({
          success: false,
          error: 'Email, password, and role are required.',
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
        username: username ? username.toLowerCase().trim() : null,
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
      // Audit: user created
      try {
        await AuditService.log({
          auditType: 'user', entityType: 'User',
          entityId: newUser.id, entityName: newUser.name || newUser.email, action: 'CREATED',
          newData: { email: newUser.email, role: newUser.role, name: newUser.name },
          performedById: req.user.userId, performedByRole: req.user.role,
          orgId: targetOrgId,
          ipAddress: AuditService.getIp(req), userAgent: AuditService.getUserAgent(req),
        });
      } catch (auditErr) { console.error('[AUDIT]', auditErr.message); }
    } catch (err) {
      next(err);
    }
  },

  async updateUser(req, res, next) {
    try {
      const { id } = req.params;
      const { email, username, role, name, phone, isActive, orgId, groupIds } = req.body;

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

      // Fetch old data for audit
      const oldUser = await UserModel.findById(id);
      if (!oldUser) {
        return res.status(404).json({
          success: false,
          error: 'User not found.',
          code: 'USER_NOT_FOUND'
        });
      }
      const oldGroups = await GroupModel.getUserGroups(id);
      const oldGroupIds = oldGroups.map(g => g.id);
      const oldGroupNames = await GroupModel.getNamesByIds(oldGroupIds);

      const oldData = {
        email: oldUser.email,
        role: oldUser.role,
        name: oldUser.name,
        phone: oldUser.phone,
        isActive: oldUser.is_active,
        groupNames: oldGroupNames
      };

      const updated = await UserModel.update(id, {
        email: email ? email.toLowerCase().trim() : undefined,
        username: username !== undefined ? (username ? username.toLowerCase().trim() : null) : undefined,
        role,
        name,
        phone,
        isActive,
        orgId: (req.user.role === 'superadmin') ? orgId : undefined
      });

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

      const finalGroupIds = groupIds !== undefined ? groupIds : oldGroupIds;
      const finalGroupNames = await GroupModel.getNamesByIds(finalGroupIds);

      const newData = {
        email: updated.email !== undefined ? updated.email : email,
        role: updated.role !== undefined ? updated.role : role,
        name: updated.name !== undefined ? updated.name : name,
        phone: updated.phone !== undefined ? updated.phone : phone,
        isActive: updated.is_active !== undefined ? updated.is_active : isActive,
        groupNames: finalGroupNames
      };

      // Audit: user updated
      try {
        await AuditService.log({
          auditType: 'user', entityType: 'User',
          entityId: id, entityName: updated.name || updated.email, action: 'UPDATED',
          oldData,
          newData,
          performedById: req.user.userId, performedByRole: req.user.role,
          orgId: req.user.orgId,
          ipAddress: AuditService.getIp(req), userAgent: AuditService.getUserAgent(req),
        });
      } catch (auditErr) { console.error('[AUDIT]', auditErr.message); }
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
      // Audit: user deleted
      try {
        await AuditService.log({
          auditType: 'user', entityType: 'User',
          entityId: id, action: 'DELETED',
          performedById: req.user.userId, performedByRole: req.user.role,
          orgId: req.user.orgId,
          ipAddress: AuditService.getIp(req), userAgent: AuditService.getUserAgent(req),
        });
      } catch (auditErr) { console.error('[AUDIT]', auditErr.message); }
    } catch (err) {
      next(err);
    }
  },

  async getUserVehicles(req, res, next) {
    try {
      const { id } = req.params;
      const result = await db.query(
        `SELECT v.id, v.name, v.plate, v.imei, vls.is_online
         FROM vehicles v
         JOIN vehicle_groups vg ON v.id = vg.vehicle_id
         JOIN user_groups ug ON vg.group_id = ug.group_id
         LEFT JOIN vehicle_latest_state vls ON v.id = vls.vehicle_id
         WHERE ug.user_id = $1 AND v.is_active = TRUE
         ORDER BY v.name ASC`,
        [id]
      );
      res.status(200).json({ success: true, data: result.rows });
    } catch (err) {
      next(err);
    }
  },

  // ============================================================
  // GROUPS
  // ============================================================
  async getAllGroups(req, res, next) {
    try {
      const groups = await GroupModel.findAll(req.user.orgId, req.user.role, req.user.userId);
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
      const { name, description, orgId, vehicleIds } = req.body;

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

      if (vehicleIds && Array.isArray(vehicleIds)) {
        await GroupModel.assignVehiclesToGroup(newGroup.id, vehicleIds);
      }

      res.status(201).json({
        success: true,
        data: newGroup,
        message: 'Group created successfully.'
      });
      // Audit: group created
      try {
        await AuditService.log({
          auditType: 'group', entityType: 'Group',
          entityId: newGroup.id, entityName: newGroup.name, action: 'CREATED',
          newData: { name: newGroup.name, description: newGroup.description },
          performedById: req.user.userId, performedByRole: req.user.role,
          orgId: targetOrgId,
          ipAddress: AuditService.getIp(req), userAgent: AuditService.getUserAgent(req),
        });
      } catch (auditErr) { console.error('[AUDIT]', auditErr.message); }
    } catch (err) {
      next(err);
    }
  },

  async updateGroup(req, res, next) {
    try {
      const { id } = req.params;
      const { name, description, isActive, orgId, vehicleIds } = req.body;

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

      // Fetch old data for audit
      const oldGroup = await GroupModel.findById(id);
      if (!oldGroup) {
        return res.status(404).json({
          success: false,
          error: 'Group not found.',
          code: 'GROUP_NOT_FOUND'
        });
      }
      const oldVehicleIds = await GroupModel.getAssignedVehicleIds(id);
      const oldVehicleNames = await VehicleModel.getNamesByIds(oldVehicleIds);

      const oldData = {
        name: oldGroup.name,
        description: oldGroup.description,
        isActive: oldGroup.is_active,
        vehicleNames: oldVehicleNames
      };

      const updated = await GroupModel.update(id, { name, description, isActive, orgId });

      if (vehicleIds && Array.isArray(vehicleIds)) {
        await GroupModel.assignVehiclesToGroup(id, vehicleIds);
      }

      res.status(200).json({
        success: true,
        data: updated,
        message: 'Group updated successfully.'
      });

      const finalVehicleIds = vehicleIds !== undefined ? vehicleIds : oldVehicleIds;
      const finalVehicleNames = await VehicleModel.getNamesByIds(finalVehicleIds);

      const newData = {
        name: updated.name !== undefined ? updated.name : name,
        description: updated.description !== undefined ? updated.description : description,
        isActive: updated.is_active !== undefined ? updated.is_active : isActive,
        vehicleNames: finalVehicleNames
      };

      // Audit: group updated
      try {
        await AuditService.log({
          auditType: 'group', entityType: 'Group',
          entityId: id, entityName: updated.name, action: 'UPDATED',
          oldData,
          newData,
          performedById: req.user.userId, performedByRole: req.user.role,
          orgId: req.user.orgId,
          ipAddress: AuditService.getIp(req), userAgent: AuditService.getUserAgent(req),
        });
      } catch (auditErr) { console.error('[AUDIT]', auditErr.message); }
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
      // Audit: group deleted
      try {
        await AuditService.log({
          auditType: 'group', entityType: 'Group',
          entityId: id, action: 'DELETED',
          performedById: req.user.userId, performedByRole: req.user.role,
          orgId: req.user.orgId,
          ipAddress: AuditService.getIp(req), userAgent: AuditService.getUserAgent(req),
        });
      } catch (auditErr) { console.error('[AUDIT]', auditErr.message); }
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
  },

  async getDevices(req, res) {
    try {
      let query = `
        SELECT 
          d.*, 
          o.name as org_name,
          vls.is_online,
          vls.last_seen
        FROM devices d
        LEFT JOIN organizations o ON d.org_id = o.id
        LEFT JOIN vehicles v ON d.device_id = v.imei
        LEFT JOIN vehicle_latest_state vls ON v.id = vls.vehicle_id
      `;
      let params = [];

      if (req.user.role !== 'superadmin') {
        query += ` WHERE d.org_id = $1`;
        params.push(req.user.orgId);
      }

      query += ` ORDER BY d.created_at DESC`;

      const result = await db.query(query, params);
      res.json({ success: true, data: result.rows });
    } catch (err) {
      console.error('Error fetching devices:', err);
      res.status(500).json({ success: false, error: 'Failed to fetch devices' });
    }
  },

  async deleteDevice(req, res) {
    try {
      const { id } = req.params;

      if (req.user.role !== 'superadmin') {
        const deviceRes = await db.query('SELECT org_id FROM devices WHERE id = $1', [id]);
        if (deviceRes.rows.length === 0) {
          return res.status(404).json({ success: false, error: 'Device not found.' });
        }
        if (deviceRes.rows[0].org_id !== req.user.orgId) {
          return res.status(403).json({ success: false, error: 'Access denied.' });
        }
      }

      const result = await db.query('DELETE FROM devices WHERE id = $1 RETURNING id', [id]);
      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Device not found.' });
      }

      res.status(200).json({ success: true, message: 'Device deleted successfully.' });
      // Audit: device deleted
      try {
        await AuditService.log({
          auditType: 'device', entityType: 'Device',
          entityId: id, action: 'DELETED',
          performedById: req.user.userId, performedByRole: req.user.role,
          orgId: req.user.orgId,
          ipAddress: AuditService.getIp(req), userAgent: AuditService.getUserAgent(req),
        });
      } catch (auditErr) { console.error('[AUDIT]', auditErr.message); }
    } catch (err) {
      console.error('Error deleting device:', err);
      res.status(500).json({ success: false, error: 'Failed to delete device' });
    }
  },

  // ============================================================
  // BILLING
  // ============================================================
  async getExpiredBillingLicenses(req, res, next) {
    try {
      let whereClause = `v.is_active = TRUE AND v.licence_expire_date <= CURRENT_DATE`;
      const params = [];

      if (req.user.role !== 'superadmin') {
        params.push(req.user.orgId);
        whereClause += ` AND (v.org_id = $1 OR v.org_id IN (SELECT id FROM organizations WHERE parent_id = $1))`;
      }

      const query = `
        SELECT 
          v.id AS db_vehicle_id, 
          v.metadata->>'vehicleId' AS vehicle_id,
          v.name AS vehicle_name, 
          v.imei AS device_id, 
          v.model AS device_model, 
          v.gps_sim_no, 
          v.licence_issued_date, 
          v.licence_expire_date, 
          d.licence_id, 
          o.name AS org_name, 
          p.name AS dealer_name
        FROM vehicles v
        JOIN organizations o ON v.org_id = o.id
        LEFT JOIN organizations p ON o.parent_id = p.id
        LEFT JOIN devices d ON v.imei = d.device_id
        WHERE ${whereClause}
        ORDER BY v.licence_expire_date ASC
      `;

      const result = await db.query(query, params);

      const data = result.rows.map(row => {
        let licenceType = 'Unknown';
        if (row.licence_id) {
          if (row.licence_id.startsWith('ST')) licenceType = 'Starter';
          else if (row.licence_id.startsWith('BC')) licenceType = 'Basic';
          else if (row.licence_id.startsWith('AD')) licenceType = 'Advanced';
          else if (row.licence_id.startsWith('EN')) licenceType = 'Premium';
        }
        
        return {
          licenceId: row.licence_id || '-',
          vehicleId: row.vehicle_id || '-',
          vehicleName: row.vehicle_name,
          licenceType: licenceType,
          deviceId: row.device_id,
          organization: row.org_name,
          deviceModel: row.device_model || '-',
          dealerName: row.dealer_name || row.org_name,
          gpsSimNo: row.gps_sim_no || '-',
          licenceIssuedDate: row.licence_issued_date,
          licenceExpiryDate: row.licence_expire_date,
          status: 'Expired'
        };
      });

      res.status(200).json({ success: true, data });
    } catch (err) {
      console.error('Error fetching expired licenses:', err);
      res.status(500).json({ success: false, error: 'Failed to fetch billing data' });
    }
  },

  async impersonateUser(req, res, next) {
    try {
      const { id } = req.params;

      // Ownership check: dealers can only impersonate users in their own org or child orgs
      if (req.user.role !== 'superadmin') {
        const user = await UserModel.findById(id);
        if (!user) {
          return res.status(404).json({
            success: false,
            error: 'User not found.',
            code: 'USER_NOT_FOUND'
          });
        }
        // Check if user belongs to dealer's org or dealer's child orgs
        const org = await OrgModel.findById(user.org_id);
        const isAuthorized = user.org_id === req.user.orgId || (org && org.parent_id === req.user.orgId);
        if (!isAuthorized) {
          return res.status(403).json({
            success: false,
            error: 'Access denied to impersonate this user.',
            code: 'FORBIDDEN'
          });
        }
      }

      const user = await UserModel.findById(id);
      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found.',
          code: 'USER_NOT_FOUND'
        });
      }

      // Generate JWT for target user
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

      // Fetch impersonator to log their name
      const impersonator = await UserModel.findById(req.user.userId);
      const impersonatorName = impersonator ? (impersonator.name || impersonator.email) : req.user.userId;

      // Audit: impersonate success
      try {
        await AuditService.log({
          auditType: 'login',
          entityType: 'User',
          entityId: user.id,
          entityName: user.name || user.email,
          action: 'IMPERSONATE_SUCCESS',
          newData: { email: user.email, role: user.role, impersonatedBy: impersonatorName },
          performedById: req.user.userId,
          performedByRole: req.user.role,
          orgId: user.org_id,
          orgName: user.org_name,
          ipAddress: AuditService.getIp(req),
          userAgent: AuditService.getUserAgent(req),
        });
      } catch (auditErr) {
        console.error('[AUDIT]', auditErr.message);
      }

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
        message: 'Impersonation successful'
      });
    } catch (err) {
      next(err);
    }
  },

  // ============================================================
  // DEVICE QUOTA (for Dealer organisations)
  // ============================================================

  /**
   * GET /api/admin/device-quota?orgId=<dealerOrgId>
   * Returns the allowed limits + how many are already used per tier.
   * Superadmin can query any org; dealer can only query their own.
   */
  async getDeviceQuota(req, res, next) {
    try {
      const targetOrgId = req.query.orgId || req.user.orgId;

      // Dealers may only query their own org
      if (req.user.role !== 'superadmin' && targetOrgId !== req.user.orgId) {
        return res.status(403).json({ success: false, error: 'Access denied.', code: 'FORBIDDEN' });
      }

      const orgResult = await db.query(
        `SELECT device_limits FROM organizations WHERE id = $1`,
        [targetOrgId]
      );
      if (orgResult.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Organization not found.' });
      }

      const limits = orgResult.rows[0].device_limits || { Starter: 0, Basic: 0, Advanced: 0, Premium: 0 };

      // Count devices registered for this org by licence prefix
      const usedResult = await db.query(
        `SELECT
           COUNT(*) FILTER (WHERE licence_id LIKE 'ST%') AS "Starter",
           COUNT(*) FILTER (WHERE licence_id LIKE 'BC%') AS "Basic",
           COUNT(*) FILTER (WHERE licence_id LIKE 'AD%') AS "Advanced",
           COUNT(*) FILTER (WHERE licence_id LIKE 'EN%') AS "Premium"
         FROM devices
         WHERE org_id = $1`,
        [targetOrgId]
      );

      const used = {
        Starter:  parseInt(usedResult.rows[0]?.Starter  || 0, 10),
        Basic:    parseInt(usedResult.rows[0]?.Basic    || 0, 10),
        Advanced: parseInt(usedResult.rows[0]?.Advanced || 0, 10),
        Premium:  parseInt(usedResult.rows[0]?.Premium  || 0, 10),
      };

      const available = {
        Starter:  Math.max(0, (limits.Starter  || 0) - used.Starter),
        Basic:    Math.max(0, (limits.Basic    || 0) - used.Basic),
        Advanced: Math.max(0, (limits.Advanced || 0) - used.Advanced),
        Premium:  Math.max(0, (limits.Premium  || 0) - used.Premium),
      };

      res.status(200).json({ success: true, data: { limits, used, available } });
    } catch (err) {
      next(err);
    }
  },

  /**
   * PATCH /api/admin/org/:id/device-limits
   * Superadmin updates the device_limits for a dealer org.
   */
  async setDeviceLimits(req, res, next) {
    try {
      if (req.user.role !== 'superadmin') {
        return res.status(403).json({ success: false, error: 'Only superadmin can set device limits.', code: 'FORBIDDEN' });
      }

      const { id } = req.params;
      const { deviceLimits } = req.body;

      if (!deviceLimits || typeof deviceLimits !== 'object') {
        return res.status(400).json({ success: false, error: 'deviceLimits is required and must be an object.' });
      }

      const sanitized = {
        Starter:  Math.max(0, parseInt(deviceLimits.Starter  || 0, 10)),
        Basic:    Math.max(0, parseInt(deviceLimits.Basic    || 0, 10)),
        Advanced: Math.max(0, parseInt(deviceLimits.Advanced || 0, 10)),
        Premium:  Math.max(0, parseInt(deviceLimits.Premium  || 0, 10)),
      };

      const result = await db.query(
        `UPDATE organizations SET device_limits = $1::jsonb, updated_at = NOW() WHERE id = $2 RETURNING id, name, device_limits`,
        [JSON.stringify(sanitized), id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Organization not found.' });
      }

      // Audit
      try {
        await AuditService.log({
          auditType: 'organization', entityType: 'Organization',
          entityId: id, entityName: result.rows[0].name, action: 'UPDATED',
          newData: { deviceLimits: sanitized },
          performedById: req.user.userId, performedByRole: req.user.role,
          orgId: id,
          ipAddress: AuditService.getIp(req), userAgent: AuditService.getUserAgent(req),
        });
      } catch (auditErr) { console.error('[AUDIT]', auditErr.message); }

      res.status(200).json({ success: true, data: result.rows[0], message: 'Device limits updated.' });
    } catch (err) {
      next(err);
    }
  },

  // ============================================================
  // RENEWALS CONFIG & TRANSACTIONS
  // ============================================================
  async getRenewalPlans(req, res, next) {
    try {
      let query = `
        SELECT p.*, o.name as org_name, u.name as user_name, g.name as group_name
        FROM renewal_plans p
        LEFT JOIN organizations o ON p.org_id = o.id
        LEFT JOIN users u ON p.user_id = u.id
        LEFT JOIN groups g ON p.group_id = g.id
        WHERE p.is_active = true
      `;
      let params = [];
      if (req.user.role !== 'superadmin') {
        query += ` AND (p.org_id = $1 OR p.org_id IN (SELECT id FROM organizations WHERE parent_id = $1))`;
        params.push(req.user.orgId);
      }
      query += ` ORDER BY p.duration_months ASC, p.price ASC`;
      
      const result = await db.query(query, params);
      res.status(200).json({ success: true, data: result.rows });
    } catch (err) {
      next(err);
    }
  },

  async createRenewalPlan(req, res, next) {
    try {
      const { name, duration_months, price, org_id, user_id, group_id } = req.body;
      if (!name || !duration_months || !price) {
        return res.status(400).json({ success: false, error: 'Name, duration, and price are required.' });
      }

      if (req.user.role !== 'superadmin' && !org_id) {
        return res.status(403).json({ success: false, error: 'Only superadmins can create global plans.' });
      }

      // If dealer, ensure they can only assign to their org or a sub-org
      if (req.user.role !== 'superadmin' && org_id !== req.user.orgId) {
        const check = await db.query('SELECT id FROM organizations WHERE id = $1 AND parent_id = $2', [org_id, req.user.orgId]);
        if (check.rows.length === 0) {
          return res.status(403).json({ success: false, error: 'Cannot create plan for this organization.' });
        }
      }

      const result = await db.query(
        'INSERT INTO renewal_plans (name, duration_months, price, org_id, user_id, group_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
        [name, duration_months, price, org_id || null, user_id || null, group_id || null]
      );
      res.status(201).json({ success: true, data: result.rows[0], message: 'Renewal plan created successfully.' });
    } catch (err) {
      next(err);
    }
  },

  async deleteRenewalPlan(req, res, next) {
    try {
      const { id } = req.params;
      
      // Check permissions
      const planRes = await db.query('SELECT org_id FROM renewal_plans WHERE id = $1', [id]);
      if (planRes.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Plan not found.' });
      }
      const plan = planRes.rows[0];

      if (req.user.role !== 'superadmin') {
        if (!plan.org_id) return res.status(403).json({ success: false, error: 'Cannot delete global plans.' });
        if (plan.org_id !== req.user.orgId) {
          const check = await db.query('SELECT id FROM organizations WHERE id = $1 AND parent_id = $2', [plan.org_id, req.user.orgId]);
          if (check.rows.length === 0) return res.status(403).json({ success: false, error: 'Cannot delete this plan.' });
        }
      }

      await db.query('UPDATE renewal_plans SET is_active = false WHERE id = $1', [id]);
      res.status(200).json({ success: true, message: 'Plan deleted successfully.' });
    } catch (err) {
      next(err);
    }
  },

  async updateRenewalPlan(req, res, next) {
    try {
      const { id } = req.params;
      const { name, duration_months, price, org_id, user_id, group_id } = req.body;

      if (!name || !duration_months || !price) {
        return res.status(400).json({ success: false, error: 'Name, duration, and price are required.' });
      }

      // Check permissions
      const planRes = await db.query('SELECT org_id FROM renewal_plans WHERE id = $1', [id]);
      if (planRes.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Plan not found.' });
      }
      const plan = planRes.rows[0];

      if (req.user.role !== 'superadmin') {
        if (!plan.org_id) return res.status(403).json({ success: false, error: 'Cannot edit global plans.' });
        if (plan.org_id !== req.user.orgId) {
          const check = await db.query('SELECT id FROM organizations WHERE id = $1 AND parent_id = $2', [plan.org_id, req.user.orgId]);
          if (check.rows.length === 0) return res.status(403).json({ success: false, error: 'Cannot edit this plan.' });
        }
        if (org_id !== plan.org_id) {
          // If trying to change the org_id
          if (!org_id) return res.status(403).json({ success: false, error: 'Only superadmins can make plans global.' });
          if (org_id !== req.user.orgId) {
            const checkNewOrg = await db.query('SELECT id FROM organizations WHERE id = $1 AND parent_id = $2', [org_id, req.user.orgId]);
            if (checkNewOrg.rows.length === 0) return res.status(403).json({ success: false, error: 'Cannot assign plan to this organization.' });
          }
        }
      }

      const result = await db.query(
        'UPDATE renewal_plans SET name = $1, duration_months = $2, price = $3, org_id = $4, user_id = $5, group_id = $6 WHERE id = $7 RETURNING *',
        [name, duration_months, price, org_id || null, user_id || null, group_id || null, id]
      );
      res.status(200).json({ success: true, data: result.rows[0], message: 'Plan updated successfully.' });
    } catch (err) {
      next(err);
    }
  },

  async getRenewalTransactions(req, res, next) {
    try {
      let query = `
        SELECT rt.*, u.name as user_name, u.email as user_email, v.name as vehicle_name, p.name as plan_name
        FROM renewal_transactions rt
        JOIN users u ON rt.user_id = u.id
        JOIN vehicles v ON rt.vehicle_id = v.id
        LEFT JOIN renewal_plans p ON rt.plan_id = p.id
      `;
      let params = [];

      if (req.user.role !== 'superadmin') {
        query += ` WHERE u.org_id = $1 OR u.org_id IN (SELECT id FROM organizations WHERE parent_id = $1)`;
        params.push(req.user.orgId);
      }

      query += ` ORDER BY rt.created_at DESC`;
      const result = await db.query(query, params);
      res.status(200).json({ success: true, data: result.rows });
    } catch (err) {
      next(err);
    }
  }
};

module.exports = AdminController;
