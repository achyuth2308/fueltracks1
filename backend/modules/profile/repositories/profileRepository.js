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
  async upsertProfile(organizationId, updateData, userId = null, userRole = null) {
    // Only update organization company name if company_name is explicitly provided,
    // or if the actor is a dealer/superadmin updating their org brand name.
    // Never let a customer personal profile edit rename the company in the organizations table.
    const orgFields = {};
    if (updateData.company_name !== undefined) {
      orgFields.name = updateData.company_name;
    } else if (updateData.name !== undefined && (userRole === 'dealer' || userRole === 'superadmin')) {
      orgFields.name = updateData.name;
    }

    if (organizationId && Object.keys(orgFields).length > 0) {
      const orgExists = await db.query('SELECT id FROM organizations WHERE id = $1', [organizationId]);
      if (orgExists.rows.length > 0) {
        const setOrg = Object.keys(orgFields).map((k, i) => `${k} = $${i + 2}`).join(', ');
        await db.query(`UPDATE organizations SET ${setOrg} WHERE id = $1`, [organizationId, ...Object.values(orgFields)]);
      }
    }

    // Always sync personal details (name, phone, email) to users table
    if (updateData.email || updateData.contact_person || updateData.mobile || updateData.phone || updateData.name) {
      const userUpdates = [];
      const userVals = [];
      let uIdx = 1;
      const emailVal = updateData.email;
      const nameVal = updateData.name || updateData.contact_person;
      const phoneVal = updateData.phone || updateData.mobile;

      if (emailVal) { userUpdates.push(`email = $${uIdx++}`); userVals.push(emailVal); }
      if (nameVal) { userUpdates.push(`name = $${uIdx++}`); userVals.push(nameVal); }
      if (phoneVal) { userUpdates.push(`phone = $${uIdx++}`); userVals.push(phoneVal); }
      
      if (userUpdates.length > 0) {
        if (userId) {
          userVals.push(userId);
          await db.query(`UPDATE users SET ${userUpdates.join(', ')}, updated_at = NOW() WHERE id = $${uIdx}`, userVals);
        } else if (organizationId) {
          userVals.push(organizationId);
          await db.query(
            `UPDATE users SET ${userUpdates.join(', ')}, updated_at = NOW() 
             WHERE id = (
               SELECT id FROM users WHERE org_id = $${uIdx} 
               ORDER BY (CASE WHEN role = 'dealer' THEN 0 WHEN role = 'superadmin' THEN 1 ELSE 2 END), created_at ASC 
               LIMIT 1
             )`,
            userVals
          );
        }
      }
    }

    // If no organizationId or if organization does not exist in organizations table,
    // safely skip organization_profiles upsert and return basic profile
    if (!organizationId) {
      return { organization_id: null, name: updateData.name, phone: updateData.phone };
    }

    const orgCheck = await db.query('SELECT id FROM organizations WHERE id = $1', [organizationId]);
    if (orgCheck.rows.length === 0) {
      console.warn(`[ProfileRepository] Organization '${organizationId}' does not exist in organizations table. Skipping organization_profiles upsert.`);
      return { organization_id: organizationId, name: updateData.name, phone: updateData.phone };
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
    if (!identifier) return null;
    const raw = String(identifier).trim();
    // Clean out protocol/port if present
    const clean = raw.replace(/^https?:\/\//i, '').split(':')[0];

    // If a full domain/hostname was passed (e.g. gps.smtechnologies.org or smtechnologies.org)
    const domainParts = clean.split('.');
    let extractedSlug = clean;
    if (domainParts.length >= 2) {
      if (['gps', 'track', 'fleet', 'portal', 'app', 'www'].includes(domainParts[0].toLowerCase()) && domainParts.length >= 3) {
        extractedSlug = domainParts[1];
      } else if (!['www', 'app', 'localhost'].includes(domainParts[0].toLowerCase())) {
        extractedSlug = domainParts[0];
      }
    }

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
         -- Match without spaces or hyphens (e.g. "smtechnologies" matches "SM TECHNOLOGIES" or "SM-Technologies")
         OR REPLACE(REPLACE(LOWER(o.name), ' ', ''), '-', '') = LOWER(REPLACE(REPLACE($1, ' ', ''), '-', ''))
         OR REPLACE(REPLACE(LOWER(COALESCE(op.brand_name, '')), ' ', ''), '-', '') = LOWER(REPLACE(REPLACE($1, ' ', ''), '-', ''))
         OR REPLACE(REPLACE(LOWER(COALESCE(op.subdomain, '')), ' ', ''), '-', '') = LOWER(REPLACE(REPLACE($1, ' ', ''), '-', ''))
         -- Match with extracted slug if full hostname or domain was passed
         OR LOWER(op.subdomain) = LOWER($2)
         OR LOWER(o.name) = LOWER($2)
         OR LOWER(COALESCE(op.brand_name, '')) = LOWER($2)
         OR REPLACE(REPLACE(LOWER(o.name), ' ', ''), '-', '') = LOWER(REPLACE(REPLACE($2, ' ', ''), '-', ''))
         OR REPLACE(REPLACE(LOWER(COALESCE(op.brand_name, '')), ' ', ''), '-', '') = LOWER(REPLACE(REPLACE($2, ' ', ''), '-', ''))
      LIMIT 1
    `;
    const res = await db.query(query, [clean, extractedSlug]);
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
