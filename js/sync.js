/* ============================================================
   ☁️ آپارتمان پلاس — همگام‌سازی ابری پنل مدیر ↔ پنل ساکن
   ------------------------------------------------------------
   این فایل قبل از app.js / resident-app.js / auth.js بارگذاری می‌شود.
   برنامه‌ها همچنان با localStorage کار می‌کنند؛ این لایه تغییرات را
   به سرور (/api/sync) می‌فرستد و تغییرات دستگاه‌های دیگر را می‌گیرد.
   - آدرس سرور: window.APT_SYNC_URL (پیش‌فرض: /api/sync هم‌دامنه)
   - غیرفعال‌سازی: window.APT_SYNC_URL = false
   ============================================================ */
(function () {
  'use strict';
  if (typeof window === 'undefined' || !window.localStorage) return;
  if (window.APT_SYNC_URL === false) return;
  if (location.protocol === 'file:') return;
  // GitHub Pages سرور ندارد؛ فقط وقتی آدرس سرور صریحاً داده شده فعال شود
  if (/\.github\.io$/i.test(location.hostname) && !window.APT_SYNC_URL) return;

  const API = window.APT_SYNC_URL || new URL('api/sync', location.href).href;
  const P = 'ham_sakhteman_';
  const BASES = ['v3', 'units', 'charges', 'expenses', 'messages', 'notices', 'notifications',
    'settings', 'side_incomes', 'tickets', 'votings', 'plan'];
  const REG = 'registered_residents';
  const RESIDENT_WRITABLE = ['units', 'charges', 'messages', 'notifications', 'votings', 'tickets', REG];
  const POLL_MS = 12000;

  const ls = window.localStorage;
  const S = Storage.prototype;
  const origSet = S.setItem, origGet = S.getItem, origRemove = S.removeItem;
  const get = (k) => origGet.call(ls, k);
  const set = (k, v) => origSet.call(ls, k, v);
  const del = (k) => origRemove.call(ls, k);
  const jparse = (s, d) => { try { const v = JSON.parse(s); return v == null ? d : v; } catch (e) { return d; } };
  const normPhone = (p) => String(p || '').replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
    .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/\D/g, '');

  let applying = false;
  let pushTimer = null, pollTimer = null, busy = false, again = false;
  let state = 'idle';

  /* ---------------- زمینه (مدیر یا ساکن) ---------------- */
  function isResidentPage() { return /resident\.html/i.test(location.pathname) || !!document.querySelector('script[src*="resident-app"]'); }
  function ctx() {
    if (isResidentPage()) {
      const s = jparse(get(P + 'resident_session'), null);
      const open = jparse(get('apt_sync_open'), null);
      const phone = normPhone((s && s.managerPhone) || (open && open.phone));
      const code = String((s && s.buildingCode) || (open && open.code) || '').toUpperCase();
      return phone ? { role: 'r', phone, code } : null;
    }
    const phone = normPhone(get(P + 'user_phone'));
    if (!phone || get(P + 'logged_out') === 'true') return null;
    return { role: 'm', phone, code: String(jparse(get(P + 'v3_' + phone), {})?.building?.code || '').toUpperCase() };
  }
  const tokKey = (c) => `apt_sync_token_${c.role}_${c.phone}`;
  const snapKey = (c) => `apt_sync_snap_${c.phone}`;
  const revKey = (c) => `apt_sync_rev_${c.phone}`;
  const dirtyKey = (c) => `apt_sync_dirty_${c.role}_${c.phone}`;

  /* ---------------- مقدار محلی هر کلید ---------------- */
  function stripRegs(list) { return list.map(r => { if (!r || typeof r !== 'object') return r; const { password, passwordHash, ...rest } = r; return rest; }); }
  function regsForCode(code) { return jparse(get(P + REG), []).filter(r => r && String(r.buildingCode || '').toUpperCase() === code); }
  function localValue(c, base, forPush) {
    if (base === REG) {
      if (!c.code) return null;
      const mine = regsForCode(c.code);
      if (!mine.length && get(P + REG) == null) return null;
      return JSON.stringify(forPush ? mine : stripRegs(mine));
    }
    return get(P + base + '_' + c.phone);
  }
  function writeLocal(c, base, v) {
    applying = true;
    try {
      if (base === REG) {
        const all = jparse(get(P + REG), []);
        const keepHash = new Map(all.filter(r => r && r.passwordHash).map(r => [String(r.id), r.passwordHash]));
        const others = all.filter(r => !(r && String(r.buildingCode || '').toUpperCase() === c.code));
        const incoming = jparse(v, []).map(r => (r && keepHash.has(String(r.id)) && !r.passwordHash) ? Object.assign({}, r, { passwordHash: keepHash.get(String(r.id)) }) : r);
        set(P + REG, JSON.stringify(others.concat(incoming)));
      } else if (v == null) del(P + base + '_' + c.phone);
      else set(P + base + '_' + c.phone, v);
    } finally { applying = false; }
  }
  function fire(keys) {
    keys.forEach(k => {
      try { window.dispatchEvent(new StorageEvent('storage', { key: k, storageArea: ls })); }
      catch (e) { const ev = document.createEvent('Event'); ev.initEvent('storage', false, false); ev.key = k; window.dispatchEvent(ev); }
    });
  }
  const fullKey = (c, base) => base === REG ? P + REG : P + base + '_' + c.phone;

  /* ---------------- ادغام سه‌طرفه ---------------- */
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  function merge3(baseS, localS, remoteS) {
    if (localS === remoteS) return localS;
    if (baseS === localS) return remoteS;
    if (baseS === remoteS) return localS;
    const b = jparse(baseS, null), l = jparse(localS, null), r = jparse(remoteS, null);
    if (Array.isArray(l) && Array.isArray(r) && l.every(x => x && x.id != null) && r.every(x => x && x.id != null)) {
      const B = new Map((Array.isArray(b) ? b : []).map(x => [String(x && x.id), x]));
      const L = new Map(l.map(x => [String(x.id), x]));
      const out = [];
      r.forEach(x => {
        const id = String(x.id); const bx = B.get(id); const lx = L.get(id);
        if (!lx) { if (bx && same(bx, x)) return; out.push(x); return; } // محلی حذف کرده
        if (bx && same(bx, lx)) out.push(x);          // فقط سرور تغییر داده
        else if (bx && same(bx, x)) out.push(lx);     // فقط محلی تغییر داده
        else out.push(Object.assign({}, x, lx));      // هر دو → محلی برنده
      });
      const R = new Set(r.map(x => String(x.id)));
      l.forEach(x => { const id = String(x.id); if (!R.has(id) && !B.has(id)) out.push(x); }); // جدیدِ محلی
      return JSON.stringify(out);
    }
    if (l && r && typeof l === 'object' && typeof r === 'object' && !Array.isArray(l) && !Array.isArray(r)) {
      const bo = (b && typeof b === 'object') ? b : {};
      const out = Object.assign({}, r);
      Object.keys(l).forEach(k => { if (!same(l[k], bo[k])) out[k] = l[k]; });
      Object.keys(bo).forEach(k => { if (!(k in l) && same(bo[k], r[k])) delete out[k]; });
      return JSON.stringify(out);
    }
    return localS;
  }

  /* ---------------- شبکه ---------------- */
  async function call(body, keepalive) {
    const r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), keepalive: !!keepalive, cache: 'no-store' });
    let j = {}; try { j = await r.json(); } catch (e) {}
    if (!r.ok) { const err = new Error(j.error || ('http_' + r.status)); err.status = r.status; err.data = j; throw err; }
    return j;
  }

  /* ---------------- نشانگر وضعیت ---------------- */
  function badge(s, title) {
    state = s;
    let el = document.getElementById('aptSyncBadge');
    if (!el) {
      if (!document.body) return;
      el = document.createElement('div');
      el.id = 'aptSyncBadge';
      el.style.cssText = 'position:fixed;left:10px;bottom:' + (isResidentPage() ? '78px' : '10px') + ';z-index:99999;font:600 11px Vazirmatn,Tahoma,sans-serif;padding:4px 9px;border-radius:999px;background:rgba(15,23,42,.78);color:#fff;pointer-events:auto;cursor:pointer;opacity:.85;direction:rtl';
      el.addEventListener('click', () => { AptSync.syncNow(); });
      document.body.appendChild(el);
    }
    const map = { ok: '☁️ همگام', busy: '⏳ همگام‌سازی…', off: '⚠️ آفلاین', err: '⚠️ خطای همگام‌سازی', auth: '🔒 نیاز به ورود دوباره' };
    el.textContent = map[s] || '';
    el.title = title || '';
    el.style.display = map[s] ? 'block' : 'none';
    // روی صفحه ورود/ثبت‌نام اولیه نشانگر لازم نیست
    if (document.querySelector('.login-page')) el.style.display = 'none';
  }

  /* ---------------- توکن ---------------- */
  async function ensureToken(c) {
    let t = get(tokKey(c));
    if (t) return t;
    if (c.role === 'm') {
      const passHash = get(P + 'user_password');
      if (!passHash) throw Object.assign(new Error('no_auth'), { status: 401 });
      let j;
      try { j = await call({ action: 'login', phone: c.phone, passHash }); }
      catch (e) {
        if (e.status !== 404) throw e;
        // اولین بار: ساختمان این مدیر را روی سرور بساز و همه داده‌ها را بفرست
        j = await call({ action: 'register', phone: c.phone, passHash, code: c.code });
        const d = new Set(jparse(get(dirtyKey(c)), []));
        BASES.forEach(b => { if (get(P + b + '_' + c.phone) != null) d.add(b); });
        if (c.code) d.add(REG);
        set(dirtyKey(c), JSON.stringify([...d]));
      }
      t = j.token;
    } else {
      if (!c.code) throw Object.assign(new Error('no_code'), { status: 401 });
      const j = await call({ action: 'open', code: c.code });
      t = j.token;
    }
    set(tokKey(c), t);
    return t;
  }

  /* ---------------- pull / push ---------------- */
  async function pullOnce(c, token) {
    const since = Number(get(revKey(c))) || 0;
    const j = await call({ action: 'pull', token, since });
    const snap = jparse(get(snapKey(c)), {});
    const dirty = new Set(jparse(get(dirtyKey(c)), []));
    const changedKeys = [];
    Object.entries(j.keys || {}).forEach(([base, rec]) => {
      if (base === REG && !c.code) return;
      if (!BASES.includes(base) && base !== REG) return;
      const local = localValue(c, base, false);
      const prev = snap[base] ? snap[base].v : undefined;
      let merged;
      if (prev === undefined) merged = (local == null) ? rec.v : merge3(null, local, rec.v);
      else if (local === prev) merged = rec.v;
      else merged = merge3(prev, local, rec.v);
      snap[base] = { v: rec.v, r: rec.r };
      if (merged !== local) { writeLocal(c, base, merged); changedKeys.push(fullKey(c, base)); }
      if (merged !== rec.v && (c.role === 'm' || RESIDENT_WRITABLE.includes(base))) dirty.add(base); else dirty.delete(base);
    });
    set(snapKey(c), JSON.stringify(snap));
    set(revKey(c), String(Math.max(since, j.rev || 0)));
    set(dirtyKey(c), JSON.stringify([...dirty]));
    if (changedKeys.length) fire(changedKeys);
    return changedKeys.length;
  }

  async function pushOnce(c, token, keepalive) {
    const dirty = new Set(jparse(get(dirtyKey(c)), []));
    if (!dirty.size) return 0;
    const snap = jparse(get(snapKey(c)), {});
    const changes = {}; const sent = {};
    dirty.forEach(base => {
      if (c.role === 'r' && !RESIDENT_WRITABLE.includes(base)) { dirty.delete(base); return; }
      const cmp = localValue(c, base, false);
      if (snap[base] && cmp === snap[base].v) { dirty.delete(base); return; }
      changes[base] = { v: localValue(c, base, true), r: snap[base] ? snap[base].r : 0 };
      sent[base] = cmp;
    });
    set(dirtyKey(c), JSON.stringify([...dirty]));
    if (!Object.keys(changes).length) return 0;
    const j = await call({ action: 'push', token, changes }, keepalive);
    const d2 = new Set(jparse(get(dirtyKey(c)), []));
    const changedKeys = [];
    Object.entries(j.applied || {}).forEach(([base, r]) => {
      snap[base] = { v: sent[base], r };
      if (localValue(c, base, false) === sent[base]) d2.delete(base);
    });
    Object.entries(j.conflicts || {}).forEach(([base, rec]) => {
      const local = localValue(c, base, false);
      const prev = snap[base] ? snap[base].v : null;
      const merged = merge3(prev, local, rec.v);
      snap[base] = { v: rec.v, r: rec.r };
      if (merged !== local) { writeLocal(c, base, merged); changedKeys.push(fullKey(c, base)); }
      if (merged !== rec.v) d2.add(base); else d2.delete(base);
    });
    set(snapKey(c), JSON.stringify(snap));
    set(dirtyKey(c), JSON.stringify([...d2]));
    if (changedKeys.length) fire(changedKeys);
    return Object.keys(j.conflicts || {}).length;
  }

  async function syncNow(opts) {
    const c = ctx();
    if (!c) return;
    if (busy) { again = true; return; }
    busy = true;
    try {
      badge('busy');
      let token;
      try { token = await ensureToken(c); }
      catch (e) {
        if (e.status === 401) { badge('auth', 'رمز این حساب روی سرور با این دستگاه یکی نیست'); return; }
        throw e;
      }
      try {
        for (let i = 0; i < 3; i++) { const conflicts = await pushOnce(c, token); if (!conflicts) break; }
        await pullOnce(c, token);
        for (let i = 0; i < 2; i++) { const conflicts = await pushOnce(c, token); if (!conflicts) break; }
      } catch (e) {
        if (e.status === 401) { del(tokKey(c)); }
        throw e;
      }
      badge('ok', 'آخرین همگام‌سازی: ' + new Date().toLocaleTimeString('fa-IR'));
    } catch (e) {
      badge(e.status ? 'err' : 'off', String(e.message || e));
      if (opts && opts.throw) throw e;
    } finally {
      busy = false;
      if (again) { again = false; schedulePush(300); }
    }
  }

  function schedulePush(ms) {
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => syncNow(), ms == null ? 800 : ms);
  }

  /* ---------------- رهگیری تغییرات localStorage ---------------- */
  function noteChange(k) {
    if (applying || !k || k.indexOf(P) !== 0) return;
    const c = ctx(); if (!c) return;
    let base = null;
    if (k === P + REG) base = REG;
    else {
      const suf = '_' + c.phone;
      if (k.endsWith(suf)) { const b = k.slice(P.length, -suf.length); if (BASES.includes(b)) base = b; }
    }
    if (!base) return;
    if (c.role === 'r' && !RESIDENT_WRITABLE.includes(base)) return;
    const d = new Set(jparse(get(dirtyKey(c)), []));
    if (!d.has(base)) { d.add(base); set(dirtyKey(c), JSON.stringify([...d])); }
    schedulePush();
  }
  S.setItem = function (k, v) { origSet.call(this, k, v); if (this === ls) noteChange(String(k)); };
  S.removeItem = function (k) { origRemove.call(this, k); if (this === ls) noteChange(String(k)); };

  /* ---------------- API عمومی (برای صفحه ورود و پنل ساکن) ---------------- */
  const AptSync = {
    get state() { return state; },
    syncNow: () => syncNow(),
    /** ورود مدیر در دستگاه جدید: اگر حساب روی سرور باشد، داده‌ها را می‌آورد */
    async managerRemoteLogin(phone, passHash) {
      phone = normPhone(phone);
      const j = await call({ action: 'login', phone, passHash });
      const c = { role: 'm', phone, code: j.code || '' };
      set(tokKey(c), j.token);
      del(revKey(c)); del(snapKey(c));
      await pullOnce(c, j.token);
      return j;
    },
    /** باز کردن ساختمان با کد (پنل ساکن در دستگاه جدید) */
    async openBuilding(code) {
      code = String(code || '').trim().toUpperCase();
      const j = await call({ action: 'open', code });
      const c = { role: 'r', phone: j.phone, code: j.code };
      set('apt_sync_open', JSON.stringify({ phone: j.phone, code: j.code }));
      set(tokKey(c), j.token);
      await pullOnce(c, j.token);
      return j;
    },
    /** گرفتن ردیف ثبت‌نام خود ساکن (با رمز) از سرور */
    async residentRemoteLogin(code, residentPhone, passHash) {
      const j = await call({ action: 'resident_login', code: String(code).trim().toUpperCase(), residentPhone: normPhone(residentPhone), passHash });
      if (j && j.resident) {
        applying = true;
        try {
          const all = jparse(get(P + REG), []);
          const i = all.findIndex(r => r && String(r.id) === String(j.resident.id) && String(r.buildingCode || '').toUpperCase() === String(j.resident.buildingCode || '').toUpperCase());
          if (i >= 0) all[i] = Object.assign({}, all[i], j.resident); else all.push(j.resident);
          set(P + REG, JSON.stringify(all));
        } finally { applying = false; }
      }
      return j;
    },
    async changeManagerPassword(oldHash, newHash) {
      const c = ctx(); if (!c || c.role !== 'm') return;
      let token = get(tokKey(c));
      if (!token) { token = (await call({ action: 'login', phone: c.phone, passHash: oldHash })).token; set(tokKey(c), token); }
      return call({ action: 'change_password', token, oldHash, newHash });
    },
    forget() { const c = ctx(); if (c) del(tokKey(c)); },
  };
  window.AptSync = AptSync;

  /* ---------------- چرخه ---------------- */
  function start() {
    syncNow();
    clearInterval(pollTimer);
    pollTimer = setInterval(() => { if (document.visibilityState !== 'hidden') syncNow(); }, POLL_MS);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') syncNow(); });
    window.addEventListener('online', () => syncNow());
    window.addEventListener('pagehide', () => {
      const c = ctx(); const t = c && get(tokKey(c));
      if (c && t && jparse(get(dirtyKey(c)), []).length) pushOnce(c, t, true).catch(() => {});
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
