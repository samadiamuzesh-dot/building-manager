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

	/* ساکن نمی‌تواند خودش را تأیید کند یا شارژی را «پرداخت‌شده» کند */
	public static function residentGuard($base, $incoming, $current) {
		if ($incoming === null) return $current;
		$inc = json_decode((string) $incoming, true);
		$cur = $current ? json_decode((string) $current, true) : array();
		if (!self::isList($inc)) return $current;
		if (!is_array($cur)) $cur = array();
		$byId = array();
		foreach ($cur as $x) if (is_array($x) && isset($x['id'])) $byId[(string) $x['id']] = $x;
		$out = array(); $seen = array();
		if ($base === 'registered_residents') {
			foreach ($inc as $r) {
				if (!is_array($r)) { $out[] = $r; continue; }
				$id = isset($r['id']) ? (string) $r['id'] : '';
				$seen[$id] = 1;
				if (isset($byId[$id])) {
					$old = $byId[$id];
					$r['status'] = isset($old['status']) ? $old['status'] : null;
					if (array_key_exists('reviewedAt', $old)) $r['reviewedAt'] = $old['reviewedAt']; else unset($r['reviewedAt']);
				} else { $r['status'] = 'pending'; }
				$out[] = $r;
			}
		} elseif ($base === 'charges') {
			foreach ($inc as $c) {
				if (!is_array($c) || !isset($c['id'])) continue;
				$id = (string) $c['id'];
				if (!isset($byId[$id])) continue; // ساکن شارژ جدید صادر نمی‌کند
				$o = $byId[$id];
				if (empty($o['paid'])) foreach (self::PAY_FIELDS as $f) if (array_key_exists($f, $c)) $o[$f] = $c[$f];
				$seen[$id] = 1; $out[] = $o;
			}
		} else { return $incoming; }
		foreach ($byId as $id => $x) if (!isset($seen[$id])) $out[] = $x;
		return self::enc($out);
	}
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
		$byId = array();
		foreach (self::jlist($current) as $r) if (is_array($r) && isset($r['id'])) $byId[(string) $r['id']] = $r;
		foreach ($inc as &$r) {
			if (!is_array($r) || !isset($r['id'])) continue;
			$old = isset($byId[(string) $r['id']]) ? $byId[(string) $r['id']] : null;
			if (empty($r['passwordHash']) && empty($r['password']) && $old) {
				if (!empty($old['passwordHash'])) $r['passwordHash'] = $old['passwordHash'];
				elseif (!empty($old['password'])) $r['password'] = $old['password'];
			}
		}
		return self::enc($inc);
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
		if (empty($found['passwordHash']) || !hash_equals((string) $found['passwordHash'], $pass)) throw new Apt_Sync_Error(401, 'bad_password');
		return array('ok' => true, 'resident' => $found);
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
		foreach ($this->s->getAll($t['p']) as $base => $rec) {
			$rev = max($rev, (int) $rec['r']);
			if ((int) $rec['r'] > $since) $keys->$base = array('v' => self::stripSecrets($base, $rec['v']), 'r' => (int) $rec['r']);
		}
		return array('keys' => $keys, 'rev' => $rev);
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
			foreach ($changes as $base => $ch) {
				if (!in_array($base, self::BASES, true)) continue;
				if ($t['ro'] === 'r' && !in_array($base, self::RESIDENT_WRITABLE, true)) continue;
				if (!is_array($ch)) continue;
				$have = isset($cur[$base]) ? $cur[$base] : null;
				$haveRev = $have ? (int) $have['r'] : 0;
				if ((int) (isset($ch['r']) ? $ch['r'] : 0) !== $haveRev) {
					$conflicts->$base = array('v' => $have ? self::stripSecrets($base, $have['v']) : null, 'r' => $haveRev);
					continue;
				}
				$v = (!array_key_exists('v', $ch) || $ch['v'] === null) ? null : self::keepSecrets($base, (string) $ch['v'], $have ? $have['v'] : null);
				if ($t['ro'] === 'r' && ($base === 'registered_residents' || $base === 'charges')) $v = self::residentGuard($base, $v, $have ? $have['v'] : null);
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
