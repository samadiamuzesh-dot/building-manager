// v2: network-first برای HTML/JS/CSS تا اصلاحات جدید فوراً به کاربر برسد
// (نسخه قبلی cache-first بود و صفحات قدیمی برای همیشه از کش نمایش داده می‌شد)
const CACHE = 'apartman-plus-v20';
// مسیرها نسبی‌اند تا روی هر دامنه‌ای (Vercel یا GitHub Pages) کار کند
const ASSETS = [
  './',
  'index.html',
  'resident.html',
  'login.html',
  'block.html',
  'home.html',
  'app.html',
  'manifest.json',
  'resident-manifest.json',
  'assets/icon-192.png',
  'css/style.css',
  'css/resident-style.css',
  'css/auth.css',
  'js/app.js',
  'js/dialogs.js',
  'js/auth.js',
  'js/block-auth.js',
  'js/plans.js',
  'js/sync.js',
  'js/resident-app.js',
  'assets/logo.png'
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
  if (/\/api\/|\/wp-json\//.test(new URL(e.request.url).pathname)) return; // سرور همگام‌سازی هرگز کش نشود
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
