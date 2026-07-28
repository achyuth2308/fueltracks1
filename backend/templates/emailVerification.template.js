/**
 * @file emailVerification.template.js
 * @description HTML template for verifying user email addresses.
 */

/**
 * Generates the HTML for the Email Verification email.
 * 
 * @param {Object} params - The template parameters
 * @param {string} params.verificationLink - The URL to click to verify the email
 * @returns {string} - The generated HTML string
 */
const getEmailVerificationTemplate = ({ verificationLink }) => {
  return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Verify Your Email - FuelTracks</title>
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
      .verify-btn {
        background-color: #17b385;
        color: #ffffff !important;
        text-decoration: none;
        padding: 14px 32px;
        border-radius: 6px;
        font-size: 16px;
        font-weight: 600;
        display: inline-block;
      }
      .verify-url {
        font-size: 13px;
        color: #718096;
        word-break: break-all;
        background-color: #f8fafc;
        padding: 12px;
        border-radius: 4px;
        margin-top: 24px;
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
                <p>Welcome to FuelTracks!</p>
                <p>To get started and fully activate your account, we just need to verify your email address. Click the button below to complete the verification process:</p>
                
                <div class="btn-container">
                  <a href="${verificationLink}" class="verify-btn" target="_blank">Verify Email Address</a>
                </div>
                
                <div class="verify-url">
                  <p style="margin-bottom: 8px;">If the button doesn't work, copy and paste this link into your browser:</p>
                  ${verificationLink}
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
  getEmailVerificationTemplate
};
