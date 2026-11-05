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
const { redis } = require('../config/redis');
const AuditService = require('../services/auditService');
const WhatsAppService = require('../services/whatsappService');

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

  async getOrgResources(req, res, next) {
    try {
      const { id } = req.params;
      const resources = await OrgModel.getOrgResources(id);
      res.status(200).json({
        success: true,
        data: resources
      });
    } catch (err) {
      next(err);
    }
  },

  async createOrg(req, res, next) {
    try {
      const { name, type, parentId, address, phone, contactPerson, email, assignedUserIds, settings } = req.body;

      if (!name || !type) {
        return res.status(400).json({
          success: false,
          error: 'Name and type are required.',
          code: 'VALIDATION_ERROR'
        });
      }

      // Preemptive Duplicate Check: No 2 organizations can have the same name
      const dupOrg = await db.query(
        'SELECT id FROM organizations WHERE LOWER(TRIM(name)) = LOWER(TRIM($1)) LIMIT 1',
        [name]
      );
      if (dupOrg.rows.length > 0) {
        return res.status(400).json({
          success: false,
          error: `An organization with the name "${name.trim()}" already exists.`,
          code: 'DUPLICATE_ORG_NAME'
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
        email,
        settings: settings || {}
      });

      // Handle user assignments
      if (assignedUserIds && Array.isArray(assignedUserIds)) {
        for (const uid of assignedUserIds) {
          try {
            await UserModel.update(uid, { orgId: newOrg.id });
          } catch (e) { console.error('[ASSIGN_USER_ERROR]', e.message); }
        }
      }

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
      const { name, type, address, phone, isActive, contactPerson, email, assignedUserIds, settings } = req.body;

      // Fetch old org
      const oldOrg = await OrgModel.findById(id);
      if (!oldOrg) {
        return res.status(404).json({
          success: false,
          error: 'Organization not found.',
          code: 'ORG_NOT_FOUND'
        });
      }

      if (req.user && req.user.role !== 'superadmin' && id !== req.user.orgId) {
        // Dealers can only update their child orgs
        if (oldOrg.parent_id !== req.user.orgId) {
          return res.status(403).json({
            success: false,
            error: 'Access denied to update organization.',
            code: 'FORBIDDEN'
          });
        }
      }

      // Duplicate Check on Rename
      if (name && name.trim().toLowerCase() !== (oldOrg.name || '').trim().toLowerCase()) {
        const dupOrg = await db.query(
          'SELECT id FROM organizations WHERE LOWER(TRIM(name)) = LOWER(TRIM($1)) AND id != $2 LIMIT 1',
          [name, id]
        );
        if (dupOrg.rows.length > 0) {
          return res.status(400).json({
            success: false,
            error: `An organization with the name "${name.trim()}" already exists.`,
            code: 'DUPLICATE_ORG_NAME'
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

      const updated = await OrgModel.update(id, { name, type, address, phone, isActive, contactPerson, email, settings });

      res.status(200).json({
        success: true,
        data: updated,
        message: 'Organization updated successfully.'
      });

      // Handle user assignments
      if (assignedUserIds && Array.isArray(assignedUserIds)) {
        for (const uid of assignedUserIds) {
          try {
            await UserModel.update(uid, { orgId: id });
          } catch (e) { console.error('[ASSIGN_USER_ERROR]', e.message); }
        }
      }

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
          performedById: req.user?.userId || 'system', performedByRole: req.user?.role || 'admin',
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

      // Safety guard: never allow deletion of an org that hosts superadmin users
      const orgToDelete = await OrgModel.findById(id);
      if (!orgToDelete) {
        return res.status(404).json({
          success: false,
          error: 'Organization not found.',
          code: 'ORG_NOT_FOUND'
        });
      }
      if (parseInt(orgToDelete.superadmin_count) > 0) {
        return res.status(403).json({
          success: false,
          error: 'This organization hosts superadmin accounts and cannot be deleted. Reassign superadmin users first.',
          code: 'PROTECTED_ORG'
        });
      }

      // Proactive Brain Safeguard: Never delete an org that currently has active devices or vehicles
      const deviceCheck = await db.query('SELECT COUNT(*) FROM devices WHERE org_id = $1', [id]);
      const vehicleCheck = await db.query('SELECT COUNT(*) FROM vehicles WHERE org_id = $1', [id]);
      if (parseInt(deviceCheck.rows[0].count) > 0 || parseInt(vehicleCheck.rows[0].count) > 0) {
        return res.status(400).json({
          success: false,
          error: `Safety Guard: Cannot delete this organization. It contains ${deviceCheck.rows[0].count} device(s) and ${vehicleCheck.rows[0].count} vehicle(s). Please move or unassign them first.`,
          code: 'ORGANIZATION_HAS_DEVICES'
        });
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
      const { email, username, password, role, name, phone, orgId, groupIds, newOrgName, autoCreateGroup, noDataMinutes, deviceLimits } = req.body;

      if (!email || !password || !role) {
        return res.status(400).json({
          success: false,
          error: 'Email, password, and role are required.',
          code: 'VALIDATION_ERROR'
        });
      }

      // Preemptive Duplicate Checks for User
      if (username && username.trim()) {
        const dupUser = await db.query(
          'SELECT id FROM users WHERE LOWER(TRIM(username)) = LOWER(TRIM($1)) LIMIT 1',
          [username]
        );
        if (dupUser.rows.length > 0) {
          return res.status(400).json({
            success: false,
            error: `The username "${username.trim()}" is already taken. Please choose a different username.`,
            code: 'DUPLICATE_USERNAME'
          });
        }
      }

      if (email && email.trim()) {
        const dupEmail = await db.query(
          'SELECT id FROM users WHERE LOWER(TRIM(email)) = LOWER(TRIM($1)) LIMIT 1',
          [email]
        );
        if (dupEmail.rows.length > 0) {
          return res.status(400).json({
            success: false,
            error: `A user with email "${email.trim()}" already exists.`,
            code: 'DUPLICATE_EMAIL'
          });
        }
      }

      // Check role authorization
      if (req.user.role !== 'superadmin') {
        // Dealer cannot create superadmins
        if (role === 'superadmin') {
          return res.status(403).json({
            success: false,
            error: 'Unauthorized role assignment.',
            code: 'FORBIDDEN'
          });
        }
      }

      // Check if an existing org was explicitly provided:
      let targetOrgId = (orgId && typeof orgId === 'string' && orgId.trim() && orgId !== 'auto') ? orgId.trim() : null;

      // If NO organization was chosen (empty, null, or 'auto') OR a newOrgName was explicitly provided:
      // AUTOMATICALLY create / use organization with username (or newOrgName)!
      if (!targetOrgId || (newOrgName && newOrgName.trim())) {
        const finalOrgName = (newOrgName && newOrgName.trim())
          ? newOrgName.trim()
          : (username || name || email).trim();

        const parentOrgId = req.user.role === 'superadmin' ? null : req.user.orgId;

        // Check if an organization with this name already exists in this scope
        let existingOrg;
        if (parentOrgId) {
          existingOrg = await db.query(
            `SELECT id FROM organizations WHERE LOWER(TRIM(name)) = LOWER(TRIM($1)) AND (parent_id = $2 OR id = $2) LIMIT 1`,
            [finalOrgName, parentOrgId]
          );
        } else {
          existingOrg = await db.query(
            `SELECT id FROM organizations WHERE LOWER(TRIM(name)) = LOWER(TRIM($1)) LIMIT 1`,
            [finalOrgName]
          );
        }

        if (existingOrg && existingOrg.rows.length > 0) {
          targetOrgId = existingOrg.rows[0].id;
        } else {
          const createdOrg = await OrgModel.create({
            name: finalOrgName,
            type: role === 'dealer' ? 'dealer' : 'customer',
            parentId: parentOrgId,
            email: email.toLowerCase().trim(),
            phone: phone || null,
            contactPerson: name || null
          });
          targetOrgId = createdOrg.id;
        }
      } else if (req.user.role !== 'superadmin') {
        const targetOrg = await OrgModel.findById(targetOrgId);
        if (!targetOrg || (targetOrg.id !== req.user.orgId && targetOrg.parent_id !== req.user.orgId)) {
          return res.status(403).json({
            success: false,
            error: 'Must create user inside your organization tree.',
            code: 'FORBIDDEN'
          });
        }
      }

      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      const newUser = await UserModel.create({
        orgId: targetOrgId,
        email: email.toLowerCase().trim(),
        username: username ? username.toLowerCase().trim() : null,
        password: hashedPassword,
        role,
        name,
        phone,
        tempPassword: password,
        noDataMinutes: noDataMinutes !== undefined ? (parseInt(noDataMinutes, 10) || 30) : 30
      });

      // Persist dealer device limits / quota if provided
      if (role === 'dealer' && deviceLimits && typeof deviceLimits === 'object' && targetOrgId) {
        const sanitizedLimits = {
          Starter: Math.max(0, parseInt(deviceLimits.Starter || 0, 10)),
          Basic: Math.max(0, parseInt(deviceLimits.Basic || 0, 10)),
          Advanced: Math.max(0, parseInt(deviceLimits.Advanced || 0, 10)),
          Premium: Math.max(0, parseInt(deviceLimits.Premium || 0, 10)),
        };
        await db.query(
          'UPDATE organizations SET device_limits = $1::jsonb, updated_at = NOW() WHERE id = $2',
          [JSON.stringify(sanitizedLimits), targetOrgId]
        );
      }

      // Handle user group assignments
      const allGroupIds = new Set();

      // 1. Assign selected existing groups if provided
      if (groupIds && Array.isArray(groupIds) && groupIds.length > 0) {
        for (const gId of groupIds) {
          if (req.user.role === 'superadmin') {
            allGroupIds.add(gId);
          } else {
            const belongs = await GroupModel.belongsToOrg(gId, targetOrgId);
            if (belongs) allGroupIds.add(gId);
          }
        }
      }

      // 2. Only auto-create a group if:
      //    a) explicitly requested via autoCreateGroup === true, OR
      //    b) no existing groups were selected at all (fallback to ensure user has a group)
      const shouldAutoCreate = autoCreateGroup === true || allGroupIds.size === 0;

      if (shouldAutoCreate) {
        const autoGroupName = (username || name || email).trim();
        if (autoGroupName) {
          const existingGroup = await db.query(
            `SELECT id FROM groups WHERE org_id = $1 AND LOWER(TRIM(name)) = LOWER(TRIM($2))`,
            [targetOrgId, autoGroupName]
          );
          if (existingGroup.rows.length > 0) {
            allGroupIds.add(existingGroup.rows[0].id);
          } else {
            const createdGroup = await GroupModel.create({
              orgId: targetOrgId,
              name: autoGroupName,
              description: `Auto-created group for user ${autoGroupName}`
            });
            allGroupIds.add(createdGroup.id);
          }
        }
      }

      if (allGroupIds.size > 0) {
        await GroupModel.assignUserToGroups(newUser.id, Array.from(allGroupIds));
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
      const { email, username, role, name, phone, isActive, orgId, groupIds, password, noDataMinutes, deviceLimits } = req.body;

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

      // Duplicate Checks on Update
      if (username && username.trim().toLowerCase() !== (oldUser.username || '').trim().toLowerCase()) {
        const dupUser = await db.query(
          'SELECT id FROM users WHERE LOWER(TRIM(username)) = LOWER(TRIM($1)) AND id != $2 LIMIT 1',
          [username, id]
        );
        if (dupUser.rows.length > 0) {
          return res.status(400).json({
            success: false,
            error: `The username "${username.trim()}" is already taken. Please choose a different username.`,
            code: 'DUPLICATE_USERNAME'
          });
        }
      }

      if (email && email.trim().toLowerCase() !== (oldUser.email || '').trim().toLowerCase()) {
        const dupEmail = await db.query(
          'SELECT id FROM users WHERE LOWER(TRIM(email)) = LOWER(TRIM($1)) AND id != $2 LIMIT 1',
          [email, id]
        );
        if (dupEmail.rows.length > 0) {
          return res.status(400).json({
            success: false,
            error: `A user with email "${email.trim()}" already exists.`,
            code: 'DUPLICATE_EMAIL'
          });
        }
      }

      const updated = await UserModel.update(id, {
        email: email ? email.toLowerCase().trim() : undefined,
        username: username !== undefined ? (username ? username.toLowerCase().trim() : null) : undefined,
        role,
        name,
        phone,
        isActive,
        orgId: (req.user.role === 'superadmin') ? orgId : undefined,
        noDataMinutes: noDataMinutes !== undefined ? (parseInt(noDataMinutes, 10) || 30) : undefined
      });

      // Persist dealer device limits / quota if provided
      const targetOrgForLimits = (req.user.role === 'superadmin' && orgId) ? orgId : (updated?.org_id || oldUser?.org_id);
      if (deviceLimits && typeof deviceLimits === 'object' && targetOrgForLimits) {
        const sanitizedLimits = {
          Starter: Math.max(0, parseInt(deviceLimits.Starter || 0, 10)),
          Basic: Math.max(0, parseInt(deviceLimits.Basic || 0, 10)),
          Advanced: Math.max(0, parseInt(deviceLimits.Advanced || 0, 10)),
          Premium: Math.max(0, parseInt(deviceLimits.Premium || 0, 10)),
        };
        await db.query(
          'UPDATE organizations SET device_limits = $1::jsonb, updated_at = NOW() WHERE id = $2',
          [JSON.stringify(sanitizedLimits), targetOrgForLimits]
        );
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

      // Update password if explicitly provided by admin in Edit User
      if (password && String(password).trim() !== '') {
        const customPass = String(password).trim();
        const salt = await bcrypt.genSalt(10);
        const hashed = await bcrypt.hash(customPass, salt);
        await UserModel.updatePassword(id, hashed, customPass);
        updated.temp_password = customPass;
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

  async sendUserCredentialsWhatsApp(req, res, next) {
    try {
      const { id } = req.params;
      const userRes = await db.query(
        'SELECT id, org_id, name, username, phone, email, temp_password FROM users WHERE id = $1',
        [id]
      );
      if (userRes.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }
      const targetUser = userRes.rows[0];
      const destinationPhone = req.body.phone ? String(req.body.phone).trim() : targetUser.phone;
      if (!destinationPhone) {
        return res.status(400).json({ success: false, error: 'User does not have a valid phone number' });
      }

      // Safeguard: Sending a WhatsApp notification must NEVER overwrite or mutate the user's account password.
      // Password updates are strictly handled via Edit User or the Password Reset workflow.
      // If user has no temp_password recorded in DB, initialize default password '223344' so customer can log in
      if (!targetUser.temp_password) {
        const defaultPass = '223344';
        const salt = await bcrypt.genSalt(10);
        const hashed = await bcrypt.hash(defaultPass, salt);
        await UserModel.updatePassword(id, hashed, defaultPass);
        targetUser.temp_password = defaultPass;
      }


      // Check if user has an assigned vehicle for {{2}}
      let vehiclePlate = 'Fleet Tracking';
      const vehRes = await db.query(
        `SELECT v.plate, v.name FROM vehicles v
         JOIN vehicle_groups vg ON v.id = vg.vehicle_id
         JOIN user_groups ug ON vg.group_id = ug.group_id
         WHERE ug.user_id = $1 LIMIT 1`,
        [id]
      );
      if (vehRes.rows.length > 0) {
        vehiclePlate = vehRes.rows[0].plate || vehRes.rows[0].name || 'Fleet Tracking';
      }

      // Send the approved Meta template
      let templateResult = await WhatsAppService.sendTemplate({
        to: destinationPhone,
        name: 'fueltracks_customer_credentials_template',
        language: 'en',
        bodyParams: [targetUser.name || 'Customer', vehiclePlate]
      });

      // Safeguard: If parameter count mismatch (e.g., template expects 1 param instead of 2), retry with 1 param
      if (!templateResult.ok && (templateResult.error_code === 132000 || String(templateResult.error_message).toLowerCase().includes('param'))) {
        templateResult = await WhatsAppService.sendTemplate({
          to: destinationPhone,
          name: 'fueltracks_customer_credentials_template',
          language: 'en',
          bodyParams: [targetUser.name || 'Customer']
        });
      }

      if (!templateResult.ok) {
        return res.status(500).json({
          success: false,
          error: templateResult.error_message || 'Failed to dispatch Meta WhatsApp template',
          code: templateResult.error_code,
          mock: templateResult.mock
        });
      }

      return res.json({
        success: true,
        message: 'WhatsApp template sent successfully via Meta Cloud API',
        wamid: templateResult.wamid,
        mock: templateResult.mock
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
        `SELECT DISTINCT v.id, v.name, v.plate, v.imei, vls.is_online,
                g.id AS group_id, g.name AS group_name
         FROM vehicles v
         JOIN vehicle_groups vg ON v.id = vg.vehicle_id
         JOIN user_groups ug ON vg.group_id = ug.group_id
         JOIN groups g ON vg.group_id = g.id
         LEFT JOIN vehicle_latest_state vls ON v.id = vls.vehicle_id
         WHERE ug.user_id = $1 AND v.is_active = TRUE
         ORDER BY g.name ASC, v.name ASC`,
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

      if (!name || !name.trim()) {
        return res.status(400).json({
          success: false,
          error: 'Group name is required.',
          code: 'VALIDATION_ERROR'
        });
      }

      // Preemptive Duplicate Check: No 2 groups can have the same name
      const dupGroup = await db.query(
        'SELECT id FROM groups WHERE LOWER(TRIM(name)) = LOWER(TRIM($1)) LIMIT 1',
        [name]
      );
      if (dupGroup.rows.length > 0) {
        return res.status(400).json({
          success: false,
          error: `A group with the name "${name.trim()}" already exists. Please choose a different name.`,
          code: 'DUPLICATE_GROUP_NAME'
        });
      }

      let targetOrgId = req.user.orgId;
      if (req.user.role === 'superadmin' && orgId) {
        targetOrgId = orgId;
      }
      if (!targetOrgId) {
        const defaultOrgResult = await db.query("SELECT id FROM organizations WHERE type = 'super' LIMIT 1");
        if (defaultOrgResult.rows.length > 0) {
          targetOrgId = defaultOrgResult.rows[0].id;
        } else {
          const anyOrg = await db.query("SELECT id FROM organizations LIMIT 1");
          targetOrgId = anyOrg.rows[0]?.id;
        }
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

      const targetOrgId = (orgId !== undefined && orgId !== null && orgId !== '') ? orgId : oldGroup.org_id;
      // Duplicate Check on Group Rename
      if (name && name.trim().toLowerCase() !== (oldGroup.name || '').trim().toLowerCase()) {
        const dupGroup = await db.query(
          'SELECT id FROM groups WHERE LOWER(TRIM(name)) = LOWER(TRIM($1)) AND id != $2 LIMIT 1',
          [name, id]
        );
        if (dupGroup.rows.length > 0) {
          return res.status(400).json({
            success: false,
            error: `A group with the name "${name.trim()}" already exists. Please choose a different name.`,
            code: 'DUPLICATE_GROUP_NAME'
          });
        }
      }

      const updated = await GroupModel.update(id, { name, description, isActive, orgId: targetOrgId });

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
  // DASHBOARD STATS (Cached in-memory for 15s to prevent query floods)
  // ============================================================
  _statsCache: new Map(),
  _STATS_CACHE_TTL: 15000,

  async getDashboardStats(req, res, next) {
    try {
      let noDataMinutes = 30;
      if (req.query.noDataMinutes) {
        noDataMinutes = Math.max(1, parseInt(req.query.noDataMinutes, 10) || 30);
      } else if (req.query.thresholdHours) {
        noDataMinutes = Math.max(1, Math.round((parseFloat(req.query.thresholdHours) || 0.5) * 60));
      }

      const cacheKey = `${req.user?.role || 'user'}:${req.user?.orgId || 'root'}:${noDataMinutes}`;
      const now = Date.now();
      const cached = AdminController._statsCache.get(cacheKey);
      if (cached && (now - cached.timestamp) < AdminController._STATS_CACHE_TTL) {
        return res.status(200).json({
          success: true,
          data: cached.data
        });
      }

      const stats = await GpsModel.getDashboardStats(req.user.orgId, req.user.role, noDataMinutes);
      AdminController._statsCache.set(cacheKey, { timestamp: now, data: stats });

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
      // Parse optional threshold query param (in hours or minutes), default 30 minutes (0.5 hour)
      let noDataMinutes = 30;
      if (req.query.noDataMinutes) {
        noDataMinutes = Math.max(1, parseInt(req.query.noDataMinutes, 10) || 30);
      } else if (req.query.thresholdHours) {
        noDataMinutes = Math.max(1, Math.round((parseFloat(req.query.thresholdHours) || 0.5) * 60));
      }

      let query = `
        SELECT 
          d.*, 
          o.name as org_name,
          v.id as vehicle_uuid,
          COALESCE(v.name, v.plate) as vehicle_name,
          CASE 
            WHEN vls.last_seen >= NOW() - ($1 || ' minutes')::INTERVAL THEN TRUE
            ELSE FALSE 
          END as is_online,
          vls.last_seen,
          grp.group_names
        FROM devices d
        LEFT JOIN organizations o ON d.org_id = o.id
        LEFT JOIN vehicles v ON d.device_id = v.imei AND v.is_active = TRUE
        LEFT JOIN vehicle_latest_state vls ON v.id = vls.vehicle_id
        LEFT JOIN LATERAL (
          SELECT ARRAY_AGG(g.name) as group_names
          FROM vehicle_groups vg
          JOIN groups g ON vg.group_id = g.id
          WHERE vg.vehicle_id = v.id
        ) grp ON TRUE
      `;
      let params = [noDataMinutes];

      if (req.user.role !== 'superadmin') {
        query += ` WHERE d.org_id = $2`;
        params.push(req.user.orgId);
      }

      query += ` ORDER BY d.created_at DESC`;

      const result = await db.query(query, params);

      // ── High-speed Redis lookup for API push status (< 1ms, zero DB load) ──
      const imeis = result.rows.map(r => r.device_id).filter(Boolean);
      let redisStatuses = [];
      if (imeis.length > 0 && redis) {
        try {
          const keys = imeis.map(i => `api_push_status:${i}`);
          redisStatuses = await redis.mget(keys);
        } catch (e) {
          console.warn('[REDIS-API-STATUS]', e.message);
        }
      }

      const rows = result.rows.map((row, idx) => {
        const groupsArr = row.group_names || [];
        const isTgCivil = groupsArr.some(g => /telangana.*civil|tgscscl|tg.*civil/i.test(g));
        const isApCivil = groupsArr.some(g => /paddy|ap.*civil/i.test(g));
        const isMining = groupsArr.some(g => /^minestamilnadu$/i.test(String(g || '').replace(/\s+/g, '')));
        const isSathyadeva = (row.org_name && /sathyadeva/i.test(row.org_name)) || groupsArr.some(g => /sathyadeva/i.test(g));

        const targets = [];
        if (isTgCivil) targets.push('TG Civil Supplies');
        if (isApCivil) targets.push('AP Civil Supplies');
        if (isMining) targets.push('TN Mining');
        if (isSathyadeva) targets.push('SCLEN (Coromandel)');

        const configuredTarget = targets.length > 0 ? targets.join(', ') : null;

        let apiPropagation = null;
        const rawRedis = redisStatuses[idx];
        if (rawRedis && configuredTarget) {
          try {
            apiPropagation = JSON.parse(rawRedis);
            if (configuredTarget) {
              apiPropagation.target = configuredTarget;
            }
          } catch (_) {}
        }

        // If no push packet was recorded in Redis yet but vehicle is bound to a target
        if (!apiPropagation && configuredTarget) {
          const isPullApi = isTgCivil || isApCivil;
          apiPropagation = {
            target: configuredTarget,
            status: row.is_online ? (isPullApi ? 'ACTIVE' : 'STANDBY') : 'IDLE',
            code: 0,
            message: row.is_online 
              ? (isPullApi ? 'Active (Ready for Polling)' : 'Standby (Waiting for GPS)') 
              : 'Standby (Vehicle Offline)',
            timestamp: null
          };
        } else if (!apiPropagation && !configuredTarget) {
          apiPropagation = {
            target: 'Internal Only',
            status: 'NONE',
            code: 0,
            message: '— Internal Only',
            timestamp: null
          };
        }

        return {
          ...row,
          api_propagation: apiPropagation
        };
      });

      res.json({ success: true, data: rows });
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

      // Proactive Brain Safeguard: Prevent deleting a device if it is linked to an active vehicle
      const linkedVeh = await db.query(
        'SELECT id, plate, name FROM vehicles WHERE imei = (SELECT device_id FROM devices WHERE id = $1) LIMIT 1',
        [id]
      );
      if (linkedVeh.rows.length > 0) {
        return res.status(400).json({
          success: false,
          error: `Safety Guard: Cannot delete device. It is actively linked to vehicle "${linkedVeh.rows[0].plate || linkedVeh.rows[0].name}". Unlink or migrate the vehicle before deleting the device.`,
          code: 'DEVICE_LINKED_TO_VEHICLE'
        });
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
      let whereClause = `v.is_active = TRUE`;
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
          v.driver_name,
          v.driver_phone,
          v.licence_issued_date, 
          v.licence_expire_date, 
          v.metadata,
          d.licence_id, 
          o.name AS org_name, 
          p.name AS dealer_name,
          u.username,
          u.name AS user_name,
          u.phone AS user_phone,
          u.email AS user_email
        FROM vehicles v
        JOIN organizations o ON v.org_id = o.id
        LEFT JOIN organizations p ON o.parent_id = p.id
        LEFT JOIN devices d ON v.imei = d.device_id
        LEFT JOIN LATERAL (
          SELECT username, name, phone, email 
          FROM users 
          WHERE org_id = v.org_id 
          ORDER BY created_at ASC 
          LIMIT 1
        ) u ON TRUE
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

        const metadata = row.metadata || {};
        let durationMonths = 12;
        if (metadata.plan_duration_months) {
          durationMonths = parseInt(metadata.plan_duration_months, 10) || 12;
        } else if (row.licence_issued_date && row.licence_expire_date) {
          const exp = new Date(row.licence_expire_date);
          const iss = new Date(row.licence_issued_date);
          const totalDays = Math.round((exp - iss) / (1000 * 60 * 60 * 24));
          durationMonths = totalDays >= 180 ? 12 : 1;
        }

        // User requirement: "alerts should go from one week only"
        const thresholdDays = 7;
        let status = 'Active';
        let diffDays = null;

        if (row.licence_expire_date) {
          const expDate = new Date(row.licence_expire_date);
          expDate.setHours(0, 0, 0, 0);
          const now = new Date();
          const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          diffDays = Math.round((expDate - today) / (1000 * 60 * 60 * 24));

          if (diffDays < 0) {
            status = 'Expired';
          } else if (diffDays <= thresholdDays) {
            status = 'Expiring';
          } else {
            status = 'Active';
          }
        }

        const username = metadata.username || row.username || '-';
        const customerName = metadata.ownerName || metadata.customerName || row.user_name || row.driver_name || '-';
        const phone = metadata.ownerPhone || metadata.customerPhone || row.user_phone || row.driver_phone || '-';
        const email = metadata.ownerEmail || metadata.email || metadata.customerEmail || row.user_email || '-';
        const gpsSimNo1 = row.gps_sim_no || metadata.sim1 || '-';
        const gpsSimNo2 = metadata.sim2 || metadata.gps_sim_no_2 || '-';

        return {
          dbVehicleId: row.db_vehicle_id,
          licenceId: row.licence_id || '-',
          vehicleId: row.vehicle_id || '-',
          vehicleName: row.vehicle_name,
          licenceType: licenceType,
          deviceId: row.device_id,
          organization: row.org_name,
          deviceModel: row.device_model || '-',
          dealerName: row.dealer_name || row.org_name,
          username,
          customerName,
          phone,
          email,
          gpsSimNo: gpsSimNo1,
          gpsSimNo1,
          gpsSimNo2,
          licenceIssuedDate: row.licence_issued_date,
          licenceExpiryDate: row.licence_expire_date,
          status: status,
          diffDays: diffDays,
          durationMonths: durationMonths,
          thresholdDays: thresholdDays,
          renewalPrice: metadata.renewal_price !== undefined && metadata.renewal_price !== null ? parseFloat(metadata.renewal_price) : null,
          discountPrice: metadata.discount_price !== undefined && metadata.discount_price !== null && metadata.discount_price !== '' ? parseFloat(metadata.discount_price) : null
        };
      });

      res.status(200).json({ success: true, data });
    } catch (err) {
      console.error('Error fetching expired licenses:', err);
      res.status(500).json({ success: false, error: 'Failed to fetch billing data' });
    }
  },

  async setVehicleBillingAmount(req, res, next) {
    try {
      const { vehicleId, price, discountPrice, durationMonths, startDate, expiryDate } = req.body;
      if (!vehicleId || price === undefined || price === null) {
        return res.status(400).json({ success: false, error: 'vehicleId and price are required.' });
      }

      let checkQuery = `SELECT id, org_id, metadata, licence_issued_date, licence_expire_date FROM vehicles WHERE (id::text = $1 OR metadata->>'vehicleId' = $1 OR imei = $1)`;
      let params = [vehicleId];
      if (req.user.role !== 'superadmin') {
        checkQuery += ` AND (org_id = $2 OR org_id IN (SELECT id FROM organizations WHERE parent_id = $2))`;
        params.push(req.user.orgId);
      }

      const checkRes = await db.query(checkQuery, params);
      if (checkRes.rows.length === 0) {
        return res.status(400).json({ success: false, error: 'Vehicle record not found or permission denied.' });
      }

      const vehicle = checkRes.rows[0];
      const existingMeta = vehicle.metadata || {};

      let calcMonths = parseInt(durationMonths, 10);
      if (startDate && expiryDate) {
        const s = new Date(startDate);
        const e = new Date(expiryDate);
        if (!isNaN(s.getTime()) && !isNaN(e.getTime())) {
          const days = Math.round((e - s) / (1000 * 60 * 60 * 24));
          calcMonths = Math.max(1, Math.round(days / 30));
        }
      }
      if (isNaN(calcMonths) || calcMonths <= 0) calcMonths = 12;

      const parsedDiscount = (discountPrice !== undefined && discountPrice !== null && discountPrice !== '')
        ? parseFloat(discountPrice)
        : null;

      const updatedMeta = {
        ...existingMeta,
        renewal_price: parseFloat(price),
        discount_price: parsedDiscount,
        plan_duration_months: calcMonths,
        plan_start_date: startDate || existingMeta.plan_start_date || null,
        plan_expiry_date: expiryDate || existingMeta.plan_expiry_date || null
      };

      let updateSql = `UPDATE vehicles SET metadata = $1, updated_at = NOW()`;
      const updateParams = [JSON.stringify(updatedMeta), vehicle.id];
      let pIdx = 3;

      if (startDate && !isNaN(new Date(startDate).getTime())) {
        updateSql += `, licence_issued_date = $${pIdx}`;
        updateParams.push(startDate);
        pIdx++;
      }
      if (expiryDate && !isNaN(new Date(expiryDate).getTime())) {
        updateSql += `, licence_expire_date = $${pIdx}`;
        updateParams.push(expiryDate);
        pIdx++;
      }

      updateSql += ` WHERE id = $2`;
      await db.query(updateSql, updateParams);

      res.status(200).json({
        success: true,
        message: 'Vehicle renewal amount, discount price, and custom date range updated successfully.',
        data: {
          vehicleId: vehicle.id,
          renewalPrice: parseFloat(price),
          discountPrice: parsedDiscount,
          durationMonths: calcMonths,
          startDate,
          expiryDate
        }
      });
    } catch (err) {
      console.error('Error setting vehicle billing amount:', err);
      res.status(500).json({ success: false, error: 'Failed to update vehicle billing amount.' });
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
          orgType: user.org_type,
          noDataMinutes: user.no_data_minutes !== undefined && user.no_data_minutes !== null ? Number(user.no_data_minutes) : 30
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
            phone: user.phone,
            noDataMinutes: user.no_data_minutes !== undefined && user.no_data_minutes !== null ? Number(user.no_data_minutes) : 30
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
        Starter: parseInt(usedResult.rows[0]?.Starter || 0, 10),
        Basic: parseInt(usedResult.rows[0]?.Basic || 0, 10),
        Advanced: parseInt(usedResult.rows[0]?.Advanced || 0, 10),
        Premium: parseInt(usedResult.rows[0]?.Premium || 0, 10),
      };

      const available = {
        Starter: Math.max(0, (limits.Starter || 0) - used.Starter),
        Basic: Math.max(0, (limits.Basic || 0) - used.Basic),
        Advanced: Math.max(0, (limits.Advanced || 0) - used.Advanced),
        Premium: Math.max(0, (limits.Premium || 0) - used.Premium),
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
        Starter: Math.max(0, parseInt(deviceLimits.Starter || 0, 10)),
        Basic: Math.max(0, parseInt(deviceLimits.Basic || 0, 10)),
        Advanced: Math.max(0, parseInt(deviceLimits.Advanced || 0, 10)),
        Premium: Math.max(0, parseInt(deviceLimits.Premium || 0, 10)),
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

  // Vehicles for a user
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
  },


  async getRecentAlerts(req, res, next) {
    try {
      const orgId = req.user.orgId;
      const GpsModel = require('../models/gpsModel');
      const alerts = await GpsModel.getRecentAlerts(orgId);
      res.json({ success: true, data: alerts });
    } catch (err) {
      next(err);
    }
  },

  // ============================================================
  // SITE NOTIFICATIONS
  // ============================================================

  async getOrgSiteNotifications(req, res, next) {
    try {
      const { id } = req.params;
      const GeofenceModel = require('../models/geofenceModel');

      const org = await OrgModel.findById(id);
      if (!org) {
        return res.status(404).json({ success: false, error: 'Organization not found.' });
      }

      if (req.user.role !== 'superadmin' && id !== req.user.orgId && org.parent_id !== req.user.orgId) {
        return res.status(403).json({ success: false, error: 'Access denied.' });
      }

      const geofences = await GeofenceModel.findAll(id);
      const settings = org.settings || {};
      const siteSettings = settings.site_notifications || {};

      const sites = geofences.map(g => {
        const saved = siteSettings[g.id] || {};
        return {
          id: g.id,
          name: g.name,
          time: saved.time !== undefined ? saved.time : (g.notification_time || '00:00'),
          enabled: saved.enabled !== undefined ? saved.enabled : (g.is_active !== false),
          created_at: g.created_at
        };
      });

      res.json({
        success: true,
        data: {
          org: {
            id: org.id,
            name: org.name,
            phone: org.phone || org.primary_user_phone || ''
          },
          sites
        }
      });
    } catch (err) {
      next(err);
    }
  },

  async updateOrgSiteNotifications(req, res, next) {
    try {
      const { id } = req.params;
      const { sites } = req.body;
      const GeofenceModel = require('../models/geofenceModel');

      const org = await OrgModel.findById(id);
      if (!org) {
        return res.status(404).json({ success: false, error: 'Organization not found.' });
      }

      if (req.user.role !== 'superadmin' && id !== req.user.orgId && org.parent_id !== req.user.orgId) {
        return res.status(403).json({ success: false, error: 'Access denied.' });
      }

      if (!Array.isArray(sites)) {
        return res.status(400).json({ success: false, error: 'Sites array is required.' });
      }

      const settings = org.settings || {};
      const currentSiteSettings = settings.site_notifications || {};
      const updatedSiteSettings = { ...currentSiteSettings };

      for (const item of sites) {
        if (!item.id) continue;
        const timeVal = item.time !== undefined ? String(item.time) : '00:00';
        const enabledVal = !!item.enabled;

        updatedSiteSettings[item.id] = {
          time: timeVal,
          enabled: enabledVal
        };

        // Update in geofences table as well
        await GeofenceModel.updateSiteNotification(item.id, {
          is_active: enabledVal,
          notification_time: timeVal
        });
      }

      // Persist in org settings
      await OrgModel.update(id, {
        settings: {
          ...settings,
          site_notifications: updatedSiteSettings
        }
      });

      res.json({
        success: true,
        message: 'Site notifications updated successfully.'
      });
    } catch (err) {
      next(err);
    }
  },

  async createOrgSite(req, res, next) {
    try {
      const { id } = req.params;
      const { name, time = '00:00', enabled = true, coordinates, radius, center_lat, center_lng, type = 'circle' } = req.body;
      const GeofenceModel = require('../models/geofenceModel');

      const org = await OrgModel.findById(id);
      if (!org) {
        return res.status(404).json({ success: false, error: 'Organization not found.' });
      }

      if (!name) {
        return res.status(400).json({ success: false, error: 'Site name is required.' });
      }

      const newSite = await GeofenceModel.create({
        orgId: id,
        name,
        type: type || 'circle',
        coordinates: coordinates || [{ lat: center_lat || 17.385, lng: center_lng || 78.4867 }],
        radius: radius || 500,
        center_lat: center_lat || 17.385,
        center_lng: center_lng || 78.4867
      });

      await GeofenceModel.updateSiteNotification(newSite.id, {
        is_active: enabled,
        notification_time: time
      });

      res.status(201).json({
        success: true,
        data: {
          id: newSite.id,
          name: newSite.name,
          time: time,
          enabled: enabled,
          created_at: newSite.created_at
        },
        message: 'Site created successfully.'
      });
    } catch (err) {
      next(err);
    }
  },

  async getOrgTracks(req, res, next) {
    try {
      const { id } = req.params;
      const RouteModel = require('../models/routeModel');

      const org = await OrgModel.findById(id);
      if (!org) {
        return res.status(404).json({ success: false, error: 'Organization not found.' });
      }

      const routes = await RouteModel.findAll(id);
      const enriched = await Promise.all(routes.map(async (r) => {
        const vehicles = await RouteModel.findVehiclesForRoute(r.id);
        return {
          ...r,
          vehicles,
          vehicle: vehicles[0] || null
        };
      }));

      // Fetch vehicles belonging to this org
      const vehRes = await db.query(
        `SELECT id, name, plate, imei FROM vehicles WHERE org_id = $1 AND is_active = TRUE ORDER BY name ASC`,
        [id]
      );

      res.json({
        success: true,
        data: {
          organization: {
            id: org.id,
            name: org.name,
            phone: org.phone
          },
          tracks: enriched,
          vehicles: vehRes.rows
        }
      });
    } catch (err) {
      next(err);
    }
  },

  async createOrgTrack(req, res, next) {
    try {
      const { id } = req.params;
      const { name, vehicle_id, coordinates, tolerance = 100 } = req.body;
      const RouteModel = require('../models/routeModel');

      const org = await OrgModel.findById(id);
      if (!org) {
        return res.status(404).json({ success: false, error: 'Organization not found.' });
      }

      if (!name || !name.trim()) {
        return res.status(400).json({ success: false, error: 'Track name is required.' });
      }

      const coords = Array.isArray(coordinates) && coordinates.length > 0
        ? coordinates
        : [{ lat: 17.3850, lng: 78.4867 }, { lat: 17.3900, lng: 78.4900 }];

      const route = await RouteModel.create({
        orgId: id,
        name: name.trim(),
        coordinates: coords,
        tolerance: parseInt(tolerance) || 100
      });

      if (vehicle_id) {
        await RouteModel.assignToVehicles(route.id, [vehicle_id]);
      }

      // Also persist track in org settings
      try {
        const currentSettings = org.settings || {};
        const tracks = currentSettings.organization_tracks || [];
        tracks.push({
          id: route.id,
          name: route.name,
          vehicle_id: vehicle_id || null,
          created_at: new Date().toISOString()
        });
        await OrgModel.update(id, {
          settings: {
            ...currentSettings,
            organization_tracks: tracks
          }
        });
      } catch (_) {}

      res.status(201).json({
        success: true,
        data: route,
        message: 'Organization track created successfully.'
      });
    } catch (err) {
      next(err);
    }
  },

  async deleteOrgTrack(req, res, next) {
    try {
      const { id, trackId } = req.params;
      const RouteModel = require('../models/routeModel');
      await RouteModel.delete(trackId);
      res.json({ success: true, message: 'Track deleted successfully.' });
    } catch (err) {
      next(err);
    }
  }
};

module.exports = AdminController;

