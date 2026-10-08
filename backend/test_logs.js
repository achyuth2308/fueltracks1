const fs = require('fs');
const logs = fs.readFileSync('/var/log/pm2/fueltracks-api-error.log', 'utf8');
const lines = logs.split('\n');
let count = 0;
for (let i = lines.length - 1; i >= 0; i--) {
  if (lines[i].includes('Error') && !lines[i].includes('CORS')) {
    console.log(lines.slice(Math.max(0, i-5), i+15).join('\n'));
    console.log('---------------------------');
    count++;
    if (count > 5) break;
  }
}
