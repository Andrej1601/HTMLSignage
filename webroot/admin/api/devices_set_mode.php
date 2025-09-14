<?php
require_once __DIR__ . '/devices_store.php';
header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-store');

$raw = file_get_contents('php://input');
$in  = json_decode($raw, true);
$devId = isset($in['device']) ? trim($in['device']) : '';
$mode  = isset($in['mode']) ? trim($in['mode']) : '';
if ($devId === '' || !in_array($mode, ['global','device'], true)) {
  echo json_encode(['ok'=>false, 'error'=>'invalid']);
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

echo json_encode(['ok'=>true]);
