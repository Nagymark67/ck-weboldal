const mysql = require('mysql2/promise');
(async () => {
  const cfg = {
    host: process.env.DB_HOST !== undefined ? process.env.DB_HOST : 'localhost',
    user: process.env.DB_USER !== undefined ? process.env.DB_USER : 'root',
    password: process.env.DB_PASS !== undefined ? process.env.DB_PASS : '',
    database: process.env.DB_NAME !== undefined ? process.env.DB_NAME : 'users'
  };
  console.log('DB cfg', cfg);
  try {
    const conn = await mysql.createConnection(cfg);
    console.log('registered_users:');
    const [u] = await conn.query('SELECT id, username, status FROM registered_users');
    console.log(JSON.stringify(u, null, 2));
    console.log('roles:');
    const [r] = await conn.query('SELECT id, role_name FROM roles');
    console.log(JSON.stringify(r, null, 2));
    console.log('user_roles:');
    const [ur] = await conn.query('SELECT * FROM user_roles');
    console.log(JSON.stringify(ur, null, 2));
    console.log('roles for Nagy Márk a. Burschazam:');
    const [rr] = await conn.query("SELECT r.role_name FROM roles r JOIN user_roles ur ON ur.role_id=r.id JOIN registered_users u ON u.id=ur.user_id WHERE u.username = ?", ['Nagy Márk a. Burschazam']);
    console.log(JSON.stringify(rr, null, 2));
    await conn.end();
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
