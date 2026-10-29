const fs = require('fs');

const path = 'backend/models/gpsModel.js';
let s = fs.readFileSync(path, 'utf8');

const target = "} else if (type === 'main_battery_disconnected' || type === 'main_battery_connected' || type === 'power_cut' || type === 'battery') {\n        prefKey = 'power_cut';\n      }";
const targetCRLF = target.replace(/\n/g, '\r\n');
const replacement = "} else if (type === 'main_battery_disconnected' || type === 'main_battery_connected' || type === 'power_cut' || type === 'battery') {\n        prefKey = 'power_cut';\n      } else if (type === 'fuel_refill_final' || type === 'fuel_refill' || type === 'fuel_fill') {\n        prefKey = 'fuel_refill';\n      } else if (type === 'fuel_theft' || type === 'theft') {\n        prefKey = 'fuel_theft';\n      }";

if (s.includes(targetCRLF)) {
  s = s.replace(targetCRLF, replacement.replace(/\n/g, '\r\n'));
  fs.writeFileSync(path, s);
  console.log('SUCCESS: Patched with CRLF');
} else if (s.includes(target)) {
  s = s.replace(target, replacement);
  fs.writeFileSync(path, s);
  console.log('SUCCESS: Patched with LF');
} else {
  console.error('Target not found in gpsModel.js');
}

