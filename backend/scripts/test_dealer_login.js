const db = require('../config/db');
const bcrypt = require('bcryptjs');

async function testLogin() {
  const email = 'madhumathidonuru@gmail.com';
  const password = 'Madhu@123$$';

  const res = await db.query('SELECT * FROM users WHERE email = $1', [email]);
  const user = res.rows[0];

  if (!user) {
    console.error('User not found in DB!');
    process.exit(1);
  }

  const isMatch = await bcrypt.compare(password, user.password);
  console.log('Login credentials verified:');
  console.log('- Email:', user.email);
  console.log('- Role:', user.role);
  console.log('- Organization ID:', user.org_id);
  console.log('- Password Matches:', isMatch);

  process.exit(0);
}

testLogin();
