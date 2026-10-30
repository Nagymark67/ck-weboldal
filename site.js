(() => {
  const body = document.body;
  const menuToggle = document.querySelector('.menu-toggle');
  const accountToggle = document.querySelector('.account-toggle');
  const backdrop = document.querySelector('.drawer-backdrop');
  const closeButtons = document.querySelectorAll('.drawer-close, .drawer-backdrop');
  const setDrawer = (open) => body.classList.toggle('drawer-open', open);
  const setNav = (open) => body.classList.toggle('nav-open', open);
  menuToggle?.addEventListener('click', () => setNav(!body.classList.contains('nav-open')));
  accountToggle?.addEventListener('click', () => setDrawer(!body.classList.contains('drawer-open')));
  closeButtons.forEach((button) => button.addEventListener('click', () => { setDrawer(false); setNav(false); }));

  const authLinks = document.getElementById('authLinks');
  const loggedInLinks = document.getElementById('loggedInLinks');
  const drawerUser = document.getElementById('drawerUser');
  const drawerLogout = document.getElementById('drawerLogout');
  async function checkUser() {
    try {
      const response = await fetch('/me', { credentials: 'include' });
      if (!response.ok) return null;
      return await response.json();
    } catch (error) {
      console.warn('Could not check login state', error);
      return null;
    }
  }
  checkUser().then((user) => {
    if (!user || !authLinks || !loggedInLinks) return;
    authLinks.hidden = true;
    loggedInLinks.hidden = false;
    if (drawerUser) drawerUser.textContent = `Bejelentkezve: ${user.username}`;
    if (drawerLogout) drawerLogout.addEventListener('click', async () => {
      const response = await fetch('/logout', { method: 'POST', credentials: 'include' });
      if (response.ok) window.location.reload();
    });
  });

  const postsList = document.getElementById('posts-list');
  if (!postsList) return;
  const feedLoading = document.getElementById('feed-loading');
  const composer = document.getElementById('composer');
  const createButton = document.getElementById('floatingCreate');
  const canCreate = (user) => user && (user.isAllTimeAdmin || (user.roles || []).some((role) => ['cantus_praeses', 'jegyzo'].includes(role)));
  function renderPost(post) {
    const article = document.createElement('article');
    article.className = 'news-post';
    const date = post.created_at ? new Date(post.created_at).toLocaleString('hu-HU') : '';
    article.innerHTML = `<div class="news-meta"><strong>${post.author_username || 'Ismeretlen szerző'}</strong> · ${date}</div><div class="news-content">${post.content || ''}</div>`;
    (post.attachments || []).forEach((attachment) => {
      if (typeof attachment === 'string' && attachment.startsWith('/uploads/')) {
        const link = document.createElement('a'); link.className = 'button button-outline'; link.href = attachment; link.target = '_blank'; link.textContent = 'Csatolmány megnyitása'; article.appendChild(link);
      }
    });
    return article;
  }
  async function loadPosts() {
    try {
      const response = await fetch('/posts', { credentials: 'include' });
      const data = await response.json();
      postsList.replaceChildren();
      if (!data.posts?.length) {
        postsList.innerHTML = '<p class="news-meta">Még nincsenek nyilvános hírek.</p>';
      } else data.posts.forEach((post) => postsList.appendChild(renderPost(post)));
      if (feedLoading) feedLoading.hidden = true;
    } catch (error) {
      if (feedLoading) feedLoading.textContent = 'A hírek betöltése nem sikerült.';
    }
  }
  checkUser().then((user) => {
    if (canCreate(user) && createButton && composer) {
      createButton.style.display = 'block';
      createButton.addEventListener('click', () => composer.classList.add('open'));
    }
  });
  document.querySelectorAll('[data-close-composer]').forEach((button) => button.addEventListener('click', () => composer?.classList.remove('open')));
  document.getElementById('composerSubmit')?.addEventListener('click', async () => {
    const content = document.getElementById('composerEditor')?.value || '';
    const visibility = document.getElementById('composerVisibility')?.value || 'mindenki';
    if (!content.trim()) return;
    const formData = new FormData();
    formData.append('content', content);
    formData.append('visibility', visibility);
    const response = await fetch('/posts', { method: 'POST', credentials: 'include', body: formData });
    if (response.ok) { composer?.classList.remove('open'); loadPosts(); }
  });
  loadPosts();
})();
