const fs = require('fs');
const { execSync } = require('child_process');

const imei = '861329085720424';

try {
  console.log("Searching all PM2 TCP logs for " + imei);
  const result = execSync(`zgrep -a "${imei}" /var/log/pm2/fueltracks-tcp* || true`).toString();
  if (result.trim().length > 0) {
    console.log("FOUND:");
    console.log(result);
  } else {
    console.log("NOT FOUND IN ANY LOG.");
  }
} catch(e) {
  console.log("Error searching logs.");
}
