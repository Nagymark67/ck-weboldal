const express = require('express');
const session = require('express-session');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = 3000;

// Dummy registered users (replace with DB in production)
const users = [
  { username: 'cantus1', password: 'jelszo1' },
  { username: 'cantus2', password: 'jelszo2' },
  { username: 'cantus3', password: 'jelszo3' }
];

let onlineUsers = [];

app.use(cors({
  origin: ['http://localhost', 'http://localhost:3000', 'http://127.0.0.1'],
  credentials: true
}));
app.use(bodyParser.json());
app.use(session({
  secret: 'nagyon-titkos',
  resave: false,
  saveUninitialized: false
}));

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  const user = users.find(u => u.username === username && u.password === password);
  if (user) {
    req.session.user = username;
    if (!onlineUsers.includes(username)) onlineUsers.push(username);
    res.json({ success: true });
  } else {
    res.status(401).json({ success: false, message: 'Hibás felhasználónév vagy jelszó!' });
  }
});

app.get('/online-users', (req, res) => {
  if (!req.session.user) return res.status(401).json({ users: [] });
  res.json({ users: onlineUsers });
});

app.post('/logout', (req, res) => {
  const username = req.session.user;
  onlineUsers = onlineUsers.filter(u => u !== username);
  req.session.destroy();
  res.json({ success: true });
});

app.listen(PORT, () => console.log(`Szerver fut a ${PORT} porton`));