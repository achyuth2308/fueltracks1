/**
 * @file fleetAlert.template.js
 * @description HTML template for fleet telemetry alerts (Overspeed, Ignition, Harsh Braking, etc).
 */

/**
 * Generates the HTML for a Fleet Alert email.
 * 
 * @param {Object} params - The template parameters
 * @param {string} params.vehicleNumber - The registration/name of the vehicle
 * @param {string} params.alertType - The type of alert (e.g., 'Overspeed', 'Ignition ON')
 * @param {string} params.message - Detailed alert message
 * @param {string} params.location - Location or coordinate string
 * @param {string} params.time - Formatted timestamp of the alert
 * @returns {string} - The generated HTML string
 */
const getFleetAlertTemplate = ({ vehicleNumber, alertType, message, location, time }) => {
  // Determine color based on alert type severity
  let alertColor = '#e53e3e'; // Default red for critical alerts
  let icon = '⚠️';
  
  const typeLower = alertType.toLowerCase();
  if (typeLower.includes('online') || typeLower.includes('ignition on') || typeLower.includes('refill')) {
    alertColor = '#17b385'; // Green
    icon = '✅';
  } else if (typeLower.includes('offline') || typeLower.includes('ignition off')) {
    alertColor = '#718096'; // Gray
    icon = 'ℹ️';
  } else if (typeLower.includes('overspeed') || typeLower.includes('harsh')) {
    alertColor = '#dd6b20'; // Orange
    icon = '🚨';
  }

  return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Fleet Alert: ${alertType}</title>
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
        padding: 20px 30px;
        text-align: center;
      }
      .email-header h1 {
        color: #ffffff;
        margin: 0;
        font-size: 20px;
        font-weight: 600;
      }
      .email-header span {
        color: #17b385;
      }
      .alert-banner {
        background-color: ${alertColor};
        color: #ffffff;
        padding: 16px 30px;
        text-align: center;
        font-weight: 600;
        font-size: 18px;
        letter-spacing: 0.5px;
      }
      .email-body {
        padding: 30px;
      }
      .email-body p {
        font-size: 15px;
        line-height: 1.6;
        color: #4a5568;
        margin-top: 0;
        margin-bottom: 24px;
      }
      .details-table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 24px;
        background-color: #f8fafc;
        border-radius: 6px;
        overflow: hidden;
      }
      .details-table th, .details-table td {
        padding: 14px 16px;
        text-align: left;
        border-bottom: 1px solid #e2e8f0;
        font-size: 14px;
      }
      .details-table th {
        color: #64748b;
        font-weight: 600;
        width: 35%;
        background-color: #f1f5f9;
      }
      .details-table td {
        color: #1e293b;
        font-weight: 500;
      }
      .details-table tr:last-child th, .details-table tr:last-child td {
        border-bottom: none;
      }
      .btn-container {
        text-align: center;
        margin: 30px 0 10px 0;
      }
      .action-btn {
        background-color: #0b1f3b;
        color: #ffffff !important;
        text-decoration: none;
        padding: 12px 28px;
        border-radius: 6px;
        font-size: 15px;
        font-weight: 600;
        display: inline-block;
      }
      .email-footer {
        background-color: #f8fafc;
        padding: 20px 30px;
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
          padding: 20px;
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
              <td class="alert-banner">
                ${icon} ${alertType}
              </td>
            </tr>
            <tr>
              <td class="email-body">
                <p>An automated alert was triggered by a vehicle in your fleet.</p>
                
                <table class="details-table" cellpadding="0" cellspacing="0" role="presentation">
                  <tr>
                    <th>Vehicle</th>
                    <td>${vehicleNumber}</td>
                  </tr>
                  <tr>
                    <th>Alert Event</th>
                    <td style="color: ${alertColor}; font-weight: 600;">${alertType}</td>
                  </tr>
                  <tr>
                    <th>Details</th>
                    <td>${message}</td>
                  </tr>
                  <tr>
                    <th>Location</th>
                    <td>${location || 'Unknown'}</td>
                  </tr>
                  <tr>
                    <th>Time</th>
                    <td>${time}</td>
                  </tr>
                </table>
                
                <div class="btn-container">
                  <a href="https://app.fueltracks.in/dashboard" class="action-btn" target="_blank">View on Map</a>
                </div>
              </td>
            </tr>
            <tr>
              <td class="email-footer">
                <p>&copy; ${new Date().getFullYear()} FuelTracks Enterprise. All rights reserved.</p>
                <p>To change alert preferences, visit your account settings.</p>
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
  getFleetAlertTemplate
};
