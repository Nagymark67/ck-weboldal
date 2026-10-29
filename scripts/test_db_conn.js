const { Client } = require('pg');

(async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  try {
    await client.connect();
    const { rows } = await client.query('SELECT 1 AS ok');
    console.log('Connected OK, test query result:', rows);
  } catch (error) {
    console.error('Connection error:', error);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
})();
