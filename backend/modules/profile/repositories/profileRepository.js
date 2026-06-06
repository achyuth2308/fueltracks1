const db = require('../../../config/db');

class ProfileRepository {
  /**
   * Fetch profile for a specific organization
   */
  async getProfile(organizationId) {
    const query = `
      SELECT * FROM organization_profiles 
      WHERE organization_id = $1
    `;
    const res = await db.query(query, [organizationId]);
    return res.rows[0] || null;
  }

  /**
   * Upsert profile data
   */
  async upsertProfile(organizationId, updateData) {
    // Generate SET clause dynamically
    const fields = Object.keys(updateData);
    if (fields.length === 0) return this.getProfile(organizationId);

    const setClauses = fields.map((field, idx) => `${field} = $${idx + 2}`).join(', ');
    const values = [organizationId, ...fields.map(f => updateData[f])];
    
    // Insert columns and values
    const insertColumns = ['organization_id', ...fields].join(', ');
    const insertValues = ['$1', ...fields.map((_, idx) => `$${idx + 2}`)].join(', ');

    const query = `
      INSERT INTO organization_profiles (${insertColumns})
      VALUES (${insertValues})
      ON CONFLICT (organization_id)
      DO UPDATE SET ${setClauses}
      RETURNING *
    `;

    const res = await db.query(query, values);
    return res.rows[0];
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
