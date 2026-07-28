/**
 * @file sendgrid.service.js
 * @description Core email service wrapper using @sendgrid/mail.
 */

const sgMail = require('@sendgrid/mail');
const { getOTPTemplate } = require('../templates/otp.template');
const { getForgotPasswordTemplate } = require('../templates/forgotPassword.template');
const { getEmailVerificationTemplate } = require('../templates/emailVerification.template');
const { getWelcomeTemplate } = require('../templates/welcome.template');
const { getFleetAlertTemplate } = require('../templates/fleetAlert.template');
const { getGeofenceAlertTemplate } = require('../templates/geofenceAlert.template');

// Initialize SendGrid
if (!process.env.SENDGRID_API_KEY) {
  console.warn('[SENDGRID] Warning: SENDGRID_API_KEY is not defined in environment variables.');
} else {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@fueltracks.in';
const FROM_NAME = process.env.FROM_NAME || 'FuelTracks';

/**
 * Base generic function to send an email.
 * 
 * @param {string} to - Recipient email address
 * @param {string} subject - Email subject line
 * @param {string} html - HTML string of the email body
 * @returns {Promise<boolean>} - True if sent successfully, throws error otherwise
 */
const sendEmail = async (to, subject, html) => {
  if (!process.env.SENDGRID_API_KEY) {
    throw new Error('SendGrid API Key is missing.');
  }
  if (!to) {
    throw new Error('Recipient email is required.');
  }

  const msg = {
    to,
    from: {
      email: FROM_EMAIL,
      name: FROM_NAME,
    },
    subject,
    html,
  };

  try {
    const response = await sgMail.send(msg);
    console.log(`[SENDGRID] Email sent successfully to ${to}. Subject: "${subject}"`);
    return true;
  } catch (error) {
    console.error(`[SENDGRID] Failed to send email to ${to}:`, error.message);
    if (error.response) {
      console.error(error.response.body);
    }
    throw new Error(`Email delivery failed: ${error.message}`);
  }
};

/**
 * Send an OTP code to a user.
 * 
 * @param {Object} params
 * @param {string} params.email - User email
 * @param {string} params.otp - OTP code
 * @param {number} params.expiryMinutes - Validity duration
 */
const sendOTPEmail = async ({ email, otp, expiryMinutes }) => {
  const html = getOTPTemplate({ otp, expiryMinutes });
  return await sendEmail(email, 'Your FuelTracks OTP Code', html);
};

/**
 * Send a forgot password reset link.
 * 
 * @param {Object} params
 * @param {string} params.email - User email
 * @param {string} params.resetLink - Password reset URL
 * @param {number} params.expiryMinutes - Validity duration
 */
const sendForgotPasswordEmail = async ({ email, resetLink, expiryMinutes }) => {
  const html = getForgotPasswordTemplate({ resetLink, expiryMinutes });
  return await sendEmail(email, 'Reset Your FuelTracks Password', html);
};

/**
 * Send an email verification link to a new or updated user.
 * 
 * @param {Object} params
 * @param {string} params.email - User email
 * @param {string} params.verificationLink - Verification URL
 */
const sendVerificationEmail = async ({ email, verificationLink }) => {
  const html = getEmailVerificationTemplate({ verificationLink });
  return await sendEmail(email, 'Verify Your FuelTracks Account', html);
};

/**
 * Send a welcome email to a newly verified user.
 * 
 * @param {Object} params
 * @param {string} params.email - User email
 * @param {string} params.firstName - User's first name
 */
const sendWelcomeEmail = async ({ email, firstName }) => {
  const html = getWelcomeTemplate({ firstName });
  return await sendEmail(email, 'Welcome to FuelTracks Enterprise!', html);
};

/**
 * Send a telemetry fleet alert (e.g. Overspeed, Ignition).
 * 
 * @param {Object} params
 * @param {string} params.email - Recipient email
 * @param {string} params.vehicleNumber - Vehicle ID/Reg
 * @param {string} params.alertType - Type of alert
 * @param {string} params.message - Alert details
 * @param {string} params.location - Coordinate string or address
 * @param {string} params.time - ISO string or formatted timestamp
 */
const sendFleetAlert = async ({ email, vehicleNumber, alertType, message, location, time }) => {
  const html = getFleetAlertTemplate({ vehicleNumber, alertType, message, location, time });
  return await sendEmail(email, `Fleet Alert: ${alertType} - ${vehicleNumber}`, html);
};

/**
 * Send a geofence entry/exit alert.
 * 
 * @param {Object} params
 * @param {string} params.email - Recipient email
 * @param {string} params.vehicleNumber - Vehicle ID/Reg
 * @param {string} params.geofenceName - Geofence zone name
 * @param {string} params.action - 'Entered' or 'Exited'
 * @param {string} params.location - Coordinate string or address
 * @param {string} params.time - ISO string or formatted timestamp
 */
const sendGeofenceAlert = async ({ email, vehicleNumber, geofenceName, action, location, time }) => {
  const html = getGeofenceAlertTemplate({ vehicleNumber, geofenceName, action, location, time });
  return await sendEmail(email, `Geofence Alert: ${vehicleNumber} ${action} ${geofenceName}`, html);
};

module.exports = {
  sendEmail,
  sendOTPEmail,
  sendForgotPasswordEmail,
  sendVerificationEmail,
  sendWelcomeEmail,
  sendFleetAlert,
  sendGeofenceAlert
};
