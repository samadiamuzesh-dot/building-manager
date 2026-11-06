# سرور همگام‌سازی آپارتمان پلاس (قرارداد API)

پنل‌ها همچنان با localStorage کار می‌کنند. `js/sync.js` هر تغییر را به `POST /api/sync` می‌فرستد و هر ۱۲ ثانیه (و هنگام باز شدن برنامه) تغییرات دستگاه‌های دیگر را می‌گیرد. آدرس سرور را می‌شود با `window.APT_SYNC_URL = 'https://.../api/sync'` قبل از بارگذاری `sync.js` عوض کرد (مثلاً بعد از انتقال به هاست PHP).

## سرور فعلی (موقت): افزونه وردپرس روی elhamsamadi.ir
- افزونه «Apartment Plus Sync» (پوشه `server/wordpress/apt-sync`) مسیر `https://elhamsamadi.ir/wp-json/apt-sync/v1/sync` را با همین قرارداد ارائه می‌دهد؛ داده در جدول‌های `wp_apt_sync` و `wp_apt_sync_codes`.
- رمز مدیر با `password_hash` (bcrypt) نگه داشته می‌شود؛ کلید امضای توکن در گزینه `apt_sync_secret`.
- CORS فقط برای `samadiamuzesh-dot.github.io` و خود elhamsamadi.ir باز است (فیلتر `apt_sync_origins`). هدر `X-Robots-Tag: noindex` دارد و صفحه عمومی نمی‌سازد.
- `js/sync.js` به‌طور پیش‌فرض به این آدرس وصل می‌شود؛ با `window.APT_SYNC_URL` قابل تغییر است.
- برای انتقال به هاست جدا: همین افزونه یا `api/sync.php` با همین قرارداد، سپس جدول‌ها را منتقل و `DEFAULT_API` را عوض کنید.

## راه‌اندازی روی Vercel (کنار گذاشته شد؛ از ایران در دسترس نبود)
1. ریپو را در Vercel ایمپورت کنید (Framework: Other، بدون Build Command).
2. Storage → Upstash Redis (پلن رایگان) را بسازید و به پروژه وصل کنید؛ متغیرهای `KV_REST_API_URL` و `KV_REST_API_TOKEN` خودکار اضافه می‌شوند.
3. (اختیاری) متغیر `SYNC_SECRET` را با یک رشته تصادفی بلند بگذارید.
4. Redeploy. تست: باز کردن `/api/sync` باید `{"ok":true,...,"storage":true}` بدهد.

## اکشن‌ها (بدنه JSON)
| action | ورودی | خروجی |
|---|---|---|
| `register` | `phone, passHash, code` | `token, phone, code` (اولین بار، توسط sync.js خودکار) |
| `login` | `phone, passHash` | `token, phone, code` — خطاها: 404 `not_found`، 401 `bad_password`، 429 |
| `open` | `code` (کد ساختمان) | توکن ساکن `token, phone, code` |
| `resident_login` | `code, residentPhone, passHash` | `{ok, resident, token}` — توکن با هویت ساکن (rid) |
| `block_login` | `code, blockPhone, passHash` | `{ok, token, phone, code, manager}` — توکن مدیر بلوک (bid)؛ خطاها: 404، 401 `bad_password`، 403 `pending` / `disabled` / `rejected` (۱.۳)، 429 |
| `block_info` (۱.۳) | `code` | `{ok, code, name, complex, blocks: [نام بلوک‌ها]}` — برای فرم ثبت‌نام مدیر بلوک؛ 404 `not_found` |
| `block_register` (۱.۳) | `code, block, name, blockPhone, passHash` | `{ok, status:'pending', id, block}` — ردیف `status:'pending', source:'self'` (رمز bcrypt) در `block_managers` ساختمان؛ مدیر کل با `status:'approved'/'rejected'` تأیید/رد می‌کند. خطاها: 404 `not_found`، 409 `not_complex`، 400 `bad_block` (+`blocks`)، 409 `phone_exists` (+`status`)، 429 (۲۰ در ساعت برای هر ساختمان، ۵ برای هر شماره، حداکثر ۳۰ درخواست در انتظار) |
| `pull` | `token, since` | `{keys: {base: {v, r}}, rev}` |
| `push` | `token, changes: {base: {v, r}}` | `{applied: {base: r}, conflicts: {base: {v, r}}}` |
| `change_password` | `token, oldHash, newHash` | `{ok}` |

- `base` یکی از: v3, units, charges, expenses, messages, notices, notifications, settings, side_incomes, tickets, votings, plan, registered_residents, block_managers.
- `r` نسخه هر کلید است؛ اگر `r` ارسالی با نسخه سرور یکی نباشد، کلید در `conflicts` برمی‌گردد و کلاینت ادغام سه‌طرفه (بر اساس `id` ردیف‌ها) انجام می‌دهد و دوباره می‌فرستد.
- دسترسی ساکن (از نسخه ۱.۱ افزونه):
  - توکن `open` (فقط کد ساختمان) = «مهمان»: فقط ثبت‌نام تازه (در انتظار تأیید) و پر کردن جای خالی/تأییدنشده همان واحد. پیام، پرداخت و رأی ندارد.
  - توکن `resident_login` (rid): فقط واحد خودش (بدون مبلغ شارژ/بدهی/شماره واحد)، اعلام پرداخت شارژهای واحد خودش، پیام برای واحد خودش، یک رأی با شماره خودش، ردیف ثبت‌نام خودش.
  - هیچ ساکنی ردیف/واحد/پیام را حذف نمی‌کند؛ ساکن ردشده دسترسی نوشتن ندارد.
  - حریم: ساکن موبایل، کد ملی و قبض‌های واحدهای دیگر، پیام‌های دیگران، شماره رأی‌دهندگان دیگر و تیکت‌های مدیر را نمی‌بیند.
- مدیر بلوک (از نسخه ۱.۲ افزونه): مدیر کل در کلید `block_managers` ردیف `{id, name, phone, block, passwordHash, active}` می‌سازد (هش کلاینت `bh_…`، روی سرور bcrypt).
  - دیدن: فقط واحدها، شارژها، پیام‌ها و ثبت‌نام‌های بلوک خودش؛ اطلاعیه‌های «همه» و بلوک خودش؛ تنظیمات بدون کارت/شبا؛ هزینه، درآمد جانبی، رأی‌گیری، تیکت و اعلان خالی.
  - نوشتن: فقط تأیید/رد اعلام پرداخت شارژهای بلوک خودش (مبلغ هرگز؛ `approvedBy`/`rejectedBy` = `block:<نام>` را سرور می‌گذارد)، تأیید/رد ثبت‌نام‌های در انتظار بلوک خودش (`reviewedBy`)، تأیید/پاک کردن ساکن در واحد همان بلوک، اطلاعیه با مخاطب بلوک خودش (و حذف اطلاعیه‌های خودش)، پیام به واحدهای بلوک خودش (`sentBy`).
  - غیرفعال کردن، حذف یا رمز تازه، توکن مدیر بلوک را فوراً باطل می‌کند. ساکنین فهرست مدیران بلوک را نمی‌بینند.
- رمز ساکنین (`passwordHash`) هیچ‌وقت به کلاینت‌ها برگردانده نمی‌شود و روی سرور با bcrypt نگه داشته می‌شود.

## محدودیت‌های فعلی
- رمز مدیر در مرورگر با هش ساده ساخته می‌شود؛ سرور آن را با scrypt ذخیره می‌کند و تلاش‌های ورود را محدود می‌کند، ولی برای امنیت کامل باید ورود به سرور منتقل شود.
- هر کسی کد ساختمان را داشته باشد اطلاعات ساختمان (بدون رمزها) را می‌بیند؛ کد ساختمان را فقط به ساکنین بدهید.
- عکس رسیدها اگر حجیم باشند حجم داده را زیاد می‌کنند.

## انتقال به هاست PHP
همین قرارداد را در `api/sync.php` پیاده کنید (ذخیره در MySQL: جدول buildings و جدول keys با ستون rev) و در صفحات `window.APT_SYNC_URL` را تنظیم کنید یا مسیر `/api/sync` را rewrite کنید. داده‌ها را با یک اسکریپت از Redis به MySQL منتقل کنید.
