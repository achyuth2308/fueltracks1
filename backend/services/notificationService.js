const nodemailer = require('nodemailer');
const axios = require('axios');

// Configure SMTP transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.mailtrap.io',
  port: parseInt(process.env.SMTP_PORT) || 2525,
  auth: {
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || ''
  }
});

const NotificationService = {
  /**
   * Send Email Alert
   */
  async sendEmail(toEmail, subject, textContent, htmlContent) {
    if (!toEmail) {
      console.warn('[NOTIFY-EMAIL] No recipient email specified.');
      return false;
    }

    const mailOptions = {
      from: process.env.SMTP_FROM || '"FuelTracks Alerts" <alerts@fueltracks.com>',
      to: toEmail,
      subject: subject,
      text: textContent,
      html: htmlContent || `<p>${textContent}</p>`
    };

    try {
      // Don't try sending if credentials aren't set in development (mock it instead)
      if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
        console.log(`[MOCK-EMAIL] Sent alert email to ${toEmail}: "${subject}"`);
        return true;
      }

      const info = await transporter.sendMail(mailOptions);
      console.log(`[NOTIFY-EMAIL] Email sent: ${info.messageId}`);
      return true;
    } catch (err) {
      console.error('[NOTIFY-EMAIL] Failed to send email:', err.message);
      return false;
    }
  },

  /**
   * Send WhatsApp Alert
   */
  async sendWhatsApp(toPhone, messageText) {
    if (!toPhone) {
      console.warn('[NOTIFY-WHATSAPP] No recipient phone number specified.');
      return false;
    }

    const waUrl = process.env.WHATSAPP_API_URL || 'https://api.twilio.com'; // or meta endpoint
    const waToken = process.env.WHATSAPP_API_TOKEN;

    try {
      // Mock it if no API token is configured in env
      if (!waToken) {
        console.log(`[MOCK-WHATSAPP] Sent WhatsApp to ${toPhone}: "${messageText}"`);
        return true;
      }

      // Real HTTP call (e.g. meta graph endpoint or generic webhook)
      const payload = {
        to: toPhone,
        type: 'text',
        text: { body: messageText }
      };

      await axios.post(waUrl, payload, {
        headers: {
          'Authorization': `Bearer ${waToken}`,
          'Content-Type': 'application/json'
        }
      });

      console.log(`[NOTIFY-WHATSAPP] WhatsApp message sent to ${toPhone}`);
      return true;
    } catch (err) {
      console.error('[NOTIFY-WHATSAPP] Failed to send WhatsApp message:', err.message);
      return false;
    }
  },

  /**
   * Send Alert via enabled channels
   */
  async dispatchAlert(orgProfile, alertType, alertText, vehicleInfo) {
    if (!orgProfile) return;

    const emailSubject = `[Alert] ${alertType.toUpperCase()} - ${vehicleInfo.name} (${vehicleInfo.plate})`;
    const bodyText = `Alert Type: ${alertType}\nVehicle: ${vehicleInfo.name}\nPlate: ${vehicleInfo.plate}\nIMEI: ${vehicleInfo.imei}\nDetails: ${alertText}\nTime: ${new Date().toLocaleString()}`;

    // 1. Email Channel
    if (orgProfile.email_enabled && orgProfile.email) {
      const htmlBody = `
        <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
          <h2 style="color: #EF4444; margin-top: 0;">⚠️ FuelTracks System Alert</h2>
          <hr />
          <p><strong>Alert Type:</strong> ${alertType.toUpperCase()}</p>
          <p><strong>Vehicle Name:</strong> ${vehicleInfo.name}</p>
          <p><strong>Plate Number:</strong> ${vehicleInfo.plate}</p>
          <p><strong>Device IMEI:</strong> ${vehicleInfo.imei}</p>
          <p><strong>Description:</strong> ${alertText}</p>
          <p><strong>Alert Time:</strong> ${new Date().toLocaleString()}</p>
          <hr />
          <p style="font-size: 12px; color: #888;">This is an automated notification. Please do not reply directly to this email.</p>
        </div>
      `;
      await this.sendEmail(orgProfile.email, emailSubject, bodyText, htmlBody);
    }

    // 2. WhatsApp Channel
    if (orgProfile.whatsapp_enabled && orgProfile.mobile) {
      const waText = `⚠️ *FuelTracks Alert*:\n*Type*: ${alertType.toUpperCase()}\n*Vehicle*: ${vehicleInfo.name} (${vehicleInfo.plate})\n*Details*: ${alertText}`;
      await this.sendWhatsApp(orgProfile.mobile, waText);
    }
  }
};

module.exports = NotificationService;
