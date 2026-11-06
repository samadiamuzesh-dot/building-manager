// v2: network-first برای HTML/JS/CSS تا اصلاحات جدید فوراً به کاربر برسد
// (نسخه قبلی cache-first بود و صفحات قدیمی برای همیشه از کش نمایش داده می‌شد)
const CACHE = 'apartman-plus-v21';
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
  'js/notify.js',
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

/* ---------- اعلان فوری (Web Push) و کلیک روی اعلان ---------- */
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { try { d = { body: e.data.text() }; } catch (er) {} }
  const title = d.title || 'آپارتمان پلاس';
  const tag = d.tag || 'apt-' + Date.now();
  const opts = {
    body: d.body || 'مورد تازه‌ای دارید',
    icon: 'assets/icon-192.png',
    badge: 'assets/icon-192.png',
    tag,
    renotify: true,
    dir: 'rtl',
    lang: 'fa',
    data: { url: d.url || '' },
  };
  // همیشه اعلان نشان بده (آیفون و کروم push بی‌اعلان را جریمه می‌کنند)؛ به صفحه‌های باز هم خبر بده تا تکرار نکنند
  e.waitUntil(Promise.all([
    self.registration.showNotification(title, opts),
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => list.forEach(c => c.postMessage({ type: 'apt-push', tag }))),
  ]));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const rel = (e.notification.data && e.notification.data.url) || '';
  const target = new URL(rel || './', self.registration.scope).href;
  const norm = p => (p.endsWith('/') ? p + 'index.html' : p);
  const tPath = norm(new URL(target).pathname);
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    // پنجره همان صفحه (ساکن یا مدیر) باز است: همان را جلو بیاور و به صفحه مربوط ببر
    const same = list.find(c => norm(new URL(c.url).pathname) === tPath) || (rel ? null : list[0]);
    if (same) {
      same.postMessage({ type: 'apt-open', url: target });
      return same.focus ? same.focus() : same;
    }
    return self.clients.openWindow ? self.clients.openWindow(target) : null;
  }));
});
