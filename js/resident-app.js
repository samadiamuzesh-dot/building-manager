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

function loadData() {
  const raw = localStorage.getItem('ham_sakhteman_v3');
  if (raw) { try { return JSON.parse(raw); } catch (e) { return null; } }
  return null;
}

function loadUnits() {
  const raw = localStorage.getItem('ham_sakhteman_units');
  if (raw) { try { return JSON.parse(raw); } catch (e) { return []; } }
  return [];
}

function loadCharges() {
  const raw = localStorage.getItem('ham_sakhteman_charges');
  if (raw) { try { return JSON.parse(raw); } catch (e) { return []; } }
  return [];
}

function loadNotices() {
  const raw = localStorage.getItem('ham_sakhteman_notices');
  if (raw) { try { return JSON.parse(raw); } catch (e) { return []; } }
  return [];
}

function loadMessages() {
  const raw = localStorage.getItem('ham_sakhteman_messages');
  if (raw) { try { return JSON.parse(raw); } catch (e) { return []; } }
  return [];
}

function loadVotings() {
  const raw = localStorage.getItem('ham_sakhteman_votings');
  if (raw) { try { return JSON.parse(raw); } catch (e) { return []; } }
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
  const units = loadUnits();
  const unitSelect = document.getElementById('residentUnitSelect');

  const filtered = units.filter(u => {
    if (blockName === '—' || !blockName) {
      return u.block === '—' || !u.block;
    }
    return String(u.block).trim() === String(blockName).trim();
  });

  if (filtered.length === 0) {
    unitSelect.innerHTML = '<option value="">— واحدی یافت نشد —</option>';
    return;
  }

  unitSelect.innerHTML = '<option value="">— انتخاب کن —</option>';
  filtered.forEach(u => {
    const opt = document.createElement('option');
    opt.value = u.number;
    opt.textContent = 'واحد ' + toPersianNumR(u.number);
    unitSelect.appendChild(opt);
  });
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
  const registered = loadRegisteredResidents();
  const alreadyRegistered = registered.find(r =>
    r.buildingCode === tempBuildingCode &&
    String(r.block).trim() === String(blockName).trim() &&
    r.unitNumber === unitNumber
  );

  if (alreadyRegistered) {
    errorEl.textContent = 'این واحد قبلاً ثبت‌نام کرده است. با مدیر تماس بگیرید.';
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

  // ذخیره ثبت‌نام
  const registered = loadRegisteredResidents();

  const newId = registered.length > 0 ? Math.max(...registered.map(r => r.id || 0)) + 1 : 1;

  const newResident = {
    id: newId,
    buildingCode: tempBuildingCode,
    block: tempBlock,
    unitNumber: tempUnitNumber,
    name: name,
    phone: phone,
    role: role,
    password: password,
    registeredAt: new Date().toISOString(),
    status: 'pending', // در انتظار تأیید مدیر
  };

  registered.push(newResident);
  saveRegisteredResidents(registered);

  // نشست
  setResidentSession({
    residentId: newId,
    buildingCode: tempBuildingCode,
    block: tempBlock,
    unitNumber: tempUnitNumber,
    name: name,
    phone: phone,
    role: role,
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
  const notices = loadNotices();
  const messages = loadMessages();

  const unitCharges = charges.filter(c =>
    String(c.block).trim() === String(session.block).trim() &&
    Number(getUnitNumberById(c.unitId)) === Number(session.unitNumber)
  );

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

  document.getElementById('residentWelcomeText').textContent =
    `به اپلیکیشن آپارتمان پلاس خوش آمدید، ${session.name}. می‌تونی شارژها، اطلاعیه‌ها، پیام‌ها و رأی‌گیری‌ها رو از اینجا ببینی.`;

  // آخرین شارژ
  const lastChargeBox = document.getElementById('residentLastCharge');
  if (unitCharges.length === 0) {
    lastChargeBox.innerHTML = '<p style="text-align:center; color:#94a3b8; padding:20px;">هنوز شارژی صادر نشده</p>';
  } else {
    const last = unitCharges[unitCharges.length - 1];
    const status = last.paid
      ? '<span style="color:#16a34a; font-weight:800;">✅ پرداخت شده</span>'
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
   if (pageKey === 'messages') renderResidentMessages();
  if (pageKey === 'voting') renderResidentVoting();
  if (pageKey === 'profile') renderResidentProfile();
}

function renderResidentCharges() {
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
      // پرداخت شده
      status = '<span style="color:#16a34a; font-weight:800;">✅ پرداخت شده</span>';
      extraInfo = `
        <div style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid #f1f5f9;">
          <span style="color:#64748b;">تاریخ پرداخت</span>
          <strong>${c.paidDate || '—'}</strong>
        </div>
        <div style="display:flex; justify-content:space-between; padding:8px 0;">
          <span style="color:#64748b;">روش پرداخت</span>
          <strong>${c.payMethod || '—'}</strong>
        </div>
      `;
    } else if (c.pendingApproval) {
      // در انتظار تأیید مدیر
      status = '<span style="color:#f59e0b; font-weight:800;">⏳ در انتظار تأیید مدیر</span>';
      extraInfo = `
        <div style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid #f1f5f9;">
          <span style="color:#64748b;">روش پرداخت</span>
          <strong>${c.payMethod || '—'}</strong>
        </div>
        <div style="display:flex; justify-content:space-between; padding:8px 0;">
          <span style="color:#64748b;">تاریخ اعلام</span>
          <strong>${new Date(c.pendingAt).toLocaleDateString('fa-IR')}</strong>
        </div>
      `;
    } else {
      // پرداخت نشده
      status = '<span style="color:#dc2626; font-weight:800;">⚠️ پرداخت نشده</span>';
      payButton = `<button class="resident-pay-btn" data-pay-charge-id="${c.id}">💳 پرداخت</button>`;
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
        ${c.paid ? `
          <div style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid #f1f5f9;">
            <span style="color:#64748b;">تاریخ پرداخت</span>
            <strong>${c.paidDate || '—'}</strong>
          </div>
          <div style="display:flex; justify-content:space-between; padding:8px 0;">
            <span style="color:#64748b;">روش پرداخت</span>
            <strong>${c.payMethod || '—'}</strong>
          </div>
        ` : ''}
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
function renderResidentNotices() {
  const container = document.getElementById('residentNoticesList');
  if (!container) return;

  const notices = loadNotices();

  if (notices.length === 0) {
    container.innerHTML = '<p style="text-align:center; color:#94a3b8; padding:40px;">هنوز اطلاعیه‌ای ثبت نشده</p>';
    return;
  }

  container.innerHTML = [...notices].reverse().map(n => `
    <div class="resident-card">
      <div style="display:flex; justify-content:space-between; align-items:start; margin-bottom:8px;">
        <h3 style="font-size:15px; font-weight:800;">${n.title}</h3>
        <span style="font-size:11.5px; color:#94a3b8;">${n.date || ''}</span>
      </div>
      <p style="font-size:13.5px; color:#64748b; line-height:1.8;">${n.body}</p>
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
  residentCurrentChatUnitId = unitId;

  document.querySelectorAll('.resident-page').forEach(p => p.classList.remove('active'));
  document.getElementById('resident-chat').classList.add('active');

  document.querySelectorAll('.resident-nav-item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.residentPage === 'messages');
  });

  const title = document.getElementById('residentChatTitle');
  const subtitle = document.getElementById('residentChatSubtitle');

  if (subject) {
    title.textContent = subject;
  } else {
    title.textContent = 'گفتگوی جدید';
  }

  subtitle.textContent = 'پاسخگویی توسط مدیر ساختمان';

  renderResidentChatMessages(subject);

  // پاک کردن فرم
  const input = document.getElementById('residentChatInput');
  if (input) input.value = '';

  // فوکوس
  setTimeout(() => input?.focus(), 200);

  // شروع چک خودکار
  if (residentChatInterval) clearInterval(residentChatInterval);
  residentChatInterval = setInterval(() => {
    renderResidentChatMessages(subject);
  }, 2000);
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

/* ============ پیام‌ها — چت مستقیم با مدیر ============ */

function renderResidentMessages() {
  const container = document.getElementById('residentChatMessages');
  if (!container) return;

  const session = getResidentSession();
  if (!session) return;

  const myUnitId = getUnitIdBySession();
  if (!myUnitId) {
    container.innerHTML = '<p style="text-align:center; color:#94a3b8; padding:40px;">واحد شما یافت نشد</p>';
    return;
  }

  const messages = loadMessages()
    .filter(m => Number(m.unitId) === Number(myUnitId))
    .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));

  // علامت‌گذاری خوانده‌شده
  let changed = false;
  const allMsgs = loadMessages();
  allMsgs.forEach(m => {
    if (Number(m.unitId) === Number(myUnitId) && m.direction === 'sent' && !m.read) {
      m.read = true;
      changed = true;
    }
  });
  if (changed) {
    localStorage.setItem('ham_sakhteman_messages', JSON.stringify(allMsgs));
  }

  if (messages.length === 0) {
    container.innerHTML = `
      <div style="text-align:center; color:#94a3b8; padding:60px 20px; font-size: 14px;">
        <div style="font-size: 56px; margin-bottom: 14px;">💬</div>
        هنوز پیامی بین شما و مدیر رد و بدل نشده.<br>
        اولین پیام رو بنویس و بفرست.
      </div>
    `;
    return;
  }

  container.innerHTML = messages.map(m => {
    const isFromManager = m.direction === 'sent';
    const align = isFromManager ? 'flex-end' : 'flex-start';
    const bubbleClass = isFromManager ? 'resident-bubble-manager' : 'resident-bubble-me';

    // تیک‌ها فقط برای پیام‌های خود ساکن (نه مدیر)
    let checkHtml = '';
    if (!isFromManager) {
      if (m.delivered) {
        checkHtml = '<span class="resident-bubble-checks delivered">✓✓</span>';
      } else {
        checkHtml = '<span class="resident-bubble-checks sent">✓</span>';
      }
    }

    return `
      <div class="resident-chat-row" style="justify-content: ${align};">
        <div class="resident-chat-bubble ${bubbleClass}">
          <div class="resident-bubble-text">${(m.body || '').replace(/\n/g, '<br>')}</div>
          <div class="resident-bubble-footer">
            <span class="resident-bubble-time">${m.time || ''}</span>
            ${checkHtml}
          </div>
        </div>
      </div>
    `;
  }).join('');

  setTimeout(() => {
    const scrollBtn = document.getElementById('residentScrollBottomBtn');
    const isBtnVisible = scrollBtn?.classList.contains('show');

    if (!isBtnVisible) {
 container.scrollTop = container.scrollHeight;
    }
  }, 50);
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
  const newId = allMessages.length > 0
    ? Math.max(...allMessages.map(m => m.id || 0)) + 1
    : 1;

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

  localStorage.setItem('ham_sakhteman_messages', JSON.stringify(allMessages));

  input.value = '';
  renderResidentMessages();

  // ✅ بعد از ۸۰۰ میلی‌ثانیه، تیک دوم (آبی) اضافه بشه
  setTimeout(() => {
    const msgs = loadMessages();
    const target = msgs.find(x => x.id === newId);
    if (target) {
      target.delivered = true;
      localStorage.setItem('ham_sakhteman_messages', JSON.stringify(msgs));
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

  const votings = loadVotings();
  const active = votings.filter(v => {
    const now = new Date();
    const start = new Date(v.startDateTime || v.createdAt);
    const end = new Date(v.endDateTime || v.createdAt);
    return now >= start && now <= end;
  });

  if (active.length === 0) {
    container.innerHTML = '<p style="text-align:center; color:#94a3b8; padding:40px;">رأی‌گیری فعالی وجود ندارد</p>';
    return;
  }

  container.innerHTML = active.map(v => `
    <div class="resident-card">
      <h3 style="font-size:15px; font-weight:800; margin-bottom:8px;">${v.title}</h3>
      <p style="font-size:13px; color:#64748b; margin-bottom:12px;">${v.description || ''}</p>
      <p style="font-size:12px; color:#94a3b8;">⏰ از ${v.startDate} تا ${v.endDate}</p>
    </div>
  `).join('');
}

function renderResidentProfile() {
  const session = getResidentSession();
  const container = document.getElementById('residentProfileContent');
  if (!session || !container) return;

  const units = loadUnits();
  const myUnit = units.find(u => {
    if (session.block === '—' || !session.block) {
      return (u.block === '—' || !u.block) && Number(u.number) === Number(session.unitNumber);
    }
    return String(u.block).trim() === String(session.block).trim()
        && Number(u.number) === Number(session.unitNumber);
  });

  const roleLabel = session.role === 'owner' ? '👤 مالک' : '🏘️ مستاجر';
  const unitLabel = session.block && session.block !== '—'
    ? `${session.block} - واحد ${toPersianNumR(session.unitNumber)}`
    : `واحد ${toPersianNumR(session.unitNumber)}`;

  // ============ اطلاعات من ============
  let infoHtml = `
    <div class="resident-card">
      <div class="resident-card-header">
        <h3>👤 اطلاعات من</h3>
      </div>

      <div style="display:flex; justify-content:space-between; padding:10px 0; border-bottom:1px solid #f1f5f9;">
        <span style="color:#64748b;">نام</span>
        <strong>${session.name || '—'}</strong>
      </div>
      <div style="display:flex; justify-content:space-between; padding:10px 0; border-bottom:1px solid #f1f5f9;">
        <span style="color:#64748b;">موبایل</span>
        <strong dir="ltr">${session.phone || '—'}</strong>
      </div>
      <div style="display:flex; justify-content:space-between; padding:10px 0; border-bottom:1px solid #f1f5f9;">
        <span style="color:#64748b;">نقش</span>
        <strong>${roleLabel}</strong>
      </div>
      <div style="display:flex; justify-content:space-between; padding:10px 0;">
        <span style="color:#64748b;">واحد</span>
        <strong>${unitLabel}</strong>
      </div>
    </div>
  `;

  // ============ اطلاعات واحد ============
  if (myUnit) {
    infoHtml += `
      <div class="resident-card">
        <div class="resident-card-header">
          <h3>🏠 اطلاعات واحد</h3>
        </div>

        <div style="display:flex; justify-content:space-between; padding:10px 0; border-bottom:1px solid #f1f5f9;">
          <span style="color:#64748b;">بلوک</span>
          <strong>${myUnit.block || '—'}</strong>
        </div>
        <div style="display:flex; justify-content:space-between; padding:10px 0; border-bottom:1px solid #f1f5f9;">
          <span style="color:#64748b;">شماره واحد</span>
          <strong>${toPersianNumR(myUnit.number) || '—'}</strong>
        </div>
        <div style="display:flex; justify-content:space-between; padding:10px 0; border-bottom:1px solid #f1f5f9;">
          <span style="color:#64748b;">📐 متراژ</span>
          <strong>${myUnit.area ? formatNumberR(myUnit.area) + ' متر' : '—'}</strong>
        </div>
        <div style="display:flex; justify-content:space-between; padding:10px 0; border-bottom:1px solid #f1f5f9;">
          <span style="color:#64748b;">👥 تعداد افراد</span>
          <strong>${myUnit.peopleCount ? formatNumberR(myUnit.peopleCount) + ' نفر' : '—'}</strong>
        </div>
        <div style="display:flex; justify-content:space-between; padding:10px 0; border-bottom:1px solid #f1f5f9;">
          <span style="color:#64748b;">🚗 پارکینگ</span>
          <strong>${myUnit.parkingCount ? formatNumberR(myUnit.parkingCount) : '—'}</strong>
        </div>
        <div style="display:flex; justify-content:space-between; padding:10px 0;">
          <span style="color:#64748b;">📦 انباری</span>
          <strong>${myUnit.storageCount ? formatNumberR(myUnit.storageCount) : '—'}</strong>
        </div>
      </div>
    `;

    // ============ اطلاعات مالک ============
    if (myUnit.owner?.name) {
      infoHtml += `
        <div class="resident-card">
          <div class="resident-card-header">
            <h3>👤 مالک</h3>
          </div>

          <div style="display:flex; justify-content:space-between; padding:10px 0; border-bottom:1px solid #f1f5f9;">
            <span style="color:#64748b;">نام</span>
            <strong>${myUnit.owner.name}</strong>
          </div>
          <div style="display:flex; justify-content:space-between; padding:10px 0; border-bottom:1px solid #f1f5f9;">
            <span style="color:#64748b;">موبایل</span>
            <strong dir="ltr">${myUnit.owner.phone || '—'}</strong>
          </div>
          ${myUnit.owner.nationalId ? `
            <div style="display:flex; justify-content:space-between; padding:10px 0;">
              <span style="color:#64748b;">کد ملی</span>
              <strong dir="ltr">${myUnit.owner.nationalId}</strong>
            </div>
          ` : ''}
        </div>
      `;
    }

    // ============ اطلاعات ساکن ============
    if (myUnit.tenant?.name && session.role !== 'tenant') {
      infoHtml += `
        <div class="resident-card">
          <div class="resident-card-header">
            <h3>🏘️ ساکن</h3>
          </div>

          <div style="display:flex; justify-content:space-between; padding:10px 0; border-bottom:1px solid #f1f5f9;">
            <span style="color:#64748b;">نام</span>
            <strong>${myUnit.tenant.name}</strong>
          </div>
          <div style="display:flex; justify-content:space-between; padding:10px 0;">
            <span style="color:#64748b;">موبایل</span>
            <strong dir="ltr">${myUnit.tenant.phone || '—'}</strong>
          </div>
        </div>
      `;
    }
  } else {
    infoHtml += `
      <div class="resident-card" style="text-align:center; padding:30px;">
        <p style="color:#94a3b8;">اطلاعات واحد یافت نشد</p>
      </div>
    `;
  }

  // ============ دکمه خروج ============
  infoHtml += `
    <button class="resident-submit-btn" id="residentLogoutBtn2" style="background: linear-gradient(135deg, #ef4444 0%, #b91c1c 100%); margin-top: 20px;">
      🚪 خروج از حساب
    </button>
  `;

  container.innerHTML = infoHtml;

  document.getElementById('residentLogoutBtn2')?.addEventListener('click', logoutResident);
}

/* ============ خروج ============ */
function logoutResident() {
  if (!confirm('آیا از خروج مطمئن هستید؟')) return;
  clearResidentSession();
  showResidentToast('از حساب خارج شدید', 'success');
  setTimeout(() => location.reload(), 800);
}

/* ============ راه‌اندازی ============ */
function initResidentApp() {
  // اگه نشست هست، پنل رو باز کن
  const session = getResidentSession();
  if (session) {
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
     

  // نوار پایین
  document.querySelectorAll('.resident-nav-item').forEach(btn => {
  // چت
  bindResidentMessagesPage();
       bindResidentPayModal();
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

function openResidentPayModal(chargeId) {
  const charges = loadCharges();
  const charge = charges.find(c => c.id === chargeId);
  if (!charge) {
    showResidentToast('شارژ پیدا نشد.', 'error');
    return;
  }

  currentPayingChargeId = chargeId;

  const subtitle = document.getElementById('residentPaySubtitle');
  if (subtitle) subtitle.textContent = `${charge.month} ${toPersianNumR(charge.year)}`;

  document.getElementById('residentPayMonth').textContent = 
    `${charge.month} ${toPersianNumR(charge.year)}`;
  document.getElementById('residentPayAmount').textContent = 
    formatTomanR(charge.total || 0);
  document.getElementById('residentPayDueDate').textContent = 
    charge.dueDate || '—';

  document.getElementById('residentPayMethod').value = 'آنلاین';

  const modal = document.getElementById('residentPayModal');
  if (modal) modal.classList.add('open');
}

function closeResidentPayModal() {
  const modal = document.getElementById('residentPayModal');
  if (modal) modal.classList.remove('open');
  currentPayingChargeId = null;
}

function confirmResidentPay() {
  if (!currentPayingChargeId) return;

  const charges = loadCharges();
  const charge = charges.find(c => c.id === currentPayingChargeId);
  if (!charge) {
    showResidentToast('شارژ پیدا نشد.', 'error');
    return;
  }

  const method = document.getElementById('residentPayMethod')?.value || 'آنلاین';

  // ===== اگر آنلاین: خودکار تأیید =====
  if (method === 'آنلاین') {
    const now = new Date();
    const persianDate = now.toLocaleDateString('fa-IR');

    charge.paid = true;
    charge.paidDate = persianDate;
    charge.payMethod = method;
    charge.payDescription = 'پرداخت آنلاین توسط ساکن';
    charge.paidAt = now.toISOString();

    saveCharges(charges);
    updateResidentUnitDebt();

    closeResidentPayModal();
    showResidentToast('✅ پرداخت آنلاین با موفقیت انجام شد!', 'success');

    setTimeout(() => {
      renderResidentCharges();
      renderResidentDashboard();
    }, 300);
    return;
  }

  // ===== اگر کارت به کارت یا انتقال: در انتظار تأیید مدیر =====
  charge.payMethod = method;
  charge.payDescription = `اعلام پرداخت توسط ساکن - روش: ${method}`;
  charge.pendingApproval = true;      // ← در انتظار تأیید
  charge.pendingAt = new Date().toISOString();
  // paid رو false نگه می‌داریم

  saveCharges(charges);

  closeResidentPayModal();
  showResidentToast('📩 پرداخت شما ثبت شد. منتظر تأیید مدیر باشید.', 'info');

  setTimeout(() => {
    renderResidentCharges();
  }, 300);
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
  localStorage.setItem('ham_sakhteman_charges', JSON.stringify(charges));
}

function saveUnits(units) {
  localStorage.setItem('ham_sakhteman_units', JSON.stringify(units));
}

function saveMessages(messages) {
  localStorage.setItem('ham_sakhteman_messages', JSON.stringify(messages));
}

function saveNotices(notices) {
  localStorage.setItem('ham_sakhteman_notices', JSON.stringify(notices));
}

function saveVotings(votings) {
  localStorage.setItem('ham_sakhteman_votings', JSON.stringify(votings));
}

