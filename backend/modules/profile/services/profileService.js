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

    // Calculate total allocated devices across all tiers
    const totalAllocated = Object.values(limits).reduce((sum, val) => sum + parseInt(val || 0, 10), 0);

    // Determine the active tier (the one with non-zero limit, or default to Basic)
    let activeTier = 'Basic';
    for (const [tier, val] of Object.entries(limits)) {
      if (parseInt(val || 0, 10) > 0) {
        activeTier = tier;
        break;
      }
    }

    const resCount = await db.query('SELECT COUNT(*) as count FROM vehicles WHERE org_id = $1 AND is_active = true', [organizationId]);
    const usedVehicles = parseInt(resCount.rows[0].count);
    
    const license = {
      type: activeTier,
      total: totalAllocated,
      used: usedVehicles,
      available: Math.max(0, totalAllocated - usedVehicles)
    };

    return { profile: mainProfile, license };
  }

  async updateProfile(organizationId, updateData, user) {
    const oldProfile = await profileRepository.getProfile(organizationId);

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
      entity_name: 'Organization Profile',
      action: 'Profile Updated',
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
      entity_name: 'Organization Profile',
      action: 'Logo Updated',
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

  async changePassword(userId, currentPassword, newPassword, userContext) {
    const res = await db.query('SELECT password FROM users WHERE id = $1', [userId]);
    const user = res.rows[0];
    if (!user) throw new Error('User not found');

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) throw new Error('Incorrect current password');

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await db.query('UPDATE users SET password = $1, updated_at = NOW() WHERE id = $2', [hashedPassword, userId]);

    // Audit Log
    await profileRepository.createAuditLog({
      audit_type: 'user',
      entity_type: 'User',
      entity_id: userId,
      entity_name: 'User Password',
      action: 'Password Changed',
      old_data: null,
      new_data: null,
      performed_by_id: userContext.userId,
      performed_by_name: userContext.name || 'Admin',
      performed_by_email: userContext.email,
      performed_by_role: userContext.role,
      org_id: userContext.orgId,
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
