/* ============================================================
   🏠 اپلیکیشن ساکنین — آپارتمان پلاس
   ============================================================ */

const RESIDENT_SESSION_KEY = 'ham_sakhteman_resident_session';
const RESIDENT_REGISTERED_KEY = 'ham_sakhteman_registered_residents';

/* ============ ابزار ============ */
function formatTomanR(a) { return new Intl.NumberFormat('fa-IR').format(Number(a) || 0) + ' تومان'; }
function formatNumberR(n) { return new Intl.NumberFormat('fa-IR').format(Number(n) || 0); }
function toPersianNumR(n) {
  const p = ['۰','۱','۲','۳','۴','۵','۶','۷','۸','۹'];
  return String(n).replace(/\d/g, d => p[d]);
}

function isValidIranMobileR(phone) {
  if (!phone) return false;
  let cleaned = String(phone);
  const persian = '۰۱۲۳۴۵۶۷۸۹';
  const arabic = '٠١٢٣٤٥٦٧٨٩';
  for (let i = 0; i < 10; i++) {
    cleaned = cleaned.replace(new RegExp(persian[i], 'g'), i);
    cleaned = cleaned.replace(new RegExp(arabic[i], 'g'), i);
  }
  cleaned = cleaned.replace(/[^\d]/g, '');
  return /^09\d{9}$/.test(cleaned);
}

function escapeHtmlR(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function normalizePhoneR(phone) {
  return String(phone || '')
    .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
    .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
    .replace(/[^\d]/g, '');
}

/** هش رمز ساکن (قبلاً رمز به‌صورت متن ساده ذخیره می‌شد) */
function hashResidentPassword(str) {
  let hash = 0;
  const salted = 'ap+res:' + String(str);
  for (let i = 0; i < salted.length; i++) {
    hash = ((hash << 5) - hash) + salted.charCodeAt(i);
    hash |= 0;
  }
  return 'rh_' + Math.abs(hash).toString(36);
}

/** واحد کاربر جاری (یکسان برای همه صفحات) */
function getMyUnit() {
  const session = getResidentSession();
  if (!session) return null;
  const units = loadUnits();
  return units.find(u => {
    if (session.block === '—' || !session.block) {
      return (u.block === '—' || !u.block) && Number(u.number) === Number(session.unitNumber);
    }
    return String(u.block).trim() === String(session.block).trim()
        && Number(u.number) === Number(session.unitNumber);
  }) || null;
}

/** اطلاعیه‌هایی که واقعاً برای این واحد ارسال شده (همه / بلوک / واحدهای انتخابی) */
function getMyNotices() {
  const session = getResidentSession();
  const myUnit = getMyUnit();
  return loadNotices().filter(n => {
    const t = n.targetType || 'all';
    if (t === 'all') return true;
    if (t === 'block') return session && String(n.targetBlock || '').trim() === String(session.block || '').trim();
    if (t === 'units') {
      const ids = (n.targetUnits || []).map(Number);
      return !!myUnit && ids.includes(Number(myUnit.id));
    }
    return true;
  });
}

/* ============ Toast ============ */
function showResidentToast(message, type = 'success', title = null) {
  let container = document.getElementById('residentToastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'residentToastContainer';
    container.className = 'resident-toast-container';
    document.body.appendChild(container);
  }

  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  const titles = { success: 'موفق', error: 'خطا', warning: 'هشدار', info: 'اطلاع' };

  const toast = document.createElement('div');
  toast.className = `resident-toast ${type}`;
  toast.innerHTML = `
    <div class="resident-toast-icon">${icons[type] || '✅'}</div>
    <div class="resident-toast-body">
      <div class="resident-toast-title">${title || titles[type] || 'پیام'}</div>
      <div class="resident-toast-message">${message}</div>
    </div>
  `;

  container.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 400);
  }, 3500);
}

/* ============ داده‌ها ============ */
function loadRegisteredResidents() {
  const raw = localStorage.getItem(RESIDENT_REGISTERED_KEY);
  if (raw) { try { return JSON.parse(raw); } catch (e) { return []; } }
  return [];
}

function saveRegisteredResidents(list) {
  localStorage.setItem(RESIDENT_REGISTERED_KEY, JSON.stringify(list));
}

/* کلید ذخیره‌سازی per-account مدیر (با شماره موبایل) */
let _residentResolvedPhone = null;

function _findManagerPhoneByBuildingCode(code) {
  if (!code) return null;
  const target = String(code).trim().toUpperCase();

  // ☁️ ساختمانی که همین الان از سرور باز شده، معتبرترین منبع است
  try {
    const open = JSON.parse(localStorage.getItem('apt_sync_open') || 'null');
    if (open && open.phone && String(open.code || '').toUpperCase() === target &&
        localStorage.getItem('ham_sakhteman_v3_' + open.phone)) {
      return String(open.phone);
    }
  } catch (e) {}
  // نشست فعلی ساکن (اگر همین ساختمان است)
  try {
    const s = JSON.parse(localStorage.getItem('ham_sakhteman_resident_session') || 'null');
    if (s && s.managerPhone && String(s.buildingCode || '').toUpperCase() === target) {
      const d = JSON.parse(localStorage.getItem('ham_sakhteman_v3_' + s.managerPhone) || 'null');
      if (d?.building?.code && String(d.building.code).toUpperCase() === target) return String(s.managerPhone);
    }
  } catch (e) {}

  // اول کلید قدیمی بدون scope
  try {
    const raw = localStorage.getItem('ham_sakhteman_v3');
    if (raw) {
      const data = JSON.parse(raw);
      if (data?.building?.code && String(data.building.code).toUpperCase() === target) {
        return localStorage.getItem('ham_sakhteman_user_phone') || null;
      }
    }
  } catch (e) {}

  // جستجو در همه کلیدهای scoped
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith('ham_sakhteman_v3_')) continue;
    try {
      const data = JSON.parse(localStorage.getItem(key) || 'null');
      if (data?.building?.code && String(data.building.code).toUpperCase() === target) {
        // استخراج شماره از انتهای کلید
        return key.replace('ham_sakhteman_v3_', '') || null;
      }
    } catch (e) {}
  }
  return null;
}

function _getScopedKey(baseKey) {
  // اگر قبلاً با کد ساختمان شماره مدیر پیدا شده
  if (_residentResolvedPhone) {
    return `${baseKey}_${_residentResolvedPhone}`;
  }
  // اگر کاربر مدیر لاگین است
  const phone = localStorage.getItem('ham_sakhteman_user_phone');
  if (phone) {
    const normalized = String(phone).replace(/\D/g, '');
    return `${baseKey}_${normalized}`;
  }
  return baseKey;
}

function loadData() {
  // اول scoped (اگر شماره مشخص است)
  const scopedKey = _getScopedKey('ham_sakhteman_v3');
  let raw = localStorage.getItem(scopedKey);
  if (raw) {
    try { return JSON.parse(raw); } catch (e) {}
  }
  // سپس کلید قدیمی (فقط وقتی ساختمان هنوز مشخص نشده)
  if (_residentResolvedPhone) return null;
  raw = localStorage.getItem('ham_sakhteman_v3');
  if (raw) {
    try { return JSON.parse(raw); } catch (e) {}
  }
  return null;
}

function loadUnits() {
  const scopedKey = _getScopedKey('ham_sakhteman_units');
  let raw = localStorage.getItem(scopedKey);
  if (raw) {
    try {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return arr;
    } catch (e) {}
  }
  // فقط اگر scope مشخص نیست، کلید قدیمی را به‌عنوان fallback بخوان
  if (!_residentResolvedPhone) {
    raw = localStorage.getItem('ham_sakhteman_units');
    if (raw) {
      try {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) return arr;
      } catch (e) {}
    }
  }
  return [];
}

function loadCharges() {
  const scopedKey = _getScopedKey('ham_sakhteman_charges');
  let raw = localStorage.getItem(scopedKey);
  if (raw) {
    try {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return arr;
    } catch (e) {}
  }
  if (_residentResolvedPhone) return [];
  raw = localStorage.getItem('ham_sakhteman_charges');
  if (raw) {
    try {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return arr;
    } catch (e) {}
  }
  return [];
}

function loadNotices() {
  const scopedKey = _getScopedKey('ham_sakhteman_notices');
  let raw = localStorage.getItem(scopedKey);
  if (raw) {
    try {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return arr;
    } catch (e) {}
  }
  if (_residentResolvedPhone) return [];
  raw = localStorage.getItem('ham_sakhteman_notices');
  if (raw) {
    try {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return arr;
    } catch (e) {}
  }
  return [];
}

function loadMessages() {
  const scopedKey = _getScopedKey('ham_sakhteman_messages');
  let raw = localStorage.getItem(scopedKey);
  if (raw) {
    try {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return arr;
    } catch (e) {}
  }
  if (_residentResolvedPhone) return [];
  raw = localStorage.getItem('ham_sakhteman_messages');
  if (raw) {
    try {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return arr;
    } catch (e) {}
  }
  return [];
}

function loadVotings() {
  const scopedKey = _getScopedKey('ham_sakhteman_votings');
  let raw = localStorage.getItem(scopedKey);
  if (raw) {
    try {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return arr;
    } catch (e) {}
  }
  if (_residentResolvedPhone) return [];
  raw = localStorage.getItem('ham_sakhteman_votings');
  if (raw) {
    try {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return arr;
    } catch (e) {}
  }
  return [];
}

/* ============ نشست ============ */
function getResidentSession() {
  const raw = localStorage.getItem(RESIDENT_SESSION_KEY);
  if (raw) { try { return JSON.parse(raw); } catch (e) { return null; } }
  return null;
}

function setResidentSession(session) {
  localStorage.setItem(RESIDENT_SESSION_KEY, JSON.stringify(session));
}

function clearResidentSession() {
  localStorage.removeItem(RESIDENT_SESSION_KEY);
}

/* ============ متغیرهای موقت ============ */
let tempBuildingCode = null;
let tempBlock = null;
let tempUnitNumber = null;

/* ============ مرحله ۱: کد ساختمان ============ */
function verifyBuildingCode() {
  const input = document.getElementById('residentBuildingCode');
  const errorEl = document.getElementById('residentCodeError');
  const code = input.value.trim().toUpperCase();

  input.classList.remove('input-error');
  errorEl.classList.remove('show');

  if (!code) {
    input.classList.add('input-error');
    errorEl.textContent = 'لطفاً کد ساختمان را وارد کنید.';
    errorEl.classList.add('show');
    return;
  }

  // پیدا کردن شماره مدیر از روی کد ساختمان (پشتیبانی از کلید scoped)
  let managerPhone = _findManagerPhoneByBuildingCode(code);
  // ☁️ ساختمان روی این گوشی نیست → یک بار از سرور ابری بگیر
  if (!managerPhone && window.AptSync && !verifyBuildingCode._remoteTried) {
    verifyBuildingCode._remoteTried = true;
    errorEl.textContent = '⏳ در حال جستجوی ساختمان…'; errorEl.classList.add('show');
    window.AptSync.openBuilding(code)
      .catch(() => {})
      .finally(() => { errorEl.classList.remove('show'); verifyBuildingCode(); verifyBuildingCode._remoteTried = false; });
    return;
  }
  if (!managerPhone) {
    // یک بار بدون scope هم چک کن
    const dataFallback = loadData();
    if (!dataFallback?.building?.code || String(dataFallback.building.code).toUpperCase() !== code) {
      input.classList.add('input-error');
      errorEl.textContent = 'کد ساختمان اشتباه است یا ساختمانی ثبت نشده. دوباره چک کنید.';
      errorEl.classList.add('show');
      return;
    }
  }

  _residentResolvedPhone = managerPhone || (localStorage.getItem('ham_sakhteman_user_phone') || '').replace(/\D/g, '') || null;

  const data = loadData();
  if (!data || !data.building) {
    input.classList.add('input-error');
    errorEl.textContent = 'هیچ ساختمانی ثبت نشده است. با مدیر تماس بگیرید.';
    errorEl.classList.add('show');
    return;
  }

  const savedCode = (data.building.code || '').toUpperCase();
  if (code !== savedCode) {
    input.classList.add('input-error');
    errorEl.textContent = 'کد ساختمان اشتباه است. دوباره چک کنید.';
    errorEl.classList.add('show');
    return;
  }

  tempBuildingCode = code;
  showResidentToast('کد ساختمان تأیید شد ✅', 'success');
  goToStep2();
}

/* ============ مرحله ۲: انتخاب واحد ============ */
function goToStep2() {
  document.getElementById('residentStep1').style.display = 'none';
  document.getElementById('residentStep2').style.display = 'block';

  const data = loadData();
  const building = data?.building;
  if (!building) return;

  const blockGroup = document.getElementById('residentBlockGroup');
  const blockSelect = document.getElementById('residentBlockSelect');
  const unitSelect = document.getElementById('residentUnitSelect');

  blockSelect.innerHTML = '';
  unitSelect.innerHTML = '<option value="">— انتخاب کن —</option>';

  if (building.type === 'complex' && building.blocks) {
    blockGroup.style.display = 'block';
    blockSelect.innerHTML = '<option value="">— بلوک را انتخاب کن —</option>';
    building.blocks.forEach(b => {
      const opt = document.createElement('option');
      opt.value = b.name;
      opt.textContent = b.name;
      blockSelect.appendChild(opt);
    });
  } else {
    blockGroup.style.display = 'none';
    tempBlock = '—';
    updateUnitOptionsForBlock('—');
  }
}

function updateUnitOptionsForBlock(blockName) {
  const unitSelect = document.getElementById('residentUnitSelect');
  const data = loadData();
  const building = data?.building;
  const existingUnits = loadUnits();
  const registered = loadRegisteredResidents();

  // حداکثر تعداد واحد این بلوک / ساختمان از تعریف ثبت‌نام مدیر
  let maxUnits = 0;
  if (building?.type === 'complex' && Array.isArray(building.blocks)) {
    const blk = building.blocks.find(b => String(b.name).trim() === String(blockName).trim());
    maxUnits = blk ? (parseInt(blk.units) || 0) : 0;
  } else {
    maxUnits = parseInt(building?.totalUnits) || 0;
  }

  // اگر هنوز تعریف نشده، از واحدهای موجود کمک بگیر
  if (maxUnits < 1) {
    const filtered = existingUnits.filter(u => {
      if (blockName === '—' || !blockName) return u.block === '—' || !u.block;
      return String(u.block).trim() === String(blockName).trim();
    });
    maxUnits = filtered.reduce((m, u) => Math.max(m, parseInt(u.number) || 0), 0);
  }

  if (maxUnits < 1) {
    unitSelect.innerHTML = '<option value="">— واحدی تعریف نشده —</option>';
    return;
  }

  unitSelect.innerHTML = '<option value="">— انتخاب کن —</option>';
  for (let n = 1; n <= maxUnits; n++) {
    // واحدهایی که قبلاً توسط ساکن ثبت‌نام شده‌اند را غیرفعال نشان بده
    const already = registered.find(r =>
      r.buildingCode === tempBuildingCode &&
      String(r.block).trim() === String(blockName).trim() &&
      Number(r.unitNumber) === n
    );
    const opt = document.createElement('option');
    opt.value = n;
    opt.textContent = already
      ? ('واحد ' + toPersianNumR(n) + ' (ثبت‌نام شده)')
      : ('واحد ' + toPersianNumR(n));
    if (already) opt.disabled = true;
    unitSelect.appendChild(opt);
  }
}

function verifyUnit() {
  const blockSelect = document.getElementById('residentBlockSelect');
  const unitSelect = document.getElementById('residentUnitSelect');
  const errorEl = document.getElementById('residentUnitError');

  errorEl.classList.remove('show');

  const data = loadData();
  const building = data?.building;

  let blockName = '—';
  if (building?.type === 'complex') {
    blockName = blockSelect.value;
    if (!blockName) {
      errorEl.textContent = 'لطفاً بلوک را انتخاب کنید.';
      errorEl.classList.add('show');
      return;
    }
  }

  const unitNumber = parseInt(unitSelect.value);
  if (!unitNumber) {
    errorEl.textContent = 'لطفاً شماره واحد را انتخاب کنید.';
    errorEl.classList.add('show');
    return;
  }

  // چک کن این واحد قبلاً ثبت‌نام نکرده باشه
  // ✅ اصلاح: مالک و مستاجر هر دو می‌توانند برای یک واحد ثبت‌نام کنند؛
  // تکراری بودن نقش در مرحله بعد (بعد از انتخاب نقش) بررسی می‌شود.
  const registered = loadRegisteredResidents();
  const sameUnit = registered.filter(r =>
    String(r.buildingCode).toUpperCase() === String(tempBuildingCode).toUpperCase() &&
    String(r.block).trim() === String(blockName).trim() &&
    Number(r.unitNumber) === unitNumber &&
    r.status !== 'rejected'
  );

  if (sameUnit.length >= 2) {
    errorEl.textContent = 'مالک و مستاجر این واحد قبلاً ثبت‌نام کرده‌اند. اگر قبلاً ثبت‌نام کرده‌اید از «ورود» استفاده کنید.';
    errorEl.classList.add('show');
    return;
  }

  tempBlock = blockName;
  tempUnitNumber = unitNumber;

  showResidentToast('واحد انتخاب شد ✅', 'success');
  goToStep3();
}

function goToStep3() {
  document.getElementById('residentStep2').style.display = 'none';
  document.getElementById('residentStep3').style.display = 'block';
}


/** ذخیره/به‌روزرسانی واحد در پنل مدیر وقتی ساکن ثبت‌نام می‌کند */
function syncUnitToManagerPanel(resident, opts) {
  if (!resident) return;
  const silent = !!(opts && opts.silent);

  // اطمینان از داشتن شماره مدیر برای کلید scoped
  if (!_residentResolvedPhone && resident.buildingCode) {
    _residentResolvedPhone = _findManagerPhoneByBuildingCode(resident.buildingCode);
  }

  const unitsKey = _getScopedKey('ham_sakhteman_units');
  let units = [];
  try {
    const raw = localStorage.getItem(unitsKey);
    if (raw) units = JSON.parse(raw) || [];
    if (!Array.isArray(units)) units = [];
  } catch (e) {
    units = [];
  }

  // فقط از کلید scoped بخوان — کلید قدیمی بدون scope را قاطی نکن
  // (قبلاً باعث می‌شد همه واحدهای قدیمی یکجا لود شوند)

  // اگر شماره واحد نیامده (نشست‌های قدیمی)، از ثبت‌نام خود ساکن پیدا کن
  if (!(parseInt(resident.unitNumber, 10) >= 1)) {
    const code = String(resident.buildingCode || '').toUpperCase();
    const ph = normalizePhoneR(resident.phone || '');
    const reg = loadRegisteredResidents().find(r => r && String(r.buildingCode || '').toUpperCase() === code &&
      (normalizePhoneR(r.phone || '') === ph || (resident.id && r.id === resident.id)));
    if (reg) { resident = Object.assign({}, resident, { unitNumber: reg.unitNumber, block: resident.block || reg.block }); }
  }
  const block = String(resident.block || '—').trim() || '—';
  const number = parseInt(resident.unitNumber, 10);
  if (!number || number < 1) {
    console.warn('syncUnitToManagerPanel: invalid unit number', resident);
    return;
  }

  let unit = units.find(u =>
    String(u.block || '').trim() === block && Number(u.number) === number
  );

  const isApproved = resident.status === 'approved';
  const person = {
    name: resident.name || null,
    phone: resident.phone || null,
    birthDate: null,
    nationalId: null,
    type: 'settled',
    registered: true,
    approved: isApproved,
  };

  if (!unit) {
    const newId = Math.max(units.length > 0
      ? Math.max(...units.map(u => Number(u.id) || 0)) + 1
      : 1, Date.now());
    unit = {
      id: newId,
      block: block,
      number: number,
      code: (block === '—' ? 'S' : block) + '-' + toPersianNumR(number),
      floor: '',
      area: 0,
      peopleCount: 1,
      parkingCount: 0,
      storageCount: 0,
      status: 'occupied',
      owner: { name: null, phone: null, birthDate: null, nationalId: null, type: 'settled', registered: false, approved: false },
      tenant: { name: null, phone: null, birthDate: null, nationalId: null, type: 'settled', registered: false, approved: false },
      defaultChargeOwner: 0,
      defaultChargeTenant: 0,
      chargeAmount: 0,
      debt: null,
      notes: '',
      createdAt: new Date().toISOString(),
      source: 'resident_register',
    };
    units.push(unit);
  }

  // نقش ساکن را در واحد بنویس
  const role = (resident.role || 'owner').toLowerCase();
  // اطلاعات تکمیلی قبلی (تاریخ تولد، کد ملی و…) پاک نشود
  const mergePerson = (prev) => {
    const out = Object.assign({}, prev || {});
    Object.keys(person).forEach(k => { if (person[k] != null || out[k] === undefined) out[k] = person[k]; });
    if (resident.extra && typeof resident.extra === 'object') Object.assign(out, resident.extra);
    return out;
  };
  if (role === 'tenant' || role === 'مستاجر' || role === 'ساکن') {
    const samePerson = !unit.tenant?.phone || unit.tenant.phone === person.phone;
    unit.tenant = samePerson ? mergePerson(unit.tenant) : mergePerson(null);
    // نام مالکی که مستاجر وارد کرده (اگر مالک هنوز ثبت‌نام نکرده)
    if (resident.ownerName && !unit.owner?.registered) {
      unit.owner = Object.assign({ phone: null, birthDate: null, nationalId: null, type: 'settled', registered: false, approved: false }, unit.owner || {}, { name: resident.ownerName });
    }
    unit.status = 'occupied';
  } else {
    const samePerson = !unit.owner?.phone || unit.owner.phone === person.phone;
    unit.owner = samePerson ? mergePerson(unit.owner) : mergePerson(null);
    unit.status = 'occupied';
  }

  unit.updatedAt = new Date().toISOString();
  if (resident.peopleCount) {
    unit.peopleCount = Math.max(1, parseInt(resident.peopleCount, 10) || 1);
  } else {
    unit.peopleCount = Math.max(Number(unit.peopleCount) || 0, 1);
  }

  try {
    localStorage.setItem(unitsKey, JSON.stringify(units));
  } catch (e) {
    console.error('syncUnitToManagerPanel failed', e);
  }

  // اعلان برای مدیر (فقط در ثبت‌نام جدید، نه هر بار ذخیره پروفایل)
  if (!silent) try {
    const notifKey = _residentResolvedPhone
      ? ('ham_sakhteman_notifications_' + _residentResolvedPhone)
      : 'ham_sakhteman_notifications';
    let notifs = [];
    try {
      const rawN = localStorage.getItem(notifKey);
      if (rawN) notifs = JSON.parse(rawN) || [];
      if (!Array.isArray(notifs)) notifs = [];
    } catch (e) { notifs = []; }

    const unitLabel = block && block !== '—'
      ? (block + ' - واحد ' + toPersianNumR(number))
      : ('واحد ' + toPersianNumR(number));
    const roleLabel = (role === 'tenant' || role === 'مستاجر' || role === 'ساکن') ? 'مستاجر' : 'مالک';

    notifs.unshift({
      id: Date.now(),
      type: 'resident_register',
      title: 'ثبت‌نام ساکن جدید',
      message: roleLabel + ' «' + (resident.name || '') + '» برای ' + unitLabel + ' ثبت‌نام کرد. شماره: ' + (resident.phone || '—'),
      createdAt: new Date().toISOString(),
      read: false,
    });
    // حداکثر ۵۰ اعلان
    if (notifs.length > 50) notifs = notifs.slice(0, 50);
    localStorage.setItem(notifKey, JSON.stringify(notifs));
  } catch (e) {
    console.warn('notification for manager failed', e);
  }
}


/* ============ مرحله ۳: ثبت‌نام ============ */
function registerResident() {
  const nameInput = document.getElementById('residentName');
  const phoneInput = document.getElementById('residentPhone');
  const roleInput = document.getElementById('residentRole');
  const passInput = document.getElementById('residentPassword');
  const passConfirmInput = document.getElementById('residentPasswordConfirm');

  const nameError = document.getElementById('residentNameError');
  const phoneError = document.getElementById('residentPhoneError');
  const passError = document.getElementById('residentPasswordError');
  const passConfirmError = document.getElementById('residentPasswordConfirmError');

  [nameInput, phoneInput, passInput, passConfirmInput].forEach(i => i.classList.remove('input-error'));
  [nameError, phoneError, passError, passConfirmError].forEach(e => e.classList.remove('show'));

  const name = nameInput.value.trim();
  const phone = phoneInput.value.trim();
  const role = roleInput.value;
  const peopleCount = parseInt(document.getElementById('residentPeopleCount')?.value, 10) || 1;
  const password = passInput.value;
  const passConfirm = passConfirmInput.value;

  // اعتبارسنجی
  if (!name) {
    nameInput.classList.add('input-error');
    nameError.textContent = 'لطفاً نام و نام خانوادگی را وارد کنید.';
    nameError.classList.add('show');
    return;
  }

  if (name.length < 3) {
    nameInput.classList.add('input-error');
    nameError.textContent = 'نام باید حداقل ۳ کاراکتر باشد.';
    nameError.classList.add('show');
    return;
  }

  if (!phone || !isValidIranMobileR(phone)) {
    phoneInput.classList.add('input-error');
    phoneError.textContent = 'شماره موبایل باید ۱۱ رقم و با ۰۹ شروع شود.';
    phoneError.classList.add('show');
    return;
  }

  if (!password || password.length < 6) {
    passInput.classList.add('input-error');
    passError.textContent = 'رمز عبور باید حداقل ۶ کاراکتر باشد.';
    passError.classList.add('show');
    return;
  }

  if (password !== passConfirm) {
    passConfirmInput.classList.add('input-error');
    passConfirmError.textContent = 'رمز عبور و تکرار آن یکسان نیستند.';
    passConfirmError.classList.add('show');
    return;
  }

  // مستاجر باید نام مالک را وارد کند
  let ownerName = '';
  if (role === 'tenant') {
    const oIn = document.getElementById('residentOwnerName');
    const oErr = document.getElementById('residentOwnerNameError');
    ownerName = (oIn?.value || '').trim();
    oIn?.classList.remove('input-error'); oErr?.classList.remove('show');
    if (ownerName.length < 3) {
      oIn?.classList.add('input-error');
      if (oErr) { oErr.textContent = 'نام مالک واحد را وارد کنید (حداقل ۳ حرف).'; oErr.classList.add('show'); }
      return;
    }
  }

  // ذخیره ثبت‌نام
  const registered = loadRegisteredResidents();
  const isTenantRole = (x) => ['tenant', 'مستاجر', 'ساکن'].includes(String(x || '').toLowerCase());
  const dupRole = registered.find(r =>
    String(r.buildingCode).toUpperCase() === String(tempBuildingCode).toUpperCase() &&
    String(r.block).trim() === String(tempBlock).trim() &&
    Number(r.unitNumber) === Number(tempUnitNumber) &&
    r.status !== 'rejected' &&
    isTenantRole(r.role) === isTenantRole(role)
  );
  if (dupRole) {
    phoneInput.classList.add('input-error');
    phoneError.textContent = `برای این واحد قبلاً «${isTenantRole(role) ? 'مستاجر' : 'مالک'}» ثبت‌نام کرده است. اگر خودتان هستید از «ورود» استفاده کنید.`;
    phoneError.classList.add('show');
    return;
  }

  // شناسه یکتا بین دستگاه‌ها (دو ساکن هم‌زمان از دو گوشی ثبت‌نام کنند)
  const newId = Math.max(registered.length > 0 ? Math.max(...registered.map(r => r.id || 0)) + 1 : 1, Date.now());

  const newResident = {
    id: newId,
    buildingCode: tempBuildingCode,
    block: tempBlock,
    unitNumber: tempUnitNumber,
    name: name,
    phone: normalizePhoneR(phone),
    role: role,
    ownerName: ownerName || null,
    peopleCount: peopleCount,
    passwordHash: hashResidentPassword(password),
    registeredAt: new Date().toISOString(),
    status: 'pending', // در انتظار تأیید مدیر
  };

  registered.push(newResident);
  saveRegisteredResidents(registered);

  // نمایش خودکار در پنل مدیر (نام، شماره، بلوک/واحد)
  syncUnitToManagerPanel(newResident);

  // نشست
  setResidentSession({
    residentId: newId,
    buildingCode: tempBuildingCode,
    block: tempBlock,
    unitNumber: tempUnitNumber,
    name: name,
    phone: normalizePhoneR(phone),
    role: role,
    managerPhone: _residentResolvedPhone || null,
  });

  showResidentToast('ثبت‌نام با موفقیت انجام شد 🎉', 'success');
  setTimeout(() => openResidentPanel(), 800);
}

/* ============ پنل ساکن ============ */
function openResidentPanel() {
  const session = getResidentSession();
  if (!session) {
    document.getElementById('residentLoginPage').style.display = 'flex';
    document.getElementById('residentPanel').style.display = 'none';
    return;
  }

  document.getElementById('residentLoginPage').style.display = 'none';
  document.getElementById('residentPanel').style.display = 'flex';

  renderResidentHeader();
  renderResidentDashboard();
  switchResidentPage('dashboard');
}

function renderResidentHeader() {
  const session = getResidentSession();
  if (!session) return;

  const unitLabel = session.block && session.block !== '—'
    ? `${session.block} - واحد ${toPersianNumR(session.unitNumber)}`
    : `واحد ${toPersianNumR(session.unitNumber)}`;

  document.getElementById('residentHeaderName').textContent = session.name;
  document.getElementById('residentHeaderUnit').textContent = unitLabel;
}

function renderResidentDashboard() {
  const session = getResidentSession();
  if (!session) return;

  const charges = loadCharges();
  const notices = getMyNotices();
  const messages = loadMessages();

  // ✅ اصلاح: مثل صفحه شارژها، بر اساس شناسه واحد (قبلاً بلوک + شماره و گاهی ناهمخوان)
  const myUnitId = getUnitIdBySession();
  const unitCharges = myUnitId == null ? [] : charges
    .filter(c => Number(c.unitId) === Number(myUnitId))
    .sort((a, b) => (a.issuedAt || '').localeCompare(b.issuedAt || ''));

  const unpaid = unitCharges.filter(c => !c.paid);
  const paid = unitCharges.filter(c => c.paid);
  const totalDebt = unpaid.reduce((s, c) => s + (Number(c.total) || 0), 0);

  document.getElementById('residentStatDebt').textContent = formatTomanR(totalDebt);
  document.getElementById('residentStatPaid').textContent = formatNumberR(paid.length);
  const myMessages = messages.filter(m =>
    String(m.unitId) !== 'undefined' &&
    Number(m.unitId) === Number(getUnitIdBySession())
  );
  document.getElementById('residentStatMessages').textContent = formatNumberR(myMessages.length);
  document.getElementById('residentStatNotices').textContent = formatNumberR(notices.length);

  const reg = loadRegisteredResidents().find(r => Number(r.id) === Number(session.residentId));
  const pendingNote = reg && reg.status === 'pending' ? ' (ثبت‌نام شما در انتظار تأیید مدیر است)' : '';
  document.getElementById('residentWelcomeText').textContent =
    `به اپلیکیشن آپارتمان پلاس خوش آمدید، ${session.name}. می‌تونی شارژها، اطلاعیه‌ها، پیام‌ها و رأی‌گیری‌ها رو از اینجا ببینی.${pendingNote}`;

  // آخرین شارژ
  const lastChargeBox = document.getElementById('residentLastCharge');
  if (unitCharges.length === 0) {
    lastChargeBox.innerHTML = '<p style="text-align:center; color:#94a3b8; padding:20px;">هنوز شارژی صادر نشده</p>';
  } else {
    const last = unitCharges[unitCharges.length - 1];
    const status = last.paid
      ? '<span style="color:#16a34a; font-weight:800;">✅ پرداخت شده</span>'
      : last.pendingApproval
        ? '<span style="color:#f59e0b; font-weight:800;">⏳ در انتظار تأیید مدیر</span>'
        : '<span style="color:#dc2626; font-weight:800;">⚠️ پرداخت نشده</span>';

    lastChargeBox.innerHTML = `
      <div style="display:flex; justify-content:space-between; padding:10px 0; border-bottom:1px solid #f1f5f9;">
        <span style="color:#64748b;">دوره</span>
        <strong>${last.month} ${toPersianNumR(last.year)}</strong>
      </div>
      <div style="display:flex; justify-content:space-between; padding:10px 0; border-bottom:1px solid #f1f5f9;">
        <span style="color:#64748b;">مبلغ</span>
        <strong>${formatTomanR(last.total)}</strong>
      </div>
      <div style="display:flex; justify-content:space-between; padding:10px 0;">
        <span style="color:#64748b;">وضعیت</span>
        <strong>${status}</strong>
      </div>
    `;
  }
}
function getUnitIdBySession() {
  const session = getResidentSession();
  if (!session) return null;

  const units = loadUnits();
  const userUnit = units.find(u => {
    if (session.block === '—' || !session.block) {
      return (u.block === '—' || !u.block) && Number(u.number) === Number(session.unitNumber);
    }
    return String(u.block).trim() === String(session.block).trim()
        && Number(u.number) === Number(session.unitNumber);
  });

  return userUnit ? userUnit.id : null;
}

function getUnitNumberById(unitId) {
  const units = loadUnits();
  const unit = units.find(u => u.id === unitId);
  return unit ? unit.number : 0;
}

function switchResidentPage(pageKey) {
  document.querySelectorAll('.resident-page').forEach(p => {
    p.classList.toggle('active', p.id === `resident-${pageKey}`);
  });

  document.querySelectorAll('.resident-nav-item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.residentPage === pageKey);
  });

  if (pageKey === 'dashboard') renderResidentDashboard();
  if (pageKey === 'charges') renderResidentCharges();
  if (pageKey === 'notices') renderResidentNotices();
  if (pageKey === 'messages') {
    const uid = getUnitIdBySession();
    if (uid) openResidentChatDirect(uid);
    else renderResidentMessages();
  }
  if (pageKey === 'voting') renderResidentVoting();
  if (pageKey === 'profile') renderResidentProfile();
}

function renderResidentCharges() {
  try { renderResidentPeersPayments(); } catch (e) { console.warn('peers', e); }
  const session = getResidentSession();
  const container = document.getElementById('residentChargesList');
  if (!session || !container) return;

  const charges = loadCharges();
  const units = loadUnits();

  const userUnit = units.find(u => {
    if (session.block === '—' || !session.block) {
      return (u.block === '—' || !u.block) && Number(u.number) === Number(session.unitNumber);
    }
    return String(u.block).trim() === String(session.block).trim()
        && Number(u.number) === Number(session.unitNumber);
  });

  if (!userUnit) {
    container.innerHTML = '<p style="text-align:center; color:#94a3b8; padding:40px;">واحد شما یافت نشد</p>';
    return;
  }

  const myCharges = charges.filter(c => Number(c.unitId) === Number(userUnit.id));

  if (myCharges.length === 0) {
    container.innerHTML = '<p style="text-align:center; color:#94a3b8; padding:40px;">هنوز شارژی صادر نشده</p>';
    return;
  }

  // مرتب‌سازی: جدیدترین اول
  const sorted = [...myCharges].sort((a, b) =>
    (b.issuedAt || '').localeCompare(a.issuedAt || '')
  );

  container.innerHTML = sorted.map(c => {
      let status = '';
    let payButton = '';
    let extraInfo = '';

    if (c.paid) {
      // پرداخت شده / تأیید شده
      status = '<span style="color:#16a34a; font-weight:800;">✅ پرداخت تأیید شد</span>';
      extraInfo = `
        <div style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid #f1f5f9;">
          <span style="color:#64748b;">تاریخ پرداخت</span>
          <strong>${c.paidDate || '—'}</strong>
        </div>
        <div style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid #f1f5f9;">
          <span style="color:#64748b;">روش پرداخت</span>
          <strong>${c.payMethod || '—'}</strong>
        </div>
        ${c.trackingCode ? `<div style="display:flex; justify-content:space-between; padding:8px 0;"><span style="color:#64748b;">شماره پیگیری</span><strong dir="ltr">${escapeHtmlR(c.trackingCode)}</strong></div>` : ''}
      `;
    } else if (c.pendingApproval) {
      // در انتظار تأیید مدیر
      status = '<span style="color:#f59e0b; font-weight:800;">⏳ در انتظار تأیید مدیر</span>';
      extraInfo = `
        <div style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid #f1f5f9;">
          <span style="color:#64748b;">روش پرداخت</span>
          <strong>${c.payMethod || '—'}</strong>
        </div>
        <div style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid #f1f5f9;">
          <span style="color:#64748b;">شماره پیگیری</span>
          <strong dir="ltr">${escapeHtmlR(c.trackingCode || '—')}</strong>
        </div>
        <div style="display:flex; justify-content:space-between; padding:8px 0;">
          <span style="color:#64748b;">تاریخ واریز</span>
          <strong>${(c.receipt && c.receipt.date) || (c.pendingAt ? new Date(c.pendingAt).toLocaleDateString('fa-IR') : '—')}${c.receiptImage ? ' · 📷 رسید' : ''}</strong>
        </div>
      `;
    } else {
      // پرداخت نشده
      status = '<span style="color:#dc2626; font-weight:800;">⚠️ پرداخت نشده</span>';
      if (c.rejectedAt) {
        extraInfo = `
        <div style="background:#fef2f2;border:1px solid #fecaca;color:#b91c1c;border-radius:10px;padding:8px 10px;margin:8px 0;font-size:12.5px;">
          ✖ اعلام پرداخت قبلی شما رد شد: ${escapeHtmlR(c.rejectReason || '—')}
          ${c.lastRejectedTracking ? `<div dir="ltr" style="text-align:right;color:#991b1b;">${escapeHtmlR(c.lastRejectedTracking)}</div>` : ''}
        </div>`;
      }
      if (c.dueDate) {
        extraInfo += `
        <div style="display:flex; justify-content:space-between; padding:8px 0;">
          <span style="color:#64748b;">مهلت پرداخت</span>
          <strong>${escapeHtmlR(c.dueDate)}</strong>
        </div>`;
      }
      payButton = `<button class="resident-pay-btn" data-pay-charge-id="${c.id}">🧾 اعلام واریز</button>`;
    }

      return `
      <div class="resident-card">
        <div style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid #f1f5f9;">
          <span style="color:#64748b;">دوره</span>
          <strong>${c.month} ${toPersianNumR(c.year)}</strong>
        </div>
        <div style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid #f1f5f9;">
          <span style="color:#64748b;">مبلغ</span>
          <strong>${formatTomanR(c.total)}</strong>
        </div>
        <div style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid #f1f5f9;">
          <span style="color:#64748b;">وضعیت</span>
          <strong>${status}</strong>
        </div>
        ${extraInfo}
        ${payButton}
      </div>
    `;
  }).join('');

  // بایند دکمه‌های پرداخت
  container.querySelectorAll('[data-pay-charge-id]').forEach(btn => {
    btn.addEventListener('click', () => {
      const chargeId = Number(btn.dataset.payChargeId);
      openResidentPayModal(chargeId);
    });
  });
}
/**
 * 📋 وضعیت پرداخت سایر ساکنین (شفافیت)
 * مجتمع: فقط واحدهای بلوک خود ساکن — ساختمان/برج: همه واحدها
 * شماره موبایل کسی نمایش داده نمی‌شود.
 */
function renderResidentPeersPayments() {
  const box = document.getElementById('residentPeersBox');
  const session = getResidentSession();
  if (!box || !session) return;
  const building = loadData()?.building || {};
  const isComplex = building.type === 'complex';
  const myBlock = String(session.block || '—').trim() || '—';
  const units = loadUnits().filter(u => !isComplex || String(u.block || '—').trim() === myBlock);
  const charges = loadCharges();
  if (!units.length) { box.innerHTML = ''; return; }

  const rows = units.map(u => {
    const mine = charges.filter(c => Number(c.unitId) === Number(u.id));
    const paid = mine.filter(c => c.paid).reduce((s, c) => s + (Number(c.paidAmount) || Number(c.total) || 0), 0);
    const debt = mine.filter(c => !c.paid).reduce((s, c) => s + (Number(c.total) || 0), 0);
    const pending = mine.some(c => !c.paid && c.pendingApproval);
    const lastPaid = mine.filter(c => c.paid).map(c => c.paidDate || '').sort().pop() || '';
    const who = u.tenant?.name || u.owner?.name || '—';
    const label = (u.block && u.block !== '—') ? `${u.block}-${toPersianNumR(u.number)}` : `واحد ${toPersianNumR(u.number)}`;
    const isMe = String(u.block || '—').trim() === myBlock && Number(u.number) === Number(session.unitNumber);
    return { u, paid, debt, pending, lastPaid, who, label, isMe };
  }).sort((a, b) => (b.debt - a.debt) || ((Number(a.u.number) || 0) - (Number(b.u.number) || 0)));

  const debtors = rows.filter(r => r.debt > 0).length;
  const totalPaid = rows.reduce((s, r) => s + r.paid, 0);
  const totalDebt = rows.reduce((s, r) => s + r.debt, 0);
  const scope = isComplex ? `بلوک ${escapeHtmlR(myBlock)}` : 'ساختمان';

  box.innerHTML = `
    <div class="resident-card" style="margin-top:18px;">
      <div class="resident-card-header"><h3>📋 وضعیت پرداخت ساکنین ${scope}</h3></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin:6px 0 12px;">
        <div style="flex:1;min-width:110px;background:#f0fdf4;border-radius:10px;padding:8px 10px;"><small style="color:#64748b;">مجموع واریزی</small><div style="font-weight:800;color:#15803d;">${formatTomanR(totalPaid)}</div></div>
        <div style="flex:1;min-width:110px;background:#fef2f2;border-radius:10px;padding:8px 10px;"><small style="color:#64748b;">مجموع بدهی</small><div style="font-weight:800;color:#b91c1c;">${formatTomanR(totalDebt)}</div></div>
        <div style="flex:1;min-width:80px;background:#f8fafc;border-radius:10px;padding:8px 10px;"><small style="color:#64748b;">بدهکاران</small><div style="font-weight:800;">${formatNumberR(debtors)} واحد</div></div>
      </div>
      <div style="overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <thead><tr style="background:#f5f3ff;color:#5b21b6;">
            <th style="padding:8px;text-align:right;">واحد</th>
            <th style="padding:8px;text-align:right;">ساکن</th>
            <th style="padding:8px;text-align:right;">واریزی</th>
            <th style="padding:8px;text-align:right;">بدهی</th>
          </tr></thead>
          <tbody>${rows.map(r => `
            <tr style="border-bottom:1px solid #f1f5f9;${r.isMe ? 'background:#faf5ff;' : ''}">
              <td style="padding:8px;white-space:nowrap;">${escapeHtmlR(r.label)}${r.isMe ? ' <small style="color:#7c3aed;">(شما)</small>' : ''}</td>
              <td style="padding:8px;">${escapeHtmlR(r.who)}</td>
              <td style="padding:8px;color:#15803d;white-space:nowrap;">${r.paid ? formatTomanR(r.paid) : '—'}${r.lastPaid ? `<div style="color:#94a3b8;font-size:11px;">${escapeHtmlR(r.lastPaid)}</div>` : ''}</td>
              <td style="padding:8px;white-space:nowrap;${r.debt ? 'color:#b91c1c;font-weight:700;' : 'color:#16a34a;'}">${r.debt ? formatTomanR(r.debt) : '✅ تسویه'}${r.pending ? '<div style="color:#d97706;font-size:11px;">⏳ در انتظار تأیید</div>' : ''}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
}
function renderResidentNotices() {
  const container = document.getElementById('residentNoticesList');
  if (!container) return;

  // ✅ اصلاح: فقط اطلاعیه‌های «همه»، بلوک خودم یا واحد خودم (قبلاً همه اطلاعیه‌های خصوصی هم نمایش داده می‌شد)
  const notices = getMyNotices();

  if (notices.length === 0) {
    container.innerHTML = '<p style="text-align:center; color:#94a3b8; padding:40px;">هنوز اطلاعیه‌ای ثبت نشده</p>';
    return;
  }

  container.innerHTML = [...notices].reverse().map(n => `
    <div class="resident-card">
      <div style="display:flex; justify-content:space-between; align-items:start; margin-bottom:8px;">
        <h3 style="font-size:15px; font-weight:800;">${escapeHtmlR(n.title)}</h3>
        <span style="font-size:11.5px; color:#94a3b8;">${escapeHtmlR(n.date || '')}</span>
      </div>
      ${n.image && /^data:image\//.test(n.image) ? `<img src="${n.image}" alt="" style="max-width:100%;border-radius:10px;margin-bottom:8px;" />` : ''}
      <p style="font-size:13.5px; color:#64748b; line-height:1.8; white-space:pre-line;">${escapeHtmlR(n.body)}</p>
    </div>
  `).join('');
}

/* ============ پیام‌ها (چت) ============ */
let residentCurrentChatUnitId = null;
let residentChatInterval = null;

function renderResidentMessages() {
  const container = document.getElementById('residentConversationsList');
  if (!container) return;

  const session = getResidentSession();
  if (!session) return;

  const myUnitId = getUnitIdBySession();
  if (!myUnitId) {
    container.innerHTML = '<p style="text-align:center; color:#94a3b8; padding:40px;">واحد شما یافت نشد</p>';
    return;
  }

  const allMessages = loadMessages().filter(m =>
    Number(m.unitId) === Number(myUnitId)
  );

  if (allMessages.length === 0) {
    container.innerHTML = `
      <div class="resident-card" style="text-align:center; padding: 40px 20px;">
        <div style="font-size: 56px; margin-bottom: 12px;">💬</div>
        <h3 style="font-size: 16px; font-weight: 800; margin-bottom: 8px;">هنوز پیامی نداری</h3>
        <p style="color:#64748b; font-size:13.5px; margin-bottom: 16px;">
          اولین پیام رو به مدیر ساختمان بفرست
        </p>
        <button class="resident-submit-btn" id="residentFirstChatBtn" style="max-width: 240px; margin: 0 auto;">
          ➕ شروع گفتگو
        </button>
      </div>
    `;

    document.getElementById('residentFirstChatBtn')?.addEventListener('click', () => {
      openResidentChat(myUnitId);
    });

    return;
  }

  // گروه‌بندی بر اساس موضوع (subject)
  const groups = {};
  allMessages.forEach(m => {
    const key = m.subject || 'بدون موضوع';
    if (!groups[key]) {
      groups[key] = {
        subject: key,
        messages: [],
        lastMessage: null,
        unread: 0,
      };
    }
    groups[key].messages.push(m);

    if (m.direction === 'sent' && !m.read) {
      groups[key].unread++;
    }
  });

  Object.values(groups).forEach(g => {
    g.messages.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
    g.lastMessage = g.messages[g.messages.length - 1];
  });

  const convList = Object.values(groups).sort((a, b) =>
    (b.lastMessage?.createdAt || '').localeCompare(a.lastMessage?.createdAt || '')
  );

  container.innerHTML = convList.map(g => {
    const lm = g.lastMessage;
    const isFromMe = lm.direction === 'received';
    const preview = (lm.body || '').substring(0, 50) + ((lm.body || '').length > 50 ? '...' : '');

    return `
      <div class="resident-conv-item" data-subject="${g.subject.replace(/"/g, '&quot;')}">
        <div class="resident-conv-avatar">👨‍💼</div>
        <div class="resident-conv-body">
          <div class="resident-conv-top">
            <strong class="resident-conv-title">${g.subject}</strong>
            <span class="resident-conv-time">${lm.date || ''}</span>
          </div>
          <div class="resident-conv-preview">
            ${isFromMe ? '👤 شما: ' : ''}${preview || '—'}
          </div>
        </div>
        ${g.unread > 0 ? `<span class="resident-conv-badge">${formatNumberR(g.unread)}</span>` : ''}
      </div>
    `;
  }).join('');

  container.querySelectorAll('.resident-conv-item').forEach(item => {
    item.addEventListener('click', () => {
      const subject = item.dataset.subject;
      openResidentChat(myUnitId, subject);
    });
  });
}

function openResidentChat(unitId, subject = null) {
  openResidentChatDirect(unitId, subject);
}

function openResidentChatDirect(unitId, subject = null) {
  residentCurrentChatUnitId = unitId;

  // صفحه پیام‌ها همان چت مستقیم است
  document.querySelectorAll('.resident-page').forEach(p => p.classList.remove('active'));
  const page = document.getElementById('resident-messages');
  if (page) page.classList.add('active');

  document.querySelectorAll('.resident-nav-item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.residentPage === 'messages');
  });

  renderResidentChatMessages(subject);

  const input = document.getElementById('residentChatInput');
  if (input) {
    input.value = '';
    setTimeout(() => input.focus(), 200);
  }

  if (residentChatInterval) clearInterval(residentChatInterval);
  residentChatInterval = setInterval(() => {
    renderResidentChatMessages(subject);
  }, 3000);
}

/** رندر پیام‌های چت ساکن با مدیر */
function renderResidentChatMessages(subject = null) {
  const container = document.getElementById('residentChatMessages');
  if (!container) return;

  const session = getResidentSession();
  const myUnitId = getUnitIdBySession() || residentCurrentChatUnitId;
  if (!session || !myUnitId) {
    container.innerHTML = '<p style="text-align:center;color:#94a3b8;padding:40px;">واحد شما یافت نشد</p>';
    return;
  }

  let msgs = (loadMessages() || []).filter(m => Number(m.unitId) === Number(myUnitId));
  if (subject) {
    msgs = msgs.filter(m => (m.subject || 'بدون موضوع') === subject);
  }
  msgs.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));

  if (msgs.length === 0) {
    container.innerHTML = `
      <div style="text-align:center;color:#94a3b8;padding:40px 16px;">
        <div style="font-size:48px;margin-bottom:8px;">💬</div>
        <p>هنوز پیامی رد و بدل نشده. اولین پیام را بنویسید.</p>
      </div>`;
    return;
  }

  // پیام‌های ارسالی مدیر برای ساکن = direction sent (از دید مدیر)
  // پیام ساکن = direction received (از دید مدیر)
  container.innerHTML = msgs.map(m => {
    const fromResident = m.direction === 'received';
    const align = fromResident ? 'flex-end' : 'flex-start';
    const bg = fromResident ? 'linear-gradient(135deg,#5b4cdb,#4338ca)' : '#f1f5f9';
    const color = fromResident ? '#fff' : '#1e293b';
    const who = fromResident ? 'شما' : 'مدیر';
    return `
      <div style="display:flex;justify-content:${align};margin-bottom:10px;">
        <div style="max-width:80%;background:${bg};color:${color};padding:10px 14px;border-radius:14px;font-size:13.5px;line-height:1.7;">
          <div style="font-size:11px;opacity:0.8;margin-bottom:4px;">${who} · ${m.date || ''} ${m.time || ''}</div>
          <div>${(m.body || '').replace(/</g,'&lt;')}</div>
        </div>
      </div>`;
  }).join('');

  // اسکرول به آخر
  container.scrollTop = container.scrollHeight;

  // علامت‌خواندن پیام‌های مدیر
  try {
    const all = loadMessages();
    let changed = false;
    all.forEach(m => {
      if (Number(m.unitId) === Number(myUnitId) && m.direction === 'sent' && !m.read) {
        m.read = true;
        changed = true;
      }
    });
    if (changed) saveMessages(all);
  } catch (e) {}
}

function closeResidentChat() {
  if (residentChatInterval) {
    clearInterval(residentChatInterval);
    residentChatInterval = null;
  }
  residentCurrentChatUnitId = null;

  document.querySelectorAll('.resident-page').forEach(p => p.classList.remove('active'));
  document.getElementById('resident-messages').classList.add('active');
  renderResidentMessages();
}



function sendResidentMessage() {
  const session = getResidentSession();
  if (!session) return;

  const myUnitId = getUnitIdBySession();
  if (!myUnitId) {
    showResidentToast('واحد شما یافت نشد.', 'error');
    return;
  }

  const input = document.getElementById('residentChatInput');
  if (!input) return;

  const body = input.value.trim();
  if (!body) return;

  const units = loadUnits();
  const userUnit = units.find(u => u.id === myUnitId);
  const unitLabel = userUnit
    ? (userUnit.block && userUnit.block !== '—'
        ? `${userUnit.block}-${toPersianNumR(userUnit.number)}`
        : `واحد ${toPersianNumR(userUnit.number)}`)
    : '—';

  const allMessages = loadMessages();
  const newId = Math.max(allMessages.length > 0
    ? Math.max(...allMessages.map(m => m.id || 0)) + 1
    : 1, Date.now());

  const now = new Date();
  const persianDate = now.toLocaleDateString('fa-IR');
  const persianTime = now.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });

allMessages.push({
    id: newId,
    unitId: myUnitId,
    unitLabel: unitLabel,
    ownerName: session.name,
    subject: 'بدون موضوع',
    body: body,
    direction: 'received',
    read: false,
    delivered: false,
    date: persianDate,
    time: persianTime,
    createdAt: now.toISOString(),
  });

  saveMessages(allMessages);

  input.value = '';
  renderResidentMessages();

  // ✅ بعد از ۸۰۰ میلی‌ثانیه، تیک دوم (آبی) اضافه بشه
  setTimeout(() => {
    const msgs = loadMessages();
    const target = msgs.find(x => x.id === newId);
    if (target) {
      target.delivered = true;
      saveMessages(msgs);
      renderResidentMessages();
    }
  }, 800);
}
function bindResidentMessagesPage() {
  document.getElementById('residentChatSendBtn')?.addEventListener('click', sendResidentMessage);

  document.getElementById('residentChatInput')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendResidentMessage();
  });

  // ✅ دکمه برو به آخرین پیام
  document.getElementById('residentScrollBottomBtn')?.addEventListener('click', () => {
    const container = document.getElementById('residentChatMessages');
    if (container) {
           container.scrollTop = container.scrollHeight;
    }
    hideScrollBottomBtn();
    clearUnreadBadge();
  });

  // ✅ نمایش/مخفی کردن دکمه بر اساس موقعیت اسکرول
  const chatContainer = document.getElementById('residentChatMessages');
  if (chatContainer) {
    chatContainer.addEventListener('scroll', () => {
      const threshold = 100;
      const isAtBottom = chatContainer.scrollHeight - chatContainer.scrollTop - chatContainer.clientHeight < threshold;

      if (isAtBottom) {
        hideScrollBottomBtn();
        clearUnreadBadge();
      } else {
        showScrollBottomBtn();
      }
    });
  }
}

function showScrollBottomBtn() {
  const btn = document.getElementById('residentScrollBottomBtn');
  if (btn && !btn.classList.contains('show')) {
    btn.classList.add('show');
  }
}

function hideScrollBottomBtn() {
  const btn = document.getElementById('residentScrollBottomBtn');
  if (btn) {
    btn.classList.remove('show');
  }
}

let residentUnreadCount = 0;

function addUnreadBadge() {
  residentUnreadCount++;
  const btn = document.getElementById('residentScrollBottomBtn');
  if (!btn) return;

  let badge = btn.querySelector('.badge-count');
  if (!badge) {
    badge = document.createElement('span');
    badge.className = 'badge-count';
    btn.appendChild(badge);
  }
  badge.textContent = residentUnreadCount > 9 ? '۹+' : toPersianNumR(residentUnreadCount);
}

function clearUnreadBadge() {
  residentUnreadCount = 0;
  const btn = document.getElementById('residentScrollBottomBtn');
  const badge = btn?.querySelector('.badge-count');
  if (badge) badge.remove();
}
function renderResidentVoting() {
  const container = document.getElementById('residentVotingList');
  if (!container) return;

  const session = getResidentSession();
  if (!session) return;

  const votings = loadVotings() || [];
  const now = new Date();

  const isEnded = (v) => {
    if (v.status === 'ended' || v.status === 'closed') return true;
    if (!v.endDateTime) return false;
    const end = new Date(v.endDateTime);
    return !isNaN(end.getTime()) && now > end;
  };
  const isNotStarted = (v) => {
    if (!v.startDateTime) return false;
    const start = new Date(v.startDateTime);
    return !isNaN(start.getTime()) && now < start;
  };

  // فعال
  const activeVotings = votings.filter(v => !isEnded(v) && !isNotStarted(v));

  // آینده (هنوز شروع نشده)
  const upcomingVotings = votings.filter(v => isNotStarted(v) && !isEnded(v))
    .sort((a, b) => new Date(a.startDateTime || 0) - new Date(b.startDateTime || 0));

  // پایان‌یافته
  const endedVotings = votings.filter(v => isEnded(v))
    .sort((a, b) => new Date(b.endDateTime || 0) - new Date(a.endDateTime || 0));

  if (activeVotings.length === 0 && upcomingVotings.length === 0 && endedVotings.length === 0) {
    container.innerHTML = `
      <div class="resident-card" style="text-align:center; padding:40px 20px;">
        <div style="font-size:56px; margin-bottom:12px;">🗳️</div>
        <h3 style="font-size:16px; font-weight:800; margin-bottom:8px;">رأی‌گیری فعالی وجود ندارد</h3>
        <p style="color:#64748b; font-size:13.5px;">
          وقتی مدیر رأی‌گیری ایجاد کنه، اینجا نمایش داده میشه.
        </p>
      </div>
    `;
    return;
  }

  let html = '';

  // ============ رأی‌گیری‌های فعال ============
  if (activeVotings.length > 0) {
    html += `<div style="margin-bottom:20px;">
      <h3 style="font-size:14px; font-weight:800; color:#16a34a; margin-bottom:12px;">
        🟢 رأی‌گیری‌های فعال (${toPersianNumR(activeVotings.length)})
      </h3>
    `;
    activeVotings.forEach(v => {
      html += renderVotingCard(v, 'active', session);
    });
    html += `</div>`;
  }

  // ============ رأی‌گیری‌های آینده ============
  if (upcomingVotings.length > 0) {
    html += `<div style="margin-bottom:20px;">
      <h3 style="font-size:14px; font-weight:800; color:#d97706; margin-bottom:12px;">
        🟡 رأی‌گیری‌های آینده (${toPersianNumR(upcomingVotings.length)})
      </h3>
    `;
    upcomingVotings.forEach(v => {
      html += renderVotingCard(v, 'upcoming', session);
    });
    html += `</div>`;
  }

  // ============ رأی‌گیری‌های پایان‌یافته ============
  if (endedVotings.length > 0) {
    html += `<div>
      <h3 style="font-size:14px; font-weight:800; color:#64748b; margin-bottom:12px;">
        ⚫ پایان‌یافته (${toPersianNumR(endedVotings.length)})
      </h3>
    `;
    endedVotings.forEach(v => {
      html += renderVotingCard(v, 'ended', session);
    });
    html += `</div>`;
  }

  container.innerHTML = html;
  bindVotingActions();
}

/* ✅ رندر یک کارت رأی‌گیری */
function renderVotingCard(voting, status, session) {
  const candidates = voting.candidates || [];
  const votes = voting.votes || [];
  const totalVotes = votes.length;

  // چک کن ساکن رأی داده یا نه
  const myVote = votes.find(v => 
    v.voterPhone === session.phone ||
    (v.voterUnitId && v.voterUnitId === getUnitIdBySession())
  );
  const hasVoted = !!myVote;

  // اطلاعات زمان
  const startDate = voting.startDate || '—';
  const endDate = voting.endDate || '—';

 let statusBadge = '';
if (status === 'active') {
  statusBadge = '<span class="resident-badge resident-badge-green">🟢 فعال</span>';
} else if (status === 'upcoming') {
  statusBadge = '<span class="resident-badge" style="background:#fef3c7; color:#92400e;">🟡 آینده</span>';
} else {
  statusBadge = '<span class="resident-badge resident-badge-gray">⚫ پایان‌یافته</span>';
}
  let html = `
    <div class="resident-card" style="margin-bottom:12px;">
      <div style="display:flex; justify-content:space-between; align-items:start; margin-bottom:10px; gap:8px;">
        <h3 style="font-size:15px; font-weight:800; flex:1;">${voting.title || '—'}</h3>
        ${statusBadge}
      </div>
      
      ${voting.description ? `<p style="font-size:13px; color:#64748b; margin-bottom:10px; line-height:1.7;">${voting.description}</p>` : ''}
      
      <div style="display:flex; gap:12px; font-size:11.5px; color:#94a3b8; margin-bottom:12px;">
        <span>⏰ از ${startDate}</span>
        <span>تا ${endDate}</span>
      </div>

      <div style="display:flex; justify-content:space-between; padding:8px 0; border-top:1px solid #f1f5f9; margin-bottom:12px;">
        <span style="color:#64748b; font-size:12.5px;">👥 کاندیدها</span>
        <strong style="font-size:13px;">${toPersianNumR(candidates.length)} نفر</strong>
      </div>
  `;

  // ===== اگر رأی داده =====
  if (hasVoted) {
    html += `
      <div style="background:#dcfce7; border-radius:10px; padding:12px; text-align:center; margin-bottom:12px;">
        <div style="font-size:14px; font-weight:800; color:#15803d; margin-bottom:4px;">
          ✅ شما رأی داده‌اید
        </div>
        <div style="font-size:12px; color:#15803d;">
          رأی شما به: <strong>${myVote.candidateName || '—'}</strong>
        </div>
      </div>
    `;

    // دکمه مشاهده نتایج
    html += `
      <button class="resident-pay-btn" data-voting-results="${voting.id}" style="background: linear-gradient(135deg, #5b4cdb 0%, #4338ca 100%);">
        📊 مشاهده نتایج
      </button>
    `;
  }
  // ===== اگر رأی نداده و فعاله =====
  else if (status === 'active' && candidates.length > 0) {
    html += `
      <div style="margin-bottom:12px;">
        <label style="font-size:12.5px; font-weight:700; color:#1e293b; margin-bottom:8px; display:block;">
          🗳️ کاندید مورد نظر خود را انتخاب کنید:
        </label>
        <div class="resident-voting-candidates" data-voting-id="${voting.id}">
    `;

    candidates.forEach((c, idx) => {
      html += `
        <label class="resident-voting-candidate">
          <input type="radio" name="vote-${voting.id}" value="${c.id}" data-candidate-name="${c.name || ''}" />
          <div class="resident-voting-candidate-info">
            <div class="resident-voting-candidate-num">${toPersianNumR(idx + 1)}</div>
            <div>
              <div class="resident-voting-candidate-name">${c.name || '—'}</div>
              ${c.phone ? `<div class="resident-voting-candidate-phone">${c.phone}</div>` : ''}
            </div>
          </div>
        </label>
      `;
    });

    html += `
        </div>
      </div>
      <button class="resident-pay-btn" data-vote-submit="${voting.id}" style="background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);">
        ✅ ثبت رأی
      </button>
    `;
  }
  // ===== اگر هنوز شروع نشده =====
  else if (status === 'upcoming') {
    html += `
      <div style="background:#fef3c7; border-radius:10px; padding:12px; text-align:center; margin-bottom:12px;">
        <div style="font-size:13px; color:#92400e; font-weight:700;">
          ⏳ این رأی‌گیری هنوز شروع نشده است
        </div>
        <div style="font-size:12px; color:#b45309; margin-top:4px;">
          از ${escapeHtmlR(voting.startDate || '—')} ساعت ${escapeHtmlR(voting.startTime || '—')}
        </div>
      </div>
    `;
  }
  // ===== اگر پایان‌یافته و رأی نداده =====
  else if (status === 'ended') {
    html += `
      <div style="background:#fef3c7; border-radius:10px; padding:12px; text-align:center; margin-bottom:12px;">
        <div style="font-size:13px; color:#92400e;">
          ⏰ این رأی‌گیری به پایان رسیده است
        </div>
      </div>
      <button class="resident-pay-btn" data-voting-results="${voting.id}" style="background: linear-gradient(135deg, #5b4cdb 0%, #4338ca 100%);">
        📊 مشاهده نتایج
      </button>
    `;
  }
  // ===== اگر کاندید نداره =====
  else {
    html += `
      <div style="background:#f1f5f9; border-radius:10px; padding:12px; text-align:center;">
        <div style="font-size:12.5px; color:#64748b;">
          کاندیدی ثبت نشده است
        </div>
      </div>
    `;
  }

  html += `</div>`;

  return html;
}

/* ✅ بایند دکمه‌های رأی‌گیری */
function bindVotingActions() {
  // دکمه ثبت رأی
  document.querySelectorAll('[data-vote-submit]').forEach(btn => {
    btn.onclick = () => {
      const votingId = Number(btn.dataset.voteSubmit);
      submitVote(votingId);
    };
  });

  // دکمه مشاهده نتایج
  document.querySelectorAll('[data-voting-results]').forEach(btn => {
    btn.onclick = () => {
      const votingId = Number(btn.dataset.votingResults);
      showVotingResults(votingId);
    };
  });
}

/* ✅ ثبت رأی */
async function submitVote(votingId) {
  const session = getResidentSession();
  if (!session) return;

  const container = document.querySelector(`[data-voting-id="${votingId}"]`);
  if (!container) return;

  const selected = container.querySelector('input[type="radio"]:checked');
  if (!selected) {
    showResidentToast('لطفاً یک کاندید را انتخاب کنید.', 'warning');
    return;
  }

  const candidateId = Number(selected.value);
  const candidateName = selected.dataset.candidateName;

  // تأیید
  if (!(await appConfirm(`آیا از ثبت رأی خود به «${candidateName}» مطمئن هستید؟`))) {
    return;
  }

  const votings = loadVotings();
  const voting = votings.find(v => v.id === votingId);
  if (!voting) {
    showResidentToast('رأی‌گیری پیدا نشد.', 'error');
    return;
  }

  // چک کن قبلاً رأی نداده
  if (!voting.votes) voting.votes = [];
  
  const alreadyVoted = voting.votes.find(v => 
    v.voterPhone === session.phone
  );
  
  if (alreadyVoted) {
    showResidentToast('شما قبلاً رأی داده‌اید.', 'warning');
    return;
  }

  // اضافه کردن رأی
  const myUnitId = getUnitIdBySession();

  voting.votes.push({
    voterPhone: session.phone,
    voterName: session.name,
    voterUnitId: myUnitId,
    candidateId: candidateId,
    candidateName: candidateName,
    votedAt: new Date().toISOString(),
  });

  // آپدیت تعداد آرای کاندید
  if (voting.candidates) {
    const candidate = voting.candidates.find(c => c.id === candidateId);
    if (candidate) {
      candidate.votes = (candidate.votes || 0) + 1;
    }
  }

  saveVotings(votings);

  showResidentToast('✅ رأی شما با موفقیت ثبت شد!', 'success');

  // رفرش
  setTimeout(() => {
    renderResidentVoting();
  }, 500);
}

/* ✅ نمایش نتایج رأی‌گیری */
function showVotingResults(votingId) {
  const votings = loadVotings();
  const voting = votings.find(v => v.id === votingId);
  if (!voting) return;

  const candidates = voting.candidates || [];
  const totalVotes = (voting.votes || []).length;

  // مرتب‌سازی بر اساس آرا
  const sorted = [...candidates].sort((a, b) => (b.votes || 0) - (a.votes || 0));

  let html = `
    <div class="resident-modal-header" style="padding:0 0 16px 0; border-bottom:1px solid #e2e8f0; margin-bottom:16px;">
      <h2 style="font-size:16px; font-weight:800;">📊 نتایج: ${voting.title}</h2>
    </div>

    <div style="background:#f8fafc; border-radius:12px; padding:14px; margin-bottom:16px; text-align:center;">
      <div style="font-size:11.5px; color:#64748b; margin-bottom:4px;">کل آراء</div>
      <div style="font-size:22px; font-weight:800; color:#5b4cdb;">${toPersianNumR(totalVotes)}</div>
    </div>
  `;

  if (totalVotes === 0) {
    html += `<p style="text-align:center; color:#94a3b8; padding:20px;">هنوز رأیی ثبت نشده</p>`;
  } else {
    sorted.forEach((c, idx) => {
      const votes = c.votes || 0;
      const percent = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;

      let medal = '';
      if (idx === 0) medal = '🥇';
      else if (idx === 1) medal = '🥈';
      else if (idx === 2) medal = '🥉';

      html += `
        <div style="background:#fff; border:1px solid #e2e8f0; border-radius:10px; padding:12px; margin-bottom:8px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
            <strong style="font-size:13.5px;">${medal} ${c.name || '—'}</strong>
            <div style="text-align:left;">
              <strong style="font-size:15px; color:#5b4cdb;">${toPersianNumR(votes)}</strong>
              <span style="font-size:11px; color:#64748b;">(${toPersianNumR(percent)}٪)</span>
            </div>
          </div>
          <div style="background:#eef2ff; border-radius:8px; height:8px; overflow:hidden;">
            <div style="background:#5b4cdb; height:100%; width:${percent}%;"></div>
          </div>
        </div>
      `;
    });
  }

  // نمایش توی یه مودال ساده
  const modal = document.getElementById('residentPayModal');
  const modalBody = modal.querySelector('.resident-modal-body');
  const modalHeader = modal.querySelector('.resident-modal-header');
  const modalActions = modal.querySelector('.resident-modal-actions');

  // ذخیره محتوای قبلی
  const originalHeader = modalHeader.innerHTML;
  const originalBody = modalBody.innerHTML;
  const originalActions = modalActions.innerHTML;

  // جایگزینی
  modalHeader.innerHTML = '';
  modalBody.innerHTML = html;
  modalActions.innerHTML = `<button class="resident-submit-btn" id="residentResultsCloseBtn">بستن</button>`;

  // تغییر عنوان
  const title = modal.querySelector('h2');
  // (اختیاری)

  modal.classList.add('open');

  // بستن
  document.getElementById('residentResultsCloseBtn')?.addEventListener('click', () => {
    modalHeader.innerHTML = originalHeader;
    modalBody.innerHTML = originalBody;
    modalActions.innerHTML = originalActions;

    // بایند مجدد
    bindResidentPayModal();

    modal.classList.remove('open');
  });
}
function renderResidentProfile() {
  const session = getResidentSession();
  const container = document.getElementById('residentProfileContent');
  if (!session || !container) return;

  const myUnit = getMyUnit();
  const isTenant = session.role === 'tenant';
  const me = (myUnit && (isTenant ? myUnit.tenant : myUnit.owner)) || {};
  const isComplex = session.block && session.block !== '—';
  const v = (x) => escapeHtmlR(x == null ? '' : String(x));
  const field = (id, label, value, opts = {}) => `
      <div class="resident-form-group">
        <label for="${id}">${label}</label>
        <input type="${opts.type === 'number' ? 'text' : (opts.type || 'text')}" ${opts.type === 'number' ? 'inputmode="numeric"' : ''} id="${id}" class="resident-form-input" value="${v(value)}"
               ${opts.ltr ? 'dir="ltr"' : ''} ${opts.max ? `maxlength="${opts.max}"` : ''} ${opts.min != null ? `min="${opts.min}"` : ''}
               ${opts.ph ? `placeholder="${opts.ph}"` : ''} />
      </div>`;
  const ro = (label, value) => `
      <div style="display:flex; justify-content:space-between; padding:10px 0; border-bottom:1px solid #f1f5f9;">
        <span style="color:#64748b;">${label}</span><strong>${value}</strong>
      </div>`;

  // ============ اطلاعات من ============
  let html = `
    <div class="resident-card">
      <div class="resident-card-header"><h3>👤 اطلاعات من</h3></div>
      ${field('profileEditName', 'نام و نام خانوادگی', session.name)}
      ${field('profileEditPhone', 'شماره موبایل', session.phone, { type: 'tel', ltr: true, max: 11 })}
      <div class="resident-form-group">
        <label>نقش من در واحد</label>
        <div class="resident-role-choice">
          <label class="resident-role-opt"><input type="radio" name="profileRoleRadio" value="owner" ${!isTenant ? 'checked' : ''} /> <span>👤 مالک</span></label>
          <label class="resident-role-opt"><input type="radio" name="profileRoleRadio" value="tenant" ${isTenant ? 'checked' : ''} /> <span>🏘️ مستاجر</span></label>
        </div>
      </div>
      ${field('profileEditNationalId', 'کد ملی', me.nationalId, { ltr: true, max: 10, ph: 'اختیاری' })}
      ${field('profileEditBirthDate', 'تاریخ تولد', me.birthDate, { ph: 'مثلاً ۱۳۷۰/۰۵/۱۲ (اختیاری)' })}
    </div>`;

  // ============ اطلاعات واحد ============
  const u = myUnit || {};
  html += `
    <div class="resident-card">
      <div class="resident-card-header"><h3>🏠 اطلاعات واحد</h3></div>
      ${isComplex ? ro('بلوک', v(session.block)) : ''}
      ${ro('شماره واحد', toPersianNumR(session.unitNumber))}
      <div id="profileOwnerBox" style="${isTenant ? '' : 'display:none;'}">
        ${field('profileEditOwnerName', '🏠 نام مالک', u.owner?.name)}
        ${field('profileEditOwnerPhone', '📱 موبایل مالک', u.owner?.phone, { type: 'tel', ltr: true, max: 11, ph: 'اختیاری' })}
      </div>
      ${field('profileEditPeople', '👥 تعداد نفرات ساکن', u.peopleCount || 1, { type: 'number', min: 1 })}
      ${field('profileEditFloor', '🏢 طبقه', u.floor, { ph: 'اختیاری' })}
      ${field('profileEditArea', '📐 متراژ (متر)', u.area || '', { type: 'number', min: 0, ph: 'اختیاری' })}
      ${field('profileEditParkingCount', '🚗 تعداد پارکینگ', u.parkingCount || '', { type: 'number', min: 0 })}
      ${field('profileEditParkingNumber', '🚗 شماره پارکینگ', u.parkingNumber, { ph: 'اختیاری' })}
      ${field('profileEditStorageCount', '📦 تعداد انباری', u.storageCount || '', { type: 'number', min: 0 })}
      ${field('profileEditStorageNumber', '📦 شماره انباری', u.storageNumber, { ph: 'اختیاری' })}
      ${field('profileEditLandline', '☎️ تلفن ثابت', u.landlinePhone, { type: 'tel', ltr: true, ph: 'اختیاری' })}
      ${field('profileEditWaterBill', '💧 شناسه قبض آب', u.waterBillId, { ltr: true, ph: 'اختیاری' })}
      ${field('profileEditElectricityBill', '⚡ شناسه قبض برق', u.electricityBillId, { ltr: true, ph: 'اختیاری' })}
      ${field('profileEditGasBill', '🔥 شناسه قبض گاز', u.gasBillId, { ltr: true, ph: 'اختیاری' })}
      ${field('profileEditPhoneBill', '📞 شناسه قبض تلفن', u.phoneBillId, { ltr: true, ph: 'اختیاری' })}
    </div>`;

  // مستاجر همین واحد (برای مالک، فقط نمایش)
  const other = myUnit && !isTenant ? myUnit.tenant : null;
  if (other?.name) {
    html += `<div class="resident-card"><div class="resident-card-header"><h3>🏘️ مستاجر واحد</h3></div>
      ${ro('نام', v(other.name))}${ro('موبایل', `<span dir="ltr">${v(other.phone || '—')}</span>`)}</div>`;
  }

  html += `
    <button type="button" class="resident-submit-btn" id="profileSaveBtn" style="margin-top:8px;">💾 ذخیره تغییرات</button>
    <div id="profileSaveMsg" style="margin-top:8px;font-size:13px;text-align:center;"></div>
    <button class="resident-submit-btn" id="residentLogoutBtn2" style="background: linear-gradient(135deg, #ef4444 0%, #b91c1c 100%); margin-top: 20px;">
      <svg class="r-ico" style="width:20px;height:20px;vertical-align:-4px;margin-left:6px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3"/><path d="M10 17l-5-5 5-5"/><path d="M5 12h11"/></svg> خروج از حساب
    </button>`;

  container.innerHTML = html;
  container.querySelectorAll('input[name="profileRoleRadio"]').forEach(r => r.addEventListener('change', () => {
    const t = container.querySelector('input[name="profileRoleRadio"]:checked')?.value === 'tenant';
    const box = document.getElementById('profileOwnerBox'); if (box) box.style.display = t ? '' : 'none';
  }));
  document.getElementById('residentLogoutBtn2')?.addEventListener('click', logoutResident);
  document.getElementById('profileSaveBtn')?.addEventListener('click', saveResidentProfile);
}

/** ذخیره ویرایش پروفایل و اطلاعات واحد ساکن (به جز بلوک و شماره واحد) */
function saveResidentProfile() {
  const session = getResidentSession();
  if (!session) return;
  const faDigits = (s) => String(s || '').replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
  const val = (id) => (document.getElementById(id)?.value || '').trim();
  const num = (id) => { const n = parseFloat(faDigits(val(id))); return isFinite(n) && n >= 0 ? n : 0; };
  const msg = document.getElementById('profileSaveMsg');
  const fail = (t) => { if (msg) { msg.style.color = '#b91c1c'; msg.textContent = t; } };

  const name = val('profileEditName');
  const phone = normalizePhoneR(val('profileEditPhone'));
  const role = document.querySelector('input[name="profileRoleRadio"]:checked')?.value || session.role || 'owner';
  const people = Math.max(1, parseInt(num('profileEditPeople'), 10) || 1);
  const ownerName = val('profileEditOwnerName');
  const ownerPhone = normalizePhoneR(val('profileEditOwnerPhone'));
  const nationalId = faDigits(val('profileEditNationalId'));

  if (!name || name.length < 3) return fail('نام باید حداقل ۳ کاراکتر باشد.');
  if (!isValidIranMobileR(phone)) return fail('شماره موبایل معتبر نیست.');
  if (role === 'tenant' && ownerName.length < 3) return fail('نام مالک را وارد کنید.');
  if (role === 'tenant' && ownerPhone && !isValidIranMobileR(ownerPhone)) return fail('موبایل مالک معتبر نیست.');
  if (nationalId && !/^\d{10}$/.test(nationalId)) return fail('کد ملی باید ۱۰ رقم باشد.');

  const registered = loadRegisteredResidents();
  const r = registered.find(x => x.id === session.residentId);
  const isT = (x) => ['tenant', 'مستاجر', 'ساکن'].includes(String(x || '').toLowerCase());
  if (role !== session.role) {
    const taken = registered.find(x => x.id !== session.residentId && x.status !== 'rejected' &&
      String(x.buildingCode).toUpperCase() === String(session.buildingCode).toUpperCase() &&
      String(x.block).trim() === String(session.block).trim() && Number(x.unitNumber) === Number(session.unitNumber) &&
      isT(x.role) === (role === 'tenant'));
    if (taken) return fail(`برای این واحد قبلاً «${role === 'tenant' ? 'مستاجر' : 'مالک'}» ثبت‌نام کرده است.`);
  }

  const oldPhone = session.phone;
  const oldRole = session.role;

  // ۱) واحد
  const units = loadUnits();
  const block = String(session.block || '—').trim() || '—';
  const unit = units.find(x => String(x.block || '—').trim() === block && Number(x.number) === Number(session.unitNumber));
  if (unit) {
    const slot = role === 'tenant' ? 'tenant' : 'owner';
    const oldSlot = oldRole === 'tenant' ? 'tenant' : 'owner';
    const prev = Object.assign({}, unit[oldSlot] || {});
    if (slot !== oldSlot && (!unit[oldSlot]?.phone || unit[oldSlot].phone === oldPhone)) {
      unit[oldSlot] = { name: null, phone: null, birthDate: null, nationalId: null, type: 'settled', registered: false, approved: false };
    }
    unit[slot] = Object.assign({}, slot === oldSlot ? prev : {}, {
      name, phone,
      nationalId: nationalId || null,
      birthDate: val('profileEditBirthDate') || null,
      type: prev.type || 'settled',
      registered: true,
      approved: r?.status === 'approved' || !!prev.approved,
    });
    if (role === 'tenant' && !(unit.owner?.registered && unit.owner?.phone && unit.owner.phone !== ownerPhone)) {
      unit.owner = Object.assign({ birthDate: null, nationalId: null, type: 'settled', registered: false, approved: false }, unit.owner || {},
        { name: ownerName, phone: ownerPhone || unit.owner?.phone || null });
    }
    Object.assign(unit, {
      peopleCount: people,
      floor: val('profileEditFloor') || null,
      area: num('profileEditArea'),
      parkingCount: parseInt(num('profileEditParkingCount'), 10) || 0,
      parkingNumber: val('profileEditParkingNumber') || null,
      storageCount: parseInt(num('profileEditStorageCount'), 10) || 0,
      storageNumber: val('profileEditStorageNumber') || null,
      landlinePhone: val('profileEditLandline') || null,
      waterBillId: val('profileEditWaterBill') || null,
      electricityBillId: val('profileEditElectricityBill') || null,
      gasBillId: val('profileEditGasBill') || null,
      phoneBillId: val('profileEditPhoneBill') || null,
      status: 'occupied',
      updatedAt: new Date().toISOString(),
    });
    saveUnits(units);
  }

  // ۲) ثبت‌نام
  if (r) {
    Object.assign(r, { name, phone, role, peopleCount: people, ownerName: role === 'tenant' ? ownerName : null });
    saveRegisteredResidents(registered);
  }

  // ۳) نشست
  Object.assign(session, { name, phone, role });
  setResidentSession(session);

  // ۴) اعلان برای مدیر
  try {
    const notifKey = _residentResolvedPhone ? ('ham_sakhteman_notifications_' + _residentResolvedPhone) : 'ham_sakhteman_notifications';
    let notifs = []; try { notifs = JSON.parse(localStorage.getItem(notifKey) || '[]') || []; } catch (e) {}
    const lbl = block !== '—' ? (block + ' - واحد ' + toPersianNumR(session.unitNumber)) : ('واحد ' + toPersianNumR(session.unitNumber));
    notifs.unshift({ id: Date.now(), type: 'resident_update', title: 'ویرایش اطلاعات واحد', message: '«' + name + '» اطلاعات ' + lbl + ' را به‌روز کرد.', createdAt: new Date().toISOString(), read: false });
    localStorage.setItem(notifKey, JSON.stringify(notifs.slice(0, 50)));
  } catch (e) {}

  if (msg) { msg.style.color = '#16a34a'; msg.textContent = '✅ اطلاعات با موفقیت ذخیره شد.'; }
  showResidentToast('اطلاعات ذخیره شد', 'success');
  renderResidentHeader();
}

/* ============ خروج ============ */
async function logoutResident() {
  if (!(await appConfirm('آیا از خروج مطمئن هستید؟'))) return;
  clearResidentSession();
  showResidentToast('از حساب خارج شدید', 'success');
  setTimeout(() => location.reload(), 800);
}


/* ============ ورود ساکن ثبت‌نام‌شده ============ */
// ✅ قبلاً ساکنی که خارج می‌شد هیچ راهی برای ورود دوباره نداشت (ثبت‌نام دوباره هم مسدود بود)
function showResidentLoginStep(show) {
  const s1 = document.getElementById('residentStep1');
  const sl = document.getElementById('residentLoginStep');
  if (s1) s1.style.display = show ? 'none' : 'block';
  if (sl) sl.style.display = show ? 'block' : 'none';
  ['residentStep2', 'residentStep3'].forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
}

function loginResident() {
  const code = (document.getElementById('residentLoginCode')?.value || '').trim().toUpperCase();
  const phone = normalizePhoneR(document.getElementById('residentLoginPhone')?.value || '');
  const pass = document.getElementById('residentLoginPassword')?.value || '';
  const err = document.getElementById('residentLoginError');
  const fail = (msg) => { if (err) { err.textContent = msg; err.classList.add('show'); } };
  if (err) err.classList.remove('show');

  if (!code || !phone || !pass) return fail('کد ساختمان، موبایل و رمز را وارد کنید.');

  // ☁️ ورود از گوشی جدید: اطلاعات ساختمان و ثبت‌نام خود ساکن را از سرور بگیر
  if (window.AptSync && !loginResident._remoteTried) {
    loginResident._remoteTried = true;
    if (err) { err.textContent = '⏳ در حال بررسی…'; err.classList.add('show'); }
    const p = _findManagerPhoneByBuildingCode(code) ? Promise.resolve() : window.AptSync.openBuilding(code);
    let wrongPass = false;
    p.then(() => window.AptSync.residentRemoteLogin(code, phone, hashResidentPassword(pass)))
      .catch((e) => { if (e && e.status === 401) wrongPass = true; })
      .finally(() => {
        if (err) err.classList.remove('show');
        // سرور رمز را رد کرد (مثلاً مدیر رمز تازه گذاشته): رمز قدیمی ذخیره‌شده روی گوشی کافی نیست
        if (wrongPass) { loginResident._remoteTried = false; return fail('رمز عبور اشتباه است. اگر فراموش کرده‌اید، از مدیر ساختمان بخواهید رمز تازه بگذارد.'); }
        loginResident(); loginResident._remoteTried = false;
      });
    return;
  }

  const managerPhone = _findManagerPhoneByBuildingCode(code);
  if (!managerPhone) return fail('ساختمانی با این کد پیدا نشد.');

  const list = loadRegisteredResidents();
  const r = list.find(x =>
    String(x.buildingCode || '').toUpperCase() === code &&
    normalizePhoneR(x.phone) === phone &&
    x.status !== 'rejected'
  );
  if (!r) return fail('ساکنی با این شماره در این ساختمان ثبت‌نام نکرده است.');

  const ok = r.passwordHash
    ? r.passwordHash === hashResidentPassword(pass)
    : r.password === pass; // سازگاری با ثبت‌نام‌های قدیمی (رمز متنی)
  if (!ok) return fail('رمز عبور اشتباه است. اگر فراموش کرده‌اید، از مدیر ساختمان بخواهید رمز تازه بگذارد.');

  // مهاجرت رمز قدیمی به هش
  if (!r.passwordHash) {
    r.passwordHash = hashResidentPassword(pass);
    delete r.password;
    saveRegisteredResidents(list);
  }

  _residentResolvedPhone = managerPhone;
  setResidentSession({
    residentId: r.id,
    buildingCode: code,
    block: r.block,
    unitNumber: r.unitNumber,
    name: r.name,
    phone: normalizePhoneR(r.phone),
    role: r.role,
    managerPhone: managerPhone,
  });
  showResidentToast('خوش آمدید 👋', 'success');
  setTimeout(() => openResidentPanel(), 400);
}

/** هش‌کردن رمزهای متنی قدیمی که هنوز در localStorage مانده‌اند */
function migrateResidentPasswords() {
  const list = loadRegisteredResidents();
  let changed = false;
  list.forEach(r => {
    if (r && r.password && !r.passwordHash) {
      r.passwordHash = hashResidentPassword(r.password);
      delete r.password;
      changed = true;
    }
  });
  if (changed) saveRegisteredResidents(list);
}

/* ============ راه‌اندازی ============ */
function initResidentApp() {
  migrateResidentPasswords();

  // اگه نشست هست، پنل رو باز کن و scope داده‌ها را از نشست بازیابی کن
  const session = getResidentSession();
  // ثبت‌نامی که مدیر رد کرده → خروج
  const myReg = session ? loadRegisteredResidents().find(r => Number(r.id) === Number(session.residentId)) : null;
  if (session && myReg && myReg.status === 'rejected') {
    clearResidentSession();
    showResidentToast('ثبت‌نام شما توسط مدیر رد شد. با مدیر ساختمان تماس بگیرید.', 'error');
    document.getElementById('residentLoginPage').style.display = 'flex';
    document.getElementById('residentPanel').style.display = 'none';
  } else if (session) {
    if (session.managerPhone) {
      _residentResolvedPhone = session.managerPhone;
    } else if (session.buildingCode) {
      _residentResolvedPhone = _findManagerPhoneByBuildingCode(session.buildingCode);
    }
    openResidentPanel();
  } else {
    document.getElementById('residentLoginPage').style.display = 'flex';
    document.getElementById('residentPanel').style.display = 'none';
  }

  // مرحله ۱
  document.getElementById('residentVerifyCodeBtn')?.addEventListener('click', verifyBuildingCode);
  document.getElementById('residentBuildingCode')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') verifyBuildingCode();
  });

  // مرحله ۲
  document.getElementById('residentBackToStep1')?.addEventListener('click', () => {
    document.getElementById('residentStep1').style.display = 'block';
    document.getElementById('residentStep2').style.display = 'none';
  });

  document.getElementById('residentBlockSelect')?.addEventListener('change', (e) => {
    updateUnitOptionsForBlock(e.target.value);
  });

  document.getElementById('residentVerifyUnitBtn')?.addEventListener('click', verifyUnit);

  // مرحله ۳
  document.getElementById('residentBackToStep2')?.addEventListener('click', () => {
    document.getElementById('residentStep2').style.display = 'block';
    document.getElementById('residentStep3').style.display = 'none';
  });

   document.getElementById('residentRegisterBtn')?.addEventListener('click', registerResident);
  document.querySelectorAll('input[name="residentRoleRadio"]').forEach(r => r.addEventListener('change', () => {
    const v = document.querySelector('input[name="residentRoleRadio"]:checked')?.value || 'owner';
    const hid = document.getElementById('residentRole'); if (hid) hid.value = v;
    const g = document.getElementById('residentOwnerNameGroup'); if (g) g.style.display = v === 'tenant' ? 'block' : 'none';
  }));

  // ورود ساکن قبلی
  document.getElementById('residentShowLogin')?.addEventListener('click', (e) => { e.preventDefault(); showResidentLoginStep(true); });
  document.getElementById('residentBackToRegister')?.addEventListener('click', (e) => { e.preventDefault(); showResidentLoginStep(false); });
  document.getElementById('residentLoginBtn')?.addEventListener('click', loginResident);
  document.getElementById('residentLoginPassword')?.addEventListener('keypress', (e) => { if (e.key === 'Enter') loginResident(); });

  // همگام‌سازی زنده با پنل مدیر (تب دیگر همین مرورگر)
  let _syncTimer = null;
  window.addEventListener('storage', (e) => {
    if (!e.key || !e.key.startsWith('ham_sakhteman_') || !getResidentSession()) return;
    clearTimeout(_syncTimer);
    _syncTimer = setTimeout(() => {
      const active = document.querySelector('.resident-page.active');
      const key = active ? active.id.replace('resident-', '') : 'dashboard';
      if (key === 'messages' || key === 'profile') return; // چت خودش polling دارد؛ فرم پروفایل را خراب نکن
      if (document.getElementById('residentPayModal')?.classList.contains('open')) return;
      switchResidentPage(key);
    }, 300);
  });

  // چت و پرداخت
// چت و پرداخت
bindResidentMessagesPage();
bindResidentPayModal();
bindResidentNotifications();   
   // ✅ اطمینان از بسته بودن پنل اعلان‌ها
setTimeout(() => {
  const panel = document.getElementById('residentNotifPanel');
  if (panel) panel.classList.remove('open');
}, 100);


  // نوار پایین
  document.querySelectorAll('.resident-nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      switchResidentPage(btn.dataset.residentPage);
    });
  });

  // خروج
  document.getElementById('residentLogoutBtn')?.addEventListener('click', logoutResident);

  // ✅ چک دوره‌ای پیام‌های جدید هر ۲ ثانیه
let lastMessageCount = 0;

  setInterval(() => {
    const session = getResidentSession();
    if (!session) return;

    const messagesPage = document.getElementById('resident-messages');
    if (messagesPage?.classList.contains('active')) {
      const myUnitId = getUnitIdBySession();
      if (!myUnitId) return;

      const currentCount = loadMessages().filter(m =>
        Number(m.unitId) === Number(myUnitId)
      ).length;

      if (currentCount !== lastMessageCount) {
        // پیام جدید اومد
        if (lastMessageCount > 0 && currentCount > lastMessageCount) {
          // اگه کاربر پایین نیست، بج نشون بده
          const container = document.getElementById('residentChatMessages');
          const isAtBottom = container
            ? container.scrollHeight - container.scrollTop - container.clientHeight < 100
            : true;

          if (!isAtBottom) {
            addUnreadBadge();
          }
        }

        lastMessageCount = currentCount;
        renderResidentMessages();
      }
    }
  }, 2000);
}

document.addEventListener('DOMContentLoaded', initResidentApp);
/* ============================================================
   💳 پرداخت آنلاین شارژ
   ============================================================ */

let currentPayingChargeId = null;

let _residentPayReceiptData = null;

function _faDigits(v) { return String(v).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]); }
function _enDigits(v) {
  return String(v || '').replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
}
function _todayPersianDateR() {
  try {
    const parts = new Intl.DateTimeFormat('en-US-u-ca-persian', { year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
    const g = t => (parts.find(x => x.type === t) || {}).value || '';
    return _faDigits(`${g('year').replace(/\D/g, '')}/${g('month')}/${g('day')}`);
  } catch (e) { return ''; }
}
function _payRefFor(charge) {
  const session = getResidentSession() || {};
  const blk = session.block && session.block !== '—' ? `بلوک ${session.block} ` : '';
  const num = session.unitNumber != null ? _faDigits(session.unitNumber) : '';
  return `${blk}واحد ${num} شارژ ${charge.month || ''} ${_faDigits(charge.year || '')}`.replace(/\s+/g, ' ').trim();
}
function copyResidentPayValue(text, label) {
  const done = () => showResidentToast(`${label} کپی شد`, 'success');
  try {
    if (navigator.clipboard && window.isSecureContext) { navigator.clipboard.writeText(text).then(done, () => _fallbackCopy(text) && done()); return; }
  } catch (e) {}
  if (_fallbackCopy(text)) done(); else showResidentToast('کپی نشد؛ دستی انتخاب کنید.', 'warning');
}
function _fallbackCopy(text) {
  try {
    const ta = document.createElement('textarea'); ta.value = text; ta.setAttribute('readonly', '');
    ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select();
    const ok = document.execCommand('copy'); ta.remove(); return ok;
  } catch (e) { return false; }
}

/** فشرده‌سازی عکس رسید (حداکثر ۸۰۰ پیکسل، JPEG) تا همگام‌سازی سبک بماند */
function _compressReceipt(file) {
  return new Promise((resolve, reject) => {
    if (!file || !/^image\//.test(file.type || '')) return reject(new Error('not_image'));
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('read_failed'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('decode_failed'));
      img.onload = () => {
        const max = 800; let w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
        const k = Math.min(1, max / Math.max(w, h)); w = Math.round(w * k); h = Math.round(h * k);
        const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
        const ctx = cv.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); ctx.drawImage(img, 0, 0, w, h);
        let q = 0.6, out = cv.toDataURL('image/jpeg', q);
        while (out.length > 90000 && q > 0.3) { q -= 0.1; out = cv.toDataURL('image/jpeg', q); }
        resolve(out);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function _renderReceiptPreview() {
  const box = document.getElementById('residentPayReceiptPreview');
  const txt = document.getElementById('residentPayReceiptText');
  if (!box) return;
  if (_residentPayReceiptData) {
    box.style.display = 'block';
    box.innerHTML = `<img src="${_residentPayReceiptData}" alt="رسید" /><button type="button" class="rpay-remove" id="residentPayReceiptRemove">حذف عکس</button>`;
    if (txt) txt.textContent = 'تغییر عکس رسید';
    document.getElementById('residentPayReceiptRemove').onclick = () => {
      _residentPayReceiptData = null;
      const inp = document.getElementById('residentPayReceipt'); if (inp) inp.value = '';
      _renderReceiptPreview();
    };
  } else {
    box.style.display = 'none'; box.innerHTML = '';
    if (txt) txt.textContent = 'انتخاب عکس یا اسکرین‌شات رسید';
  }
}

function openResidentPayModal(chargeId) {
  const charges = loadCharges();
  const charge = charges.find(c => c.id === chargeId);
  if (!charge) {
    showResidentToast('شارژ پیدا نشد.', 'error');
    return;
  }

  currentPayingChargeId = chargeId;
  _residentPayReceiptData = null;

  const subtitle = document.getElementById('residentPaySubtitle');
  if (subtitle) subtitle.textContent = `${charge.month} ${toPersianNumR(charge.year)}`;
  document.getElementById('residentPayMonth').textContent = `${charge.month} ${toPersianNumR(charge.year)}`;
  const total = Number(charge.total || 0);
  document.getElementById('residentPayAmount').innerHTML =
    `${formatTomanR(total)}<div style="font-size:11px;color:#64748b;font-weight:600;margin-top:2px;">${new Intl.NumberFormat('fa-IR').format(total * 10)} ریال</div>`;
  document.getElementById('residentPayDueDate').textContent = charge.dueDate || '—';

  // اطلاعات حساب مدیر (از تنظیمات مدیر) با دکمه کپی
  const bankBox = document.getElementById('residentPayBankInfo');
  if (bankBox) {
    let st = {};
    try { st = JSON.parse(localStorage.getItem(_getScopedKey('ham_sakhteman_settings')) || '{}') || {}; } catch (e) { st = {}; }
    const ref = _payRefFor(charge);
    const rows = [];
    const row = (label, value, copyVal, ltr) => rows.push(`
      <div class="rpay-bank-row">
        <div class="rpay-bank-txt"><span>${label}</span><strong ${ltr ? 'dir="ltr"' : ''}>${escapeHtmlR(value)}</strong></div>
        ${copyVal != null ? `<button type="button" class="rpay-copy" data-copy="${escapeHtmlR(copyVal)}" data-label="${escapeHtmlR(label)}">کپی</button>` : ''}
      </div>`);
    if (st.managerCard) row('شماره کارت', st.managerCard, _enDigits(st.managerCard).replace(/\D/g, ''), true);
    if (st.managerSheba) row('شماره شبا', st.managerSheba, 'IR' + _enDigits(st.managerSheba).replace(/[^0-9]/g, ''), true);
    if (st.managerCardOwner) row('به نام', st.managerCardOwner, null, false);
    row('مبلغ (ریال)', new Intl.NumberFormat('fa-IR').format(total * 10), String(total * 10), false);
    row('شناسه واریز (در توضیحات بنویسید)', ref, ref, false);
    bankBox.innerHTML = (!st.managerCard && !st.managerSheba)
      ? `<div class="rpay-bank-empty">مدیر هنوز شماره کارت یا شبا را در تنظیمات وارد نکرده است. برای اطلاعات حساب با مدیر تماس بگیرید.</div>` + rows.join('')
      : rows.join('');
    bankBox.querySelectorAll('.rpay-copy').forEach(btn => {
      btn.onclick = () => copyResidentPayValue(btn.dataset.copy, btn.dataset.label);
    });
  }

  const dateEl = document.getElementById('residentPayDate');
  if (dateEl) dateEl.value = _todayPersianDateR();
  ['residentPayTracking', 'residentPayCard4'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  const fileEl = document.getElementById('residentPayReceipt');
  if (fileEl) {
    fileEl.value = '';
    fileEl.onchange = async () => {
      const f = fileEl.files && fileEl.files[0];
      if (!f) return;
      try {
        _residentPayReceiptData = await _compressReceipt(f);
        _renderReceiptPreview();
      } catch (e) {
        showResidentToast('این فایل عکس قابل خواندن نیست.', 'error');
      }
    };
  }
  _renderReceiptPreview();
  const cashTo = document.getElementById('residentPayCashTo'); if (cashTo) cashTo.value = '';
  document.querySelectorAll('input[name="residentPayKind"]').forEach(r => {
    r.checked = r.value === 'bank';
    r.onchange = _syncPayKindUI;
  });
  _syncPayKindUI();

  const modal = document.getElementById('residentPayModal');
  if (modal) modal.classList.add('open');
}

function _payKind() {
  const r = document.querySelector('input[name="residentPayKind"]:checked');
  return r ? r.value : 'bank';
}
function _syncPayKindUI() {
  const kind = _payKind();
  document.querySelectorAll('#residentPayModal [data-kind]').forEach(el => { el.style.display = el.dataset.kind === kind ? '' : 'none'; });
  document.querySelectorAll('.rpay-method').forEach(l => l.classList.toggle('active', !!l.querySelector('input:checked')));
  const lbl = document.getElementById('residentPayDateLabel'); if (lbl) lbl.textContent = kind === 'cash' ? 'تاریخ تحویل' : 'تاریخ واریز';
  const btn = document.getElementById('residentPayConfirmBtn'); if (btn) btn.innerHTML = kind === 'cash' ? '💵 ثبت پرداخت نقدی' : '📩 ثبت و ارسال برای مدیر';
}

function closeResidentPayModal() {
  const modal = document.getElementById('residentPayModal');
  if (modal) modal.classList.remove('open');
  currentPayingChargeId = null;
  _residentPayReceiptData = null;
}

function confirmResidentPay() {
  if (!currentPayingChargeId) return;

  const charges = loadCharges();
  const charge = charges.find(c => c.id === currentPayingChargeId);
  if (!charge) {
    showResidentToast('شارژ پیدا نشد.', 'error');
    return;
  }
  if (charge.paid || charge.pendingApproval) {
    showResidentToast('این شارژ قبلاً پرداخت یا اعلام شده است.', 'warning');
    closeResidentPayModal();
    return;
  }

  const dateEl = document.getElementById('residentPayDate');
  const trackingEl = document.getElementById('residentPayTracking');
  const card4El = document.getElementById('residentPayCard4');
  const dateEn = _enDigits(dateEl?.value || '').trim().replace(/[-.]/g, '/');
  const tracking = _enDigits(trackingEl?.value || '').trim();
  const card4 = _enDigits(card4El?.value || '').replace(/\D/g, '');

  const m = dateEn.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (!m || +m[2] < 1 || +m[2] > 12 || +m[3] < 1 || +m[3] > 31 || +m[1] < 1390 || +m[1] > 1500) {
    showResidentToast('تاریخ واریز را به شکل ۱۴۰۵/۰۸/۱۴ وارد کنید.', 'warning');
    if (dateEl) dateEl.focus();
    return;
  }
  const kind = _payKind();
  if (kind === 'bank' && !tracking && !_residentPayReceiptData) {
    showResidentToast('شماره پیگیری را وارد کنید یا عکس رسید را بفرستید.', 'warning');
    if (trackingEl) trackingEl.focus();
    return;
  }
  if (kind === 'bank' && card4 && card4.length !== 4) {
    showResidentToast('۴ رقم آخر کارت را کامل وارد کنید.', 'warning');
    if (card4El) card4El.focus();
    return;
  }

  const declaredDate = _faDigits(`${m[1]}/${String(m[2]).padStart(2, '0')}/${String(m[3]).padStart(2, '0')}`);
  if (kind === 'cash') {
    const to = (document.getElementById('residentPayCashTo')?.value || '').trim();
    charge.payMethod = 'نقدی';
    charge.payDescription = 'پرداخت نقدی اعلام‌شده توسط ساکن' + (to ? ` — تحویل به ${to}` : '');
    charge.trackingCode = '';
    charge.receipt = { date: declaredDate, kind: 'cash', to, ref: _payRefFor(charge), amount: Number(charge.total || 0) };
    charge.receiptImage = null;
  } else {
    charge.payMethod = 'واریز بانکی';
    charge.payDescription = 'اعلام واریز توسط ساکن' + (card4 ? ` — کارت مبدأ ****${card4}` : '');
    charge.trackingCode = tracking || '';
    charge.receipt = { date: declaredDate, card4: card4 || '', ref: _payRefFor(charge), amount: Number(charge.total || 0) };
    charge.receiptImage = _residentPayReceiptData || null;
  }
  charge.pendingApproval = true;
  charge.pendingAt = new Date().toISOString();
  charge.paid = false;
  charge.paidByResident = true;
  charge.rejectedAt = null;
  charge.rejectReason = null;

  try {
    saveCharges(charges);
  } catch (e) {
    showResidentToast('ذخیره نشد؛ حافظه دستگاه پر است. عکس کوچک‌تری بفرستید.', 'error');
    return;
  }
  notifyManagerAboutPayment(charge, false);

  closeResidentPayModal();
  showResidentToast('📩 واریز اعلام شد. پس از تأیید مدیر، شارژ تسویه می‌شود.', 'info');

  setTimeout(() => {
    renderResidentCharges();
    try { renderResidentDashboard(); } catch (e) {}
  }, 300);
}

/** اعلان به مدیر درباره پرداخت ساکن */
function notifyManagerAboutPayment(charge, autoApproved) {
  try {
    const notifKey = _residentResolvedPhone
      ? ('ham_sakhteman_notifications_' + _residentResolvedPhone)
      : 'ham_sakhteman_notifications';
    let notifs = [];
    try {
      const raw = localStorage.getItem(notifKey);
      if (raw) notifs = JSON.parse(raw) || [];
      if (!Array.isArray(notifs)) notifs = [];
    } catch (e) { notifs = []; }

    const title = autoApproved ? 'پرداخت آنلاین شارژ' : 'اعلام پرداخت در انتظار تأیید';
    const msg = autoApproved
      ? (`پرداخت آنلاین شارژ ${charge.month} ${charge.year} به مبلغ ${formatTomanR(charge.total)} ثبت و تسویه شد.`)
      : (`${_payRefFor(charge)}: ${charge.payMethod === 'نقدی' ? 'پرداخت نقدی' : 'واریز'} ${formatTomanR(charge.total)} در تاریخ ${(charge.receipt && charge.receipt.date) || '—'} اعلام شد${charge.trackingCode ? ' — پیگیری ' + charge.trackingCode : ''}${charge.receiptImage ? ' (با عکس رسید)' : ''}. نیاز به تأیید دارد.`);

    notifs.unshift({
      id: Date.now(),
      type: autoApproved ? 'payment_online' : 'payment_pending',
      title,
      message: msg,
      createdAt: new Date().toISOString(),
      read: false,
      chargeId: charge.id,
    });
    if (notifs.length > 50) notifs = notifs.slice(0, 50);
    localStorage.setItem(notifKey, JSON.stringify(notifs));
  } catch (e) {
    console.warn('notifyManagerAboutPayment failed', e);
  }
}
function updateResidentUnitDebt() {
  const session = getResidentSession();
  if (!session) return;

  const units = loadUnits();
  const myUnit = units.find(u => {
    if (session.block === '—' || !session.block) {
      return (u.block === '—' || !u.block) && Number(u.number) === Number(session.unitNumber);
    }
    return String(u.block).trim() === String(session.block).trim()
        && Number(u.number) === Number(session.unitNumber);
  });

  if (!myUnit) return;

  // محاسبه بدهی از شارژهای پرداخت‌نشده
  const charges = loadCharges();
  const unpaidCharges = charges.filter(c => 
    Number(c.unitId) === Number(myUnit.id) && !c.paid
  );
  const totalDebt = unpaidCharges.reduce((s, c) => s + (Number(c.total) || 0), 0);

  // آپدیت واحد
  myUnit.debt = totalDebt;
  myUnit.debtExplicit = true;
  saveUnits(units);
}

function bindResidentPayModal() {
  const closeBtn = document.getElementById('residentPayCloseBtn');
  if (closeBtn) closeBtn.onclick = closeResidentPayModal;

  const cancelBtn = document.getElementById('residentPayCancelBtn');
  if (cancelBtn) cancelBtn.onclick = closeResidentPayModal;

  const confirmBtn = document.getElementById('residentPayConfirmBtn');
  if (confirmBtn) confirmBtn.onclick = confirmResidentPay;

  const modal = document.getElementById('residentPayModal');
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeResidentPayModal();
    });
  }
}
/* ============================================================
   💾 توابع ذخیره‌سازی (کپی از app.js)
   ============================================================ */

function saveCharges(charges) {
  const key = _getScopedKey('ham_sakhteman_charges');
  localStorage.setItem(key, JSON.stringify(charges));
}

function saveUnits(units) {
  const key = _getScopedKey('ham_sakhteman_units');
  localStorage.setItem(key, JSON.stringify(units));
}

function saveMessages(messages) {
  const key = _getScopedKey('ham_sakhteman_messages');
  localStorage.setItem(key, JSON.stringify(messages));
}

function saveNotices(notices) {
  const key = _getScopedKey('ham_sakhteman_notices');
  localStorage.setItem(key, JSON.stringify(notices));
}

function saveVotings(votings) {
  const key = _getScopedKey('ham_sakhteman_votings');
  localStorage.setItem(key, JSON.stringify(votings));
}
/* ============================================================
   🔔 اعلان‌ها — کامل
   ============================================================ */

const RESIDENT_NOTIF_KEY = 'ham_sakhteman_resident_notifications';
const RESIDENT_NOTIF_READ_KEY = 'ham_sakhteman_resident_notif_read';

function loadResidentNotifications() {
  const raw = localStorage.getItem(RESIDENT_NOTIF_KEY);
  if (raw) { try { return JSON.parse(raw); } catch (e) { return []; } }
  return [];
}

function saveResidentNotifications(notifs) {
  localStorage.setItem(RESIDENT_NOTIF_KEY, JSON.stringify(notifs));
}

function loadNotifReadIds() {
  const raw = localStorage.getItem(RESIDENT_NOTIF_READ_KEY);
  if (raw) { try { return JSON.parse(raw); } catch (e) { return []; } }
  return [];
}

function saveNotifReadIds(ids) {
  localStorage.setItem(RESIDENT_NOTIF_READ_KEY, JSON.stringify(ids));
}

/* ✅ تولید اعلان‌ها */
function generateResidentNotifications() {
  const session = getResidentSession();
  if (!session) return [];

  const myUnitId = getUnitIdBySession();
  if (!myUnitId) return [];

  const notifications = [];
  const now = new Date();
  const readIds = loadNotifReadIds();

  // ===== ۱. شارژهای پرداخت‌نشده =====
  const charges = loadCharges().filter(c =>
    Number(c.unitId) === Number(myUnitId) && !c.paid
  );

  charges.forEach(c => {
    notifications.push({
      id: `charge-${c.id}`,
      icon: '💰',
      iconClass: 'blue',
      title: `شارژ ${c.month} ${toPersianNumR(c.year)}`,
      desc: `مبلغ: ${formatTomanR(c.total)} — پرداخت نشده`,
      time: c.issuedAt ? new Date(c.issuedAt).toLocaleDateString('fa-IR') : '—',
      createdAt: c.issuedAt || c.createdAt || '',
      page: 'charges',
    });
  });

  // ===== ۲. پیام‌های خوانده‌نشده از مدیر =====
  const messages = loadMessages().filter(m =>
    Number(m.unitId) === Number(myUnitId) && m.direction === 'sent' && !m.read
  );

  messages.forEach(m => {
    notifications.push({
      id: `message-${m.id}`,
      icon: '💬',
      iconClass: 'green',
      title: 'پیام جدید از مدیر',
      desc: (m.body || '').substring(0, 60) + ((m.body || '').length > 60 ? '...' : ''),
      time: m.date || '—',
      createdAt: m.createdAt || '',
      page: 'messages',
    });
  });

  // ===== ۳. رأی‌گیری‌های فعال (که رأی ندادی) =====
  const votings = loadVotings();
  votings.forEach(v => {
    const start = new Date(v.startDateTime || v.createdAt);
    const end = new Date(v.endDateTime || v.createdAt);

    if (now >= start && now <= end) {
      const myVote = (v.votes || []).find(vt => vt.voterPhone === session.phone);
      if (!myVote) {
        notifications.push({
          id: `voting-${v.id}`,
          icon: '🗳️',
          iconClass: 'purple',
          title: `رأی‌گیری: ${v.title}`,
          desc: 'هنوز رأی نداده‌اید',
          time: v.startDate || '—',
          createdAt: v.createdAt || '',
          page: 'voting',
        });
      }
    }
  });

  // ===== ۴. همه اطلاعیه‌ها =====
  const notices = loadNotices();
  notices.forEach(n => {
    notifications.push({
      id: `notice-${n.id}`,
      icon: '📢',
      iconClass: 'orange',
      title: n.title || 'اطلاعیه جدید',
      desc: (n.body || '').substring(0, 80) + ((n.body || '').length > 80 ? '...' : ''),
      time: n.date || '—',
      createdAt: n.createdAt || '',
      page: 'notices',
    });
  });

  // مرتب‌سازی: جدیدترین اول
  notifications.sort((a, b) =>
    (b.createdAt || '').localeCompare(a.createdAt || '')
  );

  // اضافه کردن وضعیت خوانده‌شده
  notifications.forEach(n => {
    n.read = readIds.includes(n.id);
  });

  return notifications;
}

/* ✅ نمایش اعلان‌ها */
function renderResidentNotifications() {
  const list = document.getElementById('residentNotifList');
  const dot = document.getElementById('residentNotifDot');

  if (!list) return;

  const notifications = generateResidentNotifications();
  const unreadCount = notifications.filter(n => !n.read).length;

  // نقطه قرمز
  if (dot) {
    dot.style.display = unreadCount > 0 ? 'block' : 'none';
  }

  if (notifications.length === 0) {
    list.innerHTML = `
      <div class="resident-notif-empty">
        <div class="resident-notif-empty-icon">🔕</div>
        <div>اعلان جدیدی وجود ندارد</div>
      </div>
    `;
    return;
  }

  list.innerHTML = notifications.map(n => `
    <div class="resident-notif-item ${n.read ? '' : 'unread'}" data-notif-id="${n.id}" data-notif-page="${n.page}">
      <div class="resident-notif-icon ${n.iconClass}">${n.icon}</div>
      <div class="resident-notif-body">
        <div class="resident-notif-title">
          <span>${n.title}</span>
          ${!n.read ? '<span class="resident-notif-badge">جدید</span>' : ''}
        </div>
        <div class="resident-notif-desc">${n.desc}</div>
        <div class="resident-notif-time">${n.time}</div>
      </div>
    </div>
  `).join('');

  // بایند کلیک
  list.querySelectorAll('.resident-notif-item').forEach(item => {
    item.addEventListener('click', () => {
      const id = item.dataset.notifId;
      const page = item.dataset.notifPage;

      // علامت‌گذاری خوانده‌شده
      const readIds = loadNotifReadIds();
      if (!readIds.includes(id)) {
        readIds.push(id);
        saveNotifReadIds(readIds);
      }

      closeResidentNotifPanel();
      renderResidentNotifications();

      // رفتن به صفحه
      if (page) {
        switchResidentPage(page);
      }
    });
  });
}

/* ✅ باز کردن پنل */
function openResidentNotifPanel() {
  const panel = document.getElementById('residentNotifPanel');
  if (panel) panel.classList.add('open');
  renderResidentNotifications();
}

/* ✅ بستن پنل */
function closeResidentNotifPanel() {
  const panel = document.getElementById('residentNotifPanel');
  if (panel) panel.classList.remove('open');
}

/* ✅ پاک کردن همه */
async function clearResidentNotifications() {
  if (!(await appConfirm('⚠️ همه اعلان‌ها پاک شوند؟'))) return;

  // همه رو به عنوان خوانده‌شده علامت بزن
  const notifications = generateResidentNotifications();
  const ids = notifications.map(n => n.id);
  saveNotifReadIds(ids);

  renderResidentNotifications();
  showResidentToast('همه اعلان‌ها پاک شدند', 'success');
}

/* ✅ بایند دکمه‌ها */
function bindResidentNotifications() {
  const btn = document.getElementById('residentNotifBtn');
  const panel = document.getElementById('residentNotifPanel');
  const clearBtn = document.getElementById('residentNotifClearBtn');

  // اطمینان از بسته بودن پنل
  if (panel) panel.classList.remove('open');

  // دکمه زنگوله
  if (btn) {
    btn.onclick = (e) => {
      e.stopPropagation();
      e.preventDefault();

      if (panel.classList.contains('open')) {
        closeResidentNotifPanel();
      } else {
        openResidentNotifPanel();
      }
    };
  }

  // دکمه پاک کردن
  if (clearBtn) {
    clearBtn.onclick = (e) => {
      e.stopPropagation();
      e.preventDefault();
      clearResidentNotifications();
    };
  }

  // بستن با کلیک بیرون
  document.addEventListener('click', (e) => {
    if (!panel) return;
    if (!panel.classList.contains('open')) return;
    if (!panel.contains(e.target) && !btn?.contains(e.target)) {
      closeResidentNotifPanel();
    }
  });

  // بستن با Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeResidentNotifPanel();
  });

  // آپدیت هر ۳۰ ثانیه
  setInterval(() => {
    if (getResidentSession()) {
      renderResidentNotifications();
    }
  }, 30000);
}
