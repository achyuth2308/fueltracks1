const bcrypt = require('bcryptjs');
const db = require('../backend/config/db');

async function fixPasswords() {
  try {
    // Generate a proper hash for 'password123'
    const hash = await bcrypt.hash('password123', 10);
    console.log('Generated hash:', hash);
    
    // Verify it matches
    const isMatch = await bcrypt.compare('password123', hash);
    console.log('Verification:', isMatch);
    
    // Update all users in the database
    const result = await db.query(
      'UPDATE users SET password = $1',
      [hash]
    );
    console.log(`Updated ${result.rowCount} user(s) in database`);
    
    // Double-check by reading back and comparing
    const users = await db.query('SELECT email, password FROM users');
    for (const user of users.rows) {
      const match = await bcrypt.compare('password123', user.password);
      console.log(`  ${user.email}: password123 match = ${match}`);
    }
    
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

fixPasswords();
