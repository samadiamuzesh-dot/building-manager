/* ============================================================
   🧩 صفحه مدیر بلوک (block.html) — ورود و ثبت‌نام مدیر بلوک
   - ورود: کد ساختمان + موبایل + رمز → پنل محدود به بلوک (index.html)
   - ثبت‌نام: درخواست «در انتظار» به سرور؛ تا تأیید مدیر کل ورود ممکن نیست
   به auth.js (normalizePhone, showToastAuth) و sync.js (AptSync) وابسته است.
   ============================================================ */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const NET_ERR = 'اتصال به سرور برقرار نشد. اینترنت را بررسی کنید.';
  const OLD_SERVER = 'سرور همگام‌سازی هنوز به‌روز نشده است (نسخه ۱.۳ لازم است). لطفاً به مدیر ساختمان خبر دهید.';

  function blockSessionActive() {
    try {
      const s = JSON.parse(localStorage.getItem('ham_sakhteman_block_session') || 'null');
      return !!(s && s.managerPhone && s.block) && localStorage.getItem('ham_sakhteman_logged_out') !== 'true';
    } catch (e) { return false; }
  }

  /* ---------- پیام وضعیت بالای فرم ---------- */
  function setStatus(kind, title, text) {
    const el = $('blockStatus');
    if (!el) return;
    if (!kind) { el.className = 'auth-status'; el.innerHTML = ''; return; }
    el.className = 'auth-status show ' + kind;
    el.innerHTML = (title ? `<span class="auth-status-title">${esc(title)}</span>` : '') + esc(text || '');
  }

  function switchTab(name) {
    document.querySelectorAll('[data-block-tab]').forEach(t => t.classList.toggle('active', t.dataset.blockTab === name));
    document.querySelectorAll('[data-block-tab-content]').forEach(c => c.classList.toggle('active', c.dataset.blockTabContent === name));
  }

  function fieldError(errEl, inputs) {
    return (el, msg) => {
      inputs.forEach(i => i && i.classList.remove('input-error'));
      if (el) el.classList.add('input-error');
      errEl.textContent = msg; errEl.classList.add('show');
      return false;
    };
  }

  /* ---------- ورود ---------- */
  async function handleBlockLoginSubmit() {
    const codeEl = $('blockLoginCode'), phoneEl = $('blockLoginPhone'), passEl = $('blockLoginPassword');
    const errEl = $('blockLoginError'), btn = $('btnBlockLoginSubmit');
    const code = (codeEl.value || '').trim();
    const phone = normalizePhone(phoneEl.value || '');
    const pass = passEl.value || '';
    [codeEl, phoneEl, passEl].forEach(el => el.classList.remove('input-error'));
    errEl.classList.remove('show');
    const fail = fieldError(errEl, [codeEl, phoneEl, passEl]);
    if (!code) return fail(codeEl, 'کد ساختمان را وارد کنید (از مدیر ساختمان بگیرید).');
    if (!/^09\d{9}$/.test(phone)) return fail(phoneEl, 'شماره موبایل معتبر نیست.');
    if (!pass) return fail(passEl, 'رمز عبور را وارد کنید.');
    if (!window.AptSync || !window.AptSync.blockLogin) return fail(null, NET_ERR);
    // روی این دستگاه مدیر کل وارد است: ورود مدیر بلوک جای آن را می‌گیرد
    const mainLoggedIn = !!localStorage.getItem('ham_sakhteman_user_password') && localStorage.getItem('ham_sakhteman_logged_out') !== 'true' && !blockSessionActive();
    if (mainLoggedIn && typeof window.appConfirm === 'function') {
      const go = await window.appConfirm('روی این دستگاه حساب مدیر کل ساختمان باز است.\n\nبا ورود مدیر بلوک، حساب مدیر کل روی این دستگاه بسته می‌شود (اطلاعاتش روی سرور می‌ماند). ادامه می‌دهید؟', { okText: 'ادامه', cancelText: 'انصراف' });
      if (!go) return;
    }
    btn.disabled = true; btn.dataset.label = btn.dataset.label || btn.textContent; btn.textContent = '⏳ در حال ورود…';
    try {
      await window.AptSync.blockLogin(code, phone, window.AptSync.hashBlockPassword(pass));
      setStatus('ok', '✅ تأیید شده', 'خوش آمدید! پنل مدیر بلوک باز می‌شود…');
      showToastAuth('خوش آمدید! پنل مدیر بلوک باز می‌شود…', 'success');
      setTimeout(() => window.location.replace('index.html'), 700);
    } catch (e) {
      btn.disabled = false; btn.textContent = btn.dataset.label || '🚀 ورود به پنل بلوک';
      const st = e && e.status, err = e && e.message;
      if (st === 403 && err === 'pending') {
        setStatus('pending', '⏳ در انتظار تأیید', 'درخواست ثبت‌نام شما هنوز توسط مدیر ساختمان تأیید نشده است. بعد از تأیید با همین شماره و رمز وارد شوید.');
      } else if (st === 403 && err === 'rejected') {
        setStatus('error', '❌ درخواست رد شد', 'مدیر ساختمان درخواست مدیر بلوک شما را رد کرده است. می‌توانید با او تماس بگیرید یا دوباره ثبت‌نام کنید.');
      } else if (st === 403) {
        setStatus(null); fail(phoneEl, 'دسترسی این مدیر بلوک غیرفعال شده است. با مدیر ساختمان تماس بگیرید.');
      } else if (st === 401) { setStatus(null); fail(passEl, 'رمز عبور اشتباه است.'); }
      else if (st === 404) {
        setStatus(null);
        if (err === 'not_found') fail(codeEl, 'ساختمانی با این کد پیدا نشد. کد را دوباره بررسی کنید.');
        else fail(phoneEl, 'این شماره به‌عنوان مدیر بلوک ثبت نشده است. از تب «ثبت‌نام مدیر بلوک» درخواست بدهید.');
      } else if (st === 429) { setStatus(null); fail(null, 'تلاش‌های زیاد؛ ۱۵ دقیقه دیگر دوباره امتحان کنید.'); }
      else { setStatus(null); fail(null, NET_ERR); }
    }
  }

  /* ---------- بلوک‌های ساختمان (برای فرم ثبت‌نام) ---------- */
  let blocksMode = 'select'; // select | text
  let infoSeq = 0, infoTimer = null, lastInfoCode = '';
  function setBlockOptions(names, placeholder) {
    const sel = $('blockRegBlock'), txt = $('blockRegBlockText');
    blocksMode = 'select';
    sel.style.display = ''; txt.style.display = 'none';
    sel.innerHTML = `<option value="">${esc(placeholder)}</option>` + (names || []).map(n => `<option value="${esc(n)}">بلوک ${esc(n)}</option>`).join('');
    sel.disabled = !(names && names.length);
  }
  function useTextBlock() {
    blocksMode = 'text';
    $('blockRegBlock').style.display = 'none';
    $('blockRegBlockText').style.display = '';
  }
  function codeHint(kind, text) {
    const h = $('blockRegCodeHint');
    h.textContent = text || '';
    h.style.color = kind === 'error' ? '#dc2626' : (kind === 'ok' ? '#059669' : '#94a3b8');
    $('blockRegCode').classList.toggle('input-error', kind === 'error');
  }
  async function loadBlocks(force) {
    const code = ($('blockRegCode').value || '').trim().toUpperCase();
    if (!force && code === lastInfoCode) return;
    lastInfoCode = code;
    const seq = ++infoSeq;
    if (code.length < 3) { codeHint('', ''); setBlockOptions([], 'اول کد ساختمان را وارد کنید'); return; }
    if (!window.AptSync || !window.AptSync.blockInfo) { codeHint('', ''); useTextBlock(); return; }
    codeHint('', '⏳ در حال بررسی کد ساختمان…');
    try {
      const j = await window.AptSync.blockInfo(code);
      if (seq !== infoSeq) return;
      if (!j.complex) {
        codeHint('error', 'این ساختمان بلوک‌بندی ندارد؛ مدیر بلوک فقط برای مجتمع‌های چندبلوکی است.');
        setBlockOptions([], '—');
        return;
      }
      codeHint('ok', '✅ ' + (j.name ? `ساختمان «${j.name}»` : 'ساختمان پیدا شد') + ' — بلوک خود را انتخاب کنید.');
      setBlockOptions(j.blocks || [], (j.blocks || []).length ? 'بلوک را انتخاب کنید' : 'بلوکی ثبت نشده است');
    } catch (e) {
      if (seq !== infoSeq) return;
      if (e && e.status === 404) { codeHint('error', 'ساختمانی با این کد پیدا نشد.'); setBlockOptions([], 'اول کد درست را وارد کنید'); }
      else if (e && e.status === 429) { codeHint('error', 'تلاش‌های زیاد؛ کمی بعد دوباره امتحان کنید.'); }
      else { codeHint('', 'فهرست بلوک‌ها دریافت نشد؛ نام بلوک را بنویسید (سرور آن را بررسی می‌کند).'); useTextBlock(); }
    }
  }

  /* ---------- ثبت‌نام ---------- */
  async function handleBlockRegisterSubmit() {
    const codeEl = $('blockRegCode'), selEl = $('blockRegBlock'), txtEl = $('blockRegBlockText'), nameEl = $('blockRegName');
    const phoneEl = $('blockRegPhone'), passEl = $('blockRegPassword'), pass2El = $('blockRegPassword2');
    const errEl = $('blockRegError'), btn = $('btnBlockRegSubmit');
    const all = [codeEl, selEl, txtEl, nameEl, phoneEl, passEl, pass2El];
    all.forEach(el => el.classList.remove('input-error'));
    errEl.classList.remove('show');
    const fail = fieldError(errEl, all);
    const code = (codeEl.value || '').trim().toUpperCase();
    const blockEl = blocksMode === 'text' ? txtEl : selEl;
    const block = String(blockEl.value || '').trim();
    const name = (nameEl.value || '').trim().replace(/\s+/g, ' ');
    const phone = normalizePhone(phoneEl.value || '');
    const pass = passEl.value || '', pass2 = pass2El.value || '';
    if (!code) return fail(codeEl, 'کد ساختمان را وارد کنید (از مدیر ساختمان بگیرید).');
    if (!block) return fail(blockEl, 'بلوک خود را انتخاب کنید.');
    if (name.length < 2) return fail(nameEl, 'نام و نام خانوادگی را وارد کنید.');
    if (!/^09\d{9}$/.test(phone)) return fail(phoneEl, 'شماره موبایل باید ۱۱ رقم و با ۰۹ شروع شود.');
    if (pass.length < 6) return fail(passEl, 'رمز باید حداقل ۶ کاراکتر باشد.');
    if (pass !== pass2) return fail(pass2El, 'تکرار رمز با رمز یکی نیست.');
    if (!window.AptSync || !window.AptSync.blockRegister) return fail(null, NET_ERR);
    btn.disabled = true; btn.dataset.label = btn.dataset.label || btn.textContent; btn.textContent = '⏳ در حال ارسال…';
    try {
      await window.AptSync.blockRegister({ code, block, name, phone, passHash: window.AptSync.hashBlockPassword(pass) });
      btn.disabled = false; btn.textContent = btn.dataset.label;
      // فرم ورود برای بعد از تأیید آماده شود
      $('blockLoginCode').value = code; $('blockLoginPhone').value = phone; $('blockLoginPassword').value = pass;
      [passEl, pass2El].forEach(el => { el.value = ''; });
      switchTab('login');
      setStatus('pending', '⏳ درخواست ثبت شد — در انتظار تأیید', `درخواست مدیر بلوک ${block} برای مدیر ساختمان فرستاده شد. بعد از تأیید او، با همین شماره و رمز از همین صفحه وارد شوید. (برای دیدن وضعیت، دکمه ورود را بزنید.)`);
      showToastAuth('درخواست شما ثبت شد و در انتظار تأیید مدیر ساختمان است.', 'success');
    } catch (e) {
      btn.disabled = false; btn.textContent = btn.dataset.label || '📨 ارسال درخواست ثبت‌نام';
      const st = e && e.status, err = e && e.message, d = (e && e.data) || {};
      if (st === 404) return fail(codeEl, 'ساختمانی با این کد پیدا نشد. کد را دوباره بررسی کنید.');
      if (st === 409 && err === 'not_complex') return fail(codeEl, 'این ساختمان بلوک‌بندی ندارد؛ مدیر بلوک فقط برای مجتمع‌های چندبلوکی است.');
      if (st === 400 && err === 'bad_block') {
        if (Array.isArray(d.blocks) && d.blocks.length) setBlockOptions(d.blocks, 'بلوک را انتخاب کنید');
        return fail(blocksMode === 'text' ? txtEl : selEl, 'این بلوک در ساختمان نیست. بلوک درست را انتخاب کنید.');
      }
      if (st === 409 && err === 'phone_exists') {
        if (d.status === 'pending') {
          setStatus('pending', '⏳ در انتظار تأیید', 'با این شماره قبلاً درخواست مدیر بلوک ثبت شده و هنوز در انتظار تأیید مدیر ساختمان است.');
          return fail(phoneEl, 'برای این شماره درخواست قبلی هنوز در انتظار تأیید است.');
        }
        return fail(phoneEl, 'این شماره قبلاً به‌عنوان مدیر بلوک این ساختمان ثبت شده است؛ از تب «ورود مدیر بلوک» وارد شوید.');
      }
      if (st === 400 && err === 'bad_name') return fail(nameEl, 'نام وارد شده معتبر نیست.');
      if (st === 400 && err === 'unknown_action') return fail(null, OLD_SERVER);
      if (st === 429) return fail(null, err === 'too_many_pending' ? 'درخواست‌های بررسی‌نشده این ساختمان زیاد است؛ لطفاً با مدیر ساختمان تماس بگیرید.' : 'تلاش‌های زیاد؛ کمی بعد دوباره امتحان کنید.');
      if (st === 400) return fail(null, 'اطلاعات وارد شده کامل نیست.');
      return fail(null, NET_ERR);
    }
  }

  function init() {
    if (blockSessionActive()) { window.location.replace('index.html'); return; }
    const qs = new URLSearchParams(window.location.search);
    document.querySelectorAll('[data-block-tab]').forEach(t => t.addEventListener('click', () => { switchTab(t.dataset.blockTab); }));
    document.querySelectorAll('[data-goto-block-tab]').forEach(a => a.addEventListener('click', () => switchTab(a.dataset.gotoBlockTab)));
    document.querySelectorAll('[data-toggle-pass]').forEach(btn => btn.addEventListener('click', () => {
      const input = $(btn.dataset.togglePass);
      if (!input) return;
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      btn.textContent = show ? '🙈' : '👁️';
    }));
    $('btnBlockLoginSubmit').addEventListener('click', handleBlockLoginSubmit);
    $('blockLoginPassword').addEventListener('keypress', (e) => { if (e.key === 'Enter') handleBlockLoginSubmit(); });
    $('btnBlockRegSubmit').addEventListener('click', handleBlockRegisterSubmit);
    $('blockRegPassword2').addEventListener('keypress', (e) => { if (e.key === 'Enter') handleBlockRegisterSubmit(); });
    const codeEl = $('blockRegCode');
    codeEl.addEventListener('input', () => { clearTimeout(infoTimer); infoTimer = setTimeout(() => loadBlocks(false), 600); });
    codeEl.addEventListener('change', () => { clearTimeout(infoTimer); loadBlocks(false); });
    // پیام خروج اجباری (مثلاً غیرفعال شدن دسترسی)
    try {
      const n = sessionStorage.getItem('apt_login_notice');
      if (n) { sessionStorage.removeItem('apt_login_notice'); setStatus('error', '', n); }
    } catch (e) {}
    const code = (qs.get('code') || '').trim();
    if (code) { $('blockLoginCode').value = code; codeEl.value = code; }
    if (qs.get('tab') === 'register') { switchTab('register'); if (code) loadBlocks(true); }
  }

  window.handleBlockLoginSubmit = handleBlockLoginSubmit;
  window.handleBlockRegisterSubmit = handleBlockRegisterSubmit;
  window.loadBlockRegisterBlocks = loadBlocks;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
