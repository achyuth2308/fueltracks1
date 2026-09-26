const fs = require('fs');

const imei = '865947080002518';
const logFile = '/var/log/pm2/fueltracks-tcp-out.log';

try {
  const content = fs.readFileSync(logFile, 'utf8');
  const lines = content.split('\n');
  const matched = lines.filter(line => line.includes(imei)).slice(-20);
  console.log(matched.join('\n'));
} catch (e) {
  console.error("Error reading log:", e.message);
}
