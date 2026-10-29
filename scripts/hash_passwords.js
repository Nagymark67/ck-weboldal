// scripts/hash_passwords.js
// Usage: node scripts/hash_passwords.js
// This script will hash all plaintext passwords in registered_users that don't look like bcrypt hashes.

const { Client } = require('pg');
const bcrypt = require('bcryptjs');

(async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const { rows } = await client.query('SELECT id, username, password FROM registered_users');
    console.log(`Found ${rows.length} users`);
    for (const r of rows) {
      const pw = r.password || '';
      // bcrypt hashes start with $2a$ or $2b$ or $2y$
      if (!pw.startsWith('$2a$') && !pw.startsWith('$2b$') && !pw.startsWith('$2y$')) {
        console.log(`Hashing password for user ${r.username} (id ${r.id})`);
        const hash = await bcrypt.hash(pw, 10);
        await client.query('UPDATE registered_users SET password = $1 WHERE id = $2', [hash, r.id]);
      } else {
        console.log(`Skipping ${r.username} (already hashed)`);
      }
    }
    console.log('Done');
  } catch (e) {
    console.error('Error', e && e.message ? e.message : e);
  } finally {
    await client.end();
  }
})();
