const fs = require('fs');

const imei = '861329085720424';
const outLog = '/var/log/pm2/fueltracks-tcp-out.log';
const errLog = '/var/log/pm2/fueltracks-tcp-error.log';

function searchLog(file) {
  try {
    const data = fs.readFileSync(file, 'utf8');
    const lines = data.split('\n');
    let found = false;
    lines.forEach(line => {
      if (line.includes(imei)) {
        console.log(`[${file}] ${line}`);
        found = true;
      }
    });
    if (!found) console.log(`No matches in ${file}`);
  } catch (e) {
    console.log(`Error reading ${file}`);
  }
}

searchLog(outLog);
searchLog(errLog);
