<?php
/**
 * Plugin Name: Apartment Plus Sync (آپارتمان پلاس — همگام‌سازی)
 * Description: سرور همگام‌سازی موقت پنل مدیر و پنل ساکن برنامه «آپارتمان پلاس». فقط یک مسیر REST دارد (/wp-json/apt-sync/v1/sync)، هیچ صفحه یا محتوای عمومی نمی‌سازد و روی سئوی سایت اثری ندارد.
 * Version: 1.1.0
 * Requires PHP: 7.2
 * Author: Hark
 */
if (!defined('ABSPATH')) exit;

define('APT_SYNC_VER', '1.1.0');
define('APT_SYNC_MAX_BODY', 4 * 1024 * 1024);
require_once __DIR__ . '/includes/class-core.php';
require_once __DIR__ . '/includes/class-store-wpdb.php';

register_activation_hook(__FILE__, array('Apt_Sync_Store_WPDB', 'install'));
add_action('plugins_loaded', function () { if (get_option('apt_sync_db') !== '1') Apt_Sync_Store_WPDB::install(); });

function apt_sync_secret() {
	$s = get_option('apt_sync_secret');
	if (!$s) { $s = wp_generate_password(48, false, false); update_option('apt_sync_secret', $s, false); }
	return $s;
}

function apt_sync_allowed_origin($origin) {
	if (!$origin) return '';
	$allowed = apply_filters('apt_sync_origins', array('https://samadiamuzesh-dot.github.io', 'https://elhamsamadi.ir', 'https://www.elhamsamadi.ir'));
	if (in_array($origin, $allowed, true)) return $origin;
	if (preg_match('#^https?://(localhost|127\.0\.0\.1)(:\d+)?$#', $origin)) return $origin;
	return '';
}

add_action('rest_api_init', function () {
	register_rest_route('apt-sync/v1', '/sync', array(
		array('methods' => 'GET', 'permission_callback' => '__return_true', 'callback' => function () {
			global $wpdb;
			$ok = (bool) $wpdb->get_var($wpdb->prepare('SHOW TABLES LIKE %s', $wpdb->prefix . 'apt_sync'));
			return new WP_REST_Response(array('ok' => true, 'service' => 'apartment-plus-sync', 'storage' => $ok, 'v' => APT_SYNC_VER), 200);
		}),
		array('methods' => 'POST', 'permission_callback' => '__return_true', 'callback' => function (WP_REST_Request $req) {
			$raw = $req->get_body();
			if (strlen($raw) > APT_SYNC_MAX_BODY) return new WP_REST_Response(array('error' => 'too_large'), 413);
			$body = json_decode($raw, true);
			$core = new Apt_Sync_Core(new Apt_Sync_Store_WPDB(), apt_sync_secret());
			list($status, $out) = $core->handle($body);
			apt_sync_log($body, $status, $out);
			return new WP_REST_Response($out, $status);
		}),
	));
});

// هدرهای CORS / کش / noindex فقط برای مسیر خودمان
add_filter('rest_pre_serve_request', function ($served, $result, $request) {
	if (strpos($request->get_route(), '/apt-sync/') !== 0) return $served;
	$origin = apt_sync_allowed_origin(get_http_origin());
	if ($origin) {
		header('Access-Control-Allow-Origin: ' . $origin);
		header('Vary: Origin', false);
	}
	header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
	header('Access-Control-Allow-Headers: Content-Type');
	header('Access-Control-Max-Age: 86400');
	header('Cache-Control: no-store, no-cache, must-revalidate');
	header('X-Robots-Tag: noindex, nofollow');
	if (!defined('DONOTCACHEPAGE')) define('DONOTCACHEPAGE', true);
	return $served;
}, 20, 3);

// پاسخ مستقیم به preflight (قبل از هر افزونه‌ای که REST را برای مهمان ببندد)
add_action('init', function () {
	$uri = isset($_SERVER['REQUEST_URI']) ? $_SERVER['REQUEST_URI'] : '';
	$isOurs = strpos($uri, '/wp-json/apt-sync/') !== false || strpos($uri, 'rest_route=/apt-sync/') !== false || strpos($uri, 'rest_route=%2Fapt-sync%2F') !== false;
	if ($isOurs && isset($_SERVER['REQUEST_METHOD']) && $_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
		$origin = apt_sync_allowed_origin(isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '');
		if ($origin) { header('Access-Control-Allow-Origin: ' . $origin); header('Vary: Origin'); }
		header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
		header('Access-Control-Allow-Headers: Content-Type');
		header('Access-Control-Max-Age: 86400');
		header('X-Robots-Tag: noindex, nofollow');
		status_header(204);
		exit;
	}
}, 0);

// اگر افزونه‌ای REST را برای کاربران مهمان بسته باشد، مسیر ما را مستثنا کن
add_filter('rest_authentication_errors', function ($result) {
	if (empty($result) || !is_wp_error($result)) return $result;
	$uri = isset($_SERVER['REQUEST_URI']) ? $_SERVER['REQUEST_URI'] : '';
	if (strpos($uri, 'apt-sync') !== false) return true;
	return $result;
}, 999);

// نمایش وضعیت در فهرست افزونه‌ها
add_filter('plugin_row_meta', function ($links, $file) {
	if ($file === plugin_basename(__FILE__)) $links[] = '<a href="' . esc_url(rest_url('apt-sync/v1/sync')) . '" target="_blank">بررسی سرور</a>';
	return $links;
}, 10, 2);

// گزارش ۶۰ درخواست آخر (بدون رمز و توکن) برای عیب‌یابی
function apt_sync_log($body, $status, $out) {
	$a = is_array($body) && isset($body['action']) ? (string) $body['action'] : '?';
	$e = array('t' => current_time('mysql'), 'a' => $a, 's' => $status, 'o' => (string) get_http_origin());
	if (is_array($body)) {
		if (!empty($body['code'])) $e['code'] = substr((string) $body['code'], 0, 30);
		if (!empty($body['phone'])) $e['ph'] = substr(Apt_Sync_Core::normPhone($body['phone']), -4);
		if (!empty($body['changes']) && is_array($body['changes'])) $e['keys'] = implode(',', array_keys($body['changes']));
	}
	if (is_array($out) && isset($out['error'])) $e['err'] = $out['error'];
	if (is_object($out['applied'] ?? null)) $e['ok'] = implode(',', array_keys((array) $out['applied']));
	if (is_object($out['conflicts'] ?? null) && count((array) $out['conflicts'])) $e['cf'] = implode(',', array_keys((array) $out['conflicts']));
	$log = get_option('apt_sync_log', array());
	if (!is_array($log)) $log = array();
	array_unshift($log, $e);
	update_option('apt_sync_log', array_slice($log, 0, 60), false);
}

// صفحه مدیریت: ابزارها ← آپارتمان پلاس
add_action('admin_menu', function () {
	add_management_page('آپارتمان پلاس', 'آپارتمان پلاس (همگام‌سازی)', 'manage_options', 'apt-sync', 'apt_sync_admin_page');
});
function apt_sync_admin_page() {
	global $wpdb; $t = $wpdb->prefix . 'apt_sync'; $c = $wpdb->prefix . 'apt_sync_codes';
	echo '<div class="wrap" style="direction:rtl"><h1>آپارتمان پلاس — سرور همگام‌سازی</h1>';
	echo '<p>آدرس سرور: <code>' . esc_html(rest_url('apt-sync/v1/sync')) . '</code></p>';
	$phones = $wpdb->get_col("SELECT DISTINCT phone FROM $t");
	echo '<h2>ساختمان‌ها (' . count($phones) . ')</h2><table class="widefat striped"><thead><tr><th>شماره مدیر</th><th>کد ساختمان</th><th>کدهای ایندکس</th><th>تعداد کلید</th><th>واحدها</th><th>ساکنین ثبت‌نامی</th><th>آخرین تغییر</th><th>توسط</th></tr></thead><tbody>';
	foreach ($phones as $ph) {
		$meta = json_decode((string) $wpdb->get_var($wpdb->prepare("SELECT v FROM $t WHERE phone=%s AND k='__meta'", $ph)), true);
		$codes = implode('، ', $wpdb->get_col($wpdb->prepare("SELECT code FROM $c WHERE phone=%s", $ph)));
		$n = (int) $wpdb->get_var($wpdb->prepare("SELECT COUNT(*) FROM $t WHERE phone=%s AND k LIKE %s", $ph, 'k:%'));
		$units = json_decode((string) $wpdb->get_var($wpdb->prepare("SELECT v FROM $t WHERE phone=%s AND k='k:units'", $ph)), true);
		$regs = json_decode((string) $wpdb->get_var($wpdb->prepare("SELECT v FROM $t WHERE phone=%s AND k='k:registered_residents'", $ph)), true);
		$rs = array(); foreach ((array) $regs as $r) { $st = is_array($r) && isset($r['status']) ? $r['status'] : '?'; $rs[$st] = ($rs[$st] ?? 0) + 1; }
		$rsTxt = ''; foreach ($rs as $k => $v) $rsTxt .= esc_html($k) . ': ' . $v . ' ';
		$last = $wpdb->get_row($wpdb->prepare("SELECT k, t, by_role FROM $t WHERE phone=%s AND k LIKE %s ORDER BY t DESC LIMIT 1", $ph, 'k:%'), ARRAY_A);
		echo '<tr><td>' . esc_html(substr($ph, 0, 4) . '***' . substr($ph, -4)) . '</td><td>' . esc_html($meta['code'] ?? '') . '</td><td>' . esc_html($codes) . '</td><td>' . $n . '</td><td>' . (is_array($units) ? count($units) : '-') . '</td><td>' . ($rsTxt ?: '-') . '</td><td>' . ($last ? esc_html(wp_date('Y-m-d H:i:s', (int) ($last['t'] / 1000)) . ' (' . substr($last['k'], 2) . ')') : '-') . '</td><td>' . esc_html($last['by_role'] ?? '') . '</td></tr>';
	}
	echo '</tbody></table><h2>درخواست‌های اخیر</h2><table class="widefat striped"><thead><tr><th>زمان</th><th>اکشن</th><th>وضعیت</th><th>کد</th><th>تلفن</th><th>کلیدها</th><th>اعمال‌شده</th><th>تعارض</th><th>خطا</th><th>Origin</th></tr></thead><tbody>';
	foreach ((array) get_option('apt_sync_log', array()) as $e) {
		echo '<tr>'; foreach (array('t', 'a', 's', 'code', 'ph', 'keys', 'ok', 'cf', 'err', 'o') as $f) echo '<td>' . esc_html($e[$f] ?? '') . '</td>'; echo '</tr>';
	}
	echo '</tbody></table></div>';
}
