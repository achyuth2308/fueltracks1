/**
 * @file emailExample.controller.js
 * @description Example controller demonstrating how to use the SendGrid email service.
 */

const sendgridService = require('../services/sendgrid.service');

/**
 * Controller to send a test OTP email.
 */
const testOTPEmail = async (req, res, next) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ success: false, error: 'Email is required' });
    }

    // Generate random 6 digit OTP for testing
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiryMinutes = 10;

    await sendgridService.sendOTPEmail({ email, otp, expiryMinutes });

    return res.status(200).json({
      success: true,
      message: 'Test OTP email sent successfully.',
      data: { email, otp }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Controller to send a test Geofence alert.
 */
const testGeofenceAlert = async (req, res, next) => {
  try {
    const { email, vehicleNumber, geofenceName, action } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, error: 'Email is required' });
    }

    await sendgridService.sendGeofenceAlert({
      email,
      vehicleNumber: vehicleNumber || 'TS07AB1234',
      geofenceName: geofenceName || 'Hyderabad Warehouse',
      action: action || 'Entered',
      location: '17.432, 78.411',
      time: new Date().toLocaleString()
    });

    return res.status(200).json({
      success: true,
      message: 'Test Geofence Alert email sent successfully.'
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  testOTPEmail,
  testGeofenceAlert
};
