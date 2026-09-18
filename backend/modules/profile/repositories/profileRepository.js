const db = require('../../../config/db');

class ProfileRepository {
  /**
   * Fetch profile for a specific organization
   */
  async getProfile(organizationId) {
    const query = `
      SELECT op.*, o.name as org_name, o.type as org_type, o.is_active as org_is_active,
             o.device_limits
      FROM organizations o
      LEFT JOIN organization_profiles op ON op.organization_id = o.id
      WHERE o.id = $1
    `;
    const res = await db.query(query, [organizationId]);
    if (res.rows[0]) {
      const row = res.rows[0];
      if (!row.brand_name && row.org_name) {
        row.brand_name = row.org_name;
      }
      return row;
    }
    return null;
  }

  /**
   * Upsert profile data
   */
  async upsertProfile(organizationId, updateData) {
    // Separate organization table fields (name, phone, email, contact_person, address) if provided
    const orgFields = {};
    if (updateData.name !== undefined) orgFields.name = updateData.name;
    if (updateData.company_name !== undefined && !orgFields.name) orgFields.name = updateData.company_name;

    if (Object.keys(orgFields).length > 0) {
      const setOrg = Object.keys(orgFields).map((k, i) => `${k} = $${i + 2}`).join(', ');
      await db.query(`UPDATE organizations SET ${setOrg} WHERE id = $1`, [organizationId, ...Object.values(orgFields)]);
    }

    // Also sync email/name to users table if provided
    if (updateData.email || updateData.contact_person || updateData.mobile) {
      const userUpdates = [];
      const userVals = [];
      let uIdx = 1;
      if (updateData.email) { userUpdates.push(`email = $${uIdx++}`); userVals.push(updateData.email); }
      if (updateData.contact_person) { userUpdates.push(`name = $${uIdx++}`); userVals.push(updateData.contact_person); }
      if (updateData.mobile) { userUpdates.push(`phone = $${uIdx++}`); userVals.push(updateData.mobile); }
      
      userVals.push(organizationId);
      await db.query(
        `UPDATE users SET ${userUpdates.join(', ')} 
         WHERE id = (
           SELECT id FROM users WHERE org_id = $${uIdx} 
           ORDER BY (CASE WHEN role = 'dealer' THEN 0 WHEN role = 'superadmin' THEN 1 ELSE 2 END), created_at ASC 
           LIMIT 1
         )`,
        userVals
      );
    }

    // Filter fields that belong to organization_profiles
    const profileColumns = [
      'contact_person', 'email', 'mobile', 'alternate_mobile', 'address', 'city',
      'state', 'country', 'pincode', 'gst_number', 'website', 'timezone',
      'logo_url', 'favicon_url', 'login_background_url', 'map_provider',
      'encrypted_api_key', 'default_latitude', 'default_longitude', 'default_zoom',
      'sms_enabled', 'email_enabled', 'whatsapp_enabled', 'push_enabled',
      'brand_name', 'brand_tagline', 'primary_color', 'secondary_color',
      'footer_text', 'support_email', 'support_phone', 'pan_number',
      'is_whitelabel_enabled', 'subdomain', 'company_name', 'designation', 'whatsapp_number'
    ];

    const fieldsToUpdate = {};
    for (const key of Object.keys(updateData)) {
      if (profileColumns.includes(key)) {
        fieldsToUpdate[key] = updateData[key];
      }
    }

    const fields = Object.keys(fieldsToUpdate);
    if (fields.length === 0) return this.getProfile(organizationId);

    const setClauses = fields.map((field, idx) => `${field} = $${idx + 2}`).join(', ');
    const values = [organizationId, ...fields.map(f => fieldsToUpdate[f])];
    
    // Insert columns and values
    const insertColumns = ['organization_id', ...fields].join(', ');
    const insertValues = ['$1', ...fields.map((_, idx) => `$${idx + 2}`)].join(', ');

    const query = `
      INSERT INTO organization_profiles (${insertColumns})
      VALUES (${insertValues})
      ON CONFLICT (organization_id)
      DO UPDATE SET ${setClauses}, updated_at = NOW()
      RETURNING *
    `;

    const res = await db.query(query, values);
    return res.rows[0];
  }

  /**
   * Fetch all dealers with their profiles and statistics
   */
  async getAllDealers() {
    const query = `
      SELECT o.id, o.name, o.type, o.is_active, o.created_at, o.device_limits,
             op.brand_name, op.brand_tagline, op.primary_color, op.secondary_color,
             op.logo_url, op.favicon_url, op.login_background_url, op.support_email,
             op.support_phone, op.is_whitelabel_enabled, op.subdomain,
             op.contact_person, op.email as profile_email, op.mobile as profile_mobile,
             op.city, op.state, op.country, op.pincode, op.gst_number, op.pan_number,
             (SELECT COUNT(*)::int FROM organizations child WHERE child.parent_id = o.id) as child_orgs_count,
             (SELECT COUNT(*)::int FROM users u WHERE u.org_id = o.id OR u.org_id IN (SELECT id FROM organizations WHERE parent_id = o.id)) as total_users_count,
             (SELECT COUNT(*)::int FROM vehicles v WHERE v.org_id = o.id OR v.org_id IN (SELECT id FROM organizations WHERE parent_id = o.id)) as total_vehicles_count,
             (SELECT COUNT(*)::int FROM devices d WHERE d.org_id = o.id OR d.org_id IN (SELECT id FROM organizations WHERE parent_id = o.id)) as total_devices_count
      FROM organizations o
      LEFT JOIN organization_profiles op ON op.organization_id = o.id
      WHERE o.type IN ('dealer', 'super')
      ORDER BY (CASE WHEN o.type = 'dealer' THEN 0 ELSE 1 END), o.name ASC
    `;
    const res = await db.query(query);
    return res.rows;
  }

  /**
   * Fetch dealer stats
   */
  async getDealerStats(dealerOrgId) {
    const query = `
      SELECT 
        (SELECT COUNT(*)::int FROM organizations WHERE parent_id = $1) as child_orgs_count,
        (SELECT COUNT(*)::int FROM users WHERE org_id = $1 OR org_id IN (SELECT id FROM organizations WHERE parent_id = $1)) as total_users_count,
        (SELECT COUNT(*)::int FROM vehicles WHERE org_id = $1 OR org_id IN (SELECT id FROM organizations WHERE parent_id = $1)) as total_vehicles_count,
        (SELECT COUNT(*)::int FROM devices WHERE org_id = $1 OR org_id IN (SELECT id FROM organizations WHERE parent_id = $1)) as total_devices_count
    `;
    const res = await db.query(query, [dealerOrgId]);
    return res.rows[0] || { child_orgs_count: 0, total_users_count: 0, total_vehicles_count: 0, total_devices_count: 0 };
  }

  /**
   * Fetch public branding for an organization or subdomain
   */
  async getPublicBranding(identifier) {
    const query = `
      SELECT op.brand_name, op.brand_tagline, op.primary_color, op.secondary_color,
             op.logo_url, op.favicon_url, op.login_background_url, op.footer_text,
             op.support_email, op.support_phone, op.is_whitelabel_enabled, op.subdomain,
             o.name as org_name
      FROM organizations o
      LEFT JOIN organization_profiles op ON op.organization_id = o.id
      WHERE o.id::text = $1 
         OR LOWER(op.subdomain) = LOWER($1)
         OR LOWER(o.name) = LOWER($1)
         OR LOWER(COALESCE(op.brand_name, '')) = LOWER($1)
      LIMIT 1
    `;
    const res = await db.query(query, [identifier]);
    if (res.rows[0]) {
      const row = res.rows[0];
      if (!row.brand_name && row.org_name) {
        row.brand_name = row.org_name;
      }
      return row;
    }
    return null;
  }

  /**
   * Insert into audit_logs table
   */
  async createAuditLog(logData) {
    const query = `
      INSERT INTO audit_logs (
        audit_type, entity_type, entity_id, entity_name, action,
        old_data, new_data, performed_by_id, performed_by_name,
        performed_by_email, performed_by_role, org_id, ip_address, user_agent
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
      )
    `;
    const values = [
      logData.audit_type,
      logData.entity_type,
      logData.entity_id,
      logData.entity_name,
      logData.action,
      logData.old_data,
      logData.new_data,
      logData.performed_by_id,
      logData.performed_by_name,
      logData.performed_by_email,
      logData.performed_by_role,
      logData.org_id,
      logData.ip_address,
      logData.user_agent
    ];
    await db.query(query, values);
  }

  /**
   * Fetch audit logs for an organization
   */
  async getAuditLogs(organizationId) {
    const query = `
      SELECT * FROM audit_logs 
      WHERE org_id = $1 AND audit_type = 'organization' AND entity_type = 'Profile'
      ORDER BY created_at DESC
    `;
    const res = await db.query(query, [organizationId]);
    return res.rows;
  }
}

module.exports = new ProfileRepository();
