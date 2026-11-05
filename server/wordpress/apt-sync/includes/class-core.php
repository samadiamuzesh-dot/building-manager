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
		'settings', 'side_incomes', 'tickets', 'votings', 'plan', 'registered_residents');
	const RESIDENT_WRITABLE = array('units', 'charges', 'messages', 'notifications', 'votings', 'tickets', 'registered_residents');
	const TOKEN_TTL = 5184000000; // ۶۰ روز (میلی‌ثانیه)
	const PAY_FIELDS = array('pendingApproval', 'pendingAt', 'payMethod', 'payDescription', 'trackingCode', 'paidByResident',
		'receipt', 'receiptImage', 'residentNote', 'rejectReason', 'rejectedAt');

	/** @var object store: getMeta setMeta getKey getAll putKey delKey codeOwner setCode delCode lock unlock rateHit */
	private $s; private $secret;
	public function __construct($store, $secret) { $this->s = $store; $this->secret = (string) $secret; }

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
		if (in_array($base, array('tickets'), true)) return '[]';
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
		if ($base !== 'registered_residents' || $v === null) return $v;
		$list = json_decode((string) $v, true);
		if (!self::isList($list)) return $v;
		foreach ($list as &$r) if (is_array($r)) { unset($r['password'], $r['passwordHash']); }
		return self::enc($list);
	}
	public static function keepSecrets($base, $incoming, $current) {
		if ($base !== 'registered_residents' || $incoming === null) return $incoming;
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
		if ($t['ro'] === 'r') {
			$meta = $this->s->getMeta($t['p']);
			if (!$meta || self::normCode($meta['code']) !== self::normCode($t['c'])) throw new Apt_Sync_Error(401, 'bad_token');
		}
		return $t;
	}
	private function pull($b) {
		$t = $this->auth($b);
		$since = isset($b['since']) ? (int) $b['since'] : 0;
		$keys = new stdClass(); $rev = 0;
		$all = $this->s->getAll($t['p']);
		$id = $t['ro'] === 'r' ? self::ident($t, $all) : null;
		foreach ($all as $base => $rec) {
			$rev = max($rev, (int) $rec['r']);
			if ((int) $rec['r'] > $since) $keys->$base = array('v' => $this->outVal($t, $id, $base, $rec['v']), 'r' => (int) $rec['r']);
		}
		return array('keys' => $keys, 'rev' => $rev);
	}
	private function outVal($t, $id, $base, $v) {
		$v = self::stripSecrets($base, $v);
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
			}
			foreach ($changes as $base => $ch) {
				if (!in_array($base, self::BASES, true)) continue;
				if ($t['ro'] === 'r' && !in_array($base, self::RESIDENT_WRITABLE, true)) continue;
				if (!is_array($ch)) continue;
				$have = isset($cur[$base]) ? $cur[$base] : null;
				$haveRev = $have ? (int) $have['r'] : 0;
				if ((int) (isset($ch['r']) ? $ch['r'] : 0) !== $haveRev) {
					$conflicts->$base = array('v' => $have ? $this->outVal($t, $id, $base, $have['v']) : null, 'r' => $haveRev);
					continue;
				}
				if ($t['ro'] === 'r') {
					$inV = (!array_key_exists('v', $ch) || $ch['v'] === null) ? null : (string) $ch['v'];
					$v = self::residentGuard($base, $inV, $have ? $have['v'] : null, $id, $newRegs, $t['c']);
					if ($have && $v === $have['v']) {
						// تغییری پذیرفته نشد: اگر نسخه دستگاه با سرور فرق دارد، نسخه را بالا ببر تا دستگاه نسخه درست را بگیرد
						if ($inV !== null && $inV !== $this->outVal($t, $id, $base, $have['v'])) { $rev++; $this->s->putKey($t['p'], $base, $have['v'], $rev, 'r'); $cur[$base] = array('v' => $have['v'], 'r' => $rev); $applied->$base = $rev; }
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
				case 'pull': $out = $this->pull($body); break;
				case 'push': $out = $this->push($body); break;
				case 'change_password': $out = $this->changePassword($body); break;
				default: throw new Apt_Sync_Error(400, 'unknown_action');
			}
			return array(200, $out);
		} catch (Apt_Sync_Error $e) {
			return array($e->status, array_merge(array('error' => $e->getMessage()), (array) $e->extra));
		}
	}
}
}
