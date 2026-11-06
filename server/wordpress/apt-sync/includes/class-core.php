<?php
/**
 * آپارتمان پلاس — منطق سرور همگام‌سازی (هم‌قرارداد با api/sync.js و docs/SYNC-API.md)
 * مستقل از وردپرس تا بشود جدا تست کرد. ذخیره‌سازی از طریق یک Store انجام می‌شود.
 */
if (!class_exists('Apt_Sync_Error')) {
class Apt_Sync_Error extends Exception {
	public $status; public $extra;
	public function __construct($status, $error, $extra = array()) { parent::__construct($error); $this->status = $status; $this->extra = $extra; }
}
}

if (!class_exists('Apt_Sync_Core')) {
class Apt_Sync_Core {
	const BASES = array('v3', 'units', 'charges', 'expenses', 'messages', 'notices', 'notifications',
		'settings', 'side_incomes', 'tickets', 'votings', 'plan', 'registered_residents', 'block_managers');
	const RESIDENT_WRITABLE = array('units', 'charges', 'messages', 'notifications', 'votings', 'tickets', 'registered_residents');
	/** مدیر بلوک (نسخه ۱.۲) فقط این کلیدها را می‌نویسد، آن هم فقط برای بلوک خودش */
	const BLOCK_WRITABLE = array('units', 'charges', 'messages', 'notices', 'registered_residents');
	/** فیلدهایی که مدیر بلوک هنگام تأیید/رد اعلام پرداخت تغییر می‌دهد (مبلغ هرگز) */
	const BLOCK_REVIEW_FIELDS = array('paid', 'paidDate', 'paidAt', 'pendingApproval', 'pendingAt', 'payMethod', 'payDescription', 'trackingCode',
		'paidByResident', 'receipt', 'receiptImage', 'receiptArchived', 'residentNote', 'rejectReason', 'rejectedAt', 'lastRejectedTracking',
		'approvedByManager', 'approvedAt');
	const SECRET_BASES = array('registered_residents', 'block_managers');
	const TOKEN_TTL = 5184000000; // ۶۰ روز (میلی‌ثانیه)
	const PAY_FIELDS = array('pendingApproval', 'pendingAt', 'payMethod', 'payDescription', 'trackingCode', 'paidByResident',
		'receipt', 'receiptImage', 'residentNote', 'rejectReason', 'rejectedAt');

	/** @var object store: getMeta setMeta getKey getAll putKey delKey codeOwner setCode delCode lock unlock rateHit */
	private $s; private $secret;
	/** کلید عمومی VAPID (نسخه ۱.۴)؛ null یعنی اعلان فوری (Web Push) غیرفعال است */
	private $pushKey = null; private $outbox = array();
	public function __construct($store, $secret) { $this->s = $store; $this->secret = (string) $secret; }
	public function setPush($pubKey) { $this->pushKey = $pubKey ? (string) $pubKey : null; }
	/** اعلان‌هایی که باید بعد از پاسخ فرستاده شوند: [['phone','sub','payload'], …] */
	public function takeOutbox() { $o = $this->outbox; $this->outbox = array(); return $o; }
	private function pushOn() { return $this->pushKey !== null && method_exists($this->s, 'getPush'); }

	/* ---------- helpers ---------- */
	public static function now() { return (int) floor(microtime(true) * 1000); }
	public static function normPhone($p) {
		$p = (string) $p;
		$p = strtr($p, array('۰'=>'0','۱'=>'1','۲'=>'2','۳'=>'3','۴'=>'4','۵'=>'5','۶'=>'6','۷'=>'7','۸'=>'8','۹'=>'9',
			'٠'=>'0','١'=>'1','٢'=>'2','٣'=>'3','٤'=>'4','٥'=>'5','٦'=>'6','٧'=>'7','٨'=>'8','٩'=>'9'));
		return preg_replace('/\D/', '', $p);
	}
	public static function normCode($c) { return strtoupper(trim((string) $c)); }
	private static function b64u($s) { return rtrim(strtr(base64_encode($s), '+/', '-_'), '='); }
	private static function b64ud($s) { return base64_decode(strtr($s, '-_', '+/')); }
	private function sign($payload) {
		$body = self::b64u(json_encode($payload));
		return $body . '.' . self::b64u(hash_hmac('sha256', $body, $this->secret, true));
	}
	private function verify($token) {
		if (!is_string($token) || strpos($token, '.') === false) return null;
		list($body, $mac) = explode('.', $token, 2);
		$good = self::b64u(hash_hmac('sha256', $body, $this->secret, true));
		if (!hash_equals($good, (string) $mac)) return null;
		$p = json_decode((string) self::b64ud($body), true);
		if (!is_array($p) || empty($p['e']) || $p['e'] < self::now()) return null;
		return $p;
	}
	private function rateLimit($key, $max, $sec) { if ($this->s->rateHit($key, $sec) > $max) throw new Apt_Sync_Error(429, 'too_many_attempts'); }
	private static function codeFromV3($v) {
		$j = json_decode((string) $v, true);
		return (is_array($j) && isset($j['building']['code'])) ? self::normCode($j['building']['code']) : '';
	}
	private static function jlist($s) { $j = json_decode((string) $s, true); return is_array($j) ? $j : array(); }
	private static function isList($a) { return is_array($a) && ($a === array() || array_keys($a) === range(0, count($a) - 1)); }
	private static function enc($v) { return json_encode($v, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES); }

	/* ---------- حریم و دسترسی ساکنین (نسخه ۱.۱) ----------
	 * ident: هویت ساکن از توکن (rid) — بدون rid «مهمان» است (فقط کد ساختمان را دارد).
	 * مهمان فقط می‌تواند ثبت‌نام جدید (در انتظار تأیید) بفرستد؛ ساکن واقعی فقط واحد/شارژ/پیام/رأی خودش را تغییر می‌دهد.
	 */
	public static function blockKey($b) { $b = trim((string) $b); return ($b === '' || $b === '—' || $b === '-') ? '—' : $b; }
	public static function numKey($n) { return (string) (int) self::normPhone($n); }
	private static function pairOf($row, $bk, $nk) { return self::blockKey(isset($row[$bk]) ? $row[$bk] : '') . '#' . self::numKey(isset($row[$nk]) ? $row[$nk] : ''); }
	private static function isBcrypt($h) { return is_string($h) && strncmp($h, '$2', 2) === 0; }
	private static function byIdMap($list) { $m = array(); foreach ((array) $list as $x) if (is_array($x) && isset($x['id'])) $m[(string) $x['id']] = $x; return $m; }

	/** هویت ساکن را با فهرست ثبت‌نام‌ها و واحدها تطبیق می‌دهد */
	public static function ident($t, $all) {
		$g = array('rid' => null, 'phone' => '', 'pair' => '', 'unitIds' => array());
		if (empty($t['rid'])) return $g;
		$regs = isset($all['registered_residents']) ? self::jlist($all['registered_residents']['v']) : array();
		$me = null;
		foreach ($regs as $r) if (is_array($r) && isset($r['id']) && (string) $r['id'] === (string) $t['rid']) { $me = $r; break; }
		if (!$me || (isset($me['status']) && $me['status'] === 'rejected')) return $g;
		if (self::normCode(isset($me['buildingCode']) ? $me['buildingCode'] : '') !== self::normCode(isset($t['c']) ? $t['c'] : '')) return $g;
		$pair = self::pairOf($me, 'block', 'unitNumber');
		$ids = array();
		$units = isset($all['units']) ? self::jlist($all['units']['v']) : array();
		foreach ($units as $u) if (is_array($u) && isset($u['id']) && self::pairOf($u, 'block', 'number') === $pair) $ids[] = (string) $u['id'];
		return array('approved' => (isset($me['status']) && $me['status'] === 'approved'), 'rid' => (string) $me['id'], 'phone' => self::normPhone(isset($me['phone']) ? $me['phone'] : ''), 'pair' => $pair, 'unitIds' => $ids);
	}

	/** آنچه ساکن از سرور می‌بیند (بدون رمز، موبایل و کد ملی دیگران) */
	public static function filterOut($base, $v, $id) {
		if ($v === null) return null;
		$list = json_decode((string) $v, true);
		if (in_array($base, array('tickets', 'block_managers'), true)) return '[]';
		if (!self::isList($list)) return $v;
		$own = array_flip($id['unitIds']);
		$out = array();
		switch ($base) {
			case 'registered_residents':
				foreach ($list as $r) {
					if (!is_array($r)) continue;
					unset($r['password'], $r['passwordHash']);
					if ($id['rid'] === null || !isset($r['id']) || (string) $r['id'] !== $id['rid']) {
						$r = array_intersect_key($r, array_flip(array('id', 'buildingCode', 'block', 'unitNumber', 'name', 'role', 'status', 'registeredAt')));
					}
					$out[] = $r;
				}
				break;
			case 'units':
				foreach ($list as $u) {
					if (is_array($u) && !(isset($u['id']) && isset($own[(string) $u['id']]))) {
						foreach (array('owner', 'tenant') as $slot) if (isset($u[$slot]) && is_array($u[$slot]))
							$u[$slot] = array_intersect_key($u[$slot], array_flip(array('name', 'type', 'registered', 'approved')));
						foreach (array_keys($u) as $k) if (preg_match('/phone|tel|national|birth|bill|sheba|card|email|notes/i', $k)) unset($u[$k]);
					}
					$out[] = $u;
				}
				break;
			case 'charges':
				foreach ($list as $c) {
					if (is_array($c) && !(isset($c['unitId']) && isset($own[(string) $c['unitId']])))
						foreach (self::PAY_FIELDS as $f) if ($f !== 'pendingApproval' && $f !== 'payMethod') unset($c[$f]);
					$out[] = $c;
				}
				break;
			case 'messages':
				foreach ($list as $m) if (is_array($m) && isset($m['unitId']) && isset($own[(string) $m['unitId']])) $out[] = $m;
				break;
			case 'notifications':
				if ($id['rid'] !== null) foreach ($list as $n) if (is_array($n) && isset($n['_by']) && ($n['_by'] === 'r:' . $id['rid'] || $n['_by'] === 'reg:' . $id['rid'])) $out[] = $n;
				break;
			case 'votings':
				foreach ($list as $vt) {
					if (is_array($vt) && isset($vt['votes']) && is_array($vt['votes'])) {
						foreach ($vt['votes'] as &$vo) if (is_array($vo) && (!$id['phone'] || self::normPhone(isset($vo['voterPhone']) ? $vo['voterPhone'] : '') !== $id['phone'])) unset($vo['voterPhone']);
						unset($vo);
					}
					$out[] = $vt;
				}
				break;
			default: return $v;
		}
		return self::enc($out);
	}

	/** ثبت‌نام‌های تازه‌ای که در همین push آمده‌اند: [pair => id] */
	public static function newRegs($incoming, $current, $code) {
		$out = array();
		if ($incoming === null) return $out;
		$inc = json_decode((string) $incoming, true);
		if (!self::isList($inc)) return $out;
		$cur = self::byIdMap(self::jlist($current));
		foreach ($inc as $r) {
			if (!is_array($r) || !isset($r['id']) || isset($cur[(string) $r['id']])) continue;
			if (self::normCode(isset($r['buildingCode']) ? $r['buildingCode'] : '') !== self::normCode($code)) continue;
			$out[self::pairOf($r, 'block', 'unitNumber')] = array('id' => (string) $r['id'], 'phone' => self::normPhone(isset($r['phone']) ? $r['phone'] : ''));
			if (count($out) >= 3) break;
		}
		return $out;
	}

	private static function hashFor($incomingHash, $old) {
		$oldH = is_array($old) && !empty($old['passwordHash']) ? $old['passwordHash'] : '';
		if ($incomingHash === '' || $incomingHash === null) return $oldH;
		if (self::isBcrypt($incomingHash)) return $oldH; // کلاینت نمی‌تواند هش آماده بفرستد
		if ($oldH !== '') {
			if (self::isBcrypt($oldH) ? password_verify((string) $incomingHash, $oldH) : hash_equals($oldH, (string) $incomingHash)) return self::isBcrypt($oldH) ? $oldH : password_hash((string) $incomingHash, PASSWORD_DEFAULT);
		}
		return password_hash((string) $incomingHash, PASSWORD_DEFAULT);
	}

	/** محدودکردن نوشتن ساکن روی سرور */
	public static function residentGuard($base, $incoming, $current, $id = null, $newRegs = array(), $code = '') {
		if ($id === null) $id = array('rid' => null, 'phone' => '', 'pair' => '', 'unitIds' => array());
		if ($incoming === null) return $current; // ساکن کلید را حذف نمی‌کند
		$inc = json_decode((string) $incoming, true);
		if (!self::isList($inc)) return $current;
		$curList = self::jlist($current);
		$byId = self::byIdMap($curList);
		$own = array_flip($id['unitIds']);
		$repl = array(); $add = array();
		switch ($base) {
			case 'registered_residents':
				foreach ($inc as $r) {
					if (!is_array($r) || !isset($r['id'])) continue;
					$k = (string) $r['id'];
					if (isset($byId[$k])) {
						if ($id['rid'] !== $k) continue; // فقط ردیف خودش
						$old = $byId[$k];
						$n = array_merge($old, $r);
						foreach (array('status', 'reviewedAt', 'buildingCode', 'block', 'unitNumber', 'id') as $f) { if (array_key_exists($f, $old)) $n[$f] = $old[$f]; else unset($n[$f]); }
						unset($n['password']);
						$h = self::hashFor(isset($r['passwordHash']) ? $r['passwordHash'] : '', $old);
						if ($h !== '') $n['passwordHash'] = $h;
						$repl[$k] = $n;
					} elseif (isset($newRegs[self::pairOf($r, 'block', 'unitNumber')]) && $newRegs[self::pairOf($r, 'block', 'unitNumber')]['id'] === $k) {
						$r['status'] = 'pending'; unset($r['reviewedAt'], $r['password']);
						$r['buildingCode'] = self::normCode($code ?: (isset($r['buildingCode']) ? $r['buildingCode'] : ''));
						$h = self::hashFor(isset($r['passwordHash']) ? $r['passwordHash'] : '', null);
						if ($h !== '') $r['passwordHash'] = $h; else unset($r['passwordHash']);
						$add[] = $r;
					}
				}
				break;
			case 'units':
				$pairs = array();
				foreach ($curList as $u) if (is_array($u)) $pairs[self::pairOf($u, 'block', 'number')] = 1;
				foreach ($inc as $u) {
					if (!is_array($u) || !isset($u['id'])) continue;
					$k = (string) $u['id'];
					if (isset($byId[$k])) {
						$old = $byId[$k];
						$pair = self::pairOf($old, 'block', 'number');
						if ($id['rid'] !== null && isset($own[$k])) {
							$n = array_merge($old, $u);
							foreach (array('owner', 'tenant') as $slot) if (isset($old[$slot]) && is_array($old[$slot]) && isset($u[$slot]) && is_array($u[$slot])) $n[$slot] = array_merge($old[$slot], $u[$slot]);
							foreach (array('id', 'block', 'number', 'code', 'chargeAmount', 'defaultChargeOwner', 'defaultChargeTenant', 'debt', 'createdAt', 'source') as $f) { if (array_key_exists($f, $old)) $n[$f] = $old[$f]; else unset($n[$f]); }
							foreach (array('owner', 'tenant') as $slot) if (isset($n[$slot]) && is_array($n[$slot])) {
								$n[$slot]['approved'] = (isset($old[$slot]['approved']) ? (bool) $old[$slot]['approved'] : false) || (!empty($n[$slot]['approved']) && !empty($n[$slot]['phone']) && self::normPhone($n[$slot]['phone']) === $id['phone'] && self::regApproved($id));
							}
							$repl[$k] = $n;
						} elseif (isset($newRegs[$pair])) {
							$n = $old;
							foreach (array('owner', 'tenant') as $slot) {
								if (!isset($u[$slot]) || !is_array($u[$slot])) continue;
								$os = isset($old[$slot]) && is_array($old[$slot]) ? $old[$slot] : array();
								$locked = !empty($os['approved']) && !empty($os['phone']) && self::normPhone($os['phone']) !== $newRegs[$pair]['phone'];
								if ($locked) continue;
								$ns = $u[$slot]; $ns['approved'] = !empty($os['approved']) && !empty($os['phone']) && self::normPhone($os['phone']) === self::normPhone(isset($ns['phone']) ? $ns['phone'] : '');
								$n[$slot] = $ns;
							}
							foreach (array('status', 'peopleCount', 'updatedAt') as $f) if (array_key_exists($f, $u)) $n[$f] = $u[$f];
							$repl[$k] = $n;
						}
					} else {
						$pair = self::pairOf($u, 'block', 'number');
						if (!isset($pairs[$pair]) && (isset($newRegs[$pair]) || ($id['rid'] !== null && $pair === $id['pair'])) && count($add) < 1) {
							$u['chargeAmount'] = 0; $u['debt'] = null; $u['defaultChargeOwner'] = 0; $u['defaultChargeTenant'] = 0;
							foreach (array('owner', 'tenant') as $slot) if (isset($u[$slot]) && is_array($u[$slot])) $u[$slot]['approved'] = false;
							$add[] = $u; $pairs[$pair] = 1;
						}
					}
				}
				break;
			case 'charges':
				if ($id['rid'] === null) return $current;
				foreach ($inc as $c) {
					if (!is_array($c) || !isset($c['id'])) continue;
					$k = (string) $c['id'];
					if (!isset($byId[$k])) continue; // ساکن شارژ صادر نمی‌کند
					$o = $byId[$k];
					if (!isset($own[(string) (isset($o['unitId']) ? $o['unitId'] : '')])) continue;
					if (!empty($o['paid'])) continue;
					foreach (self::PAY_FIELDS as $f) { if (array_key_exists($f, $c)) $o[$f] = $c[$f]; elseif ($f === 'receiptImage' || $f === 'receipt') unset($o[$f]); }
					$repl[$k] = $o;
				}
				break;
			case 'messages':
				if ($id['rid'] === null) return $current;
				foreach ($inc as $m) {
					if (!is_array($m) || !isset($m['id'])) continue;
					$k = (string) $m['id'];
					if (isset($byId[$k])) {
						$o = $byId[$k];
						if (!isset($own[(string) (isset($o['unitId']) ? $o['unitId'] : '')])) continue;
						$dir = isset($o['direction']) ? $o['direction'] : '';
						if ($dir === 'sent' && array_key_exists('read', $m)) $o['read'] = (bool) $m['read'];
						if ($dir === 'received' && array_key_exists('delivered', $m)) $o['delivered'] = (bool) $m['delivered'];
						$repl[$k] = $o;
					} elseif (isset($m['unitId']) && isset($own[(string) $m['unitId']]) && (isset($m['direction']) ? $m['direction'] : '') === 'received' && count($add) < 10) {
						if (isset($m['body'])) $m['body'] = mb_substr((string) $m['body'], 0, 4000);
						$add[] = $m;
					}
				}
				break;
			case 'notifications':
				foreach ($inc as $n) {
					if (!is_array($n) || !isset($n['id']) || isset($byId[(string) $n['id']]) || count($add) >= 5) continue;
					unset($n['_by']);
					if ($id['rid'] !== null) $n['_by'] = 'r:' . $id['rid'];
					elseif (count($newRegs) === 1) { $one = reset($newRegs); $n['_by'] = 'reg:' . $one['id']; }
					else continue; // مهمان بدون ثبت‌نام تازه اعلان نمی‌فرستد
					foreach (array('title', 'message') as $f) if (isset($n[$f])) $n[$f] = mb_substr((string) $n[$f], 0, 500);
					$add[] = $n;
				}
				break;
			case 'votings':
				if ($id['rid'] === null || $id['phone'] === '') return $current;
				foreach ($inc as $vt) {
					if (!is_array($vt) || !isset($vt['id']) || !isset($byId[(string) $vt['id']])) continue;
					$o = $byId[(string) $vt['id']];
					$votes = isset($o['votes']) && is_array($o['votes']) ? $o['votes'] : array();
					$already = false;
					foreach ($votes as $vo) if (is_array($vo) && self::normPhone(isset($vo['voterPhone']) ? $vo['voterPhone'] : '') === $id['phone']) $already = true;
					if ($already) continue;
					foreach ((isset($vt['votes']) && is_array($vt['votes']) ? $vt['votes'] : array()) as $vo) {
						if (!is_array($vo) || self::normPhone(isset($vo['voterPhone']) ? $vo['voterPhone'] : '') !== $id['phone']) continue;
						$votes[] = $vo;
						if (isset($o['candidates']) && is_array($o['candidates'])) foreach ($o['candidates'] as &$cd) {
							if (is_array($cd) && isset($cd['id']) && isset($vo['candidateId']) && (string) $cd['id'] === (string) $vo['candidateId']) $cd['votes'] = (int) (isset($cd['votes']) ? $cd['votes'] : 0) + 1;
						}
						unset($cd);
						$o['votes'] = $votes;
						$repl[(string) $vt['id']] = $o;
						break;
					}
				}
				break;
			default:
				return $current; // tickets و بقیه: ساکن نمی‌نویسد
		}
		if (!$repl && !$add) return $current;
		$out = array();
		foreach ($curList as $x) { $k = is_array($x) && isset($x['id']) ? (string) $x['id'] : null; $out[] = ($k !== null && isset($repl[$k])) ? $repl[$k] : $x; }
		foreach ($add as $x) $out[] = $x;
		return self::enc($out);
	}
	private static function regApproved($id) { return !empty($id['approved']); }

	public static function stripSecrets($base, $v) {
		if (!in_array($base, self::SECRET_BASES, true) || $v === null) return $v;
		$list = json_decode((string) $v, true);
		if (!self::isList($list)) return $v;
		foreach ($list as &$r) if (is_array($r)) { unset($r['password'], $r['passwordHash']); }
		return self::enc($list);
	}
	public static function keepSecrets($base, $incoming, $current) {
		if (!in_array($base, self::SECRET_BASES, true) || $incoming === null) return $incoming;
		$inc = json_decode((string) $incoming, true);
		if (!self::isList($inc)) return $incoming;
		$byId = self::byIdMap(self::jlist($current));
		foreach ($inc as &$r) {
			if (!is_array($r) || !isset($r['id'])) continue;
			$old = isset($byId[(string) $r['id']]) ? $byId[(string) $r['id']] : null;
			$h = self::hashFor(isset($r['passwordHash']) ? $r['passwordHash'] : '', $old);
			if ($h === '' && !empty($r['password'])) $h = password_hash(self::legacyHash((string) $r['password']), PASSWORD_DEFAULT);
			if ($h === '' && $old && !empty($old['password'])) { $r['password'] = $old['password']; }
			else unset($r['password']);
			if ($h !== '') $r['passwordHash'] = $h; else unset($r['passwordHash']);
		}
		unset($r);
		return self::enc($inc);
	}
	/** همان hashResidentPassword سمت کلاینت (برای رمزهای متنی قدیمی) */
	public static function legacyHash($str) {
		$s = 'ap+res:' . $str;
		$h = 0;
		$len = mb_strlen($s, 'UTF-8');
		for ($i = 0; $i < $len; $i++) {
			$ch = mb_ord(mb_substr($s, $i, 1, 'UTF-8'), 'UTF-8');
			$h = (($h << 5) - $h + $ch) & 0xFFFFFFFF;
		}
		if ($h & 0x80000000) $h -= 0x100000000;
		return 'rh_' . base_convert((string) abs($h), 10, 36);
	}

	/* ---------- مدیر بلوک (نسخه ۱.۲) ----------
	 * مدیر کل در کلید block_managers ردیف {id, name, phone, block, passwordHash, active} می‌سازد.
	 * مدیر بلوک با کد ساختمان + موبایل + رمز وارد می‌شود و توکن ro=b می‌گیرد که فقط به بلوک خودش دسترسی دارد.
	 */
	private static function passVer($hash) { return substr(hash('sha256', (string) $hash), 0, 12); }
	/** وضعیت ردیف مدیر بلوک: ردیف‌های قدیمی (ساخته مدیر کل) وضعیت ندارند = approved */
	public static function bmStatus($m) { $s = is_array($m) && isset($m['status']) ? (string) $m['status'] : ''; return ($s === 'pending' || $s === 'rejected') ? $s : 'approved'; }
	private static function bmActive($m) { return is_array($m) && (!array_key_exists('active', $m) || $m['active'] !== false) && self::bmStatus($m) === 'approved'; }

	/** هویت مدیر بلوک از توکن + داده فعلی؛ null یعنی دسترسی ندارد */
	public static function bident($t, $all) {
		if (empty($t['bid'])) return null;
		$list = isset($all['block_managers']) ? self::jlist($all['block_managers']['v']) : array();
		$me = null;
		foreach ($list as $m) if (is_array($m) && isset($m['id']) && (string) $m['id'] === (string) $t['bid']) { $me = $m; break; }
		if (!$me || !self::bmActive($me)) return null;
		if (!isset($t['pv']) || self::passVer(isset($me['passwordHash']) ? $me['passwordHash'] : '') !== $t['pv']) return null;
		$block = self::blockKey(isset($me['block']) ? $me['block'] : '');
		if ($block === '—') return null;
		$ids = array();
		$units = isset($all['units']) ? self::jlist($all['units']['v']) : array();
		foreach ($units as $u) if (is_array($u) && isset($u['id']) && self::blockKey(isset($u['block']) ? $u['block'] : '') === $block) $ids[] = (string) $u['id'];
		return array('bid' => (string) $me['id'], 'name' => (string) (isset($me['name']) ? $me['name'] : ''), 'block' => $block, 'unitIds' => $ids,
			'tag' => 'block:' . (string) (isset($me['name']) ? $me['name'] : $me['id']));
	}

	private static function noticeInBlock($n, $bi) {
		if (!is_array($n)) return false;
		$tt = isset($n['targetType']) ? $n['targetType'] : 'all';
		if ($tt === 'block') return self::blockKey(isset($n['targetBlock']) ? $n['targetBlock'] : '') === $bi['block'];
		if ($tt === 'units') {
			$own = array_flip($bi['unitIds']); $tu = isset($n['targetUnits']) && is_array($n['targetUnits']) ? $n['targetUnits'] : array();
			if (!$tu) return false;
			foreach ($tu as $x) if (!isset($own[(string) $x])) return false;
			return true;
		}
		return false;
	}

	/** آنچه مدیر بلوک از سرور می‌بیند: فقط بلوک خودش، بدون هزینه/درآمد/کارت */
	public static function blockFilterOut($base, $v, $bi) {
		if ($v === null) return null;
		if (in_array($base, array('expenses', 'side_incomes', 'tickets', 'votings', 'notifications'), true)) return '[]';
		$list = json_decode((string) $v, true);
		if ($base === 'settings') {
			if (!is_array($list) || self::isList($list)) return $v;
			foreach (array_keys($list) as $k) if (preg_match('/card|sheba|iban|account/i', $k)) unset($list[$k]);
			return self::enc((object) $list);
		}
		if (!self::isList($list)) return $v;
		$own = array_flip($bi['unitIds']);
		$out = array();
		switch ($base) {
			case 'units':
				foreach ($list as $u) if (is_array($u) && isset($u['id']) && isset($own[(string) $u['id']])) $out[] = $u;
				break;
			case 'charges':
			case 'messages':
				foreach ($list as $c) if (is_array($c) && isset($c['unitId']) && isset($own[(string) $c['unitId']])) $out[] = $c;
				break;
			case 'registered_residents':
				foreach ($list as $r) if (is_array($r) && self::blockKey(isset($r['block']) ? $r['block'] : '') === $bi['block']) $out[] = $r;
				break;
			case 'notices':
				foreach ($list as $n) {
					if (!is_array($n)) continue;
					$tt = isset($n['targetType']) ? $n['targetType'] : 'all';
					if ($tt === 'all' || self::noticeInBlock($n, $bi)) { $out[] = $n; continue; }
					if ($tt === 'units' && isset($n['targetUnits']) && is_array($n['targetUnits'])) {
						foreach ($n['targetUnits'] as $x) if (isset($own[(string) $x])) { $out[] = $n; break; }
					}
				}
				break;
			case 'block_managers':
				foreach ($list as $m) if (is_array($m) && isset($m['id']) && (string) $m['id'] === $bi['bid']) $out[] = $m;
				break;
			default: return $v;
		}
		return self::enc($out);
	}

	/** محدودکردن نوشتن مدیر بلوک روی سرور */
	public static function blockGuard($base, $incoming, $current, $bi) {
		if ($incoming === null) return $current;
		$inc = json_decode((string) $incoming, true);
		if (!self::isList($inc)) return $current;
		$curList = self::jlist($current);
		$byId = self::byIdMap($curList);
		$own = array_flip($bi['unitIds']);
		$repl = array(); $add = array(); $drop = array();
		$now = gmdate('Y-m-d\TH:i:s\Z');
		switch ($base) {
			case 'charges':
				foreach ($inc as $c) {
					if (!is_array($c) || !isset($c['id'])) continue;
					$k = (string) $c['id'];
					if (!isset($byId[$k])) continue; // صدور شارژ ممنوع
					$o = $byId[$k];
					if (!isset($own[(string) (isset($o['unitId']) ? $o['unitId'] : '')])) continue;
					if (!empty($o['paid']) || empty($o['pendingApproval'])) continue; // فقط بررسی اعلام پرداخت
					$n = $o;
					foreach (self::BLOCK_REVIEW_FIELDS as $f) { if (array_key_exists($f, $c)) $n[$f] = $c[$f]; }
					if (!empty($c['paid'])) {
						$n['paid'] = true; $n['pendingApproval'] = false; $n['approvedByManager'] = true;
						$n['approvedBy'] = $bi['tag']; if (empty($n['approvedAt'])) $n['approvedAt'] = $now;
					} elseif (empty($c['pendingApproval'])) {
						$n['paid'] = false; $n['pendingApproval'] = false; $n['rejectedBy'] = $bi['tag'];
						if (empty($n['rejectedAt'])) $n['rejectedAt'] = $now;
					} else continue;
					$repl[$k] = $n;
				}
				break;
			case 'units':
				// فقط تأیید/پاک کردن ساکن (owner/tenant) در واحدهای همین بلوک؛ مبلغ شارژ، بدهی و مشخصات واحد نه
				foreach ($inc as $u) {
					if (!is_array($u) || !isset($u['id'])) continue;
					$k = (string) $u['id'];
					if (!isset($byId[$k]) || !isset($own[$k])) continue;
					$o = $byId[$k]; $n = $o; $ch = false;
					foreach (array('owner', 'tenant') as $slot) {
						if (!isset($u[$slot]) || !is_array($u[$slot])) continue;
						$os = isset($o[$slot]) && is_array($o[$slot]) ? $o[$slot] : array();
						$ns = $u[$slot];
						$samePerson = self::normPhone(isset($os['phone']) ? $os['phone'] : '') === self::normPhone(isset($ns['phone']) ? $ns['phone'] : '')
							&& (string) (isset($os['name']) ? $os['name'] : '') === (string) (isset($ns['name']) ? $ns['name'] : '');
						$cleared = empty($ns['name']) && empty($ns['phone']);
						if ($samePerson && !empty($os['phone'])) {
							$ap = !empty($ns['approved']);
							if ($ap !== !empty($os['approved'])) { $n[$slot]['approved'] = $ap; $ch = true; }
						} elseif ($cleared && (!empty($os['name']) || !empty($os['phone']))) {
							$n[$slot] = array('name' => null, 'phone' => null, 'birthDate' => null, 'nationalId' => null, 'type' => 'settled', 'registered' => false, 'approved' => false);
							$ch = true;
						}
					}
					if ($ch) $repl[$k] = $n;
				}
				break;
			case 'registered_residents':
				foreach ($inc as $r) {
					if (!is_array($r) || !isset($r['id'])) continue;
					$k = (string) $r['id'];
					if (!isset($byId[$k])) continue;
					$o = $byId[$k];
					if (self::blockKey(isset($o['block']) ? $o['block'] : '') !== $bi['block']) continue;
					if ((isset($o['status']) ? $o['status'] : '') !== 'pending') continue;
					$st = isset($r['status']) ? $r['status'] : '';
					if ($st !== 'approved' && $st !== 'rejected') continue;
					$o['status'] = $st; $o['reviewedAt'] = isset($r['reviewedAt']) ? (string) $r['reviewedAt'] : $now; $o['reviewedBy'] = $bi['tag'];
					$repl[$k] = $o;
				}
				break;
			case 'messages':
				foreach ($inc as $m) {
					if (!is_array($m) || !isset($m['id'])) continue;
					$k = (string) $m['id'];
					if (isset($byId[$k])) {
						$o = $byId[$k];
						if (!isset($own[(string) (isset($o['unitId']) ? $o['unitId'] : '')])) continue;
						$dir = isset($o['direction']) ? $o['direction'] : '';
						if ($dir === 'received' && array_key_exists('read', $m) && (bool) $m['read'] !== !empty($o['read'])) { $o['read'] = (bool) $m['read']; $repl[$k] = $o; }
					} elseif (isset($m['unitId']) && isset($own[(string) $m['unitId']]) && (isset($m['direction']) ? $m['direction'] : '') === 'sent' && count($add) < 200) {
						if (isset($m['body'])) $m['body'] = mb_substr((string) $m['body'], 0, 4000);
						$m['sentBy'] = $bi['tag'];
						$add[] = $m;
					}
				}
				break;
			case 'notices':
				$incIds = array();
				foreach ($inc as $n) {
					if (!is_array($n) || !isset($n['id'])) continue;
					$k = (string) $n['id']; $incIds[$k] = 1;
					if (isset($byId[$k])) {
						$o = $byId[$k];
						if ((isset($o['_by']) ? $o['_by'] : '') !== 'b:' . $bi['bid'] || !self::noticeInBlock($n, $bi)) continue;
						$n['_by'] = $o['_by']; $n['createdBy'] = $bi['tag'];
						if ($n !== $o) $repl[$k] = $n;
					} elseif (self::noticeInBlock($n, $bi) && count($add) < 20) {
						$n['_by'] = 'b:' . $bi['bid']; $n['createdBy'] = $bi['tag'];
						foreach (array('title', 'body') as $f) if (isset($n[$f])) $n[$f] = mb_substr((string) $n[$f], 0, $f === 'title' ? 300 : 8000);
						$add[] = $n;
					}
				}
				// حذف: فقط اطلاعیه‌هایی که خود همین مدیر بلوک فرستاده
				foreach ($curList as $o) if (is_array($o) && isset($o['id']) && !isset($incIds[(string) $o['id']]) && (isset($o['_by']) ? $o['_by'] : '') === 'b:' . $bi['bid']) $drop[(string) $o['id']] = 1;
				break;
			default:
				return $current;
		}
		if (!$repl && !$add && !$drop) return $current;
		$out = array();
		foreach ($curList as $x) {
			$k = is_array($x) && isset($x['id']) ? (string) $x['id'] : null;
			if ($k !== null && isset($drop[$k])) continue;
			$out[] = ($k !== null && isset($repl[$k])) ? $repl[$k] : $x;
		}
		foreach ($add as $x) $out[] = $x;
		return self::enc($out);
	}

	private function blockLogin($b) {
		$code = self::normCode(isset($b['code']) ? $b['code'] : '');
		$bp = self::normPhone(isset($b['blockPhone']) ? $b['blockPhone'] : '');
		$pass = (string) (isset($b['passHash']) ? $b['passHash'] : '');
		if ($code === '' || strlen($bp) < 10 || $pass === '') throw new Apt_Sync_Error(400, 'bad_request');
		$this->rateLimit('b:' . $code . ':' . $bp, 20, 900);
		$phone = $this->s->codeOwner($code);
		if (!$phone) throw new Apt_Sync_Error(404, 'not_found');
		$rec = $this->s->getKey($phone, 'block_managers');
		$found = null; $disabled = false; $pending = false; $rejected = false;
		foreach (($rec ? self::jlist($rec['v']) : array()) as $m) {
			if (!is_array($m) || self::normPhone(isset($m['phone']) ? $m['phone'] : '') !== $bp) continue;
			$h = isset($m['passwordHash']) ? (string) $m['passwordHash'] : '';
			if ($h === '' || !(self::isBcrypt($h) ? password_verify($pass, $h) : hash_equals($h, $pass))) continue;
			$st = self::bmStatus($m);
			if ($st === 'pending') { $pending = true; continue; }
			if ($st === 'rejected') { $rejected = true; continue; }
			if (!self::bmActive($m)) { $disabled = true; continue; }
			$found = $m; break;
		}
		if (!$found) {
			// درخواست ثبت‌نام (نسخه ۱.۳): تا تأیید مدیر کل ورود ممکن نیست
			if ($pending) throw new Apt_Sync_Error(403, 'pending');
			if ($disabled) throw new Apt_Sync_Error(403, 'disabled');
			if ($rejected) throw new Apt_Sync_Error(403, 'rejected');
			$any = false; foreach (($rec ? self::jlist($rec['v']) : array()) as $m) if (is_array($m) && self::normPhone(isset($m['phone']) ? $m['phone'] : '') === $bp) $any = true;
			throw new Apt_Sync_Error($any ? 401 : 404, $any ? 'bad_password' : 'block_manager_not_found');
		}
		$tok = $this->sign(array('p' => $phone, 'ro' => 'b', 'c' => $code, 'bid' => (string) $found['id'], 'pv' => self::passVer($found['passwordHash']), 'e' => self::now() + self::TOKEN_TTL));
		unset($found['passwordHash'], $found['password']);
		return array('ok' => true, 'token' => $tok, 'phone' => $phone, 'code' => $code, 'manager' => $found);
	}

	/* ---------- ثبت‌نام مدیر بلوک (نسخه ۱.۳) ----------
	 * مهمان (فقط با کد ساختمان) درخواست می‌فرستد؛ ردیف با status=pending در block_managers همان ساختمان ذخیره می‌شود
	 * و با pull بعدی به پنل مدیر کل می‌رسد. تا مدیر کل تأیید نکند block_login خطای pending می‌دهد.
	 */
	private function buildingBlocks($phone) {
		$all = $this->s->getAll($phone);
		$v3 = isset($all['v3']) ? json_decode((string) $all['v3']['v'], true) : null;
		$b = is_array($v3) && isset($v3['building']) && is_array($v3['building']) ? $v3['building'] : array();
		$names = array();
		if (isset($b['blocks']) && is_array($b['blocks'])) foreach ($b['blocks'] as $x) {
			$n = is_array($x) ? (isset($x['name']) ? $x['name'] : '') : $x;
			$n = self::blockKey($n); if ($n !== '—' && !in_array($n, $names, true)) $names[] = $n;
		}
		$complex = (isset($b['type']) ? $b['type'] : '') === 'complex';
		if ($complex && !$names) {
			foreach ((isset($all['units']) ? self::jlist($all['units']['v']) : array()) as $u) {
				$n = self::blockKey(is_array($u) && isset($u['block']) ? $u['block'] : '');
				if ($n !== '—' && !in_array($n, $names, true)) $names[] = $n;
			}
		}
		return array('complex' => $complex, 'blocks' => $names, 'name' => (string) (isset($b['name']) ? $b['name'] : ''));
	}
	private function blockInfo($b) {
		$code = self::normCode(isset($b['code']) ? $b['code'] : '');
		if ($code === '') throw new Apt_Sync_Error(400, 'bad_request');
		$this->rateLimit('c:' . $code, 60, 900);
		$phone = $this->s->codeOwner($code);
		if (!$phone) throw new Apt_Sync_Error(404, 'not_found');
		$i = $this->buildingBlocks($phone);
		return array('ok' => true, 'code' => $code, 'name' => $i['name'], 'complex' => $i['complex'], 'blocks' => $i['complex'] ? $i['blocks'] : array());
	}
	private function blockRegister($b) {
		$code = self::normCode(isset($b['code']) ? $b['code'] : '');
		$bp = self::normPhone(isset($b['blockPhone']) ? $b['blockPhone'] : '');
		$pass = (string) (isset($b['passHash']) ? $b['passHash'] : '');
		$name = trim(preg_replace('/\s+/u', ' ', (string) (isset($b['name']) ? $b['name'] : '')));
		$block = self::blockKey(isset($b['block']) ? $b['block'] : '');
		if ($code === '' || !preg_match('/^09\d{9}$/', $bp) || $pass === '' || self::isBcrypt($pass) || strlen($pass) > 200) throw new Apt_Sync_Error(400, 'bad_request');
		if (mb_strlen($name, 'UTF-8') < 2 || mb_strlen($name, 'UTF-8') > 60) throw new Apt_Sync_Error(400, 'bad_name');
		// مثل ثبت‌نام ساکن: محدودیت تعداد برای هر ساختمان و هر شماره
		$this->rateLimit('br:' . $code, 20, 3600);
		$this->rateLimit('brp:' . $code . ':' . $bp, 5, 3600);
		$phone = $this->s->codeOwner($code);
		if (!$phone) throw new Apt_Sync_Error(404, 'not_found');
		$info = $this->buildingBlocks($phone);
		if (!$info['complex']) throw new Apt_Sync_Error(409, 'not_complex');
		if ($block === '—' || !in_array($block, $info['blocks'], true)) throw new Apt_Sync_Error(400, 'bad_block', array('blocks' => $info['blocks']));
		if (!$this->s->lock($phone)) throw new Apt_Sync_Error(503, 'busy');
		try {
			$all = $this->s->getAll($phone); $rev = 0;
			foreach ($all as $rec) $rev = max($rev, (int) $rec['r']);
			$list = isset($all['block_managers']) ? self::jlist($all['block_managers']['v']) : array();
			$keep = array(); $pendingN = 0;
			foreach ($list as $m) {
				if (!is_array($m)) continue;
				$st = self::bmStatus($m);
				if (self::normPhone(isset($m['phone']) ? $m['phone'] : '') === $bp) {
					if ($st === 'rejected') continue; // درخواست ردشده قبلی جایش را به درخواست تازه می‌دهد
					throw new Apt_Sync_Error(409, 'phone_exists', array('status' => $st, 'sameBlock' => self::blockKey(isset($m['block']) ? $m['block'] : '') === $block));
				}
				if ($st === 'pending') $pendingN++;
				$keep[] = $m;
			}
			if ($pendingN >= 30) throw new Apt_Sync_Error(429, 'too_many_pending');
			$id = self::now() * 10 + mt_rand(0, 9);
			$row = array('id' => $id, 'name' => $name, 'phone' => $bp, 'block' => $block, 'active' => true, 'status' => 'pending',
				'source' => 'self', 'passwordHash' => password_hash($pass, PASSWORD_DEFAULT), 'requestedAt' => gmdate('Y-m-d\TH:i:s\Z'));
			$keep[] = $row;
			$rev++;
			$this->s->putKey($phone, 'block_managers', self::enc($keep), $rev, 'g');
			if ($this->pushOn()) $this->queuePush($phone, array(array('tag' => 'bmreq-' . $id, 'mgr' => true, 'blocks' => array(), 'units' => array(), 'rids' => array(),
				'body' => 'درخواست مدیر بلوک: ' . $name . ' (بلوک ' . $block . ')', 'url' => 'index.html?n=settings')), $this->s->getAll($phone), $this->s->getMeta($phone), array('ro' => 'g', 'id' => ''));
		} finally { $this->s->unlock($phone); }
		return array('ok' => true, 'status' => 'pending', 'id' => $id, 'block' => $block, 'name' => $info['name']);
	}

	/* ---------- actions ---------- */
	private function managerAuth($b, $create) {
		$phone = self::normPhone(isset($b['phone']) ? $b['phone'] : '');
		$pass = (string) (isset($b['passHash']) ? $b['passHash'] : '');
		if (strlen($phone) < 10 || $pass === '') throw new Apt_Sync_Error(400, 'bad_request');
		$this->rateLimit('m:' . $phone, 30, 900);
		$meta = $this->s->getMeta($phone);
		if (!$meta) {
			if (!$create) throw new Apt_Sync_Error(404, 'not_found');
			$code = self::normCode(isset($b['code']) ? $b['code'] : '');
			if ($code !== '') { $owner = $this->s->codeOwner($code); if ($owner && $owner !== $phone) throw new Apt_Sync_Error(409, 'code_taken'); }
			$meta = array('pass' => password_hash($pass, PASSWORD_DEFAULT), 'code' => $code, 'createdAt' => self::now());
			$this->s->setMeta($phone, $meta);
			if ($code !== '') $this->s->setCode($code, $phone);
		} elseif (!password_verify($pass, $meta['pass'])) {
			throw new Apt_Sync_Error(401, 'bad_password');
		}
		return array('token' => $this->sign(array('p' => $phone, 'ro' => 'm', 'e' => self::now() + self::TOKEN_TTL)), 'phone' => $phone, 'code' => isset($meta['code']) ? $meta['code'] : '');
	}
	private function residentOpen($b) {
		$code = self::normCode(isset($b['code']) ? $b['code'] : '');
		if ($code === '') throw new Apt_Sync_Error(400, 'bad_request');
		$this->rateLimit('c:' . $code, 60, 900);
		$phone = $this->s->codeOwner($code);
		if (!$phone) throw new Apt_Sync_Error(404, 'not_found');
		return array('token' => $this->sign(array('p' => $phone, 'ro' => 'r', 'c' => $code, 'e' => self::now() + self::TOKEN_TTL)), 'phone' => $phone, 'code' => $code);
	}
	private function residentLogin($b) {
		$o = $this->residentOpen($b);
		$rPhone = self::normPhone(isset($b['residentPhone']) ? $b['residentPhone'] : '');
		$pass = (string) (isset($b['passHash']) ? $b['passHash'] : '');
		$this->rateLimit('r:' . $o['code'] . ':' . $rPhone, 20, 900);
		$rec = $this->s->getKey($o['phone'], 'registered_residents');
		$list = $rec ? self::jlist($rec['v']) : array();
		$found = null;
		foreach ($list as $x) {
			if (is_array($x) && self::normCode(isset($x['buildingCode']) ? $x['buildingCode'] : '') === $o['code']
				&& self::normPhone(isset($x['phone']) ? $x['phone'] : '') === $rPhone && (isset($x['status']) ? $x['status'] : '') !== 'rejected') { $found = $x; break; }
		}
		if (!$found) throw new Apt_Sync_Error(404, 'resident_not_found');
		$h = isset($found['passwordHash']) ? (string) $found['passwordHash'] : '';
		$good = $h !== '' && (self::isBcrypt($h) ? password_verify($pass, $h) : hash_equals($h, $pass));
		if (!$good) throw new Apt_Sync_Error(401, 'bad_password');
		unset($found['passwordHash'], $found['password']);
		$tok = $this->sign(array('p' => $o['phone'], 'ro' => 'r', 'c' => $o['code'], 'rid' => (string) $found['id'], 'e' => self::now() + self::TOKEN_TTL));
		return array('ok' => true, 'resident' => $found, 'token' => $tok, 'phone' => $o['phone'], 'code' => $o['code']);
	}
	private function auth($b) {
		$t = $this->verify(isset($b['token']) ? $b['token'] : '');
		if (!$t) throw new Apt_Sync_Error(401, 'bad_token');
		if ($t['ro'] === 'r' || $t['ro'] === 'b') {
			$meta = $this->s->getMeta($t['p']);
			if (!$meta || self::normCode($meta['code']) !== self::normCode($t['c'])) throw new Apt_Sync_Error(401, 'bad_token');
		}
		if ($t['ro'] === 'b' && !self::bident($t, $this->s->getAll($t['p']))) throw new Apt_Sync_Error(401, 'bad_token'); // غیرفعال/حذف/رمز عوض شد
		return $t;
	}
	private function pull($b) {
		$t = $this->auth($b);
		$since = isset($b['since']) ? (int) $b['since'] : 0;
		$keys = new stdClass(); $rev = 0;
		$all = $this->s->getAll($t['p']);
		$id = $t['ro'] === 'r' ? self::ident($t, $all) : ($t['ro'] === 'b' ? self::bident($t, $all) : null);
		foreach ($all as $base => $rec) {
			$rev = max($rev, (int) $rec['r']);
			if ((int) $rec['r'] > $since) $keys->$base = array('v' => $this->outVal($t, $id, $base, $rec['v']), 'r' => (int) $rec['r']);
		}
		return array('keys' => $keys, 'rev' => $rev);
	}
	private function outVal($t, $id, $base, $v) {
		$v = self::stripSecrets($base, $v);
		if ($t['ro'] === 'b') return self::blockFilterOut($base, $v, $id);
		return ($t['ro'] === 'r') ? self::filterOut($base, $v, $id) : $v;
	}
	private function push($b) {
		$t = $this->auth($b);
		$changes = (isset($b['changes']) && is_array($b['changes'])) ? $b['changes'] : array();
		$applied = new stdClass(); $conflicts = new stdClass();
		if (!$this->s->lock($t['p'])) throw new Apt_Sync_Error(503, 'busy');
		try {
			$meta = $this->s->getMeta($t['p']);
			if (!$meta) throw new Apt_Sync_Error(404, 'not_found');
			$cur = $this->s->getAll($t['p']); $rev = 0;
			$before = $cur;
			foreach ($cur as $rec) $rev = max($rev, (int) $rec['r']);
			$id = null; $newRegs = array();
			if ($t['ro'] === 'r') {
				$id = self::ident($t, $cur);
				$rc = isset($changes['registered_residents']) && is_array($changes['registered_residents']) ? $changes['registered_residents'] : null;
				$rh = isset($cur['registered_residents']) ? $cur['registered_residents'] : null;
				if ($rc && (int) (isset($rc['r']) ? $rc['r'] : 0) === ($rh ? (int) $rh['r'] : 0) && isset($rc['v']) && is_string($rc['v']))
					$newRegs = self::newRegs($rc['v'], $rh ? $rh['v'] : null, $t['c']);
				// ثبت‌نام اول پردازش شود
				if ($rc) { $changes = array('registered_residents' => $rc) + $changes; }
			} elseif ($t['ro'] === 'b') {
				$id = self::bident($t, $cur);
				if (!$id) throw new Apt_Sync_Error(401, 'bad_token');
			}
			foreach ($changes as $base => $ch) {
				if (!in_array($base, self::BASES, true)) continue;
				if ($t['ro'] === 'r' && !in_array($base, self::RESIDENT_WRITABLE, true)) continue;
				if ($t['ro'] === 'b' && !in_array($base, self::BLOCK_WRITABLE, true)) continue;
				if (!is_array($ch)) continue;
				$have = isset($cur[$base]) ? $cur[$base] : null;
				$haveRev = $have ? (int) $have['r'] : 0;
				if ((int) (isset($ch['r']) ? $ch['r'] : 0) !== $haveRev) {
					$conflicts->$base = array('v' => $have ? $this->outVal($t, $id, $base, $have['v']) : null, 'r' => $haveRev);
					continue;
				}
				if ($t['ro'] === 'r' || $t['ro'] === 'b') {
					$inV = (!array_key_exists('v', $ch) || $ch['v'] === null) ? null : (string) $ch['v'];
					$v = $t['ro'] === 'b' ? self::blockGuard($base, $inV, $have ? $have['v'] : null, $id)
						: self::residentGuard($base, $inV, $have ? $have['v'] : null, $id, $newRegs, $t['c']);
					if ($have && $v === $have['v']) {
						// تغییری پذیرفته نشد: اگر نسخه دستگاه با سرور فرق دارد، نسخه را بالا ببر تا دستگاه نسخه درست را بگیرد
						if ($inV !== null && $inV !== $this->outVal($t, $id, $base, $have['v'])) { $rev++; $this->s->putKey($t['p'], $base, $have['v'], $rev, $t['ro']); $cur[$base] = array('v' => $have['v'], 'r' => $rev); $applied->$base = $rev; }
						else $applied->$base = $haveRev;
						continue;
					}
				} else {
					$v = (!array_key_exists('v', $ch) || $ch['v'] === null) ? null : self::keepSecrets($base, (string) $ch['v'], $have ? $have['v'] : null);
				}
				$rev++;
				if ($v === null) $this->s->delKey($t['p'], $base);
				else $this->s->putKey($t['p'], $base, $v, $rev, $t['ro']);
				$cur[$base] = array('v' => $v, 'r' => $rev);
				$applied->$base = $rev;
				if ($base === 'v3' && $t['ro'] === 'm' && $v !== null) {
					$code = self::codeFromV3($v);
					if ($code !== '' && $code !== self::normCode($meta['code'])) {
						$owner = $this->s->codeOwner($code);
						if (!$owner || $owner === $t['p']) {
							if (!empty($meta['code'])) $this->s->delCode(self::normCode($meta['code']));
							$this->s->setCode($code, $t['p']);
							$meta['code'] = $code; $this->s->setMeta($t['p'], $meta);
						}
					}
				}
			}
			if ($this->pushOn() && count((array) $applied)) $this->queuePush($t['p'], self::pushEvents($before, $cur), $cur, $meta, self::actorOf($t));
		} finally { $this->s->unlock($t['p']); }
		return array('applied' => $applied, 'conflicts' => $conflicts);
	}
	private function changePassword($b) {
		$t = $this->auth($b);
		if ($t['ro'] !== 'm') throw new Apt_Sync_Error(403, 'forbidden');
		$meta = $this->s->getMeta($t['p']);
		if (!$meta) throw new Apt_Sync_Error(404, 'not_found');
		if (!password_verify((string) (isset($b['oldHash']) ? $b['oldHash'] : ''), $meta['pass'])) throw new Apt_Sync_Error(401, 'bad_password');
		$new = (string) (isset($b['newHash']) ? $b['newHash'] : '');
		if ($new === '') throw new Apt_Sync_Error(400, 'bad_request');
		$meta['pass'] = password_hash($new, PASSWORD_DEFAULT);
		$this->s->setMeta($t['p'], $meta);
		return array('ok' => true);
	}

	/* ---------- اعلان فوری Web Push (نسخه ۱.۴) ----------
	 * اشتراک هر دستگاه {e: endpoint, k: p256dh, a: auth, ro: m|b|r, rid|bid} جدا از داده‌ها نگه داشته می‌شود
	 * (در pull برگردانده نمی‌شود). رویدادها از تفاوت داده قبل/بعد هر push درمی‌آیند و گیرنده‌ها با همان
	 * قواعد حریم pull انتخاب می‌شوند: ساکن فقط رویداد واحد خودش، مدیر بلوک فقط بلوک خودش.
	 */
	const PUSH_MAX_SUBS = 600;
	const PUSH_MAX_PER_ID = 6;
	private static function actorOf($t) {
		$ro = isset($t['ro']) ? $t['ro'] : '';
		return array('ro' => $ro, 'id' => $ro === 'r' ? (string) (isset($t['rid']) ? $t['rid'] : '') : ($ro === 'b' ? (string) (isset($t['bid']) ? $t['bid'] : '') : ''));
	}
	private function pushKeyAction() {
		if ($this->pushKey === null) throw new Apt_Sync_Error(503, 'push_unavailable');
		return array('ok' => true, 'key' => $this->pushKey);
	}
	private function pushSub($b) {
		if (!$this->pushOn()) throw new Apt_Sync_Error(503, 'push_unavailable');
		$t = $this->auth($b);
		$sub = isset($b['sub']) && is_array($b['sub']) ? $b['sub'] : array();
		$e = isset($sub['endpoint']) ? (string) $sub['endpoint'] : '';
		$k = isset($sub['keys']['p256dh']) ? (string) $sub['keys']['p256dh'] : '';
		$a = isset($sub['keys']['auth']) ? (string) $sub['keys']['auth'] : '';
		if (!class_exists('Apt_Sync_WebPush') || !Apt_Sync_WebPush::endpointAllowed($e)) throw new Apt_Sync_Error(400, 'bad_endpoint');
		$kr = Apt_Sync_WebPush::b64ud($k); $ar = Apt_Sync_WebPush::b64ud($a);
		if (!is_string($kr) || strlen($kr) !== 65 || $kr[0] !== "\x04" || !is_string($ar) || strlen($ar) < 16 || strlen($ar) > 64) throw new Apt_Sync_Error(400, 'bad_keys');
		$row = array('e' => $e, 'k' => $k, 'a' => $a, 'ro' => $t['ro'], 't' => self::now());
		if ($t['ro'] === 'r') {
			$id = self::ident($t, $this->s->getAll($t['p']));
			if ($id['rid'] === null) throw new Apt_Sync_Error(403, 'need_login'); // مهمان (فقط کد ساختمان) اشتراک نمی‌گیرد
			$row['rid'] = $id['rid'];
		} elseif ($t['ro'] === 'b') $row['bid'] = (string) $t['bid'];
		$this->rateLimit('ps:' . $t['p'], 120, 3600);
		if (!$this->s->lock($t['p'])) throw new Apt_Sync_Error(503, 'busy');
		try {
			$list = (array) $this->s->getPush($t['p']); $keep = array(); $mine = 0;
			foreach ($list as $x) {
				if (!is_array($x) || !isset($x['e']) || $x['e'] === $e) continue; // همان دستگاه: جایگزین (شاید حساب عوض شده)
				$same = isset($x['ro']) && $x['ro'] === $row['ro'] && (isset($x['rid']) ? $x['rid'] : '') === (isset($row['rid']) ? $row['rid'] : '') && (isset($x['bid']) ? $x['bid'] : '') === (isset($row['bid']) ? $row['bid'] : '');
				if ($same) $mine++;
				$keep[] = $x;
			}
			if ($mine >= self::PUSH_MAX_PER_ID) { // قدیمی‌ترین دستگاه همین حساب کنار می‌رود
				foreach ($keep as $i => $x) if ($x['ro'] === $row['ro'] && (isset($x['rid']) ? $x['rid'] : '') === (isset($row['rid']) ? $row['rid'] : '') && (isset($x['bid']) ? $x['bid'] : '') === (isset($row['bid']) ? $row['bid'] : '')) { unset($keep[$i]); break; }
				$keep = array_values($keep);
			}
			if (count($keep) >= self::PUSH_MAX_SUBS) array_shift($keep);
			$keep[] = $row;
			$this->s->setPush($t['p'], $keep);
		} finally { $this->s->unlock($t['p']); }
		return array('ok' => true);
	}
	private function pushUnsub($b) {
		if (!method_exists($this->s, 'getPush')) return array('ok' => true);
		$e = isset($b['endpoint']) ? (string) $b['endpoint'] : '';
		$t = $this->auth($b);
		$this->removeEndpoints($t['p'], array($e));
		return array('ok' => true);
	}
	public function removeEndpoints($phone, $endpoints) {
		if (!method_exists($this->s, 'getPush') || !$endpoints) return 0;
		$drop = array_flip($endpoints); $n = 0;
		if (!$this->s->lock($phone)) return 0;
		try {
			$keep = array();
			foreach ((array) $this->s->getPush($phone) as $x) { if (is_array($x) && isset($x['e']) && isset($drop[$x['e']])) { $n++; continue; } $keep[] = $x; }
			if ($n) $this->s->setPush($phone, $keep);
		} finally { $this->s->unlock($phone); }
		return $n;
	}

	private static function shortTxt($s, $n) {
		$s = trim(preg_replace('/\s+/u', ' ', (string) $s));
		return mb_strlen($s, 'UTF-8') > $n ? mb_substr($s, 0, $n - 1, 'UTF-8') . '…' : $s;
	}
	private static function unitLabel($u) {
		if (!is_array($u)) return '';
		$b = self::blockKey(isset($u['block']) ? $u['block'] : '');
		return 'واحد ' . (isset($u['number']) ? $u['number'] : '?') . ($b !== '—' ? ' بلوک ' . $b : '');
	}

	/**
	 * رویدادهای اعلان از تفاوت داده قبل و بعد. هر رویداد:
	 * {tag, body, url, units: [unitId…] (ساکنین), rids: [regId…], mgr: bool (مدیر کل), blocks: [block…] (مدیران بلوک)}
	 */
	public static function pushEvents($before, $after) {
		$L = function ($all, $b) { return isset($all[$b]) ? self::jlist($all[$b]['v']) : array(); };
		$units = self::byIdMap($L($after, 'units'));
		$blockOfUnit = function ($uid) use ($units) { return isset($units[(string) $uid]) ? self::blockKey(isset($units[(string) $uid]['block']) ? $units[(string) $uid]['block'] : '') : '—'; };
		$ev = array();
		$money = function ($c) { $a = isset($c['total']) ? $c['total'] : (isset($c['amount']) ? $c['amount'] : 0); return number_format((float) $a) . ' تومان'; };
		$period = function ($c) { return trim((isset($c['month']) ? $c['month'] : '') . ' ' . (isset($c['year']) ? $c['year'] : '')); };

		// اطلاعیه تازه → ساکنین هدف
		$bN = self::byIdMap($L($before, 'notices'));
		$freshN = array();
		foreach ($L($after, 'notices') as $n) if (is_array($n) && isset($n['id']) && !isset($bN[(string) $n['id']])) $freshN[] = $n;
		if (count($freshN) > 5) $freshN = array(); // بازگردانی پشتیبان یا همگام‌سازی اول، نه اطلاعیه تازه
		foreach ($freshN as $n) {
			$tt = isset($n['targetType']) ? $n['targetType'] : 'all'; $to = array();
			foreach ($units as $uid => $u) {
				if ($tt === 'all') $to[] = $uid;
				elseif ($tt === 'block' && self::blockKey(isset($u['block']) ? $u['block'] : '') === self::blockKey(isset($n['targetBlock']) ? $n['targetBlock'] : '')) $to[] = $uid;
			}
			if ($tt === 'units') foreach ((array) (isset($n['targetUnits']) ? $n['targetUnits'] : array()) as $x) $to[] = (string) $x;
			$title = self::shortTxt(isset($n['title']) ? $n['title'] : '', 60);
			$ev[] = array('tag' => 'notice-' . $n['id'], 'units' => $to, 'url' => 'resident.html?n=notices',
				'body' => '📢 ' . ($title !== '' ? $title : 'اطلاعیه جدید') . (isset($n['body']) && trim((string) $n['body']) !== '' ? ' — ' . self::shortTxt($n['body'], 140) : ''));
		}
		// پیام تازه: مدیر → ساکن / ساکن → مدیر و مدیر بلوک
		$bM = self::byIdMap($L($before, 'messages'));
		$freshM = array();
		foreach ($L($after, 'messages') as $m) if (is_array($m) && isset($m['id']) && !isset($bM[(string) $m['id']]) && isset($m['unitId'])) $freshM[(string) $m['unitId'] . '|' . (isset($m['direction']) ? $m['direction'] : '')][] = $m;
		foreach ($freshM as $grp) {
			$m = end($grp);
			$dir = isset($m['direction']) ? $m['direction'] : '';
			$txt = count($grp) > 3 ? count($grp) . ' پیام تازه' : self::shortTxt(isset($m['body']) ? $m['body'] : '', 140);
			if ($dir === 'sent') $ev[] = array('tag' => 'msg-' . $m['id'], 'units' => array((string) $m['unitId']), 'url' => 'resident.html?n=messages', 'body' => '💬 پیام جدید از مدیر: ' . $txt);
			elseif ($dir === 'received') $ev[] = array('tag' => 'rmsg-' . $m['id'], 'mgr' => true, 'blocks' => array($blockOfUnit($m['unitId'])), 'url' => 'index.html?n=messages',
				'body' => '💬 پیام از ' . self::unitLabel(isset($units[(string) $m['unitId']]) ? $units[(string) $m['unitId']] : array('number' => '?')) . ': ' . $txt);
		}
		// شارژ: صدور، اعلام پرداخت، تأیید، رد
		$bC = self::byIdMap($L($before, 'charges'));
		$newPerUnit = array();
		foreach ($L($after, 'charges') as $c) {
			if (!is_array($c) || !isset($c['id']) || !isset($c['unitId'])) continue;
			$uid = (string) $c['unitId']; $k = (string) $c['id'];
			if (!isset($bC[$k])) { if (empty($c['paid'])) $newPerUnit[$uid][] = $c; continue; }
			$o = $bC[$k];
			if (empty($o['pendingApproval']) && !empty($c['pendingApproval']) && empty($c['paid']))
				$ev[] = array('tag' => 'pay-' . $k . '-' . (isset($c['pendingAt']) ? $c['pendingAt'] : ''), 'mgr' => true, 'blocks' => array($blockOfUnit($uid)), 'url' => 'index.html?n=charges',
					'body' => '💳 اعلام پرداخت ' . self::unitLabel(isset($units[$uid]) ? $units[$uid] : array('number' => '?')) . ': ' . $money($c) . ($period($c) ? ' (' . $period($c) . ')' : ''));
			elseif (empty($o['paid']) && !empty($c['paid']))
				$ev[] = array('tag' => 'payok-' . $k, 'units' => array($uid), 'url' => 'resident.html?n=charges', 'body' => '✅ پرداخت شارژ ' . $period($c) . ' (' . $money($c) . ') تأیید شد');
			elseif (!empty($o['pendingApproval']) && empty($c['pendingApproval']) && empty($c['paid']))
				$ev[] = array('tag' => 'payrej-' . $k . '-' . (isset($c['rejectedAt']) ? $c['rejectedAt'] : ''), 'units' => array($uid), 'url' => 'resident.html?n=charges',
					'body' => '✖ اعلام پرداخت شارژ ' . $period($c) . ' رد شد' . (!empty($c['rejectReason']) ? ': ' . self::shortTxt($c['rejectReason'], 100) : ''));
		}
		foreach ($newPerUnit as $uid => $cs) {
			$c = $cs[0];
			$ev[] = array('tag' => 'charge-' . $c['id'], 'units' => array((string) $uid), 'url' => 'resident.html?n=charges',
				'body' => count($cs) > 1 ? '💰 ' . count($cs) . ' شارژ جدید برای واحد شما صادر شد' : '💰 شارژ جدید ' . $period($c) . ': ' . $money($c));
		}
		// ثبت‌نام ساکن: درخواست تازه → مدیر/مدیر بلوک؛ تأیید → خود ساکن
		$bR = self::byIdMap($L($before, 'registered_residents'));
		foreach ($L($after, 'registered_residents') as $r) {
			if (!is_array($r) || !isset($r['id'])) continue;
			$k = (string) $r['id']; $st = isset($r['status']) ? $r['status'] : '';
			if (!isset($bR[$k])) {
				if ($st === 'pending') $ev[] = array('tag' => 'reg-' . $k, 'mgr' => true, 'blocks' => array(self::blockKey(isset($r['block']) ? $r['block'] : '')), 'url' => 'index.html?n=units',
					'body' => '👤 درخواست عضویت: ' . self::shortTxt(isset($r['name']) ? $r['name'] : '', 40) . ' — ' . self::unitLabel(array('number' => isset($r['unitNumber']) ? $r['unitNumber'] : '?', 'block' => isset($r['block']) ? $r['block'] : '')));
			} elseif ((isset($bR[$k]['status']) ? $bR[$k]['status'] : '') === 'pending' && $st === 'approved') {
				$ev[] = array('tag' => 'regok-' . $k, 'rids' => array($k), 'url' => 'resident.html', 'body' => '🎉 عضویت شما در ساختمان تأیید شد');
			}
		}
		// درخواست مدیر بلوک → مدیر کل
		$bB = self::byIdMap($L($before, 'block_managers'));
		foreach ($L($after, 'block_managers') as $m) {
			if (!is_array($m) || !isset($m['id']) || isset($bB[(string) $m['id']]) || self::bmStatus($m) !== 'pending') continue;
			$ev[] = array('tag' => 'bmreq-' . $m['id'], 'mgr' => true, 'url' => 'index.html?n=settings', 'body' => '🧩 درخواست مدیر بلوک: ' . self::shortTxt(isset($m['name']) ? $m['name'] : '', 40) . ' (بلوک ' . (isset($m['block']) ? $m['block'] : '') . ')');
		}
		foreach ($ev as &$e) { $e += array('units' => array(), 'rids' => array(), 'mgr' => false, 'blocks' => array()); $e['units'] = array_values(array_unique(array_map('strval', $e['units']))); }
		unset($e);
		return array_slice($ev, 0, 300);
	}

	/** گیرنده‌های یک رویداد از میان اشتراک‌ها (با همان قواعد حریم pull) */
	public static function pushTargets($subs, $event, $after, $code, $actor = null) {
		$out = array(); $idCache = array(); $bCache = array();
		$units = array_flip($event['units']); $rids = array_flip(array_map('strval', $event['rids']));
		foreach ((array) $subs as $s) {
			if (!is_array($s) || empty($s['e']) || empty($s['ro'])) continue;
			$ro = $s['ro'];
			if ($actor && $actor['ro'] === $ro && ($ro === 'm' || (string) (isset($s[$ro === 'r' ? 'rid' : 'bid']) ? $s[$ro === 'r' ? 'rid' : 'bid'] : '') === $actor['id'])) continue; // به خود فرستنده نه
			if ($ro === 'm') { if (!empty($event['mgr'])) $out[] = $s; continue; }
			if ($ro === 'b') {
				if (empty($event['mgr']) || !$event['blocks']) continue;
				$bid = (string) (isset($s['bid']) ? $s['bid'] : '');
				if (!array_key_exists($bid, $bCache)) {
					$bCache[$bid] = null;
					foreach ((isset($after['block_managers']) ? self::jlist($after['block_managers']['v']) : array()) as $m)
						if (is_array($m) && isset($m['id']) && (string) $m['id'] === $bid && self::bmActive($m)) $bCache[$bid] = self::blockKey(isset($m['block']) ? $m['block'] : '');
				}
				if ($bCache[$bid] !== null && $bCache[$bid] !== '—' && in_array($bCache[$bid], $event['blocks'], true)) $out[] = $s;
				continue;
			}
			if ($ro === 'r') {
				$rid = (string) (isset($s['rid']) ? $s['rid'] : '');
				if ($rid === '') continue;
				if (!isset($idCache[$rid])) $idCache[$rid] = self::ident(array('rid' => $rid, 'c' => $code), $after);
				$id = $idCache[$rid];
				if ($id['rid'] === null) continue; // ردشده یا حذف‌شده
				if (isset($rids[$rid])) { $out[] = $s; continue; }
				if (empty($id['approved'])) continue; // ثبت‌نام تأییدنشده هنوز داده واحد را نمی‌گیرد
				foreach ($id['unitIds'] as $u) if (isset($units[$u])) { $out[] = $s; break; }
			}
		}
		return $out;
	}

	private function queuePush($phone, $events, $after, $meta, $actor) {
		if (!$events) return;
		$subs = (array) $this->s->getPush($phone);
		if (!$subs) return;
		$code = self::normCode(is_array($meta) && isset($meta['code']) ? $meta['code'] : '');
		foreach ($events as $e) {
			foreach (self::pushTargets($subs, $e, $after, $code, $actor) as $s) {
				if (count($this->outbox) >= 400) return;
				$this->outbox[] = array('phone' => $phone, 'sub' => $s, 'tag' => $e['tag'], 'payload' => self::enc(array('title' => 'آپارتمان پلاس', 'body' => $e['body'], 'url' => $e['url'], 'tag' => $e['tag'])));
			}
		}
	}

	/** returns array(status, body) */
	public function handle($body) {
		try {
			if (!is_array($body)) throw new Apt_Sync_Error(400, 'bad_request');
			$a = isset($body['action']) ? $body['action'] : '';
			switch ($a) {
				case 'login': $out = $this->managerAuth($body, false); break;
				case 'register': $out = $this->managerAuth($body, true); break;
				case 'open': $out = $this->residentOpen($body); break;
				case 'resident_login': $out = $this->residentLogin($body); break;
				case 'block_login': $out = $this->blockLogin($body); break;
				case 'block_info': $out = $this->blockInfo($body); break;
				case 'block_register': $out = $this->blockRegister($body); break;
				case 'pull': $out = $this->pull($body); break;
				case 'push': $out = $this->push($body); break;
				case 'change_password': $out = $this->changePassword($body); break;
				case 'push_key': $out = $this->pushKeyAction(); break;
				case 'push_sub': $out = $this->pushSub($body); break;
				case 'push_unsub': $out = $this->pushUnsub($body); break;
				default: throw new Apt_Sync_Error(400, 'unknown_action');
			}
			return array(200, $out);
		} catch (Apt_Sync_Error $e) {
			return array($e->status, array_merge(array('error' => $e->getMessage()), (array) $e->extra));
		}
	}
}
}
