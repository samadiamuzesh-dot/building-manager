/* ============================================================
   ☁️ آپارتمان پلاس — سرور همگام‌سازی پنل مدیر و پنل ساکن
   Vercel Serverless Function  (POST /api/sync)
   ذخیره‌سازی: Upstash Redis (REST)  — بدون وابستگی npm
   ------------------------------------------------------------
   متغیرهای محیطی:
     KV_REST_API_URL / KV_REST_API_TOKEN      (یکپارچه‌سازی Upstash در Vercel)
       یا UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN
     SYNC_SECRET   (اختیاری؛ کلید امضای توکن‌ها)
   قرارداد API در docs/SYNC-API.md آمده تا بعداً روی هاست PHP هم
   با همین قرارداد پیاده شود.
   ============================================================ */
const crypto = require('crypto');

const R_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const R_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const SECRET = process.env.SYNC_SECRET || ('apt+' + (R_TOKEN || 'dev'));

// کلیدهایی که همگام می‌شوند (بدون پیشوند ham_sakhteman_ و بدون شماره مدیر)
const BASES = ['v3', 'units', 'charges', 'expenses', 'messages', 'notices', 'notifications',
  'settings', 'side_incomes', 'tickets', 'votings', 'plan', 'registered_residents'];
// کلیدهایی که ساکن اجازه نوشتن دارد
const RESIDENT_WRITABLE = ['units', 'charges', 'messages', 'notifications', 'votings', 'tickets', 'registered_residents'];
const TOKEN_TTL = 1000 * 60 * 60 * 24 * 60; // ۶۰ روز
const MAX_BODY = 4 * 1024 * 1024;

/* ---------------- Redis ---------------- */
async function redis(cmd) {
  const r = await fetch(R_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${R_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd),
  });
  const j = await r.json();
  if (j.error) throw new Error('redis: ' + j.error);
  return j.result;
}
async function pipeline(cmds) {
  if (!cmds.length) return [];
  const r = await fetch(R_URL.replace(/\/$/, '') + '/pipeline', {
    method: 'POST',
    headers: { Authorization: `Bearer ${R_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmds),
  });
  const j = await r.json();
  return j.map(x => { if (x.error) throw new Error('redis: ' + x.error); return x.result; });
}
const kB = (phone) => `apt:b:${phone}`;       // hash: meta + k:<base>
const kCode = (code) => `apt:code:${code}`;   // string: phone
const kLock = (phone) => `apt:lock:${phone}`;

async function withLock(phone, fn) {
  const id = crypto.randomBytes(8).toString('hex');
  for (let i = 0; i < 40; i++) {
    const ok = await redis(['SET', kLock(phone), id, 'NX', 'PX', '8000']);
    if (ok === 'OK') {
      try { return await fn(); }
      finally {
        const cur = await redis(['GET', kLock(phone)]);
        if (cur === id) await redis(['DEL', kLock(phone)]);
      }
    }
    await new Promise(r => setTimeout(r, 120));
  }
  throw Object.assign(new Error('busy'), { status: 503 });
}

/* ---------------- helpers ---------------- */
const normPhone = (p) => String(p || '').replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
  .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/\D/g, '');
const normCode = (c) => String(c || '').trim().toUpperCase();

function scrypt(pass, salt) {
  return crypto.scryptSync(String(pass), salt, 32).toString('hex');
}
function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const mac = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  return body + '.' + mac;
}
function verify(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [body, mac] = token.split('.');
  const good = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  if (mac.length !== good.length || !crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(good))) return null;
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (!p.e || p.e < Date.now()) return null;
    return p;
  } catch (e) { return null; }
}
function fail(status, error, extra) { return Object.assign(new Error(error), { status, extra }); }

async function rateLimit(key, max, sec) {
  const [n] = await pipeline([['INCR', 'apt:rl:' + key], ['EXPIRE', 'apt:rl:' + key, String(sec), 'NX']]);
  if (n > max) throw fail(429, 'too_many_attempts');
}

async function getMeta(phone) {
  const raw = await redis(['HGET', kB(phone), 'meta']);
  return raw ? JSON.parse(raw) : null;
}
function codeFromV3(v) {
  try { return normCode(JSON.parse(v)?.building?.code); } catch (e) { return ''; }
}

// ساکن نمی‌تواند خودش را تأیید کند یا شارژی را «پرداخت‌شده» علامت بزند
function residentGuard(base, incoming, current) {
  if (incoming == null) return current == null ? null : current; // ساکن حذف کامل ندارد
  let inc, cur;
  try { inc = JSON.parse(incoming); cur = current ? JSON.parse(current) : []; } catch (e) { return current; }
  if (!Array.isArray(inc)) return current;
  const byId = new Map((Array.isArray(cur) ? cur : []).map(x => [String(x && x.id), x]));
  if (base === 'registered_residents') {
    inc = inc.map(r => {
      if (!r || typeof r !== 'object') return r;
      const old = byId.get(String(r.id));
      if (old) return Object.assign({}, r, { status: old.status, reviewedAt: old.reviewedAt });
      return Object.assign({}, r, { status: 'pending' });
    });
    // ردیف‌های قبلی را ساکن نمی‌تواند حذف کند
    const seen = new Set(inc.map(r => String(r && r.id)));
    byId.forEach((r, id) => { if (!seen.has(id)) inc.push(r); });
  } else if (base === 'charges') {
    inc = inc.map(c => {
      if (!c || typeof c !== 'object') return c;
      const old = byId.get(String(c.id));
      if (!old) return null; // ساکن شارژ جدید صادر نمی‌کند
      const o = Object.assign({}, old);
      // فقط فیلدهای اعلام پرداخت از طرف ساکن پذیرفته می‌شود
      if (!old.paid) ['pendingApproval', 'pendingAt', 'payMethod', 'payDescription', 'trackingCode', 'paidByResident', 'receipt', 'receiptImage', 'residentNote', 'rejectReason', 'rejectedAt']
        .forEach(f => { if (f in c) o[f] = c[f]; });
      return o;
    }).filter(Boolean);
    const seen = new Set(inc.map(c => String(c.id)));
    byId.forEach((c, id) => { if (!seen.has(id)) inc.push(c); });
  }
  return JSON.stringify(inc);
}

// حذف رمزهای ساکنین از خروجی
function stripSecrets(base, v) {
  if (base !== 'registered_residents' || v == null) return v;
  try {
    const list = JSON.parse(v);
    if (!Array.isArray(list)) return v;
    return JSON.stringify(list.map(r => { if (!r || typeof r !== 'object') return r; const { password, passwordHash, ...rest } = r; return rest; }));
  } catch (e) { return v; }
}
// هنگام ذخیره، رمزهای قبلی را برای ردیف‌هایی که بدون رمز آمده‌اند حفظ کن
function keepSecrets(base, incoming, current) {
  if (base !== 'registered_residents' || incoming == null) return incoming;
  try {
    const inc = JSON.parse(incoming); const cur = current ? JSON.parse(current) : [];
    if (!Array.isArray(inc)) return incoming;
    const byId = new Map((Array.isArray(cur) ? cur : []).map(r => [String(r && r.id), r]));
    return JSON.stringify(inc.map(r => {
      if (!r || typeof r !== 'object') return r;
      const old = byId.get(String(r.id));
      if (!r.passwordHash && !r.password && old && (old.passwordHash || old.password)) {
        return Object.assign({}, r, old.passwordHash ? { passwordHash: old.passwordHash } : { password: old.password });
      }
      return r;
    }));
  } catch (e) { return incoming; }
}

async function readKeys(phone, since) {
  const all = await redis(['HGETALL', kB(phone)]) || [];
  const keys = {}; let rev = 0;
  for (let i = 0; i < all.length; i += 2) {
    const f = all[i]; if (!f.startsWith('k:')) continue;
    const base = f.slice(2); const rec = JSON.parse(all[i + 1]);
    rev = Math.max(rev, rec.r || 0);
    if ((rec.r || 0) > (since || 0)) keys[base] = { v: stripSecrets(base, rec.v), r: rec.r };
  }
  return { keys, rev };
}

/* ---------------- actions ---------------- */
async function managerAuth(body, create) {
  const phone = normPhone(body.phone); const pass = String(body.passHash || '');
  if (phone.length < 10 || !pass) throw fail(400, 'bad_request');
  await rateLimit('m:' + phone, 30, 900);
  let meta = await getMeta(phone);
  if (!meta) {
    if (!create) throw fail(404, 'not_found');
    const code = normCode(body.code);
    if (code) {
      const owner = await redis(['GET', kCode(code)]);
      if (owner && owner !== phone) throw fail(409, 'code_taken');
    }
    const salt = crypto.randomBytes(16).toString('hex');
    meta = { salt, pass: scrypt(pass, salt), code, createdAt: Date.now() };
    const cmds = [['HSET', kB(phone), 'meta', JSON.stringify(meta)]];
    if (code) cmds.push(['SET', kCode(code), phone]);
    await pipeline(cmds);
  } else if (scrypt(pass, meta.salt) !== meta.pass) {
    throw fail(401, 'bad_password');
  }
  return { token: sign({ p: phone, ro: 'm', e: Date.now() + TOKEN_TTL }), phone, code: meta.code || '' };
}

async function residentOpen(body) {
  const code = normCode(body.code);
  if (!code) throw fail(400, 'bad_request');
  await rateLimit('c:' + code, 60, 900);
  const phone = await redis(['GET', kCode(code)]);
  if (!phone) throw fail(404, 'not_found');
  return { token: sign({ p: phone, ro: 'r', c: code, e: Date.now() + TOKEN_TTL }), phone, code };
}

async function residentLogin(body) {
  const { phone: mPhone, code } = await residentOpen(body);
  const rPhone = normPhone(body.residentPhone); const pass = String(body.passHash || '');
  await rateLimit('r:' + code + ':' + rPhone, 20, 900);
  const raw = await redis(['HGET', kB(mPhone), 'k:registered_residents']);
  const list = raw ? (JSON.parse(JSON.parse(raw).v || '[]') || []) : [];
  const r = list.find(x => x && normCode(x.buildingCode) === code && normPhone(x.phone) === rPhone && x.status !== 'rejected');
  if (!r) throw fail(404, 'resident_not_found');
  if (!(r.passwordHash && r.passwordHash === pass)) throw fail(401, 'bad_password');
  return { ok: true, resident: r };
}

function auth(body) {
  const t = verify(body.token);
  if (!t) throw fail(401, 'bad_token');
  return t;
}

async function checkResidentCode(t) {
  if (t.ro !== 'r') return;
  const meta = await getMeta(t.p);
  if (!meta || normCode(meta.code) !== normCode(t.c)) throw fail(401, 'bad_token');
}

async function pull(body) {
  const t = auth(body); await checkResidentCode(t);
  const { keys, rev } = await readKeys(t.p, Number(body.since) || 0);
  return { keys, rev };
}

async function push(body) {
  const t = auth(body); await checkResidentCode(t);
  const changes = body.changes && typeof body.changes === 'object' ? body.changes : {};
  const applied = {}; const conflicts = {};
  await withLock(t.p, async () => {
    const all = await redis(['HGETALL', kB(t.p)]) || [];
    const cur = {}; let rev = 0; let meta = null;
    for (let i = 0; i < all.length; i += 2) {
      if (all[i] === 'meta') { meta = JSON.parse(all[i + 1]); continue; }
      if (!all[i].startsWith('k:')) continue;
      const rec = JSON.parse(all[i + 1]); cur[all[i].slice(2)] = rec; rev = Math.max(rev, rec.r || 0);
    }
    if (!meta) throw fail(404, 'not_found');
    const cmds = [];
    for (const [base, ch] of Object.entries(changes)) {
      if (!BASES.includes(base)) continue;
      if (t.ro === 'r' && !RESIDENT_WRITABLE.includes(base)) continue;
      if (!ch || typeof ch !== 'object') continue;
      const have = cur[base];
      const haveRev = have ? have.r : 0;
      if ((Number(ch.r) || 0) !== haveRev) {
        conflicts[base] = { v: have ? stripSecrets(base, have.v) : null, r: haveRev };
        continue;
      }
      let v = ch.v == null ? null : keepSecrets(base, String(ch.v), have && have.v);
      if (t.ro === 'r' && (base === 'registered_residents' || base === 'charges')) v = residentGuard(base, v, have && have.v);
      rev += 1;
      if (v == null) cmds.push(['HDEL', kB(t.p), 'k:' + base]);
      else cmds.push(['HSET', kB(t.p), 'k:' + base, JSON.stringify({ v, r: rev, t: Date.now(), by: t.ro })]);
      applied[base] = rev;
      // کد ساختمان تغییر کرد → ایندکس کد را به‌روز کن (فقط مدیر)
      if (base === 'v3' && t.ro === 'm' && v) {
        const code = codeFromV3(v);
        if (code && code !== normCode(meta.code)) {
          const owner = await redis(['GET', kCode(code)]);
          if (!owner || owner === t.p) {
            if (meta.code) cmds.push(['DEL', kCode(normCode(meta.code))]);
            cmds.push(['SET', kCode(code), t.p]);
            meta.code = code;
            cmds.push(['HSET', kB(t.p), 'meta', JSON.stringify(meta)]);
          }
        }
      }
    }
    await pipeline(cmds);
  });
  return { applied, conflicts };
}

async function changePassword(body) {
  const t = auth(body);
  if (t.ro !== 'm') throw fail(403, 'forbidden');
  const meta = await getMeta(t.p);
  if (!meta) throw fail(404, 'not_found');
  if (scrypt(String(body.oldHash || ''), meta.salt) !== meta.pass) throw fail(401, 'bad_password');
  meta.salt = crypto.randomBytes(16).toString('hex');
  meta.pass = scrypt(String(body.newHash || ''), meta.salt);
  await redis(['HSET', kB(t.p), 'meta', JSON.stringify(meta)]);
  return { ok: true };
}

/* ---------------- handler ---------------- */
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method === 'GET') return res.status(200).json({ ok: true, service: 'apartment-plus-sync', storage: !!(R_URL && R_TOKEN) });
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
  if (!R_URL || !R_TOKEN) return res.status(500).json({ error: 'storage_not_configured' });
  try {
    let body = req.body;
    if (typeof body === 'string') { if (body.length > MAX_BODY) throw fail(413, 'too_large'); body = JSON.parse(body || '{}'); }
    body = body || {};
    let out;
    switch (body.action) {
      case 'login': out = await managerAuth(body, false); break;
      case 'register': out = await managerAuth(body, true); break;
      case 'open': out = await residentOpen(body); break;
      case 'resident_login': out = await residentLogin(body); break;
      case 'pull': out = await pull(body); break;
      case 'push': out = await push(body); break;
      case 'change_password': out = await changePassword(body); break;
      default: throw fail(400, 'unknown_action');
    }
    return res.status(200).json(out);
  } catch (e) {
    const status = e.status || 500;
    if (status === 500) console.error(e);
    return res.status(status).json(Object.assign({ error: e.message }, e.extra || {}));
  }
};

// برای تست محلی
module.exports._internals = { sign, verify, stripSecrets, keepSecrets, BASES };
