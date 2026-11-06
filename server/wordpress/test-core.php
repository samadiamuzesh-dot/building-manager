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

// ===== مدیر بلوک (۱.۲) =====
$BP = '09127778899';
list($s, $bm0) = call(array('action' => 'register', 'phone' => $BP, 'passHash' => 'MP', 'code' => 'C-700700'));
$bmt = $bm0['token'];
$bget = function ($b) use (&$S, $BP) { return json_decode($S->k[$BP][$b]['v'], true); };
$brev = function ($b) use (&$S, $BP) { return isset($S->k[$BP][$b]) ? $S->k[$BP][$b]['r'] : 0; };
$bpush = function ($tok, $base, $val) use ($brev) { return call(array('action' => 'push', 'token' => $tok, 'changes' => array($base => array('v' => json_encode($val), 'r' => $brev($base))))); };
$bu = array(
	array('id' => 1, 'block' => 'A', 'number' => 1, 'chargeAmount' => 100, 'owner' => array('name' => 'A1', 'phone' => '09351000001', 'approved' => true)),
	array('id' => 2, 'block' => 'A', 'number' => 2, 'chargeAmount' => 100, 'owner' => array('name' => 'A2', 'phone' => '09351000002', 'approved' => false, 'registered' => true)),
	array('id' => 3, 'block' => 'B', 'number' => 1, 'chargeAmount' => 200, 'owner' => array('name' => 'B1', 'phone' => '09352000001', 'nationalId' => '999', 'approved' => true)));
$bc = array(
	array('id' => 11, 'unitId' => 1, 'amount' => 100, 'total' => 100, 'paid' => false, 'pendingApproval' => true, 'trackingCode' => 'TA', 'receipt' => array('date' => '۱۴۰۵/۰۸/۱۰')),
	array('id' => 12, 'unitId' => 2, 'amount' => 100, 'total' => 100, 'paid' => false),
	array('id' => 13, 'unitId' => 3, 'amount' => 200, 'total' => 200, 'paid' => false, 'pendingApproval' => true, 'trackingCode' => 'TB'));
$bregs = array(
	array('id' => 51, 'buildingCode' => 'C-700700', 'block' => 'A', 'unitNumber' => 2, 'phone' => '09351000002', 'name' => 'A2', 'role' => 'owner', 'passwordHash' => 'RA2', 'status' => 'pending'),
	array('id' => 52, 'buildingCode' => 'C-700700', 'block' => 'B', 'unitNumber' => 1, 'phone' => '09352000001', 'name' => 'B1', 'role' => 'owner', 'passwordHash' => 'RB1', 'status' => 'pending'));
$bms = array(
	array('id' => 901, 'name' => 'Ali', 'phone' => '09120000901', 'block' => 'A', 'passwordHash' => 'bh_A', 'active' => true),
	array('id' => 902, 'name' => 'Bob', 'phone' => '09120000902', 'block' => 'B', 'passwordHash' => 'bh_B', 'active' => true));
call(array('action' => 'push', 'token' => $bmt, 'changes' => array(
	'v3' => array('v' => json_encode(array('building' => array('code' => 'C-700700', 'type' => 'complex', 'blocks' => array(array('name' => 'A'), array('name' => 'B'))))), 'r' => 0),
	'units' => array('v' => json_encode($bu), 'r' => 0), 'charges' => array('v' => json_encode($bc), 'r' => 0),
	'registered_residents' => array('v' => json_encode($bregs), 'r' => 0), 'block_managers' => array('v' => json_encode($bms), 'r' => 0),
	'settings' => array('v' => json_encode(array('managerCard' => '6037991122334455', 'managerSheba' => 'IR12', 'monthlyCharge' => 100)), 'r' => 0),
	'expenses' => array('v' => json_encode(array(array('id' => 1, 'amount' => 5))), 'r' => 0),
	'notices' => array('v' => json_encode(array(array('id' => 71, 'title' => 'all', 'targetType' => 'all'), array('id' => 72, 'title' => 'forB', 'targetType' => 'block', 'targetBlock' => 'B'))), 'r' => 0))));
$x = $bget('block_managers');
ok('block manager password bcrypted on server', password_verify('bh_A', $x[0]['passwordHash']));
list(, $pl) = call(array('action' => 'pull', 'token' => $bmt, 'since' => 0));
ok('manager pull hides block manager hash', strpos($pl['keys']['block_managers']['v'], 'passwordHash') === false && strpos($pl['keys']['block_managers']['v'], 'Ali') !== false);
// مدیر کل بدون رمز می‌فرستد → رمز می‌ماند
$x = json_decode($pl['keys']['block_managers']['v'], true); $x[0]['name'] = 'Ali R';
$bpush($bmt, 'block_managers', $x);
$x = $bget('block_managers');
ok('manager edit keeps block manager hash', $x[0]['name'] === 'Ali R' && password_verify('bh_A', $x[0]['passwordHash']));
list($s,) = call(array('action' => 'block_login', 'code' => 'c-700700', 'blockPhone' => '09120000901', 'passHash' => 'nope'));
ok('block login wrong password 401', $s == 401);
list($s,) = call(array('action' => 'block_login', 'code' => 'C-700700', 'blockPhone' => '09120000999', 'passHash' => 'bh_A'));
ok('block login unknown phone 404', $s == 404);
list($s, $bl) = call(array('action' => 'block_login', 'code' => 'c-700700', 'blockPhone' => '۰۹۱۲۰۰۰۰۹۰۱', 'passHash' => 'bh_A'));
ok('block login ok', $s == 200 && !empty($bl['token']) && $bl['phone'] === $BP && $bl['manager']['block'] === 'A' && !isset($bl['manager']['passwordHash']));
$bt = $bl['token'];
// نمای مدیر بلوک
list($s, $pl) = call(array('action' => 'pull', 'token' => $bt, 'since' => 0));
$pu = json_decode($pl['keys']['units']['v'], true); $pc = json_decode($pl['keys']['charges']['v'], true);
$pr = json_decode($pl['keys']['registered_residents']['v'], true); $pst = json_decode($pl['keys']['settings']['v'], true);
$pn = json_decode($pl['keys']['notices']['v'], true); $pbm = json_decode($pl['keys']['block_managers']['v'], true);
ok('block pull: own block units/charges only', $s == 200 && count($pu) == 2 && $pu[0]['owner']['phone'] === '09351000001' && count($pc) == 2 && strpos($pl['keys']['units']['v'], '09352000001') === false);
ok('block pull: own regs, no hashes, no card, no expenses', count($pr) == 1 && $pr[0]['id'] == 51 && !isset($pr[0]['passwordHash']) && !isset($pst['managerCard']) && !isset($pst['managerSheba']) && $pst['monthlyCharge'] == 100 && json_decode($pl['keys']['expenses']['v'], true) === array());
ok('block pull: notices of own block/all, only own manager row', count($pn) == 1 && $pn[0]['id'] == 71 && count($pbm) == 1 && $pbm[0]['id'] == 901 && !isset($pbm[0]['passwordHash']));
// تأیید پرداخت بلوک خودش (+ تلاش برای تغییر مبلغ)
$pc[0]['paid'] = true; $pc[0]['pendingApproval'] = false; $pc[0]['paidDate'] = '۱۴۰۵/۰۸/۱۰'; $pc[0]['amount'] = 1; $pc[0]['total'] = 1; $pc[0]['approvedBy'] = 'main';
$bpush($bt, 'charges', $pc);
$x = $bget('charges');
ok('block approves own-block payment (amount untouched, approvedBy recorded)', $x[0]['paid'] === true && $x[0]['pendingApproval'] === false && $x[0]['paidDate'] === '۱۴۰۵/۰۸/۱۰' && $x[0]['amount'] == 100 && $x[0]['total'] == 100 && $x[0]['approvedBy'] === 'block:Ali R' && count($x) == 3);
// شارژ بلوک دیگر و شارژ بدون اعلام پرداخت و صدور شارژ جدید → رد
$fake = $bget('charges'); $fake[2]['paid'] = true; $fake[2]['pendingApproval'] = false; $fake[1]['paid'] = true; $fake[] = array('id' => 99, 'unitId' => 1, 'amount' => 5, 'paid' => false);
$bpush($bt, 'charges', $fake);
$x = $bget('charges');
ok('block cannot touch other block / undeclared / new charges', $x[2]['paid'] === false && $x[2]['pendingApproval'] === true && $x[1]['paid'] === false && count($x) == 3);
// مبلغ شارژ واحد و واحد بلوک دیگر
$u = $bget('units'); $u[0]['chargeAmount'] = 1; $u[0]['debt'] = 0; $u[2]['chargeAmount'] = 1; $u[2]['owner']['name'] = 'X'; $u[] = array('id' => 9, 'block' => 'A', 'number' => 9);
$bpush($bt, 'units', $u);
$x = $bget('units');
ok('block cannot change chargeAmount / other block / add units', $x[0]['chargeAmount'] == 100 && !isset($x[0]['debt']) && $x[2]['chargeAmount'] == 200 && $x[2]['owner']['name'] === 'B1' && count($x) == 3);
// تأیید ثبت‌نام بلوک خودش، نه بلوک دیگر
$r = $bregs; foreach ($r as &$rr_) { unset($rr_['passwordHash']); $rr_['status'] = 'approved'; } unset($rr_);
$bpush($bt, 'registered_residents', $r);
$u = $bget('units'); $u[1]['owner']['approved'] = true;
$bpush($bt, 'units', $u);
$x = $bget('registered_residents'); $xu = $bget('units');
ok('block approves own-block registration only', $x[0]['status'] === 'approved' && $x[0]['reviewedBy'] === 'block:Ali R' && password_verify('RA2', $x[0]['passwordHash']) && $x[1]['status'] === 'pending' && $xu[1]['owner']['approved'] === true);
// اطلاعیه: فقط بلوک خودش
$n = $bget('notices');
$n[] = array('id' => 81, 'title' => 'okA', 'targetType' => 'block', 'targetBlock' => 'A');
$n[] = array('id' => 82, 'title' => 'toAll', 'targetType' => 'all');
$n[] = array('id' => 83, 'title' => 'toB', 'targetType' => 'block', 'targetBlock' => 'B');
$n[] = array('id' => 84, 'title' => 'unitsMixed', 'targetType' => 'units', 'targetUnits' => array(1, 3));
$n[0]['title'] = 'HACK';
$bpush($bt, 'notices', $n);
$x = $bget('notices'); $ids = array_map(function ($q) { return $q['id']; }, $x);
ok('block notices: own block only, others untouched', $ids == array(71, 72, 81) && $x[0]['title'] === 'all' && $x[2]['createdBy'] === 'block:Ali R');
// حذف اطلاعیه: فقط مال خودش
$bpush($bt, 'notices', array());
$x = $bget('notices'); $ids = array_map(function ($q) { return $q['id']; }, $x);
ok('block deletes only own notices', $ids == array(71, 72));
// پیام: فقط واحدهای بلوک خودش
$m = array(array('id' => 61, 'unitId' => 1, 'direction' => 'sent', 'body' => 'hi A1'), array('id' => 62, 'unitId' => 3, 'direction' => 'sent', 'body' => 'hi B1'), array('id' => 63, 'unitId' => 1, 'direction' => 'received', 'body' => 'fake'));
call(array('action' => 'push', 'token' => $bt, 'changes' => array('messages' => array('v' => json_encode($m), 'r' => 0))));
$x = $bget('messages');
ok('block messages own units only (sent)', count($x) == 1 && $x[0]['id'] == 61 && $x[0]['sentBy'] === 'block:Ali R');
// کلیدهای ممنوع
call(array('action' => 'push', 'token' => $bt, 'changes' => array('settings' => array('v' => '{"managerCard":"1"}', 'r' => $brev('settings')), 'expenses' => array('v' => '[]', 'r' => $brev('expenses')), 'block_managers' => array('v' => '[]', 'r' => $brev('block_managers')))));
ok('block cannot write settings/expenses/block_managers', $bget('settings')['managerCard'] === '6037991122334455' && count($bget('expenses')) == 1 && count($bget('block_managers')) == 2);
list($s,) = call(array('action' => 'change_password', 'token' => $bt, 'oldHash' => 'MP', 'newHash' => 'x'));
ok('block cannot change manager password', $s == 403);
// ساکن مدیران بلوک را نمی‌بیند
list(, $o) = call(array('action' => 'open', 'code' => 'C-700700'));
list(, $pl) = call(array('action' => 'pull', 'token' => $o['token'], 'since' => 0));
ok('resident sees no block managers', $pl['keys']['block_managers']['v'] === '[]');
// تعویض رمز توسط مدیر کل → توکن قبلی باطل
$x = $bget('block_managers'); foreach ($x as &$q) unset($q['passwordHash']); unset($q);
$x[0]['passwordHash'] = 'bh_A2'; $x[0]['passSetAt'] = 2;
$bpush($bmt, 'block_managers', $x);
list($s,) = call(array('action' => 'pull', 'token' => $bt, 'since' => 0));
list($s2, $bl2) = call(array('action' => 'block_login', 'code' => 'C-700700', 'blockPhone' => '09120000901', 'passHash' => 'bh_A2'));
ok('password reset invalidates old block token', $s == 401 && $s2 == 200);
// غیرفعال‌سازی
$x = $bget('block_managers'); foreach ($x as &$q) unset($q['passwordHash']); unset($q); $x[0]['active'] = false;
$bpush($bmt, 'block_managers', $x);
list($s,) = call(array('action' => 'pull', 'token' => $bl2['token'], 'since' => 0));
list($s2,) = call(array('action' => 'block_login', 'code' => 'C-700700', 'blockPhone' => '09120000901', 'passHash' => 'bh_A2'));
ok('disabled block manager locked out', $s == 401 && $s2 == 403);

// ---------- ثبت‌نام مدیر بلوک (نسخه ۱.۳) ----------
list($s, $bi) = call(array('action' => 'block_info', 'code' => 'c-700700'));
ok('block_info lists building blocks', $s == 200 && $bi['complex'] === true && $bi['blocks'] === array('A', 'B'));
list($s, $bi2) = call(array('action' => 'block_info', 'code' => 'S-111111'));
ok('block_info single building: not complex', $s == 200 && $bi2['complex'] === false && $bi2['blocks'] === array());
list($s,) = call(array('action' => 'block_info', 'code' => 'X-000000'));
ok('block_info wrong code 404', $s == 404);
$breg = function ($o) { return call(array_merge(array('action' => 'block_register', 'code' => 'C-700700', 'block' => 'B', 'name' => 'Sara', 'blockPhone' => '09120000777', 'passHash' => 'bh_S'), $o)); };
list($s, $e) = $breg(array('code' => 'X-000000'));
ok('block register wrong code 404', $s == 404 && $e['error'] === 'not_found');
list($s, $e) = $breg(array('code' => 'S-111111'));
ok('block register single building rejected', $s == 409 && $e['error'] === 'not_complex');
list($s, $e) = $breg(array('block' => 'Z'));
ok('block register unknown block rejected (server-side)', $s == 400 && $e['error'] === 'bad_block' && $e['blocks'] === array('A', 'B'));
list($s, $e) = $breg(array('blockPhone' => '0912'));
ok('block register bad phone 400', $s == 400);
list($s, $e) = $breg(array('blockPhone' => '09120000902'));
ok('block register: phone already a block manager', $s == 409 && $e['error'] === 'phone_exists' && $e['status'] === 'approved');
$rev0 = $brev('block_managers');
list($s, $rg) = $breg(array('blockPhone' => '۰۹۱۲۰۰۰۰۷۷۷'));
$x = $bget('block_managers'); $row = end($x);
ok('block register stores pending row (bcrypt, rev bumped)', $s == 200 && $rg['status'] === 'pending' && $row['status'] === 'pending' && $row['phone'] === '09120000777' && $row['block'] === 'B' && password_verify('bh_S', $row['passwordHash']) && $brev('block_managers') > $rev0 && count($x) == 3);
list($s, $e) = $breg(array());
ok('block register duplicate pending 409', $s == 409 && $e['error'] === 'phone_exists' && $e['status'] === 'pending');
list($s, $e) = call(array('action' => 'block_login', 'code' => 'C-700700', 'blockPhone' => '09120000777', 'passHash' => 'bh_S'));
ok('block login while pending: 403 pending', $s == 403 && $e['error'] === 'pending');
list($s,) = call(array('action' => 'block_login', 'code' => 'C-700700', 'blockPhone' => '09120000777', 'passHash' => 'wrong'));
ok('block login pending + wrong password: 401', $s == 401);
list(, $pl) = call(array('action' => 'pull', 'token' => $bmt, 'since' => $rev0));
$mx = json_decode($pl['keys']['block_managers']['v'], true); $mrow = end($mx);
ok('main manager pull gets pending request without hash', $mrow['status'] === 'pending' && $mrow['name'] === 'Sara' && !isset($mrow['passwordHash']));
// تأیید مدیر کل (بدون هش در داده)
foreach ($mx as &$q) if ($q['phone'] === '09120000777') { $q['status'] = 'approved'; $q['reviewedAt'] = 'now'; } unset($q);
$bpush($bmt, 'block_managers', $mx);
list($s, $bl3) = call(array('action' => 'block_login', 'code' => 'C-700700', 'blockPhone' => '09120000777', 'passHash' => 'bh_S'));
ok('approved self-registered block manager logs in', $s == 200 && $bl3['manager']['block'] === 'B' && !empty($bl3['token']));
list($s, $pl) = call(array('action' => 'pull', 'token' => $bl3['token'], 'since' => 0));
$pu = json_decode($pl['keys']['units']['v'], true);
ok('self-registered block manager sees only own block', $s == 200 && count($pu) == 1 && $pu[0]['block'] === 'B');
// مدیر کل همان را رد می‌کند → توکن باطل و ورود: rejected
$x = $bget('block_managers'); foreach ($x as &$q) { unset($q['passwordHash']); if ($q['phone'] === '09120000777') $q['status'] = 'rejected'; } unset($q);
$bpush($bmt, 'block_managers', $x);
list($s,) = call(array('action' => 'pull', 'token' => $bl3['token'], 'since' => 0));
list($s2, $e) = call(array('action' => 'block_login', 'code' => 'C-700700', 'blockPhone' => '09120000777', 'passHash' => 'bh_S'));
ok('rejected request: token revoked, login 403 rejected', $s == 401 && $s2 == 403 && $e['error'] === 'rejected');
// ثبت‌نام دوباره پس از رد → ردیف ردشده جایگزین می‌شود
list($s, $rg2) = $breg(array('block' => 'A', 'passHash' => 'bh_S2'));
$x = $bget('block_managers'); $mine = array_values(array_filter($x, function ($q) { return $q['phone'] === '09120000777'; }));
ok('re-register after reject replaces old row', $s == 200 && count($mine) == 1 && $mine[0]['status'] === 'pending' && $mine[0]['block'] === 'A');
// ردیف‌های قدیمی (بدون status) همچنان کار می‌کنند
list($s,) = call(array('action' => 'block_login', 'code' => 'C-700700', 'blockPhone' => '09120000902', 'passHash' => 'bh_B'));
ok('legacy manager-created block manager still logs in', $s == 200);
// محدودیت تعداد
for ($i = 0; $i < 6; $i++) list($s,) = $breg(array('blockPhone' => '09120000888', 'name' => 'Rl'));
ok('block register rate-limited per phone', $s == 429);
echo "\n$pass passed, $failN failed\n";
