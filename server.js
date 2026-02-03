const express = require('express');
const session = require('express-session');
const cors = require('cors');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = process.env.PORT || 3000;
const mysql = require('mysql2/promise');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

// Ensure uploads dir exists
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
const upload = multer({ storage: storage, limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB limit per file


/*
const users = [
  { username: 'cantus1', password: 'jelszo1' },
  { username: 'cantus2', password: 'jelszo2' },
  { username: 'cantus3', password: 'jelszo3' }
];
*/

// DB config from environment variables with sensible defaults for local XAMPP setups
// Respect empty strings (''), but fall back to defaults only when variables are undefined
const DB_HOST = (process.env.DB_HOST !== undefined) ? process.env.DB_HOST : 'localhost';
const DB_USER = (process.env.DB_USER !== undefined) ? process.env.DB_USER : 'root';
const DB_PASS = (process.env.DB_PASS !== undefined) ? process.env.DB_PASS : '';
const DB_NAME = (process.env.DB_NAME !== undefined) ? process.env.DB_NAME : 'users';

const db = mysql.createPool({
  host: DB_HOST,
  user: DB_USER,
  password: DB_PASS,
  database: DB_NAME,
});

// Names allowed to register with 'Alapító' status (exact match)
const allowedFounders = [
  'Simon Gábor',
  'Barak Antal',
  'Bodnár Róbert',
  'Fodor Ferenc',
  'Czakó Gábor'
];

// CORS configuration: can be overridden with CORS_ORIGINS (comma-separated) or allow all with CORS_ALLOW_ALL=1
const defaultOrigins = ['http://localhost', 'http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:5500'];
const allowedOrigins = process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : defaultOrigins;
// Allow all origins when developing locally (NODE_ENV != 'production') or when explicitly set.
const allowAll = process.env.CORS_ALLOW_ALL === '1' || process.env.NODE_ENV !== 'production';

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true); // allow non-browser or same-origin requests
    if (allowAll || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));

// Serve static files (index.html, css, images) from project root
app.use(express.static(path.join(__dirname)));
// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Simple request logger for debugging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Explicit root route to serve index.html (fallback if static middleware doesn't match)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Serve login and register pages at clean routes
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'login.html'));
});

app.get('/register', (req, res) => {
  res.sendFile(path.join(__dirname, 'register.html'));
});

  // Capture raw request body for debugging (do not keep in production logs)
  app.use(express.json({
    verify: (req, res, buf, encoding) => {
      try { req.rawBody = buf && buf.toString(encoding || 'utf8'); } catch (e) { req.rawBody = undefined; }
    }
  }));
  app.use(express.urlencoded({ extended: true, verify: (req, res, buf, encoding) => { try { req.rawBody = buf && buf.toString(encoding || 'utf8'); } catch(e){}} }));

// Handle JSON parse errors from express.json() — return JSON instead of Express's default HTML error page
app.use((err, req, res, next) => {
  if (err && err.type === 'entity.parse.failed') {
    console.error('JSON body parse error:', err && err.stack ? err.stack : err);
    return res.status(400).json({ message: 'Bad JSON payload', error: String(err.message) });
  }
  next(err);
});

// Registration endpoint
app.post('/register', async (req, res) => {
  const { username, password, status } = req.body;
  if (!username || !password || !status) return res.status(400).json({ message: 'Hiányzó adatok!' });

  try {
    // Validate special statuses
    // 1) 'Alapító' may only be chosen by a specific list of usernames
    if (status === 'Alapító') {
      if (!allowedFounders.includes(username)) {
        return res.status(403).json({ message: 'Csak az Alapítóként megadott személyek választhatják ezt a státuszt.' });
      }
    }

    // 2) Prevent more than one person from registering as the official officers
    // Only allow a single 'Cantus Praeses' and a single 'Jegyző' in registered_users.status
    const reservedStatuses = ['Cantus Praeses', 'Jegyző'];
    if (reservedStatuses.includes(status)) {
      const [taken] = await db.query('SELECT id FROM registered_users WHERE status = ? LIMIT 1', [status]);
      if (taken && taken.length > 0) {
        return res.status(403).json({ message: `${status} pozíciót már betöltik.` });
      }
    }
    // Check if user exists
    const [rows] = await db.query('SELECT id FROM registered_users WHERE username = ?', [username]);
    if (rows.length > 0) {
      return res.status(409).json({ message: 'A felhasználónév már foglalt!' });
    }
    // Hash the password before saving
    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(password, salt);
    await db.query('INSERT INTO registered_users (username, password, status) VALUES (?, ?, ?)', [username, hashed, status]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Adatbázis hiba!' });
  }
});

let onlineUsers = [];
// In-memory last-seen timestamps for presence tracking: { username: epoch_ms }
const onlineUsersLastSeen = {};


app.use(bodyParser.json());
app.use(session({
  secret: 'nagyon-titkos',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: 'lax' // Allow credentials in cross-origin requests from ngrok
  }
}));

app.post('/login', async (req, res) => {
  // Debug: log incoming headers/body briefly to capture malformed requests that could cause HTML errors
  try {
    console.log('/login incoming headers:', JSON.stringify(req.headers));
    // limit body logging to avoid leaking secrets in logs in production
    console.log('/login incoming body keys:', Object.keys(req.body || {}));
    if (req.rawBody) console.log('/login rawBody preview:', req.rawBody.slice(0,200));
  } catch (e) { /* ignore logging errors */ }
  const { username, password } = req.body;
  try {
    // Select by username only; password comparison is done with bcrypt.compare
    const [rows] = await db.query(
      'SELECT * FROM registered_users WHERE username = ?',
      [username]
    );
    if (rows.length > 0) {
      // Password stored as hash; compare
      const user = rows[0];
      const match = await bcrypt.compare(password, user.password);
      if (match) {
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

app.get('/online-users', async (req, res) => {
  try {
    // Use last-seen timestamps to determine online users (timeout 45s)
    const now = Date.now();
    const timeout = 45 * 1000;
    const active = Object.entries(onlineUsersLastSeen).filter(([u, t]) => (now - t) <= timeout).map(([u]) => u);
    if (active.length === 0) return res.json({ users: [] });
    const placeholders = active.map(() => '?').join(',');
    const [rows] = await db.query(
      `SELECT username, status FROM registered_users WHERE username IN (${placeholders})`,
      active
    );
    res.json({ users: rows }); // rows: [{username, status}, ...]
  } catch (err) {
    console.error(err);
    res.status(500).json({ users: [] });
  }
});

// Presence ping endpoint — clients should POST regularly to keep presence alive
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

// Allow clients to mark themselves as gone (remove from presence) without destroying session
app.post('/online-leave', (req, res) => {
  try {
    const username = req.session && req.session.user;
    if (!username) return res.status(401).json({ message: 'Nincs bejelentkezve' });
    onlineUsers = onlineUsers.filter(u => u !== username);
    try { delete onlineUsersLastSeen[username]; } catch (e) {}
    // Do not destroy the session here; just update presence state
    res.json({ success: true });
  } catch (err) {
    console.error('Error in /online-leave', err);
    res.status(500).json({ message: 'Error' });
  }
});

app.get('/me', (req, res) => {
    if (req.session && req.session.user) {
        // Fetch roles for the user to assist in client-side UI decisions
        (async () => {
            try {
        // Get user's roles and status in one shot
        const [rows] = await db.query(
          `SELECT u.status AS user_status, r.role_name FROM registered_users u LEFT JOIN user_roles ur ON ur.user_id = u.id LEFT JOIN roles r ON r.id = ur.role_id WHERE u.username = ?`,
          [req.session.user]
        );
    // rows may contain multiple rows (one per role) or a single row with role_name null
    const isAllTimeAdmin = rows.some(r => r.role_name === 'all-time admin');
    // collect explicit roles (exclude all-time admin from client view)
    const explicitRoles = Array.from(new Set(rows.map(r => r.role_name).filter(x => x && x !== 'all-time admin')));
    // derive roles from user_status to keep backward compatibility with earlier registrations where status implied role
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

// Helper: check if a username has any of the required roles
async function userHasRole(username, requiredRoles = []) {
  if (!username) return false;
  if (!requiredRoles || requiredRoles.length === 0) return false;
  try {
    // First check if user is all-time admin; if so, grant access
    const [isAdminRows] = await db.query(
      `SELECT 1 FROM roles r JOIN user_roles ur ON ur.role_id = r.id JOIN registered_users u ON u.id = ur.user_id WHERE u.username = ? AND r.role_name = 'all-time admin' LIMIT 1`,
      [username]
    );
    if (isAdminRows.length > 0) return true;

    const [rows] = await db.query(
      `SELECT r.role_name FROM roles r JOIN user_roles ur ON ur.role_id = r.id JOIN registered_users u ON u.id = ur.user_id WHERE u.username = ? AND r.role_name IN (${requiredRoles.map(()=>'?').join(',')})`,
      [username, ...requiredRoles]
    );
    return rows.length > 0;
  } catch (err) {
    console.error('Error in userHasRole', err);
    return false;
  }
}

// Simple sanitizer: strip script tags to avoid obvious XSS (keep it minimal)
function sanitizeContent(input) {
  if (!input) return '';
  return input.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
              .replace(/on\w+\s*=\s*"[^"]*"/gi, '');
}

// List recent posts (latest first)
app.get('/posts', async (req, res) => {
  try {
    // Visibility filtering: if not logged in, only show 'mindenki'; if logged in, show all (can be refined later)
    let visibilityClause = "visibility IN ('mindenki')";
    if (req.session && req.session.user) {
      visibilityClause = "visibility IN ('mindenki','tagok_es_tanitvanyok','csak_tagok')";
    }
    const [rows] = await db.query(`SELECT id, author_username, content, visibility, attachments, created_at FROM posts WHERE ${visibilityClause} ORDER BY created_at DESC LIMIT 50`);
    // attachments stored as JSON string; parse before returning
    const parsed = rows.map(r => ({ ...r, attachments: r.attachments ? JSON.parse(r.attachments) : [] }));
    res.json({ posts: parsed });
  } catch (err) {
    console.error('Error fetching posts', err);
    res.status(500).json({ posts: [] });
  }
});

// Create a new post — only users with roles cantus_praeses or jegyzo can post
// Accept multipart/form-data with optional files (attachments) and visibility field
app.post('/posts', upload.array('attachments', 5), async (req, res) => {
  const username = req.session && req.session.user;
  if (!username) return res.status(401).json({ message: 'Nincs bejelentkezve' });
  try {
    const allowed = await userHasRole(username, ['cantus_praeses', 'jegyzo']);
    if (!allowed) return res.status(403).json({ message: 'Nincs jogosultsága posztolni' });
    const content = req.body.content;
    const visibility = req.body.visibility || 'mindenki';
    if (!content || content.trim().length === 0) return res.status(400).json({ message: 'Üres tartalom' });
    const safe = sanitizeContent(content);
    const filePaths = [];
    if (req.files && req.files.length > 0) {
      for (const f of req.files) {
        // store relative URL path for client
        filePaths.push('/uploads/' + path.basename(f.path));
      }
    }
    await db.query('INSERT INTO posts (author_username, content, visibility, attachments) VALUES (?, ?, ?, ?)', [username, safe, visibility, JSON.stringify(filePaths)]);
    res.json({ success: true });
  } catch (err) {
    console.error('Error creating post', err);
    res.status(500).json({ message: 'Hiba a poszt létrehozásakor' });
  }
});

// Delete a post (only allowed for authors or users with roles)
app.delete('/posts/:id', async (req, res) => {
  const username = req.session && req.session.user;
  if (!username) return res.status(401).json({ message: 'Nincs bejelentkezve' });
  const postId = parseInt(req.params.id, 10);
  if (!postId) return res.status(400).json({ message: 'Érvénytelen azonosító' });
  try {
    const [rows] = await db.query('SELECT author_username FROM posts WHERE id = ?', [postId]);
    if (rows.length === 0) return res.status(404).json({ message: 'A poszt nem található' });
    const post = rows[0];
    const isAuthor = post.author_username === username;
    const hasRole = await userHasRole(username, ['cantus_praeses', 'jegyzo']);
    if (!isAuthor && !hasRole) return res.status(403).json({ message: 'Nincs jogosultsága törölni' });
    await db.query('DELETE FROM posts WHERE id = ?', [postId]);
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting post', err);
    res.status(500).json({ message: 'Hiba a poszt törlésekor' });
  }
});

app.post('/logout', (req, res) => {
  const username = req.session.user;
  onlineUsers = onlineUsers.filter(u => u !== username);
  try { delete onlineUsersLastSeen[username]; } catch(e){}
  req.session.destroy();
  res.json({ success: true });
});

// Delete the currently logged-in user's account.
// This removes the user_roles entries and the registered_users row so the status becomes available.
app.post('/delete-account', async (req, res) => {
  const username = req.session && req.session.user;
  if (!username) return res.status(401).json({ message: 'Nincs bejelentkezve' });
  try {
    // Find user id
    const [urows] = await db.query('SELECT id FROM registered_users WHERE username = ? LIMIT 1', [username]);
    if (urows.length === 0) {
      // If user not found, just destroy session and respond success
      onlineUsers = onlineUsers.filter(u => u !== username);
      req.session.destroy();
      return res.json({ success: true, message: 'Felhasználó nem található, kiléptetve.' });
    }
    const userId = urows[0].id;

    // Remove role assignments for this user
    await db.query('DELETE FROM user_roles WHERE user_id = ?', [userId]);

    // Remove the user record (this frees the status value for future registrations)
    await db.query('DELETE FROM registered_users WHERE id = ?', [userId]);

    // Remove from online list and destroy session
  onlineUsers = onlineUsers.filter(u => u !== username);
  try { delete onlineUsersLastSeen[username]; } catch(e){}
    req.session.destroy();

    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting account', err);
    res.status(500).json({ message: 'Hiba a fiók törlésekor' });
  }
});

// Start server and log the actual address info for debugging (IPv4 vs IPv6)
// Ensure minimal schema (roles, user_roles, posts) exists before starting
async function ensureSchema() {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS roles (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        role_name VARCHAR(100) NOT NULL,
        PRIMARY KEY (id),
        UNIQUE KEY ux_role_name (role_name)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    await db.query(`
      CREATE TABLE IF NOT EXISTS user_roles (
        user_id INT UNSIGNED NOT NULL,
        role_id INT UNSIGNED NOT NULL,
        PRIMARY KEY (user_id, role_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    await db.query(`
      CREATE TABLE IF NOT EXISTS posts (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        author_username VARCHAR(100) NOT NULL,
        content TEXT NOT NULL,
        visibility ENUM('mindenki', 'tagok_es_tanitvanyok', 'csak_tagok') NOT NULL DEFAULT 'mindenki',
        attachments JSON NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        INDEX (author_username)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
      // Ensure columns exist for older installations: add visibility/attachments if missing
      const [colsVis] = await db.query("SHOW COLUMNS FROM posts LIKE 'visibility'");
      if (!colsVis || colsVis.length === 0) {
        try { await db.query("ALTER TABLE posts ADD COLUMN visibility ENUM('mindenki','tagok_es_tanitvanyok','csak_tagok') NOT NULL DEFAULT 'mindenki'"); } catch(e) { /* ignore */ }
      }
      const [colsAtt] = await db.query("SHOW COLUMNS FROM posts LIKE 'attachments'");
      if (!colsAtt || colsAtt.length === 0) {
        try { await db.query("ALTER TABLE posts ADD COLUMN attachments JSON NULL"); } catch(e) { /* ignore */ }
      }
  } catch (err) {
    console.error('Error ensuring schema', err);
    throw err;
  }
}

// Start server after ensuring DB schema
// Create default roles and a hidden all-time admin user if missing
async function ensureRolesAndAdminUser() {
  try {
    const rolesToEnsure = ['cantus_praeses', 'jegyzo', 'all-time admin'];
    for (const r of rolesToEnsure) {
      await db.query('INSERT IGNORE INTO roles (role_name) VALUES (?)', [r]);
    }

    // Ensure the special all-time admin user exists and has the hidden role
    const adminUsername = 'Nagy Márk a. Burschazam';
    const adminPlainPassword = 'FErrari83493365.'; // provided by user — will be hashed

    // Check if user exists
    const [urows] = await db.query('SELECT id FROM registered_users WHERE username = ?', [adminUsername]);
    let userId;
    if (urows.length === 0) {
      const salt = await bcrypt.genSalt(10);
      const hashed = await bcrypt.hash(adminPlainPassword, salt);
      const [res] = await db.query('INSERT INTO registered_users (username, password, status) VALUES (?, ?, ?)', [adminUsername, hashed, null]);
      userId = res.insertId;
      console.log('Created all-time admin user:', adminUsername);
    } else {
      userId = urows[0].id;
    }

    // Assign the all-time admin role
    const [rrows] = await db.query('SELECT id FROM roles WHERE role_name = ?', ['all-time admin']);
    if (rrows.length > 0) {
      const roleId = rrows[0].id;
      await db.query('INSERT IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)', [userId, roleId]);
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

// Temporary debug endpoint: list tables in the configured database
// Remove this in production; it's intended to help local debugging.
app.get('/debug/db-tables', async (req, res) => {
  try {
    const [rows] = await db.query("SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ?", [DB_NAME]);
    res.json({ tables: rows.map(r => r.TABLE_NAME) });
  } catch (err) {
    console.error('Error in /debug/db-tables', err && err.stack ? err.stack : err);
    res.status(500).json({ message: 'DB error', error: String(err && err.message ? err.message : err) });
  }
});

// Return which reserved officer statuses are currently taken so the client can disable them in the UI
app.get('/reserved-statuses', async (req, res) => {
  try {
    const reserved = ['Cantus Praeses', 'Jegyző'];
    // Trim stored status values before comparing to be robust against whitespace differences
    const [rows] = await db.query(
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

// Express error handler — catch any thrown errors that weren't handled and return JSON
app.use((err, req, res, next) => {
  console.error('Unhandled error middleware:', err && err.stack ? err.stack : err);
  if (res.headersSent) return next(err);
  res.status(500).json({ message: 'Internal server error', error: String(err && err.message ? err.message : err) });
});

// Admin API: list users (id, username, status, roles)
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

    const [rows] = await db.query(
      `SELECT u.id, u.username, u.status, GROUP_CONCAT(r.role_name) AS roles
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

// Admin: update a user's status
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
    await db.query('UPDATE registered_users SET status = ? WHERE id = ?', [status || null, userId]);
    res.json({ success: true });
  } catch (err) {
    console.error('Error in POST /admin/users/:id/status', err && err.stack ? err.stack : err);
    res.status(500).json({ message: 'DB error', error: String(err && err.message ? err.message : err) });
  }
});

// Admin: add/remove a role for a user
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
    const { role, action } = req.body; // action: 'add' or 'remove'
    if (!userId || !role || !action) return res.status(400).json({ message: 'Hiányzó adatok' });

    // Ensure role exists
    const [rrows] = await db.query('SELECT id FROM roles WHERE role_name = ?', [role]);
    let roleId;
    if (rrows.length === 0) {
      const [ins] = await db.query('INSERT INTO roles (role_name) VALUES (?)', [role]);
      roleId = ins.insertId;
    } else roleId = rrows[0].id;

    if (action === 'add') {
      await db.query('INSERT IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)', [userId, roleId]);
    } else if (action === 'remove') {
      await db.query('DELETE FROM user_roles WHERE user_id = ? AND role_id = ?', [userId, roleId]);
    } else return res.status(400).json({ message: 'Érvénytelen művelet' });

    res.json({ success: true });
  } catch (err) {
    console.error('Error in POST /admin/users/:id/roles', err && err.stack ? err.stack : err);
    res.status(500).json({ message: 'DB error', error: String(err && err.message ? err.message : err) });
  }
});

// Temporary debug endpoint to inspect session and admin-check quickly
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