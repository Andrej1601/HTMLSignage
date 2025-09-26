<?php
// /var/www/signage/admin/api/devices_status.php
require_once __DIR__ . '/auth/guard.php';
require_once __DIR__ . '/devices_store.php';
auth_require_role('viewer');
header('Content-Type: application/json; charset=UTF-8');

$state = devices_load();

$pairings = array_values($state['pairings'] ?? []);
// neuestes NICHT beanspruchtes Pairing finden
$open = null;
foreach ($pairings as $p) {
  if (empty($p['deviceId'])) {
    if ($open === null || (int)$p['created'] > (int)$open['created']) $open = $p;
  }
}

$devices = array_values($state['devices'] ?? []);
echo json_encode([
  'ok' => true,
  'now' => time(),
  'openPairing' => $open,   // {code, created} oder null
  'devices' => $devices     // [{id,name,created,lastSeen}, ...]
]);
