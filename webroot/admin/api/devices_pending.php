<?php
require_once __DIR__ . '/auth/guard.php';
require_once __DIR__ . '/devices_store.php';
auth_require_role('editor');
header('Content-Type: application/json; charset=UTF-8');

$state = devices_load(); // lädt Gerätezustand aus der SQLite-Datenbank
$pending = [];
if (!empty($state['pending']) && is_array($state['pending'])) {
  foreach ($state['pending'] as $code => $info) {
    $pending[] = ['code'=>$code, 'ts'=>$info['ts'] ?? null, 'ip'=>$info['ip'] ?? null];
  }
}
echo json_encode(['ok'=>true,'pending'=>$pending], JSON_UNESCAPED_SLASHES);
