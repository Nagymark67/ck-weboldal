const express = require('express');
const session = require('express-session');
const cors = require('cors');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = process.env.PORT || 3000;
const { Pool } = require('pg');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');


const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const safe = file.originalname.replace(/[^a-zA-Z0-9.\-\_\s]/g, '');
    cb(null, unique + '-' + safe);
  }
});
const upload = multer({ storage: storage, limits: { fileSize: 10 * 1024 * 1024 } }); 
const galleryUpload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, /^image\/(jpeg|png|gif|webp)$/i.test(file.mimetype))
});












const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL is required. Set it to your PostgreSQL connection string.');
  process.exit(1);
}

const db = new Pool({
  connectionString: DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function postgresQuery(sql, values = []) {
  let index = 0;
  const text = sql.replace(/\?/g, () => `$${++index}`);
  const result = await db.query(text, values);
  return [
    result.rows,
    {
      insertId: result.rows[0] && result.rows[0].id,
      affectedRows: result.rowCount
    }
  ];
}

const query = postgresQuery;


const allowedFounders = [
  'Simon Gábor',
  'Barak Antal',
  'Bodnár Róbert',
  'Fodor Ferenc',
  'Czakó Gábor'
];


const defaultOrigins = ['http://localhost', 'http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:5500'];
const normalizeOrigin = (origin) => origin.trim().replace(/\/+$/, '');
const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map(normalizeOrigin).filter(Boolean)
  : defaultOrigins;

const allowAll = process.env.CORS_ALLOW_ALL === '1' || process.env.NODE_ENV !== 'production';

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true); 
    if (allowAll || allowedOrigins.includes(normalizeOrigin(origin))) return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));


app.use('/uploads', express.static(path.join(__dirname, 'uploads')));


app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});


app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});


app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'login.html'));
});

app.get('/register', (req, res) => {
  res.sendFile(path.join(__dirname, 'register.html'));
});

  
  app.use(express.json({
    verify: (req, res, buf, encoding) => {
      try { req.rawBody = buf && buf.toString(encoding || 'utf8'); } catch (e) { req.rawBody = undefined; }
    }
  }));
  app.use(express.urlencoded({ extended: true, verify: (req, res, buf, encoding) => { try { req.rawBody = buf && buf.toString(encoding || 'utf8'); } catch(e){}} }));


app.use((err, req, res, next) => {
  if (err && err.type === 'entity.parse.failed') {
    console.error('JSON body parse error:', err && err.stack ? err.stack : err);
    return res.status(400).json({ message: 'Bad JSON payload', error: String(err.message) });
  }
  next(err);
});


app.post('/register', async (req, res) => {
  const { username, password, status } = req.body;
  if (!username || !password || !status) return res.status(400).json({ message: 'Hiányzó adatok!' });

  try {
    
    
    if (status === 'Alapító') {
      if (!allowedFounders.includes(username)) {
        return res.status(403).json({ message: 'Csak az Alapítóként megadott személyek választhatják ezt a státuszt.' });
      }
    }

    
    
    const reservedStatuses = ['Cantus Praeses', 'Jegyző'];
    if (reservedStatuses.includes(status)) {
      const [taken] = await query('SELECT id FROM registered_users WHERE status = ? LIMIT 1', [status]);
      if (taken && taken.length > 0) {
        return res.status(403).json({ message: `${status} pozíciót már betöltik.` });
      }
    }
    
    const [rows] = await query('SELECT id FROM registered_users WHERE username = ?', [username]);
    if (rows.length > 0) {
      return res.status(409).json({ message: 'A felhasználónév már foglalt!' });
    }
    
    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(password, salt);
    await query('INSERT INTO registered_users (username, password, status) VALUES (?, ?, ?)', [username, hashed, status]);
    res.json({ success: true });
  } catch (err) {
    console.error('Error in /register:', err && err.stack ? err.stack : err);
    if (err && err.code === '23505') {
      return res.status(409).json({ message: 'A felhasználónév már foglalt!' });
    }
    res.status(500).json({
      message: 'Adatbázis hiba!',
      error: process.env.NODE_ENV === 'production' ? undefined : String(err && err.message ? err.message : err)
    });
  }
});

let onlineUsers = [];

const onlineUsersLastSeen = {};


app.use(bodyParser.json());
app.use(session({
  secret: 'nagyon-titkos',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, 
    sameSite: 'lax' 
  }
}));

const requireAllTimeAdminPage = async (req, res, next) => {
  const username = req.session && req.session.user;
  if (!username || !(await userHasRole(username, ['all-time admin']))) {
    return res.status(username ? 403 : 401).send('Nincs jogosultsága ennek az oldalnak az eléréséhez.');
  }
  next();
};

app.get(['/admin', '/admin.html'], requireAllTimeAdminPage, (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

app.use(express.static(path.join(__dirname)));

app.post('/login', async (req, res) => {
  
  try {
    console.log('/login incoming headers:', JSON.stringify(req.headers));
    
    console.log('/login incoming body keys:', Object.keys(req.body || {}));
    if (req.rawBody) console.log('/login rawBody preview:', req.rawBody.slice(0,200));
  } catch (e) {  }
  const { username, password } = req.body;
  try {
    
    const [rows] = await query(
      'SELECT * FROM registered_users WHERE username = ?',
      [username]
    );
    if (rows.length > 0) {
      
      const user = rows[0];
      const match = await bcrypt.compare(password, user.password);
      if (match) {
        if (user.password_reset_required) {
          delete req.session.user;
          req.session.passwordResetUser = username;
          return res.json({ success: true, requiresPasswordChange: true, username });
        }
        req.session.user = username;
        if (!onlineUsers.includes(username)) onlineUsers.push(username);
        onlineUsersLastSeen[username] = Date.now();
        res.json({ success: true });
      } else {
        res.status(401).json({ success: false, message: 'Hibás felhasználónév vagy jelszó!' });
      }
    } else {
      res.status(401).json({ success: false, message: 'Hibás felhasználónév vagy jelszó!' });
    }
  } catch (err) {
    console.error('Error in /login handler:', err && err.stack ? err.stack : err);
    res.status(500).json({ message: 'Adatbázis hiba!', error: String(err && err.message ? err.message : err) });
  }
});

app.post('/password-reset/complete', async (req, res) => {
  const username = req.session && req.session.passwordResetUser;
  const { password } = req.body || {};
  if (!username) return res.status(401).json({ message: 'A jelszócsere munkamenete lejárt.' });
  if (typeof password !== 'string' || password.length < 8) return res.status(400).json({ message: 'Az új jelszónak legalább 8 karakteresnek kell lennie.' });
  try {
    const hashed = await bcrypt.hash(password, 10);
    const [, result] = await query('UPDATE registered_users SET password = ?, password_reset_required = FALSE WHERE username = ?', [hashed, username]);
    if (!result || result.affectedRows === 0) return res.status(404).json({ message: 'A felhasználó nem található.' });
    req.session.user = username;
    delete req.session.passwordResetUser;
    res.json({ success: true });
  } catch (err) {
    console.error('Error in /password-reset/complete:', err && err.stack ? err.stack : err);
    res.status(500).json({ message: 'A jelszó mentése nem sikerült.' });
  }
});

app.get('/online-users', async (req, res) => {
  try {
    
    const now = Date.now();
    const timeout = 45 * 1000;
    const active = Object.entries(onlineUsersLastSeen).filter(([u, t]) => (now - t) <= timeout).map(([u]) => u);
    if (active.length === 0) return res.json({ users: [] });
    const placeholders = active.map(() => '?').join(',');
    const [rows] = await query(
      `SELECT username, status FROM registered_users WHERE username IN (${placeholders})`,
      active
    );
    res.json({ users: rows }); 
  } catch (err) {
    console.error(err);
    res.status(500).json({ users: [] });
  }
});


app.post('/online-ping', (req, res) => {
  try {
    const username = req.session && req.session.user;
    if (!username) return res.status(401).json({ message: 'Nincs bejelentkezve' });
    onlineUsersLastSeen[username] = Date.now();
    if (!onlineUsers.includes(username)) onlineUsers.push(username);
    res.json({ success: true });
  } catch (err) {
    console.error('Error in /online-ping', err);
    res.status(500).json({ message: 'Error' });
  }
});


app.post('/online-leave', (req, res) => {
  try {
    const username = req.session && req.session.user;
    if (!username) return res.status(401).json({ message: 'Nincs bejelentkezve' });
    onlineUsers = onlineUsers.filter(u => u !== username);
    try { delete onlineUsersLastSeen[username]; } catch (e) {}
    
    res.json({ success: true });
  } catch (err) {
    console.error('Error in /online-leave', err);
    res.status(500).json({ message: 'Error' });
  }
});

app.get('/me', (req, res) => {
    if (req.session && req.session.user) {
        
        (async () => {
            try {
        
        const [rows] = await query(
          `SELECT u.status AS user_status, r.role_name FROM registered_users u LEFT JOIN user_roles ur ON ur.user_id = u.id LEFT JOIN roles r ON r.id = ur.role_id WHERE u.username = ?`,
          [req.session.user]
        );
    
    const isAllTimeAdmin = rows.some(r => r.role_name === 'all-time admin');
    
    const explicitRoles = Array.from(new Set(rows.map(r => r.role_name).filter(x => x && x !== 'all-time admin')));
    
    const status = rows.length > 0 ? (rows[0].user_status || null) : null;
    const derivedRoles = [];
    if (status) {
      const s = String(status).trim();
      if (s === 'Cantus Praeses') derivedRoles.push('cantus_praeses');
      if (s === 'Jegyző') derivedRoles.push('jegyzo');
      if (s === 'Alapító') derivedRoles.push('alapito');
    }
    const roles = Array.from(new Set([...explicitRoles, ...derivedRoles]));
    res.json({ username: req.session.user, roles, isAllTimeAdmin });
            } catch (err) {
                console.error('Error fetching roles for /me', err);
        res.json({ username: req.session.user, roles: [], isAllTimeAdmin: false });
            }
        })();
    } else {
        res.status(401).json({ error: 'Not logged in' });
    }
});


async function userHasRole(username, requiredRoles = []) {
  if (!username) return false;
  if (!requiredRoles || requiredRoles.length === 0) return false;
  try {
    
    const [isAdminRows] = await query(
      `SELECT 1 FROM roles r JOIN user_roles ur ON ur.role_id = r.id JOIN registered_users u ON u.id = ur.user_id WHERE u.username = ? AND r.role_name = 'all-time admin' LIMIT 1`,
      [username]
    );
    if (isAdminRows.length > 0) return true;

    const [rows] = await query(
      `SELECT r.role_name FROM roles r JOIN user_roles ur ON ur.role_id = r.id JOIN registered_users u ON u.id = ur.user_id WHERE u.username = ? AND r.role_name IN (${requiredRoles.map(()=>'?').join(',')})`,
      [username, ...requiredRoles]
    );
    return rows.length > 0;
  } catch (err) {
    console.error('Error in userHasRole', err);
    return false;
  }
}


function sanitizeContent(input) {
  if (!input) return '';
  return input.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
              .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '')
              .replace(/<(iframe|object|embed|form)[^>]*>[\s\S]*?<\/\1>/gi, '')
              .replace(/on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
              .replace(/\s(href|src)\s*=\s*(['"])\s*javascript:[^'"]*\2/gi, '');
}


app.get('/posts', async (req, res) => {
  try {

    let visibilityClause = "visibility IN ('mindenki')";
    if (req.session && req.session.user) {
      visibilityClause = "visibility IN ('mindenki','tagok_es_tanitvanyok','csak_tagok')";
    }
    const [rows] = await query(`SELECT id, author_username, content, visibility, attachments, created_at FROM posts WHERE ${visibilityClause} ORDER BY created_at DESC LIMIT 50`);

    const parsed = rows.map(r => ({
      ...r,
      attachments: Array.isArray(r.attachments)
        ? r.attachments
        : (r.attachments ? (typeof r.attachments === 'string' ? JSON.parse(r.attachments) : r.attachments) : []),
      poll: r.poll || null
    }));
    res.json({ posts: parsed, currentUser: req.session && req.session.user ? req.session.user : null });
  } catch (err) {
    console.error('Error fetching posts', err);
    res.status(500).json({ posts: [] });
  }
});



app.post('/posts', upload.array('attachments', 5), async (req, res) => {
  const username = req.session && req.session.user;
  if (!username) return res.status(401).json({ message: 'Nincs bejelentkezve' });
  try {
    const allowed = await userHasRole(username, ['cantus_praeses', 'jegyzo']);
    if (!allowed) return res.status(403).json({ message: 'Nincs jogosultsága posztolni' });
    const content = req.body.content;
    const visibility = req.body.visibility || 'mindenki';
    let poll = null;
    if (req.body.poll) {
      try {
        const submittedPoll = typeof req.body.poll === 'string' ? JSON.parse(req.body.poll) : req.body.poll;
        const question = String(submittedPoll.question || '').trim().slice(0, 300);
        const options = Array.isArray(submittedPoll.options)
          ? submittedPoll.options.map(option => String(option).trim().slice(0, 120)).filter(Boolean).slice(0, 6)
          : [];
        if (question && options.length >= 2) {
          poll = { question, options: options.map(text => ({ text, votes: 0 })) };
        }
      } catch (pollError) {
        return res.status(400).json({ message: 'Érvénytelen szavazás' });
      }
    }
    if ((!content || content.trim().length === 0) && !poll && (!req.files || req.files.length === 0)) {
      return res.status(400).json({ message: 'Adj meg tartalmat, képet vagy szavazást' });
    }
    const safe = sanitizeContent(content);
    const filePaths = [];
    if (req.files && req.files.length > 0) {
      for (const f of req.files) {

        filePaths.push('/uploads/' + path.basename(f.path));
      }
    }
    await query('INSERT INTO posts (author_username, content, visibility, attachments, poll) VALUES (?, ?, ?, ?, ?)', [username, safe, visibility, JSON.stringify(filePaths), poll ? JSON.stringify(poll) : null]);
    res.json({ success: true });
  } catch (err) {
    console.error('Error creating post', err);
    res.status(500).json({ message: 'Hiba a poszt létrehozásakor' });
  }
});

app.post('/posts/:id/vote', async (req, res) => {
  const username = req.session && req.session.user;
  if (!username) return res.status(401).json({ message: 'Nincs bejelentkezve' });
  const postId = parseInt(req.params.id, 10);
  const optionIndex = Number.parseInt(req.body.optionIndex, 10);
  if (!postId || !Number.isInteger(optionIndex)) return res.status(400).json({ message: 'Érvénytelen szavazat' });
  try {
    const [rows] = await query('SELECT poll FROM posts WHERE id = ?', [postId]);
    if (rows.length === 0) return res.status(404).json({ message: 'A poszt nem található' });
    const poll = rows[0].poll;
    if (!poll || !Array.isArray(poll.options) || !poll.options[optionIndex]) {
      return res.status(400).json({ message: 'A poszt nem tartalmaz szavazást' });
    }
    poll.options[optionIndex].votes = Number(poll.options[optionIndex].votes || 0) + 1;
    await query('UPDATE posts SET poll = ? WHERE id = ?', [JSON.stringify(poll), postId]);
    res.json({ success: true, poll });
  } catch (err) {
    console.error('Error voting in poll', err);
    res.status(500).json({ message: 'Hiba a szavazás mentésekor' });
  }
});


app.delete('/posts/:id', async (req, res) => {
  const username = req.session && req.session.user;
  if (!username) return res.status(401).json({ message: 'Nincs bejelentkezve' });
  const postId = parseInt(req.params.id, 10);
  if (!postId) return res.status(400).json({ message: 'Érvénytelen azonosító' });
  try {
    const [rows] = await query('SELECT author_username FROM posts WHERE id = ?', [postId]);
    if (rows.length === 0) return res.status(404).json({ message: 'A poszt nem található' });
    const post = rows[0];
    const isAuthor = post.author_username === username;
    const hasRole = await userHasRole(username, ['cantus_praeses', 'jegyzo']);
    if (!isAuthor && !hasRole) return res.status(403).json({ message: 'Nincs jogosultsága törölni' });
    await query('DELETE FROM posts WHERE id = ?', [postId]);
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting post', err);
    res.status(500).json({ message: 'Hiba a poszt törlésekor' });
  }
});

app.get('/gallery', async (req, res) => {
  try {
    const [rows] = await query('SELECT id, image_url, alt_text, created_at FROM gallery_images ORDER BY created_at ASC');
    res.json({ images: rows });
  } catch (err) {
    console.error('Error fetching gallery images', err);
    res.status(500).json({ message: 'A galéria betöltése nem sikerült' });
  }
});

app.post('/gallery', galleryUpload.single('image'), async (req, res) => {
  const username = req.session && req.session.user;
  if (!username) {
    if (req.file) fs.unlink(req.file.path, () => {});
    return res.status(401).json({ message: 'Nincs bejelentkezve' });
  }
  try {
    const allowed = await userHasRole(username, ['cantus_praeses', 'jegyzo']);
    if (!allowed) {
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(403).json({ message: 'Nincs jogosultsága képet feltölteni' });
    }
    if (!req.file) return res.status(400).json({ message: 'Kép feltöltése kötelező' });
    const imageUrl = '/uploads/' + path.basename(req.file.path);
    const altText = String(req.body.altText || 'A Cantusok Köre közös fotója').trim().slice(0, 200);
    await query('INSERT INTO gallery_images (image_url, alt_text, uploaded_by) VALUES (?, ?, ?)', [imageUrl, altText, username]);
    res.json({ success: true, image: { image_url: imageUrl, alt_text: altText } });
  } catch (err) {
    if (req.file) fs.unlink(req.file.path, () => {});
    console.error('Error uploading gallery image', err);
    res.status(500).json({ message: 'A kép feltöltése nem sikerült' });
  }
});

app.post('/logout', (req, res) => {
  const username = req.session.user;
  onlineUsers = onlineUsers.filter(u => u !== username);
  try { delete onlineUsersLastSeen[username]; } catch(e){}
  req.session.destroy();
  res.json({ success: true });
});



app.post('/delete-account', async (req, res) => {
  const username = req.session && req.session.user;
  if (!username) return res.status(401).json({ message: 'Nincs bejelentkezve' });
  try {
    
    const [urows] = await query('SELECT id FROM registered_users WHERE username = ? LIMIT 1', [username]);
    if (urows.length === 0) {
      
      onlineUsers = onlineUsers.filter(u => u !== username);
      req.session.destroy();
      return res.json({ success: true, message: 'Felhasználó nem található, kiléptetve.' });
    }
    const userId = urows[0].id;

    
    await query('DELETE FROM user_roles WHERE user_id = ?', [userId]);

    
    await query('DELETE FROM registered_users WHERE id = ?', [userId]);

    
  onlineUsers = onlineUsers.filter(u => u !== username);
  try { delete onlineUsersLastSeen[username]; } catch(e){}
    req.session.destroy();

    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting account', err);
    res.status(500).json({ message: 'Hiba a fiók törlésekor' });
  }
});



async function ensureSchema() {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS registered_users (
        id BIGSERIAL PRIMARY KEY,
        username VARCHAR(100) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        password_reset_required BOOLEAN NOT NULL DEFAULT FALSE,
        status VARCHAR(255),
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await query('ALTER TABLE registered_users ADD COLUMN IF NOT EXISTS password_reset_required BOOLEAN NOT NULL DEFAULT FALSE');
    await query(`
      CREATE TABLE IF NOT EXISTS roles (
        id BIGSERIAL PRIMARY KEY,
        role_name VARCHAR(100) NOT NULL,
        CONSTRAINT ux_role_name UNIQUE (role_name)
      );
    `);
    await query(`
      CREATE TABLE IF NOT EXISTS user_roles (
        user_id BIGINT NOT NULL REFERENCES registered_users(id) ON DELETE CASCADE,
        role_id BIGINT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
        PRIMARY KEY (user_id, role_id)
      );
    `);
    await query(`
      CREATE TABLE IF NOT EXISTS posts (
        id BIGSERIAL PRIMARY KEY,
        author_username VARCHAR(100) NOT NULL,
        content TEXT NOT NULL,
        visibility VARCHAR(40) NOT NULL DEFAULT 'mindenki'
          CHECK (visibility IN ('mindenki', 'tagok_es_tanitvanyok', 'csak_tagok')),
        attachments JSONB,
        poll JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await query('ALTER TABLE posts ADD COLUMN IF NOT EXISTS poll JSONB');
    await query(`
      CREATE TABLE IF NOT EXISTS gallery_images (
        id BIGSERIAL PRIMARY KEY,
        image_url TEXT NOT NULL,
        alt_text VARCHAR(200) NOT NULL DEFAULT 'A Cantusok Köre közös fotója',
        uploaded_by VARCHAR(100) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await query('CREATE INDEX IF NOT EXISTS posts_author_username_idx ON posts (author_username)');
  } catch (err) {
    console.error('Error ensuring schema', err);
    throw err;
  }
}



async function ensureRolesAndAdminUser() {
  try {
    const rolesToEnsure = ['cantus_praeses', 'jegyzo', 'all-time admin'];
    for (const r of rolesToEnsure) {
      await query('INSERT INTO roles (role_name) VALUES (?) ON CONFLICT (role_name) DO NOTHING', [r]);
    }

    
    const adminUsername = 'Nagy Márk a. Burschazam';
    const adminPlainPassword = 'FErrari83493365.'; 

    
    const [urows] = await query('SELECT id FROM registered_users WHERE username = ?', [adminUsername]);
    let userId;
    if (urows.length === 0) {
      const salt = await bcrypt.genSalt(10);
      const hashed = await bcrypt.hash(adminPlainPassword, salt);
      const [inserted] = await query('INSERT INTO registered_users (username, password, status) VALUES (?, ?, ?) RETURNING id', [adminUsername, hashed, null]);
      userId = inserted[0].id;
      console.log('Created all-time admin user:', adminUsername);
    } else {
      userId = urows[0].id;
    }

    
    const [rrows] = await query('SELECT id FROM roles WHERE role_name = ?', ['all-time admin']);
    if (rrows.length > 0) {
      const roleId = rrows[0].id;
      await query('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?) ON CONFLICT (user_id, role_id) DO NOTHING', [userId, roleId]);
    }
  } catch (err) {
    console.error('Error ensuring roles/admin user', err);
    throw err;
  }
}

(async () => {
  try {
    await ensureSchema();
    await ensureRolesAndAdminUser();
    const server = app.listen(PORT, () => {
      console.log(`Szerver fut a ${PORT} porton`);
      try {
        const addr = server.address();
        console.log('Server address:', addr);
      } catch (e) {
        console.log('Could not read server.address()', e && e.message);
      }
    });
  } catch (err) {
    console.error('Failed to start server due to schema/role error', err);
    process.exit(1);
  }
})();



app.get('/debug/db-tables', async (req, res) => {
  try {
    const [rows] = await query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
    res.json({ tables: rows.map(r => r.table_name) });
  } catch (err) {
    console.error('Error in /debug/db-tables', err && err.stack ? err.stack : err);
    res.status(500).json({ message: 'DB error', error: String(err && err.message ? err.message : err) });
  }
});


app.get('/reserved-statuses', async (req, res) => {
  try {
    const reserved = ['Cantus Praeses', 'Jegyző'];
    
    const [rows] = await query(
      "SELECT DISTINCT TRIM(status) AS status FROM registered_users WHERE TRIM(status) IN (?, ?)",
      reserved
    );
    const taken = rows.map(r => r.status).filter(Boolean);
    res.json({ taken });
  } catch (err) {
    console.error('Error in /reserved-statuses', err);
    res.status(500).json({ taken: [], error: String(err && err.message ? err.message : err) });
  }
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err && err.stack ? err.stack : err);
});


app.use((err, req, res, next) => {
  console.error('Unhandled error middleware:', err && err.stack ? err.stack : err);
  if (res.headersSent) return next(err);
  res.status(500).json({ message: 'Internal server error', error: String(err && err.message ? err.message : err) });
});


app.get('/admin/users', async (req, res) => {
  try {
    const username = req.session && req.session.user;
    console.log('/admin/users called; session user:', username);
    if (!username) {
      console.log('/admin/users - no session user (not logged in)');
      return res.status(401).json({ message: 'Nincs bejelentkezve' });
    }
    const allowed = await userHasRole(username, ['all-time admin']);
    console.log('/admin/users - userHasRole(all-time admin) =>', allowed);
    if (!allowed) {
      console.log(`/admin/users - access denied for ${username}`);
      return res.status(403).json({ message: 'Nincs jogosultsága' });
    }

    const [rows] = await query(
      `SELECT u.id, u.username, u.status, STRING_AGG(r.role_name, ',') AS roles
       FROM registered_users u
       LEFT JOIN user_roles ur ON ur.user_id = u.id
       LEFT JOIN roles r ON r.id = ur.role_id
       GROUP BY u.id`);
    const users = rows.map(r => ({ id: r.id, username: r.username, status: r.status, roles: r.roles ? r.roles.split(',') : [] }));
    res.json({ users });
  } catch (err) {
    console.error('Error in /admin/users', err && err.stack ? err.stack : err);
    res.status(500).json({ message: 'DB error', error: String(err && err.message ? err.message : err) });
  }
});

app.post('/admin/users/:id/reset-password', async (req, res) => {
  try {
    const username = req.session && req.session.user;
    if (!username) return res.status(401).json({ message: 'Nincs bejelentkezve' });
    if (!(await userHasRole(username, ['all-time admin']))) return res.status(403).json({ message: 'Nincs jogosultsága' });
    const userId = parseInt(req.params.id, 10);
    if (!Number.isInteger(userId) || userId < 1) return res.status(400).json({ message: 'Érvénytelen id' });
    const temporaryPassword = crypto.randomBytes(9).toString('base64url');
    const hashed = await bcrypt.hash(temporaryPassword, 10);
    const [, result] = await query('UPDATE registered_users SET password = ?, password_reset_required = TRUE WHERE id = ?', [hashed, userId]);
    if (!result || result.affectedRows === 0) return res.status(404).json({ message: 'A felhasználó nem található.' });
    res.json({ success: true, temporaryPassword });
  } catch (err) {
    console.error('Error in POST /admin/users/:id/reset-password:', err && err.stack ? err.stack : err);
    res.status(500).json({ message: 'A jelszó visszaállítása nem sikerült.' });
  }
});


app.post('/admin/users/:id/status', async (req, res) => {
  try {
    const username = req.session && req.session.user;
    console.log('/admin/users/:id/status called by', username, 'for id', req.params.id, 'body', req.body);
    if (!username) {
      console.log('/admin/users/:id/status - not logged in');
      return res.status(401).json({ message: 'Nincs bejelentkezve' });
    }
    const allowed = await userHasRole(username, ['all-time admin']);
    console.log('/admin/users/:id/status - userHasRole(all-time admin) =>', allowed);
    if (!allowed) {
      console.log(`/admin/users/:id/status - access denied for ${username}`);
      return res.status(403).json({ message: 'Nincs jogosultsága' });
    }
    const userId = parseInt(req.params.id, 10);
    const { status } = req.body;
    if (!userId) return res.status(400).json({ message: 'Érvénytelen id' });
    await query('UPDATE registered_users SET status = ? WHERE id = ?', [status || null, userId]);
    res.json({ success: true });
  } catch (err) {
    console.error('Error in POST /admin/users/:id/status', err && err.stack ? err.stack : err);
    res.status(500).json({ message: 'DB error', error: String(err && err.message ? err.message : err) });
  }
});


app.post('/admin/users/:id/roles', async (req, res) => {
  try {
    const username = req.session && req.session.user;
    console.log('/admin/users/:id/roles called by', username, 'for id', req.params.id, 'body', req.body);
    if (!username) {
      console.log('/admin/users/:id/roles - not logged in');
      return res.status(401).json({ message: 'Nincs bejelentkezve' });
    }
    const allowed = await userHasRole(username, ['all-time admin']);
    console.log('/admin/users/:id/roles - userHasRole(all-time admin) =>', allowed);
    if (!allowed) {
      console.log(`/admin/users/:id/roles - access denied for ${username}`);
      return res.status(403).json({ message: 'Nincs jogosultsága' });
    }
    const userId = parseInt(req.params.id, 10);
    const { role, action } = req.body; 
    if (!userId || !role || !action) return res.status(400).json({ message: 'Hiányzó adatok' });

    
    const [rrows] = await query('SELECT id FROM roles WHERE role_name = ?', [role]);
    let roleId;
    if (rrows.length === 0) {
      const [ins] = await query('INSERT INTO roles (role_name) VALUES (?) RETURNING id', [role]);
      roleId = ins[0].id;
    } else roleId = rrows[0].id;

    if (action === 'add') {
      await query('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?) ON CONFLICT (user_id, role_id) DO NOTHING', [userId, roleId]);
    } else if (action === 'remove') {
      await query('DELETE FROM user_roles WHERE user_id = ? AND role_id = ?', [userId, roleId]);
    } else return res.status(400).json({ message: 'Érvénytelen művelet' });

    res.json({ success: true });
  } catch (err) {
    console.error('Error in POST /admin/users/:id/roles', err && err.stack ? err.stack : err);
    res.status(500).json({ message: 'DB error', error: String(err && err.message ? err.message : err) });
  }
});


app.get('/admin/debug', async (req, res) => {
  try {
    const sessionUser = req.session && req.session.user;
    console.log('/admin/debug called; session user:', sessionUser);
    const isAdmin = sessionUser ? await userHasRole(sessionUser, ['all-time admin']) : false;
    res.json({ sessionUser, isAllTimeAdmin: !!isAdmin });
  } catch (err) {
    console.error('Error in /admin/debug', err && err.stack ? err.stack : err);
    res.status(500).json({ error: String(err && err.message ? err.message : err) });
  }
});