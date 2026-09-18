const db = require('../config/db');

async function migrateDealerWhiteLabel() {
  console.log('[Migration] Starting Dealer White-Labeling Schema Migration...');

  try {
    // 1. Add white-labeling columns to organization_profiles if they do not exist
    const columns = [
      { name: 'brand_name', type: 'VARCHAR(255)' },
      { name: 'brand_tagline', type: 'VARCHAR(255)' },
      { name: 'primary_color', type: 'VARCHAR(50) DEFAULT \'#FF6A00\'' },
      { name: 'secondary_color', type: 'VARCHAR(50) DEFAULT \'#2E4867\'' },
      { name: 'footer_text', type: 'TEXT' },
      { name: 'support_email', type: 'VARCHAR(255)' },
      { name: 'support_phone', type: 'VARCHAR(100)' },
      { name: 'pan_number', type: 'VARCHAR(50)' },
      { name: 'is_whitelabel_enabled', type: 'BOOLEAN DEFAULT TRUE' },
      { name: 'subdomain', type: 'VARCHAR(100)' },
      { name: 'company_name', type: 'VARCHAR(255)' },
      { name: 'designation', type: 'VARCHAR(100)' },
      { name: 'whatsapp_number', type: 'VARCHAR(100)' }
    ];

    for (const col of columns) {
      const checkQuery = `
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'organization_profiles' AND column_name = $1
      `;
      const res = await db.query(checkQuery, [col.name]);
      if (res.rows.length === 0) {
        console.log(`[Migration] Adding column '${col.name}' to organization_profiles...`);
        await db.query(`ALTER TABLE organization_profiles ADD COLUMN ${col.name} ${col.type}`);
      } else {
        console.log(`[Migration] Column '${col.name}' already exists.`);
      }
    }

    console.log('[Migration] Dealer White-Labeling migration completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('[Migration] Migration failed:', err);
    process.exit(1);
  }
}

migrateDealerWhiteLabel();
