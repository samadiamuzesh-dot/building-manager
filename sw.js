const CACHE = 'apartman-plus-v1';
const ASSETS = [
  '/building-manager/',
  '/building-manager/index.html',
  '/building-manager/resident.html',
  '/building-manager/login.html',
  '/building-manager/manifest.json',
  '/building-manager/css/style.css',
  '/building-manager/css/resident-style.css',
  '/building-manager/assets/logo.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(res => res || fetch(e.request))
  );
});
