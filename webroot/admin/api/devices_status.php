<?php
// /var/www/signage/admin/api/devices_status.php
header('Content-Type: application/json; charset=UTF-8');

$fn = __DIR__ . '/../../data/devices.json';
$state = json_decode(@file_get_contents($fn), true);
if (!$state) $state = ['version'=>1, 'devices'=>[], 'pairings'=>[]];

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
