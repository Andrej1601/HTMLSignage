<?php
require_once __DIR__ . '/auth/guard.php';
require_once __DIR__ . '/devices_store.php';
auth_require_role('editor');
header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-store');

$raw = file_get_contents('php://input');
$in  = json_decode($raw, true);
$rawDevice = isset($in['device']) ? trim((string)$in['device']) : '';
$devId = devices_normalize_device_id($rawDevice);
$mode  = isset($in['mode']) ? trim($in['mode']) : '';
if ($rawDevice === '' || !in_array($mode, ['global','device'], true)) {
  echo json_encode(['ok'=>false, 'error'=>'invalid']);
  exit;
}

if ($devId === '') {
  echo json_encode(['ok'=>false, 'error'=>'invalid-device']);
  exit;
}

$db = devices_load();
if (!isset($db['devices'][$devId])) {
  echo json_encode(['ok'=>false, 'error'=>'unknown-device']);
  exit;
}

$db['devices'][$devId]['useOverrides'] = ($mode === 'device');

if (!devices_save($db)) {
  echo json_encode(['ok'=>false, 'error'=>'write-failed']);
  exit;
}

auth_audit('device.mode', [
  'deviceId' => $devId,
  'mode' => $mode
]);

echo json_encode(['ok'=>true]);
