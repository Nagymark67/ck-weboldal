// scripts/hash_passwords.js
// Usage: node scripts/hash_passwords.js
// This script will hash all plaintext passwords in registered_users that don't look like bcrypt hashes.

const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

(async () => {
  const DB_HOST = process.env.DB_HOST || '127.0.0.1';
  const DB_USER = process.env.DB_USER || 'root';
  const DB_PASS = process.env.DB_PASS || '';
  const DB_NAME = process.env.DB_NAME || 'users';

  const pool = mysql.createPool({ host: DB_HOST, user: DB_USER, password: DB_PASS, database: DB_NAME });
  try {
    const [rows] = await pool.query('SELECT id, username, password FROM registered_users');
    console.log(`Found ${rows.length} users`);
    for (const r of rows) {
      const pw = r.password || '';
      // bcrypt hashes start with $2a$ or $2b$ or $2y$
      if (!pw.startsWith('$2a$') && !pw.startsWith('$2b$') && !pw.startsWith('$2y$')) {
        console.log(`Hashing password for user ${r.username} (id ${r.id})`);
        const hash = await bcrypt.hash(pw, 10);
        await pool.query('UPDATE registered_users SET password = ? WHERE id = ?', [hash, r.id]);
      } else {
        console.log(`Skipping ${r.username} (already hashed)`);
      }
    }
    console.log('Done');
  } catch (e) {
    console.error('Error', e && e.message ? e.message : e);
  } finally {
    await pool.end();
  }
})();
