const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('../../../config/db');
const profileRepository = require('../repositories/profileRepository');

// Secret for API key encryption (In a real app, this should be in .env)
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex').slice(0, 32).padEnd(32, '0');
const IV_LENGTH = 16;

class ProfileService {
  
  encrypt(text) {
    if (!text) return text;
    let iv = crypto.randomBytes(IV_LENGTH);
    let cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
  }

  decrypt(text) {
    if (!text) return text;
    try {
      let textParts = text.split(':');
      let iv = Buffer.from(textParts.shift(), 'hex');
      let encryptedText = Buffer.from(textParts.join(':'), 'hex');
      let decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
      let decrypted = decipher.update(encryptedText);
      decrypted = Buffer.concat([decrypted, decipher.final()]);
      return decrypted.toString();
    } catch(e) {
      return ''; // Decryption failed
    }
  }

  async getProfile(organizationId) {
    const profile = await profileRepository.getProfile(organizationId);
    if (profile && profile.encrypted_api_key) {
      profile.api_key = this.decrypt(profile.encrypted_api_key);
      delete profile.encrypted_api_key;
    }
    
    // Fetch mock license info based on active vehicles
    const res = await db.query('SELECT COUNT(*) as count FROM vehicles WHERE org_id = $1 AND is_active = true', [organizationId]);
    const usedVehicles = parseInt(res.rows[0].count);
    
    // Let's assume a hardcoded total of 100 for Basic tier for demonstration
    const license = {
      type: 'Basic',
      total: 100,
      used: usedVehicles,
      available: Math.max(0, 100 - usedVehicles)
    };

    return { profile: profile || {}, license };
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
