/* دیالوگ‌های داخل برنامه به جای confirm/prompt/alert مرورگر
   (بسیاری از مرورگرهای داخل‌برنامه‌ای (webview) این‌ها را مسدود می‌کنند و دکمه‌ها کار نمی‌کنند) */
(function () {
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  function open(opts) {
    return new Promise(resolve => {
      const ov = document.createElement('div');
      ov.className = 'app-dialog-overlay';
      ov.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,.55);z-index:100000;display:flex;align-items:center;justify-content:center;padding:18px;';
      const danger = /حذف|پاک|لغو|رد |خروج|غیرفعال/.test(opts.message || '') && opts.kind !== 'alert';
      ov.innerHTML = `<div role="dialog" aria-modal="true" style="background:#fff;color:#0f172a;border-radius:18px;max-width:400px;width:100%;padding:20px;direction:rtl;font-family:inherit;box-shadow:0 20px 50px rgba(0,0,0,.25);">
        <div style="white-space:pre-line;font-size:14px;line-height:1.9;margin-bottom:14px;">${esc(opts.message)}</div>
        ${opts.kind === 'prompt' ? `<input type="text" data-in style="width:100%;box-sizing:border-box;padding:10px 12px;border:1px solid #cbd5e1;border-radius:10px;font-family:inherit;font-size:14px;margin-bottom:14px;" value="${esc(opts.def || '')}">` : ''}
        <div style="display:flex;gap:8px;">
          <button type="button" data-ok style="flex:1;padding:11px;border:none;border-radius:12px;background:${danger ? '#ef4444' : '#5b4cdb'};color:#fff;font-family:inherit;font-size:14px;font-weight:700;cursor:pointer;">${esc(opts.okText || (opts.kind === 'alert' ? 'باشه' : 'بله'))}</button>
          ${opts.kind === 'alert' ? '' : `<button type="button" data-no style="flex:1;padding:11px;border:none;border-radius:12px;background:#f1f5f9;color:#334155;font-family:inherit;font-size:14px;font-weight:700;cursor:pointer;">${esc(opts.cancelText || 'انصراف')}</button>`}
        </div></div>`;
      const done = v => { ov.remove(); document.removeEventListener('keydown', onKey); resolve(v); };
      const val = () => { const i = ov.querySelector('[data-in]'); return i ? i.value : true; };
      const onKey = e => { if (e.key === 'Escape') done(opts.kind === 'prompt' ? null : false); if (e.key === 'Enter') done(val()); };
      ov.addEventListener('click', e => {
        if (e.target.closest('[data-ok]')) return done(val());
        if (e.target.closest('[data-no]') || e.target === ov) return done(opts.kind === 'prompt' ? null : (opts.kind === 'alert'));
      });
      document.addEventListener('keydown', onKey);
      document.body.appendChild(ov);
      const f = ov.querySelector('[data-in]') || ov.querySelector('[data-ok]');
      setTimeout(() => f && f.focus(), 30);
    });
  }
  window.appConfirm = (message, o) => open(Object.assign({ kind: 'confirm', message }, o || {}));
  window.appPrompt = (message, def, o) => open(Object.assign({ kind: 'prompt', message, def }, o || {}));
  window.appAlert = (message, o) => open(Object.assign({ kind: 'alert', message }, o || {}));
})();
