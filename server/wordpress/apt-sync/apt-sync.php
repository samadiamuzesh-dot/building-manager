<?php
/**
 * Plugin Name: Apartment Plus Sync (آپارتمان پلاس — همگام‌سازی)
 * Description: سرور همگام‌سازی موقت پنل مدیر و پنل ساکن برنامه «آپارتمان پلاس». فقط یک مسیر REST دارد (/wp-json/apt-sync/v1/sync)، هیچ صفحه یا محتوای عمومی نمی‌سازد و روی سئوی سایت اثری ندارد.
 * Version: 1.0.0
 * Requires PHP: 7.2
 * Author: Hark
 */
if (!defined('ABSPATH')) exit;

define('APT_SYNC_VER', '1.0.0');
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
