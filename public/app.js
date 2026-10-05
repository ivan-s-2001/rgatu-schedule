(() => {
  'use strict';
  const DOWNLOAD_URL = 'https://ivan-s-2001.github.io/rgatu-schedule/';
  const time = window.RGATU_TIME;
  const root = document.getElementById('app');
  const isAndroid = /RgatuLiteAndroid\//.test(navigator.userAgent);
  document.documentElement.classList.toggle('android-app', isAndroid);
  const read = (key, fallback = null) => { try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; } };
  const write = (key, value) => { try { localStorage.setItem(key, value); return true; } catch { return false; } };
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  // Bootstrap Icons (MIT) — embedded locally so PWA/Android stay fully offline.
  const iconPaths = {
    calendar: {bi:'calendar3', body:'<path d="M14 0H2a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2M1 3.857C1 3.384 1.448 3 2 3h12c.552 0 1 .384 1 .857v10.286c0 .473-.448.857-1 .857H2c-.552 0-1-.384-1-.857z"/><path d="M6.5 7a1 1 0 1 0 0-2 1 1 0 0 0 0 2m3 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2m3 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2m-9 3a1 1 0 1 0 0-2 1 1 0 0 0 0 2m3 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2m3 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2m3 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2m-9 3a1 1 0 1 0 0-2 1 1 0 0 0 0 2m3 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2m3 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2"/>'},
    list: {bi:'list-ul', body:'<path fill-rule="evenodd" d="M5 11.5a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1h-9a.5.5 0 0 1-.5-.5m0-4a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1h-9a.5.5 0 0 1-.5-.5m0-4a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1h-9a.5.5 0 0 1-.5-.5m-3 1a1 1 0 1 0 0-2 1 1 0 0 0 0 2m0 4a1 1 0 1 0 0-2 1 1 0 0 0 0 2m0 4a1 1 0 1 0 0-2 1 1 0 0 0 0 2"/>'},
    user: {bi:'person', body:'<path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6m2-3a2 2 0 1 1-4 0 2 2 0 0 1 4 0m4 8c0 1-1 1-1 1H3s-1 0-1-1 1-4 6-4 6 3 6 4m-1-.004c-.001-.246-.154-.986-.832-1.664C11.516 10.68 10.289 10 8 10s-3.516.68-4.168 1.332c-.678.678-.83 1.418-.832 1.664z"/>'},
    room: {bi:'geo-alt', body:'<path d="M12.166 8.94c-.524 1.062-1.234 2.12-1.96 3.07A32 32 0 0 1 8 14.58a32 32 0 0 1-2.206-2.57c-.726-.95-1.436-2.008-1.96-3.07C3.304 7.867 3 6.862 3 6a5 5 0 0 1 10 0c0 .862-.305 1.867-.834 2.94M8 16s6-5.686 6-10A6 6 0 0 0 2 6c0 4.314 6 10 6 10"/><path d="M8 8a2 2 0 1 1 0-4 2 2 0 0 1 0 4m0 1a3 3 0 1 0 0-6 3 3 0 0 0 0 6"/>'},
    search: {bi:'search', body:'<path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001q.044.06.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1 1 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0"/>'},
    down: {bi:'chevron-down', body:'<path fill-rule="evenodd" d="M1.646 4.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708"/>'},
    left: {bi:'chevron-left', body:'<path fill-rule="evenodd" d="M11.354 1.646a.5.5 0 0 1 0 .708L5.707 8l5.647 5.646a.5.5 0 0 1-.708.708l-6-6a.5.5 0 0 1 0-.708l6-6a.5.5 0 0 1 .708 0"/>'},
    right: {bi:'chevron-right', body:'<path fill-rule="evenodd" d="M4.646 1.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1 0 .708l-6 6a.5.5 0 0 1-.708-.708L10.293 8 4.646 2.354a.5.5 0 0 1 0-.708"/>'},
    check: {bi:'check-lg', body:'<path d="M12.736 3.97a.733.733 0 0 1 1.047 0c.286.289.29.756.01 1.05L7.88 12.01a.733.733 0 0 1-1.065.02L3.217 8.384a.757.757 0 0 1 0-1.06.733.733 0 0 1 1.047 0l3.052 3.093 5.4-6.425z"/>'},
    download: {bi:'download', body:'<path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5"/><path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708z"/>'},
    refresh: {bi:'arrow-clockwise', body:'<path fill-rule="evenodd" d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2z"/><path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466"/>'},
    book: {bi:'book', body:'<path d="M1 2.828c.885-.37 2.154-.769 3.388-.893 1.33-.134 2.458.063 3.112.752v9.746c-.935-.53-2.12-.603-3.213-.493-1.18.12-2.37.461-3.287.811zm7.5-.141c.654-.689 1.782-.886 3.112-.752 1.234.124 2.503.523 3.388.893v9.923c-.918-.35-2.107-.692-3.287-.81-1.094-.111-2.278-.039-3.213.492zM8 1.783C7.015.936 5.587.81 4.287.94c-1.514.153-3.042.672-3.994 1.105A.5.5 0 0 0 0 2.5v11a.5.5 0 0 0 .707.455c.882-.4 2.303-.881 3.68-1.02 1.409-.142 2.59.087 3.223.877a.5.5 0 0 0 .78 0c.633-.79 1.814-1.019 3.222-.877 1.378.139 2.8.62 3.681 1.02A.5.5 0 0 0 16 13.5v-11a.5.5 0 0 0-.293-.455c-.952-.433-2.48-.952-3.994-1.105C10.413.809 8.985.936 8 1.783"/>'},
    arrow: {bi:'arrow-right', body:'<path fill-rule="evenodd" d="M1 8a.5.5 0 0 1 .5-.5h11.793l-3.147-3.146a.5.5 0 0 1 .708-.708l4 4a.5.5 0 0 1 0 .708l-4 4a.5.5 0 0 1-.708-.708L13.293 8.5H1.5A.5.5 0 0 1 1 8"/>'},
    clock: {bi:'clock', body:'<path d="M8 3.5a.5.5 0 0 0-1 0V9a.5.5 0 0 0 .252.434l3.5 2a.5.5 0 0 0 .496-.868L8 8.71z"/><path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16m7-8A7 7 0 1 1 1 8a7 7 0 0 1 14 0"/>'},
    people: {bi:'people', body:'<path d="M15 14s1 0 1-1-1-4-5-4-5 3-5 4 1 1 1 1zm-7.978-1L7 12.996c.001-.264.167-1.03.76-1.72C8.312 10.629 9.282 10 11 10c1.717 0 2.687.63 3.24 1.276.593.69.758 1.457.76 1.72l-.008.002-.014.002zM11 7a2 2 0 1 0 0-4 2 2 0 0 0 0 4m3-2a3 3 0 1 1-6 0 3 3 0 0 1 6 0M6.936 9.28a6 6 0 0 0-1.23-.247A7 7 0 0 0 5 9c-4 0-5 3-5 4q0 1 1 1h4.216A2.24 2.24 0 0 1 5 13c0-1.01.377-2.042 1.09-2.904.243-.294.526-.569.846-.816M4.92 10A5.5 5.5 0 0 0 4 13H1c0-.26.164-1.03.76-1.724.545-.636 1.492-1.256 3.16-1.275ZM1.5 5.5a3 3 0 1 1 6 0 3 3 0 0 1-6 0m3-2a2 2 0 1 0 0 4 2 2 0 0 0 0-4"/>'}
  };
  const icon = name => {
    const item = iconPaths[name] || iconPaths.calendar;
    return `<svg class="ui-icon bi bi-${item.bi}" viewBox="0 0 16 16" fill="currentColor" focusable="false" aria-hidden="true">${item.body}</svg>`;
  };
  const validData = data => data && data.schema === 1 && typeof data.version === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(data.updated) && Array.isArray(data.groups) && data.groups.length > 0 && Array.isArray(data.lessons) && data.groups.every(g => typeof g.id === 'string' && !/-[12]$/.test(g.id) && Array.isArray(g.dates) && g.dates.length && Array.isArray(g.lessons) && g.lessons.every(i => Number.isInteger(i) && i >= 0 && i < data.lessons.length) && Object.entries(g.subgroups || {}).every(([i,subgroup]) => g.lessons.includes(Number(i)) && (subgroup === 1 || subgroup === 2))) && data.lessons.every(l => /^\d{4}-\d{2}-\d{2}$/.test(l.date) && l.slot >= 1 && l.slot <= 7 && typeof l.subject === 'string');
  let data = window.RGATU_DATA;
  try {
    const cached = JSON.parse(read('rgatu.schedule', 'null'));
    if (validData(cached) && (cached.updated > data.updated || cached.updated === data.updated && cached.version === data.version)) data = cached;
  } catch {}
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
  let groupsById = new Map(data.groups.map(g => [g.id,g]));
  const groupById = id => groupsById.get(id);
  const canonicalGroupId = id => String(id || '').replace(/-(1|2)$/,'');
  const savedGroupId = canonicalGroupId(read('rgatu.group'));
  let group = groupById(savedGroupId);
  if (group && read('rgatu.group') !== group.id) write('rgatu.group',group.id);
  const initialDate = g => {
    const today = nowDate();
    if (today < g.dates[0]) return g.dates[0];
    if (today > g.dates.at(-1)) return g.dates.at(-1);
    return today;
  };
  const state = {date: group ? initialDate(group) : nowDate(), month:'', chosen: group?.id || '', course: '', query:'', limit:18, subject:'', teacherQuery:'', teacher:read('rgatu.teacher',''), theme:read('rgatu.theme','auto'), refreshing:false, bellKind:''};
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
    document.querySelector('meta[name=theme-color]').content = dark ? '#111a2b' : '#1f274b';
  }
  applyTheme();
  darkPreference.addEventListener?.('change', applyTheme);
  function route() { return group ? ['day','calendar','search','profile','group','bells','teachers'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'day' : 'group'; }
  function go(page) { if (location.hash === '#' + page) render(); else location.hash = page; }
  function header() {
    return `<header class="topbar"><div class="topbar-inner"><div class="brand"><img class="brand-logo" src="./icons/icon.svg" alt="" aria-hidden="true"><div><span class="brand-kicker">Факультет заочного обучения</span><strong class="brand-title">Расписание ФЗО</strong></div></div><div class="header-actions"><span class="header-unofficial">неофициальное · от студента</span><button class="group-switch" data-action="group" aria-label="Сменить группу, сейчас ${escape(group.id)}"><span>${escape(group.id)}</span>${icon('down')}</button></div></div></header>`;
  }
  function nav(page) {
    return `<nav class="bottom-nav" aria-label="Главное меню"><span class="desktop-nav-title">Заочное обучение</span>${[['day','calendar','Расписание'],['bells','clock','Звонки'],['profile','user','Моя группа']].map(([id,glyph,label]) => `<a class="nav-link" href="#${id}"${(page===id || id==='day' && ['calendar','search','teachers'].includes(page))?' aria-current="page"':''}>${icon(glyph)}<span>${label}</span></a>`).join('')}</nav>`;
  }
  function scheduleTabs(active) {
    return `<div class="schedule-switcher" role="tablist" aria-label="Вид расписания"><button class="schedule-tab" role="tab" data-action="group-schedule" aria-selected="${active==='group'}" aria-controls="content"><span>По группе</span></button><button class="schedule-tab" role="tab" data-action="teachers" aria-selected="${active==='teachers'}" aria-controls="content"><span>По преподавателю</span></button></div>`;
  }
  function renderPicker() {
    root.innerHTML = `<div class="shell picker-shell"><section class="picker-hero" aria-labelledby="picker-title"><div class="picker-hero-inner"><div class="picker-hero-copy">${group ? `<button class="hero-back" data-action="cancel-group">${icon('left')}Назад к расписанию</button>` : ''}<p class="eyebrow">Заочное обучение</p><h1 id="picker-title">${group ? 'Выбери свою группу' : 'Расписание ФЗО'}</h1><p class="picker-lead">${group ? 'После выбора сразу открою ближайший учебный день этой группы.' : 'Расписание факультета заочного обучения: по группе или преподавателю, с аудиториями, корпусами и временем пар.'}</p><div class="hero-actions"><button class="hero-link primary" data-action="picker-focus">Выбрать группу ${icon('arrow')}</button>${group?'<button class="hero-link ghost" data-action="cancel-group">Оставить текущую</button>':''}</div></div><aside class="hero-card unofficial-card"><span class="unofficial-chip large">Неофициальное</span><h2>Студенческий проект</h2><p>Сделано студентом 1 курса для удобного просмотра опубликованного расписания ФЗО.</p><div class="hero-card-sep"></div><a class="hero-card-link" href="https://www.rsatu.ru/zaochnoe/">Официальный раздел ФЗО ${icon('arrow')}</a></aside></div></section><main class="page picker-page" id="content"><section class="picker-form" id="picker-form" aria-label="Выбор группы"><div class="screen-heading"><h2>${group ? 'Сменить группу' : 'Какая у тебя группа?'}</h2><p>Найди шифр группы или выбери курс.</p></div><label for="group-search" class="label">Ваша группа</label><div class="search-wrap">${icon('search')}<input id="group-search" class="search" type="search" placeholder="Например, ЗВС-26" autocomplete="off" spellcheck="false" value="${escape(state.query)}" aria-controls="group-list"></div><div class="filters" aria-label="Фильтр по курсу">${[['','Все курсы'],['1','1 курс'],['2','2 курс'],['3','3 курс'],['4','4–5 курс']].map(([id,label]) => `<button class="filter" data-action="course" data-value="${id}" aria-pressed="${state.course===id}">${label}</button>`).join('')}</div><div id="group-results"></div><button class="primary picker-submit" id="continue-group" data-action="save-group"${state.chosen?'':' disabled'}>${state.chosen ? 'Открыть расписание' : 'Выбери группу'}${icon('arrow')}</button></section></main></div>`;
    updateGroupResults();
  }
  const normalized = text => text.toUpperCase().replace(/Ё/g,'Е').replace(/[^А-ЯA-Z0-9]/g,'');
  const keyboardLayout = text => text.toLowerCase().split('').map(c => ({q:'й',w:'ц',e:'у',r:'к',t:'е',y:'н',u:'г',i:'ш',o:'щ',p:'з',a:'ф',s:'ы',d:'в',f:'а',g:'п',h:'р',j:'о',k:'л',l:'д',z:'я',x:'ч',c:'с',v:'м',b:'и',n:'т',m:'ь'})[c] || c).join('');
  const filteredGroups = () => data.groups.filter(g => (!state.course || (state.course === '4' ? g.course >= 4 : g.course === Number(state.course))) && (!state.query || normalized(g.id).includes(normalized(state.query)) || normalized(g.id).includes(normalized(keyboardLayout(state.query)))));
  function updateGroupResults(focusId) {
    const matches = filteredGroups();
    const visible = matches.slice(0,state.limit);
    const selectedVisible = visible.some(g => g.id === state.chosen);
    document.getElementById('group-results').innerHTML = `<p class="results-count" role="status">${plural(matches.length,['группа','группы','групп'])}</p><div class="group-list" id="group-list" role="radiogroup" aria-label="Выберите группу">${visible.map((g,i) => `<button class="group-row" role="radio" aria-checked="${state.chosen===g.id}" tabindex="${state.chosen===g.id || !selectedVisible && i===0 ? '0' : '-1'}" data-action="choose-group" data-value="${escape(g.id)}"><div><div class="group-code">${escape(g.id)}</div><div class="group-hint">${g.course} курс · ${'заочное отделение'}</div></div><span class="choice-dot">${state.chosen===g.id?icon('check'):''}</span></button>`).join('')}</div>${matches.length>visible.length?`<button class="secondary show-more" data-action="more-groups">Показать ещё ${icon('down')}</button>`:''}${!matches.length?'<div class="empty"><h2>Такой группы здесь нет</h2><p>Проверь номер или выбери другой курс.</p><button class="secondary" data-action="reset-groups">Показать все группы</button></div>':''}`;
    const button = document.getElementById('continue-group');
    button.disabled = !state.chosen;
    button.innerHTML = `${state.chosen?'Продолжить':'Выбери группу'}${icon('arrow')}`;
    root.querySelectorAll('[data-action=course]').forEach(button => button.setAttribute('aria-pressed',String(button.dataset.value===state.course)));
    if (focusId) [...root.querySelectorAll('.group-row')].find(b => b.dataset.value === focusId)?.focus();
  }
  const subgroupFor = (groupId, lessonId) => Number(groupsById.get(groupId)?.subgroups?.[String(lessonId)] || 0) || null;
  const audienceLabel = (groupId, lessonId) => {
    const subgroup = subgroupFor(groupId,lessonId);
    return subgroup ? groupId + ' · ' + subgroup + ' подгруппа' : groupId;
  };
  const groupLessons = () => group.lessons.map(i => ({...data.lessons[i],subgroup:subgroupFor(group.id,i)})).sort((a,b) => a.date.localeCompare(b.date) || a.slot-b.slot);
  const lessonsOn = date => groupLessons().filter(l => l.date === date);
  const allTeachers = () => [...new Set(data.lessons.map(lesson => String(lesson.teacher || '').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ru'));
  const teacherLessons = teacher => data.lessons.filter(lesson => lesson.teacher === teacher).sort((a,b)=>a.date.localeCompare(b.date) || a.slot-b.slot);
  const typeLabel = type => ({'Л':'Лекция','П':'Практика','ЛР':'Лабораторная','К':'Занятие'})[type] || type || 'Занятие';
  const lessonView = lesson => ({...lesson,slots:[lesson.slot],ids:[lesson.id],peers:sharedGroups.get(lesson.id) || []});
  function together(peers, lessonId) {
    const others = peers.filter(id=>id!==group.id);
    return others.length ? `<p class="together">${icon('people')}<span>Вместе с ${others.map(id=>escape(audienceLabel(id,lessonId))).join(', ')}</span></p>` : '';
  }
  const teacherGroups = (peers, lessonId) => peers.length ? `<p class="together">${icon('people')}<span>Группы: ${peers.map(id=>escape(audienceLabel(id,lessonId))).join(', ')}</span></p>` : '';
  const rangeText = lesson => {
    const slot = lesson.slots ? lesson.slots[0] : lesson.slot;
    const bell = time.bells(lesson.date)[slot-1];
    return bell[0]+'–'+bell[1];
  };
  const roomMeta = value => {
    const text = String(value || '').trim();
    const match = text.match(/^([Гг]|\d+)\s*[-–]\s*(\d{3,4}[А-ЯA-Z]?)/);
    if (!match) return '';
    const building = match[1].toUpperCase() === 'Г' ? 'Главный корпус' : match[1] + ' корпус';
    const floor = (match[2].match(/\d/) || [])[0];
    return floor ? building + ' · ' + floor + ' этаж' : building;
  };
  const lessonPlace = lesson => {
    if (!lesson?.room) return '';
    const meta = roomMeta(lesson.room);
    return meta ? lesson.room + ' · ' + meta : lesson.room;
  };
  function lessonCards(lessons,{teacherMode=false,focusLessons=null}={}) {
    const focus = time.focus(focusLessons || groupLessons());
    const cards = lessons.slice().sort((a,b)=>a.date.localeCompare(b.date)||a.slot-b.slot).map(lessonView);
    return `<div class="lessons">${cards.map(l => {
      const current = focus?.current && l.ids.includes(focus.lesson.id);
      return `<article class="lesson${current?' lesson-current':''}" data-lesson-ids="${l.ids.join(',')}" aria-label="${l.slot} пара, ${rangeText(l)}, ${escape(l.subject)}"><div class="slot"><strong>${l.slot}</strong><span>пара</span><span class="current-dot" aria-label="Идёт сейчас"${current?'':' hidden'}></span></div><div class="lesson-body"><div class="lesson-time"><span>${rangeText(l)}</span><span class="kind ${l.type==='П'?'practice':l.type==='ЛР'?'lab':''}">${escape(typeLabel(l.type))}</span>${!teacherMode&&l.subgroup?`<span class="subgroup-note">${l.subgroup} подгруппа</span>`:''}<span class="current-word"${current?'':' hidden'}>Сейчас</span></div><h3>${escape(l.subject)}</h3><div class="lesson-details">${l.room?`<p class="room room-strong">${icon('room')}<span><strong>${escape(l.room)}</strong>${roomMeta(l.room)?`<small>${escape(roomMeta(l.room))}</small>`:''}</span></p>`:''}${!teacherMode&&l.teacher?`<p class="teacher">${icon('user')}<span>${escape(l.teacher)}</span></p>`:''}</div>${teacherMode?teacherGroups(l.peers,l.id):together(l.peers,l.id)}</div></article>`;
    }).join('')}</div>`;
  }
  function renderFocus() {
    const today = nowDate();
    if (state.date!==today && !(today<group.dates[0] && state.date===group.dates[0])) return '';
    const focus = time.focus(groupLessons());
    if (!focus) return today<=group.dates.at(-1) ? '<div class="day-done"><strong>На сегодня всё</strong><span>Ближайших занятий в этой сессии больше нет.</span></div>' : '';
    const {lesson,current,minutes} = focus;
    const sameDay = lesson.date===today;
    const subgroup = subgroupFor(group.id,lesson.id);
    const labelBase = current ? `Сейчас · ${lesson.slot} пара` : sameDay ? `Следующая · ${lesson.slot} пара` : lesson.date===shiftDate(today,1) ? 'Завтра' : 'Ближайшая · '+dateText(lesson.date);
    const label = subgroup ? labelBase + ' · ' + subgroup + ' подгруппа' : labelBase;
    const timing = current ? `ещё ${plural(minutes,['минута','минуты','минут'])}` : sameDay ? `в ${focus.time.start} · через ${plural(minutes,['минуту','минуты','минут'])}` : `в ${focus.time.start}`;
    const place = lessonPlace(lesson);
    return `<button class="live-summary${current?' is-current':''}" data-action="focus-lesson" data-value="${lesson.date}" data-lesson-id="${lesson.id}"><span class="live-symbol">${current?'<span class="current-dot"></span>':icon('clock')}</span><span class="live-copy"><span class="live-kicker">${escape(label)} · ${escape(timing)}</span><strong>${escape(lesson.subject)}</strong>${place?`<span class="live-place">${icon('room')}${escape(place)}</span>`:''}</span>${icon('arrow')}</button>`;
  }
  function renderBells() {
    const weekend = (state.bellKind || (time.isWeekend(state.date)?'weekend':'weekday'))==='weekend';
    const rows = weekend ? time.weekend : time.weekday;
    return `<main class="page bells-page" id="content"><div class="screen-heading"><h1>Звонки</h1><p>Московское время</p></div><div class="segments" aria-label="Дни звонков">${[['weekday','Будни'],['weekend','Выходные']].map(([id,label])=>`<button data-action="bell-kind" data-value="${id}" aria-pressed="${weekend === (id==='weekend')}">${label}</button>`).join('')}</div><section class="bells-section"><h2>${weekend?'Суббота и воскресенье':'Понедельник — пятница'}</h2><ol class="bells-list">${rows.map(([start,end],i)=>`<li><span><strong>${i+1}</strong> пара</span><time>${start}–${end}</time></li>`).join('')}</ol></section><p class="section-note">${weekend?'В выходные третья пара начинается в 12:00.':'Большой перерыв после второй пары — 50 минут.'}</p></main>`;
  }
  function emptyDay() {
    const next = group.dates.find(date => date > state.date && lessonsOn(date).length);
    const nextLesson = next ? lessonsOn(next).slice().sort((a,b)=>a.slot-b.slot)[0] : null;
    const nextTime = nextLesson ? time.bounds(nextLesson).start : '';
    const nextPlace = nextLesson ? lessonPlace(nextLesson) : '';
    const nextAudience = nextLesson?.subgroup ? nextLesson.subgroup + ' подгруппа' : '';
    const message = state.date > group.dates.at(-1) ? 'Установочная сессия закончилась. Расписание осталось в архиве.' : state.date < group.dates[0] ? 'Установочная сессия ещё не началась.' : 'Сегодня занятий нет.';
    return `<div class="empty day-empty">${icon('book')}<h2>${escape(message)}</h2>${nextLesson?`<div class="next-preview"><span>Дальше</span><strong>${escape(dateText(next,{weekday:'short',day:'numeric',month:'short'}))} · ${escape(nextTime)} · ${escape(nextLesson.subject)}${nextAudience?' · '+escape(nextAudience):''}</strong>${nextPlace?`<small>${escape(nextPlace)}</small>`:''}</div><button class="secondary" data-action="date" data-value="${next}">Открыть следующий учебный день ${icon('arrow')}</button>`:`<p>${state.date > group.dates.at(-1) ? 'Прошедшие дни можно посмотреть в календаре.' : 'Дальше занятий в опубликованной сессии нет.'}</p><button class="secondary" data-action="calendar">Открыть календарь ${icon('calendar')}</button>`}</div>`;
  }
  function renderDay() {
    const lessons = lessonsOn(state.date);
    const today = nowDate();
    const week = time.weekDates(state.date);
    const past = today > group.dates.at(-1);
    const future = today < group.dates[0];
    const relative = state.date===today ? 'Сегодня' : state.date===shiftDate(today,1) ? 'Завтра' : state.date===shiftDate(today,-1) ? 'Вчера' : '';
    const dayTime = lessons.length ? time.bounds(lessons[0]).start+'–'+time.bounds(lessons.at(-1)).end : 'Свободный день';
    return `<main class="page day-page" id="content">${scheduleTabs('group')}<div class="day-layout"><aside class="day-sidebar"><div id="live-focus">${renderFocus()}</div><section class="day-controls" aria-label="Выбор дня"><div class="date-pager"><button class="icon-button" data-action="prev-day" aria-label="Предыдущий день">${icon('left')}</button><button class="date-title" data-action="calendar" aria-label="Открыть календарь, ${escape(dateText(state.date))}"><span class="day-caption">${relative?relative+' · ':''}${escape(dateText(state.date,{weekday:'long'}))}</span><h1>${escape(dateText(state.date))}${icon('down')}</h1></button><button class="icon-button" data-action="next-day" aria-label="Следующий день">${icon('right')}</button></div><div class="week" aria-label="Дни недели">${week.map(date=>`<button class="day${date===today?' is-today':''}" data-action="date" data-value="${date}"${date===state.date?' aria-current="date"':''} aria-label="${escape(dateText(date,{weekday:'long',day:'numeric',month:'long'}))}, ${plural(lessonsOn(date).length,['пара','пары','пар'])}"><span class="day-name">${escape(dateText(date,{weekday:'short'}))}</span><span class="day-number">${Number(date.slice(-2))}</span><span class="day-dot ${lessonsOn(date).length?'':'no-lessons'}"></span></button>`).join('')}</div><div class="day-tools"><button class="text-button" data-action="calendar">${icon('calendar')}Календарь</button><button class="text-button" data-action="today"${state.date===today?' disabled':''}>Сегодня</button><button class="icon-button search-button" data-action="search" aria-label="Найти предмет, преподавателя или аудиторию">${icon('search')}</button></div></section>${past?'<p class="source-banner">Прошедшая сессия · расписание сохранено</p>':future?`<p class="source-banner">Сессия с ${escape(dateText(group.dates[0]))}</p>`:''}</aside><section class="day-main"><div class="date-description"><h2>${lessons.length?plural(lessons.length,['пара','пары','пар']):'Твой день'}</h2><span>${dayTime}</span></div>${lessons.length?lessonCards(lessons):emptyDay()}<p class="time-note">Московское время</p></section></div></main>`;
  }
  function renderCalendar() {
    const month = state.month || state.date.slice(0,7);
    const today = nowDate();
    return `<main class="page calendar-page" id="content"><div class="back-row"><button class="back-button" data-action="back-day">${icon('left')}К расписанию</button><button class="text-button" data-action="calendar-today">Этот месяц</button></div><div class="month-pager"><button class="icon-button" data-action="prev-month" aria-label="Предыдущий месяц">${icon('left')}</button><h1>${escape(dateText(month+'-01',{month:'long',year:'numeric'}))}</h1><button class="icon-button" data-action="next-month" aria-label="Следующий месяц">${icon('right')}</button></div><div class="month-weekdays" aria-hidden="true">${['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map(day=>`<span>${day}</span>`).join('')}</div><div class="month-grid" aria-label="Календарь ${escape(dateText(month+'-01',{month:'long',year:'numeric'}))}">${time.monthDates(month).map(date=>`<button class="month-day${date.slice(0,7)!==month?' outside-month':''}${date===today?' is-today':''}" data-action="date" data-value="${date}"${date===state.date?' aria-current="date"':''} aria-label="${escape(dateText(date,{weekday:'long',day:'numeric',month:'long'}))}, ${plural(lessonsOn(date).length,['пара','пары','пар'])}"><span>${Number(date.slice(-2))}</span><span class="day-dot ${lessonsOn(date).length?'':'no-lessons'}"></span></button>`).join('')}</div><p class="calendar-legend"><span class="day-dot"></span>Дни с парами</p><button class="period-card" data-action="date" data-value="${group.dates[0]}"><span>${icon('book')}Установочная сессия</span><strong>${escape(dateText(group.dates[0]))} — ${escape(dateText(group.dates.at(-1)))}</strong><span>${group.course} курс · ${escape(group.id)} ${icon('arrow')}</span></button></main>`;
  }
  function renderSearch() {
    return `<main class="page search-page" id="content"><div class="back-row"><button class="back-button" data-action="back-day">${icon('left')}К расписанию</button></div><div class="screen-heading"><h1>Найти пару</h1><p>В расписании твоей группы</p></div><label class="label" for="subject-search">Предмет, преподаватель или аудитория</label><div class="search-wrap">${icon('search')}<input id="subject-search" class="search" type="search" placeholder="Что ищем?" value="${escape(state.subject)}" aria-controls="search-results" autocomplete="off"></div><div id="search-results"></div></main>`;
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
  function renderTeachers() {
    const tabs = scheduleTabs('teachers');
    const teachers = allTeachers();
    const selected = state.teacher && teachers.includes(state.teacher) ? state.teacher : '';
    let body = '';
    if (selected) {
      const lessons = teacherLessons(selected);
      const dates = [...new Set(lessons.map(lesson=>lesson.date))];
      body = `<section class="teacher-summary"><div><span class="eyebrow">Преподаватель</span><h1>${escape(selected)}</h1><p>${plural(lessons.length,['пара','пары','пар'])} · ${plural(dates.length,['день','дня','дней'])}</p></div><button class="secondary teacher-change" data-action="clear-teacher">Другой преподаватель</button></section>${dates.map(date=>`<section class="day-group teacher-day"><div class="day-group-heading"><div><strong>${escape(dateText(date))}</strong><span>${escape(dateText(date,{weekday:'long'}))}</span></div></div>${lessonCards(lessons.filter(lesson=>lesson.date===date),{teacherMode:true,focusLessons:lessons})}</section>`).join('')}`;
    } else {
      body = `<div class="screen-heading schedule-heading"><span class="eyebrow">Установочная сессия ФЗО</span><h1>По преподавателю</h1><p>Выбери преподавателя — покажу его занятия, аудитории и группы.</p></div><label class="label" for="teacher-search">Преподаватель</label><div class="search-wrap">${icon('search')}<input id="teacher-search" class="search" type="search" placeholder="Фамилия или инициалы" autocomplete="off" value="${escape(state.teacherQuery)}" aria-controls="teacher-results"></div><div id="teacher-results"></div>`;
    }
    return `<main class="page teachers-page" id="content">${tabs}${body}</main>`;
  }
  function updateTeacherResults() {
    const target = document.getElementById('teacher-results');
    if (!target) return;
    const query = state.teacherQuery.trim().toLowerCase();
    const filtered = allTeachers().filter(name => !query || name.toLowerCase().includes(query) || normalized(name).includes(normalized(query)));
    target.innerHTML = `<p class="results-count" role="status">${plural(filtered.length,['преподаватель','преподавателя','преподавателей'])}</p><div class="subject-list">${filtered.map(name=>`<button class="subject-row" data-action="choose-teacher" data-value="${escape(name)}"><span>${escape(name)}</span>${icon('right')}</button>`).join('')}</div>${!filtered.length?'<div class="empty"><h2>Не нашли преподавателя</h2><p>Проверь фамилию или очисти поиск.</p><button class="secondary" data-action="clear-teacher-search">Очистить поиск</button></div>':''}`;
  }

  function renderProfile() {
    const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
    return `<main class="page profile-page" id="content"><div class="screen-heading"><h1>Моя группа</h1></div><section class="profile-group"><div><h2>${escape(group.id)}</h2><p>${group.course} курс · заочное отделение</p></div><button class="secondary" data-action="group">Сменить ${icon('right')}</button></section><section class="profile-period"><span>Установочная сессия</span><strong>${escape(dateText(group.dates[0]))} — ${escape(dateText(group.dates.at(-1)))}</strong><p>${plural([...new Set(groupLessons().map(item=>item.date))].length,['учебный день','учебных дня','учебных дней'])} · ${plural(groupLessons().length,['занятие','занятия','занятий'])}</p><button class="text-button" data-action="calendar">Открыть календарь ${icon('arrow')}</button></section><section class="settings" aria-label="Настройки"><div class="theme-setting"><h2>Оформление</h2><div class="segments" aria-label="Оформление">${[['auto','Авто'],['light','Светлое'],['dark','Тёмное']].map(([id,label])=>`<button data-action="theme" data-value="${id}" aria-pressed="${state.theme===id}">${label}</button>`).join('')}</div></div><div class="settings-row"><div><h2>Расписание</h2><p>Обновлено ${escape(dateText(data.updated))}</p></div><button class="icon-button" data-action="refresh" aria-label="Обновить расписание"${state.refreshing?' disabled':''}>${icon('refresh')}</button></div>${isAndroid?`<button class="link-row" data-action="app-update"><span>Проверить обновления приложения</span>${icon('refresh')}</button>`:''}</section>${!isAndroid&&!standalone?`<section class="install-block"><h2>Расписание на главном экране</h2><p>Открывай одним касанием.</p><button class="primary" data-action="install">Добавить на главный экран ${icon('download')}</button><div id="install-guide"></div><a class="link-row" href="${DOWNLOAD_URL}"><span>Скачать для Android</span>${icon('right')}</a></section>`:''}<section class="about-card"><div class="about-head"><span class="unofficial-chip large">Неофициальное</span><h2>Студенческий проект ФЗО</h2></div><p>Сделано студентом 1 курса РГАТУ для удобного просмотра расписания. Это не официальный сервис университета.</p><a class="link-row" href="https://www.rsatu.ru/zaochnoe/"><span>Официальный раздел «Заочное обучение»<small>Сайт РГАТУ</small></span>${icon('arrow')}</a><a class="link-row" href="https://t.me/falseheat"><span>Смирнов Иван · @falseheat<small>Связь, идеи и ошибки в расписании</small></span>${icon('arrow')}</a></section></main>`;
  }
  function syncNav(page) {
    const navigation = root.querySelector('.bottom-nav');
    if (!navigation) return;
    navigation.querySelectorAll('.nav-link').forEach(link => {
      const id = link.getAttribute('href').slice(1);
      const current = page === id || id === 'day' && ['calendar','search','teachers'].includes(page);
      if (current) link.setAttribute('aria-current','page');
      else link.removeAttribute('aria-current');
    });
  }
  function render() {
    const page = route();
    if (page === 'group') {renderPicker(); return;}
    const screens = {day:renderDay,calendar:renderCalendar,search:renderSearch,bells:renderBells,profile:renderProfile,teachers:renderTeachers};
    const screen = screens[page]();
    const shell = root.querySelector('.app-shell');
    if (!shell) {
      root.innerHTML = `<div class="shell app-shell">${header()}${screen}${nav(page)}</div>`;
    } else {
      const current = shell.querySelector('.page');
      if (current) current.outerHTML = screen;
      else shell.insertAdjacentHTML('beforeend',screen);
      syncNav(page);
    }
    if (page === 'search') updateSearchResults();
    if (page === 'teachers' && !state.teacher) updateTeacherResults();
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
        groupsById = new Map(data.groups.map(g => [g.id,g]));
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
    if (event.target.id === 'teacher-search') {state.teacherQuery=event.target.value;updateTeacherResults();}
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
      case 'picker-focus': {
        const form=document.getElementById('picker-form');
        const input=document.getElementById('group-search');
        if(input) input.focus({preventScroll:true});
        if(form) form.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
        break;
      }
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
      case 'group-schedule': go('day');window.scrollTo(0,0);break;
      case 'profile': go('profile');window.scrollTo(0,0);break;
      case 'teachers': state.teacherQuery='';go('teachers');window.scrollTo(0,0);break;
      case 'bells': go('bells');window.scrollTo(0,0);break;
      case 'bell-kind': state.bellKind=value;render();break;
      case 'search': state.subject='';go('search');window.scrollTo(0,0);break;
      case 'search-subject': state.subject=value;document.getElementById('subject-search').value=value;updateSearchResults();break;
      case 'choose-teacher': state.teacher=value;state.teacherQuery='';write('rgatu.teacher',value);render();window.scrollTo(0,0);break;
      case 'clear-teacher': state.teacher='';write('rgatu.teacher','');state.teacherQuery='';render();window.scrollTo(0,0);break;
      case 'clear-teacher-search': state.teacherQuery='';{const input=document.getElementById('teacher-search');if(input)input.value='';}updateTeacherResults();break;
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
