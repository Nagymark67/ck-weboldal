const express = require('express');
const session = require('express-session');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = 3000;

// Dummy users
const users = [
  { username: 'user1' },
  { username: 'user2' },
  { username: 'user3' }
];

let onlineUsers = [];

app.use(cors({
  origin: 'http://localhost:5500', // Change to your frontend port
  credentials: true
}));
app.use(bodyParser.json());
app.use(session({
  secret: 'secret-key',
  resave: false,
  saveUninitialized: true
}));

app.post('/login', (req, res) => {
  const { username } = req.body;
  const user = users.find(u => u.username === username);
  if (user) {
    req.session.user = username;
    if (!onlineUsers.includes(username)) onlineUsers.push(username);
    res.json({ success: true, username });
  } else {
    res.status(401).json({ success: false, message: 'Invalid username' });
  }
});

app.get('/online-users', (req, res) => {
  res.json({ users: onlineUsers });
});

app.post('/logout', (req, res) => {
  const username = req.session.user;
  onlineUsers = onlineUsers.filter(u => u !== username);
  req.session.destroy();
  res.json({ success: true });
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));