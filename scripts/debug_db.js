const { Client } = require('pg');

(async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  try {
    await client.connect();
    for (const table of ['registered_users', 'roles', 'user_roles']) {
      const { rows } = await client.query(`SELECT * FROM ${table}`);
      console.log(`${table}:`, JSON.stringify(rows, null, 2));
    }
    const { rows } = await client.query(
      `SELECT r.role_name
       FROM roles r
       JOIN user_roles ur ON ur.role_id = r.id
       JOIN registered_users u ON u.id = ur.user_id
       WHERE u.username = $1`,
      ['Nagy Márk a. Burschazam']
    );
    console.log('roles for Nagy Márk a. Burschazam:', JSON.stringify(rows, null, 2));
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
})();
