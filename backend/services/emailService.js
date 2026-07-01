const { BrevoClient } = require('@getbrevo/brevo');
const env = require('../config/env');

const brevo = new BrevoClient({
  apiKey: env.BREVO_API_KEY || ''
});

const EmailService = {
  /**
   * Send a password reset email
   */
  async sendPasswordResetEmail(toEmail, resetToken) {
    const resetUrl = `${env.FRONTEND_URL}/reset-password?token=${resetToken}`;

    if (!env.BREVO_API_KEY || env.BREVO_API_KEY === 'your_brevo_api_key_here') {
      console.warn('[EmailService] BREVO_API_KEY is not configured. Skipping email send.');
      console.log(`[EmailService - DEV MODE] Password Reset Link: ${resetUrl}`);
      return true; // Return true in dev so the flow continues
    }
    
    try {
      const data = await brevo.transactionalEmails.sendTransacEmail({
        subject: 'Password Reset Request',
        htmlContent: `
          <html>
            <body>
              <h1>Password Reset Request</h1>
              <p>You recently requested to reset your password for your account.</p>
              <p>Click the link below to reset it. This link is valid for 1 hour.</p>
              <a href="${resetUrl}">Reset Password</a>
              <p>If you did not request a password reset, please ignore this email.</p>
            </body>
          </html>
        `,
        sender: { 
          name: 'FuelTracks', 
          email: env.BREVO_SENDER_EMAIL || 'mvachyuthsivarao@gmail.com' 
        },
        to: [{ email: toEmail }]
      });
      console.log('[EmailService] Password reset email sent successfully.', data.messageId);
      return true;
    } catch (error) {
      console.error('[EmailService] Error sending password reset email:', error.message || error);
      
      // Fallback for development so testing isn't blocked by invalid API keys
      // Use .includes('dev') to avoid issues with trailing characters like \r in Windows
      if (env.NODE_ENV && env.NODE_ENV.includes('dev')) {
        console.log(`[EmailService - DEV MODE Fallback] Password Reset Link: ${resetUrl}`);
        return true;
      }

      console.error(`[EmailService] NODE_ENV is ${env.NODE_ENV}. Throwing error.`);
      throw new Error('Failed to send email');
    }
  }
};

module.exports = EmailService;
