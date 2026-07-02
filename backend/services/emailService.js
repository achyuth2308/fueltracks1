const { BrevoClient } = require('@getbrevo/brevo');
const env = require('../config/env');

let brevoClient = null;

function getBrevoClient() {
  if (!brevoClient) {
    brevoClient = new BrevoClient({
      apiKey: env.BREVO_API_KEY || '',
    });
  }
  return brevoClient;
}

const EmailService = {
  /**
   * Send a password reset email
   */
  async sendPasswordResetEmail(toEmail, resetToken) {
    // Resolve the correct frontend URL — never fall back to localhost in production
    let frontendUrl = env.FRONTEND_URL || '';
    if (!frontendUrl || frontendUrl.includes('localhost')) {
      // Best-effort: derive from the request origin — caller must set FRONTEND_URL correctly
      frontendUrl = 'http://13.239.125.98';
      console.warn('[EmailService] FRONTEND_URL is not set or points to localhost — using IP fallback. Please set FRONTEND_URL in .env to your real domain.');
    }

    const resetUrl = `${frontendUrl}/reset-password?token=${resetToken}`;

    if (!env.BREVO_API_KEY || env.BREVO_API_KEY === 'YOUR_BREVO_API_KEY_HERE' || env.BREVO_API_KEY === 'your_brevo_api_key_here') {
      console.warn('[EmailService] BREVO_API_KEY is not configured. Skipping email send.');
      console.log(`[EmailService - DEV MODE] Password Reset Link: ${resetUrl}`);
      return true;
    }

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Password Reset</title>
</head>
<body style="margin:0;padding:0;background:#f0f9ff;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f9ff;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 30px rgba(0,0,0,0.08);border:1px solid #e0f2fe;">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#1e293b 0%,#334155 100%);padding:32px 40px;text-align:center;">
              <div style="font-size:26px;font-weight:900;color:#f97316;letter-spacing:-0.5px;">FuelTracks</div>
              <div style="font-size:12px;color:#94a3b8;margin-top:4px;letter-spacing:2px;text-transform:uppercase;">Fleet Management</div>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px 40px 32px;">
              <div style="width:60px;height:60px;background:#fff7ed;border-radius:50%;margin:0 auto 24px;display:flex;align-items:center;justify-content:center;border:2px solid #fed7aa;text-align:center;line-height:60px;font-size:28px;">🔐</div>
              <h1 style="margin:0 0 12px;font-size:22px;font-weight:800;color:#111827;text-align:center;">Password Reset Request</h1>
              <p style="margin:0 0 24px;font-size:14px;color:#6b7280;text-align:center;line-height:1.6;">
                We received a request to reset the password for your FuelTracks account associated with <strong>${toEmail}</strong>.
              </p>
              <p style="margin:0 0 24px;font-size:14px;color:#6b7280;text-align:center;line-height:1.6;">
                Click the button below to reset your password. This link is valid for <strong>1 hour</strong>.
              </p>
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:8px 0 28px;">
                    <a href="${resetUrl}" target="_blank"
                       style="display:inline-block;padding:14px 40px;background:linear-gradient(90deg,#f97316,#ea580c);color:#ffffff;text-decoration:none;border-radius:10px;font-weight:700;font-size:15px;letter-spacing:0.5px;box-shadow:0 4px 14px rgba(249,115,22,0.4);">
                      Reset Password
                    </a>
                  </td>
                </tr>
              </table>
              <div style="background:#f8fafc;border-radius:8px;padding:14px 16px;margin-bottom:24px;border-left:3px solid #e2e8f0;">
                <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.5;">
                  If the button doesn't work, copy and paste this URL into your browser:<br/>
                  <span style="word-break:break-all;color:#3b82f6;font-size:11px;">${resetUrl}</span>
                </p>
              </div>
              <p style="margin:0;font-size:13px;color:#9ca3af;text-align:center;line-height:1.5;">
                If you didn't request this, please ignore this email — your password will remain unchanged.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background:#f8fafc;padding:20px 40px;border-top:1px solid #e5e7eb;text-align:center;">
              <p style="margin:0;font-size:11px;color:#9ca3af;">
                © ${new Date().getFullYear()} FuelTracks · Fleet Intelligence Platform<br/>
                This email was sent to ${toEmail}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    try {
      const brevo = getBrevoClient();
      const result = await brevo.transactionalEmails.sendTransacEmail({
        subject: 'Reset Your FuelTracks Password',
        htmlContent,
        sender: {
          name: 'FuelTracks',
          email: env.BREVO_SENDER_EMAIL || 'info@fueltracks.in',
        },
        to: [{ email: toEmail }],
      });
      console.log('[EmailService] Password reset email sent successfully to:', toEmail, '| messageId:', result?.messageId || 'N/A');
      return true;
    } catch (error) {
      const errMsg = error?.message || JSON.stringify(error);
      console.error('[EmailService] Failed to send password reset email to', toEmail, ':', errMsg);

      // In dev mode, log the link so the flow can still be tested without real email
      if (env.NODE_ENV && env.NODE_ENV.includes('dev')) {
        console.log(`[EmailService - DEV FALLBACK] Reset Link: ${resetUrl}`);
        return true;
      }

      throw new Error('Failed to send password reset email. Please try again later.');
    }
  },
};

module.exports = EmailService;
