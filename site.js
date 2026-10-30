(() => {
  const body = document.body;
  const songTarget = document.getElementById('next-daltanitas');
  const eventList = document.getElementById('eventList');
  const search = document.getElementById('eventSearch');
  const songName = 'Daltanítás';
  const songLocation = 'Liget Söröző';
  const nextSong = (from = new Date()) => {
    const date = new Date(from);
    date.setHours(19, 0, 0, 0);
    const daysUntilMonday = (8 - date.getDay()) % 7;
    date.setDate(date.getDate() + daysUntilMonday);
    if (date <= from) date.setDate(date.getDate() + 7);
    while (date.getMonth() === 11 && date.getDate() === 25) date.setDate(date.getDate() + 7);
    return date;
  };
  const googleCalendarUrl = (date, event = {}) => {
    const pad = (value) => String(value).padStart(2, '0');
    const start = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}T190000`;
    const end = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}T220000`;
    const title = event.title || songName;
    const location = event.location || songLocation;
    const details = event.details || 'Heti nótázás a Cantusok Körével.';
    const endDate = new Date(date.getTime() + 3 * 60 * 60 * 1000);
    const endTime = `${endDate.getFullYear()}${pad(endDate.getMonth() + 1)}${pad(endDate.getDate())}T${pad(endDate.getHours())}${pad(endDate.getMinutes())}00`;
    const customTime = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}T${pad(date.getHours())}${pad(date.getMinutes())}00`;
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${customTime}/${endTime}&ctz=Europe%2FBudapest&location=${encodeURIComponent(location)}&details=${encodeURIComponent(details)}`;
  };
  const formatDate = (date) => date.toLocaleString('hu-HU', { weekday: 'long', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  if (songTarget) {
    const date = nextSong();
    songTarget.textContent = `${formatDate(date)} – ${songLocation}`;
    const addNextSong = document.getElementById('addNextSong');
    if (addNextSong) addNextSong.href = googleCalendarUrl(date);
  }
  if (eventList) {
    const events = [{
      date: new Date(2026, 10, 14, 8, 30),
      title: 'Cantusok Köre Szüreti Mulatság',
      location: 'Liget Söröző',
      details: 'Immáron XIX. alkalommal kerül megrendezésre a Cantusok Köre Szüreti Mulatsága, melynek pontos időpontja november 14. napja lesz.\n\nA rendezvény hivatalos itala a szürethez híven, a bor lesz.\n\nBelépő: 6500 Ft, elsőéves BSC hallgatóknak 5000 Ft.\n\nProgramterv:\n09:00 Reggeli\n10:00–11:30 Tanítványok által játékos feladatok\n12:00 Ebéd vaddisznóhúsos pincepörkölttel a la Cantusok Köre\n13:00 (opcionális) Cantus verseny és söpröng\n13:00–17:30 Ismerkedés az ifjúsággal\n18:00 Nedvesest kezdete\n\nNovember 15.: Környes búcsú, utolsó nótázó.\n\nJelentkezés: forms.gle/bHwJE93sWEyFUCUL6',
      link: 'https://forms.gle/bHwJE93sWEyFUCUL6'
    }];
    try {
      const savedEvents = JSON.parse(localStorage.getItem('cantusok-events') || '[]');
      if (Array.isArray(savedEvents)) savedEvents.forEach((event) => events.push({ ...event, date: new Date(event.date) }));
    } catch (error) {
      console.warn('Could not load saved events', error);
    }
    let date = nextSong();
    for (let i = 0; i < 52; i += 1) {
      events.push({ date, title: songName, location: songLocation });
      date = new Date(date);
      date.setDate(date.getDate() + 7);
      if (date.getMonth() === 11 && date.getDate() === 25) date.setDate(date.getDate() + 7);
    }
    const renderEvents = () => {
      const query = (search?.value || '').trim().toLocaleLowerCase('hu-HU');
      eventList.replaceChildren();
      const visible = events.filter((event) => `${event.title} ${event.location} ${formatDate(event.date)}`.toLocaleLowerCase('hu-HU').includes(query));
      visible.forEach((event) => {
        const item = document.createElement('article');
        item.className = 'event-item';
        const content = document.createElement('div');
        const title = document.createElement('h3');
        title.textContent = event.title;
        const metadata = document.createElement('p');
        metadata.textContent = `${formatDate(event.date)} · ${event.location}`;
        content.append(title, metadata);
        if (event.details) {
          const details = document.createElement('p');
          details.className = 'event-details';
          details.textContent = event.details;
          content.appendChild(details);
        }
        item.appendChild(content);
        const actions = document.createElement('div');
        actions.className = 'event-actions';
        const add = document.createElement('a');
        add.className = 'button button-outline'; add.href = googleCalendarUrl(event.date, event); add.target = '_blank'; add.rel = 'noopener'; add.textContent = 'Google Naptár';
        actions.appendChild(add); item.appendChild(actions); eventList.appendChild(item);
        if (event.link) {
          const registration = document.createElement('a');
          registration.className = 'button'; registration.href = event.link; registration.target = '_blank'; registration.rel = 'noopener'; registration.textContent = 'Jelentkezési űrlap';
          actions.appendChild(registration);
        }
      });
      const noEvents = document.getElementById('noEvents');
      if (noEvents) noEvents.hidden = visible.length > 0;
    };
    search?.addEventListener('input', renderEvents);
    renderEvents();
    const eventButton = document.getElementById('addEventButton');
    const eventModal = document.getElementById('eventModal');
    const eventForm = document.getElementById('eventForm');
    const closeEventModal = () => { if (eventModal) eventModal.hidden = true; };
    eventButton?.addEventListener('click', () => { if (eventModal) eventModal.hidden = false; });
    document.getElementById('closeEventModal')?.addEventListener('click', closeEventModal);
    document.getElementById('cancelEvent')?.addEventListener('click', closeEventModal);
    eventForm?.addEventListener('submit', (event) => {
      event.preventDefault();
      const form = new FormData(eventForm);
      const created = {
        title: String(form.get('title') || '').trim(),
        location: String(form.get('location') || '').trim(),
        date: new Date(String(form.get('date'))).toISOString(),
        details: String(form.get('description') || '').trim()
      };
      if (!created.title || !created.location || Number.isNaN(new Date(created.date).getTime())) return;
      const savedEvents = JSON.parse(localStorage.getItem('cantusok-events') || '[]');
      savedEvents.push(created);
      localStorage.setItem('cantusok-events', JSON.stringify(savedEvents));
      events.push({ ...created, date: new Date(created.date) });
      eventForm.reset();
      closeEventModal();
      renderEvents();
    });
  }
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
    const eventButton = document.getElementById('addEventButton');
    const canManageEvents = user && (user.isAllTimeAdmin || (user.roles || []).some((role) => ['cantus_praeses', 'jegyzo'].includes(role)));
    if (eventButton && canManageEvents) eventButton.hidden = false;
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
