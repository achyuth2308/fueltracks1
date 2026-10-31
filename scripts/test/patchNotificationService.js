const fs = require('fs');

const path = 'backend/services/notificationService.js';
let s = fs.readFileSync(path, 'utf8');

const target = `        await db.query(
          \`INSERT INTO whatsapp_messages (
             org_id, recipient_id, phone_masked, event_type, event_ref,
             template_name, language, payload, status
           ) VALUES ($1, $2, $3, $4, $5, $6, 'en', $7, 'queued')
           ON CONFLICT (event_type, event_ref, recipient_id) DO NOTHING\`,
          [org.id, r.id, masked, eventType, eventRef, templateName, JSON.stringify(payload)]
        );`;

const replacement = `        await db.query(
          \`INSERT INTO whatsapp_messages (
             org_id, recipient_id, phone_masked, event_type, event_ref,
             template_name, language, payload, status, expires_at
           ) VALUES ($1, $2, $3, $4, $5, $6, 'en', $7, 'queued', NOW() + INTERVAL '2 hours')
           ON CONFLICT (event_type, event_ref, recipient_id) DO NOTHING\`,
          [org.id, r.id, masked, eventType, eventRef, templateName, JSON.stringify(payload)]
        );`;

if (s.includes(target.replace(/\n/g, '\r\n'))) {
  s = s.replace(target.replace(/\n/g, '\r\n'), replacement.replace(/\n/g, '\r\n'));
  fs.writeFileSync(path, s);
  console.log('SUCCESS: Patched notificationService with CRLF');
} else if (s.includes(target)) {
  s = s.replace(target, replacement);
  fs.writeFileSync(path, s);
  console.log('SUCCESS: Patched notificationService with LF');
} else {
  console.error('Target not found in notificationService.js');
}

