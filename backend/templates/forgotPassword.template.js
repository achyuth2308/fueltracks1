/**
 * @file forgotPassword.template.js
 * @description HTML template for the forgot password email flow.
 */

/**
 * Generates the HTML for the Forgot Password email.
 * 
 * @param {Object} params - The template parameters
 * @param {string} params.resetLink - The URL for the user to click to reset their password
 * @param {number} params.expiryMinutes - Number of minutes until the link expires
 * @returns {string} - The generated HTML string
 */
const getForgotPasswordTemplate = ({ resetLink, expiryMinutes }) => {
  return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reset Your Password - FuelTracks</title>
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
        background-color: #0b1f3b;
        padding: 30px;
        text-align: center;
      }
      .email-header h1 {
        color: #ffffff;
        margin: 0;
        font-size: 24px;
        font-weight: 600;
      }
      .email-header span {
        color: #17b385;
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
      .btn-container {
        text-align: center;
        margin: 32px 0;
      }
      .reset-btn {
        background-color: #17b385;
        color: #ffffff !important;
        text-decoration: none;
        padding: 14px 32px;
        border-radius: 6px;
        font-size: 16px;
        font-weight: 600;
        display: inline-block;
      }
      .reset-url {
        font-size: 13px;
        color: #718096;
        word-break: break-all;
        background-color: #f8fafc;
        padding: 12px;
        border-radius: 4px;
        margin-top: 24px;
      }
      .expiry-notice {
        font-size: 14px;
        color: #e53e3e;
        font-weight: 500;
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
                <p>We received a request to reset the password for your FuelTracks account. If you made this request, please click the button below to set a new password:</p>
                
                <div class="btn-container">
                  <a href="${resetLink}" class="reset-btn" target="_blank">Reset Password</a>
                </div>
                
                <p class="expiry-notice">This link will expire in ${expiryMinutes} minutes.</p>
                
                <p>If you did not request a password reset, you can safely ignore this email. Your account is secure and your password will not be changed.</p>
                
                <div class="reset-url">
                  <p style="margin-bottom: 8px;">If the button doesn't work, copy and paste this link into your browser:</p>
                  ${resetLink}
                </div>
                
                <p style="margin-top: 24px; margin-bottom: 0;">Best regards,<br>The FuelTracks Team</p>
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
  getForgotPasswordTemplate
};
