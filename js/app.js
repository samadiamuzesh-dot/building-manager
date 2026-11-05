/* ============================================================
   آپارتمان پلاس | v22
   ============================================================

   🎨 طراحی و توسعه: الهام صمدی
   👩‍💼 مدیر پروژه: الهام صمدی

   اصلاحات v22:
   - نمودار روند درآمد دیگر داده جعلی نشان نمی‌دهد
   - داشبورد وضعیت واحدها و همه صفحات برای کاربر جدید خالی/صفر
   - پاک‌سازی کامل داده‌ها هنگام ثبت‌نام جدید
   - اعلان‌ها per-account شدند
   ============================================================ */
console.log('APP.JS VERSION: v27 — cloud sync (Vercel)');
console.log('APP.JS VERSION: v25 — ApartmentPlus (single units + paid price + limits)');
console.log('APP.JS VERSION: v22 — ApartmentPlus (full empty state: no fake charts/data)');
console.log('%c🏢 آپارتمان پلاس | v22', 'color: #5b4cdb; font-size: 14px; font-weight: bold;');
console.log('%c🎨 طراحی و توسعه: الهام صمدی', 'color: #5b4cdb; font-size: 12px;');


function getAccountStorageKey(baseKey) {
  const phone = localStorage.getItem('ham_sakhteman_user_phone');

  if (!phone) return baseKey;

  const normalizedPhone = typeof normalizePhone === 'function'
    ? normalizePhone(phone)
    : phone.replace(/\D/g, '');

  return `${baseKey}_${normalizedPhone}`;
}

function getStorageKey() {
  return getAccountStorageKey('ham_sakhteman_v3');
}

function getUnitsStorageKey() {
  return getAccountStorageKey('ham_sakhteman_units');
}


/* ============ ۱) ابزار ============ */
function formatToman(a) { return new Intl.NumberFormat('fa-IR').format(Number(a) || 0) + ' تومان'; }
function formatNumber(n) { return new Intl.NumberFormat('fa-IR').format(Number(n) || 0); }
function toPersianNum(n) {
  const p = ['۰','۱','۲','۳','۴','۵','۶','۷','۸','۹'];
  return String(n).replace(/\d/g, d => p[d]);
}
function formatPrice(n) {
  return new Intl.NumberFormat('fa-IR').format(Number(n) || 0) + ' تومان';
}

/* ============================================================
   🧮 ابزارهای حسابداری (v26)
   ============================================================ */
function toEnDigits(s) {
  return String(s == null ? '' : s)
    .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
    .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
}

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** تاریخ شمسی متنی (۱۴۰۵/۸/۱۳ یا 1405-08-13) → {year, month, day} یا null */
function parsePersianDateParts(str) {
  if (!str) return null;
  const parts = toEnDigits(str).trim().split(/[\/\-.]/).map(p => parseInt(p, 10));
  if (parts.length !== 3 || parts.some(isNaN)) return null;
  const [y, m, d] = parts;
  if (y < 1300 || y > 1500 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  return { year: y, month: m, day: d };
}

/** کلید عددی قابل مرتب‌سازی برای تاریخ شمسی: 14050813 */
function persianDateSortKey(str, isoFallback) {
  const p = parsePersianDateParts(str);
  if (p) return p.year * 10000 + p.month * 100 + p.day;
  if (isoFallback) {
    const d = new Date(isoFallback);
    if (!isNaN(d)) {
      const j = gregorianToPersian(d.getFullYear(), d.getMonth() + 1, d.getDate());
      return j.year * 10000 + j.month * 100 + j.day;
    }
  }
  return 0;
}

/** ISO → {year, month, day} شمسی */
function isoToPersianParts(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d)) return null;
  return gregorianToPersian(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

/**
 * دوره نقدی یک پرداخت (ماهی که پول واقعاً وارد صندوق شد).
 * اولویت: تاریخ پرداخت واردشده → زمان ثبت پرداخت → دوره شارژ
 */
function getChargeCashPeriod(c) {
  const p = parsePersianDateParts(c.paidDate) || isoToPersianParts(c.paidAt);
  if (p) return { month: PERSIAN_MONTHS[p.month - 1], year: String(p.year), key: p.year * 10000 + p.month * 100 + p.day };
  return { month: c.month, year: String(c.year), key: 0 };
}

/** آیا پرداخت شارژ در ماه/سال داده‌شده وصول شده؟ (مبنای نقدی) */
function isChargeCollectedIn(c, monthName, yearStr) {
  if (!c || c.paid !== true) return false;
  const p = getChargeCashPeriod(c);
  return p.month === monthName && String(p.year) === String(yearStr);
}

/** دوره هزینه/درآمد جانبی: ماه و سالی که کاربر انتخاب کرده */
function getEntryDateKey(item) {
  const p = parsePersianDateParts(item.date);
  if (p) return p.year * 10000 + p.month * 100 + p.day;
  const mi = PERSIAN_MONTHS.indexOf(item.month);
  const y = parseInt(toEnDigits(item.year), 10);
  if (mi >= 0 && y) return y * 10000 + (mi + 1) * 100 + 1;
  return persianDateSortKey(null, item.createdAt);
}

/** n ماه اخیر به‌صورت {month, year} — با عبور درست از مرز سال */
function getLastNPersianMonths(n, endMonthIdx, endYear) {
  const today = getTodayPersian();
  let m = endMonthIdx != null ? endMonthIdx + 1 : today.month;
  let y = endYear != null ? Number(endYear) : today.year;
  const result = [];
  for (let i = 0; i < n; i++) {
    result.unshift({ month: PERSIAN_MONTHS[m - 1], year: String(y), label: PERSIAN_MONTHS[m - 1] });
    m -= 1;
    if (m < 1) { m = 12; y -= 1; }
  }
  return result;
}

/** برچسب کوتاه مبلغ برای محور نمودار: ۱٫۲ م / ۳۵۰ ه */
function formatAxisAmount(v) {
  const n = Number(v) || 0;
  if (n >= 1e9) return formatNumber(Math.round(n / 1e8) / 10) + ' میلیارد';
  if (n >= 1e6) return formatNumber(Math.round(n / 1e5) / 10) + ' میلیون';
  if (n >= 1e3) return formatNumber(Math.round(n / 1e3)) + ' هزار';
  return formatNumber(n);
}

/** خطوط راهنما + برچسب محور Y برای نمودارها */
function drawYAxis(ctx, padding, chartW, chartH, maxVal) {
  ctx.save();
  ctx.strokeStyle = '#f1f5f9';
  ctx.lineWidth = 1;
  ctx.fillStyle = '#94a3b8';
  ctx.font = '10.5px Vazirmatn, Tahoma';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (let i = 0; i <= 4; i++) {
    const y = padding.top + (chartH / 4) * i;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(padding.left + chartW, y);
    ctx.stroke();
    const val = maxVal * (1 - i / 4);
    ctx.fillText(formatAxisAmount(val), padding.left - 6, y);
  }
  ctx.restore();
}

function drawEmptyChartText(ctx, W, H, text) {
  ctx.save();
  ctx.fillStyle = '#94a3b8';
  ctx.font = '13px Vazirmatn, Tahoma';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text || 'هنوز داده‌ای ثبت نشده', W / 2, H / 2 - 10);
  ctx.restore();
}

/** سهم یک بلوک از هزینه/درآمد مشترک (بر اساس تعداد واحدها) */
function getBlockShare(blockName) {
  if (!blockName || blockName === 'all') return 1;
  const total = UNITS.length;
  if (!total) return 0;
  const inBlock = UNITS.filter(u => String(u.block).trim() === String(blockName).trim()).length;
  return inBlock / total;
}

/** برچسب واحد: «A-۱۲» یا «واحد ۱۲» */
function unitLabelOf(unit) {
  if (!unit) return '—';
  return (unit.block && unit.block !== '—')
    ? `${unit.block}-${toPersianNum(unit.number)}`
    : `واحد ${toPersianNum(unit.number)}`;
}

/** پرداخت‌کننده اصلی شارژ: مستاجر اگر هست، وگرنه مالک */
function payerOf(unit) {
  if (!unit) return { name: null, phone: null };
  if (unit.tenant?.name) return { name: unit.tenant.name, phone: unit.tenant.phone };
  return { name: unit.owner?.name || null, phone: unit.owner?.phone || null };
}

/** پاک کردن کامل اطلاعات پرداخت یک شارژ (برای لغو/رد) */
function clearChargePayment(charge) {
  charge.paid = false;
  charge.paidDate = null;
  charge.paidAt = null;
  charge.payMethod = null;
  charge.payDescription = null;
  charge.trackingCode = null;
  charge.pendingApproval = false;
  charge.pendingAt = null;
  charge.approvedByManager = false;
  charge.approvedAt = null;
  charge.paidByResident = false;
  charge.receipt = null;
  charge.receiptImage = null;
}

/* ============================================================
   📅 ماه‌های شمسی
   ============================================================ */
const PERSIAN_MONTHS = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
                        'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];

/* ============================================================
   🍞 Toast Notifications (پیام گوشه صفحه)
   ============================================================ */
function showToast(message, type = 'success', title = null) {
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  const titles = { success: 'موفق', error: 'خطا', warning: 'هشدار', info: 'اطلاع' };

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <div class="toast-icon">${icons[type] || '✅'}</div>
    <div class="toast-body">
      <div class="toast-title">${title || titles[type] || 'پیام'}</div>
      <div class="toast-message">${message}</div>
    </div>
    <button class="toast-close" onclick="this.closest('.toast').remove()">✖</button>
  `;

  container.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => {
    toast.classList.remove('show');
    toast.classList.add('hide');
    setTimeout(() => toast.remove(), 400);
  }, 3500);
}

function toastSuccess(msg, title) { showToast(msg, 'success', title); }
function toastError(msg, title) { showToast(msg, 'error', title); }
function toastWarning(msg, title) { showToast(msg, 'warning', title); }
function toastInfo(msg, title) { showToast(msg, 'info', title); }

/* ============================================================
   📅 تاریخ خودکار (شمسی)
   ============================================================ */
function getTodayPersian() {
  const now = new Date();
  return gregorianToPersian(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

function getTodayPersianMonth() {
  const today = getTodayPersian();
  return PERSIAN_MONTHS[today.month - 1];
}

function getTodayPersianYear() {
  return getTodayPersian().year;
}

function getTodayPersianYearFa() {
  return toPersianNum(getTodayPersianYear());
}

function getTodayPersianDate() {
  const today = getTodayPersian();
  const month = String(today.month).padStart(2, '0');
  const day = String(today.day).padStart(2, '0');
  return `${today.year}/${month}/${day}`;
}

function gregorianToPersian(gy, gm, gd) {
  const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  let jy = (gy <= 1600) ? 0 : 979;
  gy -= (gy <= 1600) ? 621 : 1600;
  const gy2 = (gm > 2) ? (gy + 1) : gy;
  let days = (365 * gy) + Math.floor((gy2 + 3) / 4) - Math.floor((gy2 + 99) / 100) + Math.floor((gy2 + 399) / 400) - 80 + gd + g_d_m[gm - 1];
  jy += 33 * Math.floor(days / 12053);
  days %= 12053;
  jy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) {
    jy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }
  const jm = (days < 186) ? 1 + Math.floor(days / 31) : 7 + Math.floor((days - 186) / 30);
  const jd = 1 + ((days < 186) ? (days % 31) : ((days - 186) % 30));
  return { year: jy, month: jm, day: jd };
}

/* ============================================================
   📅 پر کردن دراپ‌داون‌های سال و ماه
   ============================================================ */
function fillYearMonthDropdowns(yearId, monthId) {
  const years = [];
  const currentYear = getTodayPersianYear();

  for (let i = currentYear - 2; i <= currentYear + 2; i++) {
    years.push(String(i));
  }

  if (yearId) {
    const yearSelect = document.getElementById(yearId);
    if (yearSelect) {
      yearSelect.innerHTML = '';
      years.forEach(y => {
        const opt = document.createElement('option');
        opt.value = y;
        opt.textContent = toPersianNum(y);
        if (y === String(currentYear)) opt.selected = true;
        yearSelect.appendChild(opt);
      });
    }
  }

  if (monthId) {
    const monthSelect = document.getElementById(monthId);
    if (monthSelect) {
      monthSelect.innerHTML = '';
      PERSIAN_MONTHS.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m;
        opt.textContent = m;
        if (m === getTodayPersianMonth()) opt.selected = true;
        monthSelect.appendChild(opt);
      });
    }
  }
}

/* ============ ۲) کد ساختمان و اعتبارسنجی ============ */
function generateBuildingCode(type, totalUnits) {
  const num = Math.floor(100000 + Math.random() * 900000);
  if (type === 'complex') return 'M-' + num;
  if (totalUnits > 40) return 'B-' + num;
  return 'S-' + num;
}

function isValidIranMobile(phone) {
  if (!phone) return false;
  const persianDigits = '۰۱۲۳۴۵۶۷۸۹';
  const arabicDigits = '٠١٢٣٤٥٦٧٨٩';
  let cleaned = String(phone);
  for (let i = 0; i < 10; i++) {
    cleaned = cleaned.replace(new RegExp(persianDigits[i], 'g'), i);
    cleaned = cleaned.replace(new RegExp(arabicDigits[i], 'g'), i);
  }
  cleaned = cleaned.replace(/[^\d]/g, '');
  return /^09\d{9}$/.test(cleaned);
}

/* ============ ۳) ذخیره/بارگذاری ============ */

function loadData() {
  const raw = localStorage.getItem(getStorageKey());

  if (raw) {
    try {
      return JSON.parse(raw);
    } catch (e) {}
  }

  return null;
}

function saveData(data) {
  localStorage.setItem(getStorageKey(), JSON.stringify(data));
}

let UNITS = [];

function loadUnits() {
  const raw = localStorage.getItem(getUnitsStorageKey());

  if (raw) {
    try {
      UNITS = JSON.parse(raw);
      if (!Array.isArray(UNITS)) UNITS = [];
    } catch (e) {
      UNITS = [];
    }
  } else {
    UNITS = [];
  }

  // همیشه واحدهای خالی (بدون مالک و بدون مستاجر ثبت‌نام‌شده) را حذف کن
  // فقط واحدهایی که واقعاً ساکن ثبت‌نام کرده باقی می‌مانند
  const before = UNITS.length;
  UNITS = UNITS.filter(u => {
    const hasOwner = !!(u.owner?.name || u.owner?.registered);
    const hasTenant = !!(u.tenant?.name || u.tenant?.registered);
    const hasCharge = Number(u.chargeAmount) > 0;
    const hasDebt = u.debt != null && Number(u.debt) > 0;
    // واحد دستی اضافه‌شده توسط مدیر (با متراژ) را نگه دار
    const manuallyAdded = Number(u.area) > 0 && u.source !== 'resident_register';
    return hasOwner || hasTenant || hasCharge || hasDebt || manuallyAdded;
  });
  if (UNITS.length !== before) {
    saveUnits();
    console.log('🧹 واحدهای خالی حذف شدند:', before - UNITS.length);
  }

  // کلید قدیمی بدون scope را پاک کن تا داده‌های آلوده دوباره لود نشوند
  try { localStorage.removeItem('ham_sakhteman_units'); } catch (e) {}

  // همگام‌سازی ثبت‌نام ساکنین با لیست واحدها (فقط همان‌هایی که ثبت‌نام کرده‌اند)
  mergeRegisteredResidentsIntoUnits();
}

/** ثبت‌نام‌های ساکنین را به لیست واحدهای مدیر اضافه/به‌روز کن */
function mergeRegisteredResidentsIntoUnits() {
  let registered = [];
  try {
    const raw = localStorage.getItem('ham_sakhteman_registered_residents');
    if (raw) registered = JSON.parse(raw) || [];
    if (!Array.isArray(registered)) registered = [];
  } catch (e) {
    registered = [];
  }
  if (registered.length === 0) return;

  const data = loadData();
  const buildingCode = (data?.building?.code || '').toUpperCase();
  let changed = false;

  registered.forEach(r => {
    if (!r || r.status === 'rejected') return;
    // فقط ساکنین همین ساختمان
    if (buildingCode && r.buildingCode && String(r.buildingCode).toUpperCase() !== buildingCode) return;

    const block = String(r.block || '—').trim() || '—';
    const number = parseInt(r.unitNumber, 10);
    if (!number || number < 1) return;

    let unit = UNITS.find(u =>
      String(u.block || '').trim() === block && Number(u.number) === number
    );

    const person = {
      name: r.name || null,
      phone: r.phone || null,
      birthDate: null,
      nationalId: null,
      type: 'settled',
      registered: true,
      approved: r.status === 'approved',
    };

    if (!unit) {
      const newId = UNITS.length > 0
        ? Math.max(...UNITS.map(u => Number(u.id) || 0)) + 1
        : 1;
      const toFa = (typeof toPersianNum === 'function') ? toPersianNum : (n) => String(n);
      unit = {
        id: newId,
        block: block,
        number: number,
        code: (block === '—' ? 'S' : block) + '-' + toFa(number),
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
        createdAt: r.registeredAt || new Date().toISOString(),
        source: 'resident_register',
      };
      UNITS.push(unit);
      changed = true;
    }

    const role = String(r.role || 'owner').toLowerCase();
    const isTenant = role === 'tenant' || role === 'مستاجر' || role === 'ساکن';

    if (isTenant) {
      if (!unit.tenant?.name || unit.tenant.name !== person.name || !!unit.tenant.approved !== person.approved) {
        unit.tenant = { ...person };
        unit.status = 'occupied';
        changed = true;
      }
    } else {
      if (!unit.owner?.name || unit.owner.name !== person.name || !!unit.owner.approved !== person.approved) {
        unit.owner = { ...person };
        unit.status = 'occupied';
        changed = true;
      }
    }
  });

  if (changed) {
    saveUnits();
  }
}

function saveUnits() {
  localStorage.setItem(
    getUnitsStorageKey(),
    JSON.stringify(UNITS)
  );
}




/* ============ ۴) ساخت واحدهای خالی ============ */
function buildEmptyUnits(building) {
  // غیرفعال شد — واحدها از قبل ساخته نمی‌شوند
  // کاربر خودش از طریق «افزودن واحد» اضافه می‌کند
  console.warn('buildEmptyUnits غیرفعال است — واحدی ساخته نشد');
}

// سازگاری با نام قدیمی — هیچ کاری نمی‌کند
function buildDemoUnits(building) {
  // noop
}

/* ============ ۵) کارت ساختمان ============ */
function renderBuildingCard() {
  const data = loadData();
  const nameEl = document.getElementById('buildingName');
  const codeEl = document.getElementById('buildingCode');

  if (!data || !data.building) {
    if (nameEl) nameEl.textContent = 'در حال بارگذاری...';
    if (codeEl) codeEl.textContent = '—';
    return;
  }

  const b = data.building;
  if (nameEl) nameEl.textContent = b.name || 'ساختمان من';
  if (codeEl) codeEl.textContent = b.code || '—';
}
/** حداکثر تعداد واحد مجاز بر اساس ساختمان / پلن */
function getMaxAllowedUnits() {
  const data = loadData();
  const building = data?.building;
  if (building) {
    const fromBuilding = getExpectedUnitsCount(building);
    if (fromBuilding > 0) return fromBuilding;
  }
  const plan = typeof loadPlan === 'function' ? loadPlan() : null;
  if (plan && plan.totalUnits > 0) return Number(plan.totalUnits);
  return 0;
}

/** به‌روزرسانی وضعیت دکمه «افزودن واحد» */
function updateAddUnitButtonState() {
  const btn = document.getElementById('btnAddUnit');
  if (!btn) return;
  const max = getMaxAllowedUnits();
  const atLimit = max > 0 && UNITS.length >= max;
  btn.disabled = atLimit;
  btn.style.opacity = atLimit ? '0.55' : '1';
  btn.style.cursor = atLimit ? 'not-allowed' : '';
  btn.title = atLimit
    ? `حداکثر ${toPersianNum(max)} واحد (بر اساس ثبت‌نام و پرداخت) مجاز است`
    : 'افزودن واحد جدید';

  // متن دکمه را هم برای وضوح بیشتر عوض کن
  const originalText = btn.dataset.originalText || btn.textContent.trim();
  if (!btn.dataset.originalText) btn.dataset.originalText = originalText;
  if (atLimit) {
    btn.innerHTML = `🔒 سقف ${toPersianNum(max)} واحد`;
  } else {
    btn.innerHTML = btn.dataset.originalText || '＋ افزودن واحد';
  }
}

/* ============ ۶) اطلاعات صفحات ============ */
const PAGE_INFO = {
  dashboard: { title: 'داشبورد', subtitle: 'خلاصه وضعیت ساختمان' },
  units:     { title: 'واحدها', subtitle: 'مدیریت واحدها و ساکنین' },
  charges:   { title: 'صدور شارژ', subtitle: 'صدور شارژ ماهانه واحدها' },
  payments:  { title: 'دریافت‌ها', subtitle: 'مدیریت دریافت‌های ساختمان' },
  'charges-payments': { title: 'دریافت شارژها', subtitle: 'تاریخچه پرداخت‌های شارژ' },
  'side-incomes': { title: 'درآمد جانبی', subtitle: 'اجاره‌ها و درآمدهای اضافی' },
  expenses:  { title: 'هزینه‌ها', subtitle: 'هزینه‌های ساختمان' },
  notices:   { title: 'اطلاعیه‌ها', subtitle: 'ارسال اطلاعیه به ساکنین' },
  messages:  { title: 'پیام‌ها', subtitle: 'پیام‌های داخلی' },
  voting:    { title: 'رأی‌گیری', subtitle: 'رأی‌گیری هیئت مدیره' },
  reports:   { title: 'گزارشات', subtitle: 'گزارش‌های مالی و عملکردی' },
  profit:    { title: 'سود و زیان', subtitle: 'تحلیل درآمد و هزینه' },
  profile:   { title: 'پروفایل من', subtitle: 'اطلاعات شخصی و امنیتی' },
  settings:  { title: 'تنظیمات', subtitle: 'تنظیمات ساختمان و حساب' },
  subscription: { title: 'اشتراکی', subtitle: 'مدیریت پلن و اشتراک' },
  support: { title: 'پشتیبانی', subtitle: 'ارسال تیکت و پیگیری' },
};

function switchPage(pageKey) {
  if (isPageLocked(pageKey)) {
    showUpgradeModal(pageKey);
    return;
  }

  document.querySelectorAll('#menu > li').forEach(li => {
    const liPage = li.dataset.page;
    const isActive = liPage === pageKey ||
      (liPage === 'payments' && (pageKey === 'charges-payments' || pageKey === 'side-incomes'));
    li.classList.toggle('active', isActive);
  });

  document.querySelectorAll('#menu .submenu li').forEach(li => {
    li.classList.toggle('active', li.dataset.page === pageKey);
  });

  const paymentsMenu = document.querySelector('#menu .has-submenu[data-page="payments"]');
  if (paymentsMenu) {
    if (pageKey === 'charges-payments' || pageKey === 'side-incomes') {
      paymentsMenu.classList.add('open');
    }
  }

  document.querySelectorAll('.page').forEach(s => {
    s.classList.toggle('active', s.id === `page-${pageKey}`);
  });

  const info = PAGE_INFO[pageKey];
  if (info) {
    const t = document.getElementById('pageTitle');
    const s = document.getElementById('pageSubtitle');
    if (t) t.textContent = info.title;
    if (s) s.textContent = info.subtitle;
  }

  if (pageKey === 'dashboard') {
    renderDashboard();
    // بعد از visible شدن صفحه، نمودار را دوباره بکش (رفع اندازه صفر)
    requestAnimationFrame(() => requestAnimationFrame(() => renderDashboard()));
  }
  if (pageKey === 'units') {
    buildUnitsBlockFilter();
    renderUnitsStats();
    renderUnitsPage();
  }
  if (pageKey === 'charges') renderChargesPage();
  if (pageKey === 'charges-payments') renderPaymentsPage();
  if (pageKey === 'side-incomes') renderSideIncomesPage();
  if (pageKey === 'expenses') renderExpensesPage();
  if (pageKey === 'notices') renderNoticesPage();
  if (pageKey === 'messages') renderMessagesPage();
  if (pageKey === 'voting') renderVotingPage();
  if (pageKey === 'reports') {
    renderReportsPage();
    requestAnimationFrame(() => requestAnimationFrame(() => renderReportsPage()));
  }
  if (pageKey === 'profit') {
    renderProfitPage();
    requestAnimationFrame(() => requestAnimationFrame(() => renderProfitPage()));
  }
  if (pageKey === 'profile') { fillProfileForm(); }
  if (pageKey === 'settings') renderSettingsPage();
  if (pageKey === 'subscription') renderSubscriptionPage();
  if (pageKey === 'support') renderSupportPage();

  // همیشه نام ساختمان در سایدبار را تازه نگه دار
  renderBuildingCard();
  updateAddUnitButtonState();
}

/* ============ همگام‌سازی زنده با پنل ساکن (تب/پنجره دیگر همین مرورگر) ============ */
(function bindCrossTabSync() {
  if (typeof window === 'undefined' || !window.addEventListener) return;
  let timer = null;
  window.addEventListener('storage', (e) => {
    if (!e.key || !e.key.startsWith('ham_sakhteman_')) return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      try {
        loadUnits();
        const active = document.querySelector('.page.active');
        const key = active ? active.id.replace('page-', '') : 'dashboard';
        // صفحات فرم‌دار را وسط ویرایش رفرش نکن
        if (['settings', 'profile'].includes(key)) return;
        if (document.querySelector('.modal-overlay.open, .modal.open')) return;
        switchPage(key);
        if (typeof refreshNotifications === 'function') refreshNotifications();
      } catch (err) { console.warn('cross-tab sync', err); }
    }, 300);
  });
})();

/* ============ ۷) فیلتر بلوک داشبورد ============ */
let currentBlockFilter = 'all';
let currentStatusFilter = 'all';

function getFilteredUnits(opts) {
  let list = UNITS;
  const ignoreStatus = !!(opts && opts.ignoreStatus);

  if (currentBlockFilter !== 'all' && currentBlockFilter !== '' && currentBlockFilter !== null) {
    const filterName = String(currentBlockFilter).trim();
    list = list.filter(u => String(u.block).trim() === filterName);
  }

  if (ignoreStatus) return list;

  const isRegistered = u => !!((u.owner?.name || u.owner?.registered) || (u.tenant?.name || u.tenant?.registered));
  if (currentStatusFilter === 'debt') {
    list = list.filter(u => Number(u.debt) > 0);
  } else if (currentStatusFilter === 'paid') {
    list = list.filter(u => isRegistered(u) && !(Number(u.debt) > 0));
  } else if (currentStatusFilter === 'empty') {
    list = list.filter(u => !isRegistered(u));
  }

  return list;
}

function buildBlockFilterOptions(building) {
  const select = document.getElementById('blockFilter');
  if (!select) return;

  if (!building || building.type !== 'complex') {
    select.parentElement.style.display = 'none';
    return;
  }

  select.parentElement.style.display = 'flex';
  const savedValue = currentBlockFilter;
  select.innerHTML = '<option value="all">🏢 همه بلوک‌ها</option>';

  building.blocks.forEach(b => {
    const opt = document.createElement('option');
    opt.value = String(b.name).trim();
    opt.textContent = String(b.name).trim();
    select.appendChild(opt);
  });

  select.value = savedValue;
}

function bindBlockFilter() {
  const blockFilter = document.getElementById('blockFilter');
  if (blockFilter) {
    blockFilter.addEventListener('change', (e) => {
      currentBlockFilter = e.target.value;
      renderDashboard();
    });
  }

  const statusFilter = document.getElementById('statusFilter');
  if (statusFilter) {
    statusFilter.addEventListener('change', (e) => {
      currentStatusFilter = e.target.value;
      renderDashboard();
    });
  }
}

/* ============ ۸) کارت‌های آماری داشبورد ============ */
/* saveWizardData قدیمی حذف شد — نسخه صحیح پایین‌تر تعریف شده */

/* ============ ۹) جدول داشبورد ============ */
function renderDashboardUnits() {
  const tbody = document.getElementById('dashboardUnitsBody');
  if (!tbody) return;

  // فقط واحدهایی که حداقل یک ساکن/مالک ثبت‌نام کرده (به جز فیلتر «ثبت‌نام نکرده»)
  const units = currentStatusFilter === 'empty'
    ? getFilteredUnits()
    : getFilteredUnits().filter(u =>
        (u.owner?.name || u.owner?.registered) || (u.tenant?.name || u.tenant?.registered)
      );

  if (units.length === 0 && currentStatusFilter !== 'all') {
    const msg = currentStatusFilter === 'debt' ? 'هیچ واحد بدهکاری نیست. ✅'
      : currentStatusFilter === 'paid' ? 'هنوز واحد تسویه‌شده‌ای نیست.'
      : 'همه واحدها ثبت‌نام کرده‌اند. ✅';
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:#94a3b8;padding:36px;">${msg}</td></tr>`;
    return;
  }

  if (units.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:#94a3b8;padding:36px;">
      هنوز واحدی ثبت نشده است.<br>
      <span style="font-size:12.5px;opacity:0.75;">با ثبت‌نام ساکنین در اپ رزیدنت، واحدها اینجا نمایش داده می‌شوند.</span>
    </td></tr>`;
    return;
  }

  tbody.innerHTML = units.map(u => {
    const ownerName = u.owner?.name ? u.owner.name : '<span style="color:#94a3b8;">—</span>';
    const tenantName = u.tenant?.name ? u.tenant.name : '<span style="color:#94a3b8;">—</span>';
    const phone = u.owner?.phone || u.tenant?.phone || '—';

    // بدهی و وضعیت فقط وقتی مدیر مشخص کرده (نه مقدار پیش‌فرض)
    const hasDebtInfo = u.debt != null && u.debt !== '' && Number(u.debt) > 0;
    const hasSettledInfo = u.debtExplicit === true || (Number(u.chargeAmount) > 0 && Number(u.debt) === 0);
    let debtCell = '—';
    let statusCell = '—';
    if (hasDebtInfo) {
      debtCell = formatToman(u.debt);
      statusCell = '<span class="badge badge-debt">بدهکار</span>';
    } else if (hasSettledInfo) {
      debtCell = '—';
      statusCell = '<span class="badge badge-paid">تسویه</span>';
    }

    return `
      <tr>
        <td><strong>${u.block === '—' ? '—' : u.block}</strong></td>
        <td><strong>${formatNumber(u.number)}</strong></td>
        <td>${ownerName}</td>
        <td>${tenantName}</td>
        <td style="direction:ltr;text-align:right;">${phone}</td>
        <td>${debtCell}</td>
        <td>${statusCell}</td>
      </tr>
    `;
  }).join('');
}

/* ============ ۱۰) نمودار دایره‌ای داشبورد ============ */
function renderDonutChart(paidUnits, debtUnits) {
  const canvas = document.getElementById('donutChart');
  if (!canvas) return;
  const { ctx, W, H } = prepareCanvas(canvas, 180, 180);
  const size = Math.min(W, H);
  const lineWidth = Math.max(12, Math.round(size * 0.1));
  const cx = W / 2, cy = H / 2, radius = size / 2 - lineWidth / 2 - 2;
  const total = paidUnits + debtUnits || 1;
  const paidAngle = (paidUnits / total) * Math.PI * 2;

  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.strokeStyle = '#f1f5f9';
  ctx.lineWidth = lineWidth;
  ctx.stroke();

  if (paidUnits > 0) {
    ctx.beginPath();
    ctx.arc(cx, cy, radius, -Math.PI / 2, -Math.PI / 2 + paidAngle);
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'butt';
    ctx.stroke();
  }

  if (debtUnits > 0) {
    ctx.beginPath();
    ctx.arc(cx, cy, radius, -Math.PI / 2 + paidAngle, -Math.PI / 2 + Math.PI * 2);
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'butt';
    ctx.stroke();
  }
}

/* ============ ۱۱) نمودار خطی ============ */
function getLastSixPersianMonths() {
  const today = getTodayPersian();
  const result = [];
  let m = today.month; // 1-12
  let y = today.year;
  for (let i = 0; i < 6; i++) {
    result.unshift({ month: PERSIAN_MONTHS[m - 1], year: String(y), label: PERSIAN_MONTHS[m - 1] });
    m -= 1;
    if (m < 1) { m = 12; y -= 1; }
  }
  return result;
}

function getIncomeForMonth(monthName, yearStr) {
  const y = String(yearStr);
  const charges = (typeof loadCharges === 'function' ? loadCharges() : []) || [];
  const side = (typeof loadSideIncomes === 'function' ? loadSideIncomes() : []) || [];
  // مبنای نقدی: ماهی که پرداخت واقعاً انجام شده (نه ماه صدور شارژ)
  const fromCharges = charges
    .filter(c => isChargeCollectedIn(c, monthName, y))
    .reduce((s, c) => s + (Number(c.total) || 0), 0);
  const fromSide = side
    .filter(i => i.month === monthName && String(i.year) === y)
    .reduce((s, i) => s + (Number(i.amount) || 0), 0);
  return fromCharges + fromSide;
}


/** اندازه واقعی canvas (با fallback وقتی صفحه تازه visible شده) */
function getCanvasDrawSize(canvas, fallbackW, fallbackH) {
  if (!canvas) return { W: fallbackW || 400, H: fallbackH || 220 };
  const parent = canvas.parentElement;
  let W = 0, H = 0;
  if (parent) {
    const rect = parent.getBoundingClientRect();
    W = rect.width;
    H = rect.height;
  }
  if (!W) W = canvas.clientWidth || canvas.offsetWidth || 0;
  if (!H) H = canvas.clientHeight || canvas.offsetHeight || 0;
  if (!W) W = fallbackW || 400;
  if (!H) H = fallbackH || 220;
  return { W: Math.max(120, Math.floor(W)), H: Math.max(100, Math.floor(H)) };
}

function prepareCanvas(canvas, fallbackW, fallbackH) {
  const ctx = canvas.getContext('2d');
  const { W, H } = getCanvasDrawSize(canvas, fallbackW, fallbackH);
  const dpr = window.devicePixelRatio || 1;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  canvas.width = Math.floor(W * dpr);
  canvas.height = Math.floor(H * dpr);
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, W, H);
  return { ctx, W, H };
}

function renderLineChart() {
  const canvas = document.getElementById('lineChart');
  if (!canvas) return;
  const { ctx, W, H } = prepareCanvas(canvas, 400, 220);

  const lastSix = getLastSixPersianMonths();
  const months = lastSix.map(x => x.label);
  const values = lastSix.map(x => getIncomeForMonth(x.month, x.year));

  const hasData = values.some(v => v > 0);
  const maxVal = Math.max(...values, 1) * 1.15;
  const padding = { top: 20, right: 20, bottom: 40, left: 64 };
  const chartW = W - padding.left - padding.right;
  const chartH = H - padding.top - padding.bottom;

  drawYAxis(ctx, padding, chartW, chartH, hasData ? maxVal : 0);
  if (!hasData) {
    drawEmptyChartText(ctx, W, H, 'هنوز درآمدی در ۶ ماه اخیر ثبت نشده');
  }

  const points = values.map((v, i) => ({
    x: padding.left + (values.length > 1 ? (chartW / (values.length - 1)) * i : chartW / 2),
    y: padding.top + chartH - (v / maxVal) * chartH,
  }));

  const grad = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartH);
  grad.addColorStop(0, 'rgba(91, 76, 219, 0.25)');
  grad.addColorStop(1, 'rgba(91, 76, 219, 0)');

  ctx.beginPath();
  ctx.moveTo(points[0].x, padding.top + chartH);
  points.forEach(p => ctx.lineTo(p.x, p.y));
  ctx.lineTo(points[points.length - 1].x, padding.top + chartH);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.beginPath();
  points.forEach((p, i) => {
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  });
  ctx.strokeStyle = '#5b4cdb';
  ctx.lineWidth = 3;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke();

  points.forEach(p => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#5b4cdb';
    ctx.lineWidth = 3;
    ctx.stroke();
  });

  ctx.fillStyle = '#64748b';
  ctx.font = '12px Vazirmatn, Tahoma';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  months.forEach((m, i) => {
    if (points[i]) {
      ctx.fillText(m, points[i].x, padding.top + chartH + 12);
    }
  });
}
function renderStats() {
  const data = loadData();
  if (!data || !data.building) return { paidUnits: 0, debtUnits: 0, unitsCount: 0 };

  const building = data.building;

  // واحد از قبل ساخته نمی‌شود — کاربر خودش اضافه می‌کند
  // if (!Array.isArray(UNITS) || UNITS.length === 0) {
  //   buildDemoUnits(building);
  // }

  // آمار و نمودار فقط با فیلتر بلوک (فیلتر وضعیت فقط روی جدول اثر دارد)
  const units = getFilteredUnits({ ignoreStatus: true }).filter(u =>
    (u.owner?.name || u.owner?.registered) || (u.tenant?.name || u.tenant?.registered)
  );

  // سقف واحدها از ثبت‌نام ساختمان؛ آمار پرداخت فقط روی واحدهای ثبت‌شده
  const capacityUnits = Number(building.totalUnits) || getExpectedUnitsCount(building) || units.length;
  const unitsCount = capacityUnits;
  // بدهکار = بدهی مثبت | تسویه‌شده = بدهی صفر و توسط مدیر مشخص شده
  const debtUnits = units.filter(u => Number(u.debt) > 0).length;
  const paidUnits = units.filter(u =>
    Number(u.debt) === 0 && (u.debtExplicit === true || Number(u.chargeAmount) > 0)
  ).length;

  const currentMonth = getTodayPersianMonth();
  const currentYear = String(getTodayPersianYear());

  const allCharges = (typeof loadCharges === 'function' ? loadCharges() : []) || [];
  // وصولی واقعی همین ماه (شامل پرداخت بدهی ماه‌های قبل)
  const chargesIncome = allCharges
    .filter(c => isChargeCollectedIn(c, currentMonth, currentYear))
    .reduce((s, c) => s + (Number(c.total) || 0), 0);

  const allSideIncomes = (typeof loadSideIncomes === 'function' ? loadSideIncomes() : []) || [];
  const sideIncomeSum = allSideIncomes
    .filter(i => i.month === currentMonth && String(i.year) === currentYear)
    .reduce((s, i) => s + (Number(i.amount) || 0), 0);

  const income = chargesIncome + sideIncomeSum;

  const expensesThisMonth = (typeof loadExpenses === 'function' ? loadExpenses() : [])
    .filter(e => e.month === currentMonth && String(e.year) === currentYear);
  const expense = expensesThisMonth.reduce((s, e) => s + (Number(e.amount) || 0), 0);

  // ✅ «مانده کل در صندوق» = موجودی واقعی (اولیه + همه وصولی‌ها + جانبی − همه هزینه‌ها)
  // قبلاً فقط درآمد منهای هزینه همین ماه نمایش داده می‌شد
  const balance = getFundBalance();

  let blocksCount = 1;
  if (building.type === 'complex' && Array.isArray(building.blocks)) {
    blocksCount = building.blocks.length;
  }

  const elUnits   = document.getElementById('statUnits');
  const elIncome  = document.getElementById('statIncome');
  const elDebtors = document.getElementById('statDebtors');
  const elExpense = document.getElementById('statExpense');
  const elBlocks  = document.getElementById('statBlocks');
  const elBalance = document.getElementById('statBalance');

  if (elUnits)   elUnits.textContent   = formatNumber(unitsCount);
  if (elIncome)  elIncome.textContent  = formatToman(income);
  if (elDebtors) elDebtors.textContent = formatNumber(debtUnits);
  if (elExpense) elExpense.textContent = formatToman(expense);
  if (elBlocks)  elBlocks.textContent  = formatNumber(blocksCount);
  if (elBalance) elBalance.textContent = (balance < 0 ? '−' : '') + formatToman(Math.abs(balance));

  // درصد پرداخت = تسویه‌شده / (تسویه‌شده + بدهکار)
  const classified = paidUnits + debtUnits;
  const paidPercent = classified > 0
    ? Math.round((paidUnits / classified) * 100)
    : 0;
  const elP = document.getElementById('donutPercent');
  if (elP) elP.textContent = formatNumber(paidPercent) + '٪';

  return { paidUnits, debtUnits, unitsCount };
}
/* ============ ۱۲) رندر داشبورد ============ */
function renderDashboard() {
  const data = loadData();
  if (!data || !data.building) return;

  // دیگر واحد خالی از قبل ساخته نمی‌شود — کاربر خودش اضافه می‌کند
  // if (UNITS.length === 0) buildDemoUnits(data.building);

  const select = document.getElementById('blockFilter');
  if (select && select.options.length <= 1) {
    buildBlockFilterOptions(data.building);
  }

  refreshUnitsDebtIfStale();
  const { paidUnits, debtUnits } = renderStats();
  renderDashboardUnits();
  renderDonutChart(paidUnits, debtUnits);
  renderLineChart();
  updateAddUnitButtonState();
}

/* ============ ۱۳) مودال Wizard ============ */
let wizardStep = 1;
let selectedBuildingType = null;
let blockNames = [];
let selectedPlanType = null;
let wizardAuthData = { name: '', phone: '', password: '' };
let wizardBuildingName = '';
let wizardSingleUnits = 0;

function openWelcomeModal() {
  wizardStep = 1;
  selectedBuildingType = null;
  blockNames = [];
  selectedPlanType = null;
  wizardBuildingName = '';
  wizardSingleUnits = 0;
  updateWizardUI();
  document.getElementById('welcomeModal').classList.add('open');
}
function closeWelcomeModal() {
  document.getElementById('welcomeModal').classList.remove('open');
}
function updateWizardUI() {
  document.querySelectorAll('.wizard-page').forEach(p => {
    p.classList.toggle('active', Number(p.dataset.page) === wizardStep);
  });

  document.querySelectorAll('.wizard-step').forEach(s => {
    const n = Number(s.dataset.step);
    s.classList.toggle('active', n === wizardStep);
    s.classList.toggle('completed', n < wizardStep);
  });

  const prev = document.getElementById('wizardPrevBtn');
  const next = document.getElementById('wizardNextBtn');
  const mainActions = document.getElementById('wizardActionsMain');
  const step4Actions = document.getElementById('wizardActionsStep4');

  if (wizardStep < 4) {
    if (mainActions) mainActions.style.display = 'flex';
    if (step4Actions) step4Actions.style.display = 'none';
    if (prev) prev.style.display = wizardStep > 1 ? 'block' : 'none';
    if (next) {
      next.style.display = 'block';
      next.textContent = wizardStep < 3 ? 'بعدی ←' : 'ادامه ←';
    }
  } else {
    if (mainActions) mainActions.style.display = 'none';
    if (step4Actions) step4Actions.style.display = 'flex';
  }

  if (wizardStep === 3) {
    const cf = document.getElementById('complexForm');
    const sf = document.getElementById('singleForm');
    if (cf) cf.style.display = selectedBuildingType === 'complex' ? 'block' : 'none';
    if (sf) sf.style.display = selectedBuildingType === 'single' ? 'block' : 'none';
    if (selectedBuildingType === 'complex') buildBlockInputs();
  }

  if (wizardStep === 4) {
    updatePlanPage();
  }
}

function updatePlanPage() {
  const bn = (wizardBuildingName || document.getElementById('buildingNameInput')?.value || '').trim() || '—';

  let totalUnits = 0;
  let blocksCount = 1;

  if (selectedBuildingType === 'complex') {
    blocksCount = blockNames.length;
    totalUnits = blockNames.reduce((s, b) => s + (parseInt(b.units) || 0), 0);
  } else {
    totalUnits = wizardSingleUnits || parseInt(document.getElementById('singleUnitsCount')?.value) || 0;
  }

  const elBuilding = document.getElementById('planSummaryBuilding');
  const elUnits = document.getElementById('planSummaryUnits');
  const elBlocks = document.getElementById('planSummaryBlocks');

  if (elBuilding) elBuilding.textContent = bn;
  if (elUnits) elUnits.textContent = toPersianNum(totalUnits) + ' واحد';
  if (elBlocks) elBlocks.textContent = selectedBuildingType === 'complex'
    ? toPersianNum(blocksCount) + ' بلوک'
    : 'تک‌بلوک';

  const result = calculatePrice(totalUnits);

  const elProPrice = document.getElementById('planProPrice');
  if (elProPrice) {
    const displayPrice = result.price > 0 ? result.price : (10 * 100000);
    elProPrice.textContent = (displayPrice / 1000000).toFixed(1).replace('.0', '');
  }

  window._calculatedPrice = result;
}

function buildBlockInputs() {
  const count = parseInt(document.getElementById('blocksCount')?.value) || 0;
  const newList = [];
  for (let i = 0; i < count; i++) {
    newList.push({
      name: blockNames[i]?.name || `بلوک ${toPersianNum(i + 1)}`,
      units: blockNames[i]?.units || 5,
    });
  }
  blockNames = newList;
  renderBlockInputs();
}

function renderBlockInputs() {
  const container = document.getElementById('blockNamesContainer');
  if (!container) return;
  if (blockNames.length === 0) { container.innerHTML = ''; return; }

  container.innerHTML = blockNames.map((b, i) => `
    <div class="block-row">
      <span class="block-index">${toPersianNum(i + 1)}.</span>
      <input type="text" class="form-input block-name-input"
             data-index="${i}" placeholder="اسم بلوک (A, B, مینا, سینا)" value="${b.name}" />
      <input type="number" class="form-input units-input"
             data-index="${i}" placeholder="واحد" min="1" value="${b.units}" dir="ltr" />
    </div>
  `).join('');

  container.querySelectorAll('.block-name-input').forEach(inp => {
    inp.addEventListener('input', (e) => {
      blockNames[Number(e.target.dataset.index)].name = e.target.value;
    });
  });
  container.querySelectorAll('.units-input').forEach(inp => {
    inp.addEventListener('input', (e) => {
      blockNames[Number(e.target.dataset.index)].units = parseInt(e.target.value) || 0;
    });
  });
}

function wizardValidateStep(step) {
  document.querySelectorAll('.form-input').forEach(el => {
    el.classList.remove('input-error', 'input-success');
  });
  document.querySelectorAll('.error-message').forEach(el => {
    el.classList.remove('show');
  });

  if (step === 1) {
    const n = document.getElementById('managerName')?.value.trim();
    const p = document.getElementById('managerPhone')?.value.trim();
    const pass = document.getElementById('managerPassword')?.value || '';
    const passConfirm = document.getElementById('managerPasswordConfirm')?.value || '';

    if (!n) { showFieldError('managerName', 'لطفاً نام و نام خانوادگی را وارد کنید.'); return false; }
    if (n.length < 3) { showFieldError('managerName', 'نام باید حداقل ۳ کاراکتر باشد.'); return false; }
   

if (!p) {
  showFieldError('managerPhone', 'لطفاً شماره تماس را وارد کنید.');
  return false;
}

if (!isValidIranMobile(p)) {
  showFieldError('managerPhone', 'شماره موبایل باید ۱۱ رقم و با ۰۹ شروع شود.');
  return false;
}

const savedPhone = localStorage.getItem('ham_sakhteman_user_phone');

if (
  savedPhone &&
  typeof normalizePhone === 'function' &&
  normalizePhone(p) === normalizePhone(savedPhone)
) {
  showFieldError(
    'managerPhone',
    'این شماره قبلاً ثبت‌نام کرده است.'
  );

  const phoneInput = document.getElementById('managerPhone');
  const errorEl = phoneInput?.parentElement.querySelector('.error-message');

  if (errorEl) {
    errorEl.textContent = '';

    const message = document.createElement('span');
    message.textContent = 'این شماره قبلاً ثبت‌نام کرده است. ';

    const loginLink = document.createElement('a');
    loginLink.href = 'login.html';
    loginLink.textContent = 'ورود به حساب کاربری';
    loginLink.style.cssText =
      'color:#4f46e5;font-weight:700;text-decoration:underline;';

    errorEl.append(message, loginLink);
    errorEl.classList.add('show');
  }

  return false;
}


// فقط اگر شماره واردشده با شماره حساب قبلی یکسان است، رد شود.
const existingPhone = localStorage.getItem('ham_sakhteman_user_phone');



    if (!pass) { showFieldError('managerPassword', 'لطفاً رمز عبور را وارد کنید.'); return false; }
    if (pass.length < 6) { showFieldError('managerPassword', 'رمز عبور باید حداقل ۶ کاراکتر باشد.'); return false; }
    if (!passConfirm) { showFieldError('managerPasswordConfirm', 'لطفاً تکرار رمز عبور را وارد کنید.'); return false; }
    if (pass !== passConfirm) { showFieldError('managerPasswordConfirm', 'رمز عبور و تکرار آن یکسان نیستند.'); return false; }

    wizardAuthData = { name: n, phone: p, password: pass };
    return true;
  }

  if (step === 2) {
    const bn = document.getElementById('buildingNameInput')?.value.trim();
    if (!bn) { toastWarning('نام ساختمان را وارد کنید.'); return false; }
    if (!selectedBuildingType) { toastWarning('نوع را انتخاب کنید.'); return false; }
    wizardBuildingName = bn;
    return true;
  }

  if (step === 3) {
    if (selectedBuildingType === 'complex') {
      const b = parseInt(document.getElementById('blocksCount')?.value);
      if (!b || b < 1) { toastWarning('تعداد بلوک‌ها را وارد کنید.'); return false; }
      for (let i = 0; i < blockNames.length; i++) {
        if (!blockNames[i].name || !blockNames[i].name.trim()) {
          toastWarning(`اسم بلوک ${toPersianNum(i + 1)} را وارد کنید.`);
          return false;
        }
        const u = parseInt(blockNames[i].units) || 0;
        if (u < 1) {
          toastWarning(`تعداد واحدهای بلوک «${blockNames[i].name}» را وارد کنید.`);
          return false;
        }
      }
    } else {
      const u = parseInt(document.getElementById('singleUnitsCount')?.value);
      if (!u || u < 1) { toastWarning('تعداد واحدها را وارد کنید.'); return false; }
      wizardSingleUnits = u;
    }
    return true;
  }

  return true;
}

function showFieldError(inputId, message) {
  const input = document.getElementById(inputId);
  if (!input) return;
  input.classList.add('input-error');
  let errEl = input.parentElement.querySelector('.error-message');
  if (errEl) {
    errEl.textContent = message;
    errEl.classList.add('show');
  } else {
    toastWarning(message);
  }
  input.focus();
}

function wizardNext() {
  if (!wizardValidateStep(wizardStep)) return;
  if (wizardStep < 4) {
    wizardStep++;
    updateWizardUI();
  }
}

function wizardPrev() {
  if (wizardStep > 1) { wizardStep--; updateWizardUI(); }
}

/* ============================================================
   💎 انتخاب پلن
   ============================================================ */
function selectPlan(planType) {
  selectedPlanType = planType;

  document.querySelectorAll('.plan-card').forEach(card => {
    card.classList.toggle('selected', card.dataset.plan === planType);
  });

  if (planType === 'free') {
    confirmFreePlan();
  } else if (planType === 'pro') {
    confirmProPlan();
  }
}
function getTotalUnitsFromWizard() {
  if (selectedBuildingType === 'complex') {
    return blockNames.reduce(
      (sum, b) => sum + (parseInt(b.units) || 0),
      0
    );
  }
  return wizardSingleUnits || parseInt(document.getElementById('singleUnitsCount')?.value, 10) || 0;
}

function confirmFreePlan() {
  const totalUnits = getTotalUnitsFromWizard();

  // ✅ اول اطلاعات کاربر و ساختمان ذخیره شود (تا user_phone ست شود)
  saveWizardData();

  // ✅ بعد پلن فعال شود (که getPlanKey بتواند شماره را ببیند)
  activatePlan('free', totalUnits, {
    amount: 0,
    status: 'free',
    paidAt: new Date().toISOString(),
  });

  showSuccessPage({
    planName: 'رایگان',
    planIcon: '🆓',
    amount: 0,
    refId: 'FREE-' + Date.now(),
    isPaid: false,
  });
}

function showMockPaymentPage(paymentInfo) {
  const isUpgrade = paymentInfo.isUpgrade === true;

  if (isUpgrade) {
    showMockPaymentModal(paymentInfo);
    return;
  }

  const modal = document.getElementById('welcomeModal');
  const container = modal.querySelector('.modal-welcome');

  container.innerHTML = `
    <div class="mock-payment-box">
      <div class="mock-payment-header">
        <div class="mock-payment-icon">🏦</div>
        <h2>درگاه پرداخت آزمایشی</h2>
        <p>این یک درگاه آزمایشی است. درگاه واقعی زرین‌پال به‌زودی فعال می‌شود.</p>
      </div>

      <div class="mock-payment-info">
        <div class="success-info-row">
          <span>مبلغ قابل پرداخت:</span>
          <strong style="color:#5b4cdb; font-size:16px;">${formatPrice(paymentInfo.amount)}</strong>
        </div>
        <div class="success-info-row">
          <span>کد سفارش:</span>
          <strong style="direction:ltr; text-align:left; font-family:monospace; font-size:11.5px;">${paymentInfo.orderId}</strong>
        </div>
        <div class="success-info-row">
          <span>تعداد واحدها:</span>
          <strong>${toPersianNum(paymentInfo.totalUnits)} واحد</strong>
        </div>
      </div>

      <div class="mock-payment-notice">
        ⚠️ <strong>توجه:</strong> این درگاه فقط برای تست است. با کلیک روی «پرداخت»، مبلغ کسر نمی‌شود.
      </div>

      <div class="wizard-actions" style="margin-top:20px;">
        <button class="btn btn-cancel" id="mockCancelBtn">❌ انصراف</button>
        <button class="btn btn-primary" id="mockPayBtn" style="flex:1;">✅ پرداخت آزمایشی</button>
      </div>
    </div>
  `;

  document.getElementById('mockCancelBtn')?.addEventListener('click', () => {
    wizardStep = 4;
    openWelcomeModal();
  });

  document.getElementById('mockPayBtn')?.addEventListener('click', () => {
    processMockPaymentSuccess(paymentInfo);
  });
}

/* ============================================================
   🔒 محدودیت پلن رایگان
   ============================================================ */
// ✅ پلن رایگان: همه صفحات فعال
const LOCKED_PAGES_FOR_FREE = [];

function isProPlan() {
  const plan = loadPlan();
  if (!plan) return false;
  if (plan.type !== 'pro') return false;
  if (plan.expiresAt && new Date(plan.expiresAt) < new Date()) {
    return false;
  }
  return true;
}

function isPageLocked(pageKey) {
  if (isProPlan()) return false;
  return LOCKED_PAGES_FOR_FREE.includes(pageKey);
}

function updateSidebarLockStates() {
  const isPro = isProPlan();

  document.querySelectorAll('#menu li[data-page]').forEach(li => {
    const page = li.dataset.page;
    const isLocked = !isPro && LOCKED_PAGES_FOR_FREE.includes(page);
    li.classList.toggle('locked', isLocked);
  });

  document.querySelectorAll('#menu .submenu li').forEach(li => {
    const page = li.dataset.page;
    const isLocked = !isPro && LOCKED_PAGES_FOR_FREE.includes(page);
    li.classList.toggle('locked', isLocked);
  });

  const upgradeBox = document.getElementById('upgradeBox');
  if (upgradeBox) {
    upgradeBox.classList.toggle('hidden', isPro);
  }
}

async function showUpgradeModal(pageKey = null) {
  const plan = loadPlan();
  const totalUnits = plan?.totalUnits || 0;

  let price = 0;
  let priceBreakdown = '';

  if (totalUnits > 0) {
    const result = calculatePrice(totalUnits);
    price = result.price;
    priceBreakdown = result.breakdown;

       if (price === 0) {
      price = 4 * 100000;
      priceBreakdown = `قیمت پایه (${toPersianNum(4)} واحد × ۱۰۰,۰۰۰ تومان)`;
    }
  }

  const modal = document.getElementById('upgradeModal');
  if (modal) {
    const elUnits = document.getElementById('upgradeModalUnits');
    const elPrice = document.getElementById('upgradeModalPrice');
    const elBreakdown = document.getElementById('upgradeModalBreakdown');

    if (elUnits) elUnits.textContent = toPersianNum(totalUnits) + ' واحد';
    if (elPrice) elPrice.textContent = formatPrice(price);
    if (elBreakdown) elBreakdown.textContent = priceBreakdown;

    modal.classList.add('open');
  } else {
    const msg = '🔒 این بخش برای پلن حرفه‌ای است.\n\n' +
                'برای دسترسی به همه امکانات، پلن خود را ارتقا دهید.\n\n' +
                (price > 0 ? `💰 قیمت: ${formatPrice(price)}\n\n` : '') +
                'آیا می‌خواهید الان ارتقا دهید؟';

    if ((await appConfirm(msg))) {
      handleUpgrade();
    }
  }
}

function handleUpgrade() {
  const plan = loadPlan();
  const totalUnits = plan?.totalUnits || 0;

  let price = 0;

  if (totalUnits > 0) {
    const result = calculatePrice(totalUnits);
    price = result.price;
    if (price === 0) {
      price = 4 * 100000;
    }
  }

  const paymentInfo = {
    planType: 'pro',
    totalUnits: totalUnits,
    amount: price,
    orderId: 'UPG-' + Date.now(),
    isUpgrade: true,
  };

  closeUpgradeModal();
  showMockPaymentPage(paymentInfo);
}

function showMockPaymentModal(paymentInfo) {
  const modal = document.getElementById('upgradeModal');
  const container = modal.querySelector('.modal');

  const originalHTML = container.innerHTML;

  container.innerHTML = `
    <div class="unit-modal-header">
      <div class="unit-modal-icon">🏦</div>
      <div>
        <h2>درگاه پرداخت آزمایشی</h2>
        <p>درگاه واقعی زرین‌پال به‌زودی فعال می‌شود</p>
      </div>
    </div>

    <div class="mock-payment-info">
      <div class="success-info-row">
        <span>مبلغ قابل پرداخت:</span>
        <strong style="color:#5b4cdb; font-size:16px;">${formatPrice(paymentInfo.amount)}</strong>
      </div>
      <div class="success-info-row">
        <span>کد سفارش:</span>
        <strong style="direction:ltr; text-align:left; font-family:monospace; font-size:11.5px;">${paymentInfo.orderId}</strong>
      </div>
      <div class="success-info-row">
        <span>تعداد واحدها:</span>
        <strong>${toPersianNum(paymentInfo.totalUnits)} واحد</strong>
      </div>
    </div>

    <div class="mock-payment-notice">
      ⚠️ <strong>توجه:</strong> این درگاه فقط برای تست است.
    </div>

    <div class="unit-modal-actions" style="margin-top:20px;">
      <button class="btn btn-cancel" id="mockUpgradeCancelBtn">❌ انصراف</button>
      <button class="btn btn-primary" id="mockUpgradePayBtn" style="flex:1;">✅ پرداخت آزمایشی</button>
    </div>
  `;

  document.getElementById('mockUpgradeCancelBtn')?.addEventListener('click', () => {
    container.innerHTML = originalHTML;
    bindUpgradeModal();
  });

  document.getElementById('mockUpgradePayBtn')?.addEventListener('click', () => {
    processMockPaymentSuccess(paymentInfo);
    closeUpgradeModal();
  });
}

async function confirmProPlan() {
  const totalUnits = getTotalUnitsFromWizard();
  const result = calculatePrice(totalUnits);

  let finalPrice = result.price;

  if (finalPrice === 0) {
    finalPrice = 4 * 100000;

    if (!(await appConfirm(
      `💎 پلن حرفه‌ای\n\n` +
      `ساختمان شما ${toPersianNum(totalUnits)} واحد دارد.\n` +
      `(پلن رایگان برای این ساختمان کافی است)\n\n` +
      `💰 قیمت پلن حرفه‌ای: ${formatPrice(finalPrice)}\n\n` +
      `آیا می‌خواهید پلن حرفه‌ای را خریداری کنید؟`
    ))) {
      return;
    }
  }

  window._pendingPayment = {
    planType: 'pro',
    totalUnits: totalUnits,
    amount: finalPrice,
    orderId: 'ORD-' + Date.now(),
  };

  showMockPaymentPage(window._pendingPayment);
}

function getTotalUnitsFromWizard() {
  if (selectedBuildingType === 'complex') {
    return blockNames.reduce((s, b) => s + (parseInt(b.units) || 0), 0);
  }
  return wizardSingleUnits || parseInt(document.getElementById('singleUnitsCount')?.value) || 0;
}

function saveWizardData() {
  const mn = wizardAuthData.name || document.getElementById('managerName')?.value.trim() || '';
 let mp = wizardAuthData.phone
  || document.getElementById('managerPhone')?.value.trim()
  || (JSON.parse(localStorage.getItem('ham_sakhteman_auth') || '{}').phone || '')
  || '';
  const password = wizardAuthData.password || document.getElementById('managerPassword')?.value || '';
  const bn = (wizardBuildingName || document.getElementById('buildingNameInput')?.value || '').trim();

  // نرمال‌سازی شماره موبایل قبل از ذخیره (برای کلید ذخیره‌سازی یکسان)
  if (typeof normalizePhone === 'function' && mp) {
    mp = normalizePhone(mp);
  }

  let blocks = [];
  let totalUnits = 0;

  if (selectedBuildingType === 'complex') {
    blockNames.forEach((b) => {
      blocks.push({
        name: b.name.trim(),
        units: parseInt(b.units) || 5,
      });
      totalUnits += (parseInt(b.units) || 5);
    });
  } else {
    totalUnits = wizardSingleUnits || parseInt(document.getElementById('singleUnitsCount')?.value) || 0;
  }

  const code = generateBuildingCode(selectedBuildingType, totalUnits);

  const building = {
    name: bn || 'ساختمان بدون نام',
    type: selectedBuildingType,
    code: code,
    blocks: blocks,
    totalUnits: totalUnits,
    createdAt: new Date().toISOString(),
  };

  currentBlockFilter = 'all';
  currentStatusFilter = 'all';

  // اول احراز هویت (تنظیم شماره در localStorage) تا کلید ذخیره‌سازی درست شود
  if (typeof saveUserAuth === 'function' && mp && password) {
    saveUserAuth(mp, password);
  }

  saveData({
    building,
    manager: { name: mn, phone: mp }
  });

  localStorage.removeItem('ham_sakhteman_logged_out');

  UNITS = [];
  saveUnits();

  // پاک کردن همه داده‌های قبلی برای شروع تمیز کاربر جدید
  const keysToClear = [
    'ham_sakhteman_charges',
    'ham_sakhteman_expenses',
    'ham_sakhteman_side_incomes',
    'ham_sakhteman_notices',
    'ham_sakhteman_messages',
    'ham_sakhteman_votings',
    'ham_sakhteman_settings',
    'ham_sakhteman_plan',
    'ham_sakhteman_profile',
  ];
  keysToClear.forEach(k => {
    try {
      localStorage.removeItem(getAccountStorageKey(k));
      // کلیدهای قدیمی بدون scope هم پاک شوند
      localStorage.removeItem(k);
    } catch (e) {}
  });
  try {
    localStorage.removeItem('ham_sakhteman_notifications');
  } catch (e) {}

  // کاربر جدید: لیست واحدها خالی می‌ماند تا خودش اضافه کند (تا سقف تعداد ثبت‌شده)

  renderBuildingCard();
  buildBlockFilterOptions(building);
  updateAddUnitButtonState();
}

function bindPlanSelection() {
  document.querySelectorAll('[data-plan-select]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const planType = btn.dataset.planSelect;
      selectPlan(planType);
    });
  });

  document.querySelectorAll('.plan-card').forEach(card => {
    card.addEventListener('click', () => {
      selectPlan(card.dataset.plan);
    });
  });

  document.getElementById('wizardPrevBtn4')?.addEventListener('click', () => {
    wizardStep = 3;
    updateWizardUI();
  });
}

/* ============================================================
   ✅ صفحه موفقیت
   ============================================================ */
function showSuccessPage(info) {
  const modal = document.getElementById('welcomeModal');
  const container = modal.querySelector('.modal-welcome');

  container.innerHTML = `
    <div class="success-box">
      <div class="success-icon">🎉</div>
      <h2>تبریک! ساختمان شما با موفقیت ثبت شد</h2>
      <p>اکنون می‌توانید وارد پنل مدیریت شوید.</p>

      <div class="success-info">
        <div class="success-info-row">
          <span>🏢 ساختمان:</span>
          <strong>${wizardBuildingName || document.getElementById('buildingNameInput')?.value || '—'}</strong>
        </div>
        <div class="success-info-row">
          <span>💎 پلن شما:</span>
          <strong>${info.planIcon} ${info.planName}</strong>
        </div>
        <div class="success-info-row">
          <span>💰 مبلغ پرداخت:</span>
          <strong>${info.amount > 0 ? formatPrice(info.amount) : 'رایگان'}</strong>
        </div>
        <div class="success-info-row">
          <span>🎫 کد پیگیری:</span>
          <strong style="direction:ltr; text-align:left; font-family:monospace; font-size:11.5px;">${info.refId}</strong>
        </div>
      </div>

      <button class="btn btn-primary btn-block" id="btnEnterPanel" style="margin-top:20px;">
        🚀 ورود به پنل مدیریت
      </button>
    </div>
  `;

  document.getElementById('btnEnterPanel')?.addEventListener('click', () => {
    window.history.replaceState({}, document.title, window.location.pathname);
    closeWelcomeModal();

    renderBuildingCard();
    const d = loadData();
    if (d?.building) {
      buildBlockFilterOptions(d.building);
      // واحد از قبل ساخته نمی‌شود
    }
    renderDashboard();
    updateAddUnitButtonState();
    updateSidebarLockStates();

    setTimeout(() => {
      window.location.href = window.location.pathname;
    }, 100);
  });
}

function selectBuildingType(type) {
  selectedBuildingType = type;
  document.querySelectorAll('.type-option').forEach(el => {
    el.classList.toggle('selected', el.dataset.type === type);
  });
}

function saveWelcomeChoice() {
  saveWizardData();
  closeWelcomeModal();
  renderDashboard();
  toastSuccess('ثبت شد. کد: ' + (loadData()?.building?.code || '—'));
}

function bindWelcomeModal() {
  document.querySelectorAll('.type-option').forEach(el => {
    el.addEventListener('click', () => selectBuildingType(el.dataset.type));
  });
  document.getElementById('wizardNextBtn')?.addEventListener('click', wizardNext);
  document.getElementById('wizardPrevBtn')?.addEventListener('click', wizardPrev);
  document.getElementById('blocksCount')?.addEventListener('input', buildBlockInputs);

  document.querySelectorAll('[data-toggle-pass]').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = document.getElementById(btn.dataset.togglePass);
      if (!input) return;
      if (input.type === 'password') {
        input.type = 'text';
        btn.textContent = '🙈';
      } else {
        input.type = 'password';
        btn.textContent = '👁️';
      }
    });
  });

  bindPlanSelection();
}

/* ============ ۱۴) صفحه واحدها ============ */
let unitsPageFilter = 'all';
let unitsOccupancyFilter = 'all';
let unitsSortColumn = null;
let unitsSortDirection = 'asc';
let unitsSearchQuery = '';

function getUnitsPageFiltered() {
  let list = UNITS;

  if (unitsPageFilter !== 'all' && unitsPageFilter !== '') {
    const filterName = String(unitsPageFilter).trim();
    list = list.filter(u => String(u.block).trim() === filterName);
  }

  // ✅ فیلتر مشغول
  if (unitsOccupancyFilter === 'occupied') {
    list = list.filter(u => !isUnitEmpty(u));
  } else if (unitsOccupancyFilter === 'empty') {
    list = list.filter(u => isUnitEmpty(u));
  }

  if (unitsSearchQuery.trim() !== '') {
    const q = unitsSearchQuery.trim().toLowerCase();
    list = list.filter(u => {
      const ownerName = (u.owner?.name || '').toLowerCase();
      const tenantName = (u.tenant?.name || '').toLowerCase();
      const ownerPhone = (u.owner?.phone || '').toLowerCase();
      const code = (u.code || '').toLowerCase();
      const number = String(u.number);
      const block = (u.block || '').toLowerCase();

      return (
        ownerName.includes(q) ||
        tenantName.includes(q) ||
        ownerPhone.includes(q) ||
        code.includes(q) ||
        number.includes(q) ||
        block.includes(q)
      );
    });
  }

    // اگر کاربر مرتب‌سازی دستی نکرده، به صورت پیش‌فرض بر اساس بلوک و شماره واحد مرتب کن
  if (unitsSortColumn) {
    list = [...list].sort((a, b) => {
      let valA, valB;

      switch (unitsSortColumn) {
        case 'block':
          valA = String(a.block || '').trim();
          valB = String(b.block || '').trim();
          break;
        case 'number':
          valA = Number(a.number) || 0;
          valB = Number(b.number) || 0;
          break;
        case 'owner':
          valA = String(a.owner?.name || '').trim();
          valB = String(b.owner?.name || '').trim();
          break;
        case 'tenant':
          valA = String(a.tenant?.name || '').trim();
          valB = String(b.tenant?.name || '').trim();
          break;
        case 'phone':
          valA = String(a.owner?.phone || '').trim();
          valB = String(b.owner?.phone || '').trim();
          break;
        case 'area':
          valA = Number(a.area) || 0;
          valB = Number(b.area) || 0;
          break;
        case 'people':
          valA = Number(a.peopleCount) || 0;
          valB = Number(b.peopleCount) || 0;
          break;
        case 'parking':
          valA = Number(a.parkingCount) || 0;
          valB = Number(b.parkingCount) || 0;
          break;
        case 'occupancy':
          valA = isUnitEmpty(a) ? 0 : 1;
          valB = isUnitEmpty(b) ? 0 : 1;
          break;
        case 'debt':
          valA = Number(a.debt) || 0;
          valB = Number(b.debt) || 0;
          break;
        default:
          return 0;
      }

      let result;
      if (typeof valA === 'number' && typeof valB === 'number') {
        result = valA - valB;
      } else {
        result = String(valA).localeCompare(String(valB), 'fa');
      }

      return unitsSortDirection === 'asc' ? result : -result;
    });
  } else {
    // ✅ مرتب‌سازی پیش‌فرض: اول بلوک، بعد شماره واحد
    list = [...list].sort((a, b) => {
      const blockA = String(a.block || '').trim();
      const blockB = String(b.block || '').trim();
      const blockCompare = blockA.localeCompare(blockB, 'fa');

      if (blockCompare !== 0) return blockCompare;

      return (Number(a.number) || 0) - (Number(b.number) || 0);
    });
  }

  return list;
}
function buildUnitsBlockFilter() {
  const data = loadData();
  const select = document.getElementById('unitsBlockFilter');
  if (!select || !data?.building) return;

  if (data.building.type !== 'complex') {
    select.parentElement.style.display = 'none';
    return;
  }

  select.parentElement.style.display = 'flex';
  select.innerHTML = '<option value="all">🏢 همه بلوک‌ها</option>';

  data.building.blocks.forEach(b => {
    const opt = document.createElement('option');
    opt.value = String(b.name).trim();
    opt.textContent = String(b.name).trim();
    select.appendChild(opt);
  });

  select.value = unitsPageFilter;
}

function renderUnitsStats() {
  const allUnits = getUnitsPageFiltered();
  const data = loadData();
  const building = data?.building;

  // تعداد کل واحدها و بلوک‌ها از ثبت‌نام (نه از لیست فعلی)
  const registeredTotal = building
    ? (Number(building.totalUnits) || getExpectedUnitsCount(building) || 0)
    : 0;
  const blocksCount = (building?.type === 'complex' && Array.isArray(building.blocks))
    ? building.blocks.length
    : (building ? 1 : 0);

  const empty = allUnits.filter(u => !u.owner?.name).length;
  const withOwner = allUnits.filter(u => u.owner?.name);
  const paid = withOwner.filter(u => Number(u.debt) === 0).length;
  const debt = withOwner.filter(u => Number(u.debt) > 0).length;
  const totalDebt = allUnits.reduce((sum, u) => sum + (Number(u.debt) || 0), 0);

  const elTotal = document.getElementById('unitsTotal');
  const elPaid  = document.getElementById('unitsPaid');
  const elDebt  = document.getElementById('unitsDebt');
  const elEmpty = document.getElementById('unitsEmpty');
  const elTotalDebt = document.getElementById('unitsTotalDebt');
  const elBlocks = document.getElementById('unitsBlocks'); // اگر وجود داشته باشد

  if (elTotal) elTotal.textContent = formatNumber(registeredTotal);
  if (elPaid)  elPaid.textContent  = formatNumber(paid);
  if (elDebt)  elDebt.textContent  = formatNumber(debt);
  if (elEmpty) elEmpty.textContent = formatNumber(empty);
  if (elTotalDebt) elTotalDebt.textContent = formatToman(totalDebt);
  if (elBlocks) elBlocks.textContent = formatNumber(blocksCount);
}

/* ============================================================
   👥 تأیید ثبت‌نام ساکنین (اتصال پنل ساکن ↔ مدیر)
   ============================================================ */
function loadRegisteredResidentsForBuilding() {
  let list = [];
  try { list = JSON.parse(localStorage.getItem('ham_sakhteman_registered_residents') || '[]') || []; } catch (e) { list = []; }
  const code = (loadData()?.building?.code || '').toUpperCase();
  return { all: list, mine: list.filter(r => r && (!code || String(r.buildingCode || '').toUpperCase() === code)) };
}

function renderPendingResidentsBanner() {
  const page = document.getElementById('page-units');
  if (!page) return;
  let host = document.getElementById('pendingResidentsBanner');
  if (!host) {
    host = document.createElement('div');
    host.id = 'pendingResidentsBanner';
    host.style.cssText = 'margin: 0 0 16px 0;';
    const tableBox = page.querySelector('.table-box');
    if (tableBox && tableBox.parentElement) tableBox.parentElement.insertBefore(host, tableBox);
    else page.insertBefore(host, page.firstChild);
  }

  const pending = loadRegisteredResidentsForBuilding().mine.filter(r => r.status === 'pending');
  if (pending.length === 0) { host.innerHTML = ''; host.style.display = 'none'; return; }
  host.style.display = 'block';

  const rows = pending.map(r => {
    const unitLbl = (r.block && r.block !== '—') ? `${escapeHtml(r.block)}-${toPersianNum(r.unitNumber)}` : `واحد ${toPersianNum(r.unitNumber)}`;
    const roleLbl = (r.role === 'tenant' || r.role === 'مستاجر') ? 'مستاجر' : 'مالک';
    return `<div style="display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px;background:#fff;border-radius:10px;padding:10px 12px;border:1px solid #c7d2fe;">
        <div style="font-size:13px;color:#334155;"><strong>${unitLbl}</strong> — ${escapeHtml(r.name)} (${roleLbl}) — <span dir="ltr">${escapeHtml(r.phone)}</span></div>
        <div style="display:flex;gap:6px;">
          <button type="button" class="btn btn-primary" data-approve-resident="${r.id}" style="padding:6px 14px;font-size:13px;">✅ تأیید</button>
          <button type="button" class="btn btn-danger" data-reject-resident="${r.id}" style="padding:6px 14px;font-size:13px;">✖ رد</button>
        </div>
      </div>`;
  }).join('');

  host.innerHTML = `<div style="background:#eef2ff;border:1px solid #a5b4fc;border-radius:14px;padding:14px 16px;">
      <div style="font-weight:800;color:#4338ca;margin-bottom:10px;">👥 ${formatNumber(pending.length)} ثبت‌نام ساکن در انتظار تأیید</div>
      <div style="display:flex;flex-direction:column;gap:8px;">${rows}</div>
    </div>`;

  host.querySelectorAll('[data-approve-resident]').forEach(b => b.addEventListener('click', () => setResidentRegistrationStatus(Number(b.dataset.approveResident), 'approved')));
  host.querySelectorAll('[data-reject-resident]').forEach(b => b.addEventListener('click', () => setResidentRegistrationStatus(Number(b.dataset.rejectResident), 'rejected')));
}

async function setResidentRegistrationStatus(residentId, status) {
  const { all } = loadRegisteredResidentsForBuilding();
  const r = all.find(x => Number(x.id) === Number(residentId));
  if (!r) return;
  if (status === 'rejected' && !(await appConfirm(`ثبت‌نام «${r.name}» رد شود؟ اطلاعات او از واحد حذف می‌شود.`))) return;

  r.status = status;
  r.reviewedAt = new Date().toISOString();
  localStorage.setItem('ham_sakhteman_registered_residents', JSON.stringify(all));

  const block = String(r.block || '—').trim() || '—';
  const unit = UNITS.find(u => String(u.block || '').trim() === block && Number(u.number) === Number(r.unitNumber));
  if (unit) {
    const isTenant = r.role === 'tenant' || r.role === 'مستاجر' || r.role === 'ساکن';
    const slot = isTenant ? 'tenant' : 'owner';
    if (unit[slot] && unit[slot].phone === r.phone) {
      if (status === 'approved') unit[slot].approved = true;
      else unit[slot] = { name: null, phone: null, birthDate: null, nationalId: null, type: 'settled', registered: false, approved: false };
    }
    saveUnits();
  }
  renderPendingResidentsBanner();
  renderUnitsPage();
  toastSuccess(status === 'approved' ? 'ثبت‌نام ساکن تأیید شد.' : 'ثبت‌نام رد شد.');
}

function renderUnitsPage() {
  const tbody = document.getElementById('unitsTableBody');
  const countLabel = document.getElementById('unitsCountLabel');
  if (!tbody) return;

  try { renderPendingResidentsBanner(); } catch (e) { console.warn(e); }

  updateAddUnitButtonState();

  const units = getUnitsPageFiltered();

  const data = loadData();
  const maxUnits = data?.building
    ? (Number(data.building.totalUnits) || getExpectedUnitsCount(data.building) || 0)
    : 0;

  if (countLabel) {
    if (maxUnits > 0) {
      countLabel.textContent = `${formatNumber(units.length)} از ${formatNumber(maxUnits)} واحد`;
    } else {
      countLabel.textContent = `${formatNumber(units.length)} واحد`;
    }
  }

  if (units.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="11" style="text-align:center;color:#94a3b8;padding:40px;">
          هنوز واحدی اضافه نشده است.<br>
          <span style="font-size:13px;opacity:0.8;">با دکمه «افزودن واحد» شروع کنید (حداکثر ${formatNumber(maxUnits)} واحد)</span>
        </td>
      </tr>`;
    return;
  }

  tbody.innerHTML = units.map(u => {
    const ownerRegistered = u.owner?.registered || u.owner?.name;
    const tenantRegistered = u.tenant?.registered || u.tenant?.name;

    const ownerName = u.owner?.name
      ? (u.owner.name + (u.owner.registered && !u.owner.approved
          ? ' <span class="badge" style="background:#fef3c7;color:#b45309;font-size:10px;padding:1px 6px;border-radius:8px;">در انتظار</span>'
          : ''))
      : '<span style="color:#94a3b8;">ثبت‌نام نکرده</span>';

    const tenantName = u.tenant?.name
      ? (u.tenant.name + (u.tenant.registered && !u.tenant.approved
          ? ' <span class="badge" style="background:#fef3c7;color:#b45309;font-size:10px;padding:1px 6px;border-radius:8px;">در انتظار</span>'
          : ''))
      : '<span style="color:#94a3b8;">—</span>';

    // اولویت نمایش موبایل: مالک، در غیر این صورت ساکن
    const displayPhone = u.owner?.phone || u.tenant?.phone || '—';
    const area = u.area ? formatNumber(u.area) + ' متر' : '—';
    const peopleCount = u.peopleCount ? formatNumber(u.peopleCount) + ' نفر' : '—';
    const parkingCount = u.parkingCount ? formatNumber(u.parkingCount) : '—';

    let statusBadge;
    if (ownerRegistered || tenantRegistered || (typeof isUnitEmpty === 'function' && !isUnitEmpty(u))) {
      statusBadge = '<span class="badge-occupied">🏠 پر</span>';
    } else {
      statusBadge = '<span class="badge-empty">🚪 خالی</span>';
    }

    // بدهی: فقط اگر مدیر مقدار مثبت گذاشته
    const debtDisplay = (u.debt != null && Number(u.debt) > 0) ? formatToman(u.debt) : '—';

    return `
      <tr data-unit-id="${u.id}">
        <td><strong>${u.block === '—' ? '—' : u.block}</strong></td>
        <td><strong>${formatNumber(u.number)}</strong></td>
        <td>${ownerName}</td>
        <td>${tenantName}</td>
        <td style="direction:ltr;text-align:right;">${displayPhone}</td>
        <td>${area}</td>
        <td>${peopleCount}</td>
        <td>${parkingCount}</td>
        <td>${statusBadge}</td>
        <td>${debtDisplay}</td>
        <td>
          <div class="row-actions">
            <button class="row-action-btn" data-action="view" data-id="${u.id}" title="جزئیات">✏️</button>
            <button class="row-action-btn danger" data-action="delete" data-id="${u.id}" title="حذف">🗑️</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function bindUnitsPage() {
  const filter = document.getElementById('unitsBlockFilter');
  if (filter) {
    filter.addEventListener('change', (e) => {
      unitsPageFilter = e.target.value;
      renderUnitsPage();
    });
  }
     const occupancyFilter = document.getElementById('unitsOccupancyFilter');
  if (occupancyFilter) {
    occupancyFilter.addEventListener('change', (e) => {
      unitsOccupancyFilter = e.target.value;
      renderUnitsStats();
      renderUnitsPage();
    });
  }

  const search = document.getElementById('unitsSearch');
  if (search) {
    search.addEventListener('input', (e) => {
      unitsSearchQuery = e.target.value;
      renderUnitsPage();
    });
  }

  const table = document.querySelector('#page-units table');
  if (table) {
    table.querySelectorAll('th.sortable').forEach(th => {
      th.addEventListener('click', () => {
        const col = th.dataset.sort;

        if (unitsSortColumn === col) {
          if (unitsSortDirection === 'asc') {
            unitsSortDirection = 'desc';
          } else {
            unitsSortColumn = null;
            unitsSortDirection = 'asc';
          }
        } else {
          unitsSortColumn = col;
          unitsSortDirection = 'asc';
        }

        updateSortIcons();
        renderUnitsPage();
      });
    });
  }
  const tbody = document.getElementById('unitsTableBody');
  if (tbody) {
    tbody.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;

      const action = btn.dataset.action;
      const id = Number(btn.dataset.id);

      if (action === 'view') {
        openUnitDetail(id);
      } else if (action === 'delete') {
        const _uc = (loadCharges() || []).filter(c => Number(c.unitId) === Number(id));
        const _unpaid = _uc.filter(c => !c.paid && !c.pendingApproval);
        let _msg = '⚠️ آیا از حذف این واحد مطمئن هستید؟\n\nاین عمل قابل بازگشت نیست.';
        if (_unpaid.length) _msg += `\n• ${toPersianNum(_unpaid.length)} شارژ پرداخت‌نشده این واحد هم حذف می‌شود.`;
        if (_uc.length - _unpaid.length > 0) _msg += `\n• پرداخت‌های قبلی این واحد در گزارش‌ها می‌ماند.`;
        if ((await appConfirm(_msg))) {
          UNITS = UNITS.filter(u => u.id !== id);
          if (_unpaid.length) { const _rm = new Set(_unpaid.map(c => c.id)); saveCharges(loadCharges().filter(c => !_rm.has(c.id))); }
          saveUnits();
          renderUnitsPage();
          renderUnitsStats();
          renderDashboard();
        }
      }
    });
  }
}

function updateSortIcons() {
  const table = document.querySelector('#page-units table');
  if (!table) return;

  table.querySelectorAll('th.sortable').forEach(th => {
    th.classList.remove('sort-asc', 'sort-desc');

    if (th.dataset.sort === unitsSortColumn) {
      if (unitsSortDirection === 'asc') th.classList.add('sort-asc');
      else th.classList.add('sort-desc');
    }
  });
}

/* ============ ۱۵) مودال افزودن/ویرایش واحد ============ */
let currentEditUnitId = null;
let currentUnitTab = 'main';

function showInputError(inputEl, message) {
  if (!inputEl) return;
  inputEl.classList.add('input-error');
  inputEl.classList.remove('input-success');

  let errEl = inputEl.parentElement.querySelector('.error-message');
  if (!errEl) {
    errEl = document.createElement('div');
    errEl.className = 'error-message';
    inputEl.parentElement.appendChild(errEl);
  }
  errEl.textContent = message;
  errEl.classList.add('show');
}

function clearInputError(inputEl) {
  if (!inputEl) return;
  inputEl.classList.remove('input-error');
  inputEl.classList.add('input-success');
  const errEl = inputEl.parentElement.querySelector('.error-message');
  if (errEl) errEl.classList.remove('show');
}

function openUnitModal(unitId = null) {
  // جلوگیری از باز شدن مودال افزودن وقتی به سقف واحد رسیده‌ایم
  if (!unitId) {
    const maxUnits = getMaxAllowedUnits();
    if (maxUnits > 0 && UNITS.length >= maxUnits) {
      toastError(
        `شما فقط می‌توانید حداکثر ${toPersianNum(maxUnits)} واحد داشته باشید. امکان افزودن واحد بیشتر وجود ندارد.`
      );
      return;
    }
  }

  currentEditUnitId = unitId;

  const modal = document.getElementById('unitModal');
  const title = document.getElementById('unitModalTitle');
  const subtitle = document.getElementById('unitModalSubtitle');

  document.querySelectorAll('.form-input').forEach(el => {
    el.classList.remove('input-error', 'input-success');
  });
  document.querySelectorAll('.error-message').forEach(el => {
    el.classList.remove('show');
  });

  const blockSelect = document.getElementById('unitBlock');
  const data = loadData();

  if (blockSelect && data?.building) {
    blockSelect.innerHTML = '<option value="">— انتخاب کنید —</option>';
    if (data.building.type === 'complex') {
      data.building.blocks.forEach(b => {
        const opt = document.createElement('option');
        opt.value = String(b.name).trim();
        opt.textContent = String(b.name).trim();
        blockSelect.appendChild(opt);
      });
    } else {
      const opt = document.createElement('option');
      opt.value = '—';
      opt.textContent = 'ساختمان اصلی';
      blockSelect.appendChild(opt);
    }
  }

  if (typeof switchUnitTab === 'function') switchUnitTab('main');

  if (unitId) {
    const unit = UNITS.find(u => u.id === unitId);
    if (!unit) return;

    if (title) title.textContent = 'ویرایش واحد';
    if (subtitle) subtitle.textContent = `ویرایش واحد ${unit.code || ''}`;

    document.getElementById('unitBlock').value = unit.block || '';
    document.getElementById('unitNumber').value = unit.number || '';
    document.getElementById('unitFloor').value = unit.floor || '';
    document.getElementById('unitArea').value = unit.area || '';
    document.getElementById('unitPeopleCount').value = unit.peopleCount || 0;
    document.getElementById('unitParkingCount').value = unit.parkingCount || 0;
    document.getElementById('unitStorageCount').value = unit.storageCount || 0;
    document.getElementById('unitStatus').value = unit.status || 'auto';

    document.getElementById('ownerName').value = unit.owner?.name || '';
    document.getElementById('ownerPhone').value = unit.owner?.phone || '';
    document.getElementById('ownerBirthDate').value = unit.owner?.birthDate || '';
    document.getElementById('ownerNationalId').value = unit.owner?.nationalId || '';
    document.getElementById('ownerType').value = unit.owner?.type || 'settled';
    document.getElementById('defaultChargeOwner').value = unit.defaultChargeOwner || 0;
  

    document.getElementById('tenantName').value = unit.tenant?.name || '';
    document.getElementById('tenantPhone').value = unit.tenant?.phone || '';
    document.getElementById('tenantBirthDate').value = unit.tenant?.birthDate || '';
    document.getElementById('tenantNationalId').value = unit.tenant?.nationalId || '';
   document.getElementById('tenantType').value = unit.tenant?.type || 'settled';
    document.getElementById('defaultChargeTenant').value = unit.defaultChargeTenant || 0;
  

    document.getElementById('unitCharge').value = unit.chargeAmount || 500000;
    document.getElementById('unitDebt').value = unit.debt || 0;
    document.getElementById('unitNotes').value = unit.notes || '';

    document.getElementById('ownerSettlementId').value = unit.ownerSettlementId || '';
    document.getElementById('tenantSettlementId').value = unit.tenantSettlementId || '';
    document.getElementById('waterBillId').value = unit.waterBillId || '';
    document.getElementById('electricityBillId').value = unit.electricityBillId || '';
    document.getElementById('gasBillId').value = unit.gasBillId || '';
    document.getElementById('phoneBillId').value = unit.phoneBillId || '';
    document.getElementById('parkingNumber').value = unit.parkingNumber || '';
    document.getElementById('storageNumber').value = unit.storageNumber || '';
    document.getElementById('landlinePhone').value = unit.landlinePhone || '';
  } else {
    if (title) title.textContent = 'افزودن واحد جدید';
    if (subtitle) subtitle.textContent = 'اطلاعات واحد را وارد کنید';

    document.getElementById('unitBlock').value = '';
    document.getElementById('unitNumber').value = '';
    document.getElementById('unitFloor').value = '';
    document.getElementById('unitArea').value = '';
    document.getElementById('unitPeopleCount').value = 0;
    document.getElementById('unitParkingCount').value = 0;
    document.getElementById('unitStorageCount').value = 0;
    document.getElementById('unitStatus').value = 'auto';

    document.getElementById('ownerName').value = '';
    document.getElementById('ownerPhone').value = '';
    document.getElementById('ownerBirthDate').value = '';
    document.getElementById('ownerNationalId').value = '';
   document.getElementById('ownerType').value = 'settled';
    document.getElementById('defaultChargeOwner').value = 0;
   

    document.getElementById('tenantName').value = '';
    document.getElementById('tenantPhone').value = '';
    document.getElementById('tenantBirthDate').value = '';
    document.getElementById('tenantNationalId').value = '';
    document.getElementById('tenantType').value = 'settled';
    document.getElementById('defaultChargeTenant').value = 0;
  

    document.getElementById('unitCharge').value = 500000;
    document.getElementById('unitDebt').value = 0;
    document.getElementById('unitNotes').value = '';

    document.getElementById('ownerSettlementId').value = '';
    document.getElementById('tenantSettlementId').value = '';
    document.getElementById('waterBillId').value = '';
    document.getElementById('electricityBillId').value = '';
    document.getElementById('gasBillId').value = '';
    document.getElementById('phoneBillId').value = '';
    document.getElementById('parkingNumber').value = '';
    document.getElementById('storageNumber').value = '';
    document.getElementById('landlinePhone').value = '';
  }

  renderUnitResidentAccounts(unitId);
  modal.classList.add('open');
}

/* ============ 🔑 حساب ساکنین واحد (رمز تازه برای ساکنی که رمزش را فراموش کرده) ============ */
function hashResidentPasswordForManager(str) {
  // باید دقیقاً با hashResidentPassword در resident-app.js یکی باشد
  let hash = 0;
  const salted = 'ap+res:' + String(str);
  for (let i = 0; i < salted.length; i++) {
    hash = ((hash << 5) - hash) + salted.charCodeAt(i);
    hash |= 0;
  }
  return 'rh_' + Math.abs(hash).toString(36);
}

function getUnitRegisteredResidents(unit) {
  if (!unit) return [];
  const block = String(unit.block || '—').trim() || '—';
  return loadRegisteredResidentsForBuilding().mine.filter(r => r && r.status !== 'rejected'
    && (String(r.block || '—').trim() || '—') === block && Number(r.unitNumber) === Number(unit.number));
}

function renderUnitResidentAccounts(unitId) {
  const tenantInput = document.getElementById('tenantPhone');
  const section = tenantInput ? tenantInput.closest('.form-section') : null;
  let host = document.getElementById('unitResidentAccounts');
  if (!host && section && section.parentElement) {
    host = document.createElement('div');
    host.id = 'unitResidentAccounts';
    host.className = 'form-section';
    section.parentElement.insertBefore(host, section.nextSibling);
  }
  if (!host) return;
  const unit = unitId ? UNITS.find(u => u.id === unitId) : null;
  const regs = getUnitRegisteredResidents(unit);
  if (!regs.length) { host.innerHTML = ''; host.style.display = 'none'; return; }
  host.style.display = '';
  host.innerHTML = `<div class="form-section-title"><span>🔑 حساب ساکنین در پنل ساکن</span></div>
    <div style="font-size:12.5px;color:#64748b;margin-bottom:10px;">اگر ساکنی رمز ورودش را فراموش کرده، برایش رمز تازه بگذارید و به خودش بگویید.</div>
    <div style="display:flex;flex-direction:column;gap:8px;">${regs.map(r => {
      const roleLbl = (r.role === 'tenant' || r.role === 'مستاجر' || r.role === 'ساکن') ? 'مستاجر' : 'مالک';
      const st = r.status === 'approved' ? '' : ' — در انتظار تأیید';
      return `<div style="display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:10px 12px;">
        <div style="font-size:13px;color:#334155;"><strong>${escapeHtml(r.name || '')}</strong> (${roleLbl}${st}) — <span dir="ltr">${escapeHtml(r.phone || '')}</span></div>
        <button type="button" class="btn btn-secondary" data-reset-resident-pass="${r.id}" style="padding:6px 12px;font-size:13px;">🔑 رمز تازه</button>
      </div>`;
    }).join('')}</div>`;
  host.querySelectorAll('[data-reset-resident-pass]').forEach(b => b.addEventListener('click', () => resetResidentPassword(Number(b.dataset.resetResidentPass), unitId)));
}

async function resetResidentPassword(residentId, unitId) {
  const { all } = loadRegisteredResidentsForBuilding();
  const r = all.find(x => Number(x.id) === Number(residentId));
  if (!r) return;
  let pass = await appPrompt(`رمز تازه برای «${r.name || ''}» (حداقل ۶ کاراکتر):`, '');
  if (pass === null || pass === undefined) return;
  pass = String(pass).trim();
  if (pass.length < 6) { await appAlert('رمز باید حداقل ۶ کاراکتر باشد.'); return; }
  r.passwordHash = hashResidentPasswordForManager(pass);
  delete r.password;
  r.passwordResetAt = new Date().toISOString();
  localStorage.setItem('ham_sakhteman_registered_residents', JSON.stringify(all));
  await appAlert(`رمز تازه «${r.name || ''}» ثبت شد:\n\n${pass}\n\nاین رمز را به خودش بگویید. با همین شماره موبایل و رمز تازه وارد می‌شود.`);
  if (unitId) renderUnitResidentAccounts(unitId);
}

function closeUnitModal() {
  document.getElementById('unitModal').classList.remove('open');
  currentEditUnitId = null;
  currentUnitTab = 'main';
}

function saveUnit() {
  // جلوگیری از افزودن واحد بیش از سقف ثبت‌نام / پرداخت
  if (!currentEditUnitId) {
    const maxUnits = getMaxAllowedUnits();
    if (maxUnits > 0 && UNITS.length >= maxUnits) {
      toastError(
        `شما فقط می‌توانید حداکثر ${toPersianNum(maxUnits)} واحد داشته باشید. برای افزودن واحد بیشتر، تعداد واحد را در ثبت‌نام افزایش دهید یا پلن را ارتقا دهید.`
      );
      return;
    }
  }

  const block = document.getElementById('unitBlock').value.trim();
  const number = parseInt(document.getElementById('unitNumber').value);
  const floor = document.getElementById('unitFloor').value.trim();
  const area = parseFloat(document.getElementById('unitArea').value) || 0;
  const peopleCount = parseInt(document.getElementById('unitPeopleCount').value) || 0;
  const parkingCount = parseInt(document.getElementById('unitParkingCount').value) || 0;
  const storageCount = parseInt(document.getElementById('unitStorageCount').value) || 0;
  const status = document.getElementById('unitStatus').value || 'auto';

  const ownerName = document.getElementById('ownerName').value.trim();
  const ownerPhone = document.getElementById('ownerPhone').value.trim();
  const ownerBirthDate = document.getElementById('ownerBirthDate').value.trim();
  const ownerNationalId = document.getElementById('ownerNationalId').value.trim();
  const ownerType = document.getElementById('ownerType').value;
  const defaultChargeOwner = parseInt(document.getElementById('defaultChargeOwner').value) || 0;
 

  const tenantName = document.getElementById('tenantName').value.trim();
  const tenantPhone = document.getElementById('tenantPhone').value.trim();
  const tenantBirthDate = document.getElementById('tenantBirthDate').value.trim();
  const tenantNationalId = document.getElementById('tenantNationalId').value.trim();
  const tenantType = document.getElementById('tenantType').value;
  const defaultChargeTenant = parseInt(document.getElementById('defaultChargeTenant').value) || 0;
 

  const _chRaw = document.getElementById('unitCharge').value;
  const charge = _chRaw === '' ? 500000 : (parseInt(_chRaw) || 0); // صفر = معاف از شارژ
  const debt = parseInt(document.getElementById('unitDebt').value) || 0;
  const notes = document.getElementById('unitNotes').value.trim();

  const ownerSettlementId = document.getElementById('ownerSettlementId').value.trim();
  const tenantSettlementId = document.getElementById('tenantSettlementId').value.trim();
  const waterBillId = document.getElementById('waterBillId').value.trim();
  const electricityBillId = document.getElementById('electricityBillId').value.trim();
  const gasBillId = document.getElementById('gasBillId').value.trim();
  const phoneBillId = document.getElementById('phoneBillId').value.trim();
  const parkingNumber = document.getElementById('parkingNumber').value.trim();
  const storageNumber = document.getElementById('storageNumber').value.trim();
  const landlinePhone = document.getElementById('landlinePhone').value.trim();

  if (!block) {
    if (typeof switchUnitTab === 'function') switchUnitTab('main');
    toastWarning('لطفاً بلوک را انتخاب کنید.');
    return;
  }
  if (!number || number < 1) {
    if (typeof switchUnitTab === 'function') switchUnitTab('main');
    toastWarning('لطفاً شماره واحد را وارد کنید.');
    return;
  }
  if (!area || area < 1) {
    if (typeof switchUnitTab === 'function') switchUnitTab('main');
    toastWarning('لطفاً متراژ واحد را وارد کنید.');
    return;
  }
  if (ownerPhone && !isValidIranMobile(ownerPhone)) {
    if (typeof switchUnitTab === 'function') switchUnitTab('main');
    showInputError(document.getElementById('ownerPhone'), 'شماره موبایل باید ۱۱ رقم و با ۰۹ شروع شود');
    toastWarning('شماره موبایل مالک اشتباه است.');
    return;
  }
  if (tenantPhone && !isValidIranMobile(tenantPhone)) {
    if (typeof switchUnitTab === 'function') switchUnitTab('main');
    showInputError(document.getElementById('tenantPhone'), 'شماره موبایل باید ۱۱ رقم و با ۰۹ شروع شود');
    toastWarning('شماره موبایل ساکن اشتباه است.');
    return;
  }

  const duplicate = UNITS.find(u =>
    u.block === block && u.number === number && u.id !== currentEditUnitId
  );
  if (duplicate) {
    if (typeof switchUnitTab === 'function') switchUnitTab('main');
    toastWarning(`واحد ${number} در بلوک ${block} قبلاً ثبت شده است.`);
    return;
  }

  // محدودیت تعداد/شماره واحد بر اساس تعریف ثبت‌نام (هر بلوک یا کل ساختمان)
  const maxForBlock = getMaxUnitsForBlock(block);
  if (maxForBlock > 0 && number > maxForBlock) {
    if (typeof switchUnitTab === 'function') switchUnitTab('main');
    const data = loadData();
    const isComplex = data?.building?.type === 'complex';
    if (isComplex) {
      toastError(
        `بلوک «${block}» فقط تا ${toPersianNum(maxForBlock)} واحد دارد. نمی‌توانید واحد شماره ${toPersianNum(number)} را اضافه کنید.`
      );
    } else {
      toastError(
        `این ساختمان فقط تا ${toPersianNum(maxForBlock)} واحد دارد. نمی‌توانید واحد شماره ${toPersianNum(number)} را اضافه کنید.`
      );
    }
    return;
  }

  // محدودیت تعداد واحدهای موجود در همان بلوک
  if (!currentEditUnitId && maxForBlock > 0) {
    const unitsInBlock = UNITS.filter(u => String(u.block).trim() === String(block).trim()).length;
    if (unitsInBlock >= maxForBlock) {
      if (typeof switchUnitTab === 'function') switchUnitTab('main');
      const data = loadData();
      const isComplex = data?.building?.type === 'complex';
      if (isComplex) {
        toastError(
          `ظرفیت بلوک «${block}» تکمیل است (حداکثر ${toPersianNum(maxForBlock)} واحد).`
        );
      } else {
        toastError(
          `ظرفیت ساختمان تکمیل است (حداکثر ${toPersianNum(maxForBlock)} واحد).`
        );
      }
      return;
    }
  }

  const code = `${block}-${toPersianNum(number)}`;
  const isEdit = !!currentEditUnitId;

  const unitData = {
    block, number, code, floor,
    area, peopleCount, parkingCount, storageCount, status,
        owner: {
      name: ownerName || null,
      phone: ownerPhone || null,
      birthDate: ownerBirthDate || null,
      nationalId: ownerNationalId || null,
      type: ownerType,
      registered: !!ownerName,
      approved: !!ownerName,
    },
       tenant: {
      name: tenantName || null,
      phone: tenantPhone || null,
      birthDate: tenantBirthDate || null,
      nationalId: tenantNationalId || null,
      type: tenantType,
      registered: !!tenantName,
      approved: !!tenantName,
    },
    defaultChargeOwner,
    defaultChargeTenant,
    chargeAmount: charge,
    debt,
    debtExplicit: true,
    notes,
    ownerSettlementId: ownerSettlementId || null,
    tenantSettlementId: tenantSettlementId || null,
    waterBillId: waterBillId || null,
    electricityBillId: electricityBillId || null,
    gasBillId: gasBillId || null,
    phoneBillId: phoneBillId || null,
    parkingNumber: parkingNumber || null,
    storageNumber: storageNumber || null,
    landlinePhone: landlinePhone || null,
  };

  if (currentEditUnitId) {
    const unit = UNITS.find(u => u.id === currentEditUnitId);
    if (unit) Object.assign(unit, unitData);
  } else {
    const newId = UNITS.length > 0 ? Math.max(...UNITS.map(u => u.id)) + 1 : 1;
    UNITS.push({ id: newId, ...unitData });
  }

  saveUnits();
  closeUnitModal();
  renderUnitsStats();
  renderUnitsPage();
  renderDashboard();

  toastSuccess(isEdit ? 'واحد ویرایش شد.' : 'واحد جدید اضافه شد.');
}
/* ✅ برچسب ماهیت برای اکسل (بدون ایموجی) */
function getPartyTypeExcel(type) {
  if (type === 'creditor') return 'بستانکار';
  if (type === 'settled') return 'تسویه';
  if (type === 'debtor') return 'بدهکار';
  return '—';
}


/* ============ ۱۶) خروجی اکسل واحدها ============ */
function exportToExcel() {
  const units = getUnitsPageFiltered();

  if (units.length === 0) {
    toastWarning('واحدی برای خروجی وجود ندارد.');
    return;
  }

  let html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office"
          xmlns:x="urn:schemas-microsoft-com:office:excel"
          xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="UTF-8">
      <style>
        table { border-collapse: collapse; font-family: Tahoma; direction: rtl; }
        th, td { border: 1px solid #ccc; padding: 8px; text-align: right; font-size: 13px; }
        th { background: #5b4cdb; color: white; font-weight: bold; }
      </style>
    </head>
    <body>
      <h2>لیست واحدها — ${new Date().toLocaleDateString('fa-IR')}</h2>
      <table>
        <thead>
          <tr>
            <th>ردیف</th>
            <th>بلوک</th>
            <th>واحد</th>
            <th>طبقه</th>
            <th>مالک</th>
            <th>موبایل مالک</th>
            <th>کد ملی مالک</th>
            <th>ماهیت مالک</th>
            <th>ساکن</th>
            <th>موبایل ساکن</th>
            <th>کد ملی ساکن</th>
            <th>ماهیت ساکن</th>
            <th>متراژ</th>
            <th>نفرات</th>
            <th>پارکینگ</th>
            <th>انباری</th>
            <th>وضعیت</th>
            <th>شارژ ماهانه</th>
            <th>بدهی</th>
            <th>شماره پارکینگ</th>
            <th>شماره انباری</th>
            <th>تلفن ثابت</th>
          </tr>
        </thead>
        <tbody>
  `;

  units.forEach((u, idx) => {
    const ownerName = u.owner?.name || '—';
    const ownerPhone = u.owner?.phone || '—';
    const ownerNationalId = u.owner?.nationalId || '—';
    const ownerType = getPartyTypeExcel(u.owner?.type);

    const tenantName = u.tenant?.name || '—';
    const tenantPhone = u.tenant?.phone || '—';
    const tenantNationalId = u.tenant?.nationalId || '—';
   const tenantType = getPartyTypeExcel(u.tenant?.type);

    const status = (typeof isUnitEmpty === 'function' && !isUnitEmpty(u)) ? 'پر' : 'خالی';
    const charge = Number(u.chargeAmount || 0).toLocaleString('en-US');
    const debt = Number(u.debt || 0).toLocaleString('en-US');

    html += `
      <tr>
        <td>${idx + 1}</td>
        <td>${u.block || '—'}</td>
        <td>${u.number || '—'}</td>
        <td>${u.floor || '—'}</td>
        <td>${ownerName}</td>
        <td>${ownerPhone}</td>
        <td>${ownerNationalId}</td>
        <td>${ownerType}</td>
        <td>${tenantName}</td>
        <td>${tenantPhone}</td>
        <td>${tenantNationalId}</td>
        <td>${tenantType}</td>
        <td>${u.area || '—'}</td>
        <td>${u.peopleCount || 0}</td>
        <td>${u.parkingCount || 0}</td>
        <td>${u.storageCount || 0}</td>
        <td>${status}</td>
        <td>${charge}</td>
        <td>${debt}</td>
        <td>${u.parkingNumber || '—'}</td>
        <td>${u.storageNumber || '—'}</td>
        <td>${u.landlinePhone || '—'}</td>
      </tr>
    `;
  });

  html += `
        </tbody>
      </table>
    </body>
    </html>
  `;

  const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `واحدها-${new Date().toLocaleDateString('fa-IR').replace(/\//g, '-')}.xls`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ============ ۱۷) چاپ PDF واحدها ============ */
function printUnitsPdf() {
  const units = getUnitsPageFiltered();

  if (units.length === 0) {
    toastWarning('واحدی برای چاپ وجود ندارد.');
    return;
  }

  const buildingData = loadData();
  const buildingName = buildingData?.building?.name || 'ساختمان';
  const buildingCode = buildingData?.building?.code || '';
  const today = new Date().toLocaleDateString('fa-IR');

  let rows = '';
  units.forEach((u, idx) => {
    const ownerName = u.owner?.name || '—';
    const ownerPhone = u.owner?.phone || '—';
    const tenantName = u.tenant?.name || '—';
    const debt = Number(u.debt || 0);
    const debtStr = debt > 0 ? formatToman(debt) : '—';
    const status = (typeof isUnitEmpty === 'function' && !isUnitEmpty(u)) ? 'پر' : 'خالی';

    rows += `
      <tr>
        <td>${idx + 1}</td>
        <td>${u.block || '—'}</td>
        <td>${u.number || '—'}</td>
        <td>${ownerName}</td>
        <td>${ownerPhone}</td>
        <td>${tenantName}</td>
        <td>${u.area || '—'}</td>
        <td>${u.peopleCount || 0}</td>
        <td>${u.parkingCount || 0}</td>
        <td>${u.storageCount || 0}</td>
        <td>${status}</td>
        <td>${debtStr}</td>
      </tr>
    `;
  });

  const html = `
    <!DOCTYPE html>
    <html lang="fa" dir="rtl">
    <head>
      <meta charset="UTF-8">
      <title>لیست واحدها</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Tahoma, Arial; direction: rtl; color: #1e293b; padding: 80px 25px 25px 25px; }
        .pdf-toolbar {
          position: fixed; top: 0; left: 0; right: 0;
          background: #ffffff; border-bottom: 1px solid #e2e8f0;
          padding: 12px 20px; display: flex; justify-content: center; gap: 10px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.06); z-index: 1000;
        }
        .pdf-toolbar button {
          padding: 10px 22px; border: none; border-radius: 10px;
          font-family: Tahoma, Arial; font-size: 14px; font-weight: bold; cursor: pointer;
        }
        .btn-print { background: #5b4cdb; color: #fff; }
        .btn-save { background: #22c55e; color: #fff; }
        .btn-close { background: #f1f5f9; color: #64748b; }
        h1 { color: #5b4cdb; font-size: 20px; margin-bottom: 5px; }
        .info { font-size: 12px; color: #64748b; margin-bottom: 20px; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        th { background: #5b4cdb; color: white; padding: 9px 6px; text-align: right; border: 1px solid #4338ca; }
        td { padding: 8px 6px; border: 1px solid #e2e8f0; text-align: right; }
        tr:nth-child(even) { background: #f8fafc; }
        .footer { margin-top: 25px; padding-top: 12px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 11px; color: #94a3b8; }
        @media print { .pdf-toolbar { display: none !important; } body { padding: 20px 15px; } }
      </style>
    </head>
    <body>
      <div class="pdf-toolbar">
        <button class="btn-print" onclick="window.print()">🖨️ چاپ</button>
        <button class="btn-save" onclick="window.print()">📥 ذخیره PDF</button>
        <button class="btn-close" onclick="window.close()">❌ بستن</button>
      </div>
      <h1>🏢 ${buildingName}</h1>
      <div class="info">
        ${buildingCode ? 'کد: ' + buildingCode + ' | ' : ''}
        تاریخ: ${today} | تعداد: ${units.length} واحد
      </div>
      <table>
        <thead>
          <tr>
            <th>ردیف</th><th>بلوک</th><th>واحد</th><th>مالک</th>
            <th>موبایل</th><th>مستاجر</th><th>متراژ</th>
            <th>نفرات</th><th>پارکینگ</th><th>انباری</th>
            <th>وضعیت</th><th>بدهی</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="footer">
        © ${new Date().getFullYear()} — آپارتمان پلاس | نرم‌افزار هوشمند مدیریت ساختمان
      </div>
    </body>
    </html>
  `;

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    toastWarning('لطفاً اجازه باز شدن پنجره چاپ را بدهید.');
    return;
  }

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}

/* ============ ۱۸) بایند مودال واحد ============ */
function bindUnitModal() {
  const btnAdd = document.getElementById('btnAddUnit');
  if (btnAdd) btnAdd.onclick = () => openUnitModal(null);

  const btnExcel = document.getElementById('btnExportExcel');
  if (btnExcel) btnExcel.onclick = exportToExcel;

  const btnPdf = document.getElementById('btnPrintPdf');
  if (btnPdf) btnPdf.onclick = printUnitsPdf;

  const btnCancel = document.getElementById('unitCancelBtn');
  if (btnCancel) btnCancel.onclick = closeUnitModal;

  const btnClose = document.getElementById('unitModalCloseBtn');
  if (btnClose) btnClose.onclick = closeUnitModal;

  const btnSave = document.getElementById('unitSaveBtn');
  if (btnSave) btnSave.onclick = saveUnit;

  document.querySelectorAll('.unit-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      if (typeof switchUnitTab === 'function') {
        switchUnitTab(tab.dataset.unitTab);
      }
    });
  });

  const ownerPhone = document.getElementById('ownerPhone');
  if (ownerPhone) {
    ownerPhone.addEventListener('blur', () => {
      const val = ownerPhone.value.trim();
      if (val && !isValidIranMobile(val)) {
        showInputError(ownerPhone, 'شماره موبایل باید ۱۱ رقم و با ۰۹ شروع شود');
      } else if (val) {
        clearInputError(ownerPhone);
      }
    });
  }

  const tenantPhone = document.getElementById('tenantPhone');
  if (tenantPhone) {
    tenantPhone.addEventListener('blur', () => {
      const val = tenantPhone.value.trim();
      if (val && !isValidIranMobile(val)) {
        showInputError(tenantPhone, 'شماره موبایل باید ۱۱ رقم و با ۰۹ شروع شود');
      } else if (val) {
        clearInputError(tenantPhone);
      }
    });
  }

  const modal = document.getElementById('unitModal');
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeUnitModal();
    });
  }
}
/* ✅ سوئیچ بین تب‌ها */
function switchUnitTab(tabName) {
  currentUnitTab = tabName;

  document.querySelectorAll('.unit-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.unitTab === tabName);
  });

  document.querySelectorAll('.unit-tab-content').forEach(c => {
    c.classList.toggle('active', c.dataset.unitTabContent === tabName);
  });

  const wrapper = document.querySelector('.unit-tab-content-wrapper');
  if (wrapper) wrapper.scrollTop = 0;
}
/* ============================================================
   مودال جزئیات واحد
   ============================================================ */
let currentDetailUnitId = null;
/* ✅ برچسب ماهیت (مالک / ساکن) */
function getPartyTypeLabel(type) {
  if (type === 'creditor') return ' بستانکار';
  if (type === 'settled') return ' تسویه';
  if (type === 'debtor') return ' بدهکار';
  return '—';
}

function openUnitDetail(unitId) {
  const unit = UNITS.find(u => u.id === unitId);
  if (!unit) return;

  currentDetailUnitId = unitId;

  // عنوان
  const title = document.getElementById('detailUnitTitle');
  const subtitle = document.getElementById('detailUnitSubtitle');
  if (title) title.textContent = `جزئیات واحد ${unit.block}-${toPersianNum(unit.number)}`;
  if (subtitle) subtitle.textContent = `کد: ${unit.code || '—'}`;

  // اطلاعات پایه
  document.getElementById('detailBlock').textContent = unit.block || '—';
  document.getElementById('detailNumber').textContent = toPersianNum(unit.number) || '—';
  document.getElementById('detailFloor').textContent = unit.floor || '—';
  document.getElementById('detailCode').textContent = unit.code || '—';

  // وضعیت
  const statusEl = document.getElementById('detailStatus');
  if (statusEl) {
    if (typeof isUnitEmpty === 'function' && !isUnitEmpty(unit)) {
      statusEl.textContent = '🏠 پر';
      statusEl.style.color = '#15803d';
    } else {
      statusEl.textContent = '🚪 خالی';
      statusEl.style.color = '#92400e';
    }
  }

  // متراژ / نفرات / پارکینگ / انباری
  document.getElementById('detailArea').textContent = unit.area ? formatNumber(unit.area) + ' متر' : '—';
  document.getElementById('detailPeople').textContent = unit.peopleCount ? formatNumber(unit.peopleCount) + ' نفر' : '—';
  document.getElementById('detailParking').textContent = unit.parkingCount ? formatNumber(unit.parkingCount) : '—';
  document.getElementById('detailStorage').textContent = unit.storageCount ? formatNumber(unit.storageCount) : '—';

  // مالی
  document.getElementById('detailCharge').textContent = formatToman(unit.chargeAmount || 500000);
  document.getElementById('detailDebt').textContent = unit.debt > 0 ? formatToman(unit.debt) : '—';

  // مالک
  const ownerStatus = document.getElementById('detailOwnerStatus');
  if (unit.owner?.name) {
    ownerStatus.textContent = 'ثبت‌نام کرده';
    ownerStatus.className = 'detail-status active';
    document.getElementById('detailOwnerName').textContent = unit.owner.name;
    document.getElementById('detailOwnerPhone').textContent = unit.owner.phone || '—';
    document.getElementById('detailOwnerNationalId').textContent = unit.owner.nationalId || '—';
    document.getElementById('detailOwnerBirthDate').textContent = unit.owner.birthDate || '—';
   document.getElementById('detailOwnerType').textContent = getPartyTypeLabel(unit.owner.type);
    document.getElementById('detailOwnerDefaultCharge').textContent = 
      unit.defaultChargeOwner ? formatToman(unit.defaultChargeOwner) : '—';
  } else {
    ownerStatus.textContent = 'ثبت‌نام نکرده';
    ownerStatus.className = 'detail-status none';
    document.getElementById('detailOwnerName').textContent = '—';
    document.getElementById('detailOwnerPhone').textContent = '—';
    document.getElementById('detailOwnerNationalId').textContent = '—';
    document.getElementById('detailOwnerBirthDate').textContent = '—';
    document.getElementById('detailOwnerType').textContent = '—';
    document.getElementById('detailOwnerDefaultCharge').textContent = '—';
  }

  // ساکن
  const tenantStatus = document.getElementById('detailTenantStatus');
  if (unit.tenant?.name) {
    tenantStatus.textContent = 'دارد';
    tenantStatus.className = 'detail-status active';
    document.getElementById('detailTenantName').textContent = unit.tenant.name;
    document.getElementById('detailTenantPhone').textContent = unit.tenant.phone || '—';
    document.getElementById('detailTenantNationalId').textContent = unit.tenant.nationalId || '—';
    document.getElementById('detailTenantBirthDate').textContent = unit.tenant.birthDate || '—';
   document.getElementById('detailTenantType').textContent = getPartyTypeLabel(unit.tenant.type);
    document.getElementById('detailTenantDefaultCharge').textContent = 
      unit.defaultChargeTenant ? formatToman(unit.defaultChargeTenant) : '—';
  } else {
    tenantStatus.textContent = 'ندارد';
    tenantStatus.className = 'detail-status none';
    document.getElementById('detailTenantName').textContent = '—';
    document.getElementById('detailTenantPhone').textContent = '—';
    document.getElementById('detailTenantNationalId').textContent = '—';
    document.getElementById('detailTenantBirthDate').textContent = '—';
    document.getElementById('detailTenantType').textContent = '—';
    document.getElementById('detailTenantDefaultCharge').textContent = '—';
  }

  // اطلاعات تکمیلی
  document.getElementById('detailOwnerSettlementId').textContent = unit.ownerSettlementId || '—';
  document.getElementById('detailTenantSettlementId').textContent = unit.tenantSettlementId || '—';
  document.getElementById('detailWaterBillId').textContent = unit.waterBillId || '—';
  document.getElementById('detailElectricityBillId').textContent = unit.electricityBillId || '—';
  document.getElementById('detailGasBillId').textContent = unit.gasBillId || '—';
  document.getElementById('detailPhoneBillId').textContent = unit.phoneBillId || '—';
  document.getElementById('detailParkingNumber').textContent = unit.parkingNumber || '—';
  document.getElementById('detailStorageNumber').textContent = unit.storageNumber || '—';
  document.getElementById('detailLandlinePhone').textContent = unit.landlinePhone || '—';

  // توضیحات
  const notesSection = document.getElementById('detailNotesSection');
  const notesEl = document.getElementById('detailNotes');
  if (unit.notes && unit.notes.trim()) {
    notesSection.style.display = 'block';
    notesEl.textContent = unit.notes;
  } else {
    notesSection.style.display = 'none';
  }

  const modal = document.getElementById('unitDetailModal');
  if (modal) modal.classList.add('open');
}
function closeUnitDetail() {
  const modal = document.getElementById('unitDetailModal');
  if (modal) modal.classList.remove('open');
  currentDetailUnitId = null;
}

function bindUnitDetailModal() {
  document.getElementById('detailCloseBtn')?.addEventListener('click', closeUnitDetail);
  document.getElementById('detailCancelBtn')?.addEventListener('click', closeUnitDetail);

  document.getElementById('detailEditBtn')?.addEventListener('click', () => {
    const id = currentDetailUnitId;
    closeUnitDetail();
    setTimeout(() => openUnitModal(id), 150);
  });

  const modal = document.getElementById('unitDetailModal');
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeUnitDetail();
    });
  }
}

/* ============================================================
   ذخیره‌سازی شارژها
   ============================================================ */
function getChargesKey() {
  return getAccountStorageKey('ham_sakhteman_charges');
}

function loadCharges() {
  const raw = localStorage.getItem(getChargesKey());
  if (raw) { try { return JSON.parse(raw); } catch (e) { return []; } }
  return [];
}

function saveCharges(charges) {
  localStorage.setItem(getChargesKey(), JSON.stringify(charges));
}

function getChargesForMonth(month, year) {
  const charges = loadCharges();
  const y = String(year);
  return charges.filter(c => c.month === month && String(c.year) === y);
}

/* ============================================================
   صفحه شارژ
   ============================================================ */
let currentChargeMonth = getTodayPersianMonth();
let currentChargeYear = String(getTodayPersianYear());

function renderChargesPage() {
  fillYearMonthDropdowns('chargeYear', 'chargeMonth');

  const monthSelect = document.getElementById('chargeMonth');
  const yearSelect = document.getElementById('chargeYear');
  if (monthSelect) monthSelect.value = currentChargeMonth;
  if (yearSelect) yearSelect.value = currentChargeYear;

  const label = document.getElementById('chargeMonthLabel');
  if (label) label.textContent = `${currentChargeMonth} ${toPersianNum(currentChargeYear)}`;

  const charges = getChargesForMonth(currentChargeMonth, currentChargeYear);

  const total = charges.length;
  const paid = charges.filter(c => c.paid).length;
  const unpaid = charges.filter(c => !c.paid).length;
  const sum = charges
    .filter(c => c.paid)
    .reduce((s, c) => s + (Number(c.total) || 0), 0);

  // مانده وصول‌نشده همین دوره (قبلاً به اشتباه جمع «extra» با عنوان هزینه‌ها نمایش داده می‌شد)
  const expenseSum = charges
    .filter(c => !c.paid)
    .reduce((s, c) => s + (Number(c.total) || 0), 0);
  const elTotal = document.getElementById('chargeTotal');
  const elPaid = document.getElementById('chargePaid');
  const elUnpaid = document.getElementById('chargeUnpaid');
  const elSum = document.getElementById('chargeSum');
  const elExpenses = document.getElementById('chargeExpenses');
  const elCount = document.getElementById('chargeCountLabel');

  if (elTotal) elTotal.textContent = formatNumber(total);
  if (elPaid) elPaid.textContent = formatNumber(paid);
  if (elUnpaid) elUnpaid.textContent = formatNumber(unpaid);
  if (elSum) elSum.textContent = formatToman(sum);
  if (elExpenses) elExpenses.textContent = formatToman(expenseSum);
  if (elCount) elCount.textContent = `${formatNumber(total)} مورد`;

  renderPendingPaymentsBanner();
  renderChargesTable(charges);
}

/** بنر پرداخت‌های در انتظار تأیید ساکن */
function renderPendingPaymentsBanner() {
  let host = document.getElementById('pendingPaymentsBanner');
  const page = document.getElementById('page-charges');
  if (!page) return;

  if (!host) {
    host = document.createElement('div');
    host.id = 'pendingPaymentsBanner';
    host.style.cssText = 'margin: 0 0 16px 0;';
    const tableBox = page.querySelector('.table-box');
    if (tableBox && tableBox.parentElement) {
      tableBox.parentElement.insertBefore(host, tableBox);
    } else {
      page.insertBefore(host, page.firstChild);
    }
  }

  const all = (loadCharges() || []).filter(c => c.pendingApproval && !c.paid);
  if (all.length === 0) {
    host.innerHTML = '';
    host.style.display = 'none';
    return;
  }
  host.style.display = 'block';

  const rows = all.map(c => {
    const unit = UNITS.find(u => Number(u.id) === Number(c.unitId));
    const label = unit
      ? ((unit.block && unit.block !== '—') ? (unit.block + '-' + toPersianNum(unit.number)) : ('واحد ' + toPersianNum(unit.number)))
      : '—';
    const track = (c.trackingCode ? (' — پیگیری: <span dir="ltr">' + escapeHtml(c.trackingCode) + '</span>') : '') +
      (c.receipt && c.receipt.date ? (' — تاریخ واریز: ' + escapeHtml(c.receipt.date)) : '') +
      (c.receipt && c.receipt.card4 ? (' — کارت ****' + escapeHtml(toPersianNum(c.receipt.card4))) : '');
    const rcptBtn = c.receiptImage
      ? '<button type="button" class="btn btn-secondary" data-view-receipt="' + c.id + '" style="padding:6px 14px;font-size:13px;">🧾 رسید</button>'
      : '';
    return (
      '<div style="display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px;background:#fff;border-radius:10px;padding:10px 12px;border:1px solid #fde68a;">' +
        '<div style="font-size:13px;color:#334155;">' +
          '<strong>' + label + '</strong> — ' + c.month + ' ' + toPersianNum(c.year) +
          ' — ' + formatToman(c.total) + ' — ' + (c.payMethod || '—') + track +
        '</div>' +
        '<div style="display:flex;gap:6px;">' + rcptBtn +
          '<button type="button" class="btn btn-primary" data-approve-charge="' + c.id + '" style="padding:6px 14px;font-size:13px;">✅ تأیید پرداخت</button>' +
          '<button type="button" class="btn btn-danger" data-reject-charge="' + c.id + '" style="padding:6px 14px;font-size:13px;">✖ رد</button>' +
        '</div>' +
      '</div>'
    );
  }).join('');

  host.innerHTML =
    '<div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:14px;padding:14px 16px;">' +
      '<div style="font-weight:800;color:#b45309;margin-bottom:10px;">⏳ ' + formatNumber(all.length) + ' پرداخت در انتظار تأیید</div>' +
      '<div style="display:flex;flex-direction:column;gap:8px;">' + rows + '</div>' +
    '</div>';

  host.querySelectorAll('[data-approve-charge]').forEach(btn => {
    btn.addEventListener('click', () => {
      approveResidentPayment(Number(btn.dataset.approveCharge));
    });
  });
  host.querySelectorAll('[data-reject-charge]').forEach(btn => {
    btn.addEventListener('click', () => {
      rejectResidentPayment(Number(btn.dataset.rejectCharge));
    });
  });
  host.querySelectorAll('[data-view-receipt]').forEach(btn => {
    btn.addEventListener('click', () => viewChargeReceipt(Number(btn.dataset.viewReceipt)));
  });
}

function renderChargesTable(charges) {
  const tbody = document.getElementById('chargesTableBody');
  if (!tbody) return;

  if (charges.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" style="text-align:center;color:#94a3b8;padding:40px;">
          هنوز شارژی برای این ماه صادر نشده است.
          <br><br>
          <button class="btn btn-primary" onclick="document.getElementById('btnIssueCharge').click()">
            📤 صدور شارژ ${currentChargeMonth} ${toPersianNum(currentChargeYear)}
          </button>
        </td>
      </tr>`;
    return;
  }

  tbody.innerHTML = charges.map(c => {
    const unit = UNITS.find(u => Number(u.id) === Number(c.unitId));
    const blockName = unit?.block || c.block || '—';
    const unitNumber = unit ? toPersianNum(unit.number) : (c.unitNumber ? toPersianNum(c.unitNumber) : '—');
    const payer = payerOf(unit);
    const ownerName = payer.name ? escapeHtml(payer.name) : '<span style="color:#94a3b8;">ثبت‌نام نکرده</span>';

    let payMethodBadge = '<span style="color:#94a3b8;">—</span>';
    const methodIcons = {
      'نقدی': '💵',
      'کارت به کارت': '💳',
      'انتقال بانکی': '🏦',
      'واریز بانکی': '🏦',
      'آنلاین': '🌐',
      'چک': '📝',
    };
    if (c.payMethod) {
      const icon = methodIcons[c.payMethod] || '💰';
      payMethodBadge = `<span class="badge ${c.paid ? 'badge-paid' : 'badge-debt'}">${icon} ${c.payMethod}</span>`;
      if (c.trackingCode) {
        payMethodBadge += `<div style="font-size:11px;color:#64748b;margin-top:4px;direction:ltr;">${escapeHtml(c.trackingCode)}</div>`;
      }
    } else if (c.paid) {
      payMethodBadge = '<span class="badge badge-paid">💰 نامشخص</span>';
    }

    let statusBadge;
    if (c.paid) {
      statusBadge = '<span class="badge badge-paid">✅ پرداخت شده</span>';
    } else if (c.pendingApproval) {
      statusBadge = '<span class="badge" style="background:#fef3c7;color:#b45309;">⏳ در انتظار تأیید</span>';
    } else {
      statusBadge = '<span class="badge badge-debt">⚠️ پرداخت نشده</span>';
    }

    let actions = `<button class="row-action-btn" data-charge-id="${c.id}" title="${c.paid ? 'مدیریت پرداخت' : 'ثبت پرداخت'}">💳</button>`;
    if (c.receiptImage || c.receiptArchived) actions += `<button class="row-action-btn" data-view-receipt="${c.id}" title="مشاهده رسید">🧾</button>`;
    if (c.pendingApproval && !c.paid) {
      actions = `
        <button class="row-action-btn" data-approve-charge="${c.id}" title="تأیید پرداخت ساکن"
          style="background:#dcfce7;color:#15803d;border:1px solid #86efac;padding:4px 8px;border-radius:8px;font-size:12px;cursor:pointer;">
          ✅ تأیید
        </button>
        <button class="row-action-btn" data-reject-charge="${c.id}" title="رد اعلام پرداخت"
          style="background:#fee2e2;color:#b91c1c;border:1px solid #fca5a5;padding:4px 8px;border-radius:8px;font-size:12px;cursor:pointer;">
          ✖ رد
        </button>
        <button class="row-action-btn" data-charge-id="${c.id}" title="جزئیات">💳</button>
        ${c.receiptImage ? `<button class="row-action-btn" data-view-receipt="${c.id}" title="مشاهده رسید">🧾</button>` : ''}
      `;
    }

    return `
      <tr class="charge-row ${c.pendingApproval && !c.paid ? 'charge-pending' : ''}">
        <td><strong>${blockName}</strong></td>
        <td><strong>${unitNumber}</strong></td>
        <td>${ownerName}</td>
        <td>${formatToman(c.amount || 0)}</td>
        <td>${c.extra > 0 ? formatToman(c.extra) : '—'}</td>
        <td><strong>${formatToman(c.total || 0)}</strong></td>
        <td>${statusBadge}</td>
        <td>${payMethodBadge}</td>
        <td>
          <div class="row-actions" style="display:flex;gap:6px;flex-wrap:wrap;">${actions}</div>
        </td>
      </tr>
    `;
  }).join('');
}

function bindChargesPage() {
  const monthSelect = document.getElementById('chargeMonth');
  if (monthSelect) {
    monthSelect.addEventListener('change', (e) => {
      currentChargeMonth = e.target.value;
      renderChargesPage();
    });
  }

  const yearSelect = document.getElementById('chargeYear');
  if (yearSelect) {
    yearSelect.addEventListener('change', (e) => {
      currentChargeYear = e.target.value;
      renderChargesPage();
    });
  }

  const tbody = document.getElementById('chargesTableBody');
  if (tbody && !tbody._chargesBound) {
    tbody._chargesBound = true;
    tbody.addEventListener('click', (e) => {
      const approveBtn = e.target.closest('[data-approve-charge]');
      if (approveBtn) {
        const chargeId = Number(approveBtn.dataset.approveCharge);
        approveResidentPayment(chargeId);
        return;
      }
      const rcptBtn = e.target.closest('[data-view-receipt]');
      if (rcptBtn) { viewChargeReceipt(Number(rcptBtn.dataset.viewReceipt)); return; }
      const rejectBtn = e.target.closest('[data-reject-charge]');
      if (rejectBtn) {
        rejectResidentPayment(Number(rejectBtn.dataset.rejectCharge));
        return;
      }
      const btn = e.target.closest('[data-charge-id]');
      if (!btn) return;
      const chargeId = Number(btn.dataset.chargeId);
      openPayChargeModal(chargeId);
    });
  }
}

/** تأیید پرداخت اعلام‌شده توسط ساکن (کارت به کارت / انتقال) */
function approveResidentPayment(chargeId, skipConfirm) {
  const charges = loadCharges();
  const charge = charges.find(c => Number(c.id) === Number(chargeId));
  if (!charge) {
    toastWarning('شارژ پیدا نشد.');
    return;
  }
  if (charge.paid) {
    toastWarning('این شارژ قبلاً پرداخت شده است.');
    return;
  }
  if (!skipConfirm) { openPaymentReview(chargeId); return; }

  const now = new Date();
  // تاریخ وصول = تاریخ واریزی که ساکن اعلام کرده (نه لحظه تأیید مدیر)
  const declaredAt = charge.pendingAt || now.toISOString();
  const declaredDate = charge.receipt && parsePersianDateParts(charge.receipt.date) ? charge.receipt.date : null;
  charge.paid = true;
  charge.pendingApproval = false;
  charge.paidDate = declaredDate || charge.paidDate || getTodayPersianDateFromIso(declaredAt);
  charge.paidAt = declaredAt;
  charge.rejectedAt = null;
  charge.rejectReason = null;
  charge.approvedByManager = true;
  charge.approvedAt = now.toISOString();
  if (!charge.payMethod) charge.payMethod = 'واریز بانکی';
  archiveChargeReceipt(charge);

  saveCharges(charges);
  if (typeof updateUnitsDebtFromCharges === 'function') updateUnitsDebtFromCharges();

  renderChargesPage();
  if (typeof renderUnitsStats === 'function') renderUnitsStats();
  if (typeof renderUnitsPage === 'function') renderUnitsPage();
  if (typeof renderDashboard === 'function') renderDashboard();
  if (typeof renderPaymentsPage === 'function') {
    try { renderPaymentsPage(); } catch (e) {}
  }

  toastSuccess('پرداخت ساکن تأیید و شارژ تسویه شد.');
}

/* ============================================================
   🧾 رسید واریز ساکن
   عکس رسید فقط تا زمان بررسی داخل شارژ (و همگام‌سازی) می‌ماند؛
   بعد از تأیید در IndexedDB همین دستگاه مدیر بایگانی می‌شود تا داده همگام‌سازی سبک بماند.
   ============================================================ */
function _receiptDb() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) return reject(new Error('no_idb'));
    const req = indexedDB.open('apt_receipts', 1);
    req.onupgradeneeded = () => { req.result.createObjectStore('r'); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
function _receiptKey(chargeId) { return String(localStorage.getItem('ham_sakhteman_user_phone') || '') + ':' + String(chargeId); }
async function _receiptPut(chargeId, rec) {
  const db = await _receiptDb();
  await new Promise((res, rej) => { const tx = db.transaction('r', 'readwrite'); tx.objectStore('r').put(rec, _receiptKey(chargeId)); tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
}
async function _receiptGet(chargeId) {
  const db = await _receiptDb();
  return new Promise((res, rej) => { const tx = db.transaction('r', 'readonly'); const q = tx.objectStore('r').get(_receiptKey(chargeId)); q.onsuccess = () => res(q.result || null); q.onerror = () => rej(q.error); });
}
function archiveChargeReceipt(charge) {
  if (!charge || !charge.receiptImage) return;
  const rec = { image: charge.receiptImage, receipt: charge.receipt || null, trackingCode: charge.trackingCode || '', month: charge.month, year: charge.year, at: new Date().toISOString() };
  charge.receiptImage = null;
  charge.receiptArchived = true;
  _receiptPut(charge.id, rec).catch(e => console.warn('receipt archive failed', e));
}
async function viewChargeReceipt(chargeId, mode) {
  const charge = (loadCharges() || []).find(c => Number(c.id) === Number(chargeId));
  if (!charge) return;
  let img = charge.receiptImage || null;
  let info = charge.receipt || null;
  if (!img) {
    try { const rec = await _receiptGet(charge.id); if (rec) { img = rec.image; info = info || rec.receipt; } } catch (e) {}
  }
  const unit = UNITS.find(u => Number(u.id) === Number(charge.unitId));
  const label = unit ? ((unit.block && unit.block !== '—') ? (unit.block + '-' + toPersianNum(unit.number)) : ('واحد ' + toPersianNum(unit.number))) : '—';
  const rows = [
    ['واحد', label],
    ['دوره', charge.month + ' ' + toPersianNum(charge.year)],
    ['مبلغ', formatToman(charge.total || 0)],
    ['تاریخ واریز', (info && info.date) || charge.paidDate || '—'],
    ['شماره پیگیری', charge.trackingCode || '—'],
    ['روش', charge.payMethod || '—'],
    ...(info && info.kind === 'cash'
      ? [['تحویل به', info.to || '—']]
      : [['کارت مبدأ', info && info.card4 ? ('****' + toPersianNum(info.card4)) : '—']]),
  ].map(([k, v]) => `<div style="display:flex;justify-content:space-between;gap:10px;padding:7px 0;border-bottom:1px solid #f1f5f9;font-size:13px;"><span style="color:#64748b;">${k}</span><strong>${escapeHtml(String(v))}</strong></div>`).join('');
  const ov = document.createElement('div');
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,.6);z-index:10000;display:flex;align-items:center;justify-content:center;padding:16px;';
  ov.innerHTML = `<div style="background:#fff;border-radius:18px;max-width:440px;width:100%;max-height:92vh;overflow:auto;padding:18px;direction:rtl;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;"><strong style="font-size:16px;">🧾 ${charge.payMethod === 'نقدی' ? 'پرداخت نقدی' : 'رسید واریز'}</strong><button type="button" data-close style="border:none;background:#f1f5f9;border-radius:10px;padding:6px 12px;cursor:pointer;font-family:inherit;">✖</button></div>
      ${rows}
      ${mode ? `<div data-review style="margin-top:14px;">
        <div data-reject-box style="display:${mode === 'reject' ? 'block' : 'none'};margin-bottom:10px;">
          <label style="font-size:13px;font-weight:700;display:block;margin-bottom:6px;">دلیل رد (برای ساکن نمایش داده می‌شود)</label>
          <input type="text" data-reason class="form-input" value="این واریز در حساب دیده نشد" style="width:100%;box-sizing:border-box;">
        </div>
        <div style="display:flex;gap:8px;">
          <button type="button" data-do-approve class="btn btn-primary" style="flex:1;padding:10px;">✅ تأیید پرداخت</button>
          <button type="button" data-do-reject class="btn btn-danger" style="flex:1;padding:10px;">✖ رد پرداخت</button>
        </div>
      </div>` : ''}
      <div style="margin-top:12px;text-align:center;">${img ? `<a href="${img}" download="receipt-${charge.id}.jpg"><img src="${img}" alt="رسید" style="max-width:100%;border-radius:12px;border:1px solid #e2e8f0;"></a>` : (charge.payMethod === 'نقدی' ? '' : '<div style="color:#94a3b8;font-size:13px;padding:20px;">عکس رسید ارسال نشده یا روی این دستگاه موجود نیست.</div>')}</div>
    </div>`;
  ov.addEventListener('click', e => {
    if (e.target === ov || e.target.closest('[data-close]')) { ov.remove(); return; }
    if (e.target.closest('[data-do-approve]')) { ov.remove(); approveResidentPayment(charge.id, true); return; }
    if (e.target.closest('[data-do-reject]')) {
      const box = ov.querySelector('[data-reject-box]');
      if (box && box.style.display === 'none') { box.style.display = 'block'; ov.querySelector('[data-reason]')?.focus(); return; }
      const reason = (ov.querySelector('[data-reason]')?.value || '').trim();
      ov.remove(); rejectResidentPayment(charge.id, reason || 'رد شده توسط مدیر');
    }
  });
  document.body.appendChild(ov);
}
/** بررسی اعلام واریز ساکن: جزئیات + رسید + دکمه‌های تأیید/رد (بدون confirm/prompt مرورگر) */
function openPaymentReview(chargeId, mode) {
  const charge = (loadCharges() || []).find(c => Number(c.id) === Number(chargeId));
  if (!charge || charge.paid || !charge.pendingApproval) { toastWarning('این اعلام پرداخت پیدا نشد یا قبلاً بررسی شده.'); return; }
  viewChargeReceipt(chargeId, mode || 'review');
}

/** ISO → «۱۴۰۵/۰۸/۱۳» */
function getTodayPersianDateFromIso(iso) {
  const p = isoToPersianParts(iso) || getTodayPersian();
  return toPersianNum(`${p.year}/${String(p.month).padStart(2, '0')}/${String(p.day).padStart(2, '0')}`);
}

/** رد اعلام پرداخت ساکن (مثلاً شماره پیگیری نامعتبر) */
function rejectResidentPayment(chargeId, givenReason) {
  const charges = loadCharges();
  const charge = charges.find(c => Number(c.id) === Number(chargeId));
  if (!charge || charge.paid || !charge.pendingApproval) {
    toastWarning('این اعلام پرداخت پیدا نشد یا قبلاً بررسی شده.');
    return;
  }
  if (givenReason == null) { openPaymentReview(chargeId, 'reject'); return; }
  const reason = String(givenReason);

  const tracking = charge.trackingCode;
  clearChargePayment(charge);
  charge.rejectedAt = new Date().toISOString();
  charge.rejectReason = reason.trim() || 'رد شده توسط مدیر';
  charge.lastRejectedTracking = tracking || null;

  saveCharges(charges);
  updateUnitsDebtFromCharges();
  renderChargesPage();
  if (typeof renderDashboard === 'function') renderDashboard();
  toastInfo('اعلام پرداخت رد شد و شارژ دوباره «پرداخت نشده» است.');
}

/* ============================================================
   صدور شارژ
   ============================================================ */
function openIssueChargeModal() {
  const modal = document.getElementById('issueChargeModal');

  fillYearMonthDropdowns('issueYear', 'issueMonth');

  const issueMonth = document.getElementById('issueMonth');
  const issueYear = document.getElementById('issueYear');
  if (issueMonth) issueMonth.value = currentChargeMonth;
  if (issueYear) issueYear.value = currentChargeYear;

  const blockSelect = document.getElementById('issueBlockSelect');
  const data = loadData();
  if (blockSelect && data?.building) {
    blockSelect.innerHTML = '<option value="all">🏢 همه بلوک‌ها</option>';
    if (data.building.type === 'complex') {
      data.building.blocks.forEach(b => {
        const opt = document.createElement('option');
        opt.value = String(b.name).trim();
        opt.textContent = String(b.name).trim();
        blockSelect.appendChild(opt);
      });
    }
  }

  // ✅ به‌جای اعداد ساختگی (۵۰۰ هزار، ۵ هزار/متر ...) از تنظیمات مالی و آخرین صدور استفاده می‌شود
  const settings = loadSettings();
  const monthly = Number(settings.monthlyCharge) || 0;
  const last = settings.lastChargeConfig || null;
  const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v || ''; };
  const setChk = (id, v) => { const el = document.getElementById(id); if (el) el.checked = !!v; };

  if (last) {
    setVal('chargeCalcType', last.type || 'fixed');
    setVal('issueBaseCharge', last.baseCharge);
    setVal('issuePricePerMeter', last.pricePerMeter);
    setVal('issueBaseChargeForArea', last.baseChargeForArea);
    setVal('issuePricePerPerson', last.pricePerPerson);
    setVal('issueBaseChargeCombined', last.baseChargeCombined);
    setVal('issuePricePerMeterCombined', last.pricePerMeterCombined);
    setVal('issuePricePerPersonCombined', last.pricePerPersonCombined);
    setVal('issueExtraChargeCombined', last.extraChargeCombined);
    setVal('issueDefaultCustomAmount', last.defaultCustomAmount);
    setChk('includeBaseCharge', last.includeBaseCharge);
    setChk('includeAreaCharge', last.includeAreaCharge);
    setChk('includeWaterCharge', last.includeWaterCharge);
    setChk('includeExtraCharge', last.includeExtraCharge);
  } else {
    setVal('chargeCalcType', 'fixed');
    setVal('issueBaseCharge', monthly);
    setVal('issuePricePerMeter', '');
    setVal('issueBaseChargeForArea', '');
    setVal('issuePricePerPerson', '');
    setVal('issueBaseChargeCombined', monthly);
    setVal('issuePricePerMeterCombined', '');
    setVal('issuePricePerPersonCombined', '');
    setVal('issueExtraChargeCombined', '');
    setVal('issueDefaultCustomAmount', monthly);
    setChk('includeBaseCharge', true);
    setChk('includeAreaCharge', false);
    setChk('includeWaterCharge', false);
    setChk('includeExtraCharge', false);
  }
  document.getElementById('issueUnitStatusFilter').value = 'all';

  // مهلت پرداخت از تنظیمات: روز N همان ماه
  const deadline = Number(settings.paymentDeadline) || 0;
  const mIdx = PERSIAN_MONTHS.indexOf(currentChargeMonth) + 1;
  document.getElementById('issueDueDate').value = (deadline > 0 && mIdx > 0)
    ? toPersianNum(`${currentChargeYear}/${String(mIdx).padStart(2, '0')}/${String(Math.min(deadline, mIdx <= 6 ? 31 : (mIdx <= 11 ? 30 : (typeof isPersianLeapYear === 'function' && isPersianLeapYear(Number(currentChargeYear)) ? 30 : 29)))).padStart(2, '0')}`)
    : '';
  document.getElementById('issueDescription').value = '';

  toggleChargeSections();
  updateIssuePreview();
  modal.classList.add('open');
}

function toggleChargeSections() {
  const type = document.getElementById('chargeCalcType')?.value || 'combined';

  const sections = {
    fixed: 'fixedSection',
    area: 'areaSection',
    people: 'peopleSection',
    combined: 'combinedSection',
    custom: 'customSection',
    default: 'defaultSection',
    'expenses': 'expensesSection',
    'fixed-expenses': 'fixedExpensesSection',
    'default-expenses': 'defaultExpensesSection',
    'distributed': 'distributedSection',
  };

  Object.values(sections).forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });

  const target = sections[type];
  if (target) {
    const el = document.getElementById(target);
    if (el) el.style.display = 'block';
  }
}

function closeIssueChargeModal() {
  document.getElementById('issueChargeModal').classList.remove('open');
}
function isUnitEmpty(unit) {
  if (!unit) return true;

  if (unit.status === 'empty') return true;
  if (unit.status === 'occupied') return false;

  // خودکار: اگه مالک یا ساکن یا نفرات داره → پر
  const hasOwner = unit.owner?.name && unit.owner.name.trim() !== '';
  const hasTenant = unit.tenant?.name && unit.tenant.name.trim() !== '';
  const hasPeople = (unit.peopleCount || 0) > 0;

  return !hasOwner && !hasTenant && !hasPeople;
}

function calculateUnitCharge(unit, chargeConfig) {
  const type = chargeConfig.type;

  if (type === 'custom') {
    return chargeConfig.defaultCustomAmount || 0;
  }

  if (type === 'fixed') {
    return chargeConfig.baseCharge || 0;
  }

  if (type === 'area') {
    return (unit.area || 0) * (chargeConfig.pricePerMeter || 0) + (chargeConfig.baseChargeForArea || 0);
  }

  if (type === 'people') {
    return (unit.peopleCount || 0) * (chargeConfig.pricePerPerson || 0);
  }

  if (type === 'default') {
    // شارژ پیش‌فرض واحد: اگر مستاجر دارد مبلغ مستاجر، وگرنه مبلغ مالک
    const hasTenant = !!(unit.tenant?.name || unit.tenant?.registered);
    const roleDefault = hasTenant ? Number(unit.defaultChargeTenant) : Number(unit.defaultChargeOwner);
    return roleDefault > 0 ? roleDefault : (Number(unit.chargeAmount) || 0);
  }

  if (type === 'combined') {
    let total = 0;

    if (chargeConfig.includeBaseCharge) {
      total += chargeConfig.baseChargeCombined || 0;
    }

    if (chargeConfig.includeAreaCharge) {
      total += (unit.area || 0) * (chargeConfig.pricePerMeterCombined || 0);
    }

    if (chargeConfig.includeWaterCharge) {
      const peopleCount = isUnitEmpty(unit) ? 0 : (unit.peopleCount || 0);
      total += peopleCount * (chargeConfig.pricePerPersonCombined || 0);
    }

    if (chargeConfig.includeExtraCharge) {
      total += chargeConfig.extraChargeCombined || 0;
    }

    return total;
  }

  return 0;
}

function isUnitEmpty(unit) {
  if (unit.status === 'empty') return true;
  if (unit.status === 'occupied') return false;

  const hasOwner = unit.owner?.name && unit.owner.name.trim() !== '';
  const hasTenant = unit.tenant?.name && unit.tenant.name.trim() !== '';
  const hasPeople = (unit.peopleCount || 0) > 0;

  return !hasOwner && !hasTenant && !hasPeople;
}

function getChargeConfigFromForm() {
  const type = document.getElementById('chargeCalcType')?.value || 'combined';

  return {
    type: type,
    baseCharge: parseInt(document.getElementById('issueBaseCharge')?.value) || 0,
    pricePerMeter: parseInt(document.getElementById('issuePricePerMeter')?.value) || 0,
    baseChargeForArea: parseInt(document.getElementById('issueBaseChargeForArea')?.value) || 0,
    pricePerPerson: parseInt(document.getElementById('issuePricePerPerson')?.value) || 0,
    baseChargeCombined: parseInt(document.getElementById('issueBaseChargeCombined')?.value) || 0,
    pricePerMeterCombined: parseInt(document.getElementById('issuePricePerMeterCombined')?.value) || 0,
    pricePerPersonCombined: parseInt(document.getElementById('issuePricePerPersonCombined')?.value) || 0,
    extraChargeCombined: parseInt(document.getElementById('issueExtraChargeCombined')?.value) || 0,
    defaultCustomAmount: parseInt(document.getElementById('issueDefaultCustomAmount')?.value) || 0,
    includeBaseCharge: document.getElementById('includeBaseCharge')?.checked || false,
    includeAreaCharge: document.getElementById('includeAreaCharge')?.checked || false,
    includeWaterCharge: document.getElementById('includeWaterCharge')?.checked || false,
    includeExtraCharge: document.getElementById('includeExtraCharge')?.checked || false,
  };
}

function updateIssuePreview() {
  const data = loadData();
  if (!data?.building) return;

  const blockFilter = document.getElementById('issueBlockSelect')?.value || 'all';
  const statusFilter = document.getElementById('issueUnitStatusFilter')?.value || 'all';
  const chargeConfig = getChargeConfigFromForm();

  let units = UNITS;
  if (blockFilter !== 'all') {
    units = units.filter(u => String(u.block).trim() === String(blockFilter).trim());
  }

  if (statusFilter === 'occupied') {
    units = units.filter(u => !isUnitEmpty(u));
  } else if (statusFilter === 'empty') {
    units = units.filter(u => isUnitEmpty(u));
  }

  let total = 0;
  units.forEach(u => {
    total += calculateUnitCharge(u, chargeConfig);
  });

  const elCount = document.getElementById('issueUnitCount');
  const elTotal = document.getElementById('issueTotalAmount');

  if (elCount) elCount.textContent = formatNumber(units.length);
  if (elTotal) elTotal.textContent = formatToman(total);
}

/* ============================================================
   ✅ صدور شارژ — تابع اصلی (اضافه‌شده)
   ============================================================ */
async function issueChargeConfirm() {
  const month = document.getElementById('issueMonth')?.value;
  const year = document.getElementById('issueYear')?.value;
  const blockFilter = document.getElementById('issueBlockSelect')?.value || 'all';
  const statusFilter = document.getElementById('issueUnitStatusFilter')?.value || 'all';
  const dueDate = document.getElementById('issueDueDate')?.value || '';
  const description = document.getElementById('issueDescription')?.value || '';
  const chargeConfig = getChargeConfigFromForm();

  if (!month || !year) {
    toastWarning('لطفاً ماه و سال را انتخاب کنید.');
    return;
  }

  let units = UNITS;

  if (blockFilter !== 'all') {
    units = units.filter(u => String(u.block).trim() === String(blockFilter).trim());
  }

  if (statusFilter === 'occupied') {
    units = units.filter(u => !isUnitEmpty(u));
  } else if (statusFilter === 'empty') {
    units = units.filter(u => isUnitEmpty(u));
  }

  if (units.length === 0) {
    toastWarning('واحدی برای صدور شارژ پیدا نشد.');
    return;
  }

  // ✅ اصلاح حسابداری: فقط شارژهای «همین واحدها» در این ماه بررسی می‌شوند
  // و شارژهای پرداخت‌شده یا در انتظار تأیید هرگز حذف نمی‌شوند.
  const unitIds = new Set(units.map(u => Number(u.id)));
  const existingCharges = getChargesForMonth(month, year).filter(c => unitIds.has(Number(c.unitId)));
  const lockedCharges = existingCharges.filter(c => c.paid || c.pendingApproval);
  const replaceableCharges = existingCharges.filter(c => !c.paid && !c.pendingApproval);
  const lockedUnitIds = new Set(lockedCharges.map(c => Number(c.unitId)));

  if (existingCharges.length > 0) {
    let msg = `⚠️ برای ${month} ${toPersianNum(year)} قبلاً برای ${toPersianNum(existingCharges.length)} واحد شارژ صادر شده.`;
    if (replaceableCharges.length) msg += `\n• ${toPersianNum(replaceableCharges.length)} شارژ پرداخت‌نشده با مبلغ جدید جایگزین می‌شود.`;
    if (lockedCharges.length) msg += `\n• ${toPersianNum(lockedCharges.length)} شارژ پرداخت‌شده/در انتظار تأیید دست نمی‌خورد.`;
    msg += '\n\nادامه می‌دهید؟';
    if (!(await appConfirm(msg))) return;
  }

  let charges = loadCharges();
  if (replaceableCharges.length > 0) {
    const replaceIds = new Set(replaceableCharges.map(c => c.id));
    charges = charges.filter(c => !replaceIds.has(c.id));
  }

  let lastId = Math.max(Date.now(), ...charges.map(c => Number(c.id) || 0)); // یکتا بین چند دستگاه

  const targetUnits = units.filter(u => !lockedUnitIds.has(Number(u.id)));
  if (targetUnits.length === 0) {
    toastInfo('همه واحدهای انتخاب‌شده برای این ماه پرداخت کرده‌اند؛ شارژ جدیدی صادر نشد.');
    return;
  }

  const newCharges = targetUnits.map(u => {
    const amount = Math.max(0, Math.round(calculateUnitCharge(u, chargeConfig)));
    return {
      id: ++lastId,
      month: month,
      year: String(year),
      unitId: u.id,
      block: u.block,
      unitNumber: u.number,
      amount: amount,
      extra: 0,
      total: amount,
      paid: false,
      paidDate: null,
      dueDate: dueDate,
      description: description,
      calcType: chargeConfig.type,
      issuedAt: new Date().toISOString(),
    };
  }).filter(c => c.total > 0);

  if (newCharges.length === 0) {
    toastWarning('مبلغ شارژ برای همه واحدها صفر شد. تنظیمات محاسبه را بررسی کنید.');
    return;
  }

  charges = charges.concat(newCharges);
  saveCharges(charges);

  // آخرین تنظیمات صدور برای دفعه بعد
  try {
    const st = loadSettings();
    st.lastChargeConfig = chargeConfig;
    saveSettings(st);
  } catch (e) {}

  updateUnitsDebtFromCharges();

  closeIssueChargeModal();

  currentChargeMonth = month;
  currentChargeYear = String(year);
  renderChargesPage();

  const msg = blockFilter === 'all'
    ? `شارژ ${month} ${toPersianNum(year)} برای ${toPersianNum(newCharges.length)} واحد صادر شد.`
    : `شارژ بلوک ${blockFilter} برای ${month} ${toPersianNum(year)} (${toPersianNum(newCharges.length)} واحد) صادر شد.`;

  toastSuccess(msg);
}

/** بدهی واحدها را از روی شارژها (که ممکن است از دستگاه دیگر همگام شده باشند) تازه می‌کند */
function refreshUnitsDebtIfStale() {
  try {
    const charges = loadCharges() || [];
    if (!charges.length || !Array.isArray(UNITS)) return;
    let changed = false;
    UNITS.forEach(unit => {
      const own = charges.filter(c => Number(c.unitId) === Number(unit.id));
      if (!own.length) return; // واحد بدون شارژ: بدهی دستی مدیر دست نخورد
      const d = own.filter(c => !c.paid).reduce((s, c) => s + (Number(c.total) || 0), 0);
      if (Number(unit.debt) !== d || unit.debtExplicit !== true) { unit.debt = d; unit.debtExplicit = true; changed = true; }
    });
    if (changed) saveUnits();
  } catch (e) { console.warn('refreshUnitsDebt', e); }
}

function updateUnitsDebtFromCharges() {
  const charges = loadCharges();

  UNITS.forEach(unit => {
    const unpaid = charges.filter(c =>
      Number(c.unitId) === Number(unit.id) && !c.paid
    );
    const totalDebt = unpaid.reduce((s, c) => s + (Number(c.total) || 0), 0);
    unit.debt = totalDebt;
    unit.debtExplicit = true;
  });

  saveUnits();
}

function bindIssueChargeModal() {
  document.getElementById('btnIssueCharge')?.addEventListener('click', openIssueChargeModal);
  document.getElementById('issueCancelBtn')?.addEventListener('click', closeIssueChargeModal);
  document.getElementById('issueConfirmBtn')?.addEventListener('click', issueChargeConfirm);

  document.getElementById('chargeCalcType')?.addEventListener('change', () => {
    toggleChargeSections();
    updateIssuePreview();
  });

  const inputs = [
    'issueMonth', 'issueYear', 'issueBlockSelect', 'issueUnitStatusFilter',
    'issueBaseCharge', 'issuePricePerMeter', 'issueBaseChargeForArea',
    'issuePricePerPerson',
    'issueBaseChargeCombined', 'issuePricePerMeterCombined',
    'issuePricePerPersonCombined', 'issueExtraChargeCombined',
    'issueDefaultCustomAmount',
    'includeBaseCharge', 'includeAreaCharge', 'includeWaterCharge', 'includeExtraCharge',
  ];

  inputs.forEach(id => {
    document.getElementById(id)?.addEventListener('input', updateIssuePreview);
    document.getElementById(id)?.addEventListener('change', updateIssuePreview);
  });

  const modal = document.getElementById('issueChargeModal');
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeIssueChargeModal();
    });
  }
}

/* ============================================================
   ثبت پرداخت شارژ
   ============================================================ */
let currentPayChargeId = null;

function openPayChargeModal(chargeId) {
  const charges = loadCharges();
  const charge = charges.find(c => c.id === chargeId);
  if (!charge) {
    toastWarning('شارژ پیدا نشد.');
    return;
  }

  currentPayChargeId = chargeId;

  const unit = UNITS.find(u => u.id === charge.unitId);
  const unitLabel = unit
    ? `${unit.block}-${toPersianNum(unit.number)}`
    : '—';

  const payUnitLabel = document.getElementById('payUnitLabel');
  const payMonthLabel = document.getElementById('payMonthLabel');
  const payTotalLabel = document.getElementById('payTotalLabel');
  const payStatusLabel = document.getElementById('payStatusLabel');
  const subtitle = document.getElementById('payChargeSubtitle');

  if (payUnitLabel) payUnitLabel.textContent = unitLabel;
  if (payMonthLabel) payMonthLabel.textContent = `${charge.month} ${toPersianNum(charge.year)}`;
  if (payTotalLabel) payTotalLabel.textContent = formatToman(charge.total || 0);

  if (payStatusLabel) {
    if (charge.paid) {
      payStatusLabel.textContent = '✅ پرداخت شده';
      payStatusLabel.style.color = '#15803d';
    } else {
      payStatusLabel.textContent = '⚠️ پرداخت نشده';
      payStatusLabel.style.color = '#b91c1c';
    }
  }

  if (subtitle) subtitle.textContent = `واحد ${unitLabel} — ${charge.month} ${toPersianNum(charge.year)}`;

  const today = getTodayPersianDateFromIso(new Date().toISOString());
  const payDate = document.getElementById('payDate');
  if (payDate) payDate.value = charge.paidDate || today;

  const payMethod = document.getElementById('payMethod');
  if (payMethod) payMethod.value = charge.payMethod || 'نقدی';

  const payDescription = document.getElementById('payDescription');
  if (payDescription) payDescription.value = charge.payDescription || '';

  const modal = document.getElementById('payChargeModal');
  if (modal) modal.classList.add('open');

  const confirmBtn = document.getElementById('payConfirmBtn');
  if (confirmBtn) {
    if (charge.paid) {
      confirmBtn.textContent = '🔓 لغو پرداخت';
      confirmBtn.className = 'btn btn-danger';
    } else {
      confirmBtn.textContent = '✅ تأیید پرداخت';
      confirmBtn.className = 'btn btn-primary';
    }
  }
}

function closePayChargeModal() {
  document.getElementById('payChargeModal').classList.remove('open');
  currentPayChargeId = null;
}

async function confirmPayCharge() {
  if (!currentPayChargeId) return;

  const charges = loadCharges();
  const charge = charges.find(c => c.id === currentPayChargeId);
  if (!charge) {
    toastWarning('شارژ پیدا نشد.');
    return;
  }

  const payDate = document.getElementById('payDate')?.value || '';
  const payMethod = document.getElementById('payMethod')?.value || 'نقدی';
  const payDescription = document.getElementById('payDescription')?.value || '';

  if (charge.paid) {
    if (!(await appConfirm('⚠️ آیا از لغو پرداخت این شارژ مطمئن هستید؟'))) return;

    clearChargePayment(charge);
    saveCharges(charges);
    updateUnitsDebtFromCharges();
    closePayChargeModal();
    renderChargesPage();
    renderUnitsStats();
    renderUnitsPage();
    renderDashboard();
    toastSuccess('پرداخت لغو شد.');
    return;
  }

  if (!payDate) {
    toastWarning('لطفاً تاریخ پرداخت را وارد کنید.');
    return;
  }

  if (!parsePersianDateParts(payDate)) {
    toastWarning('تاریخ پرداخت را به شکل ۱۴۰۵/۰۸/۱۳ وارد کنید.');
    return;
  }

  charge.paid = true;
  charge.paidDate = payDate;
  charge.payMethod = payMethod;
  charge.payDescription = payDescription;
  charge.paidAt = new Date().toISOString();
  charge.pendingApproval = false;
  charge.rejectedAt = null;
  charge.rejectReason = null;
  archiveChargeReceipt(charge);

  saveCharges(charges);
  updateUnitsDebtFromCharges();

  closePayChargeModal();
  renderChargesPage();
  renderUnitsStats();
  renderUnitsPage();
  renderDashboard();

  toastSuccess('پرداخت با موفقیت ثبت شد.');
}

function bindPayChargeModal() {
  document.getElementById('payCancelBtn')?.addEventListener('click', closePayChargeModal);
  document.getElementById('payConfirmBtn')?.addEventListener('click', confirmPayCharge);

  const modal = document.getElementById('payChargeModal');
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closePayChargeModal();
    });
  }
}

/* ============================================================
   صفحه پرداخت‌ها
   ============================================================ */
let paymentsSortColumn = 'date';
let paymentsSortDirection = 'desc';
let paymentsSearchQuery = '';
let paymentsMonthFilter = 'all';
let paymentsYearFilter = String(getTodayPersianYear());

function getPaidCharges() {
  const charges = loadCharges();
  return charges.filter(c => c.paid === true);
}

function getFilteredPayments() {
  let list = getPaidCharges();

  // فیلتر بر اساس تاریخ واقعی پرداخت (ماه + سال)، نه فقط نام ماه
  if (paymentsMonthFilter !== 'all' || paymentsYearFilter !== 'all') {
    list = list.filter(c => {
      const p = getChargeCashPeriod(c);
      if (paymentsYearFilter !== 'all' && String(p.year) !== String(paymentsYearFilter)) return false;
      if (paymentsMonthFilter !== 'all' && p.month !== paymentsMonthFilter) return false;
      return true;
    });
  }

  if (paymentsSearchQuery.trim() !== '') {
    const q = paymentsSearchQuery.trim().toLowerCase();
    list = list.filter(c => {
      const unit = UNITS.find(u => u.id === c.unitId);
      const ownerName = (unit?.owner?.name || '').toLowerCase();
      const block = (c.block || '').toLowerCase();
      const method = (c.payMethod || '').toLowerCase();
      const desc = (c.payDescription || '').toLowerCase();
      const number = String(unit?.number || '');

      return (
        ownerName.includes(q) ||
        block.includes(q) ||
        method.includes(q) ||
        desc.includes(q) ||
        number.includes(q)
      );
    });
  }

  if (paymentsSortColumn) {
    list = [...list].sort((a, b) => {
      let valA, valB;

      switch (paymentsSortColumn) {
        case 'date':
          // مرتب‌سازی عددی تاریخ شمسی (قبلاً متنی بود و ۱۴۰۵/۱۰/۲ قبل از ۱۴۰۵/۹/۵ می‌آمد)
          valA = persianDateSortKey(a.paidDate, a.paidAt);
          valB = persianDateSortKey(b.paidDate, b.paidAt);
          break;
        case 'block':
          valA = String(a.block || '').trim();
          valB = String(b.block || '').trim();
          break;
        case 'unit':
          const uA = UNITS.find(u => u.id === a.unitId);
          const uB = UNITS.find(u => u.id === b.unitId);
          valA = uA?.number || 0;
          valB = uB?.number || 0;
          break;
        case 'owner':
          const oA = UNITS.find(u => u.id === a.unitId);
          const oB = UNITS.find(u => u.id === b.unitId);
          valA = String(oA?.owner?.name || '').trim();
          valB = String(oB?.owner?.name || '').trim();
          break;
        case 'amount':
          valA = Number(a.total) || 0;
          valB = Number(b.total) || 0;
          break;
        case 'method':
          valA = String(a.payMethod || '').trim();
          valB = String(b.payMethod || '').trim();
          break;
        default:
          return 0;
      }

      let result;
      if (typeof valA === 'number' && typeof valB === 'number') {
        result = valA - valB;
      } else {
        result = String(valA).localeCompare(String(valB), 'fa');
      }

      return paymentsSortDirection === 'asc' ? result : -result;
    });
  }

  return list;
}

function renderPaymentsStats() {
  const allPaid = getPaidCharges();

  const total = allPaid.length;
  // تعداد پرداخت‌های ماه جاری تقویم (قبلاً به ماه انتخاب‌شده در صفحه شارژ وابسته بود)
  const thisMonth = allPaid.filter(c =>
    isChargeCollectedIn(c, getTodayPersianMonth(), String(getTodayPersianYear()))
  ).length;
  const sum = allPaid.reduce((s, c) => s + (Number(c.total) || 0), 0);
  const avg = total > 0 ? Math.round(sum / total) : 0;

  const elTotal = document.getElementById('paymentsTotal');
  const elThisMonth = document.getElementById('paymentsThisMonth');
  const elSum = document.getElementById('paymentsSum');
  const elAvg = document.getElementById('paymentsAvg');

  if (elTotal) elTotal.textContent = formatNumber(total);
  if (elThisMonth) elThisMonth.textContent = formatNumber(thisMonth);
  if (elSum) elSum.textContent = formatToman(sum);
  if (elAvg) elAvg.textContent = formatToman(avg);
}

/* ============================================================
   🏪 صفحه درآمد جانبی
   ============================================================ */
let sideIncomeBlockFilter = 'all';
let sideIncomeMonthFilter = 'all';
let sideIncomeYearFilter = String(getTodayPersianYear());
let sideIncomeSessionFilter = 'all';
let currentEditSideIncomeId = null;

const SIDE_INCOME_SESSIONS = {
  'اجاره سالن': ['سانس صبح (۸-۱۲)', 'سانس عصر (۱۴-۱۸)', 'سانس شب (۱۹-۲۳)'],
  'اجاره استخر': ['سانس آقایان', 'سانس بانوان', 'سانس کودک'],
  'اجاره باشگاه': ['سانس صبح', 'سانس عصر', 'سانس شب'],
  'اجاره سالن ورزش': ['سانس صبح', 'سانس عصر', 'سانس شب'],
  'اجاره مغازه': ['ماهانه', 'سالانه'],
  'اجاره پارکینگ': ['ماهانه', 'سالانه'],
  'اجاره آنتن': ['ماهانه', 'سالانه'],
  'سایر': ['سانس صبح', 'سانس عصر', 'سانس شب', 'تمام روز'],
};

function getSessionsForCategory(category) {
  return SIDE_INCOME_SESSIONS[category] || SIDE_INCOME_SESSIONS['سایر'];
}

function getSideIncomesKey() {
  return getAccountStorageKey('ham_sakhteman_side_incomes');
}

function loadSideIncomes() {
  const raw = localStorage.getItem(getSideIncomesKey());
  if (raw) { try { return JSON.parse(raw); } catch (e) { return []; } }
  return [];
}

function saveSideIncomes(incomes) {
  localStorage.setItem(getSideIncomesKey(), JSON.stringify(incomes));
}

function getFilteredSideIncomes() {
  let list = loadSideIncomes();

  if (sideIncomeBlockFilter !== 'all') {
    list = list.filter(i => (i.block || 'all') === sideIncomeBlockFilter);
  }

  if (sideIncomeMonthFilter !== 'all') {
    list = list.filter(i => i.month === sideIncomeMonthFilter);
  }

  if (sideIncomeYearFilter && sideIncomeYearFilter !== 'all') {
    list = list.filter(i => i.year === sideIncomeYearFilter);
  }

  if (sideIncomeSessionFilter && sideIncomeSessionFilter !== 'all') {
    list = list.filter(i => i.session === sideIncomeSessionFilter);
  }

  return list;
}

function renderSideIncomesStats() {
  const all = loadSideIncomes();
  const total = all.length;

  const filtered = getFilteredSideIncomes();
  const sum = filtered.reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const avg = filtered.length > 0 ? Math.round(sum / filtered.length) : 0;

  const currentMonth = getTodayPersianMonth();
  const currentYear = String(getTodayPersianYear());
  const thisMonth = all
    .filter(i => i.month === currentMonth && i.year === currentYear)
    .reduce((s, i) => s + (Number(i.amount) || 0), 0);

  const elTotal = document.getElementById('sideIncomeTotal');
  const elSum = document.getElementById('sideIncomeSum');
  const elThisMonth = document.getElementById('sideIncomeThisMonth');
  const elAvg = document.getElementById('sideIncomeAvg');

  if (elTotal) elTotal.textContent = formatNumber(total);
  if (elSum) elSum.textContent = formatToman(sum);
  if (elThisMonth) elThisMonth.textContent = formatToman(thisMonth);
  if (elAvg) elAvg.textContent = formatToman(avg);
}

function renderSideIncomesPage() {
  renderSideIncomesStats();

  const tbody = document.getElementById('sideIncomesTableBody');
  const countLabel = document.getElementById('sideIncomeCountLabel');
  if (!tbody) return;

  const incomes = getFilteredSideIncomes();

  if (countLabel) {
    countLabel.textContent = `${formatNumber(incomes.length)} مورد`;
  }

  if (incomes.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="10" style="text-align:center;color:#94a3b8;padding:40px;">
          هنوز درآمد جانبی ثبت نشده است.
          <br><br>
          <button class="btn btn-primary" onclick="document.getElementById('btnAddSideIncome').click()">
            ➕ ثبت اولین درآمد
          </button>
        </td>
      </tr>`;
    return;
  }

  const categoryIcons = {
    'اجاره مغازه': '🏪',
    'اجاره پارکینگ': '🚗',
    'اجاره آنتن': '📡',
    'تبلیغات': '📢',
    'اجاره سالن': '🎉',
    'سپرده': '🗝️',
    'سایر': '📦',
  };

  tbody.innerHTML = incomes.map(i => {
    const icon = categoryIcons[i.category] || '📦';

    const blockLabel = (i.block && i.block !== 'all')
      ? `<span class="badge badge-paid">🏢 ${i.block}</span>`
      : '<span style="color:#94a3b8;">🏢 کلی</span>';

    const methodIcons = {
      'نقدی': '💵',
      'کارت به کارت': '💳',
      'انتقال بانکی': '🏦',
      'واریز بانکی': '🏦',
      'چک': '📝',
    };
    const methodIcon = methodIcons[i.method] || '💰';

    return `
      <tr>
        <td>${i.date || '—'}</td>
        <td><strong>${i.title || '—'}</strong></td>
        <td><span class="badge badge-paid">${icon} ${i.category || 'سایر'}</span></td>
        <td><span class="badge badge-paid">${i.session || '—'}</span></td>
        <td>${blockLabel}</td>
        <td>${i.payer || '—'}</td>
        <td><strong style="color:#15803d;">${formatToman(i.amount || 0)}</strong></td>
        <td><span class="badge badge-paid">${methodIcon} ${i.method || '—'}</span></td>
        <td style="color:#64748b; font-size:12.5px;">${i.description || '—'}</td>
        <td>
          <div class="row-actions">
            <button class="row-action-btn" data-side-income-action="edit" data-id="${i.id}" title="ویرایش">✏️</button>
            <button class="row-action-btn danger" data-side-income-action="delete" data-id="${i.id}" title="حذف">🗑️</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function openSideIncomeModal(incomeId = null) {
  currentEditSideIncomeId = incomeId;

  const modal = document.getElementById('sideIncomeModal');
  if (!modal) {
    console.error('❌ sideIncomeModal پیدا نشد!');
    toastError('خطا در باز کردن مودال.');
    return;
  }

  const title = document.getElementById('sideIncomeModalTitle');
  const subtitle = document.getElementById('sideIncomeModalSubtitle');

  // پر کردن دراپ‌داون ماه و سال
  if (typeof fillYearMonthDropdowns === 'function') {
    fillYearMonthDropdowns('sideIncomeModalYear', 'sideIncomeModalMonth');
  }

  // پر کردن لیست بلوک
  const blockSelect = document.getElementById('sideIncomeBlockSelect');
  const blockSection = document.getElementById('sideIncomeBlockSection');
  const data = loadData();

  if (blockSelect && data?.building) {
    blockSelect.innerHTML = '<option value="all">🏢 کل ساختمان</option>';

    if (data.building.type === 'complex') {
      data.building.blocks.forEach(b => {
        const opt = document.createElement('option');
        opt.value = String(b.name).trim();
        opt.textContent = String(b.name).trim();
        blockSelect.appendChild(opt);
      });
    }
  }

  if (blockSection) {
    blockSection.style.display = data?.building?.type === 'complex' ? 'block' : 'none';
  }

  const sessionSelect = document.getElementById('sideIncomeSessionSelect');
  const sessionCustom = document.getElementById('sideIncomeSessionCustom');
  const categorySelect = document.getElementById('sideIncomeCategory');

  function fillSessions(category, selectedValue = '') {
    const sessions = typeof getSessionsForCategory === 'function'
      ? getSessionsForCategory(category)
      : ['سانس صبح', 'سانس عصر', 'سانس شب'];

    if (!sessionSelect) return;

    sessionSelect.innerHTML = '<option value="">— بدون سانس —</option>';
    sessions.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s;
      opt.textContent = s;
      sessionSelect.appendChild(opt);
    });

    const customOpt = document.createElement('option');
    customOpt.value = '__custom__';
    customOpt.textContent = '✏️ متن دلخواه';
    sessionSelect.appendChild(customOpt);

    if (selectedValue) {
      if (sessions.includes(selectedValue)) {
        sessionSelect.value = selectedValue;
        if (sessionCustom) sessionCustom.style.display = 'none';
      } else {
        sessionSelect.value = '__custom__';
        if (sessionCustom) {
          sessionCustom.value = selectedValue;
          sessionCustom.style.display = 'block';
        }
      }
    } else {
      sessionSelect.value = '';
      if (sessionCustom) {
        sessionCustom.value = '';
        sessionCustom.style.display = 'none';
      }
    }
  }

  if (incomeId) {
    // ============ ویرایش ============
    const incomes = loadSideIncomes();
    const income = incomes.find(i => i.id === incomeId);
    if (!income) return;

    if (title) title.textContent = 'ویرایش درآمد جانبی';
    if (subtitle) subtitle.textContent = `ویرایش: ${income.title || ''}`;

    document.getElementById('sideIncomeTitle').value = income.title || '';
    document.getElementById('sideIncomeCategory').value = income.category || 'سایر';
    document.getElementById('sideIncomeAmount').value = income.amount || 0;
    document.getElementById('sideIncomeDate').value = income.date || '';
    document.getElementById('sideIncomeModalMonth').value = income.month || getTodayPersianMonth();
    document.getElementById('sideIncomeModalYear').value = income.year || String(getTodayPersianYear());
    document.getElementById('sideIncomePayer').value = income.payer || '';
    document.getElementById('sideIncomeMethod').value = income.method || 'نقدی';
    document.getElementById('sideIncomeDescription').value = income.description || '';
    if (blockSelect) blockSelect.value = income.block || 'all';

    fillSessions(income.category, income.session || '');
  } else {
    // ============ جدید ============
    if (title) title.textContent = 'ثبت درآمد جانبی';
    if (subtitle) subtitle.textContent = 'اطلاعات درآمد را وارد کنید';

    document.getElementById('sideIncomeTitle').value = '';
    document.getElementById('sideIncomeCategory').value = 'اجاره مغازه';
    document.getElementById('sideIncomeAmount').value = 0;
    document.getElementById('sideIncomeDate').value = new Date().toLocaleDateString('fa-IR');
    document.getElementById('sideIncomeModalMonth').value = getTodayPersianMonth();
    document.getElementById('sideIncomeModalYear').value = String(getTodayPersianYear());
    document.getElementById('sideIncomePayer').value = '';
    document.getElementById('sideIncomeMethod').value = 'نقدی';
    document.getElementById('sideIncomeDescription').value = '';
    if (blockSelect) blockSelect.value = 'all';

    fillSessions('اجاره مغازه', '');
  }

  // هندلر تغییر دسته
  if (categorySelect) {
    categorySelect.onchange = () => {
      fillSessions(categorySelect.value, '');
    };
  }

  // هندلر تغییر سانس
  if (sessionSelect) {
    sessionSelect.onchange = () => {
      if (sessionSelect.value === '__custom__') {
        if (sessionCustom) {
          sessionCustom.style.display = 'block';
          sessionCustom.focus();
        }
      } else {
        if (sessionCustom) {
          sessionCustom.style.display = 'none';
          sessionCustom.value = '';
        }
      }
    };
  }

  modal.classList.add('open');
}

function closeSideIncomeModal() {
  document.getElementById('sideIncomeModal').classList.remove('open');
  currentEditSideIncomeId = null;
}

function saveSideIncome() {
  const title = document.getElementById('sideIncomeTitle').value.trim();
  const category = document.getElementById('sideIncomeCategory').value;
  const amount = parseInt(document.getElementById('sideIncomeAmount').value) || 0;
  const date = document.getElementById('sideIncomeDate').value.trim();
  const month = document.getElementById('sideIncomeModalMonth').value;
  const year = document.getElementById('sideIncomeModalYear').value;
  const payer = document.getElementById('sideIncomePayer').value.trim();
  const method = document.getElementById('sideIncomeMethod').value;
  const description = document.getElementById('sideIncomeDescription').value.trim();
  const block = document.getElementById('sideIncomeBlockSelect')?.value || 'all';

  let session = '';
  const sessionSelect = document.getElementById('sideIncomeSessionSelect');
  const sessionCustom = document.getElementById('sideIncomeSessionCustom');
  if (sessionSelect) {
    if (sessionSelect.value === '__custom__') {
      session = sessionCustom?.value.trim() || '';
    } else {
      session = sessionSelect.value;
    }
  }

  if (!title) { toastWarning('لطفاً عنوان درآمد را وارد کنید.'); return; }
  if (!amount || amount < 1) { toastWarning('لطفاً مبلغ درآمد را وارد کنید.'); return; }
  if (!month || !year) { toastWarning('لطفاً ماه و سال را انتخاب کنید.'); return; }

  let incomes = loadSideIncomes();
  const isEdit = !!currentEditSideIncomeId;

  if (currentEditSideIncomeId) {
    const income = incomes.find(i => i.id === currentEditSideIncomeId);
    if (income) {
      income.title = title;
      income.category = category;
      income.amount = amount;
      income.date = date;
      income.month = month;
      income.year = year;
      income.payer = payer;
      income.method = method;
      income.description = description;
      income.block = block;
      income.session = session;
    }
  } else {
    const newId = Math.max(Date.now(), ...incomes.map(i => Number(i.id) || 0)) + 1;
    incomes.push({
      id: newId,
      title, category, amount, date, month, year, payer, method, description, block, session,
      createdAt: new Date().toISOString(),
    });
  }

  saveSideIncomes(incomes);
  closeSideIncomeModal();
  renderSideIncomesPage();

  toastSuccess(isEdit ? 'درآمد ویرایش شد.' : 'درآمد جدید ثبت شد.');
}
async function deleteSideIncome(incomeId) {
  if (!(await appConfirm('⚠️ آیا از حذف این درآمد مطمئن هستید؟'))) return;

  let incomes = loadSideIncomes();
  incomes = incomes.filter(i => i.id !== incomeId);
  saveSideIncomes(incomes);

  renderSideIncomesPage();
  toastSuccess('درآمد حذف شد.');
}

function exportSideIncomesToExcel() {
  const incomes = getFilteredSideIncomes();

  if (incomes.length === 0) {
    toastWarning('درآمدی برای خروجی وجود ندارد.');
    return;
  }

  let html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office"
          xmlns:x="urn:schemas-microsoft-com:office:excel"
          xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="UTF-8">
      <style>
        table { border-collapse: collapse; font-family: Tahoma; direction: rtl; }
        th, td { border: 1px solid #ccc; padding: 8px; text-align: right; font-size: 13px; }
        th { background: #5b4cdb; color: white; font-weight: bold; }
      </style>
    </head>
    <body>
      <h2>لیست درآمدهای جانبی — ${new Date().toLocaleDateString('fa-IR')}</h2>
      <table>
        <thead>
          <tr>
            <th>ردیف</th><th>تاریخ</th><th>عنوان</th><th>دسته</th>
            <th>سانس</th><th>بلوک</th><th>پرداخت‌کننده</th>
            <th>مبلغ</th><th>روش</th><th>توضیحات</th>
          </tr>
        </thead>
        <tbody>
  `;

  incomes.forEach((i, idx) => {
    const amount = Number(i.amount || 0).toLocaleString('en-US');
    html += `
      <tr>
        <td>${idx + 1}</td>
        <td>${i.date || '—'}</td>
        <td>${i.title || '—'}</td>
        <td>${i.category || '—'}</td>
        <td>${i.session || '—'}</td>
        <td>${(i.block && i.block !== 'all') ? i.block : 'کلی'}</td>
        <td>${i.payer || '—'}</td>
        <td>${amount}</td>
        <td>${i.method || '—'}</td>
        <td>${i.description || '—'}</td>
      </tr>
    `;
  });

  html += `
        </tbody>
      </table>
    </body>
    </html>
  `;

  const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `درآمد-جانبی-${new Date().toLocaleDateString('fa-IR').replace(/\//g, '-')}.xls`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function bindSideIncomesPage() {
  // ============ فیلتر بلوک ============
  const blockFilter = document.getElementById('sideIncomeBlockFilter');
  const data = loadData();

  if (blockFilter && data?.building) {
    blockFilter.innerHTML = '<option value="all">🏢 همه بلوک‌ها</option>';

    if (data.building.type === 'complex') {
      data.building.blocks.forEach(b => {
        const opt = document.createElement('option');
        opt.value = String(b.name).trim();
        opt.textContent = String(b.name).trim();
        blockFilter.appendChild(opt);
      });
    } else {
      blockFilter.parentElement.style.display = 'none';
    }
  }

  if (blockFilter) {
    blockFilter.addEventListener('change', (e) => {
      sideIncomeBlockFilter = e.target.value;
      renderSideIncomesPage();
    });
  }

  // ============ فیلتر سانس ============
  const sessionFilter = document.getElementById('sideIncomeSessionFilter');
  if (sessionFilter) {
    const usedSessions = new Set();
    loadSideIncomes().forEach(i => {
      if (i.session) usedSessions.add(i.session);
    });

    sessionFilter.innerHTML = '<option value="all">🕐 همه سانس‌ها</option>';
    usedSessions.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s;
      opt.textContent = s;
      sessionFilter.appendChild(opt);
    });

    sessionFilter.addEventListener('change', (e) => {
      sideIncomeSessionFilter = e.target.value;
      renderSideIncomesPage();
    });
  }

  // ============ فیلتر ماه ============
  const monthFilter = document.getElementById('sideIncomeMonthFilter');
  if (monthFilter) {
    monthFilter.innerHTML = '<option value="all">📅 همه ماه‌ها</option>';
    PERSIAN_MONTHS.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m;
      opt.textContent = m;
      monthFilter.appendChild(opt);
    });

    monthFilter.addEventListener('change', (e) => {
      sideIncomeMonthFilter = e.target.value;
      renderSideIncomesPage();
    });
  }

  // ============ فیلتر سال ============
  const yearFilter = document.getElementById('sideIncomeYearFilter');
  if (yearFilter) {
    yearFilter.innerHTML = '<option value="all">📆 همه سال‌ها</option>';
    const currentYear = getTodayPersianYear();
    for (let i = currentYear - 3; i <= currentYear + 1; i++) {
      const opt = document.createElement('option');
      opt.value = String(i);
      opt.textContent = toPersianNum(i);
      if (String(i) === String(currentYear)) opt.selected = true;
      yearFilter.appendChild(opt);
    }
    sideIncomeYearFilter = String(currentYear);

    yearFilter.addEventListener('change', (e) => {
      sideIncomeYearFilter = e.target.value;
      renderSideIncomesPage();
    });
  }

  // ============ دکمه افزودن ============
  const btnAdd = document.getElementById('btnAddSideIncome');
  if (btnAdd) {
    btnAdd.onclick = () => {
      console.log('✅ دکمه ثبت درآمد کلیک شد');
      openSideIncomeModal(null);
    };
  } else {
    console.warn('⚠️ btnAddSideIncome پیدا نشد');
  }

  // ============ خروجی اکسل ============
  const btnExport = document.getElementById('btnExportSideIncomes');
  if (btnExport) btnExport.onclick = exportSideIncomesToExcel;

  // ============ دکمه‌های مودال ============
  const btnCancel = document.getElementById('sideIncomeCancelBtn');
  if (btnCancel) btnCancel.onclick = closeSideIncomeModal;

  const btnSave = document.getElementById('sideIncomeSaveBtn');
  if (btnSave) btnSave.onclick = saveSideIncome;

  // ============ جدول ============
  const tbody = document.getElementById('sideIncomesTableBody');
  if (tbody) {
    tbody.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-side-income-action]');
      if (!btn) return;

      const action = btn.dataset.sideIncomeAction;
      const id = Number(btn.dataset.id);

      if (action === 'edit') {
        openSideIncomeModal(id);
      } else if (action === 'delete') {
        deleteSideIncome(id);
      }
    });
  }

  // ============ بستن مودال ============
  const modal = document.getElementById('sideIncomeModal');
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeSideIncomeModal();
    });
  }
}

function renderPaymentsPage() {
  renderPaymentsStats();

  const tbody = document.getElementById('paymentsTableBody');
  const countLabel = document.getElementById('paymentsCountLabel');
  if (!tbody) return;

  const payments = getFilteredPayments();

  if (countLabel) {
    countLabel.textContent = `${formatNumber(payments.length)} مورد`;
  }

  if (payments.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align:center;color:#94a3b8;padding:40px;">
          هنوز پرداختی ثبت نشده است.
        </td>
      </tr>`;
    return;
  }

  tbody.innerHTML = payments.map(c => {
    const unit = UNITS.find(u => Number(u.id) === Number(c.unitId));
    const blockName = unit?.block || c.block || '—';
    const unitNumber = unit ? toPersianNum(unit.number) : (c.unitNumber ? toPersianNum(c.unitNumber) : '—');
    const payer = payerOf(unit);
    const ownerName = payer.name ? escapeHtml(payer.name) : '<span style="color:#94a3b8;">ثبت‌نام نکرده</span>';
    const payDate = escapeHtml(c.paidDate || '—');
    const payMethod = escapeHtml(c.payMethod || '—');
    const description = escapeHtml(c.payDescription || '—') + ` <span style="color:#94a3b8;">(شارژ ${c.month} ${toPersianNum(c.year)})</span>`;

    return `
      <tr>
        <td>${payDate}</td>
        <td><strong>${blockName}</strong></td>
        <td><strong>${unitNumber}</strong></td>
        <td>${ownerName}</td>
        <td><strong>${formatToman(c.total || 0)}</strong></td>
        <td><span class="badge badge-paid">${payMethod}</span></td>
        <td style="color:#64748b; font-size:12.5px;">${description}</td>
        <td>
          <button class="row-action-btn danger" data-payment-id="${c.id}" title="لغو پرداخت">🔓</button>
        </td>
      </tr>
    `;
  }).join('');
}

function bindPaymentsPage() {
  const yearFilter = document.getElementById('paymentsYearFilter');
  if (yearFilter) {
    const cy = getTodayPersianYear();
    yearFilter.innerHTML = '<option value="all">همه سال‌ها</option>' +
      [cy - 2, cy - 1, cy, cy + 1].map(y => `<option value="${y}" ${y === cy ? 'selected' : ''}>${toPersianNum(y)}</option>`).join('');
    yearFilter.addEventListener('change', (e) => {
      paymentsYearFilter = e.target.value;
      renderPaymentsPage();
    });
  }

  const monthFilter = document.getElementById('paymentsMonthFilter');
  if (monthFilter) {
    monthFilter.addEventListener('change', (e) => {
      paymentsMonthFilter = e.target.value;
      renderPaymentsPage();
    });
  }

  const search = document.getElementById('paymentsSearch');
  if (search) {
    search.addEventListener('input', (e) => {
      paymentsSearchQuery = e.target.value;
      renderPaymentsPage();
    });
  }

  const table = document.querySelector('#page-payments table');
  if (table) {
    table.querySelectorAll('th.sortable').forEach(th => {
      th.addEventListener('click', () => {
        const col = th.dataset.sort;

        if (paymentsSortColumn === col) {
          if (paymentsSortDirection === 'asc') {
            paymentsSortDirection = 'desc';
          } else {
            paymentsSortColumn = null;
            paymentsSortDirection = 'desc';
          }
        } else {
          paymentsSortColumn = col;
          paymentsSortDirection = 'asc';
        }

        updatePaymentsSortIcons();
        renderPaymentsPage();
      });
    });
  }

  document.getElementById('btnExportPayments')?.addEventListener('click', exportPaymentsToExcel);

  const tbody = document.getElementById('paymentsTableBody');
  if (tbody) {
    tbody.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-payment-id]');
      if (!btn) return;

      const chargeId = Number(btn.dataset.paymentId);
      cancelPayment(chargeId);
    });
  }
}

function updatePaymentsSortIcons() {
  const table = document.querySelector('#page-payments table');
  if (!table) return;

  table.querySelectorAll('th.sortable').forEach(th => {
    th.classList.remove('sort-asc', 'sort-desc');

    if (th.dataset.sort === paymentsSortColumn) {
      if (paymentsSortDirection === 'asc') th.classList.add('sort-asc');
      else th.classList.add('sort-desc');
    }
  });
}

async function cancelPayment(chargeId) {
  if (!(await appConfirm('⚠️ آیا از لغو این پرداخت مطمئن هستید؟'))) return;

  const charges = loadCharges();
  const charge = charges.find(c => c.id === chargeId);
  if (!charge) return;

  clearChargePayment(charge);

  saveCharges(charges);
  updateUnitsDebtFromCharges();

  renderPaymentsPage();
  renderUnitsStats();
  renderUnitsPage();
  renderDashboard();
  renderChargesPage();

  toastSuccess('پرداخت لغو شد.');
}

function exportPaymentsToExcel() {
  const payments = getFilteredPayments();

  if (payments.length === 0) {
    toastWarning('پرداختی برای خروجی وجود ندارد.');
    return;
  }

  let html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office"
          xmlns:x="urn:schemas-microsoft-com:office:excel"
          xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="UTF-8">
      <style>
        table { border-collapse: collapse; font-family: Tahoma; direction: rtl; }
        th, td { border: 1px solid #ccc; padding: 8px; text-align: right; font-size: 13px; }
        th { background: #5b4cdb; color: white; font-weight: bold; }
      </style>
    </head>
    <body>
      <h2>تاریخچه پرداخت‌ها — ${new Date().toLocaleDateString('fa-IR')}</h2>
      <table>
        <thead>
          <tr>
            <th>ردیف</th><th>تاریخ</th><th>بلوک</th><th>واحد</th>
            <th>مالک</th><th>مبلغ</th><th>روش پرداخت</th><th>توضیحات</th>
          </tr>
        </thead>
        <tbody>
  `;

  payments.forEach((c, idx) => {
    const unit = UNITS.find(u => u.id === c.unitId);
    const blockName = unit?.block || '—';
    const unitNumber = unit?.number || '—';
    const ownerName = unit?.owner?.name || '—';
    const amount = Number(c.total || 0).toLocaleString('en-US');

    html += `
      <tr>
        <td>${idx + 1}</td>
        <td>${c.paidDate || '—'}</td>
        <td>${blockName}</td>
        <td>${unitNumber}</td>
        <td>${ownerName}</td>
        <td>${amount}</td>
        <td>${c.payMethod || '—'}</td>
        <td>${c.payDescription || '—'}</td>
      </tr>
    `;
  });

  html += `
        </tbody>
      </table>
    </body>
    </html>
  `;

  const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `پرداخت‌ها-${new Date().toLocaleDateString('fa-IR').replace(/\//g, '-')}.xls`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ============================================================
   مودال ثبت پرداخت جدید (گروهی)
   ============================================================ */
let newPaySelectedCharges = [];

function openNewPaymentModal() {
  const modal = document.getElementById('newPaymentModal');

  const blockSelect = document.getElementById('newPayBlock');
  const data = loadData();

  if (blockSelect && data?.building) {
    blockSelect.innerHTML = '<option value="">— همه بلوک‌ها —</option>';

    if (data.building.type === 'complex') {
      data.building.blocks.forEach(b => {
        const opt = document.createElement('option');
        opt.value = String(b.name).trim();
        opt.textContent = String(b.name).trim();
        blockSelect.appendChild(opt);
      });
    }
  }

  newPaySelectedCharges = [];
  document.getElementById('newPayUnitsList').innerHTML = '<div style="text-align:center; color:#94a3b8; padding:20px; font-size:13px;">بلوک را انتخاب کنید</div>';
  document.getElementById('newPayMethod').value = 'نقدی';
  document.getElementById('newPayDescription').value = '';
  updateNewPaySelectedInfo();

  const today = getTodayPersianDateFromIso(new Date().toISOString());
  document.getElementById('newPayDate').value = today;

  modal.classList.add('open');

  // ✅ ساختمان تک‌بلوکی: لیست واحدها بلافاصله نمایش داده شود (قبلاً خالی می‌ماند)
  if (data?.building?.type !== 'complex') {
    updateNewPayUnits();
  }
}

function closeNewPaymentModal() {
  document.getElementById('newPaymentModal').classList.remove('open');
  newPaySelectedCharges = [];
}

function updateNewPayUnits() {
  const blockFilter = document.getElementById('newPayBlock')?.value || '';
  const listContainer = document.getElementById('newPayUnitsList');
  if (!listContainer) return;

  let units = UNITS;
  if (blockFilter) {
    units = units.filter(u => String(u.block).trim() === String(blockFilter).trim());
  }

  if (units.length === 0) {
    listContainer.innerHTML = '<div style="text-align:center; color:#94a3b8; padding:20px; font-size:13px;">واحدی یافت نشد</div>';
    return;
  }

  const charges = loadCharges();

  units = [...units].sort((a, b) => {
    const blockCompare = String(a.block).localeCompare(String(b.block), 'fa');
    if (blockCompare !== 0) return blockCompare;
    return Number(a.number) - Number(b.number);
  });

  listContainer.innerHTML = units.map(u => {
    const unpaidCharges = charges.filter(c => c.unitId === u.id && !c.paid);
    const totalUnpaid = unpaidCharges.reduce((s, c) => s + (Number(c.total) || 0), 0);

    const ownerName = u.owner?.name || 'ثبت‌نام نکرده';
    const unitLabel = unitLabelOf(u);

    if (unpaidCharges.length === 0) {
      return `
        <div class="pay-unit-item disabled">
          <input type="checkbox" disabled />
          <div class="pay-unit-info">
            <div>
              <div class="pay-unit-label">${unitLabel}</div>
              <div class="pay-unit-owner">${ownerName}</div>
            </div>
            <div class="pay-unit-amount" style="color:#15803d;">✅ تسویه</div>
          </div>
        </div>
      `;
    }

    const chargeIds = unpaidCharges.map(c => c.id).join(',');
    return `
      <label class="pay-unit-item" data-unit-id="${u.id}">
        <input type="checkbox" class="pay-unit-checkbox" data-unit-id="${u.id}" data-charge-ids="${chargeIds}" data-total="${totalUnpaid}" />
        <div class="pay-unit-info">
          <div>
            <div class="pay-unit-label">${unitLabel}</div>
            <div class="pay-unit-owner">${ownerName}</div>
          </div>
          <div class="pay-unit-amount">${formatToman(totalUnpaid)}</div>
        </div>
      </label>
    `;
  }).join('');

  listContainer.querySelectorAll('.pay-unit-checkbox').forEach(cb => {
    cb.addEventListener('change', (e) => {
      const unitId = Number(e.target.dataset.unitId);
      const chargeIds = e.target.dataset.chargeIds.split(',').map(Number);

      if (e.target.checked) {
        chargeIds.forEach(cid => {
          newPaySelectedCharges.push({ chargeId: cid, unitId: unitId, total: 0 });
        });
        e.target.closest('.pay-unit-item').classList.add('selected');
      } else {
        newPaySelectedCharges = newPaySelectedCharges.filter(c => !chargeIds.includes(c.chargeId));
        e.target.closest('.pay-unit-item').classList.remove('selected');
      }

      updateNewPaySelectedInfo();
    });
  });
}

function updateNewPaySelectedInfo() {
  const count = newPaySelectedCharges.length;
  const countEl = document.getElementById('newPaySelectedCount');
  const totalEl = document.getElementById('newPaySelectedTotal');

  if (!countEl || !totalEl) return;

  countEl.textContent = formatNumber(count);

  if (count === 0) {
    totalEl.textContent = '۰ تومان';
    return;
  }

  const charges = loadCharges();
  const total = newPaySelectedCharges.reduce((s, item) => {
    const charge = charges.find(c => c.id === item.chargeId);
    return s + (Number(charge?.total) || 0);
  }, 0);

  totalEl.textContent = formatToman(total);
}

function newPaySelectAll() {
  const listContainer = document.getElementById('newPayUnitsList');
  if (!listContainer) {
    toastWarning('لیست واحدها پیدا نشد!');
    return;
  }

  const checkboxes = listContainer.querySelectorAll('.pay-unit-checkbox:not(:disabled)');

  if (checkboxes.length === 0) {
    toastWarning('هیچ واحدی برای انتخاب وجود ندارد. اول بلوک را انتخاب کنید.');
    return;
  }

  checkboxes.forEach(cb => {
    if (!cb.checked) {
      cb.checked = true;

      const unitId = Number(cb.dataset.unitId);
      const chargeIds = cb.dataset.chargeIds.split(',').map(Number);

      chargeIds.forEach(cid => {
        if (!newPaySelectedCharges.find(item => item.chargeId === cid)) {
          newPaySelectedCharges.push({ chargeId: cid, unitId: unitId, total: 0 });
        }
      });

      cb.closest('.pay-unit-item').classList.add('selected');
    }
  });

  updateNewPaySelectedInfo();
}

function newPayDeselectAll() {
  const listContainer = document.getElementById('newPayUnitsList');
  if (!listContainer) return;

  listContainer.querySelectorAll('.pay-unit-checkbox:checked').forEach(cb => {
    cb.checked = false;
    cb.dispatchEvent(new Event('change'));
  });
}

async function confirmNewPayment() {
  const payDate = document.getElementById('newPayDate')?.value.trim();
  const payMethod = document.getElementById('newPayMethod')?.value || 'نقدی';
  const payDescription = document.getElementById('newPayDescription')?.value.trim() || '';

  if (newPaySelectedCharges.length === 0) {
    toastWarning('لطفاً حداقل یک واحد را انتخاب کنید.');
    return;
  }

  if (!payDate || !parsePersianDateParts(payDate)) {
    toastWarning('تاریخ پرداخت را به شکل ۱۴۰۵/۰۸/۱۳ وارد کنید.');
    return;
  }

  const count = newPaySelectedCharges.length;
  if (!(await appConfirm(`آیا از ثبت پرداخت برای ${count} مورد مطمئن هستید؟`))) {
    return;
  }

  const charges = loadCharges();
  let successCount = 0;

  newPaySelectedCharges.forEach(item => {
    const charge = charges.find(c => c.id === item.chargeId);
    if (charge && !charge.paid) {
      charge.paid = true;
      charge.pendingApproval = false;
      charge.paidDate = payDate;
      charge.payMethod = payMethod;
      charge.payDescription = payDescription;
      charge.paidAt = new Date().toISOString();
      archiveChargeReceipt(charge);
      successCount++;
    }
  });

  saveCharges(charges);
  updateUnitsDebtFromCharges();

  closeNewPaymentModal();

  renderPaymentsPage();
  renderChargesPage();
  renderUnitsStats();
  renderUnitsPage();
  renderDashboard();

  toastSuccess(`${successCount} پرداخت ثبت شد. روش: ${payMethod}`);
}

function bindNewPaymentModal() {
  // ✅ اصلاح: دکمه ثبت پرداخت جدید باید openNewPaymentModal رو صدا بزنه نه issueCharge
  const btnAdd = document.getElementById('btnAddPayment');
  if (btnAdd) btnAdd.onclick = openNewPaymentModal;

  const btnCancel = document.getElementById('newPayCancelBtn');
  if (btnCancel) btnCancel.onclick = closeNewPaymentModal;

  const btnConfirm = document.getElementById('newPayConfirmBtn');
  if (btnConfirm) btnConfirm.onclick = confirmNewPayment;

  const blockSelect = document.getElementById('newPayBlock');
  if (blockSelect) blockSelect.addEventListener('change', updateNewPayUnits);

  const btnSelectAll = document.getElementById('newPaySelectAll');
  if (btnSelectAll) btnSelectAll.onclick = newPaySelectAll;

  const btnDeselectAll = document.getElementById('newPayDeselectAll');
  if (btnDeselectAll) btnDeselectAll.onclick = newPayDeselectAll;

  const modal = document.getElementById('newPaymentModal');
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeNewPaymentModal();
    });
  }
}

/* ============================================================
   صفحه هزینه‌ها
   ============================================================ */
let currentExpenseMonth = 'all';
let currentExpenseBlock = 'all';
let currentExpenseYear = String(getTodayPersianYear());
let currentEditExpenseId = null;

function getExpensesKey() {
  return getAccountStorageKey('ham_sakhteman_expenses');
}

function loadExpenses() {
  const raw = localStorage.getItem(getExpensesKey());
  if (raw) { try { return JSON.parse(raw); } catch (e) { return []; } }
  return [];
}

function saveExpenses(expenses) {
  localStorage.setItem(getExpensesKey(), JSON.stringify(expenses));
}

function getExpensesForMonth(month, year) {
  const expenses = loadExpenses();
  return expenses.filter(e => e.month === month && e.year === String(year));
}

function getFilteredExpenses() {
  let list = loadExpenses();

  if (currentExpenseMonth !== 'all') {
    list = list.filter(e => e.month === currentExpenseMonth);
  }

  if (currentExpenseYear !== 'all') {
    list = list.filter(e => e.year === currentExpenseYear);
  }

  if (currentExpenseBlock !== 'all') {
    list = list.filter(e => (e.block || 'all') === currentExpenseBlock);
  }

  return list;
}

function renderExpensesStats() {
  const all = loadExpenses();
  const total = all.length;

  const filtered = getFilteredExpenses();
  const thisMonth = filtered.length;
  const sum = filtered.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const avg = thisMonth > 0 ? Math.round(sum / thisMonth) : 0;

  const elTotal = document.getElementById('expenseTotal');
  const elThisMonth = document.getElementById('expenseThisMonth');
  const elSum = document.getElementById('expenseSum');
  const elAvg = document.getElementById('expenseAvg');

  if (elTotal) elTotal.textContent = formatNumber(total);
  if (elThisMonth) elThisMonth.textContent = formatNumber(thisMonth);
  if (elSum) elSum.textContent = formatToman(sum);
  if (elAvg) elAvg.textContent = formatToman(avg);
}

function renderExpensesPage() {
  renderExpensesStats();

  const tbody = document.getElementById('expensesTableBody');
  const countLabel = document.getElementById('expenseCountLabel');
  if (!tbody) return;

  const expenses = getFilteredExpenses();

  if (countLabel) {
    countLabel.textContent = `${formatNumber(expenses.length)} مورد`;
  }

  if (expenses.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align:center;color:#94a3b8;padding:40px;">
          هنوز هزینه‌ای ثبت نشده است.
          <br><br>
          <button class="btn btn-primary" onclick="document.getElementById('btnAddExpense').click()">
            ➕ ثبت هزینه جدید
          </button>
        </td>
      </tr>`;
    return;
  }

  tbody.innerHTML = expenses.map(e => {
    const categoryIcons = {
      'نظافت': '🧹',
      'تعمیرات': '🔧',
      'قبوض': '💡',
      'آسانسور': '🛗',
      'فضای سبز': '🌿',
      'نگهبانی': '🚪',
      'سایر': '📦',
    };
    const icon = categoryIcons[e.category] || '📦';

    const blockLabel = (e.block && e.block !== 'all')
      ? `<span class="badge badge-paid">🏢 ${e.block}</span>`
      : '<span style="color:#94a3b8;">🏢 کلی</span>';

    return `
      <tr>
        <td>${e.date || '—'}</td>
        <td><strong>${e.title || '—'}</strong></td>
        <td>${blockLabel}</td>
        <td><span class="badge badge-paid">${icon} ${e.category || 'سایر'}</span></td>
        <td><strong>${formatToman(e.amount || 0)}</strong></td>
        <td style="color:#64748b; font-size:12.5px;">${e.description || '—'}</td>
        <td>
          <div class="row-actions">
            <button class="row-action-btn" data-expense-action="edit" data-id="${e.id}" title="ویرایش">✏️</button>
            <button class="row-action-btn danger" data-expense-action="delete" data-id="${e.id}" title="حذف">🗑️</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function openExpenseModal(expenseId = null) {
  currentEditExpenseId = expenseId;

  const modal = document.getElementById('expenseModal');
  const title = document.getElementById('expenseModalTitle');
  const subtitle = document.getElementById('expenseModalSubtitle');

  const blockSelect = document.getElementById('expenseBlockSelect');
  const blockSection = document.getElementById('expenseBlockSection');
  const data = loadData();

  if (blockSelect && data?.building) {
    blockSelect.innerHTML = '<option value="all">🏢 همه بلوک‌ها / کل ساختمان</option>';

    if (data.building.type === 'complex') {
      data.building.blocks.forEach(b => {
        const opt = document.createElement('option');
        opt.value = String(b.name).trim();
        opt.textContent = String(b.name).trim();
        blockSelect.appendChild(opt);
      });
    }
  }

  if (blockSection) {
    blockSection.style.display = data?.building?.type === 'complex' ? 'block' : 'none';
  }

  fillYearMonthDropdowns('expenseModalYear', 'expenseModalMonth');

  if (expenseId) {
    const expenses = loadExpenses();
    const expense = expenses.find(e => e.id === expenseId);
    if (!expense) return;

    if (title) title.textContent = 'ویرایش هزینه';
    if (subtitle) subtitle.textContent = `ویرایش: ${expense.title || ''}`;

    document.getElementById('expenseTitle').value = expense.title || '';
    document.getElementById('expenseCategory').value = expense.category || 'سایر';
    document.getElementById('expenseAmount').value = expense.amount || 0;
    document.getElementById('expenseDate').value = expense.date || '';
    document.getElementById('expenseModalMonth').value = expense.month || getTodayPersianMonth();
    document.getElementById('expenseModalYear').value = expense.year || String(getTodayPersianYear());
    document.getElementById('expenseDescription').value = expense.description || '';
    if (blockSelect) blockSelect.value = expense.block || 'all';
  } else {
    if (title) title.textContent = 'ثبت هزینه جدید';
    if (subtitle) subtitle.textContent = 'اطلاعات هزینه را وارد کنید';

    document.getElementById('expenseTitle').value = '';
    document.getElementById('expenseCategory').value = 'سایر';
    document.getElementById('expenseAmount').value = 0;
    document.getElementById('expenseDate').value = new Date().toLocaleDateString('fa-IR');
    document.getElementById('expenseModalMonth').value = currentExpenseMonth !== 'all' ? currentExpenseMonth : getTodayPersianMonth();
    document.getElementById('expenseModalYear').value = currentExpenseYear;
    document.getElementById('expenseDescription').value = '';
    if (blockSelect) blockSelect.value = currentExpenseBlock !== 'all' ? currentExpenseBlock : 'all';
  }

  modal.classList.add('open');
}

function closeExpenseModal() {
  document.getElementById('expenseModal').classList.remove('open');
  currentEditExpenseId = null;
}

function saveExpense() {
  const title = document.getElementById('expenseTitle').value.trim();
  const category = document.getElementById('expenseCategory').value;
  const amount = parseInt(document.getElementById('expenseAmount').value) || 0;
  const date = document.getElementById('expenseDate').value.trim();
  const month = document.getElementById('expenseModalMonth').value;
  const year = document.getElementById('expenseModalYear').value;
  const description = document.getElementById('expenseDescription').value.trim();
  const block = document.getElementById('expenseBlockSelect')?.value || 'all';

  if (!title) { toastWarning('لطفاً عنوان هزینه را وارد کنید.'); return; }
  if (!amount || amount < 1) { toastWarning('لطفاً مبلغ هزینه را وارد کنید.'); return; }
  if (!month || !year) { toastWarning('لطفاً ماه و سال را انتخاب کنید.'); return; }

  let expenses = loadExpenses();
  const isEdit = !!currentEditExpenseId;

  if (currentEditExpenseId) {
    const expense = expenses.find(e => e.id === currentEditExpenseId);
    if (expense) {
      expense.title = title;
      expense.category = category;
      expense.amount = amount;
      expense.date = date;
      expense.month = month;
      expense.year = year;
      expense.block = block;
      expense.description = description;
    }
  } else {
    const newId = Math.max(Date.now(), ...expenses.map(e => Number(e.id) || 0)) + 1;
    expenses.push({
      id: newId, title, category, amount, date, month, year, block, description,
      createdAt: new Date().toISOString(),
    });
  }

  saveExpenses(expenses);
  closeExpenseModal();
  renderExpensesPage();
  renderDashboard();

  if (isEdit) {
    toastSuccess('هزینه ویرایش شد.');
  } else {
    toastSuccess('هزینه جدید ثبت شد.');
  }
}

async function deleteExpense(expenseId) {
  if (!(await appConfirm('⚠️ آیا از حذف این هزینه مطمئن هستید؟'))) return;

  let expenses = loadExpenses();
  expenses = expenses.filter(e => e.id !== expenseId);
  saveExpenses(expenses);

  renderExpensesPage();
  renderDashboard();

  toastSuccess('هزینه حذف شد.');
}

function exportExpensesToExcel() {
  const expenses = getFilteredExpenses();

  if (expenses.length === 0) {
    toastWarning('هزینه‌ای برای خروجی وجود ندارد.');
    return;
  }

  let html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office"
          xmlns:x="urn:schemas-microsoft-com:office:excel"
          xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="UTF-8">
      <style>
        table { border-collapse: collapse; font-family: Tahoma; direction: rtl; }
        th, td { border: 1px solid #ccc; padding: 8px; text-align: right; font-size: 13px; }
        th { background: #5b4cdb; color: white; font-weight: bold; }
      </style>
    </head>
    <body>
      <h2>لیست هزینه‌ها — ${currentExpenseMonth === 'all' ? 'همه ماه‌ها' : currentExpenseMonth} ${toPersianNum(currentExpenseYear)}</h2>
      <table>
        <thead>
          <tr>
            <th>ردیف</th><th>تاریخ</th><th>عنوان</th><th>بلوک</th>
            <th>دسته‌بندی</th><th>مبلغ</th><th>توضیحات</th>
          </tr>
        </thead>
        <tbody>
  `;

  expenses.forEach((e, idx) => {
    const amount = Number(e.amount || 0).toLocaleString('en-US');
    html += `
      <tr>
        <td>${idx + 1}</td>
        <td>${e.date || '—'}</td>
        <td>${e.title || '—'}</td>
        <td>${(e.block && e.block !== 'all') ? e.block : 'کلی'}</td>
        <td>${e.category || '—'}</td>
        <td>${amount}</td>
        <td>${e.description || '—'}</td>
      </tr>
    `;
  });

  html += `
        </tbody>
      </table>
    </body>
    </html>
  `;

  const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `هزینه‌ها-${new Date().toLocaleDateString('fa-IR').replace(/\//g, '-')}.xls`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function bindExpensesPage() {
  const blockFilter = document.getElementById('expenseBlockFilter');
  const data = loadData();

  if (blockFilter && data?.building) {
    blockFilter.innerHTML = '<option value="all">🏢 همه بلوک‌ها</option>';

    if (data.building.type === 'complex') {
      data.building.blocks.forEach(b => {
        const opt = document.createElement('option');
        opt.value = String(b.name).trim();
        opt.textContent = String(b.name).trim();
        blockFilter.appendChild(opt);
      });
    } else {
      blockFilter.parentElement.style.display = 'none';
    }
  }

  if (blockFilter) {
    blockFilter.addEventListener('change', (e) => {
      currentExpenseBlock = e.target.value;
      renderExpensesPage();
    });
  }

  const monthSelect = document.getElementById('expenseMonth');
  if (monthSelect) {
    monthSelect.addEventListener('change', (e) => {
      currentExpenseMonth = e.target.value;
      renderExpensesPage();
    });
  }

  const yearSelect = document.getElementById('expenseYear');
  if (yearSelect) {
    yearSelect.innerHTML = '';
    const currentYear = getTodayPersianYear();
    for (let i = currentYear - 2; i <= currentYear + 2; i++) {
      const opt = document.createElement('option');
      opt.value = String(i);
      opt.textContent = toPersianNum(i);
      if (String(i) === String(currentYear)) opt.selected = true;
      yearSelect.appendChild(opt);
    }
    currentExpenseYear = String(currentYear);

    yearSelect.addEventListener('change', (e) => {
      currentExpenseYear = e.target.value;
      renderExpensesPage();
    });
  }

  const btnAdd = document.getElementById('btnAddExpense');
  if (btnAdd) btnAdd.onclick = () => openExpenseModal(null);

  const btnExport = document.getElementById('btnExportExpenses');
  if (btnExport) btnExport.onclick = exportExpensesToExcel;

  const btnCancel = document.getElementById('expenseCancelBtn');
  if (btnCancel) btnCancel.onclick = closeExpenseModal;

  const btnSave = document.getElementById('expenseSaveBtn');
  if (btnSave) btnSave.onclick = saveExpense;

  const tbody = document.getElementById('expensesTableBody');
  if (tbody) {
    tbody.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-expense-action]');
      if (!btn) return;

      const action = btn.dataset.expenseAction;
      const id = Number(btn.dataset.id);

      if (action === 'edit') {
        openExpenseModal(id);
      } else if (action === 'delete') {
        deleteExpense(id);
      }
    });
  }

  const modal = document.getElementById('expenseModal');
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeExpenseModal();
    });
  }
}

/* ============================================================
   صفحه اطلاعیه‌ها
   ============================================================ */
let noticesSearchQuery = '';
let noticesMonthFilter = 'all';
let noticeSelectedUnits = [];
let noticeImageData = null;

function getNoticesKey() {
  return getAccountStorageKey('ham_sakhteman_notices');
}

function loadNotices() {
  const raw = localStorage.getItem(getNoticesKey());
  if (raw) { try { return JSON.parse(raw); } catch (e) { return []; } }
  return [];
}

function saveNotices(notices) {
  localStorage.setItem(getNoticesKey(), JSON.stringify(notices));
}

function getFilteredNotices() {
  let list = loadNotices();

  if (noticesMonthFilter !== 'all') {
    list = list.filter(n => n.month === noticesMonthFilter);
  }

  if (noticesSearchQuery.trim() !== '') {
    const q = noticesSearchQuery.trim().toLowerCase();
    list = list.filter(n => {
      const title = (n.title || '').toLowerCase();
      const body = (n.body || '').toLowerCase();
      return title.includes(q) || body.includes(q);
    });
  }

  list = [...list].sort((a, b) => {
    const dateA = a.createdAt || '';
    const dateB = b.createdAt || '';
    return dateB.localeCompare(dateA);
  });

  return list;
}

function renderNoticesStats() {
  const all = loadNotices();

  const total = all.length;
  const thisMonth = all.filter(n => n.month === getTodayPersianMonth() && (!n.year || String(n.year) === String(getTodayPersianYear()))).length;
  const receivers = all.reduce((s, n) => s + (Number(n.receivers) || 0), 0);
  const withImage = all.filter(n => n.image).length;

  const elTotal = document.getElementById('noticesTotal');
  const elThisMonth = document.getElementById('noticesThisMonth');
  const elReceivers = document.getElementById('noticesReceivers');
  const elWithImage = document.getElementById('noticesWithImage');

  if (elTotal) elTotal.textContent = formatNumber(total);
  if (elThisMonth) elThisMonth.textContent = formatNumber(thisMonth);
  if (elReceivers) elReceivers.textContent = formatNumber(receivers);
  if (elWithImage) elWithImage.textContent = formatNumber(withImage);
}

function renderNoticesPage() {
  renderNoticesStats();

  const tbody = document.getElementById('noticesTableBody');
  const countLabel = document.getElementById('noticesCountLabel');
  if (!tbody) return;

  const notices = getFilteredNotices();

  if (countLabel) {
    countLabel.textContent = `${formatNumber(notices.length)} مورد`;
  }

  if (notices.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center;color:#94a3b8;padding:40px;">
          هنوز اطلاعیه‌ای ارسال نشده است.
          <br><br>
          <button class="btn btn-primary" onclick="document.getElementById('btnAddNotice').click()">
            ➕ ارسال اولین اطلاعیه
          </button>
        </td>
      </tr>`;
    return;
  }

  tbody.innerHTML = notices.map(n => {
    const bodyPreview = (n.body || '').length > 60
      ? (n.body || '').substring(0, 60) + '...'
      : (n.body || '—');

    const targetLabel = getNoticeTargetLabel(n);

    return `
      <tr>
        <td>${n.date || '—'}</td>
        <td><strong>${n.title || '—'}</strong></td>
        <td style="color:#64748b; font-size:12.5px;">${bodyPreview}</td>
        <td>${targetLabel}</td>
        <td>${n.image ? '📸 دارد' : '—'}</td>
        <td>
          <div class="row-actions">
            <button class="row-action-btn" data-notice-action="view" data-id="${n.id}" title="مشاهده">👁️</button>
            <button class="row-action-btn danger" data-notice-action="delete" data-id="${n.id}" title="حذف">🗑️</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function getNoticeTargetLabel(notice) {
  if (notice.targetType === 'all') {
    return '<span class="badge badge-paid">🌐 همه ساکنین</span>';
  }
  if (notice.targetType === 'block') {
    return `<span class="badge badge-paid">🏢 ${notice.targetBlock || '—'}</span>`;
  }
  if (notice.targetType === 'units') {
    return `<span class="badge badge-paid">🏠 ${notice.targetUnits?.length || 0} واحد</span>`;
  }
  return '—';
}

function openNoticeModal() {
  const modal = document.getElementById('noticeModal');
  const data = loadData();

  const blockSelect = document.getElementById('noticeBlockSelect');
  if (blockSelect && data?.building) {
    blockSelect.innerHTML = '<option value="">— انتخاب کنید —</option>';

    if (data.building.type === 'complex') {
      data.building.blocks.forEach(b => {
        const opt = document.createElement('option');
        opt.value = String(b.name).trim();
        opt.textContent = String(b.name).trim();
        blockSelect.appendChild(opt);
      });
    }
  }

  const unitsBlockSelect = document.getElementById('noticeUnitsBlockSelect');
  if (unitsBlockSelect && data?.building) {
    unitsBlockSelect.innerHTML = '<option value="all">🏢 همه بلوک‌ها</option>';

    if (data.building.type === 'complex') {
      data.building.blocks.forEach(b => {
        const opt = document.createElement('option');
        opt.value = String(b.name).trim();
        opt.textContent = String(b.name).trim();
        unitsBlockSelect.appendChild(opt);
      });
    }
  }

  document.getElementById('noticeTitle').value = '';
  document.getElementById('noticeBody').value = '';
  document.getElementById('noticeImage').value = '';
  document.getElementById('noticeImagePreview').style.display = 'none';
  document.getElementById('noticeTargetType').value = 'all';
  document.getElementById('noticeBlockSection').style.display = 'none';
  document.getElementById('noticeUnitsSection').style.display = 'none';

  noticeSelectedUnits = [];
  noticeImageData = null;

  modal.classList.add('open');
}

function closeNoticeModal() {
  document.getElementById('noticeModal').classList.remove('open');
  noticeImageData = null;
  noticeSelectedUnits = [];
}

function renderNoticeUnitsList() {
  const container = document.getElementById('noticeUnitsList');
  if (!container) return;

  const blockFilter = document.getElementById('noticeUnitsBlockSelect')?.value || 'all';
  const searchQuery = document.getElementById('noticeUnitsSearch')?.value.trim() || '';

  let units = UNITS;

  if (blockFilter !== 'all') {
    units = units.filter(u => String(u.block).trim() === String(blockFilter).trim());
  }

  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    units = units.filter(u => {
      const numberStr = String(u.number);
      const ownerName = (u.owner?.name || '').toLowerCase();
      const unitLabel = `${u.block}-${u.number}`.toLowerCase();

      return numberStr.includes(q) || ownerName.includes(q) || unitLabel.includes(q);
    });
  }

  units = [...units].sort((a, b) => {
    const blockCompare = String(a.block).localeCompare(String(b.block), 'fa');
    if (blockCompare !== 0) return blockCompare;
    return Number(a.number) - Number(b.number);
  });

  if (units.length === 0) {
    container.innerHTML = '<div style="text-align:center; padding:15px; color:#94a3b8; font-size:12px;">واحدی یافت نشد</div>';
    return;
  }

  container.innerHTML = units.map(u => {
    const isSelected = noticeSelectedUnits.includes(u.id);
    const ownerName = u.owner?.name || 'ثبت‌نام نکرده';
    const unitLabel = unitLabelOf(u);

    return `
      <label class="pay-unit-item ${isSelected ? 'selected' : ''}" data-notice-unit="${u.id}">
        <input type="checkbox" class="notice-unit-checkbox" data-unit-id="${u.id}" ${isSelected ? 'checked' : ''} />
        <div class="pay-unit-info">
          <div>
            <div class="pay-unit-label">${unitLabel}</div>
            <div class="pay-unit-owner">${ownerName}</div>
          </div>
        </div>
      </label>
    `;
  }).join('');

  container.querySelectorAll('.notice-unit-checkbox').forEach(cb => {
    cb.addEventListener('change', (e) => {
      const unitId = Number(e.target.dataset.unitId);

      if (e.target.checked) {
        if (!noticeSelectedUnits.includes(unitId)) {
          noticeSelectedUnits.push(unitId);
        }
        e.target.closest('.pay-unit-item').classList.add('selected');
      } else {
        noticeSelectedUnits = noticeSelectedUnits.filter(id => id !== unitId);
        e.target.closest('.pay-unit-item').classList.remove('selected');
      }

      updateNoticeSelectedCount();
    });
  });

  updateNoticeSelectedCount();
}

function updateNoticeSelectedCount() {
  const el = document.getElementById('noticeUnitsSelectedCount');
  if (el) el.textContent = formatNumber(noticeSelectedUnits.length);
}

function noticeSelectAllUnits() {
  const container = document.getElementById('noticeUnitsList');
  if (!container) return;

  const blockFilter = document.getElementById('noticeUnitsBlockSelect')?.value || 'all';

  let units = UNITS;
  if (blockFilter !== 'all') {
    units = units.filter(u => String(u.block).trim() === String(blockFilter).trim());
  }

  units.forEach(u => {
    if (!noticeSelectedUnits.includes(u.id)) {
      noticeSelectedUnits.push(u.id);
    }
  });

  container.querySelectorAll('.notice-unit-checkbox').forEach(cb => {
    cb.checked = true;
    cb.closest('.pay-unit-item').classList.add('selected');
  });

  updateNoticeSelectedCount();
}

function noticeDeselectAllUnits() {
  const container = document.getElementById('noticeUnitsList');
  if (!container) return;

  const blockFilter = document.getElementById('noticeUnitsBlockSelect')?.value || 'all';

  let units = UNITS;
  if (blockFilter !== 'all') {
    units = units.filter(u => String(u.block).trim() === String(blockFilter).trim());
  }

  units.forEach(u => {
    noticeSelectedUnits = noticeSelectedUnits.filter(id => id !== u.id);
  });

  container.querySelectorAll('.notice-unit-checkbox').forEach(cb => {
    cb.checked = false;
    cb.closest('.pay-unit-item').classList.remove('selected');
  });

  updateNoticeSelectedCount();
}

function saveNotice() {
  const title = document.getElementById('noticeTitle').value.trim();
  const body = document.getElementById('noticeBody').value.trim();
  const targetType = document.getElementById('noticeTargetType').value;
  const targetBlock = document.getElementById('noticeBlockSelect').value;

  if (!title) { toastWarning('لطفاً عنوان اطلاعیه را وارد کنید.'); return; }
  if (!body) { toastWarning('لطفاً متن اطلاعیه را وارد کنید.'); return; }
  if (targetType === 'block' && !targetBlock) { toastWarning('لطفاً بلوک را انتخاب کنید.'); return; }
  if (targetType === 'units' && noticeSelectedUnits.length === 0) { toastWarning('لطفاً حداقل یک واحد را انتخاب کنید.'); return; }

  let receivers = 0;
  if (targetType === 'all') {
    receivers = UNITS.length;
  } else if (targetType === 'block') {
    receivers = UNITS.filter(u => String(u.block).trim() === String(targetBlock).trim()).length;
  } else if (targetType === 'units') {
    receivers = noticeSelectedUnits.length;
  }

  const now = new Date();
  const persianDate = now.toLocaleDateString('fa-IR');

  const notices = loadNotices();
  // شناسه یکتا (با همگام‌سازی چند دستگاه، max+1 تکراری می‌شد)
  const newId = Math.max(Date.now(), ...notices.map(n => Number(n.id) || 0)) + 1;

  notices.push({
    id: newId,
    title: title,
    body: body,
    targetType: targetType,
    targetBlock: targetType === 'block' ? targetBlock : null,
    targetUnits: targetType === 'units' ? [...noticeSelectedUnits] : null,
    receivers: receivers,
    image: noticeImageData,
    date: persianDate,
    month: getTodayPersianMonth(),
    year: String(getTodayPersianYear()),
    createdAt: new Date().toISOString(),
  });

  saveNotices(notices);
  closeNoticeModal();
  renderNoticesPage();

  toastSuccess(`اطلاعیه ارسال شد. (${receivers} دریافت‌کننده)`);
}

async function deleteNotice(noticeId) {
  if (!(await appConfirm('⚠️ آیا از حذف این اطلاعیه مطمئن هستید؟'))) return;

  let notices = loadNotices();
  notices = notices.filter(n => n.id !== noticeId);
  saveNotices(notices);

  renderNoticesPage();
  toastSuccess('اطلاعیه حذف شد.');
}

function viewNotice(noticeId) {
  const notices = loadNotices();
  const notice = notices.find(n => n.id === noticeId);
  if (!notice) return;

  const targetLabel = notice.targetType === 'all'
    ? '🌐 همه ساکنین'
    : notice.targetType === 'block'
      ? `🏢 بلوک ${notice.targetBlock}`
      : `🏠 ${notice.targetUnits?.length || 0} واحد`;

  appAlert(`📢 ${notice.title}\n\n${notice.body}\n\n👥 مخاطب: ${targetLabel}\n📅 تاریخ: ${notice.date}`);
}

function bindNoticesPage() {
  const search = document.getElementById('noticesSearch');
  if (search) {
    search.addEventListener('input', (e) => {
      noticesSearchQuery = e.target.value;
      renderNoticesPage();
    });
  }

  const monthFilter = document.getElementById('noticesMonthFilter');
  if (monthFilter) {
    monthFilter.addEventListener('change', (e) => {
      noticesMonthFilter = e.target.value;
      renderNoticesPage();
    });
  }

  const btnAdd = document.getElementById('btnAddNotice');
  if (btnAdd) btnAdd.onclick = openNoticeModal;

  const btnCancel = document.getElementById('noticeCancelBtn');
  if (btnCancel) btnCancel.onclick = closeNoticeModal;

  const btnSave = document.getElementById('noticeSaveBtn');
  if (btnSave) btnSave.onclick = saveNotice;

  const targetSelect = document.getElementById('noticeTargetType');
  if (targetSelect) {
    targetSelect.addEventListener('change', (e) => {
      const type = e.target.value;
      document.getElementById('noticeBlockSection').style.display = type === 'block' ? 'block' : 'none';
      document.getElementById('noticeUnitsSection').style.display = type === 'units' ? 'block' : 'none';
      if (type === 'units') renderNoticeUnitsList();
    });
  }

  const unitsBlockSelect = document.getElementById('noticeUnitsBlockSelect');
  if (unitsBlockSelect) {
    unitsBlockSelect.addEventListener('change', () => {
      renderNoticeUnitsList();
    });
  }

  const unitsSearch = document.getElementById('noticeUnitsSearch');
  if (unitsSearch) {
    unitsSearch.addEventListener('input', () => {
      renderNoticeUnitsList();
    });
  }

  document.getElementById('noticeSelectAllUnits')?.addEventListener('click', noticeSelectAllUnits);
  document.getElementById('noticeDeselectAllUnits')?.addEventListener('click', noticeDeselectAllUnits);

  const imageInput = document.getElementById('noticeImage');
  if (imageInput) {
    imageInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      if (file.size > 2 * 1024 * 1024) {
        toastWarning('حجم عکس نباید بیشتر از ۲ مگابایت باشد.');
        e.target.value = '';
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        noticeImageData = event.target.result;
        document.getElementById('noticeImagePreviewImg').src = noticeImageData;
        document.getElementById('noticeImagePreview').style.display = 'block';
      };
      reader.readAsDataURL(file);
    });
  }

  document.getElementById('noticeImageRemove')?.addEventListener('click', () => {
    noticeImageData = null;
    document.getElementById('noticeImage').value = '';
    document.getElementById('noticeImagePreview').style.display = 'none';
  });

  const tbody = document.getElementById('noticesTableBody');
  if (tbody) {
    tbody.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-notice-action]');
      if (!btn) return;

      const action = btn.dataset.noticeAction;
      const id = Number(btn.dataset.id);

      if (action === 'view') {
        viewNotice(id);
      } else if (action === 'delete') {
        deleteNotice(id);
      }
    });
  }

  const modal = document.getElementById('noticeModal');
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeNoticeModal();
    });
  }
}

/* ============================================================
   صفحه پیام‌ها
   ============================================================ */
let messagesSearchQuery = '';
let messagesFilterType = 'all';

function getMessagesKey() {
  return getAccountStorageKey('ham_sakhteman_messages');
}

function loadMessages() {
  const raw = localStorage.getItem(getMessagesKey());
  if (raw) { try { return JSON.parse(raw); } catch (e) { return []; } }
  return [];
}

function saveMessages(messages) {
  localStorage.setItem(getMessagesKey(), JSON.stringify(messages));
}

function buildConversations() {
  const messages = loadMessages();
  const conversations = {};

  messages.forEach(msg => {
    const key = msg.unitId || 'all';

    if (!conversations[key]) {
      conversations[key] = {
        unitId: key,
        unitLabel: msg.unitLabel || 'گروهی',
        ownerName: msg.ownerName || '—',
        messages: [],
        lastMessage: null,
        unreadCount: 0,
      };
    }

    conversations[key].messages.push(msg);

    if (!msg.read && msg.direction === 'received') {
      conversations[key].unreadCount++;
    }
  });

  Object.values(conversations).forEach(conv => {
    conv.messages.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
    conv.lastMessage = conv.messages[conv.messages.length - 1];
  });

  return Object.values(conversations).sort((a, b) => {
    const dateA = a.lastMessage?.createdAt || '';
    const dateB = b.lastMessage?.createdAt || '';
    return dateB.localeCompare(dateA);
  });
}

function getFilteredConversations() {
  let conversations = buildConversations();

  if (messagesFilterType === 'unread') {
    conversations = conversations.filter(c => c.unreadCount > 0);
  } else if (messagesFilterType === 'sent') {
    conversations = conversations.filter(c =>
      c.messages.some(m => m.direction === 'sent')
    );
  } else if (messagesFilterType === 'received') {
    conversations = conversations.filter(c =>
      c.messages.some(m => m.direction === 'received')
    );
  }

  if (messagesSearchQuery.trim() !== '') {
    const q = messagesSearchQuery.trim().toLowerCase();
    conversations = conversations.filter(c => {
      const label = (c.unitLabel || '').toLowerCase();
      const owner = (c.ownerName || '').toLowerCase();
      const hasMessage = c.messages.some(m => (m.body || '').toLowerCase().includes(q));
      return label.includes(q) || owner.includes(q) || hasMessage;
    });
  }

  return conversations;
}

function renderMessagesStats() {
  const messages = loadMessages();

  const total = messages.length;
  const unread = messages.filter(m => !m.read && m.direction === 'received').length;
  const sent = messages.filter(m => m.direction === 'sent').length;
  const received = messages.filter(m => m.direction === 'received').length;

  const elTotal = document.getElementById('messagesTotal');
  const elUnread = document.getElementById('messagesUnread');
  const elSent = document.getElementById('messagesSent');
  const elReceived = document.getElementById('messagesReceived');

  if (elTotal) elTotal.textContent = formatNumber(total);
  if (elUnread) elUnread.textContent = formatNumber(unread);
  if (elSent) elSent.textContent = formatNumber(sent);
  if (elReceived) elReceived.textContent = formatNumber(received);
}

function renderMessagesPage() {
  renderMessagesStats();

  const container = document.getElementById('conversationsList');
  const countLabel = document.getElementById('messagesCountLabel');
  if (!container) return;

  const conversations = getFilteredConversations();

  if (countLabel) {
    countLabel.textContent = `${formatNumber(conversations.length)} گفتگو`;
  }

  if (conversations.length === 0) {
    container.innerHTML = `
      <div style="text-align:center; color:#94a3b8; padding:40px;">
        هنوز پیامی ارسال نشده است.
        <br><br>
        <button class="btn btn-primary" onclick="document.getElementById('btnAddMessage').click()">
          ➕ ارسال اولین پیام
        </button>
      </div>`;
    return;
  }

  container.innerHTML = conversations.map(conv => {
    const lastMsg = conv.lastMessage;
    const preview = (lastMsg?.body || '').length > 50
      ? lastMsg.body.substring(0, 50) + '...'
      : (lastMsg?.body || '—');

    const unreadBadge = conv.unreadCount > 0
      ? `<span class="badge badge-debt">${formatNumber(conv.unreadCount)} جدید</span>`
      : '';

    return `
      <div class="conversation-item" data-conv-id="${conv.unitId}" style="display:flex; align-items:center; gap:12px; padding:14px; border-bottom:1px solid #e2e8f0; cursor:pointer; transition:background 0.2s;">
        <div style="width:46px; height:46px; border-radius:50%; background:#eef2ff; color:#5b4cdb; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:14px; flex-shrink:0;">
          ${conv.unitId === 'all' ? '🌐' : conv.unitLabel}
        </div>
        <div style="flex:1; min-width:0;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
            <strong style="font-size:14px; color:#1e293b;">${conv.ownerName}</strong>
            <span style="font-size:11.5px; color:#94a3b8;">${lastMsg?.date || ''}</span>
          </div>
          <div style="font-size:13px; color:#64748b; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
            ${preview}
          </div>
        </div>
        ${unreadBadge}
      </div>
    `;
  }).join('');

  container.querySelectorAll('[data-conv-id]').forEach(el => {
    el.addEventListener('click', () => {
      const unitId = el.dataset.convId;
      openConversation(unitId);
    });

    el.addEventListener('mouseenter', () => el.style.background = '#f8fafc');
    el.addEventListener('mouseleave', () => el.style.background = 'transparent');
  });
}

function openMessageModal() {
  const modal = document.getElementById('messageModal');
  const data = loadData();

  const blockSelect = document.getElementById('messageBlockSelect');
  if (blockSelect && data?.building) {
    blockSelect.innerHTML = '<option value="all">🏢 همه بلوک‌ها</option>';

    if (data.building.type === 'complex') {
      data.building.blocks.forEach(b => {
        const opt = document.createElement('option');
        opt.value = String(b.name).trim();
        opt.textContent = String(b.name).trim();
        blockSelect.appendChild(opt);
      });
    }
  }

  const targetBlockSelect = document.getElementById('messageTargetBlock');
  if (targetBlockSelect && data?.building) {
    targetBlockSelect.innerHTML = '<option value="">— انتخاب کنید —</option>';

    if (data.building.type === 'complex') {
      data.building.blocks.forEach(b => {
        const opt = document.createElement('option');
        opt.value = String(b.name).trim();
        opt.textContent = String(b.name).trim();
        targetBlockSelect.appendChild(opt);
      });
    }
  }

  document.getElementById('messageBody').value = '';
  document.getElementById('messageTargetType').value = 'unit';
  document.getElementById('messageUnitSection').style.display = 'block';
  document.getElementById('messageBlockSection').style.display = 'none';
  document.getElementById('messageUnitSearch').value = '';

  renderMessageUnits();

  modal.classList.add('open');
}

function closeMessageModal() {
  document.getElementById('messageModal').classList.remove('open');
}

function renderMessageUnits() {
  const select = document.getElementById('messageUnitSelect');
  if (!select) return;

  const blockFilter = document.getElementById('messageBlockSelect')?.value || 'all';
  const searchQuery = document.getElementById('messageUnitSearch')?.value.trim() || '';

  let units = UNITS;

  if (blockFilter !== 'all') {
    units = units.filter(u => String(u.block).trim() === String(blockFilter).trim());
  }

  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    units = units.filter(u => {
      const numberStr = String(u.number);
      const ownerName = (u.owner?.name || '').toLowerCase();
      const unitLabel = `${u.block}-${u.number}`.toLowerCase();
      return numberStr.includes(q) || ownerName.includes(q) || unitLabel.includes(q);
    });
  }

  units = [...units].sort((a, b) => {
    const blockCompare = String(a.block).localeCompare(String(b.block), 'fa');
    if (blockCompare !== 0) return blockCompare;
    return Number(a.number) - Number(b.number);
  });

  if (units.length === 0) {
    select.innerHTML = '<option disabled>واحدی یافت نشد</option>';
    return;
  }

  select.innerHTML = units.map(u => {
    const ownerName = u.owner?.name || 'ثبت‌نام نکرده';
    const unitLabel = unitLabelOf(u);
    return `<option value="${u.id}">${unitLabel} — ${ownerName}</option>`;
  }).join('');
}

function saveMessage() {
  const targetType = document.getElementById('messageTargetType').value;
  const body = document.getElementById('messageBody').value.trim();

  if (!body) {
    toastWarning('لطفاً متن پیام را وارد کنید.');
    return;
  }

  let targets = [];

  if (targetType === 'unit') {
    const unitId = parseInt(document.getElementById('messageUnitSelect').value);
    const unit = UNITS.find(u => u.id === unitId);

    if (!unit) {
      toastWarning('لطفاً واحد را انتخاب کنید.');
      return;
    }

    targets.push({
      unitId: unit.id,
      unitLabel: `${unit.block}-${toPersianNum(unit.number)}`,
      ownerName: unit.owner?.name || 'ثبت‌نام نکرده',
    });
  } else if (targetType === 'block') {
    const blockName = document.getElementById('messageTargetBlock').value;
    if (!blockName) {
      toastWarning('لطفاً بلوک را انتخاب کنید.');
      return;
    }

    const units = UNITS.filter(u => String(u.block).trim() === String(blockName).trim());

    units.forEach(u => {
      targets.push({
        unitId: u.id,
        unitLabel: `${u.block}-${toPersianNum(u.number)}`,
        ownerName: u.owner?.name || 'ثبت‌نام نکرده',
      });
    });
  } else if (targetType === 'all') {
    UNITS.forEach(u => {
      targets.push({
        unitId: u.id,
        unitLabel: `${u.block}-${toPersianNum(u.number)}`,
        ownerName: u.owner?.name || 'ثبت‌نام نکرده',
      });
    });
  }

  if (targets.length === 0) {
    toastWarning('گیرنده‌ای پیدا نشد.');
    return;
  }

  const messages = loadMessages();
  let lastId = Math.max(messages.length > 0 ? Math.max(...messages.map(m => m.id || 0)) : 0, Date.now());

  const now = new Date();
  const persianDate = now.toLocaleDateString('fa-IR');
  const persianTime = now.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });

  targets.forEach(t => {
    messages.push({
      id: ++lastId,
      unitId: t.unitId,
      unitLabel: t.unitLabel,
      ownerName: t.ownerName,
      body: body,
      direction: 'sent',
      read: true,
      date: persianDate,
      time: persianTime,
      createdAt: now.toISOString(),
    });
  });

  saveMessages(messages);
  closeMessageModal();
  renderMessagesPage();

  toastSuccess(`پیام برای ${targets.length} واحد ارسال شد.`);
}

let currentConversationUnitId = null;

function openConversation(unitId) {
  currentConversationUnitId = unitId;

  const messages = loadMessages();
  const convMessages = messages
    .filter(m => String(m.unitId) === String(unitId))
    .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));

  if (convMessages.length === 0) return;

  const firstMsg = convMessages[0];

  const title = document.getElementById('conversationTitle');
  const subtitle = document.getElementById('conversationSubtitle');
  if (title) title.textContent = firstMsg.ownerName || 'گفتگو';
  if (subtitle) subtitle.textContent = firstMsg.unitLabel || '—';

  renderConversationMessages(convMessages);

  let changed = false;
  messages.forEach(m => {
    if (String(m.unitId) === String(unitId) && !m.read && m.direction === 'received') {
      m.read = true;
      changed = true;
    }
  });
  if (changed) {
    saveMessages(messages);
    renderMessagesStats();
  }

  const modal = document.getElementById('conversationModal');
  if (modal) modal.classList.add('open');

  startManagerChatWatcher(unitId);
}

let managerChatInterval = null;

function startManagerChatWatcher(unitId) {
  if (managerChatInterval) clearInterval(managerChatInterval);
  managerChatInterval = setInterval(() => {
    const convModal = document.getElementById('conversationModal');
    if (!convModal?.classList.contains('open')) {
      clearInterval(managerChatInterval);
      managerChatInterval = null;
      return;
    }

    const messages = loadMessages();
    const convMessages = messages
      .filter(m => String(m.unitId) === String(unitId))
      .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));

    const container = document.getElementById('conversationMessages');
    if (container) {
      const currentCount = container.querySelectorAll('div[style*="display:flex"]').length;
      if (currentCount !== convMessages.length) {
        renderConversationMessages(convMessages);
      }
    }
  }, 2000);
}

function closeConversation() {
  document.getElementById('conversationModal').classList.remove('open');
  currentConversationUnitId = null;
  renderMessagesPage();
}

function renderConversationMessages(msgs) {
  const container = document.getElementById('conversationMessages');
  if (!container) return;

  container.innerHTML = msgs.map(m => {
    const isSent = m.direction === 'sent';

    return `
      <div style="display:flex; ${isSent ? 'justify-content:flex-start;' : 'justify-content:flex-end;'}">
        <div style="max-width: 75%; padding: 10px 14px; border-radius: 14px; ${isSent
          ? 'background:#5b4cdb; color:#fff; border-top-left-radius:4px;'
          : 'background:#fff; color:#1e293b; border:1px solid #e2e8f0; border-top-right-radius:4px;'
        }">
          <div style="font-size:13.5px; line-height:1.7; word-wrap:break-word;">${m.body || ''}</div>
          <div style="font-size:10.5px; margin-top:6px; opacity:0.7; text-align:left;">
            ${m.time || ''} — ${m.date || ''}
          </div>
        </div>
      </div>
    `;
  }).join('');

  container.scrollTop = container.scrollHeight;
}

function sendConversationReply() {
  if (!currentConversationUnitId) return;

  const replyInput = document.getElementById('conversationReply');
  const body = replyInput.value.trim();

  if (!body) return;

  const messages = loadMessages();
  const unit = UNITS.find(u => u.id === Number(currentConversationUnitId));

  if (!unit) return;

  const now = new Date();
  const persianDate = now.toLocaleDateString('fa-IR');
  const persianTime = now.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });

  // شناسه یکتا بین دستگاه‌ها (همگام‌سازی ابری)
  const newId = Math.max(messages.length > 0 ? Math.max(...messages.map(m => m.id || 0)) + 1 : 1, Date.now());

  messages.push({
    id: newId,
    unitId: unit.id,
    unitLabel: `${unit.block}-${toPersianNum(unit.number)}`,
    ownerName: unit.owner?.name || 'ثبت‌نام نکرده',
    body: body,
    direction: 'sent',
    read: true,
    date: persianDate,
    time: persianTime,
    createdAt: now.toISOString(),
  });

  saveMessages(messages);
  replyInput.value = '';

  const convMessages = messages
    .filter(m => String(m.unitId) === String(currentConversationUnitId))
    .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));

  renderConversationMessages(convMessages);
}

function bindMessagesPage() {
  const search = document.getElementById('messagesSearch');
  if (search) {
    search.addEventListener('input', (e) => {
      messagesSearchQuery = e.target.value;
      renderMessagesPage();
    });
  }

  const filter = document.getElementById('messagesFilter');
  if (filter) {
    filter.addEventListener('change', (e) => {
      messagesFilterType = e.target.value;
      renderMessagesPage();
    });
  }

  const btnAdd = document.getElementById('btnAddMessage');
  if (btnAdd) btnAdd.onclick = openMessageModal;

  const btnCancel = document.getElementById('messageCancelBtn');
  if (btnCancel) btnCancel.onclick = closeMessageModal;

  const btnSave = document.getElementById('messageSaveBtn');
  if (btnSave) btnSave.onclick = saveMessage;

  const targetSelect = document.getElementById('messageTargetType');
  if (targetSelect) {
    targetSelect.addEventListener('change', (e) => {
      const type = e.target.value;
      document.getElementById('messageUnitSection').style.display = type === 'unit' ? 'block' : 'none';
      document.getElementById('messageBlockSection').style.display = type === 'block' ? 'block' : 'none';
    });
  }

  const blockSelect = document.getElementById('messageBlockSelect');
  if (blockSelect) {
    blockSelect.addEventListener('change', renderMessageUnits);
  }

  const unitSearch = document.getElementById('messageUnitSearch');
  if (unitSearch) {
    unitSearch.addEventListener('input', renderMessageUnits);
  }

  const convClose = document.getElementById('conversationCloseBtn');
  if (convClose) convClose.onclick = closeConversation;

  const convSend = document.getElementById('conversationSendBtn');
  if (convSend) convSend.onclick = sendConversationReply;

  const convReply = document.getElementById('conversationReply');
  if (convReply) {
    convReply.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') sendConversationReply();
    });
  }

  const messageModal = document.getElementById('messageModal');
  if (messageModal) {
    messageModal.addEventListener('click', (e) => {
      if (e.target === messageModal) closeMessageModal();
    });
  }

  const convModal = document.getElementById('conversationModal');
  if (convModal) {
    convModal.addEventListener('click', (e) => {
      if (e.target === convModal) closeConversation();
    });
  }
}

/* ============================================================
   صفحه رأی‌گیری
   ============================================================ */
let votingSearchQuery = '';
let votingFilterType = 'all';
let votingCandidates = [];
let editingVotingId = null;

function getVotingKey() {
  return getAccountStorageKey('ham_sakhteman_votings');
}

function loadVotings() {
  const raw = localStorage.getItem(getVotingKey());
  if (raw) { try { return JSON.parse(raw); } catch (e) { return []; } }
  return [];
}

function saveVotings(votings) {
  localStorage.setItem(getVotingKey(), JSON.stringify(votings));
}

function getVotingStatus(voting) {
  const now = new Date();
  const start = new Date(voting.startDateTime || voting.createdAt);
  const end = new Date(voting.endDateTime || voting.createdAt);

  if (now < start) return 'upcoming';
  if (now > end) return 'ended';
  return 'active';
}

function getVotingStatusBadge(voting) {
  const status = getVotingStatus(voting);

  if (status === 'upcoming') {
    return '<span class="badge" style="background:#fef3c7; color:#92400e;">🟡 در انتظار</span>';
  }
  if (status === 'ended') {
    return '<span class="badge" style="background:#e5e7eb; color:#4b5563;">⚫ پایان‌یافته</span>';
  }
  return '<span class="badge badge-paid">🟢 فعال</span>';
}

function getFilteredVotings() {
  let list = loadVotings();

  if (votingFilterType !== 'all') {
    list = list.filter(v => getVotingStatus(v) === votingFilterType);
  }

  if (votingSearchQuery.trim() !== '') {
    const q = votingSearchQuery.trim().toLowerCase();
    list = list.filter(v => (v.title || '').toLowerCase().includes(q));
  }

  list = [...list].sort((a, b) => {
    const dateA = a.createdAt || '';
    const dateB = b.createdAt || '';
    return dateB.localeCompare(dateA);
  });

  return list;
}

function renderVotingStats() {
  const all = loadVotings();

  const total = all.length;
  const active = all.filter(v => getVotingStatus(v) === 'active').length;
  const upcoming = all.filter(v => getVotingStatus(v) === 'upcoming').length;
  const ended = all.filter(v => getVotingStatus(v) === 'ended').length;

  const elTotal = document.getElementById('votingTotal');
  const elActive = document.getElementById('votingActive');
  const elUpcoming = document.getElementById('votingUpcoming');
  const elEnded = document.getElementById('votingEnded');

  if (elTotal) elTotal.textContent = formatNumber(total);
  if (elActive) elActive.textContent = formatNumber(active);
  if (elUpcoming) elUpcoming.textContent = formatNumber(upcoming);
  if (elEnded) elEnded.textContent = formatNumber(ended);
}

function renderVotingPage() {
  renderVotingStats();

  const tbody = document.getElementById('votingTableBody');
  const countLabel = document.getElementById('votingCountLabel');
  if (!tbody) return;

  const votings = getFilteredVotings();

  if (countLabel) {
    countLabel.textContent = `${formatNumber(votings.length)} مورد`;
  }

  if (votings.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align:center;color:#94a3b8;padding:40px;">
          هنوز رأی‌گیری‌ای ایجاد نشده است.
          <br><br>
          <button class="btn btn-primary" onclick="document.getElementById('btnAddVoting').click()">
            ➕ ایجاد اولین رأی‌گیری
          </button>
        </td>
      </tr>`;
    return;
  }

  tbody.innerHTML = votings.map(v => {
    const candidatesCount = (v.candidates || []).length;
    const totalVotes = (v.votes || []).length;
    const statusBadge = getVotingStatusBadge(v);

    return `
      <tr>
        <td><strong>${v.title || '—'}</strong></td>
        <td style="font-size:12.5px;">${v.startDate || '—'} ${v.startTime || ''}</td>
        <td style="font-size:12.5px;">${v.endDate || '—'} ${v.endTime || ''}</td>
        <td><span class="badge badge-paid">${formatNumber(candidatesCount)} نفر</span></td>
        <td><strong>${formatNumber(totalVotes)}</strong></td>
        <td>${statusBadge}</td>
        <td>
          <div class="row-actions">
            <button class="row-action-btn" data-voting-action="results" data-id="${v.id}" title="نمودار نتایج">📊</button>
            <button class="row-action-btn" data-voting-action="edit" data-id="${v.id}" title="ویرایش">✏️</button>
            <button class="row-action-btn danger" data-voting-action="delete" data-id="${v.id}" title="حذف">🗑️</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function openVotingModal() {
  const modal = document.getElementById('votingModal');

  document.getElementById('votingTitle').value = '';
  document.getElementById('votingDescription').value = '';
  document.getElementById('votingStartDate').value = '';
  document.getElementById('votingStartTime').value = '';
  document.getElementById('votingEndDate').value = '';
  document.getElementById('votingEndTime').value = '';

  votingCandidates = [];
  renderVotingCandidates();

  modal.classList.add('open');
}

function editVoting(votingId) {
  const votings = loadVotings();
  const voting = votings.find(v => v.id === votingId);
  if (!voting) return;

  editingVotingId = votingId;

  document.getElementById('votingModalTitle').textContent = 'ویرایش رأی‌گیری';
  document.getElementById('votingSaveBtn').textContent = '💾 ذخیره تغییرات';

  document.getElementById('votingTitle').value = voting.title || '';
  document.getElementById('votingDescription').value = voting.description || '';
  document.getElementById('votingStartDate').value = voting.startDate || '';
  document.getElementById('votingStartTime').value = voting.startTime || '';
  document.getElementById('votingEndDate').value = voting.endDate || '';
  document.getElementById('votingEndTime').value = voting.endTime || '';

  votingCandidates = (voting.candidates || []).map(c => ({
    id: c.id,
    name: c.name || '',
    phone: c.phone || '',
  }));
  renderVotingCandidates();

  document.getElementById('votingModal').classList.add('open');
}

function closeVotingModal() {
  document.getElementById('votingModal').classList.remove('open');
  votingCandidates = [];
  editingVotingId = null;
}

function addVotingCandidate() {
  const newId = votingCandidates.length > 0
    ? Math.max(...votingCandidates.map(c => c.id)) + 1
    : 1;

  votingCandidates.push({ id: newId, name: '', phone: '' });
  renderVotingCandidates();
}

function removeVotingCandidate(id) {
  votingCandidates = votingCandidates.filter(c => c.id !== id);
  renderVotingCandidates();
}

function renderVotingCandidates() {
  const container = document.getElementById('votingCandidatesList');
  if (!container) return;

  if (votingCandidates.length === 0) {
    container.innerHTML = `
      <div style="text-align:center; color:#94a3b8; padding:20px; font-size:13px; background:#fff; border-radius:10px; border:1px dashed #e2e8f0;">
        هنوز کاندیدی اضافه نشده. روی «➕ افزودن کاندید» بزنید.
      </div>
    `;
    return;
  }

  container.innerHTML = votingCandidates.map((c, idx) => {
    return `
      <div class="form-section" style="margin-bottom:8px; padding:12px;">
        <div style="display:flex; gap:8px; align-items:center;">
          <div style="background:#eef2ff; color:#5b4cdb; width:30px; height:30px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:13px; flex-shrink:0;">
            ${toPersianNum(idx + 1)}
          </div>
          <input type="text"
                 class="form-input candidate-name-input"
                 data-candidate-id="${c.id}"
                 placeholder="نام و نام خانوادگی کاندید"
                 value="${c.name || ''}"
                 style="flex:1; padding:8px 10px; font-size:13px; text-align:right;" />
          <input type="tel"
                 class="form-input candidate-phone-input"
                 data-candidate-id="${c.id}"
                 placeholder="شماره تماس"
                 value="${c.phone || ''}"
                 maxlength="11"
                 style="width:140px; padding:8px 10px; font-size:13px; text-align:right;" />
          <button type="button" class="row-action-btn danger" onclick="removeVotingCandidate(${c.id})" title="حذف">🗑️</button>
        </div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('.candidate-name-input').forEach(inp => {
    inp.addEventListener('input', (e) => {
      const candidate = votingCandidates.find(c => c.id === Number(e.target.dataset.candidateId));
      if (candidate) candidate.name = e.target.value.trim();
    });
  });

  container.querySelectorAll('.candidate-phone-input').forEach(inp => {
    inp.addEventListener('input', (e) => {
      const candidate = votingCandidates.find(c => c.id === Number(e.target.dataset.candidateId));
      if (candidate) candidate.phone = e.target.value.trim();
    });
  });
}

function saveVoting() {
  const title = document.getElementById('votingTitle').value.trim();
  const description = document.getElementById('votingDescription').value.trim();
  const startDate = document.getElementById('votingStartDate').value.trim();
  const startTime = document.getElementById('votingStartTime').value.trim();
  const endDate = document.getElementById('votingEndDate').value.trim();
  const endTime = document.getElementById('votingEndTime').value.trim();

  if (!title) { toastWarning('لطفاً عنوان رأی‌گیری را وارد کنید.'); return; }
  if (!startDate || !startTime) { toastWarning('لطفاً تاریخ و ساعت شروع را وارد کنید.'); return; }
  if (!endDate || !endTime) { toastWarning('لطفاً تاریخ و ساعت پایان را وارد کنید.'); return; }
  if (votingCandidates.length < 2) { toastWarning('حداقل ۲ کاندید لازم است.'); return; }

  const emptyCandidates = votingCandidates.filter(c => !c.name || !c.name.trim());
  if (emptyCandidates.length > 0) {
    toastWarning('لطفاً نام همه کاندیدها را وارد کنید.');
    return;
  }

  const startDateTime = parsePersianDateTime(startDate, startTime);
  const endDateTime = parsePersianDateTime(endDate, endTime);

  if (!startDateTime || !endDateTime) { toastWarning('خطا در تاریخ یا ساعت.'); return; }
  if (endDateTime <= startDateTime) { toastWarning('زمان پایان باید بعد از زمان شروع باشد.'); return; }

  const votings = loadVotings();

  if (editingVotingId) {
    const idx = votings.findIndex(v => v.id === editingVotingId);
    if (idx !== -1) {
      const old = votings[idx];
      votings[idx] = {
        ...old,
        title, description, startDate, startTime, endDate, endTime,
        startDateTime: startDateTime.toISOString(),
        endDateTime: endDateTime.toISOString(),
        candidates: votingCandidates.map(c => {
          const prev = (old.candidates || []).find(x => x.id === c.id);
          return {
            id: c.id,
            name: c.name.trim(),
            phone: (c.phone || '').trim(),
            votes: prev ? (prev.votes || 0) : 0,
          };
        }),
      };
    }
    editingVotingId = null;
    saveVotings(votings);
    closeVotingModal();
    renderVotingPage();
    toastSuccess('رأی‌گیری ویرایش شد.');
    return;
  }

  const newId = Math.max(Date.now(), ...votings.map(v => Number(v.id) || 0)) + 1;

  votings.push({
    id: newId,
    title, description, startDate, startTime, endDate, endTime,
    startDateTime: startDateTime.toISOString(),
    endDateTime: endDateTime.toISOString(),
    candidates: votingCandidates.map(c => ({
      id: c.id,
      name: c.name.trim(),
      phone: (c.phone || '').trim(),
      votes: 0,
    })),
    votes: [],
    eligibleVoters: 'owners',
    createdAt: new Date().toISOString(),
  });

  saveVotings(votings);
  closeVotingModal();
  renderVotingPage();

  toastSuccess('رأی‌گیری ایجاد شد.');
}

function parsePersianDateTime(dateStr, timeStr) {
  try {
    const persianDigits = '۰۱۲۳۴۵۶۷۸۹';
    const arabicDigits = '٠١٢٣٤٥٦٧٨٩';

    let cleaned = dateStr;
    for (let i = 0; i < 10; i++) {
      cleaned = cleaned.replace(new RegExp(persianDigits[i], 'g'), i);
      cleaned = cleaned.replace(new RegExp(arabicDigits[i], 'g'), i);
    }

    const parts = cleaned.split('/');
    if (parts.length !== 3) return null;

    const year = parseInt(parts[0]);
    const month = parseInt(parts[1]);
    const day = parseInt(parts[2]);

    const timeParts = timeStr.replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).split(':');
    const hour = parseInt(timeParts[0]) || 0;
    const minute = parseInt(timeParts[1]) || 0;

    const gregorian = persianToGregorian(year, month, day);
    return new Date(gregorian.year, gregorian.month - 1, gregorian.day, hour, minute);
  } catch (e) {
    return null;
  }
}

function persianToGregorian(jy, jm, jd) {
  let gy, gm, gd;

  jy += 1595;
  let days = -355668 + (365 * jy) + (Math.floor(jy / 33) * 8) + Math.floor(((jy % 33) + 3) / 4) + jd + ((jm < 7) ? (jm - 1) * 31 : ((jm - 7) * 30) + 186);

  gy = 400 * Math.floor(days / 146097);
  days %= 146097;

  if (days > 36524) {
    gy += 100 * Math.floor(--days / 36524);
    days %= 36524;
    if (days >= 365) days++;
  }

  gy += 4 * Math.floor(days / 1461);
  days %= 1461;

  if (days > 365) {
    gy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }

  gd = days + 1;

  const sal_a = [0, 31, ((gy % 4 === 0 && gy % 100 !== 0) || (gy % 400 === 0)) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  for (gm = 0; gm < 13 && gd > sal_a[gm]; gm++) gd -= sal_a[gm];

  return { year: gy, month: gm, day: gd };
}

async function showVotingResults(votingId) {
  const votings = loadVotings();
  const voting = votings.find(v => v.id === votingId);
  if (!voting) return;

  const status = getVotingStatus(voting);

  if (status !== 'ended') {
    if (!(await appConfirm('⚠️ رأی‌گیری هنوز تمام نشده. آیا می‌خواهید نتایج فعلی را ببینید؟'))) {
      return;
    }
  }

  const title = document.getElementById('votingResultsTitle');
  const subtitle = document.getElementById('votingResultsSubtitle');
  const content = document.getElementById('votingResultsContent');

  if (title) title.textContent = voting.title;
  if (subtitle) subtitle.textContent = `از ${voting.startDate} ${voting.startTime} تا ${voting.endDate} ${voting.endTime}`;

  const totalVotes = (voting.votes || []).length;
  const totalOwners = UNITS.filter(u => u.owner && u.owner.name).length;
  const participation = totalOwners > 0 ? Math.round((totalVotes / totalOwners) * 100) : 0;

  const sortedCandidates = [...(voting.candidates || [])].sort((a, b) => (b.votes || 0) - (a.votes || 0));
  const winner = sortedCandidates[0];

  let html = `
    <div style="background:#f8fafc; border-radius:12px; padding:16px; margin-bottom:16px; display:grid; grid-template-columns: 1fr 1fr 1fr; gap:10px;">
      <div style="text-align:center;">
        <div style="font-size:11.5px; color:#64748b; margin-bottom:4px;">کل آراء</div>
        <div style="font-size:20px; font-weight:800; color:#5b4cdb;">${formatNumber(totalVotes)}</div>
      </div>
      <div style="text-align:center;">
        <div style="font-size:11.5px; color:#64748b; margin-bottom:4px;">مالکین</div>
        <div style="font-size:20px; font-weight:800; color:#1e293b;">${formatNumber(totalOwners)}</div>
      </div>
      <div style="text-align:center;">
        <div style="font-size:11.5px; color:#64748b; margin-bottom:4px;">مشارکت</div>
        <div style="font-size:20px; font-weight:800; color:#22c55e;">${formatNumber(participation)}٪</div>
      </div>
    </div>
  `;

  if (totalVotes > 0 && winner) {
    html += `
      <div style="background:linear-gradient(135deg, #5b4cdb 0%, #4338ca 100%); border-radius:12px; padding:16px; margin-bottom:16px; color:#fff; text-align:center;">
        <div style="font-size:12px; opacity:0.9; margin-bottom:6px;">🏆 برنده</div>
        <div style="font-size:18px; font-weight:800;">${winner.name}</div>
        <div style="font-size:12px; opacity:0.9; margin-top:4px;">${winner.phone ? winner.phone + ' — ' : ''}${formatNumber(winner.votes || 0)} رأی</div>
      </div>
    `;
  }

  html += `<div style="margin-top:16px;">`;

  sortedCandidates.forEach((c, idx) => {
    const votes = c.votes || 0;
    const percent = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;

    let medal = '';
    if (idx === 0 && totalVotes > 0) medal = '🥇';
    else if (idx === 1 && totalVotes > 0) medal = '🥈';
    else if (idx === 2 && totalVotes > 0) medal = '🥉';

    html += `
      <div style="background:#fff; border:1px solid #e2e8f0; border-radius:10px; padding:12px; margin-bottom:8px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
          <div>
            <strong style="font-size:14px;">${medal} ${c.name}</strong>
            ${c.phone ? `<span style="font-size:12px; color:#64748b; margin-right:8px;">(${c.phone})</span>` : ''}
          </div>
          <div style="text-align:left;">
            <strong style="font-size:16px; color:#5b4cdb;">${formatNumber(votes)}</strong>
            <span style="font-size:11.5px; color:#64748b;"> رأی (${percent}٪)</span>
          </div>
        </div>
        <div style="background:#eef2ff; border-radius:8px; height:8px; overflow:hidden;">
          <div style="background:#5b4cdb; height:100%; width:${percent}%; transition:width 0.3s;"></div>
        </div>
      </div>
    `;
  });

  html += `</div>`;

  if (content) content.innerHTML = html;

  const modal = document.getElementById('votingResultsModal');
  if (modal) modal.classList.add('open');
}

function closeVotingResults() {
  document.getElementById('votingResultsModal').classList.remove('open');
}

async function deleteVoting(votingId) {
  if (!(await appConfirm('⚠️ آیا از حذف این رأی‌گیری مطمئن هستید؟'))) return;

  let votings = loadVotings();
  votings = votings.filter(v => v.id !== votingId);
  saveVotings(votings);

  renderVotingPage();
  toastSuccess('رأی‌گیری حذف شد.');
}

function bindVotingPage() {
  const search = document.getElementById('votingSearch');
  if (search) {
    search.addEventListener('input', (e) => {
      votingSearchQuery = e.target.value;
      renderVotingPage();
    });
  }

  const filter = document.getElementById('votingFilter');
  if (filter) {
    filter.addEventListener('change', (e) => {
      votingFilterType = e.target.value;
      renderVotingPage();
    });
  }

  const btnAdd = document.getElementById('btnAddVoting');
  if (btnAdd) btnAdd.onclick = openVotingModal;

  const btnCancel = document.getElementById('votingCancelBtn');
  if (btnCancel) btnCancel.onclick = closeVotingModal;

  const btnSave = document.getElementById('votingSaveBtn');
  if (btnSave) btnSave.onclick = saveVoting;

  const btnAddCandidate = document.getElementById('votingAddCandidate');
  if (btnAddCandidate) btnAddCandidate.onclick = addVotingCandidate;

  const resultsClose = document.getElementById('votingResultsCloseBtn');
  if (resultsClose) resultsClose.onclick = closeVotingResults;

  const tbody = document.getElementById('votingTableBody');
  if (tbody) {
    tbody.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-voting-action]');
      if (!btn) return;

      const action = btn.dataset.votingAction;
      const id = Number(btn.dataset.id);

      if (action === 'results') {
        showVotingResults(id);
      } else if (action === 'edit') {
        editVoting(id);
      } else if (action === 'delete') {
        deleteVoting(id);
      }
    });
  }

  const modal1 = document.getElementById('votingModal');
  if (modal1) {
    modal1.addEventListener('click', (e) => {
      if (e.target === modal1) closeVotingModal();
    });
  }

  const modal2 = document.getElementById('votingResultsModal');
  if (modal2) {
    modal2.addEventListener('click', (e) => {
      if (e.target === modal2) closeVotingResults();
    });
  }
}

/* ============================================================
   صفحه گزارشات
   ============================================================ */
let reportPeriod = 'thisMonth';

function getReportDateRange() {
  // ✅ اصلاح: «این ماه» یعنی ماه جاری تقویم، نه ماهی که در صفحه شارژ انتخاب شده
  const today = getTodayPersian();
  const currentMonth = PERSIAN_MONTHS[today.month - 1];
  const currentYear = String(today.year);
  const monthRange = (monthName, yearStr) => {
    const m = PERSIAN_MONTHS.indexOf(monthName) + 1;
    const y = parseInt(toEnDigits(yearStr), 10);
    return { fromKey: y * 10000 + m * 100 + 1, toKey: y * 10000 + m * 100 + 31 };
  };

  let label = 'همه دوره‌ها';
  let fromKey = 0;
  let toKey = 99999999;

  if (reportPeriod === 'thisMonth') {
    label = `${currentMonth} ${toPersianNum(currentYear)}`;
    ({ fromKey, toKey } = monthRange(currentMonth, currentYear));
  } else if (reportPeriod === 'lastMonth') {
    const prev = getLastNPersianMonths(2)[0];
    label = `${prev.month} ${toPersianNum(prev.year)}`;
    ({ fromKey, toKey } = monthRange(prev.month, prev.year));
  } else if (reportPeriod === 'specificMonth') {
    const month = document.getElementById('reportMonthSelect')?.value || currentMonth;
    const year = String(document.getElementById('reportMonthYearSelect')?.value || currentYear);
    label = `${month} ${toPersianNum(year)}`;
    ({ fromKey, toKey } = monthRange(month, year));
  } else if (reportPeriod === 'thisYear') {
    const y = parseInt(currentYear, 10);
    label = `سال ${toPersianNum(currentYear)}`;
    fromKey = y * 10000 + 101;
    toKey = y * 10000 + 1231;
  } else if (reportPeriod === 'custom') {
    const fromDate = document.getElementById('reportFromDate')?.value.trim() || '';
    const toDate = document.getElementById('reportToDate')?.value.trim() || '';
    const f = parsePersianDateParts(fromDate);
    const t = parsePersianDateParts(toDate);
    if (!f && !t) {
      label = 'دستی (بازه نامشخص)';
    } else {
      label = `${fromDate || '—'} تا ${toDate || '—'}`;
      if (f) fromKey = f.year * 10000 + f.month * 100 + f.day;
      if (t) toKey = t.year * 10000 + t.month * 100 + t.day;
    }
  }

  const inRange = (key) => key >= fromKey && key <= toKey;
  return {
    label,
    fromKey,
    toKey,
    inRange,
    // دوره صدور شارژ (برای آمار تعهدی: چند شارژ صادر شد / چندتا وصول شد)
    chargeInPeriod: (c) => {
      const m = PERSIAN_MONTHS.indexOf(c.month) + 1;
      const y = parseInt(toEnDigits(c.year), 10);
      if (!m || !y) return false;
      // شارژ ماهانه کل ماه را پوشش می‌دهد؛ با بازه همپوشانی داشته باشد
      const start = y * 10000 + m * 100 + 1;
      const end = y * 10000 + m * 100 + 31;
      return start <= toKey && end >= fromKey;
    },
    // وصول نقدی (برای درآمد و مانده صندوق)
    collectedInPeriod: (c) => c.paid === true && inRange(getChargeCashPeriod(c).key || persianDateSortKey(null, c.paidAt) || 0),
    // هزینه/درآمد جانبی بر اساس ماه/سال ثبت‌شده + روز از تاریخ
    entryInPeriod: (item) => {
      const m = PERSIAN_MONTHS.indexOf(item.month) + 1;
      const y = parseInt(toEnDigits(item.year), 10);
      let key;
      if (m && y) {
        const p = parsePersianDateParts(item.date);
        const d = (p && p.year === y && p.month === m) ? p.day : 1;
        key = y * 10000 + m * 100 + d;
      } else {
        key = getEntryDateKey(item);
      }
      return inRange(key);
    },
    // سازگاری با کد قدیمی
    filterFn: () => true,
  };
}

/** همه اعداد گزارش در یک‌جا تا صفحه، اکسل و PDF همیشه یکسان باشند */
function getReportDataset(range) {
  const allCharges = loadCharges().filter(range.chargeInPeriod);
  const paidCharges = allCharges.filter(c => c.paid);
  const unpaidCharges = allCharges.filter(c => !c.paid);
  const collected = loadCharges().filter(range.collectedInPeriod);

  const chargesSum = allCharges.reduce((s, c) => s + (Number(c.total) || 0), 0);
  const chargesPaidOfPeriod = paidCharges.reduce((s, c) => s + (Number(c.total) || 0), 0);
  const chargesDebt = unpaidCharges.reduce((s, c) => s + (Number(c.total) || 0), 0);
  const chargesIncome = collected.reduce((s, c) => s + (Number(c.total) || 0), 0);

  const allSideIncomes = loadSideIncomes().filter(range.entryInPeriod);
  const sideIncomesSum = allSideIncomes.reduce((s, i) => s + (Number(i.amount) || 0), 0);

  const allExpenses = loadExpenses().filter(range.entryInPeriod);
  const expensesSum = allExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const expensesAvg = allExpenses.length > 0 ? Math.round(expensesSum / allExpenses.length) : 0;
  const expensesMax = allExpenses.length > 0 ? Math.max(...allExpenses.map(e => Number(e.amount) || 0)) : 0;

  const totalIncome = chargesIncome + sideIncomesSum;
  const balance = totalIncome - expensesSum;
  const totalDebt = UNITS.reduce((s, u) => s + (Number(u.debt) || 0), 0);
  const fund = getFundBalance();

  return {
    allCharges, paidCharges, unpaidCharges, collected,
    chargesSum, chargesPaidOfPeriod, chargesDebt, chargesIncome,
    allSideIncomes, sideIncomesSum,
    allExpenses, expensesSum, expensesAvg, expensesMax,
    totalIncome, balance, totalDebt, fund,
  };
}

/** موجودی واقعی صندوق = موجودی اول دوره + کل وصولی‌ها + کل درآمد جانبی − کل هزینه‌ها */
function getFundBalance() {
  const settings = loadSettings();
  const opening = Number(settings.openingBalance) || 0;
  const collected = loadCharges().filter(c => c.paid).reduce((s, c) => s + (Number(c.total) || 0), 0);
  const side = loadSideIncomes().reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const exp = loadExpenses().reduce((s, e) => s + (Number(e.amount) || 0), 0);
  return opening + collected + side - exp;
}

function parseReportDate(dateStr) {
  const p = parsePersianDateParts(dateStr);
  if (!p) return null;
  const g = persianToGregorian(p.year, p.month, p.day);
  return new Date(g.year, g.month - 1, g.day);
}

function renderReportsPage() {
  refreshUnitsDebtIfStale();
  const range = getReportDateRange();

  const labelEl = document.getElementById('reportPeriodLabel');
  if (labelEl) labelEl.textContent = range.label;

  const badge = document.getElementById('reportDonutBadge');
  if (badge) badge.textContent = range.label;

  const d = getReportDataset(range);

  const setTxt = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  setTxt('reportIncome', formatToman(d.totalIncome));
  setTxt('reportExpense', formatToman(d.expensesSum));
  setTxt('reportBalance', (d.balance < 0 ? '−' : '') + formatToman(Math.abs(d.balance)));
  setTxt('reportDebt', formatToman(d.totalDebt));
  setTxt('reportFund', (d.fund < 0 ? '−' : '') + formatToman(Math.abs(d.fund)));

  setTxt('reportChargesCount', formatNumber(d.allCharges.length));
  setTxt('reportChargesPaid', formatNumber(d.paidCharges.length));
  setTxt('reportChargesUnpaid', formatNumber(d.unpaidCharges.length));
  setTxt('reportChargesSum', formatToman(d.chargesSum));
  setTxt('reportChargesIncome', formatToman(d.chargesPaidOfPeriod));
  setTxt('reportChargesDebt', formatToman(d.chargesDebt));

  setTxt('reportExpensesCount', formatNumber(d.allExpenses.length));
  setTxt('reportExpensesSum', formatToman(d.expensesSum));
  setTxt('reportExpensesAvg', formatToman(d.expensesAvg));
  setTxt('reportExpensesMax', formatToman(d.expensesMax));

  // درصد وصول بر اساس «مبلغ»، نه تعداد (یک واحد بزرگ بدهکار با یک واحد کوچک برابر نیست)
  const paidPercent = d.chargesSum > 0
    ? Math.round((d.chargesPaidOfPeriod / d.chargesSum) * 100)
    : 0;

  setTxt('reportDonutPercent', formatNumber(paidPercent) + '٪');

  renderReportDonutChart(d.chargesPaidOfPeriod, d.chargesDebt);
  renderReportLineChart();
  renderReportCategories(d.allExpenses, d.expensesSum);
  renderReportDebtors();
}

function renderReportDonutChart(paid, unpaid) {
  const canvas = document.getElementById('reportDonutChart');
  if (!canvas) return;
  const { ctx, W, H } = prepareCanvas(canvas, 180, 180);
  const size = Math.min(W, H);
  const lineWidth = Math.max(12, Math.round(size * 0.1));
  const cx = W / 2, cy = H / 2, radius = size / 2 - lineWidth / 2 - 2;
  const total = paid + unpaid || 1;
  const paidAngle = (paid / total) * Math.PI * 2;

  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.strokeStyle = '#f1f5f9';
  ctx.lineWidth = lineWidth;
  ctx.stroke();

  if (paid > 0) {
    ctx.beginPath();
    ctx.arc(cx, cy, radius, -Math.PI / 2, -Math.PI / 2 + paidAngle);
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'butt';
    ctx.stroke();
  }

  if (unpaid > 0) {
    ctx.beginPath();
    ctx.arc(cx, cy, radius, -Math.PI / 2 + paidAngle, -Math.PI / 2 + Math.PI * 2);
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'butt';
    ctx.stroke();
  }
}

function renderReportLineChart() {
  const canvas = document.getElementById('reportLineChart');
  if (!canvas) return;
  const { ctx, W, H } = prepareCanvas(canvas, 400, 220);

  // روند درآمد ۶ ماه اخیر (شارژ پرداخت‌شده + درآمد جانبی)
  const lastSix = (typeof getLastSixPersianMonths === 'function')
    ? getLastSixPersianMonths()
    : PERSIAN_MONTHS.slice(0, 6).map(m => ({ month: m, year: String(getTodayPersianYear()), label: m }));
  const months = lastSix.map(x => x.label);
  const values = lastSix.map(x =>
    (typeof getIncomeForMonth === 'function')
      ? getIncomeForMonth(x.month, x.year)
      : 0
  );

  const hasData = values.some(v => v > 0);
  const maxVal = Math.max(...values, 1) * 1.15;
  const padding = { top: 20, right: 20, bottom: 40, left: 64 };
  const chartW = W - padding.left - padding.right;
  const chartH = H - padding.top - padding.bottom;

  drawYAxis(ctx, padding, chartW, chartH, hasData ? maxVal : 0);
  if (!hasData) {
    drawEmptyChartText(ctx, W, H, 'هنوز درآمدی در ۶ ماه اخیر ثبت نشده');
  }

  const points = values.map((v, i) => ({
    x: padding.left + (values.length > 1 ? (chartW / (values.length - 1)) * i : chartW / 2),
    y: padding.top + chartH - (v / maxVal) * chartH,
  }));

  const grad = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartH);
  grad.addColorStop(0, 'rgba(91, 76, 219, 0.25)');
  grad.addColorStop(1, 'rgba(91, 76, 219, 0)');

  ctx.beginPath();
  ctx.moveTo(points[0].x, padding.top + chartH);
  points.forEach(p => ctx.lineTo(p.x, p.y));
  ctx.lineTo(points[points.length - 1].x, padding.top + chartH);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.beginPath();
  points.forEach((p, i) => {
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  });
  ctx.strokeStyle = '#5b4cdb';
  ctx.lineWidth = 3;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke();

  points.forEach(p => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#5b4cdb';
    ctx.lineWidth = 3;
    ctx.stroke();
  });

  ctx.fillStyle = '#64748b';
  ctx.font = '12px Vazirmatn, Tahoma';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  months.forEach((m, i) => {
    ctx.fillText(m, points[i].x, padding.top + chartH + 12);
  });
}

function renderReportCategories(expenses, total) {
  const tbody = document.getElementById('reportCategoriesBody');
  const countLabel = document.getElementById('reportCategoriesCount');
  if (!tbody) return;

  const categories = {};

  expenses.forEach(e => {
    const cat = e.category || 'سایر';
    if (!categories[cat]) {
      categories[cat] = { count: 0, sum: 0 };
    }
    categories[cat].count++;
    categories[cat].sum += Number(e.amount) || 0;
  });

  const list = Object.entries(categories).map(([name, data]) => ({
    name,
    ...data,
    percent: total > 0 ? Math.round((data.sum / total) * 100) : 0,
  })).sort((a, b) => b.sum - a.sum);

  if (countLabel) countLabel.textContent = `${formatNumber(list.length)} دسته`;

  if (list.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" style="text-align:center;color:#94a3b8;padding:30px;">
          هزینه‌ای در این دوره ثبت نشده.
        </td>
      </tr>`;
    return;
  }

  const categoryIcons = {
    'نظافت': '🧹',
    'تعمیرات': '🔧',
    'قبوض': '💡',
    'آسانسور': '🛗',
    'فضای سبز': '🌿',
    'نگهبانی': '🚪',
    'سایر': '📦',
  };

  tbody.innerHTML = list.map(c => `
    <tr>
      <td>${categoryIcons[c.name] || '📦'} <strong>${c.name}</strong></td>
      <td>${formatNumber(c.count)}</td>
      <td><strong>${formatToman(c.sum)}</strong></td>
      <td>${formatNumber(c.percent)}٪</td>
    </tr>
  `).join('');
}

function renderReportDebtors() {
  const tbody = document.getElementById('reportDebtorsBody');
  const countLabel = document.getElementById('reportDebtorsCount');
  if (!tbody) return;

  const debtors = UNITS
    .filter(u => Number(u.debt) > 0)
    .sort((a, b) => Number(b.debt) - Number(a.debt));

  if (countLabel) countLabel.textContent = `${formatNumber(debtors.length)} مورد`;

  if (debtors.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" style="text-align:center;color:#94a3b8;padding:30px;">
          همه واحدها تسویه هستند. ✅
        </td>
      </tr>`;
    return;
  }

  tbody.innerHTML = debtors.map(u => `
    <tr>
      <td><strong>${u.block}-${toPersianNum(u.number)}</strong></td>
      <td>${u.owner?.name || 'ثبت‌نام نکرده'}</td>
      <td>${u.owner?.phone || '—'}</td>
      <td style="color:#b91c1c;"><strong>${formatToman(u.debt)}</strong></td>
    </tr>
  `).join('');
}

function exportReportToExcel() {
  const range = getReportDateRange();
  const d = getReportDataset(range);
  const { allCharges, allExpenses, allSideIncomes, chargesIncome, sideIncomesSum, expensesSum, balance, fund } = d;

  let html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office"
          xmlns:x="urn:schemas-microsoft-com:office:excel"
          xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="UTF-8">
      <style>
        table { border-collapse: collapse; font-family: Tahoma; direction: rtl; margin-bottom:20px; }
        th, td { border: 1px solid #ccc; padding: 8px; text-align: right; font-size: 13px; }
        th { background: #5b4cdb; color: white; font-weight: bold; }
        h2 { color: #5b4cdb; }
        .summary td { background: #f8fafc; }
      </style>
    </head>
    <body>
      <h2>گزارش مالی — ${range.label}</h2>

      <h3>خلاصه کلی</h3>
      <table class="summary">
        <tr><td>شارژ وصول‌شده در این دوره</td><td>${chargesIncome.toLocaleString('en-US')} تومان</td></tr>
        <tr><td>درآمد جانبی</td><td>${sideIncomesSum.toLocaleString('en-US')} تومان</td></tr>
        <tr><td>کل هزینه‌ها</td><td>${expensesSum.toLocaleString('en-US')} تومان</td></tr>
        <tr><td>تراز دوره (درآمد − هزینه)</td><td>${balance.toLocaleString('en-US')} تومان</td></tr>
        <tr><td>موجودی فعلی صندوق</td><td>${fund.toLocaleString('en-US')} تومان</td></tr>
      </table>

      <h3>شارژها (${allCharges.length} مورد)</h3>
      <table>
        <thead>
          <tr>
            <th>واحد</th><th>ماه</th><th>مبلغ</th>
            <th>وضعیت</th><th>تاریخ پرداخت</th><th>روش پرداخت</th>
          </tr>
        </thead>
        <tbody>
  `;

  allCharges.forEach(c => {
    const unit = UNITS.find(u => u.id === c.unitId);
    const unitLabel = unit ? `${unit.block}-${unit.number}` : '—';

    html += `
      <tr>
        <td>${unitLabel}</td>
        <td>${c.month} ${c.year}</td>
        <td>${(Number(c.total) || 0).toLocaleString('en-US')}</td>
        <td>${c.paid ? 'پرداخت شده' : 'پرداخت نشده'}</td>
        <td>${c.paidDate || '—'}</td>
        <td>${c.payMethod || '—'}</td>
      </tr>
    `;
  });

  html += `
        </tbody>
      </table>

      <h3>هزینه‌ها (${allExpenses.length} مورد)</h3>
      <table>
        <thead>
          <tr>
            <th>تاریخ</th><th>عنوان</th><th>دسته</th><th>مبلغ</th>
          </tr>
        </thead>
        <tbody>
  `;

  allExpenses.forEach(e => {
    html += `
      <tr>
        <td>${e.date || '—'}</td>
        <td>${e.title || '—'}</td>
        <td>${e.category || '—'}</td>
        <td>${(Number(e.amount) || 0).toLocaleString('en-US')}</td>
      </tr>
    `;
  });

  html += `
        </tbody>
      </table>

      <h3>درآمدهای جانبی (${allSideIncomes.length} مورد)</h3>
      <table>
        <thead>
          <tr><th>تاریخ</th><th>عنوان</th><th>دسته</th><th>مبلغ</th></tr>
        </thead>
        <tbody>
  `;
  allSideIncomes.forEach(i => {
    html += `
      <tr>
        <td>${escapeHtml(i.date || (i.month + ' ' + i.year))}</td>
        <td>${escapeHtml(i.title || '—')}</td>
        <td>${escapeHtml(i.category || '—')}</td>
        <td>${(Number(i.amount) || 0).toLocaleString('en-US')}</td>
      </tr>
    `;
  });

  html += `
        </tbody>
      </table>
    </body>
    </html>
  `;

  const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `گزارش-${range.label.replace(/\s/g, '-')}.xls`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function printReportPdf() {
  const range = getReportDateRange();
  const d = getReportDataset(range);
  const { allCharges, allExpenses, paidCharges, unpaidCharges, chargesIncome, sideIncomesSum, expensesSum, balance, fund } = d;

  const buildingData = loadData();
  const buildingName = buildingData?.building?.name || 'ساختمان';

  const today = new Date().toLocaleDateString('fa-IR');
  const debtors = UNITS.filter(u => Number(u.debt) > 0).sort((a, b) => b.debt - a.debt);

  let debtorsRows = '';
  if (debtors.length === 0) {
    debtorsRows = '<tr><td colspan="4" style="text-align:center; color:#22c55e;">همه واحدها تسویه هستند ✅</td></tr>';
  } else {
    debtors.forEach(u => {
      debtorsRows += `
        <tr>
          <td>${u.block}-${toPersianNum(u.number)}</td>
          <td>${u.owner?.name || '—'}</td>
          <td>${u.owner?.phone || '—'}</td>
          <td style="color:#b91c1c; font-weight:700;">${formatToman(u.debt)}</td>
        </tr>
      `;
    });
  }

  const html = `
    <!DOCTYPE html>
    <html lang="fa" dir="rtl">
    <head>
      <meta charset="UTF-8">
      <title>گزارش مالی</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Tahoma, Arial; direction: rtl; padding: 80px 30px 30px 30px; color: #1e293b; }
        .pdf-toolbar {
          position: fixed; top: 0; left: 0; right: 0;
          background: #ffffff; border-bottom: 1px solid #e2e8f0;
          padding: 12px 20px; display: flex; justify-content: center; gap: 10px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.06); z-index: 1000;
        }
        .pdf-toolbar button {
          padding: 10px 22px; border: none; border-radius: 10px;
          font-family: Tahoma, Arial; font-size: 14px; font-weight: bold; cursor: pointer;
        }
        .btn-print { background: #5b4cdb; color: #fff; }
        .btn-save { background: #22c55e; color: #fff; }
        .btn-close { background: #f1f5f9; color: #64748b; }
        h1 { color: #5b4cdb; font-size: 22px; margin-bottom: 5px; }
        .info { font-size: 12px; color: #64748b; margin-bottom: 24px; }
        h3 { color: #5b4cdb; margin-top: 24px; margin-bottom: 10px; font-size: 15px; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 16px; }
        th { background: #5b4cdb; color: white; padding: 9px 6px; text-align: right; border: 1px solid #4338ca; }
        td { padding: 8px 6px; border: 1px solid #e2e8f0; text-align: right; }
        tr:nth-child(even) { background: #f8fafc; }
        .stats { display: flex; gap: 12px; margin-bottom: 20px; }
        .stat-box { flex: 1; padding: 14px; border-radius: 10px; text-align: center; border: 1px solid #e2e8f0; }
        .stat-box span { display: block; font-size: 11px; color: #64748b; margin-bottom: 4px; }
        .stat-box strong { font-size: 15px; color: #1e293b; }
        .footer { margin-top: 30px; padding-top: 15px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 11px; color: #94a3b8; }
        @media print { .pdf-toolbar { display: none !important; } body { padding: 20px 15px; } }
      </style>
    </head>
    <body>
      <div class="pdf-toolbar">
        <button class="btn-print" onclick="window.print()">🖨️ چاپ</button>
        <button class="btn-save" onclick="window.print()">📥 ذخیره PDF</button>
        <button class="btn-close" onclick="window.close()">❌ بستن</button>
      </div>

      <h1>🏢 ${buildingName}</h1>
      <div class="info">گزارش مالی — ${range.label} | تاریخ چاپ: ${today}</div>

      <div class="stats">
        <div class="stat-box">
          <span>کل درآمد (شارژ + جانبی)</span>
          <strong>${formatToman(chargesIncome + sideIncomesSum)}</strong>
        </div>
        <div class="stat-box">
          <span>کل هزینه‌ها</span>
          <strong>${formatToman(expensesSum)}</strong>
        </div>
        <div class="stat-box">
          <span>تراز دوره</span>
          <strong>${balance < 0 ? '−' : ''}${formatToman(Math.abs(balance))}</strong>
        </div>
        <div class="stat-box">
          <span>موجودی صندوق</span>
          <strong>${fund < 0 ? '−' : ''}${formatToman(Math.abs(fund))}</strong>
        </div>
      </div>

      <h3>💰 خلاصه شارژ</h3>
      <table>
        <tr><td>تعداد کل شارژها</td><td>${formatNumber(allCharges.length)}</td></tr>
        <tr><td>پرداخت شده</td><td>${formatNumber(paidCharges.length)}</td></tr>
        <tr><td>پرداخت نشده</td><td>${formatNumber(unpaidCharges.length)}</td></tr>
        <tr><td>شارژ وصول‌شده در این دوره</td><td>${formatToman(chargesIncome)}</td></tr>
        <tr><td>درآمد جانبی</td><td>${formatToman(sideIncomesSum)}</td></tr>
      </table>

      <h3>🧾 خلاصه هزینه‌ها</h3>
      <table>
        <tr><td>تعداد هزینه‌ها</td><td>${formatNumber(allExpenses.length)}</td></tr>
        <tr><td>مجموع هزینه‌ها</td><td>${formatToman(expensesSum)}</td></tr>
      </table>

      <h3>⚠️ واحدهای بدهکار (${formatNumber(debtors.length)} مورد)</h3>
      <table>
        <thead>
          <tr><th>واحد</th><th>مالک</th><th>موبایل</th><th>بدهی</th></tr>
        </thead>
        <tbody>${debtorsRows}</tbody>
      </table>

      <div class="footer">
        © ${new Date().getFullYear()} — آپارتمان پلاس | نرم‌افزار هوشمند مدیریت ساختمان
      </div>
    </body>
    </html>
  `;

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    toastWarning('لطفاً اجازه باز شدن پنجره چاپ را بدهید.');
    return;
  }

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}

function bindReportsPage() {
  const periodSelect = document.getElementById('reportPeriod');
  if (periodSelect) {
    periodSelect.addEventListener('change', (e) => {
      reportPeriod = e.target.value;

      const specificBox = document.getElementById('reportSpecificMonthBox');
      const customBox = document.getElementById('reportCustomBox');

      if (specificBox) {
        specificBox.style.display = reportPeriod === 'specificMonth' ? 'flex' : 'none';
      }
      if (customBox) {
        customBox.style.display = reportPeriod === 'custom' ? 'flex' : 'none';
      }

      renderReportsPage();
    });
  }

  const monthSelect = document.getElementById('reportMonthSelect');
  if (monthSelect) monthSelect.addEventListener('change', renderReportsPage);

  const monthYearSelect = document.getElementById('reportMonthYearSelect');
  if (monthYearSelect) monthYearSelect.addEventListener('change', renderReportsPage);

  const fromDateInput = document.getElementById('reportFromDate');
  if (fromDateInput) fromDateInput.addEventListener('change', renderReportsPage);

  const toDateInput = document.getElementById('reportToDate');
  if (toDateInput) toDateInput.addEventListener('change', renderReportsPage);

  const btnExcel = document.getElementById('btnReportExcel');
  if (btnExcel) btnExcel.onclick = exportReportToExcel;

  const btnPdf = document.getElementById('btnReportPdf');
  if (btnPdf) btnPdf.onclick = printReportPdf;
}

/* ============================================================
   صفحه تنظیمات
   ============================================================ */
function getSettingsKey() {
  return getAccountStorageKey('ham_sakhteman_settings');
}

function loadSettings() {
  const raw = localStorage.getItem(getSettingsKey());
  if (raw) { try { return JSON.parse(raw); } catch (e) { return {}; } }
  return {};
}

function saveSettings(settings) {
  localStorage.setItem(getSettingsKey(), JSON.stringify(settings));
}

function renderSettingsPage() {
  showSettingsMain();
}

function showSettingsMain() {
  const el = document.getElementById('settingsMain');
  if (el) el.style.display = 'block';

  ['settingsBuilding', 'settingsManager', 'settingsPayment', 'settingsFinancial',
   'settingsAppearance', 'settingsData', 'settingsAbout'].forEach(id => {
    const e = document.getElementById(id);
    if (e) e.style.display = 'none';
  });
}

function showSettingsSubpage(pageKey) {
  const main = document.getElementById('settingsMain');
  if (main) main.style.display = 'none';

  const map = {
    building: 'settingsBuilding',
    manager: 'settingsManager',
    payment: 'settingsPayment',
    financial: 'settingsFinancial',
    appearance: 'settingsAppearance',
    data: 'settingsData',
    about: 'settingsAbout',
  };

  Object.values(map).forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });

  const target = document.getElementById(map[pageKey]);
  if (target) target.style.display = 'block';

  if (pageKey === 'building') fillBuildingForm();
  if (pageKey === 'manager') fillManagerForm();
  if (pageKey === 'payment') fillPaymentForm();
  if (pageKey === 'financial') fillFinancialForm();
  if (pageKey === 'appearance') fillAppearanceForm();
  if (pageKey === 'about') fillAboutForm();
}

function fillBuildingForm() {
  const data = loadData();
  if (!data?.building) return;

  document.getElementById('setBuildingName').value = data.building.name || '';
  document.getElementById('setBuildingCode').value = data.building.code || '';
  document.getElementById('setBuildingType').value = data.building.type || 'complex';
}

function saveBuildingSettings() {
  const data = loadData();
  if (!data?.building) return;

  const name = document.getElementById('setBuildingName').value.trim();
  const type = document.getElementById('setBuildingType').value;

  if (!name) {
    toastWarning('لطفاً نام ساختمان را وارد کنید.');
    return;
  }

  data.building.name = name;
  data.building.type = type;

  saveData(data);
  renderBuildingCard();
  toastSuccess('اطلاعات ساختمان ذخیره شد.');
}

function fillManagerForm() {
  const data = loadData();

  document.getElementById('setManagerName').value = data?.manager?.name || '';
  document.getElementById('setManagerPhone').value = data?.manager?.phone || '';
}

function saveManagerSettings() {
  const data = loadData() || { building: {}, manager: {} };

  const name = document.getElementById('setManagerName').value.trim();
  const phone = document.getElementById('setManagerPhone').value.trim();

  if (!name) {
    toastWarning('لطفاً نام مدیر را وارد کنید.');
    return;
  }

  data.manager = { name, phone };
  saveData(data);

  if (typeof refreshProfile === 'function') refreshProfile();

  toastSuccess('اطلاعات مدیر ذخیره شد.');
}

function fillPaymentForm() {
  const settings = loadSettings();

  document.getElementById('setManagerCard').value = settings.managerCard || '';
  document.getElementById('setManagerSheba').value = settings.managerSheba || '';
  const ownerEl = document.getElementById('setManagerCardOwner');
  if (ownerEl) ownerEl.value = settings.managerCardOwner || '';
}

function savePaymentSettings() {
  const settings = loadSettings();

  settings.managerCard = document.getElementById('setManagerCard').value.trim();
  settings.managerSheba = document.getElementById('setManagerSheba').value.trim();
  settings.managerCardOwner = (document.getElementById('setManagerCardOwner')?.value || '').trim();

  saveSettings(settings);
  toastSuccess('اطلاعات پرداخت ذخیره شد.');
}

function fillFinancialForm() {
  const settings = loadSettings();

  // برای کاربر جدید فیلدها خالی باشند
  document.getElementById('setMonthlyCharge').value =
    settings.monthlyCharge != null && settings.monthlyCharge !== '' ? settings.monthlyCharge : '';
  document.getElementById('setPaymentDeadline').value =
    settings.paymentDeadline != null && settings.paymentDeadline !== '' ? settings.paymentDeadline : '';
  const ob = document.getElementById('setOpeningBalance');
  if (ob) ob.value = settings.openingBalance != null && settings.openingBalance !== '' ? settings.openingBalance : '';
}

function saveFinancialSettings() {
  const settings = loadSettings();

  // ✅ خالی = خالی (قبلاً بی‌صدا ۵۰۰٬۰۰۰ و ۱۰ ذخیره می‌شد)
  const mc = parseInt(toEnDigits(document.getElementById('setMonthlyCharge').value), 10);
  const pd = parseInt(toEnDigits(document.getElementById('setPaymentDeadline').value), 10);
  const ob = parseInt(toEnDigits(document.getElementById('setOpeningBalance')?.value || ''), 10);
  settings.monthlyCharge = mc > 0 ? mc : null;
  settings.paymentDeadline = pd > 0 && pd <= 31 ? pd : null;
  settings.openingBalance = isNaN(ob) ? 0 : ob;

  saveSettings(settings);
  toastSuccess('تنظیمات مالی ذخیره شد.');
}

function fillAppearanceForm() {
  const settings = loadSettings();

  if (settings.darkMode) {
    document.body.classList.add('dark-mode');
  } else {
    document.body.classList.remove('dark-mode');
  }

  document.querySelectorAll('.color-option').forEach(btn => {
    btn.classList.toggle('selected', btn.dataset.color === settings.primaryColor);
  });
}

function setTheme(mode) {
  const settings = loadSettings();
  settings.darkMode = mode === 'dark';
  saveSettings(settings);

  if (mode === 'dark') {
    document.body.classList.add('dark-mode');
  } else {
    document.body.classList.remove('dark-mode');
  }
}

function setPrimaryColor(color) {
  const settings = loadSettings();
  settings.primaryColor = color;
  saveSettings(settings);

  document.documentElement.style.setProperty('--primary', color);

  document.querySelectorAll('.color-option').forEach(btn => {
    btn.classList.toggle('selected', btn.dataset.color === color);
  });
}

/** کلیدهای داده این حساب (scoped با شماره مدیر) */
function getAccountDataKeys() {
  const bases = {
    building: 'ham_sakhteman_v3',
    units: 'ham_sakhteman_units',
    charges: 'ham_sakhteman_charges',
    expenses: 'ham_sakhteman_expenses',
    notices: 'ham_sakhteman_notices',
    messages: 'ham_sakhteman_messages',
    votings: 'ham_sakhteman_votings',
    settings: 'ham_sakhteman_settings',
    sideIncomes: 'ham_sakhteman_side_incomes',
    notifications: 'ham_sakhteman_notifications',
    tickets: 'ham_sakhteman_tickets',
  };
  const out = {};
  Object.entries(bases).forEach(([name, base]) => { out[name] = getAccountStorageKey(base); });
  return out;
}

function downloadBackup() {
  // ✅ اصلاح: داده‌ها با کلید per-account ذخیره می‌شوند؛ نسخه قبلی کلیدهای بدون scope را
  // می‌خواند و فایل پشتیبان عملاً خالی بود.
  const keys = getAccountDataKeys();
  const data = loadData();
  const code = (data?.building?.code || '').toUpperCase();
  const backup = { version: 2, exportDate: new Date().toISOString(), buildingCode: code };
  Object.entries(keys).forEach(([name, key]) => { backup[name] = localStorage.getItem(key); });
  backup.plan = localStorage.getItem('ham_sakhteman_plan');
  // ثبت‌نام ساکنین همین ساختمان
  try {
    const regs = JSON.parse(localStorage.getItem('ham_sakhteman_registered_residents') || '[]');
    backup.registeredResidents = JSON.stringify(regs.filter(r => !code || String(r.buildingCode || '').toUpperCase() === code));
  } catch (e) { backup.registeredResidents = '[]'; }

  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `backup-${toEnDigits(getTodayPersianDate()).replace(/\//g, '-')}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  toastSuccess('پشتیبان دانلود شد.');
}

function uploadBackup(file) {
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const backup = JSON.parse(e.target.result);
      const keys = getAccountDataKeys();
      const hasAny = Object.keys(keys).some(k => backup[k]);
      if (!hasAny) { toastError('فایل پشتیبان خالی یا نامعتبر است.'); return; }

      if (!(await appConfirm('⚠️ آیا مطمئن هستید؟ تمام داده‌های فعلی این حساب جایگزین می‌شوند.'))) return;

      // هم فرمت جدید و هم فرمت قدیمی (همان نام‌ها) پشتیبانی می‌شود
      Object.entries(keys).forEach(([name, key]) => {
        if (backup[name]) localStorage.setItem(key, backup[name]);
      });
      if (backup.plan) localStorage.setItem('ham_sakhteman_plan', backup.plan);
      if (backup.registeredResidents) {
        try {
          const incoming = JSON.parse(backup.registeredResidents) || [];
          const current = JSON.parse(localStorage.getItem('ham_sakhteman_registered_residents') || '[]');
          const sig = r => `${String(r.buildingCode).toUpperCase()}|${r.block}|${r.unitNumber}|${r.phone}`;
          const seen = new Set(current.map(sig));
          incoming.forEach(r => { if (!seen.has(sig(r))) current.push(r); });
          localStorage.setItem('ham_sakhteman_registered_residents', JSON.stringify(current));
        } catch (err) {}
      }

      toastSuccess('پشتیبان بازیابی شد. صفحه رفرش می‌شود.');
      setTimeout(() => location.reload(), 600);
    } catch (err) {
      toastError('فایل پشتیبان نامعتبر است.');
    }
  };
  reader.readAsText(file);
}

async function resetAllData() {
  if (!(await appConfirm('⚠️ هشدار: تمام داده‌های این ساختمان پاک می‌شوند!\n\nآیا مطمئن هستید؟'))) return;
  if (!(await appConfirm('⚠️ آیا واقعاً مطمئن هستید؟ این کار قابل بازگشت نیست.'))) return;

  // ✅ اصلاح: فقط داده‌های همین حساب پاک می‌شود (قبلاً localStorage.clear() همه حساب‌ها،
  // ثبت‌نام ساکنین و نشست ورود را هم پاک می‌کرد)
  const keys = getAccountDataKeys();
  Object.entries(keys).forEach(([name, key]) => {
    if (name === 'building') return; // اطلاعات ساختمان و کد آن حفظ می‌شود
    localStorage.removeItem(key);
  });
  location.reload();
}

function fillAboutForm() {
  const el = document.getElementById('aboutBuildDate');
  if (el) {
    el.textContent = new Date().toLocaleDateString('fa-IR');
  }
}

function bindSettingsPage() {
  document.querySelectorAll('[data-settings-page]').forEach(card => {
    card.addEventListener('click', () => {
      showSettingsSubpage(card.dataset.settingsPage);
    });
  });

  document.querySelectorAll('[data-back]').forEach(btn => {
    btn.addEventListener('click', showSettingsMain);
  });

  document.getElementById('setSaveBuilding')?.addEventListener('click', saveBuildingSettings);
  document.getElementById('setSaveManager')?.addEventListener('click', saveManagerSettings);
  document.getElementById('setSavePayment')?.addEventListener('click', savePaymentSettings);
  document.getElementById('setSaveFinancial')?.addEventListener('click', saveFinancialSettings);

  document.getElementById('setThemeLight')?.addEventListener('click', () => setTheme('light'));
  document.getElementById('setThemeDark')?.addEventListener('click', () => setTheme('dark'));

  document.querySelectorAll('.color-option').forEach(btn => {
    btn.addEventListener('click', () => setPrimaryColor(btn.dataset.color));
  });

  document.getElementById('setBackupDownload')?.addEventListener('click', downloadBackup);

  const backupFileInput = document.getElementById('setBackupFile');
  document.getElementById('setBackupUpload')?.addEventListener('click', () => {
    backupFileInput?.click();
  });

  backupFileInput?.addEventListener('change', (e) => {
    uploadBackup(e.target.files[0]);
  });

  document.getElementById('setResetData')?.addEventListener('click', resetAllData);
}


function init() {
  console.log('INIT RUN ✅');


  const urlParams = new URLSearchParams(window.location.search);
  const isSignup = urlParams.get('signup') === '1';

  // حالت ثبت‌نام را پیش از بارگذاری اطلاعات فعال کن.
  if (isSignup) {
    document.documentElement.classList.add('signup-mode');
    document.body.classList.add('signup-mode');
    UNITS = [];
  } else {
    if (typeof isLoggedIn === 'function' && !isLoggedIn()) {
      // بازدیدکننده تازه از مرورگر → صفحه معرفی؛ اپ نصب‌شده یا لینک مستقیم → ورود
      const standalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
      const fromPwa = urlParams.get('source') === 'pwa';
      window.location.replace(standalone || fromPwa ? 'login.html' : 'home.html');
      return;
    }

    loadUnits();
  }

  document.querySelectorAll('select').forEach(select => {
    const id = select.id;
    if (!id) return;

    if (id.toLowerCase().includes('month') && !id.toLowerCase().includes('year')) {
      const currentValue = select.value;

      if (id.includes('charge') || id.includes('issue') || id.includes('expenseModal')) {
        return;
      }

      if (select.querySelectorAll('option').length > 1) {
        return;
      }

      select.innerHTML = '';

      if (id.includes('Filter')) {
        const allOpt = document.createElement('option');
        allOpt.value = 'all';
        allOpt.textContent = '📅 همه ماه‌ها';
        if (currentValue === 'all') allOpt.selected = true;
        select.appendChild(allOpt);
      }

      PERSIAN_MONTHS.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m;
        opt.textContent = m;
        if (m === getTodayPersianMonth()) opt.selected = true;
        select.appendChild(opt);
      });
    }
  });

  const data = isSignup ? null : loadData();

  if (isSignup || !data || !data.building) {
    openWelcomeModal();
  } else {
    renderBuildingCard();
    buildBlockFilterOptions(data.building);
    updateAddUnitButtonState();

    // دیگر واحد خالی از قبل ساخته نمی‌شود.
    // کاربر خودش از طریق «افزودن واحد» تا سقف تعداد ثبت‌شده اضافه می‌کند.
  }

  document.getElementById('menu')?.addEventListener('click', (e) => {
    const mainItem = e.target.closest('.nav-item-main');
    if (mainItem) {
      const parent = mainItem.closest('.has-submenu');
      if (parent) parent.classList.toggle('open');
      return;
    }

    const li = e.target.closest('li[data-page]');
    if (!li) return;

    const page = li.dataset.page;
    if (!page) return;

    const isInSubmenu = li.closest('.submenu');
    if (isInSubmenu) {
      const parent = li.closest('.has-submenu');
      if (parent) parent.classList.add('open');
    }

    switchPage(page);
  });

  bindBlockFilter();
  bindWelcomeModal();
  bindUnitsPage();
  bindUnitModal();
  bindUnitDetailModal();
  bindChargesPage();
  bindIssueChargeModal();
  bindPayChargeModal();
  bindPaymentsPage();
  bindNewPaymentModal();
  bindExpensesPage();
  bindNoticesPage();
  bindMessagesPage();
  bindVotingPage();
  bindReportsPage();
  bindProfitPage();
  bindSideIncomesPage();
  bindSettingsPage();
  bindSupportPage();
  bindProfilePage();
  bindUpgradeModal();
  initNotificationsAndProfile();

  updateSidebarLockStates();

  let t;
  window.addEventListener('resize', () => {
    clearTimeout(t);
    t = setTimeout(() => {
      const ap = document.querySelector('.page.active');
      if (ap && ap.id === 'page-dashboard') renderDashboard();
    }, 200);
  });

  switchPage('dashboard');
}


function getExpectedUnitsCount(building) {
  if (!building) return 0;
  if (building.type === 'complex') {
    return building.blocks.reduce((sum, b) => sum + (parseInt(b.units) || 0), 0);
  }
  return parseInt(building.totalUnits) || 0;
}

/** حداکثر شماره/تعداد واحد مجاز برای یک بلوک خاص (بر اساس ثبت‌نام) */
function getMaxUnitsForBlock(blockName) {
  const data = loadData();
  const building = data?.building;
  if (!building) return 0;

  if (building.type === 'complex') {
    const block = (building.blocks || []).find(b => String(b.name).trim() === String(blockName).trim());
    return block ? (parseInt(block.units) || 0) : 0;
  }

  // تک‌بلوک / ساختمان: سقف کل واحدها
  return parseInt(building.totalUnits) || 0;
}

/* ============================================================
   🔔 سیستم اعلان‌ها
   ============================================================ */
function getNotifKey() {
  return getAccountStorageKey('ham_sakhteman_notifications');
}
const NOTIF_KEY_LEGACY = 'ham_sakhteman_notifications';
let notifications = [];

function loadNotifications() {
  const raw = localStorage.getItem(getNotifKey());
  if (raw) { try { notifications = JSON.parse(raw); } catch (e) { notifications = []; } }
  else { notifications = []; }
}

function saveNotifications() {
  localStorage.setItem(getNotifKey(), JSON.stringify(notifications));
}

function generateAutoNotifications() {
  const auto = [];
  const now = new Date().toISOString();

  const debtors = UNITS.filter(u => Number(u.debt) > 0);
  if (debtors.length > 0) {
    auto.push({
      id: 'auto-debt',
      type: 'danger',
      icon: '⚠️',
      iconClass: 'notif-icon-red',
      title: `${formatNumber(debtors.length)} واحد بدهکار`,
      desc: `مجموع بدهی: ${formatToman(debtors.reduce((s, u) => s + Number(u.debt), 0))}`,
      time: 'اکنون',
      read: false,
      createdAt: now,
      page: 'units',
    });
  }

  const charges = loadCharges();
  const unpaidThisMonth = charges.filter(c =>
    c.month === getTodayPersianMonth() && c.year === String(getTodayPersianYear()) && !c.paid
  );
  if (unpaidThisMonth.length > 0) {
    auto.push({
      id: 'auto-unpaid',
      type: 'warning',
      icon: '💳',
      iconClass: 'notif-icon-orange',
      title: `${formatNumber(unpaidThisMonth.length)} شارژ پرداخت‌نشده`,
      desc: `شارژ ${getTodayPersianMonth()} — در انتظار پرداخت`,
      time: 'اکنون',
      read: false,
      createdAt: now,
      page: 'charges',
    });
  }

  const votings = loadVotings();
  const activeVotings = votings.filter(v => getVotingStatus(v) === 'active');
  if (activeVotings.length > 0) {
    auto.push({
      id: 'auto-voting',
      type: 'info',
      icon: '🗳️',
      iconClass: 'notif-icon-purple',
      title: `${formatNumber(activeVotings.length)} رأی‌گیری فعال`,
      desc: activeVotings.map(v => v.title).join('، ').substring(0, 60),
      time: 'اکنون',
      read: false,
      createdAt: now,
      page: 'voting',
    });
  }

  const messages = loadMessages();
  const unreadMsgs = messages.filter(m => !m.read && m.direction === 'received');
  if (unreadMsgs.length > 0) {
    auto.push({
      id: 'auto-messages',
      type: 'info',
      icon: '✉️',
      iconClass: 'notif-icon-blue',
      title: `${formatNumber(unreadMsgs.length)} پیام خوانده‌نشده`,
      desc: 'پیام‌های جدید از ساکنین',
      time: 'اکنون',
      read: false,
      createdAt: now,
      page: 'messages',
    });
  }

  const notices = loadNotices();
  const today = new Date().toLocaleDateString('fa-IR');
  const todayNotices = notices.filter(n => n.date === today);
  if (todayNotices.length > 0) {
    auto.push({
      id: 'auto-notices',
      type: 'info',
      icon: '📢',
      iconClass: 'notif-icon-green',
      title: `${formatNumber(todayNotices.length)} اطلاعیه امروز`,
      desc: todayNotices.map(n => n.title).join('، ').substring(0, 60),
      time: 'امروز',
      read: false,
      createdAt: now,
      page: 'notices',
    });
  }

  const expenses = loadExpenses();
  const todayExpenses = expenses.filter(e => e.date === today);
  if (todayExpenses.length > 0) {
    auto.push({
      id: 'auto-expenses',
      type: 'info',
      icon: '🧾',
      iconClass: 'notif-icon-orange',
      title: `${formatNumber(todayExpenses.length)} هزینه امروز`,
      desc: `مجموع: ${formatToman(todayExpenses.reduce((s, e) => s + Number(e.amount || 0), 0))}`,
      time: 'امروز',
      read: false,
      createdAt: now,
      page: 'expenses',
    });
  }

  const manualNotifs = notifications.filter(n => n.manual === true);
  notifications = [...auto, ...manualNotifs];

  saveNotifications();
}

function renderNotifications() {
  const list = document.getElementById('notifList');
  const dot = document.getElementById('notifDot');
  const countLabel = document.getElementById('notifCountLabel');

  if (!list) return;

  const unreadCount = notifications.filter(n => !n.read).length;

  if (dot) {
    dot.style.display = unreadCount > 0 ? 'block' : 'none';
  }

  if (countLabel) {
    countLabel.textContent = `${formatNumber(notifications.length)} اعلان`;
  }

  if (notifications.length === 0) {
    list.innerHTML = `
      <div class="notif-empty">
        <div class="notif-empty-icon">🔕</div>
        <div>اعلان جدیدی وجود ندارد</div>
      </div>
    `;
    return;
  }

  list.innerHTML = notifications.map(n => `
    <div class="notif-item ${n.read ? '' : 'unread'}" data-notif-id="${n.id}" data-notif-page="${n.page || ''}">
      <div class="notif-item-icon ${n.iconClass || 'notif-icon-purple'}">
        ${n.icon || '🔔'}
      </div>
      <div class="notif-body">
        <div class="notif-title">
          <span class="notif-title-text">${n.title}</span>
          ${!n.read ? '<span class="notif-badge">جدید</span>' : ''}
        </div>
        <div class="notif-desc">${n.desc || ''}</div>
        <div class="notif-time">${n.time || ''}</div>
      </div>
    </div>
  `).join('');

  list.querySelectorAll('.notif-item').forEach(item => {
    item.addEventListener('click', () => {
      const id = item.dataset.notifId;
      const page = item.dataset.notifPage;

      const notif = notifications.find(n => n.id === id);
      if (notif) {
        notif.read = true;
        saveNotifications();
        renderNotifications();
      }

      if (page) {
        switchPage(page);
        closeNotifPanel();
      }
    });
  });
}

function openNotifPanel() {
  document.getElementById('notifPanel')?.classList.add('open');
}

function closeNotifPanel() {
  document.getElementById('notifPanel')?.classList.remove('open');
}

async function clearAllNotifications() {
  if (notifications.length === 0) return;
  if (!(await appConfirm('⚠️ همه اعلان‌ها پاک شوند؟'))) return;

  notifications = [];
  saveNotifications();
  renderNotifications();
}

function bindNotifications() {
  const btn = document.getElementById('notifBtn');
  const panel = document.getElementById('notifPanel');
  const clearBtn = document.getElementById('notifClearBtn');

  if (btn) {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = panel.classList.contains('open');
      closeProfileMenu();
      if (isOpen) closeNotifPanel();
      else openNotifPanel();
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      clearAllNotifications();
    });
  }

  document.addEventListener('click', (e) => {
    if (panel && !panel.contains(e.target) && !btn?.contains(e.target)) {
      closeNotifPanel();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeNotifPanel();
      closeProfileMenu();
    }
  });
}

/* ============================================================
   👤 پروفایل مدیر
   ============================================================ */
function renderProfile() {
  const data = loadData();
  const managerName = data?.manager?.name || 'مدیر ساختمان';
  const managerPhone = data?.manager?.phone || '—';

  const firstName = managerName.split(' ')[0] || 'مدیر';
  const initial = firstName.charAt(0) || 'م';

  const elAvatar = document.getElementById('profileAvatar');
  const elName = document.getElementById('profileName');
  const elRole = document.getElementById('profileRole');

  if (elAvatar) elAvatar.textContent = initial;
  if (elName) elName.textContent = managerName;
  if (elRole) elRole.textContent = 'مدیر';

  const elAvatarLg = document.getElementById('profileAvatarLg');
  const elMenuName = document.getElementById('profileMenuName');
  const elMenuPhone = document.getElementById('profileMenuPhone');

  if (elAvatarLg) elAvatarLg.textContent = initial;
  if (elMenuName) elMenuName.textContent = managerName;
  if (elMenuPhone) elMenuPhone.textContent = managerPhone;

  const settings = loadSettings();
  const themeIcon = document.getElementById('themeIcon');
  const themeLabel = document.getElementById('themeLabel');

  if (settings.darkMode) {
    if (themeIcon) themeIcon.textContent = '☀️';
    if (themeLabel) themeLabel.textContent = 'حالت روز';
  } else {
    if (themeIcon) themeIcon.textContent = '🌙';
    if (themeLabel) themeLabel.textContent = 'حالت شب';
  }
}

function openProfileMenu() {
  document.querySelector('.profile-wrapper')?.classList.add('open');
  document.getElementById('profileMenu')?.classList.add('open');
}

function closeProfileMenu() {
  document.querySelector('.profile-wrapper')?.classList.remove('open');
  document.getElementById('profileMenu')?.classList.remove('open');
}

function bindProfile() {
  const btn = document.getElementById('profileBtn');
  const menu = document.getElementById('profileMenu');

  if (btn) {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = menu.classList.contains('open');
      closeNotifPanel();
      if (isOpen) closeProfileMenu();
      else openProfileMenu();
    });
  }

  document.querySelectorAll('[data-profile-action]').forEach(item => {
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      const action = item.dataset.profileAction;

      if (action === 'profile') {
        showProfilePage();
      } else if (action === 'settings') {
        switchPage('settings');
        closeProfileMenu();
      } else if (action === 'backup') {
        switchPage('settings');
        setTimeout(() => showSettingsSubpage('data'), 150);
        closeProfileMenu();
      } else if (action === 'theme') {
        const settings = loadSettings();
        const newMode = settings.darkMode ? 'light' : 'dark';
        setTheme(newMode);
        renderProfile();
        closeProfileMenu();
      } else if (action === 'logout') {
        handleLogout();
      }
    });
  });

  document.addEventListener('click', (e) => {
    if (menu && !menu.contains(e.target) && !btn?.contains(e.target)) {
      closeProfileMenu();
    }
  });
}

async function handleLogout() {
  if (!(await appConfirm('⚠️ آیا از خروج از پنل مطمئن هستید؟\n\nداده‌ها پاک نمی‌شوند.'))) {
    return;
  }

  localStorage.setItem('ham_sakhteman_logged_out', 'true');

  toastSuccess('از پنل خارج شدید. در حال انتقال...');

  setTimeout(() => {
    window.location.href = 'login.html';
  }, 800);
}

/* ============================================================
   💎 بایند مودال ارتقا
   ============================================================ */
function bindUpgradeModal() {
  const btnUpgrade = document.getElementById('btnUpgradePlan');
  if (btnUpgrade) {
    btnUpgrade.addEventListener('click', () => showUpgradeModal());
  }

  const btnCancel = document.getElementById('upgradeCancelBtn');
  if (btnCancel) {
    btnCancel.addEventListener('click', closeUpgradeModal);
  }

  const btnConfirm = document.getElementById('upgradeConfirmBtn');
  if (btnConfirm) {
    btnConfirm.addEventListener('click', handleUpgrade);
  }

  const modal = document.getElementById('upgradeModal');
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeUpgradeModal();
    });
  }
}

function closeUpgradeModal() {
  const modal = document.getElementById('upgradeModal');
  if (modal) modal.classList.remove('open');
}

function initNotificationsAndProfile() {
  loadNotifications();
  generateAutoNotifications();
  renderNotifications();
  renderProfile();

  bindNotifications();
  bindProfile();

  setInterval(() => {
    generateAutoNotifications();
    renderNotifications();
  }, 120000);
}

function refreshNotifications() {
  generateAutoNotifications();
  renderNotifications();
}

function refreshProfile() {
  renderProfile();
}

/* ============================================================
   👤 صفحه پروفایل من
   ============================================================ */
const PROFILE_KEY = 'ham_sakhteman_profile';
const PASSWORD_KEY = 'ham_sakhteman_password';

function loadProfile() {
  const raw = localStorage.getItem(PROFILE_KEY);
  if (raw) { try { return JSON.parse(raw); } catch (e) { return {}; } }
  return {};
}

function saveProfile(profile) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

function loadPasswordHash() {
  return localStorage.getItem(PASSWORD_KEY) || null;
}

function savePasswordHash(hash) {
  localStorage.setItem(PASSWORD_KEY, hash);
}

function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return 'h_' + Math.abs(hash).toString(36);
}

function bindProfileTabs() {
  document.querySelectorAll('.profile-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.profileTab;

      document.querySelectorAll('.profile-tab').forEach(t => {
        t.classList.toggle('active', t.dataset.profileTab === target);
      });

      document.querySelectorAll('.profile-tab-content').forEach(c => {
        c.classList.toggle('active', c.dataset.profileTabContent === target);
      });

      if (target === 'stats') {
        renderProfileStats();
        renderProfileActivity();
      }
    });
  });
}

function fillProfileForm() {
  const profile = loadProfile();
  const data = loadData();

  const managerName = data?.manager?.name || 'مدیر ساختمان';
  const managerPhone = data?.manager?.phone || '';

  const elFullName = document.getElementById('profileFullName');
  const elPhone = document.getElementById('profilePhone');
  const elEmail = document.getElementById('profileEmail');
  const elNationalId = document.getElementById('profileNationalId');
  const elAddress = document.getElementById('profileAddress');
  const elBio = document.getElementById('profileBio');

  if (elFullName) elFullName.value = profile.fullName || managerName;
  if (elPhone) elPhone.value = profile.phone || managerPhone;
  if (elEmail) elEmail.value = profile.email || '';
  if (elNationalId) elNationalId.value = profile.nationalId || '';
  if (elAddress) elAddress.value = profile.address || '';
  if (elBio) elBio.value = profile.bio || '';

  const firstName = (profile.fullName || managerName).split(' ')[0] || 'مدیر';
  const initial = firstName.charAt(0) || 'م';

  const heroAvatar = document.getElementById('heroAvatar');
  const heroName = document.getElementById('heroName');
  const heroPhone = document.getElementById('heroPhone');

  if (heroAvatar) {
    if (profile.avatar) {
      heroAvatar.style.backgroundImage = `url(${profile.avatar})`;
      heroAvatar.textContent = '';
    } else {
      heroAvatar.style.backgroundImage = '';
      heroAvatar.textContent = initial;
    }
  }

  if (heroName) heroName.textContent = profile.fullName || managerName;
  if (heroPhone) heroPhone.textContent = profile.phone || managerPhone || '—';

  fillProfileBuildingInfo(data);

  const hasPassword = loadPasswordHash() !== null;
  const passwordHint = document.getElementById('passwordHint');
  if (passwordHint && !hasPassword) {
    passwordHint.innerHTML = '💡 هنوز رمز عبوری تنظیم نکردی. با اولین تغییر رمز، رمز فعال می‌شه.';
  }
}

function fillProfileBuildingInfo(data) {
  const elName = document.getElementById('profileBuildingName');
  const elCode = document.getElementById('profileBuildingCode');
  const elType = document.getElementById('profileBuildingType');
  const elBlocks = document.getElementById('profileBuildingBlocks');
  const elUnits = document.getElementById('profileBuildingUnits');
  const elCreated = document.getElementById('profileBuildingCreated');

  if (!data?.building) {
    if (elName) elName.textContent = '—';
    return;
  }

  const b = data.building;

  if (elName) elName.textContent = b.name || '—';
  if (elCode) elCode.textContent = b.code || '—';
  if (elType) {
    elType.textContent = b.type === 'complex' ? '🏢 مجتمع' : '🏬 تک‌بلوک';
  }
  if (elBlocks) {
    elBlocks.textContent = b.type === 'complex' ? formatNumber(b.blocks?.length || 0) : '۱';
  }
  if (elUnits) elUnits.textContent = formatNumber(Number(b.totalUnits) || (typeof getExpectedUnitsCount === 'function' && getExpectedUnitsCount(b)) || UNITS.length);
  if (elCreated) {
    elCreated.textContent = b.createdAt
      ? new Date(b.createdAt).toLocaleDateString('fa-IR')
      : '—';
  }
}

function saveProfileInfo() {
  const fullName = document.getElementById('profileFullName')?.value.trim();
  const phone = document.getElementById('profilePhone')?.value.trim();
  const email = document.getElementById('profileEmail')?.value.trim();
  const nationalId = document.getElementById('profileNationalId')?.value.trim();
  const address = document.getElementById('profileAddress')?.value.trim();
  const bio = document.getElementById('profileBio')?.value.trim();

  if (!fullName) { toastWarning('لطفاً نام و نام خانوادگی را وارد کنید.'); return; }
  if (!phone) { toastWarning('لطفاً شماره موبایل را وارد کنید.'); return; }
  if (!isValidIranMobile(phone)) { toastWarning('شماره موبایل باید ۱۱ رقم و با ۰۹ شروع شود.'); return; }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { toastWarning('فرمت ایمیل صحیح نیست.'); return; }
  if (nationalId && !/^\d{10}$/.test(nationalId)) { toastWarning('کد ملی باید ۱۰ رقم باشد.'); return; }

  const profile = loadProfile();
  profile.fullName = fullName;
  profile.phone = phone;
  profile.email = email;
  profile.nationalId = nationalId;
  profile.address = address;
  profile.bio = bio;
  profile.updatedAt = new Date().toISOString();

  saveProfile(profile);

  const data = loadData() || { building: {}, manager: {} };
  data.manager = { ...data.manager, name: fullName, phone: phone };
  saveData(data);

  if (typeof refreshProfile === 'function') refreshProfile();
  fillProfileForm();

  toastSuccess('اطلاعات با موفقیت ذخیره شد.');
}

function bindAvatarUpload() {
  const input = document.getElementById('avatarUpload');
  if (!input) return;

  input.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toastWarning('حجم عکس نباید بیشتر از ۲ مگابایت باشد.');
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const profile = loadProfile();
      profile.avatar = event.target.result;
      saveProfile(profile);

      fillProfileForm();
      if (typeof refreshProfile === 'function') refreshProfile();

      toastSuccess('عکس پروفایل تغییر کرد.');
    };
    reader.readAsDataURL(file);
  });
}

function checkPasswordStrength(password) {
  let strength = 0;
  if (password.length >= 6) strength++;
  if (password.length >= 10) strength++;
  if (/[a-zA-Z]/.test(password)) strength++;
  if (/\d/.test(password)) strength++;
  if (/[^a-zA-Z0-9]/.test(password)) strength++;

  if (strength <= 2) return 'weak';
  if (strength <= 4) return 'medium';
  return 'strong';
}

function bindPasswordStrength() {
  const input = document.getElementById('newPassword');
  const bar = document.querySelector('.password-strength-bar');
  if (!input || !bar) return;

  input.addEventListener('input', (e) => {
    const val = e.target.value;
    bar.className = 'password-strength-bar';

    if (val.length === 0) return;

    const strength = checkPasswordStrength(val);
    bar.classList.add(strength);
  });
}

function changePassword() {
  const currentPass = document.getElementById('currentPassword')?.value || '';
  const newPass = document.getElementById('newPassword')?.value || '';
  const confirmPass = document.getElementById('confirmPassword')?.value || '';

  const savedHash = localStorage.getItem('ham_sakhteman_user_password');

  if (savedHash) {
    if (!currentPass) {
      toastWarning('لطفاً رمز عبور فعلی را وارد کنید.');
      return;
    }

    if (typeof simpleHashAuth === 'function') {
      if (simpleHashAuth(currentPass) !== savedHash) {
        toastError('رمز عبور فعلی اشتباه است.');
        return;
      }
    }
  }

  if (!newPass) { toastWarning('لطفاً رمز عبور جدید را وارد کنید.'); return; }
  if (newPass.length < 6) { toastWarning('رمز عبور جدید باید حداقل ۶ کاراکتر باشد.'); return; }
  if (newPass !== confirmPass) { toastError('تکرار رمز عبور جدید مطابقت ندارد.'); return; }
  if (currentPass && currentPass === newPass) { toastWarning('رمز عبور جدید نباید با رمز فعلی یکسان باشد.'); return; }

  if (typeof simpleHashAuth === 'function') {
    // رمز روی سرور همگام‌سازی هم عوض شود تا ورود از دستگاه‌های دیگر کار کند
    if (window.AptSync && savedHash) {
      window.AptSync.changeManagerPassword(savedHash, simpleHashAuth(newPass))
        .catch(() => toastWarning('رمز روی سرور ابری عوض نشد؛ اینترنت را بررسی و دوباره تلاش کنید.'));
    }
    localStorage.setItem('ham_sakhteman_user_password', simpleHashAuth(newPass));
  } else {
    savePasswordHash(simpleHash(newPass));
  }

  document.getElementById('currentPassword').value = '';
  document.getElementById('newPassword').value = '';
  document.getElementById('confirmPassword').value = '';

  const bar = document.querySelector('.password-strength-bar');
  if (bar) bar.className = 'password-strength-bar';

  toastSuccess('رمز عبور با موفقیت تغییر کرد.');
}

function renderProfileStats() {
  const charges = loadCharges();
  const payments = charges.filter(c => c.paid);
  const expenses = loadExpenses();
  const notices = loadNotices();

  const elUnits = document.getElementById('statProfileUnits');
  const elCharges = document.getElementById('statProfileCharges');
  const elPayments = document.getElementById('statProfilePayments');
  const elExpenses = document.getElementById('statProfileExpenses');
  const elNotices = document.getElementById('statProfileNotices');

  if (elUnits) elUnits.textContent = formatNumber(UNITS.length);
  if (elCharges) elCharges.textContent = formatNumber(charges.length);
  if (elPayments) elPayments.textContent = formatNumber(payments.length);
  if (elExpenses) elExpenses.textContent = formatNumber(expenses.length);
  if (elNotices) elNotices.textContent = formatNumber(notices.length);
}

function renderProfileActivity() {
  const container = document.getElementById('profileActivityList');
  if (!container) return;

  const activities = [];

  const charges = loadCharges().sort((a, b) =>
    (b.issuedAt || '').localeCompare(a.issuedAt || '')
  ).slice(0, 3);

  charges.forEach(c => {
    activities.push({
      icon: '💰',
      iconClass: 'notif-icon-green',
      title: `صدور شارژ ${c.month}`,
      time: c.issuedAt ? new Date(c.issuedAt).toLocaleDateString('fa-IR') : '—',
      date: c.issuedAt || '',
    });
  });

  const payments = loadCharges().filter(c => c.paid && c.paidAt)
    .sort((a, b) => (b.paidAt || '').localeCompare(a.paidAt || ''))
    .slice(0, 3);

  payments.forEach(p => {
    activities.push({
      icon: '💳',
      iconClass: 'notif-icon-blue',
      title: `پرداخت ${formatToman(p.total)}`,
      time: p.paidDate || '—',
      date: p.paidAt || '',
    });
  });

  const expenses = loadExpenses().sort((a, b) =>
    (b.createdAt || '').localeCompare(a.createdAt || '')
  ).slice(0, 3);

  expenses.forEach(e => {
    activities.push({
      icon: '🧾',
      iconClass: 'notif-icon-orange',
      title: `هزینه: ${e.title}`,
      time: e.date || '—',
      date: e.createdAt || '',
    });
  });

  const notices = loadNotices().sort((a, b) =>
    (b.createdAt || '').localeCompare(a.createdAt || '')
  ).slice(0, 3);

  notices.forEach(n => {
    activities.push({
      icon: '📢',
      iconClass: 'notif-icon-purple',
      title: `اطلاعیه: ${n.title}`,
      time: n.date || '—',
      date: n.createdAt || '',
    });
  });

  activities.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const recent = activities.slice(0, 10);

  if (recent.length === 0) {
    container.innerHTML = `
      <div style="text-align:center; padding:30px; color:#94a3b8;">
        هنوز فعالیتی ثبت نشده است.
      </div>`;
    return;
  }

  container.innerHTML = recent.map(a => `
    <div class="activity-item">
      <div class="activity-icon ${a.iconClass}">${a.icon}</div>
      <div class="activity-body">
        <div class="activity-title">${a.title}</div>
        <div class="activity-time">${a.time}</div>
      </div>
    </div>
  `).join('');
}

async function deleteAccount() {
  if (!(await appConfirm('⚠️ هشدار: تمام اطلاعات برای همیشه پاک می‌شوند!'))) return;
  if (!(await appConfirm('⚠️ آیا واقعاً مطمئن هستید؟ این کار قابل بازگشت نیست.'))) return;

  const input = await appPrompt('برای تأیید نهایی، کلمه «حذف» را تایپ کنید:');
  if (input !== 'حذف') {
    toastError('عملیات لغو شد.');
    return;
  }

  localStorage.clear();
  toastSuccess('حساب کاربری حذف شد. صفحه رفرش می‌شود.');
  location.reload();
}

function bindProfilePage() {
  bindProfileTabs();
  bindAvatarUpload();
  bindPasswordStrength();

  document.getElementById('btnSaveProfile')?.addEventListener('click', saveProfileInfo);
  document.getElementById('btnChangePassword')?.addEventListener('click', changePassword);
  document.getElementById('btnDeleteAccount')?.addEventListener('click', deleteAccount);

  document.getElementById('btnLogoutFromProfile')?.addEventListener('click', () => {
    if (typeof handleLogout === 'function') handleLogout();
  });
}

function showProfilePage() {
  switchPage('profile');
  fillProfileForm();
  closeProfileMenu();
}

/* ============================================================
   📊 صفحه سود و زیان
   ============================================================ */
let profitYear = String(getTodayPersianYear());
let profitBlock = 'all';
let profitPeriod = 'year';

function calcMonthProfit(monthName, year) {
  const y = String(year);
  const charges = loadCharges();
  const expenses = loadExpenses();
  const sideIncomes = loadSideIncomes();

  // ===== شارژها (درآمد) — مبنای نقدی: ماهی که پول واقعاً وصول شده =====
  let monthCharges = charges.filter(c => isChargeCollectedIn(c, monthName, y));

  // ===== هزینه‌ها =====
  let monthExpenses = expenses.filter(e => e.month === monthName && String(e.year) === y);

  // ===== درآمد جانبی =====
  let monthSideIncomes = sideIncomes.filter(i => i.month === monthName && String(i.year) === y);

  // ===== فیلتر بلوک =====
  // ✅ اصلاح: هزینه/درآمد مشترک (همه بلوک‌ها) دیگر کامل به هر بلوک نسبت داده نمی‌شود؛
  // سهم هر بلوک به نسبت تعداد واحدهایش محاسبه می‌شود.
  if (profitBlock !== 'all') {
    const share = getBlockShare(profitBlock);
    const isBlock = (b) => String(b || '').trim() === String(profitBlock).trim();
    monthCharges = monthCharges.filter(c => isBlock(c.block));
    const allocate = (list) => list
      .filter(i => !i.block || i.block === 'all' || isBlock(i.block))
      .map(i => (!i.block || i.block === 'all')
        ? { ...i, amount: Math.round((Number(i.amount) || 0) * share), sharedAllocated: true }
        : i);
    monthExpenses = allocate(monthExpenses);
    monthSideIncomes = allocate(monthSideIncomes);
  }

  const chargesIncome = monthCharges.reduce((s, c) => s + (Number(c.total) || 0), 0);
  const sideIncomeSum = monthSideIncomes.reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const expense = monthExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);

  const income = chargesIncome + sideIncomeSum;
  const profit = income - expense;

  return {
    month: monthName,
    year: y,
    label: monthName,
    income,                 // کل درآمد (شارژ + جانبی)
    chargesIncome,          // فقط شارژ
    sideIncomeSum,          // فقط جانبی
    expense,
    profit,
    chargesCount: monthCharges.length,
    sideIncomesCount: monthSideIncomes.length,
    expensesCount: monthExpenses.length,
    charges: monthCharges,
    expenses: monthExpenses,
    sideIncomes: monthSideIncomes,
  };
}

function calcTotalProfit() {
  const allMonths = PERSIAN_MONTHS.map(m => calcMonthProfit(m, profitYear));

  const totalIncome = allMonths.reduce((s, m) => s + m.income, 0);
  const totalExpense = allMonths.reduce((s, m) => s + m.expense, 0);
  const netProfit = totalIncome - totalExpense;

  let units = UNITS;
  if (profitBlock !== 'all') {
    units = units.filter(u => String(u.block).trim() === String(profitBlock).trim());
  }
  const totalDebt = units.reduce((s, u) => s + (Number(u.debt) || 0), 0);

  return { months: allMonths, totalIncome, totalExpense, netProfit, totalDebt };
}

/**
 * ماه‌های دوره انتخابی به‌صورت {month, year}
 * ✅ اصلاح: «۳/۶ ماه اخیر» از مرز سال عبور می‌کند (قبلاً در فروردین فقط یک ماه نشان می‌داد)
 */
function getPeriodMonths() {
  if (profitPeriod === 'thisMonth') return getLastNPersianMonths(1);
  if (profitPeriod === '3months') return getLastNPersianMonths(3);
  if (profitPeriod === '6months') return getLastNPersianMonths(6);
  return PERSIAN_MONTHS.map(m => ({ month: m, year: String(profitYear), label: m }));
}

function getPeriodMonthsData() {
  const list = getPeriodMonths();
  const crossYear = new Set(list.map(p => p.year)).size > 1;
  return list.map(p => {
    const d = calcMonthProfit(p.month, p.year);
    if (crossYear) d.label = `${p.month} ${toPersianNum(String(p.year).slice(-2))}`;
    return d;
  });
}

function renderProfitStats() {
  const data = calcTotalProfit();

  const filteredMonths = getPeriodMonthsData();

  const totalIncome = filteredMonths.reduce((s, m) => s + m.income, 0);
  const totalExpense = filteredMonths.reduce((s, m) => s + m.expense, 0);
  const netProfit = totalIncome - totalExpense;
  const margin = totalIncome > 0 ? Math.round((netProfit / totalIncome) * 100) : 0;

  const elIncome = document.getElementById('profitTotalIncome');
  const elExpense = document.getElementById('profitTotalExpense');
  const elNet = document.getElementById('profitNet');
  const elMargin = document.getElementById('profitMargin');
  const elDebt = document.getElementById('profitDebt');

  if (elIncome) elIncome.textContent = formatToman(totalIncome);
  if (elExpense) elExpense.textContent = formatToman(totalExpense);
  if (elDebt) elDebt.textContent = formatToman(data.totalDebt);

  if (elNet) {
    elNet.textContent = formatToman(Math.abs(netProfit));
    elNet.className = 'stat-value ' + (
      netProfit > 0 ? 'profit-positive' :
      netProfit < 0 ? 'profit-negative' :
      'profit-neutral'
    );
    if (netProfit < 0) elNet.textContent = '−' + formatToman(Math.abs(netProfit));
    if (netProfit > 0) elNet.textContent = '+' + formatToman(netProfit);
  }

  if (elMargin) {
    elMargin.textContent = formatNumber(margin) + '٪';
    elMargin.className = 'stat-value ' + (
      margin > 0 ? 'profit-positive' :
      margin < 0 ? 'profit-negative' :
      'profit-neutral'
    );
  }

  renderProfitStatusBanner(netProfit, totalIncome, totalExpense);

  const badge = document.getElementById('profitChartBadge');
  if (badge) {
    badge.textContent = profitPeriod === 'year'
      ? `سال ${toPersianNum(profitYear)}`
      : profitPeriod === '6months'
        ? '۶ ماه اخیر'
        : profitPeriod === '3months'
          ? '۳ ماه اخیر'
          : 'این ماه';
  }
}

function renderProfitStatusBanner(netProfit, income, expense) {
  const banner = document.getElementById('profitStatusBanner');
  const icon = document.getElementById('profitStatusIcon');
  const title = document.getElementById('profitStatusTitle');
  const desc = document.getElementById('profitStatusDesc');

  if (!banner) return;

  banner.className = 'profit-status-banner';

  if (income === 0 && expense === 0) {
    banner.classList.add('neutral');
    if (icon) icon.textContent = '📊';
    if (title) title.textContent = 'اطلاعاتی برای این دوره ثبت نشده';
    if (desc) desc.textContent = 'برای شروع، از صفحه شارژ، شارژ صادر کنید و از صفحه هزینه‌ها، هزینه‌ها را ثبت کنید.';
  } else if (netProfit > 0) {
    banner.classList.add('profit');
    if (icon) icon.textContent = '✅';
    if (title) title.textContent = 'وضعیت مالی مطلوب';
    if (desc) {
      const percent = income > 0 ? Math.round((netProfit / income) * 100) : 0;
      desc.textContent = `مانده صندوق ${formatToman(netProfit)} (${formatNumber(percent)}٪ از درآمد). عملکرد مالی ساختمان مثبت است.`;
    }
  } else if (netProfit < 0) {
    banner.classList.add('loss');
    if (icon) icon.textContent = '⚠️';
    if (title) title.textContent = 'کمبود بودجه';
    if (desc) {
      desc.textContent = `هزینه‌ها ${formatToman(Math.abs(netProfit))} بیشتر از درآمد بوده. نیاز به بررسی و افزایش شارژ یا کاهش هزینه‌ها دارید.`;
    }
  } else {
    banner.classList.add('neutral');
    if (icon) icon.textContent = '⚖️';
    if (title) title.textContent = 'تعادل مالی';
    if (desc) desc.textContent = 'درآمد و هزینه‌ها برابر بوده‌اند.';
  }
}

function renderProfitTable() {
  const tbody = document.getElementById('profitTableBody');
  const countLabel = document.getElementById('profitTableCount');
  if (!tbody) return;

  const monthsData = getPeriodMonthsData();

  const hasData = monthsData.some(m => m.income > 0 || m.expense > 0);
  const filtered = hasData
    ? monthsData.filter(m => m.income > 0 || m.expense > 0)
    : monthsData;

  if (countLabel) countLabel.textContent = `${formatNumber(filtered.length)} ماه`;

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center;color:#94a3b8;padding:40px;">
          اطلاعاتی برای این دوره وجود ندارد.
        </td>
      </tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(m => {
    const margin = m.income > 0 ? Math.round((m.profit / m.income) * 100) : 0;

    let profitClass = 'profit-neutral';
    let profitText = '—';
    if (m.profit > 0) {
      profitClass = 'profit-positive';
      profitText = '+' + formatToman(m.profit);
    } else if (m.profit < 0) {
      profitClass = 'profit-negative';
      profitText = '−' + formatToman(Math.abs(m.profit));
    } else if (m.income > 0 || m.expense > 0) {
      profitText = formatToman(0);
    }

    let statusBadge = '<span class="profit-badge neutral">⚖️ تعادل</span>';
    if (m.profit > 0) {
      statusBadge = '<span class="profit-badge positive">✅ سود</span>';
    } else if (m.profit < 0) {
      statusBadge = '<span class="profit-badge negative">⚠️ زیان</span>';
    }

    let marginClass = 'profit-neutral';
    if (margin > 0) marginClass = 'profit-positive';
    else if (margin < 0) marginClass = 'profit-negative';

    return `
      <tr>
        <td><strong>${m.label || m.month}</strong></td>
        <td>${formatToman(m.income)}</td>
        <td>${formatToman(m.expense)}</td>
        <td class="${profitClass}">${profitText}</td>
        <td class="${marginClass}">${formatNumber(margin)}٪</td>
        <td>${statusBadge}</td>
      </tr>
    `;
  }).join('');
}

function renderProfitBarChart() {
  const canvas = document.getElementById('profitBarChart');
  if (!canvas) return;

  // ✅ اصلاح: اندازه canvas با fallback (قبلاً وقتی صفحه مخفی بود عرض صفر می‌شد و نمودار خالی می‌ماند)
  const { ctx, W, H } = prepareCanvas(canvas, 600, 280);

  const monthsData = getPeriodMonthsData();

  const padding = { top: 30, right: 20, bottom: 50, left: 70 };
  const chartW = W - padding.left - padding.right;
  const chartH = H - padding.top - padding.bottom;

  const hasData = monthsData.some(m => m.income > 0 || m.expense > 0);
  const maxVal = Math.max(
    ...monthsData.map(m => Math.max(m.income, m.expense)),
    1
  ) * 1.2;

  drawYAxis(ctx, padding, chartW, chartH, hasData ? maxVal : 0);
  if (!hasData) drawEmptyChartText(ctx, W, H, 'برای این دوره درآمد یا هزینه‌ای ثبت نشده');

  const groupWidth = chartW / monthsData.length;
  const barWidth = Math.min(groupWidth * 0.35, 28);
  const gap = 4;

  monthsData.forEach((m, i) => {
    const centerX = padding.left + groupWidth * i + groupWidth / 2;

    const incomeH = (m.income / maxVal) * chartH;
    const incomeX = centerX - barWidth - gap / 2;
    const incomeY = padding.top + chartH - incomeH;

    if (m.income > 0) {
      const grad1 = ctx.createLinearGradient(0, incomeY, 0, padding.top + chartH);
      grad1.addColorStop(0, '#22c55e');
      grad1.addColorStop(1, '#16a34a');

      ctx.fillStyle = grad1;
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(incomeX, incomeY, barWidth, incomeH, [6, 6, 0, 0]);
      } else {
        ctx.rect(incomeX, incomeY, barWidth, incomeH);
      }
      ctx.fill();
    }

    const expenseH = (m.expense / maxVal) * chartH;
    const expenseX = centerX + gap / 2;
    const expenseY = padding.top + chartH - expenseH;

    if (m.expense > 0) {
      const grad2 = ctx.createLinearGradient(0, expenseY, 0, padding.top + chartH);
      grad2.addColorStop(0, '#ef4444');
      grad2.addColorStop(1, '#dc2626');

      ctx.fillStyle = grad2;
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(expenseX, expenseY, barWidth, expenseH, [6, 6, 0, 0]);
      } else {
        ctx.rect(expenseX, expenseY, barWidth, expenseH);
      }
      ctx.fill();
    }

    ctx.fillStyle = '#64748b';
    const lbl = m.label || m.month;
    if (groupWidth < 46) {
      // موبایل: برچسب ماه‌ها مایل تا روی هم نیفتند
      ctx.save();
      ctx.font = '10px Vazirmatn, Tahoma';
      ctx.translate(centerX, padding.top + chartH + 8);
      ctx.rotate(-Math.PI / 4);
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(lbl, 0, 0);
      ctx.restore();
    } else {
      ctx.font = '11.5px Vazirmatn, Tahoma';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(lbl, centerX, padding.top + chartH + 12);
    }
  });
}

function renderProfitDonutChart() {
  const canvas = document.getElementById('profitDonutChart');
  if (!canvas) return;

  const monthData = getPeriodMonthsData();

  let allExpenses = [];
  monthData.forEach(m => {
    allExpenses = allExpenses.concat(m.expenses);
  });

  const categories = {};
  allExpenses.forEach(e => {
    const cat = e.category || 'سایر';
    categories[cat] = (categories[cat] || 0) + (Number(e.amount) || 0);
  });

  const categoryList = Object.entries(categories)
    .map(([name, sum]) => ({ name, sum }))
    .sort((a, b) => b.sum - a.sum);

  const total = categoryList.reduce((s, c) => s + c.sum, 0);

  const ctx = canvas.getContext('2d');
  const size = 180;
  const dpr = window.devicePixelRatio || 1;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  ctx.scale(dpr, dpr);

  const cx = size / 2, cy = size / 2, radius = 70, lineWidth = 18;

  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.strokeStyle = '#f1f5f9';
  ctx.lineWidth = lineWidth;
  ctx.stroke();

  const colors = ['#5b4cdb', '#22c55e', '#ef4444', '#f59e0b', '#06b6d4', '#a855f7', '#ec4899'];
  const categoryIcons = {
    'نظافت': '🧹',
    'تعمیرات': '🔧',
    'قبوض': '💡',
    'آسانسور': '🛗',
    'فضای سبز': '🌿',
    'نگهبانی': '🚪',
    'سایر': '📦',
  };

  let currentAngle = -Math.PI / 2;

  categoryList.forEach((c, i) => {
    if (total === 0) return;
    const angle = (c.sum / total) * Math.PI * 2;

    ctx.beginPath();
    ctx.arc(cx, cy, radius, currentAngle, currentAngle + angle);
    ctx.strokeStyle = colors[i % colors.length];
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'butt';
    ctx.stroke();

    currentAngle += angle;
  });

  const topPercent = total > 0 && categoryList[0]
    ? Math.round((categoryList[0].sum / total) * 100)
    : 0;

  const donutPercent = document.getElementById('profitDonutPercent');
  if (donutPercent) {
    donutPercent.textContent = formatNumber(topPercent) + '٪';
  }

  const legend = document.getElementById('profitDonutLegend');
  if (legend) {
    if (categoryList.length === 0) {
      legend.innerHTML = '<div style="text-align:center;color:#94a3b8;font-size:12px;">هزینه‌ای ثبت نشده</div>';
    } else {
      legend.innerHTML = categoryList.slice(0, 4).map((c, i) => `
        <div class="legend-item">
          <span class="legend-dot" style="background:${colors[i % colors.length]};"></span>
          <span>${categoryIcons[c.name] || '📦'} ${c.name}</span>
        </div>
      `).join('');
    }
  }
}

function renderProfitIncomeBreakdown() {
  const container = document.getElementById('profitIncomeBreakdown');
  if (!container) return;

  const monthsData = getPeriodMonthsData();

  const totalCharges = monthsData.reduce((s, m) => s + (m.chargesIncome || 0), 0);
  const totalSideIncomes = monthsData.reduce((s, m) => s + (m.sideIncomeSum || 0), 0);
  const totalIncome = totalCharges + totalSideIncomes;
  const totalChargesCount = monthsData.reduce((s, m) => s + m.chargesCount, 0);
  const totalSideIncomesCount = monthsData.reduce((s, m) => s + m.sideIncomesCount, 0);

  // محاسبه اجزای شارژ
  const charges = monthsData.reduce((arr, m) => arr.concat(m.charges || []), []);

  const extraIncome = charges.reduce((s, c) => s + (Number(c.extra) || 0), 0);
  const baseIncome = totalCharges - extraIncome;

  const rows = [
    { icon: '💰', label: 'شارژ پایه', value: baseIncome, isCount: false },
    { icon: '➕', label: 'هزینه اضافی شارژ', value: extraIncome, isCount: false },
    { icon: '🏪', label: 'درآمد جانبی', value: totalSideIncomes, isCount: false },
    { icon: '📋', label: 'تعداد شارژهای پرداخت‌شده', value: totalChargesCount, isCount: true },
    { icon: '🏪', label: 'تعداد درآمدهای جانبی', value: totalSideIncomesCount, isCount: true },
  ];

  container.innerHTML = rows.map(r => `
    <div class="breakdown-row">
      <div class="breakdown-label">
        <span>${r.icon}</span>
        <span>${r.label}</span>
      </div>
      <div class="breakdown-value ${r.isCount ? '' : 'positive'}">
        ${r.isCount ? formatNumber(r.value) + ' مورد' : formatToman(r.value)}
      </div>
    </div>
  `).join('');
}

function renderProfitExpenseBreakdown() {
  const container = document.getElementById('profitExpenseBreakdown');
  if (!container) return;

  const monthData = getPeriodMonthsData();

  let allExpenses = [];
  monthData.forEach(m => {
    allExpenses = allExpenses.concat(m.expenses);
  });

  const categories = {};
  allExpenses.forEach(e => {
    const cat = e.category || 'سایر';
    if (!categories[cat]) categories[cat] = { count: 0, sum: 0 };
    categories[cat].count++;
    categories[cat].sum += Number(e.amount) || 0;
  });

  const list = Object.entries(categories)
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.sum - a.sum);

  const total = list.reduce((s, c) => s + c.sum, 0);

  if (list.length === 0) {
    container.innerHTML = `
      <div style="text-align:center;color:#94a3b8;padding:30px;font-size:13px;">
        هزینه‌ای ثبت نشده
      </div>`;
    return;
  }

  const categoryIcons = {
    'نظافت': '🧹',
    'تعمیرات': '🔧',
    'قبوض': '💡',
    'آسانسور': '🛗',
    'فضای سبز': '🌿',
    'نگهبانی': '🚪',
    'سایر': '📦',
  };

  container.innerHTML = list.map(c => {
    const percent = total > 0 ? Math.round((c.sum / total) * 100) : 0;
    return `
      <div class="breakdown-row">
        <div class="breakdown-label">
          <span>${categoryIcons[c.name] || '📦'}</span>
          <span>${c.name} <small style="color:#94a3b8;">(${formatNumber(c.count)} مورد)</small></span>
        </div>
        <div style="text-align:left;">
          <div class="breakdown-value negative">${formatToman(c.sum)}</div>
          <div style="font-size:11px;color:#94a3b8;">${formatNumber(percent)}٪</div>
        </div>
      </div>
    `;
  }).join('');
}

function renderProfitPage() {
  renderProfitStats();
  renderProfitTable();
  renderProfitBarChart();
  renderProfitDonutChart();
  renderProfitIncomeBreakdown();
  renderProfitExpenseBreakdown();
}

function bindProfitPage() {
  const yearSelect = document.getElementById('profitYear');
  if (yearSelect) {
    yearSelect.innerHTML = '';
    const currentYear = getTodayPersianYear();
    for (let i = currentYear - 3; i <= currentYear + 1; i++) {
      const opt = document.createElement('option');
      opt.value = String(i);
      opt.textContent = toPersianNum(i);
      if (String(i) === String(currentYear)) opt.selected = true;
      yearSelect.appendChild(opt);
    }
    profitYear = String(currentYear);

    yearSelect.addEventListener('change', (e) => {
      profitYear = e.target.value;
      renderProfitPage();
    });
  }

  const blockSelect = document.getElementById('profitBlock');
  const data = loadData();
  if (blockSelect && data?.building) {
    if (data.building.type === 'complex') {
      blockSelect.innerHTML = '<option value="all">🏢 همه بلوک‌ها</option>';
      data.building.blocks.forEach(b => {
        const opt = document.createElement('option');
        opt.value = String(b.name).trim();
        opt.textContent = String(b.name).trim();
        blockSelect.appendChild(opt);
      });
      blockSelect.parentElement.style.display = 'flex';
    } else {
      blockSelect.parentElement.style.display = 'none';
    }

    blockSelect.addEventListener('change', (e) => {
      profitBlock = e.target.value;
      renderProfitPage();
    });
  }

  const periodSelect = document.getElementById('profitPeriod');
  if (periodSelect) {
    periodSelect.addEventListener('change', (e) => {
      profitPeriod = e.target.value;
      renderProfitPage();
    });
  }

  document.getElementById('btnProfitExcel')?.addEventListener('click', exportProfitToExcel);
  document.getElementById('btnProfitPdf')?.addEventListener('click', printProfitPdf);
}

function exportProfitToExcel() {
  const monthsData = getPeriodMonthsData();

  const totalIncome = monthsData.reduce((s, m) => s + m.income, 0);
  const totalExpense = monthsData.reduce((s, m) => s + m.expense, 0);
  const netProfit = totalIncome - totalExpense;
  const margin = totalIncome > 0 ? Math.round((netProfit / totalIncome) * 100) : 0;

  const blockLabel = profitBlock === 'all' ? 'همه بلوک‌ها' : profitBlock;

  let html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office"
          xmlns:x="urn:schemas-microsoft-com:office:excel"
          xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="UTF-8">
      <style>
        table { border-collapse: collapse; font-family: Tahoma; direction: rtl; margin-bottom:20px; }
        th, td { border: 1px solid #ccc; padding: 8px; text-align: right; font-size: 13px; }
        th { background: #5b4cdb; color: white; font-weight: bold; }
        h2 { color: #5b4cdb; }
        .positive { color: #15803d; font-weight: bold; }
        .negative { color: #b91c1c; font-weight: bold; }
      </style>
    </head>
    <body>
      <h2>گزارش سود و زیان — ${blockLabel} — سال ${toPersianNum(profitYear)}</h2>
      <h3>خلاصه درآمد</h3>
      <table>
        <tr><td>شارژ دریافتی</td><td>${chargesTotal.toLocaleString('en-US')} تومان</td></tr>
        <tr><td>درآمد جانبی</td><td>${sideIncomesTotal.toLocaleString('en-US')} تومان</td></tr>
        <tr><td><strong>کل درآمد</strong></td><td class="positive"><strong>${totalIncome.toLocaleString('en-US')} تومان</strong></td></tr>
      </table>
      <h3>خلاصه کلی</h3>
      <table>
        <tr><td>کل درآمد</td><td class="positive">${totalIncome.toLocaleString('en-US')} تومان</td></tr>
        <tr><td>کل هزینه</td><td class="negative">${totalExpense.toLocaleString('en-US')} تومان</td></tr>
        <tr><td>سود / زیان</td><td class="${netProfit >= 0 ? 'positive' : 'negative'}">${netProfit.toLocaleString('en-US')} تومان</td></tr>
        <tr><td>حاشیه سود</td><td>${margin}٪</td></tr>
      </table>

      <h3>جدول ماهانه</h3>
      <table>
        <thead>
          <tr>
            <th>ماه</th><th>درآمد</th><th>هزینه</th><th>سود / زیان</th><th>حاشیه سود</th>
          </tr>
        </thead>
        <tbody>
  `;

  monthsData.forEach(m => {
    const rowMargin = m.income > 0 ? Math.round((m.profit / m.income) * 100) : 0;
    html += `
      <tr>
        <td>${m.label || m.month}</td>
        <td>${m.income.toLocaleString('en-US')}</td>
        <td>${m.expense.toLocaleString('en-US')}</td>
        <td class="${m.profit >= 0 ? 'positive' : 'negative'}">${m.profit.toLocaleString('en-US')}</td>
        <td>${rowMargin}٪</td>
      </tr>
    `;
  });

  html += `
        </tbody>
      </table>
    </body>
    </html>
  `;

  const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `سود-زیان-${profitYear}.xls`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function printProfitPdf() {
  const monthsData = getPeriodMonthsData();

  const totalIncome = monthsData.reduce((s, m) => s + m.income, 0);
  const chargesTotal = monthsData.reduce((s, m) => s + (m.chargesIncome || 0), 0);
  const sideIncomesTotal = monthsData.reduce((s, m) => s + (m.sideIncomeSum || 0), 0);
  const totalExpense = monthsData.reduce((s, m) => s + m.expense, 0);
  const netProfit = totalIncome - totalExpense;
  const margin = totalIncome > 0 ? Math.round((netProfit / totalIncome) * 100) : 0;

  const buildingData = loadData();
  const buildingName = buildingData?.building?.name || 'ساختمان';
  const blockLabel = profitBlock === 'all' ? 'همه بلوک‌ها' : `بلوک ${profitBlock}`;
  const today = new Date().toLocaleDateString('fa-IR');

  let rows = '';
  monthsData.forEach(m => {
    if (m.income === 0 && m.expense === 0) return;
    const rowMargin = m.income > 0 ? Math.round((m.profit / m.income) * 100) : 0;
    const profitClass = m.profit >= 0 ? 'color:#15803d;' : 'color:#b91c1c;';
    rows += `
      <tr>
        <td>${m.label || m.month}</td>
        <td>${formatToman(m.income)}</td>
        <td>${formatToman(m.expense)}</td>
        <td style="${profitClass} font-weight:700;">${m.profit >= 0 ? '+' : '−'}${formatToman(Math.abs(m.profit))}</td>
        <td>${formatNumber(rowMargin)}٪</td>
      </tr>
    `;
  });

  const html = `
    <!DOCTYPE html>
    <html lang="fa" dir="rtl">
    <head>
      <meta charset="UTF-8">
      <title>گزارش سود و زیان</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Tahoma, Arial; direction: rtl; padding: 80px 30px 30px 30px; color: #1e293b; }
        .pdf-toolbar {
          position: fixed; top: 0; left: 0; right: 0;
          background: #fff; border-bottom: 1px solid #e2e8f0;
          padding: 12px 20px; display: flex; justify-content: center;
          gap: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.06); z-index: 1000;
        }
        .pdf-toolbar button {
          padding: 10px 22px; border: none; border-radius: 10px;
          font-family: Tahoma; font-size: 14px; font-weight: bold; cursor: pointer;
        }
        .btn-print { background: #5b4cdb; color: #fff; }
        .btn-save { background: #22c55e; color: #fff; }
        .btn-close { background: #f1f5f9; color: #64748b; }

        h1 { color: #5b4cdb; font-size: 22px; margin-bottom: 5px; }
        .info { font-size: 12px; color: #64748b; margin-bottom: 24px; }
        h3 { color: #5b4cdb; margin-top: 20px; margin-bottom: 10px; font-size: 15px; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 16px; }
        th { background: #5b4cdb; color: white; padding: 9px 6px; text-align: right; border: 1px solid #4338ca; }
        td { padding: 8px 6px; border: 1px solid #e2e8f0; text-align: right; }
        tr:nth-child(even) { background: #f8fafc; }
        .stats { display: flex; gap: 12px; margin-bottom: 20px; }
        .stat-box { flex: 1; padding: 14px; border-radius: 10px; text-align: center; border: 1px solid #e2e8f0; }
        .stat-box span { display: block; font-size: 11px; color: #64748b; margin-bottom: 4px; }
        .stat-box strong { font-size: 14px; }
        .footer { margin-top: 30px; padding-top: 15px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 11px; color: #94a3b8; }

        @media print {
          .pdf-toolbar { display: none !important; }
          body { padding: 20px 15px; }
        }
      </style>
    </head>
    <body>

      <div class="pdf-toolbar">
        <button class="btn-print" onclick="window.print()">🖨️ چاپ</button>
        <button class="btn-save" onclick="window.print()">📥 ذخیره PDF</button>
        <button class="btn-close" onclick="window.close()">❌ بستن</button>
      </div>

      <h1>🏢 ${buildingName}</h1>
      <div class="info">
        گزارش سود و زیان — ${blockLabel} — سال ${toPersianNum(profitYear)} | تاریخ چاپ: ${today}
      </div>
<div class="stats">
  <div class="stat-box">
    <span>کل درآمد</span>
    <strong style="color:#15803d;">${formatToman(totalIncome)}</strong>
  </div>
  <div class="stat-box">
    <span>شارژ دریافتی</span>
    <strong style="color:#15803d;">${formatToman(chargesTotal)}</strong>
  </div>
  <div class="stat-box">
    <span>درآمد جانبی</span>
    <strong style="color:#15803d;">${formatToman(sideIncomesTotal)}</strong>
  </div>
      <div class="stats">
        <div class="stat-box">
          <span>کل درآمد</span>
          <strong style="color:#15803d;">${formatToman(totalIncome)}</strong>
        </div>
        <div class="stat-box">
          <span>کل هزینه</span>
          <strong style="color:#b91c1c;">${formatToman(totalExpense)}</strong>
        </div>
        <div class="stat-box">
          <span>سود / زیان</span>
          <strong style="color:${netProfit >= 0 ? '#15803d' : '#b91c1c'};">${netProfit >= 0 ? '+' : '−'}${formatToman(Math.abs(netProfit))}</strong>
        </div>
        <div class="stat-box">
          <span>حاشیه سود</span>
          <strong>${formatNumber(margin)}٪</strong>
        </div>
      </div>

      <h3>📋 جدول ماهانه سود و زیان</h3>
      <table>
        <thead>
          <tr>
            <th>ماه</th><th>درآمد</th><th>هزینه</th><th>سود / زیان</th><th>حاشیه سود</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>

      <div class="footer">
        © ${new Date().getFullYear()} — آپارتمان پلاس | نرم‌افزار هوشمند مدیریت ساختمان
      </div>

    </body>
    </html>
  `;

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    toastWarning('لطفاً اجازه باز شدن پنجره چاپ را بدهید.');
    return;
  }

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}

/* ============================================================
   🆘 صفحه پشتیبانی
   ============================================================ */
function getTicketsKey() {
  return getAccountStorageKey('ham_sakhteman_tickets');
}
let currentTicketId = null;

function loadTickets() {
  const raw = localStorage.getItem(getTicketsKey());
  if (raw) { try { return JSON.parse(raw); } catch (e) { return []; } }
  return [];
}

function saveTickets(tickets) {
  localStorage.setItem(getTicketsKey(), JSON.stringify(tickets));
}

function getPersianDateTime() {
  const now = new Date();
  return {
    date: now.toLocaleDateString('fa-IR'),
    time: now.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }),
    iso: now.toISOString(),
  };
}

function renderSupportPage() {
  const tickets = loadTickets();

  const total = tickets.length;
  const open = tickets.filter(t => t.status === 'open').length;
  const closed = tickets.filter(t => t.status === 'closed').length;
  const lastDate = tickets.length > 0 ? tickets[tickets.length - 1].date : '—';

  const elTotal = document.getElementById('supportTotal');
  const elPending = document.getElementById('supportPending');
  const elAnswered = document.getElementById('supportAnswered');
  const elLast = document.getElementById('supportLastDate');

  if (elTotal) elTotal.textContent = formatNumber(total);
  if (elPending) elPending.textContent = formatNumber(open);
  if (elAnswered) elAnswered.textContent = formatNumber(closed);
  if (elLast) elLast.textContent = lastDate;

  const tbody = document.getElementById('supportTableBody');
  if (!tbody) return;

  if (tickets.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center;color:#94a3b8;padding:40px;">
          هنوز تیکتی ارسال نکرده‌اید.
          <br><br>
          <button class="btn btn-primary" onclick="document.getElementById('btnNewTicket').click()">
            📩 ارسال اولین تیکت
          </button>
        </td>
      </tr>`;
    return;
  }

  const statusBadge = {
    'open': '<span class="badge badge-debt">🟢 باز</span>',
    'closed': '<span class="badge" style="background:#e5e7eb; color:#4b5563;">🔒 بسته شده</span>',
  };

  const priorityIcons = { 'کم': '🟢', 'متوسط': '🟡', 'زیاد': '🔴' };

  tbody.innerHTML = [...tickets].reverse().map(t => {
    const msgCount = t.messages.length;

    return `
      <tr>
        <td>${t.date}<br><small style="color:#94a3b8;">${t.time}</small></td>
        <td>
          <strong>${t.subject}</strong>
          <br><small style="color:#94a3b8;">${priorityIcons[t.priority]} ${t.priority} • ${msgCount} پیام</small>
        </td>
        <td>${t.category}</td>
        <td>${statusBadge[t.status] || '—'}</td>
        <td style="color:#64748b; font-size:12.5px;">${t.lastUpdateDate || t.date}</td>
        <td>
          <div class="row-actions">
            <button class="row-action-btn" data-ticket-action="view" data-id="${t.id}" title="مشاهده / ادامه">💬</button>
            <button class="row-action-btn danger" data-ticket-action="delete" data-id="${t.id}" title="حذف">🗑️</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function openTicketModal() {
  const modal = document.getElementById('ticketModal');
  if (!modal) return;

  document.getElementById('ticketSubject').value = '';
  document.getElementById('ticketCategory').value = 'مشکل فنی';
  document.getElementById('ticketPriority').value = 'متوسط';
  document.getElementById('ticketMessage').value = '';

  modal.classList.add('open');
}

function closeTicketModal() {
  const modal = document.getElementById('ticketModal');
  if (modal) modal.classList.remove('open');
}

function saveTicket() {
  const subject = document.getElementById('ticketSubject')?.value.trim();
  const category = document.getElementById('ticketCategory')?.value || 'سایر';
  const priority = document.getElementById('ticketPriority')?.value || 'متوسط';
  const message = document.getElementById('ticketMessage')?.value.trim();

  if (!subject) { toastWarning('لطفاً موضوع تیکت را وارد کنید.'); return; }
  if (!message) { toastWarning('لطفاً متن پیام را وارد کنید.'); return; }

  const tickets = loadTickets();
  const newId = Math.max(Date.now(), ...tickets.map(t => Number(t.id) || 0)) + 1;
  const dt = getPersianDateTime();

  tickets.push({
    id: newId,
    subject, category, priority,
    status: 'open',
    date: dt.date,
    time: dt.time,
    lastUpdateDate: dt.date,
    lastUpdateTime: dt.time,
    createdAt: dt.iso,
    updatedAt: dt.iso,
    messages: [{
      sender: 'user',
      text: message,
      date: dt.date,
      time: dt.time,
      createdAt: dt.iso,
    }],
  });

  saveTickets(tickets);
  closeTicketModal();
  renderSupportPage();
  toastSuccess('تیکت شما با موفقیت ارسال شد. به‌زودی پاسخ می‌دهیم.');
}

function openTicketView(ticketId) {
  const tickets = loadTickets();
  const ticket = tickets.find(t => t.id === ticketId);
  if (!ticket) return;

  currentTicketId = ticketId;

  const elSubject = document.getElementById('ticketViewSubject');
  const elMeta = document.getElementById('ticketViewMeta');

  if (elSubject) elSubject.textContent = ticket.subject;

  const priorityIcons = { 'کم': '🟢', 'متوسط': '🟡', 'زیاد': '🔴' };

  if (elMeta) {
    elMeta.textContent = `${priorityIcons[ticket.priority]} ${ticket.priority} • ${ticket.category} • ${ticket.date} - ${ticket.time}`;
  }

  renderTicketMessages(ticket);

  const replyBox = document.getElementById('ticketReplyBox');
  if (replyBox) {
    replyBox.style.display = ticket.status === 'closed' ? 'none' : 'block';
  }

  const modal = document.getElementById('ticketViewModal');
  if (modal) modal.classList.add('open');
}

function closeTicketView() {
  const modal = document.getElementById('ticketViewModal');
  if (modal) modal.classList.remove('open');
  currentTicketId = null;
  renderSupportPage();
}

function renderTicketMessages(ticket) {
  const container = document.getElementById('ticketMessagesBox');
  if (!container) return;

  container.innerHTML = ticket.messages.map((m) => {
    const isUser = m.sender === 'user';

    const label = isUser ? '👤 شما' : '🆘 پشتیبانی';
    const bgColor = isUser ? '#5b4cdb' : '#0f766e';
    const align = isUser ? 'flex-start' : 'flex-end';
    const borderRadius = isUser
      ? 'border-top-right-radius: 4px;'
      : 'border-top-left-radius: 4px;';

    return `
      <div style="display: flex; justify-content: ${align};">
        <div style="max-width: 80%; padding: 12px 16px; border-radius: 14px; ${borderRadius} background: ${bgColor}; color: #fff;">
          <div style="font-size: 12px; opacity: 0.85; margin-bottom: 6px; font-weight: 700;">
            ${label}
          </div>
          <div style="font-size: 14px; line-height: 1.7; word-wrap: break-word;">
            ${m.text.replace(/\n/g, '<br>')}
          </div>
          <div style="font-size: 10.5px; margin-top: 8px; opacity: 0.75; text-align: left;">
            ${m.time} — ${m.date}
          </div>
        </div>
      </div>
    `;
  }).join('');

  container.scrollTop = container.scrollHeight;
}

function replyToTicket() {
  if (!currentTicketId) return;

  const message = document.getElementById('ticketReplyMessage')?.value.trim();
  if (!message) { toastWarning('لطفاً متن پاسخ را وارد کنید.'); return; }

  const tickets = loadTickets();
  const ticket = tickets.find(t => t.id === currentTicketId);
  if (!ticket) return;

  if (ticket.status === 'closed') {
    toastWarning('این تیکت بسته شده و قابل پاسخ نیست.');
    return;
  }

  const dt = getPersianDateTime();

  ticket.messages.push({
    sender: 'user',
    text: message,
    date: dt.date,
    time: dt.time,
    createdAt: dt.iso,
  });

  ticket.lastUpdateDate = dt.date;
  ticket.lastUpdateTime = dt.time;
  ticket.updatedAt = dt.iso;

  saveTickets(tickets);

  document.getElementById('ticketReplyMessage').value = '';
  renderTicketMessages(ticket);
  renderSupportPage();

  toastSuccess('پاسخ شما ثبت شد.');
}

async function deleteTicket(ticketId) {
  if (!(await appConfirm('⚠️ آیا از حذف این تیکت مطمئن هستید؟'))) return;

  let tickets = loadTickets();
  tickets = tickets.filter(t => t.id !== ticketId);
  saveTickets(tickets);

  renderSupportPage();
  toastSuccess('تیکت حذف شد.');
}

function bindSupportPage() {
  document.getElementById('btnNewTicket')?.addEventListener('click', openTicketModal);
  document.getElementById('ticketCancelBtn')?.addEventListener('click', closeTicketModal);
  document.getElementById('ticketSaveBtn')?.addEventListener('click', saveTicket);

  document.getElementById('ticketViewCloseBtn')?.addEventListener('click', closeTicketView);
  document.getElementById('ticketViewCancelBtn')?.addEventListener('click', closeTicketView);
  document.getElementById('ticketReplyBtn')?.addEventListener('click', replyToTicket);

  const modal = document.getElementById('ticketModal');
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeTicketModal();
    });
  }

  const viewModal = document.getElementById('ticketViewModal');
  if (viewModal) {
    viewModal.addEventListener('click', (e) => {
      if (e.target === viewModal) closeTicketView();
    });
  }

  const tbody = document.getElementById('supportTableBody');
  if (tbody) {
    tbody.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-ticket-action]');
      if (!btn) return;

      const action = btn.dataset.ticketAction;
      const id = Number(btn.dataset.id);

      if (action === 'view') openTicketView(id);
      else if (action === 'delete') deleteTicket(id);
    });
  }
}

/* ============================================================
   💎 صفحه اشتراکی
   ============================================================ */
function renderSubscriptionPage() {
  const plan = loadPlan();
  const currentPlan = plan?.type || 'free';

  const elPlan = document.getElementById('subCurrentPlan');
  const elStart = document.getElementById('subStartDate');
  const elExpiry = document.getElementById('subExpiryDate');
  const elUnits = document.getElementById('subTotalUnits');

  if (elPlan) {
    elPlan.textContent = currentPlan === 'pro' ? '💎 حرفه‌ای' : '🆓 رایگان';
  }

  if (elStart) {
    elStart.textContent = plan?.startedAt
      ? new Date(plan.startedAt).toLocaleDateString('fa-IR')
      : '—';
  }

  if (elExpiry) {
    elExpiry.textContent = plan?.expiresAt
      ? new Date(plan.expiresAt).toLocaleDateString('fa-IR')
      : 'نامحدود';
  }

  const btnFree = document.getElementById('subBtnFree');
  if (btnFree) {
    if (currentPlan === 'free') {
      btnFree.textContent = 'پلن فعلی';
      btnFree.disabled = true;
      btnFree.className = 'btn btn-outline plan-select-btn';
      btnFree.onclick = null;
    } else {
      btnFree.textContent = 'غیرفعال کردن حرفه‌ای';
      btnFree.disabled = false;
      btnFree.className = 'btn btn-cancel plan-select-btn';
      btnFree.onclick = async () => {
        if (!(await appConfirm('آیا از غیرفعال کردن پلن حرفه‌ای مطمئن هستید؟'))) return;
        const newPlan = {
          type: 'free',
          totalUnits: UNITS.length,
          startedAt: new Date().toISOString(),
          expiresAt: null,
          payment: { amount: 0, status: 'free' },
        };
        savePlan(newPlan);
        renderSubscriptionPage();
        updateSidebarLockStates();
        toastSuccess('پلن حرفه‌ای غیرفعال شد.');
      };
    }
  }

  const btnPro = document.getElementById('subBtnPro');
  const elProPrice = document.getElementById('subProPrice');

  // قیمت نمایشی: اگر قبلاً پرداخت شده، مبلغ پرداخت‌شده را نشان بده؛ وگرنه بر اساس تعداد واحد محاسبه کن
  const data = loadData();
  const registeredUnits = data?.building
    ? (Number(data.building.totalUnits) || getExpectedUnitsCount(data.building) || 0)
    : 0;
  const totalUnitsForPrice = registeredUnits || plan?.totalUnits || UNITS.length || 0;

  let price;
  if (currentPlan === 'pro' && plan?.payment?.amount > 0) {
    price = Number(plan.payment.amount);
  } else {
    const result = calculatePrice(totalUnitsForPrice);
    price = result.price > 0 ? result.price : (4 * 100000);
  }

  if (elProPrice) {
    elProPrice.textContent = (price / 1000000).toFixed(1).replace('.0', '');
  }

  // تعداد واحدها در کارت وضعیت: از اطلاعات ثبت‌نام / پلن
  if (elUnits) {
    elUnits.textContent = formatNumber(registeredUnits || plan?.totalUnits || UNITS.length || 0);
  }

  if (btnPro) {
    if (currentPlan === 'pro') {
      btnPro.textContent = '✅ پلن فعلی';
      btnPro.disabled = true;
      btnPro.className = 'btn btn-outline plan-select-btn';
      btnPro.onclick = null;
    } else {
      btnPro.textContent = 'ارتقا به حرفه‌ای';
      btnPro.disabled = false;
      btnPro.className = 'btn btn-primary plan-select-btn';
      btnPro.onclick = () => {
        const paymentInfo = {
          planType: 'pro',
          totalUnits: totalUnitsForPrice,
          amount: price,
          orderId: 'SUB-' + Date.now(),
          isUpgrade: true,
        };
        showMockPaymentPage(paymentInfo);
      };
    }
  }
}

function processMockPaymentSuccess(paymentInfo) {
  // اول داده‌های ثبت‌نام (نام ساختمان، مدیر و ...) ذخیره شود تا کلید per-account درست شود
  if (!paymentInfo.isUpgrade) {
    saveWizardData();
  }

  // سپس پلن فعال شود (حالا شماره موبایل ست شده و کلید scoped درست است)
  activatePlan('pro', paymentInfo.totalUnits, {
    amount: paymentInfo.amount,
    status: 'paid',
    paidAt: new Date().toISOString(),
    orderId: paymentInfo.orderId,
  });

  showSuccessPage({
    planName: 'حرفه‌ای',
    planIcon: '💎',
    amount: paymentInfo.amount,
    refId: paymentInfo.orderId,
    isPaid: true,
  });

  updateSidebarLockStates();

  toastSuccess('پلن حرفه‌ای با موفقیت فعال شد!');
}

document.addEventListener('DOMContentLoaded', init);

/* سال شمسی جاری در فوتر */
document.addEventListener('DOMContentLoaded', () => {
  try { const el = document.getElementById('footerYear'); if (el) el.textContent = toPersianNum(getTodayPersianYear()); } catch (e) {}
});

/* ===== منوی کشویی موبایل (≤۹۰۰px) ===== */
document.addEventListener('DOMContentLoaded', () => {
  try {
    const sidebar = document.querySelector('.app-body > .sidebar');
    const brand = document.querySelector('.topbar .brand');
    if (!sidebar || !brand || document.getElementById('menuToggleBtn')) return;
    const btn = document.createElement('button');
    btn.type = 'button'; btn.id = 'menuToggleBtn'; btn.className = 'menu-toggle-btn';
    btn.setAttribute('aria-label', 'منو');
    btn.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h16M4 12h16M4 18h16"/></svg>';
    brand.insertBefore(btn, brand.firstChild);
    const backdrop = document.createElement('div');
    backdrop.className = 'sidebar-backdrop';
    document.body.appendChild(backdrop);
    const setOpen = (open) => {
      sidebar.classList.toggle('open', open);
      backdrop.classList.toggle('open', open);
      document.body.classList.toggle('sidebar-locked', open);
    };
    btn.addEventListener('click', () => setOpen(!sidebar.classList.contains('open')));
    backdrop.addEventListener('click', () => setOpen(false));
    sidebar.addEventListener('click', (e) => {
      if (!window.matchMedia('(max-width: 900px)').matches) return;
      const li = e.target.closest('li[data-page], [data-page-link], .subscription-nav-item, .upgrade-btn, button');
      if (!li) return;
      if (li.classList && li.classList.contains('has-submenu') && !e.target.closest('.submenu')) return; // باز/بستن زیرمنو
      setTimeout(() => { setOpen(false); window.scrollTo(0, 0); }, 60);
    });
  } catch (e) { console.warn('mobile menu', e); }
});

/* ===== راهنمای مبلغ زیر فیلدهای پولی: «۱٬۲۵۰٬۰۰۰ تومان» تا صفرها اشتباه وارد نشوند ===== */
(function () {
  function hintFor(inp) {
    let h = inp.nextElementSibling;
    if (!h || !h.classList || !h.classList.contains('money-hint')) {
      h = document.createElement('div');
      h.className = 'money-hint';
      h.style.cssText = 'font-size:11.5px;color:#6366f1;margin-top:4px;min-height:14px;';
      inp.insertAdjacentElement('afterend', h);
    }
    const v = Number(String(inp.value || '').replace(/[^\d.]/g, ''));
    h.textContent = v > 0 ? `${toPersianNum(Math.round(v).toLocaleString('en-US')).replace(/,/g, '٬')} تومان` + (v >= 1e6 ? ` (≈ ${toPersianNum(String(+(v / 1e6).toFixed(2)))} میلیون)` : '') : '';
  }
  document.addEventListener('input', (e) => {
    const t = e.target;
    if (t && t.matches && t.matches('input[type="number"][step="10000"]')) hintFor(t);
  });
  // مقدار اولیه وقتی مودال باز می‌شود
  document.addEventListener('focusin', (e) => {
    const t = e.target;
    if (t && t.matches && t.matches('input[type="number"][step="10000"]')) hintFor(t);
  });
})();

/** سال کبیسه شمسی (اسفند ۳۰ روزه) */
function isPersianLeapYear(jy) {
  try {
    const g = persianToGregorian(jy, 12, 30);
    const gy = Array.isArray(g) ? g[0] : (g.gy || g.year), gm = Array.isArray(g) ? g[1] : (g.gm || g.month), gd = Array.isArray(g) ? g[2] : (g.gd || g.day);
    const p = gregorianToPersian(gy, gm, gd);
    return p.month === 12 && p.day === 30;
  } catch (e) { return false; }
}
