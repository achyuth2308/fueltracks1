const Redis = require('ioredis');
const r = new Redis();
const cmd = process.argv[2] || 'SET RL:1';
const imei = process.argv[3] || '861329080867568';
const action = process.argv[4] || 'IMMOBILIZE';

r.publish('device_commands', JSON.stringify({
  imei,
  action,
  command: cmd
})).then(() => {
  console.log(`Published: imei=${imei}, action=${action}, override=${cmd}`);
  process.exit(0);
});
