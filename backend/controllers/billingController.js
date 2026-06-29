// ============================================================
// BILLING CONTROLLER (CUSTOMER)
// ============================================================

const db = require('../config/db');

const BillingController = {
  async getRenewalPlans(req, res, next) {
    try {
      // User can see global plans or plans assigned to their org
      const query = `
        SELECT p.*, o.name as org_name
        FROM renewal_plans p
        LEFT JOIN organizations o ON p.org_id = o.id
        WHERE p.is_active = true 
        AND (
          p.org_id = $1 OR 
          p.org_id = (SELECT parent_id FROM organizations WHERE id = $1)
        )
        ORDER BY p.duration_months ASC, p.price ASC
      `;
      const result = await db.query(query, [req.user.orgId]);
      res.status(200).json({ success: true, data: result.rows });
    } catch (err) {
      next(err);
    }
  },

  async verifyRenewal(req, res, next) {
    const client = await db.getClient();
    try {
      const { vehicleId, paymentId, planId } = req.body;
      
      if (!vehicleId || !paymentId || !planId) {
        return res.status(400).json({ success: false, error: 'Vehicle ID, Payment ID, and Plan ID are required.' });
      }

      await client.query('BEGIN');

      // Get plan details
      const planRes = await client.query('SELECT price, duration_months FROM renewal_plans WHERE id = $1 AND is_active = true', [planId]);
      if (planRes.rows.length === 0) {
        throw new Error('Invalid or inactive renewal plan.');
      }
      const plan = planRes.rows[0];
      const amount = plan.price;
      const durationMonths = plan.duration_months;

      // Update vehicle licence date (+duration_months from now if expired, or from existing date)
      const vehicleRes = await client.query('SELECT licence_expire_date FROM vehicles WHERE id = $1', [vehicleId]);
      if (vehicleRes.rows.length === 0) {
        throw new Error('Vehicle not found.');
      }
      
      const currentExpireDate = new Date(vehicleRes.rows[0].licence_expire_date);
      const now = new Date();
      let newExpireDate;
      
      if (currentExpireDate > now) {
        // Still valid, add duration_months
        newExpireDate = new Date(currentExpireDate);
        newExpireDate.setMonth(newExpireDate.getMonth() + durationMonths);
      } else {
        // Expired, set to duration_months from now
        newExpireDate = new Date(now);
        newExpireDate.setMonth(newExpireDate.getMonth() + durationMonths);
      }

      await client.query('UPDATE vehicles SET licence_expire_date = $1 WHERE id = $2', [newExpireDate, vehicleId]);

      // Record transaction
      await client.query(`
        INSERT INTO renewal_transactions (user_id, vehicle_id, amount, status, payment_id, plan_id, duration_months)
        VALUES ($1, $2, $3, 'SUCCESS', $4, $5, $6)
      `, [req.user.userId, vehicleId, amount, paymentId, planId, durationMonths]);

      await client.query('COMMIT');

      res.status(200).json({ 
        success: true, 
        message: 'Payment verified and license extended.',
        data: { newExpireDate }
      });
    } catch (err) {
      await client.query('ROLLBACK');
      next(err);
    } finally {
      client.release();
    }
  }
};

module.exports = BillingController;
