<?php
require_once __DIR__ . '/auth/guard.php';
require_once __DIR__ . '/devices_store.php';
auth_require_role('editor');
header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-store');

$body = json_decode(file_get_contents('php://input'), true) ?: [];
$devIn = devices_normalize_device_id($body['device'] ?? '');
$name  = trim((string)($body['name'] ?? ''));

if (($body['device'] ?? '') === '') {
  echo json_encode(['ok'=>false, 'error'=>'missing-device']);
  exit;
}

if ($devIn === '') {
  echo json_encode(['ok'=>false, 'error'=>'invalid-device']);
  exit;
}

$db = devices_load();
if (!$db) {
  echo json_encode(['ok'=>false, 'error'=>'load-failed']);
  exit;
}

if (!isset($db['devices'][$devIn])) {
  echo json_encode(['ok'=>false, 'error'=>'unknown-device']);
  exit;
}

$db['devices'][$devIn]['name'] = $name;

try {
  devices_save($db);
} catch (Exception $e) {
  echo json_encode(['ok'=>false, 'error'=>'save-failed']);
  exit;
}

auth_audit('device.rename', [
  'deviceId' => $devIn,
  'name' => $name
]);

echo json_encode(['ok'=>true, 'device'=>$devIn, 'name'=>$name]);
