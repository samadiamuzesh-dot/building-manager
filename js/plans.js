/* ============================================================
   💎 پلن‌ها و قیمت‌گذاری — آپارتمان پلاس
   ============================================================ */

const PLANS = {
  free: {
    id: 'free',
    name: 'رایگان',
    icon: '🆓',
    description: 'برای ساختمان‌های کوچک',
    unitsLimit: 10,
    price: 0,
    period: 'همیشه',
    features: [
      { label: 'تا ۱۰ واحد', included: true },
      { label: 'داشبورد مدیریت', included: true },
      { label: 'مدیریت واحدها', included: true },
      { label: 'صدور شارژ', included: true },
      { label: 'دریافت شارژها', included: false },
      { label: 'مدیریت هزینه‌ها', included: false },
      { label: 'درآمد جانبی', included: false },
      { label: 'اطلاعیه‌ها', included: false },
      { label: 'پیام‌ها', included: false },
      { label: 'رأی‌گیری', included: false },
      { label: 'گزارشات کامل', included: false },
      { label: 'سود و زیان', included: false },
      { label: 'خروجی اکسل', included: false },
      { label: 'چاپ PDF', included: false },
      { label: 'پشتیبان‌گیری', included: false },
    ],
  },
  pro: {
    id: 'pro',
    name: 'حرفه‌ای',
    icon: '💎',
    description: 'دسترسی کامل به همه امکانات',
    unitsLimit: 10000,
    period: 'سالانه',
    features: [
      { label: 'واحد نامحدود', included: true },
      { label: 'داشبورد مدیریت', included: true },
      { label: 'مدیریت واحدها', included: true },
      { label: 'صدور شارژ', included: true },
      { label: 'دریافت شارژها', included: true },
      { label: 'مدیریت هزینه‌ها', included: true },
      { label: 'درآمد جانبی', included: true },
      { label: 'اطلاعیه‌ها', included: true },
      { label: 'پیام‌ها', included: true },
      { label: 'رأی‌گیری', included: true },
      { label: 'گزارشات کامل', included: true },
      { label: 'سود و زیان', included: true },
      { label: 'خروجی اکسل', included: true },
      { label: 'چاپ PDF', included: true },
      { label: 'پشتیبان‌گیری', included: true },
    ],
  },
};

function calculatePrice(totalUnits) {
  const units = parseInt(totalUnits) || 0;
  
  if (units <= 10) {
    return {
      planType: 'free',
      price: 0,
      breakdown: 'رایگان برای ساختمان‌های تا ۱۰ واحد',
      tier: null,
    };
  }
  
  if (units <= 40) {
    return {
      planType: 'pro',
      price: units * 100000,
      breakdown: `${units} واحد × ۱۰۰,۰۰۰ تومان`,
      tier: 'پله ۱ (۱۱-۴۰ واحد)',
    };
  }
  
  if (units <= 300) {
    const base = 40 * 100000;
    const remaining = (units - 40) * 70000;
    return {
      planType: 'pro',
      price: base + remaining,
      breakdown: `۴۰ واحد × ۱۰۰K + ${units - 40} واحد × ۷۰K`,
      tier: 'پله ۲ (۴۱-۳۰۰ واحد)',
    };
  }
  
  const base = (40 * 100000) + (260 * 70000);
  const remaining = (units - 300) * 50000;
  return {
    planType: 'pro',
    price: base + remaining,
    breakdown: `۴۰×۱۰۰K + ۲۶۰×۷۰K + ${units - 300}×۵۰K`,
    tier: 'پله ۳ (۳۰۱+ واحد)',
  };
}

function formatPrice(price) {
  if (price === 0) return 'رایگان';
  
  if (price >= 1000000) {
    const millions = price / 1000000;
    const formatted = millions.toLocaleString('fa-IR', { maximumFractionDigits: 1 });
    return `${formatted} میلیون تومان`;
  }
  
  return price.toLocaleString('fa-IR') + ' تومان';
}

const PLAN_KEY = 'ham_sakhteman_plan';

function loadPlan() {
  const raw = localStorage.getItem(PLAN_KEY);
  if (raw) {
    try { return JSON.parse(raw); } catch (e) { return null; }
  }
  return null;
}

function savePlan(plan) {
  localStorage.setItem(PLAN_KEY, JSON.stringify(plan));
}

function getUserPlan() {
  const plan = loadPlan();
  if (!plan) return PLANS.free;
  return PLANS[plan.type] || PLANS.free;
}

const FREE_PAGES = ['dashboard', 'units', 'charges'];

function canAccessPage(pageKey) {
  const plan = loadPlan();
  
  if (plan && plan.type === 'pro') {
    if (plan.expiresAt && new Date(plan.expiresAt) < new Date()) {
      return FREE_PAGES.includes(pageKey);
    }
    return true;
  }
  
  return FREE_PAGES.includes(pageKey);
}

function getExpiryDate() {
  const now = new Date();
  const nextYear = new Date(now);
  nextYear.setFullYear(now.getFullYear() + 1);
  return nextYear.toISOString();
}

function activatePlan(type, totalUnits, paymentInfo = {}) {
  const plan = {
    type: type,
    totalUnits: totalUnits,
    startedAt: new Date().toISOString(),
    expiresAt: type === 'pro' ? getExpiryDate() : null,
    payment: paymentInfo,
  };
  
  savePlan(plan);
  return plan;
}