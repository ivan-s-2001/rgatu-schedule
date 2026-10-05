(() => {
  'use strict';
  const DOWNLOAD_URL = 'https://ivan-s-2001.github.io/rgatu-schedule/';
  const time = window.RGATU_TIME;
  const root = document.getElementById('app');
  let consultations = null;
  let consultationsLoading = false;
  let consultationsFailed = false;
  const isAndroid = /RgatuLiteAndroid\//.test(navigator.userAgent);
  const read = (key, fallback = null) => { try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; } };
  const write = (key, value) => { try { localStorage.setItem(key, value); return true; } catch { return false; } };
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const iconPaths = {
    calendar: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 11h18m-12 4h2m4 0h2m-8 3h2"/>',
    list: '<path d="M9 5h12M9 12h12M9 19h12"/><path d="M3 5h1M3 12h1M3 19h1"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
    room: '<path d="M5 21V4l12-2v19M3 21h18M10 12h1"/>',
    search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
    down: '<path d="m6 9 6 6 6-6"/>',
    left: '<path d="m15 6-6 6 6 6"/>',
    right: '<path d="m9 6 6 6-6 6"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    download: '<path d="M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4"/>',
    refresh: '<path d="M20 7a8 8 0 1 0 0 10M20 3v5h-5"/>',
    book: '<path d="M12 5v16M12 5C8 2 4 3 2 4v15c3-1 6-1 10 2 4-3 7-3 10-2V4c-2-1-6-2-10 1Z"/>',
    arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    people: '<circle cx="9" cy="8" r="3"/><path d="M3 21v-2a6 6 0 0 1 12 0v2m2-16a3 3 0 0 1 0 6m1 4a5 5 0 0 1 3 4v2"/>',
  };
  const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${iconPaths[name] || iconPaths.calendar}</svg>`;
  const validData = data => data && data.schema === 1 && typeof data.version === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(data.updated) && Array.isArray(data.groups) && data.groups.length > 0 && Array.isArray(data.lessons) && data.groups.every(g => typeof g.id === 'string' && Array.isArray(g.dates) && g.dates.length && Array.isArray(g.lessons) && g.lessons.every(i => Number.isInteger(i) && i >= 0 && i < data.lessons.length)) && data.lessons.every(l => /^\d{4}-\d{2}-\d{2}$/.test(l.date) && l.slot >= 1 && l.slot <= 7 && typeof l.subject === 'string');
  let data = window.RGATU_DATA;
  try { const cached = JSON.parse(read('rgatu.schedule', 'null')); if (validData(cached) && cached.updated >= data.updated) data = cached; } catch {}
  if (!validData(data)) {
    root.innerHTML = '<main class="page"><h1>Расписание не открылось</h1><p class="profile-info">Попробуй открыть приложение ещё раз.</p><button class="primary" onclick="location.reload()">Попробовать снова</button></main>';
    return;
  }
  const nowDate = () => time.dateInMoscow();
  let sharedGroups = time.memberships(data);
  const dateObject = date => new Date(`${date}T12:00:00+03:00`);
  const dateText = (date, options = {day:'numeric', month:'long'}) => new Intl.DateTimeFormat('ru-RU', {...options, timeZone:'Europe/Moscow'}).format(dateObject(date));
  const shiftDate = (date, amount) => { const d = new Date(date + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + amount); return d.toISOString().slice(0,10); };
  const plural = (n, forms) => `${n} ${forms[n % 100 >= 11 && n % 100 <= 14 ? 2 : n % 10 === 1 ? 0 : n % 10 >= 2 && n % 10 <= 4 ? 1 : 2]}`;
  const groupById = id => data.groups.find(g => g.id === id);
  let group = groupById(read('rgatu.group'));
  const initialDate = g => {
    const today = nowDate();
    if (today < g.dates[0]) return g.dates[0];
    if (today > g.dates.at(-1)) return g.dates.at(-1);
    return today;
  };
  const state = {date: group ? initialDate(group) : nowDate(), month:'', chosen: group?.id || '', course: '', query:'', limit:18, subject:'', theme:read('rgatu.theme','auto'), refreshing:false, bellKind:''};
  let installPrompt = null;
  let noticeTimer;
  function toast(message) {
    const node = document.getElementById('notice');
    node.textContent = message;
    node.classList.add('visible');
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => node.classList.remove('visible'), 4500);
  }
  const darkPreference = matchMedia('(prefers-color-scheme: dark)');
  function applyTheme() {
    const dark = state.theme === 'dark' || state.theme === 'auto' && darkPreference.matches;
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    document.querySelector('meta[name=theme-color]').content = dark ? '#111526' : '#f5f7fb';
  }
  applyTheme();
  darkPreference.addEventListener?.('change', applyTheme);
  function route() { return group ? ['day','calendar','search','profile','group','bells','consultations'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'day' : 'group'; }
  function go(page) { if (location.hash === '#' + page) render(); else location.hash = page; }
  function header() {
    return `<header class="topbar"><div class="brand"><div class="brand-mark" aria-hidden="true"><span>ФЗО</span></div><div><strong class="brand-title">Расписание ФЗО</strong><div class="brand-sub"><span class="unofficial-chip">неофициальное</span><span>от студента</span></div></div></div><button class="group-switch" data-action="group" aria-label="Сменить группу, сейчас ${escape(group.id)}"><span>${escape(group.id)}</span>${icon('down')}</button></header>`;
  }
  function nav(page) {
    return `<nav class="bottom-nav" aria-label="Главное меню">${[['day','calendar','Расписание'],['bells','clock','Звонки'],['profile','user','Группа']].map(([id,glyph,label]) => `<a class="nav-link" href="#${id}"${(page===id || id==='day' && ['calendar','search','consultations'].includes(page))?' aria-current="page"':''}>${icon(glyph)}<span>${label}</span></a>`).join('')}</nav>`;
  }
  function scheduleTabs(active) {
    return `<div class="schedule-switcher" role="tablist" aria-label="Раздел расписания"><button class="schedule-tab" role="tab" data-action="session" aria-selected="${active==='session'}" aria-controls="content"><span>Установочная сессия</span></button><button class="schedule-tab" role="tab" data-action="consultations" aria-selected="${active==='consultations'}" aria-controls="content"><span>Консультации</span></button></div>`;
  }
  function renderPicker() {
    root.innerHTML = `<div class="shell"><main class="page picker-page" id="content">${group ? `<div class="back-row"><button class="back-button" data-action="cancel-group">${icon('left')}Назад</button><span class="small muted">Моя группа</span></div>` : ''}<div class="intro"><div class="intro-mark"><div class="brand-mark" aria-hidden="true"><span>ФЗО</span></div><div><strong>Расписание ФЗО</strong><div class="small muted">РГАТУ им. П. А. Соловьёва</div></div></div><h1>${group ? 'Выбери свою группу' : 'Привет.<br>Какая у тебя группа?'}</h1><p>${group ? 'Новое расписание появится сразу после выбора.' : 'Выбери один раз. Дальше приложение будет сразу открывать расписание твоей группы.'}</p><div class="unofficial-card"><span class="unofficial-chip large">Неофициальное</span><p>Студенческий проект для ФЗО РГАТУ. Сделан студентом 1 курса и не является официальным приложением университета.</p></div></div><label for="group-search" class="label">Группа</label><div class="search-wrap">${icon('search')}<input id="group-search" class="search" type="search" placeholder="ЗВС-26" autocomplete="off" spellcheck="false" value="${escape(state.query)}" aria-controls="group-list"></div><div class="filters" aria-label="Фильтр по курсу">${[['','Все курсы'],['1','1 курс'],['2','2 курс'],['3','3 курс'],['4','4–5 курс']].map(([id,label]) => `<button class="filter" data-action="course" data-value="${id}" aria-pressed="${state.course===id}">${label}</button>`).join('')}</div><div id="group-results"></div></main><footer class="onboard-footer"><button class="primary" id="continue-group" data-action="save-group"${state.chosen?'':' disabled'}>${state.chosen ? 'Продолжить' : 'Выбери группу'}${icon('arrow')}</button></footer></div>`;
    updateGroupResults();
  }
  const normalized = text => text.toUpperCase().replace(/Ё/g,'Е').replace(/[^А-ЯA-Z0-9]/g,'');
  const keyboardLayout = text => text.toLowerCase().split('').map(c => ({q:'й',w:'ц',e:'у',r:'к',t:'е',y:'н',u:'г',i:'ш',o:'щ',p:'з',a:'ф',s:'ы',d:'в',f:'а',g:'п',h:'р',j:'о',k:'л',l:'д',z:'я',x:'ч',c:'с',v:'м',b:'и',n:'т',m:'ь'})[c] || c).join('');
  const filteredGroups = () => data.groups.filter(g => (!state.course || (state.course === '4' ? g.course >= 4 : g.course === Number(state.course))) && (!state.query || normalized(g.id).includes(normalized(state.query)) || normalized(g.id).includes(normalized(keyboardLayout(state.query)))));
  function updateGroupResults(focusId) {
    const matches = filteredGroups();
    const visible = matches.slice(0,state.limit);
    const selectedVisible = visible.some(g => g.id === state.chosen);
    document.getElementById('group-results').innerHTML = `<p class="results-count" role="status">${plural(matches.length,['группа','группы','групп'])}</p><div class="group-list" id="group-list" role="radiogroup" aria-label="Выберите группу">${visible.map((g,i) => `<button class="group-row" role="radio" aria-checked="${state.chosen===g.id}" tabindex="${state.chosen===g.id || !selectedVisible && i===0 ? '0' : '-1'}" data-action="choose-group" data-value="${escape(g.id)}"><div><div class="group-code">${escape(g.id)}</div><div class="group-hint">${g.course} курс · ${g.id.match(/-\d{2}-(\d)$/) ? 'подгруппа ' + g.id.at(-1) : 'заочное отделение'}</div></div><span class="choice-dot">${state.chosen===g.id?icon('check'):''}</span></button>`).join('')}</div>${matches.length>visible.length?`<button class="secondary show-more" data-action="more-groups">Показать ещё ${icon('down')}</button>`:''}${!matches.length?'<div class="empty"><h2>Такой группы здесь нет</h2><p>Проверь номер или выбери другой курс.</p><button class="secondary" data-action="reset-groups">Показать все группы</button></div>':''}`;
    const button = document.getElementById('continue-group');
    button.disabled = !state.chosen;
    button.innerHTML = `${state.chosen?'Продолжить':'Выбери группу'}${icon('arrow')}`;
    root.querySelectorAll('[data-action=course]').forEach(button => button.setAttribute('aria-pressed',String(button.dataset.value===state.course)));
    if (focusId) [...root.querySelectorAll('.group-row')].find(b => b.dataset.value === focusId)?.focus();
  }
  const groupLessons = () => group.lessons.map(i => data.lessons[i]).sort((a,b) => a.date.localeCompare(b.date) || a.slot-b.slot);
  const lessonsOn = date => groupLessons().filter(l => l.date === date);
  const mergeLessons = lessons => time.merge(lessons,sharedGroups);
  const typeLabel = type => ({'Л':'Лекция','П':'Практика','ЛР':'Лабораторная','К':'Консультация'})[type] || type || 'Занятие';
  function together(peers) {
    const others = peers.filter(id=>id!==group.id);
    return others.length ? `<p class="together">${icon('people')}<span>Вместе с ${others.map(escape).join(', ')}</span></p>` : '';
  }
  const rangeText = lesson => time.bells(lesson.date)[lesson.slots[0]-1][0]+'–'+time.bells(lesson.date)[lesson.slots.at(-1)-1][1];
  function lessonCards(lessons) {
    const focus = time.focus(groupLessons());
    return `<div class="lessons">${mergeLessons(lessons).map(l => {
      const current = focus?.current && l.ids.includes(focus.lesson.id);
      return `<article class="lesson${current?' lesson-current':''}" data-lesson-ids="${l.ids.join(',')}" aria-label="${l.slots.join(' и ')} ${l.slots.length===1?'пара':'пары'}, ${rangeText(l)}, ${escape(l.subject)}"><div class="slot"><strong>${l.slots.length===1?l.slots[0]:l.slots[0]+'–'+l.slots.at(-1)}</strong><span>${l.slots.length===1?'пара':'пары'}</span><span class="current-dot" aria-label="Идёт сейчас"${current?'':' hidden'}></span></div><div class="lesson-body"><div class="lesson-time"><span>${rangeText(l)}</span><span class="kind ${l.type==='П'?'practice':l.type==='ЛР'?'lab':''}">${escape(typeLabel(l.type))}</span><span class="current-word"${current?'':' hidden'}>Сейчас</span></div><h3>${escape(l.subject)}</h3><div class="lesson-details">${l.room?`<p class="room">${icon('room')}<span>${escape(l.room)}</span></p>`:''}${l.teacher?`<p class="teacher">${icon('user')}<span>${escape(l.teacher)}</span></p>`:''}</div>${together(l.peers)}</div></article>`;
    }).join('')}</div>`;
  }
  function renderFocus() {
    const today = nowDate();
    if (state.date!==today && !(today<group.dates[0] && state.date===group.dates[0])) return '';
    const focus = time.focus(groupLessons());
    if (!focus) return today<=group.dates.at(-1) ? '<div class="day-done">На сегодня всё. Можно выдохнуть.</div>' : '';
    const {lesson,current,minutes} = focus;
    const sameDay = lesson.date===today;
    const label = current ? `Сейчас · ${lesson.slot} пара` : sameDay ? `Следующая · ${lesson.slot} пара` : lesson.date===shiftDate(today,1) ? 'Пары завтра' : 'Ближайшие · '+dateText(lesson.date);
    const detail = current ? `До конца ${plural(minutes,['минута','минуты','минут'])}` : sameDay ? `В ${focus.time.start} · через ${plural(minutes,['минуту','минуты','минут'])}` : 'Начало в '+focus.time.start;
    return `<button class="live-summary${current?' is-current':''}" data-action="focus-lesson" data-value="${lesson.date}" data-lesson-id="${lesson.id}"><span class="live-symbol">${current?'<span class="current-dot"></span>':icon('clock')}</span><span class="live-copy"><strong>${escape(label)}</strong><span>${escape(detail)}</span></span>${icon('arrow')}</button>`;
  }
  function renderBells() {
    const weekend = (state.bellKind || (time.isWeekend(state.date)?'weekend':'weekday'))==='weekend';
    const rows = weekend ? time.weekend : time.weekday;
    return `<main class="page" id="content"><div class="screen-heading"><h1>Звонки</h1><p>Московское время</p></div><div class="segments" aria-label="Дни звонков">${[['weekday','Будни'],['weekend','Выходные']].map(([id,label])=>`<button data-action="bell-kind" data-value="${id}" aria-pressed="${weekend === (id==='weekend')}">${label}</button>`).join('')}</div><section class="bells-section"><h2>${weekend?'Суббота и воскресенье':'Понедельник — пятница'}</h2><ol class="bells-list">${rows.map(([start,end],i)=>`<li><span><strong>${i+1}</strong> пара</span><time>${start}–${end}</time></li>`).join('')}</ol></section><p class="section-note">${weekend?'В выходные третья пара начинается в 12:00.':'Большой перерыв после второй пары — 50 минут.'}</p></main>`;
  }
  function emptyDay() {
    const next = group.dates.find(date => date > state.date && lessonsOn(date).length);
    return `<div class="empty">${icon('book')}<h2>Пар нет</h2><p>${state.date > group.dates.at(-1) ? 'Сессия закончилась. Прошедшие дни доступны в календаре.' : state.date < group.dates[0] ? 'Сессия ещё не началась.' : 'Этот день свободен.'}</p>${next?`<button class="secondary" data-action="date" data-value="${next}">Ближайшие пары · ${escape(dateText(next,{day:'numeric',month:'short'}))} ${icon('arrow')}</button>`:`<button class="secondary" data-action="calendar">Открыть календарь ${icon('calendar')}</button>`}</div>`;
  }
  function renderDay() {
    const lessons = lessonsOn(state.date);
    const today = nowDate();
    const week = time.weekDates(state.date);
    const past = today > group.dates.at(-1);
    const future = today < group.dates[0];
    const relative = state.date===today ? 'Сегодня' : state.date===shiftDate(today,1) ? 'Завтра' : state.date===shiftDate(today,-1) ? 'Вчера' : '';
    const dayTime = lessons.length ? time.bounds(lessons[0]).start+'–'+time.bounds(lessons.at(-1)).end : 'Свободный день';
    return `<main class="page day-page" id="content">${scheduleTabs('session')}<section class="day-controls" aria-label="Выбор дня"><div class="date-pager"><button class="icon-button" data-action="prev-day" aria-label="Предыдущий день">${icon('left')}</button><button class="date-title" data-action="calendar" aria-label="Открыть календарь, ${escape(dateText(state.date))}"><span class="day-caption">${relative?relative+' · ':''}${escape(dateText(state.date,{weekday:'long'}))}</span><h1>${escape(dateText(state.date))}${icon('down')}</h1></button><button class="icon-button" data-action="next-day" aria-label="Следующий день">${icon('right')}</button></div><div class="week" aria-label="Дни недели">${week.map(date=>`<button class="day${date===today?' is-today':''}" data-action="date" data-value="${date}"${date===state.date?' aria-current="date"':''} aria-label="${escape(dateText(date,{weekday:'long',day:'numeric',month:'long'}))}, ${plural(lessonsOn(date).length,['пара','пары','пар'])}"><span class="day-name">${escape(dateText(date,{weekday:'short'}))}</span><span class="day-number">${Number(date.slice(-2))}</span><span class="day-dot ${lessonsOn(date).length?'':'no-lessons'}"></span></button>`).join('')}</div><div class="day-tools"><button class="text-button" data-action="calendar">${icon('calendar')}Календарь</button><button class="text-button" data-action="today"${state.date===today?' disabled':''}>Сегодня</button><button class="icon-button search-button" data-action="search" aria-label="Найти предмет, преподавателя или аудиторию">${icon('search')}</button></div></section>${past?'<p class="source-banner">Прошедшая сессия · расписание сохранено</p>':future?`<p class="source-banner">Сессия с ${escape(dateText(group.dates[0]))}</p>`:''}<div id="live-focus">${renderFocus()}</div><div class="date-description"><h2>${lessons.length?plural(lessons.length,['пара','пары','пар']):'Твой день'}</h2><span>${dayTime}</span></div>${lessons.length?lessonCards(lessons):emptyDay()}<p class="time-note">Московское время</p></main>`;
  }
  function renderCalendar() {
    const month = state.month || state.date.slice(0,7);
    const today = nowDate();
    return `<main class="page" id="content"><div class="back-row"><button class="back-button" data-action="back-day">${icon('left')}К расписанию</button><button class="text-button" data-action="calendar-today">Этот месяц</button></div><div class="month-pager"><button class="icon-button" data-action="prev-month" aria-label="Предыдущий месяц">${icon('left')}</button><h1>${escape(dateText(month+'-01',{month:'long',year:'numeric'}))}</h1><button class="icon-button" data-action="next-month" aria-label="Следующий месяц">${icon('right')}</button></div><div class="month-weekdays" aria-hidden="true">${['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map(day=>`<span>${day}</span>`).join('')}</div><div class="month-grid" aria-label="Календарь ${escape(dateText(month+'-01',{month:'long',year:'numeric'}))}">${time.monthDates(month).map(date=>`<button class="month-day${date.slice(0,7)!==month?' outside-month':''}${date===today?' is-today':''}" data-action="date" data-value="${date}"${date===state.date?' aria-current="date"':''} aria-label="${escape(dateText(date,{weekday:'long',day:'numeric',month:'long'}))}, ${plural(lessonsOn(date).length,['пара','пары','пар'])}"><span>${Number(date.slice(-2))}</span><span class="day-dot ${lessonsOn(date).length?'':'no-lessons'}"></span></button>`).join('')}</div><p class="calendar-legend"><span class="day-dot"></span>Дни с парами</p><button class="period-card" data-action="date" data-value="${group.dates[0]}"><span>${icon('book')}Установочная сессия</span><strong>${escape(dateText(group.dates[0]))} — ${escape(dateText(group.dates.at(-1)))}</strong><span>${group.course} курс · ${escape(group.id)} ${icon('arrow')}</span></button></main>`;
  }
  function renderSearch() {
    return `<main class="page" id="content"><div class="back-row"><button class="back-button" data-action="back-day">${icon('left')}К расписанию</button></div><div class="screen-heading"><h1>Найти пару</h1><p>В расписании твоей группы</p></div><label class="label" for="subject-search">Предмет, преподаватель или аудитория</label><div class="search-wrap">${icon('search')}<input id="subject-search" class="search" type="search" placeholder="Что ищем?" value="${escape(state.subject)}" aria-controls="search-results" autocomplete="off"></div><div id="search-results"></div></main>`;
  }
  function updateSearchResults() {
    const query = state.subject.trim().toLowerCase();
    const target = document.getElementById('search-results');
    if (!query) {
      const subjects = [...new Set(groupLessons().map(lesson=>lesson.subject))];
      target.innerHTML = `<h2 class="subjects-heading">Твои предметы</h2><div class="subject-list">${subjects.map(subject=>`<button class="subject-row" data-action="search-subject" data-value="${escape(subject)}"><span>${escape(subject)}</span>${icon('right')}</button>`).join('')}</div>`;
      return;
    }
    const matching = groupLessons().filter(l => (l.subject+' '+l.teacher+' '+l.room).toLowerCase().includes(query));
    const dates = [...new Set(matching.map(l=>l.date))];
    target.innerHTML = matching.length ? `<p class="results-count" role="status">${plural(matching.length,['пара','пары','пар'])} · ${plural(dates.length,['день','дня','дней'])}</p>${dates.map(date => `<section class="day-group"><div class="day-group-heading"><button data-action="date" data-value="${date}"><strong>${escape(dateText(date))}</strong><span>${escape(dateText(date,{weekday:'long'}))}</span></button><button class="icon-button" data-action="date" data-value="${date}" aria-label="Открыть день ${escape(dateText(date))}">${icon('arrow')}</button></div>${lessonCards(matching.filter(l=>l.date===date))}</section>`).join('')}` : '<div class="empty"><h2>Ничего не нашлось</h2><p>Попробуй название покороче или фамилию.</p><button class="secondary" data-action="reset-subject">Очистить поиск</button></div>';
  }
  function ensureConsultations() {
    if (consultations || consultationsLoading || consultationsFailed || !window.RGATU_CONSULTATIONS_PROMISE) return;
    consultationsLoading = true;
    Promise.resolve(window.RGATU_CONSULTATIONS_PROMISE).then(value => {
      if (!value || value.schema !== 1 || !Array.isArray(value.groups) || !Array.isArray(value.events)) throw new Error('invalid consultations');
      consultations = value;
      consultationsLoading = false;
      if (route() === 'consultations') render();
    }).catch(() => {
      consultationsLoading = false;
      consultationsFailed = true;
      if (route() === 'consultations') render();
    });
  }
  const consultationMinutes = value => {
    const parts = String(value || '').split(':');
    return Number(parts[0]) * 60 + Number(parts[1] || 0);
  };
  function renderConsultations() {
    ensureConsultations();
    const tabs = scheduleTabs('consultations');
    if (consultationsFailed || !window.RGATU_CONSULTATIONS_PROMISE) {
      return '<main class="page consultations-page" id="content">' + tabs + '<div class="screen-heading"><h1>Консультации</h1><p>Отдельный график ФЗО</p></div><div class="empty">' + icon('book') + '<h2>Не удалось открыть</h2><p>Установочная сессия продолжает работать. Попробуй открыть консультации позже.</p></div></main>';
    }
    if (!consultations) {
      return '<main class="page consultations-page" id="content">' + tabs + '<div class="screen-heading"><h1>Консультации</h1><p>Загружаем отдельный график…</p></div><div class="day-done">Подготавливаем архив консультаций.</div></main>';
    }
    const sourceGroup = consultations.groups.find(item => item.id === group.id);
    const events = sourceGroup ? sourceGroup.events.map(index => consultations.events[index]).filter(Boolean).sort((a,b) => a.date.localeCompare(b.date) || consultationMinutes(a.time) - consultationMinutes(b.time)) : [];
    const archived = consultations.events.length && consultations.events.every(item => item.date < nowDate());
    const intro = '<div class="screen-heading schedule-heading"><div><span class="eyebrow">Расписание ФЗО</span><h1>Консультации</h1><p>' + escape(group.id) + '</p></div></div><p class="source-banner">' + (archived ? 'Архив · ' : '') + 'график обновлён ' + escape(dateText(consultations.updated)) + '. Это отдельный раздел расписания.</p>';
    if (!events.length) {
      return '<main class="page consultations-page" id="content">' + tabs + intro + '<div class="empty">' + icon('book') + '<h2>Для ' + escape(group.id) + ' консультаций нет</h2><p>В последнем загруженном графике эта группа отсутствует. Установочная сессия доступна в соседней вкладке.</p></div></main>';
    }
    const dates = [...new Set(events.map(item => item.date))];
    const body = dates.map(date => {
      const rows = events.filter(item => item.date === date);
      const cards = rows.map(item => '<article class="consult-card"><div class="consult-time">' + escape(item.time) + '</div><div class="consult-body"><span class="kind">Консультация</span><h3>' + escape(item.subject) + '</h3><div class="lesson-details">' + (item.room ? '<p class="room">' + icon('room') + '<span>' + escape(item.room) + '</span></p>' : '') + (item.teacher ? '<p class="teacher">' + icon('user') + '<span>' + escape(item.teacher) + '</span></p>' : '') + '</div>' + (item.note ? '<p class="consult-note">' + escape(item.note) + '</p>' : '') + '</div></article>').join('');
      return '<section class="consult-day"><div class="consult-day-head"><h2>' + escape(dateText(date,{day:'numeric',month:'long'})) + '</h2><span>' + escape(dateText(date,{weekday:'long'})) + '</span></div><div class="consult-list">' + cards + '</div></section>';
    }).join('');
    return '<main class="page consultations-page" id="content">' + tabs + intro + body + '</main>';
  }

  function renderProfile() {
    const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
    return `<main class="page" id="content"><div class="screen-heading"><h1>Моя группа</h1></div><section class="profile-group"><div><h2>${escape(group.id)}</h2><p>${group.course} курс · заочное отделение</p></div><button class="secondary" data-action="group">Сменить ${icon('right')}</button></section><section class="profile-period"><span>Установочная сессия</span><strong>${escape(dateText(group.dates[0]))} — ${escape(dateText(group.dates.at(-1)))}</strong><button class="text-button" data-action="calendar">Открыть календарь ${icon('arrow')}</button></section><section class="settings" aria-label="Настройки"><div class="theme-setting"><h2>Оформление</h2><div class="segments" aria-label="Оформление">${[['auto','Авто'],['light','Светлое'],['dark','Тёмное']].map(([id,label])=>`<button data-action="theme" data-value="${id}" aria-pressed="${state.theme===id}">${label}</button>`).join('')}</div></div><div class="settings-row"><div><h2>Расписание</h2><p>Обновлено ${escape(dateText(data.updated))}</p></div><button class="icon-button" data-action="refresh" aria-label="Обновить расписание"${state.refreshing?' disabled':''}>${icon('refresh')}</button></div>${isAndroid?`<button class="link-row" data-action="app-update"><span>Проверить обновления приложения</span>${icon('refresh')}</button>`:''}</section>${!isAndroid&&!standalone?`<section class="install-block"><h2>Расписание на главном экране</h2><p>Открывай одним касанием.</p><button class="primary" data-action="install">Добавить на главный экран ${icon('download')}</button><div id="install-guide"></div><a class="link-row" href="${DOWNLOAD_URL}"><span>Скачать для Android</span>${icon('right')}</a></section>`:''}<section class="about-card"><div class="about-head"><span class="unofficial-chip large">Неофициальное</span><h2>Студенческий проект ФЗО</h2></div><p>Сделано студентом 1 курса РГАТУ для удобного просмотра расписания. Это не официальный сервис университета.</p><a class="link-row" href="https://www.rsatu.ru/zaochnoe/"><span>Официальный раздел «Заочное обучение»<small>Сайт РГАТУ</small></span>${icon('arrow')}</a><a class="link-row" href="https://t.me/falseheat"><span>Смирнов Иван · @falseheat<small>Связь, идеи и ошибки в расписании</small></span>${icon('arrow')}</a></section></main>`;
  }
  function render() {
    const page = route();
    if (page === 'group') {renderPicker(); return;}
    const screens = {day:renderDay,calendar:renderCalendar,search:renderSearch,bells:renderBells,profile:renderProfile,consultations:renderConsultations};
    root.innerHTML = `<div class="shell">${header()}${screens[page]()}${nav(page)}</div>`;
    if (page === 'search') updateSearchResults();
  }
  function selectDate(date) {
    state.date = date;
    state.month = date.slice(0,7);
    state.bellKind = '';
    go('day');
    window.scrollTo(0,0);
  }
  function openCalendar() { state.month=state.date.slice(0,7);go('calendar');window.scrollTo(0,0); }
  async function refreshSchedule(userInitiated = false) {
    if (state.refreshing) return;
    if (!navigator.onLine) { if(userInitiated) toast('Сейчас нет интернета. Сохранённое расписание уже доступно.'); return; }
    state.refreshing = true;
    const button = root.querySelector('[data-action=refresh]');
    if (button) button.disabled = true;
    const controller = new AbortController();
    const timeout = setTimeout(()=>controller.abort(),8000);
    try {
      const response = await fetch('/api/schedule',{cache:'no-store',signal:controller.signal});
      if (!response.ok) throw new Error('schedule unavailable');
      const updated = await response.json();
      if (!validData(updated)) throw new Error('invalid schedule');
      if (updated.version !== data.version) {
        const selectedId = group?.id;
        const nextGroup = selectedId ? updated.groups.find(g=>g.id===selectedId) : null;
        // Retain a usable selected schedule if a new publication omits that group.
        if (selectedId && !nextGroup) { if(userInitiated) toast('Нового расписания для твоей группы пока нет.'); return; }
        data = updated;
        sharedGroups = time.memberships(data);
        write('rgatu.schedule',JSON.stringify(data));
        if (selectedId) group = nextGroup;
        render();
        if (userInitiated) toast('Расписание обновлено.');
      } else if (userInitiated) toast('У тебя уже последнее расписание.');
    } catch {
      if(userInitiated) toast('Не удалось обновить. Сохранённое расписание можно смотреть как обычно.');
    } finally {
      clearTimeout(timeout);
      state.refreshing = false;
      const button = root.querySelector('[data-action=refresh]');
      if (button) button.disabled = false;
    }
  }
  root.addEventListener('input', event => {
    if (event.target.id === 'group-search') {state.query=event.target.value;state.limit=18;updateGroupResults();}
    if (event.target.id === 'subject-search') {state.subject=event.target.value;updateSearchResults();}
  });
  root.addEventListener('keydown', event => {
    if (!event.target.matches('.group-row') || !['ArrowDown','ArrowUp','ArrowRight','ArrowLeft','Home','End'].includes(event.key)) return;
    event.preventDefault();
    const rows = [...root.querySelectorAll('.group-row')];
    const index = rows.indexOf(event.target);
    const nextIndex = event.key === 'Home' ? 0 : event.key === 'End' ? rows.length-1 : (index + (['ArrowDown','ArrowRight'].includes(event.key)?1:-1) + rows.length) % rows.length;
    state.chosen = rows[nextIndex].dataset.value;
    updateGroupResults(state.chosen);
  });
  root.addEventListener('click', async event => {
    const button = event.target.closest('[data-action]');
    if (!button || button.disabled) return;
    const value = button.dataset.value;
    switch(button.dataset.action) {
      case 'choose-group': state.chosen=value;updateGroupResults(value);break;
      case 'save-group': {
        const chosen = groupById(state.chosen);
        if(!chosen) return;
        group = chosen;state.date=initialDate(group);state.month='';state.subject='';state.bellKind='';
        const saved = write('rgatu.group',group.id);
        go('day');window.scrollTo(0,0);
        if(!saved) toast('Группу не удалось запомнить на этом устройстве.');
        break;
      }
      case 'group': state.chosen=group.id;state.course='';state.query='';state.limit=18;go('group');window.scrollTo(0,0);break;
      case 'cancel-group': go('day');break;
      case 'course': state.course=value;state.limit=18;updateGroupResults();break;
      case 'more-groups': state.limit+=18;updateGroupResults();break;
      case 'reset-groups': state.course='';state.query='';state.limit=18;document.getElementById('group-search').value='';updateGroupResults();break;
      case 'today': selectDate(nowDate());break;
      case 'date': selectDate(value);break;
      case 'prev-day': selectDate(shiftDate(state.date,-1));break;
      case 'next-day': selectDate(shiftDate(state.date,1));break;
      case 'calendar': openCalendar();break;
      case 'calendar-today': state.month=nowDate().slice(0,7);render();break;
      case 'prev-month': state.month=time.shiftMonth(state.month || state.date.slice(0,7),-1);render();break;
      case 'next-month': state.month=time.shiftMonth(state.month || state.date.slice(0,7),1);render();break;
      case 'back-day': go('day');break;
      case 'session': go('day');window.scrollTo(0,0);break;
      case 'profile': go('profile');window.scrollTo(0,0);break;
      case 'consultations': go('consultations');window.scrollTo(0,0);break;
      case 'bells': go('bells');window.scrollTo(0,0);break;
      case 'bell-kind': state.bellKind=value;render();break;
      case 'search': state.subject='';go('search');window.scrollTo(0,0);break;
      case 'search-subject': state.subject=value;document.getElementById('subject-search').value=value;updateSearchResults();break;
      case 'reset-subject': state.subject='';document.getElementById('subject-search').value='';updateSearchResults();break;
      case 'theme': state.theme=value;write('rgatu.theme',state.theme);applyTheme();root.querySelectorAll('[data-action=theme]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.value===value)));break;
      case 'focus-lesson': {
        selectDate(value);
        // A hash navigation renders on the next event-loop turn.
        setTimeout(()=>[...root.querySelectorAll('[data-lesson-ids]')].find(card=>card.dataset.lessonIds.split(',').includes(button.dataset.lessonId))?.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'}),0);
        break;
      }
      case 'app-update': if(window.RgatuApp?.checkUpdates) window.RgatuApp.checkUpdates();else location.href=DOWNLOAD_URL;break;
      case 'refresh': await refreshSchedule(true);break;
      case 'install':
        if(installPrompt) {await installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;}
        else {const guide=document.getElementById('install-guide');if(guide) guide.textContent=/iPad|iPhone|iPod/.test(navigator.userAgent)?'Нажми «Поделиться» в браузере, затем «На экран Домой».':'Открой меню браузера и выбери «Установить приложение» или «Добавить на главный экран».';}
        break;
    }
  });
  let swipeStart = null;
  root.addEventListener('touchstart',event=>{
    if (route()!=='day' || event.touches.length!==1 || event.target.closest('button,a,input,.week')) {swipeStart=null;return;}
    swipeStart={x:event.touches[0].clientX,y:event.touches[0].clientY};
  },{passive:true});
  root.addEventListener('touchend',event=>{
    if (!swipeStart || route()!=='day' || !event.changedTouches.length) return;
    const dx=event.changedTouches[0].clientX-swipeStart.x, dy=event.changedTouches[0].clientY-swipeStart.y;
    swipeStart=null;
    if (Math.abs(dx)>72 && Math.abs(dx)>Math.abs(dy)*1.8) selectDate(shiftDate(state.date,dx<0?1:-1));
  },{passive:true});
  root.addEventListener('touchcancel',()=>{swipeStart=null;},{passive:true});
  window.addEventListener('hashchange',()=>{render();window.scrollTo(0,0);});
  window.addEventListener('beforeinstallprompt', event => {event.preventDefault();installPrompt=event;});
  window.addEventListener('appinstalled',()=>{toast('Теперь расписание на главном экране.');if(route()==='profile')render();});
  window.addEventListener('online',()=>refreshSchedule());
  function updateClock() {
    if (document.hidden || !group || route()!=='day') return;
    const live = document.getElementById('live-focus');
    if (live && !live.contains(document.activeElement)) live.innerHTML=renderFocus();
    const current=time.focus(groupLessons());
    root.querySelectorAll('.lesson[data-lesson-ids]').forEach(card=>{
      const active=Boolean(current?.current && card.dataset.lessonIds.split(',').includes(String(current.lesson.id)));
      card.classList.toggle('lesson-current',active);
      card.querySelectorAll('.current-dot,.current-word').forEach(mark=>{mark.hidden=!active;});
    });
  }
  setInterval(updateClock,30000);
  document.addEventListener('visibilitychange',updateClock);
  render();
  if(!isAndroid && 'serviceWorker' in navigator) {
    const wasControlled = Boolean(navigator.serviceWorker.controller);
    navigator.serviceWorker.register('./sw.js').then(registration=>{
      if(registration.waiting) registration.waiting.postMessage('ACTIVATE');
      registration.addEventListener('updatefound',()=>{const worker=registration.installing;worker?.addEventListener('statechange',()=>{if(worker.state==='installed'&&navigator.serviceWorker.controller)worker.postMessage('ACTIVATE');});});
    }).catch(()=>{});
    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange',()=>{if(wasControlled&&!reloading&&navigator.serviceWorker.controller){reloading=true;location.reload();}});
  }
  refreshSchedule();
})();
