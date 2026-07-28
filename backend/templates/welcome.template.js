/**
 * @file welcome.template.js
 * @description HTML template for welcoming a new user.
 */

/**
 * Generates the HTML for the Welcome email.
 * 
 * @param {Object} params - The template parameters
 * @param {string} params.firstName - The user's first name
 * @returns {string} - The generated HTML string
 */
const getWelcomeTemplate = ({ firstName }) => {
  const nameDisplay = firstName ? ` ${firstName}` : '';
  
  return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to FuelTracks!</title>
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
      .hero-section {
        background-color: #f8fafc;
        text-align: center;
        padding: 40px 30px;
        border-bottom: 1px solid #e2e8f0;
      }
      .hero-section h2 {
        color: #0b1f3b;
        margin-top: 0;
        font-size: 22px;
      }
      .email-body {
        padding: 40px 30px;
      }
      .email-body p {
        font-size: 16px;
        line-height: 1.6;
        color: #4a5568;
        margin-top: 0;
        margin-bottom: 20px;
      }
      .feature-list {
        margin: 24px 0;
        padding-left: 20px;
        color: #4a5568;
      }
      .feature-list li {
        margin-bottom: 12px;
        line-height: 1.5;
      }
      .btn-container {
        text-align: center;
        margin: 32px 0;
      }
      .login-btn {
        background-color: #17b385;
        color: #ffffff !important;
        text-decoration: none;
        padding: 14px 32px;
        border-radius: 6px;
        font-size: 16px;
        font-weight: 600;
        display: inline-block;
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
              <td class="hero-section">
                <h2>Welcome aboard${nameDisplay}!</h2>
                <p style="color: #64748b; margin-bottom: 0;">We're thrilled to have you join FuelTracks Enterprise.</p>
              </td>
            </tr>
            <tr>
              <td class="email-body">
                <p>Your account is now fully active and ready to use. FuelTracks gives you complete visibility and control over your entire fleet operations in real-time.</p>
                
                <p><strong>Here are a few things you can do right away:</strong></p>
                <ul class="feature-list">
                  <li>Track your vehicles live on the interactive map</li>
                  <li>Set up geofences for automated entry/exit alerts</li>
                  <li>Monitor fuel consumption and detect potential theft</li>
                  <li>Generate detailed analytical reports for your fleet</li>
                </ul>
                
                <div class="btn-container">
                  <a href="https://app.fueltracks.in" class="login-btn" target="_blank">Go to Dashboard</a>
                </div>
                
                <p>If you need any assistance getting set up, our support team is always here to help.</p>
                
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
  getWelcomeTemplate
};
