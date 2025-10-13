const mysql = require('mysql2/promise');
(async ()=>{
  const DB_HOST = process.env.DB_HOST || '127.0.0.1';
  const DB_USER = process.env.DB_USER || 'ck_user';
  const DB_PASS = process.env.DB_PASS || 'StrongLocalPass123!';
  const DB_NAME = process.env.DB_NAME || 'users';
  const pool = mysql.createPool({ host: DB_HOST, user: DB_USER, password: DB_PASS, database: DB_NAME });
  try {
    const [u] = await pool.query("SELECT id, username FROM registered_users WHERE username = 'Nagy Márk a. Burschazam'");
    console.log('user rows:', u);
    const [r] = await pool.query("SELECT r.role_name FROM roles r JOIN user_roles ur ON ur.role_id=r.id JOIN registered_users u ON u.id=ur.user_id WHERE u.username='Nagy Márk a. Burschazam'");
    console.log('roles:', r);
  } catch (e) { console.error('err', e); process.exit(1); }
  process.exit(0);
})();