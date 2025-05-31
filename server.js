const express = require('express');
const session = require('express-session');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = 3000;
const mysql = require('mysql2/promise');


/*
const users = [
  { username: 'cantus1', password: 'jelszo1' },
  { username: 'cantus2', password: 'jelszo2' },
  { username: 'cantus3', password: 'jelszo3' }
];
*/

const db = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: 'P@ssw0rd!!',
  database: 'users',
});

app.use(cors({
  origin: ['http://localhost', 'http://localhost:3000', 'http://localhost:5500'],
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Registration endpoint
app.post('/register', async (req, res) => {
  const { username, password, status } = req.body;
  if (!username || !password || !status) return res.status(400).json({ message: 'Hiányzó adatok!' });

  try {
    // Check if user exists
    const [rows] = await db.query('SELECT id FROM registered_users WHERE username = ?', [username]);
    if (rows.length > 0) {
      return res.status(409).json({ message: 'A felhasználónév már foglalt!' });
    }
    // Save user (hash password in production!)
    await db.query('INSERT INTO registered_users (username, password, status) VALUES (?, ?, ?)', [username, password, status]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Adatbázis hiba!' });
  }
});

let onlineUsers = [];


app.use(bodyParser.json());
app.use(session({
  secret: 'nagyon-titkos',
  resave: false,
  saveUninitialized: false
}));

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const [rows] = await db.query(
      'SELECT * FROM registered_users WHERE username = ? AND password = ?',
      [username, password]
    );
    if (rows.length > 0) {
      req.session.user = username;
      if (!onlineUsers.includes(username)) onlineUsers.push(username);
      res.json({ success: true });
    } else {
      res.status(401).json({ success: false, message: 'Hibás felhasználónév vagy jelszó!' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Adatbázis hiba!' });
  }
});

app.get('/online-users', async (req, res) => {
  if (!req.session.user) return res.status(401).json({ users: [] });
  try {
    // Get all online users' usernames and statuses
    if (onlineUsers.length === 0) return res.json({ users: [] });
    const placeholders = onlineUsers.map(() => '?').join(',');
    const [rows] = await db.query(
      `SELECT username, status FROM registered_users WHERE username IN (${placeholders})`,
      onlineUsers
    );
    res.json({ users: rows }); // rows: [{username, status}, ...]
  } catch (err) {
    console.error(err);
    res.status(500).json({ users: [] });
  }
});

app.get('/me', (req, res) => {
    if (req.session && req.session.user) {
        res.json({ username: req.session.user });
    } else {
        res.status(401).json({ error: 'Not logged in' });
    }
});

app.post('/logout', (req, res) => {
  const username = req.session.user;
  onlineUsers = onlineUsers.filter(u => u !== username);
  req.session.destroy();
  res.json({ success: true });
});

app.listen(PORT, () => console.log(`Szerver fut a ${PORT} porton`));