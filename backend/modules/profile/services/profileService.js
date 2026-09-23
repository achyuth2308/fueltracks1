const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('../../../config/db');
const profileRepository = require('../repositories/profileRepository');

// Secret for API key encryption (In a real app, this should be in .env)
const rawKey = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex').slice(0, 32).padEnd(32, '0');
// Ensure key is exactly 32 bytes for aes-256-cbc
const ENCRYPTION_KEY = Buffer.from(rawKey).length === 32 
  ? Buffer.from(rawKey) 
  : crypto.createHash('sha256').update(String(rawKey)).digest();
const IV_LENGTH = 16;

class ProfileService {
  
  encrypt(text) {
    if (!text) return text;
    try {
      let iv = crypto.randomBytes(IV_LENGTH);
      let cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
      let encrypted = cipher.update(text);
      encrypted = Buffer.concat([encrypted, cipher.final()]);
      return iv.toString('hex') + ':' + encrypted.toString('hex');
    } catch (e) {
      console.error('Encryption Error:', e.message);
      return '';
    }
  }

  decrypt(text) {
    if (!text) return text;
    try {
      let textParts = text.split(':');
      let iv = Buffer.from(textParts.shift(), 'hex');
      let encryptedText = Buffer.from(textParts.join(':'), 'hex');
      let decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
      let decrypted = decipher.update(encryptedText);
      decrypted = Buffer.concat([decrypted, decipher.final()]);
      return decrypted.toString();
    } catch(e) {
      console.error('Decryption Error:', e.message);
      return ''; // Decryption failed
    }
  }

  async getProfile(organizationId) {
    let currentOrgId = organizationId;
    let mapProvider = null;
    let encryptedApiKey = null;

    // Fetch the main profile for the requested org
    let mainProfile = await profileRepository.getProfile(organizationId) || {};

    // Traverse up the organization hierarchy to find the first available map configuration
    while (currentOrgId) {
      const orgProfile = await profileRepository.getProfile(currentOrgId);
      if (orgProfile && orgProfile.map_provider && orgProfile.encrypted_api_key) {
        mapProvider = orgProfile.map_provider;
        encryptedApiKey = orgProfile.encrypted_api_key;
        break; // Found it!
      }

      // Get parent_id
      const res = await db.query('SELECT parent_id FROM organizations WHERE id = $1', [currentOrgId]);
      if (res.rows.length > 0 && res.rows[0].parent_id) {
        currentOrgId = res.rows[0].parent_id;
      } else {
        // Fallback to superadmin if we reach the top without finding one
        if (currentOrgId !== 'a0000000-0000-0000-0000-000000000001') {
          currentOrgId = 'a0000000-0000-0000-0000-000000000001';
        } else {
          break;
        }
      }
    }

    // Apply the inherited map configuration if the main profile doesn't have its own
    mainProfile.map_provider = mainProfile.map_provider || mapProvider;
    mainProfile.encrypted_api_key = mainProfile.encrypted_api_key || encryptedApiKey;

    if (mainProfile.encrypted_api_key) {
      mainProfile.api_key = this.decrypt(mainProfile.encrypted_api_key);
      delete mainProfile.encrypted_api_key;
    }
    
    // Fetch actual license limits from organization device limits
    const orgRes = await db.query('SELECT device_limits FROM organizations WHERE id = $1', [organizationId]);
    const orgRow = orgRes.rows[0];
    const limits = orgRow?.device_limits || { Starter: 0, Basic: 0, Advanced: 0, Premium: 0 };

    // Fetch actual used counts per tier (based on device licenceId prefixes for this org or its child orgs)
    const usedResult = await db.query(
      `SELECT
         COUNT(*) FILTER (WHERE licence_id LIKE 'ST%') AS "Starter",
         COUNT(*) FILTER (WHERE licence_id LIKE 'BC%') AS "Basic",
         COUNT(*) FILTER (WHERE licence_id LIKE 'AD%') AS "Advanced",
         COUNT(*) FILTER (WHERE licence_id LIKE 'EN%') AS "Premium",
         COUNT(*) AS "TotalUsed"
       FROM devices 
       WHERE org_id = $1 OR org_id IN (SELECT id FROM organizations WHERE parent_id = $1)`, 
      [organizationId]
    );

    const used = {
      Starter:  parseInt(usedResult.rows[0]?.Starter  || 0, 10),
      Basic:    parseInt(usedResult.rows[0]?.Basic    || 0, 10),
      Advanced: parseInt(usedResult.rows[0]?.Advanced || 0, 10),
      Premium:  parseInt(usedResult.rows[0]?.Premium  || 0, 10),
    };

    // Calculate total allocated and used devices across all tiers
    const totalAllocated = Object.values(limits).reduce((sum, val) => sum + parseInt(val || 0, 10), 0);
    const calculatedTierUsed = Object.values(used).reduce((sum, val) => sum + val, 0);
    const dbTotalUsed = parseInt(usedResult.rows[0]?.TotalUsed || 0, 10);
    const totalUsed = Math.max(calculatedTierUsed, dbTotalUsed);

    // Determine the active tier (the one with non-zero limit, or default to Basic)
    let activeTier = 'Basic';
    for (const [tier, val] of Object.entries(limits)) {
      if (parseInt(val || 0, 10) > 0) {
        activeTier = tier;
        break;
      }
    }

    const license = {
      type: activeTier,
      total: totalAllocated,
      used: totalUsed,
      available: Math.max(0, totalAllocated - totalUsed),
      limits,
      usedTiers: used
    };

    // Also fetch dealer stats if it's a dealer organization
    const dealerStats = await profileRepository.getDealerStats(organizationId);

    return { profile: mainProfile, license, dealerStats };
  }

  async getAllDealers() {
    return await profileRepository.getAllDealers();
  }

  async getPublicBranding(identifier) {
    return await profileRepository.getPublicBranding(identifier);
  }

  async updateProfile(organizationId, updateData, user) {
    const oldProfile = await profileRepository.getProfile(organizationId);

    // Validate and sanitize subdomain if provided
    if (updateData.subdomain !== undefined) {
      if (updateData.subdomain) {
        const sanitized = String(updateData.subdomain).toLowerCase().trim().replace(/[^a-z0-9-]/g, '');
        if (sanitized.length < 3) {
          throw new Error('Subdomain must be at least 3 characters long (letters, numbers, hyphens only).');
        }
        // Verify subdomain uniqueness across other organizations
        const duplicateCheck = await db.query(
          'SELECT organization_id FROM organization_profiles WHERE LOWER(subdomain) = $1 AND organization_id != $2',
          [sanitized, organizationId]
        );
        if (duplicateCheck.rows.length > 0) {
          throw new Error(`Subdomain '${sanitized}' is already in use by another dealership. Please choose a unique subdomain slug.`);
        }
        updateData.subdomain = sanitized;
      } else {
        updateData.subdomain = null;
      }
    }

    if (updateData.api_key) {
      updateData.encrypted_api_key = this.encrypt(updateData.api_key);
      delete updateData.api_key;
    }

    const newProfile = await profileRepository.upsertProfile(organizationId, updateData);

    // Audit Log
    await profileRepository.createAuditLog({
      audit_type: 'organization',
      entity_type: 'Profile',
      entity_id: organizationId,
      entity_name: newProfile?.brand_name || oldProfile?.org_name || 'Organization Profile',
      action: 'Profile & White-Labeling Updated',
      old_data: oldProfile,
      new_data: newProfile,
      performed_by_id: user.userId,
      performed_by_name: user.name || 'Admin',
      performed_by_email: user.email,
      performed_by_role: user.role,
      org_id: organizationId,
      ip_address: user.ip || '0.0.0.0',
      user_agent: user.userAgent || 'Unknown'
    });

    return newProfile;
  }

  async updateLogo(organizationId, fieldName, fileUrl, user) {
    const oldProfile = await profileRepository.getProfile(organizationId);
    
    const updateData = {};
    updateData[fieldName] = fileUrl;
    
    const newProfile = await profileRepository.upsertProfile(organizationId, updateData);

    // Audit Log
    await profileRepository.createAuditLog({
      audit_type: 'organization',
      entity_type: 'Profile',
      entity_id: organizationId,
      entity_name: newProfile?.brand_name || oldProfile?.org_name || 'Organization Profile',
      action: `${fieldName} Asset Updated`,
      old_data: oldProfile,
      new_data: newProfile,
      performed_by_id: user.userId,
      performed_by_name: user.name || 'Admin',
      performed_by_email: user.email,
      performed_by_role: user.role,
      org_id: organizationId,
      ip_address: user.ip || '0.0.0.0',
      user_agent: user.userAgent || 'Unknown'
    });

    return newProfile;
  }

  async changePassword({ targetOrgId, targetUserId, currentPassword, newPassword, userContext }) {
    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 8) {
      throw new Error('New password must be at least 8 characters long');
    }

    let user = null;
    const isSuperAdmin = userContext.role === 'superadmin';

    // If Super Admin is managing a specific dealer org, find that dealer's primary admin user
    if (isSuperAdmin && targetOrgId && targetOrgId !== userContext.orgId) {
      const res = await db.query(
        'SELECT id, name, email, password FROM users WHERE org_id = $1 AND role = \'dealer\' ORDER BY created_at ASC LIMIT 1',
        [targetOrgId]
      );
      if (res.rows.length === 0) {
        // Fallback: any user in that org
        const fallback = await db.query('SELECT id, name, email, password FROM users WHERE org_id = $1 ORDER BY created_at ASC LIMIT 1', [targetOrgId]);
        user = fallback.rows[0];
      } else {
        user = res.rows[0];
      }
    } else if (targetUserId) {
      const res = await db.query('SELECT id, name, email, password FROM users WHERE id = $1', [targetUserId]);
      user = res.rows[0];
    } else {
      const res = await db.query('SELECT id, name, email, password FROM users WHERE id = $1', [userContext.userId]);
      user = res.rows[0];
    }

    if (!user) throw new Error('Target user account not found');

    // Only require and check current password if a non-superadmin user is changing their own personal password
    const isSelfChange = user.id === userContext.userId;
    if (isSelfChange && !isSuperAdmin) {
      if (!currentPassword) throw new Error('Current password is required');
      if (user.password) {
        const isMatch = await bcrypt.compare(String(currentPassword), String(user.password));
        if (!isMatch) throw new Error('Incorrect current password');
      }
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(String(newPassword), salt);

    await db.query('UPDATE users SET password = $1, updated_at = NOW() WHERE id = $2', [hashedPassword, user.id]);

    // Audit Log
    await profileRepository.createAuditLog({
      audit_type: 'user',
      entity_type: 'User',
      entity_id: user.id,
      entity_name: `Dealer User (${user.email})`,
      action: isSuperAdmin && !isSelfChange ? 'Dealer Password Reset by Superadmin' : 'Password Changed',
      old_data: null,
      new_data: null,
      performed_by_id: userContext.userId,
      performed_by_name: userContext.name || 'Admin',
      performed_by_email: userContext.email,
      performed_by_role: userContext.role,
      org_id: targetOrgId || userContext.orgId,
      ip_address: userContext.ip || '0.0.0.0',
      user_agent: userContext.userAgent || 'Unknown'
    });

    return true;
  }

  async getAuditLogs(organizationId) {
    return await profileRepository.getAuditLogs(organizationId);
  }
}

module.exports = new ProfileService();
