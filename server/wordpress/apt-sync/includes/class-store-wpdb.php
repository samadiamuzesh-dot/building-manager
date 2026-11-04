<?php
/** ذخیره‌سازی در جدول‌های اختصاصی MySQL وردپرس */
if (!defined('ABSPATH')) exit;

class Apt_Sync_Store_WPDB {
	private $db; private $t; private $c;
	public function __construct() { global $wpdb; $this->db = $wpdb; $this->t = $wpdb->prefix . 'apt_sync'; $this->c = $wpdb->prefix . 'apt_sync_codes'; }

	public static function install() {
		global $wpdb;
		require_once ABSPATH . 'wp-admin/includes/upgrade.php';
		$cs = $wpdb->get_charset_collate();
		dbDelta("CREATE TABLE {$wpdb->prefix}apt_sync (
  phone varchar(20) NOT NULL,
  k varchar(40) NOT NULL,
  v longtext NULL,
  r bigint(20) NOT NULL DEFAULT 0,
  t bigint(20) NOT NULL DEFAULT 0,
  by_role char(1) NOT NULL DEFAULT '',
  PRIMARY KEY  (phone,k)
) $cs;");
		dbDelta("CREATE TABLE {$wpdb->prefix}apt_sync_codes (
  code varchar(40) NOT NULL,
  phone varchar(20) NOT NULL,
  PRIMARY KEY  (code)
) $cs;");
		update_option('apt_sync_db', '1', false);
	}

	public function getMeta($phone) {
		$v = $this->db->get_var($this->db->prepare("SELECT v FROM {$this->t} WHERE phone=%s AND k='__meta'", $phone));
		$j = $v ? json_decode($v, true) : null;
		return is_array($j) ? $j : null;
	}
	public function setMeta($phone, $meta) {
		$this->db->replace($this->t, array('phone' => $phone, 'k' => '__meta', 'v' => wp_json_encode($meta), 'r' => 0, 't' => Apt_Sync_Core::now(), 'by_role' => 'm'));
	}
	public function getKey($phone, $base) {
		$row = $this->db->get_row($this->db->prepare("SELECT v, r FROM {$this->t} WHERE phone=%s AND k=%s", $phone, 'k:' . $base), ARRAY_A);
		return $row ? array('v' => $row['v'], 'r' => (int) $row['r']) : null;
	}
	public function getAll($phone) {
		$rows = $this->db->get_results($this->db->prepare("SELECT k, v, r FROM {$this->t} WHERE phone=%s AND k LIKE %s", $phone, 'k:%'), ARRAY_A);
		$out = array();
		foreach ((array) $rows as $row) $out[substr($row['k'], 2)] = array('v' => $row['v'], 'r' => (int) $row['r']);
		return $out;
	}
	public function putKey($phone, $base, $v, $r, $by) {
		$ok = $this->db->replace($this->t, array('phone' => $phone, 'k' => 'k:' . $base, 'v' => $v, 'r' => $r, 't' => Apt_Sync_Core::now(), 'by_role' => $by));
		if ($ok === false) throw new Apt_Sync_Error(500, 'db_write_failed');
	}
	public function delKey($phone, $base) { $this->db->delete($this->t, array('phone' => $phone, 'k' => 'k:' . $base)); }
	public function codeOwner($code) { $p = $this->db->get_var($this->db->prepare("SELECT phone FROM {$this->c} WHERE code=%s", $code)); return $p ? $p : null; }
	public function setCode($code, $phone) { $this->db->replace($this->c, array('code' => $code, 'phone' => $phone)); }
	public function delCode($code) { $this->db->delete($this->c, array('code' => $code)); }
	public function lock($phone) { return (int) $this->db->get_var($this->db->prepare('SELECT GET_LOCK(%s, 8)', 'apt_sync_' . $phone)) === 1; }
	public function unlock($phone) { $this->db->query($this->db->prepare('SELECT RELEASE_LOCK(%s)', 'apt_sync_' . $phone)); }
	public function rateHit($key, $sec) {
		$k = 'apt_rl_' . md5($key);
		$d = get_transient($k);
		$n = is_array($d) ? (int) $d['n'] + 1 : 1;
		$exp = is_array($d) ? (int) $d['x'] : time() + $sec;
		set_transient($k, array('n' => $n, 'x' => $exp), max(1, $exp - time()));
		return $n;
	}
}
