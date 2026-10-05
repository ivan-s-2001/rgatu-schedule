const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const events = {};
const storage = new Map();
let network = true;
let claimed = false;
const host = 'https://rgatu.test';
const content = key => fs.readFileSync(path.resolve('public',key==='/'?'index.html':key.slice(1)));
const context = {
  URL,
  self:{location:{origin:host},clients:{claim:async()=>{claimed=true;}},skipWaiting:async()=>{},addEventListener:(name,handler)=>{events[name]=handler;}},
  caches:{open:async()=>({addAll:async keys=>{for(const key of keys)storage.set(key,content(key));}}),keys:async()=>['rgatu-pairs-1.0.0-r2','other-app-cache','rgatu-pairs-1.1.0'],delete:async key=>{assert.equal(key,'rgatu-pairs-1.0.0-r2');return true;},match:async request=>storage.get(typeof request==='string'?request:new URL(request.url).pathname)},
  fetch:async request=>{if(!network)throw Error('offline');return {ok:true,body:content(new URL(request.url).pathname)};},
};
vm.runInNewContext(fs.readFileSync('public/sw.js','utf8'),context);
const lifecycle = async name => {let pending;events[name]({waitUntil:promise=>{pending=promise;}});await pending;};
const request = async (key,mode) => {let result;events.fetch({request:{url:host+key,method:'GET',mode},respondWith:value=>{result=value;}});return result;};
(async()=>{
  await lifecycle('install');await lifecycle('activate');assert.equal(claimed,true);
  network = false;
  assert.deepEqual(await request('/','navigate'),content('/'));
  for(const key of ['/app.css','/app.js','/timetable.js','/schedule.js','/manifest.webmanifest','/icons/icon-192.png'])assert.deepEqual(await request(key,'same-origin'),content(key));
  assert.equal(await request('/api/schedule','same-origin'),undefined);
  assert.equal(await request('/download/android','same-origin'),undefined);
  const apk = fs.readFileSync('dist/RgatuLite-1.1.0.apk');
  assert.equal(apk.readUInt32LE(0),0x04034b50);
  console.log('PASS: install caches the entire shell and timetable; offline navigation and every required asset work; schedule updates and APK downloads bypass stale caches.');
})().catch(error=>{console.error(error);process.exit(1);});
