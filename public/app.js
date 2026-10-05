(() => {
  'use strict';
  const APP_VERSION = '1.1.0';
  const DOWNLOAD_URL = 'https://ivan-s-2001.github.io/rgatu-schedule/';
  const time = window.RGATU_TIME;
  const root = document.getElementById('app');
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
  const state = {date: group ? initialDate(group) : nowDate(), chosen: group?.id || '', course: '', query:'', limit:18, subject:'', kind:'', theme:read('rgatu.theme','auto'), refreshing:false};
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
    document.querySelector('meta[name=theme-color]').content = dark ? '#1d1f1c' : '#f6f5f1';
  }
  applyTheme();
  darkPreference.addEventListener?.('change', applyTheme);
  function route() { return group ? ['day','session','profile','group','bells'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'day' : 'group'; }
  function go(page) { if (location.hash === '#' + page) render(); else location.hash = page; }
  function header() {
    return `<header class="topbar"><div class="brand"><div class="brand-mark" aria-hidden="true">Р</div><div>РГАТУ Пары<div class="brand-sub">от студента студентам</div></div></div><button class="group-switch" data-action="group" aria-label="Сменить группу, сейчас ${escape(group.id)}"><span>${escape(group.id)}</span>${icon('down')}</button></header>`;
  }
  function nav(page) {
    return `<nav class="bottom-nav" aria-label="Главное меню">${[['day','calendar','Расписание'],['session','list','Сессия'],['profile','user','Моя группа']].map(([id,glyph,label]) => `<a class="nav-link" href="#${id}"${page===id?' aria-current="page"':''}>${icon(glyph)}<span>${label}</span></a>`).join('')}</nav>`;
  }
  function renderPicker() {
    root.innerHTML = `<div class="shell"><main class="page" id="content">${group ? `<div class="back-row"><button class="back-button" data-action="cancel-group">${icon('left')}Назад</button><span class="small muted">Моя группа</span></div>` : ''}<div class="intro"><div class="intro-mark"><div class="brand-mark" aria-hidden="true">Р</div><div><strong>РГАТУ Пары</strong><div class="small muted">от студента студентам</div></div></div><h1>${group ? 'Выбери свою группу' : 'Привет.<br>Какая у тебя группа?'}</h1><p>${group ? 'Новое расписание появится сразу после выбора.' : 'Выбери один раз. Дальше приложение будет сразу открывать твои пары.'}</p></div><label for="group-search" class="label">Группа</label><div class="search-wrap">${icon('search')}<input id="group-search" class="search" type="search" placeholder="Например, ЗВС-26" autocomplete="off" spellcheck="false" value="${escape(state.query)}" aria-controls="group-list"></div><div class="filters" aria-label="Фильтр по курсу">${[['','Все курсы'],['1','1 курс'],['2','2 курс'],['3','3 курс'],['4','4–5 курс']].map(([id,label]) => `<button class="filter" data-action="course" data-value="${id}" aria-pressed="${state.course===id}">${label}</button>`).join('')}</div><div id="group-results"></div></main><footer class="onboard-footer"><button class="primary" id="continue-group" data-action="save-group"${state.chosen?'':' disabled'}>${state.chosen ? `Продолжить с ${escape(state.chosen)}` : 'Выбери группу'}${icon('arrow')}</button><p class="small muted">Неофициальное приложение. Сделано студентом.</p></footer></div>`;
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
    button.innerHTML = `${state.chosen?`Продолжить с ${escape(state.chosen)}`:'Выбери группу'}${icon('arrow')}`;
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
      return `<article class="lesson${current?' lesson-current':''}" data-lesson-ids="${l.ids.join(',')}" aria-label="${l.slots.join(' и ')} ${l.slots.length===1?'пара':'пары'}, ${rangeText(l)}, ${escape(l.subject)}"><div class="slot"><strong>${l.slots.length===1?l.slots[0]:l.slots[0]+'–'+l.slots.at(-1)}</strong><span>${l.slots.length===1?'пара':'пары'}</span><span class="current-dot" aria-label="Идёт сейчас"${current?'':' hidden'}></span></div><div class="lesson-body"><div class="lesson-time">${icon('clock')}<span>${rangeText(l)}</span><span class="current-word"${current?'':' hidden'}>Сейчас</span></div><div class="lesson-top"><span class="kind ${l.type==='П'?'practice':l.type==='ЛР'?'lab':''}">${escape(typeLabel(l.type))}</span>${l.room?`<span class="room">${icon('room')}<span>${escape(l.room)}</span></span>`:''}</div><h3>${escape(l.subject)}</h3>${l.teacher?`<p class="teacher">${icon('user')}<span>${escape(l.teacher)}</span></p>`:''}${together(l.peers)}</div></article>`;
    }).join('')}</div>`;
  }
  function renderFocus() {
    const today = nowDate();
    if (state.date!==today && !(today<group.dates[0] && state.date===group.dates[0])) return '';
    const focus = time.focus(groupLessons());
    if (!focus) return today<=group.dates.at(-1) ? '<div class="day-done"><strong>На сегодня всё</strong><p>Все пары этой сессии позади.</p></div>' : '';
    const {lesson,current,minutes} = focus;
    const sameDay = lesson.date===today;
    const label = current ? 'Сейчас на паре' : sameDay ? 'Следующая пара' : lesson.date===shiftDate(today,1) ? 'Завтра' : dateText(lesson.date);
    const countdown = current ? `До конца · ${minutes} мин` : sameDay ? `Через ${plural(minutes,['минуту','минуты','минут'])}` : 'Начало в '+focus.time.start;
    return `<section class="focus-card${current?' is-current':''}" aria-label="${label}"><div class="focus-heading"><span class="focus-label">${current?'<span class="current-dot"></span>':icon('clock')}${escape(label)}</span><span class="focus-countdown" aria-live="off">${countdown}</span></div><div class="focus-meta">${lesson.slot} пара · ${focus.time.start}–${focus.time.end}</div><h2>${escape(lesson.subject)}</h2><div class="focus-details">${lesson.room?`<span>${icon('room')}Ауд. ${escape(lesson.room)}</span>`:''}${lesson.teacher?`<span>${escape(lesson.teacher)}</span>`:''}</div>${together(sharedGroups.get(lesson.id)||[])}${!sameDay?`<button class="focus-link" data-action="date" data-value="${lesson.date}">Открыть этот день ${icon('arrow')}</button>`:''}</section>`;
  }
  function renderBells() {
    const selected = time.isWeekend(state.date);
    return `<main class="page" id="content"><div class="back-row"><button class="back-button" data-action="back-bells">${icon('left')}Назад</button></div><p class="eyebrow">Время каждой пары</p><h1 style="margin-top:8px">Расписание звонков</h1><p class="small muted" style="margin-top:8px">Московское время</p>${[[time.weekday,'По будням','Понедельник — пятница',!selected],[time.weekend,'По выходным','Суббота и воскресенье',selected]].map(([rows,title,hint,active])=>`<section class="bells-section"><div class="bells-heading"><div><h2>${title}</h2><p class="small muted">${hint}</p></div>${active?'<span class="kind practice">Для выбранного дня</span>':''}</div><ol class="bells-list">${rows.map(([start,end],i)=>`<li><span><strong>${i+1}</strong> пара</span><time>${start}–${end}</time></li>`).join('')}</ol></section>`).join('')}</main>`;
  }
  function emptyDay() {
    const next = group.dates.find(date => date > state.date && lessonsOn(date).length);
    return `<div class="empty">${icon('book')}<h2>На этот день пар нет</h2><p>${state.date > group.dates.at(-1) ? 'Эта сессия уже закончилась. Её расписание осталось во вкладке «Сессия».' : state.date < group.dates[0] ? 'Сессия ещё не началась.' : 'Можно выдохнуть. Или посмотреть следующий учебный день.'}</p>${next?`<button class="secondary" data-action="date" data-value="${next}">К ${escape(dateText(next))} ${icon('arrow')}</button>`:`<button class="secondary" data-action="session">Посмотреть сессию ${icon('arrow')}</button>`}</div>`;
  }
  function renderDay() {
    const lessons = lessonsOn(state.date);
    const today = nowDate();
    const weekday = (dateObject(state.date).getUTCDay() + 6) % 7;
    const monday = shiftDate(state.date,-weekday);
    const past = today > group.dates.at(-1);
    const future = today < group.dates[0];
    return `<main class="page" id="content"><div class="page-head"><div><p class="eyebrow">${state.date===today?'Сегодня':escape(dateText(state.date,{weekday:'long'}))}</p><h1 style="margin-top:8px">${escape(dateText(state.date))}</h1><p class="small muted">${group.course} курс · установочная сессия</p></div><button class="today-button" data-action="today">Сегодня</button></div>${past?'<div class="source-banner">Эта сессия закончилась. Здесь можно посмотреть прошедшие занятия.</div>':future?`<div class="source-banner">Сессия начнётся ${escape(dateText(group.dates[0]))}.</div>`:''}<div class="date-nav"><button class="icon-button" data-action="prev-day" aria-label="Предыдущий день">${icon('left')}</button><label class="visually-hidden" for="day-picker">Дата расписания</label><input class="date-field" id="day-picker" type="date" value="${state.date}"><button class="icon-button" data-action="next-day" aria-label="Следующий день">${icon('right')}</button></div><div class="week" aria-label="Дни недели">${Array.from({length:7},(_,i)=>shiftDate(monday,i)).map(date=>`<button class="day" data-action="date" data-value="${date}"${date===state.date?' aria-current="date"':''} aria-label="${escape(dateText(date,{weekday:'long',day:'numeric',month:'long'}))}${lessonsOn(date).length?', есть занятия':', без занятий'}"><span class="day-name">${escape(dateText(date,{weekday:'short'}))}</span><span class="day-number">${Number(date.slice(-2))}</span><span class="day-dot ${lessonsOn(date).length?'':'no-lessons'}"></span></button>`).join('')}</div><div id="live-focus">${renderFocus()}</div><div class="date-description"><h2>Твои пары</h2><span class="small muted">${plural(lessons.length,['пара','пары','пар'])}</span></div><button class="bells-shortcut" data-action="bells">${icon('clock')}<span>Звонки · ${time.isWeekend(state.date)?'выходные':'будни'}</span>${icon('right')}</button>${lessons.length?lessonCards(lessons):emptyDay()}<p class="time-note">Московское время</p><p class="section-note">Расписание от ${escape(dateText(data.updated))}</p></main>`;
  }
  function renderSession() {
    const dates = group.dates;
    const lessons = groupLessons();
    return `<main class="page" id="content"><p class="eyebrow">Осень 2026</p><h1 style="margin-top:8px">Установочная сессия</h1><p class="small muted" style="margin-top:8px">${escape(dateText(dates[0]))} — ${escape(dateText(dates.at(-1)))} · московское время</p><div class="stat-line"><div><strong>${lessons.length}</strong><span>пар за сессию</span></div><div><strong>${dates.filter(d=>lessonsOn(d).length).length}</strong><span>учебных дней</span></div></div><div class="session-search"><label class="label" for="subject-search">Найти предмет или преподавателя</label><div class="search-wrap">${icon('search')}<input id="subject-search" class="search" type="search" placeholder="Что ищем?" value="${escape(state.subject)}" aria-controls="session-results"></div></div><div class="filters" aria-label="Вид занятия">${[['','Все пары'],['Л','Лекции'],['П','Практики'],['ЛР','Лабораторные']].map(([id,label])=>`<button class="filter" data-action="kind" data-value="${id}" aria-pressed="${state.kind===id}">${label}</button>`).join('')}</div><div id="session-results"></div></main>`;
  }
  function updateSessionResults() {
    const matching = groupLessons().filter(l => (!state.kind || l.type===state.kind) && (!state.subject || (l.subject+' '+l.teacher+' '+l.room).toLowerCase().includes(state.subject.toLowerCase().trim())));
    const dates = [...new Set(matching.map(l=>l.date))];
    document.getElementById('session-results').innerHTML = matching.length ? dates.map(date => `<section class="day-group"><div class="day-group-heading"><button data-action="date" data-value="${date}"><h2>${escape(dateText(date))}</h2><span class="small muted">${escape(dateText(date,{weekday:'long'}))}</span></button><span class="small muted">${plural(matching.filter(l=>l.date===date).length,['пара','пары','пар'])}</span></div>${lessonCards(matching.filter(l=>l.date===date))}</section>`).join('') : '<div class="empty"><h2>Ничего не нашлось</h2><p>Попробуй другое название или убери фильтр.</p><button class="secondary" data-action="reset-subject">Показать все пары</button></div>';
    root.querySelectorAll('[data-action=kind]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.value===state.kind)));
  }
  function renderProfile() {
    const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
    return `<main class="page" id="content"><p class="eyebrow">Всё под рукой</p><h1 style="margin-top:8px">Моя группа</h1><section class="profile-group"><p class="eyebrow">Твоя группа</p><h2>${escape(group.id)}</h2><p class="small">${group.course} курс · заочное отделение</p><button class="secondary" data-action="group">Сменить группу ${icon('arrow')}</button></section><section class="settings" aria-label="Настройки"><div class="settings-row"><div><label for="theme" class="label" style="margin:0">Оформление</label><p>Как тебе удобнее</p></div><select id="theme">${[['auto','Как на телефоне'],['light','Светлое'],['dark','Тёмное']].map(([id,label])=>`<option value="${id}"${state.theme===id?' selected':''}>${label}</option>`).join('')}</select></div><div class="settings-row"><div><h2 style="font-size:1rem">Расписание</h2><p>От ${escape(dateText(data.updated))}</p></div><button class="icon-button" data-action="refresh" aria-label="Обновить расписание"${state.refreshing?' disabled':''}>${icon('refresh')}</button></div><a class="link-row" href="#session"><span>Все занятия сессии</span>${icon('right')}</a><button class="link-row" data-action="bells"><span>Расписание звонков</span>${icon('right')}</button>${isAndroid?`<a class="link-row" href="${DOWNLOAD_URL}"><span>Обновить приложение</span>${icon('right')}</a>`:''}</section>${!isAndroid&&!standalone?`<section class="install-block"><h2>Пары на главном экране</h2><p>Открывай одним касанием, как обычное приложение.</p><button class="primary" data-action="install">Добавить на главный экран ${icon('download')}</button><div id="install-guide"></div><a class="link-row" href="${DOWNLOAD_URL}"><span>Скачать для Android</span>${icon('right')}</a></section>`:''}<div class="profile-info"><p>Привет! Это приложение от студента для студентов РГАТУ. Чтобы искать свои пары было чуть проще.</p><p>Здесь расписание установочной сессии, время пар и аудитории. Если занятие общее, под ним указаны соседние группы.</p></div><p class="section-note">РГАТУ Пары</p></main>`;
  }
  function render() {
    const page = route();
    if (page === 'group') {renderPicker(); return;}
    root.innerHTML = `<div class="shell">${header()}${page==='day'?renderDay():page==='session'?renderSession():page==='bells'?renderBells():renderProfile()}${nav(page)}</div>`;
    if (page === 'session') updateSessionResults();
  }
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
    if (event.target.id === 'subject-search') {state.subject=event.target.value;updateSessionResults();}
  });
  root.addEventListener('change', event => {
    if(event.target.id === 'day-picker' && /^\d{4}-\d{2}-\d{2}$/.test(event.target.value)) {state.date=event.target.value;render();}
    if(event.target.id === 'theme') {state.theme=event.target.value;write('rgatu.theme',state.theme);applyTheme();}
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
        group = chosen;state.date=initialDate(group);state.subject='';state.kind='';
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
      case 'today': state.date=nowDate();render();break;
      case 'date': state.date=value;go('day');window.scrollTo(0,0);break;
      case 'prev-day': state.date=shiftDate(state.date,-1);render();break;
      case 'next-day': state.date=shiftDate(state.date,1);render();break;
      case 'session': go('session');window.scrollTo(0,0);break;
      case 'bells': state.bellsBack=route();go('bells');window.scrollTo(0,0);break;
      case 'back-bells': go(state.bellsBack||'day');break;
      case 'kind': state.kind=value;updateSessionResults();break;
      case 'reset-subject': state.subject='';state.kind='';document.getElementById('subject-search').value='';updateSessionResults();break;
      case 'refresh': await refreshSchedule(true);break;
      case 'install':
        if(installPrompt) {await installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;}
        else {const guide=document.getElementById('install-guide');if(guide) guide.textContent=/iPad|iPhone|iPod/.test(navigator.userAgent)?'Нажми «Поделиться» в браузере, затем «На экран Домой».':'Открой меню браузера и выбери «Установить приложение» или «Добавить на главный экран».';}
        break;
    }
  });
  window.addEventListener('hashchange',()=>{render();window.scrollTo(0,0);});
  window.addEventListener('beforeinstallprompt', event => {event.preventDefault();installPrompt=event;});
  window.addEventListener('appinstalled',()=>{toast('Теперь пары на главном экране.');if(route()==='profile')render();});
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
    navigator.serviceWorker.register('./sw.js').then(registration=>{
      if(registration.waiting) registration.waiting.postMessage('ACTIVATE');
      registration.addEventListener('updatefound',()=>{const worker=registration.installing;worker?.addEventListener('statechange',()=>{if(worker.state==='installed'&&navigator.serviceWorker.controller)worker.postMessage('ACTIVATE');});});
    }).catch(()=>{});
    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange',()=>{if(!reloading&&navigator.serviceWorker.controller){reloading=true;location.reload();}});
  }
  refreshSchedule();
})();
