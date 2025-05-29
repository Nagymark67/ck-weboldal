const socket = io();
const loginForm = document.getElementById('loginForm');
const onlineUsersList = document.getElementById('online-users');

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value;
    await fetch('/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username })
    });
    socket.emit('login', username);
    loginForm.style.display = 'none';
});

socket.on('online-users', (users) => {
    onlineUsersList.innerHTML = '';
    users.forEach(user => {
        const li = document.createElement('li');
        li.textContent = user;
        onlineUsersList.appendChild(li);
    });
});