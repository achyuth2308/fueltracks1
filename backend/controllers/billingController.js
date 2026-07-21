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

  async getVehiclePrice(req, res, next) {
    try {
      const { vehicleId } = req.params;
      if (!vehicleId) return res.status(400).json({ success: false, error: 'Vehicle ID required.' });

      // First verify the vehicle belongs to the user's org
      const vRes = await db.query('SELECT org_id, metadata FROM vehicles WHERE id = $1 AND org_id = $2', [vehicleId, req.user.orgId]);
      if (vRes.rows.length === 0) return res.status(404).json({ success: false, error: 'Vehicle not found.' });

      const metadata = vRes.rows[0].metadata || {};
      if (metadata.renewal_price !== undefined && metadata.renewal_price !== null) {
        const durationMonths = parseInt(metadata.plan_duration_months || 12, 10);
        const price = parseFloat(metadata.renewal_price);
        return res.status(200).json({
          success: true,
          data: {
            id: `vehicle_custom_${vehicleId}`,
            name: `${durationMonths >= 6 ? '1 Year' : '1 Month'} Renewal Plan`,
            duration_months: durationMonths,
            price: price
          }
        });
      }

      // Find all groups the vehicle is assigned to
      const groupRes = await db.query('SELECT group_id FROM vehicle_groups WHERE vehicle_id = $1', [vehicleId]);
      const groupIds = groupRes.rows.map(r => r.group_id);

      let query = `
        SELECT * FROM renewal_plans 
        WHERE is_active = true 
        AND (
          (group_id = ANY($1::uuid[])) OR 
          (user_id = $2) OR 
          (org_id = $3 AND user_id IS NULL AND group_id IS NULL)
        )
      `;
      const plansRes = await db.query(query, [groupIds.length ? groupIds : [null], req.user.userId, req.user.orgId]);
      
      const plans = plansRes.rows;
      if (plans.length === 0) {
        return res.status(404).json({ success: false, error: 'No renewal plans configured for this vehicle.' });
      }

      // Priority sort: group > user > org
      const groupPlan = plans.find(p => p.group_id);
      const userPlan = plans.find(p => p.user_id);
      const orgPlan = plans.find(p => p.org_id && !p.user_id && !p.group_id);

      const applicablePlan = groupPlan || userPlan || orgPlan;

      res.status(200).json({ success: true, data: applicablePlan });
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

      let amount = 0;
      let durationMonths = 12;
      let dbPlanId = null;

      if (typeof planId === 'string' && planId.startsWith('vehicle_custom_')) {
        const vRes = await client.query('SELECT metadata, licence_expire_date FROM vehicles WHERE id = $1', [vehicleId]);
        if (vRes.rows.length === 0) throw new Error('Vehicle not found.');
        const metadata = vRes.rows[0].metadata || {};
        amount = parseFloat(metadata.renewal_price || 0);
        durationMonths = parseInt(metadata.plan_duration_months || 12, 10);
      } else {
        const planRes = await client.query('SELECT id, price, duration_months FROM renewal_plans WHERE id = $1 AND is_active = true', [planId]);
        if (planRes.rows.length === 0) {
          // Fallback check vehicle metadata if planId wasn't found in renewal_plans
          const vRes = await client.query('SELECT metadata FROM vehicles WHERE id = $1', [vehicleId]);
          if (vRes.rows.length > 0 && vRes.rows[0].metadata?.renewal_price !== undefined) {
            const metadata = vRes.rows[0].metadata;
            amount = parseFloat(metadata.renewal_price || 0);
            durationMonths = parseInt(metadata.plan_duration_months || 12, 10);
          } else {
            throw new Error('Invalid or inactive renewal plan.');
          }
        } else {
          const plan = planRes.rows[0];
          dbPlanId = plan.id;
          amount = parseFloat(plan.price);
          durationMonths = parseInt(plan.duration_months, 10);
        }
      }

      // Update vehicle licence date (+duration_months from now if expired, or from existing date)
      const vehicleRes = await client.query('SELECT licence_expire_date FROM vehicles WHERE id = $1', [vehicleId]);
      if (vehicleRes.rows.length === 0) {
        throw new Error('Vehicle not found.');
      }
      
      const currentExpireDate = vehicleRes.rows[0].licence_expire_date ? new Date(vehicleRes.rows[0].licence_expire_date) : new Date();
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

      await client.query('UPDATE vehicles SET licence_expire_date = $1, updated_at = NOW() WHERE id = $2', [newExpireDate, vehicleId]);

      // Record transaction
      await client.query(`
        INSERT INTO renewal_transactions (user_id, vehicle_id, amount, status, payment_id, plan_id, duration_months, created_at)
        VALUES ($1, $2, $3, 'SUCCESS', $4, $5, $6, NOW())
      `, [req.user.userId, vehicleId, amount, paymentId, dbPlanId, durationMonths]);

      await client.query('COMMIT');

      res.status(200).json({ 
        success: true, 
        message: 'Payment verified and license extended.',
        data: { newExpireDate, paymentId, amount }
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
