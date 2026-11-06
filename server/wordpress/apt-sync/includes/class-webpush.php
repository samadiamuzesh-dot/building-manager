<?php
/**
 * آپارتمان پلاس — Web Push استاندارد (VAPID / RFC 8292 + رمزنگاری aes128gcm / RFC 8291 و RFC 8188)
 * فقط با openssl خود PHP، بدون composer. مستقل از وردپرس تا بشود جدا تست کرد.
 * نیاز: PHP ≥ 7.3 (openssl_pkey_derive) و OpenSSL با منحنی prime256v1 و aes-128-gcm.
 */
if (!class_exists('Apt_Sync_WebPush')) {
class Apt_Sync_WebPush {
	const SPKI_PREFIX = '3059301306072a8648ce3d020106082a8648ce3d030107034200';

	/** آیا این سرور می‌تواند Web Push بفرستد؟ */
	public static function available() {
		return function_exists('openssl_pkey_derive') && function_exists('openssl_pkey_new') && defined('OPENSSL_KEYTYPE_EC')
			&& in_array('aes-128-gcm', array_map('strtolower', openssl_get_cipher_methods()), true);
	}
	/** دلیل غیرفعال بودن (برای صفحه عیب‌یابی) */
	public static function why() {
		if (!function_exists('openssl_pkey_new')) return 'افزونه openssl در PHP فعال نیست';
		if (!function_exists('openssl_pkey_derive')) return 'نسخه PHP ' . PHP_VERSION . ' است؛ اعلان فوری به PHP 7.3 یا بالاتر نیاز دارد';
		if (!in_array('aes-128-gcm', array_map('strtolower', openssl_get_cipher_methods()), true)) return 'OpenSSL این سرور aes-128-gcm ندارد';
		return '';
	}

	public static function b64u($s) { return rtrim(strtr(base64_encode($s), '+/', '-_'), '='); }
	public static function b64ud($s) {
		$s = strtr((string) $s, '-_', '+/');
		$pad = strlen($s) % 4; if ($pad) $s .= str_repeat('=', 4 - $pad);
		return base64_decode($s, true);
	}

	public static function newEcKey() {
		$o = array('curve_name' => 'prime256v1', 'private_key_type' => OPENSSL_KEYTYPE_EC);
		$k = @openssl_pkey_new($o);
		// بعضی هاست‌ها فایل openssl.cnf ندارند: با پیکربندی حداقلی همراه افزونه دوباره امتحان کن
		if (!$k) { while (openssl_error_string()) {} $o['config'] = __DIR__ . '/openssl.cnf'; $k = @openssl_pkey_new($o); }
		if (!$k) throw new Exception('ec_keygen_failed');
		return $k;
	}
	/** کلید عمومی خام ۶۵ بایتی (0x04 || X || Y) */
	public static function rawPublic($key) {
		$d = openssl_pkey_get_details($key);
		if (!$d || empty($d['ec']['x'])) throw new Exception('not_ec_key');
		return "\x04" . str_pad($d['ec']['x'], 32, "\0", STR_PAD_LEFT) . str_pad($d['ec']['y'], 32, "\0", STR_PAD_LEFT);
	}
	public static function publicPem($raw65) {
		$der = hex2bin(self::SPKI_PREFIX) . $raw65;
		return "-----BEGIN PUBLIC KEY-----\n" . chunk_split(base64_encode($der), 64, "\n") . "-----END PUBLIC KEY-----\n";
	}

	/** ساخت جفت‌کلید VAPID: pub (base64url خام) + pem (کلید خصوصی) */
	public static function createVapid() {
		$k = self::newEcKey();
		$pem = '';
		if (!@openssl_pkey_export($k, $pem) && !@openssl_pkey_export($k, $pem, null, array('config' => __DIR__ . '/openssl.cnf'))) throw new Exception('ec_export_failed');
		return array('pub' => self::b64u(self::rawPublic($k)), 'pem' => $pem, 'created' => time());
	}

	/** امضای DER ECDSA → r||s خام ۶۴ بایتی (برای JWT ES256) */
	public static function derToRaw($der) {
		$o = 0;
		if (ord($der[$o++]) !== 0x30) return false;
		$len = ord($der[$o++]); if ($len & 0x80) $o += $len & 0x7f;
		$out = '';
		for ($i = 0; $i < 2; $i++) {
			if (ord($der[$o++]) !== 0x02) return false;
			$l = ord($der[$o++]);
			$v = ltrim(substr($der, $o, $l), "\0"); $o += $l;
			if (strlen($v) > 32) return false;
			$out .= str_pad($v, 32, "\0", STR_PAD_LEFT);
		}
		return $out;
	}
	/** r||s خام → DER (برای تست/بررسی امضا) */
	public static function rawToDer($raw) {
		$enc = function ($v) { $v = ltrim($v, "\0"); if ($v === '' || (ord($v[0]) & 0x80)) $v = "\0" . $v; return "\x02" . chr(strlen($v)) . $v; };
		$b = $enc(substr($raw, 0, 32)) . $enc(substr($raw, 32, 32));
		return "\x30" . chr(strlen($b)) . $b;
	}

	/** JWT ES256 برای سرویس push (aud = مبدأ endpoint) */
	public static function vapidJwt($aud, $sub, $pem, $exp = 0) {
		$h = self::b64u(json_encode(array('typ' => 'JWT', 'alg' => 'ES256')));
		$c = self::b64u(json_encode(array('aud' => $aud, 'exp' => $exp ? $exp : time() + 12 * 3600, 'sub' => $sub), JSON_UNESCAPED_SLASHES));
		$sig = '';
		$key = openssl_pkey_get_private($pem);
		if (!$key || !openssl_sign($h . '.' . $c, $sig, $key, OPENSSL_ALGO_SHA256)) throw new Exception('vapid_sign_failed');
		$raw = self::derToRaw($sig);
		if ($raw === false) throw new Exception('vapid_sig_parse');
		return $h . '.' . $c . '.' . self::b64u($raw);
	}
	public static function audience($endpoint) {
		$u = parse_url($endpoint);
		return $u['scheme'] . '://' . $u['host'] . (isset($u['port']) ? ':' . $u['port'] : '');
	}

	private static function hkdf($salt, $ikm, $info, $len) {
		$prk = hash_hmac('sha256', $ikm, $salt, true);
		return substr(hash_hmac('sha256', $info . "\x01", $prk, true), 0, $len);
	}

	/**
	 * رمزنگاری payload برای یک اشتراک (RFC 8291، یک رکورد aes128gcm)
	 * $asKey و $salt فقط برای تست قابل تعیین‌اند.
	 */
	public static function encrypt($payload, $p256dh, $auth, $asKey = null, $salt = null) {
		$ua = self::b64ud($p256dh); $authSecret = self::b64ud($auth);
		if (strlen($ua) !== 65 || $ua[0] !== "\x04" || strlen($authSecret) < 16) throw new Exception('bad_subscription_keys');
		if (strlen($payload) > 3000) throw new Exception('payload_too_large');
		$as = $asKey ? $asKey : self::newEcKey();
		$asPub = self::rawPublic($as);
		$ecdh = openssl_pkey_derive(self::publicPem($ua), $as, 32);
		if ($ecdh === false || strlen($ecdh) !== 32) throw new Exception('ecdh_failed');
		$ikm = self::hkdf($authSecret, $ecdh, "WebPush: info\x00" . $ua . $asPub, 32);
		$salt = $salt !== null ? $salt : random_bytes(16);
		$cek = self::hkdf($salt, $ikm, "Content-Encoding: aes128gcm\x00", 16);
		$nonce = self::hkdf($salt, $ikm, "Content-Encoding: nonce\x00", 12);
		$tag = '';
		$ct = openssl_encrypt($payload . "\x02", 'aes-128-gcm', $cek, OPENSSL_RAW_DATA, $nonce, $tag, '', 16);
		if ($ct === false) throw new Exception('aes_failed');
		return $salt . pack('N', 4096) . chr(65) . $asPub . $ct . $tag;
	}

	/** رمزگشایی (فقط برای تست؛ همان کاری که مرورگر انجام می‌دهد) */
	public static function decrypt($body, $uaKey, $auth) {
		$salt = substr($body, 0, 16); $idlen = ord($body[20]); $asPub = substr($body, 21, $idlen);
		$rest = substr($body, 21 + $idlen);
		$ua = self::rawPublic($uaKey);
		$ecdh = openssl_pkey_derive(self::publicPem($asPub), $uaKey, 32);
		$ikm = self::hkdf(self::b64ud($auth), $ecdh, "WebPush: info\x00" . $ua . $asPub, 32);
		$cek = self::hkdf($salt, $ikm, "Content-Encoding: aes128gcm\x00", 16);
		$nonce = self::hkdf($salt, $ikm, "Content-Encoding: nonce\x00", 12);
		$pt = openssl_decrypt(substr($rest, 0, -16), 'aes-128-gcm', $cek, OPENSSL_RAW_DATA, $nonce, substr($rest, -16));
		if ($pt === false) return false;
		$pt = rtrim($pt, "\0");
		return substr($pt, -1) === "\x02" ? substr($pt, 0, -1) : false;
	}

	/** درخواست HTTP کامل برای یک اشتراک */
	public static function buildRequest($sub, $payload, $vapid, $subject, $ttl = 86400) {
		$jwt = self::vapidJwt(self::audience($sub['e']), $subject, $vapid['pem']);
		$body = self::encrypt($payload, $sub['k'], $sub['a']);
		return array('url' => $sub['e'], 'body' => $body, 'headers' => array(
			'Content-Type: application/octet-stream',
			'Content-Encoding: aes128gcm',
			'TTL: ' . (int) $ttl,
			'Urgency: high',
			'Authorization: vapid t=' . $jwt . ', k=' . $vapid['pub'],
			'Content-Length: ' . strlen($body),
		));
	}

	/**
	 * ارسال موازی با مهلت کوتاه. $items: [['sub'=>row,'payload'=>json], …]
	 * خروجی: وضعیت HTTP هر مورد (0 = خطای شبکه/مهلت)
	 */
	public static function sendMany($items, $vapid, $subject, $timeout = 6) {
		$out = array(); $reqs = array();
		foreach ($items as $i => $it) {
			try { $reqs[$i] = self::buildRequest($it['sub'], $it['payload'], $vapid, $subject); }
			catch (Exception $e) { $out[$i] = -1; }
		}
		if (!$reqs) return $out;
		if (function_exists('curl_multi_init')) {
			$mh = curl_multi_init(); $hs = array();
			foreach ($reqs as $i => $r) {
				$ch = curl_init($r['url']);
				curl_setopt_array($ch, array(CURLOPT_POST => true, CURLOPT_POSTFIELDS => $r['body'], CURLOPT_HTTPHEADER => $r['headers'],
					CURLOPT_RETURNTRANSFER => true, CURLOPT_CONNECTTIMEOUT => 4, CURLOPT_TIMEOUT => $timeout, CURLOPT_NOSIGNAL => 1));
				curl_multi_add_handle($mh, $ch); $hs[$i] = $ch;
			}
			$running = 0; $t0 = microtime(true);
			do {
				$st = curl_multi_exec($mh, $running);
				if ($running) curl_multi_select($mh, 0.5);
			} while ($running && $st === CURLM_OK && microtime(true) - $t0 < $timeout + 2);
			foreach ($hs as $i => $ch) { $out[$i] = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_multi_remove_handle($mh, $ch); curl_close($ch); }
			curl_multi_close($mh);
		} else {
			foreach ($reqs as $i => $r) {
				$ctx = stream_context_create(array('http' => array('method' => 'POST', 'header' => implode("\r\n", $r['headers']), 'content' => $r['body'], 'timeout' => $timeout, 'ignore_errors' => true)));
				$res = @file_get_contents($r['url'], false, $ctx);
				$code = 0;
				if (isset($http_response_header[0]) && preg_match('#\s(\d{3})\s#', $http_response_header[0] . ' ', $m)) $code = (int) $m[1];
				$out[$i] = $code;
			}
		}
		ksort($out);
		return $out;
	}

	/** فقط سرویس‌های push شناخته‌شده (جلوگیری از سوءاستفاده سرور برای درخواست به آدرس دلخواه) */
	public static function endpointAllowed($url) {
		$u = parse_url((string) $url);
		if (!$u || ($u['scheme'] ?? '') !== 'https' || empty($u['host']) || strlen($url) > 1024) return false;
		return (bool) preg_match('/(^|\.)(fcm\.googleapis\.com|android\.googleapis\.com|push\.services\.mozilla\.com|push\.apple\.com|notify\.windows\.com|push\.api\.chromium\.org|wns2-[a-z0-9-]+\.notify\.windows\.com)$/i', $u['host']);
	}
}
}
