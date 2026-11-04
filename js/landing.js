/* ============================================================
   آپارتمان پلاس — اسکریپت صفحه معرفی (بدون وابستگی)
   ============================================================ */
(function () {
  'use strict';

  var FA = '۰۱۲۳۴۵۶۷۸۹';
  function toFa(n) { return String(n).replace(/\d/g, function (d) { return FA[d]; }); }
  function toEn(s) {
    return String(s)
      .replace(/[۰-۹]/g, function (d) { return FA.indexOf(d); })
      .replace(/[٠-٩]/g, function (d) { return '٠١٢٣٤٥٦٧٨٩'.indexOf(d); });
  }
  // جداکننده هزارگان فارسی «٬»
  function faNum(n) { return toFa(Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '٬')); }

  /* ---------- Header shadow + mobile sticky CTA ---------- */
  var header = document.getElementById('siteHeader');
  var mobileCta = document.getElementById('mobileCta');
  var hero = document.querySelector('.hero');
  var footer = document.querySelector('.site-footer');
  var ticking = false;
  function onScroll() {
    var y = window.scrollY || window.pageYOffset;
    header.classList.toggle('scrolled', y > 8);
    if (mobileCta && hero) {
      var pastHero = y > hero.offsetHeight - 80;
      var nearFooter = footer && (y + window.innerHeight > footer.offsetTop + 40);
      mobileCta.classList.toggle('show', pastHero && !nearFooter);
    }
    ticking = false;
  }
  window.addEventListener('scroll', function () {
    if (!ticking) { window.requestAnimationFrame(onScroll); ticking = true; }
  }, { passive: true });
  onScroll();

  /* ---------- Mobile menu ---------- */
  var toggle = document.getElementById('menuToggle');
  var menu = document.getElementById('mobileMenu');
  function setMenu(open) {
    document.body.classList.toggle('menu-open', open);
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    toggle.setAttribute('aria-label', open ? 'بستن منو' : 'باز کردن منو');
  }
  toggle.addEventListener('click', function () { setMenu(!document.body.classList.contains('menu-open')); });
  menu.addEventListener('click', function (e) { if (e.target.closest('a')) setMenu(false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setMenu(false); });

  /* ---------- Reveal on scroll ---------- */
  var reveals = document.querySelectorAll('.reveal');
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce || !('IntersectionObserver' in window)) {
    reveals.forEach(function (el) { el.classList.add('in'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    reveals.forEach(function (el) { io.observe(el); });
  }

  /* ---------- FAQ accordion ---------- */
  document.querySelectorAll('.faq-q').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var item = btn.closest('.faq-item');
      var willOpen = !item.classList.contains('open');
      document.querySelectorAll('.faq-item.open').forEach(function (o) {
        o.classList.remove('open');
        o.querySelector('.faq-q').setAttribute('aria-expanded', 'false');
      });
      if (willOpen) { item.classList.add('open'); btn.setAttribute('aria-expanded', 'true'); }
    });
  });

  /* ---------- Price calculator (هم‌خوان با js/plans.js) ---------- */
  var FREE_LIMIT = 4;           // پلن رایگان تا ۴ واحد
  var PRICE_PER_UNIT = 100000;  // تومان، سالانه
  var MAX_UNITS = 2000;

  var range = document.getElementById('unitsRange');
  var input = document.getElementById('unitsInput');
  var plus = document.getElementById('unitsPlus');
  var minus = document.getElementById('unitsMinus');
  var elPlan = document.getElementById('crPlan');
  var elPrice = document.getElementById('crPrice');
  var elBreak = document.getElementById('crBreak');
  var elMonth = document.getElementById('crMonth');

  function formatToman(p) {
    if (p >= 1000000) {
      var m = p / 1000000;
      var txt = (Math.round(m * 10) / 10).toString().replace('.', '٫');
      return toFa(txt) + ' میلیون تومان';
    }
    return faNum(p) + ' تومان';
  }

  function render(units, fromInput) {
    units = Math.max(1, Math.min(MAX_UNITS, Math.floor(units) || 1));
    range.value = Math.min(units, Number(range.max));
    if (!fromInput) input.value = toFa(units);
    var pct = (Math.min(units, Number(range.max)) - range.min) / (range.max - range.min) * 100;
    range.style.background = 'linear-gradient(to left, #5b4cdb ' + pct + '%, #c7d2fe ' + pct + '%)';

    if (units <= FREE_LIMIT) {
      elPlan.textContent = 'پلن رایگان';
      elPrice.textContent = 'رایگان';
      elBreak.textContent = 'ساختمان‌های تا ' + toFa(FREE_LIMIT) + ' واحد هزینه‌ای ندارند';
      elMonth.textContent = 'برای همه امکانات، پلن حرفه‌ای را فعال کنید';
    } else {
      var total = units * PRICE_PER_UNIT;
      elPlan.textContent = 'پلن حرفه‌ای';
      elPrice.textContent = formatToman(total);
      elBreak.textContent = 'سالانه · ' + faNum(units) + ' واحد × ' + faNum(PRICE_PER_UNIT) + ' تومان';
      elMonth.textContent = 'معادل ماهانه حدود ' + faNum(Math.round(total / 12 / 1000) * 1000) + ' تومان برای کل ساختمان';
    }
  }

  if (range && input) {
    range.addEventListener('input', function () { render(Number(range.value)); });
    input.addEventListener('input', function () {
      var raw = toEn(input.value).replace(/\D/g, '');
      input.value = toFa(raw);
      if (raw) render(Number(raw), true);
    });
    input.addEventListener('blur', function () { render(Number(toEn(input.value)) || 1); });
    plus.addEventListener('click', function () { render((Number(toEn(input.value)) || 0) + 1); });
    minus.addEventListener('click', function () { render((Number(toEn(input.value)) || 2) - 1); });
    render(Number(range.value));
  }

  /* ---------- Footer year (شمسی) ---------- */
  try {
    var y = new Intl.DateTimeFormat('fa-IR-u-ca-persian', { year: 'numeric' }).format(new Date());
    var yEl = document.getElementById('year');
    if (yEl && y) yEl.textContent = y.replace(/[^\u06F0-\u06F9]/g, '');
  } catch (e) { /* مقدار پیش‌فرض بماند */ }
})();
