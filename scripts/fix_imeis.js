const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: 'postgresql://postgres:fuel@127.0.0.1:5432/fueltracks1'
  });

  try {
    await client.connect();
    console.log('Connected to database.');

    const res1 = await client.query("UPDATE vehicles SET imei = '865006049210220' WHERE imei = '865006069210220'");
    console.log('Updated Telangana_Truck:', res1.rowCount);

    const res2 = await client.query("UPDATE vehicles SET imei = '865006049210216' WHERE imei = '865006069210216'");
    console.log('Updated Andhra_Truck:', res2.rowCount);

    const res3 = await client.query("UPDATE vehicles SET imei = '865006049210217' WHERE imei = '865006069210217'");
    console.log('Updated TamilNadu_Truck:', res3.rowCount);

  } catch (err) {
    console.error('Error running updates:', err);
  } finally {
    await client.end();
  }
}

main();
