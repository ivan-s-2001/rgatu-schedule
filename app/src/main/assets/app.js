'use strict';
const BELL_WEEKDAY = [['08:30','10:05'],['10:15','11:50'],['12:40','14:15'],['14:25','16:00'],['16:10','17:45'],['18:00','19:25'],['19:35','21:00']];
const BELL_WEEKEND = [['08:30','10:05'],['10:15','11:50'],['12:00','13:35'],['13:45','15:20'],['15:30','17:05'],['17:15','18:40'],['18:50','20:15']];
const KIND = {'Л':'Лекция','П':'Практика','ЛР':'Лабораторная'};
const $ = id => document.getElementById(id);
const escapeText = value => String(value == null ? '' : value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const bellIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg>';
let state, selectedDate, activeTab = 'day', searchQuery = '', modalType = '', lastFocus, toastTimeout, initialApplied = false;
const native = typeof window.Native !== 'undefined';
const now = () => Date.now();
function today() { const p={}; new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Moscow',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(now())).forEach(x=>p[x.type]=x.value); return p.year+'-'+p.month+'-'+p.day; }
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
  state = updated;
  document.documentElement.dataset.theme = state.theme === 'system' ? (state.systemDark ? 'dark' : 'light') : (state.theme || 'light');
  if (!selectedDate) selectedDate = state.initialDate || (onDate(today()).some(l => !l.cancelled) ? today() : (nextLesson()?.date || today()));
  if (state.initialDate && !initialApplied) { selectedDate = state.initialDate; activeTab = 'day'; initialApplied = true; }
  render();
  if (modalType === 'settings') renderSettings();
}
window.onNativeStateChanged = json => { try { changeState(typeof json === 'string' ? JSON.parse(json) : json); } catch (error) { toast('Не удалось обновить экран'); } };
function render() {
  if (!state?.schedule) return;
  $('group-label').textContent = state.schedule.group + ' · 1 курс';
  $('preview-banner').hidden = native;
  renderHero(); renderReminder(); renderDay(); renderAll(); renderBells();
  document.querySelectorAll('[data-tab]').forEach(b => { const active = b.dataset.tab === activeTab; b.classList.toggle('active',active); if (active) b.setAttribute('aria-current','page'); else b.removeAttribute('aria-current'); });
  ['day','all','bells'].forEach(t => $(t+'-panel').hidden = t !== activeTab);
  $('source-note').textContent = 'Расписание по московскому времени · Из твоих скриншотов\nЛ — лекция, П — практика, ЛР — лабораторная. Нажми на пару, чтобы изменить её.';
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
  if (!state.enabled) label = 'Напоминания выключены';
  else if (!state.notificationsAllowed) label = 'Включить уведомления перед парами';
  else if (!state.exactAllowed) label = 'Разрешить точное время напоминаний';
  else label = state.minutes ? 'Напомню за '+state.minutes+' мин до пары' : 'Напомню в начале пары';
  $('reminder-status').innerHTML = bellIcon+'<span>'+escapeText(label)+'</span><span class="chevron" aria-hidden="true">›</span>';
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
  $('day-summary').textContent = active.length ? pairs(active.length)+' · '+active[0].start+'–'+active[active.length-1].end : 'В этот день нет активных пар';
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
  $('modal-content').innerHTML = '<p class="modal-description">Напоминание содержит предмет, аудиторию и время. Оно приходит и при закрытом приложении.</p>'+(!native ? '<p class="modal-description">Это предпросмотр. Системные разрешения и напоминания доступны в APK.</p>' : '')+'<div class="setting-card"><label class="setting-title">Перед каждой парой<input class="switch" id="notification-toggle" type="checkbox" '+(state.enabled?'checked':'')+' aria-label="Напоминать перед каждой парой"></label><label class="field">Когда напомнить<select id="reminder-minutes">'+[0,5,10,15,30,60,90,120,180].map(n=>'<option value="'+n+'" '+(state.minutes===n?'selected':'')+'>'+(n ? 'За '+n+' минут' : 'В начале пары')+'</option>').join('')+'</select></label><div class="permission-row"><div><strong>Уведомления</strong><p>Показать предмет и аудиторию</p></div>'+(state.notificationsAllowed ? '<span class="status-ok">Разрешены</span>' : '<button class="text-button" id="grant-notifications">Разрешить</button>')+'</div><div class="permission-row"><div><strong>Точное время</strong><p>Будильники и напоминания Android</p></div>'+(state.exactAllowed ? '<span class="status-ok">Разрешено</span>' : '<button class="text-button" id="grant-exact">Разрешить</button>')+'</div><p class="settings-hint">'+(state.schedulerError ? escapeText(state.schedulerError) : !state.enabled ? 'Напоминания выключены.' : !state.notificationsAllowed ? 'Пока уведомления не разрешены, напоминания не придут.' : !state.exactAllowed ? 'Пока точное время не разрешено, Android может задерживать уведомления.' : 'Запланировано напоминаний: '+state.scheduledCount+'.')+'</p><button class="secondary-button" id="test-notification" '+(!native || !state.notificationsAllowed ? 'disabled' : '')+'>Проверить через 10 секунд</button><button class="text-button" id="notification-channel">Звук и вибрация</button></div><div class="setting-card"><label class="field">Оформление<select id="theme-select"><option value="system" '+(state.theme==='system'?'selected':'')+'>Как на телефоне</option><option value="light" '+(state.theme==='light'?'selected':'')+'>Светлое</option><option value="dark" '+(state.theme==='dark'?'selected':'')+'>Тёмное</option></select></label><p class="settings-hint">Время расписания — Москва (UTC+3). Смена часового пояса телефона не изменит время занятий.</p></div><div class="setting-card"><div class="setting-title">Расписание</div><p class="settings-hint">Группа '+escapeText(state.schedule.group)+'. В исходных скриншотах — занятия с 5 по 14 октября 2026 года. Расписание не повторяется автоматически. Новые пары можно добавлять вручную.</p><button class="secondary-button" id="export-schedule">Сохранить расписание в файл</button><button class="secondary-button" id="import-schedule">Загрузить расписание из файла</button><button class="danger-button" id="restore-original">Восстановить исходное расписание</button></div><p class="settings-meta">Мои пары · версия 1.0.0<br>Работает офлайн. Данные остаются на телефоне.<br>Если Android принудительно остановит приложение, открой его снова.</p>';
}
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
  if (b.dataset.tab) { activeTab=b.dataset.tab; render(); }
  if (b.dataset.date) selectDate(b.dataset.date);
  if (b.dataset.overviewDate) selectDate(b.dataset.overviewDate);
  if (b.dataset.heroDate) selectDate(b.dataset.heroDate);
  if (b.dataset.lesson) editLesson(b.dataset.lesson);
  if (b.id==='settings-button' || b.dataset.action==='settings' || b.id==='reminder-status') openSettings();
  if (b.id==='modal-close') closeModal();
  if (b.id==='add-button' || b.dataset.action==='add') editLesson();
  if (b.id==='today-button') selectDate(today());
  if (b.id==='calendar-button') showModal('calendar','Выбрать дату','<form id="date-form"><label class="field">Дата<input id="picked-date" type="date" value="'+selectedDate+'" min="2000-01-01" max="2100-12-31" required></label><button class="primary-button" type="submit">Открыть день</button></form>');
  const actions={'grant-notifications':'requestNotifications','grant-exact':'requestExactAlarms','test-notification':'testNotification','notification-channel':'openNotificationSettings','export-schedule':'exportSchedule','import-schedule':'importSchedule'};
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
  if (e.target.closest('#lesson-form') && ['date','slot'].includes(e.target.name)) updateFormTimes();
});
$('search').addEventListener('input',e=>{ searchQuery=e.target.value; renderAll(); });
document.addEventListener('submit',e=>{
  if (e.target.id==='date-form') { e.preventDefault(); const date=$('picked-date').value; if (date) { closeModal(); selectDate(date); } }
  if (e.target.id==='lesson-form') {
    e.preventDefault(); const f=e.target.elements;
    const l={id:f.id.value,date:f.date.value,slot:Number(f.slot.value),subject:f.subject.value.trim(),kind:f.kind.value,room:f.room.value.trim(),teacher:f.teacher.value.trim(),note:f.note.value.trim(),muted:f.muted.checked,cancelled:f.cancelled.checked};
    if (!l.subject || !l.date) return;
    if (lessons().some(x=>x.id!==l.id && x.date===l.date && x.slot===l.slot)) { $('form-error').textContent='На эту дату и номер пары уже есть занятие. Измени его или выбери другое время.'; $('form-error').hidden=false; return; }
    if (mutate('saveLesson',JSON.stringify(l))) { closeModal(); selectDate(l.date); toast('Пара сохранена'); }
  }
});
setInterval(()=>{ if (state?.schedule && !document.hidden) { renderHero(); if (!modalType) { renderDay(); if (activeTab==='all') renderAll(); } } },30000);
document.addEventListener('visibilitychange',()=>{ if (!document.hidden && state?.schedule) { if (native) window.onNativeStateChanged(window.Native.getState()); else render(); } });
async function initialize() {
  try { if (native) window.onNativeStateChanged(window.Native.getState()); else { const schedule=await (await fetch('schedule.json')).json(); changeState({schedule,theme:'system',systemDark:matchMedia('(prefers-color-scheme: dark)').matches,minutes:15,enabled:true,notificationsAllowed:false,exactAllowed:false,scheduledCount:0,platform:'preview'}); } }
  catch (_) { $('next-lesson').innerHTML='<div class="empty-state"><h3>Расписание не загрузилось</h3><p>Закрой и снова открой приложение.</p></div>'; }
}
initialize();
