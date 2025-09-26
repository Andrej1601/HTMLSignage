<?php
require_once __DIR__ . '/auth/guard.php';
require_once __DIR__ . '/devices_store.php';
auth_require_role('editor');
header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-store');

$body  = json_decode(file_get_contents('php://input'), true) ?: [];
$rawId = $body['device'] ?? '';
$rawId = is_string($rawId) ? trim($rawId) : '';
$didIn = devices_normalize_device_id($rawId);
$purge = !empty($body['purge']);

$db = devices_load();
if (!$db) { echo json_encode(['ok'=>false,'error'=>'load-failed']); exit; }

if ($rawId === '') { echo json_encode(['ok'=>false,'error'=>'missing-device']); exit; }
if ($didIn === '') { echo json_encode(['ok'=>false,'error'=>'invalid-device']); exit; }
if (!isset($db['devices'][$didIn])) { echo json_encode(['ok'=>false,'error'=>'unknown-device']); exit; }

// Pairings entkoppeln
if (!empty($db['pairings'])) {
  foreach ($db['pairings'] as $code => &$row) {
    if (isset($row['deviceId']) && devices_normalize_device_id($row['deviceId']) === $didIn) {
      unset($row['deviceId']);
    }
  }
  unset($row);
}

// Purge: Gerätseintrag ganz weg, sonst nur Overrides löschen
if ($purge) { unset($db['devices'][$didIn]); }
else {
  if (isset($db['devices'][$didIn]['overrides'])) unset($db['devices'][$didIn]['overrides']);
}

if (!devices_save($db)) { echo json_encode(['ok'=>false,'error'=>'save-failed']); exit; }
auth_audit('device.unpair', [
  'deviceId' => $didIn,
  'purge' => $purge
]);
echo json_encode(['ok'=>true,'device'=>$didIn,'removed'=>$purge?1:0]);
