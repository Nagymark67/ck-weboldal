const mysql = require('mysql2/promise');

(async () => {
  const DB_HOST = (process.env.DB_HOST !== undefined) ? process.env.DB_HOST : 'localhost';
  const DB_USER = (process.env.DB_USER !== undefined) ? process.env.DB_USER : 'root';
  const DB_PASS = (process.env.DB_PASS !== undefined) ? process.env.DB_PASS : '';
  const DB_NAME = (process.env.DB_NAME !== undefined) ? process.env.DB_NAME : 'users';

  console.log('Using DB config:', { DB_HOST, DB_USER, DB_PASS: DB_PASS ? '***' : '(empty)', DB_NAME });

  try {
    const conn = await mysql.createConnection({ host: DB_HOST, user: DB_USER, password: DB_PASS, database: DB_NAME });
    const [rows] = await conn.query('SELECT 1 AS ok');
    console.log('Connected OK, test query result:', rows);
    await conn.end();
    process.exit(0);
  } catch (err) {
    console.error('Connection error:', err);
    process.exit(1);
  }
})();
