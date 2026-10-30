(() => {
  const body = document.body;
  const header = document.querySelector('.site-header');
  const savedTheme = localStorage.getItem('cantusok-theme');
  if (savedTheme === 'dark') document.documentElement.dataset.theme = 'dark';
  const nav = document.querySelector('.site-nav');
  if (header) {
    const themeButton = document.createElement('button');
    themeButton.className = 'theme-toggle floating-theme-toggle';
    themeButton.type = 'button';
    const updateThemeLabel = () => { themeButton.textContent = document.documentElement.dataset.theme === 'dark' ? 'Világos' : 'Sötét'; };
    updateThemeLabel();
    themeButton.addEventListener('click', () => {
      const dark = document.documentElement.dataset.theme !== 'dark';
      document.documentElement.dataset.theme = dark ? 'dark' : 'light';
      localStorage.setItem('cantusok-theme', dark ? 'dark' : 'light');
      updateThemeLabel();
    });
    const bugButton = document.createElement('button');
    bugButton.className = 'bug-report-toggle floating-bug-toggle';
    bugButton.type = 'button';
    bugButton.textContent = 'Hibajelentés';
    document.body.append(themeButton, bugButton);
    bugButton.addEventListener('click', () => { const modal = document.getElementById('bugReportModal'); if (modal) modal.hidden = false; });
  }
  if (header) {
    const updateHeader = () => header.classList.toggle('scrolled', window.scrollY > 24);
    window.addEventListener('scroll', updateHeader, { passive: true });
    updateHeader();
  }
  const bugModal = document.createElement('div');
  bugModal.id = 'bugReportModal';
  bugModal.className = 'bug-report-modal';
  bugModal.hidden = true;
  bugModal.innerHTML = '<div class="bug-report-card" role="dialog" aria-modal="true" aria-labelledby="bugReportTitle"><button class="modal-close" type="button" aria-label="Bezárás">×</button><p class="eyebrow">Segíts javítani az oldalt</p><h2 id="bugReportTitle">Hibajelentés</h2><form><label for="bugSubject">Tárgy</label><input id="bugSubject" required maxlength="120"><label for="bugDescription">Mi történt?</label><textarea id="bugDescription" rows="7" required maxlength="4000"></textarea><div class="modal-actions"><button class="button button-outline" type="button" data-close-bug>Mégse</button><button class="button" type="submit">E-mail megnyitása</button></div></form></div>';
  document.body.appendChild(bugModal);
  const closeBug = () => { bugModal.hidden = true; };
  bugModal.querySelector('.modal-close').addEventListener('click', closeBug);
  bugModal.querySelector('[data-close-bug]').addEventListener('click', closeBug);
  bugModal.querySelector('form').addEventListener('submit', (event) => {
    event.preventDefault();
    const subject = document.getElementById('bugSubject').value.trim();
    const description = document.getElementById('bugDescription').value.trim();
    window.location.href = `mailto:nagymark2357@gmail.com?subject=${encodeURIComponent(`[Weboldal hibajelentés] ${subject}`)}&body=${encodeURIComponent(`${description}\n\nOldal: ${window.location.href}`)}`;
    closeBug();
  });
  const songTarget = document.getElementById('next-daltanitas');
  const eventList = document.getElementById('eventList');
  const search = document.getElementById('eventSearch');
  const calendar = document.getElementById('calendar');
  const songName = 'Daltanítás';
  const songLocation = 'Liget Söröző';
  const canManageContent = (user) => user && (user.isAllTimeAdmin || (user.roles || []).some((role) => ['cantus_praeses', 'jegyzo'].includes(role)));
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
    const title = event.title || songName;
    const location = event.location || songLocation;
    const details = event.details || 'Heti nótázás a Cantusok Körével.';
    const eventEnd = event.endDate ? new Date(event.endDate) : new Date(date.getTime() + 3 * 60 * 60 * 1000);
    const endTime = `${eventEnd.getFullYear()}${pad(eventEnd.getMonth() + 1)}${pad(eventEnd.getDate())}T${pad(eventEnd.getHours())}${pad(eventEnd.getMinutes())}00`;
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
      if (Array.isArray(savedEvents)) savedEvents.forEach((event) => events.push({ ...event, date: new Date(event.date), endDate: event.endDate ? new Date(event.endDate) : new Date(new Date(event.date).getTime() + 3 * 60 * 60 * 1000) }));
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
    const eventOccursOnDate = (event, date) => {
      const start = new Date(event.date);
      const end = new Date(event.endDate || event.date);
      const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const dayEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
      return start < dayEnd && end > dayStart;
    };
    const dateInputValue = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    let selectedCalendarDate = new Date(2026, 9, 1);
    const renderEventDetails = (visible, selectedDate) => {
      eventList.replaceChildren();
      const selectedEvents = visible.filter((event) => eventOccursOnDate(event, selectedDate));
      selectedEvents.forEach((event) => {
        const item = document.createElement('article');
        item.className = 'event-item';
        const content = document.createElement('div');
        const title = document.createElement('h3');
        title.textContent = event.title;
        const metadata = document.createElement('p');
        const eventEnd = event.endDate ? new Date(event.endDate) : new Date(event.date.getTime() + 3 * 60 * 60 * 1000);
        metadata.textContent = `${formatDate(event.date)}–${formatDate(eventEnd)} · ${event.location}`;
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
        actions.appendChild(add);
        if (event.link) {
          const registration = document.createElement('a');
          registration.className = 'button'; registration.href = event.link; registration.target = '_blank'; registration.rel = 'noopener'; registration.textContent = 'Jelentkezési űrlap';
          actions.appendChild(registration);
        }
        item.appendChild(actions);
        eventList.appendChild(item);
      });
      eventList.hidden = selectedEvents.length === 0;
    };
    const renderEvents = () => {
      const query = (search?.value || '').trim().toLocaleLowerCase('hu-HU');
      const visible = events.filter((event) => `${event.title} ${event.location} ${formatDate(event.date)}`.toLocaleLowerCase('hu-HU').includes(query));
      const yearPicker = document.getElementById('eventYear');
      const calendarTitle = document.getElementById('calendarTitle');
      const previousMonth = document.getElementById('previousMonth');
      const nextMonthButton = document.getElementById('nextMonth');
      const noEvents = document.getElementById('noEvents');
      const minimumYear = 2026;
      const minimumMonth = 9;
      const currentYear = Math.max(new Date().getFullYear(), minimumYear);
      const years = [...new Set([minimumYear, currentYear, currentYear + 1, currentYear + 2, ...events.map((event) => event.date.getFullYear()).filter((year) => year >= minimumYear)])].sort((a, b) => a - b);
      if (yearPicker && !yearPicker.options.length) {
        years.forEach((year) => yearPicker.add(new Option(String(year), String(year))));
        yearPicker.value = String(currentYear);
      }
      let month = Number(calendar?.dataset.month || (currentYear === minimumYear ? minimumMonth : new Date().getMonth()));
      const setYear = (year) => {
        if (!yearPicker) return;
        year = Math.max(minimumYear, year);
        if (!Array.from(yearPicker.options).some((option) => option.value === String(year))) yearPicker.add(new Option(String(year), String(year)));
        yearPicker.value = String(year);
      };
      const renderCalendar = () => {
        const year = Math.max(minimumYear, Number(yearPicker?.value || currentYear));
        if (year === minimumYear && month < minimumMonth) month = minimumMonth;
        if (calendar) calendar.dataset.month = String(month);
        if (calendarTitle) calendarTitle.textContent = new Date(year, month, 1).toLocaleString('hu-HU', { month: 'long', year: 'numeric' });
        if (previousMonth) previousMonth.disabled = year === minimumYear && month === minimumMonth;
        if (!calendar) return;
        calendar.replaceChildren();
        ['H', 'K', 'Sze', 'Cs', 'P', 'Szo', 'V'].forEach((day) => {
          const heading = document.createElement('span');
          heading.className = 'calendar-weekday'; heading.textContent = day; heading.setAttribute('role', 'columnheader');
          calendar.appendChild(heading);
        });
        const firstDay = new Date(year, month, 1);
        const offset = (firstDay.getDay() + 6) % 7;
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const today = new Date();
        let selectedDate = new Date(year, month, Math.min(today.getDate(), daysInMonth));
        for (let index = 0; index < offset + daysInMonth; index += 1) {
          if (index < offset) { calendar.appendChild(document.createElement('span')).className = 'calendar-empty'; continue; }
          const day = index - offset + 1;
          const cellDate = new Date(year, month, day);
          const cellEvents = visible.filter((event) => eventOccursOnDate(event, cellDate));
          const cell = document.createElement('button');
          cell.type = 'button'; cell.className = 'calendar-day'; cell.setAttribute('role', 'gridcell');
          if (today.toDateString() === cellDate.toDateString()) cell.classList.add('today');
          cell.innerHTML = `<span class="calendar-day-number">${day}</span>`;
          cellEvents.slice(0, 3).forEach((event) => {
            const label = document.createElement('span');
            label.className = 'calendar-event'; label.textContent = event.title;
            cell.appendChild(label);
          });
          if (cellEvents.length > 3) {
            const more = document.createElement('span');
            more.className = 'calendar-event-more'; more.textContent = `+${cellEvents.length - 3} további`;
            cell.appendChild(more);
          }
          cell.addEventListener('click', () => { selectedDate = cellDate; selectedCalendarDate = cellDate; calendar.querySelectorAll('.calendar-day.selected').forEach((item) => item.classList.remove('selected')); cell.classList.add('selected'); renderEventDetails(visible, selectedDate); });
          calendar.appendChild(cell);
        }
        const monthEvents = visible.filter((event) => Array.from({ length: daysInMonth }, (_, index) => eventOccursOnDate(event, new Date(year, month, index + 1))).some(Boolean));
        if (!monthEvents.some((event) => eventOccursOnDate(event, selectedDate))) selectedDate = monthEvents[0]?.date || selectedDate;
        selectedCalendarDate = selectedDate;
        const selectedCell = [...calendar.querySelectorAll('.calendar-day')].find((cell) => cell.querySelector('.calendar-day-number')?.textContent === String(selectedDate.getDate()));
        selectedCell?.classList.add('selected');
        renderEventDetails(visible, selectedDate);
        if (noEvents) noEvents.hidden = monthEvents.length > 0;
      };
      yearPicker?.addEventListener('change', () => { month = Number(yearPicker.value) === minimumYear ? minimumMonth : 0; renderCalendar(); });
      previousMonth?.addEventListener('click', () => { if (yearPicker.value === String(minimumYear) && month === minimumMonth) return; if (month === 0) { setYear(Number(yearPicker.value) - 1); month = 11; } else month -= 1; renderCalendar(); });
      nextMonthButton?.addEventListener('click', () => { if (month === 11) { setYear(Number(yearPicker.value) + 1); month = 0; } else month += 1; renderCalendar(); });
      renderCalendar();
      if (noEvents) noEvents.hidden = visible.length > 0;
    };
    search?.addEventListener('input', renderEvents);
    renderEvents();
    const eventButton = document.getElementById('addEventButton');
    const eventModal = document.getElementById('eventModal');
    const eventForm = document.getElementById('eventForm');
    const closeEventModal = () => { if (eventModal) eventModal.hidden = true; };
    eventButton?.addEventListener('click', () => {
      const startDate = document.getElementById('eventStartDate');
      const startTime = document.getElementById('eventStartTime');
      const endDate = document.getElementById('eventEndDate');
      const endTime = document.getElementById('eventEndTime');
      if (startDate) startDate.value = dateInputValue(selectedCalendarDate);
      if (startTime) startTime.value = '19:00';
      if (endDate) { endDate.value = dateInputValue(selectedCalendarDate); endDate.min = dateInputValue(selectedCalendarDate); }
      if (endTime) endTime.value = '22:00';
      if (eventModal) eventModal.hidden = false;
    });
    document.getElementById('closeEventModal')?.addEventListener('click', closeEventModal);
    document.getElementById('cancelEvent')?.addEventListener('click', closeEventModal);
    eventForm?.addEventListener('submit', (event) => {
      event.preventDefault();
      const form = new FormData(eventForm);
      const startDate = String(form.get('startDate') || '');
      const startTime = String(form.get('startTime') || '');
      const endDate = String(form.get('endDate') || '');
      const endTime = String(form.get('endTime') || '');
      const start = new Date(`${startDate}T${startTime}`);
      const finish = new Date(`${endDate}T${endTime}`);
      const created = {
        title: String(form.get('title') || '').trim(),
        location: String(form.get('location') || '').trim(),
        date: start.toISOString(),
        endDate: finish.toISOString(),
        details: String(form.get('description') || '').trim()
      };
      if (!created.title || !created.location || Number.isNaN(start.getTime()) || Number.isNaN(finish.getTime())) {
        eventForm.reportValidity();
        return;
      }
      if (finish <= start) {
        const endTimeInput = document.getElementById('eventEndTime');
        if (endTimeInput) {
          endTimeInput.setCustomValidity('A befejezésnek a kezdés után kell lennie.');
          endTimeInput.reportValidity();
          endTimeInput.setCustomValidity('');
        }
        return;
      }
      const savedEvents = JSON.parse(localStorage.getItem('cantusok-events') || '[]');
      savedEvents.push(created);
      localStorage.setItem('cantusok-events', JSON.stringify(savedEvents));
      events.push({ ...created, date: start, endDate: finish });
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
  const userPromise = checkUser();
  const photoGrid = document.querySelector('.photo-grid');
  if (photoGrid) {
      fetch('/gallery', { credentials: 'include' }).then((response) => response.ok ? response.json() : { images: [] }).then((data) => {
        (data.images || []).forEach((image) => {
          const figure = document.createElement('figure');
          figure.className = 'photo-card';
          const photo = document.createElement('img');
          photo.src = image.image_url;
          photo.alt = image.alt_text;
          figure.appendChild(photo);
          photoGrid.appendChild(figure);
        });
      }).catch((error) => console.warn('Could not load gallery images', error));
      userPromise.then((user) => {
        const addPhotoButton = document.getElementById('addPhotoButton');
        if (!addPhotoButton || !canManageContent(user)) return;
        addPhotoButton.hidden = false;
        const photoModal = document.getElementById('photoModal');
        const closePhotoModal = () => { if (photoModal) photoModal.hidden = true; };
        addPhotoButton.addEventListener('click', () => { photoModal.hidden = false; });
        document.getElementById('closePhotoModal')?.addEventListener('click', closePhotoModal);
        document.getElementById('cancelPhoto')?.addEventListener('click', closePhotoModal);
        document.getElementById('photoForm')?.addEventListener('submit', async (event) => {
          event.preventDefault();
          const message = document.getElementById('photoMessage');
          const response = await fetch('/gallery', { method: 'POST', credentials: 'include', body: new FormData(event.currentTarget) });
          const result = await response.json().catch(() => ({}));
          if (!response.ok) { message.textContent = result.message || 'A feltöltés nem sikerült.'; return; }
          window.location.reload();
        });
      });
  }
  userPromise.then((user) => {
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
  const canCreate = canManageContent;
  let activeUser = null;
  function renderPost(post) {
    const article = document.createElement('article');
    article.className = 'news-post';
    const date = post.created_at ? new Date(post.created_at).toLocaleString('hu-HU') : '';
    article.innerHTML = `<div class="news-meta"><strong>${post.author_username || 'Ismeretlen szerző'}</strong> · ${date}</div><div class="news-content">${post.content || ''}</div>`;
    (post.attachments || []).forEach((attachment) => {
      if (typeof attachment === 'string' && attachment.startsWith('/uploads/')) {
        const image = document.createElement('img');
        image.className = 'post-image';
        image.src = attachment;
        image.alt = 'A bejegyzéshez csatolt kép';
        image.loading = 'lazy';
        article.appendChild(image);
      }
    });
    if (post.poll && Array.isArray(post.poll.options)) {
      const poll = document.createElement('form');
      poll.className = 'post-poll';
      const question = document.createElement('strong');
      question.textContent = post.poll.question || 'Szavazás';
      poll.appendChild(question);
      post.poll.options.forEach((option, index) => {
        const label = document.createElement('label');
        const input = document.createElement('input');
        input.type = 'radio';
        input.name = `poll-${post.id}`;
        input.value = index;
        input.required = true;
        const text = document.createElement('span');
        text.textContent = option.text;
        const votes = document.createElement('small');
        votes.textContent = `${option.votes || 0} szavazat`;
        label.append(input, text, votes);
        poll.appendChild(label);
      });
      const voteButton = document.createElement('button');
      voteButton.className = 'button button-outline';
      voteButton.type = 'submit';
      voteButton.textContent = 'Szavazok';
      poll.appendChild(voteButton);
      poll.addEventListener('submit', async (event) => {
        event.preventDefault();
        const selected = poll.querySelector('input:checked');
        const response = await fetch(`/posts/${post.id}/vote`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ optionIndex: Number(selected.value) })
        });
        if (response.ok) loadPosts();
      });
      article.appendChild(poll);
    }
    if (activeUser && (post.author_username === activeUser.username || canManageContent(activeUser))) {
      const deleteButton = document.createElement('button');
      deleteButton.className = 'button button-outline post-delete';
      deleteButton.type = 'button';
      deleteButton.textContent = 'Poszt törlése';
      deleteButton.addEventListener('click', async () => {
        if (!window.confirm('Biztosan törlöd ezt a posztot?')) return;
        const response = await fetch(`/posts/${post.id}`, { method: 'DELETE', credentials: 'include' });
        if (response.ok) loadPosts();
      });
      article.appendChild(deleteButton);
    }
    return article;
  }
  async function loadPosts() {
    try {
      const response = await fetch('/posts', { credentials: 'include' });
      const data = await response.json();
      if (!activeUser && data.currentUser) activeUser = { username: data.currentUser, roles: [] };
      postsList.replaceChildren();
      if (!data.posts?.length) {
        postsList.innerHTML = '<p class="news-meta">Még nincsenek nyilvános hírek.</p>';
      } else data.posts.forEach((post) => postsList.appendChild(renderPost(post)));
      if (feedLoading) feedLoading.hidden = true;
    } catch (error) {
      if (feedLoading) feedLoading.textContent = 'A hírek betöltése nem sikerült.';
    }
  }
  userPromise.then((user) => {
    activeUser = user;
    if (canCreate(user) && createButton && composer) {
      createButton.style.display = 'block';
      body.classList.add('can-create-post');
      createButton.addEventListener('click', () => composer.classList.add('open'));
    }
    loadPosts();
  });
  document.querySelectorAll('[data-close-composer]').forEach((button) => button.addEventListener('click', () => composer?.classList.remove('open')));
  const editor = document.getElementById('composerEditor');
  document.querySelectorAll('[data-command]').forEach((button) => button.addEventListener('click', () => {
    editor?.focus();
    document.execCommand(button.dataset.command, false);
  }));
  const pollEnabled = document.getElementById('composerPollEnabled');
  const pollFields = document.getElementById('pollFields');
  const pollOptions = document.getElementById('composerPollOptions');
  const addPollOption = () => {
    if (!pollOptions || pollOptions.children.length >= 6) return;
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'poll-option';
    input.maxLength = 120;
    input.placeholder = `Válaszlehetőség ${pollOptions.children.length + 1}`;
    pollOptions.appendChild(input);
  };
  pollEnabled?.addEventListener('change', () => {
    if (pollFields) pollFields.hidden = !pollEnabled.checked;
    if (pollEnabled.checked && pollOptions && pollOptions.children.length === 0) {
      addPollOption();
      addPollOption();
    }
  });
  document.getElementById('addPollOption')?.addEventListener('click', addPollOption);
  document.getElementById('composerSubmit')?.addEventListener('click', async () => {
    const content = editor?.innerHTML || '';
    const images = document.getElementById('composerImages');
    const message = document.getElementById('composerMessage');
    const visibility = document.getElementById('composerVisibility')?.value || 'mindenki';
    const formData = new FormData();
    formData.append('content', content);
    formData.append('visibility', visibility);
    Array.from(images?.files || []).slice(0, 5).forEach((file) => formData.append('attachments', file));
    if (pollEnabled?.checked) {
      formData.append('poll', JSON.stringify({
        question: document.getElementById('composerPollQuestion')?.value || '',
        options: Array.from(document.querySelectorAll('.poll-option')).map((input) => input.value)
      }));
    }
    const response = await fetch('/posts', { method: 'POST', credentials: 'include', body: formData });
    if (response.ok) {
      composer?.classList.remove('open');
      if (editor) editor.innerHTML = '';
      if (images) images.value = '';
      if (message) message.textContent = '';
      loadPosts();
    } else if (message) {
      const result = await response.json().catch(() => ({}));
      message.textContent = result.message || 'A poszt közzététele nem sikerült.';
    }
  });
})();
