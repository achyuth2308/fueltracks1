// ============================================================
// CHANGE DEFAULT PASSWORDS — FuelTracks
// Run ONCE after deployment to replace the seed password123 hashes.
//
// Usage:
//   node scripts/change-default-passwords.js
//
// It will prompt you for a new password for each seeded user.
// If you want to set the same password for all, enter it once
// and hit Enter for the rest.
// ============================================================

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const readline = require('readline');

const pool = new Pool({
  host:     process.env.DB_HOST,
  port:     parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME,
  user:     process.env.DB_USER,
  password: process.env.DB_PASS,
  connectionTimeoutMillis: 5000,
});

const SEED_EMAILS = [
  'admin@fueltracks.in',
  'dealer@abclogistics.com',
  'dealer@xyztransport.com',
  'customer@abcfleet.com',
];

// The bcrypt hash of 'password123' — this is the "still default" detector
const DEFAULT_HASH = '$2a$10$985IToIvFVALAMSy4SL7ReDk4SJL3XLK.wROiYAgXUbSTtCLMTdM.';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function ask(question) {
  return new Promise(resolve => rl.question(question, resolve));
}

function hiddenAsk(question) {
  return new Promise(resolve => {
    process.stdout.write(question);
    let input = '';
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    const onData = (ch) => {
      if (ch === '\r' || ch === '\n') {
        process.stdout.write('\n');
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdin.removeListener('data', onData);
        resolve(input);
      } else if (ch === '\u0003') { // Ctrl+C
        process.exit();
      } else if (ch === '\u007f') { // Backspace
        if (input.length > 0) input = input.slice(0, -1);
      } else {
        input += ch;
        process.stdout.write('*');
      }
    };
    process.stdin.on('data', onData);
  });
}

async function main() {
  console.log('============================================================');
  console.log('  FuelTracks — Default Password Rotation');
  console.log('============================================================\n');

  let client;
  try {
    client = await pool.connect();
    console.log('[DB] Connected.\n');

    // Check which seeded accounts still have the default password
    const result = await client.query(
      'SELECT email, password FROM users WHERE email = ANY($1)',
      [SEED_EMAILS]
    );

    const toChange = [];
    for (const row of result.rows) {
      const isDefault = await bcrypt.compare('password123', row.password);
      if (isDefault) toChange.push(row.email);
    }

    if (toChange.length === 0) {
      console.log('✅ All seeded accounts already have non-default passwords. Nothing to do.\n');
      return;
    }

    console.log(`⚠️  The following accounts still have the default password "password123":`);
    toChange.forEach(e => console.log(`   • ${e}`));
    console.log();

    let sharedPassword = null;

    const useShared = (await ask('Use the same new password for all? [y/N]: ')).toLowerCase();
    if (useShared === 'y' || useShared === 'yes') {
      while (true) {
        sharedPassword = await hiddenAsk('New password (min 12 chars): ');
        if (sharedPassword.length < 12) {
          console.log('❌ Password too short. Use at least 12 characters.\n');
        } else {
          const confirm = await hiddenAsk('Confirm password: ');
          if (confirm !== sharedPassword) {
            console.log('❌ Passwords do not match. Try again.\n');
          } else {
            break;
          }
        }
      }
    }

    for (const email of toChange) {
      let password = sharedPassword;
      if (!password) {
        console.log(`\nSetting password for: ${email}`);
        while (true) {
          password = await hiddenAsk('  New password (min 12 chars): ');
          if (password.length < 12) {
            console.log('  ❌ Too short. Use at least 12 characters.\n');
          } else {
            const confirm = await hiddenAsk('  Confirm password: ');
            if (confirm !== password) {
              console.log('  ❌ Passwords do not match. Try again.\n');
            } else {
              break;
            }
          }
        }
      }

      const hash = await bcrypt.hash(password, 12);
      await client.query(
        'UPDATE users SET password = $1 WHERE email = $2',
        [hash, email]
      );
      console.log(`  ✅ Password updated for ${email}`);
    }

    console.log('\n============================================================');
    console.log('  All default passwords rotated successfully.');
    console.log('  Store these credentials securely (e.g. in a password manager).');
    console.log('============================================================\n');

  } catch (err) {
    console.error('\n[ERROR]', err.message);
    process.exitCode = 1;
  } finally {
    rl.close();
    if (client) client.release();
    await pool.end();
  }
}

main();
