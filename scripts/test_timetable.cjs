const assert = require('node:assert/strict');
const fs = require('node:fs');
const t = require('../public/timetable.js');
assert.deepEqual(t.bells('2026-10-05'),[['08:30','10:05'],['10:15','11:50'],['12:40','14:15'],['14:25','16:00'],['16:10','17:45'],['18:00','19:25'],['19:35','21:00']]);
assert.deepEqual(t.bells('2026-10-10'),[['08:30','10:05'],['10:15','11:50'],['12:00','13:35'],['13:45','15:20'],['15:30','17:05'],['17:15','18:40'],['18:50','20:15']]);
assert.deepEqual(t.bells('2026-10-11'),t.weekend);
assert.equal(t.dateInMoscow(Date.parse('2026-10-04T21:01:00Z')),'2026-10-05');
const data = JSON.parse(fs.readFileSync('public/schedule.json'));
const source = JSON.parse(fs.readFileSync('data/schedule-full.json'));
const memberships = t.memberships(data);
assert.equal(data.groups.length,44);
assert.equal(data.groups.some(g=>/-[12]$/.test(g.id)),false,'technical subgroup ids must not appear as groups');
assert.equal(data.lessons.length,1464);
assert.equal(data.groups.reduce((n,g)=>n+Object.keys(g.subgroups||{}).length,0),290,'all split lessons are preserved as subgroup metadata');
for(const g of data.groups){
  assert.equal(new Set(g.lessons).size,g.lessons.length,'no duplicate lesson ids in '+g.id);
  for(const [lessonId,subgroup] of Object.entries(g.subgroups||{})){
    assert.ok(g.lessons.includes(Number(lessonId)),'subgroup lesson belongs to '+g.id);
    assert.ok(subgroup===1||subgroup===2,'subgroup is 1 or 2 for '+g.id);
  }
}
for(const lesson of source.lessons) assert.deepEqual(memberships.get(lesson.id),lesson.groups.slice().sort((a,b)=>a.localeCompare(b,'ru')),`Shared groups for lesson ${lesson.id}`);
const group = data.groups.find(g=>g.id==='ЗВС-26');
const lessons=group.lessons.map(i=>data.lessons[i]);
const at = time => t.focus(lessons,Date.parse('2026-10-05T'+time+':00+03:00'));
assert.equal(at('08:29').current,false);
assert.equal(at('08:30').current,true);
assert.equal(at('10:05').current,false);
assert.equal(at('10:05').lesson.slot,2);
assert.equal(at('10:05').minutes,10);
assert.equal(at('10:15').current,true);
assert.equal(at('11:50').current,false);
assert.equal(at('11:50').lesson.slot,4);
assert.equal(at('16:11').lesson.slot,5);
assert.equal(at('16:11').current,true);
assert.equal(at('21:00').lesson.date,'2026-10-06');
assert.equal(t.focus(lessons,Date.parse('2026-10-15T08:00:00+03:00')),null);
const zks=data.groups.find(g=>g.id==='ЗКС-26');
assert.ok(zks,'ЗКС-26 is one real group');
assert.equal(data.groups.find(g=>g.id==='ЗКС-26-1'),undefined);
assert.equal(data.groups.find(g=>g.id==='ЗКС-26-2'),undefined);
const zksLesson=(date,slot,subject)=>zks.lessons.map(i=>data.lessons[i]).find(l=>l.date===date&&l.slot===slot&&l.subject===subject);
const zksSub1=zksLesson('2026-10-08',6,'Информатика и системы искусственного интеллекта');
const zksSub2=zksLesson('2026-10-12',6,'Инженерная и компьютерная графика');
const zksWhole=zksLesson('2026-10-05',4,'Математический анализ');
assert.ok(zksSub1&&zksSub2&&zksWhole,'ZKS subgroup fixtures exist');
assert.equal(zks.subgroups[String(zksSub1.id)],1);
assert.equal(zks.subgroups[String(zksSub2.id)],2);
assert.equal(zks.subgroups[String(zksWhole.id)],undefined);
const pairA={id:0,date:'2026-10-10',slot:3,subject:'Физика',type:'Л',teacher:'Иванов',room:'1-101'};
const pairB={...pairA,id:1,slot:4};
assert.equal(t.bounds(pairA).start,'12:00');
assert.equal(t.focus([pairA,pairB],Date.parse('2026-10-10T13:40:00+03:00')).current,false);
console.log('PASS: bells, Moscow dates, separate lessons, 44 real groups, subgroup metadata and all 1,464 shared-group mappings.');
assert.deepEqual(t.weekDates('2026-10-11'),['2026-10-05','2026-10-06','2026-10-07','2026-10-08','2026-10-09','2026-10-10','2026-10-11']);
assert.equal(t.weekDates('2027-01-01')[0],'2026-12-28');
assert.equal(t.shiftMonth('2026-12',1),'2027-01');
assert.equal(t.shiftMonth('2026-01',-1),'2025-12');
assert.equal(t.monthDates('2026-10')[0],'2026-09-28');
assert.equal(t.monthDates('2026-10').at(-1),'2026-11-01');
assert.equal(t.monthDates('2024-02').filter(d=>d.startsWith('2024-02')).length,29);
assert.equal(t.monthDates('2026-02').filter(d=>d.startsWith('2026-02')).length,28);
for(let month=1;month<=12;month++) {
  const grid=t.monthDates('2026-'+String(month).padStart(2,'0'));
  assert.equal(grid.length%7,0);
  assert.equal(new Date(grid[0]+'T12:00:00Z').getUTCDay(),1);
  assert.equal(new Date(grid.at(-1)+'T12:00:00Z').getUTCDay(),0);
}
console.log('PASS: day/week/month navigation, year changes and leap day; every month starts Monday and ends Sunday without missing dates.');
