// v2: network-first برای HTML/JS/CSS تا اصلاحات جدید فوراً به کاربر برسد
// (نسخه قبلی cache-first بود و صفحات قدیمی برای همیشه از کش نمایش داده می‌شد)
const CACHE = 'apartman-plus-v2';
const ASSETS = [
  '/building-manager/',
  '/building-manager/index.html',
  '/building-manager/resident.html',
  '/building-manager/login.html',
  '/building-manager/manifest.json',
  '/building-manager/css/style.css',
  '/building-manager/css/resident-style.css',
  '/building-manager/js/app.js',
  '/building-manager/js/auth.js',
  '/building-manager/js/plans.js',
  '/building-manager/js/resident-app.js',
  '/building-manager/assets/logo.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).catch(() => {}));
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
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res && res.ok && new URL(e.request.url).origin === self.location.origin) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
