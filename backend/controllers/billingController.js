// ============================================================
// BILLING CONTROLLER (CUSTOMER)
// ============================================================

const db = require('../config/db');

const BillingController = {
  async getRenewalSettings(req, res, next) {
    try {
      const result = await db.query('SELECT amount FROM renewal_settings LIMIT 1');
      res.status(200).json({ success: true, data: result.rows[0] });
    } catch (err) {
      next(err);
    }
  },

  async verifyRenewal(req, res, next) {
    const client = await db.getClient();
    try {
      const { vehicleId, paymentId } = req.body;
      
      if (!vehicleId || !paymentId) {
        return res.status(400).json({ success: false, error: 'Vehicle ID and Payment ID are required.' });
      }

      await client.query('BEGIN');

      // Get current amount from settings
      const settingsRes = await client.query('SELECT amount FROM renewal_settings LIMIT 1');
      const amount = settingsRes.rows[0]?.amount || 2000;

      // Update vehicle licence date (+1 year from now if expired, or +1 year from existing date)
      // Since vehicle is uuid, ensure param matches
      const vehicleRes = await client.query('SELECT licence_expire_date FROM vehicles WHERE id = $1', [vehicleId]);
      if (vehicleRes.rows.length === 0) {
        throw new Error('Vehicle not found.');
      }
      
      const currentExpireDate = new Date(vehicleRes.rows[0].licence_expire_date);
      const now = new Date();
      let newExpireDate;
      
      if (currentExpireDate > now) {
        // Still valid, add 1 year
        newExpireDate = new Date(currentExpireDate);
        newExpireDate.setFullYear(newExpireDate.getFullYear() + 1);
      } else {
        // Expired, set to 1 year from now
        newExpireDate = new Date(now);
        newExpireDate.setFullYear(newExpireDate.getFullYear() + 1);
      }

      await client.query('UPDATE vehicles SET licence_expire_date = $1 WHERE id = $2', [newExpireDate, vehicleId]);

      // Record transaction
      await client.query(`
        INSERT INTO renewal_transactions (user_id, vehicle_id, amount, status, payment_id)
        VALUES ($1, $2, $3, 'SUCCESS', $4)
      `, [req.user.userId, vehicleId, amount, paymentId]);

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
