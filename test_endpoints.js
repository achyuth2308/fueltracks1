const db = require('./backend/config/db');
const AdminController = require('./backend/controllers/adminController');

async function test() {
  const req = {
    user: {
      userId: '1',
      role: 'dealer',
      orgId: 'a0000000-0000-0000-0000-000000000002',
      orgType: 'dealer'
    }
  };
  const res = {
    status: (code) => ({
      json: (data) => console.log('STATUS', code, JSON.stringify(data, null, 2))
    })
  };
  const next = (err) => console.error('NEXT ERROR:', err);

  console.log('\n--- getRenewalPlans ---');
  await AdminController.getRenewalPlans(req, res, next);

  console.log('\n--- getRenewalTransactions ---');
  await AdminController.getRenewalTransactions(req, res, next);

  console.log('\n--- getAllOrgs ---');
  await AdminController.getAllOrgs(req, res, next);
  
  process.exit(0);
}

test();
