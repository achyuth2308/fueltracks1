/**
 * @file otp.template.js
 * @description HTML template for sending OTP codes. Includes FuelTracks branding, responsive design, and security notices.
 */

/**
 * Generates the HTML for the OTP email.
 * 
 * @param {Object} params - The template parameters
 * @param {string|number} params.otp - The 6-digit OTP code
 * @param {number} params.expiryMinutes - Number of minutes until the OTP expires
 * @returns {string} - The generated HTML string
 */
const getOTPTemplate = ({ otp, expiryMinutes }) => {
  return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Your OTP Code - FuelTracks</title>
    <style>
      body {
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
        background-color: #f4f7f9;
        margin: 0;
        padding: 0;
        -webkit-font-smoothing: antialiased;
        color: #333333;
      }
      .email-wrapper {
        width: 100%;
        background-color: #f4f7f9;
        padding: 40px 0;
      }
      .email-content {
        max-width: 600px;
        margin: 0 auto;
        background-color: #ffffff;
        border-radius: 8px;
        overflow: hidden;
        box-shadow: 0 4px 12px rgba(0,0,0,0.05);
      }
      .email-header {
        background-color: #0b1f3b; /* FuelTracks Dark Blue */
        padding: 30px;
        text-align: center;
      }
      .email-header h1 {
        color: #ffffff;
        margin: 0;
        font-size: 24px;
        font-weight: 600;
        letter-spacing: 0.5px;
      }
      .email-header span {
        color: #17b385; /* FuelTracks Green */
      }
      .email-body {
        padding: 40px 30px;
      }
      .email-body p {
        font-size: 16px;
        line-height: 1.6;
        color: #4a5568;
        margin-top: 0;
        margin-bottom: 24px;
      }
      .otp-container {
        text-align: center;
        background-color: #f8fafc;
        border: 2px dashed #cbd5e1;
        border-radius: 8px;
        padding: 24px;
        margin: 32px 0;
      }
      .otp-code {
        font-size: 42px;
        font-weight: 700;
        letter-spacing: 6px;
        color: #0b1f3b;
        margin: 0;
      }
      .expiry-notice {
        font-size: 14px;
        color: #e53e3e;
        font-weight: 500;
        margin-top: 12px;
        margin-bottom: 0;
      }
      .security-notice {
        font-size: 14px;
        color: #718096;
        background-color: #f1f5f9;
        padding: 16px;
        border-left: 4px solid #0b1f3b;
        border-radius: 0 4px 4px 0;
        margin-bottom: 0;
      }
      .email-footer {
        background-color: #f8fafc;
        padding: 24px 30px;
        text-align: center;
        border-top: 1px solid #e2e8f0;
      }
      .email-footer p {
        font-size: 13px;
        color: #94a3b8;
        margin: 0;
        line-height: 1.5;
      }
      @media only screen and (max-width: 600px) {
        .email-content {
          width: 100% !important;
          border-radius: 0;
        }
        .email-body {
          padding: 30px 20px;
        }
        .otp-code {
          font-size: 36px;
          letter-spacing: 4px;
        }
      }
    </style>
  </head>
  <body>
    <table class="email-wrapper" cellpadding="0" cellspacing="0" role="presentation">
      <tr>
        <td align="center">
          <table class="email-content" cellpadding="0" cellspacing="0" role="presentation">
            <tr>
              <td class="email-header">
                <h1>Fuel<span>Tracks</span></h1>
              </td>
            </tr>
            <tr>
              <td class="email-body">
                <p>Hello,</p>
                <p>You recently requested a One-Time Password (OTP) to securely access your FuelTracks account. Please use the verification code below:</p>
                
                <div class="otp-container">
                  <p class="otp-code">${otp}</p>
                  <p class="expiry-notice">This code expires in ${expiryMinutes} minutes.</p>
                </div>
                
                <p class="security-notice">
                  <strong>Security Notice:</strong> Do not share this code with anyone. Our support team will never ask you for your password or OTP.
                </p>
                <br>
                <p>If you did not request this code, please ignore this email or contact support if you feel your account is at risk.</p>
                
                <p style="margin-bottom: 0;">Best regards,<br>The FuelTracks Team</p>
              </td>
            </tr>
            <tr>
              <td class="email-footer">
                <p>&copy; ${new Date().getFullYear()} FuelTracks Enterprise. All rights reserved.</p>
                <p>Automated message sent by FuelTracks system.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
  </html>
  `;
};

module.exports = {
  getOTPTemplate
};
