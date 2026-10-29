const { Client } = require('pg');
(async ()=>{
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const { rows: u } = await client.query("SELECT id, username FROM registered_users WHERE username = 'Nagy Márk a. Burschazam'");
    console.log('user rows:', u);
    const { rows: r } = await client.query("SELECT r.role_name FROM roles r JOIN user_roles ur ON ur.role_id=r.id JOIN registered_users u ON u.id=ur.user_id WHERE u.username='Nagy Márk a. Burschazam'");
    console.log('roles:', r);
  } catch (e) { console.error('err', e); process.exitCode = 1; }
  finally { await client.end(); }
})();