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

  // پیدا کردن واحد کاربر
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

  const myCharges = charges.filter(c => c.unitId === userUnit.id);

  if (myCharges.length === 0) {
    container.innerHTML = '<p style="text-align:center; color:#94a3b8; padding:40px;">هنوز شارژی صادر نشده</p>';
    return;
  }

  container.innerHTML = [...myCharges].reverse().map(c => {
    const status = c.paid
      ? '<span style="color:#16a34a; font-weight:800;">✅ پرداخت شده</span>'
      : '<span style="color:#dc2626; font-weight:800;">⚠️ پرداخت نشده</span>';

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
        ${c.paid ? `
          <div style="display:flex; justify-content:space-between; padding:8px 0;">
            <span style="color:#64748b;">تاریخ پرداخت</span>
            <strong>${c.paidDate || '—'}</strong>
          </div>
        ` : ''}
      </div>
    `;
  }).join('');
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

function renderResidentMessages() {
  const container = document.getElementById('residentMessagesList');
  if (!container) return;

  const session = getResidentSession();
  if (!session) return;

  const myUnitId = getUnitIdBySession();

  const messages = loadMessages().filter(m =>
    myUnitId && Number(m.unitId) === Number(myUnitId)
  );

  if (messages.length === 0) {
    container.innerHTML = `
      <div class="resident-card" style="text-align:center;">
        <div style="font-size: 42px; margin-bottom: 10px;">💬</div>
        <p style="color:#64748b; font-size:13.5px;">
          هنوز پیامی رد و بدل نشده. اولین پیام رو به مدیر بفرست.
        </p>
      </div>
    `;
    return;
  }

  const sorted = [...messages].sort((a, b) =>
    (a.createdAt || '').localeCompare(b.createdAt || '')
  );

  container.innerHTML = sorted.map(m => {
    const isFromManager = m.direction === 'sent';
    const label = isFromManager ? '👨‍💼 مدیر ساختمان' : '👤 شما';
    const bgColor = isFromManager ? '#5b4cdb' : '#0f766e';
    const align = isFromManager ? 'flex-start' : 'flex-end';
    const borderRad = isFromManager
      ? 'border-top-right-radius: 4px;'
      : 'border-top-left-radius: 4px;';

    return `
      <div class="resident-card" style="display:flex; justify-content:${align}; background:transparent; box-shadow:none; border:none; padding:0; margin-bottom:10px;">
        <div style="max-width:85%; padding:12px 16px; border-radius:14px; ${borderRad} background:${bgColor}; color:#fff;">
          <div style="font-size:11.5px; opacity:0.85; margin-bottom:6px; font-weight:700;">
            ${label}
          </div>
          ${m.subject ? `<div style="font-size:13px; font-weight:800; margin-bottom:6px; opacity:0.95;">📌 ${m.subject}</div>` : ''}
          <div style="font-size:14px; line-height:1.7; word-wrap:break-word;">
            ${(m.body || '').replace(/\n/g, '<br>')}
          </div>
          <div style="font-size:10.5px; margin-top:8px; opacity:0.75; text-align:left;">
            ${m.time || ''} — ${m.date || ''}
          </div>
        </div>
      </div>
    `;
  }).join('');

  // اسکرول به آخرین پیام
  setTimeout(() => {
    container.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, 100);
}

function sendResidentMessage() {
  const session = getResidentSession();
  if (!session) return;

  const myUnitId = getUnitIdBySession();
  if (!myUnitId) {
    showResidentToast('واحد شما یافت نشد.', 'error');
    return;
  }

  const subjectInput = document.getElementById('residentMessageSubject');
  const bodyInput = document.getElementById('residentMessageBody');

  const subject = subjectInput.value.trim();
  const body = bodyInput.value.trim();

  if (!body) {
    showResidentToast('لطفاً متن پیام را وارد کنید.', 'warning');
    return;
  }

  const allMessages = loadMessages();
  const newId = allMessages.length > 0
    ? Math.max(...allMessages.map(m => m.id || 0)) + 1
    : 1;

  const now = new Date();
  const persianDate = now.toLocaleDateString('fa-IR');
  const persianTime = now.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });

  // پیدا کردن واحد برای نمایش بلوک و شماره
  const units = loadUnits();
  const userUnit = units.find(u => u.id === myUnitId);
  const unitLabel = userUnit
    ? (userUnit.block && userUnit.block !== '—'
        ? `${userUnit.block}-${toPersianNumR(userUnit.number)}`
        : `واحد ${toPersianNumR(userUnit.number)}`)
    : '—';

  allMessages.push({
    id: newId,
    unitId: myUnitId,
    unitLabel: unitLabel,
    ownerName: session.name,
    subject: subject || 'بدون موضوع',
    body: body,
    direction: 'received',
    read: false,
    date: persianDate,
    time: persianTime,
    createdAt: now.toISOString(),
  });

  localStorage.setItem('ham_sakhteman_messages', JSON.stringify(allMessages));

  subjectInput.value = '';
  bodyInput.value = '';

  showResidentToast('پیام شما به مدیر ارسال شد.', 'success');
  renderResidentMessages();
  renderResidentDashboard();
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

  const roleLabel = session.role === 'owner' ? '👤 مالک' : '🏘️ مستاجر';
  const unitLabel = session.block && session.block !== '—'
    ? `${session.block} - واحد ${toPersianNumR(session.unitNumber)}`
    : `واحد ${toPersianNumR(session.unitNumber)}`;

  container.innerHTML = `
    <div class="resident-card">
      <div style="display:flex; justify-content:space-between; padding:10px 0; border-bottom:1px solid #f1f5f9;">
        <span style="color:#64748b;">نام</span>
        <strong>${session.name}</strong>
      </div>
      <div style="display:flex; justify-content:space-between; padding:10px 0; border-bottom:1px solid #f1f5f9;">
        <span style="color:#64748b;">موبایل</span>
        <strong dir="ltr">${session.phone}</strong>
      </div>
      <div style="display:flex; justify-content:space-between; padding:10px 0; border-bottom:1px solid #f1f5f9;">
        <span style="color:#64748b;">نقش</span>
        <strong>${roleLabel}</strong>
      </div>
      <div style="display:flex; justify-content:space-between; padding:10px 0; border-bottom:1px solid #f1f5f9;">
        <span style="color:#64748b;">واحد</span>
        <strong>${unitLabel}</strong>
      </div>
      <div style="display:flex; justify-content:space-between; padding:10px 0;">
        <span style="color:#64748b;">کد ساختمان</span>
        <strong dir="ltr">${session.buildingCode}</strong>
      </div>
    </div>

    <button class="resident-submit-btn" id="residentLogoutBtn2" style="background: linear-gradient(135deg, #ef4444 0%, #b91c1c 100%); margin-top: 20px;">
      🚪 خروج از حساب
    </button>
  `;

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
     document.getElementById('residentSendMessageBtn')?.addEventListener('click', sendResidentMessage);

  // نوار پایین
  document.querySelectorAll('.resident-nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      switchResidentPage(btn.dataset.residentPage);
    });
  });

  // خروج
  document.getElementById('residentLogoutBtn')?.addEventListener('click', logoutResident);
}

document.addEventListener('DOMContentLoaded', initResidentApp);
