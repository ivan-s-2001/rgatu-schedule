'use strict';
const BELL_WEEKDAY = [['08:30','10:05'],['10:15','11:50'],['12:40','14:15'],['14:25','16:00'],['16:10','17:45'],['18:00','19:25'],['19:35','21:00']];
const BELL_WEEKEND = [['08:30','10:05'],['10:15','11:50'],['12:00','13:35'],['13:45','15:20'],['15:30','17:05'],['17:15','18:40'],['18:50','20:15']];
const KIND = {'Л':'Лекция','П':'Практика','ЛР':'Лабораторная'};
const $ = id => document.getElementById(id);
const escapeText = value => String(value == null ? '' : value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const bellIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg>';
let state, selectedDate, preparationDate, activeTab = 'day', searchQuery = '', modalType = '', lastFocus, toastTimeout, appliedNavigationToken = '';
const native = typeof window.Native !== 'undefined';
const now = () => Date.now();
function today() { const p={}; new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Moscow',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(now())).forEach(x=>p[x.type]=x.value); return p.year+'-'+p.month+'-'+p.day; }
function shiftDate(date,days) { const d=new Date(date+'T12:00:00Z'); d.setUTCDate(d.getUTCDate()+days); return d.toISOString().slice(0,10); }
const tomorrow = () => shiftDate(today(),1);
function prepDate() { return preparationDate || tomorrow(); }
function clockLabel(timestamp) { return new Intl.DateTimeFormat('ru-RU',{timeZone:'Europe/Moscow',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(timestamp)); }
function packingFor(date) {
  if (Array.isArray(state.preparations?.[date])) return state.preparations[date].map(x=>({...x}));
  const day=onDate(date).filter(l=>!l.cancelled);
  if (!day.length) return [];
  const config=state.packingDefaults || {general:[],subjects:[]};
  const subjects=day.map(l=>l.subject.toLocaleLowerCase('ru')).join('\n');
  return [...config.general,...config.subjects.filter(r=>r.matches.some(m=>subjects.includes(m)))].map(r=>({id:r.id,label:r.label,checked:false}));
}
function dateObject(date) { return new Date(date + 'T12:00:00+03:00'); }
function dateLabel(date, options) { return new Intl.DateTimeFormat('ru-RU',{timeZone:'Europe/Moscow',...options}).format(dateObject(date)); }
function capitalize(value) { return value ? value[0].toUpperCase() + value.slice(1) : value; }
function times(date, slot) { const d = dateObject(date).getUTCDay(); return (d === 0 || d === 6 ? BELL_WEEKEND : BELL_WEEKDAY)[slot - 1]; }
function prepareLesson(lesson) { const [start,end] = times(lesson.date,lesson.slot); return {...lesson,start,end,startMillis:Date.parse(lesson.date+'T'+start+':00+03:00'),endMillis:Date.parse(lesson.date+'T'+end+':00+03:00')}; }
function lessons() { return state.schedule.lessons.map(prepareLesson).sort((a,b) => a.date.localeCompare(b.date) || a.slot-b.slot); }
function nextLesson() { return lessons().find(l => !l.cancelled && l.endMillis > now()); }
function onDate(date) { return lessons().filter(l => l.date === date); }
function duration(mins) { return mins >= 60 ? Math.floor(mins/60)+' ч'+(mins%60 ? ' '+mins%60+' мин' : '') : mins+' мин'; }
function pairs(count) { return count === 1 ? '1 пара' : count >= 2 && count <= 4 ? count+' пары' : count+' пар'; }
function changeState(updated) {
  if (updated.error) { $('next-lesson').innerHTML = '<div class="empty-state"><h3>Не удалось открыть расписание</h3><p>'+escapeText(updated.error)+'</p><button class="primary-button" data-action="settings">Настройки</button></div>'; state = updated; return; }
  state = {eveningEnabled:true,eveningTime:'20:00',travelMinutes:-1,preparations:{},...updated};
  document.documentElement.dataset.theme = state.theme === 'system' ? (state.systemDark ? 'dark' : 'light') : (state.theme || 'light');
  if (!selectedDate) selectedDate = state.initialDate || (onDate(today()).some(l => !l.cancelled) ? today() : (nextLesson()?.date || today()));
  const token=state.navigationToken || (state.initialDate ? 'initial:'+state.initialDate+':'+state.initialScreen : '');
  if (state.initialDate && token !== appliedNavigationToken) {
    selectedDate=state.initialDate; activeTab=state.initialScreen==='prepare' ? 'prepare' : 'day';
    preparationDate=state.initialScreen==='prepare' ? state.initialDate : undefined; appliedNavigationToken=token;
    if (modalType) closeModal();
  }
  render();
  if (modalType === 'settings') renderSettings();
}
window.onNativeStateChanged = json => { try { changeState(typeof json === 'string' ? JSON.parse(json) : json); } catch (error) { toast('Не удалось обновить экран'); } };
function render() {
  if (!state?.schedule) return;
  $('group-label').textContent = state.schedule.group + ' · 1 курс';
  $('preview-banner').hidden = native;
  renderHero(); renderReminder(); renderDay(); renderPreparation(); renderAll(); renderBells();
  document.querySelectorAll('[data-tab]').forEach(b => { const active = b.dataset.tab === activeTab; b.classList.toggle('active',active); if (active) b.setAttribute('aria-current','page'); else b.removeAttribute('aria-current'); });
  ['day','prepare','all','bells'].forEach(t => $(t+'-panel').hidden = t !== activeTab);
  $('day-dashboard').hidden=activeTab!=='day';
  $('source-note').textContent = 'Время Москвы · ЗВС-26\nНажми на пару, чтобы открыть заметку или изменить занятие.';
}
function renderHero() {
  const lesson = nextLesson();
  if (!lesson) { $('next-lesson').innerHTML = '<div class="hero"><div class="hero-eyebrow"><span class="hero-dot"></span>Всё на сегодня</div><h2>В загруженном расписании больше нет будущих пар</h2><p class="hero-subtext">Добавь новое занятие или загрузи обновлённое расписание в настройках.</p></div>'; return; }
  const running = lesson.startMillis <= now();
  const sameDay = lesson.date === today();
  const caption = running ? 'Сейчас идёт' : 'Ближайшая пара';
  const when = sameDay ? (running ? 'До конца '+duration(Math.ceil((lesson.endMillis-now())/60000)) : 'Через '+duration(Math.ceil((lesson.startMillis-now())/60000))) : capitalize(dateLabel(lesson.date,{weekday:'short',day:'numeric',month:'short'}));
  $('next-lesson').innerHTML = '<button class="hero hero-link" data-hero-date="'+escapeText(lesson.date)+'"><div class="hero-eyebrow"><span class="hero-dot"></span>'+caption+' · '+escapeText(when)+'</div><h2>'+escapeText(lesson.subject)+'</h2><div class="hero-bottom"><p class="hero-time">'+lesson.start+'<span>— '+lesson.end+'</span></p><span class="hero-room">'+escapeText(lesson.room || 'Аудитория не указана')+'</span></div><p class="hero-subtext">'+lesson.slot+' пара · '+escapeText(KIND[lesson.kind])+' · '+escapeText(lesson.teacher)+'</p></button>';
}
function renderReminder() {
  let label;
  if (!state.enabled && !state.eveningEnabled) label = 'Напоминания выключены';
  else if (!state.notificationsAllowed) label = 'Разрешить уведомления';
  else if (!state.exactAllowed) label = 'Разрешить точное время напоминаний';
  else label = state.eveningEnabled ? 'Подготовка накануне в '+state.eveningTime : state.minutes ? 'Напомню за '+state.minutes+' мин до пары' : 'Напомню в начале пары';
  $('reminder-status').innerHTML = bellIcon+'<span>'+escapeText(label)+'</span><span class="chevron" aria-hidden="true">›</span>';
  const day=onDate(tomorrow()).filter(l=>!l.cancelled),items=packingFor(tomorrow()),remaining=items.filter(x=>!x.checked).length;
  $('tomorrow-preview').innerHTML='<span class="tomorrow-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="6" width="12" height="15" rx="3"/><path d="M9 6V3h6v3M9 13l2 2 4-5"/></svg></span><span><strong>Пары завтра</strong><small>'+(day.length ? pairs(day.length)+' · с '+day[0].start+'<br>'+(remaining ? 'Осталось собрать: '+remaining : 'Всё собрано ✓') : dateLabel(tomorrow(),{day:'numeric',month:'long'})+' · данных пока нет')+'</small></span><span class="chevron" aria-hidden="true">›</span>';
  $('prep-nav-dot').hidden=!day.length || !remaining;
}
function renderPreparation() {
  const date=prepDate(),all=onDate(date),day=all.filter(l=>!l.cancelled),isTomorrow=date===tomorrow(),isToday=date===today();
  const title=isTomorrow ? 'Пары завтра' : isToday ? 'Подготовка на сегодня' : 'Подготовка к парам';
  const header='<div class="prep-heading"><div><p class="eyebrow">'+escapeText(capitalize(dateLabel(date,{weekday:'long',day:'numeric',month:'long'})))+'</p><h2>'+title+'</h2></div>'+(isTomorrow ? '' : '<button class="text-button" data-open-tomorrow>Завтра</button>')+'</div>';
  if (!day.length) {
    const known=(state.schedule.sourceDates || []).includes(date) || all.length>0;
    const next=lessons().find(l=>!l.cancelled && l.date>date);
    $('preparation-content').innerHTML=header+'<div class="prep-empty"><span class="empty-symbol" aria-hidden="true">'+(known ? '✓' : '…')+'</span><h3>'+(known ? 'Активных пар нет' : 'На этот день данных нет')+'</h3><p>'+(known ? 'В расписании нет занятий, к которым нужно подготовиться.' : 'Добавь пары на эту дату или загрузи обновлённое расписание.')+'</p><button class="secondary-button" data-prep-schedule="'+date+'">Открыть этот день</button></div>'+(next ? '<button class="next-study-card" data-prepare-date="'+next.date+'"><span class="eyebrow">Ближайший учебный день</span><strong>'+escapeText(capitalize(dateLabel(next.date,{weekday:'short',day:'numeric',month:'long'})))+'</strong><span>'+pairs(onDate(next.date).filter(l=>!l.cancelled).length)+' · подготовиться →</span></button>' : '');
    return;
  }
  const first=day[0],last=day[day.length-1],items=packingFor(date),checked=items.filter(x=>x.checked).length,remaining=items.length-checked;
  const departure=state.travelMinutes>=0 ? clockLabel(first.startMillis-state.travelMinutes*60000) : '';
  const notes=day.filter(l=>l.note);
  const checklist=items.map(item=>'<label class="packing-row'+(item.checked ? ' packed' : '')+'"><input type="checkbox" id="pack-'+escapeText(item.id)+'" data-pack-id="'+escapeText(item.id)+'" '+(item.checked ? 'checked' : '')+'><span>'+escapeText(item.label)+'</span></label>').join('');
  $('preparation-content').innerHTML=header+
    '<div class="prep-summary"><span class="prep-count">'+pairs(day.length)+'</span><p>Первая аудитория <strong>'+escapeText(first.room || 'не указана')+'</strong></p><div class="prep-hours"><div><span>Начало</span><strong>'+first.start+'</strong></div><span class="hours-line" aria-hidden="true"></span><div><span>Конец</span><strong>'+last.end+'</strong></div></div></div>'+
    '<button class="departure-card" id="travel-button"><span class="departure-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M3 12h17m-6-6 6 6-6 6"/></svg></span><span><strong>'+(departure ? 'Выйти в '+departure : 'Во сколько выйти?')+'</strong><small>'+(departure ? 'На дорогу '+state.travelMinutes+' мин · изменить' : 'Укажи время на дорогу — рассчитаю выход')+'</small></span><span class="chevron" aria-hidden="true">›</span></button>'+
    '<section class="packing-card" aria-labelledby="packing-title"><div class="section-heading"><div><p class="eyebrow">Собери вечером</p><h3 id="packing-title">Что взять с собой</h3></div><button class="text-button" id="edit-packing">Изменить</button></div><div class="packing-progress"><span>'+(remaining ? 'Собрано '+checked+' из '+items.length : items.length ? 'Всё собрано. Можно отдыхать ✓' : 'Добавь вещи в свой список')+'</span><span>'+Math.round(items.length ? checked/items.length*100 : 0)+'%</span></div><div class="progress-track" role="progressbar" aria-label="Вещи собраны" aria-valuemin="0" aria-valuemax="'+Math.max(items.length,1)+'" aria-valuenow="'+checked+'"><div class="progress-fill progress-'+Math.round(items.length ? checked/items.length*100 : 0)+'"></div></div><div id="packing-list">'+checklist+'</div><p class="packing-hint">Стартовый список по предметам. Удали лишнее и добавь своё. Галочки сохраняются отдельно для каждого дня.</p></section>'+
    (notes.length ? '<section class="prep-notes"><h3>Не забыть по учёбе</h3>'+notes.map(l=>'<button data-lesson="'+escapeText(l.id)+'"><strong>'+escapeText(l.subject)+'</strong><span>'+escapeText(l.note)+'</span></button>').join('')+'</section>' : '')+
    '<div class="section-heading prep-lessons-heading"><h3>Пары по порядку</h3><button class="text-button" data-prep-schedule="'+date+'">Расписание</button></div><div class="prep-lessons">'+day.map(l=>'<button class="prep-lesson" data-lesson="'+escapeText(l.id)+'"><span class="prep-lesson-time">'+l.start+'<small>'+l.slot+' пара</small></span><span><strong>'+escapeText(l.subject)+'</strong><small>'+escapeText(KIND[l.kind])+' · '+escapeText(l.teacher)+'</small></span><span class="prep-room">'+escapeText(l.room || '—')+'</span></button>').join('')+'</div>'+
    '<button class="evening-footnote" data-action="settings">'+bellIcon+'<span>'+(state.eveningEnabled ? 'Напомню накануне в '+escapeText(state.eveningTime)+(state.notificationsAllowed ? '' : ' · разрешить уведомления') : 'Включить напоминание накануне')+'</span></button>';
  // CSP disallows inline style attributes; width is set through the CSSOM.
  document.querySelector('.progress-fill').style.width=Math.round(items.length ? checked/items.length*100 : 0)+'%';
}
function calendarDates() {
  const dates = new Set([...(state.schedule.sourceDates || []), ...lessons().map(l => l.date), selectedDate]);
  const start = state.schedule.coverageStart, end = state.schedule.coverageEnd;
  if (start && end && Date.parse(end)-Date.parse(start) <= 45*86400000) {
    for (let date = start; date <= end;) { dates.add(date); const d = new Date(date+'T12:00:00Z'); d.setUTCDate(d.getUTCDate()+1); date = d.toISOString().slice(0,10); }
  }
  return [...dates].sort();
}
function renderDay() {
  $('month-label').textContent = capitalize(dateLabel(selectedDate,{month:'long',year:'numeric'}).replace(' г.',''));
  $('day-strip').innerHTML = calendarDates().map(date => '<button class="date-chip'+(date === selectedDate ? ' selected' : '')+(date === today() ? ' today' : '')+(onDate(date).some(l => !l.cancelled) ? '' : ' empty')+'" data-date="'+date+'" aria-label="'+escapeText(dateLabel(date,{weekday:'long',day:'numeric',month:'long'}))+'"'+(date === selectedDate ? ' aria-pressed="true"' : ' aria-pressed="false"')+'><span class="weekday">'+capitalize(dateLabel(date,{weekday:'short'}))+'</span><span class="number">'+Number(date.slice(-2))+'</span><span class="dot" aria-hidden="true"></span></button>').join('');
  $('day-title').textContent = capitalize(dateLabel(selectedDate,{weekday:'long',day:'numeric',month:'long'}));
  const all = onDate(selectedDate), active = all.filter(l => !l.cancelled);
  $('day-summary').textContent = active.length ? pairs(active.length)+' · '+active[0].start+'–'+active[active.length-1].end : all.length || (state.schedule.sourceDates || []).includes(selectedDate) ? 'В этот день нет активных пар' : 'Расписание на эту дату не загружено';
  if (!all.length) {
    const known = (state.schedule.sourceDates || []).includes(selectedDate);
    $('timeline').innerHTML = '<div class="empty-state"><h3>'+(known ? 'Нет занятий' : 'На этот день данных нет')+'</h3><p>'+(known ? 'Можно добавить новую пару.' : 'Этот день не указан в исходнике. Можно добавить занятие вручную.')+'</p><button class="primary-button" data-action="add">Добавить пару</button></div>';
    return;
  }
  let previous;
  $('timeline').innerHTML = all.map(lesson => {
    let gap = '';
    if (!lesson.cancelled) {
      if (previous) {
        const minutes = Math.round((lesson.startMillis-previous.endMillis)/60000);
        if (minutes >= 30) gap = '<div class="break"><strong>'+(lesson.slot-previous.slot > 1 ? 'Окно' : 'Перерыв')+' · '+duration(minutes)+'</strong><br>'+previous.end+'–'+lesson.start+'</div>';
      }
      previous = lesson;
    }
    return gap + lessonCard(lesson);
  }).join('');
}
function lessonCard(l) {
  const current = !l.cancelled && l.startMillis <= now() && l.endMillis > now();
  const upcoming = nextLesson()?.id === l.id && !current;
  return '<button class="lesson'+(current ? ' current' : '')+(l.endMillis <= now() ? ' past' : '')+(l.cancelled ? ' cancelled' : '')+'" data-lesson="'+escapeText(l.id)+'" aria-label="'+escapeText(l.slot+' пара, '+l.start+', '+l.subject+', '+l.room)+'"><span class="lesson-clock"><strong>'+l.start+'</strong><small>'+l.end+'</small><span class="slot">'+l.slot+' пара</span></span><span class="lesson-content"><h3>'+escapeText(l.subject)+'</h3><p class="lesson-teacher">'+escapeText(l.teacher || 'Преподаватель не указан')+'</p><span class="lesson-meta"><span class="pill room">'+escapeText(l.room || 'Аудитория —')+'</span><span class="pill">'+escapeText(KIND[l.kind])+'</span>'+(current ? '<span class="pill current-label">Сейчас</span>' : upcoming ? '<span class="pill current-label">Следующая</span>' : '')+(l.cancelled ? '<span class="pill">Отменена</span>' : '')+(l.muted ? '<span class="pill">Без напоминания</span>' : '')+'</span>'+(l.note ? '<p class="lesson-note">'+escapeText(l.note)+'</p>' : '')+'</span></button>';
}
function renderAll() {
  const list = lessons();
  if (searchQuery.trim()) {
    const q = searchQuery.trim().toLocaleLowerCase('ru');
    const matched = list.filter(l => [l.subject,l.teacher,l.room,l.note].some(v => String(v || '').toLocaleLowerCase('ru').includes(q)));
    let date = '';
    $('all-days').innerHTML = matched.length ? matched.map(l => { const heading = date !== l.date ? '<h3 class="search-date">'+escapeText(capitalize(dateLabel(l.date,{weekday:'long',day:'numeric',month:'long'})))+'</h3>' : ''; date=l.date; return heading+lessonCard(l); }).join('') : '<div class="empty-state"><h3>Ничего не найдено</h3><p>Попробуй название предмета или номер аудитории.</p></div>';
  } else {
    const dates = [...new Set(list.map(l=>l.date))].sort();
    $('all-days').innerHTML = dates.map(date => { const items=onDate(date).filter(l=>!l.cancelled); return '<button class="week-row" data-overview-date="'+date+'"><div><strong>'+escapeText(capitalize(dateLabel(date,{weekday:'short',day:'numeric',month:'long'})))+'</strong><p>'+(items.length ? items[0].start+'–'+items[items.length-1].end+' · '+escapeText([...new Set(items.map(l=>l.subject))].join(', ')) : 'Все занятия отменены')+'</p></div><span class="week-count">'+pairs(items.length)+' ›</span></button>'; }).join('') || '<div class="empty-state"><h3>Расписание пустое</h3><p>Добавь первую пару на вкладке «День».</p></div>';
  }
}
function renderBells() {
  $('bells-panel').innerHTML = [{title:'По будням',caption:'Понедельник — пятница',rows:BELL_WEEKDAY},{title:'По выходным',caption:'Суббота и воскресенье',rows:BELL_WEEKEND}].map(x => '<h2 class="bell-heading">'+x.title+'</h2><p class="bell-caption">'+x.caption+' · московское время</p><div class="bell-table">'+x.rows.map((row,i) => '<div class="bell-row"><span>'+ (i+1)+' пара</span><strong>'+row[0]+'–'+row[1]+'</strong></div>').join('')+'</div>').join('');
}
function showModal(type,title,content) {
  lastFocus = document.activeElement; modalType = type;
  $('modal-title').textContent = title; $('modal-content').innerHTML = content;
  $('modal-overlay').hidden = false; document.body.style.overflow = 'hidden';
  $('modal-overlay').querySelector('.modal').scrollTop = 0;
  setTimeout(() => $('modal-close').focus(),0);
}
function closeModal() { $('modal-overlay').hidden=true; document.body.style.overflow=''; modalType=''; if (lastFocus?.isConnected) lastFocus.focus(); }
window.handleAndroidBack = () => { if (modalType) { closeModal(); return true; } if (activeTab !== 'day') { activeTab='day'; render(); return true; } return false; };
function openSettings() { showModal('settings','Настройки',''); renderSettings(); }
function renderSettings() {
  if (!state?.schedule) { $('modal-content').innerHTML='<button class="primary-button" id="restore-original">Восстановить исходное расписание</button>'; return; }
  const hint=state.schedulerError ? escapeText(state.schedulerError) : !state.notificationsAllowed ? 'Разреши уведомления, чтобы получать напоминания.' : !state.exactAllowed ? 'Для выбранного времени разреши будильники и напоминания. Сейчас Android может задерживать доставку.' : 'Напоминаний в очереди: '+state.scheduledCount+'.';
  const canTest=native && state.notificationsAllowed;
  $('modal-content').innerHTML=
    '<p class="modal-description">Вечером — план на завтра и список вещей. Перед парой — предмет, время и аудитория.</p>'+
    '<div class="setting-card"><label class="setting-title">Накануне учебного дня<input class="switch" id="evening-toggle" type="checkbox" '+(state.eveningEnabled?'checked':'')+' aria-label="Напоминать накануне"></label><label class="field">Время вечером · Москва<input type="time" id="evening-time" value="'+escapeText(state.eveningTime)+'" required></label><p class="settings-hint">По умолчанию в 20:00 за день до пар. Уведомление покажет завтрашние занятия и вещи, которые ещё не отмечены в списке.</p>'+(state.eveningChannelAllowed===false && state.notificationsAllowed ? '<p class="channel-warning">Вечерние уведомления отключены в Android. Открой «Звук и вибрация» ниже.</p>' : '')+'<button class="secondary-button" id="test-evening" '+(!canTest || state.eveningChannelAllowed===false ? 'disabled' : '')+'>Проверить вечернее через 10 секунд</button><button class="text-button" id="evening-channel">Звук и вибрация вечером</button></div>'+
    '<div class="setting-card"><label class="setting-title">Перед каждой парой<input class="switch" id="notification-toggle" type="checkbox" '+(state.enabled?'checked':'')+' aria-label="Напоминать перед каждой парой"></label><label class="field">Когда напомнить<select id="reminder-minutes">'+[0,5,10,15,30,60,90,120,180].map(n=>'<option value="'+n+'" '+(state.minutes===n?'selected':'')+'>'+(n ? 'За '+n+' минут' : 'В начале пары')+'</option>').join('')+'</select></label>'+(state.lessonChannelAllowed===false && state.notificationsAllowed ? '<p class="channel-warning">Уведомления перед парой отключены в Android.</p>' : '')+'<button class="secondary-button" id="test-notification" '+(!canTest || state.lessonChannelAllowed===false ? 'disabled' : '')+'>Проверить через 10 секунд</button><button class="text-button" id="notification-channel">Звук и вибрация перед парой</button></div>'+
    '<div class="setting-card"><div class="setting-title">Разрешения телефона</div><div class="permission-row"><div><strong>Уведомления</strong><p>Для обоих видов напоминаний</p></div>'+(state.notificationsAllowed ? '<span class="status-ok">Разрешены</span>' : '<button class="text-button" id="grant-notifications">Разрешить</button>')+'</div><div class="permission-row"><div><strong>Точное время</strong><p>Будильники и напоминания Android</p></div>'+(state.exactAllowed ? '<span class="status-ok">Разрешено</span>' : '<button class="text-button" id="grant-exact">Разрешить</button>')+'</div><p class="settings-hint">'+hint+'</p></div>'+
    '<div class="setting-card"><div class="setting-title">Дорога на учёбу</div><p class="settings-hint">'+(state.travelMinutes>=0 ? 'На дорогу '+state.travelMinutes+' мин. Время выхода видно на экране подготовки.' : 'Укажи время от дома до аудитории, чтобы видеть время выхода.')+'</p><button class="secondary-button" id="settings-travel">Изменить время на дорогу</button></div>'+
    '<div class="setting-card"><label class="field">Оформление<select id="theme-select"><option value="system" '+(state.theme==='system'?'selected':'')+'>Как на телефоне</option><option value="light" '+(state.theme==='light'?'selected':'')+'>Светлое</option><option value="dark" '+(state.theme==='dark'?'selected':'')+'>Тёмное</option></select></label><p class="settings-hint">Время расписания — Москва (UTC+3).</p></div>'+
    '<div class="setting-card"><div class="setting-title">Расписание</div><p class="settings-hint">Группа '+escapeText(state.schedule.group)+'. Из скриншотов загружены занятия с 5 по 14 октября 2026 года. Новые пары можно добавлять вручную.</p><button class="secondary-button" id="export-schedule">Сохранить расписание в файл</button><button class="secondary-button" id="import-schedule">Загрузить расписание из файла</button><button class="danger-button" id="restore-original">Восстановить исходное расписание</button></div><p class="settings-meta">Мои пары · версия 1.1.0<br>Работает офлайн. Данные остаются на телефоне.<br>После принудительной остановки в Android открой приложение снова.</p>';
}
function openTravel() {
  showModal('travel','Время на дорогу','<form id="travel-form"><p class="modal-description">Сколько минут нужно от дома до аудитории? Учти пересадки и небольшой запас.</p><label class="field">Минуты в пути<input type="number" name="travel" min="0" max="240" step="1" inputmode="numeric" value="'+(state.travelMinutes>=0 ? state.travelMinutes : '')+'" placeholder="Например, 30" required></label><button class="primary-button" type="submit">Сохранить</button><button class="text-button" id="reset-travel" type="button">Не рассчитывать время выхода</button></form>');
}
function packingEditorRow(item) {
  return '<div class="pack-editor-row" data-item-id="'+escapeText(item.id)+'" data-checked="'+Boolean(item.checked)+'"><input class="pack-label" aria-label="Название вещи" value="'+escapeText(item.label)+'" maxlength="180" required><button type="button" class="icon-button remove-pack-item" aria-label="Удалить вещь"><svg viewBox="0 0 24 24"><path d="m6 6 12 12M18 6 6 18"/></svg></button></div>';
}
function openPackingEditor() {
  const date=prepDate();
  showModal('packing','Твой список вещей','<form id="packing-form" data-packing-date="'+date+'"><p class="modal-description">'+escapeText(capitalize(dateLabel(date,{day:'numeric',month:'long'})))+'. Добавь своё и убери лишнее. Отметки о собранных вещах сохранятся.</p><div id="packing-editor-items">'+packingFor(date).map(packingEditorRow).join('')+'</div><button type="button" class="secondary-button" id="add-pack-item">+ Добавить вещь</button><p class="form-error" id="form-error" hidden></p><div class="form-actions"><button type="submit" class="primary-button">Сохранить список</button><button type="button" class="text-button" id="reset-packing">Вернуть стартовый список</button></div></form>');
}
function openPreparation(date) { preparationDate=date===tomorrow() ? undefined : date; activeTab='prepare'; render(); window.scrollTo({top:0,behavior:'auto'}); }
function editLesson(id) {
  const old = id ? lessons().find(l=>l.id===id) : null;
  const used=onDate(selectedDate).map(l=>l.slot);
  const l=old || {id:'',subject:'',date:selectedDate,slot:[1,2,3,4,5,6,7].find(n=>!used.includes(n)) || 1,kind:'П',room:'',teacher:'',note:'',muted:false,cancelled:false};
  showModal('edit',old?'Изменить пару':'Новая пара','<form id="lesson-form"><input type="hidden" name="id" value="'+escapeText(l.id)+'"><label class="field">Предмет<input name="subject" value="'+escapeText(l.subject)+'" maxlength="180" required autocomplete="off"></label><div class="field-row"><label class="field">Дата<input type="date" name="date" value="'+l.date+'" min="2000-01-01" max="2100-12-31" required></label><label class="field">Номер пары<select name="slot">'+[1,2,3,4,5,6,7].map(n=>'<option value="'+n+'" '+(l.slot===n?'selected':'')+'>'+n+' пара</option>').join('')+'</select></label></div><p class="modal-description" id="form-times"></p><div class="field-row"><label class="field">Аудитория<input name="room" value="'+escapeText(l.room)+'" maxlength="80" placeholder="Например, Г-407"></label><label class="field">Тип занятия<select name="kind">'+Object.entries(KIND).map(([key,label])=>'<option value="'+key+'" '+(l.kind===key?'selected':'')+'>'+label+'</option>').join('')+'</select></label></div><label class="field">Преподаватель<input name="teacher" value="'+escapeText(l.teacher)+'" maxlength="120" placeholder="Фамилия и инициалы"></label><label class="field">Заметка<textarea name="note" maxlength="2000" placeholder="Что взять с собой, домашнее задание…">'+escapeText(l.note)+'</textarea></label><label class="check-row"><input type="checkbox" name="muted" '+(l.muted?'checked':'')+'>Без напоминания об этой паре</label><label class="check-row"><input type="checkbox" name="cancelled" '+(l.cancelled?'checked':'')+'>Пара отменена</label><p class="form-error" id="form-error" hidden></p><div class="form-actions"><button class="primary-button" type="submit">Сохранить</button>'+(old?'<button class="danger-button" id="delete-lesson" type="button" data-id="'+escapeText(l.id)+'">Удалить пару</button>':'')+'</div></form>');
  updateFormTimes();
}
function updateFormTimes() {
  const form=$('lesson-form'); if (!form) return;
  try { const [start,end]=times(form.elements.date.value,Number(form.elements.slot.value)); $('form-times').textContent=start+'–'+end+' · Москва · '+(dateObject(form.elements.date.value).getUTCDay() % 6 === 0 ? 'звонки выходного дня' : 'звонки буднего дня'); } catch (_) { $('form-times').textContent='Выберите дату и номер пары'; }
}
function previewMutation(method,payload) {
  const next=JSON.parse(JSON.stringify(state));
  if (method==='setPreferences') Object.assign(next,JSON.parse(payload));
  if (method==='saveLesson') { const l=JSON.parse(payload); if (!l.id) l.id='preview-'+Date.now(); next.schedule.lessons=next.schedule.lessons.filter(x=>x.id!==l.id); next.schedule.lessons.push(l); }
  if (method==='deleteLesson') next.schedule.lessons=next.schedule.lessons.filter(l=>l.id!==payload);
  if (method==='savePreparation') { const plan=JSON.parse(payload); next.preparations[plan.date]=plan.items; }
  if (method==='resetPreparation') delete next.preparations[payload];
  if (method==='restoreOriginal') return null;
  return {ok:true,state:next};
}
function mutate(method,payload) {
  try { const result = native ? JSON.parse(payload === undefined ? window.Native[method]() : window.Native[method](payload)) : previewMutation(method,payload); if (!result) return false; if (!result.ok) { if ($('form-error')) { $('form-error').textContent=result.error; $('form-error').hidden=false; } else toast(result.error); return false; } changeState(result.state); return true; } catch (_) { toast('Не удалось сохранить изменения'); return false; }
}
function systemAction(method) { if (!native) { toast('Эта функция доступна в APK'); return; } try { window.Native[method](); } catch (_) { toast('Не удалось открыть настройки Android'); } }
function toast(message) { $('toast').textContent=message; $('toast').hidden=false; clearTimeout(toastTimeout); toastTimeout=setTimeout(()=>$('toast').hidden=true,3500); }
function selectDate(date) { selectedDate=date; activeTab='day'; render(); requestAnimationFrame(()=>{ const selected=document.querySelector('.date-chip.selected'); selected?.scrollIntoView({block:'nearest',inline:'center'}); }); }

document.addEventListener('click',event=>{
  const b=event.target.closest('button'); if (!b) return;
  if (b.dataset.tab) { if (b.dataset.tab==='prepare') preparationDate=undefined; activeTab=b.dataset.tab; render(); window.scrollTo({top:0,behavior:'auto'}); }
  if (b.hasAttribute('data-open-tomorrow')) openPreparation(tomorrow());
  if (b.dataset.prepareDate) openPreparation(b.dataset.prepareDate);
  if (b.dataset.prepSchedule) selectDate(b.dataset.prepSchedule);
  if (b.id==='prepare-day') openPreparation(selectedDate);
  if (b.id==='travel-button' || b.id==='settings-travel') openTravel();
  if (b.id==='reset-travel') { if (mutate('setPreferences',JSON.stringify({travelMinutes:-1}))) closeModal(); }
  if (b.id==='edit-packing') openPackingEditor();
  if (b.classList.contains('remove-pack-item')) b.closest('.pack-editor-row').remove();
  if (b.id==='add-pack-item') {
    if (document.querySelectorAll('.pack-editor-row').length>=60) { toast('В списке может быть до 60 вещей'); return; }
    $('packing-editor-items').insertAdjacentHTML('beforeend',packingEditorRow({id:'custom-'+Date.now()+'-'+Math.random().toString(36).slice(2,8),label:'',checked:false}));
    $('packing-editor-items').lastElementChild.querySelector('input').focus();
  }
  if (b.id==='reset-packing' && confirm('Вернуть стартовый список и снять галочки для этого дня?')) {
    const date=$('packing-form').dataset.packingDate;
    if (mutate('resetPreparation',date)) { $('packing-editor-items').innerHTML=packingFor(date).map(packingEditorRow).join(''); toast('Стартовый список восстановлен'); }
  }
  if (b.dataset.date) selectDate(b.dataset.date);
  if (b.dataset.overviewDate) selectDate(b.dataset.overviewDate);
  if (b.dataset.heroDate) selectDate(b.dataset.heroDate);
  if (b.dataset.lesson) editLesson(b.dataset.lesson);
  if (b.id==='settings-button' || b.dataset.action==='settings' || b.id==='reminder-status') openSettings();
  if (b.id==='modal-close') closeModal();
  if (b.id==='add-button' || b.dataset.action==='add') editLesson();
  if (b.id==='today-button') selectDate(today());
  if (b.id==='calendar-button') showModal('calendar','Выбрать дату','<form id="date-form"><label class="field">Дата<input id="picked-date" type="date" value="'+selectedDate+'" min="2000-01-01" max="2100-12-31" required></label><button class="primary-button" type="submit">Открыть день</button></form>');
  const actions={'grant-notifications':'requestNotifications','grant-exact':'requestExactAlarms','test-notification':'testNotification','test-evening':'testEveningNotification','notification-channel':'openNotificationSettings','evening-channel':'openEveningNotificationSettings','export-schedule':'exportSchedule','import-schedule':'importSchedule'};
  if (actions[b.id]) systemAction(actions[b.id]);
  if (b.id==='delete-lesson' && confirm('Удалить эту пару из расписания?')) { if (mutate('deleteLesson',b.dataset.id)) { closeModal(); toast('Пара удалена'); } }
  if (b.id==='restore-original' && confirm('Восстановить расписание из скриншотов? Все твои правки будут удалены.')) { if (!native) { toast('Восстановление доступно в APK'); return; } if (mutate('restoreOriginal')) { closeModal(); toast('Исходное расписание восстановлено'); } }
});
$('modal-overlay').addEventListener('click',e=>{ if (e.target===$('modal-overlay')) closeModal(); });
document.addEventListener('keydown',e=>{
  if (e.key==='Escape') { if (modalType) { closeModal(); e.preventDefault(); } }
  if (e.key==='Tab' && modalType) {
    const nodes=[...$('modal-overlay').querySelectorAll('button:not(:disabled),input:not([type=hidden]),select,textarea')].filter(n=>n.offsetParent!==null);
    const first=nodes[0], last=nodes[nodes.length-1];
    if (e.shiftKey && document.activeElement===first) { last?.focus(); e.preventDefault(); }
    else if (!e.shiftKey && document.activeElement===last) { first?.focus(); e.preventDefault(); }
  }
});
document.addEventListener('change',e=>{
  if (e.target.id==='notification-toggle') { const enabled=e.target.checked; if (mutate('setPreferences',JSON.stringify({enabled})) && enabled && !state.notificationsAllowed) systemAction('requestNotifications'); }
  if (e.target.id==='reminder-minutes') mutate('setPreferences',JSON.stringify({minutes:Number(e.target.value)}));
  if (e.target.id==='theme-select') mutate('setPreferences',JSON.stringify({theme:e.target.value}));
  if (e.target.id==='evening-toggle') { const eveningEnabled=e.target.checked; if (mutate('setPreferences',JSON.stringify({eveningEnabled})) && eveningEnabled && !state.notificationsAllowed) systemAction('requestNotifications'); }
  if (e.target.id==='evening-time' && e.target.validity.valid && e.target.value) mutate('setPreferences',JSON.stringify({eveningTime:e.target.value}));
  if (e.target.dataset.packId) {
    const id=e.target.dataset.packId,items=packingFor(prepDate()).map(item=>item.id===id ? {...item,checked:e.target.checked} : item);
    mutate('savePreparation',JSON.stringify({date:prepDate(),items})); $('pack-'+id)?.focus({preventScroll:true});
  }
  if (e.target.closest('#lesson-form') && ['date','slot'].includes(e.target.name)) updateFormTimes();
});
$('search').addEventListener('input',e=>{ searchQuery=e.target.value; renderAll(); });
document.addEventListener('submit',e=>{
  if (e.target.matches('#travel-form')) {
    e.preventDefault(); const travelMinutes=Number(e.target.elements.travel.value);
    if (Number.isInteger(travelMinutes) && travelMinutes>=0 && travelMinutes<=240 && mutate('setPreferences',JSON.stringify({travelMinutes}))) { closeModal(); toast('Время выхода рассчитано'); }
  }
  if (e.target.matches('#packing-form')) {
    e.preventDefault();
    const items=[...e.target.querySelectorAll('.pack-editor-row')].map(row=>({id:row.dataset.itemId,label:row.querySelector('input').value.trim(),checked:row.dataset.checked==='true'}));
    if (items.some(item=>!item.label)) { $('form-error').textContent='Укажи название вещи или удали пустую строку'; $('form-error').hidden=false; return; }
    if (mutate('savePreparation',JSON.stringify({date:e.target.dataset.packingDate,items}))) { closeModal(); toast('Список сохранён'); }
  }
  if (e.target.matches('#date-form')) { e.preventDefault(); const date=$('picked-date').value; if (date) { closeModal(); selectDate(date); } }
  if (e.target.matches('#lesson-form')) {
    e.preventDefault(); const f=e.target.elements;
    const l={id:f.id.value,date:f.date.value,slot:Number(f.slot.value),subject:f.subject.value.trim(),kind:f.kind.value,room:f.room.value.trim(),teacher:f.teacher.value.trim(),note:f.note.value.trim(),muted:f.muted.checked,cancelled:f.cancelled.checked};
    if (!l.subject || !l.date) return;
    if (lessons().some(x=>x.id!==l.id && x.date===l.date && x.slot===l.slot)) { $('form-error').textContent='На эту дату и номер пары уже есть занятие. Измени его или выбери другое время.'; $('form-error').hidden=false; return; }
    if (mutate('saveLesson',JSON.stringify(l))) { closeModal(); if (activeTab!=='prepare') selectDate(l.date); toast('Пара сохранена'); }
  }
});
setInterval(()=>{ if (state?.schedule && !document.hidden && !modalType) render(); },30000);
document.addEventListener('visibilitychange',()=>{ if (!document.hidden && state?.schedule) { if (native) window.onNativeStateChanged(window.Native.getState()); else render(); } });
async function initialize() {
  try { if (native) window.onNativeStateChanged(window.Native.getState()); else { const [schedule,packingDefaults]=await Promise.all(['schedule.json','packing-defaults.json'].map(async file=>(await fetch(file)).json())); changeState({schedule,packingDefaults,theme:'system',systemDark:matchMedia('(prefers-color-scheme: dark)').matches,minutes:15,enabled:true,notificationsAllowed:false,exactAllowed:false,scheduledCount:0,platform:'preview'}); } }
  catch (_) { $('next-lesson').innerHTML='<div class="empty-state"><h3>Расписание не загрузилось</h3><p>Закрой и снова открой приложение.</p></div>'; }
}
initialize();
