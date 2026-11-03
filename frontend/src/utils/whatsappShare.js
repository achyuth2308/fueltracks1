/**
 * WhatsApp Share Utilities for FuelTracks Credentials
 */

/**
 * Normalizes phone number into international digits without '+' or spaces.
 * Defaults to India (+91) if 10 digits provided.
 */
export function normalizeWhatsAppPhone(rawPhone, defaultCountryCode = '91') {
  if (!rawPhone) return '';
  const str = String(rawPhone).trim();
  // Strip non-digits
  const digits = str.replace(/\D/g, '');
  if (!digits) return '';

  // 10 digits Indian mobile (starts with 6, 7, 8, 9)
  if (digits.length === 10) {
    return `${defaultCountryCode}${digits}`;
  }

  // 11 digits with leading 0 (e.g., 09876543210)
  if (digits.length === 11 && digits.startsWith('0')) {
    return `${defaultCountryCode}${digits.slice(1)}`;
  }

  // Already includes country code (e.g. 919876543210)
  return digits;
}

/**
 * Formats the customer credentials message according to the FuelTracks WhatsApp template.
 */
export function formatWhatsAppCredentialsMessage({ name, username, password }) {
  const customerName = name && name.trim() ? name.trim() : 'Customer';
  const userId = username && username.trim() ? username.trim() : '—';
  const userPass = password != null && String(password).trim() !== '' && String(password).trim() !== '—'
    ? String(password).trim()
    : '223344';

  return (
`*Dear ${customerName},*

Greetings from *FuelTracks Technologies Pvt. Ltd.*!

Your GPS Tracking Device has been successfully installed and activated.

*Your Login Credentials*

👤 *User ID:* ${userId}
🔑 *Password:* ${userPass}

*Access FuelTracks:*
🌐 *Web Portal:* https://app.fueltracks.in
📱 *Android App:* https://play.google.com/store/apps/details?id=com.fueltracks.customer
🍏 *iOS App:* https://apps.apple.com/in/app/fueltracks-vehicle-tracking/id6814368846

After logging in, you can access:
* Live Vehicle Tracking
* Trip History
* Route Playback
* Alerts & Notifications

For any assistance with login or app usage, please feel free to contact our support team.

*Thank you for choosing FuelTracks Technologies Pvt. Ltd. We appreciate your trust and look forward to serving you.*`
  );
}

/**
 * Builds the direct WhatsApp deep link (wa.me)
 */
export function buildWhatsAppShareUrl({ phone, name, username, password }) {
  const cleanPhone = normalizeWhatsAppPhone(phone);
  const message = formatWhatsAppCredentialsMessage({ name, username, password });
  const encodedMessage = encodeURIComponent(message);

  if (cleanPhone) {
    return `https://wa.me/${cleanPhone}?text=${encodedMessage}`;
  }
  // Fallback if no phone: opens WhatsApp web share dialog
  return `https://wa.me/?text=${encodedMessage}`;
}

/**
 * Opens WhatsApp in a new tab / triggers WhatsApp app
 */
export function openWhatsAppCredentialsShare({ phone, name, username, password }) {
  const url = buildWhatsAppShareUrl({ phone, name, username, password });
  window.open(url, '_blank', 'noopener,noreferrer');
  return url;
}

