<?php
require_once __DIR__ . '/devices_store.php';
header('Content-Type: application/json; charset=UTF-8');

$state = devices_load(); // liest /var/www/signage/data/devices.json
$pending = [];
if (!empty($state['pending']) && is_array($state['pending'])) {
  foreach ($state['pending'] as $code => $info) {
    $pending[] = ['code'=>$code, 'ts'=>$info['ts'] ?? null, 'ip'=>$info['ip'] ?? null];
  }
}
echo json_encode(['ok'=>true,'pending'=>$pending], JSON_UNESCAPED_SLASHES);
