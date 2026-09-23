const { execSync } = require('child_process');
try {
  const result = execSync('node backend/scripts/create_api_key.js --org "FuelTracks Platform" --label "Cement OMS - Final Key" --group-id "ab3da8b8-11ec-4045-bce7-cce1ef32261d"', { encoding: 'utf8' });
  console.log(result);
} catch (e) {
  console.error(e.stdout || e.message);
}
