const db = require('./config/db');

async function test() {
  try {
    const res = await db.query("SELECT is_active FROM vehicles WHERE plate = 'AP05TD4576';");
    console.log(res.rows);
  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}
test();
