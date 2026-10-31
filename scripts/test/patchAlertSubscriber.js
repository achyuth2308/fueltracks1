const fs = require('fs');

const path = 'backend/subscribers/alertSubscriber.js';
let s = fs.readFileSync(path, 'utf8');

const target = `          // Enqueue WhatsApp alert to DB outbox
          await NotificationService.enqueueWhatsAppAlert(alert, vehicle, org, address, data.alertPayload || {});
          // Enqueue WhatsApp alert to DB outbox
          await NotificationService.enqueueWhatsAppAlert(alert, vehicle, org, address, data.alertPayload || {});
          /*
          });
        }`;

const replacement = `          // Enqueue WhatsApp alert to DB outbox
          await NotificationService.enqueueWhatsAppAlert(alert, vehicle, org, address, data.alertPayload || {});
        }`;

if (s.includes(target.replace(/\n/g, '\r\n'))) {
  s = s.replace(target.replace(/\n/g, '\r\n'), replacement.replace(/\n/g, '\r\n'));
  fs.writeFileSync(path, s);
  console.log('SUCCESS: Patched alertSubscriber.js with CRLF');
} else if (s.includes(target)) {
  s = s.replace(target, replacement);
  fs.writeFileSync(path, s);
  console.log('SUCCESS: Patched alertSubscriber.js with LF');
} else {
  console.error('Target not found in alertSubscriber.js');
}

