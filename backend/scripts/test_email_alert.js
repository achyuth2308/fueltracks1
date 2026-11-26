/**
 * FuelTracks Email Alert Test Utility
 * 
 * Usage:
 *   node scripts/test_email_alert.js [recipient_email]
 * 
 * Example:
 *   node scripts/test_email_alert.js test@example.com
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
const NotificationService = require('../services/notificationService');

async function run() {
  console.log('====================================================');
  console.log('       FuelTracks Fleet Email Alert Tester          ');
  console.log('====================================================');

  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
  const smtpPort = process.env.SMTP_PORT || '465';

  console.log(`SMTP Service / Host : ${process.env.SMTP_SERVICE || smtpHost}:${smtpPort}`);
  console.log(`SMTP User           : ${smtpUser || '(NOT SET - MOCK MODE)'}`);
  console.log(`SMTP Pass           : ${smtpPass ? '******** (configured)' : '(NOT SET - MOCK MODE)'}`);

  const recipient = process.argv[2] || smtpUser || 'test@fueltracks.in';
  console.log(`Target Recipient    : ${recipient}`);
  console.log('----------------------------------------------------');

  const sampleAlert = {
    orgName: 'Madhu Logistics Fleet',
    alertType: 'FUEL_THEFT',
    alertText: 'Sudden fuel level drop of 18.5 Litres detected while vehicle is parked.',
    vehicleName: 'Tata Prima 4028',
    plate: 'AP04TW8185',
    imei: '862045051234567',
    address: 'Near NH44 Toll Plaza, Kurnool, Andhra Pradesh',
    deviceTime: new Date()
  };

  const subject = `🚨 [TEST ALERT] FUEL THEFT - ${sampleAlert.plate}`;
  const htmlContent = NotificationService.generateAlertEmailHtml(sampleAlert);
  const plainText = `[TEST] Fuel Theft Detected for vehicle ${sampleAlert.plate}. Details: ${sampleAlert.alertText}`;

  console.log('Dispatching test alert email...');
  const success = await NotificationService.sendEmail(recipient, subject, plainText, htmlContent);

  if (success) {
    if (smtpUser && smtpPass) {
      console.log(`\n✅ SUCCESS: Real email alert successfully sent to ${recipient}!`);
      console.log('Check your inbox (and Spam/Junk folder if not immediately visible).');
    } else {
      console.log(`\nℹ️ MOCK SUCCESS: Simulated alert logged successfully.`);
      console.log('To send real emails, set your Gmail address & 16-character App Password in fueltracks1/.env:');
      console.log('  SMTP_USER=your_email@gmail.com');
      console.log('  SMTP_PASS=your_16_char_app_password');
    }
  } else {
    console.log(`\n❌ FAILED: Could not send email alert.`);
    console.log('Tips for Gmail:');
    console.log('  1. Ensure 2-Step Verification is ON in your Google Account.');
    console.log('  2. Generate a 16-character App Password at https://myaccount.google.com/apppasswords');
    console.log('  3. Paste the 16 characters in SMTP_PASS in fueltracks1/.env without extra spaces.');
  }

  process.exit(success ? 0 : 1);
}

run().catch(err => {
  console.error('\n❌ Unexpected error:', err);
  process.exit(1);
});
