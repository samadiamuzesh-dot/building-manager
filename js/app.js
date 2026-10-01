/* ============================================================
   هم ساختمان | v16 (اصلاح‌شده نهایی)
   ============================================================

   🎨 طراحی و توسعه: الهام صمدی
   👩‍💼 مدیر پروژه: الهام صمدی

   ============================================================ */

console.log('APP.JS VERSION: v17 — ApartmentPlus');
console.log('%c🏢 آپارتمان پلاس | v17', 'color: #5b4cdb; font-size: 14px; font-weight: bold;');
console.log('%c🎨 طراحی و توسعه: الهام صمدی', 'color: #5b4cdb; font-size: 12px;');

const STORAGE_KEY = 'ham_sakhteman_v3';
const UNITS_KEY = 'ham_sakhteman_units';

/* ============ ۱) ابزار ============ */
function formatToman(a) { return new Intl.NumberFormat('fa-IR').format(Number(a) || 0) + ' تومان'; }
function formatNumber(n) { return new Intl.NumberFormat('fa-IR').format(Number(n) || 0); }
function toPersianNum(n) {
  const p = ['۰','۱','۲','۳','۴','۵','۶','۷','۸','۹'];
  return String(n).replace(/\d/g, d => p[d]);
}
/* ============================================================
   🍞 Toast Notifications (پیام گوشه صفحه)
   ============================================================ */
function showToast(message, type = 'success', title = null) {
  // ساخت container اگه نباشه
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  // آیکون‌ها
  const icons = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️'
  };

  // عنوان پیش‌فرض
  const titles = {
    success: 'موفق',
    error: 'خطا',
    warning: 'هشدار',
    info: 'اطلاع'
  };

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

  // انیمیشن ورود
  setTimeout(() => toast.classList.add('show'), 10);

  // حذف خودکار بعد از ۳.۵ ثانیه
  setTimeout(() => {
    toast.classList.remove('show');
    toast.classList.add('hide');
    setTimeout(() => toast.remove(), 400);
  }, 3500);
}

// میان‌برهای سریع
function toastSuccess(msg, title) { showToast(msg, 'success', title); }
function toastError(msg, title) { showToast(msg, 'error', title); }
function toastWarning(msg, title) { showToast(msg, 'warning', title); }
function toastInfo(msg, title) { showToast(msg, 'info', title); }

/* ============================================================
   📅 تاریخ خودکار (شمسی) — نسخه واحد و تمیز
   ============================================================ */

function getTodayPersian() {
  const now = new Date();
  const gregorianYear = now.getFullYear();
  const gregorianMonth = now.getMonth() + 1;
  const gregorianDay = now.getDate();
  return gregorianToPersian(gregorianYear, gregorianMonth, gregorianDay);
}

function getTodayPersianMonth() {
  const months = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
                  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
  const today = getTodayPersian();
  return months[today.month - 1];
}

/* ✅ عدد انگلیسی برمی‌گردونه (برای محاسبات) */
function getTodayPersianYear() {
  const today = getTodayPersian();
  return today.year;
}

/* ✅ رشته فارسی سال (برای نمایش) */
function getTodayPersianYearFa() {
  return toPersianNum(getTodayPersianYear());
}

function getTodayPersianDate() {
  const today = getTodayPersian();
  const month = String(today.month).padStart(2, '0');
  const day = String(today.day).padStart(2, '0');
  return `${today.year}/${month}/${day}`;
}

// تبدیل میلادی به شمسی
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
   📅 پر کردن دراپ‌داون‌های سال و ماه — نسخه واحد
   ============================================================ */
function fillYearMonthDropdowns(yearId, monthId) {
  const years = [];
  const currentYear = getTodayPersianYear(); // عدد انگلیسی

  for (let i = currentYear - 2; i <= currentYear + 2; i++) {
    years.push(String(i));
  }

  const months = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
                  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];

  // پر کردن سال
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

  // پر کردن ماه
  if (monthId) {
    const monthSelect = document.getElementById(monthId);
    if (monthSelect) {
      monthSelect.innerHTML = '';
      months.forEach(m => {
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
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) { try { return JSON.parse(raw); } catch (e) {} }
  return null;
}
function saveData(d) { localStorage.setItem(STORAGE_KEY, JSON.stringify(d)); }

let UNITS = [];
function loadUnits() {
  const raw = localStorage.getItem(UNITS_KEY);
  if (raw) { try { UNITS = JSON.parse(raw); } catch (e) { UNITS = []; } }
  else { UNITS = []; }
}
function saveUnits() { localStorage.setItem(UNITS_KEY, JSON.stringify(UNITS)); }

/* ============ ۴) ساخت واحدهای خالی ============ */
function buildDemoUnits(building) {
  UNITS = [];
  let id = 1;

  if (building.type === 'complex') {
    building.blocks.forEach((block) => {
      const blockName = String(block.name).trim();
      let count = parseInt(block.units) || 0;
      if (count < 1) count = 0;

      for (let i = 1; i <= count; i++) {
        UNITS.push({
          id: id++,
          block: blockName,
          number: i,
          code: `${blockName}-${toPersianNum(i)}`,
          owner: {
            name: null,
            phone: null,
            registered: false,
            approved: false,
          },
          tenant: {
            name: null,
            phone: null,
            registered: false,
            approved: false,
          },
          debt: 0,
          chargeAmount: 0,
        });
      }
    });
  } else {
    let count = parseInt(building.totalUnits) || 0;
    if (count < 1) count = 0;

    for (let i = 1; i <= count; i++) {
      UNITS.push({
        id: id++,
        block: '—',
        number: i,
        code: `${building.code}-${toPersianNum(i)}`,
        owner: {
          name: null,
          phone: null,
          registered: false,
          approved: false,
        },
        tenant: { name: null, phone: null, registered: false, approved: false },
        debt: 0,
        chargeAmount: 0,
      });
    }
  }

  saveUnits();
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
  if (nameEl) nameEl.textContent = b.name || '—';

  if (codeEl) {
    codeEl.textContent = b.code || '—';
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
  // ✅ چک دسترسی به صفحه
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

  if (pageKey === 'dashboard') renderDashboard();
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
  if (pageKey === 'reports') renderReportsPage();
  if (pageKey === 'profit') renderProfitPage();
  if (pageKey === 'profile') { fillProfileForm(); }
  if (pageKey === 'settings') renderSettingsPage();
     if (pageKey === 'subscription') renderSubscriptionPage();
     if (pageKey === 'support') renderSupportPage();
}

/* ============ ۷) فیلتر بلوک داشبورد ============ */
let currentBlockFilter = 'all';
let currentStatusFilter = 'all';

function getFilteredUnits() {
  let list = UNITS;

  if (currentBlockFilter !== 'all' && currentBlockFilter !== '' && currentBlockFilter !== null) {
    const filterName = String(currentBlockFilter).trim();
    list = list.filter(u => String(u.block).trim() === filterName);
  }

  if (currentStatusFilter === 'debt') {
    list = list.filter(u => Number(u.debt) > 0);
  } else if (currentStatusFilter === 'paid') {
    list = list.filter(u => Number(u.debt) === 0);
  } else if (currentStatusFilter === 'empty') {
    list = list.filter(u => !u.owner?.name);
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
function renderStats() {
  const data = loadData();
  if (!data || !data.building) return { paidUnits: 0, debtUnits: 0, unitsCount: 0 };

  const building = data.building;
  const units = getFilteredUnits();

  const unitsCount = units.length;
  const paidUnits  = units.filter(u => u.debt === 0).length;
  const debtUnits  = units.filter(u => u.debt > 0).length;

  const income = units
    .filter(u => u.debt === 0)
    .reduce((sum, u) => sum + (Number(u.chargeAmount) || 500000), 0);

  const expensesThisMonth = loadExpenses().filter(e =>
    e.month === getTodayPersianMonth()
  );
  const expense = expensesThisMonth.reduce((s, e) => s + (Number(e.amount) || 0), 0);

  const balance = income - expense;

  let blocksCount = 1;
  if (building.type === 'complex') {
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
  if (elBalance) elBalance.textContent = formatToman(balance);

  const paidPercent = unitsCount > 0 ? Math.round((paidUnits / unitsCount) * 100) : 0;
  const elP = document.getElementById('donutPercent');
  if (elP) elP.textContent = formatNumber(paidPercent) + '٪';

  return { paidUnits, debtUnits, unitsCount };
}

/* ============ ۹) جدول داشبورد ============ */
function renderDashboardUnits() {
  const tbody = document.getElementById('dashboardUnitsBody');
  if (!tbody) return;

  const units = getFilteredUnits();

  if (units.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:#94a3b8;padding:30px;">واحدی یافت نشد.</td></tr>`;
    return;
  }

  tbody.innerHTML = units.map(u => {
    const ownerName = u.owner?.name ? u.owner.name : '<span style="color:#94a3b8;">ثبت‌نام نکرده</span>';
    const tenantName = u.tenant?.name ? u.tenant.name : '<span style="color:#94a3b8;">—</span>';
    const ownerPhone = u.owner?.phone || '—';

    return `
      <tr>
        <td><strong>${u.block}</strong></td>
        <td><strong>${formatNumber(u.number)}</strong></td>
        <td>${ownerName}</td>
        <td>${tenantName}</td>
        <td>${ownerPhone}</td>
        <td>${u.debt > 0 ? formatToman(u.debt) : '—'}</td>
        <td>${u.debt > 0 ? '<span class="badge badge-debt">بدهکار</span>' : '<span class="badge badge-paid">تسویه</span>'}</td>
      </tr>
    `;
  }).join('');
}

/* ============ ۱۰) نمودار دایره‌ای داشبورد ============ */
function renderDonutChart(paidUnits, debtUnits) {
  const canvas = document.getElementById('donutChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const size = 180;
  const dpr = window.devicePixelRatio || 1;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  ctx.scale(dpr, dpr);

  const cx = size / 2, cy = size / 2, radius = 70, lineWidth = 18;
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
    ctx.lineCap = 'round';
    ctx.stroke();
  }

  if (debtUnits > 0) {
    ctx.beginPath();
    ctx.arc(cx, cy, radius, -Math.PI / 2 + paidAngle, -Math.PI / 2 + Math.PI * 2);
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    ctx.stroke();
  }
}

/* ============ ۱۱) نمودار خطی ============ */
function renderLineChart() {
  const canvas = document.getElementById('lineChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const rect = canvas.parentElement.getBoundingClientRect();
  const W = rect.width, H = rect.height;
  const dpr = window.devicePixelRatio || 1;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  ctx.scale(dpr, dpr);

  const months = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور'];
  const units = getFilteredUnits();
  const paidUnits = units.filter(u => u.debt === 0);
  const totalPerMonth = paidUnits.reduce((s, u) => s + (u.chargeAmount || 500000), 0);
  const baseValue = totalPerMonth || 500000;

  const values = [
    Math.round(baseValue * 0.7),
    Math.round(baseValue * 0.85),
    Math.round(baseValue * 0.8),
    Math.round(baseValue * 1.05),
    Math.round(baseValue * 0.95),
    Math.round(baseValue * 1.0),
  ];

  const maxVal = Math.max(...values, 1) * 1.15;
  const padding = { top: 20, right: 20, bottom: 40, left: 60 };
  const chartW = W - padding.left - padding.right;
  const chartH = H - padding.top - padding.bottom;

  ctx.strokeStyle = '#f1f5f9';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = padding.top + (chartH / 4) * i;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(padding.left + chartW, y);
    ctx.stroke();
  }

  const points = values.map((v, i) => ({
    x: padding.left + (chartW / (values.length - 1)) * i,
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

/* ============ ۱۲) رندر داشبورد ============ */
function renderDashboard() {
  const data = loadData();
  if (!data || !data.building) return;

  if (UNITS.length === 0) buildDemoUnits(data.building);

  const select = document.getElementById('blockFilter');
  if (select && select.options.length <= 1) {
    buildBlockFilterOptions(data.building);
  }

  const { paidUnits, debtUnits } = renderStats();
  renderDashboardUnits();
  renderDonutChart(paidUnits, debtUnits);
  renderLineChart();
}

/* ============ ۱۳) مودال Wizard ============ */
let wizardStep = 1;
let selectedBuildingType = null;
let blockNames = [];
let selectedPlanType = null;
let wizardAuthData = { name: '', phone: '', password: '' };  // ← این خط جدید
function openWelcomeModal() {
   
  wizardStep = 1;
  selectedBuildingType = null;
  blockNames = [];
  selectedPlanType = null;
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
  if (prev) prev.style.display = wizardStep > 1 ? 'block' : 'none';
  if (next) next.style.display = wizardStep < 4 ? 'block' : 'none';
  if (next) next.textContent = wizardStep < 3 ? 'بعدی ←' : 'ادامه ←';

  // مرحله ۳: نمایش فرم مجتمع یا تک‌بلوک
  if (wizardStep === 3) {
    const cf = document.getElementById('complexForm');
    const sf = document.getElementById('singleForm');
    if (cf) cf.style.display = selectedBuildingType === 'complex' ? 'block' : 'none';
    if (sf) sf.style.display = selectedBuildingType === 'single' ? 'block' : 'none';
    if (selectedBuildingType === 'complex') buildBlockInputs();
  }

  // مرحله ۴: محاسبه قیمت و نمایش
  if (wizardStep === 4) {
    updatePlanPage();
  }
}
/* ✅ محاسبه و نمایش اطلاعات توی مرحله ۴ */
function updatePlanPage() {
  const bn = document.getElementById('buildingNameInput')?.value.trim() || '—';
  
  // محاسبه تعداد کل واحد
  let totalUnits = 0;
  let blocksCount = 1;
  
  if (selectedBuildingType === 'complex') {
    blocksCount = blockNames.length;
    totalUnits = blockNames.reduce((s, b) => s + (parseInt(b.units) || 0), 0);
  } else {
    totalUnits = parseInt(document.getElementById('singleUnitsCount')?.value) || 0;
  }
  
  // نمایش خلاصه
  const elBuilding = document.getElementById('planSummaryBuilding');
  const elUnits = document.getElementById('planSummaryUnits');
  const elBlocks = document.getElementById('planSummaryBlocks');
  
  if (elBuilding) elBuilding.textContent = bn;
  if (elUnits) elUnits.textContent = toPersianNum(totalUnits) + ' واحد';
  if (elBlocks) elBlocks.textContent = selectedBuildingType === 'complex' 
    ? toPersianNum(blocksCount) + ' بلوک' 
    : 'تک‌بلوک';
  
  // محاسبه قیمت (فقط برای نمایش توی کارت حرفه‌ای)
  const result = calculatePrice(totalUnits);
  
  const elProPrice = document.getElementById('planProPrice');
  if (elProPrice) {
    // اگه ساختمان ≤ ۱۰ واحد، قیمت پایه ۱۰ واحد رو نشون بده
    const displayPrice = result.price > 0 ? result.price : (10 * 100000);
    elProPrice.textContent = (displayPrice / 1000000).toFixed(1).replace('.0', '');
  }
  
  // ✅ حذف بخش قیمت پیشنهادی قدیمی
  // دیگه کادر آبی بالای پلن‌ها نمایش داده نمی‌شه
  
  // ذخیره‌ی موقت
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
  // پاک کردن خطاهای قبلی
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

    // نام
    if (!n) {
      showFieldError('managerName', 'لطفاً نام و نام خانوادگی را وارد کنید.');
      return false;
    }

    if (n.length < 3) {
      showFieldError('managerName', 'نام باید حداقل ۳ کاراکتر باشد.');
      return false;
    }

    // شماره موبایل
    if (!p) {
      showFieldError('managerPhone', 'لطفاً شماره تماس را وارد کنید.');
      return false;
    }

    if (!isValidIranMobile(p)) {
      showFieldError('managerPhone', 'شماره موبایل باید ۱۱ رقم و با ۰۹ شروع شود.');
      return false;
    }

    // رمز عبور
    if (!pass) {
      showFieldError('managerPassword', 'لطفاً رمز عبور را وارد کنید.');
      return false;
    }

    if (pass.length < 6) {
      showFieldError('managerPassword', 'رمز عبور باید حداقل ۶ کاراکتر باشد.');
      return false;
    }

    // تکرار رمز
    if (!passConfirm) {
      showFieldError('managerPasswordConfirm', 'لطفاً تکرار رمز عبور را وارد کنید.');
      return false;
    }

    if (pass !== passConfirm) {
      showFieldError('managerPasswordConfirm', 'رمز عبور و تکرار آن یکسان نیستند.');
      return false;
    }

       // ✅ ذخیره موقت نام، موبایل و رمز برای پایان ثبت‌نام
    wizardAuthData = {
      name: n,
      phone: p,
      password: pass
    };

    return true;
  }

  if (step === 2) {
    const bn = document.getElementById('buildingNameInput')?.value.trim();
    if (!bn) {
      toastWarning('نام ساختمان را وارد کنید.');
      return false;
    }
    if (!selectedBuildingType) {
      toastWarning('نوع را انتخاب کنید.');
      return false;
    }
    return true;
  }

  if (step === 3) {
    if (selectedBuildingType === 'complex') {
      const b = parseInt(document.getElementById('blocksCount')?.value);
      if (!b || b < 1) {
        toastWarning('تعداد بلوک‌ها را وارد کنید.');
        return false;
      }
      for (let i = 0; i < blockNames.length; i++) {
        if (!blockNames[i].name || !blockNames[i].name.trim()) {
          toastWarning(`اسم بلوک ${toPersianNum(i + 1)} را وارد کنید.`);
          return false;
        }
      }
    } else {
      const u = parseInt(document.getElementById('singleUnitsCount')?.value);
      if (!u || u < 1) {
        toastWarning('تعداد واحدها را وارد کنید.');
        return false;
      }
    }
    return true;
  }

  return true;
}

/* ✅ نمایش خطا روی فیلد */
function showFieldError(inputId, message) {
  const input = document.getElementById(inputId);
  if (!input) return;

  input.classList.add('input-error');

  // پیدا کردن error-message بعدی
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
  
  // هایلایت کارت انتخاب‌شده
  document.querySelectorAll('.plan-card').forEach(card => {
    card.classList.toggle('selected', card.dataset.plan === planType);
  });
  
  if (planType === 'free') {
    confirmFreePlan();
  } else if (planType === 'pro') {
    confirmProPlan();
  }
}
function confirmFreePlan() {
  const totalUnits = getTotalUnitsFromWizard();
  
  // ⚠️ چک: اگه کاربر پلن رایگان رو با بیش از ۱۰ واحد انتخاب کرد
  if (totalUnits > 10) {
    const confirmMsg = `⚠️ پلن رایگان فقط برای ساختمان‌های تا ۱۰ واحد است.\n\n` +
                       `ساختمان شما ${toPersianNum(totalUnits)} واحد دارد.\n\n` +
                       `آیا با این حال می‌خواهید پلن رایگان را انتخاب کنید؟\n` +
                       `(فقط ۱۰ واحد اول ثبت می‌شوند)`;
    
    if (!confirm(confirmMsg)) {
      return;
    }
  }
  
  // فعال‌سازی پلن رایگان
  activatePlan('free', totalUnits, {
    amount: 0,
    status: 'free',
    paidAt: new Date().toISOString(),
  });
  
  // ذخیره اطلاعات ساختمان
  saveWizardData();
  
  // نمایش صفحه موفقیت
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
  
  // اگه ارتقا از پنل هست، یه مودال جدید بساز
  if (isUpgrade) {
    showMockPaymentModal(paymentInfo);
    return;
  }
  
  // حالت عادی (ثبت‌نام)
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

// لیست صفحات قفل‌شده برای کاربر رایگان
const LOCKED_PAGES_FOR_FREE = [
  'charges-payments',
  'side-incomes',
  'expenses',
  'notices',
  'messages',
  'voting',
  'reports',
  'profit',
];

// چک کن کاربر پلن حرفه‌ای داره یا نه
function isProPlan() {
  const plan = loadPlan();
  if (!plan) return false;
  if (plan.type !== 'pro') return false;
  
  // چک تاریخ انقضا
  if (plan.expiresAt && new Date(plan.expiresAt) < new Date()) {
    return false;
  }
  
  return true;
}

// چک کن یه صفحه قفله یا نه
function isPageLocked(pageKey) {
  if (isProPlan()) return false;
  return LOCKED_PAGES_FOR_FREE.includes(pageKey);
}

/* ✅ به‌روزرسانی ظاهر سایدبار بر اساس پلن */
function updateSidebarLockStates() {
  const isPro = isProPlan();
  
  // آپدیت آیتم‌های منو
  document.querySelectorAll('#menu li[data-page]').forEach(li => {
    const page = li.dataset.page;
    const isLocked = !isPro && LOCKED_PAGES_FOR_FREE.includes(page);
    
    li.classList.toggle('locked', isLocked);
  });
  
  // آپدیت زیرمنو (شارژها و درآمد جانبی)
  document.querySelectorAll('#menu .submenu li').forEach(li => {
    const page = li.dataset.page;
    const isLocked = !isPro && LOCKED_PAGES_FOR_FREE.includes(page);
    
    li.classList.toggle('locked', isLocked);
  });
  
  // آپدیت باکس ارتقا
  const upgradeBox = document.getElementById('upgradeBox');
  if (upgradeBox) {
    upgradeBox.classList.toggle('hidden', isPro);
  }
}

/* ✅ مودال ارتقا (بهبود یافته) */
function showUpgradeModal(pageKey = null) {
  const plan = loadPlan();
  const totalUnits = plan?.totalUnits || 0;
  
  // محاسبه قیمت بر اساس تعداد واحد
  let price = 0;
  let priceBreakdown = '';
  
  if (totalUnits > 0) {
    const result = calculatePrice(totalUnits);
    price = result.price;
    priceBreakdown = result.breakdown;
    
    // اگه ۱۰ واحد یا کمتر بود، قیمت پایه
    if (price === 0) {
      price = 10 * 100000;
      priceBreakdown = `قیمت پایه (${toPersianNum(10)} واحد × ۱۰۰,۰۰۰ تومان)`;
    }
  }
  
  // ساخت مودال
  const modal = document.getElementById('upgradeModal');
  if (modal) {
    // پر کردن اطلاعات
    const elUnits = document.getElementById('upgradeModalUnits');
    const elPrice = document.getElementById('upgradeModalPrice');
    const elBreakdown = document.getElementById('upgradeModalBreakdown');
    
    if (elUnits) elUnits.textContent = toPersianNum(totalUnits) + ' واحد';
    if (elPrice) elPrice.textContent = formatPrice(price);
    if (elBreakdown) elBreakdown.textContent = priceBreakdown;
    
    modal.classList.add('open');
  } else {
    // اگه مودال نبود، ساده بپرس
    const msg = '🔒 این بخش برای پلن حرفه‌ای است.\n\n' +
                'برای دسترسی به همه امکانات، پلن خود را ارتقا دهید.\n\n' +
                (price > 0 ? `💰 قیمت: ${formatPrice(price)}\n\n` : '') +
                'آیا می‌خواهید الان ارتقا دهید؟';
    
    if (confirm(msg)) {
      handleUpgrade();
    }
  }
}

/* ✅ دکمه ارتقا */
function handleUpgrade() {
  const plan = loadPlan();
  const totalUnits = plan?.totalUnits || 0;
  
  let price = 0;
  
  if (totalUnits > 0) {
    const result = calculatePrice(totalUnits);
    price = result.price;
    
    if (price === 0) {
      price = 10 * 100000;
    }
  }
  
  // ساخت درخواست پرداخت
  const paymentInfo = {
    planType: 'pro',
    totalUnits: totalUnits,
    amount: price,
    orderId: 'UPG-' + Date.now(),
    isUpgrade: true, // این ارتقا از پنل هست
  };
  
  // بستن مودال اگه بازه
  closeUpgradeModal();
  
  // رفتن به صفحه پرداخت
  showMockPaymentPage(paymentInfo);
}

/* ✅ مودال پرداخت آزمایشی (برای حالت ارتقا) */
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
    // بازگشت به مودال ارتقا
    container.innerHTML = originalHTML;
    bindUpgradeModal();
  });
  
  document.getElementById('mockUpgradePayBtn')?.addEventListener('click', () => {
    processMockPaymentSuccess(paymentInfo);
    closeUpgradeModal();
  });
}

function confirmProPlan() {
  const totalUnits = getTotalUnitsFromWizard();
  const result = calculatePrice(totalUnits);
  
  // ⚠️ نکته: حتی اگه ساختمان ≤ ۱۰ واحد باشه،
  // کاربر می‌تونه پلن حرفه‌ای رو انتخاب کنه
  // فقط اگه قیمت صفر شد، یه قیمت پایه در نظر بگیر
  
  let finalPrice = result.price;
  
  if (finalPrice === 0) {
    // کاربر با ۱۰ واحد داره پلن حرفه‌ای می‌خره
    // یه قیمت پایه براش حساب کن (۱۰ واحد × ۱۰۰K = ۱,۰۰۰,۰۰۰)
    finalPrice = 10 * 100000;
    
    if (!confirm(
      `💎 پلن حرفه‌ای\n\n` +
      `ساختمان شما ${toPersianNum(totalUnits)} واحد دارد.\n` +
      `(پلن رایگان برای این ساختمان کافی است)\n\n` +
      `💰 قیمت پلن حرفه‌ای: ${formatPrice(finalPrice)}\n\n` +
      `آیا می‌خواهید پلن حرفه‌ای را خریداری کنید؟`
    )) {
      return;
    }
  }
  
  // ذخیره اطلاعات توی یه متغیر موقت
  window._pendingPayment = {
    planType: 'pro',
    totalUnits: totalUnits,
    amount: finalPrice,
    orderId: 'ORD-' + Date.now(),
  };
  
  // رفتن به صفحه پرداخت
  showMockPaymentPage(window._pendingPayment);
}
/* ✅ گرفتن تعداد واحد از ویزارد */
function getTotalUnitsFromWizard() {
  if (selectedBuildingType === 'complex') {
    return blockNames.reduce((s, b) => s + (parseInt(b.units) || 0), 0);
  }
  return parseInt(document.getElementById('singleUnitsCount')?.value) || 0;
}

/* ✅ ذخیره اطلاعات ویزارد توی localStorage */
function saveWizardData() {
  const mn = wizardAuthData.name || document.getElementById('managerName')?.value.trim() || '';
  const mp = wizardAuthData.phone || document.getElementById('managerPhone')?.value.trim() || '';
  const password = wizardAuthData.password || document.getElementById('managerPassword')?.value || '';
  const bn = document.getElementById('buildingNameInput')?.value.trim();

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
    totalUnits = parseInt(document.getElementById('singleUnitsCount')?.value) || 0;
  }

  const code = generateBuildingCode(selectedBuildingType, totalUnits);

  const building = {
    name: bn,
    type: selectedBuildingType,
    code: code,
    blocks: blocks,
    totalUnits: totalUnits,
    createdAt: new Date().toISOString(),
  };

  currentBlockFilter = 'all';
  currentStatusFilter = 'all';
  saveData({ building, manager: { name: mn, phone: mp } });

  if (typeof saveUserAuth === 'function' && mp && password) {
    saveUserAuth(mp, password);
  }

  localStorage.removeItem('ham_sakhteman_logged_out');

  UNITS = [];
  saveUnits();

  renderBuildingCard();
  buildBlockFilterOptions(building);
  buildDemoUnits(building);
}

/* ✅ بایند دکمه‌های انتخاب پلن */
function bindPlanSelection() {
  document.querySelectorAll('[data-plan-select]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const planType = btn.dataset.planSelect;
      selectPlan(planType);
    });
  });
  
  // کلیک روی خود کارت هم پلن رو انتخاب کنه
  document.querySelectorAll('.plan-card').forEach(card => {
    card.addEventListener('click', () => {
      selectPlan(card.dataset.plan);
    });
  });
  
  // دکمه قبلی مرحله ۴
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
  
  // پاک کردن محتوای قبلی (به جز دکمه‌ها)
  container.innerHTML = `
    <div class="success-box">
      <div class="success-icon">🎉</div>
      <h2>تبریک! ساختمان شما با موفقیت ثبت شد</h2>
      <p>اکنون می‌توانید وارد پنل مدیریت شوید.</p>
      
      <div class="success-info">
        <div class="success-info-row">
          <span>🏢 ساختمان:</span>
          <strong>${document.getElementById('buildingNameInput')?.value || '—'}</strong>
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
  
  // بایند دکمه ورود
  document.getElementById('btnEnterPanel')?.addEventListener('click', () => {
    // پاک کردن URL parameters
    window.history.replaceState({}, document.title, window.location.pathname);

    // بستن مودال
    closeWelcomeModal();

    // رندر پنل بدون رفرش
    renderBuildingCard();
    const d = loadData();
    if (d?.building) {
      buildBlockFilterOptions(d.building);
      if (UNITS.length === 0) buildDemoUnits(d.building);
    }
    renderDashboard();
    updateSidebarLockStates();

    // رفرش ملایم برای پاک کردن پارامترها
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

  // ✅ دکمه نمایش/مخفی رمز در ویزارد ثبت‌نام
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

  // ✅ بایند انتخاب پلن
  bindPlanSelection();
}

/* ============ ۱۴) صفحه واحدها ============ */
let unitsPageFilter = 'all';
let unitsSortColumn = null;
let unitsSortDirection = 'asc';
let unitsSearchQuery = '';

function getUnitsPageFiltered() {
  let list = UNITS;

  if (unitsPageFilter !== 'all' && unitsPageFilter !== '') {
    const filterName = String(unitsPageFilter).trim();
    list = list.filter(u => String(u.block).trim() === filterName);
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
        case 'debt':
          valA = Number(a.debt) || 0;
          valB = Number(b.debt) || 0;
          break;
        case 'status':
          valA = a.debt > 0 ? 1 : 0;
          valB = b.debt > 0 ? 1 : 0;
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
  // اگر فیلتر بلوک فعال است، فقط همان بلوک را حساب کن
  const allUnits = getUnitsPageFiltered(); // یا UNITS اگر همیشه کل را می‌خواهید

  const total = allUnits.length;
  const empty = allUnits.filter(u => !u.owner?.name).length;
  const registered = allUnits.filter(u => u.owner?.name);
  const paid = registered.filter(u => u.debt === 0).length;
  const debt = registered.filter(u => u.debt > 0).length;
  const totalDebt = allUnits.reduce((sum, u) => sum + (Number(u.debt) || 0), 0);

  const elTotal = document.getElementById('unitsTotal');
  const elPaid  = document.getElementById('unitsPaid');
  const elDebt  = document.getElementById('unitsDebt');
  const elEmpty = document.getElementById('unitsEmpty');
  const elTotalDebt = document.getElementById('unitsTotalDebt');

  if (elTotal) elTotal.textContent = formatNumber(total);
  if (elPaid)  elPaid.textContent  = formatNumber(paid);
  if (elDebt)  elDebt.textContent  = formatNumber(debt);
  if (elEmpty) elEmpty.textContent = formatNumber(empty);
  if (elTotalDebt) elTotalDebt.textContent = formatToman(totalDebt);
}

function renderUnitsPage() {
  const tbody = document.getElementById('unitsTableBody');
  const countLabel = document.getElementById('unitsCountLabel');
  if (!tbody) return;

  const units = getUnitsPageFiltered();

  if (countLabel) {
    countLabel.textContent = `${formatNumber(units.length)} واحد`;
  }

  if (units.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align:center;color:#94a3b8;padding:40px;">
          واحدی یافت نشد.
        </td>
      </tr>`;
    return;
  }

  tbody.innerHTML = units.map(u => {
    const ownerName = u.owner?.name
      ? u.owner.name
      : '<span style="color:#94a3b8;">ثبت‌نام نکرده</span>';

    const tenantName = u.tenant?.name
      ? u.tenant.name
      : '<span style="color:#94a3b8;">—</span>';

    const ownerPhone = u.owner?.phone || '—';

    return `
      <tr data-unit-id="${u.id}">
        <td><strong>${u.block}</strong></td>
        <td><strong>${formatNumber(u.number)}</strong></td>
        <td>${ownerName}</td>
        <td>${tenantName}</td>
        <td>${ownerPhone}</td>
        <td>${u.debt > 0 ? formatToman(u.debt) : '—'}</td>
        <td>${u.debt > 0
              ? '<span class="badge badge-debt">بدهکار</span>'
              : '<span class="badge badge-paid">تسویه</span>'}</td>
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
    tbody.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;

      const action = btn.dataset.action;
      const id = Number(btn.dataset.id);

      if (action === 'view') {
        openUnitDetail(id);
      } else if (action === 'delete') {
        if (confirm('⚠️ آیا از حذف این واحد مطمئن هستید؟\n\nاین عمل قابل بازگشت نیست.')) {
          UNITS = UNITS.filter(u => u.id !== id);
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
  currentEditUnitId = unitId;

  const modal = document.getElementById('unitModal');
  const title = document.getElementById('unitModalTitle');
  const subtitle = document.getElementById('unitModalSubtitle');

  document.querySelectorAll('.form-input').forEach(el => {
    el.classList.remove('input-error', 'input-success');
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

  if (unitId) {
    const unit = UNITS.find(u => u.id === unitId);
    if (!unit) return;

    if (title) title.textContent = 'ویرایش واحد';
    if (subtitle) subtitle.textContent = `ویرایش واحد ${unit.code || ''}`;

    document.getElementById('unitBlock').value = unit.block || '';
    document.getElementById('unitNumber').value = unit.number || '';
    document.getElementById('ownerName').value = unit.owner?.name || '';
    document.getElementById('ownerPhone').value = unit.owner?.phone || '';
    document.getElementById('tenantName').value = unit.tenant?.name || '';
    document.getElementById('tenantPhone').value = unit.tenant?.phone || '';
    document.getElementById('unitCharge').value = unit.chargeAmount || 500000;
    document.getElementById('unitDebt').value = unit.debt || 0;
  } else {
    if (title) title.textContent = 'افزودن واحد جدید';
    if (subtitle) subtitle.textContent = 'اطلاعات واحد را وارد کنید';

    document.getElementById('unitBlock').value = '';
    document.getElementById('unitNumber').value = '';
    document.getElementById('ownerName').value = '';
    document.getElementById('ownerPhone').value = '';
    document.getElementById('tenantName').value = '';
    document.getElementById('tenantPhone').value = '';
    document.getElementById('unitCharge').value = 500000;
    document.getElementById('unitDebt').value = 0;
  }

  modal.classList.add('open');
}

function closeUnitModal() {
  document.getElementById('unitModal').classList.remove('open');
  currentEditUnitId = null;
}

function saveUnit() {
  const block = document.getElementById('unitBlock').value.trim();
  const number = parseInt(document.getElementById('unitNumber').value);
  const ownerName = document.getElementById('ownerName').value.trim();
  const ownerPhone = document.getElementById('ownerPhone').value.trim();
  const tenantName = document.getElementById('tenantName').value.trim();
  const tenantPhone = document.getElementById('tenantPhone').value.trim();
  const charge = parseInt(document.getElementById('unitCharge').value) || 500000;
  const debt = parseInt(document.getElementById('unitDebt').value) || 0;

  if (!block) { toastWarning('لطفاً بلوک را انتخاب کنید.'); return; }
  if (!number || number < 1) { toastWarning('لطفاً شماره واحد را وارد کنید.'); return; }

  if (ownerPhone && !isValidIranMobile(ownerPhone)) {
    showInputError(document.getElementById('ownerPhone'), 'شماره موبایل باید ۱۱ رقم و با ۰۹ شروع شود');
    toastWarning('شماره موبایل مالک اشتباه است.');
    return;
  }

  if (tenantPhone && !isValidIranMobile(tenantPhone)) {
    showInputError(document.getElementById('tenantPhone'), 'شماره موبایل باید ۱۱ رقم و با ۰۹ شروع شود');
    toastWarning('شماره موبایل مستاجر اشتباه است.');
    return;
  }

  const duplicate = UNITS.find(u =>
    u.block === block && u.number === number && u.id !== currentEditUnitId
  );

  if (duplicate) {
    toastWarning(`واحد ${number} در بلوک ${block} قبلاً ثبت شده است.`);
    return;
  }

  const code = `${block}-${toPersianNum(number)}`;

  if (currentEditUnitId) {
    const unit = UNITS.find(u => u.id === currentEditUnitId);
    if (unit) {
      unit.block = block;
      unit.number = number;
      unit.code = code;
      unit.owner = {
        name: ownerName || null, phone: ownerPhone || null,
        registered: !!ownerName, approved: !!ownerName,
      };
      unit.tenant = {
        name: tenantName || null, phone: tenantPhone || null,
        registered: !!tenantName, approved: !!tenantName,
      };
      unit.chargeAmount = charge;
      unit.debt = debt;
    }
  } else {
    const newId = UNITS.length > 0 ? Math.max(...UNITS.map(u => u.id)) + 1 : 1;
    UNITS.push({
      id: newId, block: block, number: number, code: code,
      owner: {
        name: ownerName || null, phone: ownerPhone || null,
        registered: !!ownerName, approved: !!ownerName,
      },
      tenant: {
        name: tenantName || null, phone: tenantPhone || null,
        registered: !!tenantName, approved: !!tenantName,
      },
      chargeAmount: charge, debt: debt,
    });
  }

  saveUnits();
  closeUnitModal();
  renderUnitsStats();
  renderUnitsPage();
  renderDashboard();

  if (currentEditUnitId) {
  toastSuccess('واحد ویرایش شد.');
} else {
  toastSuccess('واحد جدید اضافه شد.');
}
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
            <th>مالک</th>
            <th>موبایل مالک</th>
            <th>مستاجر</th>
            <th>موبایل مستاجر</th>
            <th>شارژ ماهانه</th>
            <th>بدهی</th>
            <th>وضعیت</th>
          </tr>
        </thead>
        <tbody>
  `;

  units.forEach((u, idx) => {
    const ownerName = u.owner?.name || '—';
    const ownerPhone = u.owner?.phone || '—';
    const tenantName = u.tenant?.name || '—';
    const tenantPhone = u.tenant?.phone || '—';
    const charge = Number(u.chargeAmount || 0).toLocaleString('en-US');
    const debt = Number(u.debt || 0).toLocaleString('en-US');
    const status = u.debt > 0 ? 'بدهکار' : 'تسویه';

    html += `
      <tr>
        <td>${idx + 1}</td>
        <td>${u.block || '—'}</td>
        <td>${u.number || '—'}</td>
        <td>${ownerName}</td>
        <td>${ownerPhone}</td>
        <td>${tenantName}</td>
        <td>${tenantPhone}</td>
        <td>${charge}</td>
        <td>${debt}</td>
        <td>${status}</td>
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
    const status = debt > 0 ? 'بدهکار' : 'تسویه';

    rows += `
      <tr>
        <td>${idx + 1}</td>
        <td>${u.block || '—'}</td>
        <td>${u.number || '—'}</td>
        <td>${ownerName}</td>
        <td>${ownerPhone}</td>
        <td>${tenantName}</td>
        <td>${debtStr}</td>
        <td>${status}</td>
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
            <th>موبایل</th><th>مستاجر</th><th>بدهی</th><th>وضعیت</th>
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

  const btnSave = document.getElementById('unitSaveBtn');
  if (btnSave) btnSave.onclick = saveUnit;

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

/* ============================================================
   مودال جزئیات واحد
   ============================================================ */
let currentDetailUnitId = null;

function openUnitDetail(unitId) {
  const unit = UNITS.find(u => u.id === unitId);
  if (!unit) return;

  currentDetailUnitId = unitId;

  const title = document.getElementById('detailUnitTitle');
  const subtitle = document.getElementById('detailUnitSubtitle');
  if (title) title.textContent = `جزئیات واحد ${unit.block}-${toPersianNum(unit.number)}`;
  if (subtitle) subtitle.textContent = `کد: ${unit.code || '—'}`;

  const elBlock = document.getElementById('detailBlock');
  const elNumber = document.getElementById('detailNumber');
  const elCharge = document.getElementById('detailCharge');
  const elDebt = document.getElementById('detailDebt');

  if (elBlock) elBlock.textContent = unit.block || '—';
  if (elNumber) elNumber.textContent = toPersianNum(unit.number) || '—';
  if (elCharge) elCharge.textContent = formatToman(unit.chargeAmount || 500000);
  if (elDebt) elDebt.textContent = unit.debt > 0 ? formatToman(unit.debt) : '—';

  const ownerStatus = document.getElementById('detailOwnerStatus');
  const ownerName = document.getElementById('detailOwnerName');
  const ownerPhone = document.getElementById('detailOwnerPhone');

  if (unit.owner?.name) {
    if (ownerStatus) {
      ownerStatus.textContent = 'ثبت‌نام کرده';
      ownerStatus.className = 'detail-status active';
    }
    if (ownerName) ownerName.textContent = unit.owner.name;
    if (ownerPhone) ownerPhone.textContent = unit.owner.phone || '—';
  } else {
    if (ownerStatus) {
      ownerStatus.textContent = 'ثبت‌نام نکرده';
      ownerStatus.className = 'detail-status none';
    }
    if (ownerName) ownerName.textContent = '—';
    if (ownerPhone) ownerPhone.textContent = '—';
  }

  const tenantStatus = document.getElementById('detailTenantStatus');
  const tenantName = document.getElementById('detailTenantName');
  const tenantPhone = document.getElementById('detailTenantPhone');

  if (unit.tenant?.name) {
    if (tenantStatus) {
      tenantStatus.textContent = 'دارد';
      tenantStatus.className = 'detail-status active';
    }
    if (tenantName) tenantName.textContent = unit.tenant.name;
    if (tenantPhone) tenantPhone.textContent = unit.tenant.phone || '—';
  } else {
    if (tenantStatus) {
      tenantStatus.textContent = 'ندارد';
      tenantStatus.className = 'detail-status none';
    }
    if (tenantName) tenantName.textContent = '—';
    if (tenantPhone) tenantPhone.textContent = '—';
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
  return 'ham_sakhteman_charges';
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
  return charges.filter(c => c.month === month && c.year === String(year));
}

/* ============================================================
   صفحه شارژ — اصلاح‌شده ✅
   ============================================================ */
let currentChargeMonth = getTodayPersianMonth();
let currentChargeYear = String(getTodayPersianYear()); // عدد انگلیسی

function renderChargesPage() {
  // ✅ اول دراپ‌داون‌ها رو پر کن
  fillYearMonthDropdowns('chargeYear', 'chargeMonth');

  // ✅ حالا مقدار پیش‌فرض
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

  const expenseSum = charges.reduce((s, c) => s + (Number(c.extra) || 0), 0);
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

  renderChargesTable(charges);
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
    const unit = UNITS.find(u => u.id === c.unitId);
    const blockName = unit?.block || '—';
    const unitNumber = unit ? toPersianNum(unit.number) : '—';
    const ownerName = unit?.owner?.name || '<span style="color:#94a3b8;">ثبت‌نام نکرده</span>';

    let payMethodBadge = '<span style="color:#94a3b8;">—</span>';
    if (c.paid && c.payMethod) {
      const methodIcons = {
        'نقدی': '💵',
        'کارت به کارت': '💳',
        'انتقال بانکی': '🏦',
        'آنلاین': '🌐',
        'چک': '📝',
      };
      const icon = methodIcons[c.payMethod] || '💰';
      payMethodBadge = `<span class="badge badge-paid">${icon} ${c.payMethod}</span>`;
    } else if (c.paid) {
      payMethodBadge = '<span class="badge badge-paid">💰 نامشخص</span>';
    }

    return `
      <tr class="charge-row">
        <td><strong>${blockName}</strong></td>
        <td><strong>${unitNumber}</strong></td>
        <td>${ownerName}</td>
        <td>${formatToman(c.amount || 0)}</td>
        <td>${c.extra > 0 ? formatToman(c.extra) : '—'}</td>
        <td><strong>${formatToman(c.total || 0)}</strong></td>
        <td>${c.paid
              ? '<span class="badge badge-paid">✅ پرداخت شده</span>'
              : '<span class="badge badge-debt">⚠️ پرداخت نشده</span>'}</td>
        <td>${payMethodBadge}</td>
        <td>
          <button class="row-action-btn" data-charge-id="${c.id}" title="${c.paid ? 'مدیریت پرداخت' : 'ثبت پرداخت'}">💳</button>
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
  if (tbody) {
    tbody.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-charge-id]');
      if (!btn) return;
      const chargeId = Number(btn.dataset.chargeId);
      openPayChargeModal(chargeId);
    });
  }
}

/* ============================================================
   صدور شارژ
   ============================================================ */
function openIssueChargeModal() {
  const modal = document.getElementById('issueChargeModal');

  // ✅ پر کردن سال و ماه
  fillYearMonthDropdowns('issueYear', 'issueMonth');

  // ✅ تنظیم مقدار پیش‌فرض
  const issueMonth = document.getElementById('issueMonth');
  const issueYear = document.getElementById('issueYear');
  if (issueMonth) issueMonth.value = currentChargeMonth;
  if (issueYear) issueYear.value = currentChargeYear;

  // پر کردن لیست بلوک
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

  const blockSection = document.getElementById('issueBlockSection');
  if (blockSection) {
    if (data?.building?.type === 'complex') {
      blockSection.style.display = 'block';
    } else {
      blockSection.style.display = 'none';
    }
  }

  const baseCharge = document.getElementById('issueBaseCharge');
  const extra = document.getElementById('issueExtra');
  const dueDate = document.getElementById('issueDueDate');
  const description = document.getElementById('issueDescription');

  if (baseCharge) baseCharge.value = 500000;
  if (extra) extra.value = 0;
  if (dueDate) dueDate.value = '';
  if (description) description.value = '';

  updateIssuePreview();
  modal.classList.add('open');
}

function closeIssueChargeModal() {
  document.getElementById('issueChargeModal').classList.remove('open');
}

function updateIssuePreview() {
  const data = loadData();
  if (!data?.building) return;

  const blockFilter = document.getElementById('issueBlockSelect')?.value || 'all';
  const baseCharge = parseInt(document.getElementById('issueBaseCharge')?.value) || 0;
  const extra = parseInt(document.getElementById('issueExtra')?.value) || 0;

  let units = UNITS;
  if (blockFilter !== 'all') {
    units = units.filter(u => String(u.block).trim() === String(blockFilter).trim());
  }

  const count = units.length;
  const total = count * (baseCharge + extra);

  const elCount = document.getElementById('issueUnitCount');
  const elTotal = document.getElementById('issueTotalAmount');

  if (elCount) elCount.textContent = formatNumber(count);
  if (elTotal) elTotal.textContent = formatToman(total);
}

function issueChargeConfirm() {
  const month = document.getElementById('issueMonth')?.value;
  const year = document.getElementById('issueYear')?.value;
  const baseCharge = parseInt(document.getElementById('issueBaseCharge')?.value) || 0;
  const extra = parseInt(document.getElementById('issueExtra')?.value) || 0;
  const blockFilter = document.getElementById('issueBlockSelect')?.value || 'all';
  const dueDate = document.getElementById('issueDueDate')?.value || '';
  const description = document.getElementById('issueDescription')?.value || '';

  if (!month || !year) {
    toastWarning('لطفاً ماه و سال را انتخاب کنید.');
    return;
  }

  if (!baseCharge || baseCharge < 0) {
    toastWarning('لطفاً مبلغ شارژ پایه را وارد کنید.');
    return;
  }

  let units = UNITS;
  if (blockFilter !== 'all') {
    units = units.filter(u => String(u.block).trim() === String(blockFilter).trim());
  }

  if (units.length === 0) {
    toastWarning('واحدی برای صدور شارژ وجود ندارد.');
    return;
  }

  let charges = loadCharges();

  let existing;
  if (blockFilter === 'all') {
    existing = charges.filter(c => c.month === month && c.year === year);
  } else {
    existing = charges.filter(c =>
      c.month === month &&
      c.year === year &&
      String(c.block).trim() === String(blockFilter).trim()
    );
  }

  if (existing.length > 0) {
    const msg = blockFilter === 'all'
      ? `⚠️ برای ${month} ${toPersianNum(year)} قبلاً شارژ صادر شده است.\n\nآیا مطمئن هستید؟`
      : `⚠️ برای بلوک ${blockFilter} در ${month} ${toPersianNum(year)} قبلاً شارژ صادر شده است.\n\nآیا مطمئن هستید؟`;

    if (!confirm(msg)) return;

    if (blockFilter === 'all') {
      charges = charges.filter(c => !(c.month === month && c.year === year));
    } else {
      charges = charges.filter(c => !(
        c.month === month &&
        c.year === year &&
        String(c.block).trim() === String(blockFilter).trim()
      ));
    }
  }

  let lastId = charges.length > 0 ? Math.max(...charges.map(c => c.id || 0)) : 0;

  const newCharges = units.map(u => {
    const unitExtra = extra || 0;
    const total = baseCharge + unitExtra;

    return {
      id: ++lastId,
      month: month,
      year: year,
      unitId: u.id,
      block: u.block,
      amount: baseCharge,
      extra: unitExtra,
      total: total,
      paid: false,
      paidDate: null,
      dueDate: dueDate,
      description: description,
      issuedAt: new Date().toISOString(),
    };
  });

  charges = charges.concat(newCharges);
  saveCharges(charges);

  updateUnitsDebtFromCharges();

  closeIssueChargeModal();

  currentChargeMonth = month;
  currentChargeYear = year;
  renderChargesPage();

  const msg = blockFilter === 'all'
    ? `شارژ ${month} ${toPersianNum(year)} برای ${units.length} واحد صادر شد.`
    : `شارژ بلوک ${blockFilter} برای ${month} ${toPersianNum(year)} (${units.length} واحد) صادر شد.`;

  toastSuccess(msg);
}

function updateUnitsDebtFromCharges() {
  const charges = loadCharges();

  UNITS.forEach(unit => {
    const unpaid = charges.filter(c =>
      c.unitId === unit.id && !c.paid
    );
    const totalDebt = unpaid.reduce((s, c) => s + (Number(c.total) || 0), 0);
    unit.debt = totalDebt;
  });

  saveUnits();
}

function bindIssueChargeModal() {
  document.getElementById('btnIssueCharge')?.addEventListener('click', openIssueChargeModal);
  document.getElementById('issueCancelBtn')?.addEventListener('click', closeIssueChargeModal);
  document.getElementById('issueConfirmBtn')?.addEventListener('click', issueChargeConfirm);

  ['issueMonth', 'issueYear', 'issueBaseCharge', 'issueExtra', 'issueBlockSelect'].forEach(id => {
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

  const today = new Date().toLocaleDateString('fa-IR');
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

function confirmPayCharge() {
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
    if (!confirm('⚠️ آیا از لغو پرداخت این شارژ مطمئن هستید؟')) return;

    charge.paid = false;
    charge.paidDate = null;
    charge.payMethod = null;
    charge.payDescription = null;
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

  charge.paid = true;
  charge.paidDate = payDate;
  charge.payMethod = payMethod;
  charge.payDescription = payDescription;
  charge.paidAt = new Date().toISOString();

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

function getPaidCharges() {
  const charges = loadCharges();
  return charges.filter(c => c.paid === true);
}

function getFilteredPayments() {
  let list = getPaidCharges();

  if (paymentsMonthFilter !== 'all') {
    list = list.filter(c => c.month === paymentsMonthFilter);
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
          valA = a.paidDate || '';
          valB = b.paidDate || '';
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
  const thisMonth = allPaid.filter(c =>
    c.month === currentChargeMonth && c.year === currentChargeYear
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
/* ============================================================
   🕐 سانس‌های پیش‌فرض درآمد جانبی
   ============================================================ */
const SIDE_INCOME_SESSIONS = {
  'اجاره سالن': [
    'سانس صبح (۸-۱۲)',
    'سانس عصر (۱۴-۱۸)',
    'سانس شب (۱۹-۲۳)',
  ],
  'اجاره استخر': [
    'سانس آقایان',
    'سانس بانوان',
    'سانس کودک',
  ],
  'اجاره باشگاه': [
    'سانس صبح',
    'سانس عصر',
    'سانس شب',
  ],
  'اجاره سالن ورزش': [
    'سانس صبح',
    'سانس عصر',
    'سانس شب',
  ],
  'اجاره مغازه': [
    'ماهانه',
    'سالانه',
  ],
  'اجاره پارکینگ': [
    'ماهانه',
    'سالانه',
  ],
  'اجاره آنتن': [
    'ماهانه',
    'سالانه',
  ],
  'سایر': [
    'سانس صبح',
    'سانس عصر',
    'سانس شب',
    'تمام روز',
  ],
};

function getSessionsForCategory(category) {
  return SIDE_INCOME_SESSIONS[category] || SIDE_INCOME_SESSIONS['سایر'];
}
function getSideIncomesKey() {
  return 'ham_sakhteman_side_incomes';
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
        <td colspan="9" style="text-align:center;color:#94a3b8;padding:40px;">
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
  const title = document.getElementById('sideIncomeModalTitle');
  const subtitle = document.getElementById('sideIncomeModalSubtitle');

  // پر کردن دراپ‌داون ماه و سال
  fillYearMonthDropdowns('sideIncomeModalYear', 'sideIncomeModalMonth');

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
    if (data?.building?.type === 'complex') {
      blockSection.style.display = 'block';
    } else {
      blockSection.style.display = 'none';
    }
  }

  const sessionSelect = document.getElementById('sideIncomeSessionSelect');
  const sessionCustom = document.getElementById('sideIncomeSessionCustom');
  const categorySelect = document.getElementById('sideIncomeCategory');

  // تابع کمکی برای پر کردن لیست سانس‌ها
  function fillSessions(category, selectedValue = '') {
    const sessions = getSessionsForCategory(category);
    if (!sessionSelect) return;

    sessionSelect.innerHTML = '<option value="">— بدون سانس —</option>';
    sessions.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s;
      opt.textContent = s;
      sessionSelect.appendChild(opt);
    });

    // گزینه متن دلخواه
    const customOpt = document.createElement('option');
    customOpt.value = '__custom__';
    customOpt.textContent = '✏️ متن دلخواه';
    sessionSelect.appendChild(customOpt);

    // انتخاب مقدار
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

    // پر کردن سانس‌ها بر اساس دسته
    fillSessions(income.category, income.session || '');
  } else {
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

    // پر کردن سانس‌ها برای دسته پیش‌فرض
    fillSessions('اجاره مغازه', '');
  }

  // ✅ وقتی دسته عوض شد، سانس‌ها رو عوض کن
  if (categorySelect) {
    categorySelect.onchange = () => {
      fillSessions(categorySelect.value, '');
    };
  }

  // ✅ وقتی سانس عوض شد، اگه «متن دلخواه» بود، input رو نشون بده
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

  // ✅ خواندن سانس
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

  if (!title) {
    toastWarning('لطفاً عنوان درآمد را وارد کنید.');
    return;
  }

  if (!amount || amount < 1) {
    toastWarning('لطفاً مبلغ درآمد را وارد کنید.');
    return;
  }

  if (!month || !year) {
    toastWarning('لطفاً ماه و سال را انتخاب کنید.');
    return;
  }

  let incomes = loadSideIncomes();

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
      income.session = session;  // ✅
    }
  } else {
    const newId = incomes.length > 0 ? Math.max(...incomes.map(i => i.id || 0)) + 1 : 1;
    incomes.push({
      id: newId,
      title: title,
      category: category,
      amount: amount,
      date: date,
      month: month,
      year: year,
      payer: payer,
      method: method,
      description: description,
      block: block,
      session: session,  // ✅
      createdAt: new Date().toISOString(),
    });
  }

  saveSideIncomes(incomes);
  closeSideIncomeModal();
  renderSideIncomesPage();

  if (currentEditSideIncomeId) {
    toastSuccess('درآمد ویرایش شد.');
  } else {
    toastSuccess('درآمد جدید ثبت شد.');
  }
}

function deleteSideIncome(incomeId) {
  if (!confirm('⚠️ آیا از حذف این درآمد مطمئن هستید؟')) return;

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
  // فیلتر بلوک
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

  // ✅ فیلتر سانس
  const sessionFilter = document.getElementById('sideIncomeSessionFilter');
  if (sessionFilter) {
    // گرفتن همه سانس‌های استفاده‌شده
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

  // فیلتر ماه
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

  // فیلتر سال
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

  // دکمه افزودن
  const btnAdd = document.getElementById('btnAddSideIncome');
  if (btnAdd) btnAdd.onclick = () => openSideIncomeModal(null);

  // خروجی اکسل
  const btnExport = document.getElementById('btnExportSideIncomes');
  if (btnExport) btnExport.onclick = exportSideIncomesToExcel;

  // دکمه‌های مودال
  const btnCancel = document.getElementById('sideIncomeCancelBtn');
  if (btnCancel) btnCancel.onclick = closeSideIncomeModal;

  const btnSave = document.getElementById('sideIncomeSaveBtn');
  if (btnSave) btnSave.onclick = saveSideIncome;

  // جدول
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

  // بستن مودال
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
    const unit = UNITS.find(u => u.id === c.unitId);
    const blockName = unit?.block || '—';
    const unitNumber = unit ? toPersianNum(unit.number) : '—';
    const ownerName = unit?.owner?.name || '<span style="color:#94a3b8;">ثبت‌نام نکرده</span>';
    const payDate = c.paidDate || '—';
    const payMethod = c.payMethod || '—';
    const description = c.payDescription || '—';

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

function cancelPayment(chargeId) {
  if (!confirm('⚠️ آیا از لغو این پرداخت مطمئن هستید؟')) return;

  const charges = loadCharges();
  const charge = charges.find(c => c.id === chargeId);
  if (!charge) return;

  charge.paid = false;
  charge.paidDate = null;
  charge.payMethod = null;
  charge.payDescription = null;

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

  const today = new Date().toLocaleDateString('fa-IR');
  document.getElementById('newPayDate').value = today;

  modal.classList.add('open');
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
    const unitLabel = `${u.block}-${toPersianNum(u.number)}`;

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
      const total = Number(e.target.dataset.total);

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

function confirmNewPayment() {
  const payDate = document.getElementById('newPayDate')?.value.trim();
  const payMethod = document.getElementById('newPayMethod')?.value || 'نقدی';
  const payDescription = document.getElementById('newPayDescription')?.value.trim() || '';

  if (newPaySelectedCharges.length === 0) {
    toastWarning('لطفاً حداقل یک واحد را انتخاب کنید.');
    return;
  }

  if (!payDate) {
    toastWarning('لطفاً تاریخ پرداخت را وارد کنید.');
    return;
  }

  const count = newPaySelectedCharges.length;
  if (!confirm(`آیا از ثبت پرداخت برای ${count} مورد مطمئن هستید؟`)) {
    return;
  }

  const charges = loadCharges();
  let successCount = 0;

  newPaySelectedCharges.forEach(item => {
    const charge = charges.find(c => c.id === item.chargeId);
    if (charge && !charge.paid) {
      charge.paid = true;
      charge.paidDate = payDate;
      charge.payMethod = payMethod;
      charge.payDescription = payDescription;
      charge.paidAt = new Date().toISOString();
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
  const btnAdd = document.getElementById('btnAddPayment');
  if (btnAdd) btnAdd.onclick = openIssueChargeModal;

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
  return 'ham_sakhteman_expenses';
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
    if (data?.building?.type === 'complex') {
      blockSection.style.display = 'block';
    } else {
      blockSection.style.display = 'none';
    }
  }

  // پر کردن سال و ماه
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

  if (!title) {
    toastWarning('لطفاً عنوان هزینه را وارد کنید.');
    return;
  }

  if (!amount || amount < 1) {
    toastWarning('لطفاً مبلغ هزینه را وارد کنید.');
    return;
  }

  if (!month || !year) {
    toastWarning('لطفاً ماه و سال را انتخاب کنید.');
    return;
  }

  let expenses = loadExpenses();

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
    const newId = expenses.length > 0 ? Math.max(...expenses.map(e => e.id || 0)) + 1 : 1;
    expenses.push({
      id: newId,
      title: title,
      category: category,
      amount: amount,
      date: date,
      month: month,
      year: year,
      block: block,
      description: description,
      createdAt: new Date().toISOString(),
    });
  }

  saveExpenses(expenses);
  closeExpenseModal();
  renderExpensesPage();
  renderDashboard();

  if (currentEditExpenseId) {
  toastSuccess('هزینه ویرایش شد.');
} else {
  toastSuccess('هزینه جدید ثبت شد.');
}
}

function deleteExpense(expenseId) {
  if (!confirm('⚠️ آیا از حذف این هزینه مطمئن هستید؟')) return;

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
  return 'ham_sakhteman_notices';
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
  const thisMonth = all.filter(n => n.month === getTodayPersianMonth()).length;
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

      return numberStr.includes(q) ||
             ownerName.includes(q) ||
             unitLabel.includes(q);
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
    const unitLabel = `${u.block}-${toPersianNum(u.number)}`;

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

  if (!title) {
    toastWarning('لطفاً عنوان اطلاعیه را وارد کنید.');
    return;
  }

  if (!body) {
    toastWarning('لطفاً متن اطلاعیه را وارد کنید.');
    return;
  }

  if (targetType === 'block' && !targetBlock) {
    toastWarning('لطفاً بلوک را انتخاب کنید.');
    return;
  }

  if (targetType === 'units' && noticeSelectedUnits.length === 0) {
    toastWarning('لطفاً حداقل یک واحد را انتخاب کنید.');
    return;
  }

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
  const newId = notices.length > 0 ? Math.max(...notices.map(n => n.id || 0)) + 1 : 1;

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
    createdAt: new Date().toISOString(),
  });

  saveNotices(notices);
  closeNoticeModal();
  renderNoticesPage();

  toastSuccess(`اطلاعیه ارسال شد. (${receivers} دریافت‌کننده)`);
}

function deleteNotice(noticeId) {
  if (!confirm('⚠️ آیا از حذف این اطلاعیه مطمئن هستید؟')) return;

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

  alert(`📢 ${notice.title}\n\n${notice.body}\n\n👥 مخاطب: ${targetLabel}\n📅 تاریخ: ${notice.date}`);
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
  return 'ham_sakhteman_messages';
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
    const unitLabel = `${u.block}-${toPersianNum(u.number)}`;
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
  let lastId = messages.length > 0 ? Math.max(...messages.map(m => m.id || 0)) : 0;

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

  const newId = messages.length > 0 ? Math.max(...messages.map(m => m.id || 0)) + 1 : 1;

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
  return 'ham_sakhteman_votings';
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
}

function addVotingCandidate() {
  const newId = votingCandidates.length > 0
    ? Math.max(...votingCandidates.map(c => c.id)) + 1
    : 1;

  votingCandidates.push({
    id: newId,
    name: '',
    phone: '',
  });

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

  if (!title) {
    toastWarning('لطفاً عنوان رأی‌گیری را وارد کنید.');
    return;
  }

  if (!startDate || !startTime) {
    toastWarning('لطفاً تاریخ و ساعت شروع را وارد کنید.');
    return;
  }

  if (!endDate || !endTime) {
    toastWarning('لطفاً تاریخ و ساعت پایان را وارد کنید.');
    return;
  }

  if (votingCandidates.length < 2) {
    toastWarning('حداقل ۲ کاندید لازم است.');
    return;
  }

   const emptyCandidates = votingCandidates.filter(c => !c.name || !c.name.trim());
  if (emptyCandidates.length > 0) {
    toastWarning('لطفاً نام همه کاندیدها را وارد کنید.');
    return;
  }

  const startDateTime = parsePersianDateTime(startDate, startTime);
  const endDateTime = parsePersianDateTime(endDate, endTime);

  if (!startDateTime || !endDateTime) {
    toastWarning('خطا در تاریخ یا ساعت.');
    return;
  }

  if (endDateTime <= startDateTime) {
    toastWarning('زمان پایان باید بعد از زمان شروع باشد.');
    return;
  }

  const votings = loadVotings();

  // اگر در حال ویرایش هستیم
  if (editingVotingId) {
    const idx = votings.findIndex(v => v.id === editingVotingId);
    if (idx !== -1) {
      const old = votings[idx];
      votings[idx] = {
        ...old,
        title: title,
        description: description,
        startDate: startDate,
        startTime: startTime,
        endDate: endDate,
        endTime: endTime,
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

  const newId = votings.length > 0 ? Math.max(...votings.map(v => v.id || 0)) + 1 : 1;

  votings.push({
    id: newId,
    title: title,
    description: description,
    startDate: startDate,
    startTime: startTime,
    endDate: endDate,
    endTime: endTime,
    startDateTime: startDateTime.toISOString(),
    endDateTime: endDateTime.toISOString(),
          candidates: votingCandidates.map(c => ({
      id: c.id,
      name: c.name.trim(),
      phone: (c.phone || '').trim(),
      votes: 0,
    })),
    votes: [],
    eligibleVoters: 'owners',   // فقط مالکین حق رأی دارند
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
function showVotingResults(votingId) {
  const votings = loadVotings();
  const voting = votings.find(v => v.id === votingId);
  if (!voting) return;

  const status = getVotingStatus(voting);

  if (status !== 'ended') {
    if (!confirm('⚠️ رأی‌گیری هنوز تمام نشده. آیا می‌خواهید نتایج فعلی را ببینید؟')) {
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

function deleteVoting(votingId) {
  if (!confirm('⚠️ آیا از حذف این رأی‌گیری مطمئن هستید؟')) return;

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
  const currentMonth = currentChargeMonth;
  const currentYear = currentChargeYear;

  if (reportPeriod === 'thisMonth') {
    return {
      label: `${currentMonth} ${toPersianNum(currentYear)}`,
      filterFn: (item) => item.month === currentMonth && item.year === currentYear,
    };
  }

  if (reportPeriod === 'lastMonth') {
    const months = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
                    'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
    const idx = months.indexOf(currentMonth);
    const lastIdx = idx > 0 ? idx - 1 : 11;
    const lastMonth = months[lastIdx];
    const lastYear = idx > 0 ? currentYear : String(parseInt(currentYear) - 1);

    return {
      label: `${lastMonth} ${toPersianNum(lastYear)}`,
      filterFn: (item) => item.month === lastMonth && item.year === lastYear,
    };
  }

  if (reportPeriod === 'specificMonth') {
    const month = document.getElementById('reportMonthSelect')?.value || currentMonth;
    const year = document.getElementById('reportMonthYearSelect')?.value || currentYear;

    return {
      label: `${month} ${toPersianNum(year)}`,
      filterFn: (item) => item.month === month && item.year === year,
    };
  }

  if (reportPeriod === 'thisYear') {
    return {
      label: `سال ${toPersianNum(currentYear)}`,
      filterFn: (item) => item.year === currentYear,
    };
  }

  if (reportPeriod === 'custom') {
    const fromDate = document.getElementById('reportFromDate')?.value.trim() || '';
    const toDate = document.getElementById('reportToDate')?.value.trim() || '';

    if (!fromDate && !toDate) {
      return {
        label: 'دستی (بازه نامشخص)',
        filterFn: () => true,
      };
    }

    const fromG = fromDate ? parseReportDate(fromDate) : null;
    const toG = toDate ? parseReportDate(toDate) : null;

    return {
      label: `${fromDate || '—'} تا ${toDate || '—'}`,
      filterFn: (item) => {
        if (!item.createdAt) return false;
        const itemDate = new Date(item.createdAt);

        if (fromG && itemDate < fromG) return false;
        if (toG && itemDate > toG) return false;
        return true;
      },
    };
  }

  return {
    label: 'همه دوره‌ها',
    filterFn: () => true,
  };
}

function parseReportDate(dateStr) {
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

    const gregorian = persianToGregorian(year, month, day);
    return new Date(gregorian.year, gregorian.month - 1, gregorian.day);
  } catch (e) {
    return null;
  }
}

function renderReportsPage() {
  const range = getReportDateRange();

  const labelEl = document.getElementById('reportPeriodLabel');
  if (labelEl) labelEl.textContent = range.label;

  const badge = document.getElementById('reportDonutBadge');
  if (badge) badge.textContent = range.label;

  const allCharges = loadCharges().filter(range.filterFn);
  const paidCharges = allCharges.filter(c => c.paid);
  const unpaidCharges = allCharges.filter(c => !c.paid);

  const chargesSum = allCharges.reduce((s, c) => s + (Number(c.total) || 0), 0);
  const chargesIncome = paidCharges.reduce((s, c) => s + (Number(c.total) || 0), 0);
  const chargesDebt = unpaidCharges.reduce((s, c) => s + (Number(c.total) || 0), 0);

  const allExpenses = loadExpenses().filter(range.filterFn);
  const expensesSum = allExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const expensesAvg = allExpenses.length > 0 ? Math.round(expensesSum / allExpenses.length) : 0;
  const expensesMax = allExpenses.length > 0
    ? Math.max(...allExpenses.map(e => Number(e.amount) || 0))
    : 0;

  const balance = chargesIncome - expensesSum;

  const totalDebt = UNITS.reduce((s, u) => s + (Number(u.debt) || 0), 0);

  document.getElementById('reportIncome').textContent = formatToman(chargesIncome);
  document.getElementById('reportExpense').textContent = formatToman(expensesSum);
  document.getElementById('reportBalance').textContent = formatToman(balance);
  document.getElementById('reportDebt').textContent = formatToman(totalDebt);

  document.getElementById('reportChargesCount').textContent = formatNumber(allCharges.length);
  document.getElementById('reportChargesPaid').textContent = formatNumber(paidCharges.length);
  document.getElementById('reportChargesUnpaid').textContent = formatNumber(unpaidCharges.length);
  document.getElementById('reportChargesSum').textContent = formatToman(chargesSum);
  document.getElementById('reportChargesIncome').textContent = formatToman(chargesIncome);
  document.getElementById('reportChargesDebt').textContent = formatToman(chargesDebt);

  document.getElementById('reportExpensesCount').textContent = formatNumber(allExpenses.length);
  document.getElementById('reportExpensesSum').textContent = formatToman(expensesSum);
  document.getElementById('reportExpensesAvg').textContent = formatToman(expensesAvg);
  document.getElementById('reportExpensesMax').textContent = formatToman(expensesMax);

  const paidPercent = allCharges.length > 0
    ? Math.round((paidCharges.length / allCharges.length) * 100)
    : 0;

  document.getElementById('reportDonutPercent').textContent = formatNumber(paidPercent) + '٪';

  renderReportDonutChart(paidCharges.length, unpaidCharges.length);
  renderReportLineChart();
  renderReportCategories(allExpenses, expensesSum);
  renderReportDebtors();
}

function renderReportDonutChart(paid, unpaid) {
  const canvas = document.getElementById('reportDonutChart');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const size = 180;
  const dpr = window.devicePixelRatio || 1;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  ctx.scale(dpr, dpr);

  const cx = size / 2, cy = size / 2, radius = 70, lineWidth = 18;
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
    ctx.lineCap = 'round';
    ctx.stroke();
  }

  if (unpaid > 0) {
    ctx.beginPath();
    ctx.arc(cx, cy, radius, -Math.PI / 2 + paidAngle, -Math.PI / 2 + Math.PI * 2);
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    ctx.stroke();
  }
}

function renderReportLineChart() {
  const canvas = document.getElementById('reportLineChart');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const rect = canvas.parentElement.getBoundingClientRect();
  const W = rect.width, H = rect.height;
  const dpr = window.devicePixelRatio || 1;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  ctx.scale(dpr, dpr);

  const months = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور'];

  const allCharges = loadCharges();
  const values = months.map(month => {
    const monthCharges = allCharges.filter(c =>
      c.month === month && c.paid && c.year === currentChargeYear
    );
    return monthCharges.reduce((s, c) => s + (Number(c.total) || 0), 0);
  });

  const maxVal = Math.max(...values, 1) * 1.15;
  const padding = { top: 20, right: 20, bottom: 40, left: 60 };
  const chartW = W - padding.left - padding.right;
  const chartH = H - padding.top - padding.bottom;

  ctx.strokeStyle = '#f1f5f9';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = padding.top + (chartH / 4) * i;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(padding.left + chartW, y);
    ctx.stroke();
  }

  const points = values.map((v, i) => ({
    x: padding.left + (chartW / (values.length - 1)) * i,
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
  const allCharges = loadCharges().filter(range.filterFn);
  const allExpenses = loadExpenses().filter(range.filterFn);

  const paidCharges = allCharges.filter(c => c.paid);
  const unpaidCharges = allCharges.filter(c => !c.paid);
  const chargesIncome = paidCharges.reduce((s, c) => s + (Number(c.total) || 0), 0);
  const expensesSum = allExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const balance = chargesIncome - expensesSum;

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
        <tr><td>کل شارژ دریافتی</td><td>${chargesIncome.toLocaleString('en-US')} تومان</td></tr>
        <tr><td>کل هزینه‌ها</td><td>${expensesSum.toLocaleString('en-US')} تومان</td></tr>
        <tr><td>مانده صندوق</td><td>${balance.toLocaleString('en-US')} تومان</td></tr>
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
  const allCharges = loadCharges().filter(range.filterFn);
  const allExpenses = loadExpenses().filter(range.filterFn);

  const paidCharges = allCharges.filter(c => c.paid);
  const unpaidCharges = allCharges.filter(c => !c.paid);
  const chargesIncome = paidCharges.reduce((s, c) => s + (Number(c.total) || 0), 0);
  const expensesSum = allExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const balance = chargesIncome - expensesSum;

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
          <span>کل شارژ دریافتی</span>
          <strong>${formatToman(chargesIncome)}</strong>
        </div>
        <div class="stat-box">
          <span>کل هزینه‌ها</span>
          <strong>${formatToman(expensesSum)}</strong>
        </div>
        <div class="stat-box">
          <span>مانده صندوق</span>
          <strong>${formatToman(balance)}</strong>
        </div>
      </div>

      <h3>💰 خلاصه شارژ</h3>
      <table>
        <tr><td>تعداد کل شارژها</td><td>${formatNumber(allCharges.length)}</td></tr>
        <tr><td>پرداخت شده</td><td>${formatNumber(paidCharges.length)}</td></tr>
        <tr><td>پرداخت نشده</td><td>${formatNumber(unpaidCharges.length)}</td></tr>
        <tr><td>مجموع دریافتی</td><td>${formatToman(chargesIncome)}</td></tr>
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
  return 'ham_sakhteman_settings';
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
}

function savePaymentSettings() {
  const settings = loadSettings();

  settings.managerCard = document.getElementById('setManagerCard').value.trim();
  settings.managerSheba = document.getElementById('setManagerSheba').value.trim();

  saveSettings(settings);
  toastSuccess('اطلاعات پرداخت ذخیره شد.');
}

function fillFinancialForm() {
  const settings = loadSettings();

  document.getElementById('setMonthlyCharge').value = settings.monthlyCharge || 500000;
  document.getElementById('setPaymentDeadline').value = settings.paymentDeadline || 10;
}

function saveFinancialSettings() {
  const settings = loadSettings();

  settings.monthlyCharge = parseInt(document.getElementById('setMonthlyCharge').value) || 500000;
  settings.paymentDeadline = parseInt(document.getElementById('setPaymentDeadline').value) || 10;

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

function downloadBackup() {
  const backup = {
    building: localStorage.getItem('ham_sakhteman_v3'),
    units: localStorage.getItem('ham_sakhteman_units'),
    charges: localStorage.getItem('ham_sakhteman_charges'),
    expenses: localStorage.getItem('ham_sakhteman_expenses'),
    notices: localStorage.getItem('ham_sakhteman_notices'),
    messages: localStorage.getItem('ham_sakhteman_messages'),
    votings: localStorage.getItem('ham_sakhteman_votings'),
    settings: localStorage.getItem('ham_sakhteman_settings'),
    exportDate: new Date().toISOString(),
  };

  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `backup-${new Date().toLocaleDateString('fa-IR').replace(/\//g, '-')}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  toastSuccess('پشتیبان دانلود شد.');
}

function uploadBackup(file) {
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const backup = JSON.parse(e.target.result);

      if (!confirm('⚠️ آیا مطمئن هستید؟ تمام داده‌های فعلی جایگزین می‌شوند.')) return;

      if (backup.building) localStorage.setItem('ham_sakhteman_v3', backup.building);
      if (backup.units) localStorage.setItem('ham_sakhteman_units', backup.units);
      if (backup.charges) localStorage.setItem('ham_sakhteman_charges', backup.charges);
      if (backup.expenses) localStorage.setItem('ham_sakhteman_expenses', backup.expenses);
      if (backup.notices) localStorage.setItem('ham_sakhteman_notices', backup.notices);
      if (backup.messages) localStorage.setItem('ham_sakhteman_messages', backup.messages);
      if (backup.votings) localStorage.setItem('ham_sakhteman_votings', backup.votings);
      if (backup.settings) localStorage.setItem('ham_sakhteman_settings', backup.settings);

      toastSuccess('پشتیبان بازیابی شد. صفحه رفرش می‌شود.');
      location.reload();
    } catch (err) {
      toastError('فایل پشتیبان نامعتبر است.');
    }
  };
  reader.readAsText(file);
}

function resetAllData() {
  if (!confirm('⚠️ هشدار: تمام داده‌ها پاک می‌شوند!\n\nآیا مطمئن هستید؟')) return;
  if (!confirm('⚠️ آیا واقعاً مطمئن هستید؟ این کار قابل بازگشت نیست.')) return;

  localStorage.clear();
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

/* ============ ۱۹) راه‌اندازی ============ */
function init() {
  console.log('INIT RUN ✅');

  const urlParams = new URLSearchParams(window.location.search);
  const isSignup = urlParams.get('signup') === '1';

  // اگر ثبت‌نام است، اجازه بده وارد شود (حتی بدون لاگین)
  if (!isSignup) {
    if (typeof isLoggedIn === 'function' && !isLoggedIn()) {
      window.location.replace('login.html');
      return;
    }
  }

  loadUnits();

  document.querySelectorAll('select').forEach(select => {
    const id = select.id;
    if (!id) return;

    if (id.toLowerCase().includes('month') && !id.toLowerCase().includes('year')) {
      const currentValue = select.value;
      const months = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
                      'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];

      
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

      months.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m;
        opt.textContent = m;
        if (m === getTodayPersianMonth()) opt.selected = true;
        select.appendChild(opt);
      });
    }
  });

  const data = loadData();

  if (!data || !data.building || isSignup) {
    // اگه signup=1 بود، پنل فعلی رو نادیده بگیر و wizard باز کن
    openWelcomeModal();
  } else {
    renderBuildingCard();
    buildBlockFilterOptions(data.building);

    const expectedUnits = getExpectedUnitsCount(data.building);

    if (UNITS.length === 0) {
      console.log('⚠️ UNITS mismatch — rebuilding. Expected:', expectedUnits, 'Got:', UNITS.length);
      buildDemoUnits(data.building);
    }
  }

  // ✅ منوی سایدبار
  document.getElementById('menu')?.addEventListener('click', (e) => {
    const mainItem = e.target.closest('.nav-item-main');
    if (mainItem) {
      const parent = mainItem.closest('.has-submenu');
      if (parent) {
        parent.classList.toggle('open');
      }
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
  
  // ✅ آپدیت قفل‌های سایدبار
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

/* ✅ تعداد واحدهای مورد انتظار */
function getExpectedUnitsCount(building) {
  if (!building) return 0;
  if (building.type === 'complex') {
    return building.blocks.reduce((sum, b) => sum + (parseInt(b.units) || 0), 0);
  }
  return parseInt(building.totalUnits) || 0;
}

/* ============================================================
   🔔 سیستم اعلان‌ها
   ============================================================ */
const NOTIF_KEY = 'ham_sakhteman_notifications';
let notifications = [];

function loadNotifications() {
  const raw = localStorage.getItem(NOTIF_KEY);
  if (raw) { try { notifications = JSON.parse(raw); } catch (e) { notifications = []; } }
  else { notifications = []; }
}

function saveNotifications() {
  localStorage.setItem(NOTIF_KEY, JSON.stringify(notifications));
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

function clearAllNotifications() {
  if (notifications.length === 0) return;
  if (!confirm('⚠️ همه اعلان‌ها پاک شوند؟')) return;

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

function handleLogout() {
  if (!confirm('⚠️ آیا از خروج از پنل مطمئن هستید؟\n\nداده‌ها پاک نمی‌شوند.')) {
    return;
  }

  // علامت‌گذاری خروج
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
  // دکمه ارتقا در سایدبار
  const btnUpgrade = document.getElementById('btnUpgradePlan');
  if (btnUpgrade) {
    btnUpgrade.addEventListener('click', () => showUpgradeModal());
  }
  
  // دکمه انصراف
  const btnCancel = document.getElementById('upgradeCancelBtn');
  if (btnCancel) {
    btnCancel.addEventListener('click', closeUpgradeModal);
  }
  
  // دکمه تایید و پرداخت
  const btnConfirm = document.getElementById('upgradeConfirmBtn');
  if (btnConfirm) {
    btnConfirm.addEventListener('click', handleUpgrade);
  }
  
  // بستن با کلیک روی backdrop
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
  if (elUnits) elUnits.textContent = formatNumber(UNITS.length);
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

  if (!fullName) {
    toastWarning('لطفاً نام و نام خانوادگی را وارد کنید.');
    return;
  }

  if (!phone) {
    toastWarning('لطفاً شماره موبایل را وارد کنید.');
    return;
  }

  if (!isValidIranMobile(phone)) {
    toastWarning('شماره موبایل باید ۱۱ رقم و با ۰۹ شروع شود.');
    return;
  }

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    toastWarning('فرمت ایمیل صحیح نیست.');
    return;
  }

  if (nationalId && !/^\d{10}$/.test(nationalId)) {
    toastWarning('کد ملی باید ۱۰ رقم باشد.');
    return;
  }

  const profile = loadProfile();
  const oldPhone = profile.phone || '';
  profile.fullName = fullName;
  profile.phone = phone;
  profile.email = email;
  profile.nationalId = nationalId;
  profile.address = address;
  profile.bio = bio;
  profile.updatedAt = new Date().toISOString();

  saveProfile(profile);

  // ✅ اگه شماره موبایل عوض شد، اطلاعات ورود رو هم آپدیت کن
  if (oldPhone !== phone && typeof normalizePhone === 'function') {
    localStorage.setItem('ham_sakhteman_user_phone', phone);
  }

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

  // چک رمز فعلی از auth
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

  if (!newPass) {
    toastWarning('لطفاً رمز عبور جدید را وارد کنید.');
    return;
  }

  if (newPass.length < 6) {
    toastWarning('رمز عبور جدید باید حداقل ۶ کاراکتر باشد.');
    return;
  }

  if (newPass !== confirmPass) {
    toastError('تکرار رمز عبور جدید مطابقت ندارد.');
    return;
  }

  if (currentPass && currentPass === newPass) {
    toastWarning('رمز عبور جدید نباید با رمز فعلی یکسان باشد.');
    return;
  }

  // ذخیره‌ی رمز جدید
  if (typeof simpleHashAuth === 'function') {
    localStorage.setItem('ham_sakhteman_user_password', simpleHashAuth(newPass));
  } else {
    savePasswordHash(simpleHash(newPass));
  }

  // پاک کردن فرم
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

function deleteAccount() {
  if (!confirm('⚠️ هشدار: تمام اطلاعات برای همیشه پاک می‌شوند!')) return;
  if (!confirm('⚠️ آیا واقعاً مطمئن هستید؟ این کار قابل بازگشت نیست.')) return;

  const input = prompt('برای تأیید نهایی، کلمه «حذف» را تایپ کنید:');
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

const PERSIAN_MONTHS = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
                        'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];

function calcMonthProfit(monthName, year) {
  const charges = loadCharges();
  const expenses = loadExpenses();

  let monthCharges = charges.filter(c =>
    c.month === monthName &&
    c.year === String(year) &&
    c.paid === true
  );

  let monthExpenses = expenses.filter(e =>
    e.month === monthName &&
    e.year === String(year)
  );

  if (profitBlock !== 'all') {
    monthCharges = monthCharges.filter(c =>
      String(c.block || '').trim() === String(profitBlock).trim()
    );
    monthExpenses = monthExpenses.filter(e =>
      (e.block && e.block !== 'all')
        ? String(e.block).trim() === String(profitBlock).trim()
        : true
    );
  }

  const income = monthCharges.reduce((s, c) => s + (Number(c.total) || 0), 0);
  const expense = monthExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const profit = income - expense;

  return {
    month: monthName,
    income,
    expense,
    profit,
    chargesCount: monthCharges.length,
    expensesCount: monthExpenses.length,
    expenses: monthExpenses,
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

  return {
    months: allMonths,
    totalIncome,
    totalExpense,
    netProfit,
    totalDebt,
  };
}

function getPeriodMonths() {
  const currentMonthIdx = PERSIAN_MONTHS.indexOf(getTodayPersianMonth());

  if (profitPeriod === 'thisMonth') {
    return [getTodayPersianMonth()];
  }
  if (profitPeriod === '3months') {
    const result = [];
    for (let i = 2; i >= 0; i--) {
      const idx = currentMonthIdx - i;
      if (idx >= 0) result.push(PERSIAN_MONTHS[idx]);
    }
    return result;
  }
  if (profitPeriod === '6months') {
    const result = [];
    for (let i = 5; i >= 0; i--) {
      const idx = currentMonthIdx - i;
      if (idx >= 0) result.push(PERSIAN_MONTHS[idx]);
    }
    return result;
  }
  return PERSIAN_MONTHS;
}

function renderProfitStats() {
  const data = calcTotalProfit();

  const periodMonths = getPeriodMonths();
  const filteredMonths = data.months.filter(m => periodMonths.includes(m.month));

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

  const periodMonths = getPeriodMonths();
  const monthsData = periodMonths.map(m => calcMonthProfit(m, profitYear));

  const hasData = monthsData.some(m => m.income > 0 || m.expense > 0);
  const filtered = hasData
    ? monthsData.filter(m => m.income > 0 || m.expense > 0)
    : monthsData;

  if (countLabel) {
    countLabel.textContent = `${formatNumber(filtered.length)} ماه`;
  }

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
        <td><strong>${m.month}</strong></td>
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

  const ctx = canvas.getContext('2d');
  const rect = canvas.parentElement.getBoundingClientRect();
  const W = rect.width, H = rect.height;
  const dpr = window.devicePixelRatio || 1;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  ctx.scale(dpr, dpr);

  const periodMonths = getPeriodMonths();
  const monthsData = periodMonths.map(m => calcMonthProfit(m, profitYear));

  const padding = { top: 30, right: 20, bottom: 50, left: 70 };
  const chartW = W - padding.left - padding.right;
  const chartH = H - padding.top - padding.bottom;

  const maxVal = Math.max(
    ...monthsData.map(m => Math.max(m.income, m.expense)),
    1
  ) * 1.2;

  ctx.strokeStyle = '#f1f5f9';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = padding.top + (chartH / 4) * i;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(padding.left + chartW, y);
    ctx.stroke();
  }

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
      ctx.roundRect(incomeX, incomeY, barWidth, incomeH, [6, 6, 0, 0]);
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
      ctx.roundRect(expenseX, expenseY, barWidth, expenseH, [6, 6, 0, 0]);
      ctx.fill();
    }

    ctx.fillStyle = '#64748b';
    ctx.font = '11.5px Vazirmatn, Tahoma';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(m.month, centerX, padding.top + chartH + 12);
  });
}

function renderProfitDonutChart() {
  const canvas = document.getElementById('profitDonutChart');
  if (!canvas) return;

  const periodMonths = getPeriodMonths();
  const monthData = periodMonths.map(m => calcMonthProfit(m, profitYear));

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

  const periodMonths = getPeriodMonths();
  const monthsData = periodMonths.map(m => calcMonthProfit(m, profitYear));

  const totalIncome = monthsData.reduce((s, m) => s + m.income, 0);
  const totalCharges = monthsData.reduce((s, m) => s + m.chargesCount, 0);

  const charges = loadCharges().filter(c => {
    const inPeriod = periodMonths.includes(c.month) && c.year === String(profitYear) && c.paid;
    if (!inPeriod) return false;
    if (profitBlock !== 'all') {
      return String(c.block || '').trim() === String(profitBlock).trim();
    }
    return true;
  });

  const extraIncome = charges.reduce((s, c) => s + (Number(c.extra) || 0), 0);
  const baseIncome = totalIncome - extraIncome;

  const rows = [
    { label: '💰 شارژ پایه', value: baseIncome, icon: '💰' },
    { label: '➕ هزینه اضافی', value: extraIncome, icon: '➕' },
    { label: '📋 تعداد شارژهای پرداخت‌شده', value: totalCharges, isCount: true, icon: '📋' },
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

  const periodMonths = getPeriodMonths();
  const monthData = periodMonths.map(m => calcMonthProfit(m, profitYear));

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
  const periodMonths = getPeriodMonths();
  const monthsData = periodMonths.map(m => calcMonthProfit(m, profitYear));

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
        <td>${m.month}</td>
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
  const periodMonths = getPeriodMonths();
  const monthsData = periodMonths.map(m => calcMonthProfit(m, profitYear));

  const totalIncome = monthsData.reduce((s, m) => s + m.income, 0);
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
        <td>${m.month}</td>
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
const TICKETS_KEY = 'ham_sakhteman_tickets';
let currentTicketId = null;

function loadTickets() {
  const raw = localStorage.getItem(TICKETS_KEY);
  if (raw) { try { return JSON.parse(raw); } catch (e) { return []; } }
  return [];
}

function saveTickets(tickets) {
  localStorage.setItem(TICKETS_KEY, JSON.stringify(tickets));
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
  const lastDate = tickets.length > 0
    ? tickets[tickets.length - 1].date
    : '—';

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
    const lastMsg = t.messages[t.messages.length - 1];
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

  if (!subject) {
    toastWarning('لطفاً موضوع تیکت را وارد کنید.');
    return;
  }
  if (!message) {
    toastWarning('لطفاً متن پیام را وارد کنید.');
    return;
  }

  const tickets = loadTickets();
  const newId = tickets.length > 0 ? Math.max(...tickets.map(t => t.id || 0)) + 1 : 1;
  const dt = getPersianDateTime();

  tickets.push({
    id: newId,
    subject: subject,
    category: category,
    priority: priority,
    status: 'open',
    date: dt.date,
    time: dt.time,
    lastUpdateDate: dt.date,
    lastUpdateTime: dt.time,
    createdAt: dt.iso,
    updatedAt: dt.iso,
    messages: [
      {
        sender: 'user',
        text: message,
        date: dt.date,
        time: dt.time,
        createdAt: dt.iso,
      }
    ],
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

  // اگه تیکت بسته شده، فرم پاسخ مخفی بشه
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

  container.innerHTML = ticket.messages.map((m, idx) => {
    const isUser = m.sender === 'user';
    const isAdmin = m.sender === 'admin';

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
  if (!message) {
    toastWarning('لطفاً متن پاسخ را وارد کنید.');
    return;
  }

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

function deleteTicket(ticketId) {
  if (!confirm('⚠️ آیا از حذف این تیکت مطمئن هستید؟')) return;

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

  if (elUnits) {
    elUnits.textContent = formatNumber(plan?.totalUnits || UNITS.length);
  }

  // دکمه پلن رایگان
  const btnFree = document.getElementById('subBtnFree');
  if (btnFree) {
    if (currentPlan === 'free') {
      btnFree.textContent = 'پلن فعلی';
      btnFree.disabled = true;
      btnFree.className = 'btn btn-outline plan-select-btn';
    } else {
      btnFree.textContent = 'غیرفعال کردن حرفه‌ای';
      btnFree.disabled = false;
      btnFree.className = 'btn btn-cancel plan-select-btn';
      btnFree.onclick = () => {
        if (!confirm('آیا از غیرفعال کردن پلن حرفه‌ای مطمئن هستید؟')) return;
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

  // دکمه پلن حرفه‌ای
  const btnPro = document.getElementById('subBtnPro');
  const elProPrice = document.getElementById('subProPrice');

  const totalUnits = UNITS.length;
  const result = calculatePrice(totalUnits);

  let price = result.price;
  if (price === 0) price = 10 * 100000;

  if (elProPrice) {
    elProPrice.textContent = (price / 1000000).toFixed(1).replace('.0', '');
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
          totalUnits: totalUnits,
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
  activatePlan('pro', paymentInfo.totalUnits, {
    amount: paymentInfo.amount,
    status: 'paid',
    paidAt: new Date().toISOString(),
    orderId: paymentInfo.orderId,
  });

  if (!paymentInfo.isUpgrade) {
    saveWizardData();
  }

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
