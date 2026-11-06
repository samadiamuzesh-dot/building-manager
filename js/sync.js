/* ============================================================
   ☁️ آپارتمان پلاس — همگام‌سازی ابری پنل مدیر ↔ پنل ساکن
   ------------------------------------------------------------
   این فایل قبل از app.js / resident-app.js / auth.js بارگذاری می‌شود.
   برنامه‌ها همچنان با localStorage کار می‌کنند؛ این لایه تغییرات را
   به سرور همگام‌سازی می‌فرستد و تغییرات دستگاه‌های دیگر را می‌گیرد.
   - آدرس سرور: window.APT_SYNC_URL (پیش‌فرض: افزونه وردپرس elhamsamadi.ir)
   - غیرفعال‌سازی: window.APT_SYNC_URL = false
   ============================================================ */
(function () {
  'use strict';
  if (typeof window === 'undefined' || !window.localStorage) return;
  if (window.APT_SYNC_URL === false) return;
  if (location.protocol === 'file:') return;
  // سرور موقت: افزونه وردپرس روی elhamsamadi.ir (تا خرید هاست جدا).
  // برای سرور دیگر قبل از این فایل window.APT_SYNC_URL را تنظیم کنید.
  const DEFAULT_API = 'https://elhamsamadi.ir/wp-json/apt-sync/v1/sync';
  const API = window.APT_SYNC_URL || DEFAULT_API;
  const P = 'ham_sakhteman_';
  const BASES = ['v3', 'units', 'charges', 'expenses', 'messages', 'notices', 'notifications',
    'settings', 'side_incomes', 'tickets', 'votings', 'plan', 'block_managers'];
  const REG = 'registered_residents';
  const RESIDENT_WRITABLE = ['units', 'charges', 'messages', 'notifications', 'votings', 'tickets', REG];
  // مدیر بلوک: فقط این کلیدها (سرور هم فقط بلوک خودش را می‌پذیرد)
  const BLOCK_WRITABLE = ['units', 'charges', 'messages', 'notices', REG];
  const BLOCK_SESSION = P + 'block_session';
  const canWrite = (c, base) => c.role === 'm' || (c.role === 'b' ? BLOCK_WRITABLE : RESIDENT_WRITABLE).includes(base);
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
      const rid = s && s.residentId != null && String(s.buildingCode || '').toUpperCase() === code ? String(s.residentId) : '';
      return phone ? { role: 'r', phone, code, rid, rPhone: normPhone(s && s.phone) } : null;
    }
    const bs = jparse(get(BLOCK_SESSION), null);
    if (bs && bs.managerPhone && bs.code && get(P + 'logged_out') !== 'true') {
      return { role: 'b', phone: normPhone(bs.managerPhone), code: String(bs.code).toUpperCase(), bPhone: normPhone(bs.phone), bHash: bs.passHash || '' };
    }
    const phone = normPhone(get(P + 'user_phone'));
    if (!phone || get(P + 'logged_out') === 'true') return null;
    return { role: 'm', phone, code: String(jparse(get(P + 'v3_' + phone), {})?.building?.code || '').toUpperCase() };
  }
  const tokKey = (c) => (c.role === 'r' && c.rid) ? `apt_sync_token_r${c.rid}_${c.phone}` : `apt_sync_token_${c.role}_${c.phone}`;
  const adoptKey = (c) => `apt_sync_adopt_${c.phone}`;
  let ridRetryAt = 0, usingGuest = false;
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
    if (base === 'block_managers' && !forPush) {
      const v = get(P + base + '_' + c.phone);
      if (v == null) return v;
      return JSON.stringify(stripRegs(jparse(v, [])));
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
      } else if (base === 'block_managers' && v != null) {
        // هش رمز مدیران بلوک فقط روی دستگاه مدیر کل می‌ماند (سرور برنمی‌گرداند)
        const cur = jparse(get(P + base + '_' + c.phone), []);
        const keep = new Map((Array.isArray(cur) ? cur : []).filter(r => r && r.passwordHash).map(r => [String(r.id), r.passwordHash]));
        const inc = jparse(v, []);
        set(P + base + '_' + c.phone, JSON.stringify(Array.isArray(inc) ? inc.map(r => (r && keep.has(String(r.id)) && !r.passwordHash) ? Object.assign({}, r, { passwordHash: keep.get(String(r.id)) }) : r) : inc));
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
  // واحدها و ثبت‌نام‌ها با id به هم ارجاع دارند؛ id آن‌ها عوض نشود
  const NO_REID = ['units', REG, 'v3', 'settings', 'plan', 'block_managers'];
  function freshId(l, r) {
    const max = Math.max(0, ...l.concat(r).map(x => Number(x.id) || 0));
    return Math.max(max + 1, Date.now()) + Math.floor(Math.random() * 1000);
  }
  function merge3(baseS, localS, remoteS, base) {
    if (localS === remoteS) return localS;
    if (baseS === localS) return remoteS;
    if (baseS === remoteS) return localS;
    const b = baseS === '' ? [] : jparse(baseS, null), l = jparse(localS, null), r = jparse(remoteS, null); // '' = می‌دانیم قبلاً خالی بوده
    if (Array.isArray(l) && Array.isArray(r) && l.every(x => x && x.id != null) && r.every(x => x && x.id != null)) {
      const B = new Map((Array.isArray(b) ? b : []).map(x => [String(x && x.id), x]));
      const L = new Map(l.map(x => [String(x.id), x]));
      const out = [];
      r.forEach(x => {
        const id = String(x.id); const bx = B.get(id); const lx = L.get(id);
        if (!lx) { if (bx && same(bx, x)) return; out.push(x); return; } // محلی حذف کرده
        if (bx && same(bx, lx)) out.push(x);          // فقط سرور تغییر داده
        else if (bx && same(bx, x)) out.push(lx);     // فقط محلی تغییر داده
        else if (!bx && Array.isArray(b) && !NO_REID.includes(base)) {
          // هر دو دستگاه همزمان ردیف تازه با یک id ساخته‌اند → هر دو بمانند
          out.push(x); out.push(Object.assign({}, lx, { id: freshId(l, r) }));
        }
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
    const payload = JSON.stringify(body);
    // مرورگرها keepalive را برای بدنه بالای ۶۴KB رد می‌کنند
    const r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload, keepalive: !!keepalive && payload.length < 60000, cache: 'no-store', credentials: 'omit' });
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
    if (t) { usingGuest = false; return t; }
    if (c.role === 'b') {
      if (!c.bHash || !c.bPhone) throw Object.assign(new Error('no_auth'), { status: 401 });
      try {
        const j = await call({ action: 'block_login', code: c.code, blockPhone: c.bPhone, passHash: c.bHash });
        set(tokKey(c), j.token);
        return j.token;
      } catch (e) {
        if (e.status === 401 || e.status === 403 || e.status === 404) blockRevoked(e.status);
        throw e;
      }
    }
    if (c.role === 'm') {
      const passHash = get(P + 'user_password');
      if (!passHash) throw Object.assign(new Error('no_auth'), { status: 401 });
      let j;
      try { j = await call({ action: 'login', phone: c.phone, passHash }); }
      catch (e) {
        if (e.status !== 404) throw e;
        // اولین بار: ساختمان این مدیر را روی سرور بساز و همه داده‌ها را بفرست
        j = await registerWithFreeCode(c, passHash);
        const d = new Set(jparse(get(dirtyKey(c)), []));
        BASES.forEach(b => { if (get(P + b + '_' + c.phone) != null) d.add(b); });
        if (c.code) d.add(REG);
        set(dirtyKey(c), JSON.stringify([...d]));
      }
      t = j.token;
    } else {
      if (!c.code) throw Object.assign(new Error('no_code'), { status: 401 });
      // ساکن واردشده: توکن با هویت خودش (فقط واحد/شارژ/پیام خودش را می‌تواند تغییر دهد)
      if (c.rid && Date.now() >= ridRetryAt) {
        const me = jparse(get(P + REG), []).find(r => r && String(r.id) === c.rid);
        const ph = normPhone((me && me.phone) || c.rPhone);
        if (me && me.passwordHash && ph) {
          try {
            const j = await call({ action: 'resident_login', code: c.code, residentPhone: ph, passHash: me.passwordHash });
            if (j && j.token) { adoptResidentView(c, j.token); return j.token; }
          } catch (e) {
            if (!e.status) throw e;           // آفلاین
            // 404: ثبت‌نام هنوز به سرور نرسیده (چرخه بعد دوباره)؛ رمز اشتباه/محدودیت: ۲ دقیقه بعد
            ridRetryAt = e.status === 404 ? 0 : Date.now() + 120000;
          }
        }
      }
      usingGuest = !!c.rid;
      const gk = `apt_sync_token_r_${c.phone}`;
      t = get(gk);
      if (!t) { const j = await call({ action: 'open', code: c.code }); t = j.token; set(gk, t); }
      return t;
    }
    set(tokKey(c), t);
    return t;
  }

  // اگر کد ساختمان روی سرور متعلق به مدیر دیگری باشد، یک کد تازه بساز و دوباره ثبت کن
  async function registerWithFreeCode(c, passHash) {
    for (let i = 0; i < 6; i++) {
      try { return await call({ action: 'register', phone: c.phone, passHash, code: c.code }); }
      catch (e) {
        if (e.status !== 409 || !c.code) throw e;
        const prefix = (c.code.match(/^[A-Z]+-/) || ['S-'])[0];
        const newCode = prefix + Math.floor(100000 + Math.random() * 900000);
        const v3 = jparse(get(P + 'v3_' + c.phone), null);
        if (v3 && v3.building) {
          v3.building.code = newCode;
          applying = true;
          try { set(P + 'v3_' + c.phone, JSON.stringify(v3)); } finally { applying = false; }
          // ثبت‌نام‌های محلی ساکنین این ساختمان هم کد جدید بگیرند
          const regs = jparse(get(P + REG), []);
          let changed = false;
          regs.forEach(r => { if (r && String(r.buildingCode || '').toUpperCase() === c.code) { r.buildingCode = newCode; changed = true; } });
          if (changed) { applying = true; try { set(P + REG, JSON.stringify(regs)); } finally { applying = false; } }
          fire([P + 'v3_' + c.phone]);
        }
        c.code = newCode;
      }
    }
    throw Object.assign(new Error('code_taken'), { status: 409 });
  }

  /* ---------------- pull / push ---------------- */
  async function pullOnce(c, token) {
    const since = Number(get(revKey(c))) || 0;
    const j = await call({ action: 'pull', token, since });
    const adopt = get(adoptKey(c)) === '1';
    if (adopt) del(dirtyKey(c));
    const snap = jparse(get(snapKey(c)), {});
    const dirty = new Set(jparse(get(dirtyKey(c)), []));
    const changedKeys = [];
    Object.entries(j.keys || {}).forEach(([base, rec]) => {
      if (base === REG && !c.code) return;
      if (!BASES.includes(base) && base !== REG) return;
      const local = localValue(c, base, false);
      const prev = snap[base] ? snap[base].v : undefined;
      let merged;
      if (adopt) merged = rec.v; // نمای تازه سرور (بعد از ورود ساکن): نسخه سرور را بپذیر
      else if (prev === undefined) merged = (local == null) ? rec.v : merge3(since > 0 ? '' : null, local, rec.v, base);
      else if (local === prev) merged = rec.v;
      else merged = merge3(prev, local, rec.v, base);
      snap[base] = { v: rec.v, r: rec.r };
      if (merged !== local) { writeLocal(c, base, merged); changedKeys.push(fullKey(c, base)); }
      if (merged !== rec.v && canWrite(c, base)) dirty.add(base); else dirty.delete(base);
    });
    set(snapKey(c), JSON.stringify(snap));
    set(revKey(c), String(Math.max(since, j.rev || 0)));
    set(dirtyKey(c), JSON.stringify([...dirty]));
    if (adopt) del(adoptKey(c));
    if (changedKeys.length) fire(changedKeys);
    return changedKeys.length;
  }
  /** ساکن با هویت خودش (توکن rid) به سرور وصل شود؛ داده‌ها از نو با نمای خودش گرفته شود */
  function adoptResidentView(c, token) {
    set(tokKey(c), token);
    del(revKey(c)); del(snapKey(c)); set(adoptKey(c), '1');
  }

  async function pushOnce(c, token, keepalive) {
    const dirty = new Set(jparse(get(dirtyKey(c)), []));
    if (!dirty.size) return 0;
    const snap = jparse(get(snapKey(c)), {});
    const changes = {}; const sent = {};
    dirty.forEach(base => {
      if (!canWrite(c, base)) { dirty.delete(base); return; }
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
      const prev = snap[base] ? snap[base].v : (Number(get(revKey(c))) > 0 ? '' : null);
      const merged = merge3(prev, local, rec.v, base);
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
        // ثبت‌نام تازه همین الان به سرور رسید: با هویت ساکن دوباره وصل شو
        if (c.role === 'r' && c.rid && usingGuest) {
          const t2 = await ensureToken(c);
          if (t2 !== token) { token = t2; await pullOnce(c, token); for (let i = 0; i < 2; i++) { const cf = await pushOnce(c, token); if (!cf) break; } }
        }
      } catch (e) {
        if (e.status === 401) { del(tokKey(c)); if (c.role === 'r') del(`apt_sync_token_r_${c.phone}`); }
        throw e;
      }
      badge('ok', 'آخرین همگام‌سازی: ' + new Date().toLocaleTimeString('fa-IR'));
      // برنامه‌ها (زنگوله، صدا و اعلان) بلافاصله بعد از هر دریافت از سرور به‌روز شوند
      try { window.dispatchEvent(new CustomEvent('apt-sync-pulled', { detail: { role: c.role } })); } catch (e) {}
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
    if (!canWrite(c, base)) return;
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
      // این دستگاه قبلاً با حساب مدیر بلوک باز بوده: نمای محدود بلوک را پاک کن
      const bs = jparse(get(BLOCK_SESSION), null);
      if (bs) { wipeLocal(normPhone(bs.managerPhone), String(bs.code || '').toUpperCase()); del(BLOCK_SESSION); }
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
          const row = Object.assign({}, j.resident, { passwordHash: passHash }); // رمز تأییدشده توسط سرور
          const i = all.findIndex(r => r && String(r.id) === String(j.resident.id) && String(r.buildingCode || '').toUpperCase() === String(j.resident.buildingCode || '').toUpperCase());
          if (i >= 0) all[i] = Object.assign({}, all[i], row); else all.push(row);
          set(P + REG, JSON.stringify(all));
        } finally { applying = false; }
        if (j.token && j.phone) adoptResidentView({ role: 'r', phone: normPhone(j.phone), code: String(j.code || '').toUpperCase(), rid: String(j.resident.id) }, j.token);
      }
      return j;
    },
    /** هش رمز مدیر بلوک (روی سرور دوباره با bcrypt ذخیره می‌شود) */
    hashBlockPassword(str) {
      let h = 0; const s = 'ap+blk:' + String(str);
      for (let i = 0; i < s.length; i++) { h = ((h << 5) - h) + s.charCodeAt(i); h |= 0; }
      return 'bh_' + Math.abs(h).toString(36);
    },
    /** ورود مدیر بلوک: داده‌های قبلی این ساختمان روی دستگاه پاک و نمای بلوک از سرور گرفته می‌شود */
    async blockLogin(code, blockPhone, passHash) {
      code = String(code || '').trim().toUpperCase();
      const j = await call({ action: 'block_login', code, blockPhone: normPhone(blockPhone), passHash });
      const phone = normPhone(j.phone);
      wipeLocal(phone, String(j.code || code).toUpperCase());
      const m = j.manager || {};
      set(BLOCK_SESSION, JSON.stringify({ managerPhone: phone, code: String(j.code || code).toUpperCase(), id: m.id, name: m.name || '', phone: normPhone(m.phone || blockPhone), block: m.block || '', passHash, at: new Date().toISOString() }));
      set(P + 'user_phone', phone);
      del(P + 'user_password'); del(P + 'logged_out');
      const c = ctx();
      set(tokKey(c), j.token);
      await pullOnce(c, j.token);
      return j;
    },
    /** بلوک‌های یک ساختمان برای فرم ثبت‌نام مدیر بلوک (سرور ۱.۳) */
    blockInfo(code) {
      return call({ action: 'block_info', code: String(code || '').trim().toUpperCase() });
    },
    /** درخواست ثبت‌نام مدیر بلوک؛ تا تأیید مدیر کل «در انتظار» می‌ماند */
    blockRegister(o) {
      return call({ action: 'block_register', code: String(o.code || '').trim().toUpperCase(), block: String(o.block || '').trim(),
        name: String(o.name || '').trim(), blockPhone: normPhone(o.phone), passHash: o.passHash });
    },
    /** خروج مدیر بلوک: همه داده‌های بلوک از این دستگاه پاک می‌شود */
    blockLogout() {
      const bs = jparse(get(BLOCK_SESSION), null);
      if (bs) wipeLocal(normPhone(bs.managerPhone), String(bs.code || '').toUpperCase());
      del(BLOCK_SESSION); del(P + 'user_phone'); del(P + 'user_password'); del(P + 'auth');
    },
    wipeLocal: (phone, code) => wipeLocal(normPhone(phone), String(code || '').toUpperCase()),
    async changeManagerPassword(oldHash, newHash) {
      const c = ctx(); if (!c || c.role !== 'm') return;
      let token = get(tokKey(c));
      if (!token) { token = (await call({ action: 'login', phone: c.phone, passHash: oldHash })).token; set(tokKey(c), token); }
      return call({ action: 'change_password', token, oldHash, newHash });
    },
    forget() { const c = ctx(); if (c) del(tokKey(c)); },
    /** هویت فعلی این صفحه (برای کلید «دیده‌شده»های اعلان و ثبت اشتراک push) */
    identity() {
      const c = ctx(); if (!c) return '';
      if (c.role === 'r') return c.rid ? 'r_' + c.phone + '_' + c.rid : '';
      if (c.role === 'b') { const bs = jparse(get(BLOCK_SESSION), {}); return 'b_' + c.phone + '_' + (bs.id != null ? bs.id : c.bPhone); }
      return 'm_' + c.phone;
    },
    /* ---------- اعلان فوری Web Push (سرور ۱.۴) ---------- */
    async pushKey() { const j = await call({ action: 'push_key' }); return j && j.key; },
    async pushRegister(sub) {
      const c = ctx(); if (!c) throw Object.assign(new Error('no_ctx'), { status: 401 });
      if (c.role === 'r' && !c.rid) throw Object.assign(new Error('need_login'), { status: 403 });
      const token = await ensureToken(c);
      if (c.role === 'r' && usingGuest) throw Object.assign(new Error('need_login'), { status: 403 });
      return call({ action: 'push_sub', token, sub });
    },
    async pushUnregister(endpoint) {
      const c = ctx(); if (!c || !endpoint) return;
      const token = get(tokKey(c)); if (!token) return;
      return call({ action: 'push_unsub', token, endpoint }, true);
    },
  };
  window.AptSync = AptSync;

  /** پاک کردن داده‌ها و وضعیت همگام‌سازی یک ساختمان از این دستگاه */
  function wipeLocal(phone, code) {
    applying = true;
    try {
      BASES.forEach(b => del(P + b + '_' + phone));
      ['m', 'b', 'r'].forEach(r => { del(`apt_sync_token_${r}_${phone}`); del(`apt_sync_dirty_${r}_${phone}`); });
      del(`apt_sync_snap_${phone}`); del(`apt_sync_rev_${phone}`); del(`apt_sync_adopt_${phone}`);
      if (code) {
        const all = jparse(get(P + REG), []);
        if (Array.isArray(all)) set(P + REG, JSON.stringify(all.filter(r => !(r && String(r.buildingCode || '').toUpperCase() === code))));
      }
    } finally { applying = false; }
  }
  /** مدیر بلوک غیرفعال/حذف شد یا رمزش عوض شد */
  function blockRevoked(status) {
    try { window.dispatchEvent(new CustomEvent('apt-block-revoked', { detail: { status } })); } catch (e) {}
  }

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
