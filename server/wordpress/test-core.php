<?php
require __DIR__ . '/apt-sync/includes/class-core.php';
class MemStore {
	public $m = array(); public $k = array(); public $c = array(); public $rl = array();
	function getMeta($p) { return isset($this->m[$p]) ? $this->m[$p] : null; }
	function setMeta($p, $x) { $this->m[$p] = $x; }
	function getKey($p, $b) { return isset($this->k[$p][$b]) ? $this->k[$p][$b] : null; }
	function getAll($p) { return isset($this->k[$p]) ? $this->k[$p] : array(); }
	function putKey($p, $b, $v, $r, $by) { $this->k[$p][$b] = array('v' => $v, 'r' => $r); }
	function delKey($p, $b) { unset($this->k[$p][$b]); }
	function codeOwner($c) { return isset($this->c[$c]) ? $this->c[$c] : null; }
	function setCode($c, $p) { $this->c[$c] = $p; }
	function delCode($c) { unset($this->c[$c]); }
	function lock($p) { return true; } function unlock($p) {}
	function rateHit($k, $s) { $this->rl[$k] = (isset($this->rl[$k]) ? $this->rl[$k] : 0) + 1; return $this->rl[$k]; }
}
$S = new MemStore(); $core = new Apt_Sync_Core($S, 'secret');
$pass = 0; $failN = 0;
function ok($name, $cond) { global $pass, $failN; if ($cond) { $pass++; echo "PASS $name\n"; } else { $failN++; echo "FAIL $name\n"; } }
function call($b) { global $core; $r = $core->handle(json_decode(json_encode($b), true)); return array($r[0], json_decode(json_encode($r[1]), true)); }

list($s, $reg) = call(array('action' => 'register', 'phone' => '۰۹۱۲۱۱۱۲۲۳۳', 'passHash' => 'H1', 'code' => 's-482193'));
ok('register', $s == 200 && $reg['phone'] === '09121112233' && $reg['code'] === 'S-482193');
$mt = $reg['token'];
list($s,) = call(array('action' => 'register', 'phone' => '09120000000', 'passHash' => 'x', 'code' => 'S-482193'));
ok('code taken', $s == 409);
list($s,) = call(array('action' => 'login', 'phone' => '09121112233', 'passHash' => 'bad'));
ok('bad password', $s == 401);
list($s,) = call(array('action' => 'login', 'phone' => '09999999999', 'passHash' => 'x'));
ok('login unknown 404', $s == 404);

$charges = array(array('id' => 1, 'unitId' => 1, 'amount' => 100, 'paid' => false), array('id' => 2, 'unitId' => 2, 'amount' => 100, 'paid' => true));
$units0 = array(array('id' => 1, 'block' => '—', 'number' => 1, 'chargeAmount' => 100, 'owner' => array('name' => 'A', 'phone' => '09350001111')), array('id' => 2, 'block' => '—', 'number' => 2, 'chargeAmount' => 100, 'owner' => array('name' => 'B', 'phone' => '09350002222', 'nationalId' => '123', 'approved' => true)));
list($s, $p) = call(array('action' => 'push', 'token' => $mt, 'changes' => array(
	'charges' => array('v' => json_encode($charges), 'r' => 0),
	'settings' => array('v' => '{"a":1}', 'r' => 0),
	'v3' => array('v' => json_encode(array('building' => array('code' => 'S-482193'))), 'r' => 0),
	'units' => array('v' => json_encode($units0), 'r' => 0))));
ok('manager push', $s == 200 && $p['applied']['charges'] == 1 && $p['applied']['v3'] == 3);

list($s, $o) = call(array('action' => 'open', 'code' => 's-482193'));
ok('resident open', $s == 200 && $o['phone'] === '09121112233');
$rt = $o['token'];
list($s, $pl) = call(array('action' => 'pull', 'token' => $rt, 'since' => 0));
ok('resident pull', $s == 200 && isset($pl['keys']['charges']) && $pl['rev'] == 4);

// ثبت‌نام ساکن از گوشی جدید
$reg1 = array(array('id' => 10, 'buildingCode' => 'S-482193', 'phone' => '09350001111', 'passwordHash' => 'RP', 'status' => 'approved', 'block' => '—', 'unitNumber' => 1));
list($s, $p) = call(array('action' => 'push', 'token' => $rt, 'changes' => array('registered_residents' => array('v' => json_encode($reg1), 'r' => 0))));
$stored = json_decode($S->k['09121112233']['registered_residents']['v'], true);
ok('resident register forced pending', $s == 200 && $stored[0]['status'] === 'pending' && password_verify('RP', $stored[0]['passwordHash']));
list($s, $pl) = call(array('action' => 'pull', 'token' => $mt, 'since' => 4));
$rr = json_decode($pl['keys']['registered_residents']['v'], true);
ok('password hidden on pull', !isset($rr[0]['passwordHash']));
// مدیر تأیید می‌کند (بدون رمز در داده)
$rr[0]['status'] = 'approved';
list($s, $p) = call(array('action' => 'push', 'token' => $mt, 'changes' => array('registered_residents' => array('v' => json_encode($rr), 'r' => 5))));
$stored = json_decode($S->k['09121112233']['registered_residents']['v'], true);
ok('manager approve keeps password', $s == 200 && $stored[0]['status'] === 'approved' && password_verify('RP', $stored[0]['passwordHash']));
list($s, $lg) = call(array('action' => 'resident_login', 'code' => 'S-482193', 'residentPhone' => '09350001111', 'passHash' => 'RP'));
ok('resident login', $s == 200 && $lg['ok'] === true && !empty($lg['token']) && !isset($lg['resident']['passwordHash']));
$rid = $lg['token'];
list($s,) = call(array('action' => 'resident_login', 'code' => 'S-482193', 'residentPhone' => '09350001111', 'passHash' => 'no'));
ok('resident wrong pass', $s == 401);

// ساکن: اعلام پرداخت بله، پرداخت‌شده نه، شارژ جدید نه
$c2 = $charges; $c2[0]['paid'] = true; $c2[0]['pendingApproval'] = true; $c2[0]['trackingCode'] = 'T1'; $c2[] = array('id' => 99, 'amount' => 1);
list($s, $p) = call(array('action' => 'push', 'token' => $rid, 'changes' => array('charges' => array('v' => json_encode($c2), 'r' => 1), 'settings' => array('v' => '{"hack":1}', 'r' => 2))));
$st = json_decode($S->k['09121112233']['charges']['v'], true);
ok('resident pending payment only', $s == 200 && $st[0]['paid'] === false && $st[0]['pendingApproval'] === true && $st[0]['trackingCode'] === 'T1' && count($st) == 2);
ok('resident cannot write settings', $S->k['09121112233']['settings']['v'] === '{"a":1}' && !isset($p['applied']['settings']));


// ===== امنیت ۱.۱ =====
$PH = '09121112233';
$get = function ($b) use (&$S, $PH) { return json_decode($S->k[$PH][$b]['v'], true); };
$rev = function ($b) use (&$S, $PH) { return $S->k[$PH][$b]['r']; };
// مهمان (فقط کد) نمی‌تواند رمز ساکن دیگر را عوض کند
$rr2 = $get('registered_residents'); $rr2[0]['passwordHash'] = 'EVIL'; $rr2[0]['phone'] = '09000000000';
call(array('action' => 'push', 'token' => $rt, 'changes' => array('registered_residents' => array('v' => json_encode($rr2), 'r' => $rev('registered_residents')))));
$x = $get('registered_residents');
ok('guest cannot hijack resident password', password_verify('RP', $x[0]['passwordHash']) && $x[0]['phone'] === '09350001111');
// مهمان واحد دیگری را عوض نمی‌کند
$u = $get('units'); $u[1]['owner']['name'] = 'HACK'; $u[1]['chargeAmount'] = 0;
call(array('action' => 'push', 'token' => $rt, 'changes' => array('units' => array('v' => json_encode($u), 'r' => $rev('units')))));
$x = $get('units'); ok('guest cannot edit units', $x[1]['owner']['name'] === 'B' && $x[1]['chargeAmount'] == 100);
// ساکن واقعی: واحد خودش بله (جز مبلغ شارژ)، واحد دیگری نه
$u = $get('units'); $u[0]['area'] = 90; $u[0]['chargeAmount'] = 1; $u[0]['owner'] = array('name' => 'A2'); $u[1]['owner']['name'] = 'HACK';
call(array('action' => 'push', 'token' => $rid, 'changes' => array('units' => array('v' => json_encode($u), 'r' => $rev('units')))));
$x = $get('units'); ok('resident edits own unit only', $x[0]['area'] == 90 && $x[0]['chargeAmount'] == 100 && $x[0]['owner']['name'] === 'A2' && $x[0]['owner']['phone'] === '09350001111' && $x[1]['owner']['name'] === 'B');
// حذف واحد توسط ساکن ممکن نیست
call(array('action' => 'push', 'token' => $rid, 'changes' => array('units' => array('v' => '[]', 'r' => $rev('units')))));
ok('resident cannot delete units', count($get('units')) == 2);
// حریم: موبایل/کد ملی واحد دیگر و پیام‌های دیگران دیده نمی‌شود
$ms = array(array('id' => 1, 'unitId' => 2, 'direction' => 'received', 'body' => 'secret'), array('id' => 2, 'unitId' => 1, 'direction' => 'sent', 'body' => 'hi', 'read' => false));
list(, $p) = call(array('action' => 'push', 'token' => $mt, 'changes' => array('messages' => array('v' => json_encode($ms), 'r' => 0))));
list(, $pl) = call(array('action' => 'pull', 'token' => $rid, 'since' => 0));
$pu = json_decode($pl['keys']['units']['v'], true); $pm = json_decode($pl['keys']['messages']['v'], true); $pr = json_decode($pl['keys']['registered_residents']['v'], true);
ok('privacy: other unit phone hidden, own kept', !isset($pu[1]['owner']['phone']) && !isset($pu[1]['owner']['nationalId']) && $pu[1]['owner']['name'] === 'B' && $pu[0]['owner']['phone'] === '09350001111');
ok('privacy: only own messages', count($pm) == 1 && $pm[0]['id'] == 2);
list(, $pg) = call(array('action' => 'pull', 'token' => $rt, 'since' => 0));
ok('guest sees no messages / phones', json_decode($pg['keys']['messages']['v'], true) === array() && strpos($pg['keys']['units']['v'], '0935') === false && strpos($pg['keys']['registered_residents']['v'], '0935') === false);
// پیام: ساکن فقط برای واحد خودش، پیام دیگران حذف نمی‌شود
$pm[0]['read'] = true; $pm[] = array('id' => 3, 'unitId' => 1, 'direction' => 'received', 'body' => 'salam'); $pm[] = array('id' => 4, 'unitId' => 2, 'direction' => 'received', 'body' => 'fake');
call(array('action' => 'push', 'token' => $rid, 'changes' => array('messages' => array('v' => json_encode($pm), 'r' => $rev('messages')))));
$x = $get('messages'); $ids = array_map(function ($m) { return $m['id']; }, $x);
ok('messages: own new + read, others kept, fake blocked', count($x) == 3 && in_array(1, $ids) && in_array(3, $ids) && !in_array(4, $ids) && $x[1]['read'] === true);
list(, $p) = call(array('action' => 'push', 'token' => $rt, 'changes' => array('messages' => array('v' => json_encode(array(array('id' => 9, 'unitId' => 1, 'direction' => 'received', 'body' => 'g'))), 'r' => $rev('messages')))));
ok('guest cannot send messages', count($get('messages')) == 3);
// رأی: فقط یک‌بار و فقط با شماره خودش
$vt = array(array('id' => 1, 'title' => 'v', 'candidates' => array(array('id' => 1, 'votes' => 0), array('id' => 2, 'votes' => 0)), 'votes' => array()));
call(array('action' => 'push', 'token' => $mt, 'changes' => array('votings' => array('v' => json_encode($vt), 'r' => 0))));
$vt[0]['votes'][] = array('voterPhone' => '09350001111', 'candidateId' => 1); $vt[0]['candidates'][0]['votes'] = 50; $vt[0]['votes'][] = array('voterPhone' => '09111111111', 'candidateId' => 2);
call(array('action' => 'push', 'token' => $rid, 'changes' => array('votings' => array('v' => json_encode($vt), 'r' => $rev('votings')))));
$x = $get('votings'); ok('vote counted once', count($x[0]['votes']) == 1 && $x[0]['candidates'][0]['votes'] == 1 && $x[0]['candidates'][1]['votes'] == 0);
call(array('action' => 'push', 'token' => $rid, 'changes' => array('votings' => array('v' => json_encode($vt), 'r' => $rev('votings')))));
$x = $get('votings'); ok('no double vote', count($x[0]['votes']) == 1);
// شارژ واحد دیگر را نمی‌تواند «اعلام پرداخت» کند
$c = $get('charges'); $c[1]['paid'] = false; call(array('action' => 'push', 'token' => $mt, 'changes' => array('charges' => array('v' => json_encode($c), 'r' => $rev('charges')))));
$c = $get('charges'); $c[1]['pendingApproval'] = true;
call(array('action' => 'push', 'token' => $rid, 'changes' => array('charges' => array('v' => json_encode($c), 'r' => $rev('charges')))));
$x = $get('charges'); ok('cannot declare payment for other unit', empty($x[1]['pendingApproval']));
// مهمان با ثبت‌نام تازه: فقط همان واحد (و فقط جای خالی/تأییدنشده)
$regs = $get('registered_residents'); foreach ($regs as &$r_) unset($r_['passwordHash']); unset($r_);
$regs[] = array('id' => 20, 'buildingCode' => 'S-482193', 'block' => '—', 'unitNumber' => 2, 'phone' => '09359999999', 'role' => 'owner', 'passwordHash' => 'P2', 'status' => 'approved');
$u = $get('units'); $u[1]['owner'] = array('name' => 'Intruder', 'phone' => '09359999999');
$n = array(array('id' => 77, 'title' => 'ثبت‌نام', 'message' => 'x'));
call(array('action' => 'push', 'token' => $rt, 'changes' => array('registered_residents' => array('v' => json_encode($regs), 'r' => $rev('registered_residents')), 'units' => array('v' => json_encode($u), 'r' => $rev('units')), 'notifications' => array('v' => json_encode($n), 'r' => 0))));
$x = $get('registered_residents'); $last = end($x);
$xu = $get('units'); $xn = $get('notifications');
ok('guest registration pending + approved owner slot protected', $last['id'] == 20 && $last['status'] === 'pending' && $xu[1]['owner']['name'] === 'B' && count($xn) == 1 && $xn[0]['_by'] === 'reg:20');
// ساکن ردشده: توکنش دیگر دسترسی ندارد
$x = $get('registered_residents'); $x[0]['status'] = 'rejected';
call(array('action' => 'push', 'token' => $mt, 'changes' => array('registered_residents' => array('v' => json_encode($x), 'r' => $rev('registered_residents')))));
$u = $get('units'); $u[0]['area'] = 10;
call(array('action' => 'push', 'token' => $rid, 'changes' => array('units' => array('v' => json_encode($u), 'r' => $rev('units')))));
ok('rejected resident loses write access', $get('units')[0]['area'] == 90);
$x = $get('registered_residents'); $x[0]['status'] = 'approved';
call(array('action' => 'push', 'token' => $mt, 'changes' => array('registered_residents' => array('v' => json_encode($x), 'r' => $rev('registered_residents')))));
// رمز متنی قدیمی → bcrypt با همان هش کلاینت
ok('legacy hash matches client', Apt_Sync_Core::legacyHash('Res12345') === 'rh_oozind');

// تعارض
list($s, $p) = call(array('action' => 'push', 'token' => $mt, 'changes' => array('charges' => array('v' => '[]', 'r' => 1))));
ok('conflict returned', $s == 200 && isset($p['conflicts']['charges']) && $p['conflicts']['charges']['r'] == $rev('charges'));

// تغییر رمز
list($s,) = call(array('action' => 'change_password', 'token' => $mt, 'oldHash' => 'H1', 'newHash' => 'H2'));
list($s2,) = call(array('action' => 'login', 'phone' => '09121112233', 'passHash' => 'H2'));
ok('change password', $s == 200 && $s2 == 200);
list($s,) = call(array('action' => 'change_password', 'token' => $rt, 'oldHash' => 'H2', 'newHash' => 'x'));
ok('resident cannot change manager pass', $s == 403);

// کد ساختمان عوض شود
list($s, $pl) = call(array('action' => 'pull', 'token' => $mt, 'since' => 0));
list($s, $p) = call(array('action' => 'push', 'token' => $mt, 'changes' => array('v3' => array('v' => json_encode(array('building' => array('code' => 'S-111111'))), 'r' => 3))));
list($s1,) = call(array('action' => 'open', 'code' => 'S-111111'));
list($s2,) = call(array('action' => 'pull', 'token' => $rt));
ok('code change re-indexes + old resident token invalid', $s1 == 200 && $s2 == 401 && !isset($S->c['S-482193']));

list($s,) = call(array('action' => 'pull', 'token' => 'abc.def'));
ok('forged token', $s == 401);
for ($i = 0; $i < 35; $i++) list($s,) = call(array('action' => 'login', 'phone' => '09121112233', 'passHash' => 'zz'));
ok('rate limit', $s == 429);
list($s, $pl) = call(array('action' => 'pull', 'token' => $mt, 'since' => 999));
ok('empty keys is object', json_encode($core->handle(array('action' => 'pull', 'token' => $mt, 'since' => 999))[1]) === '{"keys":{},"rev":' . max(array_map(function ($x) { return $x['r']; }, $S->k['09121112233'])) . '}');
echo "\n$pass passed, $failN failed\n";
