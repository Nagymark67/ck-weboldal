(() => {
  const body = document.body;
  const header = document.querySelector('.site-header');
  const savedTheme = localStorage.getItem('cantusok-theme');
  if (savedTheme === 'dark') document.documentElement.dataset.theme = 'dark';
  const nav = document.querySelector('.site-nav');
  if (header) {
    const themeButton = document.createElement('button');
    themeButton.className = 'theme-switch';
    themeButton.type = 'button';
    themeButton.setAttribute('role', 'switch');
    themeButton.innerHTML = '<span class="switch-track"><span class="switch-thumb"></span></span><span class="switch-label">Sötét téma</span>';
    const updateThemeLabel = () => {
      const isDark = document.documentElement.dataset.theme === 'dark';
      themeButton.setAttribute('aria-checked', isDark.toString());
      themeButton.querySelector('.switch-label').textContent = isDark ? 'Sötét téma' : 'Világos téma';
    };
    updateThemeLabel();
    themeButton.addEventListener('click', () => {
      const dark = document.documentElement.dataset.theme !== 'dark';
      document.documentElement.dataset.theme = dark ? 'dark' : 'light';
      localStorage.setItem('cantusok-theme', dark ? 'dark' : 'light');
      updateThemeLabel();
    });
    const bugButton = document.createElement('button');
    bugButton.className = 'button button-outline bug-report-toggle';
    bugButton.type = 'button';
    bugButton.textContent = 'Hibajelentés';

    const drawer = document.querySelector('.account-drawer');
    const isAuthPage = window.location.pathname.includes('login.html') || window.location.pathname.includes('register.html');

    if (drawer) {
      let utils = document.getElementById('drawerUtils');
      if (!utils) {
        utils = document.createElement('div');
        utils.id = 'drawerUtils';
        utils.className = 'drawer-utils';
        drawer.appendChild(utils);
      }
      utils.appendChild(themeButton);
      utils.appendChild(bugButton);
    } else if (!isAuthPage) {
      document.body.append(themeButton, bugButton);
    }

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
  const canUploadGallery = (user) => user && (user.isAllTimeAdmin || (user.roles || []).some((role) => ['cantus_praeses', 'jegyzo', 'tag'].includes(role)));
  const canDeleteGallery = (user) => canManageContent(user);
  let canManageEvents = false;
  let rerenderEvents = null;
  const nextSong = (from = new Date()) => {
    const date = new Date(from);
    date.setHours(19, 0, 0, 0);
    const daysUntilMonday = (8 - date.getDay()) % 7;
    date.setDate(date.getDate() + daysUntilMonday);
    if (date <= from) date.setDate(date.getDate() + 7);
    while (date.getMonth() === 11 && date.getDate() === 25) date.setDate(date.getDate() + 7);
    return date;
  };

  function getAllCalendarEvents() {
    const items = [{
      id: 'szureti-mulatsag-2026',
      date: new Date(2026, 10, 14, 8, 30),
      title: 'Cantusok Köre Szüreti Mulatság',
      location: 'Liget Söröző',
      details: 'Immáron XIX. alkalommal kerül megrendezésre a Cantusok Köre Szüreti Mulatsága, melynek pontos időpontja november 14. napja lesz.\n\nA rendezvény hivatalos itala a szürethez híven, a bor lesz.\n\nBelépő: 6500 Ft, elsőéves BSC hallgatóknak 5000 Ft.\n\nProgramterv:\n09:00 Reggeli\n10:00–11:30 Tanítványok által játékos feladatok\n12:00 Ebéd vaddisznóhúsos pincepörkölttel a la Cantusok Köre\n13:00 (opcionális) Cantus verseny és söpröng\n13:00–17:30 Ismerkedés az ifjúsággal\n18:00 Nedvesest kezdete\n\nNovember 15.: Környes búcsú, utolsó nótázó.\n\nJelentkezés: forms.gle/bHwJE93sWEyFUCUL6',
      link: 'https://forms.gle/bHwJE93sWEyFUCUL6'
    }];
    let deletedEventIds = [];
    try {
      deletedEventIds = JSON.parse(localStorage.getItem('cantusok-deleted-events') || '[]');
      if (!Array.isArray(deletedEventIds)) deletedEventIds = [];
      const remoteEvents = JSON.parse(localStorage.getItem('cantusok-remote-events') || '[]');
      if (Array.isArray(remoteEvents)) remoteEvents.forEach((ev) => {
        const id = ev.id || `${ev.date}|${ev.title}`;
        if (!items.some((item) => item.id === id)) {
          items.push({ ...ev, id, date: new Date(ev.date), endDate: ev.endDate ? new Date(ev.endDate) : new Date(new Date(ev.date).getTime() + 3 * 60 * 60 * 1000) });
        }
      });
      const savedEvents = JSON.parse(localStorage.getItem('cantusok-events') || '[]');
      if (Array.isArray(savedEvents)) savedEvents.forEach((ev) => {
        const id = ev.id || `${ev.date}|${ev.title}`;
        if (!items.some((item) => item.id === id)) {
          items.push({ ...ev, id, date: new Date(ev.date), endDate: ev.endDate ? new Date(ev.endDate) : new Date(new Date(ev.date).getTime() + 3 * 60 * 60 * 1000) });
        }
      });
    } catch (err) {
      console.warn('Could not load saved events', err);
    }
    let d = nextSong();
    for (let i = 0; i < 52; i += 1) {
      items.push({ id: `daltanitas-${d.toISOString()}`, date: new Date(d), title: songName, location: songLocation });
      d = new Date(d);
      d.setDate(d.getDate() + 7);
      if (d.getMonth() === 11 && d.getDate() === 25) d.setDate(d.getDate() + 7);
    }
    return items.filter((ev) => !deletedEventIds.includes(ev.id));
  }

  async function fetchRemoteEvents() {
    try {
      if (!window.ckApiFetch) return;
      const res = await window.ckApiFetch('/events');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data?.events)) {
          localStorage.setItem('cantusok-remote-events', JSON.stringify(data.events));
          if (typeof rerenderEvents === 'function') {
            rerenderEvents();
          }
          await syncEventNotifications();
        }
      }
    } catch (err) {
      console.warn('Could not fetch remote events', err);
    }
  }

  async function syncEventNotifications() {
    const LocalNotifications = window.Capacitor?.Plugins?.LocalNotifications;
    if (!LocalNotifications) return;

    const isEnabled = localStorage.getItem('ck_push_notifications_enabled') !== 'false';
    if (!isEnabled) {
      try {
        const pending = await LocalNotifications.getPending();
        if (pending && pending.notifications && pending.notifications.length > 0) {
          await LocalNotifications.cancel({ notifications: pending.notifications });
        }
      } catch (e) {
        console.warn('Error cancelling local notifications', e);
      }
      return;
    }

    try {
      let perm = await LocalNotifications.checkPermissions();
      if (perm.display !== 'granted') {
        perm = await LocalNotifications.requestPermissions();
      }
      if (perm.display !== 'granted') return;
    } catch (e) {
      console.warn('Local notifications permission check failed', e);
      return;
    }

    try {
      await LocalNotifications.createChannel({
        id: 'cantusok_events_channel',
        name: 'Esemény emlékeztetők',
        description: 'Emlékeztetők a Cantusok Köre eseményeiről és daltanításokról',
        importance: 4,
        visibility: 1,
        sound: 'default',
        vibration: true
      });
    } catch (e) {
      console.warn('Error creating notification channel', e);
    }

    try {
      const pending = await LocalNotifications.getPending();
      if (pending && pending.notifications && pending.notifications.length > 0) {
        await LocalNotifications.cancel({ notifications: pending.notifications });
      }
    } catch (e) {
      console.warn('Error clearing pending notifications', e);
    }

    const allEvents = getAllCalendarEvents();
    const now = new Date();
    const notificationsToSchedule = [];

    function hashId(str) {
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash |= 0;
      }
      return Math.abs(hash) % 2147483647;
    }

    for (const ev of allEvents) {
      const eventDate = new Date(ev.date);
      if (Number.isNaN(eventDate.getTime())) continue;

      const timeStr = eventDate.toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' });

      // 1) Exactly 1 hour before the event
      const oneHourBefore = new Date(eventDate.getTime() - 60 * 60 * 1000);
      if (oneHourBefore > now) {
        notificationsToSchedule.push({
          id: hashId(`${ev.id}_1h_${eventDate.getTime()}`),
          title: `Hamarosan: ${ev.title}`,
          body: `1 óra múlva (${timeStr}) kezdődik: ${ev.title} (${ev.location || 'Liget Söröző'})`,
          channelId: 'cantusok_events_channel',
          schedule: { at: oneHourBefore, allowWhileIdle: true },
          sound: 'default',
          extra: { type: 'event_reminder', eventId: ev.id }
        });
      } else if (eventDate > now && (eventDate.getTime() - now.getTime()) <= 60 * 60 * 1000) {
        // Event starts in less than 1 hour (created on short notice or for immediate testing)
        const soon = new Date(Date.now() + 3000);
        notificationsToSchedule.push({
          id: hashId(`${ev.id}_soon_${eventDate.getTime()}`),
          title: `Hamarosan: ${ev.title}`,
          body: `Kevesebb mint 1 óra múlva (${timeStr}) kezdődik: ${ev.title} (${ev.location || 'Liget Söröző'})`,
          channelId: 'cantusok_events_channel',
          schedule: { at: soon, allowWhileIdle: true },
          sound: 'default',
          extra: { type: 'event_reminder', eventId: ev.id }
        });
      }

      // 2) Previous day at 20:00 (8:00 PM)
      const prevDayAt20 = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate() - 1, 20, 0, 0, 0);
      if (prevDayAt20 > now && prevDayAt20 < eventDate) {
        notificationsToSchedule.push({
          id: hashId(`${ev.id}_eve_${eventDate.getTime()}`),
          title: `Holnap: ${ev.title}`,
          body: `Holnap ${timeStr}-kor: ${ev.title} (${ev.location || 'Liget Söröző'})`,
          channelId: 'cantusok_events_channel',
          schedule: { at: prevDayAt20, allowWhileIdle: true },
          sound: 'default',
          extra: { type: 'event_reminder', eventId: ev.id }
        });
      }
    }

    notificationsToSchedule.sort((a, b) => a.schedule.at.getTime() - b.schedule.at.getTime());
    const batch = notificationsToSchedule.slice(0, 50);
    if (batch.length > 0) {
      try {
        await LocalNotifications.schedule({ notifications: batch });
        console.log(`[Event Reminders] Successfully scheduled ${batch.length} event notifications.`);
      } catch (err) {
        console.error('[Event Reminders] Failed to schedule notifications:', err);
      }
    }
  }

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
    let events = getAllCalendarEvents();
    fetchRemoteEvents();

    let deletedEventIds = [];
    try {
      deletedEventIds = JSON.parse(localStorage.getItem('cantusok-deleted-events') || '[]');
      if (!Array.isArray(deletedEventIds)) deletedEventIds = [];
    } catch (error) {
      console.warn('Could not load deleted events', error);
    }

    const eventOccursOnDate = (event, date) => {
      const start = new Date(event.date);
      const end = new Date(event.endDate || event.date);
      const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const dayEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
      return start < dayEnd && end > dayStart;
    };
    const dateInputValue = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    let selectedCalendarDate = new Date();
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
        if (canManageEvents) {
          const remove = document.createElement('button');
          remove.type = 'button';
          remove.className = 'button button-outline event-delete';
          remove.setAttribute('aria-label', `${event.title} törlése`);
          remove.textContent = '🗑';
          remove.addEventListener('click', async () => {
            if (!window.confirm(`Biztosan törlöd ezt az eseményt?\n\n${event.title}`)) return;
            deletedEventIds.push(event.id);
            localStorage.setItem('cantusok-deleted-events', JSON.stringify(deletedEventIds));
            const savedEvents = JSON.parse(localStorage.getItem('cantusok-events') || '[]');
            localStorage.setItem('cantusok-events', JSON.stringify(savedEvents.filter((item) => (item.id || `${item.date}|${item.title}`) !== event.id)));
            const remoteEvents = JSON.parse(localStorage.getItem('cantusok-remote-events') || '[]');
            localStorage.setItem('cantusok-remote-events', JSON.stringify(remoteEvents.filter((item) => (item.id || `${item.date}|${item.title}`) !== event.id)));
            try {
              if (window.ckApiFetch) {
                await window.ckApiFetch(`/events/${encodeURIComponent(event.id)}`, { method: 'DELETE' });
              }
            } catch (err) {
              console.warn('Failed to delete event on server', err);
            }
            renderEvents();
            syncEventNotifications();
          });
          actions.appendChild(remove);
        }
        item.appendChild(actions);
        eventList.appendChild(item);
      });
      eventList.hidden = selectedEvents.length === 0;
    };
    const renderEvents = (targetDate) => {
      events = getAllCalendarEvents();
      const query = (search?.value || '').trim().toLocaleLowerCase('hu-HU');
      const visible = events.filter((event) => `${event.title} ${event.location} ${formatDate(event.date)}`.toLocaleLowerCase('hu-HU').includes(query));
      const yearPicker = document.getElementById('eventYear');
      const calendarTitle = document.getElementById('calendarTitle');
      const previousMonth = document.getElementById('previousMonth');
      const nextMonthButton = document.getElementById('nextMonth');
      const noEvents = document.getElementById('noEvents');
      const today = new Date();
      const minimumYear = Math.min(2026, today.getFullYear());
      const currentYear = today.getFullYear();
      const years = [...new Set([minimumYear, currentYear, currentYear + 1, currentYear + 2, ...events.map((event) => event.date.getFullYear())])].sort((a, b) => a - b);
      if (yearPicker && !yearPicker.options.length) {
        years.forEach((year) => yearPicker.add(new Option(String(year), String(year))));
        yearPicker.value = String(targetDate ? targetDate.getFullYear() : currentYear);
      }
      let month = targetDate ? targetDate.getMonth() : Number(calendar?.dataset.month ?? today.getMonth());
      const setYear = (year) => {
        if (!yearPicker) return;
        if (!Array.from(yearPicker.options).some((option) => option.value === String(year))) yearPicker.add(new Option(String(year), String(year)));
        yearPicker.value = String(year);
      };
      if (targetDate) setYear(targetDate.getFullYear());

      const renderCalendar = () => {
        const year = Number(yearPicker?.value || currentYear);
        if (calendar) calendar.dataset.month = String(month);
        if (calendarTitle) calendarTitle.textContent = new Date(year, month, 1).toLocaleString('hu-HU', { month: 'long', year: 'numeric' });
        if (previousMonth) previousMonth.disabled = false;
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
        let selectedDate = targetDate && targetDate.getFullYear() === year && targetDate.getMonth() === month
          ? targetDate
          : new Date(year, month, Math.min(today.getDate(), daysInMonth));
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
      yearPicker?.addEventListener('change', () => { month = 0; renderCalendar(); });
      previousMonth?.addEventListener('click', () => { if (month === 0) { setYear(Number(yearPicker.value) - 1); month = 11; } else month -= 1; renderCalendar(); });
      nextMonthButton?.addEventListener('click', () => { if (month === 11) { setYear(Number(yearPicker.value) + 1); month = 0; } else month += 1; renderCalendar(); });
      renderCalendar();
      if (noEvents) noEvents.hidden = visible.length > 0;
    };
    rerenderEvents = renderEvents;
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
    const startDateInput = document.getElementById('eventStartDate');
    const endDateInput = document.getElementById('eventEndDate');
    startDateInput?.addEventListener('change', () => {
      if (endDateInput) {
        endDateInput.min = startDateInput.value;
        if (!endDateInput.value || endDateInput.value < startDateInput.value) {
          endDateInput.value = startDateInput.value;
        }
      }
    });
    document.getElementById('closeEventModal')?.addEventListener('click', closeEventModal);
    document.getElementById('cancelEvent')?.addEventListener('click', closeEventModal);
    eventForm?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = new FormData(eventForm);
      const startDate = String(form.get('startDate') || '');
      const startTime = String(form.get('startTime') || '');
      const endDate = String(form.get('endDate') || '');
      const endTime = String(form.get('endTime') || '');
      const start = new Date(`${startDate}T${startTime}`);
      const finish = new Date(`${endDate}T${endTime}`);
      const created = {
        id: `custom-event-${Date.now()}`,
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

      try {
        if (window.ckApiFetch) {
          const res = await window.ckApiFetch('/events', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(created)
          });
          if (res.ok) {
            const data = await res.json();
            if (data?.event?.id) created.id = data.event.id;
          }
        }
      } catch (err) {
        console.warn('Failed to post event to server:', err);
      }

      eventForm.reset();
      closeEventModal();
      selectedCalendarDate = start;
      renderEvents(start);
      syncEventNotifications();
    });

    const eventNotifyToggle = document.getElementById('eventNotifyToggle');
    if (eventNotifyToggle) {
      const PushNotifications = window.Capacitor?.Plugins?.PushNotifications;
      const LocalNotifications = window.Capacitor?.Plugins?.LocalNotifications;
      if (PushNotifications || LocalNotifications) {
        eventNotifyToggle.style.display = 'inline-flex';
        const updateNotifyButton = () => {
          const isEnabled = localStorage.getItem('ck_push_notifications_enabled') !== 'false';
          eventNotifyToggle.classList.toggle('active', isEnabled);
          eventNotifyToggle.textContent = isEnabled ? '🔔 Push értesítések: Be' : '🔕 Push értesítések: Ki';
        };
        updateNotifyButton();

        eventNotifyToggle.addEventListener('click', async () => {
          const currentlyEnabled = localStorage.getItem('ck_push_notifications_enabled') !== 'false';
          if (!currentlyEnabled) {
            let granted = false;
            if (PushNotifications) {
              let perm = await PushNotifications.checkPermissions();
              if (perm.receive !== 'granted') {
                perm = await PushNotifications.requestPermissions();
              }
              if (perm.receive === 'granted') {
                granted = true;
                await PushNotifications.register();
              }
            }
            if (LocalNotifications) {
              let lPerm = await LocalNotifications.checkPermissions();
              if (lPerm.display !== 'granted') {
                lPerm = await LocalNotifications.requestPermissions();
              }
              if (lPerm.display === 'granted') granted = true;
            }
            if (granted) {
              localStorage.setItem('ck_push_notifications_enabled', 'true');
              await syncEventNotifications();
              updateNotifyButton();
              alert('Értesítések bekapcsolva! Értesítést kapsz új poszt közzétételekor és az eseményekről is (előző este 20:00 és 1 órával előtte).');
            } else {
              alert('Az értesítések fogadásához engedélyezned kell azt a rendszerbeállításokban.');
            }
          } else {
            localStorage.setItem('ck_push_notifications_enabled', 'false');
            const token = localStorage.getItem('ck_push_token');
            if (token) {
              try {
                await window.ckApiFetch('/push/unregister-token', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ token })
                });
              } catch (e) {}
            }
            await syncEventNotifications();
            updateNotifyButton();
            alert('Értesítések kikapcsolva.');
          }
        });
      }
    }
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
      const response = await window.ckApiFetch('/me');
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
      const defaultGalleryImages = [
        { image_url: 'https://ljxoykuwidoirscbdfaf.supabase.co/storage/v1/object/public/uploads/cantusok-koere-01.jpg', alt_text: 'A Cantusok Köre tagjai erdei kiránduláson', fallback_url: 'uploads/cantusok-koere-01.jpg' },
        { image_url: 'https://ljxoykuwidoirscbdfaf.supabase.co/storage/v1/object/public/uploads/cantusok-koere-02.jpg', alt_text: 'A Cantusok Köre tagjai szabadtéri programon', fallback_url: 'uploads/cantusok-koere-02.jpg' },
        { image_url: 'https://ljxoykuwidoirscbdfaf.supabase.co/storage/v1/object/public/uploads/cantusok-koere-03.jpg', alt_text: 'Baráti pillanat egy esti rendezvényen', fallback_url: 'uploads/cantusok-koere-03.jpg' },
        { image_url: 'https://ljxoykuwidoirscbdfaf.supabase.co/storage/v1/object/public/uploads/cantusok-koere-04.jpg', alt_text: 'Cantusok Köre tagjai ünnepi öltözetben', fallback_url: 'uploads/cantusok-koere-04.jpg' },
        { image_url: 'https://ljxoykuwidoirscbdfaf.supabase.co/storage/v1/object/public/uploads/cantusok-koere-05.jpg', alt_text: 'Közös fotó egy rendezvényen', fallback_url: 'uploads/cantusok-koere-05.jpg' },
        { image_url: 'https://ljxoykuwidoirscbdfaf.supabase.co/storage/v1/object/public/uploads/cantusok-koere-06.jpg', alt_text: 'A Cantusok Köre tagjai szabadtéri eseményen', fallback_url: 'uploads/cantusok-koere-06.jpg' },
        { image_url: 'https://ljxoykuwidoirscbdfaf.supabase.co/storage/v1/object/public/uploads/hero.jpg', alt_text: 'A Cantusok Köre tagjai közös ünnepi fotón', fallback_url: 'uploads/hero.jpg' }
      ];

      const renderGallery = (images, user) => {
        const accessMessage = document.getElementById('photoAccessMessage');
        if (accessMessage) accessMessage.textContent = images.length ? '' : 'Még nincs elérhető kép.';
        photoGrid.innerHTML = '';
        images.forEach((image) => {
          const figure = document.createElement('figure');
          figure.className = 'photo-card';
          const photo = document.createElement('img');
          const resolvedSrc = image.image_url.startsWith('/') ? `${window.CK_API_BASE_URL}${image.image_url}` : image.image_url;
          photo.src = resolvedSrc;
          photo.alt = image.alt_text || 'Cantusok Köre fotó';
          photo.loading = 'lazy';
          photo.onerror = () => {
            if (image.fallback_url && photo.src !== image.fallback_url) {
              photo.src = image.fallback_url;
            } else {
              const filename = image.image_url.split('/').pop();
              if (filename && !photo.src.endsWith(`uploads/${filename}`)) {
                photo.src = `uploads/${filename}`;
              }
            }
          };
          figure.appendChild(photo);
          if (canDeleteGallery(user) && image.id) {
            const deleteButton = document.createElement('button');
            deleteButton.type = 'button';
            deleteButton.className = 'button button-outline gallery-delete-button';
            deleteButton.textContent = 'Kép törlése';
            deleteButton.addEventListener('click', async () => {
              if (!window.confirm('Biztosan törlöd ezt a képet?')) return;
              const deleteResponse = await window.ckApiFetch(`/gallery/${image.id}`, { method: 'DELETE' });
              if (!deleteResponse.ok) {
                const result = await deleteResponse.json().catch(() => ({}));
                window.alert(result.message || 'A kép törlése nem sikerült.');
                return;
              }
              figure.remove();
            });
            figure.appendChild(deleteButton);
          }
          photoGrid.appendChild(figure);
        });
      };

      Promise.all([
        window.ckApiFetch('/gallery').catch((err) => ({ ok: false, status: 0, error: err })),
        userPromise
      ]).then(async ([response, user]) => {
        const accessMessage = document.getElementById('photoAccessMessage');
        if ((response.status === 401 && !user) || (!user && !response.ok)) {
          if (accessMessage) accessMessage.innerHTML = 'A galéria megtekintéséhez <a href="login.html">be kell jelentkezned</a>.';
          return;
        }

        let dynamicImages = [];
        if (response.ok) {
          try {
            const data = await response.json();
            dynamicImages = Array.isArray(data.images) ? data.images : [];
          } catch (e) {
            console.warn('Could not parse gallery JSON', e);
          }
        }

        const allImages = [...defaultGalleryImages];
        dynamicImages.forEach((img) => {
          if (!allImages.some((existing) => existing.id && existing.id === img.id)) {
            allImages.push(img);
          }
        });

        renderGallery(allImages, user);
      }).catch((error) => {
        console.warn('Could not load gallery images', error);
        userPromise.then((user) => {
          const accessMessage = document.getElementById('photoAccessMessage');
          if (user) {
            renderGallery(defaultGalleryImages, user);
          } else {
            if (accessMessage) accessMessage.innerHTML = 'A galéria megtekintéséhez <a href="login.html">be kell jelentkezned</a>.';
          }
        });
      });
      userPromise.then((user) => {
        const addPhotoButton = document.getElementById('addPhotoButton');
        if (!addPhotoButton || !canUploadGallery(user)) return;
        addPhotoButton.hidden = false;
        const photoModal = document.getElementById('photoModal');
        const closePhotoModal = () => { if (photoModal) photoModal.hidden = true; };
        addPhotoButton.addEventListener('click', () => { photoModal.hidden = false; });
        document.getElementById('closePhotoModal')?.addEventListener('click', closePhotoModal);
        document.getElementById('cancelPhoto')?.addEventListener('click', closePhotoModal);
        document.getElementById('photoForm')?.addEventListener('submit', async (event) => {
          event.preventDefault();
          const message = document.getElementById('photoMessage');
          const response = await window.ckApiFetch('/gallery', { method: 'POST', body: new FormData(event.currentTarget) });
          const result = await response.json().catch(() => ({}));
          if (!response.ok) { message.textContent = result.message || 'A feltöltés nem sikerült.'; return; }
          window.location.reload();
        });
      });
  }
  const isAuthPage = window.location.pathname.includes('login.html') || window.location.pathname.includes('register.html');
  const isAdminPage = window.location.pathname.includes('admin.html');
  let onlineList = null;

  if (!isAuthPage && !isAdminPage) {
    const onlineWidget = document.createElement('aside');
    onlineWidget.className = 'online-users-widget';
    onlineWidget.innerHTML = '<strong>Online felhasználók</strong><ul></ul>';
    const drawerUtils = document.getElementById('drawerUtils');
    const drawer = document.querySelector('.account-drawer');
    const onlineWidgetMount = drawer || document.body;

    if (onlineWidgetMount === drawer && drawerUtils) {
      drawer.insertBefore(onlineWidget, drawerUtils);
    } else {
      onlineWidgetMount.appendChild(onlineWidget);
    }
    onlineList = onlineWidget.querySelector('ul');
  }

  const refreshOnlineUsers = async () => {
    if (!onlineList) return;
    try {
      const response = await window.ckApiFetch('/online-users');
      if (!response.ok) throw new Error('Online users request failed');
      const data = await response.json();
      onlineList.replaceChildren();
      if (!data.users?.length) {
        onlineList.innerHTML = '<li>Nincs online felhasználó</li>';
        return;
      }
      data.users.forEach((onlineUser) => {
        const item = document.createElement('li');
        item.textContent = onlineUser.username + (onlineUser.status ? ` (${onlineUser.status})` : '');
        onlineList.appendChild(item);
      });
    } catch (error) {
      onlineList.innerHTML = '<li>Az állapot nem érhető el</li>';
      console.warn('Could not load online users', error);
    }
  };
  const sendOnlinePing = async () => {
    if (!(await userPromise)) return;
    await window.ckApiFetch('/online-ping', { method: 'POST', keepalive: true });
    refreshOnlineUsers();
  };
  const leaveOnlineStatus = () => window.ckApiFetch('/online-leave', { method: 'POST', keepalive: true });
  userPromise.then((user) => {
    if (!user) return;
    sendOnlinePing();
    window.setInterval(sendOnlinePing, 20000);
    window.addEventListener('pagehide', () => {
      leaveOnlineStatus();
    });
  });
  refreshOnlineUsers();
  window.setInterval(refreshOnlineUsers, 20000);
  userPromise.then((user) => {
    // Check Daloskönyv access: Tag, Jegyző, Cantus Praeses, Alapító, all time admin
    const normalizeRoleText = (text) => String(text || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '');

    const canViewDaloskonyv = Boolean(user && (
      user.isAllTimeAdmin ||
      (() => {
        const allowed = ['tag', 'jegyzo', 'cantuspraeses', 'alapito', 'alltimeadmin', 'admin'];
        const roles = (user.roles || []).map(normalizeRoleText);
        if (roles.some((r) => allowed.includes(r))) return true;
        const status = normalizeRoleText(user.status);
        if (allowed.includes(status)) return true;
        if (user.role && allowed.includes(normalizeRoleText(user.role))) return true;
        return false;
      })()
    ));

    if (canViewDaloskonyv) {
      document.querySelectorAll('.nav-daloskonyv').forEach((el) => {
        el.hidden = false;
        el.style.display = '';
      });
      document.querySelectorAll('.site-nav').forEach((nav) => {
        if (!nav.querySelector('.nav-daloskonyv')) {
          const a = document.createElement('a');
          a.className = 'nav-daloskonyv' + (window.location.pathname.includes('daloskonyv.html') ? ' active' : '');
          a.href = new URL('daloskonyv.html', document.baseURI).href;
          a.textContent = 'Daloskönyv';
          nav.appendChild(a);
        }
      });
      document.getElementById('drawerDaloskonyvLink')?.remove();
    } else {
      document.querySelectorAll('.nav-daloskonyv').forEach((el) => {
        el.hidden = true;
        el.style.display = 'none';
      });
      document.getElementById('drawerDaloskonyvLink')?.remove();
    }

    if (window.location.pathname.includes('daloskonyv.html') && !canViewDaloskonyv) {
      window.location.replace('index.html');
      return; // prevent further execution on this page
    }

    const eventButton = document.getElementById('addEventButton');
    canManageEvents = Boolean(user && (user.isAllTimeAdmin || (user.roles || []).some((role) => ['cantus_praeses', 'jegyzo'].includes(role))));
    if (eventButton && canManageEvents) eventButton.hidden = false;
    rerenderEvents?.();
    if (!user || !authLinks || !loggedInLinks) return;
    authLinks.hidden = true;
    loggedInLinks.hidden = false;
    if (drawerUser) drawerUser.textContent = `Bejelentkezve: ${user.username}`;
    if (user.isAllTimeAdmin && !document.getElementById('adminPageLink')) {
      const adminPageLink = document.createElement('a');
      adminPageLink.id = 'adminPageLink';
      adminPageLink.className = 'button button-outline';
      adminPageLink.href = new URL('admin.html', document.baseURI).href;
      adminPageLink.textContent = 'Admin felület';
      loggedInLinks.insertBefore(adminPageLink, drawerLogout);
    }
    const handleLogout = async () => {
      try {
        await leaveOnlineStatus();
        await refreshOnlineUsers();
      } catch (error) {
        console.warn('Could not update online status before logout', error);
      }
      const response = await window.ckApiFetch('/logout', { method: 'POST' });
      if (response.ok) window.location.reload();
    };

    if (drawerLogout) drawerLogout.addEventListener('click', handleLogout);
  });

  const postsList = document.getElementById('posts-list');
  if (!postsList) return;
  const feedLoading = document.getElementById('feed-loading');
  const composer = document.getElementById('composer');
  const createButton = document.getElementById('floatingCreate');
  const canCreate = canManageContent;
  let activeUser = null;
  const attachmentUrl = (attachment) => {
    if (typeof attachment === 'string') return attachment;
    if (attachment && typeof attachment === 'object') {
      return attachment.url || attachment.image_url || attachment.path || '';
    }
    return '';
  };
  const attachmentList = (attachments) => {
    if (Array.isArray(attachments)) return attachments;
    if (typeof attachments !== 'string' || !attachments.trim()) return [];
    try {
      const parsed = JSON.parse(attachments);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };
  function renderPost(post) {
    const article = document.createElement('article');
    article.className = 'news-post';
    const date = post.created_at ? new Date(post.created_at).toLocaleString('hu-HU') : '';
    article.innerHTML = `<div class="news-meta"><strong>${post.author_username || 'Ismeretlen szerző'}</strong> · ${date}</div><div class="news-content">${post.content || ''}</div>`;
    attachmentList(post.attachments).forEach((attachment) => {
      const source = attachmentUrl(attachment);
      if (source && (source.startsWith('/uploads/') || /^https?:\/\//i.test(source))) {
        const image = document.createElement('img');
        image.className = 'post-image';
        image.alt = 'A bejegyzéshez csatolt kép';
        image.loading = 'lazy';
        image.addEventListener('error', () => {
          image.replaceWith(Object.assign(document.createElement('p'), {
            className: 'news-meta',
            textContent: 'A kép nem tölthető be.'
          }));
        }, { once: true });
        image.src = source;
        article.appendChild(image);
      }
    });
    if (activeUser && (post.author_username === activeUser.username || canManageContent(activeUser))) {
      article.querySelectorAll('.post-image').forEach((image, index) => {
        const removeButton = document.createElement('button');
        removeButton.className = 'button button-outline post-image-remove';
        removeButton.type = 'button';
        removeButton.textContent = 'Kép eltávolítása';
        removeButton.addEventListener('click', async () => {
          if (!window.confirm('Biztosan eltávolítod ezt a képet?')) return;
          const response = await window.ckApiFetch(`/posts/${post.id}/attachments/${index}`, { method: 'DELETE' });
          if (response.ok) loadPosts();
        });
        image.insertAdjacentElement('afterend', removeButton);
      });
    }
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
        const response = await window.ckApiFetch(`/posts/${post.id}/vote`, {
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
        const response = await window.ckApiFetch(`/posts/${post.id}`, { method: 'DELETE' });
        if (response.ok) loadPosts();
      });
      article.appendChild(deleteButton);
    }
    return article;
  }
  async function loadPosts() {
    try {
      const response = await window.ckApiFetch('/posts');
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
  const imageInput = document.getElementById('composerImages');
  const imagePreview = document.getElementById('composerImagePreview');
  let selectedImages = [];
  const renderImagePreview = () => {
    if (!imagePreview) return;
    imagePreview.replaceChildren();
    selectedImages.forEach((file, index) => {
      const item = document.createElement('div');
      item.className = 'composer-image-item';
      const preview = document.createElement('img');
      preview.src = URL.createObjectURL(file);
      preview.alt = file.name;
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'button button-outline';
      remove.textContent = 'Eltávolítás';
      remove.addEventListener('click', () => {
        selectedImages.splice(index, 1);
        renderImagePreview();
      });
      item.append(preview, remove);
      imagePreview.appendChild(item);
    });
  };
  imageInput?.addEventListener('change', () => {
    selectedImages = Array.from(imageInput.files || []).slice(0, 5);
    renderImagePreview();
  });
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
    selectedImages.forEach((file) => formData.append('attachments', file));
    if (pollEnabled?.checked) {
      formData.append('poll', JSON.stringify({
        question: document.getElementById('composerPollQuestion')?.value || '',
        options: Array.from(document.querySelectorAll('.poll-option')).map((input) => input.value)
      }));
    }
    const response = await window.ckApiFetch('/posts', { method: 'POST', body: formData });
    if (response.ok) {
      composer?.classList.remove('open');
      if (editor) editor.innerHTML = '';
      if (images) images.value = '';
      selectedImages = [];
      renderImagePreview();
      if (message) message.textContent = '';
      loadPosts();
    } else if (message) {
      const result = await response.json().catch(() => ({}));
      message.textContent = result.message || 'A poszt közzététele nem sikerült.';
    }
  });

  // Native Capacitor App Integration
  if (window.Capacitor && window.Capacitor.Plugins) {
    const { App, StatusBar, SplashScreen, PushNotifications, LocalNotifications } = window.Capacitor.Plugins;

    // Notifications Initialization (Push + Local Event Reminders)
    async function initNotifications() {
      if (PushNotifications) {
        try {
          // Check or request notification permissions
          let perm = await PushNotifications.checkPermissions();
          if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') {
            perm = await PushNotifications.requestPermissions();
          }

          if (perm.receive === 'granted') {
            await PushNotifications.register();
          }

          // Listen for push registration token
          PushNotifications.addListener('registration', async (token) => {
            console.log('Push notification token received:', token.value);
            localStorage.setItem('ck_push_token', token.value);
            try {
              await window.ckApiFetch('/push/register-token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: token.value, platform: 'android' })
              });
            } catch (err) {
              console.warn('Could not register push token on server:', err);
            }
          });

          // Handle registration error
          PushNotifications.addListener('registrationError', (err) => {
            console.error('Push notification registration error:', err);
          });

          // Handle incoming push notification while app is in foreground
          PushNotifications.addListener('pushNotificationReceived', (notification) => {
            console.log('Push notification received in foreground:', notification);
            if (notification.data && notification.data.type === 'new_post') {
              if (typeof loadPosts === 'function') loadPosts();
            } else if (notification.data && (notification.data.type === 'new_event' || notification.data.type === 'event_reminder')) {
              fetchRemoteEvents();
            }
          });

          // Handle action when user taps on push notification banner
          PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
            console.log('Push notification action performed:', action);
            const data = action.notification && action.notification.data;
            if (data && data.type === 'new_post') {
              const currentPath = window.location.pathname.replace(/^\//, '');
              if (currentPath !== 'index.html' && currentPath !== '') {
                window.location.href = 'index.html';
              }
            } else if (data && (data.type === 'new_event' || data.type === 'event_reminder')) {
              fetchRemoteEvents();
              const currentPath = window.location.pathname.replace(/^\//, '');
              if (currentPath !== 'events.html') {
                window.location.href = 'events.html';
              }
            }
          });
        } catch (pushErr) {
          console.warn('PushNotifications init failed:', pushErr);
        }
      }

      if (LocalNotifications) {
        try {
          LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
            console.log('Local notification action performed:', action);
            const currentPath = window.location.pathname.replace(/^\//, '');
            if (currentPath !== 'events.html') {
              window.location.href = 'events.html';
            }
          });
        } catch (locErr) {
          console.warn('LocalNotifications listener failed:', locErr);
        }
      }

      await fetchRemoteEvents();
      await syncEventNotifications();
    }

    initNotifications();

    if (StatusBar) {
      try {
        StatusBar.setBackgroundColor({ color: '#4b0000' });
        StatusBar.setStyle({ style: 'DARK' });
      } catch (err) {
        console.warn('Capacitor StatusBar setup failed', err);
      }
    }

    if (SplashScreen) {
      try {
        SplashScreen.hide();
      } catch (err) {
        console.warn('Capacitor SplashScreen hide failed', err);
      }
    }

    if (App) {
      App.addListener('backButton', ({ canGoBack }) => {
        // 0. Close Daloskönyv fullscreen if active
        const pdfFsWrapper = document.getElementById('canvasWrapper');
        if (pdfFsWrapper && pdfFsWrapper.classList.contains('is-fullscreen')) {
          const exitFsBtn = document.getElementById('exitFullscreenBtn');
          if (exitFsBtn) {
            exitFsBtn.click();
            return;
          }
        }

        // 1. Close drawers or mobile navigation
        if (body.classList.contains('drawer-open') || body.classList.contains('nav-open')) {
          body.classList.remove('drawer-open', 'nav-open');
          return;
        }

        // 2. Close composer modal
        const composerModal = document.getElementById('composer');
        if (composerModal && composerModal.classList.contains('open')) {
          composerModal.classList.remove('open');
          return;
        }

        // 3. Close other modals (bug report, photo modal, event modal)
        const modals = ['bugReportModal', 'photoModal', 'eventModal'];
        for (const modalId of modals) {
          const m = document.getElementById(modalId);
          if (m && !m.hidden) {
            m.hidden = true;
            return;
          }
        }

        // 4. History navigation or exit
        const pathname = window.location.pathname.replace(/^\//, '');
        const isHome = !pathname || pathname === 'index.html';
        if (canGoBack && !isHome) {
          window.history.back();
        } else {
          App.exitApp();
        }
      });

      // Manage online status and 5-minute background auto-logout
      let backgroundLogoutTimer = null;

      App.addListener('appStateChange', async ({ isActive }) => {
        if (isActive) {
          fetchRemoteEvents();
          syncEventNotifications();
        }
        const user = await checkUser();
        if (user) {
          if (!isActive) {
            try {
              await window.ckApiFetch('/online-leave', { method: 'POST', keepalive: true });
            } catch (error) {
              console.warn('Could not update online status on app close', error);
            }

            // Start a 5-minute background timer before logging out
            if (!backgroundLogoutTimer) {
              backgroundLogoutTimer = setTimeout(async () => {
                try {
                  await window.ckApiFetch('/logout', { method: 'POST' });
                  window.location.reload();
                } catch (e) {
                  console.warn('Background logout failed', e);
                }
              }, 5 * 60 * 1000);
            }
          } else {
            // App resumed before 5 minutes: cancel background logout
            if (backgroundLogoutTimer) {
              clearTimeout(backgroundLogoutTimer);
              backgroundLogoutTimer = null;
            }

            try {
              await window.ckApiFetch('/online-ping', { method: 'POST' });
            } catch (error) {
              console.warn('Could not ping online status on app resume', error);
            }
          }
        }
      });
    }
  }
})();
