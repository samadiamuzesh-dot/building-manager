/* ============================================================
   🔐 سیستم احراز هویت — آپارتمان پلاس
   ============================================================ */

const AUTH_KEY = 'ham_sakhteman_auth';
const USER_PHONE_KEY = 'ham_sakhteman_user_phone';
const USER_PASSWORD_KEY = 'ham_sakhteman_user_password';
const LOGGED_OUT_KEY = 'ham_sakhteman_logged_out';

function saveUserAuth(phone, password) {
  const hash = simpleHashAuth(password);
  localStorage.setItem(USER_PHONE_KEY, phone);
  localStorage.setItem(USER_PASSWORD_KEY, hash);
  localStorage.setItem(AUTH_KEY, JSON.stringify({
    phone: phone,
    createdAt: new Date().toISOString(),
  }));
  localStorage.removeItem(LOGGED_OUT_KEY);
}

function checkUserAuth(phone, password) {
  const savedPhone = localStorage.getItem(USER_PHONE_KEY);
  const savedHash = localStorage.getItem(USER_PASSWORD_KEY);

  if (!savedPhone || !savedHash) {
    return { ok: false, error: 'حساب کاربری وجود ندارد. لطفاً ثبت‌نام کنید.' };
  }

  const cleanPhone = normalizePhone(phone);
  const cleanSavedPhone = normalizePhone(savedPhone);

  if (cleanPhone !== cleanSavedPhone) {
    return { ok: false, error: 'شماره موبایل یافت نشد.' };
  }

  const inputHash = simpleHashAuth(password);
  if (inputHash !== savedHash) {
    return { ok: false, error: 'رمز عبور اشتباه است.' };
  }

  return { ok: true };
}

function logoutUser() {
  localStorage.setItem(LOGGED_OUT_KEY, 'true');
  window.location.href = 'login.html';
}

function isLoggedIn() {
  const phone = localStorage.getItem(USER_PHONE_KEY);
  const password = localStorage.getItem(USER_PASSWORD_KEY);
  const loggedOut = localStorage.getItem(LOGGED_OUT_KEY);

  if (loggedOut === 'true') {
    return false;
  }

  return !!(phone && password);
}

function normalizePhone(phone) {
  const persianDigits = '۰۱۲۳۴۵۶۷۸۹';
  const arabicDigits = '٠١٢٣٤٥٦٧٨٩';
  let cleaned = String(phone);
  for (let i = 0; i < 10; i++) {
    cleaned = cleaned.replace(new RegExp(persianDigits[i], 'g'), i);
    cleaned = cleaned.replace(new RegExp(arabicDigits[i], 'g'), i);
  }
  return cleaned.replace(/[^\d]/g, '');
}

function simpleHashAuth(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return 'h_' + Math.abs(hash).toString(36);
}

function showToastAuth(message, type = 'success') {
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const icons = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️'
  };

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
      <div class="toast-title">${titles[type] || 'پیام'}</div>
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

function initLoginPage() {
  localStorage.removeItem(LOGGED_OUT_KEY);

  const hasAuth = !!localStorage.getItem(USER_PHONE_KEY)
               && !!localStorage.getItem(USER_PASSWORD_KEY);

  if (hasAuth) {
    window.location.replace('index.html');
    return;
  }

  document.querySelectorAll('.login-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.loginTab;
      document.querySelectorAll('.login-tab').forEach(t => {
        t.classList.toggle('active', t.dataset.loginTab === target);
      });
      document.querySelectorAll('.login-tab-content').forEach(c => {
        c.classList.toggle('active', c.dataset.loginTabContent === target);
      });
    });
  });

  document.querySelectorAll('[data-switch-to-signup]').forEach(el => {
    el.addEventListener('click', () => {
      document.querySelector('.login-tab[data-login-tab="signup"]').click();
    });
  });

  document.querySelectorAll('[data-switch-to-login]').forEach(el => {
    el.addEventListener('click', () => {
      document.querySelector('.login-tab[data-login-tab="login"]').click();
    });
  });

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

  document.getElementById('btnLoginSubmit')?.addEventListener('click', handleLoginSubmit);

  document.getElementById('btnStartSignup')?.addEventListener('click', () => {
    localStorage.removeItem(LOGGED_OUT_KEY);
    localStorage.removeItem(USER_PHONE_KEY);
    localStorage.removeItem(USER_PASSWORD_KEY);
    localStorage.removeItem(AUTH_KEY);
    window.location.href = 'index.html?signup=1';
  });

  document.getElementById('loginPassword')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleLoginSubmit();
  });
  document.getElementById('loginPhone')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') document.getElementById('loginPassword').focus();
  });
}

function handleLoginSubmit() {
  const phoneInput = document.getElementById('loginPhone');
  const passwordInput = document.getElementById('loginPassword');
  const phoneError = document.getElementById('loginPhoneError');
  const passwordError = document.getElementById('loginPasswordError');

  const phone = phoneInput.value.trim();
  const password = passwordInput.value;

  phoneInput.classList.remove('input-error');
  passwordInput.classList.remove('input-error');
  phoneError.classList.remove('show');
  passwordError.classList.remove('show');

  if (!phone) {
    phoneInput.classList.add('input-error');
    phoneError.textContent = 'لطفاً شماره موبایل را وارد کنید.';
    phoneError.classList.add('show');
    return;
  }

  if (!password) {
    passwordInput.classList.add('input-error');
    passwordError.textContent = 'لطفاً رمز عبور را وارد کنید.';
    passwordError.classList.add('show');
    return;
  }

  const result = checkUserAuth(phone, password);

  if (!result.ok) {
    if (result.error.includes('رمز')) {
      passwordInput.classList.add('input-error');
      passwordError.textContent = result.error;
      passwordError.classList.add('show');
    } else {
      phoneInput.classList.add('input-error');
      phoneError.textContent = result.error;
      phoneError.classList.add('show');
    }
    return;
  }

  localStorage.removeItem(LOGGED_OUT_KEY);
  showToastAuth('خوش آمدید! در حال ورود...', 'success');

  setTimeout(() => {
    window.location.replace('index.html');
  }, 800);
}

// ✅ فقط روی صفحه لاگین اجرا بشه (جلوگیری از رفرش بی‌نهایت در index.html)
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('btnLoginSubmit') || document.querySelector('.login-page')) {
    initLoginPage();
  }
});
