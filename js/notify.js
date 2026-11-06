/* ============================================================
   🔔 آپارتمان پلاس — صدا و اعلان سیستمی (پنل ساکن، مدیر کل و مدیر بلوک)
   ------------------------------------------------------------
   - بعد از هر همگام‌سازی، برنامه فهرست موارد «مهم» را می‌دهد (AptNotify.check)؛
     مورد تازه → صدای کوتاه + اعلان سیستمی (service worker) + پیام داخل برنامه.
   - «دیده‌شده»ها در localStorage می‌مانند تا بعد از بازکردن دوباره تکرار نشود.
   - اجازه اعلان فقط با لمس دکمه «🔔 فعال‌سازی اعلان‌ها» گرفته می‌شود.
   - بعد از اجازه، اشتراک Web Push ساخته و در سرور ثبت می‌شود تا وقتی برنامه بسته است هم اعلان برسد.
   - آیفون: فقط وقتی برنامه به صفحه اصلی اضافه شده باشد (iOS 16.4 به بالا).
   ============================================================ */
(function () {
  'use strict';
  if (typeof window === 'undefined' || window.AptNotify) return;
  const LS = window.localStorage;
  const TITLE = 'آپارتمان پلاس';
  const ICON = 'assets/icon-192.png';
  const jget = (k, d) => { try { const v = JSON.parse(LS.getItem(k)); return v == null ? d : v; } catch (e) { return d; } };
  const jset = (k, v) => { try { LS.setItem(k, JSON.stringify(v)); } catch (e) {} };
  const withTimeout = (p, ms) => Promise.race([p, new Promise(r => setTimeout(() => r(null), ms))]);

  /* ---------------- صدا (WebAudio؛ آیفون: با اولین لمس باز می‌شود) ---------------- */
  let actx = null, unlocked = false;
  function audio() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!actx) { try { actx = new AC(); } catch (e) { return null; } }
    return actx;
  }
  const GESTURES = ['touchend', 'pointerdown', 'mousedown', 'keydown', 'click'];
  function unlockAudio() {
    const c = audio(); if (!c) return;
    try {
      if (c.state === 'suspended' && c.resume) c.resume();
      const b = c.createBuffer(1, 1, 22050); const s = c.createBufferSource();
      s.buffer = b; s.connect(c.destination); (s.start ? s.start(0) : s.noteOn(0));
      unlocked = true;
    } catch (e) {}
    if (unlocked) GESTURES.forEach(g => document.removeEventListener(g, unlockAudio, true));
  }
  GESTURES.forEach(g => document.addEventListener(g, unlockAudio, true));

  function beep() {
    AptNotify.beeps++;
    if (LS.getItem('apt_notify_sound') === '0') return;
    const c = audio(); if (!c) return;
    try {
      if (c.state === 'suspended' && c.resume) c.resume();
      const t = c.currentTime + 0.02;
      [[880, 0], [1320, 0.16]].forEach(([f, d]) => {
        const o = c.createOscillator(), g = c.createGain();
        o.type = 'sine'; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t + d);
        g.gain.exponentialRampToValueAtTime(0.35, t + d + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.15);
        o.connect(g); g.connect(c.destination);
        o.start(t + d); o.stop(t + d + 0.17);
      });
    } catch (e) {}
    try { if (navigator.vibrate) navigator.vibrate([60, 40, 60]); } catch (e) {}
  }

  /* ---------------- پشتیبانی و اجازه ---------------- */
  const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent || '') || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isStandalone = () => { try { return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true; } catch (e) { return false; } };
  /** granted | default | denied | unsupported | ios-install (آیفون، از صفحه اصلی باز نشده) | ios-old (iOS زیر ۱۶.۴) */
  function status() {
    const hasN = 'Notification' in window, hasSW = 'serviceWorker' in navigator;
    if (isIOS() && !isStandalone()) return 'ios-install';
    if (!hasN || !hasSW) return isIOS() ? 'ios-old' : 'unsupported';
    return window.Notification.permission || 'default';
  }

  let regP = null;
  function getReg() {
    if (!('serviceWorker' in navigator)) return Promise.resolve(null);
    if (!regP) {
      regP = (async () => {
        try {
          let r = navigator.serviceWorker.getRegistration ? await navigator.serviceWorker.getRegistration() : null;
          if (!r) r = await navigator.serviceWorker.register('sw.js');
          return (await withTimeout(navigator.serviceWorker.ready, 5000)) || r;
        } catch (e) { regP = null; return null; }
      })();
    }
    return regP;
  }

  /** اعلان سیستمی (فقط اگر اجازه داده شده) */
  async function show(item) {
    if (status() !== 'granted') return false;
    const opts = { body: item.body || '', icon: ICON, badge: ICON, tag: item.tag || undefined, renotify: true, dir: 'rtl', lang: 'fa', data: { url: item.url || '' } };
    try {
      const reg = await getReg();
      if (reg && reg.showNotification) { await reg.showNotification(item.title || TITLE, opts); AptNotify.shown++; return true; }
      new window.Notification(item.title || TITLE, opts); AptNotify.shown++; return true;
    } catch (e) { return false; }
  }

  /**
   * موارد فعلی را با «دیده‌شده»ها مقایسه می‌کند. items: [{tag, body, url}]
   * اولین بار (یا بعد از ورود تازه) فقط ثبت می‌کند و صدایی نمی‌دهد.
   */
  function check(scope, items, opts) {
    if (!scope) return [];
    opts = opts || {};
    const key = 'apt_seen_' + scope;
    const rec = jget(key, null);
    const tags = items.map(i => String(i.tag));
    if (!rec || !Array.isArray(rec.ids)) { jset(key, { ids: tags.slice(-1500), at: Date.now() }); return []; }
    const seen = new Set(rec.ids);
    const fresh = items.filter(i => !seen.has(String(i.tag)));
    if (!fresh.length) return [];
    rec.ids = rec.ids.concat(fresh.map(i => String(i.tag))).slice(-1500); rec.at = Date.now();
    jset(key, rec);
    if (fresh.length > 8) return []; // بازگردانی/همگام‌سازی انبوه، نه رویداد تازه
    const pushed = new Set(jget('apt_push_tags', []));
    const notPushed = fresh.filter(i => !pushed.has(String(i.tag)));
    if (notPushed.length) {
      beep();
      const list = notPushed.length > 3 ? notPushed.slice(0, 2).concat([{ tag: 'apt-summary', body: `و ${notPushed.length - 2} مورد تازه دیگر`, url: opts.url || '' }]) : notPushed;
      list.forEach(i => show(i));
    }
    if (opts.onFresh) { try { opts.onFresh(fresh); } catch (e) {} }
    return fresh;
  }

  /* ---------------- Web Push ---------------- */
  const b64uToBytes = (s) => { s = String(s).replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; const b = atob(s); const a = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) a[i] = b.charCodeAt(i); return a; };
  const bytesToB64u = (buf) => { const a = new Uint8Array(buf); let s = ''; for (let i = 0; i < a.length; i++) s += String.fromCharCode(a[i]); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };

  let pushBusy = null;
  /** اشتراک push را بساز/تازه کن و در سرور ثبت کن (بی‌صدا؛ خطا = بعداً دوباره) */
  function ensurePush(force) {
    if (pushBusy) return pushBusy;
    pushBusy = (async () => {
      try {
        if (status() !== 'granted' || !window.AptSync || !window.AptSync.pushRegister) return false;
        const ident = window.AptSync.identity ? window.AptSync.identity() : '';
        if (!ident) return false;
        const reg = await getReg();
        if (!reg || !reg.pushManager) return false;
        const last = jget('apt_push_reg', {});
        let key = LS.getItem('apt_push_vapid');
        const stale = force || !last.at || Date.now() - last.at > 3 * 864e5;
        if (!key || stale) {
          try { const k = await window.AptSync.pushKey(); if (k) { key = k; LS.setItem('apt_push_vapid', k); } }
          catch (e) { if (e && e.status === 503) { LS.removeItem('apt_push_vapid'); return false; } if (!key) return false; }
        }
        let sub = await reg.pushManager.getSubscription();
        if (sub && sub.options && sub.options.applicationServerKey && bytesToB64u(sub.options.applicationServerKey) !== key) {
          try { await sub.unsubscribe(); } catch (e) {} sub = null;
        }
        if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64uToBytes(key) });
        const j = sub.toJSON ? sub.toJSON() : sub;
        const sig = j.endpoint + '|' + ident;
        if (stale || last.sig !== sig) {
          await window.AptSync.pushRegister(j);
          jset('apt_push_reg', { sig, at: Date.now() });
        }
        return true;
      } catch (e) { return false; }
      finally { setTimeout(() => { pushBusy = null; }, 0); }
    })();
    return pushBusy;
  }
  /** خروج از حساب: اشتراک این دستگاه از سرور و مرورگر حذف شود */
  function disablePush() {
    return withTimeout((async () => {
      try {
        const reg = await withTimeout(getReg(), 1500);
        const sub = reg && reg.pushManager ? await reg.pushManager.getSubscription() : null;
        if (sub) {
          try { if (window.AptSync && window.AptSync.pushUnregister) await window.AptSync.pushUnregister(sub.endpoint); } catch (e) {}
          try { await sub.unsubscribe(); } catch (e) {}
        }
      } catch (e) {}
      LS.removeItem('apt_push_reg');
    })(), 3000);
  }

  async function requestPermission() {
    if (!('Notification' in window)) return 'unsupported';
    unlockAudio();
    let r;
    try {
      r = await new Promise(res => { const p = window.Notification.requestPermission(res); if (p && p.then) p.then(res, () => res('default')); });
    } catch (e) { r = window.Notification.permission; }
    if (r === 'granted') {
      beep();
      show({ tag: 'apt-enabled', body: 'اعلان‌ها فعال شد ✅ پیام‌ها و موارد تازه همین‌طور روی گوشی نمایش داده می‌شوند.' });
      ensurePush(true);
    }
    refreshBanners();
    return r;
  }

  /* ---------------- بنر فعال‌سازی ---------------- */
  const banners = new Set();
  function renderBanner(host) {
    const st = status();
    const dis = jget('apt_notify_banner_off', {});
    const hide = st === 'granted' || st === 'unsupported' || (dis[st] && Date.now() - dis[st] < 5 * 864e5);
    host.style.display = hide ? 'none' : '';
    if (hide) { host.innerHTML = ''; return; }
    const box = 'display:flex;align-items:center;gap:10px;flex-wrap:wrap;direction:rtl;margin:10px 12px;padding:12px 14px;border-radius:14px;font:500 13px/1.8 Vazirmatn,Tahoma,sans-serif;';
    const btn = 'border:0;border-radius:10px;padding:9px 14px;font:700 13.5px Vazirmatn,Tahoma,sans-serif;cursor:pointer;';
    const x = '<button type="button" data-apt-nb-x aria-label="بستن" style="margin-inline-start:auto;background:transparent;border:0;font-size:16px;cursor:pointer;color:inherit;opacity:.6">✕</button>';
    if (st === 'default') {
      host.innerHTML = `<div style="${box}background:#eef2ff;color:#312e81;border:1px solid #c7d2fe">
        <button type="button" data-apt-nb-on style="${btn}background:#5b4cdb;color:#fff">🔔 فعال‌سازی اعلان‌ها</button>
        <span style="flex:1;min-width:180px">تا پیام‌ها، اطلاعیه‌ها و موارد تازه با صدا روی گوشی‌تان بیاید.</span>${x}</div>`;
    } else if (st === 'ios-install') {
      host.innerHTML = `<div style="${box}background:#fff7ed;color:#7c2d12;border:1px solid #fed7aa">
        <span style="flex:1;min-width:200px">📱 آیفون فقط وقتی اعلان نشان می‌دهد که برنامه به <b>صفحه اصلی</b> اضافه شده باشد (iOS 16.4 به بالا): در سافاری دکمه اشتراک‌گذاری ⬆️ ← Add to Home Screen، بعد برنامه را از آیکن آن باز کنید و «فعال‌سازی اعلان‌ها» را بزنید.</span>
        <a href="app.html" style="${btn}background:#ea580c;color:#fff;text-decoration:none">راهنمای نصب</a>${x}</div>`;
    } else if (st === 'ios-old') {
      host.innerHTML = `<div style="${box}background:#f1f5f9;color:#334155;border:1px solid #e2e8f0"><span style="flex:1">اعلان روی این آیفون پشتیبانی نمی‌شود؛ iOS 16.4 یا بالاتر لازم است.</span>${x}</div>`;
    } else if (st === 'denied') {
      host.innerHTML = `<div style="${box}background:#fef2f2;color:#7f1d1d;border:1px solid #fecaca"><span style="flex:1">🔕 اعلان‌ها برای این برنامه مسدود شده است. از تنظیمات گوشی/مرورگر ← اعلان‌ها، اجازه دهید.</span>${x}</div>`;
    }
    const on = host.querySelector('[data-apt-nb-on]');
    if (on) on.onclick = (e) => { e.preventDefault(); requestPermission(); };
    const cl = host.querySelector('[data-apt-nb-x]');
    if (cl) cl.onclick = (e) => { e.preventDefault(); const d = jget('apt_notify_banner_off', {}); d[st] = Date.now(); jset('apt_notify_banner_off', d); renderBanner(host); };
  }
  function banner(host) { if (!host) return; banners.add(host); renderBanner(host); }
  function refreshBanners() { banners.forEach(h => { if (h.isConnected) renderBanner(h); else banners.delete(h); }); }

  /* ---------------- پیام‌های service worker ---------------- */
  if ('serviceWorker' in navigator && navigator.serviceWorker.addEventListener) {
    navigator.serviceWorker.addEventListener('message', (e) => {
      const d = (e && e.data) || {};
      if (d.type === 'apt-push' && d.tag) {
        // اعلان سیستمی را خود سیستم نشان داده؛ دوباره صدا/اعلان نده، فقط داده را تازه کن
        const l = jget('apt_push_tags', []); l.push(String(d.tag)); jset('apt_push_tags', l.slice(-300));
        if (window.AptSync) window.AptSync.syncNow();
      } else if (d.type === 'apt-open' && d.url) {
        try { window.dispatchEvent(new CustomEvent('apt-open-url', { detail: { url: d.url } })); } catch (er) {}
      }
    });
  }

  /** صفحه هدف از ?n=… (کلیک روی اعلان) */
  function pageFromUrl(u) { try { return new URL(u || location.href, location.href).searchParams.get('n') || ''; } catch (e) { return ''; } }
  function consumeUrlPage() {
    const n = pageFromUrl();
    if (n && history.replaceState) { try { const u = new URL(location.href); u.searchParams.delete('n'); history.replaceState(null, '', u.pathname + u.search + u.hash); } catch (e) {} }
    return n;
  }

  const AptNotify = {
    beeps: 0, shown: 0,
    status, beep, show, check, ensurePush, disablePush, requestPermission, banner, refreshBanners, pageFromUrl, consumeUrlPage,
    isIOS, isStandalone,
  };
  window.AptNotify = AptNotify;

  // service worker برای اعلان سیستمی لازم است (صفحه مدیر قبلاً ثبتش نمی‌کرد)
  const boot = () => {
    if ('serviceWorker' in navigator && location.protocol !== 'file:') getReg();
    if (status() === 'granted') setTimeout(() => ensurePush(false), 1500);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') refreshBanners(); });
    // اولین همگام‌سازی موفق (توکن آماده است): اشتراک push را ثبت/تازه کن
    let first = true;
    window.addEventListener('apt-sync-pulled', () => { if (first && status() === 'granted') { first = false; ensurePush(false); } });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
