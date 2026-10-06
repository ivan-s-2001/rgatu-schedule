const CACHE = 'rgatu-pairs-web-20261006-v141-mobile-label';
const CORE = ['/', '/index.html', '/app.css', '/app.js', '/timetable.js', '/schedule.js', '/schedule.json', '/manifest.webmanifest', '/icons/icon.svg'];
self.addEventListener('install', event => {event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(CORE)));});
self.addEventListener('activate', event => {event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('rgatu-pairs-') && key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));});
self.addEventListener('message', event => {if(event.data==='ACTIVATE')self.skipWaiting();});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if(event.request.method!=='GET'||url.origin!==self.location.origin||url.pathname.startsWith('/api/')||url.pathname.startsWith('/download/'))return;
  if(event.request.mode==='navigate') {
    event.respondWith(fetch(event.request).then(response=>response.ok?response:caches.match('/')).catch(()=>caches.match('/')));
    return;
  }
  if(CORE.includes(url.pathname)) event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request)));
});
