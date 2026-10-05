(function (scope) {
  'use strict';
  const weekday = [['08:30','10:05'],['10:15','11:50'],['12:40','14:15'],['14:25','16:00'],['16:10','17:45'],['18:00','19:25'],['19:35','21:00']];
  const weekend = [['08:30','10:05'],['10:15','11:50'],['12:00','13:35'],['13:45','15:20'],['15:30','17:05'],['17:15','18:40'],['18:50','20:15']];
  const isWeekend = date => [0,6].includes(new Date(date + 'T12:00:00+03:00').getUTCDay());
  const bells = date => isWeekend(date) ? weekend : weekday;
  const bounds = lesson => {
    const [start,end] = bells(lesson.date)[lesson.slot - 1];
    return {start,end,startAt:Date.parse(lesson.date + 'T' + start + ':00+03:00'),endAt:Date.parse(lesson.date + 'T' + end + ':00+03:00')};
  };
  const dateInMoscow = (now = Date.now()) => {
    const parts = new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Moscow',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(now));
    const values = Object.fromEntries(parts.map(part => [part.type,part.value]));
    return values.year + '-' + values.month + '-' + values.day;
  };
  function focus(lessons, now = Date.now()) {
    const ordered = lessons.slice().sort((a,b) => a.date.localeCompare(b.date) || a.slot-b.slot);
    const current = ordered.find(lesson => {const time=bounds(lesson);return now>=time.startAt && now<time.endAt;});
    const lesson = current || ordered.find(lesson => bounds(lesson).startAt>now);
    if (!lesson) return null;
    const time = bounds(lesson);
    return {lesson,time,current:Boolean(current),minutes:Math.max(1,Math.ceil(((current?time.endAt:time.startAt)-now)/60000))};
  }
  function memberships(data) {
    const groups = new Map();
    for (const group of data.groups) for (const index of group.lessons) {
      if (!groups.has(index)) groups.set(index,[]);
      if (!groups.get(index).includes(group.id)) groups.get(index).push(group.id);
    }
    for (const ids of groups.values()) ids.sort((a,b)=>a.localeCompare(b,'ru'));
    return groups;
  }
  function merge(lessons, groups) {
    const merged = [];
    for (const lesson of lessons) {
      const peers = groups.get(lesson.id) || [];
      const previous = merged.at(-1);
      if (previous && previous.date===lesson.date && previous.subject===lesson.subject && previous.type===lesson.type && previous.teacher===lesson.teacher && previous.room===lesson.room && previous.slots.at(-1)+1===lesson.slot && previous.peers.join('|')===peers.join('|')) {
        previous.slots.push(lesson.slot);
        previous.ids.push(lesson.id);
      } else merged.push({...lesson,slots:[lesson.slot],ids:[lesson.id],peers});
    }
    return merged;
  }
  const api = {weekday,weekend,bells,bounds,isWeekend,dateInMoscow,focus,memberships,merge};
  if (typeof module === 'object' && module.exports) module.exports=api;
  else scope.RGATU_TIME=api;
})(typeof window === 'object' ? window : globalThis);
